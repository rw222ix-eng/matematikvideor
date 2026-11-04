/**
 * Städar efter en kontrollerad publicering (2026-11-04, Rickard: «Ja, ta bort det gamla»). Varje ny omgång
 * film lämnade 28–40 GB per dag kvar på E:, och inget tog bort det.
 *
 * Hooken vt-push (~/.claude/hooks/vt-push.mjs) startar steget efter varje push från en vt-klon. Steget ser
 * vilka filmer som fått en ny `fil` i public/videor.json, lägger dem i kön _stadning/ko.json och arbetar sedan
 * av kön i en egen process. För just de filmerna tas det här bort, och inget annat:
 *   - filerna utgar-* i assets/export
 *   - mellansteg i assets/export som går att bygga om (arMellansteg nedan, Rickard: «Ja, också mellanstegen»)
 *   - cache/release-v<N>-mappar äldre än den publicerade versionen, utom den nyaste
 *   - klonen som publicerade, när den är ren, helt pushad och orörd i 2 timmar
 *
 * Först ska publiceringen vara kontrollerad: videor.json på main, på Vercel och på Pages pekar på releasen,
 * releasen har filen med status uploaded och samma storlek som en lokal kopia, och adressen svarar 206 med
 * den storleken. Annars tas inget bort. Filmens jobb får inte vara igång: inget jobb i Big Brain Clubs kö,
 * ingen process eller .las/appen som nämner projektet, och ingen fil i projektet ändrad de senaste 15 minuterna.
 * Junctions följs aldrig. Allt som tas bort, och allt som står kvar och varför, skrivs i _stadning/stadning.log.
 *
 *   node verktyg/stada-publicering.mjs torr <film-id> [--klon <klon>]   visar vad som skulle tas bort, ändrar inget
 *   node verktyg/stada-publicering.mjs sopa                             arbetar av kön igen, till exempel efter en omstart
 *   node verktyg/stada-publicering.mjs --prov                           ska sluta med «alla fall rätt»
 *
 * Filen laddas ur klonen som publicerade och ligger i minnet medan klonen tas bort. Bara Node, inga npm-paket.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROT = "E:/Matematikvideos";
const REPO = "rw222ix-eng/matematikvideor";
const ADRESS = /^https:\/\/github\.com\/rw222ix-eng\/matematikvideor\/releases\/download\/([^/]+)\/([^/]+)$/;
const LIVE = ["https://winterhalls-matte.vercel.app/videor.json", "https://rw222ix-eng.github.io/matematikvideor/videor.json"];
const MINUT = 60_000;
const TIMME = 60 * MINUT;
const STILLA_PROJEKT = 15 * MINUT;
const STILLA_KLON = 2 * TIMME;
const GE_UPP_KONTROLL = 2 * TIMME;
const GE_UPP_VANTAN = 24 * TIMME;
// Ignorerade filer som bara är cache. Allt annat ignorerat, till exempel en .env, gör att klonen står kvar.
const OFARLIGT = /^(?:(?:.*\/)?__pycache__\/.*|verktyg\/\.venv\/.*|verktyg\/\.cache\/.*|kontroll\/node_modules\/.*)$/;

const lst = (p) => { try { return fs.lstatSync(p); } catch { return null; } };
const enDir = (p) => { const s = lst(p); return !!s && s.isDirectory() && !s.isSymbolicLink(); };
const gb = (b) => `${(b / 1e9).toFixed(2).replace(".", ",")} GB`;
const normal = (s) => String(s ?? "").replace(/\\/g, "/").toLowerCase();

// ─── Ta bort utan att följa en junction ───────────────────────────────────────────────────────────────────

// Node ser en junction som en symbolisk länk. Den tas bort med rmdir utan /s, så att målet står kvar.
function taBortLank(p) {
  if (process.platform === "win32") {
    const r = spawnSync("cmd", ["/c", "rmdir", path.resolve(p)], { stdio: "ignore", windowsHide: true });
    if (r.status === 0 && !lst(p)) return;
  }
  fs.unlinkSync(p);
}

export function storlek(p) {
  const s = lst(p);
  if (!s || s.isSymbolicLink()) return 0;
  if (!s.isDirectory()) return s.size;
  return fs.readdirSync(p).reduce((sum, n) => sum + storlek(path.join(p, n)), 0);
}

export function radera(p) {
  const s = lst(p);
  if (!s) return;
  if (s.isSymbolicLink()) return taBortLank(p);
  if (s.isDirectory()) {
    for (const n of fs.readdirSync(p)) radera(path.join(p, n));
    fs.rmdirSync(p);
    return;
  }
  // Gits objektfiler är skrivskyddade på Windows.
  if (!(s.mode & 0o200)) fs.chmodSync(p, 0o666);
  fs.unlinkSync(p);
}

// ─── Vad ska bort ─────────────────────────────────────────────────────────────────────────────────────────

const delarAvVersion = (s) => { const m = String(s).match(/^(\d+)([a-z]*)$/); return m ? { n: +m[1], rest: m[2] } : null; };

// Svar: { bort, kvar, okand } av mapparna [{ namn, mtimeMs }]. release-v12f och release-v12-fore-slutfraga är
// versioner av v12, så de är äldre när de är äldre än release-v12. Annan form (release-o5) rörs inte.
export function valjReleaseMappar(mappar, tagg) {
  const m = String(tagg).match(/-v(\d+[a-z]*)$/);
  const aktuell = m && delarAvVersion(m[1]);
  if (!aktuell) return { bort: [], kvar: [], okand: mappar.map((x) => x.namn) };
  const namnAktuell = `release-v${m[1]}`;
  const tidAktuell = mappar.find((x) => x.namn === namnAktuell)?.mtimeMs;
  const tolkade = [];
  const okand = [];
  for (const x of mappar) {
    const t = x.namn.match(/^release-v(\d+)([a-z]*)(-.*)?$/);
    if (t) tolkade.push({ ...x, n: +t[1] });
    else okand.push(x.namn);
  }
  const nyast = tolkade.reduce((a, b) => (!a || b.mtimeMs > a.mtimeMs ? b : a), null)?.namn;
  const bort = [];
  const kvar = [];
  for (const x of tolkade) {
    const aldre = x.n < aktuell.n || (x.n === aktuell.n && tidAktuell !== undefined && x.mtimeMs < tidAktuell);
    if (x.namn !== namnAktuell && x.namn !== nyast && aldre) bort.push(x.namn);
    else kvar.push(x.namn);
  }
  return { bort, kvar, okand };
}

// Mellansteg i assets/export, <projekt>-1080p-<ord>.mp4. Bara ord som står här tas bort, så ett nytt namn står kvar
// tills någon sett vad det är. Varje ord går att bygga om: kedjan utgår från <projekt>-1080p.mp4 och klippen i cachen,
// och den publicerade filen finns kvar som release. Står kvar: -svans* (din-tur-bygg --utan-svans och skarva.py läser
// den, och den kräver en appexport), -hybrid, -fore-svans och -fore-fonster (svans-export.mjs återställer
// -1080p.mp4 ur dem), -misslyckad, -master, -release, -film, -slut, -musik* och allt som inte är .mp4.
const ORD = /^(?:ingang|klipp|filmiskt|topaz|omni\d*|blandad|ljud|svalj|tyst|utan|utanvarg|hl\d*[a-z]*|[vo]\d+[a-z]*|fore\d+|pub|publicerad|test|slutfraga|fonster|komposant|a|lagad)$/;
const KRAVER_KLIPP = { ingang: ["ingang"], topaz: ["ingang"], klipp: ["klipp"], omni: ["klipp", "omni"], blandad: ["klipp", "omni"] };

// Svar: orden i namnet, eller null när filen inte är ett känt mellansteg.
export function arMellansteg(namn, projekt) {
  const fore = `${projekt}-1080p-`;
  if (!namn.startsWith(fore) || !namn.endsWith(".mp4")) return null;
  const ord = namn.slice(fore.length, -4).split("-");
  return ord.every((o) => ORD.test(o)) ? ord : null;
}

function harVideo(p) {
  const s = lst(p);
  if (!s || s.isSymbolicLink()) return false;
  if (!s.isDirectory()) return /\.(mp4|mov)$/i.test(p) && s.size > 0;
  return fs.readdirSync(p).some((n) => harVideo(path.join(p, n)));
}

// Klippen som kostat krediter ska finnas i cachen innan filmen de ligger i tas bort. Annars går den inte att bygga om.
function kanByggasOm(ord, projekt) {
  for (const o of ord) {
    const krav = KRAVER_KLIPP[o.replace(/\d+$/, "")];
    if (krav && !krav.some((d) => harVideo(path.join(projekt, "cache", d)))) return `klippen till -${o} saknas i cachen`;
    if (o === "filmiskt" && !lst(path.join(projekt, "verktyg", "filmiskt.py"))) return "verktyg/filmiskt.py saknas";
  }
  return null;
}

// Filer som listorna i _scratch pekar på för den publicerade versionen. Skarva.py och hack-mätningen läser dem.
// Går en lista inte att läsa är svaret null, och då rörs inga mellansteg.
export function namnIListor(film, fil, m) {
  const namn = new Set();
  const lagg = (x) => { for (const f of [x?.lokal, x?.kalla]) if (f) namn.add(path.basename(String(f).replace(/\\/g, "/"))); };
  try {
    const pub = path.join(m.rot, "_scratch", "slutfragan", "publicerat.json");
    if (lst(pub)) {
      const post = JSON.parse(fs.readFileSync(pub, "utf8"))[film.id];
      if (post?.url === fil) lagg(post);
    }
    const karta = path.join(m.rot, "_scratch", "hack-utlagda", "karta.json");
    if (lst(karta)) for (const x of JSON.parse(fs.readFileSync(karta, "utf8"))) if (x.id === film.id && x.fil === fil) lagg(x);
    return namn;
  } catch { return null; }
}

// Sökvägar eller mappar som någon annan har hand om, en per rad i _stadning/rors-inte.txt.
function rorsInte(m) {
  try { return fs.readFileSync(path.join(m.mapp, "rors-inte.txt"), "utf8").split(/\r?\n/).map(normal).filter(Boolean); }
  catch { return []; }
}
const skyddad = (p, lista) => { const n = normal(path.resolve(p)); return lista.some((r) => n === r || n.startsWith(`${r}/`)); };

const projektVag = (film, m) => path.join(m.rot, film.projekt);
const verkligKedja = (rot, ...delar) => { let p = rot; for (const d of delar) { p = path.join(p, d); if (lst(p) && !enDir(p)) return false; } return true; };

// Svar: { poster: [{ sokvag, byte, sort }], kvar: [text] }. Ändrar inget.
export function planera(film, kontroll, m) {
  const poster = [];
  const kvar = [];
  const projekt = projektVag(film, m);
  if (!enDir(projekt)) return { poster, kvar: [`${projekt} är ingen vanlig mapp, inget rörs`] };
  const andras = rorsInte(m);
  const listade = namnIListor(film, kontroll.fil, m);
  if (!listade) kvar.push("listorna i _scratch gick inte att läsa, mellanstegen rörs inte");
  const exp = path.join(projekt, "assets", "export");
  if (!verkligKedja(projekt, "assets", "export")) kvar.push("assets/export är en länk eller junction, rörs inte");
  else if (enDir(exp)) {
    for (const n of fs.readdirSync(exp)) {
      if (n === `${film.projekt}-1080p.mp4` || !n.endsWith(".mp4")) continue;
      const p = path.join(exp, n);
      const s = lst(p);
      const utgar = n.startsWith("utgar-");
      const ord = utgar ? null : arMellansteg(n, film.projekt);
      if (!utgar && !ord) { kvar.push(`${n} är inget känt mellansteg, står kvar`); continue; }
      if (!s.isFile()) kvar.push(`${n} är ingen vanlig fil, rörs inte`);
      else if (s.size === kontroll.storlek) kvar.push(`${n} är lika stor som den publicerade filen, står kvar`);
      else if (skyddad(p, andras)) kvar.push(`${n} står i rors-inte.txt, rörs inte`);
      else if (utgar) poster.push({ sokvag: p, byte: s.size, sort: "utgar" });
      else if (!listade) continue;
      else if (listade.has(n)) kvar.push(`${n} står i en lista i _scratch, står kvar`);
      else if (!(s.mtimeMs < kontroll.publicerad)) kvar.push(`${n} är nyare än publiceringen, står kvar`);
      else {
        const hinder = kanByggasOm(ord, projekt);
        if (hinder) kvar.push(`${n}: ${hinder}, står kvar`);
        else poster.push({ sokvag: p, byte: s.size, sort: "mellansteg" });
      }
    }
  }
  const cache = path.join(projekt, "cache");
  if (!verkligKedja(projekt, "cache")) kvar.push("cache är en länk eller junction, rörs inte");
  else if (enDir(cache)) {
    const mappar = fs.readdirSync(cache)
      .filter((n) => n === "release" || n.startsWith("release-"))
      .map((n) => ({ n, s: lst(path.join(cache, n)) }));
    for (const { n, s } of mappar) if (s.isSymbolicLink()) kvar.push(`cache/${n} är en länk eller junction, rörs inte`);
    const val = valjReleaseMappar(mappar.filter(({ s }) => s.isDirectory() && !s.isSymbolicLink()).map(({ n, s }) => ({ namn: n, mtimeMs: s.mtimeMs })), kontroll.tagg);
    for (const n of val.bort) {
      const p = path.join(cache, n);
      // En mapp vars film är lika stor som den publicerade kan vara den publicerade, vad den än heter.
      const film1 = lst(path.join(p, kontroll.namn));
      if (film1?.size === kontroll.storlek) kvar.push(`cache/${n} har den publicerade filen, rörs inte`);
      else if (skyddad(p, andras)) kvar.push(`cache/${n} står i rors-inte.txt, rörs inte`);
      else poster.push({ sokvag: p, byte: storlek(p), sort: "release" });
    }
    for (const n of val.kvar) kvar.push(`cache/${n} är aktuell, nyast eller nyare, står kvar`);
    for (const n of val.okand) kvar.push(`cache/${n} har okänd form, står kvar`);
  }
  return { poster, kvar };
}

// ─── Kontrollerna ─────────────────────────────────────────────────────────────────────────────────────────

const nej = (skal) => ({ ok: false, skal });

function lokalKopia(film, namn, storlekB, tagg, m) {
  const projekt = projektVag(film, m);
  const kand = [];
  const cache = path.join(projekt, "cache");
  if (enDir(cache)) for (const n of fs.readdirSync(cache)) if (n.startsWith("release")) kand.push(path.join(cache, n, namn));
  const exp = path.join(projekt, "assets", "export");
  if (enDir(exp)) for (const n of fs.readdirSync(exp)) if (n.endsWith(".mp4")) kand.push(path.join(exp, n));
  kand.push(path.join(m.rot, "_svalj-publicering", tagg, namn));
  return kand.some((p) => { const s = lst(p); return s?.isFile() && s.size === storlekB; });
}

// Publiceringen är kontrollerad: main, Vercel och Pages pekar på releasen, och filen stämmer i storlek.
export async function kontrollera(film, m) {
  let fil;
  try { fil = (await m.videorOrigin()).find((v) => v.id === film.id)?.fil; }
  catch (e) { return nej(`videor.json på main gick inte att läsa: ${e.message}`); }
  if (!fil) return nej("videor.json på main saknar filmen eller dess fil");
  const a = String(fil).match(ADRESS);
  if (!a) return nej(`fil pekar inte på en release i repot: ${fil}`);
  const [, tagg, namn] = a;
  if (namn !== `${film.projekt}-1080p.mp4`) return nej(`filen heter ${namn}, väntat ${film.projekt}-1080p.mp4`);
  for (const url of m.live) {
    try {
      const post = (await m.videorLive(url)).find((v) => v.id === film.id);
      if (post?.fil !== fil) return nej(`${url} pekar inte på ${tagg} ännu`);
    } catch (e) { return nej(`${url} gick inte att läsa: ${e.message}`); }
  }
  let rel;
  try { rel = await m.release(tagg); }
  catch (e) { return nej(`releasen ${tagg} gick inte att läsa: ${e.message}`); }
  if (!rel) return nej(`releasen ${tagg} finns inte`);
  if (rel.draft) return nej(`releasen ${tagg} är ett utkast`);
  const asset = (rel.assets ?? []).find((x) => x.name === namn);
  if (!asset) return nej(`releasen ${tagg} saknar ${namn}`);
  if (asset.state !== "uploaded" || !(asset.size > 0)) return nej(`${namn} i ${tagg} har status ${asset.state} och storlek ${asset.size}`);
  let svar;
  try { svar = await m.filSvar(fil); }
  catch (e) { return nej(`filen gick inte att hämta: ${e.message}`); }
  if (svar.status !== 206 || svar.total !== asset.size) return nej(`filen svarar ${svar.status} med storlek ${svar.total}, releasen säger ${asset.size}`);
  if (!lokalKopia(film, namn, asset.size, tagg, m)) return nej(`ingen lokal fil har releasens storlek ${asset.size}`);
  const slut = lst(path.join(projektVag(film, m), "assets", "export", `${film.projekt}-1080p.mp4`));
  if (!slut?.isFile() || !slut.size) return nej(`slutfilen ${film.projekt}-1080p.mp4 saknas i assets/export`);
  return { ok: true, fil, tagg, namn, storlek: asset.size, publicerad: Date.parse(rel.published_at) };
}

function senasteAndring(p, gans) {
  const s = lst(p);
  if (!s || s.isSymbolicLink()) return 0;
  if (!s.isDirectory()) return s.mtimeMs;
  let max = s.mtimeMs;
  for (const n of fs.readdirSync(p)) {
    if (n === "node_modules" || n === ".git") continue;
    max = Math.max(max, senasteAndring(path.join(p, n), gans));
    if (max >= gans) break;
  }
  return max;
}

function jobbSomNamner(ord, m) {
  let jobb = [];
  try { jobb = JSON.parse(fs.readFileSync(m.jobbFil, "utf8")).jobb ?? []; }
  catch (e) { if (e.code !== "ENOENT") return `jobbkön gick inte att läsa: ${e.message}`; }
  for (const j of jobb) {
    if (j.status !== "ko" && j.status !== "kor") continue;
    if (normal(`${j.mapp} ${j.kommando} ${j.logg}`).includes(ord)) return `jobbet «${j.titel}» i kön rör ${ord}`;
  }
  return null;
}

function processSomNamner(ord, m) {
  let rader;
  try { rader = m.processer(); }
  catch (e) { return `processlistan gick inte att läsa: ${e.message}`; }
  const hit = rader.find((r) => normal(r).includes(ord));
  return hit ? `en process rör ${ord}: ${hit.slice(0, 160)}` : null;
}

// Arbetar något annat med filmen? Svar: skälet, eller null. Går det inte att veta, räknas det som att det gör det.
export function aktiv(film, m) {
  const ord = normal(film.projekt);
  const jobb = jobbSomNamner(ord, m);
  if (jobb) return jobb;
  const appen = path.join(m.rot, ".las", "appen");
  if (enDir(appen)) {
    for (const n of fs.readdirSync(appen)) {
      let text = n;
      try { text += fs.readFileSync(path.join(appen, n), "utf8"); } catch { /* låset släpptes */ }
      if (normal(text).includes(ord)) return `.las/appen är taget för ${ord}`;
    }
  }
  const proc = processSomNamner(ord, m);
  if (proc) return proc;
  const gans = m.nu() - STILLA_PROJEKT;
  const senast = senasteAndring(projektVag(film, m), gans);
  if (senast >= gans) return "filer i projektet har ändrats de senaste 15 minuterna";
  return null;
}

const gitK = (k, ...a) => spawnSync("git", ["--no-optional-locks", "-C", k, ...a], { encoding: "utf8", timeout: 120_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
const raderOf = (r) => (r.stdout ?? "").split("\n").map((s) => s.trimEnd()).filter(Boolean);

// Får klonen tas bort? Svar: { ok } eller { ok: false, skal }. Ändringar som inte är pushade gör att den står kvar.
export function klonLage(klon, m) {
  const nam = path.basename(klon);
  if (!nam.startsWith("vt-") || normal(path.dirname(path.resolve(klon))) !== normal(path.resolve(m.rot))) return nej(`${klon} är ingen vt-klon direkt under ${m.rot}`);
  if (!lst(klon)) return { ok: false, borta: true, skal: "klonen finns inte längre" };
  if (!enDir(klon)) return nej("klonen är en länk eller junction");
  if (skyddad(klon, rorsInte(m))) return nej("klonen står i rors-inte.txt");
  const gitdir = path.join(klon, ".git");
  if (!enDir(gitdir)) return nej("klonen har ingen egen .git-mapp");
  const url = gitK(klon, "remote", "get-url", "origin");
  if (url.status !== 0 || !/matematikvideor(\.git)?\s*$/.test(url.stdout ?? "")) return nej("origin är inte videotekets repo");
  const pagar = ["rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"].find((n) => lst(path.join(gitdir, n)));
  if (pagar) return nej(`${pagar} finns: en rebase eller merge pågår`);
  const status = gitK(klon, "status", "--porcelain", "--ignored");
  if (status.status !== 0) return nej(`git status föll: ${(status.stderr ?? "").trim().slice(0, 160)}`);
  const rader = raderOf(status);
  const andrat = rader.filter((r) => !r.startsWith("!! "));
  if (andrat.length) return nej(`ändringar som inte är committade: ${andrat.slice(0, 5).join(", ")}`);
  const ignorerat = rader.map((r) => r.slice(3).replace(/^"|"$/g, "")).filter((r) => !OFARLIGT.test(r));
  if (ignorerat.length) return nej(`ignorerade filer som kan vara egna: ${ignorerat.slice(0, 5).join(", ")}`);
  if (raderOf(gitK(klon, "stash", "list")).length) return nej("git stash har innehåll");
  if (raderOf(gitK(klon, "worktree", "list", "--porcelain")).filter((r) => r.startsWith("worktree ")).length > 1) return nej("klonen har en worktree");
  const fetch = gitK(klon, "fetch", "-q", "origin");
  if (fetch.status !== 0) return nej(`git fetch föll: ${(fetch.stderr ?? "").trim().slice(0, 160)}`);
  const opushat = raderOf(gitK(klon, "log", "--oneline", "--branches", "--not", "--remotes=origin"));
  if (opushat.length) return nej(`opushade commits: ${opushat.slice(0, 5).join(", ")}`);
  if (gitK(klon, "merge-base", "--is-ancestor", "HEAD", "origin/main").status !== 0) return nej("HEAD finns inte på origin/main");
  const ord = normal(nam);
  const jobb = jobbSomNamner(ord, m) ?? processSomNamner(ord, m);
  if (jobb) return nej(jobb);
  const rord = ["index", "HEAD", "ORIG_HEAD", "COMMIT_EDITMSG", path.join("logs", "HEAD"), path.join("refs", "heads", "main")];
  const senast = Math.max(0, ...rord.map((n) => lst(path.join(gitdir, n))?.mtimeMs ?? 0));
  if (m.nu() - senast < STILLA_KLON) return nej("klonen har använts de senaste 2 timmarna");
  return { ok: true };
}

// Bytet av namn först: Windows nekar det när en process står i mappen eller har en fil öppen, och då är klonen orörd.
export function taBortKlon(klon, m) {
  const byte = storlek(klon);
  const papper = path.join(m.mapp, "borttag");
  fs.mkdirSync(papper, { recursive: true });
  const ny = path.join(papper, `${path.basename(klon)}-${m.nu()}`);
  fs.renameSync(klon, ny);
  radera(ny);
  return byte;
}

// ─── Kön och loggen ───────────────────────────────────────────────────────────────────────────────────────

const koFil = (m) => path.join(m.mapp, "ko.json");

export function logga(m, id, text) {
  fs.mkdirSync(m.mapp, { recursive: true });
  const t = new Date(m.nu()).toLocaleString("sv-SE");
  fs.appendFileSync(path.join(m.mapp, "stadning.log"), `${t}  ${id}  ${text}\n`);
}

const lasKo = (m) => { try { return JSON.parse(fs.readFileSync(koFil(m), "utf8")); } catch { return { senast: null, filmer: [] }; } };
function skrivKo(m, ko) {
  const tmp = `${koFil(m)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ko, null, 2));
  fs.renameSync(tmp, koFil(m));
}

// Alla ändringar i kön går genom låset. Mappen skapas atomiskt, och ett lås äldre än en minut är kvarlämnat.
function medKo(m, fn) {
  fs.mkdirSync(m.mapp, { recursive: true });
  const las = path.join(m.mapp, "ko.las");
  const slut = Date.now() + 30_000;
  for (;;) {
    try { fs.mkdirSync(las); break; }
    catch (e) {
      if (e.code !== "EEXIST") throw e;
      if (Date.now() - (lst(las)?.mtimeMs ?? Date.now()) > MINUT) { try { fs.rmdirSync(las); } catch { /* någon annan hann */ } continue; }
      if (Date.now() > slut) throw new Error("låset på kön släpptes inte");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  try {
    const ko = lasKo(m);
    const svar = fn(ko);
    skrivKo(m, ko);
    return svar;
  } finally { fs.rmdirSync(las); }
}

function visaFil(klon, sha, fil) {
  const r = gitK(klon, "show", `${sha}:${fil}`);
  if (r.status !== 0) throw new Error(`git show ${sha}:${fil} föll`);
  return JSON.parse(r.stdout);
}

// Filmerna som fått en ny fil mellan två commits. Övriga pushar (sidan, verktygen) ger en tom lista.
export function filmerMellan(klon, fore, efter) {
  const gamla = new Map(visaFil(klon, fore, "public/videor.json").videor.map((v) => [v.id, v.fil]));
  const register = new Map(visaFil(klon, efter, "register.json").map((v) => [v.id, v.projekt]));
  const filmer = [];
  for (const v of visaFil(klon, efter, "public/videor.json").videor) {
    if (!v.fil || gamla.get(v.id) === v.fil) continue;
    const rel = String(register.get(v.id) ?? "");
    const projekt = rel.replace(/^\.\.\//, "");
    filmer.push({ id: v.id, projekt: /^[\w.-]+$/.test(projekt) && !/^(vt-|_|\.)/.test(projekt) ? projekt : null });
  }
  return filmer;
}

// Lägger push-ens filmer i kön. Pushar som gått förbi hooken fångas av senast, men deras kloner är okända och står kvar.
export function anmal(klon, fore, efter, m) {
  const egna = filmerMellan(klon, fore, efter);
  return medKo(m, (ko) => {
    let alla = egna;
    if (ko.senast && ko.senast !== fore && gitK(klon, "merge-base", "--is-ancestor", ko.senast, efter).status === 0) {
      try { alla = filmerMellan(klon, ko.senast, efter); } catch { /* commiten saknas här, ta bara de egna */ }
    }
    const nyId = new Set(egna.map((f) => f.id));
    for (const f of alla) {
      if (!f.projekt) { logga(m, f.id, "filmen har inget projekt i register.json, inget rörs"); continue; }
      let post = ko.filmer.find((x) => x.id === f.id);
      if (!post) ko.filmer.push(post = { id: f.id, projekt: f.projekt, kloner: [], anmald: m.nu(), skal: null });
      post.anmald = m.nu();
      post.filmKlar = false;
      post.nasta = 0;
      if (nyId.has(f.id) && !post.kloner.includes(klon)) post.kloner.push(klon);
      logga(m, f.id, `anmäld efter push ${String(efter).slice(0, 7)} från ${path.basename(klon)}`);
    }
    if (!ko.senast || gitK(klon, "merge-base", "--is-ancestor", ko.senast, efter).status === 0) ko.senast = efter;
    return alla.length;
  });
}

// ─── Ett varv för en film ─────────────────────────────────────────────────────────────────────────────────

// Svar: en ändring av filmens post. tas bort tar posten ur kön, skal och nasta säger varför den väntar.
export async function behandla(film, m) {
  const alder = m.nu() - film.anmald;
  const vanta = (skal, om) => {
    if (skal !== film.skal) logga(m, film.id, `väntar: ${skal}`);
    return { skal, nasta: m.nu() + om };
  };
  const ge = { filmKlar: film.filmKlar, kloner: [...film.kloner] };
  if (!film.filmKlar) {
    const k = await kontrollera(film, m);
    if (!k.ok) {
      if (alder > GE_UPP_KONTROLL) { logga(m, film.id, `INGET BORTTAGET, kontrollen gick aldrig igenom: ${k.skal}`); return { bort: true }; }
      return { ...ge, ...vanta(k.skal, MINUT) };
    }
    const a = aktiv(film, m);
    if (a) {
      if (alder > GE_UPP_VANTAN) { logga(m, film.id, `INGET BORTTAGET efter ett dygn: ${a}`); return { bort: true }; }
      return { ...ge, ...vanta(a, 5 * MINUT) };
    }
    const plan = planera(film, k, m);
    let summa = 0;
    for (const p of plan.poster) {
      try {
        radera(p.sokvag);
        summa += p.byte;
        logga(m, film.id, `tog bort ${path.relative(m.rot, p.sokvag).replace(/\\/g, "/")} (${gb(p.byte)})`);
      } catch (e) { logga(m, film.id, `kunde inte ta bort ${p.sokvag}: ${e.message}`); }
    }
    for (const t of plan.kvar) logga(m, film.id, t);
    logga(m, film.id, `klart för ${k.tagg}: ${gb(summa)} borttaget, ${film.projekt}-1080p.mp4 står kvar`);
    ge.filmKlar = true;
  }
  const kvarKloner = [];
  const skal = [];
  for (const klon of ge.kloner) {
    if (m.klonDelas?.(klon, film.id)) { kvarKloner.push(klon); skal.push(`${path.basename(klon)} väntar på en annan film`); continue; }
    const l = klonLage(klon, m);
    if (l.borta) continue;
    if (!l.ok) {
      if (alder > GE_UPP_VANTAN) { logga(m, film.id, `klonen ${path.basename(klon)} står kvar: ${l.skal}`); continue; }
      kvarKloner.push(klon);
      skal.push(`${path.basename(klon)}: ${l.skal}`);
      continue;
    }
    try {
      const byte = taBortKlon(klon, m);
      logga(m, film.id, `tog bort klonen ${path.basename(klon)} (${gb(byte)})`);
    } catch (e) {
      if (alder > GE_UPP_VANTAN) { logga(m, film.id, `klonen ${path.basename(klon)} står kvar: ${e.message}`); continue; }
      kvarKloner.push(klon);
      skal.push(`${path.basename(klon)} används: ${e.code ?? e.message}`);
    }
  }
  if (!kvarKloner.length) return { bort: true };
  return { filmKlar: true, kloner: kvarKloner, ...vanta(skal.join("; "), 10 * MINUT) };
}

// Bara en process arbetar av kön. Filen med pid rörs varje varv, och är den äldre än 15 minuter är processen borta.
function tagSopare(m) {
  const fil = path.join(m.mapp, "sopare.pid");
  fs.mkdirSync(m.mapp, { recursive: true });
  for (let i = 0; i < 2; i++) {
    try { fs.writeFileSync(fil, String(process.pid), { flag: "wx" }); return fil; }
    catch (e) {
      if (e.code !== "EEXIST") throw e;
      let lever = false;
      try { process.kill(+fs.readFileSync(fil, "utf8"), 0); lever = Date.now() - lst(fil).mtimeMs < 15 * MINUT; } catch { /* processen finns inte */ }
      if (lever) return null;
      try { fs.unlinkSync(fil); } catch { /* någon annan hann */ }
    }
  }
  return null;
}

export async function sopa(m, { vila = MINUT } = {}) {
  const fil = tagSopare(m);
  if (!fil) return false;
  try {
    for (;;) {
      const lista = medKo(m, (ko) => ko.filmer);
      if (!lista.length) return true;
      for (const film of lista) {
        if ((film.nasta ?? 0) > m.nu()) continue;
        const delas = (klon, id) => lista.some((f) => f.id !== id && !f.filmKlar && f.kloner.includes(klon));
        const svar = await behandla(film, { ...m, klonDelas: delas });
        medKo(m, (ko) => {
          const i = ko.filmer.findIndex((f) => f.id === film.id);
          if (i < 0) return;
          const nu = ko.filmer[i];
          // Publicerades filmen igen under varvet börjar den om.
          if (nu.anmald !== film.anmald) { nu.kloner = [...new Set([...(svar.kloner ?? []), ...nu.kloner])]; return; }
          if (svar.bort) ko.filmer.splice(i, 1);
          else Object.assign(nu, svar);
        });
      }
      const nu = new Date();
      fs.utimesSync(fil, nu, nu);
      if (vila) await new Promise((r) => setTimeout(r, vila));
    }
  } finally {
    try { fs.unlinkSync(fil); } catch { /* redan borta */ }
  }
}

// ─── Den riktiga omgivningen ──────────────────────────────────────────────────────────────────────────────

function gh(...a) {
  const r = spawnSync("gh", a, { encoding: "utf8", timeout: 120_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  return { kod: r.status, ut: r.stdout ?? "", fel: r.stderr ?? "" };
}

export function verkligMiljo(rot = ROT) {
  return {
    rot,
    mapp: path.join(rot, "_stadning"),
    jobbFil: path.join(process.env.LOCALAPPDATA ?? "C:/Users/bolun/AppData/Local", "Dirigent", "jobb.json"),
    live: LIVE,
    nu: () => Date.now(),
    videorOrigin() {
      const r = gh("api", "-H", "Accept: application/vnd.github.raw+json", `repos/${REPO}/contents/public/videor.json?ref=main`);
      if (r.kod !== 0) throw new Error(r.fel.trim().slice(0, 200));
      return JSON.parse(r.ut).videor;
    },
    async videorLive(url) {
      const s = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
      if (!s.ok) throw new Error(`svarade ${s.status}`);
      return (await s.json()).videor;
    },
    release(tagg) {
      const r = gh("api", `repos/${REPO}/releases/tags/${tagg}`);
      if (r.kod !== 0) { if (/HTTP 404/.test(r.fel)) return null; throw new Error(r.fel.trim().slice(0, 200)); }
      return JSON.parse(r.ut);
    },
    async filSvar(url) {
      const s = await fetch(url, { headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(60_000) });
      await s.body?.cancel();
      return { status: s.status, total: +(s.headers.get("content-range") ?? "").split("/")[1] };
    },
    processer() {
      const r = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", "Get-CimInstance Win32_Process | ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }"], { encoding: "utf8", timeout: 60_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
      if (r.status !== 0) throw new Error((r.stderr ?? "").trim().slice(0, 200) || "powershell föll");
      return r.stdout.split("\n").map((s) => s.trim()).filter(Boolean)
        .filter((s) => !s.startsWith(`${process.pid}\t`) && !s.includes("stada-publicering.mjs"));
    },
  };
}

async function torr(id, klon, m) {
  const film = { id, projekt: id };
  const post = (await m.videorOrigin()).find((v) => v.id === id);
  if (!post) { console.log(`${id} finns inte i videor.json på main`); return; }
  const k = await kontrollera(film, m);
  console.log(`Kontrollen: ${k.ok ? `godkänd, ${k.tagg}, ${k.namn}, ${gb(k.storlek)}` : `UNDERKÄND: ${k.skal}. Inget skulle tas bort.`}`);
  if (!k.ok) return;
  console.log(`Annat arbete: ${aktiv(film, m) ?? "inget"}`);
  const plan = planera(film, k, m);
  let summa = 0;
  for (const p of plan.poster) { summa += p.byte; console.log(`tas bort  ${gb(p.byte).padStart(9)}  ${path.relative(m.rot, p.sokvag).replace(/\\/g, "/")}`); }
  for (const t of plan.kvar) console.log(`kvar      ${t}`);
  const per = {};
  for (const p of plan.poster) per[p.sort] = (per[p.sort] ?? 0) + p.byte;
  console.log(`Summa ur projektet: ${gb(summa)} (${Object.entries(per).map(([s, b]) => `${s} ${gb(b)}`).join(", ")}). ${id}-1080p.mp4 står kvar.`);
  if (klon) {
    const l = klonLage(klon, m);
    console.log(`Klonen ${path.basename(klon)}: ${l.ok ? `skulle tas bort (${gb(storlek(klon))})` : `står kvar: ${l.skal}`}`);
  }
}

// ─── Provet ───────────────────────────────────────────────────────────────────────────────────────────────

async function prov() {
  const bas = fs.mkdtempSync(path.join(os.tmpdir(), "stada-prov-"));
  let fel = 0;
  const kolla = (namn, ok) => { console.log(`${ok ? "rätt" : "FEL "}  ${namn}`); if (!ok) fel++; };
  const TAGG = "film-a-v12";
  const FIL = `https://github.com/rw222ix-eng/matematikvideor/releases/download/${TAGG}/film-a-1080p.mp4`;
  const STORLEK = 1000;
  const skriv = (p, byte = 10, tid = null) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.alloc(byte));
    if (tid) fs.utimesSync(p, tid / 1000, tid / 1000);
  };
  // Allt i projektet är gammalt, utom det ett fall ändrar själv.
  const aldra = (p, t) => {
    const s = lst(p);
    if (s.isSymbolicLink()) return;
    if (s.isDirectory()) for (const n of fs.readdirSync(p)) aldra(path.join(p, n), t);
    fs.utimesSync(p, t / 1000, t / 1000);
  };
  const dag = 24 * TIMME;
  const nu0 = Date.now();
  let nr = 0;
  const nyMiljo = () => {
    const rot = path.join(bas, `rot${++nr}`);
    fs.mkdirSync(rot, { recursive: true });
    const proj = path.join(rot, "film-a");
    const exp = path.join(proj, "assets", "export");
    const cache = path.join(proj, "cache");
    skriv(path.join(exp, "film-a-1080p.mp4"), 500);
    skriv(path.join(exp, "film-a-1080p-klipp.mp4"), 400);
    skriv(path.join(exp, "utgar-111-film-a-1080p.mp4"), 300);
    skriv(path.join(exp, "utgar-222-film-a-1080p.mp4"), 301);
    skriv(path.join(cache, "release-v5", "film-a-1080p.mp4"), 100);
    skriv(path.join(cache, "release-v11", "film-a-1080p.mp4"), 110);
    skriv(path.join(cache, "release-v12-fore", "film-a-1080p.mp4"), 120);
    skriv(path.join(cache, "release-v12", "film-a-1080p.mp4"), STORLEK);
    skriv(path.join(cache, "release-o5", "film-a-1080p.mp4"), 50);
    skriv(path.join(cache, "release-v11-krock.log"), 5);
    skriv(path.join(cache, "rost", "tal-1.mp3"), 70);
    skriv(path.join(cache, "topaz", "klipp.mp4"), 80);
    skriv(path.join(cache, "ingang", "slutbild.png"), 90);
    skriv(path.join(proj, "assets", "tal.mp3"), 60);
    aldra(proj, nu0 - dag);
    fs.utimesSync(path.join(cache, "release-v5"), (nu0 - 9 * dag) / 1000, (nu0 - 9 * dag) / 1000);
    fs.utimesSync(path.join(cache, "release-v11"), (nu0 - 8 * dag) / 1000, (nu0 - 8 * dag) / 1000);
    fs.utimesSync(path.join(cache, "release-v12-fore"), (nu0 - 7 * dag) / 1000, (nu0 - 7 * dag) / 1000);
    fs.utimesSync(path.join(cache, "release-v12"), (nu0 - 6 * dag) / 1000, (nu0 - 6 * dag) / 1000);
    const m = {
      rot,
      mapp: path.join(rot, "_stadning"),
      jobbFil: path.join(rot, "jobb.json"),
      live: ["https://vercel.test/videor.json", "https://pages.test/videor.json"],
      tid: nu0,
      nu() { return this.tid; },
      videorOrigin: () => [{ id: "film-a", fil: FIL }],
      videorLive: () => [{ id: "film-a", fil: FIL }],
      release: () => ({ draft: false, published_at: new Date(nu0 - TIMME).toISOString(), assets: [{ name: "film-a-1080p.mp4", state: "uploaded", size: STORLEK }] }),
      filSvar: () => ({ status: 206, total: STORLEK }),
      processer: () => [],
    };
    m.nu = m.nu.bind(m);
    return { m, rot, proj, exp, cache, film: { id: "film-a", projekt: "film-a", kloner: [], anmald: nu0, skal: null } };
  };
  const finns = (p) => !!lst(p);
  const logg = (m) => { try { return fs.readFileSync(path.join(m.mapp, "stadning.log"), "utf8"); } catch { return ""; } };
  const inget = ({ exp, cache }) =>
    finns(path.join(exp, "utgar-111-film-a-1080p.mp4")) && finns(path.join(exp, "utgar-222-film-a-1080p.mp4")) &&
    finns(path.join(cache, "release-v5")) && finns(path.join(cache, "release-v11")) && finns(path.join(cache, "release-v12-fore"));
  const junction = (lank, mal) => execFileSync("cmd", ["/c", "mklink", "/J", path.resolve(lank), path.resolve(mal)], { stdio: "ignore", windowsHide: true });

  // Tempo-repo med riktig git. origin heter som repot, annars står klonen kvar.
  const g = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const nyKlon = (rot, namn = "vt-a") => {
    const bar = path.join(rot, "origin", "matematikvideor.git");
    if (!finns(bar)) {
      fs.mkdirSync(bar, { recursive: true });
      g(bar, "init", "-q", "--bare", "-b", "main");
    }
    const k = path.join(rot, namn);
    g(rot, "clone", "-q", bar, k);
    g(k, "config", "user.name", "p");
    g(k, "config", "user.email", "p@p");
    g(k, "config", "core.autocrlf", "false");
    return k;
  };
  const satsa = (k, videor, register = [{ id: "film-a", projekt: "../film-a" }]) => {
    fs.mkdirSync(path.join(k, "public"), { recursive: true });
    fs.writeFileSync(path.join(k, "public", "videor.json"), JSON.stringify({ videor }));
    fs.writeFileSync(path.join(k, "register.json"), JSON.stringify(register));
    fs.writeFileSync(path.join(k, ".gitignore"), "__pycache__/\nverktyg/.cache/\n.env*\n");
    g(k, "add", "-A");
    g(k, "commit", "-qm", "prov");
    return g(k, "rev-parse", "HEAD").trim();
  };
  const renKlon = (e, namn) => {
    const k = nyKlon(e.rot, namn);
    if (!g(k, "ls-remote", "origin", "main").trim()) { satsa(k, [{ id: "film-a", fil: FIL }]); g(k, "push", "-q", "origin", "main"); }
    else g(k, "pull", "-q", "--ff-only", "origin", "main");
    e.m.tid = nu0 + 3 * TIMME;
    return k;
  };

  try {
    // 1. Rätt filer försvinner.
    {
      const e = nyMiljo();
      const r = await behandla(e.film, e.m);
      const { exp, cache, proj } = e;
      kolla("utgar-filerna är borta", !finns(path.join(exp, "utgar-111-film-a-1080p.mp4")) && !finns(path.join(exp, "utgar-222-film-a-1080p.mp4")));
      kolla("slutfilen står kvar", lst(path.join(exp, "film-a-1080p.mp4"))?.size === 500);
      kolla("mellansteg utan sina klipp i cachen står kvar", finns(path.join(exp, "film-a-1080p-klipp.mp4")));
      kolla("äldre release-versioner är borta", !finns(path.join(cache, "release-v5")) && !finns(path.join(cache, "release-v11")) && !finns(path.join(cache, "release-v12-fore")));
      kolla("den aktuella release-mappen står kvar", finns(path.join(cache, "release-v12", "film-a-1080p.mp4")));
      kolla("release med annan form står kvar", finns(path.join(cache, "release-o5")) && finns(path.join(cache, "release-v11-krock.log")));
      kolla("röst, Topaz och ingång står kvar", finns(path.join(cache, "rost", "tal-1.mp3")) && finns(path.join(cache, "topaz", "klipp.mp4")) && finns(path.join(cache, "ingang", "slutbild.png")) && finns(path.join(proj, "assets", "tal.mp3")));
      kolla("posten lämnar kön", r.bort === true);
      const l = logg(e.m);
      kolla("loggen säger vad som togs bort och hur mycket", /tog bort film-a\/assets\/export\/utgar-111/.test(l) && /tog bort film-a\/cache\/release-v5 \(0,00 GB\)/.test(l) && /klart för film-a-v12/.test(l));
    }
    // 1b. Mellanstegen.
    {
      const e = nyMiljo();
      const g1 = (n) => path.join(e.exp, `film-a-1080p${n}`);
      const bort = ["-klipp", "-klipp-filmiskt", "-ingang-klipp", "-ingang-klipp-ljud", "-filmiskt", "-ingang", "-ingang-o5", "-ingang-v8", "-ingang-ljud-svalj", "-ingang-topaz", "-omni", "-omni-v3-ingang-hl", "-hl9d", "-v5", "-o6a", "-pub-v6", "-test-v9", "-slutfraga", "-fonster", "-a-lagad", "-komposant"];
      const kvar = ["-svans", "-svans-filmiskt", "-svans-klipp", "-hybrid", "-fore-svans", "-fore-fonster", "-misslyckad-svans", "-v12-master", "-release", "-film", "-musik3", "-nytt-namn"];
      for (const n of [...bort, ...kvar]) skriv(g1(`${n}.mp4`), 200);
      skriv(g1("-svans.json"), 5);
      skriv(g1("-fonster.json"), 5);
      skriv(path.join(e.exp, "film-a-1080p-kopia.txt"), 5);
      skriv(path.join(e.proj, "cache", "ingang", "veo.mp4"), 90);
      skriv(path.join(e.proj, "cache", "klipp", "klipp", "1-topaz.mp4"), 90);
      skriv(path.join(e.proj, "verktyg", "filmiskt.py"), 9);
      aldra(e.proj, nu0 - dag);
      const r = await behandla(e.film, e.m);
      kolla("mellanstegen som går att bygga om är borta", r.bort === true && bort.every((n) => !finns(g1(`${n}.mp4`))));
      kolla("-svans, -fore-*, -master och okända namn står kvar", kvar.every((n) => finns(g1(`${n}.mp4`))));
      kolla("json och annat än mp4 står kvar", finns(g1("-svans.json")) && finns(g1("-fonster.json")) && finns(path.join(e.exp, "film-a-1080p-kopia.txt")));
      kolla("slutfilen och klippen i cachen står kvar", lst(g1(".mp4"))?.size === 500 && finns(path.join(e.proj, "cache", "ingang", "veo.mp4")) && finns(path.join(e.proj, "cache", "klipp", "klipp", "1-topaz.mp4")));
      kolla("loggen säger att okända namn står kvar", /film-a-1080p-nytt-namn.mp4 är inget känt mellansteg/.test(logg(e.m)));
    }
    {
      kolla("namn utan projektet är inget mellansteg", !arMellansteg("annan-1080p-ingang.mp4", "film-a") && !arMellansteg("v12-film-a-1080p-ingang.mp4", "film-a"));
      kolla("exakt slutfilens namn är inget mellansteg", !arMellansteg("film-a-1080p.mp4", "film-a"));
      const fall = async (namn, gor, sant) => {
        const e = nyMiljo();
        const f = path.join(e.exp, "film-a-1080p-ingang.mp4");
        skriv(f, 200);
        skriv(path.join(e.proj, "cache", "ingang", "veo.mp4"), 90);
        aldra(e.proj, nu0 - dag);
        gor(e, f);
        await behandla(e.film, e.m);
        kolla(namn, sant(finns(f), e));
      };
      const lista = (e, rel, innehall) => { skriv(path.join(e.rot, rel), 1); fs.writeFileSync(path.join(e.rot, rel), innehall); };
      await fall("kontrollfilen utan hinder: mellansteget borta", () => {}, (f) => !f);
      await fall("kontrollen fallerar: mellansteget står kvar", (e) => { e.m.release = () => null; }, (f) => f);
      await fall("publiceringstiden saknas: mellansteget står kvar, utgar borta", (e) => { e.m.release = () => ({ draft: false, assets: [{ name: "film-a-1080p.mp4", state: "uploaded", size: STORLEK }] }); }, (f, e) => f && !finns(path.join(e.exp, "utgar-111-film-a-1080p.mp4")));
      await fall("nyare än publiceringen, kommande omgång: står kvar", (e, f) => { fs.utimesSync(f, (nu0 - 30 * MINUT) / 1000, (nu0 - 30 * MINUT) / 1000); }, (f) => f);
      await fall("lika stor som den publicerade: står kvar", (e, f) => { fs.writeFileSync(f, Buffer.alloc(STORLEK)); fs.utimesSync(f, (nu0 - dag) / 1000, (nu0 - dag) / 1000); }, (f) => f);
      await fall("klippet saknas i cachen: står kvar", (e) => { fs.unlinkSync(path.join(e.proj, "cache", "ingang", "veo.mp4")); fs.utimesSync(path.join(e.proj, "cache", "ingang"), (nu0 - dag) / 1000, (nu0 - dag) / 1000); fs.utimesSync(path.join(e.proj, "cache"), (nu0 - dag) / 1000, (nu0 - dag) / 1000); }, (f) => f);
      await fall("publicerat.json pekar på filen: står kvar", (e) => { lista(e, "_scratch/slutfragan/publicerat.json", JSON.stringify({ "film-a": { url: FIL, lokal: "film-a/assets/export/film-a-1080p-ingang.mp4" } })); }, (f) => f);
      await fall("publicerat.json gäller en äldre version: skyddar inte", (e) => { lista(e, "_scratch/slutfragan/publicerat.json", JSON.stringify({ "film-a": { url: "gammal", lokal: "film-a/assets/export/film-a-1080p-ingang.mp4" } })); }, (f) => !f);
      await fall("karta.json har filen som källa: står kvar", (e) => { lista(e, "_scratch/hack-utlagda/karta.json", JSON.stringify([{ id: "film-a", fil: FIL, kalla: "E:/x/film-a-1080p-ingang.mp4" }])); }, (f) => f);
      await fall("en lista går inte att läsa: mellansteget står kvar, utgar borta", (e) => { lista(e, "_scratch/hack-utlagda/karta.json", "{trasig"); }, (f, e) => f && !finns(path.join(e.exp, "utgar-111-film-a-1080p.mp4")));
      await fall("rors-inte.txt: filer och mappar som någon annan flyttar rörs inte", (e, f) => { skriv(path.join(e.m.mapp, "rors-inte.txt"), 1); fs.writeFileSync(path.join(e.m.mapp, "rors-inte.txt"), `${f}\r\n${path.join(e.exp, "utgar-111-film-a-1080p.mp4")}\n${path.join(e.cache, "release-v5")}\n`); }, (f, e) => f && finns(path.join(e.exp, "utgar-111-film-a-1080p.mp4")) && finns(path.join(e.cache, "release-v5")) && !finns(path.join(e.exp, "utgar-222-film-a-1080p.mp4")));
    }
    // 2. Valet av release-mappar.
    {
      const mapp = (namn, d) => ({ namn, mtimeMs: d });
      const v = valjReleaseMappar([mapp("release-v5", 1), mapp("release-v12", 5), mapp("release-v13", 9), mapp("release-v14", 8), mapp("release", 1)], TAGG);
      kolla("opublicerad nyare version står kvar", v.bort.join() === "release-v5" && v.kvar.includes("release-v13") && v.kvar.includes("release-v14"));
      kolla("tagg utan version rör inget", valjReleaseMappar([mapp("release-v1", 1)], "film-a").bort.length === 0);
      kolla("den nyaste äldre mappen står kvar", valjReleaseMappar([mapp("release-v11", 9), mapp("release-v12", 5)], TAGG).bort.length === 0);
    }
    // 3. Fallerar kontrollen tas inget bort.
    const fallera = [
      ["releasen finns inte", (m) => { m.release = () => null; }],
      ["releasen är ett utkast", (m) => { m.release = () => ({ draft: true, assets: [] }); }],
      ["filen saknas i releasen", (m) => { m.release = () => ({ draft: false, assets: [] }); }],
      ["filen är inte färdig", (m) => { m.release = () => ({ draft: false, assets: [{ name: "film-a-1080p.mp4", state: "starter", size: STORLEK }] }); }],
      ["releasen har fel storlek mot den lokala filen", (m) => { m.release = () => ({ draft: false, published_at: new Date(nu0).toISOString(), assets: [{ name: "film-a-1080p.mp4", state: "uploaded", size: 999 }] }); m.filSvar = () => ({ status: 206, total: 999 }); }],
      ["adressen svarar med fel storlek", (m) => { m.filSvar = () => ({ status: 206, total: 7 }); }],
      ["adressen svarar 404", (m) => { m.filSvar = () => ({ status: 404 }); }],
      ["videor.json på main pekar fel", (m) => { m.videorOrigin = () => [{ id: "film-a", fil: FIL.replace("-v12", "-v11") }]; }],
      ["videor.json på main saknar filmen", (m) => { m.videorOrigin = () => []; }],
      ["main går inte att läsa", (m) => { m.videorOrigin = () => { throw new Error("nätet"); }; }],
      ["Vercel visar den gamla", (m) => { m.videorLive = (u) => (u.includes("vercel") ? [{ id: "film-a", fil: "gammal" }] : [{ id: "film-a", fil: FIL }]); }],
      ["Pages går inte att läsa", (m) => { m.videorLive = (u) => { if (u.includes("pages")) throw new Error("nere"); return [{ id: "film-a", fil: FIL }]; }; }],
    ];
    for (const [namn, andra] of fallera) {
      const e = nyMiljo();
      andra(e.m);
      const r = await behandla(e.film, e.m);
      kolla(`kontrollen fallerar, ${namn}: inget borttaget, väntar`, inget(e) && !r.bort && r.skal);
    }
    {
      const e = nyMiljo();
      fs.unlinkSync(path.join(e.exp, "film-a-1080p.mp4"));
      const r = await behandla(e.film, e.m);
      kolla("slutfilen saknas: inget borttaget", inget(e) && !r.bort);
    }
    {
      const e = nyMiljo();
      e.m.release = () => null;
      const k = renKlon(e);
      e.film.kloner = [k];
      e.m.tid = nu0 + GE_UPP_KONTROLL + MINUT;
      const r = await behandla(e.film, e.m);
      kolla("kontrollen går aldrig igenom: ger upp, inget borttaget, klonen orörd", r.bort === true && inget(e) && finns(k) && /INGET BORTTAGET/.test(logg(e.m)));
    }
    // 4. En utgar-fil eller release-mapp med den publicerade filen.
    {
      const e = nyMiljo();
      skriv(path.join(e.exp, "utgar-333-film-a-1080p.mp4"), STORLEK);
      skriv(path.join(e.cache, "release-v9", "film-a-1080p.mp4"), STORLEK);
      aldra(e.proj, nu0 - dag);
      fs.utimesSync(path.join(e.cache, "release-v9"), (nu0 - 9 * dag) / 1000, (nu0 - 9 * dag) / 1000);
      await behandla(e.film, e.m);
      kolla("den publicerade filens kopia står kvar under annat namn", finns(path.join(e.exp, "utgar-333-film-a-1080p.mp4")) && finns(path.join(e.cache, "release-v9")));
    }
    // 5. Junctions följs aldrig.
    {
      const e = nyMiljo();
      const mal = path.join(e.rot, "viktigt");
      skriv(path.join(mal, "original.mp4"), 42);
      junction(path.join(e.cache, "release-v5", "lank"), mal);
      junction(path.join(e.cache, "release-v3"), mal);
      aldra(e.proj, nu0 - dag);
      fs.utimesSync(path.join(e.cache, "release-v5"), (nu0 - 9 * dag) / 1000, (nu0 - 9 * dag) / 1000);
      fs.utimesSync(path.join(e.cache, "release-v12"), (nu0 - 6 * dag) / 1000, (nu0 - 6 * dag) / 1000);
      kolla("Node ser junctionen som en länk", lst(path.join(e.cache, "release-v3")).isSymbolicLink());
      await behandla(e.film, e.m);
      kolla("junction i en borttagen mapp: mappen borta, målet orört", !finns(path.join(e.cache, "release-v5")) && lst(path.join(mal, "original.mp4"))?.size === 42);
      kolla("release-mapp som själv är en junction rörs inte", finns(path.join(e.cache, "release-v3")) && /release-v3 är en länk/.test(logg(e.m)));
    }
    {
      const e = nyMiljo();
      const mal = path.join(e.rot, "viktigt-export");
      skriv(path.join(mal, "utgar-1-original.mp4"), 42);
      skriv(path.join(mal, "film-a-1080p.mp4"), STORLEK);
      fs.renameSync(e.exp, path.join(e.proj, "assets", "export-riktig"));
      junction(e.exp, mal);
      aldra(e.proj, nu0 - dag);
      aldra(mal, nu0 - dag);
      await behandla(e.film, e.m);
      kolla("assets/export som junction: filerna i målet orörda", lst(path.join(mal, "utgar-1-original.mp4"))?.size === 42);
    }
    // 6. Filmen som ett annat jobb arbetar med.
    {
      const e = nyMiljo();
      fs.writeFileSync(e.m.jobbFil, JSON.stringify({ jobb: [{ titel: "Export", status: "kor", mapp: "E:\\Matematikvideos\\film-a", kommando: "node x", logg: "" }] }));
      const r = await behandla(e.film, e.m);
      kolla("jobb igång i kön: inget borttaget", inget(e) && /Export/.test(r.skal));
      fs.writeFileSync(e.m.jobbFil, JSON.stringify({ jobb: [{ titel: "Väntar", status: "ko", mapp: "E:/x", kommando: "python E:/Matematikvideos/film-a/filmiskt.py", logg: "" }] }));
      const r2 = await behandla(e.film, e.m);
      kolla("jobb väntar i kön: inget borttaget", inget(e) && /Väntar/.test(r2.skal));
      fs.writeFileSync(e.m.jobbFil, JSON.stringify({ jobb: [{ titel: "Klart", status: "klart", mapp: "E:/Matematikvideos/film-a", kommando: "x", logg: "" }] }));
      const r3 = await behandla(e.film, e.m);
      kolla("avslutat jobb stoppar inte", r3.bort === true && !inget(e));
    }
    {
      const e = nyMiljo();
      e.m.processer = () => ["ffmpeg -i E:/Matematikvideos/film-a/assets/export/x.mp4 y.mp4"];
      const r = await behandla(e.film, e.m);
      kolla("process igång: inget borttaget", inget(e) && /process rör/.test(r.skal));
    }
    {
      const e = nyMiljo();
      e.m.processer = () => { throw new Error("powershell föll"); };
      const r = await behandla(e.film, e.m);
      kolla("processlistan går inte att läsa: inget borttaget", inget(e) && !r.bort);
    }
    {
      const e = nyMiljo();
      skriv(path.join(e.rot, ".las", "appen", "vem.txt"), 0);
      fs.writeFileSync(path.join(e.rot, ".las", "appen", "vem.txt"), "E:/Matematikvideos/film-a export");
      const r = await behandla(e.film, e.m);
      kolla(".las/appen taget för filmen: inget borttaget", inget(e) && /appen/.test(r.skal));
    }
    {
      const e = nyMiljo();
      fs.writeFileSync(path.join(e.exp, "film-a-1080p-klipp.mp4"), "ny");
      const r = await behandla(e.film, e.m);
      kolla("fil ändrad nyss: inget borttaget", inget(e) && /15 minuterna/.test(r.skal));
      e.m.tid = nu0 + 16 * MINUT;
      const r2 = await behandla(e.film, e.m);
      kolla("när projektet är stilla igen städas det", r2.bort === true && !inget(e));
    }
    // 7. Klonen.
    {
      const e = nyMiljo();
      const k = renKlon(e);
      e.film.kloner = [k];
      const r = await behandla(e.film, e.m);
      kolla("ren, pushad klon utan arbete: borta", !finns(k) && r.bort === true && /tog bort klonen vt-a/.test(logg(e.m)));
      kolla("origin orörd", finns(path.join(e.rot, "origin", "matematikvideor.git", "HEAD")));
    }
    const klonFall = [
      ["ändrad fil", (k) => fs.appendFileSync(path.join(k, "register.json"), " ")],
      ["ospårad fil", (k) => fs.writeFileSync(path.join(k, "ny.txt"), "x")],
      ["ignorerad .env", (k) => fs.writeFileSync(path.join(k, ".env"), "x")],
      ["opushad commit", (k) => { fs.writeFileSync(path.join(k, "ny.txt"), "x"); g(k, "add", "-A"); g(k, "commit", "-qm", "opushad"); }],
      ["commit på en annan gren", (k) => { g(k, "checkout", "-qb", "sido"); fs.writeFileSync(path.join(k, "ny.txt"), "x"); g(k, "add", "-A"); g(k, "commit", "-qm", "sido"); g(k, "checkout", "-q", "main"); }],
      ["stash", (k) => { fs.appendFileSync(path.join(k, "register.json"), " "); g(k, "stash", "-q"); }],
    ];
    for (const [namn, gor] of klonFall) {
      const e = nyMiljo();
      const k = renKlon(e);
      gor(k);
      e.m.tid = Date.now() + 3 * TIMME;
      e.film.kloner = [k];
      e.film.anmald = e.m.tid;
      const r = await behandla(e.film, e.m);
      kolla(`klon med ${namn}: står kvar, skrivs i loggen`, finns(k) && !r.bort && /väntar: vt-a:/.test(logg(e.m)));
      kolla(`klon med ${namn}: filmens filer städades ändå`, !inget(e));
    }
    {
      const e = nyMiljo();
      const k = renKlon(e);
      fs.writeFileSync(path.join(k, "ny.txt"), "x");
      e.m.tid = Date.now() + GE_UPP_VANTAN + TIMME;
      e.film.kloner = [k];
      const r = await behandla(e.film, e.m);
      kolla("smutsig klon efter ett dygn: står kvar och loggas, kön töms", finns(k) && r.bort === true && /klonen vt-a står kvar/.test(logg(e.m)));
    }
    {
      const e = nyMiljo();
      const k = renKlon(e);
      e.m.tid = Date.now() + MINUT;
      e.film.kloner = [k];
      e.film.anmald = e.m.tid;
      const r = await behandla(e.film, e.m);
      kolla("klon använd nyss: står kvar till 2 timmar gått", finns(k) && !r.bort && /2 timmarna/.test(r.skal));
    }
    {
      const e = nyMiljo();
      const k = renKlon(e);
      const mal = path.join(e.rot, "mal-klon");
      skriv(path.join(mal, "original.txt"), 7);
      junction(path.join(k, "lank"), mal);
      // Git ser junctionen som ospårad, så den ska stå kvar. Samma mål utan git-kontrollen raderas säkert.
      e.m.tid = Date.now() + 3 * TIMME;
      kolla("klon med ospårad junction står kvar", !klonLage(k, e.m).ok);
      const ny = taBortKlon(k, e.m);
      kolla("radering av klon med junction: målet orört, klonen borta", ny >= 0 && !finns(k) && lst(path.join(mal, "original.txt"))?.size === 7);
    }
    {
      const e = nyMiljo();
      const annan = path.join(e.rot, "annan");
      fs.mkdirSync(annan);
      kolla("mapp som inte heter vt- tas aldrig bort", !klonLage(annan, e.m).ok);
      kolla("klon utanför roten tas aldrig bort", !klonLage(path.join(bas, "vt-utanfor"), e.m).ok);
    }
    // 8. Anmälan efter en push.
    {
      const e = nyMiljo();
      const k = nyKlon(e.rot);
      const reg = [{ id: "film-a", projekt: "../film-a" }, { id: "film-b", projekt: "../film-b" }];
      const a = satsa(k, [{ id: "film-a", fil: "g1" }, { id: "film-b", fil: "g2" }], reg);
      const b = satsa(k, [{ id: "film-a", fil: FIL }, { id: "film-b", fil: "g2" }, { id: "film-c" }], reg);
      kolla("bara filmen med ny fil räknas", filmerMellan(k, a, b).map((f) => f.id).join() === "film-a");
      fs.writeFileSync(path.join(k, "annat.txt"), "x");
      g(k, "add", "-A");
      g(k, "commit", "-qm", "sidan");
      const c = g(k, "rev-parse", "HEAD").trim();
      kolla("push utan ny film: ingen post, klonen står kvar", anmal(k, b, c, e.m) === 0 && lasKo(e.m).filmer.length === 0 && finns(k));
      kolla("anmälan utan film skriver senast", lasKo(e.m).senast === c);
    }
    {
      const e = nyMiljo();
      const k = nyKlon(e.rot);
      const a = satsa(k, [{ id: "film-a", fil: "g1" }]);
      const b = satsa(k, [{ id: "film-a", fil: FIL }]);
      kolla("push med ny film: posten i kön med klonen", anmal(k, a, b, e.m) === 1 && lasKo(e.m).filmer[0].kloner[0] === k);
      const ko = lasKo(e.m);
      kolla("posten pekar på rätt projekt", ko.filmer[0].projekt === "film-a");
      anmal(k, a, b, e.m);
      kolla("samma film två gånger ger en post", lasKo(e.m).filmer.length === 1);
    }
    {
      const e = nyMiljo();
      const k = nyKlon(e.rot);
      const a = satsa(k, [{ id: "film-a", fil: "g1" }, { id: "x", fil: "g" }], [{ id: "film-a", projekt: "../film-a" }, { id: "x", projekt: "../../farligt" }]);
      const b = satsa(k, [{ id: "film-a", fil: "g1" }, { id: "x", fil: "ny" }], [{ id: "film-a", projekt: "../film-a" }, { id: "x", projekt: "../../farligt" }]);
      anmal(k, a, b, e.m);
      kolla("projekt utanför roten tas inte med", lasKo(e.m).filmer.length === 0 && /inget projekt/.test(logg(e.m)));
    }
    // 9. Hela vägen genom sopa, med kön på disk.
    {
      const e = nyMiljo();
      const k = nyKlon(e.rot);
      const a = satsa(k, [{ id: "film-a", fil: "g1" }]);
      const b = satsa(k, [{ id: "film-a", fil: FIL }]);
      g(k, "push", "-q", "origin", "main");
      anmal(k, a, b, e.m);
      e.m.tid = Date.now() + 3 * TIMME;
      const svar = await sopa(e.m, { vila: 0 });
      kolla("sopa arbetar av kön: filer och klon borta, slutfilen kvar", svar === true && !finns(k) && !inget(e) && finns(path.join(e.exp, "film-a-1080p.mp4")) && lasKo(e.m).filmer.length === 0);
      kolla("sopa släpper sin pid-fil", !finns(path.join(e.m.mapp, "sopare.pid")));
      fs.writeFileSync(path.join(e.m.mapp, "sopare.pid"), String(process.pid));
      kolla("en sopare i taget", (await sopa(e.m, { vila: 0 })) === false);
    }
    {
      const e = nyMiljo();
      const k = renKlon(e);
      fs.writeFileSync(e.m.jobbFil, JSON.stringify({ jobb: [] }));
      const film2 = { id: "film-b", projekt: "film-b", kloner: [k], anmald: e.m.tid, filmKlar: false };
      medKo(e.m, (ko) => { ko.filmer.push({ ...e.film, kloner: [k], anmald: e.m.tid }, film2); });
      e.m.videorOrigin = () => [{ id: "film-a", fil: FIL }];
      const svar = await behandla({ ...e.film, kloner: [k], anmald: e.m.tid }, { ...e.m, nu: e.m.nu, klonDelas: () => true });
      kolla("klon som en annan film väntar på står kvar", finns(k) && !svar.bort);
    }
  } catch (err) {
    kolla(`provet föll: ${err.stack}`, false);
  } finally {
    try { radera(bas); } catch (e) { console.log(`provmappen ligger kvar: ${e.message}`); }
  }
  console.log(fel ? `${fel} fall fel` : "alla fall rätt");
  process.exit(fel ? 1 : 0);
}

// ─── Kommandon ────────────────────────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flagga = (namn) => { const i = argv.indexOf(`--${namn}`); return i >= 0 ? argv[i + 1] : undefined; };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.chdir(os.tmpdir());
  const m = verkligMiljo();
  if (argv[0] === "--prov") await prov();
  else if (argv[0] === "torr") await torr(argv[1], flagga("klon"), m);
  else if (argv[0] === "sopa") await sopa(m);
  else if (argv[0] === "anmal") {
    try {
      const antal = anmal(path.resolve(flagga("klon")).replace(/\\/g, "/"), flagga("fore"), flagga("efter"), m);
      if (antal || lasKo(m).filmer.length) await sopa(m);
    } catch (e) { logga(m, "-", `anmälan föll: ${e.message}`); }
  } else {
    console.log("Kommandon: torr <film-id> [--klon <klon>] · sopa · --prov");
    process.exit(1);
  }
}
