# 12.186 artı önce / sonra ızgarası:  python3 scripts/crosshairsheet.py <kök klasör> [dev=desk] [silah,silah,...]
#   <kök>/once/<dev>/ ve <kök>/sonra/<dev>/ (scripts/crosshair.mjs çıktısı) → <kök>/<dev>-izgara.jpg (ya da silah listesiyle <kök>/<dev>-secme.jpg)
#   Satır = silah, sütun = durum (dur / yürü / çömel / ateş / koş), her hücrede ÖNCE | SONRA; hücre = ekran ortasından ölçeklenmemiş kırpıntı.
import sys, os, json
from PIL import Image, ImageDraw, ImageFont
root = sys.argv[1]; dev = sys.argv[2] if len(sys.argv) > 2 else 'desk'
pick = sys.argv[3].split(',') if len(sys.argv) > 3 else None
ST = [('dur', 'dur'), ('yuru', 'yürü'), ('comel', 'çömel'), ('ates', 'ateş'), ('kos', 'koş')]
C = 120 if dev == 'desk' else 96
J = {k: json.load(open(f'{root}/{k}/{dev}.json'))['res'] for k in ('once', 'sonra')}
ids = pick or sorted(J['once'].keys(), key=lambda i: -J['once'][i]['yuru']['gap'])
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 13); f2 = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 11)
except Exception: F = f2 = ImageFont.load_default()
LW, HH = 92, 40
W = LW + len(ST) * (2 * C + 8); H = HH + len(ids) * (C + 4)
sheet = Image.new('RGB', (W, H), (18, 20, 24)); d = ImageDraw.Draw(sheet)
for j, (k, lab) in enumerate(ST):
    x = LW + j * (2 * C + 8)
    d.text((x + C - 20, 4), lab, fill=(255, 200, 120), font=F)
    d.text((x + 4, 22), 'önce', fill=(200, 200, 200), font=f2); d.text((x + C + 4, 22), 'sonra', fill=(140, 230, 140), font=f2)
for i, wid in enumerate(ids):
    y = HH + i * (C + 4)
    d.text((6, y + C // 2 - 8), wid, fill=(255, 255, 255), font=F)
    for j, (k, _) in enumerate(ST):
        x = LW + j * (2 * C + 8)
        for n, ver in enumerate(('once', 'sonra')):
            p = f'{root}/{ver}/{dev}/{wid}-{k}.png'
            if not os.path.exists(p): continue
            im = Image.open(p).convert('RGB'); w, h = im.size
            im = im.crop(((w - C) // 2, (h - C) // 2, (w + C) // 2, (h + C) // 2))
            sheet.paste(im, (x + n * C, y))
            g = J[ver].get(wid, {}).get(k)
            if g: d.text((x + n * C + 3, y + C - 14), f"{g['gap']:.0f}px" if g['shown'] else '—', fill=(255, 255, 80), font=f2)
out = f"{root}/{dev}-{'secme' if pick else 'izgara'}.jpg"
sheet.save(out, quality=88); print(out, sheet.size)
