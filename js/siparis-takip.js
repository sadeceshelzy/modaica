/* MODAICA — Sipariş Takip JS */

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

const STEPS = [
  { key:'pending',   label:'Alındı',       emoji:'✅' },
  { key:'preparing', label:'Hazırlanıyor',  emoji:'📦' },
  { key:'shipping',  label:'Kargoda',       emoji:'🚚' },
  { key:'delivered', label:'Teslim Edildi', emoji:'🏠' },
];

const STATUS_MAP = {
  pending:   { label:'Sipariş Alındı',    cls:'st-pending'  },
  preparing: { label:'Hazırlanıyor',      cls:'st-preparing' },
  shipping:  { label:'Kargoda',           cls:'st-shipping'  },
  delivered: { label:'Teslim Edildi',     cls:'st-delivered' },
  cancelled: { label:'İptal Edildi',      cls:'st-cancelled' },
};

const CARGO_MAP = { standard:'Standart Kargo', fast:'Hızlı Teslimat', sameday:'Aynı Gün' };

// ── URL'den sipariş kodu al ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateBadges();
  const params = new URLSearchParams(location.search);
  const code   = params.get('code');
  if (code) {
    document.getElementById('orderInput').value = code;
    trackOrder();
  } else if (Auth.isLoggedIn()) {
    loadMyOrders();
  }
});

// ── Sipariş sorgula ─────────────────────────────────────────
async function trackOrder() {
  const code = document.getElementById('orderInput').value.trim().toUpperCase();
  if (!code) { showToast('Sipariş numarası girin.', true); return; }

  hide('orderResult'); hide('myOrders'); hide('trackError');
  show('trackLoading');

  const r = Auth.isLoggedIn() ? await OrderAPI.get(code) : await OrderAPI.track(code);
  hide('trackLoading');

  if (!r.ok) {
    document.getElementById('trackErrorMsg').textContent =
      r.data.message || 'Sipariş bulunamadı. Lütfen numarayı kontrol edin.';
    show('trackError');
    return;
  }

  renderOrder(r.data.data.order, r.data.data.items || []);
  show('orderResult');
  document.getElementById('orderResult').scrollIntoView({ behavior:'smooth', block:'start' });
}

// ── Sipariş render ───────────────────────────────────────────
function renderOrder(o, items) {
  const st   = STATUS_MAP[o.status] || STATUS_MAP.pending;
  const date = o.created_at ? new Date(o.created_at).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' }) : '';

  // Özet
  document.getElementById('resCode').textContent   = o.order_code;
  document.getElementById('resDate').textContent   = date + ' tarihli sipariş';
  document.getElementById('resTotal').textContent  = '₺' + Number(o.total_amount).toLocaleString('tr-TR', {minimumFractionDigits:2});
  document.getElementById('resCargo').textContent  = CARGO_MAP[o.cargo_type] || 'Standart';
  const badge = document.getElementById('resStatus');
  badge.textContent  = st.label;
  badge.className    = 'status-badge ' + st.cls;

  // İlerleme
  renderProgress(o.status);

  // Ürünler
  const itemsEl = document.getElementById('orderItems');
  if (items.length === 0) {
    itemsEl.innerHTML = '<p style="color:var(--muted);font-size:14px;">Ürün bilgisi bulunamadı.</p>';
  } else {
    itemsEl.innerHTML = items.map(i => `
      <div class="order-item-row">
        <div class="oi-emoji">${escHtml(i.product_emoji || '📦')}</div>
        <div class="oi-info">
          <div class="oi-name">${escHtml(i.product_name)}</div>
          <div class="oi-meta">${escHtml([i.size ? 'Beden: '+i.size : '', i.color ? 'Renk: '+i.color : ''].filter(Boolean).join(' · ') || 'Standart')}</div>
        </div>
        <div>
          <div class="oi-price">₺${Number(i.unit_price * i.quantity).toLocaleString('tr-TR',{minimumFractionDigits:2})}</div>
          <div class="oi-qty">${Number(i.quantity)} adet × ₺${Number(i.unit_price).toLocaleString('tr-TR',{minimumFractionDigits:2})}</div>
        </div>
      </div>`).join('');
  }

  // Adres
  document.getElementById('orderAddress').innerHTML = o.address_id
    ? `<strong>Teslimat Adresi</strong>Adres bilgisi sipariş detayında mevcuttur.`
    : `<strong>Teslimat Adresi</strong><span style="color:var(--muted)">Adres bilgisi bulunamadı.</span>`;

  // Ödeme özeti
  const disc = Number(o.discount_amount || 0);
  document.getElementById('orderPayment').innerHTML = `
    <div class="payment-row"><span>Ara Toplam</span><span>₺${Number(o.subtotal).toLocaleString('tr-TR',{minimumFractionDigits:2})}</span></div>
    ${disc > 0 ? `<div class="payment-row discount"><span>İndirim${o.coupon_code ? ' (' + escHtml(o.coupon_code) + ')' : ''}</span><span>−₺${disc.toLocaleString('tr-TR',{minimumFractionDigits:2})}</span></div>` : ''}
    <div class="payment-row"><span>Kargo</span><span>${Number(o.cargo_fee||0) === 0 ? 'Ücretsiz' : '₺' + Number(o.cargo_fee).toLocaleString('tr-TR',{minimumFractionDigits:2})}</span></div>
    <div class="payment-row"><span>Toplam</span><span>₺${Number(o.total_amount).toLocaleString('tr-TR',{minimumFractionDigits:2})}</span></div>`;

  // Aksiyonlar
  const bar = document.getElementById('orderActionsBar');
  bar.innerHTML = '';
  if (['pending','preparing'].includes(o.status)) {
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-danger';
    cancelBtn.textContent = '✕ Siparişi İptal Et';
    cancelBtn.onclick = () => cancelOrder(o.order_code, cancelBtn);
    bar.appendChild(cancelBtn);
  }
  if (o.status === 'delivered') {
    const reviewBtn = document.createElement('button');
    reviewBtn.className = 'btn-outline';
    reviewBtn.textContent = '⭐ Değerlendir';
    reviewBtn.onclick = () => showToast('Değerlendirme özelliği yakında!');
    bar.appendChild(reviewBtn);
  }
  const profileBtn = document.createElement('a');
  profileBtn.href = 'hesabim.html?tab=siparisler';
  profileBtn.className = 'btn-outline';
  profileBtn.textContent = '← Tüm Siparişlerim';
  bar.appendChild(profileBtn);
}

// ── İlerleme Çubuğu ─────────────────────────────────────────
function renderProgress(status) {
  if (status === 'cancelled') {
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressSteps').innerHTML = `<div class="p-step cancelled">✕</div>`;
    document.getElementById('stepLabels').innerHTML = `<span class="active">İptal Edildi</span>`;
    return;
  }
  const idx      = STEPS.findIndex(s => s.key === status);
  const pct      = idx === -1 ? 0 : (idx / (STEPS.length - 1)) * 100;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressSteps').innerHTML = STEPS.map((s, i) => {
    const cls = i < idx ? 'done' : i === idx ? 'active' : '';
    return `<div class="p-step ${cls}">${i < idx ? '✓' : s.emoji}</div>`;
  }).join('');
  document.getElementById('stepLabels').innerHTML = STEPS.map((s, i) => {
    const cls = i < idx ? 'done' : i === idx ? 'active' : '';
    return `<span class="${cls}">${s.label}</span>`;
  }).join('');
}

// ── Sipariş iptal ────────────────────────────────────────────
async function cancelOrder(code, btn) {
  if (!confirm('Siparişi iptal etmek istediğinizden emin misiniz?')) return;
  btn.disabled = true; btn.textContent = 'İptal ediliyor...';
  const r = await OrderAPI.cancel(code);
  if (r.ok) {
    showToast('Sipariş iptal edildi.');
    setTimeout(() => trackOrder(), 1000);
  } else {
    showToast(r.data.message || 'İptal başarısız.', true);
    btn.disabled = false; btn.textContent = '✕ Siparişi İptal Et';
  }
}

// ── Hesabımdan siparişleri göster ───────────────────────────
async function loadMyOrders() {
  const r = await OrderAPI.list({ page:1 });
  if (!r.ok || !r.data.data?.items?.length) return;
  const orders = r.data.data.items;
  const st = STATUS_MAP;
  const myOrdersList = document.getElementById('myOrdersList');
  myOrdersList.innerHTML = '';
  orders.slice(0,5).forEach(o => {
    const card = document.createElement('div');
    card.className = 'order-mini-card';
    card.addEventListener('click', () => selectOrder(o.order_code));
    card.innerHTML = `
      <div>
        <div class="omc-code">${escHtml(o.order_code)}</div>
        <div class="omc-date">${o.created_at ? new Date(o.created_at).toLocaleDateString('tr-TR') : ''}</div>
      </div>
      <span class="status-badge ${escHtml((st[o.status]||st.pending).cls)}" style="font-size:12px;padding:4px 12px;">${escHtml((st[o.status]||st.pending).label)}</span>
      <div class="omc-total">₺${Number(o.total_amount).toLocaleString('tr-TR',{minimumFractionDigits:2})}</div>
      <div class="omc-arrow">›</div>`;
    myOrdersList.appendChild(card);
  });
  show('myOrders');
}

function selectOrder(code) {
  document.getElementById('orderInput').value = code;
  trackOrder();
  window.scrollTo({ top: 0, behavior:'smooth' });
}

// ── Helpers ──────────────────────────────────────────────────
function show(id) { document.getElementById(id).style.display = ''; }
function hide(id) { document.getElementById(id).style.display = 'none'; }
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.querySelector('span').textContent = msg;
  t.querySelector('svg').style.color = isError ? '#e63946' : '#22c55e';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

document.getElementById('orderInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') trackOrder();
});
