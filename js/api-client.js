/* ============================================================
   MODAICA — Frontend API İstemcisi  v2.0
   Tüm sayfaların </body> etiketinden önce ekleyin:
   <script src="js/api-client.js"></script>
   ============================================================ */

// ── Ayarlar ───────────────────────────────────────────────────
const API_BASE = (function () {
  const host = window.location.hostname;
  const port = window.location.port ? ':' + window.location.port : '';
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://' + host + port + '/modaica/backend';
  }
  return 'http://localhost:8080/modaica/backend';
})();

const VENDOR_API_BASE = API_BASE ? API_BASE + '/vendor-api' : '';
const ADMIN_API_BASE  = API_BASE ? API_BASE + '/admin-api'  : '';
const IMAGE_API_BASE  = 'http://localhost:5000/api';

// ── Request timeout (ms) ──────────────────────────────────────
const API_TIMEOUT = 10000;

// ── Kullanıcı kimlik bilgileri ────────────────────────────────
const Auth = {
  getToken:   ()  => localStorage.getItem('modaica_token'),
  setToken:   (t) => localStorage.setItem('modaica_token', t),
  getUser:    ()  => { try { return JSON.parse(localStorage.getItem('modaica_user') || 'null'); } catch { return null; } },
  setUser:    (u) => localStorage.setItem('modaica_user', JSON.stringify(u)),
  isLoggedIn: ()  => !!Auth.getToken(),
  clear:      ()  => {
    ['modaica_token','modaica_user'].forEach(k => localStorage.removeItem(k));
  },
  logout: () => {
    Auth.clear();
    window.location.href = 'anasayfa.html';
  },
};

// ── Satıcı kimlik bilgileri ───────────────────────────────────
const VendorAuth = {
  getToken:   ()  => localStorage.getItem('vendorToken'),
  setToken:   (t) => localStorage.setItem('vendorToken', t),
  getVendor:  ()  => { try { return JSON.parse(localStorage.getItem('vendorData') || 'null'); } catch { return null; } },
  setVendor:  (v) => localStorage.setItem('vendorData', JSON.stringify(v)),
  isLoggedIn: ()  => !!VendorAuth.getToken(),
  clear:      ()  => {
    ['vendorToken','vendorData'].forEach(k => localStorage.removeItem(k));
  },
  logout: () => {
    VendorAuth.clear();
    window.location.href = 'satici-giris.html';
  },
};

// ── Temel fetch (kullanıcı API) ───────────────────────────────
async function apiFetch(endpoint, opts = {}) {
  if (!API_BASE) {
    return { ok: false, status: 0, data: { success: false, message: 'API bağlantısı yok (XAMPP gerekli).' } };
  }
  const token   = Auth.getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const res  = await fetch(`${API_BASE}/${endpoint}`, { ...opts, headers, signal: controller.signal, credentials: 'include' });
    clearTimeout(timer);
    const data = await res.json();

    // Token süresi dolmuşsa temizle
    if (res.status === 401) {
      Auth.clear();
      if (window.location.pathname.includes('hesabim')) window.location.reload();
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    console.warn('API hatası:', isTimeout ? 'Zaman aşımı' : err.message);
    return {
      ok: false, status: 0,
      data: { success: false, message: isTimeout ? 'Sunucu yanıt vermiyor.' : 'Sunucuya bağlanılamadı.' }
    };
  }
}

// ── Vendor fetch ──────────────────────────────────────────────
async function vendorFetch(path, opts = {}) {
  if (!VENDOR_API_BASE) {
    return { ok: false, status: 0, data: { success: false, message: 'API bağlantısı yok.' } };
  }
  const token   = VendorAuth.getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const res  = await fetch(`${VENDOR_API_BASE}/${path}`, { ...opts, headers, signal: controller.signal, credentials: 'include' });
    clearTimeout(timer);
    const data = await res.json();
    if (res.status === 401) VendorAuth.logout();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, status: 0, data: { success: false, message: err.name === 'AbortError' ? 'Zaman aşımı.' : 'Bağlantı hatası.' } };
  }
}

// ════════════════════════════════════════════════════════════
//  AUTH API
// ════════════════════════════════════════════════════════════
const AuthAPI = {
  async register(name, email, password) {
    const r = await apiFetch('api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    if (r.ok && r.data.data?.token) { Auth.setToken(r.data.data.token); Auth.setUser(r.data.data.user); }
    return r;
  },
  async login(email, password) {
    const r = await apiFetch('api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (r.ok && r.data.data?.token) { Auth.setToken(r.data.data.token); Auth.setUser(r.data.data.user); }
    return r;
  },
  async me()                              { return apiFetch('api/auth/me'); },
  async changePassword(current_password, new_password) {
    return apiFetch('api/auth/change-password', { method: 'PUT', body: JSON.stringify({ current_password, new_password }) });
  },
  async logout() {
    await apiFetch('api/auth/logout', { method: 'POST' }).catch(() => {});
    Auth.logout();
  },
};

// ════════════════════════════════════════════════════════════
//  VENDOR AUTH API
// ════════════════════════════════════════════════════════════
const VendorAuthAPI = {
  async login(email, password) {
    const r = await vendorFetch('auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (r.ok && r.data.data?.token) {
      VendorAuth.setToken(r.data.data.token);
      VendorAuth.setVendor(r.data.data.vendor);
    }
    return r;
  },
  async register(data) {
    return vendorFetch('auth/register', { method: 'POST', body: JSON.stringify(data) });
  },
  logout: VendorAuth.logout,
};

// ════════════════════════════════════════════════════════════
//  KULLANICI PROFİLİ
// ════════════════════════════════════════════════════════════
const UserAPI = {
  async getProfile()                { return apiFetch('api/users/profile'); },
  async updateProfile(data)         { return apiFetch('api/users/profile', { method: 'PUT', body: JSON.stringify(data) }); },
  async getPoints(page = 1)         { return apiFetch(`api/users/points?page=${page}`); },
  async getNotifications()          { return apiFetch('api/users/notifications'); },
  async updateNotifications(prefs)  { return apiFetch('api/users/notifications', { method: 'PUT', body: JSON.stringify(prefs) }); },
  async getSecurity()               { return apiFetch('api/users/security'); },
  async updateSecurity(settings)    { return apiFetch('api/users/security', { method: 'PUT', body: JSON.stringify(settings) }); },
  async getAddresses()              { return apiFetch('api/users/addresses'); },
  async addAddress(addr)            { return apiFetch('api/users/addresses', { method: 'POST', body: JSON.stringify(addr) }); },
  async updateAddress(id, addr)     { return apiFetch(`api/users/addresses/${id}`, { method: 'PUT', body: JSON.stringify(addr) }); },
  async deleteAddress(id)           { return apiFetch(`api/users/addresses/${id}`, { method: 'DELETE' }); },
  async setDefaultAddress(id)       { return apiFetch(`api/users/addresses/${id}/default`, { method: 'PATCH' }); },
};

// ════════════════════════════════════════════════════════════
//  ÜRÜNLER
// ════════════════════════════════════════════════════════════
const ProductAPI = {
  async list(filters = {}) {
    const q = new URLSearchParams(filters).toString();
    return apiFetch(`api/products?${q}`);
  },
  async get(sku)                   { return apiFetch(`api/products/${sku}`); },
  async featured(limit = 8)        { return apiFetch(`api/products/featured?limit=${limit}`); },
  async popular(dept = '', limit = 8) { return apiFetch(`api/products/popular?limit=${limit}${dept ? '&department=' + dept : ''}`); },
  async newest(dept = '', limit = 8)  { return apiFetch(`api/products/new?limit=${limit}${dept ? '&department=' + dept : ''}`); },
  async onSale(dept = '', limit = 8)  { return apiFetch(`api/products/sale?limit=${limit}${dept ? '&department=' + dept : ''}`); },
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
  async list()           { return apiFetch('api/favorites'); },
  async add(product)     { return apiFetch('api/favorites', { method: 'POST', body: JSON.stringify(product) }); },
  async remove(productId){ return apiFetch(`api/favorites/${productId}`, { method: 'DELETE' }); },
  async clear()          { return apiFetch('api/favorites/clear', { method: 'DELETE' }); },
  async check(productId) { return apiFetch(`api/favorites/check/${productId}`); },

  async sync() {
    if (!Auth.isLoggedIn() || !API_BASE) return;
    try {
      const r = await FavAPI.list();
      if (r.ok) {
        localStorage.setItem('modaica_favorites', JSON.stringify(r.data.data?.items || []));
        updateBadges();
      }
    } catch {}
  },

  async toggle(product) {
    // localStorage fallback (her zaman çalışır)
    let favs; try { favs = JSON.parse(localStorage.getItem('modaica_favorites') || '[]'); } catch { favs = []; }
    const idx   = favs.findIndex(f => f.product_id === product.product_id);
    const inFav = idx !== -1;

    if (!Auth.isLoggedIn() || !API_BASE) {
      if (inFav) { favs.splice(idx, 1); } else { favs.push(product); }
      localStorage.setItem('modaica_favorites', JSON.stringify(favs));
      updateBadges();
      return !inFav;
    }

    if (inFav) {
      await FavAPI.remove(product.product_id);
      favs.splice(idx, 1);
    } else {
      await FavAPI.add(product);
      favs.push(product);
    }
    localStorage.setItem('modaica_favorites', JSON.stringify(favs));
    updateBadges();
    return !inFav;
  },
};

// ════════════════════════════════════════════════════════════
//  SEPET
// ════════════════════════════════════════════════════════════
const CartAPI = {
  async get()                          { return apiFetch('api/cart'); },
  async add(product)                   { return apiFetch('api/cart', { method: 'POST', body: JSON.stringify(product) }); },
  async updateQty(productId, quantity) { return apiFetch(`api/cart/${productId}`, { method: 'PUT', body: JSON.stringify({ quantity }) }); },
  async remove(productId)              { return apiFetch(`api/cart/${productId}`, { method: 'DELETE' }); },
  async clear()                        { return apiFetch('api/cart/clear', { method: 'DELETE' }); },
  async applyCoupon(code, subtotal)    { return apiFetch('api/cart/coupon', { method: 'POST', body: JSON.stringify({ code, subtotal }) }); },
  async checkout(opts = {})            { return apiFetch('api/cart/checkout', { method: 'POST', body: JSON.stringify(opts) }); },

  async sync() {
    if (!Auth.isLoggedIn() || !API_BASE) return;
    try {
      const r = await CartAPI.get();
      if (r.ok) {
        const serverItems = r.data.data?.items || [];
        let localItems = [];
        try { localItems = JSON.parse(localStorage.getItem('modaica_cart') || '[]'); } catch {}
        // Sunucu boş dönse ama localStorage'da ürün varsa, localStorage'ı koruyoruz
        if (serverItems.length > 0 || localItems.length === 0) {
          localStorage.setItem('modaica_cart', JSON.stringify(serverItems));
        }
        updateBadges();
      }
    } catch {}
  },

  async addAndSync(product) {
    // 1. Önce localStorage'a ekle — kullanıcı anında görür, hiçbir şey silemez
    let cart; try { cart = JSON.parse(localStorage.getItem('modaica_cart') || '[]'); } catch { cart = []; }
    const ex = cart.find(c => c.product_id === product.product_id);
    if (ex) ex.quantity = (ex.quantity || 1) + (product.quantity || 1);
    else cart.push({ ...product, quantity: product.quantity || 1 });
    localStorage.setItem('modaica_cart', JSON.stringify(cart));
    updateBadges();

    // 2. Giriş yapılmışsa sunucuya arka planda kaydet (fire & forget)
    // Geri dönüp localStorage'ı ASLA silmiyoruz
    if (Auth.isLoggedIn() && API_BASE) {
      CartAPI.add(product).catch(() => {});
    }

    return { ok: true, data: { message: 'Sepete eklendi.' } };
  },
};

// ════════════════════════════════════════════════════════════
//  SİPARİŞLER
// ════════════════════════════════════════════════════════════
const OrderAPI = {
  async list(filters = {}) { return apiFetch('api/orders?' + new URLSearchParams(filters)); },
  async get(code)           { return apiFetch(`api/orders/${code}`); },
  async track(code)         { return apiFetch(`api/orders/track?code=${encodeURIComponent(code)}`); },
  async cancel(code)        { return apiFetch(`api/orders/${code}/cancel`, { method: 'POST' }); },
};

// ════════════════════════════════════════════════════════════
//  YORUMLAR
// ════════════════════════════════════════════════════════════
const ReviewAPI = {
  async list(productId, opts = {}) {
    const q = new URLSearchParams({ product_id: productId, ...opts }).toString();
    return apiFetch(`api/reviews?${q}`);
  },
  async summary(productId)         { return apiFetch(`api/reviews/summary?product_id=${encodeURIComponent(productId)}`); },
  async add(data)                  { return apiFetch('api/reviews', { method: 'POST', body: JSON.stringify(data) }); },
  async update(id, data)           { return apiFetch(`api/reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  async remove(id)                 { return apiFetch(`api/reviews/${id}`, { method: 'DELETE' }); },
};

// ════════════════════════════════════════════════════════════
//  ARAMA
// ════════════════════════════════════════════════════════════
const SearchAPI = {
  async search(q)  { return apiFetch(`api/search?q=${encodeURIComponent(q)}`); },
  async history()  { return apiFetch('api/search/history'); },
  async popular()  { return apiFetch('api/search/popular'); },
};

// ════════════════════════════════════════════════════════════
//  KUPON
// ════════════════════════════════════════════════════════════
const CouponAPI = {
  async list()                   { return apiFetch('api/coupons'); },
  async validate(code, subtotal) { return apiFetch('api/coupons/validate', { method: 'POST', body: JSON.stringify({ code, subtotal }) }); },
};

// ════════════════════════════════════════════════════════════
//  IMAGE & AUTO-FETCH API
// ════════════════════════════════════════════════════════════
const ImageAPI = {
  async uploadImages(files) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`${IMAGE_API_BASE}/products/upload-images`, {
        method: 'POST', body: formData, signal: ctrl.signal,
      });
      clearTimeout(timer);
      return r.json();
    } catch (_) {
      return { success: false, message: 'Görsel yükleme servisi şu anda çalışmıyor. Demo ortamında bu özellik devre dışıdır.' };
    }
  },
  async createProduct(productData) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`${IMAGE_API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      return r.json();
    } catch (_) {
      return { success: false, message: 'Ürün oluşturma servisi şu anda çalışmıyor. Demo ortamında bu özellik devre dışıdır.' };
    }
  }
};

// ════════════════════════════════════════════════════════════
//  YARDIMCILAR
// ════════════════════════════════════════════════════════════

/** Badge'leri güncelle */
function updateBadges() {
  let cart; try { cart = JSON.parse(localStorage.getItem('modaica_cart') || '[]'); } catch { cart = []; }
  let favs; try { favs = JSON.parse(localStorage.getItem('modaica_favorites') || '[]'); } catch { favs = []; }
  const total = cart.reduce((s, c) => s + (c.quantity || 1), 0);

  document.querySelectorAll('#hdrCartBadge').forEach(el => {
    el.textContent = total;
    el.style.display = total > 0 ? 'flex' : 'none';
  });
  document.querySelectorAll('#hdrFavBadge, #favCountBadge').forEach(el => {
    el.textContent = favs.length;
    el.style.display = favs.length > 0 ? 'flex' : 'none';
  });
}

/** Toast bildirimi */
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  const icons = {
    success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>',
    error:   '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>',
    warn:    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>',
  };
  const colors = { success: '#22c55e', error: '#e63946', warn: '#f4a226' };
  const svg = t.querySelector('svg');
  if (svg) { svg.innerHTML = icons[type] || icons.success; svg.style.color = colors[type] || colors.success; }
  const span = t.querySelector('span');
  if (span) span.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._toastTimer);
  t._toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/** Para formatı */
function formatPrice(amount) {
  return '₺' + Number(amount).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Yıldız oluştur */
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
  updateHeaderUserState();

  // Giriş yapılmışsa favorileri senkronize et
  // Not: CartAPI.sync() burada kasıtlı olarak ÇAĞRILMIYOR
  // Çünkü sayfa yüklenirken kullanıcı sepete ürün ekleyebilir
  // ve bu sync o ürünü silebilir (race condition).
  // Sepet sync'i yalnızca sepet.html'de yapılır.
  if (Auth.isLoggedIn() && API_BASE) {
    FavAPI.sync();
  }

  // Arama kutusuna live search + enter bağla
  const searchInput = document.querySelector('.search-bar input');
  if (searchInput) {
    let searchTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        const q = searchInput.value.trim();
        if (q.length >= 2 && API_BASE) await SearchAPI.search(q);
      }, 400);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q.length >= 1) window.location.href = `arama.html?q=${encodeURIComponent(q)}`;
      }
    });
  }
});

// ── Header kullanıcı durumu ───────────────────────────────────
function updateHeaderUserState() {
  const user = Auth.getUser();
  const accountLink = document.querySelector('a[href="hesabim.html"].icon-btn');
  if (!accountLink) return;

  if (user && Auth.isLoggedIn()) {
    const firstName = (user.name || '').split(' ')[0] || 'Hesabım';

    // Zaten eklenmiş mi?
    if (accountLink.querySelector('.hdr-logout-btn')) return;

    // Span metnini güncelle
    const span = accountLink.querySelector('span');
    if (span) span.textContent = firstName;

    // Çıkış butonu ekle
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'hdr-logout-btn';
    logoutBtn.title = 'Çıkış Yap';
    logoutBtn.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>';
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
        await AuthAPI.logout();
      }
    });

    accountLink.style.position = 'relative';
    accountLink.parentElement.style.position = 'relative';
    accountLink.insertAdjacentElement('afterend', logoutBtn);

    // Stil (inline — harici CSS'e bağımlılık yok)
    if (!document.getElementById('hdr-logout-style')) {
      const style = document.createElement('style');
      style.id = 'hdr-logout-style';
      style.textContent = `
        .hdr-logout-btn {
          display: flex; align-items: center; justify-content: center;
          background: #e63946; color: #fff; border: none; cursor: pointer;
          border-radius: 50%; width: 18px; height: 18px;
          position: absolute; top: -4px; right: -6px;
          opacity: 0; transition: opacity .2s;
          z-index: 10;
        }
        .icon-btn:hover .hdr-logout-btn,
        .hdr-logout-btn:hover { opacity: 1; }
      `;
      document.head.appendChild(style);
    }
  } else {
    // Çıkış yapılmış — span'ı sıfırla
    const span = accountLink.querySelector('span');
    if (span) span.textContent = 'Hesabım';
    const btn = accountLink.parentElement?.querySelector('.hdr-logout-btn');
    if (btn) btn.remove();
  }
}

// ── Kategori sayfaları için global alias'lar ──────────────────
// Kategori JS dosyaları (erkek.js vb.) bu alias'ları kullanarak
// api-client.js'e yönlendirilir.
window.updateBadges_global = function () { updateBadges(); };
window._apiShowToast       = function (msg, type) { showToast(msg, type); };

