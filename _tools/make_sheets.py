"""Build contact sheets from a folder of images so picks can be made visually."""
import os, sys, math, glob
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))

def font(sz):
    for p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

def sheet(src_glob, out_prefix, cols=6, cell=300, per=24, label=True):
    files = sorted(glob.glob(src_glob))
    if not files:
        print("no files for", src_glob); return []
    sheets = []
    for s in range(0, len(files), per):
        chunk = files[s:s + per]
        rows = math.ceil(len(chunk) / cols)
        W, H = cols * cell, rows * cell
        canvas = Image.new("RGB", (W, H), (26, 26, 28))
        d = ImageDraw.Draw(canvas)
        f = font(15)
        for i, path in enumerate(chunk):
            try:
                im = Image.open(path).convert("RGB")
            except Exception:
                continue
            im.thumbnail((cell - 8, cell - 8), Image.LANCZOS)
            cx, cy = (i % cols) * cell, (i // cols) * cell
            ox = cx + (cell - im.width) // 2
            oy = cy + (cell - im.height) // 2
            canvas.paste(im, (ox, oy))
            if label:
                name = os.path.splitext(os.path.basename(path))[0]
                tw = d.textlength(name, font=f)
                tx, ty = cx + 4, cy + cell - 20
                d.rectangle([tx - 3, ty - 2, tx + tw + 3, ty + 17], fill=(0, 0, 0))
                d.text((tx, ty), name, font=f, fill=(255, 230, 60))
        out = os.path.join(HERE, "%s_%d.jpg" % (out_prefix, s // per + 1))
        canvas.save(out, quality=86)
        sheets.append(out)
        print("wrote", out, "(%d imgs)" % len(chunk))
    return sheets

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "ph"
    if which == "ph":
        sheet(os.path.join(HERE, "cand_ph", "*.jpg"), "sheet_ph")
    else:
        sheet(os.path.join(HERE, "cand_cam", "*.jpg"), "sheet_cam")
