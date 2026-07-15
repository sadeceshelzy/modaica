<?php
// ============================================================
//  MODAICA — Coupons API (Public)
//  GET  /api/coupons             → Aktif kuponları listele (frontend CouponAPI.list())
//  GET  /api/coupons/active      → Aktif kampanya kuponları
//  POST /api/coupons/validate    → Kupon kodu doğrula
// ============================================================
require_once __DIR__.'/../../config/app.php';
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../helpers/response.php';
setCORSHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$action = $parts[4] ?? '';
$db     = getDB();

// ── KUPON LİSTESİ (frontend CouponAPI.list()) ────────────────
// GET /api/coupons  (action boş)
if ($method === 'GET' && $action === '') {
    $stmt = $db->query('SELECT code,type,value,min_order_amount,expires_at FROM coupons WHERE is_active=1 AND (expires_at IS NULL OR expires_at>NOW()) AND (max_uses IS NULL OR used_count<max_uses) ORDER BY value DESC LIMIT 10');
    ok('Aktif kuponlar.', ['coupons' => $stmt->fetchAll()]);
}

// ── AKTİF KUPONLAR ───────────────────────────────────────────
if ($method === 'GET' && $action === 'active') {
    $stmt = $db->query('SELECT code,type,value,min_order_amount,expires_at FROM coupons WHERE is_active=1 AND (expires_at IS NULL OR expires_at>NOW()) AND (max_uses IS NULL OR used_count<max_uses) ORDER BY value DESC LIMIT 10');
    ok('Aktif kuponlar.', ['coupons' => $stmt->fetchAll()]);
}

// ── KUPON DOĞRULA ────────────────────────────────────────────
if ($method === 'POST' && $action === 'validate') {
    $b    = getBody();
    $code = strtoupper(trim($b['code'] ?? ''));
    $sub  = (float)($b['subtotal'] ?? 0);
    if (!$code) badRequest('Kupon kodu boş.');

    $stmt = $db->prepare('SELECT * FROM coupons WHERE code=?');
    $stmt->execute([$code]);
    $c = $stmt->fetch();
    if (!$c)              respond(false, 'Geçersiz kupon kodu.', [], 404);
    if (!$c['is_active']) respond(false, 'Kupon aktif değil.', [], 400);
    if ($c['expires_at'] && strtotime($c['expires_at']) < time()) respond(false, 'Kupon süresi dolmuş.', [], 400);
    if ($c['max_uses'] && $c['used_count'] >= $c['max_uses']) respond(false, 'Kupon kullanım limiti doldu.', [], 400);
    $minAmt = (float)($c['min_order_amount'] ?? 0);
    if ($sub > 0 && $sub < $minAmt) respond(false, "En az ₺$minAmt alışveriş gerekli.", [], 400);

    $discPct    = $c['type'] === 'percent' ? (float)$c['value'] : 0;
    $discAmt    = $sub > 0 ? round($sub * $discPct / 100, 2) : 0;
    ok('Kupon geçerli! 🎉', [
        'code'            => $code,
        'type'            => $c['type'],
        'discount_pct'    => (int)$discPct,
        'discount_amount' => $discAmt,
        'min_order_amount'=> $minAmt,
    ]);
}

respond(false, 'Geçersiz endpoint.', [], 404);
