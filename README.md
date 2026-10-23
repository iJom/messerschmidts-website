# Messerschmidts marketing website

Static site for **Messerschmidts EAM** and **Messerschmidts Safety**. Plain HTML, one CSS file and one JS file. No build step, no external CDNs, fonts, analytics or trackers. All code is our own.

## Pages

| File | Page |
|---|---|
| `index.html` | Home: hero, products, features, how it works, industries, example scenario, price summary, FAQ teaser |
| `eam.html` | Messerschmidts EAM |
| `safety.html` | Messerschmidts Safety |
| `pricing.html` | Subscription: Safety plans, subcontractor rules, price estimator, EAM Plan 1-3, payment |
| `industries.html` | Solar and power plants, construction, facilities, manufacturing (`#solar`, `#construction`, ...) |
| `about.html`, `contact.html`, `faq.html` | About, contact (form opens the visitor's e-mail app), FAQ |
| `privacy.html`, `terms.html` | **Drafts** for a lawyer to review (marked on the page) |
| `404.html` | Not-found page (uses root-relative links, so it works at any path) |
| `assets/site.css`, `assets/site.js`, `assets/logo.svg` | Shared styles, script, logo/favicon |

## Editing text and prices

Edit the HTML files directly; header and footer are repeated in each page, so change them in every file (search and replace).
Static prices appear in `index.html` (summary), `pricing.html` (cards, table, example, calculator defaults `data-user="500" data-subcon="50"`), `safety.html`, `faq.html` and `terms.html`. Always write pesos as `&#8369;` (₱), never `$`.

## Live prices from the server

`assets/site.js` requests `GET {API}/api/platform/subscriptions/public`, where `{API}` is the `content` of `<meta name="msm-api" content="">` in each page (empty = same origin). Expected JSON:

```json
{"plans":[{"app":"safety","code":"premium","name":"Premium","price_php":500,"unit":"user",
  "subcon_price_php":50,"trial_days":30,"description":"...","features":["..."]}]}
```

If plans are returned for an app, the cards in `[data-plans="safety"]` / `[data-plans="eam"]` are replaced (all server text is inserted with `textContent`, never `innerHTML`), the Home price (`data-live-price`) and the calculator are updated. If the request fails, times out (6 s) or returns no plans, the static content stays. A plan with `price_php: null` shows "Coming soon" and a "Talk to us" button. When the site is on a different origin than the API, the server must allow CORS for that endpoint.

## Sign-in and sign-up links

"Sign in" links go to `/` and "Start free demo" / "Request an account" to `/#/account/signup`, which assumes the site is served by the same host as the application. If the site is hosted elsewhere, set `<meta name="msm-app" content="https://messerschmidts.online">` and the script rewrites those links (`data-app-link`).

## Hosting (free)

- **Any static host** (GitHub Pages, Cloudflare Pages, Netlify free tier, etc.): upload this folder as-is; set `msm-api` and `msm-app` to the application's address. Configure `404.html` as the not-found page if the host asks.
- **Behind the same server** as the application: serve this folder as static files (for example at `www.messerschmidts.online`, or at the root with the app's paths routed separately). Leave both meta tags empty.
- Local preview: `python3 -m http.server 8080` in this folder, then open http://localhost:8080/.

## Checks

Pages are responsive down to 360 px, have landmarks, skip link, visible focus styles, light/dark themes via `prefers-color-scheme`, and print in light colours (header and interactive parts hidden, FAQ answers expanded).
