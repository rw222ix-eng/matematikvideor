// Scenario 3: guiden startad från olika ställen. URL i miljövariabeln START_FORE (js före starten).
export default async (s) => {
  const fore = process.env.FORE || "";
  if (fore) { const r = await s.js(fore); if (r !== undefined) s.logg("före:", JSON.stringify(r)); }
  if (process.env.FORE_KLICK) { for (const sel of process.env.FORE_KLICK.split("||")) { await s.pekPa(sel); await s.vanta(700); } }
  await s.vanta(+(process.env.FORE_VANTA || 500));
  let t = await s.tillstand(); s.logg("före starten:", t.vy, t.hash, "helskärm:", await s.js(`!!(document.fullscreenElement || document.querySelector(".duk.helskarm"))`), "sök:", await s.js(`document.getElementById("sok").classList.contains("oppen")`));
  if (process.env.START_JS) await s.js(process.env.START_JS); else await s.starta();
  await s.vanta(200);
  t = await s.tillstand(); s.logg("efter ?:", t.guidar, t.syns);
  await s.guide({ val: "hoppa", paus: 1500 });
  await s.vanta(5000);
  await s.vakt("start " + (process.env.NAMN || ""));
};
