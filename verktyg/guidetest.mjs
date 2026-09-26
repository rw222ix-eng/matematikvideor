// Stresstest av Newtons guide (2026-09-26). Startar en egen headless Chrome (som skarmbilder.mjs), lägger
// in en vakt i sidan innan den laddas och kör ett manus (en modul som exporterar en async-funktion).
//   node verktyg/guidetest.mjs <url> <bredd> <höjd> <manus.mjs> [utmapp]
// Manusen ligger i verktyg/guidetest/, och verktyg/guidetest/svit.sh kör alla (dator och telefon).
// Manuset får ett objekt s med: js(uttryck), vanta(ms), klickPa/tryckPa/pekPa(väljare) (riktiga klick/tryck
// mitt på det första synliga elementet; pekPa = klick på dator, tryck på telefon), klick/tryck/pek(x, y),
// dra(x0, y0, x1, y1), tangent(namn, { upprepa }), bild(namn, { klipp, skala }), serie(namn, { ms, tid })
// (bildserie runt Newton + kontaktark med ffmpeg), storlek(b, h), ladda(url), omladda(), starta() (frågetecknet),
// vantaPaKnapp(regex), tillstand(), guide({ max, paus, val }) (trycker sig igenom guiden och loggar varje steg),
// vakt(namn) (vaktens fynd sedan förra anropet), logg(...). Vakten i sidan (var 100 ms): fel i sidan, bubbla
// utan knappar > 8 s, Newton eller bubblan utanför fönstret, Newton över något som lyser, text som inte blev
// hel eller skrevs dubbelt, guidens klasser och strålkastare kvar efter slut, allt som ändras i Newton efter
// slut, och strypta timrar (dold flik) eller långa uppgifter.
// Lärdom: skicka aldrig nativeVirtualKeyCode i tangenthändelser. På Macen blev → en genväg som öppnade
// chrome://settings/help i en ny flik, sidan blev dold och timrarna ströps till 1 s ("guiden hänger").
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const [url, B, H, manusFil, ut = join(tmpdir(), "guidetest")] = process.argv.slice(2);
mkdirSync(ut, { recursive: true });
const profil = join(tmpdir(), `cdp-guide-${process.pid}`);
const port = 9800 + (process.pid % 150);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, `--window-size=${B},${H}`, "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", "--mute-audio", "about:blank"], { stdio: "ignore" });
const vila = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, nr = 0; const svar = new Map();
const skicka = (method, params = {}) => new Promise((klar, fel) => { const id = ++nr; svar.set(id, { klar, fel }); ws.send(JSON.stringify({ id, method, params })); });
const t0 = Date.now();
const logg = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}]`, ...a);

// Vakten, som körs i sidan innan dess eget skript.
const VAKT = `(() => {
  window.__fel = [];
  addEventListener("error", (e) => __fel.push(e.message));
  addEventListener("unhandledrejection", (e) => __fel.push(String(e.reason && (e.reason.stack || e.reason))));
  const V = window.__vakt = { fynd: [], efterSlut: [], steg: [], tryck: [] };
  // Alla tryck och klick, före sidans egna lyssnare (vakten läggs in först): vad som gick fram och vad som stoppades.
  for (const t of ["pointerdown", "pointerup", "click"]) addEventListener(t, (e) => { V.tryck.push([t, e.isTrusted, e.detail, Math.round(e.timeStamp), Math.round(performance.now()), Math.round(e.clientX), Math.round(e.clientY), (e.target.id || e.target.className || e.target.nodeName) + ""]); if (V.tryck.length > 300) V.tryck.shift(); }, true);
  const fynd = (typ, text) => { if (V.fynd.length < 200) V.fynd.push({ t: Math.round(performance.now()), typ, text }); };
  let aktiv = false, sistaKnapp = 0, fastRapp = false, slut = -1, harUte = new Set(), senText = "";
  const ruta = (e) => e && e.getBoundingClientRect();
  const ute = (r, m = 6) => r.left < -m || r.top < -m || r.right > innerWidth + m || r.bottom > innerHeight + m;
  const snitt = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  function start() {
    const n = document.getElementById("newton"); if (!n) return setTimeout(start, 100);
    new MutationObserver((ms) => {
      if (slut < 0) return;
      const nu = performance.now();
      // Efter slut: gom() döljer Newton efter 460 ms. Allt som ändras i honom därefter (utom att ett tips
      // börjar, hidden=false) är en timer som fortsätter.
      if (nu - slut < 700) return;
      if (!n.hidden) { slut = -1; return; }
      for (const m of ms) { if (m.attributeName === "src") continue; if (V.efterSlut.length < 50) V.efterSlut.push({ t: Math.round(nu - slut), mal: (m.target.id || m.target.className || m.target.nodeName) + "", typ: m.type, attr: m.attributeName, varde: m.type === "attributes" ? String(m.target.getAttribute(m.attributeName)).slice(0, 80) : "" }); }
    }).observe(n, { attributes: true, childList: true, subtree: true, characterData: true });
    setInterval(() => {
      const nu = performance.now(), guidar = n.classList.contains("guide") && !n.hidden && document.body.classList.contains("guidar");
      if (guidar && !aktiv) { aktiv = true; sistaKnapp = nu; fastRapp = false; slut = -1; }
      if (!guidar && aktiv && !n.classList.contains("gar")) { aktiv = false; slut = nu; setTimeout(() => {
        if (n.classList.contains("guide") && !n.hidden) return;   // guiden startade om
        if (document.body.classList.contains("guidar")) fynd("slut", "body.guidar kvar 1 s efter slut");
        if (document.getElementById("guide-ljus").classList.contains("syns") && n.hidden) fynd("slut", "#guide-ljus kvar 1 s efter slut");
        if (document.body.classList.contains("newton-syns") && n.hidden) fynd("slut", "body.newton-syns kvar");
      }, 1000); }
      if (!aktiv) return;
      const knappar = n.querySelectorAll("#newton-knappar button").length, talar = n.classList.contains("talar");
      const txt = n.querySelector("#newton-text"), sr = txt.querySelector(".sr"), skr = txt.querySelector(".skrivet"), rest = txt.querySelector(".rest");
      if (knappar && talar) { sistaKnapp = nu; fastRapp = false; }
      if (nu - sistaKnapp > 8000 && !fastRapp) { fastRapp = true; fynd("fastnat", "inga knappar i bubblan på 8 s (" + (sr ? sr.textContent.slice(0, 50) : "") + ") klasser: " + n.className + ", knappar " + knappar + ", skrivet " + (skr ? skr.textContent.length : "-") + "/" + (sr ? sr.textContent.length : "-")); }
      if (sr && skr && rest) {
        if (skr.textContent.length > sr.textContent.length) fynd("text", "dubbelskriven: " + skr.textContent.slice(0, 60));
        if (!rest.textContent && skr.textContent !== sr.textContent) fynd("text", "inte hel: " + skr.textContent.slice(0, 60));
      }
      const fig = ruta(n.querySelector(".newton-figur"));
      // Figuren glider i --gang; kontrollera när han står still och pratar.
      if (talar && !n.classList.contains("gar-steg") && !n.classList.contains("gar")) {
        const nyckel = (sr ? sr.textContent : "").slice(0, 40);
        if (ute(fig) && !harUte.has("f" + nyckel)) { harUte.add("f" + nyckel); fynd("ute", "Newton utanför fönstret " + JSON.stringify([fig.left, fig.top, fig.right, fig.bottom].map(Math.round)) + " i " + innerWidth + "×" + innerHeight + ": " + nyckel); }
        const bub = ruta(n.querySelector(".newton-bubbla"));
        if (getComputedStyle(n.querySelector(".newton-bubbla")).visibility === "visible" && ute(bub, 2) && !harUte.has("b" + nyckel)) { harUte.add("b" + nyckel); fynd("ute", "bubblan utanför fönstret " + JSON.stringify([bub.left, bub.top, bub.right, bub.bottom].map(Math.round)) + ": " + nyckel); }
        // Över det som lyser: figurens mittdel (bilden har luft runt sig) mot guldramarna.
        const kärna = { left: fig.left + fig.width * .2, right: fig.right - fig.width * .2, top: fig.top + fig.height * .05, bottom: fig.bottom };
        const lyser = document.getElementById("guide-ljus").classList.contains("syns");
        for (const r of document.querySelectorAll(".guide-ram")) {
          // Breda mål (tidslinjen, hela spelaren, sökträffarna på telefonen) räknas inte: han står framför en kant av dem med flit.
          if (!lyser || r.style.opacity !== "1" || r.getBoundingClientRect().width > innerWidth * .55) continue;
          const a = snitt(kärna, r.getBoundingClientRect()), andel = a / ((kärna.right - kärna.left) * (kärna.bottom - kärna.top));
          if (andel > .25 && !harUte.has("o" + nyckel)) { harUte.add("o" + nyckel); fynd("over", "Newton över det som lyser (" + Math.round(andel * 100) + " %): " + nyckel); }
        }
      }
    }, 100);
  }
  start();
  // Stryps sidans timrar (bakgrundsflik)? Då går allt i sidan i sekundtakt och guiden ser ut att hänga.
  let forra = performance.now(), stryptSedan = 0;
  const tick = () => { const nu = performance.now(); if (nu - forra > 600 && !stryptSedan) { stryptSedan = nu; const dold = document.visibilityState === "hidden"; fynd(dold ? "strypt" : "seg", (dold ? "timrarna stryps (" : "sidan stod still (lång uppgift, ") + Math.round(nu - forra) + " ms), synlig: " + document.visibilityState + ", fokus: " + document.hasFocus()); } else if (nu - forra < 300) stryptSedan = 0; forra = nu; setTimeout(tick, 100); };
  setTimeout(tick, 100);
})();`;

try {
  let mal;
  for (let i = 0; i < 50 && !mal; i++) { await vila(200); try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); mal = l.find((x) => x.type === "page"); } catch (e) {} }
  ws = new WebSocket(mal.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && svar.has(m.id)) { const s = svar.get(m.id); svar.delete(m.id); m.error ? s.fel(new Error(m.error.message)) : s.klar(m.result); } });
  await skicka("Page.enable"); await skicka("Runtime.enable");
  await skicka("Page.addScriptToEvaluateOnNewDocument", { source: VAKT });
  let bredd = +B, hojd = +H;
  const storlek = async (b, h) => {
    bredd = b; hojd = h;
    await skicka("Emulation.setDeviceMetricsOverride", { width: b, height: h, deviceScaleFactor: 1, mobile: b < 700 });
    await skicka("Emulation.setTouchEmulationEnabled", { enabled: b < 700, maxTouchPoints: 5 });
  };
  await storlek(bredd, hojd);
  const telefon = () => bredd < 700;
  const js = async (expression) => {
    const r = await skicka("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) { logg("JS-FEL:", r.exceptionDetails.text, r.exceptionDetails.exception && r.exceptionDetails.exception.description); return undefined; }
    return r.result && r.result.value;
  };
  const mitt = (sel) => js(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length && getComputedStyle(x).visibility !== "hidden"); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2)]; })()`);
  const klick = async (x, y, antal = 1) => { for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await skicka("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: antal }); };
  const tryck = async (x, y, ms = 50) => { await skicka("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); await vila(ms); await skicka("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
  const pek = (x, y) => (telefon() ? tryck(x, y) : klick(x, y));
  const pa = (f) => async (sel) => { const p = await mitt(sel); if (!p) { logg(`hittar inte ${sel}`); return false; } await f(p[0], p[1]); return p; };
  const dra = async (x0, y0, x1, y1, steg = 8) => {
    if (telefon()) {
      await skicka("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
      for (let i = 1; i <= steg; i++) { await vila(16); await skicka("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / steg, y: y0 + (y1 - y0) * i / steg }] }); }
      await skicka("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await skicka("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y: y0 });
      await skicka("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: y0, button: "left", clickCount: 1 });
      for (let i = 1; i <= steg; i++) { await vila(16); await skicka("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + (x1 - x0) * i / steg, y: y0 + (y1 - y0) * i / steg, button: "left", buttons: 1 }); }
      await skicka("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y: y1, button: "left", clickCount: 1 });
    }
  };
  const TANGENTER = { ArrowRight: 39, ArrowLeft: 37, Escape: 27, Enter: 13, "?": 191, "/": 55, " ": 32 };
  const tangent = async (key, { upprepa = false } = {}) => {
    const kod = TANGENTER[key] || key.toUpperCase().charCodeAt(0);
    // Tecken och Enter som keyDown med text (då kommer keypress/click som från ett riktigt tangentbord), resten som rawKeyDown.
    const text = key === "Enter" ? "\r" : key.length === 1 ? key : undefined;
    await skicka("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", key, text, code: key.length === 1 ? undefined : key, windowsVirtualKeyCode: kod, autoRepeat: upprepa });
    await skicka("Input.dispatchKeyEvent", { type: "keyUp", key, windowsVirtualKeyCode: kod });
  };
  let bildNr = 0;
  // bild(namn, { klipp: [x, y, b, h], skala }): bara en del av fönstret, förstorad.
  const bild = async (namn, { klipp = null, skala = 1, kvalitet = 80, mapp = ut } = {}) => {
    const r = await skicka("Page.captureScreenshot", { format: "jpeg", quality: kvalitet, ...(klipp ? { clip: { x: klipp[0], y: klipp[1], width: klipp[2], height: klipp[3], scale: skala } } : {}) });
    const fil = join(mapp, `${String(++bildNr).padStart(3, "0")}-${namn}.jpg`); writeFileSync(fil, Buffer.from(r.data, "base64")); return fil;
  };
  // Bildserie runt Newton: en bild var ms under tid ms, sedan ett kontaktark (ffmpeg tile) <namn>.jpg i utmappen.
  // Varje bild får tiden och Newtons klasser i filnamnet (loggas också).
  const serie = async (namn, { ms = 100, tid = 3000, marg = 60, skala = 1.5, kolumner = 8 } = {}) => {
    const mapp = join(ut, namn); mkdirSync(mapp, { recursive: true });
    const r = await js(`(() => { const f = document.querySelector("#newton .newton-figur").getBoundingClientRect(), b = document.querySelector("#newton .newton-bubbla").getBoundingClientRect(); return [f.left, f.top, f.right, f.bottom]; })()`);
    const klipp = [Math.max(0, r[0] - marg), Math.max(0, r[1] - marg), Math.min(bredd, r[2] + marg) - Math.max(0, r[0] - marg), Math.min(hojd, r[3] + 10) - Math.max(0, r[1] - marg)];
    const start = Date.now(), rader = []; let i = 0;
    while (Date.now() - start < tid) {
      const t0 = Date.now();
      const kl = await js(`document.getElementById("newton").className.replace("newton guide ", "") + (document.getElementById("newton-uttryck").classList.contains("syns") ? " uttryck" : "")`);
      const r2 = await skicka("Page.captureScreenshot", { format: "jpeg", quality: 85, clip: { x: klipp[0], y: klipp[1], width: klipp[2], height: klipp[3], scale: skala } });
      writeFileSync(join(mapp, `${String(i++).padStart(3, "0")}.jpg`), Buffer.from(r2.data, "base64"));
      rader.push(`${String(i - 1).padStart(3)} +${String(t0 - start).padStart(5)} ms  ${kl}`);
      const vanta = ms - (Date.now() - t0); if (vanta > 0) await vila(vanta);
    }
    const { execFileSync } = await import("node:child_process");
    const rad = Math.ceil(i / kolumner);
    try { execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(mapp, "%03d.jpg"), "-vf", `tile=${kolumner}x${rad}:padding=2`, "-frames:v", "1", join(ut, `${namn}.jpg`)]); } catch (e) { logg("ffmpeg:", e.message.slice(0, 200)); }
    writeFileSync(join(ut, `${namn}.txt`), rader.join("\n"));
    logg(`serie ${namn}: ${i} bilder, ${join(ut, namn + ".jpg")}`);
    return rader;
  };
  const ladda = async (u) => { await skicka("Page.navigate", { url: u }); await vila(2500); };
  const omladda = async () => { await skicka("Page.reload", { ignoreCache: false }); await vila(2500); };
  const tillstand = () => js(`(() => { const n = document.getElementById("newton"), sr = n.querySelector("#newton-text .sr"), rest = n.querySelector("#newton-text .rest");
    return { guidar: document.body.classList.contains("guidar"), syns: !n.hidden, talar: n.classList.contains("talar"), klar: !!rest && !rest.textContent,
      text: sr ? sr.textContent : "", knappar: [...n.querySelectorAll("#newton-knappar button")].map((b) => b.textContent), raknare: (n.querySelector(".raknare") || {}).textContent || "",
      hash: location.hash, vy: (document.querySelector(".vy.aktiv") || {}).id, fel: __fel.slice() }; })()`);
  // Frågetecknet. Under last (flera Chrome samtidigt) kan sidan vara långsam: vänta tills guiden syns, och
  // tryck en gång till om den inte startat efter 4 s.
  const starta = async () => {
    for (let forsok = 0; forsok < 2; forsok++) {
      await pa(pek)("#hjalp");
      for (let k = 0; k < 40; k++) { if (await js(`document.body.classList.contains("guidar")`)) return true; await vila(100); }
      logg("  guiden startade inte, trycker igen");
    }
    return false;
  };
  // Trycker sig igenom guiden: väntar på knappar, loggar, trycker Nästa/Klar/Visa resten (val "nasta"),
  // Hoppa över (val "hoppa") eller blandat (val "blandat": Hoppa över i varannan uppgift, annars gör
  // manuset uppgiften via uppgift(t)). Kontrollerar att räknaren går ett steg i taget.
  const guide = async ({ max = 45, paus = 2200, val = "blandat", uppgift = null, efterSteg = null } = {}) => {
    const steg = []; let forra = null;
    for (let i = 0; i < max; i++) {
      let t, vantat = 0;
      for (;;) { t = await tillstand(); if (!t.guidar || (t.talar && t.knappar.length)) break; if ((vantat += 100) > 12000) break; await vila(100); }
      if (!t.guidar) { logg("  guiden slut"); break; }
      if (!t.knappar.length) { logg("  FASTNAT: inga knappar på 12 s:", t.text.slice(0, 70)); steg.push({ ...t, fastnat: true }); break; }
      const [n, N] = t.raknare.split("/").map(Number);
      const hopp = forra && forra.N === N && n !== forra.n + 1 && !(n === 1) ? ` RÄKNAREN HOPPADE ${forra.n}/${forra.N} → ${n}/${N}` : "";
      logg(`  ${t.raknare.padEnd(5)} ${t.hash.slice(0, 32).padEnd(32)} ${t.knappar.join("|").padEnd(24)} ${t.text.slice(0, 80)}${hopp}`);
      steg.push({ ...t, hopp: !!hopp }); forra = { n, N };
      if (efterSteg) await efterSteg(t, i);
      await vila(450);   // bubblan tonar in (skalas) de första 400 ms: tryck som en människa, när knappen står still
      const har = (k) => t.knappar.includes(k);
      let knapp = har("Nästa") ? "Nästa" : har("Klar") ? "Klar" : har("Visa resten") ? "Visa resten" : "Hoppa över";
      if (knapp === "Hoppa över" && val === "blandat" && uppgift && i % 2 === 0) { const gjord = await uppgift(t, s); if (gjord) { await vila(paus); continue; } }
      await pa(pek)(`#newton-knappar button:nth-child(${t.knappar.indexOf(knapp) + 1})`);
      if (knapp === "Klar") { await vila(1200); const e = await tillstand(); if (e.guidar) logg("  guiden kvar efter Klar"); break; }
      await vila(paus);
    }
    return steg;
  };
  // Väntar tills bubblan har knappar (eller guiden är slut); med text: tills texten passar.
  const vantaPaKnapp = async (text = null, ms = 15000) => {
    const slut = Date.now() + ms; let t;
    for (;;) { t = await tillstand(); if (!t.guidar || (t.talar && t.knappar.length && (!text || text.test(t.text)))) return t; if (Date.now() > slut) { logg("  väntade förgäves på", text || "knappar", "–", t.text.slice(0, 60), await js(`document.getElementById("newton").className + " / knappar " + document.querySelectorAll("#newton-knappar button").length + " / " + location.hash`)); return t; } await vila(100); }
  };
  const vakt = async (namn) => {
    const v = await js(`(() => { const r = { fel: __fel.splice(0), fynd: __vakt.fynd.splice(0), efterSlut: __vakt.efterSlut.splice(0) }; return r; })()`);
    const antal = v ? v.fel.length + v.fynd.length + v.efterSlut.length : -1;
    logg(`VAKT ${namn}: ${antal ? "" : "inga fynd"}`);
    if (v) { for (const f of v.fel) logg("   fel:", f); for (const f of v.fynd) logg(`   ${f.typ}: ${f.text}`); for (const f of v.efterSlut) logg(`   efter slut +${f.t} ms: ${f.mal} ${f.typ} ${f.attr || ""} ${f.varde}`); }
    return v;
  };
  const s = { js, vanta: vila, vantaPaKnapp, serie, klick, tryck, pek, klickPa: pa(klick), tryckPa: pa(tryck), pekPa: pa(pek), mitt, dra, tangent, bild, storlek, ladda, omladda, starta, guide, vakt, tillstand, logg, skicka, url, get telefon() { return telefon(); }, get bredd() { return bredd; }, get hojd() { return hojd; } };
  await ladda(url);
  const manus = (await import(pathToFileURL(resolve(manusFil)).href)).default;
  await manus(s);
} catch (e) { logg("FEL I MANUSET:", e.stack || e); process.exitCode = 1; }
finally { try { ws && ws.close(); } catch (e) {} chrome.kill(); await vila(300); try { rmSync(profil, { recursive: true, force: true }); } catch (e) {} }
