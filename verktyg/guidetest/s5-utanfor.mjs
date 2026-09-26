// Del 2: klick/tryck utanför bubblan. Riktiga klick (dator) och tryck (telefon).
const ANV = "a, button, input, textarea, select, label, summary, [role=button], [role=tab], [role=slider], [role=menuitemradio], [contenteditable], [tabindex]:not([tabindex='-1']), [data-t], [data-film], [data-sok], [data-forslag], [data-tecken], #duk, #sok, .post, .hjalp";
export default async (s) => {
  // En punkt där inget går att använda och som inte är Newton eller bubblan (och inte strålkastarens hål).
  const tomPunkt = () => s.js(`(() => { const n = document.getElementById("newton");
    for (let y = 90; y < innerHeight - 40; y += 23) for (let x = 20; x < innerWidth - 20; x += 29) {
      const e = document.elementFromPoint(x, y); if (!e || n.contains(e) || e.closest(${JSON.stringify(ANV)})) continue;
      const b = n.querySelector(".newton-bubbla").getBoundingClientRect(); if (x > b.left - 20 && x < b.right + 20 && y > b.top - 20 && y < b.bottom + 20) continue;
      return [x, y, e.id || e.className || e.nodeName];
    } return null; })()`);
  const las = async () => { const t = await s.tillstand(); return `${t.raknare} klar:${t.klar} ${t.knappar.join("|")} ${t.text.slice(0, 36)}`; };
  const vantaKlar = async () => { for (let k = 0; k < 80; k++) { const t = await s.tillstand(); if (t.klar && t.knappar.length) return; await s.vanta(100); } };
  await s.starta();
  let t = await s.vantaPaKnapp(); await s.vanta(250);
  let p = await tomPunkt(); s.logg("tom punkt:", JSON.stringify(p));
  // 1. Hej (Nästa), texten skrivs: första klicket skriver klart, samma steg.
  await s.pek(p[0], p[1]); await s.vanta(120); s.logg("1 klick medan texten skrivs →", await las());
  // 2. Ett klick till (efter 600 ms): nästa steg.
  await s.vanta(600); p = await tomPunkt(); await s.pek(p[0], p[1]); await s.vanta(300); s.logg("2 klick när texten är klar →", await las());
  // 3. Tidslinjen (uppgift): texten klar, klick utanför → inget.
  t = await s.vantaPaKnapp(); await vantaKlar(); p = await tomPunkt(); await s.pek(p[0], p[1]); await s.vanta(900); s.logg("3 klick utanför i en uppgift →", await las());
  // Klick i bubblans text och på Newton → inget.
  await s.klickPa("#newton-text"); await s.vanta(500); s.logg("  klick i bubblan →", await las());
  await s.pekPa("#newton .newton-figur"); await s.vanta(500); s.logg("  tryck på Newton →", await las());
  await s.pekPa("#newton-knappar button"); // Hoppa över
  // 4. Flikarna (uppgift): tryck på fliken medan texten skrivs → skriver klart + byter flik = uppgiften gjord.
  t = await s.vantaPaKnapp(/Det finns också/); await s.vanta(200);
  await s.pekPa("#flikar [aria-selected='false']"); await s.vanta(200); s.logg("4 tryck på fliken medan texten skrivs →", await las());
  t = await s.vantaPaKnapp(/förstoringsglaset/); s.logg("  sedan", t.raknare, t.text.slice(0, 40));
  // 5. Drag (> 8 px) utanför på ett informationssteg ska inte räknas: börja om guiden och dra i Hej-steget.
  await s.tangent("Escape"); await s.vanta(900); await s.js("scrollTo(0, 0)");
  await s.starta(); t = await s.vantaPaKnapp(/Hej/); await vantaKlar(); p = await tomPunkt();
  await s.dra(p[0], p[1], p[0] + 30, p[1] + 4); await s.vanta(500); s.logg("5 drag 30 px utanför →", await las());
  // 6. Snabbt dubbelklick utanför när texten är klar: ETT steg framåt.
  await s.pek(p[0], p[1]); await s.vanta(45); await s.pek(p[0], p[1]); await s.vanta(80); await s.pek(p[0], p[1]);
  await s.vanta(1500); t = await s.vantaPaKnapp(); s.logg("6 trippelklick utanför (45/80 ms) →", await las(), t.hash);
  await s.vakt("utanför");
};
