// Scenario 1b (dator): → flera gånger i snabb följd (också medan han går), Esc och → direkt efter,
// guiden startad igen medan den förra tonar ut (tangentbordet: fokus på frågetecknet + Enter).
export default async (s) => {
  await s.starta();
  let t = await s.vantaPaKnapp();
  s.logg("start:", t.raknare, t.text.slice(0, 50));
  // Tre → inom 100 ms: första skriver klart texten, andra = Nästa, tredje medan han går.
  for (let v = 0; v < 4; v++) {
    for (let k = 0; k < 3; k++) { await s.tangent("ArrowRight"); await s.vanta(40); }
    await s.vanta(150);
    t = await s.tillstand(); s.logg(`efter →→→ (varv ${v}):`, t.raknare, t.talar, t.knappar.join("|"), t.text.slice(0, 50));
    t = await s.vantaPaKnapp(); s.logg(`   sedan:`, t.raknare, t.text.slice(0, 60));
    if (t.knappar.includes("Hoppa över")) { await s.pekPa("#newton-knappar button"); await s.vanta(300); }
  }
  // Esc och → direkt efter.
  await s.tangent("Escape"); await s.vanta(30); await s.tangent("ArrowRight"); await s.vanta(100);
  t = await s.tillstand(); s.logg("efter Esc →:", t.guidar, t.syns, t.text.slice(0, 40));
  // Starta igen medan den tonar ut (inom 460 ms).
  await s.js(`document.getElementById("hjalp").focus()`); await s.tangent("Enter");
  await s.vanta(200); t = await s.tillstand(); s.logg("omstart under uttoningen:", t.guidar, t.syns);
  t = await s.vantaPaKnapp(); s.logg("   sedan:", t.raknare, t.text.slice(0, 60));
  await s.vanta(1500);
  // Esc, och ? igen tre gånger inom 90 ms (tangentbordet).
  await s.tangent("Escape"); await s.vanta(600);
  await s.js(`document.getElementById("hjalp").focus()`); for (let k = 0; k < 3; k++) { await s.tangent("Enter"); await s.vanta(30); }
  t = await s.vantaPaKnapp(); s.logg("tre Enter på ?:", t.raknare, t.text.slice(0, 60));
  await s.vanta(3000);
  const dubbel = await s.js(`document.querySelectorAll("#newton-knappar button").length`);
  s.logg("knappar:", dubbel);
  await s.guide({ val: "hoppa", paus: 900 });
  await s.vanta(5000);
  await s.vakt("tangenter");
};
