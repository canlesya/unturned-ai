# 12.190 önce / sonra tablosu: satır = silah:nişangâh, sütun = önce bel | önce nişan | sonra bel | sonra nişan | sonra yandan (model) | Pixel 7 nişan.
#   python3 scripts/pubgsheet.py [/tmp/wb-qa8]   → tablo.jpg (+ tablo-1.jpg, tablo-2.jpg parçaları)
import sys, os
from PIL import Image, ImageDraw, ImageFont
R = sys.argv[1] if len(sys.argv) > 1 else '/tmp/wb-qa8'
ROWS = ['m4a1:iron', 'm4a1:reddot', 'm4a1:holo', 'm4a1:x2', 'm4a1:x3', 'm4a1:acog', 'm4a1:x6', 'ak47:acog', 'mp5:x3', 'pistol:reddot',
        'sniper:scope', 'sniper:x6', 'sniper:x8', 'barrett:scope6', 'barrett:x8', 'svd:acog', 'svd:x8', 'ww_bolt:ww_peep', 'ww_bolt:ww_scout', 'ww_bolt:ww_sc25', 'ww_bolt:ww_sc4']
COLS = [('once', 'desk', 'hip', 'ÖNCE bel'), ('once', 'desk', 'ads', 'ÖNCE nişan'), ('sonra', 'desk', 'hip', 'SONRA bel'), ('sonra', 'desk', 'ads', 'SONRA nişan'),
        ('sonra', 'desk', 'side', 'SONRA model'), ('sonra', 'mob', 'ads', 'SONRA Pixel 7')]
W, H, LW, TH = 400, 225, 150, 26
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 15); FS = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 13)
except Exception: F = FS = ImageFont.load_default()
def cell(tag, dev, nm, key):
    w, o = key.split(':'); p = f'{R}/{tag}/{tag}-{dev}-{w}-{o}-{nm}.png'
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGB')
    iw, ih = im.size
    if nm == 'side': im = im.crop((int(iw * .28), int(ih * .5), int(iw * .98), int(ih * .98)))      # yandan: silah bölgesi
    elif iw / ih > 1.8: cw = int(ih * 16 / 9); im = im.crop(((iw - cw) // 2, 0, (iw - cw) // 2 + cw, ih))      # telefon (2,2:1): ortadan 16:9
    return im.resize((W, H), Image.LANCZOS)
def sheet(rows, out):
    S = Image.new('RGB', (LW + W * len(COLS), TH + H * len(rows)), (14, 16, 20)); d = ImageDraw.Draw(S)
    for j, c in enumerate(COLS): d.text((LW + j * W + 8, 5), c[3], fill=(255, 190, 90) if c[0] == 'sonra' else (170, 180, 195), font=F)
    for i, k in enumerate(rows):
        y = TH + i * H; d.text((8, y + 8), k.replace(':', '\n'), fill=(235, 240, 245), font=F)
        for j, c in enumerate(COLS):
            im = cell(c[0], c[1], c[2], k)
            if im: S.paste(im, (LW + j * W, y))
            else: d.text((LW + j * W + 120, y + 100), 'yok (yeni nişangâh)' if c[0] == 'once' else '-', fill=(110, 115, 125), font=FS)
            d.rectangle([LW + j * W, y, LW + (j + 1) * W - 1, y + H - 1], outline=(40, 44, 50))
    S.save(out, quality=86); return S
half = (len(ROWS) + 1) // 2
sheet(ROWS[:half], f'{R}/tablo-1.jpg'); sheet(ROWS[half:], f'{R}/tablo-2.jpg')
full = sheet(ROWS, f'{R}/tablo.jpg'); print(full.size, f'{R}/tablo.jpg')
