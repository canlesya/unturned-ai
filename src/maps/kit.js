// Harita yapı kiti: bina, araç, prop ve ağaçlar. Hepsi MapBuilder (b) üzerine çizilir.

export const COL = {
  grass: '#7f9448',
  asphalt: '#3f4248',
  asphaltLot: '#56595f',
  curb: '#a3a39b',
  dirt: '#a98d63',
  concrete: '#a9a9a3',
  trim: '#e8e6df',
  plinth: '#8b8a84',
  wood: '#8b5a2b',
  woodDark: '#5e3c1d',
  woodLight: '#b58a57',
  floor: '#9c7a52',
  yellow: '#d9a921',
  white: '#e8e8e4',
};

// ───────── yardımcı ─────────
function windows(len, center, door, step = 3.2, w = 1.2, b = 1.0, top = 2.1) {
  const n = Math.max(1, Math.floor((len - 1.6) / step));
  const out = [];
  for (let i = 0; i < n; i++) {
    const at = center + (i - (n - 1) / 2) * step;
    if (door && Math.abs(at - door.at) < door.w / 2 + w / 2 + 0.7) continue;
    out.push({ at, w, b, top, glass: true });
  }
  return out;
}

const DOOR = (at, w = 1.3, top = 2.3) => ({ at, w, b: 0, top });

// ───────── Ev / bina ─────────
// Gerçek gövde house.js'te (odalar, mobilya, merdiven kovası, çatı erişimi). Seçenekler: bkz. house.js başlığı.
export { house } from './house.js';

// ───────── Ambar ─────────
export function barn(b, rng, { x, z, w = 12, d = 18, door = 's', color = '#9c3a2c', roof = '#6c7078' }) {
  const red = color, H = 5.2, T = 0.3;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  b.box(x, 0, z, w - 0.4, 0.06, d - 0.4, '#8a7048', { collide: false });
  const big = { at: x, w: 4.4, b: 0, top: 4.2 };
  const hi = (len, c) => windows(len, c, null, 3.6, 1.0, 3.0, 4.3);
  b.wall('x', x0, x1, z0, 0, H, T, red, [big]);
  b.wall('x', x0, x1, z1, 0, H, T, red, [big]);
  b.wall('z', z0 + T / 2, z1 - T / 2, x0, 0, H, T, red, hi(d, z));
  b.wall('z', z0 + T / 2, z1 - T / 2, x1, 0, H, T, red, hi(d, z));
  // beyaz çerçeve + X payanda
  for (const zz of [z0, z1]) {
    const s = zz === z0 ? -1 : 1;
    b.box(x - 2.35, 0, zz + s * 0.17, 0.25, 4.3, 0.1, COL.white, { collide: false });
    b.box(x + 2.35, 0, zz + s * 0.17, 0.25, 4.3, 0.1, COL.white, { collide: false });
    b.box(x, 4.2, zz + s * 0.17, 4.9, 0.25, 0.1, COL.white, { collide: false });
  }
  b.box(x, H - 0.3, z, w + 0.2, 0.3, d + 0.2, COL.white, { collide: false });
  b.box(x, H - 0.2, z, w, 0.2, d, '#a58a68');
  b.prism(x, H - 0.1, z, w + 1.4, 4.6, d + 1.2, roof, {});
  // samanlık balyaları + sandıklar
  for (let i = 0; i < 6; i++) hayBale(b, x0 + 1.4 + (i % 3) * 1.5, z0 + 1.3 + Math.floor(i / 3) * 1.3);
  b.box(x1 - 1.2, 0, z - 2, 1.0, 1.0, 1.0, COL.woodLight);
  b.box(x1 - 1.2, 0, z - 3.2, 1.0, 1.0, 1.0, COL.woodLight);
  b.box(x1 - 1.2, 1.0, z - 2.2, 1.0, 1.0, 1.0, COL.woodLight);
  b.box(x0 + 1.0, 0, z + 3, 0.9, 0.9, 2.4, '#7a5a38');
}

export function hayBale(b, x, z, y = 0) {
  b.cyl(x, y + 0.6, z, 0.6, 0.6, 1.2, '#d6b85a', { rx: Math.PI / 2, center: true, seg: 8, collide: false });
  b.collide(x, y, z, 1.2, 1.2, 1.2);
}

export function silo(b, x, z, r = 2.2, h = 11) {
  b.cyl(x, 0, z, r, r, h, '#b9bdc2', { seg: 10 });
  b.ico(x, h, z, r, '#9ea3a8', { scale: [1, 0.55, 1], detail: 1 });
  for (let i = 1; i < 5; i++) b.cyl(x, i * (h / 5), z, r + 0.05, r + 0.05, 0.18, '#8a8f95', { seg: 10, collide: false });
  b.box(x + r + 0.1, 0, z, 0.1, h - 1, 0.5, '#7a7f85', { collide: false });
}

// ───────── Depo ─────────
export function warehouse(b, rng, { x, z, w = 22, d = 14 }) {
  const H = 7, T = 0.35, wall = '#8f949c';
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  b.box(x, 0, z, w - 0.4, 0.06, d - 0.4, '#6a6d73', { collide: false });
  const roll = (at) => ({ at, w: 4.2, b: 0, top: 4.4 });
  const hi = (len, c) => windows(len, c, null, 3.4, 1.8, 4.6, 6.0);
  b.wall('x', x0, x1, z1, 0, H, T, wall, [roll(x - 6), roll(x + 6), ...hi(w, x).filter((o) => Math.abs(o.at - (x - 6)) > 3 && Math.abs(o.at - (x + 6)) > 3)]);
  b.wall('x', x0, x1, z0, 0, H, T, wall, [roll(x), ...hi(w, x).filter((o) => Math.abs(o.at - x) > 3)]);
  b.wall('z', z0 + T / 2, z1 - T / 2, x0, 0, H, T, wall, [{ at: z, w: 1.3, b: 0, top: 2.3 }, ...hi(d, z).filter((o) => Math.abs(o.at - z) > 2)]);
  b.wall('z', z0 + T / 2, z1 - T / 2, x1, 0, H, T, wall, hi(d, z));
  b.box(x, 5.2, z1 + 0.19, w, 0.55, 0.06, '#c0392b', { collide: false });    // kırmızı şerit (kapıların üstünde)
  b.box(x, 5.2, z0 - 0.19, w, 0.55, 0.06, '#c0392b', { collide: false });
  b.box(x, H - 0.2, z, w, 0.2, d, '#6a6d73');
  b.prism(x, H - 0.1, z, d + 1.0, 1.6, w + 1.0, '#7b8794', { ry: Math.PI / 2 });
  // raflar + paletler + sandıklar
  for (let i = 0; i < 3; i++) {
    const rx = x0 + 3 + i * 3.4;
    b.box(rx, 0, z - 1.5, 1.2, 2.6, 6.0, '#3b6a9a');
    b.box(rx, 0.0, z - 1.5, 1.25, 0.2, 6.05, '#d9a921', { collide: false });
    b.box(rx, 1.3, z - 1.5, 1.25, 0.12, 6.05, '#d9a921', { collide: false });
  }
  for (let i = 0; i < 5; i++) b.box(x + 1.5 + rng() * 6, 0, z + 1.5 + rng() * 3.5, 1.1, 0.9 + rng() * 0.9, 1.1, COL.woodLight);
}

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

// ───────── Kilise ─────────
export function church(b, rng, { x, z, w = 9, d = 16 }) {
  const H = 5.4, T = 0.4, wall = '#e6dfcd';
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  for (const [px, pz, pw, pd] of [[x, z0 - 0.25, w + 0.5, 0.5], [x, z1 + 0.25, w + 0.5, 0.5], [x0 - 0.25, z, 0.5, d], [x1 + 0.25, z, 0.5, d]]) b.box(px, 0, pz, pw, 0.4, pd, COL.plinth, { collide: false });
  b.box(x, 0, z, w - 0.4, 0.06, d - 0.4, '#a58a68', { collide: false });
  const tall = (len, c, skip = []) => {
    const out = [];
    const n = Math.floor((len - 3) / 3.4);
    for (let i = 0; i < n; i++) {
      const at = c + (i - (n - 1) / 2) * 3.4;
      if (skip.some((s) => Math.abs(at - s) < 2.2)) continue;
      out.push({ at, w: 1.1, b: 1.2, top: 4.3, glass: true, glassColor: i % 2 ? '#7aa8e8' : '#e8887a' });
    }
    return out;
  };
  b.wall('x', x0, x1, z1, 0, H, T, wall, [{ at: x, w: 1.6, b: 2.0, top: 4.4, glass: true, glassColor: '#e8c26a' }]);           // arka (sunak) duvarı
  b.wall('x', x0, x1, z0, 0, H, T, wall, [{ at: x, w: 2.0, b: 0, top: 3.2 }]);                                             // ön kapı (kuzey, caddeye bakar)
  b.wall('z', z0 + T / 2, z1 - T / 2, x0, 0, H, T, wall, [...tall(d, z, [z0 + 4]), { at: z0 + 4, w: 1.3, b: 0, top: 2.4 }]);
  b.wall('z', z0 + T / 2, z1 - T / 2, x1, 0, H, T, wall, tall(d, z, [z0 + 4]));
  b.box(x, H - 0.2, z, w, 0.2, d, '#e0d8c4');
  b.prism(x, H - 0.1, z, w + 1.2, 3.6, d + 1.0, '#5b4a45', {});
  // çan kulesi (kuzey ön cephe)
  const tx = x, tz = z0 - 2.2, TH = 11;
    b.wall('x', tx - 2.5, tx + 2.5, tz - 2.5, 0, TH, 0.4, wall, [{ at: tx, w: 2.0, b: 0, top: 3.3 }]);
  b.wall('x', tx - 2.5, tx + 2.5, tz + 2.5, 5.4, TH - 5.4, 0.4, wall, []);
  b.wall('z', tz - 2.3, tz + 2.3, tx - 2.5, 0, TH, 0.4, wall, [{ at: tz, w: 1.1, b: 6.2, top: 8.6, glass: true }]);
  b.wall('z', tz - 2.3, tz + 2.3, tx + 2.5, 0, TH, 0.4, wall, [{ at: tz, w: 1.1, b: 6.2, top: 8.6, glass: true }]);
  b.box((tx + 0.0 + 0.75) , 5.7, tz, 3.5, 0.3, 5, '#7a6a55');                        // çan katı zemini (merdiven şeridi boş)
  b.box(tx - 1.75, 5.7, tz + 2.2, 1.5, 0.3, 0.6, '#7a6a55');                          // merdiven sahanlığı
  b.box(tx, TH, tz, 5.4, 0.3, 5.4, '#5b4a45', { collide: false });
  b.cyl(tx, TH + 0.3, tz, 0.01, 3.8, 6.5, '#4a3b37', { seg: 4, ry: Math.PI / 4, collide: false });
  b.box(tx, 17.6, tz, 0.15, 1.6, 0.15, '#c9b26a', { collide: false });
  b.box(tx, 18.4, tz, 0.8, 0.15, 0.15, '#c9b26a', { collide: false });
  b.stairs(tx - 1.6, tz - 2.0, 0, '+z', 1.2, 14, 0.43, 0.3, COL.woodLight);
  // sıralar + sunak
  for (let r = 0; r < 5; r++) for (const sx of [-2.2, 2.2]) b.box(x + sx, 0, z - 3.2 + r * 2.1, 2.6, 0.95, 0.7, COL.woodDark);
  b.box(x, 0, z1 - 1.3, 3.2, 0.9, 1.0, COL.woodLight);
  b.box(x, 0, z1 - 1.0, 3.8, 0.25, 1.9, '#7a6a55', { collide: false });
}

// ───────── Benzinlik ─────────
export function gasStation(b, rng, { x, z }) {
  const cx = x, cz = z;
  // saçak
  b.box(cx, 4.6, cz, 18, 0.5, 9, COL.white);
  b.box(cx, 4.6, cz - 4.55, 18.2, 0.5, 0.15, '#c0392b', { collide: false });
  b.box(cx, 4.6, cz + 4.55, 18.2, 0.5, 0.15, '#c0392b', { collide: false });
  for (const px of [-7, 7]) for (const pz of [-3, 3]) b.box(cx + px, 0, cz + pz, 0.55, 4.6, 0.55, '#d8d8d2');
  // pompalar
  for (const px of [-4.5, 4.5]) {
    b.box(cx + px, 0, cz, 1.0, 0.18, 6, COL.curb, { collide: false });
    for (const pz of [-1.6, 1.6]) {
      b.box(cx + px, 0.18, cz + pz, 0.8, 1.5, 0.55, '#c0392b');
      b.box(cx + px, 1.3, cz + pz, 0.82, 0.3, 0.57, '#e8e8e4', { collide: false });
    }
  }
  // fiyat tabelası
  b.box(cx + 11, 0, cz - 3.5, 0.3, 7, 0.3, '#6a6d73');
  b.box(cx + 11, 6.0, cz - 3.5, 0.5, 2.2, 2.4, '#e8e8e4', { collide: false });
  b.box(cx + 11, 6.7, cz - 3.5, 0.55, 0.5, 2.0, '#c0392b', { collide: false });
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
    b.box(2.17, 0.62, 0.6, 0.06, 0.18, 0.3, wreck ? '#555' : '#fff2b0', { collide: false, o: wreck ? {} : { emissive: '#fff2b0', emissiveIntensity: 0.4 } });
    b.box(2.17, 0.62, -0.6, 0.06, 0.18, 0.3, wreck ? '#555' : '#fff2b0', { collide: false, o: wreck ? {} : { emissive: '#fff2b0', emissiveIntensity: 0.4 } });
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
    b.box(1.2, 5.9, 0, 0.6, 0.18, 0.35, '#e8e8e4', { collide: false, o: { emissive: '#ffe9a8', emissiveIntensity: 0.3 } });
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

export function pine(b, rng, x, z, s = 1, y = 0) {
  b.cyl(x, y, z, 0.16 * s, 0.24 * s, 1.8 * s, '#5a3d24', { seg: 6, collide: s > 0.7 });
  const col = PINES[Math.floor(rng() * PINES.length)];
  for (let i = 0; i < 4; i++) {
    const r = (1.55 - i * 0.34) * s;
    b.cyl(x, y + (1.4 + i * 1.05) * s, z, 0.02, r, 1.7 * s, i % 2 ? col : PINES[(PINES.indexOf(col) + 1) % PINES.length], { seg: 7, collide: false, ry: rng() * 3 });
  }
}

export function oak(b, rng, x, z, s = 1, y = 0) {
  b.cyl(x, y, z, 0.2 * s, 0.3 * s, 2.4 * s, '#5e4026', { seg: 6 });
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
