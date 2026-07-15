-- Add missing columns to reviews table
ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS pros VARCHAR(1000) DEFAULT NULL AFTER body,
    ADD COLUMN IF NOT EXISTS cons VARCHAR(1000) DEFAULT NULL AFTER pros,
    ADD COLUMN IF NOT EXISTS vendor_reply TEXT DEFAULT NULL AFTER cons,
    ADD COLUMN IF NOT EXISTS verified TINYINT(1) NOT NULL DEFAULT 0 AFTER is_approved;

-- Create product_questions table
CREATE TABLE IF NOT EXISTS `product_questions` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` INT UNSIGNED NOT NULL,
  `user_id`    INT UNSIGNED NOT NULL,
  `question`   TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pq_product` (`product_id`),
  INDEX `idx_pq_user` (`user_id`),
  CONSTRAINT `fk_pq_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pq_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create question_answers table
CREATE TABLE IF NOT EXISTS `question_answers` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `question_id` INT UNSIGNED NOT NULL,
  `user_id`     INT UNSIGNED DEFAULT NULL,
  `vendor_id`   INT UNSIGNED DEFAULT NULL,
  `answer`      TEXT NOT NULL,
  `is_vendor`   TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_qa_question` (`question_id`),
  CONSTRAINT `fk_qa_question` FOREIGN KEY (`question_id`) REFERENCES `product_questions`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_qa_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_qa_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
