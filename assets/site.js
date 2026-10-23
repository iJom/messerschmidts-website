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

    var trial = Number(p.trial_days);
    if (isFinite(trial) && trial > 0) {
      card.appendChild(el('p', { 'class': 'sub' }, trial + '-day free Premium demo for a new organisation'));
    }
    if (typeof p.description === 'string' && p.description) {
      card.appendChild(el('p', { 'class': 'sub' }, p.description));
    }
    if (typeof p.subcon_price_php === 'number' && isFinite(p.subcon_price_php)) {
      card.appendChild(el('p', { 'class': 'plan-extra' },
        'Invited subcontractor account: ' + peso(p.subcon_price_php) +
        ' per month on the same site(s) as the inviter. On a site the inviter does not have, it is charged as a full user.'));
    }
    if (!compact && Array.isArray(p.features) && p.features.length) {
      var ul = el('ul');
      p.features.slice(0, 20).forEach(function (f) {
        if (typeof f === 'string' && f) ul.appendChild(el('li', null, f));
      });
      card.appendChild(ul);
    }
    var cta;
    if (hasPrice) {
      cta = el('a', { 'class': 'btn btn-primary', href: '/#/account/signup', 'data-app-link': '/#/account/signup' },
        trial > 0 ? 'Start free demo' : 'Request an account');
    } else {
      cta = el('a', { 'class': 'btn btn-secondary', href: 'contact.html' }, 'Talk to us');
    }
    card.appendChild(cta);
    return card;
  }

  function initPlans() {
    var targets = doc.querySelectorAll('[data-plans]');
    if ((!targets.length && !doc.querySelector('[data-live-price]')) || !window.fetch) return;
    var url = meta('msm-api') + '/api/platform/subscriptions/public';
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        clearTimeout(timer);
        var plans = data && Array.isArray(data.plans) ? data.plans.filter(validPlan) : [];
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
    var user = Number(calc.getAttribute('data-user')) || 500;
    var sub = Number(calc.getAttribute('data-subcon')) || 50;
    var u = num('calc-users'), s = num('calc-sub-same'), o = num('calc-sub-other');
    var lines = [
      [u + ' user' + (u === 1 ? '' : 's') + ' × ' + peso(user), u * user],
      [s + ' subcontractor account' + (s === 1 ? '' : 's') + ', same site × ' + peso(sub), s * sub],
      [o + ' invited account' + (o === 1 ? '' : 's') + ', other site × ' + peso(user), o * user]
    ];
    var list = doc.getElementById('calc-lines');
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
    var out = doc.getElementById('calc-total');
    if (out) out.textContent = peso(total);
  }
  function initCalc() {
    var calc = doc.getElementById('calc');
    if (!calc) return;
    calc.hidden = false;
    calc.addEventListener('input', updateCalc);
    updateCalc();
  }

  /* ---------- Contact form -> mailto ---------- */
  function initContact() {
    var form = doc.getElementById('contact-form');
    if (!form) return;
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

  function init() {
    initNav();
    initAppLinks();
    initYear();
    initCalc();
    initContact();
    initPrint();
    initPlans();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
