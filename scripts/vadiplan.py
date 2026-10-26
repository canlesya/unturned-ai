# Vadi plan görüntüsü (12.169): python3 scripts/vadiplan.py [plan.json] [out.png] [ölçek=4]
import json, sys
import numpy as np
from PIL import Image, ImageDraw
src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/wb-vadi/plan.json'
dst = sys.argv[2] if len(sys.argv) > 2 else '/tmp/wb-vadi/plan.png'
K = int(sys.argv[3]) if len(sys.argv) > 3 else 4
d = json.load(open(src))
nx, nz, S = d['nx'], d['nz'], d['S']
h = np.array(d['h'], dtype=np.float32).reshape(nz, nx)
gx = np.gradient(h, axis=1) / S
gz = np.gradient(h, axis=0) / S
shade = np.clip(0.8 - (gx * 0.6 + gz * 0.4) * 0.7, 0.3, 1.25)
slope = np.hypot(gx, gz)
t = np.clip(h / 20.0, 0, 1)[..., None]
base = (1 - t) * np.array([120, 160, 80], np.float32) + t * np.array([160, 150, 120], np.float32)
base[slope > 0.95] = [125, 118, 112]
base = base * shade[..., None]
# kontur 1 m
cont = (np.floor(h) != np.floor(np.roll(h, 1, axis=1))) | (np.floor(h) != np.floor(np.roll(h, 1, axis=0)))
base[cont] *= 0.82
base[h < d['water']] = [60, 110, 150]
img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).resize((int(nx * K * S), int(nz * K * S)), Image.NEAREST)
dr = ImageDraw.Draw(img)
f = K
P = lambda x, z: ((x - d['X0']) * f, (z - d['Z0']) * f)
for tr in d['trails']:
    dr.line([P(x, z) for x, z in tr['p']], fill=(215, 180, 120), width=max(1, int(tr['w'] * f * 0.3)))
for p in d['pads']:
    dr.rectangle([P(p['x0'], p['z0']), P(p['x1'], p['z1'])], outline=(255, 255, 255))
    dr.text(P(p['x0'] + 0.3, p['z0'] + 0.3), '%s %.2f' % (p['name'], p['y']), fill=(255, 255, 255))
for c in d['cols']:
    col = (255, 80, 40) if c[4] == '' else (40, 220, 255) if c[4] == 'deck' else (255, 220, 0)
    dr.rectangle([P(c[0], c[1]), P(c[2], c[3])], outline=col)
b = d['bounds']
dr.rectangle([P(b['minX'], b['minZ']), P(b['maxX'], b['maxZ'])], outline=(255, 0, 255))
if d['spawns']:
    for team, col in (('blue', (40, 90, 255)), ('red', (255, 40, 40))):
        for s in d['spawns'][team]:
            x, y = P(s['x'], s['z'])
            dr.ellipse([x - 3, y - 3, x + 3, y + 3], fill=col)
for o in d['obj']:
    x, y = P(o['x'], o['z'])
    r = o['r'] * f
    dr.ellipse([x - r, y - r, x + r, y + r], outline=(255, 255, 0))
    dr.text((x + 3, y + 3), o['name'], fill=(255, 255, 0))
for c in d.get('callouts', []):
    x, y = P(c['x'], c['z'])
    dr.text((x, y), c['name'], fill=(255, 255, 255) if c.get('major') else (220, 220, 220))
img.save(dst)
print('kaydedildi', dst, img.size)
