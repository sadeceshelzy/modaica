<?php
// ============================================================
//  MODAICA — Categories API
//  GET /api/categories                      → Tüm kategoriler
//  GET /api/categories/{department}         → Departman kategorileri
//  GET /api/categories/{slug}/products      → Kategori ürünleri
// ============================================================
require_once __DIR__.'/../../config/app.php';
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../helpers/response.php';
setCORSHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') respond(false, 'Sadece GET destekleniyor.', [], 405);

$parts = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$slug  = $parts[4] ?? '';   // department veya category slug
$sub   = $parts[5] ?? '';   // "products" veya boş
$db    = getDB();

// ── KATEGORİ ÜRÜNLERİ ───────────────────────────────────────
// GET /api/categories/{slug}/products
if ($slug && $sub === 'products') {
    $where  = ['p.is_active=1', 'p.category_slug=?'];
    $params = [$slug];

    if (!empty($_GET['department'])) { $where[] = 'p.department=?'; $params[] = $_GET['department']; }
    if (!empty($_GET['brand']))      { $where[] = 'p.brand=?';      $params[] = $_GET['brand']; }
    if (isset($_GET['price_min']))   { $where[] = 'p.price>=?';     $params[] = (float)$_GET['price_min']; }
    if (isset($_GET['price_max']))   { $where[] = 'p.price<=?';     $params[] = (float)$_GET['price_max']; }
    if (($_GET['on_sale'] ?? '') === '1') { $where[] = 'p.old_price IS NOT NULL'; }
    if (($_GET['in_stock'] ?? '') === '1') { $where[] = 'p.stock>0'; }

    $sort = match($_GET['sort'] ?? 'popular') {
        'newest'     => 'p.created_at DESC',
        'price_asc'  => 'p.price ASC',
        'price_desc' => 'p.price DESC',
        'rating'     => 'p.avg_rating DESC',
        default      => 'p.review_count DESC',
    };

    $page  = max(1, (int)($_GET['page']  ?? 1));
    $limit = min(48, (int)($_GET['limit'] ?? 12));
    $wSql  = implode(' AND ', $where);

    // paginate() kendi LIMIT/OFFSET ekliyor — SQL'de ekleme
    $result = paginate($db,
        "SELECT p.id,p.sku,p.name,p.brand,p.category_slug,p.department,p.price,p.old_price,p.emoji,p.badge,p.avg_rating,p.review_count,p.stock FROM products p WHERE $wSql ORDER BY $sort",
        "SELECT COUNT(*) FROM products p WHERE $wSql",
        $params, $page, $limit
    );
    ok("$slug ürünleri.", $result);
}

// ── DEPARTMAN KATEGORİLERİ ───────────────────────────────────
// GET /api/categories/{department}
if ($slug) {
    $valid = ['erkek','kadin','elektronik','ev','spor','kozmetik'];
    if (!in_array($slug, $valid)) badRequest('Geçersiz departman.');
    $stmt = $db->prepare('SELECT * FROM categories WHERE department=? ORDER BY sort_order ASC');
    $stmt->execute([$slug]);
    ok("$slug kategorileri.", ['categories' => $stmt->fetchAll()]);
}

// ── TÜM KATEGORİLER ─────────────────────────────────────────
// GET /api/categories
$stmt = $db->query('SELECT * FROM categories ORDER BY department, sort_order ASC');
$all  = $stmt->fetchAll();
$grouped = [];
foreach ($all as $c) {
    $grouped[$c['department']][] = $c;
}
ok('Tüm kategoriler.', ['categories' => $all, 'grouped' => $grouped]);
