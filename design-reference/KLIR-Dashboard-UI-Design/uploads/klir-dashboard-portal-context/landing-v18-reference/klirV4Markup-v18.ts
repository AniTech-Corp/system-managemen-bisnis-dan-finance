// Ported from Claude Design source "KLIR Landing v14.dc.html"
// (Claude Code Asistent\KLIR\klir-public\landing\from-zip-V10\KLIR Landing v14.dc.html).
// This replaces the previous v4-generation adaptation with the actual v14 markup/structure,
// section by section, with these deliberate conversions (Claude Design runtime syntax has no
// meaning in plain React/HTML):
//   - style-hover="..."      -> data-hover="..."      (generic hover wiring in KlirLandingV4.tsx)
//   - onClick="{{ toggleX }}" -> dropped; plain data-* hook attributes wired imperatively instead
//   - <sc-if value="{{ menuOpen }}">...</sc-if>        -> static div, data-mobile-panel, display:none,
//                                                          toggled imperatively (menuOpen was never
//                                                          real React state here -- KLIR_V4_MARKUP is
//                                                          a plain HTML string, not JSX)
//   - <sc-for list="{{ paket }}">...</sc-for>          -> unrolled into 3 static plan cards, both
//                                                          minggu/bulan prices embedded as data-*
//                                                          attributes so the cadence toggle can swap
//                                                          textContent without a virtual DOM
//   - <x-dc>/<helmet>/<script data-dc-script> wrapper   -> dropped; component logic lives in
//                                                          KlirLandingV4.tsx, this file is markup only
// Product-decision corrections applied while porting (Sesi 23 Agu, Mecca's explicit instruction):
//   - Pilar produk = 6 (bukan 7). "Kepatuhan" node/sidebar-item/footer-link dihapus seluruhnya.
//   - v14's two empty "Pilar 06"/"Pilar 07" orbit placeholders filled with the real pillars:
//     Komunikasi kerja (AniVirtual) dan Jadwal usaha (KLIR Booking).
//   - Semua kalimat "tujuh pilar/ketujuh" -> "enam pilar/keenam".
//   - Section harga menampilkan DUA opsi per paket berbayar (mingguan & bulanan), angka persis
//     dari v14 source's PAKET/HARGA object: Starter Rp30.000/minggu atau Rp100.000/bulan;
//     Business Rp100.000/minggu atau Rp350.000/bulan.
// Empirical note (verified by reading v14 line-by-line, not assumed): v14 has NO dedicated
// "05 / KEPATUHAN" showcase section (unlike Rencana/Keuangan/Promosi/Tim which each get one) --
// "Kepatuhan" only ever appears in 5 spots (hero orbit node, dashboard sidebar nav item, footer
// Produk link, PAKET fitur text via IKON array, and the pricing-cell 3D icon key) -- all 5 fixed
// below. v14 DOES have an "id=platform" app-stack section and an "id=perbandingan" before/after
// section that the previous v4-generation file in this repo was missing entirely; both are ported
// in full here.
export const KLIR_V4_MARKUP = `
<style>
  /* The decorative 3D glyphs are rendered once by WebGL, then animated by the compositor.
     A per-frame WebGL loop for nine shared-context scenes starved the main thread; CSS
     transforms give them continuous motion at zero JS and zero GPU-readback cost. */
  [data-sigil]{animation:klirGlyph 6s ease-in-out infinite;}
  [data-sigil="ai"]{animation-duration:5.2s;}
  [data-sigil="fast"]{animation-duration:6.8s;animation-delay:-1.4s;}
  [data-sigil="cube"]{animation:klirGlyphSlow 7.4s ease-in-out infinite;}
  [data-price-cell]{animation:klirGlyphSlow 8s ease-in-out infinite;}
  [data-companion="cta"]{animation:klirGlyphOrb 14s ease-in-out infinite;}
  @media (prefers-reduced-motion: reduce){
    [data-sigil],[data-price-cell],[data-companion]{animation:none !important;}
  }
  @keyframes klirReveal{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:none;}}
  @keyframes klirBeat{0%,100%{opacity:0.45;transform:scale(1);}50%{opacity:1;transform:scale(1.35);}}
  @keyframes klirDriftA{0%,100%{transform:translate(0,0) rotate(-8deg);}50%{transform:translate(5px,-7px) rotate(-5deg);}}
  @keyframes klirDriftB{0%,100%{transform:translate(0,0) rotate(7deg);}50%{transform:translate(-6px,6px) rotate(4deg);}}
  @keyframes klirDriftC{0%,100%{transform:translate(0,0) rotate(-13deg);}50%{transform:translate(7px,4px) rotate(-9deg);}}
  @keyframes klirGlyph{0%,100%{transform:translateY(0) rotate(0deg) scale(1);}50%{transform:translateY(-3px) rotate(5deg) scale(1.04);}}
  @keyframes klirGlyphSlow{0%,100%{transform:translateY(0) rotate(0deg);}50%{transform:translateY(-4px) rotate(-4deg);}}
  @keyframes klirGlyphOrb{0%,100%{transform:translate(-50%,-50%) rotate(0deg) scale(1);}50%{transform:translate(-50%,-51.4%) rotate(-2.5deg) scale(1.025);}}
  @keyframes klirDash{to{stroke-dashoffset:-60;}}
  @keyframes klirTurn{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
  [data-feat]:nth-child(2) [data-feat-rail]{opacity:0.66;}
  [data-feat]:nth-child(3) [data-feat-rail]{opacity:0.42;}
  @keyframes klirSheen{0%{transform:translateX(-130%);}8%{transform:translateX(-130%);}46%{transform:translateX(130%);}100%{transform:translateX(130%);}}
  @keyframes klirHalo{0%,100%{transform:scale(1);opacity:0.5;}50%{transform:scale(1.18);opacity:0.14;}}
  @container (max-width:1000px){
    [data-price-value]{font-size:clamp(22px, 15.8cqw, 34px) !important;}
  }
  @container (max-width:200px){
    [data-plan-head]{flex-direction:column !important;align-items:flex-start !important;gap:5px !important;}
    [data-plan-head] > div:last-child{width:100% !important;text-align:left !important;}
  }
  @media (max-width:960px){
    [data-desktop-only]{display:none !important;}
    [data-mobile-only]{display:inline-flex !important;}
    [data-split]{grid-template-columns:1fr !important;gap:44px !important;}
    [data-copy]{order:1 !important;}
    [data-visual]{order:2 !important;}
    [data-cols-3]{grid-template-columns:1fr !important;}
    [data-cols-4]{grid-template-columns:1fr 1fr !important;}
    [data-cols-5]{grid-template-columns:1fr 1fr !important;}
    [data-hero]{grid-template-columns:1fr !important;gap:44px !important;text-align:center;}
    [data-hero-actions]{justify-content:center !important;}
    [data-hero-title]{font-size:40px !important;}
    [data-sec-title]{font-size:29px !important;}
    [data-orbit]{max-width:360px !important;}
    [data-mock-side]{display:none !important;}
    [data-card]{width:min(420px,88%) !important;margin-left:auto !important;margin-right:auto !important;}
    [data-bill]{display:none !important;}
    [data-mock-body]{grid-template-columns:1fr !important;}
    [data-mock-split]{grid-template-columns:1fr !important;}
    [data-pad]{padding-left:20px !important;padding-right:20px !important;}
    [data-sec]{margin-top:84px !important;}
    [data-cmp-grid]{grid-template-columns:1fr !important;}
    [data-cmp-grid] > div{border-right:none !important;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09)) !important;}
    [data-pillars]{grid-template-columns:1fr 1fr !important;}
    [data-chip3d]{display:none !important;}
    [data-fan]{display:none !important;}
    [data-constellation]{display:none !important;}
    [data-ai-core]{display:none !important;}
    [data-beam]{display:none !important;}
    [data-fly]{display:none !important;}
    [data-after-val]{opacity:1 !important;}
    [data-conflict]{opacity:1 !important;}
    [data-mess]{opacity:1 !important;}
    [data-stale]{opacity:1 !important;}
    [data-prov]{opacity:1 !important;}
    [data-seal]{opacity:1 !important;transform:none !important;}
    [data-feat-feed]{display:none !important;}
    [data-tilt3d]{transform:none !important;}
  }
</style>
<div data-page-root="true" style="background:var(--k-bg,#06080C);min-height:100vh;overflow-x:clip;">

  <nav style="position:fixed;top:0;left:0;right:0;width:100%;z-index:60;background:var(--k-nav,rgba(6,8,12,0.88));backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));">
    <div data-pad="true" style="max-width:1180px;margin:0 auto;padding:0 28px;height:64px;display:flex;align-items:center;justify-content:space-between;gap:24px;">
      <a href="#top" style="display:flex;align-items:center;gap:10px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 0.8l11.2 6v10.4L12 23.2 0.8 17.2V6.8z" fill="var(--k-accent,#0058BE)"></path>
          <path d="M8.2 6.6v10.8M8.2 12l6.4-5.4M8.2 12l6.9 5.4" stroke="#FFFFFF" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        <span style="font-family:'Outfit',sans-serif;font-size:15px;font-weight:700;letter-spacing:0.06em;color:var(--k-ink,#F5F7FA);">KLIR</span>
      </a>

      <div data-desktop-only="true" style="display:flex;align-items:center;gap:4px;">
        <a href="#produk" data-hover="color:var(--k-ink,#F5F7FA);" style="font-size:13.5px;color:var(--k-ink2,#8A93A3);padding:8px 13px;border-radius:7px;">Produk</a>
        <a href="#sumber" data-hover="color:var(--k-ink,#F5F7FA);" style="font-size:13.5px;color:var(--k-ink2,#8A93A3);padding:8px 13px;border-radius:7px;">Sumber Daya</a>
        <a href="#harga" data-hover="color:var(--k-ink,#F5F7FA);" style="font-size:13.5px;color:var(--k-ink2,#8A93A3);padding:8px 13px;border-radius:7px;">Harga</a>
        <a href="#docs" data-hover="color:var(--k-ink,#F5F7FA);" style="font-size:13.5px;color:var(--k-ink2,#8A93A3);padding:8px 13px;border-radius:7px;">Dokumentasi</a>
      </div>

      <div style="display:flex;align-items:center;gap:10px;">
        <button data-theme-toggle="true" aria-label="Ganti mode tampilan" style="display:inline-flex;align-items:center;gap:7px;font-family:inherit;font-size:12.5px;font-weight:500;color:var(--k-ink2,#8A93A3);background:var(--k-tint,rgba(255,255,255,0.04));border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:999px;padding:7px 13px;cursor:pointer;transition:color 160ms ease,border-color 160ms ease;" data-hover="color:var(--k-ink,#F5F7FA);border-color:var(--k-line-strong,rgba(255,255,255,0.2));">
          <svg data-theme-icon="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4.2"></circle>
            <path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4"></path>
          </svg>
          <span data-theme-label="true" data-desktop-only="true">Terang</span>
        </button>
        <a data-desktop-only="true" data-open-auth="login" href="#masuk" style="font-size:13.5px;color:var(--k-ink2,#8A93A3);padding:8px 12px;font-weight:500;">Masuk</a>
        <a data-open-auth="register" href="#demo" style="font-size:13.5px;font-weight:600;color:#FFFFFF;background:linear-gradient(180deg,#0F6FE0,var(--k-accent,#0058BE));padding:9px 16px;border-radius:8px;white-space:nowrap;box-shadow:0 4px 14px rgba(0,88,190,0.3);transition:transform 170ms ease,filter 170ms ease;" data-hover="transform:translateY(-1px);filter:brightness(1.1);color:#FFFFFF;">Minta demo</a>
        <button data-mobile-only="true" data-menu-btn="true" aria-label="Menu" style="display:none;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;background:var(--k-tint,rgba(255,255,255,0.04));border:1px solid var(--k-line,rgba(255,255,255,0.09));cursor:pointer;padding:0;color:var(--k-ink,#F5F7FA);">
          <svg width="15" height="12" viewBox="0 0 15 12" fill="none" aria-hidden="true"><path d="M0 1h15M0 6h15M0 11h15" stroke="currentColor" stroke-width="1.5"></path></svg>
        </button>
      </div>
    </div>

    <div data-mobile-panel="true" style="display:none;border-top:1px solid var(--k-line,rgba(255,255,255,0.09));padding:12px 20px 18px;flex-direction:column;background:var(--k-surface,#0B0E14);">
      <a href="#produk" style="font-size:15px;color:var(--k-ink2,#8A93A3);padding:10px 0;">Produk</a>
      <a href="#sumber" style="font-size:15px;color:var(--k-ink2,#8A93A3);padding:10px 0;">Sumber Daya</a>
      <a href="#harga" style="font-size:15px;color:var(--k-ink2,#8A93A3);padding:10px 0;">Harga</a>
      <a href="#docs" style="font-size:15px;color:var(--k-ink2,#8A93A3);padding:10px 0;">Dokumentasi</a>
      <a data-open-auth="login" href="#masuk" style="font-size:15px;color:var(--k-ink,#F5F7FA);padding:10px 0;border-top:1px solid var(--k-line,rgba(255,255,255,0.09));margin-top:6px;">Masuk</a>
    </div>
  </nav>

  <header id="top" data-pad="true" style="position:relative;max-width:1180px;margin:0 auto;padding:114px 28px 0;">
    <div data-hero-canvas="true" aria-hidden="true" style="position:absolute;left:-12%;right:-12%;top:-96px;width:124%;height:calc(100% + 150px);z-index:0;pointer-events:none;-webkit-mask-image:radial-gradient(104% 76% at 56% 40%, #000 34%, transparent 82%);mask-image:radial-gradient(104% 76% at 56% 40%, #000 34%, transparent 82%);"></div>
    <div data-hero="true" style="position:relative;z-index:1;display:grid;grid-template-columns:1fr 0.92fr;gap:56px;align-items:center;">

      <div>
        <a href="#changelog" style="display:inline-flex;align-items:center;gap:10px;padding:5px 14px 5px 6px;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:999px;font-size:12.5px;color:var(--k-ink2,#8A93A3);margin-bottom:28px;">
          <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--k-accent,#0058BE);color:#FFFFFF;font-size:10px;font-weight:600;letter-spacing:0.12em;padding:4px 9px;border-radius:999px;text-transform:uppercase;">Baru</span>
          Pembaruan terbaru KLIR akan tampil di sini
          <span style="color:var(--k-ink3,#5C6474);">&#8594;</span>
        </a>

        <h1 data-hero-title="true" style="font-size:58px;line-height:1.06;letter-spacing:-0.035em;font-weight:600;color:var(--k-ink,#F5F7FA);margin:0 0 22px;">Satu sistem untuk seluruh operasi usahamu</h1>

        <p style="font-size:18px;line-height:1.6;color:var(--k-ink2,#8A93A3);max-width:520px;margin-bottom:32px;">Tujuh fungsi operasi yang biasanya kamu kelola di aplikasi terpisah kini berjalan di dalam satu sistem yang sama. Bukan tampilannya saja yang digabung: rencana, pembukuan, promosi, dan kelola tugas tim membaca dan menulis ke satu data usaha yang sama.</p>

        <div data-hero-actions="true" style="display:flex;gap:12px;flex-wrap:wrap;">
          <a data-open-auth="register" href="#demo" style="display:inline-flex;align-items:center;gap:9px;font-size:15px;font-weight:600;color:#FFFFFF;background:linear-gradient(180deg,#0F6FE0,var(--k-accent,#0058BE));padding:14px 24px;border-radius:10px;white-space:nowrap;box-shadow:0 10px 26px rgba(0,88,190,0.32);transition:transform 180ms ease,filter 180ms ease;" data-hover="transform:translateY(-2px);filter:brightness(1.1);color:#FFFFFF;">Minta demo <span style="opacity:0.75;">&#8594;</span></a>
          <a href="#platform" style="display:inline-flex;align-items:center;font-size:15px;font-weight:600;color:var(--k-ink,#F5F7FA);border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));padding:14px 24px;border-radius:10px;white-space:nowrap;transition:background 180ms ease;" data-hover="background:var(--k-tint,rgba(255,255,255,0.05));color:var(--k-ink,#F5F7FA);">Lihat cara kerjanya</a>
        </div>
        <p style="font-size:12.5px;color:var(--k-ink3,#5C6474);margin-top:18px;">Ilustrasi masa uji coba: 14 hari, tanpa kartu kredit, bisa dibatalkan kapan saja</p>
      </div>

      <div data-visual="true" style="display:flex;justify-content:center;width:100%;">
        <div data-orbit="true" style="position:relative;width:100%;max-width:520px;aspect-ratio:1 / 1;">

          <div data-core="true" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:16;display:flex;flex-direction:column;align-items:center;gap:64px;pointer-events:none;">
            <span></span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.18em;text-transform:uppercase;color:var(--k-ink3,#5C6474);white-space:nowrap;">Satu data usaha</span>
          </div>

          <div data-node="0" style="position:absolute;left:50%;top:12%;transform:translate(-50%,-50%);">
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;transition:transform 240ms cubic-bezier(0.16,1,0.3,1);" data-hover="transform:scale(1.16);">
              <span style="display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:13px;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));background:var(--k-surface,#0B0E14);transition:border-color 200ms ease,background 200ms ease;" data-hover="border-color:var(--k-accent2,#4E9BFF);background:var(--k-accent-bg,rgba(0,88,190,0.18));">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.2h7L18 7.6v13.2H6.5z"></path><path d="M9.4 12.2h5.8M9.4 16h4"></path></svg>
              </span>
              <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);white-space:nowrap;">Rencana</span>
            </div>
          </div>
          <div data-node="1" style="position:absolute;left:82.9%;top:31%;transform:translate(-50%,-50%);">
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;transition:transform 240ms cubic-bezier(0.16,1,0.3,1);" data-hover="transform:scale(1.16);">
              <span style="display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:13px;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));background:var(--k-surface,#0B0E14);transition:border-color 200ms ease,background 200ms ease;" data-hover="border-color:var(--k-accent2,#4E9BFF);background:var(--k-accent-bg,rgba(0,88,190,0.18));">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M5 19.4V12M10 19.4V6.4M15 19.4V14.6M20 19.4V9.4"></path></svg>
              </span>
              <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);white-space:nowrap;">Keuangan</span>
            </div>
          </div>
          <div data-node="2" style="position:absolute;left:82.9%;top:69%;transform:translate(-50%,-50%);">
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;transition:transform 240ms cubic-bezier(0.16,1,0.3,1);" data-hover="transform:scale(1.16);">
              <span style="display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:13px;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));background:var(--k-surface,#0B0E14);transition:border-color 200ms ease,background 200ms ease;" data-hover="border-color:var(--k-accent2,#4E9BFF);background:var(--k-accent-bg,rgba(0,88,190,0.18));">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.6 9.8v4.4h3.2l6.4 4.2V5.6L6.8 9.8z"></path><path d="M17 9.4a3.6 3.6 0 0 1 0 5.2"></path></svg>
              </span>
              <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);white-space:nowrap;">Promosi</span>
            </div>
          </div>
          <div data-node="3" style="position:absolute;left:50%;top:88%;transform:translate(-50%,-50%);">
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;transition:transform 240ms cubic-bezier(0.16,1,0.3,1);" data-hover="transform:scale(1.16);">
              <span style="display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:13px;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));background:var(--k-surface,#0B0E14);transition:border-color 200ms ease,background 200ms ease;" data-hover="border-color:var(--k-accent2,#4E9BFF);background:var(--k-accent-bg,rgba(0,88,190,0.18));">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9.2" cy="8.4" r="2.9"></circle><path d="M4 19c0-2.9 2.3-4.4 5.2-4.4S14.4 16.1 14.4 19"></path><path d="M16.2 6.4a2.8 2.8 0 0 1 0 5.6"></path><path d="M17 14.8c2.1.5 3.4 1.8 3.4 4.2"></path></svg>
              </span>
              <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);white-space:nowrap;">Kelola tim</span>
            </div>
          </div>
          <div data-node="4" style="position:absolute;left:17.1%;top:69%;transform:translate(-50%,-50%);">
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;transition:transform 240ms cubic-bezier(0.16,1,0.3,1);" data-hover="transform:scale(1.16);">
              <span style="display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:13px;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));background:var(--k-surface,#0B0E14);transition:border-color 200ms ease,background 200ms ease;" data-hover="border-color:var(--k-accent2,#4E9BFF);background:var(--k-accent-bg,rgba(0,88,190,0.18));">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.4 5.4h15.2v10.2H10l-4.2 3.4v-3.4H4.4z"></path></svg>
              </span>
              <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);white-space:nowrap;">KLIR Personal</span>
            </div>
          </div>
          <div data-node="5" style="position:absolute;left:17.1%;top:31%;transform:translate(-50%,-50%);">
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;transition:transform 240ms cubic-bezier(0.16,1,0.3,1);" data-hover="transform:scale(1.16);">
              <span style="display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:13px;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));background:var(--k-surface,#0B0E14);transition:border-color 200ms ease,background 200ms ease;" data-hover="border-color:var(--k-accent2,#4E9BFF);background:var(--k-accent-bg,rgba(0,88,190,0.18));">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 4.6h13a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V5.6a1 1 0 0 1 1-1z"></path><path d="M4.5 9.2h15M8.4 3v3.2M15.6 3v3.2"></path></svg>
              </span>
              <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);white-space:nowrap;">Jadwal usaha</span>
            </div>
          </div>
          <div data-node="6" style="position:absolute;left:65%;top:12%;transform:translate(-50%,-50%);">
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;transition:transform 240ms cubic-bezier(0.16,1,0.3,1);" data-hover="transform:scale(1.16);">
              <span style="display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:13px;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));background:var(--k-surface,#0B0E14);transition:border-color 200ms ease,background 200ms ease;" data-hover="border-color:var(--k-accent2,#4E9BFF);background:var(--k-accent-bg,rgba(0,88,190,0.18));">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"></path><path d="M9 12l2 2 4-4"></path></svg>
              </span>
              <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);white-space:nowrap;">Kepatuhan</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>

  <section data-sec="true" data-pad="true" style="position:relative;max-width:1180px;margin:120px auto 0;padding:0 28px;">
    <div data-reveal="true" style="max-width:760px;margin:0 auto 26px;text-align:center;">
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);margin-bottom:10px;">Ruang kerja</div>
      <div style="font-family:'Outfit',sans-serif;font-size:21px;font-weight:600;letter-spacing:-0.02em;line-height:1.35;color:var(--k-ink,#F5F7FA);text-wrap:pretty;">Tujuh fungsi operasi, satu sumber angka.</div>
    </div>
    <div data-stage3d="true" style="position:relative;z-index:1;perspective:1600px;perspective-origin:50% 36%;">
    <div data-tilt3d="true" style="position:relative;transform:rotateX(6deg);transform-origin:50% 100%;will-change:transform;backface-visibility:hidden;">
    <div data-reveal="true" data-pillars="true" style="position:relative;z-index:1;display:grid;grid-template-columns:repeat(7,1fr);gap:8px;max-width:1000px;margin:0 auto;">
      <div data-pillar="true" style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:8px;padding:12px 6px;background:rgba(255,255,255,0.035);transition:border-color 420ms ease, background 420ms ease, box-shadow 420ms ease, transform 420ms cubic-bezier(0.16,1,0.3,1);">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.14em;color:var(--k-accent2,#4E9BFF);margin-bottom:6px;">01</div>
        <div style="font-size:12px;font-weight:500;letter-spacing:-0.01em;color:var(--k-ink,#F5F7FA);">Rencana bisnis</div>
      </div>
      <div data-pillar="true" style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:8px;padding:12px 6px;background:rgba(255,255,255,0.035);transition:border-color 420ms ease, background 420ms ease, box-shadow 420ms ease, transform 420ms cubic-bezier(0.16,1,0.3,1);">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.14em;color:var(--k-accent2,#4E9BFF);margin-bottom:6px;">02</div>
        <div style="font-size:12px;font-weight:500;letter-spacing:-0.01em;color:var(--k-ink,#F5F7FA);">Keuangan</div>
      </div>
      <div data-pillar="true" style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:8px;padding:12px 6px;background:rgba(255,255,255,0.035);transition:border-color 420ms ease, background 420ms ease, box-shadow 420ms ease, transform 420ms cubic-bezier(0.16,1,0.3,1);">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.14em;color:var(--k-accent2,#4E9BFF);margin-bottom:6px;">03</div>
        <div style="font-size:12px;font-weight:500;letter-spacing:-0.01em;color:var(--k-ink,#F5F7FA);">Promosi</div>
      </div>
      <div data-pillar="true" style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:8px;padding:12px 6px;background:rgba(255,255,255,0.035);transition:border-color 420ms ease, background 420ms ease, box-shadow 420ms ease, transform 420ms cubic-bezier(0.16,1,0.3,1);">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.14em;color:var(--k-accent2,#4E9BFF);margin-bottom:6px;">04</div>
        <div style="font-size:12px;font-weight:500;letter-spacing:-0.01em;color:var(--k-ink,#F5F7FA);">Kelola tim</div>
      </div>
      <div data-pillar="true" style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:8px;padding:12px 6px;background:rgba(255,255,255,0.035);transition:border-color 420ms ease, background 420ms ease, box-shadow 420ms ease, transform 420ms cubic-bezier(0.16,1,0.3,1);">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.14em;color:var(--k-accent2,#4E9BFF);margin-bottom:6px;">05</div>
        <div style="font-size:12px;font-weight:500;letter-spacing:-0.01em;color:var(--k-ink,#F5F7FA);">Kepatuhan</div>
      </div>
      <div data-pillar="true" style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:8px;padding:12px 6px;background:rgba(255,255,255,0.035);transition:border-color 420ms ease, background 420ms ease, box-shadow 420ms ease, transform 420ms cubic-bezier(0.16,1,0.3,1);">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.14em;color:var(--k-accent2,#4E9BFF);margin-bottom:6px;">06</div>
        <div style="font-size:12px;font-weight:500;letter-spacing:-0.01em;color:var(--k-ink,#F5F7FA);">KLIR Personal</div>
      </div>
      <div style="border:1px dashed var(--k-line-strong,rgba(255,255,255,0.16));border-radius:8px;padding:11px 6px;background:var(--k-tint,rgba(255,255,255,0.02));">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.14em;color:var(--k-ink3,#5C6474);margin-bottom:6px;">07</div>
        <div style="font-size:11px;font-weight:500;color:var(--k-ink3,#5C6474);letter-spacing:-0.01em;">Jadwal usaha</div>
      </div>
    </div>
    <div data-fan="true" aria-hidden="true" style="position:relative;height:46px;max-width:1000px;margin:0 auto;pointer-events:none;">
      <svg viewBox="0 0 1000 46" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;">
        <g fill="none" stroke="rgba(78,155,255,0.34)" stroke-width="1" stroke-linecap="round" stroke-dasharray="3 6">
          <path d="M71.4 0 C71.4 24 500 21 500 46"></path>
          <path d="M214.3 0 C214.3 24 500 21 500 46"></path>
          <path d="M357.1 0 C357.1 24 500 21 500 46"></path>
          <path d="M500 0 L500 46"></path>
          <path d="M642.9 0 C642.9 24 500 21 500 46"></path>
        </g>
        <g fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1" stroke-linecap="round" stroke-dasharray="2 8">
          <path d="M785.7 0 C785.7 24 500 21 500 46"></path>
          <path d="M928.6 0 C928.6 24 500 21 500 46"></path>
        </g>
      </svg>    </div>
    <div data-frame-wrap="true" style="position:relative;">
    <div data-reveal="true" data-frame3d="true" style="position:relative;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:16px;overflow:hidden;background:var(--k-surface,#0B0E14);box-shadow:0 34px 80px rgba(0,0,0,0.5), 0 4px 0 rgba(255,255,255,0.04) inset;">
      <div aria-hidden="true" style="position:absolute;right:-60px;top:-70px;width:220px;height:220px;background:radial-gradient(closest-side, rgba(78,155,255,0.28), rgba(11,14,20,0) 70%);filter:blur(6px);pointer-events:none;z-index:0;"></div>
      <div aria-hidden="true" style="position:absolute;left:-50px;bottom:-60px;width:180px;height:180px;background:radial-gradient(closest-side, rgba(201,166,107,0.22), rgba(11,14,20,0) 70%);filter:blur(6px);pointer-events:none;z-index:0;"></div>
      <span aria-hidden="true" style="position:absolute;width:18px;height:18px;pointer-events:none;z-index:2;top:10px;left:10px;border-top:1px solid rgba(201,166,107,0.5);border-left:1px solid rgba(201,166,107,0.5);border-radius:4px 0 0 0;animation:klirBeat 3s ease-in-out infinite;"></span>
      <span aria-hidden="true" style="position:absolute;width:18px;height:18px;pointer-events:none;z-index:2;bottom:10px;right:10px;border-bottom:1px solid rgba(201,166,107,0.5);border-right:1px solid rgba(201,166,107,0.5);border-radius:0 0 4px 0;animation:klirBeat 3s ease-in-out infinite;animation-delay:1s;"></span>
      <span aria-hidden="true" style="position:absolute;width:18px;height:18px;pointer-events:none;z-index:2;top:10px;right:10px;border-top:1px solid rgba(78,155,255,0.42);border-right:1px solid rgba(78,155,255,0.42);border-radius:0 4px 0 0;animation:klirBeat 3s ease-in-out infinite;animation-delay:0.5s;"></span>
      <span aria-hidden="true" style="position:absolute;width:18px;height:18px;pointer-events:none;z-index:2;bottom:10px;left:10px;border-bottom:1px solid rgba(78,155,255,0.42);border-left:1px solid rgba(78,155,255,0.42);border-radius:0 0 0 4px;animation:klirBeat 3s ease-in-out infinite;animation-delay:1.5s;"></span>
      <div style="position:relative;z-index:1;display:flex;align-items:center;gap:14px;padding:12px 16px;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));">
        <div style="display:flex;gap:6px;">
          <span style="width:9px;height:9px;border-radius:50%;background:var(--k-line-strong,rgba(255,255,255,0.16));"></span>
          <span style="width:9px;height:9px;border-radius:50%;background:var(--k-line-strong,rgba(255,255,255,0.16));"></span>
          <span style="width:9px;height:9px;border-radius:50%;background:var(--k-line-strong,rgba(255,255,255,0.16));"></span>
        </div>
        <div style="flex:1;display:flex;justify-content:center;">
          <div style="font-size:11.5px;color:var(--k-ink3,#5C6474);background:var(--k-tint,rgba(255,255,255,0.03));border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:4px 14px;border-radius:6px;">klir.id/ruang/kedai-kopi-senja</div>
        </div>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--k-ink3,#5C6474);border:1px dashed var(--k-line-strong,rgba(255,255,255,0.16));border-radius:5px;padding:3px 8px;">Data contoh</div>
      </div>

      <div data-mock-body="true" style="display:grid;grid-template-columns:212px 1fr;min-height:440px;">
        <aside data-mock-side="true" style="border-right:1px solid var(--k-line,rgba(255,255,255,0.09));padding:16px 12px;display:flex;flex-direction:column;gap:20px;background:var(--k-tint,rgba(255,255,255,0.02));">
          <div style="display:flex;align-items:center;gap:9px;padding:0 6px;">
            <div style="width:21px;height:21px;border-radius:6px;background:var(--k-accent,#0058BE);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#FFFFFF;">K</div>
            <div style="font-size:12.5px;font-weight:600;color:var(--k-ink2,#8A93A3);">Kedai Kopi Senja (contoh)</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <div style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:6px;background:var(--k-accent-bg,rgba(0,88,190,0.16));font-size:12.5px;color:var(--k-ink,#F5F7FA);"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);"></span>Ringkasan</div>
            <div style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:6px;font-size:12.5px;color:var(--k-ink2,#8A93A3);"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-line-strong,rgba(255,255,255,0.16));"></span>Rencana</div>
            <div style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:6px;font-size:12.5px;color:var(--k-ink2,#8A93A3);"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-line-strong,rgba(255,255,255,0.16));"></span>Keuangan</div>
            <div style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:6px;font-size:12.5px;color:var(--k-ink2,#8A93A3);"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-line-strong,rgba(255,255,255,0.16));"></span>Promosi</div>
            <div style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:6px;font-size:12.5px;color:var(--k-ink2,#8A93A3);"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-line-strong,rgba(255,255,255,0.16));"></span>Kelola tim</div>
            <div style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:6px;font-size:12.5px;color:var(--k-ink2,#8A93A3);"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-line-strong,rgba(255,255,255,0.16));"></span>Kepatuhan</div>
            <div style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:6px;font-size:12.5px;color:var(--k-ink2,#8A93A3);"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-line-strong,rgba(255,255,255,0.16));"></span>KLIR Personal</div>
            <div style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:6px;font-size:12.5px;color:var(--k-ink3,#5C6474);"><span style="width:5px;height:5px;border-radius:50%;border:1px dashed var(--k-line-strong,rgba(255,255,255,0.16));"></span>Jadwal usaha</div>
          </div>
          <div style="margin-top:auto;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:9px;padding:11px;">
            <div style="font-size:11px;color:var(--k-ink3,#5C6474);margin-bottom:6px;">Kesehatan usaha</div>
            <div style="font-family:'Outfit',sans-serif;font-size:20px;font-weight:600;letter-spacing:-0.02em;margin-bottom:8px;color:var(--k-ink,#F5F7FA);"><span data-countup="82">0</span><span style="font-size:12px;color:var(--k-ink3,#5C6474);">/100</span></div>
            <div style="height:4px;border-radius:99px;background:var(--k-line,rgba(255,255,255,0.09));overflow:hidden;"><div style="width:82%;height:100%;background:var(--k-accent,#0058BE);"></div></div>
          </div>
        </aside>

        <div style="padding:20px;display:flex;flex-direction:column;gap:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
            <div>
              <div style="font-family:'Outfit',sans-serif;font-size:15.5px;font-weight:600;letter-spacing:-0.015em;color:var(--k-ink,#F5F7FA);">Ringkasan usaha</div>
              <div style="display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--k-ink3,#5C6474);margin-top:4px;">
                <span style="width:6px;height:6px;border-radius:50%;background:var(--k-ok,#3FBF8F);animation:klirBeat 2.6s ease-in-out infinite;"></span>
                <span data-live-clock="true">Diperbarui baru saja</span>
              </div>
            </div>
            <div style="display:flex;gap:7px;">
              <div style="font-size:11.5px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:5px 11px;border-radius:6px;">Periode berjalan</div>
              <div style="font-size:11.5px;color:var(--k-ink,#F5F7FA);border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));padding:5px 11px;border-radius:6px;">Ekspor</div>
            </div>
          </div>

          <div data-cols-4="true" data-kpi-row="true" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
            <div style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:10px;padding:12px;">
              <div style="font-size:11px;color:var(--k-ink3,#5C6474);">Pendapatan</div>
              <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:600;letter-spacing:-0.02em;margin:6px 0 4px;color:var(--k-ink,#F5F7FA);">Rp <span data-countup="148.2" data-decimal="1">0</span>jt</div>
              <div style="font-size:11px;color:var(--k-ok,#3FBF8F);">+12,4%</div>
            </div>
            <div style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:10px;padding:12px;">
              <div style="font-size:11px;color:var(--k-ink3,#5C6474);">Laba kotor</div>
              <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:600;letter-spacing:-0.02em;margin:6px 0 4px;color:var(--k-ink,#F5F7FA);">Rp 51,7jt</div>
              <div style="font-size:11px;color:var(--k-ok,#3FBF8F);">+6,1%</div>
            </div>
            <div style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:10px;padding:12px;">
              <div style="font-size:11px;color:var(--k-ink3,#5C6474);">Arus kas</div>
              <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:600;letter-spacing:-0.02em;margin:6px 0 4px;">Rp 23,9jt</div>
              <div style="font-size:11px;color:var(--k-ink2,#8A93A3);">Aman 4 bulan</div>
            </div>
            <div style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:10px;padding:12px;">
              <div style="font-size:11px;color:var(--k-ink3,#5C6474);">Kepatuhan</div>
              <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:600;letter-spacing:-0.02em;margin:6px 0 4px;">9/10</div>
              <div style="font-size:11px;color:var(--k-warn,#D8A33C);">1 kebijakan perlu ditinjau</div>
            </div>
          </div>

          <div data-mock-split="true" style="display:grid;grid-template-columns:1.6fr 1fr;gap:12px;flex:1;">
            <div style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:12px;padding:15px;display:flex;flex-direction:column;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
                <div style="font-size:12.5px;font-weight:600;">Pendapatan 12 minggu</div>
                <div style="display:flex;gap:12px;font-size:10.5px;color:var(--k-ink3,#5C6474);">
                  <span style="display:flex;align-items:center;gap:5px;"><span style="width:7px;height:7px;border-radius:2px;background:var(--k-line-strong,rgba(255,255,255,0.16));"></span>Realisasi</span>
                  <span style="display:flex;align-items:center;gap:5px;"><span style="width:7px;height:7px;border-radius:2px;background:var(--k-accent,#0058BE);"></span>Proyeksi</span>
                </div>
              </div>
              <div style="display:flex;align-items:flex-end;gap:7px;height:132px;">
                <div data-bar="38" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 780ms cubic-bezier(0.16,1,0.3,1);transition-delay:0ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-6px;height:6px;background:rgba(255,255,255,0.30);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-6px;width:6px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
                <div data-bar="47" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 780ms cubic-bezier(0.16,1,0.3,1);transition-delay:50ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-6px;height:6px;background:rgba(255,255,255,0.30);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-6px;width:6px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
                <div data-bar="42" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 780ms cubic-bezier(0.16,1,0.3,1);transition-delay:100ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-6px;height:6px;background:rgba(255,255,255,0.30);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-6px;width:6px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
                <div data-bar="58" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 780ms cubic-bezier(0.16,1,0.3,1);transition-delay:150ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-6px;height:6px;background:rgba(255,255,255,0.30);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-6px;width:6px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
                <div data-bar="53" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 780ms cubic-bezier(0.16,1,0.3,1);transition-delay:200ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-6px;height:6px;background:rgba(255,255,255,0.30);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-6px;width:6px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
                <div data-bar="66" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 780ms cubic-bezier(0.16,1,0.3,1);transition-delay:250ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-6px;height:6px;background:rgba(255,255,255,0.30);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-6px;width:6px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
                <div data-bar="61" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 780ms cubic-bezier(0.16,1,0.3,1);transition-delay:300ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-6px;height:6px;background:rgba(255,255,255,0.30);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-6px;width:6px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
                <div data-bar="74" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 780ms cubic-bezier(0.16,1,0.3,1);transition-delay:350ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-6px;height:6px;background:rgba(255,255,255,0.30);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-6px;width:6px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
                <div data-bar="70" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 780ms cubic-bezier(0.16,1,0.3,1);transition-delay:400ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-6px;height:6px;background:rgba(255,255,255,0.30);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-6px;width:6px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
                <div data-bar="84" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-accent,#0058BE);transition:height 780ms cubic-bezier(0.16,1,0.3,1);transition-delay:450ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-6px;height:6px;background:rgba(120,180,255,0.95);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-6px;width:6px;background:rgba(0,40,90,0.92);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
                <div data-bar="92" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-accent,#0058BE);transition:height 780ms cubic-bezier(0.16,1,0.3,1);transition-delay:500ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-6px;height:6px;background:rgba(120,180,255,0.95);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-6px;width:6px;background:rgba(0,40,90,0.92);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
                <div data-bar="100" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-accent,#0058BE);transition:height 780ms cubic-bezier(0.16,1,0.3,1);transition-delay:550ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-6px;height:6px;background:rgba(120,180,255,0.95);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-6px;width:6px;background:rgba(0,40,90,0.92);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
              
              </div>
            </div>

            <div style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:12px;padding:15px;display:flex;flex-direction:column;gap:11px;">
              <div style="font-size:12.5px;font-weight:600;">Saran KLIR</div>
              <div style="display:flex;gap:9px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:5px;flex-shrink:0;"></span><div style="font-size:11.5px;color:var(--k-ink2,#8A93A3);line-height:1.45;">Margin produk terlaris turun 3% sejak harga bahan baku naik.</div></div>
              <div style="display:flex;gap:9px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-line-strong,rgba(255,255,255,0.16));margin-top:5px;flex-shrink:0;"></span><div style="font-size:11.5px;color:var(--k-ink2,#8A93A3);line-height:1.45;">Ada tugas yang lewat tenggat dan belum ditandai selesai.</div></div>
              <div style="display:flex;gap:9px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-line-strong,rgba(255,255,255,0.16));margin-top:5px;flex-shrink:0;"></span><div style="font-size:11.5px;color:var(--k-ink2,#8A93A3);line-height:1.45;">Dua anggota tim belum mengisi laporan stok kemarin.</div></div>
              <div style="margin-top:auto;font-size:11.5px;color:var(--k-ink,#F5F7FA);border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:7px;padding:8px 11px;text-align:center;">Lihat saran lain</div>
            </div>
          </div>
        </div>
      </div>
    </div>
      <div data-chip3d="true" style="position:absolute;right:-16px;top:-30px;z-index:4;display:flex;align-items:center;gap:10px;padding:9px 14px 9px 9px;border:1px solid rgba(78,155,255,0.3);border-radius:13px;background:#0C1017;box-shadow:0 22px 52px rgba(0,0,0,0.6), 0 0 0 1px rgba(78,155,255,0.1);">
        <canvas data-sigil="cube" width="88" height="88" aria-hidden="true" style="width:36px;height:36px;"></canvas>
        <div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);">Sinkron</div>
          <div style="font-size:12.5px;font-weight:600;letter-spacing:-0.01em;color:var(--k-ink,#F5F7FA);margin-top:2px;">Satu sumber angka</div>
        </div>
      </div>
    </div>
    </div>
    </div>
    <p style="text-align:center;font-size:12px;color:var(--k-ink3,#5C6474);margin-top:20px;">Antarmuka di atas memakai data contoh untuk ilustrasi. (Contoh &#183; tangkapan layar produk sebenarnya menyusul)</p>
  </section>

  <section id="platform" data-sec="true" data-pad="true" style="position:relative;max-width:1180px;margin:120px auto 0;padding:0 28px;">
    <div data-split="true" style="position:relative;z-index:1;display:grid;grid-template-columns:1fr 1.05fr;gap:64px;align-items:center;">
      <div data-copy="true" data-no-glyph="true" data-reveal="true" style="position:relative;z-index:0;">
        <svg data-constellation="true" aria-hidden="true" viewBox="0 0 320 320" style="position:absolute;left:-14px;top:-120px;width:200px;height:200px;z-index:-1;pointer-events:none;opacity:0.5;-webkit-mask-image:linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 17%, rgba(0,0,0,1) 43%, rgba(0,0,0,0) 58%);mask-image:linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 17%, rgba(0,0,0,1) 43%, rgba(0,0,0,0) 58%);">
        <g>
          <g fill="none" stroke="rgba(78,155,255,0.2)" stroke-width="1" stroke-linecap="round" stroke-dasharray="3 6">
          <path d="M160 42 L160 160"></path>
          <path d="M252.3 86.4 L160 160"></path>
          <path d="M275 186.3 L160 160"></path>
          <path d="M211.2 266.3 L160 160"></path>
          <path d="M108.8 266.3 L160 160"></path>
          <path d="M45 186.3 L160 160"></path>
          <path d="M67.7 86.4 L160 160"></path>
          </g>
          <g>
          <circle cx="160" cy="42" r="2.6" fill="rgba(78,155,255,0.3)"></circle>
          <circle cx="252.3" cy="86.4" r="2.6" fill="rgba(78,155,255,0.3)"></circle>
          <circle cx="275" cy="186.3" r="2.6" fill="rgba(78,155,255,0.3)"></circle>
          <circle cx="211.2" cy="266.3" r="2.6" fill="rgba(78,155,255,0.3)"></circle>
          <circle cx="108.8" cy="266.3" r="2.6" fill="rgba(78,155,255,0.3)"></circle>
          <circle cx="45" cy="186.3" r="2.6" fill="rgba(78,155,255,0.3)"></circle>
          <circle cx="67.7" cy="86.4" r="2.6" fill="rgba(78,155,255,0.3)"></circle>
          </g>
        </g>
        <circle cx="160" cy="160" r="27" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"></circle>
        <circle cx="160" cy="160" r="16" fill="none" stroke="rgba(201,166,107,0.26)" stroke-width="1"></circle>
        <circle cx="160" cy="160" r="7" fill="none" stroke="rgba(78,155,255,0.42)" stroke-width="1.4"></circle>
      </svg>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);margin-bottom:18px;">Satu platform</div>
        <h2 data-sec-title="true" style="font-size:38px;line-height:1.1;letter-spacing:-0.03em;font-weight:600;color:var(--k-ink,#F5F7FA);margin:0 0 18px;">Satu platform untuk seluruh kebutuhan usaha, tanpa berlangganan banyak aplikasi terpisah</h2>
        <p style="font-size:16px;line-height:1.65;color:var(--k-ink2,#8A93A3);max-width:460px;margin-bottom:22px;">Aplikasi pemantauan kerja, aplikasi pembukuan, aplikasi komunikasi tim: masing-masing punya tagihan sendiri, akun sendiri, dan angka yang tidak pernah cocok satu sama lain. KLIR menggantikan tumpukan itu dengan satu langganan dan satu data usaha.</p>
        <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px;">
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:14.5px;line-height:1.5;color:var(--k-ink2,#8A93A3);"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:8px;flex-shrink:0;"></span>Satu tagihan, bukan tujuh tagihan dari tujuh penyedia.</li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:14.5px;line-height:1.5;color:var(--k-ink2,#8A93A3);"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:8px;flex-shrink:0;"></span>Satu daftar anggota tim dan satu pengaturan hak akses.</li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:14.5px;line-height:1.5;color:var(--k-ink2,#8A93A3);"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:8px;flex-shrink:0;"></span>Tidak ada lagi menyalin angka antar aplikasi setiap akhir bulan.</li>
        </ul>
      </div>

      <div data-visual="true" style="position:relative;perspective:1400px;perspective-origin:50% 40%;">
        <div data-stack-stage="true" data-stack="true" style="position:relative;height:582px;will-change:transform;">
          <div data-card="0" style="position:absolute;left:0;right:0;top:0;transform:translate(-42px,26px) rotate(-11deg);transition:transform 900ms cubic-bezier(0.16,1,0.3,1);transition-delay:0ms;display:flex;align-items:center;gap:14px;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:12px;background:var(--k-surface,#0B0E14);padding:14px 16px;">
            <span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;border:1px solid var(--k-line,rgba(255,255,255,0.09));flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--k-ink2,#8A93A3)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.4"></circle><path d="M12 7.6V12l2.8 1.7"></path></svg>
            </span>
            <span style="flex:1;font-size:13.5px;font-weight:500;">Aplikasi absensi tim</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ink2,#8A93A3);">12/14 hadir</span>
            <span data-bill="true" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);white-space:nowrap;transition:opacity 320ms ease;">Rp &#8226;&#8226;&#8226;/bln</span>
          </div>
          <div data-card="1" style="position:absolute;left:0;right:0;top:0;transform:translate(38px,-14px) rotate(9deg);transition:transform 900ms cubic-bezier(0.16,1,0.3,1);transition-delay:70ms;display:flex;align-items:center;gap:14px;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:12px;background:var(--k-surface,#0B0E14);padding:14px 16px;">
            <span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;border:1px solid var(--k-line,rgba(255,255,255,0.09));flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--k-ink2,#8A93A3)" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 19V12.4M10 19V6.6M15 19v-4.4M20 19V9.6"></path></svg>
            </span>
            <span style="flex:1;font-size:13.5px;font-weight:500;">Aplikasi pembukuan</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ink2,#8A93A3);">Rp 4,8jt</span>
            <span data-bill="true" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);white-space:nowrap;transition:opacity 320ms ease;">Rp &#8226;&#8226;&#8226;/bln</span>
          </div>
          <div data-card="2" style="position:absolute;left:0;right:0;top:0;transform:translate(-30px,72px) rotate(6deg);transition:transform 900ms cubic-bezier(0.16,1,0.3,1);transition-delay:140ms;display:flex;align-items:center;gap:14px;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:12px;background:var(--k-surface,#0B0E14);padding:14px 16px;">
            <span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;border:1px solid var(--k-line,rgba(255,255,255,0.09));flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--k-ink2,#8A93A3)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.4 5.4h15.2v10.2H10l-4.2 3.4v-3.4H4.4z"></path></svg>
            </span>
            <span style="flex:1;font-size:13.5px;font-weight:500;">Aplikasi komunikasi tim</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ink2,#8A93A3);">24 pesan</span>
            <span data-bill="true" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);white-space:nowrap;transition:opacity 320ms ease;">Rp &#8226;&#8226;&#8226;/bln</span>
          </div>
          <div data-card="3" style="position:absolute;left:0;right:0;top:0;transform:translate(46px,54px) rotate(-7deg);transition:transform 900ms cubic-bezier(0.16,1,0.3,1);transition-delay:210ms;display:flex;align-items:center;gap:14px;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:12px;background:var(--k-surface,#0B0E14);padding:14px 16px;">
            <span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;border:1px solid var(--k-line,rgba(255,255,255,0.09));flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--k-ink2,#8A93A3)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.6 7.6 12 4.2l7.4 3.4v8.8L12 19.8l-7.4-3.4z"></path><path d="M4.6 7.6 12 11l7.4-3.4M12 11v8.8"></path></svg>
            </span>
            <span style="flex:1;font-size:13.5px;font-weight:500;">Aplikasi stok &amp; kasir</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ink2,#8A93A3);">3 menipis</span>
            <span data-bill="true" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);white-space:nowrap;transition:opacity 320ms ease;">Rp &#8226;&#8226;&#8226;/bln</span>
          </div>
          <div data-card="4" style="position:absolute;left:0;right:0;top:0;transform:translate(-52px,120px) rotate(12deg);transition:transform 900ms cubic-bezier(0.16,1,0.3,1);transition-delay:280ms;display:flex;align-items:center;gap:14px;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:12px;background:var(--k-surface,#0B0E14);padding:14px 16px;">
            <span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;border:1px solid var(--k-line,rgba(255,255,255,0.09));flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--k-ink2,#8A93A3)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.6 6.4h14.8v13H4.6z"></path><path d="M4.6 10.4h14.8M9 4.4v4M15 4.4v4"></path></svg>
            </span>
            <span style="flex:1;font-size:13.5px;font-weight:500;">Aplikasi bikin promosi</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ink2,#8A93A3);">2 draf tertunda</span>
            <span data-bill="true" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);white-space:nowrap;transition:opacity 320ms ease;">Rp &#8226;&#8226;&#8226;/bln</span>
          </div>
          <div data-card="5" style="position:absolute;left:0;right:0;top:0;transform:translate(24px,158px) rotate(-13deg);transition:transform 900ms cubic-bezier(0.16,1,0.3,1);transition-delay:350ms;display:flex;align-items:center;gap:14px;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:12px;background:var(--k-surface,#0B0E14);padding:14px 16px;">
            <span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;border:1px solid var(--k-line,rgba(255,255,255,0.09));flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--k-ink2,#8A93A3)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.6 3.4h7.2l4 4.2v13H6.6z"></path><path d="M9.4 12.6h5.2M9.4 16.2h3.4"></path></svg>
            </span>
            <span style="flex:1;font-size:13.5px;font-weight:500;">Aplikasi manajemen tugas</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ink2,#8A93A3);">3 belum selesai</span>
            <span data-bill="true" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);white-space:nowrap;transition:opacity 320ms ease;">Rp &#8226;&#8226;&#8226;/bln</span>
          </div>

          <div data-card="6" data-payoff="true" style="position:absolute;left:0;right:0;top:0;transform:translateY(410px);opacity:0;display:flex;align-items:center;gap:14px;border:1px solid var(--k-accent,#0058BE);border-radius:12px;background:linear-gradient(120deg, var(--k-glass,rgba(10,26,52,0.96)) 0%, var(--k-surface,#0B0E14) 62%);padding:16px;">
            <span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;background:var(--k-accent,#0058BE);flex-shrink:0;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.2 6.6v10.8M8.2 12l6.4-5.4M8.2 12l6.9 5.4" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            </span>
            <span style="flex:1;font-size:13.5px;font-weight:600;">KLIR &#183; satu langganan</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--k-accent2,#4E9BFF);white-space:nowrap;">Tujuh pilar</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="perbandingan" data-sec="true" data-pad="true" style="max-width:1060px;margin:130px auto 0;padding:0 28px;">
    <div data-reveal="true" style="text-align:center;margin-bottom:32px;">
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);margin-bottom:16px;">Sebelum &amp; sesudah</div>
      <h2 data-sec-title="true" style="font-size:34px;line-height:1.12;letter-spacing:-0.03em;font-weight:600;color:var(--k-ink,#F5F7FA);margin:0 auto 14px;max-width:620px;">Pekerjaan yang sama, dikerjakan tim yang sama, dengan satu layar</h2>
      <p style="font-size:15.5px;line-height:1.6;color:var(--k-ink2,#8A93A3);max-width:560px;margin:0 auto;">Kiri: catatan tersebar di aplikasi, berkas, dan percakapan yang berbeda. Kanan: layar yang sama setelah semuanya masuk ke KLIR.</p>
    </div>
    <div data-cmp-stage="true" style="perspective:1500px;perspective-origin:50% 38%;">
    <div data-cmp-tilt="true" style="position:relative;transform:rotateX(5deg);transform-origin:50% 100%;will-change:transform;backface-visibility:hidden;">
        <div data-ai-core="true" aria-hidden="true" style="position:absolute;left:50%;top:-26px;transform:translate(-50%,0) scale(0.9);opacity:0;z-index:6;display:flex;align-items:center;gap:10px;padding:7px 15px 7px 8px;border:1px solid rgba(78,155,255,0.42);border-radius:999px;background:#0B0E14;box-shadow:0 14px 36px rgba(0,0,0,0.55);white-space:nowrap;pointer-events:none;transition:opacity 320ms ease, transform 320ms cubic-bezier(0.16,1,0.3,1);">
          <span style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;flex-shrink:0;">
            <span style="position:absolute;inset:-3px;border-radius:50%;border:1px solid rgba(78,155,255,0.3);animation:klirHalo 3.4s ease-in-out infinite;"></span>
            <span style="position:absolute;inset:2px;border-radius:50%;background:radial-gradient(closest-side, rgba(0,88,190,0.55), rgba(11,14,20,0) 72%);"></span>
            <canvas data-sigil="ai" width="88" height="88" style="position:relative;width:30px;height:30px;"></canvas>
          </span>
          <span style="display:flex;flex-direction:column;gap:1px;">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);">AI KLIR</span>
            <span style="font-size:10.5px;color:var(--k-ink3,#5C6474);">merapikan otomatis</span>
          </span>
        </div>
    <div data-reveal="true" data-cmp-panel="true" style="position:relative;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:16px;overflow:hidden;background:var(--k-surface,#0B0E14);transition:box-shadow 400ms ease, border-color 400ms ease;">
      <div data-beam="true" aria-hidden="true" style="position:absolute;left:0;top:0;bottom:0;width:2px;z-index:3;opacity:0;pointer-events:none;background:linear-gradient(180deg, rgba(78,155,255,0) 0%, rgba(120,180,255,0.9) 18%, rgba(120,180,255,0.9) 82%, rgba(78,155,255,0) 100%);box-shadow:0 0 44px 14px rgba(78,155,255,0.16);">
        <span data-beam-label="true" style="position:absolute;left:50%;top:16px;transform:translateX(-50%);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);background:#0B0E14;border:1px solid rgba(78,155,255,0.34);border-radius:999px;padding:4px 9px;white-space:nowrap;">0/5</span>
      </div>
      <div data-fly="true" data-fly-from="1" data-fly-to="0" aria-hidden="true" style="position:absolute;left:0;top:0;z-index:5;opacity:0;pointer-events:none;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--k-ink,#F5F7FA);border:1px solid rgba(78,155,255,0.45);border-radius:7px;background:#0B0E14;padding:5px 9px;box-shadow:0 10px 26px rgba(0,0,0,0.5);will-change:transform;">Rp 4,8jt</div>
      <div data-fly="true" data-fly-from="0" data-fly-to="1" aria-hidden="true" style="position:absolute;left:0;top:0;z-index:5;opacity:0;pointer-events:none;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--k-ink,#F5F7FA);border:1px solid rgba(78,155,255,0.45);border-radius:7px;background:#0B0E14;padding:5px 9px;box-shadow:0 10px 26px rgba(0,0,0,0.5);will-change:transform;">12/14</div>
      <div data-cmp-grid="true" style="display:grid;grid-template-columns:1fr 1fr;min-height:330px;">
        <div style="position:relative;min-height:330px;padding:52px 22px 22px;border-right:1px solid var(--k-line,rgba(255,255,255,0.09));overflow:hidden;perspective:1000px;perspective-origin:50% 38%;transform-style:preserve-3d;">
          <span aria-hidden="true" style="position:absolute;left:-10%;right:-10%;bottom:0;height:150px;pointer-events:none;background:repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, rgba(255,255,255,0) 1px 40px), repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, rgba(255,255,255,0) 1px 26px);transform:rotateX(62deg);transform-origin:50% 100%;-webkit-mask-image:linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 78%);mask-image:linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 78%);"></span>
          <span aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(72% 60% at 50% 42%, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0) 62%), radial-gradient(120% 90% at 50% 50%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.45) 100%);"></span>
          <span style="position:absolute;z-index:7;top:16px;left:18px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));background:var(--k-tint,rgba(255,255,255,0.03));padding:6px 12px;border-radius:999px;">Sebelum</span>
          <svg data-tangle="true" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;">
            <g fill="none" stroke="var(--k-line-strong,rgba(255,255,255,0.16))" stroke-width="1" stroke-linecap="round" stroke-dasharray="3 4" vector-effect="non-scaling-stroke" style="animation:klirDash 7s linear infinite;">
              <path d="M19 27 Q33 35 50 52"></path>
              <path d="M81 22 Q66 31 50 52"></path>
              <path d="M24 71 Q36 63 50 52"></path>
              <path d="M78 77 Q64 67 50 52"></path>
            </g>
            <g fill="none" stroke="var(--k-line,rgba(255,255,255,0.09))" stroke-width="1" stroke-linecap="round" stroke-dasharray="2 6" vector-effect="non-scaling-stroke" style="animation:klirDash 11s linear infinite reverse;">
              <path d="M19 27 Q50 11 81 22"></path>
              <path d="M24 71 Q50 90 78 77"></path>
              <path d="M19 27 Q9 49 24 71"></path>
              <path d="M81 22 Q92 50 78 77"></path>
            </g>
          </svg>
          <div aria-hidden="true" style="position:absolute;left:9%;top:20%;width:104px;transform-style:preserve-3d;transform:translateZ(-46px) rotateY(13deg) rotateZ(-3.4deg);">
          <div data-note="0" style="position:relative;width:100%;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));border-radius:8px;background:linear-gradient(168deg, var(--k-raise,#161B23) 0%, var(--k-surface,#0B0E14) 100%);box-shadow:0 22px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06);padding:8px 10px;animation:klirDriftA 7s ease-in-out infinite;;transition:opacity 240ms ease, filter 240ms ease">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));">
              <span style="display:flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:4px;background:var(--k-line-strong,rgba(255,255,255,0.16));color:var(--k-ink2,#8A93A3);font-size:7.5px;font-weight:700;flex-shrink:0;">A</span>
              <span style="font-size:9px;color:var(--k-ink3,#5C6474);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Absensi</span>
            </div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ink,#F5F7FA);">12/14</div>
            <span data-stale="true" style="display:block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8.5px;color:var(--k-warn,#D8A33C);margin-top:5px;transition:opacity 240ms ease;">3 hari lalu</span>
          </div>
          </div>
          <div aria-hidden="true" style="position:absolute;right:8%;top:15%;width:110px;transform-style:preserve-3d;transform:translateZ(-18px) rotateY(-11deg) rotateZ(2.6deg);">
          <div data-note="1" style="position:relative;width:100%;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));border-radius:8px;background:linear-gradient(168deg, var(--k-raise,#161B23) 0%, var(--k-surface,#0B0E14) 100%);box-shadow:0 22px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06);padding:8px 10px;animation:klirDriftB 8.4s ease-in-out infinite;;transition:opacity 240ms ease, filter 240ms ease">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));">
              <span style="display:flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:4px;background:var(--k-line-strong,rgba(255,255,255,0.16));color:var(--k-ink2,#8A93A3);font-size:7.5px;font-weight:700;flex-shrink:0;">P</span>
              <span style="font-size:9px;color:var(--k-ink3,#5C6474);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Pembukuan</span>
            </div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ink,#F5F7FA);">Rp 4,8jt</div>
            <span data-stale="true" style="display:block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8.5px;color:var(--k-warn,#D8A33C);margin-top:5px;transition:opacity 240ms ease;"><span style="text-decoration:line-through;opacity:0.8;">Rp 5,1jt</span> di app lain</span>
          </div>
          </div>
          <div aria-hidden="true" style="position:absolute;left:14%;bottom:22%;width:100px;transform-style:preserve-3d;transform:translateZ(-64px) rotateY(9deg) rotateZ(3.2deg);">
          <div data-note="2" style="position:relative;width:100%;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));border-radius:8px;background:linear-gradient(168deg, var(--k-raise,#161B23) 0%, var(--k-surface,#0B0E14) 100%);box-shadow:0 22px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06);padding:8px 10px;animation:klirDriftC 6.6s ease-in-out infinite;;transition:opacity 240ms ease, filter 240ms ease">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));">
              <span style="display:flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:4px;background:var(--k-line-strong,rgba(255,255,255,0.16));color:var(--k-ink2,#8A93A3);font-size:7.5px;font-weight:700;flex-shrink:0;">C</span>
              <span style="font-size:9px;color:var(--k-ink3,#5C6474);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Chat tim</span>
            </div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ink,#F5F7FA);">24 pesan</div>
            <span data-stale="true" style="display:block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8.5px;color:var(--k-warn,#D8A33C);margin-top:5px;transition:opacity 240ms ease;">belum dibaca</span>
          </div>
          </div>
          <div aria-hidden="true" style="position:absolute;right:12%;bottom:16%;width:104px;transform-style:preserve-3d;transform:translateZ(-30px) rotateY(-14deg) rotateZ(-2.2deg);">
          <div data-note="3" style="position:relative;width:100%;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));border-radius:8px;background:linear-gradient(168deg, var(--k-raise,#161B23) 0%, var(--k-surface,#0B0E14) 100%);box-shadow:0 22px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06);padding:8px 10px;animation:klirDriftB 7.8s ease-in-out infinite reverse;;transition:opacity 240ms ease, filter 240ms ease">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));">
              <span style="display:flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:4px;background:var(--k-line-strong,rgba(255,255,255,0.16));color:var(--k-ink2,#8A93A3);font-size:7.5px;font-weight:700;flex-shrink:0;">S</span>
              <span style="font-size:9px;color:var(--k-ink3,#5C6474);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Stok</span>
            </div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ink,#F5F7FA);">3 menipis</div>
            <span data-stale="true" style="display:block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8.5px;color:var(--k-warn,#D8A33C);margin-top:5px;transition:opacity 240ms ease;">2 hari lalu</span>
          </div>
          </div>
          <div aria-hidden="true" style="position:absolute;left:40%;top:46%;width:96px;transform-style:preserve-3d;transform:translateZ(-8px) rotateY(-6deg) rotateZ(1.8deg);">
          <div data-note="4" style="position:relative;width:100%;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));border-radius:8px;background:linear-gradient(168deg, var(--k-raise,#161B23) 0%, var(--k-surface,#0B0E14) 100%);box-shadow:0 22px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06);padding:8px 10px;animation:klirDriftA 9s ease-in-out infinite reverse;;transition:opacity 240ms ease, filter 240ms ease">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));">
              <span style="display:flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:4px;background:var(--k-line-strong,rgba(255,255,255,0.16));color:var(--k-ink2,#8A93A3);font-size:7.5px;font-weight:700;flex-shrink:0;">J</span>
              <span style="font-size:9px;color:var(--k-ink3,#5C6474);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Jadwal</span>
            </div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ink,#F5F7FA);">1 kosong</div>
            <span data-stale="true" style="display:block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8.5px;color:var(--k-warn,#D8A33C);margin-top:5px;transition:opacity 240ms ease;">belum sinkron</span>
          </div>
          </div>
          <div data-mess="true" aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(58% 52% at 46% 46%, rgba(216,163,60,0.09) 0%, rgba(216,163,60,0) 72%);transition:opacity 300ms ease;"></div>
          <span data-conflict="true" style="position:absolute;left:33%;top:31%;z-index:2;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--k-warn,#D8A33C);border:1px solid rgba(216,163,60,0.42);border-radius:999px;background:#0B0E14;padding:3px 7px;white-space:nowrap;transition:opacity 260ms ease;">angka beda</span>
          <span data-conflict="true" style="position:absolute;left:47%;bottom:27%;z-index:2;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--k-warn,#D8A33C);border:1px solid rgba(216,163,60,0.42);border-radius:999px;background:#0B0E14;padding:3px 7px;white-space:nowrap;transition:opacity 260ms ease;">belum dicatat</span>
          <div style="position:absolute;left:50%;bottom:6%;transform:translateX(-50%);font-size:11.5px;color:var(--k-ink3,#5C6474);white-space:nowrap;">Angka disalin manual antar aplikasi</div>
        </div>

        <div data-cmp-after="true" style="position:relative;min-height:330px;padding:52px 22px 22px;display:flex;flex-direction:column;gap:12px;transition:background 500ms ease;">
          <span style="position:absolute;z-index:7;top:16px;right:18px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:#FFFFFF;border:1px solid transparent;background:var(--k-accent,#0058BE);padding:6px 12px;border-radius:999px;white-space:nowrap;">Sesudah KLIR</span>
          <div data-after-tabs="true" style="display:flex;align-items:center;gap:4px;margin-bottom:2px;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));">
            <span style="font-size:10.5px;font-weight:600;color:var(--k-ink,#F5F7FA);padding:6px 10px;border-bottom:1.5px solid var(--k-accent2,#4E9BFF);margin-bottom:-1px;">Ringkasan</span>
            <span style="font-size:10.5px;color:var(--k-ink3,#5C6474);padding:6px 10px;">Keuangan</span>
            <span style="font-size:10.5px;color:var(--k-ink3,#5C6474);padding:6px 10px;">Tim</span>
            <span style="margin-left:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--k-ink3,#5C6474);padding:6px 2px;">klir.id</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:12.5px;font-weight:600;">Ringkasan usaha</div>
            <div style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--k-ink3,#5C6474);"><span style="width:6px;height:6px;border-radius:50%;background:var(--k-ok,#3FBF8F);animation:klirBeat 2.6s ease-in-out infinite;"></span>Tersambung</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
            <div data-after-cell="true" style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:8px;padding:9px;transition:transform 420ms cubic-bezier(0.16,1,0.3,1), border-color 420ms ease, box-shadow 420ms ease;">
              <div style="font-size:9.5px;color:var(--k-ink3,#5C6474);">Kas masuk</div>
              <div data-prov="true" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8px;letter-spacing:0.06em;color:var(--k-accent2,#4E9BFF);margin-top:3px;opacity:0;transition:opacity 260ms ease;">&#8592; Pembukuan</div>
              <div data-after-val="true" style="font-family:'Outfit',sans-serif;font-size:14px;font-weight:600;margin-top:4px;opacity:0;transition:opacity 220ms ease;">Rp 4,8jt</div>
            </div>
            <div data-after-cell="true" style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:8px;padding:9px;transition:transform 420ms cubic-bezier(0.16,1,0.3,1), border-color 420ms ease, box-shadow 420ms ease;">
              <div style="font-size:9.5px;color:var(--k-ink3,#5C6474);">Tugas selesai</div>
              <div data-prov="true" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8px;letter-spacing:0.06em;color:var(--k-accent2,#4E9BFF);margin-top:3px;opacity:0;transition:opacity 260ms ease;">&#8592; Kelola tim</div>
              <div data-after-val="true" style="font-family:'Outfit',sans-serif;font-size:14px;font-weight:600;margin-top:4px;opacity:0;transition:opacity 220ms ease;">8/10</div>
            </div>
            <div data-after-cell="true" style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:8px;padding:9px;transition:transform 420ms cubic-bezier(0.16,1,0.3,1), border-color 420ms ease, box-shadow 420ms ease;">
              <div style="font-size:9.5px;color:var(--k-ink3,#5C6474);">Kepatuhan</div>
              <div data-prov="true" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8px;letter-spacing:0.06em;color:var(--k-accent2,#4E9BFF);margin-top:3px;opacity:0;transition:opacity 260ms ease;">&#8592; Aturan internal</div>
              <div data-after-val="true" style="font-family:'Outfit',sans-serif;font-size:14px;font-weight:600;margin-top:4px;opacity:0;transition:opacity 220ms ease;">9/10</div>
            </div>
          </div>
          <div style="border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:10px;padding:12px;flex:1;display:flex;flex-direction:column;">
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:10.5px;color:var(--k-ink3,#5C6474);margin-bottom:12px;"><span>Satu sumber angka</span><span style="color:var(--k-ok,#3FBF8F);">Selisih Rp 0</span></div>
            <div style="display:flex;align-items:flex-end;gap:6px;height:78px;padding-right:5px;">
              <div data-bar="34" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 700ms cubic-bezier(0.16,1,0.3,1);transition-delay:0ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-5px;height:5px;background:rgba(255,255,255,0.28);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-5px;width:5px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
              <div data-bar="48" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 700ms cubic-bezier(0.16,1,0.3,1);transition-delay:60ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-5px;height:5px;background:rgba(255,255,255,0.28);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-5px;width:5px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
              <div data-bar="41" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 700ms cubic-bezier(0.16,1,0.3,1);transition-delay:120ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-5px;height:5px;background:rgba(255,255,255,0.28);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-5px;width:5px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
              <div data-bar="62" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 700ms cubic-bezier(0.16,1,0.3,1);transition-delay:180ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-5px;height:5px;background:rgba(255,255,255,0.28);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-5px;width:5px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
              <div data-bar="57" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-line-strong,rgba(255,255,255,0.16));transition:height 700ms cubic-bezier(0.16,1,0.3,1);transition-delay:240ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-5px;height:5px;background:rgba(255,255,255,0.28);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-5px;width:5px;background:rgba(255,255,255,0.06);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
              <div data-bar="76" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-accent,#0058BE);transition:height 700ms cubic-bezier(0.16,1,0.3,1);transition-delay:300ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-5px;height:5px;background:rgba(120,180,255,0.95);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-5px;width:5px;background:rgba(0,40,90,0.92);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
              <div data-bar="88" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-accent,#0058BE);transition:height 700ms cubic-bezier(0.16,1,0.3,1);transition-delay:360ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-5px;height:5px;background:rgba(120,180,255,0.95);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-5px;width:5px;background:rgba(0,40,90,0.92);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
              <div data-bar="100" style="position:relative;flex:1;height:0%;border-radius:2px 2px 0 0;background:var(--k-accent,#0058BE);transition:height 700ms cubic-bezier(0.16,1,0.3,1);transition-delay:420ms;"><span aria-hidden="true" style="position:absolute;left:0;right:0;top:-5px;height:5px;background:rgba(120,180,255,0.95);transform:skewX(-45deg);transform-origin:0 100%;"></span><span aria-hidden="true" style="position:absolute;top:0;bottom:0;right:-5px;width:5px;background:rgba(0,40,90,0.92);transform:skewY(-45deg);transform-origin:0 0;"></span></div>
            
            </div>
          </div>
          <div data-seal="true" style="display:flex;align-items:center;gap:10px;border:1px solid rgba(201,166,107,0.32);border-radius:10px;background:linear-gradient(120deg, rgba(201,166,107,0.1) 0%, rgba(11,14,20,0) 62%);padding:9px 11px;opacity:0;transform:translateY(8px);transition:opacity 420ms ease, transform 420ms cubic-bezier(0.16,1,0.3,1);">
            <span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;border:1px solid rgba(201,166,107,0.5);flex-shrink:0;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--k-gold,#C9A66B)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11"></path></svg>
            </span>
            <span style="display:flex;flex-direction:column;gap:2px;">
              <span style="font-size:11px;font-weight:600;color:var(--k-ink,#F5F7FA);">Tercocokkan otomatis</span>
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;letter-spacing:0.08em;color:var(--k-ink3,#5C6474);">5 sumber &#183; selisih Rp 0</span>
            </span>
            <span style="margin-left:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8.5px;letter-spacing:0.16em;color:var(--k-gold,#C9A66B);">KLIR</span>
          </div>
          <div style="font-size:11.5px;color:var(--k-ink3,#5C6474);">Semua pilar membaca data yang sama</div>
        </div>
      </div>
    </div>
    </div>
    </div>
  </section>

  <section id="produk" data-sec="true" data-pad="true" style="position:relative;max-width:1180px;margin:88px auto 0;padding:0 28px;">
    <div data-feat-feed="true" aria-hidden="true" style="position:relative;height:58px;max-width:1124px;margin:0 auto;pointer-events:none;">
      <svg viewBox="0 0 1124 58" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;">
        <g fill="none" stroke="rgba(78,155,255,0.3)" stroke-width="1" stroke-linecap="round" stroke-dasharray="3 6" style="animation:klirDash 5.5s linear infinite;">
          <path d="M187 58 C187 30 562 32 562 0"></path>
          <path d="M562 58 L562 0"></path>
          <path d="M937 58 C937 30 562 32 562 0"></path>
        </g>
      </svg>
    </div>
    <div data-reveal="true" style="text-align:center;margin:0 auto 26px;max-width:660px;">
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);margin-bottom:11px;">Dijalankan AI KLIR</div>
      <div style="font-family:'Outfit',sans-serif;font-size:21px;font-weight:600;letter-spacing:-0.02em;line-height:1.35;color:var(--k-ink,#F5F7FA);text-wrap:pretty;">AI yang membaca usahamu sendiri, merapikan angkanya, dan menjawab dalam hitungan detik.</div>
    </div>
    <div aria-hidden="true" style="position:absolute;left:50%;transform:translateX(-50%);width:min(900px,90%);height:250px;margin-top:-26px;pointer-events:none;background:radial-gradient(closest-side, rgba(0,88,190,0.16), rgba(0,88,190,0) 74%);"></div>
    <div data-cols-3="true" style="position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--k-line,rgba(255,255,255,0.09));border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:14px;overflow:hidden;box-shadow:0 30px 68px var(--k-shadow,rgba(0,0,0,0.42));">
      <div data-reveal="true" data-feat="true" style="position:relative;overflow:hidden;background:linear-gradient(158deg, var(--k-glass,rgba(10,22,42,0.72)) 0%, var(--k-surface,#0B0E14) 64%);padding:32px 26px 30px;transition:background 180ms ease, box-shadow 320ms ease;" data-hover="background:linear-gradient(158deg, rgba(78,155,255,0.14) 0%, var(--k-surface,#0B0E14) 70%);">
        <span aria-hidden="true" data-feat-rail="true" style="position:absolute;top:0;left:0;right:0;height:2px;pointer-events:none;background:linear-gradient(90deg, rgba(78,155,255,0) 0%, rgba(78,155,255,0.62) 50%, rgba(78,155,255,0) 100%);"></span>
        <span aria-hidden="true" data-feat-sheen="true" style="position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.09)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 13s ease-in-out 0s infinite;"></span>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:17px;border:1px solid rgba(78,155,255,0.3);background:linear-gradient(150deg, rgba(78,155,255,0.2) 0%, rgba(78,155,255,0.03) 62%, rgba(201,166,107,0.07) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.12), 0 12px 26px rgba(0,88,190,0.24);">
            <span aria-hidden="true" style="position:absolute;inset:-14px;border-radius:50%;pointer-events:none;background:radial-gradient(closest-side, rgba(0,88,190,0.45), rgba(0,88,190,0) 72%);animation:klirBeat 4.6s ease-in-out infinite;"></span>
            <span aria-hidden="true" style="position:absolute;inset:5px;border-radius:12px;pointer-events:none;border:1px solid rgba(255,255,255,0.05);"></span>
            <canvas data-sigil="doc" width="88" height="88" aria-hidden="true" style="position:relative;width:46px;height:46px;"></canvas>
          </div>
          <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.16em;color:var(--k-ink3,#5C6474);border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:6px;background:var(--k-chip,rgba(6,8,12,0.72));padding:4px 9px;">01</span>
        </div>
        <h3 style="font-size:16px;font-weight:600;color:var(--k-ink,#F5F7FA);letter-spacing:-0.015em;margin:0 0 9px;">Dibangun menyatu</h3>
        <p style="font-size:14px;line-height:1.6;color:var(--k-ink2,#8A93A3);">Setiap pilar memakai basis data yang sama, jadi angka di pembukuan dan target di rencana tidak pernah berbeda.</p>
      </div>
      <div data-reveal="true" data-feat="true" style="position:relative;overflow:hidden;background:linear-gradient(158deg, var(--k-glass,rgba(10,22,42,0.72)) 0%, var(--k-surface,#0B0E14) 64%);padding:32px 26px 30px;transition:background 180ms ease, box-shadow 320ms ease;" data-hover="background:linear-gradient(158deg, rgba(78,155,255,0.14) 0%, var(--k-surface,#0B0E14) 70%);">
        <span aria-hidden="true" data-feat-rail="true" style="position:absolute;top:0;left:0;right:0;height:2px;pointer-events:none;background:linear-gradient(90deg, rgba(78,155,255,0) 0%, rgba(78,155,255,0.62) 50%, rgba(78,155,255,0) 100%);"></span>
        <span aria-hidden="true" data-feat-sheen="true" style="position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.09)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 13s ease-in-out -4.4s infinite;"></span>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:17px;border:1px solid rgba(78,155,255,0.3);background:linear-gradient(150deg, rgba(78,155,255,0.2) 0%, rgba(78,155,255,0.03) 62%, rgba(201,166,107,0.07) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.12), 0 12px 26px rgba(0,88,190,0.24);">
            <span aria-hidden="true" style="position:absolute;inset:-14px;border-radius:50%;pointer-events:none;background:radial-gradient(closest-side, rgba(0,88,190,0.45), rgba(0,88,190,0) 72%);animation:klirBeat 4.6s ease-in-out infinite;"></span>
            <span aria-hidden="true" style="position:absolute;inset:5px;border-radius:12px;pointer-events:none;border:1px solid rgba(255,255,255,0.05);"></span>
            <canvas data-sigil="ai" width="88" height="88" aria-hidden="true" style="position:relative;width:46px;height:46px;"></canvas>
          </div>
          <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.16em;color:var(--k-ink3,#5C6474);border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:6px;background:var(--k-chip,rgba(6,8,12,0.72));padding:4px 9px;">02</span>
        </div>
        <h3 style="font-size:16px;font-weight:600;color:var(--k-ink,#F5F7FA);letter-spacing:-0.015em;margin:0 0 9px;">AI yang paham konteks</h3>
        <p style="font-size:14px;line-height:1.6;color:var(--k-ink2,#8A93A3);">Saran KLIR dibaca dari transaksi, dokumen, dan riwayat usahamu sendiri, bukan template umum.</p>
      </div>
      <div data-reveal="true" data-feat="true" style="position:relative;overflow:hidden;background:linear-gradient(158deg, var(--k-glass,rgba(10,22,42,0.72)) 0%, var(--k-surface,#0B0E14) 64%);padding:32px 26px 30px;transition:background 180ms ease, box-shadow 320ms ease;" data-hover="background:linear-gradient(158deg, rgba(78,155,255,0.14) 0%, var(--k-surface,#0B0E14) 70%);">
        <span aria-hidden="true" data-feat-rail="true" style="position:absolute;top:0;left:0;right:0;height:2px;pointer-events:none;background:linear-gradient(90deg, rgba(78,155,255,0) 0%, rgba(78,155,255,0.62) 50%, rgba(78,155,255,0) 100%);"></span>
        <span aria-hidden="true" data-feat-sheen="true" style="position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.09)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 13s ease-in-out -8.8s infinite;"></span>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:17px;border:1px solid rgba(78,155,255,0.3);background:linear-gradient(150deg, rgba(78,155,255,0.2) 0%, rgba(78,155,255,0.03) 62%, rgba(201,166,107,0.07) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.12), 0 12px 26px rgba(0,88,190,0.24);">
            <span aria-hidden="true" style="position:absolute;inset:-14px;border-radius:50%;pointer-events:none;background:radial-gradient(closest-side, rgba(0,88,190,0.45), rgba(0,88,190,0) 72%);animation:klirBeat 4.6s ease-in-out infinite;"></span>
            <span aria-hidden="true" style="position:absolute;inset:5px;border-radius:12px;pointer-events:none;border:1px solid rgba(255,255,255,0.05);"></span>
            <canvas data-sigil="fast" width="88" height="88" aria-hidden="true" style="position:relative;width:46px;height:46px;"></canvas>
          </div>
          <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.16em;color:var(--k-ink3,#5C6474);border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:6px;background:var(--k-chip,rgba(6,8,12,0.72));padding:4px 9px;">03</span>
        </div>
        <h3 style="font-size:16px;font-weight:600;color:var(--k-ink,#F5F7FA);letter-spacing:-0.015em;margin:0 0 9px;">Dirancang untuk cepat</h3>
        <p style="font-size:14px;line-height:1.6;color:var(--k-ink2,#8A93A3);">Perintah keyboard, sinkronisasi instan, dan laporan yang siap sebelum kamu memintanya.</p>
      </div>
    </div>
  </section>

  <section id="rencana" data-sec="true" data-pad="true" style="max-width:1180px;margin:130px auto 0;padding:0 28px;">
    <div data-split="true" style="display:grid;grid-template-columns:1fr 1.1fr;gap:70px;align-items:center;">
      <div data-copy="true" data-reveal="true">
        <svg width="90" height="64" viewBox="0 0 90 64" aria-hidden="true" style="display:block;margin-bottom:6px;opacity:0.8;">
          <ellipse cx="45" cy="32" rx="42" ry="14" fill="none" stroke="rgba(201,166,107,0.4)" stroke-width="1"></ellipse>
          <ellipse cx="45" cy="32" rx="30" ry="20" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="1" opacity="0.5"></ellipse>
          <ellipse cx="45" cy="32" rx="18" ry="26" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="1" opacity="0.35"></ellipse>
          <circle cx="45" cy="6" r="3" fill="var(--k-accent2,#4E9BFF)"></circle>
        </svg>
        <div style="position:relative;display:inline-flex;align-items:center;gap:10px;margin-bottom:20px;border:1px solid rgba(78,155,255,0.24);border-radius:999px;background:var(--k-chip,rgba(6,8,12,0.72));padding:7px 14px 7px 11px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);">
          <span aria-hidden="true" style="width:6px;height:6px;border-radius:50%;background:var(--k-accent2,#4E9BFF);box-shadow:0 0 10px rgba(78,155,255,0.85);animation:klirBeat 3.2s ease-in-out infinite;"></span>
          <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.18em;color:var(--k-accent2,#4E9BFF);">01 / RENCANA</span>
        </div>
        <h2 data-sec-title="true" style="font-size:38px;line-height:1.1;letter-spacing:-0.03em;font-weight:600;color:var(--k-ink,#F5F7FA);margin:0 0 18px;">Dari ide jadi rencana yang bisa dijalankan</h2>
        <p style="font-size:16px;line-height:1.65;color:var(--k-ink2,#8A93A3);max-width:430px;margin-bottom:24px;">Susun model usaha, target, dan proyeksi arus kas dalam satu dokumen hidup. KLIR menandai asumsi yang belum punya dasar angka, dan setiap bagian punya penanggung jawab dari timmu.</p>
        <div style="max-width:430px;margin:0 0 26px;">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:10px;">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;color:var(--k-ink3,#5C6474);">Kesiapan rencana</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--k-accent2,#4E9BFF);white-space:nowrap;">2 dari 4 bagian siap</span>
          </div>
          <div style="position:relative;height:5px;border-radius:999px;background:var(--k-tint,rgba(255,255,255,0.06));overflow:hidden;">
            <span aria-hidden="true" style="position:absolute;left:0;top:0;bottom:0;width:50%;border-radius:999px;background:linear-gradient(90deg, var(--k-accent,#0058BE) 0%, #4E9BFF 100%);box-shadow:0 0 16px rgba(78,155,255,0.55);"></span>
            <span aria-hidden="true" style="position:absolute;left:50%;top:-3px;width:1px;height:11px;background:var(--k-line-strong,rgba(255,255,255,0.22));"></span>
          </div>
        </div>
        <a href="#rencana" style="font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:8px;" data-hover="color:var(--k-accent2,#4E9BFF);">Pelajari rencana bisnis <span>&#8594;</span></a>
      </div>
      <div data-visual="true" data-reveal="true" data-tilt-stage="true" style="position:relative;perspective:1600px;perspective-origin:62% 38%;">
        <span aria-hidden="true" style="position:absolute;left:34px;right:-20px;top:30px;bottom:-24px;border-radius:16px;border:1px solid var(--k-line,rgba(255,255,255,0.1));background:var(--k-ghost,rgba(20,34,60,0.92));box-shadow:inset 0 1px 0 rgba(255,255,255,0.07);transform:rotateY(-7deg) rotateX(2deg) translateZ(-90px);"></span>
        <span aria-hidden="true" style="position:absolute;left:18px;right:-10px;top:16px;bottom:-12px;border-radius:16px;border:1px solid var(--k-line-strong,rgba(255,255,255,0.18));background:var(--k-ghost2,rgba(29,47,80,0.96));box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);transform:rotateY(-7deg) rotateX(2deg) translateZ(-46px);"></span>
        <div data-tilt="true" data-tilt-base="rotateY(-6deg) rotateX(1.6deg)" data-hover="border-color:rgba(78,155,255,0.42)" style="position:relative;overflow:hidden;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:16px;background:linear-gradient(158deg, var(--k-glass,rgba(10,22,42,0.72)) 0%, var(--k-surface,#0B0E14) 58%, var(--k-glass,rgba(10,22,42,0.6)) 100%);box-shadow:0 34px 74px var(--k-shadow,rgba(0,0,0,0.5)), inset 0 1px 0 rgba(255,255,255,0.06);padding:18px;transform:rotateY(-6deg) rotateX(1.6deg);transform-style:preserve-3d;transition:transform 520ms cubic-bezier(0.16,1,0.3,1), border-color 340ms ease;">
        <span aria-hidden="true" style="position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.09)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 12s ease-in-out infinite;animation-delay:0s;"></span>
        <div style="position:relative;display:flex;align-items:center;justify-content:space-between;gap:14px;padding-bottom:14px;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));">
          <div style="font-size:13px;font-weight:600;">Rencana Bisnis &#183; Kedai Kopi Senja (contoh)</div>
          <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
            <svg width="26" height="26" viewBox="0 0 36 36" aria-hidden="true" style="display:block;">
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--k-line,rgba(255,255,255,0.09))" stroke-width="3"></circle>
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="3" stroke-linecap="round" stroke-dasharray="47.1 94.2" transform="rotate(-90 18 18)"></circle>
            </svg>
            <div style="font-size:11px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:3px 9px;border-radius:5px;white-space:nowrap;">Draf v3</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;">
          <div style="display:flex;align-items:center;gap:12px;padding:12px 2px;border-bottom:1px solid var(--k-line2,rgba(255,255,255,0.05));">
            <span style="width:6px;height:6px;border-radius:50%;background:var(--k-ok,#3FBF8F);flex-shrink:0;"></span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);width:22px;">01</span>
            <span style="font-size:13.5px;flex:1;">Ringkasan eksekutif</span>
            <span style="font-size:11px;color:var(--k-ink3,#5C6474);">Pemilik</span>
            <span style="font-size:11px;color:var(--k-ok,#3FBF8F);width:76px;text-align:right;">Lengkap</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:12px 2px;border-bottom:1px solid var(--k-line2,rgba(255,255,255,0.05));">
            <span style="width:6px;height:6px;border-radius:50%;background:var(--k-ok,#3FBF8F);flex-shrink:0;"></span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);width:22px;">02</span>
            <span style="font-size:13.5px;flex:1;">Analisis pasar</span>
            <span style="font-size:11px;color:var(--k-ink3,#5C6474);">Tim promosi</span>
            <span style="font-size:11px;color:var(--k-ok,#3FBF8F);width:76px;text-align:right;">Lengkap</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:12px 8px 12px 2px;margin:0 -6px;border-radius:8px;border-bottom:1px solid var(--k-line2,rgba(255,255,255,0.05));background:linear-gradient(90deg, rgba(216,163,60,0.09) 0%, rgba(216,163,60,0) 62%);">
            <span style="width:6px;height:6px;border-radius:50%;background:var(--k-warn,#D8A33C);flex-shrink:0;box-shadow:0 0 10px rgba(216,163,60,0.75);animation:klirBeat 2.6s ease-in-out infinite;"></span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);width:22px;">03</span>
            <span style="font-size:13.5px;flex:1;">Struktur biaya &amp; harga pokok</span>
            <span style="font-size:11px;color:var(--k-ink3,#5C6474);">Kasir</span>
            <span style="font-size:11px;color:var(--k-warn,#D8A33C);width:76px;text-align:right;">Perlu revisi</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:12px 2px;">
            <span style="width:6px;height:6px;border-radius:50%;border:1px solid var(--k-line-strong,rgba(255,255,255,0.22));flex-shrink:0;"></span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);width:22px;">04</span>
            <span style="font-size:13.5px;flex:1;color:var(--k-ink2,#8A93A3);">Proyeksi arus kas 12 bulan</span>
            <span style="font-size:11px;color:var(--k-ink3,#5C6474);">Belum ada</span>
            <span style="font-size:11px;color:var(--k-ink3,#5C6474);width:76px;text-align:right;">Kosong</span>
          </div>
        </div>
        <div style="margin-top:14px;display:flex;gap:11px;align-items:flex-start;border:1px solid var(--k-accent-line,rgba(78,155,255,0.28));background:var(--k-accent-bg,rgba(0,88,190,0.12));border-radius:10px;padding:12px 13px;">
          <span style="width:6px;height:6px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:5px;flex-shrink:0;"></span>
          <div style="font-size:12.5px;line-height:1.5;color:var(--k-ink,#F5F7FA);">Harga pokok masih memakai angka periode lalu. KLIR bisa memuat ulang dari pembukuan berjalan.</div>
        </div>
        </div>
      </div>
    </div>
  </section>

  <section id="keuangan" data-sec="true" data-pad="true" style="max-width:1180px;margin:130px auto 0;padding:0 28px;">
    <div data-split="true" style="display:grid;grid-template-columns:1.1fr 1fr;gap:70px;align-items:center;">
      <div data-visual="true" data-reveal="true" data-tilt-stage="true" style="position:relative;perspective:1600px;perspective-origin:38% 38%;">
        <span aria-hidden="true" style="position:absolute;left:-20px;right:34px;top:30px;bottom:-24px;border-radius:16px;border:1px solid var(--k-line,rgba(255,255,255,0.1));background:var(--k-ghost,rgba(20,34,60,0.92));box-shadow:inset 0 1px 0 rgba(255,255,255,0.07);transform:rotateY(7deg) rotateX(2deg) translateZ(-90px);"></span>
        <span aria-hidden="true" style="position:absolute;left:-10px;right:18px;top:16px;bottom:-12px;border-radius:16px;border:1px solid var(--k-line-strong,rgba(255,255,255,0.18));background:var(--k-ghost2,rgba(29,47,80,0.96));box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);transform:rotateY(7deg) rotateX(2deg) translateZ(-46px);"></span>
        <div data-tilt="true" data-tilt-base="rotateY(6deg) rotateX(1.6deg)" data-hover="border-color:rgba(78,155,255,0.42)" style="position:relative;overflow:hidden;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:16px;background:linear-gradient(158deg, var(--k-glass,rgba(10,22,42,0.72)) 0%, var(--k-surface,#0B0E14) 58%, var(--k-glass,rgba(10,22,42,0.6)) 100%);box-shadow:0 34px 74px var(--k-shadow,rgba(0,0,0,0.5)), inset 0 1px 0 rgba(255,255,255,0.06);padding:18px;transform:rotateY(6deg) rotateX(1.6deg);transform-style:preserve-3d;transition:transform 520ms cubic-bezier(0.16,1,0.3,1), border-color 340ms ease;">
        <span aria-hidden="true" style="position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.09)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 12s ease-in-out infinite;animation-delay:-3.5s;"></span>
        <div style="position:relative;display:flex;align-items:center;justify-content:space-between;gap:14px;padding-bottom:14px;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));">
          <div style="font-size:13px;font-weight:600;">Buku Besar &#183; periode berjalan</div>
          <div style="display:inline-flex;align-items:center;gap:7px;font-size:11px;color:var(--k-ok,#3FBF8F);border:1px solid rgba(63,191,143,0.34);background:rgba(63,191,143,0.1);padding:4px 10px;border-radius:999px;white-space:nowrap;flex-shrink:0;box-shadow:0 0 18px rgba(63,191,143,0.18);">
            <span aria-hidden="true" style="width:5px;height:5px;border-radius:50%;background:var(--k-ok,#3FBF8F);box-shadow:0 0 9px rgba(63,191,143,0.9);animation:klirBeat 2.8s ease-in-out infinite;"></span>Selisih Rp 0
          </div>
        </div>
        <div style="display:flex;flex-direction:column;">
          <div style="display:flex;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid var(--k-line2,rgba(255,255,255,0.05));">
            <span title="Kasir" style="width:6px;height:6px;border-radius:50%;background:var(--k-ok,#3FBF8F);flex-shrink:0;"></span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);width:38px;">14/08</span>
            <span style="font-size:13px;flex:1;">Penjualan kasir cabang</span>
            <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:2px 8px;border-radius:5px;">Pendapatan</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ok,#3FBF8F);width:88px;text-align:right;">+4.820.000</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid var(--k-line2,rgba(255,255,255,0.05));">
            <span title="Rekening" style="width:6px;height:6px;border-radius:50%;background:var(--k-ink3,#5C6474);flex-shrink:0;"></span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);width:38px;">13/08</span>
            <span style="font-size:13px;flex:1;">Pembelian bahan baku</span>
            <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:2px 8px;border-radius:5px;">HPP</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ink2,#8A93A3);width:88px;text-align:right;">-9.150.000</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid var(--k-line2,rgba(255,255,255,0.05));">
            <span title="Rekening" style="width:6px;height:6px;border-radius:50%;background:var(--k-ink3,#5C6474);flex-shrink:0;"></span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);width:38px;">12/08</span>
            <span style="font-size:13px;flex:1;">Gaji 4 pegawai paruh waktu</span>
            <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:2px 8px;border-radius:5px;">Operasional</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ink2,#8A93A3);width:88px;text-align:right;">-6.400.000</span>
          </div>
          <div data-row-new="true" style="display:flex;align-items:center;gap:12px;padding:11px 2px;opacity:0;transform:translateY(-6px);transition:opacity 500ms ease,transform 500ms ease;">
            <span title="Dompet digital" style="width:6px;height:6px;border-radius:50%;background:var(--k-ok,#3FBF8F);flex-shrink:0;box-shadow:0 0 10px rgba(63,191,143,0.7);"></span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);width:38px;">11/08</span>
            <span style="font-size:13px;flex:1;">Pelunasan tagihan pelanggan</span>
            <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:2px 8px;border-radius:5px;">Piutang</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--k-ok,#3FBF8F);width:88px;text-align:right;">+12.500.000</span>
          </div>
        </div>
        <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--k-line,rgba(255,255,255,0.09));padding-top:13px;">
          <div style="font-size:12px;color:var(--k-ink3,#5C6474);">Transaksi tercocokkan otomatis</div>
          <div style="font-size:12px;">Tutup buku &#8594;</div>
        </div>
        </div>
      </div>
      <div data-copy="true" data-reveal="true">
        <svg width="90" height="64" viewBox="0 0 90 64" aria-hidden="true" style="display:block;margin-bottom:6px;opacity:0.8;">
          <ellipse cx="45" cy="32" rx="42" ry="14" fill="none" stroke="rgba(201,166,107,0.4)" stroke-width="1"></ellipse>
          <ellipse cx="45" cy="32" rx="30" ry="20" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="1" opacity="0.5"></ellipse>
          <ellipse cx="45" cy="32" rx="18" ry="26" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="1" opacity="0.35"></ellipse>
          <circle cx="45" cy="6" r="3" fill="var(--k-accent2,#4E9BFF)"></circle>
        </svg>
        <div style="position:relative;display:inline-flex;align-items:center;gap:10px;margin-bottom:20px;border:1px solid rgba(78,155,255,0.24);border-radius:999px;background:var(--k-chip,rgba(6,8,12,0.72));padding:7px 14px 7px 11px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);">
          <span aria-hidden="true" style="width:6px;height:6px;border-radius:50%;background:var(--k-accent2,#4E9BFF);box-shadow:0 0 10px rgba(78,155,255,0.85);animation:klirBeat 3.2s ease-in-out infinite;"></span>
          <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.18em;color:var(--k-accent2,#4E9BFF);">02 / KEUANGAN</span>
        </div>
        <h2 data-sec-title="true" style="font-size:38px;line-height:1.1;letter-spacing:-0.03em;font-weight:600;color:var(--k-ink,#F5F7FA);margin:0 0 18px;">Pembukuan yang menutup dirinya sendiri</h2>
        <p style="font-size:16px;line-height:1.65;color:var(--k-ink2,#8A93A3);max-width:430px;margin-bottom:24px;">Transaksi masuk dari kasir, rekening, dan dompet digital langsung tercocokkan. Kasir mencatat, pemilik meninjau, dan laporan laba rugi siap tanpa entri ulang.</p>
        <div style="max-width:430px;margin:0 0 26px;">
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;color:var(--k-ink3,#5C6474);margin-bottom:12px;">Tiga sumber, satu buku</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
            <span style="display:flex;align-items:center;justify-content:center;gap:7px;font-size:12px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:8px;background:var(--k-chip,rgba(6,8,12,0.72));padding:7px 6px;white-space:nowrap;">
              <span aria-hidden="true" style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);box-shadow:0 0 9px rgba(78,155,255,0.8);animation:klirBeat 2.4s ease-in-out infinite;animation-delay:0s;flex-shrink:0;"></span>Kasir
            </span>
            <span style="display:flex;align-items:center;justify-content:center;gap:7px;font-size:12px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:8px;background:var(--k-chip,rgba(6,8,12,0.72));padding:7px 6px;white-space:nowrap;">
              <span aria-hidden="true" style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);box-shadow:0 0 9px rgba(78,155,255,0.8);animation:klirBeat 2.4s ease-in-out infinite;animation-delay:-0.8s;flex-shrink:0;"></span>Rekening
            </span>
            <span style="display:flex;align-items:center;justify-content:center;gap:7px;font-size:12px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:8px;background:var(--k-chip,rgba(6,8,12,0.72));padding:7px 6px;white-space:nowrap;">
              <span aria-hidden="true" style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);box-shadow:0 0 9px rgba(78,155,255,0.8);animation:klirBeat 2.4s ease-in-out infinite;animation-delay:-1.6s;flex-shrink:0;"></span>Dompet digital
            </span>
          </div>
          <svg viewBox="0 0 430 30" preserveAspectRatio="none" aria-hidden="true" style="display:block;width:100%;height:30px;">
            <path d="M69 0 C69 17 215 13 215 30" fill="none" stroke="var(--k-accent-line,rgba(78,155,255,0.28))" stroke-width="1"></path>
            <path d="M215 0 L215 30" fill="none" stroke="var(--k-accent-line,rgba(78,155,255,0.28))" stroke-width="1"></path>
            <path d="M361 0 C361 17 215 13 215 30" fill="none" stroke="var(--k-accent-line,rgba(78,155,255,0.28))" stroke-width="1"></path>
            <circle cx="215" cy="30" r="2.6" fill="var(--k-accent2,#4E9BFF)"></circle>
          </svg>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--k-accent-line,rgba(78,155,255,0.28));border-radius:10px;background:var(--k-accent-bg,rgba(0,88,190,0.12));padding:11px 13px;">
            <span style="font-size:12.5px;font-weight:600;color:var(--k-ink,#F5F7FA);">Buku besar</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--k-ok,#3FBF8F);white-space:nowrap;">Selisih 0</span>
          </div>
        </div>
        <a href="#keuangan" style="font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:8px;" data-hover="color:var(--k-accent2,#4E9BFF);">Pelajari keuangan <span>&#8594;</span></a>
      </div>
    </div>
  </section>

  <section id="promosi" data-sec="true" data-pad="true" style="max-width:1180px;margin:130px auto 0;padding:0 28px;">
    <div data-split="true" style="display:grid;grid-template-columns:1fr 1.1fr;gap:70px;align-items:center;">
      <div data-copy="true" data-reveal="true">
        <svg width="90" height="80" viewBox="0 0 90 80" aria-hidden="true" style="display:block;margin-bottom:6px;opacity:0.8;">
          <polygon points="45,6 78,24 78,56 45,74 12,56 12,24" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="1" opacity="0.45"></polygon>
          <line x1="12" y1="24" x2="45" y2="40" stroke="var(--k-line-strong,rgba(255,255,255,0.16))" stroke-width="1"></line>
          <line x1="78" y1="24" x2="45" y2="40" stroke="var(--k-line-strong,rgba(255,255,255,0.16))" stroke-width="1"></line>
          <line x1="12" y1="56" x2="45" y2="40" stroke="var(--k-line-strong,rgba(255,255,255,0.16))" stroke-width="1"></line>
          <circle cx="12" cy="24" r="2.5" fill="var(--k-accent2,#4E9BFF)"></circle>
          <circle cx="78" cy="24" r="2.5" fill="var(--k-accent2,#4E9BFF)"></circle>
          <circle cx="12" cy="56" r="2.5" fill="var(--k-accent2,#4E9BFF)"></circle>
          <circle cx="45" cy="40" r="2.5" fill="#C9A66B"></circle>
        </svg>
        <div style="position:relative;display:inline-flex;align-items:center;gap:10px;margin-bottom:20px;border:1px solid rgba(78,155,255,0.24);border-radius:999px;background:var(--k-chip,rgba(6,8,12,0.72));padding:7px 14px 7px 11px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);">
          <span aria-hidden="true" style="width:6px;height:6px;border-radius:50%;background:var(--k-accent2,#4E9BFF);box-shadow:0 0 10px rgba(78,155,255,0.85);animation:klirBeat 3.2s ease-in-out infinite;"></span>
          <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.18em;color:var(--k-accent2,#4E9BFF);">03 / PROMOSI</span>
        </div>
        <h2 data-sec-title="true" style="font-size:38px;line-height:1.1;letter-spacing:-0.03em;font-weight:600;color:var(--k-ink,#F5F7FA);margin:0 0 18px;">Promosi yang tahu siapa pelangganmu</h2>
        <p style="font-size:16px;line-height:1.65;color:var(--k-ink2,#8A93A3);max-width:430px;margin-bottom:24px;">KLIR membuatkan materi promosimu dari data penjualan nyata dan identitas usahamu sendiri, mulai dari naskah, poster, banner, sampai video iklan, semuanya bisa selesai dalam 10 sampai 30 menit. Anggota tim tinggal meninjau dan menekan jadwalkan ke kanal yang paling ramai.</p>
        <div style="max-width:430px;margin:0 0 26px;">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:13px;">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;color:var(--k-ink3,#5C6474);">Kanal paling ramai</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-ink3,#5C6474);white-space:nowrap;">30 hari terakhir</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:9px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:12px;color:var(--k-ink,#F5F7FA);width:74px;flex-shrink:0;">Instagram</span>
              <span style="position:relative;flex:1;height:6px;border-radius:999px;background:var(--k-tint,rgba(255,255,255,0.06));overflow:hidden;">
                <span aria-hidden="true" style="position:absolute;left:0;top:0;bottom:0;width:100%;border-radius:999px;background:linear-gradient(90deg, var(--k-accent,#0058BE) 0%, #4E9BFF 100%);box-shadow:0 0 14px rgba(78,155,255,0.5);"></span>
              </span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:12px;color:var(--k-ink3,#5C6474);width:74px;flex-shrink:0;">Facebook</span>
              <span style="position:relative;flex:1;height:6px;border-radius:999px;background:var(--k-tint,rgba(255,255,255,0.06));overflow:hidden;">
                <span aria-hidden="true" style="position:absolute;left:0;top:0;bottom:0;width:54%;border-radius:999px;background:var(--k-line-strong,rgba(255,255,255,0.22));"></span>
              </span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:12px;color:var(--k-ink3,#5C6474);width:74px;flex-shrink:0;">TikTok</span>
              <span style="position:relative;flex:1;height:6px;border-radius:999px;background:var(--k-tint,rgba(255,255,255,0.06));overflow:hidden;">
                <span aria-hidden="true" style="position:absolute;left:0;top:0;bottom:0;width:31%;border-radius:999px;background:var(--k-line-strong,rgba(255,255,255,0.22));"></span>
              </span>
            </div>
          </div>
        </div>
        <a href="#promosi" style="font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:8px;" data-hover="color:var(--k-accent2,#4E9BFF);">Pelajari promosi <span>&#8594;</span></a>
      </div>
      <div data-visual="true" data-reveal="true" data-tilt-stage="true" style="position:relative;perspective:1600px;perspective-origin:62% 38%;">
        <span aria-hidden="true" style="position:absolute;left:34px;right:-20px;top:30px;bottom:-24px;border-radius:16px;border:1px solid var(--k-line,rgba(255,255,255,0.1));background:var(--k-ghost,rgba(20,34,60,0.92));box-shadow:inset 0 1px 0 rgba(255,255,255,0.07);transform:rotateY(-7deg) rotateX(2deg) translateZ(-90px);"></span>
        <span aria-hidden="true" style="position:absolute;left:18px;right:-10px;top:16px;bottom:-12px;border-radius:16px;border:1px solid var(--k-line-strong,rgba(255,255,255,0.18));background:var(--k-ghost2,rgba(29,47,80,0.96));box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);transform:rotateY(-7deg) rotateX(2deg) translateZ(-46px);"></span>
        <div data-tilt="true" data-tilt-base="rotateY(-6deg) rotateX(1.6deg)" data-hover="border-color:rgba(78,155,255,0.42)" style="position:relative;overflow:hidden;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:16px;background:linear-gradient(158deg, var(--k-glass,rgba(10,22,42,0.72)) 0%, var(--k-surface,#0B0E14) 58%, var(--k-glass,rgba(10,22,42,0.6)) 100%);box-shadow:0 34px 74px var(--k-shadow,rgba(0,0,0,0.5)), inset 0 1px 0 rgba(255,255,255,0.06);padding:18px;transform:rotateY(-6deg) rotateX(1.6deg);transform-style:preserve-3d;transition:transform 520ms cubic-bezier(0.16,1,0.3,1), border-color 340ms ease;">
        <span aria-hidden="true" style="position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.09)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 12s ease-in-out infinite;animation-delay:-7s;"></span>
        <div style="position:relative;display:flex;gap:8px;margin-bottom:16px;">
          <div style="position:relative;font-size:11.5px;color:var(--k-ink,#F5F7FA);background:var(--k-accent-bg,rgba(0,88,190,0.18));border:1px solid var(--k-accent-line,rgba(78,155,255,0.35));padding:5px 11px;border-radius:6px;box-shadow:0 0 18px rgba(0,88,190,0.28);">Instagram
            <span aria-hidden="true" style="position:absolute;left:11px;right:11px;bottom:-1px;height:2px;border-radius:2px;background:var(--k-accent2,#4E9BFF);box-shadow:0 0 10px rgba(78,155,255,0.9);"></span>
          </div>
          <div style="font-size:11.5px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:5px 11px;border-radius:6px;">Facebook</div>
          <div style="font-size:11.5px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:5px 11px;border-radius:6px;">TikTok</div>
        </div>
        <div style="position:relative;font-size:11px;line-height:1.5;color:var(--k-ink3,#5C6474);margin:-4px 0 13px;">Bisa dibuat: naskah, poster, banner, sampai video iklan, sesuai logo dan identitas usahamu.</div>
        <div style="position:relative;overflow:hidden;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:12px;background:var(--k-tint,rgba(255,255,255,0.025));padding:15px 15px 15px 18px;margin-bottom:12px;">
          <span aria-hidden="true" style="position:absolute;left:0;top:0;bottom:0;width:2px;background:linear-gradient(180deg, var(--k-accent2,#4E9BFF) 0%, rgba(78,155,255,0) 100%);"></span>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;">
            <div style="font-size:11px;color:var(--k-ink3,#5C6474);">Draf naskah</div>
            <div style="font-size:10px;color:var(--k-accent2,#4E9BFF);border:1px solid var(--k-accent-line,rgba(78,155,255,0.28));background:var(--k-accent-bg,rgba(0,88,190,0.12));padding:2px 8px;border-radius:5px;white-space:nowrap;">Segmen: pembeli tetap Jumat sore</div>
          </div>
          <div style="font-size:13.5px;line-height:1.6;">Produk terlaris kami paling ramai tiap Jumat sore. Minggu ini beli dua gratis satu, khusus pukul 15.00&#8211;18.00.</div>
        </div>
        <div data-cols-3="true" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
          <div style="position:relative;overflow:hidden;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:9px;background:linear-gradient(160deg, var(--k-fill,rgba(255,255,255,0.045)) 0%, var(--k-fill2,rgba(255,255,255,0.012)) 100%);padding:12px 11px 11px;">
            <span aria-hidden="true" style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg, rgba(78,155,255,0) 0%, rgba(78,155,255,0.55) 50%, rgba(78,155,255,0) 100%);opacity:0.9;"></span>
            <div style="font-size:10.5px;color:var(--k-ink3,#5C6474);">Jangkauan perkiraan</div>
            <div style="font-family:'Outfit',sans-serif;font-size:16px;font-weight:600;margin-top:5px;letter-spacing:-0.02em;"><span data-countup="4100">0</span></div>
          </div>
          <div style="position:relative;overflow:hidden;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:9px;background:linear-gradient(160deg, var(--k-fill,rgba(255,255,255,0.045)) 0%, var(--k-fill2,rgba(255,255,255,0.012)) 100%);padding:12px 11px 11px;">
            <span aria-hidden="true" style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg, rgba(78,155,255,0) 0%, rgba(78,155,255,0.55) 50%, rgba(78,155,255,0) 100%);opacity:0.62;"></span>
            <div style="font-size:10.5px;color:var(--k-ink3,#5C6474);">Jam terbaik</div>
            <div style="font-family:'Outfit',sans-serif;font-size:16px;font-weight:600;margin-top:5px;letter-spacing:-0.02em;">14.30</div>
          </div>
          <div style="position:relative;overflow:hidden;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:9px;background:linear-gradient(160deg, var(--k-fill,rgba(255,255,255,0.045)) 0%, var(--k-fill2,rgba(255,255,255,0.012)) 100%);padding:12px 11px 11px;">
            <span aria-hidden="true" style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg, rgba(78,155,255,0) 0%, rgba(78,155,255,0.55) 50%, rgba(78,155,255,0) 100%);opacity:0.4;"></span>
            <div style="font-size:10.5px;color:var(--k-ink3,#5C6474);">Biaya iklan</div>
            <div style="font-family:'Outfit',sans-serif;font-size:16px;font-weight:600;margin-top:5px;letter-spacing:-0.02em;">Rp 150rb</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="font-size:11.5px;color:var(--k-ink3,#5C6474);">Disusun dari transaksi 30 hari terakhir</div>
          <div style="font-size:12px;font-weight:600;color:#FFFFFF;background:linear-gradient(180deg,#0F6FE0,var(--k-accent,#0058BE));padding:9px 16px;border-radius:8px;white-space:nowrap;box-shadow:0 10px 24px rgba(0,88,190,0.38), inset 0 1px 0 rgba(255,255,255,0.18);">Jadwalkan</div>
        </div>
        </div>
      </div>
    </div>
  </section>

  <section id="tim" data-sec="true" data-pad="true" style="max-width:1180px;margin:130px auto 0;padding:0 28px;">
    <div data-split="true" style="display:grid;grid-template-columns:1.1fr 1fr;gap:70px;align-items:center;">
      <div data-visual="true" data-reveal="true" data-tilt-stage="true" style="position:relative;perspective:1600px;perspective-origin:38% 38%;">
        <span aria-hidden="true" style="position:absolute;left:-20px;right:34px;top:30px;bottom:-24px;border-radius:16px;border:1px solid var(--k-line,rgba(255,255,255,0.1));background:var(--k-ghost,rgba(20,34,60,0.92));box-shadow:inset 0 1px 0 rgba(255,255,255,0.07);transform:rotateY(7deg) rotateX(2deg) translateZ(-90px);"></span>
        <span aria-hidden="true" style="position:absolute;left:-10px;right:18px;top:16px;bottom:-12px;border-radius:16px;border:1px solid var(--k-line-strong,rgba(255,255,255,0.18));background:var(--k-ghost2,rgba(29,47,80,0.96));box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);transform:rotateY(7deg) rotateX(2deg) translateZ(-46px);"></span>
        <div data-tilt="true" data-tilt-base="rotateY(6deg) rotateX(1.6deg)" data-hover="border-color:rgba(78,155,255,0.42)" style="position:relative;overflow:hidden;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:16px;background:linear-gradient(158deg, var(--k-glass,rgba(10,22,42,0.72)) 0%, var(--k-surface,#0B0E14) 58%, var(--k-glass,rgba(10,22,42,0.6)) 100%);box-shadow:0 34px 74px var(--k-shadow,rgba(0,0,0,0.5)), inset 0 1px 0 rgba(255,255,255,0.06);padding:18px;transform:rotateY(6deg) rotateX(1.6deg);transform-style:preserve-3d;transition:transform 520ms cubic-bezier(0.16,1,0.3,1), border-color 340ms ease;">
        <span aria-hidden="true" style="position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.09)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 12s ease-in-out infinite;animation-delay:-9s;"></span>
        <div style="position:relative;display:flex;align-items:center;justify-content:space-between;gap:14px;padding-bottom:14px;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));">
          <div style="font-size:13px;font-weight:600;">Tugas tim &#183; minggu ini</div>
          <div style="display:inline-flex;align-items:center;gap:7px;font-size:11px;color:var(--k-warn,#D8A33C);border:1px solid rgba(216,163,60,0.34);background:rgba(216,163,60,0.1);padding:4px 10px;border-radius:999px;white-space:nowrap;flex-shrink:0;box-shadow:0 0 18px rgba(216,163,60,0.16);">
            <span aria-hidden="true" style="width:5px;height:5px;border-radius:50%;background:var(--k-warn,#D8A33C);box-shadow:0 0 9px rgba(216,163,60,0.9);animation:klirBeat 2.6s ease-in-out infinite;"></span>2 tugas terlambat
          </div>
        </div>
        <div style="display:flex;flex-direction:column;">
          <div style="display:flex;align-items:center;gap:12px;padding:12px 2px;border-bottom:1px solid var(--k-line2,rgba(255,255,255,0.05));">
            <div style="position:relative;width:27px;height:27px;border-radius:50%;background:linear-gradient(180deg,#0F6FE0,var(--k-accent,#0058BE));color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;flex-shrink:0;box-shadow:0 0 16px rgba(0,88,190,0.55), inset 0 1px 0 rgba(255,255,255,0.22);">01
              <span aria-hidden="true" style="position:absolute;inset:-3px;border-radius:50%;border:1px solid rgba(78,155,255,0.34);animation:klirHalo 4.2s ease-in-out infinite;"></span>
            </div>
            <div style="flex:1;"><div style="font-size:13px;">Andi Pratama (contoh)</div><div style="font-size:11px;color:var(--k-ink3,#5C6474);margin-top:2px;">Penanggung jawab operasional</div></div>
            <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:2px 8px;border-radius:5px;white-space:nowrap;flex-shrink:0;">Selesai</span>
            <span style="font-size:11px;color:var(--k-ink3,#5C6474);text-align:right;white-space:nowrap;flex-shrink:0;">Tenggat Jumat</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:12px 2px;border-bottom:1px solid var(--k-line2,rgba(255,255,255,0.05));">
            <div style="width:27px;height:27px;border-radius:50%;background:var(--k-raise,#20252E);display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;flex-shrink:0;">02</div>
            <div style="flex:1;"><div style="font-size:13px;">Bunga Lestari (contoh)</div><div style="font-size:11px;color:var(--k-ink3,#5C6474);margin-top:2px;">Kasir &amp; stok</div></div>
            <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:2px 8px;border-radius:5px;white-space:nowrap;flex-shrink:0;">Berjalan</span>
            <span style="font-size:11px;color:var(--k-ink3,#5C6474);text-align:right;white-space:nowrap;flex-shrink:0;">Tenggat Senin depan</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:12px 2px;border-bottom:1px solid var(--k-line2,rgba(255,255,255,0.05));">
            <div style="width:27px;height:27px;border-radius:50%;background:var(--k-raise,#20252E);display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;flex-shrink:0;">03</div>
            <div style="flex:1;"><div style="font-size:13px;">Citra Dewi (contoh)</div><div style="font-size:11px;color:var(--k-ink3,#5C6474);margin-top:2px;">Media sosial</div></div>
            <span style="font-size:10.5px;color:var(--k-warn,#D8A33C);border:1px solid rgba(216,163,60,0.34);background:rgba(216,163,60,0.1);padding:2px 8px;border-radius:5px;white-space:nowrap;flex-shrink:0;">Telat 2 hari</span>
            <span style="font-size:11px;color:var(--k-ink3,#5C6474);text-align:right;white-space:nowrap;flex-shrink:0;">Tenggat sudah lewat</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:12px 2px;border-bottom:1px solid var(--k-line2,rgba(255,255,255,0.05));">
            <div style="width:27px;height:27px;border-radius:50%;background:var(--k-raise,#20252E);display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;flex-shrink:0;">04</div>
            <div style="flex:1;"><div style="font-size:13px;">Damar Aji (contoh)</div><div style="font-size:11px;color:var(--k-ink3,#5C6474);margin-top:2px;">Teknisi cabang kedua</div></div>
            <span style="font-size:10.5px;color:var(--k-ink2,#8A93A3);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:2px 8px;border-radius:5px;white-space:nowrap;flex-shrink:0;">Berjalan</span>
            <span style="font-size:11px;color:var(--k-ink3,#5C6474);text-align:right;white-space:nowrap;flex-shrink:0;">Tenggat Rabu</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:12px 8px 12px 2px;margin:2px -6px 0;border-radius:9px;background:linear-gradient(90deg, rgba(216,163,60,0.1) 0%, rgba(216,163,60,0) 66%);">
            <div style="width:27px;height:27px;border-radius:50%;border:1px dashed rgba(216,163,60,0.55);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--k-warn,#D8A33C);flex-shrink:0;">+</div>
            <div style="flex:1;font-size:13px;color:var(--k-ink2,#8A93A3);">2 tugas melewati tenggat minggu ini</div>
            <span style="font-size:11px;font-weight:600;color:var(--k-accent2,#4E9BFF);border:1px solid var(--k-accent-line,rgba(78,155,255,0.28));background:var(--k-accent-bg,rgba(0,88,190,0.12));padding:4px 10px;border-radius:6px;white-space:nowrap;">Lihat detail</span>
          </div>
        </div>
        <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--k-line,rgba(255,255,255,0.09));padding-top:13px;">
          <div style="font-size:12px;color:var(--k-ink3,#5C6474);">Tugas terlambat &#8594; otomatis masuk catatan kinerja ke pemilik usaha</div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13.5px;font-weight:600;color:var(--k-ink,#F5F7FA);border:1px solid var(--k-accent-line,rgba(78,155,255,0.28));background:var(--k-accent-bg,rgba(0,88,190,0.12));padding:5px 11px;border-radius:7px;white-space:nowrap;">2 dari 18 tugas</div>
        </div>
        </div>
      </div>
      <div data-copy="true" data-reveal="true">
        <svg width="90" height="80" viewBox="0 0 90 80" aria-hidden="true" style="display:block;margin-bottom:6px;opacity:0.8;">
          <polygon points="45,6 78,24 78,56 45,74 12,56 12,24" fill="none" stroke="var(--k-accent2,#4E9BFF)" stroke-width="1" opacity="0.45"></polygon>
          <line x1="12" y1="24" x2="45" y2="40" stroke="var(--k-line-strong,rgba(255,255,255,0.16))" stroke-width="1"></line>
          <line x1="78" y1="24" x2="45" y2="40" stroke="var(--k-line-strong,rgba(255,255,255,0.16))" stroke-width="1"></line>
          <line x1="12" y1="56" x2="45" y2="40" stroke="var(--k-line-strong,rgba(255,255,255,0.16))" stroke-width="1"></line>
          <circle cx="12" cy="24" r="2.5" fill="var(--k-accent2,#4E9BFF)"></circle>
          <circle cx="78" cy="24" r="2.5" fill="var(--k-accent2,#4E9BFF)"></circle>
          <circle cx="12" cy="56" r="2.5" fill="var(--k-accent2,#4E9BFF)"></circle>
          <circle cx="45" cy="40" r="2.5" fill="#C9A66B"></circle>
        </svg>
        <div style="position:relative;display:inline-flex;align-items:center;gap:10px;margin-bottom:20px;border:1px solid rgba(78,155,255,0.24);border-radius:999px;background:var(--k-chip,rgba(6,8,12,0.72));padding:7px 14px 7px 11px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);">
          <span aria-hidden="true" style="width:6px;height:6px;border-radius:50%;background:var(--k-accent2,#4E9BFF);box-shadow:0 0 10px rgba(78,155,255,0.85);animation:klirBeat 3.2s ease-in-out infinite;"></span>
          <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.18em;color:var(--k-accent2,#4E9BFF);">04 / TIM</span>
        </div>
        <h2 data-sec-title="true" style="font-size:38px;line-height:1.1;letter-spacing:-0.03em;font-weight:600;color:var(--k-ink,#F5F7FA);margin:0 0 18px;">Tugas, tenggat, dan tanggung jawab di satu papan</h2>
        <p style="font-size:16px;line-height:1.65;color:var(--k-ink2,#8A93A3);max-width:430px;margin-bottom:24px;">Beri tugas berdeadline ke anggota tim. Begitu ada yang telat, KLIR otomatis mencatatnya sebagai penurunan kinerja dan melaporkannya ke pemilik usaha, tanpa perlu tanya manual satu-satu.</p>
        <div style="max-width:430px;margin:0 0 26px;">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:12px;">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;color:var(--k-ink3,#5C6474);">Tingkat penyelesaian tugas</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--k-warn,#D8A33C);white-space:nowrap;">5 dari 7 hari tugas selesai tepat waktu</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:7px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.08em;color:var(--k-ink3,#5C6474);">SEN</span>
              <span aria-hidden="true" style="width:100%;height:26px;border-radius:6px;background:linear-gradient(180deg, rgba(78,155,255,0.42) 0%, rgba(0,88,190,0.5) 100%);border:1px solid var(--k-accent-line,rgba(78,155,255,0.28));"></span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.08em;color:var(--k-ink3,#5C6474);">SEL</span>
              <span aria-hidden="true" style="width:100%;height:26px;border-radius:6px;background:linear-gradient(180deg, rgba(78,155,255,0.42) 0%, rgba(0,88,190,0.5) 100%);border:1px solid var(--k-accent-line,rgba(78,155,255,0.28));"></span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.08em;color:var(--k-ink3,#5C6474);">RAB</span>
              <span aria-hidden="true" style="width:100%;height:26px;border-radius:6px;background:linear-gradient(180deg, rgba(78,155,255,0.42) 0%, rgba(0,88,190,0.5) 100%);border:1px solid var(--k-accent-line,rgba(78,155,255,0.28));"></span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.08em;color:var(--k-ink3,#5C6474);">KAM</span>
              <span aria-hidden="true" style="width:100%;height:26px;border-radius:6px;background:linear-gradient(180deg, rgba(78,155,255,0.42) 0%, rgba(0,88,190,0.5) 100%);border:1px solid var(--k-accent-line,rgba(78,155,255,0.28));"></span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.08em;color:var(--k-ink3,#5C6474);">JUM</span>
              <span aria-hidden="true" style="width:100%;height:26px;border-radius:6px;background:linear-gradient(180deg, rgba(78,155,255,0.42) 0%, rgba(0,88,190,0.5) 100%);border:1px solid var(--k-accent-line,rgba(78,155,255,0.28));"></span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.08em;color:var(--k-warn,#D8A33C);">SAB</span>
              <span aria-hidden="true" style="width:100%;height:26px;border-radius:6px;background:transparent;border:1px dashed rgba(216,163,60,0.55);box-shadow:0 0 14px rgba(216,163,60,0.22);"></span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:7px;">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.08em;color:var(--k-warn,#D8A33C);">MIN</span>
              <span aria-hidden="true" style="width:100%;height:26px;border-radius:6px;background:transparent;border:1px dashed rgba(216,163,60,0.55);box-shadow:0 0 14px rgba(216,163,60,0.22);"></span>
            </div>
          </div>
        </div>
        <a href="#tim" style="font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:8px;" data-hover="color:var(--k-accent2,#4E9BFF);">Pelajari kelola tim <span>&#8594;</span></a>
      </div>
    </div>
  </section>


  <section data-sec="true" data-pad="true" style="position:relative;max-width:1180px;margin:130px auto 0;padding:0 28px;text-align:center;">
    <div style="position:relative;z-index:1;">
    <div data-reveal="true" style="position:relative;">
      <span aria-hidden="true" style="position:absolute;left:50%;bottom:-26px;transform:translateX(-50%);width:min(520px,80%);height:90px;pointer-events:none;border-radius:50%;background:radial-gradient(closest-side, rgba(0,88,190,0.3), rgba(0,88,190,0) 76%);"></span>
      <span aria-hidden="true" style="position:absolute;left:50%;bottom:6px;transform:translateX(-50%);width:min(340px,62%);height:1px;pointer-events:none;background:linear-gradient(90deg, rgba(78,155,255,0) 0%, rgba(78,155,255,0.4) 50%, rgba(78,155,255,0) 100%);"></span>
      <div aria-hidden="true" style="position:absolute;left:50%;top:-28px;transform:translateX(-50%);width:min(760px,96%);height:calc(100% + 56px);pointer-events:none;background:radial-gradient(54% 44% at 50% 54%, var(--k-scrim-mid,rgba(6,8,12,0.6)) 0%, var(--k-scrim0,rgba(6,8,12,0)) 78%);"></div>
      <div style="position:relative;display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:22px;">
        <span aria-hidden="true" style="height:1px;width:min(140px,18%);background:linear-gradient(90deg, rgba(78,155,255,0) 0%, var(--k-accent-line,rgba(78,155,255,0.28)) 100%);"></span>
        <span style="display:inline-flex;align-items:center;gap:9px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);white-space:nowrap;">
          <span aria-hidden="true" style="width:6px;height:6px;border-radius:50%;background:var(--k-accent2,#4E9BFF);box-shadow:0 0 11px rgba(78,155,255,0.95);animation:klirBeat 2.6s ease-in-out infinite;"></span>
          Dipakai di seluruh Indonesia
        </span>
        <span aria-hidden="true" style="height:1px;width:min(140px,18%);background:linear-gradient(90deg, var(--k-accent-line,rgba(78,155,255,0.28)) 0%, rgba(78,155,255,0) 100%);"></span>
      </div>
      <div data-stat="true" style="position:relative;margin:0 auto;font-family:'Outfit',sans-serif;font-size:54px;font-weight:600;color:var(--k-ink,#F5F7FA);letter-spacing:-0.035em;line-height:1.05;border:1px solid rgba(78,155,255,0.26);border-radius:16px;display:inline-block;padding:20px 38px;white-space:nowrap;background:linear-gradient(158deg, var(--k-glass,rgba(10,24,46,0.86)) 0%, var(--k-glass2,rgba(6,8,12,0.78)) 62%, var(--k-glass,rgba(10,24,46,0.8)) 100%);box-shadow:0 24px 60px var(--k-shadow,rgba(0,0,0,0.5)), 0 0 70px rgba(0,88,190,0.34), inset 0 1px 0 rgba(255,255,255,0.06);overflow:hidden;">
        <span aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 40%, var(--k-sheen,rgba(120,180,255,0.12)) 49%, rgba(255,255,255,0) 58%);animation:klirSheen 7s ease-in-out infinite;"></span>
        <span aria-hidden="true" style="position:absolute;width:14px;height:14px;top:9px;left:9px;border-top:1px solid rgba(201,166,107,0.55);border-left:1px solid rgba(201,166,107,0.55);border-radius:4px 0 0 0;"></span>
        <span aria-hidden="true" style="position:absolute;width:14px;height:14px;bottom:9px;right:9px;border-bottom:1px solid rgba(201,166,107,0.55);border-right:1px solid rgba(201,166,107,0.55);border-radius:0 0 4px 0;"></span>
        <span style="position:relative;"><span data-countup="10400">0</span><span style="color:var(--k-accent2,#4E9BFF);">+</span></span>
      </div>
      <div style="position:relative;display:flex;justify-content:center;margin-top:20px;">
        <span style="display:inline-flex;align-items:center;gap:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--k-ink3,#5C6474);border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:999px;background:var(--k-chip,rgba(6,8,12,0.82));padding:6px 13px;">
          <span aria-hidden="true" style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);animation:klirBeat 3s ease-in-out infinite;"></span>
          Satuan ilustrasi
        </span>
      </div>
      <p style="position:relative;font-size:15px;color:var(--k-ink2,#8A93A3);margin:20px auto 0;max-width:460px;line-height:1.6;text-wrap:pretty;">Jumlah usaha aktif dan sebaran wilayah. Isi setelah angka final tersedia, jangan pakai perkiraan.</p>
    </div>
    <div data-cols-5="true" data-reveal="true" style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:64px;padding-top:48px;border-top:1px solid var(--k-line,rgba(255,255,255,0.09));">
      <div data-logo-tile="true" style="position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:64px;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:11px;padding:18px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:0.1em;color:var(--k-ink3,#5C6474);background:linear-gradient(160deg, var(--k-fill,rgba(255,255,255,0.045)) 0%, var(--k-fill2,rgba(255,255,255,0.012)) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.09), 0 10px 24px var(--k-shadow,rgba(0,0,0,0.32));transition:transform 320ms cubic-bezier(0.16,1,0.3,1), border-color 320ms ease, box-shadow 320ms ease;" data-hover="transform:translateY(-4px);border-color:rgba(78,155,255,0.3)">
        <span aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.1)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 9s ease-in-out infinite;animation-delay:-0.0s;"></span>
        <span aria-hidden="true" style="position:absolute;inset:6px;border-radius:8px;pointer-events:none;border:1px solid rgba(255,255,255,0.035);"></span>
        <span style="position:relative;">Logo klien (contoh)</span>
      </div>
      <div data-logo-tile="true" style="position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:64px;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:11px;padding:18px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:0.1em;color:var(--k-ink3,#5C6474);background:linear-gradient(160deg, var(--k-fill,rgba(255,255,255,0.045)) 0%, var(--k-fill2,rgba(255,255,255,0.012)) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.09), 0 10px 24px var(--k-shadow,rgba(0,0,0,0.32));transition:transform 320ms cubic-bezier(0.16,1,0.3,1), border-color 320ms ease, box-shadow 320ms ease;" data-hover="transform:translateY(-4px);border-color:rgba(78,155,255,0.3)">
        <span aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.1)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 9s ease-in-out infinite;animation-delay:-1.3s;"></span>
        <span aria-hidden="true" style="position:absolute;inset:6px;border-radius:8px;pointer-events:none;border:1px solid rgba(255,255,255,0.035);"></span>
        <span style="position:relative;">Logo klien (contoh)</span>
      </div>
      <div data-logo-tile="true" style="position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:64px;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:11px;padding:18px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:0.1em;color:var(--k-ink3,#5C6474);background:linear-gradient(160deg, var(--k-fill,rgba(255,255,255,0.045)) 0%, var(--k-fill2,rgba(255,255,255,0.012)) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.09), 0 10px 24px var(--k-shadow,rgba(0,0,0,0.32));transition:transform 320ms cubic-bezier(0.16,1,0.3,1), border-color 320ms ease, box-shadow 320ms ease;" data-hover="transform:translateY(-4px);border-color:rgba(78,155,255,0.3)">
        <span aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.1)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 9s ease-in-out infinite;animation-delay:-2.6s;"></span>
        <span aria-hidden="true" style="position:absolute;inset:6px;border-radius:8px;pointer-events:none;border:1px solid rgba(255,255,255,0.035);"></span>
        <span style="position:relative;">Logo klien (contoh)</span>
      </div>
      <div data-logo-tile="true" style="position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:64px;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:11px;padding:18px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:0.1em;color:var(--k-ink3,#5C6474);background:linear-gradient(160deg, var(--k-fill,rgba(255,255,255,0.045)) 0%, var(--k-fill2,rgba(255,255,255,0.012)) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.09), 0 10px 24px var(--k-shadow,rgba(0,0,0,0.32));transition:transform 320ms cubic-bezier(0.16,1,0.3,1), border-color 320ms ease, box-shadow 320ms ease;" data-hover="transform:translateY(-4px);border-color:rgba(78,155,255,0.3)">
        <span aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.1)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 9s ease-in-out infinite;animation-delay:-3.9s;"></span>
        <span aria-hidden="true" style="position:absolute;inset:6px;border-radius:8px;pointer-events:none;border:1px solid rgba(255,255,255,0.035);"></span>
        <span style="position:relative;">Logo klien (contoh)</span>
      </div>
      <div data-logo-tile="true" style="position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:64px;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:11px;padding:18px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:0.1em;color:var(--k-ink3,#5C6474);background:linear-gradient(160deg, var(--k-fill,rgba(255,255,255,0.045)) 0%, var(--k-fill2,rgba(255,255,255,0.012)) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.09), 0 10px 24px var(--k-shadow,rgba(0,0,0,0.32));transition:transform 320ms cubic-bezier(0.16,1,0.3,1), border-color 320ms ease, box-shadow 320ms ease;" data-hover="transform:translateY(-4px);border-color:rgba(78,155,255,0.3)">
        <span aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.1)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 9s ease-in-out infinite;animation-delay:-5.2s;"></span>
        <span aria-hidden="true" style="position:absolute;inset:6px;border-radius:8px;pointer-events:none;border:1px solid rgba(255,255,255,0.035);"></span>
        <span style="position:relative;">Logo klien (contoh)</span>
      </div>
    </div>
    </div>
  </section>

  <section id="cerita" data-sec="true" data-pad="true" style="max-width:1180px;margin:130px auto 0;padding:0 28px;">
    <div data-split="true" style="display:grid;grid-template-columns:1fr 1.05fr;gap:56px;align-items:center;">
      <div data-visual="true" data-reveal="true" data-tilt-stage="true" style="position:relative;perspective:1600px;perspective-origin:38% 38%;">
        <span aria-hidden="true" style="position:absolute;left:-20px;right:34px;top:28px;bottom:-22px;border-radius:16px;border:1px solid var(--k-line,rgba(255,255,255,0.1));background:var(--k-ghost,rgba(20,34,60,0.92));box-shadow:inset 0 1px 0 rgba(255,255,255,0.07);transform:rotateY(7deg) rotateX(2deg) translateZ(-90px);"></span>
        <span aria-hidden="true" style="position:absolute;left:-10px;right:18px;top:15px;bottom:-11px;border-radius:16px;border:1px solid var(--k-line-strong,rgba(255,255,255,0.18));background:var(--k-ghost2,rgba(29,47,80,0.96));box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);transform:rotateY(7deg) rotateX(2deg) translateZ(-46px);"></span>
        <div data-tilt="true" data-tilt-base="rotateY(6deg) rotateX(1.6deg)" data-hover="border-color:rgba(78,155,255,0.42)" style="position:relative;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:16px;overflow:hidden;background:linear-gradient(158deg, var(--k-glass,rgba(10,22,42,0.72)) 0%, var(--k-surface,#0B0E14) 58%, var(--k-glass,rgba(10,22,42,0.6)) 100%);box-shadow:0 34px 74px var(--k-shadow,rgba(0,0,0,0.5)), inset 0 1px 0 rgba(255,255,255,0.06);transform:rotateY(6deg) rotateX(1.6deg);transform-style:preserve-3d;transition:transform 520ms cubic-bezier(0.16,1,0.3,1), border-color 340ms ease;">
        <span aria-hidden="true" style="position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.09)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 12s ease-in-out -5.5s infinite;"></span>
        <div style="padding:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--k-ink,#F5F7FA);">Tugas hari ini &#183; Kedai Kopi Senja (contoh)</div>
              <div style="display:flex;align-items:center;gap:7px;font-size:11px;color:var(--k-ink3,#5C6474);margin-top:4px;"><span style="width:6px;height:6px;border-radius:50%;background:var(--k-ok,#3FBF8F);animation:klirBeat 2.6s ease-in-out infinite;"></span>Papan tugas berjalan</div>
            </div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--k-ink3,#5C6474);border:1px dashed var(--k-line-strong,rgba(255,255,255,0.16));border-radius:6px;padding:4px 9px;white-space:nowrap;flex-shrink:0;">Data contoh</div>
          </div>
          <div data-shift-list="true" style="display:flex;flex-direction:column;">
            <div data-shift="true" style="display:flex;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid var(--k-line2,rgba(255,255,255,0.05));">
              <span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;border:1px solid var(--k-line,rgba(255,255,255,0.09));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--k-ink2,#8A93A3);flex-shrink:0;">01</span>
              <div style="flex:1;"><div style="font-size:13px;color:var(--k-ink,#F5F7FA);">Penanggung jawab operasional</div><div style="font-size:11px;color:var(--k-ink3,#5C6474);margin-top:2px;">Tenggat hari ini &#183; 17.00</div></div>
              <span data-shift-chip="true" style="font-size:10.5px;color:var(--k-ink3,#5C6474);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:3px 9px;border-radius:999px;white-space:nowrap;">Menunggu</span>
            </div>
            <div data-shift="true" style="display:flex;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid var(--k-line2,rgba(255,255,255,0.05));">
              <span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;border:1px solid var(--k-line,rgba(255,255,255,0.09));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--k-ink2,#8A93A3);flex-shrink:0;">02</span>
              <div style="flex:1;"><div style="font-size:13px;color:var(--k-ink,#F5F7FA);">Kasir &amp; stok</div><div style="font-size:11px;color:var(--k-ink3,#5C6474);margin-top:2px;">Tenggat hari ini &#183; 12.00</div></div>
              <span data-shift-chip="true" style="font-size:10.5px;color:var(--k-ink3,#5C6474);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:3px 9px;border-radius:999px;white-space:nowrap;">Menunggu</span>
            </div>
            <div data-shift="true" style="display:flex;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid var(--k-line2,rgba(255,255,255,0.05));">
              <span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;border:1px solid var(--k-line,rgba(255,255,255,0.09));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--k-ink2,#8A93A3);flex-shrink:0;">03</span>
              <div style="flex:1;"><div style="font-size:13px;color:var(--k-ink,#F5F7FA);">Teknisi cabang kedua</div><div style="font-size:11px;color:var(--k-ink3,#5C6474);margin-top:2px;">Tenggat besok &#183; 10.00</div></div>
              <span data-shift-chip="true" style="font-size:10.5px;color:var(--k-ink3,#5C6474);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:3px 9px;border-radius:999px;white-space:nowrap;">Menunggu</span>
            </div>
            <div data-shift="true" style="display:flex;align-items:center;gap:12px;padding:11px 2px;">
              <span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;border:1px solid var(--k-line,rgba(255,255,255,0.09));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--k-ink2,#8A93A3);flex-shrink:0;">04</span>
              <div style="flex:1;"><div style="font-size:13px;color:var(--k-ink,#F5F7FA);">Media sosial</div><div style="font-size:11px;color:var(--k-ink3,#5C6474);margin-top:2px;">Tenggat Jumat &#183; 15.00</div></div>
              <span data-shift-chip="true" style="font-size:10.5px;color:var(--k-ink3,#5C6474);border:1px solid var(--k-line,rgba(255,255,255,0.09));padding:3px 9px;border-radius:999px;white-space:nowrap;">Menunggu</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid var(--k-line,rgba(255,255,255,0.09));">
            <div style="font-size:11.5px;color:var(--k-ink3,#5C6474);">Tugas selesai otomatis masuk catatan kinerja</div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--k-accent2,#4E9BFF);white-space:nowrap;"><span data-shift-count="true">0</span>/4 tugas selesai</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:11px;">
            <span data-shift-seg="true" aria-hidden="true" style="height:4px;border-radius:999px;background:var(--k-tint,rgba(255,255,255,0.06));transition:background 300ms ease, box-shadow 300ms ease;"></span>
            <span data-shift-seg="true" aria-hidden="true" style="height:4px;border-radius:999px;background:var(--k-tint,rgba(255,255,255,0.06));transition:background 300ms ease, box-shadow 300ms ease;"></span>
            <span data-shift-seg="true" aria-hidden="true" style="height:4px;border-radius:999px;background:var(--k-tint,rgba(255,255,255,0.06));transition:background 300ms ease, box-shadow 300ms ease;"></span>
            <span data-shift-seg="true" aria-hidden="true" style="height:4px;border-radius:999px;background:var(--k-tint,rgba(255,255,255,0.06));transition:background 300ms ease, box-shadow 300ms ease;"></span>
          </div>
        </div>
        <div style="position:relative;padding:14px 16px;border-top:1px solid var(--k-line,rgba(255,255,255,0.09));font-size:12px;color:var(--k-ink3,#5C6474);">Ilustrasi: Kedai Kopi Senja, Bandung, tim 6 orang</div>
        </div>
      </div>
      <div data-copy="true" data-reveal="true">
        <div style="position:relative;overflow:hidden;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:16px;background:linear-gradient(158deg, var(--k-glass,rgba(10,24,46,0.72)) 0%, var(--k-glass2,rgba(6,8,12,0.86)) 58%, var(--k-glass,rgba(10,24,46,0.66)) 100%);box-shadow:0 26px 62px var(--k-shadow,rgba(0,0,0,0.46)), inset 0 1px 0 rgba(255,255,255,0.05);padding:26px 26px 24px;margin-bottom:26px;">
          <span aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.09)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 11s ease-in-out infinite;"></span>
          <span aria-hidden="true" style="position:absolute;top:12px;right:18px;font-family:'Outfit',sans-serif;font-size:64px;line-height:1;color:rgba(201,166,107,0.16);pointer-events:none;">&#8221;</span>
          <span aria-hidden="true" style="position:absolute;width:16px;height:16px;top:11px;left:11px;border-top:1px solid rgba(78,155,255,0.34);border-left:1px solid rgba(78,155,255,0.34);border-radius:5px 0 0 0;"></span>
          <span aria-hidden="true" style="position:absolute;width:16px;height:16px;bottom:11px;right:11px;border-bottom:1px solid rgba(201,166,107,0.4);border-right:1px solid rgba(201,166,107,0.4);border-radius:0 0 5px 0;"></span>
          <div style="position:relative;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);margin-bottom:16px;">Cerita pengguna</div>
          <p style="position:relative;font-size:21px;line-height:1.55;letter-spacing:-0.015em;color:var(--k-ink,#F5F7FA);margin-bottom:22px;text-wrap:pretty;">&#8220;Contoh ilustrasi &#8212; kutipan pemilik usaha akan tampil di sini setelah sesi wawancara pelanggan.&#8221;</p>
          <div style="position:relative;display:flex;align-items:center;gap:14px;padding-top:18px;border-top:1px solid var(--k-line,rgba(255,255,255,0.09));">
            <div data-avatar="true" style="position:relative;display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;border:1px solid rgba(78,155,255,0.32);background:radial-gradient(closest-side, rgba(0,88,190,0.34), var(--k-glass2,rgba(6,8,12,0.9)) 78%);box-shadow:0 0 22px rgba(0,88,190,0.28);flex-shrink:0;overflow:hidden;">
              <span aria-hidden="true" style="position:absolute;inset:-4px;border-radius:50%;border:1px solid rgba(78,155,255,0.16);animation:klirHalo 4.2s ease-in-out infinite;"></span>
            </div>
            <div>
              <div style="font-size:13.5px;font-weight:600;color:var(--k-ink,#F5F7FA);">Sinta (contoh)</div>
              <div style="font-size:12px;color:var(--k-ink3,#5C6474);margin-top:3px;">Pemilik usaha (contoh) &#183; bengkel dengan 5 anggota tim</div>
            </div>
          </div>
        </div>
        <div data-cols-3="true" style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--k-line,rgba(255,255,255,0.09));border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:12px;overflow:hidden;">
          <div data-hover="transform:translateY(-3px);background:var(--k-glass,rgba(10,24,46,0.9))" style="position:relative;overflow:hidden;background:linear-gradient(158deg, var(--k-glass,rgba(10,22,42,0.6)) 0%, var(--k-surface,#0B0E14) 66%);padding:20px 16px 18px;transition:transform 320ms cubic-bezier(0.16,1,0.3,1), background 320ms ease;">
            <span aria-hidden="true" style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg, rgba(78,155,255,0) 0%, rgba(78,155,255,0.55) 50%, rgba(78,155,255,0) 100%);opacity:0.90;"></span>
            <div data-stat="true" style="font-family:'Outfit',sans-serif;font-size:30px;font-weight:600;color:var(--k-ink,#F5F7FA);letter-spacing:-0.03em;line-height:1;"><span data-countup="6">0</span><span style="color:var(--k-accent2,#4E9BFF);"> jam</span></div>
            <div style="font-size:12px;color:var(--k-ink2,#8A93A3);margin-top:8px;line-height:1.45;">Hemat waktu rekap tiap minggu</div>
          </div>
          <div data-hover="transform:translateY(-3px);background:var(--k-glass,rgba(10,24,46,0.9))" style="position:relative;overflow:hidden;background:linear-gradient(158deg, var(--k-glass,rgba(10,22,42,0.6)) 0%, var(--k-surface,#0B0E14) 66%);padding:20px 16px 18px;transition:transform 320ms cubic-bezier(0.16,1,0.3,1), background 320ms ease;">
            <span aria-hidden="true" style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg, rgba(78,155,255,0) 0%, rgba(78,155,255,0.55) 50%, rgba(78,155,255,0) 100%);opacity:0.68;"></span>
            <div data-stat="true" style="font-family:'Outfit',sans-serif;font-size:30px;font-weight:600;color:var(--k-ink,#F5F7FA);letter-spacing:-0.03em;line-height:1;"><span data-countup="4">0</span><span style="color:var(--k-accent2,#4E9BFF);"> aplikasi</span></div>
            <div style="font-size:12px;color:var(--k-ink2,#8A93A3);margin-top:8px;line-height:1.45;">Langganan terpisah yang dihentikan</div>
          </div>
          <div data-hover="transform:translateY(-3px);background:var(--k-glass,rgba(10,24,46,0.9))" style="position:relative;overflow:hidden;background:linear-gradient(158deg, var(--k-glass,rgba(10,22,42,0.6)) 0%, var(--k-surface,#0B0E14) 66%);padding:20px 16px 18px;transition:transform 320ms cubic-bezier(0.16,1,0.3,1), background 320ms ease;">
            <span aria-hidden="true" style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg, rgba(78,155,255,0) 0%, rgba(78,155,255,0.55) 50%, rgba(78,155,255,0) 100%);opacity:0.46;"></span>
            <div data-stat="true" style="font-family:'Outfit',sans-serif;font-size:30px;font-weight:600;color:var(--k-ink,#F5F7FA);letter-spacing:-0.03em;line-height:1;"><span data-countup="5">0</span><span style="color:var(--k-accent2,#4E9BFF);"> orang</span></div>
            <div style="font-size:12px;color:var(--k-ink2,#8A93A3);margin-top:8px;line-height:1.45;">Anggota tim memakai sistem yang sama</div>
          </div>
        </div>
        <p style="font-size:11.5px;color:var(--k-ink3,#5C6474);margin-top:12px;">Angka contoh untuk tata letak. Ganti dengan hasil pelanggan yang sudah dikonfirmasi.</p>
      </div>
    </div>
  </section>

  <section id="changelog" data-sec="true" data-pad="true" style="max-width:1180px;margin:130px auto 0;padding:0 28px;">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:26px;">
      <div>
        <h2 data-sec-title="true" style="font-size:30px;line-height:1.12;letter-spacing:-0.03em;font-weight:600;color:var(--k-ink,#F5F7FA);margin:0 0 8px;">Yang baru di KLIR</h2>
        <p style="font-size:14px;color:var(--k-ink2,#8A93A3);">Ringkasan pembaruan terbaru, terbaru di atas.</p>
      </div>
      <a href="#semua-catatan" style="font-size:13.5px;color:var(--k-ink2,#8A93A3);white-space:nowrap;" data-hover="color:var(--k-ink,#F5F7FA);">Semua catatan rilis &#8594;</a>
    </div>
    <div style="position:relative;border-top:1px solid var(--k-line,rgba(255,255,255,0.09));">
      <span aria-hidden="true" style="position:absolute;left:110px;top:0;bottom:0;width:1px;background:linear-gradient(180deg, rgba(78,155,255,0.55) 0%, rgba(78,155,255,0.14) 62%, rgba(78,155,255,0) 100%);pointer-events:none;"></span>
      <span aria-hidden="true" style="position:absolute;left:98px;top:-7px;width:25px;height:14px;pointer-events:none;border-radius:50%;background:radial-gradient(closest-side, rgba(78,155,255,0.5), rgba(78,155,255,0) 74%);"></span>
      <span aria-hidden="true" style="position:absolute;left:0;right:0;top:0;height:1px;pointer-events:none;background:linear-gradient(90deg, rgba(78,155,255,0) 0%, rgba(78,155,255,0.4) 12%, rgba(78,155,255,0.08) 46%, rgba(78,155,255,0) 100%);"></span>
      <div data-hover="background:linear-gradient(90deg, rgba(78,155,255,0.1) 0%, rgba(78,155,255,0.02) 62%, rgba(78,155,255,0) 100%);border-color:rgba(78,155,255,0.24)" style="position:relative;display:flex;align-items:baseline;gap:24px;padding:22px 16px 22px 0;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:0 12px 12px 0;background:linear-gradient(90deg, rgba(78,155,255,0.035) 0%, rgba(78,155,255,0) 58%);transition:background 260ms ease, border-color 260ms ease;">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;letter-spacing:0.06em;color:var(--k-ink3,#5C6474);width:96px;flex-shrink:0;">24 Agustus 2026</div>
        <span aria-hidden="true" style="position:absolute;left:105px;top:26px;width:11px;height:11px;border-radius:50%;background:var(--k-accent2,#4E9BFF);box-shadow:0 0 0 3px var(--k-bg,#06080C), 0 0 20px rgba(78,155,255,0.95);animation:klirBeat 2.6s ease-in-out infinite;"></span>
        <span aria-hidden="true" style="position:absolute;left:99px;top:20px;width:23px;height:23px;border-radius:50%;pointer-events:none;border:1px solid rgba(78,155,255,0.45);animation:klirHalo 3.8s ease-in-out infinite;"></span>
        <div style="flex:1;padding-left:22px;">
          <div style="font-size:15px;font-weight:600;letter-spacing:-0.01em;margin-bottom:5px;color:var(--k-ink,#F5F7FA);">Rincian pembaruan akan tampil di sini</div>
          <div style="font-size:13.5px;line-height:1.55;color:var(--k-ink2,#8A93A3);">Detail lengkap menyusul begitu fiturnya rilis</div>
        </div>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);white-space:nowrap;border:1px solid rgba(78,155,255,0.26);border-radius:999px;background:rgba(0,88,190,0.1);padding:5px 10px;">Keuangan</div>
      </div>
      <div data-hover="background:linear-gradient(90deg, rgba(78,155,255,0.1) 0%, rgba(78,155,255,0.02) 62%, rgba(78,155,255,0) 100%);border-color:rgba(78,155,255,0.24)" style="position:relative;display:flex;align-items:baseline;gap:24px;padding:22px 16px 22px 0;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:0 12px 12px 0;background:linear-gradient(90deg, rgba(78,155,255,0.035) 0%, rgba(78,155,255,0) 58%);transition:background 260ms ease, border-color 260ms ease;">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;letter-spacing:0.06em;color:var(--k-ink3,#5C6474);width:96px;flex-shrink:0;">24 Agustus 2026</div>
        <span aria-hidden="true" style="position:absolute;left:107px;top:28px;width:7px;height:7px;border-radius:50%;background:var(--k-accent2,#4E9BFF);box-shadow:0 0 0 3px var(--k-bg,#06080C), 0 0 14px rgba(78,155,255,0.55);animation:klirBeat 3.7s ease-in-out infinite;"></span>
        <div style="flex:1;padding-left:22px;">
          <div style="font-size:15px;font-weight:600;letter-spacing:-0.01em;margin-bottom:5px;color:var(--k-ink,#F5F7FA);">Rincian pembaruan akan tampil di sini</div>
          <div style="font-size:13.5px;line-height:1.55;color:var(--k-ink2,#8A93A3);">Detail lengkap menyusul begitu fiturnya rilis</div>
        </div>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);white-space:nowrap;border:1px solid rgba(78,155,255,0.26);border-radius:999px;background:rgba(0,88,190,0.1);padding:5px 10px;">Promosi</div>
      </div>
      <div data-hover="background:linear-gradient(90deg, rgba(78,155,255,0.1) 0%, rgba(78,155,255,0.02) 62%, rgba(78,155,255,0) 100%);border-color:rgba(78,155,255,0.24)" style="position:relative;display:flex;align-items:baseline;gap:24px;padding:22px 16px 22px 0;border-bottom:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:0 12px 12px 0;background:linear-gradient(90deg, rgba(78,155,255,0.035) 0%, rgba(78,155,255,0) 58%);transition:background 260ms ease, border-color 260ms ease;">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;letter-spacing:0.06em;color:var(--k-ink3,#5C6474);width:96px;flex-shrink:0;">24 Agustus 2026</div>
        <span aria-hidden="true" style="position:absolute;left:107px;top:28px;width:7px;height:7px;border-radius:50%;background:var(--k-accent2,#4E9BFF);box-shadow:0 0 0 3px var(--k-bg,#06080C), 0 0 14px rgba(78,155,255,0.55);animation:klirBeat 4.2s ease-in-out infinite;"></span>
        <div style="flex:1;padding-left:22px;">
          <div style="font-size:15px;font-weight:600;letter-spacing:-0.01em;margin-bottom:5px;color:var(--k-ink,#F5F7FA);">Rincian pembaruan akan tampil di sini</div>
          <div style="font-size:13.5px;line-height:1.55;color:var(--k-ink2,#8A93A3);">Detail lengkap menyusul begitu fiturnya rilis</div>
        </div>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);white-space:nowrap;border:1px solid rgba(78,155,255,0.26);border-radius:999px;background:rgba(0,88,190,0.1);padding:5px 10px;">Platform</div>
      </div>
    </div>
  </section>

  <section id="harga" data-sec="true" data-pad="true" style="position:relative;max-width:1180px;margin:130px auto 0;padding:0 28px;">
    <div style="position:relative;z-index:1;">
    <div data-reveal="true" style="display:flex;align-items:flex-end;justify-content:space-between;gap:32px;flex-wrap:wrap;margin-bottom:36px;">
      <div style="max-width:560px;">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);margin-bottom:16px;">Harga</div>
        <h2 data-sec-title="true" style="font-size:34px;line-height:1.12;letter-spacing:-0.03em;font-weight:600;color:var(--k-ink,#F5F7FA);margin:0 0 14px;">Pilih paket sesuai ritme usahamu</h2>
        <p style="font-size:15px;line-height:1.6;color:var(--k-ink2,#8A93A3);">Satu langganan untuk seluruh tim dan seluruh pilar. Bisa dibayar mingguan atau bulanan.</p>
      </div>
      <div style="display:inline-flex;padding:4px;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:10px;gap:4px;">
        <button data-siklus="minggu" style="font-family:inherit;font-size:13px;font-weight:600;padding:9px 18px;border-radius:7px;border:none;background:transparent;color:var(--k-ink2,#8A93A3);cursor:pointer;">Per minggu</button>
        <button data-siklus="bulan" style="font-family:inherit;font-size:13px;font-weight:600;padding:9px 18px;border-radius:7px;border:none;background:var(--k-accent,#0058BE);color:#FFFFFF;cursor:pointer;">Per bulan</button>
      </div>
    </div>

    <div data-cols-3="true" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;align-items:stretch;">

      <div data-plan="starter" style="container-type:inline-size;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:14px;padding:28px 26px;background:var(--k-surface,#0B0E14);display:flex;flex-direction:column;">
        <div data-plan-head="true" style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:36px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:12px;flex:0 0 auto;">
            <canvas data-price-cell="starter" width="228" height="228" aria-hidden="true" style="width:46px;height:46px;flex:0 0 46px;pointer-events:none;"></canvas>
            <div style="font-family:'Outfit',sans-serif;font-size:19px;font-weight:600;letter-spacing:-0.02em;color:var(--k-ink,#F5F7FA);">Starter</div>
          </div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);flex:1 1 auto;min-width:0;text-align:right;line-height:1.3;">&nbsp;</div>
        </div>
        <p style="font-size:13.5px;line-height:1.55;color:var(--k-ink2,#8A93A3);margin-bottom:24px;min-height:42px;">Untuk usaha kecil yang timnya sudah bekerja tiap hari.</p>
        <div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px;">
          <div data-price-value="true" data-price-minggu="Rp 29.000" data-price-bulan="Rp 99.000" style="font-family:'Outfit',sans-serif;font-size:34px;font-weight:600;letter-spacing:-0.03em;line-height:1;color:var(--k-ink,#F5F7FA);white-space:nowrap;">Rp 99.000</div>
          <div data-price-satuan="true" data-satuan-minggu="per minggu" data-satuan-bulan="per bulan" style="font-size:13px;color:var(--k-ink3,#5C6474);">per bulan</div>
        </div>
        <div data-price-note="true" data-note-minggu="Atau Rp 99.000 per bulan, dengan bonus kredit tambahan." data-note-bulan="Termasuk bonus kredit tambahan untuk pembayaran bulanan." style="font-size:12.5px;line-height:1.5;color:var(--k-accent2,#4E9BFF);margin-top:10px;min-height:36px;">Termasuk bonus kredit tambahan untuk pembayaran bulanan.</div>
        <div style="height:1px;background:var(--k-line,rgba(255,255,255,0.09));margin:22px 0;"></div>
        <div style="display:flex;flex-direction:column;gap:12px;flex:1;">
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Enam pilar operasi aktif</div></div>
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Sampai 5 anggota tim</div></div>
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Kredit KLIR mingguan</div></div>
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Ekspor laporan dasar</div></div>
        </div>
        <a data-cta="tidak" data-open-auth="register" href="#daftar" style="display:inline-flex;align-items:center;justify-content:center;gap:9px;margin-top:28px;font-size:15px;font-weight:600;padding:13px 24px;border-radius:10px;white-space:nowrap;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));color:var(--k-ink,#F5F7FA);background:transparent;transition:transform 180ms ease,filter 180ms ease;" data-hover="transform:translateY(-2px);filter:brightness(1.08);">Mulai Starter</a>
      </div>

      <div data-plan="business" style="container-type:inline-size;border:1px solid var(--k-accent-line,rgba(78,155,255,0.35));border-radius:14px;padding:28px 26px;background:var(--k-surface,#0B0E14);display:flex;flex-direction:column;">
        <div data-plan-head="true" style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:36px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:12px;flex:0 0 auto;">
            <canvas data-price-cell="business" width="228" height="228" aria-hidden="true" style="width:46px;height:46px;flex:0 0 46px;pointer-events:none;"></canvas>
            <div style="font-family:'Outfit',sans-serif;font-size:19px;font-weight:600;letter-spacing:-0.02em;color:var(--k-ink,#F5F7FA);">Business</div>
          </div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);flex:1 1 auto;min-width:0;text-align:right;line-height:1.3;">Paling banyak dipilih</div>
        </div>
        <p style="font-size:13.5px;line-height:1.55;color:var(--k-ink2,#8A93A3);margin-bottom:24px;min-height:42px;">Untuk tim yang bekerja dalam beberapa shift atau cabang.</p>
        <div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px;">
          <div data-price-value="true" data-price-minggu="Rp 99.000" data-price-bulan="Rp 349.000" style="font-family:'Outfit',sans-serif;font-size:34px;font-weight:600;letter-spacing:-0.03em;line-height:1;color:var(--k-ink,#F5F7FA);white-space:nowrap;">Rp 349.000</div>
          <div data-price-satuan="true" data-satuan-minggu="per minggu" data-satuan-bulan="per bulan" style="font-size:13px;color:var(--k-ink3,#5C6474);">per bulan</div>
        </div>
        <div data-price-note="true" data-note-minggu="Atau Rp 349.000 per bulan, lebih hemat dari empat kali bayar mingguan." data-note-bulan="Lebih hemat dibanding empat kali pembayaran mingguan." style="font-size:12.5px;line-height:1.5;color:var(--k-accent2,#4E9BFF);margin-top:10px;min-height:36px;">Lebih hemat dibanding empat kali pembayaran mingguan.</div>
        <div style="height:1px;background:var(--k-line,rgba(255,255,255,0.09));margin:22px 0;"></div>
        <div style="display:flex;flex-direction:column;gap:12px;flex:1;">
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Semua fitur Starter</div></div>
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Anggota tim tanpa batas</div></div>
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Kredit KLIR lebih besar</div></div>
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Banyak cabang &amp; peran akses</div></div>
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Dukungan prioritas</div></div>
        </div>
        <a data-cta="ya" data-open-auth="register" href="#daftar" style="display:inline-flex;align-items:center;justify-content:center;gap:9px;margin-top:28px;font-size:15px;font-weight:600;padding:13px 24px;border-radius:10px;white-space:nowrap;border:1px solid transparent;color:#FFFFFF;background:linear-gradient(180deg,#0F6FE0,var(--k-accent,#0058BE));box-shadow:0 8px 20px rgba(0,88,190,0.28);transition:transform 180ms ease,filter 180ms ease;" data-hover="transform:translateY(-2px);filter:brightness(1.08);">Mulai Business</a>
      </div>

      <div data-plan="enterprise" style="container-type:inline-size;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:14px;padding:28px 26px;background:var(--k-surface,#0B0E14);display:flex;flex-direction:column;">
        <div data-plan-head="true" style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:36px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:12px;flex:0 0 auto;">
            <canvas data-price-cell="enterprise" width="228" height="228" aria-hidden="true" style="width:46px;height:46px;flex:0 0 46px;pointer-events:none;"></canvas>
            <div style="font-family:'Outfit',sans-serif;font-size:19px;font-weight:600;letter-spacing:-0.02em;color:var(--k-ink,#F5F7FA);">Enterprise</div>
          </div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);flex:1 1 auto;min-width:0;text-align:right;line-height:1.3;">&nbsp;</div>
        </div>
        <p style="font-size:13.5px;line-height:1.55;color:var(--k-ink2,#8A93A3);margin-bottom:24px;min-height:42px;">Untuk kebutuhan Private yang disesuaikan langsung.</p>
        <div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px;">
          <div data-price-value="true" data-price-minggu="Hubungi kami" data-price-bulan="Hubungi kami" style="font-family:'Outfit',sans-serif;font-size:34px;font-weight:600;letter-spacing:-0.03em;line-height:1;color:var(--k-ink,#F5F7FA);white-space:nowrap;">Hubungi kami</div>
          <div data-price-satuan="true" data-satuan-minggu="" data-satuan-bulan="" style="font-size:13px;color:var(--k-ink3,#5C6474);"></div>
        </div>
        <div data-price-note="true" data-note-minggu="Skema kredit dan kontrak disusun bersama tim kami." data-note-bulan="Skema kredit dan kontrak disusun bersama tim kami." style="font-size:12.5px;line-height:1.5;color:var(--k-accent2,#4E9BFF);margin-top:10px;min-height:36px;">Skema kredit dan kontrak disusun bersama tim kami.</div>
        <div style="height:1px;background:var(--k-line,rgba(255,255,255,0.09));margin:22px 0;"></div>
        <div style="display:flex;flex-direction:column;gap:12px;flex:1;">
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Semua fitur Business</div></div>
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Integrasi &amp; migrasi data</div></div>
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Kontrak dan SLA khusus</div></div>
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Pendampingan penerapan</div></div>
        </div>
        <a data-cta="tidak" href="#kontak" style="display:inline-flex;align-items:center;justify-content:center;gap:9px;margin-top:28px;font-size:15px;font-weight:600;padding:13px 24px;border-radius:10px;white-space:nowrap;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));color:var(--k-ink,#F5F7FA);background:transparent;transition:transform 180ms ease,filter 180ms ease;" data-hover="transform:translateY(-2px);filter:brightness(1.08);">Hubungi kami</a>
      </div>

      <div data-plan="umkm" style="container-type:inline-size;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:14px;padding:28px 26px;background:var(--k-surface,#0B0E14);display:flex;flex-direction:column;">
        <div data-plan-head="true" style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:36px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:12px;flex:0 0 auto;">
            <canvas data-price-cell="umkm" width="228" height="228" aria-hidden="true" style="width:46px;height:46px;flex:0 0 46px;pointer-events:none;"></canvas>
            <div style="font-family:'Outfit',sans-serif;font-size:19px;font-weight:600;letter-spacing:-0.02em;color:var(--k-ink,#F5F7FA);">UMKM</div>
          </div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);flex:1 1 auto;min-width:0;text-align:right;line-height:1.3;">Segera hadir</div>
        </div>
        <p style="font-size:13.5px;line-height:1.55;color:var(--k-ink2,#8A93A3);margin-bottom:24px;min-height:42px;">Untuk warung, laundry, cuci mobil, dan usaha sejenis yang ingin mulai dari versi paling ringkas.</p>
        <div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px;">
          <div data-price-value="true" data-price-minggu="Segera hadir" data-price-bulan="Segera hadir" style="font-family:'Outfit',sans-serif;font-size:34px;font-weight:600;letter-spacing:-0.03em;line-height:1;color:var(--k-ink,#F5F7FA);white-space:nowrap;">Segera hadir</div>
          <div data-price-satuan="true" data-satuan-minggu="" data-satuan-bulan="" style="font-size:13px;color:var(--k-ink3,#5C6474);"></div>
        </div>
        <div aria-hidden="true" style="margin-top:10px;min-height:36px;"></div>
        <div style="height:1px;background:var(--k-line,rgba(255,255,255,0.09));margin:22px 0;"></div>
        <div style="display:flex;flex-direction:column;gap:12px;flex:1;">
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Fitur inti KLIR versi ringkas</div></div>
          <div style="display:flex;gap:10px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);margin-top:7px;flex-shrink:0;"></span><div style="font-size:14px;line-height:1.5;color:var(--k-ink2,#8A93A3);">Harga disesuaikan untuk skala UMKM</div></div>
        </div>
        <a data-cta="tidak" href="#kontak" style="display:inline-flex;align-items:center;justify-content:center;gap:9px;margin-top:28px;font-size:15px;font-weight:600;padding:13px 24px;border-radius:10px;white-space:nowrap;border:1px solid var(--k-line-strong,rgba(255,255,255,0.16));color:var(--k-ink,#F5F7FA);background:transparent;transition:transform 180ms ease,filter 180ms ease;" data-hover="transform:translateY(-2px);filter:brightness(1.08);">Beri tahu saya</a>
      </div>

    </div>
    </div>
    <p style="position:relative;z-index:1;font-size:12.5px;color:var(--k-ink3,#5C6474);margin-top:20px;">Harga dalam rupiah, belum termasuk pajak jika berlaku. Ketentuan pembayaran dan pembatalan menyusul.</p>
  </section>

  <section id="demo" data-sec="true" data-pad="true" style="position:relative;max-width:1180px;margin:130px auto 0;padding:0 28px;">
    <div aria-hidden="true" style="position:absolute;left:calc(50% - 50vw);width:100vw;top:-56px;height:calc(100% + 112px);z-index:0;pointer-events:none;background:linear-gradient(180deg, rgba(0,88,190,0) 0%, rgba(0,88,190,0.11) 34%, rgba(0,88,190,0.08) 68%, rgba(0,88,190,0) 100%);"></div>
    <div data-reveal="true" style="position:relative;z-index:1;border:1px solid var(--k-line,rgba(255,255,255,0.09));border-radius:20px;background:linear-gradient(158deg, var(--k-glass,rgba(10,22,42,0.94)) 0%, var(--k-surface,#0B0E14) 54%, var(--k-glass,rgba(10,22,42,0.88)) 100%);padding:72px 32px;text-align:center;overflow:hidden;">
      <span aria-hidden="true" style="position:absolute;left:50%;top:50%;width:400px;height:74px;margin:166px 0 0 -200px;z-index:1;pointer-events:none;border-radius:50%;background:radial-gradient(closest-side, rgba(0,32,74,0.7), rgba(0,32,74,0) 74%);"></span>
      <canvas data-companion="cta" width="460" height="460" aria-hidden="true" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:420px;height:420px;z-index:2;pointer-events:none;"></canvas>
      <svg viewBox="0 0 420 420" aria-hidden="true" style="position:absolute;left:50%;top:50%;width:420px;height:420px;margin:-210px 0 0 -210px;z-index:2;pointer-events:none;animation:klirTurn 52s linear infinite;">
        <circle cx="210" cy="210" r="176" fill="none" stroke="rgba(78,155,255,0.2)" stroke-width="1"></circle>
        <circle cx="210" cy="210" r="152" fill="none" stroke="rgba(78,155,255,0.08)" stroke-width="1" stroke-dasharray="3 9"></circle>
        <line x1="210" y1="34" x2="210" y2="210" stroke="rgba(78,155,255,0.16)" stroke-width="1"></line>
          <line x1="347.6" y1="100.3" x2="210" y2="210" stroke="rgba(78,155,255,0.16)" stroke-width="1"></line>
          <line x1="381.6" y1="249.2" x2="210" y2="210" stroke="rgba(78,155,255,0.16)" stroke-width="1"></line>
          <line x1="286.4" y1="368.6" x2="210" y2="210" stroke="rgba(78,155,255,0.16)" stroke-width="1"></line>
          <line x1="133.6" y1="368.6" x2="210" y2="210" stroke="rgba(78,155,255,0.16)" stroke-width="1"></line>
          <line x1="38.4" y1="249.2" x2="210" y2="210" stroke="rgba(78,155,255,0.16)" stroke-width="1"></line>
          <line x1="72.4" y1="100.3" x2="210" y2="210" stroke="rgba(78,155,255,0.16)" stroke-width="1"></line>
        <circle cx="210" cy="34" r="8" fill="rgba(201,166,107,0.14)"></circle><circle cx="210" cy="34" r="3.4" fill="rgb(201,166,107)"></circle>
          <circle cx="347.6" cy="100.3" r="8" fill="rgba(78,155,255,0.14)"></circle><circle cx="347.6" cy="100.3" r="3.4" fill="rgb(78,155,255)"></circle>
          <circle cx="381.6" cy="249.2" r="8" fill="rgba(78,155,255,0.14)"></circle><circle cx="381.6" cy="249.2" r="3.4" fill="rgb(78,155,255)"></circle>
          <circle cx="286.4" cy="368.6" r="8" fill="rgba(78,155,255,0.14)"></circle><circle cx="286.4" cy="368.6" r="3.4" fill="rgb(78,155,255)"></circle>
          <circle cx="133.6" cy="368.6" r="8" fill="rgba(78,155,255,0.14)"></circle><circle cx="133.6" cy="368.6" r="3.4" fill="rgb(78,155,255)"></circle>
          <circle cx="38.4" cy="249.2" r="8" fill="rgba(78,155,255,0.14)"></circle><circle cx="38.4" cy="249.2" r="3.4" fill="rgb(78,155,255)"></circle>
          <circle cx="72.4" cy="100.3" r="8" fill="rgba(78,155,255,0.14)"></circle><circle cx="72.4" cy="100.3" r="3.4" fill="rgb(78,155,255)"></circle>
      </svg>
      <span aria-hidden="true" style="position:absolute;left:50%;top:50%;width:520px;height:520px;margin:-260px 0 0 -260px;z-index:0;pointer-events:none;border-radius:50%;background:radial-gradient(closest-side, rgba(0,88,190,0.3), rgba(0,88,190,0) 72%);"></span>
      <span aria-hidden="true" style="position:absolute;left:50%;top:50%;width:462px;height:462px;margin:-231px 0 0 -231px;z-index:0;pointer-events:none;border-radius:50%;border:1px solid rgba(78,155,255,0.16);"></span>
      <span aria-hidden="true" style="position:absolute;left:50%;top:50%;width:462px;height:462px;margin:-231px 0 0 -231px;z-index:0;pointer-events:none;border-radius:50%;border-top:1px solid rgba(201,166,107,0.5);border-right:1px solid rgba(78,155,255,0.34);border-bottom:1px solid transparent;border-left:1px solid transparent;animation:klirTurn 26s linear infinite;"></span>
      <span aria-hidden="true" style="position:absolute;left:0;right:0;bottom:0;height:172px;z-index:0;pointer-events:none;background:repeating-linear-gradient(90deg, rgba(78,155,255,0.09) 0 1px, rgba(78,155,255,0) 1px 46px), repeating-linear-gradient(0deg, rgba(78,155,255,0.07) 0 1px, rgba(78,155,255,0) 1px 34px);-webkit-mask-image:linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 72%);mask-image:linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 72%);"></span>
      <div aria-hidden="true" style="position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(62% 52% at 50% 48%, var(--k-scrim-mid,rgba(6,8,12,0.42)) 0%, var(--k-scrim0,rgba(6,8,12,0)) 82%);"></div>
      <span aria-hidden="true" style="position:absolute;inset:0;z-index:3;pointer-events:none;background:linear-gradient(104deg, rgba(255,255,255,0) 42%, var(--k-sheen,rgba(120,180,255,0.1)) 50%, rgba(255,255,255,0) 58%);animation:klirSheen 10s ease-in-out infinite;"></span>
      <span aria-hidden="true" style="position:absolute;z-index:3;pointer-events:none;width:20px;height:20px;top:14px;left:14px;border-top:1px solid rgba(201,166,107,0.45);border-left:1px solid rgba(201,166,107,0.45);border-radius:5px 0 0 0;"></span>
      <span aria-hidden="true" style="position:absolute;z-index:3;pointer-events:none;width:20px;height:20px;top:14px;right:14px;border-top:1px solid rgba(78,155,255,0.4);border-right:1px solid rgba(78,155,255,0.4);border-radius:0 5px 0 0;"></span>
      <span aria-hidden="true" style="position:absolute;z-index:3;pointer-events:none;width:20px;height:20px;bottom:14px;left:14px;border-bottom:1px solid rgba(78,155,255,0.4);border-left:1px solid rgba(78,155,255,0.4);border-radius:0 0 0 5px;"></span>
      <span aria-hidden="true" style="position:absolute;z-index:3;pointer-events:none;width:20px;height:20px;bottom:14px;right:14px;border-bottom:1px solid rgba(201,166,107,0.45);border-right:1px solid rgba(201,166,107,0.45);border-radius:0 0 5px 0;"></span>
      <span aria-hidden="true" style="position:absolute;left:50%;top:50%;width:min(760px,94%);height:400px;transform:translate(-50%,-50%);z-index:2;pointer-events:none;background:radial-gradient(58% 50% at 50% 50%, var(--k-scrim,rgba(6,8,12,0.9)) 0%, var(--k-scrim-mid,rgba(6,8,12,0.66)) 48%, var(--k-scrim0,rgba(6,8,12,0)) 78%);"></span>
      <div style="position:relative;z-index:3;display:flex;justify-content:center;margin-bottom:20px;">
        <span style="display:inline-flex;align-items:center;gap:9px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:0.2em;text-transform:uppercase;color:var(--k-accent2,#4E9BFF);border:1px solid rgba(78,155,255,0.28);border-radius:999px;background:var(--k-chip,rgba(6,8,12,0.72));padding:7px 14px;">
          <span aria-hidden="true" style="width:5px;height:5px;border-radius:50%;background:var(--k-accent2,#4E9BFF);box-shadow:0 0 10px rgba(78,155,255,0.9);animation:klirBeat 2.8s ease-in-out infinite;"></span>
          Langkah berikutnya
        </span>
      </div>
      <h2 style="position:relative;z-index:3;font-size:42px;line-height:1.08;letter-spacing:-0.035em;font-weight:600;color:var(--k-ink,#F5F7FA);margin:0 0 16px;text-wrap:pretty;">Rapikan operasi usahamu<br>mulai minggu ini</h2>
      <p style="position:relative;z-index:3;font-size:16.5px;color:var(--k-ink2,#8A93A3);margin:0 auto 32px;max-width:520px;line-height:1.6;">Tim KLIR akan memetakan proses usahamu bersama timmu, lalu menunjukkan bagaimana ketujuh pilarnya tersambung.</p>
      <div style="position:relative;z-index:3;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;align-items:center;">
        <a data-open-auth="register" href="#form-demo" style="position:relative;font-size:15px;font-weight:600;color:#FFFFFF;white-space:nowrap;background:linear-gradient(180deg,#0F6FE0,var(--k-accent,#0058BE));padding:15px 26px;border-radius:11px;box-shadow:0 14px 34px rgba(0,88,190,0.45), inset 0 1px 0 rgba(255,255,255,0.18);transition:transform 180ms ease,filter 180ms ease;" data-hover="transform:translateY(-2px);filter:brightness(1.1);color:#FFFFFF;">Minta demo</a>
        <a href="#harga" style="font-size:15px;font-weight:600;white-space:nowrap;border:1px solid rgba(78,155,255,0.24);background:rgba(255,255,255,0.03);padding:15px 26px;border-radius:11px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.06);transition:background 180ms ease,border-color 180ms ease,transform 180ms ease;" data-hover="background:rgba(78,155,255,0.1);border-color:rgba(78,155,255,0.42);transform:translateY(-2px);color:var(--k-ink,#F5F7FA);">Lihat harga</a>
      </div>
    </div>
  </section>

  <footer style="margin-top:130px;border-top:1px solid var(--k-line,rgba(255,255,255,0.09));">
    <div data-pad="true" style="max-width:1180px;margin:0 auto;padding:60px 28px 40px;">
      <div data-cols-5="true" style="display:grid;grid-template-columns:1.4fr repeat(4,1fr);gap:36px;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 0.8l11.2 6v10.4L12 23.2 0.8 17.2V6.8z" fill="var(--k-accent,#0058BE)"></path>
              <path d="M8.2 6.6v10.8M8.2 12l6.4-5.4M8.2 12l6.9 5.4" stroke="#FFFFFF" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            <span style="font-family:'Outfit',sans-serif;font-size:15px;font-weight:700;letter-spacing:0.05em;">KLIR</span>
          </div>
          <p style="font-size:13px;color:var(--k-ink3,#5C6474);line-height:1.6;max-width:230px;">Sistem operasi usaha untuk bisnis Indonesia, dari usaha kecil sampai perusahaan, yang bekerja bersama tim.</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:11px;">
          <div style="font-size:12.5px;font-weight:600;margin-bottom:3px;">Produk</div>
          <a href="#rencana" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Rencana bisnis</a>
          <a href="#keuangan" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Keuangan</a>
          <a href="#promosi" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Promosi</a>
          <a href="#tim" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Kelola tim</a>
          <a href="#kepatuhan" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Kepatuhan</a>
          <a href="#komunikasi" style="font-size:13px;color:var(--k-ink2,#8A93A3);">KLIR Personal</a>
          <a href="#jadwal" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Jadwal usaha</a>
        </div>
        <div style="display:flex;flex-direction:column;gap:11px;">
          <div style="font-size:12.5px;font-weight:600;margin-bottom:3px;">Perusahaan</div>
          <a href="#tentang" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Tentang</a>
          <a href="#karier" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Karier</a>
          <a href="#blog" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Blog</a>
          <a href="#kontak" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Kontak</a>
        </div>
        <div style="display:flex;flex-direction:column;gap:11px;">
          <div style="font-size:12.5px;font-weight:600;margin-bottom:3px;">Sumber Daya</div>
          <a href="#docs" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Dokumentasi</a>
          <a href="#panduan" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Panduan UMKM</a>
          <a href="#changelog" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Catatan rilis</a>
          <a href="#status" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Status sistem</a>
        </div>
        <div style="display:flex;flex-direction:column;gap:11px;">
          <div style="font-size:12.5px;font-weight:600;margin-bottom:3px;">Legal</div>
          <a href="#privasi" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Kebijakan privasi</a>
          <a href="#syarat" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Syarat layanan</a>
          <a href="#keamanan" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Keamanan data</a>
          <a href="#dpa" style="font-size:13px;color:var(--k-ink2,#8A93A3);">Perjanjian data</a>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-top:52px;padding-top:24px;border-top:1px solid var(--k-line,rgba(255,255,255,0.09));">
        <div style="font-size:12px;color:var(--k-ink3,#5C6474);">&#169; 2026 KLIR. Badan hukum dan alamat resmi menyusul.</div>
        <div style="display:flex;gap:20px;">
          <a href="#x" style="font-size:12px;color:var(--k-ink3,#5C6474);">X</a>
          <a href="#linkedin" style="font-size:12px;color:var(--k-ink3,#5C6474);">LinkedIn</a>
          <a href="#instagram" style="font-size:12px;color:var(--k-ink3,#5C6474);">Instagram</a>
          <a href="#youtube" style="font-size:12px;color:var(--k-ink3,#5C6474);">YouTube</a>
        </div>
      </div>
    </div>
  </footer>
</div>
`;
