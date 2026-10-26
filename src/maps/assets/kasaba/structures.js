// Kasaba yapıları (bina dışı): su kulesi, gözetleme kulesi, büfe, çardak, pazar tezgâhı, çeşme göbeği, silo, kuyu. 12.168
// Kurallar asset kitiyle aynı: eksen hizalı, parçalar yalnız değer, çarpışma görselin içinde; merdivenler basamak blokları (her blok bir
// rıht yüksekliğinde; ardışık bloklar kenardan birleşir → kesintisiz, havada parça yok), dikmelerle yere bağlı.
import { Bld, level, T } from '../common/kasaba-building.js';
import { boxR, post, hull, roundCollide, shade, NC } from '../common/kasaba-shapes.js';
import { KS, PAL } from './style.js';
import * as P from '../common/kasaba-props.js';

// basamak blokları: kol (x0,x1)×(z0,z1) boyunca 'dir' yönünde n basamak, y0'dan rise ile. Alt kenarı 2,0 m'den alçak basamaklar yere kadar dolu
// (altı ya yürünür — en alçak yer ≥ 2 m, gövde 1,78 m sığar — ya da kapalı: nav'ın "geçilir" saydığı yerde başı çarpan yarık kalmaz)
function flight(b, { a0, c0, c1, dir, n, run, rise, y0, col, axis }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = a0 + dir * i * run, e = s + dir * run, lo = Math.min(s, e), hi = Math.max(s, e), yt = y0 + (i + 1) * rise, yb = y0 + i * rise < 2.0 ? 0 : y0 + i * rise;
    if (axis === 'z') boxR(b, c0, c1, yb, yt, lo, hi, col, KS.wood); else boxR(b, lo, hi, yb, yt, c0, c1, col, KS.wood);
    out.push({ lo, hi, yb, yt });
  }
  return out;
}

// sekizgen gövde + araya giren çember dilimleri (çember gövdeyi sarmaz: gövde dilimlere bölünür, çember iki dilimin arasında)
function banded(b, x, y, z, r, h, at, col, bandCol, kind) {
  let cur = 0;
  for (const a of at) { post(b, x, y + cur, z, r, a - cur, col, kind, { collide: false }); post(b, x, y + a, z, r + 0.06, 0.14, bandCol, KS.metal, { collide: false }); cur = a + 0.14; }
  post(b, x, y + cur, z, r, h - cur, col, kind, { collide: false });
  roundCollide(b, x, y, z, r, h);
}

// ═════════ SU KULESİ: 8 m platform, iki kol (batı yüzü güney→kuzey 0→4 m, sahanlık, kuzey yüzü batı→doğu 4→8 m) ═════════
export function waterTower(b, id) {
  const info = { targets: [], entry: null, doors: [] };
  b.obj('su-kulesi:' + id, () => {
    const Y = 8.0, S2 = 3.2, legc = '#4a4d52', wood = '#8a6a45', K = KS;
    for (const sx of [-2.8, 2.8]) for (const sz of [-2.8, 2.8]) boxR(b, sx - 0.225, sx + 0.225, 0, Y - 0.3, sz - 0.225, sz + 0.225, legc, K.metal);
    for (const lv of [2.6, 5.2]) {
      for (const sz of [-2.8, 2.8]) boxR(b, -2.575, 2.575, lv, lv + 0.16, sz - 0.07, sz + 0.07, wood, K.wood, NC);
      for (const sx of [-2.8, 2.8]) boxR(b, sx - 0.07, sx + 0.07, lv, lv + 0.16, -2.575, 2.575, wood, K.wood, NC);
    }
    boxR(b, -S2, S2, Y - 0.3, Y, -S2, S2, '#5a5d62', K.metal);
    // merdiven tarafındaki (batı + kuzey) ayak araları tahta perde: ayak ile basamak arasındaki dar yarık kapanır (bot sıkışmaz)
    for (const yy of [0.25, 0.7, 1.15]) { boxR(b, -2.575, 2.575, yy, yy + 0.3, -2.86, -2.74, wood, K.wood); boxR(b, -2.86, -2.74, yy, yy + 0.3, -2.575, 2.575, wood, K.wood); }
    const rl = (x0, x1, z0, z1) => boxR(b, x0, x1, Y, Y + 1.05, z0, z1, wood, K.wood);
    rl(-S2, S2, S2 - 0.12, S2); rl(S2 - 0.12, S2, -S2 + 0.12, S2 - 0.12); rl(-S2, -S2 + 0.12, -S2 + 0.12, S2 - 0.12);
    rl(-S2, 0.3, -S2, -S2 + 0.12); rl(1.3, S2, -S2, -S2 + 0.12);              // kuzey korkuluğu: merdiven varışı x ∈ [0.3, 1.3] açık
    banded(b, 0, Y, 0, 2.0, 3.6, [0.6, 1.8, 3.0], '#9db4c4', '#6a7a88', K.metal);
    b.cyl(0, Y + 3.6, 0, 0.12, 2.12, 1.3, '#6a7a88', { seg: 8, ry: Math.PI / 8, collide: false, kind: K.metal });
    boxR(b, -0.06, 0.06, Y + 4.9, Y + 5.6, -0.06, 0.06, legc, K.metal, NC);
    boxR(b, -0.15, 0.15, Y + 5.6, Y + 5.9, -0.15, 0.15, '#ff5a3a', K.plain, { collide: false, o: { glow: true } });
    // kol A (x ∈ [−4.6, −3.4], z 1.12 → −3.2), sahanlık (z ∈ [−4.4, −3.2], 3.75–4.0), kol B (z ∈ [−4.4, −3.2], x −3.4 → 0.92)
    const run = 0.27, rise = 0.25, n = 16;
    const fa = flight(b, { a0: -S2 + n * run, c0: -4.6, c1: -3.4, dir: -1, n, run, rise, y0: 0, col: wood, axis: 'z' });
    boxR(b, -4.6, -3.4, 3.75, 4.0, -4.4, -S2, wood, K.wood);
    const fb = flight(b, { a0: -3.4, c0: -4.4, c1: -S2, dir: 1, n, run, rise, y0: 4.0, col: wood, axis: 'x' });
    // dikmeler (basamak bloğunun altına, yere): A kolunda 8. blok, sahanlık köşeleri, B kolunda 5. ve 12. blok
    const sup = (x, z, top) => boxR(b, x - 0.06, x + 0.06, 0, top, z - 0.06, z + 0.06, legc, K.metal, NC);
    for (const x of [-4.5, -3.5]) sup(x, (fa[8].lo + fa[8].hi) / 2, fa[8].yb);
    for (const [x, z] of [[-4.5, -4.3], [-3.5, -4.3], [-4.5, -3.3]]) sup(x, z, 3.75);
    for (const i of [5, 12]) for (const z of [-4.3, -3.3]) sup((fb[i].lo + fb[i].hi) / 2, z, fb[i].yb);
    info.targets.push({ name: 'platform', x: 0, y: Y, z: 2.6 });
    info.entry = { x: -4.0, z: 2.0 };
  });
  return info;
}

// ═════════ GÖZETLEME KULESİ: 6 m platform, batı yanında tek uzun kol (güney → kuzey), çatı ═════════
export function watchtower(b, id) {
  const info = { targets: [], entry: null, doors: [] };
  b.obj('gözetleme:' + id, () => {
    const H = 6.0, c = '#7a5a38', dk = '#5e3c1d', K = KS;
    for (const sx of [-1.7, 1.7]) for (const sz of [-1.7, 1.7]) boxR(b, sx - 0.16, sx + 0.16, 0, H - 0.25, sz - 0.16, sz + 0.16, c, K.wood);
    for (const lv of [1.6, 3.6]) {
      for (const sz of [-1.7, 1.7]) boxR(b, -1.54, 1.54, lv, lv + 0.14, sz - 0.06, sz + 0.06, dk, K.wood, NC);
      for (const sx of [-1.7, 1.7]) boxR(b, sx - 0.06, sx + 0.06, lv, lv + 0.14, -1.54, 1.54, dk, K.wood, NC);
    }
    boxR(b, -2.1, 2.1, H - 0.25, H, -2.1, 2.1, dk, K.wood);
    for (const yy of [0.25, 0.7, 1.15]) boxR(b, -1.76, -1.64, yy, yy + 0.3, -1.54, 1.54, c, K.wood);   // merdiven yanındaki ayak arası tahta perde
    // üst dikmeler + korkuluk (batı yüzünde z ∈ [−1.9, −0.5] varış açıklığı)
    for (const sx of [-1.95, 1.95]) for (const sz of [-1.95, 1.95]) boxR(b, sx - 0.15, sx + 0.15, H, H + 2.4, sz - 0.15, sz + 0.15, c, K.wood);
    const rl = (x0, x1, z0, z1) => boxR(b, x0, x1, H, H + 1.1, z0, z1, c, K.wood);
    rl(-1.8, 1.8, -2.1, -1.98); rl(-1.8, 1.8, 1.98, 2.1); rl(1.98, 2.1, -1.8, 1.8); rl(-2.1, -1.98, -0.5, 1.8);
    boxR(b, -2.5, 2.5, H + 2.4, H + 2.6, -2.5, 2.5, '#6a4a3a', K.wood);
    hull(b, [[-2.5, H + 2.6, -2.5], [2.5, H + 2.6, -2.5], [2.5, H + 2.6, 2.5], [-2.5, H + 2.6, 2.5], [0, H + 3.7, 0]], '#5b4a45', K.roof);
    b.collide(0, H + 2.6, 0, 2.5, 0.5, 2.5);
    boxR(b, -0.12, 0.12, H + 2.18, H + 2.4, -0.12, 0.12, '#ffd98a', K.plain, { collide: false, o: { glow: true } });
    // kol: x ∈ [−3.3, −2.1], z 4.6 → −1.9 (24 basamak 0,25 m)
    const run = 0.27, n = 24;
    const fl = flight(b, { a0: -1.9 + n * run, c0: -3.3, c1: -2.1, dir: -1, n, run, rise: H / n, y0: 0, col: c, axis: 'z' });
    for (const i of [8, 17]) for (const x of [-3.2, -2.2]) boxR(b, x - 0.06, x + 0.06, 0, fl[i].yb, (fl[i].lo + fl[i].hi) / 2 - 0.06, (fl[i].lo + fl[i].hi) / 2 + 0.06, dk, K.wood, NC);
    info.targets.push({ name: 'platform', x: 0, y: H, z: 0 });
    info.entry = { x: -2.7, z: 5.4 };
  });
  return info;
}

// ═════════ BÜFE (küçük bina: tezgâh açıklığı önde, kapı arkada) ═════════
export function kiosk(b, rng, id, col = '#4a8a6a') {
  const S = { k: KS, wall: col, trim: '#ece8dc', pil: '#ece8dc', band: '#ece8dc', casing: '#ece8dc', sill: '#cfc6b0', frame: '#ece8dc', plinth: PAL.plinth, stone: PAL.stoneTrim, roof: '#5a5d62', inner: '#e8e4d8', floor: '#9a8a70', ceil: '#f0ebe0', rail: '#3a3d42', roofTop: '#6f7072', coping: '#d8d4c8', awning: '#c0392b', metal: '#5a5e64' };
  const h = new Bld(b, { id, x0: -1.75, z0: -1.25, w: 3.5, d: 2.5, floors: 1, style: S, pilasters: false, roof: { type: 'flat', parapet: 0.35 } });
  h.open('s', 0.5, 'shop', [0], { w: 2.5, awning: true });
  h.door('n', 1.0, { w: 1.5, leaf: false });
  const info = h.build();
  return info;
}

// ═════════ ÇARDAK (park): taş platform, 4 sekizgen dikme, alçak korkuluk (iki yanda giriş), kare taban + piramit çatı ═════════
export function gazebo(b, id) {
  b.obj('çardak:' + id, () => {
    const R = 2.2, pc = '#ece8dc', K = KS;
    boxR(b, -2.6, 2.6, 0, 0.3, -2.6, 2.6, '#b9b5aa', K.stone);
    for (const sx of [-R, R]) for (const sz of [-R, R]) post(b, sx, 0.3, sz, 0.15, 2.5, pc, K.conc);
    const ap = 0.15 * Math.cos(Math.PI / 8), rc = '#8a6a45';
    const rail = (axis, c, a0, a1) => (axis === 'x' ? boxR(b, a0, a1, 0.3, 1.0, c - 0.05, c + 0.05, rc, K.wood) : boxR(b, c - 0.05, c + 0.05, 0.3, 1.0, a0, a1, rc, K.wood));
    rail('x', -R, -R + ap, R - ap); rail('x', R, -R + ap, R - ap);          // kuzey + güney kapalı; doğu / batı giriş
    boxR(b, -2.8, 2.8, 2.8, 3.0, -2.8, 2.8, '#6b4a3a', K.wood);
    hull(b, [[-2.8, 3.0, -2.8], [2.8, 3.0, -2.8], [2.8, 3.0, 2.8], [-2.8, 3.0, 2.8], [0, 4.4, 0]], '#7a3b2e', K.roof);
    b.collide(0, 3.0, 0, 2.8, 0.7, 2.8);
    for (const sz of [-1.6, 1.6]) b.with(0, 0.3, sz, sz < 0 ? 0 : Math.PI, () => b.obj('bank', () => { boxR(b, -1.0, 1.0, 0.4, 0.45, 0, 0.4, '#8a6440', K.wood); for (const x of [-0.85, 0.7]) boxR(b, x, x + 0.15, 0, 0.4, 0.05, 0.35, '#9a968c', K.stone); }));
  });
  return P.footW(b, -2.8, 2.8, -2.8, 2.8, 4.4);
}

// ═════════ PAZAR TEZGÂHI: tezgâh + 4 dikme + tente + kasalar ═════════
export function stall(b, rng, x, z, ry, col = '#c0392b') {
  let fp;
  b.with(x, 0, z, ry, () => b.obj('tezgâh', () => {
    const K = KS, wc = '#8a6440';
    boxR(b, -1.1, 1.1, 0, 0.85, -0.45, 0.45, wc, K.wood);
    boxR(b, -1.15, 1.15, 0.85, 0.9, -0.5, 0.5, shade(wc, 0.8), K.wood, NC);
    for (const sx of [-1.25, 1.17]) for (const sz of [-0.58, 0.5]) boxR(b, sx, sx + 0.08, 0, 2.2, sz, sz + 0.08, '#5a3d24', K.wood, NC);   // ince dikme: çarpışmasız (tezgâh köşesinde girinti yapıp botu takmasın)
    boxR(b, -1.35, 1.35, 2.2, 2.28, -0.75, 0.75, col, K.board);
    for (let i = 0; i < 5; i++) boxR(b, -1.35 + i * 0.54, -1.35 + i * 0.54 + 0.27, 2.2, 2.28, 0.75, 0.77, '#f2efe8', K.plain, NC);
    const fc = ['#d9a921', '#c0392b', '#4a8a3a', '#e07a2a'];
    for (let i = 0; i < 3; i++) { const x0 = -0.95 + i * 0.68; boxR(b, x0, x0 + 0.55, 0.9, 1.08, -0.3, 0.2, '#a5865a', K.wood, NC); boxR(b, x0 + 0.04, x0 + 0.51, 1.08, 1.16, -0.26, 0.16, fc[(i + Math.floor(rng() * 4)) % 4], K.plain, NC); }
    fp = P.footW(b, -1.35, 1.35, -0.77, 0.77, 2.28);
  }));
  return fp;
}

// ═════════ ÇEŞME GÖBEĞİ (kavşak adası): bordürlü ada + kare havuz + ayak + tas ═════════
export function fountain(b) {
  b.obj('çeşme', () => {
    const K = KS;
    const wc = '#cfc6b0';
    boxR(b, -3.0, 3.0, 0.15, 0.7, -3.0, -2.6, wc, K.stone); boxR(b, -3.0, 3.0, 0.15, 0.7, 2.6, 3.0, wc, K.stone);
    boxR(b, -3.0, -2.6, 0.15, 0.7, -2.6, 2.6, wc, K.stone); boxR(b, 2.6, 3.0, 0.15, 0.7, -2.6, 2.6, wc, K.stone);
    boxR(b, -3.05, 3.05, 0.7, 0.78, -3.05, -2.55, '#bdb5a2', K.stone, NC); boxR(b, -3.05, 3.05, 0.7, 0.78, 2.55, 3.05, '#bdb5a2', K.stone, NC);
    boxR(b, -3.05, -2.55, 0.7, 0.78, -2.55, 2.55, '#bdb5a2', K.stone, NC); boxR(b, 2.55, 3.05, 0.7, 0.78, -2.55, 2.55, '#bdb5a2', K.stone, NC);
    boxR(b, -2.6, 2.6, 0.15, 0.5, -2.6, 2.6, '#4a7a8a', K.plain);             // su (sığ, üstüne basılır)
    post(b, 0, 0.5, 0, 0.45, 0.25, wc, K.stone);
    post(b, 0, 0.75, 0, 0.25, 1.1, wc, K.stone);
    b.cyl(0, 1.85, 0, 1.3, 0.4, 0.35, wc, { seg: 8, ry: Math.PI / 8, collide: false, kind: K.stone });
    roundCollide(b, 0, 1.85, 0, 0.4, 0.35);
    b.cyl(0, 2.2, 0, 1.18, 1.18, 0.02, '#5a8a9a', { seg: 8, ry: Math.PI / 8, collide: false, kind: K.plain });
    post(b, 0, 2.22, 0, 0.12, 0.48, wc, K.stone, { collide: false });
  });
  return P.footW(b, -3.5, 3.5, -3.5, 3.5, 2.7);
}

// ═════════ SİLO ═════════
export function silo(b, x, z, r = 2.0, h = 10) {
  b.obj('silo', () => {
    boxR(b, x - r - 0.2, x + r + 0.2, 0, 0.3, z - r - 0.2, z + r + 0.2, '#9a968c', KS.conc);
    banded(b, x, 0.3, z, r, h, [2.5, 5.0, 7.5], '#b9bdc2', '#8f949c', KS.corr);
    b.cyl(x, 0.3 + h, z, 0.25, r + 0.08, 1.4, '#8f949c', { seg: 8, ry: Math.PI / 8, collide: false, kind: KS.metal });
  });
  return P.footW(b, x - r - 0.2, x + r + 0.2, z - r - 0.2, z + r + 0.2, h + 1.7);
}

// ═════════ KUYU ═════════
export function well(b, x, z) {
  b.obj('kuyu', () => {
    post(b, x, 0, z, 0.9, 0.85, '#8a867c', KS.stone);
    post(b, x, 0.85, z, 0.95, 0.08, '#a39a82', KS.stone, { collide: false });
    for (const sx of [-0.7, 0.62]) boxR(b, x + sx, x + sx + 0.08, 0.93, 2.3, z - 0.04, z + 0.04, '#6a4a30', KS.wood, NC);
    boxR(b, x - 0.62, x + 0.62, 1.7, 1.8, z - 0.04, z + 0.04, '#6a4a30', KS.wood, NC);
    hull(b, [[x - 0.9, 2.3, z - 0.7], [x + 0.9, 2.3, z - 0.7], [x + 0.9, 2.3, z + 0.7], [x - 0.9, 2.3, z + 0.7], [x - 0.9, 2.8, z], [x + 0.9, 2.8, z]], '#7a3b2e', KS.roof);
  });
  return P.footW(b, x - 0.95, x + 0.95, z - 0.95, z + 0.95, 2.8);
}
