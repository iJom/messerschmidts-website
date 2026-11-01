#!/usr/bin/env node
// Regenerates the app previews shown in the website's slideshows.
//
//   node tools/capture-previews.mjs --server <app>/server [--python <python>] [--label "4.19.2"]
//
// What it does, in order:
//  1. Starts a built app server on a free localhost port with a NEW temporary data folder.
//     HSE_SMTP_* and PAYMONGO_* are removed from its environment, so it can never send
//     e-mail or touch payments.
//  2. Creates a demo organisation with the demo loader (`eam.manage create-demo`) and turns
//     on all three apps for it, the same as the console's NEW DEMO.
//  3. Activates one client device and signs in with the demo's own sample account
//     (admin@<code>.example), on localhost only.
//  4. Opens 9 screens (3 per app) in headless Chrome at 1280x800 @2x, encodes each in the
//     same browser (no image library needed) as webp + jpg at 1280w and 640w, and writes
//     them to assets/screens/ with stable names.
//  5. Writes assets/screens/previews.json (the manifest the pages read) with the capture
//     date, then stops the server and deletes the temporary data and Chrome profile.
//
// Needs Node 22+ (global fetch/WebSocket), Python with the app's requirements, and
// Chrome/Chromium/Edge. Installs nothing and contacts nothing but 127.0.0.1.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => {
  if (v.startsWith("--")) a.push([v.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return a;
}, []));
if (!args.server) { console.error("Usage: node tools/capture-previews.mjs --server <path to app/server> [--python python] [--out assets/screens] [--label 4.19.2] [--chrome path] [--keep]"); process.exit(2); }

const SERVER = path.resolve(String(args.server));
const PY = String(args.python || (process.platform === "win32" ? "python" : "python3"));
const OUT = path.resolve(String(args.out || path.join(REPO, "assets", "screens")));
const CODE = "dem";
const WHO = `admin@${CODE}.example`;
const CHROME = String(args.chrome || [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].find((p) => p && fs.existsSync(p)) || "");
if (!CHROME) { console.error("Chrome not found; pass --chrome <path>."); process.exit(2); }

// ---------- The 9 screens. Alt texts name only what the demo seed always contains. ----------
const APPS = {
  eam: { label: "EAM", short: "Assets, PM and work orders" },
  safety: { label: "Safety", short: "Permits, people and gates" },
  construction: { label: "Construction", short: "Project control" },
};
const PICK_SITE = (re) => `(() => { const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => ${re}.test(o.textContent))); if (!sel) return 'no picker'; const o = [...sel.options].find((x) => ${re}.test(x.textContent)); sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return o.textContent })()`;
const PLAN = [
  { app: "eam", file: "eam-dashboard", url: "/#/dashboard", wait: 7000, title: "Operations dashboard",
    alt: "Screenshot with sample data: the EAM operations dashboard of Demo Company's sample solar plant, with live AC output and irradiance, open and overdue work orders, active alarms, MTTR and preventive jobs to dispatch, OEE and availability gauges, open work by priority and asset health by tier." },
  { app: "eam", file: "eam-workorders", url: "/#/corrective", wait: 4000, title: "Corrective work orders",
    alt: "Screenshot with sample data: the EAM corrective maintenance list with tabs for open, high-priority and completed work orders, and sample jobs such as an inverter cooling fan failure raised by an IoT alarm and a string inverter fault reported by QR scan, each with its source, priority, status and due date." },
  { app: "eam", file: "eam-assets", url: "/#/assets", wait: 4000, title: "Asset register",
    act: "(async () => { const sl = (ms) => new Promise((r) => setTimeout(r, ms)); const row = (re) => [...document.querySelectorAll('[data-asset]')].find((e) => re.test(e.textContent)); const s = row(/SYS-IS1/); if (!s) return 'no sys'; s.querySelector('button[aria-label=Expand]')?.click(); await sl(1500); const b = row(/IS1-SINV-01/); if (!b) return 'no inv'; b.click(); return 'ok' })()", actWait: 4000,
    alt: "Screenshot with sample data: the EAM asset register with the sample plant's hierarchy and Block 1 Inverter Station opened; the detail panel of string inverter IS1-SINV-01 shows its model, commissioning date, health index, remaining life and book value in pesos." },
  { app: "safety", file: "safety-permits", url: "/hse/#/ptw", boot: 15000, wait: 5000, prep: PICK_SITE("/SITE-A-PH1/"), title: "Live permit-to-work board",
    alt: "Screenshot with sample data: the Safety live permit-to-work board for a sample solar plant, with the zoned site plot plan beside columns for draft, pending approval, approved, active, extended and suspended permits, including a hot work permit for a weld repair and a lifting permit for an inverter module." },
  { app: "safety", file: "safety-myday", url: "/hse/#/myday", wait: 4000, title: "My Day",
    alt: "Screenshot with sample data: the Safety My Day page for the site administrator, with today's heat index, the number of people on site and a queue of permits to work waiting for a signature, each with an Open to sign button." },
  { app: "safety", file: "safety-idcards", url: "/hse/#/competency", wait: 4000, keepModal: true,
    act: "(() => { const b = document.querySelector('[data-act=pp-card]'); if (!b) return 'none'; b.click(); return 'ok' })()", actWait: 4000, title: "Worker ID card",
    alt: "Screenshot with sample data: the Safety ID card editor for a sample cleaning-crew worker of a sample subcontractor, marked valid, showing the printable front with photo and the back with emergency contact, fit-to-work date and QR code for the gate." },
  { app: "construction", file: "construction-scurve", url: "/hse/construction.html#/cx/dashboard", boot: 15000, wait: 6000, prep: PICK_SITE("/PHASE 2/"), to: "^S-CURVE", off: 140, title: "Progress S-curve",
    alt: "Screenshot with sample data: the Construction dashboard S-curve of a sample solar farm project, planned against actual monthly progress with a revised line after the data date, and the earned value figures below it with SPI, CPI, budget at completion in pesos and the forecast finish against the planned finish." },
  { app: "construction", file: "construction-transmittals", url: "/hse/construction.html#/cx/transmittals", wait: 4000, to: "REPLIES ARE OVERDUE", off: 135, title: "Transmittals and correspondence",
    alt: "Screenshot with sample data: the Construction transmittals and correspondence register with an alert for overdue replies, counters for open items, documents awaiting review and transmittals, and sample transmittals for a method statement and the issued-for-construction drawings of footings and columns." },
  { app: "construction", file: "construction-deliveries", url: "/hse/construction.html#/cx/deliveries", wait: 4000, to: "^MESSERSCHMIDTS CONSTRUCTION · DELIVERY", off: 135, title: "Site deliveries",
    alt: "Screenshot with sample data: the Construction delivery board moving sample deliveries of rebar, ready-mix concrete and main switchgear from scheduled to inspected and stored, with late deliveries flagged, and crane bookings with a tower crane clash beside the laydown yard allocation." },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[previews]", ...a);
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });

// ---------- 1. Server with a throwaway data folder ----------
const short = process.platform === "win32" ? "C:/t" : os.tmpdir();
fs.mkdirSync(short, { recursive: true });
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "msm-previews-data-"));
const PROFILE = fs.mkdtempSync(path.join(short, "msmcap-"));
const PORT = Number(args.port) || await freePort();
const BASE = `http://127.0.0.1:${PORT}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(HSE_SMTP_|PAYMONGO_)/i.test(k)));
Object.assign(env, { EAM_DATA_DIR: DATA, EAM_PORT: String(PORT), PYTHONPATH: SERVER, PYTHONUTF8: "1" });

let server = null, chrome = null;
function cleanup() {
  try { chrome && chrome.kill(); } catch {}
  try { server && (process.platform === "win32" ? spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" }) : server.kill()); } catch {}
  if (args.keep) return log("kept", DATA, PROFILE);
  for (const d of [DATA, PROFILE]) for (let i = 0; i < 10; i++) { try { fs.rmSync(d, { recursive: true, force: true }); break; } catch { spawnSync(process.execPath, ["-e", "setTimeout(()=>{},500)"]); } }
}
process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));

function manage(...a) {
  const r = spawnSync(PY, ["-m", "eam.manage", ...a], { cwd: SERVER, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`manage ${a[0]} failed: ${(r.stderr || "").slice(-800)}`);
  return r.stdout; // not printed: init-server output holds the superuser password
}
log("server data", DATA);
manage("init-server");
manage("create-demo", CODE);
const en = spawnSync(PY, ["-c", `from eam.db import session\nwith session() as db: db.x("UPDATE tenants SET apps = 'all' WHERE code = ?", ${JSON.stringify(CODE)})`], { cwd: SERVER, env, encoding: "utf8" });
if (en.status !== 0) throw new Error("could not enable all apps: " + en.stderr);
server = spawn(PY, ["-m", "uvicorn", "eam.main:app", "--host", "127.0.0.1", "--port", String(PORT)], { cwd: SERVER, env, stdio: "ignore" });
for (let i = 0; ; i++) { try { if ((await fetch(BASE + "/")).ok) break; } catch {} if (i > 240) throw new Error("server did not start"); await sleep(500); }
log("server up on", BASE);

// ---------- 2. Device activation and the demo's sample accounts ----------
const api = async (method, p, body, tok) => { const r = await fetch(BASE + p, { method, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return [r.status, j]; };
const txt = fs.readFileSync(path.join(DATA, "secrets", `demo-${CODE}.txt`), "utf8");
const code = (txt.match(/Client activation code[^\n]*\n(\S+)/) || [])[1];
const users = {}; for (const m of txt.matchAll(/^\s+(\w+)\s+(\S+@\S+\.example)\s+(\S+)\s*$/gm)) users[m[2]] = m[3];
if (!code || !users[WHO]) throw new Error("demo activation code or sample account not found");
const [sa, dev] = await api("POST", "/api/activation/client", { token: code, device_name: "website-previews" });
if (sa >= 300) throw new Error("activation failed " + sa);
const DEVICE = { device_id: dev.device_id, device_secret: dev.device_secret, tenant_id: dev.tenant_id, tenant_code: CODE, company_name: dev.company_name || "Demo Company", kind: "client" };

// ---------- 3. Headless Chrome over CDP ----------
chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${PROFILE}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars", "--lang=en-GB", "--window-size=1280,800", "about:blank"], { stdio: "ignore" });
let dbg = null;
for (let i = 0; i < 80 && !dbg; i++) { try { dbg = fs.readFileSync(path.join(PROFILE, "DevToolsActivePort"), "utf8").split("\n")[0].trim(); } catch { await sleep(250); } }
if (!dbg) throw new Error("Chrome did not start");
let targets = [];
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${dbg}/json`)).json(); if (targets.some((t) => t.type === "page")) break; } catch {} await sleep(250); }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let seq = 0; const pend = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } if (m.method === "Page.javascriptDialogOpening") cdp("Page.handleJavaScriptDialog", { accept: false }); });
const cdp = (method, params = {}) => new Promise((r) => { const i = ++seq; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => (await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
// Only localhost: anything else (map tiles, weather, fonts) is refused.
await cdp("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.method !== "Fetch.requestPaused") return; const u = m.params.request.url; const ok = u.startsWith(BASE + "/") || u.startsWith("data:") || u.startsWith("blob:"); cdp(ok ? "Fetch.continueRequest" : "Fetch.failRequest", ok ? { requestId: m.params.requestId } : { requestId: m.params.requestId, errorReason: "BlockedByClient" }); });
await cdp("Page.enable"); await cdp("Runtime.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });

await cdp("Page.navigate", { url: BASE + "/" }); await sleep(1500);
const st = await js(`(async () => { localStorage.clear(); sessionStorage.clear(); const dev = ${JSON.stringify(DEVICE)}; localStorage.setItem('eam.device', JSON.stringify(dev));
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ${JSON.stringify(WHO)}, password: ${JSON.stringify(users[WHO])}, device_id: dev.device_id, device_secret: dev.device_secret }) });
  localStorage.setItem('eam.session', JSON.stringify(await r.json())); return r.status })()`);
if (st !== 200) throw new Error("sign-in failed " + st);
log("signed in as", WHO);

const CLOSE = (keep) => `(() => { let n = 0; ${keep ? "" : "[...document.querySelectorAll('button')].filter((b) => /^(CLOSE|DISMISS|GOT IT|LATER|NOT NOW)$/i.test(b.textContent.trim()) && b.offsetParent).forEach((b) => { b.click(); n++ });"}
  [...document.querySelectorAll('div,p,section,aside')].filter((e) => /^Demo organisation with sample data/.test((e.innerText || '').trim()) && (e.innerText || '').length < 200).forEach((e) => { e.style.display = 'none'; n++ }); return n })()`;
const SCROLL = (re, off) => `(() => { const re = new RegExp(${JSON.stringify(re)}); const el = [...document.querySelectorAll('h1,h2,h3,h4,b,strong,span,div,p,th,td,small')].find((e) => e.offsetParent && re.test((e.textContent || '').trim()) && e.textContent.length < 120);
  if (!el) return 'none'; let s = el.parentElement; while (s && !(s.scrollHeight > s.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
  const d = el.getBoundingClientRect().top - ${off}; if (s) s.scrollTop += d; else window.scrollBy(0, d); return Math.round(d) })()`;
// Encode a PNG (base64) into webp + jpg at two widths, inside the browser.
const ENCODE = (b64) => `(async () => { const img = new Image(); img.src = 'data:image/png;base64,${b64}'; await img.decode();
  const out = {}; let src = img;
  for (const w of [1280, 640]) { const h = Math.round(img.naturalHeight * w / img.naturalWidth); const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
    out[w] = { w, h, webp: c.toDataURL('image/webp', 0.8).split(',')[1], jpg: c.toDataURL('image/jpeg', 0.82).split(',')[1] }; src = c; }
  return out })()`;

const shots = [];
let lastApp = null;
for (const pg of PLAN) {
  const appUrl = pg.url.split("#")[0];
  if (appUrl !== lastApp) {
    await cdp("Page.navigate", { url: BASE + pg.url }); await sleep(1500); await cdp("Page.reload", { ignoreCache: true }); await sleep(pg.boot || 12000); lastApp = appUrl;
    if (pg.prep) { log(pg.file, "site:", await js(pg.prep)); await sleep(3000); }
  } else await js(`location.hash = ${JSON.stringify("#" + pg.url.split("#")[1])}; 1`);
  await sleep(pg.wait || 3000);
  if (pg.act) { log(pg.file, "act:", await js(pg.act)); await sleep(pg.actWait || 2500); }
  await js(CLOSE(pg.keepModal)); await sleep(800);
  if (pg.to) await js(SCROLL(pg.to, pg.off ?? 140));
  await sleep(1500);
  const png = (await cdp("Page.captureScreenshot", { format: "png" })).result.data;
  shots.push({ pg, png });
  log("captured", pg.file);
}

await cdp("Fetch.disable");
await cdp("Page.navigate", { url: "about:blank" }); await sleep(500);
fs.mkdirSync(OUT, { recursive: true });
const today = new Date();
const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const manifest = { version: 1, captured: iso, source: `Messerschmidts ${args.label ? args.label + " " : ""}demo organisation with sample data`, caption: "Screenshot of the app with sample data", apps: {} };
for (const k of Object.keys(APPS)) manifest.apps[k] = { label: APPS[k].label, short: APPS[k].short, slides: [] };
for (const { pg, png } of shots) {
  const enc = await js(ENCODE(png));
  for (const w of [1280, 640]) {
    fs.writeFileSync(path.join(OUT, `${pg.file}-${w}.webp`), Buffer.from(enc[w].webp, "base64"));
    fs.writeFileSync(path.join(OUT, `${pg.file}-${w}.jpg`), Buffer.from(enc[w].jpg, "base64"));
  }
  manifest.apps[pg.app].slides.push({ file: pg.file, title: pg.title, alt: pg.alt, width: enc[1280].w, height: enc[1280].h, captured: iso });
  log("wrote", pg.file, `${enc[1280].w}x${enc[1280].h}`, Math.round(enc[1280].webp.length * 0.75 / 1024) + " KB webp");
}
fs.writeFileSync(path.join(OUT, "previews.json"), JSON.stringify(manifest, null, 2) + "\n");
log("manifest", path.join(OUT, "previews.json"), "captured", iso);
ws.close();
process.exit(0);
