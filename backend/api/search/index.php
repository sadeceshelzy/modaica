<?php
// ============================================================
//  MODAICA — Akıllı Arama Motoru
//  GET /api/search?q=          → Akıllı arama
//  GET /api/search/suggest?q=  → Canlı öneri (autocomplete)
//  GET /api/search/popular     → Popüler aramalar
//  GET /api/search/history     → Kullanıcı geçmişi
//  POST /api/search/log        → Arama logla
// ============================================================
require_once __DIR__.'/../../config/app.php';
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../helpers/jwt.php';
require_once __DIR__.'/../../helpers/response.php';
require_once __DIR__.'/../../helpers/validate.php';
require_once __DIR__.'/../../middleware/rate-limit.php';
setCORSHeaders();

rateLimit('search', 60, 60); // 1 dakikada max 60 arama isteği

$method = $_SERVER['REQUEST_METHOD'];
$uri    = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$parts  = explode('/', $uri);
$sub    = $parts[4] ?? ''; // suggest | popular | history | log
$db     = getDB();

// Auth opsiyonel
$tok = getTokenFromHeader();
$pay = $tok ? jwtVerify($tok) : null;
$uid = $pay['user_id'] ?? null;

// ── TÜRKÇE NORMALİZASYON ─────────────────────────────────────
function normalize(string $text): string {
    $text = mb_strtolower($text, 'UTF-8');
    $map  = [
        'ı' => 'i', 'İ' => 'i', 'ğ' => 'g', 'Ğ' => 'g',
        'ü' => 'u', 'Ü' => 'u', 'ş' => 's', 'Ş' => 's',
        'ö' => 'o', 'Ö' => 'o', 'ç' => 'c', 'Ç' => 'c',
    ];
    return strtr($text, $map);
}

// ── LEVENSHTEIN (fuzzy match) ─────────────────────────────────
function fuzzyScore(string $a, string $b): float {
    $a = normalize($a); $b = normalize($b);
    if ($a === $b) return 1.0;
    if (str_contains($b, $a)) return 0.9;
    $dist = levenshtein($a, $b);
    $max  = max(strlen($a), strlen($b));
    if ($max === 0) return 1.0;
    return max(0, 1 - ($dist / $max));
}

// ── NİYET ANALİZİ ────────────────────────────────────────────
function parseIntent(string $q): array {
    $q    = mb_strtolower($q, 'UTF-8');
    $sort = 'popular'; $maxPrice = null; $minPrice = null;
    $dept = null; $badge = null;

    // Fiyat niyeti
    if (preg_match('/(ucuz|ekonomik|uygun|hesapl)/u', $q)) $sort = 'price_asc';
    if (preg_match('/(pahali|premium|lüks|kaliteli)/u', $q))   $sort = 'price_desc';
    if (preg_match('/(iyi|en iyi|çok satan|popüler)/u', $q))   $sort = 'rating';
    if (preg_match('/(yeni|son|güncel|taze)/u', $q))            $sort = 'newest';
    if (preg_match('/(indirim|kampanya|fırsat|sale)/u', $q))    $badge = 'sale';

    // Bütçe çıkarma: "500 TL", "1000 lira", "2000₺ altı/üstü"
    if (preg_match('/(\d+)\s*(?:tl|lira|₺)\s*(alt|kadar|\'ye kadar|den az)/ui', $q, $m)) {
        $maxPrice = (int)$m[1];
    }
    if (preg_match('/(\d+)\s*(?:tl|lira|₺)/ui', $q, $m) && !$maxPrice) {
        $maxPrice = (int)$m[1] * 1.2; // %20 esneklik
        $minPrice = (int)$m[1] * 0.8;
    }
    if (preg_match('/(\d+)\s*[-–]\s*(\d+)\s*(?:tl|lira|₺)?/ui', $q, $m)) {
        $minPrice = (int)$m[1]; $maxPrice = (int)$m[2];
    }

    // Departman tespiti
    $deptMap = [
        'erkek|erkekler|bay'        => 'erkek',
        'kadın|bayan|kız'           => 'kadin',
        'telefon|bilgisayar|laptop|tablet|elektronik' => 'elektronik',
        'ev|mutfak|mobilya|dekor'   => 'ev',
        'spor|fitness|outdoor|koşu' => 'spor',
        'kozmetik|makyaj|parfüm|cilt|bakım' => 'kozmetik',
    ];
    foreach ($deptMap as $pattern => $d) {
        if (preg_match("/($pattern)/u", $q)) { $dept = $d; break; }
    }

    // Temiz arama terimi (niyet kelimelerini çıkar)
    $stopWords = ['ucuz','pahalı','yeni','iyi','en','çok','altı','üstü','lira','tl','₺','için','bana','ver','öner','istiyorum','al'];
    $words = array_filter(explode(' ', $q), fn($w) => strlen($w) > 2 && !in_array($w, $stopWords));
    $cleanQuery = implode(' ', $words);

    return compact('sort', 'maxPrice', 'minPrice', 'dept', 'badge', 'cleanQuery');
}

// ── YAZIM DÜZELTME SÖZLÜĞÜ ───────────────────────────────────
function correctTypo(string $q): string {
    $corrections = [
        'ayfon' => 'iphone', 'ayfone' => 'iphone', 'iphon' => 'iphone',
        'samsun' => 'samsung', 'samssung' => 'samsung',
        'bilgsayar' => 'bilgisayar', 'blgisayar' => 'bilgisayar',
        'telefom' => 'telefon', 'teleofn' => 'telefon',
        'kualklık' => 'kulaklık', 'kulaklik' => 'kulaklık',
        'spiker' => 'hoparlör', 'hopalar' => 'hoparlör',
        'tişort' => 'tişört', 'tshirt' => 'tişört', 't-shirt' => 'tişört',
        'pantalon' => 'pantolon', 'pantlon' => 'pantolon',
        'ayakabı' => 'ayakkabı', 'ayakkap' => 'ayakkabı',
        'çanta' => 'çanta', 'canta' => 'çanta',
        'gozluk' => 'gözlük', 'gözlug' => 'gözlük',
        'parfum' => 'parfüm', 'perfume' => 'parfüm',
        'bileklik' => 'bilezik', 'kolye' => 'kolye',
        'laptop' => 'dizüstü bilgisayar',
        'smartwatch' => 'akıllı saat', 'smart watch' => 'akıllı saat',
        'earbuds' => 'kablosuz kulaklık', 'airpods' => 'kablosuz kulaklık',
    ];
    $lower = strtolower(trim($q));
    return $corrections[$lower] ?? $q;
}

// ── ANA ARAMA ─────────────────────────────────────────────────
if ($method === 'GET' && !$sub) {
    $rawQ   = trim($_GET['q'] ?? '');
    $page   = max(1, (int)($_GET['page'] ?? 1));
    $limit  = 12;
    $offset = ($page - 1) * $limit;

    if (!$rawQ) badRequest('Arama terimi gerekli.');

    // Yazım düzeltme
    $corrected = correctTypo($rawQ);
    $wasFixed  = ($corrected !== $rawQ);

    // Niyet analizi
    $intent = parseIntent($corrected);
    $q      = $intent['cleanQuery'] ?: $corrected;
    $qNorm  = normalize($q);

    // Filtreler
    $where  = ['p.is_active=1'];
    $params = [];

    // Metin araması — çoklu alan
    if ($q) {
        $where[]  = '(p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ? OR p.category_slug LIKE ?)';
        $likeQ    = "%{$q}%";
        $params[] = $likeQ; $params[] = $likeQ; $params[] = $likeQ; $params[] = $likeQ;
    }
    if ($intent['dept'])     { $where[] = 'p.department=?'; $params[] = $intent['dept']; }
    if ($intent['maxPrice']) { $where[] = 'p.price<=?';     $params[] = $intent['maxPrice']; }
    if ($intent['minPrice']) { $where[] = 'p.price>=?';     $params[] = $intent['minPrice']; }
    if ($intent['badge'])    { $where[] = 'p.badge=?';      $params[] = $intent['badge']; }

    // Sıralama
    $orderBy = match($intent['sort']) {
        'price_asc'  => 'p.price ASC',
        'price_desc' => 'p.price DESC',
        'rating'     => 'p.avg_rating DESC, p.review_count DESC',
        'newest'     => 'p.created_at DESC',
        default      => 'p.review_count DESC, p.avg_rating DESC',
    };

    $wSql   = implode(' AND ', $where);
    $cStmt  = $db->prepare("SELECT COUNT(*) FROM products p WHERE $wSql");
    $cStmt->execute($params);
    $total  = (int)$cStmt->fetchColumn();

    $stmt   = $db->prepare("SELECT * FROM products p WHERE $wSql ORDER BY $orderBy LIMIT $limit OFFSET $offset");
    $stmt->execute($params);
    $items  = $stmt->fetchAll();

    // Eğer sonuç azsa → fuzzy arama ile genişlet
    $fuzzyUsed = false;
    if (count($items) < 3 && $q) {
        $allStmt = $db->prepare("SELECT * FROM products p WHERE p.is_active=1 ORDER BY p.review_count DESC LIMIT 500");
        $allStmt->execute();
        $all = $allStmt->fetchAll();

        // Fuzzy skorla
        $scored = [];
        foreach ($all as $p) {
            $score = max(
                fuzzyScore($qNorm, normalize($p['name'])),
                fuzzyScore($qNorm, normalize($p['brand'] ?? '')),
                fuzzyScore($qNorm, normalize($p['category_slug'] ?? ''))
            );
            if ($score >= 0.55) $scored[] = ['score' => $score, 'product' => $p];
        }
        usort($scored, fn($a,$b) => $b['score'] <=> $a['score']);
        $fuzzyItems = array_map(fn($s) => $s['product'], array_slice($scored, 0, $limit));

        if ($fuzzyItems) {
            $items    = $fuzzyItems;
            $fuzzyUsed = true;
        }
    }

    // Aramayı logla
    if ($uid && $rawQ) {
        try {
            $db->prepare('INSERT INTO search_history (user_id, query, results_count) VALUES (?,?,?) ON DUPLICATE KEY UPDATE created_at=NOW(), results_count=?')
               ->execute([$uid, $rawQ, $total, $total]);
            $db->prepare('INSERT INTO search_logs (query, results_count) VALUES (?,?) ON DUPLICATE KEY UPDATE search_count=search_count+1, last_searched=NOW()')
               ->execute([$rawQ, $total]);
        } catch (\Throwable $e) {}
    }

    ok('Arama sonuçları.', [
        'items'       => $items,
        'total'       => $total ?: count($items),
        'page'        => $page,
        'total_pages' => max(1, (int)ceil(($total ?: count($items)) / $limit)),
        'query'       => $rawQ,
        'corrected'   => $wasFixed ? $corrected : null,
        'fuzzy_used'  => $fuzzyUsed,
        'intent'      => [
            'sort'      => $intent['sort'],
            'dept'      => $intent['dept'],
            'max_price' => $intent['maxPrice'],
            'min_price' => $intent['minPrice'],
        ],
    ]);
}

// ── CANLI ÖNERİ (Autocomplete) ───────────────────────────────
if ($method === 'GET' && $sub === 'suggest') {
    $q = trim($_GET['q'] ?? '');
    if (strlen($q) < 2) ok('Öneriler.', ['suggestions' => []]);

    $qNorm = normalize($q);

    // 1. Popüler aramalar içinde ara
    $popStmt = $db->prepare("SELECT query FROM search_logs WHERE query LIKE ? ORDER BY search_count DESC LIMIT 5");
    $popStmt->execute(["%$q%"]);
    $popSuggestions = $popStmt->fetchAll(PDO::FETCH_COLUMN);

    // 2. Ürün adı/marka önerileri
    $pStmt = $db->prepare("SELECT DISTINCT name as suggestion, 'product' as type FROM products WHERE name LIKE ? AND is_active=1 UNION SELECT DISTINCT brand, 'brand' FROM products WHERE brand LIKE ? AND is_active=1 ORDER BY suggestion LIMIT 8");
    $pStmt->execute(["%$q%", "%$q%"]);
    $productSuggestions = $pStmt->fetchAll();

    // 3. Kategori önerileri
    $catStmt = $db->prepare("SELECT DISTINCT name as suggestion, 'category' as type FROM categories WHERE name LIKE ? LIMIT 3");
    $catSuggestions = [];
    try { $catStmt->execute(["%$q%"]); $catSuggestions = $catStmt->fetchAll(); } catch(\Throwable $e) {}

    // Fuzzy öneri (yazım hatası toleransı)
    $fuzzySuggestions = [];
    if (count($productSuggestions) < 3) {
        $allTerms = $db->query("SELECT DISTINCT name FROM products WHERE is_active=1 LIMIT 1000")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($allTerms as $term) {
            if (fuzzyScore($qNorm, normalize($term)) > 0.7 && !in_array($term, array_column($productSuggestions, 'suggestion'))) {
                $fuzzySuggestions[] = ['suggestion' => $term, 'type' => 'fuzzy'];
                if (count($fuzzySuggestions) >= 3) break;
            }
        }
    }

    // Yazım düzeltme önerisi
    $corrected = correctTypo($q);
    $correction = ($corrected !== $q) ? ['suggestion' => $corrected, 'type' => 'correction'] : null;

    ok('Öneriler.', [
        'suggestions' => array_slice(array_merge(
            $correction ? [$correction] : [],
            array_map(fn($s) => ['suggestion' => $s, 'type' => 'popular'], $popSuggestions),
            $productSuggestions,
            $catSuggestions,
            $fuzzySuggestions
        ), 0, 10),
        'query' => $q,
    ]);
}

// ── POPÜLER ARAMALAR ─────────────────────────────────────────
if ($method === 'GET' && $sub === 'popular') {
    try {
        $stmt = $db->query("SELECT query, search_count FROM search_logs WHERE results_count>0 ORDER BY search_count DESC LIMIT 12");
        ok('Popüler aramalar.', ['terms' => $stmt->fetchAll()]);
    } catch(\Throwable $e) {
        // Tablo yoksa varsayılan döndür
        ok('Popüler aramalar.', ['terms' => [
            ['query'=>'iphone','search_count'=>0], ['query'=>'elbise','search_count'=>0],
            ['query'=>'sneaker','search_count'=>0], ['query'=>'çanta','search_count'=>0],
            ['query'=>'kulaklık','search_count'=>0], ['query'=>'parfüm','search_count'=>0],
        ]]);
    }
}

// ── GEÇMİŞ ──────────────────────────────────────────────────
if ($method === 'GET' && $sub === 'history') {
    if (!$uid) ok('Geçmiş.', ['history' => []]);
    $stmt = $db->prepare("SELECT query, results_count, created_at FROM search_history WHERE user_id=? ORDER BY created_at DESC LIMIT 10");
    $stmt->execute([$uid]);
    ok('Arama geçmişi.', ['history' => $stmt->fetchAll()]);
}

// ── ARAMA LOGLA ──────────────────────────────────────────────
if ($method === 'POST' && $sub === 'log') {
    $b = getBody();
    $q = clean($b['query'] ?? '');
    if ($q) {
        try {
            $db->prepare("INSERT INTO search_logs (query, search_count, results_count) VALUES (?,1,?) ON DUPLICATE KEY UPDATE search_count=search_count+1, last_searched=NOW()")
               ->execute([$q, $b['results_count'] ?? 0]);
        } catch(\Throwable $e) {}
    }
    ok('Loglandı.');
}

respond(false, 'Geçersiz endpoint.', [], 404);
