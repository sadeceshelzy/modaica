<body>

  <!-- TOPBAR -->
  <div class="topbar" id="topbarEl">
    Yeni Üyelere Özel! <span>İlk Siparişinizde %20 İndirim</span> — Kod: <span>HOSGELDIN20</span>
    &nbsp;|&nbsp;
    <span>750 ve üzeri alışverişlerde Ücretsiz kargo</span>
    <button class="topbar-close" id="topbarClose"></button>
  </div>

  <!-- HEADER -->
  <header>
    <div class="header-inner">
      <!-- Hamburger (sadece mobilde görünür) -->
      <button class="mob-menu-btn" id="mobMenuBtn" aria-label="Menü">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>

      <a href="anasayfa.html" class="logo">MODA<span>ICA</span></a>

      <div class="search-bar">
        <input type="text" placeholder="Ürün, marka veya kategori ara..."
          onkeydown="if(event.key==='Enter')window.location.href='arama.html?q='+encodeURIComponent(this.value)">
        <button onclick="window.location.href='arama.html?q='+encodeURIComponent(this.previousElementSibling.value)">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      <div class="header-icons">
        <a href="hesabim.html" class="icon-btn">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>Hesabım</span>
        </a>
        <a href="favoriler.html" class="icon-btn">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span>Favoriler</span>
          <div class="hdr-badge" id="hdrFavBadge" style="display:none;"></div>
        </a>
        <a href="sepet.html" class="icon-btn">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Sepet</span>
          <div class="hdr-badge" id="hdrCartBadge" style="display:none;"></div>
        </a>
      </div>
    </div>
  </header>

  <!-- NAV -->
  <nav>
    <div class="nav-inner">
      <div class="nav-item"><a href="erkek.html">👨 Erkek</a></div>
      <div class="nav-item"><a href="kadin.html">👩 Kadın</a></div>
      <div class="nav-item"><a href="elektronik.html">💻 Elektronik</a></div>
      <div class="nav-item"><a href="ev.html">🏠 Ev &amp; Yaşam</a></div>
      <div class="nav-item"><a href="spor.html">⚽ Spor</a></div>
      <div class="nav-item"><a href="kozmetik.html">💄 Kozmetik</a></div>
      <div class="nav-item"><a href="satici-basvuru.html">Satıcı Ol</a></div>
      <div class="nav-item"><a href="satici-giris.html">Satıcı Girişi 🔑</a></div>
    </div>
  </nav>

  <!-- MOBİL DRAWER OVERLAY -->
  <div class="mob-overlay" id="mobOverlay"></div>

  <!-- MOBİL DRAWER -->
  <div class="mob-drawer" id="mobDrawer" role="dialog" aria-modal="true" aria-label="Navigasyon Menüsü">
    <div class="mob-drawer-head">
      <a href="anasayfa.html" class="mob-drawer-logo">MODA<span>ICA</span></a>
      <button class="mob-drawer-close" id="mobDrawerClose" aria-label="Kapat">&times;</button>
    </div>

    <div class="mob-drawer-user">
      <a href="hesabim.html">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        Hesabım &amp; Siparişlerim
      </a>
    </div>

    <nav class="mob-drawer-nav">
      <div class="mob-drawer-sep">Kategoriler</div>
      <a href="erkek.html"><span class="nav-emoji">👨</span> Erkek Giyim</a>
      <a href="kadin.html"><span class="nav-emoji">👩</span> Kadın Giyim</a>
      <a href="elektronik.html"><span class="nav-emoji">💻</span> Elektronik</a>
      <a href="ev.html"><span class="nav-emoji">🏠</span> Ev &amp; Yaşam</a>
      <a href="spor.html"><span class="nav-emoji">⚽</span> Spor &amp; Outdoor</a>
      <a href="kozmetik.html"><span class="nav-emoji">💄</span> Kozmetik &amp; Güzellik</a>

      <div class="mob-drawer-sep">Alışveriş</div>
      <a href="favoriler.html"><span class="nav-emoji">❤️</span> Favorilerim</a>
      <a href="sepet.html"><span class="nav-emoji">🛒</span> Sepetim</a>
      <a href="siparis-takip.html"><span class="nav-emoji">📦</span> Sipariş Takip</a>
      <a href="arama.html"><span class="nav-emoji">🔍</span> Arama</a>

      <div class="mob-drawer-sep">Satıcı</div>
      <a href="satici-basvuru.html"><span class="nav-emoji">🏪</span> Satıcı Ol</a>
      <a href="satici-giris.html"><span class="nav-emoji">🔑</span> Satıcı Girişi</a>
    </nav>

    <div class="mob-drawer-footer">
      <p>Ücretsiz kargo 750₺+ &nbsp;|&nbsp; 14 gün iade</p>
    </div>
  </div>
