// Service workern för spelens webbapp (Installera-knappen under fliken Spel, Rickard 15/11 «Webben, med Installera-knapp»).
//
// Sidorna: varje sida hämtas från nätet som i en vanlig flik. Bara när nätet saknas svarar den med en kort sida om det.
//
// Spelens filer (Rickard 15/11 «Spara filerna i appen»): i den installerade appen sparas spelens bilder, ljud och skript
// på elevens dator, så att andra starten och bytet till en bana slipper fråga nätet om varje fil. En vanlig flik i
// webbläsaren beter sig som utan service worker: den går aldrig genom det sparade.
//  - Fillistan /spel-app.json (verktyg/spel.mjs skriver den vid varje utläggning) har varje spelfils sha256. Den hämtas
//    på nytt varje gång appen startar eller öppnar en spelsida, och sidan får bara filer ur den listan. En ny utläggning
//    syns alltså vid nästa start, som i webbläsaren, och ingen elev fastnar på en gammal version.
//  - Varje fil sparas under sin egen sha256, och bara när innehållet stämmer med listan. En fil från en annan version
//    eller en halv nedladdning kan därför aldrig lämnas ut i stället för rätt fil.
//  - Vid en ny version hämtas de ändrade filer som eleven redan hade, och först när det är klart tas de gamla bort.
//    Ett appfönster som fortfarande kör den gamla versionen behåller sina filer tills det stängts.
//  - Räcker inte utrymmet (navigator.storage.estimate) sparas inget, och spelet går som i en vanlig flik.
//  - Inloggningen (/inlogg/), spelservern (/spel/rum, /spel/halsa och de andra utan filändelse), filmerna (mp4, Range)
//    och allt utanför /spel/ går förbi.
//
// Vilka fönster som är appen: appen startar på /?app=1#spel (manifest.webmanifest), och videotekets sida håller kvar
// ?app=1 i sin adress när den visas som app. En spelsida som öppnas därifrån (eller från en annan av appens spelsidor)
// är appens. Spelsidornas egna adresser rörs inte, eftersom spelen läser sina parametrar (spel-matdata.js räknar en
// okänd parameter som ett prov).
//
// Ta bort den: lägg ut verktyg/sw-bort.js som public/sw.js. Den tar bort det sparade och avregistrerar sig. En sw.js
// som saknas (404) tar inte bort en installerad service worker, den förra står då kvar.
"use strict";

const FILER = "spel-filer-1";          // spelens filer, en post per sha256: /__sw/sha/<sha256>
const LAGE = "spel-lage-1";            // fillistorna, appens fönster och vilken version som är komplett
const VARA = new Set([FILER, LAGE]);
const LISTAN = "/spel-app.json";
const RESERV = 128 * 1024 * 1024;      // så mycket ska alltid stå ledigt efter en sparad fil
const VANTA_FORE_UPPDATERING = 10000;  // spelets egen laddning går först, sedan hämtas de ändrade filerna

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => e.waitUntil((async () => {
  // Inget sparat från någon tidigare version av workern får stå kvar.
  for (const namn of await caches.keys()) if (!VARA.has(namn)) await caches.delete(namn);
  // Sidan hämtas medan workern startar, så att den inte gör sidan långsammare.
  if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
  await self.clients.claim();
})()));

// ── Läget ──

const nyckel = (namn) => new Request(`${self.location.origin}/__sw/${namn}`);
const sistaDelen = (adress) => adress.slice(adress.lastIndexOf("/") + 1);
async function lasLage(namn) {
  try { const r = await (await caches.open(LAGE)).match(nyckel(namn)); return r ? await r.json() : null; } catch (fel) { return null; }
}
async function skrivLage(namn, varde) {
  try { await (await caches.open(LAGE)).put(nyckel(namn), new Response(JSON.stringify(varde), { headers: { "Content-Type": "application/json" } })); } catch (fel) { /* fullt: det gör inget */ }
}
async function taBortLage(namn) {
  try { await (await caches.open(LAGE)).delete(nyckel(namn)); } catch (fel) { }
}

// Appens fönster: klientens id → { version, lista: Promise<fillistan eller null> }. Står också i LAGE (klient/<id>
// med versionen), eftersom workern stängs när den varit ledig en stund och då glömmer det som bara stod i minnet.
const klienter = new Map();
const listor = new Map();              // version → fillistan
let lage = { senaste: null, komplett: null };
let laddad = false;
const laddning = (async () => {
  try {
    lage = (await lasLage("lage")) || lage;
    const levande = new Set((await self.clients.matchAll({ includeUncontrolled: true, type: "window" })).map((k) => k.id));
    const lager = await caches.open(LAGE);
    for (const r of await lager.keys()) {
      const m = /\/__sw\/klient\/(.+)$/.exec(r.url);
      if (!m) continue;
      const id = decodeURIComponent(m[1]);
      if (!levande.has(id)) { await lager.delete(r); continue; }
      const k = await lager.match(r).then((s) => s.json()).catch(() => null);
      if (k && !klienter.has(id)) klienter.set(id, { version: k.version, lista: k.version ? lasLista(k.version) : Promise.resolve(null) });
    }
  } catch (fel) { /* inget sparat läge: alla fönster räknas som vanliga flikar */ }
  laddad = true;
})();

async function lasLista(version) {
  if (listor.has(version)) return listor.get(version);
  const lista = await lasLage(`lista/${version}`);
  if (lista && lista.version === version && lista.filer) { listor.set(version, lista); return lista; }
  return null;
}

// Fillistan från nätet, en gång även när flera fönster startar samtidigt. Utan nät: den senast hämtade.
let hamtning = null;
function hamtaLista() {
  if (hamtning) return hamtning;
  hamtning = (async () => {
    await laddning;
    try {
      const svar = await fetch(LISTAN, { cache: "no-cache", credentials: "same-origin" });
      if (!svar.ok) throw new Error(`${svar.status}`);
      const lista = await svar.json();
      if (!lista || typeof lista.version !== "string" || !/^[0-9a-f]{8,64}$/.test(lista.version) || !lista.filer || typeof lista.filer !== "object") throw new Error("konstig lista");
      if (!listor.has(lista.version)) {
        listor.set(lista.version, lista);
        await skrivLage(`lista/${lista.version}`, lista);
      }
      if (lage.senaste !== lista.version) { lage.senaste = lista.version; await skrivLage("lage", lage); }
      return listor.get(lista.version);
    } catch (fel) {
      return lage.senaste ? lasLista(lage.senaste) : null;
    }
  })();
  // Nästa start hämtar listan igen. Fönster som öppnas inom några sekunder delar samma.
  hamtning.finally(() => setTimeout(() => { hamtning = null; }, 3000));
  return hamtning;
}

const medTid = (lofte, ms) => Promise.race([lofte, new Promise((klar) => setTimeout(() => klar(null), ms))]);

// ── Appens fönster ──

const harApp = (adress) => { try { return new URL(adress).searchParams.get("app") === "1"; } catch (fel) { return false; } };
const utanFragment = (adress) => String(adress).split("#")[0];

// Kommer navigeringen från en spelsida avgörs det av vilket fönster spelsidan står i: appens bara om alla öppna
// fönster med den adressen är appens (står samma spel i en flik bredvid räknas det som en flik, som i dag).
async function franApp(e) {
  await laddning;
  const fran = utanFragment(e.request.referrer);
  const samma = (await self.clients.matchAll({ type: "window" })).filter((k) => utanFragment(k.url) === fran);
  return samma.length > 0 && samma.every((k) => klienter.has(k.id) && klienter.get(k.id).lista);
}

function markera(e, url) {
  const id = e.resultingClientId;
  if (!id) return;
  // Videotekets sida i appen har ?app=1, och då är spelsidan den öppnar också appens.
  const sakert = harApp(url.href) || harApp(e.request.referrer);
  let kanske = false;
  try { kanske = !sakert && (!laddad || klienter.size > 0) && new URL(e.request.referrer).pathname.startsWith("/spel/"); } catch (fel) { }
  if (!sakert && !kanske) return;
  // Posten sätts direkt, innan sidans filer börjar komma, och tas bort igen om fönstret visar sig vara en flik.
  const post = { version: null, lista: null };
  post.lista = (async () => {
    if (!sakert && !(await franApp(e))) { klienter.delete(id); return null; }
    const lista = await hamtaLista();
    post.version = lista ? lista.version : null;
    await skrivLage(`klient/${encodeURIComponent(id)}`, { version: post.version });
    if (lista) e.waitUntil(uppdatera(lista));
    return lista;
  })();
  klienter.set(id, post);
  e.waitUntil(post.lista);
}

// ── Sparandet ──

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
let uppskattning = null, uppskattad = 0, tillagt = 0, sparStopp = 0;
const pagar = new Set();

// Ryms filen? Uppskattningen frågas om var 30:e sekund, och det workern sparat sedan dess räknas in.
async function ryms(storlek) {
  if (Date.now() < sparStopp) return false;
  if (!self.navigator.storage || !self.navigator.storage.estimate) return false;
  if (!uppskattning || Date.now() - uppskattad > 30000 || tillagt > 32 * 1024 * 1024) {
    try { uppskattning = await self.navigator.storage.estimate(); } catch (fel) { return false; }
    uppskattad = Date.now(); tillagt = 0;
  }
  const { usage = 0, quota = 0 } = uppskattning;
  return quota - usage - tillagt - storlek > RESERV;
}

const SPARADE_HUVUDEN = ["content-type", "last-modified", "etag", "x-content-type-options", "cross-origin-resource-policy"];
// Sparar svaret om innehållet är filen i listan. Svarar false när inget mer får sparas (fullt), annars true.
async function spara(svar, sha, storlek) {
  if (pagar.has(sha)) return true;
  pagar.add(sha);
  try {
    if (!(await ryms(storlek))) return false;
    const data = await svar.arrayBuffer();
    if (data.byteLength !== storlek || hex(await crypto.subtle.digest("SHA-256", data)) !== sha) return true;
    const huvud = new Headers();
    for (const k of SPARADE_HUVUDEN) { const v = svar.headers.get(k); if (v) huvud.set(k, v); }
    await (await caches.open(FILER)).put(nyckel(`sha/${sha}`), new Response(data, { status: 200, headers: huvud }));
    tillagt += storlek;
    return true;
  } catch (fel) {
    // Fullt (QuotaExceededError) eller något annat: inget mer sparas på en stund, och spelet går som i en flik.
    sparStopp = Date.now() + 10 * 60 * 1000;
    return false;
  } finally {
    pagar.delete(sha);
  }
}

// Det sparade lämnas ut som ett nytt svar, så att adressen blir sidans egen (moduler läser sina import mot den).
const utlamna = (sparat) => new Response(sparat.body, { status: 200, statusText: "OK", headers: sparat.headers });

async function spelfil(e, url) {
  if (!laddad) await laddning;
  const post = klienter.get(e.clientId);
  const lista = post && post.lista ? await medTid(post.lista, 4000) : null;
  let vag = null;
  try { vag = decodeURIComponent(url.pathname.slice("/spel/".length)); } catch (fel) { }
  const rad = lista && vag && Object.prototype.hasOwnProperty.call(lista.filer, vag) ? lista.filer[vag] : null;
  if (!Array.isArray(rad)) return fetch(e.request);
  const [sha, storlek] = rad;
  try {
    const sparat = await (await caches.open(FILER)).match(nyckel(`sha/${sha}`));
    if (sparat) return utlamna(sparat);
  } catch (fel) { /* läses som från nätet */ }
  const svar = await fetch(e.request);
  if (svar.status === 200 && svar.type === "basic" && !svar.headers.has("content-range")) e.waitUntil(spara(svar.clone(), sha, storlek));
  return svar;
}

// ── En ny version: hämta det ändrade som eleven redan hade, ta sedan bort det gamla ──

let uppdaterar = null;
function uppdatera(ny) {
  if (uppdaterar) return uppdaterar;
  uppdaterar = (async () => {
    if (lage.komplett === ny.version) return;
    const gammal = lage.komplett ? await lasLista(lage.komplett) : null;
    if (gammal) {
      await new Promise((klar) => setTimeout(klar, VANTA_FORE_UPPDATERING));
      const lager = await caches.open(FILER);
      const har = new Set((await lager.keys()).map((r) => sistaDelen(r.url)));
      for (const [vag, [sha, storlek]] of Object.entries(ny.filer)) {
        const g = gammal.filer[vag];
        if (!g || g[0] === sha || !har.has(g[0]) || har.has(sha)) continue;
        if (lage.senaste !== ny.version) return;          // en ännu nyare version: den tar vid nästa gång
        try {
          const svar = await fetch(`/spel/${vag}`, { credentials: "same-origin", priority: "low" });
          if (svar.status !== 200) continue;
          if (!(await spara(svar, sha, storlek))) break;   // fullt: resten hämtas när spelet ber om dem
        } catch (fel) { return; }                         // utan nät: försök igen vid nästa start
      }
    }
    lage.komplett = ny.version;
    await skrivLage("lage", lage);
    await stada(ny);
  })().catch(() => { }).finally(() => { uppdaterar = null; });
  return uppdaterar;
}

// Tar bort filer och listor som varken den nya versionen eller ett öppet appfönster använder.
async function stada(ny) {
  const levande = new Set((await self.clients.matchAll({ includeUncontrolled: true, type: "window" })).map((k) => k.id));
  const versioner = new Set([ny.version, lage.senaste]);
  for (const [id, post] of klienter) {
    if (!levande.has(id)) { klienter.delete(id); await taBortLage(`klient/${encodeURIComponent(id)}`); }
    else if (post.version) versioner.add(post.version);
  }
  const behall = new Set();
  for (const v of versioner) { const l = v && (await lasLista(v)); if (l) for (const [sha] of Object.values(l.filer)) behall.add(sha); }
  const filer = await caches.open(FILER);
  for (const r of await filer.keys()) if (!behall.has(sistaDelen(r.url))) await filer.delete(r);
  const lager = await caches.open(LAGE);
  for (const r of await lager.keys()) {
    const m = /\/__sw\/lista\/(.+)$/.exec(r.url);
    if (m && !versioner.has(m[1])) { listor.delete(m[1]); await lager.delete(r); }
  }
}

// ── Sidan utan nät ──

const esc = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const utanNat = (adress) => new Response(`<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inget nät</title>
<style>html{background:#171414;color:#ECE6D8;font:17px/1.6 system-ui,sans-serif}body{min-height:100vh;margin:0;display:grid;place-items:center;text-align:center;padding:0 24px;box-sizing:border-box}h1{font-weight:400;font-size:24px;margin:0 0 8px}p{margin:0 0 22px;color:#B5AE9F}a{display:inline-block;padding:10px 22px;border-radius:999px;border:1px solid rgba(242,197,114,.6);color:#F2C572;text-decoration:none;letter-spacing:.12em;text-transform:uppercase;font-size:13px}</style>
</head><body><main><h1>Du är utan nät</h1><p>Spelen och filmerna behöver nätet. Försök igen när du är uppkopplad.</p><a href="${esc(adress)}">Försök igen</a></main></body></html>`, {
  status: 503,
  headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "Cache-Control": "no-store",
  },
});

async function sida(e) {
  try {
    const forhand = await e.preloadResponse;
    if (forhand) return forhand;
  } catch (fel) { /* förhämtningen föll, försök en gång till nedan */ }
  try {
    return await fetch(e.request);
  } catch (fel) {
    return utanNat(e.request.url);
  }
}

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;
  if (r.mode === "navigate") {
    // Inloggningen (/inlogg/) beror på elevens kaka och Googles fönster, och går alltid förbi workern.
    if (url.pathname.startsWith("/inlogg/")) return;
    e.respondWith(sida(e));
    if (url.pathname.startsWith("/spel/")) markera(e, url);
    // Appen startar: listan hämtas direkt, så att en ny version hinner hämtas medan eleven väljer spel.
    else if (url.pathname === "/" && harApp(url.href)) e.waitUntil(hamtaLista().then((l) => l && uppdatera(l)));
    return;
  }
  // Spelens filer, och bara de: under /spel/, med filändelse, utan frågedel och utan Range. Filmer, ljud i <audio>,
  // arbetstrådar och spelserverns vägar går förbi.
  if (!url.pathname.startsWith("/spel/") || url.search || r.headers.has("range")) return;
  if (!/\.[a-z0-9]{1,6}$/i.test(url.pathname) || /\.mp4$/i.test(url.pathname)) return;
  if (["video", "audio", "track", "worker", "sharedworker", "document", "iframe"].includes(r.destination)) return;
  // En vanlig flik: som utan service worker. Bara medan workern läser in sitt läge går allt genom den.
  if (laddad && !klienter.has(e.clientId)) return;
  e.respondWith(spelfil(e, url));
});
