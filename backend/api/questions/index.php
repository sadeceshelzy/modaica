<?php
// ============================================================
//  MODAICA — Soru & Cevap API
//  GET  /api/questions?product_id=&page=  → Soruları listele
//  POST /api/questions                    → Soru sor
//  POST /api/questions/{id}/answer        → Cevap ver
// ============================================================
require_once __DIR__.'/../../config/app.php';
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../helpers/jwt.php';
require_once __DIR__.'/../../helpers/response.php';
require_once __DIR__.'/../../middleware/rate-limit.php';
setCORSHeaders();

$method    = $_SERVER['REQUEST_METHOD'];
$parts     = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$action    = $parts[4] ?? '';   // {question_id}
$subAction = $parts[5] ?? '';   // answer
$db        = getDB();

function resolveProductIdQ(PDO $db, string $raw): int {
    if (is_numeric($raw)) return (int)$raw;
    $s = $db->prepare('SELECT id FROM products WHERE sku=?');
    $s->execute([trim($raw)]);
    $r = $s->fetch();
    return $r ? (int)$r['id'] : 0;
}

$tok     = getTokenFromHeader();
$payload = $tok ? jwtVerify($tok) : null;
$uid     = $payload['user_id']   ?? null;
$vidTok  = $payload['vendor_id'] ?? null;

// ── CEVAP VER ────────────────────────────────────────────────
// POST /api/questions/{id}/answer
if ($method === 'POST' && is_numeric($action) && $subAction === 'answer') {
    if (!$uid && !$vidTok) unauthorized('Cevap vermek için giriş yapmanız gerekiyor.');
    $b   = getBody();
    $ans = trim($b['answer'] ?? '');
    if (mb_strlen($ans, 'UTF-8') < 2)    badRequest('Cevap en az 2 karakter olmalı.');
    if (mb_strlen($ans, 'UTF-8') > 2000) badRequest('Cevap en fazla 2000 karakter olabilir.');

    $qid = (int)$action;
    $chk = $db->prepare('SELECT id FROM product_questions WHERE id=?');
    $chk->execute([$qid]);
    if (!$chk->fetch()) notFound('Soru bulunamadı.');

    $isVendor = $vidTok ? 1 : 0;
    $db->prepare('INSERT INTO question_answers (question_id, user_id, vendor_id, answer, is_vendor) VALUES (?,?,?,?,?)')
       ->execute([$qid, $uid, $vidTok, $ans, $isVendor]);

    created('Cevabınız eklendi.', ['answer_id' => (int)$db->lastInsertId()]);
}

// ── SORULARI LİSTELE ─────────────────────────────────────────
// GET /api/questions?product_id=SKU
if ($method === 'GET' && !$action) {
    $pid = resolveProductIdQ($db, trim($_GET['product_id'] ?? ''));
    if (!$pid) badRequest('product_id zorunludur.');
    $page   = max(1, (int)($_GET['page'] ?? 1));
    $limit  = 10;
    $offset = ($page - 1) * $limit;

    $cntStmt = $db->prepare('SELECT COUNT(*) FROM product_questions WHERE product_id=?');
    $cntStmt->execute([$pid]);
    $total = (int)$cntStmt->fetchColumn();

    $stmt = $db->prepare(
        'SELECT q.id, q.question, q.created_at, u.name as user_name
         FROM product_questions q
         JOIN users u ON u.id=q.user_id
         WHERE q.product_id=?
         ORDER BY q.created_at DESC
         LIMIT ? OFFSET ?'
    );
    $stmt->execute([$pid, $limit, $offset]);
    $questions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Her soru için cevapları yükle
    $ansStmt = $db->prepare(
        'SELECT a.id, a.answer, a.is_vendor, a.created_at,
                u.name      as user_name,
                v.shop_name as vendor_shop
         FROM question_answers a
         LEFT JOIN users   u ON u.id=a.user_id   AND a.is_vendor=0
         LEFT JOIN vendors v ON v.id=a.vendor_id AND a.is_vendor=1
         WHERE a.question_id=?
         ORDER BY a.created_at ASC'
    );
    foreach ($questions as &$q) {
        $ansStmt->execute([(int)$q['id']]);
        $q['answers'] = $ansStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($q['answers'] as &$a) {
            $a['is_vendor'] = (int)$a['is_vendor'];
        }
        unset($a);
    }
    unset($q);

    ok('Sorular.', [
        'items'       => $questions,
        'total'       => $total,
        'page'        => $page,
        'limit'       => $limit,
        'total_pages' => max(1, (int)ceil($total / $limit)),
        'has_next'    => ($page * $limit) < $total,
        'has_prev'    => $page > 1,
    ]);
}

// ── SORU SOR ─────────────────────────────────────────────────
// POST /api/questions
if ($method === 'POST' && !$action) {
    rateLimit('question-add', 5, 300);
    if (!$uid) unauthorized('Soru sormak için giriş yapmalısınız.');
    $b = getBody();
    $pid = resolveProductIdQ($db, (string)($b['product_id'] ?? ''));
    if (!$pid) badRequest('Geçerli product_id zorunludur.');
    $question = trim($b['question'] ?? '');
    if (mb_strlen($question, 'UTF-8') < 10)   badRequest('Soru en az 10 karakter olmalı.');
    if (mb_strlen($question, 'UTF-8') > 1000) badRequest('Soru en fazla 1000 karakter olabilir.');

    $db->prepare('INSERT INTO product_questions (product_id, user_id, question) VALUES (?,?,?)')
       ->execute([$pid, $uid, $question]);

    created('Sorunuz iletildi.', ['question_id' => (int)$db->lastInsertId()]);
}

respond(false, 'Geçersiz endpoint.', [], 404);
