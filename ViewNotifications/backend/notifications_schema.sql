-- SQL schema additions for the View Notifications feature
-- Run these statements against the `zeowaste_db` database.

CREATE TABLE IF NOT EXISTS `notifications` (
  `notification_id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT(20) UNSIGNED NOT NULL,
  `food_id` BIGINT(20) UNSIGNED DEFAULT NULL,
  `type` ENUM('expired','expiring-soon','donation','new-food','meal-plans') NOT NULL,
  `status` ENUM('unread','read','archived','trashed','deleted') NOT NULL DEFAULT 'unread',
  `title` VARCHAR(160) NOT NULL,
  `subtitle` VARCHAR(255) DEFAULT NULL,
  `message` TEXT DEFAULT NULL,
  `payload` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `trashed_at` DATETIME DEFAULT NULL,
  `delete_after` DATETIME DEFAULT NULL,
  PRIMARY KEY (`notification_id`),
  KEY `idx_notifications_user_status` (`user_id`, `status`),
  KEY `idx_notifications_user_type` (`user_id`, `type`),
  KEY `idx_notifications_food_type` (`food_id`, `type`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notifications_food` FOREIGN KEY (`food_id`) REFERENCES `fooditems` (`food_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_trash_log` (
  `log_id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `notification_id` BIGINT(20) UNSIGNED NOT NULL,
  `trashed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `delete_after` DATETIME NOT NULL,
  PRIMARY KEY (`log_id`),
  KEY `idx_trash_notification` (`notification_id`),
  CONSTRAINT `fk_trash_notification` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`notification_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
