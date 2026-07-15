/* ============================================================
   MODAICA Satıcı Panel JS  v2.0
   Demo mode: XAMPP yoksa mock verilerle çalışır.
   ============================================================ */

// ── Config ───────────────────────────────────────────────────
const IS_DEMO = !window.VENDOR_API_BASE && !window.API_BASE;
const VAPI    = (window.VENDOR_API_BASE || (function() {
  const host = window.location.hostname;
  const port = window.location.port ? ':' + window.location.port : '';
  return (host === 'localhost' || host === '127.0.0.1')
    ? 'http://' + host + port + '/modaica/backend/vendor-api'
    : '';
})());

let TOKEN  = localStorage.getItem('vendorToken');
let VENDOR = (() => { try { return JSON.parse(localStorage.getItem('vendorData') || '{}'); } catch { return {}; } })();
let chartInst = { sales: null, earnings: null };

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

// ── Auth guard ────────────────────────────────────────────────
if (!TOKEN) { window.location.href = 'satici-giris.html'; }

// ── API helper ────────────────────────────────────────────────
async function api(path, method = 'GET', data = null) {
  // Demo token kontrolü
  if (TOKEN && TOKEN.startsWith('demo_vendor_token_')) {
    return _mockApi(path, method, data);
  }

  if (!VAPI) return _mockApi(path, method, data);

  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN }
  };
  if (data) opts.body = JSON.stringify(data);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(`${VAPI}${path}`, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    const j = await r.json();
    if (r.status === 401) { doLogout(); return null; }
    return j;
  } catch {
    clearTimeout(timer);
    return _mockApi(path, method, data);
  }
}

// ── Mock API (XAMPP yoksa demo veriler döner) ─────────────────
function _mockApi(path, method, data) {
  // Dashboard
  if (path === '/dashboard') return Promise.resolve({ success: true, data: _mockDashboard() });
  if (path.includes('/products') && method === 'GET') return Promise.resolve({ success: true, data: _mockProducts() });
  if (path.includes('/orders') && method === 'GET') return Promise.resolve({ success: true, data: _mockOrders() });
  if (path.includes('/earnings')) return Promise.resolve({ success: true, data: _mockEarnings() });
  if (path.includes('/payouts') && method === 'GET') return Promise.resolve({ success: true, data: _mockPayouts() });
  if (path.includes('/reviews')) return Promise.resolve({ success: true, data: _mockReviews() });
  if (path === '/profile') return Promise.resolve({ success: true, data: _mockProfile() });
  if (path.includes('/ai/') || path.includes('/ai-chat')) return Promise.resolve({ success: true, data: _mockAI(path) });
  // Yazma işlemleri — başarı dön
  return Promise.resolve({ success: true, data: {}, message: 'Güncellendi (demo mod).' });
}

// ── Mock veri fonksiyonları ───────────────────────────────────
function _mockDashboard() {
  const days = Array.from({length: 30}, (_, i) => ({
    day: new Date(Date.now() - (29-i)*86400000).toISOString().slice(0,10),
    gross: Math.floor(Math.random()*2500+500),
    net:   Math.floor(Math.random()*2000+400),
  }));
  return {
    stats: { month_revenue:45280.5, balance:12340, total_earned:98750, month_sales:127, total_sales:843, total_products:34, low_stock:3 },
    sales30: days,
    topProducts: [
      {product_name:'Nike Ultra Boost Pro', sold:48, revenue:167952},
      {product_name:'Slim Fit Keten Gömlek', sold:35, revenue:20965},
      {product_name:'Deri Omuz Çantası', sold:22, revenue:28578},
      {product_name:'Hyalüronik Asit Serumu', sold:19, revenue:10431},
      {product_name:'Apple Watch Series 9', sold:12, revenue:167988},
    ],
    lastSales: [
      {product_name:'Nike Ultra Boost Pro', order_code:'MDC-24042024-001', status:'delivered', gross_amount:3499},
      {product_name:'Deri Omuz Çantası',    order_code:'MDC-24042024-002', status:'shipping',  gross_amount:1299},
      {product_name:'Slim Fit Gömlek',       order_code:'MDC-23042024-008', status:'pending',   gross_amount:599},
    ],
  };
}

function _mockProducts() {
  return { items: [
    {id:1,name:'Nike Ultra Boost Pro',brand:'Nike',emoji:'👟',price:3499,old_price:4499,stock:12,department:'spor',category_slug:'ayakkabi',badge:'sale',is_active:1,sku:'NK-UBP-001'},
    {id:2,name:'Slim Fit Keten Gömlek',brand:'ModaICA',emoji:'👔',price:599,old_price:null,stock:45,department:'erkek',category_slug:'gomlek',badge:'new',is_active:1,sku:'MI-SFG-002'},
    {id:3,name:'Deri Omuz Çantası',brand:'LeatherCo',emoji:'👜',price:1299,old_price:1799,stock:8,department:'kadin',category_slug:'canta',badge:'sale',is_active:1,sku:'LC-DOC-003'},
    {id:4,name:'Hyalüronik Asit Serumu',brand:'GlowLab',emoji:'💧',price:549,old_price:699,stock:2,department:'kozmetik',category_slug:'yuz-bakim',badge:'hot',is_active:1,sku:'GL-HAS-004'},
    {id:5,name:'Apple Watch Series 9',brand:'Apple',emoji:'⌚',price:13999,old_price:15999,stock:6,department:'elektronik',category_slug:'giyilebilir',badge:'best',is_active:0,sku:'AP-AW9-005'},
  ], total:5, total_pages:1, page:1 };
}

function _mockOrders() {
  return { items: [
    {id:1,order_code:'MDC-20260424-001',product_name:'Nike Ultra Boost Pro',quantity:1,gross_amount:3499,commission:349.9,net_amount:3149.1,status:'delivered',created_at:new Date(Date.now()-86400000).toISOString()},
    {id:2,order_code:'MDC-20260424-002',product_name:'Deri Omuz Çantası',quantity:2,gross_amount:2598,commission:259.8,net_amount:2338.2,status:'shipping',created_at:new Date(Date.now()-7200000).toISOString()},
    {id:3,order_code:'MDC-20260423-008',product_name:'Slim Fit Gömlek',quantity:1,gross_amount:599,commission:59.9,net_amount:539.1,status:'pending',created_at:new Date(Date.now()-10800000).toISOString()},
  ], total:3, total_pages:1, page:1 };
}

function _mockEarnings() {
  const chart = Array.from({length:30},(_,i)=>({
    day:new Date(Date.now()-(29-i)*86400000).toISOString().slice(0,10),
    gross:Math.floor(Math.random()*2500+500),
    net:Math.floor(Math.random()*2000+400),
  }));
  return {
    summary:{period_gross:45280.5,period_commission:4528.05,period_net:40752.45,total_earned:98750,balance:12340,commission_rate:10},
    chart,
    payouts:[
      {amount:5000,requested_at:new Date(Date.now()-864000000).toISOString().slice(0,10),status:'paid'},
      {amount:2500,requested_at:new Date(Date.now()-172800000).toISOString().slice(0,10),status:'pending'},
    ],
  };
}

function _mockPayouts() {
  return { items:[
    {amount:5000,method:'banka_transferi',status:'paid',requested_at:new Date(Date.now()-864000000).toISOString().slice(0,10),paid_at:new Date(Date.now()-691200000).toISOString().slice(0,10)},
    {amount:2500,method:'banka_transferi',status:'pending',requested_at:new Date(Date.now()-172800000).toISOString().slice(0,10),paid_at:null},
  ], total:2, total_pages:1, page:1 };
}

function _mockReviews() {
  return { items:[
    {user_name:'Ali Yılmaz',product_name:'Nike Ultra Boost Pro',rating:5,body:'Harika ürün, çok memnun kaldım!',created_at:new Date(Date.now()-86400000).toISOString()},
    {user_name:'Ayşe Kaya',product_name:'Slim Fit Gömlek',rating:4,body:'Kalitesi güzel ama beden biraz büyük.',created_at:new Date(Date.now()-172800000).toISOString()},
  ], total:2, total_pages:1, page:1 };
}

function _mockProfile() {
  return {id:1,name:'Demo Satıcı',shop_name:'Demo Mağaza',email:'demo@modaica.com',phone:'+90 555 000 0000',tax_number:'1234567890',logo_emoji:'🏪',description:'Demo satıcı hesabı.',commission_rate:10,balance:12340,total_earned:98750,bank_name:'',bank_iban:''};
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const shopName = VENDOR.shop_name || 'Satıcı Paneli';
  const nameEl   = document.getElementById('shopNameHeader');
  const sbShop   = document.getElementById('sbShopName');
  const sbEmoji  = document.getElementById('sbEmoji');
  const sbRate   = document.getElementById('sbRate');
  if (nameEl)  nameEl.textContent  = shopName;
  if (sbShop)  sbShop.textContent  = VENDOR.shop_name || 'Mağaza';
  if (sbEmoji) sbEmoji.textContent = VENDOR.logo_emoji || '🏪';
  if (sbRate)  sbRate.textContent  = '%' + (VENDOR.commission_rate || 10) + ' komisyon';

  // Demo modu bildirimi
  if (TOKEN?.startsWith('demo_vendor_token_') || !VAPI) {
    const demoBar = document.getElementById('demoBar');
    if (demoBar) demoBar.style.display = 'block';
  }

  // Saat
  setInterval(() => {
    const el = document.getElementById('panelClock');
    if (el) el.textContent = new Date().toLocaleTimeString('tr-TR');
  }, 1000);

  loadDashboard();
});

// ── Çıkış ────────────────────────────────────────────────────
function doLogout() {
  localStorage.removeItem('vendorToken');
  localStorage.removeItem('vendorData');
  window.location.href = 'satici-giris.html';
}

// ── Sayfa nav ─────────────────────────────────────────────────
function goPage(el) {
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  const p = el.dataset.p;
  const pg = document.getElementById(`p-${p}`);
  if (pg) pg.classList.add('active');
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = el.textContent.trim();
  document.getElementById('sidebar')?.classList.remove('open');
  const loaders = { products: loadProducts, orders: loadOrders, earnings: loadEarnings, payouts: loadPayouts, reviews: loadReviews, profile: loadProfile };
  if (loaders[p]) loaders[p]();
}

// ── Dashboard ────────────────────────────────────────────────
async function loadDashboard() {
  const r = await api('/dashboard');
  if (!r?.success) return;
  const { stats, sales30, lastSales, topProducts } = r.data;

  const welcomeEl = document.getElementById('welcomeMsg');
  if (welcomeEl) welcomeEl.textContent = `Hoş Geldiniz, ${VENDOR.shop_name || 'Mağaza'}! 🏪`;

  if (stats.low_stock > 0) {
    const nb = document.getElementById('nb-low');
    if (nb) { nb.textContent = stats.low_stock; nb.style.display = 'flex'; }
  }

  const cards = [
    { l: 'Bu Ay Gelir',   v: '₺' + fmt(stats.month_revenue),                                                     sub: 'Brüt satış',                       c: 'c1', i: '📈' },
    { l: 'Bu Ay Net',     v: '₺' + fmt(stats.month_revenue * (1 - (VENDOR.commission_rate || 10) / 100)),         sub: `%${VENDOR.commission_rate||10} komisyon sonrası`, c: 'c2', i: '💰' },
    { l: 'Bakiye',        v: '₺' + fmt(stats.balance),                                                            sub: 'Çekilebilir',                       c: 'c3', i: '💳' },
    { l: 'Bu Ay Sipariş', v: stats.month_sales,                                                                    sub: `Toplam: ${stats.total_sales}`,       c: 'c1', i: '🛒' },
    { l: 'Aktif Ürün',    v: stats.total_products,                                                                 sub: `Düşük stok: ${stats.low_stock}`,    c: 'c2', i: '📦' },
  ];
  const statsEl = document.getElementById('dashStats');
  if (statsEl) statsEl.innerHTML = cards.map(c => `
    <div class="stat-card ${c.c}">
      <div class="sc-icon">${c.i}</div>
      <div class="sc-label">${c.l}</div>
      <div class="sc-val">${c.v}</div>
      <div class="sc-sub">${c.sub}</div>
    </div>`).join('');

  // Chart
  const chartEl = document.getElementById('salesChart');
  if (chartEl && typeof Chart !== 'undefined') {
    if (chartInst.sales) chartInst.sales.destroy();
    chartInst.sales = new Chart(chartEl.getContext('2d'), {
      type: 'bar',
      data: {
        labels: (sales30 || []).map(d => d.day.slice(5)),
        datasets: [{ label: 'Brüt (₺)', data: (sales30 || []).map(d => parseFloat(d.gross || 0)), backgroundColor: 'rgba(34,197,94,.7)', borderRadius: 4 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => '₺' + v.toLocaleString('tr-TR') } } } }
    });
  }

  // Top ürünler
  const topEl = document.getElementById('topProducts');
  if (topEl) topEl.innerHTML = (topProducts || []).map((p, i) => `
    <div class="ll-row">
      <span style="font-size:16px">${['🥇','🥈','🥉','4️⃣','5️⃣'][i] || '•'}</span>
      <div class="ll-main">${escHtml(p.product_name)}<div class="ll-sub">${p.sold|0} adet</div></div>
      <strong>₺${fmt(p.revenue)}</strong>
    </div>`).join('') || '<p style="color:var(--muted);text-align:center;padding:16px">Satış verisi yok</p>';

  // Son satışlar
  const smap = { pending: '⏳', confirmed: '✅', shipped: '🚚', delivered: '📬', refunded: '↩️' };
  const lastEl = document.getElementById('latestSales');
  if (lastEl) lastEl.innerHTML = (lastSales || []).map(s => `
    <div class="ll-row">
      <div class="ll-main">${escHtml(s.product_name)}<div class="ll-sub">${escHtml(s.order_code || '')}</div></div>
      <span class="badge b-${escHtml(s.status)}">${smap[s.status] || ''} ${escHtml(s.status)}</span>
      <strong>₺${fmt(s.gross_amount)}</strong>
    </div>`).join('') || '<p style="color:var(--muted);text-align:center;padding:16px">Satış yok</p>';
}

// ── Products ─────────────────────────────────────────────────
async function loadProducts(pg = 1) {
  const q      = val('pSearch');
  const active = val('pActive');
  const r = await api(`/products?q=${encodeURIComponent(q)}&active=${active}&page=${pg}`);
  if (!r?.success) return;
  const { items, total_pages } = r.data;
  const tbody = document.getElementById('pBody');
  if (!tbody) return;
  tbody.innerHTML = (items || []).map(p => `
    <tr>
      <td><span style="font-size:18px;margin-right:6px">${escHtml(p.emoji || '📦')}</span><strong>${escHtml(p.name)}</strong><div class="cell-sub">${escHtml(p.brand || '')}</div></td>
      <td><code style="font-size:11px">${escHtml(p.sku)}</code></td>
      <td><strong>₺${fmt(p.price)}</strong></td>
      <td><span style="color:${p.stock<10?'#e63946':p.stock<30?'#f97316':'#22c55e'}">${p.stock|0}</span></td>
      <td><span class="badge ${p.is_active ? 'b-active' : 'b-cancelled'}">${p.is_active ? 'Aktif' : 'Pasif'}</span></td>
      <td>
        <button class="btn-icon" onclick='openProductModal(${JSON.stringify(p).replace(/'/g,"&#39;")})'>✏️</button>
        <button class="btn-icon danger" onclick="toggleProduct(${p.id|0},${p.is_active|0})">${p.is_active ? '🗑️' : '♻️'}</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--muted);">Ürün yok</td></tr>';
  renderPager('pPager', pg, total_pages, loadProducts);
}

function openProductModal(p) {
  const isEdit = !!p;
  openModal(isEdit ? '✏️ Ürün Düzenle' : '📦 Yeni Ürün', `
    <div class="mrow">
      <div class="mfield span2"><label>Ürün Adı *</label><input id="vp-name" value="${escHtml(p?.name || '')}"></div>
      <div class="mfield"><label>Marka *</label><input id="vp-brand" value="${escHtml(p?.brand || '')}"></div>
      <div class="mfield"><label>Emoji</label><input id="vp-emoji" value="${escHtml(p?.emoji || '🛍️')}" style="width:70px"></div>
      <div class="mfield"><label>Fiyat (₺) *</label><input type="number" id="vp-price" value="${p?.price || ''}"></div>
      <div class="mfield"><label>Eski Fiyat</label><input type="number" id="vp-old" value="${p?.old_price || ''}"></div>
      <div class="mfield"><label>Stok</label><input type="number" id="vp-stock" value="${p?.stock ?? 10}"></div>
      <div class="mfield"><label>Departman *</label>
        <select id="vp-dept">${['erkek','kadin','elektronik','ev','spor','kozmetik'].map(d=>`<option value="${d}" ${p?.department===d?'selected':''}>${d}</option>`).join('')}</select>
      </div>
      <div class="mfield span2"><label>Kategori Slug *</label><input id="vp-cat" value="${escHtml(p?.category_slug || '')}"></div>
      <div class="mfield span2"><label>Açıklama</label><textarea id="vp-desc" rows="3">${escHtml(p?.description || '')}</textarea></div>
      <div class="mfield"><label>Badge</label>
        <select id="vp-badge"><option value="" ${!p?.badge?'selected':''}>Yok</option><option value="new" ${p?.badge==='new'?'selected':''}>Yeni</option><option value="sale" ${p?.badge==='sale'?'selected':''}>İndirim</option><option value="hot" ${p?.badge==='hot'?'selected':''}>Hot</option><option value="best" ${p?.badge==='best'?'selected':''}>Best</option></select>
      </div>
      <div class="mfield"><label>Durum</label>
        <select id="vp-active"><option value="1" ${p?.is_active!==0?'selected':''}>Aktif</option><option value="0" ${p?.is_active===0?'selected':''}>Pasif</option></select>
      </div>
      ${isEdit ? '<div class="mfield span2" id="img-manager-container" style="margin-top:20px"></div>' : ''}
    </div>`,
    [
      { label: 'İptal', cls: 'btn-cancel', fn: closeModal },
      { label: isEdit ? 'Güncelle' : 'Oluştur', cls: 'btn-save', fn: () => saveProduct(isEdit ? p.id : null) }
    ]
  );
  if (isEdit) {
    setTimeout(() => {
      if (typeof ProductImageManager !== 'undefined') {
        new ProductImageManager('img-manager-container', p.sku);
      }
    }, 200);
  }
}

async function saveProduct(id) {
  const data = {
    name: val('vp-name'), brand: val('vp-brand'), emoji: val('vp-emoji'),
    price: parseFloat(val('vp-price')), old_price: parseFloat(val('vp-old')) || null,
    stock: parseInt(val('vp-stock')), department: val('vp-dept'),
    category_slug: val('vp-cat'), description: val('vp-desc'),
    badge: val('vp-badge') || null, is_active: parseInt(val('vp-active'))
  };
  if (!data.name || !data.brand || !data.price) { toast('Zorunlu alanlar eksik.', 'error'); return; }
  const r = id ? await api(`/products/${id}`, 'PUT', data) : await api('/products', 'POST', data);
  if (!r?.success) { toast(r?.message || 'Hata.', 'error'); return; }
  toast(id ? 'Ürün güncellendi.' : 'Ürün oluşturuldu.');
  closeModal(); loadProducts();
}

async function toggleProduct(id, active) {
  const r = await api(`/products/${id}`, 'PUT', { is_active: active ? 0 : 1 });
  if (r?.success) { toast('Güncellendi.'); loadProducts(); } else toast(r?.message || 'Hata.', 'error');
}

// ── Orders ───────────────────────────────────────────────────
async function loadOrders(pg = 1) {
  const status = val('oStatus');
  const r = await api(`/orders?status=${status}&page=${pg}`);
  if (!r?.success) return;
  const { items, total_pages } = r.data;
  const smap = { pending: '⏳ Bekliyor', confirmed: '✅ Onay', shipped: '🚚 Kargoda', delivered: '📬 Teslim', refunded: '↩️ İade' };
  const tbody = document.getElementById('oBody');
  if (!tbody) return;
  tbody.innerHTML = (items || []).map(s => `
    <tr>
      <td><strong>${escHtml(s.order_code || '-')}</strong></td>
      <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(s.product_name)}</td>
      <td>${s.quantity|0}</td>
      <td>₺${fmt(s.gross_amount)}</td>
      <td style="color:var(--accent2)">₺${fmt(s.commission)}</td>
      <td><strong style="color:var(--vendor)">₺${fmt(s.net_amount)}</strong></td>
      <td><span class="badge b-${escHtml(s.status)}">${smap[s.status] || escHtml(s.status)}</span></td>
      <td style="white-space:nowrap;font-size:11px">${fmtDate(s.created_at)}</td>
    </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted);">Sipariş yok</td></tr>';
  renderPager('oPager', pg, total_pages, loadOrders);
}

// ── Earnings ─────────────────────────────────────────────────
async function loadEarnings() {
  const period = val('ePeriod') || 'month';
  const r = await api(`/earnings?period=${period}`);
  if (!r?.success) return;
  const { summary, chart, payouts } = r.data;

  const eStats = document.getElementById('eStats');
  if (eStats) eStats.innerHTML = [
    { l: 'Dönem Brüt',     v: '₺' + fmt(summary.period_gross),      sub: 'Seçili dönem',        c: 'c1', i: '📈' },
    { l: 'Dönem Komisyon', v: '₺' + fmt(summary.period_commission),  sub: `%${summary.commission_rate} oran`, c: 'c4', i: '🏦' },
    { l: 'Dönem Net',      v: '₺' + fmt(summary.period_net),          sub: 'Komisyon sonrası',    c: 'c2', i: '💰' },
    { l: 'Toplam Kazanç',  v: '₺' + fmt(summary.total_earned),        sub: 'Tüm zamanlar',        c: 'c5', i: '🏆' },
    { l: 'Bakiye',         v: '₺' + fmt(summary.balance),             sub: 'Çekilebilir',         c: 'c3', i: '💳' },
  ].map(c => `<div class="stat-card ${c.c}"><div class="sc-icon">${c.i}</div><div class="sc-label">${c.l}</div><div class="sc-val">${c.v}</div><div class="sc-sub">${c.sub}</div></div>`).join('');

  const chartEl = document.getElementById('earningsChart');
  if (chartEl && typeof Chart !== 'undefined') {
    if (chartInst.earnings) chartInst.earnings.destroy();
    chartInst.earnings = new Chart(chartEl.getContext('2d'), {
      type: 'line',
      data: {
        labels: (chart || []).map(d => d.day.slice(5)),
        datasets: [
          { label: 'Brüt (₺)', data: (chart || []).map(d => parseFloat(d.gross || 0)), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.08)', borderWidth: 2, tension: .4, fill: true },
          { label: 'Net (₺)',  data: (chart || []).map(d => parseFloat(d.net   || 0)), borderColor: '#166534', borderWidth: 2, tension: .4, borderDash: [4,4] }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { callback: v => '₺' + v.toLocaleString('tr-TR') } } } }
    });
  }

  const pmap = { pending: '⏳', processing: '🔄', paid: '✅', rejected: '❌' };
  const epEl = document.getElementById('earningsPayouts');
  if (epEl) epEl.innerHTML = (payouts || []).map(p => `
    <div class="ll-row">
      <div class="ll-main">₺${fmt(p.amount)}<div class="ll-sub">${fmtDate(p.requested_at)}</div></div>
      <span class="badge b-${escHtml(p.status)}">${pmap[p.status] || ''} ${escHtml(p.status)}</span>
    </div>`).join('') || '<p style="color:var(--muted);text-align:center;padding:16px">Ödeme talebi yok</p>';
}

// ── Payouts ──────────────────────────────────────────────────
async function loadPayouts(pg = 1) {
  const r0 = await api('/profile');
  if (r0?.success) {
    const bb = document.getElementById('balanceBox');
    if (bb) bb.innerHTML = `
      <div class="bb-item"><strong>₺${fmt(r0.data.balance)}</strong><span>Mevcut Bakiye</span></div>
      <div class="bb-item"><strong>₺${fmt(r0.data.total_earned)}</strong><span>Toplam Kazanç</span></div>
      <div class="bb-item"><strong>%${r0.data.commission_rate}</strong><span>Komisyon Oranım</span></div>`;
  }
  const r = await api(`/payouts?page=${pg}`);
  if (!r?.success) return;
  const { items, total_pages } = r.data;
  const smap = { pending: '⏳ Bekliyor', processing: '🔄 İşlemde', paid: '✅ Ödendi', rejected: '❌ Red' };
  const tbody = document.getElementById('payBody');
  if (!tbody) return;
  tbody.innerHTML = (items || []).map(p => `
    <tr>
      <td><strong>₺${fmt(p.amount)}</strong></td>
      <td>${escHtml(p.method || 'banka')}</td>
      <td><span class="badge b-${escHtml(p.status)}">${smap[p.status] || escHtml(p.status)}</span></td>
      <td style="font-size:11px;white-space:nowrap">${fmtDate(p.requested_at)}</td>
      <td style="font-size:11px;white-space:nowrap">${p.paid_at ? fmtDate(p.paid_at) : '-'}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--muted);">Talep yok</td></tr>';
  renderPager('payPager', pg, total_pages, loadPayouts);
}

function openPayoutModal() {
  openModal('💸 Ödeme Talebi Oluştur', `
    <p style="color:var(--muted);font-size:13px;margin-bottom:16px;">Bakiyenizdeki tutarı IBAN'ınıza transfer için talep oluşturun. Minimum ₺50.</p>
    <div class="mfield"><label>Tutar (₺) *</label><input type="number" id="payAmt" placeholder="100.00" min="50" step="0.01"></div>
    <div class="mfield"><label>Yöntem</label>
      <select id="payMeth"><option value="banka_transferi">Banka Transferi (IBAN)</option></select>
    </div>`,
    [
      { label: 'İptal', cls: 'btn-cancel', fn: closeModal },
      { label: 'Talep Oluştur', cls: 'btn-save', fn: async () => {
        const amount = parseFloat(document.getElementById('payAmt')?.value || 0);
        if (!amount || amount < 50) { toast('Minimum ₺50 talep edebilirsiniz.', 'error'); return; }
        const r = await api('/payouts', 'POST', { amount, method: val('payMeth') });
        if (!r?.success) { toast(r?.message || 'Hata.', 'error'); return; }
        toast('Ödeme talebiniz oluşturuldu!'); closeModal(); loadPayouts();
      }}
    ]
  );
}

// ── Reviews ──────────────────────────────────────────────────
async function loadReviews(pg = 1) {
  const r = await api(`/reviews?page=${pg}`);
  if (!r?.success) return;
  const { items, total_pages } = r.data;
  const tbody = document.getElementById('rBody');
  if (!tbody) return;
  tbody.innerHTML = (items || []).map(rv => `
    <tr>
      <td>${escHtml(rv.user_name || '?')}</td>
      <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(rv.product_name || rv.product_id)}</td>
      <td>${'★'.repeat(Math.min(5, Math.max(0, rv.rating || 0)))}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(rv.body || '-')}</td>
      <td style="font-size:11px;white-space:nowrap">${fmtDate(rv.created_at)}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--muted);">Yorum yok</td></tr>';
  renderPager('rPager', pg, total_pages, loadReviews);
}

// ── Profile ──────────────────────────────────────────────────
async function loadProfile() {
  const r = await api('/profile');
  if (!r?.success) return;
  const v = r.data;
  const pfEl = document.getElementById('profileFields');
  if (pfEl) {
    pfEl.innerHTML = `
      <div class="mfield"><label>Ad Soyad</label><input id="pf-name"></div>
      <div class="mfield"><label>Mağaza Adı</label><input id="pf-shop"></div>
      <div class="mfield"><label>Telefon</label><input id="pf-phone"></div>
      <div class="mfield"><label>Vergi No</label><input id="pf-tax"></div>
      <div class="mfield"><label>Logo Emoji</label><input id="pf-emoji" style="width:70px"></div>
      <div class="mfield span2"><label>Açıklama</label><textarea id="pf-desc" rows="3"></textarea></div>`;
    document.getElementById('pf-name').value  = v.name        || '';
    document.getElementById('pf-shop').value  = v.shop_name   || '';
    document.getElementById('pf-phone').value = v.phone       || '';
    document.getElementById('pf-tax').value   = v.tax_number  || '';
    document.getElementById('pf-emoji').value = v.logo_emoji  || '🏪';
    document.getElementById('pf-desc').value  = v.description || '';
  }
  const bankName = document.getElementById('bankName');
  const bankIban = document.getElementById('bankIban');
  if (bankName && v.bank_name) bankName.value = v.bank_name;
  if (bankIban && v.bank_iban) bankIban.value = v.bank_iban;
}

async function saveProfile() {
  const data = { name: val('pf-name'), shop_name: val('pf-shop'), phone: val('pf-phone'), tax_number: val('pf-tax'), logo_emoji: val('pf-emoji'), description: val('pf-desc') };
  const r = await api('/profile', 'PUT', data);
  if (!r?.success) { toast(r?.message || 'Hata.', 'error'); return; }
  VENDOR.shop_name   = data.shop_name   || VENDOR.shop_name;
  VENDOR.logo_emoji  = data.logo_emoji  || VENDOR.logo_emoji;
  localStorage.setItem('vendorData', JSON.stringify(VENDOR));
  const sbShop  = document.getElementById('sbShopName');
  const sbEmoji = document.getElementById('sbEmoji');
  const hdr     = document.getElementById('shopNameHeader');
  if (sbShop)  sbShop.textContent  = VENDOR.shop_name;
  if (sbEmoji) sbEmoji.textContent = VENDOR.logo_emoji;
  if (hdr)     hdr.textContent     = VENDOR.shop_name;
  toast('Profil güncellendi.');
}

async function saveBank() {
  const bank_name = val('bankName'), bank_iban = val('bankIban');
  if (!bank_iban) { toast('IBAN gereklidir.', 'error'); return; }
  const r = await api('/profile', 'PUT', { bank_name, bank_iban });
  if (!r?.success) { toast(r?.message || 'Hata.', 'error'); return; }
  toast('Banka bilgileri kaydedildi.');
}

async function changePass() {
  const cur = document.getElementById('curPass')?.value  || '';
  const p1  = document.getElementById('newPass')?.value  || '';
  const p2  = document.getElementById('newPass2')?.value || '';
  if (!cur)          { toast('Mevcut şifrenizi girin.', 'error'); return; }
  if (!p1 || !p2)    { toast('Şifreleri doldurun.', 'error'); return; }
  if (p1 !== p2)     { toast('Şifreler eşleşmiyor.', 'error'); return; }
  if (p1.length < 8) { toast('Şifre en az 8 karakter.', 'error'); return; }
  const r = await api('/password', 'PUT', { current_password: cur, new_password: p1 });
  if (!r?.success) { toast(r?.message || 'Hata.', 'error'); return; }
  toast('Şifre güncellendi.');
  ['curPass','newPass','newPass2'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
}

// ── Modal ────────────────────────────────────────────────────
function openModal(title, body, buttons = []) {
  const mTitle = document.getElementById('mTitle');
  const mBody  = document.getElementById('mBody');
  const mFoot  = document.getElementById('mFoot');
  const modal  = document.getElementById('modal');
  if (mTitle) mTitle.textContent = title;
  if (mBody)  mBody.innerHTML    = body;
  if (mFoot) {
    mFoot.innerHTML = '';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.className = b.cls; btn.textContent = b.label; btn.onclick = b.fn;
      mFoot.appendChild(btn);
    });
  }
  if (modal) modal.style.display = 'flex';
}
function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.style.display = 'none';
}

// ── Helpers ──────────────────────────────────────────────────
function val(id) { const e = document.getElementById(id); return e ? e.value.trim() : ''; }
function fmt(n)  { return parseFloat(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderPager(id, pg, total, fn) {
  const el = document.getElementById(id);
  if (!el || !total || total <= 1) { if (el) el.innerHTML = ''; return; }
  let h = `<button class="pg-btn" ${pg === 1 ? 'disabled' : ''} onclick="${fn.name}(${pg - 1})">‹</button>`;
  for (let i = 1; i <= total; i++) {
    if (total > 7 && i > 3 && i < total - 1 && Math.abs(i - pg) > 1) { if (i === 4) h += `<span style="line-height:34px;padding:0 4px">…</span>`; continue; }
    h += `<button class="pg-btn ${i === pg ? 'act' : ''}" onclick="${fn.name}(${i})">${i}</button>`;
  }
  h += `<button class="pg-btn" ${pg >= total ? 'disabled' : ''} onclick="${fn.name}(${pg + 1})">›</button>`;
  el.innerHTML = h;
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = `toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

function _mockAI(path) {
  if (path.includes('sales-insight')) return { analysis: "Bu ayki satışlarınız geçen aya göre %12 artış göstermiş. Hafta sonu trafiği daha yoğun.", current_total: 12500, prev_total: 11000, change_percent: 13.6 };
  if (path.includes('product-advice')) return { advice: "Siyah Triko Kazak şu an trendde. Bu ürünü öne çıkarmanızı öneririm.", suggested_feature: { sku: 'Kadin-123', name: 'Siyah Triko Kazak' } };
  if (path.includes('stock-risk')) return { critical_count: 2, high_count: 5, risk_data: [ {isim:'Kot Pantolon', stok:3, gunluk_satis:1, risk:'KRİTİK', kalan_gun:3}, {isim:'Mavi Gömlek', stok:8, gunluk_satis:2, risk:'YÜKSEK', kalan_gun:4} ] };
  if (path.includes('chat')) return { reply: "Harika bir soru! Satışlarınızı artırmak için kampanya dönemlerini takip edebilirsiniz. Ayrıca ürün açıklamalarına AI ile daha fazla anahtar kelime ekleyebiliriz." };
  return { analysis: "Genel durum stabil. AI analizleri için XAMPP bağlantısı önerilir." };
}
