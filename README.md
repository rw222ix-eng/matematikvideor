# Videoteket

Statisk webbsida där eleverna hittar alla matematikvideor och kan söka i det som sägs, med hopp
direkt till sekunden i filmen. Ingen server, ingen inloggning. Publiceras på Vercel.

- `register.json` — en post per video: titel, `ar` (året berättelsen utspelar sig; tidslinjen
  sorteras kronologiskt efter det), kurs, moment, begrepp, beskrivning, sökväg till projektet, `youtube` (video-id, tomt tills filmen är uppladdad), `omslag`. Valfritt `fil`
  (direktlänk till mp4 i full kvalitet — spelas då i stället för YouTube) och `textning` (vtt).
- `node bygg.mjs` — bygger `public/videor.json` ur projektens `assets/tal-tider.json` (replikerna
  med uppmätta tider) och kopierar omslagen till `public/omslag/` (720 px jpeg; finns
  `omslag-utan-titel.png` bredvid omslaget blir den `<id>-ren.jpg` och används på sidan, eftersom
  titeln står i text). Introbilden `public/omslag/intro.jpg` görs av Kepler-omslaget utan titel.
- `public/` — det som publiceras: `index.html` + data. Formen följer `DESIGNBRIEF.md` (efter
  stgeorgescrypt.org.uk/then-and-now): intro i helskärm → vågrät tidslinje "Välj en film" (hjulet
  rullar i sidled; lodrät lista under 700 px) → filmens sida med spelare och kapitel. Sök via
  förstoringsglaset (eller tangenten `/`). Adresser: `#filmer`, `#<id>`, `#<id>&t=<sekund>`.
  Typsnitt från Google Fonts (Jost + Pinyon Script); en accentfärg (`--accent`).
- Filmen spelas från egen fil (`fil` i registret): en 1080p-mp4 som ligger som GitHub-release i
  det här repot (`gh release create <tag>` + `gh release upload <tag> <mp4>`, adress
  `https://github.com/rw222ix-eng/matematikvideor/releases/download/<tag>/<fil>`; stöder
  delvisa hämtningar så hopp i filmen fungerar). Kodning ur 4K-exporten:
  `ffmpeg -i <2160p.mp4> -vf scale=1920:1080 -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 192k -movflags +faststart <1080p.mp4>`
  (Kepler: 137 MB). Utan `fil` används YouTube (`youtube`-id) i stället.
- Spelaren är sidans egen: `<video>` med egna kontroller; med YouTube körs inbäddningen med `controls=0` och styrs via IFrame API
  (spela/pausa, tidslinje, ljud, helskärm, tangenterna mellanslag/k, ←/→ 5 s, j/l 10 s, f, c, m).
  Undertexterna ritas av sidan ur projektets `assets/tal.srt` (fältet `undertext` i videor.json,
  Charter som i filmen); YouTubes egna textremsor stängs av. Valet textning på/av sparas i webbläsaren.

Publicera: **https://winterhalls-matte.vercel.app** (Vercel-projektet `winterhalls-matte`, kopplat till
repot, bygger `public/` vid varje push till main — det är länken eleverna har, delad i Classroom
2026-09-06 i Ma 1c/2c NA26F och TE26A). Reserv: **https://rw222ix-eng.github.io/matematikvideor/** — GitHub Pages ur repot
`rw222ix-eng/matematikvideor`. Arbetsflödet `.github/workflows/pages.yml` publicerar `public/` vid
varje push till `main`, klart på ~1 min. Alltså: ändra register.json → `node bygg.mjs` → commit →
`git push`. (Vercel-kopplingen saknade rättighet att skapa projekt 2026-09-04; vill man ha Vercel:
importera repot i Vercels instrumentpanel.)

Ny video: lägg en post i `register.json` (youtube-id från den olistade uppladdningen), kör
`node bygg.mjs`, commit, push.

Kvalitet: exportera i högsta bitrate ur Diffusion Studio; ladda upp till YouTube som 2160p
(uppskalad 1080-master) så hamnar filmen i YouTubes högsta kvalitetsskikt. Vill man ha originalfilen
utan omkodning: lägg mp4:n hos Cloudflare R2 (fri utgående trafik) och sätt `fil` i registret.
