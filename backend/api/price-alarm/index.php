<?php
// ============================================================
//  MODAICA — Fiyat Alarm API
//  GET    /api/price-alarm              → Alarmları listele
//  POST   /api/price-alarm              → Alarm kur
//  DELETE /api/price-alarm/{product_id} → Alarm kaldır
// ============================================================
require_once __DIR__.'/../../middleware/auth.php';
require_once __DIR__.'/../../helpers/validate.php';
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$pid    = $parts[4] ?? '';

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
        'SELECT pa.id, pa.product_id, pa.target_price, p.sku, p.name, p.price, p.emoji
         FROM price_alarms pa JOIN products p ON p.id=pa.product_id
         WHERE pa.user_id=? AND pa.notified=0 ORDER BY pa.created_at DESC'
    );
    $stmt->execute([$CURRENT_USER_ID]);
    ok('Fiyat alarmları.', ['alarms' => $stmt->fetchAll()]);
}

// ── ALARM KUR ─────────────────────────────────────────────────
if ($method === 'POST') {
    $b           = getBody();
    $intId       = resolveProductId($db, (string)($b['product_id'] ?? ''));
    $targetPrice = (float)($b['target_price'] ?? 0);
    if (!$intId)          badRequest('Geçerli product_id zorunludur.');
    if ($targetPrice <= 0) badRequest('Hedef fiyat 0\'dan büyük olmalı.');

    $chkP = $db->prepare('SELECT price FROM products WHERE id=?');
    $chkP->execute([$intId]);
    $prod = $chkP->fetch();
    if (!$prod) notFound('Ürün bulunamadı.');
    if ($targetPrice >= (float)$prod['price']) respond(false, 'Hedef fiyat mevcut fiyattan düşük olmalı.', [], 400);

    // Var olan alarmı güncelle
    $chk = $db->prepare('SELECT id FROM price_alarms WHERE user_id=? AND product_id=? AND notified=0');
    $chk->execute([$CURRENT_USER_ID, $intId]);
    if ($chk->fetch()) {
        $db->prepare('UPDATE price_alarms SET target_price=? WHERE user_id=? AND product_id=? AND notified=0')
           ->execute([$targetPrice, $CURRENT_USER_ID, $intId]);
        ok('Alarm güncellendi.', ['target_price' => $targetPrice]);
    }

    $db->prepare('INSERT INTO price_alarms (user_id, product_id, target_price) VALUES (?,?,?)')->execute([$CURRENT_USER_ID, $intId, $targetPrice]);
    created('Fiyat alarmı kuruldu.', ['alarm_id' => (int)$db->lastInsertId(), 'target_price' => $targetPrice]);
}

// ── ALARM KALDIR ──────────────────────────────────────────────
if ($method === 'DELETE' && $pid) {
    $intId = resolveProductId($db, $pid);
    if (!$intId) badRequest('Geçerli product_id zorunludur.');
    $d = $db->prepare('DELETE FROM price_alarms WHERE user_id=? AND product_id=?');
    $d->execute([$CURRENT_USER_ID, $intId]);
    if (!$d->rowCount()) notFound('Alarm bulunamadı.');
    ok('Alarm kaldırıldı.');
}

respond(false, 'Geçersiz endpoint.', [], 404);
