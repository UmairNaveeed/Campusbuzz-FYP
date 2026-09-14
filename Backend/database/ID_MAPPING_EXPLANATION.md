# ID Mapping Explanation: Firebase UID vs MySQL ID

## Understanding the Two Different IDs

### 1. **MySQL Primary Key (`id`)**
- **Database Column**: `id` (INT UNSIGNED AUTO_INCREMENT)
- **Purpose**: Internal database primary key
- **Example Values**: `1`, `2`, `3`, `4`...
- **Used For**: Foreign key relationships, internal database operations
- **Model Field**: `user.id`
- **When to Use**: When referencing users in database relationships (follows, likes, etc.)

### 2. **Firebase UID (`firebase_id`)**
- **Database Column**: `firebase_id` (VARCHAR(128))
- **Purpose**: Firebase Authentication User ID
- **Example Values**: `VRgAbMkoJ9a7AfcjJP1x94IrFmp2`
- **Used For**: Authentication, finding users from Firebase tokens
- **Model Field**: `user.firebaseId`
- **When to Use**: When authenticating users, finding users from Firebase tokens

## Code Flow

```
Firebase Token → req.user.uid → firebaseId (model) → firebase_id (database)
                                    ↓
                              Find user by firebaseId
                                    ↓
                              Get user.id (MySQL primary key)
                                    ↓
                              Use user.id for relationships
```

## Example from Your Database

From phpMyAdmin screenshot:
- `id` = `1` (MySQL primary key)
- `firebase_id` = `VRgAbMkoJ9a7AfcjJP1x94IrFmp2` (Firebase UID)

## Code Usage Examples

### ✅ CORRECT: Finding User by Firebase UID
```javascript
const { uid } = req.user;  // Firebase token provides 'uid'
const user = await User.findOne({
  where: { firebaseId: uid }  // Maps to firebase_id column
});
// Now user.id = 1 (MySQL primary key)
// user.firebaseId = 'VRgAbMkoJ9a7AfcjJP1x94IrFmp2' (Firebase UID)
```

### ✅ CORRECT: Using MySQL ID for Relationships
```javascript
// After finding user by firebaseId
const followingRows = await UserFollow.findAll({
  where: { followerId: user.id }  // Uses MySQL id (1), not Firebase UID
});
```

### ✅ CORRECT: Response Includes Firebase UID
```javascript
res.json({
  user: {
    firebaseId: user.firebaseId,  // Firebase UID for frontend
    id: user.id,                  // MySQL ID (if needed)
    // ... other fields
  }
});
```

## Why This Design?

1. **Firebase UID** (`firebase_id`):
   - Comes from Firebase Authentication
   - Used to identify users from authentication tokens
   - Stable identifier that persists across database migrations

2. **MySQL ID** (`id`):
   - Auto-incrementing integer
   - More efficient for foreign keys and indexes
   - Smaller storage size (INT vs VARCHAR)
   - Better performance in JOIN operations

## Current Code Status: ✅ CORRECT

The code correctly:
- Uses `req.user.uid` to get Firebase UID from token
- Maps `uid` → `firebaseId` → `firebase_id` column
- Uses `user.id` (MySQL primary key) for relationships
- Returns `firebaseId` in API responses for frontend compatibility

## Summary

| Source | Code Variable | Model Field | Database Column | Example |
|--------|--------------|-------------|-----------------|---------|
| Firebase Token | `req.user.uid` | `firebaseId` | `firebase_id` | `VRgAbMkoJ9a7AfcjJP1x94IrFmp2` |
| MySQL Database | `user.id` | `id` | `id` | `1` |

**Both are correct and serve different purposes!**
