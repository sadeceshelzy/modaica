<?php
// ============================================================
//  MODAICA — Upload / Ürün Görseli API
//  GET    /api/upload/list?sku=         → Görselleri listele
//  POST   /api/upload/product           → Dosya yükle
//  GET    /api/upload/unsplash?q=       → Unsplash arama
//  POST   /api/upload/unsplash-save     → Unsplash URL kaydet
//  PUT    /api/upload/{id}/primary      → Ana görsel yap
//  DELETE /api/upload/{id}              → Görsel sil
// ============================================================
require_once __DIR__.'/../../config/app.php';
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../helpers/jwt.php';
require_once __DIR__.'/../../helpers/response.php';
setCORSHeaders();

$method    = $_SERVER['REQUEST_METHOD'];
$parts     = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
// parts: [0]=modaica [1]=backend [2]=api [3]=upload [4]=action [5]=subAction
$action    = $parts[4] ?? '';   // list | product | unsplash | unsplash-save | {id}
$subAction = $parts[5] ?? '';   // primary

$db  = getDB();
$tok = getTokenFromHeader();
$payload = $tok ? jwtVerify($tok) : null;
$uid     = $payload['user_id']   ?? null;
$vidTok  = $payload['vendor_id'] ?? null;
$adminId = $payload['admin_id']  ?? null;

function requireUploadAuth(): void {
    global $uid, $vidTok, $adminId;
    if (!$uid && !$vidTok && !$adminId) unauthorized('Bu işlem için giriş yapmanız gerekiyor.');
}

function getProductIdBySku(PDO $db, string $sku): int {
    $s = $db->prepare('SELECT id FROM products WHERE sku=?');
    $s->execute([trim($sku)]);
    $r = $s->fetch();
    return $r ? (int)$r['id'] : 0;
}

// ── GÖRSEL LİSTELE ───────────────────────────────────────────
if ($method === 'GET' && $action === 'list') {
    $sku = trim($_GET['sku'] ?? '');
    if (!$sku) badRequest('sku zorunludur.');
    $pid = getProductIdBySku($db, $sku);
    if (!$pid) ok('Görsel bulunamadı.', ['images' => []]);

    $stmt = $db->prepare(
        'SELECT id, url as path, alt as alt_text, sort_order, is_primary
         FROM product_images
         WHERE product_id=?
         ORDER BY is_primary DESC, sort_order ASC, id ASC'
    );
    $stmt->execute([$pid]);
    $images = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($images as &$img) {
        $img['id']         = (int)$img['id'];
        $img['is_primary'] = (int)$img['is_primary'];
        $img['sort_order'] = (int)$img['sort_order'];
    }
    unset($img);
    ok('Görseller.', ['images' => $images]);
}

// ── UNSPLASH ARAMA ───────────────────────────────────────────
if ($method === 'GET' && $action === 'unsplash') {
    $q = trim($_GET['q'] ?? '');
    if (!$q) badRequest('Arama terimi gerekli.');

    $accessKey = defined('UNSPLASH_ACCESS_KEY') ? UNSPLASH_ACCESS_KEY : '';
    if (!$accessKey) {
        // Anahtar yoksa boş sonuç döndür (demo ortamı)
        ok('Unsplash API anahtarı yapılandırılmamış.', ['results' => []]);
    }

    $url = 'https://api.unsplash.com/search/photos?query=' . urlencode($q) . '&per_page=9&orientation=squarish';
    $ctx = stream_context_create(['http' => [
        'header'  => "Authorization: Client-ID $accessKey\r\nUser-Agent: MODAICA/1.0\r\n",
        'timeout' => 6,
    ]]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) {
        ok('Unsplash erişilemedi.', ['results' => []]);
    }
    $data    = json_decode($raw, true);
    $results = array_map(fn($p) => [
        'thumb'        => $p['urls']['thumb']             ?? '',
        'regular'      => $p['urls']['regular']           ?? '',
        'alt'          => $p['alt_description']           ?? '',
        'download_url' => $p['links']['download_location'] ?? '',
    ], $data['results'] ?? []);
    ok('Unsplash sonuçları.', ['results' => $results]);
}

// ── UNSPLASH KAYDET ──────────────────────────────────────────
if ($method === 'POST' && $action === 'unsplash-save') {
    requireUploadAuth();
    $b   = getBody();
    $sku = trim($b['sku'] ?? '');
    $url = trim($b['image_url'] ?? '');
    $alt = trim($b['alt_text']  ?? '');
    if (!$sku || !$url) badRequest('sku ve image_url zorunludur.');
    if (!filter_var($url, FILTER_VALIDATE_URL)) badRequest('Geçersiz görsel URL.');

    $pid = getProductIdBySku($db, $sku);
    if (!$pid) notFound('Ürün bulunamadı.');

    $cntStmt = $db->prepare('SELECT COUNT(*) FROM product_images WHERE product_id=?');
    $cntStmt->execute([$pid]);
    if ((int)$cntStmt->fetchColumn() >= 8) badRequest('Ürün başına en fazla 8 görsel eklenebilir.');

    $isPrimary = 0;
    $primStmt  = $db->prepare('SELECT COUNT(*) FROM product_images WHERE product_id=? AND is_primary=1');
    $primStmt->execute([$pid]);
    if ((int)$primStmt->fetchColumn() === 0) $isPrimary = 1;

    $db->prepare('INSERT INTO product_images (product_id, url, alt, is_primary) VALUES (?,?,?,?)')
       ->execute([$pid, $url, $alt ?: null, $isPrimary]);

    created('Görsel eklendi.', ['image_id' => (int)$db->lastInsertId()]);
}

// ── ANA GÖRSEL YAP ───────────────────────────────────────────
if ($method === 'PUT' && is_numeric($action) && $subAction === 'primary') {
    requireUploadAuth();
    $imgId = (int)$action;
    $imgRow = $db->prepare('SELECT id, product_id FROM product_images WHERE id=?');
    $imgRow->execute([$imgId]);
    $img = $imgRow->fetch();
    if (!$img) notFound('Görsel bulunamadı.');

    $db->prepare('UPDATE product_images SET is_primary=0 WHERE product_id=?')->execute([$img['product_id']]);
    $db->prepare('UPDATE product_images SET is_primary=1 WHERE id=?')->execute([$imgId]);
    ok('Ana görsel güncellendi.');
}

// ── GÖRSEL SİL ───────────────────────────────────────────────
if ($method === 'DELETE' && is_numeric($action) && !$subAction) {
    requireUploadAuth();
    $imgId = (int)$action;
    $imgRow = $db->prepare('SELECT id, product_id, url, is_primary FROM product_images WHERE id=?');
    $imgRow->execute([$imgId]);
    $img = $imgRow->fetch();
    if (!$img) notFound('Görsel bulunamadı.');

    $db->prepare('DELETE FROM product_images WHERE id=?')->execute([$imgId]);

    // Birincil görselse bir sonrakini birincil yap
    if ((int)$img['is_primary'] === 1) {
        $nextStmt = $db->prepare('SELECT id FROM product_images WHERE product_id=? ORDER BY sort_order ASC, id ASC LIMIT 1');
        $nextStmt->execute([$img['product_id']]);
        $next = $nextStmt->fetch();
        if ($next) {
            $db->prepare('UPDATE product_images SET is_primary=1 WHERE id=?')->execute([$next['id']]);
        }
    }
    ok('Görsel silindi.');
}

// ── DOSYA YÜKLEME ────────────────────────────────────────────
if ($method === 'POST' && $action === 'product') {
    requireUploadAuth();

    $sku = trim($_POST['sku'] ?? '');
    if (!$sku) badRequest('sku zorunludur.');
    $pid = getProductIdBySku($db, $sku);
    if (!$pid) notFound('Ürün bulunamadı.');

    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        badRequest('Görsel yüklenemedi veya dosya seçilmedi.');
    }

    $file    = $_FILES['image'];
    $maxSize = 5 * 1024 * 1024; // 5 MB
    if ($file['size'] > $maxSize) badRequest('Dosya boyutu 5 MB sınırını aşıyor.');

    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $finfo   = new finfo(FILEINFO_MIME_TYPE);
    $mime    = $finfo->file($file['tmp_name']);
    if (!array_key_exists($mime, $allowed)) badRequest('Yalnızca JPEG, PNG veya WebP yükleyebilirsiniz.');

    $cntStmt = $db->prepare('SELECT COUNT(*) FROM product_images WHERE product_id=?');
    $cntStmt->execute([$pid]);
    if ((int)$cntStmt->fetchColumn() >= 8) badRequest('Ürün başına en fazla 8 görsel eklenebilir.');

    // Kayıt yeri: modaica/uploads/products/
    $uploadDir = dirname(__DIR__, 3) . '/uploads/products/';
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0750, true)) {
        serverError('Yükleme dizini oluşturulamadı.');
    }

    $filename  = preg_replace('/[^a-zA-Z0-9_-]/', '_', $sku) . '_' . uniqid() . '.' . $allowed[$mime];
    $dest      = $uploadDir . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) serverError('Dosya kaydedilemedi.');

    $scheme    = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host      = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $publicUrl = "$scheme://$host/modaica/uploads/products/$filename";

    $isPrimary = 0;
    $primStmt  = $db->prepare('SELECT COUNT(*) FROM product_images WHERE product_id=? AND is_primary=1');
    $primStmt->execute([$pid]);
    if ((int)$primStmt->fetchColumn() === 0) $isPrimary = 1;

    $db->prepare('INSERT INTO product_images (product_id, url, is_primary) VALUES (?,?,?)')
       ->execute([$pid, $publicUrl, $isPrimary]);

    created('Görsel yüklendi.', ['image_id' => (int)$db->lastInsertId(), 'url' => $publicUrl]);
}

respond(false, 'Geçersiz endpoint.', [], 404);
