/**
 * Huvudena hos Cloudflare Pages (flytten 2026-11-07). vercel.json är källan, och public/_headers skrivs ur den vid
 * varje publicering, så att policyn inte står på ett ställe till.
 *
 * _headers har ingen «allt utom», och två regler för samma huvud slås ihop med komma. Därför tar /omslag/* bort
 * Cross-Origin-Resource-Policy från /* med en !-rad innan den sätter sitt eget värde.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { VIDARE_TILL } from "./csp.mjs";

const VAG = { "/(.*)": "/*", "/((?!omslag/).*)": "/*", "/videor.json": "/videor.json", "/app.(.*).js": "/app.*", "/omslag/(.*)": "/omslag/*" };

export function huvudText(vercel) {
  const regler = new Map();
  for (const r of vercel.headers) {
    const vag = VAG[r.source];
    if (!vag) throw new Error(`cloudflare.mjs känner inte regeln ${r.source} i vercel.json. Lägg den i VAG.`);
    const rader = regler.get(vag) ?? [];
    for (const h of r.headers) {
      if (vag === "/omslag/*" && h.key === "Cross-Origin-Resource-Policy") rader.push(`  ! ${h.key}`);
      rader.push(`  ${h.key}: ${h.value.replace("https://winterhalls-matte.vercel.app", VIDARE_TILL)}`);
    }
    regler.set(vag, rader);
  }
  for (const [vag, rader] of regler) for (const rad of rader) if (rad.length > 2000) throw new Error(`Ett huvud i ${vag} är över 2 000 tecken, Cloudflares gräns.`);
  return [...regler].map(([vag, rader]) => [vag, ...rader].join("\n")).join("\n") + "\n";
}

export function skrivCloudflareHuvuden(vercel, publicDir) {
  writeFileSync(join(publicDir, "_headers"), huvudText(vercel), "utf8");
  console.log("public/_headers: skrivet ur vercel.json.");
}
