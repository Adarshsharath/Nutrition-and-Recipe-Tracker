#!/usr/bin/env tsx
/**
 * Runs sql/*.sql files in numeric order against MySQL.
 * Handles DELIMITER directives for triggers and procedures.
 * Usage: npx tsx scripts/run-sql.ts
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
  console.log('Connecting to MySQL…');
  const conn = await mysql.createConnection({
    host:     process.env.MYSQL_HOST     ?? 'localhost',
    port:     Number(process.env.MYSQL_PORT ?? 3306),
    user:     process.env.MYSQL_USER     ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '123456',
    multipleStatements: true,
  });

  const sqlDir = path.join(__dirname, '..', 'sql');
  const files  = fs.readdirSync(sqlDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    console.log(`\n▶ Processing ${file} …`);
    const content = fs.readFileSync(path.join(sqlDir, file), 'utf8');

    if (content.includes('DELIMITER')) {
      const stmts = splitSqlStatements(content);
      for (const stmt of stmts) {
        const cleanStmt = stmt.replace(/^(\s*--[^\r\n]*\r?\n)+/, '').trim();
        if (!cleanStmt) continue;
        try {
          await conn.query(cleanStmt);
        } catch (err) {
          console.error(`  ✗ Error in ${file} statement:`, (err as Error).message);
        }
      }
      console.log(`  ✓ ${file} (${stmts.length} statements executed)`);
    } else {
      try {
        await conn.query(content);
        console.log(`  ✓ ${file} executed successfully`);
      } catch (err) {
        console.error(`  ✗ ${file} failed:`, (err as Error).message);
      }
    }
  }

  await conn.end();
  console.log('\n✅ All MySQL schema and seed files processed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
