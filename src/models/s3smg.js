import { Kit, bez, rail } from './s3kit.js';
import { skinMaterial, STD } from './skins.js';
import { s3Optic, ADS_DIST, S3PARTS } from './s3weapons.js';

// S3 (BattleBit tarzı) ikinci tur: MP5, Vector, P90, MAC-10, M249, PKM, M1911, Desert Eagle, Revolver, RPG-7 — s3weapons.js deseni (yan profil çekme + pah, tek ağ + şarjör alt grubu + cam).
// Sözleşme eski modellerle aynı (gripR / gripL / muzzle / length / hold / mag / magAxis aynen; sunucu modelsiz). Nişangâh: s3Optic aynı malzemeyle kurulur, geometrisi silahın ana ağına katılır (ek çizim çağrısı yok), cam ayrı.
// Demir nişan: gez deliği / çentik dibi = arpacık tepesi = nişan çizgisi (adsalign ≤ 2 px). Yuvalar: body gövde · furn mobilya · metal namlu / küçük çelik · acc nişan / ray (LMG'de fişek pirinci, nişanlar metal).
Object.assign(STD, {
  mp5: { body: ['#2e3034', 0.5, 0.4], furn: ['#1f2023', 0.72, 0], metal: ['#36373a', 0.42, 0.6], acc: ['#18191b', 0.6, 0.2] },
  vector: { body: ['#3a3d42', 0.55, 0.3], furn: ['#212326', 0.7, 0], metal: ['#36373a', 0.4, 0.6], acc: ['#18191b', 0.6, 0.2] },
  p90: { body: ['#2b2c2f', 0.55, 0.3], furn: ['#2f3134', 0.75, 0], metal: ['#36373a', 0.4, 0.6], acc: ['#18191b', 0.6, 0.2] },
  mac10: { body: ['#3a3c40', 0.45, 0.5], furn: ['#1e1f22', 0.72, 0], metal: ['#2f3033', 0.4, 0.6], acc: ['#151618', 0.6, 0.2] },
  lmg: { body: ['#34363a', 0.5, 0.4], furn: ['#3f4530', 0.72, 0], metal: ['#38393c', 0.42, 0.6], acc: ['#b38b3f', 0.35, 0.8] },
  pkm: { body: ['#2c2e31', 0.5, 0.4], furn: ['#6b3a22', 0.5, 0], metal: ['#36373a', 0.42, 0.6], acc: ['#a98840', 0.35, 0.8] },
  m1911: { body: ['#3a3c40', 0.4, 0.45], furn: ['#6e3c20', 0.55, 0], metal: ['#2e2f32', 0.4, 0.6], acc: ['#151618', 0.6, 0.2] },
  deagle: { body: ['#6f747b', 0.32, 0.75], furn: ['#1c1d1f', 0.8, 0], metal: ['#3a3b3f', 0.4, 0.6], acc: ['#151618', 0.6, 0.2] },
  revolver: { body: ['#8c9096', 0.3, 0.8], furn: ['#7a4426', 0.5, 0], metal: ['#5c6066', 0.35, 0.75], acc: ['#151618', 0.6, 0.2] },
  rpg: { body: ['#4f5638', 0.7, 0.05], furn: ['#7a4426', 0.5, 0], metal: ['#38393c', 0.42, 0.6], acc: ['#1c1d20', 0.6, 0.2] },
});

const stripe = (A, B, a, b) => { const p = A.map((q, i) => [q[0] + (B[i][0] - q[0]) * a, q[1] + (B[i][1] - q[1]) * a]), r = A.map((q, i) => [q[0] + (B[i][0] - q[0]) * b, q[1] + (B[i][1] - q[1]) * b]); return [...p, ...r.reverse()]; };
const plate = (k, f, r, w, h, slot, o = {}) => { const cz = (f[0] + r[0]) / 2, cy = (f[1] + r[1]) / 2, L = Math.hypot(r[0] - f[0], r[1] - f[1]); k.box([w, h, L + 0.006], [0, cy - h * 0.35, cz], slot, { ...o, rot: [Math.atan2(-(r[1] - f[1]), r[0] - f[0]), 0, 0] }); };
const guard = (k, outer, hole, w, slot = 'metal') => k.prof(outer, w, slot, { holes: [hole], c: 0.002 });
const circ = (cx, cy, r, n = 14) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]);
const trig = (k, z, y) => k.prof([[z, y], [z - 0.008, y], [z - 0.013, y - 0.022], [z - 0.007, y - 0.03], [z, y - 0.02]], 0.006, 'metal', { d: 1 });
const loop = (k, pos) => k.ring(0.01, 0.0025, pos, 'metal', { d: 1 });
const newKit = (lod) => { const k = new Kit(lod); k.glassMesh = []; return k; };
// Arka gez: halka delikli plaka (x ±hw, yb'den çizgi + üst pay), delik yarıçapı R; kulaklar (ears) isteğe bağlı
function peep(k, yb, line, z, R = 0.0055, hw = 0.0095, ears = true, slot = 'acc') {      // 12.126: plaka 23 → 19 mm (ince)
  k.xsec([[-hw, yb], [hw, yb], [hw, line + R + 0.004], [hw - 0.004, line + R + 0.009], [-hw + 0.004, line + R + 0.009], [-hw, line + R + 0.004]], z + 0.003, z - 0.003, slot, { holes: [circ(0, line, R, 16)], c: 0.0008 });
  if (ears) for (const sx of [-1, 1]) k.box([0.003, line + R + 0.006 - yb, 0.014], [sx * (hw + 0.002), (yb + line + R + 0.006) / 2, z], slot, { c: 0.001, d: 1 });
}
// U çentikli gez (tabanca / PKM): çentik dibi = çizgi
function notch(k, yb, line, z0, z1, hw = 0.0095, nw = 0.0026, top = 0.005, slot = 'acc') {
  k.xsec([[-hw, yb], [hw, yb], [hw, line + top], [nw, line + top], [nw, line], [-nw, line], [-nw, line + top], [-hw, line + top]], z0, z1, slot, { c: 0 });
}
// Arpacık: taban + iki kulak + ince dikme (tepe = çizgi)
function post(k, base, line, z, slot = 'acc', ear = 0.0105) {
  k.box([0.022, 0.008, 0.022], [0, base + 0.004, z], slot, { c: 0.002 });
  for (const sx of [-1, 1]) k.box([0.003, line + 0.004 - base, 0.012], [sx * ear, (base + line + 0.004) / 2, z], slot, { c: 0.001, d: 1 });
  k.box([0.003, line - base, 0.003], [0, (base + line) / 2, z], slot, { sh: 0.85 });
}
// Optik: s3Optic aynı kaplama malzemesiyle → ana ağa katılır (remap: aksesuar yuvası → metal; LMG'de aksesuar = fişek pirinci)
function opt(k, mat, o, yb, z, pistol = false, remap = false) {
  const r = s3Optic(o, yb, z, k.lod, pistol, mat);
  if (!r) return null;
  for (const m of [...r.g.children]) {
    if (!m.isMesh) continue;
    if (m.material?.userData?.glass) { r.g.remove(m); k.glassMesh.push(m); continue; }
    if (remap) { const a = m.geometry.attributes.wf.array; for (let i = 0; i < a.length; i += 3) if (Math.round(a[i]) === 3) a[i] = 2; }
    k.lists[(!k.lod && k.grp) || 'main'].push(m.geometry);      // 12.141: tabancada RMR sürgü grubunda
  }
  if (k.grp && !k.lod) k.glassSlide = true;
  return { sight: r.sight, dist: r.dist, overlay: r.overlay, lens: r.lens };      // 12.129: lens (ACOG PiP diski) da taşınır — eksikti, MP5 / M249'da ACOG merceğinden dürbün tüpünün içi görünüyordu
}
function done(k, mat, meta, sg) {
  const g = k.build(mat, meta);
  for (const m of k.glassMesh) (k.glassSlide && g.userData.slide ? g.userData.slide.g : g).add(m);
  if (sg) { g.userData.sight = sg.sight; g.userData.pivot = sg.pivot; g.userData.dist = sg.dist; g.userData.overlay = sg.overlay; g.userData.lens = sg.lens; }
  return g;
}
// Kemer fişekleri (LMG): x-y düzleminde Bézier yolu boyunca namluya paralel fişekler + bağlantı halkaları (şarjör grubu)
function belt(k, p0, p1, p2, n, z) {
  const P = bez(p0, p1, p2, k.lod ? 3 : n - 1);
  for (const [x, y] of P) {
    k.cyl(0.0055, 0.0055, 0.042, [x, y, z + 0.004], 'acc', { g: 'mag', seg: 8 });
    k.cyl(0.0012, 0.0052, 0.016, [x, y, z - 0.025], 'metal', { g: 'mag', seg: 8, d: 1, sh: 1.3 });
    k.box([0.004, 0.013, 0.01], [x, y, z + 0.016], 'metal', { g: 'mag', d: 1, sh: 0.8 });
  }
}

// ───────────────────────── MP5 (HK, A3 sürgülü dipçik) ─────────────────────────
export function mp5(mat = skinMaterial('mp5'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron';
  // gövde (preslenmiş sac, yuvarlak sırt) + yan kaburgalar + atım penceresi + kurma tüpü + kurma kolu
  k.xsec([[-0.022, -0.012], [0.022, -0.012], [0.022, 0.04], [0.017, 0.053], [0.008, 0.059], [-0.008, 0.059], [-0.017, 0.053], [-0.022, 0.04]], 0.068, -0.215, 'body', { c: 0.003 });
  for (const sx of [-1, 1]) k.box([0.003, 0.006, 0.21], [sx * 0.0225, 0.018, -0.09], 'body', { d: 1, sh: 0.82 });
  k.box([0.003, 0.018, 0.05], [0.0225, 0.034, -0.125], 'body', { sh: 0.3 });
  k.box([0.004, 0.012, 0.02], [0.0245, 0.03, -0.1], 'metal', { d: 1, c: 0.001 });
  k.cyl(0.0125, 0.0125, 0.25, [0, 0.045, -0.34], 'body', { seg: 12 });
  k.cyl(0.0135, 0.0135, 0.012, [0, 0.045, -0.462], 'metal', { seg: 12, sh: 0.85 });
  k.box([0.003, 0.004, 0.13], [-0.0125, 0.047, -0.3], 'body', { sh: 0.3, d: 1 });
  k.box([0.03, 0.009, 0.012], [-0.025, 0.047, -0.385], 'metal', { c: 0.002 });
  k.cyl(0.006, 0.006, 0.012, [-0.042, 0.047, -0.385], 'metal', { ax: 'x', seg: 8, d: 1 });
  // tutamaç (tropik, kanallı) + namlu + 3 tırnaklı ağız
  k.prof([[-0.214, 0.034], [-0.405, 0.034], [-0.41, 0.028], [-0.41, -0.012], [-0.396, -0.026], [-0.34, -0.032], [-0.25, -0.032], [-0.222, -0.026], [-0.214, -0.012]], 0.056, 'furn', { c: 0.006 });
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) k.box([0.003, 0.03, 0.012], [sx * 0.0278, 0.004, -0.255 - i * 0.032], 'furn', { sh: 0.35, d: 1 });
  k.box([0.02, 0.036, 0.024], [0, 0.034, -0.45], 'body', { c: 0.002 });
  k.cyl(0.0095, 0.0095, 0.1, [0, 0.025, -0.455], 'metal', { seg: 10 });
  k.cyl(0.0125, 0.0125, 0.03, [0, 0.025, -0.515], 'metal', { seg: 10, sh: 0.85 });
  if (!lod) for (let i = 0; i < 3; i++) k.box([0.005, 0.005, 0.02], [Math.cos(i * 2.09 + 0.5) * 0.0135, 0.025 + Math.sin(i * 2.09 + 0.5) * 0.0135, -0.51], 'metal', { rot: [0, 0, i * 2.09 + 0.5] });
  // ön arpacık: halka korumalı dikme (tepe 0,0925 = nişan çizgisi; halka iç tepesi 0,0948 → arpacık üstünde boşluk)
  k.box([0.022, 0.016, 0.03], [0, 0.062, -0.45], 'acc', { c: 0.002 });
  if (iron) {                                                                                         // 12.139: optikte halka koruma + arpacık yok (red dot / holo penceresinin dibinde ikinci halka gibi duruyordu)
    k.ring(0.015, 0.0022, [0, 0.082, -0.45], 'acc', { ax: 'z', seg: 18, rs: 4 });
    k.box([0.0028, 0.0225, 0.004], [0, 0.08125, -0.45], 'acc', { sh: 0.85 });
  }
  // demir: tambur gez (delik 0,0925) · optik: pençe ayak (claw mount) + ray
  let sg;
  k.box([0.024, 0.012, 0.03], [0, 0.062, -0.01], 'acc', { c: 0.002 });
  if (iron) {
    peep(k, 0.066, 0.0925, -0.01, 0.0055, 0.0115, false);
    for (const sx of [-1, 1]) k.cyl(0.015, 0.015, 0.005, [sx * 0.0145, 0.084, -0.01], 'acc', { ax: 'x', seg: 12, sh: 0.9 });
    for (const z of [-0.07, -0.14]) k.box([0.02, 0.003, 0.008], [0, 0.059, z], 'body', { d: 1, sh: 0.6 });
    sg = { sight: [0, 0.0925, -0.01], pivot: [0, 0.0925, -0.45], dist: ADS_DIST.iron, overlay: 'none' };
  } else {
    k.box([0.036, 0.012, 0.09], [0, 0.063, -0.08], 'acc', { c: 0.002 });
    for (const sx of [-1, 1]) k.box([0.005, 0.022, 0.07], [sx * 0.0205, 0.052, -0.08], 'acc', { c: 0.001, d: 1 });
    k.box([0.026, 0.015, 0.08], [0, 0.0765, -0.08], 'acc', { c: 0.002 });
    sg = opt(k, mat, o, 0.084, -0.08);
  }
  // alt gövde (tetik grubu), kabza (benekli), tetik korkuluğu, tetik, seçici
  k.prof([[0.07, -0.008], [-0.064, -0.008], [-0.064, -0.03], [0.07, -0.03]], 0.04, 'furn', { c: 0.003 });
  k.prof([[0.025, -0.028], [0.072, -0.028], [0.078, -0.04], [0.106, -0.13], [0.1, -0.142], [0.066, -0.145], [0.058, -0.135], [0.05, -0.11], [0.043, -0.09], [0.037, -0.06], [0.03, -0.045]], 0.034, 'furn', { c: 0.005, pat: lod ? 0 : 1 });
  guard(k, [[0.026, -0.028], [0.022, -0.04], [0.005, -0.066], [-0.046, -0.066], [-0.056, -0.056], [-0.056, -0.028]], [[0.014, -0.034], [0.0, -0.058], [-0.042, -0.058], [-0.048, -0.052], [-0.048, -0.034]], 0.012, 'furn');
  trig(k, -0.006, -0.03);
  k.box([0.004, 0.012, 0.024], [-0.0215, -0.019, 0.055], 'metal', { d: 1, c: 0.001 });
  k.cyl(0.006, 0.006, 0.004, [0.0215, -0.019, -0.03], 'metal', { ax: 'x', d: 1 });
  // A3 sürgülü dipçik: arka kapak + iki yan ray + dipçik (lastik ped)
  k.box([0.046, 0.072, 0.03], [0, 0.02, 0.08], 'body', { c: 0.004 });
  for (const sx of [-1, 1]) k.box([0.008, 0.012, 0.29], [sx * 0.018, 0.035, 0.235], 'metal', { c: 0.002, ax: 'z' });
  k.prof([[0.365, 0.058], [0.387, 0.056], [0.392, 0.048], [0.392, -0.064], [0.386, -0.074], [0.365, -0.068]], 0.05, 'furn', { c: 0.005 });
  k.prof([[0.39, 0.054], [0.4, 0.052], [0.4, -0.068], [0.39, -0.072]], 0.052, 'acc', { c: 0.003, pat: lod ? 0 : 1 });
  loop(k, [0, -0.02, 0.1]); loop(k, [0, 0.03, -0.44]);
  // kavisli şarjör (grup): Bézier kenarlar + kaburga + taban; şarjör yuvası
  k.box([0.034, 0.03, 0.058], [0, -0.024, -0.118], 'body', { c: 0.002 });
  const R = bez([-0.095, -0.03], [-0.098, -0.15], [-0.165, -0.258], lod ? 3 : 7), F = bez([-0.143, -0.03], [-0.15, -0.14], [-0.21, -0.236], lod ? 3 : 7);
  k.prof([...R, ...[...F].reverse()], 0.027, 'body', { c: 0.003, g: 'mag', sh: 0.92 });
  k.prof(stripe(F, R, 0.3, 0.7), 0.029, 'body', { g: 'mag', d: 1, sh: 0.8 });
  plate(k, F[F.length - 1], R[R.length - 1], 0.032, 0.01, 'metal', { g: 'mag', c: 0.002 });
  return done(k, mat, { name: 'MP5', hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.02, -0.32], muzzle: [0, 0.025, -0.53], length: 0.92 }, sg);
}

// ───────────────────────── KRISS Vector ─────────────────────────
export function vector(mat = skinMaterial('vector'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron', line = 0.104;
  // üst gövde (eğik burun) + tam boy ray + yan yarıklar + atım penceresi + kurma kolu
  k.prof([[0.1, 0.074], [-0.34, 0.074], [-0.392, 0.06], [-0.415, 0.04], [-0.415, 0.014], [-0.405, 0.01], [0.1, 0.01]], 0.052, 'body', { c: 0.004 });
  rail(k, 0.095, -0.335, 0.074, { w: 0.022 });
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) k.box([0.003, 0.012, 0.02], [sx * 0.0262, 0.042, -0.25 - i * 0.03], 'body', { sh: 0.25, d: i > 2 });
  k.box([0.003, 0.02, 0.05], [0.0262, 0.045, -0.04], 'body', { sh: 0.3 });
  k.box([0.012, 0.012, 0.03], [-0.031, 0.05, -0.19], 'metal', { c: 0.002 });
  k.box([0.004, 0.012, 0.024], [-0.027, 0.025, 0.04], 'metal', { d: 1, c: 0.001 });
  // alt gövde: "Super V" eğik kütle bloğu + şarjör yuvası (öne inen V), alt ray + dikey ön kabza
  k.prof([[0.095, 0.012], [-0.26, 0.012], [-0.262, -0.002], [-0.2, -0.05], [-0.14, -0.084], [-0.115, -0.09], [-0.045, -0.09], [-0.04, -0.075], [-0.03, -0.022], [0.095, -0.022]], 0.048, 'furn', { c: 0.005 });
  k.prof([[-0.2, -0.04], [-0.15, -0.068], [-0.15, -0.072], [-0.2, -0.046]], 0.0495, 'furn', { d: 1, sh: 0.6 });
  k.box([0.02, 0.008, 0.11], [0, 0.006, -0.32], 'acc', { c: 0.001 });
  k.box([0.03, 0.092, 0.032], [0, -0.044, -0.3], 'furn', { c: 0.006, ax: 'y', bot: [0.9, 0.9] });
  for (let i = 0; i < 3; i++) k.box([0.031, 0.004, 0.033], [0, -0.03 - i * 0.022, -0.3], 'furn', { d: 1, sh: 0.6 });
  // namlu + alev gizleyici
  k.cyl(0.0105, 0.0105, 0.11, [0, 0.03, -0.47], 'metal', { seg: 10 });
  k.cyl(0.0135, 0.0135, 0.03, [0, 0.03, -0.535], 'metal', { seg: 10, sh: 0.8 });
  if (!lod) for (let i = 0; i < 4; i++) k.box([0.003, 0.02, 0.004], [Math.cos(i * 1.57) * 0.013, 0.03 + Math.sin(i * 1.57) * 0.013, -0.54], 'metal', { sh: 0.3, rot: [0, 0, i * 1.57] });
  // kabza (dik, benekli), tetik korkuluğu, tetik
  k.prof([[0.04, -0.02], [0.088, -0.02], [0.094, -0.032], [0.118, -0.13], [0.112, -0.142], [0.078, -0.145], [0.07, -0.134], [0.05, -0.05], [0.042, -0.034]], 0.034, 'furn', { c: 0.005, pat: lod ? 0 : 1 });
  guard(k, [[0.04, -0.02], [0.038, -0.03], [0.022, -0.058], [-0.022, -0.058], [-0.03, -0.05], [-0.03, -0.02]], [[0.03, -0.028], [0.016, -0.05], [-0.016, -0.05], [-0.022, -0.044], [-0.022, -0.02]], 0.012, 'furn');
  trig(k, 0.01, -0.022);
  // katlanır dipçik: menteşe + boru + eğik alt kol + dipçik + ped
  k.box([0.04, 0.05, 0.026], [0, 0.045, 0.108], 'body', { c: 0.004 });
  k.cyl(0.013, 0.013, 0.12, [0, 0.05, 0.175], 'furn', { seg: 10 });
  k.box([0.014, 0.012, 0.14], [0, -0.029, 0.168], 'furn', { c: 0.002, rot: [0.22, 0, 0] });
  k.prof([[0.225, 0.075], [0.243, 0.075], [0.248, 0.065], [0.248, -0.055], [0.243, -0.065], [0.225, -0.058]], 0.04, 'furn', { c: 0.004 });
  k.prof([[0.246, 0.072], [0.255, 0.07], [0.255, -0.06], [0.246, -0.062]], 0.044, 'acc', { c: 0.003, pat: lod ? 0 : 1 });
  loop(k, [0, -0.01, 0.24]);
  // nişan: katlanır gez + arpacık (demirde açık), optikte yatık
  let sg;
  if (iron) {
    k.box([0.024, 0.01, 0.03], [0, 0.087, 0.07], 'acc', { c: 0.002 });
    peep(k, 0.09, line, 0.07, 0.006);
    post(k, 0.082, line, -0.32);
    sg = { sight: [0, line, 0.07], pivot: [0, line, -0.32], dist: ADS_DIST.iron, overlay: 'none' };
  } else {
    k.box([0.022, 0.008, 0.028], [0, 0.086, 0.07], 'acc', { c: 0.002 });
    k.box([0.022, 0.008, 0.026], [0, 0.086, -0.32], 'acc', { c: 0.002 });
    sg = opt(k, mat, o, 0.082, -0.11);
  }
  // Glock tipi şarjör (grup): yuvadan aşağı, taban plakası
  k.prof([[-0.062, -0.06], [-0.098, -0.06], [-0.098, -0.2], [-0.062, -0.2]], 0.026, 'body', { g: 'mag', c: 0.002, sh: 0.9 });
  k.prof([[-0.058, -0.198], [-0.102, -0.198], [-0.102, -0.21], [-0.058, -0.21]], 0.031, 'furn', { g: 'mag', c: 0.002 });
  return done(k, mat, { name: 'Vector', hold: 'rifle', gripR: [0, -0.03, 0.065], gripL: [0, -0.04, -0.3], muzzle: [0, 0.03, -0.55], length: 0.8 }, sg);
}

// ───────────────────────── FN P90 ─────────────────────────
export function p90(mat = skinMaterial('p90'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron', line = 0.128;
  // tek parça polimer gövde: ön destek eli halkası + tetik eli açıklığı (iki boşluk), yuvarlak burun, lastik dipçik pedi
  const outer = [[0.243, 0.046], [0.234, 0.058], [-0.16, 0.058], [-0.215, 0.045], [-0.25, 0.02], [-0.262, -0.01], [-0.258, -0.06], [-0.24, -0.092], [-0.205, -0.11], [0.06, -0.112], [0.08, -0.1], [0.12, -0.075], [0.2, -0.065], [0.232, -0.07], [0.243, -0.06]];
  const h1 = Array.from({ length: 10 }, (_, i) => [-0.155 + Math.cos((i / 10) * Math.PI * 2) * 0.032, -0.066 + Math.sin((i / 10) * Math.PI * 2) * 0.028]);   // yuvarlak başparmak halkası
  const h2 = [[-0.085, -0.035], [-0.015, -0.035], [-0.004, -0.05], [-0.003, -0.098], [-0.06, -0.098], [-0.08, -0.085], [-0.088, -0.06]];
  k.prof(outer, 0.058, 'furn', { c: 0.007, holes: [h1, h2], lodNoHoles: false });
  k.prof([[0.0, -0.04], [0.05, -0.04], [0.058, -0.1], [0.002, -0.1]], 0.0595, 'furn', { pat: 1, d: 1, sh: 0.95 });
  k.prof([[0.241, 0.05], [0.252, 0.048], [0.252, -0.056], [0.241, -0.064]], 0.06, 'acc', { c: 0.003, pat: lod ? 0 : 1 });
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) k.box([0.003, 0.06, 0.012], [sx * 0.0292, -0.01, 0.12 + i * 0.03], 'furn', { d: 1, sh: 0.55 });
  trig(k, -0.05, -0.035);
  k.cyl(0.012, 0.012, 0.006, [0, -0.098, -0.035], 'metal', { ax: 'y', d: 1, seg: 10 });
  for (const sx of [-1, 1]) k.cyl(0.006, 0.006, 0.01, [sx * 0.033, 0.03, -0.19], 'metal', { ax: 'x', seg: 8 });
  // namlu çıkışı + namlu + alev gizleyici
  k.cyl(0.016, 0.016, 0.03, [0, 0.02, -0.272], 'body', { seg: 12 });
  k.cyl(0.0095, 0.0095, 0.06, [0, 0.02, -0.31], 'metal', { seg: 10 });
  k.cyl(0.013, 0.013, 0.035, [0, 0.02, -0.3525], 'metal', { seg: 10, sh: 0.8 });
  // üstte TR ray köprüsü (şarjörün üstünde) + ray
  k.box([0.03, 0.012, 0.31], [0, 0.098, -0.03], 'body', { c: 0.003 });
  for (const z of [-0.17, 0.11]) k.box([0.03, 0.04, 0.02], [0, 0.08, z], 'body', { c: 0.002 });
  rail(k, 0.115, -0.175, 0.104, { w: 0.022 });
  let sg;
  if (iron) {
    peep(k, 0.112, line, 0.09, 0.0058);
    k.box([0.024, 0.006, 0.03], [0, 0.115, 0.09], 'acc', { c: 0.002 });
    post(k, 0.112, line, -0.165);
    sg = { sight: [0, line, 0.09], pivot: [0, line, -0.165], dist: ADS_DIST.iron, overlay: 'none' };
  } else sg = opt(k, mat, o, 0.112, -0.04);
  // üst şarjör (grup, füme saydam görünüm = mercek yuvası) + arka besleme bloğu + nervürler
  k.box([0.05, 0.034, 0.32], [0, 0.075, -0.035], 'lens', { g: 'mag', c: 0.004 });
  k.box([0.05, 0.03, 0.05], [0, 0.074, 0.15], 'body', { g: 'mag', c: 0.003 });
  for (let i = 0; i < 4; i++) k.box([0.052, 0.004, 0.012], [0, 0.088, -0.15 + i * 0.07], 'body', { g: 'mag', d: 1, sh: 0.8 });
  return done(k, mat, { name: 'P90', hold: 'rifle', gripR: [0, -0.03, 0.02], gripL: [0, -0.03, -0.2], muzzle: [0, 0.02, -0.37], length: 0.62 }, sg);
}

// ───────────────────────── MAC-10 ─────────────────────────
export function mac10(mat = skinMaterial('mac10'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron', line = 0.085;
  // kutu gövde (sac) + üst kurma yarığı + kurma topuzu + atım penceresi + vidalar
  k.box([0.05, 0.078, 0.18], [0, 0.021, -0.03], 'body', { c: 0.004, ax: 'z' });
  k.box([0.006, 0.002, 0.12], [0, 0.0605, -0.04], 'body', { sh: 0.3, d: 1 });
  k.cyl(0.008, 0.008, 0.012, [0, 0.066, -0.085], 'metal', { ax: 'y', seg: 10, pat: 2 });
  k.box([0.003, 0.018, 0.05], [0.0252, 0.04, -0.05], 'body', { sh: 0.3 });
  for (const [y, z] of [[0.0, 0.04], [0.0, -0.1], [0.045, -0.1]]) for (const sx of [-1, 1]) k.cyl(0.0035, 0.0035, 0.003, [sx * 0.0252, y, z], 'metal', { ax: 'x', seg: 6, d: 1 });
  k.box([0.004, 0.01, 0.02], [-0.027, 0.004, 0.02], 'metal', { d: 1, c: 0.001 });
  // dişli kısa namlu (susturucu dişi) + ön kayış halkası
  k.cyl(0.011, 0.011, 0.08, [0, 0.035, -0.16], 'metal', { seg: 10 });
  k.cyl(0.0135, 0.0135, 0.06, [0, 0.035, -0.23], 'metal', { seg: 10, pat: 2, sh: 0.9 });
  loop(k, [0, -0.026, -0.105]);
  // kabza (mermi kabzanın içinden), tetik korkuluğu, tetik
  k.prof([[0.012, -0.016], [0.068, -0.016], [0.074, -0.03], [0.078, -0.128], [0.07, -0.136], [0.018, -0.136], [0.012, -0.128]], 0.038, 'furn', { c: 0.005, pat: lod ? 0 : 1 });
  guard(k, [[0.016, -0.016], [0.016, -0.026], [0.0, -0.056], [-0.05, -0.056], [-0.058, -0.046], [-0.058, -0.016]], [[0.008, -0.022], [-0.006, -0.048], [-0.044, -0.048], [-0.05, -0.042], [-0.05, -0.016]], 0.012, 'metal');
  trig(k, -0.004, -0.018);
  // tel dipçik: iki yan çubuk + dikme + lastik ped
  for (const sx of [-1, 1]) { k.box([0.007, 0.007, 0.25], [sx * 0.019, 0.04, 0.185], 'metal', { c: 0.001 }); k.box([0.007, 0.08, 0.007], [sx * 0.019, 0.003, 0.31], 'metal', { c: 0.001 }); }
  k.box([0.045, 0.007, 0.007], [0, -0.035, 0.31], 'metal', { c: 0.001 });
  k.box([0.046, 0.07, 0.012], [0, 0.004, 0.317], 'furn', { c: 0.003 });
  // nişan: delikli arka gez + kulaklı arpacık · optik: RMR (adaptör plakası)
  let sg;
  if (iron) {
    peep(k, 0.058, line, 0.045, 0.005, 0.011);
    post(k, 0.06, line, -0.112);
    sg = { sight: [0, line, 0.045], pivot: [0, line, -0.112], dist: ADS_DIST.iron, overlay: 'none' };
  } else {
    k.box([0.03, 0.006, 0.05], [0, 0.063, 0.005], 'acc', { c: 0.0015 });
    k.box([0.022, 0.008, 0.022], [0, 0.064, -0.112], 'acc', { c: 0.002 });
    sg = opt(k, mat, o, 0.066, 0.005, true);
  }
  // şarjör (grup): kabza içinden aşağı + taban
  k.prof([[0.02, -0.02], [0.064, -0.02], [0.064, -0.158], [0.02, -0.158]], 0.03, 'body', { g: 'mag', c: 0.002, sh: 0.9 });
  k.prof([[0.016, -0.156], [0.068, -0.156], [0.068, -0.167], [0.016, -0.167]], 0.034, 'metal', { g: 'mag', c: 0.002 });
  return done(k, mat, { name: 'MAC-10', hold: 'pistol', gripR: [0, -0.025, 0.04], gripL: null, muzzle: [0, 0.035, -0.26], length: 0.58 }, sg);
}

// ───────────────────────── M249 (hafif makineli) ─────────────────────────
export function lmg(mat = skinMaterial('lmg'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron', line = 0.126;
  // gövde + arka kapak + besleme kapağı (kubbeli) + kapak rayı + kemer giriş yuvası + kurma kolu
  k.box([0.064, 0.094, 0.38], [0, 0.028, -0.11], 'body', { c: 0.005, ax: 'z' });
  k.box([0.066, 0.09, 0.012], [0, 0.026, 0.086], 'body', { c: 0.003, sh: 0.9 });
  k.xsec([[-0.03, 0.072], [0.03, 0.072], [0.03, 0.088], [0.022, 0.098], [-0.022, 0.098], [-0.03, 0.088]], 0.005, -0.215, 'body', { c: 0.003, sh: 1.06 });
  k.box([0.024, 0.01, 0.02], [0, 0.094, 0.015], 'metal', { d: 1, c: 0.002 });
  rail(k, -0.02, -0.2, 0.098, { w: 0.024, slot: 'metal' });
  k.box([0.006, 0.024, 0.06], [-0.032, 0.058, -0.1], 'body', { sh: 0.3 });
  k.box([0.003, 0.02, 0.05], [0.0322, 0.04, -0.06], 'body', { sh: 0.3, d: 1 });
  k.box([0.024, 0.012, 0.04], [0.042, 0.035, -0.24], 'metal', { c: 0.002 });
  k.box([0.003, 0.008, 0.12], [0.0322, 0.035, -0.2], 'body', { sh: 0.3, d: 1 });
  for (const [y, z] of [[0.0, 0.05], [0.055, 0.05], [0.0, -0.27], [0.055, -0.27]]) for (const sx of [-1, 1]) k.cyl(0.004, 0.004, 0.003, [sx * 0.0322, y, z], 'metal', { ax: 'x', seg: 6, d: 1 });
  // namlu + ısı kalkanı (delikli) + alt tutamaç (kaburgalı) + gaz borusu + gaz bloğu + alev gizleyici
  k.cyl(0.012, 0.012, 0.5, [0, 0.028, -0.55], 'metal', { seg: 10 });
  k.box([0.042, 0.012, 0.2], [0, 0.048, -0.41], 'body', { c: 0.004, ax: 'z' });
  for (let i = 0; i < 5; i++) k.box([0.03, 0.002, 0.016], [0, 0.0545, -0.33 - i * 0.04], 'body', { sh: 0.3, d: 1 });
  k.prof([[-0.3, 0.02], [-0.53, 0.02], [-0.535, 0.012], [-0.535, -0.022], [-0.52, -0.034], [-0.31, -0.034], [-0.3, -0.025]], 0.07, 'furn', { c: 0.006 });
  for (let i = 0; i < 6; i++) k.box([0.072, 0.004, 0.008], [0, -0.02, -0.33 - i * 0.034], 'furn', { sh: 0.55, d: 1 });
  k.cyl(0.009, 0.009, 0.08, [0, 0.002, -0.57], 'metal', { seg: 8 });
  k.box([0.034, 0.06, 0.04], [0, 0.012, -0.62], 'body', { c: 0.003 });
  k.cyl(0.016, 0.016, 0.045, [0, 0.028, -0.8175], 'metal', { seg: 10, sh: 0.85 });
  if (!lod) for (let i = 0; i < 4; i++) k.box([0.003, 0.022, 0.004], [Math.cos(i * 1.57 + 0.78) * 0.016, 0.028 + Math.sin(i * 1.57 + 0.78) * 0.016, -0.822], 'metal', { sh: 0.3, rot: [0, 0, i * 1.57 + 0.78] });
  // ön arpacık kulesi (gaz bloğunda, tepe 0,126) — optikte arpacık yatık
  k.box([0.02, 0.03, 0.022], [0, 0.055, -0.62], 'metal', { c: 0.002 });
  if (iron) { for (const sx of [-1, 1]) k.box([0.003, 0.05, 0.016], [sx * 0.011, 0.093, -0.62], 'metal', { c: 0.001, d: 1 }); k.box([0.003, 0.056, 0.003], [0, 0.098, -0.62], 'metal', { sh: 0.85 }); }
  // sol yanda katlı taşıma sapı + öne katlı iki ayak
  for (const z of [-0.52, -0.6]) k.box([0.05, 0.008, 0.01], [-0.032, 0.05, z], 'metal', { rot: [0, 0, -0.35] });
  k.cyl(0.009, 0.009, 0.11, [-0.058, 0.06, -0.56], 'furn', { seg: 8 });
  for (const sx of [-1, 1]) { k.box([0.01, 0.01, 0.2], [sx * 0.014, -0.012, -0.735], 'metal', { c: 0.002 }); k.box([0.016, 0.008, 0.02], [sx * 0.014, -0.016, -0.83], 'metal', { d: 1 }); }
  // tetik grubu, kabza (benekli), korkuluk, tetik; dipçik + dipçik plakası
  k.box([0.046, 0.016, 0.14], [0, -0.026, 0.02], 'body', { c: 0.002 });
  k.prof([[0.033, -0.019], [0.077, -0.019], [0.083, -0.032], [0.121, -0.14], [0.115, -0.152], [0.077, -0.154], [0.069, -0.144], [0.045, -0.052], [0.033, -0.034]], 0.036, 'furn', { c: 0.006, pat: lod ? 0 : 1 });
  guard(k, [[0.035, -0.03], [0.033, -0.042], [0.012, -0.07], [-0.04, -0.07], [-0.05, -0.06], [-0.05, -0.03]], [[0.023, -0.042], [0.006, -0.062], [-0.036, -0.062], [-0.042, -0.056], [-0.042, -0.034]], 0.014, 'body');
  trig(k, -0.004, -0.034);
  k.prof([[0.08, 0.068], [0.15, 0.062], [0.42, 0.045], [0.43, 0.04], [0.43, -0.105], [0.415, -0.115], [0.3, -0.088], [0.17, -0.045], [0.1, -0.03], [0.08, -0.02]], 0.05, 'furn', { c: 0.008 });
  k.prof([[0.2, 0.05], [0.36, 0.04], [0.36, 0.0], [0.2, 0.02]], 0.0505, 'furn', { d: 1, sh: 0.82 });
  k.prof([[0.428, 0.046], [0.444, 0.046], [0.444, -0.112], [0.428, -0.116]], 0.054, 'metal', { c: 0.003 });
  loop(k, [0, -0.06, 0.38]); loop(k, [0, -0.03, -0.5]);
  // nişan: kapak rayında delikli gez · optik (aksesuar → metal; aksesuar yuvası = fişek pirinci)
  let sg;
  if (iron) {
    k.box([0.026, 0.008, 0.03], [0, 0.11, -0.12], 'metal', { c: 0.002 });
    peep(k, 0.112, line, -0.12, 0.0058, 0.012, true, 'metal');
    sg = { sight: [0, line, -0.12], pivot: [0, line, -0.62], dist: ADS_DIST.iron, overlay: 'none' };
  } else sg = opt(k, mat, o, 0.106, -0.1, false, true);
  // fişek kutusu (grup, yeşil) + kutu kapağı / mandalı / nervürler + sol yandan besleme yuvasına çıkan kemer
  k.box([0.06, 0.022, 0.12], [0, -0.03, -0.13], 'body', { c: 0.002 });
  k.box([0.09, 0.12, 0.16], [-0.005, -0.1, -0.13], 'furn', { c: 0.006, g: 'mag' });
  k.box([0.094, 0.01, 0.164], [-0.005, -0.045, -0.13], 'furn', { c: 0.002, g: 'mag', sh: 0.8 });
  for (let i = 0; i < 3; i++) k.box([0.092, 0.08, 0.006], [-0.005, -0.105, -0.18 + i * 0.05], 'furn', { g: 'mag', d: 1, sh: 0.85 });
  k.box([0.03, 0.02, 0.006], [-0.005, -0.06, -0.212], 'metal', { g: 'mag', d: 1 });
  belt(k, [-0.03, -0.038], [-0.062, 0.0], [-0.036, 0.062], 7, -0.1);
  return done(k, mat, { name: 'M249 LMG', hold: 'rifle', gripR: [0, -0.03, 0.06], gripL: [0, -0.01, -0.45], muzzle: [0, 0.028, -0.84], length: 1.28 }, sg);
}

// ───────────────────────── PKM ─────────────────────────
export function pkm(mat = skinMaterial('pkm'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron', line = 0.125;
  // preslenmiş gövde + kaburgalar + perçinler + besleme kapağı + kurma kolu (sağ)
  k.box([0.058, 0.088, 0.42], [0, 0.02, -0.11], 'body', { c: 0.004, ax: 'z' });
  for (const sx of [-1, 1]) k.box([0.003, 0.008, 0.3], [sx * 0.0295, 0.0, -0.1], 'body', { d: 1, sh: 0.82 });
  for (const [y, z] of [[-0.012, 0.07], [0.048, 0.07], [-0.012, -0.29], [0.048, -0.29], [0.02, -0.02]]) for (const sx of [-1, 1]) k.cyl(0.0035, 0.0035, 0.003, [sx * 0.0295, y, z], 'metal', { ax: 'x', seg: 6, d: 1 });
  k.xsec([[-0.027, 0.062], [0.027, 0.062], [0.027, 0.08], [0.018, 0.09], [-0.018, 0.09], [-0.027, 0.08]], 0.04, -0.2, 'body', { c: 0.003, sh: 1.06 });
  for (const z of [-0.02, -0.1, -0.17]) k.xsec([[-0.028, 0.068], [0.028, 0.068], [0.028, 0.081], [0.019, 0.0915], [-0.019, 0.0915], [-0.028, 0.081]], z, z - 0.006, 'body', { d: 1, sh: 0.92 });
  k.box([0.012, 0.012, 0.02], [0, 0.088, 0.045], 'metal', { d: 1, c: 0.002 });
  k.box([0.026, 0.012, 0.03], [0.038, 0.02, -0.2], 'metal', { c: 0.003 });
  k.box([0.003, 0.022, 0.06], [-0.0295, 0.03, -0.05], 'body', { sh: 0.3 });
  // arka gez kaidesi (gövde önü) + eğik yaprak + U çentik (çentik dibi = 0,125) — optikte yalnız kaide
  k.box([0.03, 0.04, 0.05], [0, 0.08, -0.285], 'metal', { c: 0.004 });
  if (iron) { k.prof([[-0.262, 0.1], [-0.31, 0.1], [-0.31, 0.106], [-0.268, 0.11]], 0.024, 'metal', { c: 0.002 }); notch(k, 0.108, line, -0.268, -0.274, 0.0105, 0.003, 0.0055, 'metal'); }
  // namlu (oluklu) + alev gizleyici + gaz borusu + gaz bloğu + katlı iki ayak + taşıma sapı (ahşap)
  k.cyl(0.0115, 0.0115, 0.56, [0, 0.03, -0.6], 'metal', { seg: 10 });
  if (!lod) for (const a of [0, 1.57, 3.14]) k.box([0.003, 0.003, 0.2], [Math.cos(a) * 0.0115, 0.03 + Math.sin(a) * 0.0115, -0.48], 'metal', { sh: 0.4, rot: [0, 0, a] });
  k.cyl(0.0145, 0.0145, 0.05, [0, 0.03, -0.905], 'metal', { seg: 10, sh: 0.85 });
  if (!lod) for (let i = 0; i < 4; i++) k.box([0.003, 0.024, 0.004], [Math.cos(i * 1.57) * 0.0145, 0.03 + Math.sin(i * 1.57) * 0.0145, -0.912], 'metal', { sh: 0.3, rot: [0, 0, i * 1.57] });
  k.cyl(0.011, 0.011, 0.28, [0, 0.005, -0.46], 'body', { seg: 10 });
  k.prof([[-0.585, 0.045], [-0.625, 0.045], [-0.63, 0.03], [-0.625, -0.012], [-0.585, -0.012]], 0.03, 'metal', { c: 0.003 });
  for (const sx of [-1, 1]) k.box([0.009, 0.009, 0.2], [sx * 0.016, -0.01, -0.5], 'metal', { c: 0.002 });
  k.box([0.03, 0.026, 0.03], [0, 0.047, -0.4], 'metal', { c: 0.003 });
  k.prof([[-0.36, 0.058], [-0.372, 0.086], [-0.428, 0.086], [-0.44, 0.058]], 0.014, 'furn', { c: 0.003, holes: [[[-0.376, 0.062], [-0.382, 0.078], [-0.418, 0.078], [-0.424, 0.062]]] });
  // ön arpacık kulesi (namlu ucu): kaide + kulaklar + dikme (tepe 0,125)
  k.prof([[-0.825, 0.016], [-0.86, 0.016], [-0.86, 0.05], [-0.85, 0.062], [-0.836, 0.062], [-0.825, 0.05]], 0.028, 'metal', { c: 0.003 });
  if (iron) {                                                                                         // 12.139: optikte kulak + arpacık yok (pencerenin içinde dikmeler)
    for (const sx of [-1, 1]) k.box([0.003, 0.068, 0.014], [sx * 0.0105, 0.096, -0.843], 'metal', { c: 0.001 });
    k.box([0.003, 0.063, 0.003], [0, 0.0935, -0.843], 'metal', { sh: 0.85 });
  }
  // tetik grubu + ahşap kabza + korkuluk + tetik; iskelet dipçik (büyük boşluk) + dipçik plakası
  k.box([0.044, 0.014, 0.13], [0, -0.03, 0.03], 'body', { c: 0.002 });
  k.prof([[0.033, -0.022], [0.077, -0.022], [0.083, -0.035], [0.121, -0.14], [0.115, -0.152], [0.077, -0.154], [0.069, -0.144], [0.045, -0.055], [0.033, -0.037]], 0.036, 'furn', { c: 0.006, sh: 0.88, pat: lod ? 0 : 2 });
  guard(k, [[0.035, -0.035], [0.033, -0.045], [0.012, -0.072], [-0.04, -0.072], [-0.05, -0.062], [-0.05, -0.035]], [[0.023, -0.045], [0.006, -0.064], [-0.036, -0.064], [-0.042, -0.058], [-0.042, -0.037]], 0.013, 'metal');
  trig(k, -0.004, -0.037);
  k.prof([[0.1, 0.058], [0.16, 0.054], [0.45, 0.03], [0.455, 0.022], [0.455, -0.115], [0.44, -0.122], [0.3, -0.09], [0.16, -0.042], [0.1, -0.028]], 0.044, 'furn', { c: 0.007, holes: [[[0.175, 0.036], [0.38, 0.018], [0.38, -0.066], [0.3, -0.057], [0.19, -0.02]]], lodNoHoles: false });
  k.prof([[0.445, 0.025], [0.458, 0.023], [0.458, -0.117], [0.445, -0.12]], 0.046, 'metal', { c: 0.003 });
  loop(k, [0, -0.08, 0.4]); loop(k, [0, -0.01, -0.6]);
  // optik: sol yan ray kelepçesi + kapak üstüne köprü (aksesuar → metal)
  let sg;
  if (iron) sg = { sight: [0, line, -0.271], pivot: [0, line, -0.843], dist: 0.36, overlay: 'none' };      // PKM gezi gövde önünde (AK gibi): göz 8 cm geride (12.126)
  else {
    S3PARTS.coverMount(k, [[0.0325, 0.078], [0.0325, 0.083], [0.016, 0.11]], [[0.0295, 0.078], [0.0295, 0.0815], [0.0195, 0.093]], -0.1, 0.08, 'metal');   // kapak ayağı: tek parça eyer (12.139; eski 64 mm köprü + yan kelepçe)
    sg = opt(k, mat, o, 0.11, -0.1, false, true);
  }
  // çelik fişek kutusu (grup, sağ altta) + bağlantı + sağdan çıkan kemer
  k.box([0.05, 0.02, 0.1], [0.005, -0.032, -0.11], 'body', { c: 0.002 });
  k.box([0.085, 0.12, 0.15], [0.012, -0.1, -0.11], 'body', { c: 0.005, g: 'mag', sh: 1.18 });
  k.box([0.088, 0.008, 0.154], [0.012, -0.044, -0.11], 'body', { c: 0.002, g: 'mag', sh: 1.05 });
  for (let i = 0; i < 2; i++) for (const sx of [-1, 1]) k.box([0.003, 0.09, 0.012], [0.012 + sx * 0.0435, -0.105, -0.15 + i * 0.08], 'body', { g: 'mag', d: 1, sh: 1.0 });
  k.box([0.012, 0.01, 0.06], [0.06, -0.08, -0.11], 'metal', { g: 'mag', d: 1 });
  belt(k, [0.035, -0.038], [0.062, 0.0], [0.034, 0.045], 6, -0.11);
  return done(k, mat, { name: 'PKM', hold: 'rifle', gripR: [0, -0.03, 0.06], gripL: [0, -0.01, -0.42], muzzle: [0, 0.03, -0.93], length: 1.38 }, sg);
}

// ───────────────────────── M1911 ─────────────────────────
export function m1911(mat = skinMaterial('m1911'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron', line = 0.077;
  k.grp = 'slide';      // 12.141: sürgü (+ burun, burç, nişan / RMR) ayrı grup
  // sürgü (yan düz, üstü pahlı) + arka tırtıllar + atım penceresi + namlu burcu + yay tıpası
  k.xsec([[-0.0145, 0.03], [0.0145, 0.03], [0.0145, 0.06], [0.011, 0.068], [-0.011, 0.068], [-0.0145, 0.06]], 0.045, -0.168, 'body', { c: 0.002 });
  if (!lod) for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) k.box([0.002, 0.026, 0.0022], [sx * 0.0146, 0.047, 0.038 - i * 0.0045], 'body', { sh: 0.35 });
  k.box([0.003, 0.013, 0.034], [0.0146, 0.057, -0.035], 'body', { sh: 0.3 });
  k.box([0.012, 0.004, 0.03], [0.006, 0.0645, -0.035], 'metal', { d: 1 });
  k.box([0.029, 0.014, 0.04], [0, 0.024, -0.148], 'body', { c: 0.002 });
  k.cyl(0.0095, 0.0095, 0.012, [0, 0.05, -0.174], 'metal', { seg: 12 });
  k.cyl(0.0048, 0.0048, 0.003, [0, 0.05, -0.1795], 'metal', { sh: 0.2, d: 1 });
  k.cyl(0.006, 0.006, 0.006, [0, 0.024, -0.169], 'metal', { seg: 8, d: 1 });
  let sg;
  if (iron) k.box([0.003, 0.009, 0.008], [0, 0.0725, -0.155], 'acc', { c: 0.0005 });              // arpacık (12.139: RMR'de yok, pencerenin içinde dikme)
  if (iron) { notch(k, 0.068, line, 0.042, 0.035); sg = { sight: [0, line, 0.0385], pivot: [0, line, -0.155], dist: ADS_DIST.iron, overlay: 'none' }; }
  else sg = opt(k, mat, o, 0.068, 0.012, true);
  k.grp = null;
  // çerçeve + kabza gövdesi + ahşap paneller (benekli) + vidalar + kuyruk emniyeti + horoz
  k.prof([[0.05, 0.031], [-0.128, 0.031], [-0.128, 0.017], [-0.03, 0.014], [-0.01, 0.008], [0.05, 0.008]], 0.028, 'body', { c: 0.002, sh: 0.95 });
  k.prof([[0.002, 0.01], [0.048, 0.012], [0.06, 0.004], [0.064, -0.004], [0.092, -0.104], [0.088, -0.112], [0.04, -0.116], [0.034, -0.108], [0.012, -0.03], [0.002, -0.008]], 0.026, 'body', { c: 0.003 });
  k.prof([[0.016, -0.014], [0.058, -0.01], [0.083, -0.098], [0.041, -0.102]], 0.031, 'furn', { c: 0.002, pat: lod ? 0 : 1 });
  for (const [y, z] of [[-0.022, 0.03], [-0.088, 0.058]]) for (const sx of [-1, 1]) k.cyl(0.0035, 0.0035, 0.002, [sx * 0.0158, y, z], 'metal', { ax: 'x', seg: 6, d: 1 });
  k.prof([[0.045, 0.03], [0.07, 0.027], [0.078, 0.02], [0.072, 0.013], [0.05, 0.012]], 0.024, 'body', { c: 0.002 });
  k.prof([[0.046, 0.034], [0.056, 0.038], [0.062, 0.052], [0.056, 0.056], [0.05, 0.046], [0.044, 0.036]], 0.008, 'metal', { c: 0.001 });
  // tetik korkuluğu + düz tetik + sürgü durdurucu + emniyet + şarjör düğmesi
  guard(k, [[0.002, 0.01], [0.002, 0.0], [-0.012, -0.03], [-0.052, -0.032], [-0.058, -0.024], [-0.058, 0.01]], [[-0.006, 0.0], [-0.016, -0.023], [-0.048, -0.024], [-0.051, -0.019], [-0.051, 0.008]], 0.02, 'body');
  k.box([0.006, 0.018, 0.005], [0, 0.0, -0.014], 'metal', { d: 1 });
  k.box([0.003, 0.008, 0.032], [-0.0155, 0.026, -0.04], 'metal', { d: 1 });
  k.box([0.003, 0.008, 0.018], [-0.0155, 0.026, 0.03], 'metal', { d: 1 });
  k.cyl(0.004, 0.004, 0.003, [-0.0145, 0.0, 0.002], 'metal', { ax: 'x', d: 1, seg: 8 });
  // nişan (U çentikli gez + arpacık bıçağı · optik: RMR) sürgü grubunda, yukarıda
  // şarjör (grup): kabza içinde gövde + taban plakası
  k.prof([[0.016, 0.0], [0.05, 0.002], [0.078, -0.112], [0.044, -0.114]], 0.02, 'metal', { g: 'mag', sh: 1.1 });
  k.prof([[0.04, -0.113], [0.084, -0.109], [0.087, -0.121], [0.038, -0.123]], 0.026, 'metal', { g: 'mag', c: 0.002 });
  return done(k, mat, { name: 'M1911', hold: 'pistol', gripR: [0, -0.03, 0.025], gripL: null, muzzle: [0, 0.05, -0.18], length: 0.28, slideTravel: 0.028 }, sg);
}

// ───────────────────────── Desert Eagle ─────────────────────────
export function deagle(mat = skinMaterial('deagle'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron', line = 0.091;
  // sabit namlu bloğu (yan düz, ön pahlı) + üst ray + yan yüz oyuğu + namlu ağzı
  k.prof([[-0.068, 0.076], [-0.272, 0.076], [-0.282, 0.068], [-0.285, 0.06], [-0.285, 0.024], [-0.275, 0.018], [-0.068, 0.018]], 0.036, 'body', { c: 0.003 });
  for (const sx of [-1, 1]) k.box([0.002, 0.03, 0.16], [sx * 0.018, 0.045, -0.18], 'body', { d: 1, sh: 0.82 });
  if (iron) rail(k, -0.09, -0.24, 0.076, { w: 0.016 });                                               // 12.139: RMR'de namlu rayı yok (dişleri pencerenin dibinde koyu blok)
  k.cyl(0.0068, 0.0068, 0.003, [0, 0.04, -0.2855], 'metal', { sh: 0.2, seg: 10 });
  // sürgü (pahlı üst kesit) + arka tırtıllar + atım penceresi + emniyet kolları + horoz
  k.grp = 'slide';      // 12.141: sürgü + emniyet kolları + gez / RMR ayrı grup (namlu bloğu ve arpacık sabit)
  k.xsec([[-0.019, 0.026], [0.019, 0.026], [0.019, 0.066], [0.014, 0.076], [-0.014, 0.076], [-0.019, 0.066]], 0.062, -0.068, 'body', { c: 0.002, sh: 1.05 });
  if (!lod) for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) k.box([0.002, 0.032, 0.003], [sx * 0.0191, 0.05, 0.052 - i * 0.0065], 'body', { sh: 0.4 });
  k.box([0.003, 0.016, 0.04], [0.0192, 0.058, -0.03], 'body', { sh: 0.3 });
  for (const sx of [-1, 1]) k.box([0.004, 0.008, 0.016], [sx * 0.021, 0.058, 0.048], 'metal', { d: 1, c: 0.001 });
  let sg;
  if (iron) { notch(k, 0.076, line, 0.046, 0.038, 0.011, 0.0028, 0.006); sg = { sight: [0, line, 0.042], pivot: [0, line, -0.256], dist: ADS_DIST.iron, overlay: 'none' }; }
  else sg = opt(k, mat, o, 0.076, 0.008, true);
  k.grp = null;
  k.prof([[0.06, 0.04], [0.07, 0.044], [0.076, 0.066], [0.068, 0.068], [0.06, 0.054]], 0.01, 'metal', { c: 0.001 });
  // çerçeve (namlu altına uzanır) + iri köşeli korkuluk + tetik + sürgü durdurucu + kabza (lastik, benekli, parmak oyukları)
  k.prof([[0.062, 0.027], [-0.068, 0.027], [-0.068, 0.018], [-0.21, 0.018], [-0.215, 0.006], [-0.2, 0.0], [-0.03, 0.0], [-0.01, 0.004], [0.062, 0.004]], 0.034, 'body', { c: 0.002, sh: 0.9 });
  guard(k, [[0.0, 0.004], [0.0, -0.006], [-0.016, -0.04], [-0.074, -0.04], [-0.08, -0.032], [-0.08, 0.002]], [[-0.008, -0.006], [-0.02, -0.032], [-0.066, -0.032], [-0.072, -0.026], [-0.072, 0.002]], 0.022, 'body');
  trig(k, -0.012, 0.002);
  k.box([0.003, 0.009, 0.03], [-0.0175, 0.022, -0.02], 'metal', { d: 1 });
  k.prof([[0.006, 0.006], [0.06, 0.008], [0.072, -0.002], [0.076, -0.012], [0.094, -0.112], [0.088, -0.124], [0.042, -0.128], [0.032, -0.118], [0.014, -0.034], [0.006, -0.012]], 0.036, 'furn', { c: 0.004, pat: lod ? 0 : 1 });
  for (let i = 0; i < 3; i++) k.box([0.037, 0.004, 0.012], [0, -0.04 - i * 0.026, 0.018 + i * 0.0058], 'furn', { d: 1, sh: 0.6, rot: [0.22, 0, 0] });
  // nişan: çentikli gez + rayın önünde arpacık · optik: RMR (sürgüde)
  if (iron) {                                                                                         // 12.139: RMR'de arpacık yok (pencerenin içinde koyu blok)
    k.box([0.012, 0.006, 0.012], [0, 0.079, -0.256], 'acc', { c: 0.001 });
    k.box([0.0035, 0.009, 0.007], [0, 0.0865, -0.256], 'acc', { sh: 0.85 });
  }
  // şarjör (grup)
  k.prof([[0.02, 0.0], [0.056, 0.002], [0.08, -0.118], [0.046, -0.122]], 0.024, 'metal', { g: 'mag', sh: 1.1 });
  k.prof([[0.038, -0.124], [0.092, -0.118], [0.095, -0.13], [0.036, -0.132]], 0.032, 'metal', { g: 'mag', c: 0.002 });
  return done(k, mat, { name: 'Desert Eagle', hold: 'pistol', gripR: [0, -0.03, 0.045], gripL: null, muzzle: [0, 0.04, -0.285], length: 0.36, slideTravel: 0.03 }, sg);
}

// ───────────────────────── Revolver (.44, paslanmaz, ahşap kabza) ─────────────────────────
export function revolver(mat = skinMaterial('revolver'), lod = false) {
  const k = newKit(lod), line = 0.092;
  // namlu + tam boy alt kütle + delikli üst sırt + rampa arpacık (tepe 0,092) + namlu ağzı
  k.cyl(0.0105, 0.0105, 0.29, [0, 0.062, -0.255], 'body', { seg: 12 });
  k.box([0.022, 0.026, 0.27], [0, 0.045, -0.265], 'body', { c: 0.003, ax: 'z' });
  k.box([0.012, 0.012, 0.282], [0, 0.0735, -0.259], 'body', { c: 0.002 });
  for (let i = 0; i < 5; i++) k.box([0.0125, 0.004, 0.022], [0, 0.0745, -0.16 - i * 0.045], 'body', { sh: 0.3, d: i > 3 });
  k.prof([[-0.37, 0.0795], [-0.398, 0.0795], [-0.398, line], [-0.385, line]], 0.0035, 'acc', { c: 0 });
  k.cyl(0.0058, 0.0058, 0.003, [0, 0.062, -0.4005], 'metal', { sh: 0.2, seg: 10 });
  // çerçeve (üst köprü) + silindir (oluklu, 6 yuva) + silindir mandalı + horoz + U çentikli gez
  k.prof([[0.058, 0.088], [-0.112, 0.088], [-0.118, 0.082], [-0.118, 0.03], [-0.11, 0.018], [-0.04, 0.008], [0.0, 0.0], [0.04, 0.0], [0.058, 0.03], [0.06, 0.06]], 0.03, 'body', { c: 0.002, holes: [[[-0.038, 0.022], [-0.106, 0.022], [-0.106, 0.077], [-0.038, 0.077]]] });   // çerçeve penceresi: silindir yandan ayrı görünsün
  k.grp = 'slide';      // 12.141: silindir ayrı grup (atıştan sonra 60° döner)
  k.cyl(0.031, 0.031, 0.05, [0, 0.043, -0.074], 'metal', { seg: 14 });
  for (const s of [-1, 1]) k.cyl(s < 0 ? 0.027 : 0.031, s < 0 ? 0.031 : 0.027, 0.007, [0, 0.043, -0.074 + s * 0.0285], 'metal', { seg: 14 });   // ön / arka pah
  if (!lod) for (let i = 0; i < 6; i++) { const a = (i + 0.5) * (Math.PI / 3); k.box([0.008, 0.004, 0.03], [Math.cos(a) * 0.0302, 0.043 + Math.sin(a) * 0.0302, -0.074], 'metal', { sh: 0.3, rot: [0, 0, a + Math.PI / 2] }); }
  if (!lod) for (let i = 0; i < 6; i++) { const a = i * (Math.PI / 3) + Math.PI / 2; k.cyl(0.0058, 0.0058, 0.002, [Math.cos(a) * 0.019, 0.043 + Math.sin(a) * 0.019, -0.1065], 'metal', { sh: 0.2, seg: 8 }); }
  k.grp = null;
  k.box([0.004, 0.01, 0.016], [-0.0165, 0.04, -0.03], 'metal', { d: 1, c: 0.001 });
  k.prof([[0.05, 0.06], [0.066, 0.066], [0.08, 0.082], [0.074, 0.086], [0.062, 0.078], [0.048, 0.07]], 0.009, 'metal', { c: 0.001 });
  notch(k, 0.086, line, 0.048, 0.04, 0.0095, 0.0026, 0.006);
  // ahşap kabza (yuvarlak dip, benekli) + madalyon + korkuluk + kavisli tetik
  k.prof([[0.028, 0.004], [0.062, 0.03], [0.066, 0.04], [0.08, 0.02], [0.105, -0.06], [0.11, -0.095], [0.098, -0.108], [0.06, -0.11], [0.045, -0.1], [0.04, -0.07], [0.032, -0.03], [0.028, -0.004]], 0.034, 'furn', { c: 0.004, pat: lod ? 0 : 1 });
  for (const sx of [-1, 1]) k.cyl(0.006, 0.006, 0.002, [sx * 0.0172, -0.03, 0.06], 'metal', { ax: 'x', d: 1, seg: 8 });
  guard(k, [[0.03, 0.004], [0.028, -0.008], [0.01, -0.034], [-0.03, -0.034], [-0.04, -0.022], [-0.04, 0.004]], [[0.02, -0.006], [0.006, -0.026], [-0.026, -0.026], [-0.032, -0.018], [-0.032, 0.002]], 0.016, 'body');
  trig(k, 0.004, 0.002);
  return done(k, mat, { name: 'Revolver', hold: 'pistol', gripR: [0, -0.03, 0.05], gripL: null, muzzle: [0, 0.062, -0.4], length: 0.5, slideKind: 'cyl', slidePivot: 0.043 },
    { sight: [0, line, 0.044], pivot: [0, line, -0.39], dist: ADS_DIST.iron, overlay: 'none' });
}

// ───────────────────────── RPG-7 ─────────────────────────
export function rpg(mat = skinMaterial('rpg'), lod = false) {
  const k = newKit(lod);
  // atım tüpü + ahşap ısı koruması (bantlı) + arka venturi hunisi + ön ağız halkası
  k.cyl(0.03, 0.03, 0.92, [0, 0.05, 0.05], 'body', { seg: 14 });
  k.cyl(0.037, 0.037, 0.3, [0, 0.05, -0.12], 'furn', { seg: 12 });
  if (!lod) for (let i = 0; i < 4; i++) k.box([0.004, 0.003, 0.28], [Math.cos(0.5 + i * 0.7) * 0.037, 0.05 + Math.sin(0.5 + i * 0.7) * 0.037, -0.12], 'furn', { sh: 0.7, rot: [0, 0, 0.5 + i * 0.7] });
  for (const z of [0.03, -0.27]) k.cyl(0.039, 0.039, 0.012, [0, 0.05, z], 'metal', { seg: 12 });
  k.cyl(0.031, 0.058, 0.13, [0, 0.05, 0.57], 'body', { seg: 14 });
  k.cyl(0.062, 0.062, 0.016, [0, 0.05, 0.642], 'metal', { seg: 14 });
  k.cyl(0.052, 0.052, 0.002, [0, 0.05, 0.651], 'metal', { sh: 0.15, seg: 14, d: 1 });
  k.cyl(0.033, 0.033, 0.02, [0, 0.05, -0.4], 'metal', { seg: 12 });
  for (const z of [0.25, 0.4]) k.cyl(0.032, 0.032, 0.01, [0, 0.05, z], 'metal', { seg: 12, d: 1 });
  // tetik mekanizması + kabza (bakalit, benekli) + korkuluk + tetik + ön dikey kabza
  k.box([0.03, 0.03, 0.12], [0, 0.005, 0.0], 'metal', { c: 0.003 });
  k.prof([[0.018, -0.008], [0.06, -0.008], [0.066, -0.02], [0.096, -0.125], [0.09, -0.136], [0.056, -0.138], [0.05, -0.128], [0.03, -0.04], [0.018, -0.024]], 0.034, 'acc', { c: 0.005, pat: lod ? 0 : 1 });
  guard(k, [[0.018, -0.008], [0.018, -0.016], [0.0, -0.05], [-0.045, -0.05], [-0.052, -0.042], [-0.052, -0.008]], [[0.008, -0.014], [-0.006, -0.042], [-0.04, -0.042], [-0.044, -0.036], [-0.044, -0.01]], 0.012);
  trig(k, -0.012, -0.01);
  k.prof([[-0.18, 0.018], [-0.22, 0.018], [-0.225, 0.0], [-0.218, -0.08], [-0.21, -0.088], [-0.19, -0.088], [-0.182, -0.08], [-0.178, 0.0]], 0.032, 'acc', { c: 0.004, pat: lod ? 0 : 1 });
  loop(k, [0, 0.016, 0.3]); loop(k, [0, 0.016, -0.32]);
  // nişan (tüpün solunda): arkada halka (göze yakın), önde ışıyan uçlu arpacık (uç merkezi 0,14 = nişan çizgisi)
  k.box([0.036, 0.01, 0.024], [-0.026, 0.085, -0.05], 'metal', { c: 0.002 });
  k.box([0.01, 0.036, 0.014], [-0.045, 0.106, -0.05], 'metal', { c: 0.002 });
  k.ring(0.013, 0.0028, [-0.045, 0.14, -0.05], 'acc', { ax: 'z', seg: 16, rs: 4 });
  k.box([0.036, 0.01, 0.022], [-0.026, 0.085, -0.38], 'metal', { c: 0.002 });
  k.box([0.007, 0.046, 0.009], [-0.045, 0.111, -0.38], 'metal', { c: 0.001 });
  k.box([0.008, 0.012, 0.01], [-0.045, 0.14, -0.38], 'glow');
  // roket (grup, doldururken öne çıkar): fünye + burun konisi + harp başlığı + bant + daralma + motor
  k.cyl(0.008, 0.012, 0.02, [0, 0.05, -0.675], 'metal', { g: 'mag', seg: 10 });
  k.cyl(0.012, 0.048, 0.13, [0, 0.05, -0.6], 'body', { g: 'mag', seg: 14, sh: 1.12 });
  k.cyl(0.048, 0.048, 0.07, [0, 0.05, -0.5], 'body', { g: 'mag', seg: 14, sh: 1.12 });
  k.cyl(0.0495, 0.0495, 0.01, [0, 0.05, -0.52], 'metal', { g: 'mag', seg: 14, d: 1 });
  k.cyl(0.048, 0.03, 0.04, [0, 0.05, -0.445], 'body', { g: 'mag', seg: 14, sh: 1.05 });
  k.cyl(0.026, 0.026, 0.04, [0, 0.05, -0.405], 'metal', { g: 'mag', seg: 12 });
  return done(k, mat, { name: 'RPG-7', hold: 'launcher', magAxis: [0, 0, -1], gripR: [0, -0.03, 0.04], gripL: [0, -0.03, -0.2], muzzle: [0, 0.05, -0.68], length: 1.3 },
    { sight: [-0.045, 0.14, -0.05], dist: 0.38 });
}

export const S3SMG = { mp5, vector, p90, mac10, lmg, pkm, m1911, deagle, revolver, rpg };
