/**
 * Kortbilderna för formelbladets fem delar (Rickard 2026-09-25): i stället för videons omslag
 * (ett skrivbord, samma i alla delar) visar kortet den del av formelbladet som filmen går
 * igenom, som i videorna: utklipp ur Skolverkets PDF på vita kort, tejpade på gräddvitt papper.
 *
 *   node verktyg/formelblad-kort.mjs            → assets/kort/<id>.png (1920×1080)
 *   node verktyg/formelblad-kort.mjs --omslag   → också videons omslag i ../<id>/assets/omslag/
 *   node verktyg/formelblad-kort.mjs --prov <mapp> → bara omslagen, som <mapp>/<id>.png (att titta på först)
 *
 * Omslagen (Rickard 2026-09-26: "den delen av formelbladet det handlar om urklippt och fasttejpad",
 * inte ett genererat skrivbord): omslag-utan-titel.png = kortbilden, omslag.png = samma utklipp
 * lagda under och bredvid titeln, som skrivs i bläck (Charter, som undertexterna) uppe till vänster.
 * Skrivbordsomslagen som fanns flyttas en gång till assets/omslag/bord/.
 *
 * bygg.mjs använder assets/kort/<id>.png till kortet, sökträffarna, Nästa del och affischen i
 * spelaren. Papperet, skuggan och tejpen är desamma som i f-plåtarna
 * (formelbladet-1-prefix-och-potenser/verktyg/gor-f-platar.mjs). Utklippen är bläckets ramruta på
 * 400 dpi med luft runt, och skriptet stoppar om en kant skär genom bläck.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const HÄR = dirname(fileURLToPath(import.meta.url));
const VIDEOTEK = join(HÄR, "..");
// Matematikvideos: mappen ovanför videoteket (eller, i ett git-arbetsträd, den riktiga mappen).
const MV = [join(VIDEOTEK, ".."), "/Users/rickardwinterhall/Matematikvideos"].find((m) => existsSync(join(m, "ritmotor")));
const sharp = require(join(MV, "ritmotor/geometri/node_modules/sharp"));

const DEL1 = join(MV, "formelbladet-1-prefix-och-potenser");
const PDF = join(DEL1, "assets/formelblad/Formelblad_Ma_1abc_2021.pdf");
// Formelbladet för Ma 2 (FORMELBLADET-MA2-SERIE.md): fyra sidor, sidorna heter "m2-1" … "m2-4" nedan.
const PDF2 = join(MV, "ma2a-gemensamt/Formelblad_Ma_niva_2.pdf");
const PAPPER = join(DEL1, "assets/formelblad/papper-bas.png");
const CACHE = join(VIDEOTEK, "verktyg/.cache");
const UT = join(VIDEOTEK, "assets/kort");
const W = 1920, H = 1080;

// ── Sidorna i 400 dpi ───────────────────────────────────────────────────────
mkdirSync(CACHE, { recursive: true });
mkdirSync(UT, { recursive: true });
const sidor = {};
for (const [nyckel, pdf, n] of [[1, PDF, 1], [2, PDF, 2], ...[1, 2, 3, 4].map((k) => [`m2-${k}`, PDF2, k])]) {
  const fil = join(CACHE, typeof nyckel === "number" ? `sida-${n}-400dpi.png` : `ma2-sida-${n}-400dpi.png`);
  if (!existsSync(fil)) execFileSync("pdftoppm", ["-r", "400", "-f", String(n), "-l", String(n), "-png", "-singlefile", pdf, fil.replace(/\.png$/, "")]);
  const g = await sharp(fil).greyscale().raw().toBuffer({ resolveWithObject: true });
  sidor[nyckel] = { fil, data: g.data, w: g.info.width, h: g.info.height };
}

// Kanten får inte gå genom bläck (tecken, figurer). Ljusgrå avdelarlinjer (> 200) räknas inte.
function kontrollera(namn, sida, u) {
  const s = sidor[sida], svart = (x, y) => s.data[y * s.w + x] < 200;
  for (let x = u.left; x < u.left + u.width; x++) if (svart(x, u.top) || svart(x, u.top + u.height - 1)) throw new Error(`${namn}: övre/nedre kanten skär genom bläck vid x ${x}`);
  for (let y = u.top; y < u.top + u.height; y++) if (svart(u.left, y) || svart(u.left + u.width - 1, y)) throw new Error(`${namn}: vänster/höger kant skär genom bläck vid y ${y}`);
}
// Bläckets ramruta inom ett ungefärligt område, med `luft` px runt (för del 5, som inte har
// uppmätta utklipp i sitt eget skript med samma form).
function blackRuta(sida, o, luft = 14, troskel = 200) {
  const s = sidor[sida];
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = o.top; y < o.top + o.height; y++) for (let x = o.left; x < o.left + o.width; x++) {
    if (s.data[y * s.w + x] < troskel) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { left: x0 - luft, top: y0 - luft, width: x1 - x0 + 1 + 2 * luft, height: y1 - y0 + 1 + 2 * luft };
}

// ── Utklippen (400 dpi-pixlar) ──────────────────────────────────────────────
// Del 1–4: samma ramrutor som i delarnas egna gor-f-platar.mjs. Del 5: mätta här.
const U = {
  prefix: { sida: 1, left: 303, top: 402, width: 2774, height: 467 },
  potenser: { sida: 1, left: 303, top: 932, width: 2403, height: 628 },
  funktioner: { sida: 1, left: 303, top: 1580, width: 2242, height: 808 },
  geometri: { sida: 1, left: 303, top: 2461, width: 2497, height: 4370 - 2461 },
  // Rymdgeometrin (sida 2, 413–2799 × 226–2864) i två spalter, delad vid linjen mellan cylindern
  // och pyramiden, så att bilden fyller 16:9 i stället för att bli en smal remsa.
  // Linjerna ligger på y 236–239, 1327–1330 och 2849–2852; mittlinjen följer med i båda spalterna.
  rymd1: { sida: 2, left: 413, top: 224, width: 2799 - 413, height: 1342 - 224 },
  rymd2: { sida: 2, left: 413, top: 1315, width: 2799 - 413, height: 2864 - 1315 },
  pythagoras: { sida: 2, ...blackRuta(2, { left: 380, top: 2870, width: 2480, height: 500 }) },
  vektorer: { sida: 2, ...blackRuta(2, { left: 260, top: 3440, width: 2600, height: 620 }) },
  // Ma 2-bladet: områden i PDF-punkter (rubrikernas lägen ur pdftotext -bbox), bläckets ramruta mäts i dem.
  ...Object.fromEntries(Object.entries({
    algebra: ["m2-1", 50, 136, 548, 316],            // Algebra: reglerna och andragradsekvationerna
    logaritmer: ["m2-1", 50, 640, 548, 712],         // Logaritmer
    funktioner2: ["m2-2", 50, 52, 548, 254],         // Funktioner och samband: räta linjen (k₁k₂ = −1) och andragradsfunktioner
    avstand: ["m2-4", 50, 265, 548, 336],            // Avståndsformeln och mittpunktsformeln
    likformighet: ["m2-3", 50, 185, 548, 292],       // Likformighet
    satser: ["m2-3", 50, 350, 548, 504],             // Topptriangel-, bisektris- och transversalsatsen
    vinklar: ["m2-3", 50, 505, 548, 708],            // Vinklar och vinkelsumman
    yttervinkel: ["m2-4", 50, 55, 292, 140],         // Yttervinkelsatsen (vänstra spalten; Pythagoras till höger hör till Ma 1)
    cirkelsatser: ["m2-4", 50, 147, 548, 262],       // Kordasatsen och randvinkelsatsen
    statistik: ["m2-4", 50, 505, 548, 792],          // Statistik och sannolikhet: lådagram och normalfördelning
  }).map(([namn, [sida, x0, y0, x1, y1]]) => {
    const k = 400 / 72;
    return [namn, { sida, ...blackRuta(sida, { left: Math.round(x0 * k), top: Math.round(y0 * k), width: Math.round((x1 - x0) * k), height: Math.round((y1 - y0) * k) }, 16) }];
  })),
};
for (const [k, u] of Object.entries(U)) kontrollera(k, u.sida, u);

// ── Papper, skugga, tejp (som gor-f-platar.mjs) ─────────────────────────────
const K = 1.5, MÅL = [237, 231, 220], BAS = [237.9, 234.4, 227.8];
const papper = await sharp(PAPPER).resize(W, H, { fit: "cover", kernel: "lanczos3" }).removeAlpha()
  .linear([K, K, K], MÅL.map((m, i) => m - K * BAS[i])).png().toBuffer();
const skugga = (x, y, w, h) => `
  <rect x="${x + 4}" y="${y + 12}" width="${w - 8}" height="${h}" fill="rgb(70,58,40)" fill-opacity="0.30" filter="url(#mjuk)"/>
  <rect x="${x}" y="${y + 2}" width="${w}" height="${h}" fill="rgb(60,50,35)" fill-opacity="0.22" filter="url(#nara)"/>`;
const tejp = (x, y, w, v1 = -6, v2 = 5) => [[x + Math.round(w * 0.1), v1], [x + Math.round(w * 0.9), v2]].map(([cx, v]) => `
  <g transform="translate(${cx} ${y}) rotate(${v})">
    <polygon points="-62,-17 -58,-13 -63,-8 -59,-3 -63,2 -58,7 -62,12 -59,17 62,17 58,12 63,7 59,2 63,-3 58,-8 62,-13 59,-17" fill="rgb(234,223,190)" fill-opacity="0.80"/>
    <rect x="-58" y="-17" width="116" height="4" fill="rgb(255,250,235)" fill-opacity="0.35"/>
  </g>`).join("");
const svg = (inre) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>
  <filter id="mjuk" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="13"/></filter>
  <filter id="nara" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>${inre}</svg>`);

// Ett kort: urklippet skalat till bredden `b` (eller höjden `h`), vit marginal `pad`, övre vänstra hörnet (x, y).
async function kort(namn, { b, h, x, y, pad = 30 }) {
  const u = U[namn];
  const s = b ? (b - 2 * pad) / u.width : (h - 2 * pad) / u.height;
  const iw = Math.round(u.width * s), ih = Math.round(u.height * s);
  const bild = await sharp(sidor[u.sida].fil).extract({ left: u.left, top: u.top, width: u.width, height: u.height })
    .resize(iw, ih, { kernel: "lanczos3" }).removeAlpha().png().toBuffer();
  const cw = iw + 2 * pad, ch = ih + 2 * pad;
  const kx = x === "mitt" ? Math.round((W - cw) / 2) : x, ky = y === "mitt" ? Math.round((H - ch) / 2) : y;
  return { namn, bild, x: kx, y: ky, w: cw, h: ch, pad, skala: s };
}

// ── De fem bilderna ─────────────────────────────────────────────────────────
// Korten fyller bilden med ungefär 70 px luft till kanten; två kort ligger förskjutna mot
// varandra som på ett uppslag. Det som skrivs ut per bild är skalan: hur stor texten blir.
const DELAR = [
  { id: "formelbladet-1-prefix-och-potenser", titel: "Formelbladet Ma 1", under: "Del 1 · Prefix och potenser",
    kort: async () => [await kort("prefix", { b: 1560, x: 110, y: 110 }), await kort("potenser", { b: 1420, x: 400, y: 520 })],
    omslag: async () => [await kort("prefix", { b: 1350, x: 110, y: 320 }), await kort("potenser", { b: 1350, x: 480, y: 590 })] },
  { id: "formelbladet-2-funktioner", titel: "Formelbladet Ma 1", under: "Del 2 · Funktioner",
    kort: async () => [await kort("funktioner", { b: 1720, x: "mitt", y: "mitt", pad: 36 })],
    omslag: async () => [await kort("funktioner", { b: 1600, x: "mitt", y: 350, pad: 36 })] },
  { id: "formelbladet-3-plan-geometri", titel: "Formelbladet Ma 1", under: "Del 3 · Plan geometri",
    kort: async () => [await kort("geometri", { h: 940, x: "mitt", y: 72, pad: 30 })],
    omslag: async () => [await kort("geometri", { h: 740, x: 860, y: 300, pad: 30 })] },
  { id: "formelbladet-4-rymdgeometri-och-skala", titel: "Formelbladet Ma 1", under: "Del 4 · Rymdgeometri och skala",
    kort: async () => [await kort("rymd1", { b: 870, x: 70, y: 290 }), await kort("rymd2", { b: 870, x: 980, y: 215 })],
    omslag: async () => [await kort("rymd1", { b: 870, x: 110, y: 360 }), await kort("rymd2", { b: 870, x: 1020, y: 250 })] },
  { id: "formelbladet-5-pythagoras-trigonometri-vektorer", titel: "Formelbladet Ma 1", under: "Del 5 · Pythagoras, trigonometri och vektorer",
    kort: async () => [await kort("pythagoras", { b: 1560, x: 110, y: 120 }), await kort("vektorer", { b: 1300, x: 470, y: 560 })],
    omslag: async () => [await kort("pythagoras", { b: 1400, x: 110, y: 320 }), await kort("vektorer", { b: 1250, x: 560, y: 620 })] },
  // Formelbladet Ma 2 (id = projektmappen i FORMELBLADET-MA2-SERIE.md).
  { id: "formelbladet-ma2-1-algebra", titel: "Formelbladet Ma 2", under: "Del 1 · Algebra",
    kort: async () => [await kort("algebra", { b: 1720, x: "mitt", y: "mitt", pad: 36 })],
    omslag: async () => [await kort("algebra", { b: 1700, x: 110, y: 380, pad: 36 })] },
  { id: "formelbladet-ma2-2-andragradsfunktionen", titel: "Formelbladet Ma 2", under: "Del 2 · Andragradsfunktionen",
    kort: async () => [await kort("funktioner2", { b: 1400, x: 120, y: 60 }), await kort("avstand", { b: 1320, x: 480, y: 720 })],
    omslag: async () => [await kort("funktioner2", { b: 1180, x: 110, y: 310 }), await kort("avstand", { b: 1200, x: 640, y: 835 })] },
  { id: "formelbladet-ma2-3-logaritmer", titel: "Formelbladet Ma 2", under: "Del 3 · Logaritmer",
    kort: async () => [await kort("logaritmer", { b: 1740, x: "mitt", y: "mitt", pad: 40 })],
    omslag: async () => [await kort("logaritmer", { b: 1700, x: 110, y: 500, pad: 40 })] },
  { id: "formelbladet-ma2-4-likformighet", titel: "Formelbladet Ma 2", under: "Del 4 · Likformighet",
    kort: async () => [await kort("likformighet", { b: 1400, x: 100, y: 90 }), await kort("satser", { b: 1320, x: 500, y: 480 })],
    omslag: async () => [await kort("likformighet", { b: 1250, x: 110, y: 320 }), await kort("satser", { b: 1300, x: 520, y: 580 })] },
  { id: "formelbladet-ma2-5-vinklar-och-cirkelsatser", titel: "Formelbladet Ma 2", under: "Del 5 · Vinklar och cirkelsatser",
    kort: async () => [await kort("vinklar", { b: 1000, x: 130, y: 50 }), await kort("yttervinkel", { b: 640, x: 1190, y: 150 }), await kort("cirkelsatser", { b: 1080, x: 710, y: 650 })],
    omslag: async () => [await kort("vinklar", { b: 1000, x: 110, y: 305 }), await kort("yttervinkel", { b: 680, x: 1160, y: 420 }), await kort("cirkelsatser", { b: 960, x: 900, y: 790 })] },
  { id: "formelbladet-ma2-6-statistik", titel: "Formelbladet Ma 2", under: "Del 6 · Statistik",
    kort: async () => [await kort("statistik", { h: 960, x: "mitt", y: "mitt", pad: 30 })],
    omslag: async () => [await kort("statistik", { h: 740, x: 650, y: 300, pad: 30 })] },
];

// Omslagets titel: bläck på papperet, Charter som undertexterna (mall/verktyg/omslagstitel.swift har
// samma grader och läge, men gräddvitt med skugga för de målade omslagen). Korten får inte gå in i TITELRUTAN.
const TITELRUTA = { x1: 1020, y1: 290 };
const titelSvg = (titel, under) => svg(`
  <text x="120" y="190" font-family="Charter" font-weight="bold" font-size="100" fill="#1A1A18">${titel}</text>
  <text x="124" y="262" font-family="Charter" font-size="44" fill="#1A1A18" fill-opacity="0.78">${under}</text>`);

function lager(id, k, { titel = false } = {}) {
  const l = [];
  for (const c of k) {
    if (c.x < 20 || c.y < 20 || c.x + c.w > W - 20 || c.y + c.h > H - 20) throw new Error(`${id}: kortet ${c.namn} går utanför bilden (${c.x},${c.y} ${c.w}×${c.h})`);
    if (titel && c.x < TITELRUTA.x1 && c.y < TITELRUTA.y1) throw new Error(`${id}: kortet ${c.namn} går in i titeln (${c.x},${c.y})`);
    l.push({ input: svg(skugga(c.x, c.y, c.w, c.h)), left: 0, top: 0 });
    l.push({ input: { create: { width: c.w, height: c.h, channels: 3, background: "#ffffff" } }, left: c.x, top: c.y });
    l.push({ input: c.bild, left: c.x + c.pad, top: c.y + c.pad });
    l.push({ input: svg(tejp(c.x, c.y, c.w)), left: 0, top: 0 });
  }
  return l;
}

const OMSLAG = process.argv.includes("--omslag");
const PROV = process.argv.includes("--prov") ? process.argv[process.argv.indexOf("--prov") + 1] : null;
if (PROV) {
  mkdirSync(PROV, { recursive: true });
  for (const d of DELAR) {
    const o = await d.omslag();
    await sharp(papper).composite([...lager(d.id, o, { titel: true }), { input: titelSvg(d.titel, d.under), left: 0, top: 0 }]).png().toFile(join(PROV, `${d.id}.png`));
    console.log(`${d.id}: ${o.map((c) => `${c.namn} ${c.skala.toFixed(3)} (${c.x},${c.y} ${c.w}×${c.h})`).join(", ")}`);
  }
  process.exit(0);
}
for (const d of DELAR) {
  const k = await d.kort();
  const fil = join(UT, `${d.id}.png`);
  await sharp(papper).composite(lager(d.id, k)).png().toFile(fil);
  console.log(`${fil.replace(VIDEOTEK + "/", "")}: ${k.map((c) => `${c.namn} ${c.skala.toFixed(3)}`).join(", ")}`);
  if (!OMSLAG) continue;
  const mapp = join(MV, d.id, "assets/omslag");
  if (!existsSync(join(MV, d.id))) { console.log(`  (ingen projektmapp ${d.id}, inget omslag)`); continue; }
  mkdirSync(mapp, { recursive: true });
  // Första gången: de gamla (skrivbords)omslagen flyttas undan till bord/.
  const bord = join(mapp, "bord");
  if (!existsSync(bord)) {
    const gamla = readdirSync(mapp).filter((f) => /^omslag.*\.png$/.test(f));
    if (gamla.length) { mkdirSync(bord); for (const f of gamla) renameSync(join(mapp, f), join(bord, f)); console.log(`  flyttade ${gamla.length} gamla omslag till bord/`); }
  }
  copyFileSync(fil, join(mapp, "omslag-utan-titel.png"));
  const o = await d.omslag();
  await sharp(papper).composite([...lager(d.id, o, { titel: true }), { input: titelSvg(d.titel, d.under), left: 0, top: 0 }]).png().toFile(join(mapp, "omslag.png"));
  console.log(`  omslag: ${o.map((c) => `${c.namn} ${c.skala.toFixed(3)}`).join(", ")}`);
}
