/* Messerschmidts v7 "window" - the animated stage (vanilla JS, no libraries).

   [data-stage="globe"]  home hero: a particle-network globe whose nodes are
                         plants and sites. Particle streams leave its limb and
                         dissolve into the MESSERSCHMIDTS wordmark; the three
                         apps orbit it (cyan EAM, green Safety, amber Construction,
                         matching the legend in the HTML).
   .page-hero, .notfound a quiet constellation field behind the window card
                         (canvas added here, absolutely positioned: no layout shift).

   Budget: <= 60 fps (30 on phones and small CPUs), fewer particles on phones,
   device pixel ratio capped, paused when off-screen or when the tab is hidden.
   prefers-reduced-motion: one static frame, no loop. */
(function () {
  'use strict';
  var doc = document;
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var hasIO = 'IntersectionObserver' in window;
  var TAU = Math.PI * 2;

  function lowPower() {
    var small = Math.min(window.innerWidth, screen.width || 9999) < 700;
    var cores = navigator.hardwareConcurrency || 4;
    return small || cores <= 4;
  }

  /* Seeded random, so the static frame is the same on every load. */
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* Shared loop driver: one rAF per stage, throttled, paused off-screen/hidden. */
  function Stage(canvas, scene) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.scene = scene;
    this.low = lowPower();
    this.quiet = !!scene.quiet; /* background fields: 24 fps, 1x pixels */
    this.frameMs = 1000 / (this.quiet ? 24 : this.low ? 30 : 60);
    this.visible = true; this.running = false; this.last = 0; this.t = 0; this.raf = 0;
    this.w = 0; this.h = 0; this.dpr = 1;
    var self = this;
    this.tick = function (now) { self.frame(now); };
    this.resize();
    scene.init(this);
    this.draw(0);
    if (!mqReduce.matches) {
      /* start once the page has loaded and gone idle, so the first paint and input stay free */
      var go = function () { self.observe(); };
      var later = function () { if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 600); };
      if (doc.readyState === 'complete') later(); else window.addEventListener('load', later, { once: true });
    }
    var rT;
    window.addEventListener('resize', function () {
      clearTimeout(rT);
      rT = setTimeout(function () { self.resize(); scene.init(self); self.draw(self.t); }, 120);
    });
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', function () {
      if (mqReduce.matches) self.stop(); else self.observe();
    });
  }
  Stage.prototype.resize = function () {
    var r = this.c.getBoundingClientRect();
    this.dpr = this.quiet ? 1 : Math.min(window.devicePixelRatio || 1, this.low ? 1.5 : 2);
    this.w = Math.max(1, Math.round(r.width)); this.h = Math.max(1, Math.round(r.height));
    this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };
  Stage.prototype.draw = function (t) {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.scene.draw(this, t);
  };
  Stage.prototype.frame = function (now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    if (now - this.last < this.frameMs - 1) return;
    var dt = this.last ? Math.min(now - this.last, 100) : this.frameMs;
    this.last = now; this.t += dt / 1000;
    this.draw(this.t);
  };
  Stage.prototype.mark = function (on) {
    var sec = this.c.closest('section');
    if (sec) sec.classList.toggle('stage-off', !on); /* pauses the CSS bokeh drift too */
  };
  Stage.prototype.start = function () {
    if (this.running || mqReduce.matches || doc.hidden || !this.visible) return;
    this.running = true; this.last = 0; this.mark(true); this.raf = requestAnimationFrame(this.tick);
  };
  Stage.prototype.stop = function () { this.running = false; this.mark(false); cancelAnimationFrame(this.raf); };
  Stage.prototype.observe = function () {
    var self = this;
    if (hasIO && !this.io) {
      this.io = new IntersectionObserver(function (es) {
        self.visible = es[es.length - 1].isIntersecting;
        if (self.visible) self.start(); else self.stop();
      }, { rootMargin: '40px' });
      this.io.observe(this.c);
    }
    if (!this.vis) {
      this.vis = true;
      doc.addEventListener('visibilitychange', function () { if (doc.hidden) self.stop(); else self.start(); });
    }
    this.start();
  };

  /* ---------- Globe: plants and sites streaming into one platform ---------- */
  var COL = {
    node: [214, 206, 255],   /* lilac */
    line: [150, 136, 240],   /* violet */
    site: [255, 184, 28],    /* amber: plants and sites */
    eam: [95, 216, 240], safety: [75, 227, 168], build: [255, 176, 0]
  };
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }

  var Globe = {
    init: function (s) {
      var R = rng(7);
      var n = s.low ? 64 : 120;
      var pts = [], golden = Math.PI * (3 - Math.sqrt(5));
      for (var i = 0; i < n; i++) {
        var y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = golden * i;
        pts.push({ x: Math.cos(th) * rad, y: y, z: Math.sin(th) * rad, site: R() < .14, ph: R() * TAU });
      }
      var links = [], lim = s.low ? .52 : .4;
      for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) {
        var dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y, dz = pts[a].z - pts[b].z;
        if (dx * dx + dy * dy + dz * dz < lim * lim) links.push(a, b);
      }
      this.pts = pts; this.links = links;
      /* Stream particles: each follows a curve from the globe's limb to the wordmark. */
      var m = s.low ? 70 : 170, ps = [];
      for (var k = 0; k < m; k++) ps.push({ u: R(), sp: .05 + R() * .08, lane: R(), wob: R() * TAU, size: .6 + R() * 1.6 });
      this.ps = ps;
      var stars = [], ns = s.low ? 10 : 22;
      for (var q = 0; q < ns; q++) stars.push({ x: R(), y: R(), r: .6 + R() * 1.6, ph: R() * TAU });
      this.stars = stars;
      this.geom(s);
    },
    geom: function (s) {
      var c = s.c, word = c.parentNode.querySelector('.stage-word');
      var cr = c.getBoundingClientRect();
      var wide = window.matchMedia ? window.matchMedia('(min-width: 720px)').matches : s.w >= 720; /* same breakpoint as .stage-word in site.css */
      var R = Math.min(s.h * .34, wide ? s.w * .13 : s.w * .3);
      var gx = wide ? Math.max(R * 1.45, s.w * .15) : s.w * .5, gy = wide ? s.h * .5 : s.h * .4;
      var tx0 = s.w * .62, ty0 = s.h * .5, tx1 = s.w * .95, th = 40;
      if (word) {
        var wr = word.getBoundingClientRect();
        if (wr.width) { tx0 = wr.left - cr.left; tx1 = wr.right - cr.left; ty0 = wr.top - cr.top + wr.height / 2; th = wr.height; }
      }
      if (!wide) { R = Math.min(R, (ty0 - th) * .42); gy = Math.max(R + 18, (ty0 - th / 2) * .48); }
      this.g = { x: gx, y: gy, R: R, wide: wide, tx0: tx0, tx1: tx1, ty: ty0, th: th };
    },
    draw: function (s, t) {
      var ctx = s.ctx, g = this.g, pts = this.pts, P = [];
      var rot = t * .16 + .6, tilt = -.38;
      var cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);

      /* soft halo behind the globe */
      var hr = Math.min(g.R * 1.9, g.x, g.y, s.h - g.y); /* stays inside the canvas: no hard edge */
      var halo = ctx.createRadialGradient(g.x, g.y, g.R * .2, g.x, g.y, hr);
      halo.addColorStop(0, 'rgba(120,100,240,.30)'); halo.addColorStop(.55, 'rgba(90,70,200,.08)'); halo.addColorStop(1, 'rgba(90,70,200,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(g.x, g.y, hr, 0, TAU); ctx.fill();

      /* sparkles */
      for (var q = 0; q < this.stars.length; q++) {
        var sx = this.stars[q], tw = .35 + .65 * Math.abs(Math.sin(t * .9 + sx.ph));
        var px = sx.x * s.w, py = sx.y * s.h, rr = sx.r * (1 + tw);
        if (g.wide && px > g.tx0 - 20 && px < g.tx1 + 20 && Math.abs(py - g.ty) < g.th) continue; /* keep the wordmark clear */
        ctx.strokeStyle = rgba([235, 230, 255], .5 * tw); ctx.lineWidth = .8;
        ctx.beginPath(); ctx.moveTo(px - rr * 2.2, py); ctx.lineTo(px + rr * 2.2, py); ctx.moveTo(px, py - rr * 2.2); ctx.lineTo(px, py + rr * 2.2); ctx.stroke();
      }

      /* project the sphere */
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], x = p.x * cr + p.z * sr, z = -p.x * sr + p.z * cr, y = p.y;
        var y2 = y * ct - z * st, z2 = y * st + z * ct;
        P.push({ x: g.x + x * g.R, y: g.y + y2 * g.R, z: z2 });
      }
      /* links, brighter in front */
      ctx.lineWidth = .8;
      var L = this.links;
      for (var k = 0; k < L.length; k += 2) {
        var a = P[L[k]], b = P[L[k + 1]], d = (a.z + b.z) * .5;
        ctx.strokeStyle = rgba(COL.line, .08 + .34 * (d + 1) * .5);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      /* nodes: sites in amber with a pulse ring */
      for (var j = 0; j < P.length; j++) {
        var n = P[j], depth = (n.z + 1) * .5, pt = pts[j];
        if (pt.site) {
          var pulse = (Math.sin(t * 2 + pt.ph) + 1) * .5;
          ctx.fillStyle = rgba(COL.site, .45 + .55 * depth);
          ctx.beginPath(); ctx.arc(n.x, n.y, 1.6 + 1.8 * depth, 0, TAU); ctx.fill();
          if (depth > .5) { ctx.strokeStyle = rgba(COL.site, .5 * (1 - pulse) * depth); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(n.x, n.y, 4 + 8 * pulse, 0, TAU); ctx.stroke(); }
        } else {
          ctx.fillStyle = rgba(COL.node, .25 + .7 * depth);
          ctx.beginPath(); ctx.arc(n.x, n.y, .9 + 1.4 * depth, 0, TAU); ctx.fill();
        }
      }

      /* streams: from the right limb, sweeping into the wordmark, dissolving as they arrive */
      var sx0 = g.x + g.R * .85, sy0 = g.y - g.R * .2;
      function at(u, q2, lane, out) {
        var ex = g.tx0 - 10, ey = g.ty + lane * g.th * 1.2, c1x, c1y, c2x, c2y;
        if (g.wide) { c1x = sx0 + (ex - sx0) * .3; c1y = sy0 - g.R * .7 + lane * g.R * 1.1; c2x = sx0 + (ex - sx0) * .68; c2y = ey + lane * g.R * .9 + g.R * .35; }
        else { c1x = sx0 + g.R * .45; c1y = sy0 + g.R * 1.1; c2x = g.tx0 + (g.tx1 - g.tx0) * .25; c2y = g.ty - g.th * 2.2; ex = g.tx0 + (g.tx1 - g.tx0) * (.08 + .84 * q2.lane); ey = g.ty - g.th * .6; }
        var iu = 1 - u;
        out[0] = iu * iu * iu * sx0 + 3 * iu * iu * u * c1x + 3 * iu * u * u * c2x + u * u * u * ex + Math.sin(t * 1.3 + q2.wob + u * 6) * 5 * u;
        out[1] = iu * iu * iu * sy0 + 3 * iu * iu * u * c1y + 3 * iu * u * u * c2y + u * u * u * ey + Math.cos(t * 1.1 + q2.wob + u * 5) * 6 * u;
      }
      var A = [0, 0], B = [0, 0];
      ctx.lineCap = 'round';
      for (var m = 0; m < this.ps.length; m++) {
        var q2 = this.ps[m];
        var u = (q2.u + t * q2.sp) % 1, lane = q2.lane - .5;
        /* fade in off the limb, dissolve before the letters */
        var al = Math.min(1, u * 6) * (1 - Math.pow(u, 4)) * .8;
        if (al <= .02) continue;
        at(u, q2, lane, A); at(Math.max(0, u - .035), q2, lane, B);
        var c = q2.lane < .16 ? COL.site : (u > .55 ? [236, 232, 255] : COL.node);
        ctx.strokeStyle = rgba(c, al * .55); ctx.lineWidth = q2.size * (1.1 - u * .6);
        ctx.beginPath(); ctx.moveTo(B[0], B[1]); ctx.lineTo(A[0], A[1]); ctx.stroke();
        ctx.fillStyle = rgba(c, al);
        ctx.beginPath(); ctx.arc(A[0], A[1], q2.size * (1.05 - u * .5), 0, TAU); ctx.fill();
      }

      /* the three apps on a tilted orbit */
      var apps = [COL.eam, COL.safety, COL.build], oR = g.R * 1.32, oT = .34;
      ctx.strokeStyle = 'rgba(200,190,255,.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(g.x, g.y, oR, oR * oT, -.22, 0, TAU); ctx.stroke();
      for (var o = 0; o < 3; o++) {
        var ang = t * .35 + o * TAU / 3, ox = Math.cos(ang) * oR, oy = Math.sin(ang) * oR * oT;
        var rx = g.x + ox * Math.cos(-.22) - oy * Math.sin(-.22), ry = g.y + ox * Math.sin(-.22) + oy * Math.cos(-.22);
        var front = Math.sin(ang) > 0 ? 1 : .55;
        var gl = ctx.createRadialGradient(rx, ry, 0, rx, ry, 16);
        gl.addColorStop(0, rgba(apps[o], .55 * front)); gl.addColorStop(1, rgba(apps[o], 0));
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(rx, ry, 16, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba(apps[o], front); ctx.beginPath(); ctx.arc(rx, ry, 5.5, 0, TAU); ctx.fill();
      }
    }
  };

  /* ---------- Field: a quiet constellation for the inner pages ---------- */
  var Field = {
    quiet: true,
    init: function (s) {
      var R = rng(11), n = Math.round(Math.min(s.low ? 26 : 56, s.w * s.h / 16000));
      var ps = [];
      for (var i = 0; i < n; i++) ps.push({ x: R() * s.w, y: R() * s.h, vx: (R() - .5) * 9, vy: (R() - .5) * 7, r: .8 + R() * 1.6, amber: R() < .12, ph: R() * TAU });
      this.ps = ps; this.last = 0;
    },
    draw: function (s, t) {
      var ctx = s.ctx, ps = this.ps, dt = this.last ? Math.min(t - this.last, .1) : 0, max = 130;
      this.last = t;
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i]; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -20) p.x = s.w + 20; else if (p.x > s.w + 20) p.x = -20;
        if (p.y < -20) p.y = s.h + 20; else if (p.y > s.h + 20) p.y = -20;
      }
      ctx.lineWidth = .8;
      for (var a = 0; a < ps.length; a++) for (var b = a + 1; b < ps.length; b++) {
        var dx = ps[a].x - ps[b].x, dy = ps[a].y - ps[b].y, d2 = dx * dx + dy * dy;
        if (d2 < max * max) { ctx.strokeStyle = rgba(COL.line, .28 * (1 - Math.sqrt(d2) / max)); ctx.beginPath(); ctx.moveTo(ps[a].x, ps[a].y); ctx.lineTo(ps[b].x, ps[b].y); ctx.stroke(); }
      }
      for (var j = 0; j < ps.length; j++) {
        var q = ps[j], tw = .55 + .45 * Math.sin(t * 1.4 + q.ph);
        ctx.fillStyle = q.amber ? rgba(COL.site, .5 + .4 * tw) : rgba(COL.node, .35 + .45 * tw);
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill();
      }
    }
  };

  /* The header search icon goes to the FAQ search box: focus it on arrival. */
  function initSearchLink() {
    var box = doc.getElementById('faq-find');
    if (!box) return;
    function go() { if (location.hash === '#faq-find') box.focus({ preventScroll: false }); }
    go();
    window.addEventListener('hashchange', go);
    doc.querySelectorAll('a.header-search').forEach(function (a) {
      a.addEventListener('click', function (e) { if (location.hash === '#faq-find') { e.preventDefault(); box.focus(); } });
    });
  }

  function boot() {
    initSearchLink();
    if (!window.requestAnimationFrame) return;
    doc.querySelectorAll('canvas[data-stage="globe"]').forEach(function (c) {
      if (c.getContext) new Stage(c, Object.create(Globe));
    });
    doc.querySelectorAll('.page-hero, .notfound').forEach(function (sec) {
      var c = doc.createElement('canvas');
      c.className = 'stage-field'; c.setAttribute('aria-hidden', 'true');
      sec.insertBefore(c, sec.firstChild);
      if (c.getContext) new Stage(c, Object.create(Field));
    });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
