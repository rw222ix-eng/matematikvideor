// Del 3: hur Newton lever medan han väntar. Spelar in alla ändringar i figuren (klasser, remsa, uttryck, läge)
// under DUR sekunder på ett steg (STEG = regex för stegets text), sammanfattar och tar bildserier (SERIER st).
export default async (s) => {
  const re = new RegExp(process.env.STEG || "Här ligger"), dur = +(process.env.DUR || 60), serier = +(process.env.SERIER || 0);
  await s.starta();
  let t;
  for (let k = 0; k < 20; k++) { t = await s.vantaPaKnapp(); if (re.test(t.text)) break; await s.vanta(500); await s.pekPa("#newton-knappar button"); await s.vanta(300); }
  s.logg("steg:", t.raknare, t.text.slice(0, 60));
  await s.js(`(() => { window.__liv = []; const n = document.getElementById("newton"), r = document.getElementById("newton-rorelse"), u = document.getElementById("newton-uttryck");
    const rec = () => { const rad = [Math.round(performance.now()), n.className.replace("newton guide ", "").replace("talar", "").trim(), n.classList.contains("ror") ? (r.style.backgroundImage.match(/newton-(\\w+)/) || [])[1] + ":" + r.style.backgroundPositionX : "", u.classList.contains("syns") ? (u.src.match(/newton-(\\w+)\\./) || [])[1] : "", (n.style.transform.match(/translate3d\\((-?\\d+)px/) || [])[1]]; const f = __liv[__liv.length - 1]; if (!f || f.slice(1).join() !== rad.slice(1).join()) __liv.push(rad); };
    new MutationObserver(rec).observe(n, { attributes: true, subtree: true, attributeFilter: ["class", "style", "src"] }); rec(); })()`);
  const t0 = Date.now();
  for (let k = 0; k < serier; k++) await s.serie(`serie-${k}`, { ms: 100, tid: 5000 });
  const rest = dur * 1000 - (Date.now() - t0); if (rest > 0) await s.vanta(rest);
  const liv = await s.js("__liv");
  // Sammanfattning: blink (längd, avstånd), rörelser (remsa: start–slut), steg (x före → efter).
  const blink = [], ror = [], x = []; let bPa = null, rPa = null, rNamn = "", forraX = null;
  for (const [tt, kl, rem, utt, px] of liv) {
    if (kl.includes("blinkar") && bPa == null) bPa = tt; if (!kl.includes("blinkar") && bPa != null) { blink.push([bPa, tt - bPa]); bPa = null; }
    const namn = rem.split(":")[0]; if (namn && !rPa) { rPa = tt; rNamn = namn; } else if (namn && namn !== rNamn) { ror.push([rPa, tt - rPa, rNamn]); rPa = tt; rNamn = namn; } else if (!namn && rPa) { ror.push([rPa, tt - rPa, rNamn]); rPa = null; }
    if (px !== undefined && px !== forraX) { x.push([tt, px, kl]); forraX = px; }
  }
  const b0 = liv[0][0];
  s.logg("blink (s, ms):", blink.map(([a, d]) => `${((a - b0) / 1000).toFixed(1)}:${d}`).join(" "));
  const mellan = blink.slice(1).map((b, i) => b[0] - blink[i][0]);
  s.logg("blink: antal", blink.length, "längd", Math.min(...blink.map((b) => b[1])), "–", Math.max(...blink.map((b) => b[1])), "ms, avstånd", Math.min(...mellan), "–", Math.max(...mellan), "ms");
  s.logg("rörelser:", ror.filter((r) => r[2] !== "gest").map(([a, d, n]) => `${((a - b0) / 1000).toFixed(1)}s ${n} ${d}ms`).join(" | "));
  s.logg("läge x:", x.map(([a, px, kl]) => `${((a - b0) / 1000).toFixed(1)}s ${px}${kl.includes("speglad") ? " speglad" : ""}`).join(" | "));
  s.logg("uttryck:", [...new Set(liv.map((r) => r[3]))].join(","));
  // Blink under en remsa eller ett uttryck?
  const fel = liv.filter(([, kl, rem, utt]) => kl.includes("blinkar") && (rem || utt));
  s.logg("blink över fel ansikte:", fel.length ? JSON.stringify(fel.slice(0, 5)) : "inga");
  await s.vakt("liv");
};
