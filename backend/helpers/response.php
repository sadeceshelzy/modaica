<?php
// ============================================================
//  MODAICA — JSON Yanıt Yardımcıları
// ============================================================

function respond(bool $success, string $message, array $data = [], int $code = 200): never {
    http_response_code($code);
    echo json_encode(
        ['success' => $success, 'message' => $message, 'data' => $data],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit;
}

function ok(string $message = 'OK', array $data = []): never       { respond(true,  $message, $data, 200); }
function created(string $msg, array $data = []): never              { respond(true,  $msg,     $data, 201); }
function badRequest(string $msg, array $data = []): never           { respond(false, $msg,     $data, 400); }
function unauthorized(string $msg = 'Giriş yapmanız gerekiyor.'): never { respond(false, $msg, [], 401); }
function forbidden(string $msg = 'Bu işlem için yetkiniz yok.'): never  { respond(false, $msg, [], 403); }
function notFound(string $msg = 'Kayıt bulunamadı.'): never         { respond(false, $msg,     [],   404); }
function conflict(string $msg): never                               { respond(false, $msg,     [],   409); }
function serverError(string $msg = 'Sunucu hatası.'): never         { respond(false, $msg,     [],   500); }

// ── Eski / Auth dosyasında kullanılan alias'lar ─────────────
function success(array $data = [], string $message = 'İşlem başarılı.'): never { ok($message, $data); }
function error(string $msg, int $code = 400): never { respond(false, $msg, [], $code); }

// ── Girdi temizleme & yardımcılar ───────────────────────────
function clean(string $v): string { return trim(htmlspecialchars($v, ENT_QUOTES, 'UTF-8')); }
function getBody(): array         { return json_decode(file_get_contents('php://input'), true) ?? []; }

// Alias (eski kod uyumluluğu)
function getRequestBody(): array { return getBody(); }

/**
 * Gerekli alanları kontrol et, eksikse 400 ile çık.
 */
function requireFields(array $body, array $fields): void {
    foreach ($fields as $f) {
        if (!isset($body[$f]) || (is_string($body[$f]) && trim($body[$f]) === '')) {
            error("'$f' alanı zorunludur.", 400);
        }
    }
}

/**
 * Benzersiz üye numarası üret: MDC-YYYYMMDD-XXXXX
 * Örnek: MDC-20260425-A3F9B
 */
function generateMemberNo(): string {
    return 'MDC-' . date('Ymd') . '-' . strtoupper(substr(uniqid('', true), -5));
}

/**
 * Sayfalanmış sorgu çalıştırır.
 * Kullanım:
 *   paginate($db, "SELECT * FROM t WHERE x=?", "SELECT COUNT(*) FROM t WHERE x=?", [$val], $page, $limit)
 */
function paginate(PDO $db, string $sql, string $countSql, array $params = [], int $page = 1, int $limit = 12): array {
    $page   = max(1, $page);
    $limit  = max(1, min(100, $limit));
    $offset = ($page - 1) * $limit;

    $countStmt = $db->prepare($countSql);
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $stmt = $db->prepare($sql . " LIMIT $limit OFFSET $offset");
    $stmt->execute($params);
    $items = $stmt->fetchAll();

    return [
        'items'       => $items,
        'total'       => $total,
        'page'        => $page,
        'limit'       => $limit,
        'total_pages' => max(1, (int)ceil($total / $limit)),
        'has_next'    => ($page * $limit) < $total,
        'has_prev'    => $page > 1,
    ];
}
