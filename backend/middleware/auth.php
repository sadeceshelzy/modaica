<?php
// ============================================================
//  MODAICA — Auth Middleware
//  Kullanım:
//    $user = requireAuth();           // Token zorunlu, 401 verirse durur
//    $user = requireAuth(false);      // Token opsiyonel, null dönebilir
// ============================================================
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/jwt.php';
require_once __DIR__ . '/../helpers/response.php';

setCORSHeaders();

/**
 * Token doğrula. $required=true ise yetkisiz isteklerde 401 döner ve çıkar.
 * @return array{id:int,email:string,...}|null
 */
function requireAuth(bool $required = true): ?array {
    // Önce Authorization header, yoksa HttpOnly cookie dene
    $token   = getTokenFromHeader() ?? getTokenFromCookie();
    $payload = $token ? jwtVerify($token) : null;

    if (!$payload || !isset($payload['user_id'])) {
        if ($required) unauthorized();
        return null;
    }

    return [
        'id'    => (int)$payload['user_id'],
        'email' => $payload['email'] ?? '',
    ];
}

// Eski kod uyumluluğu için global set (bazı dosyalar doğrudan include eder)
$_token   = getTokenFromHeader() ?? getTokenFromCookie();
$_payload = $_token ? jwtVerify($_token) : null;
$CURRENT_USER_ID = isset($_payload['user_id']) ? (int)$_payload['user_id'] : null;
if (!$CURRENT_USER_ID) unauthorized();
