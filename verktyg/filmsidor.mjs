/**
 * En liten sida per film, public/film/<id>/index.html, så att en länk till filmen får titel
 * och bild när den klistras in i Classroom (2026-09-24). Filmen själv ligger under #<id> i
 * index.html, men det som står efter # skickas aldrig till servern, så förhandsvisningen såg
 * bara startsidan. Den här sidan har filmens egna og-taggar och skickar direkt vidare till
 * ../../#<id>&t=<sekund>. Adressen är relativ, så den fungerar även på GitHub Pages-spegeln.
 *
 *   node verktyg/filmsidor.mjs      (körs också sist i bygg.mjs)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Förhandsbilden måste ha en hel adress. Spegeln på GitHub Pages pekar också hit, och det gör inget.
export const SAJT = "https://winterhalls-matte.vercel.app";

const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const kursKort = (kurs) => { const m = kurs.match(/(\d)\s*([a-c]*)$/i); return m ? `Ma ${m[1]}${m[2].toLowerCase()}` : kurs; };

function sida(v) {
  const kurser = v.kurser && v.kurser.length ? v.kurser.map(kursKort).join(" / ") : kursKort(v.kurs);
  const titel = `${v.titel} · ${kurser}, ${v.moment}`;
  const bild = v.omslagStor || v.omslag || v.omslagRen;
  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${attr(titel)}</title>
<meta name="description" content="${attr(v.beskrivning)}">
<meta name="robots" content="noindex, nofollow">
<meta property="og:type" content="video.other">
<meta property="og:locale" content="sv_SE">
<meta property="og:site_name" content="Matematikvideor av Rickard">
<meta property="og:title" content="${attr(titel)}">
<meta property="og:description" content="${attr(v.beskrivning)}">
<meta property="og:url" content="${SAJT}/film/${v.id}/">
${bild ? `<meta property="og:image" content="${SAJT}/${attr(bild)}">\n<meta name="twitter:card" content="summary_large_image">\n` : ""}<script>
  var t = new URLSearchParams(location.search).get("t");
  location.replace("../../#${v.id}" + (t && /^\\d+$/.test(t) ? "&t=" + t : ""));
</script>
<noscript><meta http-equiv="refresh" content="0; url=../../#${v.id}"></noscript>
<style>html { background: #171414; color: #ECE6D8; font: 17px/1.7 system-ui, sans-serif; } a { color: #F2C572; }</style>
</head>
<body>
<p><a href="../../#${v.id}">${attr(v.titel)}</a></p>
</body>
</html>
`;
}

export function skrivFilmsidor(videor, publicDir) {
  const rot = join(publicDir, "film");
  mkdirSync(rot, { recursive: true });
  const ids = new Set(videor.map((v) => v.id));
  // En film som tagits bort ur registret ska inte ha kvar sin sida.
  for (const namn of readdirSync(rot)) if (!ids.has(namn)) rmSync(join(rot, namn), { recursive: true, force: true });
  for (const v of videor) {
    mkdirSync(join(rot, v.id), { recursive: true });
    writeFileSync(join(rot, v.id, "index.html"), sida(v), "utf8");
  }
  console.log(`public/film/: ${videor.length} filmsidor.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  const fil = join(publicDir, "videor.json");
  if (!existsSync(fil)) { console.error("public/videor.json saknas. Kör node bygg.mjs först."); process.exit(1); }
  skrivFilmsidor(JSON.parse(readFileSync(fil, "utf8")).videor, publicDir);
}
