# Kontroll av Din tur-bilderna (Rickard 2026-11-04)

Ritar figurerna med sidans egen `figur()`, CSS och typsnitt, i datorläge och telefonläge, och mäter varje etikett.

    node verktyg/dintur-kontroll/lager.mjs . /tmp/din-tur
    python3 verktyg/dintur-kontroll/kontroll.py /tmp/din-tur dintur.json
    python3 verktyg/dintur-kontroll/ark.py /tmp/din-tur dator 800 2 6 /tmp/ark
    python3 verktyg/dintur-kontroll/ark.py /tmp/din-tur telefon 360 4 16 /tmp/ark-telefon

Kör den efter varje ändring i `figur` eller i frågans tal, och titta på arken också. RÖR STRECK och KLIPPS ska inte finnas. LÅG KONTRAST räknar inte med skuggan runt bläcket, så titta själv. Raden "finns inte i frågan" visar tal i bilden som frågan inte nämner (axelmarkeringar är okej). `--visa <prefix>` ger en hel bild per film, `--id` väljer filmer.

## Texten (2026-11-06)

    node verktyg/dintur-kontroll/notation.mjs

Kör sidans egen `matte()` på all text i dintur.json. Stannar om `^`, `_` eller `*` syns för eleven, eller om ett tecken saknas i `public/fonts`. Saknas ett tecken, lägg det i en `*-matte.woff2` och i `unicode-range` på dess `@font-face`, och i `FINNS` i skriptet. `--visa` skriver ut varje text med formler, ⟦så här⟧ där en formel hålls ihop.
