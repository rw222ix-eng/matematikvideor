/**
 * Huvudena hos Cloudflare Pages (flytten 2026-11-07). verktyg/huvuden.json är källan, och public/_headers skrivs ur den vid
 * varje publicering, så att policyn inte står på ett ställe till.
 *
 * _headers har ingen «allt utom», och två regler för samma huvud slås ihop med komma. Därför tar /omslag/* bort
 * Cross-Origin-Resource-Policy från /* med en !-rad innan den sätter sitt eget värde, och /spel/* tar bort sidans
 * Content-Security-Policy innan spelens egen (SPEL_CSP i csp.mjs) sätts. /inlogg/* gör likadant med sin policy (INLOGG_CSP)
 * och med Cross-Origin-Opener-Policy, som Googles inloggningsfönster kräver som same-origin-allow-popups.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const VAG = { "/(.*)": "/*", "/((?!omslag/).*)": "/*", "/videor.json": "/videor.json", "/app.(.*).js": "/app.*", "/omslag/(.*)": "/omslag/*", "/spel/(.*)": "/spel/*", "/inlogg/(.*)": "/inlogg/*" };
// Huvuden som en regel tar bort från /* innan den sätter sitt eget värde.
const BORT = { "/omslag/*": ["Cross-Origin-Resource-Policy"], "/spel/*": ["Content-Security-Policy"], "/inlogg/*": ["Content-Security-Policy", "Cross-Origin-Opener-Policy"] };

export function huvudText(huvuden) {
  const regler = new Map();
  for (const r of huvuden.headers) {
    const vag = VAG[r.source];
    if (!vag) throw new Error(`cloudflare.mjs känner inte regeln ${r.source} i verktyg/huvuden.json. Lägg den i VAG.`);
    const rader = regler.get(vag) ?? [];
    for (const h of r.headers) {
      if (BORT[vag]?.includes(h.key)) rader.push(`  ! ${h.key}`);
      rader.push(`  ${h.key}: ${h.value}`);
    }
    regler.set(vag, rader);
  }
  for (const [vag, rader] of regler) for (const rad of rader) if (rad.length > 2000) throw new Error(`Ett huvud i ${vag} är över 2 000 tecken, Cloudflares gräns.`);
  return [...regler].map(([vag, rader]) => [vag, ...rader].join("\n")).join("\n") + "\n";
}

// Pages-funktionerna (functions/spel/) körs bara för spelserverns adresser och menyns filmer. Utan _routes.json skulle
// varje fil under /spel/ gå genom en funktion och kosta ett anrop i Workers-kvoten. /spel/figur/meny/* ger Range (206)
// på menyns filmer, som Safari kräver (functions/spel/figur/meny/[[fil]].js, 14/11).
export const RUTTER = { version: 1, include: ["/spel/rum", "/spel/inlogg", "/spel/inlogg/*", "/spel/larare", "/spel/topplista", "/spel/halsa", "/spel/rapport", "/spel/utmaning", "/spel/klasser", "/spel/figur/meny/*"], exclude: [] };

export function skrivCloudflareHuvuden(huvuden, publicDir) {
  writeFileSync(join(publicDir, "_headers"), huvudText(huvuden), "utf8");
  writeFileSync(join(publicDir, "_routes.json"), JSON.stringify(RUTTER, null, 2) + "\n", "utf8");
  console.log("public/_headers: skrivet ur verktyg/huvuden.json. public/_routes.json: bara spelserverns adresser och menyns filmer går till funktionerna.");
}

// Spelens webbapp (Installera-knappen, 15/11): sw.js, manifestet och appens fillista har egna regler (Cache-Control: no-cache).
Object.assign(VAG, { "/sw.js": "/sw.js", "/manifest.webmanifest": "/manifest.webmanifest", "/spel-app.json": "/spel-app.json" });
// Typsnitten (18/11 2026) har ?v=<innehållshash> i adressen (verktyg/publicera.mjs) och sparas i ett år.
Object.assign(VAG, { "/fonts/(.*)": "/fonts/*" });
