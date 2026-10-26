# Messerschmidts marketing website

Static site for **Messerschmidts EAM**, **Messerschmidts Safety** and **Messerschmidts Construction**. Plain HTML, one CSS file and one JS file. No build step, no external CDNs, analytics or trackers; the one web font is self-hosted. All code is our own; the headline font is OFL-licensed (see Design notes).

## Pages

| File | Page |
|---|---|
| `index.html` | Company home page: hero about Messerschmidts, three offerings (EAM for Power Plants, HSSE, Construction, all live), why Messerschmidts, price summary, contact |
| `eam.html` | Messerschmidts EAM |
| `safety.html` | Messerschmidts Safety |
| `construction.html` | Messerschmidts Construction (live since app release 4.13.0) |
| `pricing.html` | Subscription: Safety plans, subcontractor rules, Safety estimator, EAM Standard and quote, EAM estimator, Construction plan (`#construction`), payment and renewal |
| `industries.html` | Power plants first (`#solar`, `#power` for wind/hydro/geothermal/biomass/diesel, `#grid` for substations and transmission, `#records` for maintenance and DOLE safety records), then `#construction`, `#facilities`, `#manufacturing` |
| `about.html`, `contact.html`, `faq.html` | About, contact (form opens the visitor's e-mail app), FAQ |
| `privacy.html` | Privacy policy v1.0 (last updated 25 Oct 2026): RA 10173 first, then GDPR and California (CCPA/CPRA) sections; browser storage table, sharing, transfers, security and 72-hour breach notice, rights and response times, retention, children, change history |
| `terms.html` | Website terms of use v1.0: site rules, content ownership, third-party links, no warranty, liability, Philippine law with mediation / small claims / venue, subscription summary; the apps themselves are governed by the in-app License Agreement |
| `disclaimer.html` | Disclaimer v1.0: accuracy, use, damages, other users, safety (RA 11058 / DOLE), weather and Day Ahead Nominations, regulatory reports (ERC / DOE / NGCP / IEMOP), permits lists (LGU), calculations (EVM, billing, tax) |
| `404.html` | Not-found page (uses root-relative links, so it works at any path) |
| `assets/site.css`, `assets/site.js`, `assets/logo.svg` | Shared styles, script, logo/favicon |
| `favicon.ico`, `assets/apple-touch-icon.png` | Fallback favicon (16/32/48 px) and 180 px home-screen icon, drawn from the logo |

## Legal pages

The three legal pages are linked in every footer (Account column) and from the apps' sign-in page, Settings and LEGAL page. They have **not been reviewed by a lawyer** yet (banner on each page). Placeholders in [square brackets] still to fill: `[COMPANY ADDRESS]`, `[DPO NAME]`, `[NPC REGISTRATION NUMBER, if registration applies]`, `[EU REPRESENTATIVE, if one is appointed]`. When a page changes, update its version and "last updated" date (format: 25 Oct 2026) and add a row to its change history table. If the browser storage the apps use changes, update the table in `privacy.html`.

## Editing text and prices

Edit the HTML files directly; header and footer are repeated in each page, so change them in every file (search and replace).
Static prices appear in the meta descriptions and in `index.html` (summary), `pricing.html` (cards, table, worked examples, Safety calculator defaults `data-user="1000" data-subcon="100"`, EAM calculator defaults `data-base="20000" data-included="25" data-extra="750"`), `safety.html`, `eam.html`, `faq.html`, `industries.html` and `terms.html`. Always write pesos as `&#8369;` (₱), never `$`.

Current prices (owner, 2026-10-23):

- Messerschmidts Safety Premium: ₱1,000 per user per month. First month free for a new organisation.
- Subcontractor account invited by a user, working only on the inviter's site(s): ₱100 per month.
- Subcontractor account that opens a new site of its own (for example an EPC or main contractor registered as a subcontractor): full ₱1,000.
- Messerschmidts EAM Standard: ₱20,000 per month per organisation, up to 25 users included, ₱750 per month for each additional user. Bigger organisations: quote via customerservice@messerschmidts.online.
- Messerschmidts Construction (release 4.13.0): ₱50,000 per month per organisation including its first site; each additional site ₱15,000 a month, activated when paid (first month prorated to the renewal date); 30-day free trial. Includes Safety for the organisation's own users on its sites; Subcontractor accounts on the organisation's sites are included too. Not yet: 3D BIM viewer, design submittal review, stamped PDF export.
- Payment: GCash, Maya, cards, QR Ph and online banking through PayMongo, and USDT on TRON (detected automatically). Payments are verified automatically by the system and the plan activates instantly, with no manual confirmation.
- Renewal: an administrator subscribes or renews in Settings > Subscription; the app reminds administrators by e-mail and with a banner 7, 3 and 1 days before the free trial or paid month ends.

## Live prices from the server

`assets/site.js` requests `GET {API}/api/platform/subscriptions/public`, where `{API}` is the `content` of `<meta name="msm-api" content="">` in each page (empty = same origin). Expected JSON:

```json
{"plans":[{"app":"safety","code":"premium","name":"Premium","price_php":1000,"unit":"user",
  "subcon_price_php":100,"trial_days":30,"description":"...","features":["..."]},
 {"app":"eam","code":"standard","name":"Standard","price_php":20000,"unit":"org",
  "included_users":25,"extra_user_php":750,"description":"...","features":["..."]}],
 "payment_methods":[{"name":"GCash","kind":"ewallet"},{"name":"UnionBank","kind":"bank"},
  {"name":"USDT on TRON (TRC-20)","kind":"crypto"}]}
```

If plans are returned for an app, the cards in `[data-plans="safety"]` / `[data-plans="eam"]` are replaced (all server text is inserted with `textContent`, never `innerHTML`), the Home prices (`data-live-price`) and both calculators are updated. A plan with `unit: "org"` shows "per organisation / month", plus "Up to N users included" (`included_users`), "₱X per additional user / month" (`extra_user_php`) and a quote link. If `payment_methods` is present and non-empty, the items of `<ul data-pay-methods>` on the Subscription page are replaced with the names grouped by `kind` (`ewallet` = E-wallets, `card` = Cards, `qr` = QR, `bank` = Banks, `crypto` = Crypto; other kinds are ignored); otherwise the static list stays. If the request fails, times out (6 s) or returns no plans, the static content stays. A plan with `price_php: null` shows "Coming soon" and a "Talk to us" button. When the site is on a different origin than the API, the server must allow CORS for that endpoint.

## Sign-in and sign-up links

"Sign in" links go to `/` and "Start free demo" / "Request an account" to `/#/account/signup`, which assumes the site is served by the same host as the application. If the site is hosted elsewhere, set `<meta name="msm-app" content="https://messerschmidts.online">` and the script rewrites those links (`data-app-link`).

## Hosting (free)

- **Any static host** (GitHub Pages, Cloudflare Pages, Netlify free tier, etc.): upload this folder as-is; set `msm-api` and `msm-app` to the application's address. Configure `404.html` as the not-found page if the host asks.
- **Behind the same server** as the application: serve this folder as static files (for example at `www.messerschmidts.online`, or at the root with the app's paths routed separately). Leave both meta tags empty.
- Local preview: `python3 -m http.server 8080` in this folder, then open http://localhost:8080/.

## Design notes (v2, Oct 2026)

The look is an "energised single-line diagram": grid-navy chrome, high-vis amber for action, cyan for EAM, emerald for Safety, rebar rust and hazard stripes for Construction. Display type is **Barlow Semi Condensed Bold** by The Barlow Project Authors (github.com/jpt/barlow), licensed under the **SIL Open Font License 1.1** (`assets/fonts/OFL.txt`). It is self-hosted as a Latin subset, `assets/fonts/BarlowSemiCondensed-Bold-latin.woff2` (about 20 KB: Basic Latin, Latin-1, dashes, curly quotes, bullet, ellipsis), loaded with `font-display: swap` and preloaded on every page. Barlow has no peso sign, so the browser draws ₱ from the fallback font. Fallbacks: Bahnschrift and other condensed system faces. Body is the system UI font. No CDNs.

- **Tokens** live at the top of `assets/site.css` (colours, light and dark via `prefers-color-scheme`) plus a type scale in the v2 block (`--fs-*`, `--amber-ink` for amber lines/text on light surfaces). The header, heroes, CTA bands and `.chrome` sections are always navy.
- **One moment per page.** Home: a sun travelling a dotted arc over a PV array with a glint (`.hero-sky`, `.hero-pv`) and the energised busbar of key facts (`.bus-stats`, counters via `data-count`). Elsewhere the existing single-line hero art.
- **App screens** are illustrative HTML/SVG mock-ups with sample data, always captioned as such: EAM day-ahead nomination (`.screen-eam`, on Home and `eam.html#forecast`), Safety permit board (`.screen-safety`, Home and `safety.html#permits`), Construction S-curve (`.screen-build`, Home and `construction.html#dashboard`). They draw themselves once in view (`data-inview`). The Home tour is a WAI-ARIA tab set (`data-tabs`); without JS all three panels show.
- **Plans**: the featured plan has a slowly turning charged edge (`@property --ang`). Construction has a site estimator on `pricing.html` (`#calc-build`, `data-base="50000" data-site="15000"`).
- **Demo paths**: `contact.html?topic=eam|safety|construction|pricing|server|support` preselects the form topic; demo buttons above the form do the same. Legal pages end with a small "Looking for the apps?" strip (their texts are unchanged).
- **Motion** is always inside `prefers-reduced-motion: no-preference`; the default CSS state is the finished picture, so with reduced motion or no JS everything simply shows.
- Weight: CSS ~87 KB, JS ~28 KB, uncompressed; GitHub Pages serves them gzipped.

## Checks

Pages are responsive down to 360 px, have landmarks, skip link, visible focus styles, light/dark themes via `prefers-color-scheme`, and print in light colours (header and interactive parts hidden, FAQ answers expanded).
