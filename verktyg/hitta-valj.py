"""
Mater upp fonden bakom "Valj en film" och skriver maskerna som fondens shader laser
(levandeMalning i public/index.html):

    python verktyg/hitta-valj.py [--kontroll mapp]

Ingenting ritas ovanpa malningen. Shadern andrar malningens egna pixlar: stjarnor glimrar,
fonster och gatljus lyser, fladdrar och slacks ibland en stund, vattnet krusar, och molnen
driver at hoger bakom tornen medan staden star helt still.

public/omslag/valj-glimt.png (fondens storlek, RGB, ingen alfa: en alfakanal kan ta med sig
fargkanalerna nar webblasaren forbehandlar bilden):
  R = hur mycket pixeln hor till en stjarna, ett fonster eller ett gatljus, 0..255.
      Stjarnor: mjuk kant. Fonster: 255 i sjalva fonstret, en ring under 60 % runt det = skenet.
  G = ljusets fas, samma for alla dess pixlar (takten raknas ur fasen i shadern)
  B = hur mycket pixeln ar vatten, 0..255 med mjuk kant
  Stjarna eller fonster skiljs at i shadern: fonstren ligger i staden (valj-himmel R).

public/omslag/valj-himmel.png (fondens storlek, RGB, lases pixel for pixel):
  R = staden och bergen, som star helt still: 255 pa allt som inte ar himmel och 3 px ut
      i himlen, sedan en mjuk kant pa 2 px.
  G = hur molnigt det ar, 0..255. Dar det ar helt klart (stjarnorna, galaxen, manen) star
      malningen still; dar det ar moln, och i gapen mellan dem, flyttas allt.
  B = bakom staden: sa manga px till vanster himlen hamtas (molnen driver at hoger, sa det som
      syns till hoger om ett torn ar himlen som gick in bakom det pa vanster sida).

Metoder:
- Stjarnor: en punkt ar en stjarna om den ar tydligt ljusare an medianen i en 15x15-ruta runt
  den och liten, ovanfor stadssilhuetten (manen och galaxkarnan ar for stora och faller bort).
  Stjarnorna ar oforandrade sedan 2026-09-23 (samma pixlar och faser).
- Silhuetten: staden ar mork (median 5x5 under 64, bergen under 84 nedanfor y 785) och hanger
  ihop med bildens nederkant; en mork molnkant som inte gor det raknas inte. Kanten vaxer in
  i pixlar under 80 (tornens halvmorka kant), och hal i staden (himmel i ett klocktorn) fylls.
- Fonster och gatljus: varma (R - B > 25), ljusare an omgivningen (15x15-median + 12) och
  ljusa (> 70), sma (hogst 22 px), minst 5 px stora, inne i staden och inte i vattnet.
- Molnighet: ljusare och grarare an den klara bla himlen, (ljus - 50)/25 + (50 - (B - R))/20,
  suddad; 0 pa galaxen och manen.
- Himlen bakom husen: varje rad for sig, himlen till vanster om tornet, flyttad lika langt
  som tornet ar brett (det bredaste i 41 rader runt, sa att kopian inte blir sned).
- Vatten: en handritad kontur runt floden, och inom den bara det som ar bla vatten
  (medianen av B - R, och inte mork), sa att on och traden i kanten inte gungar med.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HÄR = Path(__file__).resolve().parent.parent
KÄLLA = HÄR / "assets" / "valj-fond.png"
MÅL = HÄR / "public" / "omslag" / "valj-glimt.png"
HIMMEL_MÅL = HÄR / "public" / "omslag" / "valj-himmel.png"

# Linjen mellan himmel och stad, i bildens bredd (0.66 av den ursprungliga 16:9-hojden).
SKYLINE_AV_BREDD = 0.3714
RUTA = 15
S_TRÖSKEL = 14.0         # stjarna: sa mycket ljusare an omgivningen
S_MAX_DIAMETER = 8
S_SUDD, S_SUDD_TRÖSKEL = 26, 96   # stora ljusa omraden (mane, galaxkarna) tas bort
S_MAX_ANTAL = 450
VÄXT = 2
# De gamla ljusen i staden (fore 2026-09-26) raknas fortfarande fram, bara for att stjarnorna
# ska fa samma nummer och fas som forut. De skrivs inte ut.
F_TRÖSKEL, F_VÄRME, F_MÖRK, F_MAX_DIAMETER, F_MAX_ANTAL = 12.0, 22.0, 80, 9, 320

# Silhuetten (se ovan).
STAD_MÖRK, BERG_Y, BERG_MÖRK, KANT_MÖRK = 64, 785, 84, 80
STAD_ÖVERST = 600        # inget i staden ar hogre an sa (hogsta tornet: y 623)
STILLA_UT = 3            # sa manga px ut i himlen star ocksa still
STILLA_TONA = 2.0        # och sa lang ar den mjuka kanten darefter
KÄLLA_FRI = 5            # himlen som hamtas bakom tornen ligger minst sa langt fran staden
KOPIA_GAP = 3

# Fonster och gatljus.
L_VÄRME, L_ÖVER, L_LJUS, L_MAX, L_MIN_YTA = 25.0, 12.0, 70.0, 22, 5
L_SKEN = 4.0             # skenets radie runt fonstret, px

# Molnen. Galaxen och manen ar ljusa men ar inte moln och star still. Galaxen ar en sned
# ellips, uppmatt i 1672x1300.
GALAX = (650, 185, 265, 90, 39)        # mitt x, mitt y, halvaxlar, vinkel i grader
GALAX_LITEN = (560, 285, 30)          # den lilla galaxen nedanfor
MANE = (1470, 150, 70)

# Flodens kontur i 1672x1300, uppmatt i bilden.
FLOD = [(0, 893), (540, 893), (590, 950), (660, 1010), (705, 1080), (705, 1135),
        (420, 1165), (300, 1160), (200, 1130), (100, 1112), (0, 1105)]


def ljuspunkter(lum, median, kand, max_diameter, max_antal, min_yta=1):
    """Sma sammanhangande flackar i kand, de starkaste max_antal, som boolsk mask."""
    etikett, n = ndimage.label(kand)
    if n == 0:
        return np.zeros_like(kand)
    styrka = ndimage.maximum(lum - median, etikett, range(1, n + 1))
    yta = ndimage.sum(kand, etikett, range(1, n + 1))
    behåll = np.zeros(n + 1, bool)
    kandidater = []
    for i, sl in enumerate(ndimage.find_objects(etikett), 1):
        if sl is None:
            continue
        if max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) <= max_diameter and yta[i - 1] >= min_yta:
            kandidater.append((styrka[i - 1], i))
    for _, i in sorted(kandidater, reverse=True)[:max_antal]:
        behåll[i] = True
    return behåll[etikett]


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def main():
    bild = np.asarray(Image.open(KÄLLA).convert("RGB")).astype(np.float32)
    H, W, _ = bild.shape
    lum = bild @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    median = ndimage.median_filter(lum, size=RUTA)
    över = lum - median
    linje = int(W * SKYLINE_AV_BREDD)
    yy, xx = np.mgrid[0:H, 0:W]
    sx, sy = W / 1672, H / 1300

    # Stjarnor ovanfor staden (och de gamla ljusen, bara for numreringen).
    stort = ndimage.gaussian_filter(lum, S_SUDD) > S_SUDD_TRÖSKEL
    kand = (över > S_TRÖSKEL) & ~stort
    kand[linje:, :] = False
    stjärnor = ljuspunkter(lum, median, kand, S_MAX_DIAMETER, S_MAX_ANTAL)
    värme = bild[..., 0] - bild[..., 2]
    kand = (över > F_TRÖSKEL) & (värme > F_VÄRME) & (median < F_MÖRK)
    kand[:linje - 30, :] = False
    gamla_ljus = ljuspunkter(lum, median, kand, F_MAX_DIAMETER, F_MAX_ANTAL)
    vuxen = ndimage.binary_dilation(stjärnor | gamla_ljus, iterations=VÄXT)
    nr, antal = ndimage.label(vuxen)
    _, (iy, ix) = ndimage.distance_transform_edt(nr == 0, return_indices=True)
    nr = nr[iy, ix]
    fas = np.concatenate([[0], np.random.default_rng(1604).random(antal)])
    s_vuxen = ndimage.binary_dilation(stjärnor, iterations=VÄXT)
    s_vikt = np.clip(ndimage.gaussian_filter(s_vuxen.astype(np.float32), 0.8) * 1.4, 0, 1)

    # Vattnet: inom konturen och bla.
    kontur = Image.new("L", (W, H), 0)
    ImageDraw.Draw(kontur).polygon([(x * sx, y * sy) for x, y in FLOD], fill=255)
    inom = np.asarray(kontur) > 0
    # Vatten ar blatt och inte morkt: traden pa on och i kanten har ljushet runt 14,
    # vattnet 38-61 (uppmatt i medianen).
    vatten = inom & (median > 28) & (ndimage.median_filter(bild[..., 2] - bild[..., 0], size=RUTA) > 3)
    vatten = ndimage.binary_opening(vatten, iterations=2)
    vatten = np.clip(ndimage.gaussian_filter(vatten.astype(np.float32), 5) * 1.3, 0, 1)

    # Silhuetten: staden och bergen.
    m5 = ndimage.median_filter(lum, size=5)
    kärna = ((m5 < STAD_MÖRK) & (yy >= STAD_ÖVERST)) | ((m5 < BERG_MÖRK) & (yy >= BERG_Y))
    et, _ = ndimage.label(kärna)
    stad = np.isin(et, np.unique(et[-1][et[-1] > 0]))
    for _ in range(3):
        stad |= ndimage.binary_dilation(stad) & (m5 < KANT_MÖRK) & (yy >= STAD_ÖVERST)
    stad = ndimage.binary_fill_holes(stad)
    # Kors, spiror och vindflojlar pa tornen ar 1-3 px breda och forsvinner i medianen: de vaxer
    # fram ur tornet dar pixeln ar klart morkare an himlen runt (15x15-medianen - 15).
    # Ett glapp pa nagra px (kulan ovanpa korset) hoppas over: ratt uppat vaxer det 5 px at gangen.
    tunt = (lum < median - 15) & (lum < 75) & (yy >= STAD_ÖVERST - 30)
    for _ in range(40):
        stad |= ndimage.binary_dilation(stad, structure=np.ones((11, 3), bool)) & tunt
    avst_stad = ndimage.distance_transform_edt(~stad)
    stilla_kärna = avst_stad <= STILLA_UT
    stilla = np.clip(1 - (avst_stad - STILLA_UT) / STILLA_TONA, 0, 1)
    himmel = ~stilla_kärna

    # Fonster och gatljus: varma, ljusa, sma, inne i staden, inte i vattnet.
    kand = ((värme > L_VÄRME) & (över > L_ÖVER) & (lum > L_LJUS)
            & ndimage.binary_erosion(stad, iterations=2) & (vatten < 0.05))
    ljus = ljuspunkter(lum, median, kand, L_MAX, 10000, L_MIN_YTA)
    l_kärna = ndimage.binary_dilation(ljus, iterations=1)
    l_nr, l_antal = ndimage.label(l_kärna)
    l_avst, (ly, lx) = ndimage.distance_transform_edt(l_nr == 0, return_indices=True)
    l_nr = l_nr[ly, lx]
    l_fas = np.concatenate([[0], np.random.default_rng(1926).random(l_antal)])
    l_vikt = np.where(l_kärna, 1.0, 0.55 * np.exp(-(l_avst / L_SKEN) ** 2))
    l_vikt[l_vikt < 0.03] = 0
    l_vikt *= stad          # skenet stannar i staden

    ut = np.zeros((H, W, 3), np.uint8)
    ut[..., 0] = np.round(np.where(stad, l_vikt, s_vikt) * 255)
    ut[..., 1] = np.where(stad, np.round(l_fas[l_nr] * 255) * (l_vikt > 0),
                          np.round(fas[nr] * 255) * (s_vikt > 0))
    ut[..., 2] = np.round(vatten * 255)
    Image.fromarray(ut, "RGB").save(MÅL, optimize=True)

    # Molnigheten: stjarnorna bort (median), ljusare och grarare an den klara himlen.
    m9 = ndimage.median_filter(lum, size=9)
    br = ndimage.median_filter(bild[..., 2] - bild[..., 0], size=9)
    # Oppningen tar bort de storsta stjarnorna (de ar storre an medianens ruta men mindre an ett moln).
    grad = ndimage.gaussian_filter(ndimage.grey_opening((m9 - 50) / 25 + (50 - br) / 20, size=(25, 25)), 8)
    moln = smooth(0.2, 0.9, grad)
    fri = np.ones((H, W), np.float32)
    gx, gy, ga, gb, gv = GALAX
    v = np.radians(gv)
    dx, dy = (xx - gx * sx), (yy - gy * sy)
    u = (dx * np.cos(v) + dy * np.sin(v)) / (ga * sx)
    w = (-dx * np.sin(v) + dy * np.cos(v)) / (gb * sy)
    fri = np.minimum(fri, smooth(1.0, 1.35, np.sqrt(u * u + w * w)))
    for cx, cy, r in (GALAX_LITEN, MANE):
        fri = np.minimum(fri, smooth(r * sx, r * sx + 40, np.hypot(xx - cx * sx, yy - cy * sy)))
    moln = moln * fri
    # I staden fylls molnigheten i fran himlen ovanfor, sa att en uppslagning nara kanten ar himmel.
    _, (my, mx) = ndimage.distance_transform_edt(stilla_kärna, return_indices=True)
    moln = moln[my, mx]

    # Himlen bakom staden: rad for rad, himlen till vanster om tornet, flyttad lika langt som
    # det bredaste av tornet i 41 rader runt, sa att kopian inte blir sned.
    kalla_fri = avst_stad > KÄLLA_FRI
    bredd = np.zeros((H, W), np.int32)
    for y in range(STAD_ÖVERST - STILLA_UT - 2, H):
        rad = stilla_kärna[y]
        if not rad.any():
            continue
        d = np.diff(np.concatenate([[0], rad.view(np.int8), [0]]))
        for a, b in zip(np.flatnonzero(d == 1), np.flatnonzero(d == -1)):
            bredd[y, a:b] = b - a
    bredd = ndimage.maximum_filter(bredd, size=(41, 1)) * stilla_kärna
    # Gar det inte (vid bergen ar raderna under hela staden, sa det bredaste blir for brett):
    # radens egen bredd, och sist himlen till vanster speglad i tornets kant.
    källa = np.tile(np.arange(W, dtype=np.int32), (H, 1))
    for y in range(STAD_ÖVERST - STILLA_UT - 2, H):
        rad, k, fri_rad = stilla_kärna[y], källa[y], kalla_fri[y]
        d = np.diff(np.concatenate([[0], rad.view(np.int8), [0]]))
        for a, b in zip(np.flatnonzero(d == 1), np.flatnonzero(d == -1)):
            for x in range(a, b):
                k[x] = x
                for c in (x - bredd[y, x] - KOPIA_GAP, x - (b - a) - KOPIA_GAP, 2 * a - x - 1 - KOPIA_GAP):
                    if c < 0:
                        continue
                    c = k[c] if rad[c] else c
                    if fri_rad[c]:
                        k[x] = c
                        break
    flytt = np.arange(W)[None, :] - källa
    # Bara dar det behovs: nara himlen till hoger (molnen driver hogst ~60 px per fas) och
    # dar kallan verkligen ar himmel. Annars ingen flytt (pixeln hamtas aldrig).
    nara = ndimage.distance_transform_edt(stilla_kärna) <= 80
    ok = (flytt > 0) & (flytt <= 255) & nara & stilla_kärna
    ok &= kalla_fri[np.arange(H)[:, None], np.clip(källa, 0, W - 1)]
    flytt = np.where(ok, flytt, 0)

    h = np.zeros((H, W, 3), np.uint8)
    h[..., 0] = np.round(stilla * 255)
    h[..., 1] = np.round(np.clip(moln, 0, 1) * 255)
    h[..., 2] = flytt
    Image.fromarray(h, "RGB").save(HIMMEL_MÅL, optimize=True)

    utan = (stilla_kärna & ~ok & (ndimage.distance_transform_edt(stilla_kärna) <= 30)).sum()
    print(f"public/omslag/valj-glimt.png: {int(ndimage.label(stjärnor)[1])} stjarnor, "
          f"{l_antal} fonster och gatljus, vatten {vatten.mean() * 100:.1f} % av bilden.")
    print(f"public/omslag/valj-himmel.png: staden fran y {int(np.argmax(stad.any(1)))}, "
          f"moln pa {(moln > 0.5).mean() * 100:.0f} % av bilden, {utan} stadspixlar nara himlen utan kalla.")

    if "--kontroll" in sys.argv:
        mapp = Path(sys.argv[sys.argv.index("--kontroll") + 1])
        mapp.mkdir(parents=True, exist_ok=True)
        k = bild.copy()
        kant = stilla_kärna & ~ndimage.binary_erosion(stilla_kärna)
        k[..., 0] = np.clip(k[..., 0] * (1 - moln * 0.5) + moln * 255 * 0.5, 0, 255)
        k[kant] = [255, 255, 0]
        k[l_kärna & ~ndimage.binary_erosion(l_kärna)] = [60, 255, 60]
        Image.fromarray(k.astype(np.uint8)).save(mapp / "valj-kontroll.png")


if __name__ == "__main__":
    main()
