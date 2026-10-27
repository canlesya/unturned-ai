# 12.188 araç HUD'u önce / sonra tablosu: python3 scripts/vehhudmontage.py [/tmp/wb-qa6/hud]  → <kök>/tablo.jpg (her satır: önce | sonra)
import sys, os
from PIL import Image, ImageDraw
root = sys.argv[1] if len(sys.argv) > 1 else '/tmp/wb-qa6/hud'
A, B = os.path.join(root, 'once'), os.path.join(root, 'sonra')
names = sorted(f for f in os.listdir(B) if f.endswith('.png'))
W, H = 640, 360
out = Image.new('RGB', (W * 2, H * len(names)), 'black')
d = ImageDraw.Draw(out)
for i, n in enumerate(names):
    for k, (dirp, lbl) in enumerate([(A, 'ÖNCE'), (B, 'SONRA')]):
        p = os.path.join(dirp, n)
        if os.path.exists(p):
            im = Image.open(p).convert('RGB'); im.thumbnail((W, H)); out.paste(im, (k * W, i * H))
        d.rectangle([k * W, i * H, k * W + 300, i * H + 18], fill=(0, 0, 0))
        d.text((k * W + 4, i * H + 3), f'{lbl} · {n[:-4]}', fill=(255, 200, 120))
out.save(os.path.join(root, 'tablo.jpg'), quality=78)
print(os.path.join(root, 'tablo.jpg'), len(names))
