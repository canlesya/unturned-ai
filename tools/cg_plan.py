# Çöl Geçidi v2 (12.171) — yerleşim planı dönüştürücüsü. BİR KEZ çalıştı: eski radar tabanlı haritanın (edc5a75: colgecidiData.js + colgecidiEdits.js,
# kullanıcı düzenlemeleri uygulanmış hâli) yerleşimini sabit, ızgaraya hizalı bir plana çevirdi → src/maps/assets/colgecidi/plan.js.
# Artık kaynak plan.js'tir (elle düzenlenir); radar görseli / dust2_extract.py / colgecidiData.js gerekmez. Yeniden üretmek için:
#   git worktree add /tmp/cg-eski edc5a75 && node scripts/cgplan_dump.mjs /tmp/cg-eski /tmp/cg_old.json
#   python3 tools/cg_plan.py /tmp/cg_old.json src/maps/assets/colgecidi/plan.js [önizleme.png]
# Plan: 0,5 m ızgara (x −66…66, z −71…71; hücre kenarları 0,5'in katları).
#  · Bina kütleleri: eski çokgenler (16 m'lik bölüm = bina:<no>, kimlik korunur), kullanıcı düzenlemeleri (bina:15 −0,5 x, bina:37 +0,25 z, bina:11 silindi).
#    Çapraz kenarlar ≥ 1,5 m'lik temiz basamaklara (cephe girintisi) çevrilir — 0,5 m'lik testere dişi (piksel) kalmaz; her şey eksen hizalı.
#  · Zemin: düz kat (KATLAR) ya da eksen hizalı doğrusal rampa; elle bölgeler (ZEMIN) üstün. Radar gürültüsü / sahte kum yığını / 0,1–0,3 m tümsek atılır.
import json, sys, math
import numpy as np
from scipy import ndimage as ndi

SRC, OUT = sys.argv[1], sys.argv[2]
PNG = sys.argv[3] if len(sys.argv) > 3 else None
O = json.load(open(SRC))
X0, Z0, C, NX, NZ = -66.0, -71.0, 0.5, 264, 284
cx = lambda i: X0 + (i + 0.5) * C
cz = lambda j: Z0 + (j + 0.5) * C
snap = lambda v: round(v * 2) / 2

# ── sınır sadeleştirme (testere dişi / kısa basamak) yardımcıları ──

def trace_loops(free):
    """free: bool[nz, nx]. Sınır kenarları (serbest solda) → köşe listeleri (ızgara köşe koordinatı (i, j))."""
    nz, nx = free.shape
    F = lambda i, j: 0 <= i < nx and 0 <= j < nz and free[j, i]
    out = {}                                       # vertex → list of next vertices
    # hücre (i,j) köşeleri: (i,j) (i+1,j) (i+1,j+1) (i,j+1). Ekranda x sağ, z aşağı. Serbest solda kalacak yön:
    for j in range(nz):
        for i in range(nx):
            if not free[j, i]: continue
            if not F(i, j - 1): out.setdefault((i + 1, j), []).append((i, j))        # üst kenar: sağdan sola (serbest altta → yön -x; z aşağı iken "sol" = +z)
            if not F(i, j + 1): out.setdefault((i, j + 1), []).append((i + 1, j + 1))
            if not F(i - 1, j): out.setdefault((i, j), []).append((i, j + 1))
            if not F(i + 1, j): out.setdefault((i + 1, j + 1), []).append((i + 1, j))
    loops = []
    used = set()
    for v0 in list(out.keys()):
        for w0 in out[v0]:
            if (v0, w0) in used: continue
            loop = [v0]; v, w = v0, w0
            while True:
                used.add((v, w)); loop.append(w)
                cands = [x for x in out.get(w, []) if (w, x) not in used]
                if not cands: break
                if len(cands) > 1:                    # çapraz temas: serbest hücreler 4-bağlı kalsın → sağa dön önceliği
                    d = (w[0] - v[0], w[1] - v[1])
                    def turn(x):
                        e = (x[0] - w[0], x[1] - w[1]); cr = d[0] * e[1] - d[1] * e[0]
                        return 0 if cr < 0 else 1 if cr == 0 else 2
                    cands.sort(key=turn)
                v, w = w, cands[0]
                if w == v0 and (w, ) and (v, w) not in used:
                    used.add((v, w)); break
            if loop[-1] == loop[0]: loop = loop[:-1]
            loops.append(loop)
    return loops

def corners(loop):
    n = len(loop); P = []
    for k in range(n):
        a, b, c = loop[k - 1], loop[k], loop[(k + 1) % n]
        if (b[0] - a[0], b[1] - a[1]) != (c[0] - b[0], c[1] - b[1]): P.append(b)
    return P

def area(P):
    s = 0
    for k in range(len(P)):
        (a, b), (c, d) = P[k], P[(k + 1) % len(P)]
        s += a * d - c * b
    return s / 2

def clean(P):
    """sıfır uzunluklu ve doğrusal ardışık köşeleri at"""
    ch = True
    while ch and len(P) > 4:
        ch = False
        Q = []
        for k in range(len(P)):
            if Q and Q[-1] == P[k]: ch = True; continue
            Q.append(P[k])
        if len(Q) > 1 and Q[0] == Q[-1]: Q.pop(); ch = True
        R = []
        n = len(Q)
        for k in range(n):
            a, b, c = Q[k - 1], Q[k], Q[(k + 1) % n]
            if (a[0] == b[0] == c[0]) or (a[1] == b[1] == c[1]): ch = True; continue
            R.append(b)
        P = R
    return P

def dejog(P, Lmin=3, maxdepth=2):
    """kısa (≤ Lmin−1 hücre) basamakları kaldır. Döner: yeni köşe listesi"""
    P = clean(list(P))
    for it in range(4000):
        n = len(P)
        if n <= 4: break
        L = [abs(P[(k + 1) % n][0] - P[k][0]) + abs(P[(k + 1) % n][1] - P[k][1]) for k in range(n)]
        best = None
        for k in range(n):
            if L[k] >= Lmin: continue
            pk, nk = (k - 1) % n, (k + 1) % n
            a, b = P[k], P[(k + 1) % n]
            dprev = (np.sign(P[k][0] - P[pk][0]), np.sign(P[k][1] - P[pk][1]))
            dnext = (np.sign(P[(nk + 1) % n][0] - P[nk][0]), np.sign(P[(nk + 1) % n][1] - P[nk][1]))
            stair = dprev == dnext
            if not stair and min(L[pk], L[nk]) > maxdepth: continue    # derin çıkıntı / yarık (ince duvar ucu): gerçek
            cost = L[k] * min(L[pk], L[nk])
            if best is None or cost < best[0]: best = (cost, k, stair)
        if best is None: break
        _, k, stair = best
        pk, nk = (k - 1) % n, (k + 1) % n
        a, b = P[k], P[(k + 1) % n]
        v = (b[0] - a[0], b[1] - a[1])
        if stair:
            if L[pk] <= L[nk]:                       # önceki kısa: önceki parçayı (iki köşesini) +v kaydır → k kaybolur
                P[pk] = (P[pk][0] + v[0], P[pk][1] + v[1]); P[k] = (P[k][0] + v[0], P[k][1] + v[1])
            else:                                     # sonraki kısa: sonraki parçayı −v kaydır
                n2 = (nk + 1) % n
                P[nk] = (P[nk][0] - v[0], P[nk][1] - v[1]); P[n2] = (P[n2][0] - v[0], P[n2][1] - v[1])
        else:                                         # çıkıntı / çentik: kısa derinlik kadar k parçasını içeri al
            d = min(L[pk], L[nk])
            u = (np.sign(P[k][0] - P[pk][0]) * d, np.sign(P[k][1] - P[pk][1]) * d)   # önceki yön boyunca
            P[k] = (P[k][0] - u[0], P[k][1] - u[1]); P[(k + 1) % n] = (P[(k + 1) % n][0] - u[0], P[(k + 1) % n][1] - u[1])
        P = clean(P)
    return P

def raster(loops, nx, nz):
    """even-odd: hücre merkezi (i+.5, j+.5) halkaların içinde mi"""
    m = np.zeros((nz, nx), bool)
    ys = np.arange(nz) + 0.5
    for P in loops:
        n = len(P)
        for k in range(n):
            (x0, z0), (x1, z1) = P[k], P[(k + 1) % n]
            if x0 != x1: continue                     # yalnız dikey kenarlar (x sabit) satır kesişimi verir
            lo, hi = min(z0, z1), max(z0, z1)
            rows = np.nonzero((ys > lo) & (ys < hi))[0]
            for j in rows: m[j, int(x0):] ^= True
    return m

# ── 1) bina kütleleri ──
EDIT_MOVE = {15: (-0.5, 0.0), 37: (0.0, 0.25)}
EDIT_DEL = {11}
STEP = 1.5                                         # çapraz kenarın basamak boyu (m)

def rect_ring(ring):
    """çokgen halkası (düz liste) → eksen hizalı halka: çapraza yakın olmayan kenarlar eksene, çaprazlar simetrik basamağa"""
    P = [(ring[k], ring[k + 1]) for k in range(0, len(ring), 2)]
    out = []
    n = len(P)
    for k in range(n):
        (ax, az), (bx, bz) = P[k], P[(k + 1) % n]
        dx, dz = bx - ax, bz - az
        out.append((ax, az))
        if abs(dx) < 0.3 or abs(dz) < 0.3: continue          # eksen hizalı (ya da neredeyse): köşe olduğu gibi (aşağıda ızgaraya oturur)
        L = max(abs(dx), abs(dz)); m = max(1, int(round(L / STEP)))
        if abs(dx) >= abs(dz):                                 # yatay ağırlıklı: yarım x, (z, x)…, yarım x
            x, z = ax + dx / (2 * m), az; out.append((x, z))
            for s in range(m):
                z = az + dz * (s + 1) / m; out.append((x, z))
                x = min(bx, x + dx / m) if dx > 0 else max(bx, x + dx / m)
                if s < m - 1: out.append((x, z))
        else:
            x, z = ax, az + dz / (2 * m); out.append((x, z))
            for s in range(m):
                x = ax + dx * (s + 1) / m; out.append((x, z))
                z = min(bz, z + dz / m) if dz > 0 else max(bz, z + dz / m)
                if s < m - 1: out.append((x, z))
    return [(snap(x), snap(z)) for x, z in out]

def inside(R, x, z):
    c = False
    for k in range(len(R)):
        (ax, az), (bx, bz) = R[k], R[k - 1]
        if (az > z) != (bz > z) and x < (bx - ax) * (z - az) / (bz - az) + ax: c = not c
    return c

mass = np.full((NZ, NX), -1, int)
mtop = np.zeros((NZ, NX))
for k, P in enumerate(O['polys']):
    if k in EDIT_DEL: continue
    top, base, rings = P[0], P[1], P[2]
    dx, dz = EDIT_MOVE.get(k, (0, 0))
    R = [rect_ring([v + (dx if t % 2 == 0 else dz) for t, v in enumerate(r)]) for r in rings]
    xs = [p[0] for p in R[0]]; zs = [p[1] for p in R[0]]
    i0, i1 = max(0, int((min(xs) - X0) / C) - 1), min(NX, int((max(xs) - X0) / C) + 2)
    j0, j1 = max(0, int((min(zs) - Z0) / C) - 1), min(NZ, int((max(zs) - Z0) / C) + 2)
    for j in range(j0, j1):
        for i in range(i0, i1):
            x, z = cx(i), cz(j)
            n_in = sum(1 for r in R if inside(r, x, z))
            if n_in % 2 == 1 and mass[j, i] < 0: mass[j, i] = k; mtop[j, i] = top
RX0, RZ0 = O['x0'], O['z0']; RX1, RZ1 = RX0 + O['nx'] * O['cell'], RZ0 + O['nz'] * O['cell']
outm = np.zeros((NZ, NX), bool)
for j in range(NZ):
    for i in range(NX):
        if cx(i) < RX0 + 0.3 or cx(i) > RX1 - 0.3 or cz(j) < RZ0 + 0.3 or cz(j) > RZ1 - 1.0: outm[j, i] = True
outm &= mass < 0

def nb_count(m):
    p = np.pad(m, 1, constant_values=True)
    return p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]

# temizlik: 1 hücrelik çentik (3 yanı katı boşluk) dolar, 1 hücrelik diken (3 yanı boş katı) kalkar; küçük ada / cep
for it in range(4):
    solid = (mass >= 0) | outm
    fill = (~solid) & (nb_count(solid) >= 3)
    for j, i in zip(*np.nonzero(fill)):
        nbs = [mass[jj, ii] for jj, ii in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1)) if 0 <= jj < NZ and 0 <= ii < NX and mass[jj, ii] >= 0]
        if nbs: mass[j, i] = max(set(nbs), key=nbs.count); mtop[j, i] = max(mtop[jj, ii] for jj, ii in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1)) if 0 <= jj < NZ and 0 <= ii < NX and mass[jj, ii] == mass[j, i])
        else: outm[j, i] = True
    solid = (mass >= 0) | outm
    spike = solid & (nb_count(~solid) >= 3) & ~outm
    mass[spike] = -1; mtop[spike] = 0
solid = (mass >= 0) | outm
lab, n = ndi.label(~solid)
sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
main = 1 + int(np.argmax(sizes))
pockets = (~solid) & (lab != main)
print('kapalı cep hücresi', int(pockets.sum()), '(dolduruldu)')
for j, i in zip(*np.nonzero(pockets)): outm[j, i] = True
solid = (mass >= 0) | outm
# Titanic duvarları (kullanıcı: kenar:6 / kenar:14 tek parça yüksek duvar, üstü 7,85): T platosunun batı ve kuzey kenarı
# B penceresi duvarı (B sahası ↔ Window cebi; açıklığı colgecidi.js kurar): eskiden bina değil ayrı parçaydı → plan hücresi 901
for (x0, z0, x1, z1, k, top) in [(-50.5, 36.5, -49.5, 55.5, 900, 7.85), (-49.5, 36.5, -40.0, 37.5, 900, 7.85), (-37.0, -57.5, -36.0, -54.5, 901, 9.0)]:
    for j in range(int(round((z0 - Z0) / C)), int(round((z1 - Z0) / C))):
        for i in range(int(round((x0 - X0) / C)), int(round((x1 - X0) / C))):
            mass[j, i] = k; mtop[j, i] = top; outm[j, i] = False
solid = (mass >= 0) | outm
# kısa basamakları kaldır (serbest alan sınırı: ≥ 1,5 m'lik düz parçalar; ince duvar ucu / derin girinti korunur)
free0 = ~solid
loops = [dejog(corners(l)) for l in trace_loops(free0)]
free = raster(loops, NX, NZ)
for j, i in zip(*np.nonzero(free0 & ~free)):                   # boştan katıya: komşu kütle (yoksa dış)
    best = None
    for r in range(1, 6):
        for jj in range(j - r, j + r + 1):
            for ii in range(i - r, i + r + 1):
                if 0 <= jj < NZ and 0 <= ii < NX and mass[jj, ii] >= 0 and free0[jj, ii] == False: best = (mass[jj, ii], mtop[jj, ii]); break
            if best: break
        if best: break
    if best: mass[j, i], mtop[j, i] = best
    else: outm[j, i] = True
for j, i in zip(*np.nonzero(~free0 & free)): mass[j, i] = -1; mtop[j, i] = 0; outm[j, i] = False
print('sadeleştirme: boş→katı', int((free0 & ~free).sum()), 'katı→boş', int((~free0 & free).sum()))
solid = ~free

# ── 2) zemin ──
G = O['G']; gv = np.array(G['v']).reshape(G['nz'], G['nx'])
hc = np.zeros((NZ, NX))
for j in range(NZ):
    for i in range(NX): hc[j, i] = np.median(gv[2 * j:2 * j + 2, 2 * i:2 * i + 2])
KATLAR = [-1.2, 0.0, 1.3, 1.9, 2.6, 2.9, 4.6, 6.6]
spec = {}                                           # (j, i) → ('f', h) | ('x', x0, h0, x1, h1) | ('z', z0, h0, z1, h1)
for j, i in zip(*np.nonzero(free)):
    h = hc[j, i]; L = min(KATLAR, key=lambda q: abs(q - h))
    if abs(L - h) < 0.3: spec[(j, i)] = ('f', L)

# elle bölgeler (eski çıkarıcının OVERRIDE_LEVELS'ı + yeni): [x0, z0, x1, z1, tür, h0, h1?] — tür 'f' düz, 'x' x0'da h0 → x1'de h1, 'z' benzer
ZEMIN = [
    # ── B ──
    [-67, -73, -52.5, -47.5, 'f', 2.9],                 # B Plat + Back Plat
    [-52.5, -66, -36, -47.5, 'f', 1.9],                 # B sahası
    [-55.5, -57.5, -52, -51.5, 'x', 2.9, 1.9],          # B Plat → saha basamaksız iniş (platoya oyulmuş yokuş)
    [-64.5, -47.5, -36, -27.5, 'f', 1.9],               # saha güneyi, Box, Fence, Car (B)
    [-40, -43, -35, -34.5, 'f', 1.9],                   # B Doors kapı altı düz
    [-36, -59, -35, -43, 'f', 1.9],                     # B penceresi / Window cebi batı şeridi (yokuş başı kotu)
    [-35, -59, -19, -34.5, 'x', 1.9, 0.0],              # CT Mid ↔ B Doors / Window yokuşu (Window cebi dahil; tek eğim, radar tümseği yok)
    # ── B tünelleri / üst tünel / spiral ──
    [-62.5, -29.5, -53.5, -20.5, 'z', 1.9, 4.6],        # B Tunnels çıkışı: duvardan duvara tek rampa
    [-62.5, -20.5, -53.5, -15, 'f', 4.6],               # B Tunnels üst ucu
    [-65, -15, -36, -0.5, 'f', 4.6],                    # Upper Tunnels
    [-36, -10.5, -32, -6, 'f', 4.6],
    [-36, -6, -32, -1.5, 'x', 4.6, 2.3],                # spiral: doğuya iniş
    [-32, -6, -25.5, -1.5, 'f', 2.3],                   # spiral sahanlığı
    [-32, -12, -25.5, -6, 'z', 0.0, 2.3],               # spiral: kuzeye iniş (Lower Tunnels)
    [-36, -18, -6, -12, 'f', 0.0],                      # Lower Tunnels
    [-52.5, -0.5, -44, 9.5, 'f', 4.6],                  # Upper Tunnels → Outside Tunnels geçidi
    [-61.5, 9.5, -35, 12.5, 'f', 4.6],
    [-62, 12.5, -34, 18.5, 'z', 4.6, 1.9],              # Outside Tunnels merdiveni (tek rampa)
    [-62, 18.5, -34, 36.5, 'f', 1.9],                   # Outside Tunnels (Titanic duvarına kadar)
    # ── T ──
    [-61.5, 36, -50.5, 52.5, 'z', 1.9, 6.6],            # T Spawn batı yokuşu (Outside Tunnels'a iner; Titanic duvarının dışında)
    [-50.5, 37.5, -4, 71, 'f', 6.6],                    # Titanic + T Spawn platosu
    [-40, 36.5, -4, 37.5, 'f', 6.6],
    [-67, 52.5, -50, 71, 'f', 6.6],
    [-4, 52.5, 11, 71.5, 'x', 6.6, 1.9],                # T rampası (Top Mid / Outside Long'a)
    [11, 44, 22, 71.5, 'f', 1.9],
    # ── Orta ──
    [-12, -36, -1.5, -12, 'f', 0.0],                    # Mid Doors koridoru + Xbox önü
    [-11, -12, -1.5, 6.5, 'z', 0.0, 1.9],               # Mid yokuşu (Mid Doors → Top Mid)
    [-16, 6.5, -1.5, 52.5, 'f', 1.9],                   # Top Mid, Green, Suicide
    [-1.5, 12, 3.5, 52.5, 'f', 1.9],
    [-1.5, -8.5, 3.5, 7.5, 'f', 2.6],                   # Cat (catwalk)
    [-1.5, -12, 3.5, -8.5, 'z', 1.9, 2.6],              # Cat → Short
    [-1.5, 7.5, 3.5, 12, 'z', 2.6, 1.9],                # Cat → Top Mid
    [-1.5, -20, 23.5, -12, 'f', 1.9],                   # Short koridoru
    [3.5, 12, 66, 52.5, 'f', 1.9],                        # Outside Long, Long Doors, Blue, Long Corner, Side Pit
    # ── Short / CT / A ──
    [14.5, -27.5, 23.5, -21, 'z', 4.6, 1.9],            # Short merdiveni
    [14.5, -34.5, 23.5, -27.5, 'f', 4.6],               # Short şeridi (köprü güney ucu)
    [-19, -51, 23.5, -34.5, 'f', 0.0],                 # CT Mid + CT Spawn (köprü altı dahil)
    [23.5, -47.5, 38, -34.5, 'x', 0.0, 1.3],             # kemer avlusu (Boost / Elevator): CT'den doğuya hafif yükselir
    [38, -42, 47.5, -34.5, 'x', 1.3, 1.9],
    [14.5, -71, 47.5, -51, 'f', 4.6],                   # A platosu + Ninja
    [23, -51, 47.5, -47.5, 'f', 4.6],
    [38, -47.5, 47.5, -42, 'f', 4.6],                   # A Default
    [38, -71, 60, -58, 'f', 4.6],                       # Goose / Barrels
    [47.5, -58, 60, -44, 'z', 4.6, 1.9],                # A Ramp (doğu bina duvarına kadar)
    [47.5, -44, 66, 2.5, 'f', 1.9],                     # Long
    # ── Pit ──
    [47.5, 2.5, 48, 28, 'f', 1.9],                      # Side Pit kenar şeridi (korkuluk burada)
    [48, 2.5, 58.5, 8, 'z', 1.9, -1.2],                 # Pit inişi
    [48, 8, 58.5, 28, 'f', -1.2],                       # Pit
    [58.5, 7.5, 66, 24, 'f', 2.9],                      # Pit doğu sahanlığı
]
for x0, z0, x1, z1, t, *hh in ZEMIN:
    i0, i1 = int(round((x0 - X0) / C)), int(round((x1 - X0) / C)); j0, j1 = int(round((z0 - Z0) / C)), int(round((z1 - Z0) / C))
    for j in range(max(0, j0), min(NZ, j1)):
        for i in range(max(0, i0), min(NX, i1)):
            if not free[j, i]: continue
            if t == 'f': spec[(j, i)] = ('f', hh[0])
            elif t == 'x': spec[(j, i)] = ('x', float(x0), hh[0], float(x1), hh[1])
            else: spec[(j, i)] = ('z', float(z0), hh[0], float(z1), hh[1])
# atanmamış hücreler: en yakın atanmış komşudan (BFS)
from collections import deque
q = deque(spec.keys()); missing = 0
while q:
    j, i = q.popleft()
    for jj, ii in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1)):
        if 0 <= jj < NZ and 0 <= ii < NX and free[jj, ii] and (jj, ii) not in spec:
            spec[(jj, ii)] = spec[(j, i)]; q.append((jj, ii)); missing += 1
print('komşudan dolan hücre', missing)

def hval(s, x, z):
    if s[0] == 'f': return s[1]
    if s[0] == 'x': return s[2] + (s[4] - s[2]) * (x - s[1]) / (s[3] - s[1])
    return s[2] + (s[4] - s[2]) * (z - s[1]) / (s[3] - s[1])

dev = []
for (j, i), s in spec.items():
    d = hval(s, cx(i), cz(j)) - hc[j, i]
    if abs(d) > 0.4: dev.append((round(cx(i), 1), round(cz(j), 1), round(d, 2)))
print('eski kottan > 0,4 m sapan hücre', len(dev))
# sapmaları kümelere göre özetle
if dev:
    D = np.zeros((NZ, NX), bool)
    for x, z, d in dev: D[int((z - Z0) / C), int((x - X0) / C)] = True
    dl, dn = ndi.label(D)
    for k in range(1, dn + 1):
        jj, ii = np.nonzero(dl == k)
        if len(jj) < 6: continue
        print(f'   küme {len(jj):4d} hücre  x {cx(ii.min()):.1f}…{cx(ii.max()):.1f}  z {cz(jj.min()):.1f}…{cz(jj.max()):.1f}  ort. sapma {np.mean([hval(spec[(a, b)], cx(b), cz(a)) - hc[a, b] for a, b in zip(jj, ii)]):+.2f}')

# ── 3) dikdörtgenlere ayrıştır (aynı özellik, açgözlü) ──
def rects_of(keyf, cells):
    used = set(); out = []
    cs = sorted(cells)
    S = set(cells)
    for (j, i) in cs:
        if (j, i) in used: continue
        k = keyf(j, i)
        i2 = i
        while (j, i2 + 1) in S and (j, i2 + 1) not in used and keyf(j, i2 + 1) == k: i2 += 1
        j2 = j
        while all((j2 + 1, t) in S and (j2 + 1, t) not in used and keyf(j2 + 1, t) == k for t in range(i, i2 + 1)): j2 += 1
        for a in range(j, j2 + 1):
            for b in range(i, i2 + 1): used.add((a, b))
        out.append((k, X0 + i * C, Z0 + j * C, X0 + (i2 + 1) * C, Z0 + (j2 + 1) * C))
    return out

floors = rects_of(lambda j, i: spec[(j, i)], list(spec.keys()))
mcells = [(j, i) for j, i in zip(*np.nonzero(mass >= 0))]
mrects = rects_of(lambda j, i: (int(mass[j, i]), float(mtop[j, i])), mcells)
orects = rects_of(lambda j, i: 0, [(j, i) for j, i in zip(*np.nonzero(outm))])
print('zemin dikdörtgeni', len(floors), 'bina dikdörtgeni', len(mrects), 'dış', len(orects))

# ── 4) eşyalar: eski radar kutuları (kasa:<i>, kullanıcı düzenlemeleri uygulanmış) → eksen hizalı (dönüş 90°'nin katına), 0,25 m'ye oturur,
#    bina hücrelerinden dışarı itilir. Tür: fıçı (küçük taban) · konteyner (h ≥ 2,5) · sandık. Yükseklik: eski tepe − eski zemin.
Gold = O['G']
def old_floor(x, z):
    i = int((x - Gold['x0']) / Gold['c']); j = int((z - Gold['z0']) / Gold['c'])
    return gv[max(0, min(Gold['nz'] - 1, j)), max(0, min(Gold['nx'] - 1, i))]
snap4 = lambda v: round(v * 4) / 4
props = []
for q in O['boxes']:
    e = q['edit'] or {}
    if e.get('del'): continue
    d = e.get('d', [0, 0, 0]); sc = e.get('s', [1, 1, 1])
    k = round(q['ry'] / (math.pi / 2))
    w, dd = (q['w'], q['d']) if k % 2 == 0 else (q['d'], q['w'])
    w, dd = max(0.5, snap4(w * sc[0])), max(0.5, snap4(dd * sc[2]))
    x, z = snap4(q['cx'] + d[0]), snap4(q['cz'] + d[2])
    h = max(0.6, round((q['bmax'][1] - old_floor(q['cx'] + d[0], q['cz'] + d[2])) * 10) / 10)
    kind = 'fıçı' if (q['w'] * q['d'] < 1.5 and max(q['w'], q['d']) < 1.3) else 'konteyner' if q['h'] >= 2.5 else 'sandık'
    if kind == 'fıçı': w = dd = 0.9; h = 1.1
    for it in range(12):                                   # bina hücresine giriyorsa en kısa eksende dışarı
        hit = None
        for jj in range(int(math.floor((z - dd / 2 - Z0) / C)), int(math.ceil((z + dd / 2 - Z0) / C))):
            for ii in range(int(math.floor((x - w / 2 - X0) / C)), int(math.ceil((x + w / 2 - X0) / C))):
                if 0 <= jj < NZ and 0 <= ii < NX and not free[jj, ii]: hit = (ii, jj); break
            if hit: break
        if not hit: break
        ii, jj = hit; cxm, czm = X0 + (ii + 0.5) * C, Z0 + (jj + 0.5) * C
        ex = [X0 + ii * C - (x + w / 2), X0 + (ii + 1) * C - (x - w / 2), Z0 + jj * C - (z + dd / 2), Z0 + (jj + 1) * C - (z - dd / 2)]
        kbest = min(range(4), key=lambda t: abs(ex[t]))
        if kbest < 2: x += ex[kbest]
        else: z += ex[kbest]
    props.append([q['i'], x, z, w, dd, h, kind])
print('eşya', len(props))
# ── 4) yaz ──
fmt = lambda v: ('%.2f' % v).rstrip('0').rstrip('.') if isinstance(v, float) else str(v)
def spec_js(s):
    return "'f', " + fmt(s[1]) if s[0] == 'f' else f"'{s[0]}', {fmt(s[1])}, {fmt(s[2])}, {fmt(s[3])}, {fmt(s[4])}"
with open(OUT, 'w') as f:
    f.write('// Çöl Geçidi v2 yerleşim planı (12.171) — SABİT VERİ, elle düzenlenir. Kaynak: tools/cg_plan.py ile eski radar tabanlı haritadan (edc5a75, kullanıcı\n')
    f.write('// düzenlemeleri uygulanmış) bir kez dönüştürüldü. Izgara 0,5 m, tüm kenarlar 0,5 m\'nin katında (eksen hizalı).\n')
    f.write('// FLOORS: [x0, z0, x1, z1, tür, …] — tür \'f\' düz (h) · \'x\' (xa, ha, xb, hb): x boyunca doğrusal rampa · \'z\' (za, ha, zb, hb). Dikdörtgenler örtüşmez.\n')
    f.write('// MASSES: [bina no, tepe kotu, x0, z0, x1, z1] — bina:<no> kimliği (eski 16 m\'lik çokgen bölümü); aynı numaralı dikdörtgenler tek kütle.\n')
    f.write('// OUTSIDE: oynanış alanı dışı (çevre duvarı / dolgu) dikdörtgenleri.\n')
    f.write('export const GRID = { x0: %s, z0: %s, cell: %s, nx: %d, nz: %d };\n' % (fmt(X0), fmt(Z0), fmt(C), NX, NZ))
    f.write('export const FLOORS = [\n')
    for k, x0, z0, x1, z1 in sorted(floors, key=lambda r: (r[2], r[1])): f.write(f'  [{fmt(x0)}, {fmt(z0)}, {fmt(x1)}, {fmt(z1)}, {spec_js(k)}],\n')
    f.write('];\nexport const MASSES = [\n')
    for (k, top), x0, z0, x1, z1 in sorted(mrects, key=lambda r: (r[0][0], r[2], r[1])): f.write(f'  [{k}, {fmt(top)}, {fmt(x0)}, {fmt(z0)}, {fmt(x1)}, {fmt(z1)}],\n')
    f.write('];\nexport const OUTSIDE = [\n')
    for _, x0, z0, x1, z1 in orects: f.write(f'  [{fmt(x0)}, {fmt(z0)}, {fmt(x1)}, {fmt(z1)}],\n')
    f.write('];\n')
    f.write('// PROPS: [eski kasa no, x, z, w (x boyu), d (z boyu), h (zeminden), tür] — eksen hizalı\nexport const PROPS = [\n')
    for pr in props: f.write(f"  [{pr[0]}, {fmt(float(pr[1]))}, {fmt(float(pr[2]))}, {fmt(float(pr[3]))}, {fmt(float(pr[4]))}, {fmt(float(pr[5]))}, '{pr[6]}'],\n")
    f.write('];\n')
print('yazıldı', OUT)

if PNG:
    from PIL import Image, ImageDraw
    import colorsys
    S = 6
    im = Image.new('RGB', (NX * S, NZ * S), (20, 22, 40)); d = ImageDraw.Draw(im)
    for k, x0, z0, x1, z1 in floors:
        a, b = (x0 - X0) / C * S, (z0 - Z0) / C * S; e, g = (x1 - X0) / C * S - 1, (z1 - Z0) / C * S - 1
        h = k[1] if k[0] == 'f' else (k[2] + k[4]) / 2
        t = (h + 1.5) / 8.5; r, gg, bb = colorsys.hsv_to_rgb(0.75 * t, 0.5 if k[0] == 'f' else 0.9, 0.95)
        d.rectangle([a, b, e, g], fill=(int(r * 255), int(gg * 255), int(bb * 255)))
    for (k, top), x0, z0, x1, z1 in mrects:
        a, b = (x0 - X0) / C * S, (z0 - Z0) / C * S; e, g = (x1 - X0) / C * S - 1, (z1 - Z0) / C * S - 1
        v = int(60 + 12 * (top - 6)); d.rectangle([a, b, e, g], fill=(v, v, v + 30))
    for j in range(NZ):
        for i in range(NX):
            if free[j, i]:
                s = spec[(j, i)]
                for jj, ii in ((j, i + 1), (j + 1, i)):
                    if jj < NZ and ii < NX and free[jj, ii]:
                        xe, ze = (X0 + (i + 1) * C, cz(j)) if ii > i else (cx(i), Z0 + (j + 1) * C)
                        dh = abs(hval(s, xe, ze) - hval(spec[(jj, ii)], xe, ze))
                        if dh > 0.05:
                            col = (255, 40, 40) if dh > 0.55 else (255, 200, 0)
                            if ii > i: d.line([((i + 1) * S, j * S), ((i + 1) * S, (j + 1) * S)], fill=col, width=2)
                            else: d.line([(i * S, (j + 1) * S), ((i + 1) * S, (j + 1) * S)], fill=col, width=2)
    for c in O['CALLOUTS']:
        x, y = (c['x'] - X0) / C * S, (c['z'] - Z0) / C * S
        d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 255, 0)); d.text((x + 4, y - 6), c['name'], fill=(255, 255, 255))
    for g in range(-60, 61, 10):
        d.text(((g - X0) / C * S, 2), str(g), fill=(200, 200, 200)); d.text((2, (g - Z0) / C * S), str(g), fill=(200, 200, 200))
    im.save(PNG)
