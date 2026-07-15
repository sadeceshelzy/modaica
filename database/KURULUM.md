# MODAICA — Veritabanı Kurulum Kılavuzu

## 📁 Dosya Konumları

```
modaica/
├── database/
│   └── modaica_schema.sql     ← Bu dosyayı phpMyAdmin'e import edin
└── backend/
    └── config/
        └── database.php       ← Bağlantı ayarları burada
```

---

## 🚀 Kurulum (XAMPP ile)

### Adım 1 — XAMPP'ı Başlatın
- Apache ✅ Start
- MySQL  ✅ Start

### Adım 2 — phpMyAdmin'i Açın
Tarayıcıda: [http://localhost/phpmyadmin](http://localhost/phpmyadmin)

### Adım 3 — Veritabanını Oluşturun ve İmport Edin
1. Sol menüde **"Yeni"** (New) tıklayın
2. Veritabanı adı: `modaica_db` → **Oluştur** (utf8mb4 charset seçin)
3. `modaica_db` seçili haldeyken **SQL** sekmesine tıklayın
4. `database/modaica_schema.sql` dosyasının içeriğini yapıştırın
5. **Git** butonuna tıklayın

> ✅ Alternatif: **Import** sekmesinden .sql dosyasını direkt yükleyebilirsiniz.

---

## 🔐 Demo Hesaplar

`backend/config/seed_data.sql` dosyasını çalıştırdıktan sonra aşağıdaki hesaplar kullanıma hazırdır:

```sql
-- seed_data.sql çalıştırıldıktan sonra hazır hesaplar:
-- Admin    → admin@modaica.com  /  Admin1234!
-- Satıcı   → nike@modaica.com   /  Vendor123!
-- Kullanıcı → ali@example.com   /  User1234!
```

### Hazır Demo Giriş Bilgileri:
| Rol | E-posta | Şifre |
|-----|---------|-------|
| Admin | admin@modaica.com | Admin1234! |
| Satıcı | nike@modaica.com | Vendor123! |
| Kullanıcı | ali@example.com | User1234! |

> ⚠️ Bu şifreler `seed_data.sql` ile birlikte gelir. Üretim ortamında güvenli şifrelerle değiştirin!

---

## ⚙️ Bağlantı Ayarları

**Dosya:** `backend/config/database.php`

```php
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'modaica_db');
define('DB_USER', 'root');   // Kendi kullanıcı adınız
define('DB_PASS', '');       // Kendi şifreniz (XAMPP genelde boş)
```

---

## 🗄️ Tablo Listesi (26 Tablo)

| # | Tablo | Açıklama |
|---|-------|----------|
| 1 | `users` | Müşteri hesapları |
| 2 | `notification_prefs` | Bildirim tercihleri |
| 3 | `security_settings` | 2FA, güvenlik |
| 4 | `addresses` | Teslimat adresleri |
| 5 | `points_log` | Puan geçmişi |
| 6 | `vendors` | Satıcı hesapları |
| 7 | `vendor_notifications` | Satıcı bildirimleri |
| 8 | `vendor_payouts` | Ödeme talepleri |
| 9 | `admins` | Admin hesapları |
| 10 | `admin_activity_log` | Admin işlem logu |
| 11 | `admin_notifications` | Admin bildirimleri |
| 12 | `categories` | Ürün kategorileri |
| 13 | `products` | Ürün kataloğu |
| 14 | `product_images` | Ürün görselleri |
| 15 | `product_variants` | Beden/renk/varyant |
| 16 | `favorites` | Favoriler |
| 17 | `cart_items` | Sepet |
| 18 | `orders` | Siparişler |
| 19 | `order_items` | Sipariş kalemleri |
| 20 | `coupons` | Kuponlar |
| 21 | `coupon_usages` | Kupon kullanım logu |
| 22 | `reviews` | Ürün yorumları |
| 23 | `review_votes` | Yorum oylaması |
| 24 | `search_history` | Arama geçmişi |
| 25 | `search_popular` | Popüler aramalar |
| 26 | `chat_sessions` | AI sohbet oturumu |

### Views (4 adet)
- `vw_active_products` — Aktif ürünler + satıcı + kategori
- `vw_order_summary` — Sipariş özetleri
- `vw_vendor_performance` — Satıcı performans raporu
- `vw_product_ratings` — Ürün rating dağılımı

### Stored Procedures (2 adet)
- `UpdateUserTier(user_id)` — Loyalty tier hesapla
- `UpdateProductStats(product_id)` — Rating/satış istatistiklerini güncelle

### Triggers (3 adet)
- `trg_review_insert` — Yorum sonrası ürün stats güncelle
- `trg_order_item_delivered` — Teslimatta satıcı bakiyesini güncelle
- `trg_points_update` — Puan değişiminde tier güncelle

---

## 🛒 Hazır Kupon Kodları

| Kod | İndirim | Şart |
|-----|---------|------|
| `YENISEZON` | %15 | Min. 500₺ |
| `MODAICA10` | %10 | Tüm siparişler |
| `HOSGELDIN20` | %20 | İlk sipariş, maks. 500₺ |
| `KARGO0` | Ücretsiz Kargo | Min. 200₺ |

---

## 🔧 Sık Sorulan Sorular

**S: "Veritabanına bağlanılamadı" hatası alıyorum.**
> XAMPP'ta MySQL'in çalıştığından emin olun. `database.php`'deki kullanıcı adı/şifreyi kontrol edin.

**S: phpMyAdmin'de tablo görünmüyor.**
> Sol menüde `modaica_db`'yi seçtikten sonra SQL'i çalıştırın. SQL hata verdiyse `SET FOREIGN_KEY_CHECKS = 0;` satırını başa ekleyin.

**S: Giriş yapamıyorum.**
> `seed_data.sql` dosyasını `schema.sql` sonrasında çalıştırın. Şifreler: Admin1234!, Vendor123!, User1234!
