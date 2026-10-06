# önce | sonra karşılaştırma tabloları.  python scripts/cgmontage.py once_klasoru sonra_klasoru cikti_oneki "ad:Başlık" "ad:Başlık" ...
import sys, os
from PIL import Image, ImageDraw, ImageFont
a, b, out = sys.argv[1], sys.argv[2], sys.argv[3]
items = [x.split(':', 1) for x in sys.argv[4:]]
W = 620
try: font = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 20)
except Exception: font = ImageFont.load_default()
def sheet(chunk, name):
    rows = []
    for fn, title in chunk:
        ia, ib = Image.open(os.path.join(a, fn + '.png')).convert('RGB'), Image.open(os.path.join(b, fn + '.png')).convert('RGB')
        h = int(ia.height * W / ia.width); ia, ib = ia.resize((W, h)), ib.resize((W, h))
        row = Image.new('RGB', (W * 2 + 6, h + 34), (18, 20, 26)); row.paste(ia, (0, 34)); row.paste(ib, (W + 6, 34))
        d = ImageDraw.Draw(row); d.text((8, 5), 'ÖNCE', fill=(255, 140, 90), font=font); d.text((W + 14, 5), 'SONRA — ' + title, fill=(130, 230, 150), font=font)
        rows.append(row)
    H = sum(r.height for r in rows) + 6 * (len(rows) - 1)
    img = Image.new('RGB', (W * 2 + 6, H), (18, 20, 26)); y = 0
    for r in rows: img.paste(r, (0, y)); y += r.height + 6
    img.save(name); print(name)
per = 3
for i in range(0, len(items), per): sheet(items[i:i + per], f'{out}-{i // per + 1}.png')
