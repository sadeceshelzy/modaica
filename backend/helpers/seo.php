<?php
// ============================================================
//  MODAICA — SEO Yardımcı Sınıfı
//  Konum: helpers/seo.php
// ============================================================
class SEO {

  // ── SAYFA META ETİKETLERİ ────────────────────────────────
  public static function meta(array $opts = []): string {
    $title       = htmlspecialchars($opts['title'] ?? 'MODAICA - Moda & Alışveriş');
    $desc        = htmlspecialchars($opts['description'] ?? 'Türkiye\'nin yükselen moda platformu. Erkek, kadın, elektronik, ev ve daha fazlası.');
    $keywords    = htmlspecialchars($opts['keywords'] ?? 'moda, alışveriş, giyim, elektronik, MODAICA');
    $image       = $opts['image'] ?? 'https://modaica.com/assets/og-default.jpg';
    $url         = $opts['url'] ?? 'https://modaica.com';
    $type        = $opts['type'] ?? 'website';
    $noindex     = ($opts['noindex'] ?? false) ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow">';

    return "
    <!-- SEO Meta -->
    <meta name='description' content='{$desc}'>
    <meta name='keywords' content='{$keywords}'>
    {$noindex}
    <meta name='author' content='MODAICA'>
    <link rel='canonical' href='{$url}'>

    <!-- Open Graph -->
    <meta property='og:title'       content='{$title}'>
    <meta property='og:description' content='{$desc}'>
    <meta property='og:image'       content='{$image}'>
    <meta property='og:url'         content='{$url}'>
    <meta property='og:type'        content='{$type}'>
    <meta property='og:site_name'   content='MODAICA'>
    <meta property='og:locale'      content='tr_TR'>

    <!-- Twitter Card -->
    <meta name='twitter:card'        content='summary_large_image'>
    <meta name='twitter:title'       content='{$title}'>
    <meta name='twitter:description' content='{$desc}'>
    <meta name='twitter:image'       content='{$image}'>

    <!-- PWA -->
    <meta name='theme-color' content='#1a1f5e'>
    <link rel='manifest' href='/modaica/manifest.json'>
    <meta name='mobile-web-app-capable' content='yes'>
    <meta name='apple-mobile-web-app-capable' content='yes'>
    <meta name='apple-mobile-web-app-status-bar-style' content='default'>
    <meta name='apple-mobile-web-app-title' content='MODAICA'>
    <link rel='apple-touch-icon' href='/modaica/assets/icons/icon-192.png'>
    ";
  }

  // ── ÜRÜN JSON-LD ─────────────────────────────────────────
  public static function productSchema(array $p): string {
    $schema = [
      '@context' => 'https://schema.org/',
      '@type'    => 'Product',
      'name'     => $p['name'],
      'description' => $p['description'] ?? $p['name'],
      'brand'    => ['@type' => 'Brand', 'name' => $p['brand'] ?? 'MODAICA'],
      'sku'      => $p['sku'],
      'offers'   => [
        '@type'         => 'Offer',
        'url'           => "https://modaica.com/urun-detay.html?sku={$p['sku']}",
        'priceCurrency' => 'TRY',
        'price'         => $p['price'],
        'availability'  => ($p['stock'] ?? 1) > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        'seller'        => ['@type' => 'Organization', 'name' => 'MODAICA'],
      ],
    ];
    if (!empty($p['rating'])) {
      $schema['aggregateRating'] = [
        '@type'       => 'AggregateRating',
        'ratingValue' => $p['rating'],
        'reviewCount' => $p['review_count'] ?? 0,
        'bestRating'  => 5,
        'worstRating' => 1,
      ];
    }
    return '<script type="application/ld+json">' . json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . '</script>';
  }

  // ── KATEGORİ BreadcrumbList ───────────────────────────────
  public static function breadcrumbSchema(array $crumbs): string {
    $items = [];
    foreach ($crumbs as $i => $crumb) {
      $items[] = [
        '@type'    => 'ListItem',
        'position' => $i + 1,
        'name'     => $crumb['name'],
        'item'     => $crumb['url'] ?? '',
      ];
    }
    $schema = ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $items];
    return '<script type="application/ld+json">' . json_encode($schema, JSON_UNESCAPED_UNICODE) . '</script>';
  }

  // ── ORGANİZASYON ─────────────────────────────────────────
  public static function organizationSchema(): string {
    $schema = [
      '@context' => 'https://schema.org',
      '@type'    => 'Organization',
      'name'     => 'MODAICA',
      'url'      => 'https://modaica.com',
      'logo'     => 'https://modaica.com/assets/logo.png',
      'contactPoint' => [
        '@type'       => 'ContactPoint',
        'telephone'   => '+90-850-000-0000',
        'contactType' => 'customer service',
        'areaServed'  => 'TR',
        'availableLanguage' => 'Turkish',
      ],
      'sameAs' => [
        'https://www.instagram.com/modaica',
        'https://www.twitter.com/modaica',
      ],
    ];
    return '<script type="application/ld+json">' . json_encode($schema, JSON_UNESCAPED_UNICODE) . '</script>';
  }

  // ── SİTEMAP ──────────────────────────────────────────────
  public static function generateSitemap(PDO $db): string {
    $baseUrl  = 'https://modaica.com/modaica';
    $today    = date('Y-m-d');

    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

    // Statik sayfalar
    $static = [
      ['url' => '',              'priority' => '1.0', 'freq' => 'daily'],
      ['url' => '/erkek.html',   'priority' => '0.9', 'freq' => 'daily'],
      ['url' => '/kadin.html',   'priority' => '0.9', 'freq' => 'daily'],
      ['url' => '/elektronik.html','priority'=> '0.9','freq' => 'daily'],
      ['url' => '/ev.html',      'priority' => '0.8', 'freq' => 'weekly'],
      ['url' => '/spor.html',    'priority' => '0.8', 'freq' => 'weekly'],
      ['url' => '/kozmetik.html','priority' => '0.8', 'freq' => 'weekly'],
      ['url' => '/arama.html',   'priority' => '0.7', 'freq' => 'weekly'],
    ];

    foreach ($static as $p) {
      $xml .= "  <url>\n";
      $xml .= "    <loc>{$baseUrl}{$p['url']}</loc>\n";
      $xml .= "    <lastmod>{$today}</lastmod>\n";
      $xml .= "    <changefreq>{$p['freq']}</changefreq>\n";
      $xml .= "    <priority>{$p['priority']}</priority>\n";
      $xml .= "  </url>\n";
    }

    // Ürün sayfaları
    $products = $db->query("SELECT sku, updated_at FROM products WHERE is_active=1 ORDER BY updated_at DESC LIMIT 10000")->fetchAll();
    foreach ($products as $p) {
      $lastmod = substr($p['updated_at'] ?? $today, 0, 10);
      $xml .= "  <url>\n";
      $xml .= "    <loc>{$baseUrl}/urun-detay.html?sku={$p['sku']}</loc>\n";
      $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
      $xml .= "    <changefreq>weekly</changefreq>\n";
      $xml .= "    <priority>0.7</priority>\n";
      $xml .= "  </url>\n";
    }

    $xml .= '</urlset>';
    return $xml;
  }
}
