# Troubleshooting 500 Errors

## Current Status
Getting 500 errors on:
- `/api/profile/me`
- `/api/profile/suggestions`
- `/api/posts/feed`

## Debugging Steps Added

### 1. Enhanced Error Logging
All endpoints now have comprehensive logging:
- Request received logs
- User lookup logs
- Query execution logs
- Detailed error information

### 2. Check Server Terminal
**IMPORTANT**: Look at your **server terminal** (not browser console) for detailed error messages.

The logs will show:
- `🔍 getMyProfile called` - Endpoint reached
- `🔍 Looking for user with firebaseId: ...` - User lookup
- `❌ Error details:` - Full error information including SQL errors

### 3. Common Issues to Check

#### Database Connection
```bash
# Check if MySQL is running
# Check .env file has correct DB credentials
```

#### Table Existence
```sql
-- Run in phpMyAdmin or MySQL CLI
SHOW TABLES;
-- Should show: users, posts, user_follows, post_likes, etc.
```

#### Column Names
```sql
-- Check users table structure
DESCRIBE users;
-- Should show: id, firebase_id, email, name, etc.
```

### 4. What to Look For in Server Logs

Look for these error patterns:

1. **Connection Error**:
   ```
   ❌ MySQL connection error: ...
   ```
   → Database not running or wrong credentials

2. **Table Not Found**:
   ```
   Table 'campusbuzz.users' doesn't exist
   ```
   → Run schema.sql again

3. **Column Not Found**:
   ```
   Unknown column 'createdAt' in 'order clause'
   ```
   → Use `created_at` instead (but shouldn't happen with underscored: true)

4. **Sequelize Error**:
   ```
   SequelizeDatabaseError: ...
   ```
   → Check the SQL query in the error message

### 5. Quick Fixes

#### If "Table doesn't exist":
```bash
# Run schema.sql in phpMyAdmin or use run-schema.js
node database/run-schema.js
```

#### If "Column doesn't exist":
- Check that schema.sql was run correctly
- Verify column names match between schema and models

#### If "Connection refused":
- Check MySQL is running
- Verify .env file has correct DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

### 6. Test Endpoints Manually

```bash
# Test database connection
curl http://localhost:5000/api/profile/test

# Test authenticated endpoint (replace TOKEN with actual Firebase token)
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/profile/me
```

## Next Steps

1. **Check server terminal** for detailed error logs
2. **Share the exact error message** from server logs
3. **Verify database connection** is working
4. **Check tables exist** in phpMyAdmin

The enhanced logging will show exactly what's failing!

---

## "Got a packet bigger than 'max_allowed_packet' bytes" (Chat media / video)

This happens when sending a large image or video in chat: the row size exceeds MySQL’s `max_allowed_packet`.

### 1. Increase MySQL packet size

In MySQL (phpMyAdmin SQL tab or MySQL CLI):

```sql
SET GLOBAL max_allowed_packet=33554432;
```

(32MB. Use 67108864 for 64MB if you need larger videos.)

### 2. Restart the Node server

**Important:** Existing connections keep the old limit. After changing `max_allowed_packet` you must **restart your Backend server** (stop and start `node server.js` or `npm run dev`) so it opens a new connection with the new value.

### 3. Make it permanent (optional)

To keep the setting after MySQL restart, set it in config:

- **Windows:** `my.ini` → `[mysqld]` → `max_allowed_packet=32M` then restart MySQL.
- **Mac/Linux:** `my.cnf` → same line, then restart MySQL.

### 4. App limits

Chat media is limited in the app (e.g. 6MB image, 11MB video) so normal use stays under 16MB. If you increase these limits, keep total payload (with base64) below your `max_allowed_packet`.
