/* ============================================================
   MODAICA — Frontend API İstemcisi (Tam Sürüm)
   Tüm sayfaların </body> etiketinden önce ekleyin:
   <script src="js/api-client.js"></script>
   ============================================================ */

// ── Ayarlar ───────────────────────────────────────────────────
const API_BASE = (function() {
  const host = window.location.hostname;
  const port = window.location.port ? ':' + window.location.port : '';
  return 'http://' + (host === 'localhost' || host === '127.0.0.1' ? host + port : 'localhost:8080') + '/modaica/backend';
})();

// ── Kimlik bilgileri ──────────────────────────────────────────
const Auth = {
  getToken:    ()  => localStorage.getItem('modaica_token'),
  setToken:    (t) => localStorage.setItem('modaica_token', t),
  getUser:     ()  => { try { return JSON.parse(localStorage.getItem('modaica_user') || 'null'); } catch { return null; } },
  setUser:     (u) => localStorage.setItem('modaica_user', JSON.stringify(u)),
  isLoggedIn:  ()  => !!Auth.getToken(),
  clear:       ()  => { localStorage.removeItem('modaica_token'); localStorage.removeItem('modaica_user'); },
  logout:      ()  => { Auth.clear(); window.location.href = 'hesabim.html'; },
};

// ── Temel fetch ───────────────────────────────────────────────
async function apiFetch(endpoint, opts = {}) {
  const token   = Auth.getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res  = await fetch(`${API_BASE}/${endpoint}`, { ...opts, headers });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error('API hatası:', err);
    return { ok: false, status: 0, data: { success: false, message: 'Sunucuya bağlanılamadı.' } };
  }
}

// ════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════
const AuthAPI = {
  async register(name, email, password) {
    const r = await apiFetch('api/auth/register', { method:'POST', body: JSON.stringify({ name, email, password }) });
    if (r.ok && r.data.data?.token) { Auth.setToken(r.data.data.token); Auth.setUser(r.data.data.user); }
    return r;
  },
  async login(email, password) {
    const r = await apiFetch('api/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
    if (r.ok && r.data.data?.token) { Auth.setToken(r.data.data.token); Auth.setUser(r.data.data.user); }
    return r;
  },
  async me()             { return apiFetch('api/auth/me'); },
  async changePassword(current_password, new_password) {
    return apiFetch('api/auth/change-password', { method:'PUT', body: JSON.stringify({ current_password, new_password }) });
  },
  logout: Auth.logout,
};

// ════════════════════════════════════════════════════════════
//  KULLANICI PROFİLİ
// ════════════════════════════════════════════════════════════
const UserAPI = {
  async getProfile()                { return apiFetch('api/users/profile'); },
  async updateProfile(data)         { return apiFetch('api/users/profile', { method:'PUT', body: JSON.stringify(data) }); },
  async getPoints(page = 1)         { return apiFetch(`api/users/points?page=${page}`); },
  async getNotifications()          { return apiFetch('api/users/notifications'); },
  async updateNotifications(prefs)  { return apiFetch('api/users/notifications', { method:'PUT', body: JSON.stringify(prefs) }); },
  async getSecurity()               { return apiFetch('api/users/security'); },
  async updateSecurity(settings)    { return apiFetch('api/users/security', { method:'PUT', body: JSON.stringify(settings) }); },

  // Adresler
  async getAddresses()              { return apiFetch('api/users/addresses'); },
  async addAddress(addr)            { return apiFetch('api/users/addresses', { method:'POST', body: JSON.stringify(addr) }); },
  async updateAddress(id, addr)     { return apiFetch(`api/users/addresses/${id}`, { method:'PUT', body: JSON.stringify(addr) }); },
  async deleteAddress(id)           { return apiFetch(`api/users/addresses/${id}`, { method:'DELETE' }); },
  async setDefaultAddress(id)       { return apiFetch(`api/users/addresses/${id}/default`, { method:'PATCH' }); },
};

// ════════════════════════════════════════════════════════════
//  ÜRÜNLER
// ════════════════════════════════════════════════════════════
const ProductAPI = {
  /**
   * Ürün listesi
   * @param {Object} filters - { department, category_slug, brand, min_price, max_price, sort, page, limit }
   */
  async list(filters = {}) {
    const q = new URLSearchParams(filters).toString();
    return apiFetch(`api/products?${q}`);
  },
  async get(sku)          { return apiFetch(`api/products/${sku}`); },
  async featured()        { return apiFetch('api/products/featured'); },
  async popular(dept='')  { return apiFetch(`api/products/popular${dept ? '?department='+dept : ''}`); },
  async newest(dept='')   { return apiFetch(`api/products/new${dept ? '?department='+dept : ''}`); },
  async onSale(dept='')   { return apiFetch(`api/products/sale${dept ? '?department='+dept : ''}`); },
};

// ════════════════════════════════════════════════════════════
//  KATEGORİLER
// ════════════════════════════════════════════════════════════
const CategoryAPI = {
  async all()                        { return apiFetch('api/categories'); },
  async byDepartment(dept)           { return apiFetch(`api/categories/${dept}`); },
  async products(slug, filters = {}) {
    const q = new URLSearchParams(filters).toString();
    return apiFetch(`api/categories/${slug}/products?${q}`);
  },
};

// ════════════════════════════════════════════════════════════
//  FAVORİLER
// ════════════════════════════════════════════════════════════
const FavAPI = {
  async list()                    { return apiFetch('api/favorites'); },
  async add(product)              { return apiFetch('api/favorites', { method:'POST', body: JSON.stringify(product) }); },
  async remove(productId)         { return apiFetch(`api/favorites/${productId}`, { method:'DELETE' }); },
  async clear()                   { return apiFetch('api/favorites/clear', { method:'DELETE' }); },
  async check(productId)          { return apiFetch(`api/favorites/check/${productId}`); },

  // localStorage ile senkronize et (badge güncellemek için)
  async sync() {
    if (!Auth.isLoggedIn()) return;
    try {
      const r = await FavAPI.list();
      if (r.ok) { localStorage.setItem('modaica_favorites', JSON.stringify(r.data.data.items || [])); updateBadges(); }
    } catch {}
  },

  // localStorage + sunucu birlikte ekleme (her kategori sayfasından çağrılır)
  async toggle(product) {
    if (!Auth.isLoggedIn()) { showToast('Favorilere eklemek için giriş yapın.', 'warn'); return false; }
    const r = await FavAPI.check(product.product_id);
    if (r.ok && r.data.data?.is_favorite) {
      await FavAPI.remove(product.product_id);
      _removeFromLocalFav(product.product_id);
      updateBadges();
      return false;
    } else {
      await FavAPI.add(product);
      _addToLocalFav(product);
      updateBadges();
      return true;
    }
  },
};

function _addToLocalFav(product) {
  const favs = JSON.parse(localStorage.getItem('modaica_favorites') || '[]');
  if (!favs.find(f => f.product_id === product.product_id)) {
    favs.push(product);
    localStorage.setItem('modaica_favorites', JSON.stringify(favs));
  }
}
function _removeFromLocalFav(productId) {
  const favs = JSON.parse(localStorage.getItem('modaica_favorites') || '[]').filter(f => f.product_id !== productId);
  localStorage.setItem('modaica_favorites', JSON.stringify(favs));
}

// ════════════════════════════════════════════════════════════
//  SEPET
// ════════════════════════════════════════════════════════════
const CartAPI = {
  async get()                          { return apiFetch('api/cart'); },
  async add(product)                   { return apiFetch('api/cart', { method:'POST', body: JSON.stringify(product) }); },
  async updateQty(productId, quantity) { return apiFetch(`api/cart/${productId}`, { method:'PUT', body: JSON.stringify({ quantity }) }); },
  async remove(productId)              { return apiFetch(`api/cart/${productId}`, { method:'DELETE' }); },
  async clear()                        { return apiFetch('api/cart/clear', { method:'DELETE' }); },
  async applyCoupon(code, subtotal)    { return apiFetch('api/cart/coupon', { method:'POST', body: JSON.stringify({ code, subtotal }) }); },
  async checkout(opts = {})            { return apiFetch('api/cart/checkout', { method:'POST', body: JSON.stringify(opts) }); },

  // localStorage ile senkronize et
  async sync() {
    if (!Auth.isLoggedIn()) return;
    try {
      const r = await CartAPI.get();
      if (r.ok) { localStorage.setItem('modaica_cart', JSON.stringify(r.data.data.items || [])); updateBadges(); }
    } catch {}
  },

  // Sepete ekle: sunucu + localStorage
  async addAndSync(product) {
    if (!Auth.isLoggedIn()) {
      // Giriş yapılmamışsa sadece localStorage
      const cart = JSON.parse(localStorage.getItem('modaica_cart') || '[]');
      const ex   = cart.find(c => c.product_id === product.product_id);
      if (ex) ex.quantity = (ex.quantity || 1) + (product.quantity || 1);
      else cart.push({ ...product, quantity: product.quantity || 1 });
      localStorage.setItem('modaica_cart', JSON.stringify(cart));
      updateBadges();
      return { ok: true, data: { message: 'Sepete eklendi (yerel).' } };
    }
    const r = await CartAPI.add(product);
    if (r.ok) await CartAPI.sync();
    return r;
  },
};

// ════════════════════════════════════════════════════════════
//  SİPARİŞLER
// ════════════════════════════════════════════════════════════
const OrderAPI = {
  async list(filters = {})    { return apiFetch('api/orders?' + new URLSearchParams(filters)); },
  async get(code)             { return apiFetch(`api/orders/${code}`); },
  async cancel(code)          { return apiFetch(`api/orders/${code}/cancel`, { method:'POST' }); },
};

// ════════════════════════════════════════════════════════════
//  YORUMLAR
// ════════════════════════════════════════════════════════════
const ReviewAPI = {
  async list(productId, opts = {}) { return apiFetch(`api/reviews/${productId}?` + new URLSearchParams(opts)); },
  async add(data)                  { return apiFetch('api/reviews', { method:'POST', body: JSON.stringify(data) }); },
  async update(id, data)           { return apiFetch(`api/reviews/${id}`, { method:'PUT', body: JSON.stringify(data) }); },
  async remove(id)                 { return apiFetch(`api/reviews/${id}`, { method:'DELETE' }); },
};

// ════════════════════════════════════════════════════════════
//  ARAMA
// ════════════════════════════════════════════════════════════
const SearchAPI = {
  async search(q)      { return apiFetch(`api/search?q=${encodeURIComponent(q)}`); },
  async history()      { return apiFetch('api/search/history'); },
  async popular()      { return apiFetch('api/search/popular'); },
};

// ════════════════════════════════════════════════════════════
//  KUPON
// ════════════════════════════════════════════════════════════
const CouponAPI = {
  async validate(code, subtotal) { return apiFetch('api/coupons/validate', { method:'POST', body: JSON.stringify({ code, subtotal }) }); },
};

// ════════════════════════════════════════════════════════════
//  YARDIMCILAR
// ════════════════════════════════════════════════════════════

// Badge güncelle
function updateBadges() {
  const cart  = JSON.parse(localStorage.getItem('modaica_cart')       || '[]');
  const favs  = JSON.parse(localStorage.getItem('modaica_favorites')  || '[]');
  const total = cart.reduce((s, c) => s + (c.quantity || 1), 0);

  document.querySelectorAll('#hdrCartBadge').forEach(el => {
    el.textContent = total; el.style.display = total > 0 ? 'flex' : 'none';
  });
  document.querySelectorAll('#hdrFavBadge, #favCountBadge').forEach(el => {
    el.textContent = favs.length; el.style.display = favs.length > 0 ? 'flex' : 'none';
  });
}

// Toast bildirimi
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  const icons = {
    success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>',
    error:   '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>',
    warn:    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>',
  };
  const colors = { success:'#22c55e', error:'#e63946', warn:'#f4a226' };
  const svg = t.querySelector('svg');
  if (svg) { svg.innerHTML = icons[type] || icons.success; svg.style.color = colors[type] || colors.success; }
  t.querySelector('span').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// Para formatı
function formatPrice(amount) {
  return '₺' + Number(amount).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Yıldız oluştur
function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
}

// ════════════════════════════════════════════════════════════
//  SAYFA BAŞLANGICI
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  updateBadges();

  // Giriş yapılmışsa sunucudan senkronize et
  if (Auth.isLoggedIn()) {
    FavAPI.sync();
    CartAPI.sync();
  }

  // Arama kutusuna live search bağla
  const searchInput = document.querySelector('.search-bar input');
  let searchTimer;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        const q = searchInput.value.trim();
        if (q.length >= 2) await SearchAPI.search(q);
      }, 400);
    });
    searchInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q.length >= 2) window.location.href = `arama.html?q=${encodeURIComponent(q)}`;
      }
    });
  }
});
