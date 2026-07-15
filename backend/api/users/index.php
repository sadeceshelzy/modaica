<?php
// ============================================================
//  MODAICA — Users API
//  GET|PUT  /api/users/profile
//  GET      /api/users/addresses
//  POST     /api/users/addresses
//  PUT      /api/users/addresses/{id}
//  DELETE   /api/users/addresses/{id}
//  PATCH    /api/users/addresses/{id}/default
//  GET|PUT  /api/users/notifications
//  GET|PUT  /api/users/security
//  GET      /api/users/points
// ============================================================
require_once __DIR__.'/../../middleware/auth.php';
require_once __DIR__.'/../../helpers/validate.php';
require_once __DIR__.'/../../middleware/rate-limit.php';
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
// [0]=modaica [1]=backend [2]=api [3]=users [4]=action [5]=param [6]=sub
$action = $parts[4] ?? '';
$param  = $parts[5] ?? '';
$sub    = $parts[6] ?? '';

// ── PROFİL ───────────────────────────────────────────────────
if ($action === 'profile') {
    if ($method === 'GET') {
        $stmt = $db->prepare('SELECT id,name,email,phone,birthdate,gender,avatar,points,tier,created_at FROM users WHERE id=?');
        $stmt->execute([$CURRENT_USER_ID]);
        ok('Profil.', ['user' => $stmt->fetch()]);
    }
    if ($method === 'PUT') {
        $b = getBody(); $fields = []; $vals = [];
        $map = [
            'name'       => fn($v) => ($r = vString($v, 2, 100)) !== null ? clean($r) : null,
            'phone'      => fn($v) => ($r = vString($v, 0, 20))  !== null ? clean($r) : null,
            'birthdate'  => fn($v) => vString($v, 0, 10),
            'gender'     => fn($v) => vEnum($v, ['erkek','kadın','belirtmek istemiyorum','']),
            'avatar'     => fn($v) => vString($v, 0, 500),
        ];
        foreach ($map as $f => $validator) {
            if (!isset($b[$f]) || $b[$f] === '') continue;
            $val = $validator($b[$f]);
            if ($val === null) badRequest("'$f' alanı geçersiz.");
            $fields[] = "$f=?"; $vals[] = $val;
        }
        if (!$fields) badRequest('Güncellenecek alan yok.');
        $vals[] = $CURRENT_USER_ID;
        $db->prepare('UPDATE users SET '.implode(',', $fields).' WHERE id=?')->execute($vals);
        ok('Profil güncellendi.');
    }
}

// ── ADRESLER ─────────────────────────────────────────────────
if ($action === 'addresses') {
    // Liste
    if ($method === 'GET' && !$param) {
        $stmt = $db->prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC, id ASC');
        $stmt->execute([$CURRENT_USER_ID]);
        ok('Adresler.', ['addresses' => $stmt->fetchAll()]);
    }
    // Ekle
    if ($method === 'POST') {
        rateLimit('address-add', 10, 300); // 5 dakikada max 10 adres
        $b = getBody();
        validateFields($b, [
            'title'        => ['string', 'min' => 1, 'max' => 100],
            'full_name'    => ['string', 'min' => 2, 'max' => 150],
            'phone'        => ['string', 'min' => 7, 'max' => 20],
            'city'         => ['string', 'min' => 2, 'max' => 100],
            'district'     => ['string', 'min' => 2, 'max' => 100],
            'address_line' => ['string', 'min' => 5, 'max' => 500],
        ]);
        $isDefault = !empty($b['is_default']) ? 1 : 0;
        if ($isDefault) $db->prepare('UPDATE addresses SET is_default=0 WHERE user_id=?')->execute([$CURRENT_USER_ID]);
        $db->prepare('INSERT INTO addresses (user_id,title,full_name,phone,city,district,neighborhood,address_line,zip_code,is_default) VALUES (?,?,?,?,?,?,?,?,?,?)')
           ->execute([$CURRENT_USER_ID, clean($b['title']), clean($b['full_name']), clean($b['phone']),
                      clean($b['city']), clean($b['district']), clean($b['neighborhood'] ?? ''),
                      clean($b['address_line']), clean($b['zip_code'] ?? ''), $isDefault]);
        created('Adres eklendi.', ['address_id' => (int)$db->lastInsertId()]);
    }
    // Güncelle
    if ($method === 'PUT' && $param) {
        $chk = $db->prepare('SELECT id FROM addresses WHERE id=? AND user_id=?');
        $chk->execute([$param, $CURRENT_USER_ID]);
        if (!$chk->fetch()) notFound('Adres bulunamadı.');
        $b = getBody(); $fields = []; $vals = [];
        foreach (['title','full_name','phone','city','district','neighborhood','address_line','zip_code'] as $f)
            if (isset($b[$f])) { $fields[] = "$f=?"; $vals[] = clean($b[$f]); }
        if ($fields) { $vals[] = $param; $db->prepare('UPDATE addresses SET '.implode(',', $fields).' WHERE id=?')->execute($vals); }
        ok('Adres güncellendi.');
    }
    // Sil
    if ($method === 'DELETE' && $param && $sub !== 'default') {
        $d = $db->prepare('DELETE FROM addresses WHERE id=? AND user_id=?');
        $d->execute([$param, $CURRENT_USER_ID]);
        if (!$d->rowCount()) notFound('Adres bulunamadı.');
        ok('Adres silindi.');
    }
    // Varsayılan yap
    if ($method === 'PATCH' && $param && $sub === 'default') {
        $chk = $db->prepare('SELECT id FROM addresses WHERE id=? AND user_id=?');
        $chk->execute([$param, $CURRENT_USER_ID]);
        if (!$chk->fetch()) notFound('Adres bulunamadı.');
        $db->prepare('UPDATE addresses SET is_default=0 WHERE user_id=?')->execute([$CURRENT_USER_ID]);
        $db->prepare('UPDATE addresses SET is_default=1 WHERE id=?')->execute([$param]);
        ok('Varsayılan adres güncellendi.');
    }
}

// ── BİLDİRİMLER ─────────────────────────────────────────────
if ($action === 'notifications') {
    if ($method === 'GET') {
        try {
            $stmt = $db->prepare('SELECT * FROM notification_prefs WHERE user_id=?');
            $stmt->execute([$CURRENT_USER_ID]);
            $row = $stmt->fetch() ?: ['email_order'=>1,'email_promo'=>1,'sms_order'=>0,'sms_promo'=>0,'push_order'=>1,'push_promo'=>0];
        } catch (\Throwable $e) {
            $row = ['email_order'=>1,'email_promo'=>1,'sms_order'=>0,'sms_promo'=>0,'push_order'=>1,'push_promo'=>0];
        }
        ok('Bildirim tercihleri.', ['prefs' => $row]);
    }
    if ($method === 'PUT') {
        $b = getBody();
        try {
            $db->prepare('INSERT INTO notification_prefs (user_id,email_order,email_promo,sms_order,sms_promo,push_order,push_promo)
                VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE email_order=VALUES(email_order),email_promo=VALUES(email_promo),
                sms_order=VALUES(sms_order),sms_promo=VALUES(sms_promo),push_order=VALUES(push_order),push_promo=VALUES(push_promo)')
               ->execute([$CURRENT_USER_ID,
                   (int)($b['email_order']??1),(int)($b['email_promo']??1),
                   (int)($b['sms_order']??0),(int)($b['sms_promo']??0),
                   (int)($b['push_order']??1),(int)($b['push_promo']??0)]);
        } catch (\Throwable $e) {}
        ok('Bildirim tercihleri güncellendi.');
    }
}

// ── GÜVENLİK ─────────────────────────────────────────────────
if ($action === 'security') {
    if ($method === 'GET') {
        try {
            $stmt = $db->prepare('SELECT * FROM security_settings WHERE user_id=?');
            $stmt->execute([$CURRENT_USER_ID]);
            $row = $stmt->fetch() ?: ['two_factor'=>0,'login_notify'=>1];
        } catch (\Throwable $e) { $row = ['two_factor'=>0,'login_notify'=>1]; }
        ok('Güvenlik ayarları.', ['settings' => $row]);
    }
    if ($method === 'PUT') {
        $b  = getBody();
        try {
            $db->prepare('INSERT INTO security_settings (user_id,two_factor,login_notify) VALUES (?,?,?)
                ON DUPLICATE KEY UPDATE two_factor=VALUES(two_factor),login_notify=VALUES(login_notify)')
               ->execute([$CURRENT_USER_ID, (int)($b['two_factor']??0), (int)($b['login_notify']??1)]);
        } catch (\Throwable $e) {}
        ok('Güvenlik ayarları güncellendi.');
    }
}

// ── PUAN ─────────────────────────────────────────────────────
if ($action === 'points') {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $stmt = $db->prepare('SELECT points,tier FROM users WHERE id=?');
    $stmt->execute([$CURRENT_USER_ID]);
    $user = $stmt->fetch();
    try {
        $result = paginate($db,
            'SELECT amount,type,description,created_at FROM points_log WHERE user_id=? ORDER BY created_at DESC',
            'SELECT COUNT(*) FROM points_log WHERE user_id=?',
            [$CURRENT_USER_ID], $page, 10
        );
    } catch (\Throwable $e) { $result = ['items' => [], 'total' => 0]; }
    ok('Puan bilgisi.', [
        'balance' => (int)($user['points'] ?? 0),
        'level'   => $user['tier'] ?? 'Bronze',
        'history' => $result,
    ]);
}

respond(false, 'Geçersiz endpoint.', [], 404);
