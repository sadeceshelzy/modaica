// ============================================================
//  MODAICA — Ödeme Formu (checkout.js'e entegre et)
// ============================================================

class PaymentForm {
  constructor(containerId, orderId) {
    this.container = document.getElementById(containerId);
    this.orderId   = orderId;
    this.render();
    this.initCardFormatting();
  }

  render() {
    this.container.innerHTML = `
      <div class="payment-form-card">
        <div class="pf-header">
          <h3>💳 Kart Bilgileri</h3>
          <div class="pf-security">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            256-bit SSL güvenli ödeme
          </div>
        </div>

        <!-- Kart Önizleme -->
        <div class="card-preview" id="cardPreview">
          <div class="card-chip">▬▬</div>
          <div class="card-number-preview" id="cardNumPreview">•••• •••• •••• ••••</div>
          <div class="card-bottom">
            <div>
              <div class="card-label">KART SAHİBİ</div>
              <div class="card-holder-preview" id="cardHolderPreview">AD SOYAD</div>
            </div>
            <div>
              <div class="card-label">SON KULLANMA</div>
              <div class="card-exp-preview" id="cardExpPreview">AA/YY</div>
            </div>
          </div>
        </div>

        <div id="paymentError" class="payment-error" style="display:none;"></div>

        <div class="pf-fields">
          <div class="pf-field">
            <label>Kart Numarası</label>
            <input type="text" id="cardNumber" placeholder="0000 0000 0000 0000"
              maxlength="19" inputmode="numeric" autocomplete="cc-number">
            <div class="card-brand" id="cardBrand"></div>
          </div>
          <div class="pf-field">
            <label>Kart Üzerindeki Ad</label>
            <input type="text" id="cardName" placeholder="AD SOYAD"
              autocomplete="cc-name" style="text-transform:uppercase">
          </div>
          <div class="pf-row">
            <div class="pf-field">
              <label>Son Kullanma</label>
              <input type="text" id="cardExpiry" placeholder="AA/YY"
                maxlength="5" inputmode="numeric" autocomplete="cc-exp">
            </div>
            <div class="pf-field">
              <label>CVV</label>
              <div style="position:relative">
                <input type="password" id="cardCvv" placeholder="•••"
                  maxlength="4" inputmode="numeric" autocomplete="cc-csc">
                <span class="cvv-help" title="Kartınızın arkasındaki 3-4 haneli kod">?</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Taksit (opsiyonel) -->
        <div class="installment-section" id="installmentSection" style="display:none;">
          <label>Taksit Seçeneği</label>
          <div class="installment-grid" id="installmentGrid"></div>
        </div>

        <button class="pay-btn" id="payBtn" onclick="paymentForm.pay()">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
          Güvenli Ödeme Yap
        </button>

        <div class="pf-logos">
          <span>VISA</span><span>MC</span><span>AMEX</span><span>Troy</span>
          <span style="margin-left:auto;font-size:11px;color:#6b7280">İyzico ile güvenli</span>
        </div>
      </div>

      <style>
        .payment-form-card{background:white;border-radius:16px;border:1px solid #e5e7eb;padding:24px;}
        .pf-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}
        .pf-header h3{font-size:17px;font-weight:700;color:#1a1f5e;}
        .pf-security{display:flex;align-items:center;gap:5px;font-size:12px;color:#22c55e;font-weight:600;}
        .card-preview{background:linear-gradient(135deg,#1a1f5e,#2d3aaa);border-radius:14px;padding:20px 24px;color:white;margin-bottom:20px;position:relative;overflow:hidden;height:150px;}
        .card-preview::before{content:'';position:absolute;right:-40px;top:-40px;width:200px;height:200px;background:rgba(255,255,255,.06);border-radius:50%;}
        .card-chip{font-size:22px;letter-spacing:2px;margin-bottom:16px;opacity:.8;}
        .card-number-preview{font-size:18px;letter-spacing:3px;margin-bottom:20px;font-family:monospace;}
        .card-bottom{display:flex;gap:32px;}
        .card-label{font-size:9px;opacity:.6;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;}
        .card-holder-preview,.card-exp-preview{font-size:13px;font-weight:600;letter-spacing:.5px;}
        .pf-fields{display:flex;flex-direction:column;gap:14px;}
        .pf-field{display:flex;flex-direction:column;gap:6px;}
        .pf-field label{font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;}
        .pf-field input{border:1.5px solid #e5e7eb;border-radius:10px;padding:12px 14px;font-size:15px;outline:none;transition:border .2s;font-family:monospace;}
        .pf-field input:focus{border-color:#2d3aaa;}
        .pf-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .cvv-help{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:18px;height:18px;border-radius:50%;background:#e5e7eb;font-size:11px;font-weight:700;color:#6b7280;display:flex;align-items:center;justify-content:center;cursor:help;}
        .pay-btn{width:100%;background:linear-gradient(135deg,#166834,#22c55e);color:white;border:none;padding:15px;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;margin-top:20px;transition:opacity .2s;font-family:inherit;}
        .pay-btn:hover{opacity:.92;}
        .pay-btn:disabled{opacity:.6;cursor:not-allowed;}
        .payment-error{background:#fff5f5;border:1px solid #fecaca;color:#e63946;padding:12px 16px;border-radius:10px;font-size:14px;margin-bottom:14px;}
        .pf-logos{display:flex;align-items:center;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid #e5e7eb;}
        .pf-logos span{background:#f8f9fc;border:1px solid #e5e7eb;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;color:#1a1f5e;}
      </style>
    `;
  }

  initCardFormatting() {
    // Kart numarası formatla
    document.getElementById('cardNumber').addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 16);
      e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
      document.getElementById('cardNumPreview').textContent =
        (v + '•'.repeat(16 - v.length)).replace(/(.{4})/g, '$1 ').trim();
      this.detectBrand(v);
    });

    // Kart sahibi
    document.getElementById('cardName').addEventListener('input', e => {
      e.target.value = e.target.value.toUpperCase();
      document.getElementById('cardHolderPreview').textContent = e.target.value || 'AD SOYAD';
    });

    // Son kullanma tarihi
    document.getElementById('cardExpiry').addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2);
      e.target.value = v;
      document.getElementById('cardExpPreview').textContent = v || 'AA/YY';
    });
  }

  detectBrand(num) {
    const brands = {
      visa: /^4/, mastercard: /^5[1-5]/, amex: /^3[47]/, troy: /^9792/
    };
    const labels = { visa: 'VISA', mastercard: 'MC', amex: 'AMEX', troy: 'TROY' };
    const colors = { visa: '#1a1f5e', mastercard: '#e63946', amex: '#166834', troy: '#f4a226' };

    for (const [brand, re] of Object.entries(brands)) {
      if (re.test(num)) {
        const el = document.getElementById('cardBrand');
        if (el) {
          el.textContent = labels[brand];
          el.style.color = colors[brand];
        }
        return;
      }
    }
  }

  async pay() {
    const btn     = document.getElementById('payBtn');
    const errEl   = document.getElementById('paymentError');
    errEl.style.display = 'none';

    const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
    const cardName   = document.getElementById('cardName').value.trim();
    const expiry     = document.getElementById('cardExpiry').value;
    const cvv        = document.getElementById('cardCvv').value;

    // Validasyon
    if (cardNumber.length < 16) { this.showError('Geçerli kart numarası girin.'); return; }
    if (!cardName)               { this.showError('Kart sahibinin adını girin.'); return; }
    if (!expiry.includes('/'))   { this.showError('Son kullanma tarihi formatı: AA/YY'); return; }
    if (cvv.length < 3)          { this.showError('CVV kodu geçersiz.'); return; }

    const [month, year] = expiry.split('/');

    btn.disabled    = true;
    btn.innerHTML   = '<span style="width:20px;height:20px;border:3px solid white;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite;display:inline-block"></span> İşleniyor...';

    try {
      const token = localStorage.getItem('modaica_token') || '';
      const res   = await fetch('/modaica/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          order_id:     this.orderId,
          card_name:    cardName,
          card_number:  cardNumber,
          expire_month: month.padStart(2,'0'),
          expire_year:  '20' + year,
          cvc:          cvv,
        }),
      });
      const data = await res.json();

      if (data.success) {
        // Başarı animasyonu
        btn.innerHTML = '✅ Ödeme Başarılı!';
        btn.style.background = 'linear-gradient(135deg,#166834,#22c55e)';
        setTimeout(() => {
          window.location.href = `/modaica/siparis-takip.html?code=${data.data.order_id}`;
        }, 1500);
      } else {
        this.showError(data.message || 'Ödeme başarısız oldu.');
        btn.disabled  = false;
        btn.innerHTML = '💳 Tekrar Dene';
      }
    } catch(e) {
      this.showError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
      btn.disabled  = false;
      btn.innerHTML = '💳 Tekrar Dene';
    }
  }

  showError(msg) {
    const el = document.getElementById('paymentError');
    el.textContent    = '❌ ' + msg;
    el.style.display  = 'block';
  }
}

// Kullanım: new PaymentForm('payment-container', orderId);
window.PaymentForm = PaymentForm;
