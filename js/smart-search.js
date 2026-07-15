// ============================================================
//  MODAICA — Akıllı Arama Widget
//  Kullanım: new SmartSearch('container-id')
//  veya mevcut arama sayfasına entegre et
// ============================================================
class SmartSearch {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.API       = (typeof API_BASE !== 'undefined' ? API_BASE : ('http://' + location.hostname + (location.port ? ':' + location.port : '') + '/modaica/backend')) + '/api';
    this.TOKEN     = localStorage.getItem('modaica_token') || '';
    this.page      = 1;
    this.totalPages= 1;
    this.lastQuery = '';
    this.results   = [];
    this.debounceTimer = null;
    this.init();
  }

  init() {
    this.injectStyles();
    this.render();
    this.loadInitial();

    // URL'den sorgu al
    const urlQ = new URLSearchParams(location.search).get('q');
    if (urlQ) {
      document.getElementById('ss-input').value = urlQ;
      this.search(urlQ);
    }
  }

  injectStyles() {
    if (document.getElementById('ss-styles')) return;
    const s = document.createElement('style');
    s.id = 'ss-styles';
    s.textContent = `
      .ss-wrap { font-family: 'DM Sans', sans-serif; max-width: 1100px; margin: 0 auto; padding: 24px 16px; }

      /* Arama kutusu */
      .ss-search-box { position: relative; margin-bottom: 24px; }
      .ss-input-wrap { display: flex; gap: 0; box-shadow: 0 4px 20px rgba(26,31,94,.12); border-radius: 16px; overflow: hidden; }
      .ss-input { flex: 1; border: none; padding: 16px 20px; font-size: 16px; font-family: inherit; outline: none; color: #1c1c2e; }
      .ss-input::placeholder { color: #9ca3af; }
      .ss-search-btn { background: #1a1f5e; color: white; border: none; padding: 0 28px; font-size: 18px; cursor: pointer; transition: background .2s; }
      .ss-search-btn:hover { background: #2d3aaa; }
      .ss-clear-btn { background: none; border: none; color: #9ca3af; padding: 0 14px; font-size: 20px; cursor: pointer; display: none; }

      /* Autocomplete dropdown */
      .ss-dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: white; border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,.12); border: 1px solid #e5e7eb; z-index: 100; overflow: hidden; display: none; }
      .ss-dropdown.open { display: block; }
      .ss-dropdown-item { display: flex; align-items: center; gap: 10px; padding: 11px 16px; cursor: pointer; font-size: 14px; transition: background .15s; }
      .ss-dropdown-item:hover { background: #f8f9fc; }
      .ss-dropdown-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
      .ss-dd-popular .ss-dropdown-icon { background: #fef9c3; }
      .ss-dd-product .ss-dropdown-icon { background: #dbeafe; }
      .ss-dd-brand .ss-dropdown-icon { background: #f3e8ff; }
      .ss-dd-category .ss-dropdown-icon { background: #dcfce7; }
      .ss-dd-correction .ss-dropdown-icon { background: #fff5f5; }
      .ss-dd-fuzzy .ss-dropdown-icon { background: #f1f5f9; }
      .ss-dropdown-text { flex: 1; }
      .ss-dropdown-type { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: .4px; }

      /* Niyet göstergesi */
      .ss-intent-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
      .ss-intent-chip { display: inline-flex; align-items: center; gap: 5px; background: #1a1f5e; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
      .ss-intent-chip button { background: none; border: none; color: rgba(255,255,255,.7); cursor: pointer; font-size: 14px; padding: 0; margin-left: 2px; line-height: 1; }
      .ss-correction-notice { background: #fef9c3; border: 1px solid #fde68a; border-radius: 10px; padding: 9px 14px; font-size: 13px; color: #92400e; margin-bottom: 14px; }
      .ss-correction-notice a { color: #92400e; font-weight: 700; cursor: pointer; text-decoration: underline; }

      /* Filtreler */
      .ss-filters { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
      .ss-filter-label { font-size: 13px; font-weight: 600; color: #6b7280; }
      .ss-filter-btn { border: 1.5px solid #e5e7eb; background: white; border-radius: 20px; padding: 6px 14px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all .18s; display: flex; align-items: center; gap: 5px; }
      .ss-filter-btn:hover { border-color: #1a1f5e; color: #1a1f5e; }
      .ss-filter-btn.active { background: #1a1f5e; color: white; border-color: #1a1f5e; }
      .ss-price-range { display: flex; gap: 6px; align-items: center; }
      .ss-price-input { border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 6px 10px; font-size: 13px; width: 90px; font-family: inherit; outline: none; }
      .ss-price-input:focus { border-color: #1a1f5e; }
      .ss-price-apply { background: #1a1f5e; color: white; border: none; border-radius: 10px; padding: 6px 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }

      /* Sonuç başlığı */
      .ss-result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
      .ss-result-count { font-size: 14px; color: #6b7280; }
      .ss-result-count strong { color: #1c1c2e; }
      .ss-sort-select { border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 7px 12px; font-size: 13px; font-family: inherit; outline: none; cursor: pointer; }

      /* Ürün grid */
      .ss-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
      .ss-card { background: white; border-radius: 14px; border: 1px solid #e5e7eb; overflow: hidden; cursor: pointer; transition: transform .2s, box-shadow .2s; text-decoration: none; color: inherit; display: block; }
      .ss-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,.1); }
      .ss-card-img { height: 150px; background: #f8f9fc; display: flex; align-items: center; justify-content: center; font-size: 58px; position: relative; }
      .ss-card-badge { position: absolute; top: 8px; left: 8px; padding: 3px 9px; border-radius: 7px; font-size: 10px; font-weight: 700; }
      .ss-card-discount { position: absolute; top: 8px; right: 8px; background: #e63946; color: white; padding: 3px 9px; border-radius: 7px; font-size: 10px; font-weight: 700; }
      .ss-card-body { padding: 12px; }
      .ss-card-brand { font-size: 11px; color: #6b7280; margin-bottom: 2px; }
      .ss-card-name { font-size: 13px; font-weight: 600; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; }
      .ss-card-rating { display: flex; align-items: center; gap: 3px; font-size: 11px; color: #6b7280; margin-bottom: 6px; }
      .ss-card-price { font-size: 15px; font-weight: 800; color: #1a1f5e; }
      .ss-card-old-price { font-size: 11px; color: #9ca3af; text-decoration: line-through; margin-left: 6px; }

      /* Başlangıç durumu */
      .ss-popular-section { margin-bottom: 28px; }
      .ss-popular-title { font-size: 14px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 12px; }
      .ss-popular-tags { display: flex; gap: 8px; flex-wrap: wrap; }
      .ss-popular-tag { background: white; border: 1.5px solid #e5e7eb; border-radius: 20px; padding: 7px 16px; font-size: 14px; cursor: pointer; transition: all .18s; font-family: inherit; display: flex; align-items: center; gap: 6px; }
      .ss-popular-tag:hover { background: #1a1f5e; color: white; border-color: #1a1f5e; }
      .ss-history-item { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid #f1f5f9; cursor: pointer; font-size: 14px; }
      .ss-history-item:hover { color: #1a1f5e; }

      /* Boş durum */
      .ss-empty { text-align: center; padding: 60px 20px; }
      .ss-empty-icon { font-size: 64px; margin-bottom: 16px; }
      .ss-empty h3 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
      .ss-empty p { color: #6b7280; font-size: 14px; }

      /* Loading */
      .ss-skeleton { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
      .ss-skel-card { height: 280px; background: linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size: 200%; border-radius: 14px; animation: ss-shimmer 1.5s infinite; }
      @keyframes ss-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

      /* Daha fazla */
      .ss-load-more { display: block; width: 100%; margin-top: 24px; background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 13px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; color: #6b7280; transition: all .2s; }
      .ss-load-more:hover { border-color: #1a1f5e; color: #1a1f5e; }

      @media(max-width:600px) { .ss-grid{grid-template-columns:1fr 1fr;} .ss-filters{gap:6px;} }
    `;
    document.head.appendChild(s);
  }

  render() {
    this.container.innerHTML = `
      <div class="ss-wrap">
        <!-- Arama Kutusu -->
        <div class="ss-search-box">
          <div class="ss-input-wrap">
            <input class="ss-input" id="ss-input" type="text"
              placeholder="Ürün, marka veya 'ucuz bluetooth kulaklık' gibi yazın..."
              autocomplete="off" spellcheck="false">
            <button class="ss-clear-btn" id="ss-clear" onclick="window._ss.clearSearch()">✕</button>
            <button class="ss-search-btn" onclick="window._ss.triggerSearch()">🔍</button>
          </div>
          <div class="ss-dropdown" id="ss-dropdown"></div>
        </div>

        <!-- Niyet ve düzeltme bildirimleri -->
        <div id="ss-intent-bar" class="ss-intent-bar" style="display:none;"></div>
        <div id="ss-correction" style="display:none;"></div>

        <!-- Filtreler -->
        <div class="ss-filters" id="ss-filters" style="display:none;">
          <span class="ss-filter-label">Filtrele:</span>
          <button class="ss-filter-btn active" onclick="window._ss.setDept('',this)">Tümü</button>
          <button class="ss-filter-btn" onclick="window._ss.setDept('erkek',this)">👔 Erkek</button>
          <button class="ss-filter-btn" onclick="window._ss.setDept('kadin',this)">👗 Kadın</button>
          <button class="ss-filter-btn" onclick="window._ss.setDept('elektronik',this)">📱 Elektronik</button>
          <button class="ss-filter-btn" onclick="window._ss.setDept('ev',this)">🏡 Ev</button>
          <button class="ss-filter-btn" onclick="window._ss.setDept('spor',this)">⚡ Spor</button>
          <button class="ss-filter-btn" onclick="window._ss.setDept('kozmetik',this)">💄 Kozmetik</button>
          <div class="ss-price-range">
            <input class="ss-price-input" id="ss-min" type="number" placeholder="Min ₺">
            <span style="color:#9ca3af">—</span>
            <input class="ss-price-input" id="ss-max" type="number" placeholder="Max ₺">
            <button class="ss-price-apply" onclick="window._ss.applyPrice()">Uygula</button>
          </div>
        </div>

        <!-- İçerik alanı -->
        <div id="ss-content">
          <!-- Başlangıç: popüler aramalar ve geçmiş -->
          <div id="ss-initial">
            <div class="ss-popular-section" id="ss-popular-wrap"></div>
            <div id="ss-history-wrap"></div>
          </div>
          <!-- Sonuçlar -->
          <div id="ss-results-wrap" style="display:none;">
            <div class="ss-result-header">
              <div class="ss-result-count" id="ss-result-count"></div>
              <select class="ss-sort-select" id="ss-sort" onchange="window._ss.changeSort(this.value)">
                <option value="popular">Popülerlik</option>
                <option value="price_asc">Fiyat ↑</option>
                <option value="price_desc">Fiyat ↓</option>
                <option value="rating">En İyi Puan</option>
                <option value="newest">En Yeni</option>
              </select>
            </div>
            <div class="ss-grid" id="ss-grid"></div>
            <button class="ss-load-more" id="ss-load-more" style="display:none;" onclick="window._ss.loadMore()">
              Daha Fazla Yükle
            </button>
          </div>
        </div>
      </div>`;

    window._ss = this;

    // Input event'leri
    const input = document.getElementById('ss-input');
    input.addEventListener('input', e => {
      const v = e.target.value;
      document.getElementById('ss-clear').style.display = v ? 'block' : 'none';
      clearTimeout(this.debounceTimer);
      if (v.length >= 2) {
        this.debounceTimer = setTimeout(() => this.suggest(v), 250);
      } else {
        this.closeDropdown();
      }
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { this.triggerSearch(); this.closeDropdown(); }
      if (e.key === 'Escape') this.closeDropdown();
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.ss-search-box')) this.closeDropdown();
    });
  }

  async loadInitial() {
    // Popüler aramalar
    try {
      const r = await fetch(`${this.API}/search/popular`);
      const d = await r.json();
      if (d.success && d.data.terms.length) {
        document.getElementById('ss-popular-wrap').innerHTML = `
          <div class="ss-popular-title">🔥 Popüler Aramalar</div>
          <div class="ss-popular-tags">
            ${d.data.terms.map(t => `
              <button class="ss-popular-tag" onclick="window._ss.quickSearch('${this.esc(t.query)}')">
                🔍 ${this.esc(t.query)}
              </button>`).join('')}
          </div>`;
      }
    } catch(_) {}

    // Kullanıcı geçmişi
    if (this.TOKEN) {
      try {
        const r = await fetch(`${this.API}/search/history`, { headers: { 'Authorization': 'Bearer ' + this.TOKEN } });
        const d = await r.json();
        if (d.success && d.data.history.length) {
          document.getElementById('ss-history-wrap').innerHTML = `
            <div class="ss-popular-title" style="margin-top:20px;">🕐 Son Aramalarım</div>
            ${d.data.history.slice(0,5).map(h => `
              <div class="ss-history-item" onclick="window._ss.quickSearch('${this.esc(h.query)}')">
                <span style="color:#9ca3af">🕐</span>
                <span>${this.esc(h.query)}</span>
                <span style="margin-left:auto;font-size:11px;color:#9ca3af;">${h.results_count} sonuç</span>
              </div>`).join('')}`;
        }
      } catch(_) {}
    }
  }

  // ── AUTOCOMPLETE ──────────────────────────────────────────
  async suggest(q) {
    try {
      const r = await fetch(`${this.API}/search/suggest?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (!d.success || !d.data.suggestions.length) { this.closeDropdown(); return; }

      const icons = { popular:'🔥', product:'🛍️', brand:'🏷️', category:'📂', correction:'✏️', fuzzy:'🔍' };
      const labels = { popular:'Popüler', product:'Ürün', brand:'Marka', category:'Kategori', correction:'Yazım düzeltme', fuzzy:'Benzer' };

      const dd = document.getElementById('ss-dropdown');
      dd.innerHTML = d.data.suggestions.map(s => `
        <div class="ss-dropdown-item ss-dd-${s.type}" onclick="window._ss.quickSearch('${this.esc(s.suggestion)}')">
          <div class="ss-dropdown-icon">${icons[s.type] || '🔍'}</div>
          <div class="ss-dropdown-text">
            <div>${this.highlight(s.suggestion, q)}</div>
            <div class="ss-dropdown-type">${labels[s.type] || s.type}</div>
          </div>
        </div>`).join('');
      dd.classList.add('open');
    } catch(_) {}
  }

  closeDropdown() { document.getElementById('ss-dropdown')?.classList.remove('open'); }

  // ── ARAMA ─────────────────────────────────────────────────
  triggerSearch() {
    const q = document.getElementById('ss-input')?.value.trim();
    if (q) { this.page = 1; this.search(q); }
  }

  quickSearch(q) {
    document.getElementById('ss-input').value = q;
    document.getElementById('ss-clear').style.display = 'block';
    this.closeDropdown();
    this.page = 1;
    this.search(q);
  }

  clearSearch() {
    document.getElementById('ss-input').value = '';
    document.getElementById('ss-clear').style.display = 'none';
    document.getElementById('ss-initial').style.display = 'block';
    document.getElementById('ss-results-wrap').style.display = 'none';
    document.getElementById('ss-filters').style.display = 'none';
    document.getElementById('ss-intent-bar').style.display = 'none';
    document.getElementById('ss-correction').style.display = 'none';
    this.closeDropdown();
  }

  async search(q, append = false) {
    this.lastQuery = q;
    if (!append) {
      this.showSkeleton();
      document.getElementById('ss-initial').style.display = 'none';
      document.getElementById('ss-results-wrap').style.display = 'block';
      document.getElementById('ss-filters').style.display = 'flex';
    }

    // URL'yi güncelle
    history.replaceState(null, '', `?q=${encodeURIComponent(q)}`);

    const sort    = document.getElementById('ss-sort')?.value || 'popular';
    const minP    = document.getElementById('ss-min')?.value || '';
    const maxP    = document.getElementById('ss-max')?.value || '';
    const dept    = this._dept || '';

    let url = `${this.API}/search?q=${encodeURIComponent(q)}&page=${this.page}&sort=${sort}`;
    if (minP) url += `&price_min=${minP}`;
    if (maxP) url += `&price_max=${maxP}`;
    if (dept) url += `&department=${dept}`;

    try {
      const r = await fetch(url, this.TOKEN ? { headers: { 'Authorization': 'Bearer ' + this.TOKEN } } : {});
      const d = await r.json();
      if (!d.success) { this.showEmpty(q); return; }

      const data = d.data;
      this.totalPages = data.total_pages;
      this.results    = append ? [...this.results, ...data.items] : data.items;

      // Yazım düzeltme bildirimi
      const corrEl = document.getElementById('ss-correction');
      if (data.corrected) {
        corrEl.innerHTML = `<div class="ss-correction-notice">✏️ "${this.esc(q)}" için "<strong>${this.esc(data.corrected)}</strong>" gösteriliyor. <a onclick="window._ss.quickSearch('${this.esc(q)}')">Tam olarak ara →</a></div>`;
        corrEl.style.display = 'block';
      } else { corrEl.style.display = 'none'; }

      // Niyet göstergesi
      this.renderIntentBar(data.intent, q);

      // Sonuç sayısı
      document.getElementById('ss-result-count').innerHTML =
        `<strong>${data.total}</strong> ürün bulundu "${this.esc(q)}" için` +
        (data.fuzzy_used ? ' <span style="color:#f97316;font-size:12px;">(benzer sonuçlar gösteriliyor)</span>' : '');

      // Grid
      if (!this.results.length) { this.showEmpty(q); return; }
      document.getElementById('ss-grid').innerHTML = this.results.map(p => this.cardHtml(p)).join('');
      document.getElementById('ss-load-more').style.display = this.page < this.totalPages ? 'block' : 'none';

    } catch(e) { this.showEmpty(q); }
  }

  showSkeleton() {
    document.getElementById('ss-grid').innerHTML =
      Array(8).fill('<div class="ss-skel-card"></div>').join('');
  }

  showEmpty(q) {
    document.getElementById('ss-grid').innerHTML = `
      <div class="ss-empty" style="grid-column:1/-1">
        <div class="ss-empty-icon">🔍</div>
        <h3>"${this.esc(q)}" için sonuç bulunamadı</h3>
        <p>Farklı bir kelime deneyin veya filtreleri kaldırın.</p>
      </div>`;
    document.getElementById('ss-load-more').style.display = 'none';
  }

  renderIntentBar(intent, q) {
    const bar  = document.getElementById('ss-intent-bar');
    const chips = [];
    if (intent?.dept)      chips.push(`📂 ${intent.dept}`);
    if (intent?.max_price) chips.push(`₺${intent.max_price} altı`);
    if (intent?.min_price && intent?.max_price) chips.splice(-1, 1, `₺${intent.min_price}–₺${intent.max_price}`);
    if (intent?.sort !== 'popular') {
      const l = { price_asc:'En Ucuz', price_desc:'En Pahalı', rating:'En İyi', newest:'En Yeni' };
      chips.push(l[intent.sort] || intent.sort);
    }
    if (!chips.length) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.innerHTML = '<span style="font-size:13px;color:#6b7280;">Anlıyorum:</span>' +
      chips.map(c => `<span class="ss-intent-chip">${c}</span>`).join('') +
      `<button style="background:none;border:none;color:#9ca3af;font-size:12px;cursor:pointer;" onclick="window._ss.clearFiltersAndSearch()">Temizle</button>`;
  }

  cardHtml(p) {
    const disc = p.old_price && p.old_price > p.price ? Math.round((p.old_price - p.price) / p.old_price * 100) : 0;
    const badgeColors = { new:'#166834', sale:'#e63946', hot:'#f97316', limited:'#8b5cf6' };
    const badgeLabels = { new:'YENİ', sale:'İNDİRİM', hot:'🔥 HOT', limited:'SON' };
    return `
      <a href="urun-detay.html?sku=${p.sku}" class="ss-card">
        <div class="ss-card-img">
          <span>${p.emoji || '🛍️'}</span>
          ${p.badge ? `<span class="ss-card-badge" style="background:${badgeColors[p.badge]||'#1a1f5e'};color:white">${badgeLabels[p.badge]||p.badge}</span>` : ''}
          ${disc > 0 ? `<span class="ss-card-discount">-%${disc}</span>` : ''}
        </div>
        <div class="ss-card-body">
          ${p.brand ? `<div class="ss-card-brand">${p.brand}</div>` : ''}
          <div class="ss-card-name">${p.name}</div>
          <div class="ss-card-rating">
            <svg viewBox="0 0 24 24" fill="#f4a226" width="12" height="12"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            ${p.rating || '4.5'} (${p.review_count || 0})
          </div>
          <div>
            <span class="ss-card-price">₺${this.fmt(p.price)}</span>
            ${p.old_price ? `<span class="ss-card-old-price">₺${this.fmt(p.old_price)}</span>` : ''}
          </div>
        </div>
      </a>`;
  }

  // ── FİLTRELER ─────────────────────────────────────────────
  _dept = '';
  setDept(dept, btn) {
    this._dept = dept;
    document.querySelectorAll('.ss-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.page = 1; this.search(this.lastQuery);
  }
  applyPrice() { this.page = 1; this.search(this.lastQuery); }
  changeSort()  { this.page = 1; this.search(this.lastQuery); }
  clearFiltersAndSearch() {
    this._dept = '';
    document.getElementById('ss-min').value = '';
    document.getElementById('ss-max').value = '';
    document.querySelectorAll('.ss-filter-btn').forEach((b,i) => b.classList.toggle('active', i===0));
    this.page = 1; this.search(this.lastQuery);
  }
  loadMore() { this.page++; this.search(this.lastQuery, true); }

  // ── YARDIMCI ─────────────────────────────────────────────
  highlight(text, query) {
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
    return this.esc(text).replace(re, '<strong>$1</strong>');
  }
  esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  fmt(n) { return parseFloat(n||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}

window.SmartSearch = SmartSearch;
