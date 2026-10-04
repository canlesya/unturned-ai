# Dust 2 radar görselinden (tools_ref/dust2_radar_ref.png) "Çöl Geçidi" için yapı verisini çıkarır → src/maps/colgecidiData.js
# Çıktı: duvar dikdörtgenleri, kutu/araç nesneleri, 1 m'lik yükseklik ızgarası, bölge dikdörtgenleri (doğuş / hedef).
# Yön: radar saat yönünde 90° döndürülür → T (güney) = Batı (-x), CT (kuzey) = Doğu (+x); A sahası güneydoğu, B sahası kuzeydoğu.
import numpy as np, json, base64, sys
from PIL import Image
from scipy import ndimage as ndi

SCALE = 1.3                      # radar pikseli = 4.4 hu = 0.11 m; oyun hızı CS'ten yavaş → harita 1.3× büyütülür
S = 0.11 * SCALE                 # m / piksel
CELL = 0.5                       # duvar ızgarası (m)
HCELL = 1.0                      # yükseklik ızgarası (m)
SOLID_BAND = 4                   # dış duvar kalınlığı (hücre) = 2 m

im = np.array(Image.open('tools_ref/dust2_radar_ref.png').convert('RGBA')).astype(int)[14:1005, 54:974]
a = im[..., 3]; rgb = im[..., :3]
sat = rgb.max(-1) - rgb.min(-1); lum = rgb.mean(-1)
void = a < 128
gray = (~void) & (sat < 15)
wall = gray & (lum < 100)
box = (~void) & (sat < 10) & (lum >= 118)          # sandık / araç: düz açık gri (zemin tonu değil)
orange = (~void) & (rgb[..., 0] > 170) & (rgb[..., 1] > 70) & (rgb[..., 1] < 130) & (rgb[..., 2] < 60)
green = (~void) & (rgb[..., 1] > 150) & (rgb[..., 0] < 90) & (rgb[..., 2] < 100) & ((rgb[..., 1] - rgb[..., 0]) > 100)
floor = (~void) & (~gray) & (~orange) & (~green)

def rot(x): return np.rot90(x, k=-1)           # saat yönü
void, wall, box, floor, orange, green = map(rot, (void, wall, box, floor, orange, green))
# kısa çizgiler (basamak / taralı bölge deseni) duvar sayılmaz: yalnızca boşluğa değen ya da uzun (>= 8 m) çizgiler kalır
_lab, _n = ndi.label(wall, structure=np.ones((3, 3)))
_near_void = ndi.binary_dilation(void, iterations=3)
_keep = np.zeros(_n + 1, bool)
for _i, _sl in enumerate(ndi.find_objects(_lab), start=1):
    _m = _lab[_sl] == _i
    _h, _w = _m.shape
    _touch = (_m & _near_void[_sl]).any()
    _long = np.hypot(_h, _w) * S >= 8.0
    _keep[_i] = (_touch and _m.sum() >= 25) or _long
lowpx = np.zeros_like(wall)
for _i, _sl in enumerate(ndi.find_objects(_lab), start=1):
    if not _keep[_i] and (_lab[_sl] == _i).sum() >= 25:
        lowpx[_sl] |= (_lab[_sl] == _i)                 # içerideki kısa koyu parçalar: alçak duvar / küpeşte
wall = _keep[_lab] & wall
# taralı CT alım bölgesinin içi: desen çizgileri yürünebilir zemindir
_gl, _gn = ndi.label(ndi.binary_dilation(green, iterations=7))
for _i, _sl in enumerate(ndi.find_objects(_gl), start=1):
    _y, _x = _sl
    if min(_y.stop - _y.start, _x.stop - _x.start) > 40 and max(_y.stop - _y.start, _x.stop - _x.start) > 70:
        wall[_sl] &= _near_void[_sl]

score = rot(rgb[..., 0] - rgb[..., 2]).astype(float)
PH, PW = void.shape                             # satır = z (u), sütun = x (T→CT)
print('döndürülmüş piksel', PW, PH, '→ metre', PW * S, PH * S)
X0 = -PW * S / 2; Z0 = -PH * S / 2
px2x = lambda c: X0 + c * S
px2z = lambda r: Z0 + r * S

def frac(mask, nx, nz):
    im_ = Image.fromarray((mask * 255).astype(np.uint8)).resize((nx, nz), Image.BOX)
    return np.array(im_).astype(float) / 255.0

NX = int(np.ceil(PW * S / CELL)); NZ = int(np.ceil(PH * S / CELL))
fv, fw, fb = frac(void, NX, NZ), frac(wall, NX, NZ), frac(box, NX, NZ)
c_void = fv > 0.6
c_wall = (~c_void) & (fw > 0.28)
walk = ~c_void & ~c_wall
# kapanım: ince duvar çizgilerindeki küçük boşlukları kapat
c_wall = c_wall & ~c_void
walk = ~c_void & ~c_wall
# iç duvar çizgilerini bir hücre kalınlaştır (çizgi ~0,4 m): yalnızca yürünebilir alana taşmasın diye bir hücre
interior = c_wall & ~ndi.binary_dilation(c_void, iterations=2)
c_wall = c_wall | ndi.binary_dilation(interior, iterations=1) & ~c_void & False
near = ndi.binary_dilation(walk | c_wall, iterations=SOLID_BAND)
solid = c_wall | c_void                       # tüm boşluk katı: dış kenar kesin kapalı, aradaki adalar 'bina' kütlesi olur
# yürünebilir hücrede: duvar yok
solid &= ~(walk & ~c_wall) if False else solid
# ince açık gri çizgiler (basamak / sahanlık kenarı) kutu değil alçak duvardır
_bl, _bn = ndi.label(box, structure=np.ones((3, 3)))
for _i, _sl in enumerate(ndi.find_objects(_bl), start=1):
    _m = _bl[_sl] == _i
    if _m.sum() < 40: continue
    _ys, _xs = np.nonzero(_m)
    _P = np.stack([_xs, _ys], 1).astype(float) * S
    _w, _v = np.linalg.eigh(np.cov((_P - _P.mean(0)).T))
    _L = 4 * np.sqrt(max(_w[1], 0)); _T = 4 * np.sqrt(max(_w[0], 0))
    if _T < 1.3 and _L >= 3.0:
        lowpx[_sl] |= _m; box[_sl] &= ~_m
low_c = (frac(lowpx, NX, NZ) > 0.2) & ~c_void & ~solid
low_c = ndi.binary_dilation(low_c, iterations=1) & ~c_void & ~solid
solid = ndi.binary_closing(solid, structure=np.ones((3, 3)), iterations=1) | solid       # 1 hücrelik çentikler dolsun: merdiven basamağı şeklindeki çapraz duvarlarda botlar köşeye sürtmesin
free = ~solid
print('hücre', NX, NZ, 'yürünebilir', free.sum(), 'katı', solid.sum())

# ── bağlantı onarımı: radar çizgilerinden doğan kapalı kapıları aç ──
# Oyuncu yarıçapı payı (1 hücre) bırakılmış serbest alanın bileşenleri bulunur; ana bileşen (T avlusu) dışında kalan her büyük bileşene,
# boşluk olmayan hücreler üzerinden en ucuz yoldan (katı hücre = 1, serbest = 0) bağlanılır ve yol açılır (kapı 3 hücre = 1,5 m).
import heapq
def comps_of(free_):
    E = ndi.binary_erosion(free_, structure=np.ones((3, 3)), iterations=1)
    lab_, n_ = ndi.label(E)
    return E, lab_, n_
tz_c = ((-65.4 + -51.1) / 2 - X0) / CELL, ((-32.5 + -2.3) / 2 - Z0) / CELL        # T avlusu merkezi (hücre x, z)
carved = []
for it in range(60):
    free_ = ~solid
    E, lab_, n_ = comps_of(free_)
    sizes = ndi.sum(E, lab_, range(1, n_ + 1))
    main = lab_[int(tz_c[1]), int(tz_c[0])]
    others = [i for i in range(1, n_ + 1) if i != main and sizes[i - 1] >= 40 and not (c_void & (lab_ == i)).any()]
    if not others: break
    INF = 1e9; dist = np.full(solid.shape, INF); prev = {}
    pq = []
    for (r, c) in zip(*np.nonzero(lab_ == main)): dist[r, c] = 0; heapq.heappush(pq, (0, r, c))
    targets = {}
    for i in others:
        for (r, c) in zip(*np.nonzero(lab_ == i)): targets[(r, c)] = i
    found = None
    while pq:
        d, r, c = heapq.heappop(pq)
        if d > dist[r, c]: continue
        if (r, c) in targets: found = (r, c); break
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            r2, c2 = r + dr, c + dc
            if r2 < 0 or c2 < 0 or r2 >= solid.shape[0] or c2 >= solid.shape[1] or c_void[r2, c2]: continue
            w = 0 if E[r2, c2] else 1
            nd = d + w + 1e-3
            if nd < dist[r2, c2]: dist[r2, c2] = nd; prev[(r2, c2)] = (r, c); heapq.heappush(pq, (nd, r2, c2))
    if not found: print('bağlanamadı', len(others)); break
    path = [found]
    while path[-1] in prev: path.append(prev[path[-1]])
    cells = [q for q in path if not E[q]]
    for (r, c) in cells:
        for dr in (-2, -1, 0, 1, 2):
            for dc in (-2, -1, 0, 1, 2):
                r2, c2 = r + dr, c + dc
                if 0 <= r2 < solid.shape[0] and 0 <= c2 < solid.shape[1] and not c_void[r2, c2]: solid[r2, c2] = False; low_c[r2, c2] = False
    carved.append((round(float(X0 + found[1] * CELL), 1), round(float(Z0 + found[0] * CELL), 1), len(cells)))
print('açılan kapı', len(carved), carved)

# açgözlü dikdörtgen ayrıştırması
def rects(mask):
    m = mask.copy(); out = []
    nz, nx = m.shape
    for r in range(nz):
        c = 0
        while c < nx:
            if m[r, c]:
                c2 = c
                while c2 + 1 < nx and m[r, c2 + 1]: c2 += 1
                r2 = r
                while r2 + 1 < nz and m[r2 + 1, c:c2 + 1].all(): r2 += 1
                m[r:r2 + 1, c:c2 + 1] = False
                out.append((c, r, c2 + 1, r2 + 1))
                c = c2 + 1
            else: c += 1
    return out

# ── cephe yüzleri: yürünebilir alana bakan duvar kenarları, koşular halinde ──
# dir 0:+x yüzü (duvarın doğu kenarı) 1:-x 2:+z 3:-z ; [dir, düzlem koordinatı, başlangıç, bitiş] (m)
faces = []
free_cells = ~solid & ~c_void
def runs(vec):
    out = []; i = 0
    while i < len(vec):
        if vec[i]:
            j = i
            while j + 1 < len(vec) and vec[j + 1]: j += 1
            out.append((i, j + 1)); i = j + 1
        else: i += 1
    return out
nz_, nx_ = solid.shape
for d in range(4):
    if d < 2:      # x yüzleri: her sütun sınırı için dikey koşular
        sh = np.zeros_like(solid)
        if d == 0: sh[:, :-1] = solid[:, :-1] & free_cells[:, 1:]; plane = lambda c: X0 + (c + 1) * CELL
        else:      sh[:, 1:] = solid[:, 1:] & free_cells[:, :-1]; plane = lambda c: X0 + c * CELL
        for c in range(nx_):
            for (r0, r1) in runs(sh[:, c]): faces.append([d, round(float(plane(c)), 2), round(float(Z0 + r0 * CELL), 2), round(float(Z0 + r1 * CELL), 2)])
    else:
        sh = np.zeros_like(solid)
        if d == 2: sh[:-1, :] = solid[:-1, :] & free_cells[1:, :]; plane = lambda r: Z0 + (r + 1) * CELL
        else:      sh[1:, :] = solid[1:, :] & free_cells[:-1, :]; plane = lambda r: Z0 + r * CELL
        for r in range(nz_):
            for (c0, c1) in runs(sh[r, :]): faces.append([d, round(float(plane(r)), 2), round(float(X0 + c0 * CELL), 2), round(float(X0 + c1 * CELL), 2)])
faces = [f for f in faces if f[3] - f[2] >= 0.5]
print('cephe yüzü koşusu', len(faces), 'toplam uzunluk', round(sum(f[3] - f[2] for f in faces)))
R = rects(solid)
RL = rects(low_c)
print('duvar dikdörtgeni', len(R), 'alçak duvar', len(RL))

# kutular: bağlantılı bileşenler (radar pikseli çözünürlüğünde)
lab, n = ndi.label(box, structure=np.ones((3, 3)))
boxes = []
for i in range(1, n + 1):
    ys, xs = np.nonzero(lab == i)
    if len(xs) < 40: continue
    P = np.stack([xs, ys], 1).astype(float) * S
    ctr = P.mean(0); Q = P - ctr
    w_, v_ = np.linalg.eigh(np.cov(Q.T))
    ax = v_[:, 1]; ay = v_[:, 0]
    u = Q @ ax; vv = Q @ ay
    ext = (u.max() - u.min(), vv.max() - vv.min())
    cc = ctr + ax * (u.max() + u.min()) / 2 + ay * (vv.max() + vv.min()) / 2
    ang = float(np.arctan2(ax[1], ax[0]))
    area = ext[0] * ext[1]
    if min(ext) > 6.0 or max(ext) > 11.0 or area > 45: continue          # zemin yaması: nesne değil
    # boyut → yükseklik: küçük sandık 1,0–1,4 · orta 2,0 · büyük (konteyner / araç) 2,6
    h = 1.0 if area < 1.5 else 1.35 if area < 6 else 2.0 if area < 18 else 2.6
    boxes.append([round(float(X0 + cc[0]), 2), round(float(Z0 + cc[1]), 2), round(float(ext[0]), 2), round(float(ext[1]), 2), round(-ang, 3), h])
print('kutu', len(boxes))

# yükseklik ızgarası (1 m): zemin renginden (sarı-yeşil yüksek, mavi alçak)
NHX = int(np.ceil(PW * S / HCELL)) + 1; NHZ = int(np.ceil(PH * S / HCELL)) + 1
fl = floor.astype(float)
num = frac(np.where(floor, score + 100, 0).clip(0, 255) / 255.0 * 0 + 0, NHX, NHZ) * 0
sc_img = Image.fromarray(np.where(floor, score + 100, 0).clip(0, 255).astype(np.uint8))
sc_s = np.array(sc_img.resize((NHX, NHZ), Image.BOX)).astype(float)
fl_s = frac(floor, NHX, NHZ)
valid = fl_s > 0.25
avg = np.where(valid, sc_s / np.maximum(fl_s, 1e-3) - 100, np.nan)
idx = ndi.distance_transform_edt(~valid, return_distances=False, return_indices=True)
avg = avg[idx[0], idx[1]]
H_LO, H_HI, S_LO, S_HI = 0.0, 3.4, -60.0, 36.0
h = np.clip((avg - S_LO) / (S_HI - S_LO), 0, 1) * (H_HI - H_LO) + H_LO
h = ndi.gaussian_filter(h, 1.6)
# eğim sınırı (tırmanılabilir): komşuya göre en çok SMAX * hücre
SMAX = 0.34
for _ in range(60):
    for ax_ in (0, 1):
        for sh in (1, -1):
            nb = np.roll(h, sh, axis=ax_)
            h = np.minimum(h, nb + SMAX * HCELL)
print('yükseklik', h.min(), h.max())

# bölgeler (metre): doğuş dikdörtgenleri ve hedefler (turuncu = bomba alanları, yeşil = alım bölgeleri)
def comps(mask, minpix=60):
    mask = ndi.binary_dilation(mask, iterations=7)
    lab, n = ndi.label(mask, structure=np.ones((3, 3))); out = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) < minpix: continue
        out.append([round(float(px2x(xs.min())), 2), round(float(px2z(ys.min())), 2), round(float(px2x(xs.max() + 1)), 2), round(float(px2z(ys.max() + 1)), 2)])
    return out
zones = {'orange': comps(orange), 'green': comps(green)}
print('bölgeler', zones)

data = {
    'S': round(S, 5), 'cell': CELL, 'x0': round(X0, 3), 'z0': round(Z0, 3), 'nx': NX, 'nz': NZ,
    'rects': [[round(X0 + c0 * CELL, 2), round(Z0 + r0 * CELL, 2), round(X0 + c1 * CELL, 2), round(Z0 + r1 * CELL, 2)] for (c0, r0, c1, r1) in R],
    'lows': [[round(X0 + c0 * CELL, 2), round(Z0 + r0 * CELL, 2), round(X0 + c1 * CELL, 2), round(Z0 + r1 * CELL, 2)] for (c0, r0, c1, r1) in RL],
    'faces': faces,
    'boxes': boxes, 'hx0': round(X0, 3), 'hz0': round(Z0, 3), 'hnx': NHX, 'hnz': NHZ, 'hcell': HCELL,
    'h': base64.b64encode(np.round(h * 50).clip(0, 255).astype(np.uint8).tobytes()).decode(), 'hscale': 50,
    'zones': zones,
}
with open('src/maps/colgecidiData.js', 'w', encoding='utf-8') as f:
    f.write('// OTOMATİK ÜRETİLDİ: tools/dust2_extract.py (radar → yapı verisi). Elle düzenleme; çıktıyı yeniden üret.\nexport default ' + json.dumps(data, separators=(',', ':')) + ';\n')
print('yazıldı', len(json.dumps(data)) // 1024, 'KB')
# kontrol görüntüsü
viz = np.zeros((NZ, NX, 3), np.uint8)
viz[free] = (60, 70, 90); viz[solid] = (190, 100, 70)
Image.fromarray(viz).resize((NX * 3, NZ * 3), Image.NEAREST).save('tools_ref/dust2_solid.png')

# hata ayıklama: radar zemini üzerine katı hücreler (turuncu, yarı saydam)
rgb_rot = np.rot90(im[..., :3], k=-1).astype(float)
big = np.array(Image.fromarray(solid.astype(np.uint8) * 255).resize((PW, PH), Image.NEAREST)) > 0
ov = rgb_rot.copy()
ov[big & ~void] = ov[big & ~void] * 0.4 + np.array([255, 90, 40]) * 0.6
Image.fromarray(ov.astype(np.uint8)).save('tools_ref/dust2_overlay.png')
