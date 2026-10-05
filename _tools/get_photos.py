import os, re, time, json, urllib.request, urllib.parse

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "cand_ph")
os.makedirs(OUT, exist_ok=True)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

# category -> pexels search slug
QUERIES = {
    "portrait":   "portrait",
    "street":     "street%20photography",
    "night":      "night%20city",
    "landscape":  "landscape",
    "film":       "analog%20film",
    "concert":    "concert",
    "ocean":      "ocean",
    "mountain":   "mountain",
    "architecture": "architecture",
    "coffee":     "cafe",
    "flowers":    "flowers",
    "car":        "classic%20car",
    "desert":     "desert",
    "rain":       "rain",
    "sports":     "basketball",
    "fashion":    "fashion",
}
PER_Q = 8

def get(url, timeout=40):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

manifest = {}

# --- 1. scrape IDs per query ---
for cat, slug in QUERIES.items():
    if cat in manifest:
        continue
    try:
        html = get("https://www.pexels.com/search/%s/" % slug).decode("utf-8", "ignore")
        ids = []
        for m in re.finditer(r"images\.pexels\.com/photos/(\d+)/", html):
            i = m.group(1)
            if i not in ids:
                ids.append(i)
        manifest[cat] = ids[:PER_Q]
        print("%-13s %d ids" % (cat, len(manifest[cat])))
    except Exception as e:
        print("FAIL %s: %s" % (cat, e))
        manifest[cat] = []
    time.sleep(0.8)

# --- 2. download candidates ---
def dl(cat, pid, w=700):
    dest = os.path.join(OUT, "%s_%s.jpg" % (cat, pid))
    if os.path.exists(dest) and os.path.getsize(dest) > 8000:
        return True
    url = ("https://images.pexels.com/photos/%s/pexels-photo-%s.jpeg"
           "?auto=compress&cs=tinysrgb&w=%d" % (pid, pid, w))
    for i in range(3):
        try:
            data = get(url, 45)
            if len(data) < 8000:
                raise ValueError("small")
            open(dest, "wb").write(data)
            return True
        except Exception as e:
            if i == 2:
                print("  x %s_%s: %s" % (cat, pid, e))
                return False
            time.sleep(1.5 * (i + 1))
    return False

n = 0
for cat, ids in manifest.items():
    for pid in ids:
        if dl(cat, pid):
            n += 1
    time.sleep(0.4)

json.dump(manifest, open(os.path.join(HERE, "photos_manifest.json"), "w"), indent=1)
print("\ndownloaded %d photo candidates" % n)
