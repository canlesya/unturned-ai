# 12.174 Cephe dönem nişangâhları montajı: satır = silah × nişangâh, sütun = bel / %70 / tam nişan (+ tam nişan merkez 2×).
#   python3 scripts/ww2optics.py <sonra klasörü> <çıktı.png> [önce klasörü] [regex]   (önce verilirse her satırın solunda aynı silahın önceki tam nişanı)
import sys, os, re, glob
from PIL import Image, ImageDraw, ImageFont
after, outp = sys.argv[1], sys.argv[2]
before = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != '-' else None
rx = re.compile(sys.argv[4]) if len(sys.argv) > 4 else None
W, H = 480, 270
files = sorted(glob.glob(os.path.join(after, '*-100.png')))
rows = []
for f in files:
    m = re.match(r'(desk|mob)-(ww_[a-z]+)-([a-z0-9_]+)-100\.png', os.path.basename(f))
    if not m: continue
    dev, wid, op = m.groups()
    if rx and not rx.search(f'{wid}-{op}'): continue
    rows.append((dev, wid, op))
order = ['ww_bolt', 'ww_sniper', 'ww_semi', 'ww_smgb', 'ww_smgr', 'ww_lmg', 'ww_mg', 'ww_pistol']
oo = ['iron', 'ww_peep', 'ww_scout', 'ww_sc25', 'ww_sc4']
rows.sort(key=lambda r: (order.index(r[1]) if r[1] in order else 99, oo.index(r[2]) if r[2] in oo else 99))
cols = (['önce tam'] if before else []) + ['bel', '%70', 'tam nişan', 'merkez 2×']
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 18)
except Exception: font = ImageFont.load_default()
LW = 170
sheet = Image.new('RGB', (LW + W * len(cols), 30 + H * len(rows)), (18, 20, 24))
d = ImageDraw.Draw(sheet)
for i, c in enumerate(cols): d.text((LW + i * W + 8, 6), c, fill=(230, 230, 230), font=font)
for r, (dev, wid, op) in enumerate(rows):
    y = 30 + r * H
    d.text((8, y + 8), wid, fill=(255, 200, 120), font=font); d.text((8, y + 32), op, fill=(200, 220, 255), font=font)
    ims = []
    if before:
        bf = os.path.join(before, f'{dev}-{wid}-{op}-100.png')
        if not os.path.exists(bf):
            cand = sorted(glob.glob(os.path.join(before, f'{dev}-{wid}-*-100.png')))
            bf = cand[0] if cand else None
        ims.append(Image.open(bf) if bf else None)
    for t in (0, 70, 100): ims.append(Image.open(os.path.join(after, f'{dev}-{wid}-{op}-{t}.png')))
    full = Image.open(os.path.join(after, f'{dev}-{wid}-{op}-100.png'))
    fw, fh = full.size; cw, ch = fw // 4, fh // 4
    ims.append(full.crop((fw // 2 - cw, fh // 2 - ch, fw // 2 + cw, fh // 2 + ch)))
    for i, im in enumerate(ims):
        if im is None: d.text((LW + i * W + 10, y + 120), '(yok)', fill=(150, 150, 150), font=font); continue
        sheet.paste(im.convert('RGB').resize((W, H)), (LW + i * W, y))
sheet.save(outp)
print(outp, len(rows), 'satır')
