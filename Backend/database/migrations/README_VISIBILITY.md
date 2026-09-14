# Post visibility (Public / Private)

For **private vs public post** logic to work, the `posts` table must have a `visibility` column.

## Run the migration

**Option 1 – phpMyAdmin**  
1. Open your database (e.g. `campusbuzz`).  
2. Go to the **SQL** tab.  
3. Paste and run the contents of `add_posts_visibility.sql`.

**Option 2 – MySQL command line**  
```bash
mysql -u YOUR_USER -p campusbuzz < database/migrations/add_posts_visibility.sql
```

After this, **Discover** will show only public posts, and **Following** will show your posts and posts from people you follow (both public and private).
