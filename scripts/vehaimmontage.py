# 12.201 araç nişanı önce / sonra tablosu: python3 scripts/vehaimmontage.py [kök=/tmp/wb-vaim]
# kök/once/*.png ve kök/sonra/*.png (scripts/vehaim.mjs çıktıları) → kök/tablo.jpg (+ tablo-2.jpg)
import sys, os
from PIL import Image, ImageDraw, ImageFont
R = sys.argv[1] if len(sys.argv) > 1 else '/tmp/wb-vaim'
ROWS = [
  ('02-heli-pilot-sagtik', 'Helikopter pilotu · sağ tık'),
  ('03y-heli-burun-asagi-ates-yandan', 'Heli asılı, burun aşağı ateş (yandan)'),
  ('03k-heli-kokpit-burun-asagi-ates', 'Heli kokpit, burun aşağı ateş'),
  ('04-heli-roket-asagi', 'Heli roket (önce sağ tık, sonra orta tık / Q)'),
  ('06-heli-kapi-asagi', 'Kapı nişancısı dik aşağı'),
  ('09-tank-surucu-sagtik', 'Tank sürücüsü · sağ tık (takip)'),
  ('10-tank-durbun-sagtik', 'Tank dürbünü · sağ tık'),
  ('11-tank-nisanci-sagtik', 'Tank makinelisi · sağ tık'),
  ('12-jip-makineli-sagtik', 'Jip makinelisi · sağ tık'),
  ('13-jip-yolcu-sagtik', 'Jip arka yolcusu · sağ tık (kendi silahı)'),
  ('20-telefon-heli-nisan', 'Telefon · pilot NİŞAN düğmesi'),
]
W, H, LBL = 640, 360, 30
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 18)
except Exception: F = ImageFont.load_default()
def sheet(rows, out):
  im = Image.new('RGB', (W * 2 + 12, (H + LBL) * len(rows) + 40), (18, 20, 24)); d = ImageDraw.Draw(im)
  d.text((10, 10), 'ÖNCE', fill=(255, 140, 120), font=F); d.text((W + 22, 10), 'SONRA (12.201)', fill=(140, 255, 170), font=F)
  for i, (n, lbl) in enumerate(rows):
    y = 40 + i * (H + LBL); d.text((10, y + 5), lbl, fill=(235, 235, 235), font=F)
    for j, k in enumerate(['once', 'sonra']):
      p = f'{R}/{k}/{n}.png'
      if os.path.exists(p):
        t = Image.open(p).convert('RGB'); t.thumbnail((W, H)); im.paste(t, (j * (W + 12), y + LBL))
      else: d.text((j * (W + 12) + 20, y + LBL + 20), '(yok)', fill=(150, 150, 150), font=F)
  im.save(out, quality=86); print(out)
h = (len(ROWS) + 1) // 2
sheet(ROWS[:h], f'{R}/tablo.jpg'); sheet(ROWS[h:], f'{R}/tablo-2.jpg')
