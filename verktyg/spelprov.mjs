/**
 * Prov för spelen i videoteket, lokalt i wrangler pages dev (samma _headers, _routes.json och funktioner som hos
 * Cloudflare) med spelservern i wrangler dev bredvid:
 *  - /spel/tron.html får spelens policy och inte sidans, och Tron startar utan att policyn stoppar något,
 *  - startsidan har kvar sin strikta policy,
 *  - /spel/halsa och en WebSocket till /spel/rum går genom funktionen till spelservern.
 *
 *   (i geogebra-guiden, server/) npx --yes wrangler@4.158.0 dev --port 8792 --ip 127.0.0.1
 *   node verktyg/spel.mjs --public <kopia> --kalla http://localhost:8191 && node verktyg/publicera.mjs --public <kopia> --cloudflare
 *   npx --yes wrangler@4.158.0 pages dev <kopia> --port 8797 --ip 127.0.0.1
 *   BAS=http://127.0.0.1:8797 node verktyg/spelprov.mjs
 */
import { createRequire } from "node:module";
const require = createRequire(process.env.E2E || "file:///E:/Transkribera/e2e/");
const { chromium } = require("playwright");

const BAS = (process.env.BAS || "http://127.0.0.1:8797").replace(/\/$/, "");
let fel = 0, ok = 0;
const prov = (namn, villkor, info = "") => { if (villkor) { ok++; console.log(`  ok   ${namn}`); } else { fel++; console.log(`  FEL  ${namn} ${info}`); } };

const start = await fetch(`${BAS}/`);
prov("startsidan har kvar sin strikta policy", /require-trusted-types-for/.test(start.headers.get("content-security-policy") || ""));
const sida = await fetch(`${BAS}/spel/tron.html`);
const csp = sida.headers.get("content-security-policy") || "";
prov("spelsidan har spelens policy", /worker-src 'self'/.test(csp) && !/trusted-types/.test(csp), csp.slice(0, 120));
prov("spelsidan har bara en policy", !csp.includes(", default-src"), csp.length);
const halsa = await fetch(`${BAS}/spel/halsa`).then((r) => r.json()).catch(() => null);
prov("/spel/halsa går genom funktionen till spelservern", halsa?.ok === true && halsa.version >= 1, JSON.stringify(halsa));

const webb = await chromium.launch({ channel: "chrome", headless: !process.env.VISA, args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await webb.newContext({ viewport: { width: 1366, height: 768 } });
await ctx.addInitScript(() => {
  window.__brott = [];
  addEventListener("securitypolicyviolation", (e) => window.__brott.push(`${e.violatedDirective} ${e.blockedURI}`));
  try { localStorage.setItem("ggbguiden:ovning", JSON.stringify(["tron"])); } catch { }
});
const p = await ctx.newPage();
const jsFel = [];
p.on("pageerror", (e) => jsFel.push(String(e)));
await p.goto(`${BAS}/spel/tron.html`, { waitUntil: "load" });
await p.click("#spela");
const igang = await p.waitForFunction(() => window.__tronSida?.lage.tron?.lage.igang, null, { timeout: 60000 }).then(() => true, () => false);
prov("Tron startar under spelens policy", igang);
await p.waitForTimeout(3000);
await p.screenshot({ path: "E:/tmp-three/vt-spel-tron.png" });
// WebSocket till spelservern från spelsidan, genom funktionen.
const ws = await p.evaluate(() => new Promise((ok) => {
  const w = new WebSocket(`${location.origin.replace(/^http/, "ws")}/spel/rum?spel=tron&hur=ny`);
  w.onopen = () => w.send(JSON.stringify({ typ: "hej", v: 1, namn: "Prov" }));
  w.onmessage = (e) => { const m = JSON.parse(e.data); if (m.typ === "valkommen") { w.close(); ok(m.kod); } };
  w.onerror = () => ok(null);
  setTimeout(() => ok(null), 8000);
}));
prov("WebSocketen från spelsidan når ett rum", typeof ws === "string" && ws.length === 4, ws);
const brott = await p.evaluate(() => window.__brott);
prov("policyn stoppar inget", brott.length === 0, brott.slice(0, 5).join(" | "));
prov("inga JS-fel", jsFel.length === 0, jsFel.slice(0, 3).join(" | "));
await webb.close();
console.log(`\n${ok} ok, ${fel} FEL`);
process.exit(fel ? 1 : 0);
