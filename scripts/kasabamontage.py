# Kasaba önce / sonra tablosu:  python3 scripts/kasabamontage.py ÖNCE_DİZİNİ SONRA_DİZİNİ çıktı.png [profil-gün]
# Her satır: aynı bakış noktası, solda eski harita, sağda yeni harita. VIEWS=19,25 (bakış seçimi), LA / LB (sütun başlıkları) ortam değişkenleri.
import sys, os
from PIL import Image, ImageDraw, ImageFont
A, B, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
P = sys.argv[4] if len(sys.argv) > 4 else 'desktop-day'
VIEWS = [v for v in os.environ['VIEWS'].split(',')] if os.environ.get('VIEWS') else ['00-kusbakisi', '03-evler', '06-kilise', '01-mavi-avlu', '05-belediye', '13-benzinlik', '14-pazar', '18-orta-cadde', '19-ev-ici', '21-okul-cati', '22-kilise-ici', '24-su-kulesi-ustu']
W, H = 560, 315
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 18)
except Exception: F = ImageFont.load_default()
rows = [v for v in VIEWS if os.path.exists(f'{A}/{P}-{v}.png') and os.path.exists(f'{B}/{P}-{v}.png')]
img = Image.new('RGB', (W * 2 + 12, (H + 6) * len(rows) + 40), (24, 26, 30))
d = ImageDraw.Draw(img)
d.text((W // 2 - 40, 10), os.environ.get('LA', 'ÖNCE (v2)'), fill=(240, 200, 120), font=F); d.text((W + 12 + W // 2 - 60, 10), os.environ.get('LB', 'SONRA (v3, 12.168)'), fill=(140, 220, 140), font=F)
for i, v in enumerate(rows):
    y = 40 + i * (H + 6)
    for j, D in enumerate([A, B]):
        im = Image.open(f'{D}/{P}-{v}.png').convert('RGB').resize((W, H))
        img.paste(im, (j * (W + 12), y))
    d.text((8, y + 6), v, fill=(255, 255, 255), font=F, stroke_width=2, stroke_fill=(0, 0, 0))
img.save(OUT); print('yazıldı', OUT, img.size, len(rows), 'satır')
