// ============================================================
//  MODAICA — Ürün Öneri Widget
//  Kullanım örnekleri aşağıda
// ============================================================

class RecommendationsWidget {
  constructor(config) {
    this.container = document.getElementById(config.containerId);
    this.type      = config.type;      // 'also-bought'|'trending'|'for-you'|'recently-viewed'|'similar'
    this.title     = config.title;
    this.productId = config.productId || null;
    this.department= config.department || '';
    this.API       = (typeof API_BASE !== 'undefined' ? API_BASE : ('http://' + location.hostname + (location.port ? ':' + location.port : '') + '/modaica/backend')) + '/api';
    this.token     = localStorage.getItem('modaica_token') || '';
    if (!this.container) return;
    this.init();
  }

  async init() {
    // Son bakılanları kaydet
    if (this.productId && this.type !== 'recently-viewed') {
      this.trackView(this.productId);
    }
    const items = await this.fetchItems();
    if (!items?.length) { this.container.style.display = 'none'; return; }
    this.render(items);
  }

  async fetchItems() {
    try {
      let url = `${this.API}/recommendations/${this.type}?limit=8`;
      if (this.productId)  url += `&product_id=${encodeURIComponent(this.productId)}`;
      if (this.department) url += `&department=${encodeURIComponent(this.department)}`;
      if (this.type === 'recently-viewed') {
        const skus = this.getRecentlyViewed().join(',');
        if (!skus) return [];
        url += `&skus=${skus}`;
      }
      const r = await fetch(url, {
        headers: this.token ? { 'Authorization': 'Bearer ' + this.token } : {}
      });
      const d = await r.json();
      return d.success ? d.data.items : [];
    } catch { return []; }
  }

  render(items) {
    this.container.innerHTML = `
      <style>
        .rec-section { margin: 28px 0; }
        .rec-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding: 0 2px; }
        .rec-title { font-size: 18px; font-weight: 700; color: #1c1c2e; font-family: 'DM Sans', sans-serif; }
        .rec-see-all { font-size: 13px; color: #2d3aaa; font-weight: 600; text-decoration: none; font-family: 'DM Sans', sans-serif; }
        .rec-see-all:hover { text-decoration: underline; }
        .rec-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; scroll-snap-type: x mandatory; }
        .rec-scroll::-webkit-scrollbar { height: 4px; }
        .rec-scroll::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }
        .rec-card {
          flex-shrink: 0; width: 170px; background: white;
          border-radius: 14px; border: 1px solid #e5e7eb;
          overflow: hidden; cursor: pointer; scroll-snap-align: start;
          transition: transform .2s, box-shadow .2s; text-decoration: none; color: inherit; display: block;
          box-shadow: 0 2px 8px rgba(0,0,0,.04);
        }
        .rec-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,.1); }
        .rec-img { height: 155px; background: #f8f9fc; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
        .rec-img img { width: 100%; height: 100%; object-fit: cover; }
        .rec-img .rec-emoji { font-size: 52px; }
        .rec-badge { position: absolute; top: 7px; left: 7px; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; }
        .rec-badge.new    { background: #166834; color: white; }
        .rec-badge.sale   { background: #e63946; color: white; }
        .rec-badge.hot    { background: #f97316; color: white; }
        .rec-discount { position: absolute; top: 7px; right: 7px; background: #e63946; color: white; font-size: 10px; font-weight: 700; padding: 3px 7px; border-radius: 6px; }
        .rec-info { padding: 10px 11px 12px; }
        .rec-brand { font-size: 11px; color: #6b7280; font-weight: 500; margin-bottom: 2px; font-family: 'DM Sans', sans-serif; }
        .rec-name { font-size: 13px; font-weight: 600; color: #1c1c2e; line-height: 1.4; margin-bottom: 5px; font-family: 'DM Sans', sans-serif; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .rec-stars { display: flex; align-items: center; gap: 3px; margin-bottom: 5px; }
        .rec-star { color: #f4a226; font-size: 11px; }
        .rec-rating-text { font-size: 11px; color: #6b7280; font-family: 'DM Sans', sans-serif; }
        .rec-price { font-size: 15px; font-weight: 700; color: #1a1f5e; font-family: 'DM Sans', sans-serif; }
        .rec-old-price { font-size: 11px; color: #9ca3af; text-decoration: line-through; margin-left: 5px; font-family: 'DM Sans', sans-serif; }
        .rec-add-btn {
          width: calc(100% - 22px); margin: 0 11px 11px; background: #1a1f5e; color: white;
          border: none; border-radius: 9px; padding: 8px; font-size: 12px; font-weight: 700;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background .2s;
        }
        .rec-add-btn:hover { background: #2d3aaa; }
        .rec-add-btn.added { background: #166834; }
      </style>
      <div class="rec-section">
        <div class="rec-header">
          <div class="rec-title">${this.title}</div>
          <a class="rec-see-all" href="arama.html${this.department ? '?department='+this.department : ''}">Tümünü gör →</a>
        </div>
        <div class="rec-scroll">
          ${items.map(p => this.cardHtml(p)).join('')}
        </div>
      </div>`;

    // Sepete ekle butonları
    this.container.querySelectorAll('.rec-add-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.preventDefault(); e.stopPropagation();
        if (!this.token) { window.location.href = 'hesabim.html'; return; }
        const sku  = btn.dataset.sku;
        const name = btn.dataset.name;
        const price= btn.dataset.price;
        const emoji= btn.dataset.emoji;
        try {
          await fetch(`${this.API}/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.token },
            body: JSON.stringify({ product_id: sku, product_name: name, product_price: parseFloat(price), product_emoji: emoji, quantity: 1 })
          });
          btn.textContent = '✅ Eklendi';
          btn.classList.add('added');
          // Sepet sayacını güncelle (varsa)
          const badge = document.getElementById('cart-badge');
          if (badge) badge.textContent = parseInt(badge.textContent || '0') + 1;
          setTimeout(() => { btn.textContent = '🛒 Sepete Ekle'; btn.classList.remove('added'); }, 2000);
        } catch {}
      });
    });
  }

  cardHtml(p) {
    const discountPct = p.old_price ? Math.round((p.old_price - p.price) / p.old_price * 100) : 0;
    const safeRating  = Math.min(5, Math.max(0, Math.round(p.rating||0)));
    const stars       = '★'.repeat(safeRating) + '☆'.repeat(5 - safeRating);
    const imgContent  = p.primary_image
      ? `<img src="${this.esc(p.primary_image)}" alt="${this.esc(p.name)}" loading="lazy">`
      : `<span class="rec-emoji">${this.esc(p.emoji||'📦')}</span>`;

    return `
      <a class="rec-card" href="urun-detay.html?sku=${encodeURIComponent(p.sku||'')}">
        <div class="rec-img">
          ${imgContent}
          ${p.badge ? `<span class="rec-badge ${this.esc(p.badge)}">${this.badgeLabel(p.badge)}</span>` : ''}
          ${discountPct > 0 ? `<span class="rec-discount">-%${discountPct}</span>` : ''}
        </div>
        <div class="rec-info">
          <div class="rec-brand">${this.esc(p.brand||'')}</div>
          <div class="rec-name">${this.esc(p.name)}</div>
          <div class="rec-stars">
            <span class="rec-star">${stars}</span>
            <span class="rec-rating-text">(${parseInt(p.review_count)||0})</span>
          </div>
          <div>
            <span class="rec-price">₺${this.fmt(p.price)}</span>
            ${p.old_price ? `<span class="rec-old-price">₺${this.fmt(p.old_price)}</span>` : ''}
          </div>
        </div>
        <button class="rec-add-btn"
          data-sku="${this.esc(p.sku||'')}" data-name="${this.esc(p.name||'')}"
          data-price="${p.price}" data-emoji="${this.esc(p.emoji||'📦')}">
          🛒 Sepete Ekle
        </button>
      </a>`;
  }

  // Son bakılanları localStorage'da tut
  trackView(sku) {
    try {
      let viewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
      viewed = [sku, ...viewed.filter(s => s !== sku)].slice(0, 10);
      localStorage.setItem('recentlyViewed', JSON.stringify(viewed));
    } catch {}
  }

  getRecentlyViewed() {
    try { return JSON.parse(localStorage.getItem('recentlyViewed') || '[]'); }
    catch { return []; }
  }

  badgeLabel(b) { return { new:'YENİ', sale:'İNDİRİM', hot:'🔥 HOT', limited:'SON' }[b] || b; }
  fmt(n) { return parseFloat(n||0).toLocaleString('tr-TR', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
  esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
}

// ============================================================
//  KULLANIM ÖRNEKLERİ
// ============================================================

// 1. Ürün detay sayfasında — "Bunu alanlar şunu da aldı"
// new RecommendationsWidget({
//   containerId: 'also-bought-container',
//   type: 'also-bought',
//   title: '🛍️ Bunu Alanlar Şunu da Aldı',
//   productId: CURRENT_PRODUCT_SKU
// });

// 2. Ürün detay sayfasında — "Benzer Ürünler"
// new RecommendationsWidget({
//   containerId: 'similar-container',
//   type: 'similar',
//   title: '🔍 Benzer Ürünler',
//   productId: CURRENT_PRODUCT_SKU
// });

// 3. Ana sayfa — "Sizin İçin Özel"
// new RecommendationsWidget({
//   containerId: 'for-you-container',
//   type: 'for-you',
//   title: '✨ Sizin İçin Özel'
// });

// 4. Ana sayfa — "Trend Ürünler"
// new RecommendationsWidget({
//   containerId: 'trending-container',
//   type: 'trending',
//   title: '🔥 Bu Hafta Trend'
// });

// 5. Her sayfanın altında — "Son Baktıklarınız"
// new RecommendationsWidget({
//   containerId: 'recently-viewed-container',
//   type: 'recently-viewed',
//   title: '👁️ Son Baktıklarınız'
// });

window.RecommendationsWidget = RecommendationsWidget;
