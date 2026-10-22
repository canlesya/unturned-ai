# Silah laboratuvarı FP tablosu: satırlar S1 / S2 / S3 / mevcut × sütunlar AK, M4, Glock, M24 (bel)  →  python3 scripts/weaponlabsheet.py [kök=/tmp/wb-wlab]
import sys
from PIL import Image, ImageDraw, ImageFont
R = sys.argv[1] if len(sys.argv) > 1 else '/tmp/wb-wlab'
rows = [('s1', 'S1 Sade'), ('s2', 'S2 Orta'), ('s3', 'S3 BattleBit'), ('cur', 'Mevcut oyun')]
cols = [('ak47', 'AK-47'), ('m4a1', 'M4A1'), ('pistol', 'Glock 17'), ('sniper', 'M24')]
W, H, LW, TH = 800, 450, 170, 40
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 24)
except Exception: font = ImageFont.load_default()
sheet = Image.new('RGB', (LW + W * len(cols), TH + H * len(rows)), '#111317')
d = ImageDraw.Draw(sheet)
for c, (_, cn) in enumerate(cols): d.text((LW + c * W + W // 2 - 50, 8), cn, fill='#ffffff', font=font)
for r, (rk, rn) in enumerate(rows):
    d.text((10, TH + r * H + H // 2 - 12), rn, fill='#ffffff', font=font)
    for c, (ck, _) in enumerate(cols):
        im = Image.open(f'{R}/fp/{rk}-{ck}.png').convert('RGB').resize((W, H))
        sheet.paste(im, (LW + c * W, TH + r * H))
sheet.save(f'{R}/sheet-fp.png')
print('ok', sheet.size)
