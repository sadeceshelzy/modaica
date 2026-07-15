<?php
// ============================================================
//  MODAICA — Stok & Fiyat Alarm Cron Job
//  Konum: cron/check-alarms.php
//
//  XAMPP'ta zamanlayıcı: Windows Task Scheduler
//  Komut: php C:\xampp\htdocs\modaica\cron\check-alarms.php
//  Sıklık: Her saat (saatlik)
// ============================================================

// Güvenlik: sadece CLI'dan çalışabilir, web üzerinden erişim engellenir
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('Bu script yalnızca komut satırından çalıştırılabilir.');
}

require_once __DIR__.'/../config/database.php';
require_once __DIR__.'/../helpers/mailer.php';

$db = getDB();

// ── STOK ALARM KONTROLü ──────────────────────────────────
$stockAlarms = $db->query("
  SELECT sa.id, sa.user_id, sa.product_id,
         u.name as user_name, u.email as user_email,
         p.name as product_name, p.brand, p.price, p.emoji, p.sku, p.stock
  FROM stock_alarms sa
  JOIN users u ON u.id=sa.user_id
  JOIN products p ON p.id=sa.product_id
  WHERE sa.notified=0 AND p.stock > 0 AND p.is_active=1
")->fetchAll();

$stockSent = 0;
foreach ($stockAlarms as $alarm) {
  $ok = Mailer::sendStockAlert($alarm['user_email'], $alarm['user_name'], [
    'name'  => $alarm['product_name'],
    'brand' => $alarm['brand'],
    'price' => $alarm['price'],
    'emoji' => $alarm['emoji'],
    'sku'   => $alarm['sku'],
  ]);
  if ($ok) {
    $db->prepare('UPDATE stock_alarms SET notified=1 WHERE id=?')->execute([$alarm['id']]);
    $stockSent++;
    echo "[OK] Stok alarmı gönderildi: {$alarm['user_email']} → {$alarm['product_name']}\n";
  }
}

// ── FİYAT ALARM KONTROLü ─────────────────────────────────
$priceAlarms = $db->query("
  SELECT pa.id, pa.user_id, pa.target_price,
         u.name as user_name, u.email as user_email,
         p.name as product_name, p.price, p.emoji, p.sku, p.brand
  FROM price_alarms pa
  JOIN users u ON u.id=pa.user_id
  JOIN products p ON p.id=pa.product_id
  WHERE pa.notified=0 AND p.price <= pa.target_price AND p.is_active=1
")->fetchAll();

$priceSent = 0;
foreach ($priceAlarms as $alarm) {
  $ok = Mailer::sendPriceAlert($alarm['user_email'], $alarm['user_name'], [
    'name'  => $alarm['product_name'],
    'brand' => $alarm['brand'],
    'price' => $alarm['price'],
    'emoji' => $alarm['emoji'],
    'sku'   => $alarm['sku'],
  ], (float)$alarm['target_price']);
  if ($ok) {
    $db->prepare('UPDATE price_alarms SET notified=1 WHERE id=?')->execute([$alarm['id']]);
    $priceSent++;
    echo "[OK] Fiyat alarmı gönderildi: {$alarm['user_email']} → {$alarm['product_name']}\n";
  }
}

echo "\n✅ Cron tamamlandı. Stok: {$stockSent}, Fiyat: {$priceSent}\n";
