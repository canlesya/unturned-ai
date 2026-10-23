# 12.123 önce / sonra tabloları: s3fix.mjs çıktılarından (önce = online HEAD, sonra = bu dal) + menushots sınıf ekranı.
#   python3 scripts/s3fixsheet.py <önce klasörü> <sonra klasörü> <menü önce png> <menü sonra png> <çıktı klasörü>   → fixes.png, items.png
import sys, os
from PIL import Image, ImageDraw, ImageFont
B, A, MB, MA, OUT = sys.argv[1:6]
os.makedirs(OUT, exist_ok=True)
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22); FS = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 17)
except Exception: F = FS = ImageFont.load_default()

def crop(path, box, size):
    im = Image.open(path).convert('RGB'); w, h = im.size
    x0, y0, x1, y1 = [int(v * (w if i % 2 == 0 else h)) for i, v in enumerate(box)]      # oranlı kutu (cihaz pikselinden bağımsız)
    return im.crop((x0, y0, x1, y1)).resize(size, Image.LANCZOS)

def sheet(rows, cols_title, cw, ch, title, out):
    lw, th = 300, 40
    W = lw + cw * len(cols_title); H = th + 30 + ch * len(rows)
    S = Image.new('RGB', (W, H), '#14181e'); d = ImageDraw.Draw(S)
    d.text((12, 8), title, fill='#ffb347', font=F)
    for j, t in enumerate(cols_title): d.text((lw + j * cw + 8, th + 4), t, fill='#cfd6df', font=FS)
    for i, (label, cells) in enumerate(rows):
        y = th + 30 + i * ch
        for k, line in enumerate(label.split('\n')): d.text((10, y + 10 + k * 22), line, fill='#ffffff' if k == 0 else '#9aa4b0', font=F if k == 0 else FS)
        for j, c in enumerate(cells):
            if c is not None: S.paste(c, (lw + j * cw, y))
        d.line((0, y, W, y), fill='#2a3038')
    S.save(out); print(out, S.size)

C = (480, 300)
mid = (0.28, 0.3, 0.72, 0.85)                 # alt-orta (nişan resmi)
ctr = (0.32, 0.22, 0.68, 0.78)                # merkez (dürbün)
hol = (0.34, 0.3, 0.66, 0.85)                 # merkez + alt (halka, telefon)
pair = lambda n, box, dev='desk': [crop(f'{B}/{dev}-{n}.png', box, C), crop(f'{A}/{dev}-{n}.png', box, C)]
rows = [
    ('a) Menü ikonları\nSınıf & Silah kartları (S3 koyu → okunur)', [crop(MB, (0.52, 0.3, 0.97, 0.82), C), crop(MA, (0.52, 0.3, 0.97, 0.82), C)]),
    ('b) Dürbün / ACOG geçişi\nM24 dürbün, nişan %70', pair('scope-sniper-scope-70', ctr)),
    ('b) Dürbün / ACOG geçişi\nM24 dürbün, nişan %82', pair('scope-sniper-scope-82', ctr)),
    ('b) ACOG (M4A1), nişan %70\nopak koyu disk → loş cam + tünel', pair('scope-m4a1-acog-70', ctr)),
    ('b) ACOG (AK-47), nişan %82', pair('scope-ak47-acog-82', ctr)),
    ('c) Telefon holo (Pixel 7)\nM4A1, tam nişan: tek halka', pair('holo-m4a1-holo-100', hol, 'mob')),
    ('c) Telefon red dot (Pixel 7)\nM4A1, tam nişan', pair('holo-m4a1-reddot-100', hol, 'mob')),
    ('e) Nişanda destek kolu\nM4A1 holo, masaüstü', pair('ads-m4a1-holo-100', mid)),
    ('e) AK-47 demir, masaüstü', pair('ads-ak47-iron-100', mid)),
    ('e) M249 holo, Pixel 7', pair('ads-lmg-holo-100', mid, 'mob')),
    ('e) SCAR-H ACOG %70 (geçiş)\nkol sol-aşağı döner', pair('ads-scarh-acog-70', (0.15, 0.4, 0.85, 1.0))),
]
sheet(rows, ['ÖNCE (online 623db09)', 'SONRA (12.123)'], C[0], C[1], 'WarByte 12.123 — düzeltmeler (önce | sonra)', f'{OUT}/fixes.png')

# eşyalar: birinci şahıs (önce / sonra) + üçüncü şahıs (önce / sonra, kaplamalı)
IC = (300, 300)
fp = (0.45, 0.35, 0.95, 1.0)
tp = (0.28, 0.38, 0.66, 0.8)
ids = ['knife', 'machete', 'tomahawk', 'grenade', 'smoke', 'flash', 'claymore', 'ammobox', 'medkit']
tps = ['knife-std', 'knife-gold', 'machete-wood', 'tomahawk-urban', 'grenade', 'smoke', 'flash', 'claymore', 'ammobox']
rows = [
    ('1. şahıs — önce', [crop(f'{B}/desk-items-fp-{i}.png', fp, IC) for i in ids]),
    ('1. şahıs — sonra (S3)', [crop(f'{A}/desk-items-fp-{i}.png', fp, IC) for i in ids]),
    ('1. şahıs — sonra, Pixel 7', [crop(f'{A}/mob-items-fp-{i}.png', fp, IC) for i in ids]),
    ('3. şahıs — önce', [crop(f'{B}/desk-items-tp-{i}.png', tp, IC) for i in tps]),
    ('3. şahıs — sonra (LOD)\nkaplama: altın / orman / şehir', [crop(f'{A}/desk-items-tp-{i}.png', tp, IC) for i in tps]),
]
cols = ['Bıçak', 'Satır', 'Tomahawk', 'El bombası', 'Duman', 'Flaş', 'Claymore', 'Cephane kutusu', 'İlk yardım']
tcols = ['3.ş: bıçak / std', 'bıçak / altın', 'satır / orman', 'tomahawk / şehir', 'el bombası', 'duman', 'flaş', 'claymore', 'cephane']
sheet(rows, cols, IC[0], IC[1], 'WarByte 12.123 — S3 eşyalar (üst 3 satır 1. şahıs, alt 2 satır 3. şahıs: ' + ', '.join(tcols) + ')', f'{OUT}/items.png')
