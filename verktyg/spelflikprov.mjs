/**
 * Prov för fliken Spel och inloggningen i videoteket, lokalt i wrangler pages dev, som spelprov.mjs (samma uppsättning):
 *  - startsidan har kvar sin strikta policy, CSP ur verktyg/csp.mjs, och policyn stoppar inget under fliken Spel,
 *  - fliken Spel syns, #spel öppnar den, och Tron-kortet länkar till /spel/tron och öppnar spelsidan,
 *  - en gammal klasslänk (?klass=…&k=…) rensas ur adressen och den sparade nyckeln raderas,
 *  - raden under fliken säger gäst eller inloggad, /inlogg/ har sin egen policy (den enda med Googles skript),
 *    och med spelserverns provkonton (LOKALT=1) loggas en elev in, laddar om och loggar ut,
 *  - skärmbilder av fliken på dator och telefon (SKARM, standard E:/tmp-three).
 * Med SPEL_SYNS = false i public/index.html (fliken gömd tills alla spel har flerspelarläge) provas i stället att fliken
 * inte syns och att #spel går till #filmer. Klasslänken provas i båda lägena.
 *
 *   BAS=http://127.0.0.1:8797 node verktyg/spelflikprov.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { CSP, INLOGG_CSP, INLOGG_COOP } from "./csp.mjs";
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
const [K1] = klasser;
const SYNS = /const SPEL_SYNS = true;/.test(readFileSync(new URL("../public/index.html", import.meta.url), "utf8"));
console.log(`  (fliken Spel ${SYNS ? "syns" : "är gömd"}: SPEL_SYNS i public/index.html)`);

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
if (!SYNS) {
  const ctx = await webb.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(brottVakt);
  const p = await sida(ctx);
  await p.goto(`${BAS}/#spel`, { waitUntil: "load" });
  await p.waitForFunction(() => location.hash === "#filmer", null, { timeout: 15000 }).catch(() => {});
  prov("gömd: #spel går till #filmer", new URL(p.url()).hash === "#filmer", p.url());
  prov("gömd: fliken Spel syns inte", (await p.locator('#flikar [data-hylla="spel"]').isHidden()) && (await p.locator('#flikar [data-hylla="provet"]').isVisible()));
  prov("gömd: inga spelkort på linan", (await p.locator("#spar .post.spel").count()) === 0);
  prov("gömd: policyn stoppar inget", (await p.evaluate(() => window.__brott)).length === 0);
  prov("gömd: inga JS-fel", p.jsFel.length === 0, p.jsFel.slice(0, 3).join(" | "));
  await ctx.close();
} else {
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
prov("skeppet och Pac-Man länkar till /spel/skepp och /spel/pacman", (await p.locator('#spar a[data-spel="skepp"]').getAttribute("href")) === "/spel/skepp" && (await p.locator('#spar a[data-spel="pacman"]').getAttribute("href")) === "/spel/pacman");
prov("inget spel står som kommer snart", (await p.locator("#spar .post.kommer.spel").count()) === 0);
for (const id of ["tron", "skepp", "pacman"]) prov(`${id}-kortets bild laddas`, await p.locator(`#spar a[data-spel="${id}"] img`).evaluate((i) => i.complete && i.naturalWidth > 0));
await p.mouse.move(10, 10);
await p.screenshot({ path: `${SKARM}/vt-spelflik-dator.png` });
prov("policyn stoppar inget under fliken Spel", (await p.evaluate(() => window.__brott)).length === 0, (await p.evaluate(() => window.__brott)).slice(0, 5).join(" | "));
await kort.click();
await p.waitForURL(/\/spel\/tron$/, { timeout: 15000 }).catch(() => {});
prov("kortet öppnar spelsidan", new URL(p.url()).pathname === "/spel/tron", p.url());
prov("spelsidan laddas", await p.locator("#spela").isVisible({ timeout: 15000 }).catch(() => false));
prov("inga JS-fel på startsidan", p.jsFel.length === 0, p.jsFel.slice(0, 3).join(" | "));
await ctx.close();
}

// 2. Den gamla klasslänken och inloggningen (2026-11-14: skolans Google-konto i stället för klassnyckeln).
// En gammal länk (?klass=…&k=…, också guidens ?klass=…#spel) fungerar som en vanlig länk: klass och nyckel tas bort ur
// adressen, och en sparad nyckel raderas ur webbläsaren. Klassen kommer ur inloggningen, som har en egen sida.
const ctx2 = await webb.newContext({ viewport: { width: 1366, height: 768 } });
await ctx2.addInitScript(brottVakt);
const q = await sida(ctx2);
await q.goto(`${BAS}/#filmer`, { waitUntil: "load" });
await q.evaluate(() => localStorage.setItem("spelKlass", JSON.stringify({ klass: "TE26A", k: "gammal-nyckel-123" })));
await q.goto(`${BAS}/?klass=${K1}&k=prov-nyckel-123#spel`, { waitUntil: "load" });
await q.waitForFunction(() => location.search === "", null, { timeout: 15000 }).catch(() => {});
prov("klass och k tas bort ur adressen", new URL(q.url()).search === "" && new URL(q.url()).hash === (SYNS ? "#spel" : "#filmer"), q.url());
prov("den sparade klassnyckeln är raderad", (await spelKlass(q)) === null, await spelKlass(q));
await q.goto(`${BAS}/?klass=${K1}&x=1#filmer`, { waitUntil: "load" });
await q.waitForFunction(() => !location.search.includes("klass"), null, { timeout: 15000 }).catch(() => {});
prov("andra parametrar står kvar i adressen", new URL(q.url()).search === "?x=1", q.url());
prov("en länk sparar ingen klass", (await spelKlass(q)) === null);
if (SYNS) {
  await q.goto(`${BAS}/#spel`, { waitUntil: "load" });
  await q.locator("#spelval #spel-in").waitFor({ timeout: 15000 }).catch(() => {});
  prov("utan inloggning säger raden gäst utan topplista", /gäst/i.test(await q.locator("#spelval").textContent()) && /utan topplista/i.test(await q.locator("#spelval").textContent()), await q.locator("#spelval").textContent());
  prov("knappen går till inloggningssidan med vägen tillbaka", (await q.locator("#spel-in").getAttribute("href")) === "/inlogg/?till=%2F%23spel");
  prov("kortet säger logga in för topplistan", /logga in för topplistan/.test(await q.locator('#spar a[data-spel="tron"] .moment').textContent()));
  prov("raden syns bara under fliken Spel", await (async () => { await q.locator('#flikar [data-hylla="berattelser"]').click(); const g = await q.locator("#spelval").isHidden(); await q.locator('#flikar [data-hylla="spel"]').click(); return g; })());
}
prov("policyn stoppar inget på startsidan", (await q.evaluate(() => window.__brott)).length === 0, (await q.evaluate(() => window.__brott)).slice(0, 5).join(" | "));
prov("inga JS-fel på startsidan", q.jsFel.length === 0, q.jsFel.slice(0, 3).join(" | "));
// Inloggningssidan har en egen policy: den enda som släpper in Googles skript, och Googles fönster får svara.
const inl = await fetch(`${BAS}/inlogg/`);
const inlCsp = inl.headers.get("content-security-policy") || "";
prov("/inlogg/ har inloggningens policy och inte sidans", inlCsp === INLOGG_CSP, inlCsp.slice(0, 200));
prov("/inlogg/ låter Googles fönster svara", inl.headers.get("cross-origin-opener-policy") === INLOGG_COOP, inl.headers.get("cross-origin-opener-policy"));
prov("startsidan släpper inte in Google", !/accounts\.google\.com/.test(csp));
const spelCsp = (await fetch(`${BAS}/spel/tron.html`)).headers.get("content-security-policy") || "";
prov("spelsidorna släpper inte in Google", !/accounts\.google\.com/.test(spelCsp) && /script-src 'self'/.test(spelCsp), spelCsp.slice(0, 120));
// /spel/inlogg går genom funktionen till spelservern, och sidan säger vem eleven är. Utan klient-id och utan provkonton
// finns ingen knapp, och eleven kan spela som gäst.
const lage = await fetch(`${BAS}/spel/inlogg`).then((r) => r.json()).catch(() => null);
prov("/spel/inlogg svarar genom funktionen", !!lage && lage.inloggad === false && lage.klass === null, JSON.stringify(lage));
await q.goto(`${BAS}/inlogg/?till=%2F%23spel`, { waitUntil: "load" });
await q.waitForFunction(() => document.getElementById("lage").textContent !== "Hämtar …", null, { timeout: 15000 }).catch(() => {});
prov("inloggningssidan säger vad som händer med uppgifterna", /Den sparas inte/.test(await q.locator(".vet").textContent()) && /Din lärare kan alltid se vem som har vilket spelnamn/.test(await q.locator(".vet").textContent()));
prov("Spela som gäst går till fliken Spel", (await q.locator("#tillbaka").getAttribute("href")) === "/#spel");
await q.goto(`${BAS}/inlogg/?till=${encodeURIComponent("//elak.example/")}`, { waitUntil: "load" });
prov("vägen tillbaka tar bara emot sidans egna vägar", (await q.locator("#tillbaka").getAttribute("href")) === "/#spel");
if (lage && lage.prov) {
  // Spelservern tar emot provkonton (bara lokalt, verktyg/spel-inlogg-prov.mjs i guidens repo): hela vägen som en elev.
  await q.goto(`${BAS}/inlogg/?till=%2F%23spel`, { waitUntil: "load" });
  await q.locator("#prov:not([hidden])").waitFor({ timeout: 15000 });
  await q.fill("#provkonto", "elev1@elev.skola.example");
  await q.locator("#prov button").dblclick();
  await q.waitForFunction(() => location.hash === "#spel" && location.pathname === "/", null, { timeout: 20000 }).catch(() => {});
  await q.locator("#spelval #spel-ut").waitFor({ timeout: 15000 }).catch(() => {});
  prov("provkontot loggas in och fliken Spel säger klassen", /TE26A/.test(await q.locator("#spelval").textContent()), await q.locator("#spelval").textContent());
  prov("kortet säger klassens topplista", /topplista för TE26A/.test(await q.locator('#spar a[data-spel="tron"] .moment').textContent()));
  await q.reload({ waitUntil: "load" });
  await q.locator("#spelval #spel-ut").waitFor({ timeout: 15000 }).catch(() => {});
  prov("inloggningen står kvar efter omladdning", /TE26A/.test(await q.locator("#spelval").textContent()));
  await q.locator("#spel-ut").dblclick().catch(() => {});
  await q.locator("#spelval #spel-in").waitFor({ timeout: 15000 }).catch(() => {});
  prov("Logga ut ger gäst igen", /gäst/i.test(await q.locator("#spelval").textContent()));
  prov("inga JS-fel under inloggningen", q.jsFel.length === 0, q.jsFel.slice(0, 3).join(" | "));
} else console.log("  (spelservern tar inte emot provkonton här: inloggningen som elev provas inte)");
await ctx2.close();

// 3. Telefon: fliken ryms och kortet syns.
if (SYNS) {
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
}
await webb.close();
console.log(`\n${ok} ok, ${fel} FEL`);
process.exit(fel ? 1 : 0);
