/* MODAICA — Panel API İstemcisi (Admin + Satıcı)  v2.0 */

// Dinamik base URL
const PANEL_API = (function () {
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') {
    return 'http://' + h + '/modaica/backend';
  }
  return ''; // Dosya protokolü → mock mode
})();

const PanelAuth = {
  getToken: () => localStorage.getItem('panel_token'),
  getActor: () => { try { return JSON.parse(localStorage.getItem('panel_actor') || 'null'); } catch { return null; } },
  getRole: () => localStorage.getItem('panel_role'),
  isLoggedIn: () => !!localStorage.getItem('panel_token'),
  set: (token, role, actor) => {
    localStorage.setItem('panel_token', token);
    localStorage.setItem('panel_role', role);
    localStorage.setItem('panel_actor', JSON.stringify(actor));
  },
  clear: () => {
    ['panel_token', 'panel_role', 'panel_actor'].forEach(k => localStorage.removeItem(k));
  },
  logout: () => {
    const r = PanelAuth.getRole?.() || '';
    PanelAuth.clear();
    window.location.href = r === 'vendor' ? 'satici-giris.html' : 'admin.html';
  },
};

async function panelFetch(path, opts = {}) {
  if (!PANEL_API) {
    return { ok: false, status: 0, data: { success: false, message: 'API yok (XAMPP gerekli).' } };
  }
  const token = PanelAuth.getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const role = PanelAuth.getRole() || 'admin';
    const prefix = role === 'vendor' ? 'vendor-api' : 'admin-api';
    const url = `${PANEL_API}/${prefix}/${path}`;
    const res = await fetch(url, { ...opts, headers, signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();

    if (res.status === 401) {
      PanelAuth.logout();
      return { ok: false, status: 401, data: { success: false, message: 'Oturum süresi doldu.' } };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false, status: 0,
      data: { success: false, message: err.name === 'AbortError' ? 'Sunucu yanıt vermiyor.' : 'Bağlantı hatası.' }
    };
  }
}

// ── Auth ──────────────────────────────────────────────────────
const PanelAuthAPI = {
  async login(email, password, role = 'auto') {
    const r = await panelFetch('auth/login', { method: 'POST', body: JSON.stringify({ email, password, role }) });
    if (r.ok) PanelAuth.set(r.data.data.token, r.data.data.panel_role, r.data.data.actor);
    return r;
  },
  async me() { return panelFetch('auth/me'); },
  async registerVendor(data) { return panelFetch('auth/register', { method: 'POST', body: JSON.stringify(data) }); },
};

// ── Admin API ─────────────────────────────────────────────────
const AdminAPI = {
  dashboard: () => panelFetch('admin/dashboard'),
  stats: (days = 30) => panelFetch(`admin/stats?days=${days}`),
  activity: (page = 1) => panelFetch(`admin/activity?page=${page}`),
  notifications: () => panelFetch('admin/notifications'),
  markNotifsRead: () => panelFetch('admin/notifications/read', { method: 'PATCH' }),

  // Ürünler
  products: (params = {}) => panelFetch('admin/products?' + new URLSearchParams(params)),
  getProduct: (id) => panelFetch(`admin/products/${id}`),
  addProduct: (data) => panelFetch('admin/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => panelFetch(`admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleProduct: (id) => panelFetch(`admin/products/${id}/toggle`, { method: 'PATCH' }),
  deleteProduct: (id) => panelFetch(`admin/products/${id}`, { method: 'DELETE' }),

  // Siparişler
  orders: (params = {}) => panelFetch('admin/orders?' + new URLSearchParams(params)),
  getOrder: (code) => panelFetch(`admin/orders/${code}`),
  updateOrderStatus: (code, status) => panelFetch(`admin/orders/${code}`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Kullanıcılar
  users: (params = {}) => panelFetch('admin/users?' + new URLSearchParams(params)),
  getUser: (id) => panelFetch(`admin/users/${id}`),
  toggleUser: (id) => panelFetch(`admin/users/${id}/toggle`, { method: 'PATCH' }),

  // Satıcılar
  vendors: (params = {}) => panelFetch('admin/vendors?' + new URLSearchParams(params)),
  getVendor: (id) => panelFetch(`admin/vendors/${id}`),
  approveVendor: (id) => panelFetch(`admin/vendors/${id}/approve`, { method: 'PATCH' }),
  suspendVendor: (id, reason) => panelFetch(`admin/vendors/${id}/suspend`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  setCommission: (id, commission) => panelFetch(`admin/vendors/${id}/commission`, { method: 'PATCH', body: JSON.stringify({ commission }) }),
  payout: (id, amount, note) => panelFetch(`admin/vendors/${id}/payout`, { method: 'POST', body: JSON.stringify({ amount, note }) }),

  // Kuponlar
  coupons: () => panelFetch('admin/coupons'),
  addCoupon: (data) => panelFetch('admin/coupons', { method: 'POST', body: JSON.stringify(data) }),
  updateCoupon: (id, data) => panelFetch(`admin/coupons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCoupon: (id) => panelFetch(`admin/coupons/${id}`, { method: 'DELETE' }),

  // Yorumlar
  reviews: (params = {}) => panelFetch('admin/reviews?' + new URLSearchParams(params)),
  approveReview: (id, val) => panelFetch(`admin/reviews/${id}/approve`, { method: 'PATCH', body: JSON.stringify({ is_approved: val }) }),
  deleteReview: (id) => panelFetch(`admin/reviews/${id}`, { method: 'DELETE' }),
};

// ── Vendor API ────────────────────────────────────────────────
const VendorAPI = {
  dashboard: () => panelFetch('vendor/dashboard'),
  stats: (days = 30) => panelFetch(`vendor/stats?days=${days}`),
  notifications: () => panelFetch('vendor/notifications'),
  markNotifsRead: () => panelFetch('vendor/notifications/read', { method: 'PATCH' }),

  products: (params = {}) => panelFetch('vendor/products?' + new URLSearchParams(params)),
  getProduct: (id) => panelFetch(`vendor/products/${id}`),
  addProduct: (data) => panelFetch('vendor/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => panelFetch(`vendor/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleProduct: (id) => panelFetch(`vendor/products/${id}/toggle`, { method: 'PATCH' }),
  deleteProduct: (id) => panelFetch(`vendor/products/${id}`, { method: 'DELETE' }),

  orders: (params = {}) => panelFetch('vendor/orders?' + new URLSearchParams(params)),
  shipItem: (itemId) => panelFetch(`vendor/orders/${itemId}/ship`, { method: 'PATCH' }),

  getProfile: () => panelFetch('vendor/profile'),
  updateProfile: (data) => panelFetch('vendor/profile', { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (cur, nw) => panelFetch('vendor/password', { method: 'PUT', body: JSON.stringify({ current_password: cur, new_password: nw }) }),

  balance: () => panelFetch('vendor/balance'),
  reviews: (page = 1) => panelFetch(`vendor/reviews?page=${page}`),
};

// ── Paylaşılan Yardımcılar ────────────────────────────────────
function fmt(n) { return '₺' + Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtNum(n) { return Number(n).toLocaleString('tr-TR'); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString('tr-TR') : '—'; }

const STATUS_LABELS = {
  pending: { label: 'Bekliyor', cls: 'st-pending' },
  preparing: { label: 'Hazırlanıyor', cls: 'st-preparing' },
  shipping: { label: 'Kargoda', cls: 'st-shipping' },
  delivered: { label: 'Teslim Edildi', cls: 'st-delivered' },
  cancelled: { label: 'İptal Edildi', cls: 'st-cancelled' },
  approved: { label: 'Onaylı', cls: 'st-delivered' },
  suspended: { label: 'Askıda', cls: 'st-cancelled' },
  'pending-vendor': { label: 'Bekliyor', cls: 'st-pending' },
};

function statusBadge(status) {
  const s = STATUS_LABELS[status] || { label: status, cls: 'st-pending' };
  return `<span class="status-pill ${s.cls}">${s.label}</span>`;
}

function showToastPanel(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  const colors = { success: '#22c55e', error: '#e63946', info: '#2d3aaa', warn: '#f4a226' };
  t.textContent = msg;
  t.style.background = colors[type] || colors.success;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function openModal(title, bodyHTML, wide = false) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalBox').classList.toggle('modal-wide', wide);
  document.getElementById('modal').style.display = 'flex';
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal') || !e.target) {
    document.getElementById('modal').style.display = 'none';
  }
}

// Sayfalama HTML
function paginationHTML(page, totalPages, onPageFn) {
  if (totalPages <= 1) return '';
  let html = '<div class="pagination">';
  html += `<button ${page <= 1 ? 'disabled' : ''} onclick="${onPageFn}(${page - 1})">‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && i > 3 && i < totalPages - 1 && Math.abs(i - page) > 1) { if (i === 4) html += '<span>…</span>'; continue; }
    html += `<button class="${i === page ? 'active' : ''}" onclick="${onPageFn}(${i})">${i}</button>`;
  }
  html += `<button ${page >= totalPages ? 'disabled' : ''} onclick="${onPageFn}(${page + 1})">›</button>`;
  return html + '</div>';
}
