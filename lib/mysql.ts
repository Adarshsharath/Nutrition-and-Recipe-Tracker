import mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';

// Automatically load .env.local for standalone scripts (e.g. seed scripts)
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
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

const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST     ?? 'localhost',
  port:     Number(process.env.MYSQL_PORT ?? 3306),
  user:     process.env.MYSQL_USER     ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? 'rootpassword',
  database: process.env.MYSQL_DATABASE ?? 'nutrition_tracker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
});

export default pool;
