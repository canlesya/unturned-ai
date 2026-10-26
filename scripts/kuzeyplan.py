# Kuzey Vadisi (12.172) kuşbakışı yerleşim planı (PIL): python3 scripts/kuzeyplan.py plan.json plan.png
# Arazi (yüzey rengi + tepe gölgesi + 10 m eş yükselti), su, yollar (tür), köprü / baraj / geçit, yapı izleri, piyade bölgeleri, bayraklar (yarıçap),
# üsler + doğuşlar, heliped + araç doğuşları, TDM alt alanı, enerji hattı; sağda lejant + mesafe tablosu + ölçek.
import json, math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

D = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
N, S = D['N'], D['S']
PX = 1.25                      # piksel / m
MW = int(1600 * PX)            # harita karesi
LW = 600                       # lejant
img = Image.new('RGB', (MW + LW, MW), (24, 26, 28))
F = '/System/Library/Fonts/Supplemental/'
def font(sz, bold=False): return ImageFont.truetype(F + ('Arial Bold.ttf' if bold else 'Arial.ttf'), sz)
def W(x): return (x + 800) * PX
def Z(z): return (z + 800) * PX

h = np.array(D['h'], dtype=np.float32).reshape(N, N)
sf = np.array(D['sf'], dtype=np.uint8).reshape(N, N)
PAL = {0: (110, 128, 68), 1: (74, 86, 48), 2: (176, 156, 92), 3: (120, 98, 70), 4: (140, 118, 82), 5: (80, 80, 82), 6: (138, 132, 118), 7: (124, 120, 110), 8: (150, 138, 108), 9: (60, 86, 104), 10: (230, 234, 240), 11: (140, 138, 132), 12: (128, 140, 74)}
col = np.zeros((N, N, 3), dtype=np.float32)
for k, c in PAL.items(): col[sf == k] = c
# tepe gölgesi (kuzeybatıdan)
gx = np.gradient(h, axis=1) / S; gz = np.gradient(h, axis=0) / S
nx, ny, nz = -gx, np.ones_like(h), -gz; L = np.sqrt(nx * nx + ny * ny + nz * nz)
sh = (nx * -0.55 + ny * 0.7 + nz * -0.45) / L
shade = np.clip(0.55 + 0.75 * sh, 0.45, 1.25)
col *= shade[..., None]
water = h < -0.25
col[water] = (54, 92, 118)
base = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).resize((MW, MW), Image.BILINEAR)
# eş yükselti (10 m): yüksekliği büyütüp sınır pikselleri
hu = np.array(Image.fromarray(h).resize((MW, MW), Image.BILINEAR))
q = np.floor(hu / 10)
edge = (q != np.roll(q, 1, 0)) | (q != np.roll(q, 1, 1))
arr = np.array(base).astype(np.float32)
arr[edge & (hu > 1)] *= 0.78
q5 = np.floor(hu / 50); e5 = (q5 != np.roll(q5, 1, 0)) | (q5 != np.roll(q5, 1, 1))
arr[e5 & (hu > 1)] *= 0.6
img.paste(Image.fromarray(arr.astype(np.uint8)), (0, 0))
d = ImageDraw.Draw(img, 'RGBA')

# göl (barajın doğusu): oynanır alanda kanyon içi
for (a, b) in zip(D['lake'][:-1], D['lake'][1:]):
    d.line([(W(a[0]), Z(a[1])), (W(b[0]), Z(b[1]))], fill=(54, 92, 118, 255), width=int(2 * a[2] * PX * 0.6))
# tarlalar (çerçeve)
for f in D['fields']:
    x, z, w, dd, t = f
    d.rectangle([W(x - w / 2), Z(z - dd / 2), W(x + w / 2), Z(z + dd / 2)], outline=(60, 50, 30, 120), width=1)
# yapı izleri
for b in D['big']:
    d.rectangle([W(b[0]), Z(b[1]), W(b[2]), Z(b[3])], fill=(52, 50, 48, 235))
# yollar
RC = {'hw': ((235, 220, 170, 255), 9), 'rd': ((242, 236, 220, 255), 6.5), 'dirt': ((176, 132, 84, 255), 4.5)}
for r in D['roads']:
    c, w = RC[r['t']]
    pts = [(W(p[0]), Z(p[1])) for p in r['pts']]
    d.line(pts, fill=(30, 30, 30, 200), width=max(3, int(w * PX) + 3))
    d.line(pts, fill=c, width=max(2, int(w * PX)))
# enerji hattı
for (x0, z0, x1, z1) in D['wires'][::2]:
    d.line([(W(x0), Z(z0)), (W(x1), Z(z1))], fill=(20, 20, 20, 160), width=1)
# köprüler / baraj / geçitler
fb = font(15, True); fs = font(13); fl = font(30, True); fm = font(17, True)
def tag(x, z, txt, col=(255, 255, 255), f=fs, dx=0, dy=0):
    tw = d.textlength(txt, font=f)
    d.rectangle([W(x) + dx - 3, Z(z) + dy - 2, W(x) + dx + tw + 3, Z(z) + dy + f.size + 3], fill=(16, 18, 20, 190))
    d.text((W(x) + dx, Z(z) + dy), txt, font=f, fill=col)
for b in D['bridges']:
    d.rectangle([W(b['x'] - b['w'] / 2), Z(b['z'] - 40), W(b['x'] + b['w'] / 2), Z(b['z'] + 40)], fill=(150, 150, 150, 255), outline=(20, 20, 20, 255))
    tag(b['x'], b['z'], b['name'] + ' (köprü)', (230, 230, 230), fs, 14, -8)
dm = D['dam']
d.rectangle([W(dm['x'] - 6), Z(dm['z'] - 40), W(dm['x'] + 6), Z(dm['z'] + 40)], fill=(180, 180, 175, 255), outline=(20, 20, 20, 255))
tag(dm['x'], dm['z'] + 40, 'Baraj tepesi 24 m (araç geçer)', (230, 230, 230), fs, -120, 6)
for f in D['fords']:
    d.ellipse([W(f['x'] - f['r']), Z(f['z'] - f['r']), W(f['x'] + f['r']), Z(f['z'] + f['r'])], outline=(120, 210, 255, 255), width=3)
    tag(f['x'], f['z'], 'sığ geçit', (150, 220, 255), fs, 18, -6)
# piyade bölgeleri (araç giremez: dar sokak / bina içi)
INF = [('Köy sokakları', -230, 250, 115), ('Fabrika halleri', 250, -320, 95), ('Kereste kampı / orman', -380, -450, 80), ('Radar tepesi', -560, 120, 50)]
for name, x, z, r in INF:
    n = 64
    for k in range(n):
        if k % 2: continue
        a0, a1 = k / n * 2 * math.pi, (k + 1) / n * 2 * math.pi
        d.line([(W(x + math.cos(a0) * r), Z(z + math.sin(a0) * r)), (W(x + math.cos(a1) * r), Z(z + math.sin(a1) * r))], fill=(255, 196, 60, 230), width=3)
# TDM alt alanı
t = D['tdm']['bounds']
for k in range(0, 400, 16):
    for (a, b) in [((t['minX'] + k * (t['maxX'] - t['minX']) / 400, t['minZ']), (t['minX'] + (k + 8) * (t['maxX'] - t['minX']) / 400, t['minZ'])),
                   ((t['minX'] + k * (t['maxX'] - t['minX']) / 400, t['maxZ']), (t['minX'] + (k + 8) * (t['maxX'] - t['minX']) / 400, t['maxZ'])),
                   ((t['minX'], t['minZ'] + k * (t['maxZ'] - t['minZ']) / 400), (t['minX'], t['minZ'] + (k + 8) * (t['maxZ'] - t['minZ']) / 400)),
                   ((t['maxX'], t['minZ'] + k * (t['maxZ'] - t['minZ']) / 400), (t['maxX'], t['minZ'] + (k + 8) * (t['maxZ'] - t['minZ']) / 400))]:
        d.line([(W(a[0]), Z(a[1])), (W(b[0]), Z(b[1]))], fill=(255, 255, 255, 220), width=2)
tag(t['minX'], t['minZ'], 'TDM alt alanı (köy)', (255, 255, 255), fs, 4, -20)
for tm, cc in (('blue', (80, 150, 255)), ('red', (255, 90, 80))):
    p = D['tdm'][tm]; d.ellipse([W(p['x']) - 7, Z(p['z']) - 7, W(p['x']) + 7, Z(p['z']) + 7], outline=cc + (255,), width=3)
# üsler + doğuşlar
TC = {'blue': (64, 132, 255), 'red': (240, 70, 60)}
for team, pad in (('blue', 'BHQ'), ('red', 'RHQ')):
    p = next(q for q in D['pads'] if q['id'] == pad)
    d.rectangle([W(p['x'] - p['w'] / 2), Z(p['z'] - p['d'] / 2), W(p['x'] + p['w'] / 2), Z(p['z'] + p['d'] / 2)], outline=TC[team] + (255,), width=4, fill=TC[team] + (40,))
    for s in D['spawns'][team]: d.ellipse([W(s['x']) - 2.5, Z(s['z']) - 2.5, W(s['x']) + 2.5, Z(s['z']) + 2.5], fill=TC[team] + (255,))
    tag(p['x'] - p['w'] / 2, p['z'] + (p['d'] / 2 - 26 if team == 'blue' else -p['d'] / 2 + 6), ('MAVİ ÜS' if team == 'blue' else 'KIRMIZI ÜS') + ' · doğuş + araç parkı + 2 heliped', TC[team], fb)
# heliped + araçlar
for hp in D['helipads']:
    c = TC.get(hp['team'], (240, 200, 60))
    d.ellipse([W(hp['x'] - hp['r']), Z(hp['z'] - hp['r']), W(hp['x'] + hp['r']), Z(hp['z'] + hp['r'])], outline=c + (255,), width=3, fill=(30, 30, 30, 200))
    tw = d.textlength('H', font=fm); d.text((W(hp['x']) - tw / 2, Z(hp['z']) - 10), 'H', font=fm, fill=(255, 255, 255))
VI = {'tank': 'T', 'zpt': 'Z', 'jip': 'J', 'kamyon': 'K', 'bot': 'B'}
for v in D['vehicles']:
    if v['type'].startswith('heli'): continue
    tm = v['team'] or ''; c = TC.get(tm, (240, 200, 60)) if not tm.startswith('flag') else (240, 200, 60)
    x, z = W(v['x']), Z(v['z'])
    d.rectangle([x - 6, z - 6, x + 6, z + 6], fill=(20, 20, 20, 230), outline=c + (255,), width=2)
    tw = d.textlength(VI.get(v['type'], '?'), font=font(10, True)); d.text((x - tw / 2, z - 6), VI.get(v['type'], '?'), font=font(10, True), fill=(255, 255, 255))
# bayraklar
for f in D['flags']:
    x, z, r = W(f['x']), Z(f['z']), f['r'] * PX
    d.ellipse([x - r, z - r, x + r, z + r], outline=(255, 255, 255, 255), width=3, fill=(255, 255, 255, 50))
    d.ellipse([x - 19, z - 19, x + 19, z + 19], fill=(20, 22, 24, 235), outline=(255, 255, 255, 255), width=3)
    tw = d.textlength(f['id'], font=fl); d.text((x - tw / 2, z - 17), f['id'], font=fl, fill=(255, 224, 90))
    tag(f['x'], f['z'], f['name'] + (' · çekirdek' if f.get('core') else ''), (255, 236, 170), fb, 24, 6)
# kuzey oku + ölçek
d.polygon([(MW - 60, 30), (MW - 72, 64), (MW - 60, 56), (MW - 48, 64)], fill=(255, 255, 255))
d.text((MW - 66, 66), 'K', font=fb, fill=(255, 255, 255))
d.rectangle([30, MW - 40, 30 + 200 * PX, MW - 32], fill=(255, 255, 255)); d.rectangle([30 + 100 * PX, MW - 40, 30 + 200 * PX, MW - 32], fill=(40, 40, 40), outline=(255, 255, 255))
d.text((30, MW - 62), '0          100        200 m', font=fs, fill=(255, 255, 255))

# lejant (harita dışına taşan göl çizgisi lejantın altında kalsın)
d.rectangle([MW, 0, MW + LW, MW], fill=(24, 26, 28, 255))
x0 = MW + 26; y = 22
d.text((x0, y), 'KUZEY VADİSİ', font=font(34, True), fill=(255, 255, 255)); y += 44
d.text((x0, y), 'Aşama 1 taslak · 1600 × 1600 m oynanır · 5 km manzara', font=font(15), fill=(200, 200, 200)); y += 32
st = D['stats']
lines = [
    ('Mod', 'Ele Geçirme 7 bayrak (3 çekirdek) · TDM: köy alt alanı'),
    ('Kalabalık', '16v16 – 32v32 · ileride araç: tank / ZPT / jip / helikopter'),
    ('Nehir', 'derin (yürünmez); geçiş: 2 köprü + baraj + 2 sığ geçit'),
    ('Kurulum', f"sunucu ~0,35 sn · {st['colliders']:,} kutu · {st['treesIn']:,} ağaç".replace(',', '.')),
]
for k, v in lines:
    d.text((x0, y), k, font=fb, fill=(255, 224, 90)); d.text((x0 + 100, y), v, font=fs, fill=(230, 230, 230)); y += 24
y += 14
LEG = [
    ('yol', (235, 220, 170), 'Ana yol 9 m (asfalt, tank / kamyon)'), ('yol', (242, 236, 220), 'Köy / bağlantı yolu 6,5 m'), ('yol', (176, 132, 84), 'Toprak yol 4,5 m (geçitlere iner)'),
    ('kutu', (52, 50, 48), 'Yapı izi (≥ 2 m yüksek kutu)'), ('halka', (255, 196, 60), 'Piyade bölgesi: dar sokak / bina içi (araç giremez)'),
    ('bayrak', (255, 255, 255), 'Bayrak + ele geçirme yarıçapı'), ('nokta', (64, 132, 255), 'Mavi doğuş (32 nokta)'), ('nokta', (240, 70, 60), 'Kırmızı doğuş (32 nokta)'),
    ('H', (240, 200, 60), 'Helikopter pisti (üs: takım rengi, tarafsız: sarı)'), ('arac', (240, 200, 60), 'Araç doğuşu T tank · Z ZPT · J jip · K kamyon · B bot'),
    ('halka2', (120, 210, 255), 'Sığ geçit (araç / piyade, derin suya girilmez)'), ('tdm', (255, 255, 255), 'Takım Çatışması alt alanı'),
]
for kind, c, txt in LEG:
    if kind == 'yol': d.line([(x0, y + 9), (x0 + 40, y + 9)], fill=c, width=7)
    elif kind == 'kutu': d.rectangle([x0 + 8, y + 1, x0 + 32, y + 17], fill=c)
    elif kind in ('halka', 'halka2'): d.ellipse([x0 + 10, y, x0 + 30, y + 20], outline=c, width=3)
    elif kind == 'bayrak': d.ellipse([x0 + 8, y, x0 + 30, y + 20], outline=c, width=3)
    elif kind == 'nokta': d.ellipse([x0 + 15, y + 6, x0 + 23, y + 14], fill=c)
    elif kind == 'H': d.ellipse([x0 + 8, y - 1, x0 + 30, y + 21], outline=c, width=3); d.text((x0 + 13, y), 'H', font=fb, fill=(255, 255, 255))
    elif kind == 'arac': d.rectangle([x0 + 12, y + 3, x0 + 26, y + 17], outline=c, width=2)
    elif kind == 'tdm':
        for k in range(0, 40, 10): d.line([(x0 + k, y + 9), (x0 + k + 5, y + 9)], fill=c, width=2)
    d.text((x0 + 52, y + 1), txt, font=fs, fill=(230, 230, 230)); y += 27
y += 14
d.text((x0, y), 'Üsten bayrağa yol uzunluğu (A*, m)', font=fb, fill=(255, 224, 90)); y += 26
P = st.get('paths') or {}
for f in D['flags']:
    hb = math.hypot(f['x'] - D['hq']['blue']['x'], f['z'] - D['hq']['blue']['z']); hr = math.hypot(f['x'] - D['hq']['red']['x'], f['z'] - D['hq']['red']['z'])
    d.text((x0, y), f"{f['id']}  {f['name']}", font=fs, fill=(230, 230, 230))
    d.text((x0 + 230, y), f"Mavi {P.get('b' + f['id'], round(hb))}", font=fs, fill=(140, 180, 255)); d.text((x0 + 390, y), f"Kırmızı {P.get('r' + f['id'], round(hr))}", font=fs, fill=(255, 150, 140)); y += 21
y += 16
d.text((x0, y), 'Bölgeler', font=fb, fill=(255, 224, 90)); y += 24
for name, x, z in D['callouts']:
    d.text((x0, y), f'· {name}', font=fs, fill=(210, 210, 210)); y += 18
    if y > MW - 30: break
img.save(OUT)
print('kaydedildi', OUT)
