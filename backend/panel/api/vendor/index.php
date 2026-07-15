<?php
/**
 * MODAICA — Vendor Panel API Router
 * Endpoint: /vendor-api/{path}
 *
 * Auth: Bearer token (vendorToken)
 * Routes:
 *   POST /auth/login           → Satıcı giriş
 *   POST /auth/register        → Satıcı kayıt
 *   GET  /dashboard            → Dashboard istatistikleri
 *   GET  /products             → Ürün listesi
 *   POST /products             → Yeni ürün
 *   PUT  /products/:id         → Ürün güncelle
 *   DELETE /products/:id       → Ürün sil
 *   GET  /orders               → Sipariş listesi
 *   PATCH /orders/:id/ship     → Kargoya ver
 *   GET  /earnings             → Kazanç raporu
 *   GET  /payouts              → Ödeme talepleri
 *   POST /payouts              → Ödeme talebi oluştur
 *   GET  /reviews              → Yorumlar
 *   GET  /profile              → Profil bilgileri
 *   PUT  /profile              → Profil güncelle
 *   PUT  /password             → Şifre değiştir
 *   GET  /balance              → Bakiye
 *   GET  /notifications        → Bildirimler
 *   PATCH /notifications/read  → Bildirimleri okundu işaretle
 */

require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../config/app.php';
require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/jwt.php';

setCORSHeaders();
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$body   = getBody();

// ── PATH PARSING ────────────────────────────────────────────
$uri      = $_SERVER['REQUEST_URI'] ?? '';
// Strip query string
$uri      = strtok($uri, '?');
// Extract path after vendor-api/
if (preg_match('#vendor-api/(.*)$#', $uri, $m)) {
    $path = trim($m[1], '/');
} else {
    $path = trim($uri, '/');
}
$segments = explode('/', $path);
$resource = $segments[0] ?? '';
$id       = $segments[1] ?? null;
$sub      = $segments[2] ?? null;

// ── VENDOR AUTH ─────────────────────────────────────────────
define('VENDOR_JWT_SECRET', JWT_SECRET . '_vendor');
define('VENDOR_JWT_EXPIRE', 30 * 24 * 3600); // 30 gün

function vendorToken(array $payload): string {
    $h  = rtrim(strtr(base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT'])), '+/', '-_'), '=');
    $payload['iat'] = time();
    $payload['exp'] = time() + VENDOR_JWT_EXPIRE;
    $b  = rtrim(strtr(base64_encode(json_encode($payload)), '+/', '-_'), '=');
    $s  = rtrim(strtr(base64_encode(hash_hmac('sha256', "$h.$b", VENDOR_JWT_SECRET, true)), '+/', '-_'), '=');
    return "$h.$b.$s";
}

function verifyVendorToken(string $token): ?array {
    $p = explode('.', $token);
    if (count($p) !== 3) return null;
    [$h, $b, $s] = $p;
    $expected = rtrim(strtr(base64_encode(hash_hmac('sha256', "$h.$b", VENDOR_JWT_SECRET, true)), '+/', '-_'), '=');
    if (!hash_equals($expected, $s)) return null;
    $pl = json_decode(base64_decode(strtr($b, '-_', '+/')), true);
    if (!$pl || $pl['exp'] < time()) return null;
    return $pl;
}

function getVendorToken(): ?string {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($auth, 'Bearer ')) return substr($auth, 7);
    if (function_exists('getallheaders')) {
        $h = getallheaders();
        $a = $h['Authorization'] ?? $h['authorization'] ?? '';
        if (str_starts_with($a, 'Bearer ')) return substr($a, 7);
    }
    return null;
}

function requireVendor(bool $required = true): ?array {
    $tok = getVendorToken();
    $pl  = $tok ? verifyVendorToken($tok) : null;
    if (!$pl || !isset($pl['vendor_id'])) {
        if ($required) unauthorized('Satıcı girişi gereklidir.');
        return null;
    }
    return $pl;
}

// ── DB Yardımcısı ──────────────────────────────────────────
// Hata durumunda null döner, çağıran kodu demo moda geçer
if (!function_exists('tryDB')) {
    function tryDB(): ?PDO {
        try { return getDB(); } catch (Exception $e) { return null; }
    }
}

function mockDashboard(): array {
    return [
        'stats' => [
            'month_revenue' => 45280.50,
            'balance'       => 12340.00,
            'total_earned'  => 98750.00,
            'month_sales'   => 127,
            'total_sales'   => 843,
            'total_products'=> 34,
            'low_stock'     => 3,
        ],
        'sales30'      => array_map(fn($i) => [
            'day'   => date('Y-m-d', strtotime("-$i days")),
            'gross' => rand(500, 3000),
            'net'   => rand(400, 2500),
        ], range(29, 0)),
        'topProducts'  => [
            ['product_name' => 'Nike Ultra Boost Pro',      'sold' => 48, 'revenue' => 167952],
            ['product_name' => 'Slim Fit Keten Gömlek',     'sold' => 35, 'revenue' => 20965],
            ['product_name' => 'Deri Omuz Çantası',         'sold' => 22, 'revenue' => 28578],
            ['product_name' => 'Hyalüronik Asit Serumu',    'sold' => 19, 'revenue' => 10431],
            ['product_name' => 'Apple Watch Series 9',      'sold' => 12, 'revenue' => 167988],
        ],
        'lastSales' => [
            ['product_name' => 'Nike Ultra Boost Pro', 'order_code' => 'MDC-20260424-001', 'status' => 'delivered', 'gross_amount' => 3499],
            ['product_name' => 'Deri Omuz Çantası',    'order_code' => 'MDC-20260424-002', 'status' => 'shipping',  'gross_amount' => 1299],
            ['product_name' => 'Slim Fit Gömlek',      'order_code' => 'MDC-20260423-008', 'status' => 'pending',   'gross_amount' => 599],
        ],
    ];
}

function mockProducts(): array {
    $items = [
        ['id'=>1,'name'=>'Nike Ultra Boost Pro','brand'=>'Nike','emoji'=>'👟','price'=>3499,'old_price'=>4499,'stock'=>12,'department'=>'spor','category_slug'=>'ayakkabi','badge'=>'sale','is_active'=>1,'sku'=>'NK-UBP-001'],
        ['id'=>2,'name'=>'Slim Fit Keten Gömlek','brand'=>'ModaICA','emoji'=>'👔','price'=>599,'old_price'=>null,'stock'=>45,'department'=>'erkek','category_slug'=>'gomlek','badge'=>'new','is_active'=>1,'sku'=>'MI-SFG-002'],
        ['id'=>3,'name'=>'Deri Omuz Çantası','brand'=>'LeatherCo','emoji'=>'👜','price'=>1299,'old_price'=>1799,'stock'=>8,'department'=>'kadin','category_slug'=>'canta','badge'=>'sale','is_active'=>1,'sku'=>'LC-DOC-003'],
        ['id'=>4,'name'=>'Hyalüronik Asit Serumu','brand'=>'GlowLab','emoji'=>'💧','price'=>549,'old_price'=>699,'stock'=>2,'department'=>'kozmetik','category_slug'=>'yuz-bakim','badge'=>'hot','is_active'=>1,'sku'=>'GL-HAS-004'],
        ['id'=>5,'name'=>'Apple Watch Series 9','brand'=>'Apple','emoji'=>'⌚','price'=>13999,'old_price'=>15999,'stock'=>6,'department'=>'elektronik','category_slug'=>'giyilebilir','badge'=>'best','is_active'=>1,'sku'=>'AP-AW9-005'],
    ];
    return ['items' => $items, 'total' => count($items), 'total_pages' => 1, 'page' => 1];
}

function mockOrders(): array {
    return ['items' => [
        ['id'=>1,'order_code'=>'MDC-20260424-001','product_name'=>'Nike Ultra Boost Pro','quantity'=>1,'gross_amount'=>3499,'commission'=>349.9,'net_amount'=>3149.1,'status'=>'delivered','created_at'=>date('Y-m-d H:i:s', strtotime('-1 day'))],
        ['id'=>2,'order_code'=>'MDC-20260424-002','product_name'=>'Deri Omuz Çantası','quantity'=>2,'gross_amount'=>2598,'commission'=>259.8,'net_amount'=>2338.2,'status'=>'shipping','created_at'=>date('Y-m-d H:i:s', strtotime('-2 hours'))],
        ['id'=>3,'order_code'=>'MDC-20260423-008','product_name'=>'Slim Fit Gömlek','quantity'=>1,'gross_amount'=>599,'commission'=>59.9,'net_amount'=>539.1,'status'=>'pending','created_at'=>date('Y-m-d H:i:s', strtotime('-3 hours'))],
    ], 'total' => 3, 'total_pages' => 1, 'page' => 1];
}

function mockEarnings(): array {
    return [
        'summary' => ['period_gross'=>45280.5,'period_commission'=>4528.05,'period_net'=>40752.45,'total_earned'=>98750,'balance'=>12340,'commission_rate'=>10],
        'chart'   => array_map(fn($i) => ['day'=>date('Y-m-d',strtotime("-$i days")),'gross'=>rand(500,3000),'net'=>rand(400,2500)], range(29,0)),
        'payouts' => [
            ['amount'=>5000,'requested_at'=>date('Y-m-d',strtotime('-10 days')),'status'=>'paid'],
            ['amount'=>2500,'requested_at'=>date('Y-m-d',strtotime('-2 days')),'status'=>'pending'],
        ],
    ];
}

function mockProfile(): array {
    return [
        'id'              => 1,
        'name'            => 'Demo Satıcı',
        'shop_name'       => 'Demo Mağaza',
        'email'           => 'demo@modaica.com',
        'phone'           => '+90 555 000 0000',
        'tax_number'      => '1234567890',
        'logo_emoji'      => '🏪',
        'description'     => 'Demo satıcı hesabı. XAMPP çalıştığında gerçek veriler görünür.',
        'commission_rate' => 10,
        'balance'         => 12340,
        'total_earned'    => 98750,
        'bank_name'       => '',
        'bank_iban'       => '',
        'status'          => 'approved',
    ];
}

// ═══════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════

// ── AUTH/LOGIN ──────────────────────────────────────────────
if ($resource === 'auth') {
    $authAction = $id ?? '';

    if ($authAction === 'login' && $method === 'POST') {
        $email    = strtolower(trim($body['email'] ?? ''));
        $pass     = $body['password'] ?? '';
        if (!$email || !$pass) error('E-posta ve şifre zorunludur.');

        $db = tryDB();
        if ($db) {
            $stmt = $db->prepare('SELECT * FROM vendors WHERE email = ?');
            $stmt->execute([$email]);
            $vendor = $stmt->fetch();

            if (!$vendor || !password_verify($pass, $vendor['password_hash'])) {
                error('E-posta veya şifre hatalı.', 401);
            }
            // Status kontrolü: sadece 'approved' olanlar girebilir
            if ($vendor['status'] === 'pending')   forbidden('Hesabınız henüz onaylanmamış. Lütfen onay e-postasını bekleyin.');
            if ($vendor['status'] === 'suspended') forbidden('Hesabınız askıya alınmıştır. Destek ile iletişime geçin.');
            if ($vendor['status'] === 'rejected')  forbidden('Hesap başvurunuz reddedilmiştir.');
            if ($vendor['status'] !== 'approved')  forbidden('Hesabınız aktif değil.');

            $db->prepare('UPDATE vendors SET last_login_at = NOW() WHERE id = ?')->execute([$vendor['id']]);
        } else {
            // DB yok → demo mode
            if ($email !== 'demo@modaica.com') error('E-posta veya şifre hatalı. (Demo: demo@modaica.com / demo1234)', 401);
            $vendor = array_merge(mockProfile(), ['id' => 1, 'email' => $email, 'status' => 'approved']);
        }

        $token = vendorToken(['vendor_id' => $vendor['id'], 'email' => $vendor['email']]);
        success([
            'token'  => $token,
            'vendor' => [
                'id'              => $vendor['id'],
                'name'            => $vendor['name'],
                'shop_name'       => $vendor['shop_name'],
                'email'           => $vendor['email'],
                'logo_emoji'      => $vendor['logo_emoji'] ?? '🏪',
                'commission_rate' => $vendor['commission_rate'] ?? 10,
                'status'          => $vendor['status'],
            ],
        ], 'Giriş başarılı.');
    }

    if ($authAction === 'register' && $method === 'POST') {
        $name  = trim($body['name']      ?? '');
        $email = strtolower(trim($body['email']     ?? ''));
        $pass  = $body['password']  ?? '';
        $shop  = trim($body['shop_name'] ?? '');

        if (!$name || !$email || !$pass || !$shop) error('Ad, e-posta, şifre ve mağaza adı zorunludur.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) error('Geçerli bir e-posta girin.');
        if (strlen($pass) < 8) error('Şifre en az 8 karakter olmalıdır.');

        $db = tryDB();
        if ($db) {
            $stmt = $db->prepare('SELECT id FROM vendors WHERE email = ?');
            $stmt->execute([$email]);
            if ($stmt->fetch()) error('Bu e-posta adresi zaten kayıtlı.', 409);

            $hash = password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]);
            $db->prepare('INSERT INTO vendors (name, email, password_hash, shop_name, phone, tax_number, description, status) VALUES (?,?,?,?,?,?,?,\'pending\')')
               ->execute([$name, $email, $hash, $shop, $body['phone'] ?? null, $body['tax_number'] ?? null, $body['description'] ?? null]);
        }

        success(['email' => $email], 'Başvurunuz alındı. Onay için 1-3 iş günü bekleyiniz.');
    }

    notFound('Bilinmeyen auth endpoint.');
}

// ── Tüm diğer route'lar için auth zorunlu ───────────────────
$vendor = requireVendor();
$vid    = $vendor['vendor_id'];

// ── DASHBOARD ───────────────────────────────────────────────
if ($resource === 'dashboard' && $method === 'GET') {
    $db = tryDB();
    if (!$db) { success(mockDashboard()); }

    $stmt = $db->prepare('SELECT * FROM vendors WHERE id = ?');
    $stmt->execute([$vid]);
    $v = $stmt->fetch();

    // Stats
    $statsStmt = $db->prepare("
        SELECT
            COALESCE(SUM(CASE WHEN DATE_FORMAT(oi.created_at,'%Y-%m')=DATE_FORMAT(NOW(),'%Y-%m') THEN oi.gross_amount END),0) AS month_revenue,
            COALESCE(SUM(oi.gross_amount),0) AS total_earned,
            COALESCE(COUNT(CASE WHEN DATE_FORMAT(oi.created_at,'%Y-%m')=DATE_FORMAT(NOW(),'%Y-%m') THEN 1 END),0) AS month_sales,
            COALESCE(COUNT(*),0) AS total_sales
        FROM order_items oi WHERE oi.vendor_id = ?
    ");
    $statsStmt->execute([$vid]);
    $sales = $statsStmt->fetch();

    $prodStmt = $db->prepare('SELECT COUNT(*) AS total, SUM(stock<10) AS low FROM products WHERE vendor_id=?');
    $prodStmt->execute([$vid]);
    $prods = $prodStmt->fetch();

    $stats = [
        'month_revenue'  => (float)$sales['month_revenue'],
        'balance'        => (float)($v['balance'] ?? 0),
        'total_earned'   => (float)$sales['total_earned'],
        'month_sales'    => (int)$sales['month_sales'],
        'total_sales'    => (int)$sales['total_sales'],
        'total_products' => (int)$prods['total'],
        'low_stock'      => (int)$prods['low'],
    ];

    // 30 günlük satışlar
    $sales30Stmt = $db->prepare("SELECT DATE(created_at) as day, SUM(gross_amount) as gross, SUM(net_amount) as net FROM order_items WHERE vendor_id=? AND created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) GROUP BY day ORDER BY day");
    $sales30Stmt->execute([$vid]);
    $sales30 = $sales30Stmt->fetchAll();

    // Top ürünler
    $topStmt = $db->prepare("SELECT oi.product_name, SUM(oi.quantity) as sold, SUM(oi.gross_amount) as revenue FROM order_items oi WHERE oi.vendor_id=? GROUP BY oi.product_id ORDER BY sold DESC LIMIT 5");
    $topStmt->execute([$vid]);
    $topProducts = $topStmt->fetchAll();

    // Son satışlar
    $lastStmt = $db->prepare("SELECT oi.product_name, o.order_code, oi.status, oi.gross_amount FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.vendor_id=? ORDER BY oi.created_at DESC LIMIT 6");
    $lastStmt->execute([$vid]);
    $lastSales = $lastStmt->fetchAll();

    success(compact('stats', 'sales30', 'topProducts', 'lastSales'));
}

// ── PRODUCTS ────────────────────────────────────────────────
if ($resource === 'products') {
    $db = tryDB();

    if ($method === 'GET' && !$id) {
        if (!$db) { success(mockProducts()); }
        $q      = $_GET['q']      ?? '';
        $active = $_GET['active'] ?? '';
        $page   = max(1, (int)($_GET['page'] ?? 1));
        $per    = 12;

        $where = ['vendor_id = ?']; $params = [$vid];
        if ($q)                $where[] = 'name LIKE ?'      and $params[] = "%$q%";
        if ($active !== '')    $where[] = 'is_active = ?'    and $params[] = (int)$active;

        $sql   = 'SELECT * FROM products WHERE ' . implode(' AND ', $where) . ' ORDER BY created_at DESC';
        $cSql  = 'SELECT COUNT(*) FROM products WHERE ' . implode(' AND ', $where);

        $cStmt = $db->prepare($cSql); $cStmt->execute($params);
        $total = (int)$cStmt->fetchColumn();
        $totalPages = (int)ceil($total / $per);
        $offset = ($page - 1) * $per;

        $stmt = $db->prepare("$sql LIMIT $per OFFSET $offset"); $stmt->execute($params);
        success(['items' => $stmt->fetchAll(), 'total' => $total, 'total_pages' => $totalPages, 'page' => $page]);
    }

    if ($method === 'POST') {
        if (!$db) { success(['id' => rand(100,999), ...$body], 'Ürün oluşturuldu (demo).'); }
        if (!($body['name'] ?? '') || !($body['price'] ?? 0)) error('Ürün adı ve fiyat zorunludur.');
        $sku = 'MI-' . strtoupper(substr(uniqid(), -6));
        $stmt = $db->prepare('INSERT INTO products (vendor_id,name,brand,emoji,price,old_price,stock,department,category_slug,description,badge,is_active,sku) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $stmt->execute([$vid,$body['name'],$body['brand']??null,$body['emoji']??'📦',$body['price'],$body['old_price']??null,$body['stock']??10,$body['department']??null,$body['category_slug']??null,$body['description']??null,$body['badge']??null,$body['is_active']??1,$sku]);
        success(['id' => (int)$db->lastInsertId(), 'sku' => $sku], 'Ürün oluşturuldu.');
    }

    if ($id && $method === 'PUT') {
        if (!$db) { success($body, 'Ürün güncellendi (demo).'); }
        // Güvenlik: vendor'ın ürünü mü?
        $chk = $db->prepare('SELECT id FROM products WHERE id=? AND vendor_id=?'); $chk->execute([$id,$vid]);
        if (!$chk->fetch()) forbidden('Bu ürün size ait değil.');
        $fields = ['name','brand','emoji','price','old_price','stock','department','category_slug','description','badge','is_active'];
        $set = []; $params = [];
        foreach ($fields as $f) { if (isset($body[$f])) { $set[] = "$f=?"; $params[] = $body[$f]; } }
        if (!$set) error('Güncellenecek alan bulunamadı.');
        $params[] = $id;
        $db->prepare('UPDATE products SET '.implode(',',$set).' WHERE id=?')->execute($params);
        success([], 'Ürün güncellendi.');
    }

    if ($id && $method === 'DELETE') {
        if (!$db) { success([], 'Ürün silindi (demo).'); }
        $db->prepare('UPDATE products SET is_active=0 WHERE id=? AND vendor_id=?')->execute([$id,$vid]);
        success([], 'Ürün devre dışı bırakıldı.');
    }
}

// ── ORDERS ──────────────────────────────────────────────────
if ($resource === 'orders') {
    $db = tryDB();
    if ($method === 'GET' && !$sub) {
        if (!$db) { success(mockOrders()); }
        $status = $_GET['status'] ?? '';
        $page   = max(1,(int)($_GET['page']??1)); $per = 12;
        $where = ['oi.vendor_id=?']; $params=[$vid];
        if ($status) { $where[]='oi.status=?'; $params[]=$status; }
        $sql   = "SELECT oi.*,o.order_code FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE ".implode(' AND ',$where)." ORDER BY oi.created_at DESC";
        $cSql  = "SELECT COUNT(*) FROM order_items oi WHERE ".implode(' AND ',$where);
        $cStmt = $db->prepare($cSql); $cStmt->execute($params);
        $total = (int)$cStmt->fetchColumn();
        $offset= ($page-1)*$per;
        $stmt  = $db->prepare("$sql LIMIT $per OFFSET $offset"); $stmt->execute($params);
        success(['items'=>$stmt->fetchAll(),'total'=>$total,'total_pages'=>(int)ceil($total/$per),'page'=>$page]);
    }
    if ($id && $sub === 'ship' && $method === 'PATCH') {
        if (!$db) { success([], 'Kargoya verildi (demo).'); }
        $db->prepare('UPDATE order_items SET status=\'shipping\' WHERE id=? AND vendor_id=?')->execute([$id,$vid]);
        success([], 'Kargoya verildi.');
    }
}

// ── EARNINGS ────────────────────────────────────────────────
if ($resource === 'earnings' && $method === 'GET') {
    $db = tryDB();
    if (!$db) { success(mockEarnings()); }
    $period = $_GET['period'] ?? 'month';
    $days   = match($period) { 'week' => 7, 'year' => 365, default => 30 };

    $v = $db->prepare('SELECT * FROM vendors WHERE id=?'); $v->execute([$vid]); $vd = $v->fetch();
    $stmt = $db->prepare("SELECT SUM(gross_amount) g, SUM(commission) c, SUM(net_amount) n FROM order_items WHERE vendor_id=? AND created_at>=DATE_SUB(NOW(),INTERVAL ? DAY)");
    $stmt->execute([$vid,$days]); $p = $stmt->fetch();
    $totStmt = $db->prepare('SELECT SUM(gross_amount) total FROM order_items WHERE vendor_id=?'); $totStmt->execute([$vid]); $tot=$totStmt->fetchColumn();

    $summary = ['period_gross'=>(float)$p['g'],'period_commission'=>(float)$p['c'],'period_net'=>(float)$p['n'],'total_earned'=>(float)$tot,'balance'=>(float)($vd['balance']??0),'commission_rate'=>(int)($vd['commission_rate']??10)];

    $chartStmt=$db->prepare("SELECT DATE(created_at) day,SUM(gross_amount) gross,SUM(net_amount) net FROM order_items WHERE vendor_id=? AND created_at>=DATE_SUB(NOW(),INTERVAL ? DAY) GROUP BY day ORDER BY day"); $chartStmt->execute([$vid,$days]);
    $chart=$chartStmt->fetchAll();

    $pyStmt=$db->prepare('SELECT * FROM vendor_payouts WHERE vendor_id=? ORDER BY requested_at DESC LIMIT 5'); $pyStmt->execute([$vid]);
    $payouts=$pyStmt->fetchAll();

    success(compact('summary','chart','payouts'));
}

// ── PAYOUTS ─────────────────────────────────────────────────
if ($resource === 'payouts') {
    $db = tryDB();
    if ($method === 'GET') {
        if (!$db) { success(['items'=>[['amount'=>5000,'method'=>'banka_transferi','status'=>'paid','requested_at'=>date('Y-m-d',strtotime('-10 days')),'paid_at'=>date('Y-m-d',strtotime('-8 days'))],['amount'=>2500,'method'=>'banka_transferi','status'=>'pending','requested_at'=>date('Y-m-d',strtotime('-2 days')),'paid_at'=>null]],'total'=>2,'total_pages'=>1,'page'=>1]); }
        $page=(int)($_GET['page']??1); $per=10;
        $stmt=$db->prepare('SELECT * FROM vendor_payouts WHERE vendor_id=? ORDER BY requested_at DESC LIMIT ? OFFSET ?');
        $stmt->execute([$vid,$per,($page-1)*$per]);
        $items=$stmt->fetchAll();
        $c=$db->prepare('SELECT COUNT(*) FROM vendor_payouts WHERE vendor_id=?'); $c->execute([$vid]);
        $total=(int)$c->fetchColumn();
        success(['items'=>$items,'total'=>$total,'total_pages'=>(int)ceil($total/$per),'page'=>$page]);
    }
    if ($method === 'POST') {
        $amount = (float)($body['amount']??0);
        if ($amount < 50) error('Minimum ₺50 talep edebilirsiniz.');
        if (!$db) { success(['id'=>rand(1,999)], 'Ödeme talebi oluşturuldu (demo).'); }
        $vBal=$db->prepare('SELECT balance FROM vendors WHERE id=?'); $vBal->execute([$vid]); $bal=(float)$vBal->fetchColumn();
        if ($bal < $amount) error('Yetersiz bakiye. Mevcut: ₺'.number_format($bal,2,',','.'));
        $db->prepare('INSERT INTO vendor_payouts (vendor_id,amount,method,status,requested_at) VALUES (?,?,?,\'pending\',NOW())')->execute([$vid,$amount,$body['method']??'banka_transferi']);
        $db->prepare('UPDATE vendors SET balance=balance-? WHERE id=?')->execute([$amount,$vid]);
        success([], 'Ödeme talebiniz oluşturuldu.');
    }
}

// ── REVIEWS ─────────────────────────────────────────────────
if ($resource === 'reviews' && $method === 'GET') {
    $db=tryDB();
    if (!$db) { success(['items'=>[['user_name'=>'Demo Kullanıcı','product_name'=>'Nike Ultra Boost Pro','rating'=>5,'body'=>'Harika ürün!','created_at'=>date('Y-m-d H:i:s')]],'total_pages'=>1]); }
    $page=(int)($_GET['page']??1); $per=10;
    $stmt=$db->prepare('SELECT r.*,u.name as user_name,p.name as product_name FROM reviews r LEFT JOIN users u ON u.id=r.user_id LEFT JOIN products p ON p.id=r.product_id WHERE p.vendor_id=? ORDER BY r.created_at DESC LIMIT ? OFFSET ?');
    $stmt->execute([$vid,$per,($page-1)*$per]);
    $items=$stmt->fetchAll();
    $c=$db->prepare('SELECT COUNT(*) FROM reviews r JOIN products p ON p.id=r.product_id WHERE p.vendor_id=?'); $c->execute([$vid]);
    $total=(int)$c->fetchColumn();
    success(['items'=>$items,'total'=>$total,'total_pages'=>(int)ceil($total/$per),'page'=>$page]);
}

// ── PROFILE ─────────────────────────────────────────────────
if ($resource === 'profile') {
    $db=tryDB();
    if ($method === 'GET') {
        if (!$db) { success(mockProfile()); }
        $stmt=$db->prepare('SELECT * FROM vendors WHERE id=?'); $stmt->execute([$vid]);
        $v=$stmt->fetch(); if (!$v) notFound();
        success($v);
    }
    if ($method === 'PUT') {
        if (!$db) { success(array_merge(mockProfile(),$body), 'Profil güncellendi (demo).'); }
        $allowed=['name','shop_name','phone','tax_number','logo_emoji','description','bank_name','bank_iban'];
        $set=[]; $params=[];
        foreach ($allowed as $f) { if (isset($body[$f])) { $set[]="$f=?"; $params[]=$body[$f]; } }
        if (!$set) error('Güncellenecek alan bulunamadı.');
        $params[]=$vid;
        $db->prepare('UPDATE vendors SET '.implode(',',$set).' WHERE id=?')->execute($params);
        success([], 'Profil güncellendi.');
    }
}

// ── PASSWORD ─────────────────────────────────────────────────
if ($resource === 'password' && $method === 'PUT') {
    $cur=$body['current_password']??''; $new=$body['new_password']??'';
    if (!$cur||!$new) error('Mevcut ve yeni şifre zorunludur.');
    if (strlen($new)<8) error('Yeni şifre en az 8 karakter olmalıdır.');
    $db=tryDB();
    if (!$db) { success([],'Şifre güncellendi (demo).'); }
    $stmt=$db->prepare('SELECT password_hash FROM vendors WHERE id=?'); $stmt->execute([$vid]);
    $v=$stmt->fetch();
    if (!$v||!password_verify($cur,$v['password_hash'])) error('Mevcut şifre hatalı.',401);
    $db->prepare('UPDATE vendors SET password_hash=? WHERE id=?')->execute([password_hash($new,PASSWORD_BCRYPT,['cost'=>12]),$vid]);
    success([],'Şifre güncellendi.');
}

// ── BALANCE ──────────────────────────────────────────────────
if ($resource === 'balance' && $method === 'GET') {
    $db=tryDB();
    if (!$db) { success(['balance'=>12340,'total_earned'=>98750]); }
    $stmt=$db->prepare('SELECT balance,total_earned FROM vendors WHERE id=?'); $stmt->execute([$vid]);
    success($stmt->fetch() ?: []);
}

// ── NOTIFICATIONS ────────────────────────────────────────────
if ($resource === 'notifications') {
    if ($method === 'GET') {
        $db=tryDB();
        if (!$db) { success(['items'=>[['id'=>1,'message'=>'Yeni sipariş aldınız. #MDC-20260424-001','is_read'=>0,'created_at'=>date('Y-m-d H:i:s')]],'unread'=>1]); }
        $stmt=$db->prepare('SELECT * FROM vendor_notifications WHERE vendor_id=? ORDER BY created_at DESC LIMIT 20'); $stmt->execute([$vid]);
        $items=$stmt->fetchAll();
        $unread=count(array_filter($items,fn($n)=>!$n['is_read']));
        success(['items'=>$items,'unread'=>$unread]);
    }
    if ($id==='read' && $method==='PATCH') {
        $db=tryDB();
        if ($db) $db->prepare('UPDATE vendor_notifications SET is_read=1 WHERE vendor_id=?')->execute([$vid]);
        success([],'Bildirimler okundu işaretlendi.');
    }
}

// ── Stats (alias) ─────────────────────────────────────────────
if ($resource === 'stats' && $method === 'GET') {
    $db=tryDB();
    if (!$db) { success(mockDashboard()['stats']); }
    $days=(int)($_GET['days']??30);
    $stmt=$db->prepare("SELECT SUM(gross_amount) g,SUM(net_amount) n,COUNT(*) c FROM order_items WHERE vendor_id=? AND created_at>=DATE_SUB(NOW(),INTERVAL ? DAY)"); $stmt->execute([$vid,$days]);
    success($stmt->fetch()?:[]);
}

notFound('Endpoint bulunamadı.');
