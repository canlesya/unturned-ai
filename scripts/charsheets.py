# 12.167 Karakter v2 taslak / son sayfaları: charsheets.mjs çıktısını 5 sayfaya toplar.   python3 scripts/charsheets.py /tmp/wb-karakter/taslak
import sys, os
from PIL import Image, ImageDraw, ImageFont

D = sys.argv[1] if len(sys.argv) > 1 else '/tmp/wb-karakter/taslak'
def im(n): return Image.open(os.path.join(D, n + '.png')).convert('RGB')
try:
    F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 30); f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 20)
except Exception:
    F = f = ImageFont.load_default()

def stack(parts, gap=8, bg=(16, 18, 23)):
    W = max(p.width for p in parts); H = sum(p.height for p in parts) + gap * (len(parts) - 1)
    out = Image.new('RGB', (W, H), bg); y = 0
    for p in parts: out.paste(p, ((W - p.width) // 2, y)); y += p.height + gap
    return out

def band(img, title, y0, y1, scale=1.0):
    c = img.crop((0, y0, img.width, y1))
    if scale != 1: c = c.resize((int(c.width * scale), int(c.height * scale)), Image.LANCZOS)
    hdr = Image.new('RGB', (c.width, 44), (16, 18, 23)); ImageDraw.Draw(hdr).text((16, 6), title, font=F, fill=(255, 255, 255))
    return stack([hdr, c], gap=0)

# 1 karakter sayfaları
im('bodyA').save(os.path.join(D, '1a_karakter_A.png')); im('bodyB').save(os.path.join(D, '1b_karakter_B.png'))
# 2 kıyafet yuvaları
S = [('KAFA', 'slot_s_head', 250, 620), ('ÜST', 'slot_s_top', 250, 800), ('SIRT', 'slot_s_back', 210, 720), ('PANTOLON', 'slot_s_legs', 120, 760), ('AYAKKABI', 'slot_s_feet', 220, 600)]
stack([band(im(n), t, a, b, 0.75) for t, n, a, b in S]).save(os.path.join(D, '2_kiyafet_yuvalari.png'))
# 3 ışıklı set
im('glow').save(os.path.join(D, '3_isikli_set.png'))
# 4 kombinler + paletler
stack([im('combos').crop((0, 0, 1600, 760)), im('pal').crop((0, 0, 1600, 640))]).save(os.path.join(D, '4_kombinler_paletler.png'))
# 5 karşılaştırma + okunurluk (30 / 40 m: oyuncunun gördüğü boy, ×3 büyütülmüş kırpım)
far = []
for d in (30, 40):
    a = im(f'far_d_{d}'); w = a.width
    c = a.crop((0, 400, w, 500)).resize((w, 300), Image.NEAREST)
    hdr = Image.new('RGB', (w, 40), (16, 18, 23)); ImageDraw.Draw(hdr).text((16, 6), f'{d} m · FOV 72 · ekrandaki boy ×3 (soldan: Standart, Çöl, Orman, Şehir, Kar, Altın, Gece; her çiftte Mavi + Kırmızı)', font=f, fill=(255, 255, 255))
    far += [hdr, c]
stack([im('compare').crop((0, 0, 1600, 720))] + far).save(os.path.join(D, '5_karsilastirma.png'))
print('ok', D)
