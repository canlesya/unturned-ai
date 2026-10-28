# 12.217 kontak tabaka: klasörlerdeki karelerden ızgara (her klasörden baş / orta / son) ya da tek tek görüntüler.
#   python3 scripts/cinesheet.py OUT.jpg COLS W klasör1 [klasör2 | kare.jpg ...]
import sys, os
from PIL import Image, ImageDraw, ImageFont
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
items = []
for d in sys.argv[4:]:
    if os.path.isdir(d):
        fs = sorted(f for f in os.listdir(d) if f.endswith('.jpg') or f.endswith('.png'))
        if not fs: continue
        for i in (0, len(fs) // 2, len(fs) - 1): items.append((os.path.join(d, fs[i]), os.path.basename(d.rstrip('/')) + ' ' + fs[i]))
    else: items.append((d, os.path.basename(d)))
h = w * 9 // 16
rows = (len(items) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 22)), (12, 14, 18))
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf', 16)
except Exception: font = None
dr = ImageDraw.Draw(sheet)
for k, (p, lab) in enumerate(items):
    im = Image.open(p).convert('RGB').resize((w, h), Image.LANCZOS)
    x, y = (k % cols) * w, (k // cols) * (h + 22)
    sheet.paste(im, (x, y + 22)); dr.text((x + 6, y + 3), lab, fill=(255, 179, 71), font=font)
sheet.save(out, quality=88)
print(out, len(items))
