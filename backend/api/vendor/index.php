<?php
// ============================================================
//  MODAICA — Satıcı (Vendor) Panel API
//  POST   /vendor-api/auth/login         → Satıcı giriş
//  GET    /vendor-api/auth/me            → Token doğrula
//  GET    /vendor-api/dashboard          → İstatistikler
//  GET    /vendor-api/products           → Ürün listesi
//  POST   /vendor-api/products           → Ürün ekle
//  PUT    /vendor-api/products/{id}      → Ürün güncelle
//  DELETE /vendor-api/products/{id}      → Ürün sil
//  GET    /vendor-api/orders             → Sipariş listesi
//  GET    /vendor-api/earnings           → Kazanç özeti
//  GET    /vendor-api/payouts            → Ödeme talepleri
//  POST   /vendor-api/payouts            → Ödeme talebi oluştur
//  GET    /vendor-api/reviews            → Ürün yorumları
//  GET    /vendor-api/profile            → Profil bilgisi
//  PUT    /vendor-api/profile            → Profil güncelle
//  PUT    /vendor-api/password           → Şifre güncelle
//  POST   /vendor-api/ai/{type}          → AI önerileri
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
// URL: /modaica/backend/vendor-api/{resource}/{sub}
$parts    = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$apiIdx   = array_search('vendor-api', $parts);
$resource = $parts[$apiIdx + 1] ?? '';
$subRoute = $parts[$apiIdx + 2] ?? '';
$itemId   = is_numeric($subRoute) ? (int)$subRoute : null;

// ── Satıcı Doğrulama ──────────────────────────────────────────
function requireVendor(PDO $db): array {
    $tok = getTokenFromHeader();
    if (!$tok) unauthorized('Satıcı girişi gerekli.');
    $pay = jwtVerify($tok);
    if (!$pay || empty($pay['vendor_id'])) unauthorized('Geçersiz token.');
    $s = $db->prepare('SELECT id, name, email, shop_name, status FROM vendors WHERE id = ?');
    $s->execute([$pay['vendor_id']]);
    $vendor = $s->fetch();
    if (!$vendor || $vendor['status'] !== 'approved') unauthorized('Satıcı hesabı aktif değil.');
    return $vendor;
}

// ── Ödeme Talepleri Tablosunu Oluştur ─────────────────────────
function ensurePayoutsTable(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS `vendor_payouts` (
        `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
        `vendor_id`    INT UNSIGNED  NOT NULL,
        `amount`       DECIMAL(12,2) NOT NULL,
        `method`       ENUM('banka_transferi','papara','havale') NOT NULL DEFAULT 'banka_transferi',
        `status`       ENUM('pending','processing','paid','rejected') NOT NULL DEFAULT 'pending',
        `admin_note`   TEXT,
        `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `processed_at` DATETIME DEFAULT NULL,
        `paid_at`      DATETIME DEFAULT NULL,
        PRIMARY KEY (`id`),
        KEY `vendor_id` (`vendor_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

// ================================================================
//  AUTH
// ================================================================
if ($resource === 'auth') {
    if ($method === 'POST' && $subRoute === 'login') {
        rateLimit('vendor-login', 10, 60); // 60s'de max 10 giriş denemesi
        $b     = getBody();
        $email = trim($b['email'] ?? '');
        $pass  = $b['password'] ?? '';
        if (!$email || !$pass) badRequest('E-posta ve şifre gerekli.');

        $s = $db->prepare('SELECT id, name, email, shop_name, password_hash, status FROM vendors WHERE email = ?');
        $s->execute([$email]);
        $vendor = $s->fetch();

        if (!$vendor || !password_verify($pass, $vendor['password_hash'])) {
            respond(false, 'E-posta veya şifre hatalı.', [], 401);
        }
        if ($vendor['status'] !== 'approved') respond(false, 'Hesabınız henüz onaylanmamış.', [], 403);

        $token = jwtCreate(['vendor_id' => $vendor['id'], 'email' => $vendor['email'], 'role' => 'vendor']);
        ok('Giriş başarılı.', [
            'token'  => $token,
            'vendor' => [
                'id'        => $vendor['id'],
                'name'      => $vendor['name'],
                'email'     => $vendor['email'],
                'shop_name' => $vendor['shop_name'],
            ],
        ]);
    }

    if ($method === 'GET' && $subRoute === 'me') {
        $vendor = requireVendor($db);
        ok('OK', ['vendor' => $vendor]);
    }

    if ($method === 'POST' && $subRoute === 'register') {
        rateLimit('vendor-register', 3, 300); // 5 dakikada max 3 kayıt
        $b         = getBody();
        $name      = trim($b['name'] ?? '');
        $email     = trim($b['email'] ?? '');
        $pass      = $b['password'] ?? '';
        $shopName  = trim($b['shop_name'] ?? '');
        $phone     = trim($b['phone'] ?? '');
        $taxNumber = trim($b['tax_number'] ?? '');
        $desc      = trim($b['description'] ?? '');

        if (!$name || !$email || !$pass || !$shopName) badRequest('Ad, e-posta, şifre ve mağaza adı zorunludur.');
        if (strlen($pass) < 8) badRequest('Şifre en az 8 karakter olmalı.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) badRequest('Geçerli bir e-posta adresi girin.');

        $chk = $db->prepare('SELECT id FROM vendors WHERE email = ?');
        $chk->execute([$email]);
        if ($chk->fetch()) respond(false, 'Bu e-posta adresi zaten kayıtlı.', [], 409);

        $db->prepare('
            INSERT INTO vendors (name, email, password_hash, shop_name, phone, tax_number, description, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, "pending", NOW(), NOW())
        ')->execute([$name, $email, password_hash($pass, PASSWORD_BCRYPT), $shopName, $phone, $taxNumber, $desc]);

        ok('Başvurunuz alındı. Onay sonrası giriş yapabilirsiniz.');
    }
    notFound();
}

// Bundan sonraki tüm endpoint'ler token gerektirir
$vendor = requireVendor($db);
$vid    = (int)$vendor['id'];

// ================================================================
//  DASHBOARD
// ================================================================
if ($resource === 'dashboard' && $method === 'GET') {
    $s = $db->prepare('SELECT COUNT(*) FROM products WHERE vendor_id = ?');
    $s->execute([$vid]);
    $totalProducts = (int)$s->fetchColumn();

    $s = $db->prepare('SELECT COUNT(DISTINCT order_id) FROM order_items WHERE vendor_id = ?');
    $s->execute([$vid]);
    $totalOrders = (int)$s->fetchColumn();

    $s = $db->prepare('
        SELECT COALESCE(SUM(oi.gross_amount), 0)
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.vendor_id = ? AND o.status NOT IN ("cancelled","refunded")
    ');
    $s->execute([$vid]);
    $totalRevenue = (float)$s->fetchColumn();

    $s = $db->prepare('
        SELECT COALESCE(SUM(oi.gross_amount), 0)
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.vendor_id = ? AND o.status NOT IN ("cancelled","refunded")
          AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ');
    $s->execute([$vid]);
    $revenue30 = (float)$s->fetchColumn();

    $s = $db->prepare('
        SELECT oi.product_id, oi.product_name as name,
               SUM(oi.quantity) as sold, SUM(oi.gross_amount) as revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.vendor_id = ? AND o.status NOT IN ("cancelled","refunded")
        GROUP BY oi.product_id, oi.product_name
        ORDER BY sold DESC
        LIMIT 5
    ');
    $s->execute([$vid]);
    $topProducts = $s->fetchAll();

    $s = $db->prepare('
        SELECT o.id, o.status, o.created_at,
               SUM(oi.gross_amount) as amount,
               u.name as customer_name
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        JOIN users u ON u.id = o.user_id
        WHERE oi.vendor_id = ?
        GROUP BY o.id, o.status, o.created_at, u.name
        ORDER BY o.created_at DESC
        LIMIT 5
    ');
    $s->execute([$vid]);
    $lastSales = $s->fetchAll();

    ok('OK', [
        'totalProducts' => $totalProducts,
        'totalOrders'   => $totalOrders,
        'totalRevenue'  => $totalRevenue,
        'revenue30'     => $revenue30,
        'topProducts'   => $topProducts,
        'lastSales'     => $lastSales,
    ]);
}

// ================================================================
//  PRODUCTS
// ================================================================
if ($resource === 'products') {
    if ($method === 'GET') {
        $page    = max(1, (int)($_GET['page'] ?? 1));
        $perPage = min(50, max(1, (int)($_GET['per_page'] ?? 20)));
        $search  = trim($_GET['search'] ?? '');

        $where  = 'p.vendor_id = ?';
        $params = [$vid];
        if ($search !== '') {
            $where   .= ' AND p.name LIKE ?';
            $params[] = "%$search%";
        }

        $sql      = "SELECT p.id, p.name, p.price, p.stock, p.is_active, p.created_at,
                            c.name as category_name, p.emoji
                     FROM products p
                     LEFT JOIN categories c ON c.id = p.category_id
                     WHERE $where ORDER BY p.created_at DESC";
        $countSql = "SELECT COUNT(*) FROM products p WHERE $where";

        ok('OK', paginate($db, $sql, $countSql, $params, $page, $perPage));
    }

    if ($method === 'POST') {
        $b    = getBody();
        $name = clean(trim($b['name'] ?? ''));
        $price = (float)($b['price'] ?? 0);
        if (!$name || $price <= 0) badRequest('Ürün adı ve geçerli fiyat gerekli.');

        $s = $db->prepare('
            INSERT INTO products (vendor_id, category_id, name, description, price, stock,
                                  is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
        ');
        $s->execute([
            $vid,
            isset($b['category_id']) ? (int)$b['category_id'] : null,
            $name,
            clean($b['description'] ?? ''),
            $price,
            (int)($b['stock'] ?? 0),
        ]);
        ok('Ürün eklendi.', ['id' => (int)$db->lastInsertId()]);
    }

    if ($method === 'PUT' && $itemId) {
        $chk = $db->prepare('SELECT id FROM products WHERE id = ? AND vendor_id = ?');
        $chk->execute([$itemId, $vid]);
        if (!$chk->fetch()) notFound('Ürün bulunamadı.');

        $b      = getBody();
        $fields = [];
        $vals   = [];
        foreach (['name', 'description'] as $f) {
            if (array_key_exists($f, $b)) { $fields[] = "$f = ?"; $vals[] = clean((string)$b[$f]); }
        }
        foreach (['price', 'stock', 'category_id', 'is_active'] as $f) {
            if (array_key_exists($f, $b)) {
                $fields[] = "$f = ?";
                $vals[]   = $f === 'price' ? (float)$b[$f] : (int)$b[$f];
            }
        }
        if (empty($fields)) badRequest('Güncellenecek alan yok.');
        $vals[] = $itemId;
        $db->prepare('UPDATE products SET ' . implode(', ', $fields) . ', updated_at=NOW() WHERE id = ?')
           ->execute($vals);
        ok('Ürün güncellendi.');
    }

    if ($method === 'DELETE' && $itemId) {
        $chk = $db->prepare('SELECT id FROM products WHERE id = ? AND vendor_id = ?');
        $chk->execute([$itemId, $vid]);
        if (!$chk->fetch()) notFound('Ürün bulunamadı.');
        $db->prepare('UPDATE products SET is_active = 0, updated_at=NOW() WHERE id = ?')
           ->execute([$itemId]);
        ok('Ürün silindi.');
    }

    notFound();
}

// ================================================================
//  ORDERS
// ================================================================
if ($resource === 'orders' && $method === 'GET') {
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(50, max(1, (int)($_GET['per_page'] ?? 20)));
    $status  = $_GET['status'] ?? '';

    $where  = 'oi.vendor_id = ?';
    $params = [$vid];
    if ($status) { $where .= ' AND o.status = ?'; $params[] = $status; }

    $sql = "
        SELECT o.id, o.status, o.created_at,
               u.name as customer_name,
               SUM(oi.gross_amount) as amount,
               GROUP_CONCAT(oi.product_name SEPARATOR ', ') as products
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        JOIN users u ON u.id = o.user_id
        WHERE $where
        GROUP BY o.id, o.status, o.created_at, u.name
        ORDER BY o.created_at DESC
    ";
    $countSql = "
        SELECT COUNT(DISTINCT o.id)
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE $where
    ";
    ok('OK', paginate($db, $sql, $countSql, $params, $page, $perPage));
}

// ================================================================
//  EARNINGS
// ================================================================
if ($resource === 'earnings' && $method === 'GET') {
    $s = $db->prepare('
        SELECT DATE_FORMAT(o.created_at, "%Y-%m") as month,
               COALESCE(SUM(oi.gross_amount), 0) as revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.vendor_id = ? AND o.status NOT IN ("cancelled","refunded")
          AND o.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY month
        ORDER BY month ASC
    ');
    $s->execute([$vid]);
    $monthly = $s->fetchAll();

    $s = $db->prepare('
        SELECT COALESCE(SUM(oi.gross_amount), 0)
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.vendor_id = ? AND o.status NOT IN ("cancelled","refunded")
    ');
    $s->execute([$vid]);
    $total = (float)$s->fetchColumn();

    ensurePayoutsTable($db);
    $s = $db->prepare("SELECT COALESCE(SUM(amount),0) FROM vendor_payouts WHERE vendor_id = ? AND status='pending'");
    $s->execute([$vid]);
    $pending = (float)$s->fetchColumn();

    ok('OK', ['total' => $total, 'pending' => $pending, 'monthly' => $monthly]);
}

// ================================================================
//  PAYOUTS
// ================================================================
if ($resource === 'payouts') {
    ensurePayoutsTable($db);

    if ($method === 'GET') {
        $page    = max(1, (int)($_GET['page'] ?? 1));
        $perPage = min(50, max(1, (int)($_GET['per_page'] ?? 20)));
        $sql      = 'SELECT * FROM vendor_payouts WHERE vendor_id = ? ORDER BY requested_at DESC';
        $countSql = 'SELECT COUNT(*) FROM vendor_payouts WHERE vendor_id = ?';
        ok('OK', paginate($db, $sql, $countSql, [$vid], $page, $perPage));
    }

    if ($method === 'POST') {
        $b             = getBody();
        $amount        = (float)($b['amount'] ?? 0);
        if ($amount <= 0) badRequest('Geçerli bir tutar girin.');
        $allowed       = ['banka_transferi', 'papara', 'havale'];
        $payoutMethod  = in_array($b['method'] ?? '', $allowed) ? $b['method'] : 'banka_transferi';
        $db->prepare('INSERT INTO vendor_payouts (vendor_id, amount, method, status, requested_at) VALUES (?, ?, ?, "pending", NOW())')
           ->execute([$vid, $amount, $payoutMethod]);
        ok('Ödeme talebi oluşturuldu.', ['id' => (int)$db->lastInsertId()]);
    }
    notFound();
}

// ================================================================
//  REVIEWS
// ================================================================
if ($resource === 'reviews' && $method === 'GET') {
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(50, max(1, (int)($_GET['per_page'] ?? 20)));
    $sql      = '
        SELECT r.id, r.rating, r.body, r.title, r.created_at,
               u.name as customer_name, p.name as product_name, p.id as product_id
        FROM reviews r
        JOIN products p ON p.id = r.product_id
        JOIN users u ON u.id = r.user_id
        WHERE p.vendor_id = ?
        ORDER BY r.created_at DESC
    ';
    $countSql = 'SELECT COUNT(*) FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.vendor_id = ?';
    ok('OK', paginate($db, $sql, $countSql, [$vid], $page, $perPage));
}

// ================================================================
//  PROFILE
// ================================================================
if ($resource === 'profile') {
    if ($method === 'GET') {
        $s = $db->prepare('SELECT id, name, email, shop_name, phone, description, logo_emoji, status, created_at FROM vendors WHERE id = ?');
        $s->execute([$vid]);
        ok('OK', ['vendor' => $s->fetch()]);
    }

    if ($method === 'PUT') {
        $b      = getBody();
        $fields = [];
        $vals   = [];
        foreach (['name', 'shop_name', 'phone', 'description', 'logo_emoji'] as $f) {
            if (array_key_exists($f, $b)) { $fields[] = "$f = ?"; $vals[] = clean((string)$b[$f]); }
        }
        if (empty($fields)) badRequest('Güncellenecek alan yok.');
        $vals[] = $vid;
        $db->prepare('UPDATE vendors SET ' . implode(', ', $fields) . ', updated_at=NOW() WHERE id = ?')
           ->execute($vals);
        ok('Profil güncellendi.');
    }
    notFound();
}

// ================================================================
//  PASSWORD
// ================================================================
if ($resource === 'password' && $method === 'PUT') {
    $b       = getBody();
    $current = $b['current_password'] ?? '';
    $new     = $b['new_password'] ?? '';
    if (!$current || !$new) badRequest('Mevcut ve yeni şifre gerekli.');
    if (strlen($new) < 8) badRequest('Şifre en az 8 karakter olmalı.');

    $s = $db->prepare('SELECT password_hash FROM vendors WHERE id = ?');
    $s->execute([$vid]);
    $row = $s->fetch();
    if (!password_verify($current, $row['password_hash'])) {
        respond(false, 'Mevcut şifre yanlış.', [], 400);
    }
    $db->prepare('UPDATE vendors SET password_hash = ?, updated_at=NOW() WHERE id = ?')
       ->execute([password_hash($new, PASSWORD_BCRYPT), $vid]);
    ok('Şifre güncellendi.');
}

// ================================================================
//  AI ENDPOINTS
// ================================================================
if ($resource === 'ai' && $method === 'POST') {
    $b = getBody();

    if ($subRoute === 'sales-insight') {
        $s = $db->prepare('
            SELECT oi.product_name as name, SUM(oi.quantity) as sold, SUM(oi.gross_amount) as revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.vendor_id = ? AND o.status NOT IN ("cancelled","refunded")
              AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY oi.product_id, oi.product_name ORDER BY sold DESC LIMIT 10
        ');
        $s->execute([$vid]);
        $salesData = $s->fetchAll();
        $insight = count($salesData) > 0
            ? 'Son 30 günde en çok satan ürününüz: ' . $salesData[0]['name'] . ' (' . $salesData[0]['sold'] . ' adet). Satışlarınızı artırmak için benzer ürünleri stokta tutun.'
            : 'Son 30 günde satış verisi bulunamadı. Ürün çeşitliliğinizi artırmayı deneyin.';
        ok('OK', ['insight' => $insight, 'topProducts' => $salesData]);
    }

    if ($subRoute === 'product-advice') {
        ok('OK', ['advice' => 'Ürün açıklamalarınızı detaylandırın, yüksek kaliteli fotoğraflar ekleyin ve rekabetçi fiyatlandırma yapın. Müşteri yorumlarına hızlı yanıt verin.']);
    }

    if ($subRoute === 'stock-risk') {
        $s = $db->prepare('SELECT id, name, stock FROM products WHERE vendor_id = ? AND stock < 5 AND is_active = 1 ORDER BY stock ASC LIMIT 10');
        $s->execute([$vid]);
        $lowStock = $s->fetchAll();
        $risk = count($lowStock) > 0
            ? count($lowStock) . ' ürününüzde kritik stok seviyesi var: ' . implode(', ', array_column($lowStock, 'name'))
            : 'Tüm aktif ürünlerinizde yeterli stok var.';
        ok('OK', ['risk' => $risk, 'lowStock' => $lowStock]);
    }

    if ($subRoute === 'chat') {
        $userMsg = trim($b['message'] ?? '');
        if (!$userMsg) badRequest('Mesaj gerekli.');
        $replies = [
            'fiyat'  => 'Fiyatlandırmanızı rakiplerinizle karşılaştırın ve pazar ortalamasını hedefleyin.',
            'stok'   => 'Stok takibini düzenli yapın; kritik seviyeye düşmeden sipariş verin.',
            'satış'  => 'Satışları artırmak için kampanyalar, indirimler ve sosyal medya paylaşımları etkilidir.',
            'ürün'   => 'Ürün açıklamalarını detaylandırın ve yüksek çözünürlüklü görseller kullanın.',
            'kargo'  => 'Hızlı kargo müşteri memnuniyetini artırır; aynı gün veya ertesi gün seçenekleri sunun.',
        ];
        $reply = 'Merhaba! Size nasıl yardımcı olabilirim?';
        foreach ($replies as $kw => $r) {
            if (mb_stripos($userMsg, $kw) !== false) { $reply = $r; break; }
        }
        ok('OK', ['reply' => $reply]);
    }

    notFound();
}

// ── Varsayılan: 404 ───────────────────────────────────────────
notFound();
