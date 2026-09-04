# Videoteket

Statisk webbsida där eleverna hittar alla matematikvideor och kan söka i det som sägs, med hopp
direkt till sekunden i filmen. Ingen server, ingen inloggning. Publiceras på Vercel.

- `register.json` — en post per video: titel, kurs, moment, begrepp, beskrivning, sökväg till
  projektet, `youtube` (video-id, tomt tills filmen är uppladdad), `omslag`. Valfritt `fil`
  (direktlänk till mp4 i full kvalitet — spelas då i stället för YouTube) och `textning` (vtt).
- `node bygg.mjs` — bygger `public/videor.json` ur projektens `assets/tal-tider.json` (replikerna
  med uppmätta tider) och kopierar omslagen till `public/omslag/`.
- `public/` — det som publiceras: `index.html` + data.

Publicera: **https://rw222ix-eng.github.io/matematikvideor/** — GitHub Pages ur repot
`rw222ix-eng/matematikvideor`. Arbetsflödet `.github/workflows/pages.yml` publicerar `public/` vid
varje push till `main`, klart på ~1 min. Alltså: ändra register.json → `node bygg.mjs` → commit →
`git push`. (Vercel-kopplingen saknade rättighet att skapa projekt 2026-09-04; vill man ha Vercel:
importera repot i Vercels instrumentpanel.)

Ny video: lägg en post i `register.json` (youtube-id från den olistade uppladdningen), kör
`node bygg.mjs`, commit, push.

Kvalitet: exportera i högsta bitrate ur Diffusion Studio; ladda upp till YouTube som 2160p
(uppskalad 1080-master) så hamnar filmen i YouTubes högsta kvalitetsskikt. Vill man ha originalfilen
utan omkodning: lägg mp4:n hos Cloudflare R2 (fri utgående trafik) och sätt `fil` i registret.
