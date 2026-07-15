<?php
// ============================================================
//  MODAICA — JWT Yardımcıları
// ============================================================
function b64e(string $d): string { return rtrim(strtr(base64_encode($d), '+/', '-_'), '='); }
function b64d(string $d): string { return base64_decode(strtr($d, '-_', '+/')); }

function jwtCreate(array $payload): string {
    $h  = b64e(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload['iat'] = time();
    $payload['exp'] = time() + JWT_EXPIRE;
    $b  = b64e(json_encode($payload));
    $s  = b64e(hash_hmac('sha256', "$h.$b", JWT_SECRET, true));
    return "$h.$b.$s";
}

function jwtVerify(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$h, $b, $s] = $parts;
    if (!hash_equals(b64e(hash_hmac('sha256', "$h.$b", JWT_SECRET, true)), $s)) return null;
    $payload = json_decode(b64d($b), true);
    if (!$payload || $payload['exp'] < time()) return null;
    return $payload;
}

function getTokenFromHeader(): ?string {
    $auth = $_SERVER['HTTP_AUTHORIZATION']
         ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
         ?? (function_exists('apache_request_headers') ? (apache_request_headers()['Authorization'] ?? '') : '')
         ?? '';
    if (str_starts_with($auth, 'Bearer ')) return substr($auth, 7);
    // Apache some configs
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        if (str_starts_with($auth, 'Bearer ')) return substr($auth, 7);
    }
    return null;
}

function getTokenFromCookie(): ?string {
    $name = defined('COOKIE_NAME') ? COOKIE_NAME : 'modaica_auth';
    return isset($_COOKIE[$name]) && $_COOKIE[$name] !== '' ? $_COOKIE[$name] : null;
}

function setAuthCookie(string $token): void {
    setcookie(
        defined('COOKIE_NAME') ? COOKIE_NAME : 'modaica_auth',
        $token,
        [
            'expires'  => time() + (defined('JWT_EXPIRE') ? JWT_EXPIRE : 604800),
            'path'     => defined('COOKIE_PATH') ? COOKIE_PATH : '/',
            'secure'   => defined('COOKIE_SECURE') ? COOKIE_SECURE : false,
            'httponly' => true,
            'samesite' => defined('COOKIE_SAMESITE') ? COOKIE_SAMESITE : 'Strict',
        ]
    );
}

function clearAuthCookie(): void {
    $name = defined('COOKIE_NAME') ? COOKIE_NAME : 'modaica_auth';
    setcookie($name, '', ['expires' => time() - 3600, 'path' => defined('COOKIE_PATH') ? COOKIE_PATH : '/', 'httponly' => true, 'samesite' => 'Strict']);
}

// ── Alias'lar (auth.php eski çağrılar için) ────────────────
function generateJWT(array $payload): string { return jwtCreate($payload); }
function verifyJWT(string $token): ?array    { return jwtVerify($token);   }
