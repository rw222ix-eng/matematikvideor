# inbaddat

Vercel-projektet `matematikvideor-inbaddat` (https://matematikvideor-inbaddat.vercel.app, rotmapp `inbaddat/`) för GeoGebra och YouTube-reserven. De körs på en egen adress, så att deras kod bara når sin egen ram och inte resten av videoteket (säkerhet B3, `SAKERHET.md`).

- `public/ggb.html`: GeoGebras grafräknare i Din tur. `ggb.html#o=<videotekets ursprung>&app=graphing&b=<bredd>&h=<höjd>`. Svarar sidan «start», «klar» eller «fel».
- `public/yt.html`: YouTube-reserven. `yt.html#v=<id>&o=<ursprung>&start=<sekund>&autoplay=0|1`. Tar emot spela, pausa, sok, tyst, ljud, volym, fart och text-av, och svarar med spelarens läge.
- Båda kör bara om `o=` är videoteket (eller 127.0.0.1/localhost för lokala prov), och tar bara emot meddelanden från det ursprunget och föräldrafönstret.
- `huvuden.mjs` har policyn per sida och räknar hasharna för sidornas inline-skript och stilar. `node huvuden.mjs` skriver `vercel.json`. Bygget kör `node huvuden.mjs --kontroll` och faller om filen inte stämmer, så ändra aldrig `vercel.json` för hand.
- `ignoreCommand` hoppar över bygget när inget i den här mappen ändrats sedan förra publiceringen. Den första publiceringen, och varje gång git inte hittar förra commiten, byggs alltid.
- Mappen hör inte till huvudprojektet `winterhalls-matte`, som bara publicerar `public/` i repots rot.
