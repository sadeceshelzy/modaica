// ============================================================
//  MODAICA — Ürün Görsel Galerisi Widget
//  Kullanım: new ProductGallery('container-id', 'URUN-SKU', emojiBackup)
// ============================================================

class ProductGallery {
  constructor(containerId, sku, fallbackEmoji = '🛍️') {
    this.container = document.getElementById(containerId);
    this.sku       = sku;
    this.emoji     = fallbackEmoji;
    this.imageUrl  = null;
    this.images    = [];
    this.current   = 0;
    this.API       = (typeof API_BASE !== 'undefined' ? API_BASE : ('http://' + location.hostname + (location.port ? ':' + location.port : '') + '/modaica/backend')) + '/api';
    this.init();
  }

  setFallback(url) {
    this.imageUrl = url || null;
    if (this.images.length === 0 && this.imageUrl) {
      const inner = document.getElementById(`pg-main-${this.sku}`);
      if (inner) inner.innerHTML = `<img class="pg-main-img" src="${this.imageUrl}" alt="${this.sku}" style="width:100%;height:100%;object-fit:contain;">`;
    }
  }

  async init() {
    await this.loadImages();
    this.render();
  }

  async loadImages() {
    try {
      const r = await fetch(`${this.API}/upload/list?sku=${this.sku}`);
      const d = await r.json();
      if (d.success && d.data.images?.length) {
        // Birincil görsel öne al
        this.images = d.data.images.sort((a, b) => b.is_primary - a.is_primary);
      }
    } catch(_) {}
  }

  render() {
    const hasImages = this.images.length > 0;

    this.container.innerHTML = `
    <style>
      .pg-wrap{position:relative;user-select:none;}
      .pg-main{position:relative;width:100%;padding-bottom:100%;background:#f8f9fc;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;}
      .pg-main-inner{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}
      .pg-main-img{width:100%;height:100%;object-fit:contain;transition:opacity .25s ease;}
      .pg-main-emoji{font-size:120px;line-height:1;}
      .pg-badge{position:absolute;top:12px;left:12px;background:#e63946;color:white;font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;}
      .pg-zoom-btn{position:absolute;bottom:12px;right:12px;background:rgba(255,255,255,.9);border:1px solid #e5e7eb;width:36px;height:36px;border-radius:10px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:all .2s;}
      .pg-zoom-btn:hover{background:white;box-shadow:0 4px 12px rgba(0,0,0,.1);}
      .pg-arrow{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.92);border:1px solid #e5e7eb;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .2s;z-index:2;box-shadow:0 2px 8px rgba(0,0,0,.08);}
      .pg-arrow:hover{background:white;box-shadow:0 4px 14px rgba(0,0,0,.12);}
      .pg-prev{left:10px;} .pg-next{right:10px;}
      .pg-arrow:disabled{opacity:.3;cursor:default;}
      .pg-thumbs{display:flex;gap:8px;margin-top:10px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;}
      .pg-thumbs::-webkit-scrollbar{height:4px;}
      .pg-thumbs::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:2px;}
      .pg-thumb{width:68px;height:68px;border-radius:10px;object-fit:cover;cursor:pointer;border:2px solid transparent;transition:all .18s;flex-shrink:0;background:#f8f9fc;}
      .pg-thumb.active{border-color:#1a1f5e;box-shadow:0 0 0 2px rgba(26,31,94,.15);}
      .pg-thumb:hover{border-color:#9ca3af;}
      .pg-thumb-emoji{width:68px;height:68px;border-radius:10px;background:#f8f9fc;border:2px solid #e5e7eb;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;flex-shrink:0;}
      .pg-count{position:absolute;bottom:12px;left:12px;background:rgba(0,0,0,.5);color:white;font-size:11px;font-weight:600;padding:3px 9px;border-radius:8px;}

      /* Lightbox */
      .pg-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;}
      .pg-lightbox-img{max-width:90vw;max-height:80vh;border-radius:10px;object-fit:contain;}
      .pg-lightbox-close{position:absolute;top:20px;right:20px;background:rgba(255,255,255,.12);border:none;color:white;font-size:22px;width:44px;height:44px;border-radius:12px;cursor:pointer;}
      .pg-lightbox-nav{display:flex;gap:10px;}
      .pg-lightbox-nav button{background:rgba(255,255,255,.12);border:none;color:white;padding:10px 20px;border-radius:10px;font-size:14px;cursor:pointer;font-family:inherit;}
      .pg-lightbox-nav button:hover{background:rgba(255,255,255,.22);}
      .pg-lightbox-counter{color:rgba(255,255,255,.6);font-size:13px;}
    </style>

    <div class="pg-wrap" id="pg-${this.sku}">
      <!-- Ana görsel -->
      <div class="pg-main">
        <div class="pg-main-inner" id="pg-main-${this.sku}">
          ${hasImages
            ? `<img class="pg-main-img" id="pg-img-${this.sku}" src="${this.images[0].path}" alt="${this.images[0].alt_text||'Ürün görseli'}">`
            : this.imageUrl
              ? `<img class="pg-main-img" src="${this.imageUrl}" alt="Ürün görseli" style="object-fit:contain;">`
              : `<span class="pg-main-emoji">${this.emoji}</span>`
          }
        </div>
        ${hasImages && this.images.length > 1 ? `
          <button class="pg-arrow pg-prev" onclick="gallery_${this.sku.replace(/-/g,'_')}.prev()">‹</button>
          <button class="pg-arrow pg-next" onclick="gallery_${this.sku.replace(/-/g,'_')}.next()">›</button>
          <span class="pg-count" id="pg-count-${this.sku}">1 / ${this.images.length}</span>
        ` : ''}
        ${hasImages ? `<button class="pg-zoom-btn" onclick="gallery_${this.sku.replace(/-/g,'_')}.openLightbox()">🔍</button>` : ''}
      </div>

      <!-- Thumbnail'lar -->
      ${hasImages && this.images.length > 1 ? `
        <div class="pg-thumbs" id="pg-thumbs-${this.sku}">
          ${this.images.map((img, i) =>
            `<img class="pg-thumb ${i===0?'active':''}" src="${img.path}" alt="" onclick="gallery_${this.sku.replace(/-/g,'_')}.goTo(${i})">`
          ).join('')}
        </div>` : ''
      }
    </div>`;

    // Global erişim için kaydet
    window[`gallery_${this.sku.replace(/-/g,'_')}`] = this;

    // Klavye navigasyonu
    document.addEventListener('keydown', e => {
      if (document.querySelector('.pg-lightbox')) {
        if (e.key === 'ArrowLeft')  this.prev();
        if (e.key === 'ArrowRight') this.next();
        if (e.key === 'Escape')     document.querySelector('.pg-lightbox')?.remove();
      }
    });

    // Swipe desteği (mobil)
    this.initSwipe();
  }

  goTo(index) {
    if (!this.images.length) return;
    this.current = Math.max(0, Math.min(index, this.images.length - 1));
    const img = document.getElementById(`pg-img-${this.sku}`);
    if (img) {
      img.style.opacity = '0';
      setTimeout(() => {
        img.src = this.images[this.current].path;
        img.alt = this.images[this.current].alt_text || '';
        img.style.opacity = '1';
      }, 150);
    }
    // Thumbnail aktif
    document.querySelectorAll(`#pg-thumbs-${this.sku} .pg-thumb`).forEach((t, i) => {
      t.classList.toggle('active', i === this.current);
    });
    // Sayaç
    const counter = document.getElementById(`pg-count-${this.sku}`);
    if (counter) counter.textContent = `${this.current + 1} / ${this.images.length}`;

    // Lightbox güncelle
    const lbImg = document.querySelector('.pg-lightbox-img');
    if (lbImg) lbImg.src = this.images[this.current].path;
    const lbCnt = document.querySelector('.pg-lightbox-counter');
    if (lbCnt) lbCnt.textContent = `${this.current + 1} / ${this.images.length}`;
  }

  prev() { this.goTo(this.current - 1 < 0 ? this.images.length - 1 : this.current - 1); }
  next() { this.goTo(this.current + 1 >= this.images.length ? 0 : this.current + 1); }

  openLightbox() {
    if (!this.images.length) return;
    const sku = this.sku.replace(/-/g,'_');
    const lb  = document.createElement('div');
    lb.className = 'pg-lightbox';
    lb.innerHTML = `
      <button class="pg-lightbox-close" onclick="document.querySelector('.pg-lightbox').remove()">✕</button>
      <img class="pg-lightbox-img" src="${this.images[this.current].path}" alt="">
      ${this.images.length > 1 ? `
        <div class="pg-lightbox-nav">
          <button onclick="gallery_${sku}.prev()">‹ Önceki</button>
          <span class="pg-lightbox-counter">${this.current+1} / ${this.images.length}</span>
          <button onclick="gallery_${sku}.next()">Sonraki ›</button>
        </div>
        <div class="pg-lightbox-nav" style="gap:6px;flex-wrap:wrap;justify-content:center;max-width:400px;">
          ${this.images.map((img,i) =>
            `<img src="${img.path}" onclick="gallery_${sku}.goTo(${i})"
              style="width:52px;height:52px;border-radius:8px;object-fit:cover;cursor:pointer;border:2px solid ${i===this.current?'white':'rgba(255,255,255,.2)'};">`
          ).join('')}
        </div>` : ''
      }`;
    lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
    document.body.appendChild(lb);
  }

  initSwipe() {
    const main = document.querySelector(`#pg-${this.sku} .pg-main`);
    if (!main || this.images.length <= 1) return;
    let startX = 0;
    main.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    main.addEventListener('touchend', e => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) { diff > 0 ? this.next() : this.prev(); }
    });
  }
}

// ── Admin/Satıcı için görsel yönetim arayüzü ─────────────────
class ProductImageManager {
  constructor(containerId, sku) {
    this.container = document.getElementById(containerId);
    this.sku       = sku;
    this.API       = (typeof API_BASE !== 'undefined' ? API_BASE : ('http://' + location.hostname + (location.port ? ':' + location.port : '') + '/modaica/backend')) + '/api';
    this.token     = localStorage.getItem('adminToken') || localStorage.getItem('vendorToken') || '';
    this.render();
    this.loadImages();
  }

  render() {
    this.container.innerHTML = `
    <style>
      .pim-wrap{background:#f8f9fc;border-radius:14px;border:1px solid #e5e7eb;padding:20px;}
      .pim-wrap h3{font-size:15px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;}
      .pim-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;margin-bottom:16px;}
      .pim-img-card{position:relative;border-radius:10px;overflow:hidden;border:2px solid #e5e7eb;aspect-ratio:1;}
      .pim-img-card.primary{border-color:#1a1f5e;}
      .pim-img-card img{width:100%;height:100%;object-fit:cover;}
      .pim-actions{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.6);padding:4px;display:flex;gap:4px;justify-content:center;opacity:0;transition:opacity .2s;}
      .pim-img-card:hover .pim-actions{opacity:1;}
      .pim-act-btn{background:white;border:none;border-radius:5px;padding:3px 7px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;}
      .pim-primary-badge{position:absolute;top:4px;left:4px;background:#1a1f5e;color:white;font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;}
      .pim-tabs{display:flex;gap:8px;margin-bottom:14px;border-bottom:1px solid #e5e7eb;padding-bottom:8px;}
      .pim-tab{padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:none;font-family:inherit;color:#6b7280;border-radius:8px;transition:all .18s;}
      .pim-tab.active{background:#1a1f5e;color:white;}
      .pim-upload-zone{border:2px dashed #e5e7eb;border-radius:12px;padding:28px;text-align:center;cursor:pointer;transition:all .2s;}
      .pim-upload-zone:hover{border-color:#1a1f5e;background:rgba(26,31,94,.02);}
      .pim-unsplash-search{display:flex;gap:8px;margin-bottom:12px;}
      .pim-unsplash-search input{flex:1;border:1.5px solid #e5e7eb;border-radius:9px;padding:9px 13px;font-size:13px;outline:none;font-family:inherit;}
      .pim-unsplash-search input:focus{border-color:#1a1f5e;}
      .pim-unsplash-search button{background:#1a1f5e;color:white;border:none;padding:9px 18px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
      .pim-unsplash-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:300px;overflow-y:auto;}
      .pim-unsp-img{border-radius:8px;overflow:hidden;cursor:pointer;aspect-ratio:1;border:2px solid transparent;transition:all .18s;}
      .pim-unsp-img:hover{border-color:#1a1f5e;}
      .pim-unsp-img img{width:100%;height:100%;object-fit:cover;}
    </style>
    <div class="pim-wrap">
      <h3>🖼️ Ürün Görselleri <span style="font-size:12px;font-weight:400;color:#6b7280;">(${this.sku})</span></h3>
      <div class="pim-grid" id="pim-grid"></div>
      <div class="pim-tabs">
        <button class="pim-tab active" onclick="imgMgr.switchTab('upload',this)">📁 Dosya Yükle</button>
        <button class="pim-tab" onclick="imgMgr.switchTab('unsplash',this)">🔍 Unsplash'tan Ara</button>
      </div>
      <!-- Dosya yükleme -->
      <div id="pim-pane-upload">
        <div class="pim-upload-zone" onclick="document.getElementById('pim-file').click()">
          <div style="font-size:32px;margin-bottom:8px;">📷</div>
          <div style="font-weight:700;font-size:14px;color:#1a1f5e;">Görsel seçmek için tıklayın</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">JPEG, PNG, WebP · Max 5MB · Max 8 görsel</div>
        </div>
        <input type="file" id="pim-file" accept="image/*" multiple style="display:none" onchange="imgMgr.uploadFiles(this)">
      </div>
      <!-- Unsplash -->
      <div id="pim-pane-unsplash" style="display:none;">
        <div class="pim-unsplash-search">
          <input id="pim-unsp-q" placeholder="Örn: fashion, electronics, home decor..." onkeydown="if(event.key==='Enter')imgMgr.searchUnsplash()">
          <button onclick="imgMgr.searchUnsplash()">Ara</button>
        </div>
        <div class="pim-unsplash-grid" id="pim-unsp-grid">
          <p style="color:#6b7280;font-size:13px;grid-column:1/-1;text-align:center;padding:20px;">Ürününüze uygun fotoğrafları aramak için yukarıya yazın.</p>
        </div>
      </div>
    </div>`;
    window.imgMgr = this;
  }

  switchTab(pane, el) {
    document.querySelectorAll('.pim-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('pim-pane-upload').style.display   = pane === 'upload'    ? 'block' : 'none';
    document.getElementById('pim-pane-unsplash').style.display = pane === 'unsplash'  ? 'block' : 'none';
  }

  async loadImages() {
    const r = await fetch(`${this.API}/upload/list?sku=${this.sku}`);
    const d = await r.json();
    if (!d.success) return;
    const grid = document.getElementById('pim-grid');
    grid.innerHTML = d.data.images.map(img => `
      <div class="pim-img-card ${img.is_primary?'primary':''}">
        ${img.is_primary ? '<span class="pim-primary-badge">Ana</span>' : ''}
        <img src="${img.path}" alt="">
        <div class="pim-actions">
          ${!img.is_primary ? `<button class="pim-act-btn" onclick="imgMgr.setPrimary(${img.id})" style="background:#1a1f5e;color:white;">Ana</button>` : ''}
          <button class="pim-act-btn" onclick="imgMgr.deleteImage(${img.id})" style="background:#e63946;color:white;">Sil</button>
        </div>
      </div>`).join('') || '<p style="color:#9ca3af;font-size:13px;grid-column:1/-1;">Henüz görsel yok.</p>';
  }

  async uploadFiles(input) {
    for (const file of input.files) {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('sku', this.sku);
      await fetch(`${this.API}/upload/product`, {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + this.token }, body: fd,
      });
    }
    input.value = '';
    this.loadImages();
  }

  async searchUnsplash() {
    const q = document.getElementById('pim-unsp-q')?.value.trim();
    if (!q) return;
    const grid = document.getElementById('pim-unsp-grid');
    grid.innerHTML = '<p style="color:#6b7280;font-size:13px;grid-column:1/-1;text-align:center;padding:20px;">Aranıyor...</p>';
    const r = await fetch(`${this.API}/upload/unsplash?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    if (!d.success || !d.data.results?.length) {
      grid.innerHTML = '<p style="color:#9ca3af;font-size:12px;grid-column:1/-1;text-align:center;padding:16px;">Sonuç bulunamadı.</p>';
      return;
    }
    grid.innerHTML = d.data.results.map(img => `
      <div class="pim-unsp-img" onclick="imgMgr.saveUnsplash('${img.regular}','${img.alt||q}','${img.download_url||''}')">
        <img src="${img.thumb}" alt="${img.alt||''}">
      </div>`).join('');
  }

  async saveUnsplash(url, alt, dlUrl) {
    await fetch(`${this.API}/upload/unsplash-save`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+this.token },
      body: JSON.stringify({ sku: this.sku, image_url: url, alt_text: alt, download_location: dlUrl }),
    });
    this.loadImages();
  }

  async setPrimary(id) {
    await fetch(`${this.API}/upload/${id}/primary`, { method:'PUT', headers:{'Authorization':'Bearer '+this.token} });
    this.loadImages();
  }

  async deleteImage(id) {
    if (!confirm('Görseli silmek istiyor musunuz?')) return;
    await fetch(`${this.API}/upload/${id}`, { method:'DELETE', headers:{'Authorization':'Bearer '+this.token} });
    this.loadImages();
  }
}

window.ProductGallery     = ProductGallery;
window.ProductImageManager = ProductImageManager;
