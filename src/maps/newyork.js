import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import * as K from './kit.js';
import * as M from './kitMil.js';
import * as T from './kitTown.js';

// "New York" — Enfekte moduna özel gece haritası: patlamış, harap Manhattan caddesi.
// Yapı: doğu-batı ana cadde (Broadway) + kuzey-güney 5. cadde meydanda kesişir (anıt, helikopter enkazı, yanık araçlar). İki yanda yıkık gökdelen blokları
// (dolu pencereler, patlak delikler, çatlak tepe, yangın merdivenleri), arkada sokaklar, çökmüş bina, otopark, inşaat, metro girişleri.
// İnsanlar YÜKSEK NOKTALARA (perches) çıkar: anıt, kamyon kasaları, metro girişi çatıları, çökmüş kat döşemesi, otopark katı, inşaat iskelesi.
// Platformlar 'plat' etiketli düz üstlü KATI bloklardır; çıkış basamak/rampa; 1.0–1.3 m'lik alçaklara zombi sıçrar, 2.4 m ve üstüne yalnızca merdivenden.

export const NEWYORK_BOUNDS = { minX: -84, maxX: 84, minZ: -62, maxZ: 62 };
const NC = { collide: false };
const GL = { glow: true };
const ASPH = '#24262a', ASPH2 = '#1d1f23', WALK = '#4a4c50', CONC = '#6c7076', CONC_D = '#4f5358', TRIM = '#8a8c88';
const BRICKS = ['#7a4a3a', '#6a4338', '#8a5a44', '#5e3f35', '#74503f'];
const STONES = ['#8a8d90', '#777b80', '#9a9c98', '#6e7378', '#858a8e'];
const GLASSB = ['#3d5666', '#344a58', '#46606e', '#2f4552'];

const plat = (b, x0, z0, x1, z1, y0, h, color, o = {}) => b.box((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, h, z1 - z0, color, { tag: 'plat', ...o });
const pick = (r, a) => a[Math.floor(r() * a.length)];

function textPlane(text, w, h, { fg = '#e8e6df', bg = null, font = 'bold 120px sans-serif', drip = false, border = null, glow = false } = {}) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.max(64, Math.round(1024 * h / w));
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  if (border) { g.strokeStyle = border; g.lineWidth = 14; g.strokeRect(10, 10, c.width - 20, c.height - 20); }
  if (glow) { g.shadowColor = fg; g.shadowBlur = 38; }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = text.split('\n'), lh = c.height / (lines.length + 0.4);
  lines.forEach((ln, i) => g.fillText(ln, c.width / 2, lh * (i + 0.7), c.width - 30));
  if (drip) { g.shadowBlur = 0; g.fillStyle = fg; for (let i = 0; i < 26; i++) { const x = 40 + Math.random() * (c.width - 80), y = lh * (0.9 + Math.random() * lines.length * 0.8); g.fillRect(x, y, 6 + Math.random() * 6, 20 + Math.random() * 90); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
}

export function buildNewYork() {
  const b = new MapBuilder();
  b.autoPlace = false;
  const rng = makeRng(77);
  const roads = [], signs = [], perches = [];
  const perch = (x, z, y, r, cap = 4) => perches.push({ x, z, y, r, cap });
  const sign = (text, x, y, z, ry, w, h, o) => signs.push({ text, x, y, z, ry, w, h, o });
  const road = (x0, z0, x1, z1, color = ASPH) => { b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 0.04, z1 - z0, color, NC); roads.push({ x0, z0, x1, z1 }); };

  // ───────── zemin, yollar, kaldırımlar ─────────
  b.box(0, -1.0, 0, 1000, 1.0, 1000, '#16181b', NC);
  b.box(0, 0, 0, 172, 0.02, 128, '#2a2c2e', NC);
  road(-84, -9, 84, 9); road(-7, -62, 7, 62);                                           // Broadway (D-B) + 5. cadde (K-G)
  road(-48, -62, -36, 62, ASPH2); road(36, -62, 48, 62, ASPH2);                         // yan caddeler
  road(-84, -43, 84, -35, ASPH2); road(-84, 35, 84, 43, ASPH2);                         // arka servis yolları
  for (let x = -82; x < 82; x += 6) { if (Math.abs(x) > 8) b.box(x, 0.045, 0, 3.2, 0.01, 0.22, '#c8b24a', NC); }
  for (let z = -60; z < 60; z += 6) { if (Math.abs(z) > 10) b.box(0, 0.045, z, 0.22, 0.01, 3.2, '#c8b24a', NC); }
  for (let x = -80; x < 80; x += 5) { if (Math.abs(x) > 9) for (const z of [-3, 3]) b.box(x, 0.045, z, 2.4, 0.01, 0.12, '#cfcfc8', NC); }   // şerit ayırıcı kesik çizgiler
  for (let k = 0; k < 5; k++) for (const sgn of [-1, 1]) b.box(sgn * 0, 0.046, 0, 0.1, 0.01, 0.1, '#000', NC);
  for (let i = -3; i <= 3; i++) for (const sx of [-1, 1]) b.box(sx * 10.5, 0.05, i * 2.0, 3.2, 0.01, 0.8, '#d8d8d0', NC);   // yaya geçitleri (5. cadde)
  for (const sgn of [-1, 1]) { b.box(0, 0.0, sgn * 11, 168, 0.12, 4, WALK, NC); b.box(sgn * 11, 0.0, 0, 8, 0.12, 8, WALK, NC); }     // kaldırımlar
  // ıslak yol parlamaları, su birikintileri, rögar buharı
  for (let i = 0; i < 40; i++) {
    const x = (rng() - 0.5) * 160, z = (rng() - 0.5) * 118;
    b.box(x, 0.06, z, 1.5 + rng() * 4, 0.01, 1 + rng() * 2.6, '#0d1820', { collide: false, o: { roughness: 0.05, metalness: 0.7 } });
  }
  for (let i = 0; i < 16; i++) { const x = (rng() - 0.5) * 140, z = (rng() - 0.5) * 100; b.cyl(x, 0.02, z, 0.45, 0.45, 0.04, '#0c0d0f', { seg: 10, collide: false }); }   // rögar kapakları
  // ağır moloz serpintisi (çarpışmasız: çoğu), her yerde
  for (let i = 0; i < 260; i++) {
    const x = (rng() - 0.5) * 164, z = (rng() - 0.5) * 120;
    b.box(x, 0, z, 0.25 + rng() * 0.9, 0.08 + rng() * 0.3, 0.25 + rng() * 0.9, rng() < 0.45 ? CONC_D : rng() < 0.5 ? '#3a3a38' : '#5a463c', { collide: false, ry: rng() * 3 });
  }

  // ───────── bina üreticisi: yıkık gökdelen ─────────
  // faces: pencereli yüzler ('n' z0, 's' z1, 'w' x0, 'e' x1); ruin: tepe kırık-çatlak, patlak delikler
  const tower = (x0, z0, x1, z1, h, faces, o = {}) => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const col = o.color || pick(rng, o.brick ? BRICKS : STONES), trim = o.trim || TRIM;
    const body = o.ruin === false ? h : Math.max(8, h * (0.55 + rng() * 0.15));
    b.box(cx, 0, cz, w, body, d, col);
    if (body < h) {                                                              // kırık tepe: rastgele yükseklikte sütunlar
      const nx = Math.max(2, Math.round(w / 4.5)), nz = Math.max(2, Math.round(d / 4.5));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        if (rng() < 0.28) continue;
        const hh = (h - body) * (0.15 + rng() * 0.85);
        b.box(x0 + (i + 0.5) * w / nx, body, z0 + (j + 0.5) * d / nz, w / nx - 0.04, hh, d / nz - 0.04, col);
      }
      for (let k = 0; k < 4; k++) b.box(x0 + rng() * w, body + (h - body) * rng(), z0 + rng() * d, 0.14, 1.4 + rng() * 2.4, 0.14, '#2a2420', NC);     // sallanan donatı
    }
    b.box(cx, body - 0.35, cz, w + 0.5, 0.45, d + 0.5, trim, NC);                // saçak şeridi
    b.box(cx, 0.0, cz, w + 0.3, 0.7, d + 0.3, CONC_D, NC);                        // kaide
    for (const f of faces) {
      const along = f === 'n' || f === 's' ? w : d, base = f === 'n' ? z0 : f === 's' ? z1 : f === 'w' ? x0 : x1;
      const sg = f === 'n' || f === 'w' ? -1 : 1, mid = f === 'n' || f === 's' ? cx : cz;
      const put = (a, y, ww, hh, color, op) => (f === 'n' || f === 's' ? b.box(mid + a, y, base + sg * 0.05, ww, hh, 0.1, color, op) : b.box(base + sg * 0.05, y, mid + a, 0.1, hh, ww, color, op));
      const cols = Math.max(2, Math.floor((along - 1.4) / 2.7));
      // zemin kat vitrini (kırık cam, koyu) + tente
      for (let c = 0; c < cols; c++) {
        const a = (c - (cols - 1) / 2) * 2.7;
        put(a, 0.9, 2.0, 2.3, '#07090c', NC);
        if (rng() < 0.6) put(a, 3.15, 2.4, 0.3, pick(rng, ['#8a2a22', '#2a5a7a', '#2f6a44', '#7a5a22']), NC);        // tente
      }
      if (o.sign !== false && rng() < 0.7) sign(pick(rng, ['DELI', 'PIZZA', 'BAR', 'CAFE', '24H', 'HOTEL', 'DINER', 'BANK', 'PHARMACY', 'MARKET', 'SUBWAY', 'LIQUOR']), f === 'n' || f === 's' ? mid + (rng() - 0.5) * (along - 4) : base + sg * 0.12, 3.9, f === 'n' || f === 's' ? base + sg * 0.12 : mid + (rng() - 0.5) * (along - 4), f === 'n' ? 0 : f === 's' ? Math.PI : f === 'w' ? -Math.PI / 2 : Math.PI / 2, 2.8, 0.9, { fg: pick(rng, ['#ff4a8a', '#4af0ff', '#ffd23a', '#7aff5a', '#ff7a2a']), bg: '#0b0d12' });
      // üst katlar: pencere ızgarası
      for (let y = 4.4; y < body - 1.6; y += 3.1) {
        for (let c = 0; c < cols; c++) {
          const a = (c - (cols - 1) / 2) * 2.7, r = rng();
          if (r < 0.1) continue;                                                 // patlamış pencere: boşluk
          const lit = r > 0.9;
          put(a, y, 1.3, 1.9, lit ? pick(rng, ['#ffcf7a', '#ffb455', '#cfe9ff']) : '#0b1016', lit ? { collide: false, o: GL } : NC);
          if (!lit && rng() < 0.15) put(a, y - 0.1, 0.2, 2.1, '#14161a', NC);   // is izi şeridi
        }
      }
      // patlak delikler (+ içeride yangın)
      const holes = Math.floor(rng() * 2.4);
      for (let k = 0; k < holes && body > 14; k++) {
        const a = (rng() - 0.5) * (along - 5), y = 5 + rng() * (body - 12);
        put(a, y, 3.4, 3.6, '#050608', NC);
        if (rng() < 0.55) put(a, y + 0.2, 2.2, 1.2, '#ff7a2a', { collide: false, o: GL });
        put(a, y + 3.6, 3.0, 2.4, '#16181b', NC);                                // kurum
      }
    }
    return { cx, cz, body };
  };

  // yangın merdiveni (görsel): kat başına sahanlık + eğik basamak şeridi
  const fireEscape = (x, z, face, h) => {
    const horiz = face === 'n' || face === 's', sg = face === 'n' || face === 'w' ? -1 : 1;
    for (let y = 4.4; y < h; y += 3.1) {
      if (horiz) { b.box(x, y, z + sg * 0.9, 2.6, 0.08, 1.5, '#2d2f33', NC); b.box(x, y + 0.9, z + sg * 1.6, 2.6, 0.05, 0.05, '#2d2f33', NC); }
      else { b.box(x + sg * 0.9, y, z, 1.5, 0.08, 2.6, '#2d2f33', NC); b.box(x + sg * 1.6, y + 0.9, z, 0.05, 0.05, 2.6, '#2d2f33', NC); }
      const ang = 0.7;
      if (horiz) b.box(x + 1.0, y + 1.5, z + sg * 0.9, 0.12, 0.06, 3.4, '#2d2f33', { collide: false, rx: sg * ang });
      else b.box(x + sg * 0.9, y + 1.5, z + 1.0, 3.4, 0.06, 0.12, '#2d2f33', { collide: false, rz: -sg * ang });
    }
  };

  // ───────── GÜNEY SIRA (Broadway'in güneyi, z 13…31) ─────────
  tower(-84, 13, -66, 33, 38, ['n', 'e'], { brick: true }); tower(-66, 13, -50, 31, 30, ['n']);
  tower(-34, 13, -22, 19, 24, ['n', 'w'], { color: '#6e7378' });                         // B bloğu: yalnızca ön cephe kalmış (arkası çökmüş arsa)
  tower(-9, 13, -7.2, 31, 22, ['n'], { ruin: false, color: '#3a3d42' });                // 5. cadde kenarı ince duvar
  tower(7.2, 13, 20, 32, 40, ['n', 'w'], { brick: true }); tower(20, 13, 34, 30, 32, ['n']);
  tower(50, 13, 64, 33, 36, ['n', 'w'], { color: '#7a7e82' }); tower(64, 13, 84, 31, 46, ['n', 'w'], { brick: true });
  fireEscape(-72, 13, 'n', 30); fireEscape(12, 13, 'n', 32); fireEscape(57, 13, 'n', 30);
  // ───────── KUZEY SIRA (z −31…−13) ─────────
  tower(-84, -33, -64, -13, 40, ['s', 'e'], { color: '#707479' }); tower(-64, -31, -50, -13, 28, ['s'], { brick: true });
  tower(-34, -31, -20, -13, 36, ['s', 'w'], { brick: true }); tower(-20, -33, -9, -13, 48, ['s', 'e'], { color: '#5e656c' });
  tower(9, -33, 22, -13, 52, ['s', 'w'], { color: '#6a7076' }); tower(22, -31, 34, -13, 30, ['s'], { brick: true });
  tower(50, -31, 66, -13, 34, ['s', 'w'], { brick: true }); tower(66, -33, 84, -13, 42, ['s', 'w'], { color: '#767a7e' });
  fireEscape(-74, -13, 's', 34); fireEscape(-27, -13, 's', 30); fireEscape(28, -13, 's', 26); fireEscape(60, -13, 's', 28);
  // arka cephe devleri (sınır duvarı): arka servis yolunun ardı
  for (const sg of [-1, 1]) {
    for (let x = -84; x < 84; x += 21) tower(x, sg > 0 ? 53 : -62, x + 21, sg > 0 ? 62 : -53, 36 + rng() * 22, [sg > 0 ? 'n' : 's'], { brick: rng() < 0.5, sign: false });
  }
  // doğu-batı uç duvarları: cadde sonu devrik bina yığını
  tower(-84, -9, -78, 9, 12, [], { ruin: true, color: '#555a60' }); tower(78, -9, 84, 9, 12, [], { ruin: true, color: '#555a60' });
  // Broadway uçlarına devrik otobüs/barikat
  K.bus(b, { x: -76, z: 2.5, ry: 0.5, wreck: true }); K.bus(b, { x: 76, z: -3, ry: Math.PI - 0.4, wreck: true });

  // ───────── MERKEZ MEYDANI: anıt (1.4 m) ─────────
  plat(b, -5, -5, 5, 5, 0, 1.4, '#7c8085');
  for (const [dir, x, z] of [['+x', -7.25, 0], ['-x', 7.25, 0], ['+z', 0, -7.25], ['-z', 0, 7.25]]) b.stairs(x, z, 0, dir, 3.2, 5, 0.28, 0.45, '#8a8e92', { deco: false, tag: 'plat' });
  b.box(0, 1.4, 0, 1.8, 4.6, 1.8, '#5c6065'); b.box(0, 6.0, 0, 1.2, 1.8, 1.2, '#6a6e72', NC); b.box(0.5, 7.2, 0, 0.35, 1.7, 0.35, '#6a6e72', NC);     // heykel kaidesi + gövde + kol
  for (const [x, z] of [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]]) { b.box(x, 1.4, z, 0.7, 0.5, 0.7, '#6a6e72', NC); }
  perch(0, 0, 1.4, 4, 6);
  // devasa panolar (Times Square tarzı) çatılarda
  const bigBoard = (x, y, z, ry, w, h, text, fg, bg) => { b.box(x, y, z, w + 0.6, h + 0.6, 0.5, '#26282c', NC); sign(text, x - Math.sin(ry) * 0.3, y + h / 2 + 0.3, z - Math.cos(ry) * -0.3, ry, w, h, { fg, bg, glow: true, font: 'bold 170px sans-serif' }); };
  bigBoard(-27, 40, -12.6, 0, 16, 5, 'NEW YORK', '#ff3a6a', '#12040a'); bigBoard(15, 44, 12.6, Math.PI, 18, 5, 'HOTEL AMERICA', '#4af0ff', '#04121a');
  // ───────── yan caddelerin içi / çökmüş bina arsası (güney B: x −34…−7 arası boş arsa) ─────────
  // çökmüş kat döşemesi (4.0 m) – molozdan çıkılan rampa
  plat(b, -32, 20, -14, 30, 0, 4.0, '#585d62');
  b.stairs(-40, 25, 0, '+x', 4, 16, 0.25, 0.5, '#6a6e72', { deco: false, tag: 'plat' });
  for (let i = 0; i < 12; i++) b.box(-32 + rng() * 18, 4.0, 20 + rng() * 10, 0.08, 0.8 + rng() * 2.4, 0.08, '#4a3a30', NC);            // donatı çubukları
  b.box(-23, 4.0, 30.1, 18, 0.7, 0.2, '#2a2d30', NC);
  perch(-23, 25, 4.0, 7, 5);
  for (let i = 0; i < 28; i++) { const x = -34 + rng() * 26, z = 13 + rng() * 7; const s = 0.6 + rng() * 1.6; b.box(x, 0, z, s, s * (0.5 + rng() * 0.6), s * (0.6 + rng()), rng() < 0.5 ? CONC_D : '#5a463c', { ry: rng() * 3 }); }   // ön moloz dağı (siper)
  // ───────── kamyon kasası perch'leri (3.0 m) ─────────
  const truck = (cx, z, dirSgn, color) => {                                              // dirSgn: −1 kuzey şerit, +1 güney şerit
    plat(b, cx - 4.5, z - 1.3, cx + 4.5, z + 1.3, 0, 3.0, color);
    b.box(cx + 6.4, 0, z, 2.6, 2.2, 2.4, '#2f3338');                                     // kabin
    b.box(cx + 7.3, 1.3, z, 0.9, 0.7, 2.2, '#10141a', NC);                               // ön cam
    for (const wx of [cx - 3, cx - 0.5, cx + 6]) for (const sz of [-1, 1]) b.cyl(wx, 0.55, z + sz * 1.2, 0.55, 0.55, 0.35, '#0e0e10', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
    for (let i = 0; i < 6; i++) b.box(cx - 4 + i * 1.6, 0.3, z - dirSgn * 1.32, 0.12, 2.5, 0.05, '#20252a', NC);   // kasa panelleri
    b.stairs(cx - 2, z - dirSgn * 5.0, 0, dirSgn < 0 ? '-z' : '+z', 2.4, 10, 0.3, 0.37, '#7a7e82', { deco: false, tag: 'plat' });
    perch(cx, z, 3.0, 3.2, 3);
  };
  truck(-30, -3.6, -1, '#c9c9c4'); truck(24, 3.6, 1, '#a8322a');
  // ───────── metro girişi çatıları (2.4 m) ─────────
  const subway = (x, z, dir) => {
    plat(b, x, z, x + 3.6, z + 3.4, 0, 2.4, '#2f4a3a');
    b.stairs(dir > 0 ? x - 3.4 : x + 3.6 + 3.4, z + 1.7, 0, dir > 0 ? '+x' : '-x', 2.6, 8, 0.3, 0.425, '#7a7e82', { deco: false, tag: 'plat' });
    b.box(x + 1.8, 2.4, z + 1.7, 0.1, 1.6, 0.1, '#222', NC); b.box(x + 1.8, 3.8, z + 1.7, 0.6, 0.6, 0.6, '#3be06a', { collide: false, o: GL });
    sign('SUBWAY', x + 1.8, 2.0, z - 0.06, Math.PI, 2.8, 0.7, { fg: '#e8e8e4', bg: '#1f6a3a', font: 'bold 140px sans-serif' });
    perch(x + 1.8, z + 1.7, 2.4, 1.6, 2);
  };
  subway(19, 9.8, 1); subway(-23, -13.2, -1);
  // ───────── otopark (3.2 m) – kuzeybatı arkası ─────────
  plat(b, -80, -52, -56, -42, 0, 3.2, '#5a5e63');
  b.stairs(-68, -35, 0, '-z', 5, 14, 0.2286, 0.5, '#6a6e72', { deco: false, tag: 'plat' });
  b.box(-68, 3.2, -42.1, 24, 1.0, 0.25, '#44484d', NC); b.box(-80, 3.2, -47, 0.25, 1.0, 10, '#44484d', NC);
  b.with(0, 3.2, 0, 0, () => { for (const [x, z, ry] of [[-76, -48, 0.1], [-70, -50, -0.1], [-62, -46, 0.3]]) K.car(b, { x, z, ry, color: '#3a3f45', wreck: true }); });
  perch(-68, -47, 3.2, 8, 6);
  // ───────── inşaat iskelesi (5.0 m) – güneydoğu arkası ─────────
  plat(b, 62, 46, 72, 56, 0, 5.0, '#6a5c3a');
  b.stairs(53.6, 51, 0, '+x', 3.4, 20, 0.25, 0.42, '#7a7e82', { deco: false, tag: 'plat' });
  for (const [x, z] of [[62, 46], [72, 46], [62, 56], [72, 56]]) b.box(x, 5.0, z, 0.2, 1.1, 0.2, '#383b3e', NC);
  b.box(67, 5.0, 51, 1.2, 9, 1.2, '#c9a227', NC); b.box(67, 12.5, 51, 14, 0.5, 0.5, '#c9a227', NC);                             // vinç gövdesi + kolu
  perch(67, 51, 5.0, 4, 3);
  // ───────── kuzey-doğu: market arkası alçak çatı (3.0 m) ─────────
  plat(b, 52, -42, 66, -35.5, 0, 3.0, '#7a6a5a');
  b.stairs(47.8, -39, 0, '+x', 3, 12, 0.25, 0.35, '#7a7e82', { deco: false, tag: 'plat' });
  perch(59, -39, 3.0, 5, 4);

  // ───────── SİPER VE DOLGU: araçlar ─────────
  const taxi = (x, z, ry, wreck = false) => { K.car(b, { x, z, ry, color: '#e2b21f', wreck }); b.with(x, 0, z, ry, () => b.box(-0.1, 1.42, 0, 0.5, 0.2, 0.3, '#fff2a0', { collide: false, o: GL })); };
  const burn = (x, z) => { for (let i = 0; i < 4; i++) b.box(x + (rng() - 0.5) * 1.6, 1.0 + rng() * 0.6, z + (rng() - 0.5) * 0.9, 0.5 + rng() * 0.5, 0.5 + rng() * 0.7, 0.5, i % 2 ? '#ff7a2a' : '#ffd27a', { collide: false, o: GL }); b.box(x, 1.6, z, 1.4, 1.6, 1.0, '#15110f', { collide: false, o: { transparent: true, opacity: 0.45 } }); };
  const cars = [
    // Broadway şeritleri (D-B yönü) – yoğun trafik felç
    ['taxi', -64, -6.2, 0.1, true], ['car', -58, -2.5, -0.15, true, '#3a4048'], ['taxi', -52, 2.6, Math.PI - 0.2, true], ['car', -44, 6.0, 0.05, true, '#5a2a24'], ['taxi', -40, -5.5, 3.0, true],
    ['car', -18, -6.2, 0.2, true, '#2c3036'], ['taxi', -13, 4.2, -0.1, true], ['car', 12, -4.2, 3.2, true, '#4a4a4c'], ['taxi', 16, 6.4, 0.15, true], ['car', 38, -6.4, 0.0, true, '#3d3a34'], ['taxi', 44, 2.0, 3.0, true],
    ['car', 54, -2.4, -0.3, true, '#5a463c'], ['taxi', 62, 5.5, 0.2, true], ['car', 70, -5.6, Math.PI + 0.2, true, '#303a42'],
    // 5. cadde
    ['taxi', 2.6, -24, Math.PI / 2 + 0.1, true], ['car', -3.0, -38, Math.PI / 2 - 0.2, true, '#46403a'], ['taxi', 3.4, -50, Math.PI / 2, true], ['car', -2.6, 22, Math.PI / 2 + 0.15, true, '#2e3238'],
    ['taxi', 3.0, 34, -Math.PI / 2, true], ['car', -3.2, 48, Math.PI / 2 - 0.1, true, '#523a2e'],
    // yan caddeler
    ['car', -42, -20, Math.PI / 2, true, '#3a3f45'], ['taxi', -42, 24, Math.PI / 2 + 0.2, true], ['car', 42, -22, Math.PI / 2 - 0.1, true, '#4a443c'], ['taxi', 42, 20, Math.PI / 2, true],
    ['car', -42, 48, Math.PI / 2, true, '#2f343a'], ['car', 42, -48, Math.PI / 2 + 0.1, true, '#3d3a34'],
    // servis yolları
    ['taxi', -60, 39, 0.1, true], ['car', -30, 38.5, -0.1, true, '#3a4048'], ['car', 10, 40, 0.05, true, '#4a3d34'], ['taxi', 62, 38, 3.0, true],
    ['car', -56, -39, 0.0, true, '#2c3036'], ['taxi', -10, -38.5, 0.1, true], ['car', 20, -40, 3.1, true, '#46403a'], ['taxi', 70, -39, 0.15, true],
  ];
  for (const [kind, x, z, ry, wreck, color] of cars) { if (kind === 'taxi') taxi(x, z, ry, wreck); else K.car(b, { x, z, ry, color, wreck }); }
  burn(-52, 2.6); burn(12, -4.2); burn(-42, 24); burn(42, -22); burn(3.4, -50); burn(-60, 39); burn(20, -40);
  K.bus(b, { x: -24, z: 5.6, ry: 0.05, wreck: true }); K.bus(b, { x: 30, z: -5.8, ry: Math.PI - 0.05, wreck: true }); K.bus(b, { x: 42, z: 0, ry: Math.PI / 2 + 0.1, wreck: true });
  M.tank(b, { x: 8.5, z: 14.5, ry: 0.6, wreck: true }); M.apc(b, { x: -9.5, z: -15.5, ry: -2.4, wreck: true }); M.apc(b, { x: 45, z: 22, ry: 1.2, wreck: true });
  M.ambulance(b, { x: -30, z: 12, ry: 0.4, wreck: true }); M.jeep(b, { x: 40, z: -13.5, ry: 2.6, wreck: true });
  M.helicopter(b, { x: 22, z: 26, ry: 0.9 });                                            // düşmüş helikopter (güney B arsa karşısı)
  b.flushVehicles();
  // ───────── krater halkaları ─────────
  const crater = (x, z, r) => { b.cyl(x, 0.05, z, r, r, 0.06, '#0b0c0e', { seg: 14, collide: false }); b.cyl(x, 0.08, z, r * 0.55, r * 0.55, 0.06, '#050506', { seg: 12, collide: false });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28 + rng(), rr = r * (0.95 + rng() * 0.3); b.box(x + Math.cos(a) * rr, 0, z + Math.sin(a) * rr, 0.7 + rng() * 1.3, 0.35 + rng() * 0.7, 0.7 + rng() * 1.2, rng() < 0.5 ? CONC_D : '#4a3a30', { ry: rng() * 3 }); } };
  crater(32, 1.5, 3.6); crater(-42, 5, 3.2); crater(2, 36, 3.8); crater(-62, -2, 3.0); crater(54, 36, 3.4);
  // ───────── sokak mobilyası ─────────
  for (const [x, z] of [[-60, 10.5], [-40, 10.5], [-16, 10.5], [-30, -10.5], [18, -10.5], [34, 10.5], [58, -10.5], [-10.5, -24], [10.5, 24], [-10.5, 44], [10.5, -48], [-45, 36], [-45, -36], [45, 36], [45, -36]]) M.lampPost(b, x, z, { h: 6.2, pool: 4.6 });
  for (const [x, z] of [[-34, 10.8], [-2, 10.8], [26, 10.8], [-44, -10.8], [8, -10.8], [48, -10.8], [10.8, 8], [-10.8, -8], [10.8, -30], [-10.8, 30]]) { b.cyl(x, 0, z, 0.3, 0.3, 0.9, '#b52a22', { seg: 6 }); }   // hidrant
  for (const [x, z] of [[-26, 11], [4, 11], [-50, 11], [22, -11], [40, -11], [-6, -11], [60, 11]]) T.trashCan(b, x, z);
  for (const [x, z] of [[-18, 12], [-46, 12], [16, -12], [52, -12]]) { K.dumpster(b, x, z); }
  for (const [x, z] of [[-14, -11], [38, 11]]) T.busStop(b, { x, z, ry: x < 0 ? 0 : Math.PI });
  for (const [x, z, ry] of [[-56, 12, 0], [8, 12.4, 0], [30, -12.4, Math.PI]]) { b.with(x, 0, z, ry, () => { b.box(0, 0, 0, 1.6, 1.3, 1.0, '#c9a227'); b.box(0, 1.3, 0, 1.9, 0.12, 1.3, '#a02a22', NC); b.box(0, 0.4, 0.55, 1.2, 0.5, 0.06, '#e8e8e4', NC); }); }   // haber bayisi
  for (const [x, z] of [[-12, 8.5], [14, -8.5], [36, 7.5], [-38, -7.5], [60, 8], [-70, -8]]) { b.box(x, 0, z, 0.12, 4.0, 0.12, '#222', NC); b.box(x + 0.5, 3.6, z, 1.0, 0.1, 0.1, '#222', NC); b.box(x + 1.0, 3.0, z, 0.35, 1.0, 0.3, '#111', NC); b.box(x + 1.0, 3.6, z, 0.2, 0.2, 0.05, '#ff3a2a', { collide: false, o: GL }); }   // devrik/yanık trafik lambaları
  for (const [x, z, ry] of [[-30, -9, 0], [34, 9, Math.PI], [0, -40, Math.PI / 2], [-45, 8, 0], [47, -8, 0], [3, 30, Math.PI / 2], [-3, -30, Math.PI / 2]]) { K.barrier(b, x, z, ry); K.barrier(b, x + Math.cos(ry) * 2.9, z - Math.sin(ry) * 2.9, ry); }
  for (const [x, z, ry] of [[-8, -9.4, 0.1], [9, 9.2, 0], [-38, 0, Math.PI / 2], [38, 0, Math.PI / 2], [-60, 8, 0], [58, -8, 0], [0, -22, Math.PI / 2], [0, 26, Math.PI / 2]]) K.sandbags(b, x, z, 4, ry);
  for (const [x, z] of [[-33, -6.6], [34, -2], [26, -8], [-50, 4], [47, 3], [-2, -14], [2, 15], [14, 6.5], [-12, 8]]) { K.crate(b, x, z, 1.1); K.crate(b, x + 1.15, z + 0.3, 1.0); K.crate(b, x + 0.5, z + 0.1, 0.9, 1.1); if (rng() < 0.5) K.barrel(b, x - 1.0, z + 0.6); }
  for (const [x, z] of [[-70, 38], [-20, 41], [16, 39], [70, 40], [-70, -40], [-24, -40], [30, -41], [66, -38]]) { T.palletWall(b, rng, x, z, rng() * 3, 3); K.barrel(b, x + 2, z + 0.8, '#2c5aa0'); K.barrel(b, x + 2.8, z + 0.2); }
  M.fireBarrel(b, -66, 8); M.fireBarrel(b, -20, 4); M.fireBarrel(b, 4, -7); M.fireBarrel(b, 28, 7); M.fireBarrel(b, 56, 7); M.fireBarrel(b, -4, 24); M.fireBarrel(b, 5, -32); M.fireBarrel(b, 44, 28); M.fireBarrel(b, -44, -28); M.fireBarrel(b, 64, -40); M.fireBarrel(b, -56, 40); M.fireBarrel(b, 12, 38);
  // arka sokaklarda ek tahta çitler, kaçak barakalar
  for (const [x0, z0, x1, z1] of [[-82, 46, -56, 46], [-30, 46, -8, 46], [10, 46, 34, 46], [-82, -46, -62, -46], [-50, -46, -12, -46], [10, -46, 44, -46]]) K.fence(b, x0, z0, x1, z1, 1.4);
  // ───────── girilebilir dükkânlar (arka sokak) ─────────
  K.house(b, rng, { x: -56, z: 52, w: 12, d: 9, floors: 1, door: 'n', wall: '#8a8d90', roof: '#4a4e52', flat: true, theme: 'shop', glow: 0.35 });
  K.house(b, rng, { x: 24, z: 52, w: 12, d: 9, floors: 2, door: 'n', wall: '#7a5a4a', roof: '#4a4440', flat: true, theme: 'shop', glow: 0.35 });
  K.house(b, rng, { x: -34, z: -52, w: 12, d: 9, floors: 2, door: 's', wall: '#8a8d90', roof: '#4a4e52', flat: true, theme: 'office', glow: 0.35 });
  K.house(b, rng, { x: 28, z: -52, w: 12, d: 9, floors: 1, door: 's', wall: '#74503f', roof: '#4a4440', flat: true, theme: 'garage', glow: 0.3 });
  // ───────── uzak silüet: şehir ufku (çarpışmasız, boşluk hissini bitirir) ─────────
  for (let i = 0; i < 38; i++) {
    const side = i % 4, t = (i / 38) * 2 - 1;
    const x = side < 2 ? t * 170 : (side === 2 ? -1 : 1) * (96 + rng() * 40), z = side < 2 ? (side === 0 ? -1 : 1) * (80 + rng() * 40) : t * 120;
    const w = 8 + rng() * 14, h = 40 + rng() * 70;
    b.box(x, 0, z, w, h, w, '#10141a', NC);
    for (let k = 0; k < 14; k++) if (rng() < 0.6) b.box(x + (rng() - 0.5) * w * 0.8, 6 + rng() * (h - 10), z + (side < 2 ? (z > 0 ? -1 : 1) : 0) * (w / 2 + 0.05), 1.0, 1.4, 0.2, rng() < 0.5 ? '#ffcf7a' : '#7ab8ff', { collide: false, o: GL });
  }

  // ───────── doğuş ─────────
  const spawns = { blue: [], red: [] };
  for (let i = 0; i < 24; i++) spawns.blue.push({ x: -23 + (i % 6) * 2.6, z: -5 + Math.floor(i / 6) * 3.2, ry: -Math.PI / 2 });          // meydanın batısı: anıta ve kamyonlara yakın
  for (let i = 0; i < 24; i++) { const side = i % 2 ? 1 : -1; spawns.red.push({ x: side * 79, z: -6 + Math.floor(i / 2) * 1.0, ry: side > 0 ? Math.PI / 2 : -Math.PI / 2 }); }
  const objectives = [{ id: 'merkez', name: 'Merkez', core: true, x: 0, z: 0, r: 8 }];

  const group = b.build();
  if (typeof document !== 'undefined') {
    for (const s of signs) {
      const m = textPlane(s.text, s.w, s.h, { fg: '#e8e6df', font: 'bold 130px sans-serif', ...(s.o || {}), glow: s.o?.glow ?? true });
      m.position.set(s.x, s.y, s.z); m.rotation.y = s.ry; group.add(m);
    }
    const hosp = textPlane('NO\nSAFE\nPLACE', 6, 6, { fg: '#b3201a', font: 'bold 260px sans-serif', drip: true }); hosp.position.set(-9.12, 3.4, 22); hosp.rotation.y = Math.PI / 2; group.add(hosp);
    const g2 = textPlane('THEY ARE\nEVERYWHERE', 9, 4, { fg: '#c4281f', font: 'bold 200px sans-serif', drip: true }); g2.position.set(34.2, 3.2, -22); g2.rotation.y = Math.PI / 2; group.add(g2);
  }
  return {
    id: 'newyork',
    name: 'New York',
    group,
    colliders: b.colliders,
    bounds: NEWYORK_BOUNDS,
    baseZones: null,
    roads,
    spawns,
    objectives,
    perches,
    layered: true,
    forceTod: 'night',
  };
}
