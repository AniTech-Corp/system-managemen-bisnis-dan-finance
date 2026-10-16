'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

const ACCENT = { r: 0, g: 88, b: 190 };
const LIGHT = { r: 158, g: 194, b: 232 };
const GOLD = { r: 201, g: 166, b: 107 };
const rgba = (c: { r: number; g: number; b: number }, a: number) =>
  `rgba(${c.r},${c.g},${c.b},${Math.max(0, Math.min(1, a))})`;

/**
 * Wires up scroll-reveal ([data-reveal]) and pointer-tilt ([data-tilt]) behaviour
 * for the public landing view only. Purely presentational — does not touch any
 * auth/API/state logic. Call once with `!isAuthenticated`.
 */
export function useLandingFX(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const revealEls = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const show = (el: HTMLElement) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    };
    let io: IntersectionObserver | null = null;
    let failsafe: ReturnType<typeof setTimeout> | null = null;
    if (reduce || !('IntersectionObserver' in window)) {
      revealEls.forEach(show);
    } else {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              show(entry.target as HTMLElement);
              io!.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
      revealEls.forEach((el) => io!.observe(el));
      failsafe = setTimeout(() => revealEls.forEach(show), 3500);
    }

    const tiltEls = Array.from(document.querySelectorAll<HTMLElement>('[data-tilt]'));
    const cleanups: Array<() => void> = [];
    if (!reduce) {
      tiltEls.forEach((card) => {
        const parent = card.parentElement;
        if (parent) parent.style.perspective = '1400px';
        card.style.position = card.style.position || 'relative';

        const sheen = document.createElement('div');
        sheen.setAttribute('aria-hidden', 'true');
        sheen.style.cssText =
          'position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity 220ms ease;z-index:5;';
        card.appendChild(sheen);

        let raf = 0;
        let tx = 0, ty = 0, cx = 0, cy = 0;
        const baseTransition = card.style.transition;
        const run = () => {
          cx += (tx - cx) * 0.14;
          cy += (ty - cy) * 0.14;
          card.style.transform = `rotateY(${(cx * 5).toFixed(2)}deg) rotateX(${(-cy * 5).toFixed(2)}deg) translateZ(6px)`;
          if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(run);
          else raf = 0;
        };
        const kick = () => { if (!raf) raf = requestAnimationFrame(run); };
        const onEnter = () => {
          card.style.transition = 'border-color 180ms ease';
          sheen.style.opacity = '1';
        };
        const onMove = (e: PointerEvent) => {
          const r = card.getBoundingClientRect();
          tx = (e.clientX - r.left) / r.width - 0.5;
          ty = (e.clientY - r.top) / r.height - 0.5;
          sheen.style.background = `radial-gradient(420px circle at ${((tx + 0.5) * 100).toFixed(1)}% ${((ty + 0.5) * 100).toFixed(1)}%, rgba(78,155,255,0.13), rgba(201,166,107,0.05) 40%, transparent 68%)`;
          kick();
        };
        const onLeave = () => {
          tx = 0; ty = 0;
          sheen.style.opacity = '0';
          kick();
          setTimeout(() => { card.style.transition = baseTransition; }, 420);
        };

        card.addEventListener('pointerenter', onEnter);
        card.addEventListener('pointermove', onMove);
        card.addEventListener('pointerleave', onLeave);
        cleanups.push(() => {
          card.removeEventListener('pointerenter', onEnter);
          card.removeEventListener('pointermove', onMove);
          card.removeEventListener('pointerleave', onLeave);
          if (raf) cancelAnimationFrame(raf);
          sheen.remove();
        });
      });
    }

    return () => {
      if (io) io.disconnect();
      if (failsafe) clearTimeout(failsafe);
      cleanups.forEach((fn) => fn());
    };
  }, [active]);
}

/** Four pulsing corner brackets — HUD accent for the hero section. */
export function HudCorners() {
  const c = 'rgba(201,166,107,0.55)';
  const base: CSSProperties = { position: 'absolute', width: 20, height: 20, pointerEvents: 'none', zIndex: 4 };
  return (
    <>
      <span style={{ ...base, top: 18, left: 18, borderTop: `1px solid ${c}`, borderLeft: `1px solid ${c}`, borderRadius: '4px 0 0 0', animation: 'klirHudPulse 3s ease-in-out infinite' }} />
      <span style={{ ...base, top: 18, right: 18, borderTop: `1px solid ${c}`, borderRight: `1px solid ${c}`, borderRadius: '0 4px 0 0', animation: 'klirHudPulse 3s ease-in-out infinite 0.5s' }} />
      <span style={{ ...base, bottom: 18, left: 18, borderBottom: `1px solid ${c}`, borderLeft: `1px solid ${c}`, borderRadius: '0 0 0 4px', animation: 'klirHudPulse 3s ease-in-out infinite 1s' }} />
      <span style={{ ...base, bottom: 18, right: 18, borderBottom: `1px solid ${c}`, borderRight: `1px solid ${c}`, borderRadius: '0 0 4px 0', animation: 'klirHudPulse 3s ease-in-out infinite 1.5s' }} />
    </>
  );
}

/**
 * Dependency-free canvas-2D hero visual: three module nodes (CorPlan,
 * AniVirtual, Workflows) orbiting a shared hub, linked by light-trails —
 * the Workflows engine's own trigger-to-action idea, made visible.
 * No three.js / no new npm dependency. Absolutely positioned, z-index 0,
 * pointer-events none — sits behind the existing hero content untouched.
 */
export function NexusHero() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const host = canvas.parentElement;
    if (!host) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 0, H = 0;
    const fit = () => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();

    const NODES = [
      { a: -2.35 },
      { a: -0.35 },
      { a: 1.85 },
    ];
    const RX = 0.36;
    const proj = (x: number, y: number, z: number, ry: number, s: number, cx: number, cy: number) => {
      const x1 = x * Math.cos(ry) + z * Math.sin(ry);
      const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
      const y1 = y * Math.cos(RX) - z1 * Math.sin(RX);
      const z2 = y * Math.sin(RX) + z1 * Math.cos(RX);
      const k = 4.4 / (4.4 + z2);
      return { x: cx + x1 * s * k, y: cy + y1 * s * k, k };
    };

    let visible = true;
    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0 });
      io.observe(canvas);
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H * 0.46, s = Math.min(W, H) * 0.2;
      const ry = t * 0.12;

      const pts = NODES.map((n) => proj(Math.cos(n.a) * 2.1, Math.sin(n.a * 1.4) * 0.5, Math.sin(n.a) * 2.1, ry, s, cx, cy));
      const hub = proj(0, 0, 0, ry, s, cx, cy);

      pts.forEach((p, i) => {
        ctx.strokeStyle = rgba(ACCENT, 0.22 * p.k);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        if (!reduce) {
          const u = (t * (0.12 + i * 0.03) + i * 0.33) % 1;
          const qx = hub.x + (p.x - hub.x) * u;
          const qy = hub.y + (p.y - hub.y) * u;
          ctx.shadowColor = rgba(LIGHT, 0.9);
          ctx.shadowBlur = 10;
          ctx.fillStyle = rgba(LIGHT, 0.85 * p.k);
          ctx.beginPath();
          ctx.arc(qx, qy, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      ctx.shadowColor = rgba(GOLD, 0.7);
      ctx.shadowBlur = 14;
      ctx.fillStyle = rgba(LIGHT, 0.9);
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba(GOLD, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, 12, 0, Math.PI * 2);
      ctx.stroke();

      pts.forEach((p) => {
        const pulse = 0.6 + Math.sin(t * 1.3) * 0.3;
        ctx.shadowColor = rgba(ACCENT, 0.85);
        ctx.shadowBlur = 16 * p.k;
        ctx.fillStyle = rgba(ACCENT, (0.5 + pulse * 0.4) * p.k);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.5 * p.k, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba(ACCENT, 0.4 * p.k);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11 * p.k, 0, Math.PI * 2);
        ctx.stroke();
      });
    };

    let raf = 0;
    const t0 = performance.now();
    draw(0);
    if (!reduce) {
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (visible) draw((performance.now() - t0) / 1000);
      };
      loop();
    }

    const onResize = () => { fit(); draw(reduce ? 0 : (performance.now() - t0) / 1000); };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (io) io.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const wrap: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 640,
    zIndex: 0,
    pointerEvents: 'none',
    WebkitMaskImage: 'radial-gradient(120% 70% at 50% 30%, #000 45%, transparent 85%)',
    maskImage: 'radial-gradient(120% 70% at 50% 30%, #000 45%, transparent 85%)',
  };
  return (
    <div aria-hidden="true" style={wrap}>
      <canvas ref={ref} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}

/**
 * Small wireframe crystal behind each feature module's heading —
 * a distinct shape per module (0 = CorPlan, 1 = AniVirtual, 2 = Workflows).
 */
export function SectionSigil({ kind }: { kind: 0 | 1 | 2 }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const SZ = 120;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SZ * dpr;
    canvas.height = SZ * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const C = SZ / 2;

    const proj = (x: number, y: number, z: number, ry: number, rx: number, s: number) => {
      const x1 = x * Math.cos(ry) + z * Math.sin(ry);
      const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
      const y1 = y * Math.cos(rx) - z1 * Math.sin(rx);
      const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
      const k = 4 / (4 + z2);
      return { x: C + x1 * s * k, y: C + y1 * s * k, k };
    };

    let visible = true;
    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: 0.1 });
      io.observe(canvas);
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, SZ, SZ);
      const ry = t * 0.3, rx = 0.4 + Math.sin(t * 0.2) * 0.1;
      const s = 26;

      if (kind === 0) {
        const spine: Array<{ x: number; y: number; k: number }> = [];
        for (let i = 0; i < 6; i++) spine.push(proj(0, 1.4 - i * 0.56, 0, ry, rx, s));
        ctx.strokeStyle = rgba(ACCENT, 0.5);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        spine.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.stroke();
        spine.forEach((p, i) => {
          const side = i % 2 ? 1 : -1;
          const b = proj(side * 0.9, 1.4 - i * 0.56 - 0.14, side * 0.4, ry, rx, s);
          ctx.strokeStyle = rgba(i === 3 ? GOLD : ACCENT, 0.35);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.fillStyle = rgba(i === 3 ? GOLD : LIGHT, 0.7);
          ctx.beginPath(); ctx.arc(b.x, b.y, 1.8, 0, 6.283); ctx.fill();
        });
      } else if (kind === 1) {
        for (let i = 0; i < 3; i++) {
          const rad = 0.5 + i * 0.4;
          ctx.strokeStyle = rgba(i === 2 ? GOLD : ACCENT, 0.32);
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let a = 0; a <= 32; a++) {
            const ang = (a / 32) * 6.283;
            const p = proj(Math.cos(ang) * rad, Math.sin(ang * 1.6) * 0.25, Math.sin(ang) * rad, ry + i, rx, s);
            if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
        const pulse = 0.6 + Math.sin(t * 2) * 0.3;
        const hub = proj(0, 0, 0, ry, rx, s);
        ctx.shadowColor = rgba(LIGHT, 0.9);
        ctx.shadowBlur = 10 * pulse;
        ctx.fillStyle = rgba(LIGHT, 0.8);
        ctx.beginPath(); ctx.arc(hub.x, hub.y, 3, 0, 6.283); ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        const nodes = [proj(-1.3, -0.3, 0, ry, rx, s), proj(1.3, 0.3, 0, ry, rx, s)];
        const hub = proj(0, 0, 0, ry, rx, s);
        nodes.forEach((n, i) => {
          ctx.strokeStyle = rgba(ACCENT, 0.4);
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(hub.x, hub.y); ctx.lineTo(n.x, n.y); ctx.stroke();
          if (!reduce) {
            const u = (t * 0.5 + i * 0.5) % 1;
            const qx = hub.x + (n.x - hub.x) * u, qy = hub.y + (n.y - hub.y) * u;
            ctx.shadowColor = rgba(LIGHT, 0.9);
            ctx.shadowBlur = 8;
            ctx.fillStyle = rgba(LIGHT, 0.8);
            ctx.beginPath(); ctx.arc(qx, qy, 1.8, 0, 6.283); ctx.fill();
            ctx.shadowBlur = 0;
          }
          ctx.fillStyle = rgba(i === 0 ? GOLD : ACCENT, 0.6);
          ctx.beginPath(); ctx.arc(n.x, n.y, 3, 0, 6.283); ctx.fill();
        });
      }
    };

    let raf = 0;
    const t0 = performance.now();
    draw(0);
    if (!reduce) {
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (visible) draw((performance.now() - t0) / 1000);
      };
      loop();
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (io) io.disconnect();
    };
  }, [kind]);

  const style: CSSProperties = {
    position: 'absolute', left: '50%', top: -18, transform: 'translateX(-50%)',
    width: 120, height: 120, zIndex: 0, pointerEvents: 'none', opacity: 0.8,
  };
  return <canvas ref={ref} aria-hidden="true" style={style} />;
}

type FlowPath = {
  p0: { x: number; y: number }; p1: { x: number; y: number };
  p2: { x: number; y: number }; p3: { x: number; y: number }; off: number;
};

/**
 * Light-trail connectors drawn between the CorPlan / AniVirtual / Workflows
 * sections (matched by their existing element ids) — a single full-height
 * overlay on the landing root, desktop only. Mount once.
 */
export function FlowConnectors() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const host = canvas.parentElement;
    if (!host) return;
    if (window.innerWidth <= 920) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ids = ['corplan-section', 'anivirtual-section', 'workflows-section'];
    let W = 0, H = 0;
    let paths: FlowPath[] = [];

    const measure = () => {
      const hostRect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hostRect.width;
      H = hostRect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const rects = ids.map((id) => document.getElementById(id)?.getBoundingClientRect());
      paths = [];
      for (let i = 0; i < rects.length - 1; i++) {
        const a = rects[i], b = rects[i + 1];
        if (!a || !b) continue;
        const p0 = { x: a.left - hostRect.left + a.width / 2, y: a.bottom - hostRect.top };
        const p3 = { x: b.left - hostRect.left + b.width / 2, y: b.top - hostRect.top };
        const dy = p3.y - p0.y;
        paths.push({ p0, p1: { x: p0.x, y: p0.y + dy * 0.5 }, p2: { x: p3.x, y: p3.y - dy * 0.5 }, p3, off: i * 0.3 });
      }
    };

    const at = (p: FlowPath, u: number) => {
      const v = 1 - u;
      return {
        x: v * v * v * p.p0.x + 3 * v * v * u * p.p1.x + 3 * v * u * u * p.p2.x + u * u * u * p.p3.x,
        y: v * v * v * p.p0.y + 3 * v * v * u * p.p1.y + 3 * v * u * u * p.p2.y + u * u * u * p.p3.y,
      };
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      paths.forEach((p) => {
        ctx.strokeStyle = rgba(ACCENT, 0.22);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const q = at(p, i / 40);
          if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();

        const mid = at(p, 0.5);
        const ry = t * 0.4 + p.off, rx = 0.5;
        const proj3 = (x: number, y: number, z: number) => {
          const x1 = x * Math.cos(ry) + z * Math.sin(ry);
          const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
          const y1 = y * Math.cos(rx) - z1 * Math.sin(rx);
          return { x: mid.x + x1 * 9, y: mid.y + y1 * 9 };
        };
        const raw: number[][] = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
        const verts = raw.map((v) => proj3(v[0], v[1], v[2]));
        const edges: Array<[number, number]> = [[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[2,5],[3,4],[3,5]];
        ctx.strokeStyle = rgba(GOLD, 0.45);
        ctx.lineWidth = 1;
        ctx.beginPath();
        edges.forEach(([a, b]) => { ctx.moveTo(verts[a].x, verts[a].y); ctx.lineTo(verts[b].x, verts[b].y); });
        ctx.stroke();

        if (!reduce) {
          const u = (t * 0.15 + p.off) % 1;
          const q = at(p, u);
          ctx.shadowColor = rgba(LIGHT, 0.9);
          ctx.shadowBlur = 10;
          ctx.fillStyle = rgba(LIGHT, 0.85);
          ctx.beginPath(); ctx.arc(q.x, q.y, 2.4, 0, 6.283); ctx.fill();
          ctx.shadowBlur = 0;
        }
      });
    };

    measure();
    draw(0);
    const settle = setTimeout(() => { measure(); draw(0); }, 1200);

    let visible = true;
    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: 0 });
      io.observe(host);
    }

    let raf = 0;
    const t0 = performance.now();
    if (!reduce) {
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (visible) draw((performance.now() - t0) / 1000);
      };
      loop();
    }

    const onResize = () => { measure(); draw(0); };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      clearTimeout(settle);
      if (raf) cancelAnimationFrame(raf);
      if (io) io.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const style: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' };
  return <canvas ref={ref} aria-hidden="true" style={style} />;
}
