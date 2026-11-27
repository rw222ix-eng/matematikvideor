// Snuttarna i Din tur (Rickards val 2026-11-27): räknar ut varje films snutt med sidans egen snuttFor() ur
// public/index.html och skriver listan. Slutkod 1 när en film med Din tur saknar snutt, eller när en snutt är
// kortare än 8 s eller längre än 125 s. Då behöver ledtrad.till i dintur.json en fras (README, dintur.json).
//   node verktyg/snuttar.mjs           alla filmer
//   node verktyg/snuttar.mjs --kort    bara felen
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HÄR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(HÄR, "public", "index.html"), "utf8");
const videor = JSON.parse(readFileSync(join(HÄR, "public", "videor.json"), "utf8")).videor;
const a = html.indexOf("  var SNUTT_MAX = "), b = html.indexOf("  function snuttTid(", a);
const c = html.indexOf("\n", b);
if (a < 0 || b < 0) throw new Error("hittar inte SNUTT_MAX … snuttTid i index.html");
const tid = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const { snuttFor, snuttTid } = new Function("tid", `${html.slice(a, c)}\nreturn { snuttFor, snuttTid };`)(tid);
const fel = [];
for (const v of videor) {
  if (!v.dinTur) continue;
  const s = snuttFor(v), lt = v.dinTur.ledtrad || {};
  const langd = s ? Math.round(s.slut - s.fran) : 0;
  const problem = !s ? "ingen snutt" : langd < 8 ? "för kort" : langd > 125 ? "för lång" : "";
  if (problem) fel.push(`${v.id}: ${problem}`);
  if (problem || !process.argv.includes("--kort")) console.log(`${problem ? "FEL " : "    "}${v.id.padEnd(40)} ${s ? snuttTid(s).padEnd(12) : "-".padEnd(12)} ${String(langd).padStart(4)} s  ${lt.till != null ? "till " : "     "}${s ? s.rubrik : ""}`);
}
console.log(fel.length ? `\n${fel.length} fel` : "\nalla snuttar 8–125 s");
process.exit(fel.length ? 1 : 0);
