"""
Hittar stjarnorna i introbildens fonster och skriver public/omslag/intro-glimt.png,
masken som introts shader laser for att lata just de pixlarna glimra.

    python verktyg/hitta-intro.py [--kontroll fil.png]

Ingenting ritas ovanpa malningen. Shadern andrar stjarnans egna pixlar: hur mycket
ljusare de ar an himlen runt omkring. Darfor maste den veta vilka pixlar som ar
stjarna och vilken stjarna de hor till, sa att hela stjarnan glimrar i samma takt.

Metod: samma som hitta-stjarnor.py. En stjarna ar en liten punkt som ar tydligt
ljusare an medianen i en 15x15-ruta runt den. Bara inom fonsterglaset, bara dar
omgivningen ar bla natthimmel (inte haret, karmen eller ljuset), och bara sma
flackar (manen ar for stor och faller bort).

Utdata, en png i introbildens storlek:
  R = hur mycket pixeln hor till en stjarna, 0..255 med mjuk kant
  G = stjarnans fas, samma for alla hennes pixlar
  B = stjarnans takt, samma for alla hennes pixlar
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HÄR = Path(__file__).resolve().parent.parent
KÄLLA = HÄR / "public" / "omslag" / "intro.jpg"
MÅL = HÄR / "public" / "omslag" / "intro-glimt.png"

# Fonsterglaset och lagan, som andel av bildens bredd och hojd (uppmatt i 1920x1080).
# GLAS ar hela fonstret; RUTOR ar glasrutorna innanfor karm och sprojsar, uppmatta ur
# ljusprofilen (karmen ar morkare an himlen). Kanten pa en sprojs ger annars smala
# ljusa ranter som ser ut som stjarnor.
GLAS = (1415 / 1920, 0.0, 1822 / 1920, 646 / 1080)
KOLUMNER = [(1414, 1580), (1612, 1800)]
RADER = [(30, 250), (286, 494), (520, 634)]
LÅGA = (1667 / 1920, 646 / 1080)
LÅGA_FRI = 80 / 1920     # ingen stjarna narmare lagan an sa (dess sken ar ljust)

RUTA = 15
TRÖSKEL = 14.0           # ljusare an omgivningen, i 0..255
MAX_DIAMETER = 9
KANT = 5                 # sa manga pixlar in i ren himmel (inte har eller axel)
VÄXT = 3                 # masken vaxer sa manga pixlar runt stjarnan, for skenet


def main():
    bild = np.asarray(Image.open(KÄLLA).convert("RGB")).astype(np.float32)
    H, W, _ = bild.shape
    lum = bild @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    median = ndimage.median_filter(lum, size=RUTA)
    röd = ndimage.median_filter(bild[..., 0], size=RUTA)
    blå = ndimage.median_filter(bild[..., 2], size=RUTA)

    yy, xx = np.mgrid[0:H, 0:W]
    x0, y0, x1, y1 = GLAS
    inom = np.zeros((H, W), bool)
    for a, b in KOLUMNER:
        for c, d in RADER:
            inom |= (xx >= a * W / 1920) & (xx <= b * W / 1920) & (yy >= c * H / 1080) & (yy <= d * H / 1080)
    inom &= (xx - LÅGA[0] * W) ** 2 + (yy - LÅGA[1] * H) ** 2 > (LÅGA_FRI * W) ** 2
    # Himmel dar omgivningen ar bla och mork, och minst KANT pixlar fran haret och axeln.
    himmel = ndimage.binary_erosion((blå > röd + 10) & (median < 110) & inom, iterations=KANT)

    kand = (lum - median > TRÖSKEL) & himmel
    etikett, n = ndimage.label(kand)
    behåll = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndimage.find_objects(etikett), 1):
        if sl is None:
            continue
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        behåll[i] = max(h, w) <= MAX_DIAMETER
    stjärna = behåll[etikett]

    # Varje stjarna far en egen fas och takt. Masken vaxer lite runt henne, och
    # pixlarna i kanten arver narmaste stjarnas nummer, sa inget blandas.
    vuxen = ndimage.binary_dilation(stjärna, iterations=VÄXT)
    nr, antal = ndimage.label(vuxen)
    _, (iy, ix) = ndimage.distance_transform_edt(nr == 0, return_indices=True)
    nr = nr[iy, ix]
    slump = np.random.default_rng(1618)
    fas = np.concatenate([[0], slump.random(antal)])
    takt = np.concatenate([[0], slump.random(antal)])

    vikt = ndimage.gaussian_filter(vuxen.astype(np.float32), 0.8)
    vikt = np.clip(vikt * 1.4, 0, 1)

    ut = np.zeros((H, W, 3), np.uint8)
    ut[..., 0] = np.round(vikt * 255)
    ut[..., 1] = np.round(fas[nr] * 255) * (vikt > 0)
    ut[..., 2] = np.round(takt[nr] * 255) * (vikt > 0)
    Image.fromarray(ut, "RGB").save(MÅL, optimize=True)
    print(f"public/omslag/intro-glimt.png: {antal} stjarnor i fonstret.")

    if "--kontroll" in sys.argv:
        fil = sys.argv[sys.argv.index("--kontroll") + 1]
        kontroll = bild.copy()
        kontroll[stjärna] = [255, 60, 60]
        Image.fromarray(kontroll.astype(np.uint8)).crop(
            (int(x0 * W) - 40, 0, int(x1 * W) + 40, int(y1 * H) + 60)).save(fil)


if __name__ == "__main__":
    main()
