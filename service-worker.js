// ============================================================
//  MODAICA Service Worker v2.0
//  Konum: /modaica/service-worker.js (kök dizin!)
//  Strateji:
//    CSS/JS/Font → Cache-first + arka planda güncelle
//    HTML         → Network-first + cache fallback
//    API          → Network-only + offline JSON yanıt
//    Diğer        → Stale-while-revalidate
// ============================================================
const CACHE_VERSION = 'modaica-v2';         // Değişince eski cache temizlenir
const STATIC_CACHE  = CACHE_VERSION + '-static';
const PAGE_CACHE    = CACHE_VERSION + '-pages';
const OFFLINE_URL   = '/modaica/offline.html';
const MAX_PAGE_CACHE = 20;                   // Önbellekte max sayfa sayısı

// Uygulama başlangıcında önbelleklenecek zorunlu dosyalar
const STATIC_ASSETS = [
  '/modaica/offline.html',
  '/modaica/manifest.json',
  '/modaica/js/api-client.js',
  '/modaica/js/pwa-init.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap',
];

// ── KURULUM ────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── AKTİVASYON — eski cache sürümlerini temizle ──────────
self.addEventListener('activate', e => {
  const keep = new Set([STATIC_CACHE, PAGE_CACHE]);
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.has(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── FETCH STRATEJİSİ ───────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Yalnızca GET/HEAD önbelleklenir; POST/PUT vb. her zaman ağa gider
  if (request.method !== 'GET' && request.method !== 'HEAD') return;

  // API → Network-only, offline'da JSON hata yanıtı
  if (url.pathname.includes('/api/') || url.pathname.includes('/backend/')) {
    e.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ success: false, message: 'Çevrimdışısınız. İnternet bağlantınızı kontrol edin.' }),
          { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        )
      )
    );
    return;
  }

  // CSS / JS / Font → Cache-first, arka planda güncelle (Stale-while-revalidate)
  if (['style', 'script', 'font'].includes(request.destination)) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async cache => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request).then(res => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        }).catch(() => null);
        // Önbellekte varsa hemen dön, arka planda güncelle
        return cached ?? (await networkFetch) ?? Response.error();
      })
    );
    return;
  }

  // HTML sayfaları → Network-first, cache fallback, en son offline.html
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(async res => {
          if (res.ok) {
            const cache = await caches.open(PAGE_CACHE);
            await limitCacheSize(cache, MAX_PAGE_CACHE);
            cache.put(request, res.clone());
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request, { cacheName: PAGE_CACHE });
          return cached ?? await caches.match(OFFLINE_URL, { cacheName: STATIC_CACHE });
        })
    );
    return;
  }

  // Diğer (resim vb.) → Stale-while-revalidate
  e.respondWith(
    caches.open(STATIC_CACHE).then(async cache => {
      const cached = await cache.match(request);
      const network = fetch(request).then(res => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      });
      return cached || network;
    })
  );
});

// ── YARDIMCI: cache boyutu sınırla ────────────────────────
async function limitCacheSize(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) {
    await cache.delete(keys[0]);
  }
}

// ── PUSH BİLDİRİMLER ──────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); } catch { data = { title: 'MODAICA', body: e.data.text() }; }

  const opts = {
    body:    data.body    || 'Yeni bir bildiriminiz var.',
    icon:    data.icon    || '/modaica/assets/icons/icon-192.png',
    badge:   data.badge   || '/modaica/assets/icons/icon-72.png',
    image:   data.image,
    tag:     data.tag     || 'modaica-notif',
    renotify: true,
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/modaica/index.html' },
    actions: data.actions || [
      { action: 'open',    title: 'Görüntüle' },
      { action: 'dismiss', title: 'Kapat'     },
    ],
  };

  e.waitUntil(self.registration.showNotification(data.title || 'MODAICA', opts));
});

// ── BİLDİRİM TIKLAMA ──────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = e.notification.data?.url || '/modaica/index.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('modaica'));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});

// ── ARKA PLAN SYNC ─────────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-cart') {
    e.waitUntil(syncCart());
  }
});

async function syncCart() {
  // Çevrimdışı eklenen sepet öğelerini senkronize et
  const pending = await getPendingCartItems();
  if (!pending.length) return;
  for (const item of pending) {
    try {
      await fetch('/modaica/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
    } catch (_) {}
  }
}

async function getPendingCartItems() {
  // IndexedDB'den bekleyen öğeleri al (basit implementasyon)
  return [];
}
