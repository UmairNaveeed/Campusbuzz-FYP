/**
 * Script to delete a specific user from the database
 * Usage: node scripts/deleteUser.js <roll_number_or_username>
 * Example: node scripts/deleteUser.js rida49
 * Example: node scripts/deleteUser.js 221370011
 */

import dotenv from 'dotenv';
import { Op } from 'sequelize';
import { connectDB } from '../database/connect.js';
import { User, GroupInvite } from '../database/index.js';

dotenv.config();

async function deleteUser(identifier) {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    // Try to find user by roll_number, username, or email
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { rollNumber: identifier },
          { username: identifier },
          { email: identifier },
          { email: `${identifier}@gift.edu.pk` }
        ]
      }
    });

    if (!user) {
      console.log(`❌ User not found with identifier: ${identifier}`);
      console.log('💡 Try using: roll_number, username, or email');
      process.exit(1);
    }

    console.log(`📋 Found user:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Roll Number: ${user.rollNumber}`);
    console.log(`   Firebase ID: ${user.firebaseId}\n`);

    // Confirm deletion
    console.log('⚠️  This will delete the user and all related data (posts, comments, messages, etc.)');
    console.log('   Due to CASCADE constraints, related records will be automatically deleted.\n');

    // First, manually delete group_invites if constraint doesn't allow CASCADE
    // This handles the case where the constraint might be NO ACTION
    try {
      const deletedInvites = await GroupInvite.destroy({
        where: {
          [Op.or]: [
            { invitedUserId: user.id },
            { invitedById: user.id }
          ]
        }
      });
      if (deletedInvites > 0) {
        console.log(`   Deleted ${deletedInvites} group invite(s) related to this user`);
      }
    } catch (inviteErr) {
      console.warn(`   Warning: Could not delete group invites: ${inviteErr.message}`);
      // Continue anyway - might already be handled by CASCADE
    }

    // Delete the user
    await User.destroy({ where: { id: user.id } });
    
    console.log(`✅ Successfully deleted user: ${user.name} (${user.username})`);
    console.log(`   User ID ${user.id} and all related data have been removed from the database.`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting user:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get identifier from command line arguments
const identifier = process.argv[2];

if (!identifier) {
  console.log('❌ Please provide a user identifier');
  console.log('Usage: node scripts/deleteUser.js <roll_number_or_username>');
  console.log('Example: node scripts/deleteUser.js rida49');
  console.log('Example: node scripts/deleteUser.js 221370011');
  process.exit(1);
}

deleteUser(identifier);
