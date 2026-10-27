/**
 * Nattlig kontroll av videoteket (säkerhet C1, 2026-10-27). .github/workflows/nattlig.yml kör den varje
 * natt. Lokalt: cd kontroll && npm ci --ignore-scripts && node nattlig.mjs
 *
 * 1. Filerna: HEAD byggs som hos Vercel och Pages (verktyg/publicera.mjs), och varje fil jämförs med den
 *    som serveras. Skiljer en fil har någon ändrat sidan utanför repot, eller så har en publicering inte
 *    gått igenom. Inbäddningssidorna (inbaddat/public) jämförs på samma sätt.
 * 2. Huvudena: varje huvud i vercel.json och inbaddat/vercel.json ska finnas live med samma värde.
 * 3. Sidan i Chrome: startsidan, sökningen, en film som spelas, Din tur med GeoGebra, formelbladet, Newton
 *    och YouTube-reserven, utan CSP-brott i någon ram. Trusted Types nekar rå HTML, srcdoc och nya
 *    policyer, ett händelseattribut kör inte och ett stilattribut gör ingenting. Pages skickar vidare
 *    till Vercel, eller fungerar som full kopia om pages.yml bygger utan --vidarekoppla.
 *
 * Det som faller provas igen efter några minuter, så att en publicering som pågår inte larmar. Har main
 * fått en ny commit under kontrollen jämförs inte filerna. Faller något igen slutar skriptet med kod 1, och
 * GitHub mejlar Rickard. Kontrollen stoppar aldrig en publicering. Chrome är den som finns på GitHubs
 * maskiner, och playwright-core har låst version i package-lock.json.
 */
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROT = join(dirname(fileURLToPath(import.meta.url)), "..");
const V = "https://winterhalls-matte.vercel.app/";
const P = "https://rw222ix-eng.github.io/matematikvideor/";
const I = "https://matematikvideor-inbaddat.vercel.app/";
const VANTA_MS = Number(process.env.KONTROLL_VANTA_MS ?? 240000);
const vila = (ms) => new Promise((r) => setTimeout(r, ms));
const rapport = [];
const skriv = (s) => { console.log(s); rapport.push(s); };

// ---- Bygget av HEAD ----
const git = (...a) => execFileSync("git", a, { cwd: ROT, encoding: "utf8" }).trim();
const HEAD = git("rev-parse", "HEAD");
const mainNu = () => git("ls-remote", "https://github.com/rw222ix-eng/matematikvideor", "refs/heads/main").split(/\s/)[0];
const VIDARE = /publicera\.mjs --vidarekoppla/.test(readFileSync(join(ROT, ".github/workflows/pages.yml"), "utf8"));

function bygg(vidare) {
  const mapp = mkdtempSync(join(tmpdir(), "videotek-"));
  for (const d of ["public", "verktyg", "vercel.json"]) cpSync(join(ROT, d), join(mapp, d), { recursive: true });
  execFileSync(process.execPath, [join(mapp, "verktyg", "publicera.mjs"), "--public", join(mapp, "public"), ...(vidare ? ["--vidarekoppla"] : [])], { stdio: ["ignore", "ignore", "inherit"] });
  return join(mapp, "public");
}
const filer = (rot) => {
  const ut = [];
  const ga = (d) => { for (const n of readdirSync(d, { withFileTypes: true })) n.isDirectory() ? ga(join(d, n.name)) : ut.push(relative(rot, join(d, n.name)).split(sep).join("/")); };
  ga(rot);
  return ut.sort();
};
// index.html serveras som mappen, precis som eleverna öppnar den.
const adress = (bas, rel) => bas + encodeURI(rel === "index.html" ? "" : rel.endsWith("/index.html") ? rel.slice(0, -"index.html".length) : rel);
const sha = (b) => createHash("sha256").update(b).digest("hex");
// En slumpad fråga förbi GitHubs och Vercels cache, så att det som jämförs är det som ligger ute nu.
const hamta = async (url) => {
  const r = await fetch(url + (url.includes("?") ? "&" : "?") + "nattlig=" + Math.random().toString(36).slice(2), { redirect: "follow" });
  return { status: r.status, url: r.url, huvuden: r.headers, kropp: Buffer.from(await r.arrayBuffer()) };
};

async function jamfor(bas, rot, lista) {
  const skiljer = [];
  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < lista.length) {
      const rel = lista[i++];
      try {
        const r = await hamta(adress(bas, rel));
        if (r.status !== 200) skiljer.push(`${rel}: svarade ${r.status}`);
        else if (sha(r.kropp) !== sha(readFileSync(join(rot, rel)))) skiljer.push(`${rel}: annat innehåll än bygget av ${HEAD.slice(0, 7)}`);
      } catch (e) { skiljer.push(`${rel}: ${e.message}`); }
    }
  }));
  return skiljer;
}

// ---- Huvudena ur vercel.json ----
// "source" läses som Vercel gör: (…) är ett reguljärt uttryck, :namn en del av sökvägen, resten bokstavligt.
function monster(source) {
  let re = "";
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "(") { let j = i, djup = 0; do { if (source[j] === "(") djup++; else if (source[j] === ")") djup--; j++; } while (djup > 0 && j < source.length); re += source.slice(i, j); i = j - 1; }
    else if (c === ":") { let j = i + 1; while (j < source.length && /\w/.test(source[j])) j++; re += "([^/]+)"; i = j - 1; }
    else re += c.replace(/[.*+?^${}|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$");
}
async function huvuden(bas, vercelJson, sokvagar) {
  const regler = JSON.parse(readFileSync(vercelJson, "utf8")).headers.map((r) => ({ re: monster(r.source), huvuden: r.headers }));
  const fel = [];
  for (const s of sokvagar) {
    const vantat = {};
    for (const r of regler) if (r.re.test(s)) for (const h of r.huvuden) vantat[h.key.toLowerCase()] = h.value;
    const r = await hamta(bas + s.slice(1));
    if (r.status !== 200) { fel.push(`${s}: svarade ${r.status}`); continue; }
    for (const [k, v] of Object.entries(vantat)) if (r.huvuden.get(k) !== v) fel.push(`${s}: ${k} är ${JSON.stringify(r.huvuden.get(k))}, ska vara ${JSON.stringify(v.slice(0, 80))}`);
  }
  return fel;
}

// ---- Sidan i Chrome ----
const ggbRam = (p) => p.frames().find((f) => /\/ggb\.html/.test(f.url()));
const vantaKort = (p) => p.waitForFunction(() => document.querySelectorAll("#spar [data-film]").length > 3, null, { timeout: 20000 });
const FILM = /release-assets\.githubusercontent\.com|objects\.githubusercontent\.com|github\.com\/.*\/releases\/download\//;

async function sidan(b, bas) {
  const ut = {};
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: "sv-SE", timezoneId: "Europe/Stockholm" });
  await ctx.addInitScript(() => {
    window.__brott = [];
    document.addEventListener("securitypolicyviolation", (e) => { if (e.disposition === "enforce") window.__brott.push(`${e.effectiveDirective} ${e.blockedURI}`); });
  });
  const p = await ctx.newPage();
  const sidfel = [], brott = [];
  p.on("pageerror", (e) => sidfel.push(String(e).slice(0, 200)));
  const samla = async () => { for (const f of p.frames()) brott.push(...((await f.evaluate(() => window.__brott.splice(0)).catch(() => null)) || []).map((x) => `${f === p.mainFrame() ? "sidan" : new URL(f.url()).pathname}: ${x}`)); };
  const prov = async (namn, fn) => { try { ut[namn] = (await fn()) || "ok"; } catch (e) { ut[namn] = `FEL ${String(e).split("\n")[0].slice(0, 400)}`; } };

  await prov("startsidan", async () => { await p.goto(bas, { waitUntil: "load" }); await vantaKort(p); });
  await prov("sökningen", async () => {
    await p.evaluate(() => document.querySelector("#vy-intro .sok-oppna").click());
    await p.waitForTimeout(400);
    await p.fill("#sok-falt", "procent");
    await p.waitForFunction(() => document.querySelectorAll("#sok-lista li").length > 2, null, { timeout: 8000 });
  });
  await prov("Trusted Types och injektioner", async () => {
    const r = await p.evaluate(async () => {
      const nekad = (fn) => { try { fn(); return false; } catch (e) { return e instanceof TypeError; } };
      const r = {
        sink: nekad(() => document.body.insertAdjacentHTML("beforeend", '<img src="x-finns-inte.png" onerror="window.__ett=1">')),
        srcdoc: nekad(() => { const f = document.createElement("iframe"); f.srcdoc = "<script>parent.__tva=1<\/script>"; document.body.appendChild(f); }),
        policy: !!window.trustedTypes && nekad(() => trustedTypes.createPolicy("angripare", { createHTML: (s) => s })),
        dubblett: !!window.trustedTypes && nekad(() => trustedTypes.createPolicy("videotek", { createHTML: (s) => s })),
      };
      // B4: ett stilattribut gör ingenting, och data-stil sätter bara sidans egna egenskaper.
      const a = document.createElement("div"), d = document.createElement("div");
      a.setAttribute("style", "display:none");
      d.setAttribute("data-stil", "position:fixed;--i:3");
      document.body.append(a, d);
      await new Promise((k) => setTimeout(k, 1500));
      r.stilattribut = getComputedStyle(a).display !== "none";
      r.dataStil = getComputedStyle(d).position !== "fixed" && d.style.getPropertyValue("--i") === "3";
      a.remove(); d.remove();
      r.korde = !!(window.__ett || window.__tva);
      return r;
    });
    const brister = Object.entries(r).filter(([k, v]) => (k === "korde" ? v : !v)).map(([k]) => k);
    if (brister.length) throw new Error(`släpptes igenom: ${brister.join(", ")}`);
    await p.evaluate(() => { window.__brott = []; });
  });
  await samla();
  await prov("filmen spelas", async () => {
    await p.goto(bas + "#ma1c-k4-06-grafisk-ekvationslosning", { waitUntil: "load" });
    await p.waitForTimeout(2500);
    await p.click("#duk", { position: { x: 300, y: 200 } });
    await p.waitForFunction(() => { const v = document.querySelector("#duk video"); return v && !v.paused && v.currentTime > 2; }, null, { timeout: 30000 });
  });
  await prov("Din tur med GeoGebra", async () => {
    await p.evaluate(() => { const v = document.querySelector("#duk video"); if (v) v.pause(); document.getElementById("dintur").scrollIntoView(); });
    const t0 = Date.now();
    let ram;
    while (!((ram = ggbRam(p)) && (await ram.evaluate(() => !!(window.ggbApplet && window.ggbApplet.evalCommand && document.querySelector("canvas"))).catch(() => false)))) {
      if (Date.now() - t0 > 60000) throw new Error("GeoGebra blev inte klar på 60 s");
      await p.waitForTimeout(250);
    }
    await p.waitForTimeout(1500);
    await ram.evaluate(() => window.ggbApplet.evalCommand("f(x)=2x+40"));
    await p.waitForTimeout(300);
    if (!(await ram.evaluate(() => window.ggbApplet.getAllObjectNames())).includes("f")) throw new Error("GeoGebra tog inte emot f(x)");
  });
  await samla();
  await prov("formelbladet", async () => { await p.goto(bas + "#formelbladet", { waitUntil: "load" }); await vantaKort(p); });
  // Frågetecknet startar guiden: Newton går fram och börjar prata. Ett tips som är på väg ut får gå undan
  // först. Faller provet står Newtons läge i felet varje gång det ändrades (klasserna/tecknen i bubblan).
  await prov("Newton", async () => {
    await p.waitForFunction(() => document.getElementById("newton").hidden, null, { timeout: 10000 }).catch(() => {});
    const lage = () => p.evaluate(() => { const n = document.getElementById("newton"); return `${n.hidden ? "dold" : n.className.replace(/^newton\s*/, "") || "syns"}/${document.getElementById("newton-text").textContent.length}`; }).catch((e) => `? ${String(e).slice(0, 60)}`);
    const t0 = Date.now(), logg = [];
    await p.click("#hjalp");
    for (let forra = ""; ;) {
      const l = await lage(), s = ((Date.now() - t0) / 1000).toFixed(1);
      if (l !== forra) { logg.push(`${s} s ${l}`); forra = l; }
      if (!l.startsWith("dold") && Number(l.split("/").pop()) > 10) return Number(s) > 8 ? `ok efter ${s} s` : "ok";
      if (Date.now() - t0 > 20000) throw new Error(`Newton pratade inte på 20 s: ${logg.join(", ")}`);
      await p.waitForTimeout(250);
    }
  });
  await samla();
  await prov("YouTube-reserven", async () => {
    await ctx.route(FILM, (r) => r.abort());
    await p.goto(bas + "#formelbladet-1-prefix-och-potenser", { waitUntil: "load" });
    await p.waitForTimeout(2500);
    await p.click("#duk", { position: { x: 300, y: 200 } });
    const t0 = Date.now();
    while (!p.frames().some((f) => /youtube\.com\/embed\//.test(f.url()))) {
      if (Date.now() - t0 > 30000) throw new Error("YouTubes ram kom inte");
      await p.waitForTimeout(250);
    }
  });
  await samla();
  await ctx.close();
  if (brott.length) ut["CSP-brott"] = `FEL ${[...new Set(brott)].slice(0, 5).join(" | ")}`;
  if (sidfel.length) ut["fel i sidan"] = `FEL ${[...new Set(sidfel)].slice(0, 5).join(" | ")}`;
  return ut;
}

// Pages skickar vidare till samma ställe hos Vercel.
async function vidarekopplingen(b) {
  const ut = {};
  for (const [fran, till] of [[P, V], [P + "#filmer", V + "#filmer"], [P + "film/arkimedes-och-cirkeln/?t=42", V + "#arkimedes-och-cirkeln&t=42"]]) {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    try {
      await p.goto(fran);
      await p.waitForURL((u) => u.href.startsWith(V), { timeout: 20000 });
      await p.waitForFunction(() => document.querySelector(".vy.aktiv"), null, { timeout: 20000 });
      ut[`Pages ${fran.slice(P.length) || "/"}`] = p.url() === till ? "ok" : `FEL hamnade på ${p.url()}`;
    } catch (e) { ut[`Pages ${fran.slice(P.length) || "/"}`] = `FEL ${String(e).split("\n")[0].slice(0, 200)}`; }
    await ctx.close();
  }
  return ut;
}

async function webblasaren() {
  const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const ut = {};
    for (const [k, v] of Object.entries(await sidan(b, V))) ut[`Vercel: ${k}`] = v;
    if (VIDARE) Object.assign(ut, await vidarekopplingen(b));
    else for (const [k, v] of Object.entries(await sidan(b, P))) ut[`Pages: ${k}`] = v;
    return ut;
  } finally { await b.close(); }
}

// ---- Körningen ----
skriv(`# Nattlig kontroll av videoteket\n\nHEAD ${HEAD.slice(0, 7)}, Pages ${VIDARE ? "skickar vidare till Vercel" : "är en full kopia"}.\n`);
const vercelBygge = bygg(false), pagesBygge = bygg(VIDARE);
const inbaddatRot = join(ROT, "inbaddat", "public");
const app = filer(vercelBygge).find((f) => /^app\.[0-9a-f]{16}\.js$/.test(f));
const omslag = filer(vercelBygge).find((f) => f.startsWith("omslag/"));
const delar = {
  "filer hos Vercel": () => jamfor(V, vercelBygge, filer(vercelBygge)),
  "filer hos Pages": () => jamfor(P, pagesBygge, filer(pagesBygge)),
  "filer på inbäddningsadressen": () => jamfor(I, inbaddatRot, filer(inbaddatRot)),
  "huvuden hos Vercel": () => huvuden(V, join(ROT, "vercel.json"), ["/", "/videor.json", `/${app}`, `/${omslag}`, "/film/arkimedes-och-cirkeln/"]),
  "huvuden på inbäddningsadressen": () => huvuden(I, join(ROT, "inbaddat", "vercel.json"), ["/", "/ggb.html", "/yt.html"]),
};
const filDelar = (namn) => namn.startsWith("filer");

async function allt(bara) {
  const fel = {};
  for (const [namn, fn] of Object.entries(delar)) if (!bara || bara.has(namn)) {
    const f = await fn();
    skriv(`- ${namn}: ${f.length ? `${f.length} fel` : "ok"}`);
    if (f.length) fel[namn] = f;
  }
  if (!bara || bara.has("webbläsaren")) {
    const w = await webblasaren();
    for (const [k, v] of Object.entries(w)) skriv(`- ${k}: ${v}`);
    const f = Object.entries(w).filter(([, v]) => v.startsWith("FEL")).map(([k, v]) => `${k}: ${v.slice(4)}`);
    if (f.length) fel["webbläsaren"] = f;
  }
  skriv("");
  return fel;
}

let fel = await allt();
if (Object.keys(fel).length) {
  skriv(`Första försöket: ${Object.entries(fel).map(([k, v]) => `${k} (${v.length})`).join(", ")}. Nytt försök om ${Math.round(VANTA_MS / 60000)} min.\n`);
  await vila(VANTA_MS);
  fel = await allt(new Set(Object.keys(fel)));
}
// En ny commit på main under kontrollen: det som serveras kan vara nyare än HEAD.
if (Object.keys(fel).some(filDelar) && mainNu() !== HEAD) {
  skriv(`main har fått en ny commit under kontrollen, så filerna jämförs i natt igen. Skillnaderna räknas inte.\n`);
  for (const k of Object.keys(fel)) if (filDelar(k)) delete fel[k];
}
if (!Object.keys(fel).length) skriv("Allt stämmer: filerna, huvudena och sidan i Chrome.");
else {
  skriv("## Fel\n");
  for (const [namn, lista] of Object.entries(fel)) { skriv(`### ${namn}\n`); for (const f of lista.slice(0, 30)) skriv(`- ${f}`); if (lista.length > 30) skriv(`- och ${lista.length - 30} till`); skriv(""); }
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, rapport.join("\n") + "\n");
process.exit(Object.keys(fel).length ? 1 : 0);
