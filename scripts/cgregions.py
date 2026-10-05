# Tarama kareleri → bölge gruplu kontak sayfaları: screenshots/sweep/reg_<bölge>_<n>.png  (sayfa başına 2 nokta × 4 yön, her kare 480×270)
# Kullanım: python scripts/cgregions.py     (önce node scripts/cgsweep.mjs)
import json
from PIL import Image, ImageDraw
m = json.load(open('screenshots/sweep/manifest.json', encoding='utf-8'))
yaws = m['yaws']; pts = m['pts']
names = {0: 'K(kuzey -z)', 90: 'B(bati -x)', 180: 'G(guney +z)', -90: 'D(dogu +x)'}
REG = {
    'A':   lambda p: p['x'] > 18 and p['z'] < -12,                  # A sahası, Short köprüsü, CT doğu, Ramp
    'B':   lambda p: p['x'] < -18 and p['z'] < -12,                 # B sahası, Window, B Doors, Upper Tunnels kuzey
    'MID': lambda p: -18 <= p['x'] <= 18 and p['z'] <= 30,          # Mid, CT Spawn, Xbox, catwalk, Lower Tunnels, Mid Doors
    'TLONG': lambda p: not ((p['x'] > 18 and p['z'] < -12) or (p['x'] < -18 and p['z'] < -12) or (-18 <= p['x'] <= 18 and p['z'] <= 30)),   # T tarafı, Long, Pit, Outside Tunnels
}
W, H = 480, 270
out = {}
for rn, f in REG.items():
    sel = [p for p in pts if f(p)]
    files = []
    for g0 in range(0, len(sel), 2):
        grp = sel[g0:g0 + 2]
        sh = Image.new('RGB', (W * 2 * len(grp), H * 2), (20, 20, 20))
        for n, p in enumerate(grp):
            for k, yw in enumerate(yaws[:4]):
                try: im = Image.open(f'screenshots/sweep/f_{p["i"]}_{k}.png').resize((W, H))
                except FileNotFoundError: continue
                ox = n * W * 2 + (k % 2) * W; oy = (k // 2) * H
                sh.paste(im, (ox, oy)); d = ImageDraw.Draw(sh); d.rectangle([ox, oy, ox + 300, oy + 14], fill=(0, 0, 0))
                d.text((ox + 3, oy + 1), f'#{p["i"]} x{p["x"]} z{p["z"]} y{p["y"]} {p["callout"]} bakis:{names.get(yw, yw)}', fill=(255, 255, 0))
        fn = f'screenshots/sweep/reg_{rn}_{g0 // 2:02d}.png'
        sh.save(fn); files.append(fn)
    out[rn] = files
    print(rn, len(sel), 'nokta', len(files), 'sayfa')
json.dump(out, open('screenshots/sweep/regions.json', 'w'))
