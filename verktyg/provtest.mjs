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
  }
  const nasta = k.prov.find((p) => p.datum >= dag);
  console.log(`${k.namn.padEnd(6)} ${nasta ? `${nasta.datum} ${nasta.namn}, ${nasta.kurs}, ${nasta.kapitel}: ${nasta.filmer.filter((id) => finns.has(id)).length} filmer` : "inga fler prov"}`);
}
if (fel.length) { console.log(`\n${fel.length} fel:\n${fel.join("\n")}`); process.exit(1); }
console.log(`\nprov.json: ${prov.klasser.length} klasser, ${prov.klasser.reduce((s, k) => s + k.prov.length, 0)} prov, alla filmer finns.`);
