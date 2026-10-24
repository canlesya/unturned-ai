import { rail, bez } from './s3kit.js';
import { skinMaterial } from './skins.js';
import { S3PARTS, ADS_DIST } from './s3weapons.js';

// 12.157 Uzay modu enerji silahları — S3 (BattleBit) kitiyle aynı dil: yan profil çekme + pah, tek ağ + şarjör / sürgü alt grupları, aynı finish() sözleşmesi
// (köken = tabanca kabzası, namlu −Z, yukarı +Y; gripR / gripL / muzzle / hold / length). Gövde kırık beyaz kabuk + koyu iskelet; ışıyan enerji parçaları desen 3
// (skins.js: silahın enerji rengi uEn, ışıyan; nişan retikülü 'glow' yuvasında AYRI kalır → adsalign ölçümü bozulmaz). Nişangâhlar mevcut S3 nişangâhları (optic).
// Renkler (skins.js STD): lazer camgöbeği, plazma mor, tabanca yeşil, ray tüfeği buz mavisi, dağıtıcı turuncu.
const { optic, flipRear, done, newKit, circ, stripe, plate, guard } = S3PARTS;
const EN = { pat: 3 };                                                     // ışıyan enerji parçası (renk = silahın enerji rengi)

// ───────────────────────── Lazer Tüfeği ─────────────────────────
export function laser(mat = skinMaterial('laser'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron';
  // gövde: pahlı tek kabuk (önü eğik), altta koyu iskelet şeridi, yan enerji şeridi
  k.prof([[0.045, 0.004], [0.045, 0.07], [0.02, 0.09], [-0.26, 0.09], [-0.3, 0.07], [-0.3, 0.0], [-0.2, -0.03], [-0.07, -0.03], [-0.05, -0.012], [0.01, -0.012]], 0.054, 'body', { c: 0.005 });
  k.prof([[0.04, -0.012], [-0.3, -0.012], [-0.3, 0.004], [0.04, 0.004]], 0.056, 'furn', { c: 0.002, d: 1 });
  for (const sx of [-1, 1]) {
    k.box([0.004, 0.012, 0.18], [sx * 0.0275, 0.05, -0.12], 'acc', { ...EN });                          // yan enerji şeridi
    k.box([0.004, 0.026, 0.2], [sx * 0.0275, 0.05, -0.12], 'furn', { sh: 0.7, d: 1 });                  // şerit yuvası
  }
  rail(k, 0.03, -0.27, 0.09, { w: 0.024 });
  k.box([0.022, 0.012, 0.03], [0.03, 0.06, 0.02], 'metal', { c: 0.003 });                              // şarj kolu (sağ)
  // dipçik: açılı iskelet (başparmak deliği) + yanak pedi + dipçik pedi
  k.prof([[0.045, 0.085], [0.2, 0.08], [0.33, 0.07], [0.335, -0.07], [0.31, -0.085], [0.27, -0.085], [0.17, -0.02], [0.045, -0.01]], 0.044, 'furn', { c: 0.006, holes: [[[0.2, 0.05], [0.29, 0.045], [0.29, -0.04], [0.26, -0.045], [0.19, 0.0]]], lodNoHoles: true });
  k.prof([[0.08, 0.087], [0.21, 0.083], [0.21, 0.098], [0.09, 0.1]], 0.04, 'body', { c: 0.004 });
  k.prof([[0.335, 0.072], [0.352, 0.072], [0.352, -0.08], [0.335, -0.08]], 0.048, 'acc', { c: 0.004, pat: 1 });
  // kabza + tetik korkuluğu + tetik
  k.prof([[0.012, -0.012], [0.05, -0.012], [0.054, -0.024], [0.09, -0.126], [0.083, -0.138], [0.05, -0.138], [0.043, -0.126], [0.04, -0.104], [0.022, -0.06], [0.014, -0.034]], 0.032, 'furn', { c: 0.005, pat: 1 });
  guard(k, [[0.014, -0.012], [0.016, -0.028], [-0.002, -0.06], [-0.07, -0.06], [-0.07, -0.012]], [[0.004, -0.027], [-0.009, -0.051], [-0.062, -0.051], [-0.062, -0.022]], 0.01, 'furn');
  k.prof([[-0.012, -0.018], [-0.02, -0.018], [-0.025, -0.04], [-0.019, -0.048], [-0.012, -0.038]], 0.006, 'metal', { d: 1 });
  // namlu örtüsü (sekizgen kesit, beyaz) + yarıklardan görünen ışıyan bobinler + uçta yayıcı
  k.xsec([[-0.022, 0.006], [0.022, 0.006], [0.03, 0.018], [0.03, 0.072], [0.022, 0.084], [-0.022, 0.084], [-0.03, 0.072], [-0.03, 0.018]], -0.3, -0.56, 'body', { c: 0.004, sh: 1.04 });
  rail(k, -0.3, -0.5, 0.084, { w: 0.022 });
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) { k.box([0.004, 0.034, 0.03], [sx * 0.0305, 0.045, -0.34 - i * 0.06], 'acc', { sh: 0.4 }); k.box([0.003, 0.022, 0.018], [sx * 0.0325, 0.045, -0.34 - i * 0.06], 'acc', { ...EN, d: 1 }); }
  k.cyl(0.016, 0.016, 0.12, [0, 0.045, -0.62], 'metal', { seg: 10 });                                  // yayıcı gövdesi
  for (const z of [-0.585, -0.625, -0.665]) k.ring(0.017, 0.003, [0, 0.045, z], 'acc', { ax: 'z', seg: 12, ...EN });   // ışıyan bobin halkaları
  k.cyl(0.021, 0.019, 0.026, [0, 0.045, -0.693], 'acc', { seg: 12 });                                  // uç kapağı
  k.cyl(0.009, 0.009, 0.004, [0, 0.045, -0.707], 'acc', { seg: 10, ...EN });                           // namlu ağzı ışığı
  // demir nişan: katlanır gez (M4 gibi, çizgi 0,118) + örtü üstünde arpacık
  if (iron) {
    for (const sx of [-1, 1]) k.box([0.003, 0.03, 0.012], [sx * 0.0105, 0.099, -0.49], 'acc', { c: 0.001 });
    k.box([0.003, 0.032, 0.003], [0, 0.1, -0.49], 'acc', { sh: 0.85 });                                // arpacık (tepe 0,116 … 0,118)
    k.box([0.022, 0.006, 0.02], [0, 0.087, -0.49], 'acc', { c: 0.001 });
  }
  const rear = flipRear(k, 0, 0.096, 0.006, 0.116, iron);
  const sg = iron ? { sight: rear, pivot: [0, 0.116, -0.49], dist: ADS_DIST.iron, overlay: 'none' } : optic(k, o, 0.096, -0.14);
  // enerji hücresi şarjörü (grup): eğik kutu, yan pencerede ışık
  const R = bez([-0.08, -0.03], [-0.082, -0.11], [-0.092, -0.19], lod ? 2 : 4), F = bez([-0.15, -0.03], [-0.154, -0.11], [-0.166, -0.18], lod ? 2 : 4);
  k.prof([...R, ...[...F].reverse()], 0.036, 'furn', { c: 0.003, g: 'mag' });
  k.prof(stripe(F, R, 0.3, 0.7), 0.038, 'acc', { g: 'mag', ...EN });
  plate(k, F[F.length - 1], R[R.length - 1], 0.04, 0.012, 'body', { g: 'mag', c: 0.003 });
  return done(k, mat, { name: 'Lazer Tüfeği', hold: 'rifle', gripR: [0, -0.03, 0.04], gripL: [0, -0.035, -0.4], muzzle: [0, 0.045, -0.71], length: 1.05 }, sg);
}

// ───────────────────────── Plazma SMG ─────────────────────────
export function plasma(mat = skinMaterial('plasma'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron';
  // kısa gövde: arkası yüksek kambur, önde plazma odası (yan pencerelerden ışıyan küre), altta tutamaç
  k.prof([[0.04, 0.0], [0.04, 0.074], [0.01, 0.092], [-0.12, 0.092], [-0.14, 0.08], [-0.24, 0.074], [-0.26, 0.05], [-0.26, 0.004], [-0.06, -0.02], [-0.04, -0.012], [0.0, -0.012]], 0.056, 'body', { c: 0.006 });
  k.prof([[0.04, -0.012], [-0.26, 0.0], [-0.26, 0.012], [0.04, 0.0]], 0.058, 'furn', { c: 0.002, d: 1 });
  k.cyl(0.028, 0.028, 0.07, [0, 0.042, -0.175], 'acc', { seg: 12, sh: 0.6 });                          // plazma odası
  k.cyl(0.019, 0.019, 0.06, [0, 0.042, -0.175], 'acc', { seg: 10, ...EN });                             // ışıyan çekirdek (pencereden)
  for (const sx of [-1, 1]) {
    k.box([0.004, 0.03, 0.05], [sx * 0.0285, 0.042, -0.175], 'acc', { ...EN, sh: 0.9 });               // yan pencere ışığı
    k.box([0.003, 0.01, 0.12], [sx * 0.0285, 0.068, -0.04], 'acc', { ...EN, d: 1 });                    // üst kenar şeridi
  }
  rail(k, 0.02, -0.12, 0.092, { w: 0.024 });
  // namlu: kısa yayıcı + 3 soğutma kanadı
  k.cyl(0.013, 0.013, 0.13, [0, 0.042, -0.32], 'metal', { seg: 10 });
  for (let i = 0; i < 3; i++) k.box([0.05, 0.05, 0.008], [0, 0.042, -0.29 - i * 0.03], 'acc', { c: 0.002, sh: 0.8 });
  k.cyl(0.017, 0.015, 0.024, [0, 0.042, -0.396], 'acc', { seg: 10 });
  k.cyl(0.008, 0.008, 0.004, [0, 0.042, -0.41], 'acc', { seg: 10, ...EN });
  // katlanır tel dipçik (iki çubuk + ped)
  for (const sy of [0.06, -0.02]) k.box([0.012, 0.012, 0.2], [0, sy, 0.14], 'metal', { c: 0.003 });
  k.prof([[0.235, 0.075], [0.255, 0.075], [0.255, -0.04], [0.235, -0.04]], 0.044, 'acc', { c: 0.004, pat: 1 });
  // kabza + tetik korkuluğu + ön dikey tutamaç (destek eli)
  k.prof([[0.012, -0.012], [0.05, -0.012], [0.054, -0.024], [0.086, -0.12], [0.08, -0.132], [0.048, -0.132], [0.042, -0.12], [0.022, -0.06], [0.014, -0.034]], 0.032, 'furn', { c: 0.005, pat: 1 });
  guard(k, [[0.014, -0.012], [0.016, -0.028], [-0.002, -0.058], [-0.06, -0.058], [-0.06, -0.012]], [[0.004, -0.027], [-0.009, -0.05], [-0.052, -0.05], [-0.052, -0.02]], 0.01, 'furn');
  k.prof([[-0.012, -0.018], [-0.02, -0.018], [-0.025, -0.04], [-0.019, -0.048], [-0.012, -0.038]], 0.006, 'metal', { d: 1 });
  k.prof([[-0.19, 0.004], [-0.236, 0.004], [-0.24, -0.11], [-0.226, -0.122], [-0.198, -0.122], [-0.19, -0.11]], 0.03, 'furn', { c: 0.005, pat: 1 });
  // demir nişan: arka delikli gez + ön arpacık (çizgi 0,112)
  if (iron) { for (const sx of [-1, 1]) k.box([0.003, 0.026, 0.01], [sx * 0.01, 0.1, -0.11], 'acc', { c: 0.001 }); k.box([0.003, 0.026, 0.003], [0, 0.099, -0.11], 'acc', { sh: 0.85 }); }
  const rear = flipRear(k, 0, 0.092, 0.012, 0.112, iron);
  const sg = iron ? { sight: rear, pivot: [0, 0.112, -0.11], dist: ADS_DIST.iron, overlay: 'none' } : optic(k, o, 0.092, -0.05);
  // enerji kanisteri (grup): kabza önünde, dikey silindir-kutu, ışık bandı
  k.box([0.034, 0.12, 0.05], [0, -0.07, -0.1], 'acc', { c: 0.004, g: 'mag' });
  k.box([0.036, 0.07, 0.016], [0, -0.07, -0.1], 'acc', { g: 'mag', ...EN });
  k.box([0.04, 0.014, 0.056], [0, -0.135, -0.1], 'body', { g: 'mag', c: 0.003 });
  return done(k, mat, { name: 'Plazma SMG', hold: 'rifle', gripR: [0, -0.03, 0.04], gripL: [0, -0.05, -0.215], muzzle: [0, 0.042, -0.415], length: 0.7 }, sg);
}

// ───────────────────────── Enerji Tabancası ─────────────────────────
export function epistol(mat = skinMaterial('epistol'), lod = false, o = 'iron') {
  const k = newKit(lod);
  k.grp = 'slide';                                                            // üst yayıcı kabuğu (sürgü gibi geri-ileri; 12.141 tabanca hissi)
  k.xsec([[-0.017, 0.03], [0.017, 0.03], [0.017, 0.064], [0.011, 0.078], [-0.011, 0.078], [-0.017, 0.064]], 0.058, -0.17, 'body', { c: 0.003 });
  k.box([0.035, 0.006, 0.06], [0, 0.064, -0.11], 'acc', { sh: 0.6 });
  for (const sx of [-1, 1]) k.box([0.003, 0.008, 0.07], [sx * 0.0172, 0.05, -0.1], 'acc', { ...EN });
  k.cyl(0.009, 0.009, 0.006, [0, 0.051, -0.172], 'acc', { seg: 10, ...EN });
  if (o !== 'reddot') {
    k.xsec([[-0.01, 0.0775], [0.01, 0.0775], [0.01, 0.0918], [0.0028, 0.0918], [0.0028, 0.086], [-0.0028, 0.086], [-0.0028, 0.0918], [-0.01, 0.0918]], 0.052, 0.044, 'acc', { c: 0 });
    k.box([0.004, 0.0085, 0.007], [0, 0.08225, -0.156], 'acc', { c: 0.0006 });
  }
  const sg = o === 'reddot' ? optic(k, o, 0.078, 0.012, true) : { sight: [0, 0.086, 0.048], pivot: [0, 0.086, -0.156], dist: ADS_DIST.iron, overlay: 'none' };
  if (o === 'reddot') k.glassSlide = true;
  k.grp = null;
  // çerçeve (koyu) + alt ışık şeridi, kabza (benekli), tetik korkuluğu, tetik
  k.prof([[0.054, 0.031], [-0.166, 0.031], [-0.166, 0.01], [-0.03, 0.008], [-0.004, 0.002], [0.054, 0.002]], 0.032, 'furn', { c: 0.003 });
  k.box([0.033, 0.004, 0.06], [0, 0.012, -0.13], 'acc', { ...EN, d: 1 });
  k.prof([[0.0, 0.006], [0.05, 0.008], [0.064, -0.002], [0.066, -0.01], [0.093, -0.106], [0.088, -0.118], [0.044, -0.122], [0.036, -0.112], [0.012, -0.03], [0.0, -0.006]], 0.031, 'furn', { c: 0.004, pat: lod ? 0 : 1 });
  guard(k, [[0.002, 0.004], [0.002, -0.004], [-0.012, -0.034], [-0.056, -0.034], [-0.062, -0.026], [-0.062, 0.006]], [[-0.006, -0.004], [-0.016, -0.026], [-0.05, -0.026], [-0.054, -0.021], [-0.054, 0.004]], 0.022, 'furn');
  k.prof([[-0.012, 0.004], [-0.02, 0.004], [-0.024, -0.014], [-0.018, -0.02], [-0.013, -0.01]], 0.006, 'metal', { d: 1 });
  // enerji hücresi (grup): kabza tabanında ışık penceresi
  k.prof([[0.012, 0.0], [0.048, 0.002], [0.084, -0.11], [0.046, -0.114]], 0.024, 'acc', { g: 'mag' });
  k.prof([[0.042, -0.117], [0.09, -0.112], [0.094, -0.13], [0.04, -0.134]], 0.032, 'body', { c: 0.003, g: 'mag' });
  k.box([0.033, 0.006, 0.03], [0, -0.124, 0.067], 'acc', { g: 'mag', ...EN, rot: [-0.1, 0, 0] });
  return done(k, mat, { name: 'Enerji Tabancası', hold: 'pistol', gripR: [0, -0.03, 0.02], gripL: null, muzzle: [0, 0.051, -0.18], length: 0.28, slideTravel: 0.02 }, sg);
}

// ───────────────────────── Ray Tüfeği (Railgun) ─────────────────────────
export function railgun(mat = skinMaterial('railgun'), lod = false) {
  const k = newKit(lod);
  // gövde + kalın dipçik (tek profil, başparmak deliği) + dipçik pedi
  k.prof([[0.43, 0.07], [0.43, -0.11], [0.4, -0.12], [0.27, -0.075], [0.15, -0.05], [0.12, -0.1], [0.1, -0.118], [0.062, -0.112], [0.042, -0.064], [0.034, -0.03], [-0.2, -0.03], [-0.24, 0.0], [-0.24, 0.07], [-0.2, 0.09], [0.06, 0.09], [0.14, 0.074], [0.27, 0.078], [0.4, 0.075]], 0.058, 'body', { c: 0.008, holes: [[[0.29, 0.04], [0.37, 0.04], [0.37, -0.06], [0.31, -0.04]]] });
  k.prof([[0.142, -0.05], [0.118, -0.1], [0.098, -0.112], [0.066, -0.106], [0.05, -0.064], [0.046, -0.034], [0.1, -0.034]], 0.06, 'furn', { pat: 1, d: 1 });
  k.prof([[0.43, 0.072], [0.448, 0.072], [0.448, -0.114], [0.43, -0.114]], 0.06, 'acc', { c: 0.004, pat: 1 });
  for (const sx of [-1, 1]) k.box([0.004, 0.014, 0.22], [sx * 0.0302, 0.03, -0.09], 'acc', { ...EN });
  guard(k, [[0.03, -0.03], [0.03, -0.04], [0.01, -0.076], [-0.05, -0.076], [-0.07, -0.06], [-0.075, -0.03]], [[0.02, -0.04], [0.004, -0.068], [-0.045, -0.068], [-0.06, -0.055], [-0.064, -0.04]], 0.013, 'furn');
  k.prof([[-0.01, -0.03], [-0.018, -0.03], [-0.022, -0.056], [-0.016, -0.064], [-0.01, -0.054]], 0.006, 'metal', { d: 1 });
  // çift ray: üst + alt raylar arasında ışıyan kanal, raylar arası dört bobin bileziği
  for (const y of [0.084, 0.03]) k.box([0.036, 0.02, 0.68], [0, y, -0.58], 'metal', { c: 0.004, ax: 'z', sh: 1.25 });
  k.box([0.02, 0.034, 0.66], [0, 0.057, -0.58], 'acc', { ...EN });
  for (let i = 0; i < 4; i++) { const z = -0.33 - i * 0.15; k.box([0.06, 0.1, 0.03], [0, 0.057, z], 'body', { c: 0.006 }); k.box([0.062, 0.012, 0.012], [0, 0.057, z], 'acc', { ...EN, d: 1 }); }
  k.box([0.05, 0.09, 0.04], [0, 0.057, -0.935], 'acc', { c: 0.005 });                                      // namlu ucu bileziği
  k.box([0.014, 0.04, 0.006], [0, 0.057, -0.957], 'acc', { ...EN });
  // dürbün (M24 dürbünü gibi; göz merceğinde ışıyan artı = nişan noktası)
  for (const z of [0.03, -0.13]) { k.box([0.026, 0.04, 0.02], [0, 0.11, z], 'acc', { c: 0.003 }); k.ring(0.0215, 0.005, [0, 0.142, z], 'acc', { ax: 'z', seg: 12, d: 1 }); }
  k.cyl(0.019, 0.019, 0.27, [0, 0.142, -0.05], 'acc', { seg: 14 });
  k.cyl(0.019, 0.025, 0.035, [0, 0.142, 0.1], 'acc', { seg: 14 });
  k.cyl(0.025, 0.025, 0.04, [0, 0.142, 0.137], 'acc', { seg: 14, sh: 0.85 });
  k.cyl(0.031, 0.019, 0.055, [0, 0.142, -0.212], 'acc', { seg: 14 });
  k.cyl(0.031, 0.031, 0.065, [0, 0.142, -0.27], 'acc', { seg: 14 });
  k.ring(0.0315, 0.0025, [0, 0.142, -0.29], 'acc', { ax: 'z', seg: 16, ...EN, d: 1 });
  k.cyl(0.0145, 0.0145, 0.03, [0, 0.176, -0.05], 'acc', { ax: 'y', seg: 10 });
  k.cyl(0.0145, 0.0145, 0.03, [0.034, 0.142, -0.05], 'acc', { ax: 'x', seg: 10 });
  k.cyl(0.028, 0.028, 0.002, [0, 0.142, -0.303], 'lens', { seg: 14 });
  k.cyl(0.022, 0.022, 0.002, [0, 0.142, 0.158], 'lens', { seg: 14, d: 1 });
  for (const [w, hh] of [[0.012, 0.0004], [0.0004, 0.012]]) k.box([w, hh, 0.0005], [0, 0.142, 0.1594], 'glow', { d: 1 });
  // güç hücresi (grup): gövde altında, ışık penceresi
  k.box([0.04, 0.05, 0.1], [0, -0.055, -0.13], 'furn', { g: 'mag', c: 0.004 });
  k.box([0.042, 0.016, 0.07], [0, -0.055, -0.13], 'acc', { g: 'mag', ...EN });
  return done(k, mat, { name: 'Ray Tüfeği', hold: 'rifle', gripR: [0, -0.03, 0.054], gripL: [0, -0.012, -0.3], muzzle: [0, 0.057, -0.96], length: 1.35 },
    { sight: [0, 0.142, 0.159], dist: ADS_DIST.scope, overlay: 'scope' });
}

// ───────────────────────── Dağıtıcı (enerji pompalısı) ─────────────────────────
export function scatter(mat = skinMaterial('scatter'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron';
  // iri gövde: önde genişleyen yassı ağız (üç yayıcı yarığı), üstte ray, yan soğutma kanatları
  k.prof([[0.045, 0.0], [0.045, 0.074], [0.02, 0.09], [-0.36, 0.09], [-0.42, 0.098], [-0.52, 0.098], [-0.54, 0.084], [-0.54, -0.02], [-0.42, -0.03], [-0.07, -0.03], [-0.05, -0.012], [0.01, -0.012]], 0.064, 'body', { c: 0.006 });
  k.xsec([[-0.046, -0.022], [0.046, -0.022], [0.046, 0.09], [-0.046, 0.09]], -0.42, -0.53, 'furn', { c: 0.006 });   // geniş ağız kutusu
  for (const y of [0.0, 0.034, 0.068]) { k.box([0.07, 0.012, 0.006], [0, y, -0.5335], 'acc', { ...EN }); k.box([0.076, 0.02, 0.004], [0, y, -0.532], 'acc', { sh: 0.5 }); }
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) k.box([0.01, 0.07, 0.01], [sx * 0.037, 0.035, -0.2 - i * 0.04], 'furn', { c: 0.002 });
  for (const sx of [-1, 1]) k.box([0.004, 0.012, 0.14], [sx * 0.0325, 0.06, -0.06], 'acc', { ...EN });
  rail(k, 0.03, -0.34, 0.09, { w: 0.024 });
  // dipçik (kısa, kalın) + ped
  k.prof([[0.045, 0.084], [0.27, 0.07], [0.29, 0.06], [0.29, -0.07], [0.27, -0.08], [0.17, -0.02], [0.045, -0.01]], 0.05, 'furn', { c: 0.007 });
  k.prof([[0.29, 0.064], [0.31, 0.064], [0.31, -0.076], [0.29, -0.076]], 0.054, 'acc', { c: 0.004, pat: 1 });
  // kabza + korkuluk + tetik + ön tutamaç
  k.prof([[0.012, -0.012], [0.05, -0.012], [0.054, -0.024], [0.09, -0.126], [0.083, -0.138], [0.05, -0.138], [0.043, -0.126], [0.04, -0.104], [0.022, -0.06], [0.014, -0.034]], 0.034, 'furn', { c: 0.005, pat: 1 });
  guard(k, [[0.014, -0.012], [0.016, -0.028], [-0.002, -0.06], [-0.07, -0.06], [-0.07, -0.012]], [[0.004, -0.027], [-0.009, -0.051], [-0.062, -0.051], [-0.062, -0.022]], 0.01, 'furn');
  k.prof([[-0.012, -0.018], [-0.02, -0.018], [-0.025, -0.04], [-0.019, -0.048], [-0.012, -0.038]], 0.006, 'metal', { d: 1 });
  k.xsec([[-0.036, -0.075], [0.036, -0.075], [0.04, -0.06], [0.04, -0.028], [-0.04, -0.028], [-0.04, -0.06]], -0.24, -0.4, 'furn', { c: 0.005, pat: 1 });   // ön kundak (destek eli)
  // demir nişan: delikli gez + arpacık (çizgi 0,118)
  if (iron) { for (const sx of [-1, 1]) k.box([0.003, 0.03, 0.012], [sx * 0.0105, 0.11, -0.47], 'acc', { c: 0.001 }); k.box([0.003, 0.022, 0.003], [0, 0.108, -0.47], 'acc', { sh: 0.85 }); }
  const rear = flipRear(k, 0, 0.096, 0.006, 0.118, iron);
  const sg = iron ? { sight: rear, pivot: [0, 0.118, -0.47], dist: ADS_DIST.iron, overlay: 'none' } : optic(k, o, 0.096, -0.16);
  // hücre şarjörü (grup): kabza önünde yassı kutu + ışık penceresi
  k.prof([[-0.08, -0.03], [-0.15, -0.03], [-0.16, -0.12], [-0.085, -0.12]], 0.05, 'furn', { c: 0.004, g: 'mag' });
  k.prof([[-0.095, -0.045], [-0.145, -0.045], [-0.15, -0.1], [-0.1, -0.1]], 0.052, 'acc', { g: 'mag', ...EN });
  return done(k, mat, { name: 'Dağıtıcı', hold: 'rifle', gripR: [0, -0.03, 0.05], gripL: [0, -0.075, -0.32], muzzle: [0, 0.034, -0.55], length: 0.9 }, sg);
}

export const S3SPACE = { laser, plasma, epistol, railgun, scatter };
void circ;
