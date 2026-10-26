// Prov på public/prov.json, fliken Inför provet (Rickard 2026-10-18): varje film finns i videor.json,
// datumen är riktiga och står i ordning, och ingen film står två gånger i samma prov. Skriver också
// ut klassernas nästa prov i dag, som fliken visar dem.
//
//   node verktyg/provtest.mjs              kontrollen och nästa prov i dag
//   node verktyg/provtest.mjs 2026-11-20   nästa prov som det ser ut den dagen
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HÄR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prov = JSON.parse(readFileSync(join(HÄR, "public", "prov.json"), "utf8"));
const videor = JSON.parse(readFileSync(join(HÄR, "public", "videor.json"), "utf8")).videor;
const finns = new Set(videor.map((v) => v.id));
const fel = [];
// Sidans egen kod för filmerna till ett prov (med reglerna i "auto"), ur public/index.html.
const html = readFileSync(join(HÄR, "public", "index.html"), "utf8");
const a = html.indexOf("  const autoTraff = "), b = html.indexOf('  // "tors 19 nov"', a);
if (a < 0 || b < 0) throw new Error("hittar inte autoTraff … provFilmer i index.html");
const medVideor = (lista) => new Function("videor", `${html.slice(a, b)}\nreturn { provFilmer, autoTraff };`)(lista);
const { provFilmer } = medVideor(videor);
// Påhittade nya filmer ska hamna rätt: en ny k4-film efter k4-06, en ny Ma 2a 09 efter Ma 2a 08 i IndA:s
// nationella prov, och Franklin (k4-05) aldrig i TE:s prov 4, som inte tar upp exponentialfunktioner.
{
  // ma2a-08b: en tilläggsfilm med bokstav efter numret (som ma2a-03b-nollproduktmetoden, som regeln missade 18/10).
  const nya = [...videor, { id: "ma1c-k4-07-prov" }, { id: "ma2a-09-prov" }, { id: "ma2c-k1-01-prov" }, { id: "ma2a-08b-prov" }];
  const { provFilmer: pf } = medVideor(nya);
  const hitta = (k, datum) => pf(prov.klasser.find((x) => x.namn === k).prov.find((p) => p.datum === datum)).map((v) => v.id);
  const na = hitta("NA26F", "2026-11-19"), te = hitta("TE26A", "2026-12-09"), np = hitta("IndA", "2027-05-19"), ind3 = hitta("IndA", "2027-02-16"), m2c = hitta("NA26F", "2027-03-08");
  // Malthus (k4-06) står på Ma 2c-hyllan sedan 2026-10-26 och är "utom" i Ma 1c-proven, så en ny k4-film hamnar efter k4-05.
  if (na.indexOf("ma1c-k4-07-prov") !== na.indexOf("ma1c-k4-05-exponentialfunktioner") + 1) fel.push("prov: ny k4-film hamnar inte efter k4-05 i NA26F prov 2");
  const malthus = "ma1c-k4-06-grafisk-ekvationslosning";
  for (const k of prov.klasser) for (const p of k.prov) {
    const med = pf(p).some((v) => v.id === malthus);
    if (p.kurs === "Matematik 1c" && med) fel.push(`prov: Malthus (Ma 2c) står i ${k.namn} ${p.namn} ${p.datum}, ett Ma 1c-prov`);
    if (p.kurs === "Matematik 2c" && /exponentialekvationer/.test(p.innehall) && !med) fel.push(`prov: Malthus saknas i ${k.namn} ${p.namn} ${p.datum}`);
  }
  if (!te.includes("ma1c-k4-07-prov") || te.includes("ma1c-k4-05-exponentialfunktioner")) fel.push("prov: TE26A prov 4 tar inte ny k4-film, eller tar med k4-05");
  if (np.indexOf("ma2a-08b-prov") !== np.indexOf("ma2a-08-substitution-och-addition") + 1) fel.push("prov: Ma 2a 08b hamnar inte direkt efter 08 i IndA:s nationella prov");
  if (np.indexOf("ma2a-09-prov") !== np.indexOf("ma2a-08b-prov") + 1) fel.push("prov: Ma 2a 09 hamnar inte efter 08b i IndA:s nationella prov");
  if (!hitta("IndA", "2026-12-14").includes("ma2a-08b-prov")) fel.push("prov: Ma 2a 08b saknas i IndA prov 2 (regeln ma2a-05..08)");
  if (ind3[0] !== "ma2a-09-prov" && ind3.indexOf("ma2a-09-prov") !== ind3.findIndex((x) => x.startsWith("formelbladet-")) - 1) fel.push(`prov: Ma 2a 09 hamnar fel i IndA prov 3: ${ind3.join(", ")}`);
  if (!m2c.includes("ma2c-k1-01-prov") || m2c.indexOf("ma2c-k1-01-prov") > m2c.findIndex((x) => x.startsWith("formelbladet-"))) fel.push("prov: ny Ma 2c-film saknas eller står efter formelbladet i NA26F prov 4");
}
const dag = process.argv[2] || new Date().toISOString().slice(0, 10);

for (const k of prov.klasser) {
  if (!/^[A-Za-z0-9]+$/.test(k.namn)) fel.push(`${k.namn}: klassnamnet ska vara bara bokstäver och siffror`);
  let fore = "";
  for (const p of k.prov) {
    const var_ = `${k.namn} ${p.namn} ${p.datum}`;
    const d = new Date(`${p.datum}T12:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.datum) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== p.datum) fel.push(`${var_}: datumet ska vara ÅÅÅÅ-MM-DD`);
    if (p.datum <= fore) fel.push(`${var_}: datumet står inte efter förra provet (${fore})`);
    fore = p.datum;
    for (const f of ["namn", "kurs", "kapitel"]) if (!p[f]) fel.push(`${var_}: saknar ${f}`);
    if (!Array.isArray(p.filmer) || !p.filmer.length) fel.push(`${var_}: inga filmer`);
    const sett = new Set();
    for (const id of p.filmer || []) {
      if (!finns.has(id)) fel.push(`${var_}: filmen ${id} finns inte i videor.json`);
      if (sett.has(id)) fel.push(`${var_}: ${id} står två gånger`);
      sett.add(id);
    }
    for (const r of p.auto || []) if (!/^[a-z0-9]+(-k\d+|-\d+\.\.\d+)$/.test(r)) fel.push(`${var_}: regeln ${r} ska se ut som ma1c-k4 eller ma2a-09..13`);
    const tillagda = provFilmer(p).map((v) => v.id).filter((id) => !p.filmer.includes(id));
    if (tillagda.length) console.log(`  ${var_}: kommer med av sig själva: ${tillagda.join(", ")}`);
  }
  const nasta = k.prov.find((p) => p.datum >= dag);
  console.log(`${k.namn.padEnd(6)} ${nasta ? `${nasta.datum} ${nasta.namn}, ${nasta.kurs}, ${nasta.kapitel}: ${provFilmer(nasta).length} filmer` : "inga fler prov"}`);
}
if (fel.length) { console.log(`\n${fel.length} fel:\n${fel.join("\n")}`); process.exit(1); }
console.log(`\nprov.json: ${prov.klasser.length} klasser, ${prov.klasser.reduce((s, k) => s + k.prov.length, 0)} prov, alla filmer finns.`);
