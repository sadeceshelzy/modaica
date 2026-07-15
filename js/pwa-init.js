// ============================================================
//  MODAICA PWA Init — her sayfanın sonuna ekle
//  <script src="js/pwa-init.js"></script>
// ============================================================

(function() {
  'use strict';

  // ── Service Worker Kayıt ──────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/modaica/service-worker.js', { scope: '/modaica/' });
        console.log('[PWA] SW kayıtlı:', reg.scope);

        // Güncelleme kontrolü
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner();
            }
          });
        });
      } catch(e) {
        console.warn('[PWA] SW kaydı başarısız:', e);
      }
    });
  }

  // ── Yükleme Prompt'u ─────────────────────────────────────
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;

    // Kullanıcı daha önce reddetmediyse banner göster
    const dismissed = localStorage.getItem('pwa_dismissed');
    if (!dismissed) {
      setTimeout(showInstallBanner, 3000);
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    localStorage.setItem('pwa_installed', '1');
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
    showToast('✅ MODAICA ana ekranınıza eklendi!');
  });

  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <style>
        #pwa-install-banner {
          position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
          background: white; border-radius: 16px; padding: 16px 20px;
          box-shadow: 0 8px 32px rgba(0,0,0,.15); border: 1px solid #e5e7eb;
          display: flex; align-items: center; gap: 14px;
          max-width: 380px; width: calc(100% - 32px); z-index: 9998;
          animation: slideUp .3s ease;
        }
        @keyframes slideUp { from{opacity:0;transform:translateX(-50%) translateY(20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        #pwa-install-banner .pwa-icon { font-size: 36px; flex-shrink: 0; }
        #pwa-install-banner .pwa-text { flex: 1; }
        #pwa-install-banner .pwa-text strong { display: block; font-size: 14px; font-weight: 700; color: #1a1f5e; margin-bottom: 2px; }
        #pwa-install-banner .pwa-text span { font-size: 12px; color: #6b7280; }
        #pwa-install-banner .pwa-btn { background: #1a1f5e; color: white; border: none; padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        #pwa-install-banner .pwa-close { background: none; border: none; color: #6b7280; font-size: 18px; cursor: pointer; padding: 4px; }
      </style>
      <div class="pwa-icon">🛍️</div>
      <div class="pwa-text">
        <strong>MODAICA'yı Yükle</strong>
        <span>Ana ekrana ekle, hızlı eriş</span>
      </div>
      <button class="pwa-btn" id="pwa-install-btn">Yükle</button>
      <button class="pwa-close" id="pwa-close-btn">✕</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'dismissed') {
        localStorage.setItem('pwa_dismissed', Date.now());
      }
      deferredPrompt = null;
      banner.remove();
    });

    document.getElementById('pwa-close-btn').addEventListener('click', () => {
      localStorage.setItem('pwa_dismissed', Date.now());
      banner.remove();
    });
  }

  // ── Güncelleme Banner'ı ───────────────────────────────────
  function showUpdateBanner() {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#1a1f5e;color:white;text-align:center;padding:12px;font-size:13px;z-index:9999;display:flex;align-items:center;justify-content:center;gap:14px;';
    bar.innerHTML = `
      <span>🔄 MODAICA güncellendi!</span>
      <button onclick="location.reload()" style="background:white;color:#1a1f5e;border:none;padding:6px 14px;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px;">Yenile</button>
    `;
    document.body.prepend(bar);
  }

  // ── Push Bildirim İzni ───────────────────────────────────
  window.requestPushPermission = async function() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const result = await Notification.requestPermission();
    return result === 'granted';
  };

  // ── Toast (eğer yoksa) ───────────────────────────────────
  function showToast(msg) {
    const el = document.getElementById('toast') || (() => {
      const t = document.createElement('div');
      t.id = 'toast-pwa';
      t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1a1f5e;color:white;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:500;z-index:9999;opacity:0;transition:opacity .3s;';
      document.body.appendChild(t);
      return t;
    })();
    el.textContent = msg;
    el.style.opacity = '1';
    setTimeout(() => el.style.opacity = '0', 3000);
  }

})();
