// ============================================================
//  MODAICA — Kişiselleştirilmiş Ürün Önerileri
//  Her bölüm bağımsız kullanılabilir
// ============================================================
(function () {
  'use strict';

  const API   = 'http://' + (window.location.hostname || 'localhost') + '/modaica/backend/api';
  const TOKEN = () => localStorage.getItem('modaica_token') || '';

  // ── YARDIMCI FONKSİYONLAR ──────────────────────────────────
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
  }

  function fmt(n) {
    return parseFloat(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function cardHtml(p) {
    const discount = p.old_price && p.old_price > p.price
      ? Math.round((p.old_price - p.price) / p.old_price * 100) : 0;
    const safeBadge = badgeLabel(p.badge);
    return `
      <a href="urun-detay.html?sku=${encodeURIComponent(p.sku)}" class="rec-card" style="text-decoration:none;">
        <div class="rec-card-img">
          <span class="rec-card-emoji">${esc(p.emoji || '🛍️')}</span>
          ${discount > 0 ? `<span class="rec-card-discount">-%${discount}</span>` : ''}
          ${safeBadge ? `<span class="rec-card-badge">${esc(safeBadge)}</span>` : ''}
        </div>
        <div class="rec-card-body">
          ${p.brand ? `<div class="rec-card-brand">${esc(p.brand)}</div>` : ''}
          <div class="rec-card-name">${esc(p.name)}</div>
          <div class="rec-card-rating">
            <svg viewBox="0 0 24 24" fill="#f4a226" width="12" height="12"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            ${esc(String(p.rating || '4.5'))} <span>(${Number(p.review_count || 0)})</span>
          </div>
          <div class="rec-card-price">
            <strong>₺${fmt(p.price)}</strong>
            ${p.old_price ? `<s>₺${fmt(p.old_price)}</s>` : ''}
          </div>
        </div>
      </a>`;
  }

  function badgeLabel(b) {
    return { new: 'YENİ', sale: 'İNDİRİM', hot: '🔥', limited: 'SON' }[b] || '';
  }

  function injectStyles() {
    if (document.getElementById('rec-styles')) return;
    const s = document.createElement('style');
    s.id = 'rec-styles';
    s.textContent = `
      .rec-section { margin: 32px 0; }
      .rec-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
      .rec-header h2 { font-size: 18px; font-weight: 700; color: #1c1c2e; font-family: 'DM Sans', sans-serif; }
      .rec-see-all { font-size: 13px; color: #2d3aaa; font-weight: 600; text-decoration: none; font-family: 'DM Sans', sans-serif; }
      .rec-see-all:hover { text-decoration: underline; }
      .rec-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; scroll-snap-type: x mandatory; }
      .rec-scroll::-webkit-scrollbar { height: 4px; }
      .rec-scroll::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }
      .rec-card { flex-shrink: 0; width: 170px; background: white; border-radius: 14px; border: 1px solid #e5e7eb; overflow: hidden; scroll-snap-align: start; transition: transform .2s, box-shadow .2s; color: #1c1c2e; }
      .rec-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,.1); }
      .rec-card-img { height: 140px; background: #f8f9fc; display: flex; align-items: center; justify-content: center; position: relative; }
      .rec-card-emoji { font-size: 52px; }
      .rec-card-discount { position: absolute; top: 8px; right: 8px; background: #e63946; color: white; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; font-family: 'DM Sans', sans-serif; }
      .rec-card-badge { position: absolute; top: 8px; left: 8px; background: #166834; color: white; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; font-family: 'DM Sans', sans-serif; }
      .rec-card-body { padding: 10px 12px 12px; }
      .rec-card-brand { font-size: 11px; color: #6b7280; font-weight: 500; margin-bottom: 2px; font-family: 'DM Sans', sans-serif; }
      .rec-card-name { font-size: 13px; font-weight: 600; line-height: 1.4; margin-bottom: 5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-family: 'DM Sans', sans-serif; }
      .rec-card-rating { display: flex; align-items: center; gap: 3px; font-size: 11px; color: #6b7280; margin-bottom: 6px; font-family: 'DM Sans', sans-serif; }
      .rec-card-price { font-size: 14px; font-weight: 700; color: #1a1f5e; font-family: 'DM Sans', sans-serif; }
      .rec-card-price s { font-size: 11px; color: #9ca3af; font-weight: 400; margin-left: 5px; }
      .rec-empty { color: #9ca3af; font-size: 13px; padding: 16px 0; font-family: 'DM Sans', sans-serif; }
      .rec-skeleton { display: flex; gap: 12px; overflow: hidden; }
      .rec-skel-card { flex-shrink: 0; width: 170px; height: 250px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; border-radius: 14px; animation: rec-shimmer 1.5s infinite; }
      @keyframes rec-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      /* Son baktıklarım chip */
      .rec-history-chip { display: inline-flex; align-items: center; gap: 6px; background: white; border: 1px solid #e5e7eb; border-radius: 20px; padding: 4px 10px 4px 6px; font-size: 12px; font-weight: 500; color: #374151; cursor: pointer; transition: all .18s; margin: 0 4px 4px 0; text-decoration: none; }
      .rec-history-chip:hover { border-color: #1a1f5e; color: #1a1f5e; }
      .rec-history-chip span:first-child { font-size: 18px; }
    `;
    document.head.appendChild(s);
  }

  // ── SON BAKTIKLARIN (localStorage) ─────────────────────────
  const HISTORY_KEY = 'modaica_viewed';
  const MAX_HISTORY = 12;

  function trackView(sku, name, emoji, price) {
    const history = getHistory();
    const filtered = history.filter(h => h.sku !== sku);
    filtered.unshift({ sku, name, emoji, price, ts: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)));
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  }

  // ── SON BAKTIKLARIN WIDGET ───────────────────────────────────
  async function renderRecentlyViewed(containerId) {
    injectStyles();
    const el = document.getElementById(containerId);
    if (!el) return;

    const history = getHistory();
    if (!history.length) return; // Göster bile

    // Detay getir
    const skus = history.slice(0, 8).map(h => h.sku).join(',');
    let products = [];
    try {
      const r = await fetch(`${API}/recommendations/recently-viewed?skus=${skus}`);
      const d = await r.json();
      if (d.success) products = d.data.items;
    } catch (_) {
      // Fallback: localStorage'dan göster
      products = history.slice(0, 8).map(h => ({
        sku: h.sku, name: h.name, emoji: h.emoji || '🛍️',
        price: h.price, rating: 4.5, review_count: 0,
      }));
    }

    if (!products.length) return;

    el.innerHTML = `
      <div class="rec-section">
        <div class="rec-header">
          <h2>🕐 Son Baktıklarınız</h2>
          <a href="#" class="rec-see-all" onclick="modaRecent.clearHistory();this.closest('.rec-section').remove();return false;">Temizle</a>
        </div>
        <div class="rec-scroll">
          ${products.map(p => cardHtml(p)).join('')}
        </div>
      </div>`;
  }

  // ── BİRLİKTE ALINANLAR ─────────────────────────────────────
  async function renderAlsoBought(containerId, productSku) {
    injectStyles();
    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = `<div class="rec-section"><div class="rec-header"><h2>🛒 Birlikte Satın Alınanlar</h2></div><div class="rec-skeleton">${Array(4).fill('<div class="rec-skel-card"></div>').join('')}</div></div>`;

    try {
      const r = await fetch(`${API}/recommendations/also-bought?product_id=${productSku}&limit=8`);
      const d = await r.json();
      const items = d.success ? d.data.items : [];
      el.innerHTML = items.length ? `
        <div class="rec-section">
          <div class="rec-header">
            <h2>🛒 Birlikte Satın Alınanlar</h2>
            <a href="arama.html" class="rec-see-all">Tümünü Gör →</a>
          </div>
          <div class="rec-scroll">${items.map(p => cardHtml(p)).join('')}</div>
        </div>` : '';
    } catch (_) { el.innerHTML = ''; }
  }

  // ── TREND ÜRÜNLER ─────────────────────────────────────────
  async function renderTrending(containerId, department = '') {
    injectStyles();
    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = `<div class="rec-section"><div class="rec-header"><h2>🔥 Trend Ürünler</h2></div><div class="rec-skeleton">${Array(4).fill('<div class="rec-skel-card"></div>').join('')}</div></div>`;

    try {
      const q   = department ? `?department=${department}` : '';
      const r   = await fetch(`${API}/recommendations/trending${q}`);
      const d   = await r.json();
      const items = d.success ? d.data.items : [];
      el.innerHTML = items.length ? `
        <div class="rec-section">
          <div class="rec-header">
            <h2>🔥 Bu Hafta Çok Satan</h2>
            <a href="arama.html?sort=popular" class="rec-see-all">Tümünü Gör →</a>
          </div>
          <div class="rec-scroll">${items.map(p => cardHtml(p)).join('')}</div>
        </div>` : '';
    } catch (_) { el.innerHTML = ''; }
  }

  // ── SİZİN İÇİN ────────────────────────────────────────────
  async function renderForYou(containerId) {
    injectStyles();
    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = `<div class="rec-section"><div class="rec-header"><h2>✨ Sizin İçin</h2></div><div class="rec-skeleton">${Array(4).fill('<div class="rec-skel-card"></div>').join('')}</div></div>`;

    try {
      const r   = await fetch(`${API}/recommendations/for-you`, {
        headers: TOKEN() ? { 'Authorization': 'Bearer ' + TOKEN() } : {},
      });
      const d   = await r.json();
      const items = d.success ? d.data.items : [];
      el.innerHTML = items.length ? `
        <div class="rec-section">
          <div class="rec-header">
            <h2>✨ Sizin İçin Seçtik</h2>
            <a href="arama.html" class="rec-see-all">Daha Fazla →</a>
          </div>
          <div class="rec-scroll">${items.map(p => cardHtml(p)).join('')}</div>
        </div>` : '';
    } catch (_) { el.innerHTML = ''; }
  }

  // ── BENZER ÜRÜNLER ────────────────────────────────────────
  async function renderSimilar(containerId, productSku) {
    injectStyles();
    const el = document.getElementById(containerId);
    if (!el) return;

    try {
      const r   = await fetch(`${API}/recommendations?product_id=${productSku}&limit=8`);
      const d   = await r.json();
      const items = d.success ? d.data.items : [];
      el.innerHTML = items.length ? `
        <div class="rec-section">
          <div class="rec-header"><h2>🔗 Benzer Ürünler</h2></div>
          <div class="rec-scroll">${items.map(p => cardHtml(p)).join('')}</div>
        </div>` : '';
    } catch (_) { el.innerHTML = ''; }
  }

  // ── GLOBAL API ────────────────────────────────────────────
  window.modaRecent = {
    // Ürün detay sayfasında çağır
    trackView,
    // History temizle
    clearHistory: () => localStorage.removeItem(HISTORY_KEY),
    getHistory,

    // Widget'ları render et
    renderRecentlyViewed,
    renderAlsoBought,
    renderTrending,
    renderForYou,
    renderSimilar,

    // Hepsini tek seferde yükle (ana sayfa)
    async renderAll(opts = {}) {
      const { recentId, trendingId, forYouId, dept } = opts;
      const promises = [];
      if (recentId)   promises.push(renderRecentlyViewed(recentId));
      if (trendingId) promises.push(renderTrending(trendingId, dept));
      if (forYouId)   promises.push(renderForYou(forYouId));
      await Promise.all(promises);
    },
  };

})();

/* ──────────────────────────────────────────────────────────────
   KULLANIM ÖRNEKLERİ
   ──────────────────────────────────────────────────────────────

   ── Ana Sayfa (index.html) ──
   <div id="rec-recently-viewed"></div>
   <div id="rec-for-you"></div>
   <div id="rec-trending"></div>
   <script src="js/recommendations.js"></script>
   <script>
     modaRecent.renderAll({
       recentId:   'rec-recently-viewed',
       forYouId:   'rec-for-you',
       trendingId: 'rec-trending',
     });
   </script>

   ── Ürün Detay (urun-detay.html) ──
   // Sayfanın JS'inde, ürün bilgisi yüklenince:
   modaRecent.trackView(sku, name, emoji, price); // Görüntülemeyi kaydet

   <div id="rec-also-bought"></div>
   <div id="rec-similar"></div>
   <script src="js/recommendations.js"></script>
   <script>
     const sku = new URLSearchParams(location.search).get('sku');
     modaRecent.renderAlsoBought('rec-also-bought', sku);
     modaRecent.renderSimilar('rec-similar', sku);
   </script>

   ── Kategori Sayfası (erkek.html vb) ──
   <div id="rec-trending-dept"></div>
   <script>
     modaRecent.renderTrending('rec-trending-dept', 'erkek');
   </script>
──────────────────────────────────────────────────────────────── */
