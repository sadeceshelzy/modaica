# MODAICA — Backend Kurulum

## Gereksinimler
- PHP 8.1+
- MySQL 5.7+ / MariaDB 10.3+
- Apache (mod_rewrite)

## Kurulum

### 1. Dosyaları yerleştir
```
C:\xampp\htdocs\modaica\
├── .htaccess          ← bu klasördeki .htaccess
├── api/               ← tüm API klasörleri
├── config/            ← app.php, database.php
├── helpers/           ← jwt.php, response.php
├── middleware/        ← auth.php
└── panel/backend/     ← admin-api + vendor-api
```

### 2. Veritabanını kur
phpMyAdmin > SQL sekmesi > `config/schema.sql` içeriğini yapıştır > Çalıştır

### 3. (Opsiyonel) Ayarları düzenle
`config/database.php` → DB_HOST, DB_USER, DB_PASS
`config/app.php` → JWT_SECRET, ALLOWED_ORIGINS

## Varsayılan Hesaplar
| Rol          | E-posta               | Şifre      |
|--------------|-----------------------|------------|
| Admin        | admin@modaica.com     | Admin1234! |
| Demo Satıcı  | nike@modaica.com      | Vendor123! |
| Demo Kullanıcı | ali@example.com     | User1234!  |

## API Endpoint'leri

### Site API'leri
| Endpoint                     | Açıklama              |
|------------------------------|-----------------------|
| POST /api/auth/register      | Kayıt                 |
| POST /api/auth/login         | Giriş                 |
| GET  /api/auth/me            | Kullanıcı bilgisi     |
| GET  /api/products           | Ürün listesi          |
| GET  /api/products/{sku}     | Ürün detayı           |
| GET  /api/products/featured  | Öne çıkanlar          |
| GET  /api/categories         | Kategoriler           |
| GET  /api/favorites          | Favoriler             |
| POST /api/favorites/toggle   | Favori ekle/çıkar     |
| GET  /api/cart               | Sepet                 |
| POST /api/cart               | Sepete ekle           |
| POST /api/cart/checkout      | Sipariş oluştur       |
| GET  /api/orders             | Siparişler            |
| POST /api/reviews            | Yorum ekle            |
| GET  /api/search?q=          | Arama                 |

### Panel API'leri
| Endpoint                     | Açıklama              |
|------------------------------|-----------------------|
| POST /admin-api/auth/login   | Admin girişi          |
| GET  /admin-api/dashboard    | Dashboard             |
| GET  /admin-api/products     | Ürün yönetimi         |
| GET  /admin-api/orders       | Sipariş yönetimi      |
| GET  /admin-api/vendors      | Satıcı yönetimi       |
| POST /vendor-api/auth/login  | Satıcı girişi         |
| POST /vendor-api/auth/register | Satıcı başvurusu    |
| GET  /vendor-api/dashboard   | Satıcı dashboard      |
