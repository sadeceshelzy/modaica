// ============================================================
//  MODAICA Admin Panel JS
// ============================================================
const API = (function() {
  const host = window.location.hostname;
  const port = window.location.port ? ':' + window.location.port : '';
  return 'http://' + (host === 'localhost' || host === '127.0.0.1' ? host + port : 'localhost:8080') + '/modaica/backend/api/admin';
})();

let TOKEN = localStorage.getItem('adminToken');
let currentPage = { products:1, orders:1, users:1, vendors:1, coupons:1, campaigns:1, reviews:1, payouts:1, activity:1 };
let timers = {};

// ── XSS önleme ───────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── API helper ───────────────────────────────────────────────
async function api(path, method='GET', data=null) {
  const opts = { method, headers: { 'Content-Type':'application/json', 'Authorization': TOKEN ? 'Bearer '+TOKEN : '' } };
  if (data) opts.body = JSON.stringify(data);
  try {
    const r = await fetch(`${API}${path}`, opts);
    return await r.json();
  } catch(e) { return {success:false,message:'Sunucuya bağlanılamadı.'}; }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (TOKEN) { showPanel(); }
  else { document.getElementById('loginScreen').style.display='flex'; }
  // Saat
  setInterval(() => {
    const el = document.getElementById('tbClock');
    if(el) el.textContent = new Date().toLocaleTimeString('tr-TR');
  }, 1000);
});

// ── Login ────────────────────────────────────────────────────
async function doLogin() {
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  errEl.style.display='none';
  if(!email||!pass){showError(errEl,'E-posta ve şifre gerekli.');return;}
  btn.textContent='Giriş yapılıyor...'; btn.disabled=true;
  const r = await api('/auth/login','POST',{email,password:pass});
  btn.textContent='Giriş Yap'; btn.disabled=false;
  if(!r.success){showError(errEl,r.message);return;}
  TOKEN = r.data.token;
  localStorage.setItem('adminToken', TOKEN);
  localStorage.setItem('adminData', JSON.stringify(r.data.admin));
  showPanel();
}

function showPanel() {
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('panelLayout').style.display='flex';
  let adm; try { adm = JSON.parse(localStorage.getItem('adminData') || '{}'); } catch { adm = {}; }
  document.getElementById('sbUser').innerHTML = `<strong>${esc(adm.name||'Admin')}</strong><br><span style="font-size:11px;color:rgba(255,255,255,.4);">${esc(adm.role||'admin')}</span>`;
  loadDashboard();
}

function logout() {
  localStorage.removeItem('adminToken'); localStorage.removeItem('adminData');
  TOKEN=null;
  document.getElementById('panelLayout').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
}

// ── Page nav ─────────────────────────────────────────────────
function goPage(el) {
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  const p = el.dataset.p;
  document.getElementById(`p-${p}`).classList.add('active');
  document.getElementById('tbTitle').textContent = el.textContent.trim();
  const loaders = {
    products: loadProducts, orders: loadOrders, users: loadUsers, vendors: loadVendors,
    coupons: loadCoupons, campaigns: loadCampaigns, reviews: loadReviews,
    payouts: loadPayouts, activity: loadActivity, settings: loadSettings
  };
  if(loaders[p]) loaders[p]();
}

function clearTimer(k) { clearTimeout(timers[k]); }

// ── DASHBOARD ────────────────────────────────────────────────
let revenueChartInst = null;
async function loadDashboard() {
  const r = await api('/dashboard');
  if(!r.success){toast(r.message,'error');return;}
  const {stats, rev30, lastOrders, orderStats, newVendors} = r.data;

  // Badges
  if(stats.low_stock>0) setNB('nb-lowstock',stats.low_stock);
  if(stats.pending_orders>0) setNB('nb-pending-orders',stats.pending_orders);
  if(stats.pending_vendors>0) setNB('nb-vendors',stats.pending_vendors);

  // Stat cards
  const cards = [
    {l:'Toplam Gelir',     v:'₺'+fmt(stats.total_revenue),  sub:'Tüm zamanlar',      c:'c1', i:'💰'},
    {l:'Bu Ay Gelir',      v:'₺'+fmt(stats.month_revenue),  sub:'Cari ay',           c:'c2', i:'📈'},
    {l:'Bugün Gelir',      v:'₺'+fmt(stats.today_revenue),  sub:'Bugün',             c:'c3', i:'🌅'},
    {l:'Toplam Sipariş',   v:stats.total_orders,            sub:`Bugün: ${stats.today_orders}`, c:'c1', i:'🛒'},
    {l:'Bekleyen Sipariş', v:stats.pending_orders,          sub:'Onay bekliyor',     c:'c4', i:'⏳'},
    {l:'Toplam Kullanıcı', v:stats.total_users,             sub:`Bugün: +${stats.new_users_today}`, c:'c2', i:'👥'},
    {l:'Aktif Ürün',       v:stats.active_products,         sub:`Düşük stok: ${stats.low_stock}`, c:'c5', i:'📦'},
    {l:'Aktif Satıcı',     v:stats.active_vendors,          sub:`Onay bekleyen: ${stats.pending_vendors}`, c:'c6', i:'🏪'},
  ];
  document.getElementById('statGrid').innerHTML = cards.map(c=>`
    <div class="stat-card ${c.c}">
      <div class="sc-icon">${c.i}</div>
      <div class="sc-label">${c.l}</div>
      <div class="sc-val">${c.v}</div>
      <div class="sc-sub">${c.sub}</div>
    </div>`).join('');

  // Revenue chart
  if(revenueChartInst) revenueChartInst.destroy();
  const ctx = document.getElementById('revenueChart').getContext('2d');
  revenueChartInst = new Chart(ctx,{
    type:'line',
    data:{labels:rev30.map(d=>d.day.slice(5)),datasets:[{label:'Gelir (₺)',data:rev30.map(d=>parseFloat(d.total)),borderColor:'#2d3aaa',backgroundColor:'rgba(45,58,170,.08)',borderWidth:2,tension:.4,fill:true,pointRadius:3}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{callback:v=>'₺'+v.toLocaleString('tr-TR')}}}}
  });

  // Order dist
  const statusMap = {pending:'⏳ Bekliyor',preparing:'📦 Hazırlanıyor',shipping:'🚚 Kargoda',delivered:'✅ Teslim',cancelled:'❌ İptal'};
  const colors = {pending:'#f97316',preparing:'#3b82f6',shipping:'#22c55e',delivered:'#166534',cancelled:'#e63946'};
  const totalOrd = orderStats.reduce((s,o)=>s+(parseInt(o.cnt)||0),0);
  document.getElementById('orderDist').innerHTML = orderStats.map(o=>{
    const pct = totalOrd ? Math.round(o.cnt/totalOrd*100) : 0;
    return `<div class="od-row"><span style="min-width:110px">${statusMap[o.status]||o.status}</span><div class="od-bar"><div class="od-fill" style="width:${pct}%;background:${colors[o.status]||'#ccc'}"></div></div><span style="min-width:30px;text-align:right;font-weight:600">${o.cnt}</span></div>`;
  }).join('');

  // Last orders
  const orderStatusBadge = s => `<span class="badge b-${esc(s)}">${{pending:'⏳',preparing:'📦',shipping:'🚚',delivered:'✅',cancelled:'❌'}[s]||esc(s)}</span>`;
  document.getElementById('latestOrders').innerHTML = (lastOrders||[]).map(o=>`
    <div class="ll-row">
      <div class="ll-main">${esc(o.order_code)}<div class="ll-sub">${esc(o.user_name||'?')}</div></div>
      ${orderStatusBadge(o.status)}
      <strong>₺${fmt(o.total)}</strong>
    </div>`).join('') || '<p style="padding:16px;color:var(--muted);text-align:center;">Sipariş yok</p>';

  // New vendors
  const vBadge = s=>`<span class="badge b-${s}">${s}</span>`;
  document.getElementById('latestVendors').innerHTML = (newVendors||[]).map(v=>`
    <div class="ll-row">
      <div class="ll-main">${esc(v.shop_name)}<div class="ll-sub">${esc(v.email)}</div></div>
      ${vBadge(esc(v.status))}
    </div>`).join('') || '<p style="padding:16px;color:var(--muted);text-align:center;">Satıcı yok</p>';
}

function setNB(id, val) { const el=document.getElementById(id); if(el&&val>0){el.textContent=val;el.style.display='flex';} }

// ── PRODUCTS ─────────────────────────────────────────────────
async function loadProducts(pg=1) {
  currentPage.products=pg;
  const q=val('pSearch'), dept=val('pDept'), active=val('pActive');
  const r = await api(`/products?q=${encodeURIComponent(q)}&department=${dept}&active=${active}&page=${pg}`);
  if(!r.success){toast(r.message,'error');return;}
  const {items,total,total_pages} = r.data;
  document.getElementById('pBody').innerHTML = (items||[]).map(p=>`
    <tr>
      <td><span class="cell-emoji">${esc(p.emoji||'📦')}</span><span class="cell-name">${esc(p.name)}</span><div class="cell-sub">${esc(p.brand||'')}</div></td>
      <td><code style="font-size:12px">${esc(p.sku)}</code></td>
      <td><strong>₺${fmt(p.price)}</strong>${p.old_price?`<div class="cell-sub" style="text-decoration:line-through">₺${fmt(p.old_price)}</div>`:''}</td>
      <td><span style="color:${p.stock<10?'var(--accent2)':p.stock<30?'var(--warning)':'var(--success)'}">${p.stock|0}</span></td>
      <td>${esc(p.department||'-')}</td>
      <td><span class="badge ${p.is_active?'b-active':'b-cancelled'}">${p.is_active?'Aktif':'Pasif'}</span></td>
      <td>
        <button class="btn-icon" title="Düzenle" onclick="openProductModal(${JSON.stringify(p).replace(/'/g,"&#39;")})">✏️</button>
        <button class="btn-icon danger" title="Pasife Al" onclick="toggleProduct(${p.id|0},${p.is_active|0})">🗑️</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);">Ürün bulunamadı</td></tr>';
  renderPager('pPager', pg, total_pages, loadProducts);
}

function openProductModal(p) {
  const isEdit = !!p;
  openModal(isEdit ? `✏️ Ürün Düzenle` : '📦 Yeni Ürün', `
    <div class="mrow">
      <div class="mfield span2"><label>Ürün Adı *</label><input id="mp-name"></div>
      <div class="mfield"><label>Marka *</label><input id="mp-brand"></div>
      <div class="mfield"><label>Emoji</label><input id="mp-emoji" style="width:80px"></div>
      <div class="mfield"><label>Fiyat (₺) *</label><input type="number" id="mp-price"></div>
      <div class="mfield"><label>Eski Fiyat (₺)</label><input type="number" id="mp-oldprice"></div>
      <div class="mfield"><label>Stok</label><input type="number" id="mp-stock"></div>
      <div class="mfield"><label>Departman *</label>
        <select id="mp-dept">
          ${['erkek','kadin','elektronik','ev','spor','kozmetik'].map(d=>`<option value="${d}">${d}</option>`).join('')}
        </select>
      </div>
      <div class="mfield span2"><label>Kategori Slug *</label><input id="mp-cat"></div>
      <div class="mfield span2"><label>Açıklama</label><textarea id="mp-desc" rows="3"></textarea></div>
      <div class="mfield"><label>Badge</label>
        <select id="mp-badge"><option value="">Yok</option><option value="new">Yeni</option><option value="sale">İndirim</option><option value="hot">Hot</option></select>
      </div>
      <div class="mfield"><label>Durum</label>
        <select id="mp-active"><option value="1">Aktif</option><option value="0">Pasif</option></select>
      </div>
    </div>`,
    [
      {label:'İptal', cls:'btn-cancel-m', fn:closeModal},
      {label: isEdit ? 'Kaydet' : 'Oluştur', cls:'btn-save', fn:()=>saveProduct(isEdit?p.id:null)}
    ]
  );
  // Set values safely after modal is rendered
  if (p) {
    document.getElementById('mp-name').value     = p.name         || '';
    document.getElementById('mp-brand').value    = p.brand        || '';
    document.getElementById('mp-emoji').value    = p.emoji        || '🛍️';
    document.getElementById('mp-price').value    = p.price        || '';
    document.getElementById('mp-oldprice').value = p.old_price    || '';
    document.getElementById('mp-stock').value    = p.stock        ?? 100;
    document.getElementById('mp-dept').value     = p.department   || '';
    document.getElementById('mp-cat').value      = p.category_slug|| '';
    document.getElementById('mp-desc').value     = p.description  || '';
    document.getElementById('mp-badge').value    = p.badge        || '';
    document.getElementById('mp-active').value   = p.is_active ? '1' : '0';
  } else {
    document.getElementById('mp-stock').value = '100';
    document.getElementById('mp-emoji').value = '🛍️';
    document.getElementById('mp-active').value = '1';
  }
}

async function saveProduct(id) {
  const data = {
    name: val('mp-name'), brand: val('mp-brand'), emoji: val('mp-emoji'),
    price: parseFloat(val('mp-price')), old_price: parseFloat(val('mp-oldprice'))||null,
    stock: parseInt(val('mp-stock')), department: val('mp-dept'),
    category_slug: val('mp-cat'), description: val('mp-desc'),
    badge: val('mp-badge')||null, is_active: parseInt(val('mp-active'))
  };
  if(!data.name||!data.brand||!data.category_slug||!data.price) {toast('Zorunlu alanlar eksik.','error');return;}
  const r = id ? await api(`/products/${id}`,'PUT',data) : await api('/products','POST',data);
  if(!r.success){toast(r.message,'error');return;}
  toast(id?'Ürün güncellendi.':'Ürün oluşturuldu.');
  closeModal(); loadProducts();
}

async function toggleProduct(id, active) {
  if(!confirm(active?'Ürünü pasife almak istiyor musunuz?':'Ürünü aktifleştirmek istiyor musunuz?')) return;
  const r = await api(`/products/${id}`,'PUT',{is_active:active?0:1});
  if(r.success){toast('Güncellendi.');loadProducts();}else toast(r.message,'error');
}

// ── ORDERS ───────────────────────────────────────────────────
const STATUS_LABELS = {pending:'⏳ Bekliyor',preparing:'📦 Hazırlanıyor',shipping:'🚚 Kargoda',delivered:'✅ Teslim',cancelled:'❌ İptal'};
async function loadOrders(pg=1) {
  currentPage.orders=pg;
  const q=val('oSearch'), status=val('oStatus');
  const r = await api(`/orders?q=${encodeURIComponent(q)}&status=${status}&page=${pg}`);
  if(!r.success){toast(r.message,'error');return;}
  const {items,total_pages} = r.data;
  document.getElementById('oBody').innerHTML = (items||[]).map(o=>`
    <tr>
      <td><strong>${esc(o.order_code)}</strong></td>
      <td>${esc(o.user_name||'?')}<div class="cell-sub">${esc(o.user_email||'')}</div></td>
      <td><strong>₺${fmt(o.total)}</strong></td>
      <td><span class="badge b-${esc(o.status)}">${STATUS_LABELS[o.status]||esc(o.status)}</span></td>
      <td style="white-space:nowrap">${fmtDate(o.created_at)}</td>
      <td><button class="btn-icon" onclick="openOrderModal(${o.id|0})">👁️</button></td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted);">Sipariş yok</td></tr>';
  renderPager('oPager', pg, total_pages, loadOrders);
}

async function openOrderModal(id) {
  const r = await api(`/orders/${id}`);
  if(!r.success){toast(r.message,'error');return;}
  const {order, items, address} = r.data;
  openModal(`🛒 Sipariş: ${esc(order.order_code)}`,`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
      <div><strong>Müşteri:</strong> ${esc(order.user_name)}</div>
      <div><strong>E-posta:</strong> ${esc(order.user_email)}</div>
      <div><strong>Toplam:</strong> ₺${fmt(order.total)}</div>
      <div><strong>Tarih:</strong> ${fmtDate(order.created_at)}</div>
    </div>
    <div style="margin-bottom:16px;">
      <label style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;">Durum Güncelle</label>
      <select id="oStatusSel" style="width:100%;border:1.5px solid var(--border);border-radius:9px;padding:10px 14px;font-size:14px;margin-top:6px;outline:none;">
        ${Object.entries(STATUS_LABELS).map(([k,v])=>`<option value="${k}" ${order.status===k?'selected':''}>${v}</option>`).join('')}
      </select>
    </div>
    <div style="margin-bottom:16px;">
      <label style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;">Kargo Takip No</label>
      <input id="oCargoInput" style="width:100%;border:1.5px solid var(--border);border-radius:9px;padding:10px 14px;font-size:14px;margin-top:6px;outline:none;" value="${order.cargo_tracking||''}" placeholder="Takip numarası girin...">
    </div>
    <div class="card-title" style="margin-bottom:8px;">Ürünler</div>
    ${(items||[]).map(i=>`<div class="ll-row"><span>${esc(i.emoji||'📦')} ${esc(i.product_name)}</span><span>×${i.quantity|0}</span><strong>₺${fmt(i.unit_price*i.quantity)}</strong></div>`).join('')}`,
    [
      {label:'İptal', cls:'btn-cancel-m', fn:closeModal},
      {label:'Güncelle', cls:'btn-save', fn:async()=>{
        const r2=await api(`/orders/${id}`,'PUT',{status:val('oStatusSel'),cargo_tracking:val('oCargoInput')});
        if(r2.success){toast('Sipariş güncellendi.');closeModal();loadOrders();}else toast(r2.message,'error');
      }}
    ]
  );
}

// ── USERS ────────────────────────────────────────────────────
async function loadUsers(pg=1) {
  currentPage.users=pg;
  const q=val('uSearch'), active=val('uActive');
  const r = await api(`/users?q=${encodeURIComponent(q)}&active=${active}&page=${pg}`);
  if(!r.success){toast(r.message,'error');return;}
  const {items,total_pages} = r.data;
  document.getElementById('uBody').innerHTML = (items||[]).map(u=>`
    <tr>
      <td><strong>${esc(u.name)}</strong></td>
      <td>${esc(u.email)}</td>
      <td>${esc(u.phone||'-')}</td>
      <td>${u.loyalty_points||0}</td>
      <td><span class="badge b-${esc((u.loyalty_level||'Bronze').toLowerCase())}" style="background:${levelColor(u.loyalty_level)};color:white;">${esc(u.loyalty_level||'Bronze')}</span></td>
      <td><span class="badge ${u.is_active?'b-active':'b-cancelled'}">${u.is_active?'Aktif':'Pasif'}</span></td>
      <td style="white-space:nowrap">${fmtDate(u.created_at)}</td>
      <td>
        <button class="btn-icon" title="Detay" onclick="openUserModal(${u.id|0})">👁️</button>
        <button class="btn-icon danger" title="${u.is_active?'Pasife Al':'Aktifleştir'}" onclick="toggleUser(${u.id|0},${u.is_active|0})">${u.is_active?'🚫':'✅'}</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);">Kullanıcı bulunamadı</td></tr>';
  renderPager('uPager', pg, total_pages, loadUsers);
}

function levelColor(l){return{Bronze:'#92400e',Silver:'#6b7280',Gold:'#f4a226',Platinum:'#7c3aed'}[l]||'#92400e';}

async function openUserModal(id) {
  const r = await api(`/users/${id}`);
  if(!r.success){toast(r.message,'error');return;}
  const {user,orders} = r.data;
  openModal(`👤 ${esc(user.name)}`,`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
      <div><strong>E-posta:</strong> ${esc(user.email)}</div>
      <div><strong>Telefon:</strong> ${esc(user.phone||'-')}</div>
      <div><strong>Puan:</strong> ${user.loyalty_points||0}</div>
      <div><strong>Seviye:</strong> ${esc(user.loyalty_level||'Bronze')}</div>
      <div><strong>Durum:</strong> <span class="badge ${user.is_active?'b-active':'b-cancelled'}">${user.is_active?'Aktif':'Pasif'}</span></div>
      <div><strong>Kayıt:</strong> ${fmtDate(user.created_at)}</div>
    </div>
    <div class="card-title" style="margin-bottom:8px;">Son Siparişler</div>
    ${(orders||[]).map(o=>`<div class="ll-row"><span>${esc(o.order_code)}</span><span class="badge b-${esc(o.status)}">${esc(o.status)}</span><strong>₺${fmt(o.total)}</strong><span style="color:var(--muted);font-size:12px">${fmtDate(o.created_at)}</span></div>`).join('') || '<p style="color:var(--muted);">Sipariş yok</p>'}`,
    [{label:'Kapat', cls:'btn-cancel-m', fn:closeModal}]
  );
}

async function toggleUser(id, active) {
  const r = await api(`/users/${id}`,'PUT',{is_active:active?0:1});
  if(r.success){toast('Güncellendi.');loadUsers();}else toast(r.message,'error');
}

// ── VENDORS ──────────────────────────────────────────────────
async function loadVendors(pg=1) {
  currentPage.vendors=pg;
  const q=val('vSearch'), status=val('vStatus');
  const r = await api(`/vendors?q=${encodeURIComponent(q)}&status=${status}&page=${pg}`);
  if(!r.success){toast(r.message,'error');return;}
  const {items,total_pages} = r.data;
  document.getElementById('vBody').innerHTML = (items||[]).map(v=>`
    <tr>
      <td><strong>${esc(v.name)}</strong><div class="cell-sub">${esc(v.email)}</div></td>
      <td>${esc(v.shop_name)}</td>
      <td>%${v.commission_rate}</td>
      <td>₺${fmt(v.balance)}</td>
      <td><span class="badge b-${esc(v.status)}">${{pending:'⏳ Onay Bekliyor',active:'✅ Aktif',suspended:'🚫 Askıda',rejected:'❌ Reddedilmiş'}[v.status]||esc(v.status)}</span></td>
      <td style="white-space:nowrap">${fmtDate(v.created_at)}</td>
      <td><button class="btn-icon" onclick="openVendorModal(${v.id|0})">⚙️</button></td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);">Satıcı bulunamadı</td></tr>';
  renderPager('vPager', pg, total_pages, loadVendors);
}

async function openVendorModal(id) {
  const r = await api(`/vendors/${id}`);
  if(!r.success){toast(r.message,'error');return;}
  const {vendor, product_count, sales} = r.data;
  openModal(`🏪 ${esc(vendor.shop_name)}`,`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;">
      <div><strong>Ad:</strong> ${esc(vendor.name)}</div>
      <div><strong>E-posta:</strong> ${esc(vendor.email)}</div>
      <div><strong>Ürün Sayısı:</strong> ${product_count|0}</div>
      <div><strong>Toplam Satış:</strong> ${sales?.cnt||0} sipariş</div>
      <div><strong>Brüt Kazanç:</strong> ₺${fmt(sales?.gross||0)}</div>
      <div><strong>Net Kazanç:</strong> ₺${fmt(sales?.net||0)}</div>
      <div><strong>Bakiye:</strong> ₺${fmt(vendor.balance)}</div>
      <div><strong>IBAN:</strong> ${esc(vendor.bank_iban||'-')}</div>
    </div>
    <div class="mrow">
      <div class="mfield"><label>Durum</label>
        <select id="vm-status">
          ${['pending','active','suspended','rejected'].map(s=>`<option value="${s}" ${vendor.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="mfield"><label>Komisyon (%)</label><input type="number" id="vm-comm" value="${vendor.commission_rate||10}" min="0" max="50"></div>
      <div class="mfield span2"><label>Red Sebebi (reddedilecekse)</label><input id="vm-reason" value="${vendor.reject_reason||''}"></div>
    </div>`,
    [
      {label:'İptal', cls:'btn-cancel-m', fn:closeModal},
      {label:'Kaydet', cls:'btn-save', fn:async()=>{
        const r2=await api(`/vendors/${id}`,'PUT',{status:val('vm-status'),commission_rate:parseFloat(val('vm-comm')),reject_reason:val('vm-reason')});
        if(r2.success){toast('Satıcı güncellendi.');closeModal();loadVendors();}else toast(r2.message,'error');
      }}
    ]
  );
}

// ── COUPONS ──────────────────────────────────────────────────
async function loadCoupons(pg=1) {
  currentPage.coupons=pg;
  const r = await api(`/coupons?page=${pg}`);
  if(!r.success){toast(r.message,'error');return;}
  const {items,total_pages} = r.data;
  document.getElementById('cBody').innerHTML = (items||[]).map(c=>`
    <tr>
      <td><code style="font-size:13px;font-weight:700;color:var(--primary)">${c.code}</code></td>
      <td><strong>%${c.discount_pct}</strong></td>
      <td>${c.min_amount>0?'₺'+fmt(c.min_amount):'-'}</td>
      <td>${c.used_count}${c.max_uses?' / '+c.max_uses:''}</td>
      <td>${c.expires_at?fmtDate(c.expires_at):'Süresiz'}</td>
      <td><span class="badge ${c.is_active?'b-active':'b-cancelled'}">${c.is_active?'Aktif':'Pasif'}</span></td>
      <td>
        <button class="btn-icon" onclick="openCouponModal(${JSON.stringify(c).replace(/'/g,"&#39;")})">✏️</button>
        <button class="btn-icon danger" onclick="deleteCoupon(${c.id})">🗑️</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);">Kupon yok</td></tr>';
  renderPager('cPager', pg, total_pages, loadCoupons);
}

function openCouponModal(c) {
  const isEdit=!!c;
  openModal(isEdit?`✏️ Kupon Düzenle`:'🎟️ Yeni Kupon',`
    <div class="mrow">
      <div class="mfield span2"><label>Kupon Kodu *</label><input id="cp-code" value="${esc(c?.code||'')}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
      <div class="mfield"><label>İndirim (%) *</label><input type="number" id="cp-pct" value="${c?.discount_pct||10}" min="1" max="100"></div>
      <div class="mfield"><label>Min. Tutar (₺)</label><input type="number" id="cp-min" value="${c?.min_amount||0}" min="0"></div>
      <div class="mfield"><label>Maks. Kullanım</label><input type="number" id="cp-max" value="${c?.max_uses||''}" placeholder="Sınırsız"></div>
      <div class="mfield"><label>Bitiş Tarihi</label><input type="datetime-local" id="cp-exp" value="${c?.expires_at?.replace(' ','T')||''}"></div>
      <div class="mfield"><label>Durum</label>
        <select id="cp-active"><option value="1" ${c?.is_active!==0?'selected':''}>Aktif</option><option value="0" ${c?.is_active===0?'selected':''}>Pasif</option></select>
      </div>
    </div>`,
    [
      {label:'İptal', cls:'btn-cancel-m', fn:closeModal},
      {label:isEdit?'Güncelle':'Oluştur', cls:'btn-save', fn:()=>saveCoupon(isEdit?c.id:null)}
    ]
  );
}

async function saveCoupon(id) {
  const data={code:val('cp-code'),discount_pct:parseInt(val('cp-pct')),min_amount:parseFloat(val('cp-min'))||0,max_uses:parseInt(val('cp-max'))||null,expires_at:val('cp-exp')||null,is_active:parseInt(val('cp-active'))};
  if(!data.code||!data.discount_pct){toast('Zorunlu alanlar eksik.','error');return;}
  const r=id?await api(`/coupons/${id}`,'PUT',data):await api('/coupons','POST',data);
  if(!r.success){toast(r.message,'error');return;}
  toast(id?'Kupon güncellendi.':'Kupon oluşturuldu.');closeModal();loadCoupons();
}

async function deleteCoupon(id) {
  if(!confirm('Kuponu silmek istiyor musunuz?'))return;
  const r=await api(`/coupons/${id}`,'DELETE');
  if(r.success){toast('Kupon silindi.');loadCoupons();}else toast(r.message,'error');
}

// ── CAMPAIGNS ────────────────────────────────────────────────
async function loadCampaigns() {
  const r = await api('/campaigns?page=1');
  if(!r.success){toast(r.message,'error');return;}
  const {items} = r.data;
  document.getElementById('camBody').innerHTML = (items||[]).map(c=>`
    <tr>
      <td><strong>${esc(c.title)}</strong></td>
      <td>${c.discount_pct?'%'+c.discount_pct:'-'}</td>
      <td>${esc(c.target_dept==='all'?'Tümü':c.target_dept)}</td>
      <td>${fmtDate(c.start_date)}</td>
      <td>${fmtDate(c.end_date)}</td>
      <td><span class="badge ${c.is_active?'b-active':'b-cancelled'}">${c.is_active?'Aktif':'Pasif'}</span></td>
      <td>
        <button class="btn-icon" onclick="openCampaignModal(${JSON.stringify(c).replace(/'/g,"&#39;")})">✏️</button>
        <button class="btn-icon danger" onclick="deleteCampaign(${c.id|0})">🗑️</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);">Kampanya yok</td></tr>';
}

function openCampaignModal(c) {
  const isEdit=!!c;
  openModal(isEdit?'✏️ Kampanya Düzenle':'🎯 Yeni Kampanya',`
    <div class="mrow">
      <div class="mfield span2"><label>Başlık *</label><input id="cam-title" value="${esc(c?.title||'')}"></div>
      <div class="mfield span2"><label>Açıklama</label><textarea id="cam-desc" rows="2">${esc(c?.description||'')}</textarea></div>
      <div class="mfield"><label>İndirim (%)</label><input type="number" id="cam-disc" value="${c?.discount_pct||0}" min="0" max="100"></div>
      <div class="mfield"><label>Hedef Departman</label>
        <select id="cam-dept"><option value="all" ${!c?.target_dept||c?.target_dept==='all'?'selected':''}>Tümü</option>${['erkek','kadin','elektronik','ev','spor','kozmetik'].map(d=>`<option value="${d}" ${c?.target_dept===d?'selected':''}>${d}</option>`).join('')}</select>
      </div>
      <div class="mfield"><label>Başlangıç *</label><input type="datetime-local" id="cam-start" value="${c?.start_date?.replace(' ','T')||''}"></div>
      <div class="mfield"><label>Bitiş *</label><input type="datetime-local" id="cam-end" value="${c?.end_date?.replace(' ','T')||''}"></div>
      <div class="mfield"><label>Durum</label>
        <select id="cam-active"><option value="1" ${c?.is_active!==0?'selected':''}>Aktif</option><option value="0" ${c?.is_active===0?'selected':''}>Pasif</option></select>
      </div>
    </div>`,
    [
      {label:'İptal', cls:'btn-cancel-m', fn:closeModal},
      {label:isEdit?'Güncelle':'Oluştur', cls:'btn-save', fn:async()=>{
        const data={title:val('cam-title'),description:val('cam-desc'),discount_pct:parseInt(val('cam-disc'))||0,target_dept:val('cam-dept'),start_date:val('cam-start'),end_date:val('cam-end'),is_active:parseInt(val('cam-active'))};
        if(!data.title||!data.start_date||!data.end_date){toast('Zorunlu alanlar eksik.','error');return;}
        const r=isEdit?await api(`/campaigns/${c.id}`,'PUT',data):await api('/campaigns','POST',data);
        if(!r.success){toast(r.message,'error');return;}
        toast(isEdit?'Kampanya güncellendi.':'Kampanya oluşturuldu.');closeModal();loadCampaigns();
      }}
    ]
  );
}

async function deleteCampaign(id) {
  if(!confirm('Kampanyayı silmek istiyor musunuz?'))return;
  const r=await api(`/campaigns/${id}`,'DELETE');
  if(r.success){toast('Kampanya silindi.');loadCampaigns();}else toast(r.message,'error');
}

// ── REVIEWS ──────────────────────────────────────────────────
async function loadReviews(pg=1) {
  currentPage.reviews=pg;
  const approved=val('rApproved');
  const r = await api(`/reviews?approved=${approved}&page=${pg}`);
  if(!r.success){toast(r.message,'error');return;}
  const {items,total_pages} = r.data;
  document.getElementById('rBody').innerHTML = (items||[]).map(rv=>`
    <tr>
      <td>${esc(rv.user_name||'?')}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(rv.product_name||rv.product_id)}</td>
      <td>${'★'.repeat(Math.min(5,Math.max(0,rv.rating||0)))}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(rv.body||'-')}</td>
      <td style="white-space:nowrap">${fmtDate(rv.created_at)}</td>
      <td>
        ${rv.is_approved?`<button class="btn-icon" title="Gizle" onclick="modReview(${rv.id|0},0)">🙈</button>`:`<button class="btn-icon" title="Onayla" onclick="modReview(${rv.id|0},1)">✅</button>`}
        <button class="btn-icon danger" title="Sil" onclick="deleteReview(${rv.id|0})">🗑️</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted);">Yorum bulunamadı</td></tr>';
  renderPager('rPager', pg, total_pages, loadReviews);
}

async function modReview(id, approved) {
  const r=await api(`/reviews/${id}`,'PUT',{is_approved:approved});
  if(r.success){toast(approved?'Yorum onaylandı.':'Yorum gizlendi.');loadReviews();}else toast(r.message,'error');
}
async function deleteReview(id) {
  if(!confirm('Yorumu silmek istiyor musunuz?'))return;
  const r=await api(`/reviews/${id}`,'DELETE');
  if(r.success){toast('Yorum silindi.');loadReviews();}else toast(r.message,'error');
}

// ── PAYOUTS ──────────────────────────────────────────────────
async function loadPayouts(pg=1) {
  currentPage.payouts=pg;
  const status=val('payStatus');
  const r = await api(`/payouts?status=${status}&page=${pg}`);
  if(!r.success){toast(r.message,'error');return;}
  const {items,total_pages} = r.data;
  document.getElementById('payBody').innerHTML = (items||[]).map(p=>`
    <tr>
      <td><strong>${esc(p.shop_name||'?')}</strong><div class="cell-sub">${esc(p.vendor_name||'')}</div></td>
      <td><strong>₺${fmt(p.amount)}</strong></td>
      <td>${esc(p.method||'banka')}</td>
      <td><span class="badge b-${esc(p.status)}">${{pending:'⏳ Bekliyor',processing:'🔄 İşlemde',paid:'✅ Ödendi',rejected:'❌ Reddedildi'}[p.status]||esc(p.status)}</span></td>
      <td style="white-space:nowrap">${fmtDate(p.requested_at)}</td>
      <td>
        ${p.status==='pending'?`<button class="btn-icon" onclick="updatePayout(${p.id|0},'processing')">🔄</button><button class="btn-icon" onclick="updatePayout(${p.id|0},'paid')">✅</button><button class="btn-icon danger" onclick="updatePayout(${p.id|0},'rejected')">❌</button>`:''}
      </td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted);">Ödeme talebi yok</td></tr>';
  renderPager('payPager', pg, total_pages, loadPayouts);
}

async function updatePayout(id, status) {
  const labels = {processing:'İşleme alınacak',paid:'Ödendi olarak işaretlenecek',rejected:'Reddedilecek'};
  if(!confirm(`${labels[status]} - emin misiniz?`)) return;
  const r = await api(`/payouts/${id}`,'PUT',{status});
  if(r.success){toast('Ödeme güncellendi.');loadPayouts();}else toast(r.message,'error');
}

// ── ACTIVITY ─────────────────────────────────────────────────
async function loadActivity(pg=1) {
  currentPage.activity=pg;
  const r = await api(`/activity?page=${pg}`);
  if(!r.success){toast(r.message,'error');return;}
  const {items,total_pages} = r.data;
  document.getElementById('actBody').innerHTML = (items||[]).map(a=>`
    <tr>
      <td><span class="badge ${a.actor_type==='admin'?'b-active':'b-shipping'}">${a.actor_type==='admin'?'🛡️ Admin':'🏪 Satıcı'}</span></td>
      <td>#${a.actor_id|0}</td>
      <td><code style="font-size:12px">${esc(a.action)}</code></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.detail||'-')}</td>
      <td style="font-size:12px;color:var(--muted)">${esc(a.ip||'-')}</td>
      <td style="white-space:nowrap;font-size:12px">${fmtDate(a.created_at)}</td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted);">Log yok</td></tr>';
  renderPager('actPager', pg, total_pages, loadActivity);
}

// ── SETTINGS ─────────────────────────────────────────────────
let settingsData = {};
async function loadSettings() {
  const r = await api('/settings');
  if(!r.success){toast(r.message,'error');return;}
  settingsData = r.data.settings;
  const form = document.getElementById('settingsForm');
  form.innerHTML = Object.entries(settingsData).map(([k,s])=>`
    <div class="mfield">
      <label>${esc(s.label||k)}</label>
      ${s.type==='toggle'
        ? `<select id="s-${esc(k)}"><option value="1" ${s.value==='1'?'selected':''}>Açık</option><option value="0" ${s.value!=='1'?'selected':''}>Kapalı</option></select>`
        : `<input type="${esc(s.type||'text')}" id="s-${esc(k)}" value="${esc(s.value||'')}">`
      }
    </div>`).join('');
}

async function saveSettings() {
  const data = {};
  Object.keys(settingsData).forEach(k=>{const el=document.getElementById(`s-${k}`);if(el)data[k]=el.value;});
  const r = await api('/settings','PUT',data);
  if(r.success){toast('Ayarlar kaydedildi.');}else toast(r.message,'error');
}

// ── MODAL ────────────────────────────────────────────────────
function openModal(title, body, buttons=[]) {
  document.getElementById('mTitle').textContent = title;
  document.getElementById('mBody').innerHTML = body;
  document.getElementById('mFoot').innerHTML = '';
  buttons.forEach(b=>{
    const btn=document.createElement('button');
    btn.className=b.cls||'btn-cancel-m';
    btn.textContent=b.label;
    btn.onclick=b.fn;
    document.getElementById('mFoot').appendChild(btn);
  });
  document.getElementById('modal').style.display='flex';
}
function closeModal(){document.getElementById('modal').style.display='none';}

// ── HELPERS ──────────────────────────────────────────────────
function val(id){const el=document.getElementById(id);return el?el.value.trim():'';}
function fmt(n){return parseFloat(n||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtDate(d){if(!d)return'-';return new Date(d).toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function showError(el,msg){el.textContent=msg;el.style.display='block';}

function renderPager(containerId, pg, total, fn) {
  const el = document.getElementById(containerId);
  if(!el||total<=1){if(el)el.innerHTML='';return;}
  let h='';
  h+=`<button class="pg-btn" ${pg===1?'disabled':''} onclick="${fn.name}(${pg-1})">‹</button>`;
  for(let i=1;i<=total;i++){
    if(total>7&&i>3&&i<total-1&&Math.abs(i-pg)>1){if(i===4)h+=`<span style="padding:0 4px;line-height:36px;font-size:14px">…</span>`;continue;}
    h+=`<button class="pg-btn ${i===pg?'act':''}" onclick="${fn.name}(${i})">${i}</button>`;
  }
  h+=`<button class="pg-btn" ${pg===total?'disabled':''} onclick="${fn.name}(${pg+1})">›</button>`;
  el.innerHTML=h;
}

function toast(msg, type='success') {
  const el=document.getElementById('toast');
  el.textContent=msg; el.className=`toast show ${type}`;
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.classList.remove('show'),3000);
}
