import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import * as K from './kit.js';
import * as M from './kitMil.js';
import * as T from './kitTown.js';
import { CITY as KD, cityKindOfColor, makeCityMaterial, setCityHoles } from './citySurface.js';
import { cityFx } from './nyfx.js';

// "New York" — Enfekte moduna özel gece haritası: patlamış, harap Manhattan caddesi.
// Yapı: doğu-batı ana cadde (Broadway) + kuzey-güney 5. cadde meydanda kesişir (anıt, helikopter enkazı, yanık araçlar). İki yanda yıkık gökdelen blokları
// (dolu pencereler, patlak delikler, çatlak tepe, yangın merdivenleri), arkada sokaklar, çökmüş bina, otopark, inşaat, metro girişleri.
// İnsanlar YÜKSEK NOKTALARA (perches) çıkar: anıt, kamyon kasaları, metro girişi çatıları, çökmüş kat döşemesi, otopark katı, inşaat iskelesi.
// Platformlar 'plat' etiketli düz üstlü KATI bloklardır; çıkış basamak/rampa; 1.0–1.3 m'lik alçaklara zombi sıçrar, 2.4 m ve üstüne yalnızca merdivenden.

export const NEWYORK_BOUNDS = { minX: -84, maxX: 84, minZ: -62, maxZ: 62 };
const NC = { collide: false };
const GL = { glow: true };
// yüzey sınıfları (yalnız görsel gölgelendirici; çarpışma aynı): k(KD.X) çarpışmalı, nk(KD.X) çarpışmasız
const k = (kind, o = {}) => ({ ...o, kind }), nk = (kind, o = {}) => ({ collide: false, ...o, kind });
const ASPH = '#3a3d42', ASPH2 = '#33363b', WALK = '#4a4c50', CONC = '#6c7076', CONC_D = '#4f5358', TRIM = '#8a8c88';
const BRICKS = ['#7a4a3a', '#6a4338', '#8a5a44', '#5e3f35', '#74503f'];
const STONES = ['#8a8d90', '#777b80', '#9a9c98', '#6e7378', '#858a8e'];
const GLASSB = ['#3d5666', '#344a58', '#46606e', '#2f4552'];

const plat = (b, x0, z0, x1, z1, y0, h, color, o = {}) => b.box((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, h, z1 - z0, color, { tag: 'plat', ...o });
const pick = (r, a) => a[Math.floor(r() * a.length)];
const GLS = { collide: false, kind: 5 };              // pencere / vitrin camı (KD.GLASS)

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
  const roads = [], signs = [], perches = [], holeFires = [];
  const perch = (x, z, y, r, cap = 4) => perches.push({ x, z, y, r, cap });
  const sign = (text, x, y, z, ry, w, h, o) => signs.push({ text, x, y, z, ry, w, h, o });
  const road = (x0, z0, x1, z1, color = ASPH) => { b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 0.04, z1 - z0, color, nk(KD.ASPHALT)); roads.push({ x0, z0, x1, z1 }); };
  b.surface = { ground: () => 0, kindOf: cityKindOfColor, seeded: true, kindBits: 6, uv: true, material: makeCityMaterial };      // şehir yüzey gölgelendiricisi (asfalt / tuğla / cam …); uv: yüz boyutu + yüz içi konum
  const fxFires = [], fxLamps = [], holeList = [], holeFlames = [], awnings = [], manholes = [], neon = [];

  // ───────── zemin, yollar, kaldırımlar ─────────
  b.box(0, -1.0, 0, 1000, 1.0, 1000, '#16181b', nk(KD.ASPHALT));
  b.box(0, 0, 0, 172, 0.02, 128, '#3a3c40', nk(KD.ASPHALT));
  road(-84, -9, 84, 9); road(-7, -62, 7, 62);                                           // Broadway (D-B) + 5. cadde (K-G)
  road(-48, -62, -36, 62, ASPH2); road(36, -62, 48, 62, ASPH2);                         // yan caddeler
  road(-84, -43, 84, -35, ASPH2); road(-84, 35, 84, 43, ASPH2);                         // arka servis yolları
  const MK = nk(KD.MARK), SW = nk(KD.WALK);
  for (let x = -82; x < 82; x += 6) { if (Math.abs(x) > 8) b.box(x, 0.045, 0, 3.2, 0.01, 0.22, '#c8b24a', MK); }
  for (let z = -60; z < 60; z += 6) { if (Math.abs(z) > 10) b.box(0, 0.045, z, 0.22, 0.01, 3.2, '#c8b24a', MK); }
  for (let x = -80; x < 80; x += 5) { if (Math.abs(x) > 9) for (const z of [-3, 3]) b.box(x, 0.045, z, 2.4, 0.01, 0.12, '#cfcfc8', MK); }   // şerit ayırıcı kesik çizgiler
  for (let k = 0; k < 5; k++) for (const sgn of [-1, 1]) b.box(sgn * 0, 0.046, 0, 0.1, 0.01, 0.1, '#000', NC);
  for (let i = -3; i <= 3; i++) for (const sx of [-1, 1]) b.box(sx * 10.5, 0.05, i * 2.0, 3.2, 0.01, 0.8, '#d8d8d0', MK);   // yaya geçitleri (5. cadde)
  for (const sgn of [-1, 1]) { b.box(0, 0.0, sgn * 11, 168, 0.12, 4, WALK, SW); b.box(sgn * 11, 0.0, 0, 8, 0.12, 8, WALK, SW); }     // kaldırımlar
  // ıslak yol parlamaları, su birikintileri, rögar buharı
  for (let i = 0; i < 40; i++) {
    const x = (rng() - 0.5) * 160, z = (rng() - 0.5) * 118;
    b.box(x, 0.06, z, 1.5 + rng() * 4, 0.01, 1 + rng() * 2.6, '#0d1820', { collide: false, o: { roughness: 0.05, metalness: 0.7 } });
  }
  for (let i = 0; i < 16; i++) { const x = (rng() - 0.5) * 140, z = (rng() - 0.5) * 100; b.cyl(x, 0.02, z, 0.45, 0.45, 0.04, '#0c0d0f', { seg: 16, collide: false, kind: KD.MANHOLE }); manholes.push([x, z]); }   // rögar kapakları (desenli; bazılarından buhar)
  // ağır moloz serpintisi (çarpışmasız: çoğu), her yerde
  for (let i = 0; i < 260; i++) {
    const x = (rng() - 0.5) * 164, z = (rng() - 0.5) * 120;
    b.box(x, 0, z, 0.25 + rng() * 0.9, 0.08 + rng() * 0.3, 0.25 + rng() * 0.9, rng() < 0.45 ? CONC_D : rng() < 0.5 ? '#3a3a38' : '#5a463c', { collide: false, ry: rng() * 3, kind: KD.RUBBLE });
  }

  // ───────── bina üreticisi: yıkık gökdelen ─────────
  // faces: pencereli yüzler ('n' z0, 's' z1, 'w' x0, 'e' x1); ruin: tepe kırık-çatlak, patlak delikler
  const tower = (x0, z0, x1, z1, h, faces, o = {}) => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const col = o.color || pick(rng, o.brick ? BRICKS : STONES), trim = o.trim || TRIM;
    const TK = BRICKS.includes(col) ? KD.BRICK : KD.FACADE, TKR = TK === KD.BRICK ? KD.BRICK_R : KD.FACADE_R;    // cephe: tuğla örgü ya da beton panel; kırık tepe sütunu ayrı sınıf (pencere ızgarası yok)
    const body = o.ruin === false ? h : Math.max(8, h * (0.55 + rng() * 0.15));
    b.box(cx, 0, cz, w, body, d, col, k(TK));
    if (body < h) {                                                              // kırık tepe: rastgele yükseklikte sütunlar
      const nx = Math.max(2, Math.round(w / 4.5)), nz = Math.max(2, Math.round(d / 4.5));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        if (rng() < 0.28) continue;
        const hh = (h - body) * (0.15 + rng() * 0.85);
        b.box(x0 + (i + 0.5) * w / nx, body, z0 + (j + 0.5) * d / nz, w / nx - 0.04, hh, d / nz - 0.04, col, k(TKR));
      }
      for (let k = 0; k < 4; k++) b.box(x0 + rng() * w, body + (h - body) * rng(), z0 + rng() * d, 0.14, 1.4 + rng() * 2.4, 0.14, '#2a2420', nk(KD.IRON));     // sallanan donatı
    }
    b.box(cx, body - 0.35, cz, w + 0.5, 0.45, d + 0.5, trim, nk(KD.TRIM));                // saçak (kornis: diş sırası + oluk)
    b.box(cx, 0.0, cz, w + 0.3, 0.7, d + 0.3, CONC_D, nk(KD.PLINTH));                      // kaide (granit blok)
    for (const f of faces) {
      const along = f === 'n' || f === 's' ? w : d, base = f === 'n' ? z0 : f === 's' ? z1 : f === 'w' ? x0 : x1;
      const sg = f === 'n' || f === 'w' ? -1 : 1, mid = f === 'n' || f === 's' ? cx : cz;
      const put = (a, y, ww, hh, color, op) => (f === 'n' || f === 's' ? b.box(mid + a, y, base + sg * 0.05, ww, hh, 0.1, color, op) : b.box(base + sg * 0.05, y, mid + a, 0.1, hh, ww, color, op));
      const cols = Math.max(2, Math.floor((along - 1.4) / 2.7));
      // zemin kat vitrini (kırık cam, koyu) + tente
      for (let c = 0; c < cols; c++) {
        const a = (c - (cols - 1) / 2) * 2.7;
        put(a, 0.9, 2.0, 2.3, '#07090c', nk(KD.STORE));                                // vitrin: kepenk / kırık cam + dükkân içi / kontrplak (gölgelendirici)
        if (rng() < 0.6) awnings.push({ f, a, base, sg, mid, color: pick(rng, ['#8a2a22', '#2a5a7a', '#2f6a44', '#7a5a22']) });        // eğimli tente (sonra: altında çıkılabilir bir şey yoksa)
      }
      if (o.sign !== false && rng() < 0.7) sign(pick(rng, ['DELI', 'PIZZA', 'BAR', 'CAFE', '24H', 'HOTEL', 'DINER', 'BANK', 'PHARMACY', 'MARKET', 'SUBWAY', 'LIQUOR']), f === 'n' || f === 's' ? mid + (rng() - 0.5) * (along - 4) : base + sg * 0.12, 3.9, f === 'n' || f === 's' ? base + sg * 0.12 : mid + (rng() - 0.5) * (along - 4), f === 'n' ? 0 : f === 's' ? Math.PI : f === 'w' ? -Math.PI / 2 : Math.PI / 2, 2.8, 0.9, { fg: pick(rng, ['#ff4a8a', '#4af0ff', '#ffd23a', '#7aff5a', '#ff7a2a']), bg: '#0b0d12' });
      // üst katlar: pencere ızgarası
      for (let y = 4.4; y < body - 1.6; y += 3.1) {
        for (let c = 0; c < cols; c++) {
          const a = (c - (cols - 1) / 2) * 2.7, r = rng();
          if (r < 0.1) continue;                                                 // patlamış pencere: boşluk
          const lit = r > 0.9;
          put(a, y, 1.3, 1.9, lit ? pick(rng, ['#ffcf7a', '#ffb455', '#cfe9ff']) : '#0b1016', lit ? nk(KD.WINLIT) : GLS);   // ışıklı: oda-içi + perde / jaluzi / TV (gölgelendirici)
          if (!lit && rng() < 0.15) { /* eski yapışık "is izi şeridi" kaldırıldı: is artık cephe gölgelendiricisinde pencereden yükselen duman izi */ }
        }
      }
      // patlak delikler (+ içeride yangın)
      const holes = Math.floor(rng() * 2.4);
      for (let k = 0; k < holes && body > 14; k++) {
        const a = (rng() - 0.5) * (along - 5), y = 5 + rng() * (body - 12);
        const fire = rng() < 0.55;                                                       // delik artık yapışık siyah kutu değil: cephe gölgelendiricisinde düzensiz kenarlı yanık oda + is (uniform listesi)
        holeList.push(f === 'n' || f === 's' ? [mid + a, y + 1.8, base, fire ? 1 : 0] : [base, y + 1.8, mid + a, fire ? 1 : 0]);
        if (fire) { holeFires.push(f === 'n' || f === 's' ? [mid + a, y + 1.0, base + sg * 0.6] : [base + sg * 0.6, y + 1.0, mid + a]); for (const [da, dy, sz] of [[-0.85, 0.45, 0.6], [-0.3, 0.3, 1.05], [0.25, 0.4, 0.75], [0.8, 0.55, 0.5]]) holeFlames.push(f === 'n' || f === 's' ? [mid + a + da, y + dy, base + sg * 0.3, sz] : [base + sg * 0.3, y + dy, mid + a + da, sz]); }   // farklı boyda, iç içe alev dilleri
      }
    }
    return { cx, cz, body };
  };

  // yangın merdiveni (görsel): kat başına sahanlık + eğik basamak şeridi
  const fireEscape = (x, z, face, h) => b.withKind(KD.FIREESC, () => {
    const horiz = face === 'n' || face === 's', sg = face === 'n' || face === 'w' ? -1 : 1;
    for (let y = 4.4; y < h; y += 3.1) {
      if (horiz) { b.box(x, y, z + sg * 0.9, 2.6, 0.08, 1.5, '#2d2f33', NC); b.box(x, y + 0.9, z + sg * 1.6, 2.6, 0.05, 0.05, '#2d2f33', NC); }
      else { b.box(x + sg * 0.9, y, z, 1.5, 0.08, 2.6, '#2d2f33', NC); b.box(x + sg * 1.6, y + 0.9, z, 0.05, 0.05, 2.6, '#2d2f33', NC); }
      for (let t = -1.25; t <= 1.26; t += 0.3125) {                                          // korkuluk çubukları (sahanlıktan tırabzana) + yan korkuluk
        if (horiz) b.box(x + t, y + 0.08, z + sg * 1.6, 0.025, 0.82, 0.025, '#2d2f33', NC); else b.box(x + sg * 1.6, y + 0.08, z + t, 0.025, 0.82, 0.025, '#2d2f33', NC);
      }
      for (const e of [-1.28, 1.28]) { if (horiz) b.box(x + e, y + 0.9, z + sg * 0.875, 0.05, 0.05, 1.45, '#2d2f33', NC); else b.box(x + sg * 0.875, y + 0.9, z + e, 1.45, 0.05, 0.05, '#2d2f33', NC); }
      const ang = 0.7;
      if (horiz) b.box(x + 1.0, y + 1.5, z + sg * 0.9, 0.12, 0.06, 3.4, '#2d2f33', { collide: false, rx: sg * ang });
      else b.box(x + sg * 0.9, y + 1.5, z + 1.0, 3.4, 0.06, 0.12, '#2d2f33', { collide: false, rz: -sg * ang });
    }
  });

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
  tower(-84, -13, -76, 13, 50, ['e'], { color: '#5a6066' }); tower(76, -13, 84, 13, 50, ['w'], { color: '#5a6066' });                  // Broadway uç kapakları (cadde bina duvarıyla biter)
  for (const sg of [-1, 1]) {                                                                                                           // doğu-batı kenarlar: kesintisiz bina duvarı (harita sonu görünmez)
    for (const [z0, z1] of [[-53, -33], [33, 53]]) { tower(-84, z0, -76, z1, 44 + rng() * 14, ['e'], { brick: rng() < 0.5 }); tower(76, z0, 84, z1, 44 + rng() * 14, ['w'], { brick: rng() < 0.5 }); }
    break;
  }
  // Broadway uçlarına devrik otobüs/barikat
  b.withKind(KD.WRECK, () => { K.bus(b, { x: -70, z: 2.5, ry: 0.5, wreck: true }); K.bus(b, { x: 70, z: -3, ry: Math.PI - 0.4, wreck: true }); });

  // ───────── MERKEZ MEYDANI: anıt (1.4 m) ─────────
  b.withKind(KD.RUBBLE, () => {
  plat(b, -5, -5, 5, 5, 0, 1.4, '#7c8085');
  for (const [dir, x, z] of [['+x', -7.25, 0], ['-x', 7.25, 0], ['+z', 0, -7.25], ['-z', 0, 7.25]]) b.stairs(x, z, 0, dir, 3.2, 5, 0.28, 0.45, '#8a8e92', { deco: false, tag: 'plat' });
  b.box(0, 1.4, 0, 1.8, 4.6, 1.8, '#5c6065'); b.box(0, 6.0, 0, 1.2, 1.8, 1.2, '#6a6e72', nk(KD.IRON)); b.box(0.5, 7.2, 0, 0.35, 1.7, 0.35, '#6a6e72', nk(KD.IRON));     // heykel kaidesi + gövde + kol
  for (const [x, z] of [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]]) { b.box(x, 1.4, z, 0.7, 0.5, 0.7, '#6a6e72', NC); }
  });
  perch(0, 0, 1.4, 4, 6);
  // devasa panolar (Times Square tarzı) çatılarda
  const bigBoard = (x, y, z, ry, w, h, text, fg, bg) => { b.box(x, y, z, w + 0.6, h + 0.6, 0.5, '#26282c', nk(KD.IRON)); sign(text, x - Math.sin(ry) * 0.3, y + h / 2 + 0.3, z - Math.cos(ry) * -0.3, ry, w, h, { fg, bg, glow: true, font: 'bold 170px sans-serif' }); };
  bigBoard(-27, 40, -12.6, 0, 16, 5, 'NEW YORK', '#ff3a6a', '#12040a'); bigBoard(15, 44, 12.6, Math.PI, 18, 5, 'HOTEL AMERICA', '#4af0ff', '#04121a');
  // ───────── yan caddelerin içi / çökmüş bina arsası (güney B: x −34…−7 arası boş arsa) ─────────
  // çökmüş kat döşemesi (4.0 m) – molozdan çıkılan rampa
  b.withKind(KD.RUBBLE, () => { plat(b, -32, 20, -14, 30, 0, 4.0, '#585d62'); b.stairs(-40, 25, 0, '+x', 4, 16, 0.25, 0.5, '#6a6e72', { deco: false, tag: 'plat' }); });
  for (let i = 0; i < 12; i++) b.box(-32 + rng() * 18, 4.0, 20 + rng() * 10, 0.08, 0.8 + rng() * 2.4, 0.08, '#4a3a30', nk(KD.IRON));            // donatı çubukları
  b.box(-23, 4.0, 30.1, 18, 0.7, 0.2, '#2a2d30', nk(KD.CONC));
  perch(-23, 25, 4.0, 7, 5);
  for (let i = 0; i < 28; i++) { const x = -34 + rng() * 26, z = 13 + rng() * 7; const s = 0.6 + rng() * 1.6; b.box(x, 0, z, s, s * (0.5 + rng() * 0.6), s * (0.6 + rng()), rng() < 0.5 ? CONC_D : '#5a463c', { ry: rng() * 3, kind: KD.RUBBLE }); }   // ön moloz dağı (siper)
  // ───────── kamyon kasası perch'leri (3.0 m) ─────────
  const truck = (cx, z, dirSgn, color) => {                                              // dirSgn: −1 kuzey şerit, +1 güney şerit
    plat(b, cx - 4.5, z - 1.3, cx + 4.5, z + 1.3, 0, 3.0, color, { kind: KD.PAINT });
    b.box(cx + 6.4, 0, z, 2.6, 2.2, 2.4, '#2f3338', k(KD.WRECK));                                     // kabin
    b.box(cx + 7.3, 1.3, z, 0.9, 0.7, 2.2, '#10141a', GLS);                               // ön cam
    for (const wx of [cx - 3, cx - 0.5, cx + 6]) for (const sz of [-1, 1]) b.cyl(wx, 0.55, z + sz * 1.2, 0.55, 0.55, 0.35, '#0e0e10', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
    for (let i = 0; i < 6; i++) b.box(cx - 4 + i * 1.6, 0.3, z - dirSgn * 1.32, 0.12, 2.5, 0.05, '#20252a', nk(KD.PAINT));   // kasa panelleri
    b.withKind(KD.IRON, () => b.stairs(cx - 2, z - dirSgn * 5.0, 0, dirSgn < 0 ? '-z' : '+z', 2.4, 10, 0.3, 0.37, '#7a7e82', { deco: false, tag: 'plat' }));
    perch(cx, z, 3.0, 3.2, 3);
  };
  truck(-30, -3.6, -1, '#c9c9c4'); truck(24, 3.6, 1, '#a8322a');
  // ───────── metro girişi çatıları (2.4 m) ─────────
  const subway = (x, z, dir) => {
    plat(b, x, z, x + 3.6, z + 3.4, 0, 2.4, '#2f4a3a', { kind: KD.PAINT });
    b.withKind(KD.CONC, () => b.stairs(dir > 0 ? x - 3.4 : x + 3.6 + 3.4, z + 1.7, 0, dir > 0 ? '+x' : '-x', 2.6, 8, 0.3, 0.425, '#7a7e82', { deco: false, tag: 'plat' }));
    b.box(x + 1.8, 2.4, z + 1.7, 0.1, 1.6, 0.1, '#222', NC); b.box(x + 1.8, 3.8, z + 1.7, 0.6, 0.6, 0.6, '#3be06a', { collide: false, o: GL });
    sign('SUBWAY', x + 1.8, 2.0, z - 0.06, Math.PI, 2.8, 0.7, { fg: '#e8e8e4', bg: '#1f6a3a', font: 'bold 140px sans-serif' });
    perch(x + 1.8, z + 1.7, 2.4, 1.6, 2);
  };
  subway(19, 9.8, 1); subway(-23, -13.2, -1);
  // ───────── otopark (3.2 m) – kuzeybatı arkası ─────────
  b.withKind(KD.RUBBLE, () => {
  plat(b, -74, -52, -56, -42, 0, 3.2, '#5a5e63');
  b.stairs(-65, -35, 0, '-z', 5, 14, 0.2286, 0.5, '#6a6e72', { deco: false, tag: 'plat' });
  b.box(-65, 3.2, -42.1, 18, 1.0, 0.25, '#44484d', NC); b.box(-74, 3.2, -47, 0.25, 1.0, 10, '#44484d', NC);
  });
  b.with(0, 3.2, 0, 0, () => { for (const [x, z, ry] of [[-71, -48, 0.1], [-66, -50, -0.1], [-60, -46, 0.3]]) b.withKind(KD.WRECK, () => K.car(b, { x, z, ry, color: '#3a3f45', wreck: true })); });
  perch(-65, -47, 3.2, 7, 6);
  // ───────── inşaat iskelesi (5.0 m) – güneydoğu arkası ─────────
  plat(b, 62, 44, 72, 52, 0, 5.0, '#6a5c3a', { kind: KD.WOOD });
  b.withKind(KD.IRON, () => {
  b.stairs(53.6, 48, 0, '+x', 3.4, 20, 0.25, 0.42, '#7a7e82', { deco: false, tag: 'plat' });
  for (const [x, z] of [[62, 44], [72, 44], [62, 52], [72, 52]]) b.box(x, 5.0, z, 0.2, 1.1, 0.2, '#383b3e', NC);
  });
  b.box(67, 5.0, 48, 1.2, 9, 1.2, '#c9a227', nk(KD.PAINT)); b.box(67, 12.5, 48, 14, 0.5, 0.5, '#c9a227', nk(KD.PAINT));                             // vinç gövdesi + kolu
  perch(67, 48, 5.0, 4, 3);
  // ───────── kuzey-doğu: market arkası alçak çatı (3.0 m) ─────────
  plat(b, 52, -42, 66, -35.5, 0, 3.0, '#7a6a5a', { kind: KD.CONC });
  b.withKind(KD.IRON, () => b.stairs(47.8, -39, 0, '+x', 3, 12, 0.25, 0.35, '#7a7e82', { deco: false, tag: 'plat' }));
  perch(59, -39, 3.0, 5, 4);

  // ───────── SİPER VE DOLGU: araçlar ─────────
  const taxi = (x, z, ry, wreck = false) => { b.withKind(KD.WRECK, () => K.car(b, { x, z, ry, color: '#e2b21f', wreck })); b.with(x, 0, z, ry, () => b.box(-0.1, 1.42, 0, 0.5, 0.2, 0.3, '#fff2a0', { collide: false, o: GL })); };
  // yanan araç: alevler (ışıyan) + efekt kaydı (ışık, hale, duman, kıvılcım). Eski yarı saydam "duman kutusu" kaldırıldı (görseldi, çarpışmasız; yerine duman parçacıkları)
  const burn = (x, z) => { for (let i = 0; i < 4; i++) b.box(x + (rng() - 0.5) * 1.6, 1.0 + rng() * 0.6, z + (rng() - 0.5) * 0.9, 0.5 + rng() * 0.5, 0.5 + rng() * 0.7, 0.5, i % 2 ? '#ff7a2a' : '#ffd27a', { collide: false, o: GL }); fxFires.push({ x, y: 1.5, z, s: 1.6 }); };
  const cars = [
    // Broadway şeritleri (D-B yönü) – yoğun trafik felç
    ['taxi', -64, -6.2, 0.1, true], ['car', -58, -2.5, -0.15, true, '#3a4048'], ['taxi', -52, 2.6, Math.PI - 0.2, true], ['car', -44, 6.0, 0.05, true, '#5a2a24'], ['taxi', -40, -5.5, 3.0, true],
    ['car', -18, -6.2, 0.2, true, '#2c3036'], ['taxi', -13, 4.2, -0.1, true], ['car', 12, -4.2, 3.2, true, '#4a4a4c'], ['taxi', 16, 6.4, 0.15, true], ['car', 38, -6.4, 0.0, true, '#3d3a34'], ['taxi', 44, 2.0, 3.0, true],
    ['car', 54, -2.4, -0.3, true, '#5a463c'], ['taxi', 62, 5.5, 0.2, true], ['car', 70, -5.6, Math.PI + 0.2, true, '#303a42'],
    // 5. cadde
    ['taxi', 2.6, -24, Math.PI / 2 + 0.1, true], ['car', -3.0, -38, Math.PI / 2 - 0.2, true, '#46403a'], ['taxi', 3.4, -50, Math.PI / 2, true], ['car', -2.6, 22, Math.PI / 2 + 0.15, true, '#2e3238'],
    ['taxi', 3.0, 34, -Math.PI / 2, true], ['car', -2.8, 40.2, Math.PI / 2 - 0.1, true, '#523a2e'],      // 12.200: eskiden (−3,2, 48) parktaki çeşmenin içindeydi
    // yan caddeler
    ['car', -42, -20, Math.PI / 2, true, '#3a3f45'], ['taxi', -42, 24, Math.PI / 2 + 0.2, true], ['car', 42, -22, Math.PI / 2 - 0.1, true, '#4a443c'], ['taxi', 42, 20, Math.PI / 2, true],
    ['car', -42, 48, Math.PI / 2, true, '#2f343a'], ['car', 42, -48, Math.PI / 2 + 0.1, true, '#3d3a34'],
    // servis yolları
    ['taxi', -60, 39, 0.1, true], ['car', -30, 38.5, -0.1, true, '#3a4048'], ['car', 10, 40, 0.05, true, '#4a3d34'], ['taxi', 62, 38, 3.0, true],
    ['car', -56, -39, 0.0, true, '#2c3036'], ['taxi', -10, -38.5, 0.1, true], ['car', 20, -40, 3.1, true, '#46403a'], ['taxi', 70, -39, 0.15, true],
  ];
  for (const [kind, x, z, ry, wreck, color] of cars) { if (kind === 'taxi') taxi(x, z, ry, wreck); else b.withKind(KD.WRECK, () => K.car(b, { x, z, ry, color, wreck })); }
  burn(-52, 2.6); burn(12, -4.2); burn(-42, 24); burn(42, -22); burn(3.4, -50); burn(-60, 39); burn(20, -40);
  b.withKind(KD.WRECK, () => {
  K.bus(b, { x: -24, z: 5.6, ry: 0.05, wreck: true }); K.bus(b, { x: 30, z: -5.8, ry: Math.PI - 0.05, wreck: true }); K.bus(b, { x: 42, z: 0, ry: Math.PI / 2 + 0.1, wreck: true });
  M.tank(b, { x: 8.5, z: 14.5, ry: 0.6, wreck: true }); M.apc(b, { x: -9.5, z: -15.5, ry: -2.4, wreck: true }); M.apc(b, { x: 45, z: 22, ry: 1.2, wreck: true });
  M.ambulance(b, { x: -30, z: 10.3, ry: 0.4, wreck: true }); M.jeep(b, { x: 40, z: -13.5, ry: 2.6, wreck: true });      // 12.200 ambulans: z 12'de arka köşesi binanın cephesine giriyordu
  M.helicopter(b, { x: 22, z: 26, ry: 0.9 });                                            // düşmüş helikopter (güney B arsa karşısı)
  });
  b.flushVehicles();
  // ───────── Broadway'i bölen engeller: görüş hatlarını kırar (uzaktan nişan yok, doğar doğmaz ateş yok) ─────────
  const rubbleWall = (x, z0, z1, h = 3.0) => { for (let z = z0; z < z1; z += 2.1) { const hh = h * (0.75 + rng() * 0.4), w = 2.4 + rng() * 1.6; b.box(x + (rng() - 0.5) * 1.2, 0, z + 1, w, hh, 2.4, rng() < 0.5 ? CONC_D : '#5a463c', { ry: (rng() - 0.5) * 0.4, kind: KD.RUBBLE }); if (rng() < 0.6) b.box(x + (rng() - 0.5) * 1.5, hh, z + 1, 1.4, 0.8, 1.4, '#4a4036', { ry: rng() * 3, kind: KD.RUBBLE }); } };
  rubbleWall(-62, -9, -2); rubbleWall(-48, 2, 9); rubbleWall(18, -9, -2); rubbleWall(38, 2, 9); rubbleWall(66, -9, -2);
  rubbleWall(0 + 3.5, 20, 27); rubbleWall(-3.5, -30, -23); rubbleWall(3.5, 40, 47); rubbleWall(-3.5, -52, -46);                      // 5. cadde kırılımları
  // başlangıç karakolu (insan doğma alanı): hesco duvarları, kum torbaları, çadır, lambalar
  b.withKind(KD.RUBBLE, () => {
  M.hesco(b, -27, -6.5, 5, Math.PI / 2); M.hesco(b, -27, 4.5, 5, Math.PI / 2); M.hesco(b, -11.5, -8, 5, 0); M.hesco(b, -11.5, 8, 5, 0);
  for (const [x, z] of [[-26, -2], [-26, 1.5], [-12, -6], [-12, 6]]) K.sandbags(b, x, z, 3, Math.PI / 2);
  });
  M.floodLight(b, -26, 3, -8, 0); M.floodLight(b, -26, 3, 8, 0);
  const crate = (...a) => b.withKind(KD.WOOD, () => K.crate(b, ...a));                      // sandıklar ahşap tahta deseninde (sıra / çarpışma aynı)
  crate(-24, -7.5, 1.2); crate(-22.8, -7.7, 1.0); K.barrel(b, -21, -7.6); crate(-24, 7.6, 1.2); crate(-22.6, 7.8, 1.0); K.barrel(b, -21.2, 7.7, '#2c5aa0');
  // park (arka güney): ölü ağaçlar, bankalar, çeşme
  b.box(-6, 0, 48, 42, 0.05, 9.6, '#3b3a2c', nk(KD.GRASS));                                 // park zemini: kuru çim + toprak, kenarı taş bordür (yalnız görsel, ince)
  T.fountain(b, { x: -4, z: 48, r: 3 });
  for (let i = 0; i < 12; i++) { const x = -26 + rng() * 40, z = 44 + rng() * 8; if (Math.hypot(x + 4, z - 48) < 5) continue; b.cyl(x, 0, z, 0.18, 0.28, 3.5 + rng() * 2.2, '#2f2a26', { seg: 6 }); for (let k = 0; k < 4; k++) b.box(x + (rng() - 0.5) * 1.6, 3.2 + rng() * 2.2, z + (rng() - 0.5) * 1.6, 0.12, 1.2 + rng(), 0.12, '#2f2a26', { collide: false, rz: (rng() - 0.5) * 1.2 }); }
  for (const [x, z, ry] of [[-14, 45, 0], [6, 51, Math.PI], [-20, 51, Math.PI], [12, 45, 0]]) K.bench(b, x, z, ry);
  K.lamp(b, -10, 44); K.lamp(b, 4, 52);
  // kilise (arka kuzey) ve benzinlik (arka güneydoğu)
  K.church(b, rng, { x: -8, z: -47, w: 10, d: 14, ry: Math.PI / 2 });
  K.gasStation(b, rng, { x: 46, z: 48, store: 'n' });
  // ───────── krater halkaları ─────────
  const craters = [];
  const crater = (x, z, r) => { craters.push([x, z, r]); b.cyl(x, 0.05, z, r, r, 0.06, '#0b0c0e', { seg: 14, collide: false, kind: KD.RUBBLE }); b.cyl(x, 0.08, z, r * 0.55, r * 0.55, 0.06, '#050506', { seg: 12, collide: false, kind: KD.PLAIN });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28 + rng(), rr = r * (0.95 + rng() * 0.3); b.box(x + Math.cos(a) * rr, 0, z + Math.sin(a) * rr, 0.7 + rng() * 1.3, 0.35 + rng() * 0.7, 0.7 + rng() * 1.2, rng() < 0.5 ? CONC_D : '#4a3a30', { ry: rng() * 3, kind: KD.RUBBLE }); } };
  crater(32, 1.5, 3.6); crater(-42, 5, 3.2); crater(2, 36, 3.8); crater(-62, -2, 3.0); crater(54, 36, 3.4);
  // ───────── sokak mobilyası ─────────
  for (const [li, [x, z]] of [[-60, 10.5], [-40, 10.5], [-16, 10.5], [-30, -10.5], [18, -10.5], [34, 10.5], [58, -10.5], [-10.5, -24], [10.5, 24], [-10.5, 44], [10.5, -48], [-45, 36], [-45, -36], [45, 36], [45, -36]].entries()) {       // her 3. lamba kırık (sönük); yananın ışık lekesi efekt katmanında (yumuşak)
    const broken = li % 3 === 1;
    M.lampPost(b, x, z, { h: 6.2, pool: 0, broken });
    if (!broken) fxLamps.push({ x: x + 1.1, y: 5.85, z, cone: true });
  }
  for (const [x, z] of [[-34, 10.8], [-2, 10.8], [26, 10.8], [-44, -10.8], [8, -10.8], [48, -10.8], [10.8, 8], [-10.8, -8], [10.8, -30], [-10.8, 30]]) { b.cyl(x, 0, z, 0.3, 0.3, 0.9, '#b52a22', { seg: 6 }); }   // hidrant
  for (const [x, z] of [[-26, 11], [4, 11], [-50, 11], [22, -11], [40, -11], [-6, -11], [60, 11]]) T.trashCan(b, x, z);
  for (const [x, z] of [[-18, 12], [-46, 12], [16, -12], [52, -12]]) { K.dumpster(b, x, z); }
  for (const [x, z] of [[-14, -11], [38, 11]]) T.busStop(b, { x, z, ry: x < 0 ? 0 : Math.PI });
  for (const [x, z, ry] of [[-56, 12, 0], [8, 12.4, 0], [30, -12.4, Math.PI]]) { b.with(x, 0, z, ry, () => { b.box(0, 0, 0, 1.6, 1.3, 1.0, '#c9a227'); b.box(0, 1.3, 0, 1.9, 0.12, 1.3, '#a02a22', NC); b.box(0, 0.4, 0.55, 1.2, 0.5, 0.06, '#e8e8e4', NC); }); }   // haber bayisi
  for (const [x, z] of [[-12, 8.5], [14, -8.5], [36, 7.5], [-38, -7.5], [60, 8], [-70, -8]]) { b.box(x, 0, z, 0.12, 4.0, 0.12, '#222', NC); b.box(x + 0.5, 3.6, z, 1.0, 0.1, 0.1, '#222', NC); b.box(x + 1.0, 3.0, z, 0.35, 1.0, 0.3, '#111', NC); b.box(x + 1.0, 3.6, z, 0.2, 0.2, 0.05, '#ff3a2a', { collide: false, o: GL }); }   // devrik/yanık trafik lambaları
  for (const [x, z, ry] of [[-30, -9, 0], [34, 9, Math.PI], [0, -40, Math.PI / 2], [-45, 8, 0], [47, -8, 0], [3, 30, Math.PI / 2], [-3, -30, Math.PI / 2]]) { K.barrier(b, x, z, ry); K.barrier(b, x + Math.cos(ry) * 2.9, z - Math.sin(ry) * 2.9, ry); }
  for (const [x, z, ry] of [[-8, -9.4, 0.1], [9, 9.2, 0], [-38, 0, Math.PI / 2], [38, 0, Math.PI / 2], [-60, 8, 0], [58, -8, 0], [0, -22, Math.PI / 2], [0, 26, Math.PI / 2]]) K.sandbags(b, x, z, 4, ry);
  for (const [x, z] of [[-33, -6.6], [34, -2], [26, -8], [-50, 4], [47, 3], [-2, -14], [2, 15], [14, 6.5], [-12, 8]]) { crate(x, z, 1.1); crate(x + 1.15, z + 0.3, 1.0); crate(x + 0.5, z + 0.1, 0.9, 1.1); if (rng() < 0.5) K.barrel(b, x - 1.0, z + 0.6); }
  for (const [x, z] of [[-70, 38], [-20, 41], [16, 39], [70, 40], [-70, -40], [-24, -40], [30, -41], [66, -38]]) { T.palletWall(b, rng, x, z, rng() * 3, 3); K.barrel(b, x + 2, z + 0.8, '#2c5aa0'); K.barrel(b, x + 2.8, z + 0.2); }
  M.fireBarrel(b, -66, 8); M.fireBarrel(b, -20, 4); M.fireBarrel(b, 4, -7); M.fireBarrel(b, 28, 7); M.fireBarrel(b, 56, 7); M.fireBarrel(b, -4, 24); M.fireBarrel(b, 5, -32); M.fireBarrel(b, 44, 28); M.fireBarrel(b, -44, -28); M.fireBarrel(b, 64, -40); M.fireBarrel(b, -56, 40); M.fireBarrel(b, 12, 38);
  const fxBarrels = [[-66, 8], [-20, 4], [4, -7], [28, 7], [56, 7], [-4, 24], [5, -32], [44, 28], [-44, -28], [64, -40], [-56, 40], [12, 38]];
  // arka sokaklarda ek tahta çitler, kaçak barakalar
  // ───────── girilebilir dükkânlar (arka sokak) ─────────
  K.house(b, rng, { x: -56, z: 48, w: 12, d: 9, floors: 1, door: 'n', wall: '#8a8d90', roof: '#4a4e52', flat: true, theme: 'shop', glow: 0.35 });
  K.house(b, rng, { x: 24, z: 48, w: 12, d: 9, floors: 2, door: 'n', wall: '#7a5a4a', roof: '#4a4440', flat: true, theme: 'shop', glow: 0.35 });
  K.house(b, rng, { x: -34, z: -48, w: 12, d: 9, floors: 2, door: 's', wall: '#8a8d90', roof: '#4a4e52', flat: true, theme: 'office', glow: 0.35 });
  K.house(b, rng, { x: 28, z: -48, w: 12, d: 9, floors: 1, door: 's', wall: '#74503f', roof: '#4a4440', flat: true, theme: 'garage', glow: 0.3 });
  // ───────── uzak silüet: şehir ufku (çarpışmasız, boşluk hissini bitirir) ─────────
  for (let i = 0; i < 38; i++) {
    const side = i % 4, t = (i / 38) * 2 - 1;
    const x = side < 2 ? t * 170 : (side === 2 ? -1 : 1) * (96 + rng() * 40), z = side < 2 ? (side === 0 ? -1 : 1) * (80 + rng() * 40) : t * 120;
    const w = 8 + rng() * 14, h = 40 + rng() * 70;
    b.box(x, 0, z, w, h, w, '#10141a', nk(KD.SKY));                                        // silüet: kat kat ışıklı pencere ızgarası gölgelendiricide
    for (let k = 0; k < 14; k++) if (rng() < 0.6) { rng(); rng(); rng(); }                    // eski tek tük ışıklı kutular kaldırıldı (rastgele sayı sırası korunur)
  }

  // ───────── doğuş ─────────
  const spawns = { blue: [], red: [] };
  for (let i = 0; i < 24; i++) spawns.blue.push({ x: -23 + (i % 6) * 2.6, z: -5 + Math.floor(i / 6) * 3.2, ry: -Math.PI / 2 });          // meydanın batısı: anıta ve kamyonlara yakın
  for (let i = 0; i < 24; i++) { if (i % 2) spawns.red.push({ x: 58 + (i >> 1) % 7 * 3, z: -50 + ((i >> 1) / 7 | 0) * 3, ry: Math.PI }); else spawns.red.push({ x: -80 + (i >> 1) % 6 * 2.4, z: 44 + ((i >> 1) / 6 | 0) * 3, ry: 0 }); }     // bosslar arka arsalardan (insanların görüşünün dışında) başlar
  // 12.185 doğuş ızgarası karakoldaki araç enkazına (x −24…−21,4, z 4,2…6,9) giriyordu: asker arabanın İÇİNDE doğuyordu. Gövdesi (R 0,32 + pay) bir katıya değen nokta atılır.
  const solidNear = (p) => b.colliders.some((c) => c.max[1] > 0.3 && c.min[1] < 1.8 && p.x > c.min[0] - 0.45 && p.x < c.max[0] + 0.45 && p.z > c.min[2] - 0.45 && p.z < c.max[2] + 0.45);
  for (const t of ['blue', 'red']) spawns[t] = spawns[t].filter((p) => !solidNear(p));
  const objectives = [{ id: 'merkez', name: 'Merkez', core: true, x: 0, z: 0, r: 8 }];
  // 12.185 bölge adları (geliştirici P + minimap başlığı; New York'ta hiç yoktu): meydan, Broadway iki ucu, 5. cadde iki ucu, insanların çıktığı yüksek noktalar
  const callouts = [
    { name: 'Anıt Meydanı', x: 0, z: 0, major: true }, { name: 'Karakol', x: -19, z: 0 }, { name: 'Batı Broadway', x: -50, z: 0, major: true }, { name: 'Doğu Broadway', x: 48, z: 0, major: true },
    { name: 'Kuzey Cadde', x: 0, z: -38 }, { name: 'Güney Cadde', x: 0, z: 36 }, { name: 'Çökmüş Bina', x: -23, z: 25 }, { name: 'Batı Kamyon', x: -30, z: -3.6 }, { name: 'Doğu Kamyon', x: 24, z: 3.6 },
    { name: 'Doğu Metro', x: 21, z: 11.5 }, { name: 'Batı Metro', x: -21, z: -11.5 }, { name: 'Otopark', x: -65, z: -47, major: true }, { name: 'İnşaat', x: 67, z: 48, major: true },
    { name: 'Market Çatısı', x: 59, z: -39 }, { name: 'Park', x: -6, z: 48 }, { name: 'Kilise', x: -8, z: -47 }, { name: 'Benzinlik', x: 46, z: 48 },
  ];

  // tenteler: eğimli kumaş + ön saçak (yalnız görsel); altında üstüne çıkılabilen / uzanan bir şey varsa (kamyon, metro çatısı, konteyner, direk) konmaz: kafa kumaşa girmesin
  for (const A of awnings) {
    const hz = A.f === 'n' || A.f === 's', L = 1.25, th = 0.42, cy = 3.45 - Math.sin(th) * L / 2, off = Math.cos(th) * L / 2, ax = A.mid + A.a;
    const o0 = A.base, o1 = A.base + A.sg * 2 * off;
    const [x0, x1, z0, z1] = hz ? [ax - 1.25, ax + 1.25, Math.min(o0, o1), Math.max(o0, o1)] : [Math.min(o0, o1), Math.max(o0, o1), ax - 1.25, ax + 1.25];
    if (b.colliders.some((c) => c.min[1] < 3.5 && c.max[1] > 0.3 && c.min[0] < x1 && c.max[0] > x0 && c.min[2] < z1 && c.max[2] > z0)) continue;
    const ey = 3.45 - Math.sin(th) * L;
    if (hz) { b.box(ax, cy - 0.02, A.base + A.sg * off, 2.4, 0.04, L, A.color, nk(KD.AWNING, { rx: A.sg * th })); b.box(ax, ey - 0.24, A.base + A.sg * (2 * off - 0.02), 2.4, 0.26, 0.03, A.color, nk(KD.AWNING)); }
    else { b.box(A.base + A.sg * off, cy - 0.02, ax, L, 0.04, 2.4, A.color, nk(KD.AWNING, { rz: -A.sg * th })); b.box(A.base + A.sg * (2 * off - 0.02), ey - 0.24, ax, 0.03, 0.26, 2.4, A.color, nk(KD.AWNING)); }
  }
  setCityHoles(holeList);
  const group = b.build();
  if (typeof document !== 'undefined') {
    for (const [i, s] of signs.entries()) {
      const m = textPlane(s.text, s.w, s.h, { fg: '#e8e6df', font: 'bold 130px sans-serif', ...(s.o || {}), glow: s.o?.glow ?? true });
      m.position.set(s.x, s.y, s.z); m.rotation.y = s.ry; group.add(m);
      if ((s.o?.glow ?? true) && s.o?.fg && s.text !== 'SUBWAY') neon.push({ x: s.x, y: s.y, z: s.z, w: s.w, color: s.o.fg, blink: i % 5 === 2, mesh: m });     // neon halesi; her 5. tabela bozuk (ara ara söner)
    }
    const hosp = textPlane('NO\nSAFE\nPLACE', 6, 6, { fg: '#b3201a', font: 'bold 260px sans-serif', drip: true }); hosp.position.set(-9.12, 3.4, 22); hosp.rotation.y = -Math.PI / 2; group.add(hosp);      // 12.185: yüzü arsaya (−x) — önce duvara bakıyordu, arsadan (çift yüz) TERS okunuyordu
    const g2 = textPlane('THEY ARE\nEVERYWHERE', 9, 4, { fg: '#c4281f', font: 'bold 200px sans-serif', drip: true }); g2.position.set(34.2, 3.2, -22); g2.rotation.y = Math.PI / 2; group.add(g2);
  }
  // ───────── gece efektleri (yalnız görsel): ateş ışığı, hale, duman, kıvılcım, lamba parlaması ─────────
  const fx = MapBuilder.noVisual ? null : cityFx(group, {
    lights: [                                                                                      // gerçek nokta ışıkları (gölgesiz; dokunmatikte ilk 2)
      { x: 12, y: 2.2, z: -4.2, i: 60 }, { x: -52, y: 2.2, z: 2.6, i: 60 }, { x: 4, y: 1.8, z: -7, i: 30, d: 12 },
      { x: 42, y: 2.2, z: -22, i: 60 }, { x: 28, y: 1.8, z: 7, i: 30, d: 12 },
    ],
    flames: holeFlames.map(([x, y, z, sz]) => ({ x, y, z, s: sz })), neon,
    fires: [...fxFires, ...fxBarrels.map(([x, z]) => ({ x, y: 1.15, z, s: 0.55 })), ...holeFires.map(([x, y, z]) => ({ x, y, z, s: 1.1, wall: true }))],
    lamps: [...fxLamps, { x: 20.8, y: 4.1, z: 11.5, color: '#3be06a', s: 1.4, pool: false }, { x: -21.2, y: 4.1, z: -11.5, color: '#3be06a', s: 1.4, pool: false },
      ...[[-12, 8.5], [14, -8.5], [36, 7.5], [-38, -7.5], [60, 8], [-70, -8]].map(([x, z]) => ({ x: x + 1.0, y: 3.7, z, color: '#ff3a2a', s: 0.9, a: 0.5, pool: false }))],
    pools: craters.map(([x, z, r]) => ({ x, z, y: 0.15, r: r * 0.9, color: '#ff4a14', a: 0.22 })),
    smoke: [...manholes.filter((_, i) => i % 3 === 0).map(([x, z]) => ({ x, y: 0.1, z, s: 1.0, h: 4.5, n: 6, a: 0.22, color: '#9a9ca6' })), ...fxFires.map((f) => ({ x: f.x, y: 2.2, z: f.z, s: 3.0, h: 24, n: 10, a: 0.8, color: '#55555e' })), ...fxBarrels.map(([x, z]) => ({ x, y: 1.4, z, s: 0.9, h: 7, n: 5, a: 0.35, color: '#3a3b40' })),
      ...holeFires.map(([x, y, z]) => ({ x, y: y + 1.5, z, s: 2.2, h: 16, n: 4, a: 0.5, color: '#4a4a52' }))],
    embers: [...fxFires.map((f) => ({ x: f.x, y: 1.6, z: f.z, n: 12 })), ...fxBarrels.map(([x, z]) => ({ x, y: 1.2, z, n: 4 }))],
  });
  return {
    id: 'newyork',
    name: 'New York',
    group,
    colliders: b.colliders,
    sight: b.sight,
    bounds: NEWYORK_BOUNDS,
    baseZones: null,
    roads,
    spawns,
    objectives,
    callouts,
    perches,
    decor: { manholes, holes: holeList },                                                                   // yalnız görsel (test bakışları)
    layered: true,
    forceTod: 'night',
    fx,
    // dumanlı, yangın yansımalı gece: ufuk kızıl, sis koyu ve yakın, ay ışığı soğuk; şiddetler oynanabilir aydınlıkta tutuldu
    env: { night: { sky: ['#020309', '#0b1020', '#3a2420'], fog: ['#1a1a22', 0.17, 0.42], sun: ['#9db2e8', 1.15], hemi: ['#4a5a8a', '#22180f', 1.05], cloud: '#1d1f2a', cloudGlow: 0.18, envI: 0.16, glow: 1.7 } },
  };
}
