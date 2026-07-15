// ============================================================
//  MODAICA — Stok & Fiyat Alarm Widget
//  Kullanım: new StockAlarmWidget('container-id', productSku, productPrice)
// ============================================================
class StockAlarmWidget {
  constructor(containerId, sku, currentPrice, inStock = false) {
    this.container    = document.getElementById(containerId);
    this.sku          = sku;
    this.currentPrice = currentPrice;
    this.inStock      = inStock;
    this.API          = (typeof API_BASE !== 'undefined' ? API_BASE : ('http://' + location.hostname + (location.port ? ':' + location.port : '') + '/modaica/backend')) + '/api';
    this.TOKEN        = localStorage.getItem('modaica_token') || '';
    this.init();
  }

  async init() {
    await this.loadStatus();
    this.render();
  }

  async loadStatus() {
    if (!this.TOKEN) return;
    try {
      // Stok alarmı var mı kontrol et
      const r = await fetch(`${this.API}/stock-alarm`, {
        headers: { 'Authorization': 'Bearer ' + this.TOKEN }
      });
      const d = await r.json();
      if (d.success) {
        this.alarms = d.data.alarms || [];
        this.hasStockAlarm = this.alarms.some(a => a.product_id === this.sku);
        this.hasPriceAlarm = false; // Fiyat alarmları ayrı listeden
      }
    } catch (_) {}
  }

  render() {
    if (!this.container) return;
    const loggedIn = !!this.TOKEN;

    this.container.innerHTML = `
      <style>
        .saw-wrap{border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;font-family:'DM Sans',sans-serif;}
        .saw-stock-btn{width:100%;background:#f8f9fc;border:none;padding:13px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;color:#1c1c2e;transition:background .2s;}
        .saw-stock-btn:hover{background:#f1f5f9;}
        .saw-stock-btn.active{background:#fef9c3;color:#92400e;}
        .saw-stock-btn.set{background:#f0fdf4;color:#166834;}
        .saw-divider{height:1px;background:#e5e7eb;}
        .saw-price-btn{width:100%;background:#f8f9fc;border:none;padding:13px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;color:#1c1c2e;transition:background .2s;}
        .saw-price-btn:hover{background:#f1f5f9;}
        .saw-price-panel{display:none;padding:14px 16px;background:#f8f9fc;border-top:1px solid #e5e7eb;}
        .saw-price-row{display:flex;align-items:center;gap:8px;}
        .saw-price-input{flex:1;border:1.5px solid #e5e7eb;border-radius:9px;padding:9px 12px;font-size:14px;font-family:inherit;outline:none;}
        .saw-price-input:focus{border-color:#1a1f5e;}
        .saw-price-submit{background:#1a1f5e;color:white;border:none;padding:9px 16px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;}
        .saw-msg{font-size:12px;margin-top:7px;padding:7px 10px;border-radius:8px;}
        .saw-msg.success{background:#f0fdf4;color:#166834;}
        .saw-msg.error{background:#fff5f5;color:#e63946;}
        .saw-login-note{font-size:12px;color:#6b7280;padding:10px 16px;text-align:center;}
        .saw-login-note a{color:#2d3aaa;font-weight:600;}
      </style>
      <div class="saw-wrap">
        ${this.inStock ? '' : `
          <button class="saw-stock-btn ${this.hasStockAlarm ? 'set' : ''}" id="saw-stock-btn" onclick="stockAlarm.toggleStockAlarm()">
            <span style="font-size:18px">${this.hasStockAlarm ? '🔔' : '🔕'}</span>
            <span>${this.hasStockAlarm ? 'Stok Alarmı Kuruldu ✓' : 'Stoka Girince Haber Ver'}</span>
          </button>
          <div class="saw-divider"></div>
        `}
        <button class="saw-price-btn" id="saw-price-btn" onclick="stockAlarm.togglePricePanel()">
          <span style="font-size:18px">💰</span>
          <span>Fiyat Düşünce Haber Ver</span>
          <span style="margin-left:auto;color:#6b7280;font-size:18px;" id="saw-price-arrow">›</span>
        </button>
        <div class="saw-price-panel" id="saw-price-panel">
          ${loggedIn ? `
            <div style="font-size:13px;color:#6b7280;margin-bottom:10px;">Hedef fiyatı girin, düşünce e-posta alın.</div>
            <div class="saw-price-row">
              <input class="saw-price-input" id="saw-target-price" type="number" placeholder="Hedef fiyat (₺)" step="0.01" min="1" max="${this.currentPrice * 0.99}">
              <button class="saw-price-submit" onclick="stockAlarm.setPriceAlarm()">Alarm Kur</button>
            </div>
            <div id="saw-price-msg" class="saw-msg" style="display:none;"></div>
          ` : `<div class="saw-login-note"><a href="hesabim.html">Giriş yapın</a> ve fiyat alarmı kurun.</div>`}
        </div>
        ${!loggedIn ? `<div class="saw-login-note"><a href="hesabim.html">Giriş yapın</a> ve alarm kurun.</div>` : ''}
      </div>`;

    window.stockAlarm = this;
  }

  async toggleStockAlarm() {
    if (!this.TOKEN) { window.location.href = 'hesabim.html'; return; }
    const btn = document.getElementById('saw-stock-btn');
    if (this.hasStockAlarm) {
      // Alarmı kaldır
      const r = await fetch(`${this.API}/stock-alarm/${this.sku}`, {
        method: 'DELETE', headers: { 'Authorization': 'Bearer ' + this.TOKEN }
      });
      const d = await r.json();
      if (d.success) {
        this.hasStockAlarm = false;
        btn.className = 'saw-stock-btn';
        btn.innerHTML = '<span style="font-size:18px">🔕</span><span>Stoka Girince Haber Ver</span>';
        this.showToast('Stok alarmı kaldırıldı.');
      }
    } else {
      // Alarm kur
      const r = await fetch(`${this.API}/stock-alarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.TOKEN },
        body: JSON.stringify({ product_id: this.sku })
      });
      const d = await r.json();
      if (d.success) {
        this.hasStockAlarm = true;
        btn.className = 'saw-stock-btn set';
        btn.innerHTML = '<span style="font-size:18px">🔔</span><span>Stok Alarmı Kuruldu ✓</span>';
        this.showToast('🔔 Ürün stoka girince e-posta alacaksınız!');
      } else {
        this.showToast(d.message || 'Hata.', 'error');
      }
    }
  }

  togglePricePanel() {
    const panel = document.getElementById('saw-price-panel');
    const arrow = document.getElementById('saw-price-arrow');
    const open  = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = open ? 'block' : 'none';
    arrow.textContent   = open ? '↓' : '›';
  }

  async setPriceAlarm() {
    if (!this.TOKEN) { window.location.href = 'hesabim.html'; return; }
    const target = parseFloat(document.getElementById('saw-target-price')?.value || 0);
    if (!target || target <= 0)          { this.showPriceMsg('Geçerli bir fiyat girin.', 'error'); return; }
    if (target >= this.currentPrice)     { this.showPriceMsg(`Hedef fiyat mevcut fiyattan (₺${this.fmt(this.currentPrice)}) düşük olmalı.`, 'error'); return; }

    const r = await fetch(`${this.API}/price-alarm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.TOKEN },
      body: JSON.stringify({ product_id: this.sku, target_price: target })
    });
    const d = await r.json();
    this.showPriceMsg(
      d.success ? `✅ ₺${this.fmt(target)} alarmı kuruldu!` : (d.message || 'Hata.'),
      d.success ? 'success' : 'error'
    );
  }

  showPriceMsg(msg, type = 'success') {
    const el = document.getElementById('saw-price-msg');
    if (!el) return;
    el.textContent = msg; el.className = `saw-msg ${type}`; el.style.display = 'block';
  }

  showToast(msg, type = 'success') {
    const existing = document.getElementById('saw-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'saw-toast';
    el.style.cssText = `position:fixed;bottom:24px;right:24px;background:${type==='error'?'#e63946':'#166834'};color:white;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:500;z-index:9999;animation:fadeIn .25s ease;font-family:'DM Sans',sans-serif;`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  fmt(n) { return parseFloat(n||0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
}

// Fiyat alarm API (stok-alarm/api/price-alarm/index.php'ye eklenecek)
// POST /api/price-alarm → { product_id, target_price }
// DELETE /api/price-alarm/{product_id}
// GET /api/price-alarm → Tüm alarmlar

window.StockAlarmWidget = StockAlarmWidget;
