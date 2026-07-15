<?php
/**
 * MODAICA — Admin Panel API Router
 * Endpoint: /admin-api/{path}
 */

require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../config/app.php';
require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/jwt.php';

setCORSHeaders();
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$body   = getBody();

$uri      = strtok($_SERVER['REQUEST_URI'] ?? '', '?');
if (preg_match('#admin-api/(.*)$#', $uri, $m)) $path = trim($m[1], '/');
else $path = trim($uri, '/');
$segments = explode('/', $path);
$resource = $segments[0] ?? '';
$id       = $segments[1] ?? null;
$sub      = $segments[2] ?? null;

// ── Admin Auth ───────────────────────────────────────────────
define('ADMIN_SECRET', JWT_SECRET . '_admin');

function adminToken(array $pl): string {
    $h=rtrim(strtr(base64_encode(json_encode(['alg'=>'HS256','typ'=>'JWT'])),'+/','-_'),'=');
    $pl['iat']=time(); $pl['exp']=time()+3600*24*7;
    $b=rtrim(strtr(base64_encode(json_encode($pl)),'+/','-_'),'=');
    $s=rtrim(strtr(base64_encode(hash_hmac('sha256',"$h.$b",ADMIN_SECRET,true)),'+/','-_'),'=');
    return "$h.$b.$s";
}
function verifyAdminToken(string $tok): ?array {
    $p=explode('.',$tok); if(count($p)!==3) return null;
    [$h,$b,$s]=$p;
    $ex=rtrim(strtr(base64_encode(hash_hmac('sha256',"$h.$b",ADMIN_SECRET,true)),'+/','-_'),'=');
    if(!hash_equals($ex,$s)) return null;
    $pl=json_decode(base64_decode(strtr($b,'-_','+/')),true);
    if(!$pl||$pl['exp']<time()) return null;
    return $pl;
}
function requireAdmin(bool $req=true): ?array {
    $auth=$_SERVER['HTTP_AUTHORIZATION']??'';
    $tok=str_starts_with($auth,'Bearer ')?substr($auth,7):null;
    if(!$tok&&function_exists('getallheaders')){$h=getallheaders();$a=$h['Authorization']??$h['authorization']??'';$tok=str_starts_with($a,'Bearer ')?substr($a,7):null;}
    $pl=$tok?verifyAdminToken($tok):null;
    if(!$pl||!isset($pl['admin_id'])){if($req)unauthorized('Admin girişi gereklidir.');return null;}
    return $pl;
}

// ── DB Yardımcısı ──────────────────────────────────────────
if (!function_exists('tryDB')) {
    function tryDB(): ?PDO { try{return getDB();}catch(Exception $e){return null;} }
}

// ── Mock veriler ─────────────────────────────────────────────
function mockAdminDashboard(): array {
    return [
        'stats' => ['total_revenue'=>842560,'month_revenue'=>78340,'total_orders'=>4231,'month_orders'=>387,'total_users'=>1842,'total_vendors'=>24,'pending_vendors'=>3],
        'recent_orders' => [
            ['order_code'=>'MDC-20260424-042','user_name'=>'Ali Yılmaz','total'=>3499,'status'=>'shipping','created_at'=>date('Y-m-d H:i:s',strtotime('-30 min'))],
            ['order_code'=>'MDC-20260424-041','user_name'=>'Ayşe Kaya','total'=>1299,'status'=>'preparing','created_at'=>date('Y-m-d H:i:s',strtotime('-2 hours'))],
        ],
        'pending_vendors' => [
            ['id'=>5,'name'=>'Yeni Satıcı','shop_name'=>'Trend Shop','email'=>'trend@example.com','created_at'=>date('Y-m-d',strtotime('-1 day'))],
        ],
    ];
}

// ═══════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════

// ── AUTH ─────────────────────────────────────────────────────
if ($resource === 'auth') {
    $act = $id ?? '';
    if ($act === 'login' && $method === 'POST') {
        $email = strtolower(trim($body['email']??''));
        $pass  = $body['password']??'';
        if (!$email||!$pass) error('E-posta ve şifre zorunludur.');

        $db = tryDB();
        if ($db) {
            $stmt=$db->prepare('SELECT * FROM admins WHERE email=? AND is_active=1'); $stmt->execute([$email]);
            $admin=$stmt->fetch();
            if (!$admin||!password_verify($pass,$admin['password_hash'])) error('E-posta veya şifre hatalı.',401);
        } else {
            // Demo: admin@modaica.com / admin1234
            if ($email!=='admin@modaica.com'||$pass!=='admin1234') error('E-posta veya şifre hatalı. (Demo: admin@modaica.com / admin1234)',401);
            $admin=['id'=>1,'name'=>'Admin','email'=>$email,'role'=>'superadmin'];
        }

        $token=adminToken(['admin_id'=>$admin['id'],'email'=>$admin['email'],'role'=>$admin['role']??'admin']);
        success(['token'=>$token,'admin'=>['id'=>$admin['id'],'name'=>$admin['name'],'email'=>$admin['email'],'role'=>$admin['role']??'admin']],'Giriş başarılı.');
    }
    notFound('Bilinmeyen auth endpoint.');
}

// ── Auth gerekli ─────────────────────────────────────────────
$admin = requireAdmin();

// ── DASHBOARD ────────────────────────────────────────────────
if ($resource === 'dashboard' && $method === 'GET') {
    $db=tryDB();
    if (!$db) { success(mockAdminDashboard()); }
    // Gerçek DB sorguları
    $s=$db->query("SELECT
        (SELECT COALESCE(SUM(total_amount),0) FROM orders) total_revenue,
        (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE DATE_FORMAT(created_at,'%Y-%m')=DATE_FORMAT(NOW(),'%Y-%m')) month_revenue,
        (SELECT COUNT(*) FROM orders) total_orders,
        (SELECT COUNT(*) FROM orders WHERE DATE_FORMAT(created_at,'%Y-%m')=DATE_FORMAT(NOW(),'%Y-%m')) month_orders,
        (SELECT COUNT(*) FROM users WHERE is_active=1) total_users,
        (SELECT COUNT(*) FROM vendors) total_vendors,
        (SELECT COUNT(*) FROM vendors WHERE status='pending') pending_vendors
    ")->fetch();
    $ord=$db->query("SELECT o.id,o.order_code,o.status,o.total_amount AS total,o.created_at,u.name as user_name FROM orders o LEFT JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 5")->fetchAll();
    $pv=$db->query("SELECT id,name,shop_name,email,phone,created_at FROM vendors WHERE status='pending' ORDER BY created_at DESC")->fetchAll();
    success(['stats'=>$s,'recent_orders'=>$ord,'pending_vendors'=>$pv]);
}

// ── VENDORS ───────────────────────────────────────────────────
if ($resource === 'vendors') {
    $db=tryDB();
    if ($method==='GET' && !$id) {
        if (!$db) { success(['items'=>[['id'=>1,'name'=>'Demo Satıcı','shop_name'=>'Demo Mağaza','email'=>'demo@modaica.com','status'=>'approved','commission_rate'=>10,'balance'=>12340,'created_at'=>date('Y-m-d H:i:s')]],'total'=>1,'total_pages'=>1]); }
        $page=(int)($_GET['page']??1);$per=20;
        $status=$_GET['status']??'';
        $where='1=1';$params=[];
        if($status){$where.=' AND status=?';$params[]=$status;}
        $c=$db->prepare("SELECT COUNT(*) FROM vendors WHERE $where"); $c->execute($params); $total=(int)$c->fetchColumn();
        $stmt=$db->prepare("SELECT * FROM vendors WHERE $where ORDER BY created_at DESC LIMIT $per OFFSET ".(($page-1)*$per)); $stmt->execute($params);
        success(['items'=>$stmt->fetchAll(),'total'=>$total,'total_pages'=>(int)ceil($total/$per),'page'=>$page]);
    }
    if ($id && $sub==='approve' && $method==='PATCH') {
        if (!$db){success([],'Satıcı onaylandı (demo).');}
        $db->prepare("UPDATE vendors SET status='approved' WHERE id=?")->execute([$id]);
        success([],'Satıcı onaylandı.');
    }
    if ($id && $sub==='suspend' && $method==='PATCH') {
        if (!$db){success([],'Satıcı askıya alındı (demo).');}
        $db->prepare("UPDATE vendors SET status='suspended' WHERE id=?")->execute([$id]);
        success([],'Satıcı askıya alındı.');
    }
    if ($id && $sub==='commission' && $method==='PATCH') {
        if (!$db){success([],'Komisyon güncellendi (demo).');}
        $db->prepare('UPDATE vendors SET commission_rate=? WHERE id=?')->execute([$body['commission']??10,$id]);
        success([],'Komisyon güncellendi.');
    }
    if ($id && $sub==='payout' && $method==='POST') {
        if (!$db){success([],'Ödeme yapıldı (demo).');}
        $amt=(float)($body['amount']??0);
        $db->prepare('UPDATE vendors SET balance=balance+?,total_earned=total_earned+? WHERE id=?')->execute([$amt,$amt,$id]);
        $db->prepare("INSERT INTO vendor_payouts (vendor_id,amount,status,paid_at) VALUES (?,?,'paid',NOW())")->execute([$id,$amt]);
        success([],'Ödeme yapıldı.');
    }
}

// ── PRODUCTS ─────────────────────────────────────────────────
if ($resource === 'products') {
    $db=tryDB();
    if ($method==='GET' && !$id) {
        if (!$db){success(['items'=>[],'total'=>0,'total_pages'=>1]);}
        $page=(int)($_GET['page']??1);$per=20;
        $q=$_GET['q']??'';$vendorId=$_GET['vendor_id']??'';
        $where='1=1';$params=[];
        if($q){$where.=' AND p.name LIKE ?';$params[]="%$q%";}
        if($vendorId){$where.=' AND p.vendor_id=?';$params[]=$vendorId;}
        $c=$db->prepare("SELECT COUNT(*) FROM products p WHERE $where"); $c->execute($params); $total=(int)$c->fetchColumn();
        $stmt=$db->prepare("SELECT p.*,v.shop_name FROM products p LEFT JOIN vendors v ON v.id=p.vendor_id WHERE $where ORDER BY p.created_at DESC LIMIT $per OFFSET ".(($page-1)*$per)); $stmt->execute($params);
        success(['items'=>$stmt->fetchAll(),'total'=>$total,'total_pages'=>(int)ceil($total/$per)]);
    }
    if ($id && $method==='PUT') {
        if (!$db){success([],'Güncellendi (demo).');}
        $allowed=['name','brand','price','stock','is_active','badge'];
        $set=[];$params=[];
        foreach($allowed as $f){if(isset($body[$f])){$set[]="$f=?";$params[]=$body[$f];}}
        $params[]=$id;
        if($set) $db->prepare('UPDATE products SET '.implode(',',$set).' WHERE id=?')->execute($params);
        success([],'Ürün güncellendi.');
    }
    if ($id && $method==='DELETE') {
        if (!$db){success([],'Silindi (demo).');}
        $db->prepare('DELETE FROM products WHERE id=?')->execute([$id]);
        success([],'Ürün silindi.');
    }
    if ($id && $sub==='toggle' && $method==='PATCH') {
        if (!$db){success([],'Toggle edildi (demo).');}
        $db->prepare('UPDATE products SET is_active=IF(is_active=1,0,1) WHERE id=?')->execute([$id]);
        success([],'Güncellendi.');
    }
}

// ── ORDERS ─────────────────────────────────────────────────
if ($resource === 'orders') {
    $db=tryDB();
    if ($method==='GET' && !$id) {
        if (!$db){success(['items'=>[],'total'=>0,'total_pages'=>1]);}
        $page=(int)($_GET['page']??1);$per=20;
        $status=$_GET['status']??'';
        $where='1=1';$params=[];
        if($status){$where.=' AND o.status=?';$params[]=$status;}
        $c=$db->prepare("SELECT COUNT(*) FROM orders o WHERE $where"); $c->execute($params); $total=(int)$c->fetchColumn();
        // total_amount kullanılıyor (eski schema'da 'total' idi)
        $stmt=$db->prepare("SELECT o.id,o.order_code,o.status,o.total_amount AS total,o.payment_method,o.created_at,u.name as user_name FROM orders o LEFT JOIN users u ON u.id=o.user_id WHERE $where ORDER BY o.created_at DESC LIMIT $per OFFSET ".(($page-1)*$per)); $stmt->execute($params);
        success(['items'=>$stmt->fetchAll(),'total'=>$total,'total_pages'=>(int)ceil($total/$per)]);
    }
    if ($id && $method==='PUT') {
        if (!$db){success([],'Güncellendi (demo).');}
        $allowed_statuses = ['pending','confirmed','preparing','shipping','delivered','cancelled','refunded'];
        $new_status = $body['status'] ?? '';
        if (!in_array($new_status, $allowed_statuses)) error('Geçersiz sipariş durumu.');
        $db->prepare('UPDATE orders SET status=? WHERE order_code=?')->execute([$new_status,$id]);
        success([],'Sipariş güncellendi.');
    }
}

// ── USERS ─────────────────────────────────────────────────
if ($resource === 'users') {
    $db=tryDB();
    if ($method==='GET' && !$id) {
        if (!$db){success(['items'=>[],'total'=>0,'total_pages'=>1]);}
        $page=(int)($_GET['page']??1);$per=20;$q=$_GET['q']??'';
        $where='1=1';$params=[];
        if($q){$where.=' AND (name LIKE ? OR email LIKE ?)';$params[]="%$q%";$params[]="%$q%";}
        $c=$db->prepare("SELECT COUNT(*) FROM users WHERE $where"); $c->execute($params); $total=(int)$c->fetchColumn();
        $stmt=$db->prepare("SELECT id,name,email,is_active,tier,points,created_at FROM users WHERE $where ORDER BY created_at DESC LIMIT $per OFFSET ".(($page-1)*$per)); $stmt->execute($params);
        success(['items'=>$stmt->fetchAll(),'total'=>$total,'total_pages'=>(int)ceil($total/$per)]);
    }
    if ($id && $sub==='toggle' && $method==='PATCH') {
        if (!$db){success([],'Toggle edildi (demo).');}
        $db->prepare('UPDATE users SET is_active=IF(is_active=1,0,1) WHERE id=?')->execute([$id]);
        success([],'Kullanıcı güncellendi.');
    }
}

// ── COUPONS ──────────────────────────────────────────────────
if ($resource === 'coupons') {
    $db=tryDB();
    if ($method==='GET') {
        if (!$db){success(['items'=>[['id'=>1,'code'=>'YENISEZON','type'=>'percent','value'=>15,'min_amount'=>500,'usage_count'=>128,'is_active'=>1]]]);}
        $stmt=$db->query('SELECT * FROM coupons ORDER BY created_at DESC'); success(['items'=>$stmt->fetchAll()]);
    }
    if ($method==='POST') {
        if (!$db){success(['id'=>rand(1,999)],'Kupon oluşturuldu (demo).');}
        $db->prepare('INSERT INTO coupons (code,type,value,min_amount,max_uses,expires_at,is_active) VALUES (?,?,?,?,?,?,1)')->execute([strtoupper($body['code']??''),$body['type']??'percent',$body['value']??10,$body['min_amount']??0,$body['max_uses']??null,$body['expires_at']??null]);
        success(['id'=>(int)$db->lastInsertId()],'Kupon oluşturuldu.');
    }
    if ($id && $method==='DELETE') {
        if (!$db){success([],'Silindi (demo).');}
        $db->prepare('DELETE FROM coupons WHERE id=?')->execute([$id]);
        success([],'Kupon silindi.');
    }
}

// ── REVIEWS ──────────────────────────────────────────────────
if ($resource === 'reviews') {
    $db=tryDB();
    if ($method==='GET') {
        if (!$db){success(['items'=>[],'total_pages'=>1]);}
        $page=(int)($_GET['page']??1);$per=20;
        $stmt=$db->prepare('SELECT r.*,u.name as user_name,p.name as product_name FROM reviews r LEFT JOIN users u ON u.id=r.user_id LEFT JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC LIMIT ? OFFSET ?'); $stmt->execute([$per,($page-1)*$per]);
        $c=(int)$db->query('SELECT COUNT(*) FROM reviews')->fetchColumn();
        success(['items'=>$stmt->fetchAll(),'total'=>$c,'total_pages'=>(int)ceil($c/$per)]);
    }
    if ($id && $sub==='approve' && $method==='PATCH') {
        if (!$db){success([],'Güncellendi (demo).');}
        $db->prepare('UPDATE reviews SET is_approved=? WHERE id=?')->execute([$body['is_approved']??1,$id]);
        success([],'Yorum güncellendi.');
    }
    if ($id && $method==='DELETE') {
        if (!$db){success([],'Silindi (demo).');}
        $db->prepare('DELETE FROM reviews WHERE id=?')->execute([$id]);
        success([],'Yorum silindi.');
    }
}

// ── NOTIFICATIONS ─────────────────────────────────────────────
if ($resource === 'notifications') {
    success(['items'=>[],'unread'=>0]);
}

// ── STATS ─────────────────────────────────────────────────────
if ($resource === 'stats') {
    $db=tryDB(); $days=(int)($_GET['days']??30);
    if (!$db){success(['revenue'=>78340,'orders'=>387,'users'=>142,'growth'=>12.5]);}
    $stmt=$db->prepare("SELECT SUM(total) revenue,COUNT(*) orders FROM orders WHERE created_at>=DATE_SUB(NOW(),INTERVAL ? DAY)"); $stmt->execute([$days]);
    success($stmt->fetch()?:[]);
}

notFound('Endpoint bulunamadı.');
