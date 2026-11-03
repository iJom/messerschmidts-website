/*! Messerschmidts consent manager (GDPR, CCPA/CPRA, RA 10173). No dependencies.
 *
 * LOAD IT FIRST: <script src="assets/consent.js?v=1"></script> directly after <meta charset>, with NO async/defer,
 * before any analytics or advertising tag. It runs synchronously, so nothing below it can fire before it decides.
 *
 * Off until you switch it on: while CONFIG has no IDs and the page has no blocked tags, it shows nothing, sets no
 * cookie and loads nothing (the site runs no trackers today). Preview the banner without saving: add ?consent-preview=1.
 *
 * Add a tracker in one of two ways (both stay blocked until the visitor opts in to that category):
 *   1. Put its ID below (GA4 "G-XXXXXXX" -> analytics, Meta Pixel "1234567890" -> marketing).
 *   2. Mark any other tag as blocked; it is copied into a real <script> after consent:
 *        <script type="text/plain" data-consent="analytics" data-src="https://example.com/tag.js"></script>
 *        <script type="text/plain" data-consent="marketing">/* inline tag code *\/</script>
 *   Code of your own:  msmConsent.run("analytics", function () { ... });   // runs now if granted, or on opt-in
 */
(function () {
  "use strict";

  var CONFIG = {
    ga4: "",                 // e.g. "G-ABC123XYZ"  (Analytics)
    metaPixel: "",           // e.g. "1234567890"   (Marketing)
    version: 1,              // raise to ask everyone again (new tracker, new purpose)
    days: 180,               // how long a choice is kept, then the banner asks again
    cookie: "msm_consent",
    policy: "privacy.html#cookies"
  };

  var CATS = ["analytics", "marketing"];
  var w = window, d = document;
  var preview = /[?&]consent-preview=1\b/.test(location.search);
  var gpc = navigator.globalPrivacyControl === true;   // CCPA: a GPC signal is a valid opt-out of sale/sharing
  var waiting = { analytics: [], marketing: [] };
  var state = null;                                   // {v, t, analytics, marketing} once chosen

  /* ---------- Storage: one first-party cookie, strictly necessary (it only records the choice) ---------- */
  function read() {
    var m = d.cookie.match(new RegExp("(?:^|; )" + CONFIG.cookie + "=([^;]*)"));
    if (!m) return null;
    try {
      var s = JSON.parse(decodeURIComponent(m[1]));
      if (s.v !== CONFIG.version || Date.now() - s.t > CONFIG.days * 864e5) return null;
      if (gpc) s.marketing = false;
      return s;
    } catch (e) { return null; }
  }
  function write(s) {
    if (preview) return;
    d.cookie = CONFIG.cookie + "=" + encodeURIComponent(JSON.stringify(s)) + "; Max-Age=" + CONFIG.days * 86400 +
      "; Path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
  }
  function dropTrackerCookies() {
    var host = location.hostname, parts = host.split("."), doms = ["", host];
    if (parts.length > 2) doms.push("." + parts.slice(-2).join("."));
    else doms.push("." + host);
    d.cookie.split("; ").forEach(function (c) {
      var n = c.split("=")[0];
      if (!/^(_ga|_ga_.*|_gid|_gat.*|_gcl_.*|_fbp|_fbc|fr)$/.test(n)) return;
      doms.forEach(function (dm) {
        d.cookie = n + "=; Max-Age=0; Path=/" + (dm ? "; Domain=" + dm : "");
      });
    });
  }

  /* ---------- Google Consent Mode v2: everything denied until the visitor agrees ---------- */
  function gtag() { w.dataLayer.push(arguments); }
  function consentMode(s) {
    return {
      analytics_storage: s && s.analytics ? "granted" : "denied",
      ad_storage: s && s.marketing ? "granted" : "denied",
      ad_user_data: s && s.marketing ? "granted" : "denied",
      ad_personalization: s && s.marketing ? "granted" : "denied",
      functionality_storage: "granted",
      security_storage: "granted"
    };
  }

  /* ---------- Loaders: called only after opt-in ---------- */
  function addScript(src, inline) {
    var s = d.createElement("script");
    if (src) { s.src = src; s.async = true; } else { s.text = inline; }
    (d.head || d.documentElement).appendChild(s);
  }
  var loaded = {};
  function loadGA4() {
    if (!CONFIG.ga4 || loaded.ga4) return; loaded.ga4 = 1;
    addScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CONFIG.ga4));
    w.gtag("js", new Date());
    w.gtag("config", CONFIG.ga4);
  }
  function loadMetaPixel() {
    if (!CONFIG.metaPixel || loaded.meta) return; loaded.meta = 1;
    /* Meta's standard base code, unchanged apart from the ID. */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ?
      n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0;
      n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s); }(w, d, "script", "https://connect.facebook.net/en_US/fbevents.js");
    w.fbq("init", CONFIG.metaPixel);
    w.fbq("track", "PageView");
  }
  function releaseBlocked(cat) {
    var list = d.querySelectorAll('script[type="text/plain"][data-consent="' + cat + '"]:not([data-released])');
    Array.prototype.forEach.call(list, function (el) {
      el.setAttribute("data-released", "");
      addScript(el.getAttribute("data-src"), el.text);
    });
  }
  function apply(s) {
    if (!configured()) return;
    w.gtag("consent", "update", consentMode(s));
    CATS.forEach(function (c) {
      if (!s || !s[c]) return;
      if (c === "analytics") loadGA4();
      if (c === "marketing") loadMetaPixel();
      releaseBlocked(c);
      var q = waiting[c]; waiting[c] = [];
      q.forEach(function (fn) { try { fn(); } catch (e) { setTimeout(function () { throw e; }); } });
    });
  }

  function configured() {
    return !!(CONFIG.ga4 || CONFIG.metaPixel || preview || d.querySelector('script[type="text/plain"][data-consent]'));
  }

  /* ---------- Saving a choice ---------- */
  function choose(analytics, marketing) {
    var before = state;
    state = { v: CONFIG.version, t: Date.now(), analytics: !!analytics, marketing: !!marketing && !gpc };
    write(state);
    var withdrawn = before && CATS.some(function (c) { return before[c] && !state[c]; });
    if (withdrawn) {                       // a loaded tag cannot be unloaded: clear its cookies and start the page again
      w.gtag("consent", "update", consentMode(state));
      dropTrackerCookies();
      if (!preview) { location.reload(); return; }
    }
    apply(state);
    hideBanner();
    closePanel();
    showWidget();
  }

  /* ---------- Interface ---------- */
  var css =
    ".mc-root{--mc-bg:#0A1322;--mc-surface:#13213A;--mc-border:#233756;--mc-text:#E2E9F2;--mc-muted:#A9B7C9;" +
    "--mc-accent:#00B4D8;--mc-btn:#FFB000;--mc-on-btn:#0E1C2F;font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--mc-text)}" +
    ".mc-root *{box-sizing:border-box}" +
    ".mc-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:960px;margin:0 auto;" +
    "background:var(--mc-bg);border:1px solid var(--mc-border);border-top:2px solid var(--mc-accent);border-radius:14px;" +
    "box-shadow:0 0 0 1px rgba(0,180,216,.15),0 18px 48px rgba(0,0,0,.55);padding:18px 20px;display:flex;flex-wrap:wrap;gap:14px 24px;align-items:center}" +
    ".mc-banner[hidden],.mc-widget[hidden]{display:none}" +
    ".mc-text{flex:1 1 380px;min-width:0}" +
    ".mc-title{margin:0 0 4px;font-size:16px;font-weight:700;letter-spacing:.02em}" +
    ".mc-text p{margin:0;color:var(--mc-muted)}" +
    ".mc-root a{color:var(--mc-accent);text-underline-offset:2px}" +
    ".mc-actions{display:flex;flex-wrap:wrap;gap:10px}" +
    ".mc-btn{font:inherit;font-weight:700;min-height:44px;padding:10px 18px;border-radius:10px;cursor:pointer;border:1px solid transparent}" +
    ".mc-solid{background:var(--mc-btn);color:var(--mc-on-btn)}" +       /* Accept All and Reject All look the same: equal choice */
    ".mc-solid:hover{filter:brightness(1.08)}" +
    ".mc-ghost{background:transparent;color:var(--mc-text);border-color:var(--mc-border)}" +
    ".mc-ghost:hover{border-color:var(--mc-accent)}" +
    ".mc-btn:focus-visible,.mc-root input:focus-visible+.mc-track,.mc-widget:focus-visible,.mc-x:focus-visible{outline:3px solid var(--mc-accent);outline-offset:2px}" +
    ".mc-panel{width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:0;border:1px solid var(--mc-border);" +
    "border-radius:14px;background:var(--mc-bg);color:var(--mc-text)}" +
    ".mc-panel::backdrop{background:rgba(4,9,18,.72)}" +
    ".mc-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 20px 8px}" +
    ".mc-head h2{margin:0;font-size:18px}" +
    ".mc-x{background:none;border:0;color:var(--mc-muted);font-size:26px;line-height:1;width:44px;height:44px;cursor:pointer;border-radius:8px}" +
    ".mc-body{padding:0 20px}" +
    ".mc-body>p{color:var(--mc-muted);margin:0 0 12px}" +
    ".mc-cat{border:1px solid var(--mc-border);background:var(--mc-surface);border-radius:12px;padding:14px 16px;margin:0 0 10px}" +
    ".mc-row{display:flex;justify-content:space-between;align-items:center;gap:16px;cursor:pointer}" +
    ".mc-row strong{font-size:15px}" +
    ".mc-cat p{margin:6px 0 0;color:var(--mc-muted);font-size:14px}" +
    ".mc-switch{position:relative;flex:none}" +
    ".mc-switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}" +
    ".mc-track{display:block;width:48px;height:28px;border-radius:14px;background:#32465F;border:1px solid var(--mc-border);transition:background .2s}" +
    ".mc-track:after{content:'';position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:var(--mc-text);transition:transform .2s}" +
    ".mc-switch input:checked+.mc-track{background:var(--mc-accent)}" +
    ".mc-switch input:checked+.mc-track:after{transform:translateX(20px);background:var(--mc-on-btn)}" +
    ".mc-switch input:disabled+.mc-track{opacity:.6}" +
    ".mc-switch input:disabled{cursor:not-allowed}" +
    ".mc-note{font-size:13px;color:var(--mc-muted);margin:10px 0 0}" +
    ".mc-foot{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;padding:14px 20px 18px}" +
    ".mc-widget{position:fixed;left:16px;bottom:16px;z-index:2147482999;width:44px;height:44px;border-radius:50%;cursor:pointer;" +
    "background:var(--mc-bg);border:1px solid var(--mc-border);color:var(--mc-accent);display:grid;place-items:center;box-shadow:0 6px 18px rgba(0,0,0,.45)}" +
    ".mc-widget svg{width:22px;height:22px}" +
    ".mc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}" +
    "@media (max-width:600px){.mc-banner{left:8px;right:8px;bottom:8px;padding:16px}.mc-actions{width:100%}.mc-actions .mc-btn{flex:1 1 100%}}" +
    "@media (prefers-reduced-motion:reduce){.mc-track,.mc-track:after{transition:none}}" +
    "@media print{.mc-root{display:none}}";

  var root, banner, panel, widget, lastFocus;
  function el(html) { var t = d.createElement("div"); t.innerHTML = html; return t.firstElementChild; }

  function category(id, title, text, locked) {
    return '<div class="mc-cat"><label class="mc-row" for="mc-' + id + '"><strong>' + title + '</strong>' +
      '<span class="mc-switch"><input type="checkbox" role="switch" id="mc-' + id + '"' +
      (locked ? " checked disabled" : "") + ' aria-describedby="mc-' + id + '-d"><span class="mc-track"></span></span></label>' +
      '<p id="mc-' + id + '-d">' + text + "</p></div>";
  }

  function build() {
    if (root) return;
    var st = d.createElement("style"); st.textContent = css; d.head.appendChild(st);
    root = d.createElement("div"); root.className = "mc-root";
    var hasMkt = !!(CONFIG.metaPixel || preview || d.querySelector('script[data-consent="marketing"]'));

    banner = el(
      '<section class="mc-banner" role="region" aria-labelledby="mc-title" aria-describedby="mc-desc" hidden>' +
      '<div class="mc-text"><h2 class="mc-title" id="mc-title">Your privacy choices</h2>' +
      '<p id="mc-desc">We use essential cookies to run this site. With your permission we would also use analytics' +
      (hasMkt ? " and marketing" : "") + ' cookies. Nothing optional runs until you choose. ' +
      '<a href="' + CONFIG.policy + '">Privacy &amp; cookies</a></p></div>' +
      '<div class="mc-actions">' +
      '<button type="button" class="mc-btn mc-solid" data-mc="reject">Reject All</button>' +
      '<button type="button" class="mc-btn mc-solid" data-mc="accept">Accept All</button>' +
      '<button type="button" class="mc-btn mc-ghost" data-mc="manage">Manage Preferences</button>' +
      "</div></section>");

    panel = el(
      '<dialog class="mc-panel" aria-labelledby="mc-ptitle">' +
      '<div class="mc-head"><h2 id="mc-ptitle">Cookie preferences</h2>' +
      '<button type="button" class="mc-x" data-mc="close" aria-label="Close without saving">&times;</button></div>' +
      '<div class="mc-body"><p>Choose what we may use. Optional categories are off unless you turn them on, and you can change this at any time.</p>' +
      category("essential", "Essential", "Needed for the site to work and to remember this choice. Always on.", true) +
      category("analytics", "Analytics", "Counts visits and shows which pages help, so we can improve the site (for example Google Analytics).") +
      (hasMkt ? category("marketing", "Marketing", "Measures our ads and may show you relevant ads on other sites (for example Meta Pixel). Turning this off is your &ldquo;Do Not Sell or Share My Personal Information&rdquo; opt-out.") : "") +
      (gpc ? '<p class="mc-note" role="note">Your browser sends a Global Privacy Control signal, so marketing stays off.</p>' : "") +
      '</div><div class="mc-foot">' +
      '<button type="button" class="mc-btn mc-solid" data-mc="reject">Reject All</button>' +
      '<button type="button" class="mc-btn mc-solid" data-mc="accept">Accept All</button>' +
      '<button type="button" class="mc-btn mc-ghost" data-mc="save">Save my choices</button>' +
      "</div></dialog>");

    widget = el(
      '<button type="button" class="mc-widget" data-mc="manage" hidden aria-label="Cookie settings" title="Cookie settings">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
      '<path d="M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3.5-3A3 3 0 0 1 14 5.5 3 3 0 0 1 12 3Z"/>' +
      '<circle cx="8.5" cy="10.5" r="1"/><circle cx="12" cy="15.5" r="1"/><circle cx="16" cy="13" r="1"/></svg></button>');

    root.appendChild(banner); root.appendChild(panel); root.appendChild(widget);
    d.body.appendChild(root);

    if (gpc) { var m = panel.querySelector("#mc-marketing"); if (m) m.disabled = true; }

    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-mc]"); if (!b) return;
      var a = b.getAttribute("data-mc");
      if (a === "accept") choose(true, true);
      else if (a === "reject") choose(false, false);
      else if (a === "manage") openPanel();
      else if (a === "close") closePanel();
      else if (a === "save") {
        var an = panel.querySelector("#mc-analytics"), mk = panel.querySelector("#mc-marketing");
        choose(an && an.checked, mk && mk.checked);
      }
    });
    panel.addEventListener("close", function () { if (lastFocus && lastFocus.focus) lastFocus.focus(); });
    panel.addEventListener("click", function (e) { if (e.target === panel) closePanel(); });   // backdrop

    /* Footer links: <a href="#" data-consent-open hidden>Cookie settings</a> */
    Array.prototype.forEach.call(d.querySelectorAll("[data-consent-open]"), function (a) {
      a.hidden = false;
      if (hasMkt && !a.hasAttribute("data-consent-label-fixed")) a.textContent = "Cookie settings / Do Not Sell or Share My Info";
      a.addEventListener("click", function (e) { e.preventDefault(); openPanel(); });
    });
  }

  function openPanel() {
    build();
    lastFocus = d.activeElement;
    var an = panel.querySelector("#mc-analytics"), mk = panel.querySelector("#mc-marketing");
    if (an) an.checked = !!(state && state.analytics);          // never pre-ticked: off unless the visitor turned it on
    if (mk) mk.checked = !!(state && state.marketing);
    if (typeof panel.showModal === "function") panel.showModal(); else panel.setAttribute("open", "");
    var first = panel.querySelector("#mc-analytics") || panel.querySelector(".mc-x");
    if (first) first.focus();
  }
  function closePanel() {
    if (!panel || !panel.hasAttribute("open")) return;
    if (typeof panel.close === "function") panel.close(); else panel.removeAttribute("open");
  }
  function showBanner() { build(); banner.hidden = false; }
  function hideBanner() { if (banner) banner.hidden = true; }
  function showWidget() { if (widget) widget.hidden = false; }

  /* ---------- Start (synchronous part: runs before any tag below this script) ---------- */
  if (!configured()) {
    /* Blocked tags may be further down the page than this script: look again once the page is read. */
    d.addEventListener("DOMContentLoaded", function () { if (configured()) start(); });
  } else {
    start();
  }

  var started = false;
  function start() {
    if (started) return; started = true;
    w.dataLayer = w.dataLayer || [];
    w.gtag = w.gtag || gtag;
    var defaults = consentMode(null); defaults.wait_for_update = 500;
    w.gtag("consent", "default", defaults);
    w.gtag("set", "ads_data_redaction", true);
    state = preview ? null : read();
    function ui() {
      build();
      if (state) { showWidget(); apply(state); } else showBanner();
    }
    if (state && !d.body) apply(state);          // granted earlier: tags may start now, the button comes with the page
    if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", ui); else ui();
  }

  /* ---------- Public API ---------- */
  w.msmConsent = {
    get: function () { return state ? { analytics: state.analytics, marketing: state.marketing, savedAt: new Date(state.t) } : null; },
    open: function () { if (!started) start(); openPanel(); },
    run: function (cat, fn) {
      if (CATS.indexOf(cat) < 0 || typeof fn !== "function") return;
      if (state && state[cat]) fn(); else waiting[cat].push(fn);
    },
    reset: function () { d.cookie = CONFIG.cookie + "=; Max-Age=0; Path=/"; dropTrackerCookies(); location.reload(); }
  };
})();
