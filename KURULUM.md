# MODAICA — Kurulum & Çalıştırma Kılavuzu

## Gereksinimler
- **XAMPP** (Apache + MySQL) — https://www.apachefriends.org/
- Tarayıcı (Chrome önerilir)

---

## Adım 1 — Proje Konumu

Proje klasörünü XAMPP'ın `htdocs` dizinine kopyalayın:

```
C:\xampp\htdocs\modaica\
```

Klasör yapısı şöyle olmalı:
```
C:\xampp\htdocs\modaica\
├── anasayfa.html
├── erkek.html
├── sepet.html
├── ...
├── js\
│   ├── api-client.js   ← YENİ
│   ├── api-bridge.js   ← YENİ
│   ├── anasayfa.js
│   └── ...
└── backend\
    ├── api\
    ├── config\
    │   ├── schema.sql  ← Veritabanı şeması
    │   ├── database.php
    │   └── app.php
    └── helpers\
```

---

## Adım 2 — Veritabanı Kurulumu

1. **XAMPP Control Panel** açın → Apache ve MySQL'i **Start** edin
2. Tarayıcıda **phpMyAdmin**'e gidin: `http://localhost/phpmyadmin`
3. Sol menüde **SQL** sekmesine tıklayın
4. `backend/config/schema.sql` dosyasının içeriğini kopyalayıp yapıştırın
5. **Çalıştır** butonuna tıklayın

> ✅ Bu işlem `modaica_db` veritabanını oluşturur, tüm tabloları kurar ve 42 örnek ürünü ekler.

---

## Adım 3 — Veritabanı Bağlantısı

`backend/config/database.php` dosyasını açın:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'modaica_db');
define('DB_USER', 'root');    // XAMPP varsayılanı
define('DB_PASS', '');        // XAMPP varsayılanı (şifre yok)
```

XAMPP'ta varsayılan `root` / şifresiz bağlantı çalışır, değiştirmenize gerek yok.

---

## Adım 4 — Siteyi Açın

Tarayıcıda: **`http://localhost/modaica/anasayfa.html`**

> ⚠️ `file://` protokolüyle açmayın! Backend API XAMPP üzerinden çalışır.

---

## API Endpoint'leri

| İşlem | URL |
|---|---|
| Kayıt | `POST /modaica/backend/api/auth/register` |
| Giriş | `POST /modaica/backend/api/auth/login` |
| Profil | `GET /modaica/backend/api/users/profile` |
| Ürünler | `GET /modaica/backend/api/products` |
| Sepet | `GET/POST /modaica/backend/api/cart` |
| Favoriler | `GET/POST /modaica/backend/api/favorites` |
| Siparişler | `GET /modaica/backend/api/orders` |
| Kategoriler | `GET /modaica/backend/api/categories` |
| Kuponlar | `POST /modaica/backend/api/coupons/validate` |
| Arama | `GET /modaica/backend/api/search?q=...` |

---

## Test Kupon Kodları

| Kod | İndirim |
|---|---|
| `HOSGELDIN20` | %20 indirim |
| `TECH10` | %10 indirim (min 2000₺) |
| `SPORLA` | %12 indirim |
| `BEAUTY15` | %15 indirim |
| `KARGO0` | Kargo bedava |

---

## Demo Hesaplar

| Rol | E-posta | Şifre |
|-----|---------|-------|
| Admin | admin@modaica.com | Admin1234! |
| Satıcı | nike@modaica.com | Vendor123! |
| Kullanıcı | ali@example.com | User1234! |

Admin paneli: `http://localhost/modaica/admin.html`
Satıcı girişi: `http://localhost/modaica/satici-giris.html`

---

## Sorun Giderme

**API çalışmıyor / "Sunucuya bağlanılamadı"**
→ XAMPP Apache ve MySQL çalıştığından emin olun

**Ürünler görünmüyor (API bağlantısı var)**
→ phpMyAdmin'de `modaica_db > products` tablosunda kayıt olup olmadığını kontrol edin

**Login çalışmıyor**
→ `schema.sql`'in doğru çalıştırıldığını ve `users` tablosunun oluştuğunu kontrol edin

**CORS hatası**
→ Sitenin `http://localhost/modaica/` üzerinden açıldığından emin olun
