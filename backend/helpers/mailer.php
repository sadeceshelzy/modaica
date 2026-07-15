<?php
// ============================================================
//  MODAICA — Mailer Yardımcısı
//  Basit e-posta gönderici (PHP mail() veya SMTP stub)
// ============================================================
class Mailer {
    private static string $from    = 'no-reply@modaica.com';
    private static string $fromName = 'MODAICA';

    // ── Stok Alarmı ──────────────────────────────────────────
    public static function sendStockAlert(string $to, string $toName, array $product): bool {
        $name  = htmlspecialchars($product['name']  ?? 'Ürün');
        $brand = htmlspecialchars($product['brand'] ?? '');
        $price = number_format((float)($product['price'] ?? 0), 2, ',', '.');
        $emoji = $product['emoji'] ?? '📦';
        $sku   = rawurlencode($product['sku'] ?? '');

        $subject = "[MODAICA] {$emoji} {$name} stoka girdi!";
        $body    = "Merhaba {$toName},\n\n"
                 . "Takibe aldığınız ürün stoka girdi!\n\n"
                 . "Ürün  : {$emoji} {$brand} {$name}\n"
                 . "Fiyat : ₺{$price}\n\n"
                 . "Hemen inceleyin: http://localhost/modaica/urun-detay.html?sku={$sku}\n\n"
                 . "İyi alışverişler,\nMODAICA Ekibi";

        return self::send($to, $subject, $body);
    }

    // ── Fiyat Alarmı ─────────────────────────────────────────
    public static function sendPriceAlert(string $to, string $toName, array $product, float $targetPrice): bool {
        $name  = htmlspecialchars($product['name']  ?? 'Ürün');
        $brand = htmlspecialchars($product['brand'] ?? '');
        $price = number_format((float)($product['price'] ?? 0), 2, ',', '.');
        $target = number_format($targetPrice, 2, ',', '.');
        $emoji = $product['emoji'] ?? '📦';
        $sku   = rawurlencode($product['sku'] ?? '');

        $subject = "[MODAICA] 💰 {$name} fiyatı düştü!";
        $body    = "Merhaba {$toName},\n\n"
                 . "Fiyat alarmı kurduğunuz ürünün fiyatı hedef fiyatınıza ulaştı!\n\n"
                 . "Ürün         : {$emoji} {$brand} {$name}\n"
                 . "Güncel Fiyat : ₺{$price}\n"
                 . "Hedef Fiyat  : ₺{$target}\n\n"
                 . "Hemen inceleyin: http://localhost/modaica/urun-detay.html?sku={$sku}\n\n"
                 . "İyi alışverişler,\nMODAICA Ekibi";

        return self::send($to, $subject, $body);
    }

    // ── Sipariş Onayı ────────────────────────────────────────
    public static function sendOrderConfirmation(string $to, string $toName, string $orderCode, float $total): bool {
        $subject = "[MODAICA] Siparişiniz alındı: {$orderCode}";
        $fmt     = number_format($total, 2, ',', '.');
        $body    = "Merhaba {$toName},\n\n"
                 . "Siparişiniz başarıyla alındı.\n\n"
                 . "Sipariş No : {$orderCode}\n"
                 . "Toplam     : ₺{$fmt}\n\n"
                 . "Sipariş durumunuzu takip edin: http://localhost/modaica/siparis-takip.html?code={$orderCode}\n\n"
                 . "İyi alışverişler,\nMODAICA Ekibi";

        return self::send($to, $subject, $body);
    }

    // ── Düşük seviye gönderici ───────────────────────────────
    private static function send(string $to, string $subject, string $body): bool {
        $headers  = "From: " . self::$fromName . " <" . self::$from . ">\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $headers .= "X-Mailer: MODAICA/1.0\r\n";

        // XAMPP geliştirme ortamında mail() çağrısı; production'da SMTP kütüphanesiyle değiştirilmeli
        try {
            $result = @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
            return (bool)$result;
        } catch (\Throwable $e) {
            error_log('Mailer error: ' . $e->getMessage());
            return false;
        }
    }
}
