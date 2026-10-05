# Bildprompter — Din tur-figurerna

Rickard 2026-09-29: eleverna behöver bildstöd i Din tur, framför allt i geometrin. Figuren är en plåt
som i videorna, och strecken, talen och vinklarna ritas ovanpå i kod (`figur` i `dintur.json`,
`figur()` i `public/index.html`). Bilderna ligger i `public/dintur/<film-id>.jpg`.

Tio filmer har redan en plåt för slutuppgiften eller övningstalet, och den används. Formelbladsvideorna
har bara provbänken som slutplåt, och deras pappersuppslag med formelklipp visar för mycket
(normalfördelningens klipp har procenten). De fem som saknas genereras som pappersuppslag i
formelbladsseriens stil, eftersom figuren på dem ska vara exakt och ritas på det tomma pappret.

## Plåtkarta

| Film | Plåt | Källa |
|---|---|---|
| `delos-och-altaret` | `p02-delos-apollons-altare` | befintlig |
| `arkimedes-och-cirkeln` | `p10-skeppet-i-skymningen` | befintlig |
| `ma1c-k6-01-sinus-cosinus-tangens` | `p06-elevens-pyramid` | befintlig |
| `ma1c-k6-02-berakna-sidor` | `p08-berget-i-dalen` | befintlig |
| `ma1c-k6-03-berakna-vinklar` | `p07-annat-torn` | befintlig |
| `ma1c-k6-04-vektorbegreppet` | `b05-uppslag-tyngd` | befintlig |
| `ma1c-k6-05-addera-vektorer` | `p07-bligh-skriver` | befintlig |
| `ma1c-k6-06-vektorer-i-koordinatform` | `b01-uppslag-koordinater` | befintlig |
| `formelbladet-5-pythagoras-trigonometri-vektorer` | `b02-rutschkanan` | befintlig |
| `formelbladet-ma2-2-andragradsfunktionen` | `b01-boll` | befintlig |
| `formelbladet-3-plan-geometri` | `d01-pizza` | ny |
| `formelbladet-4-rymdgeometri-och-skala` | `d02-modellen` | ny |
| `formelbladet-ma2-4-likformighet` | `d03-lyktstolpen` | ny |
| `formelbladet-ma2-5-vinklar-och-cirkelsatser` | `d04-fotbollen` | ny |
| `formelbladet-ma2-6-statistik` | `d05-aggen` | ny |

**Inledningsrad** (klistras före prompten): "New plate for the formula-sheet video. Generate the image exactly as prompted, do not reuse any existing plate:"

**Gemensam stilsvans** (sist i varje prompt, samma som formelbladsseriens b-plåtar):

> A sheet of cream off-white cold-press watercolour paper fills the entire frame, visible paper grain and soft fibre texture, even soft daylight, very faint shadow, cinematic widescreen format. The vignette is taped down with two short strips of pale masking tape. The vignette is small, no wider than one fifth of the sheet, tucked into the upper right corner with a thin margin of bare paper between it and the top and right edges. Its left edge sits at least four fifths of the way across the sheet, and nothing at all is painted on the left four fifths of the paper or below the upper third. Muted gouache in birch white, pale ash, soft slate blue and a little ochre against bare paper, no bright colours. No text, no numbers, no letters, no symbols, no writing, no sketch marks, no drawn lines anywhere on the paper.

## d01-pizza

A small square gouache vignette of one whole round pizza seen from straight above on a pale wooden board, not yet cut, with a golden crust, red tomato sauce, white mozzarella and a few green basil leaves, painted loosely with soft edges against a plain neutral background; no knife, no cuts, no slices missing. A sheet of cream off-white cold-press watercolour paper fills the entire frame, visible paper grain and soft fibre texture, even soft daylight, very faint shadow, cinematic widescreen format. The vignette is taped down with two short strips of pale masking tape. The vignette is small, no wider than one fifth of the sheet, tucked into the upper right corner with a thin margin of bare paper between it and the top and right edges. Its left edge sits at least four fifths of the way across the sheet, and nothing at all is painted on the left four fifths of the paper or below the upper third. Muted gouache in birch white, pale ash, soft slate blue and a little ochre against bare paper, no bright colours. No text, no numbers, no letters, no symbols, no writing, no sketch marks, no drawn lines anywhere on the paper.

## d02-modellen

A small square gouache vignette of a small handmade cardboard model of an empty school classroom, an open box without a roof seen from a little above, with a tiny window cut in one wall and a few tiny cardboard desks in rows on its floor, standing on a pale ash wood table, painted loosely with soft edges against a plain neutral background; no people, no pictures on the walls, no board with writing. A sheet of cream off-white cold-press watercolour paper fills the entire frame, visible paper grain and soft fibre texture, even soft daylight, very faint shadow, cinematic widescreen format. The vignette is taped down with two short strips of pale masking tape. The vignette is small, no wider than one fifth of the sheet, tucked into the upper right corner with a thin margin of bare paper between it and the top and right edges. Its left edge sits at least four fifths of the way across the sheet, and nothing at all is painted on the left four fifths of the paper or below the upper third. Muted gouache in birch white, pale ash, soft slate blue and a little ochre against bare paper, no bright colours. No text, no numbers, no letters, no symbols, no writing, no sketch marks, no drawn lines anywhere on the paper.

## d03-lyktstolpen

A small square gouache vignette of one tall plain dark grey street lamp post standing on flat pale ground in low evening sunlight, seen from the side, casting one long straight shadow along the ground, and a little way from it one short thin wooden stick pushed upright into the ground casting its own short shadow in the same direction, painted loosely with soft edges against a plain pale sky; no people, no cars, no buildings, no signs. A sheet of cream off-white cold-press watercolour paper fills the entire frame, visible paper grain and soft fibre texture, even soft daylight, very faint shadow, cinematic widescreen format. The vignette is taped down with two short strips of pale masking tape. The vignette is small, no wider than one fifth of the sheet, tucked into the upper right corner with a thin margin of bare paper between it and the top and right edges. Its left edge sits at least four fifths of the way across the sheet, and nothing at all is painted on the left four fifths of the paper or below the upper third. Muted gouache in birch white, pale ash, soft slate blue and a little ochre against bare paper, no bright colours. No text, no numbers, no letters, no symbols, no writing, no sketch marks, no drawn lines anywhere on the paper.

## d04-fotbollen

A small square gouache vignette of a classic football made of black five-sided patches and white six-sided patches stitched together, resting on short green grass, painted loosely with soft edges against a plain neutral background; no logo, no brand, no printing on the ball. A sheet of cream off-white cold-press watercolour paper fills the entire frame, visible paper grain and soft fibre texture, even soft daylight, very faint shadow, cinematic widescreen format. The vignette is taped down with two short strips of pale masking tape. The vignette is small, no wider than one fifth of the sheet, tucked into the upper right corner with a thin margin of bare paper between it and the top and right edges. Its left edge sits at least four fifths of the way across the sheet, and nothing at all is painted on the left four fifths of the paper or below the upper third. Muted gouache in birch white, pale ash, soft slate blue and a little ochre against bare paper, no bright colours. No text, no numbers, no letters, no symbols, no writing, no sketch marks, no drawn lines anywhere on the paper.

## d05-aggen

A small square gouache vignette of about eight brown and cream hen's eggs of slightly different sizes lying in a simple pale ceramic bowl on a pale ash wood table, painted loosely with soft edges against a plain neutral background; no stamps and no markings on the eggs, no scale, no carton. A sheet of cream off-white cold-press watercolour paper fills the entire frame, visible paper grain and soft fibre texture, even soft daylight, very faint shadow, cinematic widescreen format. The vignette is taped down with two short strips of pale masking tape. The vignette is small, no wider than one fifth of the sheet, tucked into the upper right corner with a thin margin of bare paper between it and the top and right edges. Its left edge sits at least four fifths of the way across the sheet, and nothing at all is painted on the left four fifths of the paper or below the upper third. Muted gouache in birch white, pale ash, soft slate blue and a little ochre against bare paper, no bright colours. No text, no numbers, no letters, no symbols, no writing, no sketch marks, no drawn lines anywhere on the paper.
