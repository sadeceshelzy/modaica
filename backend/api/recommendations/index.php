<?php
// ============================================================
//  MODAICA — Kişiselleştirilmiş Ürün Öneri API
//  GET /api/recommendations/also-bought?product_id=
//  GET /api/recommendations/trending?department=
//  GET /api/recommendations/for-you
//  GET /api/recommendations/recently-viewed?skus=
//  GET /api/recommendations/similar?product_id=
// ============================================================
require_once __DIR__.'/../../config/app.php';
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../helpers/jwt.php';
require_once __DIR__.'/../../helpers/response.php';
setCORSHeaders();

$db    = getDB();
$parts = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$sub   = $parts[4] ?? ''; // also-bought | trending | for-you | recently-viewed | similar

// Auth opsiyonel
$tok = getTokenFromHeader();
$pay = $tok ? jwtVerify($tok) : null;
$uid = $pay['user_id'] ?? null;

$limit = min(12, (int)($_GET['limit'] ?? 8));

// Ürün formatla
function fmtProduct(array $p): array {
    return [
        'sku'          => $p['sku'],
        'name'         => $p['name'],
        'brand'        => $p['brand'] ?? '',
        'price'        => (float)($p['price'] ?? 0),
        'old_price'    => $p['old_price'] ? (float)$p['old_price'] : null,
        'emoji'        => $p['emoji'] ?? '🛍️',
        'badge'        => $p['badge'] ?? null,
        'rating'       => (float)($p['avg_rating'] ?? 4.5),
        'review_count' => (int)($p['review_count'] ?? 0),
        'department'   => $p['department'] ?? '',
        'category_slug'=> $p['category_slug'] ?? '',
        'primary_image'=> $p['primary_image'] ?? null,
    ];
}

// ── BUNU ALANLAR ŞUNU DA ALDI ────────────────────────────────
if ($sub === 'also-bought') {
    $pid = trim($_GET['product_id'] ?? '');
    if (!$pid) badRequest('product_id gerekli.');

    // Resolve SKU to integer product ID
    $res = $db->prepare('SELECT id FROM products WHERE sku=?');
    $res->execute([$pid]);
    $pidRow = $res->fetch();
    if (!$pidRow) ok('Birlikte satın alınanlar.', ['items' => []]);
    $productIntId = (int)$pidRow['id'];

    // Collaborative filtering: aynı sepet/siparişte birlikte alınanlar
    $stmt = $db->prepare("
        SELECT
            p.sku,
            p.name, p.brand, p.price, p.old_price, p.emoji,
            p.badge, p.avg_rating, p.review_count, p.department, p.category_slug,
            (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=1 LIMIT 1) AS primary_image,
            COUNT(DISTINCT oi2.order_id) AS co_count
        FROM order_items oi1
        JOIN order_items oi2
            ON oi1.order_id = oi2.order_id
            AND oi2.product_id != oi1.product_id
        JOIN products p ON p.id = oi2.product_id AND p.is_active = 1 AND p.stock > 0
        WHERE oi1.product_id = ?
        GROUP BY oi2.product_id
        ORDER BY co_count DESC
        LIMIT ?
    ");
    $stmt->execute([$productIntId, $limit]);
    $results = $stmt->fetchAll();

    // Yeterli veri yoksa benzer kategoriden tamamla
    if (count($results) < 4) {
        $prod = $db->prepare('SELECT category_slug, department FROM products WHERE sku=?');
        $prod->execute([$pid]);
        $p = $prod->fetch();
        if ($p) {
            $existing = array_column($results, 'sku');
            $existing[] = $pid;
            $placeholders = implode(',', array_fill(0, count($existing), '?'));
            $fallback = $db->prepare("
                SELECT p.sku, p.name, p.brand, p.price, p.old_price, p.emoji,
                       p.badge, p.avg_rating, p.review_count, p.department, p.category_slug,
                       (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=1 LIMIT 1) AS primary_image
                FROM products p
                WHERE p.category_slug=? AND p.sku NOT IN ($placeholders) AND p.is_active=1 AND p.stock>0
                ORDER BY p.review_count DESC
                LIMIT ?
            ");
            $fallback->execute(array_merge([$p['category_slug']], $existing, [$limit - count($results)]));
            $results = array_merge($results, $fallback->fetchAll());
        }
    }

    ok('Birlikte satın alınanlar.', ['items' => array_map('fmtProduct', array_slice($results, 0, $limit))]);
}

// ── TREND ÜRÜNLER ────────────────────────────────────────────
if ($sub === 'trending') {
    $dept  = trim($_GET['department'] ?? '');
    $where = $dept ? "AND p.department=?" : "";
    $params = $dept ? [$dept, $limit] : [$limit];

    $stmt = $db->prepare("
        SELECT p.sku, p.name, p.brand, p.price, p.old_price, p.emoji,
               p.badge, p.avg_rating, p.review_count, p.department, p.category_slug,
               (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=1 LIMIT 1) AS primary_image,
               COUNT(oi.id) AS sold_7d,
               (COUNT(oi.id) * 0.6 + p.review_count * 0.3 + p.avg_rating * 2) AS score
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN orders o ON o.id = oi.order_id
            AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            AND o.status != 'cancelled'
        WHERE p.is_active = 1 AND p.stock > 0 {$where}
        GROUP BY p.sku
        ORDER BY score DESC
        LIMIT ?
    ");
    $stmt->execute($params);
    ok('Trend ürünler.', ['items' => array_map('fmtProduct', $stmt->fetchAll())]);
}

// ── SİZİN İÇİN ÖZEL ─────────────────────────────────────────
if ($sub === 'for-you') {
    if (!$uid) {
        // Misafir: featured ürünler
        $stmt = $db->query("
            SELECT p.sku, p.name, p.brand, p.price, p.old_price, p.emoji,
                   p.badge, p.avg_rating, p.review_count, p.department, p.category_slug,
                   (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=1 LIMIT 1) AS primary_image
            FROM products p
            WHERE p.is_active=1 AND p.is_featured=1 AND p.stock>0
            ORDER BY p.avg_rating DESC LIMIT 8
        ");
        ok('Önerilen ürünler.', ['items' => array_map('fmtProduct', $stmt->fetchAll()), 'personalized' => false]);
    }

    // Kullanıcının en çok alışveriş yaptığı 3 kategoriyi bul
    $cats = $db->prepare("
        SELECT p.category_slug, p.department, COUNT(*) AS cnt
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.user_id = ?
        JOIN products p ON p.id = oi.product_id
        WHERE o.status != 'cancelled'
        GROUP BY p.category_slug, p.department
        ORDER BY cnt DESC
        LIMIT 3
    ");
    $cats->execute([$uid]);
    $userCats = $cats->fetchAll();

    // Daha önce satın almadığı ürünleri getir
    $boughtSkus = $db->prepare("
        SELECT DISTINCT oi.product_id FROM order_items oi
        JOIN orders o ON o.id=oi.order_id WHERE o.user_id=?
    ");
    $boughtSkus->execute([$uid]);
    $bought = $boughtSkus->fetchAll(PDO::FETCH_COLUMN);

    if (empty($userCats)) {
        // Hiç sipariş yok → popüler ürünler
        $stmt = $db->query("
            SELECT p.sku, p.name, p.brand, p.price, p.old_price, p.emoji,
                   p.badge, p.avg_rating, p.review_count, p.department, p.category_slug,
                   (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=1 LIMIT 1) AS primary_image
            FROM products p WHERE p.is_active=1 AND p.stock>0
            ORDER BY p.review_count DESC LIMIT 8
        ");
        ok('Popüler ürünler.', ['items' => array_map('fmtProduct', $stmt->fetchAll()), 'personalized' => false]);
    }

    $catSlugs = array_column($userCats, 'category_slug');
    $catPh    = implode(',', array_fill(0, count($catSlugs), '?'));
    $excPh    = !empty($bought) ? 'AND p.id NOT IN (' . implode(',', array_fill(0, count($bought), '?')) . ')' : '';
    $params   = array_merge($catSlugs, $bought, [$limit]);

    $stmt = $db->prepare("
        SELECT p.sku, p.name, p.brand, p.price, p.old_price, p.emoji,
               p.badge, p.avg_rating, p.review_count, p.department, p.category_slug,
               (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=1 LIMIT 1) AS primary_image
        FROM products p
        WHERE p.category_slug IN ({$catPh}) AND p.is_active=1 AND p.stock>0 {$excPh}
        ORDER BY p.avg_rating DESC, RAND()
        LIMIT ?
    ");
    $stmt->execute($params);
    ok('Sizin için özel.', ['items' => array_map('fmtProduct', $stmt->fetchAll()), 'personalized' => true]);
}

// ── SON BAKILANLAR ───────────────────────────────────────────
if ($sub === 'recently-viewed') {
    $skusRaw = trim($_GET['skus'] ?? '');
    if (!$skusRaw) ok('Son bakılanlar.', ['items' => []]);
    $skus = array_filter(array_slice(explode(',', $skusRaw), 0, 10));
    if (empty($skus)) ok('Son bakılanlar.', ['items' => []]);
    $ph   = implode(',', array_fill(0, count($skus), '?'));
    $stmt = $db->prepare("
        SELECT p.sku, p.name, p.brand, p.price, p.old_price, p.emoji,
               p.badge, p.avg_rating, p.review_count, p.department, p.category_slug,
               (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=1 LIMIT 1) AS primary_image
        FROM products p WHERE p.sku IN ({$ph}) AND p.is_active=1
    ");
    $stmt->execute($skus);
    $rows    = $stmt->fetchAll();
    $indexed = [];
    foreach ($rows as $r) $indexed[$r['sku']] = $r;
    // Görüntülenme sırasını koru
    $ordered = [];
    foreach ($skus as $sku) { if (isset($indexed[$sku])) $ordered[] = $indexed[$sku]; }
    ok('Son bakılanlar.', ['items' => array_map('fmtProduct', $ordered)]);
}

// ── BENZER ÜRÜNLER ───────────────────────────────────────────
if ($sub === 'similar') {
    $pid = trim($_GET['product_id'] ?? '');
    if (!$pid) badRequest('product_id gerekli.');
    $prod = $db->prepare('SELECT category_slug, department, price FROM products WHERE sku=?');
    $prod->execute([$pid]);
    $p = $prod->fetch();
    if (!$p) notFound('Ürün bulunamadı.');

    $stmt = $db->prepare("
        SELECT p.sku, p.name, p.brand, p.price, p.old_price, p.emoji,
               p.badge, p.avg_rating, p.review_count, p.department, p.category_slug,
               (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=1 LIMIT 1) AS primary_image
        FROM products p
        WHERE p.category_slug=? AND p.sku!=? AND p.is_active=1 AND p.stock>0
        ORDER BY ABS(p.price - ?) ASC, p.avg_rating DESC
        LIMIT ?
    ");
    $stmt->execute([$p['category_slug'], $pid, $p['price'], $limit]);
    ok('Benzer ürünler.', ['items' => array_map('fmtProduct', $stmt->fetchAll())]);
}

respond(false, 'Geçersiz endpoint.', [], 404);
