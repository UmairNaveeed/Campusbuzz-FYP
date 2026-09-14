import { sequelize } from '../index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Read the migration SQL file
    const migrationSQL = readFileSync(
      join(__dirname, 'add_blocked_at_timestamp.sql'),
      'utf-8'
    );

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await sequelize.query(statement + ';');
          console.log('✅ Executed:', statement.substring(0, 50) + '...');
        } catch (err) {
          // If column already exists, that's okay
          if (err.message && err.message.includes('Duplicate column name')) {
            console.log('⚠️  Column already exists, skipping...');
          } else {
            throw err;
          }
        }
      }
    }

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
