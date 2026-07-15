<?php
// ============================================================
//  MODAICA — Favorites API
//  GET    /api/favorites            → Favorileri listele
//  POST   /api/favorites            → Favori ekle
//  DELETE /api/favorites/{id}       → Favori kaldır
//  POST   /api/favorites/toggle     → Ekle/Kaldır (toggle)
//  GET    /api/favorites/check/{id} → Favori mi?
// ============================================================
require_once __DIR__.'/../../middleware/auth.php';
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$action = $parts[4] ?? ''; // toggle | check | {product_id}

// ── LİSTE ────────────────────────────────────────────────────
if ($method === 'GET' && !$action) {
    $page  = max(1, (int)($_GET['page'] ?? 1));
    $limit = (int)($_GET['limit'] ?? 20);
    $result = paginate($db,
        'SELECT * FROM favorites WHERE user_id=? ORDER BY created_at DESC',
        'SELECT COUNT(*) FROM favorites WHERE user_id=?',
        [$CURRENT_USER_ID], $page, $limit
    );
    ok('Favoriler.', $result);
}

// ── FAVORİ Mİ? ───────────────────────────────────────────────
if ($method === 'GET' && $action === 'check') {
    $pid  = $parts[5] ?? '';
    if (!$pid) badRequest('product_id zorunludur.');
    $chk  = $db->prepare('SELECT id FROM favorites WHERE user_id=? AND product_id=?');
    $chk->execute([$CURRENT_USER_ID, $pid]);
    $fav  = $chk->fetch();
    ok('Kontrol edildi.', ['is_favorite' => (bool)$fav, 'product_id' => $pid]);
}

// ── EKLE ─────────────────────────────────────────────────────
if ($method === 'POST' && !$action) {
    $b   = getBody();
    $pid = clean($b['product_id'] ?? '');
    if (!$pid || empty($b['product_name'])) badRequest('product_id ve product_name zorunludur.');

    $chk = $db->prepare('SELECT id FROM favorites WHERE user_id=? AND product_id=?');
    $chk->execute([$CURRENT_USER_ID, $pid]);
    if ($chk->fetch()) ok('Zaten favorilerde.', ['already_exists' => true]);

    $db->prepare('INSERT INTO favorites (user_id,product_id,product_name,product_price,product_emoji,product_cat,product_brand) VALUES (?,?,?,?,?,?,?)')
       ->execute([$CURRENT_USER_ID, $pid, clean($b['product_name']),
                  (float)($b['product_price'] ?? 0), clean($b['product_emoji'] ?? '🛍️'),
                  clean($b['product_cat'] ?? ''), clean($b['product_brand'] ?? '')]);
    created('Favorilere eklendi.', ['product_id' => $pid]);
}

// ── TOGGLE ───────────────────────────────────────────────────
if ($method === 'POST' && $action === 'toggle') {
    $b   = getBody();
    $pid = clean($b['product_id'] ?? '');
    if (!$pid) badRequest('product_id zorunludur.');

    $chk = $db->prepare('SELECT id FROM favorites WHERE user_id=? AND product_id=?');
    $chk->execute([$CURRENT_USER_ID, $pid]);
    $existing = $chk->fetch();

    if ($existing) {
        $db->prepare('DELETE FROM favorites WHERE id=?')->execute([$existing['id']]);
        ok('Favorilerden kaldırıldı.', ['is_favorite' => false, 'product_id' => $pid]);
    } else {
        if (empty($b['product_name'])) badRequest('product_name zorunludur.');
        $db->prepare('INSERT INTO favorites (user_id,product_id,product_name,product_price,product_emoji,product_cat,product_brand) VALUES (?,?,?,?,?,?,?)')
           ->execute([$CURRENT_USER_ID, $pid, clean($b['product_name']),
                      (float)($b['product_price'] ?? 0), clean($b['product_emoji'] ?? '🛍️'),
                      clean($b['product_cat'] ?? ''), clean($b['product_brand'] ?? '')]);
        ok('Favorilere eklendi.', ['is_favorite' => true, 'product_id' => $pid]);
    }
}

// ── TÜMÜNÜ TEMİZLE ───────────────────────────────────────────
if ($method === 'DELETE' && $action === 'clear') {
    $d = $db->prepare('DELETE FROM favorites WHERE user_id=?');
    $d->execute([$CURRENT_USER_ID]);
    ok('Favoriler temizlendi.', ['deleted' => $d->rowCount()]);
}

// ── SİL ──────────────────────────────────────────────────────
if ($method === 'DELETE' && $action) {
    $d = $db->prepare('DELETE FROM favorites WHERE user_id=? AND product_id=?');
    $d->execute([$CURRENT_USER_ID, $action]);
    if (!$d->rowCount()) notFound('Favoride bu ürün yok.');
    ok('Favorilerden kaldırıldı.', ['product_id' => $action]);
}

respond(false, 'Geçersiz endpoint.', [], 404);
