# MODAICA Akıllı Özellikler
## #1 Akıllı Arama · #2 Akıllı Chatbot → Ürün Önerisi & Destek

---

## 📦 Dosya Yapısı

```
js/
├── smart-search.js     ← Akıllı Arama (arama.html)
└── smart-chat.js       ← Akıllı Chatbot (tüm sayfalarda)

backend/api/
├── search/index.php    ← Arama API
└── products/index.php  ← Ürün API (chatbot buradan veri çeker)
```

---

## 1️⃣ Akıllı Arama Kurulumu

### Adım 1: DB
phpMyAdmin → `schema_search.sql` → Çalıştır

### Adım 2: Dosyalar
```
api/search/index.php    ← search.php'yi buraya koy
js/smart-search.js      ← buraya koy
```

### Adım 3: arama.html sayfasını güncelle
Mevcut arama sayfanın içeriğini şununla değiştir:
```html
<body>
  <div id="search-root"></div>

  <script src="js/smart-search.js"></script>
  <script>
    new SmartSearch('search-root');
  </script>
</body>
```

### Adım 4: Her sayfadaki arama kutusunu bağla
Mevcut arama input'unu güncelle:
```html
<input type="text" placeholder="Ara..."
  onkeydown="if(event.key==='Enter')window.location='arama.html?q='+this.value">
```

### Özellikler
| Özellik | Örnek |
|---------|-------|
| Yazım toleransı | "ayfon" → iPhone sonuçları |
| Türkçe normalize | "İstanbul" = "istanbul" = "ıstanbul" |
| Niyet analizi | "ucuz kulaklık" → fiyat_asc sıralama |
| Bütçe çıkarma | "2000₺ altı" → max_price:2000 |
| Fuzzy match | Levenshtein mesafesi %55+ → göster |
| Autocomplete | 250ms debounce, 10 öneri |
| Yazım düzeltme | "samsun" → Samsung |
| Arama geçmişi | Kullanıcıya özel |
| Popüler aramalar | Tüm kullanıcılardan |
| Filtreler | Kategori + fiyat aralığı |

---

## 2️⃣ Akıllı Chatbot

Harici API gerektirmez — tamamen yerel (kural tabanlı + ürün API'si) çalışır.

### Chatbot Özellikleri

**Ürün Önerisi (demo senaryoları):**
| Kullanıcı Seçer | Chatbot Ne Yapar |
|----------------|-----------------|
| 📱 Telefon / Elektronik | Elektronik kategorisinden ürünler listeler |
| 💰 1000₺ altı ürünler | `price_max=1000` filtresiyle ucuz ürünler getirir |
| 🏃 Spor ürünleri | Spor kategorisini listeler |
| 👗 Kadın elbise | Kadın giyim kategorisini listeler |
| 🔥 İndirimli ürünler | `on_sale=1` filtresiyle indirimli ürünler getirir |

**Destek akışları:** Sipariş takibi, iade, kargo, ödeme, kampanya/kupon, hesap

**Hata durumunda:** Kullanıcı dostu mesaj + aramaya yönlendirme

### Her sayfaya eklemek için
```html
<script src="js/smart-chat.js"></script>
```
Widget otomatik oluşur, ek konfigürasyon gerekmez.

---

## ✅ Test Senaryoları

### Akıllı Arama
1. "ayfon" yaz → iPhone sonuçları geldi mi?
2. "ucuz bluetooth kulaklık" yaz → price_asc sıralama var mı?
3. "2000₺ altı laptop" yaz → max fiyat filtresi çalıştı mı?
4. "kadın elbise" yaz → kadin departmanı otomatik seçildi mi?

### Akıllı Chatbot
1. Sağ alttaki 💬 butona tıkla → Chatbot açılıyor mu?
2. "🛍️ Ürün Önerisi" → "📱 Telefon" seç → Ürün kartları geliyor mu?
3. "💰 1000₺ altı" seç → Fiyata göre sıralı ürünler geliyor mu?
4. "🔥 İndirimli" seç → İndirimli ürünler listeleniyor mu?

---

## 🔧 Sorun Giderme

**Arama sonuç vermiyor**
→ `api/search/index.php` dosya yolu doğru mu?
→ DB tabloları oluştu mu?

**Chatbot ürünleri getirmiyor**
→ XAMPP Apache ve MySQL çalıştığından emin olun
→ Tarayıcı konsolunda hata varsa `/modaica/backend/api/products` isteğini kontrol edin

**Türkçe karakterler bozuk**
→ DB collation: `utf8mb4_unicode_ci` olmalı
→ PHP: `mb_internal_encoding('UTF-8')` ekle
