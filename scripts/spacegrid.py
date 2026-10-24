# Görüntü ızgarası (başlıklı):  python3 scripts/spacegrid.py <çıktı.png> <sütun> <genişlik> "dosya.png:Başlık" ...   (12.157 Uzay modu görselleri)
import sys
from PIL import Image, ImageDraw, ImageFont
out, cols, W = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
items = [x.rsplit(':', 1) if ':' in x[2:] else (x, '') for x in sys.argv[4:]]
font = None
for f in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc']:
    try: font = ImageFont.truetype(f, 18); break
    except Exception: pass
font = font or ImageFont.load_default()
ims = []
for fn, title in items:
    im = Image.open(fn).convert('RGB'); h = int(im.height * W / im.width); ims.append((im.resize((W, h)), title))
TH = 28
rows = [ims[i:i + cols] for i in range(0, len(ims), cols)]
H = sum(max(im.height for im, _ in r) + TH for r in rows) + 6 * (len(rows) - 1)
img = Image.new('RGB', (cols * W + 6 * (cols - 1), H), (16, 18, 24)); y = 0
for r in rows:
    rh = max(im.height for im, _ in r)
    for i, (im, t) in enumerate(r):
        x = i * (W + 6); img.paste(im, (x, y + TH)); ImageDraw.Draw(img).text((x + 8, y + 5), t, fill=(235, 238, 245), font=font)
    y += rh + TH + 6
img.save(out); print(out, img.size)
