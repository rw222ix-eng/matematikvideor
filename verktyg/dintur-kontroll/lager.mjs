// Ritar alla Din tur-figurer med sidans egen figur() och CSS, i de lager kontrollen behöver.
//   node lager.mjs <videotek> <utmapp> [--patch fil.json] [--css fil.css] [--id film,film]
// Ger <ut>/{dator,telefon}-{hel,text,streck}.png (rutnät, 1 enhet = 1 px, 150 px luft runt utsnittet)
// och <ut>/matt.json (rutornas plats, varje texts ruta).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const arg = process.argv.slice(2);
const flagga = (n) => { const i = arg.indexOf(n); if (i < 0) return null; const v = arg[i + 1]; arg.splice(i, 2); return v; };
const PATCH = flagga("--patch"), EXTRA = flagga("--css"), IDN = flagga("--id"), VISA = flagga("--visa"), FIX = arg.includes("--fix");
if (FIX) arg.splice(arg.indexOf("--fix"), 1);
const [VT, UT] = arg.map((a) => resolve(a));
mkdirSync(UT, { recursive: true });
const html = readFileSync(join(VT, "public/index.html"), "utf8");
const a = html.indexOf("function figur(f)"), b = html.indexOf("const figurIakttagare");
let figurKod = html.slice(a, b).trim();
// --fix: etiketten på en sida börjar vid linjen i stället för att centreras på ett avstånd, så att
// en bred etikett inte kan korsa en lodrät linje. Samma ändring ska in i public/index.html vid rättelsen.
const GAMMAL = `return text([(a[0] + b[0]) / 2 - uy * s, (a[1] + b[1]) / 2 + ux * s], e.text, e);`;
const NY = `const nx = -uy * Math.sign(s), ankare = nx > 0.35 ? "start" : nx < -0.35 ? "end" : "middle"; return text([(a[0] + b[0]) / 2 - uy * s, (a[1] + b[1]) / 2 + ux * s], e.text, e, ankare);`;
if (FIX && figurKod.includes(GAMMAL)) figurKod = figurKod.replace(GAMMAL, NY);
const allaCss = html.split("\n");
const css = allaCss.filter((r) => /^\s*(\.dintur-figur|@keyframes (rita-fram|tona-in))/.test(r) && !/^\s*\.dintur\.med/.test(r));
// Telefonreglerna står i @media (max-width: 600px): de sista sex .dintur-figur.plat-raderna där.
const start = allaCss.findIndex((r) => /Telefon: plåten är/.test(r));
const slut = allaCss.findIndex((r, i) => i > start && /^\s*}\s*$/.test(r));
const telefon = allaCss.slice(start, slut).filter((r) => /^\s*\.dintur-figur/.test(r)).join("\n");
const dator = css.filter((r) => !telefon.includes(r.trim())).join("\n");
const fonts = allaCss.filter((r) => /@font-face/.test(r) && /latin\.woff2/.test(r)).join("\n").replaceAll("url(fonts/", `url(file://${VT}/public/fonts/`);
const extra = EXTRA ? readFileSync(EXTRA, "utf8") : "";
const dintur = JSON.parse(readFileSync(join(VT, "dintur.json"), "utf8"));
const patch = PATCH ? JSON.parse(readFileSync(PATCH, "utf8")) : {};
let id = Object.keys(dintur).filter((k) => dintur[k].figur);
if (IDN) id = IDN.split(",");
const LUFT = 150;
const figurer = id.map((k) => {
  const { flytt, ...over } = patch[k] || {};
  const f = { ...dintur[k].figur, ...over };
  // flytt: [{ text, vid, ankare, avstand, sida }] ändrar etiketten med den texten.
  if (flytt) f.delar = f.delar.map((d) => { const m = flytt.find((x) => x.text === d.text && (x.typ || d.typ) === d.typ && (x.nr == null || x.nr === f.delar.filter((y) => y.text === d.text).indexOf(d))); if (!m) return d; const { text, typ, nr, ...rest } = m; return { ...d, ...rest }; });
  return { id: k, f: { ...f, bild: `file://${VT}/public/dintur/${k}.jpg` } };
});
const vy = (f) => f.utsnitt || [0, 0, ...f.vy];
const KOL = 4, CW = 1920 + 2 * LUFT, CH = 1080 + 2 * LUFT;
const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find(existsSync);
const lagerCss = {
  hel: "svg.dintur-figur{overflow:hidden !important}",
  text: `svg image{display:none} svg path,svg circle{display:none} svg text{fill:#000 !important} svg .blak{filter:none !important}`,
  streck: `svg image{display:none} svg text{display:none} svg .streck{stroke:#000 !important;stroke-dasharray:none !important} svg .prick{fill:#000 !important} svg .yta,svg .rutnat{display:none} svg .blak{filter:none !important}`,
};
if (VISA) {
  // --visa <prefix>: en hel bild per film i den storlek den visas: dator 860 px, telefon 360 px (skala 2).
  for (const { id: fid, f } of figurer) for (const [lage, B] of [["dator", 860], ["telefon", 360]]) {
    const v = vy(f), H = Math.round(B * v[3] / v[2]);
    const sida = `<!doctype html><meta charset="utf-8"><style>${fonts}body{margin:0;background:#171414} :root{--bg:#171414;--ben:#ECE6D8;--ben2:#B5AE9F;--accent:#F2C572;--sans:Jost,sans-serif;--skrift:"Cormorant Garamond",Georgia,serif;--lugn:ease}
      ${dator}${lage === "telefon" ? telefon : ""}${extra}.dintur-figur{margin:0 !important;max-width:none !important;border-radius:0 !important;box-shadow:none !important;width:${B}px !important}</style><body><div id="r"></div><script>
      const esc=(s)=>s.replace(/[&<>]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));const attr=(s)=>esc(String(s)).replace(/"/g,"&quot;");${figurKod}
      document.getElementById("r").innerHTML=figur(${JSON.stringify(f)}).replace(" vantar","").replaceAll("data-stil=","style=");</script>`;
    const sidfil = join(UT, `.v-${fid}-${lage}.html`); writeFileSync(sidfil, sida);
    const png = `${VISA}-${fid}-${lage}.png`;
    try { execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", `--user-data-dir=${join(UT, ".profil")}`, "--force-device-scale-factor=2", "--virtual-time-budget=4000", `--window-size=${B},${H}`, `--screenshot=${png}`, "file://" + sidfil], { stdio: "ignore", timeout: 30000, killSignal: "SIGKILL" }); } catch (e) {}
    console.log(existsSync(png) ? png : "saknas " + png);
  }
  process.exit(0);
}
for (const lage of ["dator", "telefon"]) for (const lager of ["hel", "text", "streck"]) {
  const sida = `<!doctype html><meta charset="utf-8"><style>${fonts}
    body{margin:0;background:#fff;font-family:Jost,sans-serif} :root{--bg:#171414;--ben:#ECE6D8;--ben2:#B5AE9F;--accent:#F2C572;--sans:Jost,sans-serif;--skrift:"Cormorant Garamond",Georgia,serif;--lugn:ease}
    ${dator}${lage === "telefon" ? telefon : ""}${extra}
    .cell{position:absolute;width:${CW}px;height:${CH}px}
    .dintur-figur{position:absolute;margin:0 !important;max-width:none !important;border-radius:0 !important;box-shadow:none !important;overflow:visible !important}
    ${lagerCss[lager]}
  </style><body><pre id="ut" style="display:none"></pre><script>
    const esc=(s)=>s.replace(/[&<>]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
    const attr=(s)=>esc(String(s)).replace(/"/g,"&quot;");
    ${figurKod}
    const F=${JSON.stringify(figurer)};
    const mat=[];
    F.forEach(({id,f},i)=>{
      const c=document.createElement("div");c.className="cell";c.style.left=(i%${KOL})*${CW}+"px";c.style.top=Math.floor(i/${KOL})*${CH}+"px";
      c.innerHTML=figur(f).replace(" vantar","").replaceAll("data-stil=","style=");
      const s=c.firstElementChild,v=(f.utsnitt||[0,0,...f.vy]);
      s.style.left=${LUFT}+"px";s.style.top=${LUFT}+"px";s.style.width=v[2]+"px";s.style.height=v[3]+"px";
      document.body.append(c);
    });
    document.fonts.ready.then(()=>{
      document.querySelectorAll(".cell").forEach((c,i)=>{const s=c.firstElementChild,{id,f}=F[i];const m=[];
        s.querySelectorAll("text").forEach(t=>{const b=t.getBBox();m.push({t:t.textContent,x:b.x,y:b.y,w:b.width,h:b.height,klass:t.getAttribute("class")})});
        mat.push({id,v:(f.utsnitt||[0,0,...f.vy]),x:(i%${KOL})*${CW}+${LUFT},y:Math.floor(i/${KOL})*${CH}+${LUFT},text:m,tema:f.tema||"scen",blak:f.blak||null});
      });
      document.getElementById("ut").textContent=JSON.stringify(mat);
    });
  </script>`;
  const sidfil = join(UT, `.${lage}-${lager}.html`);
  writeFileSync(sidfil, sida);
  const png = join(UT, `${lage}-${lager}.png`);
  const opt = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", `--user-data-dir=${join(UT, ".profil")}`, "--force-device-scale-factor=1", "--virtual-time-budget=6000"];
  const rader = Math.ceil(figurer.length / KOL);
  try { execFileSync(CHROME, [...opt, `--window-size=${KOL * CW},${rader * CH}`, `--screenshot=${png}`, "file://" + sidfil], { stdio: "ignore", timeout: 60000, killSignal: "SIGKILL" }); } catch (e) {}
  if (lager === "text") {
    let dom = ""; try { dom = execFileSync(CHROME, [...opt, "--dump-dom", "file://" + sidfil], { timeout: 60000, killSignal: "SIGKILL", maxBuffer: 1e8, stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch (e) { dom = (e.stdout || "").toString(); }
    const m = dom.match(/<pre id="ut"[^>]*>(.*?)<\/pre>/s);
    if (m) writeFileSync(join(UT, `matt-${lage}.json`), m[1].replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">"));
    else console.error("ingen mätning", lage);
  }
  console.log(existsSync(png) ? png : "saknas " + png);
}
