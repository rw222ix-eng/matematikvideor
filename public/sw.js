// Service workern för spelens webbapp (Installera-knappen under fliken Spel, Rickard 15/11 «Webben, med Installera-knapp»).
// Den finns för att Chrome och Edge ska kunna installera videoteket som en app, och håller aldrig kvar en gammal version:
// den sparar ingenting. Varje sida hämtas från nätet som i en vanlig flik, och allt annat (skript, bilder, spelens filer,
// filmer, spelservern) går förbi den helt. En ny utläggning syns alltså direkt, i appen som i webbläsaren.
// Bara när nätet saknas svarar den med en kort sida om det, i stället för webbläsarens felsida.
//
// Ta bort den: lägg ut en sw.js som bara avregistrerar sig (self.registration.unregister() i activate). En sw.js som
// saknas (404) tar inte bort en installerad service worker, den förra står då kvar.
"use strict";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => e.waitUntil((async () => {
  // Inget sparat från någon tidigare version får stå kvar.
  for (const namn of await caches.keys()) await caches.delete(namn);
  // Sidan hämtas medan workern startar, så att den inte gör sidan långsammare.
  if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
  await self.clients.claim();
})()));

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

self.addEventListener("fetch", (e) => {
  // Bara sidorna. Allt annat hanterar webbläsaren själv, som utan service worker.
  if (e.request.mode !== "navigate") return;
  // Inloggningen (/inlogg/) beror på elevens kaka och Googles fönster, och går alltid förbi workern.
  if (new URL(e.request.url).pathname.startsWith("/inlogg/")) return;
  e.respondWith((async () => {
    try {
      const forhand = await e.preloadResponse;
      if (forhand) return forhand;
    } catch (fel) { /* förhämtningen föll, försök en gång till nedan */ }
    try {
      return await fetch(e.request);
    } catch (fel) {
      return utanNat(e.request.url);
    }
  })());
});
