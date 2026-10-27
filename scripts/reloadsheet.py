# 12.195 Yükleme kare şeridi tablosu: reloadstrip.mjs çıktısından silah başına şerit (önce üstte / sonra altta) + genel tablo.
#   python3 scripts/reloadsheet.py <önce klasörü|-> <sonra klasörü> <çıktı klasörü> [ilk silahlar virgülle]
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
bef, aft, out = sys.argv[1], sys.argv[2], sys.argv[3]
first = sys.argv[4].split(',') if len(sys.argv) > 4 else ['p90']
os.makedirs(out, exist_ok=True)
M = json.load(open(os.path.join(aft, 'meta.json')))
N = M['N']; W, H = 288, 162          # kare (1280×720 → kırpılmış sağ alt 2/3)
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 15); FS = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 12)
except Exception: F = FS = ImageFont.load_default()
def frame(d, tag, i):
    p = os.path.join(d, f'{tag}-{i}.png')
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGB'); w, h = im.size
    im = im.crop((int(w * 0.18), int(h * 0.22), w, h))       # silah + eller (sağ alt) büyük görünsün
    return im.resize((W, H), Image.LANCZOS)
def row(d, tag, total, label):
    r = Image.new('RGB', (130 + N * W, H), (24, 26, 30)); dr = ImageDraw.Draw(r)
    dr.text((8, 8), label, fill=(255, 220, 120), font=F); dr.text((8, 30), tag, fill=(220, 220, 220), font=FS); dr.text((8, 48), f'{total:.2f} sn', fill=(180, 180, 180), font=FS)
    for i in range(N):
        im = frame(d, tag, i)
        if im: r.paste(im, (130 + i * W, 0))
        dr.text((134 + i * W, H - 18), f'{i / (N - 1) * total:.2f}s', fill=(255, 255, 255), font=FS)
    return r
order = sorted(M['meta'], key=lambda m: (m['id'] not in first, first.index(m['id']) if m['id'] in first else 0))
ids = []
for m in order:
    if m['id'] not in ids: ids.append(m['id'])
strips = []
for wid in ids:
    rows = []
    for m in [x for x in order if x['id'] == wid]:
        kind = 'boş' if m['empty'] else 'taktik'
        if bef != '-' and os.path.exists(os.path.join(bef, f"{m['tag']}-0.png")): rows.append(row(bef, m['tag'], m['total'], f'ÖNCE · {kind}'))
        rows.append(row(aft, m['tag'], m['total'], f'SONRA · {kind}'))
    s = Image.new('RGB', (rows[0].width, sum(r.height + 4 for r in rows)), (10, 10, 12)); y = 0
    for r in rows: s.paste(r, (0, y)); y += r.height + 4
    s.save(os.path.join(out, f'strip-{wid}.jpg'), quality=85); strips.append(s)
# genel tablo: küçültülmüş şeritler alt alta (P90 başta)
sc = 0.5
tw = int(strips[0].width * sc)
tot = Image.new('RGB', (tw, sum(int(s.height * sc) + 6 for s in strips)), (0, 0, 0)); y = 0
for s in strips:
    t = s.resize((tw, int(s.height * sc)), Image.LANCZOS); tot.paste(t, (0, y)); y += t.height + 6
tot.save(os.path.join(out, 'tablo.jpg'), quality=82)
print('tablo', tot.size, len(strips), 'şerit')
