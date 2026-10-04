# radar kırpması + 10 m ızgara etiketleri (dünya metresi). python tools/zoomgrid.py x0 z0 x1 z1 çıktı.png [ölçek]
import sys, numpy as np
from PIL import Image, ImageDraw
S = 0.143
x0, z0, x1, z1 = map(float, sys.argv[1:5]); out = sys.argv[5]; k = int(sys.argv[6]) if len(sys.argv) > 6 else 5
im = Image.open('tools_ref/dust2_radar_ref.png').convert('RGBA').crop((54, 14, 974, 1005))
bg = Image.new('RGBA', im.size, (12, 14, 19, 255)); bg.alpha_composite(im)
W, H = im.size
u0, u1 = int(x0 / S + W / 2), int(x1 / S + W / 2); v0, v1 = int(z0 / S + H / 2), int(z1 / S + H / 2)
c = bg.crop((u0, v0, u1, v1)).convert('RGB').resize(((u1 - u0) * k, (v1 - v0) * k), Image.NEAREST)
d = ImageDraw.Draw(c)
import math
for xx in range(int(math.ceil(x0 / 10) * 10), int(x1) + 1, 10):
    px = (xx / S + W / 2 - u0) * k; d.line([(px, 0), (px, c.height)], fill=(255, 255, 0), width=1); d.text((px + 3, 3), f'x{xx}', fill=(255, 255, 0))
for zz in range(int(math.ceil(z0 / 10) * 10), int(z1) + 1, 10):
    py = (zz / S + H / 2 - v0) * k; d.line([(0, py), (c.width, py)], fill=(0, 255, 255), width=1); d.text((3, py + 3), f'z{zz}', fill=(0, 255, 255))
c.save(out); print(c.size)
