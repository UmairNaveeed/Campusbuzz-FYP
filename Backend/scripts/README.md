# Database Migration Scripts

## populateUserPosts.js

This script populates the `posts` array for all users based on existing posts in the database.

### What it does:
- Finds all posts in the `posts` collection
- Groups them by author
- Adds each post ID to the corresponding user's `posts` array using MongoDB's `$addToSet` operator (prevents duplicates)

### When to run:
- After adding the `posts` array to the User model
- To backfill existing posts into users' `posts` arrays
- If you notice users' `posts` arrays are missing posts

### How to run:

1. Make sure your MongoDB connection string is set in `.env`:
   ```
   MONGODB_URI=your_connection_string
   ```

2. Run the script:
   ```bash
   cd Backend
   node scripts/populateUserPosts.js
   ```

### Expected output:
```
🔌 Connecting to MongoDB...
✅ Connected to MongoDB
📊 Fetching all posts from database...
✅ Found X posts
📋 Found Y unique authors
✅ Updated user username (authorId) - Added Z posts
...
✅ Migration complete!
📊 Updated N users
📊 Total posts processed: X
🔌 Disconnected from MongoDB
```

### Notes:
- The script uses `$addToSet` to prevent duplicate post IDs
- It only processes non-deleted posts (`isDeleted: false`)
- If a user doesn't exist, it will skip that user and continue
- The script is safe to run multiple times (idempotent)
