<?php
// ============================================================
//  MODAICA — Veritabanı Bağlantısı
//  Dosya: backend/config/database.php
//
//  !! Kendi bilgilerinizle güncelleyin !!
// ============================================================

// ── BAĞLANTI AYARLARI ────────────────────────────────────────
define('DB_HOST',    'localhost');
define('DB_PORT',    '3306');
define('DB_NAME',    'modaica_db');
define('DB_USER',    'root');       // XAMPP varsayılanı
define('DB_PASS',    '');           // XAMPP varsayılanı (boş)
define('DB_CHARSET', 'utf8mb4');

// ── UYGULAMA SABİTLERİ ──────────────────────────────────────
define('BCRYPT_COST',    12);
define('POINTS_RATE',   100);    // 100₺ = 1 puan
define('MAX_UPLOAD_SIZE', 2 * 1024 * 1024); // 2 MB

define('UPLOAD_DIR', __DIR__ . '/../../uploads/avatars/');
define('UPLOAD_URL', '/modaica/uploads/avatars/');
define('ALLOWED_TYPES', ['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// ── PDO SINGLETON ────────────────────────────────────────────
function getDB(): PDO {
    static $pdo = null;

    if ($pdo !== null) return $pdo;

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        DB_HOST, DB_PORT, DB_NAME, DB_CHARSET
    );

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE              => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE   => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES     => false,   // Gerçek prepared stmt — SQL injection'a karşı
            PDO::ATTR_PERSISTENT           => false,   // Bağlantı havuzu kapalı (XAMPP uyumu)
            PDO::ATTR_TIMEOUT              => 5,        // 5 sn bağlantı zaman aşımı
            PDO::MYSQL_ATTR_FOUND_ROWS     => true,
            PDO::MYSQL_ATTR_MULTI_STATEMENTS => false, // Çoklu statement yasak (injection zinciri engeli)
            // Charset'i bağlantı başlatılırken de zorla
            PDO::MYSQL_ATTR_INIT_COMMAND   => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO'",
        ]);
    } catch (PDOException $e) {
        http_response_code(503);
        header('Content-Type: application/json; charset=utf-8');
        // Hata detayını logla, kullanıcıya gösterme
        error_log('DB bağlantı hatası: ' . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Veritabanına bağlanılamadı. XAMPP\'ın çalıştığından ve modaica_db veritabanının oluşturulduğundan emin olun.',
            'debug'   => defined('APP_DEBUG') && APP_DEBUG ? $e->getMessage() : null,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    return $pdo;
}

// ── YARDIMCI: Tier hesapla ────────────────────────────────────
// Eşikler JS (hesabim.js) ile senkronize: Bronze/Silver/Gold/Platinum
function calcTier(int $points): string {
    if ($points >= 2500) return 'Platinum';
    if ($points >= 1000) return 'Gold';
    if ($points >= 500)  return 'Silver';
    return 'Bronze';
}
