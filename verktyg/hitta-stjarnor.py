"""
Hittar stjarnorna och stadens fonsterljus i fondmalningen och skriver
public/stjarnor.json.

    python verktyg/hitta-stjarnor.py [--kontroll fil.png]

Sidan later stjarnorna och fonstren i malningen glimra i stallet for att lagga
ut egna prickar ovanpa den. Darfor behover den veta var de sitter.

Metod (stjarnor): en stjarna ar en liten punkt som ar tydligt ljusare an sin
narmaste omgivning. Vi jamfor varje pixel med medianen i en 15x15-ruta, tar de
lokala maxima som sticker upp over troskeln och behaller bara de sma omradena.
Manen och galaxkarnan ar ocksa ljusa, men stora: de maskas bort via en kraftigt
suddad kopia av bilden. Allt under stadssilhuetten hoppas over.

Metod (fonster): samma lokala maxima, men i bandet under NEDRE_KANT_AV_BREDD och bara
punkter som ar tydligt VARMA (R - B over troskeln). Manens reflex i vattnet och
molnen ar kalla eller stora och faller darfor bort.

Utdata: {"stjarnor": [[x, y, s, b, v], ...], "fonster": [[x, y, s, b], ...]}
dar x,y ar 0..1 i bildens koordinater, s ar radien i pixlar vid 1600 px bredd,
b ar ljushet 0..1 och v ar varmton 0..1 (0 = kallvit, 1 = gulvit). Fonstren har
ingen varmton: de ar varma per definition.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HÄR = Path(__file__).resolve().parent.parent
KÄLLA = HÄR / "assets" / "valj-fond.png"
MÅL = HÄR / "public" / "stjarnor.json"

BREDD_UT = 1600      # stjarnornas radie anges vid den har bredden
RUTA = 15            # medianrutan som "omgivningen" mats i
TRÖSKEL = 12.0        # hur mycket ljusare an omgivningen en stjarna maste vara
MAX_DIAMETER = 8     # storre ljusa flackar ar moln, mane eller galaxkarna
SUDD = 26            # radie pa suddet som hittar de stora ljusa omradena
SUDD_TRÖSKEL = 96    # gransvarde i den suddade bilden: over det ar det mane/karna
# Under den har linjen ar det moln och stad, inga stjarnor. Angiven i bildens BREDD
# (0.3714 x bredden = 0.66 av den ursprungliga 16:9-hojden), sa den star kvar pa samma
# stalle i malningen nar den forlangs nedat.
NEDRE_KANT_AV_BREDD = 0.3714
MAX_ANTAL = 320      # malningen har tusentals flackar, vi tar de starkaste

# Stadens fonsterljus, i bandet under NEDRE_KANT_AV_BREDD.
F_TRÖSKEL = 10.0       # hur mycket ljusare an omgivningen ett fonster maste vara
F_VÄRME = 25.0         # R - B: under det ar det manreflex, moln eller dis
F_MAX_DIAMETER = 10    # storre varma flackar ar ljusgardar, inte fonster
F_MÖRK_OMGIVNING = 70  # ett fonster sitter i en mork husvagg; varma molnkanter
                       # har ljus omgivning (uppmatt: hus 23-50, moln 100-115)
F_MAX_ANTAL = 120


def flackstorlek(grå, omgivning, y, x, max_diameter):
    """Radien pa den ljusa flacken runt (y, x), eller None om den ar for stor."""
    h, b = grå.shape
    r = 8
    y0, y1 = max(0, y - r), min(h, y + r + 1)
    x0, x1 = max(0, x - r), min(b, x + r + 1)
    ruta = grå[y0:y1, x0:x1]
    nivå = omgivning[y, x] + 0.5 * (grå[y, x] - omgivning[y, x])
    m, _ = ndimage.label(ruta > nivå)
    etikett = m[y - y0, x - x0]
    if etikett == 0:
        return None
    fläck = m == etikett
    rader = np.where(fläck.any(axis=1))[0]
    kolumner = np.where(fläck.any(axis=0))[0]
    if max(rader[-1] - rader[0] + 1, kolumner[-1] - kolumner[0] + 1) > max_diameter:
        return None
    return max(0.8, (int(fläck.sum()) / np.pi) ** 0.5)


def hitta_fönster(rgb, grå, omgivning, över, skala):
    """Sma varma ljuspunkter i stadssilhuetten: [[x, y, s, b], ...]."""
    h, b = grå.shape
    värme = rgb[:, :, 0] - rgb[:, :, 2]

    topp = ndimage.maximum_filter(grå, size=7)
    kandidater = ((grå >= topp) & (över > F_TRÖSKEL) & (värme > F_VÄRME)
                  & (omgivning < F_MÖRK_OMGIVNING))
    kandidater[:int(b * NEDRE_KANT_AV_BREDD), :] = False
    kandidater[-2:, :] = False
    kandidater[:, :2] = False
    kandidater[:, -2:] = False

    märkt, antal = ndimage.label(kandidater)
    punkter = ndimage.center_of_mass(kandidater, märkt, range(1, antal + 1))

    fönster = []
    for cy, cx in punkter:
        y, x = int(round(cy)), int(round(cx))
        radie = flackstorlek(grå, omgivning, y, x, F_MAX_DIAMETER)
        if radie is None:
            continue
        # Styrkan vagar in varmtonen: ett riktigt fonster lyser gult, inte bara ljust.
        styrka = float(över[y, x]) * float(np.clip(värme[y, x] / 60.0, 0.4, 1.6))
        fönster.append([round(float(cx / b), 5), round(float(cy / h), 5),
                        round(float(radie * skala), 2), 0.0, styrka])

    fönster.sort(key=lambda f: -f[4])
    fönster = fönster[:F_MAX_ANTAL]
    if fönster:
        styrkor = np.array([f[4] for f in fönster])
        låg, hög = np.percentile(styrkor, 5), np.percentile(styrkor, 95)
        for f in fönster:
            f[3] = round(float(np.clip((f[4] - låg) / max(1.0, hög - låg), 0.1, 1.0)), 3)
    return [f[:4] for f in fönster]


def hitta(bild):
    rgb = np.asarray(bild.convert("RGB"), dtype=np.float32)
    grå = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    h, b = grå.shape

    omgivning = ndimage.median_filter(grå, size=RUTA)
    över = grå - omgivning

    # Stora ljusa omraden: manen, galaxens karna, de ljusaste molnbankarna.
    stort = ndimage.gaussian_filter(grå, SUDD) > SUDD_TRÖSKEL

    topp = ndimage.maximum_filter(grå, size=7)
    kandidater = (grå >= topp) & (över > TRÖSKEL) & (~stort)
    kandidater[int(b * NEDRE_KANT_AV_BREDD):, :] = False
    kandidater[:2, :] = False
    kandidater[-2:, :] = False
    kandidater[:, :2] = False
    kandidater[:, -2:] = False

    # Flera pixlar kan dela samma topp. Slå ihop dem till en punkt var.
    märkt, antal = ndimage.label(kandidater)
    punkter = ndimage.center_of_mass(kandidater, märkt, range(1, antal + 1))

    skala = BREDD_UT / b
    stjärnor = []
    for cy, cx in punkter:
        y, x = int(round(cy)), int(round(cx))
        r = 8
        y0, y1 = max(0, y - r), min(h, y + r + 1)
        x0, x1 = max(0, x - r), min(b, x + r + 1)
        ruta = grå[y0:y1, x0:x1]
        topp_värde = grå[y, x]
        grund = omgivning[y, x]
        nivå = grund + 0.5 * (topp_värde - grund)

        # Hur stor ar den ljusa flacken runt toppen?
        m, _ = ndimage.label(ruta > nivå)
        etikett = m[y - y0, x - x0]
        if etikett == 0:
            continue
        fläck = m == etikett
        area = int(fläck.sum())
        rader = np.where(fläck.any(axis=1))[0]
        kolumner = np.where(fläck.any(axis=0))[0]
        höjd = rader[-1] - rader[0] + 1
        bredd = kolumner[-1] - kolumner[0] + 1
        if max(höjd, bredd) > MAX_DIAMETER:
            continue

        radie = max(0.8, (area / np.pi) ** 0.5) * skala
        färg = rgb[y, x]
        varm = float(np.clip((färg[0] - färg[2]) / 40.0 + 0.5, 0.0, 1.0))
        stjärnor.append([round(float(cx / b), 5), round(float(cy / h), 5), round(float(radie), 2),
                         0.0, round(varm, 2), float(över[y, x])])

    # Malningen har tusentals sma flackar. Vi behaller de som sticker upp mest.
    stjärnor.sort(key=lambda s: -s[5])
    stjärnor = stjärnor[:MAX_ANTAL]

    # Ljusheten skalas mot urvalet sjalvt, sa den funkar aven om fonden byts.
    styrka = np.array([s[5] for s in stjärnor])
    låg, hög = np.percentile(styrka, 5), np.percentile(styrka, 95)
    for s in stjärnor:
        s[3] = round(float(np.clip((s[5] - låg) / max(1.0, hög - låg), 0.05, 1.0)), 3)
    return [s[:5] for s in stjärnor], hitta_fönster(rgb, grå, omgivning, över, skala)


def kontrollbild(bild, stjärnor, fönster, fil):
    from PIL import ImageDraw
    ut = bild.convert("RGB").copy()
    rit = ImageDraw.Draw(ut)
    b, h = ut.size
    # Stjarnorna i cyan, fonstren i rott — sa det syns vilken detektor som tog vad.
    for x, y, s, _b, _v in stjärnor:
        px, py = x * b, y * h
        r = max(5.0, s * 2.5)
        rit.ellipse([px - r, py - r, px + r, py + r], outline=(60, 210, 255))
    for x, y, s, _b in fönster:
        px, py = x * b, y * h
        r = max(5.0, s * 2.5)
        rit.ellipse([px - r, py - r, px + r, py + r], outline=(255, 40, 40))
    ut.save(fil)


def main():
    if not KÄLLA.exists():
        print(f"hitta-stjarnor: {KÄLLA} saknas, hoppar over.")
        return 0
    bild = Image.open(KÄLLA)
    stjärnor, fönster = hitta(bild)
    MÅL.write_text(json.dumps({"stjarnor": stjärnor, "fonster": fönster}, separators=(",", ":")),
                   encoding="utf-8")
    print(f"{MÅL}: {len(stjärnor)} stjarnor, {len(fönster)} fonster.")
    if "--kontroll" in sys.argv:
        fil = sys.argv[sys.argv.index("--kontroll") + 1]
        kontrollbild(bild, stjärnor, fönster, fil)
        print(f"kontrollbild: {fil}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
