/* =============================================
   MODAICA — Hesabım Sayfası JavaScript
   API Entegrasyonu: AuthAPI + UserAPI + OrderAPI
   ============================================= */

// ── XSS Escape ─────────────────────────────────
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

// ── State ──────────────────────────────────────
const state = {
  user: null,
  orders: [],
  favorites: [],
  addresses: [],
  points: 0,
  pointsLog: [],
  notifPrefs: {},
  security: {},
};

// ── Toast ───────────────────────────────────────
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.querySelector('span').textContent = msg;
  t.querySelector('svg').style.color = isError ? '#e63946' : '#22c55e';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Yükleme göstergesi ──────────────────────────
function setLoading(id, on) {
  const el = document.getElementById(id);
  if (el) el.style.opacity = on ? '0.5' : '1';
}

// ── Auth Tab ────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.panel).classList.add('active');
  });
});

document.querySelectorAll('[data-switch]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    const target = el.dataset.switch;
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === target));
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.toggle('active', p.id === target));
  });
});

// ── Şifre Göster/Gizle ─────────────────────────
document.querySelectorAll('.pw-görünürlük').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = btn.closest('.input-wrap').querySelector('input');
    const isText = inp.type === 'text';
    inp.type = isText ? 'password' : 'text';
    btn.querySelector('.görünürlük-on').style.display = isText ? '' : 'none';
    btn.querySelector('.görünürlük-off').style.display = isText ? 'none' : '';
  });
});

// ── Ekran Geçişleri ─────────────────────────────
function showAuth() {
  document.getElementById('authScreen').style.display = '';
  document.getElementById('accountScreen').style.display = 'none';
}
function showAccount() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('accountScreen').style.display = 'block';
}

// ── KAYIT FORMU ─────────────────────────────────
document.getElementById('registerForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const firstName = this.firstName.value.trim();
  const lastName = this.lastName.value.trim();
  const email = this.email.value.trim();
  const password = this.password.value;
  const terms = this.terms?.checked ?? true;

  if (!terms) { showToast('Kullanım koşullarını kabul etmelisiniz.', true); return; }
  if (password.length < 8) { showToast('Şifre en az 8 karakter olmalıdır.', true); return; }
  if (!email.includes('@')) { showToast('Geçerli bir e-posta girin.', true); return; }

  const btn = this.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';

  const r = await AuthAPI.register(`${firstName} ${lastName}`, email, password);
  btn.disabled = false; btn.textContent = 'Üye Ol';

  if (!r.ok) { showToast(r.data.message || 'Kayıt başarısız.', true); return; }

  showToast(`Hoş geldiniz, ${firstName}! 🎉`);
  await initAccount();
});

// ── GİRİŞ FORMU ─────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const email = this.email.value.trim();
  const password = this.password.value;

  const btn = this.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Giriş yapılıyor...';

  const r = await AuthAPI.login(email, password);
  btn.disabled = false; btn.textContent = 'Giriş Yap';

  if (!r.ok) { showToast(r.data.message || 'E-posta veya şifre hatalı.', true); return; }

  showToast('Hoş geldiniz! 🎉');
  await initAccount();
});

// ── Hesap İlkleme ───────────────────────────────
async function initAccount() {
  if (!Auth.isLoggedIn()) { showAuth(); return; }

  // Paralel API çağrıları
  const [profRes, ordRes, favRes, addrRes, ptsRes, notifRes, secRes] = await Promise.all([
    UserAPI.getProfile(),
    OrderAPI.list(),
    FavAPI.list(),
    UserAPI.getAddresses(),
    UserAPI.getPoints(),
    UserAPI.getNotifications(),
    UserAPI.getSecurity(),
  ]);

  if (!profRes.ok) { Auth.clear(); showAuth(); return; }

  state.user = profRes.data.data.user;

  // Siparişler: API + demo siparişleri birleştir
  const apiOrders = ordRes.ok ? (ordRes.data.data.items || []) : [];
  let demoOrders = [];
  try { demoOrders = JSON.parse(localStorage.getItem('modaica_demo_orders') || '[]'); } catch {}
  // Demo siparişleri API formatına çevir
  const demoFormatted = demoOrders.map(o => ({
    order_code: o.order_code,
    status: o.status || 'pending',
    total_amount: o.total_amount,
    created_at: o.created_at,
    items: o.items || [],
  }));
  // API siparişlerinde yoksa demo'dan ekle
  const apiCodes = new Set(apiOrders.map(o => o.order_code));
  const merged = [...apiOrders, ...demoFormatted.filter(o => !apiCodes.has(o.order_code))];
  state.orders = merged;

  // Favoriler: API + localStorage birleştir
  const apiFavs = favRes.ok ? (favRes.data.data.items || []) : [];
  let localFavs = [];
  try { localFavs = JSON.parse(localStorage.getItem('modaica_favorites') || '[]'); } catch {}
  const favIds = new Set(apiFavs.map(f => f.product_id));
  state.favorites = [...apiFavs, ...localFavs.filter(f => !favIds.has(f.product_id))];
  state.addresses = addrRes.ok ? (addrRes.data.data.addresses || []) : [];
  state.points = ptsRes.ok ? (ptsRes.data.data.balance || 0) : 0;
  state.pointsLog = ptsRes.ok ? (ptsRes.data.data.history?.items || []) : [];
  state.notifPrefs = notifRes.ok ? (notifRes.data.data.prefs || {}) : {};
  state.security = secRes.ok ? (secRes.data.data.settings || {}) : {};

  // localStorage'ı güncelle (badge'ler için)
  localStorage.setItem('modaica_favorites', JSON.stringify(state.favorites));

  renderAccountScreen();
  showAccount();

  // URL'de tab parametresi varsa aç
  const tab = new URLSearchParams(location.search).get('tab');
  if (tab) showSection(tab);
}

// ── Hesap Paneli ────────────────────────────────
function renderAccountScreen() {
  if (!state.user) { showAuth(); return; }

  const u = state.user;
  const fullName = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim();
  const initials = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  document.querySelectorAll('.profile-name').forEach(el => el.textContent = fullName);
  document.querySelectorAll('.profile-email').forEach(el => el.textContent = u.email);
  document.querySelectorAll('.avatar').forEach(el => {
    if (u.avatar) {
      const img = document.createElement('img');
      img.alt = 'Avatar';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      // Only allow data URLs or http(s) URLs for avatar
      if (/^(data:image\/|https?:\/\/)/.test(u.avatar)) {
        img.src = u.avatar;
      }
      el.innerHTML = '';
      el.appendChild(img);
    } else {
      el.textContent = initials;
    }
  });

  const tier = calcTier(state.points);
  document.querySelectorAll('.member-badge').forEach(el =>
    el.textContent = tier.icon + ' ' + tier.name + ' Üye'
  );

  document.getElementById('statOrders')?.textContent !== undefined &&
    (document.getElementById('statOrders').textContent = state.orders.length);
  document.getElementById('statShipping')?.textContent !== undefined &&
    (document.getElementById('statShipping').textContent = state.orders.filter(o => o.status === 'shipping').length);
  document.getElementById('statFavs')?.textContent !== undefined &&
    (document.getElementById('statFavs').textContent = state.favorites.length);
  document.getElementById('statPoints')?.textContent !== undefined &&
    (document.getElementById('statPoints').textContent = state.points.toLocaleString('tr-TR'));

  const orderBadge = document.getElementById('sideOrderBadge');
  const favBadge = document.getElementById('sideFavBadge');
  if (orderBadge) { orderBadge.textContent = state.orders.length; orderBadge.style.display = state.orders.length > 0 ? '' : 'none'; }
  if (favBadge) { favBadge.textContent = state.favorites.length; favBadge.style.display = state.favorites.length > 0 ? '' : 'none'; }

  renderMiniOrders();
  renderOrders();
  renderFavorites();
  renderAddresses();
  renderLoyalty();
  renderNotifications();
  renderSecurity();
  fillProfileForm();
}

// ── Tier ────────────────────────────────────────
function calcTier(pts) {
  if (pts >= 2500) return { name: 'Platinum', icon: '💎' };
  if (pts >= 1000) return { name: 'Gold', icon: '⭐' };
  if (pts >= 500) return { name: 'Silver', icon: '🥈' };
  return { name: 'Bronze', icon: '🥉' };
}

// ── Bölüm Navigasyonu ───────────────────────────
const sectionIds = ['ozet', 'profil', 'siparisler', 'favoriler', 'adresler', 'guvenlik', 'bildirimler', 'sadakat'];

function showSection(id) {
  sectionIds.forEach(sid => {
    const el = document.getElementById('sec-' + sid);
    if (el) el.style.display = sid === id ? 'flex' : 'none';
  });
  document.querySelectorAll('.sidebar-link[data-section]').forEach(l =>
    l.classList.toggle('active', l.dataset.section === id)
  );
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
  link.addEventListener('click', () => showSection(link.dataset.section));
});
document.querySelectorAll('.stat-card[data-goto]').forEach(card => {
  card.addEventListener('click', () => showSection(card.dataset.goto));
});

// ── Sipariş Kartı HTML ──────────────────────────
function orderCardHTML(o) {
  const statusMap = {
    pending: { cls: 'status-pending', label: '⏳ Hazırlanıyor' },
    preparing: { cls: 'status-pending', label: '📦 Paketleniyor' },
    shipping: { cls: 'status-shipping', label: '🚚 Kargoda' },
    delivered: { cls: 'status-delivered', label: '✅ Teslim Edildi' },
    cancelled: { cls: 'status-cancelled', label: '❌ İptal Edildi' },
  };
  const st = statusMap[o.status] || statusMap.pending;
  const thumbs = (o.items || []).map(it => `<div class="order-item-thumb">${escHtml(it.product_emoji || '📦')}</div>`).join('');
  const date = o.created_at ? new Date(o.created_at).toLocaleDateString('tr-TR') : '';
  const total = Number(o.total_amount ?? o.total ?? 0);

  return `
    <div class="order-card" data-status="${escHtml(o.status)}" data-order-code="${escHtml(o.order_code)}">
      <div class="order-head">
        <div>
          <div class="order-id">${escHtml(o.order_code)}</div>
          <div class="order-date">${escHtml(date)}</div>
        </div>
        <span class="order-status ${escHtml(st.cls)}">${st.label}</span>
      </div>
      <div class="order-body">
        <div class="order-items">${thumbs || '<div class="order-item-thumb">📦</div>'}</div>
        <div class="order-foot">
          <div>
            <div class="order-total">₺${total.toLocaleString('tr-TR')} <span>· ${(o.items || []).length} ürün</span></div>
          </div>
          <div class="order-actions">
            ${o.status === 'shipping' ? `<button class="order-btn">Kargo Takip</button>` : ''}
            ${o.status === 'delivered' ? `<button class="order-btn order-review-btn">Değerlendir</button>` : ''}
            ${['pending', 'preparing'].includes(o.status) ? `<button class="order-btn order-cancel-btn">İptal Et</button>` : ''}
            <button class="order-btn primary order-detail-btn">Detay</button>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Order card event delegation ──────────────────
function bindOrderCardEvents(container) {
  container.addEventListener('click', function(e) {
    const card = e.target.closest('.order-card');
    if (!card) return;
    const code = card.dataset.orderCode;
    if (e.target.closest('.order-cancel-btn')) {
      cancelOrder(code, e.target.closest('.order-cancel-btn'));
    } else if (e.target.closest('.order-review-btn')) {
      goReview(code);
    } else if (e.target.closest('.order-detail-btn')) {
      showSection('siparisler');
    }
  });
}

async function cancelOrder(code, btn) {
  if (!confirm('Siparişi iptal etmek istediğinizden emin misiniz?')) return;
  btn.disabled = true;
  const r = await OrderAPI.cancel(code);
  if (r.ok) {
    showToast('Sipariş iptal edildi.');
    const o = state.orders.find(x => x.order_code === code);
    if (o) o.status = 'cancelled';
    renderOrders(); renderMiniOrders();
  } else {
    showToast(r.data.message || 'İptal başarısız.', true);
    btn.disabled = false;
  }
}

function goReview(code) { showToast('Değerlendirme sayfası hazırlanıyor...'); }

// ── Mini Siparişler ─────────────────────────────
function renderMiniOrders() {
  const container = document.getElementById('miniOrders');
  if (!container) return;
  if (state.orders.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:32px 20px;">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg>
      <h3>Henüz siparişiniz yok</h3><p>Alışverişe başlamak için ürünlerimize göz atın.</p>
      <a href="anasayfa.html" class="go-shop">🛍 Alışverişe Başla</a></div>`;
    return;
  }
  container.innerHTML = [...state.orders].slice(0, 2).map(o => orderCardHTML(o)).join('');
  bindOrderCardEvents(container);
}

// ── Siparişler ──────────────────────────────────
function renderOrders() {
  const container = document.getElementById('ordersList');
  if (!container) return;
  if (state.orders.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg>
      <h3>Henüz siparişiniz bulunmuyor</h3><p>İlk siparişinizi verin ve burada takip edin.</p>
      <a href="anasayfa.html" class="go-shop">🛍 Alışverişe Başla</a></div>`;
    return;
  }
  container.innerHTML = state.orders.map(o => orderCardHTML(o)).join('');
  bindOrderCardEvents(container);
}

// ── Favoriler ───────────────────────────────────
function renderFavorites() {
  const container = document.getElementById('favList');
  if (!container) return;

  const badge = document.getElementById('sideFavBadge');
  if (badge) { badge.textContent = state.favorites.length; badge.style.display = state.favorites.length > 0 ? '' : 'none'; }

  if (state.favorites.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
      <h3>Favori listeniz boş</h3><p>Beğendiğiniz ürünleri favorilere ekleyin.</p>
      <a href="anasayfa.html" class="go-shop">🛍 Ürünleri Keşfet</a></div>`;
    return;
  }

  container.innerHTML = `<div class="fav-grid">${state.favorites.map((f) => `
    <div class="fav-card">
      <div class="fav-img" style="background:#f0f0f5;">
        <span style="font-size:48px;">${escHtml(f.product_emoji || f.emoji || '📦')}</span>
        <button class="fav-remove" data-id="${escHtml(String(f.product_id || f.id))}">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="fav-info">
        <div class="fav-cat">${escHtml(f.product_cat || f.cat || '')}</div>
        <div class="fav-name">${escHtml(f.product_name || f.name)}</div>
        <div class="fav-footer">
          <span class="fav-price">₺${Number(f.product_price || f.price || 0).toLocaleString('tr-TR')}</span>
          <button class="fav-cart" data-id="${escHtml(String(f.product_id || f.id))}">Sepete Ekle</button>
        </div>
      </div>
    </div>`).join('')}</div>`;

  container.querySelectorAll('.fav-remove').forEach(btn => {
    btn.addEventListener('click', async function () {
      const pid = this.dataset.id;
      const card = this.closest('.fav-card');
      card.style.transform = 'scale(.9)'; card.style.opacity = '0'; card.style.transition = 'all .3s';
      const r = await FavAPI.remove(pid);
      setTimeout(() => {
        if (r.ok) {
          state.favorites = state.favorites.filter(f => (f.product_id || f.id) != pid);
          localStorage.setItem('modaica_favorites', JSON.stringify(state.favorites));
          renderFavorites();
          renderAccountScreen();
          showToast('Favorilerden kaldırıldı.');
        } else {
          showToast(r.data.message, true);
        }
      }, 300);
    });
  });

  container.querySelectorAll('.fav-cart').forEach(btn => {
    btn.addEventListener('click', async function () {
      const pid = this.dataset.id;
      const fav = state.favorites.find(f => (f.product_id || f.id) == pid);
      if (!fav) return;
      const r = await CartAPI.addAndSync({
        product_id: fav.product_id || fav.id,
        product_name: fav.product_name || fav.name,
        product_price: fav.product_price || fav.price,
        product_emoji: fav.product_emoji || fav.emoji || '📦',
        quantity: 1,
      });
      this.textContent = '✓ Eklendi!'; this.style.background = '#22c55e';
      setTimeout(() => { this.textContent = 'Sepete Ekle'; this.style.background = ''; }, 1800);
      showToast('Ürün sepete eklendi!');
    });
  });
}

// ── Adresler ────────────────────────────────────
function renderAddresses() {
  const container = document.getElementById('addrList');
  if (!container) return;

  const cards = state.addresses.map((a) => `
    <div class="address-card ${a.is_default ? 'default' : ''}" data-addr-id="${escHtml(String(a.id))}">
      ${a.is_default ? '<span class="default-badge">Varsayılan</span>' : ''}
      <h4>${escHtml(a.title)}</h4>
      <p>${escHtml(a.full_name)}<br>${escHtml(a.address_line)}<br>${escHtml(a.district)} / ${escHtml(a.city)}<br>${escHtml(a.phone)}</p>
      <div class="address-card-actions">
        ${!a.is_default ? `<button class="addr-btn addr-default-btn">Varsayılan Yap</button>` : ''}
        <button class="addr-btn del addr-del-btn">Sil</button>
      </div>
    </div>`).join('');

  container.innerHTML = cards + `
    <div class="add-address-card" id="addAddrCard">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      <span>Yeni Adres Ekle</span>
    </div>`;

  document.getElementById('addAddrCard').addEventListener('click', () =>
    document.getElementById('addrModal').classList.add('open')
  );

  // Event delegation for address action buttons
  container.addEventListener('click', function(e) {
    const card = e.target.closest('.address-card[data-addr-id]');
    if (!card) return;
    const id = parseInt(card.dataset.addrId, 10);
    if (e.target.closest('.addr-del-btn')) deleteAddr(id);
    else if (e.target.closest('.addr-default-btn')) setDefaultAddr(id);
  });
}

async function deleteAddr(id) {
  if (!confirm('Bu adresi silmek istediğinizden emin misiniz?')) return;
  const r = await UserAPI.deleteAddress(id);
  if (r.ok) {
    state.addresses = state.addresses.filter(a => a.id !== id);
    renderAddresses();
    showToast('Adres silindi.');
  } else { showToast(r.data.message, true); }
}

async function setDefaultAddr(id) {
  const r = await UserAPI.setDefaultAddress(id);
  if (r.ok) {
    state.addresses.forEach(a => a.is_default = a.id === id ? 1 : 0);
    renderAddresses();
    showToast('Varsayılan adres güncellendi.');
  } else { showToast(r.data.message, true); }
}

// ── Sadakat ─────────────────────────────────────
function renderLoyalty() {
  const el = document.getElementById('loyaltySection');
  if (!el) return;
  const tier = calcTier(state.points);
  const nextPts = state.points < 500 ? 500 : state.points < 1000 ? 1000 : state.points < 2500 ? 2500 : null;
  const pct = nextPts ? Math.min(100, (state.points / nextPts) * 100) : 100;

  el.innerHTML = `
    <div class="loyalty-hero">
      <div style="position:relative;z-index:1;">
        <h3>${tier.icon} ${tier.name} Üye</h3>
        <p>${nextPts ? 'Bir sonraki seviyeye ' + (nextPts - state.points) + ' puan kaldı' : 'En yüksek seviyedesiniz! 🎉'}</p>
        <div class="points-display">
          <div class="points-val">${state.points.toLocaleString('tr-TR')}</div>
          <div class="points-unit">Puan</div>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-label">${nextPts ? nextPts + ' puanda bir sonraki seviye' : 'Tebrikler, Platinum üyesisiniz!'}</div>
      </div>
    </div>
    <div class="loyalty-tiers">
      <div class="tier-card ${tier.name === 'Bronze' ? 'current' : ''}"><div class="tier-icon">🥉</div><div class="tier-name">Bronze</div><div class="tier-pts">0 – 499 puan</div></div>
      <div class="tier-card ${tier.name === 'Silver' ? 'current' : ''}"><div class="tier-icon">🥈</div><div class="tier-name">Silver</div><div class="tier-pts">500 – 999 puan</div></div>
      <div class="tier-card ${tier.name === 'Gold' ? 'current' : ''}"><div class="tier-icon">⭐</div><div class="tier-name">Gold</div><div class="tier-pts">1.000 – 2.499 puan</div></div>
      <div class="tier-card ${tier.name === 'Platinum' ? 'current' : ''}"><div class="tier-icon">💎</div><div class="tier-name">Platinum</div><div class="tier-pts">2.500+ puan</div></div>
    </div>
    ${state.pointsLog.length > 0 ? `
    <div style="margin-top:24px;">
      <h4 style="margin-bottom:12px;font-size:14px;font-weight:700;">Puan Geçmişi</h4>
      ${state.pointsLog.slice(0, 5).map(p => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
          <span>${p.description || p.ref_type || 'Puan işlemi'}</span>
          <span style="color:${p.amount > 0 ? '#22c55e' : '#e63946'};font-weight:700;">${p.amount > 0 ? '+' : ''}${p.amount} puan</span>
        </div>`).join('')}
    </div>` : `<div style="margin-top:24px;padding:20px;background:var(--light);border-radius:12px;text-align:center;color:var(--muted);font-size:14px;">İlk siparişinizi verin ve puan kazanmaya başlayın! 🎉</div>`}`;
}

// ── Bildirimler ─────────────────────────────────
function renderNotifications() {
  const p = state.notifPrefs;
  const setToggle = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };
  setToggle('notif_email_order', p.email_order);
  setToggle('notif_email_promo', p.email_promo);
  setToggle('notif_sms_order', p.sms_order);
  setToggle('notif_sms_promo', p.sms_promo);
  setToggle('notif_push_order', p.push_order);
  setToggle('notif_push_promo', p.push_promo);
}

// ── Güvenlik ────────────────────────────────────
function renderSecurity() {
  const s = state.security;
  const setToggle = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };
  setToggle('sec_two_factor', s.two_factor);
  setToggle('sec_login_notify', s.login_notify);
}

// ── Profil Formu ────────────────────────────────
function fillProfileForm() {
  const u = state.user; if (!u) return;
  const f = document.getElementById('profileForm'); if (!f) return;
  const nameParts = (u.name || '').split(' ');
  if (f.firstName) f.firstName.value = u.first_name || nameParts[0] || '';
  if (f.lastName) f.lastName.value = u.last_name || nameParts.slice(1).join(' ') || '';
  if (f.emailP) f.emailP.value = u.email || '';
  if (f.phone) f.phone.value = u.phone || '';
  if (f.birthdate) f.birthdate.value = u.birthdate || '';
  if (f.gender) f.gender.value = u.gender || '';
  if (f.memberNo) f.memberNo.value = u.member_no || '';
}

document.getElementById('profileForm')?.addEventListener('submit', async function (e) {
  e.preventDefault();
  const btn = this.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';

  const firstName = this.firstName?.value.trim() || '';
  const lastName = this.lastName?.value.trim() || '';

  const r = await UserAPI.updateProfile({
    name: `${firstName} ${lastName}`.trim(),
    phone: this.phone?.value.trim() || '',
    birth_date: this.birthdate?.value || '',
    gender: this.gender?.value || '',
  });
  btn.disabled = false; btn.textContent = 'Kaydet';

  if (r.ok) {
    state.user.name = `${firstName} ${lastName}`.trim();
    renderAccountScreen();
    showToast('Profil bilgileriniz güncellendi!');
  } else { showToast(r.data.message || 'Güncelleme başarısız.', true); }
});

// ── Şifre Değiştir ───────────────────────────────
document.getElementById('pwForm')?.addEventListener('submit', async function (e) {
  e.preventDefault();
  const cur = this.currentPw?.value || '';
  const np = this.newPw?.value || '';
  const cp = this.confirmPw?.value || '';

  if (np.length < 8) { showToast('Şifre en az 8 karakter olmalı.', true); return; }
  if (np !== cp) { showToast('Şifreler eşleşmiyor.', true); return; }

  const btn = this.querySelector('button[type=submit]');
  btn.disabled = true;

  const r = await AuthAPI.changePassword(cur, np);
  btn.disabled = false;

  if (r.ok) { this.reset(); showToast('Şifreniz başarıyla güncellendi!'); }
  else { showToast(r.data.message || 'Mevcut şifre yanlış.', true); }
});

// ── Bildirim Kaydet ─────────────────────────────
document.getElementById('saveNotifs')?.addEventListener('click', async () => {
  const getVal = id => { const el = document.getElementById(id); return el ? (el.checked ? 1 : 0) : 0; };
  const r = await UserAPI.updateNotifications({
    email_order: getVal('notif_email_order'),
    email_promo: getVal('notif_email_promo'),
    sms_order: getVal('notif_sms_order'),
    sms_promo: getVal('notif_sms_promo'),
    push_order: getVal('notif_push_order'),
    push_promo: getVal('notif_push_promo'),
  });
  if (r.ok) showToast('Bildirim tercihleriniz kaydedildi!');
  else showToast(r.data.message, true);
});

// ── Güvenlik Kaydet ─────────────────────────────
document.getElementById('saveSecurity')?.addEventListener('click', async () => {
  const getVal = id => { const el = document.getElementById(id); return el ? (el.checked ? 1 : 0) : 0; };
  const r = await UserAPI.updateSecurity({
    two_factor: getVal('sec_two_factor'),
    login_notify: getVal('sec_login_notify'),
  });
  if (r.ok) showToast('Güvenlik ayarlarınız güncellendi!');
  else showToast(r.data.message, true);
});

// ── Sipariş Filtrele ────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    const filter = this.dataset.filter;
    document.querySelectorAll('#ordersList .order-card').forEach(card => {
      card.style.display = (filter === 'all' || card.dataset.status === filter) ? '' : 'none';
    });
  });
});

// ── Adres Modal ─────────────────────────────────
const addrModal = document.getElementById('addrModal');
document.getElementById('modalClose')?.addEventListener('click', () => addrModal?.classList.remove('open'));
addrModal?.addEventListener('click', e => { if (e.target === addrModal) addrModal.classList.remove('open'); });

document.getElementById('addrForm')?.addEventListener('submit', async function (e) {
  e.preventDefault();
  const btn = this.querySelector('button[type=submit]');
  btn.disabled = true;

  const r = await UserAPI.addAddress({
    title: this.addrTitle?.value.trim() || 'Ev',
    full_name: state.user.name,
    phone: this.addrPhone?.value.trim() || '',
    city: this.city?.value.trim() || '',
    district: this.district?.value.trim() || '',
    address_line: this.addrText?.value.trim() || '',
    is_default: 0,
  });
  btn.disabled = false;

  if (r.ok) {
    const addrRes = await UserAPI.getAddresses();
    if (addrRes.ok) state.addresses = addrRes.data.data.addresses || [];
    addrModal?.classList.remove('open');
    this.reset();
    renderAddresses();
    showToast('Yeni adres eklendi!');
  } else { showToast(r.data.message || 'Adres eklenemedi.', true); }
});

// ── Avatar ──────────────────────────────────────
document.querySelectorAll('.avatar-edit').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const MAX_SIZE_MB = 5;
      if (!ALLOWED_TYPES.includes(file.type)) {
        showToast('Yalnızca JPEG, PNG, GIF veya WebP dosyası yükleyebilirsiniz.', true); return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        showToast(`Dosya boyutu en fazla ${MAX_SIZE_MB} MB olabilir.`, true); return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        document.querySelectorAll('.avatar').forEach(av => {
          av.innerHTML = `<img src="${ev.target.result}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        });
        if (state.user) state.user.avatar = ev.target.result;
      };
      reader.readAsDataURL(file);
      showToast('Profil fotoğrafı güncellendi!');
    };
    input.click();
  });
});

// ── Çıkış ───────────────────────────────────────
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
    AuthAPI.logout();
  }
});

// ── İlk Yükleme ─────────────────────────────────
(function() {
  const authEl = document.getElementById('authScreen');
  const accEl  = document.getElementById('accountScreen');
  // Başlangıçta her ikisini de gizle, sonra doğru olanı göster
  if (authEl) authEl.style.display = 'none';
  if (accEl)  accEl.style.display  = 'none';

  if (Auth.isLoggedIn()) {
    initAccount().catch(() => showAuth());
  } else {
    showAuth();
  }
})();
