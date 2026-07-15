<?php
// ============================================================
//  MODAICA — Cart API
//  GET    /api/cart              → Sepet + özet
//  POST   /api/cart              → Ürün ekle
//  PUT    /api/cart/{product_id} → Miktar güncelle
//  DELETE /api/cart/{product_id} → Ürün kaldır
//  DELETE /api/cart/clear        → Sepeti temizle
//  POST   /api/cart/coupon       → Kupon doğrula
//  POST   /api/cart/checkout     → Sipariş oluştur
// ============================================================
require_once __DIR__.'/../../middleware/auth.php';
require_once __DIR__.'/../../helpers/validate.php';
require_once __DIR__.'/../../middleware/rate-limit.php';
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
// [0]=modaica [1]=backend [2]=api [3]=cart [4]=action
$p1     = $parts[4] ?? ''; // clear | coupon | checkout | {product_id}

// ── HELPERS ──────────────────────────────────────────────────
function getCartItems(PDO $db, int $uid): array {
    $s = $db->prepare('SELECT * FROM cart_items WHERE user_id=? ORDER BY created_at ASC');
    $s->execute([$uid]);
    return $s->fetchAll();
}

function cartSummary(array $items, float $discPct = 0, string $coupon = ''): array {
    $sub     = (float)array_reduce($items, fn($c, $i) => $c + $i['product_price'] * $i['quantity'], 0);
    $disc    = $discPct > 0 ? round($sub * $discPct / 100, 2) : 0.0;
    $after   = $sub - $disc;
    $cargo   = $after >= 750 ? 0.0 : 39.90;
    return [
        'subtotal'     => round($sub, 2),
        'discount'     => $disc,
        'discount_pct' => $discPct,
        'coupon_code'  => $coupon,
        'cargo_fee'    => $cargo,
        'total'        => round($after + $cargo, 2),
        'item_count'   => (int)array_sum(array_column($items, 'quantity')),
        'free_cargo'   => $after >= 750,
    ];
}

function updateLoyaltyTier(PDO $db, int $uid): void {
    $s = $db->prepare('SELECT points FROM users WHERE id=?');
    $s->execute([$uid]);
    $pts = (int)$s->fetchColumn();
    $tier = $pts >= 5000 ? 'Platinum' : ($pts >= 2000 ? 'Gold' : ($pts >= 500 ? 'Silver' : 'Bronze'));
    $db->prepare('UPDATE users SET tier=? WHERE id=?')->execute([$tier, $uid]);
}

// ── SEPET GETİR ──────────────────────────────────────────────
if ($method === 'GET' && !$p1) {
    $items = getCartItems($db, $CURRENT_USER_ID);
    ok('Sepet.', ['items' => $items, 'summary' => cartSummary($items)]);
}

// ── ÜRÜN EKLE ────────────────────────────────────────────────
if ($method === 'POST' && !$p1) {
    rateLimit('cart-add', 30, 60); // dakikada max 30 ekleme
    $b     = getBody();
    $pid   = vString($b['product_id']   ?? '', 1, 100) ?? badRequest('Geçerli product_id zorunludur.');
    $name  = vString($b['product_name'] ?? '', 1, 200) ?? badRequest('Geçerli product_name zorunludur.');
    $price = vFloat($b['product_price'] ?? 0, 0.01, 999999) ?? badRequest('Geçerli fiyat girin.');
    $qty   = vInt($b['quantity'] ?? 1, 1, 99) ?? badRequest('Miktar 1-99 arasında olmalı.');
    $size  = vString($b['size']  ?? '', 0, 50)  ?? '';
    $color = vString($b['color'] ?? '', 0, 50)  ?? '';

    // Stok kontrolü
    $stk = $db->prepare('SELECT stock FROM products WHERE id=? AND is_active=1');
    $stk->execute([$pid]);
    $prd = $stk->fetch();
    if ($prd && $prd['stock'] < $qty) respond(false, 'Yeterli stok yok.', ['stock' => $prd['stock']], 400);

    // Mevcut sepet kalemi
    $chk = $db->prepare('SELECT id,quantity FROM cart_items WHERE user_id=? AND product_id=? AND COALESCE(size,"")=? AND COALESCE(color,"")=?');
    $chk->execute([$CURRENT_USER_ID, $pid, $size, $color]);
    $ex = $chk->fetch();
    if ($ex) {
        $nq = $ex['quantity'] + $qty;
        $db->prepare('UPDATE cart_items SET quantity=? WHERE id=?')->execute([$nq, $ex['id']]);
        ok('Miktar güncellendi.', ['cart_item_id' => $ex['id'], 'quantity' => $nq]);
    }

    $db->prepare('INSERT INTO cart_items (user_id,product_id,product_name,product_price,product_emoji,product_cat,product_brand,product_href,quantity,size,color) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
       ->execute([$CURRENT_USER_ID, $pid, $name, $price,
                  clean($b['product_emoji'] ?? '🛍️'), clean($b['product_cat']   ?? ''),
                  clean($b['product_brand'] ?? ''),   clean($b['product_href']   ?? ''),
                  $qty, $size ?: null, $color ?: null]);
    created('Sepete eklendi.', ['cart_item_id' => (int)$db->lastInsertId(), 'quantity' => $qty]);
}

// ── MİKTAR GÜNCELLE ──────────────────────────────────────────
if ($method === 'PUT' && $p1) {
    $qty = (int)(getBody()['quantity'] ?? 1);
    if ($qty < 1)  badRequest('Miktar en az 1 olmalı.');
    if ($qty > 99) badRequest('Miktar en fazla 99 olabilir.');
    $u = $db->prepare('UPDATE cart_items SET quantity=? WHERE user_id=? AND product_id=?');
    $u->execute([$qty, $CURRENT_USER_ID, $p1]);
    if (!$u->rowCount()) notFound('Sepette bu ürün yok.');
    ok('Miktar güncellendi.', ['product_id' => $p1, 'quantity' => $qty]);
}

// ── SEPET TEMİZLE ────────────────────────────────────────────
if ($method === 'DELETE' && $p1 === 'clear') {
    $d = $db->prepare('DELETE FROM cart_items WHERE user_id=?');
    $d->execute([$CURRENT_USER_ID]);
    ok('Sepet temizlendi.', ['deleted' => $d->rowCount()]);
}

// ── ÜRÜN KALDIR ──────────────────────────────────────────────
if ($method === 'DELETE' && $p1) {
    $d = $db->prepare('DELETE FROM cart_items WHERE user_id=? AND product_id=?');
    $d->execute([$CURRENT_USER_ID, $p1]);
    if (!$d->rowCount()) notFound('Sepette bu ürün yok.');
    ok('Ürün kaldırıldı.', ['product_id' => $p1]);
}

// ── KUPON DOĞRULA ────────────────────────────────────────────
if ($method === 'POST' && $p1 === 'coupon') {
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
    if ($c['max_uses'] && $c['used_count'] >= $c['max_uses'])     respond(false, 'Kupon kullanım limiti doldu.', [], 400);
    $minAmt = (float)($c['min_order_amount'] ?? $c['min_amount'] ?? 0);
    if ($sub < $minAmt) respond(false, "En az ₺$minAmt alışveriş gerekli.", [], 400);

    $discPctVal = $c['type'] === 'percent' ? (float)($c['value'] ?? $c['discount_pct'] ?? 0) : 0;
    $items   = getCartItems($db, $CURRENT_USER_ID);
    $summary = cartSummary($items, $discPctVal, $code);
    ok('Kupon uygulandı! 🎉', ['code' => $code, 'discount_pct' => (int)$discPctVal, 'summary' => $summary]);
}

// ── CHECKOUT ─────────────────────────────────────────────────
if ($method === 'POST' && $p1 === 'checkout') {
    rateLimit('checkout', 5, 60); // dakikada max 5 sipariş
    $b      = getBody();
    $coupon = strtoupper(trim($b['coupon_code'] ?? ''));
    $cargoT = clean($b['cargo_type'] ?? 'standard');
    $addrId = (int)($b['address_id'] ?? 0);
    $notes  = clean($b['notes'] ?? '');
    $items  = getCartItems($db, $CURRENT_USER_ID);

    if (!$items) badRequest('Sepetiniz boş.');

    // Adres kontrolü
    if ($addrId) {
        $ac = $db->prepare('SELECT id FROM addresses WHERE id=? AND user_id=?');
        $ac->execute([$addrId, $CURRENT_USER_ID]);
        if (!$ac->fetch()) badRequest('Geçersiz adres.');
    }

    // Kargo ücretleri
    $cargoFees = ['standard' => 39.90, 'fast' => 59.90, 'sameday' => 99.90];
    $cargoFee  = $cargoFees[$cargoT] ?? 39.90;

    // Kupon
    $discPct = 0;
    if ($coupon) {
        $cs = $db->prepare('SELECT type,value,is_active,expires_at,max_uses,used_count,min_order_amount FROM coupons WHERE code=?');
        $cs->execute([$coupon]);
        $cr = $cs->fetch();
        if ($cr && $cr['is_active'] && (!$cr['expires_at'] || strtotime($cr['expires_at']) >= time()) && (!$cr['max_uses'] || $cr['used_count'] < $cr['max_uses'])) {
            $discPct = $cr['type'] === 'percent' ? (int)$cr['value'] : 0;
            $db->prepare('UPDATE coupons SET used_count=used_count+1 WHERE code=?')->execute([$coupon]);
        }
    }

    $sub       = (float)array_reduce($items, fn($c, $i) => $c + $i['product_price'] * $i['quantity'], 0);
    $disc      = round($sub * $discPct / 100, 2);
    $afterDisc = $sub - $disc;
    $actualCargo = ($afterDisc >= 750 && $cargoT === 'standard') ? 0.0 : $cargoFee;
    $total     = round($afterDisc + $actualCargo, 2);
    $orderCode = 'ORD-'.strtoupper(substr(md5(uniqid('', true)), 0, 8));

    // Sipariş oluştur
    $db->prepare('INSERT INTO orders (user_id,order_code,status,subtotal,discount_amount,coupon_code,cargo_fee,cargo_type,total_amount,address_id,note) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
       ->execute([$CURRENT_USER_ID, $orderCode, 'pending', round($sub, 2), $disc,
                  $coupon ?: null, $actualCargo, $cargoT, $total, $addrId ?: null, $notes ?: null]);
    $orderId = (int)$db->lastInsertId();

    // Kalemler + satıcı satışları
    $oi = $db->prepare('INSERT INTO order_items (order_id,product_id,product_name,product_emoji,unit_price,quantity,size,color) VALUES (?,?,?,?,?,?,?,?)');
    $vs = $db->prepare('INSERT INTO vendor_sales (vendor_id,order_id,order_item_id,product_id,product_name,quantity,unit_price,gross_amount,commission,net_amount) VALUES (?,?,?,?,?,?,?,?,?,?)');

    foreach ($items as $item) {
        $oi->execute([$orderId, $item['product_id'], $item['product_name'], $item['product_emoji'],
                      $item['product_price'], $item['quantity'], $item['size'], $item['color']]);
        $itemId = (int)$db->lastInsertId();

        // Stok düş
        $db->prepare('UPDATE products SET stock=GREATEST(0,stock-?) WHERE id=?')->execute([$item['quantity'], $item['product_id']]);
        // Satış sayacı artır
        $db->prepare('UPDATE products SET sale_count=sale_count+? WHERE id=?')->execute([$item['quantity'], $item['product_id']]);

        // Satıcı satışı kaydet
        $prd = $db->prepare('SELECT vendor_id FROM products WHERE id=?');
        $prd->execute([$item['product_id']]);
        $prdRow = $prd->fetch();
        if ($prdRow && $prdRow['vendor_id']) {
            $vnd = $db->prepare('SELECT commission_rate FROM vendors WHERE id=?');
            $vnd->execute([$prdRow['vendor_id']]);
            $vndRow = $vnd->fetch();
            $commRate  = (float)($vndRow['commission_rate'] ?? 10);
            $gross     = round($item['product_price'] * $item['quantity'], 2);
            $commission = round($gross * $commRate / 100, 2);
            $net       = $gross - $commission;
            $vs->execute([$prdRow['vendor_id'], $orderId, $itemId, $item['product_id'], $item['product_name'], $item['quantity'], $item['product_price'], $gross, $commission, $net]);
            // Satıcı bakiye güncelle
            $db->prepare('UPDATE vendors SET balance=balance+?,total_earned=total_earned+? WHERE id=?')->execute([$net, $net, $prdRow['vendor_id']]);
        }
    }

    // Puan kazan (her 100₺ = 1 puan)
    $earnedPts = (int)($total / 100);
    if ($earnedPts > 0) {
        $db->prepare('UPDATE users SET points=points+? WHERE id=?')->execute([$earnedPts, $CURRENT_USER_ID]);
        try { $db->prepare('INSERT INTO points_log (user_id,amount,type,description) VALUES (?,?,?,?)')->execute([$CURRENT_USER_ID, $earnedPts, 'earn', "Sipariş $orderCode"]); } catch (\Throwable $e) {}
        updateLoyaltyTier($db, $CURRENT_USER_ID);
    }

    // Sepeti temizle
    $db->prepare('DELETE FROM cart_items WHERE user_id=?')->execute([$CURRENT_USER_ID]);

    ok('Siparişiniz alındı! 🎉', [
        'order_id'   => $orderId,
        'order_code' => $orderCode,
        'total'      => $total,
        'earned_pts' => $earnedPts,
    ]);
}

respond(false, 'Desteklenmeyen istek.', [], 405);
