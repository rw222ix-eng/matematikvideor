// → i snabb följd när nästa steg är ett informationssteg (filmsidan i formelbladet: Nästa del → Delarna → Slut),
// och en nedhållen → (upprepning).
export default async (s) => {
  await s.js(`scrollTo(0, document.documentElement.scrollHeight)`); await s.vanta(800);
  await s.starta();
  let t = await s.vantaPaKnapp(); if (t.knappar.includes("Hoppa över")) { await s.vanta(500); await s.pekPa("#newton-knappar button"); }
  t = await s.vantaPaKnapp(/nästa del/); s.logg("start:", t.raknare, t.text.slice(0, 50));
  for (let k = 0; k < 3; k++) { await s.tangent("ArrowRight"); await s.vanta(40); }
  const sett = new Set();
  for (let k = 0; k < 40; k++) { t = await s.tillstand(); if (t.talar && t.knappar.length) sett.add(t.raknare + " " + t.text.slice(0, 40)); if (!t.guidar) break; await s.vanta(100); }
  s.logg("efter →→→ syntes:", JSON.stringify([...sett]));
  await s.tangent("Escape"); await s.vanta(800);
  await s.js(`scrollTo(0, document.documentElement.scrollHeight)`); await s.vanta(800);
  await s.starta(); t = await s.vantaPaKnapp(); if (t.knappar.includes("Hoppa över")) { await s.vanta(500); await s.pekPa("#newton-knappar button"); }
  t = await s.vantaPaKnapp(/nästa del/); await s.vanta(3000); s.logg("igen:", t.raknare);
  for (let k = 0; k < 20; k++) { await s.tangent("ArrowRight", { upprepa: k > 0 }); await s.vanta(33); }
  sett.clear();
  for (let k = 0; k < 40; k++) { t = await s.tillstand(); if (t.talar && t.knappar.length) sett.add(t.raknare + " " + t.text.slice(0, 40)); if (!t.guidar) break; await s.vanta(100); }
  s.logg("efter nedhållen → syntes:", JSON.stringify([...sett]), "guiden kvar:", t.guidar);
  await s.vakt("pil");
};
