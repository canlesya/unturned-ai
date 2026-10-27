# Kuzey Vadisi doluluk haritası çizimi (12.182): python3 scripts/kuzeydens.py dens.json dens.png
# Arazi (gölgeli), su (< 0,5 m), yollar, görüş küreleri (koyu yeşil ağaç tepesi · açık yeşil çalı · sarı buğday), yapı kutuları (kırmızı > 2 m, turuncu alçak), bayraklar, 100 m ızgara.
import json, sys
import numpy as np
from PIL import Image, ImageDraw
D = json.load(open(sys.argv[1])); N, S = D['N'], D['S']
h = np.array(D['h'], dtype=np.float32).reshape(N, N)
gz, gx = np.gradient(h)
shade = np.clip(0.8 + (gx - gz) * 0.1, 0.45, 1.15)
base = np.zeros((N, N, 3), np.float32); base[:] = (120, 150, 95)
base[h < 0.5] = (60, 90, 130)
img = Image.fromarray(np.clip(base * shade[..., None], 0, 255).astype(np.uint8)).resize((1600, 1600))
d = ImageDraw.Draw(img)
W = lambda x: x + 800
for r in D['roads']:
    p = [(W(a[0]), W(a[1])) for a in r['pts']]
    d.line(p, fill=(70, 70, 74) if r['t'] != 'dirt' else (140, 110, 80), width=max(2, int(r['w'])))
for x, z, rr in D['sight']:
    c = (30, 70, 30) if rr > 2.2 else (70, 115, 45) if rr > 1.2 else (200, 180, 90)
    d.ellipse([W(x) - rr, W(z) - rr, W(x) + rr, W(z) + rr], fill=c)
for x0, z0, x1, z1, hh in D['cols']:
    if hh < 0.6: continue
    d.rectangle([W(x0), W(z0), W(x1), W(z1)], fill=(200, 60, 60) if hh > 2 else (235, 150, 60))
for f in D['flags']:
    d.ellipse([W(f['x']) - f['r'], W(f['z']) - f['r'], W(f['x']) + f['r'], W(f['z']) + f['r']], outline=(255, 255, 255), width=2)
    d.text((W(f['x']) + f['r'] + 3, W(f['z']) - 8), f['id'], fill=(255, 255, 255))
for k in range(-800, 801, 100):
    d.line([(W(k), 0), (W(k), 1600)], fill=(0, 0, 0), width=1); d.line([(0, W(k)), (1600, W(k))], fill=(0, 0, 0), width=1)
    d.text((W(k) + 2, 2), str(k), fill=(255, 255, 0)); d.text((2, W(k) + 2), str(k), fill=(255, 255, 0))
img.save(sys.argv[2]); print(sys.argv[2])
