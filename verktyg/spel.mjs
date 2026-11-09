/**
 * Spelen i videoteket (Rickard 2026-11-09: spelen ligger «Inne i videoteket»). Spelen byggs och provas i geogebra-guidens
 * repo, som är privat. spel-filer.json här i roten är guidens lista (dess verktyg/spel-filer.mjs): varje fil med storlek
 * och sha256. Skriptet hämtar filerna från guidens publicerade sida och lägger dem i public/spel/ med samma vägar, så att
 * spelsidan hittar sina filer relativt sig själv (spel/tron.html, spel/figur/tron/ …). Stämmer en hash inte faller
 * publiceringen, och då ligger förra versionen kvar.
 *
 * En ny version av spelen: kör node verktyg/spel-filer.mjs i guiden när ändringen är publicerad där, och kopiera
 * spel-filer.json hit.
 *
 *   node verktyg/spel.mjs                      (i Cloudflare-jobbet i pages.yml, före publicera.mjs)
 *   node verktyg/spel.mjs --public <mapp>      (lokalt, i en kopia)
 *   … --kalla http://localhost:8191           (lokalt: guidens labbserver i stället för den publicerade sidan)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HÄR = dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf("--public");
const publicDir = i > 0 ? resolve(process.argv[i + 1]) : join(HÄR, "..", "public");
const lista = JSON.parse(readFileSync(join(HÄR, "..", "spel-filer.json"), "utf8"));
const fel = (s) => { console.error(`spel.mjs: ${s}`); process.exit(1); };
if (lista.kalla !== "https://geogebra-guiden.pages.dev") fel(`okänd källa ${lista.kalla}`);
const k = process.argv.indexOf("--kalla");
if (k > 0) {
  if (i < 0 || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(process.argv[k + 1])) fel("--kalla går bara lokalt, mot localhost och med --public");
  lista.kalla = process.argv[k + 1];
}

const spelDir = join(publicDir, "spel");
const filer = Object.values(lista.spel).flatMap((s) => s.filer);
const unika = [...new Map(filer.map((f) => [f.vag, f])).values()];
let klara = 0, byte = 0;

async function hamta(f) {
  // Bara vanliga vägar under spel/: inga .., ingen början med / och inga konstiga tecken.
  if (!/^[a-z0-9][a-z0-9._/-]*$/i.test(f.vag) || f.vag.includes("..")) fel(`konstig väg ${f.vag}`);
  const mal = normalize(join(spelDir, f.vag));
  if (!mal.startsWith(spelDir + sep)) fel(`${f.vag} hamnar utanför public/spel/`);
  for (let forsok = 1; ; forsok++) {
    try {
      const svar = await fetch(`${lista.kalla}/${f.vag}`, { cache: "no-store" });
      if (!svar.ok) throw new Error(`${svar.status}`);
      let data = Buffer.from(await svar.arrayBuffer());
      // Lokalt kommer texten ur en arbetskopia på Windows med CRLF. Listan räknar med LF, som den publicerade sidan.
      if (k > 0 && /\.(m?js|html|css|json|svg|txt)$/.test(f.vag)) data = Buffer.from(data.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
      const sha = createHash("sha256").update(data).digest("hex");
      if (sha !== f.sha256 || data.length !== f.storlek) fel(`${f.vag}: hashen stämmer inte med spel-filer.json (är guidens ändring publicerad?)`);
      mkdirSync(dirname(mal), { recursive: true });
      writeFileSync(mal, data);
      klara++; byte += data.length;
      return;
    } catch (e) {
      if (forsok >= 3) fel(`${f.vag}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * forsok));
    }
  }
}

const ko = [...unika];
await Promise.all(Array.from({ length: 8 }, async () => { while (ko.length) await hamta(ko.shift()); }));
for (const [namn, s] of Object.entries(lista.spel)) if (!existsSync(join(spelDir, s.sida))) fel(`${namn}: ${s.sida} saknas`);
console.log(`public/spel/: ${klara} filer, ${(byte / 1048576).toFixed(1)} MB, spelen ${Object.keys(lista.spel).join(", ")} (spel-filer.json ${lista.byggd}).`);
