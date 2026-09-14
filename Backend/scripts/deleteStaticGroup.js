/**
 * Script to delete a group from the database by name
 * Usage: node scripts/deleteStaticGroup.js <groupName>
 * Example: node scripts/deleteStaticGroup.js "PDC FINAL"
 */

import dotenv from 'dotenv';
import { connectDB } from '../database/connect.js';
import {
  Conversation,
  ConversationParticipant,
  Message,
  GroupInvite,
  GroupJoinRequest,
} from '../database/index.js';

dotenv.config();

async function deleteGroup(groupName) {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    const group = await Conversation.findOne({
      isGroup: true,
      groupName: groupName,
    });

    if (!group) {
      console.log(`❌ No group found with name: "${groupName}"`);
      process.exit(1);
    }

    console.log(`📋 Found group: "${group.groupName}" (ID: ${group._id})`);
    console.log('   Deleting group and all related data...\n');

    await Message.deleteMany({ conversationId: group._id });
    await ConversationParticipant.deleteMany({ conversationId: group._id });
    await GroupInvite.deleteMany({ groupId: group._id }).catch(() => {});
    await GroupJoinRequest.deleteMany({ groupId: group._id }).catch(() => {});
    await Conversation.deleteOne({ _id: group._id });

    console.log(`✅ Successfully deleted "${group.groupName}"`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const groupName = process.argv[2];
if (!groupName) {
  console.log('❌ Please provide a group name');
  console.log('Usage: node scripts/deleteStaticGroup.js <groupName>');
  console.log('Example: node scripts/deleteStaticGroup.js "PDC FINAL"');
  process.exit(1);
}

deleteGroup(groupName);
