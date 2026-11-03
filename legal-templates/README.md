# Legal templates and cookie consent

Drafts with `[Insert …]` placeholders. They are **not published** (excluded in `.assetsignore` and `robots.txt`). The live site already has its own filled-in `privacy.html` and `terms.html`; use these to fill gaps (for example a refund page) or for a new site. Have a Philippine lawyer review before publishing. These are templates, not legal advice.

| File | Covers |
|---|---|
| `privacy-policy.md` | RA 10173 and its IRR, NPC circulars (72-hour breach notice), GDPR and CCPA/CPRA add-ons |
| `terms-of-service.md` | Conduct, IP (RA 8293), payments, liability limits valid under the Civil Code, PH law and venue |
| `refund-return-shipping-policy.md` | Consumer Act, Internet Transactions Act 2023, DTI rules. Part A: subscriptions. Part B: goods |

## Cookie consent: `assets/consent.js`

### Where to put it
First script in `<head>`, straight after `<meta charset>`, **without** `async` or `defer`:

```html
<head>
<meta charset="utf-8">
<script src="assets/consent.js?v=1"></script>   <!-- 1st: decides before any tag can run -->
<!-- everything else, including any tracking tags, below this line -->
```

A synchronous script blocks the parser, so no tag below it can run first. It sets Google Consent Mode v2 to "denied" and stops there until the visitor chooses.

Footer link to reopen settings (already on every page; hidden until the manager is on):

```html
<a href="#" data-consent-open hidden>Cookie settings</a>
```

### Switch it on
It does nothing (no banner, no cookie) until a tracker is configured. Pick one:

1. **Built-in loaders**: set the IDs at the top of `consent.js`:
   ```js
   ga4: "G-XXXXXXX",        // analytics
   metaPixel: "1234567890", // marketing
   ```
2. **Any other tag**: change `type` to `text/plain` and add `data-consent`:
   ```html
   <script type="text/plain" data-consent="analytics" data-src="https://example.com/tag.js"></script>
   <script type="text/plain" data-consent="marketing">/* inline code */</script>
   ```
3. **Your own code**:
   ```js
   msmConsent.run("analytics", function () { /* runs only after opt-in */ });
   ```

Never paste a vendor's tag as a normal `<script>`. It would run before consent.

Then raise `?v=` in the include, add each tool by name to `privacy.html#cookies`, and if you add marketing, keep the "Do Not Sell or Share" wording.

### Test
- Preview without saving: `/?consent-preview=1`
- DevTools > Network: no `googletagmanager` / `facebook.net` request before Accept.
- Reset: `msmConsent.reset()` in the console.

### What it does for compliance
| Requirement | How |
|---|---|
| Prior consent (GDPR Art. 6/7, ePrivacy, RA 10173 Sec. 12) | Tags load only after opt-in; Consent Mode defaults denied |
| Equal choice | Accept All and Reject All look the same, on the first layer |
| No pre-ticked boxes | Analytics and Marketing start off; Essential locked on |
| Withdraw as easily as giving | Floating button + footer link; withdrawing deletes `_ga*`/`_fbp` cookies and reloads |
| Record of consent | `msm_consent` cookie: version, timestamp, choices; 180 days; re-asked when `version` changes |
| CCPA/CPRA | "Do Not Sell or Share" in the panel and footer when marketing is set; Global Privacy Control honoured |
| Accessible (WCAG 2.2 AA) | Native `<dialog>` (focus trap, Esc), labelled switches, 44px targets, visible focus, AA contrast, reduced motion |
