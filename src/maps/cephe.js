import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import { FK, makeCepheMaterial } from './cepheSurface.js';
import { FrontTerrain, TK } from './cepheTerrain.js';

// "Batı Cephesi" — Cephe modu haritası (12.158; 160 × 300 m, 8v8–16v16). 1940'lar cephe hattı, saldıran Mavi güneyden (+z) kuzeye (−z) ilerler.
// Dört sektör (her biri iki nokta): 1 Birinci Hat (Kırmızı'nın ön siper sistemi: A Batı Tabyası · B Doğu Kavşağı) → 2 Harap Köy (C Kilise · D Köy Meydanı)
// → 3 Çiftlik (E Ambar · F Orman Kulübesi) → 4 Ana Hat (G Komuta Sığınağı · H Batarya). Sektör düştükçe iki takımın doğuşu kayar (FRONT_STAGES).
// Arazi: FrontTerrain (2 m ızgara + kesik hücreler): siperler gerçek çukur (taban −1,6 m), duvarı arazinin kendisi (çarpışma = görsel), içeriden yalnız
// rampadan / ateş basamağından zıplayarak çıkılır. Ateş basamağı (0,45 m) üstünde ayakta göz kum torbası korkuluğunun üstünde, çömelince saklı.
// Kural: görünen her katı parçanın çarpışması birebir (bileşik eşyada görsel parçalar çarpışmasız, çarpışma = dış zarf); görünmez engel yok.
export const CEPHE_BOUNDS = { minX: -80, maxX: 80, minZ: -150, maxZ: 150 };
export const FLOOR = -1.6, FSTEP = 0.5, PARAPET = 0.24;           // basamakta ayakta göz 0,52 (korkuluk 0,24 → 28 cm görüş), çömelik 0,06 (saklı)
const P2 = Math.PI / 2, PI = Math.PI;
const nk = (kind, o = {}) => ({ collide: false, ...o, kind });
const kk = (kind, o = {}) => ({ ...o, kind });

// renkler: kasvetli cephe paleti (gri-kahve, soluk yeşil); takım renkleri büyük yüzeyde yok
const MUD = '#4d4034', EARTH = '#5e4e3d', BAG = '#857c66', BAG2 = '#796f5a', PLANK = '#5e4c39', PLANK_D = '#4a3c2c', TIMBER = '#4f3f2e';
const CONC = '#86837b', CONC_D = '#706d66', STONE = '#787166', STONE_D = '#625c53', PLASTER = '#a0978a', TILE = '#7d4f3c', IRON = '#4e4c48', RUST = '#5e4a3a';
const BARK = '#4d4236', BARK_D = '#3c342b', LEAF = '#5c6a45', LEAF2 = '#4f5d3c', LEAF3 = '#68714c', HAY = '#a8955e';

// Sektörler / noktalar (r = ele geçirme yarıçapı). Etiket = HUD harfi.
export const FRONT_OBJECTIVES = [
  { id: 'A', name: 'Batı Tabyası', label: 'A', x: -35, z: 40, r: 9 },
  { id: 'B', name: 'Doğu Kavşağı', label: 'B', x: 30, z: 42, r: 9 },
  { id: 'C', name: 'Kilise', label: 'C', x: -22, z: -11, r: 10 },
  { id: 'D', name: 'Köy Meydanı', label: 'D', x: 16, z: -6, r: 10 },
  { id: 'E', name: 'Ambar', label: 'E', x: 30, z: -64, r: 10 },
  { id: 'F', name: 'Orman Kulübesi', label: 'F', x: -36, z: -62, r: 10 },
  { id: 'G', name: 'Komuta Sığınağı', label: 'G', x: -8, z: -115.5, r: 9 },
  { id: 'H', name: 'Batarya', label: 'H', x: 42, z: -130, r: 10 },
];
export const FRONT_SECTORS = [{ objs: ['A', 'B'] }, { objs: ['C', 'D'] }, { objs: ['E', 'F'] }, { objs: ['G', 'H'] }];
// Bot ipuçları (yalnız veri; harita bunları kullanmaz — src/game/frontBots.js): sektör başına savunanın mevzileri
// hold: { x, z, y (zemin / basamak kotu), kind: 'fire' ateş basamağı tüfekçisi · 'mg' makineli yuvası · 'sniper' yüksek nokta · 'ambush' köşe / ev içi pusu · 'cover' siper, look: [dx, dz] bakış }
// flank: saldıranın kanat rotaları (ara noktalar, son nokta hedefin yanında); cover: saldıranın krater / enkaz kapakları (ilerlerken durak)
const FS = FLOOR + FSTEP;
export const FRONT_HINTS = [
  { hold: [{ fire: 'k1' },
    { x: -37, z: 40.2, y: 0, kind: 'mg', look: [0, 1] }, { x: 34, z: 38.6, y: 0, kind: 'mg', look: [0, 1] }, { x: -58, z: 38.6, y: 0, kind: 'mg', look: [0, 1] },
    { x: -22, z: -2.2, y: 8.4, kind: 'sniper', look: [0, 1] }, { x: -43, z: 39, y: FLOOR, kind: 'ambush', look: [0, 1] }, { x: 27, z: 39, y: FLOOR, kind: 'ambush', look: [0, 1] }, { x: -7, z: 39, y: FLOOR, kind: 'ambush', look: [0, 1] }],
    flank: [[[-76, 92], [-77, 70], [-76, 56], [-70, 47]], [[76, 92], [77, 70], [76, 56], [68, 47]], [[-30, 84], [-26, 72], [-20, 62], [-23, 55]]],
    cover: [[24, 76], [-12, 76], [6, 82], [-50, 70], [44, 68], [-38, 68], [32, 78]] },
  { hold: [{ x: -22, z: -2.2, y: 8.4, kind: 'sniper', look: [0, 1] }, { x: -8, z: 0.5, y: 0, kind: 'ambush', look: [0, 1] }, { x: 17, z: 9, y: 0, kind: 'ambush', look: [0, 1] }, { x: -38, z: 6, y: 0, kind: 'ambush', look: [0.3, 1] },
    { x: 30, z: 6, y: 0, kind: 'ambush', look: [0, 1] }, { x: -4, z: 7.5, y: 0, kind: 'cover', look: [0, 1] }, { x: 26, z: -2.5, y: 0, kind: 'mg', look: [-0.2, 1] }, { x: -30, z: 11.5, y: 0, kind: 'cover', look: [0, 1] }, { x: 16, z: -20, y: 0, kind: 'ambush', look: [0, 1] }],
    flank: [[[-60, 30], [-58, 10], [-46, -6], [-30, -10]], [[60, 30], [56, 10], [44, -8], [26, -6]]],
    cover: [[-3, 12], [9, 18], [5, -20], [-30, 13], [29, 13]] },
  { hold: [{ x: 25, z: -64, y: 2.8, kind: 'sniper', look: [0, 1] }, { x: -37, z: -62, y: 0, kind: 'ambush', look: [0, 1] }, { x: 47, z: -50, y: 0, kind: 'ambush', look: [-0.3, 1] }, { x: 15, z: -62.5, y: 0, kind: 'cover', look: [0, 1] },
    { x: 33, z: -57, y: 0, kind: 'mg', look: [0, 1] }, { x: -28, z: -56, y: 0, kind: 'cover', look: [0.2, 1] }, { x: -48, z: -58, y: 0, kind: 'cover', look: [0.3, 1] }, { x: 44, z: -66.5, y: 0, kind: 'cover', look: [0, 1] }],
    flank: [[[-66, -30], [-66, -52], [-54, -64], [-42, -66]], [[60, -36], [60, -58], [52, -66], [40, -66]]],
    cover: [[12, -48.5], [-20, -48], [44, -44]] },
  { hold: [{ fire: 'k4' },
    { x: -30, z: -99.6, y: 0, kind: 'mg', look: [0, 1] }, { x: 30, z: -99.6, y: 0, kind: 'mg', look: [0, 1] }, { x: -8, z: -114.45, y: FS, kind: 'mg', look: [0, 1] },
    { x: 42, z: -128, y: 0, kind: 'cover', look: [0, 1] }, { x: -69, z: -102.4, y: FS, kind: 'sniper', look: [0.3, 1] }, { x: 69, z: -102.4, y: FS, kind: 'sniper', look: [-0.3, 1] },
    { x: -21, z: -115, y: FLOOR, kind: 'ambush', look: [0, 1] }, { x: 31, z: -115, y: FLOOR, kind: 'ambush', look: [0, 1] }],
    flank: [[[-76, -60], [-77, -86], [-76, -100], [-70, -108]], [[76, -60], [77, -86], [76, -100], [70, -108]]],
    cover: [[-26, -84.5], [14, -90], [56, -92], [-22, -86], [2, -88]] },
];

// ── siper ağı (dünya koordinatı; genişlik 2 = 4 m (eksen çift koordinatta), 1 = 2 m (eksen tek koordinatta)) ──
// face: −1 kuzeye (−z), +1 güneye bakar (düşman yönü; ateş basamağı + korkuluk o yanda)
function crenel(x0, x1, z, face, bay = 12, rear = 8, jog = 6, phase = 0) {
  const back = -face, pts = [[x0, z]];
  let x = x0 + phase, front = true;
  while (x < x1) {
    const L = front ? bay : rear, xe = Math.min(x1, x + L);
    pts.push([xe, front ? z : z + back * jog]);
    if (xe >= x1) break;
    pts.push([xe, front ? z + back * jog : z]);
    x = xe; front = !front;
  }
  return pts;
}

export function buildCephe() {
  const B = CEPHE_BOUNDS, rng = makeRng(1944);
  const b = new MapBuilder();
  b.surface = { ground: () => 0, kindOf: () => FK.PLAIN, seeded: true, material: makeCepheMaterial };
  const callouts = [];
  const co = (name, x, z, major = false) => callouts.push({ name, x, z, ...(major ? { major: true } : {}) });

  // ───────── 1. siper planı (arazi kurulmadan önce: düzleştirme maskesi için) ─────────
  const lines = [];      // { pts, w, kind: 'fire'|'sup'|'comm'|'road', face, rv, fl }
  const L = (pts, w, kind, o = {}) => { const l = { pts, w, kind, face: 0, rv: TK.EARTH, fl: FLOOR, ...o }; lines.push(l); return l; };
  // Mavi (saldıran) başlangıç hattı: ateş siperi +88 (kuzeye bakar; ilk doğuş, A / B'ye ≈ 50 m), destek +104, iletişim siperleri
  L(crenel(-70, 70, 88, -1, 12, 8, 6, 0), 2, 'fire', { face: -1, rv: TK.PLANK });
  L([[-60, 104], [-24, 104], [-24, 108], [20, 108], [20, 104], [60, 104]], 2, 'sup', { rv: TK.PLANK, face: -1 });
  L([[-41, 97], [-37, 97], [-37, 101], [-41, 101], [-41, 105]], 1, 'comm');
  L([[7, 95], [11, 95], [11, 99], [7, 99], [7, 107]], 1, 'comm');
  L([[43, 97], [39, 97], [39, 101], [43, 101], [43, 105]], 1, 'comm');
  // Kırmızı birinci hat (sektör 1): ateş siperi +50 (güneye bakar), destek +34, yedek +20 (Kırmızı'nın ilk doğuşu), iletişim siperleri
  L(crenel(-72, 72, 50, 1, 12, 8, 6, 4), 2, 'fire', { face: 1, rv: TK.PLANK });
  L([[-60, 34], [-20, 34], [-20, 30], [12, 30], [12, 34], [60, 34]], 2, 'sup', { rv: TK.PLANK, face: 1 });
  L([[-50, 20], [50, 20]], 2, 'sup', { rv: TK.EARTH, face: 1 });
  for (const cx of [-47, -11, 23, 55]) L([[cx, 45], [cx, 41], [cx + 4, 41], [cx + 4, 37], [cx, 37], [cx, 33]], 1, 'comm');
  for (const cx of [-31, 9, 41]) L([[cx, 31], [cx, 27], [cx - 4, 27], [cx - 4, 21]], 1, 'comm');
  // Çukur yol (köyün kuzeyi, −40): Kırmızı'nın 2., Mavi'nin 3. doğuşu
  L([[-64, -40], [64, -40]], 2, 'road', { fl: FLOOR, rv: TK.EARTH, face: 1 });
  // Kırmızı ana hat (sektör 4): ateş siperi −104 (güneye bakar), destek −122, yedek −138 (son doğuş), iletişim
  L(crenel(-72, 72, -104, 1, 12, 8, 6, 2), 2, 'fire', { face: 1, rv: TK.PLANK });
  L([[-62, -122], [-22, -122], [-22, -126], [16, -126], [16, -122], [62, -122]], 2, 'sup', { rv: TK.PLANK, face: 1 });
  L([[-50, -138], [50, -138]], 2, 'sup', { rv: TK.EARTH, face: 1 });
  for (const cx of [-45, -25, 27, 57]) L([[cx, -109], [cx, -113], [cx + 4, -113], [cx + 4, -117], [cx, -117], [cx, -121]], 1, 'comm');
  for (const cx of [-33, 5, 21]) L([[cx, -127], [cx, -131], [cx - 4, -131], [cx - 4, -137]], 1, 'comm');

  // hücre kutuları (düzleştirme + krater yasak bölgesi)
  const segs = [];
  for (const l of lines) for (let i = 0; i < l.pts.length - 1; i++) {
    const [ax, az] = l.pts[i], [bx, bz] = l.pts[i + 1], hw = l.w === 2 ? 2 : 1;
    segs.push({ l, ax, az, bx, bz, x0: Math.min(ax, bx) - hw, x1: Math.max(ax, bx) + hw, z0: Math.min(az, bz) - hw, z1: Math.max(az, bz) + hw, horiz: az === bz });
  }
  const segDist = (x, z) => { let d = 1e9; for (const s of segs) d = Math.min(d, Math.hypot(Math.max(0, s.x0 - x, x - s.x1), Math.max(0, s.z0 - z, z - s.z1))); return d; };

  // düz alanlar (köy, çiftlik, sığınak / batarya meydanları): yumuşak düzleştirme
  const FLATS = [[-50, 40, -34, 18, 6], [8, 60, -82, -46, 5], [-52, -22, -76, -50, 4], [-30, 14, -122, -108, 3], [26, 56, -134, -114, 4], [-70, 70, 110, 150, 4], [-70, 70, -150, -134, 3]];
  const flatW = (x, z) => { let w = 0; for (const [x0, x1, z0, z1, f] of FLATS) { const d = Math.hypot(Math.max(0, x0 - x, x - x1), Math.max(0, z0 - z, z - z1)); w = Math.max(w, 1 - Math.min(1, d / f)); } return w; };

  // kraterler: ölüm bölgeleri + açık tarlalar; siper / düz alanlardan uzak
  const craters = [];
  const zones = [[-74, 74, 60, 82, 30], [-74, 74, -94, -82, 10], [-74, 74, 2, 14, 0], [-74, 74, -32, -22, 0], [-20, 74, -100, -70, 8], [-74, 74, 24, 28, 0], [-74, 74, 112, 146, 0]];
  for (const [x0, x1, z0, z1, n] of zones) {
    let tries = 0, made = 0;
    while (made < n && tries++ < n * 40) {
      const x = x0 + rng() * (x1 - x0), z = z0 + rng() * (z1 - z0), R = 2.6 + rng() * 3.2;
      if (segDist(x, z) < R + 3 || flatW(x, z) > 0 || craters.some((c) => Math.hypot(c.x - x, c.z - z) < c.R + R + 1)) continue;
      craters.push({ x, z, R, D: 0.55 + rng() * 0.75 }); made++;
    }
  }
  const noise = (x, z) => Math.sin(x * 0.071 + 1.3) * Math.cos(z * 0.063 - 0.7) * 0.5 + Math.sin(x * 0.19 - z * 0.13) * 0.18 + Math.cos(x * 0.031 + z * 0.047) * 0.35;
  const base = (x, z) => {
    let h = noise(x, z) * 0.45;
    const sd = segDist(x, z);
    h *= Math.min(1, Math.max(0, (sd - 1.5) / 8));                           // siper yanında düz
    h *= 1 - flatW(x, z);
    for (const c of craters) {
      const r = Math.hypot(x - c.x, z - c.z) / c.R;
      if (r < 1) h -= c.D * (1 - r * r);
      else if (r < 1.5) h += c.D * 0.28 * Math.sin((r - 1) / 0.5 * PI);   // kenar sırtı
    }
    return h;
  };
  const T = new FrontTerrain({ minX: B.minX, maxX: B.maxX, minZ: B.minZ, maxZ: B.maxZ, cell: 2, base });

  // ───────── 2. kesikler ─────────
  // duvar kaplaması: ateş siperinde ön bölme kalas / arka bölme kum torbası / bağlantı ham toprak; destek siperinde sırayla kalas – kum torbası
  for (const s of segs) {
    const l = s.l, front = s.horiz && l.pts.every((p) => (s.az - p[1]) * l.face >= 0);
    s.rv = l.kind === 'fire' ? (!s.horiz ? TK.EARTH : front ? TK.PLANK : TK.SANDBAG) : l.kind === 'sup' ? (l.rv === TK.PLANK ? (segs.indexOf(s) % 2 ? TK.SANDBAG : TK.PLANK) : TK.EARTH) : TK.EARTH;
    T.carve(s.x0, s.z0, s.x1, s.z1, l.fl, s.rv, TK.MUD);
  }
  const gy = (x, z) => T.heightAt(x, z);
  // sığınak odaları (doğuş) + gömülü beton sığınak: rampalardan ÖNCE kesilir (rampa odaya bitişmesin)
  const dugouts = [];
  const dugout = (x0, x1, z0, z1, open, name) => { T.carve(x0, z0, x1, z1, FLOOR, TK.PLANK, TK.MUD); dugouts.push({ x0, x1, z0, z1, open, name }); };
  // Mavi destek hattının arkası (güney): Mavi 1. doğuş
  dugout(-50, -44, 106, 112, 'n', 'mavi-1'); dugout(-14, -8, 110, 116, 'n', 'mavi-2'); dugout(12, 18, 110, 116, 'n', 'mavi-3'); dugout(34, 40, 106, 112, 'n', 'mavi-4');
  // Kırmızı yedek hattının arkası (kuzey): Kırmızı 1. doğuş
  dugout(-40, -34, 12, 18, 's', 'k1-1'); dugout(-16, -10, 12, 18, 's', 'k1-2'); dugout(26, 32, 12, 18, 's', 'k1-3');
  // Kırmızı ana ateş hattı arka bölmelerinin arkası: Kırmızı 3. doğuş
  dugout(-56, -50, -118, -112, 's', 'k3-1'); dugout(-36, -30, -118, -112, 's', 'k3-2'); dugout(4, 10, -118, -112, 's', 'k3-3'); dugout(44, 50, -118, -112, 's', 'k3-4');
  // Kırmızı ana yedek hattının arkası: Kırmızı 4. doğuş
  dugout(-40, -34, -146, -140, 's', 'k4-1'); dugout(-4, 2, -146, -140, 's', 'k4-2'); dugout(30, 36, -146, -140, 's', 'k4-3');
  const bunkers = [{ x0: -14, x1: -2, z0: -124, z1: -114, name: 'G' }];
  for (const k of bunkers) T.carve(k.x0, k.z0, k.x1, k.z1, FLOOR, TK.CONC, TK.MUD);
  // rampalar (siperden tarlaya çıkış, 2 m, eğim 0,8): yüz (face) yanı ya da arka yan; hücre ve ötesi kesik değilse
  const ramps = [];
  const rampAt = (xc, z0, dir) => {                                          // xc tek koordinat (hücre ortası); z0..z0+2 hücre satırı; dir 2 (+z) / 3 (−z)
    const [i, j] = T.ci(xc, z0 + 1), jo = dir === 2 ? j + 1 : j - 1;
    if (T.isCut(i, j) || T.isCut(i, jo) || T.isCut(i - 1, j) || T.isCut(i + 1, j)) return false;
    T.ramp(xc, z0 + 1, dir, FLOOR); ramps.push({ x: xc, z: z0 + 1, dir }); return true;
  };
  const rampX = (xc, zEdge, toward) => rampAt(xc, toward > 0 ? zEdge : zEdge - 2, toward > 0 ? 2 : 3);    // zEdge: siper kenarı; toward: +1 güneye (+z), −1 kuzeye
  const odd = (v) => 2 * Math.round((v - 1) / 2) + 1;
  for (const l of lines) {
    const H = segs.filter((s) => s.l === l && s.horiz), hw = l.w === 2 ? 2 : 1;
    if (l.kind === 'fire') {
      H.forEach((s, k) => {
        const zs = s.az, mid = odd((s.ax + s.bx) / 2), front = l.pts.every((p) => (zs - p[1]) * l.face >= 0);      // ön bölme: düşmana en yakın
        if (front && (l.face < 0 || k % 2 === 0)) rampX(mid, zs + l.face * hw, l.face);                                 // ileri çıkış (Mavi her bölmede, Kırmızı iki bölmede bir)
        if (!front) rampX(mid, zs - l.face * hw, -l.face);                                                               // geri çıkış (arka bölmeden)
      });
    } else if (l.kind === 'sup' || l.kind === 'road') {
      const xs = l.kind === 'road' ? [-57, -41, -25, -9, 9, 25, 41, 57] : [-53, -37, -21, -5, 11, 27, 43, 57];      // destek / yedek: 16 m'de bir çıkış (iki yana)
      for (const x of xs) {
        const s = H.find((q) => x > Math.min(q.ax, q.bx) + 1 && x < Math.max(q.ax, q.bx) - 1);
        if (!s) continue;
        rampX(x, s.az + hw, 1); rampX(x + (l.kind === 'road' ? 0 : 4), s.az - hw, -1);
      }
    }
  }

  // ateş basamağı (plat, 0,45 m) + kum torbası korkuluğu: ateş siperlerinin yüz duvarı boyunca (rampada boşluk)
  const parapets = [], steps = [];
  const isCutAt = (x, z) => T.isCut(...T.ci(x, z));
  for (const l of lines) {
    if (!l.face || (l.kind !== 'fire' && l.kind !== 'road' && l.kind !== 'sup')) continue;
    for (const s of segs.filter((q) => q.l === l && q.horiz)) {
      const zs = s.az, edge = zs + l.face * 2, fz = edge + l.face * 0.4, tz = edge - l.face * 0.4;
      // yüz duvarı olan yerler: siper hücresi kesik, tarla yanı (korkuluk şeridi) kesik değil (rampa / iletişim siperi / köşe bağlantısında boşluk)
      let run = null;
      const flush = () => { if (run && run[1] - run[0] > 0.9) {
        const [x0, x1] = run;
        steps.push({ x0: x0 + 0.05, x1: x1 - 0.05, z0: l.face < 0 ? edge : edge - 0.8, z1: l.face < 0 ? edge + 0.8 : edge, face: l.face });
        parapets.push({ x0, x1, z0: l.face < 0 ? edge - 0.75 : edge, z1: l.face < 0 ? edge : edge + 0.75, face: l.face });
      } run = null; };
      for (let x = Math.min(s.ax, s.bx) - 2 + 0.125; x < Math.max(s.ax, s.bx) + 2; x += 0.25) {
        const ok = isCutAt(x, tz) && !isCutAt(x, fz) && !isCutAt(x, edge + l.face * 1.2) && !ramps.some((r) => Math.abs(r.x - x) < 1.15 && Math.abs(r.z - (edge + l.face)) < 1.1);
        if (ok) { if (!run) run = [x - 0.125, x + 0.125]; else run[1] = x + 0.125; } else flush();
      }
      flush();
    }
  }
  for (const st of steps) b.obj('basamak:' + st.x0.toFixed(0) + ':' + st.z0.toFixed(0), () => {
    b.box((st.x0 + st.x1) / 2, FLOOR, (st.z0 + st.z1) / 2, st.x1 - st.x0, FSTEP, st.z1 - st.z0, PLANK, kk(FK.PLANK, { tag: 'plat' }));
  });
  for (const pp of parapets) b.obj('korkuluk:' + pp.x0.toFixed(0) + ':' + pp.z0.toFixed(0), () => {
    const y = Math.min(gy(pp.x0 + 0.3, (pp.z0 + pp.z1) / 2), gy(pp.x1 - 0.3, (pp.z0 + pp.z1) / 2), gy((pp.x0 + pp.x1) / 2, (pp.z0 + pp.z1) / 2)) - 0.04;
    b.box((pp.x0 + pp.x1) / 2, y, (pp.z0 + pp.z1) / 2, pp.x1 - pp.x0, PARAPET - y, pp.z1 - pp.z0, BAG, kk(FK.SANDBAG));
  });
  // siper direkleri (kalas kaplamalı duvarlarda 3,2 m'de bir; duvardan 4 cm taşar, çarpışmasız)
  {
    const seen = new Set();
    for (const s of segs) {
      if (s.rv !== TK.PLANK) continue;
      const hw = s.l.w === 2 ? 2 : 1;
      if (s.horiz) for (let x = s.x0 + 2; x < s.x1 - 0.8; x += 4) for (const sd of [-1, 1]) {
        const zw = s.az + sd * hw, key = x.toFixed(1) + ',' + zw;
        if (seen.has(key) || T.isCut(...T.ci(x, zw + sd * 0.5))) continue; seen.add(key);
        b.box(x, FLOOR, zw - sd * 0.04, 0.14, -FLOOR + 0.06, 0.1, TIMBER, nk(FK.TIMBER));
      } else for (let z = s.z0 + 2; z < s.z1 - 0.8; z += 4) for (const sd of [-1, 1]) {
        const xw = s.ax + sd * hw, key = xw + ',' + z.toFixed(1);
        if (seen.has(key) || T.isCut(...T.ci(xw + sd * 0.5, z))) continue; seen.add(key);
        b.box(xw - sd * 0.04, FLOOR, z, 0.1, -FLOOR + 0.06, 0.14, TIMBER, nk(FK.TIMBER));
      }
    }
  }
  // ördek tahtası şeridi (ateş / destek siperi ortasında 0,9 m, 4 cm; çarpışmasız, ayak 4 cm gömülür)
  for (const s of segs) {
    if (s.l.kind !== 'fire' && s.l.kind !== 'sup') continue;
    const L = s.horiz ? Math.abs(s.bx - s.ax) + 2.6 : Math.abs(s.bz - s.az) + 2.6;
    b.box((s.ax + s.bx) / 2, FLOOR - 0.005, (s.az + s.bz) / 2, s.horiz ? L : 0.9, 0.045, s.horiz ? 0.9 : L, PLANK_D, nk(s.horiz ? FK.DUCKX : FK.DUCKZ));
  }
  for (const d of dugouts) b.box((d.x0 + d.x1) / 2, FLOOR - 0.005, (d.z0 + d.z1) / 2, 1.0, 0.045, d.z1 - d.z0 - 0.4, PLANK_D, nk(FK.DUCKZ));
  // ───────── 3. sığınaklar (doğuş odaları): siperin arkasında kesik oda, üstü kum torbası duvar + kalas / toprak tavan ─────────
  // oda tabanı = siper tabanı (basamak yok); içeride 2,2 m; giriş siper kenarındaki 1,6 m'lik kapı (yanlar kalas perde, çarpışmalı)
  for (const d of dugouts) b.obj('sığınak:' + d.name, () => {
    const { x0, x1, z0, z1, open } = d, W = 0.5, Hw = 0.62, RT = 0.42, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ze = open === 'n' ? z0 : z1, zf = open === 'n' ? z1 : z0, sd = open === 'n' ? 1 : -1;
    const y0 = Math.min(gy(x0 - 0.3, z0 - 0.3), gy(x1 + 0.3, z1 + 0.3), gy(x0 - 0.3, z1 + 0.3), gy(x1 + 0.3, z0 - 0.3)) - 0.05;
    // üç yanda kum torbası duvar (tarlada), siper yanında kapı perdesi (siper kenarında, tabandan tavana)
    const fz0 = open === 'n' ? z0 : z0 - W, fz1 = open === 'n' ? z1 + W : z1;                                                 // yan duvarlar yalnız tarla yanında (siperin üstüne taşmaz)
    b.box(x0 - W / 2, y0, (fz0 + fz1) / 2, W, Hw - y0, fz1 - fz0, BAG2, kk(FK.SANDBAG));
    b.box(x1 + W / 2, y0, (fz0 + fz1) / 2, W, Hw - y0, fz1 - fz0, BAG2, kk(FK.SANDBAG));
    b.box(cx, y0, zf + sd * W / 2, x1 - x0, Hw - y0, W, BAG2, kk(FK.SANDBAG));
    const door = 1.6;
    for (const [a, c] of [[x0, cx - door / 2], [cx + door / 2, x1]]) b.box((a + c) / 2, FLOOR, ze + sd * 0.1, c - a, Hw - FLOOR, 0.2, PLANK_D, kk(FK.PLANK));
    b.box(cx, Hw - 0.18, ze + sd * 0.1, door, 0.18, 0.2, TIMBER, kk(FK.TIMBER));                                          // kapı lentosu
    for (const x of [cx - door / 2 - 0.08, cx + door / 2 + 0.08]) b.box(x, FLOOR, ze + sd * 0.12, 0.16, Hw - FLOOR - 0.18, 0.16, TIMBER, nk(FK.TIMBER));
    // tavan: kalas + toprak + kum torbası sırtı
    const rz0 = open === 'n' ? z0 - 0.2 : z0 - W, rz1 = open === 'n' ? z1 + W : z1 + 0.2;                                    // tavan siperin üstüne yalnız 20 cm (lento) taşar
    b.box(cx, Hw, (rz0 + rz1) / 2, x1 - x0 + W * 2, RT, rz1 - rz0, TIMBER, kk(FK.TIMBER));
    b.box(cx, Hw + RT, (rz0 + rz1) / 2 + sd * 0.15, x1 - x0 + W * 1.4, 0.26, rz1 - rz0 - 0.5, BAG, kk(FK.SANDBAG));
    // iç: tavan kirişleri, ranza, sandık, lamba
    for (let x = x0 + 1.5; x < x1 - 0.1; x += 1.5) b.box(x, Hw - 0.16, cz, 0.16, 0.16, z1 - z0, TIMBER, nk(FK.TIMBER));
    b.box(x0 + 0.5, FLOOR, cz + sd * 0.6, 0.9, 0.55, 2.0, PLANK, kk(FK.PLANK));
    b.box(x1 - 0.5, FLOOR, zf - sd * 0.5, 0.8, 0.6, 0.7, PLANK_D, kk(FK.PLANK));
    b.box(cx, Hw - 0.42, cz, 0.16, 0.22, 0.16, '#ffd58a', { collide: false, o: { glow: true } });
    b.box(cx, FLOOR, ze - sd * 1.85, 2.4, 0.55 - FLOOR, 0.5, BAG2, kk(FK.SANDBAG));                                       // kapı önü perde (siper içinde, iki yandan geçilir)
  });
  // ───────── 4. beton sığınaklar: A Batı Tabyası (tarlada beton makineli yuvası, siperin arkasından ateş eder), G Komuta Sığınağı (gömülü, destek hattından girilir) ─────────
  const pillbox = (x0, x1, z0, z1, name) => b.obj('beton:' + name, () => {          // iç taban = tarla; yarık güneyde (1,3–1,6 m, ayakta göz 1,62), kapı kuzeyde
    const W = 0.6, Hc = 2.3, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y0 = Math.min(gy(x0, z0), gy(x1, z1), gy(x0, z1), gy(x1, z0)) - 0.15;
    const s0 = 1.28, s1 = 1.6, door = 1.7;
    b.box(cx, y0, z1 + W / 2, x1 - x0 + W * 2, s0 - y0, W, CONC, kk(FK.CONC));
    b.box(cx, s1, z1 + W / 2, x1 - x0 + W * 2, Hc - s1, W, CONC, kk(FK.CONC));
    for (const [a, c] of [[x0 - W, x0 + 0.5], [cx - 0.35, cx + 0.35], [x1 - 0.5, x1 + W]]) b.box((a + c) / 2, s0, z1 + W / 2, c - a, s1 - s0, W, CONC, kk(FK.CONC));
    {                                                                                  // batı: yan yarıklı duvar
      const x = x0 - W / 2;
      b.box(x, y0, cz, W, s0 - y0, z1 - z0, CONC, kk(FK.CONC)); b.box(x, s1, cz, W, Hc - s1, z1 - z0, CONC, kk(FK.CONC));
      b.box(x, s0, (z0 + cz) / 2 - 0.4, W, s1 - s0, (z1 - z0) / 2 + 0.8, CONC, kk(FK.CONC)); b.box(x, s0, z1 - 0.45, W, s1 - s0, 0.9, CONC, kk(FK.CONC));
    }
    {                                                                                  // doğu: kapı (adaya açılır: arka bölme rampasıyla siperlere bağlı)
      const x = x1 + W / 2, zd0 = cz - door / 2, zd1 = cz + door / 2;
      b.box(x, y0, (z0 + zd0) / 2, W, Hc - y0, zd0 - z0, CONC_D, kk(FK.CONC)); b.box(x, y0, (zd1 + z1) / 2, W, Hc - y0, z1 - zd1, CONC_D, kk(FK.CONC));
      b.box(x, 2.05, cz, W, Hc - 2.05, door, CONC_D, kk(FK.CONC));
    }
    b.box(cx, y0, z0 - W / 2, x1 - x0 + W * 2, Hc - y0, W, CONC_D, kk(FK.CONC));
    b.box(cx, Hc, cz, x1 - x0 + W * 2 + 0.4, 0.5, z1 - z0 + W * 2 + 0.4, CONC_D, kk(FK.CONC));
    b.box(cx, Hc + 0.5, cz, x1 - x0 + W * 1.2, 0.25, z1 - z0 + W * 1.2, EARTH, kk(FK.EARTH));
    b.with(cx, 1.15, z1 - 0.15, PI, () => mgProp(0, 0, 0));
    b.box(cx, y0, z1 - 0.35, 1.0, 1.0 - y0, 0.5, PLANK_D, kk(FK.PLANK));                                                      // makineli masası
    b.box(x0 + 0.6, y0, z0 + 0.6, 0.9, 0.6 - y0, 0.6, '#55603f', kk(FK.PLANK));
    b.box(cx, Hc - 0.3, cz, 0.18, 0.2, 0.18, '#ffd58a', { collide: false, o: { glow: true } });
  });
  pillbox(-40, -34, 37, 41, 'A');
  for (const k of bunkers) b.obj('beton:' + k.name, () => {                         // gömülü: taban = siper tabanı, yarık güneyde 0,3–0,62 m (ateş basamağında ayakta göz 0,47)
    const { x0, x1, z0, z1 } = k, W = 0.6, Hc = 1.6, RT = 0.5, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y0 = -0.3, s0 = 0.3, s1 = 0.62, door = 1.5;
    b.box(cx, y0, z1 + W / 2, x1 - x0 + W * 2, s0 - y0, W, CONC, kk(FK.CONC));
    b.box(cx, s1, z1 + W / 2, x1 - x0 + W * 2, Hc - s1, W, CONC, kk(FK.CONC));
    for (const [a, c] of [[x0 - W, x0 + 0.6], [cx - 0.3, cx + 0.3], [x1 - 0.6, x1 + W]]) b.box((a + c) / 2, s0, z1 + W / 2, c - a, s1 - s0, W, CONC, kk(FK.CONC));
    for (const x of [x0 - W / 2, x1 + W / 2]) b.box(x, y0, cz, W, Hc - y0, z1 - z0, CONC, kk(FK.CONC));
    for (const [a, c] of [[x0, cx - door / 2], [cx + door / 2, x1]]) b.box((a + c) / 2, FLOOR, z0 + 0.2, c - a, Hc - FLOOR, 0.4, CONC_D, kk(FK.CONC));      // kuzey: siper kenarında perde + kapı
    b.box(cx, 0.25, z0 + 0.2, door, Hc - 0.25, 0.4, CONC_D, kk(FK.CONC));
    b.box(cx, Hc, cz, x1 - x0 + W * 2 + 0.3, RT, z1 - z0 + W + 0.3, CONC_D, kk(FK.CONC));
    b.box(cx, Hc + RT, cz + 0.2, x1 - x0 + W * 1.2, 0.24, z1 - z0 + W * 0.4, EARTH, kk(FK.EARTH));
    b.box(cx, FLOOR, z1 - 0.45, x1 - x0 - 0.1, FSTEP, 0.9, CONC_D, kk(FK.CONC, { tag: 'plat' }));
    b.box(cx, FLOOR, cz - 0.4, 2.2, 0.8, 1.2, PLANK, kk(FK.PLANK)); b.box(cx, FLOOR + 0.8, cz - 0.4, 1.0, 0.02, 0.7, '#d8ceb0', nk(FK.PLAIN));     // harita masası
    b.box(x0 + 0.6, FLOOR, cz + 1.4, 0.6, 1.5, 0.5, '#4a4f3f', kk(FK.METAL)); b.box(x1 - 0.7, FLOOR, z0 + 1.2, 0.9, 0.6, 0.6, '#55603f', kk(FK.PLANK));   // telsiz dolabı, sandık
    b.box(cx, Hc - 0.3, cz, 0.18, 0.2, 0.18, '#ffd58a', { collide: false, o: { glow: true } });
  });
  // makineli tüfek (dekor; çatal ayaklı, şeritli)
  function mgProp(x, y, z) {
    b.box(x, y - 0.06, z, 0.11, 0.13, 0.62, IRON, nk(FK.METAL));
    b.cyl(x, y, z - 0.62, 0.045, 0.045, 0.62, '#5a5a56', { collide: false, kind: FK.METAL, rx: P2, center: true, seg: 8 });
    b.cyl(x, y, z - 0.98, 0.02, 0.02, 0.2, IRON, { collide: false, kind: FK.METAL, rx: P2, center: true, seg: 6 });
    b.box(x, y - 0.03, z + 0.42, 0.07, 0.11, 0.3, PLANK_D, nk(FK.PLANK));
    for (const s of [-1, 1]) b.box(x + s * 0.12, y - 0.32, z - 0.55, 0.03, 0.38, 0.03, IRON, nk(FK.METAL, { rz: s * 0.4 }));
    b.box(x + 0.12, y - 0.1, z - 0.1, 0.16, 0.12, 0.2, '#4e5238', nk(FK.METAL));
  }
  // kum torbası makineli yuvası (tarlada, U biçimli, arkası açık): içine çömelen görünmez
  const mgNest = (x, z, face, name) => b.obj('yuva:' + name, () => b.with(x, gy(x, z) - 0.05, z, face > 0 ? PI : 0, () => {
    const R = 1.7, H = 0.95;
    b.box(0, 0, -R, R * 2 + 0.7, H, 0.7, BAG, kk(FK.SANDBAG));                                       // ön (düşmana)
    for (const s of [-1, 1]) b.box(s * (R + 0.0), 0, -0.2, 0.7, H, R * 1.6, BAG2, kk(FK.SANDBAG));
    mgProp(0, H + 0.12, -R + 0.2);
  }));

  // ───────── 5. dikenli tel hatları (ahşap / demir kazık + çapraz teller; çarpışma = tel kuşağının dış zarfı, 1 m) ─────────
  const wires = [];                                                                 // tel çizgileri [nokta, nokta, …] (yalnız görsel)
  const wire = (x0, x1, z, gaps = [], name = '') => {
    const cuts = [x0, ...gaps.flatMap((g) => [g - 1.6, g + 1.6]), x1].sort((a, c) => a - c);
    for (let i = 0; i < cuts.length; i += 2) {
      const a = cuts[i], c = cuts[i + 1];
      if (c - a < 1.2) continue;
      for (let s = a; s < c - 0.2; s += 4.2) {
        const e = Math.min(c, s + 4.2), m = (s + e) / 2, y = Math.min(gy(s, z), gy(e, z), gy(m, z)) - 0.05;
        b.obj('tel:' + name + ':' + s.toFixed(0), () => {
          b.collide(m, y, z, e - s, 1.05, 0.9);
          const xs = [s + 0.12, m, e - 0.12];
          for (const [k, x] of xs.entries()) b.box(x, y, z + (k % 2 ? 0.32 : -0.32), 0.06, 1.12, 0.06, k % 2 ? TIMBER : IRON, nk(FK.METAL, { rz: ((x * 13) % 1 - 0.5) * 0.12 }));
          // teller (çizgi: tek çizim çağrısı, piksel kalınlığında): üç sıra düz tel + çapraz tel + spiral (konçertina)
          const P = (x, yy, zz) => [x, y + yy, zz];
          for (const yy of [0.3, 0.64, 0.98]) for (const dz of [-0.32, 0.32]) wires.push(P(s + 0.1, yy, z + dz), P(e - 0.1, yy, z + dz));
          for (let k = 0; k < xs.length - 1; k++) { wires.push(P(xs[k], 1.0, z - 0.32), P(xs[k + 1], 0.15, z + 0.32), P(xs[k], 0.15, z + 0.32), P(xs[k + 1], 1.0, z - 0.32)); }
          const n = Math.round((e - s) * 6); let prev = null;
          for (let k = 0; k <= n; k++) { const a = k / n, ang = a * (e - s) * 9.5, q = P(s + 0.1 + a * (e - s - 0.2), 0.5 + Math.sin(ang) * 0.42, z + Math.cos(ang) * 0.4); if (prev) wires.push(prev, q); prev = q; }
        });
      }
    }
  };
  wire(-74, 74, 79, [-55, -35, -15, 5, 25, 45, 65], 'mavi');
  wire(-74, 74, 60, [-61, -41, -19, 1, 21, 41, 63], 'k1');
  wire(-74, 74, -94, [-59, -37, -17, 3, 23, 43, 61], 'k4');
  // tekil çapraz kazık (kirpi): ölüm bölgesinde ve köy yolunda
  const hedgehog = (x, z, ry = 0) => b.obj('kirpi:' + x.toFixed(0) + ':' + z.toFixed(0), () => b.with(x, gy(x, z) - 0.05, z, ry, () => {
    b.collide(0, 0, 0, 1.6, 0.95, 1.6);
    for (const [rx, rz] of [[0.75, 0], [-0.75, 0], [0, 0.75]]) b.box(0, 0.45, 0, 0.12, 1.5, 0.12, rx ? RUST : TIMBER, nk(FK.METAL, { rx, rz: rz || 0.75 * (rx ? 0 : 1), ry: rx ? 0 : P2 }));
  }));

  // ───────── 6. yıkık köy evleri (sektör 2): kırık duvar tepesi (0,9 m'lik parçalar, her parça kendi kutusu), kapı / pencere boşlukları ─────────
  const wave = (m, sd) => Math.sin(m * 1.37 + sd) * 0.55 + Math.sin(m * 0.53 + sd * 2.1) * 0.45;
  const ruinWall = (axis, a0, a1, c, y0, h, t, col, kind, ops, jag, sd) => {
    const br = new Set([a0, a1]);
    for (const o of ops) { br.add(o.at - o.w / 2); br.add(o.at + o.w / 2); }
    for (let v = a0 + 0.9; v < a1 - 0.3; v += 0.9) br.add(+v.toFixed(3));
    const pts = [...br].filter((v) => v >= a0 - 1e-6 && v <= a1 + 1e-6).sort((x, y) => x - y);
    for (let i = 0; i < pts.length - 1; i++) {
      const s = pts[i], e = pts[i + 1]; if (e - s < 0.05) continue;
      const m = (s + e) / 2, hh = jag ? Math.max(0.7, h * (1 - jag * Math.max(0, wave(m, sd) - 0.15))) : h;
      const gaps = ops.filter((o) => m > o.at - o.w / 2 && m < o.at + o.w / 2).sort((p, q) => p.b - q.b);       // bir parçada birden çok boşluk (kapı + çan katı)
      const piece = (yb, yt) => { if (yt - yb < 0.05) return; if (axis === 'x') b.box(m, y0 + yb, c, e - s, yt - yb, t, col, kk(kind)); else b.box(c, y0 + yb, m, t, yt - yb, e - s, col, kk(kind)); };
      let yb = 0;
      for (const g of gaps) { piece(yb, Math.min(g.b, hh)); yb = Math.max(yb, g.top); }
      piece(yb, hh);
    }
  };
  const D = (at, w = 1.6) => ({ at, w, b: 0, top: 2.2 }), Wn = (at, w = 1.1, bb = 0.95, top = 2.15) => ({ at, w, b: bb, top });
  const rubble = (x, z, w, d, n = 3, col = STONE_D) => {
    let y = gy(x, z) - 0.08, ww = w, dd = d;
    for (let i = 0; i < n; i++) { const hh = 0.32 - i * 0.05; b.box(x + (i % 2 ? 0.2 : -0.15) * w * 0.3, y, z + (i % 2 ? -0.1 : 0.15) * d * 0.3, ww, hh, dd, i % 2 ? STONE : col, kk(FK.STONE)); y += hh; ww *= 0.68; dd *= 0.7; }
  };
  const beam = (x, y, z, L, ry, rz, rx = 0) => b.box(x, y, z, L, 0.18, 0.2, '#3b3128', nk(FK.TIMBER, { ry, rz, rx }));
  const house = (name, x0, x1, z0, z1, o = {}) => b.obj('ev:' + name, () => {
    const h = o.h ?? 4.6, t = 0.5, col = o.col ?? PLASTER, kind = o.kind ?? FK.PLASTER, jag = o.jag ?? 0.45, sd = x0 * 0.37 + z0 * 0.71;
    const ops = { n: [], s: [], e: [], w: [], ...o.ops };
    const y0 = Math.min(gy(x0, z0), gy(x1, z1), gy(x0, z1), gy(x1, z0)) - 0.1;
    ruinWall('x', x0 - t / 2, x1 + t / 2, z0, y0, h, t, col, kind, ops.n, jag, sd);
    ruinWall('x', x0 - t / 2, x1 + t / 2, z1, y0, h, t, col, kind, ops.s, jag, sd + 1.7);
    ruinWall('z', z0 + t / 2, z1 - t / 2, x0, y0, h, t, col, kind, ops.w, jag * 0.6, sd + 3.1);
    ruinWall('z', z0 + t / 2, z1 - t / 2, x1, y0, h, t, col, kind, ops.e, jag * 0.6, sd + 4.3);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, Dd = z1 - z0, alongX = W >= Dd;
    if (o.roof) {                                                                    // kiremit çatı (dolu: basamaklı çarpışma); 'half' → yarısı çökmüş (kirişler)
      const rh = Math.min(W, Dd) * 0.42, L = (alongX ? W : Dd) + 0.6, Wd = (alongX ? Dd : W) + 0.7, part = o.roof === 'half' ? 0.55 : 1;
      const off = (1 - part) * L / 2, rx = alongX ? cx - off : cx, rz = alongX ? cz : cz - off;
      b.withKind(FK.TILE, () => b.prism(rx, y0 + h, rz, Wd, rh, L * part, TILE, { ry: alongX ? P2 : 0 }));
      if (part < 1) for (let k = 0; k < 4; k++) {                                  // açıkta kalan kirişler (çarpışmasız, ince)
        const a = (alongX ? x1 : z1) - 0.4 - k * (L * (1 - part) / 4);
        for (const s of [-1, 1]) {
          const L2 = Math.hypot(Wd / 2, rh), ang = Math.atan2(rh, Wd / 2);
          if (alongX) b.box(a, y0 + h + rh / 2 - 0.1, cz + s * Wd / 4, 0.14, 0.16, L2, '#3b3128', nk(FK.TIMBER, { rx: -s * ang }));
          else b.box(cx + s * Wd / 4, y0 + h + rh / 2 - 0.1, a, L2, 0.16, 0.14, '#3b3128', nk(FK.TIMBER, { rz: s * ang }));
        }
      }
    } else {                                                                          // çatısız: içeride moloz + düşmüş kiriş
      rubble(cx + (o.rx ?? 0.8), cz + (o.rz ?? -0.6), Math.min(W, Dd) * 0.45, Math.min(W, Dd) * 0.35);
      beam(cx - 0.5, y0 + 0.6, cz + 0.4, Math.min(W, Dd) * 0.8, 0.6, 0.25);
    }
  });
  house('h1', -12, -4, -4, 4, { h: 5.2, roof: 'half', ops: { e: [D(0)], s: [Wn(-8)], w: [Wn(-1.5)], n: [Wn(-6.5)] } });
  house('h2', -12, -4, -20, -12, { h: 4.4, jag: 0.6, ops: { e: [D(-16)], n: [Wn(-8)], s: [Wn(-10), Wn(-6)] } });
  house('h3', -12, -4, -32, -26, { h: 4.6, roof: 'full', ops: { e: [D(-29)], s: [Wn(-9), Wn(-6)], n: [Wn(-8)] } });
  house('h4', -42, -34, 2, 10, { h: 4.2, jag: 0.65, ops: { e: [D(6)], n: [Wn(-38)], s: [Wn(-39)] } });
  house('h5', 12, 22, 4, 12, { h: 5.4, roof: 'half', ops: { w: [D(8)], n: [D(17), Wn(14.5), Wn(19.8)], s: [Wn(15), Wn(19)] } });
  house('h6', 26, 34, 2, 10, { h: 4.4, jag: 0.6, ops: { w: [D(6)], n: [Wn(30)], e: [Wn(4.5)] } });
  house('h7', 12, 20, -24, -16, { h: 5.6, roof: 'full', ops: { w: [D(-20)], s: [D(16), Wn(18.6)], n: [Wn(14), Wn(18)] } });
  house('h8', 26, 36, -20, -12, { h: 4.2, jag: 0.7, ops: { w: [D(-16)], s: [Wn(29), Wn(33)], n: [D(31)] } });
  house('h9', 38, 46, -4, 6, { h: 4.0, jag: 0.5, ops: { w: [D(1)], s: [Wn(42)], n: [Wn(41)] } });
  house('h10', -44, -36, -26, -18, { h: 4.4, roof: 'half', ops: { e: [D(-22)], n: [Wn(-40)], s: [Wn(-41)] } });
  // bahçe duvarları (alçak taş: 1,1 m siper)
  const lowWall = (x0, z0, x1, z1, h = 1.1) => b.box((x0 + x1) / 2, gy((x0 + x1) / 2, (z0 + z1) / 2) - 0.1, (z0 + z1) / 2, Math.abs(x1 - x0) || 0.5, h + 0.1, Math.abs(z1 - z0) || 0.5, STONE, kk(FK.STONE));
  lowWall(-3, 6, -3, 13); lowWall(9, 12, 9, 17); lowWall(23, -1, 30, -1); lowWall(-42, -14, -30, -14); lowWall(24, 13, 34, 13); lowWall(-34, 12.5, -24, 12.5);
  lowWall(22, -30, 34, -30); lowWall(-16, -34, -6, -34); lowWall(38, -9, 46, -9);
  co('Köy Girişi', 4, 14); co('Ana Yol', 4, -12); co('Kuzey Evleri', 0, -29); co('Değirmen Yolu', 40, 2);

  // köy meydanı (D): kuyu, devrik araba, sandıklar
  b.obj('meydan', () => {
    b.cyl(16, gy(16, -6) - 0.1, -6, 1.05, 1.15, 0.95, STONE, { seg: 10, kind: FK.STONE });
    for (const s of [-1, 1]) b.box(16 + s * 0.95, 0.8, -6, 0.14, 1.6, 0.14, TIMBER, nk(FK.TIMBER));
    b.box(16, 2.35, -6, 2.1, 0.16, 0.16, TIMBER, nk(FK.TIMBER));
    b.with(11.5, gy(11.5, -10) - 0.05, -10, 0, () => {                              // devrik at arabası (eksen hizalı: çarpışma = görünen kasa)
      b.box(0, 0.25, 0, 3.0, 0.9, 1.5, PLANK, kk(FK.PLANK));
      b.cyl(1.0, 0.75, 0.85, 0.55, 0.55, 0.1, PLANK_D, { collide: false, kind: FK.PLANK, rx: P2, center: true, seg: 10 });
      b.cyl(-1.1, 0.2, -0.85, 0.55, 0.55, 0.1, PLANK_D, { collide: false, kind: FK.PLANK, rx: P2, rz: 0.3, center: true, seg: 10 });
    });
    for (const [x, z] of [[20.5, -2.5], [21.4, -3.3], [20.8, -9.5]]) b.box(x, gy(x, z) - 0.02, z, 0.9, 0.9, 0.9, PLANK, kk(FK.PLANK));
  });
  co('Köy Meydanı', 16, -6, true);

  // ───────── 7. kilise + çan kulesi (keskin nişancı yuvası, 8,4 m çan katı güneye bakar); kulenin doğusunda tahta iskele merdiveni ─────────
  b.obj('kilise', () => {
    const y0 = -0.1, t = 0.8, h = 6.6, X0 = -27, X1 = -17, Z0 = -20, Z1 = -4.4;
    // nef: taş duvar, uzun pencereler, batı duvarında top deliği (kırık tepe), doğuda kapı (iskeleye)
    ruinWall('x', X0 - t / 2, X1 + t / 2, Z0, y0, h, t, STONE, FK.STONE, [Wn(-22, 1.2, 2.2, 4.8)], 0, 1);
    ruinWall('z', Z0 + t / 2, Z1 - t / 2, X0, y0, h, t, STONE, FK.STONE, [Wn(-16, 1.1, 2.2, 4.6), D(-11.5, 1.8), Wn(-7, 1.1, 2.2, 4.6)], 0.55, 2);      // batı: yan kapı
    ruinWall('z', Z0 + t / 2, Z1 - t / 2, X1, y0, h, t, STONE, FK.STONE, [Wn(-16, 1.1, 2.2, 4.6), Wn(-11, 1.1, 2.2, 4.6), Wn(-7, 1.1, 2.2, 4.6)], 0.2, 3);      // doğu: iskelenin altı (kapı yok)
    // güney duvarı = kulenin kuzey duvarı (kuleye geçit) + yanlarda nef duvarı
    ruinWall('x', X0 - t / 2, X1 + t / 2, Z1, y0, h, t, STONE, FK.STONE, [D(-22, 1.6)], 0, 4);
    b.withKind(FK.TILE, () => b.prism(-22, y0 + h, -16, X1 - X0 + 1.4, 3.4, 8.4, TILE, {}));             // çatının kuzey yarısı (güney yarısı çökmüş)
    for (let k = 0; k < 4; k++) for (const s of [-1, 1]) b.box(-22 + s * 2.6, y0 + h + 1.55, -11 + k * 1.7, 5.6, 0.16, 0.14, '#3b3128', nk(FK.TIMBER, { rz: s * 0.55 }));
    // iç: devrik sıralar, sunak, moloz
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) b.box(-22 + s * 2.3 + (k % 2 ? 0.15 : -0.1) * s, y0, -17 + k * 2.2, 3.0, 0.5, 0.5, PLANK_D, kk(FK.PLANK));
    b.box(-22, y0, -19, 2.4, 1.0, 0.9, STONE, kk(FK.STONE));
    rubble(-19.5, -8.5, 3.2, 2.6, 3); rubble(-25.4, -6.4, 2.2, 1.6, 2);
    // kule: 4,4 × 4,4 m, 12,6 m; çan katı 8,4 m (döşeme plat), dört yanda açıklık, sivri çatı
    const TX0 = -24.2, TX1 = -19.8, TZ0 = -4.4, TZ1 = 0, TH = 12.6, tt = 0.7;
    const belf = (at) => ({ at, w: 1.8, b: 9.8, top: 11.5 });                                       // çan katı penceresi: eşik 9,8 (döşeme 8,4 → ayakta göz 10,02 dışarıyı görür, çömelince saklı)
    ruinWall('x', TX0 - tt / 2, TX1 + tt / 2, TZ1, y0, TH, tt, STONE, FK.STONE, [D(-22, 1.6), belf(-22)], 0, 5);
    ruinWall('z', TZ0 + 0.4, TZ1 - tt / 2, TX0, y0, TH, tt, STONE, FK.STONE, [belf(-2.2)], 0, 6);
    ruinWall('z', TZ0 + 0.4, TZ1 - tt / 2, TX1, y0, TH, tt, STONE, FK.STONE, [{ at: -2.2, w: 1.3, b: 8.5, top: 10.8 }], 0, 7);   // doğu: iskele köprüsünden giriş
    b.box(-22, y0 + h, Z1, TX1 - TX0 + tt, TH - h, t, STONE, kk(FK.STONE));                             // kulenin kuzey duvarı (nef çatısının üstü) — çan katında açıklık yok
    b.box(-22, 8.4 - 0.25, -2.2, TX1 - TX0 - tt + 0.05, 0.25, TZ1 - TZ0 - tt - 0.35, PLANK, kk(FK.PLANK, { tag: 'plat' }));
    b.withKind(FK.TILE, () => b.cyl(-22, y0 + TH, -2.2, 0.15, 3.4, 3.2, '#4a3a30', { seg: 4, ry: PI / 4 }));
    b.box(-22, 10.6, -2.2, 0.14, 0.9, 0.14, TIMBER, nk(FK.TIMBER));                                   // çan
    b.cyl(-22, 9.55, -2.2, 0.32, 0.5, 0.75, '#5b4a2e', { collide: false, seg: 8, kind: FK.METAL });
    // iskele merdiveni: nefin doğu duvarı boyunca kuzeyden güneye 28 basamak (0,3 × 0,45) → sahanlık (8,4) → çan katına köprü
    const SX = -16.0, sw = 1.2;
    for (let i = 0; i < 28; i++) b.box(SX, (i + 1) * 0.3 - 0.2, -17.6 + (i + 0.5) * 0.45, sw, 0.2, 0.45, PLANK, kk(FK.PLANK, { tag: 'plat' }));   // ince basamaklar (altı açık iskele)
    b.box(SX, 8.15, -4.2, sw, 0.25, 2.4, PLANK, kk(FK.PLANK, { tag: 'plat' }));
    b.box(-17.9, 8.15, -2.2, 3.8, 0.25, 1.3, PLANK, kk(FK.PLANK, { tag: 'plat' }));
    for (let z = -16.5; z < -3; z += 2.4) { const top = Math.max(0.3, Math.min(8.4, (z + 17.6) / 0.45 * 0.3)); b.box(SX + 0.55, y0, z, 0.16, top - 0.2, 0.16, TIMBER, kk(FK.TIMBER)); b.box(SX - 0.55, y0, z, 0.16, top - 0.2, 0.16, TIMBER, kk(FK.TIMBER)); }
    b.box(SX + sw / 2 + 0.03, 9.05, -4.2, 0.06, 0.06, 2.4, TIMBER, nk(FK.TIMBER)); b.box(-17.9, 9.05, -1.52, 3.8, 0.06, 0.06, TIMBER, nk(FK.TIMBER)); b.box(-17.9, 9.05, -2.88, 3.8, 0.06, 0.06, TIMBER, nk(FK.TIMBER));
  });
  co('Kilise', -22, -12, true); co('Çan Kulesi', -22, -2); co('Kilise İskelesi', -16, -10);

  // ───────── 8. çiftlik (sektör 3): E Ambar (samanlık katı 2,8 m, güney penceresi), yıkık çiftlik evi, saman balyaları, çit ─────────
  b.obj('ambar', () => {
    const X0 = 22, X1 = 38, Z0 = -70, Z1 = -58, h = 5.0, t = 0.3, y0 = Math.min(gy(X0, Z0), gy(X1, Z1)) - 0.1;
    const big = (at) => ({ at, w: 3.2, b: 0, top: 3.4 }), loft = (at) => ({ at, w: 2.0, b: 4.0, top: 4.85 });      // samanlık penceresi: kat 2,8 → ayakta göz 4,42 dışarıyı görür, çömelince saklı
    ruinWall('x', X0 - t / 2, X1 + t / 2, Z1, y0, h, t, PLANK, FK.PLANK, [big(33.5), loft(25)], 0, 1);
    ruinWall('x', X0 - t / 2, X1 + t / 2, Z0, y0, h, t, PLANK, FK.PLANK, [big(33.5), Wn(25, 1.4, 3.4, 4.4)], 0, 2);
    ruinWall('z', Z0 + t / 2, Z1 - t / 2, X0, y0, h, t, PLANK, FK.PLANK, [D(-64, 1.6)], 0, 3);
    ruinWall('z', Z0 + t / 2, Z1 - t / 2, X1, y0, h, t, PLANK, FK.PLANK, [Wn(-64, 1.4, 1.2, 2.3)], 0, 4);
    for (const x of [X0, 26, 30, X1]) for (const z of [Z0, Z1]) b.box(x, y0, z, 0.32, h + 0.1, 0.36, TIMBER, kk(FK.TIMBER));    // dikmeler
    b.withKind(FK.TILE, () => b.prism(30, y0 + h, -64, Z1 - Z0 + 1.0, 3.0, X1 - X0 + 0.8, '#5a4c3e', { ry: P2 }));
    // samanlık katı (batı 6 m, plat) + merdiven (güney duvarı boyunca, doğudan batıya)
    b.box(25, 2.55, -64, 6.0, 0.25, Z1 - Z0 - t, PLANK, kk(FK.PLANK, { tag: 'plat' }));
    for (let i = 0; i < 9; i++) b.box(28.0 + 3.6 - (i + 0.5) * 0.4, y0 + (i + 1) * 0.31 - 0.22, -58.9, 0.4, 0.22, 1.0, PLANK, kk(FK.PLANK, { tag: 'plat' }));
    for (const x of [22.6, 27.4]) b.box(x, 2.8, -64, 0.06, 0.06, 11, TIMBER, nk(FK.TIMBER));
    b.box(27.9, y0, -64, 0.2, 2.55 - y0, 0.2, TIMBER, kk(FK.TIMBER)); b.box(27.9, y0, -67.5, 0.2, 2.55 - y0, 0.2, TIMBER, kk(FK.TIMBER));
    // içeride saman, araba, sandık
    for (const [x, z] of [[23.2, -68.6], [24.6, -68.6], [23.2, -60.5]]) b.box(x, 2.8, z, 1.2, 0.8, 1.0, HAY, kk(FK.LEAF));
    b.box(35.5, y0, -66.8, 1.2, 1.0, 2.2, PLANK_D, kk(FK.PLANK)); b.box(31, y0, -61.2, 1.0, 0.9, 1.0, PLANK, kk(FK.PLANK));
    b.cyl(29.5, y0, -68.5, 0.7, 0.7, 1.1, HAY, { seg: 10, kind: FK.LEAF });
  });
  co('Ambar', 30, -64, true); co('Samanlık', 25, -64);
  house('ciftlik', 42, 52, -56, -46, { h: 4.4, jag: 0.6, col: STONE, kind: FK.STONE, ops: { w: [D(-51)], s: [Wn(45), D(49)], n: [Wn(47)], e: [Wn(-50)] } });
  co('Çiftlik Evi', 47, -51);
  for (const [x, z] of [[14, -60], [16.5, -61], [15, -66], [44, -66], [46, -68], [12, -74]]) b.obj('balya:' + x + ':' + z, () => b.cyl(x, gy(x, z) - 0.05, z, 1.0, 1.05, 1.5, HAY, { seg: 10, kind: FK.LEAF }));
  const fence = (x0, z0, x1, z1) => {                                               // ahşap çit: kazık + iki kuşak (çarpışma = çit zarfı, 1 m)
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2.4)), ry = Math.atan2(-(z1 - z0), x1 - x0);
    for (let i = 0; i < n; i++) {
      const a = i / n, c = (i + 1) / n, xa = x0 + (x1 - x0) * a, za = z0 + (z1 - z0) * a, xc = x0 + (x1 - x0) * c, zc = z0 + (z1 - z0) * c, mx = (xa + xc) / 2, mz = (za + zc) / 2;
      b.with(mx, gy(mx, mz) - 0.05, mz, ry, () => {
        b.collide(0, 0, 0, L / n, 1.05, 0.14);
        b.box(-L / n / 2 + 0.06, 0, 0, 0.12, 1.1, 0.12, TIMBER, nk(FK.TIMBER));
        for (const yy of [0.4, 0.85]) b.box(0, yy, 0, L / n, 0.1, 0.05, PLANK, nk(FK.PLANK, { rz: (i % 3 === 1 && yy > 0.5) ? 0.18 : 0 }));
      });
    }
  };
  fence(8, -48, 40, -48); fence(8, -48, 8, -78); fence(8, -78, 20, -78); fence(42, -78, 58, -78); fence(58, -78, 58, -44);
  co('Çiftlik Avlusu', 20, -52); co('Tarla', 48, -72);

  // ───────── 9. orman (batı) + F Orman Kulübesi; ölü ağaçlar (ölüm bölgeleri) ─────────
  const tree = (x, z, s = 1, dead = false) => b.obj('ağaç:' + x.toFixed(0) + ':' + z.toFixed(0), () => {
    const y = gy(x, z) - 0.1, H = (dead ? 4.2 : 6.2) * s, r = 0.22 * s;
    b.cyl(x, y, z, r * 0.7, r, H, dead ? BARK_D : BARK, { seg: 6, kind: FK.BARK });
    if (dead) {                                                                     // kırık dallar (çarpışmasız)
      for (let k = 0; k < 3; k++) { const a = (x * 3 + z * 7 + k * 2.1) % 6.28; b.box(x + Math.cos(a) * 0.5 * s, y + H * (0.55 + k * 0.12), z + Math.sin(a) * 0.5 * s, 1.2 * s, 0.1, 0.1, BARK_D, nk(FK.BARK, { ry: -a, rz: 0.5 })); }
      return;
    }
    const cr = 2.2 * s, cols = [LEAF, LEAF2, LEAF3];
    b.ico(x, y + H - 0.4, z, cr, cols[Math.abs(Math.round(x * 3 + z)) % 3], { scale: [1, 1.25, 1], ry: x });
    b.ico(x + 0.6 * s, y + H + 1.0 * s, z - 0.3 * s, cr * 0.7, cols[Math.abs(Math.round(x + z * 3)) % 3], { ry: z });
    b.softCover(x, y + H, z, cr * 1.15);
  });
  b.withKind(FK.LEAF, () => {
    for (let z = -46; z > -100; z -= 5.2) for (let x = -78; x < -20; x += 5.6) {
      const jx = x + (rng() - 0.5) * 3.4, jz = z + (rng() - 0.5) * 3.4;
      if (Math.hypot(jx + 37, jz + 63) < 9 || Math.abs(jz + 80) < 2.2 || (jx > -26 && rng() < 0.5) || segDist(jx, jz) < 2.5) continue;      // kulübe açıklığı + orman yolu
      tree(jx, jz, 0.85 + rng() * 0.4, rng() < 0.12);
    }
    for (const [x, z] of [[-60, 70], [-30, 78], [12, 66], [36, 80], [58, 70], [-48, 64], [-8, 72], [62, 76], [-66, -88], [-2, -88], [30, -92], [52, -86], [-70, 6], [66, -20], [-62, -30], [70, 28]]) tree(x, z, 0.9 + rng() * 0.3, true);
    for (const [x, z] of [[-74, 116], [-66, 126], [70, 118], [64, 130], [-72, -128], [70, -132], [62, -144], [-64, -146], [74, -60], [74, -12], [-76, 30], [-74, -16]]) tree(x, z, 1.0 + rng() * 0.3, false);
  });
  b.obj('kulübe', () => {
    const X0 = -40, X1 = -34, Z0 = -66, Z1 = -60, h = 2.7, t = 0.3, y0 = Math.min(gy(X0, Z0), gy(X1, Z1)) - 0.1;
    ruinWall('x', X0 - t / 2, X1 + t / 2, Z1, y0, h, t, BARK, FK.TIMBER, [D(-37, 1.6)], 0, 1);
    ruinWall('x', X0 - t / 2, X1 + t / 2, Z0, y0, h, t, BARK, FK.TIMBER, [Wn(-37, 1.0, 1.0, 1.9)], 0, 2);
    ruinWall('z', Z0 + t / 2, Z1 - t / 2, X0, y0, h, t, BARK, FK.TIMBER, [Wn(-63, 1.0, 1.0, 1.9)], 0, 3);
    ruinWall('z', Z0 + t / 2, Z1 - t / 2, X1, y0, h, t, BARK, FK.TIMBER, [Wn(-63, 1.0, 1.0, 1.9)], 0, 4);
    b.withKind(FK.TILE, () => b.prism(-37, y0 + h, -63, X1 - X0 + 1.0, 1.8, Z1 - Z0 + 0.8, '#4b4136', {}));
    for (let i = 0; i < 3; i++) b.box(-31.6, y0 + i * 0.3, -63 + (i % 2) * 0.2, 0.9, 0.3, 3.0, BARK_D, kk(FK.BARK));      // odun yığını
    b.box(-37, y0, -64.6, 1.4, 0.8, 0.7, PLANK_D, kk(FK.PLANK));
  });
  co('Orman Kulübesi', -37, -63, true); co('Orman Yolu', -50, -80); co('Batı Orman', -62, -58);

  // ───────── 10. H Batarya: üç top çukuru (kum torbası halka, kuzeyi açık), sahra topları, mühimmat sandıkları, kamuflaj ağı ─────────
  const gunPit = (x, z, name) => b.obj('top:' + name, () => b.with(x, gy(x, z) - 0.08, z, 0, () => {
    const R = 3.0, H = 0.95, Tk = 0.8;                                             // eksen hizalı U (güney + iki yan; kuzey 3 m açık giriş): çarpışma = görünen torba
    b.box(0, 0, R, R * 2 + Tk, H, Tk, BAG, kk(FK.SANDBAG));
    for (const sx of [-1, 1]) { b.box(sx * R, 0, 0.4, Tk, H, R * 2 - 0.8, BAG2, kk(FK.SANDBAG)); b.box(sx * (R - 1.0), 0, -R + 0.4, 1.4, H * 0.8, Tk, BAG, kk(FK.SANDBAG)); }
    b.with(0, 0, 0.2, 0, () => {                                                     // sahra topu: iki teker, kalkan, namlu güneye
      for (const s of [-1, 1]) b.cyl(s * 0.85, 0.6, 0.3, 0.6, 0.6, 0.14, '#3e3a33', { collide: false, kind: FK.METAL, rz: P2, center: true, seg: 12 });
      b.box(0, 0.45, 0.3, 1.5, 0.25, 0.4, '#4d5040', kk(FK.METAL));
      b.box(0, 0.7, 0.0, 1.6, 1.1, 0.08, '#4d5040', nk(FK.METAL, { rx: -0.08 }));
      b.cyl(0, 1.0, 1.1, 0.09, 0.11, 2.4, '#43463a', { collide: false, kind: FK.METAL, rx: P2 - 0.12, center: true, seg: 8 });
      b.box(0, 0.25, -1.4, 0.18, 0.18, 2.4, '#4d5040', nk(FK.METAL, { rx: 0.1 }));
      b.collide(0, 0, 0.3, 1.9, 1.3, 1.4);
    });
    for (const [px, pz] of [[-1.8, -1.6], [-1.0, -2.0]]) b.box(px, 0, pz, 0.8, 0.5, 0.5, '#55603f', kk(FK.PLANK));
  }));
  gunPit(32, -130, 'b1'); gunPit(42, -131, 'b2'); gunPit(52, -130, 'b3');
  b.obj('kamuflaj', () => { for (const x of [32, 42, 52]) { for (const s of [-1, 1]) for (const dz of [-3.4, 3.4]) b.box(x + s * 3.4, gy(x + s * 3.4, -130 + dz) - 0.05, -130 + dz, 0.12, 2.9, 0.12, TIMBER, kk(FK.TIMBER)); b.box(x, 2.8, -130, 7.6, 0.06, 7.6, '#5a6146', nk(FK.LEAF)); b.softCover(x, 2.8, -130, 2.6); } });
  for (const [x, z] of [[37, -136], [47, -136], [36.2, -136.9]]) b.box(x, gy(x, z) - 0.03, z, 1.0, 0.6, 0.6, '#55603f', kk(FK.PLANK));
  co('Batarya', 42, -130, true); co('Komuta Sığınağı', -8, -119, true); co('Ana Hat', 0, -104); co('Yedek Hat', 0, -138);

  // ───────── 11. ölüm bölgesi / tarla eşyaları: tank enkazı, kamyon, kirpiler, sandık / varil, makineli yuvaları ─────────
  const tankWreck = (x, z, ry, name) => b.obj('tank:' + name, () => b.with(x, gy(x, z) - 0.25, z, ry ? P2 : 0, () => {      // gövde eksen hizalı (çarpışma = görünen gövde); kule çarpık, yalnız çekirdeği çarpışır
    b.box(0, 0, 0, 3.0, 1.15, 5.8, '#4a4b42', kk(FK.METAL));                         // gövde
    b.box(0, 1.15, -0.6, 2.4, 0.4, 3.2, '#45463e', kk(FK.METAL, { rx: 0.05 }));
    for (const s of [-1, 1]) b.box(s * 1.75, 0, 0, 0.55, 0.95, 6.2, '#2f2f2b', kk(FK.METAL));          // paletler
    b.box(0.2, 1.55, -0.2, 1.9, 0.75, 2.1, '#4a4b42', nk(FK.METAL, { ry: 0.5 }));                     // kule (çarpık, görsel)
    b.collide(0.2, 1.55, -0.2, 1.5, 0.75, 1.5);
    b.cyl(0.9, 1.9, -1.8, 0.07, 0.08, 2.4, '#3a3a34', { collide: false, kind: FK.METAL, rx: P2 + 0.2, ry: 0.5, center: true, seg: 8 });
  }));
  tankWreck(24, 74, 0.45, 'nml1'); tankWreck(-30, -88, -0.7, 'nml4');
  b.obj('kamyon', () => b.with(5, gy(5, -20) - 0.05, -20, 0, () => {            // yol kenarında devrik kamyon
    b.box(0, 0.3, 0.9, 2.1, 1.6, 2.0, '#4f5244', kk(FK.METAL));
    b.box(0, 0.3, -1.6, 2.2, 1.0, 3.2, PLANK_D, kk(FK.PLANK));
    for (const [px, pz] of [[-1.1, 1.4], [1.1, 1.4], [-1.1, -2.2], [1.1, -2.2]]) b.cyl(px, 0.45, pz, 0.45, 0.45, 0.3, '#262624', { collide: false, kind: FK.METAL, rz: P2, center: true, seg: 10 });
  }));
  for (const [x, z, r] of [[-50, 70, 0.3], [-12, 74, 1.1], [44, 68, 0.6], [6, 76, 2], [-66, 74, 0.1], [62, 64, 0.9], [-24, -86, 0.4], [14, -90, 1.4], [56, -92, 0.2], [2, 16, 0.5], [6, -34, 1.1]]) hedgehog(x, z, r);
  for (const [x, z] of [[-5, 72], [32, 78], [-38, 68]]) b.obj('sandık:' + x, () => { b.box(x, gy(x, z) - 0.05, z, 1.0, 0.7, 0.7, PLANK_D, kk(FK.PLANK)); b.box(x + 0.9, gy(x + 0.9, z) - 0.05, z + 0.2, 0.7, 0.5, 0.5, '#55603f', kk(FK.PLANK)); });
  mgNest(34, 39, 1, 'B'); mgNest(-58, 39, 1, 'bati1'); mgNest(-30, -99, 1, 'ana1'); mgNest(30, -99, 1, 'ana2');
  co('Ölüm Bölgesi', 0, 74, true); co('Tank Enkazı', 24, 74); co('Mavi Siperi', 0, 92); co('Birinci Hat', 0, 50, true); co('Destek Siperi', 0, 33);
  co('Doğu Kavşağı', 30, 41); co('Batı Tabyası', -37, 39); co('Yedek Siper', 0, 20); co('Çukur Yol', 0, -40, true); co('Kuzey Tarla', 0, -88);

  // ───────── 12. doğuşlar (aşama başına): siper tabanı / sığınak / avlu hücre ortaları; çarpışma kutusundan ve siper kenarından uzak ─────────
  const free = (x, z, r = 0.55) => {
    const y = gy(x, z);
    return !b.colliders.some((c) => x > c.min[0] - r && x < c.max[0] + r && z > c.min[2] - r && z < c.max[2] + r && c.max[1] > y + 0.3 && c.min[1] < y + 1.85)
      && !b.colliders.some((c) => c.tag === 'plat' && x > c.min[0] - 0.3 && x < c.max[0] + 0.3 && z > c.min[2] - 0.3 && z < c.max[2] + 0.3 && c.min[1] > y + 1.0);      // üstünde kat (samanlık / iskele) olan yer değil (yol bulma o hücreyi katta sayar)
  };
  const trenchPts = (x0, x1, z0, z1, ry) => {
    const out = [];
    for (let z = z0 + 1; z < z1; z += 2) for (let x = x0 + 1; x < x1; x += 2) {
      const [i, j] = T.ci(x, z), c = j * T.cw + i;
      if (!T.isCut(i, j) || T.cut[c] !== 1 || !free(x, z)) continue;
      out.push({ x, z, ry });
    }
    return out;
  };
  const fieldPts = (x0, x1, z0, z1, ry, st = 2.2) => {
    const out = [];
    for (let z = z0 + 1; z < z1; z += st) for (let x = x0 + 1; x < x1; x += st) {
      const [i, j] = T.ci(x, z);
      let near = false; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (T.isCut(i + di, j + dj)) near = true;
      if (near || T.slopeAt(x, z, 0.6) > 0.35 || !free(x, z, 0.7)) continue;
      out.push({ x: +x.toFixed(2), z: +z.toFixed(2), ry });
    }
    return out;
  };
  const roomPts = (list, ry) => {                                                       // örtülü sığınak odaları (dışarıdan görünmez)
    const out = [];
    for (const d of list) for (let z = d.z0 + 0.9; z < d.z1 - 0.5; z += 1.25) for (let x = d.x0 + 0.8; x < d.x1 - 0.5; x += 1.25) if (free(x, z, 0.45)) out.push({ x: +x.toFixed(2), z: +z.toFixed(2), ry });
    return out;
  };
  const zoneOf = (pts, m = 3) => ({ minX: Math.min(...pts.map((p) => p.x)) - m, maxX: Math.max(...pts.map((p) => p.x)) + m, minZ: Math.min(...pts.map((p) => p.z)) - m, maxZ: Math.max(...pts.map((p) => p.z)) + m });
  const stage = (blue, red) => ({ blue, red, zones: { blue: zoneOf(blue), red: zoneOf(red) } });
  const stages = [
    stage(trenchPts(-62, 62, 85, 96, 0), roomPts(dugouts.filter((d) => d.name.startsWith('k1')), PI)),       // 1: Mavi ateş siperi (A / B'ye ≈ 50 m) / Kırmızı yedek hat sığınakları
    stage(trenchPts(-62, 62, 27, 37, 0), trenchPts(-38, 38, -44, -36, PI).filter((p) => !ramps.some((r) => Math.abs(r.x - p.x) < 3))),                              // 2: Mavi (alınan) destek siperi / Kırmızı çukur yol (güney sırtı korkuluklu)
    stage(fieldPts(-46, 46, -36, -24, 0), roomPts(dugouts.filter((d) => d.name.startsWith('k3')), PI)),     // 3: Mavi kuzey evleri / Kırmızı ana hat sığınakları
    stage(fieldPts(4, 58, -80, -56, 0), roomPts(dugouts.filter((d) => d.name === 'k4-1' || d.name === 'k4-2'), PI)),      // batarya yanındaki k4-3 doğuş değil (H'ye 14 m: savunan anında yetişiyordu)       // 4: Mavi çiftlik avlusu / Kırmızı yedek hat sığınakları
  ];
  for (const S of stages) for (const k of ['blue', 'red']) if (S[k].length > 48) S[k] = S[k].filter((_, i) => i % Math.ceil(S[k].length / 48) === 0);
  co('Mavi Sığınakları', 0, 110); co('Kırmızı Sığınakları', 0, 15);

  // ipuçlarındaki { fire: hat } yer tutucuları: o hattın ön bölme ateş basamaklarının ortaları (rampa boşlukları zaten dışarıda)
  const hints = FRONT_HINTS.map((H) => ({ ...H, hold: H.hold.flatMap((h) => {
    if (!h.fire) return [h];
    const zf = h.fire === 'k1' ? 52 : -102;
    return steps.filter((st) => st.face > 0 && Math.abs((st.face > 0 ? st.z1 : st.z0) - zf) < 0.01 && st.x1 - st.x0 > 2.5)
      .map((st) => ({ x: +((st.x0 + st.x1) / 2).toFixed(2), z: +((st.z0 + st.z1) / 2).toFixed(2), y: FS, kind: 'fire', look: [0, 1] }));
  }) }));
  // ───────── 13. ağ: arazi (siper duvarları dahil) + birleşik parçalar; harita dışı: düz tarla, ağaç sırası, tepeler ─────────
  const group = b.build();
  if (!MapBuilder.noVisual) {
    const mat = b._desertMat || makeCepheMaterial();
    const cTmp = new THREE.Color(), cA = new THREE.Color('#6c6a4b'), cB = new THREE.Color('#665848'), cMud = new THREE.Color('#54473a'), cFor = new THREE.Color('#545a3b');
    const KC = { [TK.MUD]: '#463a2f', [TK.DUCKX]: '#463a2f', [TK.DUCKZ]: '#463a2f', [TK.PLANK]: '#5a4936', [TK.EARTH]: '#574736', [TK.CONC]: '#85827a', [TK.SANDBAG]: '#7d7057' };
    const road = (x, z) => (Math.abs(x - 4) < 3 && z > -38 && z < 22) || (Math.abs(z + 50) < 2.4 && x > 6 && x < 60);
    const forest = (x, z) => x < -20 && z < -44 && z > -100;
    const colorFn = (x, z, y, k, out) => {
      if (k !== TK.FIELD) { out.set(KC[k] || '#5d4c3b'); if (k === TK.MUD && road(x, z)) out.set('#6a5c4a'); return; }
      const n = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.cos(z * 0.17) * 2.0) * Math.cos(z * 0.13 - x * 0.05);
      out.copy(cA).lerp(cB, n * 0.7);
      const sd = segDist(x, z);
      if (sd < 5) out.lerp(cMud, (1 - sd / 5) * 0.65);                                      // siper çevresi çiğnenmiş çamur
      if (y < -0.18) out.lerp(cMud, Math.min(1, (-y - 0.18) * 1.6));                          // krater dibi
      if (forest(x, z)) out.lerp(cFor, 0.6);
      cTmp.copy(out);
    };
    const kindFn = (x, z) => (road(x, z) ? TK.MUD : TK.FIELD);
    const tm = new THREE.Mesh(T.buildMesh(colorFn, kindFn), mat);
    tm.receiveShadow = true; tm.castShadow = false; tm.userData.terrain = true;
    group.add(tm);
    if (wires.length) {                                                              // dikenli tel: tek LineSegments
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wires.flat(), 3));
      const ln = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#2d2a26' })); ln.userData.wire = true; group.add(ln);
    }
    // harita dışı: dört düz şerit (bulanık uzak tarla), ağaç sırası ve alçak tepeler (çarpışmasız)
    const og = new THREE.MeshStandardMaterial({ color: '#5f5d45', roughness: 1, flatShading: true });
    for (const [x, z, w, d] of [[0, B.minZ - 150, 900, 300], [0, B.maxZ + 150, 900, 300], [B.minX - 150, 0, 300, B.maxZ - B.minZ], [B.maxX + 150, 0, 300, B.maxZ - B.minZ]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), og); m.rotation.x = -P2; m.position.set(x, -0.02, z); m.receiveShadow = true; group.add(m);
    }
    const ob = new MapBuilder(); ob.surface = b.surface;
    ob.withKind(FK.LEAF, () => {
      for (let a = 0; a < 70; a++) {                                                   // sınır ağaç kuşağı
        const t2 = a / 70, side = a % 4, along = (t2 * 4 % 1);
        const x = side === 0 ? B.minX - 6 - (a % 3) * 4 : side === 1 ? B.maxX + 6 + (a % 3) * 4 : B.minX + along * (B.maxX - B.minX);
        const z = side < 2 ? B.minZ + along * (B.maxZ - B.minZ) : side === 2 ? B.minZ - 8 - (a % 3) * 5 : B.maxZ + 8 + (a % 3) * 5;
        ob.cyl(x, 0, z, 0.25, 0.32, 5.5, BARK, { seg: 5, kind: FK.BARK, collide: false });
        ob.ico(x, 6.2, z, 2.8 + (a % 3) * 0.5, [LEAF, LEAF2, LEAF3][a % 3], { scale: [1, 1.3, 1], ry: a });
      }
      for (let a = 0; a < 22; a++) { const ang = a / 22 * PI * 2, R = 290 + (a % 3) * 30; ob.ico(Math.cos(ang) * R * 0.75, -6, Math.sin(ang) * R, 40 + (a % 4) * 12, ['#5d5c48', '#55543f', '#626049'][a % 3], { scale: [1, 0.35, 0.8], ry: a }); }
    });
    group.add(ob.build());
  }

  return {
    id: 'cephe',
    name: 'Batı Cephesi',
    group,
    colliders: b.colliders,
    sight: b.sight,
    bounds: CEPHE_BOUNDS,
    terrain: T,
    layered: true,                                                   // ateş basamakları, iskele, samanlık: hücre başına zemin kotu
    callouts,
    mini: { bg: '#5d5a44', ground: [108, 106, 78], pit: [52, 42, 32], wall: '#3e372d', mid: '#5a5142', low: '#6f6650', roof: 'rgba(60,52,40,0.45)' },      // pit: siper / krater (koyu toprak)
    spawns: { blue: stages[0].blue, red: stages[0].red },
    baseZones: { ...stages[0].zones },
    objectives: FRONT_OBJECTIVES.map((o) => ({ ...o, y: gy(o.x, o.z) })),
    roads: [],
    trenches: segs.map((q) => [q.x0, q.z0, q.x1, q.z1]),           // mini harita / denetim: siper kesik dikdörtgenleri
    front: { sectors: FRONT_SECTORS, stages, hints, ramps },
    env: {
      sky: ['#7c8186', '#a7aaa6', '#c4c0b2'], fog: ['#a2a197', 60, 250],
      sun: ['#ece2cc', 1.3], hemi: ['#b5bac0', '#544b3b', 0.9], cloud: '#bdbdb8', clouds: 26,
      sunPos: [-60, 70, 48],
    },
  };
}
