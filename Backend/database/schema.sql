-- CampusBuzz MySQL Schema (for phpMyAdmin / MySQL 8+)
-- Run this in phpMyAdmin to create the database and tables.

CREATE DATABASE IF NOT EXISTS campusbuzz CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campusbuzz;

-- ==================== USERS ====================
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  firebase_id VARCHAR(128) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100) DEFAULT NULL,
  start_year SMALLINT UNSIGNED DEFAULT NULL,
  end_year SMALLINT UNSIGNED DEFAULT NULL,
  department VARCHAR(255) DEFAULT NULL,
  start_semester VARCHAR(50) DEFAULT NULL,
  roll_number VARCHAR(50) DEFAULT NULL,
  bio VARCHAR(160) DEFAULT NULL,
  location VARCHAR(255) DEFAULT NULL,
  program VARCHAR(255) DEFAULT NULL,
  current_status VARCHAR(255) DEFAULT NULL,
  profile_photo TEXT DEFAULT NULL,
  cover_photo TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_firebase_id (firebase_id),
  UNIQUE KEY uk_email (email),
  UNIQUE KEY uk_username (username),
  KEY idx_username (username),
  KEY idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== USER FOLLOWS (followers / following) ====================
CREATE TABLE user_follows (
  follower_id INT UNSIGNED NOT NULL,
  following_id INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  KEY idx_following (following_id),
  CONSTRAINT fk_uf_follower FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_uf_following FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_no_self_follow CHECK (follower_id != following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== POSTS ====================
CREATE TABLE posts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  author_id INT UNSIGNED NOT NULL,
  content VARCHAR(280) NOT NULL,
  image TEXT DEFAULT NULL,
  likes_count INT UNSIGNED DEFAULT 0,
  comments_count INT UNSIGNED DEFAULT 0,
  reports_count INT UNSIGNED DEFAULT 0,
  shares_count INT UNSIGNED DEFAULT 0,
  is_deleted TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_author_created (author_id, created_at),
  KEY idx_deleted_created (is_deleted, created_at),
  KEY idx_deleted_author_created (is_deleted, author_id, created_at),
  CONSTRAINT fk_post_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== POST LIKES ====================
CREATE TABLE post_likes (
  post_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  KEY idx_user (user_id),
  CONSTRAINT fk_pl_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_pl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== HASHTAGS ====================
CREATE TABLE hashtags (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  posts_count INT UNSIGNED DEFAULT 0,
  last_used DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_name (name),
  KEY idx_posts_count (posts_count),
  KEY idx_last_used (last_used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== POST HASHTAGS (many-to-many) ====================
CREATE TABLE post_hashtags (
  post_id INT UNSIGNED NOT NULL,
  hashtag_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (post_id, hashtag_id),
  KEY idx_hashtag (hashtag_id),
  CONSTRAINT fk_ph_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_ph_hashtag FOREIGN KEY (hashtag_id) REFERENCES hashtags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== POST MENTIONS ====================
CREATE TABLE post_mentions (
  post_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (post_id, user_id),
  KEY idx_mention_user (user_id),
  CONSTRAINT fk_pm_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== COMMENTS ====================
CREATE TABLE comments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id INT UNSIGNED NOT NULL,
  author_id INT UNSIGNED NOT NULL,
  parent_comment_id INT UNSIGNED DEFAULT NULL,
  content VARCHAR(280) NOT NULL,
  likes_count INT UNSIGNED DEFAULT 0,
  replies_count INT UNSIGNED DEFAULT 0,
  is_deleted TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_post_created (post_id, created_at),
  KEY idx_parent (parent_comment_id),
  KEY idx_author (author_id),
  KEY idx_post_parent_deleted (post_id, parent_comment_id, is_deleted),
  CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_parent FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== NOTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  actor_id INT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  read_at DATETIME DEFAULT NULL,
  post_id INT UNSIGNED DEFAULT NULL,
  comment_id INT UNSIGNED DEFAULT NULL,
  extra VARCHAR(500) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_read (user_id, read_at),
  KEY idx_user_created (user_id, created_at),
  KEY idx_actor (actor_id),
  KEY idx_post (post_id),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== COMMENT LIKES ====================
CREATE TABLE comment_likes (
  comment_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (comment_id, user_id),
  KEY idx_cl_user (user_id),
  CONSTRAINT fk_cl_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  CONSTRAINT fk_cl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== REPORTS ====================
CREATE TABLE reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reported_by_id INT UNSIGNED NOT NULL,
  reported_item_id INT UNSIGNED NOT NULL,
  item_type ENUM('post', 'message', 'comment') NOT NULL,
  post_id INT UNSIGNED DEFAULT NULL,
  reason ENUM('spam','harassment','hate_speech','inappropriate_content','false_information','copyright_violation','other') NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  status ENUM('pending','reviewed','resolved','dismissed') DEFAULT 'pending',
  reviewed_by_id INT UNSIGNED DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_report_post_user (reported_by_id, post_id),
  KEY idx_post (post_id),
  KEY idx_reported_by (reported_by_id),
  KEY idx_status (status),
  CONSTRAINT fk_report_by FOREIGN KEY (reported_by_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL,
  CONSTRAINT fk_report_reviewed_by FOREIGN KEY (reviewed_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== POST REPORTS (junction for post.reports array) ====================
CREATE TABLE post_reports (
  post_id INT UNSIGNED NOT NULL,
  report_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (post_id, report_id),
  CONSTRAINT fk_pr_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_pr_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== SHARES ====================
CREATE TABLE shares (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id INT UNSIGNED NOT NULL,
  shared_by_id INT UNSIGNED NOT NULL,
  shared_with_id INT UNSIGNED NOT NULL,
  message VARCHAR(500) DEFAULT NULL,
  status ENUM('pending','viewed','accepted') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_share (post_id, shared_by_id, shared_with_id),
  KEY idx_shared_by (shared_by_id),
  KEY idx_shared_with (shared_with_id),
  KEY idx_post (post_id),
  CONSTRAINT fk_share_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_share_by FOREIGN KEY (shared_by_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_share_with FOREIGN KEY (shared_with_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== USER MEDIA (user's media array) ====================
CREATE TABLE user_media (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  post_id INT UNSIGNED NOT NULL,
  image_url TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (user_id),
  CONSTRAINT fk_um_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_um_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== USER LIKED POSTS (denormalized for "liked posts" list) ====================
CREATE TABLE user_liked_posts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  post_id INT UNSIGNED NOT NULL,
  post_content VARCHAR(280) NOT NULL,
  post_author_id INT UNSIGNED NOT NULL,
  post_author_name VARCHAR(255) DEFAULT NULL,
  post_author_username VARCHAR(100) DEFAULT NULL,
  liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (user_id),
  KEY idx_post (post_id),
  CONSTRAINT fk_ulp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ulp_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_ulp_author FOREIGN KEY (post_author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== USER COMMENTED POSTS (denormalized) ====================
CREATE TABLE user_commented_posts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  post_id INT UNSIGNED NOT NULL,
  comment_id INT UNSIGNED NOT NULL,
  post_content VARCHAR(280) NOT NULL,
  comment_content VARCHAR(280) NOT NULL,
  post_author_id INT UNSIGNED NOT NULL,
  post_author_name VARCHAR(255) DEFAULT NULL,
  post_author_username VARCHAR(100) DEFAULT NULL,
  commented_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (user_id),
  KEY idx_post (post_id),
  CONSTRAINT fk_ucp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ucp_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_ucp_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  CONSTRAINT fk_ucp_author FOREIGN KEY (post_author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== CONVERSATIONS (last_message_id FK added after messages table) ====================
CREATE TABLE conversations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  last_message_id INT UNSIGNED DEFAULT NULL,
  last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status ENUM('pending','accepted') DEFAULT 'accepted',
  requested_by_id INT UNSIGNED DEFAULT NULL,
  accepted_at DATETIME DEFAULT NULL,
  is_group TINYINT(1) DEFAULT 0,
  group_name VARCHAR(255) DEFAULT NULL,
  group_photo TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_last_message_at (last_message_at),
  KEY idx_status (status),
  KEY idx_requested_by (requested_by_id),
  KEY idx_last_message_id (last_message_id),
  CONSTRAINT fk_conv_requested_by FOREIGN KEY (requested_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== CONVERSATION PARTICIPANTS ====================
CREATE TABLE conversation_participants (
  conversation_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (conversation_id, user_id),
  KEY idx_user (user_id),
  CONSTRAINT fk_cp_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== CONVERSATION BLOCKED BY ====================
CREATE TABLE conversation_blocked_by (
  conversation_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT fk_cbb_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cbb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== CONVERSATION DELETED BY ====================
CREATE TABLE conversation_deleted_by (
  conversation_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT fk_cdb_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cdb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== CONVERSATION MUTED BY ====================
CREATE TABLE conversation_muted_by (
  conversation_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT fk_cmb_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cmb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== GROUP INVITES ====================
CREATE TABLE group_invites (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id INT UNSIGNED NOT NULL,
  invited_user_id INT UNSIGNED NOT NULL,
  invited_by_id INT UNSIGNED NOT NULL,
  status ENUM('pending','accepted','rejected') DEFAULT 'pending',
  responded_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_group_invites_group (group_id),
  KEY idx_group_invites_invited_user (invited_user_id),
  KEY idx_group_invites_invited_by (invited_by_id),
  KEY idx_group_invites_status (status),
  CONSTRAINT fk_group_invites_group FOREIGN KEY (group_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_group_invites_invited_user FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_group_invites_invited_by FOREIGN KEY (invited_by_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== MESSAGES ====================
CREATE TABLE messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT UNSIGNED NOT NULL,
  sender_id INT UNSIGNED NOT NULL,
  content TEXT,
  media_type ENUM('image','video') DEFAULT NULL,
  media_url TEXT DEFAULT NULL,
  link_url VARCHAR(2048) DEFAULT NULL,
  link_title VARCHAR(500) DEFAULT NULL,
  link_description TEXT DEFAULT NULL,
  link_thumbnail VARCHAR(2048) DEFAULT NULL,
  delivery_status ENUM('sent','delivered','read') DEFAULT 'sent',
  is_starred TINYINT(1) DEFAULT 0,
  is_deleted TINYINT(1) DEFAULT 0,
  encrypted TINYINT(1) DEFAULT 0,
  encryption_key VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_conversation_created (conversation_id, created_at),
  KEY idx_sender (sender_id),
  KEY idx_content (content(100)),
  CONSTRAINT fk_msg_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add FK for last_message_id (after messages table exists)
ALTER TABLE conversations
  ADD CONSTRAINT fk_conv_last_message FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- ==================== MESSAGE READ BY ====================
CREATE TABLE message_read_by (
  message_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id),
  CONSTRAINT fk_mrb_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_mrb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== MESSAGE REACTIONS ====================
CREATE TABLE message_reactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  emoji VARCHAR(20) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_message_user_emoji (message_id, user_id, emoji),
  KEY idx_user (user_id),
  CONSTRAINT fk_mr_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_mr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== MESSAGE STARRED BY ====================
CREATE TABLE message_starred_by (
  message_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (message_id, user_id),
  CONSTRAINT fk_msb_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_msb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== MESSAGE DELETED BY ====================
CREATE TABLE message_deleted_by (
  message_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (message_id, user_id),
  CONSTRAINT fk_mdb_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_mdb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== MESSAGE REPORTS (junction) ====================
CREATE TABLE message_reports (
  message_id INT UNSIGNED NOT NULL,
  report_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (message_id, report_id),
  CONSTRAINT fk_mrep_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_mrep_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
