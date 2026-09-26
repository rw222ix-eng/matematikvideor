// Helskärmssteget och Visa allt (Rickard 2026-09-26): syns Newton i helskärm, och står Din tur still medan
// texten skrivs fram? Och kan eleven rulla själv under tiden?
export default async (s) => {
  const lage = () => s.js(`(() => { const n = document.getElementById("newton"), f = n.querySelector(".newton-figur").getBoundingClientRect(), b = n.querySelector(".newton-bubbla").getBoundingClientRect(), k = document.getElementById("duk-hel").getBoundingClientRect();
    const inne = (r) => r.left >= -2 && r.top >= -2 && r.right <= innerWidth + 2 && r.bottom <= innerHeight + 2;
    return { akta: !!document.fullscreenElement, lager: n.matches(":popover-open"), klass: document.body.classList.contains("guide-helskarm"), synlig: !n.hidden && getComputedStyle(n).display !== "none", figInne: inne(f), bubInne: inne(b), overKnappen: f.bottom > k.top && f.right > k.left && f.left < k.right, text: n.querySelector("#newton-text .sr").textContent.slice(0, 50) }; })()`);
  await s.starta();
  for (let k = 0; k < 20; k++) { const t = await s.vantaPaKnapp(); if (/större/.test(t.text)) break; await s.vanta(450); await s.pekPa("#newton-knappar button"); await s.vanta(300); }
  await s.vanta(2500);
  await s.pekPa("#duk-hel"); await s.vanta(2000);
  s.logg("a) i helskärm:", JSON.stringify(await lage()));
  await s.bild("helskarm");
  await s.pekPa("#duk-hel"); await s.vanta(600);
  let t = await s.tillstand(); s.logg("a) ut ur helskärm:", t.text.slice(0, 40), JSON.stringify(await s.js(`[!!document.fullscreenElement, document.getElementById("newton").matches(":popover-open"), document.body.classList.contains("guide-helskarm")]`)));
  t = await s.vantaPaKnapp(); s.logg("a) nästa steg:", t.raknare, t.text.slice(0, 40));
  // b) Visa allt
  for (let k = 0; k < 10; k++) { t = await s.vantaPaKnapp(); if (/Visa allt som sägs/.test(t.text)) break; await s.vanta(450); await s.pekPa("#newton-knappar button"); await s.vanta(300); }
  await s.vanta(1500); await s.pekPa("#visa-allt");
  const toppar = []; let rullat = false;
  for (let k = 0; k < 45; k++) {
    const r = await s.js(`({ t: Math.round(document.getElementById("dintur").getBoundingClientRect().top), steg: (document.querySelector("#newton-text .sr") || {}).textContent.slice(0, 12), skriver: document.getElementById("helatext").classList.contains("skriver"), y: Math.round(scrollY) })`);
    if (/^Sist i varje/.test(r.steg)) toppar.push(r.t);
    // En gång mitt i: eleven rullar själv (hjulet) uppåt. Då ska sidan inte dras tillbaka.
    if (!rullat && toppar.length === 6 && r.skriver) { rullat = true; if (s.telefon) await s.dra(200, 250, 200, 650, 12); else await s.skicka("Input.dispatchMouseEvent", { type: "mouseWheel", x: 400, y: 400, deltaX: 0, deltaY: -600 }); await s.vanta(700); const y2 = await s.js("Math.round(scrollY)"); s.logg(`b) eleven rullade upp (${s.telefon ? "finger" : "hjul"}): scrollY ${r.y} → ${y2}`); await s.vanta(1500); s.logg("b) 1,5 s senare:", await s.js("Math.round(scrollY)")); break; }
    await s.vanta(250);
  }
  s.logg("b) Din tur överkant medan texten skrevs:", JSON.stringify(toppar));
  await s.vakt("hel + allt");
};
