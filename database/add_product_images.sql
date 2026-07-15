-- ============================================================
--  MODAICA — Ürün Görselleri Migration
--  phpMyAdmin > modaica_db > SQL sekmesine yapıştırın
--  NOT: "Duplicate column name" hatası gelirse ikinci ALTER satırını atlayın
-- ============================================================

USE modaica_db;

-- 1. Kolon ekle
ALTER TABLE `products`
  ADD COLUMN `image_url` VARCHAR(500) DEFAULT NULL AFTER `emoji`;

-- 2. Her ürüne kategoriyle uyumlu Unsplash görseli ata
UPDATE `products` SET `image_url` = CASE `id`
  -- ── ERKEK ─────────────────────────────────────────────────
  WHEN 1  THEN 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=480&h=480&fit=crop&q=80'  -- Keten Gömlek
  WHEN 2  THEN 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=480&h=480&fit=crop&q=80'  -- Polo Tişört
  WHEN 3  THEN 'https://images.unsplash.com/photo-1519241047957-be31d7379a5d?w=480&h=480&fit=crop&q=80'  -- Slim Fit Jean
  WHEN 4  THEN 'https://images.unsplash.com/photo-1467043153565-2f4ea60e5e78?w=480&h=480&fit=crop&q=80'  -- Kaşmir Kazak
  WHEN 5  THEN 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=480&h=480&fit=crop&q=80'  -- Kanvas Sneaker
  WHEN 6  THEN 'https://images.unsplash.com/photo-1490114538077-0a4f8c5ef4e7?w=480&h=480&fit=crop&q=80'  -- Chino Pantolon
  WHEN 7  THEN 'https://images.unsplash.com/photo-1556821840-3a63f8b0b9d7?w=480&h=480&fit=crop&q=80'  -- Kapüşonlu Sweatshirt
  WHEN 8  THEN 'https://images.unsplash.com/photo-1548036161-6d81e11fad7a?w=480&h=480&fit=crop&q=80'  -- Deri Cüzdan
  -- ── KADIN ─────────────────────────────────────────────────
  WHEN 9  THEN 'https://images.unsplash.com/photo-1595777457553-864cf4c5da23?w=480&h=480&fit=crop&q=80'  -- Çiçek Elbise
  WHEN 10 THEN 'https://images.unsplash.com/photo-1490481970867-ef2a631fcfd3?w=480&h=480&fit=crop&q=80'  -- Saten Bluz
  WHEN 11 THEN 'https://images.unsplash.com/photo-1515886657613-9a21d6fd8ae9?w=480&h=480&fit=crop&q=80'  -- Midi Etek
  WHEN 12 THEN 'https://images.unsplash.com/photo-1581497396202-5645e32a8697?w=480&h=480&fit=crop&q=80'  -- Palazzo Pantolon
  WHEN 13 THEN 'https://images.unsplash.com/photo-1548036161-6d81e11fad7a?w=480&h=480&fit=crop&q=80'  -- Omuz Çantası
  WHEN 14 THEN 'https://images.unsplash.com/photo-1543163352-56e4afff0abc?w=480&h=480&fit=crop&q=80'  -- Stiletto
  WHEN 15 THEN 'https://images.unsplash.com/photo-1576669739226-0e91f2e20e47?w=480&h=480&fit=crop&q=80'  -- Kaşmir Kazak Krem
  WHEN 16 THEN 'https://images.unsplash.com/photo-1539533018916-3d5cb8e75c95?w=480&h=480&fit=crop&q=80'  -- Kapitone Mont
  -- ── ELEKTRONİK ────────────────────────────────────────────
  WHEN 17 THEN 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=480&h=480&fit=crop&q=80'  -- Apple Watch
  WHEN 18 THEN 'https://images.unsplash.com/photo-1505740420034-3eea01fef11e?w=480&h=480&fit=crop&q=80'  -- Sony Kulaklık
  WHEN 19 THEN 'https://images.unsplash.com/photo-1593359842426-ee4f1e88e2fc?w=480&h=480&fit=crop&q=80'  -- Samsung TV
  WHEN 20 THEN 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=480&h=480&fit=crop&q=80'  -- iPad Air
  WHEN 21 THEN 'https://images.unsplash.com/photo-1538437571848-5448f1c47914?w=480&h=480&fit=crop&q=80'  -- PlayStation 5
  WHEN 22 THEN 'https://images.unsplash.com/photo-1496181438963-4f1c8fe26f6e?w=480&h=480&fit=crop&q=80'  -- MacBook Air
  WHEN 23 THEN 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=480&h=480&fit=crop&q=80'  -- Xiaomi 14
  WHEN 24 THEN 'https://images.unsplash.com/photo-1565526131493-631b03e3c5a4?w=480&h=480&fit=crop&q=80'  -- Samsung S24
  -- ── EV & YAŞAM ────────────────────────────────────────────
  WHEN 25 THEN 'https://images.unsplash.com/photo-1555041586-ded2d5c0a32e?w=480&h=480&fit=crop&q=80'  -- Meşe Masa
  WHEN 26 THEN 'https://images.unsplash.com/photo-1560185893-a55b7c17a5a2?w=480&h=480&fit=crop&q=80'  -- Lateks Yatak
  WHEN 27 THEN 'https://images.unsplash.com/photo-1484156168-f81e35a3d57b?w=480&h=480&fit=crop&q=80'  -- Vazo Seti
  WHEN 28 THEN 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=480&h=480&fit=crop&q=80'  -- Tencere Seti
  WHEN 29 THEN 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=480&h=480&fit=crop&q=80'  -- LED Lamba
  WHEN 30 THEN 'https://images.unsplash.com/photo-1582735479-59f2f0e3c01a?w=480&h=480&fit=crop&q=80'  -- Pamuk Havlu
  -- ── SPOR ──────────────────────────────────────────────────
  WHEN 31 THEN 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=480&h=480&fit=crop&q=80'  -- Nike Koşu
  WHEN 32 THEN 'https://images.unsplash.com/photo-1534438522-a3e23cb1e5b6?w=480&h=480&fit=crop&q=80'  -- Dambıl
  WHEN 33 THEN 'https://images.unsplash.com/photo-1544367577-01f5369d7973?w=480&h=480&fit=crop&q=80'  -- Yoga Matı
  WHEN 34 THEN 'https://images.unsplash.com/photo-1547447134-cd3f5c716030?w=480&h=480&fit=crop&q=80'  -- Sırt Çantası
  WHEN 35 THEN 'https://images.unsplash.com/photo-1504280392-3b07d4b891c4?w=480&h=480&fit=crop&q=80'  -- Çadır
  WHEN 36 THEN 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=480&h=480&fit=crop&q=80'  -- Nike Tişört
  -- ── KOZMETİK ──────────────────────────────────────────────
  WHEN 37 THEN 'https://images.unsplash.com/photo-1571781926291-c47540ebb6fc?w=480&h=480&fit=crop&q=80'  -- Micellar Su
  WHEN 38 THEN 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=480&h=480&fit=crop&q=80'  -- Hyalüronik Serum
  WHEN 39 THEN 'https://images.unsplash.com/photo-1541913084-9d50d4a2d11e?w=480&h=480&fit=crop&q=80'  -- Parfüm
  WHEN 40 THEN 'https://images.unsplash.com/photo-1522335827-9ec4b3b54b71?w=480&h=480&fit=crop&q=80'  -- Maskara
  WHEN 41 THEN 'https://images.unsplash.com/photo-1522338335960-f96815132ad8?w=480&h=480&fit=crop&q=80'  -- Saç Maskesi
  WHEN 42 THEN 'https://images.unsplash.com/photo-1512207526-a5d6d80ff2f3?w=480&h=480&fit=crop&q=80'  -- LED Yüz Maskesi
  ELSE image_url
END
WHERE `id` BETWEEN 1 AND 42;

SELECT CONCAT('Gorseller guncellendi. Toplam: ', ROW_COUNT(), ' urun.') AS Sonuc;
