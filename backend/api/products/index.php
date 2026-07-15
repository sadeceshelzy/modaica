<?php
// ============================================================
//  MODAICA — Products API
//  GET /api/products                → Filtreli liste
//  GET /api/products/featured       → Öne çıkanlar
//  GET /api/products/popular        → Popüler
//  GET /api/products/new            → Yeni gelenler
//  GET /api/products/sale           → İndirimli
//  GET /api/products/search?q=      → Arama
//  GET /api/products/{sku}          → Detay
// ============================================================
require_once __DIR__.'/../../config/app.php';
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../helpers/jwt.php';
require_once __DIR__.'/../../helpers/response.php';
setCORSHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') respond(false, 'Sadece GET destekleniyor.', [], 405);

$parts = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$slug  = $parts[4] ?? ''; // /api/products/{slug}
$db    = getDB();

// ── ARAMA ────────────────────────────────────────────────────
if ($slug === 'search') {
    $q = trim($_GET['q'] ?? '');
    if (strlen($q) < 2) badRequest('En az 2 karakter girin.');

    $page  = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(48, (int)($_GET['limit'] ?? 12));
    $dept  = $_GET['department'] ?? '';
    $term  = "%$q%";

    $where  = ['is_active=1', '(name LIKE ? OR brand LIKE ? OR category_slug LIKE ? OR description LIKE ?)'];
    $params = [$term, $term, $term, $term];
    if ($dept) { $where[] = 'department=?'; $params[] = $dept; }
    $wSql = implode(' AND ', $where);

    $sort = match($_GET['sort'] ?? 'popular') {
        'newest'     => 'created_at DESC',
        'price_asc'  => 'price ASC',
        'price_desc' => 'price DESC',
        'rating'     => 'avg_rating DESC',
        default      => 'review_count DESC',
    };

    $result = paginate($db,
        "SELECT id,sku,name,brand,category_slug,department,price,old_price,emoji,image_url,badge,avg_rating,review_count,stock FROM products WHERE $wSql ORDER BY $sort",
        "SELECT COUNT(*) FROM products WHERE $wSql",
        $params, $page, $limit
    );

    // Arama geçmişine kaydet
    try {
        $tok = getTokenFromHeader();
        $pay = $tok ? jwtVerify($tok) : null;
        $db->prepare('INSERT INTO search_history (user_id,query) VALUES (?,?)')->execute([$pay['user_id'] ?? null, $q]);
    } catch (Throwable) {}

    ok('Arama sonuçları.', array_merge(['query' => $q], $result));
}

// ── ÖZEL LİSTELER ────────────────────────────────────────────
if (in_array($slug, ['featured', 'popular', 'new', 'sale'])) {
    $limit  = min(48, (int)($_GET['limit'] ?? 8));
    $dept   = $_GET['department'] ?? '';
    $params = [];

    $base  = 'SELECT id,sku,name,brand,department,price,old_price,emoji,image_url,badge,avg_rating,review_count,stock FROM products WHERE is_active=1';
    if ($dept) { $base .= ' AND department=?'; $params[] = $dept; }

    $sql = match($slug) {
        'featured' => "$base AND is_featured=1 ORDER BY review_count DESC",
        'popular'  => "$base ORDER BY review_count DESC",
        'new'      => "$base ORDER BY created_at DESC",
        'sale'     => "$base AND old_price IS NOT NULL ORDER BY (old_price-price)/old_price DESC",
    };

    $stmt = $db->prepare("$sql LIMIT $limit");
    $stmt->execute($params);
    ok(ucfirst($slug).' ürünler.', ['items' => $stmt->fetchAll(), 'limit' => $limit]);
}

// ── GENEL LİSTE ──────────────────────────────────────────────
if (!$slug) {
    $where  = ['is_active=1'];
    $params = [];

    // Filtreler
    if (!empty($_GET['department']))    { $where[] = 'department=?';     $params[] = $_GET['department']; }
    if (!empty($_GET['category']))      { $where[] = 'category_slug=?';  $params[] = $_GET['category']; }
    if (!empty($_GET['brand']))         { $where[] = 'brand=?';          $params[] = $_GET['brand']; }
    if (isset($_GET['price_min']))      { $where[] = 'price>=?';         $params[] = (float)$_GET['price_min']; }
    if (isset($_GET['price_max']))      { $where[] = 'price<=?';         $params[] = (float)$_GET['price_max']; }
    if (isset($_GET['rating_min']))     { $where[] = 'avg_rating>=?';    $params[] = (float)$_GET['rating_min']; }
    if (!empty($_GET['badge']))         { $where[] = 'badge=?';          $params[] = $_GET['badge']; }
    if (isset($_GET['vendor_id']))      { $where[] = 'vendor_id=?';      $params[] = (int)$_GET['vendor_id']; }
    if (($_GET['on_sale'] ?? '') === '1')  { $where[] = 'old_price IS NOT NULL'; }
    if (($_GET['in_stock'] ?? '') === '1') { $where[] = 'stock>0'; }

    $sort = match($_GET['sort'] ?? 'popular') {
        'newest'     => 'created_at DESC',
        'price_asc'  => 'price ASC',
        'price_desc' => 'price DESC',
        'rating'     => 'avg_rating DESC',
        'discount'   => '(old_price-price)/old_price DESC',
        default      => 'review_count DESC',
    };

    $page  = max(1, (int)($_GET['page']  ?? 1));
    $limit = min(48, (int)($_GET['limit'] ?? 12));
    $wSql  = implode(' AND ', $where);

    $result = paginate($db,
        "SELECT id,sku,name,brand,category_slug,department,price,old_price,emoji,image_url,badge,avg_rating,review_count,stock,is_featured FROM products WHERE $wSql ORDER BY $sort",
        "SELECT COUNT(*) FROM products WHERE $wSql",
        $params, $page, $limit
    );
    ok('Ürünler.', $result);
}

// ── ÜRÜN DETAY ───────────────────────────────────────────────
$stmt = $db->prepare('SELECT p.*,v.shop_name as vendor_name FROM products p LEFT JOIN vendors v ON p.vendor_id=v.id WHERE p.sku=? AND p.is_active=1');
$stmt->execute([$slug]);
$product = $stmt->fetch();
if (!$product) notFound('Ürün bulunamadı.');

// Değerlendirmeler
$reviews = $db->prepare('SELECT r.rating,r.title,r.body,r.created_at,u.name as user_name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.product_id=? AND r.is_approved=1 ORDER BY r.created_at DESC LIMIT 20');
$reviews->execute([$product['id']]);

// Puan dağılımı
$dist = $db->prepare('SELECT rating, COUNT(*) as cnt FROM reviews WHERE product_id=? AND is_approved=1 GROUP BY rating');
$dist->execute([$product['id']]);
$distribution = array_fill(1, 5, 0);
foreach ($dist->fetchAll() as $d) $distribution[(int)$d['rating']] = (int)$d['cnt'];

// Benzer ürünler
$similar = $db->prepare('SELECT id,sku,name,price,old_price,emoji,image_url,badge,avg_rating,review_count FROM products WHERE category_slug=? AND sku!=? AND is_active=1 ORDER BY review_count DESC LIMIT 6');
$similar->execute([$product['category_slug'], $slug]);

ok('Ürün detayı.', [
    'product'      => $product,
    'reviews'      => $reviews->fetchAll(),
    'distribution' => $distribution,
    'similar'      => $similar->fetchAll(),
]);
