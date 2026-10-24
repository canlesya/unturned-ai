# Yörünge Üssü (12.157) kuşbakışı yerleşim şeması: python3 scripts/spaceplan.py plan.json cikti.png
import sys, json
from PIL import Image, ImageDraw, ImageFont
d = json.load(open(sys.argv[1])); out = sys.argv[2]
S, M = 12, 40
B = d['bounds']; W = int((B['maxX'] - B['minX']) * S + 2 * M); H = int((B['maxZ'] - B['minZ']) * S + 2 * M + 140)
def f(sz, bold=True):
    for p in (['/System/Library/Fonts/Supplemental/Arial Bold.ttf'] if bold else ['/System/Library/Fonts/Supplemental/Arial.ttf']):
        try: return ImageFont.truetype(p, sz)
        except Exception: pass
    return ImageFont.load_default()
F1, F2, F3 = f(22), f(15), f(13, False)
img = Image.new('RGB', (W, H), (22, 24, 30)); dr = ImageDraw.Draw(img, 'RGBA')
X = lambda x: M + (x - B['minX']) * S
Z = lambda z: M + 70 + (z - B['minZ']) * S
dr.rectangle([X(B['minX']), Z(B['minZ']), X(B['maxX']), Z(B['maxZ'])], fill=(118, 117, 113))
def col(top, bot, edge=False):
    if edge or top > 7.5: return (70, 68, 64)  # krater duvarı (sınırı aşan bloklar)
    if top > 5.0: return (214, 212, 204)        # modül (6,2 m, ulaşılmaz çatı)
    if bot > 2.5: return (92, 118, 150)          # iskele / asma kat güvertesi (3,5 m)
    if top > 3.0: return (120, 150, 185)         # koridor çatısı / anten çatısı (yüksek zemin)
    if top > 1.7: return (150, 140, 120)         # tam boy siper
    return (176, 168, 146)                       # alçak siper (çömelince)
for b in sorted(d['boxes'], key=lambda b: b[5]):
    x0, z0, x1, z1, y0, y1 = b
    edge = x0 < B['minX'] - 0.5 or z0 < B['minZ'] - 0.5 or x1 > B['maxX'] + 0.5 or z1 > B['maxZ'] + 0.5
    x0, z0, x1, z1 = max(x0, B['minX'] - 2), max(z0, B['minZ'] - 2), min(x1, B['maxX'] + 2), min(z1, B['maxZ'] + 2)
    if x1 <= x0 or z1 <= z0: continue
    dr.rectangle([X(x0), Z(z0), X(x1), Z(z1)], fill=col(y1, y0, edge), outline=(40, 40, 44))
# şeritler (hatlar)
lanes = [((235, 190, 70, 150), [(-47, -10), (-44, -22), (-30, -27), (-12, -26), (0, -21), (12, -26), (30, -27), (44, -22), (47, -10)], 'KUZEY HAT · açık, uzun / orta mesafe'),
         ((80, 220, 200, 150), [(-44, 0), (-33, 0), (-21, 3), (-12, 3), (12, 3), (21, 3), (33, 0), (44, 0)], 'ORTA HAT · kapalı, yakın mesafe'),
         ((255, 130, 90, 150), [(-47, 10), (-44, 18), (-30, 22), (-14, 18), (0, 15), (14, 18), (30, 22), (44, 18), (47, 10)], 'GÜNEY HAT · iniş pisti, orta mesafe')]
for c, pts, _ in lanes: dr.line([(X(x), Z(z)) for x, z in pts], fill=c, width=7, joint='curve')
for s in [-1, 1]:                                                          # köprü (kuzey ↔ güney, 3,5 m)
    dr.line([(X(16 * s), Z(-20)), (X(16 * s), Z(20))], fill=(160, 200, 255, 170), width=5)
for team, c in [('blue', (60, 130, 255)), ('red', (240, 80, 70))]:
    for p in d['spawns'][team]: dr.ellipse([X(p['x']) - 3, Z(p['z']) - 3, X(p['x']) + 3, Z(p['z']) + 3], fill=c)
for co in d['callouts']:
    t = co['name']; fnt = F2 if co.get('major') else F3; w = dr.textlength(t, font=fnt)
    dr.text((X(co['x']) - w / 2 + 1, Z(co['z']) - 8 + 1), t, font=fnt, fill=(0, 0, 0, 200)); dr.text((X(co['x']) - w / 2, Z(co['z']) - 8), t, font=fnt, fill=(255, 255, 255) if co.get('major') else (230, 232, 236))
dr.text((M, 14), 'YÖRÜNGE ÜSSÜ · yerleşim planı (kuşbakışı, kuzey yukarı) · 120 × 80 m · Mavi batı / Kırmızı doğu · x = 0\'a göre ayna simetrik', font=F1, fill=(240, 242, 248))
dr.text((M, 46), 'Doğuşlar kapalı hangarlarda (perde duvarlı kapılar). Düşük yer çekimi: zıplama ≈ 2 m · koşarak ≈ 14 m sıçrama · düşme hasarı yok', font=F3, fill=(200, 204, 212))
leg = [((214, 212, 204), 'modül (6,2 m)'), ((120, 150, 185), 'yüksek zemin 3,5–4 m'), ((92, 118, 150), 'iskele / asma kat'), ((150, 140, 120), 'tam boy siper'), ((176, 168, 146), 'alçak siper'), ((70, 68, 64), 'krater duvarı')]
x = M; y = H - 62
for c, t in leg: dr.rectangle([x, y, x + 18, y + 18], fill=c, outline=(30, 30, 30)); dr.text((x + 24, y + 1), t, font=F3, fill=(225, 228, 235)); x += 30 + dr.textlength(t, font=F3) + 16
x = M; y = H - 32
for c, _, t in lanes: dr.line([(x, y + 9), (x + 26, y + 9)], fill=c, width=6); dr.text((x + 32, y + 1), t, font=F3, fill=(225, 228, 235)); x += 44 + dr.textlength(t, font=F3) + 14
img.save(out); print(out, img.size)
