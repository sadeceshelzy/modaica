/* =============================================
   MODAICA — Favoriler Sayfası JavaScript
   API Entegrasyonu: FavAPI + CartAPI
   ============================================= */

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

let favorites     = [];
let currentFilter = 'all';
let currentSort   = 'newest';
let currentView   = 'grid';

// ── İlk Yükleme ──────────────────────────────────────────────
async function init() {
  if (!Auth.isLoggedIn()) { showLoginRequired(); return; }
  showSkeleton();
  await loadFavorites();
  renderPage();
}

// ── Favorileri Yükle ─────────────────────────────────────────
async function loadFavorites() {
  const r = await FavAPI.list();
  if (r.ok) {
    favorites = r.data.data.items || [];
    // localStorage'ı güncelle (badge için)
    localStorage.setItem('modaica_favorites', JSON.stringify(favorites));
  } else {
    // API başarısız → localStorage fallback
    try { favorites = JSON.parse(localStorage.getItem('modaica_favorites') || '[]'); } catch { favorites = []; }
  }
}

// ── Favoriden Kaldır ─────────────────────────────────────────
async function removeFavorite(productId) {
  const r = await FavAPI.remove(productId);
  if (!r.ok) { showToast(r.data.message || 'Kaldırılamadı.', true); return false; }
  favorites = favorites.filter(f => (f.product_id || f.id) != productId);
  localStorage.setItem('modaica_favorites', JSON.stringify(favorites));
  updateBadges();
  return true;
}

// ── Sepete Ekle ──────────────────────────────────────────────
async function addToCartFromFav(productId, btn) {
  const fav = favorites.find(f => (f.product_id || f.id) == productId);
  if (!fav) return;

  const orig = btn.innerHTML;
  btn.disabled = true;

  const r = await CartAPI.addAndSync({
    product_id:    fav.product_id || fav.id,
    product_name:  fav.product_name || fav.name,
    product_price: fav.product_price || fav.price,
    product_emoji: fav.product_emoji || fav.emoji || '📦',
    product_cat:   fav.product_cat   || fav.cat   || '',
    product_brand: fav.product_brand || fav.brand || '',
    product_href:  fav.product_href  || fav.href  || '',
    quantity: 1,
  });

  btn.disabled = false;
  if (r.ok) {
    btn.innerHTML      = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Eklendi!`;
    btn.style.background = '#22c55e';
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 1800);
    showToast('Ürün sepete eklendi!');
  } else {
    showToast(r.data.message || 'Sepete eklenemedi.', true);
  }
}

// ── Sayfa Render ─────────────────────────────────────────────
function renderPage() {
  updateFavCount();
  renderFavorites();
}

// ── Favori Sayısı Güncelle ───────────────────────────────────
function updateFavCount() {
  const count = favorites.length;
  ['favCountBadge','hdrFavBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = count; el.style.display = count > 0 ? 'flex' : 'none'; }
  });
  const countEl = document.getElementById('favTotalCount');
  if (countEl) countEl.textContent = count;
  const titleBadge = document.getElementById('titleBadge');
  if (titleBadge) { titleBadge.textContent = count; titleBadge.style.display = count > 0 ? '' : 'none'; }
}

// ── Filtrele & Sırala ────────────────────────────────────────
function getFiltered() {
  let result = [...favorites];
  if (currentFilter !== 'all') {
    result = result.filter(f => {
      const cat = (f.product_cat || f.cat || '').toLowerCase();
      return cat.includes(currentFilter);
    });
  }
  switch (currentSort) {
    case 'newest':     result.sort((a,b) => (b.created_at||'') > (a.created_at||'') ? 1 : -1); break;
    case 'oldest':     result.sort((a,b) => (a.created_at||'') > (b.created_at||'') ? 1 : -1); break;
    case 'price_asc':  result.sort((a,b) => parseFloat(a.product_price||a.price||0) - parseFloat(b.product_price||b.price||0)); break;
    case 'price_desc': result.sort((a,b) => parseFloat(b.product_price||b.price||0) - parseFloat(a.product_price||a.price||0)); break;
    case 'name':       result.sort((a,b) => (a.product_name||a.name||'').localeCompare(b.product_name||b.name||'','tr')); break;
  }
  return result;
}

// ── Skeleton ─────────────────────────────────────────────────
function showSkeleton() {
  const grid = document.getElementById('favGrid');
  if (!grid) return;
  grid.innerHTML = Array(4).fill(`
    <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="height:220px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;"></div>
      <div style="padding:14px;"><div style="height:12px;background:#f0f0f0;border-radius:6px;margin-bottom:8px;"></div><div style="height:16px;background:#f0f0f0;border-radius:6px;margin-bottom:8px;width:70%;"></div><div style="height:20px;background:#f0f0f0;border-radius:6px;width:40%;"></div></div>
    </div>`).join('');
  if (!document.getElementById('shimmerStyle')) {
    const s = document.createElement('style');
    s.id = 'shimmerStyle';
    s.textContent = '@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
    document.head.appendChild(s);
  }
}

// ── Favorileri Render ────────────────────────────────────────
function renderFavorites() {
  const container = document.getElementById('favContainer');
  if (!container) return;

  if (favorites.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        </div>
        <h2>Favori listeniz boş</h2>
        <p>Beğendiğiniz ürünleri kalp ikonuna tıklayarak favorilerinize ekleyin.</p>
        <a href="index.html" class="go-shop">🛍 Alışverişe Başla</a>
      </div>`;
    return;
  }

  const filtered = getFiltered();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
        <h2>Bu kategoride ürün yok</h2>
        <p>Farklı bir kategori seçin.</p>
      </div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.id        = 'favGrid';
  grid.className = 'fav-grid' + (currentView === 'list' ? ' list-view' : '');
  grid.innerHTML = filtered.map((f, i) => favCardHTML(f, i)).join('');
  container.innerHTML = '';
  container.appendChild(grid);

  grid.querySelectorAll('.fav-remove-btn').forEach(btn => {
    btn.addEventListener('click', async function(e) {
      e.stopPropagation();
      const pid  = this.dataset.productId;
      const card = this.closest('.fav-card');
      card.style.transform = 'scale(.92)'; card.style.opacity = '0'; card.style.transition = 'all .3s';
      const ok = await removeFavorite(pid);
      setTimeout(() => {
        if (ok) { renderFavorites(); renderPage(); showToast('Favorilerden kaldırıldı.'); }
        else    { card.style.transform = ''; card.style.opacity = '1'; }
      }, 300);
    });
  });

  grid.querySelectorAll('.fav-cart-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      addToCartFromFav(this.dataset.productId, this);
    });
  });
}

// ── Favori Kart HTML ─────────────────────────────────────────
function favCardHTML(f, i) {
  const delay   = Math.min(i * 0.05, 0.4);
  const name    = f.product_name  || f.name   || 'Ürün';
  const price   = f.product_price || f.price  || 0;
  const emoji   = f.product_emoji || f.emoji  || '📦';
  const cat     = f.product_cat   || f.cat    || '';
  const pid     = f.product_id    || f.id;
  const oldPrice= f.old_price;

  return `
    <div class="fav-card" style="animation-delay:${delay}s;">
      <div class="fav-img">
        <span style="font-size:56px;">${escHtml(emoji)}</span>
        <button class="fav-remove-btn" data-product-id="${escHtml(String(pid))}" title="Favorilerden kaldır">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="fav-info">
        <div class="fav-cat">${escHtml(cat)}</div>
        <div class="fav-name">${escHtml(name)}</div>
        <div class="fav-footer">
          <div class="fav-price-wrap">
            <span class="fav-price">₺${Number(price).toLocaleString('tr-TR', {minimumFractionDigits:0})}</span>
            ${oldPrice ? `<span class="fav-price-old">₺${Number(oldPrice).toLocaleString('tr-TR')}</span>` : ''}
          </div>
          <button class="fav-cart-btn" data-product-id="${escHtml(String(pid))}">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            Sepete Ekle
          </button>
        </div>
      </div>
    </div>`;
}

// ── Giriş Gerekiyor Ekranı ───────────────────────────────────
function showLoginRequired() {
  document.getElementById('favContent').innerHTML = `
    <div class="login-required">
      <div class="lr-icon">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
      </div>
      <h2>Favorilerinizi Görüntüleyin</h2>
      <p>Favori ürünlerinizi görmek için lütfen giriş yapın veya üye olun.</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <a href="hesabim.html" class="btn-login">Giriş Yap</a>
        <a href="hesabim.html" class="btn-register">Üye Ol</a>
      </div>
    </div>`;
}

// ── Eventler ─────────────────────────────────────────────────
document.querySelectorAll('.filter-chip').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentFilter = this.dataset.filter;
    renderFavorites();
  });
});

document.getElementById('sortSelect')?.addEventListener('change', function() {
  currentSort = this.value; renderFavorites();
});

document.getElementById('btnGrid')?.addEventListener('click', function() {
  currentView = 'grid'; this.classList.add('active');
  document.getElementById('btnList').classList.remove('active');
  renderFavorites();
});

document.getElementById('btnList')?.addEventListener('click', function() {
  currentView = 'list'; this.classList.add('active');
  document.getElementById('btnGrid').classList.remove('active');
  renderFavorites();
});

// ── Başlat ───────────────────────────────────────────────────
init();
