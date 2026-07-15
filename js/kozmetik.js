/* =============================================
   MODAICA — Kozmetik & Bakım Sayfası JavaScript
   ============================================= */

const DEPARTMENT = 'kozmetik';

const CAT_LABELS = {
  'yuz-bakim':'Yüz Bakımı', makyaj:'Makyaj', 'sac-bakim':'Saç Bakımı',
  'vucut-bakim':'Vücut Bakımı', parfum:'Parfüm & Koku', tirnak:'Tırnak & El',
  gunes:'Güneş Bakımı', alet:'Cihaz & Alet', set:'Set & Hediye',
};

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const state = {
  products: [],
  total:    0,
  sort:     'popular',
  view:     'grid',
  page:     1,
  perPage:  12,
  loading:  false,
  filters:  { cats:[], skins:[], priceMin:0, priceMax:999999, rating:0, brand:[] },
  favorites: (function(){ try { return JSON.parse(localStorage.getItem('modaica_favorites') || '[]'); } catch { return []; } })(),
};

function showToast(msg, isError=false) {
  const t = document.getElementById('toast');
  t.querySelector('span').textContent = msg;
  t.querySelector('svg').style.color = isError ? '#e63946' : '#22c55e';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

async function fetchProducts() {
  if (state.loading) return;
  state.loading = true;
  document.getElementById('resultCount').textContent = '...';
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#6b7280;font-family:\'DM Sans\',sans-serif;font-size:15px;">Ürünler yükleniyor...</div>';

  const f = state.filters;
  const p = new URLSearchParams({ department: DEPARTMENT, sort: state.sort, page: state.page, limit: state.perPage });
  if (f.cats.length)       p.set('category', f.cats[0]);
  if (f.brand.length)      p.set('brand', f.brand[0]);
  if (f.priceMin > 0)      p.set('price_min', f.priceMin);
  if (f.priceMax < 999999) p.set('price_max', f.priceMax);
  if (f.rating > 0)        p.set('rating_min', f.rating);

  try {
    const res  = await fetch(`${API_BASE}/api/products?${p}`);
    const data = await res.json();
    if (data.success) {
      state.products = data.data.items || [];
      state.total    = data.data.total || 0;
    } else {
      state.products = []; state.total = 0;
    }
  } catch {
    state.products = []; state.total = 0;
  }
  state.loading = false;
  render();
}

function applyFilters() { state.page = 1; fetchProducts(); }
function applySort()    { state.page = 1; fetchProducts(); }

function render() {
  document.getElementById('resultCount').textContent = state.total;
  renderActiveTags();
  renderProducts();
  renderPagination();
  updateClearBtn();
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  grid.className = 'product-grid' + (state.view === 'list' ? ' list-view' : '');

  if (!state.products.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h3>Ürün bulunamadı</h3>
        <p>Seçili filtrelere uygun ürün yok. Filtreleri değiştirmeyi deneyin.</p>
        <button class="reset-btn" onclick="resetFilters()">Filtreleri Temizle</button>
      </div>`;
    return;
  }

  grid.innerHTML = state.products.map((p, i) => productCard(p, i)).join('');

  grid.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', function(e) { e.stopPropagation(); toggleFav(this.dataset.id, this); });
  });
  grid.querySelectorAll('.cart-btn').forEach(btn => {
    btn.addEventListener('click', function(e) { e.stopPropagation(); addToCart(this.dataset.id, this); });
  });
  grid.querySelectorAll('.product-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', function() {
      const sku = this.dataset.sku;
      if (sku) window.location.href = 'urun-detay.html?sku=' + encodeURIComponent(sku);
    });
  });
}

function productCard(p, i) {
  const pid      = String(p.id);
  const isFav    = state.favorites.some(f => f.product_id == pid);
  const delay    = Math.min(i * 0.04, 0.4);
  const rating   = Math.min(5, Math.max(0, Math.round(p.avg_rating || 0)));
  const discount = p.old_price ? Math.round((p.old_price - p.price) / p.old_price * 100) : 0;
  const bLabel   = { new:'YENİ', sale:`%${discount} İNDİRİM`, hot:'🔥 HOT', best:'⭐ BEST', natural:'🌿 DOĞAL', luxury:'💎 LÜKS', limited:'SON' };
  const badgeHTML = p.badge
    ? `<div class="product-badges"><span class="badge badge-${esc(p.badge)}">${bLabel[p.badge] || esc(p.badge)}</span></div>`
    : '';

  return `
    <div class="product-card" style="animation-delay:${delay}s;" data-id="${esc(pid)}" data-sku="${esc(p.sku || '')}" title="${esc(p.name)} — Detayları gör">
      <div class="product-img">
        ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" data-emoji="${esc(p.emoji||'📦')}" onerror="this.outerHTML='<span>'+this.dataset.emoji+'</span>'">` : `<span>${esc(p.emoji || '📦')}</span>`}
        ${badgeHTML}
        <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${esc(pid)}" title="${isFav ? 'Favorilerden çıkar' : 'Favorilere ekle'}">
          <svg fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        </button>
        <button class="quick-view">Hızlı Bakış</button>
      </div>
      <div class="product-info">
        <div class="product-brand">${esc(p.brand || '')}</div>
        <div class="product-name">${esc(p.name)}</div>
        <div class="product-rating">
          <span class="stars-row">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>
          <span class="rating-count">(${parseInt(p.review_count) || 0})</span>
        </div>
        <div class="product-footer">
          <div class="price-wrap">
            <span class="price">₺${parseFloat(p.price || 0).toLocaleString('tr-TR')}</span>
            ${p.old_price ? `<span class="price-old">₺${parseFloat(p.old_price).toLocaleString('tr-TR')}</span>` : ''}
          </div>
          <button class="cart-btn" data-id="${esc(pid)}">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            Ekle
          </button>
        </div>
      </div>
    </div>`;
}

function renderPagination() {
  const totalPages = Math.ceil(state.total / state.perPage);
  const cur  = state.page;
  const wrap = document.getElementById('pagination');
  if (!wrap || totalPages <= 1) { if(wrap) wrap.innerHTML = ''; return; }
  let html = `<button class="page-btn" ${cur===1?'disabled':''} onclick="goPage(${cur-1})">‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i===1 || i===totalPages || Math.abs(i-cur)<=1)
      html += `<button class="page-btn ${i===cur?'active':''}" onclick="goPage(${i})">${i}</button>`;
    else if (Math.abs(i-cur)===2)
      html += `<span class="page-btn dots">…</span>`;
  }
  html += `<button class="page-btn" ${cur===totalPages?'disabled':''} onclick="goPage(${cur+1})">›</button>`;
  wrap.innerHTML = html;
}

function goPage(n) { state.page = n; fetchProducts(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function renderActiveTags() {
  const f    = state.filters;
  const wrap = document.getElementById('activeTagsWrap');
  if (!wrap) return;
  const tags = [];
  f.cats.forEach(c  => tags.push({ label: CAT_LABELS[c]||c,      remove: () => { f.cats  = f.cats.filter(x=>x!==c);  applyFilters(); updateCheckbox('cat',c,false); } }));
  f.brand.forEach(b => tags.push({ label: b,                      remove: () => { f.brand = f.brand.filter(x=>x!==b); applyFilters(); updateCheckbox('brand',b,false); } }));
  f.skins.forEach(s => tags.push({ label: s,                      remove: () => { f.skins = f.skins.filter(x=>x!==s); } }));
  if (f.priceMax < 999999) tags.push({ label:`Max ₺${f.priceMax}`, remove: () => { f.priceMax=999999; applyFilters(); } });
  if (f.rating > 0)        tags.push({ label:`${f.rating}★+`,      remove: () => { f.rating=0; applyFilters(); document.querySelectorAll('.rating-radio').forEach(r=>r.checked=false); } });
  if (tags.length===0) { wrap.classList.remove('visible'); return; }
  wrap.classList.add('visible');
  wrap.innerHTML = `<span style="font-size:12px;font-weight:700;color:var(--muted);">Aktif Filtreler:</span>` +
    tags.map((t,i) => `<span class="active-tag">${t.label}<button onclick="removeTag(${i})">×</button></span>`).join('');
  wrap._tags = tags;
}

function removeTag(i) { const w=document.getElementById('activeTagsWrap'); if(w&&w._tags&&w._tags[i]) w._tags[i].remove(); }
function updateCheckbox(type,val,checked){ document.querySelectorAll(`.filter-check input[data-${type}="${val}"]`).forEach(el=>el.checked=checked); }

document.querySelectorAll('.filter-check input[data-cat]').forEach(inp=>{
  inp.addEventListener('change',function(){
    const v=this.dataset.cat;
    if(this.checked) state.filters.cats.push(v); else state.filters.cats=state.filters.cats.filter(x=>x!==v);
    applyFilters();
  });
});
document.querySelectorAll('.filter-check input[data-brand]').forEach(inp=>{
  inp.addEventListener('change',function(){
    const v=this.dataset.brand;
    if(this.checked) state.filters.brand.push(v); else state.filters.brand=state.filters.brand.filter(x=>x!==v);
    applyFilters();
  });
});
document.querySelectorAll('.filter-check input[data-skin]').forEach(inp=>{
  inp.addEventListener('change',function(){
    const v=this.dataset.skin;
    if(this.checked) state.filters.skins.push(v); else state.filters.skins=state.filters.skins.filter(x=>x!==v);
    // cilt tipi API'ye gönderilmez — sadece UI
  });
});
document.getElementById('priceApply')?.addEventListener('click',()=>{
  state.filters.priceMin=+document.getElementById('priceMin').value||0;
  state.filters.priceMax=+document.getElementById('priceMax').value||999999;
  applyFilters();
});
document.querySelectorAll('.rating-radio').forEach(r=>{
  r.addEventListener('change',function(){ state.filters.rating=+this.value; applyFilters(); });
});
document.getElementById('sortSelect')?.addEventListener('change',function(){ state.sort=this.value; applySort(); });
document.getElementById('btnGrid')?.addEventListener('click',function(){ state.view='grid'; this.classList.add('active'); document.getElementById('btnList').classList.remove('active'); renderProducts(); });
document.getElementById('btnList')?.addEventListener('click',function(){ state.view='list'; this.classList.add('active'); document.getElementById('btnGrid').classList.remove('active'); renderProducts(); });

document.querySelectorAll('.hero-tag[data-cat]').forEach(tag=>{
  tag.addEventListener('click',function(e){
    e.preventDefault();
    const c=this.dataset.cat;
    document.querySelectorAll('.hero-tag').forEach(t=>t.classList.remove('active'));
    this.classList.add('active');
    state.filters.cats = c==='all'?[]:[c];
    document.querySelectorAll('.filter-check input[data-cat]').forEach(el=>{ el.checked=el.dataset.cat===c; });
    applyFilters();
    const pt=document.getElementById('pageTitle'); if(pt) pt.textContent=c==='all'?'Kozmetik & Bakım':(CAT_LABELS[c]||c);
    const bc=document.getElementById('breadCurrent'); if(bc) bc.textContent=c==='all'?'Tüm Ürünler':(CAT_LABELS[c]||c);
  });
});

document.querySelectorAll('.filter-group-title').forEach(title=>{
  title.classList.add('open');
  const items=title.nextElementSibling;
  if(items) items.style.maxHeight='500px';
  title.addEventListener('click',function(){
    const items=this.nextElementSibling;
    if(!items) return;
    this.classList.toggle('open');
    if(this.classList.contains('open')){ items.classList.remove('collapsed'); items.style.maxHeight=items.scrollHeight+'px'; }
    else{ items.style.maxHeight=items.scrollHeight+'px'; requestAnimationFrame(()=>items.classList.add('collapsed')); }
  });
});

function updateClearBtn(){
  const f=state.filters;
  const has=f.cats.length||f.brand.length||f.skins.length||f.rating>0||f.priceMax<999999;
  document.getElementById('clearFilters')?.classList.toggle('visible',!!has);
}
document.getElementById('clearFilters')?.addEventListener('click',resetFilters);

function resetFilters(){
  state.filters={cats:[],skins:[],priceMin:0,priceMax:999999,rating:0,brand:[]};
  document.querySelectorAll('.filter-check input').forEach(el=>el.checked=false);
  document.querySelectorAll('.rating-radio').forEach(el=>el.checked=false);
  const pMin=document.getElementById('priceMin'); if(pMin) pMin.value='';
  const pMax=document.getElementById('priceMax'); if(pMax) pMax.value='';
  document.querySelectorAll('.hero-tag').forEach(t=>t.classList.remove('active'));
  document.querySelector('.hero-tag[data-cat="all"]')?.classList.add('active');
  fetchProducts();
}

document.getElementById('mobileFilterBtn')?.addEventListener('click',()=>{ document.getElementById('sidebar')?.classList.add('mobile-open'); document.getElementById('mobileOverlay')?.classList.add('open'); });
document.getElementById('mobileOverlay')?.addEventListener('click',()=>{ document.getElementById('sidebar')?.classList.remove('mobile-open'); document.getElementById('mobileOverlay')?.classList.remove('open'); });

function toggleFav(id, btn){
  const p=state.products.find(x=>String(x.id)==id);
  if(!p) return;
  const favPayload={product_id:Number(id),product_name:p.name,product_price:p.price,product_emoji:p.emoji||'📦',product_cat:CAT_LABELS[p.category_slug]||p.category_slug||''};
  const idx=state.favorites.findIndex(f=>f.product_id==Number(id));
  if(idx===-1){
    state.favorites.push(favPayload);
    btn.classList.add('active'); btn.querySelector('svg').setAttribute('fill','currentColor');
    showToast(`${p.name} favorilere eklendi!`);
  } else {
    state.favorites.splice(idx,1);
    btn.classList.remove('active'); btn.querySelector('svg').setAttribute('fill','none');
    showToast(`${p.name} favorilerden çıkarıldı.`);
  }
  localStorage.setItem('modaica_favorites',JSON.stringify(state.favorites));
  if(typeof FavAPI!=='undefined') FavAPI.toggle(favPayload).catch(()=>{});
  updateBadges();
}

function addToCart(id, btn){
  const p=state.products.find(x=>String(x.id)==id);
  if(!p) return;
  if(typeof CartAPI!=='undefined'){
    CartAPI.addAndSync({product_id:Number(id),product_name:p.name,product_price:p.price,product_emoji:p.emoji||'📦',product_cat:CAT_LABELS[p.category_slug]||p.category_slug||'',product_brand:p.brand||'',quantity:1}).catch(()=>{});
  } else {
    let cart; try{cart=JSON.parse(localStorage.getItem('modaica_cart')||'[]');}catch{cart=[];}
    const ex=cart.find(c=>c.product_id==Number(id));
    if(ex) ex.quantity=(ex.quantity||1)+1;
    else cart.push({product_id:Number(id),product_name:p.name,product_price:p.price,product_emoji:p.emoji||'📦',quantity:1});
    localStorage.setItem('modaica_cart',JSON.stringify(cart));
    updateBadges();
  }
  const orig=btn.innerHTML;
  btn.innerHTML=`<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Eklendi`;
  btn.style.background='#22c55e';
  setTimeout(()=>{ btn.innerHTML=orig; btn.style.background=''; },1800);
  showToast(`${p.name} sepete eklendi!`);
}

function updateBadges(){
  let cart; try { cart=JSON.parse(localStorage.getItem('modaica_cart')||'[]'); } catch { cart=[]; }
  const tot=cart.reduce((s,c)=>s+(c.quantity||1),0);
  const cb=document.getElementById('hdrCartBadge');
  if(cb){cb.textContent=tot;cb.style.display=tot>0?'flex':'none';}
  let favs; try { favs=JSON.parse(localStorage.getItem('modaica_favorites')||'[]'); } catch { favs=[]; }
  const fb=document.getElementById('hdrFavBadge');
  if(fb){fb.textContent=favs.length;fb.style.display=favs.length>0?'flex':'none';}
}

const catParam=new URLSearchParams(location.search).get('cat');
if(catParam&&CAT_LABELS[catParam]){
  state.filters.cats=[catParam];
  const pt=document.getElementById('pageTitle'); if(pt) pt.textContent=CAT_LABELS[catParam];
  const ps=document.getElementById('pageSub'); if(ps) ps.textContent=`Kozmetik ${CAT_LABELS[catParam]} koleksiyonu`;
  const bc=document.getElementById('breadCurrent'); if(bc) bc.textContent=CAT_LABELS[catParam];
  const cb=document.querySelector(`.filter-check input[data-cat="${catParam}"]`); if(cb) cb.checked=true;
  const ht=document.querySelector(`.hero-tag[data-cat="${catParam}"]`);
  if(ht){document.querySelectorAll('.hero-tag').forEach(t=>t.classList.remove('active')); ht.classList.add('active');}
}

fetchProducts();
updateBadges();
