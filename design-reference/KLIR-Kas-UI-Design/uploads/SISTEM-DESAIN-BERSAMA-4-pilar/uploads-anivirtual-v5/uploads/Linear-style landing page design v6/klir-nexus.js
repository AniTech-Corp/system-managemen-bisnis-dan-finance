(function () {
  if (customElements.get('klir-nexus')) return;

  function hexToRgb(hex) {
    var h = String(hex || '#0058BE').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function glowSprite(c, size) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var g = cv.getContext('2d');
    var grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, rgba(c, 0.95));
    grd.addColorStop(0.18, rgba(c, 0.45));
    grd.addColorStop(0.45, rgba(c, 0.12));
    grd.addColorStop(1, rgba(c, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return cv;
  }

  class KlirNexus extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;

      this.style.display = 'block';
      this.style.position = this.style.position || 'relative';

      this.canvas = document.createElement('canvas');
      this.canvas.setAttribute('aria-hidden', 'true');
      this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      this.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      var base = hexToRgb(this.getAttribute('accent') || '#0058BE');
      this.cBase = base;
      this.cLit = mix(base, [255, 255, 255], 0.45);
      this.cHot = mix(base, [255, 255, 255], 0.82);
      this.spriteLit = glowSprite(this.cLit, 128);
      this.spriteHot = glowSprite(this.cHot, 128);
      this.spriteBase = glowSprite(base, 256);

      this.count = Math.max(3, parseInt(this.getAttribute('nodes') || '7', 10));
      this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.buildScene();

      this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      this._onMove = function (e) {
        var r = this.getBoundingClientRect();
        this.mouse.tx = ((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2;
        this.mouse.ty = ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2;
      }.bind(this);
      window.addEventListener('pointermove', this._onMove, { passive: true });

      this.resize();
      if (window.ResizeObserver) {
        this.ro = new ResizeObserver(this.resize.bind(this));
        this.ro.observe(this);
      } else {
        this._onResize = this.resize.bind(this);
        window.addEventListener('resize', this._onResize);
      }

      this.visible = true;
      if ('IntersectionObserver' in window) {
        this.io = new IntersectionObserver(function (en) {
          this.visible = en[0].isIntersecting;
          if (this.visible && !this.reduced) this.start();
        }.bind(this), { threshold: 0 });
        this.io.observe(this);
      }

      this.t = 0;
      if (this.reduced) { this.draw(0); } else { this.start(); }
    }

    disconnectedCallback() {
      cancelAnimationFrame(this.raf);
      this.raf = null;
      window.removeEventListener('pointermove', this._onMove);
      if (this._onResize) window.removeEventListener('resize', this._onResize);
      if (this.ro) this.ro.disconnect();
      if (this.io) this.io.disconnect();
    }

    buildScene() {
      var n = this.count;
      this.nodes = [];
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2;
        this.nodes.push({ a: a, yb: Math.sin(a * 2 + 0.6) * 0.19, ph: i * 0.9 });
      }
      this.edges = [];
      for (var j = 0; j < n; j++) {
        this.edges.push({ a: j, b: (j + 1) % n, ring: true, p: Math.random(), sp: 0.09 + Math.random() * 0.05 });
        this.edges.push({ a: j, b: -1, ring: false, p: Math.random(), sp: 0.13 + Math.random() * 0.07 });
      }
      this.dust = [];
      for (var k = 0; k < 150; k++) {
        var u = Math.random() * Math.PI * 2;
        var v = Math.acos(2 * Math.random() - 1);
        var rr = 0.72 + Math.random() * 1.5;
        this.dust.push({
          x: Math.sin(v) * Math.cos(u) * rr,
          y: (Math.cos(v) * rr) * 0.55,
          z: Math.sin(v) * Math.sin(u) * rr,
          s: 0.35 + Math.random() * 0.9,
          tw: Math.random() * Math.PI * 2
        });
      }
    }

    resize() {
      var r = this.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, Math.round(r.width));
      this.h = Math.max(1, Math.round(r.height));
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.reduced) this.draw(0);
    }

    start() {
      if (this.raf) return;
      var last = performance.now();
      var loop = function (now) {
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!this.visible) { this.raf = null; return; }
        this.t += dt;
        this.draw(dt);
        this.raf = requestAnimationFrame(loop);
      }.bind(this);
      this.raf = requestAnimationFrame(loop);
    }

    project(x, y, z, tilt, R, cx, cy) {
      var cs = Math.cos(tilt), sn = Math.sin(tilt);
      var y2 = y * cs - z * sn;
      var z2 = y * sn + z * cs;
      var f = 2.4;
      var s = f / (f + z2 + 0.02);
      return { x: cx + x * s * R, y: cy + y2 * s * R, s: s, z: z2 };
    }

    draw(dt) {
      var ctx = this.ctx, w = this.w, h = this.h;
      if (!ctx || !w) return;
      ctx.clearRect(0, 0, w, h);

      this.mouse.x += (this.mouse.tx - this.mouse.x) * 0.05;
      this.mouse.y += (this.mouse.ty - this.mouse.y) * 0.05;

      var R = Math.min(w * 0.27, h * 0.42);
      var cx = w / 2 + this.mouse.x * 18;
      var cy = h / 2 + this.mouse.y * 12;
      var rot = this.t * 0.16 + this.mouse.x * 0.18;
      var tilt = 0.42 + this.mouse.y * 0.10;

      var pts = this.nodes.map(function (nd) {
        var a = nd.a + rot;
        var breathe = 1 + Math.sin(this.t * 0.7 + nd.ph) * 0.035;
        var p = this.project(Math.cos(a) * breathe, nd.yb, Math.sin(a) * breathe, tilt, R, cx, cy);
        p.node = nd;
        return p;
      }, this);
      var core = this.project(0, 0, 0, tilt, R, cx, cy);

      ctx.globalCompositeOperation = 'lighter';

      // ambient dust
      for (var d = 0; d < this.dust.length; d++) {
        var du = this.dust[d];
        var a2 = Math.atan2(du.z, du.x) + rot * 0.35;
        var rad = Math.hypot(du.x, du.z);
        var dp = this.project(Math.cos(a2) * rad, du.y, Math.sin(a2) * rad, tilt, R, cx, cy);
        if (dp.s <= 0.05) continue;
        var tw = 0.30 + 0.30 * Math.sin(this.t * 1.4 + du.tw);
        ctx.globalAlpha = Math.max(0, Math.min(1, tw * (dp.s - 0.25)));
        ctx.fillStyle = rgba(this.cLit, 1);
        ctx.fillRect(dp.x, dp.y, du.s * dp.s * 1.5, du.s * dp.s * 1.5);
      }
      ctx.globalAlpha = 1;

      // core halo
      var haloR = R * 1.55;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.spriteBase, core.x - haloR, core.y - haloR, haloR * 2, haloR * 2);
      ctx.globalAlpha = 1;

      // edges
      for (var e = 0; e < this.edges.length; e++) {
        var ed = this.edges[e];
        var A = pts[ed.a];
        var B = ed.b === -1 ? core : pts[ed.b];
        var depth = (A.s + B.s) / 2;
        var al = Math.max(0, (depth - 0.42)) * (ed.ring ? 0.70 : 0.48);
        ctx.strokeStyle = rgba(this.cLit, al);
        ctx.lineWidth = ed.ring ? 1.1 : 0.9;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();

        if (dt) { ed.p += ed.sp * dt; if (ed.p > 1) ed.p -= 1; }
        var t2 = ed.p;
        var px = A.x + (B.x - A.x) * t2;
        var py = A.y + (B.y - A.y) * t2;
        var fade = Math.sin(t2 * Math.PI);
        var g1 = 22 * depth * fade;
        ctx.globalAlpha = Math.max(0, (depth - 0.4)) * fade;
        ctx.drawImage(this.spriteHot, px - g1, py - g1, g1 * 2, g1 * 2);
        ctx.globalAlpha = 1;
      }

      // nodes, back to front
      var order = pts.slice().sort(function (p, q) { return p.z - q.z; });
      for (var i = 0; i < order.length; i++) {
        var p2 = order[i];
        if (p2.s <= 0.05) continue;
        var k = Math.max(0, p2.s - 0.35);
        var gr = 40 * p2.s;
        ctx.globalAlpha = Math.min(1, k * 1.5);
        ctx.drawImage(this.spriteLit, p2.x - gr, p2.y - gr, gr * 2, gr * 2);

        var sz = 9 * p2.s;
        ctx.save();
        ctx.translate(p2.x, p2.y);
        ctx.rotate(Math.PI / 4);
        ctx.globalAlpha = Math.min(1, k * 2.4);
        ctx.strokeStyle = rgba(this.cHot, 1);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
        ctx.fillStyle = rgba(this.cHot, 0.9);
        ctx.fillRect(-sz * 0.3, -sz * 0.3, sz * 0.6, sz * 0.6);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // core diamond
      var cs2 = 15;
      ctx.save();
      ctx.translate(core.x, core.y);
      ctx.rotate(Math.PI / 4 + this.t * 0.25);
      ctx.strokeStyle = rgba(this.cHot, 0.95);
      ctx.lineWidth = 1.4;
      ctx.strokeRect(-cs2, -cs2, cs2 * 2, cs2 * 2);
      ctx.restore();
      var cg = 70 + Math.sin(this.t * 1.2) * 8;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(this.spriteHot, core.x - cg, core.y - cg, cg * 2, cg * 2);
      ctx.globalAlpha = 1;

      ctx.globalCompositeOperation = 'source-over';
    }
  }

  customElements.define('klir-nexus', KlirNexus);
})();
