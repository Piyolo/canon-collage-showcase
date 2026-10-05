"""Prepare final site assets:
   - cameras: knock out plain (white/light) backgrounds -> transparent PNG cutouts
   - photos : resize + optimise the selected Pexels frames
"""
import os, shutil
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CAM_SRC = os.path.join(HERE, "cand_cam")
PH_SRC = os.path.join(HERE, "cand_ph")
CAM_DST = os.path.join(ROOT, "assets", "img", "cameras")
PH_DST = os.path.join(ROOT, "assets", "img", "photos")
os.makedirs(CAM_DST, exist_ok=True)
os.makedirs(PH_DST, exist_ok=True)


def cutout(src, dst, tol=74, feather=1.2, maxw=1300):
    """Flood-fill the plain background inward from the border, then feather."""
    im = Image.open(src).convert("RGB")
    if im.width > maxw:
        im = im.resize((maxw, int(im.height * maxw / im.width)), Image.LANCZOS)

    w, h = im.size
    # work on a copy where we fill the bg with a sentinel colour, sampling the
    # median of the 4 corners so it also works on off-white / gradient paper
    base = im.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    px = im.load()
    for sx, sy in seeds:
        try:
            ImageDraw.floodfill(im, (sx, sy), (255, 0, 255), thresh=tol)
        except Exception:
            pass

    # build alpha: sentinel -> transparent
    ip, bp = im.load(), base.load()
    alpha = Image.new("L", (w, h), 255)
    ap = alpha.load()
    for y in range(h):
        for x in range(w):
            r, g, b = ip[x, y]
            if r > 235 and g < 40 and b > 235:
                ap[x, y] = 0

    # also catch very light pixels that touch already-cleared regions (haloes)
    alpha = alpha.filter(ImageFilter.GaussianBlur(feather))
    # feather the edge to anti-alias it; the flat interior stays fully opaque
    alpha = alpha.filter(ImageFilter.GaussianBlur(feather))

    out = base.convert("RGBA")
    out.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 24 else 0).getbbox()
    if bbox:
        pad = 6
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                min(w, bbox[2] + pad), min(h, bbox[3] + pad))
        out = out.crop(bbox)
    out.save(dst, "PNG", optimize=True)
    return out.size, os.path.getsize(dst)


# ---------------------------------------------------------------- cameras
# name -> (source file, mode)
CAMERAS = {
    "ae1":     ("ae1_w50.jpg",   "cut"),   # 1976 AE-1, silver, white studio bg
    "rebel":   ("400d.jpg",      "cut"),   # EOS 400D / Rebel XTi, flash up
    "5dm2":    ("5dm2_50.jpg",   "cut"),   # 5D Mark II + EF 50mm f/1.4
    "1dx3":    ("1dx3.jpg",      "cut"),   # EOS-1D X Mark III flagship
    "r5":      ("r5.jpg",        "cut"),   # EOS R5 mirrorless
    "r100":    ("r100.jpg",      "cut"),   # EOS R100 mirrorless
    "7d":      ("7d_01.jpg",     "cut"),   # EOS 7D
    "5dm4dk":  ("5dm4.jpg",      "keep"),  # dramatic black-bg studio shot
    "mount":   ("ae1_mount.jpg", "keep"),  # FD mount macro detail
}

print("== cameras ==")
for name, (src, mode) in CAMERAS.items():
    sp = os.path.join(CAM_SRC, src)
    if not os.path.exists(sp):
        print("missing", src); continue
    if mode == "cut":
        dp = os.path.join(CAM_DST, name + ".png")
        if os.path.exists(dp):
            print("%-8s -> %s (cached)" % (name, os.path.basename(dp))); continue
        size, n = cutout(sp, dp)
        print("%-8s -> %s  %sx%s  %d KB" % (name, os.path.basename(dp), size[0], size[1], n // 1024))
    else:
        dp = os.path.join(CAM_DST, name + ".jpg")
        im = Image.open(sp).convert("RGB")
        if im.width > 1300:
            im = im.resize((1300, int(im.height * 1300 / im.width)), Image.LANCZOS)
        im.save(dp, "JPEG", quality=86, optimize=True)
        print("%-8s -> %s  %sx%s  %d KB" % (name, os.path.basename(dp), im.width, im.height,
                                            os.path.getsize(dp) // 1024))

# ---------------------------------------------------------------- photos
# source id -> friendly filename (pexels id is the slug source)
PHOTOS = [
    ("portrait_29563571", "bw-photographer"),
    ("street_35846950",   "analog-girl"),
    ("street_27583914",   "dock-photographer"),
    ("film_35120013",     "hill-shoot"),
    ("film_7014266",      "negatives"),
    ("film_17094723",     "film-rolls"),
    ("film_3653770",      "canon-film"),
    ("night_15103614",    "bokeh-city"),
    ("night_29183516",    "light-trails"),
    ("night_11290329",    "rain-night"),
    ("concert_7513442",   "red-crowd"),
    ("concert_4218027",   "stage-lights"),
    ("portrait_30386124", "red-shirt"),
    ("portrait_29204802", "bw-portrait-man"),
    ("desert_3345752",    "dunes-sunset"),
    ("desert_2563810",    "dunes-bw"),
    ("mountain_16573043", "snow-peak"),
    ("street_18723032",   "tunnel"),
    ("sports_5331954",    "golden-hoop"),
    ("sports_13179883",   "neon-court"),
    ("architecture_24531672", "ribs"),
    ("flowers_16997489",  "tulips"),
    ("rain_18865287",     "rain-window"),
    ("ocean_28242039",    "sunset-ocean"),
]

print("\n== photos ==")
ok = 0
for pid, slug in PHOTOS:
    sp = os.path.join(PH_SRC, pid + ".jpg")
    if not os.path.exists(sp):
        print("missing", pid); continue
    im = Image.open(sp).convert("RGB")
    if im.width > 1500:
        im = im.resize((1500, int(im.height * 1500 / im.width)), Image.LANCZOS)
    dp = os.path.join(PH_DST, slug + ".jpg")
    im.save(dp, "JPEG", quality=84, optimize=True, progressive=True)
    ok += 1
print("photos written: %d" % ok)
