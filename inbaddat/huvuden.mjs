/**
 * Huvudena för inbäddningarna (säkerhet B3, 2026-10-27). Policyn per sida står här, och hasharna för
 * sidornas egna <script> och <style> räknas ur filerna i public/.
 *
 *   node huvuden.mjs            skriver vercel.json
 *   node huvuden.mjs --kontroll  faller om vercel.json inte stämmer (Vercels buildCommand)
 *
 * Ändras ett skript eller en stil i en sida, ändras hashen: kör node huvuden.mjs och committa vercel.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HÄR = dirname(fileURLToPath(import.meta.url));
const hash = (s) => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`;
const inline = (sida, tagg) => [...readFileSync(join(HÄR, "public", sida), "utf8").matchAll(new RegExp(`<${tagg}>([\\s\\S]*?)</${tagg}>`, "g"))].map((m) => hash(m[1]));

// Bara videoteket får bädda in sidorna. Lokala prov (127.0.0.1, localhost) lägger till sina adresser på
// vägen, i proven (_sakerhet/prov/inbaddat-vag.mjs), så att produktionen bara har https.
const FORALDRAR = "https://winterhalls-matte.vercel.app https://rw222ix-eng.github.io";
const GRUND = ["default-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"];
const AV = "accelerometer=(), bluetooth=(), browsing-topics=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-create=(), publickey-credentials-get=(), serial=(), usb=(), xr-spatial-tracking=()";

const SIDOR = {
  "/yt.html": {
    csp: [...GRUND, `script-src ${inline("yt.html", "script").join(" ")} 'strict-dynamic' 'unsafe-inline' https:`, `style-src ${inline("yt.html", "style").join(" ")}`, "frame-src https://www.youtube.com", `frame-ancestors ${FORALDRAR}`],
    tillstand: `autoplay=(self "https://www.youtube.com"), encrypted-media=(self "https://www.youtube.com"), fullscreen=(self "https://www.youtube.com"), ${AV}`,
  },
  "/ggb.html": {
    // GeoGebra lägger in egna stilar och skript (GWT), därför 'unsafe-inline' i style-src och 'strict-dynamic' i script-src.
    csp: [...GRUND, `script-src ${inline("ggb.html", "script").join(" ")} 'strict-dynamic' 'unsafe-inline' https:`, "style-src 'unsafe-inline' https://www.geogebra.org", "font-src data:", "img-src data:", "connect-src https://www.geogebra.org", "worker-src 'none'", `frame-ancestors ${FORALDRAR}`],
    tillstand: `autoplay=(), encrypted-media=(), fullscreen=(self), ${AV}`,
  },
};

const lika = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];
const vercel = {
  headers: [
    { source: "/(.*)", headers: lika },
    // Allt annat (index.html, okända adresser) får inte bäddas in och får inte köra något. Reglerna
    // överlappar inte, så att ingen sida får två policyer.
    { source: "/((?!yt\\.html|ggb\\.html).*)", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" }, { key: "X-Frame-Options", value: "DENY" }] },
    ...Object.entries(SIDOR).map(([source, s]) => ({ source, headers: [{ key: "Content-Security-Policy", value: s.csp.join("; ") }, { key: "Permissions-Policy", value: s.tillstand }] })),
  ],
  buildCommand: "node huvuden.mjs --kontroll",
  ignoreCommand: "[ -n \"$VERCEL_GIT_PREVIOUS_SHA\" ] && git diff --quiet \"$VERCEL_GIT_PREVIOUS_SHA\" HEAD -- .",
  outputDirectory: "public",
  framework: null,
};

const text = JSON.stringify(vercel, null, 2) + "\n";
const fil = join(HÄR, "vercel.json");
if (process.argv.includes("--kontroll")) {
  if (readFileSync(fil, "utf8").replace(/\r\n/g, "\n") !== text) { console.error("inbaddat/vercel.json stämmer inte med sidorna. Kör: node inbaddat/huvuden.mjs"); process.exit(1); }
  console.log("inbaddat/vercel.json stämmer med sidorna.");
} else {
  writeFileSync(fil, text, "utf8");
  console.log("Skrev inbaddat/vercel.json.");
}
