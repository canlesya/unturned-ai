#!/usr/bin/env python3
# 12.203 Öldürme konumu ısı haritası (önce / sonra), PIL ile: scalesim.mjs çıktıları (OUT=… .json: killPos, objs, bounds).
#   python3 scripts/scaleheat.py çıktı.png "Önce 64v64=/tmp/a1.json,/tmp/a2.json" "Sonra 64v64=/tmp/b1.json" ...
# Her sütun bir etiket (virgüllü dosyalar birleştirilir: tohumlar). Isı: 12 m hücre, bulanık, karekök ölçek; bayraklar harf + halka, üsler kare.
# Altında: öldürme sayısı, en kalabalık 3 bölgenin payı, 50 m ızgara entropisi (bit), ≥ %5 pay alan bölge sayısı.
import json, math, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W = 520; PAD = 14; FOOT = 92; HEAD = 30
def font(sz):
    for p in ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc', '/Library/Fonts/Arial.ttf']:
        try: return ImageFont.truetype(p, sz)
        except Exception: pass
    return ImageFont.load_default()
F1, F2, F3 = font(17), font(13), font(15)

def colormap(v):  # 0..1 → koyu mavi → mor → turuncu → sarı → beyaz
    stops = [(0, (12, 16, 30)), (0.15, (40, 30, 110)), (0.4, (150, 40, 120)), (0.65, (235, 110, 40)), (0.85, (250, 210, 60)), (1, (255, 255, 230))]
    for i in range(len(stops) - 1):
        a, ca = stops[i]; b, cb = stops[i + 1]
        if v <= b:
            t = (v - a) / (b - a) if b > a else 0
            return tuple(int(ca[k] + (cb[k] - ca[k]) * t) for k in range(3))
    return stops[-1][1]

def panel(label, files):
    kills, objs, bounds, meta = [], None, None, []
    for f in files:
        d = json.load(open(f))
        kills += d['killPos']; objs = objs or d['objs']; bounds = bounds or d['bounds']; meta.append(d)
    b = bounds
    minx, maxx, minz, maxz = b.get('minX', -800), b.get('maxX', 800), b.get('minZ', -800), b.get('maxZ', 800)
    sx = (W - 2 * PAD) / (maxx - minx); H = int((maxz - minz) * sx) + 2 * PAD
    cell = 12; nx = int((maxx - minx) / cell) + 1; nz = int((maxz - minz) / cell) + 1
    grid = [[0] * nx for _ in range(nz)]
    for k in kills:
        i = int((k[0] - minx) / cell); j = int((k[1] - minz) / cell)
        if 0 <= i < nx and 0 <= j < nz: grid[j][i] += 1
    g = Image.new('L', (nx, nz)); mx = max(1, max(max(r) for r in grid))
    g.putdata([min(255, int(255 * math.sqrt(grid[j][i] / mx))) for j in range(nz) for i in range(nx)])
    g = g.resize((W - 2 * PAD, H - 2 * PAD), Image.BILINEAR).filter(ImageFilter.GaussianBlur(9))
    gx = g.load(); m2 = max(1, max(g.getdata()))
    im = Image.new('RGB', (W, H + HEAD + FOOT), (10, 13, 22)); px = im.load()
    for y in range(g.size[1]):
        for x in range(g.size[0]):
            px[x + PAD, y + PAD + HEAD] = colormap(gx[x, y] / m2)
    dr = ImageDraw.Draw(im)
    P = lambda x, z: (PAD + (x - minx) * sx, HEAD + PAD + (z - minz) * sx)
    for o in objs:
        cx, cy = P(o['x'], o['z']); r = max(6, o['r'] * sx * 2.2)
        dr.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(120, 220, 255), width=2)
        dr.text((cx + r + 2, cy - 9), o['id'], fill=(170, 235, 255), font=F3)
    dr.text((PAD, 6), label, fill=(240, 240, 240), font=F1)
    n = len(kills)
    m0 = meta[0]
    def avg(key):
        v = [m['dist'][key] for m in meta]; return sum(v) / len(v)
    reg = {}
    for m in meta:
        for name, c in m['dist']['topRegions']: reg[name] = reg.get(name, 0) + c
    top = sorted(reg.items(), key=lambda a: -a[1])[:4]
    y0 = HEAD + H + 4
    dr.text((PAD, y0), f"öldürme {n} ({len(meta)} maç) · ilk 3 bölge %{avg('top3Pct'):.0f} · entropi {avg('entropy50'):.2f} bit · ≥%5 bölge {avg('regions5'):.1f}", fill=(220, 220, 220), font=F2)
    dr.text((PAD, y0 + 20), 'en çok: ' + ', '.join(f"{a} {b * 100 // max(1, n)}%" for a, b in top), fill=(200, 200, 200), font=F2)
    wt = ' → '.join(m0['dist']['winTop'][1:])
    dr.text((PAD, y0 + 40), ('dakika dakika (1. maç): ' + wt)[:86], fill=(180, 180, 180), font=F2)
    return im

def main():
    out = sys.argv[1]
    cols = []
    for a in sys.argv[2:]:
        label, fs = a.split('=', 1)
        cols.append(panel(label, [f for f in fs.split(',') if f]))
    Wt = sum(c.size[0] for c in cols) + 8 * (len(cols) - 1); Ht = max(c.size[1] for c in cols)
    im = Image.new('RGB', (Wt, Ht), (0, 0, 0)); x = 0
    for c in cols: im.paste(c, (x, 0)); x += c.size[0] + 8
    im.save(out); print(out, im.size)

main()
