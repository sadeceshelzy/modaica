<?php
// ============================================================
//  MODAICA — Admin Panel API
//  POST   /api/admin/auth/login      → Admin giriş
//  GET    /api/admin/dashboard        → İstatistikler
//  GET    /api/admin/products         → Ürün listesi
//  POST   /api/admin/products         → Ürün ekle
//  PUT    /api/admin/products/{id}    → Ürün güncelle
//  GET    /api/admin/orders           → Sipariş listesi
//  GET    /api/admin/orders/{id}      → Sipariş detayı
//  PUT    /api/admin/orders/{id}      → Sipariş güncelle
//  GET    /api/admin/users            → Kullanıcı listesi
//  GET    /api/admin/users/{id}       → Kullanıcı detayı
//  PUT    /api/admin/users/{id}       → Kullanıcı güncelle
//  GET    /api/admin/vendors          → Satıcı listesi
//  GET    /api/admin/vendors/{id}     → Satıcı detayı
//  PUT    /api/admin/vendors/{id}     → Satıcı güncelle
//  GET    /api/admin/coupons          → Kupon listesi
//  POST   /api/admin/coupons          → Kupon ekle
//  PUT    /api/admin/coupons/{id}     → Kupon güncelle
//  DELETE /api/admin/coupons/{id}     → Kupon sil
//  GET    /api/admin/campaigns        → Kampanya listesi
//  POST   /api/admin/campaigns        → Kampanya ekle
//  PUT    /api/admin/campaigns/{id}   → Kampanya güncelle
//  DELETE /api/admin/campaigns/{id}   → Kampanya sil
//  GET    /api/admin/reviews          → Yorum listesi
//  PUT    /api/admin/reviews/{id}     → Yorum moderasyon
//  DELETE /api/admin/reviews/{id}     → Yorum sil
//  GET    /api/admin/payouts          → Ödeme talepleri
//  PUT    /api/admin/payouts/{id}     → Ödeme güncelle
//  GET    /api/admin/activity         → Aktivite logu
//  GET    /api/admin/settings         → Site ayarları
//  PUT    /api/admin/settings         → Ayar kaydet
// ============================================================
require_once __DIR__.'/../../config/app.php';
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../helpers/jwt.php';
require_once __DIR__.'/../../helpers/response.php';
require_once __DIR__.'/../../middleware/rate-limit.php';

setCORSHeaders();

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── URL Routing ───────────────────────────────────────────────
$parts    = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
// URL: /modaica/backend/api/admin/{resource}/{id}
// Dizin indisini bul (admin'den sonraki segment)
$adminIdx = array_search('admin', $parts);
$resource = $parts[$adminIdx + 1] ?? '';
$subRoute = $parts[$adminIdx + 2] ?? '';
$itemId   = is_numeric($subRoute) ? (int)$subRoute : null;

// ── Admin Doğrulama ───────────────────────────────────────────
function requireAdmin(PDO $db): array {
    $tok = getTokenFromHeader();
    if (!$tok) unauthorized('Admin girişi gerekli.');
    $pay = jwtVerify($tok);
    if (!$pay || empty($pay['admin_id'])) unauthorized('Geçersiz token.');
    $s = $db->prepare('SELECT id, name, email, role, is_active FROM admins WHERE id=?');
    $s->execute([$pay['admin_id']]);
    $admin = $s->fetch();
    if (!$admin || !$admin['is_active']) unauthorized('Admin hesabı aktif değil.');
    return $admin;
}

function logActivity(PDO $db, int $adminId, string $action, string $targetType = '', ?int $targetId = null, string $detail = ''): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    try {
        $db->prepare('INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, detail, ip) VALUES (?,?,?,?,?,?)')
           ->execute([$adminId, $action, $targetType, $targetId, $detail, $ip]);
    } catch (\Throwable $e) {}
}

// ── Kampanya tablosunu gerektiğinde oluştur ───────────────────
function ensureCampaignsTable(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS `campaigns` (
        `id`           INT UNSIGNED   NOT NULL AUTO_INCREMENT,
        `title`        VARCHAR(200)   NOT NULL,
        `description`  TEXT,
        `discount_pct` TINYINT UNSIGNED NOT NULL DEFAULT 0,
        `target_dept`  VARCHAR(50)    NOT NULL DEFAULT 'all',
        `start_date`   DATETIME       NOT NULL,
        `end_date`     DATETIME       NOT NULL,
        `is_active`    TINYINT(1)     NOT NULL DEFAULT 1,
        `created_at`   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at`   DATETIME       ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

// ── Site Ayarları ─────────────────────────────────────────────
function ensureSettingsTable(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS `site_settings` (
        `key`   VARCHAR(100) NOT NULL PRIMARY KEY,
        `value` TEXT,
        `label` VARCHAR(200),
        `type`  VARCHAR(20) NOT NULL DEFAULT 'text'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $defaults = [
        ['free_cargo_limit',  '750',   'Ücretsiz Kargo Limiti (₺)', 'text'],
        ['standard_cargo_fee','39.90', 'Standart Kargo Ücreti (₺)', 'text'],
        ['site_name',         'MODAICA','Site Adı', 'text'],
        ['loyalty_enabled',   '1',     'Sadakat Puanı Aktif', 'toggle'],
        ['review_auto_approve','0',    'Yorumları Otomatik Onayla', 'toggle'],
        ['maintenance_mode',  '0',     'Bakım Modu', 'toggle'],
    ];
    $ins = $db->prepare('INSERT IGNORE INTO site_settings (`key`,`value`,`label`,`type`) VALUES (?,?,?,?)');
    foreach ($defaults as $r) { $ins->execute($r); }
}

// ═══════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════
if ($resource === 'auth' && $subRoute === 'login' && $method === 'POST') {
    rateLimit('admin-login', 5, 60); // 60s'de max 5 giriş denemesi
    $b    = getBody();
    $email = trim($b['email'] ?? '');
    $pass  = $b['password'] ?? '';
    if (!$email || !$pass) badRequest('E-posta ve şifre gerekli.');

    $s = $db->prepare('SELECT id, name, email, password_hash, role, is_active FROM admins WHERE email=?');
    $s->execute([$email]);
    $admin = $s->fetch();

    if (!$admin || !password_verify($pass, $admin['password_hash'])) {
        respond(false, 'E-posta veya şifre hatalı.', [], 401);
    }
    if (!$admin['is_active']) respond(false, 'Hesabınız aktif değil.', [], 403);

    $db->prepare('UPDATE admins SET last_login_at=NOW() WHERE id=?')->execute([$admin['id']]);

    $token = jwtCreate([
        'admin_id' => $admin['id'],
        'role'     => $admin['role'],
    ]);

    ok('Giriş başarılı.', [
        'token' => $token,
        'admin' => ['id' => $admin['id'], 'name' => $admin['name'], 'email' => $admin['email'], 'role' => $admin['role']],
    ]);
}

// ── Bundan sonraki tüm endpointler admin token gerektirir ─────
$admin = requireAdmin($db);

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════
if ($resource === 'dashboard' && $method === 'GET') {
    // Ana istatistikler
    $stats = [];
    $rows = $db->query("
        SELECT
          (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status='delivered')        AS total_revenue,
          (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status='delivered' AND MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW())) AS month_revenue,
          (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status='delivered' AND DATE(created_at)=CURDATE()) AS today_revenue,
          (SELECT COUNT(*) FROM orders)                                                AS total_orders,
          (SELECT COUNT(*) FROM orders WHERE status='pending')                         AS pending_orders,
          (SELECT COUNT(*) FROM orders WHERE DATE(created_at)=CURDATE())              AS today_orders,
          (SELECT COUNT(*) FROM users WHERE is_active=1)                              AS total_users,
          (SELECT COUNT(*) FROM users WHERE DATE(created_at)=CURDATE())               AS new_users_today,
          (SELECT COUNT(*) FROM products WHERE is_active=1)                           AS active_products,
          (SELECT COUNT(*) FROM products WHERE stock < 10 AND is_active=1)            AS low_stock,
          (SELECT COUNT(*) FROM vendors WHERE status='approved')                       AS active_vendors,
          (SELECT COUNT(*) FROM vendors WHERE status='pending')                        AS pending_vendors
    ")->fetch();

    // 30 günlük gelir
    $rev30 = $db->query("
        SELECT DATE(created_at) AS day, COALESCE(SUM(total_amount),0) AS total
        FROM orders WHERE status='delivered' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at) ORDER BY day ASC
    ")->fetchAll();

    // Sipariş dağılım
    $orderStats = $db->query("SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status")->fetchAll();

    // Son siparişler
    $lastOrders = $db->query("
        SELECT o.id, o.order_code, o.total_amount AS total, o.status, o.created_at,
               u.name AS user_name
        FROM orders o LEFT JOIN users u ON u.id=o.user_id
        ORDER BY o.created_at DESC LIMIT 8
    ")->fetchAll();

    // Yeni satıcılar
    $newVendors = $db->query("
        SELECT id, shop_name, email, status FROM vendors ORDER BY created_at DESC LIMIT 5
    ")->fetchAll();

    ok('Dashboard verisi.', compact('stats', 'rev30', 'lastOrders', 'orderStats', 'newVendors') + ['stats' => $rows]);
}

// ═══════════════════════════════════════════════════════════════
//  ÜRÜNLER
// ═══════════════════════════════════════════════════════════════
if ($resource === 'products') {
    // Liste
    if ($method === 'GET' && !$itemId) {
        $q      = '%'.trim($_GET['q'] ?? '').'%';
        $dept   = $_GET['department'] ?? '';
        $active = $_GET['active'] ?? '';
        $page   = max(1, (int)($_GET['page'] ?? 1));

        $where  = ['1=1'];
        $params = [];
        if (trim($_GET['q'] ?? '')) { $where[] = '(p.name LIKE ? OR p.brand LIKE ? OR p.sku LIKE ?)'; $params = array_merge($params, [$q, $q, $q]); }
        if ($dept)   { $where[] = 'p.department=?';  $params[] = $dept; }
        if ($active !== '') { $where[] = 'p.is_active=?'; $params[] = (int)$active; }

        $w   = implode(' AND ', $where);
        $res = paginate($db,
            "SELECT p.id, p.sku, p.name, p.brand, p.emoji, p.department, p.category_slug, p.price, p.old_price, p.stock, p.badge, p.is_active, p.avg_rating, p.review_count FROM products p WHERE $w ORDER BY p.id DESC",
            "SELECT COUNT(*) FROM products p WHERE $w",
            $params, $page, 20
        );
        ok('Ürünler.', $res);
    }

    // Ürün oluştur
    if ($method === 'POST') {
        $b = getBody();
        if (empty($b['name']) || empty($b['brand']) || empty($b['category_slug']) || !isset($b['price'])) {
            badRequest('name, brand, category_slug, price zorunlu.');
        }
        $sku = 'ADM-'.strtoupper(substr(md5(uniqid()), 0, 8));
        $db->prepare("INSERT INTO products (vendor_id, sku, name, brand, emoji, department, category_slug, price, old_price, stock, badge, description, is_active) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?)")
           ->execute([
               $sku, clean($b['name']), clean($b['brand']), clean($b['emoji'] ?? '📦'),
               clean($b['department'] ?? ''), clean($b['category_slug']),
               (float)$b['price'], isset($b['old_price']) ? (float)$b['old_price'] : null,
               (int)($b['stock'] ?? 100), clean($b['badge'] ?? ''),
               clean($b['description'] ?? ''), (int)($b['is_active'] ?? 1),
           ]);
        $newId = (int)$db->lastInsertId();
        logActivity($db, $admin['id'], 'product.create', 'product', $newId, clean($b['name']));
        created('Ürün oluşturuldu.', ['id' => $newId, 'sku' => $sku]);
    }

    // Ürün güncelle
    if ($method === 'PUT' && $itemId) {
        $b = getBody();
        $sets = []; $params = [];
        $fields = ['name','brand','emoji','department','category_slug','badge','description'];
        foreach ($fields as $f) { if (isset($b[$f])) { $sets[] = "$f=?"; $params[] = clean((string)$b[$f]); } }
        if (isset($b['price']))    { $sets[] = 'price=?';    $params[] = (float)$b['price']; }
        if (isset($b['old_price'])){ $sets[] = 'old_price=?';$params[] = $b['old_price'] ? (float)$b['old_price'] : null; }
        if (isset($b['stock']))    { $sets[] = 'stock=?';    $params[] = (int)$b['stock']; }
        if (isset($b['is_active'])){ $sets[] = 'is_active=?';$params[] = (int)$b['is_active']; }
        if (!$sets) badRequest('Güncellenecek alan yok.');
        $params[] = $itemId;
        $db->prepare('UPDATE products SET '.implode(',',$sets).' WHERE id=?')->execute($params);
        logActivity($db, $admin['id'], 'product.update', 'product', $itemId, '');
        ok('Ürün güncellendi.');
    }
}

// ═══════════════════════════════════════════════════════════════
//  SİPARİŞLER
// ═══════════════════════════════════════════════════════════════
if ($resource === 'orders') {
    // Liste
    if ($method === 'GET' && !$itemId) {
        $q      = '%'.trim($_GET['q'] ?? '').'%';
        $status = $_GET['status'] ?? '';
        $page   = max(1, (int)($_GET['page'] ?? 1));
        $where  = ['1=1']; $params = [];
        if (trim($_GET['q'] ?? '')) { $where[] = '(o.order_code LIKE ? OR u.name LIKE ?)'; $params = [$q, $q]; }
        if ($status) { $where[] = 'o.status=?'; $params[] = $status; }
        $w = implode(' AND ', $where);
        $res = paginate($db,
            "SELECT o.id, o.order_code, o.total_amount AS total, o.status, o.created_at, u.name AS user_name, u.email AS user_email FROM orders o LEFT JOIN users u ON u.id=o.user_id WHERE $w ORDER BY o.created_at DESC",
            "SELECT COUNT(*) FROM orders o LEFT JOIN users u ON u.id=o.user_id WHERE $w",
            $params, $page, 20
        );
        ok('Siparişler.', $res);
    }

    // Sipariş detayı
    if ($method === 'GET' && $itemId) {
        $s = $db->prepare('SELECT o.*, o.total_amount AS total, u.name AS user_name, u.email AS user_email FROM orders o LEFT JOIN users u ON u.id=o.user_id WHERE o.id=?');
        $s->execute([$itemId]);
        $order = $s->fetch();
        if (!$order) notFound('Sipariş bulunamadı.');

        $items = $db->prepare('SELECT * FROM order_items WHERE order_id=?');
        $items->execute([$itemId]);

        $addr = null;
        if ($order['address_id']) {
            $a = $db->prepare('SELECT * FROM addresses WHERE id=?');
            $a->execute([$order['address_id']]);
            $addr = $a->fetch();
        }
        ok('Sipariş detayı.', ['order' => $order, 'items' => $items->fetchAll(), 'address' => $addr]);
    }

    // Sipariş güncelle
    if ($method === 'PUT' && $itemId) {
        $b = getBody();
        $sets = []; $params = [];
        if (isset($b['status'])) {
            $allowed = ['pending','preparing','shipping','delivered','cancelled'];
            if (!in_array($b['status'], $allowed)) badRequest('Geçersiz durum.');
            $sets[] = 'status=?'; $params[] = $b['status'];
        }
        if (isset($b['cargo_tracking'])) { $sets[] = 'cargo_tracking=?'; $params[] = clean($b['cargo_tracking']); }
        if (!$sets) badRequest('Güncellenecek alan yok.');
        $params[] = $itemId;
        $db->prepare('UPDATE orders SET '.implode(',',$sets).' WHERE id=?')->execute($params);
        logActivity($db, $admin['id'], 'order.update', 'order', $itemId, $b['status'] ?? '');
        ok('Sipariş güncellendi.');
    }
}

// ═══════════════════════════════════════════════════════════════
//  KULLANICILAR
// ═══════════════════════════════════════════════════════════════
if ($resource === 'users') {
    if ($method === 'GET' && !$itemId) {
        $q      = '%'.trim($_GET['q'] ?? '').'%';
        $active = $_GET['active'] ?? '';
        $page   = max(1, (int)($_GET['page'] ?? 1));
        $where  = ['1=1']; $params = [];
        if (trim($_GET['q'] ?? '')) { $where[] = '(u.name LIKE ? OR u.email LIKE ?)'; $params = [$q, $q]; }
        if ($active !== '') { $where[] = 'u.is_active=?'; $params[] = (int)$active; }
        $w = implode(' AND ', $where);
        $res = paginate($db,
            "SELECT u.id, u.name, u.email, u.phone, u.points AS loyalty_points, u.tier AS loyalty_level, u.is_active, u.created_at FROM users u WHERE $w ORDER BY u.created_at DESC",
            "SELECT COUNT(*) FROM users u WHERE $w",
            $params, $page, 20
        );
        ok('Kullanıcılar.', $res);
    }

    if ($method === 'GET' && $itemId) {
        $s = $db->prepare('SELECT id, name, email, phone, points AS loyalty_points, tier AS loyalty_level, is_active, created_at FROM users WHERE id=?');
        $s->execute([$itemId]);
        $user = $s->fetch();
        if (!$user) notFound('Kullanıcı bulunamadı.');
        $orders = $db->prepare('SELECT order_code, status, total_amount AS total, created_at FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 10');
        $orders->execute([$itemId]);
        ok('Kullanıcı detayı.', ['user' => $user, 'orders' => $orders->fetchAll()]);
    }

    if ($method === 'PUT' && $itemId) {
        $b = getBody();
        if (!isset($b['is_active'])) badRequest('is_active gerekli.');
        $db->prepare('UPDATE users SET is_active=? WHERE id=?')->execute([(int)$b['is_active'], $itemId]);
        logActivity($db, $admin['id'], 'user.toggle', 'user', $itemId, $b['is_active'] ? 'aktif' : 'pasif');
        ok('Kullanıcı güncellendi.');
    }
}

// ═══════════════════════════════════════════════════════════════
//  SATICILAR
// ═══════════════════════════════════════════════════════════════
if ($resource === 'vendors') {
    if ($method === 'GET' && !$itemId) {
        $q      = '%'.trim($_GET['q'] ?? '').'%';
        $status = $_GET['status'] ?? '';
        $page   = max(1, (int)($_GET['page'] ?? 1));
        $where  = ['1=1']; $params = [];
        if (trim($_GET['q'] ?? '')) { $where[] = '(v.name LIKE ? OR v.shop_name LIKE ? OR v.email LIKE ?)'; $params = [$q, $q, $q]; }
        if ($status) { $where[] = 'v.status=?'; $params[] = $status; }
        $w = implode(' AND ', $where);
        $res = paginate($db,
            "SELECT v.id, v.name, v.shop_name, v.email, v.commission_rate, v.balance, v.status, v.created_at FROM vendors v WHERE $w ORDER BY v.created_at DESC",
            "SELECT COUNT(*) FROM vendors v WHERE $w",
            $params, $page, 20
        );
        ok('Satıcılar.', $res);
    }

    if ($method === 'GET' && $itemId) {
        $s = $db->prepare('SELECT v.*, (SELECT COUNT(*) FROM products WHERE vendor_id=v.id) AS product_count FROM vendors v WHERE v.id=?');
        $s->execute([$itemId]);
        $vendor = $s->fetch();
        if (!$vendor) notFound('Satıcı bulunamadı.');
        $sales = $db->prepare('SELECT COUNT(*) AS cnt, COALESCE(SUM(oi.gross_amount),0) AS gross, COALESCE(SUM(oi.gross_amount*(1-v.commission_rate/100)),0) AS net FROM order_items oi JOIN vendors v ON v.id=oi.vendor_id JOIN orders o ON o.id=oi.order_id WHERE oi.vendor_id=? AND o.status=\'delivered\'');
        $sales->execute([$itemId]);
        ok('Satıcı detayı.', ['vendor' => $vendor, 'product_count' => $vendor['product_count'], 'sales' => $sales->fetch()]);
    }

    if ($method === 'PUT' && $itemId) {
        $b = getBody();
        $sets = []; $params = [];
        if (isset($b['status'])) {
            $allowed = ['pending','approved','active','suspended','rejected'];
            if (!in_array($b['status'], $allowed)) badRequest('Geçersiz durum.');
            // 'active' → 'approved' (schema uyumu)
            $dbStatus = $b['status'] === 'active' ? 'approved' : $b['status'];
            $sets[] = 'status=?'; $params[] = $dbStatus;
        }
        if (isset($b['commission_rate'])) { $sets[] = 'commission_rate=?'; $params[] = min(50, max(0, (float)$b['commission_rate'])); }
        if (isset($b['reject_reason']))   { $sets[] = 'suspended_reason=?'; $params[] = clean($b['reject_reason']); }
        if (!$sets) badRequest('Güncellenecek alan yok.');
        $params[] = $itemId;
        $db->prepare('UPDATE vendors SET '.implode(',',$sets).' WHERE id=?')->execute($params);
        logActivity($db, $admin['id'], 'vendor.update', 'vendor', $itemId, $b['status'] ?? '');
        ok('Satıcı güncellendi.');
    }
}

// ═══════════════════════════════════════════════════════════════
//  KUPONLAR
// ═══════════════════════════════════════════════════════════════
if ($resource === 'coupons') {
    if ($method === 'GET') {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $res  = paginate($db,
            "SELECT id, code, value AS discount_pct, min_order_amount AS min_amount, max_uses, used_count, expires_at, is_active FROM coupons ORDER BY created_at DESC",
            "SELECT COUNT(*) FROM coupons",
            [], $page, 20
        );
        ok('Kuponlar.', $res);
    }

    if ($method === 'POST') {
        $b = getBody();
        if (empty($b['code']) || empty($b['discount_pct'])) badRequest('code ve discount_pct zorunlu.');
        // Çakışma kontrolü
        $chk = $db->prepare('SELECT id FROM coupons WHERE code=?');
        $chk->execute([strtoupper(clean($b['code']))]);
        if ($chk->fetch()) conflict('Bu kupon kodu zaten mevcut.');
        $db->prepare("INSERT INTO coupons (code, type, value, min_order_amount, max_uses, is_active, expires_at) VALUES (?,?,?,?,?,?,?)")
           ->execute([
               strtoupper(clean($b['code'])), 'percent', (float)$b['discount_pct'],
               (float)($b['min_amount'] ?? 0), isset($b['max_uses']) && $b['max_uses'] ? (int)$b['max_uses'] : null,
               (int)($b['is_active'] ?? 1), $b['expires_at'] ? clean($b['expires_at']) : null,
           ]);
        $newCouponId = (int)$db->lastInsertId();
        logActivity($db, $admin['id'], 'coupon.create', 'coupon', $newCouponId, clean($b['code']));
        created('Kupon oluşturuldu.', ['id' => $newCouponId]);
    }

    if ($method === 'PUT' && $itemId) {
        $b = getBody();
        $sets = []; $params = [];
        if (isset($b['discount_pct'])) { $sets[] = 'value=?'; $params[] = (float)$b['discount_pct']; }
        if (isset($b['min_amount']))   { $sets[] = 'min_order_amount=?'; $params[] = (float)$b['min_amount']; }
        if (isset($b['max_uses']))     { $sets[] = 'max_uses=?'; $params[] = $b['max_uses'] ? (int)$b['max_uses'] : null; }
        if (isset($b['expires_at']))   { $sets[] = 'expires_at=?'; $params[] = $b['expires_at'] ? clean($b['expires_at']) : null; }
        if (isset($b['is_active']))    { $sets[] = 'is_active=?'; $params[] = (int)$b['is_active']; }
        if (!$sets) badRequest('Güncellenecek alan yok.');
        $params[] = $itemId;
        $db->prepare('UPDATE coupons SET '.implode(',',$sets).' WHERE id=?')->execute($params);
        ok('Kupon güncellendi.');
    }

    if ($method === 'DELETE' && $itemId) {
        $d = $db->prepare('DELETE FROM coupons WHERE id=?');
        $d->execute([$itemId]);
        if (!$d->rowCount()) notFound('Kupon bulunamadı.');
        logActivity($db, $admin['id'], 'coupon.delete', 'coupon', $itemId, '');
        ok('Kupon silindi.');
    }
}

// ═══════════════════════════════════════════════════════════════
//  KAMPANYALAR
// ═══════════════════════════════════════════════════════════════
if ($resource === 'campaigns') {
    ensureCampaignsTable($db);

    if ($method === 'GET') {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $res  = paginate($db,
            "SELECT * FROM campaigns ORDER BY created_at DESC",
            "SELECT COUNT(*) FROM campaigns",
            [], $page, 20
        );
        ok('Kampanyalar.', $res);
    }

    if ($method === 'POST') {
        $b = getBody();
        if (empty($b['title']) || empty($b['start_date']) || empty($b['end_date'])) badRequest('title, start_date, end_date zorunlu.');
        $db->prepare("INSERT INTO campaigns (title, description, discount_pct, target_dept, start_date, end_date, is_active) VALUES (?,?,?,?,?,?,?)")
           ->execute([
               clean($b['title']), clean($b['description'] ?? ''),
               (int)($b['discount_pct'] ?? 0), clean($b['target_dept'] ?? 'all'),
               clean($b['start_date']), clean($b['end_date']), (int)($b['is_active'] ?? 1),
           ]);
        created('Kampanya oluşturuldu.', ['id' => (int)$db->lastInsertId()]);
    }

    if ($method === 'PUT' && $itemId) {
        $b = getBody();
        $sets = []; $params = [];
        $fields = ['title','description','target_dept','start_date','end_date'];
        foreach ($fields as $f) { if (isset($b[$f])) { $sets[] = "$f=?"; $params[] = clean((string)$b[$f]); } }
        if (isset($b['discount_pct'])) { $sets[] = 'discount_pct=?'; $params[] = (int)$b['discount_pct']; }
        if (isset($b['is_active']))    { $sets[] = 'is_active=?';    $params[] = (int)$b['is_active']; }
        if (!$sets) badRequest('Güncellenecek alan yok.');
        $params[] = $itemId;
        $db->prepare('UPDATE campaigns SET '.implode(',',$sets).' WHERE id=?')->execute($params);
        ok('Kampanya güncellendi.');
    }

    if ($method === 'DELETE' && $itemId) {
        $d = $db->prepare('DELETE FROM campaigns WHERE id=?');
        $d->execute([$itemId]);
        if (!$d->rowCount()) notFound('Kampanya bulunamadı.');
        ok('Kampanya silindi.');
    }
}

// ═══════════════════════════════════════════════════════════════
//  YORUMLAR
// ═══════════════════════════════════════════════════════════════
if ($resource === 'reviews') {
    if ($method === 'GET') {
        $approved = $_GET['approved'] ?? '';
        $page     = max(1, (int)($_GET['page'] ?? 1));
        $where    = ['1=1']; $params = [];
        if ($approved !== '') { $where[] = 'r.is_approved=?'; $params[] = (int)$approved; }
        $w = implode(' AND ', $where);
        $res = paginate($db,
            "SELECT r.id, r.product_id, r.rating, r.body, r.is_approved, r.created_at, u.name AS user_name, p.name AS product_name FROM reviews r LEFT JOIN users u ON u.id=r.user_id LEFT JOIN products p ON p.id=r.product_id WHERE $w ORDER BY r.created_at DESC",
            "SELECT COUNT(*) FROM reviews r WHERE $w",
            $params, $page, 20
        );
        ok('Yorumlar.', $res);
    }

    if ($method === 'PUT' && $itemId) {
        $b = getBody();
        if (!isset($b['is_approved'])) badRequest('is_approved gerekli.');
        $db->prepare('UPDATE reviews SET is_approved=? WHERE id=?')->execute([(int)$b['is_approved'], $itemId]);
        ok($b['is_approved'] ? 'Yorum onaylandı.' : 'Yorum gizlendi.');
    }

    if ($method === 'DELETE' && $itemId) {
        $d = $db->prepare('DELETE FROM reviews WHERE id=?');
        $d->execute([$itemId]);
        if (!$d->rowCount()) notFound('Yorum bulunamadı.');
        ok('Yorum silindi.');
    }
}

// ═══════════════════════════════════════════════════════════════
//  ÖDEME TALEPLERİ
// ═══════════════════════════════════════════════════════════════
if ($resource === 'payouts') {
    if ($method === 'GET') {
        $status = $_GET['status'] ?? '';
        $page   = max(1, (int)($_GET['page'] ?? 1));
        $where  = ['1=1']; $params = [];
        if ($status) { $where[] = 'vp.status=?'; $params[] = $status; }
        $w = implode(' AND ', $where);
        $res = paginate($db,
            "SELECT vp.id, vp.amount, vp.method, vp.status, vp.requested_at, v.name AS vendor_name, v.shop_name FROM vendor_payouts vp LEFT JOIN vendors v ON v.id=vp.vendor_id WHERE $w ORDER BY vp.requested_at DESC",
            "SELECT COUNT(*) FROM vendor_payouts vp WHERE $w",
            $params, $page, 20
        );
        ok('Ödeme talepleri.', $res);
    }

    if ($method === 'PUT' && $itemId) {
        $b = getBody();
        $allowed = ['pending','processing','paid','rejected'];
        if (empty($b['status']) || !in_array($b['status'], $allowed)) badRequest('Geçersiz durum.');
        $extra = []; $eParams = [];
        if ($b['status'] === 'paid') { $extra[] = 'paid_at=NOW()'; }
        if ($b['status'] !== 'pending') { $extra[] = 'processed_at=NOW()'; }
        $setSql = 'status=?' . ($extra ? ','.implode(',',$extra) : '');
        $db->prepare("UPDATE vendor_payouts SET $setSql WHERE id=?")->execute([$b['status'], $itemId]);
        logActivity($db, $admin['id'], 'payout.update', 'payout', $itemId, $b['status']);
        ok('Ödeme güncellendi.');
    }
}

// ═══════════════════════════════════════════════════════════════
//  AKTİVİTE LOGU
// ═══════════════════════════════════════════════════════════════
if ($resource === 'activity' && $method === 'GET') {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $res  = paginate($db,
        "SELECT al.id, al.action, al.target_type, al.target_id, al.detail, al.ip, al.created_at,
                'admin' AS actor_type, al.admin_id AS actor_id
         FROM admin_activity_log al ORDER BY al.created_at DESC",
        "SELECT COUNT(*) FROM admin_activity_log",
        [], $page, 30
    );
    ok('Aktivite logu.', $res);
}

// ═══════════════════════════════════════════════════════════════
//  AYARLAR
// ═══════════════════════════════════════════════════════════════
if ($resource === 'settings') {
    ensureSettingsTable($db);

    if ($method === 'GET') {
        $rows = $db->query('SELECT `key`, `value`, `label`, `type` FROM site_settings')->fetchAll();
        $settings = [];
        foreach ($rows as $r) {
            $settings[$r['key']] = ['value' => $r['value'], 'label' => $r['label'], 'type' => $r['type']];
        }
        ok('Ayarlar.', ['settings' => $settings]);
    }

    if ($method === 'PUT') {
        $b   = getBody();
        $upd = $db->prepare('UPDATE site_settings SET `value`=? WHERE `key`=?');
        foreach ($b as $k => $v) {
            $upd->execute([clean((string)$v), clean($k)]);
        }
        logActivity($db, $admin['id'], 'settings.update', '', null, implode(',', array_keys($b)));
        ok('Ayarlar kaydedildi.');
    }
}

respond(false, 'Geçersiz endpoint.', [], 404);
