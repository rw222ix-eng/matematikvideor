# Videoteket

Statisk webbsida där eleverna hittar alla matematikvideor och kan söka i det som sägs, med hopp
direkt till sekunden i filmen. Ingen server, ingen inloggning. Publiceras på Vercel.

- `register.json` — en post per video: titel, `ar` (året berättelsen utspelar sig; tidslinjen
  sorteras kronologiskt efter det), kurs, moment, begrepp, beskrivning, sökväg till projektet, `youtube` (video-id, tomt tills filmen är uppladdad), `omslag`. Valfritt `fil`
  (direktlänk till mp4 i full kvalitet — spelas då i stället för YouTube). Lägg också in
  `youtube` när det finns: spärrar skolans nät GitHub byter spelaren till YouTube själv.
  Filmer som hör till en serie och inte är historiska berättelser får `"serie": "formelbladet"`
  (och gärna `"del": N`). De står inte på tidslinjen utan under fliken Formelbladet på filmvalet
  (`#formelbladet`), i delordning; filmsidan visar "Del N av 5", siffrorna 1–5 och nästa del.
  Glöms fältet känns serien igen på id:t (`formelbladet-N-…`), och delen på siffran i id:t.
  Formelbladsdelarnas kort visar den del av formelbladet som filmen går igenom (utklipp tejpade på
  papper, som i videorna): `node verktyg/formelblad-kort.mjs` skriver `assets/kort/<id>.png`, och
  bygg.mjs använder den före omslaget till kortet, sökträffarna, Nästa del och affischen.
- `kapitel.json` — kapitlen per film, `[fras, rubrik]`, skrivna för hand. Frasen är de första orden
  där kapitlet börjar (minst fem, så att den bara finns på ett ställe); `node bygg.mjs` slår upp
  sekunden i rösten, så kapitlen flyttar med när rösten görs om.
- `dintur.json` — uppgiften "Din tur" som varje film slutar med. Per film: `fraga`, `delar`
  (en eller flera frågor med `typ` `tal`, `ekvation`, `uttryck`, `olikhet`, `intervall`, `ord`,
  `faktorer` eller `losningar`,
  `svar`, `fel` med vanliga fel och förklaringen till dem, `tangenter` för telefonens knappar;
  `ord` jämför ett ord, t.ex. ett prefix, med en lista av godkända stavningar, och en ensam bokstav
  jämförs exakt så att M och m är olika; `faktorer` vill ha ett tal som produkt av primtal,
  t.ex. 899 = 31 · 29, där `svar` är talet; `losningar` vill ha alla lösningar i valfri ordning,
  t.ex. "5 och 7" eller "x₁ = 7, x₂ = 5", där `svar` är en lista),
  `ledtrad` (`fras` = var i filmen metoden visas, slås upp som kapitlen) och `losning` (stegen). Sidan rättar i webbläsaren: uttryck
  jämförs genom att räknas ut i några punkter, så 5ab(3b + 2a) räknas som rätt. `utanfor` kräver
  att så mycket som möjligt är utbrutet, `prova` visar elevens formel för n = 1, 2, 3 …
  Notisen om Din tur (när eleven pausar) visas från slutet av kapitlet där ledtråden ligger;
  `notisFran` (fras eller sekund) sätter gränsen för hand. Bygget skriver ut gränsen för varje film
  och varnar om den faller tillbaka på Din tur-kapitlet eller 70 %.
- `node bygg.mjs` — bygger `public/videor.json` ur projektens `assets/tal-tider.json` (replikerna
  med uppmätta tider) och kopierar omslagen till `public/omslag/` (720 px jpeg; finns
  `omslag-utan-titel.png` bredvid omslaget blir den `<id>-ren.jpg` och används på sidan, eftersom
  titeln står i text). Introbilden `public/omslag/intro.jpg` görs av Kepler-omslaget utan titel.
  Varje bild får `?v=<innehållshash>` i `videor.json` och i `index.html` (Vercel cachar
  `/omslag/*` ett dygn — utan version syntes inte ett nytt omslag). Bygget kör också
  `verktyg/hitta-intro.py` och `verktyg/hitta-valj.py`, som mäter upp maskerna `public/omslag/intro-glimt.png`
  och `valj-glimt.png`: stjärnor, stadens ljus och floden. Båda målningarna ritas i WebGL2 och shadern
  ändrar deras egna pixlar: stjärnor och ljus glimrar, vattnet rör sig, introts låga fladdrar. Utan
  WebGL2 visas bilderna stilla. Skripten behöver numpy, scipy och Pillow; sätt `VIDEOTEK_PYTHON`
  eller lägg en venv i `verktyg/.venv`. Utan python behålls de gamla maskerna. Sist skriver
  `verktyg/filmsidor.mjs` en sida per film i `public/film/<id>/` med filmens titel och bild, så att
  en länk i Classroom får förhandsvisning. Sidan skickar vidare till `#<id>&t=<sekund>`.
- `public/` — det som publiceras: `index.html` + data. Formen följer `DESIGNBRIEF.md` (efter
  stgeorgescrypt.org.uk/then-and-now): intro i helskärm → vågrät tidslinje "Välj en film" (hjulet
  rullar i sidled; lodrät lista under 700 px) → filmens sida med spelare och kapitel. Sök via
  förstoringsglaset (eller tangenten `/`). Adresser: `#filmer` (berättelserna), `#formelbladet` (serien), `#<id>`, `#<id>&t=<sekund>`, och
  `film/<id>/?t=<sekund>` för länkar som delas. Typsnitt från Google Fonts (Jost + Cormorant
  Garamond); en accentfärg (`--accent`).
- Framsteg sparas i elevens webbläsare (`localStorage`, nyckeln `framsteg`): var eleven slutade,
  om filmen är sedd och om Din tur är löst. Korten i filmvalet visar det, och filmen fortsätter där
  eleven slutade.
- Filmen spelas från egen fil (`fil` i registret): en 1080p-mp4 som ligger som GitHub-release i
  det här repot (`gh release create <tag>` + `gh release upload <tag> <mp4>`, adress
  `https://github.com/rw222ix-eng/matematikvideor/releases/download/<tag>/<fil>`; stöder
  delvisa hämtningar så hopp i filmen fungerar). Kodning ur 4K-exporten:
  `ffmpeg -i <2160p.mp4> -vf scale=1920:1080 -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 192k -movflags +faststart <1080p.mp4>`
  (filerna är 50–75 MB). Utan `fil` används YouTube (`youtube`-id) i stället.
- Spelaren är sidans egen: `<video>` med egna kontroller; med YouTube körs inbäddningen med `controls=0` och styrs via IFrame API
  (spela/pausa, tidslinje, hastighet, kopiera länk hit, ljud, helskärm, tangenterna mellanslag/k,
  ←/→ 5 s, j/l 10 s, < och > hastighet, f, c, m). Tangenterna gäller när spelaren har fokus eller
  inget annat har det, så mellanslag på en knapp trycker på knappen.
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
`node bygg.mjs`, commit, push. Stoppar bygget på en fras (finns inte, eller finns flera gånger)
har manuset ändrats: skriv om frasen i `kapitel.json` eller `dintur.json`.

Kvalitet: exportera i högsta bitrate ur Diffusion Studio; ladda upp till YouTube som 2160p
(uppskalad 1080-master) så hamnar filmen i YouTubes högsta kvalitetsskikt. Vill man ha originalfilen
utan omkodning: lägg mp4:n hos Cloudflare R2 (fri utgående trafik) och sätt `fil` i registret.

Newton, tipsfiguren (2026-09-25): sex bilder i `assets/figur/` (prata, blink, pekar, glad, fundersam,
förvånad), målade i ChatGPT-projektet som riktade ändringar av samma bild. `node verktyg/newton-blink.mjs`
målar blinkbilden ur prata (ChatGPT vred huvudet när ögonen stängdes). `node verktyg/newton.mjs 376
assets/figur/newton-*.png` friställer dem med gemensam ram till `public/figur/*.webp` (kräver cwebp).
Tipsen och när de visas står i `TIPS` och `Newton` i index.html.
