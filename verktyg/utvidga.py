"""
Bygger de breda målningarna ur originalen och utvidgningarna från ChatGPT (assets/utvidga/, prompter.md där):

    python verktyg/utvidga.py

Rickard 2026-09-27: "det skall aldrig vara sådana där suddiga partier på sidorna alls". Originalen är orörda i
mitten; bara det nya åt sidorna tas ur utvidgningen, färgjusterat mot originalet i ett band innanför kanten, och
fogen tonas över 70 px innanför originalets kant.
  assets/valj-fond-smal.png (1672x1300) + valj-vanster/-hoger  -> assets/valj-fond.png (3120x1300)
  assets/intro-scen/grund2-b.png (1672x941) + intro-vanster     -> assets/intro-scen/grund2-bred.png (2272x941)
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

HÄR = Path(__file__).resolve().parent.parent
U = HÄR / "assets" / "utvidga"
FOG = 70


def las(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float32)


def fog(bred, orig, gen, x_orig, sida):
    """Lägger in orig i bred vid x_orig; gen (samma skala som bred) fyller resten på sidan 'sida'."""
    H, W = orig.shape[:2]
    # Färgjustering: gen mot orig i ett 200 px band innanför kanten (utjämnad kvot per rad och kanal).
    if sida == "v":
        band = slice(x_orig, x_orig + 200)
    else:
        band = slice(x_orig + W - 200, x_orig + W)
    o = orig[:, band.start - x_orig:band.stop - x_orig].mean(1)
    g = gen[:, band].mean(1)
    kvot = ndimage.gaussian_filter1d((o + 4) / (g + 4), 40, axis=0)
    gen = np.clip(gen * kvot[:, None, :], 0, 255)
    ut = gen.copy()
    ut[:, x_orig:x_orig + W] = orig
    x = np.arange(bred)
    if sida == "v":
        w = np.clip((x - x_orig) / FOG, 0, 1)
    else:
        w = np.clip((x_orig + W - x) / FOG, 0, 1)
    w = (w * w * (3 - 2 * w))[None, :, None]
    innanfor = (x >= x_orig) & (x < x_orig + W)
    blandat = gen * (1 - w) + ut * w
    ut[:, innanfor] = blandat[:, innanfor]
    return ut


def main():
    v = las(HÄR / "assets" / "valj-fond-smal.png")   # 1672x1300
    H = v.shape[0]
    E = 724
    B = 1672 + 2 * E
    s = H / 941
    gv = las(U / "valj-vanster.png"); gh = las(U / "valj-hoger.png")
    gv = np.asarray(Image.fromarray(gv.astype(np.uint8)).resize((round(1672 * s), H), Image.LANCZOS)).astype(np.float32)
    gh = np.asarray(Image.fromarray(gh.astype(np.uint8)).resize((round(1672 * s), H), Image.LANCZOS)).astype(np.float32)
    # Vänster: underlaget var [E svart | original 0..1587]; höger: [original 85..1672 | E svart].
    vanster = np.zeros((H, B, 3), np.float32); vanster[:, :gv.shape[1]] = gv[:, :B]
    hoger = np.zeros((H, B, 3), np.float32); x0 = B - gh.shape[1]; hoger[:, x0:] = gh
    ut = fog(B, v, vanster, E, "v")
    ut2 = fog(B, v, hoger, E, "h")
    ut[:, E + 1672 // 2:] = ut2[:, E + 1672 // 2:]
    Image.fromarray(np.round(ut).astype(np.uint8)).save(HÄR / "assets" / "valj-fond.png", optimize=True)

    g = las(HÄR / "assets" / "intro-scen" / "grund2-b.png")   # 1672x941
    E2 = 600
    gi = las(U / "intro-vanster.png")
    bred = np.zeros((941, 1672 + E2, 3), np.float32); bred[:, :1672] = gi
    ut = fog(1672 + E2, g, bred, E2, "v")
    Image.fromarray(np.round(ut).astype(np.uint8)).save(HÄR / "assets" / "intro-scen" / "grund2-bred.png", optimize=True)
    print("valj-fond.png", B, "x", H, "; grund2-bred.png", 1672 + E2, "x 941")


if __name__ == "__main__":
    main()
