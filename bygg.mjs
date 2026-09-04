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

const videor = register.map((v) => {
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
  // Omslaget: 1280 px bred jpeg (~200 kB) i stället för 3 MB png — sidan ska
  // öppnas snabbt på mobil. sips finns på macOS.
  let omslag = null;
  if (v.omslag && existsSync(resolve(HÄR, v.omslag))) {
    omslag = `omslag/${v.id}.jpg`;
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "58", "--resampleWidth", "400", resolve(HÄR, v.omslag), "--out", join(HÄR, "public", omslag)], { stdio: "ignore" });
  }
  return { id: v.id, titel: v.titel, kurs: v.kurs, moment: v.moment, begrepp: v.begrepp, beskrivning: v.beskrivning, youtube: v.youtube || null, langd, omslag, repliker };
});

writeFileSync(join(HÄR, "public", "videor.json"), JSON.stringify({ byggd: new Date().toISOString(), videor }, null, 1), "utf8");
console.log(`public/videor.json: ${videor.length} video(r), ${videor.reduce((a, v) => a + v.repliker.length, 0)} repliker.`);
