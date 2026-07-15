-- ============================================================
--  MODAICA — Tam Veritabanı Şeması
--  Versiyon   : 2.0
--  Oluşturma  : 2026-04-25
--
--  KURULUM:
--  1. phpMyAdmin → "Yeni" → modaica_db adında veritabanı oluştur
--  2. modaica_db seç → SQL sekmesi → bu dosyayı yapıştır → Git
--  VEYA:
--  mysql -u root -p modaica_db < modaica_schema.sql
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+03:00";
SET NAMES utf8mb4;

-- Veritabanı oluştur (yoksa)
CREATE DATABASE IF NOT EXISTS `modaica_db`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `modaica_db`;

-- Mevcut tabloları temizle (sırayla)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS vendor_notifications;
DROP TABLE IF EXISTS vendor_payouts;
DROP TABLE IF EXISTS admin_notifications;
DROP TABLE IF EXISTS admin_activity_log;
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS search_history;
DROP TABLE IF EXISTS search_popular;
DROP TABLE IF EXISTS coupon_usages;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS review_votes;
DROP TABLE IF EXISTS stock_alarms;
DROP TABLE IF EXISTS price_alarms;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS points_log;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS addresses;
DROP TABLE IF EXISTS security_settings;
DROP TABLE IF EXISTS notification_prefs;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS product_variants;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS vendors;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admins;
SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
--  1. KULLANICILAR (users)
-- ============================================================
CREATE TABLE `users` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `member_no`     VARCHAR(30)     NOT NULL UNIQUE COMMENT 'MDC-YYYYMMDD-XXXXX',
  `name`          VARCHAR(120)    NOT NULL,
  `first_name`    VARCHAR(60)              DEFAULT NULL,
  `last_name`     VARCHAR(60)              DEFAULT NULL,
  `email`         VARCHAR(180)    NOT NULL UNIQUE,
  `password_hash` VARCHAR(255)    NOT NULL,
  `phone`         VARCHAR(20)              DEFAULT NULL,
  `birthdate`     DATE                     DEFAULT NULL,
  `gender`        ENUM('erkek','kadin','belirtmek_istemiyorum') DEFAULT 'belirtmek_istemiyorum',
  `avatar`        VARCHAR(500)             DEFAULT NULL,

  -- Loyalty
  `tier`          ENUM('Bronze','Silver','Gold','Platinum') NOT NULL DEFAULT 'Bronze',
  `points`        INT UNSIGNED    NOT NULL DEFAULT 0,

  -- Durum
  `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
  `email_verified` TINYINT(1)     NOT NULL DEFAULT 0,
  `email_verify_token` VARCHAR(100)         DEFAULT NULL,
  `password_reset_token` VARCHAR(100)       DEFAULT NULL,
  `password_reset_expires` DATETIME         DEFAULT NULL,

  -- Zaman
  `last_login_at` DATETIME                 DEFAULT NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME                 ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_email`       (`email`),
  INDEX `idx_member_no`   (`member_no`),
  INDEX `idx_tier`        (`tier`),
  INDEX `idx_is_active`   (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Müşteri hesapları';


-- ============================================================
--  2. KULLANICI BİLDİRİM TERCİHLERİ (notification_prefs)
-- ============================================================
CREATE TABLE `notification_prefs` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`           INT UNSIGNED NOT NULL UNIQUE,
  `order_updates`     TINYINT(1)   NOT NULL DEFAULT 1,
  `price_drops`       TINYINT(1)   NOT NULL DEFAULT 1,
  `new_products`      TINYINT(1)   NOT NULL DEFAULT 0,
  `campaigns`         TINYINT(1)   NOT NULL DEFAULT 1,
  `email_enabled`     TINYINT(1)   NOT NULL DEFAULT 1,
  `sms_enabled`       TINYINT(1)   NOT NULL DEFAULT 0,
  `push_enabled`      TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_np_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  3. GÜVENLİK AYARLARI (security_settings)
-- ============================================================
CREATE TABLE `security_settings` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`         INT UNSIGNED NOT NULL UNIQUE,
  `two_fa_enabled`  TINYINT(1)   NOT NULL DEFAULT 0,
  `two_fa_secret`   VARCHAR(100)          DEFAULT NULL,
  `login_notify`    TINYINT(1)   NOT NULL DEFAULT 1,
  `trusted_devices` JSON                  DEFAULT NULL,
  `updated_at`      DATETIME              ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ss_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  4. ADRESLER (addresses)
-- ============================================================
CREATE TABLE `addresses` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`      INT UNSIGNED NOT NULL,
  `title`        VARCHAR(80)  NOT NULL COMMENT 'Ev, İş, vb.',
  `full_name`    VARCHAR(120) NOT NULL,
  `phone`        VARCHAR(20)           DEFAULT NULL,
  `city`         VARCHAR(80)  NOT NULL,
  `district`     VARCHAR(80)           DEFAULT NULL,
  `neighborhood` VARCHAR(120)          DEFAULT NULL,
  `address_line` TEXT         NOT NULL,
  `postal_code`  VARCHAR(10)           DEFAULT NULL,
  `is_default`   TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME              ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_addr_user` (`user_id`),
  CONSTRAINT `fk_addr_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  5. PUAN LOG (points_log)
-- ============================================================
CREATE TABLE `points_log` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED NOT NULL,
  `amount`      INT          NOT NULL COMMENT 'Pozitif=kazanılan, Negatif=harcanan',
  `description` VARCHAR(255)          DEFAULT NULL,
  `ref_type`    ENUM('order','cancel','promo','admin','refund') NOT NULL DEFAULT 'order',
  `ref_id`      INT UNSIGNED          DEFAULT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pl_user` (`user_id`),
  CONSTRAINT `fk_pl_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  6. SATICILAR (vendors)
-- ============================================================
CREATE TABLE `vendors` (
  `id`               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `name`             VARCHAR(120)  NOT NULL COMMENT 'Yetkili adı',
  `shop_name`        VARCHAR(150)  NOT NULL COMMENT 'Mağaza adı',
  `email`            VARCHAR(180)  NOT NULL UNIQUE,
  `password_hash`    VARCHAR(255)  NOT NULL,
  `phone`            VARCHAR(20)            DEFAULT NULL,
  `tax_number`       VARCHAR(30)            DEFAULT NULL COMMENT 'Vergi numarası',
  `tax_office`       VARCHAR(100)           DEFAULT NULL,
  `company_name`     VARCHAR(200)           DEFAULT NULL,
  `logo_emoji`       VARCHAR(10)            DEFAULT '🏪',
  `description`      TEXT                   DEFAULT NULL,

  -- Finansal
  `commission_rate`  DECIMAL(5,2)  NOT NULL DEFAULT 10.00 COMMENT 'Yüzde komisyon',
  `balance`          DECIMAL(12,2) NOT NULL DEFAULT 0.00  COMMENT 'Çekilebilir bakiye',
  `total_earned`     DECIMAL(12,2) NOT NULL DEFAULT 0.00  COMMENT 'Toplam kazanç',

  -- Banka
  `bank_name`        VARCHAR(100)           DEFAULT NULL,
  `bank_iban`        VARCHAR(35)            DEFAULT NULL,

  -- Durum
  `status`           ENUM('pending','approved','suspended','rejected') NOT NULL DEFAULT 'pending',
  `suspended_reason` TEXT                   DEFAULT NULL,

  -- Admin notu
  `admin_note`       TEXT                   DEFAULT NULL,

  `last_login_at`    DATETIME               DEFAULT NULL,
  `created_at`       DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME               ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_vendor_email`  (`email`),
  INDEX `idx_vendor_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Satıcı hesapları';


-- ============================================================
--  7. SATICI BİLDİRİMLERİ (vendor_notifications)
-- ============================================================
CREATE TABLE `vendor_notifications` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `vendor_id`  INT UNSIGNED NOT NULL,
  `message`    TEXT         NOT NULL,
  `type`       VARCHAR(50)           DEFAULT 'info',
  `ref_url`    VARCHAR(300)          DEFAULT NULL,
  `is_read`    TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_vn_vendor` (`vendor_id`),
  INDEX `idx_vn_read`   (`is_read`),
  CONSTRAINT `fk_vn_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  8. SATICI ÖDEME TALEPLERİ (vendor_payouts)
-- ============================================================
CREATE TABLE `vendor_payouts` (
  `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `vendor_id`    INT UNSIGNED  NOT NULL,
  `amount`       DECIMAL(12,2) NOT NULL,
  `method`       ENUM('banka_transferi','papara','havale') NOT NULL DEFAULT 'banka_transferi',
  `status`       ENUM('pending','processing','paid','rejected') NOT NULL DEFAULT 'pending',
  `admin_note`   TEXT                   DEFAULT NULL,
  `requested_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` DATETIME               DEFAULT NULL,
  `paid_at`      DATETIME               DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_vp_vendor` (`vendor_id`),
  INDEX `idx_vp_status` (`status`),
  CONSTRAINT `fk_vp_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  9. ADMİNLER (admins)
-- ============================================================
CREATE TABLE `admins` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(100) NOT NULL,
  `email`        VARCHAR(180) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role`         ENUM('super_admin','admin','moderator') NOT NULL DEFAULT 'admin',
  `avatar`       VARCHAR(500)          DEFAULT NULL,
  `is_active`    TINYINT(1)   NOT NULL DEFAULT 1,
  `last_login_at` DATETIME             DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  10. ADMİN AKTİVİTE LOG (admin_activity_log)
-- ============================================================
CREATE TABLE `admin_activity_log` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_id`   INT UNSIGNED          DEFAULT NULL,
  `action`     VARCHAR(100) NOT NULL,
  `target_type` VARCHAR(50)          DEFAULT NULL COMMENT 'vendor, user, product, order...',
  `target_id`  INT UNSIGNED          DEFAULT NULL,
  `detail`     TEXT                  DEFAULT NULL,
  `ip`         VARCHAR(45)           DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_aal_admin`  (`admin_id`),
  INDEX `idx_aal_target` (`target_type`, `target_id`),
  CONSTRAINT `fk_aal_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  11. ADMİN BİLDİRİMLERİ (admin_notifications)
-- ============================================================
CREATE TABLE `admin_notifications` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`      VARCHAR(200) NOT NULL,
  `message`    TEXT         NOT NULL,
  `type`       ENUM('info','warning','error','success') NOT NULL DEFAULT 'info',
  `is_read`    TINYINT(1)   NOT NULL DEFAULT 0,
  `ref_url`    VARCHAR(300)          DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  12. KATEGORİLER (categories)
-- ============================================================
CREATE TABLE `categories` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `parent_id`   INT UNSIGNED          DEFAULT NULL COMMENT 'Ana kategori ID',
  `department`  VARCHAR(50)  NOT NULL COMMENT 'erkek,kadin,elektronik,ev,spor,kozmetik',
  `name`        VARCHAR(100) NOT NULL,
  `slug`        VARCHAR(120) NOT NULL UNIQUE,
  `emoji`       VARCHAR(10)           DEFAULT NULL,
  `description` TEXT                  DEFAULT NULL,
  `image_url`   VARCHAR(500)          DEFAULT NULL,
  `sort_order`  SMALLINT     NOT NULL DEFAULT 0,
  `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_cat_dept`   (`department`),
  INDEX `idx_cat_parent` (`parent_id`),
  INDEX `idx_cat_slug`   (`slug`),
  CONSTRAINT `fk_cat_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  13. ÜRÜNLER (products)
-- ============================================================
CREATE TABLE `products` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `vendor_id`     INT UNSIGNED    NOT NULL,
  `category_id`   INT UNSIGNED             DEFAULT NULL,

  -- Kimlik
  `sku`           VARCHAR(60)     NOT NULL UNIQUE COMMENT 'Stok kodu',
  `name`          VARCHAR(250)    NOT NULL,
  `brand`         VARCHAR(100)             DEFAULT NULL,
  `emoji`         VARCHAR(10)              DEFAULT '📦',
  `department`    VARCHAR(50)              DEFAULT NULL,
  `category_slug` VARCHAR(120)             DEFAULT NULL,

  -- Fiyat
  `price`         DECIMAL(10,2)   NOT NULL,
  `old_price`     DECIMAL(10,2)            DEFAULT NULL,
  `cost_price`    DECIMAL(10,2)            DEFAULT NULL COMMENT 'Maliyet (iç kullanım)',

  -- Stok
  `stock`         INT             NOT NULL DEFAULT 0,
  `min_stock`     INT             NOT NULL DEFAULT 5 COMMENT 'Düşük stok uyarı eşiği',

  -- İçerik
  `description`   TEXT                     DEFAULT NULL,
  `badge`         ENUM('new','sale','hot','best') DEFAULT NULL,
  `tags`          VARCHAR(500)             DEFAULT NULL COMMENT 'Virgülle ayrılmış etiketler',

  -- Ölçümler (kargo için)
  `weight_g`      INT                      DEFAULT NULL COMMENT 'Gram cinsinden',

  -- Durum
  `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
  `is_featured`   TINYINT(1)      NOT NULL DEFAULT 0,

  -- İstatistik
  `view_count`    INT UNSIGNED    NOT NULL DEFAULT 0,
  `sale_count`    INT UNSIGNED    NOT NULL DEFAULT 0,
  `avg_rating`    DECIMAL(3,2)             DEFAULT NULL,
  `review_count`  INT UNSIGNED    NOT NULL DEFAULT 0,

  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME                 ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_prod_vendor`   (`vendor_id`),
  INDEX `idx_prod_cat`      (`category_id`),
  INDEX `idx_prod_dept`     (`department`),
  INDEX `idx_prod_active`   (`is_active`),
  INDEX `idx_prod_featured` (`is_featured`),
  INDEX `idx_prod_sku`      (`sku`),
  FULLTEXT INDEX `ft_prod_search` (`name`, `brand`, `description`),
  CONSTRAINT `fk_prod_vendor` FOREIGN KEY (`vendor_id`)   REFERENCES `vendors`(`id`)    ON DELETE CASCADE,
  CONSTRAINT `fk_prod_cat`    FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ürün kataloğu';


-- ============================================================
--  14. ÜRÜN GÖRSELLERİ (product_images)
-- ============================================================
CREATE TABLE `product_images` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` INT UNSIGNED NOT NULL,
  `url`        VARCHAR(500) NOT NULL,
  `alt`        VARCHAR(200)          DEFAULT NULL,
  `sort_order` SMALLINT     NOT NULL DEFAULT 0,
  `is_primary` TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pi_prod` (`product_id`),
  CONSTRAINT `fk_pi_prod` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  15. ÜRÜN VARYANTLARİ (product_variants)
--  Beden, renk, malzeme gibi seçenekler
-- ============================================================
CREATE TABLE `product_variants` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` INT UNSIGNED NOT NULL,
  `type`       ENUM('size','color','material','other') NOT NULL DEFAULT 'size',
  `value`      VARCHAR(80)  NOT NULL COMMENT 'S, M, L / Kırmızı / Keten...',
  `stock`      INT          NOT NULL DEFAULT 0,
  `extra_price` DECIMAL(8,2) NOT NULL DEFAULT 0.00 COMMENT 'Baz fiyata ek',
  `sku_suffix` VARCHAR(20)           DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_pv_prod` (`product_id`),
  CONSTRAINT `fk_pv_prod` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  16. FAVORİLER (favorites)
-- ============================================================
CREATE TABLE `favorites` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED NOT NULL,
  `product_id`    INT UNSIGNED NOT NULL,
  `product_name`  VARCHAR(250)          DEFAULT NULL,
  `product_price` DECIMAL(10,2)         DEFAULT NULL,
  `product_emoji` VARCHAR(10)           DEFAULT '📦',
  `product_cat`   VARCHAR(100)          DEFAULT NULL,
  `product_brand` VARCHAR(100)          DEFAULT NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fav` (`user_id`, `product_id`),
  INDEX `idx_fav_user`    (`user_id`),
  INDEX `idx_fav_product` (`product_id`),
  CONSTRAINT `fk_fav_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)    ON DELETE CASCADE,
  CONSTRAINT `fk_fav_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  17. SEPET (cart_items)
-- ============================================================
CREATE TABLE `cart_items` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED  NOT NULL,
  `product_id`    INT UNSIGNED  NOT NULL,
  `product_name`  VARCHAR(250)           DEFAULT NULL,
  `product_price` DECIMAL(10,2)          DEFAULT NULL,
  `product_emoji` VARCHAR(10)            DEFAULT '📦',
  `product_cat`   VARCHAR(100)           DEFAULT NULL,
  `product_brand` VARCHAR(100)           DEFAULT NULL,
  `quantity`      SMALLINT      NOT NULL DEFAULT 1,
  `size`          VARCHAR(30)            DEFAULT NULL,
  `color`         VARCHAR(50)            DEFAULT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME               ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cart` (`user_id`, `product_id`, `size`, `color`),
  INDEX `idx_cart_user`    (`user_id`),
  INDEX `idx_cart_product` (`product_id`),
  CONSTRAINT `fk_cart_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)    ON DELETE CASCADE,
  CONSTRAINT `fk_cart_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  18. SİPARİŞLER (orders)
-- ============================================================
CREATE TABLE `orders` (
  `id`               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`          INT UNSIGNED    NOT NULL,
  `order_code`       VARCHAR(30)     NOT NULL UNIQUE COMMENT 'MDC-YYYYMMDD-XXXXXX',
  `address_id`       INT UNSIGNED             DEFAULT NULL,

  -- Tutarlar
  `subtotal`         DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  `discount_amount`  DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  `cargo_fee`        DECIMAL(8,2)    NOT NULL DEFAULT 0.00,
  `total_amount`     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,

  -- Ödeme
  `payment_method`   ENUM('credit_card','bank_transfer','cash_on_delivery','wallet') DEFAULT 'credit_card',
  `payment_status`   ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  `payment_ref`      VARCHAR(100)             DEFAULT NULL,

  -- Kargo
  `cargo_type`       ENUM('standard','express','same_day') NOT NULL DEFAULT 'standard',
  `cargo_company`    VARCHAR(80)              DEFAULT NULL,
  `cargo_tracking`   VARCHAR(100)             DEFAULT NULL,

  -- Kupon
  `coupon_code`      VARCHAR(50)              DEFAULT NULL,

  -- Puan
  `points_earned`    INT UNSIGNED    NOT NULL DEFAULT 0,
  `points_used`      INT UNSIGNED    NOT NULL DEFAULT 0,

  -- Durum
  `status`           ENUM('pending','confirmed','preparing','shipping','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
  `note`             TEXT                     DEFAULT NULL,
  `cancel_reason`    TEXT                     DEFAULT NULL,

  -- Adres snapshot (teslimat adresi değişse de korunur)
  `delivery_address` JSON                     DEFAULT NULL,

  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME                 ON UPDATE CURRENT_TIMESTAMP,
  `delivered_at`     DATETIME                 DEFAULT NULL,

  PRIMARY KEY (`id`),
  INDEX `idx_ord_user`   (`user_id`),
  INDEX `idx_ord_code`   (`order_code`),
  INDEX `idx_ord_status` (`status`),
  INDEX `idx_ord_date`   (`created_at`),
  CONSTRAINT `fk_ord_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)    ON DELETE RESTRICT,
  CONSTRAINT `fk_ord_address` FOREIGN KEY (`address_id`) REFERENCES `addresses`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ana sipariş tablosu';


-- ============================================================
--  19. SİPARİŞ KALEMLERİ (order_items)
--  Her satır = bir ürün (vendor bazlı takip için vendor_id var)
-- ============================================================
CREATE TABLE `order_items` (
  `id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `order_id`       INT UNSIGNED    NOT NULL,
  `vendor_id`      INT UNSIGNED             DEFAULT NULL,
  `product_id`     INT UNSIGNED             DEFAULT NULL,
  `product_name`   VARCHAR(250)    NOT NULL,
  `product_brand`  VARCHAR(100)             DEFAULT NULL,
  `product_emoji`  VARCHAR(10)              DEFAULT '📦',

  `size`           VARCHAR(30)              DEFAULT NULL,
  `color`          VARCHAR(50)              DEFAULT NULL,
  `quantity`       SMALLINT        NOT NULL DEFAULT 1,

  -- Tutarlar
  `unit_price`     DECIMAL(10,2)   NOT NULL COMMENT 'Satış fiyatı (indirim sonrası)',
  `gross_amount`   DECIMAL(12,2)   NOT NULL COMMENT 'quantity × unit_price',
  `commission`     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  `net_amount`     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,

  -- Durum (satıcı bazlı)
  `status`         ENUM('pending','confirmed','preparing','shipping','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
  `cargo_tracking` VARCHAR(100)             DEFAULT NULL,

  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME                 ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_oi_order`   (`order_id`),
  INDEX `idx_oi_vendor`  (`vendor_id`),
  INDEX `idx_oi_product` (`product_id`),
  INDEX `idx_oi_status`  (`status`),
  CONSTRAINT `fk_oi_order`   FOREIGN KEY (`order_id`)  REFERENCES `orders`(`id`)   ON DELETE CASCADE,
  CONSTRAINT `fk_oi_vendor`  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`)  ON DELETE SET NULL,
  CONSTRAINT `fk_oi_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Sipariş kalemleri (vendor bazlı)';


-- ============================================================
--  20. KUPONLAR (coupons)
-- ============================================================
CREATE TABLE `coupons` (
  `id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `code`              VARCHAR(50)     NOT NULL UNIQUE,
  `type`              ENUM('percent','fixed','free_cargo') NOT NULL DEFAULT 'percent',
  `value`             DECIMAL(10,2)   NOT NULL DEFAULT 0.00 COMMENT 'İndirim değeri (% veya ₺)',
  `min_order_amount`  DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `max_discount`      DECIMAL(10,2)            DEFAULT NULL COMMENT 'Maksimum indirim tutarı',
  `max_uses`          INT UNSIGNED             DEFAULT NULL COMMENT 'NULL = sınırsız',
  `used_count`        INT UNSIGNED    NOT NULL DEFAULT 0,
  `max_uses_per_user` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `description`       VARCHAR(255)             DEFAULT NULL,
  `is_active`         TINYINT(1)      NOT NULL DEFAULT 1,
  `starts_at`         DATETIME                 DEFAULT NULL,
  `expires_at`        DATETIME                 DEFAULT NULL,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_coupon_code`   (`code`),
  INDEX `idx_coupon_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  21. KUPON KULLANIM LOG (coupon_usages)
-- ============================================================
CREATE TABLE `coupon_usages` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `coupon_id`  INT UNSIGNED NOT NULL,
  `user_id`    INT UNSIGNED NOT NULL,
  `order_id`   INT UNSIGNED          DEFAULT NULL,
  `used_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_cu_coupon` (`coupon_id`),
  INDEX `idx_cu_user`   (`user_id`),
  CONSTRAINT `fk_cu_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`)  ON DELETE CASCADE,
  CONSTRAINT `fk_cu_user`   FOREIGN KEY (`user_id`)   REFERENCES `users`(`id`)    ON DELETE CASCADE,
  CONSTRAINT `fk_cu_order`  FOREIGN KEY (`order_id`)  REFERENCES `orders`(`id`)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  22. ÜRÜN YORUMLARI (reviews)
-- ============================================================
CREATE TABLE `reviews` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id`  INT UNSIGNED NOT NULL,
  `user_id`     INT UNSIGNED NOT NULL,
  `order_id`    INT UNSIGNED          DEFAULT NULL COMMENT 'Satın alınan sipariş',
  `rating`        TINYINT      NOT NULL COMMENT '1-5 yıldız',
  `title`         VARCHAR(150)          DEFAULT NULL,
  `body`          TEXT                  DEFAULT NULL,
  `pros`          VARCHAR(1000)         DEFAULT NULL COMMENT 'Artılar',
  `cons`          VARCHAR(1000)         DEFAULT NULL COMMENT 'Eksiler',
  `vendor_reply`  TEXT                  DEFAULT NULL COMMENT 'Satıcı yanıtı',
  `is_approved`   TINYINT(1)   NOT NULL DEFAULT 1,
  `verified`      TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Satın alarak doğrulandı',
  `helpful`       INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Eski faydalı sayacı (review_votes ile hesaplanır)',
  `images`        JSON                  DEFAULT NULL COMMENT 'Yüklenen görsel URL\'leri',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME              ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_review` (`product_id`, `user_id`),
  INDEX `idx_rev_product` (`product_id`),
  INDEX `idx_rev_user`    (`user_id`),
  INDEX `idx_rev_rating`  (`rating`),
  CONSTRAINT `fk_rev_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rev_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)    ON DELETE CASCADE,
  CONSTRAINT `fk_rev_order`   FOREIGN KEY (`order_id`)  REFERENCES `orders`(`id`)   ON DELETE SET NULL,
  CONSTRAINT `chk_rating` CHECK (`rating` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  23. YORUM OYLAMALARI (review_votes)
-- ============================================================
CREATE TABLE `review_votes` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `review_id` INT UNSIGNED NOT NULL,
  `user_id`   INT UNSIGNED NOT NULL,
  `vote`      TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '1=faydalı, 0=faydasız',
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vote` (`review_id`, `user_id`),
  CONSTRAINT `fk_rv_review` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rv_user`   FOREIGN KEY (`user_id`)   REFERENCES `users`(`id`)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  24. ÜRÜN SORULARI (product_questions)
-- ============================================================
CREATE TABLE `product_questions` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` INT UNSIGNED NOT NULL,
  `user_id`    INT UNSIGNED NOT NULL,
  `question`   TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pq_product` (`product_id`),
  INDEX `idx_pq_user`    (`user_id`),
  CONSTRAINT `fk_pq_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pq_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  25. SORU CEVAPLARI (question_answers)
-- ============================================================
CREATE TABLE `question_answers` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `question_id` INT UNSIGNED NOT NULL,
  `user_id`     INT UNSIGNED          DEFAULT NULL,
  `vendor_id`   INT UNSIGNED          DEFAULT NULL,
  `answer`      TEXT         NOT NULL,
  `is_vendor`   TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_qa_question` (`question_id`),
  CONSTRAINT `fk_qa_question` FOREIGN KEY (`question_id`) REFERENCES `product_questions`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_qa_user`     FOREIGN KEY (`user_id`)     REFERENCES `users`(`id`)             ON DELETE SET NULL,
  CONSTRAINT `fk_qa_vendor`   FOREIGN KEY (`vendor_id`)   REFERENCES `vendors`(`id`)           ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  28. ARAMA GEÇMİŞİ (search_history)
-- ============================================================
CREATE TABLE `search_history` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED          DEFAULT NULL,
  `query`      VARCHAR(250) NOT NULL,
  `result_count` INT UNSIGNED        DEFAULT NULL,
  `ip`         VARCHAR(45)           DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_sh_user`    (`user_id`),
  INDEX `idx_sh_created` (`created_at`),
  CONSTRAINT `fk_sh_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  29. POPÜLER ARAMALAR (search_popular)
-- ============================================================
CREATE TABLE `search_popular` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `query`      VARCHAR(250) NOT NULL UNIQUE,
  `count`      INT UNSIGNED NOT NULL DEFAULT 1,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_sp_count` (`count` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  30. AI SOHBET OTURUMLARI (chat_sessions)
-- ============================================================
CREATE TABLE `chat_sessions` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED          DEFAULT NULL,
  `session_id` VARCHAR(80)  NOT NULL COMMENT 'Browser session ID',
  `messages`   LONGTEXT              DEFAULT NULL COMMENT 'JSON mesaj dizisi',
  `token_used` INT UNSIGNED NOT NULL DEFAULT 0,
  `ip`         VARCHAR(45)           DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME              ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_cs_user`    (`user_id`),
  INDEX `idx_cs_session` (`session_id`),
  CONSTRAINT `fk_cs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  31. KULLANICI OTURUMLARI (user_sessions)
--  Refresh token yönetimi ve çoklu cihaz desteği
-- ============================================================
CREATE TABLE `user_sessions` (
  `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`      INT UNSIGNED  NOT NULL,
  `token_hash`   VARCHAR(255)  NOT NULL UNIQUE COMMENT 'SHA256(refresh_token)',
  `device_info`  VARCHAR(500)           DEFAULT NULL COMMENT 'User-Agent',
  `ip`           VARCHAR(45)            DEFAULT NULL,
  `expires_at`   DATETIME      NOT NULL,
  `is_revoked`   TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` DATETIME               DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_us_user`    (`user_id`),
  INDEX `idx_us_token`   (`token_hash`),
  INDEX `idx_us_expires` (`expires_at`),
  CONSTRAINT `fk_us_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Kullanıcı oturum & refresh token yönetimi';


CREATE TABLE `stock_alarms` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `product_id` INT UNSIGNED NOT NULL,
  `notified`   TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stock_alarm` (`user_id`, `product_id`),
  CONSTRAINT `fk_sa_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)    ON DELETE CASCADE,
  CONSTRAINT `fk_sa_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Stok alarmları';

CREATE TABLE `price_alarms` (
  `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`      INT UNSIGNED    NOT NULL,
  `product_id`   INT UNSIGNED    NOT NULL,
  `target_price` DECIMAL(12,2)   NOT NULL,
  `notified`     TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_price_alarm` (`user_id`, `product_id`),
  CONSTRAINT `fk_pa_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)    ON DELETE CASCADE,
  CONSTRAINT `fk_pa_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Fiyat alarmları';


-- ============================================================
--  DEMO VERİLER
-- ============================================================

-- Admin hesabı (şifre: admin123!)
INSERT INTO `admins` (`name`, `email`, `password_hash`, `role`) VALUES
('Super Admin', 'admin@modaica.com', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'super_admin');
-- NOT: Yukarıdaki hash 'admin123!' için değil, örnek hash'tir. Gerçek hash oluşturmak için:
-- php -r "echo password_hash('admin123!', PASSWORD_BCRYPT, ['cost'=>12]);"

-- Satıcılar (vendor_id: 1=Nike, 2=Apple, 3=GlowLab)
INSERT INTO `vendors` (`name`, `shop_name`, `email`, `password_hash`, `phone`, `tax_number`, `logo_emoji`, `description`, `commission_rate`, `balance`, `total_earned`, `status`) VALUES
('Nike Türkiye',     'Nike Official', 'nike@modaica.com',   '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+90 212 000 0001', '9876543210', '👟', 'Nike resmi satıcısı.', 8.00,  25000.00, 350000.00, 'approved'),
('Apple Premium',    'Apple Store',   'apple@modaica.com',  '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+90 212 000 0002', '1122334455', '🍎', 'Apple Premium Reseller.', 6.00, 80000.00, 1200000.00,'approved'),
('GlowLab Kozmetik', 'GlowLab',       'glow@modaica.com',   '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+90 533 000 0003', '5566778899', '💄', 'Premium kozmetik markası.', 12.00, 5000.00, 45000.00,'approved');

-- Demo kullanıcı (şifre: user1234)
INSERT INTO `users` (`member_no`, `name`, `first_name`, `last_name`, `email`, `password_hash`, `phone`, `tier`, `points`, `is_active`, `email_verified`) VALUES
('MCA-00000001', 'Ali Yılmaz',    'Ali',   'Yılmaz',  'ali@example.com',    '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+90 555 111 2233', 'Gold',   2150, 1, 1),
('MCA-00000002', 'Ayşe Kaya',     'Ayşe',  'Kaya',    'ayse@example.com',   '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+90 555 444 5566', 'Bronze', 80,   1, 1),
('MCA-00000003', 'Mehmet Demir',  'Mehmet','Demir',   'mehmet@example.com', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+90 533 777 8899', 'Silver', 650,  1, 1);

-- Bildirim tercihleri (demo kullanıcılar)
INSERT INTO `notification_prefs` (`user_id`) VALUES (1), (2), (3);
INSERT INTO `security_settings`  (`user_id`) VALUES (1), (2), (3);

-- Demo adres
INSERT INTO `addresses` (`user_id`, `title`, `full_name`, `phone`, `city`, `district`, `address_line`, `postal_code`, `is_default`) VALUES
(1, 'Ev',  'Ali Yılmaz',   '+90 555 111 2233', 'İstanbul', 'Beşiktaş', 'Barbaros Bulvarı No:42 Daire:5', '34353', 1),
(1, 'İş',  'Ali Yılmaz',   '+90 212 000 0000', 'İstanbul', 'Levent',   'Büyükdere Caddesi No:100 Kat:8', '34394', 0),
(2, 'Ev',  'Ayşe Kaya',    '+90 555 444 5566', 'Ankara',   'Çankaya',  'Atatürk Bulvarı No:17',          '06680', 1);

-- Kategoriler
INSERT INTO `categories` (`department`, `name`, `slug`, `emoji`, `sort_order`) VALUES
-- Erkek
('erkek',   'Gömlek',       'erkek-gomlek',       '👔', 1),
('erkek',   'Pantolon',     'erkek-pantolon',     '👖', 2),
('erkek',   'T-Shirt',      'erkek-tshirt',       '👕', 3),
('erkek',   'Sweatshirt',   'erkek-sweatshirt',   '🧥', 4),
('erkek',   'Kazak',        'erkek-kazak',        '🧣', 5),
('erkek',   'Dış Giyim',    'erkek-dis-giyim',    '🧥', 6),
('erkek',   'Şort',         'erkek-sort',         '🩳', 7),
('erkek',   'İç Giyim',     'erkek-ic-giyim',     '🩲', 8),
('erkek',   'Ayakkabı',     'erkek-ayakkabi',     '👟', 9),
('erkek',   'Aksesuar',     'erkek-aksesuar',     '⌚', 10),
('erkek',   'Takım',        'erkek-takim',        '🤵', 11),
-- Kadın
('kadin',   'Elbise',       'kadin-elbise',       '👗', 1),
('kadin',   'Bluz',         'kadin-bluz',         '👚', 2),
('kadin',   'Pantolon',     'kadin-pantolon',     '👖', 3),
('kadin',   'Etek',         'kadin-etek',         '🩱', 4),
('kadin',   'Dış Giyim',    'kadin-dis-giyim',    '🧥', 5),
('kadin',   'Çanta',        'kadin-canta',        '👜', 6),
('kadin',   'Ayakkabı',     'kadin-ayakkabi',     '👠', 7),
('kadin',   'Aksesuar',     'kadin-aksesuar',     '💍', 8),
('kadin',   'İç Giyim',     'kadin-ic-giyim',     '🩱', 9),
-- Elektronik
('elektronik','Telefon',    'telefon',            '📱', 1),
('elektronik','Bilgisayar', 'bilgisayar',         '💻', 2),
('elektronik','Tablet',     'tablet',             '📲', 3),
('elektronik','Giyilebilir','giyilebilir',        '⌚', 4),
('elektronik','Kulaklık',   'kulaklik',           '🎧', 5),
('elektronik','TV & Ses',   'tv-ses',             '📺', 6),
('elektronik','Oyun',       'oyun',               '🎮', 7),
-- Ev & Yaşam
('ev',      'Mobilya',      'mobilya',            '🛋️', 1),
('ev',      'Mutfak',       'mutfak',             '🍽️', 2),
('ev',      'Banyo',        'banyo',              '🚿', 3),
('ev',      'Dekorasyon',   'dekorasyon',         '🕯️', 4),
('ev',      'Yatak Odası',  'yatak-odasi',        '🛏️', 5),
-- Spor
('spor',    'Ayakkabı',     'spor-ayakkabi',      '👟', 1),
('spor',    'Giyim',        'spor-giyim',         '🩳', 2),
('spor',    'Ekipman',      'spor-ekipman',       '⚽', 3),
('spor',    'Outdoor',      'outdoor',            '🏕️', 4),
-- Kozmetik
('kozmetik','Yüz Bakım',    'yuz-bakim',          '✨', 1),
('kozmetik','Saç Bakım',    'sac-bakim',          '💇', 2),
('kozmetik','Parfüm',       'parfum',             '🌹', 3),
('kozmetik','Makyaj',       'makyaj',             '💄', 4),
('kozmetik','Vücut Bakım',  'vucut-bakim',        '🧴', 5);

-- Demo ürünler (vendor_id: 1=Nike, 2=Apple, 3=GlowLab)
INSERT INTO `products` (`vendor_id`, `sku`, `name`, `brand`, `emoji`, `department`, `category_slug`, `price`, `old_price`, `stock`, `badge`, `is_active`, `is_featured`, `avg_rating`, `review_count`, `sale_count`) VALUES
(1, 'NK-UBP-001', 'Nike Ultra Boost Pro',      'Nike',      '👟', 'spor',      'spor-ayakkabi', 3499.00, 4499.00,  12, 'sale', 1, 1, 4.8, 267, 1243),
(1, 'NK-SFG-002', 'Slim Fit Keten Gömlek',     'Nike',      '👔', 'erkek',     'erkek-gomlek',   599.00,    NULL,  45, 'new',  1, 0, 4.6, 198,  512),
(1, 'NK-DOC-003', 'Deri Omuz Çantası',         'Nike',      '👜', 'kadin',     'kadin-canta',   1299.00, 1799.00,   8, 'sale', 1, 1, 4.7, 143,  220),
(3, 'GL-HAS-004', 'Hyalüronik Asit Serumu',    'GlowLab',   '💧', 'kozmetik',  'yuz-bakim',      549.00,  699.00,   2, 'hot',  1, 0, 4.5,  89,  340),
(2, 'AP-AW9-005', 'Apple Watch Series 9',      'Apple',     '⌚', 'elektronik','giyilebilir',  13999.00,15999.00,   6, 'best', 1, 1, 4.9,  312,  98),
(1, 'NK-SPT-006', 'Nike Spor Şort',            'Nike',      '🩳', 'spor',      'spor-giyim',     349.00,  499.00,  30, 'sale', 1, 0, 4.3, 210,  630),
(1, 'NK-KKZ-007', 'Kaşmir Kazak',              'Nike',      '🧥', 'erkek',     'erkek-kazak',   1299.00, 1799.00,  15, 'best', 1, 1, 4.9, 156,  187),
(3, 'GL-PPM-008', 'Premium Parfüm 100ml',      'GlowLab',   '🌹', 'kozmetik',  'parfum',         799.00,  NULL,    20, NULL,   1, 0, 4.6,  67,  145),
(1, 'NK-ELB-009', 'Yazlık Midi Elbise',        'Nike',      '👗', 'kadin',     'kadin-elbise',   699.00,  999.00,  18, 'sale', 1, 0, 4.4, 234,  389),
(2, 'AP-IPH-010', 'iPhone 15 Pro 256GB',       'Apple',     '📱', 'elektronik','telefon',       54999.00, NULL,     4, 'best', 1, 1, 4.9,  89,   52);

-- Demo kuponlar
INSERT INTO `coupons` (`code`, `type`, `value`, `min_order_amount`, `max_discount`, `max_uses`, `description`, `is_active`, `expires_at`) VALUES
('YENISEZON',   'percent', 15.00, 500.00,  NULL, 1000, '%15 indirim — 500₺ ve üzeri siparişlerde', 1, DATE_ADD(NOW(), INTERVAL 30 DAY)),
('MODAICA10',   'percent', 10.00,   0.00,  NULL, NULL, '%10 indirim — tüm siparişler',             1, DATE_ADD(NOW(), INTERVAL 60 DAY)),
('HOSGELDIN20', 'percent', 20.00,   0.00, 500.00,  500, '%20 indirim — ilk sipariş, max ₺500',     1, DATE_ADD(NOW(), INTERVAL 90 DAY)),
('KARGO0',      'free_cargo', 0.00, 200.00, NULL, 200, 'Ücretsiz kargo — 200₺ ve üzeri',           1, DATE_ADD(NOW(), INTERVAL 15 DAY));

-- Demo siparişler
INSERT INTO `orders` (`user_id`, `order_code`, `address_id`, `subtotal`, `discount_amount`, `cargo_fee`, `total_amount`, `payment_method`, `payment_status`, `cargo_type`, `cargo_company`, `cargo_tracking`, `coupon_code`, `points_earned`, `status`) VALUES
(1, 'MDC-20260420-A1B2C3', 1, 3499.00,  0.00,  0.00, 3499.00, 'credit_card', 'paid', 'standard', 'Yurtiçi Kargo', 'YK123456789TR', NULL,         34, 'delivered'),
(1, 'MDC-20260422-D4E5F6', 1, 1848.00, 184.80, 39.90,1703.10, 'credit_card', 'paid', 'express',  'MNG Kargo',     'MNG987654321', 'MODAICA10',  17, 'shipping'),
(2, 'MDC-20260423-G7H8I9', 1,  599.00,  0.00, 39.90,  638.90, 'bank_transfer','paid','standard', NULL,            NULL,           NULL,           6, 'pending');

-- Sipariş kalemleri (vendor_id: 1=Nike)
INSERT INTO `order_items` (`order_id`, `vendor_id`, `product_id`, `product_name`, `product_emoji`, `quantity`, `unit_price`, `gross_amount`, `commission`, `net_amount`, `status`, `cargo_tracking`) VALUES
(1, 1, 1, 'Nike Ultra Boost Pro',   '👟', 1, 3499.00, 3499.00, 279.92, 3219.08, 'delivered', 'YK123456789TR'),
(2, 1, 2, 'Slim Fit Keten Gömlek',  '👔', 2,  539.10, 1078.20, 107.82,  970.38, 'shipping',  'MNG987654321'),
(2, 1, 3, 'Deri Omuz Çantası',      '👜', 1,  624.90,  624.90,  62.49,  562.41, 'shipping',  'MNG987654321'),
(3, 1, 2, 'Slim Fit Keten Gömlek',  '👔', 1,  599.00,  599.00,  59.90,  539.10, 'pending',   NULL);

-- Demo yorumlar
INSERT INTO `reviews` (`product_id`, `user_id`, `order_id`, `rating`, `title`, `body`, `is_approved`) VALUES
(1, 1, 1, 5, 'Harika ürün!',       'Çok memnun kaldım, kalitesi gerçekten iyi. Kesinlikle tavsiye ederim.',  1),
(2, 2, 3, 4, 'Güzel gömlek',       'Kumaşı kaliteli, dikişleri temiz. Beden biraz büyük geldi, dikkat edin.',1),
(3, 1, 2, 5, 'Mükemmel çanta',     'Deri kalitesi beklediğimden çok daha iyi. Rengi de fotoğraftaki gibi.',  1);

-- Puan logları
INSERT INTO `points_log` (`user_id`, `amount`, `description`, `ref_type`, `ref_id`) VALUES
(1, 34, 'MDC-20260420-A1B2C3 siparişi', 'order', 1),
(1, 17, 'MDC-20260422-D4E5F6 siparişi', 'order', 2),
(2,  6, 'MDC-20260423-G7H8I9 siparişi', 'order', 3);

-- Satıcı ödeme talepleri
INSERT INTO `vendor_payouts` (`vendor_id`, `amount`, `method`, `status`, `requested_at`, `paid_at`) VALUES
(1, 5000.00,  'banka_transferi', 'paid',    DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 8 DAY)),
(1, 2500.00,  'banka_transferi', 'pending', DATE_SUB(NOW(), INTERVAL 2 DAY),  NULL),
(2, 15000.00, 'banka_transferi', 'paid',    DATE_SUB(NOW(), INTERVAL 5 DAY),  DATE_SUB(NOW(), INTERVAL 3 DAY));

-- Admin bildirimleri
INSERT INTO `admin_notifications` (`title`, `message`, `type`) VALUES
('Yeni Satıcı Başvurusu', 'Yeni bir satıcı başvurusu onay bekliyor.', 'info'),
('Düşük Stok Uyarısı',    '3 ürünün stoğu 5\'in altına düştü.',        'warning'),
('Yeni Sipariş',           'Son 1 saatte 12 yeni sipariş alındı.',       'success');

-- Satıcı bildirimleri
INSERT INTO `vendor_notifications` (`vendor_id`, `message`, `type`) VALUES
(1, 'Yeni bir siparişiniz var! #MDC-20260422-D4E5F6', 'order'),
(1, '"Nike Ultra Boost Pro" ürününüzün stoğu 10''un altına düştü.', 'warning'),
(2, 'Hesabınız onaylandı. Ürün eklemeye başlayabilirsiniz.', 'success');

-- Popüler aramalar
INSERT INTO `search_popular` (`query`, `count`) VALUES
('nike', 1523), ('elbise', 987), ('gömlek', 876), ('ayakkabı', 743),
('çanta', 621), ('parfüm', 534), ('kaban', 489), ('jean', 412),
('kazak', 376), ('saat', 298);


-- ============================================================
--  GÖRÜNÜMLER (Views) — Sık kullanılan sorgular
-- ============================================================

-- Aktif ürünler özeti
CREATE OR REPLACE VIEW `vw_active_products` AS
SELECT
  p.*,
  v.shop_name AS vendor_name,
  c.name      AS category_name
FROM products p
LEFT JOIN vendors    v ON v.id = p.vendor_id
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.is_active = 1 AND v.status = 'approved';

-- Sipariş özeti
CREATE OR REPLACE VIEW `vw_order_summary` AS
SELECT
  o.id, o.order_code, o.status, o.total_amount,
  o.payment_method, o.payment_status,
  o.created_at, o.delivered_at,
  u.name AS user_name, u.email AS user_email,
  COUNT(oi.id) AS item_count
FROM orders o
LEFT JOIN users       u  ON u.id = o.user_id
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id;

-- Satıcı performans özeti
CREATE OR REPLACE VIEW `vw_vendor_performance` AS
SELECT
  v.id, v.shop_name, v.status, v.commission_rate,
  v.balance, v.total_earned,
  COUNT(DISTINCT p.id)  AS product_count,
  COUNT(DISTINCT oi.id) AS total_orders,
  COALESCE(SUM(oi.gross_amount), 0) AS gross_revenue,
  COALESCE(AVG(r.rating), 0)        AS avg_rating
FROM vendors v
LEFT JOIN products    p  ON p.vendor_id  = v.id
LEFT JOIN order_items oi ON oi.vendor_id = v.id
LEFT JOIN reviews     r  ON r.product_id = p.id
GROUP BY v.id;

-- Ürün yorum ve rating özeti
CREATE OR REPLACE VIEW `vw_product_ratings` AS
SELECT
  product_id,
  COUNT(*)              AS review_count,
  AVG(rating)           AS avg_rating,
  SUM(rating = 5)       AS five_star,
  SUM(rating = 4)       AS four_star,
  SUM(rating = 3)       AS three_star,
  SUM(rating = 2)       AS two_star,
  SUM(rating = 1)       AS one_star
FROM reviews
WHERE is_approved = 1
GROUP BY product_id;


-- ============================================================
--  STORED PROCEDURES
-- ============================================================

DELIMITER //

-- Loyalty tier güncelleme
CREATE PROCEDURE `UpdateUserTier`(IN p_user_id INT)
BEGIN
  DECLARE v_points INT;
  DECLARE v_tier   VARCHAR(20);

  SELECT points INTO v_points FROM users WHERE id = p_user_id;

  -- Eşikler: Bronze=0, Silver=500, Gold=1000, Platinum=2500
  SET v_tier = CASE
    WHEN v_points >= 2500 THEN 'Platinum'
    WHEN v_points >= 1000 THEN 'Gold'
    WHEN v_points >= 500  THEN 'Silver'
    ELSE 'Bronze'
  END;

  UPDATE users SET tier = v_tier WHERE id = p_user_id;
END //

-- Sipariş sonrası ürün satış ve rating güncelleme
CREATE PROCEDURE `UpdateProductStats`(IN p_product_id INT)
BEGIN
  DECLARE v_avg   DECIMAL(3,2);
  DECLARE v_count INT;
  DECLARE v_sales INT;

  SELECT AVG(rating), COUNT(*) INTO v_avg, v_count
  FROM reviews WHERE product_id = p_product_id AND is_approved = 1;

  SELECT SUM(quantity) INTO v_sales
  FROM order_items WHERE product_id = p_product_id AND status NOT IN ('cancelled','refunded');

  UPDATE products
  SET avg_rating   = COALESCE(v_avg, avg_rating),
      review_count = v_count,
      sale_count   = COALESCE(v_sales, 0)
  WHERE id = p_product_id;
END //

DELIMITER ;


-- ============================================================
--  TRIGGERS
-- ============================================================

DELIMITER //

-- Yorum eklenince ürün istatistiklerini güncelle
CREATE TRIGGER `trg_review_insert`
AFTER INSERT ON `reviews`
FOR EACH ROW
BEGIN
  CALL UpdateProductStats(NEW.product_id);
END //

-- Sipariş kalemi teslim edilince satıcı bakiyesini güncelle
CREATE TRIGGER `trg_order_item_delivered`
AFTER UPDATE ON `order_items`
FOR EACH ROW
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.vendor_id IS NOT NULL THEN
    UPDATE vendors
    SET balance      = balance + NEW.net_amount,
        total_earned = total_earned + NEW.gross_amount
    WHERE id = NEW.vendor_id;
  END IF;
END //

-- Kullanıcıya puan eklenince tier güncelle
CREATE TRIGGER `trg_points_update`
AFTER UPDATE ON `users`
FOR EACH ROW
BEGIN
  IF NEW.points != OLD.points THEN
    CALL UpdateUserTier(NEW.id);
  END IF;
END //

DELIMITER ;


-- ============================================================
--  INDEXLER (Ek performans — sadece tablolarda henüz olmayan indexler)
-- ============================================================
CREATE INDEX `idx_prod_price`       ON `products`     (`price`);
CREATE INDEX `idx_prod_rating`      ON `products`     (`avg_rating` DESC);
CREATE INDEX `idx_prod_sales`       ON `products`     (`sale_count` DESC);
CREATE INDEX `idx_us_expires_rev`   ON `user_sessions` (`expires_at`, `is_revoked`);


-- Tamamlandı
SELECT 'MODAICA veritabani basariyla olusturuldu!' AS Sonuc;
