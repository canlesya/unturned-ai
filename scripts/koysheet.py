# Kum Köyü görüntülerinden etiketli tablo (12.224):  python3 scripts/koysheet.py /tmp/wb-koy day cikti.png [ad1 ad2 ...]
import sys, os
from PIL import Image, ImageDraw, ImageFont
d, tod, out = sys.argv[1], sys.argv[2], sys.argv[3]
names = sys.argv[4:] or sorted(f[len(tod) + 1:-4] for f in os.listdir(d) if f.startswith(tod + '-') and f.endswith('.png'))
W, COLS = 560, 3
font = None
for fp in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
    try: font = ImageFont.truetype(fp, 18); break
    except Exception: pass
font = font or ImageFont.load_default()
tiles = []
for n in names:
    p = os.path.join(d, f'{tod}-{n}.png')
    if not os.path.exists(p): continue
    im = Image.open(p).convert('RGB'); h = int(im.height * W / im.width); im = im.resize((W, h))
    t = Image.new('RGB', (W, h + 28), (18, 20, 26)); t.paste(im, (0, 28)); ImageDraw.Draw(t).text((8, 4), f'{tod} · {n}', fill=(240, 220, 160), font=font); tiles.append(t)
rows = [tiles[i:i + COLS] for i in range(0, len(tiles), COLS)]
th = max(t.height for t in tiles)
sheet = Image.new('RGB', (COLS * W + (COLS - 1) * 6, len(rows) * th + (len(rows) - 1) * 6), (10, 10, 12))
for r, row in enumerate(rows):
    for c, t in enumerate(row): sheet.paste(t, (c * (W + 6), r * (th + 6)))
sheet.save(out, quality=88)
print(out, len(tiles))
