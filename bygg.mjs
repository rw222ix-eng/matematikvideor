/**
 * Bygger videotekets data ur videoprojekten.
 *
 *   node bygg.mjs
 *
 * Läser register.json (en post per video: titel, kurs, moment, begrepp,
 * YouTube-id, sökväg till projektet) och hämtar ur varje projekt
 *   · assets/tal-tider.json  — replikerna med uppmätta tider (sökbara, med
 *                              hopp till sekunden), eller
 *   · assets/manus.txt       — bara texten, om rösten inte finns än
 * och skriver public/videor.json samt kopierar omslaget till public/omslag/.
 *
 * Sidan (public/index.html) är helt statisk: sökningen sker i elevens
 * webbläsare mot videor.json. Ingen server, ingen inloggning.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HÄR = dirname(fileURLToPath(import.meta.url));
const register = JSON.parse(readFileSync(join(HÄR, "register.json"), "utf8"));
mkdirSync(join(HÄR, "public", "omslag"), { recursive: true });

const taggfri = (s) => s.replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim();

// tal.srt → [{ s, e, text }] för sidans egna undertexter (sekundexakta, i Charter som i filmen).
function lasSrt(fil) {
  const tid = (h, m, s, ms) => Math.round((+h * 3600 + +m * 60 + +s + +ms / 1000) * 100) / 100;
  return readFileSync(fil, "utf8").replace(/\r/g, "").trim().split(/\n\n+/).map((block) => {
    const rader = block.split("\n");
    const m = (rader[1] || "").match(/(\d+):(\d+):(\d+),(\d+) --> (\d+):(\d+):(\d+),(\d+)/);
    if (!m) return null;
    return { s: tid(m[1], m[2], m[3], m[4]), e: tid(m[5], m[6], m[7], m[8]), text: rader.slice(2).join(" ").trim() };
  }).filter(Boolean);
}

// Bilderna bakas med ffmpeg: filtren (kurvor, avmättning) bränns in i filerna, för
// CSS-filter på stora bilder som zoomar gjorde hela sidan trög. Saknas ffmpeg används
// sips utan filter.
const harFfmpeg = (() => { try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return true; } catch (e) { return false; } })();
function bakaBild(kalla, mal, bredd, filter, kvalitet) {
  if (harFfmpeg) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", kalla, "-vf", `scale=${bredd}:-2${filter ? "," + filter : ""}`, "-q:v", String(kvalitet), mal], { stdio: "ignore" });
  else execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "45", "--resampleWidth", String(bredd), kalla, "--out", mal], { stdio: "ignore" });
}

// Omslagens kurva (Rickard 2026-09-13): korten ska visa bilderna, inte en mörk
// wash. Skuggorna lyfts som i intro-fonden — svärtan fast i noll, ingen ändring av
// färgton eller mättnad — så Kepler och Viète (nattbilder, YAVG 21 resp. 33 i gråskala)
// går upp till 48 och 66. Lyftet är beroende av bildens egen ljushet: ett omslag som
// redan är ljust (Arkimedes v2, YAVG 77) blev urblekt med full kurva (109, väggen
// nästan vit), så över YAVG 60 bakas det utan kurva och däremellan med en halv.
const OMSLAGSKURVA = "curves=all='0/0 0.05/0.16 0.15/0.30 0.45/0.55 0.8/0.86 1/1'";
const OMSLAGSKURVA_HALV = "curves=all='0/0 0.05/0.10 0.15/0.22 0.45/0.50 0.8/0.83 1/1'";
function medelljus(fil) {
  if (!harFfmpeg) return null;
  try {
    const ut = execFileSync("ffprobe", ["-v", "error", "-f", "lavfi", "-i", `movie=${fil},scale=360:-2,signalstats`, "-show_entries", "frame_tags=lavfi.signalstats.YAVG", "-of", "csv=p=0"], { encoding: "utf8" });
    return parseFloat(ut.split("\n")[0]);
  } catch (e) { return null; }
}
function omslagskurva(fil) {
  const y = medelljus(fil);
  if (y == null || y < 45) return OMSLAGSKURVA;
  if (y < 60) return OMSLAGSKURVA_HALV;
  return "";
}

// Tidslinjen är kronologisk: `ar` i registret är året berättelsen utspelar sig.
const videor = [...register].sort((a, b) => (a.ar ?? 9999) - (b.ar ?? 9999)).map((v) => {
  const projekt = resolve(HÄR, v.projekt);
  const tiderFil = join(projekt, "assets", "tal-tider.json");
  const manusFil = join(projekt, "assets", "manus.txt");
  const srtFil = join(projekt, "assets", "tal.srt");
  const undertext = existsSync(srtFil) ? lasSrt(srtFil) : null;
  let repliker = [];
  let langd = null;
  if (existsSync(tiderFil)) {
    const d = JSON.parse(readFileSync(tiderFil, "utf8"));
    repliker = d.repliker.map((r) => ({ t: Math.max(0, Math.floor(r.start)), text: r.text }));
    langd = Math.round(d.langd);
  } else if (existsSync(manusFil)) {
    repliker = readFileSync(manusFil, "utf8").split("\n").filter((r) => r.trim()).map((r) => ({ t: null, text: taggfri(r) }));
  }
  // Omslaget: 720 px bred jpeg (~40 kB) i stället för 3 MB png — sidan ska
  // öppnas snabbt på mobil. Skuggorna lyfts med omslagskurva() efter bildens ljushet.
  // Saknas källbilden (t.ex. medan ett nytt omslag målas) behålls den jpeg som
  // redan ligger i public/omslag — bygget ska inte tappa ett kort för det.
  const bakaOmslag = (kalla, ut) => {
    if (kalla && existsSync(kalla)) {
      bakaBild(kalla, join(HÄR, "public", ut), 720, omslagskurva(kalla), 3);
      return ut;
    }
    if (existsSync(join(HÄR, "public", ut))) {
      console.warn(`  varning: ${kalla ? kalla.replace(HÄR + "/", "") : "omslag"} saknas — behåller public/${ut} som den är.`);
      return ut;
    }
    if (kalla) console.warn(`  varning: ${kalla.replace(HÄR + "/", "")} saknas, inget omslag för ${v.id}.`);
    return null;
  };
  const omslag = bakaOmslag(v.omslag ? resolve(HÄR, v.omslag) : null, `omslag/${v.id}.jpg`);
  // Finns omslaget även utan titel (omslag-utan-titel.png bredvid) används det
  // på sidan — titeln står ändå i text under bilden.
  const renKalla = v.omslag ? resolve(HÄR, dirname(v.omslag), "omslag-utan-titel.png") : null;
  const omslagRen = bakaOmslag(renKalla, `omslag/${v.id}-ren.jpg`);
  return { id: v.id, titel: v.titel, ar: v.ar ?? null, kurs: v.kurs, fil: v.fil || null, moment: v.moment, begrepp: v.begrepp, beskrivning: v.beskrivning, youtube: v.youtube || null, langd, omslag, omslagRen, repliker, undertext };
});

// Introbilden: Kepler-omslaget utan titel som helskärmsfond. Skuggorna lyfts med
// en kurva (svärtan fast i noll) så rummet syns; en mörkning här gjorde bilden
// nästan helt svart (Rickard 2026-09-12). 1600 px bred.
// assets/intro-fond.png är 720 px-omslaget förstorat 4x till 2880 px i Topaz
// Gigapixel (modell Wonder 3.5, 2026-09-12), för att fonden syntes pixlig
// uppskalad till helskärm. Originalet i full upplösning ligger bara på Rickards
// Mac, så den sökvägen står kvar som reserv.
const INTRO = [
  resolve(HÄR, "assets", "intro-fond.png"),
  resolve(HÄR, "../kepler-och-planeterna/assets/omslag/omslag-utan-titel.png"),
].find(existsSync);
if (INTRO) bakaBild(INTRO, join(HÄR, "public", "omslag", "intro.jpg"), 1920, "curves=all='0/0 0.08/0.18 0.3/0.55 0.6/0.85 1/1',hue=s=0.75", 2);
// Fonden bakom "Välj en film". Källbilden är rätt exponerad (medelljushet omkring 61
// i gråskala), så här räcker en mild kurva: skuggorna lyfts en aning (Rickard ville ha
// den "lite ljusare", 2026-09-13), svärtan står kvar i noll, mättnaden som förut.
const VALJ = resolve(HÄR, "assets", "valj-fond.png");
if (existsSync(VALJ)) bakaBild(VALJ, join(HÄR, "public", "omslag", "valj-fond.jpg"), 1600, "curves=all='0/0 0.1/0.15 0.4/0.48 1/1',hue=s=0.9", 5);
// Stjärnorna i fonden mäts upp och skrivs till public/stjarnor.json, som sidan
// låter glimra. Går python inte att köra här får den gamla tabellen stå kvar:
// bygget ska inte falla på en sak som bara ändras när fonden byts.
try {
  execFileSync("python", [join(HÄR, "verktyg", "hitta-stjarnor.py")], { stdio: "inherit" });
} catch (e) { /* inget python, ingen ny tabell */ }

writeFileSync(join(HÄR, "public", "videor.json"), JSON.stringify({ byggd: new Date().toISOString(), videor }, null, 1), "utf8");
console.log(`public/videor.json: ${videor.length} video(r), ${videor.reduce((a, v) => a + v.repliker.length, 0)} repliker.`);
