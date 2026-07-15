/* ============================================================
   MODAICA — Satıcı Başvuru Sayfası JS  v2.0
   api-client.js'deki VendorAuthAPI kullanır.
   ============================================================ */

async function submitApplication() {
  const btn   = document.getElementById('submitBtn');
  const alert = document.getElementById('formAlert');

  const name  = document.getElementById('f-name')?.value.trim()  || '';
  const email = document.getElementById('f-email')?.value.trim() || '';
  const pass  = document.getElementById('f-pass')?.value         || '';
  const phone = document.getElementById('f-phone')?.value.trim() || '';
  const shop  = document.getElementById('f-shop')?.value.trim()  || '';
  const tax   = document.getElementById('f-tax')?.value.trim()   || '';
  const desc  = document.getElementById('f-desc')?.value.trim()  || '';
  const agree = document.getElementById('f-agree')?.checked;

  // ── Validasyon ──────────────────────────────────────────────
  if (!name)  { showAlert('error', 'Ad Soyad zorunludur.'); return; }
  if (!email) { showAlert('error', 'E-posta adresi zorunludur.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAlert('error', 'Geçerli bir e-posta adresi girin.'); return; }
  if (!pass)  { showAlert('error', 'Şifre zorunludur.'); return; }
  if (pass.length < 8) { showAlert('error', 'Şifre en az 8 karakter olmalıdır.'); return; }
  if (!shop)  { showAlert('error', 'Mağaza adı zorunludur.'); return; }
  if (phone && !/^[+]?[\d\s\-().]{7,15}$/.test(phone)) { showAlert('error', 'Geçerli bir telefon numarası girin.'); return; }
  if (!agree) { showAlert('error', 'Satıcı Sözleşmesi\'ni kabul etmeniz gerekiyor.'); return; }

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Gönderiliyor...'; }
  if (alert) alert.style.display = 'none';

  try {
    let result;

    if (typeof VendorAuthAPI !== 'undefined' && VENDOR_API_BASE) {
      result = await VendorAuthAPI.register({ name, email, password: pass, shop_name: shop, phone, tax_number: tax, description: desc });
    } else {
      // Demo mode — API yok
      result = await _demoRegister(email, shop);
    }

    if (!result.ok) {
      showAlert('error', result.data?.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
      if (btn) { btn.disabled = false; btn.textContent = 'Başvuruyu Gönder →'; }
      return;
    }

    // Başarı ekranı
    const successEmail = document.getElementById('successEmail');
    if (successEmail) successEmail.textContent = email;
    document.getElementById('formCard')?.style    && (document.getElementById('formCard').style.display    = 'none');
    document.getElementById('successCard')?.style && (document.getElementById('successCard').style.display = 'block');

  } catch (e) {
    showAlert('error', 'Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
    if (btn) { btn.disabled = false; btn.textContent = 'Başvuruyu Gönder →'; }
  }
}

// ── Demo register (API yoksa) ─────────────────────────────────
async function _demoRegister(email, shopName) {
  await new Promise(r => setTimeout(r, 800));
  return { ok: true, status: 201, data: { success: true, message: 'Başvurunuz alındı (demo).' } };
}

// ── Uyarı Göster ─────────────────────────────────────────────
function showAlert(type, msg) {
  const el = document.getElementById('formAlert');
  if (!el) return;
  el.className     = `form-alert ${type}`;
  el.textContent   = msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Şifre Göster/Gizle ───────────────────────────────────────
function togglePassVis(inputId, btnEl) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  if (btnEl) btnEl.textContent = inp.type === 'password' ? '👁' : '🙈';
}

// ── Sözleşme Linkine Tıklama ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Şifre gücü göstergesi (varsa)
  const passInput = document.getElementById('f-pass');
  const strength  = document.getElementById('passStrength');
  if (passInput && strength) {
    passInput.addEventListener('input', () => {
      const val = passInput.value;
      let score = 0;
      if (val.length >= 8)  score++;
      if (/[A-Z]/.test(val)) score++;
      if (/[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;
      const labels = ['', 'Zayıf', 'Orta', 'Güçlü', 'Çok Güçlü'];
      const colors = ['', '#e63946', '#f97316', '#22c55e', '#16a34a'];
      strength.textContent  = labels[score] || '';
      strength.style.color  = colors[score] || '';
    });
  }
});
