-- ============================================================
--  MODAICA — Örnek Veri (Seed Data) v2.1
--  Ana şema: database/modaica_schema.sql
--
--  KURULUM:
--  1. Önce database/modaica_schema.sql'i çalıştırın
--  2. Ardından bu dosyayı çalıştırın
--
--  phpMyAdmin > modaica_db seç > SQL sekmesi > yapıştır > Git
-- ============================================================

USE modaica_db;

-- ─────────────────────────────────────────────────────────────
-- ADMİN KULLANICISI
-- E-posta: admin@modaica.com  /  Şifre: Admin1234!
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `admins` (`name`, `email`, `password_hash`, `role`, `is_active`) VALUES
('Süper Admin', 'admin@modaica.com', '$2y$12$w4CJGv6oeY9ijUhPWnMBe.pHqPL6XzcE1ck6vOxKOsh8bCkOssdaS', 'super_admin', 1);

-- ─────────────────────────────────────────────────────────────
-- KATEGORİLER (Genişletilmiş)
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `categories` (`department`, `name`, `slug`, `emoji`, `sort_order`) VALUES
-- Ev & Yaşam (Ek)
('ev',      'Aydınlatma',   'aydinlatma',   '💡', 6),
('ev',      'Bahçe',        'bahce',        '🌿', 7),
('ev',      'Tekstil',      'tekstil',      '🛁', 8),
('ev',      'Uyku',         'uyku',         '🛏️', 9),
-- Spor (Ek)
('spor',    'Kamp',         'kamp',         '⛺', 5),
('spor',    'Fitness',      'fitness',      '🏋️', 6),
-- Elektronik (Ek)
('elektronik','Laptop',     'laptop',       '💻', 8),
('elektronik','Masaüstü',   'masaustu',     '🖥️', 9),
('elektronik','Fotoğraf',   'fotograf',     '📷', 10),
-- Kozmetik (Ek)
('kozmetik','Alet',         'alet',         '🔴', 6);


-- ─────────────────────────────────────────────────────────────
-- SATICLAR (products FK için zorunlu)
-- Şifreler: Vendor123!
-- Demo Satıcı: nike@modaica.com / Vendor123!
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `vendors` (`id`, `name`, `shop_name`, `email`, `password_hash`, `phone`, `logo_emoji`, `commission_rate`, `balance`, `total_earned`, `status`) VALUES
(1, 'Nike Türkiye',   'Nike Official',         'nike@modaica.com',    '$2y$10$AZiKxsX1YBBoNNhp4RivQe/E8F8VaOwg97F160ttYPYjVw2iXZGZa', '+90 212 000 0001', '🏃', 8.00,  2450.00, 48920.00, 'approved'),
(2, 'Apple Premium',  'Apple Store',           'apple@modaica.com',   '$2y$10$AZiKxsX1YBBoNNhp4RivQe/E8F8VaOwg97F160ttYPYjVw2iXZGZa', '+90 212 000 0002', '💻', 6.00,  8750.00, 175000.00,'approved'),
(3, 'GlowLab Kozmetik','GlowLab',             'glow@modaica.com',    '$2y$10$AZiKxsX1YBBoNNhp4RivQe/E8F8VaOwg97F160ttYPYjVw2iXZGZa', '+90 533 000 0003', '💄', 12.00, 1200.00, 24000.00, 'approved');

-- ─────────────────────────────────────────────────────────────
-- DEMO KULLANICILARI
-- Şifreler: User1234!
-- Demo Kullanıcı: ali@example.com / User1234!
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `users` (`id`, `member_no`, `name`, `email`, `password_hash`, `tier`, `points`, `is_active`, `email_verified`) VALUES
(1, 'MCA-00000001', 'Ali Yılmaz',     'ali@example.com',     '$2y$10$bmgkwvTDrp230M5OCRRvbOEhJ0AUgTxHGV/KgmTALYSgeXYq3KAY6', 'Gold',   1250, 1, 1),
(2, 'MCA-00000002', 'Ayşe Kaya',      'ayse@example.com',    '$2y$10$bmgkwvTDrp230M5OCRRvbOEhJ0AUgTxHGV/KgmTALYSgeXYq3KAY6', 'Silver',  430, 1, 1),
(3, 'MCA-00000003', 'Mehmet Demir',   'mehmet@example.com',  '$2y$10$bmgkwvTDrp230M5OCRRvbOEhJ0AUgTxHGV/KgmTALYSgeXYq3KAY6', 'Bronze',   90, 1, 1);

-- ─────────────────────────────────────────────────────────────
-- KUPONLAR (Ana şema ile uyumlu)
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `coupons` (`code`, `type`, `value`, `min_order_amount`, `max_discount`, `max_uses`, `max_uses_per_user`, `description`, `is_active`, `expires_at`) VALUES
('HOSGELDIN20', 'percent',    20.00,  100.00, 500.00, 1000, 1, '%20 indirim — ilk sipariş, max ₺500',        1, DATE_ADD(NOW(), INTERVAL 1 YEAR)),
('TECH10',      'percent',    10.00, 2000.00,   NULL,  500, 1, '%10 indirim — elektronik ürünlerde',         1, DATE_ADD(NOW(), INTERVAL 6 MONTH)),
('SPORLA',      'percent',    12.00,  500.00,   NULL,  500, 1, '%12 indirim — spor ürünlerinde',             1, DATE_ADD(NOW(), INTERVAL 6 MONTH)),
('BEAUTY15',    'percent',    15.00,  300.00,   NULL,  500, 1, '%15 indirim — kozmetik ürünlerinde',         1, DATE_ADD(NOW(), INTERVAL 6 MONTH)),
('KARGO0',      'free_cargo',  0.00,  400.00,   NULL, 9999, 5, 'Ücretsiz kargo — 400₺ ve üzeri siparişler', 1, DATE_ADD(NOW(), INTERVAL 1 YEAR));


-- ─────────────────────────────────────────────────────────────
-- ÜRÜNLER — ERKEK (IDs 1-8, vendor_id=1)
-- category_slug: JS CAT_LABELS anahtarlarıyla eşleşir
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `products`
  (`id`, `vendor_id`, `sku`, `name`, `brand`, `department`, `category_slug`, `price`, `old_price`, `stock`, `badge`, `emoji`, `description`, `is_active`, `is_featured`, `avg_rating`, `review_count`, `sale_count`)
VALUES
  (1,  1, 'ERK-GOMLk-001', 'Slim Fit Keten Gömlek',     'MODAICA',   'erkek', 'gomlek',     599.00,    NULL,  50, 'new',  '👔', 'Yüksek kaliteli keten kumaştan üretilmiş slim fit gömlek. Yazlık koleksiyon.', 1, 0, 4.60, 198, 512),
  (2,  1, 'ERK-TSH-002',   'Polo Yaka Pique Tişört',    'MODAICA',   'erkek', 'tshirt',     429.00,  599.00,  80, NULL,   '👕', 'Klasik polo yaka, pique dokuma premium pamuk tişört.',                          1, 0, 4.60, 335, 780),
  (3,  1, 'ERK-JN-003',    'Slim Fit Jean',              'UrbanLine', 'erkek', 'pantolon',   649.00,  899.00,  60, 'sale', '👖', 'Slim fit kesim, yüksek kaliteli denim kumaş. Her ortama uygun.',               1, 0, 4.50, 218, 430),
  (4,  1, 'ERK-KAZ-004',   'Kaşmir Kazak',              'NordStyle', 'erkek', 'kazak',     1299.00, 1799.00,  30, 'best', '🧥', 'Premium kaşmir karışımlı kazak. Kış koleksiyonunun gözdesi.',                  1, 1, 4.90, 156, 187),
  (5,  1, 'ERK-SNK-005',   'Kanvas Sneaker Beyaz',       'StepX',     'erkek', 'ayakkabi',   799.00,    NULL,  45, 'new',  '👟', 'Hafif kanvas sneaker. Günlük kullanım için ideal.',                            1, 0, 4.50, 203, 320),
  (6,  1, 'ERK-CHN-006',   'Slim Fit Chino Pantolon',   'UrbanLine', 'erkek', 'pantolon',   799.00, 1099.00,  55, 'sale', '👖', 'Premium chino kumaş, slim fit kesim. İş ve günlük kombinlere ideal.',          1, 0, 4.60, 178, 290),
  (7,  1, 'ERK-SWT-007',   'Kapüşonlu Sweatshirt',      'MODAICA',   'erkek', 'sweatshirt', 549.00,    NULL,  70, 'hot',  '🧥', 'Oversize kapüşonlu sweatshirt. Rahat ve şık.',                                 1, 0, 4.30, 523, 640),
  (8,  1, 'ERK-DER-008',   'Deri Cüzdan Siyah',         'MODAICA',   'erkek', 'aksesuar',   399.00,    NULL, 100, 'hot',  '👛', 'Hakiki deri cüzdan. Çoklu kart bölmesi ve para bölümü.',                       1, 0, 4.70, 421, 850);


-- ─────────────────────────────────────────────────────────────
-- ÜRÜNLER — KADIN (IDs 9-16, vendor_id=1)
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `products`
  (`id`, `vendor_id`, `sku`, `name`, `brand`, `department`, `category_slug`, `price`, `old_price`, `stock`, `badge`, `emoji`, `description`, `is_active`, `is_featured`, `avg_rating`, `review_count`, `sale_count`)
VALUES
  (9,  1, 'KDN-ELB-001', 'Çiçek Desenli Midi Elbise',     'MODAICA',   'kadin', 'elbise',     899.00, 1299.00,  40, 'sale', '👗', 'Yazlık çiçek desenli midi boy elbise. Hem şık hem rahat.',                   1, 1, 4.70, 412, 389),
  (10, 1, 'KDN-BLU-002', 'Saten Bluz',                    'MODAICA',   'kadin', 'bluz',       499.00,  699.00,  55, 'sale', '👚', 'Premium saten kumaş bluz. Özel geceler için ideal.',                         1, 0, 4.40, 287, 420),
  (11, 1, 'KDN-ETK-003', 'Pileli Midi Etek',              'SummerCo',  'kadin', 'etek',       549.00,  749.00,  35, 'new',  '👗', 'Akordeon pileli midi etek. Yazın olmazmazı.',                                 1, 0, 4.60, 223, 310),
  (12, 1, 'KDN-PNT-004', 'Yüksek Bel Palazzo Pantolon',  'UrbanLine', 'kadin', 'pantolon',   699.00,  999.00,  45, 'sale', '👖', 'Yüksek bel palazzo kesim pantolon. Hem rahat hem şık.',                      1, 0, 4.50, 198, 260),
  (13, 1, 'KDN-CNT-005', 'Deri Omuz Çantası',             'MODAICA',   'kadin', 'canta',     1299.00, 1799.00,  25, 'sale', '👜', 'Hakiki deri omuz çantası. Spasiyer iç bölüm ve metal detaylar.',             1, 1, 4.70, 143, 220),
  (14, 1, 'KDN-AYK-006', 'Stiletto Topuklu Ayakkabı',    'StepX',     'kadin', 'ayakkabi',  1799.00, 2499.00,  30, 'sale', '👠', 'Klasik stiletto topuklu ayakkabı. Özel davetler için mükemmel.',             1, 0, 4.40, 234, 180),
  (15, 1, 'KDN-KAZ-007', 'Kaşmir Kazak Krem',            'NordStyle', 'kadin', 'bluz',      1399.00, 1999.00,  28, 'hot',  '🧥', 'Premium kaşmir karışım kadın kazak. Gün boyu konfor.',                      1, 1, 4.80, 143, 145),
  (16, 1, 'KDN-MON-008', 'Kapitone Mont Siyah',          'NordStyle', 'kadin', 'dis-giyim', 2299.00, 3299.00,  20, 'sale', '🧥', 'Dolgu yuvarlak yakalı kapitone mont. Kış soğuğuna karşı tam koruma.',       1, 0, 4.60,  98,  89);


-- ─────────────────────────────────────────────────────────────
-- ÜRÜNLER — ELEKTRONİK (IDs 17-24, vendor_id=2)
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `products`
  (`id`, `vendor_id`, `sku`, `name`, `brand`, `department`, `category_slug`, `price`, `old_price`, `stock`, `badge`, `emoji`, `description`, `is_active`, `is_featured`, `avg_rating`, `review_count`, `sale_count`)
VALUES
  (17, 2, 'ELK-AW9-001',  'Apple Watch Series 9 GPS 45mm', 'Apple',   'elektronik', 'giyilebilir', 13999.00, 15999.00,  15, 'hot',  '⌚', 'Apple Watch Series 9. Gelişmiş sağlık sensörleri, Always-On Display.',       1, 1, 4.90, 2341,  98),
  (18, 2, 'ELK-SNY-002',  'Sony WH-1000XM5 Kulaklık',     'Sony',    'elektronik', 'ses',          8999.00, 11999.00,  22, 'sale', '🎧', 'Piyasanın en iyi gürültü engelleme teknolojisi. 30 saate kadar pil ömrü.',   1, 0, 4.80, 1567, 234),
  (19, 2, 'ELK-SMS-003',  'Samsung QLED 4K 65" 144Hz',   'Samsung', 'elektronik', 'televizyon',  34999.00, 44999.00,   8, 'sale', '📺', 'Quantum Dot teknolojisi, 144Hz yenileme hızı, Gaming Hub.',                   1, 0, 4.80,  567,  45),
  (20, 2, 'ELK-IPD-004',  'iPad Air M2 11" WiFi 256GB',  'Apple',   'elektronik', 'tablet',      29999.00, 32999.00,  12, 'new',  '📲', 'M2 çip ile güçlü performans. Apple Pencil ve Magic Keyboard uyumlu.',        1, 0, 4.90,  432,  67),
  (21, 2, 'ELK-PS5-005',  'PlayStation 5 Slim 1TB',       'Sony',    'elektronik', 'oyun',        19999.00, 22999.00,  10, 'hot',  '🎮', 'Yeni ince tasarım. DualSense haptic feedback. 4K 120fps gaming.',            1, 1, 4.90, 1876,  89),
  (22, 2, 'ELK-MAC-006',  'MacBook Air M3 13"',          'Apple',   'elektronik', 'laptop',      54999.00, 59999.00,   7, 'best', '💻', 'M3 çip, 18 saate kadar pil. Fanless tasarım, ultra ince.',                   1, 1, 4.90,  876,  52),
  (23, 2, 'ELK-XMI-007',  'Xiaomi 14 256GB',              'Xiaomi',  'elektronik', 'telefon',     24999.00, 27999.00,  20, 'new',  '📱', 'Snapdragon 8 Gen 3, Leica kamera sistemi, 90W şarj.',                        1, 0, 4.70,  654, 120),
  (24, 2, 'ELK-SAM-008',  'Samsung Galaxy S24 Ultra',     'Samsung', 'elektronik', 'telefon',     49999.00, 54999.00,  18, 'hot',  '📱', 'Snapdragon 8 Gen 3, 200MP kamera, S Pen dahil, Galaxy AI.',                  1, 1, 4.80, 1234,  88);


-- ─────────────────────────────────────────────────────────────
-- ÜRÜNLER — EV & YAŞAM (IDs 25-30, vendor_id=1)
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `products`
  (`id`, `vendor_id`, `sku`, `name`, `brand`, `department`, `category_slug`, `price`, `old_price`, `stock`, `badge`, `emoji`, `description`, `is_active`, `is_featured`, `avg_rating`, `review_count`, `sale_count`)
VALUES
  (25, 1, 'EVY-MSF-001', 'Masif Meşe Yemek Masası',         'HomeCraft',  'ev', 'mobilya',      9499.00, 12999.00,   5, 'best', '🪑',  'Masif meşe ahşap yemek masası. El işçiliği, dayanıklı konstrüksiyon.',   1, 1, 4.70, 187,  23),
  (26, 1, 'EVY-LAT-002', 'Doğal Lateks Yatak 160x200cm',   'DreamSleep', 'ev', 'uyku',         8999.00, 12999.00,  10, 'sale', '🛏️', '100% doğal lateks dolgu. Ortopedik destek, anti-bakteriyel.',            1, 0, 4.80, 312,  45),
  (27, 1, 'EVY-VAZ-003', 'Marmer Efektli Vazo Seti 3 lü',  'HomeDecor',  'ev', 'dekorasyon',    749.00,    NULL,   40, 'new',  '🏺',  'El yapımı marmer efektli seramik vazo seti. 3 farklı boy.',              1, 0, 4.60, 312, 180),
  (28, 1, 'EVY-TEN-004', 'Karbon Çelik Tencere 7 li Set',  'ChefLine',   'ev', 'mutfak',       2999.00,  3999.00,  25, 'hot',  '🍳',  'Karbon çelik tencere seti. Tüm ocak tiplerinde kullanılabilir.',         1, 0, 4.70, 567, 234),
  (29, 1, 'EVY-LED-005', 'LED Gece Lambası Ahşap',          'LightCraft', 'ev', 'aydinlatma',    299.00,   499.00,  80, 'sale', '💡',  'Bambu gövdeli LED gece lambası. USB şarjlı, 3 renk sıcaklığı.',          1, 0, 4.50, 234, 560),
  (30, 1, 'EVY-HAV-006', 'Organik Pamuk Havlu Seti',        'SoftTouch',  'ev', 'tekstil',       599.00,   899.00,  60, 'sale', '🛁',  'OEKO-TEX sertifikalı organik pamuk. Ultra yumuşak, yüksek emicilik.',   1, 0, 4.60, 445, 420);


-- ─────────────────────────────────────────────────────────────
-- ÜRÜNLER — SPOR (IDs 31-36, vendor_id=1)
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `products`
  (`id`, `vendor_id`, `sku`, `name`, `brand`, `department`, `category_slug`, `price`, `old_price`, `stock`, `badge`, `emoji`, `description`, `is_active`, `is_featured`, `avg_rating`, `review_count`, `sale_count`)
VALUES
  (31, 1, 'SPR-NIK-001', 'Nike Ultra Boost Pro Koşu Ayakkabısı', 'Nike',     'spor', 'ayakkabi', 3499.00, 4499.00,  30, 'sale', '👟', 'Nike Zoom Air tabanlı profesyonel koşu ayakkabısı. React köpük.',         1, 1, 4.90, 1876, 1243),
  (32, 1, 'SPR-DUM-002', 'Adjustable Dumbbell 2-24kg',           'FitPro',   'spor', 'ekipman',  6999.00, 8999.00,  15, 'sale', '🏋️','Tek hareketle ayarlanabilir dambıl seti. 15 farklı ağırlık.',           1, 0, 4.80,  432,  87),
  (33, 1, 'SPR-YOG-003', 'Yoga Matı 6mm Kaymaz',                'ZenFlow',  'spor', 'ekipman',   599.00,  799.00,  70, 'hot',  '🧘', 'TPE malzeme, kaymaz yüzey, hafif ve dayanıklı.',                         1, 0, 4.70, 1098, 630),
  (34, 1, 'SPR-TRK-004', 'Trekking Sırt Çantası 40L',           'Osprey',   'spor', 'kamp',     2499.00,   NULL,   20, 'new',  '🎒', 'Ergonomik sırt sistemi, yağmurluk dahil, laptop bölmeli.',               1, 0, 4.80,  187, 134),
  (35, 1, 'SPR-CAD-005', '3 Mevsim Çadır 2 Kişilik',           'HikerPro', 'spor', 'kamp',     2999.00, 3999.00,  12, 'sale', '⛺', '3000mm su direnci, çift kapı, ön sundurma.',                             1, 0, 4.70,  312,  98),
  (36, 1, 'SPR-NIK-006', 'Nike Dri-FIT Koşu Tişörtü',           'Nike',     'spor', 'giyim',     649.00,  899.00,  90, 'hot',  '👕', 'Dri-FIT nemi uzaklaştırma teknolojisi. Hafif ve nefes alabilen.',         1, 0, 4.60, 1234, 630);


-- ─────────────────────────────────────────────────────────────
-- ÜRÜNLER — KOZMETİK (IDs 37-42, vendor_id=3)
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `products`
  (`id`, `vendor_id`, `sku`, `name`, `brand`, `department`, `category_slug`, `price`, `old_price`, `stock`, `badge`, `emoji`, `description`, `is_active`, `is_featured`, `avg_rating`, `review_count`, `sale_count`)
VALUES
  (37, 3, 'KZM-MIC-001', 'Micellar Temizleme Suyu 400ml',    'Garnier',    'kozmetik', 'yuz-bakim',   249.00,  329.00, 200, 'hot',  '🫧', 'Yüz, göz ve dudak makyajını tek adımda temizler. Hassas ciltler için.', 1, 0, 4.90, 3215, 2100),
  (38, 3, 'KZM-HYL-002', 'Hyalüronik Asit Serumu 50ml',     'GlowLab',    'kozmetik', 'yuz-bakim',   549.00,  699.00, 120, 'new',  '💧', '3 çeşit hyalüronik asit içerir. 24 saat nem. Dermatolojik test.',        1, 1, 4.80, 2341,  340),
  (39, 3, 'KZM-PRF-003', 'La Vie Est Belle EDP 50ml',        'Lancôme',    'kozmetik', 'parfum',     2999.00, 3499.00,  40, 'sale', '🌸', 'Çiçeksi oryantal kadın parfümü. İris, frenk üzümü ve vanilya.',          1, 0, 4.70, 1543,  145),
  (40, 3, 'KZM-MAS-004', 'Waterproof Maskara Hacim',         'MAC',        'kozmetik', 'makyaj',      299.00,  399.00, 150, 'hot',  '👁️','Çarpıcı hacim ve uzunluk. 24 saat kalıcı, su geçirmez formül.',          1, 0, 4.80, 2876,  980),
  (41, 3, 'KZM-SAC-005', 'Argan Yağlı Saç Maskesi 250ml',   'GlowLab',    'kozmetik', 'sac-bakim',   899.00, 1199.00,  80, 'sale', '💆', 'Fas''tan ithal argan yağı. Yoğun nemlendirme, parlaklık ve yumuşaklık.',1, 0, 4.60,  765,  320),
  (42, 3, 'KZM-LED-006', 'LED Yüz Maskesi 7 Renk',          'GlowLab',    'kozmetik', 'alet',       7999.00, 9999.00,  25, 'new',  '🔴', '7 farklı LED renk terapisi. Anti-aging, akne tedavisi, aydınlatma.',     1, 1, 4.70,  187,   67);


-- ─────────────────────────────────────────────────────────────
-- SİPARİŞLER (demo)
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `orders` (`id`, `user_id`, `order_code`, `subtotal`, `discount_amount`, `cargo_fee`, `total_amount`, `payment_method`, `payment_status`, `status`, `cargo_company`, `cargo_tracking`, `points_earned`, `created_at`) VALUES
(1, 1, 'MDC-20260510-000001', 1398.00, 0.00, 0.00,  1398.00, 'credit_card',   'paid', 'delivered', 'Yurtiçi Kargo', 'YK123456789TR', 139, '2026-05-10 10:23:00'),
(2, 1, 'MDC-20260515-000002', 1248.00, 0.00, 0.00,  1248.00, 'credit_card',   'paid', 'shipping',  'MNG Kargo',     'MNG987654321',  124, '2026-05-15 14:05:00'),
(3, 2, 'MDC-20260518-000003', 3499.00, 0.00, 0.00,  3499.00, 'credit_card',   'paid', 'confirmed', NULL,            NULL,            349, '2026-05-18 09:12:00'),
(4, 3, 'MDC-20260520-000004',  998.00, 0.00, 29.90, 1027.90, 'bank_transfer', 'paid', 'pending',   NULL,            NULL,             99, '2026-05-20 16:45:00'),
(5, 1, 'MDC-20260522-000005', 9499.00, 0.00, 0.00,  9499.00, 'credit_card',   'paid', 'delivered', 'Aras Kargo',    'ARS234567890',  949, '2026-05-22 11:30:00');

-- ─────────────────────────────────────────────────────────────
-- SİPARİŞ KALEMLERİ (demo — product_id değerleri doğru ID'ler)
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `order_items` (`order_id`, `vendor_id`, `product_id`, `product_name`, `product_brand`, `product_emoji`, `quantity`, `unit_price`, `gross_amount`, `commission`, `net_amount`, `status`) VALUES
(1, 1,  9, 'Çiçek Desenli Midi Elbise',  'MODAICA',   '👗', 1,  899.00,  899.00,  71.92,  827.08, 'delivered'),
(1, 1, 10, 'Saten Bluz',                 'MODAICA',   '👚', 1,  499.00,  499.00,  39.92,  459.08, 'delivered'),
(2, 1, 11, 'Pileli Midi Etek',           'SummerCo',  '👗', 1,  549.00,  549.00,  43.92,  505.08, 'shipping'),
(2, 1, 12, 'Yüksek Bel Palazzo Pant.',   'UrbanLine', '👖', 1,  699.00,  699.00,  55.92,  643.08, 'shipping'),
(3, 1, 31, 'Nike Ultra Boost Pro',       'Nike',      '👟', 1, 3499.00, 3499.00, 279.92, 3219.08, 'confirmed'),
(4, 1, 10, 'Saten Bluz',                 'MODAICA',   '👚', 2,  499.00,  998.00,  79.84,  918.16, 'pending'),
(5, 1, 25, 'Masif Meşe Yemek Masası',    'HomeCraft', '🪑', 1, 9499.00, 9499.00, 759.92, 8739.08, 'delivered');

-- ─────────────────────────────────────────────────────────────
-- ÜRÜN YORUMLARI (demo — product_id değerleri doğru ID'ler)
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `reviews` (`user_id`, `product_id`, `rating`, `title`, `body`, `is_approved`, `helpful`, `created_at`) VALUES
(1,  9, 5, 'Harika bir elbise!',          'Kalitesi mükemmel, kumaş çok güzel. Bedenim tam oturdu. Kesinlikle tavsiye ederim.', 1, 24, '2026-05-12 09:00:00'),
(2,  9, 4, 'Güzel ama renk biraz farklı','Fotoğraftakinden biraz daha açık ama yine de çok şık. Kalite iyi.',                  1, 12, '2026-05-13 14:00:00'),
(1, 31, 5, 'En iyi koşu ayakkabısı',     'Gerçekten çok hafif ve konforlu. Koşularımda büyük fark yarattı. 10/10.',            1, 45, '2026-05-17 11:00:00'),
(3, 18, 5, 'Mükemmel ses kalitesi',      'Sony WH-1000XM5 gerçekten beklentileri aşıyor. Gürültü engelleme inanılmaz.',        1, 67, '2026-05-19 16:00:00'),
(2, 19, 4, 'Çok güzel TV',               'Görüntü kalitesi harika, 144Hz akıcılık oyunlar için mükemmel. Kurulum kolay.',      1, 31, '2026-05-20 10:00:00');

-- Tamamlandı
SELECT 'Seed data basariyla eklendi! Toplam urun: 42, kullanici: 3, siparis: 5' AS Sonuc;
