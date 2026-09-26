// Guiden avslutas mitt i Hoppa över och startas om direkt: a) introt (Hoppa över går till filmvalet, 3,5 s),
// b) sökordet (Hoppa över skriver "olikhet" i sökrutan).
export default async (s) => {
  await s.starta();
  let t = await s.vantaPaKnapp(); s.logg("a)", t.raknare, t.text.slice(0, 40)); await s.vanta(500);
  await s.pekPa("#newton-knappar button"); await s.vanta(150);
  await s.tangent("Escape"); await s.vanta(250);
  await s.js(`document.getElementById("hjalp").focus()`); await s.tangent("Enter");
  const sett = [];
  for (let k = 0; k < 80; k++) { t = await s.tillstand(); const r = t.talar && t.knappar.length ? t.raknare + " " + t.text.slice(0, 40) : null; if (r && sett[sett.length - 1] !== r) sett.push(r); await s.vanta(100); }
  s.logg("a) efter omstarten syntes:", JSON.stringify(sett));
  await s.tangent("Escape"); await s.vanta(1000);
  // b)
  await s.pekPa(".vy.aktiv .sok-oppna"); await s.vanta(800);
  await s.starta(); t = await s.vantaPaKnapp(/Skriv ett ord/); s.logg("b)", t.raknare, t.text.slice(0, 40)); await s.vanta(600);
  await s.pekPa("#newton-knappar button"); await s.vanta(200);
  await s.tangent("Escape"); await s.vanta(1500);
  s.logg("b) sökfältet 1,5 s efter Esc:", JSON.stringify(await s.js(`document.getElementById("sok-falt").value`)));
  await s.vakt("omstart");
};
