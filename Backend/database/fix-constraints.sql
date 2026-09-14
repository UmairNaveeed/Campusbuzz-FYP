-- Fix foreign key constraints to use CASCADE for user deletions
-- Run this in phpMyAdmin to fix the constraint issue

USE campusbuzz;

-- Drop and recreate the constraint for group_invites.invited_user_id
ALTER TABLE group_invites
  DROP FOREIGN KEY group_invites_ibfk_2;

ALTER TABLE group_invites
  ADD CONSTRAINT fk_group_invites_invited_user 
  FOREIGN KEY (invited_user_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- Also check and fix invited_by_id constraint if needed
ALTER TABLE group_invites
  DROP FOREIGN KEY IF EXISTS group_invites_ibfk_3;

ALTER TABLE group_invites
  ADD CONSTRAINT fk_group_invites_invited_by 
  FOREIGN KEY (invited_by_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;
