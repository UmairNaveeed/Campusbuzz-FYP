-- Notifications table: one row per notification for a user
CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL COMMENT 'recipient of the notification',
  actor_id INT UNSIGNED NOT NULL COMMENT 'user who triggered the action',
  type VARCHAR(50) NOT NULL COMMENT 'like, comment, reply, follow, mention, share',
  read_at DATETIME DEFAULT NULL,
  post_id INT UNSIGNED DEFAULT NULL,
  comment_id INT UNSIGNED DEFAULT NULL,
  extra VARCHAR(500) DEFAULT NULL COMMENT 'optional JSON or text (e.g. mention text)',
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
