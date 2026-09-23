"""
Hittar stjarnorna, stadens ljus och floden i fonden bakom "Valj en film" och skriver
public/omslag/valj-glimt.png, masken som fondens shader laser.

    python verktyg/hitta-valj.py [--kontroll fil.png]

Ingenting ritas ovanpa malningen. Shadern andrar malningens egna pixlar: stjarnor och
fonsterljus glimrar (deras overskott over omgivningen skalas upp och ner, var och en i
sin egen takt), och vattnet rors: bilden forskjuts lite i vagor sa att reflexerna krusar.

Metod (stjarnor och ljus): en punkt ar ett ljus om den ar tydligt
ljusare an medianen i en 15x15-ruta runt den och liten. Ovanfor stadssilhuetten ar det
stjarnor (manen och galaxkarnan ar for stora och faller bort); nedanfor ar det fonster
och gatljus, och de maste vara varma (R - B). De starkaste behalls.

Metod (vatten): en handritad kontur runt floden, och inom den bara det som ar bla vatten
(medianen av B - R, och inte mork), sa att on och traden i kanten inte gungar med.

Utdata, en png i fondens storlek (RGB, ingen alfa: en alfakanal kan ta med sig
fargkanalerna nar webblasaren forbehandlar bilden):
  R = hur mycket pixeln hor till en stjarna eller ett ljus, 0..255 med mjuk kant
  G = ljusets fas, samma for alla dess pixlar (takten raknas ur fasen i shadern)
  B = hur mycket pixeln ar vatten, 0..255 med mjuk kant
Och en mask for molnen, public/omslag/valj-moln.png, i en fjardedels storlek (molnen ar
stora och mjuka, och skalas upp linjart i shadern):
  L = hur mycket pixeln ar moln och far flyta, 0..255
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HÄR = Path(__file__).resolve().parent.parent
KÄLLA = HÄR / "assets" / "valj-fond.png"
MÅL = HÄR / "public" / "omslag" / "valj-glimt.png"
MOLN_MÅL = HÄR / "public" / "omslag" / "valj-moln.png"

# Linjen mellan himmel och stad, i bildens bredd (0.66 av den ursprungliga 16:9-hojden).
SKYLINE_AV_BREDD = 0.3714
RUTA = 15
S_TRÖSKEL = 14.0         # stjarna: sa mycket ljusare an omgivningen
S_MAX_DIAMETER = 8
S_SUDD, S_SUDD_TRÖSKEL = 26, 96   # stora ljusa omraden (mane, galaxkarna) tas bort
S_MAX_ANTAL = 450
F_TRÖSKEL = 12.0         # ljus i staden
F_VÄRME = 22.0           # R - B
F_MÖRK = 80              # ett fonster sitter i en mork vagg
F_MAX_DIAMETER = 9
F_MAX_ANTAL = 320
VÄXT = 2

# Molnen: ljusa, mjuka partier pa himlen. Galaxen och manen ar ocksa ljusa och far inte
# flyta med, och inte heller husen: molnen forskjuts upp till ~45 px, sa masken tonas ut
# pa 60 px fran dem. Galaxen ar en sned ellips, uppmatt i 1672x1300.
GALAX = (650, 185, 265, 90, 39)        # mitt x, mitt y, halvaxlar, vinkel i grader
GALAX_LITEN = (560, 285, 30)          # den lilla galaxen nedanfor
MANE = (1470, 150, 70)
MOLN_TRÖSKEL = (72, 110)              # ljushet i en suddad kopia: himmel ~45, moln 90-180
HUS_MÖRK = 38                         # husen i staden ar morkare an sa
MOLN_FRI = 60                         # sa langt fran galax, mane och hus borjar molnen rora sig

# Flodens kontur i 1672x1300, uppmatt i bilden.
FLOD = [(0, 893), (540, 893), (590, 950), (660, 1010), (705, 1080), (705, 1135),
        (420, 1165), (300, 1160), (200, 1130), (100, 1112), (0, 1105)]


def ljuspunkter(lum, median, kand, max_diameter, max_antal):
    """Sma sammanhangande flackar i kand, de starkaste max_antal, som boolsk mask."""
    etikett, n = ndimage.label(kand)
    if n == 0:
        return np.zeros_like(kand)
    styrka = ndimage.maximum(lum - median, etikett, range(1, n + 1))
    behåll = np.zeros(n + 1, bool)
    kandidater = []
    for i, sl in enumerate(ndimage.find_objects(etikett), 1):
        if sl is None:
            continue
        if max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) <= max_diameter:
            kandidater.append((styrka[i - 1], i))
    for _, i in sorted(kandidater, reverse=True)[:max_antal]:
        behåll[i] = True
    return behåll[etikett]


def main():
    bild = np.asarray(Image.open(KÄLLA).convert("RGB")).astype(np.float32)
    H, W, _ = bild.shape
    lum = bild @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    median = ndimage.median_filter(lum, size=RUTA)
    över = lum - median
    linje = int(W * SKYLINE_AV_BREDD)

    # Stjarnor ovanfor staden.
    stort = ndimage.gaussian_filter(lum, S_SUDD) > S_SUDD_TRÖSKEL
    kand = (över > S_TRÖSKEL) & ~stort
    kand[linje:, :] = False
    stjärnor = ljuspunkter(lum, median, kand, S_MAX_DIAMETER, S_MAX_ANTAL)

    # Ljusen i staden: varma, sma, i mork omgivning.
    värme = bild[..., 0] - bild[..., 2]
    kand = (över > F_TRÖSKEL) & (värme > F_VÄRME) & (median < F_MÖRK)
    kand[:linje - 30, :] = False
    ljus = ljuspunkter(lum, median, kand, F_MAX_DIAMETER, F_MAX_ANTAL)

    punkt = stjärnor | ljus
    vuxen = ndimage.binary_dilation(punkt, iterations=VÄXT)
    nr, antal = ndimage.label(vuxen)
    _, (iy, ix) = ndimage.distance_transform_edt(nr == 0, return_indices=True)
    nr = nr[iy, ix]
    fas = np.concatenate([[0], np.random.default_rng(1604).random(antal)])
    vikt = np.clip(ndimage.gaussian_filter(vuxen.astype(np.float32), 0.8) * 1.4, 0, 1)

    # Vattnet: inom konturen och bla.
    kontur = Image.new("L", (W, H), 0)
    ImageDraw.Draw(kontur).polygon([(x * W / 1672, y * H / 1300) for x, y in FLOD], fill=255)
    inom = np.asarray(kontur) > 0
    # Vatten ar blatt och inte morkt: traden pa on och i kanten har ljushet runt 14,
    # vattnet 38-61 (uppmatt i medianen).
    vatten = inom & (median > 28) & (ndimage.median_filter(bild[..., 2] - bild[..., 0], size=RUTA) > 3)
    vatten = ndimage.binary_opening(vatten, iterations=2)
    vatten = np.clip(ndimage.gaussian_filter(vatten.astype(np.float32), 5) * 1.3, 0, 1)

    # Molnen.
    sx, sy = W / 1672, H / 1300
    sudd = ndimage.gaussian_filter(lum, 4)
    a, b = MOLN_TRÖSKEL
    moln = np.clip((sudd - a) / (b - a), 0, 1)
    fri = np.ones((H, W), bool)
    yy, xx = np.mgrid[0:H, 0:W]
    gx, gy, ga, gb, gv = GALAX
    v = np.radians(gv)
    dx, dy = (xx - gx * sx), (yy - gy * sy)
    u = (dx * np.cos(v) + dy * np.sin(v)) / (ga * sx)
    w = (-dx * np.sin(v) + dy * np.cos(v)) / (gb * sy)
    fri &= u * u + w * w > 1
    for cx, cy, r in (GALAX_LITEN, MANE):
        fri &= (xx - cx * sx) ** 2 + (yy - cy * sy) ** 2 > (r * sx) ** 2
    hus = (sudd < HUS_MÖRK) & (yy > linje - 40)
    fri &= ~hus
    avstånd = ndimage.distance_transform_edt(fri)
    moln *= np.clip(avstånd / MOLN_FRI, 0, 1)
    moln[yy > linje + 160] = 0
    moln = ndimage.gaussian_filter(moln, 6)
    Image.fromarray(np.round(moln * 255).astype(np.uint8), "L").resize((W // 4, H // 4), Image.BOX).save(MOLN_MÅL, optimize=True)

    ut = np.zeros((H, W, 3), np.uint8)
    ut[..., 0] = np.round(vikt * 255)
    ut[..., 1] = np.round(fas[nr] * 255) * (vikt > 0)
    ut[..., 2] = np.round(vatten * 255)
    Image.fromarray(ut, "RGB").save(MÅL, optimize=True)
    print(f"public/omslag/valj-glimt.png: {int(ndimage.label(stjärnor)[1])} stjarnor, "
          f"{int(ndimage.label(ljus)[1])} ljus i staden, vatten {vatten.mean() * 100:.1f} % av bilden.")

    if "--kontroll" in sys.argv:
        fil = sys.argv[sys.argv.index("--kontroll") + 1]
        k = bild.copy()
        k[..., 2] = np.clip(k[..., 2] + vatten * 90, 0, 255)
        k[stjärnor] = [255, 60, 60]
        k[ljus] = [60, 255, 60]
        Image.fromarray(k.astype(np.uint8)).save(fil)


if __name__ == "__main__":
    main()
