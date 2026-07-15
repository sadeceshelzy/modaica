/* ============================================================
   MODAICA — Kategori Sayfaları API Köprüsü
   api-client.js'den SONRA yüklenir.
   Tüm kategori sayfalarındaki addToCart() ve toggleFav()
   fonksiyonlarını API-aware sürümlerle patch'ler.
   ============================================================ */
(function () {
  // Sadece kategori sayfalarında çalış (PRODUCTS tanımlıysa)
  if (typeof PRODUCTS === 'undefined') return;

  /* ─── FAVORİ TOGGLE ──────────────────────────────────────── */
  const _origToggleFav = window.toggleFav;

  window.toggleFav = async function (id, btn) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) { if (_origToggleFav) _origToggleFav(id, btn); return; }

    const product = {
      product_id: id,
      product_name: p.name,
      product_price: p.price,
      product_emoji: p.emoji || '📦',
      product_cat: p.cat || '',
      product_brand: p.brand || '',
    };

    if (typeof FavAPI !== 'undefined') {
      const added = await FavAPI.toggle(product);
      // Yerel state'i localStorage'dan güncelle
      if (typeof state !== 'undefined' && state.favorites !== undefined) {
        try { state.favorites = JSON.parse(localStorage.getItem('modaica_favorites') || '[]'); } catch { state.favorites = []; }
      }
      if (added) {
        btn.classList.add('active');
        btn.querySelector('svg')?.setAttribute('fill', 'currentColor');
        _toast('♥ ' + p.name + ' favorilere eklendi!');
      } else {
        btn.classList.remove('active');
        btn.querySelector('svg')?.setAttribute('fill', 'none');
        _toast(p.name + ' favorilerden çıkarıldı.');
      }
      _badges();
    } else {
      // FavAPI yok — orijinal localStorage fonksiyonuna düş
      if (_origToggleFav) _origToggleFav(id, btn);
    }
  };

  /* ─── SEPETE EKLE ────────────────────────────────────────── */
  const _origAddToCart = window.addToCart;

  window.addToCart = async function (id, btn) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) { if (_origAddToCart) _origAddToCart(id, btn); return; }

    const product = {
      product_id: id,
      product_name: p.name,
      product_price: p.price,
      product_emoji: p.emoji || '📦',
      product_cat: p.cat || '',
      product_brand: p.brand || '',
      quantity: 1,
    };

    const origHTML = btn?.innerHTML;
    if (btn) btn.disabled = true;

    if (typeof CartAPI !== 'undefined') {
      await CartAPI.addAndSync(product);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Eklendi`;
        btn.style.background = '#22c55e';
        setTimeout(() => { if (btn) { btn.innerHTML = origHTML; btn.style.background = ''; } }, 1800);
      }
      _toast(p.name + ' sepete eklendi!');
      _badges();
    } else {
      // CartAPI yok — orijinal localStorage fonksiyonuna düş
      if (btn) btn.disabled = false;
      if (_origAddToCart) _origAddToCart(id, btn);
    }
  };

  /* ─── ANASAYFA addCart() fonksiyonu (farklı imza) ────────── */
  const _origAddCart = window.addCart;
  if (typeof _origAddCart === 'function') {
    window.addCart = async function (name, price, emoji, id) {
      if (typeof CartAPI !== 'undefined' && id) {
        // Ürün bilgisi varsa gerçek sepete ekle
        await CartAPI.addAndSync({
          product_id: id,
          product_name: name,
          product_price: price || 0,
          product_emoji: emoji || '🛍️',
          quantity: 1,
        });
      } else {
        // Sadece toast (eski davranış — id yoksa)
        _toast(name + ' sepete eklendi!');
        _badges();
      }
    };
  }

  /* ─── Yardımcılar ───────────────────────────────────────── */
  function _toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
  }
  function _badges() {
    if (typeof updateBadges === 'function') updateBadges();
  }

})();
