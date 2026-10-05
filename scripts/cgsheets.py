# Tarama karelerinden etiketli kontak sayfaları: nokta başına 2×2 (4 yön) → screenshots/sweep/sheet_<idx>.png ve bölge gruplu sayfalar.
# Kullanım: python scripts/cgsheets.py [grup=4]  → sheet_g<k>.png (grup başına 'grup' nokta = 4×(2×2)), her kare 640×360 küçültülür 480×270
import json, sys
from PIL import Image, ImageDraw
G = int(sys.argv[1]) if len(sys.argv) > 1 else 3
m = json.load(open('screenshots/sweep/manifest.json', encoding='utf-8'))
yaws = m['yaws']; pts = m['pts']
W, H = 480, 270
names = {0: 'K', 90: 'B', 180: 'G', -90: 'D'}              # kuzey, batı, güney, doğu
sheets = []
for g0 in range(0, len(pts), G):
    grp = pts[g0:g0 + G]
    sh = Image.new('RGB', (W * 2 * len(grp) if len(grp) < 2 else W * 2 * 2, H * 2 * ((len(grp) + 1) // 2)), (20, 20, 20))
    for n, p in enumerate(grp):
        ox = (n % 2) * W * 2; oy = (n // 2) * H * 2
        for k, yw in enumerate(yaws[:4]):
            try: im = Image.open(f'screenshots/sweep/f_{p["i"]}_{k}.png').resize((W, H))
            except FileNotFoundError: continue
            sh.paste(im, (ox + (k % 2) * W, oy + (k // 2) * H))
            d = ImageDraw.Draw(sh); d.rectangle([ox + (k % 2) * W, oy + (k // 2) * H, ox + (k % 2) * W + 250, oy + (k // 2) * H + 14], fill=(0, 0, 0))
            d.text((ox + (k % 2) * W + 3, oy + (k // 2) * H + 1), f'#{p["i"]} x{p["x"]} z{p["z"]} y{p["y"]} {p["callout"]} bakis:{names.get(yw, yw)}', fill=(255, 255, 0))
    fn = f'screenshots/sweep/sheet_{g0 // G:03d}.png'
    sh.save(fn); sheets.append(fn)
json.dump(sheets, open('screenshots/sweep/sheets.json', 'w'))
print(len(sheets), 'sayfa')
