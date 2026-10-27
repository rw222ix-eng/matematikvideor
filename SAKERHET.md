# Så är videoteket skyddat

Skriven 2026-10-27. Ändra filen när ett skydd eller en extern källa ändras. Hur man anmäler ett fel står i `SECURITY.md`. Siffrorna inom parentes är kraven i OWASP ASVS 5.0.

## Sidan

- Statisk sida. Vercel bygger med `node verktyg/publicera.mjs` och GitHub Pages med samma steg i `.github/workflows/pages.yml`. Steget skriver filmsidorna, flyttar sidans skript ur `index.html` till `app.<hash>.js` och byter policyn mot den strikta i `verktyg/csp.mjs`. Bygget använder bara Node, inga npm-paket.
- GitHub Pages skickar vidare till Vercel (2026-10-27), eftersom Pages inte kan skicka säkerhetshuvudena nedan. Pages-workflowet kör `publicera.mjs --vidarekoppla`, som byter startsidan mot en sida som skickar eleven till samma ställe hos Vercel: `#<film>&t=…` följer med, och filmsidorna på Pages går via startsidan dit. Det eleven sparat på Pages-adressen (localStorage, se nästa punkt) följer med i `#flytt=…`, eftersom webbläsaren håller de två adressernas lagring isär. Sidan hos Vercel tar bara emot det när eleven kommer från Pages (`document.referrer`), skriver en inställning bara om den saknas och slår ihop framstegen, och tar sedan bort `#flytt=…` ur adressen. Tas flaggan bort i `pages.yml` blir Pages en full kopia av videoteket igen, till exempel om Vercel ligger nere.
- Inga kakor, ingen inloggning och ingen besöksmätning.
- Sidan sparar i elevens webbläsare (localStorage): `fart`, `formelbladKurs`, `framsteg`, `hjalpVisad`, `provKlass`, `textning`, `tips`, `tipsSedda` och `volym`. Inget av det är känsligt, och inget skickas härifrån (14.3.3).
- Text från `videor.json` går genom `esc()` innan den läggs in som HTML (1.2.1). Sidan använder inte `eval` (1.3.2).
- Trusted Types (B2, 2026-10-27): webbläsaren tar bara emot HTML och skriptadresser som gått genom sidans egna policyer, `videotek` (funktionen `html()` i `index.html`) och `laddare` (laddaren i `verktyg/csp.mjs`). `html()` stoppar HTML med skript, ramar, stilmallar, händelseattribut och `javascript:`, också i webbläsare utan Trusted Types. Ingen annan policy får skapas, och det finns ingen default-policy. Chrome och Edge sedan 2020, Safari 26 och Firefox 148 har stödet.

## Skydden i webbläsaren (3.1.1, 3.7.5)

Huvudena står i `vercel.json`. GitHub Pages kan inte skicka egna huvuden, så där gäller bara det som går i meta-taggarna. Kolumnen Pages gäller när Pages är en full kopia (utan `--vidarekoppla`). Vidarekopplingen har en egen policy (`VIDARE_CSP` i `verktyg/csp.mjs`) med bara sitt skript och sin stil.

| Skydd | Vad det stoppar | Vercel | Pages |
| --- | --- | --- | --- |
| Content-Security-Policy | skript som inte är sidans egna (hash och `'strict-dynamic'`: bara laddaren och filmsidornas vidarekoppling får köra, och de skript de själva lägger in), bilder, ramar och anrop från andra värdar än de i tabellen nedan, en injicerad `<base>`, formulär som skickas bort, plugins | huvud | meta-tagg |
| `frame-ancestors 'none'` och X-Frame-Options: DENY | att en annan sida lägger videoteket i en ram (klickkapning) | huvud | saknas |
| Strict-Transport-Security, 2 år, preload | att sidan öppnas utan https | huvud, och hela `.app` ligger i webbläsarnas preload-lista | 1 år, satt av GitHub |
| X-Content-Type-Options: nosniff | att en fil tolkas som något annat än den är | huvud | saknas |
| Referrer-Policy | att hela adressen skickas till andra värdar | huvud | meta-tagg |
| Permissions-Policy | kamera, mikrofon, plats, sensorer, betalning och 19 funktioner till. Helskärm, autoplay och krypterad film gäller bara sidan och inbäddningsadressen | huvud | saknas |
| Cross-Origin-Opener-Policy: same-origin | att en sida som öppnat videoteket kommer åt fönstret | huvud | saknas |
| Cross-Origin-Resource-Policy | att andra sidor läser in sidans filer i elevens webbläsare. Omslagen under `/omslag/` är undantagna, så att Classroom kan visa förhandsbilden | huvud | saknas |
| X-Robots-Tag: noindex, nofollow | att sökmotorer listar filerna (sidan är olistad) | huvud, och meta-tagg i HTML | meta-tagg |

En äldre webbläsare som inte känner ett skydd hoppar över det. Sidan fungerar då som vanligt, men utan just det skyddet. CSP nivå 2, som policyn bygger på, finns i alla stora webbläsare sedan 2017.

Policyn står i `verktyg/csp.mjs` (`CSP` för meta-taggarna, `CSP_HUVUD` för huvudet) och i `vercel.json`. Bygget faller om de två skiljer sig, och då ligger förra versionen kvar. `node verktyg/csp.mjs` skriver ut raden till `vercel.json`. Meta-taggen i repots `public/index.html` är mildare och gäller bara när `public/` provas lokalt med skriptet inline. Byggsteget byter den.

`public/index.html` ska ha exakt ett `<script>` utan attribut. Bygget faller om det har fler. Händelseattribut (`onclick="…"`) och `javascript:`-länkar körs inte under den strikta policyn. Sätt lyssnare i skriptet i stället.

HTML läggs bara in med `el.innerHTML = html(…)`. En vanlig sträng i `innerHTML`, `insertAdjacentHTML`, `outerHTML` eller `srcdoc` ger `TypeError` i webbläsare med Trusted Types. Töm ett element med `el.replaceChildren()`.

## Externa värdar (13.1.1)

| Värd | Varför | Direktiv |
| --- | --- | --- |
| matematikvideor-inbaddat.vercel.app | GeoGebra och YouTube-reserven, i ramar (se nedan) | frame-src |
| github.com, release-assets.githubusercontent.com, objects.githubusercontent.com | filmerna, som ligger under Releases i det här repot | media-src |

### GeoGebra och YouTube på en egen adress (B3, 2026-10-27)

GeoGebras och YouTubes kod körs inte på videotekets sida. De ligger i ramar från Vercel-projektet `matematikvideor-inbaddat` (mappen `inbaddat/`, sidorna `ggb.html` och `yt.html`). Blir GeoGebra eller YouTube kapade, når deras kod bara sin egen ram, inte elevens framsteg eller resten av sidan.

- Sidan och ramen pratar med postMessage. Båda kontrollerar avsändarens ursprung och fönster (ASVS 3.5.5). Ramen tar bara emot kommandon till spelaren (spela, pausa, spola, ljud, fart), och sidan tar bara emot läget och «klar», «start» eller «fel».
- Ramarna går bara att bädda in från videoteket (`frame-ancestors`). En ram vars `o=` inte är videoteket kör ingenting.
- Policyn för ramarna står i `inbaddat/huvuden.mjs`: www.geogebra.org i ggb.html, www.youtube.com i yt.html. Projektets bygge faller om `inbaddat/vercel.json` inte stämmer med sidorna.
- Helskärm, autoplay och krypterad film delegeras till ramens adress i Permissions-Policy, och ramen delegerar dem vidare till YouTube.

Typsnitten ligger i `public/fonts/`. Google Fonts används inte, så att Google inte ser elevernas adresser.

## Tredjepartsdelar (15.1.2)

| Del | Version | Licens | Hur den uppdateras |
| --- | --- | --- | --- |
| GeoGebra (`deployggb.js` och grafräknaren) | den GeoGebra serverar just då | GeoGebras villkor | av GeoGebra, utan att repot ändras |
| YouTube IFrame API | den YouTube serverar just då | YouTubes villkor | av YouTube, utan att repot ändras |
| Cormorant Garamond, Jost, Kalam | fasta filer i `public/fonts/` | SIL Open Font License 1.1 (`OFL-*.txt`) | bara med en commit |
| actions/checkout, configure-pages, upload-pages-artifact, deploy-pages | låsta på SHA i workflowen | MIT | Dependabot varje vecka (`.github/dependabot.yml`) |

### Varför GeoGebra och YouTube saknar SRI (3.6.1)

Subresource Integrity kräver att filen är byte för byte densamma vid varje besök. `deployggb.js` och `iframe_api` ändras av GeoGebra och YouTube utan förvarning, och de laddar i sin tur fler skript. En hash skulle spärra Din tur och reserven nästa gång de ändras. I stället får de bara komma från sina egna värdar över https, och de körs på en egen adress, så att deras kod inte når resten av sidan.

## Tidsgränser för larm (15.1.1)

| Larm | Åtgärdas inom |
| --- | --- |
| hemlighetsskanningen hittar en nyckel | samma dag: nyckeln byts, sedan rensas den |
| Dependabot eller CodeQL, kritisk eller hög | 7 dagar |
| Dependabot eller CodeQL, medel eller låg | 30 dagar, eller avfärdas med en motivering |
| anmälan via `SECURITY.md` | svar inom en vecka, rättelse som i `SECURITY.md` |

`public/.well-known/security.txt` (RFC 9116) visar vart fel anmäls. Workflowet `security-txt.yml` faller en gång i månaden när det är under 60 dagar kvar till `Expires`, och då mejlar GitHub.

## Repot

- Rulesetet «Skydda main» nekar force-push och radering av main. «Skydda taggarna» nekar radering och flytt av alla taggar, så de 381 äldre releaserna ligger kvar på samma commit.
- Releaserna är oföränderliga sedan 2026-10-27. En publicerad film kan inte bytas ut under samma adress, och varje release får en attestering (`gh release verify <tagg>`). Alla filer läggs upp i samma `gh release create <tagg> <filer>`.
- Workflowen måste vara låsta på SHA (`sha_pinning_required`). Det gäller också åtgärder som en åtgärd anropar inuti.
- Pages-bygget får härkomst (`actions/attest-build-provenance`). `gh attestation verify <fil> -R rw222ix-eng/matematikvideor` visar vilken commit en fil från Vercel eller Pages kommer från.

## Innan du ändrar sidan

- En ny extern källa (bild, typsnitt, ram eller film från en annan värd) spärras tills den står i `verktyg/csp.mjs`, `vercel.json` och meta-taggen i `public/index.html`. Ett skript från en annan värd hör inte hemma på sidan. Lägg det i en egen sida under `inbaddat/public/`, med policyn i `inbaddat/huvuden.mjs`, och bädda in den som GeoGebra och YouTube. Lägg också in den i tabellen över externa värdar med skälet. Öppna sidan och läs konsolen efter CSP-fel innan du pushar.
- Lägg aldrig tillbaka Google Fonts eller besöksmätning (Rickards beslut 2026-10-25).
- Workflowen använder bara `actions/*` och `github/*`, låsta på SHA. En åtgärd från någon annan läggs inte in.
- Inga hemligheter i repot. `.gitignore` spärrar `.env*`, `*.pem` och `*.key`.
