// Scenario 1c: ett tips visas (sökningen, 9 s in i filmvalet) och eleven trycker på ? tre gånger inom 80 ms.
// Sedan: guiden startas precis när ett tips är på väg (efter-timern går under starten).
export default async (s) => {
  const slut = Date.now() + 16000; let t;
  for (;;) { t = await s.tillstand(); if (t.syns && t.talar) break; if (Date.now() > slut) break; await s.vanta(100); }
  s.logg("tips:", t.syns, t.text.slice(0, 50));
  await s.vanta(300);
  const p = await s.mitt("#hjalp");
  for (let k = 0; k < 3; k++) { await s.pek(p[0], p[1]); await s.vanta(35); }
  t = await s.vantaPaKnapp(); s.logg("efter ???:", t.guidar, t.raknare, t.text.slice(0, 60));
  await s.vanta(2500);
  const n = await s.js(`document.querySelectorAll("#newton-knappar button").length + " knappar, text: " + document.querySelector("#newton-text .skrivet").textContent.length + "/" + document.querySelector("#newton-text .sr").textContent.length`);
  s.logg(n);
  await s.guide({ val: "hoppa", paus: 1000, max: 8 });
  await s.tangent("Escape");
  await s.vanta(4000);
  await s.vakt("tips + ???");
  // Filmvalet igen (nytt vybyte → nytt efter-tips om 9 s, sök är sett så formelbladet-tipset) — starta 8,8 s in.
  await s.ladda("about:blank"); await s.ladda(process.env.URL2 || s.url.replace(/#.*$/, "#filmer"));
  await s.vanta(6300);
  await s.starta();
  t = await s.vantaPaKnapp(); s.logg("guide startad strax före tipset:", t.raknare, t.text.slice(0, 50));
  await s.vanta(12000);
  t = await s.tillstand(); s.logg("12 s senare:", t.raknare, t.knappar.join("|"), t.text.slice(0, 50));
  await s.guide({ val: "hoppa", paus: 1000, max: 8 });
  await s.vanta(5000);
  await s.vakt("guide + efter-tips");
};
