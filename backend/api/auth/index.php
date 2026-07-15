<?php
// ============================================================
//  MODAICA — Auth API
//  POST   /api/auth/register
//  POST   /api/auth/login
//  GET    /api/auth/me
//  PUT    /api/auth/change-password
//  DELETE /api/auth/delete
// ============================================================
require_once __DIR__.'/../../config/app.php';
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../helpers/jwt.php';
require_once __DIR__.'/../../helpers/response.php';
require_once __DIR__.'/../../middleware/rate-limit.php';
setCORSHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$action = end($parts); // register | login | me | change-password | delete
$db     = getDB();

// ── KAYIT ────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'register') {
    rateLimit('register', 5, 300); // 5 dakikada max 5 kayıt
    $b     = getBody();
    $name  = clean($b['name']  ?? '');
    $email = strtolower(trim($b['email'] ?? ''));
    $pass  = $b['password'] ?? '';

    if (!$name)                                      badRequest('Ad zorunludur.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL))  badRequest('Geçerli e-posta girin.');
    if (strlen($pass) < 6)                           badRequest('Şifre en az 6 karakter olmalı.');

    $chk = $db->prepare('SELECT id FROM users WHERE email=?');
    $chk->execute([$email]);
    if ($chk->fetch()) conflict('Bu e-posta zaten kullanımda.');

    $hash     = password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]);
    $memberNo = generateMemberNo();
    $db->prepare('INSERT INTO users (member_no,name,email,password_hash) VALUES (?,?,?,?)')->execute([$memberNo, $name, $email, $hash]);
    $uid = (int)$db->lastInsertId();

    $token = jwtCreate(['user_id' => $uid, 'email' => $email]);
    setAuthCookie($token);
    created('Hesabınız oluşturuldu.', [
        'token' => $token,
        'user'  => ['id'=>$uid,'name'=>$name,'email'=>$email,'points'=>0,'tier'=>'Bronze'],
    ]);
}

// ── GİRİŞ ────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'login') {
    rateLimit('login', 10, 60); // 1 dakikada max 10 giriş denemesi
    $b     = getBody();
    $email = strtolower(trim($b['email'] ?? ''));
    $pass  = $b['password'] ?? '';
    if (!$email || !$pass) badRequest('E-posta ve şifre zorunludur.');

    $stmt = $db->prepare('SELECT id,name,email,password_hash,points,tier,is_active FROM users WHERE email=?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($pass, $user['password_hash'])) respond(false, 'E-posta veya şifre hatalı.', [], 401);
    if (!$user['is_active']) respond(false, 'Hesabınız pasife alınmış.', [], 403);

    $token = jwtCreate(['user_id' => $user['id'], 'email' => $user['email']]);
    setAuthCookie($token);
    ok('Giriş başarılı.', [
        'token' => $token,
        'user'  => array_diff_key($user, ['password_hash' => '', 'is_active' => '']),
    ]);
}

// ── ÇIKIŞ ────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'logout') {
    clearAuthCookie();
    ok('Çıkış yapıldı.');
}

// ── ME ───────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'me') {
    $tok = getTokenFromHeader();
    $pay = $tok ? jwtVerify($tok) : null;
    if (!$pay) unauthorized();

    $stmt = $db->prepare('SELECT id,name,email,phone,birthdate,gender,avatar,points,tier,created_at FROM users WHERE id=? AND is_active=1');
    $stmt->execute([$pay['user_id']]);
    $u = $stmt->fetch();
    if (!$u) notFound('Kullanıcı bulunamadı.');
    ok('Kullanıcı bilgisi.', ['user' => $u]);
}

// ── ŞİFRE DEĞİŞTİR ───────────────────────────────────────────
if ($method === 'PUT' && $action === 'change-password') {
    $tok = getTokenFromHeader();
    $pay = $tok ? jwtVerify($tok) : null;
    if (!$pay) unauthorized();

    $b       = getBody();
    $current = $b['current_password'] ?? '';
    $newPass = $b['new_password'] ?? '';
    if (!$current || !$newPass)   badRequest('Mevcut ve yeni şifre zorunludur.');
    if (strlen($newPass) < 6)     badRequest('Yeni şifre en az 6 karakter olmalı.');

    $stmt = $db->prepare('SELECT password_hash FROM users WHERE id=?');
    $stmt->execute([$pay['user_id']]);
    $u = $stmt->fetch();
    if (!$u || !password_verify($current, $u['password_hash'])) respond(false, 'Mevcut şifre yanlış.', [], 400);

    $db->prepare('UPDATE users SET password_hash=? WHERE id=?')
       ->execute([password_hash($newPass, PASSWORD_BCRYPT, ['cost'=>12]), $pay['user_id']]);
    ok('Şifre güncellendi.');
}

// ── HESAP SİL ────────────────────────────────────────────────
if ($method === 'DELETE' && $action === 'delete') {
    $tok = getTokenFromHeader();
    $pay = $tok ? jwtVerify($tok) : null;
    if (!$pay) unauthorized();

    $b    = getBody();
    $pass = $b['password'] ?? '';
    $stmt = $db->prepare('SELECT password_hash FROM users WHERE id=?');
    $stmt->execute([$pay['user_id']]);
    $u = $stmt->fetch();
    if (!$u || !password_verify($pass, $u['password_hash'])) respond(false, 'Şifre hatalı.', [], 401);

    $db->prepare('UPDATE users SET is_active=0 WHERE id=?')->execute([$pay['user_id']]);
    ok('Hesabınız kapatıldı.');
}

// ── ŞİFRE SIFIRLAMA ONAY ────────────────────────────────────
if ($method === 'POST' && $action === 'reset-password-confirm') {
    $b       = getBody();
    $token   = clean($b['token']        ?? '');
    $newPass = $b['new_password'] ?? '';
    if (!$token || !$newPass)     badRequest('Token ve yeni şifre gerekli.');
    if (strlen($newPass) < 6)     badRequest('Şifre en az 6 karakter olmalı.');

    $db   = getDB();
    $stmt = $db->prepare('SELECT user_id FROM password_resets WHERE token=? AND expires_at>NOW() AND used=0');
    $stmt->execute([$token]);
    $row  = $stmt->fetch();
    if (!$row) respond(false, 'Link geçersiz veya süresi dolmuş.', [], 400);

    $hash = password_hash($newPass, PASSWORD_BCRYPT, ['cost' => 12]);
    $db->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([$hash, $row['user_id']]);
    $db->prepare('UPDATE password_resets SET used=1 WHERE token=?')->execute([$token]);
    ok('Şifreniz başarıyla güncellendi.');
}

respond(false, 'Geçersiz endpoint.', [], 404);

