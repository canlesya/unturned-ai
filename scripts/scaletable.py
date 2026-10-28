#!/usr/bin/env python3
# 12.203 Ölçüm tablosu PNG'si (PIL): scaleperf.mjs (tarayıcı FPS) + scalebench.mjs (sunucu adımı / dağılım) JSON'larından.
#   python3 scripts/scaletable.py çıktı.png başlık "satır1 hücre|hücre|…" "satır2 …" …   (ilk satır başlık satırı)
import sys
from PIL import Image, ImageDraw, ImageFont
def font(sz, bold=False):
    for p in (['/System/Library/Fonts/Supplemental/Arial Bold.ttf'] if bold else []) + ['/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf']:
        try: return ImageFont.truetype(p, sz)
        except Exception: pass
    return ImageFont.load_default()
out, title, rows = sys.argv[1], sys.argv[2], [r.split('|') for r in sys.argv[3:]]
F, FB, FT = font(15), font(15, True), font(20, True)
ncol = max(len(r) for r in rows)
w = [0] * ncol
d0 = ImageDraw.Draw(Image.new('RGB', (10, 10)))
for r in rows:
    for i, c in enumerate(r): w[i] = max(w[i], int(d0.textlength(c, font=FB)) + 24)
W, RH = sum(w) + 24, 28
im = Image.new('RGB', (W, 56 + RH * len(rows) + 12), (14, 17, 26)); d = ImageDraw.Draw(im)
d.text((12, 14), title, fill=(240, 240, 240), font=FT)
y = 52
for k, r in enumerate(rows):
    if k == 0: d.rectangle([8, y - 2, W - 8, y + RH - 4], fill=(40, 46, 64))
    elif k % 2 == 0: d.rectangle([8, y - 2, W - 8, y + RH - 4], fill=(22, 26, 38))
    x = 12
    for i, c in enumerate(r):
        d.text((x, y + 3), c, fill=(255, 210, 120) if k == 0 else (225, 225, 225), font=FB if k == 0 or i == 0 else F); x += w[i]
    y += RH
im.save(out); print(out, im.size)
