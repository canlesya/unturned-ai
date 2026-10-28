# 12.210 önce / sonra el-silah görüntüleri piksel farkı + yan yana tablo
#   python3 scripts/swapdiff.py <önce klasörü> <sonra klasörü> <tablo.png>
import os, sys
from PIL import Image, ImageChops, ImageDraw

a, b, out = sys.argv[1], sys.argv[2], sys.argv[3]
names = sorted(n for n in os.listdir(a) if n.endswith('.png') and os.path.exists(os.path.join(b, n)))
rows = []
for n in names:
    A = Image.open(os.path.join(a, n)).convert('RGB'); B = Image.open(os.path.join(b, n)).convert('RGB')
    d = ImageChops.difference(A, B).convert('L')
    px = sum(1 for v in d.getdata() if v > 24)
    tot = A.size[0] * A.size[1]
    rows.append((n, px / tot * 100, A, B))
    print(f'{n:34s} farklı piksel (>24/255): {px / tot * 100:6.3f} %')
# yan yana küçük tablo (her satır: önce | sonra)
tw = 520
cells = []
for n, pct, A, B in rows:
    h = int(A.size[1] * tw / A.size[0])
    cells.append((n, pct, A.resize((tw, h)), B.resize((tw, h)), h))
H = sum(c[4] + 24 for c in cells)
img = Image.new('RGB', (tw * 2 + 10, H), 'white')
dr = ImageDraw.Draw(img)
y = 0
for n, pct, A, B, h in cells:
    dr.text((4, y + 4), f'{n}   önce | sonra   fark {pct:.3f} %', fill='black')
    img.paste(A, (0, y + 22)); img.paste(B, (tw + 10, y + 22))
    y += h + 24
img.save(out)
print(out)
