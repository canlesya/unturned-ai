// Harita yapı kiti: bina, araç, prop ve ağaçlar. Hepsi MapBuilder (b) üzerine çizilir.
//
// Dosyalar: kitBase.js (COL, hayBale) · house.js (ev/bina üreteci) · furn.js (mobilya) · kitBuildings.js (ambar, depo, kilise, benzinlik, silo)
//           · kitTown.js (taş duvar, çit, su kulesi, çeşme, büfe, tezgâh, durak, pano, çardak, ekin).
// Geriye uyumlu: eski çağrı imzaları aynen çalışır; yeni özellikler opsiyonel parametredir.
//   house(...)        + theme, roofAccess, glow (bkz. house.js başlığı); artık { targets, entry, ... } döner.
//   watchtower(...)   merdiven platforma bağlanır (batı yüzü), 1.1 m korkuluk, glow fener; { entry, targets } döner. h opsiyonel.
//   barn(...)         + ry, doors:'both'|'front'|'back', loft (samanlık: merdivenle çıkılır).
//   warehouse(...)    + ry, mezzanine (asma kat), wall. church(...) + ry (çan kulesine içten merdiven). gasStation(...) + store:'n'|'s'|'e'|'w', storeRoof, ry.
//   pine/oak(...)     + son parametre collide=true (çevre ormanı için false).
//   Binalar köşelerde b.shell ile tam kapalıdır (T/2 çentik/boşluk yok).
import { COL, windows, DOOR } from './kitBase.js';
export { COL };

// ───────── Ev / bina ─────────
// Gerçek gövde house.js'te (odalar, mobilya, merdiven kovası, çatı erişimi). Seçenekler: bkz. house.js başlığı.
export { house } from './house.js';

// ───────── Ambar / silo / depo / kilise / benzinlik (kitBuildings.js) ─────────
export { barn, silo, warehouse, church, gasStation } from './kitBuildings.js';
export { hayBale } from './kitBase.js';

// ───────── Konteyner ─────────
export function container(b, { x, z, ry = 0, y = 0, color = '#3b6a9a', len = 6.1 }) {
  b.with(x, y, z, ry, () => {
    b.box(0, 0, 0, len, 2.6, 2.44, color);
    for (let i = -Math.floor(len / 0.5 / 2) + 1; i < Math.floor(len / 0.5 / 2); i++) {
      b.box(i * 0.5, 0.1, 1.24, 0.12, 2.4, 0.06, '#000000', { collide: false, o: { transparent: true, opacity: 0.18 } });
      b.box(i * 0.5, 0.1, -1.24, 0.12, 2.4, 0.06, '#000000', { collide: false, o: { transparent: true, opacity: 0.18 } });
    }
    b.box(len / 2 + 0.03, 0.1, 0, 0.06, 2.4, 2.3, '#000000', { collide: false, o: { transparent: true, opacity: 0.2 } });
  });
}

// ───────── Araçlar (+X ileri) ─────────
export function car(b, { x, z, ry = 0, color = '#b33a2a', wreck = false }) {
  b.with(x, 0, z, ry, () => {
    const c = wreck ? '#6e5a4a' : color;
    b.box(0, 0.3, 0, 4.3, 0.75, 1.8, c, { collide: false });
    b.box(-0.35, 1.05, 0, 2.3, 0.62, 1.64, c, { collide: false });
    b.box(-0.35, 1.08, 0, 2.34, 0.42, 1.67, '#22333f', { collide: false, o: { roughness: 0.2 } });
    b.box(2.15, 0.3, 0, 0.12, 0.35, 1.7, '#222', { collide: false });
    b.box(-2.15, 0.3, 0, 0.12, 0.35, 1.7, '#222', { collide: false });
    b.box(2.17, 0.62, 0.6, 0.06, 0.18, 0.3, wreck ? '#555' : '#fff2b0', { collide: false, o: wreck ? {} : { glow: true } });
    b.box(2.17, 0.62, -0.6, 0.06, 0.18, 0.3, wreck ? '#555' : '#fff2b0', { collide: false, o: wreck ? {} : { glow: true } });
    for (const wx of [-1.4, 1.4]) for (const wz of [-0.92, 0.92]) b.cyl(wx, 0.34, wz, 0.34, 0.34, 0.26, '#1c1c1e', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
    b.collide(0, 0, 0, 4.4, 1.7, 1.85);
  });
}

export function bus(b, { x, z, ry = 0, color = '#d9a921' }) {
  b.with(x, 0, z, ry, () => {
    b.box(0, 0.35, 0, 10, 2.4, 2.5, color, { collide: false });
    b.box(0, 1.35, 0, 10.04, 0.9, 2.54, '#22333f', { collide: false, o: { roughness: 0.2 } });
    b.box(0, 2.6, 0, 10, 0.15, 2.5, '#d8d8d2', { collide: false });
    b.box(5.02, 0.9, 0, 0.06, 0.5, 2.2, '#222', { collide: false });
    for (const wx of [-3.2, 3.2]) for (const wz of [-1.2, 1.2]) b.cyl(wx, 0.5, wz, 0.5, 0.5, 0.3, '#1c1c1e', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
    b.collide(0, 0, 0, 10, 2.8, 2.55);
  });
}

export function truck(b, { x, z, ry = 0, color = '#c0392b', cargo = '#cfd3d8' }) {
  b.with(x, 0, z, ry, () => {
    b.box(3.0, 0.55, 0, 2.2, 2.2, 2.4, color, { collide: false });
    b.box(3.4, 1.6, 0, 1.3, 0.8, 2.42, '#22333f', { collide: false });
    b.box(-1.0, 0.7, 0, 6.6, 2.9, 2.5, cargo, { collide: false });
    for (const wx of [-3, -1.2, 3.0]) for (const wz of [-1.1, 1.1]) b.cyl(wx, 0.5, wz, 0.5, 0.5, 0.4, '#1c1c1e', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
    b.collide(0.25, 0, 0, 8.8, 3.6, 2.55);
  });
}

// ───────── Propler ─────────
export const crate = (b, x, z, s = 1, y = 0, ry = 0) => b.box(x, y, z, s, s, s, COL.woodLight, { ry });
export const barrel = (b, x, z, color = '#c0392b') => b.cyl(x, 0, z, 0.35, 0.35, 0.95, color, { seg: 8 });
export const dumpster = (b, x, z, ry = 0) => b.with(x, 0, z, ry, () => { b.box(0, 0, 0, 2.2, 1.3, 1.1, '#3f6b4a'); b.box(0, 1.3, 0, 2.3, 0.1, 1.2, '#2f5238', { collide: false }); });
export const barrier = (b, x, z, ry = 0) => b.with(x, 0, z, ry, () => { b.box(0, 0, 0, 2.6, 0.9, 0.5, COL.concrete); b.box(0, 0.9, 0, 2.6, 0.1, 0.35, '#8c8c86', { collide: false }); });

export function sandbags(b, x, z, len = 4, ry = 0) {
  b.with(x, 0, z, ry, () => {
    const n = Math.round(len / 0.9);
    for (let row = 0; row < 3; row++) for (let i = 0; i < n - (row % 2); i++) {
      b.box(-len / 2 + 0.45 + i * 0.9 + (row % 2) * 0.45, row * 0.32, 0, 0.88, 0.32, 0.55, row % 2 ? '#a89468' : '#b3a073', { collide: false });
    }
    b.collide(0, 0, 0, len, 0.96, 0.6);
  });
}

export function lamp(b, x, z, ry = 0) {
  b.with(x, 0, z, ry, () => {
    b.cyl(0, 0, 0, 0.1, 0.14, 6.2, '#4a4d52', { seg: 6 });
    b.box(0.6, 6.0, 0, 1.4, 0.12, 0.14, '#4a4d52', { collide: false });
    b.box(1.2, 5.9, 0, 0.6, 0.18, 0.35, '#ffe9a8', { collide: false, o: { glow: true } });   // gece yanar
  });
}

export function bench(b, x, z, ry = 0) {
  b.with(x, 0, z, ry, () => {
    b.box(0, 0.45, 0, 1.8, 0.1, 0.5, COL.woodLight, { collide: false });
    b.box(0, 0.75, -0.22, 1.8, 0.4, 0.08, COL.woodLight, { collide: false });
    b.box(-0.8, 0, 0, 0.1, 0.45, 0.45, '#444', { collide: false });
    b.box(0.8, 0, 0, 0.1, 0.45, 0.45, '#444', { collide: false });
    b.collide(0, 0, 0, 1.8, 1.1, 0.55);
  });
}

// Dümdüz çit (x ya da z ekseninde)
export function fence(b, x0, z0, x1, z1, h = 1.1, color = COL.woodLight) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const n = Math.max(1, Math.round(len / 2.4));
  const step = len / n;
  for (let i = 0; i <= n; i++) {
    const px = alongX ? Math.min(x0, x1) + i * step : x0;
    const pz = alongX ? z0 : Math.min(z0, z1) + i * step;
    b.box(px, 0, pz, 0.14, h + 0.1, 0.14, COL.woodDark, { collide: false });
  }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (const yy of [0.35, 0.8]) {
    if (alongX) b.box(cx, yy, z0, len, 0.1, 0.07, color, { collide: false });
    else b.box(x0, yy, cz, 0.07, 0.1, len, color, { collide: false });
  }
  if (alongX) b.collide(cx, 0, z0, len, h, 0.2); else b.collide(x0, 0, cz, 0.2, h, len);
}

export function tombstone(b, x, z, ry = 0) {
  b.with(x, 0, z, ry, () => { b.box(0, 0, 0, 0.7, 1.0, 0.18, '#9a9a94'); b.box(0, 1.0, 0, 0.7, 0.14, 0.18, '#9a9a94', { collide: false }); });
}

// ───────── Gözetleme kulesi ─────────
// Yerel çerçeve: platform 4.2×4.2, üst yüzey y=h. Merdiven kulenin BATI yüzü boyunca (x=-3.3…-2.1), güneyden (+z) kuzeye (−z)
// çıkar ve son basamak platformla aynı seviyede biter; batı korkuluğunda merdivenin geldiği yerde 1.7 m açıklık vardır.
// Basamak 0.27 m (adım yükseltmesi 0.5 m'nin altında). Kule altı açıktır (yalnızca 4 ayak çarpışır). ry yalnızca 90° katları.
// Korkuluk 1.1 m: ayakta nişan alınır, çömelince siper. Üstte gece için glow fener. Dönüş: { entry, targets:[{name,x,y,z}] }.
export function watchtower(b, { x, z, ry = 0, color = '#7a5a38', h = 6.0 }) {
  const H = h, dark = '#5e3c1d';
  const info = { entry: null, targets: [], h: H };
  const toWorld = (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
  b.with(x, 0, z, ry, () => {
    const n = Math.round(H / 0.27), rise = H / n, run = 0.27, zt = -1.4, zb = zt + n * run;
    // ayaklar + çapraz destekler
    for (const sx of [-1.7, 1.7]) for (const sz of [-1.7, 1.7]) b.box(sx, 0, sz, 0.32, H + 2.4, 0.32, color);
    for (const lv of [1.6, 3.6]) {
      for (const sz of [-1.7, 1.7]) b.box(0, lv, sz, 3.4, 0.14, 0.12, dark, { collide: false });
      for (const sx of [-1.7, 1.7]) b.box(sx, lv, 0, 0.12, 0.14, 3.4, dark, { collide: false });
    }
    const brace = (sx, sz, along) => {
      const len = Math.hypot(3.4, 2.0), ang = Math.atan2(2.0, 3.4);
      if (along === 'x') b.box(0, 1.6 + 1.0 - 0.06, sz, len, 0.12, 0.1, dark, { collide: false, rz: ang });
      else b.box(sx, 1.6 + 1.0 - 0.06, 0, 0.1, 0.12, len, dark, { collide: false, rx: ang });
    };
    brace(0, -1.7, 'x'); brace(0, 1.7, 'x'); brace(-1.7, 0, 'z'); brace(1.7, 0, 'z');
    // platform
    b.box(0, H - 0.25, 0, 4.2, 0.25, 4.2, dark);
    for (const sz of [-1.9, 1.9]) b.box(0, H - 0.5, sz, 4.2, 0.25, 0.2, color, { collide: false });
    // korkuluk: kuzey, güney, doğu tam; batı yüzünde açıklık (zg0..zg1)
    const rl = (cx, cz, w2, d2) => { b.box(cx, H, cz, w2, 1.1, d2, color); b.box(cx, H + 1.1, cz, w2 + 0.04, 0.08, d2 + 0.04, dark, { collide: false }); };
    rl(0, -2.0, 4.2, 0.14); rl(0, 2.0, 4.2, 0.14); rl(2.0, 0, 0.14, 3.86);
    const zg1 = -0.4;
    rl(-2.0, (zg1 + 2.0) / 2, 0.14, 2.0 - zg1);
    b.box(-2.0, H, -1.95, 0.2, 1.1, 0.2, dark, { collide: false });   // açıklığın kuzey direği
    // çatı + 4 direk + glow fener
    b.box(0, H + 2.4, 0, 5.0, 0.2, 5.0, '#6a4a3a');
    b.prism(0, H + 2.6, 0, 5.2, 1.1, 5.2, '#5b4a45');
    b.box(0, H + 1.7, 0, 0.05, 0.7, 0.05, dark, { collide: false });
    b.box(0, H + 1.4, 0, 0.34, 0.32, 0.34, '#ffd98a', { collide: false, o: { glow: true } });
    // platformdaki sandık (siper)
    b.box(1.3, H, 1.3, 0.8, 0.8, 0.8, '#b58a57');
    b.box(-1.2, H, 1.4, 0.5, 0.5, 0.5, '#8a6a3a');
    // merdiven (batı yüzü): zb güney uç (alt), zt kuzey uç (üst)
    b.stairs(-2.7, zb, 0, '-z', 1.2, n, rise, run, '#8b6a45');
    for (const sx of [-3.35]) {
      b.box(sx, 0, (zt + zb) / 2, 0.08, 0.15, zb - zt, dark, { collide: false });
      // el tutamağı: eğimli kiriş + direkler
      const L = Math.hypot(zb - zt, H), a = Math.atan2(H, zb - zt);
      b.box(sx, (H + 1.0) / 2 - 0.04, (zt + zb) / 2, 0.07, 0.07, L, dark, { collide: false, rx: -a });
      for (let i = 0; i <= 4; i++) { const t = i / 4, pz = zb + (zt - zb) * t, py = rise * Math.round(t * n); b.box(sx, py, pz, 0.07, 1.0, 0.07, color, { collide: false }); }
    }
    // alt fener (gece kuleyi gösterir)
    b.box(-3.35, 1.7, zb + 0.2, 0.2, 0.28, 0.2, '#ffd98a', { collide: false, o: { glow: true } });
    b.box(-3.35, 0, zb + 0.2, 0.08, 1.7, 0.08, dark, { collide: false });
    // tabela
    b.box(2.0, H + 0.45, -2.08, 1.0, 0.4, 0.04, '#3a2a18', { collide: false });
    info.zt = zt; info.zb = zb;
  });
  const [ex, ez] = toWorld(-2.7, zb0(H) + 0.9);
  info.entry = { x: ex, z: ez };
  const [px, pz] = toWorld(0, 0.4);
  info.targets.push({ name: 'platform', x: px, y: H, z: pz });
  const [tx, tz] = toWorld(1.0, -1.0);
  info.targets.push({ name: 'platform-ne', x: tx, y: H, z: tz });
  return info;
}
function zb0(H) { const n = Math.round(H / 0.27); return -1.4 + n * 0.27; }

// ───────── Ağaçlar ─────────
const PINES = ['#2f5a2c', '#2a4f28', '#34632f', '#27472a'];
const OAKS = ['#5f8f3a', '#6b9a3f', '#547f33'];

export function pine(b, rng, x, z, s = 1, y = 0, collide = true) {
  b.cyl(x, y, z, 0.16 * s, 0.24 * s, 1.8 * s, '#5a3d24', { seg: 6, collide: collide && s > 0.7 });
  const col = PINES[Math.floor(rng() * PINES.length)];
  for (let i = 0; i < 4; i++) {
    const r = (1.55 - i * 0.34) * s;
    b.cyl(x, y + (1.4 + i * 1.05) * s, z, 0.02, r, 1.7 * s, i % 2 ? col : PINES[(PINES.indexOf(col) + 1) % PINES.length], { seg: 7, collide: false, ry: rng() * 3 });
  }
}

export function oak(b, rng, x, z, s = 1, y = 0, collide = true) {
  b.cyl(x, y, z, 0.2 * s, 0.3 * s, 2.4 * s, '#5e4026', { seg: 6, collide });
  const col = OAKS[Math.floor(rng() * OAKS.length)];
  b.ico(x, y + 3.6 * s, z, 1.9 * s, col, { detail: 1, scale: [1, 0.85, 1] });
  b.ico(x + 0.9 * s, y + 3.1 * s, z + 0.4 * s, 1.2 * s, OAKS[(OAKS.indexOf(col) + 1) % OAKS.length], { detail: 0 });
  b.ico(x - 0.8 * s, y + 3.3 * s, z - 0.5 * s, 1.3 * s, col, { detail: 0 });
}

export function bush(b, rng, x, z, s = 1) {
  b.ico(x, 0.4 * s, z, 0.7 * s, rng() > 0.5 ? '#4f7a33' : '#5d8a3a', { scale: [1.2, 0.8, 1.2] });
}

export function rock(b, rng, x, z, s = 1, collide = true) {
  b.ico(x, 0.3 * s, z, 0.9 * s, rng() > 0.5 ? '#8a8a84' : '#76766f', { scale: [1.3, 0.8, 1.0], detail: 0 });
  if (collide) b.collide(x, 0, z, 1.6 * s, 0.9 * s, 1.4 * s);
}
