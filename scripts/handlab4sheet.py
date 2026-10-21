#!/usr/bin/env python3
# Elsiz silah laboratuvarı v4 tabloları: /tmp/wb-lab4/{cur,v1-cur,v1-new,v2-cur,v2-new}/*.png → sheet-stills.png (satır: taslak, sütun: silah × bel / nişan; blok: cihaz × gün saati),
#   sheet-anims.png (8 kare şeritler), sheet-thirdperson.png (asker + mevcut / taslak silah), ref-vs-ours.png (kullanıcı ekran görüntüsü | bizim V1 AK)
#   python3 scripts/handlab4sheet.py [/tmp/wb-lab4] [ref.webp]
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
ROOT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/wb-lab4'
REF = sys.argv[2] if len(sys.argv) > 2 else ''
ROWS = [('cur', 'MEVCUT · eller + eski silah'), ('v1-cur', 'V1 elsiz · eski silah'), ('v1-new', 'V1 elsiz · TASLAK silah'), ('v2-cur', 'V2 blok kol · eski silah'), ('v2-new', 'V2 blok kol · TASLAK silah')]
try: FONT = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 22); SMALL = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 15)
except Exception: FONT = SMALL = ImageFont.load_default()

def crop(im, box=(0.3, 0.3, 1.0, 1.0)):
    w, h = im.size; return im.crop((int(w * box[0]), int(h * box[1]), int(w * box[2]), int(h * box[3])))
def load(p): return Image.open(p) if os.path.exists(p) else None
def grid(cells, cw, ch, top, left, title):
    W = 170 + len(top) * cw; H = 60 + len(left) * ch
    s = Image.new('RGB', (W, H), (18, 20, 26)); d = ImageDraw.Draw(s); d.text((10, 8), title, fill='white', font=FONT)
    for j, t in enumerate(top): d.text((170 + j * cw + 6, 38), t, fill=(200, 210, 230), font=SMALL)
    for i, l in enumerate(left):
        d.text((6, 60 + i * ch + 8), l, fill=(255, 220, 120), font=SMALL)
        for j in range(len(top)):
            im = cells(i, j)
            if im is not None: s.paste(im.resize((cw - 4, ch - 4)), (170 + j * cw + 2, 60 + i * ch + 2))
    return s
def stack(blocks, path):
    out = Image.new('RGB', (max(b.width for b in blocks), sum(b.height for b in blocks)), (18, 20, 26)); y = 0
    for b in blocks: out.paste(b, (0, y)); y += b.height
    out.save(path); print('yazıldı', path, out.size)

STILLS = ['ak47-hip', 'ak47-ads', 'm4a1-hip', 'm4a1-ads', 'shotgun-hip', 'shotgun-ads', 'pistol-hip', 'pistol-ads', 'sniper-hip', 'knife-hip', 'ak47-sprint', 'grenade-idle']
def stills():
    blocks = []
    for dev, tod, ch in [('desk', 'day', 200), ('mob', 'day', 150), ('desk', 'night', 200), ('mob', 'night', 150)]:
        def cell(i, j, dev=dev, tod=tod):
            im = load(f'{ROOT}/{ROWS[i][0]}/{dev}-{tod}-{STILLS[j]}.png'); return crop(im) if im else None
        blocks.append(grid(cell, 250, ch, STILLS, [r[1] for r in ROWS], f"{'Masaüstü 1600×900' if dev == 'desk' else 'Pixel 7 yatay'} · {'gündüz' if tod == 'day' else 'gece'} · sağ-alt %70 kırpık · aynı kamera / ışık"))
    stack(blocks, f'{ROOT}/sheet-stills.png')

ANIMS = ['ak-reload', 'shotgun-shell', 'sniper-bolt', 'pistol-reload', 'knife-slash', 'knife-stab', 'grenade-throw', 'ak-sprint2ads', 'ak-fire', 'shotgun-pump']
def anims():
    rows = [r for r in ROWS if os.path.isdir(f'{ROOT}/{r[0]}')]
    sheets = []
    for a in ANIMS:
        def cell(i, j, a=a):
            im = load(f'{ROOT}/{rows[i][0]}/anim-{a}-{j}.png'); return crop(im, (0.1, 0.25, 1.0, 1.0)) if im else None
        sheets.append(grid(cell, 230, 150, [f't={k/7:.2f}' for k in range(8)], [r[1] for r in rows], f'Animasyon şeridi · {a}'))
    stack(sheets, f'{ROOT}/sheet-anims.png')

W6 = ['ak47', 'm4a1', 'shotgun', 'pistol', 'sniper', 'knife', 'ak47-reload', 'knife-slash']
def third():
    rows = [('third-cur', 'MEVCUT silah'), ('third-new', 'TASLAK silah')]
    def cell(i, j):
        im = load(f'{ROOT}/{rows[i][0]}/{W6[j]}.png'); return crop(im, (0.3, 0.0, 0.9, 0.8)) if im else None
    s = grid(cell, 300, 350, W6, [r[1] for r in rows], 'Üçüncü şahıs · asker modeli + silah (createCharacter + setWeapon, LOD köşe rengi)')
    lines = []
    for r in ['v1-new', 'v1-cur']:
        try:
            pf = json.load(open(f'{ROOT}/{r}/perf.json'))
            lines.append(r + ': ' + '  '.join(f"{k}: parça {v['parts']['cur']}→{v['parts']['new']} · ağ {v['weaponMeshes']} · üçgen {v['weaponTris']} · çizim {v['calls']} · {v['ms']} ms" for k, v in pf.items()))
        except Exception as e: lines.append(f'{r}: perf yok ({e})')
    out = Image.new('RGB', (max(s.width, 2400), s.height + 30 * len(lines) + 10), (18, 20, 26)); out.paste(s, (0, 0)); d = ImageDraw.Draw(out)
    for i, l in enumerate(lines): d.text((10, s.height + 6 + i * 30), l, fill=(220, 220, 220), font=SMALL)
    out.save(f'{ROOT}/sheet-thirdperson.png'); print('yazıldı sheet-thirdperson.png')

def ref():
    if not REF or not os.path.exists(REF): return
    a = Image.open(REF).convert('RGB').resize((1600, 900)); b = load(f'{ROOT}/big/v1-ak-hip-new.png')
    out = Image.new('RGB', (3200, 940), (18, 20, 26)); d = ImageDraw.Draw(out)
    d.text((10, 8), 'Referans (Unturned, kullanıcı ekran görüntüsü)', fill='white', font=FONT); d.text((1610, 8), 'Bizim · V1 elsiz · taslak AK-47 · bel', fill='white', font=FONT)
    out.paste(a, (0, 40)); out.paste(b.convert('RGB').resize((1600, 900)), (1600, 40)) if b else None
    out.save(f'{ROOT}/ref-vs-ours.png'); print('yazıldı ref-vs-ours.png')

stills(); anims(); third(); ref()
