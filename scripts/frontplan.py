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
BANDS = [(-10, 150, 'MAVİ YARISI (başlangıçta)', (70, 110, 160, 30)), (-150, -10, 'KIRMIZI YARISI (başlangıçta)', (190, 110, 90, 30))]
for z0, z1, name, col in BANDS:
    dr.rectangle([X(B['minX']), Y(z0), X(B['maxX']), Y(z1)], fill=col)
    tw = dr.textlength(name, font=f(FB, 15))
    zt = z0 if z0 > -100 else z0
    dr.rectangle([X(B['minX']), Y(zt), X(B['minX']) + tw + 12, Y(zt) + 20], fill=(20, 22, 22, 190))
    dr.text((X(B['minX']) + 6, Y(zt) + 2), name, font=f(FB, 15), fill=(240, 236, 220, 240))
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
       'korkuluk': (160, 145, 110), 'yuva': (175, 140, 90), 'top': (165, 140, 100), 'tank': (60, 62, 56), 'kamyon': (70, 72, 62), 'balya': (190, 170, 100), 'kirpi': (50, 44, 40), 'meydan': (150, 140, 120), 'ağaç': (40, 70, 36), 'çit': (96, 124, 66), 'duvar': (168, 160, 140)}
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
# saldıran kapakları (krater / enkaz)
for x, z in D.get('covers', []):
    dr.ellipse([X(x) - 3, Y(z) - 3, X(x) + 3, Y(z) + 3], outline=(110, 200, 255, 200), width=1)
# mevziler (havuz: etkin noktaya göre seçilir; yönlü olanlar yüzünün baktığı yandan gelen düşmana)
def icon(kind, x, y):
    if kind == 'sniper':
        dr.ellipse([x - 8, y - 8, x + 8, y + 8], outline=(255, 214, 80), width=3); dr.line([x - 11, y, x + 11, y], fill=(255, 214, 80), width=2); dr.line([x, y - 11, x, y + 11], fill=(255, 214, 80), width=2)
    elif kind == 'mg':
        dr.polygon([(x, y - 8), (x - 8, y + 6), (x + 8, y + 6)], fill=(255, 130, 60), outline=(20, 10, 5))
    elif kind == 'ambush':
        dr.polygon([(x, y - 7), (x + 7, y), (x, y + 7), (x - 7, y)], fill=(200, 110, 230), outline=(20, 10, 20))
    elif kind == 'fire':
        dr.rectangle([x - 3, y - 2, x + 3, y + 2], fill=(250, 245, 230), outline=(30, 30, 30))
    else:
        dr.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(255, 140, 120), outline=(30, 10, 10))
for p in D.get('holds', []): icon(p['kind'], X(p['x']), Y(p['z']))
# doğuşlar: her etkin nokta için iki takımın bölgesi (başlangıç aşaması 3 kalın)
OB = D['objectives']
for si, st in enumerate(D['stages']):
    for team, col in (('blue', (74, 163, 255)), ('red', (255, 90, 67))):
        pts = st[team]
        rr = 3 if si == 3 else 1.6
        for p in pts: dr.ellipse([X(p['x']) - rr, Y(p['z']) - rr, X(p['x']) + rr, Y(p['z']) + rr], fill=col + (230 if si == 3 else 120,))
        cx = sum(p['x'] for p in pts) / len(pts); cz = sum(p['z'] for p in pts) / len(pts)
        tag = ('M' if team == 'blue' else 'K') + '·' + OB[si]['label']
        tx, ty = X(cx) + (30 if team == 'blue' else -30), Y(cz) + (si - 3) * 3
        dr.rounded_rectangle([tx - 19, ty - 9, tx + 19, ty + 9], 4, fill=col + (235 if si == 3 else 170,), outline=(15, 15, 15))
        dr.text((tx, ty), tag, font=f(FB, 13), fill=(10, 12, 16), anchor='mm')
# nokta zinciri (Mavi KG → … → Kırmızı KG): çizgi + noktalar
chain = [next(o for o in OB if o['id'] == i) for i in D['chain']]
for a, b2 in zip(chain, chain[1:]):
    dr.line([X(a['x']), Y(a['z']), X(b2['x']), Y(b2['z'])], fill=(255, 225, 140, 220), width=4)
for i, o in enumerate(chain):
    x, y, r = X(o['x']), Y(o['z']), o['r'] * S
    col = (90, 170, 255) if o.get('hq') == 'blue' else (255, 110, 90) if o.get('hq') == 'red' else (255, 225, 140) if o.get('mid') else (235, 220, 190)
    dr.ellipse([x - r, y - r, x + r, y + r], outline=col + (255,), width=3, fill=col + (40,))
    dr.ellipse([x - 15, y - 15, x + 15, y + 15], fill=(12, 14, 18, 235), outline=col, width=2)
    dr.text((x, y + 1), o['label'], font=f(FB, 16), fill=col, anchor='mm')
    dr.text((x, y + 19), f"{i}. {o['name']}" + (' · ORTA' if o.get('mid') else ''), font=f(FB, 13), fill=(245, 240, 225), anchor='mt', stroke_width=2, stroke_fill=(20, 20, 20))

# başlık + açıklama paneli
dr.text((MX, 24), 'BATI CEPHESİ · CEPHE HATTI PLANI (12.161)', font=f(FB, 30), fill=(240, 236, 224))
dr.text((MX, 60), f"{B['maxX'] - B['minX']} × {B['maxZ'] - B['minZ']} m · 7 noktalık zincir · aynı anda tek etkin nokta · iki ordu kendi ucunda · ölçek 1 m = {S} px", font=f(FR, 16), fill=(200, 200, 190))
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
leg('Dikenli tel (geçitli)', lambda a, b: dr.line([a - 10, b, a + 10, b], fill=(30, 26, 22), width=3))
leg('Yıkık ev / kilise / ambar', lambda a, b: dr.rectangle([a - 8, b - 6, a + 8, b + 6], fill=(190, 180, 160)))
leg('Çalı çiti (toprak set + çalı) · yeni', lambda a, b: dr.rectangle([a - 9, b - 3, a + 9, b + 3], fill=(96, 124, 66)))
leg('Yıkık taş duvar · yeni', lambda a, b: dr.rectangle([a - 9, b - 2, a + 9, b + 2], fill=(168, 160, 140)))
leg('Ağaç / orman / ağaç sırası', lambda a, b: dr.ellipse([a - 5, b - 5, a + 5, b + 5], fill=(50, 80, 44)))
y += 6
leg('CEPHE HATTI', bold=True, size=20)
leg('Nokta zinciri: KG — A — B — C (ORTA) — D — E — KG', lambda a, b: dr.line([a - 10, b, a + 10, b], fill=(255, 225, 140), width=4))
for line in ['Aynı anda yalnız bir nokta etkin; başta C (Köy Meydanı), kimsenin.',
             'Mavi alırsa etkin nokta Kırmızı ucuna (D), Kırmızı alırsa',
             'Mavi ucuna (B) kayar; geride kalanlar alanın, kilitli.',
             'Düşman karargâhını alan ya da düşmanın bileti biten /',
             'süre bitince az noktası olan kaybeder. Az noktalı taraf kanar.']:
    leg(line, size=15, col=(205, 205, 195))
y += 6
leg('DOĞUŞLAR (etkin noktaya göre)', bold=True, size=20)
leg('M·x / K·x: x etkinken Mavi / Kırmızı doğuşu', lambda a, b: dr.rounded_rectangle([a - 12, b - 8, a + 12, b + 8], 3, fill=(74, 163, 255)))
for line in ['Kalın noktalar: başlangıç (C etkin) · iki takım ≈ 50 m yürüyüş.',
             'Her aşamada kendi yarısında, etkin noktaya 30–75 m;',
             'etkin noktadan görünen doğuş elenir (örtülü siper / sığınak).']:
    leg(line, size=15, col=(205, 205, 195))
y += 6
leg('MEVZİ HAVUZU (savunan botlar)', bold=True, size=20)
leg('Keskin nişancı (kule, samanlık, uç basamak)', lambda a, b: icon('sniper', a, b))
leg('Makineli tüfek yuvası', lambda a, b: icon('mg', a, b))
leg('Pusu (ev içi, siper köşesi)', lambda a, b: icon('ambush', a, b))
leg('Ateş basamağı (yüzü düşmana bakan)', lambda a, b: icon('fire', a, b))
leg('Krater / enkaz kapağı (saldıran durağı)', lambda a, b: dr.ellipse([a - 4, b - 4, a + 4, b + 4], outline=(110, 200, 255), width=2))
img.save(dst)
print('yazıldı', dst, img.size)
