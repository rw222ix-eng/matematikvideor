/**
 * Byggsteget för Vercel och GitHub Pages (2026-10-27, säkerhet B1). Körs i stället för filmsidor.mjs
 * (buildCommand i vercel.json och steget i .github/workflows/pages.yml).
 *
 * 1. Filmsidorna skrivs ur videor.json (skrivFilmsidor, som förut).
 * 2. Sidans skript flyttas ur index.html till app.<hash>.js, och i dess ställe läggs laddaren ur csp.mjs
 *    i <head>. Laddarens text är alltid densamma, så dess hash står fast i policyn. Skriptfilens namn
 *    byts när koden ändras, så den kan sparas i ett år i elevens webbläsare.
 * 3. Meta-taggens policy byts mot den strikta i csp.mjs.
 * 4. Bygget faller om Content-Security-Policy i vercel.json inte är exakt CSP_HUVUD. Då ligger förra
 *    versionen kvar, och sidan fungerar som förut.
 * 5. Med --vidarekoppla (bara Pages-workflowet) blir index.html en sida som skickar vidare till Vercel.
 *
 * Repots public/index.html ändras aldrig av det här: steget vägrar köra utanför Vercel och GitHub
 * Actions, om det inte får en kopia att arbeta i.
 *
 *   node verktyg/publicera.mjs                  (Vercel)
 *   node verktyg/publicera.mjs --vidarekoppla   (Pages-workflowet)
 *   node verktyg/publicera.mjs --public <mapp>   (en kopia av public/, för prov)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { skrivFilmsidor } from "./filmsidor.mjs";
import { CSP, CSP_HUVUD, LADDARE, VIDARE, VIDARE_CSP, VIDARE_STIL, VIDARE_TILL } from "./csp.mjs";

const HÄR = dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf("--public");
const publicDir = i > 0 ? resolve(process.argv[i + 1]) : join(HÄR, "..", "public");
if (i < 0 && !process.env.VERCEL && !process.env.GITHUB_ACTIONS) {
  console.error("publicera.mjs ändrar public/index.html och körs bara hos Vercel och i GitHub Actions.\nProva lokalt med: node verktyg/publicera.mjs --public <kopia av public>");
  process.exit(1);
}
const fel = (s) => { console.error(`publicera.mjs: ${s}`); process.exit(1); };

// 4. Policyn i vercel.json måste vara exakt den i csp.mjs.
const vercel = JSON.parse(readFileSync(join(HÄR, "..", "vercel.json"), "utf8"));
const huvud = vercel.headers.flatMap((r) => r.headers).filter((h) => h.key === "Content-Security-Policy").map((h) => h.value);
if (huvud.length !== 1 || huvud[0] !== CSP_HUVUD) fel(`Content-Security-Policy i vercel.json är inte densamma som CSP_HUVUD i verktyg/csp.mjs. Rätt värde:\n${CSP_HUVUD}`);

// 1. Filmsidorna.
skrivFilmsidor(JSON.parse(readFileSync(join(publicDir, "videor.json"), "utf8")).videor, publicDir);

// 2 och 3. index.html.
const indexFil = join(publicDir, "index.html");
let html = readFileSync(indexFil, "utf8");
if (html.includes(" data-app=")) fel("index.html är redan byggd (data-app finns). Bygg från repots fil.");
const skript = [...html.matchAll(/<script>\n([\s\S]*?)\n<\/script>\n/g)];
if (skript.length !== 1) fel(`index.html ska ha exakt ett <script> utan attribut, har ${skript.length}.`);
const meta = [...html.matchAll(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/g)];
if (meta.length !== 1) fel(`index.html ska ha exakt en CSP-meta-tagg, har ${meta.length}.`);
if (!html.includes("</head>")) fel("index.html saknar </head>.");
// Trusted Types (säkerhet B2): en vanlig sträng i innerHTML ger TypeError i elevens webbläsare, och då går
// den delen av sidan sönder. Bygget faller hellre, så att förra versionen ligger kvar.
const forsta = html.slice(0, skript[0].index).split("\n").length + 1;
const osakra = [...skript[0][1].matchAll(/\.innerHTML\s*=(?!=)(?!\s*html\()|insertAdjacentHTML|\.outerHTML\s*=(?!=)|document\.write|\.srcdoc\s*=(?!=)/g)]
  .map((m) => `rad ${forsta + skript[0][1].slice(0, m.index).split("\n").length - 1}: ${m[0]}`);
if (osakra.length) fel(`index.html lägger in HTML utan html() (Trusted Types). Skriv el.innerHTML = html(…) eller el.replaceChildren():\n${osakra.join("\n")}`);

// Laddaren lägger in skriptet asynkront, så det kan komma innan sidan är färdigläst. Koden väntar
// därför på DOMContentLoaded, som skriptet sist i body gjorde av sig självt.
const app = `(function(){var k=function(){\n${skript[0][1]}\n};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",k,{once:true});else k()})();\n`;
const namn = `app.${createHash("sha256").update(app, "utf8").digest("hex").slice(0, 16)}.js`;
for (const f of readdirSync(publicDir)) if (/^app\.[0-9a-f]{16}\.js$/.test(f) && f !== namn) rmSync(join(publicDir, f));
writeFileSync(join(publicDir, namn), app, "utf8");

html = html.replace(skript[0][0], () => "");
html = html.replace(meta[0][0], () => `<meta http-equiv="Content-Security-Policy" content="${CSP}">`);
html = html.replace("</head>", () => `<script data-app="${namn}">${LADDARE}</script>\n</head>`);
writeFileSync(indexFil, html, "utf8");
if (!existsSync(join(publicDir, namn))) fel(`${namn} skrevs inte.`);
console.log(`public/index.html: skriptet flyttat till ${namn} (${Math.round(app.length / 1024)} kB), policyn strikt.`);

// 5. GitHub Pages (säkerhet 3a, 2026-10-27): --vidarekoppla byter index.html mot en sida som skickar
// eleven vidare till samma ställe hos Vercel, med adressens # och det eleven sparat på Pages (VIDARE i
// csp.mjs). Allt ovan körs ändå, så att Pages blir en full kopia igen om flaggan tas bort i pages.yml.
if (process.argv.includes("--vidarekoppla")) {
  if (process.env.VERCEL) fel("--vidarekoppla gäller bara GitHub Pages. Hos Vercel skulle sidan skicka vidare till sig själv.");
  writeFileSync(indexFil, `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${VIDARE_CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Matematikvideor av Rickard</title>
<link rel="canonical" href="${VIDARE_TILL}/">
<script>${VIDARE}</script>
<noscript><meta http-equiv="refresh" content="0; url=${VIDARE_TILL}/"></noscript>
<style>${VIDARE_STIL}</style>
</head>
<body>
<p>Videoteket finns på <a href="${VIDARE_TILL}/">${VIDARE_TILL.replace("https://", "")}</a>.</p>
</body>
</html>
`, "utf8");
  console.log(`public/index.html: vidarekoppling till ${VIDARE_TILL} (GitHub Pages).`);
}
