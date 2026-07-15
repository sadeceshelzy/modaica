<?php
// ============================================================
//  MODAICA — Rate Limiting Middleware
//  Dosya tabanlı, MySQL gerektirmez.
//  Kullanım:
//    rateLimit('login',    5,  60);   // 60s'de max 5 istek
//    rateLimit('register', 3, 300);   // 5 dk'da max 3 istek
//    rateLimit('ai-chat',  15, 60);   // 60s'de max 15 istek
// ============================================================

function rateLimit(string $action, int $maxRequests = 30, int $windowSeconds = 60): void {
    $ip  = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $key = md5($action . '|' . $ip);
    $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'modaica_rl';

    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }

    $file = $dir . DIRECTORY_SEPARATOR . $key . '.json';
    $now  = time();
    $hits = [];

    if (file_exists($file)) {
        $raw = @file_get_contents($file);
        $hits = $raw ? (json_decode($raw, true) ?? []) : [];
    }

    // Pencere dışına çıkan kayıtları at
    $hits = array_values(array_filter($hits, fn(int $t) => $t > $now - $windowSeconds));

    if (count($hits) >= $maxRequests) {
        $retryAfter = $windowSeconds - ($now - min($hits));
        header('Retry-After: ' . max(1, $retryAfter));
        header('X-RateLimit-Limit: ' . $maxRequests);
        header('X-RateLimit-Remaining: 0');
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'message' => "Çok fazla istek. $retryAfter saniye sonra tekrar deneyin.",
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $hits[] = $now;
    @file_put_contents($file, json_encode($hits), LOCK_EX);

    $remaining = $maxRequests - count($hits);
    header('X-RateLimit-Limit: ' . $maxRequests);
    header('X-RateLimit-Remaining: ' . $remaining);
}
