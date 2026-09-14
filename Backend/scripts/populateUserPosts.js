/**
 * Script to populate the 'posts' array for all users based on existing posts in the database
 * Run this once to backfill the posts array for existing users
 * 
 * Usage: node scripts/populateUserPosts.js
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

async function populateUserPosts() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all posts grouped by author
    console.log('📊 Fetching all posts from database...');
    const posts = await Post.find({ isDeleted: false }).select('author _id');
    
    console.log(`✅ Found ${posts.length} posts`);

    // Group posts by author
    const postsByAuthor = {};
    posts.forEach(post => {
      const authorId = post.author.toString();
      if (!postsByAuthor[authorId]) {
        postsByAuthor[authorId] = [];
      }
      postsByAuthor[authorId].push(post._id);
    });

    console.log(`📋 Found ${Object.keys(postsByAuthor).length} unique authors`);

    // Update each user's posts array
    let updatedCount = 0;
    for (const [authorId, postIds] of Object.entries(postsByAuthor)) {
      try {
        const user = await User.findById(authorId);
        if (!user) {
          console.log(`⚠️ User ${authorId} not found, skipping...`);
          continue;
        }

        // Use $addToSet to add posts without duplicates
        const result = await User.updateOne(
          { _id: authorId },
          { 
            $addToSet: { posts: { $each: postIds } }
          }
        );

        if (result.modifiedCount > 0) {
          updatedCount++;
          console.log(`✅ Updated user ${user.username || user.name} (${authorId}) - Added ${postIds.length} posts`);
        } else {
          console.log(`ℹ️ User ${user.username || user.name} (${authorId}) - Posts already up to date`);
        }
      } catch (error) {
        console.error(`❌ Error updating user ${authorId}:`, error.message);
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`📊 Updated ${updatedCount} users`);
    console.log(`📊 Total posts processed: ${posts.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the migration
populateUserPosts();
