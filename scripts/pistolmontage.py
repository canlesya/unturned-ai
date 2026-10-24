# Tabanca hissi önce / sonra montajı (12.141).  python3 scripts/pistolmontage.py <önce> <sonra> <çıktı.png> [silah ...]
# Her silah için satırlar: bel atışı, nişan atışı (t = 0, 30, 60, 100, 160 ms), çekme, boş şarjör değişimi + son mermi. Önce (turuncu) / sonra (yeşil) alt alta.
import sys, os
from PIL import Image, ImageDraw, ImageFont
a, b, outp = sys.argv[1], sys.argv[2], sys.argv[3]
guns = sys.argv[4:] or ['pistol', 'm1911', 'deagle', 'revolver']
W = 300
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 15)
except Exception: font = ImageFont.load_default()
ROWS = [('hip', ['hip-t000', 'hip-t030', 'hip-t060', 'hip-t100', 'hip-t160'], ['0', '30', '60', '100', '160 ms'], (0.42, 0.3, 1.0, 1.0)),
        ('nişan', ['ads-t000', 'ads-t030', 'ads-t060', 'ads-t100', 'ads-t160'], ['0', '30', '60', '100', '160 ms'], (0.25, 0.2, 0.75, 0.8)),
        ('çekme', ['raise-t000', 'raise-t050', 'raise-t100', 'raise-t160', 'raise-t250'], ['0', '50', '100', '160', '250 ms'], (0.3, 0.2, 1.0, 1.0)),
        ('doldurma', ['reload-k30', 'reload-k66', 'reload-k74', 'reload-k80', 'last-t160'], ['%30', '%66', '%74', '%80', 'son mermi'], (0.3, 0.2, 1.0, 1.0))]
def tile(folder, fn, crop):
    p = os.path.join(folder, fn + '.png')
    if not os.path.exists(p): return Image.new('RGB', (W, int(W * 0.66)), (40, 0, 0))
    im = Image.open(p).convert('RGB'); w, h = im.size
    im = im.crop((int(crop[0] * w), int(crop[1] * h), int(crop[2] * w), int(crop[3] * h)))
    return im.resize((W, int(im.height * W / im.width)))
rows = []
for g in guns:
    for name, fns, labels, crop in ROWS:
        for tag, folder, col in (('ÖNCE', a, (255, 140, 90)), ('SONRA', b, (130, 230, 150))):
            tiles = [tile(folder, f'{g}-{f}', crop) for f in fns]
            h = tiles[0].height
            row = Image.new('RGB', (W * 5 + 4 * 4, h + 24), (18, 20, 26))
            d = ImageDraw.Draw(row)
            for i, t in enumerate(tiles):
                row.paste(t, (i * (W + 4), 24)); d.text((i * (W + 4) + 6, 4), f'{tag} · {g} · {name} · {labels[i]}', fill=col, font=font)
            rows.append(row)
H = sum(r.height + 4 for r in rows)
img = Image.new('RGB', (rows[0].width, H), (8, 9, 12)); y = 0
for r in rows: img.paste(r, (0, y)); y += r.height + 4
img.save(outp); print(outp, img.size)
