# Nişangâh montajları (12.139) — scripts/opticaudit.mjs karelerinden.
#   Tarama:     python3 scripts/opticsheet.py audit <kare klasörü> <çıktı önek> [dev=desk] [satır/sayfa=16]
#               satır = silah:nişangâh; sütun = bel | %50 | %70 | %100 | %100 merkez (2× yakın)
#   Önce/sonra: python3 scripts/opticsheet.py ba <önce klasörü> <sonra klasörü> <çıktı.png> <dev> silah:nişangâh ...
#               sütun = önce %100 | sonra %100 | önce %70 | sonra %70 (+ merkez 2× yakın: önce | sonra)
import sys, os, re
from PIL import Image, ImageDraw, ImageFont

CW, CH = 400, 225
try: FONT = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 15)
except Exception: FONT = ImageFont.load_default()

def cell(path, crop=False):
    if not os.path.exists(path):
        im = Image.new('RGB', (CW, CH), (60, 0, 0)); ImageDraw.Draw(im).text((10, 10), 'yok', fill='white', font=FONT); return im
    im = Image.open(path).convert('RGB'); W, H = im.size
    if crop: im = im.crop((W // 4, H // 4, W * 3 // 4, H * 3 // 4))
    return im.resize((CW, CH), Image.LANCZOS)

def sheet(rows, cols, out, head):
    LW = 150
    img = Image.new('RGB', (LW + CW * len(cols), 24 + CH * len(rows)), (24, 24, 28)); d = ImageDraw.Draw(img)
    for j, c in enumerate(head): d.text((LW + j * CW + 6, 4), c, fill='white', font=FONT)
    for i, (label, cells) in enumerate(rows):
        d.text((6, 24 + i * CH + CH // 2 - 8), label, fill='white', font=FONT)
        for j, (p, crop) in enumerate(cells): img.paste(cell(p, crop), (LW + j * CW, 24 + i * CH))
    img.save(out); print(out, img.size)

if sys.argv[1] == 'audit':
    src, pre = sys.argv[2], sys.argv[3]; dev = sys.argv[4] if len(sys.argv) > 4 else 'desk'; per = int(sys.argv[5]) if len(sys.argv) > 5 else 16
    combos = []
    for f in sorted(os.listdir(src)):
        m = re.match(rf'^{dev}-(.+)-(\w+)-100\.png$', f)
        if m: combos.append((m.group(1), m.group(2)))
    for k in range(0, len(combos), per):
        rows = [(f'{i}:{o}', [(f'{src}/{dev}-{i}-{o}-{t}.png', False) for t in (0, 50, 70, 100)] + [(f'{src}/{dev}-{i}-{o}-100.png', True)]) for i, o in combos[k:k + per]]
        sheet(rows, range(5), f'{pre}-{dev}-{k // per + 1}.png', ['bel', '%50', '%70', '%100', '%100 merkez 2x'])
elif sys.argv[1] == 'ba':
    a, b, out, dev = sys.argv[2:6]
    rows = []
    for c in sys.argv[6:]:
        i, o = c.split(':')
        f = lambda s, t: f'{s}/{dev}-{i}-{o}-{t}.png'
        rows.append((f'{dev} {i}:{o}', [(f(a, 100), False), (f(b, 100), False), (f(a, 70), False), (f(b, 70), False), (f(a, 100), True), (f(b, 100), True)]))
    sheet(rows, range(6), out, ['önce %100', 'sonra %100', 'önce %70', 'sonra %70', 'önce merkez 2x', 'sonra merkez 2x'])
elif sys.argv[1] == 'crop':
    # Yakın inceleme: python3 scripts/opticsheet.py crop <klasör> <çıktı önek> <dev> [kombinasyon/sayfa=8]  — merkez kesiti (ekranın %40 × %62'si), %70 | %100 yan yana
    src, pre, dev = sys.argv[2:5]; per = int(sys.argv[5]) if len(sys.argv) > 5 else 8
    combos = sorted({(m.group(1), m.group(2)) for f in os.listdir(src) for m in [re.match(rf'^{dev}-(.+)-(\w+)-100\.png$', f)] if m})
    def cc(p):
        im = Image.open(p).convert('RGB'); W, H = im.size; w, h = int(W * 0.4), int(H * 0.62)
        im = im.crop((W // 2 - w // 2, H // 2 - int(h * 0.42), W // 2 + w // 2, H // 2 + int(h * 0.58)))
        return im.resize((480, int(480 * h / w)), Image.LANCZOS)
    for k in range(0, len(combos), per):
        tiles = []
        for i, o in combos[k:k + per]:
            for t in (70, 100):
                p = f'{src}/{dev}-{i}-{o}-{t}.png'
                if os.path.exists(p): im = cc(p); ImageDraw.Draw(im).text((6, 4), f'{i}:{o} %{t}', fill='yellow', font=FONT); tiles.append(im)
        tw, th = tiles[0].size; cols = 4; rows = (len(tiles) + cols - 1) // cols
        img = Image.new('RGB', (tw * cols, th * rows), (24, 24, 28))
        for j, t in enumerate(tiles): img.paste(t, ((j % cols) * tw, (j // cols) * th))
        out = f'{pre}-{dev}-{k // per + 1}.png'; img.save(out); print(out, img.size)
