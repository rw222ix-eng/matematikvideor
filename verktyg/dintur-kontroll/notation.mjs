// Kontroll av texten i Din tur (2026-11-06): kör sidans egen matte() på all text i dintur.json och
// stannar om rå notation (^, _, *) syns för eleven eller om ett tecken saknas i sidans typsnitt.
//   node verktyg/dintur-kontroll/notation.mjs [--visa]     (--visa skriver ut varje text med formler)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const VT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sida = readFileSync(join(VT, "public/index.html"), "utf8");
const a = sida.indexOf("  const esc = (s)"), b = sida.indexOf('.replace(/(?<=[A-Za-z0-9)])_([A-Za-z0-9]+)/g, "<sub>$1</sub>");');
const matte = new Function(`${sida.slice(a, b)}.replace(/(?<=[A-Za-z0-9)])_([A-Za-z0-9]+)/g, "<sub>$1</sub>"); return matte;`)();
// Det som finns i public/fonts: latin plus filerna *-matte.woff2.
const FINNS = /^[\x20-\x7E -ÿ–—‘’“”…−μπσ√∞≈≤≥□]$/u;
const dintur = JSON.parse(readFileSync(join(VT, "dintur.json"), "utf8"));
const visa = process.argv.includes("--visa");
const texter = (d) => [d.fraga, ...(d.slut || []), d.ledtrad && d.ledtrad.text, ...(d.losning || []), d.geogebra && d.geogebra.text,
  ...d.delar.flatMap((x) => [x.fraga, x.enhet, ...(x.fel || []).map((f) => f.text)])].filter(Boolean);
let fel = 0, antal = 0;
for (const [id, d] of Object.entries(dintur)) for (const t of texter(d)) {
  antal++;
  const h = matte(t), syns = h.replace(/<[^>]*>/g, "").replace(/&(lt|gt|amp|quot|#39);/g, "x");
  for (const c of new Set(syns)) if (!FINNS.test(c)) { console.log(`TECKEN ${c} saknas i typsnitten: ${id}: ${t}`); fel++; }
  if (/[_*\\]|\S\^\S/.test(syns)) { console.log(`RÅ NOTATION: ${id}: ${t}`); fel++; }
  if (visa && h !== t && /<(span|sup|sub)/.test(h)) console.log(h.replace(/<span class="matte">/g, "⟦").replace(/<\/span>/g, "⟧").replace(/ /g, "~"));
}
console.log(`${antal} texter i ${Object.keys(dintur).length} rutor, ${fel} fel.`);
process.exit(fel ? 1 : 0);
