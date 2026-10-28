# 12.210 silah değiştirme önce / sonra grafiği (PIL; matplotlib gerekmez)
#   python3 scripts/swapplot.py once.json sonra.json çıktı.png "başlık"
# Üst panel: değişim başına iş (vm.setItem + ilk 4 karede silah sahnesi çiziminin boşta çizime göre fazlası), alt panel: olaydan sonraki 450 ms'deki en uzun kare.
import json, sys
from PIL import Image, ImageDraw, ImageFont

a, b, out = sys.argv[1], sys.argv[2], sys.argv[3]
title = sys.argv[4] if len(sys.argv) > 4 else ''

def load(p):
    r = json.load(open(p))
    idle = r['rows'][0]['sum4'].get('render.other', 0)
    ev = []
    for x in r['rows'][1:]:
        if x['from'] == x['id']:
            continue
        s = x['sum4']
        work = s.get('vm.setItem', 0) + max(0, s.get('render.other', 0) - idle)
        ev.append((x['label'], work, x['max']))
    return ev

A, B = load(a), load(b)
n = max(len(A), len(B))
W, H, PAD, PH = 1500, 760, 70, 290
img = Image.new('RGB', (W, H), '#ffffff')
d = ImageDraw.Draw(img)
try:
    f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 15)
    fb = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 18)
except Exception:
    f = fb = ImageFont.load_default()
C_A, C_B, GRID = '#d1495b', '#2e86ab', '#e4e4e4'
d.text((PAD, 14), title, fill='#222', font=fb)
d.rectangle([W - 330, 16, W - 316, 30], fill=C_A); d.text((W - 310, 14), 'önce', fill='#222', font=f)
d.rectangle([W - 240, 16, W - 226, 30], fill=C_B); d.text((W - 220, 14), 'sonra (12.210)', fill='#222', font=f)

def panel(y0, idx, label, vmax, lines):
    x0, x1, y1 = PAD, W - 30, y0 + PH
    for v in range(0, int(vmax) + 1, 10 if vmax <= 80 else 20):
        y = y1 - (y1 - y0) * v / vmax
        d.line([x0, y, x1, y], fill=GRID)
        d.text((x0 - 40, y - 8), f'{v}', fill='#666', font=f)
    for v, c in lines:
        y = y1 - (y1 - y0) * v / vmax
        d.line([x0, y, x1, y], fill=c, width=1)
    d.text((x0, y0 - 24), label, fill='#222', font=f)
    bw = (x1 - x0) / n
    for i in range(n):
        for k, (S, col) in enumerate(((A, C_A), (B, C_B))):
            if i >= len(S):
                continue
            v = min(vmax, S[i][idx])
            xa = x0 + i * bw + k * bw * 0.45 + 1
            d.rectangle([xa, y1 - (y1 - y0) * v / vmax, xa + bw * 0.42, y1], fill=col)
    # olay grupları (etiket değişimi)
    prev = None
    for i, e in enumerate(A):
        g = ' '.join(e[0].split(' ')[:2])
        if g != prev:
            x = x0 + i * bw
            d.line([x, y0, x, y1], fill='#999')
            d.text((x + 3, y1 + 4), g.replace('slot', '1-4').replace(' K', ' J/K').replace(' J', ' J/K'), fill='#444', font=f)
            prev = g
    d.line([x0, y1, x1, y1], fill='#333')

vw = max(20, max([e[1] for e in A + B] + [0]) * 1.1)
panel(80, 1, 'değişim başına ana iş parçacığı işi (ms): vm.setItem + ilk çizimdeki fazla', min(vw, 60), [])
vf = max(40, max([e[2] for e in A + B] + [0]) * 1.1)
panel(80 + PH + 70, 2, 'değişimden sonraki 450 ms içindeki en uzun kare (ms) · kesikli çizgi: 25 ms hedefi, 16,7 ms (60 Hz)', min(vf, 90), [(25, '#f0a000'), (16.7, '#bbbbbb')])
img.save(out)
print(out)
