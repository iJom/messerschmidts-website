/* Messerschmidts marketing site - shared script.
   No dependencies, no trackers. Everything degrades to static content without JS. */
(function () {
  'use strict';
  var doc = document;
  doc.documentElement.classList.add('js');

  function meta(name) {
    var m = doc.querySelector('meta[name="' + name + '"]');
    return m ? (m.getAttribute('content') || '').trim().replace(/\/+$/, '') : '';
  }

  function el(tag, attrs, text) {
    var n = doc.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    }
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }

  /* A number from an attribute or server value; falls back only when the
     value is missing or not a finite number (0 is a valid price). */
  function numOr(v, fallback) {
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return fallback;
    var n = Number(v);
    return isFinite(n) && n >= 0 ? n : fallback;
  }

  /* ---------- Free trial lengths: the one place to change them ----------
     A new organisation picks one app at sign-up. Every [data-trial="app"] on the
     site reads its length from here; data-trial-fmt: "days" (default) = "14 days",
     "Days" = "14 Days" (title-case headline), "day" = "14-day", "n" = "14". The HTML keeps the same values for no-JS. */
  var TRIALS = { eam: 7, construction: 7, safety: 14 };

  function trialText(app, fmt) {
    var n = TRIALS[app];
    if (!(n > 0)) return null;
    if (fmt === 'day') return n + '-day';
    if (fmt === 'n') return String(n);
    if (fmt === 'Days') return n + (n === 1 ? ' Day' : ' Days');
    return n + (n === 1 ? ' day' : ' days');
  }

  /* Trial days from the public prices endpoint win over TRIALS when it sends them:
     a top-level map { "trial_days": { "eam": 7, "construction": 7, "safety": 14 } }.
     Per-plan trial_days are read too once PLAN_TRIAL_DAYS_LIVE is true; it stays
     false while the endpoint still reports the old trials (30 / 0 / 30 on 2026-10-26). */
  var PLAN_TRIAL_DAYS_LIVE = false;

  function applyServerTrials(data, plans) {
    var seen = {}, changed = false;
    function take(app, v) {
      var n = Number(v);
      if (!Object.prototype.hasOwnProperty.call(TRIALS, app) || seen[app] || !isFinite(n) || n < 1 || n > 365) return;
      seen[app] = true;
      if (TRIALS[app] !== Math.round(n)) { TRIALS[app] = Math.round(n); changed = true; }
    }
    var map = data && data.trial_days;
    if (map && typeof map === 'object') {
      Object.keys(map).forEach(function (k) { take(k, map[k]); });
    } else if (PLAN_TRIAL_DAYS_LIVE) {
      (plans || []).forEach(function (p) { take(p.app, p.trial_days); });
    }
    if (changed) initTrials();
  }

  function initTrials() {
    doc.querySelectorAll('[data-trial]').forEach(function (n) {
      var t = trialText(n.getAttribute('data-trial'), n.getAttribute('data-trial-fmt'));
      if (t) n.textContent = t;
    });
  }

  function peso(n) {
    var v = Number(n);
    if (!isFinite(v)) return '';
    var opts = v % 1 === 0 ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return '₱' + v.toLocaleString('en-PH', opts);
  }

  /* ---------- Mobile navigation ---------- */
  function initNav() {
    var btn = doc.querySelector('.nav-toggle');
    var nav = doc.getElementById('site-nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    });
  }

  /* ---------- App links (sign in / sign up) ----------
     <meta name="msm-app" content="https://app.example"> prefixes links marked
     data-app-link when the site is hosted apart from the application. */
  function initAppLinks() {
    var base = meta('msm-app');
    if (!base) return;
    doc.querySelectorAll('a[data-app-link]').forEach(function (a) {
      a.setAttribute('href', base + a.getAttribute('data-app-link'));
    });
  }

  /* ---------- Live plans ---------- */
  var APP_LABEL = { safety: 'Messerschmidts Safety', eam: 'Messerschmidts EAM' };

  function validPlan(p) {
    return p && typeof p === 'object' &&
      (p.app === 'safety' || p.app === 'eam') &&
      typeof p.name === 'string' && p.name.length > 0;
  }

  function renderPlan(p, compact) {
    var card = el('article', { 'class': 'plan' });
    if (p.app === 'safety' && Number(p.price_php) > 0 && !compact) card.classList.add('featured');
    card.appendChild(el('p', { 'class': 'app-name' }, APP_LABEL[p.app]));
    card.appendChild(el('h3', null, p.name));

    var price = el('div', { 'class': 'price' });
    var hasPrice = typeof p.price_php === 'number' && isFinite(p.price_php);
    if (hasPrice) {
      price.appendChild(el('span', { 'class': 'amount' }, p.price_php === 0 ? '₱0' : peso(p.price_php)));
      var per = p.unit === 'org' ? 'per organisation / month' : 'per user / month';
      price.appendChild(el('span', { 'class': 'per' }, per));
    } else {
      price.appendChild(el('span', { 'class': 'soon' }, 'Coming soon'));
    }
    card.appendChild(price);

    // Organisation plans (e.g. EAM Standard): users included and price per extra user.
    var included = Number(p.included_users);
    var hasIncluded = typeof p.included_users === 'number' && isFinite(included) && included > 0;
    var hasExtra = typeof p.extra_user_php === 'number' && isFinite(p.extra_user_php) && p.extra_user_php > 0;
    if (hasIncluded || hasExtra) {
      var orgLines = [];
      if (hasIncluded) orgLines.push('Up to ' + included.toLocaleString('en-PH') + ' users included.');
      if (hasExtra) orgLines.push(peso(p.extra_user_php) + ' per additional user / month.');
      card.appendChild(el('p', { 'class': 'plan-extra' }, orgLines.join(' ')));
    }

    var trial = Number(p.trial_days);
    var shown = trialText(p.app, 'day');
    if (shown) {
      card.appendChild(el('p', { 'class': 'sub' }, shown + ' free trial for a new organisation that picks ' + (p.app === 'safety' ? 'Safety' : p.app === 'eam' ? 'EAM' : 'this app') + ' at sign-up'));
    }
    if (typeof p.description === 'string' && p.description) {
      card.appendChild(el('p', { 'class': 'sub' }, p.description));
    }
    if (typeof p.subcon_price_php === 'number' && isFinite(p.subcon_price_php)) {
      card.appendChild(el('p', { 'class': 'plan-extra' },
        'Invited subcontractor account: ' + peso(p.subcon_price_php) +
        ' per month when it works only on the site(s) of the account that invited it. A subcontractor account that opens a new site of its own pays the full user price.'));
    }
    if (!compact && Array.isArray(p.features) && p.features.length) {
      var ul = el('ul');
      p.features.slice(0, 20).forEach(function (f) {
        // The trial line above comes from TRIALS; skip a server feature that states its own trial length.
        if (typeof f === 'string' && f && !/\b(free|trial|demo)\b.*\b(month|days?|trial|demo)\b/i.test(f)) ul.appendChild(el('li', null, f));
      });
      card.appendChild(ul);
    }
    if (p.unit === 'org' && hasPrice) {
      var quote = el('p', { 'class': 'sub' }, 'Bigger organisation? ');
      quote.appendChild(el('a', { href: 'mailto:customerservice@messerschmidts.online' }, 'Ask us for a quote'));
      quote.appendChild(doc.createTextNode('.'));
      card.appendChild(quote);
    }
    var cta;
    if (hasPrice && p.unit === 'org' && !(trial > 0)) {
      cta = el('a', { 'class': 'btn btn-primary', href: 'contact.html?topic=' + p.app }, 'Talk to us');
    } else if (hasPrice) {
      cta = el('a', { 'class': 'btn btn-primary', href: '/#/account/signup', 'data-app-link': '/#/account/signup' },
        trial > 0 ? 'Start free demo' : 'Request an account');
    } else {
      cta = el('a', { 'class': 'btn btn-secondary', href: 'contact.html' }, 'Talk to us');
    }
    card.appendChild(cta);
    return card;
  }

  /* Payment methods from the server: [{name, kind}], grouped by kind. */
  var PAY_KINDS = [['ewallet', 'E-wallets:'], ['card', 'Cards:'], ['qr', 'QR:'], ['bank', 'Banks:'], ['crypto', 'Crypto:']];
  function renderPayMethods(methods) {
    if (!Array.isArray(methods) || !methods.length) return;
    var lists = doc.querySelectorAll('ul[data-pay-methods]');
    if (!lists.length) return;
    var groups = PAY_KINDS.map(function (k) {
      var names = methods.filter(function (m) {
        return m && typeof m === 'object' && m.kind === k[0] && typeof m.name === 'string' && m.name.trim();
      }).map(function (m) { return m.name.trim(); });
      return [k[1], names];
    }).filter(function (g) { return g[1].length; });
    if (!groups.length) return; // keep static list
    lists.forEach(function (ul) {
      while (ul.firstChild) ul.removeChild(ul.firstChild);
      groups.forEach(function (g) {
        var li = el('li');
        li.appendChild(el('b', null, g[0]));
        li.appendChild(doc.createTextNode(' ' + g[1].join(', ')));
        ul.appendChild(li);
      });
    });
  }

  function initPlans() {
    var targets = doc.querySelectorAll('[data-plans]');
    if ((!targets.length && !doc.querySelector('[data-live-price]') && !doc.querySelector('[data-pay-methods]')) || !window.fetch) return;
    var url = meta('msm-api') + '/api/platform/subscriptions/public';
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        clearTimeout(timer);
        if (data && typeof data === 'object') renderPayMethods(data.payment_methods);
        var plans = data && Array.isArray(data.plans) ? data.plans.filter(validPlan) : [];
        applyServerTrials(data, plans);
        if (!plans.length) return;
        targets.forEach(function (t) {
          var app = t.getAttribute('data-plans');
          var compact = t.hasAttribute('data-compact');
          var mine = plans.filter(function (p) { return p.app === app; });
          if (!mine.length) return; // keep static content
          while (t.firstChild) t.removeChild(t.firstChild);
          mine.forEach(function (p) { t.appendChild(renderPlan(p, compact)); });
          t.classList.toggle('three', mine.length >= 3);
          t.setAttribute('data-live', 'true');
        });
        doc.querySelectorAll('[data-plans-status]').forEach(function (s) {
          s.textContent = 'Prices shown are the current prices from our server.';
        });
        // Single price figures (e.g. the Home summary).
        doc.querySelectorAll('[data-live-price]').forEach(function (n) {
          var app = n.getAttribute('data-live-price');
          var p = plans.filter(function (x) { return x.app === app && typeof x.price_php === 'number' && x.price_php > 0; })[0];
          if (p) n.textContent = peso(p.price_php);
        });
        // Keep calculator in step with the live Safety price.
        var safety = plans.filter(function (p) { return p.app === 'safety' && typeof p.price_php === 'number' && p.price_php > 0; })[0];
        if (safety) {
          var calc = doc.getElementById('calc');
          if (calc) {
            calc.setAttribute('data-user', String(safety.price_php));
            if (typeof safety.subcon_price_php === 'number') calc.setAttribute('data-subcon', String(safety.subcon_price_php));
            updateCalc();
          }
        }
        // Keep the EAM estimator in step with the live organisation plan.
        var eam = plans.filter(function (p) { return p.app === 'eam' && p.unit === 'org' && typeof p.price_php === 'number' && p.price_php > 0; })[0];
        var calcEam = doc.getElementById('calc-eam');
        if (eam && calcEam) {
          calcEam.setAttribute('data-base', String(eam.price_php));
          if (typeof eam.included_users === 'number') calcEam.setAttribute('data-included', String(eam.included_users));
          if (typeof eam.extra_user_php === 'number') calcEam.setAttribute('data-extra', String(eam.extra_user_php));
          updateCalcEam();
        }
        initAppLinks();
      })
      .catch(function () { clearTimeout(timer); /* keep static content */ });
  }

  /* ---------- Pricing calculator ---------- */
  function num(id) {
    var i = doc.getElementById(id);
    var v = i ? parseInt(i.value, 10) : 0;
    return isFinite(v) && v > 0 ? Math.min(v, 100000) : 0;
  }
  function updateCalc() {
    var calc = doc.getElementById('calc');
    if (!calc) return;
    var user = numOr(calc.getAttribute('data-user'), 1000);
    var sub = numOr(calc.getAttribute('data-subcon'), 100);
    var u = num('calc-users'), s = num('calc-sub-same'), o = num('calc-sub-other');
    var lines = [
      [u + ' user' + (u === 1 ? '' : 's') + ' × ' + peso(user), u * user],
      [s + ' subcontractor account' + (s === 1 ? '' : 's') + ', your site(s) × ' + peso(sub), s * sub],
      [o + ' subcontractor account' + (o === 1 ? '' : 's') + ', own site × ' + peso(user), o * user]
    ];
    renderCalc('calc-lines', 'calc-total', lines);
  }
  function renderCalc(listId, totalId, lines) {
    var list = doc.getElementById(listId);
    if (list) {
      while (list.firstChild) list.removeChild(list.firstChild);
      lines.forEach(function (l) {
        var li = el('li');
        li.appendChild(el('span', null, l[0]));
        li.appendChild(el('strong', null, peso(l[1])));
        list.appendChild(li);
      });
    }
    var total = lines.reduce(function (a, l) { return a + l[1]; }, 0);
    var out = doc.getElementById(totalId);
    if (out) out.textContent = peso(total);
  }
  // EAM: one price per organisation with users included, plus a price per extra user.
  function updateCalcEam() {
    var calc = doc.getElementById('calc-eam');
    if (!calc) return;
    var base = numOr(calc.getAttribute('data-base'), 20000);
    var included = numOr(calc.getAttribute('data-included'), 25);
    var extra = numOr(calc.getAttribute('data-extra'), 750);
    var u = num('calc-eam-users');
    var more = Math.max(0, u - included);
    renderCalc('calc-eam-lines', 'calc-eam-total', [
      ['Organisation, up to ' + included + ' users', base],
      [more + ' additional user' + (more === 1 ? '' : 's') + ' × ' + peso(extra), more * extra]
    ]);
  }
  // Construction: the organisation and its first site, plus a price per additional site.
  var PIN_MAX = 12;
  var lastSites = 0;
  function updateCalcBuild() {
    var calc = doc.getElementById('calc-build');
    if (!calc) return;
    var base = numOr(calc.getAttribute('data-base'), 50000);
    var site = numOr(calc.getAttribute('data-site'), 15000);
    var n = Math.max(1, Math.min(num('calc-build-sites'), 200));
    var more = n - 1;
    renderCalc('calc-build-lines', 'calc-build-total', [
      ['Organisation and its first site', base],
      [more + ' additional site' + (more === 1 ? '' : 's') + ' × ' + peso(site), more * site]
    ]);
    var pins = doc.getElementById('calc-build-pins');
    if (pins) {
      while (pins.firstChild) pins.removeChild(pins.firstChild);
      var shown = Math.min(n, PIN_MAX);
      for (var i = 1; i <= shown; i++) {
        var li = el('li', null, i === 1 ? '1st' : String(i));
        if (i === 1) li.className = 'inc';
        if (i > lastSites) li.classList.add('new');
        pins.appendChild(li);
      }
      if (n > PIN_MAX) pins.appendChild(el('li', { 'class': 'more' }, '+' + (n - PIN_MAX)));
    }
    lastSites = n;
  }
  function initCalcBuild() {
    var calc = doc.getElementById('calc-build');
    if (!calc) return;
    calc.hidden = false;
    var input = doc.getElementById('calc-build-sites');
    calc.addEventListener('input', updateCalcBuild);
    calc.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!input) return;
        var v = Math.max(1, Math.min((parseInt(input.value, 10) || 1) + Number(b.getAttribute('data-step')), 200));
        input.value = String(v);
        updateCalcBuild();
      });
    });
    updateCalcBuild();
  }

  function initCalc() {
    initCalcBuild();
    var calc = doc.getElementById('calc');
    if (calc) {
      calc.hidden = false;
      calc.addEventListener('input', updateCalc);
      updateCalc();
    }
    var calcEam = doc.getElementById('calc-eam');
    if (calcEam) {
      calcEam.hidden = false;
      calcEam.addEventListener('input', updateCalcEam);
      updateCalcEam();
    }
  }

  /* ---------- Contact form -> mailto ---------- */
  /* contact.html?topic=eam|safety|construction|pricing|server|support preselects the topic,
     and the demo buttons above the form set it with one tap. */
  var TOPICS = {
    eam: 'Messerschmidts EAM',
    safety: 'Messerschmidts Safety demo',
    construction: 'Messerschmidts Construction demo',
    pricing: 'Pricing and payment',
    server: 'Running on our own server',
    support: 'Support'
  };
  function setTopic(form, value) {
    var sel = form.elements.topic;
    if (!sel) return false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].text === value) { sel.selectedIndex = i; break; }
    }
    form.querySelectorAll('[data-topic]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-topic') === sel.value ? 'true' : 'false');
    });
    return true;
  }
  function initTopic(form) {
    var m = /[?&]topic=([a-z]+)/.exec(window.location.search);
    if (m && TOPICS[m[1]]) setTopic(form, TOPICS[m[1]]);
    var pick = form.querySelector('[data-demo-pick]');
    if (pick) {
      pick.hidden = false;
      pick.querySelectorAll('[data-topic]').forEach(function (b) {
        b.addEventListener('click', function () {
          setTopic(form, b.getAttribute('data-topic'));
          var msg = form.elements.message;
          if (msg) msg.focus();
        });
      });
    }
    var sel = form.elements.topic;
    if (sel) sel.addEventListener('change', function () { setTopic(form, sel.value); });
    if (sel) setTopic(form, sel.value);
  }

  /* ---------- Product tour tabs (WAI-ARIA tabs; without JS every panel shows) ---------- */
  function initTabs() {
    doc.querySelectorAll('[data-tabs]').forEach(function (box) {
      var tabs = Array.prototype.slice.call(box.querySelectorAll('[role="tab"]'));
      if (!tabs.length) return;
      function select(tab, focus) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
          var p = doc.getElementById(t.getAttribute('aria-controls'));
          if (!p) return;
          if (on && p.hidden) {
            p.hidden = false;
            p.classList.remove('is-entering');
            void p.offsetWidth; // restart the entrance animation
            p.classList.add('is-entering');
          } else if (!on) {
            p.hidden = true;
          }
        });
        if (focus) tab.focus();
      }
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { select(t, false); });
        t.addEventListener('keydown', function (e) {
          var k = e.key, j = null;
          if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % tabs.length;
          else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
          else if (k === 'Home') j = 0;
          else if (k === 'End') j = tabs.length - 1;
          if (j !== null) { e.preventDefault(); select(tabs[j], true); }
        });
      });
      select(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0], false);
    });
  }

  function initContact() {
    var form = doc.getElementById('contact-form');
    if (!form) return;
    initTopic(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (n) { var f = form.elements[n]; return f ? String(f.value || '').trim() : ''; };
      var topic = v('topic') || 'General question';
      var body = [
        'Name: ' + v('name'),
        'Organisation: ' + v('org'),
        'Phone: ' + v('phone'),
        'Topic: ' + topic,
        '',
        v('message')
      ].join('\n');
      var href = 'mailto:customerservice@messerschmidts.online' +
        '?subject=' + encodeURIComponent('[Website] ' + topic + (v('org') ? ' - ' + v('org') : '')) +
        '&body=' + encodeURIComponent(body);
      window.location.href = href;
      var note = doc.getElementById('contact-note');
      if (note) note.textContent = 'Your e-mail app should open with the message ready to send. If nothing happens, write to customerservice@messerschmidts.online.';
    });
  }

  /* ---------- Misc ---------- */
  function initYear() {
    doc.querySelectorAll('[data-year]').forEach(function (n) { n.textContent = String(new Date().getFullYear()); });
  }
  function initPrint() {
    window.addEventListener('beforeprint', function () {
      doc.querySelectorAll('details:not([open])').forEach(function (d) { d.setAttribute('open', ''); d.setAttribute('data-print-open', ''); });
    });
    window.addEventListener('afterprint', function () {
      doc.querySelectorAll('details[data-print-open]').forEach(function (d) { d.removeAttribute('open'); d.removeAttribute('data-print-open'); });
    });
  }

  /* ---------- Motion helpers ---------- */
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var hasIO = 'IntersectionObserver' in window;

  /* ---------- Process graphs ----------
     Lights the nodes of each [data-flow] one by one when it scrolls into view.
     The <ol> text is always present; with reduced motion (or no observer)
     every node is lit at once. */
  function initFlows() {
    var flows = doc.querySelectorAll('[data-flow]');
    if (!flows.length) return;
    var STEP_MS = 420;
    flows.forEach(function (flow) {
      var steps = flow.querySelectorAll('.flow-step');
      var timers = [];
      function lightAll() {
        steps.forEach(function (s) { s.classList.add('is-on'); });
        flow.classList.add('is-done');
      }
      function play() {
        timers.forEach(clearTimeout);
        timers = [];
        flow.classList.remove('is-done');
        steps.forEach(function (s) { s.classList.remove('is-on'); });
        steps.forEach(function (s, i) {
          timers.push(setTimeout(function () { s.classList.add('is-on'); }, 120 + i * STEP_MS));
        });
        timers.push(setTimeout(function () { flow.classList.add('is-done'); }, 120 + steps.length * STEP_MS));
      }
      if (reduceMotion || !hasIO) { lightAll(); return; }
      var replay = flow.querySelector('.flow-replay');
      if (replay) {
        replay.hidden = false;
        replay.addEventListener('click', play);
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { io.disconnect(); play(); }
        });
      }, { threshold: 0.35 });
      io.observe(flow);
    });
  }

  /* ---------- Reveal on scroll ----------
     Only for blocks that start below the first screen, so nothing visible
     at load ever flickers. Opacity/transform only: no layout shift. */
  function initReveal() {
    // Deep links (#section) jump straight to content: never hide it there.
    if (reduceMotion || !hasIO || window.location.hash) return;
    var sel = '.section .section-head, .section .grid > *, .offers > *, .plans > *, .flow, .split > *, .cta-band, .table-wrap, .faq-group, .section .panel';
    var vh = window.innerHeight || doc.documentElement.clientHeight;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    var nodes = Array.prototype.slice.call(doc.querySelectorAll(sel));
    var tops = nodes.map(function (n) { return n.getBoundingClientRect().top; });
    nodes.forEach(function (n, i) {
      if (tops[i] < vh) return;
      if (n.closest('.hero, .page-hero')) return;
      if (n.parentElement && n.parentElement.closest('.rv')) return; // parent already reveals
      var idx = Array.prototype.indexOf.call(n.parentElement.children, n);
      n.style.setProperty('--rv-d', Math.min(idx, 5) * 70 + 'ms');
      n.classList.add('rv');
      io.observe(n);
    });
    // Make sure printing never hides anything.
    window.addEventListener('beforeprint', function () {
      doc.querySelectorAll('.rv').forEach(function (n) { n.classList.add('in'); });
    });
  }

  /* ---------- Header dropdowns (disclosure pattern) ----------
     Each .menu-toggle button shows/hides the panel it controls. Escape closes the
     open panel and returns focus to its button; a click outside or focus leaving
     the item closes it too. Without JS, CSS opens panels on hover/focus. */
  function initMenus() {
    var items = doc.querySelectorAll('.has-menu');
    if (!items.length) return;
    function setOpen(li, open) {
      var b = li.querySelector('.menu-toggle');
      li.classList.toggle('is-open', open);
      if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function closeAll(except) {
      items.forEach(function (li) { if (li !== except) setOpen(li, false); });
    }
    items.forEach(function (li) {
      var b = li.querySelector('.menu-toggle');
      if (!b) return;
      b.addEventListener('click', function () {
        var open = !li.classList.contains('is-open');
        closeAll(li);
        setOpen(li, open);
      });
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && li.classList.contains('is-open')) {
          e.stopPropagation();
          setOpen(li, false);
          b.focus();
        }
      });
      li.addEventListener('focusout', function (e) {
        if (e.relatedTarget && !li.contains(e.relatedTarget)) setOpen(li, false);
      });
    });
    doc.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('.has-menu')) closeAll(null);
    });
  }

  /* ---------- Counters ----------
     [data-count] figures count up from zero once when they scroll into view.
     The final text is in the HTML, so without JS or with reduced motion it simply shows. */
  function initCounters() {
    var nodes = doc.querySelectorAll('[data-count]');
    if (!nodes.length || reduceMotion || !hasIO || !window.requestAnimationFrame) return;
    nodes.forEach(function (n) {
      var text = n.textContent;
      var m = text.match(/^(\D*)([\d.,]+)(.*)$/);
      if (!m) return;
      var target = parseFloat(m[2].replace(/,/g, ''));
      if (!isFinite(target)) return;
      var dec = (m[2].split('.')[1] || '').length;
      var fmt = function (v) {
        return m[1] + v.toLocaleString('en-PH', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3];
      };
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          io.disconnect();
          var t0 = null, dur = 1200;
          function step(ts) {
            if (t0 === null) t0 = ts;
            var k = Math.min(1, (ts - t0) / dur);
            var eased = 1 - Math.pow(1 - k, 3);
            n.textContent = fmt(target * eased);
            if (k < 1) window.requestAnimationFrame(step); else n.textContent = text;
          }
          n.textContent = fmt(0);
          window.requestAnimationFrame(step);
        });
      }, { threshold: 0.4 });
      io.observe(n);
    });
  }

  /* Marks [data-inview] blocks (and .platform) once visible, so their CSS
     animations start when seen rather than off-screen. */
  function initInView() {
    var nodes = doc.querySelectorAll('.platform, [data-inview]');
    if (!nodes.length) return;
    if (reduceMotion || !hasIO) { nodes.forEach(function (n) { n.classList.add('in-view'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); }
      });
    }, { threshold: 0.25 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  function init() {
    initTrials();
    initTabs();
    initMenus();
    initCounters();
    initInView();
    initNav();
    initAppLinks();
    initYear();
    initCalc();
    initContact();
    initPrint();
    initFlows();
    initReveal();
    initPlans();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
