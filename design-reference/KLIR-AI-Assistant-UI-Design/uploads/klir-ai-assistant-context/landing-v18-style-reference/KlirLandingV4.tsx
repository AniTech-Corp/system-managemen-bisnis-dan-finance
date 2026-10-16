'use client';

// Ported from Claude Design source "KLIR Landing v14.dc.html"
// (Claude Code Asistent\KLIR\klir-public\landing\from-zip-V10\KLIR Landing v14.dc.html).
// Markup lives in ./klirV4Markup.ts (see that file's header for full conversion notes).
// This file wires up the behavior v14's own inline <script> + component class implemented,
// re-targeted at the data-* hooks that actually exist in the ported markup:
//   nav (plain sticky, no scroll-toggle -- v14 doesn't have one) + mobile menu
//   theme toggle (data-theme-toggle/-icon/-label, CSS custom-property swap, localStorage)
//   live clock (data-live-clock), shift ticker (data-shift-chip/-count)
//   pricing cadence toggle (data-siklus, data-price-value/-satuan/-note with embedded
//     minggu/bulan values as data attributes -- markup.ts has no virtual DOM to re-render)
//   reveal-on-scroll (data-reveal) driving count-up (data-countup, w/ data-decimal support
//     matching v14's Indonesian-locale decimal-comma formatting), bar-chart reveal
//     (data-bar="NN" percent, v14's convention -- NOT the old data-bars container convention),
//     and the delayed "new ledger row" reveal (data-row-new)
//   hero orbit: faithful port of v14's buildScene()/frame()/pasangOrbit()/tempelLabel() (N=6
//     nodes -- v14's N=7 minus the removed "Kepatuhan" pillar -- hub/cage/grid/shard sizes copied
//     verbatim from v14's own numbers). pasangOrbit() syncs the 3D world's position+scale to the
//     on-screen rect of [data-orbit] every mount/resize, so the hub always sits centered under
//     "Satu data usaha" in the right column and never balloons out over the left column's hero
//     CTA -- that HTML-box sync is the fix for a prior regression where this scene reused old
//     pre-v14 hub/glow sizes with no box sync at all and rendered centered on the full-width
//     [data-hero-canvas] instead, overlapping the CTA. tempelLabel() (also a faithful v14 port,
//     restored -- an earlier version of this file left the 6 [data-node] labels on static
//     hardcoded hexagon CSS percentages and never called this method, so the labels sat frozen
//     while the 3D dots behind them animated/gathered) re-projects each node's world position onto
//     the [data-orbit] box every frame and overwrites the label's left/top/transform/opacity/
//     zIndex, so the HTML labels visually orbit and converge together with the 3D scene, matching
//     v14 exactly; klirV4Markup.ts's [data-node] divs sit on v14's centered placeholder position
//     (left:50%;top:50%) since this function now drives their real position every frame. Panel
//     tilt+sheen (data-visual), decorative canvas layers carried over from the previous adaptation
//     (companion icosahedrons, section-copy background sigils, reach-stat globe, testimonial
//     avatar polyhedra) since these ARE compatible with the ported markup's hooks and add visual
//     richness v14's flat static export couldn't show alone. price-cell micro-scenes (also
//     restored -- an earlier version of this file replaced v14's data-price-cell canvases with
//     static SVG icons): one small WebGL scene per pricing card (starter = growing seed inside a
//     wireframe shell, business = orbiting gold cells around an octahedron, enterprise = pulsing
//     3x3 node grid), hover-triggered via each card's mouseenter/mouseleave (matches v14's
//     initPriceCells() verbatim, incl. its own separate gold tone '#D8A33C' vs the hero/companion
//     gold '#C9A66B' -- v14 genuinely uses two different golds in two different subsystems).
//     themeScene(): also restored -- v14's applyTheme() desaturates every WebGL scene (hero,
//     companions, price cells) for light mode so the 3D layer doesn't overpower a light
//     background; this was previously missing entirely, so toggling to light mode left all 3D
//     elements at full dark-mode brightness. Ported as a function assigned once initHeroScene()
//     has built every scene, invoked from applyTheme() on every toggle plus once on mount if
//     localStorage already had 'light' saved.
// Deliberately NOT ported (documented simplification, see final report to Mecca):
//   - v14's own canvas-particle dust / bezier flow-connectors / HUD corner pulses were never
//     ported here in the first place -- those were a previous-repo-only addition whose keyframe
//     names weren't even defined anywhere (dead CSS), and v14 itself doesn't use them.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { KLIR_V4_MARKUP } from './klirV4Markup';

const ACCENT = '#0058BE';
const GOLD: [number, number, number] = [201, 166, 107];
const HERO_TILT_DEG = 6;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(c: number[], a: number) {
  return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;
}

// Light-mode CSS custom properties -- ported verbatim from v14's `TERANG` map. Dark mode is
// simply "no override": every color in klirV4Markup.ts is written as var(--k-x, <dark-value>),
// so removing these properties falls back to dark automatically.
const TERANG: Record<string, string> = {
  '--k-bg': '#F2F5F9',
  '--k-surface': '#FFFFFF',
  '--k-surface-fade': 'rgba(242,245,249,0.86)',
  '--k-raise': '#E7ECF3',
  '--k-nav': 'rgba(242,245,249,0.88)',
  '--k-ink': '#0B0E14',
  '--k-ink2': '#4E5766',
  '--k-ink3': '#79828F',
  '--k-line': 'rgba(11,14,20,0.13)',
  '--k-line2': 'rgba(11,14,20,0.07)',
  '--k-line-strong': 'rgba(11,14,20,0.22)',
  '--k-tint': 'rgba(11,14,20,0.04)',
  '--k-accent': '#0058BE',
  '--k-accent2': '#0058BE',
  '--k-accent-bg': 'rgba(0,88,190,0.08)',
  '--k-accent-line': 'rgba(0,88,190,0.3)',
  '--k-ok': '#12805B',
  '--k-warn': '#8A5E0B',
  '--k-glass': 'rgba(255,255,255,0.92)',
  '--k-glass2': 'rgba(247,250,255,0.98)',
  '--k-scrim': 'rgba(242,245,249,0.94)',
  '--k-scrim-mid': 'rgba(242,245,249,0.74)',
  '--k-scrim0': 'rgba(242,245,249,0)',
  '--k-chip': 'rgba(255,255,255,0.94)',
  '--k-sheen': 'rgba(0,88,190,0.07)',
  '--k-shadow': 'rgba(11,14,20,0.12)',
  '--k-fill': 'rgba(11,14,20,0.035)',
  '--k-fill2': 'rgba(11,14,20,0.012)',
  '--k-ghost': 'rgba(214,220,229,0.96)',
  '--k-ghost2': 'rgba(198,206,218,0.98)',
};

interface KlirLandingV4Props {
  onQuickDemo?: () => void;
  onOpenAuth?: (mode: 'login' | 'register') => void;
}

export default function KlirLandingV4({ onQuickDemo, onOpenAuth }: KlirLandingV4Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cleanups: Array<() => void> = [];
    const rafs: number[] = [];
    const rafMap = new Map<any, number>();
    const alive = { on: true };
    const TICKS: any = { loop2: 0, loop3: 0, blits: 0, pillars: 0, reach: 0, avatars: 0 };
    (window as any).__klirTicks = TICKS;
    (window as any).__klirMounts = ((window as any).__klirMounts || 0) + 1;
    const trackRaf = (fn: any, id: number) => rafMap.set(fn, id);
    const disconnects: Array<() => void> = [];
    const state = { scrollN: 0, focus: -1 as number };

    document.documentElement.style.setProperty('--tilt', HERO_TILT_DEG + 'deg');

    // ---------- viewport gate (rect sampling, NOT IntersectionObserver) ----------
    // This document runs inside a cross-origin iframe, so IntersectionObserver reports
    // rootBounds: null and isIntersecting: false for elements plainly on screen -- every gate
    // built on it parked its target permanently. Rect sampling is measured against this
    // document's own viewport and always agrees with what the reader sees. registerGate()
    // evaluates immediately, and the default is ON: nothing is parked until proven far offscreen.
    const gateEls: HTMLElement[] = [];
    const gateSet: Array<(near: boolean) => void> = [];
    const nearViewport = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      return !(r.bottom < -500 || r.top > vh + 500);
    };
    const registerGate = (el: HTMLElement, set: (near: boolean) => void) => {
      gateEls.push(el);
      gateSet.push(set);
      set(nearViewport(el));
    };
    const sweepGates = () => {
      for (let i = 0; i < gateEls.length; i++) gateSet[i](nearViewport(gateEls[i]));
    };
    let gateTimer = 0;
    const onGateScroll = () => {
      if (gateTimer) return;
      gateTimer = window.setTimeout(() => {
        gateTimer = 0;
        sweepGates();
      }, 150);
    };
    window.addEventListener('scroll', onGateScroll, { passive: true });
    window.addEventListener('resize', onGateScroll);
    disconnects.push(() => {
      clearTimeout(gateTimer);
      window.removeEventListener('scroll', onGateScroll);
      window.removeEventListener('resize', onGateScroll);
    });

    if (!reduce) {
      // Stamped hook, not a style-substring match: setting animationPlayState makes the browser
      // re-serialize the shorthand as "animation: klirX ..." (with a space), so a
      // [style*="animation:klir"] selector silently matches nothing on any remount.
      const animated = Array.from(
        root.querySelectorAll<HTMLElement>('[style*="animation:klir"], [style*="animation: klir"], [data-anim-gate]')
      );
      animated.forEach((el) => {
        el.setAttribute('data-anim-gate', '');
        registerGate(el, (near) => {
          const want = near ? 'running' : 'paused';
          if (el.style.animationPlayState !== want) el.style.animationPlayState = want;
        });
      });
    }

    // ---------- CTA / auth wiring (data-open-auth="login" | "register") ----------
    const authEls = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-open-auth]'));
    authEls.forEach((a) => {
      const mode = a.getAttribute('data-open-auth') === 'login' ? 'login' : 'register';
      const handler = (e: Event) => {
        e.preventDefault();
        onOpenAuth?.(mode);
      };
      a.addEventListener('click', handler);
      cleanups.push(() => a.removeEventListener('click', handler));
    });

    // ---------- theme toggle ----------
    const themeBtn = root.querySelector<HTMLElement>('[data-theme-toggle]');
    const themeIcon = root.querySelector<SVGElement>('[data-theme-icon]');
    const themeLabel = root.querySelector<HTMLElement>('[data-theme-label]');
    let theme: 'light' | 'dark' = 'dark';
    try {
      const s = window.localStorage.getItem('klir-theme');
      if (s === 'light' || s === 'dark') theme = s;
    } catch {
      /* ignore storage access errors (private mode etc) */
    }
    // Assigned once initHeroScene() below has built every WebGL scene (hero + companions + price
    // cells); faithful port of v14's themeScene(), which desaturates the whole 3D layer for light
    // mode so it doesn't overpower a light background. Until assigned, calls are simply no-ops --
    // matches v14's own guard (`if (this.scene) ...`), since scenes don't exist before mount.
    let themeScene: ((light: boolean) => void) | null = null;
    const applyTheme = () => {
      const light = theme === 'light';
      const r = document.documentElement;
      Object.keys(TERANG).forEach((k) => {
        if (light) r.style.setProperty(k, TERANG[k]);
        else r.style.removeProperty(k);
      });
      r.style.colorScheme = light ? 'light' : 'dark';
      if (themeLabel) themeLabel.textContent = light ? 'Gelap' : 'Terang';
      if (themeIcon) {
        themeIcon.innerHTML = light
          ? '<path d="M20.4 14.6A8.6 8.6 0 1 1 9.4 3.6a6.9 6.9 0 0 0 11 11z"></path>'
          : '<circle cx="12" cy="12" r="4.2"></circle><path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4"></path>';
      }
      themeScene?.(light);
      try {
        window.localStorage.setItem('klir-theme', theme);
      } catch {
        /* ignore */
      }
    };
    applyTheme();
    const toggleTheme = () => {
      theme = theme === 'light' ? 'dark' : 'light';
      applyTheme();
    };
    themeBtn?.addEventListener('click', toggleTheme);
    cleanups.push(() => themeBtn?.removeEventListener('click', toggleTheme));

    // ---------- mobile menu ----------
    const menuBtn = root.querySelector<HTMLElement>('[data-menu-btn]');
    const menuPanel = root.querySelector<HTMLElement>('[data-mobile-panel]');
    let menuOpen = false;
    const toggleMenu = () => {
      menuOpen = !menuOpen;
      if (menuPanel) menuPanel.style.display = menuOpen ? 'flex' : 'none';
    };
    menuBtn?.addEventListener('click', toggleMenu);
    Array.from(root.querySelectorAll<HTMLElement>('[data-mobile-panel] a')).forEach((a) =>
      a.addEventListener('click', () => {
        menuOpen = false;
        if (menuPanel) menuPanel.style.display = 'none';
      })
    );
    cleanups.push(() => menuBtn?.removeEventListener('click', toggleMenu));

    // ---------- generic hover styling (from data-hover attrs) ----------
    const hoverEls = Array.from(root.querySelectorAll<HTMLElement>('[data-hover]'));
    const hoverCleanups: Array<() => void> = [];
    hoverEls.forEach((el) => {
      const decl = el.getAttribute('data-hover') || '';
      const pairs = decl
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const idx = s.indexOf(':');
          return [s.slice(0, idx).trim(), s.slice(idx + 1).trim()] as [string, string];
        });
      const before = new Map<string, string>();
      const enter = () => {
        pairs.forEach(([prop]) => {
          // An empty inline snapshot cannot be restored by writing '': for border-color the
          // border is declared through a var() shorthand, which the CSSOM cannot serialize, so
          // the snapshot comes back empty and writing '' REMOVES all four border-*-color
          // longhands -- the border then falls back to currentColor (bright ink). Border
          // properties therefore fall back to the computed value, which is the real hairline.
          const inline = el.style.getPropertyValue(prop);
          before.set(prop, inline || (prop.indexOf('border') === 0 ? getComputedStyle(el).getPropertyValue(prop) : ''));
        });
        pairs.forEach(([prop, val]) => el.style.setProperty(prop, val));
      };
      const leave = () => {
        before.forEach((v, prop) => {
          if (v) el.style.setProperty(prop, v);
          else el.style.removeProperty(prop);
        });
      };
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      hoverCleanups.push(() => {
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointerleave', leave);
      });
    });
    cleanups.push(() => hoverCleanups.forEach((c) => c()));

    // ---------- live clock ----------
    const clockEl = root.querySelector<HTMLElement>('[data-live-clock]');
    if (clockEl) {
      let d = 0;
      const clockTimer = setInterval(() => {
        d += 5;
        clockEl.textContent = d < 60 ? 'Diperbarui ' + d + ' detik lalu' : 'Diperbarui ' + Math.floor(d / 60) + ' menit lalu';
        if (d >= 300) d = 0;
      }, 5000);
      cleanups.push(() => clearInterval(clockTimer));
    }

    // ---------- task ticker (cycles chips to "Selesai" one at a time, then resets) ----------
    const shiftChips = Array.from(root.querySelectorAll<HTMLElement>('[data-shift-chip]'));
    const shiftCount = root.querySelector<HTMLElement>('[data-shift-count]');
    const shiftSegs = Array.from(root.querySelectorAll<HTMLElement>('[data-shift-seg]'));
    // The segment track must follow the same counter it sits under, or it contradicts it for
    // most of the cycle (it was fixed at 2 of 4 while the count cycles 0..4).
    const paintSegs = (n: number) => {
      shiftSegs.forEach((s, k) => {
        const lit = k < n;
        s.style.background = lit
          ? 'linear-gradient(90deg, var(--k-ok,#3FBF8F), rgba(63,191,143,0.6))'
          : 'var(--k-tint,rgba(255,255,255,0.06))';
        s.style.boxShadow = lit ? '0 0 12px rgba(63,191,143,0.45)' : 'none';
      });
    };
    if (shiftChips.length) {
      let i = 0;
      paintSegs(0);
      const step = () => {
        if (i >= shiftChips.length) {
          shiftChips.forEach((c) => {
            c.textContent = 'Menunggu';
            c.style.color = 'var(--k-ink3,#5C6474)';
            c.style.borderColor = 'var(--k-line,rgba(255,255,255,0.09))';
            c.style.background = 'transparent';
          });
          if (shiftCount) shiftCount.textContent = '0';
          paintSegs(0);
          i = 0;
          return;
        }
        const c = shiftChips[i];
        c.textContent = 'Selesai';
        c.style.color = 'var(--k-ok,#3FBF8F)';
        c.style.borderColor = 'var(--k-ok,#3FBF8F)';
        c.style.background = 'var(--k-tint,rgba(255,255,255,0.04))';
        i++;
        if (shiftCount) shiftCount.textContent = String(i);
        paintSegs(i);
      };
      const shiftTimer = setInterval(step, 1900);
      cleanups.push(() => clearInterval(shiftTimer));
    }

    // ---------- pricing cadence toggle (minggu / bulan) ----------
    const siklusBtns = Array.from(root.querySelectorAll<HTMLElement>('[data-siklus]'));
    const applySiklus = (s: 'minggu' | 'bulan') => {
      siklusBtns.forEach((b) => {
        const active = b.getAttribute('data-siklus') === s;
        b.style.background = active ? 'var(--k-accent,#0058BE)' : 'transparent';
        b.style.color = active ? '#FFFFFF' : 'var(--k-ink2,#8A93A3)';
      });
      root.querySelectorAll<HTMLElement>('[data-price-value]').forEach((el) => {
        const v = el.getAttribute(s === 'minggu' ? 'data-price-minggu' : 'data-price-bulan');
        if (v !== null) el.textContent = v;
      });
      root.querySelectorAll<HTMLElement>('[data-price-satuan]').forEach((el) => {
        const v = el.getAttribute(s === 'minggu' ? 'data-satuan-minggu' : 'data-satuan-bulan');
        el.textContent = v || '';
      });
      root.querySelectorAll<HTMLElement>('[data-price-note]').forEach((el) => {
        const v = el.getAttribute(s === 'minggu' ? 'data-note-minggu' : 'data-note-bulan');
        el.textContent = v || '';
      });
    };
    if (siklusBtns.length) applySiklus('bulan');
    siklusBtns.forEach((b) => {
      const s = (b.getAttribute('data-siklus') === 'minggu' ? 'minggu' : 'bulan') as 'minggu' | 'bulan';
      const h = () => applySiklus(s);
      b.addEventListener('click', h);
      cleanups.push(() => b.removeEventListener('click', h));
    });

    // ---------- reveal on scroll: count-up (+decimal), bar reveal, delayed new-row ----------
    const numFmt = (v: number, decimals: boolean) =>
      decimals ? v.toFixed(1).replace('.', ',') : Math.round(v).toLocaleString('id-ID');
    const runCountUp = (rootEl: Element) => {
      const els = Array.from(rootEl.querySelectorAll<HTMLElement>('[data-countup]'));
      if (rootEl.hasAttribute && rootEl.hasAttribute('data-countup')) els.push(rootEl as HTMLElement);
      els.forEach((el) => {
        if (el.getAttribute('data-animated') === 'true') return;
        el.setAttribute('data-animated', 'true');
        const target = parseFloat(el.getAttribute('data-countup') || '0') || 0;
        const decimals = el.hasAttribute('data-decimal');
        const t0 = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - t0) / 1400);
          const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          el.textContent = numFmt(target * e, decimals);
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    };
    const runBars = (rootEl: Element) => {
      const bars = Array.from(rootEl.querySelectorAll<HTMLElement>('[data-bar]'));
      if (rootEl.hasAttribute && rootEl.hasAttribute('data-bar')) bars.push(rootEl as HTMLElement);
      bars.forEach((b) => {
        const want = (b.getAttribute('data-bar') || '0') + '%';
        if (b.style.height !== want) b.style.height = want;
      });
    };
    const runRowNew = (rootEl: Element) => {
      const rows = Array.from(rootEl.querySelectorAll<HTMLElement>('[data-row-new]'));
      rows.forEach((row) => {
        setTimeout(() => {
          row.style.opacity = '1';
          row.style.transform = 'translateY(0)';
        }, 620);
      });
    };

    const animatePanel = (el: Element) => {
      if (!el || !el.hasAttribute || !el.hasAttribute('data-visual')) return;
      if (el.getAttribute('data-rows-done') === 'true') return;
      el.setAttribute('data-rows-done', 'true');
      const kids = Array.from(el.children) as HTMLElement[];
      let list: HTMLElement | null = null;
      for (let i = 0; i < kids.length; i++) {
        const cs = getComputedStyle(kids[i]);
        if (cs.display === 'flex' && cs.flexDirection === 'column' && kids[i].children.length >= 3) {
          list = kids[i];
          break;
        }
      }
      if (!list) {
        for (let i = 0; i < kids.length; i++) {
          if (getComputedStyle(kids[i]).display === 'grid' && kids[i].children.length >= 3) {
            list = kids[i];
            break;
          }
        }
      }
      const items = list ? (Array.from(list.children) as HTMLElement[]) : [];
      if (!items.length) {
        el.removeAttribute('data-rows-done');
        return;
      }
      items.forEach((row, i) => {
        if (row.hasAttribute('data-row-new')) return;
        row.style.opacity = '0';
        row.style.transform = 'translateX(-12px)';
        row.style.transition = 'opacity 520ms cubic-bezier(0.16,1,0.3,1),transform 520ms cubic-bezier(0.16,1,0.3,1)';
        setTimeout(() => {
          row.style.opacity = '1';
          row.style.transform = 'none';
        }, 140 + i * 95);
      });
    };

    const revealEls = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const show = (el: HTMLElement) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.filter = 'none';
      runCountUp(el);
      runBars(el);
      runRowNew(el);
      animatePanel(el);
    };
    if (reduce || !('IntersectionObserver' in window)) {
      revealEls.forEach(show);
    } else {
      const counts = new Map<Element | null, number>();
      revealEls.forEach((el) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(18px)';
        const p = el.parentElement;
        const n = counts.get(p) || 0;
        counts.set(p, n + 1);
        el.style.transitionDelay = Math.min(n, 6) * 70 + 'ms';
        el.style.filter = 'blur(7px)';
        el.style.transition = 'opacity 700ms cubic-bezier(0.16,1,0.3,1),transform 700ms cubic-bezier(0.16,1,0.3,1),filter 760ms cubic-bezier(0.16,1,0.3,1)';
      });
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              show(e.target as HTMLElement);
              io.unobserve(e.target);
            }
          });
        },
        { rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
      );
      revealEls.forEach((el) => io.observe(el));
      const failsafe = setTimeout(() => revealEls.forEach(show), 3500);
      disconnects.push(() => {
        io.disconnect();
        clearTimeout(failsafe);
      });
    }

    // ---------- hero orbit node hover -> focus the matching 3D node ----------
    const orbitNodeEls = Array.from(root.querySelectorAll<HTMLElement>('[data-orbit] > [data-node]'));
    const orbitCleanups: Array<() => void> = [];
    orbitNodeEls.forEach((elNode, i) => {
      elNode.style.cursor = 'default';
      const enter = () => {
        state.focus = i;
      };
      const leave = () => {
        state.focus = -1;
      };
      elNode.addEventListener('pointerenter', enter);
      elNode.addEventListener('pointerleave', leave);
      orbitCleanups.push(() => {
        elNode.removeEventListener('pointerenter', enter);
        elNode.removeEventListener('pointerleave', leave);
      });
    });
    cleanups.push(() => orbitCleanups.forEach((c) => c()));

    // ---------- track scroll for hero parallax (world.position/rotation reacts to state.scrollN) ----------
    const onScroll = () => {
      const y = window.scrollY || 0;
      state.scrollN = Math.min(1.5, y / 900);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    cleanups.push(() => window.removeEventListener('scroll', onScroll));

    // ---------- panel tilt + sheen (mockup cards) ----------
    const panelCleanups: Array<() => void> = [];
    if (window.innerWidth > 920) {
      const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-visual]'));
      const DEPTH = [30, 12, 42, 20];
      panels.forEach((panel) => {
        // Stages that own their own 3D composition are off-limits: this pass rewrites every
        // child's transform to a flat translateZ, which erased the card's rest rotation and
        // pushed the ghost draft sheets in front of it instead of behind.
        if (panel.hasAttribute('data-tilt-stage')) return;
        const parent = panel.parentElement;
        if (parent) parent.style.perspective = '1500px';
        panel.style.transformStyle = 'preserve-3d';
        panel.style.willChange = 'transform';
        Array.from(panel.children).forEach((ch, i) => {
          (ch as HTMLElement).style.transform = 'translateZ(' + DEPTH[i % DEPTH.length] + 'px)';
          (ch as HTMLElement).style.transformStyle = 'preserve-3d';
        });
        const sheen = document.createElement('div');
        sheen.setAttribute('aria-hidden', 'true');
        sheen.style.cssText = 'position:absolute;inset:0;border-radius:18px;pointer-events:none;opacity:0;transition:opacity 220ms ease;z-index:2;';
        panel.appendChild(sheen);
        const baseTr = panel.style.transition;
        let raf: number | null = null,
          tx = 0,
          ty = 0,
          cx = 0,
          cy = 0;
        const run = () => {
          cx += (tx - cx) * 0.14;
          cy += (ty - cy) * 0.14;
          panel.style.transform = 'rotateY(' + (cx * 6).toFixed(2) + 'deg) rotateX(' + (-cy * 6).toFixed(2) + 'deg) translateZ(10px)';
          if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(run);
          else raf = null;
        };
        const kick = () => {
          if (!raf) raf = requestAnimationFrame(run);
        };
        const enter = () => {
          if (panel.style.opacity !== '1') return;
          panel.style.transition = 'border-color 180ms ease';
          sheen.style.opacity = '1';
        };
        const move = (e: PointerEvent) => {
          if (panel.style.opacity !== '1') return;
          const r = panel.getBoundingClientRect();
          tx = (e.clientX - r.left) / r.width - 0.5;
          ty = (e.clientY - r.top) / r.height - 0.5;
          sheen.style.background =
            'radial-gradient(460px circle at ' + ((tx + 0.5) * 100).toFixed(1) + '% ' + ((ty + 0.5) * 100).toFixed(1) + '%, rgba(78,155,255,0.14), rgba(201,166,107,0.05) 38%, transparent 66%)';
          kick();
        };
        const leave = () => {
          tx = 0;
          ty = 0;
          sheen.style.opacity = '0';
          kick();
          setTimeout(() => {
            panel.style.transition = baseTr;
          }, 420);
        };
        panel.addEventListener('pointerenter', enter);
        panel.addEventListener('pointermove', move as any);
        panel.addEventListener('pointerleave', leave);
        panelCleanups.push(() => {
          panel.removeEventListener('pointerenter', enter);
          panel.removeEventListener('pointermove', move as any);
          panel.removeEventListener('pointerleave', leave);
          if (raf) cancelAnimationFrame(raf);
        });
      });
    }
    cleanups.push(() => panelCleanups.forEach((c) => c()));

    // ---------- Three.js hero scene (6-node network + icosahedron/dodecahedron core) ----------
    let renderer: THREE.WebGLRenderer | null = null;
    let heroRaf: number | null = null;
    let heroIoCleanup: (() => void) | null = null;
    let onPointer: ((e: PointerEvent) => void) | null = null;
    let onResizeHero: (() => void) | null = null;
    (function initHeroScene() {
      const host = root!.querySelector<HTMLElement>('[data-hero-canvas]');
      const orbitBox = root!.querySelector<HTMLElement>('[data-orbit]');
      if (!host) return;
      const w = host.clientWidth || 1200;
      const h = host.clientHeight || 820;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      renderer.setClearAlpha(0);
      const onCtxLost = (ev: Event) => {
        ev.preventDefault();
      };
      renderer.domElement.addEventListener('webglcontextlost', onCtxLost, false);
      cleanups.push(() => renderer && renderer.domElement.removeEventListener('webglcontextlost', onCtxLost));
      renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;';
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
      camera.position.set(0, 0.5, 9.4);

      const accent = new THREE.Color(ACCENT);
      const bright = accent.clone().lerp(new THREE.Color('#ffffff'), 0.6);

      const glowTexture = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d')!;
        const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        rg.addColorStop(0, 'rgba(255,255,255,1)');
        rg.addColorStop(0.25, 'rgba(255,255,255,0.55)');
        rg.addColorStop(0.6, 'rgba(255,255,255,0.12)');
        rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg;
        g.fillRect(0, 0, 128, 128);
        const t = new THREE.CanvasTexture(c);
        t.needsUpdate = true;
        return t;
      };
      const tex = glowTexture();

      // Faithful port of v14's buildScene(): world tilt, node/hub/cage/grid/shard proportions and
      // the pasangOrbit() sync below are copied verbatim from "KLIR Landing v14.dc.html" (lines
      // ~1261-1431 of that file). The previous version of this scene kept the OLD pre-v14 scene
      // (bigger hub, no HTML-box sync) and only relabeled the DOM nodes -- that is what let the
      // hub/glow balloon out over the hero CTA. This block replaces that scene entirely.
      const world = new THREE.Group();
      world.rotation.x = -0.86;
      scene.add(world);

      // N = 6, not v14's 7: "Kepatuhan" was removed as a pillar (see klirV4Markup.ts header notes),
      // so [data-orbit] only ships 6x [data-node]. R stays v14's own value (2.6) -- pasangOrbit()
      // below rescales the whole world to the actual [data-orbit] box width, so this radius only
      // needs to be internally consistent with the hub/cage/grid sizes copied below, not with any
      // on-screen pixel size.
      const N = 7;
      const R = 2.6;
      const nodePts: THREE.Vector3[] = [];
      const nodes: any[] = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const p = new THREE.Vector3(Math.cos(a) * R, Math.sin(a * 2) * 0.3, Math.sin(a) * R);
        nodePts.push(p);
        const g = new THREE.Group();
        g.position.copy(p);
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.13 + (i % 3) * 0.016, 0), new THREE.MeshBasicMaterial({ color: bright }));
        const shell = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), new THREE.MeshBasicMaterial({ color: accent, wireframe: true, transparent: true, opacity: 0.8 }));
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.52, 0.005, 6, 44),
          new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        ring.rotation.x = Math.PI / 2;
        ring.rotation.y = i * 0.42;
        const sat = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: bright, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        sat.scale.setScalar(0.22);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: accent, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.scale.setScalar(0.85);
        g.add(core, shell, ring, sat, halo);
        g.scale.setScalar(0.001);
        world.add(g);
        nodes.push({ g, core, shell, ring, sat, halo, baseY: p.y, phase: i, spin: 0.34 + i * 0.05, focus: 0, home: p.clone() });
      }

      // Hub/cage sizes below are v14's own numbers, unchanged (Icosahedron 0.8 / Dodecahedron 1.26 /
      // hubGlow scale 2.2). The old scene here used 0.95 / 1.5 / 4.6 -- more than double the glow
      // sprite alone -- which is the other half of why it read as "one giant ball" instead of a
      // small wireframe hub sitting quietly behind "Satu data usaha".
      const coreGroup = new THREE.Group();
      const hub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), new THREE.MeshBasicMaterial({ color: accent, wireframe: true, transparent: true, opacity: 0.5 }));
      const cage = new THREE.Mesh(new THREE.DodecahedronGeometry(1.26, 0), new THREE.MeshBasicMaterial({ color: accent, wireframe: true, transparent: true, opacity: 0.2 }));
      const hubCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), new THREE.MeshBasicMaterial({ color: bright }));
      const hubGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: accent, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false }));
      hubGlow.scale.setScalar(2.2);
      coreGroup.add(hub, cage, hubCore, hubGlow);
      world.add(coreGroup);

      const grid = new THREE.PolarGridHelper(5.0, N, 4, 72, accent as any, accent as any);
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.13;
      (grid.material as any).blending = THREE.AdditiveBlending;
      (grid.material as THREE.Material).depthWrite = false;
      grid.position.y = -2.3;
      world.add(grid);

      const shardMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, wireframe: true });
      const shards: any[] = [];
      for (let i = 0; i < 9; i++) {
        const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.12 + Math.random() * 0.1, 0), shardMat);
        const a = Math.random() * Math.PI * 2;
        const r = 3.5 + Math.random() * 1.5;
        const up = Math.random() < 0.5 ? -1 : 1;
        m.position.set(Math.cos(a) * r, up * (1.7 + Math.random() * 1.1), Math.sin(a) * r * 0.68);
        const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: bright, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
        glint.scale.setScalar(0.26);
        m.add(glint);
        world.add(m);
        shards.push({ m, glint, sp: 0.18 + Math.random() * 0.5, ph: Math.random() * 6.28, y0: m.position.y });
      }

      const curves: THREE.QuadraticBezierCurve3[] = [];
      const addCurve = (a: THREE.Vector3, b: THREE.Vector3, bulge: number) => {
        const mid = a.clone().add(b).multiplyScalar(0.5).multiplyScalar(bulge);
        curves.push(new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone()));
      };
      for (let i = 0; i < N; i++) {
        addCurve(nodePts[i], nodePts[(i + 1) % N], 1.16);
        addCurve(nodePts[i], nodePts[(i + 3) % N], 0.42);
        addCurve(nodePts[i], new THREE.Vector3(0, 0, 0), 0.9);
      }

      const lineMat = new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
      const lineOp = lineMat.opacity;
      const LINE_SEG = 46;
      const lines = curves.map((c) => {
        const geo = new THREE.BufferGeometry().setFromPoints(c.getPoints(LINE_SEG));
        geo.setDrawRange(0, 2);
        world.add(new THREE.Line(geo, lineMat));
        return geo;
      });

      const TRAIL = 15;
      const pulses = curves.map((c, i) => {
        const arr = new Float32Array(TRAIL * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const mat = new THREE.LineBasicMaterial({ color: bright, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
        world.add(new THREE.Line(geo, mat));
        const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: bright, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
        head.scale.setScalar(0.24);
        world.add(head);
        return { c, geo, arr, mat, head, off: (i * 0.137) % 1, speed: 0.075 + (i % 5) * 0.021, back: i % 3 === 2 };
      });

      const count = 520;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = 3.2 + Math.random() * 5.6;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
        pos[i * 3 + 1] = Math.cos(ph) * r * 0.5;
        pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const dust = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.075, map: tex, color: bright, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
      scene.add(dust);

      const target = { x: 0, y: 0.5 };
      const clock = new THREE.Clock();
      const tmp = new THREE.Vector3();
      let mx = 0,
        my = 0;

      // ---------- pasangOrbit(): faithful port of v14's method of the same name ----------
      // Syncs `world`'s position/scale to the on-screen rect of the HTML [data-orbit] box (the
      // right-column visual, max 520px) so the hub always lands centered under "Satu data usaha"
      // and the orbit radius matches that box's width -- NOT the other way around (the HTML node
      // labels keep their fixed CSS hexagon layout from klirV4Markup.ts; they do not chase the 3D
      // projection, matching v14's own separation of concerns for this port). This is the actual
      // fix for the old "sphere over the CTA" bug: the previous scene positioned `world` at the
      // center of the WIDE [data-hero-canvas] host (which spans both the text column and the visual
      // column), instead of the narrower [data-orbit] box that sits only in the right column.
      let worldBase = { x: 0, y: 0 };
      const pasangOrbit = () => {
        if (!host || !orbitBox) return;
        const a = host.getBoundingClientRect();
        const b = orbitBox.getBoundingClientRect();
        if (!a.width || !a.height || !b.width) return;
        const half = Math.tan(((42 * Math.PI) / 180) / 2) * 9.4;
        const pxPerUnit = a.height / (2 * half);
        const nx = ((b.left + b.width / 2 - a.left) / a.width) * 2 - 1;
        const ny = 1 - ((b.top + b.height / 2 - a.top) / a.height) * 2;
        const halfW = half * (a.width / a.height);
        worldBase = { x: nx * halfW, y: ny * half };
        const jari = (0.5 * Math.min(b.width, b.height)) / pxPerUnit;
        const worldScale = Math.max(0.35, Math.min(1.25, jari / R));
        world.position.x = worldBase.x;
        world.scale.setScalar(worldScale);
      };
      pasangOrbit();

      // ---------- tempelLabel(): faithful port of v14's method of the same name ----------
      // v14's pillar labels are plain HTML divs (the [data-node] elements) that sit dead-center
      // over the WebGL canvas; v14's tempelLabel(gather) (dc.html lines ~1553-1576) re-projects
      // each 3D node's world position onto the [data-orbit] box every frame and overwrites the
      // label's left/top/transform/opacity/zIndex, so the labels visually orbit and converge with
      // the 3D dots. A prior port of this scene left the 6 labels on static hardcoded hexagon CSS
      // percentages and never called this method -- the labels never moved even though the 3D
      // scene behind them animated/gathered. This restores that behavior; klirV4Markup.ts's
      // [data-node] divs were reverted to v14's centered placeholder (left:50%;top:50%) to match,
      // since this function now drives their real position every frame.
      const tiles = Array.from(root!.querySelectorAll<HTMLElement>('[data-orbit] > [data-node]'));
      let obx = { dx: 0, dy: 0, w: 1, h: 1, hw: 1, hh: 1 };
      const ukurOrbit = () => {
        if (!host || !orbitBox) return;
        const a = host.getBoundingClientRect();
        const b = orbitBox.getBoundingClientRect();
        obx = { dx: a.left - b.left, dy: a.top - b.top, w: Math.max(1, b.width), h: Math.max(1, b.height), hw: a.width, hh: a.height };
      };
      ukurOrbit();
      const tempelLabel = (gather: number) => {
        if (!tiles.length) return;
        const fade = 1 - gather * 0.85;
        const rentang = 5 * (world.scale.x || 1);
        for (let i = 0; i < tiles.length; i++) {
          const n = nodes[i];
          if (!n) continue;
          n.g.getWorldPosition(tmp);
          const d = camera.position.distanceTo(tmp);
          tmp.project(camera);
          const sx = (tmp.x * 0.5 + 0.5) * obx.hw + obx.dx;
          const sy = (-tmp.y * 0.5 + 0.5) * obx.hh + obx.dy;
          const dep = Math.max(0, Math.min(1, (9.4 + rentang - d) / (2 * rentang)));
          const el = tiles[i];
          el.style.left = ((sx / obx.w) * 100).toFixed(2) + '%';
          el.style.top = ((sy / obx.h) * 100).toFixed(2) + '%';
          el.style.transform = 'translate(-50%,-50%) scale(' + (0.76 + dep * 0.34).toFixed(3) + ')';
          el.style.opacity = ((0.42 + dep * 0.58) * fade).toFixed(3);
          el.style.zIndex = String(10 + Math.round(dep * 12));
        }
      };
      tempelLabel(0);

      onPointer = (e: PointerEvent) => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        mx = nx;
        my = ny;
        target.x = nx * 1.1;
        target.y = 0.5 - ny * 0.55;
      };
      window.addEventListener('pointermove', onPointer, { passive: true });

      onResizeHero = () => {
        if (!renderer) return;
        const nw = host.clientWidth,
          nh = host.clientHeight;
        if (!nw || !nh) return;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
        pasangOrbit();
        ukurOrbit();
      };
      window.addEventListener('resize', onResizeHero, { passive: true });

      const frame = (t: number, still: boolean) => {
        if (!renderer) return;
        const tt = still ? 0 : t;
        const ease = (x: number) => 1 - Math.pow(1 - x, 3);
        const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
        const intro = still ? 1 : clamp01(tt / 2.2);

        const seg = LINE_SEG + 1;
        lines.forEach((geo, i) => {
          const local = ease(clamp01((intro - 0.2 - (i % 7) * 0.028) / 0.6));
          geo.setDrawRange(0, Math.max(2, Math.round(local * seg)));
        });

        // v14's "gather" cycle: the six pillars pull into the hub, merge briefly, then return --
        // acting out "one system for the whole operation" instead of sitting there as static decor.
        const cyc = still ? 0 : (tt % 15) / 15;
        let gRaw = 0;
        if (cyc > 0.48 && cyc < 0.66) gRaw = (cyc - 0.48) / 0.18;
        else if (cyc >= 0.66 && cyc < 0.78) gRaw = 1;
        else if (cyc >= 0.78 && cyc < 0.93) gRaw = 1 - (cyc - 0.78) / 0.15;
        const gather = gRaw * gRaw * (3 - 2 * gRaw);

        nodes.forEach((n, i) => {
          const pop = ease(clamp01((intro - i * 0.055) / 0.5));
          const want = state.focus === i ? 1 : 0;
          n.focus += (want - n.focus) * 0.12;
          const breathe = 1 + Math.sin(tt * 1.4 + i) * 0.035;
          n.g.scale.setScalar(Math.max(0.001, pop * breathe * (1 + n.focus * 0.4) * (1 - gather * 0.42)));
          const pull = 1 - gather * 0.88;
          n.g.position.x = n.home.x * pull;
          n.g.position.z = n.home.z * pull;
          n.g.position.y = (n.baseY + Math.sin(tt * 0.85 + n.phase) * 0.1) * pull;
          n.shell.rotation.y = tt * 0.5 + i;
          n.shell.rotation.x = tt * 0.3;
          n.ring.rotation.z = tt * n.spin;
          const orbit = tt * (0.75 + i * 0.09) + i;
          n.sat.position.set(Math.cos(orbit) * 0.52, 0, Math.sin(orbit) * 0.52);
          const glow = 0.66 + Math.sin(tt * 1.6 + i * 0.9) * 0.22 + n.focus * 0.32;
          n.halo.material.opacity = glow * 0.34;
          n.halo.scale.setScalar(0.8 + glow * 0.16 + n.focus * 0.3);
          n.ring.material.opacity = 0.36 + n.focus * 0.5;
          n.shell.material.opacity = 0.62 + n.focus * 0.35;
        });

        const hubIn = ease(clamp01(intro / 0.45));
        coreGroup.scale.setScalar(hubIn * (1 + Math.sin(tt * 1.1) * 0.03 + gather * 0.46));
        lineMat.opacity = lineOp * (1 - gather * 0.72);
        coreGroup.rotation.y = -tt * 0.24;
        coreGroup.rotation.x = tt * 0.13;
        (coreGroup.children[1] as THREE.Mesh).rotation.y = tt * 0.4;
        (coreGroup.children[1] as THREE.Mesh).rotation.z = -tt * 0.18;

        shards.forEach((s) => {
          s.m.rotation.x = tt * s.sp;
          s.m.rotation.y = tt * s.sp * 0.7;
          s.m.position.y = s.y0 + Math.sin(tt * 0.5 + s.ph) * 0.36;
          s.glint.material.opacity = (0.3 + Math.abs(Math.sin(tt * 0.7 + s.ph)) * 0.45) * intro;
        });

        pulses.forEach((p) => {
          const base = (tt * p.speed + p.off) % 1;
          for (let j = 0; j < TRAIL; j++) {
            const raw = clamp01(base - j * 0.013);
            p.c.getPoint(p.back ? 1 - raw : raw, tmp);
            p.arr[j * 3] = tmp.x;
            p.arr[j * 3 + 1] = tmp.y;
            p.arr[j * 3 + 2] = tmp.z;
            if (j === 0) p.head.position.copy(tmp);
          }
          (p.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          const vis = (0.3 + Math.sin(base * Math.PI) * 0.62) * intro;
          p.mat.opacity = vis * 0.85;
          p.head.material.opacity = vis;
          p.head.scale.setScalar(0.28 + vis * 0.22);
        });

        dust.rotation.y = tt * 0.016;
        world.rotation.y = tt * 0.075 + state.scrollN * 0.55;
        world.position.y = worldBase.y + state.scrollN * 0.75;

        if (!still) {
          camera.position.x += (target.x - camera.position.x) * 0.045;
          camera.position.y += (target.y - camera.position.y) * 0.045;
          camera.position.z += (9.4 + state.scrollN * 2.6 - camera.position.z) * 0.05;
          camera.lookAt(0, 0, 0);
        }
        camera.updateMatrixWorld();
        renderer.render(scene, camera);
        tempelLabel(gather);
      };

      if (reduce) {
        frame(0, true);
      } else {
        let heroVisible = true;
        const heroIo = new IntersectionObserver((en) => (heroVisible = en[0].isIntersecting), { threshold: 0 });
        heroIo.observe(host);
        heroIoCleanup = () => heroIo.disconnect();
        let slow = 0;
        let lastFrame = performance.now();
        const loop = () => {
          if (!alive.on) return;
          const nowF = performance.now();
          const dt = nowF - lastFrame;
          lastFrame = nowF;
          if (dt > 120) {
            slow++;
            if (slow >= 6) {
              (window as any).__klirDegraded = Math.round(dt);
              tempelLabel(0);
              return;
            }
          } else if (slow) {
            slow--;
          }
          heroRaf = requestAnimationFrame(loop);
          if (!heroVisible) return;
          frame(clock.getElapsedTime(), false);
        };
        loop();
      }

      // ---------- shared WebGL context for the small decorative scenes ----------
      // Browsers cap live WebGL contexts (and this page had 9), so every small scene now draws
      // through ONE offscreen renderer and is blitted into its own 2D canvas. Each scene keeps its
      // own .render(scene, camera) call signature, so the animation loops below are unchanged.
      const SHARED_MAX = 480;
      const GW: any = window;
      const sharedCanvas: HTMLCanvasElement =
        GW.__klirSharedCanvas || (GW.__klirSharedCanvas = document.createElement('canvas'));
      sharedCanvas.width = SHARED_MAX;
      sharedCanvas.height = SHARED_MAX;
      const getShared = () => {
        let sharedGL = GW.__klirSharedGL;
        if (!sharedGL) {
          sharedGL = GW.__klirSharedGL = new THREE.WebGLRenderer({
            canvas: sharedCanvas,
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
            powerPreference: 'low-power',
          });
          sharedGL.setPixelRatio(1);
          sharedGL.setSize(SHARED_MAX, SHARED_MAX, false);
          sharedGL.setClearAlpha(0);
        }
        return sharedGL;
      };
      const makeView = (canvas: HTMLCanvasElement, size: number) => {
        const px = Math.min(Math.round(size), SHARED_MAX);
        canvas.width = px;
        canvas.height = px;
        const ctx = canvas.getContext('2d');
        return {
          canvas,
          render(sc: any, cam: any) {
            TICKS.blits++;
            if (!ctx) return;
            const g = getShared();
            g.setViewport(0, SHARED_MAX - px, px, px);
            g.setScissorTest(true);
            g.setScissor(0, SHARED_MAX - px, px, px);
            g.render(sc, cam);
            g.setScissorTest(false);
            ctx.clearRect(0, 0, px, px);
            ctx.drawImage(sharedCanvas, 0, 0, px, px, 0, 0, px, px);
          },
          setSize() {},
          setPixelRatio() {},
          setClearAlpha() {},
          dispose() {},
        };
      };
      // intentionally not disposed: the singleton outlives remounts so we never allocate a
      // second WebGL context for the decorative scenes.

      // ---------- companion icosahedrons (hero corner / comparison scatter / CTA) ----------
      const hosts = Array.from(root!.querySelectorAll<HTMLCanvasElement>('[data-companion]'));
      const companions: any[] = [];
      hosts.forEach((canvas) => {
        if (getComputedStyle(canvas).display === 'none') return;
        const kind = canvas.getAttribute('data-companion');
        const cta = kind === 'cta';
        const size = cta ? 480 : kind === 'scatter' ? 300 : 340;
        const r = makeView(canvas, size);
        const sc = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        cam.position.set(0, 0, 4.5);
        const geo = new THREE.IcosahedronGeometry(1.2, 1);
        const mat = new THREE.MeshStandardMaterial({
          color: accent,
          emissive: accent,
          emissiveIntensity: cta ? 0.16 : 0.6,
          metalness: 0.3,
          roughness: 0.15,
          transparent: true,
          opacity: cta ? 0.17 : 0.92,
          flatShading: true,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.setScalar(cta ? 1.02 : 1);
        mesh.rotation.y = cta ? Math.PI / 3 : 0;
        const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(GOLD[0] / 255, GOLD[1] / 255, GOLD[2] / 255), transparent: true, opacity: cta ? 0.2 : 0.5 });
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
        const pivot = new THREE.Group();
        pivot.add(mesh);
        sc.add(pivot);
        sc.add(new THREE.AmbientLight(0xffffff, 0.4));
        const l1 = new THREE.PointLight(accent.getHex(), 1.5, 10);
        l1.position.set(2, 2, 3);
        sc.add(l1);
        const l2 = new THREE.PointLight(0xc9a66b, 0.8, 10);
        l2.position.set(-2, -1, 3);
        sc.add(l2);
        r.render(sc, cam);
        const item = { r, sc, cam, mesh, mat, pivot, l1, base: cta ? 0.16 : 0.6, rotY: 0, visible: true, io: null as IntersectionObserver | null };
        const io = { disconnect() {} } as any;
        registerGate(canvas, (near) => {
          item.visible = near;
        });
        item.io = io;
        companions.push(item);
      });
      if (!reduce && companions.length) {
        let lastTick = performance.now();
        const loop2 = () => {
          if (!alive.on) return;
          trackRaf(loop2, requestAnimationFrame(loop2));
          const now = performance.now();
          if (now - lastTick < 50) return;
          const step = Math.min(6, (now - lastTick) / 16.7);
          lastTick = now;
          TICKS.loop2++;
          companions.forEach((c: any) => {
            if (c.io && !c.visible) return;
            c.mesh.rotation.y += 0.0035 * step;
            c.mesh.rotation.x += 0.0015 * step;
            c.mat.emissiveIntensity = c.base - 0.1 + Math.sin(now * 0.001) * 0.15;
            const want = mx * 0.3;
            c.rotY += (want - c.rotY) * 0.05;
            c.pivot.rotation.y = c.rotY;
            c.pivot.rotation.x = my * -0.12;
            c.r.render(c.sc, c.cam);
          });
        };
        loop2();
      }
      disconnects.push(() => companions.forEach((c) => c.io && c.io.disconnect()));
      cleanups.push(() => companions.forEach((c) => c.r.dispose()));

      // ---------- module sigils (feature trio: dokumen bercabang / core AI / hub trigger) ----------
      // Small WebGL glyph per feature card, replacing the flat stroke icons. Pushed into the same
      // `companions` array so loop2 above drives their rotation + emissive pulse and themeScene()
      // desaturates them for light mode along with every other scene.
      const SIG_BLUE = new THREE.Color('#4E9BFF');
      const SIG_GOLD = new THREE.Color(GOLD[0] / 255, GOLD[1] / 255, GOLD[2] / 255);
      Array.from(root!.querySelectorAll<HTMLCanvasElement>('[data-sigil]')).forEach((canvas) => {
        const kind = canvas.getAttribute('data-sigil');
        const r = makeView(canvas, 88);
        const sc = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        cam.position.set(0, 0, 4.4);
        const wire = (g: any, col: any, op: number) =>
          new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op }));
        const mat = new THREE.MeshStandardMaterial({
          color: accent,
          emissive: SIG_BLUE,
          emissiveIntensity: 0.8,
          metalness: 0.3,
          roughness: 0.2,
          transparent: true,
          opacity: 0.95,
          flatShading: true,
        });
        const mesh: any = new THREE.Group();
        if (kind === 'ai') {
          const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), mat);
          const shell = wire(new THREE.IcosahedronGeometry(1.02, 0), SIG_BLUE, 0.55);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.02, 6, 56), new THREE.MeshBasicMaterial({ color: SIG_GOLD, transparent: true, opacity: 0.5 }));
          ring.rotation.x = Math.PI / 2.4;
          mesh.add(core, shell, ring);
        } else if (kind === 'fast') {
          const core = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.06, 4), mat);
          core.rotation.z = -Math.PI / 2;
          const shell = wire(new THREE.OctahedronGeometry(1.06, 0), SIG_BLUE, 0.5);
          const arc = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.018, 6, 44, Math.PI * 1.25), new THREE.MeshBasicMaterial({ color: SIG_GOLD, transparent: true, opacity: 0.45 }));
          mesh.add(core, shell, arc);
        } else if (kind === 'cube') {
          const core = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mat);
          const shell = wire(new THREE.BoxGeometry(1.26, 1.26, 1.26), SIG_BLUE, 0.6);
          const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), new THREE.MeshBasicMaterial({ color: SIG_GOLD }));
          node.position.set(0.63, 0.63, 0.63);
          mesh.add(core, shell, node);
        } else {
          const core = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.92, 0.14), mat);
          const shell = wire(new THREE.BoxGeometry(1.44, 1.72, 0.96), SIG_BLUE, 0.5);
          const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), new THREE.MeshBasicMaterial({ color: SIG_GOLD }));
          node.position.set(0.72, 0.68, 0.4);
          const node2 = node.clone();
          node2.position.set(-0.72, -0.62, 0.4);
          mesh.add(core, shell, node, node2);
        }
        const pivot = new THREE.Group();
        pivot.add(mesh);
        sc.add(pivot);
        sc.add(new THREE.AmbientLight(0xffffff, 0.5));
        const l1 = new THREE.PointLight(accent.getHex(), 1.6, 12);
        l1.position.set(2, 2, 3);
        sc.add(l1);
        const l2 = new THREE.PointLight(0xc9a66b, 0.7, 12);
        l2.position.set(-2, -1.4, 2.4);
        sc.add(l2);
        r.render(sc, cam);
        const item = { r, sc, cam, mesh, mat, pivot, l1, base: 0.8, rotY: 0, visible: true, half: true, io: null as IntersectionObserver | null };
        const io = { disconnect() {} } as any;
        registerGate(canvas, (near) => {
          item.visible = near;
        });
        item.io = io;
        companions.push(item);
      });

      // ---------- 3D dashboard stage ----------
      // [data-stage3d] owns the perspective; [data-tilt3d] rotates the mock as one flat plane
      // (no preserve-3d -- rotating a 1180px preserve-3d subtree re-rasterizes every layer inside
      // it and locks the compositor). Writes are event-driven and throttled to ~11Hz with a CSS
      // transition doing the smoothing, so the layer is fully idle whenever nothing is moving.
      const stage = root!.querySelector<HTMLElement>('[data-stage3d]');
      const tilt = root!.querySelector<HTMLElement>('[data-tilt3d]');
      if (stage && tilt && !reduce) {
        let px = 0;
        let py = 0;
        let cx = 0;
        let cy = 0;
        let entry = 1;
        let ce = 1;
        let vis = true;
        let timer = 0;
        tilt.style.transition = 'transform 280ms cubic-bezier(0.16,1,0.3,1)';
        const io = new IntersectionObserver((en) => {
          vis = en[0].isIntersecting;
          if (vis) kick();
        }, { threshold: 0 });
        io.observe(stage);
        disconnects.push(() => io.disconnect());
        const step = () => {
          timer = 0;
          if (!vis || !alive.on) return;
          cx += (px - cx) * 0.34;
          cy += (py - cy) * 0.34;
          ce += (entry - ce) * 0.34;
          tilt.style.transform =
            'rotateX(' + (1.2 + ce * 5 - cy * 2.2).toFixed(2) + 'deg) rotateY(' + (cx * 3.2).toFixed(2) + 'deg)';
          if (Math.abs(px - cx) > 0.012 || Math.abs(py - cy) > 0.012 || Math.abs(entry - ce) > 0.012) kick();
        };
        const kick = () => {
          if (!timer) timer = window.setTimeout(step, 90);
        };
        cleanups.push(() => window.clearTimeout(timer));
        const measure = () => {
          const b = stage.getBoundingClientRect();
          const vh = window.innerHeight || 1;
          const next = Math.max(0, Math.min(1, 1 - (vh - b.top) / (vh * 0.72)));
          if (Math.abs(next - entry) > 0.01) {
            entry = next;
            kick();
          }
        };
        measure();
        kick();
        const onMove = (ev: MouseEvent) => {
          const b = stage.getBoundingClientRect();
          px = Math.max(-1, Math.min(1, (ev.clientX - (b.left + b.width / 2)) / (b.width / 2)));
          py = Math.max(-1, Math.min(1, (ev.clientY - (b.top + b.height / 2)) / (b.height / 2)));
          kick();
        };
        const onLeave = () => {
          px = 0;
          py = 0;
          kick();
        };
        stage.addEventListener('mousemove', onMove, { passive: true });
        stage.addEventListener('mouseleave', onLeave, { passive: true });
        window.addEventListener('scroll', measure, { passive: true });
        window.addEventListener('resize', measure, { passive: true });
        cleanups.push(() => {
          stage.removeEventListener('mousemove', onMove);
          stage.removeEventListener('mouseleave', onLeave);
          window.removeEventListener('scroll', measure);
          window.removeEventListener('resize', measure);
        });
      }

      // ---------- module sweep across the seven pillar tabs ----------
      const tabs = Array.from(root!.querySelectorAll<HTMLElement>('[data-pillar]'));
      if (tabs.length && !reduce) {
        const base = tabs.map((el) => el.getAttribute('style') || '');
        let i = 0;
        const paint = () => {
          tabs.forEach((el, k) => {
            if (k === i) {
              el.style.borderColor = 'rgba(78,155,255,0.55)';
              el.style.background = 'rgba(0,88,190,0.18)';
              el.style.boxShadow = '0 14px 30px rgba(0,88,190,0.3)';
              el.style.transform = 'translateY(-5px)';
            } else {
              el.setAttribute('style', base[k]);
            }
          });
          i = (i + 1) % tabs.length;
        };
        paint();
        const iv = window.setInterval(paint, 2400);
        cleanups.push(() => window.clearInterval(iv));
      }

      // ---------- price-cell micro-scenes (starter seed / business orbit / enterprise grid) ----------
      // Faithful port of v14's initPriceCells() (dc.html lines ~1703-1853): one small WebGL scene
      // per pricing card, hover-triggered via each card's own mouseenter/mouseleave. Uses v14's own
      // separate gold tone ('#D8A33C', PGOLD below) for business/enterprise, distinct from the hero/
      // companion gold ('#C9A66B' / GOLD const) -- v14 genuinely uses two different golds.
      const HI = new THREE.Color('#4E9BFF');
      const PGOLD = new THREE.Color('#D8A33C');
      const priceCanvases = Array.from(root!.querySelectorAll<HTMLCanvasElement>('[data-price-cell]'));
      const priceCells: any[] = [];
      priceCanvases.forEach((canvas) => {
        const kind = canvas.getAttribute('data-price-cell');
        const key = kind === 'business' || kind === 'enterprise' ? PGOLD : HI;
        const r = makeView(canvas, 228);
        const sc = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
        cam.position.set(0, 0, 4.4);
        const pivot = new THREE.Group();
        sc.add(pivot);
        sc.add(new THREE.AmbientLight(0xffffff, 0.45));
        const pl = new THREE.PointLight(key.getHex(), 1.6, 12);
        pl.position.set(2, 2.4, 3);
        sc.add(pl);
        const pl2 = new THREE.PointLight(accent.getHex(), 0.7, 12);
        pl2.position.set(-2.4, -1.6, 2);
        sc.add(pl2);
        const item: any = { canvas, r, sc, cam, pivot, kind, visible: true, hot: 0, hotWant: 0, spin: 0 };

        if (kind === 'business') {
          const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.56, 0), new THREE.MeshStandardMaterial({ color: PGOLD, emissive: PGOLD, emissiveIntensity: 0.75, roughness: 0.18, metalness: 0.45, flatShading: true }));
          const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.012, 6, 72), new THREE.MeshBasicMaterial({ color: PGOLD, transparent: true, opacity: 0.42 }));
          ring.rotation.x = Math.PI / 2.35;
          const orb = new THREE.Group();
          orb.rotation.x = Math.PI / 2.35;
          const cells: any[] = [];
          for (let i = 0; i < 4; i++) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), new THREE.MeshStandardMaterial({ color: accent, emissive: HI, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.3, flatShading: true }));
            const a = (i / 4) * Math.PI * 2;
            m.position.set(Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0);
            orb.add(m);
            cells.push({ m, a });
          }
          pivot.add(core, ring, orb);
          item.parts = { core, ring, orb, cells };
        } else if (kind === 'enterprise') {
          const nodes: any[] = [];
          const grid = new THREE.Group();
          const mat = new THREE.MeshStandardMaterial({ color: accent, emissive: PGOLD, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.35, flatShading: true });
          const geo = new THREE.OctahedronGeometry(0.19, 0);
          for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
              const m = new THREE.Mesh(geo, mat.clone());
              m.position.set(x * 0.82, y * 0.82, 0);
              grid.add(m);
              nodes.push({ m, d: (x + y + 2) / 4 });
            }
          }
          const pts: THREE.Vector3[] = [];
          for (let i = -1; i <= 1; i++) {
            pts.push(new THREE.Vector3(-0.82, i * 0.82, 0), new THREE.Vector3(0.82, i * 0.82, 0));
            pts.push(new THREE.Vector3(i * 0.82, -0.82, 0), new THREE.Vector3(i * 0.82, 0.82, 0));
          }
          grid.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: PGOLD, transparent: true, opacity: 0.24 })));
          grid.rotation.x = -0.42;
          grid.rotation.y = 0.5;
          pivot.add(grid);
          item.parts = { grid, nodes };
        } else {
          const g = new THREE.IcosahedronGeometry(1.16, 0);
          const shell = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: HI, transparent: true, opacity: 0.62 }));
          const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshStandardMaterial({ color: accent, emissive: HI, emissiveIntensity: 0.85, roughness: 0.2, metalness: 0.3, flatShading: true }));
          const seed = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), new THREE.MeshBasicMaterial({ color: HI, transparent: true, opacity: 0.9 }));
          pivot.add(shell, core, seed);
          item.kind = 'starter';
          item.parts = { shell, core, seed };
        }

        const card = canvas.closest<HTMLElement>('[data-plan]');
        if (card) {
          item.onEnter = () => {
            item.hotWant = 1;
          };
          item.onLeave = () => {
            item.hotWant = 0;
          };
          card.addEventListener('mouseenter', item.onEnter);
          card.addEventListener('mouseleave', item.onLeave);
          item.card = card;
        }
        const pIo = { disconnect() {} } as any;
        registerGate(canvas, (near) => {
          item.visible = near;
        });
        item.io = pIo;
        r.render(sc, cam);
        priceCells.push(item);
      });
      if (!reduce && priceCells.length) {
        const t0p = performance.now();
        let lastP = 0;
        const loop3 = () => {
          if (!alive.on) return;
          trackRaf(loop3, requestAnimationFrame(loop3));
          const now = performance.now();
          if (now - lastP < 66) return;
          lastP = now;
          TICKS.loop3++;
          const t = (now - t0p) / 1000;
          priceCells.forEach((it: any, idx) => {
            if (it.io && !it.visible) return;
            it.hot += (it.hotWant - it.hot) * 0.08;
            const boost = 1 + it.hot * 1.7;
            const p = it.parts;
            if (it.kind === 'business') {
              p.orb.rotation.z += 0.009 * boost;
              p.core.rotation.y += 0.01 * boost;
              p.core.rotation.x += 0.004 * boost;
              p.core.material.emissiveIntensity = 0.6 + Math.sin(t * 1.8) * 0.18 + it.hot * 0.5;
              p.ring.material.opacity = 0.34 + Math.sin(t * 1.4) * 0.08 + it.hot * 0.2;
              p.cells.forEach((c: any, i: number) => {
                const ph = (t * 0.55 + i / 4) % 1;
                const s = 0.8 + Math.max(0, Math.sin(ph * Math.PI * 2)) * 0.55;
                c.m.scale.setScalar(s);
                c.m.material.emissiveIntensity = 0.35 + s * 0.5;
                c.m.rotation.z += 0.02;
              });
            } else if (it.kind === 'enterprise') {
              p.grid.rotation.y = 0.5 + Math.sin(t * 0.42) * 0.28;
              p.grid.rotation.x = -0.42 + Math.sin(t * 0.3) * 0.1;
              p.nodes.forEach((n: any) => {
                const lift = Math.max(0, Math.sin((t * 1.5 - n.d * 2.4) * Math.PI));
                n.m.position.z = lift * 0.34;
                n.m.scale.setScalar(0.85 + lift * 0.55 * boost);
                n.m.material.emissiveIntensity = 0.32 + lift * 0.9 + it.hot * 0.35;
                n.m.rotation.y += 0.012;
              });
            } else {
              const cyc = (t * 0.5) % 1;
              const grow = Math.min(1, cyc / 0.82);
              const resetV = cyc > 0.82 ? 1 - (cyc - 0.82) / 0.18 : 1;
              p.shell.rotation.y += 0.004 * boost;
              p.shell.rotation.x += 0.0016 * boost;
              p.core.rotation.y -= 0.007 * boost;
              p.core.scale.setScalar(0.55 + grow * 0.6 * resetV);
              p.core.material.emissiveIntensity = 0.45 + grow * 0.7 * resetV + it.hot * 0.4;
              p.shell.material.opacity = 0.5 + resetV * 0.2;
              const a = cyc * Math.PI * 2;
              p.seed.position.set(Math.cos(a) * 1.16, Math.sin(a * 1.4) * 0.34, Math.sin(a) * 1.16);
              p.seed.material.opacity = 0.35 + resetV * 0.55;
            }
            const tx = mx * 0.26,
              ty = my * -0.16;
            it.spin += (tx + Math.sin(t * 0.5 + idx) * 0.06 - it.spin) * 0.05;
            it.pivot.rotation.y = it.spin;
            it.pivot.rotation.x = ty;
            it.r.render(it.sc, it.cam);
          });
        };
        loop3();
      }
      disconnects.push(() => priceCells.forEach((c) => c.io && c.io.disconnect()));
      cleanups.push(() =>
        priceCells.forEach((c) => {
          if (c.card && c.onEnter) {
            c.card.removeEventListener('mouseenter', c.onEnter);
            c.card.removeEventListener('mouseleave', c.onLeave);
          }
          c.r.dispose();
        })
      );


      // ---------- themeScene(): faithful port of v14's method of the same name ----------
      // Desaturates every WebGL scene built above (hero `scene`, `companions`, `priceCells`) for
      // light mode: solid meshes fade to near-invisible outlines tinted a deep ink-blue, sprites
      // over a certain size are hidden outright, and each companion/price-cell's emissive color
      // swaps to the same ink tone -- exactly v14's own approach (dc.html lines ~1855-1904), so
      // the 3D layer reads as a quiet line-drawing instead of a bright dark-mode object once the
      // background goes light. Assigned to the outer `themeScene` variable so toggleTheme() (wired
      // above, before this scene existed) can call it on every toggle, and invoked once immediately
      // below if the saved theme was already 'light' on mount.
      const inkLight = new THREE.Color('#093A78');
      const applyThemeToScenes = (light: boolean) => {
        const scenes: THREE.Scene[] = [scene];
        companions.forEach((c) => c.sc && scenes.push(c.sc));
        priceCells.forEach((c) => c.sc && scenes.push(c.sc));
        scenes.forEach((sc) =>
          sc.traverse((o: any) => {
            if (o.isLight) {
              if (o.snapI === undefined) o.snapI = o.intensity;
              o.intensity = light ? o.snapI * (o.isAmbientLight ? 1.15 : 0.7) : o.snapI;
              return;
            }
            const mats: any[] = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
            mats.forEach((m: any) => {
              if (!m.snap) m.snap = { blending: m.blending, transparent: m.transparent, opacity: m.opacity, color: m.color && m.color.clone(), emi: m.emissiveIntensity };
              if (light) {
                if (o.isSprite && o.scale.x > 1.2) {
                  o.visible = false;
                  return;
                }
                m.blending = THREE.NormalBlending;
                m.transparent = true;
                m.opacity = m.emissive ? 0.07 : Math.min(1, m.snap.opacity * 1.5);
                if (m.color) m.color.copy(m.snap.color).lerp(inkLight, m.emissive ? 0.8 : 0.58);
                if (m.emissive) m.emissive.copy(inkLight);
                if (m.snap.emi !== undefined) m.emissiveIntensity = m.snap.emi * 0.3;
              } else {
                if (o.isSprite) o.visible = true;
                m.blending = m.snap.blending;
                m.transparent = m.snap.transparent;
                m.opacity = m.snap.opacity;
                if (m.color) m.color.copy(m.snap.color);
                if (m.snap.emi !== undefined) m.emissiveIntensity = m.snap.emi;
              }
              m.needsUpdate = true;
            });
          })
        );
        companions.forEach((c: any) => {
          if (!c.mat) return;
          if (c.baseDark === undefined) c.baseDark = c.base;
          c.base = light ? 0.2 : c.baseDark;
          if (c.mat.emissive) {
            if (light) c.mat.emissive.copy(inkLight);
            else c.mat.emissive.set(ACCENT);
          }
          c.r.render(c.sc, c.cam);
        });
        priceCells.forEach((c: any) => c.r.render(c.sc, c.cam));
        if (host) host.style.opacity = light ? '0.62' : '1';
        if (renderer && !heroRaf) frame(0, true);
      };
      themeScene = applyThemeToScenes;
      if (theme === 'light') applyThemeToScenes(true);
      cleanups.push(() => {
        themeScene = null;
      });
    })();
    cleanups.push(() => {
      if (heroRaf) cancelAnimationFrame(heroRaf);
      if (heroIoCleanup) heroIoCleanup();
      if (onPointer) window.removeEventListener('pointermove', onPointer);
      if (onResizeHero) window.removeEventListener('resize', onResizeHero);
      if (renderer) {
        const el = renderer.domElement;
        if (el && el.parentNode) el.parentNode.removeChild(el);
        renderer.dispose();
      }
    });


    // ---------- scroll-driven AI sweep across the before/after panel ----------
    // One scroll progress drives everything: a beam crosses the panel, each scattered note it
    // passes resolves (dims + desaturates), the tangle fades, the AI core lifts in at the divider,
    // then the "after" side lights up and its KPI cells stagger. Same rAF-gated sampling as the
    // stack, so it is idle whenever the section is parked or offscreen.
    (function initCompare() {
      if ((window as any).__klirNoCompare) return;
      const panel = root!.querySelector<HTMLElement>('[data-cmp-panel]');
      if (!panel) return;
      const beam = panel.querySelector<HTMLElement>('[data-beam]');
      const core = root!.querySelector<HTMLElement>('[data-ai-core]');
      const tangle = panel.querySelector<HTMLElement>('[data-tangle]');
      const after = panel.querySelector<HTMLElement>('[data-cmp-after]');
      const notes = Array.from(panel.querySelectorAll<HTMLElement>('[data-note]'));
      const cells = Array.from(panel.querySelectorAll<HTMLElement>('[data-after-cell]'));
      const feats = Array.from(root!.querySelectorAll<HTMLElement>('[data-feat]'));
      const tiltEl = root!.querySelector<HTMLElement>('[data-cmp-tilt]');
      const conflicts = Array.from(panel.querySelectorAll<HTMLElement>('[data-conflict]'));
      const stales = notes.map((n) => n.querySelector<HTMLElement>('[data-stale]'));
      const provs = Array.from(panel.querySelectorAll<HTMLElement>('[data-prov]'));
      const seal = panel.querySelector<HTMLElement>('[data-seal]');
      const mess = panel.querySelector<HTMLElement>('[data-mess]');
      const label = panel.querySelector<HTMLElement>('[data-beam-label]');
      let lastLabel = '';
      let lastQ = -1;
      let lastSq = -1;
      const cq: number[] = [];
      const fq: number[] = [];
      const flyers = Array.from(panel.querySelectorAll<HTMLElement>('[data-fly]'));
      const vals = Array.from(panel.querySelectorAll<HTMLElement>('[data-after-val]'));
      let nx: number[] = [];
      let paths: any[] = [];
      const remeasure = () => {
        const pb = panel.getBoundingClientRect();
        nx = notes.map((n) => {
          const b = n.getBoundingClientRect();
          return pb.width ? (b.left + b.width / 2 - pb.left) / pb.width : 0;
        });
        // Quadratic path per flyer: source note -> AI core on the divider -> matching cell.
        paths = flyers.map((f) => {
          const from = notes[parseInt(f.getAttribute('data-fly-from') || '0', 10)];
          const to = cells[parseInt(f.getAttribute('data-fly-to') || '0', 10)];
          const fb = from ? from.getBoundingClientRect() : pb;
          const tb = to ? to.getBoundingClientRect() : pb;
          const w = f.offsetWidth / 2;
          const h = f.offsetHeight / 2;
          return {
            x0: fb.left + fb.width / 2 - pb.left - w,
            y0: fb.top + fb.height / 2 - pb.top - h,
            cx: pb.width / 2 - w,
            cy: 30 - h,
            x1: tb.left + tb.width / 2 - pb.left - w,
            y1: tb.top + tb.height / 2 - pb.top - h,
            launch: pb.width ? (fb.left + fb.width / 2 - pb.left) / pb.width : 0,
          };
        });
      };
      const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
      let lastP = -1;
      const paint = (p: number, force?: boolean) => {
        if (!force && Math.abs(p - lastP) < 0.0025) return;
        lastP = p;
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        const x = clamp(e / 0.55);
        if (beam) {
          beam.style.left = (x * 100).toFixed(2) + '%';
          beam.style.opacity = String(x > 0.995 ? 0 : Math.min(1, x * 6));
        }
        if (tiltEl) tiltEl.style.transform = 'rotateX(' + ((1 - e) * 5).toFixed(2) + 'deg)';
        if (label) {
          const txt = x > 0.995 ? 'selesai' : Math.min(5, Math.ceil(x * 5)) + '/5';
          if (txt !== lastLabel) {
            lastLabel = txt;
            label.textContent = txt;
          }
        }
        notes.forEach((n, i) => {
          const r = clamp((x - (nx[i] || 0)) * 4.5);
          n.style.opacity = (1 - r * 0.46).toFixed(3);
          n.style.filter = 'saturate(' + (1 - r * 0.8).toFixed(2) + ')';
          const st = stales[i];
          if (st) st.style.opacity = (1 - r).toFixed(3);
        });
        let coreHit = 0;
        flyers.forEach((f, i) => {
          const pt = paths[i];
          if (!pt) return;
          const tt = clamp((x - pt.launch) / 0.36);
          const done = tt >= 0.999 || x > 0.995;
          if (tt <= 0.001 || done) {
            f.style.opacity = '0';
            if (done) {
              if (vals[i]) vals[i].style.opacity = '1';
              if (provs[i]) provs[i].style.opacity = '1';
              return;
            }
          } else {
            const u = 1 - tt;
            const fxp = u * u * pt.x0 + 2 * u * tt * pt.cx + tt * tt * pt.x1;
            const fyp = u * u * pt.y0 + 2 * u * tt * pt.cy + tt * tt * pt.y1;
            const s = 1 - Math.sin(tt * Math.PI) * 0.16;
            f.style.transform = 'translate(' + fxp.toFixed(1) + 'px,' + fyp.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
            f.style.opacity = String(Math.min(1, Math.min(tt * 7, (1 - tt) * 7)));
            const near = 1 - Math.abs(tt - 0.5) * 4;
            if (near > coreHit) coreHit = near;
          }
          if (vals[i]) vals[i].style.opacity = String(clamp((tt - 0.78) * 5));
          if (provs[i]) provs[i].style.opacity = String(clamp((tt - 0.84) * 5));
        });
        conflicts.forEach((c, i) => {
          c.style.opacity = String(1 - clamp((x - 0.1 - i * 0.16) * 4));
        });
        if (mess) mess.style.opacity = String(1 - clamp(x * 1.3));
        if (tangle) tangle.style.opacity = (1 - clamp((x - 0.08) * 1.5) * 0.82).toFixed(3);
        const mid = clamp((x - 0.28) / 0.3);
        if (core) {
          core.style.opacity = mid.toFixed(3);
          core.style.transform = 'translate(-50%,0) scale(' + (0.9 + mid * 0.1 + clamp(coreHit) * 0.1).toFixed(3) + ')';
        }
        const late = clamp((e - 0.52) / 0.34);
        if (vals[2]) vals[2].style.opacity = String(clamp((late - 0.2) * 3));
        if (provs[2]) provs[2].style.opacity = String(clamp((late - 0.3) * 3));
        if (seal) {
          const s = clamp((late - 0.5) * 2.6);
          seal.style.opacity = s.toFixed(3);
          seal.style.transform = 'translateY(' + ((1 - s) * 8).toFixed(1) + 'px)';
          const sq = Math.round(s * 10) / 10;
          if (sq !== lastSq) {
            lastSq = sq;
            seal.style.boxShadow = '0 ' + (sq * 14).toFixed(0) + 'px ' + (sq * 32).toFixed(0) + 'px rgba(201,166,107,' + (sq * 0.14).toFixed(3) + ')';
          }
        }
        const q = Math.round(late * 20) / 20;
        if (q !== lastQ) {
          lastQ = q;
          panel.style.boxShadow = '0 0 0 1px rgba(78,155,255,' + (q * 0.16).toFixed(3) + '), 0 28px 70px rgba(0,88,190,' + (q * 0.14).toFixed(3) + ')';
        }
        if (after) after.style.background = 'linear-gradient(180deg, rgba(0,88,190,' + (late * 0.07).toFixed(3) + ') 0%, rgba(0,88,190,0) 78%)';
        cells.forEach((c, i) => {
          const s = clamp((late - i * 0.16) * 2.2);
          c.style.transform = 'translateY(' + ((1 - s) * 9).toFixed(2) + 'px)';
          const sq = Math.round(s * 10) / 10;
          if (cq[i] !== sq) {
            cq[i] = sq;
            c.style.borderColor = 'rgba(78,155,255,' + (0.09 + sq * 0.26).toFixed(3) + ')';
            c.style.boxShadow = '0 ' + (sq * 12).toFixed(0) + 'px ' + (sq * 26).toFixed(0) + 'px rgba(0,0,0,' + (sq * 0.34).toFixed(2) + ')';
          }
        });
        feats.forEach((f, i) => {
          const s = Math.round(clamp((late - 0.3 - i * 0.14) * 2.4) * 8) / 8;
          if (fq[i] === s) return;
          fq[i] = s;
          f.style.boxShadow = 'inset 0 1px 0 rgba(78,155,255,' + (s * 0.3).toFixed(3) + ')';
        });
      };
      if (reduce) {
        remeasure();
        paint(1, true);
        return;
      }
      let vis = true;
      let queued = false;
      let backstop = 0;
      const sample = () => {
        queued = false;
        if (backstop) {
          clearTimeout(backstop);
          backstop = 0;
        }
        if (!alive.on) return;
        const b = panel.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        paint(clamp((vh * 0.84 - b.top) / (vh * 0.6)));
      };
      const onScroll = () => {
        if (!vis || queued) return;
        if (!alive.on) return;
        // queued is set only AFTER a frame is actually scheduled, and a timeout backstop runs
        // sample() if that frame never arrives. Setting it first meant a single dropped frame
        // latched the flag forever, so every later scroll returned early and the scene froze.
        trackRaf(sample, requestAnimationFrame(sample));
        backstop = window.setTimeout(sample, 120);
        queued = true;
      };
      const onResize = () => {
        remeasure();
        sample();
      };
      let settled = false;
      const io = new IntersectionObserver(
        (en) => {
          vis = en[0].isIntersecting;
          if (!vis) return;
          if (!settled) {
            settled = true;
            remeasure();
            lastP = -1;
          }
          onScroll();
        },
        { threshold: 0 }
      );
      io.observe(panel);
      disconnects.push(() => io.disconnect());
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize, { passive: true });
      cleanups.push(() => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
      });
      remeasure();
      sample();
    })();

    // ---------- scroll-driven consolidation: many separate apps -> one subscription ----------
    // Reads each card's authored scatter transform once, then interpolates it toward an aligned
    // row as the section crosses the viewport. Progress is sampled on scroll behind a rAF gate,
    // so it is one transform write per card per frame at most and nothing runs when parked.
    (function initStack() {
      const stage = root!.querySelector<HTMLElement>('[data-stack-stage]');
      if (!stage) return;
      // The last authored card is the payoff ("KLIR - satu langganan"): it is not one of the
      // scattered app cards, so it stays out of the row loop and fades in as they finish aligning.
      const cards = Array.from(stage.querySelectorAll<HTMLElement>('[data-card]:not([data-payoff])'));
      const sum = stage.querySelector<HTMLElement>('[data-payoff]');
      const bills = Array.from(stage.querySelectorAll<HTMLElement>('[data-bill]'));
      if (!cards.length) return;
      // Row pitch and stage height are measured, not hard-coded: on narrow widths the card titles
      // wrap and the cards get taller, so a fixed pitch would overlap them.
      let ROW = 68;
      let SUMH = 66;
      // Authored inline transforms supply the rotation vocabulary only. Their y offsets (~27px
      // apart) are far smaller than the vertical sweep a wide, short card projects when rotated
      // (w*sin + h*cos = 91-170px), so at rest every card covered the left-edge label of the one
      // below it. The scatter is therefore computed from measured geometry, not authored numbers.
      const authored = cards.map((el) => {
        const s = el.style.transform || '';
        const tr = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/.exec(s);
        const ro = /rotate\(\s*(-?[\d.]+)deg/.exec(s);
        return { x: tr ? parseFloat(tr[1]) : 0, y: tr ? parseFloat(tr[2]) : 0, r: ro ? parseFloat(ro[1]) : 0 };
      });
      const from = authored.map((f) => ({ x: f.x, y: f.y, r: f.r }));
      const LANE = [0, 0.66, 0.18, 0.88, 0.34, 0.74, 0.12];
      const remeasure = () => {
        // offsetWidth/Height, not getBoundingClientRect: the cards are rotated at rest and a
        // rotated box's client rect is its bounding box, which would inflate the pitch massively.
        const w = cards[0].offsetWidth || 560;
        const h = cards[0].offsetHeight || 62;
        ROW = Math.round(h + 6);
        if (sum) SUMH = Math.round(sum.offsetHeight || 66);
        const rad = (d: number) => (d * Math.PI) / 180;
        const sweep = Math.max.apply(
          null,
          authored.map((a) => w * Math.abs(Math.sin(rad(a.r))) + h * Math.cos(rad(a.r)))
        );
        // The stage is sized for the SETTLED list, not the at-rest pile: reserving the pile's
        // full height left a large void under the finished list. The pitch is therefore capped
        // near the row height, and the authored rotations are scaled down to match so a card's
        // projected sweep still cannot exceed the pitch and cover a neighbour's label.
        const P = Math.max(ROW, Math.min(Math.round(sweep * 0.8), ROW + 26));
        const maxR = Math.max.apply(null, authored.map((a) => Math.abs(a.r))) || 1;
        const kMax = (Math.asin(Math.min(1, Math.max(0, P - h) / w)) * 180) / Math.PI;
        const k = Math.max(0.25, Math.min(1, kMax / maxR));
        const freeX = Math.max(0, stage.clientWidth - w);
        const A = Math.max(38, freeX / 2);
        authored.forEach((a, i) => {
          from[i].r = a.r * k;
          from[i].x = Math.round((LANE[i % LANE.length] - 0.5) * 2 * A);
          from[i].y = i * P;
        });
        stage.style.height = cards.length * ROW + SUMH + 28 + 'px';
      };
      const settle = (p: number) => {
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        cards.forEach((el, i) => {
          const f = from[i];
          const lead = Math.max(0, Math.min(1, e * 1.35 - i * 0.07));
          const x = f.x * (1 - lead);
          const y = f.y * (1 - lead) + i * ROW * lead;
          const r = f.r * (1 - lead);
          el.style.transform =
            'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + r.toFixed(2) + 'deg)';
          el.style.boxShadow = '0 ' + (10 + lead * 14).toFixed(0) + 'px ' + (26 + lead * 20).toFixed(0) + 'px rgba(0,0,0,' + (0.3 + lead * 0.2).toFixed(2) + ')';
          el.style.zIndex = String(10 - i);
        });
        stage.style.transform = 'rotateX(' + ((1 - e) * 9).toFixed(2) + 'deg) rotateY(' + ((1 - e) * -5).toFixed(2) + 'deg)';
        const late = Math.max(0, Math.min(1, (e - 0.62) / 0.3));
        bills.forEach((b) => (b.style.opacity = String(1 - late)));
        if (sum) {
          sum.style.opacity = String(late);
          sum.style.transform = 'translateY(' + (cards.length * ROW + 20 + (1 - late) * 20).toFixed(0) + 'px)';
          sum.style.boxShadow = '0 ' + (14 + late * 14).toFixed(0) + 'px ' + (34 + late * 22).toFixed(0) + 'px rgba(0,88,190,' + (late * 0.24).toFixed(2) + ')';
        }
      };
      if (sum) sum.style.transition = 'opacity 260ms ease, box-shadow 260ms ease';
      remeasure();
      if (reduce) {
        settle(1);
        return;
      }
      cards.forEach((el) => (el.style.transition = 'box-shadow 300ms ease'));
      let vis = true;
      let queued = false;
      let backstop = 0;
      const sample = () => {
        queued = false;
        if (backstop) {
          clearTimeout(backstop);
          backstop = 0;
        }
        if (!alive.on) return;
        const b = stage.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        settle(Math.max(0, Math.min(1, (vh * 0.86 - b.top) / (vh * 0.58))));
      };
      const onResize = () => {
        remeasure();
        sample();
      };
      const onScroll = () => {
        if (!vis || queued) return;
        if (!alive.on) return;
        // queued is set only AFTER a frame is actually scheduled, and a timeout backstop runs
        // sample() if that frame never arrives. Setting it first meant a single dropped frame
        // latched the flag forever, so every later scroll returned early and the scene froze.
        trackRaf(sample, requestAnimationFrame(sample));
        backstop = window.setTimeout(sample, 120);
        queued = true;
      };
      const io = new IntersectionObserver(
        (en) => {
          vis = en[0].isIntersecting;
          if (vis) onScroll();
        },
        { threshold: 0 }
      );
      io.observe(stage);
      disconnects.push(() => io.disconnect());
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize, { passive: true });
      cleanups.push(() => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
      });
      sample();
    })();

    // ---------- background wireframe glyph behind each section's copy block ----------
    (function initPillars() {
      // Removed at the user's request: the floating wireframe glyph above each pillar eyebrow.
      // Kept in place (rather than deleted) so it can be switched back on in one line.
      if (!(window as any).__klirPillarGlyphs) return;
      const copies = Array.from(root!.querySelectorAll<HTMLElement>('[data-copy]')).filter(
        (el) => !el.hasAttribute('data-no-glyph')
      );
      if (!copies.length || window.innerWidth <= 920) return;
      const still = reduce;
      const A = hexToRgb(ACCENT);
      const L: [number, number, number] = [Math.round(A[0] + (255 - A[0]) * 0.6), Math.round(A[1] + (255 - A[1]) * 0.6), Math.round(A[2] + (255 - A[2]) * 0.6)];
      const G = GOLD;
      const SZ = 330;
      const C = SZ / 2;
      const proj = (x: number, y: number, z: number, ry: number, rx: number, s: number) => {
        const x1 = x * Math.cos(ry) + z * Math.sin(ry);
        const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
        const y1 = y * Math.cos(rx) - z1 * Math.sin(rx);
        const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
        const k = 4.2 / (4.2 + z2);
        return { x: C + x1 * s * k, y: C + y1 * s * k, k };
      };
      const dot = (ctx: CanvasRenderingContext2D, p: { x: number; y: number; k: number }, r: number, col: number[], a: number) => {
        ctx.shadowColor = rgba(col, 0.85);
        ctx.shadowBlur = 12;
        ctx.fillStyle = rgba(col, Math.max(0, a) * p.k);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 1.25 * p.k, 0, 6.2832);
        ctx.fill();
        ctx.shadowBlur = 0;
      };
      const ring = (ctx: CanvasRenderingContext2D, rad: number, yy: number, ry: number, rx: number, s: number, col: number[], a: number, seg?: number) => {
        ctx.shadowColor = rgba(col, 0.6);
        ctx.shadowBlur = 9;
        ctx.strokeStyle = rgba(col, Math.max(0, a));
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        const n = seg || 44;
        for (let k = 0; k <= n; k++) {
          const ang = (k / n) * 6.2832;
          const p = proj(Math.cos(ang) * rad, yy, Math.sin(ang) * rad, ry, rx, s);
          if (k === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      };
      const draw = (it: any, t: number) => {
        const ctx: CanvasRenderingContext2D = it.ctx;
        ctx.clearRect(0, 0, SZ, SZ);
        it.p += ((it.visible ? 1 : 0) - it.p) * 0.045;
        const P = still ? 1 : 1 - Math.pow(1 - Math.min(1, it.p), 3);
        if (P < 0.02) return;
        const ry = t * 0.16 + it.kind;
        const rx = 0.46 + Math.sin(t * 0.22 + it.kind) * 0.1;
        const S = 64;
        const base = 1.05 * P;
        ctx.shadowColor = rgba(A, 0.55);
        ctx.shadowBlur = 8;
        if (it.kind === 0) {
          const spine = [];
          for (let k = 0; k < 7; k++) spine.push(proj(0, 1.5 - k * 0.5, 0, ry, rx, S));
          ctx.strokeStyle = rgba(A, base * 0.75);
          ctx.lineWidth = 2;
          ctx.beginPath();
          spine.forEach((p, k) => {
            if (k === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.stroke();
          for (let k = 1; k < 7; k++) {
            const g = Math.min(1, Math.max(0, P * 7 - k));
            if (g <= 0) continue;
            const side = k % 2 ? 1 : -1;
            const b = proj(side * 1.15 * g, 1.5 - k * 0.5 - 0.18 * g, side * 0.5 * g, ry, rx, S);
            ctx.strokeStyle = rgba(k === 3 ? G : A, base * 0.6 * g);
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(spine[k].x, spine[k].y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            dot(ctx, b, 2.6, k === 3 ? G : L, base * 1.5 * g);
          }
          dot(ctx, spine[0], 3.4, L, base * 1.8);
        } else if (it.kind === 1) {
          for (let k = 0; k < 5; k++) {
            const g = Math.min(1, Math.max(0, P * 5 - k * 0.7));
            if (g <= 0) continue;
            ring(ctx, 1.25 * g, 1.1 - k * 0.55, ry, rx, S, k === 4 ? G : A, base * 0.55 * g);
          }
          const hh = P * 2.4;
          ctx.strokeStyle = rgba(L, base * 0.9);
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          const b0 = proj(0, 1.2, 0, ry, rx, S),
            b1 = proj(0, 1.2 - hh, 0, ry, rx, S);
          ctx.moveTo(b0.x, b0.y);
          ctx.lineTo(b1.x, b1.y);
          ctx.stroke();
          dot(ctx, b1, 3.2, L, base * 1.9);
        } else if (it.kind === 2) {
          const src = proj(0, 0, 0, ry, rx, S);
          for (let k = 0; k < 4; k++) {
            const u = still ? k / 4 : (t * 0.26 + k * 0.25) % 1;
            ring(ctx, 0.35 + u * 2.1, Math.sin(u * 3.1) * 0.12, ry, rx, S, k % 2 ? G : A, base * (1 - u) * 0.8 * P);
          }
          for (let k = 0; k < 5; k++) {
            const ang = (k / 5) * 6.2832 + t * 0.3;
            const p = proj(Math.cos(ang) * 2.15, Math.sin(ang * 2) * 0.4, Math.sin(ang) * 2.15, ry, rx, S);
            ctx.strokeStyle = rgba(A, base * 0.28);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            dot(ctx, p, 2.2, L, base * 1.2);
          }
          dot(ctx, src, 3.6, L, base * 2);
        } else if (it.kind === 3) {
          const NN = 6,
            pts = [];
          for (let k = 0; k < NN; k++) {
            const ang = (k / NN) * 6.2832;
            const yy = Math.sin(ang * 1.5) * 0.7;
            pts.push(proj(Math.cos(ang) * 1.6, yy, Math.sin(ang) * 1.6, ry, rx, S));
          }
          ctx.lineWidth = 1.5;
          for (let a1 = 0; a1 < NN; a1++) {
            for (let b1 = a1 + 1; b1 < NN; b1++) {
              const g = Math.min(1, Math.max(0, P * 2.4 - (a1 + b1) * 0.11));
              if (g <= 0) continue;
              ctx.strokeStyle = rgba(A, base * 0.3 * g);
              ctx.beginPath();
              ctx.moveTo(pts[a1].x, pts[a1].y);
              ctx.lineTo(pts[b1].x, pts[b1].y);
              ctx.stroke();
            }
          }
          pts.forEach((p, k) => {
            const pu = 0.6 + Math.sin(t * 1.5 + k) * 0.35;
            dot(ctx, p, 3 + pu, k === 0 ? G : L, base * 1.5 * pu);
          });
        } else {
          const NN = 6,
            outer = [];
          for (let k = 0; k < NN; k++) {
            const ang = (k / NN) * 6.2832;
            outer.push(proj(Math.cos(ang) * 1.7, Math.sin(ang) * 1.7, 0, ry * 0.4, rx * 0.5, S));
          }
          ctx.strokeStyle = rgba(G, base * 0.6);
          ctx.lineWidth = 2.1;
          ctx.beginPath();
          outer.forEach((p, k) => {
            if (k === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.stroke();
          for (let k = 0; k < NN; k++) {
            const g = Math.min(1, Math.max(0, P * 3 - k * 0.3));
            if (g <= 0) continue;
            const inn = proj(Math.cos((k / NN) * 6.2832) * 0.55 * g, Math.sin((k / NN) * 6.2832) * 0.55 * g, 0.6 * g, ry * 0.4, rx * 0.5, S);
            ctx.strokeStyle = rgba(A, base * 0.5 * g);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(outer[k].x, outer[k].y);
            ctx.lineTo(inn.x, inn.y);
            ctx.stroke();
            dot(ctx, inn, 2, L, base * 1.2 * g);
          }
          const scan = (t * 0.3) % 1;
          ring(ctx, 1.7 * (0.2 + scan * 0.9), 0, ry * 0.4, rx * 0.5, S, L, base * (1 - scan) * 0.7, 6);
        }
      };
      const items: any[] = [];
      copies.forEach((copy, i) => {
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = SZ * dpr;
        canvas.height = SZ * dpr;
        const fade = 'linear-gradient(148deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 34%, rgba(0,0,0,0.35) 56%, rgba(0,0,0,0) 72%)';
        canvas.style.cssText =
          'position:absolute;left:-168px;top:-186px;width:' + SZ + 'px;height:' + SZ + 'px;z-index:-1;pointer-events:none;opacity:0.82;-webkit-mask-image:' + fade + ';mask-image:' + fade + ';';
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        copy.style.position = 'relative';
        copy.style.zIndex = '0';
        copy.insertBefore(canvas, copy.firstChild);
        const it = { ctx, kind: i % 5, p: still ? 1 : 0, visible: still, io: null as IntersectionObserver | null };
        if (!still) {
          it.io = new IntersectionObserver((en) => (it.visible = en[0].isIntersecting), { threshold: 0.15 });
          it.io.observe(copy);
        }
        items.push(it);
      });
      items.forEach((it) => draw(it, 0));
      disconnects.push(() => items.forEach((it) => it.io && it.io.disconnect()));
      if (still) return;
      const tP = performance.now();
      let lastPl = 0;
      const loopPl = () => {
        if (!alive.on) return;
        trackRaf(loopPl, requestAnimationFrame(loopPl));
        const now = performance.now();
        if (now - lastPl < 66) return;
        lastPl = now;
        TICKS.pillars++;
        const tt = (now - tP) / 1000;
        items.forEach((it: any) => {
          if (it.visible || it.p > 0.02) draw(it, tt);
        });
      };
      loopPl();
    })();

    // ---------- spinning wireframe globe behind the reach stat ----------
    (function initReach() {
      const stat = root!.querySelector<HTMLElement>('[data-stat]');
      if (!stat || window.innerWidth <= 920) return;
      const host = stat.parentElement;
      if (!host) return;
      const still = reduce;
      const A = hexToRgb(ACCENT);
      const L: [number, number, number] = [Math.round(A[0] + (255 - A[0]) * 0.62), Math.round(A[1] + (255 - A[1]) * 0.62), Math.round(A[2] + (255 - A[2]) * 0.62)];
      const G = GOLD;
      const W = 1000,
        H = 400,
        CX = W / 2,
        CY = H / 2 + 6,
        S = 132;
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.cssText = 'position:absolute;left:50%;top:-96px;transform:translateX(-50%);width:' + W + 'px;height:' + H + 'px;z-index:-1;pointer-events:none;';
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      host.style.position = 'relative';
      host.style.zIndex = '0';
      host.insertBefore(canvas, host.firstChild);
      const RX = 0.34;
      const sph = (lat: number, lon: number, rad: number, ry: number) => {
        const x = Math.cos(lat) * Math.cos(lon + ry) * rad;
        const z0 = Math.cos(lat) * Math.sin(lon + ry) * rad;
        const y0 = Math.sin(lat) * rad;
        const y = y0 * Math.cos(RX) - z0 * Math.sin(RX);
        const z = y0 * Math.sin(RX) + z0 * Math.cos(RX);
        const k = 4.2 / (4.2 + z);
        return { x: CX + x * S * k, y: CY - y * S * k, d: Math.max(0, Math.min(1, (k - 0.81) / 0.5)) };
      };
      const NODES: any[] = [];
      for (let i = 0; i < 34; i++) {
        const r = Math.sin(i * 12.9898) * 43758.5453;
        const f = r - Math.floor(r);
        const r2 = Math.sin(i * 78.233) * 12345.6789;
        const f2 = r2 - Math.floor(r2);
        NODES.push({ lat: -0.34 + f * 0.62, lon: -1.1 + f2 * 2.5, ph: f * 6.28, hub: i % 11 === 0 });
      }
      const LINKS: any[] = [];
      for (let i = 0; i < 12; i++) {
        LINKS.push({ a: (i * 5) % 34, b: (i * 7 + 3) % 34, off: i * 0.083, sp: 0.1 + (i % 4) * 0.032 });
      }
      let p = still ? 1 : 0.6;
      let visible = true;
      const draw = (t: number) => {
        p += ((visible ? 1 : 0) - p) * 0.04;
        const P = still ? 1 : 1 - Math.pow(1 - Math.min(1, p), 3);
        ctx.clearRect(0, 0, W, H);
        if (P < 0.02) return;
        const ry = still ? 0.4 : t * 0.062;
        const atm = ctx.createRadialGradient(CX, CY, S * 0.52, CX, CY, S * 1.62);
        atm.addColorStop(0, rgba(A, 0.26 * P));
        atm.addColorStop(0.52, rgba(A, 0.11 * P));
        atm.addColorStop(1, rgba(A, 0));
        ctx.fillStyle = atm;
        ctx.beginPath();
        ctx.arc(CX, CY, S * 1.62, 0, 6.2832);
        ctx.fill();
        ctx.strokeStyle = rgba(L, 0.36 * P);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(CX, CY, S, 0, 6.2832);
        ctx.stroke();
        ctx.lineWidth = 1;
        for (let li = -3; li <= 3; li++) {
          const lat = li * 0.28;
          for (let k = 0; k < 60; k++) {
            const p1 = sph(lat, (k / 60) * 6.2832, 1, ry);
            const p2 = sph(lat, ((k + 1) / 60) * 6.2832, 1, ry);
            ctx.strokeStyle = rgba(A, 0.28 * p1.d * P);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
        for (let mi = 0; mi < 14; mi++) {
          const lon = (mi / 14) * 6.2832;
          for (let k = 0; k < 28; k++) {
            const p1 = sph(-1.5 + (k / 28) * 3, lon, 1, ry);
            const p2 = sph(-1.5 + ((k + 1) / 28) * 3, lon, 1, ry);
            ctx.strokeStyle = rgba(A, 0.2 * p1.d * P);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
        LINKS.forEach((ln) => {
          const a = NODES[ln.a],
            b = NODES[ln.b];
          const steps = 26;
          ctx.strokeStyle = rgba(A, 0.22 * P);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          const pts: any[] = [];
          for (let k = 0; k <= steps; k++) {
            const u = k / steps;
            const lift = 1 + Math.sin(u * Math.PI) * 0.3;
            const q = sph(a.lat + (b.lat - a.lat) * u, a.lon + (b.lon - a.lon) * u, lift, ry);
            pts.push(q);
            if (k === 0) ctx.moveTo(q.x, q.y);
            else ctx.lineTo(q.x, q.y);
          }
          ctx.stroke();
          if (still) return;
          const head = (t * ln.sp + ln.off) % 1;
          for (let j = 0; j < 15; j++) {
            const u = head - j * 0.016;
            if (u <= 0 || u >= 1) continue;
            const q = pts[Math.round(u * steps)];
            if (!q) continue;
            ctx.shadowColor = rgba(L, 0.9);
            ctx.shadowBlur = 11;
            ctx.fillStyle = rgba(L, (1 - j / 15) * 0.9 * P);
            ctx.beginPath();
            ctx.arc(q.x, q.y, Math.max(0.4, 2.5 - j * 0.15), 0, 6.2832);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        });
        NODES.forEach((n, i) => {
          const g = Math.min(1, Math.max(0, P * 2.2 - i * 0.03));
          if (g <= 0) return;
          const q = sph(n.lat, n.lon, 1.01, ry);
          const pulse = 0.55 + Math.sin(t * 1.5 + n.ph) * 0.4;
          const col = n.hub ? G : L;
          ctx.shadowColor = rgba(col, 0.85);
          ctx.shadowBlur = n.hub ? 16 : 10;
          ctx.fillStyle = rgba(col, (0.32 + pulse * 0.55) * q.d * g);
          ctx.beginPath();
          ctx.arc(q.x, q.y, (n.hub ? 3.4 : 2) * (0.75 + q.d * 0.5), 0, 6.2832);
          ctx.fill();
          ctx.shadowBlur = 0;
          if (n.hub && !still) {
            const rp = (t * 0.34 + n.ph) % 1;
            ctx.strokeStyle = rgba(G, (1 - rp) * 0.42 * q.d * g);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(q.x, q.y, 3.4 + rp * 19, 0, 6.2832);
            ctx.stroke();
          }
        });
      };
      if (!still) {
        const io = new IntersectionObserver((en) => (visible = en[0].isIntersecting), { threshold: 0.1 });
        io.observe(host);
        disconnects.push(() => io.disconnect());
      }
      draw(0);
      if (still) return;
      let raf = 0;
      let lastR = 0;
      let slowR = 0;
      const tR = performance.now();
      const loopR = () => {
        if (!alive.on) return;
        raf = requestAnimationFrame(loopR);
        const now = performance.now();
        if (now - lastR < 40) return;
        lastR = now;
        if (!visible && p < 0.02) return;
        const d0 = performance.now();
        draw((now - tR) / 1000);
        TICKS.reach++;
        const cost = performance.now() - d0;
        if (cost > 26) {
          slowR++;
          if (slowR >= 8) {
            cancelAnimationFrame(raf);
            (window as any).__klirReachStopped = Math.round(cost);
          }
        } else if (slowR) {
          slowR--;
        }
      };
      loopR();
      cleanups.push(() => cancelAnimationFrame(raf));
    })();

    // ---------- pointer parallax for the 3D document stage ----------
    // Written straight from the pointermove event, not through rAF: this iframe's frame clock can
    // stall, and a tilt that only updates on a frame would simply never move.
    (function initTilt() {
      const tilts = Array.from(root!.querySelectorAll<HTMLElement>('[data-tilt]'));
      tilts.forEach((el) => {
        const stage = el.closest('[data-tilt-stage]') as HTMLElement | null;
        if (!stage) return;
        const base = el.getAttribute('data-tilt-base') || '';
        if (reduce) return;
        const onMove = (e: PointerEvent) => {
          const b = stage.getBoundingClientRect();
          if (!b.width || !b.height) return;
          const px = (e.clientX - b.left) / b.width - 0.5;
          const py = (e.clientY - b.top) / b.height - 0.5;
          el.style.transition = 'transform 140ms linear, border-color 340ms ease';
          el.style.transform =
            'rotateY(' + (-px * 9 - 1.5).toFixed(2) + 'deg) rotateX(' + (py * 7 + 0.6).toFixed(2) + 'deg) translateZ(16px)';
        };
        const onLeave = () => {
          el.style.transition = 'transform 520ms cubic-bezier(0.16,1,0.3,1), border-color 340ms ease';
          el.style.transform = base;
        };
        stage.addEventListener('pointermove', onMove);
        stage.addEventListener('pointerleave', onLeave);
        cleanups.push(() => {
          stage.removeEventListener('pointermove', onMove);
          stage.removeEventListener('pointerleave', onLeave);
        });
      });
    })();

    // ---------- testimonial avatar polyhedra + card tilt ----------
    (function initQuotes() {
      // Explicit hook first: the old detector matched a 34px dashed circle by computed style, so
      // any restyle of the avatar frame silently dropped the 3D polyhedron.
      let avatars = Array.from(root!.querySelectorAll<HTMLElement>('[data-avatar]'));
      if (!avatars.length) {
        avatars = Array.from(root!.querySelectorAll<HTMLElement>('div')).filter((d) => {
          const cs = getComputedStyle(d);
          return cs.borderTopStyle === 'dashed' && Math.round(parseFloat(cs.width)) === 34 && Math.round(parseFloat(cs.height)) === 34 && parseFloat(cs.borderTopLeftRadius) > 0;
        });
      }
      if (!avatars.length) return;
      const still = reduce;
      const A = hexToRgb(ACCENT);
      const L: [number, number, number] = [Math.round(A[0] + (255 - A[0]) * 0.62), Math.round(A[1] + (255 - A[1]) * 0.62), Math.round(A[2] + (255 - A[2]) * 0.62)];
      const G = GOLD;
      const TETRA = { v: [[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]], e: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]] };
      const SHAPES = [TETRA];
      const SZ = 44,
        C = SZ / 2;
      const items: any[] = [];
      avatars.forEach((av, i) => {
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = SZ * dpr;
        canvas.height = SZ * dpr;
        canvas.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:' + SZ + 'px;height:' + SZ + 'px;pointer-events:none;';
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        av.style.position = 'relative';
        av.style.overflow = 'visible';
        av.appendChild(canvas);
        const it = { ctx, shape: SHAPES[i % SHAPES.length], seed: i * 1.7, boost: 0, want: 0, visible: still, io: null as IntersectionObserver | null };
        if (!still) {
          it.io = new IntersectionObserver((en) => (it.visible = en[0].isIntersecting), { threshold: 0 });
          it.io.observe(av);
        }
        items.push(it);
      });
      const proj = (v: number[], ry: number, rx: number, s: number) => {
        const x1 = v[0] * Math.cos(ry) + v[2] * Math.sin(ry);
        const z1 = -v[0] * Math.sin(ry) + v[2] * Math.cos(ry);
        const y1 = v[1] * Math.cos(rx) - z1 * Math.sin(rx);
        const z2 = v[1] * Math.sin(rx) + z1 * Math.cos(rx);
        const k = 3.4 / (3.4 + z2);
        return { x: C + x1 * s * k, y: C + y1 * s * k, k };
      };
      const draw = (it: any, t: number) => {
        const ctx: CanvasRenderingContext2D = it.ctx;
        ctx.clearRect(0, 0, SZ, SZ);
        it.boost += (it.want - it.boost) * 0.09;
        const tt = t * (1 + it.boost * 1.5) + it.seed;
        const ry = tt * 0.42,
          rx = Math.sin(tt * 0.27) * 0.45 + 0.3;
        const s = 8 * (1 + it.boost * 0.14);
        const pts = it.shape.v.map((v: number[]) => proj(v, ry, rx, s));
        const g = ctx.createRadialGradient(C, C, 0, C, C, 15);
        g.addColorStop(0, rgba(L, 0.26 + it.boost * 0.2));
        g.addColorStop(1, rgba(L, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(C, C, 15, 0, 6.2832);
        ctx.fill();
        ctx.shadowColor = rgba(A, 0.8);
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.3;
        it.shape.e.forEach((e: number[]) => {
          const p1 = pts[e[0]],
            p2 = pts[e[1]];
          ctx.strokeStyle = rgba(A, 0.45 + (p1.k - 0.85) * 0.9 + it.boost * 0.3);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        });
        ctx.shadowBlur = 0;
        pts.forEach((p: any, k: number) => {
          ctx.shadowColor = rgba(k === 0 ? G : L, 0.9);
          ctx.shadowBlur = 9;
          ctx.fillStyle = rgba(k === 0 ? G : L, 0.5 + (p.k - 0.85) * 1.1 + it.boost * 0.25);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.5 * p.k, 0, 6.2832);
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      };
      items.forEach((it) => draw(it, still ? 1.2 : 0));
      disconnects.push(() => items.forEach((it) => it.io && it.io.disconnect()));
      if (still) return;
      const tA = performance.now();
      let lastAv = 0;
      const loopAv = () => {
        if (!alive.on) return;
        trackRaf(loopAv, requestAnimationFrame(loopAv));
        const now = performance.now();
        if (now - lastAv < 66) return;
        lastAv = now;
        TICKS.avatars++;
        const tt = (now - tA) / 1000;
        items.forEach((it: any) => {
          if (it.visible) draw(it, tt);
        });
      };
      loopAv();
    })();

    return () => {
      alive.on = false;
      rafs.forEach((id) => cancelAnimationFrame(id));
      rafMap.forEach((id) => cancelAnimationFrame(id));
      rafMap.clear();
      disconnects.forEach((fn) => fn());
      cleanups.forEach((fn) => fn());
    };
  }, [onQuickDemo, onOpenAuth]);

  return <div ref={rootRef} dangerouslySetInnerHTML={{ __html: KLIR_V4_MARKUP }} />;
}
