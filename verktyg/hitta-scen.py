"""
Klipper ut startsidans levande scen ur bilderna i assets/intro-scen/ och skriver det som
startsidans shader laser (levandeScen i public/index.html):

    python verktyg/hitta-scen.py [--kontroll mapp]

Bilderna ar malade i ChatGPT-projektet (prompter och chattar i assets/intro-scen/prompter.md):
grundmalningen och sex andringar av den, var och en pixelexakt pa grundbilden. Precis som med
Newton (verktyg/newton-arm.mjs) tas ur en andring bara det som skiljer sig tydligt fran grunden.
Rorelsen mellan lagena raknas sedan fram i shadern, i varje bildruta.

Utdata i public/omslag/:
  intro.jpg          grundmalningen (1672x941): alla i vilolaget. Syns ocksa utan WebGL.
  intro-lager.webp   lagena, packade i en karta: stenhuggaren (slaggaren) i sju lagen och
                     bakgrunden utan honom, astronomen upprest, matematikern som tittar upp,
                     matstickans man som vander huvudet.
  intro-lager.png    samma karta, masker: R = figuren (for slaggaren: allt utom slaggan), G = det som
                     vrids (slaggan; for de andra figurerna huvudet och kroppen).
  intro-glimt.png    stjarnorna (R = stjarna, G = fas), som forut.
  intro-scen.json    rutorna i kartan och de uppmatta punkterna (axlar, kilar, lagan ...).

Metoder:
- Slaggarens lagen jamfors med bilden utan honom: skillnad (summa |RGB|, utjamnad 5x5) over 45
  inom hans ruta, hal fyllda, sma flackar bort. Kroppen = det som ar figur i alla tre lagena
  (ben, forklade), krympt 3 px; armar och slagga = resten av figuren i det laget.
- De andra lagena jamfors med grundbilden: skillnad over 30 inom figurens ruta, vuxen 6 px och
  mjuk kant, sa att bara figuren tonas.
- Stjarnor: som hitta-intro.py, en liten punkt klart ljusare an medianen i 15x15 runt den, bara
  i himlen (ovanfor muren och tornet, utanfor figurerna).
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

GRUND, UTAN = "intro-grund-a", "utan-slaggare"
# Svingen i ordning: vila (= slaget), lyft vid hoften, lodratt framfor ansiktet, over axeln, uppe,
# rakt fram i slaget, halvvags ner. Handtaget i varje lage (bakre handen -> slagghuvudets mitt),
# uppmatt i 20 px-rutnat: shadern vrider armarna och slaggan mellan tva lagen sa att handtagen moter varandra.
SLAGGA = ["intro-grund-a", "lyft-1", "lyft-2", "slagga-mitt", "slagga-uppe", "slag-1", "slag-2"]
LAGEN = ["vila", "lyft1", "lyft2", "mitt", "uppe", "slag1", "slag2"]
HANDTAG = {"vila": [(990, 565), (1115, 640)], "lyft1": [(950, 590), (1130, 585)], "lyft2": [(1005, 480), (1018, 330)],
           "mitt": [(975, 470), (890, 375)], "uppe": [(970, 320), (835, 225)], "slag1": [(1050, 485), (1193, 445)],
           "slag2": [(1025, 575), (1130, 620)]}
SLAGGARE_RUTA = (805, 190, 1225, 905)                      # x0, y0, x1, y1
ANDRA = {                                                  # lage: (bild, ruta)
    "astronom": ("astronom-upp", (1250, 0, 1500, 215)),
    "matematiker": ("matematiker-upp", (1280, 395, 1470, 560)),
    "matare": ("matare-tittar", (1440, 545, 1620, 700)),
}
# Vridpunkt och vinkel fran vilolaget till det andra laget (uppmatt: huvudets lage sett fran punkten).
# Astronomen reser sig: vridning kring midjan och ett lyft (huvudet (1370, 85) -> (1410, 48)); benen star kvar.
VRIDNING = {"astronom": ((1420, 165), 27, (0, -23)), "matematiker": ((1385, 470), 33, (0, 0)), "matare": ((1515, 625), 15, (0, 0))}
# Teleskopet och stativet star still (ChatGPT malade om dem lite i lagesbilden): aldrig med i astronomens mask.
STILLA = {"astronom": lambda x, y: (x < 1305) | ((x < 1316) & (y > 104))}
# Vrids inte (tonas bara): astronomens hander och okularet, dar lagena skiljer sig mer an en vridning.
BARA_TONA = {"astronom": lambda x, y: np.maximum(np.clip((1372 - x) / 36, 0, 1), np.clip((y - 150) / 30, 0, 1))}
PAD = 6


def las(namn):
    return np.asarray(Image.open(KÄLLA / f"{namn}.png").convert("RGB")).astype(np.float32)


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


def main():
    grund, utan = las(GRUND), las(UTAN)
    H, W, _ = grund.shape
    Image.fromarray(grund.astype(np.uint8)).save(UT / "intro.jpg", quality=90, optimize=True, progressive=True)

    # Slaggaren.
    x0, y0, x1, y1 = SLAGGARE_RUTA
    bak = utan[y0:y1, x0:x1]
    figurer, farger = [], []
    # ChatGPT malade om blockets framsida, lyktan och teleskopets spets lite i bilden utan honom:
    # de far aldrig raknas som figur (blockets ovansida borjar vid y 650; bara slagghuvudet i vilolaget, 1085-1135, nar ner dit).
    yy, xx = np.mgrid[y0:y1, x0:x1]
    utanfor = (((xx >= 1012) & (yy >= 650) & ~((xx >= 1080) & (xx <= 1140) & (yy <= 675))) | ((xx >= 1150) & (yy < 130))
               | ((xx >= 1195) & (yy >= 440) & (yy < 560)))
    kil = (xx >= 1080) & (xx <= 1140) & (yy >= 650)   # forsta kilen: bara i vilolaget ligger slaggan dar
    for namn in SLAGGA:
        b = las(namn)[y0:y1, x0:x1]
        d = ndimage.uniform_filter(np.abs(b - bak).sum(-1), 5)
        figurer.append(rensa((d > 45) & ~utanfor & ~(kil & (namn != SLAGGA[0])), 400))
        farger.append(b)
    # Bakom honom: bilden utan honom bara dar han (i nagot lage) star, annars grundbilden.
    alla = mjuk(np.logical_or.reduce(figurer), 8, 3.0)[..., None]
    bak = grund[y0:y1, x0:x1] * (1 - alla) + bak * alla
    rutor = {}
    bitar = []          # (namn, farg, mask R, mask G)
    bitar.append(("bakom", bak, np.zeros(bak.shape[:2]), np.zeros(bak.shape[:2])))
    # Slaggan (handtag och huvud) ur det uppmatta handtaget: allt i figuren nara handtagets linje eller
    # slagghuvudet. Bara slaggan vrids mellan lagena; armar, huvud och kropp tonas (en vriden arm eller
    # ett vridet huvud syntes som en los remsa och ett dubbelt huvud).
    for namn, fig, farg in zip(LAGEN, figurer, farger):
        (gx, gy), (hx, hy) = HANDTAG[namn]
        px, py = xx.astype(np.float32), yy.astype(np.float32)
        vx, vy = hx - gx, hy - gy
        t = np.clip(((px - gx) * vx + (py - gy) * vy) / (vx * vx + vy * vy), -0.08, 1)
        linje = np.hypot(px - (gx + t * vx), py - (gy + t * vy)) < 9
        huvud = np.hypot(px - hx, py - hy) < 34
        slagga = fig & (linje | huvud)
        bitar.append((namn, farg, mjuk(fig & ~slagga, 1), mjuk(slagga, 1)))

    # De andra: bara det som andrats, med mjuk kant.
    for figur, (namn, (a0, b0, a1, b1)) in ANDRA.items():
        b = las(namn)[b0:b1, a0:a1]
        d = ndimage.uniform_filter(np.abs(b - grund[b0:b1, a0:a1]).sum(-1), 5)
        m = rensa(d > 30, 60)
        m = mjuk(m, 6, 3.0)
        if figur in STILLA:
            yy2, xx2 = np.mgrid[b0:b1, a0:a1]
            m *= 1 - mjuk(STILLA[figur](xx2, yy2), 0, 2.0)
        # Kanten av rutan: tona ut, sa att inget skarvas.
        kant = np.minimum.outer(np.minimum(np.arange(b1 - b0), np.arange(b1 - b0)[::-1]),
                                np.minimum(np.arange(a1 - a0), np.arange(a1 - a0)[::-1]))
        m *= np.clip(kant / 8, 0, 1)
        v = m.copy()
        if figur in BARA_TONA:
            yy2, xx2 = np.mgrid[b0:b1, a0:a1]
            v *= 1 - BARA_TONA[figur](xx2, yy2)
        bitar.append((figur, b, m, v))
        rutor_andra = (a0, b0, a1, b1)
        rutor[figur + "_kalla"] = list(rutor_andra)

    # Packa kartan: slaggarens atta rutor i tva rader, de andra under.
    placering = {}
    x, y, radh = 0, 0, 0
    bredd = 4 * (x1 - x0 + PAD)
    for namn, farg, _, _ in bitar:
        h, w = farg.shape[:2]
        if x + w > bredd:
            x, y, radh = 0, y + radh + PAD, 0
        placering[namn] = (x, y, w, h)
        x += w + PAD
        radh = max(radh, h)
    KW, KH = bredd, y + radh
    karta = np.zeros((KH, KW, 3), np.float32)
    mask = np.zeros((KH, KW, 3), np.float32)
    for namn, farg, mr, mg in bitar:
        px, py, w, h = placering[namn]
        karta[py:py + h, px:px + w] = farg
        mask[py:py + h, px:px + w, 0] = mr
        mask[py:py + h, px:px + w, 1] = mg
    Image.fromarray(np.round(karta).astype(np.uint8)).save(UT / "intro-lager.webp", quality=88, method=6)
    Image.fromarray(np.round(mask * 255).astype(np.uint8)).save(UT / "intro-lager.png", optimize=True)


    # Stjarnorna i himlen.
    lum = grund @ np.array([0.299, 0.587, 0.114], np.float32)
    median = ndimage.median_filter(lum, size=15)
    yy, xx = np.mgrid[0:H, 0:W]
    himmel = (median < 60) & (yy < 440)
    for a in [(1100, 170, W, H), (1150, 0, 1480, 230), (780, 30, 1230, H)]:
        himmel &= ~((xx >= a[0]) & (xx < a[2]) & (yy >= a[1]) & (yy < a[3]))
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
        "bild": [W, H],
        "karta": [KW, KH],
        "rutor": {k: list(v) for k, v in placering.items()},
        "slaggare": list(SLAGGARE_RUTA),
        "lagen": LAGEN,
        "handtag": HANDTAG,
        "vridning": VRIDNING,
        **{k: v for k, v in rutor.items()},
    }
    (UT / "intro-scen.json").write_text(json.dumps(scen, indent=1), encoding="utf8")
    print(f"intro-lager: {KW}x{KH}, {antal} stjarnor")

    if "--kontroll" in sys.argv:
        mapp = Path(sys.argv[sys.argv.index("--kontroll") + 1])
        mapp.mkdir(parents=True, exist_ok=True)
        k = karta.copy()
        k[..., 0] = np.clip(k[..., 0] * 0.5 + mask[..., 0] * 200, 0, 255)
        k[..., 1] = np.clip(k[..., 1] * 0.5 + mask[..., 1] * 200, 0, 255)
        Image.fromarray(k.astype(np.uint8)).save(mapp / "karta-kontroll.png")


if __name__ == "__main__":
    main()
