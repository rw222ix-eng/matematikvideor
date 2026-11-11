// Vakten mot tystnad i Din tur (Rickard 2026-11-11: "det måste alltid hända något och det måste alltid stå vad
// som är fel eller vad som är rätt"). Går igenom varje film och varje del i public/videor.json som en elev:
// det rätta svaret, det första vanliga felet, tomt, skräp («hej», «???», bara «=») och två snabba Enter.
// Varje försök ska ge ett synligt besked under fältet, och det rätta svaret ska ge Rätt!. Slutkod 1 annars.
//
//   node verktyg/dintur-vakt.mjs                 sidan i public/, med en egen server
//   BAS=https://winterhalls-matte.pages.dev node verktyg/dintur-vakt.mjs      den utlagda sidan
//   ID=delos-och-altaret node verktyg/dintur-vakt.mjs                         bara en film
//   VAKT_PUBLIC=<mapp> node verktyg/dintur-vakt.mjs                                en annan kopia av public/
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(process.env.E2E || "file:///E:/Transkribera/e2e/");
const { chromium } = require("playwright");

const PUB = process.env.VAKT_PUBLIC || join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "public");
let BAS = (process.env.BAS || "").replace(/\/$/, ""), server = null;
if (!BAS) {
  const TYP = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
  server = createServer(async (q, s) => {
    let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
    try { const b = await readFile(join(PUB, p)); s.writeHead(200, { "content-type": TYP[extname(p)] || "application/octet-stream" }); s.end(b); }
    catch { s.writeHead(404); s.end(); }
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  BAS = `http://127.0.0.1:${server.address().port}`;
}
const filmer = (await (await fetch(`${BAS}/videor.json`)).json()).videor.filter((v) => v.dinTur && (!process.env.ID || v.id === process.env.ID));
// Svaret som en elev skriver det: tal med komma, flera lösningar med "och", av flera ord det första.
const somText = (x, del) => Array.isArray(x) ? (del.typ === "ord" ? String(x[0]) : x.map((y) => somText(y, del)).join(" och ")) : typeof x === "number" ? String(x).replace(".", ",") : String(x);
function forsok(del) {
  const ut = [];
  // Ett uttryck som ska faktoriseras har uppgiften som svar, och ett tal som ska delas upp har talet: där är svaret inte det eleven skriver.
  if (!del.utanfor && del.typ !== "faktorer") ut.push(["rätt", somText(del.svar, del)], ["rätt, två Enter", somText(del.svar, del), 2]);
  if (del.fel && del.fel[0]) ut.push(["vanligt fel", somText(del.fel[0].svar, del)]);
  ut.push(["tomt", ""], ["hej", "hej"], ["???", "???"], ["bara =", "="]);
  return ut;
}
const webb = await chromium.launch({ channel: "chrome", headless: !process.env.VISA });
const ctx = await webb.newContext({ viewport: { width: 1366, height: 768 } });
await ctx.addInitScript(() => { try { localStorage.setItem("tips", "av"); } catch { } });
const p = await ctx.newPage();
const jsFel = []; p.on("pageerror", (e) => jsFel.push(String(e)));
const tysta = [], inteRatt = [];
let antal = 0;
for (const v of filmer) {
  await p.goto(`${BAS}/#${v.id}`, { waitUntil: "domcontentloaded" });
  // Sidan byter film inne i en vyövergång: vänta tills den nya filmen står i titeln och dess fält finns, annars
  // fylls förra filmens fält i.
  await p.waitForFunction(([titel, n]) => document.title.startsWith(`${titel} · `) && document.querySelectorAll("#dintur-delar .del").length === n && !document.getElementById("dintur").hidden, [v.titel, v.dinTur.delar.length], { timeout: 30000 });
  await p.evaluate(() => { const v = document.querySelector("#duk video"); if (v) v.pause(); });
  for (let i = 0; i < v.dinTur.delar.length; i++) {
    const del = v.dinTur.delar[i];
    for (const [namn, svar, tryck = 1] of forsok(del)) {
      antal++;
      await p.evaluate((i) => { const t = document.getElementById(`del-text-${i}`); t.replaceChildren(); t.className = "del-svarstext"; }, i);
      await p.fill(`#del-svar-${i}`, svar);
      for (let k = 0; k < tryck; k++) { await p.focus(`#del-svar-${i}`); await p.keyboard.press("Enter"); }
      const r = await p.evaluate((i) => {
        const t = document.getElementById(`del-text-${i}`), b = t.getBoundingClientRect(), s = getComputedStyle(t);
        return { text: t.textContent.trim(), syns: b.height > 0 && s.visibility !== "hidden" && s.display !== "none" };
      }, i);
      const vem = `${v.id} del ${i + 1} (${del.typ}), ${namn}: ${JSON.stringify(svar)} → ${JSON.stringify(r.text)}`;
      if (!r.text || !r.syns) tysta.push(vem);
      else if (namn.startsWith("rätt") && !r.text.startsWith("Rätt")) inteRatt.push(vem);
      if (process.env.ALLT) console.log(vem);
    }
  }
}
await webb.close(); if (server) server.close();
console.log(`${filmer.length} filmer, ${antal} försök mot ${BAS}.`);
for (const [rubrik, lista] of [["Inget besked", tysta], ["Rätt svar som inte gav Rätt!", inteRatt], ["Fel i sidan", jsFel]]) {
  console.log(`${rubrik}: ${lista.length}`); lista.forEach((x) => console.log(`  ${x}`));
}
process.exit(tysta.length || inteRatt.length || jsFel.length ? 1 : 0);
