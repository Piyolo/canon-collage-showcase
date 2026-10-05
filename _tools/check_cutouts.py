import os, glob, math
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), "assets", "img", "cameras")

files = sorted(glob.glob(os.path.join(SRC, "*.png")))
cols, cell = 3, 460
rows = math.ceil(len(files) / cols)
canvas = Image.new("RGB", (cols * cell, rows * cell), (230, 40, 60))  # red catches halos
d = ImageDraw.Draw(canvas)
try:
    f = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 22)
except Exception:
    f = ImageFont.load_default()

for i, p in enumerate(files):
    im = Image.open(p).convert("RGBA")
    im.thumbnail((cell - 30, cell - 50), Image.LANCZOS)
    cx, cy = (i % cols) * cell, (i // cols) * cell
    canvas.paste(im, (cx + (cell - im.width) // 2, cy + (cell - im.height) // 2), im)
    d.rectangle([cx, cy + cell - 30, cx + cell, cy + cell], fill=(0, 0, 0))
    d.text((cx + 8, cy + cell - 27), os.path.basename(p), font=f, fill=(255, 230, 60))

out = os.path.join(HERE, "sheet_cut.jpg")
canvas.save(out, quality=88)
print("wrote", out)
