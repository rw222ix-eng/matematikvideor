// Skärmbilder av sidan i en egen headless Chrome (2026-09-25). Den inbyggda webbläsarpanelen och
// Rickards Chrome-flikar ligger ofta dolda, och då stryps timrar och animationer, så att guiden och
// Newtons rörelser inte går att se där. Startar en egen Chrome, öppnar en sida och kör ett manus
// av steg (vänta, kör JS, ta skärmbild):
//   node verktyg/skarmbilder.mjs <url> <utmapp> <bredd> <höjd> '[{"js":"…"},{"vanta":1500,"bild":"namn"}]'
// Lokal server: python3 -m http.server 8765 --directory public; öppna http://[::1]:8765/#filmer.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const [url, ut, B, H, stegJson] = process.argv.slice(2);
mkdirSync(ut, { recursive: true });
const profil = join(tmpdir(), `cdp-profil-${process.pid}`);
const port = 9300 + (process.pid % 500);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, `--window-size=${B},${H}`, "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: "ignore" });
const vila = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, nr = 0; const svar = new Map();
const skicka = (method, params = {}) => new Promise((klar, fel) => { const id = ++nr; svar.set(id, { klar, fel }); ws.send(JSON.stringify({ id, method, params })); });
try {
  let mal;
  for (let i = 0; i < 50 && !mal; i++) { await vila(200); try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); mal = l.find((x) => x.type === "page"); } catch (e) {} }
  ws = new WebSocket(mal.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && svar.has(m.id)) { const s = svar.get(m.id); svar.delete(m.id); m.error ? s.fel(new Error(m.error.message)) : s.klar(m.result); } });
  await skicka("Page.enable"); await skicka("Runtime.enable");
  await skicka("Emulation.setDeviceMetricsOverride", { width: +B, height: +H, deviceScaleFactor: 1, mobile: +B < 700 });
  // Smalare än 700 px: en telefon, med pekskärm (då gäller (hover: none) som på en riktig telefon).
  if (+B < 700) await skicka("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await skicka("Page.navigate", { url });
  await vila(2500);
  let n = 0;
  for (const s of JSON.parse(stegJson)) {
    if (s.vanta) await vila(s.vanta);
    if (s.js) { const r = await skicka("Runtime.evaluate", { expression: s.js, awaitPromise: true, returnByValue: true }); if (r.result && r.result.value !== undefined) console.log(`js: ${JSON.stringify(r.result.value)}`); if (r.exceptionDetails) console.log("fel:", r.exceptionDetails.text, r.exceptionDetails.exception && r.exceptionDetails.exception.description); }
    if (s.bild) { const r = await skicka("Page.captureScreenshot", { format: "jpeg", quality: 80 }); const fil = join(ut, `${String(++n).padStart(2, "0")}-${s.bild}.jpg`); writeFileSync(fil, Buffer.from(r.data, "base64")); console.log(fil); }
  }
} finally { try { ws && ws.close(); } catch (e) {} chrome.kill(); await vila(300); try { rmSync(profil, { recursive: true, force: true }); } catch (e) {} }
