-- Migration: Add blocked_at timestamp to conversation_blocked_by table
-- This migration adds a timestamp column to track when users were blocked

ALTER TABLE conversation_blocked_by 
ADD COLUMN blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP AFTER user_id;

-- Update existing rows to have a timestamp (set to current time for existing blocks)
UPDATE conversation_blocked_by 
SET blocked_at = CURRENT_TIMESTAMP 
WHERE blocked_at IS NULL;
