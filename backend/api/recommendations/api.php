<?php
// ============================================================
//  MODAICA — Öneri & Stok Alarm API
//  GET  /api/recommendations?product_id= → Benzer ürünler
//  GET  /api/recommendations/also-bought?product_id=
//  GET  /api/recommendations/trending
//  POST /api/stock-alarm  → Stok alarmı kur
//  DELETE /api/stock-alarm/{product_id} → Alarmı kaldır
// ============================================================
require_once __DIR__.'/../../config/app.php';
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../helpers/jwt.php';
require_once __DIR__.'/../../helpers/response.php';
setCORSHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$action = $parts[2] ?? ''; // 'recommendations' | 'stock-alarm'
$sub    = $parts[3] ?? ''; // 'also-bought' | 'trending' | {product_id}
$db     = getDB();

// Auth opsiyonel
$tok = getTokenFromHeader();
$pay = $tok ? jwtVerify($tok) : null;
$uid = $pay['user_id'] ?? null;

// ════════════════════════════════════════════════════════════
//  ÖNERİLER
// ════════════════════════════════════════════════════════════
if ($action === 'recommendations') {

  // Bunu alanlar şunu da aldı (collaborative filtering - basit)
  if ($sub === 'also-bought') {
    $pid   = trim($_GET['product_id'] ?? '');
    $limit = min(8, (int)($_GET['limit'] ?? 6));
    if (!$pid) badRequest('product_id gerekli.');

    // Bu ürünü alanların başka ne aldığını bul
    $stmt = $db->prepare("
      SELECT oi2.product_id as sku,
             MIN(p.name) as name, MIN(p.brand) as brand,
             MIN(p.price) as price, MIN(p.old_price) as old_price,
             MIN(p.emoji) as emoji, MIN(p.badge) as badge,
             MIN(p.rating) as rating, MIN(p.review_count) as review_count,
             COUNT(DISTINCT oi2.order_id) as co_purchase_count
      FROM order_items oi1
      JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi2.product_id != oi1.product_id
      JOIN products p ON p.sku = oi2.product_id AND p.is_active = 1
      WHERE oi1.product_id = ?
      GROUP BY oi2.product_id
      ORDER BY co_purchase_count DESC
      LIMIT ?
    ");
    $stmt->execute([$pid, $limit]);
    $results = $stmt->fetchAll();

    // Yeterli veri yoksa benzer ürünleri getir
    if (count($results) < 3) {
      $p = $db->prepare('SELECT category_slug, department FROM products WHERE sku=?');
      $p->execute([$pid]);
      $prod = $p->fetch();
      if ($prod) {
        $fallback = $db->prepare("SELECT sku,name,brand,price,old_price,emoji,badge,rating,review_count FROM products WHERE category_slug=? AND sku!=? AND is_active=1 ORDER BY review_count DESC LIMIT ?");
        $fallback->execute([$prod['category_slug'], $pid, $limit]);
        $results = array_merge($results, $fallback->fetchAll());
        $results = array_unique($results, SORT_REGULAR);
      }
    }

    ok('Birlikte satın alınanlar.', ['items' => array_slice($results, 0, $limit)]);
  }

  // Trending / Popüler
  if ($sub === 'trending') {
    $dept  = trim($_GET['department'] ?? '');
    $limit = min(12, (int)($_GET['limit'] ?? 8));
    $where = $dept ? "AND p.department=?" : '';
    $params = $dept ? [$dept, $limit] : [$limit];
    $stmt = $db->prepare("
      SELECT p.sku, p.name, p.brand, p.price, p.old_price, p.emoji, p.badge, p.rating, p.review_count,
             COUNT(oi.id) as sold_7d
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id=p.sku
      LEFT JOIN orders o ON o.id=oi.order_id AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      WHERE p.is_active=1 {$where}
      GROUP BY p.sku
      ORDER BY sold_7d DESC, p.review_count DESC
      LIMIT ?
    ");
    $stmt->execute($params);
    ok('Trend ürünler.', ['items' => $stmt->fetchAll()]);
  }

  // Son bakılanlar (localStorage'dan istemci tarafında yönetilir — burada sadece detay getirir)
  if ($sub === 'recently-viewed') {
    $skus = array_filter(explode(',', trim($_GET['skus'] ?? '')));
    if (empty($skus)) ok('Son bakılanlar.', ['items' => []]);
    $placeholders = implode(',', array_fill(0, count($skus), '?'));
    $stmt = $db->prepare("SELECT sku,name,brand,price,old_price,emoji,badge,rating,review_count FROM products WHERE sku IN ($placeholders) AND is_active=1");
    $stmt->execute($skus);
    ok('Son bakılanlar.', ['items' => $stmt->fetchAll()]);
  }

  // Sana özel (kullanıcı giriş yapmışsa geçmiş siparişe göre)
  if ($sub === 'for-you') {
    $limit = min(12, (int)($_GET['limit'] ?? 8));
    if (!$uid) {
      // Misafir → en popüler
      $stmt = $db->prepare("SELECT sku,name,brand,price,old_price,emoji,badge,rating,review_count FROM products WHERE is_active=1 ORDER BY review_count DESC LIMIT ?");
      $stmt->execute([$limit]);
      ok('Önerilen ürünler.', ['items' => $stmt->fetchAll()]);
    }
    // Kullanıcının departman tercihlerini bul
    $depts = $db->prepare("
      SELECT p.department, COUNT(*) as cnt
      FROM order_items oi
      JOIN orders o ON o.id=oi.order_id
      JOIN products p ON p.sku=oi.product_id
      WHERE o.user_id=?
      GROUP BY p.department ORDER BY cnt DESC LIMIT 2
    ");
    $depts->execute([$uid]);
    $userDepts = $depts->fetchAll(PDO::FETCH_COLUMN, 0);

    if (empty($userDepts)) {
      $stmt = $db->prepare("SELECT sku,name,brand,price,old_price,emoji,badge,rating,review_count FROM products WHERE is_active=1 AND is_featured=1 ORDER BY review_count DESC LIMIT ?");
      $stmt->execute([$limit]);
    } else {
      $placeholders = implode(',', array_fill(0, count($userDepts), '?'));
      $params = array_merge($userDepts, [$limit]);
      $stmt = $db->prepare("SELECT sku,name,brand,price,old_price,emoji,badge,rating,review_count FROM products WHERE is_active=1 AND department IN ($placeholders) ORDER BY review_count DESC, RAND() LIMIT ?");
      $stmt->execute($params);
    }
    ok('Sana özel öneriler.', ['items' => $stmt->fetchAll()]);
  }

  // Varsayılan → benzer ürünler
  $pid   = trim($_GET['product_id'] ?? '');
  $limit = min(8, (int)($_GET['limit'] ?? 6));
  if (!$pid) badRequest('product_id gerekli.');
  $p = $db->prepare('SELECT category_slug FROM products WHERE sku=?');
  $p->execute([$pid]);
  $prod = $p->fetch();
  if (!$prod) notFound();
  $stmt = $db->prepare("SELECT sku,name,brand,price,old_price,emoji,badge,rating,review_count FROM products WHERE category_slug=? AND sku!=? AND is_active=1 ORDER BY review_count DESC LIMIT ?");
  $stmt->execute([$prod['category_slug'], $pid, $limit]);
  ok('Benzer ürünler.', ['items' => $stmt->fetchAll()]);
}

// ════════════════════════════════════════════════════════════
//  STOK ALARM
// ════════════════════════════════════════════════════════════
if ($action === 'stock-alarm') {
  if (!$uid) unauthorized();

  if ($method === 'POST') {
    $b   = getBody();
    $pid = clean($b['product_id'] ?? '');
    if (!$pid) badRequest('product_id gerekli.');

    // Ürün stokta mı zaten?
    $p = $db->prepare('SELECT stock FROM products WHERE sku=? AND is_active=1');
    $p->execute([$pid]);
    $prod = $p->fetch();
    if (!$prod) notFound('Ürün bulunamadı.');
    if ($prod['stock'] > 0) ok('Ürün zaten stokta!', ['in_stock' => true]);

    // Alarm var mı?
    $chk = $db->prepare('SELECT id FROM stock_alarms WHERE user_id=? AND product_id=?');
    $chk->execute([$uid, $pid]);
    if ($chk->fetch()) ok('Alarm zaten kurulmuş.', ['already_set' => true]);

    // Alarm kaydet
    $db->prepare('INSERT INTO stock_alarms (user_id, product_id) VALUES (?,?)')
       ->execute([$uid, $pid]);
    ok('Stok alarmı kuruldu! Ürün stoka girince e-posta alacaksınız. 🔔');
  }

  if ($method === 'DELETE' && $sub) {
    $db->prepare('DELETE FROM stock_alarms WHERE user_id=? AND product_id=?')->execute([$uid, $sub]);
    ok('Stok alarmı kaldırıldı.');
  }

  if ($method === 'GET') {
    $stmt = $db->prepare("
      SELECT sa.product_id, sa.created_at, p.name, p.emoji, p.price, p.stock
      FROM stock_alarms sa
      JOIN products p ON p.sku=sa.product_id
      WHERE sa.user_id=?
      ORDER BY sa.created_at DESC
    ");
    $stmt->execute([$uid]);
    ok('Stok alarmlarım.', ['alarms' => $stmt->fetchAll()]);
  }
}

respond(false, 'Geçersiz endpoint.', [], 404);
