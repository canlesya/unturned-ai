import * as THREE from 'three';
import { rail, sideRail, bez } from './s3kit.js';
import { skinMaterial, STD } from './skins.js';
import { S3PARTS, ADS_DIST } from './s3weapons.js';

// S3 "BattleBit" ikinci tur (tüfek / DMR / keskin / pompalı / bomba atar): SCAR-H, AUG, G36, AK-74U, SVD, Barrett M82, AA-12, Çift Namlu, M79 — s3weapons.js kalıbıyla (yan profil çekme + pah, tek ağ + cam).
// Sözleşme eski modellerle (weapons_more.js) birebir: muzzle / gripR / gripL / length aynı → mermi / tepme / hasar / sunucu değişmez; kutu eller aynı kabza noktalarında.
// Nişan noktası (sight) = gez deliği / çentik ortası ya da nişangâh merkezi; ışıyan retikül (glow yuvası) bu eksende → adsalign ekranda ölçer.
const { optic, flipRear, coverMount, akMount, done, newKit, circ, stripe, plate, guard } = S3PARTS;

// Silah başına "Standart" palet (skins.js STD'ye eklenir): [renk, pürüzlülük, metaliklik]
Object.assign(STD, {
  scarh: { body: ['#a48d66', 0.62, 0.06], furn: ['#26272a', 0.7, 0], metal: ['#333437', 0.4, 0.6], acc: ['#1c1d20', 0.6, 0.2] },
  aug: { body: ['#2c2e31', 0.5, 0.35], furn: ['#56603f', 0.62, 0], metal: ['#333437', 0.4, 0.6], acc: ['#1d1f1d', 0.6, 0.15] },
  g36: { body: ['#2d2e31', 0.66, 0.05], furn: ['#222326', 0.72, 0], metal: ['#36373a', 0.4, 0.6], acc: ['#2f3236', 0.5, 0.1] },
  ak74u: { body: ['#36383c', 0.5, 0.4], furn: ['#6e3526', 0.45, 0], metal: ['#38393c', 0.42, 0.6], acc: ['#1c1d20', 0.6, 0.2] },
  svd: { body: ['#34363a', 0.5, 0.4], furn: ['#8a4f27', 0.5, 0], metal: ['#36373a', 0.42, 0.6], acc: ['#1e1f22', 0.5, 0.25] },
  barrett: { body: ['#3a3c40', 0.5, 0.4], furn: ['#26272a', 0.7, 0], metal: ['#333437', 0.4, 0.6], acc: ['#1c1d20', 0.6, 0.2] },
  aa12: { body: ['#2f3134', 0.56, 0.3], furn: ['#232427', 0.72, 0], metal: ['#38393c', 0.42, 0.6], acc: ['#1a1b1e', 0.6, 0.2] },
  dbl: { body: ['#303236', 0.4, 0.55], furn: ['#7a4426', 0.42, 0], metal: ['#5d5e62', 0.38, 0.7], acc: ['#1c1d20', 0.6, 0.2] },
  m79: { body: ['#474c3d', 0.56, 0.25], furn: ['#8a5530', 0.5, 0], metal: ['#38393c', 0.42, 0.6], acc: ['#1c1d20', 0.6, 0.2] },
});

// ── ortak küçük parçalar ──
// a → b (z, y) arası eğik çubuk (iskelet dipçik kolu)
const bar = (k, a, b, w, h, slot, o = {}) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); k.box([w, h, L], [o.x || 0, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2], slot, { ...o, rot: [Math.atan2(-(b[1] - a[1]), b[0] - a[0]), 0, 0] }); };
// Katlanır ön arpacık (yb = taban, line = nişan çizgisi = arpacık tepesi); up=false → yatık (optik takılı)
function frontPost(k, z, yb, line, up = true, slot = 'acc') {
  if (!up) return;      // 12.139: optikte yatık arpacık çizilmez (red dot / holo penceresinin dibinde tümsek gibi görünüyordu)
  k.box([0.024, 0.008, 0.026], [0, yb + 0.004, z], slot, { c: 0.002 });
  const y0 = yb + 0.008;
  for (const sx of [-1, 1]) k.box([0.003, line - 0.007 - y0, 0.012], [sx * 0.0105, (y0 + line - 0.007) / 2, z], slot, { c: 0.001 });   // kulaklar (tepesi arpacığın altında)
  k.box([0.003, line - y0, 0.003], [0, (y0 + line) / 2, z], slot, { sh: 0.85 });                                                      // arpacık (tepe = line)
}
// Açık U çentikli gez (tabanca / AK / av tüfeği): çentik dibi = line
function notch(k, z, yb, line, w = 0.009, n = 0.003, slot = 'metal') {      // 12.126: yaprak 21 → 18 mm (ince)
  k.xsec([[-w, yb], [w, yb], [w, line + 0.0055], [n, line + 0.0055], [n, line], [-n, line], [-n, line + 0.0055], [-w, line + 0.0055]], z + 0.003, z - 0.003, slot, { c: 0 });
}
// Namlu ucu kesikleri (uzunlamasına koyu yarık): r yarıçaplı silindir yüzeyinde n adet
function slots(k, y, z, r, len, n = 4, a0 = 0.785) { if (k.lod) return; for (let i = 0; i < n; i++) { const a = a0 + (i * Math.PI * 2) / n; k.box([0.0045, 0.003, len], [Math.cos(a) * r, y + Math.sin(a) * r, z], 'metal', { sh: 0.3, rot: [0, 0, a + Math.PI / 2] }); } }
// Tüfek tabanca kabzası (M4 profili, dz kaydırma) + tetik
function pgrip(k, dz, slot = 'furn', w = 0.032, pat = 1) {
  k.prof([[0.012, -0.012], [0.05, -0.012], [0.054, -0.024], [0.09, -0.126], [0.083, -0.138], [0.05, -0.138], [0.043, -0.126], [0.04, -0.104], [0.022, -0.06], [0.014, -0.034]].map(([z, y]) => [z + dz, y]), w, slot, { c: 0.005, pat: k.lod ? 0 : pat });
}
function trigger(k, dz, y = -0.018) { k.prof([[-0.012, y], [-0.02, y], [-0.025, y - 0.022], [-0.019, y - 0.03], [-0.012, y - 0.02]].map(([z, yy]) => [z + dz, yy]), 0.006, 'metal', { d: 1 }); }
// Göz merceğinde ince artı (keskin nişancı dürbünü, probe retikülü)
const cross = (k, cy, z) => { for (const [w, hh] of [[0.012, 0.0004], [0.0004, 0.012]]) k.box([w, hh, 0.0005], [0, cy, z], 'glow', { d: 1 }); };
// Üstten görünüş şekli (x, z) Y boyunca çekilir (Barrett ok ucu namlu freni)
function topShape(k, pts, y0, y1, slot, o = {}) {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const c = k.lod ? 0 : o.c || 0, H = y1 - y0;
  const g = new THREE.ExtrudeGeometry(sh, { depth: H - 2 * c, bevelEnabled: c > 0, bevelThickness: c, bevelSize: c, bevelOffset: -c, bevelSegments: 1, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0 + c, 0);
  return k._push(g, slot, o);
}

// ───────────────────────── SCAR-H (FN SCAR 17) ─────────────────────────
export function scarh(mat = skinMaterial('scarh'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron', line = 0.124;
  // tek parça üst gövde (FDE): mekanizma + tutamaç bölümü, tam boy üst ray, yan / alt ray
  k.xsec([[-0.025, 0.026], [0.025, 0.026], [0.025, 0.086], [0.02, 0.094], [-0.02, 0.094], [-0.025, 0.086]], 0.075, -0.34, 'body', { c: 0.004 });
  k.xsec([[-0.022, 0.016], [0.022, 0.016], [0.027, 0.025], [0.027, 0.086], [0.02, 0.094], [-0.02, 0.094], [-0.027, 0.086], [-0.027, 0.025]], -0.34, -0.625, 'body', { c: 0.004, sh: 1.04 });
  rail(k, 0.07, -0.62, 0.094, { w: 0.022 });
  sideRail(k, -0.45, -0.61, 0.056, [0.03, -0.03]);
  k.box([0.02, 0.007, 0.2], [0, 0.0125, -0.515], 'acc', { c: 0.0015 });                                // alt ray
  if (!lod) for (let i = 0; i < 8; i++) k.box([0.022, 0.003, 0.009], [0, 0.0095, -0.43 - i * 0.024], 'acc', { sh: 0.55 });
  k.box([0.003, 0.022, 0.07], [0.0255, 0.055, -0.115], 'body', { sh: 0.3 });                         // fişek atım penceresi
  k.box([0.004, 0.016, 0.05], [0.027, 0.055, -0.17], 'body', { sh: 0.85, d: 1 });                    // kovan saptırıcı
  k.box([0.003, 0.008, 0.2], [-0.0255, 0.068, -0.2], 'body', { sh: 0.35, d: 1 });                    // kurma kolu yarığı (sol)
  k.box([0.018, 0.012, 0.022], [-0.034, 0.068, -0.27], 'metal', { c: 0.003 });                        // kurma kolu
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) k.box([0.003, 0.01, 0.05], [sx * 0.027, 0.04, -0.37 - i * 0.07], 'body', { sh: 0.4, d: 1 });   // tutamaç yarıkları
  k.box([0.056, 0.07, 0.008], [0, 0.055, -0.627], 'body', { c: 0.002, sh: 0.8, d: 1 });              // ön kapak
  // alt gövde (siyah polimer), şarjör yuvası, kabza, tetik korkuluğu, seçici
  k.prof([[0.06, 0.027], [-0.215, 0.027], [-0.215, 0.0], [-0.172, -0.006], [-0.168, -0.05], [-0.068, -0.05], [-0.066, -0.02], [0.012, -0.018], [0.06, 0.0]], 0.048, 'furn', { c: 0.003 });
  k.prof([[-0.168, -0.04], [-0.172, -0.056], [-0.064, -0.056], [-0.066, -0.04]], 0.052, 'furn', { c: 0.002, d: 1, sh: 0.9 });
  pgrip(k, 0.005);
  guard(k, [[0.016, -0.016], [0.018, -0.028], [0.0, -0.06], [-0.062, -0.06], [-0.062, -0.016]], [[0.006, -0.027], [-0.007, -0.051], [-0.054, -0.051], [-0.054, -0.026]], 0.01, 'furn');
  trigger(k, 0.0);
  k.box([0.004, 0.012, 0.022], [-0.025, 0.008, 0.005], 'metal', { d: 1, c: 0.001 });                 // ateş seçici
  k.cyl(0.006, 0.006, 0.005, [0.025, -0.006, -0.06], 'metal', { ax: 'x', d: 1 });                    // şarjör düğmesi
  // namlu + alev gizleyici
  k.cyl(0.0095, 0.0095, 0.25, [0, 0.05, -0.74], 'metal', { seg: 10 });
  k.cyl(0.0125, 0.0125, 0.056, [0, 0.05, -0.892], 'metal', { seg: 10, sh: 0.85 });
  slots(k, 0.05, -0.897, 0.0122, 0.036);
  // dikey ön tutamaç (sol el)
  k.prof([[-0.532, 0.012], [-0.572, 0.012], [-0.578, -0.068], [-0.57, -0.08], [-0.54, -0.08], [-0.53, -0.068]], 0.03, 'furn', { c: 0.004, pat: lod ? 0 : 1 });
  // katlanır dipçik (FDE): menteşe bloğu, üçgen boşluklu gövde, yanak yükseltici, dipçik pedi
  k.box([0.05, 0.088, 0.04], [0, 0.046, 0.08], 'body', { c: 0.004, sh: 0.9 });
  k.cyl(0.006, 0.006, 0.054, [0, 0.08, 0.085], 'metal', { ax: 'x', seg: 8, d: 1 });
  k.prof([[0.1, 0.09], [0.33, 0.09], [0.36, 0.084], [0.365, -0.07], [0.35, -0.09], [0.31, -0.088], [0.18, -0.012], [0.1, 0.0]], 0.042, 'body', { c: 0.006, holes: [[[0.175, 0.045], [0.335, 0.065], [0.335, -0.05], [0.3, -0.055]]] });
  k.box([0.044, 0.014, 0.12], [0, 0.097, 0.24], 'furn', { c: 0.003 });                                // yanak yükseltici
  k.prof([[0.36, 0.088], [0.38, 0.088], [0.38, -0.092], [0.36, -0.072]], 0.046, 'furn', { c: 0.004, pat: 1 });
  k.ring(0.011, 0.0025, [0, -0.06, 0.33], 'metal', { d: 1 });
  // nişangâh: demirde katlanır gez + arpacık açık, optikte ikisi yatık
  const rear = flipRear(k, 0, 0.102, 0.004, line, iron);
  frontPost(k, -0.6, 0.102, line, iron);
  const sg = iron ? { sight: rear, pivot: [0, line, -0.6], dist: ADS_DIST.iron, overlay: 'none' } : optic(k, o, 0.102, -0.11);
  // 20'lik düz şarjör (grup): hafif öne eğik, yan oluklar, taban
  const R = bez([-0.07, -0.045], [-0.072, -0.11], [-0.08, -0.172], lod ? 2 : 4), F = bez([-0.162, -0.045], [-0.166, -0.11], [-0.176, -0.164], lod ? 2 : 4);
  k.prof([...R, ...[...F].reverse()], 0.036, 'furn', { c: 0.003, g: 'mag', sh: 0.95 });
  k.prof(stripe(F, R, 0.18, 0.34), 0.038, 'furn', { g: 'mag', d: 1, sh: 0.82 });
  k.prof(stripe(F, R, 0.62, 0.78), 0.038, 'furn', { g: 'mag', d: 1, sh: 0.82 });
  plate(k, F[F.length - 1], R[R.length - 1], 0.04, 0.012, 'acc', { g: 'mag', c: 0.003 });
  return done(k, mat, { name: 'SCAR-H', hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.035, -0.55], muzzle: [0, 0.05, -0.92], length: 1.28 }, sg);
}

// ───────────────────────── AUG A3 (bullpup) ─────────────────────────
export function aug(mat = skinMaterial('aug'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron', line = 0.138;
  // yeşil polimer gövde (kabzanın arkasına uzanan şarjör yuvası + dipçik), dev tetik korkuluğu, dipçik pedi
  k.prof([[-0.17, 0.07], [0.32, 0.07], [0.352, 0.062], [0.37, 0.04], [0.374, -0.06], [0.364, -0.084], [0.348, -0.09], [0.2, -0.062], [0.19, -0.03], [0.112, -0.03], [0.104, -0.012], [0.07, -0.008], [0.0, -0.012], [-0.14, -0.008], [-0.172, 0.01], [-0.182, 0.04]], 0.056, 'furn', { c: 0.008 });
  k.prof([[0.366, 0.056], [0.384, 0.05], [0.386, -0.078], [0.368, -0.084]], 0.054, 'acc', { c: 0.004, pat: 1 });
  k.prof([[-0.17, 0.0], [-0.135, -0.004], [-0.1, -0.098], [0.022, -0.11], [0.03, -0.138], [-0.108, -0.128], [-0.176, -0.016]], 0.03, 'furn', { c: 0.005 });
  for (const sx of [-1, 1]) k.box([0.003, 0.034, 0.09], [sx * 0.0285, 0.03, 0.16], 'furn', { sh: 0.82, d: 1, c: 0.001 });   // atım kapakları (iki yanda)
  k.cyl(0.006, 0.006, 0.06, [0, 0.01, -0.02], 'metal', { ax: 'x', seg: 8, d: 1 });                    // çapraz emniyet
  k.box([0.016, 0.008, 0.018], [0, -0.034, 0.205], 'metal', { d: 1, c: 0.002 });                      // şarjör mandalı
  // alüminyum üst gövde + ray, ön kilit bloğu, kurma kolu (sol)
  k.xsec([[-0.02, 0.066], [0.02, 0.066], [0.022, 0.1], [0.016, 0.108], [-0.016, 0.108], [-0.022, 0.1]], 0.2, -0.25, 'body', { c: 0.003 });
  rail(k, 0.19, -0.245, 0.108, { w: 0.022 });
  k.box([0.044, 0.07, 0.08], [0, 0.043, -0.215], 'body', { c: 0.004 });
  k.box([0.003, 0.01, 0.17], [-0.0225, 0.08, -0.1], 'body', { sh: 0.35, d: 1 });
  k.box([0.016, 0.012, 0.02], [-0.03, 0.08, -0.17], 'metal', { c: 0.003 });
  // namlu (gövdeye yakın kalın kılıf), gaz silindiri, yarıklı alev gizleyici
  k.cyl(0.0105, 0.0105, 0.33, [0, 0.025, -0.405], 'metal', { seg: 10 });
  k.cyl(0.0135, 0.0135, 0.06, [0, 0.025, -0.28], 'metal', { seg: 10, sh: 0.9 });
  k.cyl(0.006, 0.006, 0.09, [0, 0.051, -0.3], 'metal', { seg: 8 });
  k.cyl(0.0135, 0.012, 0.05, [0, 0.025, -0.595], 'metal', { seg: 10, sh: 0.85 });
  slots(k, 0.025, -0.6, 0.0122, 0.03);
  // katlanır dikey ön tutamaç (sol el) + namlu bileziği
  k.box([0.03, 0.036, 0.042], [0, 0.016, -0.33], 'furn', { c: 0.004 });
  k.prof([[-0.313, 0.0], [-0.348, 0.0], [-0.358, -0.088], [-0.35, -0.1], [-0.322, -0.1], [-0.312, -0.088]], 0.028, 'furn', { c: 0.005 });
  // tabanca kabzası (dev korkuluğun içinde) + tetik
  pgrip(k, -0.025, 'furn', 0.032, 0);
  trigger(k, -0.045, -0.012);
  k.ring(0.011, 0.0025, [0, -0.07, 0.33], 'metal', { d: 1 });
  // nişangâh: ray üstünde katlanır gez + ön arpacık; optik ray ortasında
  const rear = flipRear(k, 0, 0.116, 0.12, line, iron);
  frontPost(k, -0.235, 0.116, line, iron);
  const sg = iron ? { sight: rear, pivot: [0, line, -0.235], dist: ADS_DIST.iron, overlay: 'none' } : optic(k, o, 0.116, -0.04);
  // şeffaf görünümlü şarjör (grup, kabzanın arkasında)
  const R = bez([0.186, -0.028], [0.182, -0.1], [0.164, -0.172], lod ? 2 : 4), F = bez([0.116, -0.028], [0.11, -0.1], [0.09, -0.162], lod ? 2 : 4);
  k.prof([...R, ...[...F].reverse()], 0.034, 'acc', { c: 0.003, g: 'mag', sh: 1.4 });
  k.prof(stripe(F, R, 0.3, 0.7), 0.0355, 'acc', { g: 'mag', d: 1, sh: 1.0 });
  plate(k, F[F.length - 1], R[R.length - 1], 0.038, 0.01, 'acc', { g: 'mag', c: 0.002 });
  return done(k, mat, { name: 'AUG', hold: 'rifle', gripR: [0, -0.03, 0.015], gripL: [0, -0.04, -0.33], muzzle: [0, 0.025, -0.62], length: 0.99 }, sg);
}

// ───────────────────────── G36 ─────────────────────────
export function g36(mat = skinMaterial('g36'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron', line = 0.148;
  // polimer gövde (şarjör yuvalı), yan kaburga, delikli tutamaç
  k.prof([[0.06, 0.072], [-0.255, 0.072], [-0.255, 0.0], [-0.172, -0.002], [-0.17, -0.04], [-0.07, -0.04], [-0.066, -0.016], [0.012, -0.016], [0.06, 0.002]], 0.05, 'body', { c: 0.004 });
  k.box([0.052, 0.006, 0.28], [0, 0.034, -0.1], 'body', { sh: 0.82, d: 1 });
  k.xsec([[-0.025, 0.0], [0.025, 0.0], [0.029, 0.008], [0.029, 0.064], [0.024, 0.072], [-0.024, 0.072], [-0.029, 0.064], [-0.029, 0.008]], -0.255, -0.5, 'body', { c: 0.004, sh: 1.05 });
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) { k.box([0.003, 0.018, 0.032], [sx * 0.029, 0.046, -0.29 - i * 0.055], 'body', { sh: 0.22 }); k.box([0.003, 0.01, 0.032], [sx * 0.029, 0.02, -0.29 - i * 0.055], 'body', { sh: 0.22, d: 1 }); }
  k.box([0.06, 0.074, 0.01], [0, 0.036, -0.502], 'body', { c: 0.002, sh: 0.85 });                     // uç kapağı
  // taşıma sapı (pencereli) + üst ray; içinde kurma kolu
  k.prof([[0.055, 0.072], [0.055, 0.108], [0.045, 0.118], [-0.25, 0.118], [-0.262, 0.108], [-0.262, 0.072]], 0.034, 'body', { c: 0.003, holes: [[[0.02, 0.08], [-0.215, 0.08], [-0.215, 0.1], [0.02, 0.1]]] });
  rail(k, 0.05, -0.255, 0.118, { w: 0.022 });
  k.box([0.008, 0.014, 0.02], [0, 0.088, -0.19], 'metal', { c: 0.002 });
  k.box([0.03, 0.006, 0.012], [0.02, 0.09, -0.19], 'metal', { c: 0.002, d: 1 });
  // ön kule (tutamaç ucunda) + arpacık
  k.prof([[-0.47, 0.072], [-0.515, 0.072], [-0.508, 0.118], [-0.498, 0.126], [-0.487, 0.126], [-0.477, 0.118]], 0.02, 'body', { c: 0.003 });
  if (iron) { for (const sx of [-1, 1]) k.box([0.003, 0.016, 0.012], [sx * 0.0105, 0.133, -0.4925], 'body', { c: 0.001 }); k.box([0.003, 0.022, 0.003], [0, 0.137, -0.4925], 'acc', { sh: 0.85 }); }
  // namlu + alev gizleyici
  k.cyl(0.0095, 0.0095, 0.13, [0, 0.025, -0.565], 'metal', { seg: 10 });
  k.cyl(0.0125, 0.0125, 0.04, [0, 0.025, -0.65], 'metal', { seg: 10, sh: 0.85 });
  slots(k, 0.025, -0.652, 0.0122, 0.028);
  // kabza, entegre korkuluk, tetik, seçici
  pgrip(k, 0.005, 'furn');
  guard(k, [[0.016, -0.016], [0.018, -0.03], [-0.002, -0.064], [-0.066, -0.064], [-0.066, -0.016]], [[0.006, -0.028], [-0.008, -0.054], [-0.058, -0.054], [-0.058, -0.026]], 0.012, 'furn');
  trigger(k, 0.0);
  k.box([0.004, 0.012, 0.03], [0.026, 0.01, 0.0], 'metal', { d: 1, c: 0.001 });
  // iskelet katlanır dipçik + menteşe + ped
  k.prof([[0.06, 0.07], [0.35, 0.06], [0.37, 0.05], [0.375, -0.08], [0.36, -0.095], [0.33, -0.095], [0.08, -0.02], [0.06, -0.015]], 0.036, 'body', { c: 0.005, holes: [[[0.09, 0.05], [0.33, 0.042], [0.345, 0.03], [0.345, -0.06], [0.33, -0.07], [0.1, -0.003]]] });
  k.prof([[0.373, 0.056], [0.388, 0.056], [0.388, -0.097], [0.373, -0.097]], 0.04, 'furn', { c: 0.004, pat: 1 });
  k.box([0.008, 0.05, 0.022], [0.028, 0.03, 0.07], 'metal', { c: 0.002, d: 1 });
  k.ring(0.011, 0.0025, [0, -0.07, 0.36], 'metal', { d: 1 });
  // nişangâh: sap rayında katlanır gez; optik sap rayının ortasında
  const rear = flipRear(k, 0, 0.126, 0.035, line, iron);
  const sg = iron ? { sight: rear, pivot: [0, line, -0.4925], dist: ADS_DIST.iron, overlay: 'none' } : optic(k, o, 0.126, -0.1);
  // şeffaf görünümlü kavisli şarjör (grup) + yan bağlama tırnakları
  const R = bez([-0.072, -0.04], [-0.078, -0.12], [-0.108, -0.212], lod ? 2 : 5), F = bez([-0.165, -0.04], [-0.174, -0.11], [-0.206, -0.188], lod ? 2 : 5);
  k.prof([...R, ...[...F].reverse()], 0.036, 'acc', { c: 0.003, g: 'mag', sh: 1.6 });
  k.prof(stripe(F, R, 0.35, 0.65), 0.0375, 'acc', { g: 'mag', d: 1, sh: 1.25 });
  for (const sx of [-1, 1]) k.cyl(0.005, 0.005, 0.004, [sx * 0.019, -0.06, -0.16], 'acc', { ax: 'x', seg: 6, d: 1, g: 'mag' });
  plate(k, F[F.length - 1], R[R.length - 1], 0.04, 0.012, 'acc', { g: 'mag', c: 0.003 });
  return done(k, mat, { name: 'G36', hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.03, -0.38], muzzle: [0, 0.025, -0.67], length: 1.08 }, sg);
}

// ───────────────────────── AK-74U (Krinkov) ─────────────────────────
export function ak74u(mat = skinMaterial('ak74u'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron', line = 0.112;
  // gövde (preslenmiş sac) + menteşeli üst kapak (gez kapağın önünde) + kaburgalar, perçinler, kurma / emniyet kolu
  k.box([0.05, 0.072, 0.27], [0, 0.018, -0.08], 'body', { c: 0.005, ax: 'z' });
  k.xsec([[-0.0235, 0.052], [0.0235, 0.052], [0.0235, 0.074], [0.017, 0.087], [0.006, 0.092], [-0.006, 0.092], [-0.017, 0.087], [-0.0235, 0.074]], 0.047, -0.2, 'body', { c: 0.003, sh: 1.08 });
  for (const z of [0.01, -0.06]) k.xsec([[-0.025, 0.06], [0.025, 0.06], [0.025, 0.075], [0.018, 0.0885], [-0.018, 0.0885], [-0.025, 0.075]], z, z - 0.007, 'body', { d: 1, sh: 0.92 });
  k.box([0.054, 0.052, 0.022], [0, 0.022, -0.226], 'body', { c: 0.003, sh: 0.9 });                     // ön trunnion
  k.cyl(0.007, 0.007, 0.058, [0, 0.08, -0.205], 'metal', { ax: 'x', seg: 8 });                        // kapak menteşesi
  k.box([0.003, 0.024, 0.07], [0.0255, 0.04, -0.075], 'body', { sh: 0.32 });
  k.box([0.026, 0.012, 0.016], [0.034, 0.046, -0.11], 'metal', { c: 0.003 });
  k.box([0.004, 0.014, 0.1], [0.0265, 0.028, -0.01], 'metal', { c: 0.0015, rot: [0.06, 0, 0] });
  k.box([0.006, 0.022, 0.012], [0.029, 0.012, 0.042], 'metal', { c: 0.002 });
  for (const [y, z] of [[-0.004, -0.2], [0.044, -0.195], [-0.004, 0.03], [0.044, 0.035]]) for (const sx of [-1, 1]) k.cyl(0.0035, 0.0035, 0.003, [sx * 0.0255, y, z], 'metal', { ax: 'x', seg: 6, d: 1 });
  k.box([0.052, 0.012, 0.03], [0, 0.0, -0.105], 'body', { d: 1, sh: 0.85, c: 0.002 });
  // gez (üst kapağın önünde, "П" çentik): optikte yalnız alçak blok
  k.box([0.026, 0.012, 0.034], [0, 0.097, -0.172], 'metal', { c: 0.002 });
  if (iron) notch(k, -0.165, 0.102, line);
  // kısa tutamaç (vişne bakalit) + gaz borusu, birleşik gaz bloğu / arpacık kulesi
  k.cyl(0.0105, 0.0105, 0.11, [0, 0.064, -0.29], 'metal', { seg: 10 });
  k.xsec([[-0.022, 0.046], [0.022, 0.046], [0.022, 0.068], [0.016, 0.08], [0.006, 0.085], [-0.006, 0.085], [-0.016, 0.08], [-0.022, 0.068]], -0.24, -0.335, 'furn', { c: 0.005 });
  k.prof([[-0.236, 0.043], [-0.345, 0.043], [-0.345, 0.004], [-0.335, -0.012], [-0.25, -0.014], [-0.236, 0.0]], 0.06, 'furn', { c: 0.006 });
  for (const y of [0.012, 0.026]) k.box([0.0615, 0.004, 0.08], [0, y, -0.29], 'furn', { d: 1, sh: 0.7 });
  k.prof([[-0.345, 0.078], [-0.392, 0.078], [-0.396, 0.06], [-0.39, -0.006], [-0.35, -0.006], [-0.345, 0.03]], 0.032, 'metal', { c: 0.004 });
  if (iron) {                                                                                           // 12.139: optikte kulak + arpacık yok (pencerenin içinde dikmeler)
    for (const sx of [-1, 1]) k.box([0.003, 0.026, 0.014], [sx * 0.0095, 0.094, -0.376], 'metal', { c: 0.001 });   // kule kulakları (tepe 0,107)
    k.box([0.003, line - 0.078, 0.003], [0, (0.078 + line) / 2, -0.376], 'metal', { sh: 0.8 });                 // arpacık (tepe = line)
  }
  // kısa namlu + namlu ağzı güçlendirici (silindir + koni)
  k.cyl(0.0095, 0.0095, 0.045, [0, 0.015, -0.41], 'metal', { seg: 10 });
  k.cyl(0.0165, 0.0165, 0.06, [0, 0.015, -0.458], 'metal', { seg: 12, sh: 0.85 });
  k.cyl(0.011, 0.0165, 0.012, [0, 0.015, -0.494], 'metal', { seg: 12, sh: 0.8 });
  if (!lod) for (let i = 0; i < 3; i++) k.ring(0.0166, 0.0012, [0, 0.015, -0.44 - i * 0.012], 'metal', { ax: 'z', seg: 12, rs: 3, sh: 0.5 });
  // kabza (bakalit), korkuluk, tetik, şarjör mandalı
  k.prof([[0.018, -0.016], [0.062, -0.016], [0.068, -0.03], [0.106, -0.138], [0.1, -0.15], [0.062, -0.152], [0.054, -0.142], [0.03, -0.05], [0.018, -0.032]], 0.035, 'furn', { c: 0.006, sh: 0.86, pat: lod ? 0 : 2 });
  guard(k, [[0.034, -0.016], [0.034, -0.024], [0.012, -0.064], [-0.04, -0.064], [-0.05, -0.056], [-0.05, -0.016]], [[0.022, -0.024], [0.005, -0.056], [-0.036, -0.056], [-0.042, -0.05], [-0.042, -0.024]], 0.012);
  trigger(k, 0.006);
  k.box([0.016, 0.02, 0.01], [0, -0.03, -0.075], 'metal', { d: 1, c: 0.002 });
  // iskelet katlanır dipçik: üst / alt kollar (iki yanda), menteşe, delikli dipçik plakası
  k.box([0.05, 0.062, 0.02], [0, 0.02, 0.065], 'body', { c: 0.003, sh: 0.9 });
  for (const sx of [-1, 1]) {
    bar(k, [0.07, 0.048], [0.33, 0.048], 0.008, 0.013, 'body', { x: sx * 0.017, c: 0.002 });
    bar(k, [0.07, -0.004], [0.33, -0.062], 0.008, 0.013, 'body', { x: sx * 0.017, c: 0.002 });
  }
  k.prof([[0.326, 0.062], [0.344, 0.062], [0.344, -0.082], [0.326, -0.082]], 0.044, 'body', { c: 0.004, holes: [[[0.33, 0.03], [0.34, 0.03], [0.34, -0.05], [0.33, -0.05]]], lodNoHoles: true });
  k.box([0.046, 0.12, 0.004], [0, -0.01, 0.346], 'acc', { pat: 1, d: 1 });
  // optik: yan ray kelepçesi + üst kapak üstüne köprü
  let sg;
  if (!iron) {
    akMount(k, 0.098, -0.1, 0.07);                                                                       // toz kapağı ayağı (12.139 tek parça eyer; eski 60 mm köprü + yan kelepçe)
    sg = optic(k, o, 0.098, -0.1);
  } else sg = { sight: [0, line, -0.165], pivot: [0, line, -0.376], dist: ADS_DIST.iron, overlay: 'none' };
  // vişne AK-74 şarjörü (grup): Bézier kenarlar + kenar kaburgaları + taban
  const R = bez([-0.083, -0.016], [-0.092, -0.15], [-0.17, -0.252], lod ? 3 : 7), F = bez([-0.165, -0.016], [-0.18, -0.135], [-0.246, -0.222], lod ? 3 : 7);
  k.prof([...R, ...[...F].reverse()], 0.034, 'furn', { c: 0.004, g: 'mag', sh: 0.95 });
  k.prof(stripe(F, R, 0.0, 0.14), 0.0375, 'furn', { g: 'mag', d: 1, sh: 0.86 });
  k.prof(stripe(F, R, 0.86, 1.0), 0.0375, 'furn', { g: 'mag', d: 1, sh: 0.86 });
  plate(k, F[F.length - 1], R[R.length - 1], 0.04, 0.012, 'furn', { g: 'mag', c: 0.003, sh: 0.8 });
  return done(k, mat, { name: 'AK-74U', hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.03, -0.27], muzzle: [0, 0.015, -0.5], length: 0.88 }, sg);
}

// PSO-1 dürbünü (SVD, 4×): yan ray ayağı + köprü, uzun güneşlik, büyük yükseklik / yan tamburu, pil kapağı, lastik göz kapağı (açık). 12.190: retikül (şevron + BDC) HUD'da, ACOG gibi büyük mercek
function pso(k, yb, z) {
  const cy = yb + 0.034, ze = z + 0.066;
  coverMount(k, [[0.0275, 0.07], [0.0275, 0.0735], [0.02, 0.088], [0.012, yb + 0.006]], [[0.0245, 0.07], [0.0245, 0.072], [0.0175, 0.085], [0.005, 0.0885]], z - 0.01, 0.1);   // kapak ayağı: tek parça eyer (12.139; eski 50 mm köprü + yan ayak merceğin altında geniş plaka)
  k.box([0.014, cy - 0.0152 - yb - 0.006, 0.05], [0, (yb + 0.006 + cy - 0.0152) / 2, z - 0.01], 'acc', { c: 0.0015 });   // ayak (tepesi borunun alt yüzünde: dürbün camından görünmez)
  if (k.lod) { k.cyl(0.02, 0.0165, 0.24, [0, cy, z - 0.04], 'acc', { seg: 6 }); return { sight: [0, cy, ze], dist: ADS_DIST.pso, overlay: 'lens' }; }
  k.cyl(0.0155, 0.0155, 0.12, [0, cy, z - 0.005], 'acc', { seg: 16 });                                   // gövde borusu
  k.cyl(0.021, 0.0155, 0.03, [0, cy, z - 0.08], 'acc', { seg: 18 });                                     // objektif konisi
  k.cyl(0.021, 0.021, 0.07, [0, cy, z - 0.13], 'acc', { seg: 18, sh: 0.92 });                            // güneşlik
  k.cyl(0.0175, 0.0165, 0.022, [0, cy, z + 0.054], 'acc', { seg: 18 });                                  // göz merceği çanı (12.162: 18,5 → 17,5 mm, ince göz kapağının arkasında kalır)
  k.xsec(circ(0, cy, 0.0178, 24), ze + 0.0002, ze - 0.012, 'acc', { holes: [circ(0, cy, 0.0166, 24)], c: 0.0005, cap: 1, sh: 0.7 });      // 12.162: dış 19 → 17,8 mm (ince kenar)      // 12.129: kapak ön yüzü PiP diskiyle aynı düzlemde (12.128'de 16 mm öndeydi → mercek içinde kalın gri halka), ince kenar      // lastik göz kapağı: kalın halka (12.128; eski açık tüpün içi görünmüyordu, PiP merceği çerçevesiz kalıyordu)
  k.cyl(0.0095, 0.0095, 0.007, [0, cy + 0.0175, z - 0.01], 'acc', { ax: 'y', seg: 12, pat: 2 });         // yükseklik tamburu (12.139: tepe cy+27,5 → 21 mm; %70 nişanda göz kapağı halkasının üstünden taşıyordu)
  k.cyl(0.009, 0.009, 0.007, [0.0185, cy, z - 0.01], 'acc', { ax: 'x', seg: 12, pat: 2 });               // yan tambur (dış uç 26,5 → 22 mm)
  k.cyl(0.0055, 0.0055, 0.007, [-0.0185, cy, z - 0.05], 'acc', { ax: 'x', seg: 8, d: 1 });               // aydınlatma pil kapağı (12.139: yanda, alçak; eskiden sol üstte çıkıntı)
  k.cyl(0.0195, 0.0195, 0.002, [0, cy, z - 0.164], 'lens', { seg: 18 });
  k.cyl(0.0165, 0.0165, 0.002, [0, cy, ze - 0.001], 'lens', { seg: 18 });
  return { sight: [0, cy, ze], dist: ADS_DIST.pso, overlay: 'lens', lens: [0.0165, 0, cy, ze + 0.0003, 0] };      // 12.162: ACOG ile aynı saydam mercek (derinlik maskesi)
}

// ───────────────────────── SVD Dragunov ─────────────────────────
export function svd(mat = skinMaterial('svd'), lod = false, o = 'acog') {
  const k = newKit(lod);
  // gövde + kubbeli üst kapak + kaburgalar, sol yan ray, kurma / emniyet kolu, trunnion
  k.box([0.046, 0.07, 0.32], [0, 0.02, -0.1], 'body', { c: 0.005, ax: 'z' });
  k.xsec([[-0.0215, 0.053], [0.0215, 0.053], [0.0215, 0.072], [0.015, 0.083], [0.005, 0.087], [-0.005, 0.087], [-0.015, 0.083], [-0.0215, 0.072]], 0.05, -0.245, 'body', { c: 0.003, sh: 1.08 });
  for (const z of [-0.02, -0.1, -0.18]) k.xsec([[-0.023, 0.06], [0.023, 0.06], [0.023, 0.073], [0.016, 0.0845], [-0.016, 0.0845], [-0.023, 0.073]], z, z - 0.007, 'body', { d: 1, sh: 0.92 });
  k.box([0.006, 0.026, 0.17], [-0.026, 0.026, -0.09], 'body', { c: 0.0015, sh: 0.88 });
  k.box([0.003, 0.022, 0.07], [0.0235, 0.04, -0.1], 'body', { sh: 0.32 });
  k.box([0.024, 0.012, 0.016], [0.032, 0.044, -0.14], 'metal', { c: 0.003 });
  k.box([0.004, 0.014, 0.1], [0.0245, 0.026, -0.0], 'metal', { c: 0.0015, rot: [0.06, 0, 0] });
  k.box([0.05, 0.05, 0.02], [0, 0.024, -0.265], 'body', { c: 0.003, sh: 0.9 });
  k.box([0.048, 0.012, 0.03], [0, -0.012, -0.12], 'body', { d: 1, sh: 0.85, c: 0.002 });
  for (const [y, z] of [[0.0, -0.24], [0.04, -0.235], [0.0, 0.03]]) for (const sx of [-1, 1]) k.cyl(0.0032, 0.0032, 0.003, [sx * 0.0235, y, z], 'metal', { ax: 'x', seg: 6, d: 1 });
  // havalandırma yarıklı ahşap tutamaç + bilezikler, gaz bloğu
  k.xsec([[-0.022, -0.012], [0.022, -0.012], [0.028, 0.0], [0.028, 0.05], [0.02, 0.064], [-0.02, 0.064], [-0.028, 0.05], [-0.028, 0.0]], -0.27, -0.555, 'furn', { c: 0.006 });
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) k.box([0.003, 0.012, 0.03], [sx * 0.028, 0.03, -0.3 - i * 0.045], 'furn', { sh: 0.25, d: i > 3 ? 1 : 0 });
  for (const z of [-0.272, -0.556]) k.box([0.06, 0.08, 0.01], [0, 0.026, z], 'metal', { c: 0.003 });
  k.prof([[-0.562, 0.062], [-0.6, 0.062], [-0.604, 0.048], [-0.598, 0.004], [-0.565, 0.004], [-0.562, 0.024]], 0.03, 'metal', { c: 0.004 });
  // uzun namlu, arpacık bloğu (kulaklı), süngü tırnağı, yarıklı alev gizleyici
  k.cyl(0.0085, 0.0095, 0.4, [0, 0.03, -0.8], 'metal', { seg: 10 });
  k.prof([[-0.95, 0.072], [-0.985, 0.072], [-0.985, 0.016], [-0.95, 0.016]], 0.022, 'metal', { c: 0.003 });
  for (const sx of [-1, 1]) k.box([0.003, 0.026, 0.016], [sx * 0.0085, 0.08, -0.968], 'metal', { c: 0.001, d: 1 });
  k.box([0.003, 0.014, 0.003], [0, 0.079, -0.968], 'metal', { d: 1 });
  k.box([0.014, 0.018, 0.024], [0, 0.006, -0.968], 'metal', { d: 1, c: 0.002 });
  k.cyl(0.012, 0.012, 0.07, [0, 0.03, -1.035], 'metal', { seg: 10, sh: 0.85 });
  slots(k, 0.03, -1.04, 0.0118, 0.05, 5, 0.3);
  // iskelet (başparmak delikli) ahşap dipçik + yanak dayanağı + dipçik plakası
  k.prof([[0.055, 0.052], [0.11, 0.05], [0.14, 0.07], [0.34, 0.072], [0.4, 0.062], [0.405, 0.055], [0.405, -0.118], [0.39, -0.128], [0.26, -0.085], [0.15, -0.068], [0.115, -0.075], [0.105, -0.13], [0.095, -0.14], [0.06, -0.138], [0.052, -0.128], [0.03, -0.05], [0.02, -0.03], [0.02, -0.015], [0.055, -0.015]], 0.044, 'furn',
    { c: 0.007, holes: [[[0.132, 0.04], [0.31, 0.046], [0.33, 0.036], [0.33, -0.052], [0.25, -0.062], [0.152, -0.05], [0.132, -0.035]]], lodNoHoles: false });
  k.box([0.046, 0.016, 0.13], [0, 0.079, 0.22], 'furn', { c: 0.004, sh: 0.78 });
  k.prof([[0.405, 0.057], [0.418, 0.057], [0.418, -0.12], [0.405, -0.12]], 0.046, 'metal', { c: 0.003 });
  k.prof([[0.035, -0.06], [0.058, -0.068], [0.09, -0.13], [0.065, -0.132], [0.05, -0.12]], 0.0445, 'furn', { d: 1, pat: 1, sh: 0.9 });   // kabza tırtılı
  // korkuluk + tetik + şarjör mandalı, askı halkaları
  guard(k, [[0.03, -0.016], [0.03, -0.024], [0.01, -0.062], [-0.04, -0.062], [-0.05, -0.054], [-0.05, -0.016]], [[0.018, -0.024], [0.004, -0.054], [-0.036, -0.054], [-0.042, -0.048], [-0.042, -0.024]], 0.012);
  trigger(k, 0.0, -0.016);
  k.box([0.016, 0.02, 0.01], [0, -0.026, -0.085], 'metal', { d: 1, c: 0.002 });
  k.ring(0.011, 0.0025, [0, -0.115, 0.37], 'metal', { d: 1 }); k.ring(0.011, 0.0025, [0, -0.016, -0.5], 'metal', { d: 1 });
  // PSO-1 (yan ray, 4×) · 12.190: 6× / 8× takılınca aynı kapak eyerinin üstünde uzatmalı tabanla
  let sg;
  if (o === 'x6' || o === 'x8') {
    coverMount(k, [[0.0275, 0.07], [0.0275, 0.0735], [0.02, 0.088], [0.012, 0.098]], [[0.0245, 0.07], [0.0245, 0.072], [0.0175, 0.085], [0.005, 0.0885]], -0.07, 0.1);
    sg = optic(k, o, 0.098, -0.04);
  } else sg = pso(k, 0.092, -0.06);
  // 10'luk şarjör (grup): hafif kavis, kabartma oluk, taban
  const R = bez([-0.087, -0.015], [-0.09, -0.07], [-0.102, -0.116], lod ? 2 : 4), F = bez([-0.165, -0.015], [-0.17, -0.065], [-0.188, -0.106], lod ? 2 : 4);
  k.prof([...R, ...[...F].reverse()], 0.03, 'body', { c: 0.003, g: 'mag', sh: 0.95 });
  k.prof(stripe(F, R, 0.25, 0.75), 0.0325, 'body', { g: 'mag', d: 1, sh: 0.85 });
  plate(k, F[F.length - 1], R[R.length - 1], 0.034, 0.01, 'metal', { g: 'mag', c: 0.002 });
  return done(k, mat, { name: 'SVD', hold: 'rifle', gripR: [0, -0.03, 0.05], gripL: [0, -0.03, -0.42], muzzle: [0, 0.03, -1.07], length: 1.5 }, sg);
}

// ───────────────────────── Barrett M82A1 ─────────────────────────
export function barrett(mat = skinMaterial('barrett'), lod = false, o = 'scope6') {
  const k = newKit(lod), cy = 0.148, ze = 0.137;
  // üst gövde (uzun sac kutu, önde büyük hafifletme pencereleri) + tam boy ray, kurma kolu, alt gövde (şarjör yuvası)
  k.xsec([[-0.033, 0.0], [0.033, 0.0], [0.033, 0.085], [0.027, 0.095], [-0.027, 0.095], [-0.033, 0.085]], 0.17, -0.62, 'body', { c: 0.005 });
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) { k.box([0.003, 0.03, 0.05], [sx * 0.033, 0.048, -0.37 - i * 0.085], 'body', { sh: 0.22, d: 1 }); for (const dz of [-0.025, 0.025]) k.cyl(0.015, 0.015, 0.003, [sx * 0.033, 0.048, -0.37 - i * 0.085 + dz], 'body', { ax: 'x', seg: 10, sh: 0.22, d: 1 }); }
  k.box([0.068, 0.006, 0.4], [0, 0.03, -0.2], 'body', { sh: 0.85, d: 1 });
  k.box([0.003, 0.03, 0.09], [0.033, 0.058, -0.12], 'body', { sh: 0.3, d: 1 });
  k.box([0.016, 0.016, 0.03], [0.042, 0.06, -0.2], 'metal', { c: 0.003, d: 1 });
  rail(k, 0.12, -0.44, 0.095, { w: 0.03 });
  k.prof([[0.17, 0.001], [-0.2, 0.001], [-0.2, -0.02], [-0.17, -0.03], [-0.165, -0.046], [-0.035, -0.046], [-0.03, -0.03], [0.02, -0.026], [0.17, -0.03]], 0.06, 'furn', { c: 0.004 });
  for (const [y, z] of [[0.07, 0.1], [0.07, -0.3], [0.02, -0.55], [0.07, -0.55]]) for (const sx of [-1, 1]) k.cyl(0.005, 0.005, 0.003, [sx * 0.034, y, z], 'metal', { ax: 'x', seg: 6, d: 1 });
  // dipçik + yanak yastığı + kalın lastik ped, katlı monopod
  k.prof([[0.165, 0.095], [0.4, 0.095], [0.44, 0.085], [0.445, -0.095], [0.43, -0.105], [0.38, -0.1], [0.3, -0.07], [0.2, -0.045], [0.165, -0.035]], 0.058, 'furn', { c: 0.006 });
  k.box([0.06, 0.014, 0.17], [0, 0.102, 0.3], 'acc', { c: 0.004 });
  k.prof([[0.44, 0.088], [0.478, 0.088], [0.478, -0.104], [0.445, -0.1]], 0.062, 'acc', { c: 0.005, pat: 1 });
  k.box([0.02, 0.03, 0.12], [0, -0.09, 0.36], 'metal', { c: 0.003, d: 1, rot: [-0.33, 0, 0] });
  // kabza, korkuluk, tetik
  pgrip(k, 0.02, 'furn', 0.036);
  guard(k, [[0.03, -0.028], [0.032, -0.04], [0.012, -0.075], [-0.03, -0.075], [-0.03, -0.03]], [[0.02, -0.04], [0.006, -0.066], [-0.022, -0.066], [-0.022, -0.036]], 0.012, 'furn');
  trigger(k, 0.01, -0.03);
  // namlu bileziği, yivli kalın namlu, ok ucu çift odalı namlu freni
  k.cyl(0.026, 0.026, 0.06, [0, 0.05, -0.65], 'body', { seg: 12, sh: 0.9 });
  k.cyl(0.016, 0.018, 0.34, [0, 0.05, -0.85], 'metal', { seg: 12 });
  if (!lod) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.box([0.004, 0.002, 0.28], [Math.cos(a) * 0.0165, 0.05 + Math.sin(a) * 0.0165, -0.86], 'metal', { sh: 0.45, rot: [0, 0, a + Math.PI / 2] }); }
  topShape(k, [[0.0, -1.13], [0.038, -1.098], [0.038, -1.018], [-0.038, -1.018], [-0.038, -1.098]], 0.025, 0.075, 'metal', { c: 0.003 });
  for (const z of [-1.04, -1.078]) for (const sx of [-1, 1]) k.box([0.004, 0.034, 0.024], [sx * 0.0375, 0.05, z], 'metal', { sh: 0.15, d: 1 });
  // katlı çift ayak (namlu altında öne yatık) + boyunduruk
  k.box([0.074, 0.03, 0.034], [0, 0.026, -0.672], 'metal', { c: 0.004 });
  for (const sx of [-1, 1]) { k.box([0.012, 0.014, 0.3], [sx * 0.03, 0.012, -0.83], 'metal', { c: 0.003 }); k.box([0.02, 0.012, 0.03], [sx * 0.03, 0.008, -0.985], 'metal', { c: 0.003, d: 1 }); }
  // taşıma sapı (dürbünün önünde, alçak)
  k.prof([[-0.33, 0.103], [-0.43, 0.103], [-0.425, 0.124], [-0.415, 0.13], [-0.345, 0.13], [-0.335, 0.124]], 0.016, 'acc', { c: 0.003, d: 1, holes: [[[-0.345, 0.108], [-0.415, 0.108], [-0.415, 0.122], [-0.345, 0.122]]] });
  // 10× dürbün: halkalar, gövde, objektif / göz çanları, kuleler, mercekler, göz merceğinde ince artı (12.190: 8× takılınca rayda o dürbün)
  const mounted = o === 'x8', sg = mounted ? optic(k, o, 0.103, 0.0) : { sight: [0, cy, ze], dist: ADS_DIST.scope, overlay: 'scope' };
  if (!mounted) {
  for (const z of [0.03, -0.15]) { k.box([0.03, 0.026, 0.022], [0, 0.116, z], 'acc', { c: 0.003 }); k.ring(0.0235, 0.0045, [0, cy, z], 'acc', { ax: 'z', seg: 12, d: 1 }); }   // halka / ayak borunun dışında (camdan görünmez)
  k.cyl(0.019, 0.019, 0.26, [0, cy, -0.07], 'acc', { seg: 14 });
  k.cyl(0.03, 0.019, 0.05, [0, cy, -0.225], 'acc', { seg: 16 });
  k.cyl(0.03, 0.03, 0.05, [0, cy, -0.275], 'acc', { seg: 16, sh: 0.88 });
  k.cyl(0.019, 0.024, 0.04, [0, cy, 0.08], 'acc', { seg: 16 });
  k.cyl(0.024, 0.024, 0.036, [0, cy, 0.118], 'acc', { seg: 16, sh: 0.85 });
  k.cyl(0.0145, 0.0145, 0.026, [0, cy + 0.032, -0.06], 'acc', { ax: 'y', seg: 10, d: 1 });
  k.cyl(0.0145, 0.0145, 0.026, [0.032, cy, -0.06], 'acc', { ax: 'x', seg: 10, d: 1 });
  if (!lod) { k.cyl(0.0155, 0.0155, 0.007, [0, cy + 0.048, -0.06], 'acc', { ax: 'y', seg: 10, pat: 2, sh: 0.8 }); k.cyl(0.0155, 0.0155, 0.007, [0.048, cy, -0.06], 'acc', { ax: 'x', seg: 10, pat: 2, sh: 0.8 }); }
  k.cyl(0.027, 0.027, 0.002, [0, cy, -0.301], 'lens', { seg: 16 });
  k.cyl(0.021, 0.021, 0.002, [0, cy, ze - 0.001], 'lens', { seg: 16, d: 1 });
  cross(k, cy, ze + 0.0004);
  }
  // 10'luk kutu şarjör (grup)
  k.prof([[-0.038, -0.04], [-0.162, -0.04], [-0.162, -0.13], [-0.038, -0.13]], 0.052, 'body', { c: 0.004, g: 'mag' });
  for (let i = 0; i < 3; i++) k.box([0.054, 0.06, 0.008], [0, -0.085, -0.06 - i * 0.04], 'body', { g: 'mag', d: 1, sh: 0.85 });
  k.box([0.058, 0.012, 0.13], [0, -0.136, -0.1], 'metal', { g: 'mag', c: 0.003 });
  return done(k, mat, { name: 'Barrett .50', hold: 'rifle', gripR: [0, -0.03, 0.06], gripL: [0, -0.05, -0.5], muzzle: [0, 0.05, -1.13], length: 1.65 }, sg);
}

// ───────────────────────── AA-12 ─────────────────────────
export function aa12(mat = skinMaterial('aa12'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron', line = 0.127;
  // düz hatlı uzun gövde (şarjör yuvalı), yan oluk, üst taşıma rayı, alt ray, kurma kolu (sol)
  k.prof([[0.21, 0.085], [-0.46, 0.085], [-0.46, -0.008], [-0.12, -0.01], [-0.115, -0.025], [-0.005, -0.025], [0.0, -0.012], [0.21, -0.012]], 0.062, 'body', { c: 0.006 });
  for (const sx of [-1, 1]) k.box([0.003, 0.008, 0.6], [sx * 0.031, 0.05, -0.13], 'body', { sh: 0.5, d: 1 });
  k.box([0.003, 0.026, 0.08], [0.031, 0.06, -0.06], 'body', { sh: 0.3 });
  k.box([0.034, 0.012, 0.36], [0, 0.091, -0.08], 'body', { c: 0.003, sh: 0.9 });
  rail(k, 0.1, -0.255, 0.097, { w: 0.024 });
  k.box([0.024, 0.008, 0.16], [0, -0.014, -0.33], 'acc', { c: 0.0015 });
  if (!lod) for (let i = 0; i < 6; i++) k.box([0.026, 0.003, 0.009], [0, -0.0185, -0.265 - i * 0.026], 'acc', { sh: 0.55 });
  k.box([0.016, 0.014, 0.024], [-0.038, 0.062, -0.2], 'metal', { c: 0.003 });
  k.box([0.003, 0.008, 0.14], [-0.031, 0.062, -0.16], 'body', { sh: 0.35, d: 1 });
  // dipçik (gövdeyle aynı hat) + ped
  k.prof([[0.21, 0.085], [0.38, 0.08], [0.4, 0.07], [0.4, -0.075], [0.385, -0.085], [0.35, -0.08], [0.21, -0.012]], 0.058, 'furn', { c: 0.006 });
  k.prof([[0.398, 0.072], [0.418, 0.072], [0.418, -0.086], [0.398, -0.078]], 0.06, 'acc', { c: 0.004, pat: 1 });
  // havalandırmalı namlu kılıfı (sekizgen), kısa namlu + fren
  k.xsec([[-0.024, 0.012], [0.024, 0.012], [0.03, 0.022], [0.03, 0.064], [0.024, 0.074], [-0.024, 0.074], [-0.03, 0.064], [-0.03, 0.022]], -0.46, -0.68, 'body', { c: 0.003, sh: 1.05 });
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) k.box([0.003, 0.02, 0.03], [sx * 0.03, 0.043, -0.49 - i * 0.05], 'body', { sh: 0.2 });
  if (!lod) for (let i = 0; i < 4; i++) k.box([0.02, 0.003, 0.026], [0, 0.0745, -0.49 - i * 0.05], 'body', { sh: 0.2 });
  k.cyl(0.0125, 0.0125, 0.04, [0, 0.04, -0.7], 'metal', { seg: 10 });
  k.cyl(0.019, 0.019, 0.03, [0, 0.04, -0.735], 'metal', { seg: 12, sh: 0.85 });
  slots(k, 0.04, -0.736, 0.0185, 0.02, 4, 0);
  // ön kule + arpacık (kılıf ucunda)
  k.prof([[-0.655, 0.074], [-0.68, 0.074], [-0.678, 0.104], [-0.672, 0.11], [-0.663, 0.11], [-0.657, 0.104]], 0.018, 'body', { c: 0.002 });
  if (iron) { for (const sx of [-1, 1]) k.box([0.003, 0.014, 0.012], [sx * 0.0105, 0.117, -0.6675], 'body', { c: 0.001 }); k.box([0.003, line - 0.11, 0.003], [0, (0.11 + line) / 2, -0.6675], 'acc', { sh: 0.85 }); }
  // kabza, korkuluk, tetik
  pgrip(k, 0.04);
  guard(k, [[0.054, -0.012], [0.056, -0.026], [0.036, -0.06], [0.0, -0.06], [0.0, -0.012]], [[0.044, -0.024], [0.03, -0.051], [0.008, -0.051], [0.008, -0.022]], 0.012, 'furn');
  trigger(k, 0.04, -0.012);
  k.ring(0.011, 0.0025, [0, -0.07, 0.37], 'metal', { d: 1 });
  // nişangâh: ray üstünde katlanır gez; optik ray ortasında
  const rear = flipRear(k, 0, 0.105, 0.06, line, iron);
  const sg = iron ? { sight: rear, pivot: [0, line, -0.6675], dist: ADS_DIST.iron, overlay: 'none' } : optic(k, o, 0.105, -0.08);
  // 8'lik kutu şarjör (grup): kaburgalı, taban
  k.prof([[-0.01, -0.012], [-0.11, -0.012], [-0.112, -0.2], [-0.008, -0.2]], 0.05, 'acc', { c: 0.005, g: 'mag', sh: 1.2 });
  for (const y of [-0.065, -0.115, -0.165]) k.box([0.053, 0.008, 0.104], [0, y, -0.06], 'acc', { g: 'mag', sh: 0.9, c: 0.002 });
  k.box([0.056, 0.012, 0.108], [0, -0.204, -0.06], 'metal', { g: 'mag', c: 0.003 });
  return done(k, mat, { name: 'AA-12', hold: 'rifle', gripR: [0, -0.03, 0.08], gripL: [0, -0.04, -0.34], muzzle: [0, 0.04, -0.75], length: 1.2 }, sg);
}

// ───────────────────────── Çift Namlu (yan yana av tüfeği) ─────────────────────────
export function dbl(mat = skinMaterial('dbl'), lod = false) {
  const k = newKit(lod), line = 0.075;
  // yan yana iki namlu + üst / alt şerit, namlu ağzı bileziği
  for (const sx of [-1, 1]) { k.cyl(0.0155, 0.0165, 0.64, [sx * 0.0172, 0.045, -0.4], 'body', { seg: 14 }); k.cyl(0.0162, 0.0162, 0.012, [sx * 0.0172, 0.045, -0.714], 'body', { seg: 14, sh: 0.85, d: 1 }); k.cyl(0.0172, 0.0172, 0.03, [sx * 0.0172, 0.045, -0.095], 'body', { seg: 14, sh: 0.92, d: 1 }); }
  k.box([0.012, 0.006, 0.62], [0, 0.063, -0.39], 'body', { sh: 0.92 });
  k.box([0.01, 0.006, 0.4], [0, 0.026, -0.5], 'body', { sh: 0.9, d: 1 });
  // kırma gövde (oymalı yan plakalar), menteşe pimi, üst açma kolu, iki horoz
  k.prof([[0.045, 0.03], [0.02, 0.052], [-0.02, 0.066], [-0.08, 0.066], [-0.08, -0.004], [-0.05, -0.012], [0.02, -0.012], [0.045, 0.0]], 0.06, 'metal', { c: 0.004 });   // arka omuzlar eğik: nişanda şerit görünür
  for (const sx of [-1, 1]) k.prof([[0.03, 0.034], [0.0, 0.05], [-0.07, 0.05], [-0.07, 0.002], [-0.045, -0.004], [0.02, -0.004]], 0.004, 'metal', { x: sx * 0.03, d: 1, sh: 1.2, pat: 2 });
  k.cyl(0.008, 0.008, 0.062, [0, 0.005, -0.075], 'metal', { ax: 'x', seg: 8 });
  k.box([0.012, 0.006, 0.026], [0, 0.044, 0.03], 'metal', { c: 0.002, rot: [0.72, 0, 0] });
  k.box([0.026, 0.006, 0.01], [0.014, 0.038, 0.04], 'metal', { c: 0.002, rot: [0.72, 0.5, 0], d: 1 });
  for (const sx of [-1, 1]) k.prof([[0.026, 0.034], [0.04, 0.03], [0.05, 0.052], [0.044, 0.058], [0.034, 0.054]], 0.008, 'metal', { x: sx * 0.016, c: 0.001 });   // horozlar (nişan çizgisinin altında)
  for (const sx of [-1, 1]) { for (const [y, z] of [[0.045, 0.0], [0.045, -0.05], [0.01, -0.05], [0.01, 0.0]]) k.cyl(0.0032, 0.0032, 0.003, [sx * 0.0315, y, z], 'metal', { ax: 'x', seg: 8, d: 1 }); k.box([0.004, 0.014, 0.014], [sx * 0.031, 0.002, -0.075], 'metal', { c: 0.001, d: 1 }); }   // gövde vidaları + menteşe kulakları
  k.box([0.052, 0.012, 0.02], [0, 0.026, -0.312], 'metal', { c: 0.003 });                              // kundak ucu metali
  k.box([0.03, 0.01, 0.04], [0, 0.045, 0.06], 'metal', { c: 0.002, rot: [0.25, 0, 0], d: 1 });         // dipçik bileği plakası (sırt)
  // ahşap ön kundak + kilit dili
  k.prof([[-0.085, 0.036], [-0.3, 0.036], [-0.31, 0.03], [-0.31, 0.012], [-0.29, 0.0], [-0.1, -0.004], [-0.085, 0.0]], 0.062, 'furn', { c: 0.006 });
  k.box([0.012, 0.008, 0.022], [0, -0.004, -0.29], 'metal', { c: 0.002, d: 1 });
  // yarım tabanca kabzalı ahşap dipçik + kabza tırtılı + dipçik plakası
  k.prof([[0.045, 0.062], [0.1, 0.05], [0.405, 0.028], [0.41, 0.026], [0.41, -0.104], [0.395, -0.11], [0.3, -0.085], [0.17, -0.055], [0.12, -0.072], [0.108, -0.096], [0.085, -0.1], [0.07, -0.09], [0.05, -0.035], [0.045, -0.012]], 0.04, 'furn', { c: 0.008 });
  k.prof([[0.15, 0.046], [0.3, 0.038], [0.3, 0.024], [0.15, 0.03]], 0.0405, 'furn', { d: 1, sh: 0.88 });   // tarak çizgisi
  k.prof([[0.06, -0.03], [0.105, -0.04], [0.11, -0.095], [0.085, -0.1], [0.07, -0.09]], 0.0435, 'furn', { d: 1, pat: 1, sh: 0.9 });
  k.prof([[0.41, 0.028], [0.425, 0.028], [0.425, -0.108], [0.41, -0.106]], 0.042, 'acc', { c: 0.003 });
  for (let i = 0; i < 4; i++) k.box([0.0625, 0.0025, 0.03], [0, 0.0, -0.14 - i * 0.04], 'furn', { d: 1, pat: 1, sh: 0.9 });   // ön kundak tırtılı
  // korkuluk + iki tetik, askı halkaları
  guard(k, [[0.04, -0.012], [0.042, -0.024], [0.022, -0.058], [-0.04, -0.058], [-0.046, -0.012]], [[0.03, -0.02], [0.016, -0.05], [-0.034, -0.05], [-0.038, -0.02]], 0.01);
  trigger(k, 0.018, -0.012); trigger(k, -0.004, -0.012);
  k.ring(0.011, 0.0025, [0, -0.11, 0.38], 'metal', { d: 1 }); k.ring(0.011, 0.0025, [0, 0.01, -0.33], 'metal', { d: 1 });
  // demir nişan: şerit arkasında U çentik, namlu ucunda boncuk (tepe = line)
  notch(k, -0.03, 0.064, line, 0.009, 0.0026, 'acc');
  k.box([0.003, line - 0.066, 0.003], [0, (0.066 + line) / 2, -0.705], 'acc', { sh: 1.2 });
  return done(k, mat, { name: 'Çift Namlu', hold: 'rifle', gripR: [0, -0.03, 0.055], gripL: [0, -0.03, -0.22], muzzle: [0, 0.045, -0.72], length: 1.14 },
    { sight: [0, line, -0.03], pivot: [0, line, -0.705], dist: ADS_DIST.iron, overlay: 'none' });   // yakın düzlem kırma gövdenin arkasında: gövde kesilmez (namlu dipleri görünmez), dipçik kesilir
}

// ───────────────────────── M79 bomba atar ─────────────────────────
export function m79(mat = skinMaterial('m79'), lod = false) {
  const k = newKit(lod), line = 0.098, zl = -0.047;
  // kalın namlu + ağız bileziği, kırma gövde, açma kolu, menteşe
  k.cyl(0.026, 0.026, 0.4, [0, 0.045, -0.27], 'body', { seg: 18 });
  k.cyl(0.0285, 0.0285, 0.018, [0, 0.045, -0.461], 'body', { seg: 14, sh: 0.85 });
  k.cyl(0.0285, 0.0285, 0.016, [0, 0.045, -0.12], 'body', { seg: 14, sh: 0.9, d: 1 });
  k.box([0.054, 0.082, 0.12], [0, 0.029, -0.01], 'body', { c: 0.005, ax: 'z', sh: 0.92 });
  k.box([0.012, 0.012, 0.03], [0, 0.076, 0.03], 'metal', { c: 0.002 });
  k.box([0.03, 0.006, 0.012], [0.016, 0.078, 0.04], 'metal', { c: 0.002, rot: [0, 0.4, 0], d: 1 });
  k.cyl(0.008, 0.008, 0.058, [0, 0.0, -0.07], 'metal', { ax: 'x', seg: 8 });
  k.box([0.008, 0.014, 0.02], [0, 0.076, 0.004], 'metal', { d: 1, c: 0.001 });                         // emniyet
  for (const sx of [-1, 1]) { k.prof([[0.04, 0.06], [-0.06, 0.06], [-0.06, 0.0], [0.04, -0.006]], 0.004, 'body', { x: sx * 0.027, d: 1, sh: 0.86, c: 0.001 }); for (const [y, z] of [[0.05, 0.02], [0.05, -0.045], [0.008, -0.045]]) k.cyl(0.0035, 0.0035, 0.003, [sx * 0.0295, y, z], 'metal', { ax: 'x', seg: 8, d: 1 }); }   // yan plakalar + vidalar
  k.box([0.006, 0.006, 0.3], [0, 0.072, -0.28], 'body', { sh: 0.9, d: 1, c: 0.001 });                  // namlu üst sırtı
  if (!lod) for (let i = 0; i < 5; i++) k.box([0.006, 0.0012, 0.002], [0.0115, 0.08 + i * 0.008, zl - 0.0032], 'metal', { sh: 1.5 });   // merdiven çizgileri
  // ahşap ön kundak
  k.prof([[-0.085, 0.03], [-0.3, 0.03], [-0.31, 0.022], [-0.31, 0.01], [-0.295, 0.002], [-0.1, -0.004], [-0.085, 0.002]], 0.06, 'furn', { c: 0.006 });
  for (let i = 0; i < 4; i++) k.box([0.061, 0.003, 0.01], [0, 0.004, -0.17 - i * 0.022], 'furn', { d: 1, sh: 0.7 });
  // ahşap dipçik + kalın lastik ped
  k.prof([[0.05, 0.062], [0.1, 0.05], [0.33, 0.03], [0.34, 0.03], [0.34, -0.105], [0.325, -0.11], [0.22, -0.08], [0.13, -0.05], [0.1, -0.075], [0.09, -0.1], [0.065, -0.105], [0.05, -0.09], [0.04, -0.035], [0.05, -0.012]], 0.046, 'furn', { c: 0.008 });
  k.prof([[0.338, 0.034], [0.378, 0.034], [0.378, -0.114], [0.338, -0.108]], 0.05, 'acc', { c: 0.005, pat: 1 });
  // korkuluk + tetik, askı halkaları
  guard(k, [[0.045, -0.012], [0.047, -0.024], [0.027, -0.058], [-0.035, -0.058], [-0.04, -0.012]], [[0.035, -0.02], [0.021, -0.05], [-0.029, -0.05], [-0.032, -0.02]], 0.01);
  trigger(k, 0.01, -0.012);
  k.ring(0.011, 0.0025, [0, -0.1, 0.33], 'metal', { d: 1 }); k.ring(0.011, 0.0025, [0, 0.012, -0.3], 'metal', { d: 1 });
  // merdiven gez (açık): iki ray + üst köprü + delikli sürgü (delik = line); namlu ucunda kulaklı arpacık
  k.box([0.03, 0.008, 0.03], [0, 0.074, zl], 'acc', { c: 0.002 });
  for (const sx of [-1, 1]) k.box([0.004, 0.05, 0.006], [sx * 0.0115, 0.1, zl], 'acc', { c: 0.0008 });
  k.box([0.027, 0.005, 0.006], [0, 0.1245, zl], 'acc', { c: 0.0008 });
  k.xsec([[-0.0095, line - 0.011], [0.0095, line - 0.011], [0.0095, line + 0.011], [-0.0095, line + 0.011]], zl + 0.002, zl - 0.002, 'acc', { holes: [circ(0, line, 0.0062, 16)], c: 0.0006 });
  k.box([0.014, 0.008, 0.024], [0, 0.074, -0.445], 'acc', { c: 0.002 });
  for (const sx of [-1, 1]) k.box([0.0035, 0.014, 0.012], [sx * 0.0075, 0.084, -0.445], 'acc', { c: 0.0008 });
  k.box([0.0035, line - 0.078, 0.008], [0, (0.078 + line) / 2, -0.445], 'acc', { sh: 0.9 });
  return done(k, mat, { name: 'M79', hold: 'rifle', gripR: [0, -0.03, 0.05], gripL: [0, -0.03, -0.2], muzzle: [0, 0.045, -0.47], length: 0.86 },
    { sight: [0, line, zl], pivot: [0, line, -0.445], dist: ADS_DIST.iron, overlay: 'none' });
}

export const S3R = { scarh, aug, g36, ak74u, svd, barrett, aa12, dbl, m79 };
