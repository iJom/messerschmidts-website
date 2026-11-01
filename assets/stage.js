/* Messerschmidts v8 "orbit" + v9 "grid" HUD - the animated stages (vanilla JS, no libraries).

   [data-stage="earth"]  home: a night globe of the Philippines. City lights
                         twinkle; amber plant and site points and the links
                         between them light up as the statement beside the
                         globe is read (word by word, plain scroll).
   .page-hero, .notfound a quiet constellation field behind the hero copy
                         (canvas added here, absolutely positioned: no layout shift).

   Budget: <= 60 fps (30 on phones and small CPUs), fewer dots on phones,
   device pixel ratio capped, paused when off-screen or when the tab is hidden.
   prefers-reduced-motion: one static, fully lit frame, no loop, statement lit. */
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

  /* ---------- Earth: the Philippines at night (v8) ----------
     An orthographic night globe centred on the archipelago. Land is a dot
     matrix from coarse outlines we drew ourselves (lon, lat pairs); the
     Philippines is drawn finer and warmer than its neighbours. City lights
     twinkle; amber points mark plants and sites and light up, with the
     links between them, as the statement beside the globe is read
     (scene.p, 0..1, set by initStatement). The land layer is painted once
     per size into an offscreen canvas, so a frame is one drawImage plus a
     few dozen lights. */
  var COL = {
    node: [196, 196, 204],   /* neutral: the inner-page constellation */
    line: [150, 150, 162],
    site: [255, 176, 0]      /* amber: plants and sites */
  };
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }

  var PH = [ /* Philippine islands, coarse */
    [120.6,18.5,121.2,18.6,122.2,18.5,122.3,17.2,122.5,16.3,121.6,15.8,121.6,14.6,122,14,122.6,14.2,123.3,13.8,123.9,13.8,124.2,13,124,12.6,123.3,13,122.6,13.4,122,13.6,121.5,13.8,120.9,13.9,120.6,14.5,120.9,14.7,120.5,14.9,120,15.5,119.8,16.3,120.3,16.6,120.4,17.5],
    [120.3,13.5,121.2,13.6,121.5,13.1,121.2,12.3,120.9,12.3,120.4,12.9],
    [117.2,8.4,117.6,8.6,118.6,9.6,119.4,10.6,119.7,11.3,119.3,11.4,118.7,10.6,117.9,9.8,117.2,8.8],
    [121.9,11.9,122.6,11.5,123.1,11.2,122.5,10.6,122,10.5,121.9,11.2],
    [122.4,10.9,123.2,10.9,123.6,10.4,123.2,9.3,122.9,9,122.5,9.6,122.9,10.2],
    [123.9,11.2,124.1,11,123.9,10.3,123.4,9.5,123.3,9.8,123.7,10.5],
    [123.8,10.1,124.5,10.1,124.6,9.7,124.1,9.6,123.8,9.7],
    [124.3,11.6,125,11.3,125.1,10.3,124.8,10,124.6,10.6,124.3,11.1],
    [124.3,12.5,125.3,12.6,125.7,11.8,125.5,11.1,125,11.1,124.6,11.6,124.4,12.1],
    [123.2,12.5,123.8,12.3,123.9,11.9,123.4,12],
    [121.9,7,122.1,7.9,122.9,8.2,123.6,8.7,124.3,8.6,124.8,9,125.4,9.8,125.6,9.5,126,9.2,126.4,8.3,126.6,7.3,126.2,6.3,125.6,5.8,125.3,6,125.4,6.9,124.9,6.9,124.2,6.3,124,7,123.7,7.7,123,7.6,122.6,7.2,122.2,6.9],
    [120.8,6.1,121.3,6.1,121.2,5.8,120.8,5.9]
  ];
  var WORLD = [ /* neighbours, coarser and dimmer */
    [103.5,1.4,104.2,1.6,103.4,4.5,102.3,6.2,101,6.9,100.3,8.4,99.2,10,99.5,11.5,100,12.8,100.9,13.5,102,12.3,102.8,12,104.5,10.4,105,8.6,106.6,9.6,108.9,11.3,109.3,13.5,108.8,15.4,107.2,16.9,105.7,18.9,106.6,20.4,108,21.5,110,21.4,110.4,20.3,111.5,21.6,113.5,22.2,114.3,22.3,116.5,23,118.1,24.5,119.6,25.9,120.5,27.5,121.9,29.9,121.3,31.6,120.9,32.9,119.3,34.5,120.3,36.2,122.5,37.4,121.1,37.7,119,37.2,117.8,38.5,118.1,39.2,121.2,40.8,122,40.3,121.3,39,123.6,39.9,125.1,39.6,125.4,37.7,126.6,37.6,126.4,34.5,127.6,34.7,129.3,35.3,129.4,36.8,128.4,38.6,127.5,39.8,129.7,40.9,130.7,42.5,132.9,42.8,135.5,43.9,138.2,46.6,140.4,48.9,141.4,52.2,140.7,53.6,137.2,54,135.2,54.7,138,56.5,143,59.3,148.5,59.3,152.3,59,155,59.6,156.8,61.6,160.1,61.8,163.3,62.5,170,60,176,62,180,65,180,72,140,73,110,77,90,76,70,73,60,70,60,25,61.5,25.1,66.5,25.4,68.8,23.9,72.8,21,72.9,19,73.5,16,74.4,14.6,75.7,11.3,76.4,9.5,77.5,8,78.3,8.9,79.3,10.3,79.9,12.1,80.3,15.9,82.2,16.6,84.9,19.3,86.5,20.2,87,21.5,88.9,21.7,90.6,22.4,91.4,22.8,92.2,21.2,94.3,18.2,94.5,16,95.4,15.7,97.2,16.9,97.6,16.1,98.5,13.1,98.6,10.8,98.3,8.4,98.9,8,100.3,6.4,100.3,4.3,101.3,2.8],
    [109,1.5,110.5,2,113,3.2,114.5,4.6,115.4,5.4,116.7,6.9,117.7,6.1,119.2,5.2,118.3,4.3,117.6,3.5,118,1,117.5,0,117,-1,116.3,-3.5,114.5,-3.5,111,-3,110,-1.5,109,0],
    [119.4,-5.5,119.6,-3.4,119,-2.6,119.8,0,120.3,.9,121.5,1,123.2,.9,124.7,1.5,125.2,1.6,124.4,.4,123,.5,121.5,.5,120.8,-1,121.5,-1.9,122.8,-4.6,121.9,-5.2,120.4,-5.6],
    [120.1,23.1,121,25.2,121.9,25,121.5,23.5,120.8,21.9],
    [108.6,19.2,109.5,20.1,110.9,20,111,19.6,110.2,18.3,109.3,18.3],
    [95.3,5.6,97.5,5.2,100.3,2.5,103.5,-.5,106,-3,105.8,-5.8,104.5,-5.9,102,-4,100.3,-1,98.7,1.7,96.5,3.7],
    [105.2,-6.8,106,-5.9,108.3,-6.3,111,-6.4,112.6,-6.9,114.4,-7.8,114.6,-8.7,112,-8.3,108,-7.8,106.4,-7.4],
    [131,-1.4,134,-.9,135,-3.3,138,-1.6,141,-2.6,145,-4.3,146,-6,147.5,-8,150,-10.4,147,-10,146,-8.5,143.5,-9,142,-9.2,141,-9.1,139,-8.1,138,-8.4,137.5,-6,134.5,-4,132,-2.8],
    [113.5,-22,114,-26,115,-34,118,-35,123,-34,129,-31.6,131,-31.5,135,-34.8,138,-35,140,-38,146,-39,150,-37.5,153,-32,153.5,-28,153,-25,150,-22,146,-19,145.4,-15,143.5,-14,142.5,-10.7,141.5,-13,141.6,-17,140,-17.5,137,-16,136,-12,132.5,-11.5,130,-13,129.5,-15,127,-14,125,-15.5,122,-17.5,121,-19.5,117,-20.7],
    [130.2,32.2,130.8,31.4,131.4,33.5,130.9,33.9,129.8,33.3],
    [131,34.3,133,35.5,136,35.8,137.3,36.9,139.6,38.2,140,40,140,41.4,141.5,41.4,142,39.4,141,37.5,140.6,36,140,35,138.8,34.6,137,34.6,135.2,33.8,133.5,34.3,132,33.9],
    [140,41.6,140.2,43.3,141.4,45.4,143.3,44.3,145.3,43.3,143.3,42,141.2,41.8],
    [124.8,1.4,125.6,1.9,128,1.5,128.6,-.3,127.9,-.6,127.3,.6],
    [79.9,9.8,81.8,7.5,81.2,6.2,80,6.1,79.8,8]
  ];
  /* Cities [lat, lon, weight]: the Philippines warm and bright, the region dim. */
  var CITY = [[14.6,121.0,1],[14.68,121.05,.8],[14.52,121.0,.8],[14.59,121.18,.55],[14.84,120.81,.5],[14.21,121.17,.5],[15.15,120.59,.5],[13.76,121.06,.45],[13.94,121.62,.4],[15.49,120.97,.4],
    [16.41,120.6,.45],[16.04,120.33,.4],[16.62,120.32,.3],[18.2,120.59,.3],[17.61,121.73,.35],[13.62,123.19,.35],[13.14,123.74,.4],[13.41,121.18,.3],[11.58,122.75,.3],[10.72,122.56,.5],
    [10.67,122.95,.5],[10.32,123.9,.85],[10.29,123.96,.6],[9.31,123.3,.35],[9.65,123.85,.3],[11.24,125.0,.4],[11.0,124.6,.3],[9.74,118.74,.35],[8.48,124.65,.55],[8.23,124.24,.35],
    [8.95,125.54,.35],[7.07,125.6,.8],[7.12,125.52,.5],[6.11,125.17,.45],[7.22,124.25,.35],[6.92,122.08,.5],[12.37,123.62,.25],[11.77,124.88,.25]];
  var CITY2 = [[25.03,121.56],[22.63,120.3],[22.32,114.17],[23.13,113.26],[22.54,114.06],[24.48,118.09],[31.23,121.47],[10.82,106.63],[21.03,105.85],[13.75,100.5],[3.14,101.69],[1.35,103.82],
    [-6.2,106.85],[5.98,116.07],[4.9,114.94],[1.55,110.34],[-5.14,119.43],[1.47,124.84],[35.68,139.69],[34.69,135.5],[37.57,126.98],[16.07,108.22]];
  /* Plants and sites (illustrative points of light, north to south). */
  var SITES = [[18.2,120.65],[16.45,120.95],[15.6,120.7],[14.0,121.2],[12.9,121.1],[13.25,123.6],[11.0,122.5],[10.5,123.1],[10.4,123.75],[11.1,124.6],[9.8,118.8],[8.1,124.9],[7.4,125.4],[6.3,124.9]];

  function inPoly(x, y, P) {
    var c = false;
    for (var i = 0, j = P.length - 2; i < P.length; j = i, i += 2) {
      var xi = P[i], yi = P[i + 1], xj = P[j], yj = P[j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  var landCache = {};
  function land(low) {
    var key = low ? 'l' : 'h';
    if (landCache[key]) return landCache[key];
    var out = [];
    function fill(list, step, ph) {
      for (var k = 0; k < list.length; k++) {
        var P = list[k], x0 = 999, x1 = -999, y0 = 99, y1 = -99;
        for (var i = 0; i < P.length; i += 2) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); }
        for (var lat = y0 + step / 2; lat < y1; lat += step) {
          var ls = step / Math.max(.25, Math.cos(lat * Math.PI / 180));
          for (var lon = x0 + ls / 2; lon < x1; lon += ls) if (inPoly(lon, lat, P)) out.push(lat, lon, ph);
        }
      }
    }
    fill(PH, low ? .3 : .2, 1);
    fill(WORLD, low ? 1.25 : .85, 0);
    return (landCache[key] = out);
  }

  var D2R = Math.PI / 180;
  var Earth = {
    init: function (s) {
      this.p = this.p == null ? 1 : this.p;
      this.dots = land(s.low);
      var wide = s.w >= 880;
      var R, cx, cy;
      if (wide) { R = Math.min(s.h * 1.2, s.w * .6); cx = s.w * .72; cy = s.h * .6; }
      else { R = s.w * .72; cx = s.w * .5; cy = s.h * .52; }
      this.g = { R: R, cx: cx, cy: cy, wide: wide, lon0: 121.6, lat0: 11.8, fadeX: wide ? s.w * .5 : 0 };
      var sl = Math.sin(this.g.lat0 * D2R), cl = Math.cos(this.g.lat0 * D2R);
      this.g.sl = sl; this.g.cl = cl;
      this.paintLand(s);
      var self = this;
      this.cities = CITY.map(function (c, i) { var q = self.proj(c[0], c[1]); q.w = c[2]; q.ph = i * 1.7; return q; });
      this.cities2 = CITY2.map(function (c) { return self.proj(c[0], c[1]); });
      this.sites = SITES.map(function (c, i) { var q = self.proj(c[0], c[1]); q.ph = i * .9; return q; });
    },
    proj: function (lat, lon) {
      var g = this.g, la = lat * D2R, dl = (lon - g.lon0) * D2R, cla = Math.cos(la), sla = Math.sin(la), cd = Math.cos(dl);
      var z = g.sl * sla + g.cl * cla * cd;
      return { x: g.cx + g.R * cla * Math.sin(dl), y: g.cy - g.R * (g.cl * sla - g.sl * cla * cd), z: z };
    },
    fade: function (x) { /* keep the copy column quiet: dim the land behind the text */
      var f = this.g.fadeX; if (!f) return 1;
      return Math.max(.14, Math.min(1, (x - f * .55) / (f * .5)));
    },
    paintLand: function (s) {
      var off = this.off || (this.off = doc.createElement('canvas'));
      off.width = s.c.width; off.height = s.c.height;
      var ctx = off.getContext('2d'), g = this.g;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);
      /* night side of the sphere and a thin atmosphere at the limb */
      ctx.fillStyle = '#04070C'; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,160,215,.10)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R + 5, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(150,185,230,.42)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, TAU); ctx.stroke();
      /* graticule every 15 degrees, very faint */
      ctx.fillStyle = 'rgba(160,175,200,.12)';
      for (var la = -60; la <= 75; la += 15) for (var lo = 30; lo <= 210; lo += 1.5) { var q = this.proj(la, lo); if (q.z > .05) ctx.fillRect(q.x, q.y, .8, .8); }
      for (var lo2 = 30; lo2 <= 210; lo2 += 15) for (var la2 = -75; la2 <= 75; la2 += 1.5) { var q2 = this.proj(la2, lo2); if (q2.z > .05) ctx.fillRect(q2.x, q2.y, .8, .8); }
      /* land */
      var d = this.dots, sz = s.low ? 1.6 : 1.4;
      for (var i = 0; i < d.length; i += 3) {
        var p = this.proj(d[i], d[i + 1]);
        if (p.z <= 0) continue;
        var a = (.25 + .75 * p.z) * this.fade(p.x);
        ctx.fillStyle = d[i + 2] ? rgba([226, 208, 170], .8 * a) : rgba([128, 140, 162], .58 * a);
        var r = (d[i + 2] ? sz * .95 : sz) * (.6 + .4 * p.z);
        ctx.fillRect(p.x - r / 2, p.y - r / 2, r, r);
      }
    },
    draw: function (s, t) {
      var ctx = s.ctx, g = this.g, p = this.p;
      ctx.drawImage(this.off, 0, 0, s.w, s.h);
      /* the region's cities, dim and steady */
      for (var j = 0; j < this.cities2.length; j++) {
        var c2 = this.cities2[j]; if (c2.z <= 0) continue;
        ctx.fillStyle = rgba([235, 225, 205], .45 * c2.z * this.fade(c2.x)); ctx.beginPath(); ctx.arc(c2.x, c2.y, 1.4, 0, TAU); ctx.fill();
      }
      /* Philippine city lights, brightening with the statement */
      var lit = .45 + .55 * p;
      for (var i = 0; i < this.cities.length; i++) {
        var c = this.cities[i], tw = .8 + .2 * Math.sin(t * 1.6 + c.ph);
        ctx.fillStyle = rgba([255, 205, 130], .16 * c.w * lit * tw); ctx.beginPath(); ctx.arc(c.x, c.y, 3 + 6 * c.w, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba([255, 236, 200], (.5 + .5 * c.w) * lit * tw); ctx.beginPath(); ctx.arc(c.x, c.y, .9 + 1.1 * c.w, 0, TAU); ctx.fill();
      }
      /* links between plants and sites, drawn in as the statement is read */
      var S = this.sites, n = S.length;
      ctx.lineWidth = 1;
      for (var k = 0; k < n - 1; k++) {
        var on = Math.max(0, Math.min(1, (p * 1.15 - k / n) * n / 2));
        if (on <= 0) continue;
        var a = S[k], b = S[k + 1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        var ox = mx - g.cx, oy = my - g.cy, ol = Math.sqrt(ox * ox + oy * oy) || 1, lift = Math.hypot(b.x - a.x, b.y - a.y) * .35;
        var qx = mx + ox / ol * lift, qy = my + oy / ol * lift;
        ctx.strokeStyle = rgba(COL.site, .5 * on);
        ctx.beginPath(); ctx.moveTo(a.x, a.y);
        /* partial curve: de Casteljau up to "on" */
        var u = on, x1 = a.x + (qx - a.x) * u, y1 = a.y + (qy - a.y) * u, x2 = qx + (b.x - qx) * u, y2 = qy + (b.y - qy) * u;
        ctx.quadraticCurveTo(x1, y1, x1 + (x2 - x1) * u, y1 + (y2 - y1) * u); ctx.stroke();
      }
      /* the points themselves, each with a slow pulse ring */
      for (var m = 0; m < n; m++) {
        var sp = S[m], v = Math.max(0, Math.min(1, (p * 1.15 - m / n) * n / 1.5)), pulse = (t * .45 + sp.ph) % 1;
        var base = .35 + .65 * v;
        ctx.fillStyle = rgba(COL.site, .22 * base); ctx.beginPath(); ctx.arc(sp.x, sp.y, 7, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba(COL.site, base); ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.6, 0, TAU); ctx.fill();
        if (v > .5) { ctx.strokeStyle = rgba(COL.site, .6 * (1 - pulse) * v); ctx.beginPath(); ctx.arc(sp.x, sp.y, 4 + 16 * pulse, 0, TAU); ctx.stroke(); }
      }
      this.hud(s, t);
    },
    /* v9 HUD layer: a reticle on the archipelago, island-group labels with
       leader lines, Manila's coordinates and one scan line across the disc.
       Reduced motion draws it once at t = 0 (the static frame). */
    hud: function (s, t) {
      var ctx = s.ctx, g = this.g, c = this.proj(12.2, 122.4), rr = g.R * .3;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(244,244,245,.28)';
      ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, TAU); ctx.stroke();
      var a0 = t * .25;
      ctx.strokeStyle = 'rgba(255,184,0,.75)'; ctx.lineWidth = 2;
      for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(c.x, c.y, rr + 8, a0 + k * TAU / 3, a0 + k * TAU / 3 + .5); ctx.stroke(); }
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(244,244,245,.55)';
      for (var q = 0; q < 4; q++) {
        var an = q * TAU / 4, ca = Math.cos(an), sa = Math.sin(an);
        ctx.beginPath(); ctx.moveTo(c.x + ca * (rr - 6), c.y + sa * (rr - 6)); ctx.lineTo(c.x + ca * (rr + 14), c.y + sa * (rr + 14)); ctx.stroke();
      }
      /* scan line, clipped to the globe */
      var y = g.cy - g.R + ((t * .06) % 1) * 2 * g.R, dy = y - g.cy, half = Math.sqrt(Math.max(0, g.R * g.R - dy * dy));
      if (half > 0) {
        ctx.strokeStyle = 'rgba(255,184,0,.22)';
        ctx.beginPath(); ctx.moveTo(Math.max(g.cx - half, this.g.fadeX * .9), y); ctx.lineTo(g.cx + half, y); ctx.stroke();
      }
      /* labels: condensed caps, leader lines (only where there is room) */
      var big = s.w >= 560, fs = big ? 13 : 11;
      ctx.font = '700 ' + fs + 'px "Barlow Semi Condensed", "Arial Narrow", sans-serif';
      if ('letterSpacing' in ctx) ctx.letterSpacing = big ? '2.5px' : '1.5px';
      ctx.textBaseline = 'middle';
      var L = [[16.4, 121.2, 'LUZON', 1], [11.0, 124.0, 'VISAYAS', 1], [7.6, 125.0, 'MINDANAO', 1], [14.6, 121.0, big ? 'MANILA 14.60°N 120.98°E' : 'MANILA', -1]];
      for (var i = 0; i < L.length; i++) {
        var p = this.proj(L[i][0], L[i][1]), dir = L[i][3], lx = p.x + dir * (big ? 64 : 34), ly = p.y - (big ? 18 : 12);
        if (p.z <= 0 || lx > s.w - 8 || lx < 8) continue;
        ctx.strokeStyle = 'rgba(244,244,245,.45)';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + dir * 12, ly); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.fillStyle = 'rgba(244,244,245,.86)';
        ctx.textAlign = dir > 0 ? 'left' : 'right';
        ctx.fillText(L[i][2], lx + dir * 6, ly);
      }
      ctx.restore();
    }
  };

  /* The statement beside the globe lights word by word as the reader
     scrolls past it. Plain scroll: nothing is pinned by script (the sticky
     hold is CSS and only on tall desktop screens). Without JS, without
     IntersectionObserver or with reduced motion it is fully lit. */
  function initStatement(earth) {
    var st = doc.querySelector('[data-statement]');
    if (!st || mqReduce.matches || !hasIO) return;
    var parts = st.textContent.split(/(\s+)/), frag = doc.createDocumentFragment(), words = [];
    parts.forEach(function (w) {
      if (!w) return;
      if (/^\s+$/.test(w)) { frag.appendChild(doc.createTextNode(w)); return; }
      var sp = doc.createElement('span'); sp.className = 'w'; sp.textContent = w; frag.appendChild(sp); words.push(sp);
    });
    st.textContent = ''; st.appendChild(frag);
    var track = st.closest('.globe-track'), sticky = track && track.firstElementChild, lastN = -1, ticking = false;
    function measure() {
      var vh = window.innerHeight || doc.documentElement.clientHeight, p;
      if (sticky && getComputedStyle(sticky).position === 'sticky') {
        /* from the moment the section is half in view until four fifths of the hold */
        var tr = track.getBoundingClientRect(), span = tr.height - sticky.offsetHeight;
        p = (vh * .5 - tr.top) / Math.max(1, vh * .5 + span * .8);
      } else {
        var r = st.getBoundingClientRect();
        p = (vh * .85 - r.top) / Math.max(1, vh * .5 + r.height * .5);
      }
      p = Math.max(0, Math.min(1, p));
      var n = Math.round(p * words.length);
      if (n !== lastN) { for (var i = 0; i < words.length; i++) words[i].classList.toggle('on', i < n); lastN = n; }
      if (earth) earth.p = p;
      ticking = false;
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(measure); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('beforeprint', function () { words.forEach(function (w) { w.classList.add('on'); }); });
    measure();
  }

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

  /* v9 HUD: CSS data traces, the platform diagram and screen scans run only
     while their section is on screen (class .is-live). With reduced motion,
     without IntersectionObserver or without JS they never start: the static
     frame is the finished picture. */
  function initHud() {
    var els = doc.querySelectorAll('[data-hud]');
    if (!els.length || !hasIO || mqReduce.matches) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('is-live', e.isIntersecting); });
    }, { rootMargin: '40px' });
    els.forEach(function (e) { io.observe(e); });
  }

  function boot() {
    initSearchLink();
    initHud();
    if (!window.requestAnimationFrame) return;
    var earth = null;
    doc.querySelectorAll('canvas[data-stage="earth"]').forEach(function (c) {
      if (c.getContext) { earth = Object.create(Earth); new Stage(c, earth); }
    });
    initStatement(earth);
    doc.querySelectorAll('.page-hero, .notfound').forEach(function (sec) {
      var c = doc.createElement('canvas');
      c.className = 'stage-field'; c.setAttribute('aria-hidden', 'true');
      sec.insertBefore(c, sec.firstChild);
      if (c.getContext) new Stage(c, Object.create(Field));
    });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
