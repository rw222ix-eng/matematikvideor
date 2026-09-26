// Filmkort under guiden och bakåt direkt (300 ms), medan guiden väntar på att filmen ska laddas.
export default async (s) => {
  const kort = "#spar .post:not(.kommer):not(.bro) button[data-film]";
  await s.js(`window.__vfel = []; const f = console.error; console.error = (...a) => { __vfel.push(a.join(" ")); f(...a); }`);
  await s.starta();
  let t = await s.vantaPaKnapp(); await s.vanta(500); await s.pekPa("#newton-knappar button");
  t = await s.vantaPaKnapp(/Här ligger/); await s.vanta(600);
  await s.pekPa(kort); await s.vanta(300); await s.js("history.back()");
  for (let k = 0; k < 8; k++) { await s.vanta(1000); t = await s.tillstand(); s.logg(`+${k + 1} s:`, t.vy, t.hash, "guidar:", t.guidar, "syns:", t.syns, "talar:", t.talar, t.raknare, t.text.slice(0, 40)); }
  await s.vakt("bakåt");
};
