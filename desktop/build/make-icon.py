# Masaüstü uygulama simgesi (icon.png 1024 · icon.ico · icon.icns): koyu zemin, "W" beyaz + "B" turuncu (menü logosu WAR·BYTE renkleri).
# Bir kez çalıştırılır, çıktılar depoya girer: python3 desktop/build/make-icon.py  (macOS: iconutil ile .icns)
import os, subprocess, shutil
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
S = 1024
FONT = next((f for f in ['/System/Library/Fonts/Supplemental/Arial Black.ttf', '/System/Library/Fonts/Supplemental/Impact.ttf'] if os.path.exists(f)), None)

img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([40, 40, S - 40, S - 40], radius=200, fill=(7, 10, 16, 255), outline=(255, 138, 31, 255), width=22)
font = ImageFont.truetype(FONT, 470) if FONT else ImageFont.load_default()
w1 = d.textlength('W', font=font); w2 = d.textlength('B', font=font)
x = (S - (w1 + w2 + 16)) / 2
d.text((x, S / 2), 'W', font=font, fill=(255, 255, 255, 255), anchor='lm')
d.text((x + w1 + 16, S / 2), 'B', font=font, fill=(255, 138, 31, 255), anchor='lm')
img.save(os.path.join(HERE, 'icon.png'))
img.save(os.path.join(HERE, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

if shutil.which('iconutil'):
    ics = os.path.join(HERE, 'icon.iconset'); os.makedirs(ics, exist_ok=True)
    for n in [16, 32, 128, 256, 512]:
        img.resize((n, n), Image.LANCZOS).save(os.path.join(ics, f'icon_{n}x{n}.png'))
        img.resize((n * 2, n * 2), Image.LANCZOS).save(os.path.join(ics, f'icon_{n}x{n}@2x.png'))
    subprocess.run(['iconutil', '-c', 'icns', ics, '-o', os.path.join(HERE, 'icon.icns')], check=True)
    shutil.rmtree(ics)
print('simge yazıldı:', HERE)
