# Så är videoteket skyddat

Skriven 2026-10-27. Ändra filen när ett skydd eller en extern källa ändras. Hur man anmäler ett fel står i `SECURITY.md`. Siffrorna inom parentes är kraven i OWASP ASVS 5.0.

## Sidan

- Statisk sida. Vercel bygger med `node verktyg/filmsidor.mjs` och GitHub Pages med samma steg i `.github/workflows/pages.yml`. Bygget använder bara Node, inga npm-paket.
- Inga kakor, ingen inloggning och ingen besöksmätning.
- Sidan sparar i elevens webbläsare (localStorage): `fart`, `formelbladKurs`, `framsteg`, `hjalpVisad`, `provKlass`, `textning`, `tips`, `tipsSedda` och `volym`. Inget av det är känsligt, och inget skickas härifrån (14.3.3).
- Text från `videor.json` går genom `esc()` innan den läggs in som HTML (1.2.1). Sidan använder inte `eval` (1.3.2).

## Skydden i webbläsaren (3.1.1, 3.7.5)

Huvudena står i `vercel.json`. GitHub Pages kan inte skicka egna huvuden, så där gäller bara det som går i meta-taggarna.

| Skydd | Vad det stoppar | Vercel | Pages |
| --- | --- | --- | --- |
| Content-Security-Policy | skript, bilder, ramar och anrop från andra värdar än de i tabellen nedan, en injicerad `<base>`, formulär som skickas bort, plugins | huvud | meta-tagg |
| `frame-ancestors 'none'` och X-Frame-Options: DENY | att en annan sida lägger videoteket i en ram (klickkapning) | huvud | saknas |
| Strict-Transport-Security, 2 år, preload | att sidan öppnas utan https | huvud, och hela `.app` ligger i webbläsarnas preload-lista | 1 år, satt av GitHub |
| X-Content-Type-Options: nosniff | att en fil tolkas som något annat än den är | huvud | saknas |
| Referrer-Policy | att hela adressen skickas till andra värdar | huvud | meta-tagg |
| Permissions-Policy | kamera, mikrofon, plats, sensorer, betalning och 19 funktioner till. Helskärm, autoplay och krypterad film gäller bara sidan och YouTube | huvud | saknas |
| Cross-Origin-Opener-Policy: same-origin | att en sida som öppnat videoteket kommer åt fönstret | huvud | saknas |
| Cross-Origin-Resource-Policy | att andra sidor läser in sidans filer i elevens webbläsare. Omslagen under `/omslag/` är undantagna, så att Classroom kan visa förhandsbilden | huvud | saknas |
| X-Robots-Tag: noindex, nofollow | att sökmotorer listar filerna (sidan är olistad) | huvud, och meta-tagg i HTML | meta-tagg |

En äldre webbläsare som inte känner ett skydd hoppar över det. Sidan fungerar då som vanligt, men utan just det skyddet. CSP nivå 2, som policyn bygger på, finns i alla stora webbläsare sedan 2017.

CSP står på tre ställen som ska vara lika: `vercel.json`, meta-taggen i `public/index.html` och konstanten `CSP` i `verktyg/filmsidor.mjs`. Ändras ett av dem utan de andra, spärrar den strängaste.

## Externa värdar (13.1.1)

| Värd | Varför | Direktiv |
| --- | --- | --- |
| www.geogebra.org | grafräknaren i Din tur: `deployggb.js`, appens skript, stilar och anrop | script-src, style-src, connect-src |
| www.youtube.com | reserven när filmfilen inte går att hämta | script-src, frame-src |
| github.com, release-assets.githubusercontent.com, objects.githubusercontent.com | filmerna, som ligger under Releases i det här repot | media-src |

Typsnitten ligger i `public/fonts/`. Google Fonts används inte, så att Google inte ser elevernas adresser.

## Tredjepartsdelar (15.1.2)

| Del | Version | Licens | Hur den uppdateras |
| --- | --- | --- | --- |
| GeoGebra (`deployggb.js` och grafräknaren) | den GeoGebra serverar just då | GeoGebras villkor | av GeoGebra, utan att repot ändras |
| YouTube IFrame API | den YouTube serverar just då | YouTubes villkor | av YouTube, utan att repot ändras |
| Cormorant Garamond, Jost, Kalam | fasta filer i `public/fonts/` | SIL Open Font License 1.1 (`OFL-*.txt`) | bara med en commit |
| actions/checkout, configure-pages, upload-pages-artifact, deploy-pages | låsta på SHA i workflowen | MIT | Dependabot varje vecka (`.github/dependabot.yml`) |

### Varför GeoGebra och YouTube saknar SRI (3.6.1)

Subresource Integrity kräver att filen är byte för byte densamma vid varje besök. `deployggb.js` och `iframe_api` ändras av GeoGebra och YouTube utan förvarning, och de laddar i sin tur fler skript. En hash skulle spärra Din tur och reserven nästa gång de ändras. I stället får de bara komma från sina egna värdar över https, och de ska flyttas till en egen adress, så att deras kod inte når resten av sidan.

## Tidsgränser för larm (15.1.1)

| Larm | Åtgärdas inom |
| --- | --- |
| hemlighetsskanningen hittar en nyckel | samma dag: nyckeln byts, sedan rensas den |
| Dependabot eller CodeQL, kritisk eller hög | 7 dagar |
| Dependabot eller CodeQL, medel eller låg | 30 dagar, eller avfärdas med en motivering |
| anmälan via `SECURITY.md` | svar inom en vecka, rättelse som i `SECURITY.md` |

`public/.well-known/security.txt` (RFC 9116) visar vart fel anmäls. Workflowet `security-txt.yml` faller en gång i månaden när det är under 60 dagar kvar till `Expires`, och då mejlar GitHub.

## Innan du ändrar sidan

- En ny extern källa (skript, bild, typsnitt, ram eller film från en annan värd) spärras tills den står på alla tre CSP-ställena. Lägg också in den i tabellen över externa värdar med skälet. Öppna sidan och läs konsolen efter CSP-fel innan du pushar.
- Lägg aldrig tillbaka Google Fonts eller besöksmätning (Rickards beslut 2026-10-25).
- Workflowen använder bara `actions/*` och `github/*`, låsta på SHA. En åtgärd från någon annan läggs inte in.
- Inga hemligheter i repot. `.gitignore` spärrar `.env*`, `*.pem` och `*.key`.
