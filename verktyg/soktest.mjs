// Prov på sökningen: kör sidans egen sökkod (ur public/index.html) mot frågor som elever skriver,
// och kontrollerar att rätt film kommer först. Rickard 2026-10-05: "den behöver faktiskt ta fram
// den absolut mest relevanta filmen baserat på vad man söker på".
//
//   node verktyg/soktest.mjs            alla frågor, en rad var, och summan
//   node verktyg/soktest.mjs "fråga"    de fem första träffarna för en fråga, med poäng
//
// Varje fråga har en eller flera filmer som räknas som rätt förstaträff.
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HÄR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(HÄR, "public", "index.html"), "utf8");
const data = JSON.parse(readFileSync(join(HÄR, "public", "videor.json"), "utf8"));
const bit = (fran, till) => {
  const a = html.indexOf(fran), b = html.indexOf(till, a);
  if (a < 0 || b < 0) throw new Error(`hittar inte ${fran} … ${till} i index.html`);
  return html.slice(a, b);
};
const kod = [
  bit("const UPPH = ", "\n", 0) + "\n",
  bit("const norm = ", "\n") + "\n",
  bit("  const fold = ", "  // Ett kort utdrag"),
  bit("  let ORDLISTA = null;", "  // \"Sök ändå på"),
  "return { sok, rattaStavning };",
].join("\n");
const { sok: sokOrdagrant, rattaStavning } = new Function("videor", kod)(data.videor);
// Som ritaSok() på sidan: ett stavfel rättas, och rättningen används när den ger träffar.
function sok(fraga) {
  const r = sokOrdagrant(fraga), ratt = rattaStavning(fraga), r2 = ratt && sokOrdagrant(ratt);
  return r2 && r2.res.length && (!r.res.length || r.narmast || !r2.narmast) ? { ...r2, rattat: ratt } : r;
}

const K = {
  sincos: "ma1c-k6-01-sinus-cosinus-tangens", sidor: "ma1c-k6-02-berakna-sidor", vinklar: "ma1c-k6-03-berakna-vinklar",
  vbegr: "ma1c-k6-04-vektorbegreppet", vadd: "ma1c-k6-05-addera-vektorer", vkoord: "ma1c-k6-06-vektorer-i-koordinatform",
  delos: "delos-och-altaret", ark: "arkimedes-och-cirkeln", viete: "viete-och-chiffret", galilei: "galilei-och-rannan",
  kepler: "kepler-och-planeterna", harrison: "harrison-och-longituden",
  fb1: "formelbladet-1-prefix-och-potenser", fb2: "formelbladet-2-funktioner", fb3: "formelbladet-3-plan-geometri",
  fb4: "formelbladet-4-rymdgeometri-och-skala", fb5: "formelbladet-5-pythagoras-trigonometri-vektorer",
  m21: "formelbladet-ma2-1-algebra", m22: "formelbladet-ma2-2-andragradsfunktionen", m23: "formelbladet-ma2-3-logaritmer",
  m24: "formelbladet-ma2-4-likformighet", m25: "formelbladet-ma2-5-vinklar-och-cirkelsatser", m26: "formelbladet-ma2-6-statistik",
  kvadr: "ma2a-01-kvadreringsreglerna", fakt: "ma2a-02-faktorisera", nollp: "ma2a-03-x2-och-nollprodukt", pq: "ma2a-04-pq-formeln",
  esys: "ma2a-07-ekvationssystem-grafiskt", k201: "ma1c-k2-01-linjara-ekvationer", k202: "ma1c-k2-02-formler-och-modeller",
  k401: "ma1c-k4-01-funktioner", k402: "ma1c-k4-02-linjara-samband", k403: "ma1c-k4-03-rata-linjens-ekvation",
  k404: "ma1c-k4-04-potensfunktioner", k405: "ma1c-k4-05-exponentialfunktioner", k406: "ma1c-k4-06-grafisk-ekvationslosning",
};
// [fråga, rätta förstaträffar]
const PROV = [
  ["sinus", "sincos"], ["cosinus", "sincos"], ["tangens", "sincos"], ["vad är sinus", "sincos"], ["hypotenusa", "sincos"],
  ["trigonometri", "sincos fb5"], ["motstående katet", "sincos"],
  ["hur räknar man ut en vinkel i en rätvinklig triangel", "vinklar"], ["räkna ut vinkeln", "vinklar"], ["beräkna vinklar", "vinklar"],
  ["arcustangens", "vinklar"], ["sin^-1", "vinklar"], ["tan-1", "vinklar"],
  ["beräkna en sida i en triangel", "sidor"], ["räkna ut sidan i en rätvinklig triangel", "sidor"], ["hur lång är hypotenusan", "sidor sincos"],
  ["pythagoras sats", "fb5"], ["pythagoras", "fb5"],
  ["vektor", "vbegr"], ["vad är en vektor", "vbegr"], ["resultant", "vbegr"], ["addera vektorer", "vadd vbegr"],
  ["vektorer i koordinatform", "vadd"], ["längden av en vektor", "vkoord"], ["vinkeln mellan två vektorer", "vkoord"],
  ["olikheter", "ark"], ["lösa olikheter", "ark"], ["olikhetstecken", "ark"], ["intervall", "harrison"], ["öppet intervall", "harrison"],
  ["potensekvation", "delos"], ["potensekvationer", "delos"], ["x^3 = 8", "delos"], ["tredje roten", "delos kepler"],
  ["bråk i exponenten", "kepler"], ["potenser med bråk", "kepler"], ["keplers lag", "kepler"],
  ["faktorisera", "viete fakt"], ["bryta ut", "viete fakt"], ["utveckla parenteser", "viete"], ["multiplicera in", "viete"],
  ["mönster", "galilei"], ["formel för tal nummer n", "galilei"], ["talföljd", "galilei"],
  ["kvadreringsreglerna", "kvadr"], ["kvadreringsregeln", "kvadr"], ["konjugatregeln", "kvadr"], ["(a+b)^2", "kvadr"],
  ["pq-formeln", "pq"], ["pq formeln", "pq"], ["andragradsekvation", "nollp pq"], ["nollproduktmetoden", "nollp"], ["x^2 = 25", "nollp"],
  ["prefix", "fb1"], ["tiopotenser", "fb1 m23"], ["potensregler", "fb1"],
  ["räta linjens ekvation", "k403"], ["k-värde", "k402 k403"], ["exponentialfunktion", "k405"], ["förändringsfaktor", "k405 fb2"],
  ["area av en cirkel", "fb3"], ["cirkelsektor", "fb3"], ["omkrets", "fb3"], ["parallelltrapets", "fb3"],
  ["volym av en kon", "fb4"], ["volym", "fb4"], ["skala", "fb4"], ["areaskala", "fb4"],
  ["abc-formeln", "m21"],
  ["parabel", "m22"], ["symmetrilinje", "m22"], ["mittpunktsformeln", "m22"], ["avståndsformeln", "m22"], ["vinkelräta linjer", "m22"],
  ["logaritmer", "m23"], ["lg", "m23"], ["exponentialekvation", "m23"],
  ["likformighet", "m24"], ["likformiga trianglar", "m24"], ["topptriangelsatsen", "m24"],
  ["randvinkelsatsen", "m25"], ["vinkelsumma", "m25"], ["yttervinkelsatsen", "m25"], ["vinklar i en månghörning", "m25"],
  ["normalfördelning", "m26"], ["lådagram", "m26"], ["standardavvikelse", "m26"], ["median", "m26"], ["kvartil", "m26"],
];

// Kontrollfrågor, skrivna efter att vikterna satts (2026-10-05): de visar om sökningen klarar
// frågor den inte är inställd efter. Räknas för sig.
const KONTROLL = [
  ["vad betyder cos", "sincos"], ["sin cos tan", "sincos"], ["kvoten mellan sidorna", "sincos"], ["närliggande katet", "sincos"],
  ["hur högt är berget", "sidor"], ["räkna ut höjden med tangens", "sidor"], ["lutande tornet", "vinklar"], ["hur mycket lutar tornet", "vinklar"],
  ["den andra vinkeln", "vinklar"], ["kraft och resultant", "vbegr"], ["motsatt vektor", "vbegr"],
  ["komposanter", "vadd"], ["basvektorer", "vadd"], ["avstånd till titanic", "vkoord"], ["x^3 = 2", "delos"], ["dubbelt så stor kub", "delos"],
  ["vända olikhetstecknet", "ark"], ["tallinje med intervall", "harrison"], ["hakparentes", "harrison"], ["gemensam faktor", "viete fakt"],
  ["n:te talet i en talföljd", "galilei"], ["kvadrattal", "galilei"], ["omloppstid planet", "kepler"], ["upphöjt till en tredjedel", "kepler delos"],
  ["48 i kvadrat", "kvadr"], ["dubbla produkten", "kvadr"], ["faktorisera med konjugatregeln", "fakt"], ["två lösningar roten ur", "nollp"],
  ["fritt fall", "nollp"], ["ingen lösning andragradsekvation", "pq nollp"], ["al-khwarizmi", "pq"], ["halva p", "pq"],
  ["kilo mega giga", "fb1"], ["y = kx + m", "k403 k402"], ["ränta", "k405 fb2 m23"], ["mantelarea cylinder", "fb4"], ["klotets volym", "fb4"],
  ["kordasatsen", "m25"], ["sannolikhet normalfördelning", "m26"],
];
// De nya filmerna (2026-10-05).
const NYA = [
  ["linjära ekvationer", "k201"], ["balansmetoden", "k201"], ["ekvation med parentes", "k201"],
  ["lösa ut en variabel", "k202"], ["formler och modeller", "k202"], ["sätta in i en formel", "k202"],
  ["definitionsmängd", "k401"], ["värdemängd", "k401"], ["vad är en funktion", "k401"],
  ["linjära samband", "k402"], ["m-värde", "k402 k403"], ["potensfunktion", "k404"], ["exponentialfunktioner", "k405"],
  ["grafisk ekvationslösning", "k406"], ["matematisk modell", "k406 k202"], ["ekvationssystem", "esys"], ["skärningspunkt", "esys k406"],
];
// Stavfel (Rickard 2026-10-05: "det borde finnas automatiska rättningar om eleverna råkar skriva fel").
const STAVFEL = [
  ["mönter", "galilei"], ["olikhter", "ark"], ["pytagoras", "fb5"], ["sinnus", "sincos"], ["kosinus", "sincos"], ["tagnens", "sincos"],
  ["kvadreringsreggeln", "kvadr"], ["konjugatregen", "kvadr"], ["logaritmr", "m23"], ["vektorr", "vbegr"], ["andragradsekvaton", "nollp pq"],
  ["paraboll", "m22"], ["normalfordelning", "m26"], ["likformihet", "m24"], ["exponetialfunktion", "k405"], ["ekvationsystem", "esys"],
  ["intervalll", "harrison"], ["potensekvatoin", "delos"], ["faktoriser", "viete fakt"], ["hypotenussa", "sincos sidor"],
];

const fraga = process.argv[2];
if (fraga) {
  const { res, narmast, rattat } = sok(fraga);
  if (rattat) console.log(`(rättat till: ${rattat})`);
  if (narmast) console.log("(närmast — inget ställe har alla orden)");
  for (const r of res.slice(0, 5)) console.log(String(Math.round(r.poang)).padStart(6), r.v.id, r.stallen[0] ? `@${r.stallen[0].t}` : "");
  process.exit(0);
}
function prova(lista, namn) {
let ratt = 0;
const fel = [];
for (const [q, svar] of lista) {
  const ok = svar.split(" ").map((k) => K[k]);
  const { res } = sok(q);
  const forst = res[0] ? res[0].v.id : "(inget)";
  const plats = res.findIndex((r) => ok.includes(r.v.id));
  if (ok.includes(forst)) ratt++;
  else fel.push(`  ${q.padEnd(52)} först: ${forst.padEnd(48)} rätt film på plats ${plats < 0 ? "–" : plats + 1}`);
}
console.log(`${namn}: ${ratt} av ${lista.length} rätt först.`);
if (fel.length) console.log(fel.join("\n"));
}
prova(PROV, "Frågorna");
prova(KONTROLL, "Kontrollfrågorna");
prova(NYA, "De nya filmerna");
prova(STAVFEL, "Stavfelen");
