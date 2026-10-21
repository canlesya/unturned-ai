# Kare el oyun görüntüleri → tablolar (boxhands.mjs çıktısından).
#   python3 scripts/boxhandsheet.py <önce klasörü> <sonra klasörü> <çıktı klasörü>
#   sheet-before-after.png (satır = duruş, sütun önce | sonra; masaüstü gündüz) · sheet-anims.png (animasyon şeritleri, 8 kare) · sheet-night-mobile.png · sheet-third.png
import sys, os
from PIL import Image, ImageDraw
B, A, O = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(O, exist_ok=True)
def tile(p, w, h, label):
    im = Image.open(p).convert('RGB').resize((w, h)) if os.path.exists(p) else Image.new('RGB', (w, h), (40, 40, 40))
    d = ImageDraw.Draw(im); d.rectangle([0, 0, len(label) * 7 + 8, 16], fill=(0, 0, 0)); d.text((4, 2), label, fill=(255, 255, 255)); return im
def grid(cells, cols, w, h, out):
    rows = (len(cells) + cols - 1) // cols; im = Image.new('RGB', (cols * w, rows * h), (20, 20, 20))
    for i, (p, l) in enumerate(cells): im.paste(tile(p, w, h, l), ((i % cols) * w, (i // cols) * h))
    im.save(out); print(out, im.size)
POSES = ['ak47-hip', 'ak47-ads', 'm4a1-hip', 'm4a1-ads', 'shotgun-hip', 'shotgun-ads', 'pistol-hip', 'pistol-ads', 'sniper-hip', 'sniper-ads', 'knife-hip', 'grenade-hip', 'medkit-hip', 'mp5-hip', 'mp5-ads', 'lmg-hip', 'lmg-ads', 'deagle-hip', 'deagle-ads', 'pbrifle-hip', 'pbrifle-ads']
cells = []
for n in POSES: cells += [(f'{B}/desk-day/{n}.png', 'ÖNCE ' + n), (f'{A}/desk-day/{n}.png', 'SONRA ' + n)]
grid(cells, 4, 480, 270, f'{O}/sheet-before-after.png')
cells = []
for n in POSES: cells += [(f'{A}/desk-night/{n}.png', 'gece ' + n), (f'{A}/mob-day/{n}.png', 'Pixel7 ' + n), (f'{A}/mob-night/{n}.png', 'Pixel7 gece ' + n)]
grid(cells, 6, 400, 225, f'{O}/sheet-night-mobile.png')
EXTRA = ['ak47-sprint', 'L-ak47-hip', 'machete-hip', 'tomahawk-hip', 'claymore-hip', 'ammobox-hip', 'smoke-hip', 'ak47-ads-iron', 'ak47-ads-holo', 'ak47-ads-acog', 'm4a1-ads-iron', 'm4a1-ads-holo', 'm4a1-ads-acog', 'shotgun-ads-iron', 'shotgun-ads-holo', 'pistol-ads-iron']
grid([(f'{A}/desk-day/{n}.png', n) for n in EXTRA], 4, 480, 270, f'{O}/sheet-extra.png')
AN = ['ak-reload', 'shotgun-shell', 'sniper-bolt', 'pistol-reload', 'knife-slash', 'knife-stab', 'grenade-throw', 'ak-sprint2ads', 'sniper-reload', 'ak-inspect']
grid([(f'{A}/anim-{n}-{k}.png', f'{n} {k}') for n in AN for k in range(8)], 8, 320, 180, f'{O}/sheet-anims.png')
grid([(f'{B}/anim-{n}-{k}.png', f'ÖNCE {n} {k}') for n in AN for k in range(8)], 8, 320, 180, f'{O}/sheet-anims-before.png')
TH = ['ak47', 'm4a1', 'shotgun', 'pistol', 'sniper', 'knife']
grid([c for n in TH for c in [(f'{B}/third-{n}.png', 'ÖNCE ' + n), (f'{A}/third-{n}.png', 'SONRA ' + n)]], 4, 480, 270, f'{O}/sheet-third.png')
