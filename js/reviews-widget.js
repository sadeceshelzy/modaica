// ============================================================
//  MODAICA — Gelişmiş Yorum & Soru-Cevap Widget
//  Kullanım: new ReviewsWidget('container-id', 'URUN-SKU')
// ============================================================

class ReviewsWidget {
  constructor(containerId, productSku) {
    this.container  = document.getElementById(containerId);
    this.sku        = productSku;
    this.page       = 1;
    this.filter     = '';
    this.sort       = 'newest';
    this.summary    = null;
    this.pendingImages = [];
    this.API        = (typeof API_BASE !== 'undefined' ? API_BASE : ('http://' + location.hostname + (location.port ? ':' + location.port : '') + '/modaica/backend')) + '/api';
    this.init();
  }

  async init() {
    await this.loadSummary();
    this.render();
    this.loadReviews();
    this.loadQuestions();
  }

  async loadSummary() {
    try {
      const r = await fetch(`${this.API}/reviews/summary?product_id=${this.sku}`);
      const d = await r.json();
      if (d.success) this.summary = d.data;
    } catch (_) {}
  }

  render() {
    const s = this.summary;
    const avg   = s?.avg_rating || 0;
    const total = s?.total || 0;
    const dist  = s?.distribution || {};
    this.container.innerHTML = `
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      .rw-wrap{font-family:'DM Sans',sans-serif;color:#1c1c2e;margin:32px 0;}
      .rw-tabs{display:flex;border-bottom:2px solid #e5e7eb;margin-bottom:24px;gap:0;}
      .rw-tab{padding:12px 20px;font-size:15px;font-weight:600;cursor:pointer;border:none;background:none;color:#6b7280;border-bottom:2px solid transparent;margin-bottom:-2px;font-family:inherit;transition:all .2s;}
      .rw-tab.active{color:#1a1f5e;border-bottom-color:#1a1f5e;}
      .rw-pane{display:none;}.rw-pane.active{display:block;}
      .rw-summary{display:grid;grid-template-columns:auto 1fr;gap:28px;padding:24px;background:#f8f9fc;border-radius:16px;border:1px solid #e5e7eb;margin-bottom:20px;align-items:center;}
      .rw-big-score{text-align:center;}
      .rw-score-num{font-size:56px;font-weight:900;color:#1a1f5e;line-height:1;}
      .rw-stars-row{display:flex;gap:3px;justify-content:center;margin:6px 0;}
      .rw-score-cnt{font-size:13px;color:#6b7280;}
      .rw-bars{flex:1;}
      .rw-bar-row{display:flex;align-items:center;gap:10px;margin-bottom:7px;cursor:pointer;}
      .rw-bar-row:hover .rw-bar-fill{opacity:.8;}
      .rw-bar-label{font-size:12px;font-weight:600;color:#6b7280;width:14px;text-align:right;flex-shrink:0;}
      .rw-bar-bg{flex:1;height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden;}
      .rw-bar-fill{height:100%;background:#f4a226;border-radius:5px;transition:width .4s ease;}
      .rw-bar-cnt{font-size:12px;color:#6b7280;width:28px;text-align:right;flex-shrink:0;}
      .rw-badges{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;}
      .rw-badge{background:white;border:1px solid #e5e7eb;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;color:#374151;cursor:pointer;transition:all .18s;}
      .rw-badge:hover,.rw-badge.active{background:#1a1f5e;color:white;border-color:#1a1f5e;}
      .rw-controls{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;}
      .rw-sort select{border:1px solid #e5e7eb;border-radius:8px;padding:7px 12px;font-size:13px;outline:none;font-family:inherit;}
      .rw-write-btn{background:#1a1f5e;color:white;border:none;padding:9px 18px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .2s;}
      .rw-write-btn:hover{background:#2d3aaa;}
      .rw-card{background:white;border:1px solid #e5e7eb;border-radius:14px;padding:20px;margin-bottom:14px;}
      .rw-card-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;}
      .rw-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#1a1f5e,#2d3aaa);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:700;flex-shrink:0;}
      .rw-user-info{margin-left:10px;flex:1;}
      .rw-username{font-size:14px;font-weight:700;}
      .rw-meta{font-size:12px;color:#6b7280;margin-top:2px;}
      .rw-verified{display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;color:#166834;font-size:11px;font-weight:700;padding:2px 8px;border-radius:8px;margin-left:6px;}
      .rw-title{font-size:15px;font-weight:700;margin-bottom:6px;}
      .rw-body{font-size:14px;color:#374151;line-height:1.7;margin-bottom:10px;}
      .rw-pros-cons{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0;}
      .rw-pro,.rw-con{padding:10px 14px;border-radius:10px;font-size:13px;}
      .rw-pro{background:#f0fdf4;border:1px solid #bbf7d0;}
      .rw-con{background:#fff5f5;border:1px solid #fecaca;}
      .rw-pro-title,.rw-con-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;}
      .rw-pro-title{color:#166834;}.rw-con-title{color:#b91c1c;}
      .rw-images{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;}
      .rw-img{width:72px;height:72px;border-radius:8px;object-fit:cover;cursor:pointer;border:2px solid #e5e7eb;transition:border .2s;}
      .rw-img:hover{border-color:#1a1f5e;}
      .rw-helpful{display:flex;align-items:center;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid #f1f5f9;}
      .rw-helpful-label{font-size:12px;color:#6b7280;}
      .rw-helpful-btn{background:none;border:1px solid #e5e7eb;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;transition:all .18s;}
      .rw-helpful-btn:hover{border-color:#1a1f5e;color:#1a1f5e;}
      .rw-helpful-btn.voted{background:#1a1f5e;color:white;border-color:#1a1f5e;}
      .rw-helpful-btn.voted-no{background:#e63946;color:white;border-color:#e63946;}
      .rw-vendor-reply{background:linear-gradient(135deg,rgba(26,31,94,.04),rgba(45,58,170,.06));border:1px solid rgba(26,31,94,.12);border-radius:10px;padding:14px;margin-top:12px;}
      .rw-vendor-tag{font-size:11px;font-weight:700;color:#1a1f5e;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;display:flex;align-items:center;gap:5px;}
      .rw-vendor-body{font-size:13px;color:#374151;line-height:1.6;}
      .rw-form{background:#f8f9fc;border-radius:16px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;}
      .rw-form h3{font-size:17px;font-weight:700;margin-bottom:20px;}
      .rw-field{margin-bottom:16px;}
      .rw-label{display:block;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;}
      .rw-input,.rw-textarea{width:100%;border:1.5px solid #e5e7eb;border-radius:10px;padding:10px 14px;font-size:14px;font-family:inherit;outline:none;transition:border .2s;}
      .rw-input:focus,.rw-textarea:focus{border-color:#2d3aaa;}
      .rw-star-selector{display:flex;gap:6px;flex-direction:row-reverse;justify-content:flex-end;}
      .rw-star-selector input{display:none;}
      .rw-star-selector label{font-size:32px;cursor:pointer;color:#d1d5db;transition:color .15s;}
      .rw-star-selector input:checked ~ label,.rw-star-selector label:hover,.rw-star-selector label:hover ~ label{color:#f4a226;}
      .rw-img-upload{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
      .rw-img-preview{position:relative;width:64px;height:64px;}
      .rw-img-preview img{width:100%;height:100%;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;}
      .rw-img-preview .rw-img-del{position:absolute;top:-6px;right:-6px;width:18px;height:18px;background:#e63946;color:white;border:none;border-radius:50%;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
      .rw-img-add{width:64px;height:64px;border:2px dashed #e5e7eb;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;font-size:22px;color:#9ca3af;transition:all .2s;}
      .rw-img-add:hover{border-color:#1a1f5e;color:#1a1f5e;}
      .rw-submit{background:#1a1f5e;color:white;border:none;padding:13px 28px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .2s;}
      .rw-submit:hover{background:#2d3aaa;}
      .rw-submit:disabled{opacity:.6;cursor:not-allowed;}
      .rw-alert{padding:11px 14px;border-radius:10px;font-size:14px;margin-bottom:14px;}
      .rw-alert.error{background:#fff5f5;border:1px solid #fecaca;color:#e63946;}
      .rw-alert.success{background:#f0fdf4;border:1px solid #bbf7d0;color:#166834;}
      .qa-card{background:white;border:1px solid #e5e7eb;border-radius:14px;padding:18px;margin-bottom:12px;}
      .qa-q{font-size:15px;font-weight:700;color:#1a1f5e;margin-bottom:10px;display:flex;gap:8px;}
      .qa-q-icon{font-size:16px;flex-shrink:0;margin-top:1px;}
      .qa-answers{padding-left:16px;border-left:3px solid #e5e7eb;margin-top:10px;display:flex;flex-direction:column;gap:10px;}
      .qa-ans{font-size:14px;color:#374151;line-height:1.7;}
      .qa-ans-meta{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
      .qa-vendor-tag{background:#1a1f5e;color:white;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;}
      .qa-ans-author{font-size:12px;font-weight:700;color:#6b7280;}
      .qa-ans-date{font-size:11px;color:#9ca3af;}
      .qa-no-answers{font-size:13px;color:#9ca3af;padding:8px 0;}
      .qa-answer-form{margin-top:10px;}
      .qa-answer-input{width:100%;border:1.5px solid #e5e7eb;border-radius:10px;padding:9px 13px;font-size:13px;font-family:inherit;outline:none;}
      .qa-answer-input:focus{border-color:#2d3aaa;}
      .qa-answer-btn{margin-top:8px;background:#1a1f5e;color:white;border:none;padding:8px 16px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
      .qa-ask-form{background:#f8f9fc;border:1px solid #e5e7eb;border-radius:14px;padding:18px;margin-bottom:20px;}
      .qa-ask-form h3{font-size:15px;font-weight:700;margin-bottom:12px;}
      .rw-more-btn{display:block;width:100%;background:none;border:1.5px solid #e5e7eb;padding:11px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;color:#6b7280;transition:all .2s;margin-top:12px;}
      .rw-more-btn:hover{border-color:#1a1f5e;color:#1a1f5e;}
      .rw-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;display:flex;align-items:center;justify-content:center;}
      .rw-lightbox img{max-width:90vw;max-height:90vh;border-radius:10px;}
      .rw-lightbox-close{position:absolute;top:20px;right:20px;background:rgba(255,255,255,.15);border:none;color:white;font-size:24px;width:44px;height:44px;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
      @media(max-width:600px){.rw-summary{grid-template-columns:1fr;}.rw-pros-cons{grid-template-columns:1fr;}}
    </style>
    <div class="rw-wrap" id="rw-root">
      <!-- SEKMELER -->
      <div class="rw-tabs">
        <button class="rw-tab active" onclick="reviewWidget.switchTab('reviews',this)">
          ⭐ Değerlendirmeler <span style="background:#1a1f5e;color:white;font-size:11px;padding:2px 7px;border-radius:10px;margin-left:4px;">${total}</span>
        </button>
        <button class="rw-tab" onclick="reviewWidget.switchTab('qa',this)">
          💬 Soru & Cevap
        </button>
      </div>

      <!-- ════ DEĞERLENDİRMELER PANELİ ════ -->
      <div id="rw-pane-reviews" class="rw-pane active">

        <!-- Özet -->
        <div class="rw-summary">
          <div class="rw-big-score">
            <div class="rw-score-num">${avg.toFixed(1)}</div>
            <div class="rw-stars-row">${this.starsHtml(avg)}</div>
            <div class="rw-score-cnt">${total} değerlendirme</div>
          </div>
          <div class="rw-bars">
            ${[5,4,3,2,1].map(n => {
              const cnt = dist[n] || 0;
              const pct = total > 0 ? Math.round(cnt/total*100) : 0;
              return `<div class="rw-bar-row" onclick="reviewWidget.filterBy('${n}')">
                <span class="rw-bar-label">${n}</span>
                <div class="rw-bar-bg"><div class="rw-bar-fill" style="width:${pct}%"></div></div>
                <span class="rw-bar-cnt">${cnt}</span>
              </div>`;
            }).join('')}
            <div class="rw-badges">
              <span class="rw-badge ${this.filter===''?'active':''}" onclick="reviewWidget.filterBy('')">Tümü</span>
              <span class="rw-badge ${this.filter==='photos'?'active':''}" onclick="reviewWidget.filterBy('photos')">📷 Fotoğraflı (${s?.with_photos||0})</span>
              ${[5,4,3,2,1].map(n => `<span class="rw-badge" onclick="reviewWidget.filterBy('${n}')">${n}⭐ (${dist[n]||0})</span>`).join('')}
            </div>
          </div>
        </div>

        <!-- Kontroller -->
        <div class="rw-controls">
          <div class="rw-sort">
            <select onchange="reviewWidget.changeSort(this.value)">
              <option value="newest">En Yeni</option>
              <option value="helpful">En Yararlı</option>
              <option value="rating_desc">Puan: Yüksekten Düşüğe</option>
              <option value="rating_asc">Puan: Düşükten Yükseğe</option>
            </select>
          </div>
          <button class="rw-write-btn" onclick="reviewWidget.toggleForm()">✏️ Yorum Yaz</button>
        </div>

        <!-- Yorum Formu -->
        <div id="rw-form" style="display:none;">
          <div class="rw-form">
            <h3>Değerlendirmenizi Paylaşın</h3>
            <div id="rw-form-alert" class="rw-alert" style="display:none;"></div>
            <div class="rw-field">
              <label class="rw-label">Puan *</label>
              <div class="rw-star-selector">
                ${[5,4,3,2,1].map(n => `
                  <input type="radio" name="rw-rating" id="rw-s${n}" value="${n}">
                  <label for="rw-s${n}">★</label>`).join('')}
              </div>
            </div>
            <div class="rw-field">
              <label class="rw-label">Başlık</label>
              <input class="rw-input" id="rw-title" placeholder="Ürün hakkında kısa bir özet...">
            </div>
            <div class="rw-field">
              <label class="rw-label">Yorumunuz *</label>
              <textarea class="rw-textarea" id="rw-body" rows="4" placeholder="Ürünü nasıl buldunuz? Diğer alıcılara ne söylerdiniz?"></textarea>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="rw-field">
                <label class="rw-label">✅ Artılar</label>
                <textarea class="rw-textarea" id="rw-pros" rows="2" placeholder="Beğendikleriniz..."></textarea>
              </div>
              <div class="rw-field">
                <label class="rw-label">❌ Eksiler</label>
                <textarea class="rw-textarea" id="rw-cons" rows="2" placeholder="Beğenmedikleriniz..."></textarea>
              </div>
            </div>
            <div class="rw-field">
              <label class="rw-label">📷 Fotoğraf Ekle (max 5)</label>
              <div class="rw-img-upload" id="rw-img-upload">
                <div class="rw-img-add" onclick="document.getElementById('rw-file-inp').click()">
                  <span>+</span><span style="font-size:10px;margin-top:2px;">Fotoğraf</span>
                </div>
                <input type="file" id="rw-file-inp" accept="image/*" multiple style="display:none" onchange="reviewWidget.addImages(this)">
              </div>
            </div>
            <button class="rw-submit" id="rw-submit-btn" onclick="reviewWidget.submitReview()">
              Değerlendirmeyi Gönder
            </button>
          </div>
        </div>

        <!-- Yorum listesi -->
        <div id="rw-list"></div>
        <button class="rw-more-btn" id="rw-more-btn" style="display:none;" onclick="reviewWidget.loadMore()">Daha Fazla Göster</button>
      </div>

      <!-- ════ SORU-CEVAP PANELİ ════ -->
      <div id="rw-pane-qa" class="rw-pane">
        <div class="qa-ask-form">
          <h3>❓ Ürün Hakkında Soru Sor</h3>
          <div id="qa-form-alert" class="rw-alert" style="display:none;"></div>
          <textarea class="rw-textarea" id="qa-question" rows="2" placeholder="Ürün hakkında merak ettiğiniz bir şey mi var? Satıcı veya diğer alıcılar cevap verebilir."></textarea>
          <button class="rw-submit" style="margin-top:10px;" onclick="reviewWidget.submitQuestion()">Soruyu Gönder</button>
        </div>
        <div id="qa-list"></div>
        <button class="rw-more-btn" id="qa-more-btn" style="display:none;" onclick="reviewWidget.loadMoreQA()">Daha Fazla Soru</button>
      </div>
    </div>
    `;
    // Lightbox event
    document.addEventListener('click', e => {
      if (e.target.classList.contains('rw-img')) this.openLightbox(e.target.src);
      if (e.target.classList.contains('rw-lightbox-close') || e.target.classList.contains('rw-lightbox')) {
        document.querySelector('.rw-lightbox')?.remove();
      }
    });
  }

  // ── SEKME GEÇİŞİ ────────────────────────────────────────────
  switchTab(pane, el) {
    document.querySelectorAll('.rw-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.rw-pane').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    document.getElementById(`rw-pane-${pane}`).classList.add('active');
  }

  // ── YORUM YÜKLE ─────────────────────────────────────────────
  async loadReviews(reset = false) {
    if (reset) { this.page = 1; document.getElementById('rw-list').innerHTML = ''; }
    try {
      const r = await fetch(`${this.API}/reviews?product_id=${this.sku}&page=${this.page}&filter=${this.filter}&sort=${this.sort}`);
      const d = await r.json();
      if (!d.success) return;
      this.renderReviews(d.data.items, reset);
      const moreBtn = document.getElementById('rw-more-btn');
      moreBtn.style.display = d.data.page < d.data.total_pages ? 'block' : 'none';
    } catch (_) {}
  }

  renderReviews(items, reset = false) {
    const list = document.getElementById('rw-list');
    if (reset) list.innerHTML = '';
    if (!items.length && !reset) {
      list.innerHTML = '<p style="text-align:center;color:#6b7280;padding:32px;">Henüz yorum yok. İlk yorumu siz yapın!</p>';
      return;
    }
    items.forEach(r => {
      const card = document.createElement('div');
      card.className = 'rw-card';
      card.innerHTML = `
        <div class="rw-card-header">
          <div style="display:flex;align-items:center;">
            <div class="rw-avatar">${(r.user_name||'?')[0].toUpperCase()}</div>
            <div class="rw-user-info">
              <div class="rw-username">${this.esc(r.user_name||'Kullanıcı')}${r.verified ? '<span class="rw-verified">✓ Satın Aldı</span>' : ''}</div>
              <div class="rw-meta">${this.fmtDate(r.created_at)}</div>
            </div>
          </div>
          <div style="display:flex;gap:4px;">${this.starsHtml(r.rating)}</div>
        </div>
        ${r.title ? `<div class="rw-title">${this.esc(r.title)}</div>` : ''}
        <div class="rw-body">${this.esc(r.body||'')}</div>
        ${(r.pros||r.cons) ? `
          <div class="rw-pros-cons">
            ${r.pros ? `<div class="rw-pro"><div class="rw-pro-title">👍 Artılar</div>${this.esc(r.pros)}</div>` : ''}
            ${r.cons ? `<div class="rw-con"><div class="rw-con-title">👎 Eksiler</div>${this.esc(r.cons)}</div>` : ''}
          </div>` : ''}
        ${(r.images||[]).length ? `<div class="rw-images">${r.images.map(img => `<img class="rw-img" src="${this.esc(img)}" alt="Yorum görseli">`).join('')}</div>` : ''}
        ${r.vendor_reply ? `
          <div class="rw-vendor-reply">
            <div class="rw-vendor-tag">🏪 Satıcı Yanıtı</div>
            <div class="rw-vendor-body">${this.esc(r.vendor_reply)}</div>
          </div>` : ''}
        <div class="rw-helpful">
          <span class="rw-helpful-label">Bu yorum yararlı mıydı?</span>
          <button class="rw-helpful-btn ${r.user_voted_helpful===1?'voted':''}" onclick="reviewWidget.vote(${r.id|0},'yes',this)">👍 ${parseInt(r.helpful_yes)||0}</button>
          <button class="rw-helpful-btn ${r.user_voted_helpful===2?'voted-no':''}" onclick="reviewWidget.vote(${r.id|0},'no',this)">👎 ${parseInt(r.helpful_no)||0}</button>
        </div>`;
      list.appendChild(card);
    });
  }

  filterBy(f) {
    this.filter = f;
    document.querySelectorAll('.rw-badge').forEach(b => b.classList.remove('active'));
    event?.target?.classList.add('active');
    this.loadReviews(true);
  }

  changeSort(s) { this.sort = s; this.loadReviews(true); }
  loadMore() { this.page++; this.loadReviews(); }

  // ── FORM ────────────────────────────────────────────────────
  toggleForm() {
    const token = localStorage.getItem('modaica_token');
    if (!token) { alert('Yorum yazmak için giriş yapmanız gerekiyor.'); return; }
    const f = document.getElementById('rw-form');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
  }

  addImages(input) {
    const files = Array.from(input.files);
    files.slice(0, 5 - this.pendingImages.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        this.pendingImages.push(e.target.result);
        this.renderImagePreviews();
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  renderImagePreviews() {
    const wrap = document.getElementById('rw-img-upload');
    wrap.innerHTML = '';
    this.pendingImages.forEach((img, i) => {
      const el = document.createElement('div');
      el.className = 'rw-img-preview';
      el.innerHTML = `<img src="${img}"><button class="rw-img-del" onclick="reviewWidget.removeImage(${i})">✕</button>`;
      wrap.appendChild(el);
    });
    if (this.pendingImages.length < 5) {
      const add = document.createElement('div');
      add.className = 'rw-img-add';
      add.innerHTML = '<span>+</span><span style="font-size:10px;margin-top:2px;">Fotoğraf</span>';
      add.onclick = () => document.getElementById('rw-file-inp').click();
      wrap.appendChild(add);
    }
    wrap.appendChild(Object.assign(document.createElement('input'), { type:'file', id:'rw-file-inp', accept:'image/*', multiple:true, style:'display:none', onchange: e => this.addImages(e.target) }));
  }

  removeImage(i) { this.pendingImages.splice(i, 1); this.renderImagePreviews(); }

  async submitReview() {
    const btn     = document.getElementById('rw-submit-btn');
    const alertEl = document.getElementById('rw-form-alert');
    alertEl.style.display = 'none';
    const rating = document.querySelector('input[name="rw-rating"]:checked')?.value;
    const body   = document.getElementById('rw-body')?.value.trim();
    if (!rating)       { this.showAlert('rw-form-alert', 'Puan seçin.', 'error'); return; }
    if (!body)         { this.showAlert('rw-form-alert', 'Yorum yazın.', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Gönderiliyor...';
    try {
      const token = localStorage.getItem('modaica_token') || '';
      const r = await fetch(`${this.API}/reviews/`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token },
        body: JSON.stringify({
          product_id: this.sku,
          rating:     parseInt(rating),
          title:      document.getElementById('rw-title')?.value.trim() || '',
          body,
          pros:   document.getElementById('rw-pros')?.value.trim() || '',
          cons:   document.getElementById('rw-cons')?.value.trim() || '',
          images: this.pendingImages,
        }),
      });
      const d = await r.json();
      if (!d.success) { this.showAlert('rw-form-alert', d.message || 'Hata.', 'error'); return; }
      this.showAlert('rw-form-alert', '✅ Yorumunuz eklendi!', 'success');
      this.pendingImages = [];
      setTimeout(() => { document.getElementById('rw-form').style.display = 'none'; this.loadReviews(true); }, 1500);
    } catch { this.showAlert('rw-form-alert', 'Bağlantı hatası.', 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Değerlendirmeyi Gönder'; }
  }

  // ── YARARLI OY ──────────────────────────────────────────────
  async vote(reviewId, voteType, btn) {
    const token = localStorage.getItem('modaica_token') || '';
    if (!token) { alert('Oy kullanmak için giriş yapın.'); return; }
    try {
      const r = await fetch(`${this.API}/reviews/${reviewId}/helpful`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token },
        body: JSON.stringify({ vote: voteType }),
      });
      const d = await r.json();
      if (d.success) {
        const card = btn.closest('.rw-card');
        const [yBtn, nBtn] = card.querySelectorAll('.rw-helpful-btn');
        yBtn.innerHTML = `👍 ${parseInt(d.data.helpful_yes)||0}`;
        nBtn.innerHTML = `👎 ${parseInt(d.data.helpful_no)||0}`;
        yBtn.className = 'rw-helpful-btn' + (d.data.removed ? '' : voteType==='yes' ? ' voted' : '');
        nBtn.className = 'rw-helpful-btn' + (d.data.removed ? '' : voteType==='no'  ? ' voted-no' : '');
      }
    } catch (_) {}
  }

  // ── SORULAR ─────────────────────────────────────────────────
  qaPage = 1;

  async loadQuestions(reset = false) {
    if (reset) { this.qaPage = 1; document.getElementById('qa-list').innerHTML = ''; }
    try {
      const r = await fetch(`${this.API}/questions?product_id=${this.sku}&page=${this.qaPage}`);
      const d = await r.json();
      if (!d.success) return;
      this.renderQuestions(d.data.items, reset);
      document.getElementById('qa-more-btn').style.display = d.data.page < d.data.total_pages ? 'block' : 'none';
    } catch (_) {}
  }

  renderQuestions(items, reset = false) {
    const list = document.getElementById('qa-list');
    if (reset) list.innerHTML = '';
    if (!items.length && !reset) { list.innerHTML = '<p style="text-align:center;color:#6b7280;padding:20px;">Henüz soru yok. İlk soruyu siz sorun!</p>'; return; }
    items.forEach(q => {
      const card = document.createElement('div');
      card.className = 'qa-card';
      card.innerHTML = `
        <div class="qa-q">
          <span class="qa-q-icon">❓</span>
          <div>
            <div>${this.esc(q.question)}</div>
            <div style="font-size:11px;color:#9ca3af;margin-top:3px;">${this.esc(q.user_name)} · ${this.fmtDate(q.created_at)}</div>
          </div>
        </div>
        <div class="qa-answers">
          ${q.answers?.length ? q.answers.map(a => `
            <div class="qa-ans">
              <div class="qa-ans-meta">
                ${a.is_vendor ? '<span class="qa-vendor-tag">🏪 Satıcı</span>' : ''}
                <span class="qa-ans-author">${this.esc(a.vendor_shop || a.user_name || '?')}</span>
                <span class="qa-ans-date">${this.fmtDate(a.created_at)}</span>
              </div>
              ${this.esc(a.answer)}
            </div>`).join('') : '<div class="qa-no-answers">Henüz cevap yok.</div>'}
        </div>
        <div class="qa-answer-form" style="margin-top:12px;">
          <textarea class="qa-answer-input" id="qa-ans-${q.id|0}" rows="2" placeholder="Bu soruyu cevapla..."></textarea>
          <button class="qa-answer-btn" onclick="reviewWidget.submitAnswer(${q.id|0})">Cevapla</button>
        </div>`;
      list.appendChild(card);
    });
  }

  loadMoreQA() { this.qaPage++; this.loadQuestions(); }

  async submitQuestion() {
    const token = localStorage.getItem('modaica_token') || '';
    if (!token) { alert('Soru sormak için giriş yapın.'); return; }
    const q = document.getElementById('qa-question')?.value.trim();
    if (!q || q.length < 10) { this.showAlert('qa-form-alert', 'Soru en az 10 karakter olmalı.', 'error'); return; }
    try {
      const r = await fetch(`${this.API}/questions/`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token },
        body: JSON.stringify({ product_id: this.sku, question: q }),
      });
      const d = await r.json();
      if (!d.success) { this.showAlert('qa-form-alert', d.message||'Hata.', 'error'); return; }
      this.showAlert('qa-form-alert', '✅ Sorunuz iletildi!', 'success');
      document.getElementById('qa-question').value = '';
      setTimeout(() => this.loadQuestions(true), 1200);
    } catch { this.showAlert('qa-form-alert', 'Bağlantı hatası.', 'error'); }
  }

  async submitAnswer(qid) {
    const token = localStorage.getItem('modaica_token') || localStorage.getItem('vendorToken') || '';
    if (!token) { alert('Cevap vermek için giriş yapın.'); return; }
    const ans = document.getElementById(`qa-ans-${qid}`)?.value.trim();
    if (!ans) return;
    try {
      const r = await fetch(`${this.API}/questions/${qid}/answer`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token },
        body: JSON.stringify({ answer: ans }),
      });
      const d = await r.json();
      if (d.success) { this.loadQuestions(true); }
    } catch (_) {}
  }

  // ── YARDIMCI ────────────────────────────────────────────────
  starsHtml(rating) {
    return [1,2,3,4,5].map(n => {
      const filled = n <= Math.floor(rating);
      const half   = !filled && n <= rating + 0.5;
      const color  = (filled || half) ? '#f4a226' : '#d1d5db';
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="${(filled||half)?'#f4a226':'none'}" stroke="#f4a226" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    }).join('');
  }

  fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' });
  }

  esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>'); }

  showAlert(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg; el.className = `rw-alert ${type}`; el.style.display = 'block';
  }

  openLightbox(src) {
    const lb = document.createElement('div');
    lb.className = 'rw-lightbox';
    lb.innerHTML = `<button class="rw-lightbox-close">✕</button><img src="${src}" alt="">
      <div class="rw-lightbox-nav">
        <button onclick="reviewWidget.prev()">‹ Önceki</button>
        <span class="rw-lightbox-counter">1 / 1</span>
        <button onclick="reviewWidget.next()">Sonraki ›</button>
      </div>`;
    lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
    document.body.appendChild(lb);
  }
}

window.ReviewsWidget = ReviewsWidget;
