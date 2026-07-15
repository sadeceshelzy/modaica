<?php
// ============================================================
//  MODAICA — Reviews API
//  GET    /api/reviews?product_id=  → Ürün yorumları
//  GET    /api/reviews/summary      → Puan özeti
//  POST   /api/reviews              → Yorum ekle
//  POST   /api/reviews/{id}/helpful → Yararlı oy
//  PUT    /api/reviews/{id}         → Güncelle
//  DELETE /api/reviews/{id}         → Sil
// ============================================================
require_once __DIR__.'/../../config/app.php';
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../helpers/jwt.php';
require_once __DIR__.'/../../helpers/response.php';
require_once __DIR__.'/../../helpers/validate.php';
require_once __DIR__.'/../../middleware/rate-limit.php';
setCORSHeaders();

$method    = $_SERVER['REQUEST_METHOD'];
$parts     = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$action    = $parts[4] ?? '';  // summary | {id}
$subAction = $parts[5] ?? '';  // helpful

$db = getDB();

// SKU veya sayısal product_id'yi integer ID'ye çözümle
function resolveProductId(PDO $db, string $raw): int {
    if (is_numeric($raw)) return (int)$raw;
    $s = $db->prepare('SELECT id FROM products WHERE sku=?');
    $s->execute([trim($raw)]);
    $r = $s->fetch();
    return $r ? (int)$r['id'] : 0;
}

// Auth (opsiyonel)
$tok     = getTokenFromHeader();
$payload = $tok ? jwtVerify($tok) : null;
$uid     = $payload['user_id'] ?? null;

// ── YARARLI OY ───────────────────────────────────────────────
// POST /api/reviews/{id}/helpful
if ($method === 'POST' && is_numeric($action) && $subAction === 'helpful') {
    if (!$uid) unauthorized();
    $reviewId = (int)$action;

    $chk = $db->prepare('SELECT id FROM reviews WHERE id=? AND is_approved=1');
    $chk->execute([$reviewId]);
    if (!$chk->fetch()) notFound('Yorum bulunamadı.');

    $b         = getBody();
    $voteInput = strtolower(trim($b['vote'] ?? ''));
    if (!in_array($voteInput, ['yes', 'no'], true)) badRequest('vote "yes" veya "no" olmalı.');
    $voteVal   = ($voteInput === 'yes') ? 1 : 0;

    $existing = $db->prepare('SELECT id, vote FROM review_votes WHERE review_id=? AND user_id=?');
    $existing->execute([$reviewId, $uid]);
    $prev    = $existing->fetch();
    $removed = false;

    if ($prev) {
        if ((int)$prev['vote'] === $voteVal) {
            // Aynı oy → toggle off
            $db->prepare('DELETE FROM review_votes WHERE id=?')->execute([$prev['id']]);
            $removed = true;
        } else {
            $db->prepare('UPDATE review_votes SET vote=? WHERE id=?')->execute([$voteVal, $prev['id']]);
        }
    } else {
        $db->prepare('INSERT INTO review_votes (review_id, user_id, vote) VALUES (?,?,?)')->execute([$reviewId, $uid, $voteVal]);
    }

    $counts = $db->prepare('SELECT SUM(vote=1) as yes_cnt, SUM(vote=0) as no_cnt FROM review_votes WHERE review_id=?');
    $counts->execute([$reviewId]);
    $c = $counts->fetch();

    ok('Oy kaydedildi.', [
        'helpful_yes' => (int)($c['yes_cnt'] ?? 0),
        'helpful_no'  => (int)($c['no_cnt']  ?? 0),
        'removed'     => $removed,
    ]);
}

// ── PUAN ÖZETİ ───────────────────────────────────────────────
if ($method === 'GET' && $action === 'summary') {
    $pid = resolveProductId($db, trim($_GET['product_id'] ?? ''));
    if (!$pid) badRequest('product_id zorunludur.');

    $avg = $db->prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as total FROM reviews WHERE product_id=? AND is_approved=1');
    $avg->execute([$pid]);
    $stat = $avg->fetch();

    $dist = $db->prepare('SELECT rating, COUNT(*) as cnt FROM reviews WHERE product_id=? AND is_approved=1 GROUP BY rating');
    $dist->execute([$pid]);
    $distribution = array_fill(1, 5, 0);
    foreach ($dist->fetchAll() as $d) $distribution[(int)$d['rating']] = (int)$d['cnt'];

    // Fotoğraflı yorum sayısı
    $photoStmt = $db->prepare(
        "SELECT COUNT(*) FROM reviews WHERE product_id=? AND is_approved=1
         AND images IS NOT NULL AND images != '' AND images != '[]' AND images != 'null'"
    );
    $photoStmt->execute([$pid]);
    $withPhotos = (int)$photoStmt->fetchColumn();

    ok('Puan özeti.', [
        'avg_rating'   => round((float)($stat['avg_rating'] ?? 0), 1),
        'total'        => (int)($stat['total'] ?? 0),
        'distribution' => $distribution,
        'with_photos'  => $withPhotos,
    ]);
}

// ── ÜRÜN YORUMLARI ───────────────────────────────────────────
if ($method === 'GET' && !$action) {
    $pid    = resolveProductId($db, trim($_GET['product_id'] ?? ''));
    if (!$pid) badRequest('product_id zorunludur.');
    $page   = max(1, (int)($_GET['page'] ?? 1));
    $limit  = 10;
    $filter = trim($_GET['filter'] ?? '');
    $sortIn = trim($_GET['sort']   ?? 'newest');

    // WHERE koşulları
    $where  = 'r.product_id=? AND r.is_approved=1';
    $params = [$pid];

    if ($filter === 'photos') {
        $where .= " AND r.images IS NOT NULL AND r.images != '' AND r.images != '[]' AND r.images != 'null'";
    } elseif (is_numeric($filter) && (int)$filter >= 1 && (int)$filter <= 5) {
        $where .= ' AND r.rating=?';
        $params[] = (int)$filter;
    }

    // Sıralama
    $sort = match($sortIn) {
        'oldest'      => 'r.created_at ASC',
        'helpful'     => '(SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id=r.id AND rv.vote=1) DESC, r.created_at DESC',
        'rating_desc' => 'r.rating DESC, r.created_at DESC',
        'rating_asc'  => 'r.rating ASC, r.created_at DESC',
        default       => 'r.created_at DESC',
    };

    // Toplam kayıt sayısı
    $cntStmt = $db->prepare("SELECT COUNT(*) FROM reviews r WHERE $where");
    $cntStmt->execute($params);
    $total      = (int)$cntStmt->fetchColumn();
    $offset     = ($page - 1) * $limit;
    $totalPages = max(1, (int)ceil($total / $limit));

    // Kullanıcının oyu için subquery
    $userVoteSql = $uid
        ? '(SELECT CASE WHEN rv2.vote=1 THEN 1 WHEN rv2.vote=0 THEN 2 ELSE NULL END FROM review_votes rv2 WHERE rv2.review_id=r.id AND rv2.user_id=?)'
        : 'NULL';
    $mainParams = $uid ? array_merge($params, [$uid]) : $params;

    $sql = "SELECT r.id, r.rating, r.title, r.body, r.pros, r.cons, r.images,
                   r.vendor_reply, r.verified, r.created_at,
                   u.name as user_name,
                   (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id=r.id AND rv.vote=1) as helpful_yes,
                   (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id=r.id AND rv.vote=0) as helpful_no,
                   $userVoteSql as user_voted_helpful
            FROM reviews r
            JOIN users u ON u.id=r.user_id
            WHERE $where
            ORDER BY $sort
            LIMIT $limit OFFSET $offset";

    $stmt = $db->prepare($sql);
    $stmt->execute($mainParams);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($items as &$item) {
        // images JSON → array
        if ($item['images'] && $item['images'] !== '' && $item['images'] !== 'null') {
            $decoded = json_decode($item['images'], true);
            $item['images'] = is_array($decoded) ? $decoded : [];
        } else {
            $item['images'] = [];
        }
        $item['helpful_yes']       = (int)($item['helpful_yes'] ?? 0);
        $item['helpful_no']        = (int)($item['helpful_no']  ?? 0);
        $item['verified']          = (int)($item['verified']    ?? 0);
        $item['user_voted_helpful'] = $item['user_voted_helpful'] !== null ? (int)$item['user_voted_helpful'] : null;
    }
    unset($item);

    ok('Yorumlar.', [
        'items'       => $items,
        'total'       => $total,
        'page'        => $page,
        'limit'       => $limit,
        'total_pages' => $totalPages,
        'has_next'    => ($page * $limit) < $total,
        'has_prev'    => $page > 1,
    ]);
}

// ── YORUM EKLE ───────────────────────────────────────────────
if ($method === 'POST' && !$action) {
    rateLimit('review-add', 5, 300);
    if (!$uid) unauthorized('Yorum yapmak için giriş yapmalısınız.');
    $b      = getBody();
    $pid    = resolveProductId($db, (string)($b['product_id'] ?? ''));
    if (!$pid) badRequest('Geçerli product_id zorunludur.');
    $rating = vInt($b['rating'] ?? 0, 1, 5) ?? badRequest('Puan 1-5 arasında olmalı.');
    $title  = vString($b['title'] ?? '', 0, 200) ?? '';
    $body_  = vString($b['body']  ?? '', 1, 2000) ?? badRequest('Yorum içeriği zorunludur.');
    $pros   = vString($b['pros']  ?? '', 0, 1000) ?? '';
    $cons   = vString($b['cons']  ?? '', 0, 1000) ?? '';
    $images = is_array($b['images'] ?? null) && count($b['images']) > 0
        ? json_encode(array_slice($b['images'], 0, 5))
        : null;

    // Daha önce yazmış mı?
    $chk = $db->prepare('SELECT id FROM reviews WHERE user_id=? AND product_id=?');
    $chk->execute([$uid, $pid]);
    if ($chk->fetch()) conflict('Bu ürün için zaten yorum yazdınız.');

    // Sipariş kontrolü (opsiyonel)
    $orderId = null;
    if (!empty($b['order_id'])) {
        $oc = $db->prepare('SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.id=? AND o.user_id=? AND oi.product_id=?');
        $oc->execute([$b['order_id'], $uid, $pid]);
        if ($oc->fetch()) $orderId = (int)$b['order_id'];
    }

    // Satın almış mı? (verified rozeti)
    $verCheck = $db->prepare('SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.user_id=? AND oi.product_id=? AND o.payment_status="paid" LIMIT 1');
    $verCheck->execute([$uid, $pid]);
    $verified = $verCheck->fetch() ? 1 : 0;

    $db->prepare('INSERT INTO reviews (user_id,product_id,order_id,rating,title,body,pros,cons,images,verified,is_approved) VALUES (?,?,?,?,?,?,?,?,?,?,1)')
       ->execute([$uid, $pid, $orderId, $rating, $title, $body_, $pros ?: null, $cons ?: null, $images, $verified]);

    // Ürün puan ortalamasını güncelle
    $avg = $db->prepare('SELECT AVG(rating) as r, COUNT(*) as c FROM reviews WHERE product_id=? AND is_approved=1');
    $avg->execute([$pid]);
    $s = $avg->fetch();
    $db->prepare('UPDATE products SET avg_rating=?,review_count=? WHERE id=?')
       ->execute([round((float)($s['r'] ?? 4.5), 2), (int)($s['c'] ?? 0), $pid]);

    created('Yorumunuz eklendi.', ['review_id' => (int)$db->lastInsertId()]);
}

// ── YORUM GÜNCELLE ───────────────────────────────────────────
if ($method === 'PUT' && $action && !$subAction) {
    if (!$uid) unauthorized();
    $b      = getBody();
    $rating = (int)($b['rating'] ?? 0);
    $chk    = $db->prepare('SELECT id,product_id FROM reviews WHERE id=? AND user_id=?');
    $chk->execute([$action, $uid]);
    $rv = $chk->fetch();
    if (!$rv) notFound('Yorum bulunamadı veya size ait değil.');
    if ($rating && ($rating < 1 || $rating > 5)) badRequest('Puan 1-5 arasında olmalı.');

    $fields = []; $vals = [];
    if ($rating)           { $fields[] = 'rating=?'; $vals[] = $rating; }
    if (isset($b['title'])){ $fields[] = 'title=?';  $vals[] = clean($b['title']); }
    if (isset($b['body'])) { $fields[] = 'body=?';   $vals[] = clean($b['body']);  }
    if (!$fields) badRequest('Güncellenecek alan yok.');
    $vals[] = $action;
    $db->prepare('UPDATE reviews SET '.implode(',', $fields).' WHERE id=?')->execute($vals);

    $avg = $db->prepare('SELECT AVG(rating) as r, COUNT(*) as c FROM reviews WHERE product_id=? AND is_approved=1');
    $avg->execute([$rv['product_id']]);
    $s = $avg->fetch();
    $db->prepare('UPDATE products SET avg_rating=?,review_count=? WHERE id=?')
       ->execute([round((float)($s['r'] ?? 4.5), 2), (int)($s['c'] ?? 0), $rv['product_id']]);

    ok('Yorum güncellendi.');
}

// ── YORUM SİL ────────────────────────────────────────────────
if ($method === 'DELETE' && $action) {
    if (!$uid) unauthorized();
    $chk = $db->prepare('SELECT id,product_id FROM reviews WHERE id=? AND user_id=?');
    $chk->execute([$action, $uid]);
    $rv = $chk->fetch();
    if (!$rv) notFound('Yorum bulunamadı veya size ait değil.');
    $db->prepare('DELETE FROM reviews WHERE id=?')->execute([$action]);
    ok('Yorum silindi.');
}

respond(false, 'Geçersiz endpoint.', [], 404);
