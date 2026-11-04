#!/usr/bin/env python3
"""Ritar om bokstaven a i triangeln på formelbladets trigonometrirad (Rickard 2026-11-04).

I Skolverkets Formelblad_Ma_1abc_2021.pdf är triangeln en rasterbild där högerkanten skär av a:s
svans. Felet följer med i varje urklipp: f-plåtarna, assets/kort och omslagen. Skriptet hittar
triangelns lodräta katet, suddar a till höger om den och skriver ett helt a i samma höjd.

    python3 verktyg/laga-a.py <in.png> <ut.png> [--prov]

--prov skriver bara ut vad som hittades. Skriptet stoppar om det inte ser ett a på rätt plats, så
det går att köra på alla plåtar. Kör det igen på filer som formelblad-kort.mjs eller
gor-f-platar.mjs har gjort om, annars kommer det klippta a:et tillbaka.
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

TYPSNITT = [
    "/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf",
    "C:/Windows/Fonts/timesi.ttf",
]


def katet(mork):
    """Längsta lodräta linjen med fri yta till höger: triangelns katet a."""
    h, w = mork.shape
    bast = None
    for x in range(w // 2, w - 30):
        kol = mork[:, x]
        andringar = np.flatnonzero(np.diff(np.concatenate(([0], kol.astype(np.int8), [0]))))
        for a, b in zip(andringar[::2], andringar[1::2]):
            # Högst 30 % av plåten: annars är det en ram eller ett bråkstreck i något annat.
            if b - a < 60 or b - a > 0.3 * h:
                continue
            if mork[a:b, x + 4:x + 8].mean() > 0.02:
                continue
            if bast is None or b - a > bast[2] - bast[1]:
                bast = (x, int(a), int(b))
    return bast


def hitta_a(mork):
    k = katet(mork)
    if k is None:
        return None
    x, y0, y1 = k
    bredd = max(24, int(0.3 * (y1 - y0)))
    ruta = mork[y0:y1, x + 4:x + 4 + bredd]
    ys, xs = np.nonzero(ruta)
    if len(xs) == 0:
        return None
    return {"katet": k, "x0": int(xs.min()) + x + 4, "x1": int(xs.max()) + x + 4, "y0": int(ys.min()) + y0, "y1": int(ys.max()) + y0}


def main():
    arg = [a for a in sys.argv[1:] if a != "--prov"]
    prov = "--prov" in sys.argv
    if len(arg) != (1 if prov else 2):
        sys.exit(__doc__)
    bild = Image.open(arg[0]).convert("RGB")
    a = np.array(bild).astype(int)
    fynd = hitta_a(a.sum(2) < 330)
    if fynd is None:
        sys.exit(f"{arg[0]}: hittar inget a till höger om en katet")
    b, h = fynd["x1"] - fynd["x0"] + 1, fynd["y1"] - fynd["y0"] + 1
    # Ett a är ungefär lika brett som högt, och ett klippt a något smalare.
    if not (0.6 <= b / h <= 1.25) or not 8 <= h <= 80:
        sys.exit(f"{arg[0]}: det till höger om kateten ser inte ut som ett a ({b}×{h} px)")
    print(arg[0], fynd, f"{b}×{h} px")
    if prov:
        return
    fil = next((f for f in TYPSNITT if os.path.exists(f)), None)
    if fil is None:
        sys.exit("hittar inte Times New Roman Italic")
    m = 2
    bakgrund = np.median(a[fynd["y0"] - m : fynd["y1"] + m + 1, fynd["x1"] + 8 : fynd["x1"] + 20].reshape(-1, 3), axis=0)
    a[fynd["y0"] - m : fynd["y1"] + m + 1, fynd["x0"] - m : fynd["x1"] + m + 1] = bakgrund
    # Bokstaven ritas 8 gånger större och skalas ner, så att kanten blir lika mjuk som i urklippet.
    S = 8
    for storlek in range(20, 2000):
        font = ImageFont.truetype(fil, storlek)
        r = font.getbbox("a")
        if r[3] - r[1] >= h * S:
            break
    mask = Image.new("L", (r[2] - r[0] + 2 * S, r[3] - r[1] + 2 * S), 0)
    ImageDraw.Draw(mask).text((S - r[0], S - r[1]), "a", font=font, fill=255)
    mask = mask.resize((mask.width // S, mask.height // S), Image.LANCZOS)
    ut = Image.fromarray(a.astype("uint8"))
    ut.paste(Image.new("RGB", mask.size, (0, 0, 0)), (fynd["x0"] - 1, fynd["y0"] - 1), mask)
    ut.save(arg[1])


if __name__ == "__main__":
    main()
