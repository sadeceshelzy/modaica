<?php
// ============================================================
//  MODAICA — Merkezi Hata Sayfası
//  .htaccess: ErrorDocument 404/500 /modaica/backend/error.php
// ============================================================
header('Content-Type: application/json; charset=utf-8');

$code = (int)($_SERVER['REDIRECT_STATUS'] ?? http_response_code());
if ($code < 100 || $code > 599) $code = 500;
http_response_code($code);

$messages = [
    400 => 'Geçersiz istek.',
    401 => 'Giriş yapmanız gerekiyor.',
    403 => 'Bu kaynağa erişim yetkiniz yok.',
    404 => 'Aradığınız sayfa veya kaynak bulunamadı.',
    405 => 'Bu HTTP metodu desteklenmiyor.',
    429 => 'Çok fazla istek gönderildi. Lütfen bekleyin.',
    500 => 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.',
    503 => 'Servis geçici olarak kullanılamıyor.',
];

// Hata detayını logla
$logDir = __DIR__ . '/../logs';
if (!is_dir($logDir)) @mkdir($logDir, 0750, true);
$entry = sprintf(
    "[%s] HTTP %d  %s %s  IP:%s\n",
    date('Y-m-d H:i:s'),
    $code,
    $_SERVER['REQUEST_METHOD'] ?? 'GET',
    $_SERVER['REQUEST_URI']    ?? '/',
    $_SERVER['REMOTE_ADDR']    ?? '-'
);
@file_put_contents($logDir . '/http-errors.log', $entry, FILE_APPEND | LOCK_EX);

echo json_encode([
    'success' => false,
    'message' => $messages[$code] ?? "HTTP $code hatası.",
    'code'    => $code,
], JSON_UNESCAPED_UNICODE);
