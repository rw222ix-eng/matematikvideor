/**
 * Lägger en rörelse (t.ex. armen i en vinkning) från ChatGPT-rutor på Newtons grundbild.
 *
 *   node verktyg/newton-arm.mjs <namn> <x0,y0,x1,y1[;x0,y0,x1,y1…]> <ruta1.png> [<ruta2.png> ...]
 *
 * ChatGPT målar om hela bilden varje gång: penseldragen ändras lite överallt och huvudet vrids
 * ofta. Ett bildspel av rena rutor skulle därför "koka". Här tas ur varje ruta bara det som
 * skiljer sig tydligt från grundbilden (assets/figur/newton-prata.png) och bara inom området
 * x0,y0–x1,y1 (originalets pixlar; flera områden skiljs med semikolon, t.ex. när en lyft hand
 * ligger nära håret och området måste gå runt huvudet), med mjuk kant; allt annat är grundbildens pixlar. Resultatet
 * skrivs som assets/figur/<namn>-01.png, -02.png … och friställs sedan med verktyg/newton.mjs
 * tillsammans med de andra bilderna, så att allt får samma ram.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HÄR = dirname(fileURLToPath(import.meta.url));
const [namn, omrade, ...rutor] = process.argv.slice(2);
if (!namn || !omrade || !rutor.length) { console.error("Användning: node verktyg/newton-arm.mjs <namn> <x0,y0,x1,y1> <ruta.png> ..."); process.exit(1); }
const OMRADEN = omrade.split(";").map((r) => r.split(",").map(Number));
const W = 1254, H = 1254;
const las = (fil) => execFileSync("ffmpeg", ["-v", "error", "-i", fil, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 28 });
const bas = las(join(HÄR, "..", "assets", "figur", "newton-prata.png"));

const LAG = 22, HOG = 55;   // skillnad (summa r+g+b, utjämnad) som börjar räknas som rörelse, och full rörelse
const KANT = 18;            // mjuk övergång i områdets kant
const VAXT = 5, SUDD = 4;   // masken växer och suddas ut så att armen kommer med hel

function boxsudd(a, r) {
  const ut = new Float32Array(W * H), tmp = new Float32Array(W * H);
  for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[y * W + x] = s / (2 * r + 1); s += a[y * W + Math.min(W - 1, x + r + 1)] - a[y * W + Math.max(0, x - r)]; } }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { ut[y * W + x] = s / (2 * r + 1); s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
  return ut;
}
function vax(a, r) {
  const tmp = new Float32Array(W * H), ut = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = 0; for (let d = -r; d <= r; d++) { const v = a[y * W + Math.min(W - 1, Math.max(0, x + d))]; if (v > m) m = v; } tmp[y * W + x] = m; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = 0; for (let d = -r; d <= r; d++) { const v = tmp[Math.min(H - 1, Math.max(0, y + d)) * W + x]; if (v > m) m = v; } ut[y * W + x] = m; }
  return ut;
}
const steg = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

rutor.forEach((fil, n) => {
  const r = las(fil);
  const diff = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) diff[i] = Math.abs(r[i * 4] - bas[i * 4]) + Math.abs(r[i * 4 + 1] - bas[i * 4 + 1]) + Math.abs(r[i * 4 + 2] - bas[i * 4 + 2]);
  const jamn = boxsudd(diff, 3);
  let mask = new Float32Array(W * H);
  for (const [X0, Y0, X1, Y1] of OMRADEN) for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    const i = y * W + x, kant = Math.min(x - X0, X1 - x, y - Y0, Y1 - y);
    mask[i] = Math.max(mask[i], steg(LAG, HOG, jamn[i]) * steg(0, KANT, kant));
  }
  mask = boxsudd(vax(mask, VAXT), SUDD);
  const ut = Buffer.from(bas);
  let andel = 0;
  for (let i = 0; i < W * H; i++) {
    const m = mask[i]; if (m <= 0.002) continue;
    andel += m;
    for (let k = 0; k < 4; k++) ut[i * 4 + k] = Math.round(bas[i * 4 + k] * (1 - m) + r[i * 4 + k] * m);
  }
  const malfil = join(HÄR, "..", "assets", "figur", `${namn}-${String(n + 1).padStart(2, "0")}.png`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-i", "pipe:0", malfil], { input: ut });
  console.log(`${malfil.replace(join(HÄR, "..") + "/", "")}: ${Math.round(andel)} pixlar ur rutan`);
});
