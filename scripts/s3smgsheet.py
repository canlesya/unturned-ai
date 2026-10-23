# S3 ikinci tur karşılaştırma tabloları:  python3 scripts/s3smgsheet.py [önce=/tmp/wb-s3c/before] [sonra=/tmp/wb-s3c/after] [çıktı=/tmp/wb-s3c]
#   smg-skins.png (vitrin: silah × 5 kaplama, FP + LOD), smg-fp.png (bel önce | sonra + 3. şahıs), smg-ads.png (her izinli nişangâh önce | sonra)
import sys, os
from PIL import Image, ImageDraw, ImageFont
B = sys.argv[1] if len(sys.argv) > 1 else '/tmp/wb-s3c/before'
A = sys.argv[2] if len(sys.argv) > 2 else '/tmp/wb-s3c/after'
O = sys.argv[3] if len(sys.argv) > 3 else '/tmp/wb-s3c'
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
except Exception: F = ImageFont.load_default()
IDS = ['mp5', 'vector', 'p90', 'mac10', 'lmg', 'pkm', 'm1911', 'deagle', 'revolver', 'rpg']
W = {'mp5': ['iron', 'reddot', 'holo', 'acog'], 'vector': ['iron', 'reddot', 'holo'], 'p90': ['iron', 'reddot', 'holo'], 'mac10': ['iron', 'reddot'], 'lmg': ['iron', 'reddot', 'holo', 'acog'],
     'pkm': ['iron', 'reddot', 'holo'], 'm1911': ['iron', 'reddot'], 'deagle': ['iron', 'reddot'], 'revolver': ['iron'], 'rpg': ['iron']}
def tile(path, w, h, label, crop=None):
    im = Image.open(path).convert('RGB') if os.path.exists(path) else Image.new('RGB', (1600, 900), (40, 0, 0))
    if crop: x0, y0, x1, y1 = crop; im = im.crop((int(x0 * im.width), int(y0 * im.height), int(x1 * im.width), int(y1 * im.height)))
    im = im.resize((w, h)); d = ImageDraw.Draw(im); d.rectangle([0, 0, w, 30], fill=(0, 0, 0)); d.text((8, 4), label, fill=(255, 220, 120), font=F); return im
def sheet(out, pairs, cols, w=640, h=360, crop=None):
    rows = (len(pairs) + cols - 1) // cols
    S = Image.new('RGB', (w * 2 * cols, h * rows), (0, 0, 0))
    for i, (name, lab) in enumerate(pairs):
        c, r = i % cols, i // cols
        S.paste(tile(f'{B}/{name}.png', w, h, 'ÖNCE  ' + lab, crop), (c * 2 * w, r * h)); S.paste(tile(f'{A}/{name}.png', w, h, 'SONRA ' + lab, crop), (c * 2 * w + w, r * h))
    S.save(out); print(out, S.size)
sheet(f'{O}/smg-fp.png', [(f'desk-{w}-hip', f'{w} bel') for w in IDS] + [('desk-third-a', '3. şahıs mp5…lmg'), ('desk-third-b', '3. şahıs pkm…rpg')], 2, 640, 360)
sheet(f'{O}/smg-ads.png', [(f'desk-{w}-{o}-ads', f'{w} · {o}') for w, os_ in W.items() for o in os_], 3, 480, 270)
ims = [Image.open(f'{A}/{n}.png') for n in ('turn-fp-mp5', 'turn-fp-pkm', 'turn-lod-mp5', 'turn-lod-pkm') if os.path.exists(f'{A}/{n}.png')]
if ims:
    wd = max(i.width for i in ims); S = Image.new('RGB', (wd, sum(i.height for i in ims)), (32, 35, 40)); y = 0
    for i in ims: S.paste(i, (0, y)); y += i.height
    S.save(f'{O}/smg-skins.png'); print(f'{O}/smg-skins.png', S.size)
