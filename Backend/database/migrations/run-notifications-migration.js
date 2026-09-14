import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from Backend folder (parent of database/migrations)
const envPath = join(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath });

async function runMigration() {
  let connection;
  try {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'campusbuzz';

    console.log('Connecting to MySQL:', dbHost + ':' + dbPort, 'database:', dbName);

    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
    });

    const migrationSQL = readFileSync(
      join(__dirname, 'add_notifications.sql'),
      'utf-8'
    );

    const sql = migrationSQL.replace(/^--.*$/gm, '').trim();
    await connection.query(sql);
    console.log('✅ CREATE TABLE executed.');

    const [rows] = await connection.query("SHOW TABLES LIKE 'notifications'");
    if (rows.length > 0) {
      console.log('✅ Verified: notifications table exists in database:', dbName);
    } else {
      console.log('⚠️  Table "notifications" not found.');
    }

    console.log('✅ Done.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) console.error('   Code:', error.code);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
