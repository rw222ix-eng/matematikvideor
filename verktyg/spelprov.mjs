/**
 * Prov för spelen i videoteket, lokalt i wrangler pages dev (samma _headers, _routes.json och funktioner som hos
 * Cloudflare) med spelservern i wrangler dev bredvid:
 *  - /spel/tron.html får spelens policy och inte sidans, och Tron startar utan att policyn stoppar något,
 *  - startsidan har kvar sin strikta policy,
 *  - /spel/halsa, /spel/rapport och en WebSocket till /spel/rum går genom funktionen till spelservern,
 *  - skeppet och Pac-Man (/spel/skepp, /spel/pacman) laddar och spelar mot datorn under samma policy.
 *
 *   (i geogebra-guiden, server/) npx --yes wrangler@4.158.0 dev --port 8792 --ip 127.0.0.1
 *   node verktyg/spel.mjs --public <kopia> --kalla http://localhost:8191 && node verktyg/publicera.mjs --public <kopia> --cloudflare
 *   npx --yes wrangler@4.158.0 pages dev <kopia> --port 8797 --ip 127.0.0.1
 *   BAS=http://127.0.0.1:8797 node verktyg/spelprov.mjs
 *
 * Kör någon annan wrangler dev på datorn, ge båda dina samma egna WRANGLER_REGISTRY_PATH. Alla spelservrar heter
 * spel-server i wranglers gemensamma lista, och funktionen når annars ibland en annans, äldre server.
 */
import { createRequire } from "node:module";
const require = createRequire(process.env.E2E || "file:///E:/Transkribera/e2e/");
const { chromium } = require("playwright");

const BAS = (process.env.BAS || "http://127.0.0.1:8797").replace(/\/$/, "");
// Lokalt tar spelsidorna spelservern på 127.0.0.1:8792 om inget annat sägs. På pages.dev tar de sidans egen adress, och
// det är den vägen provet gäller: genom funktionen, under connect-src 'self'. ?server= ger samma väg här.
const SERVER = `?server=${BAS.replace(/^https?:\/\//, "")}`;
// Ett rum genom funktionen, från sidan. Svarar med koden, eller med varför det inte gick: samma adress hämtad utan
// WebSocket visar serverns svar (426 «websocket» när vägen fungerar, annars felet). Protokollets version tas ur
// /spel/halsa, så att provet följer servern (med v: 1 mot en server på version 2 svarar rummet «fel version»).
const rum = (sida, spel) => sida.evaluate(([spel, v]) => new Promise((klar) => {
  const adress = `${location.origin}/spel/rum?spel=${spel}&hur=ny`;
  const varfor = async (vad) => klar({ kod: null, varfor: `${vad}: ${await fetch(adress).then(async (r) => `${r.status} ${(await r.text()).slice(0, 120)}`, (e) => String(e))}` });
  const w = new WebSocket(adress.replace(/^http/, "ws"));
  w.onopen = () => w.send(JSON.stringify({ typ: "hej", v, namn: "Prov" }));
  w.onmessage = (e) => { const m = JSON.parse(e.data); if (m.typ === "valkommen") { w.close(); klar({ kod: m.kod }); } else if (m.typ === "fel") varfor(`fel ${m.fel}`); };
  w.onerror = () => varfor("WebSocketen föll");
  setTimeout(() => varfor("inget svar på 15 s"), 15000);
}), [spel, halsa?.version ?? 1]);
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
// Buggrapportens väg: läsningen utan nyckel ska nekas av spelservern (401 «nyckel»), inte av sidan (404 eller startsidan).
const rapport = await fetch(`${BAS}/spel/rapport`).then(async (r) => ({ kod: r.status, svar: (await r.text()).slice(0, 80) })).catch((e) => ({ kod: 0, svar: String(e) }));
prov("/spel/rapport går genom funktionen, och läsningen är stängd utan nyckel", rapport.kod === 401 && /"fel":"nyckel"/.test(rapport.svar), JSON.stringify(rapport));

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
await p.goto(`${BAS}/spel/tron.html${SERVER}`, { waitUntil: "load" });
await p.click("#spela");
const igang = await p.waitForFunction(() => window.__tronSida?.lage.tron?.lage.igang, null, { timeout: 60000 }).then(() => true, () => false);
prov("Tron startar under spelens policy", igang);
await p.waitForTimeout(3000);
await p.screenshot({ path: "E:/tmp-three/vt-spel-tron.png" });
// WebSocket till spelservern från spelsidan, genom funktionen.
const ws = await rum(p, "tron");
prov("WebSocketen från spelsidan når ett rum", typeof ws.kod === "string" && ws.kod.length === 4, ws.varfor);
// Topplistan med fetch från samma adress: webbläsaren skickar ingen Origin, och servern ska ändå svara.
const lista = await p.evaluate(() => fetch("/spel/topplista?spel=tron").then((r) => r.status).catch(() => 0));
prov("topplistan svarar en fetch från spelsidan", lista === 200, lista);
const brott = await p.evaluate(() => window.__brott);
prov("policyn stoppar inget", brott.length === 0, brott.slice(0, 5).join(" | "));
prov("inga JS-fel", jsFel.length === 0, jsFel.slice(0, 3).join(" | "));

// Skeppet och Pac-Man: sidan under spelens policy, Spela mot datorn i några sekunder, och ett rum genom funktionen.
for (const [namn, sida, spel, krok] of [["skeppet", "skepp", "skepp", "__skeppSida"], ["Pac-Man", "pacman", "pac", "__pacSida"]]) {
  const h = await fetch(`${BAS}/spel/${sida}.html`);
  prov(`${namn}: sidan har spelens policy`, /worker-src 'self'/.test(h.headers.get("content-security-policy") || ""));
  const q = await ctx.newPage(), qFel = [];
  q.on("pageerror", (e) => qFel.push(String(e)));
  await q.goto(`${BAS}/spel/${sida}${SERVER}`, { waitUntil: "load" });
  prov(`${namn}: sidan och dess skript laddas`, await q.waitForFunction((k) => !!window[k], krok, { timeout: 30000 }).then(() => true, () => false));
  await q.click("#spela");
  await q.waitForTimeout(8000);
  prov(`${namn}: menyn har gått undan för spelet`, await q.locator("#start").isHidden());
  await q.screenshot({ path: `E:/tmp-three/vt-spel-${sida}.png` });
  const r = await rum(q, spel);
  prov(`${namn}: WebSocketen når ett rum`, typeof r.kod === "string" && r.kod.length === 4, r.varfor);
  const b = await q.evaluate(() => window.__brott);
  prov(`${namn}: policyn stoppar inget`, b.length === 0, b.slice(0, 5).join(" | "));
  prov(`${namn}: inga JS-fel`, qFel.length === 0, qFel.slice(0, 3).join(" | "));
  await q.close();
}
await webb.close();
console.log(`\n${ok} ok, ${fel} FEL`);
process.exit(fel ? 1 : 0);
