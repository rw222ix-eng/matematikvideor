// Scenario 4: eleven gör uppgiften innan texten skrivits klart, gör nästa stegs uppgift i förväg,
// och ett tips (Din tur: två svar som sidan inte kan läsa) krockar med guiden.
export default async (s) => {
  await s.starta();
  let t = await s.vantaPaKnapp(); s.logg("1", t.raknare, t.text.slice(0, 40));
  // I Hej-steget (info): gör flikstegets uppgift i förväg (tryck på Matematik 2a) medan texten skrivs.
  await s.vanta(300); await s.pekPa("#flikar [data-hylla='ma2a']");
  for (let k = 0; k < 4; k++) { t = await s.vantaPaKnapp(); s.logg("   →", t.raknare, t.knappar.join("|"), t.text.slice(0, 60)); if (t.knappar.includes("Hoppa över") || !t.guidar) break; await s.vanta(800); }
  // Uppgiften innan texten är klar: sök-steget, tryck på förstoringsglaset 200 ms in.
  for (let k = 0; k < 6 && !/förstoringsglaset/.test(t.text); k++) { await s.pekPa("#newton-knappar button"); await s.vanta(300); t = await s.vantaPaKnapp(); s.logg("   →", t.raknare, t.text.slice(0, 50)); }
  await s.vanta(200); await s.pekPa(".vy.aktiv .sok-oppna");
  // och skriver direkt (sokt-steget görs i förväg medan han svarar)
  await s.vanta(250); for (const c of "potens") { await s.tangent(c); await s.vanta(40); }
  for (let k = 0; k < 3; k++) { t = await s.vantaPaKnapp(); s.logg("   efter sök+skriv:", t.raknare, t.text.slice(0, 60)); await s.vanta(1500); }
  // Stäng sökningen innan texten skrivits, och tryck direkt på ett filmkort.
  await s.pekPa("#sok-stang"); await s.vanta(150); await s.pekPa("#spar .post:not(.kommer):not(.bro) button[data-film]");
  t = await s.vantaPaKnapp(); s.logg("   film:", t.vy, t.raknare, t.text.slice(0, 60));
  // Spela innan texten är klar, sedan pausa direkt (två uppgifter i snabb följd).
  await s.vanta(200); await s.pekPa("#duk-lock"); await s.vanta(700);
  t = await s.vantaPaKnapp(); s.logg("   efter spela:", t.raknare, t.text.slice(0, 60));
  await s.pekPa("#duk-lock"); await s.vanta(400); if (s.telefon) { await s.pekPa("#duk-stor"); }
  for (let k = 0; k < 3; k++) { t = await s.vantaPaKnapp(); s.logg("   sedan:", t.raknare, t.text.slice(0, 60)); await s.vanta(1400); }
  // Din tur: två svar som sidan inte kan läsa medan guiden visar något annat (tipset "format" får inte krocka).
  await s.js(`(() => { const i = document.querySelector("#dintur-delar input"); i.scrollIntoView({ block: "center" }); })()`); await s.vanta(600);
  for (let k = 0; k < 2; k++) { await s.pekPa("#dintur-delar input"); for (const c of "hej") await s.tangent(c); await s.tangent("Enter"); await s.vanta(500); }
  t = await s.vantaPaKnapp(); s.logg("   efter Din tur-svaren:", t.raknare, t.knappar.join("|"), t.text.slice(0, 70));
  await s.guide({ val: "hoppa", paus: 1200 });
  await s.vanta(4000);
  const tips = await s.tillstand(); s.logg("efter guiden:", tips.syns, tips.text.slice(0, 50));
  await s.vakt("tidig");
};
