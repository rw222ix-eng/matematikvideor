/**
 * Miniatyrerna i sökträffarna (18/11 2026). Träffraderna visar omslaget 120 px brett, men hämtade förut hela
 * omslaget (cirka 60 kB styck, 3,4 MB för en sökning). Här görs public/omslag/<id>-liten.webp, 320 px bred
 * (skarp på skärmar med dubbel täthet) i WebP med kvalitet 80, ur omslagRen eller omslag i public/videor.json.
 * publicera.mjs sätter omslagLiten i videor.json när filen finns, och sidan faller tillbaka på omslagRen annars.
 *
 *   node verktyg/smabilder.mjs        (bygg.mjs kör den sist)
 *
 * En miniatyr görs bara om när källans ?v= ändrats (verktyg/smabilder.json), så att en annan ffmpeg-version inte
 * ger nya filer för samma omslag. Utan ffmpeg görs inget, och sidan visar de stora omslagen som förut.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HÄR = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HÄR, "..", "public");
const KALLOR = join(HÄR, "smabilder.json");

export function skrivSmabilder(publicDir = PUBLIC) {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch (e) {
    console.warn("  varning: ffmpeg saknas, miniatyrerna i sökträffarna görs inte om.");
    return;
  }
  const { videor } = JSON.parse(readFileSync(join(publicDir, "videor.json"), "utf8"));
  const kallor = existsSync(KALLOR) ? JSON.parse(readFileSync(KALLOR, "utf8")) : {};
  const nya = {};
  let gjorda = 0;
  for (const v of videor) {
    const kalla = v.omslagRen || v.omslag;
    if (!kalla) continue;
    const fil = join(publicDir, kalla.split("?")[0]);
    const mal = join(publicDir, "omslag", `${v.id}-liten.webp`);
    if (!existsSync(fil)) continue;
    nya[v.id] = kalla;
    if (kallor[v.id] === kalla && existsSync(mal)) continue;
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", fil, "-vf", "scale=320:-2:flags=lanczos", "-c:v", "libwebp", "-quality", "80", "-compression_level", "6", mal], { stdio: "ignore" });
    gjorda++;
  }
  // Miniatyrer till filmer som inte längre finns tas bort.
  for (const f of readdirSync(join(publicDir, "omslag"))) {
    const m = f.match(/^(.+)-liten\.webp$/);
    if (m && !nya[m[1]]) rmSync(join(publicDir, "omslag", f));
  }
  writeFileSync(KALLOR, JSON.stringify(nya, null, 1) + "\n", "utf8");
  console.log(`public/omslag/*-liten.webp: ${Object.keys(nya).length} miniatyrer, ${gjorda} nya.`);
}

if (process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) skrivSmabilder();
