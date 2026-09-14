/**
 * Manual test script to sync Firebase users with MySQL
 * Run with: node scripts/testSync.js
 */

import dotenv from 'dotenv';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { syncMongoUsersWithFirebase } from '../utils/syncFirebaseUsers.js';
import { connectDB } from '../database/connect.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebaseAdmin', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function main() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    console.log('🔄 Starting Firebase sync...');
    const result = await syncMongoUsersWithFirebase(admin.auth());
    
    console.log('\n✅ Sync completed!');
    console.log(`   Checked: ${result.checked} users`);
    console.log(`   Deleted: ${result.deleted} users missing in Firebase`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
