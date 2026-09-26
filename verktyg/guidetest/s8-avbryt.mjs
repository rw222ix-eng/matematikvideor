// Del 3: rörelserna avbryts direkt. Väntar tills han gör något medan han väntar, och då: a) Esc, b) Hoppa över,
// c) fliken döljs, d) eleven trycker på sidan, e) fönstret byter storlek.
export default async (s) => {
  const kl = () => s.js(`document.getElementById("newton").className`);
  const tillSteg = async () => { for (let k = 0; k < 10; k++) { const t = await s.vantaPaKnapp(); if (/Här ligger/.test(t.text)) return t; await s.vanta(450); await s.pekPa("#newton-knappar button"); await s.vanta(300); } };
  const vantaPaRorelse = async () => { for (let k = 0; k < 400; k++) { const c = await kl(); if (/gar-steg|ror/.test(c) && !/pratar/.test(c)) return c; await s.vanta(50); } return "ingen"; };
  const x = () => s.js(`Math.round(new DOMMatrixReadOnly(getComputedStyle(document.getElementById("newton")).transform).m41)`);
  // a) Esc mitt i en rörelse.
  await s.starta(); await tillSteg();
  let c = await vantaPaRorelse(); s.logg("a) rörelse:", c); await s.vanta(150);
  await s.tangent("Escape"); await s.vanta(4000); await s.vakt("a) Esc mitt i rörelsen");
  // b) Hoppa över mitt i en rörelse: nästa steg börjar som vanligt.
  await s.starta(); await tillSteg();
  c = await vantaPaRorelse(); s.logg("b) rörelse:", c, "x", await x()); await s.vanta(150);
  await s.pekPa("#newton-knappar button"); await s.vanta(80); s.logg("   direkt efter:", await kl(), "x", await x());
  let t = await s.vantaPaKnapp(); s.logg("   nästa steg:", t.raknare, t.text.slice(0, 40));
  // c) Fliken döljs mitt i en rörelse: inget ändras medan den är dold.
  c = await vantaPaRorelse(); s.logg("c) rörelse:", c);
  await s.js(`(() => { Object.defineProperty(document, "hidden", { get: () => true, configurable: true }); Object.defineProperty(document, "visibilityState", { get: () => "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); })()`);
  await s.vanta(200);
  await s.js(`window.__dold = []; new MutationObserver((ms) => ms.forEach((m) => __dold.push(m.attributeName + ":" + (m.target.id || m.target.className)))).observe(document.getElementById("newton"), { attributes: true, subtree: true })`);
  await s.vanta(12000);
  s.logg("   ändringar medan fliken var dold i 12 s:", JSON.stringify(await s.js("__dold.slice(0, 10)")), "klasser:", await kl());
  await s.js(`(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event("visibilitychange")); })()`);
  c = await vantaPaRorelse(); s.logg("   synlig igen, rörelse:", c);
  // d) Eleven trycker på sidan (tomt ställe) mitt i en rörelse: den slutar.
  c = await vantaPaRorelse(); s.logg("d) rörelse:", c); await s.vanta(100);
  await s.pek(30, 120); await s.vanta(60); s.logg("   efter trycket:", await kl());
  // e) Storleksbyte mitt i en rörelse.
  c = await vantaPaRorelse(); s.logg("e) rörelse:", c);
  const [b0, h0] = [s.bredd, s.hojd]; await s.storlek(b0 < 700 ? 1280 : 390, b0 < 700 ? 800 : 844); await s.vanta(700);
  s.logg("   efter storleksbytet:", await kl(), JSON.stringify(await s.js(`(() => { const r = document.querySelector("#newton .newton-figur").getBoundingClientRect(), b = document.querySelector("#newton .newton-bubbla").getBoundingClientRect(); return [innerWidth, innerHeight, [r.left, r.top, r.right, r.bottom].map(Math.round), [b.left, b.top, b.right, b.bottom].map(Math.round)]; })()`)));
  await s.storlek(b0, h0); await s.vanta(700);
  await s.tangent("Escape"); await s.vanta(4000);
  await s.vakt("b–e");
};
