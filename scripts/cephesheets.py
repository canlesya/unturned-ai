# Cephe modu görsel sayfaları (silah / karakter): python3 scripts/cephesheets.py <lab klasörü> <fp klasörü> <fp kırmızı klasörü> <çıktı klasörü>
# lab: cephelab.mjs çıktısı (silahlar-yandan, ordular, siniflar) · fp: frontfp.mjs çıktısı (<id>-bel / -nisan / -doldurma)
import sys, os
from PIL import Image, ImageDraw, ImageFont
LAB, FP, FPR, OUT = (sys.argv[1:5] + ['/tmp/wb-cephe/dev', '/tmp/wb-cephe/dev/fp', '/tmp/wb-cephe/dev/fpr', '/tmp/wb-cephe/taslak'])[:4] if len(sys.argv) < 5 else sys.argv[1:5]
os.makedirs(OUT, exist_ok=True)
FB = '/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf'
f = lambda n: ImageFont.truetype(FB, n)
NAMES = {'ww_bolt': 'Sürgülü Tüfek', 'ww_semi': 'Yarı Otomatik Tüfek', 'ww_smgb': 'Kundaklı HMK (Mavi)', 'ww_smgr': 'Katlanır HMK (Kırmızı)', 'ww_lmg': 'Hafif Makineli Tüfek', 'ww_sniper': 'Dürbünlü Tüfek', 'ww_pistol': 'Tabanca', 'ww_nade': 'Saplı El Bombası'}

def tile(path, w, h, label):
    im = Image.open(path).convert('RGB').resize((w, h), Image.LANCZOS)
    d = ImageDraw.Draw(im, 'RGBA')
    d.rectangle([0, h - 30, w, h], fill=(10, 12, 14, 190))
    d.text((10, h - 26), label, font=f(19), fill=(240, 236, 224))
    return im

def sheet_weapons():
    side = Image.open(f'{LAB}/silahlar-yandan.png').convert('RGB')
    W = side.width
    tw, th, cols = W // 4, int(W // 4 * 9 / 16), 4
    sec1 = [(FPR, 'ww_bolt', 'bel', 'Sürgülü Tüfek (Kırmızı kolu)'), (FP, 'ww_semi', 'bel', 'Yarı Otomatik Tüfek (Mavi)'), (FP, 'ww_smgb', 'bel', 'Kundaklı HMK (Mavi)'), (FPR, 'ww_smgr', 'bel', 'Katlanır HMK (Kırmızı)'),
            (FP, 'ww_lmg', 'bel', 'Hafif Makineli Tüfek (Mavi)'), (FPR, 'ww_mg', 'bel', 'Ağır Makineli (Kırmızı)'), (FP, 'ww_sniper', 'bel', 'Dürbünlü Tüfek'), (FP, 'ww_pistol', 'bel', 'Tabanca'),
            (FP, 'ww_nade', 'bel', 'Saplı El Bombası'), (FP, 'ww_semi', 'doldurma', 'Yarı Otomatik · en-bloc klips'), (FPR, 'ww_bolt', 'doldurma', 'Sürgülü · şerit klips'), (FPR, 'ww_mg', 'doldurma', 'Ağır Makineli · tambur')]
    sec2 = [(FPR, 'ww_bolt', 'nisan', 'Sürgülü · gez-arpacık'), (FP, 'ww_semi', 'nisan', 'Yarı Otomatik · dioptri'), (FP, 'ww_smgb', 'nisan', 'Kundaklı HMK'), (FPR, 'ww_smgr', 'nisan', 'Katlanır HMK'),
            (FP, 'ww_lmg', 'nisan', 'Hafif Makineli Tüfek'), (FPR, 'ww_mg', 'nisan', 'Ağır Makineli'), (FP, 'ww_sniper', 'nisan', 'Dürbünlü · 4× eski tip'), (FP, 'ww_pistol', 'nisan', 'Tabanca')]
    out = Image.new('RGB', (W, side.height + 100 + 5 * th), (22, 24, 25))
    out.paste(side, (0, 0))
    d = ImageDraw.Draw(out)
    y = side.height + 10
    d.text((24, y), 'BİRİNCİ ŞAHIS · BEL + DOLDURMA (oyun içi, Batı Cephesi; koyu deri eldiven, ceket kolu)', font=f(24), fill=(232, 228, 216)); y += 40
    for i, (D, id_, k, lab) in enumerate(sec1):
        out.paste(tile(f'{D}/{id_}-{k}.png', tw, th, lab), ((i % cols) * tw, y + (i // cols) * th))
    y += 3 * th + 10
    d.text((24, y), 'NİŞAN (demir gez-arpacık hizası ≤ 0,5 px, dürbün)', font=f(24), fill=(232, 228, 216)); y += 40
    for i, (D, id_, k, lab) in enumerate(sec2):
        out.paste(tile(f'{D}/{id_}-{k}.png', tw, th, lab), ((i % cols) * tw, y + (i // cols) * th))
    out = out.crop((0, 0, W, y + 2 * th))
    out.save(f'{OUT}/a-silahlar.png'); print('a-silahlar.png', out.size)

def sheet_chars():
    a = Image.open(f'{LAB}/ordular.png').convert('RGB'); b = Image.open(f'{LAB}/siniflar.png').convert('RGB')
    W = a.width
    tw, th = W // 2, int(W // 2 * 9 / 16)
    crop = lambda im: im.crop((0, int(im.height * 0.3), im.width, int(im.height * 0.78)))
    a2, b2 = crop(a), crop(b)
    out = Image.new('RGB', (W, 70 + a2.height + 50 + b2.height + 50 + th), (22, 24, 25))
    d = ImageDraw.Draw(out)
    d.text((24, 14), 'CEPHE · İKİ ORDU', font=f(32), fill=(240, 236, 224))
    d.text((24, 50), 'Mavi: yeşil-haki ceket + yuvarlak çelik miğfer + kanvas tozluk · Kırmızı: gri ceket + kenarlı çelik miğfer + uzun çizme · nişan / sembol / bayrak yok, takım = kol bandı', font=f(17), fill=(200, 200, 190))
    y = 78
    out.paste(a2, (0, y)); y += a2.height + 8
    d.text((24, y), 'SINIFLAR (sıhhiye · keskin nişancı · ağır destek · istihkam)', font=f(22), fill=(232, 228, 216)); y += 38
    out.paste(b2, (0, y)); y += b2.height + 8
    d.text((24, y), 'BİRİNCİ ŞAHIS KOL (üniforma renginde kol + koyu deri eldiven; takım kol bandı 3. şahısta)', font=f(22), fill=(232, 228, 216)); y += 38
    out = out.crop((0, 0, W, y + th))
    out.paste(tile(f'{FP}/ww_semi-bel.png', tw, th, 'Mavi · Yarı Otomatik Tüfek'), (0, y))
    out.paste(tile(f'{FPR}/ww_bolt-bel.png', tw, th, 'Kırmızı · Sürgülü Tüfek'), (tw, y))
    out.save(f'{OUT}/b-karakterler.png'); print('b-karakterler.png', out.size)

sheet_weapons(); sheet_chars()
