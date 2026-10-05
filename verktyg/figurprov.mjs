// Provbild av Din tur-figuren: ritar `figur` ur dintur.json på sin plåt med sidans egen figur()
// och sidans CSS, och tar en skärmbild med Chrome utan fönster. Så kontrolleras att strecken
// ligger rätt på plåten innan något byggs.
//
//   node verktyg/figurprov.mjs <film-id> [fler id …] [--ut <mapp>] [--json <fil med figuren>]
//
// Bilden hamnar i <mapp>/<film-id>.png (standard: /tmp/figurprov). Med --json läses figuren ur en
// egen fil (samma form som `figur` i dintur.json) i stället för ur dintur.json.
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HÄR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv.slice(2);
const flagga = (namn) => { const i = arg.indexOf(namn); if (i < 0) return null; const v = arg[i + 1]; arg.splice(i, 2); return v; };
const UT = resolve(flagga("--ut") || "/tmp/figurprov");
const JSONFIL = flagga("--json");
if (!arg.length) { console.error("ange ett film-id"); process.exit(1); }
mkdirSync(UT, { recursive: true });

const html = readFileSync(join(HÄR, "public", "index.html"), "utf8");
const a = html.indexOf("function figur(f)"), b = html.indexOf("const figurIakttagare");
if (a < 0 || b < 0) throw new Error("hittar inte figur() i public/index.html");
const figurKod = html.slice(a, b).trim();
// Figurens CSS: raderna om .dintur-figur och deras keyframes. Utan klassen "vantar" står allt ritat.
const css = html.split("\n").filter((r) => /^\s*(\.dintur-figur|@keyframes (rita-fram|tona-in))/.test(r)).join("\n");
const dintur = JSON.parse(readFileSync(join(HÄR, "dintur.json"), "utf8"));
const register = JSON.parse(readFileSync(join(HÄR, "register.json"), "utf8"));

const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"].find(existsSync);
if (!CHROME) throw new Error("hittar inte Chrome");

for (const id of arg) {
  const f = JSONFIL ? JSON.parse(readFileSync(JSONFIL, "utf8")) : dintur[id] && dintur[id].figur;
  if (!f) { console.error(`${id}: ingen figur`); continue; }
  const v = register.find((x) => x.id === id);
  let bild = null;
  if (f.bild) {
    const kallor = [v && join(resolve(HÄR, v.projekt), "assets", "platar", `${f.bild}.png`), join(HÄR, "assets", "dintur", `${f.bild}.png`)].filter(Boolean);
    const fil = kallor.find(existsSync);
    if (!fil) console.error(`${id}: plåten ${f.bild} finns inte (${kallor.join(", ")})`);
    else bild = "file://" + fil;
  }
  const bredd = f.bild ? 1920 : Math.round(f.vy[0] * 1.2);
  const sida = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; background: #171414; font-family: Jost, sans-serif; }
    :root { --bg: #171414; --ben: #ECE6D8; --ben2: #B5AE9F; --accent: #F2C572; --sans: Jost, sans-serif; --skrift: "Cormorant Garamond", Georgia, serif; --lugn: ease; }
    ${css}
    .dintur-figur { margin: 0 !important; max-width: none !important; width: ${bredd}px !important; border-radius: 0 !important; box-shadow: none !important; }
  </style><body><div id="r"></div><script>
    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const attr = (s) => esc(String(s)).replace(/"/g, "&quot;");
    ${figurKod}
    const f = ${JSON.stringify({ ...f, bild })};
    document.getElementById("r").innerHTML = figur(f).replace(" vantar", "");
  </script>`;
  const tmp = mkdtempSync(join(tmpdir(), "figurprov-"));
  const sidfil = join(tmp, "prov.html");
  writeFileSync(sidfil, sida);
  const hojd = f.bild ? Math.round(1920 * (f.utsnitt ? f.utsnitt[3] / f.utsnitt[2] : 9 / 16)) : Math.round(f.vy[1] * 1.2);
  const ut = join(UT, `${id}.png`);
  // Chrome skriver bilden men avslutas inte alltid: tidsgräns, och bilden avgör om det gick.
  if (existsSync(ut)) rmSync(ut);
  try {
    execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", `--user-data-dir=${join(tmp, "profil")}`,
      "--virtual-time-budget=3000", `--window-size=${bredd},${hojd}`, `--screenshot=${ut}`, "file://" + sidfil], { stdio: "ignore", timeout: 15000, killSignal: "SIGKILL" });
  } catch (e) { /* tidsgränsen */ }
  console.log(existsSync(ut) ? ut : `${id}: ingen bild`);
}
