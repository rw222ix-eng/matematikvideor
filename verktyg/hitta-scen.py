"""
Klipper ut startsidans levande scen ur bilderna i assets/intro-scen/ och skriver det som
startsidans shader laser (levandeScen i public/index.html):

    python verktyg/hitta-scen.py [--kontroll mapp]

Bilderna ar malade i ChatGPT-projektet (prompter och chattar i assets/intro-scen/prompter.md):
grundmalningen och andringar av den, var och en pixelexakt pa den bild den gjordes fran. Ur en
andring tas bara det som skiljer sig tydligt fran den bilden (som med Newton, verktyg/newton-arm.mjs).
Rorelsen mellan lagena raknas sedan fram i shadern, i varje bildruta.

Tva grundbilder:
  A = intro-grund-a.png: forsta malningen (matematikern vid bordet). Stenhuggaren, astronomen
      och matstickans man ar malade som andringar av den.
  B = grund2-b.png: samma malning, men matematikern star vid en tavla pa tornets vagg (Rickard
      2026-09-26: "jag vill helst att man ser att nagot skrivs"). Den visas; matematikerns lagen
      ar andringar av den. A och B ar lika utom kring tavlan (och nagra fa smafläckar).

Utdata i public/omslag/:
  intro.jpg          grundbilden B (1672x941). Syns ocksa utan WebGL.
  intro-lager.webp   lagena, packade i en karta.
  intro-lager.png    samma karta, masker: R = det som tonas (figuren), G = det som vrids eller
                     flyttas (slaggan, huvudet, handen med kritan, matstickan), B = var figuren
                     tacker tavlan (kritan ritas inte dar).
  intro-glimt.png    stjarnorna (R = stjarna, G = fas).
  intro-scen.json    rutorna i kartan och de uppmatta punkterna.

Metoder:
- Stenhuggarens lagen jamfors med bilden utan honom: skillnad (summa |RGB|, utjamnad 5x5) over 45
  inom hans ruta, hal fyllda, sma flackar bort. Slaggan = figuren nara skaftets linje (bakre handen
  -> huvudets mitt, uppmatt per lage) eller slagghuvudet. Bakom honom: bilden utan honom dar han
  star i vilolaget, annars B.
- De andra lagena jamfors med sin grundbild: skillnad over 30, vuxen 6 px och mjuk kant.
- Matematikerns skrivlagen: R = unionen av skillnaderna mot B (samma for alla fyra), G = handen
  och underarmen (nara kritans spets, avtagande mot armbagen), B = var figuren tacker tavlan
  (skillnad mot medianen av de andra lagena).
- Stjarnor: en liten punkt klart ljusare an medianen i 15x15 runt den, bara i himlen.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HÄR = Path(__file__).resolve().parent.parent
KÄLLA = HÄR / "assets" / "intro-scen"
UT = HÄR / "public" / "omslag"
A_NAMN, B_NAMN, UTAN = "intro-grund-a", "grund2-b", "utan-slaggare"
FORSKJUTNING = {"m-tanker-2": (-1, -1)}   # rad, kolumn: m-tanker-2 kom 1 px forskjuten

# ── Stenhuggaren ──
# Lagena i svingens ordning, och vilan (torkar svetten) och stjarnfallet (tittar upp).
# Skaftet i varje lage (bakre handen -> slagghuvudets mitt), uppmatt i rutnat.
SLAGGARE = [("vila", "intro-grund-a"), ("lyft1", "lyft-1"), ("mitt", "slagga-mitt"), ("uppe", "slagga-uppe"),
            ("slag1", "slag-1"), ("slag2", "slag-2"), ("torkar", "torkar"), ("upp", "upp-slaggare")]
HANDTAG = {"vila": [(990, 565), (1115, 640)], "lyft1": [(950, 590), (1130, 585)],
           "mitt": [(975, 470), (890, 375)], "uppe": [(970, 320), (835, 225)], "slag1": [(1050, 485), (1193, 445)],
           "slag2": [(1025, 575), (1130, 620)], "torkar": [(918, 560), (945, 820)], "upp": [(990, 565), (1115, 640)]}
SLAGGARE_RUTA = (805, 190, 1225, 905)

# ── Figurer som gar fran vila till ett lage och tillbaka ──
# namn: (bild, grundbild, ruta, vridpunkt, grader, flytt). Vridningen och flytten galler G-masken.
LAGEN = {
    "astronom": ("astronom-upp", "A", (1250, 0, 1500, 215), (1420, 165), 27, (0, -23)),
    "matare-titta": ("matare-tittar", "A", (1430, 540, 1600, 690), (1515, 625), 15, (0, 0)),
    "matare-upp": ("upp-matare", "A", (1430, 530, 1600, 690), (1510, 640), 22, (0, 0)),
    "matare-krita": ("kritar", "A", (1360, 560, 1600, 760), (0, 0), 0, (0, 0)),
    "matare-flytta": ("matare-flyttar", "A", (1340, 540, 1640, 760), (0, 0), 0, (-26, 0)),
    "matem-tanker": ("m-tanker-2", "B", (1250, 330, 1530, 690), (0, 0), 0, (0, 0)),
    "matem-upp": ("upp-matematiker", "B", (1250, 330, 1530, 690), (0, 0), 0, (0, 0)),
}
# Var en figur far finnas. Matematikerns lagesbilder skiljer sig lite overallt (lyktan, blocket):
# bara kring honom, inte vid lyktan och inte pa matstickans man.
OMRADE = {"matem": lambda x, y: (x >= 1272) & (y < 640) & ~((x > 1438) & (y > 546)),
          "matare": lambda x, y: (x >= 1360) & (y >= 540) & ~((x < 1440) & (y < 690))}
# Astronomen: teleskopet och stativet star still; hander och okular tonas bara.
STILLA = {"astronom": lambda x, y: (x < 1305) | ((x < 1316) & (y > 104))}
BARA_TONA = {"astronom": lambda x, y: np.maximum(np.clip((1372 - x) / 36, 0, 1), np.clip((y - 150) / 30, 0, 1))}

# ── Matematikern vid tavlan ──
TAVLA = (1186, 349, 1444, 508)                 # den morka ytan, x0 y0 x1 y1
SKRIV_RUTA = (1250, 330, 1530, 690)
SKRIV = {"bas": ("grund2-b", (1361, 415)), "mitt": ("m-mitt", (1297, 411)),
         "nere": ("m-nere", (1352, 483)), "nm": ("m-nere-mitt", (1310, 490))}
LYKTA = (1230, 521)

PAD = 6


def las(namn):
    b = np.asarray(Image.open(KÄLLA / f"{namn}.png").convert("RGB")).astype(np.float32)
    if b.shape[1] < 1672:
        b = np.pad(b, ((0, 0), (0, 1672 - b.shape[1]), (0, 0)), mode="edge")
    if namn in FORSKJUTNING:
        dy, dx = FORSKJUTNING[namn]
        b = np.roll(np.roll(b, dy, 0), dx, 1)
    return b


def rensa(mask, min_yta):
    mask = ndimage.binary_closing(mask, iterations=3)
    mask = ndimage.binary_fill_holes(mask)
    et, n = ndimage.label(mask)
    if n:
        ytor = ndimage.sum(mask, et, range(1, n + 1))
        mask = np.isin(et, 1 + np.flatnonzero(ytor >= min_yta))
    return mask


def mjuk(mask, vaxt=0, sudd=1.2):
    if vaxt:
        mask = ndimage.binary_dilation(mask, iterations=vaxt)
    return np.clip(ndimage.gaussian_filter(mask.astype(np.float32), sudd) * 1.15, 0, 1)


def kantton(h, w, bredd=8):
    k = np.minimum.outer(np.minimum(np.arange(h), np.arange(h)[::-1]), np.minimum(np.arange(w), np.arange(w)[::-1]))
    return np.clip(k / bredd, 0, 1)


def main():
    A, B, utan = las(A_NAMN), las(B_NAMN), las(UTAN)
    H, W, _ = B.shape
    Image.fromarray(B.astype(np.uint8)).save(UT / "intro.jpg", quality=90, optimize=True, progressive=True)
    bitar = []          # (namn, farg, R, G, B)

    # Stenhuggaren.
    x0, y0, x1, y1 = SLAGGARE_RUTA
    yy, xx = np.mgrid[y0:y1, x0:x1]
    px, py = xx.astype(np.float32), yy.astype(np.float32)
    bak_utan = utan[y0:y1, x0:x1]
    # Blockets framsida, lyktan och teleskopets spets far aldrig raknas som figur; forsta kilen
    # bara i vilolaget (dar ligger slaggan).
    utanfor = (((xx >= 1012) & (yy >= 650) & ~((xx >= 1080) & (xx <= 1140) & (yy <= 675)))
               | ((xx >= 1150) & (yy < 130)) | ((xx >= 1195) & (yy >= 440) & (yy < 560)))
    kil = (xx >= 1080) & (xx <= 1140) & (yy >= 650)
    figurer = {}
    for namn, bild in SLAGGARE:
        b = las(bild)[y0:y1, x0:x1]
        d = ndimage.uniform_filter(np.abs(b - bak_utan).sum(-1), 5)
        pa_kil = kil & (namn not in ("vila", "upp"))
        figurer[namn] = (rensa((d > 45) & ~utanfor & ~pa_kil, 400), b)
    vila = mjuk(figurer["vila"][0], 8, 3.0)[..., None]
    bakom = B[y0:y1, x0:x1] * (1 - vila) + bak_utan * vila
    bitar.append(("s-bakom", bakom, None, None, None))
    for namn, (fig, farg) in figurer.items():
        (gx, gy), (hx, hy) = HANDTAG[namn]
        vx, vy = hx - gx, hy - gy
        t = np.clip(((px - gx) * vx + (py - gy) * vy) / (vx * vx + vy * vy), -0.08, 1)
        linje = np.hypot(px - (gx + t * vx), py - (gy + t * vy)) < 9
        huvud = np.hypot(px - hx, py - hy) < 34
        slagga = fig & (linje | huvud)
        bitar.append(("s-" + namn, farg, mjuk(fig & ~slagga, 1), mjuk(slagga, 1), None))

    # Figurerna med ett lage.
    grund = {"A": A, "B": B}
    lagen = {}
    for namn, (bild, ref, (a0, b0, a1, b1), vp, grader, flytt) in LAGEN.items():
        b = las(bild)[b0:b1, a0:a1]
        d = ndimage.uniform_filter(np.abs(b - grund[ref][b0:b1, a0:a1]).sum(-1), 5)
        yy2, xx2 = np.mgrid[b0:b1, a0:a1]
        omr = OMRADE.get(namn.split("-")[0], lambda x, y: True)(xx2, yy2)
        if namn.startswith("matem-"):
            omr &= xx2 >= 1325        # tanker och upp: handen lamnar tavlan, bara kroppen andras
        m = mjuk(rensa((d > 30) & omr, 60), 6, 3.0) * kantton(b1 - b0, a1 - a0)
        figur = namn.split("-")[0]
        if figur in STILLA:
            m *= 1 - mjuk(STILLA[figur](xx2, yy2), 0, 2.0)
        v = m.copy() if (grader or tuple(flytt) != (0, 0)) else np.zeros_like(m)
        if figur in BARA_TONA:
            v *= 1 - BARA_TONA[figur](xx2, yy2)
        if namn == "matare-flytta":
            # Bara matstickan och handerna flyttas: bandet langs stickan pa blockets ovansida.
            v *= np.clip(1 - np.abs(yy2 - (706 + (xx2 - 1375) * 0.23)) / 16, 0, 1) * (xx2 < 1500)
        bitar.append((namn, b, m, v, np.zeros_like(m)))
        lagen[namn] = {"kalla": [a0, b0, a1 - a0, b1 - b0], "vrid": [vp[0], vp[1], grader], "flytt": list(flytt)}

    # Matematikern vid tavlan: skrivlagena.
    a0, b0, a1, b1 = SKRIV_RUTA
    yy2, xx2 = np.mgrid[b0:b1, a0:a1]
    skriv = {k: las(bild)[b0:b1, a0:a1] for k, (bild, _) in SKRIV.items()}
    alla_m = {**skriv, "tanker": las("m-tanker-2")[b0:b1, a0:a1], "upp": las("upp-matematiker")[b0:b1, a0:a1]}
    union = np.zeros(skriv["bas"].shape[:2], bool)
    for k, b in skriv.items():
        if k != "bas":
            union |= rensa((ndimage.uniform_filter(np.abs(b - skriv["bas"]).sum(-1), 5) > 30) & OMRADE["matem"](xx2, yy2), 60)
    U = mjuk(union, 8, 3.0) * kantton(b1 - b0, a1 - a0)
    tavla = (xx2 >= TAVLA[0]) & (xx2 < TAVLA[2]) & (yy2 >= TAVLA[1]) & (yy2 < TAVLA[3])
    stack = np.stack(list(alla_m.values()))
    for i, (k, b) in enumerate(alla_m.items()):
        ovriga = np.median(np.delete(stack, i, axis=0), axis=0)
        fig = rensa((ndimage.uniform_filter(np.abs(b - ovriga).sum(-1), 3) > 28) & OMRADE["matem"](xx2, yy2), 30)
        tacker = mjuk(fig & tavla, 2, 1.0)
        if k in SKRIV:
            sx, sy = SKRIV[k][1]
            nara = np.clip(1 - (np.hypot(xx2 - sx, yy2 - sy) - 22) / 60, 0, 1)
            g = mjuk(fig, 3, 2.0) * nara
            bitar.append(("w-" + k, b, U, g, tacker))
        else:
            namn = "matem-" + k
            j = [x[0] for x in bitar].index(namn)
            n0, f0, m0, v0, _ = bitar[j]
            bitar[j] = (n0, f0, m0, v0, tacker)

    # Packa kartan: hyllor, hogst 2200 bred.
    MAXB = 2200
    placering = {}
    x = y = radh = 0
    for namn, farg, *_ in bitar:
        h, w = farg.shape[:2]
        if x + w > MAXB:
            x, y, radh = 0, y + radh + PAD, 0
        placering[namn] = (x, y, w, h)
        x += w + PAD
        radh = max(radh, h)
    KW = max(p[0] + p[2] for p in placering.values())
    KH = y + radh
    karta = np.zeros((KH, KW, 3), np.float32)
    mask = np.zeros((KH, KW, 3), np.float32)
    for namn, farg, r, g, bb in bitar:
        px0, py0, w, h = placering[namn]
        karta[py0:py0 + h, px0:px0 + w] = farg
        for k, kanal in enumerate((r, g, bb)):
            if kanal is not None:
                mask[py0:py0 + h, px0:px0 + w, k] = kanal
    Image.fromarray(np.round(karta).astype(np.uint8)).save(UT / "intro-lager.webp", quality=88, method=6)
    Image.fromarray(np.round(mask * 255).astype(np.uint8)).save(UT / "intro-lager.png", optimize=True)

    # Stjarnorna i himlen (bade A och B har samma himmel).
    lum = B @ np.array([0.299, 0.587, 0.114], np.float32)
    median = ndimage.median_filter(lum, size=15)
    yy, xx = np.mgrid[0:H, 0:W]
    himmel = (median < 60) & (yy < 440)
    for r in [(1100, 170, W, H), (1150, 0, 1480, 230), (780, 30, 1230, H)]:
        himmel &= ~((xx >= r[0]) & (xx < r[2]) & (yy >= r[1]) & (yy < r[3]))
    himmel = ndimage.binary_erosion(himmel, iterations=4)
    kand = (lum - median > 14) & himmel
    et, n = ndimage.label(kand)
    behåll = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndimage.find_objects(et), 1):
        if sl is not None and max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) <= 9:
            behåll[i] = True
    stjärna = behåll[et]
    vuxen = ndimage.binary_dilation(stjärna, iterations=3)
    nr, antal = ndimage.label(vuxen)
    _, (iy, ix) = ndimage.distance_transform_edt(nr == 0, return_indices=True)
    nr = nr[iy, ix]
    fas = np.concatenate([[0], np.random.default_rng(1670).random(antal)])
    vikt = np.clip(ndimage.gaussian_filter(vuxen.astype(np.float32), 0.8) * 1.4, 0, 1)
    glimt = np.zeros((H, W, 3), np.uint8)
    glimt[..., 0] = np.round(vikt * 255)
    glimt[..., 1] = np.round(fas[nr] * 255) * (vikt > 0)
    Image.fromarray(glimt, "RGB").save(UT / "intro-glimt.png", optimize=True)

    scen = {
        "bild": [W, H], "karta": [KW, KH],
        "rutor": {k: list(v) for k, v in placering.items()},
        "stenhuggare": {"ruta": list(SLAGGARE_RUTA), "lagen": [n for n, _ in SLAGGARE], "handtag": HANDTAG},
        "lagen": lagen,
        "skriv": {"ruta": [a0, b0, a1 - a0, b1 - b0], "spetsar": {k: v[1] for k, v in SKRIV.items()}, "tavla": list(TAVLA)},
        "lykta": list(LYKTA),
    }
    (UT / "intro-scen.json").write_text(json.dumps(scen), encoding="utf8")
    print(f"intro-lager: {KW}x{KH}, {len(bitar)} rutor, {antal} stjarnor")

    if "--kontroll" in sys.argv:
        mapp = Path(sys.argv[sys.argv.index("--kontroll") + 1])
        mapp.mkdir(parents=True, exist_ok=True)
        k = karta.copy()
        for c in range(3):
            k[..., c] = np.clip(k[..., c] * 0.45 + mask[..., c] * 210, 0, 255)
        Image.fromarray(k.astype(np.uint8)).save(mapp / "karta-kontroll.png")


if __name__ == "__main__":
    main()
