# Messerschmidts marketing website

Static site for **Messerschmidts EAM**, **Messerschmidts Safety** and **Messerschmidts Construction**. Plain HTML, one CSS file and one JS file. No build step, no external CDNs, fonts, analytics or trackers. All code is our own.

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
| `privacy.html`, `terms.html` | **Drafts** for a lawyer to review (marked on the page) |
| `404.html` | Not-found page (uses root-relative links, so it works at any path) |
| `assets/site.css`, `assets/site.js`, `assets/logo.svg` | Shared styles, script, logo/favicon |

## Editing text and prices

Edit the HTML files directly; header and footer are repeated in each page, so change them in every file (search and replace).
Static prices appear in the meta descriptions and in `index.html` (summary), `pricing.html` (cards, table, worked examples, Safety calculator defaults `data-user="1000" data-subcon="100"`, EAM calculator defaults `data-base="20000" data-included="25" data-extra="750"`), `safety.html`, `eam.html`, `faq.html`, `industries.html` and `terms.html`. Always write pesos as `&#8369;` (₱), never `$`.

Current prices (owner, 2026-10-23):

- Messerschmidts Safety Premium: ₱1,000 per user per month. First month free for a new organisation.
- Subcontractor account invited by a user, working only on the inviter's site(s): ₱100 per month.
- Subcontractor account that opens a new site of its own (for example an EPC or main contractor registered as a subcontractor): full ₱1,000.
- Messerschmidts EAM Standard: ₱20,000 per month per organisation, up to 25 users included, ₱750 per month for each additional user. Bigger organisations: quote via customerservice@messerschmidts.online.
- Messerschmidts Construction (release 4.13.0): ₱50,000 per month per organisation, any number of sites, 30-day free trial. Includes Safety for the organisation's own users on its sites; subcontractor accounts keep their own Safety price (₱100 per site); Security Gate accounts are free. Not yet: 3D BIM viewer, design submittal review, stamped PDF export.
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

## Checks

Pages are responsive down to 360 px, have landmarks, skip link, visible focus styles, light/dark themes via `prefers-color-scheme`, and print in light colours (header and interactive parts hidden, FAQ answers expanded).
