/**
 * Friställer tipsfigurens bilder (Newton, ChatGPT-projektet) till genomskinliga WebP.
 *
 *   node verktyg/newton.mjs <höjd i px> <källa.png> [<källa.png> ...]
 *
 * Bilderna är målade på en platt bakgrund (#171414 i prompten, 22/18/17 i filen). Bakgrunden
 * fylls inåt från bildens kanter så länge färgen ligger nära bakgrundens: då blir figurens egna
 * mörka partier (skorna är nästan svarta, 0/0/0) kvar, vilket en färgnyckel över hela bilden
 * inte klarar. Konturen får en mjuk kant, och kantpixlarna rensas från bakgrundens färg.
 *
 * Alla bilder beskärs med SAMMA ram (unionen av figurerna), så att uttrycken ligger exakt på
 * varandra när sidan byter mellan dem. Resultatet hamnar i public/figur/<namn>.webp.
 * Kräver ffmpeg, ffprobe och cwebp (brew install webp).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HÄR = dirname(fileURLToPath(import.meta.url));
const UT = join(HÄR, "..", "public", "figur");
const [hojdArg, ...kallor] = process.argv.slice(2);
const HOJD = Number(hojdArg);
if (!HOJD || !kallor.length) { console.error("Användning: node verktyg/newton.mjs <höjd> <källa.png> ..."); process.exit(1); }

const HARD = 18;   // så här nära bakgrunden (summan av skillnaderna i r, g, b) räknas som bakgrund
const MJUK = 70;   // hit når den mjuka kanten: däremellan blir pixeln delvis genomskinlig
const SPANN = 10;  // största skillnad inom 5×5 som fortfarande räknas som jämn bakgrund
const VAXT = 4;    // så många pixlar växer bakgrunden in mot konturen på färgen enbart
const MARGINAL = 10;

function las(fil) {
  const [w, h] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", fil], { encoding: "utf8" }).trim().split(",").map(Number);
  const rgba = execFileSync("ffmpeg", ["-v", "error", "-i", fil, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 28 });
  return { w, h, rgba };
}

function frilagg({ w, h, rgba }) {
  // Bakgrundens färg: medianen av kantpixlarna.
  const kant = [];
  for (let x = 0; x < w; x++) kant.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) kant.push(y * w, y * w + w - 1);
  const med = (k) => { const v = kant.map((i) => rgba[i * 4 + k]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const bg = [med(0), med(1), med(2)];
  const avst = (i) => Math.abs(rgba[i * 4] - bg[0]) + Math.abs(rgba[i * 4 + 1] - bg[1]) + Math.abs(rgba[i * 4 + 2] - bg[2]);
  // Bakgrunden är nästan helt jämn (spridning ~1,5 i summan r+g+b), medan målningens mörka
  // partier har penseldrag (byxorna 7–18) fast färgen ibland är densamma. Fyllningen får därför
  // bara gå genom pixlar vars omgivning (5×5) också är jämn; annars rann den in i byxorna genom
  // glipan mellan benen (2026-09-25).
  const sum = new Int16Array(w * h);
  for (let i = 0; i < w * h; i++) sum[i] = rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2];
  const R = 2, lo = new Int16Array(w * h), hi = new Int16Array(w * h), lo2 = new Int16Array(w * h), hi2 = new Int16Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 999, b = -1; for (let d = -R; d <= R; d++) { const xx = Math.min(w - 1, Math.max(0, x + d)), v = sum[y * w + xx]; if (v < a) a = v; if (v > b) b = v; }
    lo[y * w + x] = a; hi[y * w + x] = b;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 999, b = -1; for (let d = -R; d <= R; d++) { const yy = Math.min(h - 1, Math.max(0, y + d)), j = yy * w + x; if (lo[j] < a) a = lo[j]; if (hi[j] > b) b = hi[j]; }
    lo2[y * w + x] = a; hi2[y * w + x] = b;
  }
  const jamn = (i) => hi2[i] - lo2[i] <= SPANN;
  // Fyll bakgrunden inåt från kanterna, bara genom jämna ytor.
  const bak = new Uint8Array(w * h), ko = new Int32Array(w * h);
  let fram = 0, bakre = 0;
  for (const i of kant) if (!bak[i] && avst(i) <= HARD && jamn(i)) { bak[i] = 1; ko[bakre++] = i; }
  while (fram < bakre) {
    const i = ko[fram++], x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!bak[j] && avst(j) <= HARD && jamn(j)) { bak[j] = 1; ko[bakre++] = j; }
    }
  }
  // Närmast konturen är omgivningen aldrig jämn (figuren ligger i den): väx där några pixlar
  // till, på färgen enbart, så att bakgrunden går ända fram till figuren.
  for (let varv = 0; varv < VAXT; varv++) {
    const nya = [];
    for (let i = 0; i < w * h; i++) {
      if (bak[i] || avst(i) > HARD) continue;
      const x = i % w, y = (i / w) | 0;
      if ((x > 0 && bak[i - 1]) || (x < w - 1 && bak[i + 1]) || (y > 0 && bak[i - w]) || (y < h - 1 && bak[i + w])) nya.push(i);
    }
    for (const i of nya) bak[i] = 1;
  }
  // Alfa: 0 i bakgrunden, mjuk kant i ett band på två pixlar runt den, annars 255.
  const alfa = new Uint8Array(w * h).fill(255);
  for (let i = 0; i < w * h; i++) if (bak[i]) alfa[i] = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (bak[i]) continue;
    let nara = false;
    for (let dy = -2; dy <= 2 && !nara; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && bak[ny * w + nx]) { nara = true; break; }
    }
    if (!nara) continue;
    const a = Math.max(0, Math.min(1, (avst(i) - HARD) / (MJUK - HARD)));
    alfa[i] = Math.round(a * 255);
    // Ta bort bakgrundens färg ur kantpixeln, så att ingen mörk rand följer med.
    if (a > 0.05 && a < 1) for (let k = 0; k < 3; k++) rgba[i * 4 + k] = Math.max(0, Math.min(255, Math.round(bg[k] + (rgba[i * 4 + k] - bg[k]) / a)));
  }
  for (let i = 0; i < w * h; i++) rgba[i * 4 + 3] = alfa[i];
  // Figurens ram.
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alfa[y * w + x] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { bg, ram: [x0, y0, x1, y1] };
}

const bilder = kallor.map((fil) => { const b = las(fil); const r = frilagg(b); console.log(`${basename(fil)}: bakgrund ${r.bg.join("/")}, figur ${r.ram.join(",")}`); return { fil, ...b, ...r }; });
const { w, h } = bilder[0];
if (bilder.some((b) => b.w !== w || b.h !== h)) { console.error("Bilderna har olika storlek — de måste vara lika stora för att ligga på varandra."); process.exit(1); }
const x0 = Math.max(0, Math.min(...bilder.map((b) => b.ram[0])) - MARGINAL), y0 = Math.max(0, Math.min(...bilder.map((b) => b.ram[1])) - MARGINAL);
const x1 = Math.min(w - 1, Math.max(...bilder.map((b) => b.ram[2])) + MARGINAL), y1 = Math.min(h - 1, Math.max(...bilder.map((b) => b.ram[3])) + MARGINAL);
const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
console.log(`Gemensam ram: ${bw}×${bh} från (${x0}, ${y0}), skalas till höjd ${HOJD}.`);

mkdirSync(UT, { recursive: true });
for (const b of bilder) {
  const beskuren = Buffer.alloc(bw * bh * 4);
  for (let y = 0; y < bh; y++) b.rgba.copy(beskuren, y * bw * 4, ((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + bw) * 4);
  const namn = basename(b.fil, ".png"), tmp = join(tmpdir(), `${namn}-${process.pid}.png`), ut = join(UT, `${namn}.webp`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${bw}x${bh}`, "-i", "-", "-vf", `scale=-2:${HOJD}:flags=lanczos`, "-pix_fmt", "rgba", tmp], { input: beskuren });
  execFileSync("cwebp", ["-quiet", "-q", "86", "-alpha_q", "92", "-m", "6", tmp, "-o", ut]);
  unlinkSync(tmp);
  console.log(`  public/figur/${namn}.webp`);
}
