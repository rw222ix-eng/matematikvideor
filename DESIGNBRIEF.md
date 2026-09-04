# Videoteket — designbrief (2026-09-04)

Rickard: "jag skulle vilja att vi fixar så att den efterliknar denna otroligt mycket" —
https://www.stgeorgescrypt.org.uk/then-and-now . Sidan är i dag en snabb funktionell version
(`public/index.html`, ren HTML/CSS/JS utan ramverk). Funktionen ska behållas, formen görs om.

## Referensens formspråk (avläst i webbläsaren 2026-09-04)
1. **Intro i helskärm.** Ett fotografi täcker hela skärmen, mörkt och avmättat (svartvitt med
   tung vinjett), med en liten logotyp centrerad överst ("95 | St. George's Crypt"). Mitt på:
   en stor skrivstilsrubrik med citattecken ("Then & Now…") över två rader, en tre raders
   ingress i tunn sans, och längst ner en knapp "Explore ▶" med en tunn grön ring runt
   play-ikonen. Ljud-ikon (staplar) nere till höger. Allt tonar in långsamt.
2. **"Choose a decade."** Nästan svart bakgrund (#161616-ish). Överst samma logotyp, under den
   etiketten CHOOSE A DECADE i spärrad versal geometrisk sans (tracking ~0,3 em, liten grad).
   En **vågrät tidslinje**: fotografier hänger på tunna lodräta linjer ner mot årtalsetiketter
   ("1930s" med litet "s") längs nederkanten. Bilderna ligger på olika höjd, svartvita, dämpade,
   och blir ljusare vid hovring. Mushjulet rullar tidslinjen **i sidled** med tröghet.
   Nere till höger små ikoner (ljud, återställ).
3. **Ett årtiondes berättelse.** Klick på ett årtionde → en lodrät sida: årtalen som små
   spärrade rubriker ("1931—1937"), textstycken i tunn sans med generösa marginaler, foton med
   kursiva bildtexter, mycket luft, långsam intoning vid scroll.
4. Typografi: geometrisk sans (Futura-känsla — använd Josefin Sans/Jost från Google Fonts)
   för etiketter och brödtext; en elegant skrivstil för rubriken (t.ex. Pinyon Script eller
   Great Vibes). Färg: nästan svart, benvit text, EN dämpad accent (grön där; hos oss det varma
   ljuslågegula #F2C572 eller kobolt #7FA6FF ur videorna). Filmkorn över bilderna.

## Så här översätts det till videoteket
- **Intro:** Kepler-omslaget utan titel (`../kepler-och-planeterna/assets/omslag/omslag-utan-titel.png`,
  finns även som `public/omslag/…`) som helskärmsbild, avmättad och mörkad. Liten "logotyp":
  "Matematikvideor | med Rickard". Skrivstilsrubrik med citattecken — förslag: "Historien &
  matten…" (Rickard väljer ordalydelse). Ingress: "Korta filmer där matten kommer ur en verklig
  historia. Sök på det du tycker är svårt och hoppa till stället i filmen där det förklaras."
  Knapp "Utforska ▶".
- **Välj en film (= "Choose a decade"):** vågrät tidslinje med omslagen hängande på tunna
  linjer, etikett under = kursen ("Ma 1c") och momentet i spärrad versal. Hjulet rullar i sidled.
  Med en film i dag ska det ändå se avsiktligt ut (t.ex. filmen + tomma "kommer"-platser i dis).
  En sökruta (förstoringsglas uppe till höger) som öppnar sökläget: träffar i det som sägs, med
  tid, klick → hoppa till sekunden.
- **Filmens sida (= årtiondet):** spelaren överst (YouTube via IFrame API när `youtube` finns,
  annars "publiceras snart"), under den kapitlen: varje replik som ett stycke med tidkoden som
  spärrad rubrik ("2:31"), klick → hoppa. Beskrivning och begrepp som små etiketter.
- Deep-länkar `#kepler-och-planeterna&t=123` ska fortsätta fungera.

## Tekniska ramar
- Behåll allt i `public/` som statiska filer (index.html + `videor.json` + `omslag/`); datan
  byggs av `node bygg.mjs` ur `register.json` och projektens `assets/tal-tider.json` — rör inte
  datamodellen, bara presentationen. Ingen byggkedja, inget ramverk; Google Fonts går bra.
- Mobil först: tidslinjen blir en lodrät lista under 700 px; intro fungerar i porträtt.
- Rörelse: långsamma toningar (0,8–1,2 s), horisontell scroll med tröghet (translateX +
  requestAnimationFrame), respektera `prefers-reduced-motion`.
- Prestanda: omslag ≤ 100 kB per bild i `public/omslag/`, inga tunga bibliotek.
- Testa i Claude Browser-panelen (`.claude/launch.json` har "videotek" → http://localhost:8765).
- Publicering: GitHub-repot `matematikvideor` (skapas av Rickard) → GitHub Pages eller Vercel
  (Vercel-kopplingen saknade rättighet att skapa projekt 2026-09-04; import från GitHub i
  Vercels instrumentpanel fungerar).
