// Scenario 1a: dubbel-/trippelklick på Nästa och Hoppa över inom 30–80 ms. Loggar vad klicken som går
// igenom träffar (vyn, adressen) och om räknaren hoppar.
export default async (s) => {
  await s.js(`window.__traffar = []; addEventListener("click", (e) => __traffar.push((e.target.closest("[id]") || {}).id + " " + (e.target.className || e.target.nodeName)), true)`);
  await s.starta();
  let forra = null;
  for (let i = 0; i < 45; i++) {
    const t = await s.vantaPaKnapp();
    if (!t.guidar) { s.logg("guiden slut"); break; }
    // En bubbla utan räknare är inget steg (Newtons väntan under Visa allt har bara Avsluta, 2026-11-26).
    // vantaPaKnapp väntar ut den, men gick tiden ut hoppar manuset över den i stället för att trycka på nth-child(0).
    if (!t.raknare) { s.logg(`  bubbla utan räknare, hoppas över: ${t.knappar.join("|")} ${t.text.slice(0, 50)}`); await s.vanta(300); continue; }
    const [n, N] = t.raknare.split("/").map(Number);
    s.logg(`  ${t.raknare.padEnd(5)} ${t.vy} ${t.hash.slice(0, 26).padEnd(26)} ${t.knappar.join("|").padEnd(22)} ${t.text.slice(0, 60)}${forra && forra.N === N && n !== forra.n + 1 ? `  RÄKNAREN HOPPADE ${forra.n} → ${n}` : ""}`);
    forra = { n, N };
    const knapp = t.knappar.includes("Nästa") ? "Nästa" : t.knappar.includes("Klar") ? "Klar" : t.knappar.includes("Visa resten") ? "Visa resten" : "Hoppa över";
    await s.vanta(450); const p = t.knappar.includes(knapp) ? await s.mitt(`#newton-knappar button:nth-child(${t.knappar.indexOf(knapp) + 1})`) : null;
    if (!p) { s.logg(`  FASTNAT: hittar inte ${knapp} i ${t.knappar.join("|")}`); break; }
    const antal = i % 3 === 2 ? 3 : 2, gap = 30 + (i * 17) % 51;
    await s.js(`__traffar = []; __vakt.tryck.length = 0`);
    for (let k = 0; k < antal; k++) { await s.pek(p[0], p[1]); if (k < antal - 1) await s.vanta(gap); }
    await s.vanta(400);
    const tr = await s.js(`__traffar.slice()`);
    const ner = await s.js(`__vakt.tryck.filter((r) => r[0] === "pointerdown" && r[1]).map((r) => r[3])`);
    const avst = ner.slice(1).map((t, j) => t - ner[j]);
    const efter = await s.tillstand();
    s.logg(`     ${antal}× ${knapp} (${gap} ms, verkligen ${avst.join("/")} ms) → träffar: ${tr.join(" / ")}  vy nu ${efter.vy} ${efter.hash}`);
    if (knapp === "Klar") break;
    await s.vanta(1800);
  }
  await s.vanta(5000);
  await s.vakt("dubbelklick");
};
