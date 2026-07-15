// ============================================================
//  MODAICA — Checkout JS  (odeme.html ile uyumlu)
// ============================================================
const checkout = (function () {

  const API_BASE = (function () {
    const h = window.location.hostname;
    const p = window.location.port ? ':' + window.location.port : '';
    return 'http://' + (h === 'localhost' || h === '127.0.0.1' ? h + p : 'localhost:8080') + '/modaica/backend/api';
  })();
  const TOKEN = localStorage.getItem('modaica_token') || '';

  let cartItems      = [];
  let subtotal       = 0;
  let selectedAddr   = null;
  let savedAddresses = [];
  let shipping       = 'standard';
  let payment        = 'card';
  let couponCode     = '';
  let couponDiscount = 0;
  const SHIPPING_FEES = { standard: 39.90, fast: 59.90, sameday: 99.90 };

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmt(n) {
    return parseFloat(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── INIT ──────────────────────────────────────────────────
  async function init() {
    // Sepet verisini localStorage'dan oku
    try {
      const data = JSON.parse(localStorage.getItem('modaica_checkout') || 'null');
      if (data?.items?.length) {
        cartItems = data.items;
        subtotal  = data.subtotal || cartItems.reduce((s, i) => s + (i.price || i.product_price || 0) * (i.quantity || 1), 0);
      } else {
        const raw = JSON.parse(localStorage.getItem('modaica_cart') || '[]');
        cartItems = raw;
        subtotal  = raw.reduce((s, i) => s + (i.product_price || i.price || 0) * (i.quantity || 1), 0);
      }
    } catch {}

    if (!cartItems.length) { window.location.href = 'sepet.html'; return; }

    renderSummary();
    renderShipping();
    setupCardPreview();
    await loadAddresses();
  }

  // ── ÖZET PANEL ────────────────────────────────────────────
  function renderSummary() {
    const el = document.getElementById('summaryItems');
    if (el) el.innerHTML = cartItems.map(i => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:28px;width:36px;text-align:center;">${esc(i.emoji || i.product_emoji || '📦')}</span>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${esc(i.name || i.product_name)}</div>
          <div style="font-size:12px;color:var(--muted);">${i.quantity || 1} adet${i.size ? ' · ' + esc(i.size) : ''}</div>
        </div>
        <strong style="font-size:13px;">₺${fmt((i.price || i.product_price || 0) * (i.quantity || 1))}</strong>
      </div>`).join('');
    updateTotal();
  }

  function updateTotal() {
    const fee   = SHIPPING_FEES[shipping] || 39.90;
    const cargo = subtotal >= 750 && shipping === 'standard' ? 0 : fee;
    const disc  = couponDiscount > 0 ? subtotal * couponDiscount / 100 : 0;
    const total = subtotal - disc + cargo;

    const rows = document.getElementById('summaryRows');
    if (rows) rows.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;color:var(--muted);">
        <span>Ara Toplam</span><span>₺${fmt(subtotal)}</span>
      </div>
      ${disc > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;color:#166834;">
        <span>Kupon İndirimi</span><span>-₺${fmt(disc)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;color:var(--muted);">
        <span>Kargo</span><span>${cargo === 0 ? '🎉 Ücretsiz' : '₺' + fmt(cargo)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;padding:10px 0;border-top:2px solid var(--border);margin-top:4px;color:var(--primary);">
        <span>Toplam</span><span>₺${fmt(total)}</span>
      </div>`;
  }

  // ── ADIM GEÇİŞ ────────────────────────────────────────────
  function goStep(n) {
    // Adım 1'den 2'ye geçerken adres kontrolü
    if (n === 2 && !selectedAddr) {
      // Seçili adres yoksa manuel adresi al
      const name  = document.getElementById('addr-name')?.value.trim();
      const city  = document.getElementById('addr-city')?.value;
      const line  = document.getElementById('addr-line')?.value.trim();
      if (!name || !city || !line) {
        showAlert('Lütfen teslimat adresinizi girin veya kayıtlı bir adres seçin.'); return;
      }
      selectedAddr = { id: 0, full_name: name, city, district: document.getElementById('addr-district')?.value || '', address_line: line, title: document.getElementById('addr-title')?.value || 'Adresim' };
    }

    [1,2,3,4].forEach(i => {
      const s = document.getElementById(`step-${i}`);
      if (s) s.style.display = i === n ? '' : 'none';
      const b = document.getElementById(`step-bar-${i}`);
      if (b) b.className = i < n ? 'step done' : i === n ? 'step active' : 'step pending';
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateTotal();
    updateSummaryBtn();
  }

  function nextStep() {
    const cur = getCurrentStep() || 1;
    goStep(Math.min(4, cur + 1));
  }

  // Sağ paneldeki "Devam Et" — adıma göre akıllı davranış
  function summaryNext() {
    const cur = getCurrentStep() || 1;
    if (cur === 3) {
      // Adım 3 ödeme: direkt siparişi ver
      placeOrder();
    } else {
      goStep(Math.min(4, cur + 1));
    }
  }

  // Sağ panel buton metnini güncelle
  function updateSummaryBtn() {
    const btn = document.getElementById('summaryNextBtn');
    if (!btn) return;
    const cur = getCurrentStep() || 1;
    if (cur === 3) {
      btn.textContent = '🔒 Ödemeyi Tamamla';
      btn.style.background = '#166834';
    } else {
      btn.textContent = 'Devam Et →';
      btn.style.background = '';
    }
  }

  function getCurrentStep() {
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById(`step-${i}`);
      if (el && el.style.display !== 'none') return i;
    }
    return 1;
  }

  // ── ADRES ─────────────────────────────────────────────────
  async function loadAddresses() {
    try {
      const r = await fetch(`${API_BASE}/users/addresses`, {
        headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const d = await r.json();
      if (d.success) { savedAddresses = d.data.addresses || []; }
    } catch {}
    renderAddresses();
    loadCities();
  }

  function renderAddresses() {
    const el = document.getElementById('addr-list');
    if (!el) return;
    if (!savedAddresses.length) {
      // Adres yoksa formu otomatik aç
      const form = document.getElementById('new-addr-form');
      if (form) form.style.display = 'block';
      return;
    }
    el.innerHTML = savedAddresses.map((a, i) => `
      <label class="addr-card ${i === 0 ? 'selected' : ''}" onclick="checkout.selectSavedAddr(${a.id}, this)">
        <strong style="font-size:13px;">${esc(a.title)} ${a.is_default ? '<span style="background:var(--primary);color:white;font-size:10px;padding:1px 7px;border-radius:5px;">Varsayılan</span>' : ''}</strong>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">${esc(a.full_name)} · ${esc(a.phone || '')}</div>
        <div style="font-size:12px;color:var(--muted);">${esc(a.address_line)}, ${esc(a.district)} / ${esc(a.city)}</div>
      </label>`).join('');
    selectSavedAddr(savedAddresses[0].id, null);
  }

  function selectSavedAddr(id, el) {
    document.querySelectorAll('.addr-card').forEach(c => c.classList.remove('selected'));
    el?.classList.add('selected');
    selectedAddr = savedAddresses.find(a => a.id === id) || null;
  }

  function toggleNewAddrForm() {
    const f = document.getElementById('new-addr-form');
    if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
  }

  async function saveAddress() {
    const title = document.getElementById('addr-title')?.value.trim() || 'Ev';
    const name  = document.getElementById('addr-name')?.value.trim();
    const phone = document.getElementById('addr-phone')?.value.trim();
    const city  = document.getElementById('addr-city')?.value;
    const dist  = document.getElementById('addr-district')?.value;
    const line  = document.getElementById('addr-line')?.value.trim();
    if (!name || !city || !line) { showAlert('Ad Soyad, il ve adres zorunludur.'); return; }

    const addr = { id: Date.now(), title, full_name: name, phone: phone || '', city, district: dist || '', address_line: line };

    // API'ye kaydetmeyi dene
    try {
      const r = await fetch(`${API_BASE}/users/addresses`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, full_name: name, phone, city, district: dist, address_line: line }),
      });
      const d = await r.json();
      if (d.success && d.data?.id) addr.id = d.data.id;
    } catch {}

    savedAddresses.push(addr);
    selectedAddr = addr;
    document.getElementById('new-addr-form').style.display = 'none';
    renderAddresses();
    // Yeni eklenen adresi seç
    selectSavedAddr(addr.id, document.querySelector('.addr-card:last-child'));
  }

  async function loadCities() {
    const cities = ['Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya','Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Düzce','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Iğdır','Isparta','İstanbul','İzmir','Kahramanmaraş','Karabük','Karaman','Kars','Kastamonu','Kayseri','Kilis','Kırıkkale','Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa','Mardin','Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye','Rize','Sakarya','Samsun','Şanlıurfa','Siirt','Sinop','Şırnak','Sivas','Tekirdağ','Tokat','Trabzon','Tunceli','Uşak','Van','Yalova','Yozgat','Zonguldak'];
    const sel = document.getElementById('addr-city');
    if (sel) sel.innerHTML = '<option value="">İl seçin...</option>' + cities.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }

  function loadDistricts(city) {
    const sel = document.getElementById('addr-district');
    if (!sel || !city) return;
    // Türkiye ilçeleri (basit liste)
    const dist = {
      'İstanbul': ['Adalar','Arnavutköy','Ataşehir','Avcılar','Bağcılar','Bahçelievler','Bakırköy','Başakşehir','Bayrampaşa','Beşiktaş','Beykoz','Beylikdüzü','Beyoğlu','Büyükçekmece','Çatalca','Çekmeköy','Esenler','Esenyurt','Eyüpsultan','Fatih','Gaziosmanpaşa','Güngören','Kadıköy','Kağıthane','Kartal','Küçükçekmece','Maltepe','Pendik','Sancaktepe','Sarıyer','Silivri','Sultanbeyli','Sultangazi','Şile','Şişli','Tuzla','Ümraniye','Üsküdar','Zeytinburnu'],
      'Ankara': ['Akyurt','Altındağ','Ayaş','Balâ','Beypazarı','Çamlıdere','Çankaya','Çubuk','Elmadağ','Etimesgut','Evren','Gölbaşı','Güdül','Haymana','Kalecik','Kahramankazan','Keçiören','Kızılcahamam','Mamak','Nallıhan','Polatlı','Pursaklar','Sincan','Şereflikoçhisar','Yenimahalle'],
      'İzmir': ['Aliağa','Balçova','Bayındır','Bayraklı','Bergama','Beydağ','Bornova','Buca','Çeşme','Çiğli','Dikili','Foça','Gaziemir','Güzelbahçe','Karabağlar','Karaburun','Karşıyaka','Kemalpaşa','Kınık','Kiraz','Konak','Menderes','Menemen','Narlıdere','Ödemiş','Seferihisar','Selçuk','Tire','Torbalı','Urla'],
    };
    const list = dist[city] || ['Merkez', 'Diğer'];
    sel.innerHTML = '<option value="">İlçe seçin...</option>' + list.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
  }

  // ── KARGO ─────────────────────────────────────────────────
  function renderShipping() {
    const el = document.getElementById('cargo-options');
    if (!el) return;
    const opts = [
      { id: 'standard', label: 'Standart Kargo',     sub: '2–4 iş günü',     price: subtotal >= 750 ? 0 : 39.90,  tag: subtotal >= 750 ? '🎉 Ücretsiz' : '' },
      { id: 'fast',     label: 'Hızlı Teslimat',      sub: 'Yarın teslim',    price: 59.90 },
      { id: 'sameday',  label: 'Aynı Gün Teslimat',   sub: 'Bugün kapınızda', price: 99.90 },
    ];
    el.innerHTML = opts.map((o, i) => `
      <label class="addr-card ${i === 0 ? 'selected' : ''}" style="display:flex;align-items:center;gap:14px;cursor:pointer;"
             onclick="checkout.selectShipping('${o.id}', this)">
        <input type="radio" name="cargo" value="${o.id}" ${i === 0 ? 'checked' : ''} style="accent-color:var(--primary);">
        <div style="flex:1;">
          <div style="font-weight:700;font-size:13px;">${esc(o.label)}</div>
          <div style="font-size:12px;color:var(--muted);">${esc(o.sub)}</div>
        </div>
        <strong style="color:var(--primary);font-size:14px;">${o.tag || '₺' + fmt(o.price)}</strong>
      </label>`).join('');
  }

  function selectShipping(val, el) {
    shipping = val;
    document.querySelectorAll('#cargo-options .addr-card').forEach(c => c.classList.remove('selected'));
    el?.classList.add('selected');
    updateTotal();
  }

  // ── ÖDEME ─────────────────────────────────────────────────
  function selectPayment(method, el) {
    payment = method;
    document.querySelectorAll('.pm-btn').forEach(b => b.classList.remove('selected'));
    el?.classList.add('selected');
    document.getElementById('card-form').style.display     = method === 'card'     ? '' : 'none';
    document.getElementById('transfer-info').style.display = method === 'transfer' ? '' : 'none';
    document.getElementById('cash-info').style.display     = method === 'cash'     ? '' : 'none';
    updateTotal();
  }

  // ── KAYITLI KART ─────────────────────────────────────────
  function loadSavedCards() {
    let cards = [];
    try { cards = JSON.parse(localStorage.getItem('modaica_saved_cards') || '[]'); } catch {}
    if (!cards.length) return;

    const form = document.getElementById('card-form');
    if (!form) return;

    const wrap = document.createElement('div');
    wrap.id = 'savedCardsWrap';
    wrap.style.cssText = 'margin-bottom:16px;';
    wrap.innerHTML = `
      <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--primary);">💳 Kayıtlı Kartlarım</div>
      ${cards.map((c, i) => `
        <label style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:2px solid ${i===0?'var(--primary)':'var(--border)'};border-radius:10px;cursor:pointer;margin-bottom:8px;transition:border .2s;"
               id="savedCard-${i}" onclick="checkout.useSavedCard(${i})">
          <input type="radio" name="savedCard" value="${i}" ${i===0?'checked':''} style="accent-color:var(--primary);">
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;">${maskCardNum(c.num)}</div>
            <div style="font-size:12px;color:var(--muted);">${esc(c.name)} · ${esc(c.exp)}</div>
          </div>
          <span style="font-size:20px;">${getCardBrand(c.num)}</span>
          <button onclick="event.stopPropagation();checkout.deleteSavedCard(${i})"
                  style="background:none;border:none;cursor:pointer;color:#e63946;font-size:16px;padding:4px;">🗑</button>
        </label>`).join('')}
      <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:2px dashed var(--border);border-radius:10px;cursor:pointer;font-size:13px;color:var(--muted);"
             onclick="checkout.useNewCard()">
        <input type="radio" name="savedCard" value="new"> + Yeni kart ile öde
      </label>
      <div id="newCardSection" style="display:none;margin-top:12px;">`;

    // Mevcut kart formunu wrap içine taşı
    const existingForm = form.querySelector('.form-grid');
    if (existingForm) {
      wrap.querySelector('#newCardSection')?.appendChild(existingForm.cloneNode(true));
    }
    wrap.querySelector('#newCardSection')?.insertAdjacentHTML('beforeend', '</div>');

    form.insertBefore(wrap, form.firstChild);

    // İlk kayıtlı kartı otomatik doldur
    if (cards.length) useSavedCard(0);
  }

  function maskCardNum(num) {
    const clean = String(num).replace(/\s/g, '');
    return clean.slice(0, 4) + ' **** **** ' + clean.slice(-4);
  }

  function getCardBrand(num) {
    const n = String(num).replace(/\s/g, '');
    if (n.startsWith('4')) return '💳 Visa';
    if (n.startsWith('5')) return '💳 MC';
    if (n.startsWith('3')) return '💳 Amex';
    return '💳';
  }

  function useSavedCard(index) {
    let cards = [];
    try { cards = JSON.parse(localStorage.getItem('modaica_saved_cards') || '[]'); } catch {}
    const c = cards[index];
    if (!c) return;

    // Kart formunu doldur
    const numEl  = document.getElementById('cardNum');
    const nameEl = document.getElementById('cardName');
    const expEl  = document.getElementById('cardExp');
    const cvvEl  = document.getElementById('cardCvv');

    if (numEl)  { numEl.value  = c.num.replace(/(.{4})/g,'$1 ').trim(); numEl.dispatchEvent(new Event('input')); }
    if (nameEl) { nameEl.value = c.name; nameEl.dispatchEvent(new Event('input')); }
    if (expEl)  { expEl.value  = c.exp;  expEl.dispatchEvent(new Event('input')); }
    if (cvvEl)  { cvvEl.value  = ''; cvvEl.placeholder = '***'; }

    // Seçim vurgusu
    document.querySelectorAll('[id^="savedCard-"]').forEach((el, i) => {
      el.style.borderColor = i === index ? 'var(--primary)' : 'var(--border)';
    });

    // Form alanlarını devre dışı bırak (kayıtlı kart seçildi)
    [numEl, nameEl, expEl].forEach(el => { if (el) el.readOnly = true; });
    if (cvvEl) cvvEl.readOnly = false; // CVV her zaman girilmeli
  }

  function useNewCard() {
    const numEl  = document.getElementById('cardNum');
    const nameEl = document.getElementById('cardName');
    const expEl  = document.getElementById('cardExp');
    const cvvEl  = document.getElementById('cardCvv');
    [numEl, nameEl, expEl, cvvEl].forEach(el => {
      if (el) { el.value = ''; el.readOnly = false; el.placeholder = el.id === 'cardNum' ? '0000 0000 0000 0000' : el.id === 'cardName' ? 'AD SOYAD' : el.id === 'cardExp' ? 'AA/YY' : '•••'; }
    });
    const cpNum = document.getElementById('cpNum');
    const cpName = document.getElementById('cpName');
    const cpExp = document.getElementById('cpExp');
    if (cpNum)  cpNum.textContent  = '•••• •••• •••• ••••';
    if (cpName) cpName.textContent = 'AD SOYAD';
    if (cpExp)  cpExp.textContent  = 'AA/YY';
    document.querySelectorAll('[id^="savedCard-"]').forEach(el => el.style.borderColor = 'var(--border)');
  }

  function deleteSavedCard(index) {
    if (!confirm('Bu kartı silmek istediğinizden emin misiniz?')) return;
    let cards = [];
    try { cards = JSON.parse(localStorage.getItem('modaica_saved_cards') || '[]'); } catch {}
    cards.splice(index, 1);
    localStorage.setItem('modaica_saved_cards', JSON.stringify(cards));
    // Wrap'ı yenile
    document.getElementById('savedCardsWrap')?.remove();
    if (cards.length) loadSavedCards();
    else useNewCard();
  }

  function saveCardIfChecked(num, name, exp) {
    const checkbox = document.getElementById('saveCard');
    if (!checkbox?.checked) return;

    let cards = [];
    try { cards = JSON.parse(localStorage.getItem('modaica_saved_cards') || '[]'); } catch {}

    // Aynı kart zaten kayıtlıysa ekleme
    const clean = num.replace(/\s/g,'');
    if (cards.some(c => c.num.replace(/\s/g,'') === clean)) return;

    cards.unshift({ num: clean, name, exp, savedAt: new Date().toISOString() });
    localStorage.setItem('modaica_saved_cards', JSON.stringify(cards.slice(0, 5))); // max 5 kart
  }

  function setupCardPreview() {
    loadSavedCards(); // Kayıtlı kartları yükle

    const num  = document.getElementById('cardNum');
    const name = document.getElementById('cardName');
    const exp  = document.getElementById('cardExp');

    num?.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '').slice(0, 16);
      this.value = v.replace(/(.{4})/g, '$1 ').trim();
      const display = v.padEnd(16, '•').replace(/(.{4})/g, '$1 ').trim();
      const cpNum = document.getElementById('cpNum');
      if (cpNum) cpNum.textContent = display;
      // Kart logosu
      const preview = document.getElementById('cardPreview');
      if (preview) {
        if (v.startsWith('4'))      preview.style.background = 'linear-gradient(135deg,#1a1f5e,#2d3aaa)';
        else if (v.startsWith('5')) preview.style.background = 'linear-gradient(135deg,#1c1c2e,#e63946)';
        else if (v.startsWith('3')) preview.style.background = 'linear-gradient(135deg,#92400e,#f4a226)';
        else                        preview.style.background = 'linear-gradient(135deg,#166834,#22c55e)';
      }
    });

    name?.addEventListener('input', function () {
      const el = document.getElementById('cpName');
      if (el) el.textContent = this.value.toUpperCase() || 'AD SOYAD';
    });

    exp?.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
      this.value = v;
      const el = document.getElementById('cpExp');
      if (el) el.textContent = v || 'AA/YY';
    });
  }

  // ── KUPON ─────────────────────────────────────────────────
  async function applyCoupon() {
    // Boşluk ve Türkçe karakter normalizasyonu
    const raw  = (document.getElementById('couponCode')?.value || '').trim();
    const code = raw.toUpperCase()
      .replace(/\s+/g, '')           // boşlukları kaldır
      .replace(/İ/g, 'I')            // Türkçe İ → I
      .replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S')
      .replace(/Ö/g, 'O').replace(/Ç/g, 'C');
    if (!code) return;

    // Demo kuponlar (normalize edilmiş haliyle)
    const demoCoupons = {
      'YENISEZON':  15,
      'HOSGELDIN20': 20,
      'TECH10':     10,
      'BEAUTY15':   15,
      'SPORLA':     12,
      'KARGO0':      0,  // ücretsiz kargo
    };
    let pct = demoCoupons[code] ?? -1;
    if (pct === -1) pct = 0;

    // API kontrolü
    if (!pct) {
      try {
        const r = await fetch(`${API_BASE}/coupons/check?code=${code}&subtotal=${subtotal}`, {
          headers: { 'Authorization': 'Bearer ' + TOKEN }, credentials: 'include'
        });
        const d = await r.json();
        if (d.success) pct = d.data.discount_pct || 0;
      } catch {}
    }

    if (!pct) {
      // API kontrolü
      try {
        const r = await fetch(`${API_BASE}/coupons/check?code=${encodeURIComponent(raw)}&subtotal=${subtotal}`, {
          headers: { 'Authorization': 'Bearer ' + TOKEN }, credentials: 'include'
        });
        const d = await r.json();
        if (d.success) pct = d.data?.discount_pct || 0;
      } catch {}
    }
    if (!pct) { showAlert('Geçersiz veya süresi dolmuş kupon kodu.'); return; }

    const disc = subtotal * pct / 100;
    couponCode = raw.toUpperCase(); couponDiscount = pct;
    document.getElementById('couponRow').style.display = 'none';
    document.getElementById('couponApplied').style.display = 'flex';
    document.getElementById('couponAppliedText').textContent = `%${pct} indirim — -₺${fmt(disc)} tasarruf ettiniz!`;
    updateTotal();
  }

  function removeCoupon() {
    couponCode = ''; couponDiscount = 0;
    document.getElementById('couponRow').style.display = '';
    document.getElementById('couponApplied').style.display = 'none';
    document.getElementById('couponCode').value = '';
    updateTotal();
  }

  // ── SİPARİŞ VER ───────────────────────────────────────────
  async function placeOrder() {
    if (payment === 'card') {
      const num  = document.getElementById('cardNum')?.value.replace(/\s/g, '') || '';
      const name = document.getElementById('cardName')?.value.trim() || '';
      const exp  = document.getElementById('cardExp')?.value || '';
      const cvv  = document.getElementById('cardCvv')?.value || '';
      if (num.length < 16) { showCardAlert('Geçerli bir kart numarası girin.'); return; }
      if (!name)            { showCardAlert('Kart üzerindeki adı girin.'); return; }
      if (exp.length < 5)   { showCardAlert('Geçerli son kullanma tarihi girin.'); return; }
      if (cvv.length < 3)   { showCardAlert('CVV giriniz.'); return; }
      hideCardAlert();
    }

    const btn = document.getElementById('placeOrderBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Ödeme işleniyor...'; }

    // ── Sanal POS Simülasyonu ──────────────────────────────
    show3DSecure();
    await sleep(3000); // 3D Secure animasyonu
    hide3DSecure();

    let orderCode = null;

    // Gerçek API'ye dene
    try {
      const r = await fetch(`${API_BASE}/cart/checkout`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          coupon_code: couponCode || undefined,
          cargo_type: shipping,
          address_id: typeof selectedAddr === 'object' ? undefined : selectedAddr,
          payment_method: payment,
        })
      });
      const d = await r.json();
      if (d.success && d.data?.order_code) orderCode = d.data.order_code;
    } catch {}

    // Demo sipariş
    if (!orderCode) {
      const ts = Date.now();
      orderCode = 'MDC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(ts).slice(-6);
      const addr = typeof selectedAddr === 'object' ? selectedAddr : savedAddresses.find(a => a.id === selectedAddr);
      const user = JSON.parse(localStorage.getItem('modaica_user') || '{}');
      const demoOrder = {
        order_code: orderCode, status: 'pending',
        total_amount: getTotal(),
        items: cartItems.map(i => ({ product_name: i.name || i.product_name, product_emoji: i.emoji || i.product_emoji || '📦', product_price: i.price || i.product_price || 0, quantity: i.quantity || 1 })),
        created_at: new Date().toISOString(),
        address: addr, email: user.email || '',
      };
      try {
        const prev = JSON.parse(localStorage.getItem('modaica_demo_orders') || '[]');
        prev.unshift(demoOrder); localStorage.setItem('modaica_demo_orders', JSON.stringify(prev));
      } catch {}
    }

    // Sepeti temizle
    localStorage.setItem('modaica_cart', '[]');
    localStorage.removeItem('modaica_checkout');

    if (btn) { btn.disabled = false; btn.innerHTML = '🔒 Siparişi Onayla'; }

    showSuccess(orderCode);
  }

  function getTotal() {
    const fee   = SHIPPING_FEES[shipping] || 39.90;
    const cargo = subtotal >= 750 && shipping === 'standard' ? 0 : fee;
    const disc  = couponDiscount > 0 ? subtotal * couponDiscount / 100 : 0;
    return subtotal - disc + cargo;
  }

  function showSuccess(orderCode) {
    const codeEl = document.getElementById('successCode');
    if (codeEl) codeEl.textContent = orderCode;
    const trackEl = document.getElementById('trackLink');
    if (trackEl) trackEl.href = `siparis-takip.html?code=${orderCode}`;

    const addr = typeof selectedAddr === 'object' ? selectedAddr : savedAddresses.find(a => a.id === selectedAddr);
    const user = JSON.parse(localStorage.getItem('modaica_user') || '{}');
    const det = document.getElementById('successDetail');
    if (det) {
      det.innerHTML = `
        <div style="background:#f8f9fc;border-radius:12px;padding:16px 20px;margin:16px 0;text-align:left;font-size:13px;">
          <div style="font-weight:700;color:var(--primary);margin-bottom:12px;font-size:14px;">📋 Sipariş Detayları</div>
          ${user.email ? `<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;min-width:110px;">E-posta</span><span style="font-weight:600;">${esc(user.email)}</span></div>` : ''}
          ${addr ? `<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;min-width:110px;">Teslimat Adresi</span><span style="font-weight:600;">${esc((addr.full_name || '') + ' · ' + (addr.address_line || '') + ', ' + (addr.district || '') + '/' + (addr.city || ''))}</span></div>` : ''}
          <div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;min-width:110px;">Ödeme Yöntemi</span><span style="font-weight:600;">${payment === 'card' ? '💳 Kredi Kartı' : payment === 'transfer' ? '🏦 Havale/EFT' : '💵 Kapıda Ödeme'}</span></div>
          <div style="display:flex;gap:8px;padding:8px 0;"><span style="color:#6b7280;min-width:110px;">Toplam</span><span style="font-weight:800;color:var(--primary);font-size:15px;">₺${fmt(getTotal())}</span></div>
        </div>`;
      det.style.display = 'block';
    }

    goStep(4);
  }

  // ── 3D SECURE OVERLAY ─────────────────────────────────────
  function show3DSecure() {
    const overlay = document.createElement('div');
    overlay.id = 'secureOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:white;border-radius:20px;padding:40px 48px;text-align:center;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3);">
        <div style="font-size:48px;margin-bottom:16px;">🔐</div>
        <div style="font-size:17px;font-weight:700;margin-bottom:6px;color:#1a1f5e;">3D Secure Doğrulama</div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:24px;">Ödemeniz güvenli biçimde işleniyor...</div>
        <div style="background:#f1f5f9;border-radius:10px;height:8px;overflow:hidden;margin-bottom:20px;">
          <div id="secureBar" style="background:linear-gradient(90deg,#1a1f5e,#2d3aaa);height:100%;width:0%;transition:width 2.8s ease;border-radius:10px;"></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;color:#6b7280;">
          <div style="width:8px;height:8px;border-radius:50%;background:#22c55e;animation:blink 1s infinite;"></div>
          <span id="secureStatus">Banka bağlantısı kuruluyor...</span>
        </div>
        <style>@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}</style>
      </div>`;
    document.body.appendChild(overlay);
    // Animasyon
    requestAnimationFrame(() => {
      document.getElementById('secureBar').style.width = '100%';
    });
    const msgs = ['Kart doğrulanıyor...', 'Banka onayı bekleniyor...', '3D Secure tamamlandı ✓'];
    let i = 0;
    const interval = setInterval(() => {
      const el = document.getElementById('secureStatus');
      if (el && msgs[i]) el.textContent = msgs[i++];
      if (i >= msgs.length) clearInterval(interval);
    }, 900);
  }

  function hide3DSecure() {
    document.getElementById('secureOverlay')?.remove();
  }

  // ── YARDIMCILAR ──────────────────────────────────────────
  function showAlert(msg) {
    const el = document.getElementById('card-alert');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
    else alert(msg);
  }
  function showCardAlert(msg) { showAlert(msg); }
  function hideCardAlert() {
    const el = document.getElementById('card-alert');
    if (el) el.style.display = 'none';
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { init, goStep, nextStep, summaryNext, selectShipping, selectPayment,
           toggleNewAddrForm, saveAddress, loadDistricts, selectSavedAddr,
           placeOrder, applyCoupon, removeCoupon };
})();

document.addEventListener('DOMContentLoaded', checkout.init);
