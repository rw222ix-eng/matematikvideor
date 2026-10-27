/**
 * Content-Security-Policy för den publicerade sidan (2026-10-27, säkerhet B1).
 *
 * Skripten tillåts med hash och 'strict-dynamic', som Google gör: bara de två fasta skripten nedan får
 * köra, och de skript de själva lägger in (sidans app.<hash>.js). Ett injicerat
 * skript eller en injicerad <script src> kör inte. 'unsafe-inline' och https: gäller bara i mycket
 * gamla webbläsare, som inte känner hash eller 'strict-dynamic'.
 *
 * Policyn står på två ställen som byggsteget (verktyg/publicera.mjs) kontrollerar mot varandra:
 * CSP_HUVUD här och Content-Security-Policy i vercel.json. Är de olika faller bygget, och den förra
 * versionen ligger kvar. Meta-taggen i public/index.html har en mildare policy för lokala prov
 * (skriptet ligger inline där), och byggsteget byter den mot CSP.
 *
 * En ny extern källa: lägg in värden här, i vercel.json och i meta-taggen i public/index.html, och
 * skriv den i SAKERHET.md. Ändras ett av skripten nedan, ändras hashen: kör
 * node verktyg/csp.mjs och klistra in raden i vercel.json.
 */
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

// Läggs i <head> i stället för sidans skript. Filnamnet står i data-app, så att texten är densamma
// för varje version av sidan. Går filen inte att hämta försöker den en gång till. videor.json och
// prov.json börjar hämtas samtidigt (window.videotekForhand), så att filmsidans omslag inte väntar på
// skriptet först. catch() hindrar att ett nätfel syns som ett ohanterat fel innan skriptet tar emot svaret.
export const LADDARE = `(function(){var d=document.currentScript.dataset.app,s=document.createElement("script"),f={};["videor.json","prov.json"].forEach(function(u){var p=fetch(u,{cache:"no-cache"});p.catch(function(){});f[u]=p});window.videotekForhand=f;s.src=d;s.fetchPriority="high";s.onerror=function(){var r=document.createElement("script");r.src=d+"?igen";document.head.appendChild(r)};document.head.appendChild(s)})()`;

// Filmsidorna (förhandsbilden i Classroom) skickar vidare till filmen. Filmens id står i data-film.
export const FILMSKRIPT = `var t=new URLSearchParams(location.search).get("t"),id=document.currentScript.dataset.film;location.replace("../../#"+id+(t&&/^\\d+$/.test(t)?"&t="+t:""))`;

export const hash = (s) => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`;

// GeoGebra och YouTube körs i ramar från en egen adress (säkerhet B3, inbaddat/ i repot). Deras skript,
// stilar och anrop hör till den adressens policy (inbaddat/huvuden.mjs), inte till den här.
export const INBADDAT = "https://matematikvideor-inbaddat.vercel.app";

export const CSP = [
  "default-src 'none'",
  `script-src ${hash(LADDARE)} ${hash(FILMSKRIPT)} 'strict-dynamic' 'unsafe-inline' https:`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data:",
  "media-src https://github.com https://release-assets.githubusercontent.com https://objects.githubusercontent.com",
  "connect-src 'self'",
  `frame-src ${INBADDAT}`,
  "worker-src 'none'",
  "manifest-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Huvudet har också frame-ancestors, som inte fungerar i en meta-tagg.
export const CSP_HUVUD = `${CSP}; frame-ancestors 'none'`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(CSP_HUVUD);
