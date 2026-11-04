#!/usr/bin/env python3
"""Ritar om en klippt bokstav i formelbladets figurer (Rickard 2026-11-04).

I Skolverkets Formelblad_Ma_1abc_2021.pdf är figurerna rasterbilder där högerkanten skär av a:s svans
i trigonometrins triangel och h:s svans i prismat. Felet följer med i varje urklipp: f-plåtarna,
assets/kort och omslagen. Skriptet suddar bokstaven och skriver en hel i samma höjd på samma plats.

    python3 verktyg/laga-a.py <in.png> <ut.png> [--prov]
    python3 verktyg/laga-a.py <in.png> <ut.png> --bokstav h --ruta x0,y0,x1,y1 [--prov]

Utan --ruta letar det efter a till höger om triangelns lodräta katet och stoppar om det inte ser ett
a på rätt plats, så det går att köra på alla plåtar. Med --ruta tas bokstaven som det mörka i rutan.
Rutan ska rymma bara bokstaven, med luft runt om: skriptet stoppar om något mörkt når rutans kant.
--prov skriver bara ut vad som hittades. Kör det igen på filer som formelblad-kort.mjs eller
gor-f-platar.mjs har gjort om, annars kommer den klippta bokstaven tillbaka.
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


def hitta_i_ruta(mork, ruta):
    x0, y0, x1, y1 = ruta
    ys, xs = np.nonzero(mork[y0:y1, x0:x1])
    if len(xs) == 0 or xs.min() == 0 or ys.min() == 0 or xs.max() == x1 - x0 - 1 or ys.max() == y1 - y0 - 1:
        return None
    return {"x0": int(xs.min()) + x0, "x1": int(xs.max()) + x0, "y0": int(ys.min()) + y0, "y1": int(ys.max()) + y0}


def flagga(arg, namn):
    if namn not in arg:
        return None
    i = arg.index(namn)
    varde = arg[i + 1]
    del arg[i : i + 2]
    return varde


def main():
    arg = [a for a in sys.argv[1:] if a != "--prov"]
    prov = "--prov" in sys.argv
    bokstav = flagga(arg, "--bokstav") or "a"
    ruta = flagga(arg, "--ruta")
    if len(arg) not in ((1, 2) if prov else (2,)) or (bokstav != "a" and not ruta):
        sys.exit(__doc__)
    bild = Image.open(arg[0]).convert("RGB")
    a = np.array(bild).astype(int)
    if ruta:
        fynd = hitta_i_ruta(a.sum(2) < 330, [int(t) for t in ruta.split(",")])
        if fynd is None:
            sys.exit(f"{arg[0]}: rutan {ruta} rymmer inte bara en bokstav")
    else:
        fynd = hitta_a(a.sum(2) < 330)
        if fynd is None:
            sys.exit(f"{arg[0]}: hittar inget a till höger om en katet")
    b, h = fynd["x1"] - fynd["x0"] + 1, fynd["y1"] - fynd["y0"] + 1
    # Ett a är ungefär lika brett som högt, och ett klippt a något smalare. Ett h är högre än brett.
    lagom = (0.6, 1.25) if bokstav == "a" else (0.4, 1.0)
    if not (lagom[0] <= b / h <= lagom[1]) or not 8 <= h <= 80:
        sys.exit(f"{arg[0]}: det som hittades ser inte ut som {bokstav} ({b}×{h} px)")
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
        r = font.getbbox(bokstav)
        if r[3] - r[1] >= h * S:
            break
    mask = Image.new("L", (r[2] - r[0] + 2 * S, r[3] - r[1] + 2 * S), 0)
    ImageDraw.Draw(mask).text((S - r[0], S - r[1]), bokstav, font=font, fill=255)
    mask = mask.resize((mask.width // S, mask.height // S), Image.LANCZOS)
    ut = Image.fromarray(a.astype("uint8"))
    ut.paste(Image.new("RGB", mask.size, (0, 0, 0)), (fynd["x0"] - 1, fynd["y0"] - 1), mask)
    ut.save(arg[1])


if __name__ == "__main__":
    main()
