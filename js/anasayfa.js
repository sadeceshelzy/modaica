/* =============================================
   MODAICA — Ana Sayfa JavaScript
   ============================================= */

// ── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  const span = t.querySelector('span');
  if (span) span.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

function safeJsonParse(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

function updateBadges() {
  const cart = safeJsonParse('modaica_cart', []);
  const favs = safeJsonParse('modaica_favorites', []);
  const tot = cart.reduce((s, c) => s + (c.quantity || 1), 0);
  document.querySelectorAll('#hdrCartBadge').forEach(cb => {
    cb.textContent = tot; cb.style.display = tot > 0 ? 'flex' : 'none';
  });
  document.querySelectorAll('#hdrFavBadge').forEach(fb => {
    fb.textContent = favs.length; fb.style.display = favs.length > 0 ? 'flex' : 'none';
  });
}

// ── Sepete Ekle ───────────────────────────────────────────────────────────────
function addCart(name, productData) {
  const cart = safeJsonParse('modaica_cart', []);
  const pid = (productData && productData.id) ? productData.id : name;
  const ex = cart.find(c => c.product_id === pid);
  if (ex) {
    ex.quantity = (ex.quantity || 1) + 1;
  } else {
    cart.push({
      product_id: pid,
      product_name: name,
      product_price: (productData && productData.price) ? productData.price : 0,
      product_emoji: (productData && productData.emoji) ? productData.emoji : '📦',
      quantity: 1,
    });
  }
  localStorage.setItem('modaica_cart', JSON.stringify(cart));
  showToast(name + ' sepete eklendi! 🛒');
  updateBadges();
}

// ── Slider ───────────────────────────────────────────────────────────────────
const track = document.getElementById('sliderTrack');
const dots = document.querySelectorAll('.dot');
const catBtns = document.querySelectorAll('.slide-cat-btn');
const TOTAL = 6;
let cur = 0, timer;

function goSlide(n) {
  if (!track) return;
  cur = (n + TOTAL) % TOTAL;
  track.style.transform = `translateX(-${cur * 100}%)`;
  dots.forEach((d, i) => d.classList.toggle('active', i === cur));
  catBtns.forEach((b, i) => b.classList.toggle('active', i === cur));
}

function nextSlide() { goSlide(cur + 1); }
function prevSlide() { goSlide(cur - 1); }
function startAuto() { timer = setInterval(nextSlide, 5000); }
function stopAuto() { clearInterval(timer); }

document.getElementById('btnNext')?.addEventListener('click', () => { stopAuto(); nextSlide(); startAuto(); });
document.getElementById('btnPrev')?.addEventListener('click', () => { stopAuto(); prevSlide(); startAuto(); });
dots.forEach((d, i) => d.addEventListener('click', () => { stopAuto(); goSlide(i); startAuto(); }));
catBtns.forEach((b, i) => b.addEventListener('click', () => { stopAuto(); goSlide(i); startAuto(); }));

// Touch (track null-safe)
if (track) {
  let tx = 0;
  track.addEventListener('touchstart', e => tx = e.changedTouches[0].clientX, { passive: true });
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) { stopAuto(); dx < 0 ? nextSlide() : prevSlide(); startAuto(); }
  }, { passive: true });
}

startAuto();

// ── Geri Sayım Sayacı ─────────────────────────────────────────────────────────
function updateTimer() {
  const now = new Date();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const diff = Math.max(0, end - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = n => String(n).padStart(2, '0');
  const el = document.getElementById('timerBox');
  if (el) el.innerHTML =
    `<div class="tbox"><span class="tval">${pad(h)}</span><span class="tlbl">Saat</span></div>` +
    `<div class="tbox"><span class="tval">${pad(m)}</span><span class="tlbl">Dak</span></div>` +
    `<div class="tbox"><span class="tval">${pad(s)}</span><span class="tlbl">San</span></div>`;
}
updateTimer();
setInterval(updateTimer, 1000);

// ── Ürün Verileri ─────────────────────────────────────────────────────────────
const PRODUCTS = [
  // Popüler
  { tab: 'popular', cat: 'Elektronik / Akıllı Saat', name: 'Apple Watch Series 9 — GPS 45mm', stars: 5, reviews: 2341, price: '13.999', old: '15.999', badge: 'hot', emoji: '⌚', href: 'elektronik.html?cat=giyilebilir' },
  { tab: 'popular', cat: 'Kadın / Elbise', name: 'Çiçek Desenli Midi Elbise', stars: 5, reviews: 412, price: '899', old: '1.299', badge: 'sale', emoji: '👗', href: 'kadin.html?cat=elbise' },
  { tab: 'popular', cat: 'Erkek / Gömlek', name: 'Slim Fit Keten Gömlek', stars: 5, reviews: 198, price: '599', old: null, badge: 'new', emoji: '👔', href: 'erkek.html?cat=gomlek' },
  { tab: 'popular', cat: 'Kozmetik / Parfüm', name: 'La Vie Est Belle EDP 50ml', stars: 5, reviews: 1543, price: '2.999', old: '3.499', badge: 'best', emoji: '🌸', href: 'kozmetik.html?cat=parfum' },
  { tab: 'popular', cat: 'Spor / Koşu', name: 'Nike Ultra Boost Pro Koşu', stars: 5, reviews: 1876, price: '3.499', old: '4.499', badge: 'sale', emoji: '👟', href: 'spor.html?cat=ayakkabi' },
  { tab: 'popular', cat: 'Ev & Yaşam / Mobilya', name: 'Masif Meşe Yemek Masası', stars: 5, reviews: 187, price: '9.499', old: '12.999', badge: 'best', emoji: '🪑', href: 'ev.html?cat=mobilya' },
  { tab: 'popular', cat: 'Kadın / Çanta', name: 'Deri Omuz Çantası', stars: 5, reviews: 134, price: '1.299', old: '1.799', badge: 'sale', emoji: '👜', href: 'kadin.html?cat=canta' },
  { tab: 'popular', cat: 'Elektronik / Kulaklık', name: 'Sony WH-1000XM5 Kulaklık', stars: 5, reviews: 1567, price: '8.999', old: '11.999', badge: 'sale', emoji: '🎧', href: 'elektronik.html?cat=ses' },
  // Yeni Gelenler
  { tab: 'new', cat: 'Erkek / T-Shirt', name: 'Polo Yaka Tişört — Pique', stars: 5, reviews: 335, price: '429', old: '599', badge: 'new', emoji: '👕', href: 'erkek.html?cat=tshirt' },
  { tab: 'new', cat: 'Kozmetik / Yüz Bakımı', name: 'Hyalüronik Asit Serumu 50ml', stars: 5, reviews: 2341, price: '549', old: '699', badge: 'new', emoji: '💧', href: 'kozmetik.html?cat=yuz-bakim' },
  { tab: 'new', cat: 'Elektronik / Tablet', name: 'iPad Air M2 — 11" WiFi 256GB', stars: 5, reviews: 432, price: '29.999', old: '32.999', badge: 'new', emoji: '📲', href: 'elektronik.html?cat=tablet' },
  { tab: 'new', cat: 'Kadın / Etek', name: 'Pileli Midi Etek — Toz Pembesi', stars: 5, reviews: 223, price: '549', old: '749', badge: 'new', emoji: '👗', href: 'kadin.html?cat=etek' },
  { tab: 'new', cat: 'Spor / Kamp', name: 'Trekking Sırt Çantası 40L', stars: 5, reviews: 187, price: '2.499', old: null, badge: 'new', emoji: '🎒', href: 'spor.html?cat=kamp' },
  { tab: 'new', cat: 'Ev & Yaşam / Dekorasyon', name: 'Marmer Efektli Vazo Seti (3lü)', stars: 5, reviews: 312, price: '749', old: null, badge: 'new', emoji: '🏺', href: 'ev.html?cat=dekorasyon' },
  { tab: 'new', cat: 'Kozmetik / Alet', name: 'LED Yüz Maskesi — 7 Renk', stars: 5, reviews: 187, price: '7.999', old: '9.999', badge: 'new', emoji: '🔴', href: 'kozmetik.html?cat=alet' },
  { tab: 'new', cat: 'Erkek / Ayakkabı', name: 'Kanvas Sneaker — Beyaz', stars: 5, reviews: 203, price: '799', old: null, badge: 'new', emoji: '👟', href: 'erkek.html?cat=ayakkabi' },
  // İndirimli
  { tab: 'sale', cat: 'Elektronik / TV', name: 'Samsung QLED 4K 65" — 144Hz', stars: 5, reviews: 567, price: '34.999', old: '44.999', badge: 'sale', emoji: '📺', href: 'elektronik.html?cat=televizyon' },
  { tab: 'sale', cat: 'Kadın / Dış Giyim', name: 'Kapitone Mont — Siyah', stars: 5, reviews: 98, price: '2.299', old: '3.299', badge: 'sale', emoji: '🧥', href: 'kadin.html?cat=dis-giyim' },
  { tab: 'sale', cat: 'Spor / Fitness', name: 'Adjustable Dumbbell 2-24kg', stars: 5, reviews: 432, price: '6.999', old: '8.999', badge: 'sale', emoji: '🏋️', href: 'spor.html?cat=ekipman' },
  { tab: 'sale', cat: 'Ev & Yaşam / Uyku', name: 'Doğal Lateks Yatak 160x200cm', stars: 5, reviews: 312, price: '8.999', old: '12.999', badge: 'sale', emoji: '🛏️', href: 'ev.html?cat=uyku' },
  { tab: 'sale', cat: 'Erkek / Pantolon', name: 'Slim Fit Jean — Lacivert', stars: 5, reviews: 218, price: '649', old: '899', badge: 'sale', emoji: '👖', href: 'erkek.html?cat=pantolon' },
  { tab: 'sale', cat: 'Kozmetik / Saç', name: 'Saç Maskesi Argan Yağı 250ml', stars: 5, reviews: 765, price: '899', old: '1.199', badge: 'sale', emoji: '💆', href: 'kozmetik.html?cat=sac-bakim' },
  { tab: 'sale', cat: 'Kadın / Ayakkabı', name: 'Stiletto Topuklu Ayakkabı', stars: 5, reviews: 234, price: '1.799', old: '2.499', badge: 'sale', emoji: '👠', href: 'kadin.html?cat=ayakkabi' },
  { tab: 'sale', cat: 'Spor / Outdoor', name: '3 Mevsim Çadır 2 Kişilik', stars: 5, reviews: 312, price: '2.999', old: '3.999', badge: 'sale', emoji: '⛺', href: 'spor.html?cat=kamp' },
  // En Çok Satanlar
  { tab: 'best', cat: 'Kozmetik / Yüz Bakımı', name: 'Micellar Temizleme Suyu 400ml', stars: 5, reviews: 3215, price: '249', old: '329', badge: 'hot', emoji: '🫧', href: 'kozmetik.html?cat=yuz-bakim' },
  { tab: 'best', cat: 'Spor / Aksesuar', name: 'Nike Dri-Fit Koşu Tişört', stars: 5, reviews: 1234, price: '649', old: '899', badge: 'hot', emoji: '👕', href: 'spor.html?cat=giyim' },
  { tab: 'best', cat: 'Erkek / Aksesuar', name: 'Deri Cüzdan — Siyah', stars: 5, reviews: 421, price: '399', old: null, badge: 'hot', emoji: '👛', href: 'erkek.html?cat=aksesuar' },
  { tab: 'best', cat: 'Kadın / Kazak', name: 'Kaşmir Kazak — Krem', stars: 5, reviews: 143, price: '1.399', old: '1.999', badge: 'hot', emoji: '🧥', href: 'kadin.html?cat=kazak' },
  { tab: 'best', cat: 'Elektronik / Oyun', name: 'PlayStation 5 Slim — 1TB', stars: 5, reviews: 1876, price: '19.999', old: '22.999', badge: 'hot', emoji: '🎮', href: 'elektronik.html?cat=oyun' },
  { tab: 'best', cat: 'Ev & Yaşam / Mutfak', name: 'Karbon Çelik Tencere 7li Set', stars: 5, reviews: 567, price: '2.999', old: '3.999', badge: 'hot', emoji: '🍳', href: 'ev.html?cat=mutfak' },
  { tab: 'best', cat: 'Kozmetik / Makyaj', name: 'Waterproof Maskara — Hacim', stars: 5, reviews: 2876, price: '299', old: '399', badge: 'hot', emoji: '👁️', href: 'kozmetik.html?cat=makyaj' },
  { tab: 'best', cat: 'Spor / Ekipman', name: 'Yoga Matı 6mm — Kaymaz', stars: 5, reviews: 1098, price: '599', old: '799', badge: 'hot', emoji: '🧘', href: 'spor.html?cat=ekipman' },
];

const BADGE_COLORS = { hot: 'badge-hot', new: 'badge-new', sale: 'badge-sale', best: 'badge-best' };
const BADGE_LABELS = { hot: '🔥 HOT', new: 'YENİ', sale: 'İNDİRİM', best: '⭐ BEST' };

let activeTab = 'popular';

// ── Ürün Render ───────────────────────────────────────────────────────────────
function renderProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  const list = PRODUCTS.filter(p => p.tab === activeTab);
  grid.innerHTML = list.map((p, i) => `
    <a href="${p.href}" class="product-card" style="animation:cardIn .4s ease ${i * 0.05}s both;text-decoration:none;">
      <style>@keyframes cardIn{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}</style>
      <div class="product-img">
        ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy" data-emoji="${p.emoji||'📦'}" onerror="this.outerHTML='<span>'+this.dataset.emoji+'</span>'">` : `<span>${p.emoji}</span>`}
        <div class="product-badge ${BADGE_COLORS[p.badge]}">${BADGE_LABELS[p.badge]}</div>
        <button class="product-fav" onclick="event.preventDefault();event.stopPropagation();">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        </button>
      </div>
      <div class="product-info">
        <div class="product-cat">${p.cat}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-stars">
          <span class="stars">${'★'.repeat(p.stars)}${'☆'.repeat(5 - p.stars)}</span>
          <span class="review-count">(${p.reviews.toLocaleString('tr-TR')})</span>
        </div>
        <div class="product-footer">
          <div class="price-wrap">
            <span class="price">₺${p.price}</span>
            ${p.old ? `<span class="price-old">₺${p.old}</span>` : ''}
          </div>
          <button class="add-cart" onclick="event.preventDefault();event.stopPropagation();addCart('${p.name.replace(/'/g, "\\'")}')">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            Ekle
          </button>
        </div>
      </div>
    </a>`).join('');
}

document.querySelectorAll('.prod-tab').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.prod-tab').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    activeTab = this.dataset.tab;
    renderProducts();
  });
});

renderProducts();
updateBadges();

// ── Favori Butonları ─────────────────────────────────────────────────────────
document.addEventListener('click', async function (e) {
  const btn = e.target.closest('.product-fav');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();

  const card = btn.closest('a.product-card') || btn.closest('.product-card');
  const nameEl = card ? card.querySelector('.product-name') : null;
  const name = nameEl ? nameEl.textContent.trim() : '';
  if (!name) return;

  const prod = PRODUCTS.find(p => p.name === name && p.tab === activeTab);
  if (!prod) return;

  const product = {
    product_id: prod.emoji + '-' + prod.name.substring(0, 20).replace(/\s/g, '-'),
    product_name: prod.name,
    product_price: parseFloat(prod.price.replace(/\./g, '').replace(',', '.')),
    product_emoji: prod.emoji,
    product_cat: prod.cat,
    product_href: prod.href || '',
  };

  // FavAPI varsa (api-client.js yüklüyse) kullan, yoksa localStorage
  if (typeof FavAPI !== 'undefined') {
    const added = await FavAPI.toggle(product);
    btn.style.color = added ? '#e63946' : '';
    showToast(added ? prod.name + ' favorilere eklendi! ♥' : prod.name + ' favorilerden çıkarıldı.');
  } else {
    // localStorage fallback
    const favs = safeJsonParse('modaica_favorites', []);
    const idx = favs.findIndex(f => f.product_id === product.product_id);
    if (idx !== -1) {
      favs.splice(idx, 1);
      btn.style.color = '';
      showToast(prod.name + ' favorilerden çıkarıldı.');
    } else {
      favs.push(product);
      btn.style.color = '#e63946';
      showToast(prod.name + ' favorilere eklendi! ♥');
    }
    localStorage.setItem('modaica_favorites', JSON.stringify(favs));
  }
  updateBadges();
});

// ── Topbar Kapat ─────────────────────────────────────────────────────────────
document.getElementById('topbarClose')?.addEventListener('click', () => {
  document.getElementById('topbarEl')?.remove();
});

// ── Newsletter ────────────────────────────────────────────────────────────────
document.getElementById('newsletterBtn')?.addEventListener('click', () => {
  const input = document.getElementById('newsletterInput');
  if (input && input.value.trim()) {
    showToast('Bülten aboneliğiniz alındı, teşekkürler! 🎉');
    input.value = '';
  }
});
