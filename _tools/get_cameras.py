import os, time, urllib.request, urllib.parse, sys

OUT = os.path.join(os.path.dirname(__file__), "cand_cam")
os.makedirs(OUT, exist_ok=True)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

# name -> full-res URL (standard thumb widths only: 320/640/800/1024/1280/1920)
CAMS = {
    # --- vintage FD era ---
    "ae1_fd50":   "https://upload.wikimedia.org/wikipedia/commons/2/25/Canon_AE-1_with_FD50mm_F1.4.jpg",
    "ae1_front":  "https://upload.wikimedia.org/wikipedia/commons/5/58/Canon_AE-1_front_with_50mm_lens.jpg",
    "ae1_black":  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Canon_AE-1_in_black.jpg/1280px-Canon_AE-1_in_black.jpg",
    "a1_pair":    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Canon_A-1%2C_Canon_AE-1_%284100805418%29.jpg/1280px-Canon_A-1%2C_Canon_AE-1_%284100805418%29.jpg",
    "ae1_2":      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Canon_AE-1_2.jpg/1280px-Canon_AE-1_2.jpg",
    "ae1_w50":    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Canon_AE-1_with_50mm_f1.8_S.C._II.jpg/1280px-Canon_AE-1_with_50mm_f1.8_S.C._II.jpg",
    "ae1_mount":  "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Canon_AE-1_FD_mount.jpg/1280px-Canon_AE-1_FD_mount.jpg",
    # --- EOS DSLR era ---
    "1dx3":       "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Canon_EOS-1DX_Mark_III.jpg/1280px-Canon_EOS-1DX_Mark_III.jpg",
    "5dm4":       "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Canon_EOS_5D_Mark_IV_%28Front%29%2C_1803241116%2C_ako.jpg/1280px-Canon_EOS_5D_Mark_IV_%28Front%29%2C_1803241116%2C_ako.jpg",
    "5dm4_rear":  "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Canon_EOS_5D_Mark_IV_%28Rear%29%2C_1803241121%2C_ako.jpg/1280px-Canon_EOS_5D_Mark_IV_%28Rear%29%2C_1803241121%2C_ako.jpg",
    "5dm2_50":    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Canon_EOS_5D_Mark_II_with_50mm_1.4.jpg/1280px-Canon_EOS_5D_Mark_II_with_50mm_1.4.jpg",
    "7d_front":   "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Canon_EOS_7D_DSLR_body_front.jpg/1280px-Canon_EOS_7D_DSLR_body_front.jpg",
    "7d_01":      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Canon_EOS_7D_01.jpg/1280px-Canon_EOS_7D_01.jpg",
    "400d":       "https://upload.wikimedia.org/wikipedia/commons/5/5d/Canon_EOS_400D.jpg",
    "650d":       "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/EOS_650D.jpg/1280px-EOS_650D.jpg",
    "eos300":     "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Canon_EOS_300%2C_1803122020%2C_ako.jpg/1280px-Canon_EOS_300%2C_1803122020%2C_ako.jpg",
    # --- mirrorless R era ---
    "r5":         "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Canon_EOS_R5.jpg/1280px-Canon_EOS_R5.jpg",
    "r100":       "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Canon_EOS_R100%2C_front.jpg/1280px-Canon_EOS_R100%2C_front.jpg",
    "rebel_gp":   "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Canon_EOS_RebelGp2.jpg/1280px-Canon_EOS_RebelGp2.jpg",
}

def fetch(url, dest, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA,
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://commons.wikimedia.org/",
            })
            with urllib.request.urlopen(req, timeout=45) as r:
                data = r.read()
            if len(data) < 8000 or data[:15].lower().startswith(b"<!doctype html"):
                raise ValueError("not an image: %d bytes" % len(data))
            with open(dest, "wb") as f:
                f.write(data)
            return len(data)
        except Exception as e:
            if i == tries - 1:
                print("FAIL %-12s %s" % (os.path.basename(dest), e))
                return 0
            time.sleep(10 * (i + 1))

total, ok = 0, 0
for name, url in CAMS.items():
    dest = os.path.join(OUT, name + ".jpg")
    if os.path.exists(dest) and os.path.getsize(dest) > 8000:
        ok += 1
        continue
    n = fetch(url, dest)
    if n:
        ok += 1
        total += n
        print("OK   %-12s %d KB" % (name, n // 1024))
    time.sleep(5.0)

print("\ncameras: %d/%d ok, %.1f MB" % (ok, len(CAMS), total / 1e6))
