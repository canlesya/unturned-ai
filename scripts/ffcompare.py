# Firefox ↔ Chromium ekran görüntüleri: yan yana tablo + fark istatistiği (ortalama mutlak fark, kanal ortalamaları, keskinlik = Laplace varyansı)
#   python3 scripts/ffcompare.py /tmp/wb-ff/<etiket>   → <etiket>/yanyana-<ad>.png ve stdout tablo
import sys, os, glob
import numpy as np
from PIL import Image, ImageDraw
d = sys.argv[1]
def sharp(a):
    g = a.mean(axis=2)
    lap = g[1:-1, 1:-1] * 4 - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    return lap.var()
for ff in sorted(glob.glob(os.path.join(d, 'firefox-*.png'))):
    base = os.path.basename(ff)[len('firefox-'):]
    ch = os.path.join(d, 'chromium-' + base)
    if not os.path.exists(ch): continue
    A = Image.open(ff).convert('RGB'); B = Image.open(ch).convert('RGB')
    if A.size != B.size: B = B.resize(A.size)
    a = np.asarray(A, dtype=np.float32); b = np.asarray(B, dtype=np.float32)
    diff = np.abs(a - b)
    print(f"{base:22s} ort.fark {diff.mean():5.2f}  >24 piksel %{(diff.max(axis=2) > 24).mean() * 100:5.1f}  FF rgb {a.reshape(-1, 3).mean(0).round(1)}  CR rgb {b.reshape(-1, 3).mean(0).round(1)}  keskinlik FF {sharp(a):7.1f} CR {sharp(b):7.1f}")
    w, h = A.size; s = 1200 / w
    sa, sb = A.resize((int(w * s), int(h * s))), B.resize((int(w * s), int(h * s)))
    out = Image.new('RGB', (sa.width * 2 + 8, sa.height + 28), (20, 20, 20))
    out.paste(sa, (0, 28)); out.paste(sb, (sa.width + 8, 28))
    dr = ImageDraw.Draw(out); dr.text((8, 8), 'Firefox  ' + base, fill=(255, 200, 80)); dr.text((sa.width + 16, 8), 'Chromium  ' + base, fill=(120, 200, 255))
    out.save(os.path.join(d, 'yanyana-' + base))
