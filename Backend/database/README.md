# CampusBuzz MySQL Database

The project uses **MySQL** (e.g. via phpMyAdmin / XAMPP / WAMP) instead of MongoDB.

## Setup

1. **Create database and tables**
   - Open phpMyAdmin (or MySQL client).
   - Create a database named `campusbuzz` (or use the name you set in `.env`).
   - Import and run the SQL file: `Backend/database/schema.sql`.
   - This creates all tables (users, posts, comments, conversations, messages, etc.) and relations.

2. **Configure backend**
   - Copy `Backend/.env.example` to `Backend/.env`.
   - Set MySQL credentials in `.env`:
     - `DB_HOST` (e.g. `localhost`)
     - `DB_PORT` (default `3306`)
     - `DB_USER`
     - `DB_PASSWORD`
     - `DB_NAME` (e.g. `campusbuzz`)

3. **Install dependencies and start**
   - In `Backend`: `npm install` then `npm start`.
   - The API will connect to MySQL; ensure no `MONGO_URI` is required.

## Migrating data from MongoDB

If you have existing data in MongoDB, you need a one-time migration script that:

- Reads from your MongoDB collections (users, posts, comments, etc.).
- Maps `_id` to integer IDs and inserts into the MySQL tables in dependency order (users first, then posts, then comments, conversations, messages, and junction tables).

The schema in `schema.sql` matches the Sequelize models used by the Node backend.

## Controller migration status

- **Profile** – Fully migrated to Sequelize (all profile routes use MySQL).
- **Posts** – Partially migrated: `createPost`, `getFeed`, `getPostById` use Sequelize; other post endpoints (update, delete, like, comments, hashtags, share, etc.) still contain Mongoose-style code and may need to be updated to use Sequelize (e.g. `findByPk`, `findAll({ where })`, junction tables like `PostLike`, `PostHashtag`).
- **Messaging** – Imports and helpers use Sequelize; individual handlers may still reference `. _id` or Mongoose patterns and can be updated to use `.id` and Sequelize queries as you hit each endpoint.
