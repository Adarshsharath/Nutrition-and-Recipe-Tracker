#!/usr/bin/env tsx
/**
 * Runs sql/*.sql files in numeric order against MySQL.
 * Handles DELIMITER directives for triggers and procedures.
 * Stops immediately on error and returns non-zero exit status.
 *
 * Usage:
 *   npx tsx scripts/run-sql.ts                           # Runs all schema/seed files (excludes demo queries)
 *   npx tsx scripts/run-sql.ts sql/06_demo_queries.sql   # Runs manual demonstration queries
 */
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function splitSqlStatements(content: string): string[] {
  const statements: string[] = [];
  const lines = content.split(/\r?\n/);
  let currentDelimiter = ';';
  let buffer = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for delimiter change command
    if (trimmed.toUpperCase().startsWith('DELIMITER ')) {
      const newDelim = trimmed.substring(10).trim();
      if (buffer.trim()) {
        statements.push(buffer.trim());
        buffer = '';
      }
      currentDelimiter = newDelim;
      continue;
    }

    buffer += line + '\n';

    if (currentDelimiter && buffer.trimEnd().endsWith(currentDelimiter)) {
      const stmt = buffer.trimEnd().slice(0, -currentDelimiter.length).trim();
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      buffer = '';
    }
  }

  if (buffer.trim()) {
    statements.push(buffer.trim());
  }

  return statements;
}

function getStatementSummary(stmt: string): string {
  const clean = stmt.replace(/^(\s*--[^\r\n]*\r?\n)+/, '').trim();
  const firstLine = clean.split(/\r?\n/)[0]?.trim() || '';
  if (firstLine.length > 80) {
    return firstLine.slice(0, 77) + '...';
  }
  return firstLine;
}

// Automatically load .env.local for standalone execution
try {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        val = val.replace(/^['"](.*)['"]$/, '$1').trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {
  // ignore
}

async function main() {
  const customTarget = process.argv[2];
  const sqlDir = path.join(__dirname, '..', 'sql');

  let files: string[] = [];
  let isDemoRun = false;

  if (customTarget) {
    const targetBase = path.basename(customTarget);
    const targetPath = path.join(sqlDir, targetBase);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`SQL file not found: ${targetBase} (looked in ${sqlDir})`);
    }
    files = [targetBase];
    isDemoRun = targetBase.includes('demo_queries');
  } else {
    // Database initialization: run setup files in numeric order,
    // excluding manual demonstration queries (06_demo_queries.sql)
    files = fs.readdirSync(sqlDir)
      .filter((f) => f.endsWith('.sql') && !f.includes('demo_queries'))
      .sort();
  }

  console.log('Connecting to MySQL…');
  let conn: mysql.Connection | null = null;

  try {
    conn = await mysql.createConnection({
      host:     process.env.MYSQL_HOST     ?? 'localhost',
      port:     Number(process.env.MYSQL_PORT ?? 3306),
      user:     process.env.MYSQL_USER     ?? 'root',
      password: process.env.MYSQL_PASSWORD ?? 'rootpassword',
      multipleStatements: true,
    });

    for (const file of files) {
      console.log(`\n▶ Processing ${file} …`);
      const content = fs.readFileSync(path.join(sqlDir, file), 'utf8');
      const stmts = splitSqlStatements(content);
      let executedCount = 0;

      for (let i = 0; i < stmts.length; i++) {
        const stmt = stmts[i];
        const cleanStmt = stmt.replace(/^(\s*--[^\r\n]*\r?\n)+/, '').trim();
        if (!cleanStmt) continue;

        try {
          await conn.query(cleanStmt);
          executedCount++;
        } catch (err) {
          const error = err as Error;
          const summary = getStatementSummary(cleanStmt);
          console.error(`\n❌ Error in ${file} at statement #${i + 1}:`);
          console.error(`   Statement: ${summary}`);
          console.error(`   Details:   ${error.message}\n`);
          throw new Error(`Failed executing ${file} at statement #${i + 1}: ${error.message}`);
        }
      }

      console.log(`  ✓ ${file} (${executedCount} statements executed)`);
    }

    if (isDemoRun) {
      console.log('\n✅ Demonstration queries executed successfully.');
    } else {
      console.log('\n✅ All MySQL schema and seed files processed.');
    }
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

main().catch((err) => {
  console.error(`\nExecution stopped: ${(err as Error).message}`);
  process.exit(1);
});
