/**
 * Gör Newtons blinkbild ur originalet (assets/figur/newton-prata.png → newton-blink.png).
 *
 *   node verktyg/newton-blink.mjs
 *
 * ChatGPT vred huvudet mot betraktaren varje gång ögonen stängdes (två försök 2026-09-25), och
 * ett bildbyte till en sådan bild ser ut som ett ryck. Här målas i stället ögonlocken över
 * originalets ögon: huden strax ovanför varje öga dras ner över ögat, och en mörk fransrad läggs
 * i en svag båge. Allt annat är originalets pixlar, så bilderna ligger exakt på varandra.
 * Ögonens läge (mitt, halvbredd, halvhöjd i originalets pixlar) är uppmätt i en förstoring.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HÄR = dirname(fileURLToPath(import.meta.url));
const KALLA = join(HÄR, "..", "assets", "figur", "newton-prata.png"), MAL = join(HÄR, "..", "assets", "figur", "newton-blink.png");
const W = 1254, H = 1254;
const OGON = [{ cx: 597, cy: 123, rx: 9, ry: 5.5 }, { cx: 640.5, cy: 132, rx: 10.5, ry: 5.5 }];

const rgba = execFileSync("ffmpeg", ["-v", "error", "-i", KALLA, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 28 });
const org = Buffer.from(rgba);
const hamta = (x, y, k) => org[(Math.round(y) * W + Math.round(x)) * 4 + k];
const blanda = (i, farg, a) => { for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(rgba[i + k] * (1 - a) + farg[k] * a); };

for (const { cx, cy, rx, ry } of OGON) {
  const RX = rx + 3, RY = ry + 2.5;   // med mjuk kant
  for (let y = Math.floor(cy - RY); y <= Math.ceil(cy + RY); y++) for (let x = Math.floor(cx - RX); x <= Math.ceil(cx + RX); x++) {
    const d = Math.hypot((x - cx) / RX, (y - cy) / RY);
    if (d >= 1) continue;
    const a = Math.min(1, (1 - d) / 0.35);   // full täckning inne i ögat, mjuk ut mot kanten
    // Huden: samma kolumn, strax ovanför ögat, med lite av höjdens tonförändring bevarad.
    const kallY = cy - ry - 3.5 + (y - cy) * 0.25;
    const hud = [0, 1, 2].map((k) => (hamta(x - 1, kallY, k) + hamta(x, kallY, k) * 2 + hamta(x + 1, kallY, k)) / 4);
    blanda((y * W + x) * 4, hud, a);
  }
  // Fransraden: en båge nedåt genom ögats nedre halva, mörkast på mitten.
  for (let x = cx - rx; x <= cx + rx; x += 0.25) {
    const t = (x - cx) / rx, y = cy + ry * 0.35 + ry * 0.35 * (1 - t * t), styrka = 0.75 * (1 - Math.abs(t) ** 3);
    for (let dy = -1.2; dy <= 1.2; dy += 0.4) {
      const yy = Math.round(y + dy), xx = Math.round(x), a = styrka * (1 - Math.abs(dy) / 1.4) * 0.35;
      if (a > 0) blanda((yy * W + xx) * 4, [62, 38, 30], a);
    }
  }
}
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-i", "-", MAL], { input: rgba });
console.log("assets/figur/newton-blink.png");
