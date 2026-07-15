# Modaica — E-Ticaret Platformu (Yeterlilik Projesi)

Yeterlilik projesi olarak geliştirilen çok satıcılı (marketplace) e-ticaret web uygulaması.
Proje raporu: [`Modaica_YonlendirilmisCalisma.pdf`](Modaica_YonlendirilmisCalisma.pdf)

## Özellikler
- Ürün katalogu ve kategori sayfaları (kadın, erkek, elektronik, ev, kozmetik, spor)
- Kullanıcı hesabı: kayıt/giriş (JWT), favoriler, puan/tier sistemi (Bronze→Platinum)
- Sepet, çok adımlı ödeme (checkout), sipariş takibi, kupon
- Satıcı tarafı: başvuru, giriş, satıcı paneli; ayrıca admin paneli
- Akıllı arama ve chatbot ile ürün önerisi (bkz. [`AKILLI_OZELLIKLER.md`](AKILLI_OZELLIKLER.md))
- Fiyat/stok alarmı (cron), ürün soru-cevap ve yorumlar
- PWA: `manifest.json`, `service-worker.js`, offline sayfası

## Mimari
- **Frontend:** HTML · CSS · vanilla JavaScript (`js/`, `css/`, sayfa başına dosya)
- **Backend:** PHP REST API (`backend/api/*`), PDO + prepared statements, JWT auth,
  rate-limit middleware, rol bazlı yetkilendirme (kullanıcı/satıcı/admin)
- **Veritabanı:** MySQL — şema `database/modaica_schema.sql`, kurulum `database/KURULUM.md`

## Kurulum (XAMPP)
1. Depoyu `htdocs/modaica` altına kopyalayın.
2. phpMyAdmin'de `modaica_db` oluşturup `database/modaica_schema.sql` dosyasını çalıştırın.
3. Gerekirse `backend/config/database.php` bağlantı ayarlarını güncelleyin.
4. Chatbot için `backend/config/secrets.php` içine kendi Anthropic API anahtarınızı yazın
   (dosyadaki değer placeholder'dır; gerçek anahtarı commit etmeyin).
5. `http://localhost/modaica/anasayfa.html` adresini açın.

> **Güvenlik notu:** `backend/config/app.php` içindeki JWT secret yalnızca yerel geliştirme
> varsayılanıdır; gerçek ortamda `MODAICA_JWT_SECRET` ortam değişkeni ayarlanmalıdır.

## Teknolojiler
PHP · MySQL (PDO) · JavaScript · HTML/CSS · JWT · PWA
