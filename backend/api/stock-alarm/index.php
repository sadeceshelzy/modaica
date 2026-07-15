<?php
// ============================================================
//  MODAICA — Stok Alarm API
//  GET    /api/stock-alarm           → Alarmları listele
//  POST   /api/stock-alarm           → Alarm kur
//  DELETE /api/stock-alarm/{product_id} → Alarm kaldır
// ============================================================
require_once __DIR__.'/../../middleware/auth.php';
require_once __DIR__.'/../../helpers/validate.php';
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$pid    = $parts[4] ?? ''; // product_id (sku or numeric)

function resolveProductId(PDO $db, string $raw): int {
    if (is_numeric($raw)) return (int)$raw;
    $s = $db->prepare('SELECT id FROM products WHERE sku=?');
    $s->execute([trim($raw)]);
    $r = $s->fetch();
    return $r ? (int)$r['id'] : 0;
}

// ── LİSTE ────────────────────────────────────────────────────
if ($method === 'GET') {
    $stmt = $db->prepare(
        'SELECT sa.id, sa.product_id, p.sku, p.name, p.price, p.emoji, p.stock
         FROM stock_alarms sa JOIN products p ON p.id=sa.product_id
         WHERE sa.user_id=? ORDER BY sa.created_at DESC'
    );
    $stmt->execute([$CURRENT_USER_ID]);
    ok('Stok alarmları.', ['alarms' => $stmt->fetchAll()]);
}

// ── ALARM KUR ─────────────────────────────────────────────────
if ($method === 'POST') {
    $b    = getBody();
    $intId = resolveProductId($db, (string)($b['product_id'] ?? ''));
    if (!$intId) badRequest('Geçerli product_id zorunludur.');

    // Stok zaten var mı?
    $chkP = $db->prepare('SELECT stock FROM products WHERE id=?');
    $chkP->execute([$intId]);
    $prod = $chkP->fetch();
    if ($prod && $prod['stock'] > 0) respond(false, 'Ürün zaten stokta.', [], 400);

    // Zaten alarm var mı?
    $chk = $db->prepare('SELECT id FROM stock_alarms WHERE user_id=? AND product_id=?');
    $chk->execute([$CURRENT_USER_ID, $intId]);
    if ($chk->fetch()) ok('Alarm zaten kurulu.', ['already_set' => true]);

    $db->prepare('INSERT INTO stock_alarms (user_id, product_id) VALUES (?,?)')->execute([$CURRENT_USER_ID, $intId]);
    created('Stok alarmı kuruldu.', ['alarm_id' => (int)$db->lastInsertId()]);
}

// ── ALARM KALDIR ──────────────────────────────────────────────
if ($method === 'DELETE' && $pid) {
    $intId = resolveProductId($db, $pid);
    if (!$intId) badRequest('Geçerli product_id zorunludur.');
    $d = $db->prepare('DELETE FROM stock_alarms WHERE user_id=? AND product_id=?');
    $d->execute([$CURRENT_USER_ID, $intId]);
    if (!$d->rowCount()) notFound('Alarm bulunamadı.');
    ok('Alarm kaldırıldı.');
}

respond(false, 'Geçersiz endpoint.', [], 404);
