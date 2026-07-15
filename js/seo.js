// ============================================================
//  MODAICA — SEO & Open Graph Meta Tag Enjektörü
//  Her sayfanın <head>'ine ekle:
//  <script src="js/seo.js"></script>
//  <script>SEO.init({ title:'...', desc:'...', image:'...' });</script>
// ============================================================
const SEO = {
  BASE_URL:  'https://modaica.com',
  SITE_NAME: 'MODAICA',

  init(opts = {}) {
    const title = opts.title ? `${opts.title} — ${this.SITE_NAME}` : `${this.SITE_NAME} - Moda & Alışveriş`;
    const desc  = opts.desc  || 'Türkiye\'nin yükselen moda platformu. Erkek, kadın, elektronik ve daha fazlası.';
    const image = opts.image || `${this.BASE_URL}/assets/og-default.jpg`;
    const url   = opts.url   || window.location.href;
    const type  = opts.type  || 'website';

    this._set('title', null, title, 'text');
    this._meta('description',        desc);
    this._meta('keywords',           opts.keywords || 'moda, alışveriş, giyim, MODAICA');
    this._meta('robots',             opts.noindex ? 'noindex,nofollow' : 'index,follow');

    // Open Graph
    this._og('og:title',       title);
    this._og('og:description', desc);
    this._og('og:image',       image);
    this._og('og:url',         url);
    this._og('og:type',        type);
    this._og('og:site_name',   this.SITE_NAME);
    this._og('og:locale',      'tr_TR');

    // Twitter
    this._og('twitter:card',        'summary_large_image');
    this._og('twitter:title',       title);
    this._og('twitter:description', desc);
    this._og('twitter:image',       image);

    // Canonical
    this._link('canonical', url);

    // JSON-LD — sayfa tipine göre
    if (opts.product)      this.productSchema(opts.product);
    if (opts.breadcrumbs)  this.breadcrumbSchema(opts.breadcrumbs);
    if (!opts.noOrg)       this.organizationSchema();
  },

  // Ürün şeması
  productSchema(p) {
    const schema = {
      '@context': 'https://schema.org/',
      '@type':    'Product',
      'name':     p.name,
      'description': p.description || p.name,
      'brand':    { '@type': 'Brand', 'name': p.brand || this.SITE_NAME },
      'sku':      p.sku,
      'offers': {
        '@type':        'Offer',
        'url':          `${this.BASE_URL}/urun-detay.html?sku=${p.sku}`,
        'priceCurrency':'TRY',
        'price':         p.price,
        'availability': p.inStock !== false ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        'seller':       { '@type': 'Organization', 'name': this.SITE_NAME },
      },
    };
    if (p.rating) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        'ratingValue': p.rating, 'reviewCount': p.reviewCount || 0,
        'bestRating': 5, 'worstRating': 1,
      };
    }
    this._jsonLd(schema);
  },

  // Breadcrumb şeması
  breadcrumbSchema(crumbs) {
    this._jsonLd({
      '@context': 'https://schema.org',
      '@type':    'BreadcrumbList',
      'itemListElement': crumbs.map((c, i) => ({
        '@type': 'ListItem', 'position': i + 1,
        'name': c.name, 'item': c.url || '',
      })),
    });
  },

  // Organizasyon şeması
  organizationSchema() {
    this._jsonLd({
      '@context': 'https://schema.org',
      '@type':    'Organization',
      'name':     this.SITE_NAME,
      'url':      this.BASE_URL,
      'logo':     `${this.BASE_URL}/assets/logo.png`,
      'contactPoint': {
        '@type': 'ContactPoint', 'telephone': '+90-850-000-0000',
        'contactType': 'customer service', 'areaServed': 'TR',
      },
    });
  },

  // Yardımcı
  _meta(name, content) {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
    el.content = content;
  },
  _og(prop, content) {
    let el = document.querySelector(`meta[property="${prop}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
    el.content = content;
  },
  _link(rel, href) {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
    el.href = href;
  },
  _set(tag, attr, val, type) {
    if (type === 'text') document.title = val;
  },
  _jsonLd(schema) {
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(s);
  },
};
