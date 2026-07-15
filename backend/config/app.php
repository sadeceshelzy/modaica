<?php
// ============================================================
//  MODAICA — Uygulama Yapılandırması
// ============================================================

// ── PHP Hata Loglama ─────────────────────────────────────────
$_logDir = __DIR__ . '/../../logs';
if (!is_dir($_logDir)) @mkdir($_logDir, 0750, true);
ini_set('log_errors',    '1');
ini_set('error_log',     $_logDir . '/php-errors.log');
ini_set('display_errors', '0');  // Production: ekranda gösterme
error_reporting(E_ALL);
define('APP_DEBUG', (bool)(getenv('MODAICA_DEBUG') ?: false));

// ── JWT ──────────────────────────────────────────────────────
// GÜVENLİK UYARISI: Ortam değişkeni ayarlanmamışsa varsayılan (hardcoded) değer kullanılır.
// Production'a almadan önce MODAICA_JWT_SECRET ortam değişkenini güçlü, benzersiz bir
// değere ayarlayın (ör. openssl rand -hex 32).
define('JWT_SECRET', getenv('MODAICA_JWT_SECRET') ?: 'modaica_jwt_secret_2026_xK9mP3!#ZpQ8vL');
define('JWT_EXPIRE',  7 * 24 * 3600); // 7 gün

// Cookie ayarları
define('COOKIE_NAME',     'modaica_auth');
define('COOKIE_PATH',     '/modaica/');
define('COOKIE_SECURE',   isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
define('COOKIE_SAMESITE', 'Strict');

// İzin verilen origin'ler
// GÜVENLİK UYARISI: 'null' değeri file:// protokolü üzerinden (tarayıcıdan yerel dosya
// açarak) yapılan isteklere CORS izni verir. Bu yalnızca yerel geliştirme içindir.
// Production ortamında bu satırı listeden kaldırılacaktır.
define('ALLOWED_ORIGINS', [
    'http://localhost',
    'http://127.0.0.1',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:5500',
    'null', // SADECE local dev — production'da bu satırı silin!
]);

// CORS başlıkları
function setCORSHeaders(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = in_array($origin, ALLOWED_ORIGINS) ? $origin : 'http://localhost';
    header("Access-Control-Allow-Origin: $allowed");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Content-Type: application/json; charset=utf-8');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
