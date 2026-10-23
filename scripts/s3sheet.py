# S3 / nişan karşılaştırma tabloları (önce | sonra):  python3 scripts/s3sheet.py [önce=/tmp/wb-s3/before] [sonra=/tmp/wb-s3/after] [çıktı=/tmp/wb-s3]
#   sheet-hip.png (bel), sheet-ads.png (tam nişan, masaüstü), sheet-ads-mob.png (Pixel 7 / iPhone), sheet-ads70.png (geçişin %70'i), sheet-skins-fp.png, big/ (8 büyük tek görüntü)
import sys, os
from PIL import Image, ImageDraw, ImageFont
B = sys.argv[1] if len(sys.argv) > 1 else '/tmp/wb-s3/before'
A = sys.argv[2] if len(sys.argv) > 2 else '/tmp/wb-s3/after'
O = sys.argv[3] if len(sys.argv) > 3 else '/tmp/wb-s3'
os.makedirs(O + '/big', exist_ok=True)
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
except Exception: F = ImageFont.load_default()
W = {'ak47': ['iron', 'reddot', 'holo', 'acog'], 'm4a1': ['iron', 'reddot', 'holo', 'acog'], 'pistol': ['iron', 'reddot'], 'sniper': ['scope'], 'shotgun': ['iron', 'reddot', 'holo'],
     'mp5': ['iron', 'reddot', 'holo', 'acog'], 'scarh': ['iron', 'reddot', 'holo', 'acog'], 'deagle': ['iron', 'reddot'], 'lmg': ['iron', 'reddot', 'holo', 'acog']}
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
sheet(f'{O}/sheet-hip.png', [(f'desk-{w}-hip', f'{w} bel') for w in W], 2)
sheet(f'{O}/sheet-ads.png', [(f'desk-{w}-{o}-ads', f'{w} · {o}') for w, os_ in W.items() for o in os_], 2, 560, 315)
sheet(f'{O}/sheet-ads70.png', [(f'desk-{w}-{o}-ads70', f'{w} · {o} · %70') for w, os_ in W.items() for o in os_ if w in ('m4a1', 'ak47', 'sniper', 'pistol')], 2, 560, 315)
mob = [(f'{d}-{w}-{o}-ads', f'{d} {w} · {o}') for d in ('mob', 'iph') for w, os_ in W.items() for o in os_ if w in ('ak47', 'm4a1', 'pistol', 'sniper', 'shotgun')]
sheet(f'{O}/sheet-ads-mob.png', mob, 2, 560, 259)
# kaplamalar (birinci şahıs, yalnız sonra)
sk = ['std', 'desert', 'wood', 'urban', 'gold']; ws = ['ak47', 'm4a1', 'pistol', 'sniper', 'shotgun']
S = Image.new('RGB', (480 * 5, 270 * 5))
for r, w in enumerate(ws):
    for c, k in enumerate(sk): S.paste(tile(f'{A}/desk-{w}-skin-{k}.png', 480, 270, f'{w} · {k}', (0.4, 0.3, 1.0, 1.0)), (c * 480, r * 270))
S.save(f'{O}/sheet-skins-fp.png'); print(f'{O}/sheet-skins-fp.png')
# büyük tekler
for n, src in [('m4a1-reddot-ads', 'desk-m4a1-reddot-ads'), ('m4a1-iron-ads', 'desk-m4a1-iron-ads'), ('ak47-holo-ads', 'desk-ak47-holo-ads'), ('pistol-iron-ads', 'desk-pistol-iron-ads'),
               ('ak47-acog-ads70', 'desk-ak47-acog-ads70'), ('shotgun-hip', 'desk-shotgun-hip'), ('third-skins', 'desk-third-skins'), ('mob-m4a1-holo-ads', 'mob-m4a1-holo-ads')]:
    if os.path.exists(f'{A}/{src}.png'): Image.open(f'{A}/{src}.png').save(f'{O}/big/{n}.png')
