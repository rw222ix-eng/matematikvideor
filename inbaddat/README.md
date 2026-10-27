# inbaddat

Ett eget Vercel-projekt (`winterhalls-inbaddat`, rotmapp `inbaddat/`) för GeoGebra och YouTube-reserven. De körs på en egen adress, så att deras kod bara når sin egen ram och inte resten av videoteket (säkerhet B3, `_sakerhet/plan-2.md`).

- `public/` publiceras. Huvudena står i `vercel.json`.
- `ignoreCommand` hoppar över bygget när inget i den här mappen ändrats sedan förra publiceringen, så att en vanlig publicering av videoteket inte bygger det här projektet i onödan. Den första publiceringen, och varje gång git inte hittar förra commiten, byggs alltid.
- Mappen hör inte till huvudprojektet `winterhalls-matte`, som bara publicerar `public/` i repots rot.
