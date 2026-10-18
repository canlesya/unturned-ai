import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import { MK, makeMadenMaterial } from './madenSurface.js';
import { makeTrack } from '../game/track.js';

// "Maden Ocağı" — Vagon modu haritası (96 × 72 m, 5v5–8v8). Kayalık bir maden vadisi; patlayıcı yüklü vagon güneybatıdaki yükleme avlusundan
// kuzeydoğudaki maden ağzına raylarla gider: Kırma Tesisi → A · Makas (1. kontrol) → köy caddesi → B · Kantar (2. kontrol) → Lavvar → C · Maden Ağzı.
// Saldıran Mavi, savunan Kırmızı. Kontrol noktası geçildikçe iki takımın doğuş avlusu ileri kayar (plStages): avlular aşamalar arasında el değiştirir
// (1. kontrolden sonra Mavi A'nın yanındaki Ambar'da doğar · kuzey avlusu: önce Kırmızı, sonra Mavi). Avlular 3 m taş duvarlı, her birinin ≥ 3 çıkışı var.
// Kural: görünen her katı parçanın çarpışması birebir (bileşik eşyada görsel parçalar çarpışmasız, çarpışma = dış zarf); görünmez engel yok; çatılara çıkılmaz.
// Çizim: düz parçalar tek ağ (madenSurface gölgelendiricisi) + lamba (parlak) + cam + tabelalar + maden kapısı.

export const MADEN_BOUNDS = { minX: -48, maxX: 48, minZ: -36, maxZ: 36 };
// Ray: eksen hizalı köşe noktaları (köşede 2,5 m yay). Vagon x = −34'ten başlar; kontrol noktaları 2. ve 4. köşe yayının ortası; uç = maden kapısının önü.
export const MADEN_TRACK = [[-46, 26], [-18, 26], [-18, 6], [8, 6], [8, -16], [30, -16], [30, -31]];
const NC = { collide: false };
const k = (kind, o = {}) => ({ ...o, kind }), nk = (kind, o = {}) => ({ collide: false, ...o, kind });
const PI = Math.PI, P2 = PI / 2;

// renkler: toprak / ahşap / taş; büyük doygun mavi-kırmızı yüzey yok (takım renkleri ve vagon öne çıksın)
const DIRT = '#a3876a', GRAVEL = '#8a8174', PAVE = '#a39a8b', STONEC = '#9a9285', ROCK = '#7f6a57', ROCK2 = '#8b7560', ROCK3 = '#735f4e';
const TIN = '#8e9190', TILE = '#97674c', STEEL = '#5b6168', STEEL_D = '#3a3e44', WOOD = '#a07a4c', WOOD_D = '#7a5a36', BEAM = '#6e5233';
const ORE = '#5f5852', ORE_R = '#86624a', LAMP = '#ffe2a8', CONC = '#aaa498', MARK = '#e0c040';
const HOUSE = ['#a2825c', '#8f7354', '#b0956c', '#7f8a7e', '#b59a64', '#8a7b6a'];

// Tabela / zemin harfi (yalnız tarayıcı): ışığa tepki veren düzlem
function textPlane(text, w, h, { fg = '#f2ead8', bg = null, font = 'bold 300px Arial, sans-serif', stroke = null } = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.max(64, Math.round(512 * h / w));
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = 'rgba(255,240,210,.55)'; g.lineWidth = 10; g.strokeRect(8, 8, c.width - 16, c.height - 16); }
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fit = Math.min(c.width * 0.86 / Math.max(1, g.measureText(text).width), c.height * 0.8 / (+/(\d+)px/.exec(font)[1]));   // yazı tabelaya sığsın
  if (fit < 1) g.font = font.replace(/(\d+)px/, (_, n) => Math.floor(n * fit) + 'px');
  if (stroke) { g.lineWidth = 18; g.strokeStyle = stroke; g.strokeText(text, c.width / 2, c.height / 2 + 6); }
  g.fillStyle = fg; g.fillText(text, c.width / 2, c.height / 2 + 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
}

export function buildMaden() {
  const b = new MapBuilder();
  const rng = makeRng(77);
  b.surface = { ground: () => 0, kindOf: () => MK.PLAIN, seeded: true, material: makeMadenMaterial };
  const callouts = [];
  const co = (name, x, z, major = false) => callouts.push({ name, x, z, ...(major ? { major: true } : {}) });
  const track = makeTrack(MADEN_TRACK, 2.5);

  // ───────── bileşik eşyalar (görsel çarpışmasız, çarpışma = dış zarf) ─────────
  const crate = (x, y, z, s = 1.1, ry = 0) => b.with(x, y, z, ry, () => {
    b.box(0, 0, 0, s, s, s, WOOD, nk(MK.WOOD));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(sx * (s / 2 - 0.05), 0, sz * (s / 2 - 0.05), 0.12, s, 0.12, WOOD_D, nk(MK.WOOD));
    for (const yy of [0, s - 0.1]) b.box(0, yy, 0, s + 0.02, 0.1, s + 0.02, WOOD_D, nk(MK.WOOD));
    b.collide(0, 0, 0, s + 0.02, s, s + 0.02);
  });
  // varil (her biri kendi silindir kutusu)
  const barrel = (x, z, col = '#6b5a3c') => { b.cyl(x, 0, z, 0.3, 0.3, 0.92, col, { seg: 10, kind: MK.STEEL }); b.cyl(x, 0.9, z, 0.27, 0.27, 0.03, STEEL_D, { seg: 10, collide: false, kind: MK.STEEL }); };
  // istif travers / kereste: n kat, uzun eksen x (ry ile döner); tek çarpışma kutusu
  const timber = (x, z, L = 3, n = 3, ry = 0) => b.with(x, 0, z, ry, () => {
    for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) b.box(0, i * 0.24, -0.45 + j * 0.3, L - (i % 2) * 0.2, 0.22, 0.26, i % 2 ? WOOD : WOOD_D, nk(MK.WOOD));
    b.collide(0, 0, 0, L, n * 0.24, 1.2);
  });
  // cevher yığını: kademeli kutular (çarpışma = kademe), tepesi 1,6 m (üstüne çıkılır ama avantaj küçük)
  const orePile = (x, z, w, d, col = ORE) => {
    const H = [0.55, 0.5, 0.45];
    let y = 0;
    for (let i = 0; i < 3; i++) { const f = 1 - i * 0.28; b.box(x, y, z, w * f, H[i], d * f, i ? col : new THREE.Color(col).multiplyScalar(0.92).getStyle(), k(MK.ORE)); y += H[i]; }
  };
  // terk edilmiş cevher vagonu (sabit): kasa + tekerlek + bant; zarf 1,5 × 1,3 × 2,1
  const oldWagon = (x, z, ry = 0) => b.with(x, 0, z, ry, () => {
    b.box(0, 0.12, 0, 1.2, 0.3, 2.0, STEEL_D, nk(MK.STEEL));
    b.box(0, 0.42, 0, 1.5, 0.88, 2.1, '#6a5446', nk(MK.STEEL));
    b.box(0, 1.28, 0, 1.3, 0.02, 1.9, ORE, nk(MK.ORE));
    for (const zz of [-0.7, 0, 0.7]) b.box(0, 0.42, zz, 1.53, 0.86, 0.08, '#4c3b30', nk(MK.STEEL));
    for (const sx of [-0.62, 0.62]) for (const zz of [-0.65, 0.65]) b.cyl(sx, 0.24, zz, 0.24, 0.24, 0.12, STEEL_D, { rz: P2, center: true, seg: 10, collide: false, kind: MK.STEEL });
    b.collide(0, 0, 0, 1.53, 1.3, 2.1);
  });
  // taş duvar (avlu): wall + kapak taşı (duvarın üstünde, ulaşılmaz)
  const stoneWall = (axis, a0, a1, c, h, ops = []) => {
    b.wall(axis, a0, a1, c, 0, h, 0.6, STONEC, ops, k(MK.STONE));
    if (axis === 'x') b.box((a0 + a1) / 2, h, c, a1 - a0 + 0.1, 0.14, 0.72, '#857d71', nk(MK.STONE));
    else b.box(c, h, (a0 + a1) / 2, 0.72, 0.14, a1 - a0 + 0.1, '#857d71', nk(MK.STONE));
  };
  // alçak taş siper (0,95 m): kendi kutusu
  const lowWall = (x, z, w, d) => { b.box(x, 0, z, w, 0.95, d, STONEC, k(MK.STONE)); b.box(x, 0.95, z, w + 0.06, 0.08, d + 0.06, '#857d71', nk(MK.STONE)); };
  // kaya kütlesi = taş ocağı basamakları: her kademe bir öncekinin üstüne oturur, haritaya bakan yüzlerden (faces: 'n' z0 · 's' z1 · 'w' x0 · 'e' x1) step kadar geri çekilir.
  // Kademe uzun ekseni boyunca 3,5–6,5 m'lik bloklar (tepe ±0,5 m); iç yüz düz (cep yok), en alt kademe ≥ 4 m (çıkılmaz). Arka yüzler 2 cm kayık (z-fighting yok).
  const bench = (x0, x1, z0, z1, faces, hs, step = 3) => {
    const along = x1 - x0 >= z1 - z0 ? 'x' : 'z';
    hs.forEach((h, i) => {
      const f = (sd) => (faces.includes(sd) ? i * step : i * 0.02);
      const X0 = x0 + f('w'), X1 = x1 - f('e'), Z0 = z0 + f('n'), Z1 = z1 - f('s');
      if (X1 - X0 < 1 || Z1 - Z0 < 1) return;
      const y0 = i ? hs[i - 1] - 0.6 : 0, L = along === 'x' ? X1 - X0 : Z1 - Z0;
      let a = 0;
      while (a < L - 0.01) {
        const w = L - a < 8 ? L - a : 3.5 + rng() * 3, top = h + (rng() - 0.5) * (i ? 1.2 : 0.8), c = [ROCK, ROCK2, ROCK3][Math.floor(rng() * 3)];
        if (along === 'x') b.box(X0 + a + w / 2, y0, (Z0 + Z1) / 2, w, top - y0, Z1 - Z0, c, k(MK.ROCK));
        else b.box((X0 + X1) / 2, y0, Z0 + a + w / 2, X1 - X0, top - y0, w, c, k(MK.ROCK));
        a += w;
      }
    });
  };
  // çam (yalnız kaya tepesinde / sınır dışında; ulaşılmaz, çarpışmasız)
  const pine = (x, y, z, s = 1) => {
    b.cyl(x, y, z, 0.16 * s, 0.22 * s, 1.4 * s, '#5d4632', NC);
    for (let i = 0; i < 3; i++) b.cyl(x, y + (1.0 + i * 1.05) * s, z, 0.05, (1.5 - i * 0.38) * s, 1.6 * s, i % 2 ? '#3f5a3a' : '#466343', NC);
  };
  // ahşap direkli lamba (direk kendi kutusu, kol + lamba çarpışmasız; kol direğin üstünde, ulaşılmaz)
  const lamp = (x, z, ry = 0) => {
    b.box(x, 0, z, 0.22, 5.2, 0.22, BEAM, k(MK.WOOD));
    b.with(x, 5.0, z, ry, () => { b.box(0.45, 0, 0, 0.9, 0.12, 0.12, BEAM, nk(MK.WOOD)); b.box(0.85, -0.25, 0, 0.3, 0.25, 0.3, STEEL_D, nk(MK.STEEL)); b.box(0.85, -0.27, 0, 0.24, 0.03, 0.24, LAMP, { collide: false, o: { glow: true } }); });
  };
  // ev: taş kaideli bindirme tahta cephe (gölgelendirici), kapı / pencere açıklıkları, kiremit ya da sac beşik çatı (çarpışma kademeli 'roof', ulaşılmaz)
  const house = (id, x0, x1, z0, z1, { col = HOUSE[0], h = 3.2, ops = {}, roof = 'tile', inner } = {}) => b.obj('ev:' + id, () => {
    b.shell(x0, x1, z0, z1, 0, h, 0.3, col, ops, k(MK.PLANK, { trim: '#d9cdb4' }));
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.box(cx, 0, cz, 0.42, h, 0.42, BEAM, k(MK.WOOD));           // köşe dikmesi (kendi kutusu)
    b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0 - 0.3, 0.02, z1 - z0 - 0.3, '#7d6447', nk(MK.WOOD));                          // iç döşeme
    const W = x1 - x0, D = z1 - z0, alongX = W >= D;
    const rw = (alongX ? D : W) + 0.8, rl = (alongX ? W : D) + 0.8, rh = Math.min(2.2, rw * 0.36);
    b.box((x0 + x1) / 2, h, (z0 + z1) / 2, W + 0.3, 0.16, D + 0.3, BEAM, k(MK.WOOD));                                            // saçak kirişi
    b.withKind(roof === 'tin' ? MK.TIN : MK.TILE, () => b.prism((x0 + x1) / 2, h + 0.16, (z0 + z1) / 2, rw, rh, rl, roof === 'tin' ? TIN : TILE, { ry: alongX ? P2 : 0 }));
    if (inner) inner();
  });
  const door = (at, w = 1.5) => ({ at, w, b: 0, top: 2.35 });
  const win = (at, w = 1.2) => ({ at, w, b: 1.0, top: 2.1, glass: true, glow: true });
  // vagon rayı: balast + travers + iki ray (düz parça tek kutu, köşe yayları kısa parçalar). Hepsi çarpışmasız (8–14 cm, üstünden yürünür)
  const rails = (tr, opt = {}) => {
    const G = 0.55;
    for (const p of tr.parts) {
      const mx = (p.a[0] + p.b[0]) / 2, mz = (p.a[1] + p.b[1]) / 2, ry = Math.atan2(p.b[0] - p.a[0], p.b[1] - p.a[1]);
      b.with(mx, 0, mz, ry, () => {
        b.box(0, 0, 0, 2.3, 0.04, p.L + 0.05, GRAVEL, nk(MK.GRAVEL));
        for (const s of [-1, 1]) b.box(s * G, 0.1, 0, 0.07, 0.07, p.L + 0.02, '#6d6a66', nk(MK.STEEL));
        for (const s of [-1, 1]) b.box(s * G, 0.04, 0, 0.13, 0.06, p.L + 0.02, '#4e4b48', nk(MK.STEEL));
      });
    }
    const n = Math.floor(tr.len / 0.7), q = {};
    for (let i = 0; i <= n; i++) { tr.at(i * 0.7, q); if (opt.skip && opt.skip(q)) continue; b.with(q.x, 0.04, q.z, q.yaw, () => b.box(0, 0, 0, 1.6, 0.06, 0.2, '#6e5538', nk(MK.WOOD))); }
  };

  // ───────── zemin ─────────
  b.box(0, -0.6, 0, 360, 0.6, 320, DIRT, nk(MK.DIRT));                                       // toprak (üstü y = 0)
  const pave = (x0, x1, z0, z1, c = PAVE) => b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 0.012, z1 - z0, c, nk(MK.PAVE));
  pave(-26, -10, -2, 12);                                                                     // A · Makas meydanı
  pave(-14, 6, 2, 10);                                                                        // köy caddesi
  for (const [x0, x1, z0, z1] of [[-47.7, -38.3, 14.3, 35.7], [-47.7, -36.3, -35.7, -22.3], [-11.7, 3.7, -35.7, -26.3], [38.3, 47.7, -7.7, 17.7]]) pave(x0, x1, z0, z1, '#9d9486');   // doğuş avluları
  const patch = (x0, x1, z0, z1, c) => b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 0.006, z1 - z0, c, nk(MK.DIRT));   // koyu toprak izi (6 mm)
  for (const [x0, x1, z0, z1, c] of [[-38, -14, 22.6, 29.4, '#957a5d'], [-21.4, -14.6, 6, 22.6, '#957a5d'], [-14.6, 10, 10, 13, '#9a7f61'], [4.6, 11.4, -12.6, 6, '#957a5d'], [8, 32, -19.4, -12.6, '#957a5d'], [26.6, 33.4, -32, -19.4, '#957a5d'],
    [-45, -41, -22, 14, '#9b8063'], [-12, -6, -26, 2, '#9b8063'], [-1, 2, -26, -19, '#9b8063'], [25, 38, -2, 1, '#9b8063'], [12, 16, 6, 24, '#9b8063']]) patch(x0, x1, z0, z1, c);
  rails(track);
  rails(makeTrack([[-18, 3], [-31, 3]], 1), {});                                              // A meydanı yan hattı (makas)

  // ───────── çevre kayalıkları (iç yüz = sınır) + iç kaya kütleleri ─────────
  const B = MADEN_BOUNDS;
  bench(B.minX - 9, B.maxX + 9, B.minZ - 10, B.minZ, 's', [5.5, 10, 15]);                  // kuzey (3 kademe)
  bench(B.minX - 9, B.maxX + 9, B.maxZ, B.maxZ + 10, 'n', [5, 9, 13]);                     // güney
  bench(B.minX - 10, B.minX, B.minZ, B.maxZ, 'e', [5, 9.5, 14]);                           // batı
  bench(B.maxX, B.maxX + 10, B.minZ, B.maxZ, 'w', [5, 9.5, 14]);                           // doğu
  bench(20, 48, 18, 36, 'nw', [4.5, 8, 11.5]);                                             // güneydoğu kaya kütlesi (taş ocağının arkası)
  bench(-30, -18, -36, -27, 'swe', [4.5, 7.5]);                                            // kuzeybatı kaya burnu (iki avlu arasında görüş keser)
  bench(-12, -6, 30.5, 36, 'nwe', [4.2]);                                                  // güney kaya cebi
  for (const [x, y, z, s] of [[-40, 9.3, -40.5, 1.1], [-22, 9.3, -40.6, 1.3], [-6, 14.2, -44, 1], [12, 9.3, -40.4, 1.2], [40, 14.2, -44.5, 1], [-52.5, 8.8, -10, 1.2], [-52.5, 8.8, 14, 1], [52.5, 8.8, -22, 1.1], [52.5, 8.8, 4, 1.3], [-30, 8.3, 40.5, 1], [6, 12.2, 44, 1.2], [30, 10.8, 30, 1.1], [36, 10.8, 31.5, 0.9], [42, 10.8, 29, 1.2], [24, 7.3, 22.4, 0.9]])
    pine(x, y, z, s);
  co('Kuzey Kayalığı', -24, -31);

  // ───────── 1 · YÜKLEME AVLUSU (güneybatı, Mavi ilk doğuş) ─────────
  stoneWall('z', 14, 36, -38, 3.2, [{ at: 26, w: 8, b: 0, top: 3.2 }]);                  // doğu duvarı: ray kapısı
  stoneWall('x', -48, -38, 14, 3.2, [{ at: -43.75, w: 2.5, b: 0, top: 3.2 }, { at: -40.5, w: 2, b: 0, top: 3.2 }]);   // kuzey duvarı: iki kapı
  for (const z of [21.7, 30.3]) b.box(-38, 3.2, z, 0.72, 0.6, 0.72, '#857d71', k(MK.STONE));   // kapı ayağı başlığı (duvar üstü, ulaşılmaz)
  b.obj('ray-tamponu', () => { b.box(-46.9, 0, 26, 0.5, 0.9, 1.7, BEAM, k(MK.WOOD)); b.box(-46.6, 0.45, 26, 0.12, 0.3, 1.4, MARK, nk(MK.MARK)); });
  for (const [x, z] of [[-46.8, 16.2], [-46.8, 34.0]]) crate(x, 0, z, 1.1);
  barrel(-39.0, 34.6); barrel(-39.7, 35.0);
  co('Yükleme Avlusu', -43, 25, true);

  // Yükleme rampası (avlu dışı, rayın kuzeyi): 1,4 m ahşap iskele, doğudan merdiven
  b.obj('yükleme-rampası', () => {
    b.box(-34.85, 0, 18, 5.7, 1.18, 4, '#8b7357', nk(MK.WOOD));
    b.box(-34.85, 1.18, 18, 5.7, 0.22, 4, WOOD, nk(MK.WOOD));
    for (const x of [-37.4, -35.2, -33.0]) for (const z of [16.1, 19.9]) b.box(x, 0, z, 0.26, 1.18, 0.26, BEAM, nk(MK.WOOD));
    b.collide(-34.85, 0, 18, 5.7, 1.4, 4, 'plat');
    b.stairs(-29.2, 18, 0, '-x', 2.2, 5, 0.28, 0.55, '#8b7357', { tag: 'plat' });
    crate(-36.6, 1.4, 16.8, 1.0); crate(-36.6, 1.4, 19.2, 1.0);
  });
  co('Yükleme Rampası', -34.5, 18);
  // cevher yığınları + travers istifi (rayın güneyi)
  orePile(-33.5, 33.2, 4.4, 3.4, ORE);
  orePile(-21.5, 33.0, 4.0, 3.6, ORE_R);
  timber(-27.5, 33.6, 3.2, 3, 0);
  barrel(-24.6, 31.4); barrel(-24.0, 32.1, '#4f5b45');
  co('Cevher Yığınları', -28, 33);

  // Kırma Tesisi (ray içinden geçer): kuzey / güney duvarı kapılı, uçlar ray için açık, sac çatı 5,2 m
  b.obj('kırma-tesisi', () => {
    const X0 = -30.5, X1 = -23.5, Z0 = 21, Z1 = 31, H = 5.2;
    stoneWall('x', X0, X1, Z0, H, [door(-26.6, 1.6)]);
    stoneWall('x', X0, X1, Z1, H, [door(-28.4, 1.6)]);
    for (const x of [X0, X1]) for (const [za, zb] of [[Z0, 23.2], [28.8, Z1]]) b.box(x, 0, (za + zb) / 2, 0.6, H, zb - za, STONEC, k(MK.STONE));   // uç ayakları (ray açıklığı z 23,2–28,8)
    for (const x of [X0, X1]) b.box(x, 4.1, 26, 0.6, H - 4.1, 5.6, STONEC, k(MK.STONE));                                              // lento
    b.box((X0 + X1) / 2, H, 26, X1 - X0 + 1.2, 0.18, Z1 - Z0 + 1.0, TIN, k(MK.TIN, { tag: 'roof' }));
    for (const x of [-29, -25]) b.box(x, H - 0.45, 26, 0.24, 0.45, Z1 - Z0 - 0.6, BEAM, k(MK.WOOD));                                   // tavan kirişi
    b.box(-28.25, 0, 22.4, 2.9, 2.3, 1.9, STEEL, k(MK.STEEL));                                                                         // kırıcı makine
    b.box(-28.25, 2.3, 22.4, 1.8, 0.8, 1.3, STEEL_D, k(MK.STEEL));                                                                      // huni
    b.box(-25.0, 0, 29.6, 2.2, 1.7, 1.6, '#6b6f72', k(MK.STEEL));                                                                       // elek kasası
    b.box(-26.6, 3.4, 29.6, 3.4, 0.25, 0.8, STEEL_D, k(MK.STEEL));                                                                      // bant (yüksek)
    b.box(-27.0, 4.6, 26, 0.5, 0.5, 0.5, STEEL_D, NC);
    b.box(-27.0, 5.04, 26, 0.04, 0.12, 0.04, STEEL_D, NC);
    b.box(-27.0, 4.48, 26, 0.36, 0.06, 0.36, LAMP, { collide: false, o: { glow: true } });
  });
  co('Kırma Tesisi', -27, 26);

  // ───────── 2 · AMBAR + DOĞU EVLERİ (ray x = −18 boyunca kuzeye) ─────────
  b.obj('ambar', () => {
    const X0 = -30, X1 = -22, Z0 = 8, Z1 = 18, H = 4.2;
    b.shell(X0, X1, Z0, Z1, 0, H, 0.35, '#8c6e4c', { e: [door(13, 2.2)], w: [door(11, 1.6)], n: [{ at: -26, w: 2.6, b: 0, top: 3.0 }], s: [win(-26)] }, k(MK.PLANK, { trim: '#d9cdb4' }));
    for (const [cx, cz] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) b.box(cx, 0, cz, 0.45, H, 0.45, BEAM, k(MK.WOOD));
    b.box(-26, 0, 13, 7.6, 0.02, 9.6, '#7d6447', nk(MK.WOOD));
    b.box(-26, H, 13, 8.5, 0.16, 10.5, BEAM, k(MK.WOOD));
    b.withKind(MK.TIN, () => b.prism(-26, H + 0.16, 13, 9.0, 2.6, 11, TIN));
    crate(-29.05, 0, 17.05, 1.1); crate(-29.05, 1.1, 17.05, 0.9); crate(-22.95, 0, 17.05, 1.1); crate(-29.05, 0, 8.95, 1.1);   // köşelerde (orta açık: Mavi 2. aşama doğuş odası)
  });
  co('Ambar', -26, 13);
  house('dogu', -14, -8, 13, 20, { col: HOUSE[1], ops: { w: [door(16.6)], s: [door(-11)], e: [win(16.5)], n: [win(-11)] }, inner: () => { b.box(-10, 0, 14.4, 1.4, 0.78, 0.8, WOOD, k(MK.WOOD)); crate(-13.0, 0, 18.9, 0.9); } });
  co('Doğu Evleri', -11, 16.5);
  lamp(-20.4, 21.5, PI); lamp(-15.6, 9.5, 0);
  lowWall(-15.8, 23.4, 2.4, 0.5);
  barrel(-20.7, 19.4); crate(-20.6, 0, 22.8, 1.0);

  // ───────── A · MAKAS (1. kontrol noktası) ─────────
  house('makas-kulubesi', -25.6, -22.4, -1.6, 1.6, { col: HOUSE[3], h: 2.8, roof: 'tin', ops: { e: [door(0, 1.2)], s: [win(-24, 1.0)] }, inner: () => b.box(-24.9, 0, 0.6, 0.8, 0.9, 0.8, STEEL, k(MK.STEEL)) });
  b.obj('makas-kolu', () => { b.box(-19.7, 0, 4.1, 0.5, 0.8, 0.5, STEEL, k(MK.STEEL)); b.box(-19.7, 0.8, 4.1, 0.08, 0.7, 0.08, '#c33', NC); });
  oldWagon(-27.4, 3, P2);
  lowWall(-14.5, 0.6, 3.2, 0.5); lowWall(-12.3, 3.3, 0.5, 2.6);
  crate(-21.6, 0, 9.4, 1.1); crate(-20.5, 0, 9.6, 0.9);
  lamp(-12.6, -1.4, PI / 2);
  co('A · Makas', -18, 6); co('Makas Kulübesi', -24, 0); co('Yan Hat', -28, 3);

  // ───────── batı orta: kömür bunkeri + kantin ─────────
  b.obj('kömür-bunkeri', () => {
    b.box(-42.5, 0, -3, 11, 2.6, 10, CONC, k(MK.CONC));                                              // beton kaide
    for (const x of [-46, -42.5, -39]) b.box(x, 2.6, -3, 3.4, 4.8, 9.4, '#5f5650', k(MK.TIN));          // üç sac silo kutusu
    b.box(-42.5, 7.4, -3, 11.2, 0.3, 10.2, TIN, k(MK.TIN));
    for (const x of [-46, -42.5, -39]) b.box(x, 1.2, 2.04, 1.4, 1.2, 0.1, STEEL_D, NC);                 // boşaltma ağızları (kaide yüzünde)
    orePile(-42.5, 3.6, 6.0, 1.4, '#2f2c2a');
  });
  co('Kömür Bunkeri', -42.5, 4);
  house('kantin', -33, -26, -16, -9, { col: HOUSE[4], ops: { s: [door(-29.5)], e: [door(-11.5)], n: [win(-30)], w: [win(-12.5)] }, inner: () => { b.box(-30.5, 0, -12.5, 2.0, 0.78, 0.9, WOOD, k(MK.WOOD)); crate(-32.0, 0, -15.0, 0.9); } });
  co('Kantin', -29.5, -12.5);
  for (const [x, z] of [[-38.5, -14.5], [-38.0, -18.5]]) crate(x, 0, z, 1.1);
  timber(-22.0, -19.5, 3.4, 3, P2);
  barrel(-23.8, -9.4); barrel(-24.4, -8.8);
  lamp(-35.5, -6.8, 0);

  // ───────── 2 · KUZEYBATI AVLU (Kırmızı → Mavi) ─────────
  stoneWall('x', -48, -36, -22, 3.2, [{ at: -44.75, w: 2.5, b: 0, top: 3.2 }, { at: -39.25, w: 2.5, b: 0, top: 3.2 }]);
  stoneWall('z', -36, -22, -36, 3.2, [{ at: -23.75, w: 2.5, b: 0, top: 3.2 }]);
  crate(-47.0, 0, -34.8, 1.1); crate(-37.2, 0, -34.8, 1.1);
  co('Kuzeybatı Avlu', -42, -29, true);

  // ───────── 3 · KÖY CADDESİ (ray z = 6 boyunca doğuya) ─────────
  house('kuzey', -14, -6, -6, 1, { col: HOUSE[0], ops: { s: [door(-10)], e: [door(-2.5)], w: [win(-3)], n: [win(-10)] }, inner: () => { b.box(-12.4, 0, -4.4, 1.5, 0.78, 0.8, WOOD, k(MK.WOOD)); crate(-7.2, 0, -5.0, 0.9); } });
  house('muhtarlik', -6, 3, 11, 18, { col: HOUSE[2], ops: { n: [door(-1.5), win(1.4)], e: [door(14.5)], w: [win(14.5)], s: [win(-3)] }, inner: () => { b.box(-3.6, 0, 15.6, 2.0, 0.8, 0.9, WOOD, k(MK.WOOD)); b.box(1.2, 0, 16.8, 1.2, 1.9, 0.5, WOOD_D, k(MK.WOOD)); } });
  // su kulesi (bacaklar + 3 m'de halka kuşak + tank: kuşak / tank ulaşılmaz)
  b.obj('su-kulesi', () => {
    const cx = -1.5, cz = -3;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(cx + sx * 1.3, 0, cz + sz * 1.3, 0.28, 6.2, 0.28, BEAM, k(MK.WOOD));
    for (const s of [-1, 1]) { b.box(cx, 3.0, cz + s * 1.3, 2.88, 0.18, 0.18, BEAM, k(MK.WOOD)); b.box(cx + s * 1.3, 3.0, cz, 0.18, 0.18, 2.88, BEAM, k(MK.WOOD)); }
    b.box(cx, 6.2, cz, 3.2, 0.2, 3.2, BEAM, k(MK.WOOD));
    b.cyl(cx, 6.4, cz, 1.9, 1.9, 2.6, '#7b6248', { seg: 14, kind: MK.WOOD });
    b.cyl(cx, 9.0, cz, 0.3, 2.0, 0.9, TIN, { seg: 14, kind: MK.TIN });
    for (const yy of [6.9, 8.2]) b.cyl(cx, yy, cz, 1.93, 1.93, 0.08, STEEL_D, { seg: 14, collide: false, kind: MK.STEEL });
    for (let i = 0; i < 10; i++) b.box(cx + 1.3 + 0.16, 0.4 + i * 0.55, cz + 1.3, 0.04, 0.04, 0.4, STEEL_D, NC);   // merdiven basamağı (bacağa bitişik süs)
  });
  co('Su Kulesi', -1.5, -3);
  co('Köy Caddesi', -5, 9.5, true); co('Muhtarlık', -1.5, 14.5); co('Kuzey Ev', -10, -2.5);
  lowWall(3.6, 9.9, 3.0, 0.5); lowWall(-12.0, 10.6, 3.0, 0.5);
  crate(-8.0, 0, 2.4, 1.1); crate(-3.9, 0, 9.6, 1.0); barrel(-6.6, 2.3); barrel(2.5, 2.6);
  lamp(-5.8, 9.3, 0); lamp(4.9, 2.4, PI);
  b.obj('kuyu', () => { b.cyl(-15.4, 0, -3.8, 0.9, 1.0, 0.85, STONEC, { seg: 12, kind: MK.STONE }); for (const s of [-1, 1]) b.box(-15.4 + s * 0.8, 0.85, -3.8, 0.12, 1.4, 0.12, BEAM, NC); b.box(-15.4, 2.2, -3.8, 1.8, 0.12, 0.16, BEAM, NC); });

  // kuzey ara: barınak + kahvehane
  house('baraka', -11, -6, -20, -14, { col: HOUSE[5], h: 2.9, roof: 'tin', ops: { e: [door(-17)], s: [win(-8.5)] }, inner: () => crate(-9.6, 0, -18.6, 1.0) });
  house('kahvehane', -4, 3, -19, -10, { col: HOUSE[3], ops: { e: [door(-13)], s: [door(0.2), win(-2.4)], n: [win(-0.5)], w: [win(-15)] }, inner: () => { for (const [x, z] of [[-1.8, -16.5], [1.0, -16.5], [-1.8, -12.6]]) { b.cyl(x, 0, z, 0.45, 0.45, 0.76, WOOD, { seg: 10, kind: MK.WOOD }); } b.box(1.8, 0, -11.2, 1.6, 1.05, 0.6, WOOD_D, k(MK.WOOD)); } });
  co('Kahvehane', -0.5, -14.5); co('Baraka', -8.5, -17);
  crate(-14.6, 0, -11.8, 1.1); timber(-17.5, -18.6, 3.0, 2, 0);
  // demirci atölyesi (A meydanının kuzeyi; Ambar ile kuzey avlu arasında görüş keser): örs, ocak, kapılar doğu / güney / batı
  house('demirci', -22, -16, -14, -8, { col: HOUSE[5], h: 3.0, roof: 'tin', ops: { s: [door(-19.8)], e: [door(-11.2, 1.3)], w: [door(-10.6, 1.3)], n: [win(-19)] }, inner: () => {
    b.box(-21.0, 0, -12.8, 1.4, 1.0, 1.2, STONEC, k(MK.STONE));                                   // ocak
    b.box(-21.0, 1.0, -12.8, 0.6, 1.95, 0.6, '#5d544b', k(MK.STONE));                              // baca (tavana)
    b.box(-17.6, 0, -12.6, 0.5, 0.72, 0.5, BEAM, k(MK.WOOD)); b.box(-17.6, 0.72, -12.6, 0.8, 0.14, 0.32, STEEL_D, k(MK.STEEL));   // örs kütüğü + örs
  } });
  co('Demirci', -19, -11);

  // ───────── 4 · KUZEY AVLU (Kırmızı → Mavi) ─────────
  stoneWall('x', -12, 4, -26, 3.2, [{ at: -8.75, w: 2.5, b: 0, top: 3.2 }, { at: 0.25, w: 2.5, b: 0, top: 3.2 }]);
  for (const x of [-8.75, 0.25]) stoneWall('x', x - 2.0, x + 2.0, -28.1, 3.2);                // kapı arkası perde duvarı (avlu içi dışarıdan görünmez; iki yandan dolanılır)
  stoneWall('z', -36, -26, -12, 3.2, [{ at: -31.75, w: 2.5, b: 0, top: 3.2 }]);
  stoneWall('z', -36, -26, 4, 3.2, [{ at: -31.75, w: 2.5, b: 0, top: 3.2 }]);
  crate(-10.9, 0, -34.8, 1.1); crate(2.9, 0, -34.8, 1.1);
  co('Kuzey Avlu', -4, -31, true);

  // ───────── B · KANTAR (2. kontrol noktası, ray köşesi kantar sundurmasının altında) ─────────
  b.obj('kantar', () => {
    for (const [x, z] of [[5.5, -12.4], [12.0, -12.4], [5.5, -19.9], [12.0, -19.9]]) b.box(x, 0, z, 0.32, 4.3, 0.32, BEAM, k(MK.WOOD));
    b.box(8.75, 4.3, -16.15, 7.3, 0.2, 8.3, TIN, k(MK.TIN, { tag: 'roof' }));
    for (const z of [-12.4, -19.9]) b.box(8.75, 3.95, z, 6.8, 0.35, 0.22, BEAM, k(MK.WOOD));
    b.box(8.75, 0, -16.15, 5.2, 0.03, 5.2, '#55585b', nk(MK.STEEL));                              // kantar plakası (zeminde 3 cm)
    // kantar odası (kuzey yanı)
    b.shell(6.2, 9.6, -19.5, -17.9, 0, 2.6, 0.2, HOUSE[2], { s: [win(7.9, 1.6)], e: [door(-18.7, 1.0)] }, k(MK.PLANK, { trim: '#d9cdb4' }));
    b.box(7.9, 2.6, -18.7, 3.8, 0.12, 2.0, TIN, k(MK.TIN));
    b.box(6.9, 0, -19.0, 0.9, 0.95, 0.5, STEEL, k(MK.STEEL));
  });
  co('B · Kantar', 8, -16);
  crate(11.0, 0, 3.0, 1.1); crate(11.2, 0, 1.8, 0.9); lowWall(4.8, -6.5, 0.5, 3.0); barrel(11.4, -8.6); barrel(11.9, -9.2, '#4f5b45');
  lamp(12.6, -11.0, PI);

  // Depo (rayın doğusu): üç kapı, içinde sandık sırası
  b.obj('depo', () => {
    const X0 = 13, X1 = 22, Z0 = -6, Z1 = 3, H = 4.0;
    b.shell(X0, X1, Z0, Z1, 0, H, 0.35, '#7f6a54', { w: [door(-1.5, 2.2)], e: [door(-1.5, 2.2)], n: [door(17.5, 1.6)], s: [win(16), win(19.4)] }, k(MK.PLANK, { trim: '#d9cdb4' }));
    for (const [cx, cz] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) b.box(cx, 0, cz, 0.45, H, 0.45, BEAM, k(MK.WOOD));
    b.box(17.5, 0, -1.5, 8.6, 0.02, 8.6, '#7d6447', nk(MK.WOOD));
    b.box(17.5, H, -1.5, 9.5, 0.16, 9.5, BEAM, k(MK.WOOD));
    b.withKind(MK.TIN, () => b.prism(17.5, H + 0.16, -1.5, 10, 2.4, 10, TIN));
    crate(15.0, 0, 1.6, 1.1); crate(16.2, 0, 1.6, 1.1); crate(15.6, 1.1, 1.6, 0.9);
    crate(19.6, 0, -4.6, 1.1); crate(20.7, 0, -4.6, 1.1); timber(17.6, 1.8, 2.6, 2, 0);
  });
  co('Depo', 17.5, -1.5);

  // ───────── 5 · LAVVAR (cevher yıkama tesisi, ray içinden geçer) ─────────
  b.obj('lavvar', () => {
    const X0 = 15, X1 = 25, Z0 = -22, Z1 = -10, H = 7.0;
    for (const x of [X0, X1]) {                                                                   // batı / doğu duvarı: ray açıklığı z −18,5…−13,5 (4,6 m yüksek)
      b.box(x, 0, (Z0 + -18.5) / 2, 0.5, H, -18.5 - Z0, '#8a7458', k(MK.PLANK));
      b.box(x, 0, (-13.5 + Z1) / 2, 0.5, H, Z1 - -13.5, '#8a7458', k(MK.PLANK));
      b.box(x, 4.6, -16, 0.5, H - 4.6, 5, '#8a7458', k(MK.PLANK));
    }
    b.wall('x', X0 - 0.25, X1 + 0.25, Z0, 0, H, 0.5, '#8a7458', [door(17.2, 2.0), win(22.5, 1.6)], k(MK.PLANK, { trim: '#d9cdb4' }));
    b.wall('x', X0 - 0.25, X1 + 0.25, Z1, 0, H, 0.5, '#8a7458', [door(19.0, 2.0), win(16.6, 1.4), win(23.2, 1.4)], k(MK.PLANK, { trim: '#d9cdb4' }));
    for (const [cx, cz] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) b.box(cx, 0, cz, 0.55, H + 0.2, 0.55, BEAM, k(MK.WOOD));
    b.box(20, H, -16, 11.2, 0.25, 13.2, TIN, k(MK.TIN, { tag: 'roof' }));
    b.box(20, H + 0.25, -16, 4, 1.4, 13.2, TIN, k(MK.TIN, { tag: 'roof' }));                     // çatı feneri
    b.box(20, 0, -16, 9.4, 0.02, 11.4, '#6d665c', nk(MK.CONC));
    // içerisi: kuzeyde cevher bunkerleri (2,6 m), üstte bant; güneyde yıkama tankları
    b.box(19.4, 0, -20.7, 6.0, 2.6, 1.9, STEEL, k(MK.STEEL));
    b.box(19.4, 2.6, -20.7, 4.6, 0.9, 1.5, '#4f555b', k(MK.STEEL));
    b.box(20, 4.9, -20.4, 9.4, 0.3, 0.9, STEEL_D, k(MK.STEEL));
    for (const x of [16.0, 24.0]) b.box(x, 2.6, -20.4, 0.25, 2.3, 0.25, STEEL_D, k(MK.STEEL));
    for (const x of [17.2, 22.6]) { b.cyl(x, 0, -11.45, 1.15, 1.15, 2.2, '#6c7378', { seg: 14, kind: MK.STEEL }); b.cyl(x, 2.2, -11.45, 1.2, 1.2, 0.1, STEEL_D, { seg: 14, collide: false, kind: MK.STEEL }); }
    crate(24.0, 0, -12.6, 1.0);
    for (const x of [17.5, 22.5]) { b.box(x, H - 0.9, -16, 0.04, 0.6, 0.04, STEEL_D, NC); b.box(x, H - 1.05, -16, 0.6, 0.16, 0.3, STEEL_D, NC); b.box(x, H - 1.07, -16, 0.5, 0.03, 0.22, LAMP, { collide: false, o: { glow: true } }); }
  });
  co('Lavvar', 20, -19.5, true);
  crate(13.6, 0, -21.0, 1.1); crate(13.6, 0, -19.9, 1.0); barrel(26.6, -10.8); barrel(27.3, -10.3, '#4f5b45');

  // ───────── C · MADEN AĞZI (kuzey kayalığında ahşap çerçeveli giriş, kapı) + maden avlusu ─────────
  b.obj('maden-agzi', () => {
    for (const [x0, x1] of [[23.6, 26.6], [33.4, 36.4]]) b.box((x0 + x1) / 2, 0, -34.6, x1 - x0, 7.2, 2.8, ROCK3, k(MK.ROCK));     // yan kaya payandaları
    for (const x of [26.85, 33.15]) b.box(x, 0, -34.2, 0.5, 5.2, 0.5, BEAM, k(MK.WOOD));                                         // dikmeler
    b.box(30, 4.7, -34.2, 6.8, 0.6, 0.6, BEAM, k(MK.WOOD));                                                                         // lento
    b.box(30, 5.3, -34.6, 6.8, 1.9, 1.4, ROCK2, k(MK.ROCK));                                                                        // lento üstü kaya
    b.box(30, 0, -35.7, 6.0, 4.7, 0.6, '#1a1714', k(MK.RUBBER));                                                                     // karanlık tünel içi (arka yüz)
    b.collide(30, 0, -35.15, 6.1, 4.7, 0.5);                                                                                          // kapı kanatları (görsel ayrı ağ: patlayınca kalkar)
  });
  co('C · Maden Ağzı', 30, -31);
  b.obj('vinc-evi', () => {
    b.shell(33.5, 37.2, -27.5, -22.5, 0, 3.0, 0.3, HOUSE[5], { w: [door(-25)], s: [win(35.3)] }, k(MK.PLANK, { trim: '#d9cdb4' }));
    b.box(35.35, 3.0, -25, 4.3, 0.14, 5.6, TIN, k(MK.TIN));
    b.box(35.6, 0, -26.4, 1.2, 1.1, 1.0, STEEL, k(MK.STEEL));
    b.cyl(35.35, 3.14, -25, 0.12, 0.12, 2.6, BEAM, { seg: 6, collide: false, kind: MK.WOOD });
  });
  co('Vinç Evi', 35.3, -25);
  timber(26.0, -24.5, 3.4, 3, P2); crate(25.6, 0, -28.4, 1.1); crate(25.6, 1.1, -28.4, 0.9);
  oldWagon(35.4, -31.6, 0);
  orePile(36.4, -16.5, 3.4, 3.0, ORE_R);
  lamp(27.2, -21.0, 0); lamp(33.2, -30.0, PI);
  co('Maden Avlusu', 31, -23);

  // ───────── doğu: taş ocağı (Kırmızı son avlu önü) ─────────
  b.obj('kompresor', () => {
    b.shell(27, 32, 4, 9, 0, 2.8, 0.3, '#7d7f78', { w: [door(6.5, 1.3)], n: [win(29.5)] }, k(MK.PLANK, { trim: '#d9cdb4' }));
    b.box(29.5, 2.8, 6.5, 5.6, 0.14, 5.6, TIN, k(MK.TIN));
    b.box(30.6, 0, 7.4, 1.6, 1.2, 1.2, STEEL, k(MK.STEEL));
  });
  co('Kompresör', 29.5, 6.5);
  // damperli kamyon (yerel +x ileri): kasa + kabin = iki çarpışma kutusu
  b.obj('kamyon', () => b.with(31.4, 0, -4.2, 0, () => {
    b.box(-1.2, 0.5, 0, 4.0, 0.5, 2.3, STEEL_D, nk(MK.STEEL));
    b.box(-1.2, 1.0, 0, 4.0, 1.25, 2.3, '#b58a3a', nk(MK.STEEL));
    b.box(-1.2, 2.25, 0, 3.6, 0.05, 2.0, ORE, nk(MK.ORE));
    b.box(1.65, 0.5, 0, 1.6, 2.0, 2.2, '#a07a35', nk(MK.STEEL));
    b.box(2.46, 1.5, 0, 0.02, 0.7, 1.9, '#2e3a40', nk(MK.STEEL));
    for (const wx of [-2.4, -0.9, 1.7]) for (const s of [-1, 1]) b.cyl(wx, 0.5, s * 1.0, 0.5, 0.5, 0.36, '#222', { rx: P2, center: true, seg: 12, collide: false, kind: MK.RUBBER });
    b.collide(-1.2, 0, 0, 4.0, 2.3, 2.3);
    b.collide(1.65, 0, 0, 1.6, 2.5, 2.2);
  }));
  for (const [x, z, w, d, h] of [[24.6, 12.6, 3.0, 2.6, 2.2], [35.0, 14.0, 2.4, 2.2, 1.9], [23.0, -2.4, 2.2, 2.0, 1.6], [34.6, 0.6, 1.8, 1.6, 1.3]]) b.box(x, 0, z, w, h, d, ROCK2, k(MK.ROCK));     // kaya blokları (siper)
  orePile(29.0, 15.0, 4.2, 3.2, ORE);
  lamp(25.6, 3.0, 0);
  co('Taş Ocağı', 29, 12, true); co('Kamyon', 31, -4);

  // ───────── 6 · DOĞU AVLU (Kırmızı son doğuş) ─────────
  stoneWall('z', -8, 18, 38, 3.2, [{ at: -2.75, w: 2.5, b: 0, top: 3.2 }, { at: 8.25, w: 2.5, b: 0, top: 3.2 }]);
  stoneWall('x', 38, 48, -8, 3.2, [{ at: 42.25, w: 2.5, b: 0, top: 3.2 }]);
  crate(46.8, 0, -6.8, 1.1); crate(46.8, 0, 16.6, 1.1);
  co('Doğu Avlu', 43, 5, true);

  // ───────── güney: ocak evleri (kanat yolu) ─────────
  house('ocak', 2, 9, 22, 29, { col: HOUSE[4], ops: { n: [door(5.5)], w: [door(25.5)], e: [win(25.5)], s: [win(5.5)] }, inner: () => { b.box(7.4, 0, 27.6, 1.4, 0.78, 0.8, WOOD, k(MK.WOOD)); crate(3.0, 0, 27.9, 0.9); } });
  co('Ocak Evi', 5.5, 25.5);
  house('kiler', -5, 0, 24, 29, { col: HOUSE[5], h: 2.8, roof: 'tin', ops: { e: [door(26.5, 1.2)], n: [win(-2.5)] } });
  lowWall(12.6, 21.0, 0.5, 4.0); lowWall(-8.6, 21.4, 4.0, 0.5); crate(14.2, 0, 15.0, 1.1); crate(15.3, 0, 15.2, 0.9); barrel(10.8, 31.5); barrel(11.5, 32.2);
  timber(16.2, 27.0, 3.0, 3, P2);
  lamp(-2.5, 21.3, 0); lamp(13.8, 9.0, PI);
  co('Kiler', -2.5, 26.5); co('Güney Yol', 12, 20);

  // ───────── dış silüet (çarpışmasız, sınır dışı): dağlar ─────────
  const nCol = b.colliders.length;
  b.withKind(MK.ROCK, () => {                                                               // vadiyi çevreleyen yüzeyli tepeler (yassı ikosahedron, yarısı yerin altında)
    for (let a = 0; a < 26; a++) {
      const ang = a / 26 * Math.PI * 2 + rng() * 0.12, R = 82 + rng() * 22, r = 20 + rng() * 14;
      b.ico(Math.cos(ang) * R * 1.12, 0, Math.sin(ang) * R * 0.92, r, ['#75664f', '#6d604c', '#80705a', '#6a5e49'][a % 4], { ry: rng() * 6.3, scale: [1, (12 + rng() * 16) / r, 0.75 + rng() * 0.4] });
    }
  });
  for (const [x, z] of [[-48, -60], [-16, -62], [24, -60], [52, -58], [-66, -40], [-68, 4], [-64, 46], [68, -46], [66, 6], [64, 42], [-40, 62], [-6, 64], [40, 62]]) pine(x, 0, z, 2.4);
  b.colliders.length = nCol;

  // ───────── doğuş noktaları (avlu başına ızgara; ray ve eşyalardan uzak) ─────────
  const grid = (x0, x1, z0, z1, ry, skip = () => false, st = 1.6) => {
    const out = [];
    for (let z = z0; z <= z1 + 1e-6; z += st) for (let x = x0; x <= x1 + 1e-6; x += st) if (!skip(x, z)) out.push({ x: +x.toFixed(2), z: +z.toFixed(2), ry });
    return out;
  };
  const yardSW = grid(-46.4, -39.6, 15.6, 34.2, -P2, (x, z) => Math.abs(z - 26) < 1.6 || (x < -45.6 && (z < 17.2 || z > 33.2)) || (x > -40.2 && z > 33.8));
  const ambar = grid(-28.9, -23.7, 9.3, 17.1, -P2, (x, z) => (x < -28 && (z < 10.2 || z > 15.9)) || (x > -24 && z > 15.9), 1.3);
  const yardNW = grid(-46.4, -37.6, -34.4, -23.6, PI * 0.75, (x, z) => (z < -33.6 && (x < -46 || x > -38.2)));
  const yardN = grid(-10.4, 2.4, -34.4, -29.6, PI, (x, z) => z < -33.6 && (x < -10 || x > 2));
  const yardE = grid(39.6, 46.4, -6.4, 16.4, P2, (x, z) => x > 45.5 && (z < -5.5 || z > 15.5));
  const zoneOf = (x0, x1, z0, z1) => ({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
  const Z = { SW: zoneOf(-48, -38, 14, 36), AM: zoneOf(-30.2, -21.8, 7.8, 18.2), NW: zoneOf(-48, -36, -36, -22), N: zoneOf(-12, 4, -36, -26), E: zoneOf(38, 48, -8, 18) };
  const plStages = [
    { blue: yardSW, red: yardNW, zones: { blue: Z.SW, red: Z.NW } },
    { blue: ambar, red: yardN, zones: { blue: Z.AM, red: Z.N } },
    { blue: yardN, red: yardE, zones: { blue: Z.N, red: Z.E } },
  ];

  const group = b.build();
  let mineDoor = null;
  if (typeof document !== 'undefined' && !MapBuilder.noVisual) {
    const add = (m, x, y, z, ry = 0, rx = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.renderOrder = 2; group.add(m); return m; };
    const sign = { bg: '#3b2f22', font: 'bold 150px Arial, sans-serif' };
    add(textPlane('MADEN OCAĞI', 6.2, 1.1, sign), 30, 5.62, -33.88);
    add(textPlane('KIRMA', 3.2, 0.9, sign), -23.18, 4.55, 26, P2); add(textPlane('KIRMA', 3.2, 0.9, sign), -30.82, 4.55, 26, -P2);
    add(textPlane('LAVVAR', 3.6, 1.0, sign), 14.73, 5.5, -16, -P2); add(textPlane('LAVVAR', 3.6, 1.0, sign), 25.27, 5.5, -16, P2);
    add(textPlane('KANTAR', 3.0, 0.7, sign), 8.75, 3.95, -12.27, 0);
    const cp = { fg: '#1d1a14', bg: '#e0c040', font: 'bold 400px Arial, sans-serif' };
    add(textPlane('A', 1.0, 1.0, cp), -25.6 - 0.16, 1.9, 0.9, -P2);                                       // kontrol noktası harfleri (kulübe / kantar / ağız)
    add(textPlane('B', 1.0, 1.0, cp), 8.0, 2.0, -17.78, 0);
    add(textPlane('C', 1.2, 1.2, cp), 30, 4.05, -33.88, 0);
    for (const [x, z, l] of [[-18, 6, 'A'], [8, -16, 'B']]) add(textPlane(l, 2.2, 2.2, { fg: 'rgba(236,200,70,.82)', font: 'bold 400px Arial, sans-serif' }), x + (l === 'A' ? -2.8 : 2.8), 0.03, z + (l === 'A' ? 2.6 : -2.4), 0, -P2);
    // maden kapısı (iki kanat; vagon ulaşınca patlar: Payload kapıyı gizler)
    const door = (mineDoor = new THREE.Group());
    const wm = new THREE.MeshStandardMaterial({ color: '#7a5a38', roughness: 0.92, flatShading: true }), im = new THREE.MeshStandardMaterial({ color: '#3a3e44', roughness: 0.6, metalness: 0.3, flatShading: true });
    for (const s of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.98, 4.6, 0.22), wm); leaf.position.set(s * 1.5, 2.3, 0); door.add(leaf);
      for (const yy of [0.8, 2.3, 3.8]) { const st = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.16, 0.06), im); st.position.set(s * 1.5, yy, 0.13); door.add(st); }
      const dg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.6, 0.05), wm); dg.position.set(s * 1.5, 2.3, 0.14); dg.rotation.z = s * 0.62; door.add(dg);
    }
    const ws = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.04), new THREE.MeshStandardMaterial({ color: '#e0c040', roughness: 0.8 })); ws.position.set(0, 3.2, 0.17); door.add(ws);
    door.position.set(30, 0, -35.15);
    door.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(door);
  }

  return {
    id: 'maden',
    name: 'Maden Ocağı',
    group,
    colliders: b.colliders,
    sight: b.sight,
    bounds: MADEN_BOUNDS,
    layered: true,                                                   // yükleme rampası + merdiven: yol bulma hücre başına zemin kotu tutar
    callouts,
    mini: { bg: '#8a7860', ground: [166, 141, 107], wall: '#4a4036', mid: '#6b5f50', low: '#857762', roof: 'rgba(70,58,44,0.4)' },
    spawns: { blue: plStages[0].blue, red: plStages[0].red },
    baseZones: { ...plStages[0].zones },
    objectives: [],
    roads: [],
    // Vagon modu: ray, kontrol noktaları (köşe sırası), aşamalara göre doğuş + üs bölgeleri, maden kapısı
    payload: { track: MADEN_TRACK, radius: 2.5, start: 12, checkpoints: [1, 3], names: ['A · Makas', 'B · Kantar', 'C · Maden Ağzı'], stages: plStages, door: mineDoor },
    env: {
      sky: ['#6f9fcf', '#c3d3df', '#ead8bc'], fog: ['#d8cdb8', 90, 320],
      sun: ['#fff0d0', 2.6], hemi: ['#d6e0ea', '#7d6a50', 1.0], cloud: '#f6f2ea', clouds: 14,
      sunPos: [-46, 78, 34],
    },
  };
}
