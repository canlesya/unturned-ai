# Dust 2 radar görselinden (tools_ref/dust2_radar_ref.png) "Çöl Geçidi" için yapı verisini çıkarır → src/maps/colgecidiData.js
# Çıktı: duvar dikdörtgenleri, kutu/araç nesneleri, 1 m'lik yükseklik ızgarası, bölge dikdörtgenleri (doğuş / hedef).
# Yön: radar döndürülmez (standart): T güney (+z), CT kuzey (−z), A sahası doğu (+x), B sahası batı (−x).
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
_bl0, _bn0 = ndi.label(box, structure=np.ones((3, 3)))
thin_light = np.zeros_like(box)
for _i, _sl in enumerate(ndi.find_objects(_bl0), start=1):
    _m = _bl0[_sl] == _i
    if _m.sum() < 30: continue
    _ys, _xs = np.nonzero(_m)
    _P = np.stack([_xs, _ys], 1).astype(float) * 0.143
    _w, _v = np.linalg.eigh(np.cov((_P - _P.mean(0)).T))
    if 4 * np.sqrt(max(_w[0], 0)) < 1.3 and 4 * np.sqrt(max(_w[1], 0)) >= 3.5:        # ince (<1,3 m) ve uzun (≥3,5 m)
        thin_light[_sl] |= _m
box = box & ~thin_light
orange = (~void) & (rgb[..., 0] > 170) & (rgb[..., 1] > 70) & (rgb[..., 1] < 130) & (rgb[..., 2] < 60)
green = (~void) & (rgb[..., 1] > 150) & (rgb[..., 0] < 90) & (rgb[..., 2] < 100) & ((rgb[..., 1] - rgb[..., 0]) > 100)
floor = (~void) & (~gray) & (~orange) & (~green)

def rot(x): return x                            # yön korunur
void, wall, box, floor, orange, green = map(rot, (void, wall, box, floor, orange, green))
# kalın koyu bantlar = rampa / basamak kenarı gölgesi ve gradyanlar (duvar değil): ≥ 11 px kalınlıktaki parçalar ve çevresi duvar maskesinden çıkar
_thick = ndi.binary_opening(wall, structure=np.ones((11, 11)))
wall = wall & ~ndi.binary_dilation(_thick, iterations=4)
# kısa çizgiler (basamak / taralı bölge deseni) duvar sayılmaz: yalnızca boşluğa değen ya da uzun (>= 8 m) çizgiler kalır
_lab, _n = ndi.label(wall, structure=np.ones((3, 3)))
_near_void = ndi.binary_dilation(void, iterations=3)
_dtw = ndi.distance_transform_edt(wall)                    # çizgi kalınlığı: gerçek duvar çizgisi ince (≤ ~4,5 px yarıçap), gölge / gradyan bandı geniştir
_keep = np.zeros(_n + 1, bool); _isdiv = np.zeros(_n + 1, bool)
for _i, _sl in enumerate(ndi.find_objects(_lab), start=1):
    _m = _lab[_sl] == _i
    _h, _w = _m.shape
    _touch = (_m & _near_void[_sl]).any()
    _long = np.hypot(_h, _w) * S >= 8.0
    _thin = _dtw[_sl][_m].max() <= 4.5
    _keep[_i] = (_touch and _m.sum() >= 25) or (_long and _thin)
    _isdiv[_i] = _long and _thin and not _touch               # içerideki uzun çizgi: bölme duvarı (alçak, ~3 m); sınırdaki / adalar: bina (tam yükseklik)
lowpx = np.zeros_like(wall)
for _i, _sl in enumerate(ndi.find_objects(_lab), start=1):
    if not _keep[_i] and (_lab[_sl] == _i).sum() >= 25:
        lowpx[_sl] |= (_lab[_sl] == _i)                 # içerideki kısa koyu parçalar: alçak duvar / küpeşte
wall_div = (_isdiv[_lab] & wall)                    # ince açık gri çizgiler (thin_light) basamak / sahanlık kenarıdır: duvar değil, yürünür (kenarlarda boşluk / merdiven var)
wall = _keep[_lab] & wall
# taralı CT alım bölgesinin içi: desen çizgileri yürünebilir zemindir
_gl, _gn = ndi.label(ndi.binary_dilation(green, iterations=7))
for _i, _sl in enumerate(ndi.find_objects(_gl), start=1):
    _y, _x = _sl
    if min(_y.stop - _y.start, _x.stop - _x.start) > 40 and max(_y.stop - _y.start, _x.stop - _x.start) > 70:
        wall[_sl] &= _near_void[_sl]

score = rot(rgb[..., 0] - rgb[..., 2]).astype(float)
PH, PW = void.shape                             # satır = z (v), sütun = x (u)
print('piksel', PW, PH, '→ metre', PW * S, PH * S)
X0 = -PW * S / 2; Z0 = -PH * S / 2
px2x = lambda c: X0 + c * S
px2z = lambda r: Z0 + r * S

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

def frac(mask, nx, nz):
    im_ = Image.fromarray((mask * 255).astype(np.uint8)).resize((nx, nz), Image.BOX)
    return np.array(im_).astype(float) / 255.0

NX = int(np.ceil(PW * S / CELL)); NZ = int(np.ceil(PH * S / CELL))
fv, fw, fb = frac(void, NX, NZ), frac(wall, NX, NZ), frac(box, NX, NZ)
c_void = fv > 0.6
fdv = frac(wall_div, NX, NZ)
div_c = (~c_void) & (fdv > 0.28)
c_wall = (~c_void) & ((fw > 0.28) | div_c)
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

# ── elle açılan geçitler (radar çizgisi yanlış kapatıyor): dünya metresi [x0, z0, x1, z1] ──
OVERRIDE_CARVE = [
    [14.0, -48.0, 16.6, -38.0],
    [-35.0, -9.6, -25.5, -3.0],    # Lower ↔ Upper Tunnels: spiral merdiven (radarda kıvrık çizgiler duvar sanılıyor)    # CT doğuş avlusu: yeşil kutu ile taralı (çatı altı) bölme arasındaki duvar, 10 m'lik geniş geçit
]
for (ox0, oz0, ox1, oz1) in OVERRIDE_CARVE:
    c0, c1 = int((ox0 - X0) / CELL), int(np.ceil((ox1 - X0) / CELL)); r0, r1 = int((oz0 - Z0) / CELL), int(np.ceil((oz1 - Z0) / CELL))
    sub = solid[r0:r1, c0:c1]; sub &= c_void[r0:r1, c0:c1]
    low_c[r0:r1, c0:c1] = False

# ── adlandırılmış bölgeler arası gerekli bağlantılar (gerçek haritadaki komşuluklar) ──
CALL_PX = {'T Spawn': (570, 882), 'Titanic': (447, 800), 'Outside Tunnels': (387, 660), 'Suicide': (633, 748), 'Outside Long': (806, 728), 'Top Mid': (702, 637), 'Long Doors': (842, 617), 'Pit': (997, 620), 'Long Corner': (977, 480),
    'Long': (997, 390), 'Ramp': (995, 230), 'A Site': (933, 226), 'Goose': (945, 118), 'Boost': (871, 256), 'Elevator': (892, 293), 'CT Spawn': (775, 246), 'Short Stairs': (797, 330), 'Stairs': (792, 380), 'Short': (753, 436), 'Xbox': (660, 438),
    'Cat': (680, 523), 'Mid': (640, 515), 'Mid Doors': (640, 398), 'Lower Tunnels': (554, 438), 'Upper Tunnels': (350, 480), 'CT Mid': (590, 267), 'B Doors': (447, 284), 'Window': (505, 192), 'B Site': (402, 204), 'B Plat': (343, 182),
    'Back Plat': (318, 118), 'Box': (344, 251), 'Fence': (285, 293), 'Ninja': (807, 174), 'Barrels': (1003, 155), 'Blue': (875, 495), 'Side Pit': (931, 620), 'Car (B)': (415, 355), 'Car (Long)': (1056, 312), 'Palm': (684, 593), 'Green': (590, 628)}
def call_cell(nm):
    x, y = CALL_PX[nm]; u = (x - 277) / 0.87; v = (y - 94.5) / 0.87
    return int(np.clip((v * S + Z0 + PH * S / 2 - 0) , 0, 1e9) * 0) + int(np.clip(((v - 0) * S) / CELL, 0, NZ - 1)), int(np.clip((u * S) / CELL, 0, NX - 1))
REQUIRED = [('Lower Tunnels', 'Upper Tunnels'), ('Upper Tunnels', 'Outside Tunnels'), ('Outside Tunnels', 'T Spawn'), ('Outside Tunnels', 'Titanic'), ('Titanic', 'T Spawn'), ('T Spawn', 'Outside Long'), ('T Spawn', 'Top Mid'),
    ('Outside Long', 'Long Doors'), ('Long Doors', 'Long Corner'), ('Long Corner', 'Pit'), ('Long Corner', 'Long'), ('Long', 'Ramp'), ('Ramp', 'A Site'), ('A Site', 'Goose'), ('A Site', 'Boost'), ('Top Mid', 'Mid'), ('Mid', 'Xbox'),
    ('Xbox', 'Mid Doors'), ('Mid Doors', 'CT Mid'), ('Xbox', 'Short'), ('Short', 'Stairs'), ('Stairs', 'Short Stairs'), ('Short Stairs', 'A Site'), ('Short Stairs', 'CT Spawn'), ('CT Spawn', 'Elevator'), ('Elevator', 'A Site'),
    ('CT Mid', 'B Doors'), ('B Doors', 'B Site'), ('CT Mid', 'Window'), ('Window', 'B Site'), ('B Site', 'B Plat'), ('B Plat', 'Back Plat'), ('Box', 'B Site'), ('Suicide', 'Mid Doors'), ('Lower Tunnels', 'Xbox'), ('Cat', 'Short'), ('Mid', 'Cat'), ('Upper Tunnels', 'B Site'), ('Upper Tunnels', 'Fence'), ('Upper Tunnels', 'Car (B)'), ('Car (B)', 'B Doors'), ('CT Spawn', 'CT Mid'), ('Long Corner', 'Blue'), ('Blue', 'Long Doors'), ('Pit', 'Side Pit'), ('Side Pit', 'Long Doors'),
    ('Boost', 'Ninja'), ('Ninja', 'A Site'), ('Barrels', 'A Site'), ('Long', 'Car (Long)'), ('Car (Long)', 'Ramp'), ('Palm', 'Top Mid'), ('Green', 'Top Mid'), ('Palm', 'Mid')]
import heapq as _hq
def route(a_, b_, allow_solid):
    """a_→b_ hücre yolu (8 komşu). Serbest hücre 1, bölme duvarı 14, bina kütlesi 60 (allow_solid False ise geçilmez). Döner: (maliyet, yol)"""
    INF = 1e18; H_, W_ = solid.shape; dist = np.full((H_, W_), INF); prev = {}
    dist[a_] = 0; pq = [(0.0, a_[0], a_[1])]
    while pq:
        d, r, c = _hq.heappop(pq)
        if d > dist[r, c]: continue
        if (r, c) == b_: break
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if not dr and not dc: continue
                r2, c2 = r + dr, c + dc
                if r2 < 0 or c2 < 0 or r2 >= H_ or c2 >= W_ or c_void[r2, c2]: continue
                if solid[r2, c2]:
                    if not allow_solid: continue
                    w = 14 if div_c[r2, c2] else 60
                else: w = 1
                nd = d + w * (1.4142 if dr and dc else 1)
                if nd < dist[r2, c2]: dist[r2, c2] = nd; prev[(r2, c2)] = (r, c); _hq.heappush(pq, (nd, r2, c2))
    if dist[b_] >= INF: return INF, []
    path = [b_]
    while path[-1] in prev: path.append(prev[path[-1]])
    return dist[b_], path[::-1]
def nearest_open(cell, R=14):
    r0, c0 = cell
    for rad in range(0, R):
        for dr in range(-rad, rad + 1):
            for dc in range(-rad, rad + 1):
                r, c = r0 + dr, c0 + dc
                if 0 <= r < NZ and 0 <= c < NX and not solid[r, c] and not c_void[r, c]: return (r, c)
    return cell
req_carved = []
for (na, nb_) in REQUIRED:
    ca, cb = nearest_open(call_cell(na)), nearest_open(call_cell(nb_))
    d0, _p0 = route(ca, cb, False)
    eu = np.hypot(ca[0] - cb[0], ca[1] - cb[1]) * CELL
    if d0 < 1e17 and d0 * CELL <= 1.9 * eu + 18: continue
    d1, p1 = route(ca, cb, True)
    cells_ = [q for q in p1 if solid[q]]
    for (r, c) in cells_:
        for dr in (-2, -1, 0, 1, 2):
            for dc in (-2, -1, 0, 1, 2):
                r2, c2 = r + dr, c + dc
                if 0 <= r2 < NZ and 0 <= c2 < NX and not c_void[r2, c2]: solid[r2, c2] = False; low_c[r2, c2] = False
    req_carved.append((na, nb_, len(cells_)))
print('gerekli bağlantı onarımı', req_carved)

# ── bağlantı onarımı: radar çizgilerinden doğan kapalı kapıları aç ──
# Oyuncu yarıçapı payı (1 hücre) bırakılmış serbest alanın bileşenleri bulunur; ana bileşen (T avlusu) dışında kalan her büyük bileşene,
# boşluk olmayan hücreler üzerinden en ucuz yoldan (katı hücre = 1, serbest = 0) bağlanılır ve yol açılır (kapı 3 hücre = 1,5 m).
import heapq
def comps_of(free_):
    E = ndi.binary_erosion(free_, structure=np.ones((3, 3)), iterations=1)
    lab_, n_ = ndi.label(E)
    return E, lab_, n_
_gz = zones['green']; _t = max(_gz, key=lambda g: (g[1] + g[3]) / 2)
tz_c = (((_t[0] + _t[2]) / 2 - X0) / CELL, ((_t[1] + _t[3]) / 2 - Z0) / CELL)        # T avlusu merkezi (hücre x, z): güneydeki yeşil kutu
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

# ── bölme duvarları (içerideki uzun çizgiler, ~3 m) ve bina kütleleri (tam yükseklik) ──
div_cells = div_c & solid
tall_cells = solid & ~div_cells
# ── cephe yüzleri: yürünebilir alana bakan duvar kenarları, koşular halinde ──
# dir 0:+x yüzü (duvarın doğu kenarı) 1:-x 2:+z 3:-z ; [dir, düzlem koordinatı, başlangıç, bitiş, tür(0 bina, 1 bölme)] (m)
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
def faces_for(mask, kind):
    for d in range(4):
        if d < 2:
            sh = np.zeros_like(mask)
            if d == 0: sh[:, :-1] = mask[:, :-1] & free_cells[:, 1:]; plane = lambda c: X0 + (c + 1) * CELL
            else:      sh[:, 1:] = mask[:, 1:] & free_cells[:, :-1]; plane = lambda c: X0 + c * CELL
            for c in range(nx_):
                for (r0, r1) in runs(sh[:, c]): faces.append([d, round(float(plane(c)), 2), round(float(Z0 + r0 * CELL), 2), round(float(Z0 + r1 * CELL), 2), kind])
        else:
            sh = np.zeros_like(mask)
            if d == 2: sh[:-1, :] = mask[:-1, :] & free_cells[1:, :]; plane = lambda r: Z0 + (r + 1) * CELL
            else:      sh[1:, :] = mask[1:, :] & free_cells[:-1, :]; plane = lambda r: Z0 + r * CELL
            for r in range(nz_):
                for (c0, c1) in runs(sh[r, :]): faces.append([d, round(float(plane(r)), 2), round(float(X0 + c0 * CELL), 2), round(float(X0 + c1 * CELL), 2), kind])
faces_for(tall_cells, 0); faces_for(div_cells, 1)
faces = [f for f in faces if f[3] - f[2] >= 0.5]
print('cephe yüzü koşusu', len(faces), 'toplam uzunluk', round(sum(f[3] - f[2] for f in faces)))
R = rects(tall_cells)
RD = rects(div_cells)
RL = rects(low_c)
print('bina dikdörtgeni', len(R), 'bölme duvarı', len(RD), 'alçak duvar', len(RL))

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
    h = 1.0 if area < 1.5 else 1.1 if area < 6 else 2.0 if area < 18 else 2.6
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


data = {
    'S': round(S, 5), 'cell': CELL, 'x0': round(X0, 3), 'z0': round(Z0, 3), 'nx': NX, 'nz': NZ,
    'rects': [[round(X0 + c0 * CELL, 2), round(Z0 + r0 * CELL, 2), round(X0 + c1 * CELL, 2), round(Z0 + r1 * CELL, 2)] for (c0, r0, c1, r1) in R],
    'lows': [[round(X0 + c0 * CELL, 2), round(Z0 + r0 * CELL, 2), round(X0 + c1 * CELL, 2), round(Z0 + r1 * CELL, 2)] for (c0, r0, c1, r1) in RL],
    'divs': [[round(X0 + c0 * CELL, 2), round(Z0 + r0 * CELL, 2), round(X0 + c1 * CELL, 2), round(Z0 + r1 * CELL, 2)] for (c0, r0, c1, r1) in RD],
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
rgb_rot = im[..., :3].astype(float)
big = np.array(Image.fromarray(solid.astype(np.uint8) * 255).resize((PW, PH), Image.NEAREST)) > 0
ov = rgb_rot.copy()
ov[big & ~void] = ov[big & ~void] * 0.4 + np.array([255, 90, 40]) * 0.6
Image.fromarray(ov.astype(np.uint8)).save('tools_ref/dust2_overlay.png')
