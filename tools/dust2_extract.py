# Dust 2 radar görselinden (tools_ref/dust2_radar_ref.png) "Çöl Geçidi" için yapı verisini çıkarır → src/maps/colgecidiData.js
# Çıktı: duvar dikdörtgenleri, kutu/araç nesneleri, 1 m'lik yükseklik ızgarası, bölge dikdörtgenleri (doğuş / hedef).
# Yön: radar döndürülmez (standart): T güney (+z), CT kuzey (−z), A sahası doğu (+x), B sahası batı (−x).
import numpy as np, json, base64, sys
from PIL import Image
from scipy import ndimage as ndi

SCALE = 1.3                      # radar pikseli = 4.4 hu = 0.11 m; oyun hızı CS'ten yavaş → harita 1.3× büyütülür
S = 0.11 * SCALE                 # m / piksel
CELL = 0.5                       # duvar ızgarası (m)
HCELL = 0.5                      # yükseklik ızgarası (m)
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
    [14.0, -48.0, 16.6, -38.0],    # CT avlusu: yeşil kutu ile taralı (köprü altı) bölme arasındaki duvar
    [-35.0, -9.6, -25.5, -3.0],    # Lower ↔ Upper Tunnels: spiral merdiven (radarda kıvrık çizgiler duvar sanılıyor)
    [19.0, -43.5, 22.5, -35.0],    # CT avlusu doğu kenarı (taralı bölge çizgisi) → Elevator tarafına açık
    [15.0, -35.6, 23.0, -33.9],    # Short köprüsünün güney ağzı (taralı bölgenin kenar çizgisi duvar sanılıyordu)
    [15.0, -52.0, 23.0, -50.4],    # köprünün kuzey ağzı (A platosuna iniş)
    [23.3, -46.5, 26.5, -34.7],    # köprü altı → A önü avlu: kemerli geçit (A'dan CT Spawn görünür; kullanıcı: X 26.3 Z −38.6 duvarı olmamalı)
    [26.4, -44.7, 31.6, -41.5],    # A önü avlu ortasındaki iki sahte sütun (radar kasa gölgesi; kullanıcı: X 29 Z −42.4)
    [15.0, -25.8, 23.0, -23.4],    # Short merdiven rampasının ortasındaki duvar parçası (Short şeridinin radardaki kenar çizgisi)
    [16.2, -34.0, 23.0, -29.3],    # Short şeridi: kasa 12 m duvar olmuştu + batı duvarı 1 m fazla kalın → kasa EXTRA_BOXES'ta
    [16.0, -59.4, 38.4, -51.0],    # A platosu kuzeyi (Ninja): fıçı / kasa gölgeleri bina kütlesine karışmış, 6 m şerit gömülüydü → kasalar EXTRA_BOXES'ta
    [-51.0, -60.5, -49.6, -48.0],  # B Plat ↔ B sahası: turuncu saha çizgisi duvar olmuştu (radarda duvar yok)
    [-51.0, -47.9, -37.3, -46.2],  # B sahası güney kenarı: aynı (saha → Box / B Doors inişi)
    [-8.6, -19.6, -5.8, -18.4],    # Mid Doors önündeki sütun
    [27.4, 8.8, 30.2, 10.3],       # Long Doors önündeki sütun
    [-12.0, -23.2, -3.7, -19.4],   # Mid Doors: radardaki açık kanat çizgileri sütun olmuştu → colgecidi.js GATES kapısı
    [-37.6, -41.5, -33.2, -35.6],  # B Doors: aynı
    [24.6, 5.4, 31.4, 8.9],        # Long koridoru kuzey ucu: radar çizgileri (kapı T tarafında)
    [23.6, 20.2, 31.4, 24.6],      # Long Doors (T tarafı): kanat çizgileri sütun olmuştu → GATES
    [-39.5, -57.6, -33.5, -42.0, 'hard'],  # B sahası doğu duvarı: radar parçalı / delikli (anlamsız geçit) → OVERRIDE_FILL ile tek temiz duvar, 2 açıklık: pencere + B Doors
    [14.3, -38.4, 16.2, -35.4],    # CT Spawn: köprü güney ağzındaki tek kolon (kullanıcı: kaldır)
    [-52.6, 33.8, -41.0, 36.7, 'hard'],  # Titanic kenarı: gölge bandı bina olmuştu → T'den Outside Tunnels'a atlanır
    [-53.0, 36.9, -51.1, 42.9],    # Titanic yanında 1,5×5,5 m'lik serbest duran 11,7 m'lik blok (kolon; kullanıcı: kaldır)
    [-49.95, -2.0, -48.1, 10.3],   # Outside Tunnels girişi: 1×1 m 11 m yüksekliğinde dikme + arkasındaki uzun bölme duvarı (kullanıcı: uzun sütun kalkacak)
    [-54.2, -11.2, -49.4, -7.0, 'hard'],  # Upper Tunnels: kasa gölgesi ile kolon birleşip kalın blok olmuştu → ince kolon OVERRIDE_FILL
    [-2.8, 66.2, 13.1, 71.2],      # T rampasının güney nişleri: yan saklanma yeri / taş basamaklı kenar → rampa yüzeyine katıldı
    [-6.0, 52.6, 12.0, 66.8],      # T Spawn doğusu: radarda bina yok, aşağı inen yokuş (gölge şeritleri bina olmuştu)
    [45.0, 6.5, 48.9, 25.0],       # Pit ↔ Side Pit: bina duvarı değil, alçak duvar (colgecidi.js 'PIT_WALL')
]
for (ox0, oz0, ox1, oz1, *_hard) in OVERRIDE_CARVE:
    c0, c1 = int((ox0 - X0) / CELL), int(np.ceil((ox1 - X0) / CELL)); r0, r1 = int((oz0 - Z0) / CELL), int(np.ceil((oz1 - Z0) / CELL))
    if _hard: c_void[r0:r1, c0:c1] = False                    # 'hard': radarda boşluk (siyah) olsa da aç
    sub = solid[r0:r1, c0:c1]; sub &= c_void[r0:r1, c0:c1]
    low_c[r0:r1, c0:c1] = False

# ── adlandırılmış bölgeler arası gerekli bağlantılar (gerçek haritadaki komşuluklar) ──
CALL_PX = {'T Spawn': (570, 882), 'Titanic': (447, 800), 'Outside Tunnels': (387, 660), 'Suicide': (633, 748), 'Outside Long': (806, 728), 'Top Mid': (702, 637), 'Long Doors': (842, 617), 'Pit': (997, 620), 'Long Corner': (977, 480),
    'Long': (997, 390), 'Ramp': (995, 230), 'A Site': (933, 226), 'Goose': (945, 118), 'Boost': (871, 256), 'Elevator': (892, 293), 'CT Spawn': (747, 255), 'Short Stairs': (797, 330), 'Stairs': (792, 380), 'Short': (753, 436), 'Xbox': (660, 438),
    'Cat': (680, 523), 'Mid': (640, 515), 'Mid Doors': (640, 398), 'Lower Tunnels': (554, 438), 'Upper Tunnels': (350, 480), 'CT Mid': (590, 267), 'B Doors': (447, 284), 'Window': (505, 192), 'B Site': (402, 204), 'B Plat': (343, 182),
    'Back Plat': (318, 118), 'Box': (344, 251), 'Fence': (285, 293), 'Ninja': (807, 174), 'Barrels': (1003, 155), 'Blue': (875, 495), 'Side Pit': (931, 620), 'Car (B)': (415, 355), 'Car (Long)': (1056, 312), 'Palm': (684, 593), 'Green': (590, 628)}
def call_cell(nm):
    x, y = CALL_PX[nm]; u = (x - 277) / 0.87; v = (y - 94.5) / 0.87
    return int(np.clip((v * S + Z0 + PH * S / 2 - 0) , 0, 1e9) * 0) + int(np.clip(((v - 0) * S) / CELL, 0, NZ - 1)), int(np.clip((u * S) / CELL, 0, NX - 1))
REQUIRED = [('Lower Tunnels', 'Upper Tunnels'), ('Upper Tunnels', 'Outside Tunnels'), ('Outside Tunnels', 'T Spawn'), ('Outside Tunnels', 'Titanic'), ('Titanic', 'T Spawn'), ('T Spawn', 'Outside Long'), ('T Spawn', 'Top Mid'),
    ('Outside Long', 'Long Doors'), ('Long Doors', 'Long Corner'), ('Long Corner', 'Pit'), ('Long Corner', 'Long'), ('Long', 'Ramp'), ('Ramp', 'A Site'), ('A Site', 'Goose'), ('A Site', 'Boost'), ('Top Mid', 'Mid'), ('Mid', 'Xbox'),
    ('Xbox', 'Mid Doors'), ('Mid Doors', 'CT Mid'), ('Xbox', 'Short'), ('Short', 'Stairs'), ('Stairs', 'Short Stairs'), ('Short Stairs', 'A Site'), ('CT Spawn', 'Elevator'), ('Elevator', 'A Site'),
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
def nearest_open(cell, R=14, avoid=None):
    r0, c0 = cell
    for rad in range(0, R):
        for dr in range(-rad, rad + 1):
            for dc in range(-rad, rad + 1):
                r, c = r0 + dr, c0 + dc
                if 0 <= r < NZ and 0 <= c < NX and not solid[r, c] and not c_void[r, c] and (avoid is None or not avoid[r, c]): return (r, c)
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
EXTRA_BOXES = [[21.85, -32.7, 2.3, 2.2, 0.0, 1.1]]     # elle: radarda duvara karışan kasalar [cx, cz, w, d, ry, h] (Short tepesindeki kasa)
# A platosu kuzeyindeki fıçı kümeleri (radarda daireler; 1 m çap → fıçı)
for (_x, _z) in [(16.4, -57.1), (17.4, -57.4), (18.5, -57.3), (17.0, -56.0), (18.2, -56.1), (19.4, -56.5),
                 (34.7, -57.4), (34.8, -56.4), (33.8, -55.5), (35.4, -55.3), (23.9, -52.3), (24.8, -50.9)]:
    EXTRA_BOXES.append([_x, _z, 0.95, 0.95, 0.0, 1.1])
boxes += EXTRA_BOXES
for _b in boxes:                                             # A sahası kasaları: ayaktayken üstünden Short görünür (göz 1,6 m), çömelince siper
    if 38 <= _b[0] <= 48 and -53 <= _b[1] <= -42 and _b[5] > 1.2: _b[5] = 1.2
# iç içe kasalar: küçüğü büyüğün üstüne yığılır (7. alan: taban yüksekliği), benzer boyda olanlardan küçüğü atılır
def _obb_pts(bx, n=5):
    cx, cz, w, d, ry = bx[:5]; c, s_ = np.cos(ry), np.sin(ry); out = []
    for i in range(n):
        for j in range(n):
            u = (i + 0.5) / n * w - w / 2; v = (j + 0.5) / n * d - d / 2
            out.append((cx + u * c + v * s_, cz - u * s_ + v * c))
    return out
def _inside(bx, x, z):
    cx, cz, w, d, ry = bx[:5]; c, s_ = np.cos(ry), np.sin(ry); dx, dz = x - cx, z - cz
    u = dx * c - dz * s_; v = dx * s_ + dz * c
    return abs(u) <= w / 2 and abs(v) <= d / 2
def _grow(bx, m): return [bx[0], bx[1], bx[2] + 2 * m, bx[3] + 2 * m] + list(bx[4:])
def _corn(bx):
    cx, cz, w, d, ry = bx[:5]; c, s_ = np.cos(ry), np.sin(ry)
    return [(cx + u * c + v * s_, cz - u * s_ + v * c) for (u, v) in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]
def _obb_hit(a, b2, m=0.04):
    A, B = _corn(a), _corn(b2)
    for P in (A, B):
        for i in range(2):
            ex, ez = P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]; L = np.hypot(ex, ez) or 1.0; ax = (-ez / L, ex / L)
            pa = [x * ax[0] + z * ax[1] for (x, z) in A]; pb = [x * ax[0] + z * ax[1] for (x, z) in B]
            if min(max(pa), max(pb)) - max(min(pa), min(pb)) < m: return False
    return True
boxes.sort(key=lambda q: -q[2] * q[3])
_keep = []
for bx in boxes:
    bx = list(bx) + [0.0] if len(bx) < 7 else list(bx)
    drop = False
    for big in _keep:
        f = np.mean([_inside(big, x, z) for (x, z) in _obb_pts(bx)])
        if f < 0.12: continue
        if bx[2] * bx[3] < 0.6 * big[2] * big[3] and big[6] == 0 and big[5] < 2.5: bx[6] = big[5]          # üstüne yığ
        else: drop = True
        break
    if not drop: _keep.append(bx)
REMOVE_BOXES = [(-46.05, 38.55)]                              # elle: duvara / yamaca gömülü kasa (kullanıcı: Titanic yanındaki büyük kasa)
_keep = [b_ for b_ in _keep if not any(abs(b_[0] - rx) < 0.6 and abs(b_[1] - rz) < 0.6 for (rx, rz) in REMOVE_BOXES)]
print('kasa çakışma: atılan', len(boxes) - len(_keep), 'yığılan', sum(1 for q in _keep if q[6] > 0))
boxes = _keep
print('kutu', len(boxes))

# yükseklik ızgarası (0,5 m): CS2 genel bakış görseli zemini YÜKSEKLİĞE göre boyar → düz alanlar sabit renk (katlar), rampa / merdivenler gradyan.
# Ölçülen katlar (r−b): −44 Mid Doors / CT Mid / Lower Tunnels · −35 Mid · −25 Long / Short / Outside Long · −11 B Site · +3 A Site / Upper Tunnels / B Plat · +23 T Spawn.
# Doğrusal: −44 → 0 m, +23 → 6,6 m (Source: ~260 birim). Yumuşatma yok: kat sınırları keskin sahanlık (geçilemez), gradyanlar rampa.
HCELL = 0.5
HOFF = -2.0
NHX = int(np.ceil(PW * S / HCELL)) + 1; NHZ = int(np.ceil(PH * S / HCELL)) + 1
hmask = (~void) & (rot(sat) >= 6) & (~orange) & (~green)          # rampa gradyanının ortası düşük doygunluklu: 'floor' maskesi onu dışlıyordu
_rg = rot(rgb).astype(int)
_halo = ((_rg[..., 0] - _rg[..., 1]) > 4) | ((_rg[..., 1] - _rg[..., 0]) > 40)     # turuncu (bomba alanı) / yeşil (alım) çerçevenin karışık renkli kenarı: zemin r<g ve g−r<~25
hmask &= ~ndi.binary_dilation(void | (rot(sat) < 6) | box | thin_light | orange | green | _halo, iterations=3)   # duvar / kutu / çizgi kenarının karışık renkli pikselleri (sahte tümsek) alınmaz
# Parlaklıktan bağımsız ton oranı q = (r−b)/(r+g+b): radar duvar diplerini koyulaştırıyor (gölge) → r−b kullanılınca duvar diplerinde sahte kum tepeleri çıkıyordu.
_rgbr = rot(rgb).astype(float)
qpx = (_rgbr[..., 0] - _rgbr[..., 2]) / (_rgbr.sum(-1) + 1.0)
_rr, _cc = np.nonzero(hmask)
_ci = np.minimum((_rr * S / HCELL).astype(int), NHZ - 1) * NHX + np.minimum((_cc * S / HCELL).astype(int), NHX - 1)
_sum = np.bincount(_ci, weights=qpx[_rr, _cc], minlength=NHX * NHZ); _cnt = np.bincount(_ci, minlength=NHX * NHZ)
_px_per_cell = (HCELL / S) ** 2
valid = (_cnt > 0.4 * _px_per_cell).reshape(NHZ, NHX)
avg = np.where(valid, (_sum / np.maximum(_cnt, 1)).reshape(NHZ, NHX), np.nan)
idx = ndi.distance_transform_edt(~valid, return_distances=False, return_indices=True)
avg = avg[idx[0], idx[1]]
avg = ndi.median_filter(avg, size=3)
# kat düzlükleri (radarın en sık 5 rengi) ve ara Mid eğimi → metre; aralarında doğrusal (rampa)
Q_LV = [-0.209, -0.150, -0.102, -0.043, 0.011, 0.081]
H_LV = [0.0, 0.9, 1.9, 3.2, 4.6, 6.6]
h = np.interp(avg, Q_LV, H_LV)

# doğuş (alım) bölgeleri: taralı CT bölgesinin çizgileri yükseklik gürültüsü yaratıyordu → geniş medyan süzgeci
_ctv = []
for (gx0, gz0, gx1, gz1) in zones['green']:
    if (gz0 + gz1) / 2 < 0:
        c0, c1 = int((gx0 - X0) / HCELL), int(np.ceil((gx1 - X0) / HCELL)); r0, r1 = int((gz0 - Z0) / HCELL), int(np.ceil((gz1 - Z0) / HCELL))
        _ctv.append(h[max(0, r0):r1, max(0, c0):c1].ravel())
CT_LEVEL = float(np.percentile(np.concatenate(_ctv), 15)) if _ctv else 0.0
for (gx0, gz0, gx1, gz1) in zones['green']:
    c0, c1 = int((gx0 - X0) / HCELL), int(np.ceil((gx1 - X0) / HCELL)); r0, r1 = int((gz0 - Z0) / HCELL), int(np.ceil((gz1 - Z0) / HCELL))
    blk = h[max(0, r0):r1, max(0, c0):c1]
    if not blk.size: continue
    if (gz0 + gz1) / 2 < 0: blk[:] = CT_LEVEL                            # CT avlusu: taralı kısım üst katın (köprü) gölgesi; zemin tek kotta düz
    else: blk[:] = ndi.median_filter(blk, size=9)

# ── elle rampalar (radarda merdiven gradyanı görünmeyen yerler: çatı altında kalan merdivenler) [x0, z0, x1, z1, eksen] ──
# eksen 'z': z0 kenarındaki kottan z1 kenarındaki kota doğrusal; 'x' benzer
# ── Short köprüsü: radardaki taralı alan CT Spawn'ın ÜSTÜNDEN geçen Short (catwalk) köprüsüdür. Altında CT avlusu (zemin), üstünde
#    köprü tabliyesi (colgecidi.js'te 'plat' kutusu). Köprü uçları: güneyde Short şeridi (4,6 m, merdivenle Short'a iner), kuzeyde A platosu.
BRIDGE = [15.0, -51.0, 23.0, -35.0, 4.6]
OVERRIDE_LEVELS = [
    [15.0, -59.5, 23.5, -51.0, 'flat', 4.6],          # köprünün kuzey ucu: A platosu
    [15.0, -35.0, 23.0, -27.5, 'flat', 4.6],          # köprünün güney ucu: Short şeridi
    [15.0, -27.5, 23.0, -21.5, 'zramp', 4.6, 1.9],    # Short merdiveni: şeritten Short / Cat seviyesine
    [13.5, -50.0, 23.0, -35.0, 'flat', 'CT'],         # köprü altı: CT avlusu kotu (batı ağzındaki 1 m'lik basamak kalksın)
    # A önü (kemer avlusu): düzgün dikdörtgen kotlar → kenarlar düz istinat duvarı olur (önceden radar gürültüsüyle basamaklı / yıkık görünüyordu)
    [23.0, -51.0, 38.0, -47.0, 'flat', 4.6],          # A platosu: köprü inişi ile A Default arası
    [23.5, -59.5, 38.5, -51.0, 'flat', 4.6],          # A platosu kuzeyi (Ninja tarafı, bina duvarına kadar)
    [38.0, -53.0, 48.0, -42.0, 'flat', 4.6],          # A Default platformu (bomba noktası)
    [23.3, -47.0, 38.0, -34.7, 'xramp', 0.4, 1.3],    # kemer avlusu: CT kotundan doğuya hafif yükselir
    [38.0, -42.0, 47.5, -34.7, 'xramp', 1.3, 1.9],    # avlunun doğu ucu → Long / A Ramp kotu
    # A sahası ↔ A Ramp: düz kot + tek eğim → aradaki kenar düz tek istinat duvarı (ara kotlardan iç içe kırık parçalar oluşuyordu)
    [38.0, -60.0, 48.0, -53.0, 'flat', 4.6],
    [48.0, -59.0, 57.5, -45.0, 'zramp', 4.6, 1.9],
    # B: fotoğraflardaki gibi tek kotlu avlu (saha + kapı önü + doğu çıkıntısı 1,9 m); B Plat / Back Plat 1 m yüksek, sahaya 5 m'lik basamaksız iniş
    [-67.0, -73.0, -52.5, -47.5, 'flat', 2.9],          # B Plat + Back Plat tek kot (duvar içleri dahil: içeride kat kenarı kalmasın)
    [-52.5, -61.0, -34.5, -48.5, 'flat', 1.9],
    [-52.5, -48.5, -36.6, -36.0, 'flat', 1.9],
    [-52.5, -66.0, -38.0, -61.0, 'flat', 1.9],          # sahanın arka duvar önü (raf gibi yüksek şerit kalmasın)
    [-64.0, -47.6, -50.5, -45.5, 'flat', 1.9],          # B Plat güney kenarı: radar duvar çizgisi dar sırt olmuştu → temiz 1 m'lik kenar
    [-54.5, -56.5, -51.0, -51.5, 'xramp', 2.9, 1.9],
    [-40.0, -42.5, -34.0, -35.0, 'flat', 1.9],          # B Doors kapısı altı düz (kanatlar eğimde havada / gömülü kalıyordu)
    [-34.0, -42.5, -28.0, -35.0, 'xramp', 1.9, 1.1],
    # Mid catwalk: Mid'in doğu kenarında yükseltilmiş şerit (radarda batı kenarı ince duvar çizgisi). Güneyde Top Mid'den, kuzeyde Short'tan rampa.
    [-1.3, -8.5, 3.6, 7.5, 'flat', 2.6],
    [-1.3, 7.5, 3.6, 12.0, 'zramp', 2.6, 1.9],
    [-1.3, -12.5, 3.6, -8.5, 'zramp', 1.9, 2.6],      # kuzey ucu: Short'a ve Xbox önünden Mid'e (z −14…−12 basamaksız)
    [-5.5, -12.5, -1.3, -9.0, 'flat', 0.2],            # Xbox önü Mid kotunda: catwalk'a 3 sandıkla çıkılır (colgecidi.js)
    # T Spawn doğusu: avludan Outside Long / Top Mid kotuna düzgün yokuş
    [-31.0, 52.5, -5.0, 66.6, 'flat', 6.6],            # T Spawn platosu: tek düz kot (çıkıntı / kırık parça yok)
    [-5.0, 52.5, 11.0, 71.2, 'xramp', 6.6, 1.9],       # T rampası: 16 m'de 4,7 m (~16°); güneydeki nişler dahil bina duvarına (z 71,2) kadar aynı eğim (yan saklanma yeri yok)
    [11.0, 52.5, 16.0, 71.2, 'flat', 1.9],
    # Tüneller: Upper Tunnels düz 4,6; Outside Tunnels düz 1,9; aradaki merdiven radardaki açıklık boyunca tek eğim
    [-64.0, -15.0, -36.5, -0.5, 'flat', 4.6],
    [-36.5, -10.5, -31.5, -6.0, 'flat', 4.6],          # spiralin iç bloğu (üst kat)
    [-52.5, -0.5, -44.0, 8.5, 'flat', 4.6],
    [-61.5, 8.5, -35.5, 12.0, 'flat', 4.6],
    [-62.0, 18.5, -34.0, 26.0, 'flat', 1.9],
    [-62.0, 12.0, -34.0, 18.5, 'zramp', 4.6, 1.9],     # Outside Tunnels merdiveni: koridorun TAM genişliği tek rampa (yan platform / uçurum kenarı / taş basamak yok)
    # Spiral (Upper → Lower Tunnels): doğuya iniş + sahanlık + kuzeye iniş
    [-36.5, -6.0, -31.5, -1.5, 'xramp', 4.6, 2.3],
    [-31.5, -6.0, -27.5, -1.5, 'flat', 2.3],
    [-31.5, -12.5, -27.5, -6.0, 'zramp', 0.0, 2.3],
    # B Tunnels çıkışı: koridor duvardan duvara tek rampa (Upper Tunnels 4,6 → B önü 1,9)
    [-62.5, -29.5, -53.5, -20.0, 'zramp', 1.9, 4.6],
    [23.5, 5.0, 32.5, 24.5, 'flat', 1.9],               # Long Doors odası: iki kapı arası düz (kapı altında kum tümseği kalmasın)
    # Titanic altı şerit (eski sahte bina yeri) Outside Tunnels kotunda
    [-52.5, 33.5, -41.3, 36.0, 'flat', 1.9],
    # Pit: Long Corner'dan dik iniş, taban −1,2 m; doğusundaki sahanlık Long'dan bir basamak boyu (1 m) yüksek
    [47.5, 4.5, 58.5, 9.0, 'zramp', 1.9, -1.2],
    [47.5, 9.0, 58.5, 26.5, 'flat', -1.2],
    [58.5, 7.5, 64.5, 23.5, 'flat', 2.9],
    # Side Pit şeridi (eski kalın duvarın yeri) Side Pit kotunda; Pit'e geçiş alçak duvarla
    [44.5, 7.5, 47.5, 25.0, 'flat', 1.9],
]
ovr_ramp = np.zeros(h.shape, bool)                  # elle rampa hücreleri (dik eğim temizliği dokunmaz)
for L in OVERRIDE_LEVELS:
    (ra, ca_), (rb, cb_) = (int(round((L[1] - Z0) / HCELL)), int(round((L[0] - X0) / HCELL))), (int(round((L[3] - Z0) / HCELL)), int(round((L[2] - X0) / HCELL)))
    ra0, ca0 = ra, ca_; ra, ca_ = max(0, ra), max(0, ca_)                  # ızgara dışına taşan uç: kırp (negatif indis dilimi boşaltıyordu)
    if L[4] != 'flat': ovr_ramp[ra:rb + 1, ca_:cb_ + 1] = True
    if L[4] == 'flat': h[ra:rb + 1, ca_:cb_ + 1] = CT_LEVEL if L[5] == 'CT' else L[5]
    elif L[4] == 'xramp':
        for c in range(ca_, cb_ + 1): h[ra:rb + 1, c] = L[5] + (L[6] - L[5]) * (c - ca0) / max(1, cb_ - ca0)
    else:
        for r in range(ra, rb + 1): h[r, ca_:cb_ + 1] = L[5] + (L[6] - L[5]) * (r - ra0) / max(1, rb - ra0)

# kum yığınları: duvar dibindeki bir doğru parçasından uzaklaştıkça alçalan koni (yürünebilir eğim). [x0, z0, x1, z1 (parça), tepe kotu, eğim]
SAND_PILES = [
    [-35.45, -48.4, -35.45, -46.8, 2.6, 0.55],          # Window tarafı: B penceresine çıkış (pencere altı 3,7 m; yığın tepesinden ~0,8 m sıçrama)
]
for (sx0, sz0, sx1, sz1, top_, k_) in SAND_PILES:
    R_ = (top_ - 0.0) / k_
    r0 = max(0, int((min(sz0, sz1) - R_ - Z0) / HCELL)); r1 = min(NHZ, int((max(sz0, sz1) + R_ - Z0) / HCELL) + 2)
    c0 = max(0, int((min(sx0, sx1) - R_ - X0) / HCELL)); c1 = min(NHX, int((max(sx0, sx1) + R_ - X0) / HCELL) + 2)
    for r in range(r0, r1):
        for c in range(c0, c1):
            px, pz = X0 + c * HCELL, Z0 + r * HCELL
            t = np.clip(((px - sx0) * (sx1 - sx0) + (pz - sz0) * (sz1 - sz0)) / max((sx1 - sx0) ** 2 + (sz1 - sz0) ** 2, 1e-9), 0, 1)
            d = np.hypot(px - (sx0 + t * (sx1 - sx0)), pz - (sz0 + t * (sz1 - sz0)))
            v = top_ - k_ * d
            if v > h[r, c] + 0.02 and px > sx0 - 0.3: h[r, c] = v; ovr_ramp[r, c] = True

OVERRIDE_RAMPS = [
]
def hcell(x, z): return int(round((z - Z0) / HCELL)), int(round((x - X0) / HCELL))
for (rx0, rz0, rx1, rz1, ax) in OVERRIDE_RAMPS:
    (ra, ca_), (rb, cb_) = hcell(rx0, rz0), hcell(rx1, rz1)
    if ax == 'z':
        h_a = np.median(h[max(0, ra - 2):ra + 1, ca_:cb_ + 1]); h_b = np.median(h[rb:rb + 3, ca_:cb_ + 1])
        for r in range(ra, rb + 1): h[r, ca_:cb_ + 1] = h_a + (h_b - h_a) * (r - ra) / max(1, rb - ra)
    else:
        h_a = np.median(h[ra:rb + 1, max(0, ca_ - 2):ca_ + 1]); h_b = np.median(h[ra:rb + 1, cb_:cb_ + 3])
        for c in range(ca_, cb_ + 1): h[ra:rb + 1, c] = h_a + (h_b - h_a) * (c - ca_) / max(1, cb_ - ca_)

# ── kat geçişi onarımı: gerekli komşu bölgeler arasında yalnızca dik kenar (oyunda yürünmez: eğim > 0,95) varsa, en ucuz yol boyunca
#    ~4 m genişliğinde rampa açılır (gerçek haritada orada merdiven / rampa var: spiral, Short merdiveni, Cat…). Rampa eğimi ≤ 0,5.
STEP_MAX = 0.25
def steep_mask():
    gy, gx = np.gradient(h, HCELL)
    m = np.hypot(gx, gy) > 0.95                                             # oyundaki eşikle aynı (NavGrid: eğim > 0,95 geçilmez)
    e = np.zeros_like(m)                                                    # kat kenarı duvarı konacak yerler (komşu fark > 0,6 m) ve 1 hücre payı da geçilmez
    e[:, :-1] |= np.abs(np.diff(h, axis=1)) > 0.6; e[:, 1:] |= np.abs(np.diff(h, axis=1)) > 0.6
    e[:-1, :] |= np.abs(np.diff(h, axis=0)) > 0.6; e[1:, :] |= np.abs(np.diff(h, axis=0)) > 0.6
    return m | e
def hroute(a_, b_, allow_steep, B):
    INF = 1e18; H_, W_ = solid.shape; dist = np.full((H_, W_), INF); prev = {}
    dist[a_] = 0; pq = [(0.0, a_[0], a_[1])]
    while pq:
        d, r, c = _hq.heappop(pq)
        if d > dist[r, c]: continue
        if (r, c) == b_: break
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            r2, c2 = r + dr, c + dc
            if r2 < 0 or c2 < 0 or r2 >= H_ or c2 >= W_ or solid[r2, c2]: continue
            if B[r2, c2] and not allow_steep: continue
            nd = d + 1 + (25 if B[r2, c2] else 0)
            if nd < dist[r2, c2]: dist[r2, c2] = nd; prev[(r2, c2)] = (r, c); _hq.heappush(pq, (nd, r2, c2))
    if dist[b_] >= INF: return INF, []
    path = [b_]
    while path[-1] in prev: path.append(prev[path[-1]])
    return dist[b_], path[::-1]
ramps = []
ramp_mask = np.zeros_like(h, dtype=bool)                               # rampa yapılan hücreler: kat kenarı duvarı konmaz
# Hangi çiftlere rampa açılacağı OYUNUN yol bulucusuna göre belirlenir: scripts/cglinks.mjs WRITE=1 kopuk çiftleri tools/ramp_pairs.json'a yazar.
import os as _os
RAMP_PAIRS = [tuple(x) for x in json.load(open('tools/ramp_pairs.json', encoding='utf-8'))] if _os.path.exists('tools/ramp_pairs.json') else []
for (na, nb_) in RAMP_PAIRS:
    B = steep_mask()
    ca, cb = nearest_open(call_cell(na), avoid=B), nearest_open(call_cell(nb_), avoid=B)
    _, pth = hroute(ca, cb, True, B)
    if not pth: continue
    h_orig = h.copy()
    hp = np.array([h[q] for q in pth])
    for _it in range(400):
        old = hp.copy()
        for i in range(1, len(hp)): hp[i] = np.clip(hp[i], hp[i - 1] - STEP_MAX, hp[i - 1] + STEP_MAX)
        for i in range(len(hp) - 2, -1, -1): hp[i] = np.clip(hp[i], hp[i + 1] - STEP_MAX, hp[i + 1] + STEP_MAX)
        if np.abs(hp - old).max() < 1e-4: break
    ch = 0
    for k, (q, hn) in enumerate(zip(pth, hp)):
        if abs(hn - h_orig[q]) < 1e-3: continue
        ch += 1
        for dr in range(-5, 6):
            for dc in range(-5, 6):
                r2, c2 = q[0] + dr, q[1] + dc
                if 0 <= r2 < h.shape[0] and 0 <= c2 < h.shape[1] and r2 < NZ and c2 < NX and not solid[r2, c2] and abs(h_orig[r2, c2] - h_orig[q]) < 0.6:
                    if dr * dr + dc * dc <= 25: h[r2, c2] = hn; ramp_mask[r2, c2] = True
    ramps.append((na, nb_, ch))
print('kat geçişi rampası', len(ramps), ramps)

# elle doldurulan bina kütleleri (aynı çokgen hattından geçer: tek tip bina, ayrı yama kutusu değil) [x0, z0, x1, z1]
OVERRIDE_FILL = [
    [-53.1, -10.7, -52.1, -9.7],   # Upper Tunnels ince kolon
    [-37.0, -58.6, -36.0, -49.0],  # B sahası doğu duvarı (kuzey bina ile pencere arası)
    [-37.0, -46.2, -36.0, -42.0],  # B sahası doğu duvarı (pencere ile B Doors arası)
    [6.5, -51.6, 15.0, -42.65],    # CT Spawn kuzey cebi (kapılı bina önü): kullanıcı kolona kadar kapalı istedi
]
for (fx0, fz0, fx1, fz1) in OVERRIDE_FILL:
    solid[int(round((fz0 - Z0) / CELL)):int(round((fz1 - Z0) / CELL)), int(round((fx0 - X0) / CELL)):int(round((fx1 - X0) / CELL))] = True
# ── bina içi kotları: binanın içindeki yükseklik noktaları en yakın sokak kotunu alır. Yoksa bina dibi boyunca (radarın iç rengi farklı) sahte
#    kat kenarı → binanın önünde alçak duvar şeridi çıkıyordu.
_sp = np.pad(solid, ((1, NHZ - NZ), (1, NHX - NX)), constant_values=False)[:NHZ + 1, :NHX + 1]
_in = _sp[:-1, :-1] & _sp[1:, :-1] & _sp[:-1, 1:] & _sp[1:, 1:]          # köşe (r, c): çevresindeki 4 hücre de katı
_in = _in[:NHZ, :NHX]
if _in.any():
    _ix = ndi.distance_transform_edt(_in, return_distances=False, return_indices=True)
    h = h[_ix[0], _ix[1]]
print('bina içi kot eşitleme', int(_in.sum()))

# ── dik eğim temizliği: yürünemeyecek kadar dik (> 0,9) ama tek basamak olmayan eğimler testere dişi görünüyordu → en yakın kata oturtulur,
#    keskin kat kenarı olur (istinat duvarı alır). Gerçek rampalar (≤ 0,5) etkilenmez.
for _pass in range(3):
    _gy, _gx = np.gradient(h, HCELL)
    _st = np.hypot(_gx, _gy) > 0.9
    if not _st.any(): break
    _hmax = ndi.maximum_filter(h, size=5); _hmin = ndi.minimum_filter(h, size=5)
    h = np.where(_st & ~ramp_mask & ~ovr_ramp, np.where(h - _hmin > _hmax - h, _hmax, _hmin), h)
print('dik eğim temizliği tamam')
# ── dar sırt / hendek temizliği: iki yanı da > 0,6 m alçak (ya da yüksek) 1–2 hücrelik şeritler (radar çizgisi / gölge) iç içe iki istinat duvarı
#    üretiyordu → komşu kata oturtulur.
_nr = 0
for _pass in range(3):
    ch = 0
    for ax in (0, 1):
        for w in (1, 2):
            a = np.roll(h, w, axis=ax); b2 = np.roll(h, -1, axis=ax) if w == 1 else np.roll(h, -2, axis=ax)
            if w == 2:                                                        # 2 hücre: kendisi ve +1 komşusu birlikte sırt
                mid2 = np.roll(h, -1, axis=ax)
                lo_side = np.minimum(np.roll(h, 1, axis=ax), b2)
                ridge = (np.minimum(h, mid2) - np.maximum(np.roll(h, 1, axis=ax), b2) > 0.6)
                trench = (np.minimum(np.roll(h, 1, axis=ax), b2) - np.maximum(h, mid2) > 0.6)
            else:
                ridge = (h - np.maximum(a, b2) > 0.6); trench = (np.minimum(a, b2) - h > 0.6)
            m = (ridge | trench) & ~ovr_ramp
            if m.any():
                tgt = np.where(ridge, np.maximum(np.roll(h, 1, axis=ax), b2 if w == 1 else b2), np.minimum(np.roll(h, 1, axis=ax), b2))
                h = np.where(m, tgt, h)
                if w == 2:
                    m1 = np.roll(m, 1, axis=ax); h = np.where(m1 & ~ovr_ramp, np.roll(tgt, 1, axis=ax), h)
                ch += int(m.sum())
    _nr += ch
    if not ch: break
print('dar sırt / hendek temizliği', _nr)

# ── kat kenarları (istinat duvarı) ─────────────────────────────────────────────────────────────────────────────────────────────
# Komşu iki yükseklik noktası arasında > CL fark = keskin kenar (duvar). CL küçük (0,3): yarı yamaç / yarı duvar görünümü kalmaz; 0,5 m'ye kadar
# basamaklar oyuncunun çıkabileceği alçak duvardır. Rampa hücreleri (elle rampa / otomatik rampa) kenar üretmez.
# Birim kenarlar zincirlenir, (x, z) düzleminde sadeleştirilir → düz / çapraz tek duvar; her duvarın TEPESİ DÜZ (parçadaki en yüksek üst kot).
# Çarpışma kutuları da aynı tepe kotunu kullanır (görsel = çarpışma). Çıktı:
#   cliffs  [yön, düzlem, a0, a1, alt, üst]   çarpışma (görünmez)
#   cliffv  [x0, z0, x1, z1, alt, üst]        görsel duvar parçası (colgecidi.js: tek yönlü kutu + üst şerit)
CL = 0.3
def merge_runs(items):
    out = []
    for it in items:
        if out and out[-1][0] == it[0] and abs(out[-1][1] - it[1]) < 1e-6 and abs(out[-1][3] - it[2]) < 1e-6 and abs(out[-1][4] - it[4]) < 0.35 and abs(out[-1][5] - it[5]) < 0.02:
            o = out[-1]; o[3] = it[3]; o[4] = min(o[4], it[4]); o[5] = max(o[5], it[5])
        else: out.append(list(it))
    return out
_free_v = lambda r, c: (r < NZ and c < NX and not solid[min(r, NZ - 1), min(c, NX - 1)])
_ex = ramp_mask | ovr_ramp
_us = []                                                        # birim kenarlar: (yön, düzlem, a0, a1, alt, üst, p0, p1)
for c in range(NHX - 1):
    for r in range(NHZ):
        if abs(h[r, c + 1] - h[r, c]) > CL and (_free_v(r, c) or _free_v(r, c + 1)) and not (ramp_mask[r, c] or ramp_mask[r, c + 1] or (ovr_ramp[r, c] and ovr_ramp[r, c + 1])):
            x = round(X0 + (c + 0.5) * HCELL, 3); za, zb = round(Z0 + (r - 0.5) * HCELL, 3), round(Z0 + (r + 0.5) * HCELL, 3)
            _us.append((0, x, za, zb, float(min(h[r, c], h[r, c + 1])), float(max(h[r, c], h[r, c + 1])), (x, za), (x, zb)))
for r in range(NHZ - 1):
    for c in range(NHX):
        if abs(h[r + 1, c] - h[r, c]) > CL and (_free_v(r, c) or _free_v(r + 1, c)) and not (ramp_mask[r, c] or ramp_mask[r + 1, c] or (ovr_ramp[r, c] and ovr_ramp[r + 1, c])):
            z = round(Z0 + (r + 0.5) * HCELL, 3); xa, xb = round(X0 + (c - 0.5) * HCELL, 3), round(X0 + (c + 0.5) * HCELL, 3)
            _us.append((1, z, xa, xb, float(min(h[r, c], h[r + 1, c])), float(max(h[r, c], h[r + 1, c])), (xa, z), (xb, z)))
from collections import defaultdict as _dd
_adj = _dd(list)
for k, u in enumerate(_us): _adj[u[6]].append(k); _adj[u[7]].append(k)
_used = [False] * len(_us); _chains = []
def _walk(start, k0):
    pts = [start]; segs = []; v = start; k = k0
    while k is not None and not _used[k]:
        _used[k] = True; segs.append(k)
        a, b2 = _us[k][6], _us[k][7]; v = b2 if a == v else a; pts.append(v)
        nk = [q for q in _adj[v] if not _used[q]]
        k = nk[0] if len(_adj[v]) == 2 and nk else None
    return pts, segs
for v, ks in list(_adj.items()):
    if len(ks) != 2:
        for k in ks:
            if not _used[k]: _chains.append(_walk(v, k))
for k in range(len(_us)):
    if not _used[k]: _chains.append(_walk(_us[k][6], k))
def _dp2(P, tol):
    if len(P) < 3: return [0, len(P) - 1]
    A = np.array(P[0]); Bq = np.array(P[-1]); best = -1; bi = 0; ab = Bq - A; den = max(float(ab @ ab), 1e-9)
    for i in range(1, len(P) - 1):
        t = np.clip(float((np.array(P[i]) - A) @ ab) / den, 0, 1)
        d = np.linalg.norm(np.array(P[i]) - (A + t * ab))
        if d > best: best, bi = d, i
    if best <= tol: return [0, len(P) - 1]
    L1 = _dp2(P[:bi + 1], tol); L2 = _dp2(P[bi:], tol)
    return L1[:-1] + [q + bi for q in L2]
cliffs = []; cliffv = []; _seg_top = {}
for pts, segs in _chains:
    if not segs: continue
    # zinciri üst kot sıçramalarında (> 0,6) böl: tek düz tepe iki ayrı katı kapatmasın
    pieces = []; cur = [0]; tmn = tmx = _us[segs[0]][5]                                   # üst kot aralığı > 0,6 olunca parça bölünür: rampa boyunca duvar BASAMAK BASAMAK alçalır
    for q in range(1, len(segs)):
        t_ = _us[segs[q]][5]
        if max(tmx, t_) - min(tmn, t_) > 0.6 or abs(t_ - _us[segs[q - 1]][5]) > 0.6: pieces.append(cur); cur = [q]; tmn = tmx = t_
        else: cur.append(q); tmn = min(tmn, t_); tmx = max(tmx, t_)
    pieces.append(cur)
    for pc in pieces:
        pp = [pts[pc[0]]] + [pts[q + 1] for q in pc]
        ks = [segs[q] for q in pc]
        length = 0.5 * len(ks)
        hmax_ = max(_us[k][5] - _us[k][4] for k in ks)
        if hmax_ < 0.9:                                                                         # alçak basamak (oyuncu 0,5 m'ye kadar kendiliğinden çıkar): yalnız uzun ve eksene hizalı ise kenar olur
            x_a, z_a = pp[0]; x_b, z_b = pp[-1]; ang_ = abs(np.degrees(np.arctan2(z_b - z_a, x_b - x_a))) % 90
            if length < 3.0 or 8 < ang_ < 82: continue                                           # kısa parça ya da çapraz şerit: zemine yatmış levha gibi görünür → kenar yapma
        idx = _dp2(pp, 0.5)
        while len(idx) > 2:                                                                      # < 1,2 m'lik kısa kenarlar sütun / basamak gibi görünür: kısa kenarın iç ucu atılır (komşusuna katılır)
            sl = [(np.hypot(pp[idx[k + 1]][0] - pp[idx[k]][0], pp[idx[k + 1]][1] - pp[idx[k]][1]), k) for k in range(len(idx) - 1)]
            ln, k = min(sl)
            if ln >= 1.2: break
            if k == 0: idx.pop(1)
            elif k == len(idx) - 2: idx.pop(k)
            else: idx.pop(k if np.hypot(pp[idx[k]][0] - pp[idx[k - 1]][0], pp[idx[k]][1] - pp[idx[k - 1]][1]) < np.hypot(pp[idx[k + 2]][0] - pp[idx[k + 1]][0], pp[idx[k + 2]][1] - pp[idx[k + 1]][1]) else k + 1)
        for a, b2 in zip(idx[:-1], idx[1:]):
            sub = ks[a:b2]
            if not sub: continue
            top = max(_us[k][5] for k in sub); lo = min(_us[k][4] for k in sub)
            (x0, z0), (x1, z1) = pp[a], pp[b2]
            if np.hypot(x1 - x0, z1 - z0) < 0.2: continue
            cliffv.append([round(x0, 3), round(z0, 3), round(x1, 3), round(z1, 3), round(lo, 2), round(top, 2)])
            for k in sub: _seg_top[k] = round(top, 2)
_cl = []
for k, u in enumerate(_us):
    if k in _seg_top: _cl.append((u[0], round(u[1], 2), round(u[2], 2), round(u[3], 2), round(u[4], 2), _seg_top[k]))
_cl.sort(key=lambda t: (t[0], t[1], t[2]))
cliffs = merge_runs(_cl)
print('kat kenarı çarpışma', len(cliffs), 'görsel duvar', len(cliffv), '(birim', len(_us), ')')
print('yükseklik', h.min(), h.max())


# ══ BİNA KÜTLELERİ → DÜZGÜN ÇOKGENLER ══
# Katı maske temizlenir (1 hücrelik çentik / çıkıntı / köşegen temas), 16 m'lik bloklara bölünür (her blok parçası tek yükseklikte bir bina),
# parçanın kenar çizgisi izlenir ve sadeleştirilir (0,5 m'lik basamaklar düz çizgi; merdiven gibi çapraz duvarlar gerçek çapraz kenar).
# Görsel: çokgen duvar + çatı (colgecidi.js). Çarpışma: aynı çokgenlerin 0,25 m'lik raster dikdörtgenleri. Süs: yalnız çokgen kenarları (fedges).
TILE = 32
protect = np.zeros_like(solid)
for (ox0, oz0, ox1, oz1, *_h) in OVERRIDE_CARVE:
    protect[int((oz0 - Z0) / CELL):int(np.ceil((oz1 - Z0) / CELL)), int((ox0 - X0) / CELL):int(np.ceil((ox1 - X0) / CELL))] = True
Bm = solid.copy()
for _ in range(3):
    P_ = np.pad(Bm, 1, constant_values=True)
    nb = P_[:-2, 1:-1].astype(int) + P_[2:, 1:-1] + P_[1:-1, :-2] + P_[1:-1, 2:]
    Bm = (Bm | ((~Bm) & (nb >= 3) & ~protect)) & ~(Bm & (nb <= 1) & ~c_void)
    a_, b_, c_, d_ = Bm[:-1, :-1].copy(), Bm[:-1, 1:].copy(), Bm[1:, :-1].copy(), Bm[1:, 1:].copy()
    cb1 = a_ & d_ & ~b_ & ~c_; cb2 = b_ & c_ & ~a_ & ~d_
    Bm[:-1, 1:] |= cb1; Bm[1:, :-1] |= cb1; Bm[:-1, :-1] |= cb2; Bm[1:, 1:] |= cb2
print('temizlik: katı', int(solid.sum()), '→', int(Bm.sum()))

def _trace(m, r0, c0):
    P_ = np.pad(m, 1); nxt = {}
    for r, c in zip(*np.nonzero(m)):
        R, C = r + 1, c + 1; gr, gc = r + r0, c + c0
        if not P_[R - 1, C]: nxt[(gc, gr)] = (gc + 1, gr)
        if not P_[R, C + 1]: nxt[(gc + 1, gr)] = (gc + 1, gr + 1)
        if not P_[R + 1, C]: nxt[(gc + 1, gr + 1)] = (gc, gr + 1)
        if not P_[R, C - 1]: nxt[(gc, gr + 1)] = (gc, gr)
    seen = set(); loops = []
    for s0 in list(nxt):
        if s0 in seen: continue
        L = []; v = s0
        while v not in seen and v in nxt: seen.add(v); L.append(v); v = nxt[v]
        if len(L) >= 4: loops.append(L)
    return loops

def _dp(pts, tol):
    if len(pts) < 3: return list(pts)
    A = np.array(pts[0], float); Bp = np.array(pts[-1], float); d = Bp - A; Ln = np.hypot(*d)
    Pp = np.array(pts, float)
    dist = np.abs(d[0] * (Pp[:, 1] - A[1]) - d[1] * (Pp[:, 0] - A[0])) / Ln if Ln > 1e-9 else np.hypot(Pp[:, 0] - A[0], Pp[:, 1] - A[1])
    i = int(np.argmax(dist))
    if dist[i] <= tol: return [pts[0], pts[-1]]
    return _dp(pts[:i + 1], tol)[:-1] + _dp(pts[i:], tol)

def _simplify(L, tol=0.9):
    n = len(L)
    keep = [L[i] for i in range(n) if (L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]) != (L[(i + 1) % n][0] - L[i][0], L[(i + 1) % n][1] - L[i][1]) and
            not ((L[i][0] - L[i - 1][0]) * (L[(i + 1) % n][1] - L[i][1]) == (L[i][1] - L[i - 1][1]) * (L[(i + 1) % n][0] - L[i][0]))]
    if len(keep) < 3: return keep
    n = len(keep)
    anc = [i for i in range(n) if keep[i][0] % TILE == 0 or keep[i][1] % TILE == 0]
    if len(anc) < 2:
        far = max(range(n), key=lambda i: (keep[i][0] - keep[0][0]) ** 2 + (keep[i][1] - keep[0][1]) ** 2)
        anc = sorted(set([0, far] + anc))
    out = []
    for k in range(len(anc)):
        i0, i1 = anc[k], anc[(k + 1) % len(anc)]
        chain = [keep[j % n] for j in range(i0, (i1 if i1 > i0 else i1 + n) + 1)]
        out += _dp(chain, tol)[:-1]
    return out

def _area(R): return 0.5 * sum(R[i][0] * R[(i + 1) % len(R)][1] - R[(i + 1) % len(R)][0] * R[i][1] for i in range(len(R)))

FINE = 2                                         # çarpışma rasteri: hücre başına 2 (0,25 m)
GL, GN = ndi.label(Bm)                           # küresel bileşenler: renk ve tepe kotu bileşene göre (karo sınırında dikiş olmasın)
_gmx = ndi.maximum(ndi.maximum_filter(h, size=13)[:NZ, :NX], GL, range(1, GN + 1)); _gmn = ndi.minimum(ndi.minimum_filter(h, size=5)[:NZ, :NX], GL, range(1, GN + 1))
polys = []; crects = []; fedges = []
hpad = np.pad(h, 0)
hdil_max = ndi.maximum_filter(h, size=13); hdil_min = ndi.minimum_filter(h, size=5)
free_c = ~Bm & ~c_void
for tr in range(0, NZ, TILE):
    for tc in range(0, NX, TILE):
        sub = Bm[tr:tr + TILE, tc:tc + TILE]
        lab_, n_ = ndi.label(sub)
        for i in range(1, n_ + 1):
            m = lab_ == i
            if m.sum() < 2: continue
            rings = [_simplify(L) for L in _trace(m, tr, tc)]
            rings = [R for R in rings if len(R) >= 3 and abs(_area(R)) > 0.3]
            if not rings: continue
            rs, cs = np.nonzero(m); rs = rs + tr; cs = cs + tc
            hr, hc = np.clip(rs, 0, h.shape[0] - 1), np.clip(cs, 0, h.shape[1] - 1)
            gmax = float(hdil_max[hr, hc].max()); gmin = float(hdil_min[hr, hc].min())
            comp = int(GL[rs[0], cs[0]])
            gtop = float(_gmx[comp - 1]) if comp > 0 and (_gmx[comp - 1] - _gmn[comp - 1]) <= 3.5 else gmax        # düz zeminli bileşen: tek tepe kotu
            top = float(np.ceil((gtop + 6.0) * 2) / 2); base = round(gmin - 0.6, 2)
            W = [[[round(X0 + v[0] * CELL, 3), round(Z0 + v[1] * CELL, 3)] for v in R] for R in rings]
            polys.append([top, base, [[c for p_ in R for c in p_] for R in W], comp])
            # çarpışma: çokgenin 0,25 m'lik raster dikdörtgenleri
            x0_, x1_ = X0 + (cs.min() - 1) * CELL, X0 + (cs.max() + 2) * CELL; z0_, z1_ = Z0 + (rs.min() - 1) * CELL, Z0 + (rs.max() + 2) * CELL
            fx = np.arange(x0_ + CELL / FINE / 2, x1_, CELL / FINE); fz = np.arange(z0_ + CELL / FINE / 2, z1_, CELL / FINE)
            GX, GZ = np.meshgrid(fx, fz); inside = np.zeros(GX.shape, bool)
            for R in W:
                xs = np.array([q[0] for q in R]); zs = np.array([q[1] for q in R]); xj = np.roll(xs, 1); zj = np.roll(zs, 1)
                for k in range(len(xs)):
                    if zs[k] == zj[k]: continue
                    inside ^= ((zs[k] > GZ) != (zj[k] > GZ)) & (GX < (xj[k] - xs[k]) * (GZ - zs[k]) / (zj[k] - zs[k]) + xs[k])
            for (a0, b0, a1, b1) in rects(inside):
                crects.append([round(x0_ + a0 * CELL / FINE, 3), round(z0_ + b0 * CELL / FINE, 3), round(x0_ + a1 * CELL / FINE, 3), round(z0_ + b1 * CELL / FINE, 3), top, base])
            # süs kenarları: dışı yürünebilir zemine bakan, ≥ 1,2 m kenarlar
            for R in W:
                for k in range(len(R)):
                    p0, p1 = R[k], R[(k + 1) % len(R)]
                    dx, dz = p1[0] - p0[0], p1[1] - p0[1]; Ln = np.hypot(dx, dz)
                    if Ln < 1.2: continue
                    nx_, nz_ = dz / Ln, -dx / Ln
                    ok = 0
                    for t in (0.25, 0.5, 0.75):
                        qx, qz = p0[0] + dx * t + nx_ * 0.7, p0[1] + dz * t + nz_ * 0.7
                        cc, rr = int((qx - X0) / CELL), int((qz - Z0) / CELL)
                        if 0 <= rr < NZ and 0 <= cc < NX and free_c[rr, cc]: ok += 1
                    if ok >= 2: fedges.append([p0[0], p0[1], p1[0], p1[1], top])
# kasalar binaların içine girmesin: kasa noktaları katı hücreye düşüyorsa katıdan uzağa (en çok 1,6 m) itilir; olmazsa atılır
def _solid_at(x, z):
    c, r = int((x - X0) / CELL), int((z - Z0) / CELL)
    return 0 <= r < NZ and 0 <= c < NX and Bm[r, c]
_pushed = 0; _dropped = 0; _nb = []
for bx in boxes:
    pts = _obb_pts(_grow(bx, 0.2), 6); hit = [(x, z) for (x, z) in pts if _solid_at(x, z)]
    if hit:
        ok = False
        hx, hz = np.mean([p[0] for p in hit]), np.mean([p[1] for p in hit])
        vx, vz = bx[0] - hx, bx[1] - hz; L = np.hypot(vx, vz) or 1.0; vx, vz = vx / L, vz / L
        for st in np.arange(0.1, 1.65, 0.1):
            cand = [bx[0] + vx * st, bx[1] + vz * st] + list(bx[2:])
            if not any(_solid_at(x, z) for (x, z) in _obb_pts(_grow(cand, 0.2), 6)): bx = [round(float(cand[0]), 2), round(float(cand[1]), 2)] + list(bx[2:]); ok = True; _pushed += 1; break
        if not ok: _dropped += 1; continue
    _nb.append(bx)
boxes = _nb
print('kasa-bina çakışması: itilen', _pushed, 'atılan', _dropped)
print('bina parçası', len(polys), 'çarpışma dikdörtgeni', len(crects), 'cephe kenarı', len(fedges))

# kasalar kat kenarına / eğime binmesin: ayak izi noktalarında yükseklik farkı > 0,35 ise 2 m içinde düz yer aranır, yoksa kasa atılır
def _hat(x, z): return h[int(np.clip(round((z - Z0) / HCELL), 0, NHZ - 1)), int(np.clip(round((x - X0) / HCELL), 0, NHX - 1))]
def _spread(bx):
    hs = [_hat(x, z) for (x, z) in _obb_pts(bx, 4)]
    return max(hs) - min(hs)
_moved = 0; _gone = 0; _kb = []
for bx in boxes:
    if _spread(bx) <= 0.35 and not any(_solid_at(x, z) for (x, z) in _obb_pts(_grow(bx, 0.2), 5)): _kb.append(bx); continue
    done = False
    for rad in np.arange(0.25, 2.1, 0.25):
        for ang in np.linspace(0, 2 * np.pi, 16, endpoint=False):
            cand = [round(float(bx[0] + rad * np.cos(ang)), 2), round(float(bx[1] + rad * np.sin(ang)), 2)] + list(bx[2:])
            if _spread(cand) <= 0.3 and not any(_solid_at(x, z) for (x, z) in _obb_pts(_grow(cand, 0.2), 5)): _kb.append(cand); done = True; _moved += 1; break
        if done: break
    if not done: _gone += 1
boxes = _kb
# kasa-kasa çakışması: büyük önce; çakışan küçük kasa kaçar (en çok 2 m) ya da atılır. Yığılmış (7. alan > 0) kasalar muaf.
boxes.sort(key=lambda q: -q[2] * q[3]); _ok = []; _sh = 0; _dr = 0
for bx in boxes:
    if len(bx) > 6 and bx[6] > 0: _ok.append(bx); continue
    hit = [q for q in _ok if not (len(q) > 6 and q[6] > 0) and _obb_hit(bx, q)]
    if not hit: _ok.append(bx); continue
    done = False
    for rad in np.arange(0.2, 2.05, 0.2):
        for ang in np.linspace(0, 2 * np.pi, 16, endpoint=False):
            cand = [round(float(bx[0] + rad * np.cos(ang)), 2), round(float(bx[1] + rad * np.sin(ang)), 2)] + list(bx[2:])
            if _spread(cand) <= 0.3 and not any(_solid_at(x, z) for (x, z) in _obb_pts(_grow(cand, 0.2), 5)) and not any(_obb_hit(cand, q) for q in _ok if not (len(q) > 6 and q[6] > 0)): _ok.append(cand); done = True; _sh += 1; break
        if done: break
    if not done: _dr += 1
boxes = _ok
print('kasa-kasa çakışması: kaçan', _sh, 'atılan', _dr)
print('kasa-kat kenarı: taşınan', _moved, 'atılan', _gone, 'kalan', len(boxes))
np.save('tools_ref/h_final.npy', h); np.save('tools_ref/solid_final.npy', solid)
data = {
    'S': round(S, 5), 'cell': CELL, 'x0': round(X0, 3), 'z0': round(Z0, 3), 'nx': NX, 'nz': NZ,
    'rects': crects,                              # çarpışma dikdörtgenleri [x0, z0, x1, z1, tepe, taban]
    'polys': polys,                               # bina çokgenleri [tepe, taban, [halka (x,z düz liste)…]] (ilk halka dış, gerisi delik olabilir)
    'fedges': fedges,                             # cephe kenarları [x0, z0, x1, z1, tepe]; dış normal (dz, −dx)
    'cliffs': cliffs,                             # çarpışma (ızgara parçaları, görünmez)
    'cliffv': cliffv,                             # görsel duvar [x0, z0, x1, z1, alt, üst] (tepesi düz)
    'bridge': BRIDGE,
    'boxes': boxes, 'hx0': round(X0, 3), 'hz0': round(Z0, 3), 'hnx': NHX, 'hnz': NHZ, 'hcell': HCELL,
    'h': base64.b64encode(np.round((h - HOFF) * 25).clip(0, 255).astype(np.uint8).tobytes()).decode(), 'hscale': 25, 'hoff': HOFF,      # −2 … 8,2 m, 4 cm adım;      # kot = bayt / 35 + hoff (Pit sıfırın altında)
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

# hata ayıklama: yükseklik haritası (renkli) + dik kenarlar (kırmızı: eğim > 0,95 → geçilemez)
_gy, _gx = np.gradient(h, HCELL)
_sl = np.hypot(_gx, _gy)
_n = (h / max(h.max(), 1e-3))
_img = np.stack([_n * 200 + 30, _n * 160 + 60, (1 - _n) * 200 + 30], -1)
_img[_sl > 0.95] = [255, 40, 40]
Image.fromarray(_img.clip(0, 255).astype(np.uint8)).resize((NHX * 3, NHZ * 3), Image.NEAREST).save('tools_ref/height.png')

