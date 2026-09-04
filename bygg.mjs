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

// Tidslinjen är kronologisk: `ar` i registret är året berättelsen utspelar sig.
const videor = [...register].sort((a, b) => (a.ar ?? 9999) - (b.ar ?? 9999)).map((v) => {
  const projekt = resolve(HÄR, v.projekt);
  const tiderFil = join(projekt, "assets", "tal-tider.json");
  const manusFil = join(projekt, "assets", "manus.txt");
  let repliker = [];
  let langd = null;
  if (existsSync(tiderFil)) {
    const d = JSON.parse(readFileSync(tiderFil, "utf8"));
    repliker = d.repliker.map((r) => ({ t: Math.max(0, Math.floor(r.start)), text: r.text }));
    langd = Math.round(d.langd);
  } else if (existsSync(manusFil)) {
    repliker = readFileSync(manusFil, "utf8").split("\n").filter((r) => r.trim()).map((r) => ({ t: null, text: taggfri(r) }));
  }
  // Omslaget: 720 px bred jpeg (~30 kB) i stället för 3 MB png — sidan ska
  // öppnas snabbt på mobil. sips finns på macOS.
  let omslag = null;
  if (v.omslag && existsSync(resolve(HÄR, v.omslag))) {
    omslag = `omslag/${v.id}.jpg`;
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "58", "--resampleWidth", "720", resolve(HÄR, v.omslag), "--out", join(HÄR, "public", omslag)], { stdio: "ignore" });
  }
  // Finns omslaget även utan titel (omslag-utan-titel.png bredvid) används det
  // på sidan — titeln står ändå i text under bilden.
  let omslagRen = null;
  const renKalla = v.omslag ? resolve(HÄR, dirname(v.omslag), "omslag-utan-titel.png") : null;
  if (renKalla && existsSync(renKalla)) {
    omslagRen = `omslag/${v.id}-ren.jpg`;
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "58", "--resampleWidth", "720", renKalla, "--out", join(HÄR, "public", omslagRen)], { stdio: "ignore" });
  }
  return { id: v.id, titel: v.titel, ar: v.ar ?? null, kurs: v.kurs, moment: v.moment, begrepp: v.begrepp, beskrivning: v.beskrivning, youtube: v.youtube || null, langd, omslag, omslagRen, repliker };
});

// Introbilden: Kepler-omslaget utan titel som helskärmsfond (avmättas och
// mörkas i CSS). 1600 px bred, ~55 kB.
const INTRO = resolve(HÄR, "../kepler-och-planeterna/assets/omslag/omslag-utan-titel.png");
if (existsSync(INTRO)) {
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "42", "--resampleWidth", "1600", INTRO, "--out", join(HÄR, "public", "omslag", "intro.jpg")], { stdio: "ignore" });
}

writeFileSync(join(HÄR, "public", "videor.json"), JSON.stringify({ byggd: new Date().toISOString(), videor }, null, 1), "utf8");
console.log(`public/videor.json: ${videor.length} video(r), ${videor.reduce((a, v) => a + v.repliker.length, 0)} repliker.`);
