# Askeri Üs kuşbakışı plan: python3 scripts/usplan.py <usqa.json> <çıktı.png> [başlık]
# Çarpışma kutuları yüksekliğe göre gri tonlu, doğuşlar (mavi / kırmızı), hedefler (sarı daire), üs bölgeleri, sorun noktaları (A kırmızı, C mor, D turuncu, E camgöbeği).
import json, sys
from PIL import Image, ImageDraw, ImageFont
d = json.load(open(sys.argv[1])); out = sys.argv[2]; title = sys.argv[3] if len(sys.argv) > 3 else d['map']
B = d['bounds']; S = 7; pad = 30
W = int((B['maxX'] - B['minX'] + 8) * S) + pad * 2; H = int((B['maxZ'] - B['minZ'] + 8) * S) + pad * 2 + 40
X = lambda x: pad + (x - B['minX'] + 4) * S
Z = lambda z: pad + 40 + (z - B['minZ'] + 4) * S
im = Image.new('RGB', (W, H), (232, 230, 224)); g = ImageDraw.Draw(im)
try: f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 15); f2 = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
except Exception: f = f2 = ImageFont.load_default()
for t, col in (('blue', (190, 205, 235)), ('red', (240, 200, 195))):
  z = (d.get('baseZones') or {}).get(t)
  if z: g.rectangle([X(z['minX']), Z(z['minZ']), X(z['maxX']), Z(z['maxZ'])], fill=col)
cols = sorted(d['cols'], key=lambda c: c[4])
for c in cols:
  h = c[4]
  if h < 0.05: continue
  v = int(max(30, 200 - min(h, 12) * 14))
  g.rectangle([X(c[0]), Z(c[2]), X(c[3]), Z(c[5])], fill=(v, v, v + 6), outline=(max(0, v - 40),) * 3)
for o in d.get('objectives') or []:
  r = o['r'] * S
  g.ellipse([X(o['x']) - r, Z(o['z']) - r, X(o['x']) + r, Z(o['z']) + r], outline=(225, 170, 0), width=3)
  g.text((X(o['x']) + 4, Z(o['z']) - 8), o.get('label') or o['name'][0], fill=(160, 110, 0), font=f2)
for t, col in (('blue', (30, 90, 220)), ('red', (210, 50, 40))):
  for s in d['spawns'][t]: g.ellipse([X(s['x']) - 3, Z(s['z']) - 3, X(s['x']) + 3, Z(s['z']) + 3], fill=col)
for k, col in (('A', (230, 0, 0)), ('C', (150, 0, 200)), ('D', (255, 130, 0)), ('E', (0, 190, 210))):
  for p in d['ex'].get(k, []): x, z = p[0], p[2]; g.rectangle([X(x) - 4, Z(z) - 4, X(x) + 4, Z(z) + 4], outline=col, width=2)
for k in d['ex'].get('stuck', []):
  x, z = map(float, k[0].split(',')); g.text((X(x), Z(z)), 'x' + str(k[1]), fill=(200, 0, 120), font=f)
R = d['R']
g.text((pad, 8), f"{title}   iç içe {R.get('A')} · z-fight {R.get('B')} · görünmez çarpışma {R.get('C')} · içinden geçilen {R.get('D')} · havada {R.get('E')} · doğuş görüşü {R.get('H')}", fill=(20, 20, 20), font=f2)
im.save(out)
print(out, im.size)
