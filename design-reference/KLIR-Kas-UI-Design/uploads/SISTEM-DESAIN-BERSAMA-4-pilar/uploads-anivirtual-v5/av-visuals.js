(function () {
  if (window.__avVisuals) return;
  window.__avVisuals = true;

  var WHITE = [255, 255, 255], GOLD = [201, 166, 107], GREEN = [63, 191, 143];

  function hexToRgb(hex) {
    var h = String(hex || '#0058BE').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, Math.min(1, a)) + ')'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

  function glowSprite(c, size) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var g = cv.getContext('2d');
    var grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, rgba(c, 1));
    grd.addColorStop(0.16, rgba(c, 0.58));
    grd.addColorStop(0.44, rgba(c, 0.18));
    grd.addColorStop(1, rgba(c, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return cv;
  }

  function rot(p, yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var x = p[0] * cy + p[2] * sy;
    var z = -p[0] * sy + p[2] * cy;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    return [x, p[1] * cp - z * sp, p[1] * sp + z * cp];
  }
  function proj(p, R, cx, cy, f) {
    f = f || 3.4;
    var s = f / (f + p[2]);
    return { x: cx + p[0] * s * R, y: cy + p[1] * s * R, s: s, z: p[2] };
  }

  var OV = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  var OF = [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]];

  // eight-sided crystal, real 3D faces sorted by depth
  function crystal(ctx, cx, cy, size, yaw, pitch, base, hot, alpha, squash) {
    var pts = OV.map(function (v) {
      var r = rot(v, yaw, pitch);
      return { x: cx + r[0] * size, y: cy + r[1] * size * (squash || 1), z: r[2] };
    });
    OF.map(function (f) {
      return { f: f, z: (pts[f[0]].z + pts[f[1]].z + pts[f[2]].z) / 3 };
    }).sort(function (a, b) { return a.z - b.z; }).forEach(function (o) {
      var f = o.f, shade = 0.2 + 0.8 * clamp((o.z + 1) / 2, 0, 1);
      ctx.beginPath();
      ctx.moveTo(pts[f[0]].x, pts[f[0]].y);
      ctx.lineTo(pts[f[1]].x, pts[f[1]].y);
      ctx.lineTo(pts[f[2]].x, pts[f[2]].y);
      ctx.closePath();
      ctx.fillStyle = rgba(mix(base, hot, shade * 0.75), alpha * (0.24 + 0.6 * shade));
      ctx.fill();
      ctx.strokeStyle = rgba(hot, alpha * (0.2 + 0.62 * shade));
      ctx.lineWidth = 1.05;
      ctx.stroke();
    });
  }

  function mono(ctx, size) {
    ctx.font = size + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
    try { ctx.letterSpacing = '0.14em'; } catch (e) { }
  }

  class AvBase extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;
      this.style.display = 'block';
      this.style.position = 'absolute';
      this.style.inset = '0';
      this.style.width = '100%';
      this.style.height = '100%';
      this.canvas = document.createElement('canvas');
      this.canvas.setAttribute('aria-hidden', 'true');
      this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      this.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this.reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      this.setAccent(this.getAttribute('accent'));

      this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      this._mv = function (e) {
        var r = this.getBoundingClientRect();
        if (!r.width) return;
        this.mouse.tx = clamp((e.clientX - r.left) / r.width - 0.5, -0.9, 0.9) * 2;
        this.mouse.ty = clamp((e.clientY - r.top) / r.height - 0.5, -0.9, 0.9) * 2;
      }.bind(this);
      window.addEventListener('pointermove', this._mv, { passive: true });
      this._vc = function () { if (!document.hidden) this.start(); }.bind(this);
      document.addEventListener('visibilitychange', this._vc);

      this.t = 0;
      if (this.setup) this.setup();
      this.resize();
      setTimeout(this.resize.bind(this), 80);
      setTimeout(this.resize.bind(this), 400);
      this._wr = this.resize.bind(this);
      window.addEventListener('resize', this._wr, { passive: true });
      if (window.ResizeObserver) {
        this.ro = new ResizeObserver(this.resize.bind(this));
        this.ro.observe(this);
      }
      this.visible = true;
      if ('IntersectionObserver' in window) {
        this.io = new IntersectionObserver(function (en) {
          this.visible = en[0].isIntersecting;
          if (this.visible) this.start();
        }.bind(this), { threshold: 0 });
        this.io.observe(this);
      }
      this.start();
    }

    disconnectedCallback() {
      cancelAnimationFrame(this.raf);
      this.raf = null;
      window.removeEventListener('pointermove', this._mv);
      if (this._wr) window.removeEventListener('resize', this._wr);
      if (this._vc) document.removeEventListener('visibilitychange', this._vc);
      if (this.ro) this.ro.disconnect();
      if (this.io) this.io.disconnect();
    }

    setAccent(hex) {
      this.accent = hexToRgb(hex || '#0058BE');
      this.lit = mix(this.accent, WHITE, 0.42);
      this.hot = mix(this.accent, WHITE, 0.82);
      this.gBase = glowSprite(this.accent, 256);
      this.gLit = glowSprite(this.lit, 160);
      this.gHot = glowSprite(this.hot, 128);
      this.gGold = glowSprite(GOLD, 160);
      this.gGreen = glowSprite(GREEN, 160);
    }

    resize() {
      var r = this.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      this.w = Math.max(1, Math.round(r.width));
      this.h = Math.max(1, Math.round(r.height));
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.reduced) this.draw(0);
    }

    start() {
      if (this.raf || this.reduced) return;
      var last = performance.now();
      var loop = function (now) {
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!this.visible || document.hidden) { this.raf = null; return; }
        this.t += dt;
        this.draw(dt);
        this.raf = requestAnimationFrame(loop);
      }.bind(this);
      this.raf = requestAnimationFrame(loop);
    }

    wash() {
      var ctx = this.ctx, w = this.w, h = this.h;
      var g = ctx.createRadialGradient(w * 0.5, h * 0.46, 0, w * 0.5, h * 0.46, Math.max(w, h) * 0.66);
      g.addColorStop(0, rgba(this.accent, 0.2));
      g.addColorStop(0.5, rgba(this.accent, 0.07));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    ease() {
      this.mouse.x += (this.mouse.tx - this.mouse.x) * 0.05;
      this.mouse.y += (this.mouse.ty - this.mouse.y) * 0.05;
    }
  }

  /* ---------- 1. Analisis Pesan: message bubble shattering into labelled crystal shards ---------- */
  class AvShards extends AvBase {
    static get observedAttributes() { return ['phase', 'labels', 'accent']; }
    attributeChangedCallback(n, o, v) {
      if (!this._ready) return;
      if (n === 'accent') this.setAccent(v);
      if (n === 'labels') this.readLabels();
      if (this.reduced) this.draw(0);
    }
    readLabels() {
      this.labels = (this.getAttribute('labels') || 'PERMINTAAN INTI|TENGGAT|NADA & URGENSI|KEYAKINAN').split('|');
    }
    setup() {
      this.readLabels();
      this.p = 0;
      this.shards = [
        { pos: [-0.74, -0.46, 0.16], size: 0.115, ph: 0.2, spin: 0.36 },
        { pos: [0.78, -0.30, -0.12], size: 0.10, ph: 1.4, spin: -0.3 },
        { pos: [-0.62, 0.50, -0.06], size: 0.096, ph: 2.6, spin: 0.28 },
        { pos: [0.68, 0.52, 0.2], size: 0.105, ph: 3.7, spin: -0.34 }
      ];
      this.chips = [];
      for (var i = 0; i < 9; i++) {
        var a = Math.random() * Math.PI * 2, r = 0.35 + Math.random() * 0.75;
        this.chips.push({
          pos: [Math.cos(a) * r, (Math.random() - 0.5) * 1.15, Math.sin(a) * r * 0.6],
          size: 0.018 + Math.random() * 0.03, ph: Math.random() * 6, spin: (Math.random() - 0.5) * 1.2
        });
      }
      this.cracks = [];
      for (var c = 0; c < 7; c++) {
        this.cracks.push({ a: (c / 7) * Math.PI * 2 + Math.random(), len: 0.3 + Math.random() * 0.45, k: 0.4 + Math.random() * 0.5 });
      }
    }
    draw(dt) {
      var ctx = this.ctx, w = this.w, h = this.h;
      if (!ctx || !w) return;
      ctx.clearRect(0, 0, w, h);
      this.ease();
      this.wash();

      var phase = this.getAttribute('phase') || 'idle';
      var target = phase === 'done' ? 1 : phase === 'loading' ? 0.1 : 0;
      this.p += (target - this.p) * (dt ? clamp(dt * (phase === 'done' ? 3.4 : 5), 0, 1) : 1);
      var P = easeOut(this.p);

      var R = Math.min(w * 0.34, h * 0.42);
      var cx = w / 2 + this.mouse.x * 14;
      var cy = h / 2 + this.mouse.y * 10;
      var yaw = Math.sin(this.t * 0.22) * 0.14 + this.mouse.x * 0.2;
      var pitch = 0.1 + Math.sin(this.t * 0.17) * 0.05 + this.mouse.y * 0.1;
      var jitter = phase === 'loading' ? Math.sin(this.t * 34) * 1.1 : 0;
      var orbit = this.t * 0.12;

      ctx.globalCompositeOperation = 'lighter';
      var haloR = R * 1.5;
      ctx.globalAlpha = 0.55 + (phase === 'loading' ? 0.2 + Math.sin(this.t * 5) * 0.09 : 0);
      ctx.drawImage(this.gBase, cx - haloR, cy - haloR, haloR * 2, haloR * 2);
      ctx.globalAlpha = 1;

      // bubble slab (two extruded quads + side walls)
      var bw = 0.62, bh = 0.34, alphaB = 1 - P * 0.86;
      var quad = function (z) {
        return [[-bw, -bh, z], [bw, -bh, z], [bw, bh, z], [-bw, bh, z]].map(function (v) {
          var r = rot(v, yaw, pitch);
          return proj(r, R, cx + jitter, cy, 3.4);
        });
      };
      var front = quad(-0.07), back = quad(0.07);
      var path = function (q) {
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y);
        for (var i = 1; i < q.length; i++) ctx.lineTo(q[i].x, q[i].y);
        ctx.closePath();
      };
      path(back);
      ctx.fillStyle = rgba(this.accent, 0.26 * alphaB);
      ctx.fill();
      ctx.strokeStyle = rgba(this.lit, 0.3 * alphaB);
      ctx.lineWidth = 1;
      ctx.stroke();
      for (var s = 0; s < 4; s++) {
        var n = (s + 1) % 4;
        ctx.beginPath();
        ctx.moveTo(front[s].x, front[s].y);
        ctx.lineTo(back[s].x, back[s].y);
        ctx.lineTo(back[n].x, back[n].y);
        ctx.lineTo(front[n].x, front[n].y);
        ctx.closePath();
        ctx.fillStyle = rgba(this.accent, 0.17 * alphaB);
        ctx.fill();
      }
      path(front);
      var g = ctx.createLinearGradient(front[0].x, front[0].y, front[2].x, front[2].y);
      g.addColorStop(0, rgba(this.lit, 0.32 * alphaB));
      g.addColorStop(1, rgba(this.accent, 0.13 * alphaB));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(this.hot, (0.5 + (phase === 'loading' ? 0.3 * Math.abs(Math.sin(this.t * 4)) : 0)) * alphaB);
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // tail
      var tail = [[-bw + 0.06, bh, -0.07], [-bw + 0.26, bh, -0.07], [-bw + 0.02, bh + 0.19, -0.07]].map(function (v) {
        var r = rot(v, yaw, pitch);
        return proj(r, R, cx + jitter, cy, 3.4);
      });
      path(tail);
      ctx.fillStyle = rgba(this.accent, 0.22 * alphaB);
      ctx.fill();
      ctx.strokeStyle = rgba(this.hot, 0.55 * alphaB);
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // text lines inside the bubble
      var lines = [[-0.42, -0.16, 0.34], [-0.42, 0, 0.5], [-0.42, 0.16, 0.2]];
      lines.forEach(function (L, i) {
        var a1 = rot([L[0], L[1], -0.08], yaw, pitch), a2 = rot([L[0] + L[2] * 1.6, L[1], -0.08], yaw, pitch);
        var p1 = proj(a1, R, cx + jitter, cy, 3.4), p2 = proj(a2, R, cx + jitter, cy, 3.4);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = rgba(WHITE, (0.32 - i * 0.04) * alphaB);
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.stroke();
      });
      ctx.lineCap = 'butt';

      // energy rings while analysing
      if (phase === 'loading') {
        for (var ri = 0; ri < 2; ri++) {
          var rt = ((this.t * 0.55 + ri * 0.5) % 1);
          var rr2 = R * (0.5 + rt * 1.15);
          ctx.beginPath();
          ctx.ellipse(cx, cy, rr2, rr2 * 0.42, 0, 0, 6.2832);
          ctx.strokeStyle = rgba(this.lit, (1 - rt) * 0.22);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // cracks while analysing
      if (phase === 'loading') {
        var k = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 2.2));
        this.cracks.forEach(function (cr) {
          var e = rot([Math.cos(cr.a) * cr.len * bw * 1.5 * k, Math.sin(cr.a) * cr.len * bh * 2.1 * k, -0.08], yaw, pitch);
          var m = rot([0, 0, -0.08], yaw, pitch);
          var pm = proj(m, R, cx + jitter, cy, 3.4), pe = proj(e, R, cx + jitter, cy, 3.4);
          ctx.beginPath();
          ctx.moveTo(pm.x, pm.y);
          ctx.lineTo(pe.x, pe.y);
          ctx.strokeStyle = rgba(this.hot, 0.5 * cr.k * k);
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }, this);
      }

      // fragments
      var self = this;
      var drawShard = function (sh, i, labelled) {
        var d = clamp((P - i * 0.05) / 0.8, 0, 1);
        var e = easeOut(d);
        var float = Math.sin(self.t * 0.8 + sh.ph) * 0.035;
        var ca = Math.cos(orbit * e), sa = Math.sin(orbit * e);
        var ox = sh.pos[0] * ca + sh.pos[2] * sa;
        var oz = -sh.pos[0] * sa + sh.pos[2] * ca;
        var v = [ox * e, sh.pos[1] * e + float * e, oz * e];
        var r = rot(v, yaw, pitch);
        var pp = proj(r, R, cx, cy, 3.4);
        var size = sh.size * R * pp.s * (0.35 + 0.65 * e);
        var glow = size * 3.2;
        ctx.globalAlpha = 0.5 * e;
        ctx.drawImage(labelled ? self.gLit : self.gHot, pp.x - glow, pp.y - glow, glow * 2, glow * 2);
        ctx.globalAlpha = 1;
        crystal(ctx, pp.x, pp.y, size, self.t * sh.spin + sh.ph, 0.5 + Math.sin(self.t * 0.5 + sh.ph) * 0.4,
          self.accent, labelled ? WHITE : self.hot, 0.35 + 0.65 * e, 1);
        return { p: pp, size: size, e: e };
      };

      this.chips.forEach(function (sh, i) { drawShard(sh, i + 2, false); });

      var placed = this.shards.map(function (sh, i) { return drawShard(sh, i, true); });

      // gold threads: every fragment still belongs to the same message
      if (P > 0.4) {
        var ta = clamp((P - 0.4) / 0.5, 0, 1);
        var ghost = proj(rot([0, 0, 0], yaw, pitch), R, cx, cy, 3.4);
        placed.forEach(function (o) {
          ctx.beginPath();
          ctx.moveTo(ghost.x, ghost.y);
          ctx.lineTo(o.p.x, o.p.y);
          ctx.strokeStyle = rgba(GOLD, 0.11 * ta);
          ctx.lineWidth = 0.7;
          ctx.stroke();
        });
      }

      ctx.globalCompositeOperation = 'source-over';

      // leader lines + labels
      if (P > 0.55) {
        var la = clamp((P - 0.55) / 0.4, 0, 1);
        mono(ctx, 9.5);
        ctx.textBaseline = 'middle';
        placed.forEach(function (o, i) {
          var right = o.p.x >= cx;
          var lx = o.p.x + (right ? o.size + 12 : -(o.size + 12));
          ctx.beginPath();
          ctx.moveTo(o.p.x + (right ? o.size + 3 : -(o.size + 3)), o.p.y);
          ctx.lineTo(lx, o.p.y);
          ctx.strokeStyle = rgba(GOLD, 0.5 * la);
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(lx, o.p.y, 1.6, 0, 6.2832);
          ctx.fillStyle = rgba(GOLD, 0.85 * la);
          ctx.fill();
          ctx.textAlign = right ? 'left' : 'right';
          ctx.fillStyle = rgba(WHITE, 0.62 * la);
          ctx.fillText(self.labels[i] || '', lx + (right ? 7 : -7), o.p.y);
        });
      }
    }
  }

  /* ---------- 2. Draf Balasan: one light source branching into coloured reply paths ---------- */
  class AvBranch extends AvBase {
    static get observedAttributes() { return ['active', 'labels', 'accent', 'live']; }
    attributeChangedCallback(n, o, v) {
      if (!this._ready) return;
      if (n === 'accent') this.setAccent(v);
      if (n === 'labels') this.readLabels();
      if (this.reduced) this.draw(0);
    }
    readLabels() {
      this.labels = (this.getAttribute('labels') || 'VARIAN A|VARIAN B|VARIAN C').split('|');
    }
    setup() {
      this.readLabels();
      this.paths = [
        { y: -0.52, c: null, p: 0.1, sp: 0.24, bend: -0.5 },
        { y: 0.04, c: GOLD, p: 0.45, sp: 0.2, bend: 0.05 },
        { y: 0.56, c: GREEN, p: 0.75, sp: 0.28, bend: 0.5 }
      ];
      this.paths[0].c = this.lit;
    }
    draw(dt) {
      var ctx = this.ctx, w = this.w, h = this.h;
      if (!ctx || !w) return;
      ctx.clearRect(0, 0, w, h);
      this.ease();
      this.wash();
      this.paths[0].c = this.lit;

      var active = parseInt(this.getAttribute('active') || '0', 10);
      if (this._lastActive == null) this._lastActive = active;
      if (this._lastActive !== active) { this._lastActive = active; this.surgeAt = this.t; }
      var surge = this.surgeAt == null ? 2 : (this.t - this.surgeAt) / 0.55;
      var live = this.getAttribute('live') !== 'false';
      var sx = w * 0.14 + this.mouse.x * 6;
      var sy = h * 0.5 + this.mouse.y * 5;
      var ex = w * 0.86;
      var self = this;

      ctx.globalCompositeOperation = 'lighter';
      var hg = Math.min(w, h) * 0.5;
      ctx.globalAlpha = 0.62;
      ctx.drawImage(this.gBase, sx - hg, sy - hg, hg * 2, hg * 2);
      ctx.globalAlpha = 1;

      this.paths.forEach(function (pa, i) {
        var on = i === active;
        var ey = h * 0.5 + pa.y * h * 0.34 + Math.sin(self.t * 0.6 + i * 1.3) * 3;
        var c1x = sx + (ex - sx) * 0.42, c1y = sy + pa.bend * h * 0.1;
        var c2x = sx + (ex - sx) * 0.6, c2y = ey - pa.bend * h * 0.06;
        var col = pa.c;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
        ctx.strokeStyle = rgba(col, on ? 0.82 : 0.3);
        ctx.lineWidth = on ? 1.7 : 1;
        ctx.stroke();

        if (dt && live) { pa.p += pa.sp * dt; if (pa.p > 1) pa.p -= 1; }
        var t = pa.p, mt = 1 - t;
        var bx = mt * mt * mt * sx + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * ex;
        var by = mt * mt * mt * sy + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * ey;
        var fade = Math.sin(t * Math.PI);
        var gr = (on ? 20 : 13) * fade;
        ctx.globalAlpha = (on ? 0.95 : 0.45) * fade;
        ctx.drawImage(glowKey(col), bx - gr, by - gr, gr * 2, gr * 2);
        ctx.globalAlpha = 1;

        // bright surge down the path the moment its style is picked
        if (on && surge < 1) {
          var st = easeOut(surge);
          var mt2 = 1 - st;
          var qx = mt2 * mt2 * mt2 * sx + 3 * mt2 * mt2 * st * c1x + 3 * mt2 * st * st * c2x + st * st * st * ex;
          var qy = mt2 * mt2 * mt2 * sy + 3 * mt2 * mt2 * st * c1y + 3 * mt2 * st * st * c2y + st * st * st * ey;
          var sg = 26 * (1 - surge);
          ctx.globalAlpha = 1 - surge;
          ctx.drawImage(self.gHot, qx - sg, qy - sg, sg * 2, sg * 2);
          ctx.globalAlpha = 1;
        }

        // endpoint crystal
        var size = on ? 13 : 9;
        var eg = size * 2.6;
        ctx.globalAlpha = on ? 0.8 : 0.35;
        ctx.drawImage(glowKey(col), ex - eg, ey - eg, eg * 2, eg * 2);
        ctx.globalAlpha = 1;
        crystal(ctx, ex, ey, size, self.t * (on ? 0.5 : 0.24) + i, 0.5, mix(col, [12, 16, 24], 0.45), col, on ? 1 : 0.55, 1);

        ctx.globalCompositeOperation = 'source-over';
        mono(ctx, on ? 10 : 9.5);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba(on ? WHITE : [138, 147, 163], on ? 0.85 : 0.5);
        ctx.fillText(self.labels[i] || '', ex + size + 12, ey);
        ctx.globalCompositeOperation = 'lighter';
      });

      // source core
      var rip = (this.t * 0.42) % 1;
      ctx.beginPath();
      ctx.arc(sx, sy, 14 + rip * 46, 0, 6.2832);
      ctx.strokeStyle = rgba(this.lit, (1 - rip) * 0.2);
      ctx.lineWidth = 1;
      ctx.stroke();
      crystal(ctx, sx, sy, 16, this.t * 0.4, 0.42 + Math.sin(this.t * 0.6) * 0.2, this.accent, WHITE, 1, 1);
      var cg = 26 + Math.sin(this.t * 1.3) * 3;
      ctx.globalAlpha = 0.7;
      ctx.drawImage(this.gHot, sx - cg, sy - cg, cg * 2, cg * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      mono(ctx, 9.5);
      ctx.textAlign = 'center';
      ctx.fillStyle = rgba([138, 147, 163], 0.6);
      ctx.fillText('SATU PESAN', sx, sy + 36);

      function glowKey(c) {
        if (c === GOLD) return self.gGold;
        if (c === GREEN) return self.gGreen;
        return self.gHot;
      }
    }
  }

  /* ---------- 3. Buku Alamat: memory core with contacts orbiting, context flowing inward ---------- */
  class AvConstellation extends AvBase {
    static get observedAttributes() { return ['nodes', 'highlight', 'accent']; }
    attributeChangedCallback(n, o, v) {
      if (!this._ready) return;
      if (n === 'accent') this.setAccent(v);
      if (n === 'nodes') this.readNodes();
      if (n === 'highlight') {
        var i = parseInt(v || '-1', 10);
        if (i >= 0 && this.nodes && this.nodes[i]) this.nodes[i].burst = 0;
      }
      if (this.reduced) this.draw(0);
    }
    readNodes() {
      var raw = (this.getAttribute('nodes') || '').split('|').filter(Boolean).slice(0, 20);
      var prev = this.nodes || [];
      var rings = this.rings;
      this.nodes = raw.map(function (r, i) {
        var parts = r.split('~');
        var old = prev[i];
        if (old) { old.label = parts[0]; old.target = parseFloat(parts[1]) || 0.3; return old; }
        return {
          label: parts[0],
          target: parseFloat(parts[1]) || 0.3,
          c: 0.15,
          ring: i % rings.length,
          a0: 2.399963 * i,
          yb: (i % 3 - 1) * 0.11,
          ph: i * 1.37,
          burst: 99,
          pulse: (i * 0.37) % 1
        };
      });
      this.dust = this.dust || (function () {
        var d = [];
        for (var i = 0; i < 40; i++) {
          var u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1), rr = 1 + Math.random() * 0.9;
          d.push({ x: Math.sin(v) * Math.cos(u) * rr, y: Math.cos(v) * rr * 0.5, z: Math.sin(v) * Math.sin(u) * rr, s: 0.4 + Math.random() * 0.7, tw: Math.random() * 6 });
        }
        return d;
      })();
    }
    setup() {
      this.rings = [
        { r: 0.62, sp: 0.16, tilt: -0.06 },
        { r: 0.95, sp: -0.11, tilt: 0.05 },
        { r: 1.26, sp: 0.075, tilt: -0.03 }
      ];
      this.readNodes();
    }
    nodePos(nd, dt) {
      var ring = this.rings[nd.ring];
      var a = nd.a0 + this.t * ring.sp;
      var y = nd.yb + Math.sin(this.t * 0.5 + nd.ph) * 0.03 + ring.tilt;
      return [Math.cos(a) * ring.r, y, Math.sin(a) * ring.r];
    }
    draw(dt) {
      var ctx = this.ctx, w = this.w, h = this.h;
      if (!ctx || !w || !this.nodes) return;
      ctx.clearRect(0, 0, w, h);
      this.ease();
      this.wash();

      var hl = parseInt(this.getAttribute('highlight') || '-1', 10);
      var R = Math.min(w * 0.3, h * 0.46);
      var cx = w / 2 + this.mouse.x * 16;
      var cy = h / 2 + this.mouse.y * 11;
      var yaw = this.t * 0.07 + this.mouse.x * 0.2;
      var pitch = 0.5 + this.mouse.y * 0.08;
      var self = this;
      var P = function (v) { return proj(rot(v, yaw, pitch), R, cx, cy, 3.4); };

      ctx.globalCompositeOperation = 'lighter';

      // ambient dust, kept sparse
      this.dust.forEach(function (d) {
        var p = P([d.x, d.y, d.z]);
        if (p.s <= 0.1) return;
        var tw = 0.3 + 0.3 * Math.sin(self.t * 1.1 + d.tw);
        ctx.globalAlpha = clamp(tw * (p.s - 0.32), 0, 1);
        ctx.fillStyle = rgba(self.lit, 1);
        ctx.fillRect(p.x, p.y, d.s * p.s * 1.3, d.s * p.s * 1.3);
      });
      ctx.globalAlpha = 1;

      // orbit rings
      this.rings.forEach(function (ring, ri) {
        var seg = 54, prev = null;
        for (var i = 0; i <= seg; i++) {
          var a = (i / seg) * Math.PI * 2;
          var p = P([Math.cos(a) * ring.r, ring.tilt, Math.sin(a) * ring.r]);
          if (prev) {
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = rgba(self.lit, clamp((p.s - 0.58) * 0.42, 0, 0.2));
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
          prev = p;
        }
      });

      var core = P([0, 0, 0]);

      // contact nodes: threads inward, then the crystal itself
      var pts = this.nodes.map(function (nd) {
        nd.c += (nd.target - nd.c) * (dt ? clamp(dt * 3, 0, 1) : 1);
        var v = self.nodePos(nd, dt);
        var p = P(v);
        p.nd = nd;
        p.v = v;
        return p;
      });

      pts.forEach(function (p) {
        var nd = p.nd, on = self.nodes.indexOf(nd) === hl;
        var thread = clamp(0.04 + nd.c * 0.13, 0, 1) * clamp(p.s - 0.5, 0, 1) * 2.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(core.x, core.y);
        ctx.strokeStyle = rgba(on ? WHITE : self.lit, on ? 0.45 : thread * 1.5);
        ctx.lineWidth = on ? 1.1 : 0.8;
        ctx.stroke();

        // context flowing from a filled-in contact into the memory core
        if (dt) {
          nd.pulse += dt * (on ? 0.85 : 0.2) * (0.4 + nd.c);
          if (nd.pulse > 1) nd.pulse -= 1;
          if (nd.burst < 99) nd.burst += dt;
        }
        if (nd.c > 0.55 || on) {
          var t2 = nd.pulse;
          var px = p.x + (core.x - p.x) * t2;
          var py = p.y + (core.y - p.y) * t2;
          var fade = Math.sin(t2 * Math.PI);
          var gr = (on ? 15 : 9) * fade;
          ctx.globalAlpha = (on ? 0.95 : 0.42 * nd.c) * fade;
          ctx.drawImage(on ? self.gGold : self.gHot, px - gr, py - gr, gr * 2, gr * 2);
          ctx.globalAlpha = 1;
        }
      });

      pts.slice().sort(function (p, q) { return p.z - q.z; }).forEach(function (p) {
        var nd = p.nd, on = self.nodes.indexOf(nd) === hl;
        var c = nd.c;
        var k = clamp(p.s - 0.4, 0, 1) * (0.35 + 0.65 * c);
        var gr = (on ? 40 : 24) * p.s * (0.45 + c * 0.55);
        ctx.globalAlpha = clamp(k * (on ? 1.7 : 1), 0, 1);
        ctx.drawImage(on ? self.gHot : self.gLit, p.x - gr, p.y - gr, gr * 2, gr * 2);
        ctx.globalAlpha = 1;
        crystal(ctx, p.x, p.y, (on ? 10 : 6.6) * p.s * (0.6 + c * 0.55), self.t * (0.3 + c * 0.3) + nd.ph,
          0.45 + Math.sin(self.t * 0.4 + nd.ph) * 0.3, self.accent, on ? WHITE : self.hot, clamp(0.3 + c * 0.8, 0, 1), 1);
        if (on) {
          var pr = 14 + (self.t * 20) % 24;
          ctx.beginPath();
          ctx.arc(p.x, p.y, pr, 0, 6.2832);
          ctx.strokeStyle = rgba(GOLD, clamp(0.5 - (pr - 14) / 50, 0, 1));
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // memory core
      var ch = 34 + Math.sin(this.t * 1.1) * 4;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(this.gGold, core.x - ch, core.y - ch, ch * 2, ch * 2);
      ctx.globalAlpha = 1;
      crystal(ctx, core.x, core.y, 15, this.t * 0.32, 0.5 + Math.sin(this.t * 0.45) * 0.22, mix(GOLD, [12, 16, 24], 0.5), GOLD, 1, 1);
      crystal(ctx, core.x, core.y, 7, -this.t * 0.5, 0.4, GOLD, WHITE, 0.9, 1);

      ctx.globalCompositeOperation = 'source-over';
      mono(ctx, 9);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(GOLD, 0.6);
      ctx.fillText('MEMORI KLIR', core.x, core.y + 34);

      if (hl >= 0 && pts[hl]) {
        mono(ctx, 10);
        ctx.fillStyle = rgba(WHITE, 0.85);
        ctx.fillText((pts[hl].nd.label || '').toUpperCase(), pts[hl].x, pts[hl].y - 26);
        mono(ctx, 9);
        ctx.fillStyle = rgba(GOLD, 0.75);
        ctx.fillText('DATA ' + Math.round(pts[hl].nd.target * 100) + '%', pts[hl].x, pts[hl].y + 26);
      }
    }
  }

  /* ---------- 4. Alur terhubung: glowing bezier stage connectors ---------- */
  class AvFlow extends AvBase {
    static get observedAttributes() { return ['stage', 'accent']; }
    attributeChangedCallback(n, o, v) {
      if (!this._ready) return;
      if (n === 'accent') this.setAccent(v);
      if (this.reduced) this.draw(0);
    }
    setup() {
      this.links = [{ p: 0.15, sp: 0.26 }, { p: 0.6, sp: 0.26 }];
      this.stages = [0.18, 0.5, 0.82];
    }
    draw(dt) {
      var ctx = this.ctx, w = this.w, h = this.h;
      if (!ctx || !w) return;
      ctx.clearRect(0, 0, w, h);
      this.ease();
      this.wash();
      var stage = parseInt(this.getAttribute('stage') || '0', 10);
      var self = this;
      var cy = h * 0.5;
      var xs = this.stages.map(function (f) { return w * f; });
      var ys = [cy - h * 0.1, cy + h * 0.08, cy - h * 0.06].map(function (y, i) {
        return y + Math.sin(self.t * 0.5 + i) * 4 + self.mouse.y * 4;
      });

      ctx.globalCompositeOperation = 'lighter';
      this.links.forEach(function (lk, i) {
        var x1 = xs[i], y1 = ys[i], x2 = xs[i + 1], y2 = ys[i + 1];
        var c1x = x1 + (x2 - x1) * 0.42, c1y = y1 - h * 0.2;
        var c2x = x1 + (x2 - x1) * 0.58, c2y = y2 + h * 0.2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2);
        ctx.strokeStyle = rgba(self.lit, i < stage ? 0.72 : 0.32);
        ctx.lineWidth = i < stage ? 1.6 : 1;
        ctx.stroke();

        if (dt) { lk.p += lk.sp * dt; if (lk.p > 1) lk.p -= 1; }
        var bez = function (t) {
          var m = 1 - t;
          return {
            x: m * m * m * x1 + 3 * m * m * t * c1x + 3 * m * t * t * c2x + t * t * t * x2,
            y: m * m * m * y1 + 3 * m * m * t * c1y + 3 * m * t * t * c2y + t * t * t * y2
          };
        };
        var b = bez(lk.p), fade = Math.sin(lk.p * Math.PI);
        var gr = 18 * fade;
        ctx.globalAlpha = fade * (i < stage ? 1 : 0.5);
        ctx.drawImage(self.gHot, b.x - gr, b.y - gr, gr * 2, gr * 2);
        ctx.globalAlpha = 1;

        var mid = bez(0.5);
        var mg = 22;
        ctx.globalAlpha = 0.4;
        ctx.drawImage(self.gGold, mid.x - mg, mid.y - mg, mg * 2, mg * 2);
        ctx.globalAlpha = 1;
        crystal(ctx, mid.x, mid.y, 11, self.t * 0.6 + i, 0.45 + Math.sin(self.t * 0.5) * 0.3, mix(GOLD, [12, 16, 24], 0.5), GOLD, 0.95, 1);
      });

      xs.forEach(function (x, i) {
        var on = i === stage;
        if (on) {
          var pr2 = (self.t * 0.4) % 1;
          ctx.beginPath();
          ctx.ellipse(x, ys[i], 26 + pr2 * 64, (26 + pr2 * 64) * 0.4, 0, 0, 6.2832);
          ctx.strokeStyle = rgba(self.lit, (1 - pr2) * 0.22);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        var gr = on ? 54 : 34;
        ctx.globalAlpha = on ? 0.85 : 0.4;
        ctx.drawImage(on ? self.gHot : self.gLit, x - gr, ys[i] - gr, gr * 2, gr * 2);
        ctx.globalAlpha = 1;
        crystal(ctx, x, ys[i], on ? 22 : 16, self.t * (on ? 0.45 : 0.22) + i * 1.4, 0.5 + Math.sin(self.t * 0.4 + i) * 0.25,
          self.accent, on ? WHITE : self.hot, on ? 1 : 0.6, 1);
        ctx.globalCompositeOperation = 'source-over';
        mono(ctx, 9.5);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba(on ? WHITE : [138, 147, 163], on ? 0.85 : 0.5);
        ctx.fillText('0' + (i + 1), x, ys[i] + (on ? 40 : 32));
        ctx.globalCompositeOperation = 'lighter';
      });
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  if (!customElements.get('av-shards')) customElements.define('av-shards', AvShards);
  if (!customElements.get('av-branch')) customElements.define('av-branch', AvBranch);
  if (!customElements.get('av-constellation')) customElements.define('av-constellation', AvConstellation);
  if (!customElements.get('av-flow')) customElements.define('av-flow', AvFlow);
})();
