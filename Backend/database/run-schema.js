/**
 * Node.js script to execute the SQL schema file.
 * Run: node database/run-schema.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campusbuzz',
  dialect: 'mysql',
};

async function runSchema() {
  // Connect without specifying database first (to create it if needed)
  const adminSequelize = new Sequelize('', dbConfig.username, dbConfig.password, {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: false,
    dialectOptions: {
      multipleStatements: true, // Allow multiple SQL statements
    },
  });

  try {
    await adminSequelize.authenticate();
    console.log('✅ Connected to MySQL server');

    // Read SQL file
    const sqlPath = join(__dirname, 'schema.sql');
    let sql = readFileSync(sqlPath, 'utf-8');

    console.log('📝 Executing SQL schema file...');

    try {
      // Execute the entire SQL file at once
      // MySQL supports multiple statements separated by semicolons
      await adminSequelize.query(sql);
      console.log('✅ Schema execution completed successfully!');
      console.log('💡 All tables should now be created in the database.');
    } catch (err) {
      // If it fails, try executing statement by statement
      console.log('⚠️  Bulk execution failed, trying statement-by-statement...');
      console.log(`   Error: ${err.message}`);
      
      // Remove comments
      sql = sql.replace(/--.*$/gm, '');
      sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
      
      // Split by semicolons
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 10); // Filter out empty or very short strings

      console.log(`📝 Found ${statements.length} SQL statements to execute...`);

      let executed = 0;
      let errors = 0;
      let dbSwitched = false;

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim() && statement.length > 10) {
          try {
            await adminSequelize.query(statement);
            executed++;
            
            // After CREATE DATABASE, switch to that database
            if (statement.toUpperCase().includes('CREATE DATABASE') && !dbSwitched) {
              const dbName = dbConfig.database;
              await adminSequelize.query(`USE ${dbName};`);
              dbSwitched = true;
              console.log(`   ✅ Database created and switched to: ${dbName}`);
            }
            
            if (executed % 5 === 0) {
              console.log(`   Progress: ${executed}/${statements.length} statements...`);
            }
          } catch (err) {
            const errMsg = err.message.toLowerCase();
            if (
              errMsg.includes('already exists') ||
              errMsg.includes('duplicate')
            ) {
              executed++; // Count as success
            } else {
              errors++;
              console.error(`❌ Error in statement ${i + 1}:`, err.message);
              console.error(`   Preview: ${statement.substring(0, 100).replace(/\n/g, ' ')}...`);
            }
          }
        }
      }

      console.log(`\n✅ Execution completed!`);
      console.log(`   Executed: ${executed} statements`);
      if (errors > 0) {
        console.log(`   Errors: ${errors}`);
      }
    }
    
    console.log('💡 You can now start your backend server.');
  } catch (error) {
    console.error('❌ Fatal Error:', error.message);
    console.error('💡 Make sure:');
    console.error('   1. MySQL is running');
    console.error('   2. DB_HOST, DB_USER, DB_PASSWORD are set correctly in .env');
    console.error('   3. The user has permission to create databases');
    process.exit(1);
  } finally {
    await adminSequelize.close();
  }
}

runSchema();
