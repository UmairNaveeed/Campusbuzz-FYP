# Field Name Mappings - Schema to Code

This document ensures all database column names (snake_case) match the Sequelize model field names (camelCase) and controller usage.

## Configuration
- Sequelize `underscored: true` automatically maps camelCase → snake_case
- `createdAt` → `created_at`
- `updatedAt` → `updated_at`

## Users Table (`users`)

| Database Column | Model Field | Controller Usage | Status |
|----------------|-------------|------------------|--------|
| `id` | `id` | `user.id` | ✅ |
| `firebase_id` | `firebaseId` | `firebaseId: uid` | ✅ |
| `email` | `email` | `email` | ✅ |
| `name` | `name` | `name` | ✅ |
| `username` | `username` | `username` | ✅ |
| `start_year` | `startYear` | `startYear` | ✅ |
| `end_year` | `endYear` | `endYear` | ✅ |
| `department` | `department` | `department` | ✅ |
| `start_semester` | `startSemester` | `startSemester` | ✅ |
| `roll_number` | `rollNumber` | `rollNumber` | ✅ |
| `bio` | `bio` | `bio` | ✅ |
| `location` | `location` | `location` | ✅ |
| `program` | `program` | `program` | ✅ |
| `current_status` | `currentStatus` | `currentStatus` | ✅ |
| `profile_photo` | `profilePhoto` | `profilePhoto` | ✅ |
| `cover_photo` | `coverPhoto` | `coverPhoto` | ✅ |
| `created_at` | `createdAt` | `createdAt` | ✅ |
| `updated_at` | `updatedAt` | `updatedAt` | ✅ |

## Posts Table (`posts`)

| Database Column | Model Field | Controller Usage | Status |
|----------------|-------------|------------------|--------|
| `id` | `id` | `post.id` | ✅ |
| `author_id` | `authorId` | `authorId: user.id` | ✅ |
| `content` | `content` | `content` | ✅ |
| `image` | `image` | `image` | ✅ |
| `likes_count` | `likesCount` | `likesCount` | ✅ |
| `comments_count` | `commentsCount` | `commentsCount` | ✅ |
| `reports_count` | `reportsCount` | `reportsCount` | ✅ |
| `shares_count` | `sharesCount` | `sharesCount` | ✅ |
| `is_deleted` | `isDeleted` | `isDeleted: false` | ✅ |
| `created_at` | `createdAt` | `order: [['createdAt', 'DESC']]` | ✅ |
| `updated_at` | `updatedAt` | `updatedAt` | ✅ |

## Junction Tables

### User Follows (`user_follows`)
- `follower_id` → `followerId` ✅
- `following_id` → `followingId` ✅
- Usage: `where: { followerId: user.id }`, `where: { followingId: user.id }` ✅

### Post Likes (`post_likes`)
- `post_id` → `postId` ✅
- `user_id` → `userId` ✅
- Usage: `where: { postId: { [Op.in]: postIds }, userId: user.id }` ✅

### Post Mentions (`post_mentions`)
- `post_id` → `postId` ✅
- `user_id` → `userId` ✅
- Usage: `where: { postId: { [Op.in]: postIds } }` ✅

## Important Notes

1. **Always use camelCase in controllers** - Sequelize automatically maps to snake_case
2. **Order clauses** - Use `createdAt` not `created_at` (Sequelize handles mapping)
3. **Where clauses** - Use camelCase field names: `firebaseId`, `authorId`, `followerId`, etc.
4. **Attributes arrays** - Use camelCase: `["id", "firebaseId", "name", ...]`
5. **Response objects** - Use camelCase (Sequelize models return camelCase)

## Verification Checklist

- ✅ All model field definitions have `field:` mapping to snake_case
- ✅ All controllers use camelCase field names
- ✅ All where clauses use camelCase
- ✅ All attributes arrays use camelCase
- ✅ All order clauses use `createdAt` (not `created_at`)
- ✅ All response objects use camelCase
- ✅ Firebase UID accessed as `req.user.uid` (not `req.user.id`)

## Common Mistakes to Avoid

❌ **DON'T**: `where: { firebase_id: uid }`  
✅ **DO**: `where: { firebaseId: uid }`

❌ **DON'T**: `order: [['created_at', 'DESC']]`  
✅ **DO**: `order: [['createdAt', 'DESC']]`

❌ **DON'T**: `attributes: ["firebase_id", "profile_photo"]`  
✅ **DO**: `attributes: ["firebaseId", "profilePhoto"]`

❌ **DON'T**: `const { id } = req.user` (for Firebase)  
✅ **DO**: `const { uid } = req.user`
