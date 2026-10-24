# Batı Cephesi kuşbakışı yerleşim şeması: python3 scripts/frontplan.py /tmp/wb-cephe/plan.json /tmp/wb-cephe/taslak/plan.png
# Girdi: scripts/frontplan.mjs çıktısı. Sektör bantları, siperler (arazi kesiği), yapılar, tel, kraterler, noktalar, aşama doğuşları, mevziler, kanat rotaları.
import json, sys, math
from PIL import Image, ImageDraw, ImageFont

src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/wb-cephe/plan.json'
dst = sys.argv[2] if len(sys.argv) > 2 else '/tmp/wb-cephe/taslak/plan.png'
D = json.load(open(src))
B = D['bounds']
S = 3.6                                  # px / m
MX, MY = 40, 90                          # harita sol-üst kenar boşluğu
W_MAP = (B['maxX'] - B['minX']) * S
H_MAP = (B['maxZ'] - B['minZ']) * S
PANEL = 560
W, H = int(MX * 2 + W_MAP + PANEL), int(MY + H_MAP + 40)
img = Image.new('RGB', (W, H), (30, 32, 32))
dr = ImageDraw.Draw(img, 'RGBA')
FB = '/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf'
FR = '/System/Library/Fonts/Supplemental/Arial Narrow.ttf'
f = lambda p, n: ImageFont.truetype(p, n)
X = lambda x: MX + (x - B['minX']) * S
Y = lambda z: MY + (z - B['minZ']) * S          # kuzey (−z) yukarıda

# zemin + sektör bantları
dr.rectangle([X(B['minX']), Y(B['minZ']), X(B['maxX']), Y(B['maxZ'])], fill=(92, 90, 70))
BANDS = [(104, 150, 'MAVİ BAŞLANGIÇ HATTI', (70, 110, 160, 46)), (64, 104, 'ÖLÜM BÖLGESİ', (0, 0, 0, 30)), (16, 64, 'SEKTÖR 1 · BİRİNCİ HAT', (200, 170, 90, 34)),
         (-36, 16, 'SEKTÖR 2 · HARAP KÖY', (160, 140, 120, 34)), (-96, -36, 'SEKTÖR 3 · ÇİFTLİK', (150, 170, 110, 30)), (-150, -96, 'SEKTÖR 4 · ANA HAT', (190, 120, 100, 34))]
for z0, z1, name, col in BANDS:
    dr.rectangle([X(B['minX']), Y(z0), X(B['maxX']), Y(z1)], fill=col)
    dr.line([X(B['minX']), Y(z1), X(B['maxX']), Y(z1)], fill=(20, 20, 20, 120), width=1)
    tw = dr.textlength(name, font=f(FB, 15))
    dr.rectangle([X(B['minX']), Y(z0), X(B['minX']) + tw + 12, Y(z0) + 20], fill=(20, 22, 22, 190))
    dr.text((X(B['minX']) + 6, Y(z0) + 2), name, font=f(FB, 15), fill=(240, 236, 220, 240))
# orman
dr.rectangle([X(-80), Y(-100), X(-20), Y(-44)], fill=(60, 80, 50, 70))
# kraterler
for x, z, h in D['craters']:
    r = 2.2 * S * min(1.0, -h)
    dr.ellipse([X(x) - r, Y(z) - r, X(x) + r, Y(z) + r], fill=(70, 58, 44, 110))
# siper kesikleri
c = D['cell']
for x, z, k, fl, rv in D['cells']:
    col = (58, 46, 36) if k == 1 else (110, 92, 70)
    if fl > -1.3 and k == 1: col = (82, 66, 50)          # çukur yol
    if rv == 9: col = (120, 120, 116)                     # beton sığınak tabanı
    dr.rectangle([X(x), Y(z), X(x + c) - 1, Y(z + c) - 1], fill=col)
# çarpışma kutuları: türe göre
STY = {'ev': (190, 180, 160), 'kilise': (170, 164, 150), 'ambar': (140, 105, 70), 'ciftlik': (180, 170, 150), 'kulübe': (110, 85, 60), 'beton': (150, 150, 146), 'sığınak': (150, 130, 95),
       'korkuluk': (160, 145, 110), 'yuva': (175, 140, 90), 'top': (165, 140, 100), 'tank': (60, 62, 56), 'kamyon': (70, 72, 62), 'balya': (190, 170, 100), 'kirpi': (50, 44, 40), 'meydan': (150, 140, 120), 'ağaç': (40, 70, 36)}
for x0, z0, x1, z1, top, oid, tag in D['cols']:
    if oid == 'tel':
        dr.line([X(x0), Y((z0 + z1) / 2), X(x1), Y((z0 + z1) / 2)], fill=(30, 26, 22, 230), width=2)
        continue
    if oid == 'basamak': continue
    col = STY.get(oid, (150, 140, 120))
    if oid == 'ağaç':
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        dr.ellipse([X(cx) - 4, Y(cz) - 4, X(cx) + 4, Y(cz) + 4], fill=(50, 80, 44, 200)); continue
    dr.rectangle([X(x0), Y(z0), max(X(x0) + 1, X(x1)), max(Y(z0) + 1, Y(z1))], fill=col + (235,))
# kanat rotaları + saldıran kapakları (aşama başına)
for si, h in enumerate(D['hints'] or []):
    for route in h.get('flank', []):
        pts = [(X(x), Y(z)) for x, z in route]
        for a, b2 in zip(pts, pts[1:]):
            L = math.dist(a, b2); n = max(1, int(L / 9))
            for t in range(0, n, 2):
                p0 = (a[0] + (b2[0] - a[0]) * t / n, a[1] + (b2[1] - a[1]) * t / n); p1 = (a[0] + (b2[0] - a[0]) * (t + 1) / n, a[1] + (b2[1] - a[1]) * (t + 1) / n)
                dr.line([p0, p1], fill=(110, 180, 255, 220), width=3)
        ex, ez = pts[-1]
        dr.polygon([(ex, ez - 6), (ex - 5, ez + 4), (ex + 5, ez + 4)], fill=(110, 180, 255, 230))
    for x, z in h.get('cover', []):
        dr.ellipse([X(x) - 4, Y(z) - 4, X(x) + 4, Y(z) + 4], outline=(110, 200, 255, 255), width=2)
# mevziler
def icon(kind, x, y):
    if kind == 'sniper':
        dr.ellipse([x - 8, y - 8, x + 8, y + 8], outline=(255, 214, 80), width=3); dr.line([x - 11, y, x + 11, y], fill=(255, 214, 80), width=2); dr.line([x, y - 11, x, y + 11], fill=(255, 214, 80), width=2)
    elif kind == 'mg':
        dr.polygon([(x, y - 8), (x - 8, y + 6), (x + 8, y + 6)], fill=(255, 130, 60), outline=(20, 10, 5))
    elif kind == 'ambush':
        dr.polygon([(x, y - 7), (x + 7, y), (x, y + 7), (x - 7, y)], fill=(200, 110, 230), outline=(20, 10, 20))
    elif kind == 'fire':
        dr.rectangle([x - 4, y - 3, x + 4, y + 3], fill=(250, 245, 230), outline=(30, 30, 30))
    else:
        dr.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(255, 140, 120), outline=(30, 10, 10))
for h in D['hints'] or []:
    for p in h['hold']: icon(p['kind'], X(p['x']), Y(p['z']))
# doğuşlar (aşama numarasıyla)
for si, st in enumerate(D['stages']):
    for team, col in (('blue', (74, 163, 255)), ('red', (255, 90, 67))):
        pts = st[team]
        for p in pts: dr.ellipse([X(p['x']) - 2, Y(p['z']) - 2, X(p['x']) + 2, Y(p['z']) + 2], fill=col + (200,))
        zn = st['zones'][team]
        dr.rectangle([X(zn['minX']), Y(zn['minZ']), X(zn['maxX']), Y(zn['maxZ'])], outline=col + (150,), width=1)
        cx = sum(p['x'] for p in pts) / len(pts); cz = sum(p['z'] for p in pts) / len(pts)
        tag = ('M' if team == 'blue' else 'K') + str(si + 1)
        tx, ty = X(cx) + (26 if team == 'blue' else -26), Y(cz)
        dr.rounded_rectangle([tx - 15, ty - 10, tx + 15, ty + 10], 4, fill=col + (235,), outline=(15, 15, 15))
        dr.text((tx, ty), tag, font=f(FB, 15), fill=(10, 12, 16), anchor='mm')
# noktalar
SC = [(255, 205, 90), (230, 200, 160), (170, 220, 120), (255, 150, 120)]
for o in D['objectives']:
    si = next(i for i, s in enumerate(D['sectors']) if o['id'] in s['objs'])
    x, y, r = X(o['x']), Y(o['z']), o['r'] * S
    dr.ellipse([x - r, y - r, x + r, y + r], outline=SC[si] + (255,), width=3, fill=SC[si] + (40,))
    dr.ellipse([x - 13, y - 13, x + 13, y + 13], fill=(12, 14, 18, 235), outline=SC[si], width=2)
    dr.text((x, y + 1), o['label'], font=f(FB, 18), fill=SC[si], anchor='mm')
    dr.text((x, y + 18), o['name'], font=f(FB, 13), fill=(245, 240, 225), anchor='mt', stroke_width=2, stroke_fill=(20, 20, 20))
# yön oku
ax = X(B['maxX']) - 26
dr.line([ax, Y(130), ax, Y(-120)], fill=(110, 180, 255, 120), width=6)
dr.polygon([(ax, Y(-128)), (ax - 12, Y(-112)), (ax + 12, Y(-112))], fill=(110, 180, 255, 160))
dr.text((ax - 8, Y(0)), 'SALDIRI', font=f(FB, 14), fill=(180, 215, 255), anchor='rm')

# başlık + açıklama paneli
dr.text((MX, 24), 'BATI CEPHESİ · YERLEŞİM PLANI (TASLAK)', font=f(FB, 30), fill=(240, 236, 224))
dr.text((MX, 60), f"{B['maxX'] - B['minX']} × {B['maxZ'] - B['minZ']} m · Cephe modu · Mavi güneyden kuzeye saldırır · 4 sektör × 2 nokta · ölçek 1 m = {S} px", font=f(FR, 16), fill=(200, 200, 190))
px = int(MX * 2 + W_MAP) + 10
y = MY
def leg(text, draw_fn=None, size=17, bold=False, col=(232, 228, 216)):
    global y
    if draw_fn: draw_fn(px + 12, y + 10)
    dr.text((px + (34 if draw_fn else 0), y), text, font=f(FB if bold else FR, size), fill=col)
    y += size + 9
leg('GÖSTERGE', bold=True, size=20)
leg('Siper (arazi kesiği, taban −1,6 m)', lambda a, b: dr.rectangle([a - 9, b - 6, a + 9, b + 6], fill=(58, 46, 36)))
leg('Rampa (siperden tarlaya çıkış)', lambda a, b: dr.rectangle([a - 9, b - 6, a + 9, b + 6], fill=(110, 92, 70)))
leg('Çukur yol (taban −1,15 m)', lambda a, b: dr.rectangle([a - 9, b - 6, a + 9, b + 6], fill=(82, 66, 50)))
leg('Dikenli tel (geçitli)', lambda a, b: dr.line([a - 10, b, a + 10, b], fill=(30, 26, 22), width=3))
leg('Top mermisi krateri', lambda a, b: dr.ellipse([a - 7, b - 7, a + 7, b + 7], fill=(70, 58, 44)))
leg('Yıkık ev / kilise / ambar', lambda a, b: dr.rectangle([a - 8, b - 6, a + 8, b + 6], fill=(190, 180, 160)))
leg('Beton sığınak / tabya', lambda a, b: dr.rectangle([a - 8, b - 6, a + 8, b + 6], fill=(150, 150, 146)))
leg('Sığınak odası (doğuş, örtülü)', lambda a, b: dr.rectangle([a - 8, b - 6, a + 8, b + 6], fill=(150, 130, 95)))
leg('Ağaç / orman', lambda a, b: dr.ellipse([a - 5, b - 5, a + 5, b + 5], fill=(50, 80, 44)))
y += 6
leg('MEVZİLER (savunan botlar)', bold=True, size=20)
leg('Keskin nişancı (kule, samanlık, uç basamak)', lambda a, b: icon('sniper', a, b))
leg('Makineli tüfek yuvası (tabya, kum torbası)', lambda a, b: icon('mg', a, b))
leg('Pusu (ev içi, siper köşesi)', lambda a, b: icon('ambush', a, b))
leg('Ateş basamağı tüfekçisi (çömel / kalk)', lambda a, b: icon('fire', a, b))
leg('Siper / kapak', lambda a, b: icon('cover', a, b))
y += 6
leg('SALDIRAN', bold=True, size=20)
leg('Kanat rotası (yan yol)', lambda a, b: dr.line([a - 10, b, a + 10, b], fill=(110, 180, 255), width=3))
leg('Krater / enkaz kapağı (ilerleme durağı)', lambda a, b: dr.ellipse([a - 5, b - 5, a + 5, b + 5], outline=(110, 200, 255), width=2))
y += 6
leg('DOĞUŞ AŞAMALARI', bold=True, size=20)
leg('M1–M4 Mavi · K1–K4 Kırmızı (sektör düştükçe kayar)', lambda a, b: dr.rounded_rectangle([a - 12, b - 8, a + 12, b + 8], 3, fill=(74, 163, 255)))
for i, t in enumerate(['1: M1 destek hattı → A/B · K1 yedek siper', '2: M2 alınan destek siperi → C/D · K2 çukur yol', '3: M3 kuzey evleri → E/F · K3 ana hat sığınakları', '4: M4 çiftlik avlusu → G/H · K4 yedek hat']):
    leg(t, size=15, col=(205, 205, 195))
y += 6
leg('NOKTALAR', bold=True, size=20)
for s, (a, b2, n1, n2) in zip(['1', '2', '3', '4'], [('A', 'B', 'Batı Tabyası', 'Doğu Kavşağı'), ('C', 'D', 'Kilise', 'Köy Meydanı'), ('E', 'F', 'Ambar', 'Orman Kulübesi'), ('G', 'H', 'Komuta Sığınağı', 'Batarya')]):
    leg(f'Sektör {s}: {a} {n1} · {b2} {n2}', size=15, col=SC[int(s) - 1])
y += 8
for line in ['Sektör, noktalarının hepsi aynı anda Mavi\'deyken düşer;', 'savunan aynı sektörü geri alabilir. Geçilen sektör kilitlenir,', 'Mavi\'ye bilet ödülü. Bilet / süre biterse Kırmızı kazanır.']:
    leg(line, size=15, col=(190, 190, 180))
img.save(dst)
print('yazıldı', dst, img.size)
