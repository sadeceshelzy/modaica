<?php
// ============================================================
//  MODAICA — Orders API
//  GET  /api/orders                  → Sipariş listesi
//  GET  /api/orders/{code}           → Sipariş detayı
//  GET  /api/orders/track?code=      → Sipariş takip (anonim)
//  POST /api/orders/{code}/cancel    → İptal
// ============================================================
require_once __DIR__.'/../../config/app.php';
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../helpers/jwt.php';
require_once __DIR__.'/../../helpers/response.php';
setCORSHeaders();

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
// [0]=modaica [1]=backend [2]=api [3]=orders [4]=code [5]=action
$code   = $parts[4] ?? '';
$action = $parts[5] ?? '';

// Opsiyonel auth — track hariç tüm rotalar için zorunlu
$tok             = getTokenFromHeader() ?? getTokenFromCookie();
$pay             = $tok ? jwtVerify($tok) : null;
$CURRENT_USER_ID = $pay ? (int)($pay['user_id'] ?? 0) : null;

// ── TAKİP (anonim erişim izinli) ─────────────────────────────
if ($method === 'GET' && $code === 'track') {
    $q = trim($_GET['code'] ?? '');
    if (!$q) badRequest('Sipariş kodu zorunludur.');

    // Sadece order_code ile ara — kullanıcı girişi gerekmez
    $stmt = $db->prepare(
        'SELECT o.order_code,o.status,o.cargo_type,o.cargo_tracking,o.created_at,
                o.total_amount,o.subtotal,o.discount_amount,o.cargo_fee,o.coupon_code,o.address_id,
                a.city,a.district
         FROM orders o
         LEFT JOIN addresses a ON o.address_id=a.id
         WHERE o.order_code=?'
    );
    $stmt->execute([$q]);
    $order = $stmt->fetch();
    if (!$order) notFound('Sipariş bulunamadı.');

    $items = $db->prepare('SELECT product_name,product_emoji,quantity,unit_price,size,color FROM order_items WHERE order_id=(SELECT id FROM orders WHERE order_code=?)');
    $items->execute([$q]);
    ok('Sipariş takibi.', ['order' => $order, 'items' => $items->fetchAll()]);
}

// Bundan sonraki tüm rotalar giriş gerektirir
if (!$CURRENT_USER_ID) unauthorized();

// ── LİSTE ────────────────────────────────────────────────────
if ($method === 'GET' && !$code) {
    $status = $_GET['status'] ?? '';
    $page   = max(1, (int)($_GET['page'] ?? 1));
    $where  = ['user_id=?'];
    $params = [$CURRENT_USER_ID];
    if ($status && in_array($status, ['pending','preparing','shipping','delivered','cancelled'])) {
        $where[] = 'status=?'; $params[] = $status;
    }
    $wSql   = implode(' AND ', $where);
    $result = paginate($db,
        "SELECT id,order_code,status,subtotal,discount_amount,cargo_fee,total_amount,cargo_type,cargo_tracking,coupon_code,created_at FROM orders WHERE $wSql ORDER BY created_at DESC",
        "SELECT COUNT(*) FROM orders WHERE $wSql",
        $params, $page, 10
    );
    ok('Siparişler.', $result);
}

// ── DETAY ────────────────────────────────────────────────────
if ($method === 'GET' && $code && $action !== 'cancel') {
    $stmt = $db->prepare(
        'SELECT o.*,a.title as addr_title,a.full_name,a.phone as addr_phone,a.city,a.district,a.neighborhood,a.address_line,a.zip_code
         FROM orders o LEFT JOIN addresses a ON o.address_id=a.id
         WHERE o.order_code=? AND o.user_id=?'
    );
    $stmt->execute([$code, $CURRENT_USER_ID]);
    $order = $stmt->fetch();
    if (!$order) notFound('Sipariş bulunamadı.');

    $items = $db->prepare('SELECT oi.*,p.emoji FROM order_items oi LEFT JOIN products p ON oi.product_id=p.id WHERE oi.order_id=?');
    $items->execute([$order['id']]);

    ok('Sipariş detayı.', ['order' => $order, 'items' => $items->fetchAll()]);
}

// ── İPTAL ────────────────────────────────────────────────────
if ($method === 'POST' && $code && $action === 'cancel') {
    $stmt = $db->prepare('SELECT id,status FROM orders WHERE order_code=? AND user_id=?');
    $stmt->execute([$code, $CURRENT_USER_ID]);
    $order = $stmt->fetch();
    if (!$order) notFound('Sipariş bulunamadı.');
    if (!in_array($order['status'], ['pending', 'preparing'])) respond(false, 'Bu sipariş iptal edilemez. Durum: '.$order['status'], [], 400);

    $db->prepare('UPDATE orders SET status=? WHERE id=?')->execute(['cancelled', $order['id']]);

    $items = $db->prepare('SELECT product_id,quantity FROM order_items WHERE order_id=?');
    $items->execute([$order['id']]);
    foreach ($items->fetchAll() as $item) {
        $db->prepare('UPDATE products SET stock=stock+? WHERE id=?')->execute([$item['quantity'], $item['product_id']]);
    }

    ok('Sipariş iptal edildi.', ['order_code' => $code, 'new_status' => 'cancelled']);
}

respond(false, 'Geçersiz endpoint.', [], 404);
