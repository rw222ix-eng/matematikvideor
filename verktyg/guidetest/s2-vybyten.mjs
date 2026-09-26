// Scenario 2: vybyten mitt i ett steg.
export default async (s) => {
  const kort = "#spar .post:not(.kommer):not(.bro) button[data-film]";
  // a) Filmkort mitt i tidslinjesteget (text skrivs fortfarande).
  await s.starta();
  let t = await s.vantaPaKnapp(); await s.pekPa("#newton-knappar button");   // Nästa
  t = await s.vantaPaKnapp(); s.logg("a) steg:", t.raknare, t.text.slice(0, 40));
  await s.vanta(250); await s.pekPa(kort); await s.vanta(1500);
  t = await s.vantaPaKnapp(); s.logg("a) efter kortet:", t.vy, t.raknare, t.text.slice(0, 50));
  // history.back() mitt i filmens steg → filmvalet, guiden slutar.
  await s.vanta(400); await s.js("history.back()"); await s.vanta(1500);
  t = await s.tillstand(); s.logg("a) efter back:", t.vy, t.guidar, t.syns);
  await s.vanta(4000); await s.vakt("a) kort + back");
  // b) Flikar och växlaren fort fram och tillbaka under flikstegen.
  await s.starta(); t = await s.vantaPaKnapp(); s.logg("b)", t.raknare, t.text.slice(0, 40));
  for (let k = 0; k < 10; k++) {
    const flikar = ["#flikar [data-hylla='berattelser']", "#flikar [data-hylla='ma2a']", "#flikar [data-hylla='formelbladet']", "#formelval [aria-selected='false']"];
    await s.pekPa(flikar[k % 4]); await s.vanta(60 + (k * 37) % 120);
  }
  await s.vanta(300); t = await s.vantaPaKnapp(); s.logg("b) efter flikarna:", t.raknare, t.hash, t.text.slice(0, 50));
  // c) Sökningen öppnas och stängs fort (80 ms), tre gånger.
  for (let k = 0; k < 3; k++) { await s.pekPa(".vy.aktiv .sok-oppna"); await s.vanta(80); await s.pekPa("#sok-stang"); await s.vanta(120); }
  await s.vanta(300); t = await s.vantaPaKnapp(); s.logg("c) efter sökningen:", t.raknare, t.hash, t.text.slice(0, 50));
  // d) Storleken dator ↔ telefon mitt i ett steg.
  const [b0, h0] = [s.bredd, s.hojd];
  await s.storlek(b0 < 700 ? 1280 : 390, b0 < 700 ? 800 : 844); await s.vanta(900); await s.bild("d-bytt");
  t = await s.tillstand(); s.logg("d) ny storlek:", t.raknare, t.text.slice(0, 40));
  const p = await s.js(`(() => { const r = document.querySelector(".newton-figur").getBoundingClientRect(), b = document.querySelector(".newton-bubbla").getBoundingClientRect(); return { fig: [r.left, r.top, r.right, r.bottom].map(Math.round), bub: [b.left, b.top, b.right, b.bottom].map(Math.round), vw: innerWidth, vh: innerHeight }; })()`);
  s.logg("d) Newton", JSON.stringify(p));
  await s.storlek(b0, h0); await s.vanta(900); await s.bild("d-tillbaka");
  const p2 = await s.js(`(() => { const r = document.querySelector(".newton-figur").getBoundingClientRect(), b = document.querySelector(".newton-bubbla").getBoundingClientRect(); return { fig: [r.left, r.top, r.right, r.bottom].map(Math.round), bub: [b.left, b.top, b.right, b.bottom].map(Math.round), vw: innerWidth, vh: innerHeight }; })()`);
  s.logg("d) tillbaka", JSON.stringify(p2));
  await s.vakt("b–d");
  // e) Till en film och rulla fort under filmens steg; sedan omladdning mitt i ett steg.
  await s.guide({ val: "hoppa", paus: 700, max: 12, efterSteg: async (t) => { if (t.vy === "vy-film" && /Linjen|kapitlen/.test(t.text)) { for (let k = 0; k < 12; k++) { await s.js(`scrollBy(0, ${k % 2 ? -400 : 600})`); await s.vanta(40); } } } });
  t = await s.tillstand(); s.logg("e) efter rullningen:", t.vy, t.raknare, t.text.slice(0, 40));
  await s.vanta(1500); await s.vakt("e) rullning");
  await s.omladda(); await s.vanta(1500);
  t = await s.tillstand(); s.logg("e) efter omladdning:", t.vy, t.guidar, t.syns);
  await s.vakt("e) omladdning");
};
