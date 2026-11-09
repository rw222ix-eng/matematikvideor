/**
 * Prov för fliken Spel och klasslänken i videoteket, lokalt i wrangler pages dev, som spelprov.mjs (samma uppsättning):
 *  - startsidan har kvar sin strikta policy, CSP ur verktyg/csp.mjs, och policyn stoppar inget under fliken Spel,
 *  - fliken Spel syns, #spel öppnar den, och Tron-kortet länkar till /spel/tron och öppnar spelsidan,
 *  - ?klass=…&k=… sparas som spelKlass och försvinner ur adressen, en felaktig länk rör inte det sparade,
 *    en annan klass skriver över, och spelsidan ser spelKlass,
 *  - skärmbilder av fliken på dator och telefon (SKARM, standard E:/tmp-three).
 *
 *   BAS=http://127.0.0.1:8797 node verktyg/spelflikprov.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { CSP } from "./csp.mjs";
const require = createRequire(process.env.E2E || "file:///E:/Transkribera/e2e/");
const { chromium } = require("playwright");

const BAS = (process.env.BAS || "http://127.0.0.1:8797").replace(/\/$/, "");
const SKARM = (process.env.SKARM || "E:/tmp-three").replace(/\/$/, "");
let fel = 0, ok = 0;
const prov = (namn, villkor, info = "") => { if (villkor) { ok++; console.log(`  ok   ${namn}`); } else { fel++; console.log(`  FEL  ${namn} ${info}`); } };

const start = await fetch(`${BAS}/`);
const csp = start.headers.get("content-security-policy") || "";
prov("startsidan har kvar sin strikta policy", csp.split(", ")[0].startsWith(CSP) && /require-trusted-types-for 'script'/.test(csp), csp.slice(0, 160));
const klasser = JSON.parse(readFileSync(new URL("../public/prov.json", import.meta.url), "utf8")).klasser.map((k) => k.namn);
const [K1, K2] = klasser;

const webb = await chromium.launch({ channel: "chrome", headless: !process.env.VISA });
const brottVakt = () => {
  window.__brott = [];
  addEventListener("securitypolicyviolation", (e) => window.__brott.push(`${e.violatedDirective} ${e.blockedURI}`));
  // Inga tips från Newton i bilderna.
  try { localStorage.setItem("tips", "av"); localStorage.setItem("hjalpVisad", "ja"); } catch { }
};
const sida = async (ctx) => { const p = await ctx.newPage(); p.jsFel = []; p.on("pageerror", (e) => p.jsFel.push(String(e))); return p; };
const spelKlass = (p) => p.evaluate(() => localStorage.getItem("spelKlass"));

// 1. Dator: fliken, kortet och länken.
const ctx = await webb.newContext({ viewport: { width: 1366, height: 768 } });
await ctx.addInitScript(brottVakt);
const p = await sida(ctx);
await p.goto(`${BAS}/#filmer`, { waitUntil: "load" });
const flik = p.locator('#flikar [data-hylla="spel"]');
prov("fliken Spel syns", await flik.isVisible({ timeout: 15000 }).catch(() => false));
await flik.click();
await p.waitForTimeout(1500);
prov("fliken Spel är vald och adressen är #spel", (await flik.getAttribute("aria-selected")) === "true" && new URL(p.url()).hash === "#spel", p.url());
prov("rubriken säger Välj ett spel", (await p.locator("#valj-rubrik").textContent()) === "Välj ett spel");
const kort = p.locator('#spar a[data-spel="tron"]');
// Cloudflare skickar /spel/tron.html vidare till /spel/tron, så kortet länkar dit direkt.
prov("Tron-kortet länkar till /spel/tron", (await kort.getAttribute("href")) === "/spel/tron");
prov("skeppet och Pac-Man står som kommer snart", (await p.locator("#spar .post.kommer.spel").count()) === 2);
prov("Tron-kortets bild laddas", await p.locator('#spar a[data-spel="tron"] img').evaluate((i) => i.complete && i.naturalWidth > 0));
await p.mouse.move(10, 10);
await p.screenshot({ path: `${SKARM}/vt-spelflik-dator.png` });
prov("policyn stoppar inget under fliken Spel", (await p.evaluate(() => window.__brott)).length === 0, (await p.evaluate(() => window.__brott)).slice(0, 5).join(" | "));
await kort.click();
await p.waitForURL(/\/spel\/tron$/, { timeout: 15000 }).catch(() => {});
prov("kortet öppnar spelsidan", new URL(p.url()).pathname === "/spel/tron", p.url());
prov("spelsidan laddas", await p.locator("#spela").isVisible({ timeout: 15000 }).catch(() => false));
prov("inga JS-fel på startsidan", p.jsFel.length === 0, p.jsFel.slice(0, 3).join(" | "));
await ctx.close();

// 2. Klasslänken.
const ctx2 = await webb.newContext({ viewport: { width: 1366, height: 768 } });
await ctx2.addInitScript(brottVakt);
const q = await sida(ctx2);
await q.goto(`${BAS}/?klass=${K1}&k=prov-nyckel-123#spel`, { waitUntil: "load" });
await q.waitForSelector('#spar a[data-spel="tron"]', { timeout: 15000 }).catch(() => {});
prov("klasslänken sparas som spelKlass", (await spelKlass(q)) === JSON.stringify({ klass: K1, k: "prov-nyckel-123" }), await spelKlass(q));
prov("klass och k tas bort ur adressen, fliken står kvar", new URL(q.url()).search === "" && new URL(q.url()).hash === "#spel", q.url());
prov("kortet säger klassens topplista", (await q.locator('#spar a[data-spel="tron"] .moment').textContent()).includes(K1));
await q.goto(`${BAS}/?klass=${K1}&k=prov-nyckel-123&x=1#filmer`, { waitUntil: "load" });
await q.waitForFunction(() => !location.search.includes("klass"), null, { timeout: 15000 }).catch(() => {});
prov("andra parametrar står kvar i adressen", new URL(q.url()).search === "?x=1", q.url());
await q.goto(`${BAS}/`, { waitUntil: "load" });
prov("utan länk rörs spelKlass inte", (await spelKlass(q)) === JSON.stringify({ klass: K1, k: "prov-nyckel-123" }));
for (const [namn, sok] of [["okänd klass", "klass=XX99&k=prov-nyckel-123"], ["för kort nyckel", `klass=${K1}&k=abc`], ["nyckel med konstiga tecken", `klass=${K1}&k=${encodeURIComponent("a<b>c\"d")}`], ["nyckel saknas", `klass=${K2}`]]) {
  await q.goto(`${BAS}/?${sok}`, { waitUntil: "load" });
  await q.waitForFunction(() => location.search === "", null, { timeout: 15000 }).catch(() => {});
  prov(`${namn}: spelKlass orörd och adressen rensad`, (await spelKlass(q)) === JSON.stringify({ klass: K1, k: "prov-nyckel-123" }) && new URL(q.url()).search === "", `${await spelKlass(q)} ${q.url()}`);
}
await q.goto(`${BAS}/?klass=${K2}&k=Annan_Nyckel-9`, { waitUntil: "load" });
await q.waitForFunction(() => location.search === "", null, { timeout: 15000 }).catch(() => {});
prov("en annan klass skriver över", (await spelKlass(q)) === JSON.stringify({ klass: K2, k: "Annan_Nyckel-9" }), await spelKlass(q));
prov("policyn stoppar inget med klasslänken", (await q.evaluate(() => window.__brott)).length === 0, (await q.evaluate(() => window.__brott)).slice(0, 5).join(" | "));
prov("inga JS-fel med klasslänken", q.jsFel.length === 0, q.jsFel.slice(0, 3).join(" | "));
await q.goto(`${BAS}/spel/tron.html`, { waitUntil: "load" });
prov("spelsidan ser spelKlass", JSON.parse((await spelKlass(q)) || "{}").klass === K2);
await ctx2.close();

// 3. Telefon: fliken ryms och kortet syns.
const ctx3 = await webb.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx3.addInitScript(brottVakt);
const t = await sida(ctx3);
await t.goto(`${BAS}/#spel`, { waitUntil: "load" });
await t.waitForSelector('#spar a[data-spel="tron"]', { timeout: 15000 }).catch(() => {});
await t.waitForTimeout(1500);
const rad = await t.locator("#flikar").boundingBox();
prov("flikraden ryms på telefonen", !!rad && rad.x >= 0 && rad.x + rad.width <= 375, JSON.stringify(rad));
prov("Tron-kortet syns på telefonen", await t.locator('#spar a[data-spel="tron"]').isVisible());
await t.screenshot({ path: `${SKARM}/vt-spelflik-telefon.png` });
prov("policyn stoppar inget på telefonen", (await t.evaluate(() => window.__brott)).length === 0);
prov("inga JS-fel på telefonen", t.jsFel.length === 0, t.jsFel.slice(0, 3).join(" | "));
await webb.close();
console.log(`\n${ok} ok, ${fel} FEL`);
process.exit(fel ? 1 : 0);
