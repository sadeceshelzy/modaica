/* MODAICA — Arama Sayfası JS */

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

let currentQuery  = '';
let currentPage   = 1;
let totalPages    = 1;
let currentSort   = 'popular';
let allProducts   = [];
let searchTimer;

const DEPT_MAP = {
  erkek:'erkek.html', kadin:'kadin.html', elektronik:'elektronik.html',
  ev:'ev.html', spor:'spor.html', kozmetik:'kozmetik.html'
};

// ── Sayfa yüklenince ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  updateBadges();
  const q = new URLSearchParams(location.search).get('q') || '';
  if (q) {
    document.getElementById('searchInput').value = q;
    currentQuery = q;
    await doSearch(q, 1);
  } else {
    showInitial();
  }
  initSearchInput();
});

// ── Input event ──────────────────────────────────────────────
function initSearchInput() {
  const input = document.getElementById('searchInput');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q.length >= 2) goSearch(q);
      closeAutocomplete();
    }
    if (e.key === 'Escape') closeAutocomplete();
  });
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (q.length < 2) { closeAutocomplete(); return; }
    searchTimer = setTimeout(() => showAutocomplete(q), 300);
  });
  document.getElementById('searchBtn').addEventListener('click', () => {
    const q = input.value.trim();
    if (q.length >= 2) goSearch(q);
  });
  document.addEventListener('click', e => {
    if (!document.getElementById('mainSearch').contains(e.target)) closeAutocomplete();
  });
}

function goSearch(q) {
  history.pushState({}, '', `arama.html?q=${encodeURIComponent(q)}`);
  currentQuery = q;
  currentPage  = 1;
  doSearch(q, 1);
  closeAutocomplete();
}

// ── Autocomplete ─────────────────────────────────────────────
async function showAutocomplete(q) {
  const r = await SearchAPI.search(q);
  if (!r.ok) return;
  const { products = [], categories = [] } = r.data.data;
  const items = [
    ...categories.slice(0,2).map(c => ({ type:'cat', label: c.name, emoji: c.emoji, slug: c.slug, dept: c.department })),
    ...products.slice(0,5).map(p => ({ type:'prod', label: p.name, emoji: p.emoji, sku: p.sku, price: p.price })),
  ];
  if (!items.length) { closeAutocomplete(); return; }
  const box = document.getElementById('autocomplete');
  box.innerHTML = '';
  items.forEach(it => {
    const el = document.createElement('div');
    el.className = 'ac-item';
    if (it.type === 'cat') {
      const href = (DEPT_MAP[it.dept] || '#') + '?cat=' + encodeURIComponent(it.slug || '');
      el.addEventListener('click', () => { window.location.href = href; });
      el.innerHTML = `<span style="font-size:18px;">${escHtml(it.emoji)}</span><span>${escHtml(it.label)}</span><span style="margin-left:auto;font-size:11px;color:var(--muted);">Kategori</span>`;
    } else {
      const href = 'urun-detay.html?sku=' + encodeURIComponent(it.sku || '');
      el.addEventListener('click', () => { window.location.href = href; });
      el.innerHTML = `<span style="font-size:18px;">${escHtml(it.emoji)}</span><span>${escHtml(it.label)}</span><span style="margin-left:auto;font-weight:700;color:var(--primary);">₺${Number(it.price).toLocaleString('tr-TR')}</span>`;
    }
    box.appendChild(el);
  });
  box.style.display = 'block';
}

function closeAutocomplete() {
  document.getElementById('autocomplete').style.display = 'none';
}

// ── Ana Arama ────────────────────────────────────────────────
async function doSearch(q, page = 1) {
  setState('loading');
  document.getElementById('searchInput').value = q;

  const r = await SearchAPI.search(q);

  if (!r.ok) {
    setState('empty');
    document.getElementById('emptyMsg').textContent = 'Bir hata oluştu. Lütfen tekrar deneyin.';
    return;
  }

  const { products = [], categories = [] } = r.data.data;
  allProducts = products;

  // Başlık
  document.getElementById('breadQuery').textContent = `"${q}"`;
  const titleEl = document.getElementById('searchTitle');
  titleEl.textContent = '';
  const titleSpan = document.createElement('span');
  titleSpan.textContent = `"${q}"`;
  titleEl.appendChild(titleSpan);
  titleEl.appendChild(document.createTextNode(' için Sonuçlar'));
  document.getElementById('searchSubtitle').textContent =
    products.length ? `${products.length} ürün ve ${categories.length} kategori bulundu` : 'Sonuç bulunamadı';

  // Kategoriler
  if (categories.length) {
    const catList = document.getElementById('categoryList');
    catList.innerHTML = '';
    categories.forEach(c => {
      const a = document.createElement('a');
      a.className = 'cat-chip';
      a.href = (DEPT_MAP[c.department] || '#') + '?cat=' + encodeURIComponent(c.slug || '');
      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'chip-emoji';
      emojiSpan.textContent = c.emoji || '';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = c.name || '';
      a.appendChild(emojiSpan);
      a.appendChild(nameSpan);
      catList.appendChild(a);
    });
    document.getElementById('categoryResults').style.display = '';
  } else {
    document.getElementById('categoryResults').style.display = 'none';
  }

  if (!products.length) {
    setState('empty');
    loadSuggestions(q);
    return;
  }

  renderProducts(sortProducts(products, currentSort), page);
  setState('results');
}

// ── Ürünleri sırala ──────────────────────────────────────────
function sortProducts(prods, sort) {
  const p = [...prods];
  switch (sort) {
    case 'newest':     return p.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
    case 'price_asc':  return p.sort((a,b) => a.price - b.price);
    case 'price_desc': return p.sort((a,b) => b.price - a.price);
    case 'rating':     return p.sort((a,b) => b.rating - a.rating);
    case 'discount':   return p.sort((a,b) => ((b.old_price-b.price)/b.old_price||0) - ((a.old_price-a.price)/a.old_price||0));
    default:           return p.sort((a,b) => (b.review_count||0) - (a.review_count||0));
  }
}

function applySort() {
  currentSort = document.getElementById('sortSelect').value;
  renderProducts(sortProducts(allProducts, currentSort), 1);
}

// ── Ürünleri render ──────────────────────────────────────────
function renderProducts(products, page) {
  const PER_PAGE = 12;
  totalPages = Math.ceil(products.length / PER_PAGE);
  currentPage = Math.min(page, totalPages);
  const slice = products.slice((currentPage-1)*PER_PAGE, currentPage*PER_PAGE);

  document.getElementById('productCount').textContent = `🛍️ Ürünler (${products.length} sonuç)`;

  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';
  slice.forEach((p, i) => {
    const disc = p.old_price ? Math.round((1 - p.price/p.old_price)*100) : 0;
    const safeRating = Math.min(5, Math.max(0, Math.round(p.avg_rating||4)));
    const stars = '★'.repeat(safeRating) + '☆'.repeat(5 - safeRating);
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.animationDelay = (i*0.04) + 's';
    card.addEventListener('click', () => { window.location.href = 'urun-detay.html?sku=' + encodeURIComponent(p.sku); });
    card.innerHTML = `
      <div class="pc-img">
        <span>${escHtml(p.emoji || '📦')}</span>
        ${disc > 0 ? `<div class="pc-badge">%${disc}</div>` : ''}
        ${p.badge === 'new' ? `<div class="pc-badge" style="background:var(--accent);">YENİ</div>` : ''}
        <button class="pc-fav" data-id="${Number(p.id)}" data-price="${Number(p.price)}" data-emoji="${escHtml(p.emoji||'📦')}" data-cat="${escHtml(p.category_slug||'')}">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
        </button>
      </div>
      <div class="pc-body">
        <div class="pc-cat">${escHtml((p.category_slug||'').replace(/-/g,' '))}</div>
        <div class="pc-name">${escHtml(p.name)}</div>
        <div class="pc-brand">${escHtml(p.brand||'')}</div>
        <div class="pc-stars">${stars} <span>(${Number(p.review_count||0)})</span></div>
        <div class="pc-footer">
          <div>
            <div class="pc-price">₺${Number(p.price).toLocaleString('tr-TR')}</div>
            ${p.old_price ? `<div class="pc-old">₺${Number(p.old_price).toLocaleString('tr-TR')}</div>` : ''}
          </div>
          <button class="pc-cart" data-id="${Number(p.id)}" data-price="${Number(p.price)}" data-emoji="${escHtml(p.emoji||'📦')}" data-cat="${escHtml(p.category_slug||'')}">+ Sepet</button>
        </div>
      </div>`;
    // Store name separately (cannot safely embed in attribute)
    card.querySelector('.pc-fav').dataset.name = p.name || '';
    card.querySelector('.pc-cart').dataset.name = p.name || '';
    card.querySelector('.pc-fav').addEventListener('click', function(e) { e.stopPropagation(); toggleFav(e, Number(this.dataset.id), this.dataset.name, parseFloat(this.dataset.price), this.dataset.emoji, this.dataset.cat); });
    card.querySelector('.pc-cart').addEventListener('click', function(e) { e.stopPropagation(); addCart(e, Number(this.dataset.id), this.dataset.name, parseFloat(this.dataset.price), this.dataset.emoji, this.dataset.cat); });
    grid.appendChild(card);
  });

  renderPagination(products);
  document.getElementById('productResults').style.display = '';
}

// ── Sayfalama ────────────────────────────────────────────────
function renderPagination(products) {
  const PER_PAGE = 12;
  const total = Math.ceil(products.length / PER_PAGE);
  if (total <= 1) { document.getElementById('pagination').innerHTML = ''; return; }
  let html = '';
  html += `<button class="pg-btn" ${currentPage===1?'disabled':''} onclick="goPage(${currentPage-1})">‹</button>`;
  for (let i=1;i<=total;i++) {
    if (total > 7 && i > 3 && i < total-1 && Math.abs(i-currentPage) > 1) { if (i===4) html += '<span style="padding:0 4px;line-height:40px;">…</span>'; continue; }
    html += `<button class="pg-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
  }
  html += `<button class="pg-btn" ${currentPage===total?'disabled':''} onclick="goPage(${currentPage+1})">›</button>`;
  document.getElementById('pagination').innerHTML = html;
}

function goPage(p) {
  currentPage = p;
  renderProducts(sortProducts(allProducts, currentSort), p);
  window.scrollTo({ top: 300, behavior:'smooth' });
}

// ── İlk görünüm (arama yapılmamış) ──────────────────────────
async function showInitial() {
  setState('initial');
  const [histRes, popRes] = await Promise.all([SearchAPI.history(), SearchAPI.popular()]);

  if (histRes.ok && histRes.data.data?.history?.length) {
    const hist = histRes.data.data.history;
    const recentList = document.getElementById('recentList');
    recentList.innerHTML = '';
    hist.forEach(h => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = '🕐 ' + h.query;
      span.addEventListener('click', () => goSearch(h.query));
      recentList.appendChild(span);
    });
    document.getElementById('recentSearches').style.display = '';
  }

  const popularList = document.getElementById('popularList');
  popularList.innerHTML = '';
  if (popRes.ok && popRes.data.data?.popular?.length) {
    popRes.data.data.popular.forEach(p => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = '🔥 ' + p.query;
      span.addEventListener('click', () => goSearch(p.query));
      popularList.appendChild(span);
    });
  } else {
    const defaults = ['iPhone','Nike','Elbise','Laptop','Parfüm','Çanta','Ayakkabı','Koltuk'];
    defaults.forEach(d => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = '🔥 ' + d;
      span.addEventListener('click', () => goSearch(d));
      popularList.appendChild(span);
    });
  }
}

// ── Öneri yükle ──────────────────────────────────────────────
async function loadSuggestions(q) {
  const defaults = ['Gömlek','Ayakkabı','Parfüm','Laptop','Çanta'];
  const container = document.getElementById('suggestions');
  container.innerHTML = '';
  defaults.forEach(d => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = d;
    span.addEventListener('click', () => goSearch(d));
    container.appendChild(span);
  });
}

// ── State yönetimi ───────────────────────────────────────────
function setState(state) {
  document.getElementById('loadingState').style.display  = state==='loading'  ? '' : 'none';
  document.getElementById('emptyState').style.display    = state==='empty'    ? '' : 'none';
  document.getElementById('initialState').style.display  = state==='initial'  ? '' : 'none';
  document.getElementById('productResults').style.display= state==='results'  ? '' : 'none';
}

// ── Favori toggle ────────────────────────────────────────────
async function toggleFav(e, id, name, price, emoji, cat) {
  e.stopPropagation();
  if (!Auth.isLoggedIn()) { showToast('Favorilere eklemek için giriş yapın.', true); return; }
  const isFav = await FavAPI.toggle({ product_id:id, product_name:name, product_price:price, product_emoji:emoji, product_cat:cat });
  showToast(isFav ? '❤️ Favorilere eklendi!' : 'Favorilerden çıkarıldı.');
  e.currentTarget.style.background = isFav ? 'var(--accent2)' : '';
  e.currentTarget.style.color      = isFav ? 'white' : '';
}

// ── Sepete ekle ──────────────────────────────────────────────
async function addCart(e, id, name, price, emoji, cat) {
  e.stopPropagation();
  const r = await CartAPI.addAndSync({ product_id:id, product_name:name, product_price:price, product_emoji:emoji, product_cat:cat, quantity:1 });
  if (r.ok) { showToast('🛒 Sepete eklendi!'); e.currentTarget.textContent = '✓'; setTimeout(()=>e.currentTarget.textContent='+ Sepet',1500); }
  else showToast(r.data.message||'Eklenemedi.', true);
}

// ── Toast ────────────────────────────────────────────────────
function showToast(msg, isError=false) {
  const t = document.getElementById('toast');
  t.querySelector('span').textContent = msg;
  t.querySelector('svg').style.color = isError ? '#e63946' : '#22c55e';
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2800);
}
