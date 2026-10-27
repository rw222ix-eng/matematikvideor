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
// Trusted Types (säkerhet B2): skriptadressen går genom policyn «laddare», som bara släpper igenom
// app.<hash>.js. Webbläsare utan Trusted Types får adressen som vanlig text.
export const LADDARE = `(function(){var d=document.currentScript.dataset.app,t=window.trustedTypes&&trustedTypes.createPolicy("laddare",{createScriptURL:function(u){if(/^app\\.[0-9a-f]{16}\\.js(\\?igen)?$/.test(u))return u;throw new TypeError("laddare: "+u)}}),a=function(u){return t?t.createScriptURL(u):u},s=document.createElement("script"),f={};["videor.json","prov.json"].forEach(function(u){var p=fetch(u,{cache:"no-cache"});p.catch(function(){});f[u]=p});window.videotekForhand=f;s.src=a(d);s.fetchPriority="high";s.onerror=function(){var r=document.createElement("script");r.src=a(d+"?igen");document.head.appendChild(r)};document.head.appendChild(s)})()`;

// Filmsidorna (förhandsbilden i Classroom) skickar vidare till filmen. Filmens id står i data-film.
export const FILMSKRIPT = `var t=new URLSearchParams(location.search).get("t"),id=document.currentScript.dataset.film;location.replace("../../#"+id+(t&&/^\\d+$/.test(t)?"&t="+t:""))`;

// GitHub Pages-kopian skickar vidare till samma ställe hos Vercel (säkerhet 3a, 2026-10-27), eftersom
// Pages inte kan skicka säkerhetshuvuden. Det eleven sparat i webbläsaren på Pages-adressen
// (framsteg och inställningar) följer med i #flytt=…, eftersom webbläsaren håller de två adressernas
// lagring isär. index.html tar bara emot det när eleven kommer från Pages, och slår ihop det med det
// som redan finns där. Filmsidorna på Pages skickar som förut till ../../#<id>, alltså hit.
export const VIDARE_TILL = "https://winterhalls-matte.vercel.app";
export const VIDARE = `(function(){var t="/"+location.search+location.hash,d={},n=0;try{["framsteg","tipsSedda","textning","volym","fart","tips","hjalpVisad","provKlass","formelbladKurs"].forEach(function(k){var v=localStorage.getItem(k);if(v!==null&&v.length<50000){d[k]=v;n++}})}catch(e){}location.replace("${VIDARE_TILL}"+(n?"/#flytt="+encodeURIComponent(JSON.stringify({till:t,d:d})):t))})()`;

export const hash = (s) => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`;

// Vidarekopplingens egen policy. Sidan har bara skriptet ovan, stilen nedan och en länk.
export const VIDARE_STIL = "html { background: #171414; color: #ECE6D8; font: 17px/1.7 system-ui, sans-serif; } a { color: #F2C572; }";
export const VIDARE_CSP = [
  "default-src 'none'",
  `script-src ${hash(VIDARE)}`,
  `style-src ${hash(VIDARE_STIL)}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "require-trusted-types-for 'script'",
  "trusted-types 'none'",
].join("; ");

// GeoGebra och YouTube körs i ramar från en egen adress (säkerhet B3, inbaddat/ i repot). Deras skript,
// stilar och anrop hör till den adressens policy (inbaddat/huvuden.mjs), inte till den här.
export const INBADDAT = "https://matematikvideor-inbaddat.vercel.app";

export const CSP = [
  "default-src 'none'",
  `script-src ${hash(LADDARE)} ${hash(FILMSKRIPT)} 'strict-dynamic' 'unsafe-inline' https:`,
  "style-src 'self' 'unsafe-inline'",
  // Inga stilattribut (säkerhet B4, 2026-10-27). Stilblocken i <head> står kvar, så sidan ritas lika
  // fort. Sidans egna värden sätts med style.setProperty (data-stil i index.html).
  "style-src-attr 'none'",
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
  // Trusted Types (säkerhet B2, 2026-10-27): innerHTML och skriptadresser tar bara emot värden från
  // sidans egna policyer, «videotek» (html() i index.html) och «laddare» (ovan). Ingen default-policy.
  "require-trusted-types-for 'script'",
  "trusted-types videotek laddare",
  "upgrade-insecure-requests",
].join("; ");

// Huvudet har också frame-ancestors, som inte fungerar i en meta-tagg.
export const CSP_HUVUD = `${CSP}; frame-ancestors 'none'`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(CSP_HUVUD);
