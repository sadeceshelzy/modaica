/* =============================================
   MODAICA — Sepet Sayfası JavaScript
   API Entegrasyonu: CartAPI + FavAPI + OrderAPI
   ============================================= */

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

let cart = [];
let couponCode = '';
let couponDiscount = 0;
let selectedShipping = 'standard';
let serverSummary = null;   // Sunucudan gelen özet (checkout için)

const SHIPPING_OPTS = [
  { id: 'standard', name: 'Standart Kargo', desc: '2–4 iş günü', price: 39.90, emoji: '🚚', free_threshold: 750 },
  { id: 'fast', name: 'Hızlı Teslimat', desc: '1 iş günü', price: 59.90, emoji: '⚡' },
  { id: 'sameday', name: 'Aynı Gün Teslimat', desc: 'Bugün kapınızda', price: 99.90, emoji: '🏍' },
];

const SUGGESTED = [
  { id: 'sug-1', name: 'Kablosuz Kulaklık', price: 349.90, emoji: '🎧', cat: 'Elektronik', href: 'elektronik.html?cat=ses' },
  { id: 'sug-2', name: 'Deri Omuz Çantası', price: 299.90, emoji: '👜', cat: 'Kadın / Çanta', href: 'kadin.html?cat=canta' },
  { id: 'sug-3', name: 'Spor Ayakkabı', price: 399.90, emoji: '👟', cat: 'Spor', href: 'spor.html?cat=ayakkabi' },
  { id: 'sug-4', name: 'Hyalüronik Serum', price: 249.90, emoji: '💧', cat: 'Kozmetik', href: 'kozmetik.html?cat=yuz-bakim' },
];

// ── Toast ────────────────────────────────────────────────────
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.querySelector('span').textContent = msg;
  t.querySelector('svg').style.color = isError ? '#e63946' : '#22c55e';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── İlk Yükleme ──────────────────────────────────────────────
async function init() {
  await loadCart();   // Giriş yapılmamış olsa bile localStorage sepetini yükle
  renderAll();
  if (!Auth.isLoggedIn()) _addGuestNote();
}

// ── Sepeti Yükle ─────────────────────────────────────────────
async function loadCart() {
  if (Auth.isLoggedIn() && API_BASE) {
    const r = await CartAPI.get();
    if (r.ok) {
      const items = r.data.data?.items || [];

      // Sunucu boş dönse bile localStorage'daki ürünleri koru
      let localItems = [];
      try { localItems = JSON.parse(localStorage.getItem('modaica_cart') || '[]'); } catch {}

      if (items.length > 0) {
        // Sunucu dolu → sunucu veriyi kullan
        cart = items.map(i => ({
          product_id: i.product_id,
          name: i.product_name,
          price: i.product_price,
          emoji: i.product_emoji || '📦',
          cat: i.product_cat || '',
          brand: i.product_brand || '',
          href: i.product_href || '',
          quantity: i.quantity || 1,
          size: i.size || '',
          color: i.color || '',
        }));
        serverSummary = r.data.data?.summary || null;
        localStorage.setItem('modaica_cart', JSON.stringify(cart));
      } else if (localItems.length > 0) {
        // Sunucu boş ama localStorage dolu → localStorage'ı sunucuya yükle
        cart = localItems.map(i => ({
          product_id: i.product_id,
          name: i.product_name || i.name,
          price: i.product_price || i.price || 0,
          emoji: i.product_emoji || i.emoji || '📦',
          cat: i.product_cat || i.cat || '',
          brand: i.product_brand || i.brand || '',
          href: i.product_href || i.href || '',
          quantity: i.quantity || 1,
          size: i.size || '',
          color: i.color || '',
        }));
        // Sunucuya senkronize et
        for (const item of cart) {
          CartAPI.add({ product_id: item.product_id, product_name: item.name, product_price: item.price, product_emoji: item.emoji, product_cat: item.cat, product_brand: item.brand, quantity: item.quantity }).catch(() => {});
        }
      } else {
        cart = [];
        localStorage.setItem('modaica_cart', '[]');
      }
      return;
    }
  }
  // Her durumda localStorage fallback
  let raw; try { raw = JSON.parse(localStorage.getItem('modaica_cart') || '[]'); } catch { raw = []; }
  cart = raw.map(i => ({
    product_id: i.product_id,
    name: i.product_name || i.name,
    price: i.product_price || i.price || 0,
    emoji: i.product_emoji || i.emoji || '📦',
    cat: i.product_cat || i.cat || '',
    brand: i.brand || '',
    href: i.href || '',
    quantity: i.quantity || 1,
    size: i.size || '',
    color: i.color || '',
  }));
}

// ── localStorage + Badge ─────────────────────────────────────
function syncLocal() {
  localStorage.setItem('modaica_cart', JSON.stringify(cart));
  updateBadges();
}

// ── Miktar Güncelle ──────────────────────────────────────────
async function updateQty(productId, newQty) {
  if (newQty < 1) { await removeItem(productId); return; }
  if (newQty > 99) { showToast('Maksimum 99 adet.', true); return; }

  const r = await CartAPI.updateQty(productId, newQty);
  if (r.ok) {
    const item = cart.find(c => c.product_id == productId);
    if (item) item.quantity = newQty;
    syncLocal();
    renderAll();
  } else { showToast(r.data.message || 'Güncelleme başarısız.', true); }
}

// ── Ürün Kaldır ──────────────────────────────────────────────
async function removeItem(productId) {
  const r = await CartAPI.remove(productId);
  if (r.ok) {
    cart = cart.filter(c => c.product_id != productId);
    syncLocal();
    renderAll();
    showToast('Ürün sepetten kaldırıldı.');
  } else { showToast(r.data.message || 'Kaldırılamadı.', true); }
}

// ── Favoriye Taşı ────────────────────────────────────────────
async function moveToFav(productId) {
  const item = cart.find(c => c.product_id == productId);
  if (!item) return;

  const r = await FavAPI.add({
    product_id: item.product_id,
    product_name: item.name,
    product_price: item.price,
    product_emoji: item.emoji,
    product_cat: item.cat,
    product_brand: item.brand,
    product_href: item.href,
  });

  if (r.ok || r.data?.data?.already_exists) {
    await removeItem(productId);
    showToast('Ürün favorilere taşındı! ❤️');
  } else { showToast(r.data.message || 'Favorilere eklenemedi.', true); }
}

// ── Sepeti Temizle ───────────────────────────────────────────
async function clearCart() {
  if (!confirm('Sepetinizdeki tüm ürünler silinecek. Emin misiniz?')) return;
  const r = await CartAPI.clear();
  if (r.ok) {
    cart = [];
    couponCode = ''; couponDiscount = 0;
    syncLocal();
    renderAll();
    showToast('Sepet temizlendi.');
  } else { showToast(r.data.message || 'Temizleme başarısız.', true); }
}

// ── Kupon Uygula ─────────────────────────────────────────────
async function applyCoupon() {
  const input = document.getElementById('couponInput');
  const code = input?.value.trim().toUpperCase() || '';
  const msg = document.getElementById('couponMsg');
  if (!code) { showToast('Kupon kodu girin.', true); return; }

  const subtotal = calcSubtotal();
  const r = await CartAPI.applyCoupon(code, subtotal);

  if (r.ok) {
    couponDiscount = r.data.data.discount_pct || 0;
    couponCode = code;
    if (msg) {
      msg.textContent = `✓ "${code}" kuponu uygulandı! %${couponDiscount} indirim kazandınız.`;
      msg.className = 'coupon-msg success';
    }
    renderSummary();
    showToast(`%${couponDiscount} kupon indirimi uygulandı! 🎉`);
  } else {
    couponDiscount = 0; couponCode = '';
    if (msg) {
      msg.textContent = `✗ ${r.data.message || 'Geçersiz kupon kodu.'}`;
      msg.className = 'coupon-msg error';
    }
    renderSummary();
    showToast(r.data.message || 'Geçersiz kupon kodu.', true);
  }
}

// ── Ödemeye Geç ──────────────────────────────────────────────
function checkout() {
  // cart henüz yüklenmediyse localStorage'dan oku
  if (cart.length === 0) {
    try {
      const local = JSON.parse(localStorage.getItem('modaica_cart') || '[]');
      if (local.length > 0) {
        cart = local.map(i => ({
          product_id: i.product_id,
          name: i.product_name || i.name,
          price: i.product_price || i.price || 0,
          emoji: i.product_emoji || i.emoji || '📦',
          cat: i.product_cat || i.cat || '',
          brand: i.product_brand || i.brand || '',
          quantity: i.quantity || 1,
          size: i.size || '',
          color: i.color || '',
        }));
      }
    } catch {}
  }
  if (cart.length === 0) { showToast('Sepetiniz boş.', true); return; }

  if (!Auth.isLoggedIn()) {
    showToast('Ödeme için giriş yapmanız gerekiyor.', true);
    setTimeout(() => { window.location.href = 'hesabim.html?redirect=sepet'; }, 1500);
    return;
  }

  // Sepet + ödeme bilgisini localStorage'a bırak, odeme.html okuyacak
  const checkoutData = {
    items: cart,
    subtotal: calcSubtotal(),
    coupon: couponCode,
    couponDiscount: couponDiscount,
    shipping: selectedShipping,
    total: calcTotal(),
  };
  localStorage.setItem('modaica_checkout', JSON.stringify(checkoutData));
  window.location.href = 'odeme.html';
}

// ── Hesaplamalar ─────────────────────────────────────────────
function calcSubtotal() {
  return cart.reduce((s, i) => s + parseFloat(i.price || 0) * (i.quantity || 1), 0);
}
function calcCoupon(sub) { return couponDiscount > 0 ? sub * couponDiscount / 100 : 0; }
function calcShipping(sub) {
  const opt = SHIPPING_OPTS.find(o => o.id === selectedShipping);
  if (!opt) return 0;
  if (opt.free_threshold && sub >= opt.free_threshold) return 0;
  return opt.price;
}
function calcTotal() {
  const sub = calcSubtotal();
  return Math.max(0, sub - calcCoupon(sub) + calcShipping(sub));
}
function fmt(n) { return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ── Tüm Sayfayı Render Et ────────────────────────────────────
function renderAll() {
  renderCartItems();
  renderShipping();
  renderSummary();
  renderSuggested();
  updateBadges();
}

// ── Sepet Ürünleri ───────────────────────────────────────────
function renderCartItems() {
  const container = document.getElementById('cartContent');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="panel" style="border-radius:20px;">
        <div class="empty-state">
          <div class="empty-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
          <h2>Sepetiniz boş</h2>
          <p>Beğendiğiniz ürünleri sepete ekleyin, hızlıca satın alın.</p>
          <a href="anasayfa.html" class="go-shop">🛍 Alışverişe Başla</a>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          Sepetim
          <span style="font-size:14px;font-weight:400;color:var(--muted);">(${cart.length} ürün)</span>
        </div>
        <button onclick="clearCart()" style="background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;display:flex;align-items:center;gap:5px;">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
          Sepeti Temizle
        </button>
      </div>
      <div class="cart-items">
        ${cart.map((item, i) => cartItemHTML(item, i)).join('')}
      </div>
    </div>`;

  // Adet butonları
  container.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const pid = this.dataset.productId;
      const dir = parseInt(this.dataset.dir);
      const item = cart.find(c => c.product_id == pid);
      if (item) updateQty(pid, (item.quantity || 1) + dir);
    });
  });

  // Sil butonları
  container.querySelectorAll('.ci-del-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const pid = this.dataset.productId;
      const row = this.closest('.cart-item');
      row.style.transform = 'translateX(20px)'; row.style.opacity = '0'; row.style.transition = 'all .3s';
      setTimeout(() => removeItem(pid), 300);
    });
  });

  // Favoriye taşı butonları
  container.querySelectorAll('.ci-fav-btn').forEach(btn => {
    btn.addEventListener('click', function () { moveToFav(this.dataset.productId); });
  });
}

// ── Sepet Ürün HTML ──────────────────────────────────────────
function cartItemHTML(item, i) {
  const qty = item.quantity || 1;
  const price = parseFloat(item.price || 0);
  const total = price * qty;

  return `
    <div class="cart-item" style="animation-delay:${i * 0.06}s;" data-product-id="${escHtml(String(item.product_id))}">
      <div class="ci-img">${escHtml(item.emoji || '📦')}</div>
      <div class="ci-info">
        <div class="ci-cat">${escHtml(item.cat || '')}</div>
        <div class="ci-name">${escHtml(item.name)}</div>
        <div class="ci-meta">
          ${item.size ? `<span class="ci-variant">Beden: ${escHtml(item.size)}</span>` : ''}
          ${item.color ? `<span class="ci-variant">Renk: ${escHtml(item.color)}</span>` : ''}
        </div>
        <div class="ci-actions">
          <button class="ci-fav-btn" data-product-id="${escHtml(String(item.product_id))}">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
            Favorilere Taşı
          </button>
          <span style="color:var(--border);">|</span>
          <button class="ci-del-btn" data-product-id="${escHtml(String(item.product_id))}">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Kaldır
          </button>
        </div>
      </div>
      <div class="ci-right">
        <div>
          <div class="ci-price">₺${fmt(total)}</div>
          ${qty > 1 ? `<div style="font-size:11px;color:var(--muted);">${qty} × ₺${fmt(price)}</div>` : ''}
        </div>
        <div class="qty-ctrl">
          <button class="qty-btn" data-product-id="${escHtml(String(item.product_id))}" data-dir="-1" ${qty <= 1 ? 'disabled' : ''}>−</button>
          <input class="qty-val" type="text" value="${qty}" readonly>
          <button class="qty-btn" data-product-id="${escHtml(String(item.product_id))}" data-dir="1">+</button>
        </div>
      </div>
    </div>`;
}

// ── Kargo Seçenekleri ────────────────────────────────────────
function renderShipping() {
  const container = document.getElementById('shippingOpts');
  if (!container) return;
  const sub = calcSubtotal();

  container.innerHTML = SHIPPING_OPTS.map(opt => {
    const isFree = opt.free_threshold && sub >= opt.free_threshold;
    const priceText = (isFree || opt.price === 0)
      ? '<span class="so-free">Ücretsiz</span>'
      : `₺${fmt(opt.price)}`;
    const remaining = opt.free_threshold && sub < opt.free_threshold
      ? ` · ₺${fmt(opt.free_threshold - sub)} daha harcayın, ücretsiz olsun` : '';

    return `
      <label class="shipping-opt ${selectedShipping === opt.id ? 'selected' : ''}">
        <input type="radio" name="shipping" value="${opt.id}"
          ${selectedShipping === opt.id ? 'checked' : ''}
          onchange="changeShipping('${opt.id}')">
        <div class="so-icon">${opt.emoji}</div>
        <div class="so-info">
          <div class="so-name">${opt.name}</div>
          <div class="so-desc">${opt.desc}${remaining}</div>
        </div>
        <div class="so-price">${priceText}</div>
      </label>`;
  }).join('');
}

function changeShipping(id) {
  selectedShipping = id;
  document.querySelectorAll('.shipping-opt').forEach(el => {
    el.classList.toggle('selected', el.querySelector('input').value === id);
  });
  renderSummary();
}

// ── Özet ─────────────────────────────────────────────────────
function renderSummary() {
  const container = document.getElementById('summaryBody');
  if (!container) return;
  if (cart.length === 0) { container.innerHTML = ''; return; }

  const sub = calcSubtotal();
  const coupon = calcCoupon(sub);
  const shipping = calcShipping(sub);
  const total = calcTotal();
  const shOpt = SHIPPING_OPTS.find(o => o.id === selectedShipping);

  container.innerHTML = `
    <div class="summary-row">
      <span class="label">Ara Toplam (${cart.reduce((s, i) => s + (i.quantity || 1), 0)} ürün)</span>
      <span class="value">₺${fmt(sub)}</span>
    </div>
    ${coupon > 0 ? `
    <div class="summary-row" style="color:var(--accent2);">
      <span class="label">Kupon (${couponCode})</span>
      <span class="value" style="color:var(--accent2);">−₺${fmt(coupon)}</span>
    </div>` : ''}
    <div class="summary-row">
      <span class="label">Kargo (${shOpt?.name || ''})</span>
      <span class="value" style="${shipping === 0 ? 'color:var(--success);' : ''}">
        ${shipping === 0 ? 'Ücretsiz' : '₺' + fmt(shipping)}
      </span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-total">
      <span class="label">Toplam</span>
      <span class="value">₺${fmt(total)}</span>
    </div>
    <button class="checkout-btn" onclick="checkout()">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
      </svg>
      Güvenli Ödemeye Geç
    </button>
    <div class="secure-note">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
      </svg>
      256-bit SSL ile güvenli ödeme
    </div>`;
}

// ── Öneri Ürünleri ───────────────────────────────────────────
function renderSuggested() {
  const container = document.getElementById('suggestedGrid');
  if (!container) return;
  const inCart = cart.map(c => c.product_id);
  const filtered = SUGGESTED.filter(s => !inCart.includes(s.id));
  const section = document.getElementById('suggestedSection');
  if (!section) return;
  if (filtered.length === 0) { section.style.display = 'none'; return; }
  section.style.display = '';
  container.innerHTML = filtered.map(s => `
    <div class="sg-card">
      <div class="sg-img">${s.emoji}</div>
      <div class="sg-name">${s.name}</div>
      <div class="sg-price">₺${fmt(s.price)}</div>
      <button class="sg-add" onclick="addSuggested('${s.id}')">+ Sepete Ekle</button>
    </div>`).join('');
}

async function addSuggested(id) {
  const s = SUGGESTED.find(x => x.id === id);
  if (!s) return;
  const r = await CartAPI.addAndSync({
    product_id: s.id,
    product_name: s.name,
    product_price: s.price,
    product_emoji: s.emoji,
    product_cat: s.cat,
    quantity: 1,
  });
  if (r.ok) {
    const item = { product_id: s.id, name: s.name, price: s.price, emoji: s.emoji, cat: s.cat, quantity: 1 };
    const ex = cart.find(c => c.product_id === s.id);
    if (ex) ex.quantity++; else cart.push(item);
    syncLocal(); renderAll();
    showToast(`${s.name} sepete eklendi!`);
  }
}

// ── Misafir Notu (giriş yapılmamış) ─────────────────────────
function _addGuestNote() {
  const summaryEl = document.getElementById('summaryBody');
  if (!summaryEl || cart.length === 0) return;
  const note = document.createElement('div');
  note.className = 'guest-note';
  note.innerHTML = `
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    <span>Ödeme yapmak için <a href="hesabim.html" style="color:var(--primary);text-decoration:none;font-weight:600;">giriş yapın</a>. Sepetiniz kaydedilir.</span>`;
  note.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);padding:12px;background:var(--light);border-radius:8px;margin-top:12px;';
  summaryEl.appendChild(note);
}

// ── Eventler ─────────────────────────────────────────────────
document.getElementById('couponBtn')?.addEventListener('click', applyCoupon);
document.getElementById('couponInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') applyCoupon();
});

// ── Başlat ───────────────────────────────────────────────────
init();
