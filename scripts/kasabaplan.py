# Kasaba kuşbakışı şema (PIL):  python3 scripts/kasabaplan.py plan.json şema.png "başlık"
# koyu: duvar / bina (> 2,6 m) · kahve: siper (1,2–2,6 m) · açık: alçak engel · soluk: üst kat / çatı · yeşil: yürünebilir (nav) · pembe: bina girişi · sarı halka: hedef
import json, sys
from PIL import Image, ImageDraw, ImageFont
d = json.load(open(sys.argv[1])); outp = sys.argv[2]; title = sys.argv[3] if len(sys.argv) > 3 else 'Kasaba'
B = d['bounds']; S = 9; PAD = 4; TOP = 34
W = int((B['maxX'] - B['minX'] + 2 * PAD) * S); H = int((B['maxZ'] - B['minZ'] + 2 * PAD) * S) + TOP
img = Image.new('RGB', (W, H), (223, 232, 210)); dr = ImageDraw.Draw(img, 'RGBA')
X = lambda x: (x - B['minX'] + PAD) * S
Y = lambda z: (z - B['minZ'] + PAD) * S + TOP
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 15); Fs = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 12)
except Exception: F = Fs = ImageFont.load_default()
nv = d['nav']; c = nv['cell']
for i in nv['walk']:
    gx, gz = i % nv['w'], i // nv['w']; x0 = nv['minX'] + gx * c; z0 = nv['minZ'] + gz * c
    dr.rectangle([X(x0), Y(z0), X(x0 + c), Y(z0 + c)], fill=(150, 200, 130, 90))
for r in d['roads']: dr.rectangle([X(r['x0']), Y(r['z0']), X(r['x1']), Y(r['z1'])], fill=(90, 92, 96, 80))
for (x0, z0, x1, z1, y0, y1, tag) in sorted(d['boxes'], key=lambda b: -b[4]):
    if y1 < 0.3: continue
    if y0 >= 1.0: col = (160, 150, 130, 50)
    elif tag == 'veh': col = (140, 90, 90, 210)
    elif y1 > 2.6: col = (58, 58, 58, 230)
    elif y1 > 1.2: col = (122, 106, 90, 220)
    else: col = (176, 168, 144, 220)
    dr.rectangle([X(x0), Y(z0), X(x1), Y(z1)], fill=col)
for t, col in (('blue', (43, 111, 214)), ('red', (214, 58, 43))):
    z = d['zones'][t]; dr.rectangle([X(z['minX']), Y(z['minZ']), X(z['maxX']), Y(z['maxZ'])], outline=col + (255,), width=3)
    for p in d['spawns'][t]: dr.ellipse([X(p['x']) - 4, Y(p['z']) - 4, X(p['x']) + 4, Y(p['z']) + 4], fill=col + (255,))
for (n, x, z) in d['entries']: dr.rectangle([X(x) - 4, Y(z) - 4, X(x) + 4, Y(z) + 4], fill=(224, 112, 192, 255))
for o in d['objectives']:
    r = o['r']; dr.ellipse([X(o['x'] - r), Y(o['z'] - r), X(o['x'] + r), Y(o['z'] + r)], outline=(224, 160, 32, 255), width=4)
    t = ('* ' if o.get('core') else '') + o['name']; dr.text((X(o['x']), Y(o['z'])), t, fill=(90, 60, 0, 255), font=F, anchor='mm', stroke_width=2, stroke_fill=(255, 255, 255, 255))
for cl in d.get('callouts', []): dr.text((X(cl['x']), Y(cl['z'])), cl['name'], fill=(20, 40, 60, 255), font=F if cl.get('major') else Fs, anchor='mm', stroke_width=2, stroke_fill=(255, 255, 255, 200))
for gx in range(int(B['minX']), int(B['maxX']) + 1, 8): dr.line([X(gx), TOP, X(gx), H], fill=(0, 0, 0, 22))
for gz in range(int(B['minZ']), int(B['maxZ']) + 1, 8): dr.line([0, Y(gz), W, Y(gz)], fill=(0, 0, 0, 22))
dr.text((10, 8), title + '  ·  koyu: bina/duvar (>2,6 m)  kahve: siper  açık: alçak  soluk: üst kat  yeşil: yürünebilir  pembe: giriş  sarı: hedef  (ızgara 8 m)', fill=(20, 20, 20), font=F)
img.save(outp); print('yazıldı', outp, img.size)
