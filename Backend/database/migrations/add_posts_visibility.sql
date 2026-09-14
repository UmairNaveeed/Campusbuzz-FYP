-- Add visibility column for post privacy: 'public' (Discover + Following) or 'private' (Following only)
-- Run this once in MySQL (e.g. phpMyAdmin). If the column already exists, you'll get an error (safe to ignore).

USE campusbuzz;

ALTER TABLE posts ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'public' AFTER is_deleted;
