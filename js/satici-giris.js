/* ============================================================
   MODAICA — Satıcı Giriş Sayfası JS  v2.0
   api-client.js'deki VendorAuthAPI kullanır.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Zaten giriş yapılmışsa direkt panele yönlendir
  if (typeof VendorAuth !== 'undefined' && VendorAuth.isLoggedIn()) {
    window.location.href = 'satici-panel.html';
    return;
  }

  // Beni hatırla — email doldur
  const saved = localStorage.getItem('vendorEmail');
  if (saved) {
    const emailEl = document.getElementById('lEmail');
    const remEl   = document.getElementById('rememberMe');
    if (emailEl) emailEl.value = saved;
    if (remEl)   remEl.checked = true;
  }
});

// ── Giriş Yap ────────────────────────────────────────────────
async function doLogin() {
  const btn   = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  const email = document.getElementById('lEmail')?.value.trim()  || '';
  const pass  = document.getElementById('lPass')?.value          || '';

  if (errEl) errEl.style.display = 'none';

  // Validasyon
  if (!email)            { showErr('E-posta adresi zorunludur.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr('Geçerli bir e-posta adresi girin.'); return; }
  if (!pass)             { showErr('Şifre zorunludur.'); return; }

  setLoading(true);

  try {
    // api-client.js'deki VendorAuthAPI kullan
    let result;
    if (typeof VendorAuthAPI !== 'undefined' && VENDOR_API_BASE) {
      result = await VendorAuthAPI.login(email, pass);
    } else {
      // Demo mode — XAMPP yok
      result = await _demoLogin(email, pass);
    }

    if (!result.ok) {
      const msg = result.data?.message || 'Giriş başarısız.';
      // Özel durum mesajları
      if (result.status === 403 || msg.includes('onaylanmamış') || msg.includes('pending')) {
        showPending(); return;
      }
      if (msg.includes('askıya') || msg.includes('suspended')) {
        showSuspended(); return;
      }
      showErr(msg);
      return;
    }

    // Beni hatırla
    if (document.getElementById('rememberMe')?.checked) {
      localStorage.setItem('vendorEmail', email);
    } else {
      localStorage.removeItem('vendorEmail');
    }

    // Panel'e yönlendir
    window.location.href = 'satici-panel.html';

  } catch (e) {
    showErr('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
  } finally {
    setLoading(false);
  }
}

// ── Demo login (API yoksa) ────────────────────────────────────
async function _demoLogin(email, pass) {
  await new Promise(r => setTimeout(r, 600)); // Simülasyon
  if (email === 'demo@modaica.com' && pass === 'demo1234') {
    const vendor = { id: 1, name: 'Demo Satıcı', shop_name: 'Demo Mağaza', email, logo_emoji: '🏪', commission_rate: 10, status: 'approved' };
    const token  = 'demo_vendor_token_' + Date.now();
    localStorage.setItem('vendorToken', token);
    localStorage.setItem('vendorData', JSON.stringify(vendor));
    return { ok: true, status: 200, data: { success: true, data: { token, vendor } } };
  }
  return { ok: false, status: 401, data: { success: false, message: 'E-posta veya şifre hatalı. (Demo: demo@modaica.com / demo1234)' } };
}

// ── Yardımcılar ───────────────────────────────────────────────
function setLoading(on) {
  const btn = document.getElementById('loginBtn');
  if (!btn) return;
  btn.disabled    = on;
  btn.textContent = on ? '⏳ Giriş yapılıyor...' : 'Giriş Yap';
}

function showErr(msg) {
  const el = document.getElementById('loginError');
  if (!el) return;
  el.textContent   = msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showPending() {
  setLoading(false);
  document.querySelector('.login-card')?.style && (document.querySelector('.login-card').style.display = 'none');
  const el = document.getElementById('pendingCard');
  if (el) el.style.display = 'block';
}

function showSuspended() {
  setLoading(false);
  document.querySelector('.login-card')?.style && (document.querySelector('.login-card').style.display = 'none');
  const el = document.getElementById('suspendedCard');
  if (el) el.style.display = 'block';
}

function togglePass() {
  const inp = document.getElementById('lPass');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  // Göz ikonunu değiştir
  const btn = document.querySelector('.pass-toggle');
  if (btn) btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}

// Enter ile giriş
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (document.activeElement?.id === 'lEmail' || document.activeElement?.id === 'lPass')) {
    doLogin();
  }
});
