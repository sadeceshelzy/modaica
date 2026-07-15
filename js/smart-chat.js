// ============================================================
//  MODAICA — Destek Chatbot  (Kural tabanlı, API gerektirmez)
//  Trendyol benzeri: balon butonlarla yönlendirme akışı
// ============================================================

(function () {
  'use strict';

  // ── AKIŞ TANIMI ───────────────────────────────────────────
  const FLOWS = {

    start: {
      msg: 'Merhaba! 👋 Nasıl yardımcı olabilirim?',
      opts: [
        { label: '🛍️ Ürün Önerisi',      next: 'products'  },
        { label: '📦 Siparişlerim',      next: 'orders'    },
        { label: '↩️ İade & İptal',       next: 'returns'   },
        { label: '🚚 Kargo',             next: 'shipping'  },
        { label: '💳 Ödeme & Fatura',    next: 'payment'   },
        { label: '🎁 Kampanya & Kupon',  next: 'campaigns' },
        { label: '☎️ Canlı Destek',      next: 'live'      },
      ],
    },

    // ── SİPARİŞ ─────────────────────────────────────────────
    orders: {
      msg: 'Siparişinizle ilgili konuyu seçin:',
      opts: [
        { label: '📍 Siparişim nerede?',             next: 'order_tracking' },
        { label: '❌ Siparişimi iptal etmek istiyorum', next: 'order_cancel'   },
        { label: '📦 Ürün hasarlı/eksik geldi',      next: 'order_damaged'  },
        { label: '🔄 Yanlış ürün geldi',             next: 'order_wrong'    },
        { label: '↩️ Ana menü',                       next: 'start'          },
      ],
    },

    order_tracking: {
      msg: 'Siparişinizin durumunu <strong>Siparişlerim</strong> sayfasından anlık takip edebilirsiniz. Kargo takip numaranız SMS/e-posta ile iletilmiştir.',
      opts: [
        { label: '📋 Siparişlerimi gör', action: () => window.location.href = 'hesabim.html#orders' },
        { label: '🔍 Sipariş kodu ile takip et', action: () => window.location.href = 'siparis-takip.html' },
        { label: '❓ Kargo bilgisi gelmedi', next: 'live', prefix: 'Kargo bildirimi sorunu: ' },
        { label: '↩️ Geri',               next: 'orders' },
      ],
    },

    order_cancel: {
      msg: '⚠️ İptal işlemi yalnızca siparişiniz <strong>"Hazırlanıyor"</strong> aşamasındayken yapılabilir. Hazırlanmaya başlandıktan sonra iade süreci başlatılır.',
      opts: [
        { label: '❌ Siparişimi iptal et', action: () => window.location.href = 'hesabim.html#orders' },
        { label: '↩️ İade sürecini öğren', next: 'returns' },
        { label: '↩️ Geri',               next: 'orders'  },
      ],
    },

    order_damaged: {
      msg: 'Üzgünüz! Hasar/eksiklik durumunda:\n\n1️⃣ Ürünü kabul etmeyebilir, kargocuya tutanak tutturabilirsiniz.\n2️⃣ Kabul ettiyseniz 48 saat içinde bizimle iletişime geçin.',
      opts: [
        { label: '📸 Destek talebi oluştur', next: 'live', prefix: 'Hasarlı ürün: ' },
        { label: '↩️ Geri',                 next: 'orders' },
      ],
    },

    order_wrong: {
      msg: '😔 Yanlış ürün geldiğinde ekibimiz en kısa sürede çözüm üretir. Lütfen ürünün fotoğrafını hazırlayın.',
      opts: [
        { label: '📸 Destek talebi oluştur', next: 'live', prefix: 'Yanlış ürün: ' },
        { label: '↩️ Geri',                 next: 'orders' },
      ],
    },

    // ── İADE ────────────────────────────────────────────────
    returns: {
      msg: 'İade & iptal konusunu seçin:',
      opts: [
        { label: '📋 İade nasıl yapılır?',           next: 'return_how'    },
        { label: '⏱️ İade süresi ne kadar?',         next: 'return_period' },
        { label: '💰 İade paramı ne zaman alırım?',  next: 'return_refund' },
        { label: '🚫 İade edilemeyen ürünler',       next: 'return_except' },
        { label: '↩️ Ana menü',                       next: 'start'         },
      ],
    },

    return_how: {
      msg: '📋 <strong>İade Adımları:</strong>\n\n1️⃣ Hesabım → Siparişlerim → İade Talebi Oluştur\n2️⃣ İade nedeninizi seçin\n3️⃣ Kargo kodu ile ürünü teslim edin\n\nÜrün bize ulaştıktan 3–5 iş günü içinde iade işleminiz tamamlanır.',
      opts: [
        { label: '📋 İade talebi oluştur', action: () => window.location.href = 'hesabim.html#orders' },
        { label: '↩️ Geri',               next: 'returns' },
      ],
    },

    return_period: {
      msg: '⏱️ Ürünü teslim aldığınız tarihten itibaren <strong>14 gün</strong> içinde iade talebinde bulunabilirsiniz.\n\nKullanılmamış, orijinal ambalajında ve tüm aksesuarlarıyla birlikte gönderilmelidir.',
      opts: [
        { label: '↩️ Geri', next: 'returns' },
        { label: '↩️ Ana menü', next: 'start' },
      ],
    },

    return_refund: {
      msg: '💰 İade ürünümüze ulaştıktan sonra:\n\n• Kredi kartı → 3–10 iş günü\n• Banka havalesi → 1–3 iş günü\n• Puan/kupon iadesi → Anında\n\nBanka işlem süreleri değişkenlik gösterebilir.',
      opts: [
        { label: '↩️ Geri', next: 'returns' },
        { label: '↩️ Ana menü', next: 'start' },
      ],
    },

    return_except: {
      msg: '🚫 <strong>İade edilemeyen ürünler:</strong>\n\n• Açılmış kozmetik & kişisel bakım\n• İç giyim & mayo (hijyen nedeniyle)\n• Dijital ürünler & lisanslar\n• Özel üretim/kişiselleştirilmiş ürünler',
      opts: [
        { label: '↩️ Geri', next: 'returns' },
        { label: '↩️ Ana menü', next: 'start' },
      ],
    },

    // ── KARGO ───────────────────────────────────────────────
    shipping: {
      msg: 'Kargo konusunu seçin:',
      opts: [
        { label: '💰 Kargo ücretleri',          next: 'ship_price'    },
        { label: '⏱️ Teslimat süresi',          next: 'ship_time'     },
        { label: '🏠 Teslimat adresi değiştir', next: 'ship_address'  },
        { label: '📍 Kargo firmam hangisi?',    next: 'ship_company'  },
        { label: '↩️ Ana menü',                  next: 'start'         },
      ],
    },

    ship_price: {
      msg: '💰 <strong>Kargo Ücretleri:</strong>\n\n🚚 Standart (2–4 iş günü) → ₺39,90\n⚡ Hızlı (1–2 iş günü) → ₺59,90\n🏎️ Aynı Gün → ₺99,90\n\n✅ <strong>₺750 ve üzeri alışverişlerde standart kargo ücretsiz!</strong>',
      opts: [
        { label: '↩️ Geri', next: 'shipping' },
        { label: '↩️ Ana menü', next: 'start' },
      ],
    },

    ship_time: {
      msg: '⏱️ <strong>Tahmini Teslimat Süreleri:</strong>\n\n• İstanbul → 1–2 iş günü\n• Büyük şehirler → 2–3 iş günü\n• Diğer iller → 3–5 iş günü\n\nResmi tatil ve hafta sonları sayılmaz.',
      opts: [
        { label: '↩️ Geri', next: 'shipping' },
        { label: '↩️ Ana menü', next: 'start' },
      ],
    },

    ship_address: {
      msg: 'Sipariş hazırlanmaya başlamadan adres değişikliği yapabilirsiniz. Sipariş hazırlanmaya başladıysa canlı desteğe bağlanın.',
      opts: [
        { label: '🏠 Adreslerimi güncelle', action: () => window.location.href = 'hesabim.html#addresses' },
        { label: '☎️ Canlı Destek', next: 'live', prefix: 'Adres değişikliği: ' },
        { label: '↩️ Geri', next: 'shipping' },
      ],
    },

    ship_company: {
      msg: '📍 Siparişinizin hangi kargo firmasıyla geleceğini <strong>Siparişlerim</strong> sayfasından ve size gelen SMS/e-postadan görebilirsiniz.',
      opts: [
        { label: '📋 Siparişlerimi gör', action: () => window.location.href = 'hesabim.html#orders' },
        { label: '↩️ Geri', next: 'shipping' },
      ],
    },

    // ── ÖDEME ───────────────────────────────────────────────
    payment: {
      msg: 'Ödeme konusunu seçin:',
      opts: [
        { label: '💳 Hangi kartları kullanabilirim?', next: 'pay_cards'    },
        { label: '🏠 Kapıda ödeme var mı?',          next: 'pay_door'     },
        { label: '📅 Taksit seçenekleri',            next: 'pay_inst'     },
        { label: '🧾 Fatura nereden alınır?',        next: 'pay_invoice'  },
        { label: '↩️ Ana menü',                       next: 'start'        },
      ],
    },

    pay_cards: {
      msg: '💳 Visa, Mastercard ve American Express kartlarla ödeme yapabilirsiniz.\n\nAyrıca kapıda nakit ve kapıda kredi kartıyla ödeme seçenekleri de mevcuttur.',
      opts: [{ label: '↩️ Geri', next: 'payment' }],
    },

    pay_door: {
      msg: '🏠 Evet! Kapıda nakit ve kapıda kredi kartıyla ödeme seçeneği mevcuttur. Checkout sırasında bu seçeneği işaretleyebilirsiniz.',
      opts: [{ label: '↩️ Geri', next: 'payment' }],
    },

    pay_inst: {
      msg: '📅 Desteklenen bankalarda 3, 6, 9 ve 12 taksit seçeneği sunulmaktadır. Taksit seçenekleri ödeme adımında kartınıza göre otomatik listelenir.',
      opts: [{ label: '↩️ Geri', next: 'payment' }],
    },

    pay_invoice: {
      msg: '🧾 Faturanız siparişiniz kargoya verildikten sonra kayıtlı e-posta adresinize gönderilir. Ayrıca <strong>Siparişlerim → Detay</strong> sayfasından indirebilirsiniz.',
      opts: [
        { label: '📋 Siparişlerimi gör', action: () => window.location.href = 'hesabim.html#orders' },
        { label: '↩️ Geri', next: 'payment' },
      ],
    },

    // ── KAMPANYA ────────────────────────────────────────────
    campaigns: {
      msg: 'Kampanya & kupon konusunu seçin:',
      opts: [
        { label: '🔥 Aktif kampanyalar',          next: 'camp_active'  },
        { label: '🎟️ Kupon kodu nasıl kullanılır?', next: 'camp_coupon' },
        { label: '⭐ Puan sistemi',               next: 'camp_points'  },
        { label: '↩️ Ana menü',                    next: 'start'        },
      ],
    },

    camp_active: {
      msg: '🔥 Güncel kampanyaları ve indirimleri arama sayfasından keşfedebilirsiniz!',
      opts: [
        { label: '🛍️ İndirimlere bak', action: () => window.location.href = 'arama.html?badge=sale' },
        { label: '↩️ Geri', next: 'campaigns' },
      ],
    },

    camp_coupon: {
      msg: '🎟️ Kupon kodu kullanmak için:\n\n1️⃣ Sepetinize ürün ekleyin\n2️⃣ Sepet sayfasında "Kupon Kodu" alanına kodunuzu girin\n3️⃣ Uygula butonuna tıklayın\n\nKupon minimum tutar ve geçerlilik koşullarına tabidir.',
      opts: [
        { label: '🛒 Sepete git', action: () => window.location.href = 'sepet.html' },
        { label: '↩️ Geri', next: 'campaigns' },
      ],
    },

    camp_points: {
      msg: '⭐ <strong>MODAICA Puan Sistemi:</strong>\n\n• Her 100₺ alışverişe 1 puan kazanırsınız\n• Puanlar bir sonraki alışverişte kullanılabilir\n• Bronze → Silver → Gold → Platinum seviyeleri\n\nSeviyeniz arttıkça özel indirimler ve erken erişim kazanırsınız!',
      opts: [
        { label: '⭐ Puanlarımı gör', action: () => window.location.href = 'hesabim.html#points' },
        { label: '↩️ Geri', next: 'campaigns' },
      ],
    },

    // ── HESAP ───────────────────────────────────────────────
    account: {
      msg: 'Hesabınızla ilgili konuyu seçin:',
      opts: [
        { label: '🔑 Şifremi unuttum',           next: 'acc_pass'   },
        { label: '📧 E-posta değiştirmek istiyorum', next: 'acc_email' },
        { label: '🗑️ Hesabımı kapatmak istiyorum', next: 'acc_delete' },
        { label: '↩️ Ana menü',                    next: 'start'      },
      ],
    },

    acc_pass: {
      msg: '🔑 Şifrenizi <strong>Giriş Yap</strong> sayfasındaki "Şifremi Unuttum" bağlantısını kullanarak sıfırlayabilirsiniz. Kayıtlı e-postanıza sıfırlama bağlantısı gönderilecektir.',
      opts: [
        { label: '🔑 Şifremi sıfırla', action: () => window.location.href = 'hesabim.html' },
        { label: '↩️ Geri', next: 'account' },
      ],
    },

    acc_email: {
      msg: '📧 E-posta değişikliği için kimlik doğrulama gereklidir. Canlı destek ekibimizle iletişime geçin.',
      opts: [
        { label: '☎️ Canlı Destek', next: 'live', prefix: 'E-posta değişikliği: ' },
        { label: '↩️ Geri', next: 'account' },
      ],
    },

    acc_delete: {
      msg: '⚠️ Hesap kapatma işlemi geri alınamaz. Tüm sipariş geçmişiniz ve puanlarınız silinir.\n\nDevam etmek istiyorsanız <strong>Hesabım → Güvenlik</strong> sayfasından işlem yapabilirsiniz.',
      opts: [
        { label: '⚙️ Güvenlik ayarları', action: () => window.location.href = 'hesabim.html#security' },
        { label: '↩️ Geri', next: 'account' },
      ],
    },

    // ── ÜRÜN ÖNERİSİ ────────────────────────────────────────────
    products: {
      msg: 'Hangi kategoride ürün önerisi istiyorsunuz?',
      opts: [
        { label: '📱 Telefon / Elektronik',   next: 'prod_telefon' },
        { label: '💰 1000₺ altı ürünler',    next: 'prod_ucuz'    },
        { label: '🏃 Spor ürünleri',         next: 'prod_spor'    },
        { label: '👗 Kadın elbise',          next: 'prod_kadin'   },
        { label: '🔥 İndirimli ürünler',     next: 'prod_indirim' },
        { label: '↩️ Ana menü',               next: 'start'        },
      ],
    },

    prod_telefon: {
      msg: '📱 Elektronik kategorisinden öneriler getiriliyor...',
      apiSearch: { department: 'elektronik', limit: 5 },
      searchLink: 'arama.html?q=telefon',
    },

    prod_ucuz: {
      msg: '💰 1000₺ altı en uygun fiyatlı ürünler getiriliyor...',
      apiSearch: { price_max: 1000, sort: 'price_asc', limit: 5 },
      searchLink: 'arama.html',
    },

    prod_spor: {
      msg: '🏃 Spor kategorisinden ürünler getiriliyor...',
      apiSearch: { department: 'spor', limit: 5 },
      searchLink: 'spor.html',
    },

    prod_kadin: {
      msg: '👗 Kadın giyim kategorisinden öneriler getiriliyor...',
      apiSearch: { department: 'kadin', limit: 5 },
      searchLink: 'kadin.html',
    },

    prod_indirim: {
      msg: '🔥 İndirimli ürünler getiriliyor...',
      apiSearch: { on_sale: '1', sort: 'discount', limit: 5 },
      searchLink: 'arama.html',
    },

    // ── CANLI DESTEK ────────────────────────────────────────
    live: {
      msg: '☎️ Müşteri hizmetlerimize ulaşın:\n\n📞 <strong>0850 XXX XX XX</strong> (Hf içi 09:00–21:00)\n📧 <strong>destek@modaica.com</strong>\n💬 WhatsApp ile anlık destek',
      opts: [
        { label: '💬 WhatsApp\'a yaz', action: () => window.open('https://wa.me/90850XXXXXXX', '_blank') },
        { label: '📧 E-posta gönder', action: () => window.location.href = 'mailto:destek@modaica.com' },
        { label: '↩️ Ana menü', next: 'start' },
      ],
    },
  };

  // ── STİLLER ───────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('sc-styles')) return;
    const s = document.createElement('style');
    s.id = 'sc-styles';
    s.textContent = `
      /* ── FAB ── */
      .sc-fab { position:fixed; bottom:28px; right:28px; z-index:9998; }
      .sc-fab-btn { width:62px; height:62px; border-radius:50%; background:linear-gradient(135deg,#1a1f5e,#2d3aaa); border:none; cursor:pointer; box-shadow:0 8px 24px rgba(26,31,94,.4); display:flex; align-items:center; justify-content:center; font-size:26px; transition:transform .25s cubic-bezier(.34,1.56,.64,1); position:relative; }
      .sc-fab-btn:hover { transform:scale(1.08); }
      .sc-fab-btn.open  { transform:scale(.92); }
      .sc-fab-dot { position:absolute; top:2px; right:2px; width:14px; height:14px; background:#e63946; border-radius:50%; border:2px solid white; animation:sc-pulse 2s infinite; display:none; }
      @keyframes sc-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.3)} }

      /* ── PANEL ── */
      .sc-panel { position:fixed; bottom:100px; right:28px; width:380px; height:580px; background:white; border-radius:20px; box-shadow:0 24px 64px rgba(0,0,0,.18); display:flex; flex-direction:column; overflow:hidden; z-index:9997; opacity:0; transform:translateY(20px) scale(.96); pointer-events:none; transition:all .3s cubic-bezier(.4,0,.2,1); font-family:'DM Sans',sans-serif; }
      .sc-panel.open { opacity:1; transform:translateY(0) scale(1); pointer-events:all; }

      /* Header */
      .sc-head { background:linear-gradient(135deg,#1a1f5e,#2d3aaa); padding:14px 18px; display:flex; align-items:center; gap:12px; flex-shrink:0; }
      .sc-head-av { width:42px; height:42px; background:rgba(255,255,255,.15); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; border:2px solid rgba(255,255,255,.2); }
      .sc-head-info { flex:1; }
      .sc-head-name { color:white; font-size:14px; font-weight:700; display:flex; align-items:center; gap:7px; }
      .sc-head-dot { width:7px; height:7px; background:#4ade80; border-radius:50%; animation:sc-pulse 2s infinite; }
      .sc-head-sub { color:rgba(255,255,255,.6); font-size:11px; margin-top:2px; }
      .sc-head-home { background:rgba(255,255,255,.12); border:none; color:rgba(255,255,255,.8); height:30px; padding:0 10px; border-radius:8px; cursor:pointer; font-size:12px; font-family:inherit; font-weight:600; transition:background .2s; white-space:nowrap; }
      .sc-head-home:hover { background:rgba(255,255,255,.22); }

      /* Mesajlar */
      .sc-msgs { flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px; scroll-behavior:smooth; }
      .sc-msgs::-webkit-scrollbar { width:4px; }
      .sc-msgs::-webkit-scrollbar-thumb { background:#e5e7eb; border-radius:2px; }

      /* Baloncuklar */
      .sc-msg { display:flex; gap:8px; animation:sc-in .22s ease; }
      .sc-msg.user { flex-direction:row-reverse; }
      @keyframes sc-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      .sc-av { width:28px; height:28px; border-radius:9px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:13px; }
      .sc-msg.bot .sc-av  { background:linear-gradient(135deg,#1a1f5e,#2d3aaa); }
      .sc-msg.user .sc-av { background:linear-gradient(135deg,#64748b,#94a3b8); }
      .sc-bubble { max-width:85%; padding:10px 14px; border-radius:14px; font-size:13px; line-height:1.65; }
      .sc-msg.bot  .sc-bubble { background:#f8f9fc; border:1px solid #e5e7eb; color:#1c1c2e; }
      .sc-msg.user .sc-bubble { background:linear-gradient(135deg,#1a1f5e,#2d3aaa); color:white; }

      /* Seçenek butonları */
      .sc-options { display:flex; flex-direction:column; gap:6px; margin-top:4px; }
      .sc-opt { background:white; border:1.5px solid #e5e7eb; border-radius:10px; padding:9px 13px; font-size:12.5px; font-weight:500; cursor:pointer; font-family:inherit; transition:all .18s; color:#1c1c2e; text-align:left; display:flex; align-items:center; gap:6px; }
      .sc-opt:hover { border-color:#2d3aaa; color:#1a1f5e; background:#f5f7ff; transform:translateX(2px); }
      .sc-opt:disabled { opacity:.45; cursor:default; transform:none; }

      /* Typing */
      .sc-typing { display:flex; gap:4px; align-items:center; padding:12px 14px; }
      .sc-td { width:7px; height:7px; background:#9ca3af; border-radius:50%; animation:sc-bounce .9s infinite; }
      .sc-td:nth-child(2){animation-delay:.15s} .sc-td:nth-child(3){animation-delay:.3s}
      @keyframes sc-bounce {0%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-5px);opacity:1}}

      /* Footer */
      .sc-footer { text-align:center; padding:8px 12px 10px; font-size:10px; color:#9ca3af; flex-shrink:0; border-top:1px solid #f1f5f9; }
      .sc-footer span { color:#2d3aaa; font-weight:600; }

      /* Ürün kartları */
      .sc-prod-grid { display:flex; flex-direction:column; gap:6px; margin-top:4px; max-width:280px; }
      .sc-prod-card { display:flex; align-items:center; gap:10px; background:white; border:1.5px solid #e5e7eb; border-radius:10px; padding:8px 10px; text-decoration:none; color:#1c1c2e; transition:all .18s; }
      .sc-prod-card:hover { border-color:#2d3aaa; background:#f5f7ff; }
      .sc-prod-emoji { font-size:24px; flex-shrink:0; }
      .sc-prod-info { flex:1; min-width:0; }
      .sc-prod-name { font-weight:600; font-size:12px; line-height:1.3; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .sc-prod-price { font-size:13px; font-weight:700; color:#1a1f5e; }
      .sc-prod-price s { font-size:11px; color:#9ca3af; font-weight:400; margin-left:4px; }

      @media(max-width:440px) { .sc-panel{width:calc(100vw - 16px);right:8px;bottom:90px;height:78vh;} .sc-fab{right:16px;bottom:16px;} }
    `;
    document.head.appendChild(s);
  }

  // ── WIDGET ────────────────────────────────────────────────
  function createWidget() {
    const wrap = document.createElement('div');
    wrap.className = 'sc-fab';
    wrap.innerHTML = `
      <div class="sc-panel" id="sc-panel">
        <div class="sc-head">
          <div class="sc-head-av">🎧</div>
          <div class="sc-head-info">
            <div class="sc-head-name">Destek <div class="sc-head-dot"></div></div>
            <div class="sc-head-sub">MODAICA Müşteri Hizmetleri</div>
          </div>
          <button class="sc-head-home" id="sc-home-btn">🏠 Ana Menü</button>
        </div>
        <div class="sc-msgs" id="sc-msgs"></div>
        <div class="sc-footer">MODAICA Destek · Hf içi 09:00–21:00</div>
      </div>
      <button class="sc-fab-btn" id="sc-fab-btn" aria-label="Destek">
        <span id="sc-fab-icon">💬</span>
        <div class="sc-fab-dot" id="sc-fab-dot"></div>
      </button>`;

    document.body.appendChild(wrap);

    document.getElementById('sc-fab-btn').addEventListener('click', toggle);
    document.getElementById('sc-home-btn').addEventListener('click', () => goFlow('start'));

    setTimeout(() => {
      if (!isOpen) document.getElementById('sc-fab-dot').style.display = 'block';
    }, 4000);
  }

  // ── STATE ─────────────────────────────────────────────────
  let isOpen       = false;
  let pendingPrefix = '';

  function toggle() {
    isOpen = !isOpen;
    document.getElementById('sc-panel').classList.toggle('open', isOpen);
    document.getElementById('sc-fab-btn').classList.toggle('open', isOpen);
    document.getElementById('sc-fab-icon').textContent = isOpen ? '✕' : '💬';
    document.getElementById('sc-fab-dot').style.display = 'none';

    if (isOpen && !document.getElementById('sc-msgs').children.length) {
      setTimeout(() => goFlow('start'), 300);
    }
  }

  // ── ÜRÜN ARAMA YARDIMCIları ───────────────────────────────
  function chatAPIBase() {
    const h = window.location.hostname;
    return 'http://' + (h === 'localhost' || h === '127.0.0.1' ? h : 'localhost') + '/modaica/backend/api';
  }

  function fmtPrice(n) {
    return parseFloat(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function fetchChatProducts(params) {
    const api = chatAPIBase();
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && q.set(k, v));
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(`${api}/products?${q}`, { signal: ctrl.signal });
      clearTimeout(timer);
      const d = await r.json();
      if (d.success) return d.data.items || d.data || [];
    } catch (_) {}
    return [];
  }

  function addProductCards(products, backFlow, searchLink) {
    const msgs = document.getElementById('sc-msgs');

    const wrap = document.createElement('div');
    wrap.className = 'sc-msg bot';
    const av = document.createElement('div');
    av.className = 'sc-av';
    av.textContent = '🎧';

    const grid = document.createElement('div');
    grid.className = 'sc-prod-grid';
    products.forEach(p => {
      const a = document.createElement('a');
      a.className = 'sc-prod-card';
      a.href = `urun-detay.html?sku=${encodeURIComponent(p.sku || '')}`;
      a.innerHTML = `
        <span class="sc-prod-emoji">${escHtml(p.emoji || '🛍️')}</span>
        <div class="sc-prod-info">
          <div class="sc-prod-name">${escHtml(p.name || '')}</div>
          <div class="sc-prod-price">₺${fmtPrice(p.price)}${p.old_price ? ` <s>₺${fmtPrice(p.old_price)}</s>` : ''}</div>
        </div>`;
      grid.appendChild(a);
    });

    wrap.appendChild(av);
    wrap.appendChild(grid);
    msgs.appendChild(wrap);

    addMsg('bot', '', [
      { label: '🔍 Tümünü Gör', action: () => { window.location.href = searchLink; } },
      { label: '↩️ Geri',        next: backFlow },
    ]);

    msgs.scrollTop = msgs.scrollHeight;
  }

  // ── AKIŞ MOTORU ───────────────────────────────────────────
  function goFlow(key, userLabel) {
    const flow = FLOWS[key];
    if (!flow) return;

    if (userLabel) addMsg('user', userLabel);

    disableAllOptions();

    // API arama akışı
    if (flow.apiSearch) {
      addMsg('bot', flow.msg);
      showTyping();
      fetchChatProducts(flow.apiSearch).then(items => {
        hideTyping();
        if (items.length) {
          addMsg('bot', `✅ ${items.length} ürün bulundu:`);
          addProductCards(items.slice(0, 5), 'products', flow.searchLink || 'arama.html');
        } else {
          addMsg('bot', '😔 Şu anda uygun ürün bulunamadı.', [
            { label: '🔍 Aramaya git', action: () => { window.location.href = flow.searchLink || 'arama.html'; } },
            { label: '↩️ Geri', next: 'products' },
          ]);
        }
      }).catch(() => {
        hideTyping();
        addMsg('bot', '⚠️ Ürünler yüklenemedi. Lütfen sayfayı yenileyin ya da aramayı deneyin.', [
          { label: '🔍 Aramaya git', action: () => { window.location.href = 'arama.html'; } },
          { label: '↩️ Geri', next: 'products' },
        ]);
      });
      return;
    }

    setTimeout(() => {
      showTyping();
      setTimeout(() => {
        hideTyping();
        const prefix = pendingPrefix;
        pendingPrefix = '';

        let text = flow.msg;
        if (prefix && key === 'live') {
          text = `<em style="color:#6b7280;font-size:11px;">Konu: ${escHtml(prefix)}</em>\n\n` + text;
        }

        addMsg('bot', text, flow.opts);
      }, 600);
    }, userLabel ? 300 : 0);
  }

  // ── MESAJ EKLEME ──────────────────────────────────────────
  function addMsg(role, html, opts) {
    const msgs  = document.getElementById('sc-msgs');
    const wrap  = document.createElement('div');
    wrap.className = `sc-msg ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'sc-bubble';

    // HTML içerik — bot mesajları güvenli HTML içerir (sunucu değil, sabit string)
    if (role === 'bot') {
      bubble.innerHTML = html.replace(/\n/g, '<br>');
    } else {
      bubble.textContent = html;
    }

    // Seçenek butonları
    if (opts && opts.length) {
      const optWrap = document.createElement('div');
      optWrap.className = 'sc-options';
      opts.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'sc-opt';
        btn.textContent = opt.label;
        btn.addEventListener('click', () => {
          if (opt.action) {
            addMsg('user', opt.label);
            disableAllOptions();
            opt.action();
          } else if (opt.next) {
            if (opt.prefix) pendingPrefix = opt.prefix;
            goFlow(opt.next, opt.label);
          }
        });
        optWrap.appendChild(btn);
      });
      bubble.appendChild(optWrap);
    }

    const av = document.createElement('div');
    av.className = 'sc-av';
    av.textContent = role === 'bot' ? '🎧' : '👤';

    wrap.appendChild(av);
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function disableAllOptions() {
    document.querySelectorAll('.sc-opt').forEach(b => { b.disabled = true; });
  }

  function showTyping() {
    const msgs = document.getElementById('sc-msgs');
    const el   = document.createElement('div');
    el.id = 'sc-typing'; el.className = 'sc-msg bot';
    el.innerHTML = '<div class="sc-av">🎧</div><div class="sc-bubble sc-typing"><div class="sc-td"></div><div class="sc-td"></div><div class="sc-td"></div></div>';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() { document.getElementById('sc-typing')?.remove(); }

  function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── BAŞLAT ────────────────────────────────────────────────
  function init() {
    injectStyles();
    createWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

// Eski new SmartChat('chat-root') çağrıları için uyumluluk stub'ı
// Widget zaten IIFE tarafından otomatik oluşturulduğundan no-op.
window.SmartChat = function SmartChat() {};
