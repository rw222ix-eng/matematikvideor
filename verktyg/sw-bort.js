// Tar bort spelens service worker hos alla elever. Lägg ut den här filen som public/sw.js (kopiera den dit och publicera),
// och ta samtidigt bort navigator.serviceWorker.register i public/index.html (blocket «Installera spelen»), annars
// registreras den här igen vid varje besök. Det gör ingen skada, men kostar en hämtning.
// Webbläsaren frågar efter sw.js varje gång en sida under videoteket öppnas (Cache-Control: no-cache, updateViaCache
// "none"), installerar den här, och den tar då bort allt som service workern sparat och avregistrerar sig. Den har ingen
// fetch-hanterare, så också fönster som redan är öppna hämtar allt från nätet direkt. Den laddar inte om dem, eftersom
// en sida som registrerar sw.js igen då skulle laddas om utan slut. Appen står kvar som ikon, men allt hämtas
// som i en vanlig flik. Ta inte bort sw.js i stället: en sw.js som saknas (404) tar inte bort en installerad worker.
"use strict";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const namn of await caches.keys()) await caches.delete(namn);
  await self.registration.unregister();
})()));
