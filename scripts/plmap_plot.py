# plmap.mjs çıktısından kuşbakışı tasarım haritası (aşama başına bir panel):
#   python3 scripts/plmap_plot.py /tmp/wb-maden/plmap.json /tmp/wb-maden/plmap.png
# gri = çarpışma (koyu = yüksek), açık = yürünebilir, sarı çizgi = ray, A/B/C = kontrol noktaları, mavi / kırmızı kare = doğuş,
# turuncu = cephe hattı (iki takım ±3 m eşit varış), mor halka = en erken karşılaşma, beyaz halka = aşama başında vagon, ince kırmızı = > 35 m görüş hatları (yalnız 1. panel)
import json, sys
from PIL import Image, ImageDraw, ImageFont

src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/wb-maden/plmap.json'
dst = sys.argv[2] if len(sys.argv) > 2 else src.replace('.json', '.png')
D = json.load(open(src))
B = D['bounds']
S = 7  # piksel / m
W, H = int((B['maxX'] - B['minX']) * S), int((B['maxZ'] - B['minZ']) * S)
def P(x, z): return ((x - B['minX']) * S, (z - B['minZ']) * S)
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 18); small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 13)
except Exception: font = small = ImageFont.load_default()

def base(stage, si, lanes=False):
    im = Image.new('RGB', (W, H + 40), (60, 52, 44)); d = ImageDraw.Draw(im, 'RGBA')
    for x, z in D['walk']: d.rectangle([*P(x - 0.5, z - 0.5), *P(x + 0.5, z + 0.5)], fill=(196, 178, 150))
    for x0, z0, x1, z1, h in D['colliders']:
        if x1 - x0 > 60 or z1 - z0 > 60: continue
        g = int(max(40, 150 - h * 14)); d.rectangle([*P(x0, z0), *P(x1, z1)], fill=(g, g - 6, g - 14, 230))
    if lanes:
        for L, ax, az, bx, bz in D['lanes'][:250]: d.line([P(ax, az), P(bx, bz)], fill=(220, 40, 40, 40), width=1)
    for x, z, sd in stage['front']: d.rectangle([*P(x - 0.25, z - 0.25), *P(x + 0.25, z + 0.25)], fill=(255, 140, 0, 150))
    pts = D['track']
    # ray: köşe noktaları (yaklaşık)
    d.line([P(x, z) for x, z in pts], fill=(250, 215, 60), width=4)
    for (x, z), n in zip(D['cps'] + [pts[-1]], 'ABC'):
        d.ellipse([*P(x - 2.2, z - 2.2), *P(x + 2.2, z + 2.2)], outline=(250, 215, 60), width=3); d.text(P(x + 2.6, z - 2.5), n, fill=(255, 235, 120), font=font)
    for t, col in (('blue', (60, 140, 255)), ('red', (240, 70, 60))):
        for x, z in stage[t]: d.rectangle([*P(x - 0.4, z - 0.4), *P(x + 0.4, z + 0.4)], fill=col)
    for key, col in (('pathB', (60, 140, 255, 220)), ('pathR', (240, 70, 60, 220))):
        if len(stage.get(key, [])) > 1: d.line([P(x, z) for x, z in stage[key]], fill=col, width=3)
    c = stage.get('contact')
    if c:
        d.line([P(*c['a']), P(*c['r'])], fill=(255, 255, 255, 230), width=2)
        for x, z in (c['a'], c['r']): d.ellipse([*P(x - 1, z - 1), *P(x + 1, z + 1)], fill=(255, 255, 255))
    cx, cz = stage['cart']; d.ellipse([*P(cx - 1.6, cz - 1.6), *P(cx + 1.6, cz + 1.6)], outline=(255, 255, 255), width=3)
    mx, mz = stage['meet']; d.ellipse([*P(mx - 2.5, mz - 2.5), *P(mx + 2.5, mz + 2.5)], outline=(200, 60, 255), width=4)
    d.rectangle([0, H, W, H + 40], fill=(30, 26, 22))
    d.text((8, H + 4), f"aşama {si + 1}: vagona mavi {stage['toCart'][0]:.0f} m / kırmızı {stage['toCart'][1]:.0f} m · hedefe {stage['toNext'][0]:.0f} / {stage['toNext'][1]:.0f} m · doğuş↔doğuş {stage['spawnToSpawn']:.0f} m", fill=(240, 230, 210), font=small)
    d.text((8, H + 21), f"ilk temas: kırmızı vagona {c['redCart'] if (c:=stage.get('contact')) else '-'} m · cephe hattı raya ortanca {stage['frontMedian']} m · ≤8 m %{stage['frontNear8']} · >20 m %{stage['frontFar20']} · avlu önüne görüş {stage.get('spawnPeek', '?')} · ölü alan %{D['deadNoSpawn']}", fill=(240, 230, 210), font=small)
    return im

ims = [base(st, i, lanes=(i == 0)) for i, st in enumerate(D['stages'])]
out = Image.new('RGB', (W * len(ims) + 10 * (len(ims) - 1), H + 40), (20, 18, 16))
for i, im in enumerate(ims): out.paste(im, (i * (W + 10), 0))
out.save(dst)
print('→', dst, out.size)
