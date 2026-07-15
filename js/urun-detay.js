/* MODAICA — Ürün Detay JS */

let product     = null;
let selectedSize  = '';
let selectedColor = '';
let selectedRating = 0;
let isFavorite   = false;
let reviewPage   = 1;

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

// ── Sayfa yüklenince ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  updateBadges();
  const sku = new URLSearchParams(location.search).get('sku');
  if (!sku) { showError('Ürün SKU bilgisi eksik.'); return; }
  await loadProduct(sku);
});

// ── Ürün yükle ───────────────────────────────────────────────
async function loadProduct(sku) {
  const r = await ProductAPI.get(sku);
  if (!r.ok) { showError(r.data.message || 'Ürün bulunamadı.'); return; }

  product = r.data.data.product || r.data.data;
  renderProduct(product);

  // Hemen göster — sonraki adımlar asenkron/opsiyonel
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('productDetail').style.display = '';

  // Galeri görsel fallback
  try {
    const sku_ = product.sku?.replace(/-/g,'_');
    if (sku_ && window[`gallery_${sku_}`] && product.image_url) {
      window[`gallery_${sku_}`].setFallback(product.image_url);
    } else if (product.image_url) {
      // Galeri henüz yüklenmediyse biraz bekle
      setTimeout(() => {
        const key = product.sku?.replace(/-/g,'_');
        if (key && window[`gallery_${key}`]) window[`gallery_${key}`].setFallback(product.image_url);
      }, 500);
    }
  } catch(e) {}

  // Stok / fiyat alarm widget
  try {
    if (typeof StockAlarmWidget !== 'undefined') {
      new StockAlarmWidget('alarm-box', product.sku, product.price, (product.stock || 0) > 0);
    }
  } catch(e) {}

  // Geçmiş takip + öneriler
  try {
    if (typeof modaRecent !== 'undefined') {
      modaRecent.trackView(product.sku, product.name, product.emoji || '📦', product.price);
      modaRecent.renderAlsoBought('rec-also-bought', product.sku);
      modaRecent.renderSimilar('rec-similar', product.sku);
    }
  } catch(e) {}

  // Favori kontrolü
  try {
    if (Auth.isLoggedIn()) {
      const fc = await FavAPI.check(product.id);
      isFavorite = fc.ok && fc.data.data?.is_favorite;
      updateFavBtn();
    }
  } catch(e) {}

  // Yorumlar
  try { loadReviews(product.id, 1); } catch(e) {}
}

// ── Ürün render ──────────────────────────────────────────────
function renderProduct(p) {
  document.title = `${p.name} — MODAICA`;
  document.getElementById('breadProduct').textContent = p.name;

  // Emoji / görsel
  const emojiEl = document.getElementById('mainEmoji');
  if (emojiEl) emojiEl.textContent = p.emoji || '📦';
  const thumbsEl = document.getElementById('galleryThumbs');
  if (thumbsEl) {
    const thumbs = [p.emoji||'📦', '🔍', '📐', '✨'];
    thumbsEl.innerHTML = thumbs.map((e,i) =>
      `<div class="thumb ${i===0?'active':''}" data-emoji="${escHtml(e)}">${escHtml(e)}</div>`).join('');
    thumbsEl.addEventListener('click', ev => {
      const t = ev.target.closest('[data-emoji]');
      if (t) setMainEmoji(t.dataset.emoji, t);
    });
  }

  // Badge
  const bd = document.getElementById('imgBadge');
  if (p.badge && bd) {
    bd.textContent = p.badge === 'new' ? 'YENİ' : p.badge === 'sale' ? '%' + Math.round((1-p.price/p.old_price)*100) + ' İNDİRİM' : p.badge.toUpperCase();
    bd.style.display = '';
  }

  // Bilgi
  const piBrand = document.getElementById('piBrand');
  const piName  = document.getElementById('piName');
  if (piBrand) piBrand.textContent = p.brand || '';
  if (piName)  piName.textContent  = p.name;

  // Puan
  const piRating = document.getElementById('piRating');
  if (piRating) {
    const rating = parseFloat(p.avg_rating || p.rating) || 4.5;
    const stars  = '★'.repeat(Math.floor(rating)) + (rating%1>=.5?'½':'') + '☆'.repeat(5-Math.ceil(rating));
    piRating.innerHTML = `
      <span class="pi-stars">${stars}</span>
      <span class="pi-rating-val">${rating.toFixed(1)}</span>
      <span class="pi-review-count">(${p.review_count||0} değerlendirme)</span>`;
  }

  // Fiyat
  const piPrice = document.getElementById('piPrice');
  if (piPrice) piPrice.textContent = '₺' + Number(p.price).toLocaleString('tr-TR', {minimumFractionDigits:2});
  if (p.old_price && p.old_price > p.price) {
    const piOld  = document.getElementById('piOld');
    const piDisc = document.getElementById('piDisc');
    if (piOld)  { piOld.textContent  = '₺' + Number(p.old_price).toLocaleString('tr-TR', {minimumFractionDigits:2}); piOld.style.display = ''; }
    if (piDisc) { piDisc.textContent = '%' + Math.round((1-p.price/p.old_price)*100) + ' indirim'; piDisc.style.display = ''; }
  }

  // Stok
  const stockInfo = document.getElementById('stockInfo');
  if (stockInfo) {
    const stock = p.stock || 50;
    stockInfo.textContent = stock > 10 ? `✓ Stokta ${stock} adet` : stock > 0 ? `⚠️ Son ${stock} adet!` : '✕ Stok tükendi';
    stockInfo.style.color = stock > 10 ? 'var(--success)' : stock > 0 ? 'var(--gold)' : 'var(--accent2)';
  }

  // Meta (beden/renk/özellikler)
  const meta = typeof p.meta === 'string' ? tryParse(p.meta) : (p.meta || {});

  if (meta?.sizes?.length) {
    const sizeOpts = document.getElementById('sizeOptions');
    const sizeSection = document.getElementById('sizeSection');
    if (sizeOpts) sizeOpts.innerHTML = meta.sizes.map(s =>
      `<button class="size-opt" onclick="selectSize(${JSON.stringify(s)},this)">${escHtml(s)}</button>`).join('');
    if (sizeSection) sizeSection.style.display = '';
  }

  if (meta?.colors?.length) {
    const colorOpts = document.getElementById('colorOptions');
    const colorSection = document.getElementById('colorSection');
    if (colorOpts) colorOpts.innerHTML = meta.colors.map(c =>
      `<div class="color-opt" style="background:${escHtml(colorToHex(c))}" title="${escHtml(c)}" onclick="selectColor(${JSON.stringify(c)},this)"></div>`).join('');
    if (colorSection) colorSection.style.display = '';
  }

  if (meta?.specs && Object.keys(meta.specs).length) {
    const specsTable = document.getElementById('specsTable');
    const productSpecs = document.getElementById('productSpecs');
    if (specsTable) specsTable.innerHTML = Object.entries(meta.specs).map(([k,v]) =>
      `<tr><td>${escHtml(k)}</td><td>${escHtml(v)}</td></tr>`).join('');
    if (productSpecs) productSpecs.style.display = '';
  }

  if (p.description) {
    const descText = document.getElementById('descText');
    const productDesc = document.getElementById('productDesc');
    if (descText) descText.textContent = p.description;
    if (productDesc) productDesc.style.display = '';
  }
}

function tryParse(s) { try { return JSON.parse(s); } catch { return {}; } }

function colorToHex(c) {
  const map = { Siyah:'#1c1c2e', Beyaz:'#f8f9fc', Kırmızı:'#e63946', Mavi:'#2d3aaa', Yeşil:'#22c55e', Sarı:'#f4a226', Gri:'#9ca3af', Pembe:'#f472b6', Mor:'#7c3aed', Turuncu:'#f97316', 'Lacivert':'#1a1f5e', 'Kahverengi':'#92400e' };
  return map[c] || c;
}

// ── Galeri ───────────────────────────────────────────────────
function setMainEmoji(emoji, el) {
  document.getElementById('mainEmoji').textContent = emoji;
  document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

// ── Beden / Renk seç ─────────────────────────────────────────
function selectSize(s, el) {
  selectedSize = s;
  document.querySelectorAll('.size-opt').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function selectColor(c, el) {
  selectedColor = c;
  document.getElementById('selectedColor').textContent = c;
  document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

// ── Adet ─────────────────────────────────────────────────────
function changeQty(dir) {
  const inp = document.getElementById('qtyInput');
  const newVal = Math.max(1, Math.min(99, parseInt(inp.value||1) + dir));
  inp.value = newVal;
}

// ── Sepete Ekle ──────────────────────────────────────────────
async function addToCart() {
  if (!product) return;
  const btn = document.getElementById('cartBtn');
  btn.disabled = true; btn.textContent = 'Ekleniyor...';

  const r = await CartAPI.addAndSync({
    product_id:    product.id,
    product_name:  product.name,
    product_price: product.price,
    product_emoji: product.emoji || '📦',
    product_cat:   product.category_slug || '',
    product_brand: product.brand || '',
    quantity:      parseInt(document.getElementById('qtyInput').value) || 1,
    size:          selectedSize,
    color:         selectedColor,
  });

  btn.disabled = false;
  if (r.ok) {
    btn.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Eklendi!`;
    btn.style.background = 'var(--success)';
    showToast('🛒 Sepete eklendi!');
    setTimeout(() => {
      btn.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg> Sepete Ekle`;
      btn.style.background = '';
    }, 2000);
  } else {
    showToast(r.data.message || 'Eklenemedi.', true);
  }
}

// ── Hemen Satın Al ───────────────────────────────────────────
async function buyNow() {
  await addToCart();
  setTimeout(() => window.location.href = 'sepet.html', 800);
}

// ── Favori ───────────────────────────────────────────────────
async function toggleFavorite() {
  if (!Auth.isLoggedIn()) { showToast('Favorilere eklemek için giriş yapın.', true); return; }
  isFavorite = await FavAPI.toggle({
    product_id:    product.id,
    product_name:  product.name,
    product_price: product.price,
    product_emoji: product.emoji || '📦',
    product_cat:   product.category_slug || '',
    product_brand: product.brand || '',
  });
  showToast(isFavorite ? '❤️ Favorilere eklendi!' : 'Favorilerden çıkarıldı.');
  updateFavBtn();
}

function updateFavBtn() {
  const btn = document.getElementById('favBtn');
  if (!btn) return;
  if (isFavorite) { btn.classList.add('active'); document.getElementById('favBtnText').textContent = 'Favorilerimde'; }
  else            { btn.classList.remove('active'); document.getElementById('favBtnText').textContent = 'Favorilere Ekle'; }
}

// ── Yorumlar ─────────────────────────────────────────────────
async function loadReviews(sku, page) {
  const loadingEl = document.getElementById('reviewsLoading');
  const listEl    = document.getElementById('reviewsList');
  if (loadingEl) loadingEl.style.display = '';
  if (listEl)    listEl.innerHTML = '';

  const r = await ReviewAPI.list(sku, { page });
  if (loadingEl) loadingEl.style.display = 'none';

  if (!r.ok) return;
  const { items=[], avg_rating=0, total=0, distribution={}, total_pages=1 } = r.data.data;

  // Özet
  const avgEl = document.getElementById('avgRating');
  if (avgEl) {
    const stars = '★'.repeat(Math.round(avg_rating)) + '☆'.repeat(5-Math.round(avg_rating));
    avgEl.innerHTML = `
      <div class="avg-num">${avg_rating.toFixed(1)}</div>
      <div class="avg-stars">${stars}</div>
      <div class="avg-count">${total} değerlendirme</div>`;
  }

  const barsEl = document.getElementById('ratingBars');
  if (barsEl) {
    barsEl.innerHTML = [5,4,3,2,1].map(star => {
      const cnt = distribution[star] || 0;
      const pct = total ? Math.round(cnt/total*100) : 0;
      return `<div class="rb-row"><span class="rb-label">${star}★</span><div class="rb-bar"><div class="rb-fill" style="width:${pct}%"></div></div><span class="rb-count">${cnt}</span></div>`;
    }).join('');
  }

  if (listEl) {
    if (!items.length) {
      listEl.innerHTML = '<p style="text-align:center;padding:32px;color:var(--muted);">Henüz yorum yapılmamış. İlk yorumu siz yapın!</p>';
    } else {
      listEl.innerHTML = items.map(rv => {
        const safeRating = Math.min(5, Math.max(0, parseInt(rv.rating) || 0));
        const rvStars = '★'.repeat(safeRating) + '☆'.repeat(5-safeRating);
        const initials = escHtml((rv.user_name||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase());
        const date = rv.created_at ? new Date(rv.created_at).toLocaleDateString('tr-TR') : '';
        return `
          <div class="review-card">
            <div class="rv-header">
              <div class="rv-avatar">${initials}</div>
              <div><div class="rv-name">${escHtml(rv.user_name||'Kullanıcı')}</div><div class="rv-date">${escHtml(date)}</div></div>
              <div class="rv-stars" style="margin-left:auto;">${rvStars}</div>
            </div>
            ${rv.title ? `<div class="rv-title">${escHtml(rv.title)}</div>` : ''}
            <div class="rv-body">${escHtml(rv.body||'')}</div>
          </div>`;
      }).join('');
    }
  }

  // Sayfalama
  const pagEl = document.getElementById('reviewsPagination');
  if (pagEl && total_pages > 1) {
    pagEl.innerHTML = '';
    for (let i = 1; i <= total_pages; i++) {
      const pbtn = document.createElement('button');
      pbtn.className = `rv-pg${i === page ? ' active' : ''}`;
      pbtn.textContent = String(i);
      pbtn.addEventListener('click', (pg => () => loadReviews(sku, pg))(i));
      pagEl.appendChild(pbtn);
    }
  }
}

// ── Yorum formu ──────────────────────────────────────────────
function toggleReviewForm() {
  const form = document.getElementById('reviewForm');
  form.style.display = form.style.display === 'none' ? '' : 'none';
  if (!Auth.isLoggedIn()) { showToast('Yorum yazmak için giriş yapın.', true); form.style.display = 'none'; }
}

function setRating(n) {
  selectedRating = n;
  document.querySelectorAll('#starSelect span').forEach((s,i) => {
    s.textContent = i < n ? '★' : '☆';
    s.classList.toggle('filled', i < n);
  });
}

async function submitReview() {
  if (!selectedRating) { showToast('Lütfen bir puan seçin.', true); return; }
  const body = document.getElementById('reviewBody').value.trim();
  if (body.length < 10) { showToast('Yorum en az 10 karakter olmalıdır.', true); return; }

  const r = await ReviewAPI.add({
    product_id: product.id,
    rating:     selectedRating,
    title:      document.getElementById('reviewTitle').value.trim(),
    body,
  });

  if (r.ok) {
    showToast('Yorumunuz eklendi! ⭐');
    toggleReviewForm();
    loadReviews(product.id, 1);
  } else {
    showToast(r.data.message || 'Yorum gönderilemedi.', true);
  }
}

// ── Hata ─────────────────────────────────────────────────────
function showError(msg) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorMsg').textContent = msg;
  document.getElementById('errorState').style.display = '';
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, isError=false) {
  const t = document.getElementById('toast');
  t.querySelector('span').textContent = msg;
  t.querySelector('svg').style.color = isError ? '#e63946' : '#22c55e';
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2800);
}
