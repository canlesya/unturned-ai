import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import { DK, makeDepoMaterial } from './depoSurface.js';

// "Depo" — küçük, mobil dostu harita (60 × 68 m, 4v4–5v5). Ortada içine girilen kapalı depo (B), çevresinde orta mesafeli avlu.
// Mavi güneyde (+z), kırmızı kuzeyde (−z) doğar; harita z = 0'a göre AYNA simetrik (iki takım her hedefe eşit uzak), doğu-batı farklı karakterli:
//   A (batı) konteyner sahası · B depo içi (raflar + doğu duvarında iki merdivenli asma kat) · C (doğu) yükleme alanı (kamyon, forklift, palet).
// Doğuş avluları konteyner sırasının arkasında; sıranın 3 açıklığının arkasında perde konteyner var (düşman doğuşundan görülmez, düz hat yok).
// Kural: görünen her katı parçanın çarpışması birebir (bileşik eşyada görsel parçalar çarpışmasız, çarpışma = görselin dış zarfı); görünmez engel yok.
// Çizim: düz parçaların hepsi tek ağ (depoSurface gölgelendiricisi) + lamba (parlak) + cam + 6 tabela ≈ 9 çizim çağrısı.

export const DEPO_BOUNDS = { minX: -30, maxX: 30, minZ: -34, maxZ: 34 };
const NC = { collide: false };
const k = (kind, o = {}) => ({ ...o, kind }), nk = (kind, o = {}) => ({ collide: false, ...o, kind });
const PI = Math.PI;

// renkler: açık-orta tonlar (koyu asker silueti öne çıksın); büyük doygun mavi / kırmızı yüzey yok (takım renkleriyle karışmasın)
const YARD = '#b4b0a7', FLOOR = '#aeb0ad', CLAD = '#c9ccc8', ROOF = '#8f9497', BLOCK = '#bcb6aa', CONC = '#c3bfb5', CONC_D = '#9c988f';
const STEEL = '#5f6872', STEEL_D = '#3c4249', ORANGE = '#d9822b', YEL = '#e1b423', WOOD = '#b68b58', CART = '#c49b66', TIRE = '#1f2124';
const MARK_Y = '#e3c02e', MARK_W = '#e4e2da', LAMP = '#fff3d6';
const BOXC = ['#dcd8cd', '#86aba3', '#d5a04a', '#9aa6ad', '#80a06c', '#cdb998', '#b9c4c9'];

// Tabela / zemin harfi (yalnız tarayıcı): ışığa tepki veren düzlem (gece parlamaz)
function textPlane(text, w, h, { fg = '#f2efe6', bg = null, font = 'bold 300px Arial, sans-serif', stroke = null } = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.max(64, Math.round(512 * h / w));
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (stroke) { g.lineWidth = 18; g.strokeStyle = stroke; g.strokeText(text, c.width / 2, c.height / 2 + 6); }
  g.fillStyle = fg; g.fillText(text, c.width / 2, c.height / 2 + 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
}

export function buildDepo() {
  const b = new MapBuilder();
  const rng = makeRng(31);
  b.surface = { ground: () => 0, kindOf: () => DK.PLAIN, seeded: true, material: makeDepoMaterial };
  const signs = [];
  const callouts = [];
  const co = (name, x, z, major = false) => callouts.push({ name, x, z, ...(major ? { major: true } : {}) });

  // ───────── bileşik eşyalar (görsel çarpışmasız, çarpışma = dış zarf) ─────────
  // konteyner: alongX → uzun kenar x boyunca. Gövde + çerçeve kirişleri + kapı ucu kilit çubukları; zarf = 2,44 × 2,59 (+3 cm çerçeve)
  const container = (x, y, z, alongX, len, color) => {
    const W = 2.44, H = 2.59, L = len;
    b.with(x, y, z, alongX ? 0 : PI / 2, () => {
      const fr = new THREE.Color(color).multiplyScalar(0.78).getStyle();
      b.box(0, 0, 0, L, H, W, color, nk(DK.BOX));
      for (const sz of [-1, 1]) {
        b.box(0, 0, sz * (W / 2 + 0.015), L, 0.16, 0.03, fr, nk(DK.BOX));                // alt kiriş
        b.box(0, H - 0.14, sz * (W / 2 + 0.015), L, 0.14, 0.03, fr, nk(DK.BOX));         // üst kiriş
        for (const sx of [-1, 1]) b.box(sx * (L / 2 - 0.09), 0, sz * (W / 2 + 0.015), 0.18, H, 0.03, fr, nk(DK.BOX));   // köşe dikmesi
      }
      for (const zz of [-0.75, -0.35, 0.35, 0.75]) b.box(L / 2 + 0.015, 0.15, zz, 0.03, H - 0.3, 0.05, STEEL, nk(DK.STEEL));   // kapı kilit çubukları
      b.box(L / 2 + 0.008, 0.1, 0, 0.016, H - 0.2, 0.03, STEEL_D, nk(DK.STEEL));                                                 // kapı ortası
      b.collide(0, 0, 0, L + 0.03, H, W + 0.06);
    });
  };
  // sandık: gövde + köşe kuşakları (2 cm), zarf s + 4 cm
  const crate = (x, y, z, s = 1.1, ry = 0) => b.with(x, y, z, ry, () => {
    const dk = '#8e6a40';
    b.box(0, 0, 0, s, s, s, WOOD, nk(DK.WOOD));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(sx * (s / 2 - 0.05), 0, sz * (s / 2 - 0.05), 0.14, s, 0.14, dk, nk(DK.WOOD));
    for (const yy of [0, s - 0.12]) b.box(0, yy, 0, s + 0.02, 0.12, s + 0.02, dk, nk(DK.WOOD));
    b.collide(0, 0, 0, s + 0.02, s, s + 0.02);
  });
  // paletli yük (streçli koli): n kat; palet 0,14 + yük 0,9
  const pallet = (x, z, n = 1, ry = 0, w = 1.2, d = 1.0) => b.with(x, 0, z, ry, () => {
    for (let i = 0; i < n; i++) {
      const y = i * 1.04;
      b.box(0, y, 0, w, 0.03, d, WOOD, nk(DK.WOOD));
      for (const zz of [-d / 2 + 0.06, 0, d / 2 - 0.06]) b.box(0, y + 0.03, zz, w, 0.08, 0.12, '#97733f', nk(DK.WOOD));
      b.box(0, y + 0.11, 0, w, 0.03, d, WOOD, nk(DK.WOOD));
      b.box(0, y + 0.14, 0, w - 0.06, 0.9, d - 0.06, rng() < 0.3 ? '#d8d8d0' : CART, nk(DK.CARTON));
    }
    b.collide(0, 0, 0, w, n * 1.04, d);
  });
  // beton bariyer (jersey): taban + gövde, iki kutu = iki çarpışma
  const jersey = (x, z, alongX = true, len = 3) => b.with(x, 0, z, alongX ? 0 : PI / 2, () => {
    b.box(0, 0, 0, len, 0.32, 0.62, CONC, k(DK.CONC));
    b.box(0, 0.32, 0, len, 0.52, 0.32, CONC, k(DK.CONC));
    for (const sx of [-1, 1]) b.box(sx * (len / 2 - 0.25), 0.62, 0, 0.3, 0.18, 0.33, YEL, nk(DK.MARK));   // uç reflektör boyası (gövde içinde, 5 mm dışarı)
  });
  // varil kümesi (her varil kendi kutusu)
  const drums = (x, z, n = 3) => {
    const cols = ['#3f7d6c', '#c9a227', '#8b9196'];
    const P = [[0, 0], [0.64, 0.1], [0.3, 0.62], [-0.4, 0.55]];
    for (let i = 0; i < n; i++) {
      const [dx, dz] = P[i];
      b.cyl(x + dx, 0, z + dz, 0.3, 0.3, 0.9, cols[(i + Math.round(Math.abs(x))) % 3], { seg: 10, kind: DK.STEEL });
      b.cyl(x + dx, 0.88, z + dz, 0.27, 0.27, 0.03, STEEL_D, { seg: 10, collide: false, kind: DK.STEEL });
    }
  };
  // forklift: yerel +x ileri (çatallar). Gövde, mast, koruma tavanı, çatal: 4 çarpışma kutusu (direkler 6 cm, çarpışmasız)
  const forklift = (x, z, ry, color = YEL) => b.with(x, 0, z, ry, () => {
    b.box(-0.35, 0.18, 0, 1.75, 0.92, 1.12, color, nk(DK.STEEL));                         // gövde
    b.box(-1.15, 0.18, 0, 0.32, 1.02, 1.16, STEEL_D, nk(DK.STEEL));                        // karşı ağırlık
    b.box(-0.45, 1.1, 0, 0.5, 0.42, 0.55, STEEL_D, nk(DK.STEEL));                          // koltuk
    b.box(0.2, 1.1, 0, 0.08, 0.5, 0.08, STEEL_D, nk(DK.STEEL));                            // direksiyon
    for (const [px, pz] of [[-0.85, -0.5], [-0.85, 0.5], [0.35, -0.5], [0.35, 0.5]]) b.box(px, 1.1, pz, 0.06, 1.0, 0.06, STEEL_D, nk(DK.STEEL));
    b.box(-0.25, 2.06, 0, 1.3, 0.08, 1.1, STEEL_D, nk(DK.STEEL));                          // koruma tavanı
    for (const sz of [-1, 1]) b.box(0.66, 0, sz * 0.38, 0.14, 2.35, 0.1, STEEL_D, nk(DK.STEEL));   // mast rayları
    for (const yy of [0.5, 1.4, 2.2]) b.box(0.66, yy, 0, 0.12, 0.1, 0.86, STEEL_D, nk(DK.STEEL));
    b.box(0.78, 0.1, 0, 0.06, 0.8, 0.9, STEEL, nk(DK.STEEL));                              // çatal sırtı
    for (const sz of [-1, 1]) b.box(1.3, 0.05, sz * 0.28, 1.0, 0.08, 0.14, STEEL, nk(DK.STEEL));   // çatallar
    for (const wx of [-0.85, 0.3]) for (const sz of [-1, 1]) b.cyl(wx, 0.3, sz * 0.48, 0.3, 0.3, 0.2, TIRE, { rx: PI / 2, center: true, seg: 10, collide: false, kind: DK.RUBBER });
    b.collide(-0.4, 0, 0, 1.95, 1.2, 1.16);
    b.collide(0.68, 0, 0, 0.22, 2.35, 0.9);
    b.collide(-0.25, 2.04, 0, 1.3, 0.1, 1.1);
    b.collide(1.3, 0, 0, 1.0, 0.13, 0.7);
  });
  // kapalı kasa kamyon: yerel +x ileri (kabin). Kasa + kabin = iki çarpışma kutusu; yan etekler kasanın altını kapatır
  const truck = (x, z, ry) => b.with(x, 0, z, ry, () => {
    const body = '#e2e0d8', cab = '#4f7f8c';
    b.box(-1.1, 0.95, 0, 4.6, 2.4, 2.4, body, nk(DK.BOX));                                // kasa
    b.box(-1.1, 0.35, 0, 4.6, 0.6, 2.3, STEEL_D, nk(DK.STEEL));                            // şasi + yan etek
    b.box(1.55, 0.35, 0, 0.7, 0.6, 2.3, STEEL_D, nk(DK.STEEL));
    b.box(2.15, 0.45, 0, 1.6, 1.25, 2.3, cab, nk(DK.STEEL));                               // kabin alt
    b.box(1.95, 1.7, 0, 1.2, 0.85, 2.3, cab, nk(DK.STEEL));                                // kabin üst
    b.box(2.58, 1.72, 0, 0.04, 0.7, 2.0, '#2b3b44', nk(DK.STEEL));   // ön cam
    for (const sz of [-1, 1]) b.box(2.0, 1.72, sz * 1.153, 0.8, 0.6, 0.01, '#2b3b44', nk(DK.STEEL));                        // yan cam
    b.box(2.97, 0.3, 0, 0.06, 0.25, 2.3, STEEL, nk(DK.STEEL));                             // tampon
    for (const wx of [-2.6, -1.5, 2.2]) for (const sz of [-1, 1]) b.cyl(wx, 0.45, sz * 1.0, 0.45, 0.45, 0.32, TIRE, { rx: PI / 2, center: true, seg: 12, collide: false, kind: DK.RUBBER });
    b.box(-3.415, 1.0, 0, 0.03, 2.3, 2.3, '#cfcdc4', nk(DK.BOX));                          // arka kapı
    for (const zz of [-0.6, 0.6]) b.box(-3.44, 1.1, zz, 0.03, 2.1, 0.05, STEEL, nk(DK.STEEL));
    b.collide(-1.12, 0, 0, 4.66, 3.35, 2.4);
    b.collide(2.0, 0, 0, 2.0, 2.55, 2.32);
  });
  // jeneratör kabini (yerel x boyunca 2,8 m)
  const generator = (x, z, ry) => b.with(x, 0, z, ry, () => {
    b.box(0, 0, 0, 2.9, 0.18, 1.4, STEEL_D, nk(DK.STEEL));
    b.box(0, 0.18, 0, 2.8, 1.62, 1.3, '#7f9a74', nk(DK.STEEL));
    for (let i = 0; i < 6; i++) b.box(-0.9 + i * 0.36, 0.7, 0.655, 0.22, 0.8, 0.012, STEEL_D, nk(DK.STEEL));   // havalandırma
    b.cyl(1.0, 1.8, 0.3, 0.1, 0.1, 0.55, STEEL_D, { seg: 8, kind: DK.STEEL });            // egzoz (kendi kutusu)
    b.collide(0, 0, 0, 2.9, 1.8, 1.4);
  });
  // çöp konteyneri
  const dumpster = (x, z, ry) => b.with(x, 0, z, ry, () => {
    b.box(0, 0.12, 0, 2.2, 1.2, 1.2, '#4f6f5a', nk(DK.BOX));
    b.box(0, 1.32, 0, 2.26, 0.07, 1.26, '#3d5546', nk(DK.STEEL));
    for (const sx of [-0.9, 0.9]) for (const sz of [-0.45, 0.45]) b.box(sx, 0, sz, 0.14, 0.12, 0.14, TIRE, nk(DK.RUBBER));
    b.collide(0, 0, 0, 2.26, 1.39, 1.26);
  });
  // aydınlatma direği (yalnız direk + kafa; direğin kendi kutusu)
  const pole = (x, z, ry) => {
    b.box(x, 0, z, 0.36, 0.3, 0.36, CONC_D, k(DK.CONC));
    b.box(x, 0.3, z, 0.18, 7.2, 0.18, STEEL, k(DK.STEEL));
    b.with(x, 7.3, z, ry, () => { b.box(0.45, 0, 0, 0.9, 0.12, 0.12, STEEL, nk(DK.STEEL)); b.box(0.95, -0.12, 0, 0.5, 0.14, 0.32, STEEL_D, nk(DK.STEEL)); b.box(0.95, -0.14, 0, 0.42, 0.02, 0.26, LAMP, { collide: false, o: { glow: true } }); });
  };
  // depo içi raf: x0..x1, zc merkezli, derinlik 1,1, yükseklik 3,4. Çarpışma tek kutu; görselde ortada sac arka pano (arası görünmez) + dikme, kiriş, yükler
  const rack = (x0, x1, zc, D = 1.1, H = 3.4) => {
    const L = x1 - x0, nb = Math.max(1, Math.round(L / 2.5)), bw = L / nb;
    b.box((x0 + x1) / 2, 0, zc, L - 0.1, H - 0.05, 0.04, '#8a9097', nk(DK.STEEL));                 // arka pano
    for (let i = 0; i <= nb; i++) for (const sz of [-1, 1]) b.box(x0 + i * bw + (i === 0 ? 0.05 : i === nb ? -0.05 : 0), 0, zc + sz * (D / 2 - 0.04), 0.1, H, 0.08, STEEL, nk(DK.STEEL));   // dikmeler
    for (const yy of [0.1, 1.3, 2.6]) for (const sz of [-1, 1]) b.box((x0 + x1) / 2, yy, zc + sz * (D / 2 - 0.05), L, 0.12, 0.1, ORANGE, nk(DK.STEEL));   // kirişler
    for (let i = 0; i < nb; i++) for (const [y0, y1] of [[0.22, 1.28], [1.42, 2.58], [2.72, 3.34]]) for (const sz of [-1, 1]) {
      let cx = x0 + i * bw + 0.12; const end = x0 + (i + 1) * bw - 0.12;
      while (cx < end - 0.3) {
        const w = Math.min(end - cx, 0.7 + rng() * 0.6), hh = (y1 - y0) * (0.55 + rng() * 0.45);
        if (rng() < 0.86) b.box(cx + w / 2, y0, zc + sz * (D / 4 + 0.01), w - 0.04, hh, D / 2 - 0.12, rng() < 0.25 ? '#d6d6ce' : CART, nk(DK.CARTON));
        cx += w;
      }
    }
    b.collide((x0 + x1) / 2, 0, zc, L, H, D);
  };
  // bollard (kapı yanı sarı direk)
  const bollard = (x, z) => b.cyl(x, 0, z, 0.13, 0.13, 1.0, YEL, { seg: 8, kind: DK.STEEL });

  // ───────── zemin ─────────
  b.box(0, -0.6, 0, 420, 0.58, 420, '#6f7069', nk(DK.ASPH));                            // dış: asfalt / toprak (avlunun 2 cm altında)
  b.box(0, -0.4, 0, 61.2, 0.4, 69.2, YARD, nk(DK.YARD));                                 // avlu beton levhaları (üstü y = 0)
  const line = (x0, z0, x1, z1, c = MARK_Y, w = 0.14) => b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, Math.max(w, Math.abs(x1 - x0)), 0.012, Math.max(w, Math.abs(z1 - z0)), c, nk(DK.MARK));
  // avlu yaya / forklift yolu çizgileri (iki yanda simetrik)
  for (const s of [-1, 1]) {
    line(-29, s * 20.6, 29, s * 20.6, MARK_Y);
    line(-12.6, s * 9.6, 12.6, s * 9.6, MARK_Y);
    for (let x = -26; x <= 26; x += 4) if (Math.abs(x) > 3) line(x - 0.9, s * 18.4, x + 0.9, s * 18.4, MARK_W, 0.18);       // kesik orta çizgi
  }
  for (const sx of [-1, 1]) { line(sx * 12.6, -9.6, sx * 12.6, 9.6, MARK_Y); for (let z = -18; z <= 18; z += 4) line(sx * 28.4, z - 0.9, sx * 28.4, z + 0.9, MARK_W, 0.18); }

  // ───────── çevre duvarı (beton blok, 4,6 m; iç yüz = sınır) ─────────
  b.withKind(DK.BLOCK, () => {
    const WH = 4.6, T = 0.6, B = DEPO_BOUNDS;
    b.box(0, 0, B.minZ - T / 2, 61.2 + 0.0, WH, T, BLOCK);
    b.box(0, 0, B.maxZ + T / 2, 61.2, WH, T, BLOCK);
    b.box(B.minX - T / 2, 0, 0, T, WH, 68, BLOCK);
    b.box(B.maxX + T / 2, 0, 0, T, WH, 68, BLOCK);
    for (const zz of [B.minZ - T / 2, B.maxZ + T / 2]) b.box(0, WH, zz, 61.2, 0.18, T + 0.02, CONC_D, NC);       // kaplama (duvarın tepesinde, ulaşılmaz)
    for (const xx of [B.minX - T / 2, B.maxX + T / 2]) b.box(xx, WH, 0, T + 0.02, 0.18, 69.2, CONC_D, NC);
    for (let x = -24; x <= 24; x += 8) for (const zz of [B.minZ + 0.12, B.maxZ - 0.12]) b.box(x, 0, zz, 0.5, WH, 0.24, CONC_D);   // payandalar (kendi kutuları)
    for (let z = -28; z <= 28; z += 8) for (const xx of [B.minX + 0.12, B.maxX - 0.12]) b.box(xx, 0, z, 0.24, WH, 0.5, CONC_D);
  });

  // ───────── DEPO (B) ─────────
  const H = 7.5, WT = 0.4;
  const DOOR_NS = [{ at: -6, w: 4, b: 0, top: 4.2 }, { at: 6, w: 4, b: 0, top: 4.2 }];
  b.obj('depo:kabuk', () => b.shell(-12, 12, -9, 9, 0, H, WT, CLAD, {
    n: DOOR_NS, s: DOOR_NS,
    w: [{ at: 0, w: 3.2, b: 0, top: 3.4 }],
    e: [{ at: -6.4, w: 2.6, b: 0, top: 3.2 }, { at: 6.4, w: 2.6, b: 0, top: 3.2 }],
  }, k(DK.CLAD)));
  // köşe dikmeleri (dış köşede, kendi kutuları) + saçak
  for (const [cx, cz] of [[-12, -9], [12, -9], [-12, 9], [12, 9]]) b.box(cx, 0, cz, 0.6, H, 0.6, STEEL, k(DK.STEEL));
  // kapıların üstünde sarılmış kepenk (açıklığın üst 0,5 m'si, duvar kalınlığında) + yanlarda sarı bollard
  const shutter = (axis, at, c, w, top) => {
    if (axis === 'x') b.box(at, top - 0.5, c, w, 0.5, WT - 0.04, '#9ea4a8', k(DK.STEEL));
    else b.box(c, top - 0.5, at, WT - 0.04, 0.5, w, '#9ea4a8', k(DK.STEEL));
  };
  for (const zz of [-9, 9]) for (const d of DOOR_NS) { shutter('x', d.at, zz, d.w, d.top); for (const sx of [-1, 1]) bollard(d.at + sx * (d.w / 2 + 0.3), zz + Math.sign(zz) * 0.55); }
  shutter('z', 0, -12, 3.2, 3.4); for (const sz of [-1, 1]) bollard(-12.55, sz * 1.9);
  for (const zz of [-6.4, 6.4]) { shutter('z', zz, 12, 2.6, 3.2); for (const sz of [-1, 1]) bollard(12.55, zz + sz * 1.6); }
  // çatı: 3 ışıklık şeridi (x = −7 / 0 / 7, 1,6 m) arasında sac şeritler; ışıklık camı çarpışmasız (ulaşılmaz)
  b.withKind(DK.ROOF, () => {
    const RY = H, RT = 0.3, X = [-12.2, -7.8, -6.2, -0.8, 0.8, 6.2, 7.8, 12.2], ZL = 6.5;
    for (let i = 0; i < X.length - 1; i++) {
      const x0 = X[i], x1 = X[i + 1];
      if (i % 2 === 0) b.box((x0 + x1) / 2, RY, 0, x1 - x0, RT, 18.4, ROOF, { tag: 'roof' });
      else for (const s of [-1, 1]) b.box((x0 + x1) / 2, RY, s * (ZL + 9.2) / 2, x1 - x0, RT, 9.2 - ZL, ROOF, { tag: 'roof' });
    }
    for (const xc of [-7, 0, 7]) b.box(xc, RY + 0.12, 0, 1.6, 0.03, ZL * 2, '#cfe4ea', { collide: false, o: { transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0.1 } });
    for (const s of [-1, 1]) b.box(0, RY + RT, s * 9.05, 24.4, 0.25, 0.3, STEEL, { kind: DK.STEEL });                  // saçak / oluk (çatının üstünde, kendi kutusu)
  });
  // çatı makasları (iç tavan, ulaşılmaz ama mermi çarpar: kendi kutuları)
  for (const xb of [-10.4, -3.6, 3.6, 10.4]) b.box(xb, H - 0.55, 0, 0.26, 0.55, 17.6, STEEL, k(DK.STEEL));
  for (const zb of [-4.4, 4.4]) b.box(0, H - 0.35, zb, 23.6, 0.2, 0.16, STEEL, k(DK.STEEL));
  // iç zemin (epoksi beton, 1,5 cm) + şerit çizgileri
  b.box(0, 0, 0, 23.6, 0.015, 17.6, FLOOR, nk(DK.FLOOR));
  const fl = (x0, z0, x1, z1, c = MARK_Y, w = 0.12) => b.box((x0 + x1) / 2, 0.015, (z0 + z1) / 2, Math.max(w, Math.abs(x1 - x0)), 0.008, Math.max(w, Math.abs(z1 - z0)), c, nk(DK.MARK));
  for (const s of [-1, 1]) { fl(-11.2, s * 3.9, 4.8, s * 3.9); fl(-11.2, s * 6.0, 7.8, s * 6.0, MARK_W, 0.08); }
  for (const sx of [-1, 1]) fl(sx * 1.9, -3.9, sx * 1.9, 3.9);
  // lambalar (makaslardan sarkar; parlak kutu + askı)
  for (const lx of [-10.4, -3.6, 3.6, 10.4]) for (const lz of [-6.9, 0, 6.9]) {
    b.box(lx, H - 1.35, lz, 0.03, 0.8, 0.03, STEEL_D, NC);
    b.box(lx, H - 1.5, lz, 0.9, 0.15, 0.3, STEEL_D, NC);
    b.box(lx, H - 1.52, lz, 0.8, 0.02, 0.22, LAMP, { collide: false, o: { glow: true } });
  }
  // raflar: kuzey / güney sıra (z = ±5), batı uzun + doğu kısa parça; orta şerit (x −2,2…2,2) açık
  for (const s of [-1, 1]) { rack(-9.6, -2.2, s * 5.0); rack(2.2, 5.6, s * 5.0); }
  // asma kat (doğu duvarı): dolu beton blok kaide + çelik tabliye (tek 'plat' kutusu), iki uçtan merdiven (batıya iner), korkuluk paneli
  const MZ = { x0: 8.6, x1: 11.8, z0: -3.0, z1: 3.0, y: 3.0 };
  b.obj('asma-kat', () => {
    b.box((MZ.x0 + MZ.x1) / 2, 0, 0, MZ.x1 - MZ.x0, MZ.y - 0.22, MZ.z1 - MZ.z0, BLOCK, nk(DK.BLOCK));
    b.box((MZ.x0 + MZ.x1) / 2, MZ.y - 0.22, 0, MZ.x1 - MZ.x0, 0.22, MZ.z1 - MZ.z0, STEEL, nk(DK.STEEL));
    b.box(MZ.x0 - 0.005, MZ.y - 0.2, 0, 0.01, 0.16, MZ.z1 - MZ.z0, YEL, NC);                // tabliye ucu sarı-siyah boya şeridi
    for (let z = MZ.z0 + 0.2; z < MZ.z1 - 0.2; z += 0.5) b.box(MZ.x0 - 0.008, MZ.y - 0.2, z, 0.012, 0.16, 0.22, '#222', NC);
    b.collide((MZ.x0 + MZ.x1) / 2, 0, 0, MZ.x1 - MZ.x0, MZ.y, MZ.z1 - MZ.z0, 'plat');
    const pan = (x0, x1, z0, z1) => { b.box((x0 + x1) / 2, MZ.y, (z0 + z1) / 2, x1 - x0, 0.95, z1 - z0, '#8a939b', nk(DK.STEEL)); b.box((x0 + x1) / 2, MZ.y + 0.95, (z0 + z1) / 2, x1 - x0 + 0.02, 0.1, z1 - z0 + 0.02, YEL, nk(DK.STEEL)); b.collide((x0 + x1) / 2, MZ.y, (z0 + z1) / 2, x1 - x0 + 0.02, 1.05, z1 - z0 + 0.02); };
    pan(MZ.x0, MZ.x0 + 0.12, -1.6, 1.6);                                                     // batı (B'ye bakan) korkuluk paneli
    for (const s of [-1, 1]) pan(9.6, MZ.x1, s > 0 ? MZ.z1 - 0.12 : MZ.z0, s > 0 ? MZ.z1 : MZ.z0 + 0.12);   // kuzey / güney kenar (merdiven ağzı açık)
    crate(11.15, MZ.y, 0, 0.9);
    for (const s of [-1, 1]) b.stairs(5.2, s * 2.3, 0, '+x', 1.4, 10, 0.3, 0.34, '#59626b', { tag: 'plat' });
  });
  // depo içi siper: forklift (batı kapı hattını keser), sandık / palet halkası (B çevresi)
  forklift(-5.3, 0, 0, YEL);
  for (const s of [-1, 1]) { crate(-2.6, 0, s * 2.7, 1.1); pallet(2.2, s * 2.4, 1, 0); pallet(-9.0, s * 2.6, 2, PI / 2); crate(6.9, 0, s * 7.3, 1.1); }
  crate(-9.0, 2.08, 2.6, 0.9);
  co('B · Depo', 0, 0); co('Asma kat', 10.2, 0); co('Batı kapı', -13.6, 0); co('Kuzey raflar', -4, -7); co('Güney raflar', -4, 7);
  co('Doğu kapı K', 13.8, -6.4); co('Doğu kapı G', 13.8, 6.4); co('Merdivenler', 6.4, 0);

  // ───────── A — batı konteyner sahası ─────────
  for (const s of [-1, 1]) {
    container(-21.5, 0, s * 10.6, true, 6.1, s < 0 ? BOXC[1] : BOXC[2]);
    jersey(-20.5, s * 4.2, true, 3);
    pallet(-24.8, s * 6.4, 1, 0);
    crate(-15.6, 0, s * 3.4, 1.2); crate(-15.6, 0, s * 4.65, 1.2); crate(-15.6, 1.2, s * 4.0, 1.1);
    drums(-14.0, s * 14.0, 3);
  }
  container(-27.2, 0, 0, false, 6.1, BOXC[0]); container(-27.2, 2.59, 0, false, 6.1, BOXC[3]);       // batı duvarı önünde iki katlı konteyner (A arkası)
  co('A · Konteyner sahası', -20.5, 0); co('A arkası', -27, 4.5); co('A kuzey konteyner', -21.5, -13); co('A güney konteyner', -21.5, 13); co('Sandıklar', -15.6, 4);

  // ───────── C — doğu yükleme alanı ─────────
  truck(25.6, 0, PI / 2);                                                                  // kuzeye bakan kamyon (kabin kuzeyde)
  for (const s of [-1, 1]) {
    forklift(16.6, s * 5.6, s < 0 ? PI : 0, s < 0 ? YEL : '#d77f2a');
    for (let i = 0; i < 3; i++) pallet(19.6 + i * 1.0, s * 10.6, 2, PI / 2, 1.2, 1.0);
    crate(21.6, 0, s * 4.4, 1.1); crate(22.75, 0, s * 4.1, 1.1);
    generator(27.6, s * 13.2, PI / 2);
    drums(14.1, s * 14.0, 3);
  }
  co('C · Yükleme', 20.5, 0); co('Kamyon', 25.6, 0); co('Palet yığını K', 20.8, -10.6); co('Palet yığını G', 20.8, 10.6);

  // ───────── orta avlular (depo ile doğuş sırası arası) + köşeler ─────────
  for (const s of [-1, 1]) {
    container(0, 0, s * 15.4, true, 6.1, s < 0 ? BOXC[4] : BOXC[6]);
    pallet(-7.6, s * 13.0, 1, 0); pallet(7.6, s * 13.0, 1, PI / 2);
    jersey(-8.2, s * 18.0, true, 3); jersey(8.2, s * 18.0, true, 3);
    crate(-15.4, 0, s * 17.0, 1.1); crate(15.4, 0, s * 17.0, 1.1);
    if (s > 0) { dumpster(-24.2, s * 17.6, 0); generator(24.2, s * 17.6, 0); } else { generator(-24.2, s * 17.6, 0); dumpster(24.2, s * 17.6, 0); }
    co(s > 0 ? 'Güney avlu' : 'Kuzey avlu', 0, s * 13);
    co(s > 0 ? 'GB köşe' : 'KB köşe', -24.5, s * 17); co(s > 0 ? 'GD köşe' : 'KD köşe', 24.5, s * 17);
  }
  for (const [x, z, ry] of [[-28.6, -16, 0], [28.6, -16, PI], [-28.6, 16, 0], [28.6, 16, PI]]) pole(x, z, ry);

  // ───────── doğuş sıraları: konteyner hattı (z = ±22,8) 3 açıklıklı + açıklık arkasında perde konteyner ─────────
  const ROW = [[-30, -25.5], [-21.5, -15.0], [-15.0, -8.5], [-8.5, -2.0], [2.0, 8.5], [8.5, 15.0], [15.0, 21.5], [25.5, 30]];
  for (const s of [-1, 1]) {
    ROW.forEach(([x0, x1], i) => {
      container((x0 + x1) / 2, 0, s * 22.8, true, x1 - x0 - 0.03, BOXC[(i * 3 + (s > 0 ? 0 : 2)) % BOXC.length]);
      if (i === 0 || i === 2 || i === 5 || i === 7) container((x0 + x1) / 2, 2.59, s * 22.8, true, x1 - x0 - 0.03, BOXC[(i * 5 + 1) % BOXC.length]);   // iki katlı (silüet)
    });
    for (const xc of [-23.5, 0, 23.5]) container(xc, 0, s * 27.9, true, xc === 0 ? 6.1 : 7.4, BOXC[(Math.abs(xc) / 23.5 * 2 + (s > 0 ? 3 : 5)) % BOXC.length]);
    // doğuş zemini: takım rengi şeritler (soluk)
    const tc = s > 0 ? '#5d8fc4' : '#c46a5a';
    line(-27, s * 30.0, 27, s * 30.0, tc, 0.2); line(-27, s * 33.3, 27, s * 33.3, tc, 0.2);
    for (let x = -27; x <= 27; x += 6) line(x, s * 30.0, x, s * 33.3, tc, 0.14);
    co(s > 0 ? 'Mavi doğuş' : 'Kırmızı doğuş', 0, s * 30.5);
    co(s > 0 ? 'Mavi batı çıkışı' : 'Kırmızı batı çıkışı', -23.5, s * 24.5); co(s > 0 ? 'Mavi doğu çıkışı' : 'Kırmızı doğu çıkışı', 23.5, s * 24.5);
  }

  // ───────── dış silüet (çarpışmasız; duvar dışı, ulaşılamaz): komşu depolar, vinç, baca ─────────
  const nCol = b.colliders.length;
  b.withKind(DK.CLAD, () => {
    for (const [x, z, w, h, d, c] of [[-50, -10, 18, 11, 34, '#a9adab'], [-48, 36, 22, 8, 18, '#b6b2a6'], [50, 8, 18, 13, 40, '#a4aaad'], [46, -42, 26, 9, 16, '#b3b6b0'],
      [-10, -54, 34, 10, 18, '#aeb2b0'], [22, -50, 16, 7, 12, '#bdb7a9'], [8, 54, 40, 9, 18, '#a8aeb0'], [-30, 52, 14, 12, 14, '#b5b1a5'], [42, 46, 16, 10, 14, '#aaaea8']]) {
      b.box(x, 0, z, w, h, d, c, NC);
      b.box(x, h, z, w + 0.4, 0.4, d + 0.4, ROOF, nk(DK.ROOF));
    }
  });
  b.withKind(DK.STEEL, () => {
    for (const x of [-16, 10]) b.box(x, 0, -44, 0.8, 16, 0.8, ORANGE, NC);          // portal vinç (kuzey)
    for (const x of [-16, 10]) b.box(x, 0, -37, 0.8, 16, 0.8, ORANGE, NC);
    b.box(-3, 16, -40.5, 28, 1.2, 1.0, ORANGE, NC); b.box(-3, 16, -40.5, 1.0, 1.2, 8.0, ORANGE, NC);
    b.cyl(56, 0, -20, 1.4, 1.8, 30, '#9c9a94', { seg: 12, collide: false, kind: DK.CONC });   // baca
  });
  b.colliders.length = nCol;

  // ───────── doğuş noktaları ─────────
  const spawns = { blue: [], red: [] };
  for (const z of [31.0, 32.9]) for (let x = -27; x <= 27; x += 3) {
    spawns.blue.push({ x, z, ry: 0 });
    spawns.red.push({ x, z: -z, ry: PI });
  }
  const order = (a) => a.sort((p, q) => Math.abs(p.x) - Math.abs(q.x) || p.z - q.z);       // ilki merkez (ikmal noktası)
  order(spawns.blue); order(spawns.red);

  const objectives = [
    { id: 'a', name: 'A Konteyner', label: 'A', x: -20.5, z: 0, r: 6, core: true },
    { id: 'b', name: 'B Depo', label: 'B', x: 0, z: 0, r: 5, core: true },
    { id: 'c', name: 'C Yükleme', label: 'C', x: 20.5, z: 0, r: 6, core: true },
  ];

  const group = b.build();
  if (typeof document !== 'undefined' && !MapBuilder.noVisual) {
    const add = (m, x, y, z, ry = 0, rx = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.renderOrder = 2; group.add(m); };
    add(textPlane('A', 3.0, 3.0, { fg: '#f3efe2', bg: '#3a5560', font: 'bold 400px Arial, sans-serif' }), -12.215, 5.1, 0, -PI / 2);      // hedef harfi: kapının üstünde koyu pano
    add(textPlane('C', 3.0, 3.0, { fg: '#f3efe2', bg: '#3a5560', font: 'bold 400px Arial, sans-serif' }), 12.215, 5.1, 0, PI / 2);
    add(textPlane('B', 3.6, 3.6, { fg: '#e3c02e' }), 0, 0.03, 0, 0, -PI / 2);
    for (const s of [-1, 1]) add(textPlane('DEPO 3', 7, 1.6, { fg: '#f3efe2', bg: '#3a5560', font: 'bold 150px Arial, sans-serif' }), 0, 5.4, s * 9.215, s > 0 ? 0 : PI);
  }

  return {
    id: 'depo',
    name: 'Depo',
    group,
    colliders: b.colliders,
    sight: b.sight,
    bounds: DEPO_BOUNDS,
    layered: true,                                                   // asma kat + merdiven: yol bulma hücre başına zemin kotu tutar
    callouts,
    roamPoints: [[-20.5, 0], [0, 0], [20.5, 0], [10.2, 0], [-13.6, 0], [13.8, -6.4], [13.8, 6.4], [-4, -7], [-4, 7], [0, -12.5], [0, 12.5], [-22, -15.5], [-22, 15.5], [22, -15.5], [22, 15.5], [-27, 6], [27, -6]],
    mini: { bg: '#8f8b82', ground: [180, 176, 167], wall: '#3e464d', mid: '#5c656d', low: '#7d8288', roof: 'rgba(70,78,86,0.32)' },
    spawns,
    baseZones: {
      blue: { minX: -30, maxX: 30, minZ: 24.1, maxZ: 34 },
      red: { minX: -30, maxX: 30, minZ: -34, maxZ: -24.1 },
    },
    objectives,
    roads: [],
    env: {
      sky: ['#5f9bd3', '#b2cfe4', '#e6e4dc'], fog: ['#d3dade', 95, 330],
      sun: ['#fff0d4', 2.6], hemi: ['#d2e2f2', '#8c8574', 1.25], cloud: '#f4f6f8', clouds: 16,
      sunPos: [38, 80, 26],
    },
  };
}
