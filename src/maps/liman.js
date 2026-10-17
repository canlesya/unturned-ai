import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import { LK, limanU, makeLimanMaterial, makeWaterMaterial } from './limanSurface.js';

// "Liman" — küçük, telefon dostu konteyner sahası (60 × 66 m, 4v4–5v5). Kuzey (−z) Kırmızı, güney (+z) Mavi doğar.
// Üç hat: Batı (A, lastik tekerlekli portal vinç altı), Orta (B, konteyner kulesi: ortadan tünel, iki merdivenle çatı), Doğu (C, rıhtım: gemi vinci altı).
// Hatları ayıran 2 katlı konteyner duvarları (x = ±10,5) ortada (|z| 6,1–10,1) ve doğuş önlerinde (|z| > 16,2) geçit verir.
// Oynanış yerleşimi 180° döndürme simetrik ((x,z) → (−x,−z)): iki taraf aynı mesafe ve siperi görür; yalnız süs farklı (doğuda su + gemi vinci, batıda portal vinç).
// Kurallar: görünen her katı parçanın çarpışması birebir; görünmez duvar yok. Doğuda rıhtım korkuluğu (0,95 m beton) — sınır korkuluğun ortası, suya düşülmez.
// Tek 2,6 m'lik yürünebilir üst: B kulesi (plat). Diğer konteynerler 2 katlı (5,2 m) ya da sıçrayarak erişilemeyecek uzaklıkta (scripts/limantest.mjs denetler).

export const LIMAN_BOUNDS = { minX: -30, maxX: 30.05, minZ: -33, maxZ: 33 };
const CH = 2.6, CW = 2.44, L40 = 12.2, L20 = 6.1;
const NC = { collide: false };
const k = (kind, o = {}) => ({ ...o, kind }), nk = (kind, o = {}) => ({ collide: false, ...o, kind });
const PI = Math.PI;
// solmuş konteyner boyaları (doygunluk düşük: takım renkli askerler zeminden ayrılsın)
const BOXC = ['#8a4434', '#3f6687', '#2f6a66', '#56744a', '#b0703a', '#b89a48', '#7f8487', '#b9b6aa', '#6e4c38', '#34496a', '#93503c', '#4c7a8c'];
const ASPH = '#4a4c50', CONC = '#9a9890', CONC_D = '#7d7b74', STEEL_D = '#3c3f43', YEL = '#d0a62a', RUB = '#232426';
const STS = '#b5452e', STS_W = '#d6d2c6', RTG = '#d1a23a';

// Gece sahte ışıkları (limanSurface): direk / vinç projektörü / tünel / depo cephe lambaları
const LAMPS = [
  { x: -31.2, y: 16.5, z: -12, r: 36, c: '#ffe2b0', k: 2.6 }, { x: -31.2, y: 16.5, z: 12, r: 36, c: '#ffe2b0', k: 2.6 },
  { x: 21, y: 13.5, z: -9, r: 30, c: '#eef0ff', k: 2.8 }, { x: 21, y: 13.5, z: 9, r: 30, c: '#eef0ff', k: 2.8 },
  { x: 0, y: 15.5, z: -20, r: 32, c: '#ffd08a', k: 3.0 }, { x: 0, y: 15.5, z: 20, r: 32, c: '#ffd08a', k: 3.0 },
  { x: -21.5, y: 16.2, z: 0, r: 26, c: '#ffe9c0', k: 2.4 }, { x: 0, y: 2.3, z: 0, r: 7, c: '#ffcf7a', k: 2.2 },
  { x: -15, y: 5.4, z: -32.4, r: 15, c: '#ffcf7a', k: 2.2 }, { x: 15, y: 5.4, z: -32.4, r: 15, c: '#ffcf7a', k: 2.2 },
  { x: -15, y: 5.4, z: 32.4, r: 15, c: '#ffcf7a', k: 2.2 }, { x: 15, y: 5.4, z: 32.4, r: 15, c: '#ffcf7a', k: 2.2 },
];

export const CALLOUTS = [
  { name: 'A · Portal Vinç', x: -21.5, z: 0, major: true }, { name: 'B · Kule', x: 0, z: 0, major: true }, { name: 'C · Rıhtım', x: 21, z: 0, major: true },
  { name: 'Tünel', x: 0, z: 0 }, { name: 'Kule Çatısı', x: 0, z: -3 },
  { name: 'Batı Hattı Kuzey', x: -20, z: -15 }, { name: 'Batı Hattı Güney', x: -20, z: 15 },
  { name: 'Doğu Hattı Kuzey', x: 20, z: -15 }, { name: 'Doğu Hattı Güney', x: 20, z: 15 },
  { name: 'Orta Kuzey', x: 0, z: -15 }, { name: 'Orta Güney', x: 0, z: 15 },
  { name: 'Batı Geçit Kuzey', x: -10.5, z: -8 }, { name: 'Batı Geçit Güney', x: -10.5, z: 8 },
  { name: 'Doğu Geçit Kuzey', x: 10.5, z: -8 }, { name: 'Doğu Geçit Güney', x: 10.5, z: 8 },
  { name: 'Kırmızı Kapı', x: 0, z: -21, major: true }, { name: 'Mavi Kapı', x: 0, z: 21, major: true },
  { name: 'Kırmızı Avlu', x: 0, z: -29.5 }, { name: 'Mavi Avlu', x: 0, z: 29.5 },
  { name: 'Rıhtım Kuzey', x: 27, z: -19 }, { name: 'Rıhtım Güney', x: 27, z: 19 },
];

// ───────── konteyner ─────────
// (x, z) taban merkezi, ax: uzun eksen ('x' | 'z'), door: kapılı uç (+1 / −1 / 0). Gövde tek kutu (çarpışma birebir); oluk / kiriş / pas gölgelendiricide.
// Köşe dikmeleri 1 cm, kapı kilit çubukları 4 cm dışarı taşar (çarpışmasız süs; çok ince).
function ctr(b, rng, { x, z, y = 0, ax = 'z', len = L40, col, door = 1, tag, logo }) {
  col ||= BOXC[Math.floor(rng() * BOXC.length)];
  const dark = new THREE.Color(col).multiplyScalar(0.62).getStyle();
  b.with(x, y, z, ax === 'x' ? 0 : PI / 2, () => {
    b.box(0, 0, 0, len, CH, CW, col, k(LK.BOX, tag ? { tag } : {}));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (len / 2 - 0.085), 0, sz * (CW / 2 - 0.085), 0.19, CH, 0.19, dark, nk(LK.STEEL));
    if (door) {
      const ex = door * (len / 2 + 0.02);
      for (const oz of [-0.86, -0.3, 0.3, 0.86]) b.box(ex, 0.14, oz, 0.04, 2.32, 0.05, dark, nk(LK.STEEL));
      for (const oz of [-0.58, 0.58]) b.box(ex, 1.05, oz, 0.05, 0.08, 0.42, dark, nk(LK.STEEL));
      b.box(door * (len / 2 + 0.006), 0.14, 0, 0.012, 2.32, 0.035, '#1c1d1f', nk(LK.STEEL));
    }
    if (logo ?? rng() < 0.35) {                                     // boyalı firma şeridi (iki uzun yüzde, düz boya)
      const lc = rng() < 0.5 ? '#d9d6cb' : '#2a2c30', lw = len * (0.35 + rng() * 0.25), lh = 0.45 + rng() * 0.35;
      for (const s of [-1, 1]) b.box((rng() - 0.5) * (len - lw - 1), 1.1 + rng() * 0.6, s * (CW / 2 + 0.006), lw, lh, 0.012, lc, nk(LK.MARK));
    }
  });
}
let _cid = 0;
const C = (b, rng, o) => b.obj('konteyner:' + _cid++, () => ctr(b, rng, o));
const stack = (b, rng, o, tiers = 2) => { for (let t = 0; t < tiers; t++) C(b, rng, { ...o, y: t * CH, col: o.cols?.[t], door: t ? (rng() < 0.5 ? 1 : -1) : o.door ?? 1 }); };

// Ucu açık tünel konteyneri (B): tavan + yan duvarlar + uç başlıkları ayrı kutular (içeriden geçilir), içte tavan lambası
function tunnelBox(b, x, z, col) {
  b.obj('tünel', () => b.with(x, 0, z, PI / 2, () => {
    const L = L40, dark = new THREE.Color(col).multiplyScalar(0.62).getStyle();
    b.box(0, CH - 0.12, 0, L, 0.12, CW, col, k(LK.BOX));
    for (const s of [-1, 1]) b.box(0, 0, s * (CW / 2 - 0.04), L, CH - 0.12, 0.08, col, k(LK.BOX));
    b.box(0, 0, 0, L, 0.05, CW - 0.16, '#5a5650', k(LK.WOOD));               // tahta taban (5 cm, adımla çıkılır)
    for (const e of [-1, 1]) {
      b.box(e * (L / 2 - 0.1), CH - 0.36, 0, 0.2, 0.24, CW - 0.16, dark, k(LK.STEEL));          // uç başlık kirişi (iç yükseklik 2,24 m)
      for (const s of [-1, 1]) b.box(e * (L / 2 - 0.085), 0, s * (CW / 2 - 0.085), 0.19, CH, 0.19, dark, nk(LK.STEEL));
    }
    for (const lx of [-3.5, 0, 3.5]) b.box(lx, CH - 0.2, 0, 0.6, 0.08, 0.16, '#ffd98a', { collide: false, o: { glow: true } });
  }));
}

// ───────── forklift (+x ileri: çatallar) ─────────
// Gövde 1,6 m (yerden sıçranmaz), koruma kafesi 2,2 m (ince direkler + tavan levhası), direk iki ray. Hepsi kendi kutusunda çarpışır.
function forklift(b, x, z, ry = 0, col = '#d39a2a', id = 'forklift') {
  b.obj(id, () => b.with(x, 0, z, ry, () => {
    b.box(-0.35, 0, 0, 2.3, 1.6, 1.3, col, k(LK.STEEL));                         // gövde + karşı ağırlık (tekerler dahil)
    b.box(-1.42, 0.45, 0, 0.16, 0.9, 1.34, '#2e3034', nk(LK.STEEL));            // karşı ağırlık alt şeridi (1 cm taşar)
    for (const sx of [-1.0, 0.45]) for (const s of [-1, 1]) b.cyl(sx, 0.36, s * 0.66, 0.36, 0.36, 0.06, RUB, { rx: PI / 2, center: true, seg: 10, collide: false, kind: LK.RUBBER });
    for (const [px, pz] of [[-1.3, -0.58], [-1.3, 0.58], [0.38, -0.58], [0.38, 0.58]]) b.box(px, 1.6, pz, 0.08, 0.6, 0.08, '#2b2d31', k(LK.STEEL));
    b.box(-0.46, 2.2, 0, 1.84, 0.06, 1.24, '#2b2d31', k(LK.STEEL));             // koruma tavanı
    b.box(-0.6, 1.6, 0, 0.5, 0.45, 0.5, '#2a2b2e', k(LK.STEEL));                // koltuk (kafes içinde)
    for (const s of [-1, 1]) b.box(0.9, 0, s * 0.38, 0.12, 2.6, 0.12, '#2e3034', k(LK.STEEL));     // direk rayları
    b.box(0.9, 2.45, 0, 0.12, 0.15, 0.88, '#2e3034', k(LK.STEEL));
    b.box(1.0, 0.3, 0, 0.1, 0.9, 1.0, '#2e3034', k(LK.STEEL));                     // çatal taşıyıcı
    for (const s of [-1, 1]) b.box(1.6, 0.05, s * 0.32, 1.1, 0.06, 0.12, '#2e3034', k(LK.STEEL));
    b.box(0.2, 1.62, 0, 0.3, 0.12, 0.3, '#e04a1a', { collide: false, o: { glow: true } });          // ikaz lambası
  }));
}

// palet yığını (n × 0,14 m), tek çarpışma kutusu
function pallets(b, x, z, n, ry = 0, id) {
  b.obj(id, () => b.with(x, 0, z, ry, () => {
    for (let i = 0; i < n; i++) b.box(0, i * 0.14, 0, 1.2, 0.14, 1.0, i % 2 ? '#9a7a4e' : '#8a6c44', nk(LK.WOOD));
    b.collide(0, 0, 0, 1.2, n * 0.14, 1.0);
  }));
}
// streç filmli yük (iki palet üstünde 1,75 m): orta kapıdan karşı kapıya düz görüşü keser
function cargo(b, x, z, id) {
  b.obj(id, () => {
    for (const s of [-0.6, 0.6]) b.box(x + s, 0, z, 1.18, 0.14, 1.1, '#8a6c44', nk(LK.WOOD));
    b.box(x, 0.14, z, 2.36, 1.61, 1.08, '#cfd3d4', nk(LK.PLAIN));
    b.box(x, 0.9, z, 2.37, 0.06, 1.09, '#3a6fb0', nk(LK.MARK));
    b.collide(x, 0, z, 2.36, 1.75, 1.1);
  });
}
function barrels(b, rng, pts, id) {
  b.obj(id, () => { for (const [x, z] of pts) { const c = ['#2f5f8a', '#8a2f2a', '#3f6f3f', '#c9a23a'][Math.floor(rng() * 4)]; b.cyl(x, 0, z, 0.3, 0.3, 0.9, c, { seg: 10, kind: LK.STEEL }); b.cyl(x, 0.9, z, 0.26, 0.26, 0.012, new THREE.Color(c).multiplyScalar(0.7).getStyle(), { seg: 10, collide: false, kind: LK.STEEL }); } });
}
function jersey(b, x, z, ry, id) {
  b.obj(id, () => b.with(x, 0, z, ry, () => {
    b.box(0, 0, 0, 2.6, 0.32, 0.62, CONC, k(LK.CONC));
    b.box(0, 0.32, 0, 2.6, 0.58, 0.36, CONC, k(LK.CONC));
    for (const s of [-1, 1]) b.box(0, 0.6, s * 0.185, 2.6, 0.12, 0.012, YEL, nk(LK.MARK));
  }));
}
function bollard(b, x, z, id) {
  b.obj(id, () => { b.cyl(x, 0, z, 0.24, 0.3, 0.55, '#2d2f33', { seg: 10, kind: LK.STEEL }); b.cyl(x, 0.55, z, 0.34, 0.34, 0.1, '#2d2f33', { seg: 10, kind: LK.STEEL }); });
}
// yüksek direk lambası (zemin direği çarpışır, kafa süs)
function mast(b, x, y, z, h, id, collide = true) {
  b.obj(id, () => {
    b.cyl(x, y, z, 0.16, 0.24, h, '#5a5e63', { seg: 8, kind: LK.STEEL, collide });
    b.box(x, y + h, z, 2.4, 0.16, 0.4, '#3a3d41', nk(LK.STEEL));
    for (const s of [-0.8, 0, 0.8]) b.box(x + s, y + h - 0.32, z, 0.55, 0.3, 0.35, '#fff1cf', { collide: false, o: { glow: true } });
  });
}

// ───────── portal ayakları (iki vinç aynı ayak izine sahip: oynanış simetrik) ─────────
// Bojiler 1,4 × 1,6 × 4 m (siper), ayak 1 × 1 m. Kirişler 6 m ve üstünde.
function bogie(b, x, z, col, rubber) {
  b.box(x, 0.9, z, 1.4, 0.7, 4.0, col, k(LK.STEEL));                                         // boji çerçevesi
  b.box(x, 0, z, 1.3, 0.9, 3.6, rubber ? RUB : STEEL_D, k(rubber ? LK.RUBBER : LK.STEEL));    // tekerlek takımı
  for (const s of [-1, 1]) for (const wz of rubber ? [-1.1, 1.1] : [-1.3, -0.45, 0.45, 1.3]) b.cyl(x + s * 0.66, rubber ? 0.5 : 0.4, z + wz, rubber ? 0.5 : 0.38, rubber ? 0.5 : 0.38, 0.03, rubber ? '#3a3b3e' : '#55585c', { rz: PI / 2, center: true, seg: 12, collide: false, kind: LK.STEEL });
  for (const s of [-1, 1]) b.box(x, 1.61, z + s * 1.6, 1.42, 0.012, 0.5, YEL, nk(LK.MARK));
}

// Gemi vinci (STS, doğu): ayaklar x 15 / 27, z ±9; bom suyun üstüne uzanır (yalnız görsel dev işaret)
function stsCrane(b) {
  b.obj('vinç:gemi', () => {
    for (const x of [15, 27]) for (const z of [-9, 9]) { bogie(b, x, z, STS, false); b.box(x, 1.6, z, 1.0, 12.6, 1.0, STS, k(LK.STEEL)); }
    for (const x of [15, 27]) { b.box(x, 14.2, 0, 1.5, 1.8, 19.5, STS, k(LK.STEEL)); b.box(x, 6.2, 0, 0.6, 0.6, 17, STS, k(LK.STEEL)); }
    for (const z of [-9, 9]) b.box(21, 14.2, z, 12, 1.4, 1.1, STS, k(LK.STEEL));
    // üst kule: ayaklar 30 m'ye çıkar, bom 30–32 m
    for (const x of [15, 27]) for (const z of [-9, 9]) b.box(x, 16, z, 0.8, 14, 0.8, STS, k(LK.STEEL));
    for (const z of [-9, 9]) b.box(21, 22.5, z, 12, 0.6, 0.6, STS, k(LK.STEEL));
    for (const s of [-1, 1]) b.box(39, 30, s * 2.4, 82, 2.0, 0.9, STS_W, k(LK.STEEL));           // bom kirişleri (x −2 … 80)
    for (let x = 0; x <= 78; x += 6) b.box(x, 30.2, 0, 0.5, 0.5, 4.0, STS_W, k(LK.STEEL));
    for (const x of [15, 27]) b.box(x, 30, 0, 1.0, 1.0, 19, STS, k(LK.STEEL));
    b.box(9, 32, 0, 9, 3.6, 6.4, STS_W, k(LK.CLAD));                                              // makine dairesi
    b.box(9, 32.9, 3.21, 6, 0.9, 0.04, '#9fc3d8', { collide: false, o: { glow: true } });
    // A-çerçeve + gergi çubukları (yüksekte, ince; çarpışmasız)
    for (const s of [-1, 1]) {
      const a = (x0, y0, x1, y1, t = 0.45) => { const L = Math.hypot(x1 - x0, y1 - y0); b.box((x0 + x1) / 2, (y0 + y1) / 2 - t / 2, s * 2.4, L, t, t, STS, { collide: false, rz: Math.atan2(y1 - y0, x1 - x0), kind: LK.STEEL }); };
      a(15, 32, 24, 46, 0.7); a(27, 32, 24, 46, 0.7); a(24, 46, 78, 32, 0.22); a(24, 46, 50, 32, 0.22); a(24, 46, 0, 32, 0.22);
    }
    b.box(24, 45.8, 0, 1.2, 1.2, 5.6, STS, k(LK.STEEL));
    b.box(24, 47, 0, 0.3, 0.3, 0.3, '#ff2a1a', { collide: false, o: { glow: true } });             // uçak ikaz lambası
    b.box(80, 32, 0, 0.3, 0.3, 0.3, '#ff2a1a', { collide: false, o: { glow: true } });
    // araba + kabin + spreader (suyun üstünde)
    b.box(46, 28.6, 0, 5, 1.4, 5.2, STS_W, k(LK.STEEL));
    b.box(44, 26.2, 1.4, 2.6, 2.2, 2.2, '#3a3f45', k(LK.STEEL));
    b.box(42.68, 26.5, 1.4, 0.04, 1.4, 1.9, '#9fc3d8', { collide: false, o: { glow: true } });
    for (const s of [-1, 1]) b.box(47, 13, s * 1.0, 0.06, 15.6, 0.06, '#222', NC);
    b.box(47, 12.4, 0, 12.2, 0.6, 2.5, YEL, k(LK.STEEL));
    // projektörler (portal kirişi altı; LAMPS ile aynı yer) + kiriş ışıkları
    for (const z of [-9, 9]) for (const x of [17.5, 21, 24.5]) b.box(x, 13.9, z, 0.7, 0.3, 0.5, '#fff6dc', { collide: false, o: { glow: true } });
    for (let x = 4; x <= 76; x += 12) b.box(x, 29.8, 0, 0.5, 0.2, 0.5, '#fff1cf', { collide: false, o: { glow: true } });
    // ayakta merdiven (süs)
    for (let y = 2; y < 14; y += 0.4) b.box(15.56, y, -9, 0.06, 0.04, 0.6, '#2b2d31', NC);
  });
}

// Lastik tekerlekli portal vinç (RTG, batı): aynı ayak izi (x −15 / −27, z ±9), 18 m; kancada bir konteyner asılı
function rtgCrane(b, rng) {
  b.obj('vinç:portal', () => {
    for (const x of [-15, -27]) for (const z of [-9, 9]) { bogie(b, x, z, RTG, true); b.box(x, 1.6, z, 0.9, 15.4, 0.9, RTG, k(LK.STEEL)); }
    for (const x of [-15, -27]) { b.box(x, 6.0, 0, 0.6, 0.7, 17, RTG, k(LK.STEEL)); b.box(x, 17, 0, 1.2, 1.4, 19.2, RTG, k(LK.STEEL)); }
    for (const z of [-9, 9]) b.box(-21, 17, z, 13.4, 1.6, 1.2, RTG, k(LK.STEEL));
    b.box(-21.5, 18.6, 0, 3.4, 1.4, 19.2, '#c9c5b8', k(LK.STEEL));                              // araba
    b.box(-21.5, 20.0, 6.5, 3.0, 1.6, 4.0, '#c9c5b8', k(LK.CLAD));                              // makine
    b.box(-25.0, 14.0, -7.4, 2.4, 2.4, 2.0, '#3a3f45', k(LK.STEEL));                              // operatör kabini
    b.box(-25.0, 14.4, -6.39, 2.0, 1.5, 0.04, '#9fc3d8', { collide: false, o: { glow: true } });
    for (const s of [-1, 1]) b.box(-21.5, 12.3, s * 2.5, 0.06, 6.3, 0.06, '#222', NC);
    b.box(-21.5, 11.9, 0, 2.5, 0.4, 6.4, YEL, k(LK.STEEL));                                      // spreader
    C(b, rng, { x: -21.5, z: 0, y: 9.3, ax: 'z', len: L20, col: '#3f6687', door: 1 });           // asılı konteyner
    for (const x of [-17.5, -21.5, -25.5]) for (const z of [-9.7, 9.7]) b.box(x, 16.6, z, 0.7, 0.3, 0.5, '#fff1cf', { collide: false, o: { glow: true } });
    b.box(-15, 19, -9, 0.3, 0.3, 0.3, '#ff9a1a', { collide: false, o: { glow: true } });
    for (let y = 2; y < 16.5; y += 0.4) b.box(-15.51, y, 9, 0.06, 0.04, 0.6, '#2b2d31', NC);
  });
}

// ───────── yarım harita (180° döndürülüp tekrarlanır): doğu hattı + orta kuzey + iki ayırıcının birer parçası ──
function half(b, rng, tag) {
  // ayırıcı duvarlar (2 katlı): doğu orta parça + doğu kuzey + batı kuzey
  stack(b, rng, { x: 10.5, z: 0, ax: 'z', len: L40, door: 0 });
  stack(b, rng, { x: 10.5, z: -13.15, ax: 'z', len: L20, door: -1 });
  stack(b, rng, { x: -10.5, z: -13.15, ax: 'z', len: L20, door: -1 });
  // C (rıhtım) siperleri: iki 20'lik tek kat (vinç altı, S düzeni) + palet
  C(b, rng, { x: 18, z: -2.5, ax: 'z', len: L20, door: -1 });
  C(b, rng, { x: 24, z: 2.5, ax: 'z', len: L20, door: 1 });
  pallets(b, 21, -6.6, 4, 0, 'palet:' + tag + '1');
  pallets(b, 21, 6.6, 3, 0, 'palet:' + tag + '4');
  // doğu hattı kuzey: 2 katlı 20'lik yığın; güney: tek kat 40'lık (enine)
  stack(b, rng, { x: 20, z: -16, ax: 'z', len: L20, door: 1 });
  C(b, rng, { x: 21.5, z: 16, ax: 'x', len: L40, door: 1 });
  pallets(b, 27.8, -21.6, 3, 0.3, 'palet:' + tag + '2');
  // kapı önü şikanları (tek kat 20'lik, enine): avludan hatta düz görüşü ve ön meydan boyunca 58 m'lik hattı keser
  C(b, rng, { x: 21.4, z: -20.6, ax: 'x', len: L20, door: 1 });
  C(b, rng, { x: 21.4, z: 20.6, ax: 'x', len: L20, door: -1 });
  // orta kuzey: forklift (enine), beton bariyer, palet, varil
  forklift(b, 5.5, -14, PI, '#d39a2a', 'forklift:' + tag);
  jersey(b, -5.5, -12, 0, 'bariyer:' + tag + '1');
  pallets(b, 7.2, -20, 4, 0, 'palet:' + tag + '3');
  cargo(b, 4.5, -19.6, 'yük:' + tag);
  barrels(b, rng, [[7.8, 3.0], [8.5, 3.6], [7.9, 3.9]], 'varil:' + tag);
  // B kulesinin doğu bloğu (plat: çatı) + kuzeyden çıkan merdiven + çatıda sandık
  C(b, rng, { x: 2.44, z: 0, ax: 'z', len: L40, door: 0, tag: 'plat', col: '#8a4434', logo: false });
  b.obj('merdiven:' + tag, () => {
    b.stairs(2.44, -9.1, 0, '+z', 1.4, 10, 0.26, 0.3, '#5d6166', { tag: 'plat' });
  });
  b.obj('sandık:' + tag, () => { b.box(2.6, CH, 2.3, 0.85, 0.8, 0.85, '#8d6a42', k(LK.WOOD)); b.box(2.2, CH, 3.3, 0.85, 0.8, 0.85, '#7d5d3a', k(LK.WOOD)); });
  // rıhtım babaları (doğu) — yarımda iki tane, döndürmede batıya düşmesin diye burada değil (asimetrik süs aşağıda)
  // kapı kulübesi: doğuş duvarının orta parçasına yaslı (ön meydan boyunca 58 m'lik düz hattı ortadan böler)
  b.obj('kulübe:' + tag, () => {
    const z0 = -24, z1 = -21.7, zc = (z0 + z1) / 2;
    b.box(0, 0, zc, 2.0, 2.5, z1 - z0, '#c9c5b8', k(LK.CLAD));
    b.box(0, 2.5, zc + 0.1, 2.3, 0.12, z1 - z0 + 0.2, '#5b6066', k(LK.STEEL));
    b.box(0, 1.05, z1 + 0.02, 1.3, 0.85, 0.04, '#cfe3ee', { collide: false, o: { glow: true, transparent: true, opacity: 0.75 } });
    for (const s of [-1, 1]) b.box(s * 1.02, 1.05, zc + 0.3, 0.04, 0.85, 1.0, '#cfe3ee', { collide: false, o: { glow: true, transparent: true, opacity: 0.75 } });
    b.box(0, 0, z1 + 0.25, 2.0, 0.08, 0.5, '#d0a62a', nk(LK.MARK));
  });
  // kuzey yüksek direk (orta ön meydan)
  mast(b, 0, 0, -20, 15.5, 'direk:' + tag);
}

// Doğuş ön duvarı (2 katlı, enine): 4 kapı (Batı, Orta-sol, Orta-sağ, Doğu)
function spawnWall(b, rng, zc) {
  const pieces = [[-30, -23.9], [-18.9, -6.7], [-3.05, 3.05], [6.7, 18.9], [23.9, 29.8]];
  for (const [a, c] of pieces) stack(b, rng, { x: (a + c) / 2, z: zc, ax: 'x', len: c - a, door: 0 });
}

// Depo cephesi (kuzey / güney sınırı): 9 m oluklu sac, kepenkler, kapı, lambalar, levha
function warehouse(b, zf, dir, col, id) {
  b.obj(id, () => {
    const d = 14, zc = zf + dir * d / 2;
    b.box(-1.07, 0, zc, 62.74, 9, d, col, k(LK.CLAD));
    b.box(-1.07, 9, zc, 63.4, 0.5, d + 0.6, '#5b6066', k(LK.STEEL));                          // saçak
    b.box(-1.07, 0, zf - dir * 0.03, 62.74, 0.7, 0.06, CONC_D, k(LK.CONC));                   // beton kaide
    for (const x of [-21, 0, 21]) {
      b.box(x, 0.7, zf - dir * 0.015, 5.0, 4.6, 0.03, '#77797a', nk(LK.SHUTTER));             // kepenk
      b.box(x, 5.3, zf - dir * 0.08, 5.6, 0.4, 0.16, '#54585d', k(LK.STEEL));
      b.box(x, 0.7, zf - dir * 0.02, 5.4, 0.012, 0.04, YEL, nk(LK.MARK));
    }
    for (const x of [-15, 15]) {
      b.box(x, 0.7, zf - dir * 0.02, 1.1, 2.1, 0.04, '#3e4a55', nk(LK.STEEL));                // personel kapısı
      b.box(x, 5.2, zf - dir * 0.25, 1.0, 0.18, 0.5, '#fff1cf', { collide: false, o: { glow: true } });
      b.box(x, 5.38, zf - dir * 0.13, 0.12, 0.12, 0.26, '#2a2c30', k(LK.STEEL));
    }
    for (const x of [-30.5, -10.5, 10.5, 29.5]) b.cyl(x, 0.7, zf - dir * 0.09, 0.08, 0.08, 8.3, '#5b6066', { seg: 6, kind: LK.STEEL });      // yağmur borusu
    b.box(-1.07, 7.3, zf - dir * 0.02, 18, 1.2, 0.04, '#e8e4d8', nk(LK.MARK));                 // levha zemini (yazı istemcide)
  });
}

export function buildLiman() {
  _cid = 0;
  const b = new MapBuilder();
  const rng = makeRng(2026);
  b.surface = { ground: () => 0, kindOf: () => LK.PLAIN, seeded: true, material: () => makeLimanMaterial(LAMPS) };

  // ── zemin: asfalt saha, rıhtım betonu, işaretler ──
  if (!MapBuilder.noVisual) {
    b.box(-19.85, -1, 0, 100.3, 1, 140, ASPH, nk(LK.ASPHALT));
    b.box(27.5, 0, 0, 5.6, 0.012, 66, CONC, nk(LK.CONC));                                     // rıhtım önlüğü
    for (const x of [15, 27]) { b.box(x, 0, 0, 0.8, 0.014, 66, '#6f6d68', nk(LK.CONC)); b.box(x, 0.014, 0, 0.09, 0.012, 66, '#8b8e92', nk(LK.STEEL)); }   // vinç rayları
    for (const x of [-15, -27]) for (const s of [-1, 1]) b.box(x + s * 0.5, 0, 0, 0.12, 0.013, 44, '#c9a23a', nk(LK.MARK));   // RTG tekerlek şeridi
    for (const z of [-24, 24]) for (const x of [-21.4, -4.9, 4.9, 21.4]) b.box(x, 0, z + Math.sign(z) * -1.2, 3.2, 0.013, 0.25, '#d9d6cb', nk(LK.MARK));    // kapı önü durma çizgisi
    for (const z of [-9.1, -7.1, 7.1, 9.1]) for (const x of [-10.5, 10.5]) b.box(x, 0, z, 2.2, 0.013, 1.0, '#c9a23a', nk(LK.MARK));   // geçit taraması
    for (let z = -20; z <= 20; z += 4) b.box(0, 0, z, 0.18, 0.013, 2.0, '#d9d6cb', nk(LK.MARK));                               // orta şerit
    for (const x of [-20, 20]) for (let z = -20; z <= 20; z += 4) if (Math.abs(z) > 11) b.box(x, 0, z, 0.18, 0.013, 2.0, '#d9d6cb', nk(LK.MARK));
    for (const [x, z] of [[-21.5, 0], [21, 0], [0, 0]]) for (let a = 0; a < 16; a++) { const t = a / 16 * PI * 2; b.box(x + Math.cos(t) * 6.6, 0, z + Math.sin(t) * 6.6, 1.2, 0.013, 0.18, '#e8e4d8', { collide: false, kind: LK.MARK, ry: -t + PI / 2 }); }   // bayrak halkası
  }

  // ── sınırlar ──
  // Batı: 2–3 katlı 40'lık yığın duvarı (iç yüz x = −30)
  { let z = -33; const lens = [L40, L40, L20, L40, L40, L20, 66 - 4 * L40 - 2 * L20];
    for (const len of lens) { stack(b, rng, { x: -30 - CW / 2, z: z + len / 2, ax: 'z', len, door: 0 }, len > 7 ? 3 : 2); z += len; } }
  // Doğu: rıhtım korkuluğu (0,95 m beton, sınır ortasında) + rıhtım duvarı, usturmaçalar
  b.obj('rıhtım', () => {
    b.box(30.05, -3.4, 0, 0.5, 4.35, 66, CONC, k(LK.CONC));
    if (!MapBuilder.noVisual) {
      b.box(30.05, 0.95, 0, 0.5, 0.012, 66, YEL, nk(LK.MARK));
      for (let z = -30; z <= 30; z += 6) b.box(30.45, -1.7, z, 0.3, 1.5, 1.0, RUB, nk(LK.RUBBER));
      b.box(30.6, -3.4, 0, 0.6, 2.0, 66, CONC_D, nk(LK.CONC));
    }
  });
  for (const z of [-27, -20, -13, 13, 20, 27, -2.5, 2.5]) bollard(b, 29.35, z, 'baba:' + z);
  // Kuzey / güney: depo cepheleri
  warehouse(b, -33, -1, '#8d9aa3', 'depo:kuzey');
  warehouse(b, 33, 1, '#a39a8c', 'depo:güney');

  // ── B kulesi ortası: tünel konteyneri ──
  tunnelBox(b, 0, 0, '#3f6687');

  // ── simetrik yarılar ──
  half(b, rng, 'k');
  b.with(0, 0, 0, PI, () => half(b, rng, 'g'));

  // ── doğuş duvarları + avlu ──
  spawnWall(b, rng, -25.22);
  spawnWall(b, rng, 25.22);
  for (const [zc, dir, id, col] of [[-31.65, -1, 'ofis:kırmızı', '#c9c5b8'], [31.65, 1, 'ofis:mavi', '#c9c5b8']]) {
    const x = dir > 0 ? 15 : -15;
    b.obj(id, () => {
      b.box(x, 0, zc, 6, 2.8, 2.5, col, k(LK.CLAD));
      b.box(x, 2.8, zc, 6.2, 0.12, 2.7, '#6b6f74', k(LK.STEEL));
      const fz = zc - dir * 1.25 - dir * 0.02;
      for (const wx of [-1.8, 1.4]) b.box(x + wx, 1.0, fz, 1.4, 1.0, 0.04, '#cfe3ee', { collide: false, o: { glow: true, transparent: true, opacity: 0.75 } });
      b.box(x - 0.2, 0, fz, 0.9, 2.1, 0.04, '#4a5560', nk(LK.STEEL));
      b.box(x + 2.6, 2.0, fz - dir * 0.16, 0.6, 0.5, 0.36, '#a9aba7', k(LK.STEEL));      // klima
    });
  }
  // asimetrik süs (oynanışa etkisi yok, sınır dışında): batı duvarı direkleri
  mast(b, -31.22, 3 * CH, -12, 8.6, 'direk:batı1', true);
  mast(b, -31.22, 3 * CH, 12, 8.6, 'direk:batı2', true);

  // ── vinçler ──
  stsCrane(b);
  rtgCrane(b, rng);

  // ── sınır dışı manzara (yalnız görsel) ──
  if (!MapBuilder.noVisual) backdrop(b, rng);

  const group = b.build();
  let fx = null;
  if (!MapBuilder.noVisual) {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), makeWaterMaterial());
    water.rotation.x = -PI / 2; water.position.set(380.6, -1.4, 0); water.receiveShadow = true;
    group.add(water);
    if (typeof document !== 'undefined') signs(group);
    const mat = group.children.find((m) => m.material && m.material.userData && m.material.userData.glow && m.material.vertexColors)?.material;
    fx = { update: (t) => { limanU.time.value = t; limanU.night.value = mat ? Math.min(1, (mat.emissiveIntensity || 0) / 1.5) : 0; } };
  }

  // ── doğuşlar: avlu içinde iki sıra, çarpışmadan uzak ──
  const spawns = { blue: [], red: [] };
  const free = (x, z) => !b.colliders.some((c) => c.min[1] < 1.8 && c.max[1] > 0.1 && x > c.min[0] - 0.6 && x < c.max[0] + 0.6 && z > c.min[2] - 0.6 && z < c.max[2] + 0.6);
  for (const [team, zs, ry] of [['blue', [28.0, 29.9], 0], ['red', [-28.0, -29.9], PI]]) {
    for (const z of zs) for (let x = -27; x <= 27.01; x += 3.6) { const xx = x + (z === zs[1] ? 1.8 : 0); if (xx < 28 && free(xx, z)) spawns[team].push({ x: +xx.toFixed(2), z, ry }); }
  }

  const objectives = [
    { id: 'a', name: 'A · Portal Vinç', label: 'A', x: -21.5, z: 0, r: 6.6, core: true },
    { id: 'b', name: 'B · Kule', label: 'B', x: 0, z: 0, r: 6.6, core: true },
    { id: 'c', name: 'C · Rıhtım', label: 'C', x: 21, z: 0, r: 6.6, core: true },
  ];

  return {
    id: 'liman',
    name: 'Liman',
    group,
    fx,
    colliders: b.colliders,
    sight: b.sight,
    bounds: LIMAN_BOUNDS,
    layered: true,                                                  // B kulesi çatısı + merdivenler 'plat': yol bulma hücre başına zemin kotu
    callouts: CALLOUTS,
    roamPoints: [[-21.5, -12], [-21.5, 12], [21, -12], [21, 12], [-6.5, -14], [6.5, 14], [-21.5, 0], [21, 0], [-6.5, 2], [6.5, -2], [-10.5, -8], [10.5, 8]],
    mini: { bg: '#2c3a44', ground: [96, 99, 104], wall: '#1d2328', mid: '#5c646c', low: '#7e858c', roof: 'rgba(60,70,80,0.45)' },
    spawns,
    baseZones: {
      blue: { minX: -30, maxX: 30.05, minZ: 24.0, maxZ: 33 },
      red: { minX: -30, maxX: 30.05, minZ: -33, maxZ: -24.0 },
    },
    objectives,
    roads: [],
    roadColor: '#5a5d62',
    env: {
      sky: ['#5f97cc', '#aac9e2', '#dfe8ec'], fog: ['#c9d6de', 85, 300],
      sun: ['#fff0d6', 2.5], hemi: ['#cddff2', '#6a665c', 1.15], cloud: '#f3f5f7', clouds: 16,
      sunPos: [48, 80, 34],
    },
  };
}

// Sınır dışı manzara: batı duvarı arkasında konteyner istifi, rıhtımda yük gemisi, karşı kıyı silüeti. Çarpışma yok (ulaşılamaz, sınırların dışında).
function backdrop(b, rng) {
  for (let row = 0; row < 4; row++) for (let z = -60; z < 60; z += L40 + 0.4) {
    const tiers = 1 + Math.floor(rng() * 4), x = -34.4 - row * (CW + 0.35);
    for (let t = 0; t < tiers; t++) b.box(x, t * CH, z + L40 / 2, CW, CH, L40, BOXC[Math.floor(rng() * BOXC.length)], nk(LK.BOX));
  }
  for (const zz of [-1, 1]) for (let x = -34; x < 30; x += 7) b.box(x, 0, zz * 52, 6.1, CH * (1 + Math.floor(rng() * 3)), CW, BOXC[Math.floor(rng() * BOXC.length)], nk(LK.BOX));
  // yük gemisi (rıhtıma yanaşmış): gövde, güverte istifi, köprü üstü
  b.box(49, -3, -18, 17, 9.5, 104, '#2e3036', nk(LK.PLAIN));
  b.box(49, -3, -18, 17.06, 3.2, 104.06, '#6e2a24', nk(LK.PLAIN));
  b.box(49, 6.5, -18, 17.2, 0.4, 104.2, '#d9d6cb', nk(LK.MARK));
  for (let z = -64; z < 22; z += 6.6) { const n = 5 + Math.floor(rng() * 2); for (let i = 0; i < n; i++) { const t = 1 + Math.floor(rng() * 4); for (let j = 0; j < t; j++) b.box(43 + i * 2.5, 6.5 + j * CH, z, CW, CH, 6.1, BOXC[Math.floor(rng() * BOXC.length)], nk(LK.BOX)); } }
  b.box(49, 6.5, 28, 15, 12, 10, '#e2dfd6', nk(LK.CLAD));
  b.box(49, 18.5, 28, 22, 1.0, 6, '#e2dfd6', nk(LK.CLAD));
  for (let y = 9; y < 18; y += 2.6) b.box(49, y, 22.98, 13, 0.9, 0.05, '#ffe4a8', { collide: false, o: { glow: true } });
  b.box(49, 19.5, 30, 2.4, 6, 2.4, '#2e2f33', nk(LK.STEEL));
  b.box(49, 25.5, 30, 0.3, 0.3, 0.3, '#ff2a1a', { collide: false, o: { glow: true } });
  // karşı kıyı: alçak depolar, uzak vinçler
  for (let z = -200; z < 200; z += 14 + rng() * 10) b.box(190 + rng() * 30, -1.4, z, 18 + rng() * 20, 6 + rng() * 14, 10 + rng() * 8, ['#6d747a', '#7d8086', '#5f666c', '#8a8580'][Math.floor(rng() * 4)], nk(LK.PLAIN));
  for (const z of [-90, -40, 20, 80]) { b.box(176, 0, z, 1.2, 34, 1.2, '#b5452e', NC); b.box(176, 0, z + 12, 1.2, 34, 1.2, '#b5452e', NC); b.box(160, 34, z + 6, 50, 2, 3, '#b5452e', NC); }
}

// Depo levhaları (istemci; yazı dokusu tek düzlem) — "LİMAN · DEPO 2/3"
function signs(group) {
  const mk = (text, z, ry) => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 68;
    const g = c.getContext('2d'); g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, 1024, 68);
    g.fillStyle = '#22303c'; g.font = 'bold 50px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 512, 36);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(17.6, 1.17), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
    m.position.set(-1.07, 7.9, z); m.rotation.y = ry; group.add(m);
  };
  mk('LİMAN İŞLETMESİ · DEPO 3', -32.95, 0);
  mk('LİMAN İŞLETMESİ · DEPO 2', 32.95, PI);
}
