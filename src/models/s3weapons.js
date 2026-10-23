import * as THREE from 'three';
import { Kit, bez, rail } from './s3kit.js';
import { skinMaterial } from './skins.js';

// S3 "BattleBit" silahları (silah laboratuvarı c9c5506'dan oyuna, 12.122): AK-47, M4A1, Glock 17, M24, Pompalı (yeni). Yan profil çekme + pah, yarıklı ray, benekli kabza, kaburgalı şarjör.
// Sözleşme eski modellerle aynı (finish: gripR / gripL / muzzle / hold / length / mag / bolt; ±1 cm). Nişangâh (demir / red dot / holo / ACOG) aynı Kit'e kurulur → silah + nişangâh TEK ağ,
// cam ayrı saydam ağ. Nişan noktası (sight) = nişangâh penceresinin / gez deliğinin tam ortası; ışıyan retikül (glow yuvası) bu eksende → adsalign testi ekranda ölçer.
const stripe = (A, B, a, b) => { const p = A.map((q, i) => [q[0] + (B[i][0] - q[0]) * a, q[1] + (B[i][1] - q[1]) * a]), r = A.map((q, i) => [q[0] + (B[i][0] - q[0]) * b, q[1] + (B[i][1] - q[1]) * b]); return [...p, ...r.reverse()]; };
const plate = (k, f, r, w, h, slot, o = {}) => { const cz = (f[0] + r[0]) / 2, cy = (f[1] + r[1]) / 2, L = Math.hypot(r[0] - f[0], r[1] - f[1]); k.box([w, h, L + 0.006], [0, cy - h * 0.35, cz], slot, { ...o, rot: [Math.atan2(-(r[1] - f[1]), r[0] - f[0]), 0, 0] }); };
const guard = (k, outer, hole, w, slot = 'metal') => k.prof(outer, w, slot, { holes: [hole], c: 0.002 });
const circ = (cx, cy, r, n = 14) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]);

// Nişan alırken gözden nişan noktasına uzaklık (kamera uzayı, m): nişangâh türü başına SABİT → her silahta aynı ekran boyu (eski OPT_K / ADS_K karşılığı)
export const ADS_DIST = { iron: 0.286, reddot: 0.36, rmr: 0.33, holo: 0.39, acog: 0.042, scope: 0.042 };
// Nişanda silah kamerasının yakın düzlemi (kamera uzayı, m) = nişangâhın göze en yakın yüzünün hemen önü: arkadaki gövde / dipçik / el kesilir, kesik içi açık kalır
// (arka yüzler çizilmez → alt ekranda koyu kütle yerine yalnız silahın üst yüzü + nişangâh görünür)
export const ADS_NEAR = { iron: 0.27, reddot: 0.32, rmr: 0.25, holo: 0.335, acog: 0.03, scope: 0.03, pistol: 0.25 };   // tabanca: sürgü arkası + el görünür
const GLASS_MAT = new THREE.MeshStandardMaterial({ color: '#9fd4ff', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.3, depthWrite: false });
GLASS_MAT.userData.glass = true;

// ── nişangâhlar (yb = monte yüzeyi, z = gövde merkezi). Döndürür: nişan noktası + uzaklık + HUD örtüsü; camlar k.glass'a ──
// Red dot (Aimpoint T-2 tarzı): ince tüp, iki uçta halka, ön cam, eksende ışıyan nokta
function redDot(k, yb, z) {
  const R = 0.0168, cy = yb + 0.03;
  if (k.lod) { k.box([0.03, 0.019, 0.046], [0, yb + 0.0095, z], 'acc'); k.cyl(R + 0.002, R + 0.002, 0.042, [0, cy, z], 'acc', { seg: 6 }); return { sight: [0, cy, z], dist: ADS_DIST.reddot, near: ADS_NEAR.reddot, overlay: 'dot' }; }   // 3. şahıs: iki parça
  k.box([0.03, 0.007, 0.046], [0, yb + 0.0035, z], 'acc', { c: 0.002 });                               // monte tabanı
  k.box([0.016, 0.012, 0.03], [0, yb + 0.012, z], 'acc', { c: 0.002 });                                 // yükseltici
  k.box([0.007, 0.012, 0.03], [0.018, yb + 0.006, z + 0.002], 'acc', { d: 1, c: 0.0015 });              // kelepçe somunu
  k.cyl(R + 0.0018, R + 0.0018, 0.04, [0, cy, z], 'acc', { seg: 20, open: true });                       // ince gövde (içi açık)
  k.ring(R + 0.0006, 0.0024, [0, cy, z + 0.021], 'acc', { ax: 'z', seg: 22, rs: 5 });                   // arka halka
  k.ring(R + 0.0012, 0.003, [0, cy, z - 0.021], 'acc', { ax: 'z', seg: 22, rs: 5 });                    // ön göz kapağı halkası
  k.box([0.011, 0.008, 0.012], [0, cy + R + 0.005, z], 'acc', { c: 0.002 });                            // üst ayar kulesi
  k.cyl(0.0055, 0.0055, 0.008, [R + 0.005, cy, z + 0.002], 'acc', { ax: 'x', seg: 10 });                // yan parlaklık topuzu
  k.box([0.0024, 0.0024, 0.0008], [0, cy, z - 0.0185], 'glow');                                          // ışıyan nokta (cam arkasında)
  k.glass.push({ disc: R, pos: [0, cy, z - 0.0195] });
  return { sight: [0, cy, z], dist: ADS_DIST.reddot, near: ADS_NEAR.reddot, overlay: 'dot' };
}
// Tabanca red dot (RMR): sürgü üstünde açık pencereli kısa gövde
function rmr(k, yb, z) {
  const cy = yb + 0.0165;
  if (k.lod) { k.box([0.028, 0.03, 0.034], [0, yb + 0.015, z], 'acc'); return { sight: [0, cy, z], dist: ADS_DIST.rmr, near: ADS_NEAR.rmr, overlay: 'dot' }; }
  k.box([0.028, 0.005, 0.034], [0, yb + 0.0025, z], 'acc', { c: 0.0015 });
  k.xsec([[-0.0145, yb + 0.004], [0.0145, yb + 0.004], [0.0145, yb + 0.016], [0.0105, yb + 0.03], [-0.0105, yb + 0.03], [-0.0145, yb + 0.016]], z + 0.006, z - 0.006, 'acc',
    { c: 0.001, holes: [[[-0.0115, yb + 0.0065], [0.0115, yb + 0.0065], [0.0115, yb + 0.0165], [0.0082, yb + 0.0268], [-0.0082, yb + 0.0268], [-0.0115, yb + 0.0165]]] });
  k.box([0.029, 0.008, 0.012], [0, yb + 0.008, z + 0.012], 'acc', { c: 0.0015 });                       // arka gövde (pil)
  k.box([0.0022, 0.0022, 0.0008], [0, cy, z - 0.0045], 'glow');
  k.glass.push({ rect: [0.022, 0.019], pos: [0, cy, z - 0.005] });
  return { sight: [0, cy, z], dist: ADS_DIST.rmr, near: ADS_NEAR.rmr, overlay: 'dot' };
}
// Holografik (EOTech EXPS tarzı): açık dikdörtgen pencere (iki ince çerçeve), yan kanatlar, ön pil yuvası, camda ışıyan halka + nokta
function holo(k, yb, z) {
  const cy = yb + 0.0335, win = [[-0.019, yb + 0.014], [0.019, yb + 0.014], [0.019, yb + 0.053], [-0.019, yb + 0.053]];
  if (k.lod) { k.box([0.046, 0.014, 0.096], [0, yb + 0.007, z], 'acc'); k.box([0.052, 0.046, 0.076], [0, yb + 0.037, z - 0.002], 'acc'); return { sight: [0, cy, z], dist: ADS_DIST.holo, near: ADS_NEAR.holo, overlay: 'holo' }; }
  const frame = [[-0.026, yb + 0.01], [0.026, yb + 0.01], [0.026, yb + 0.052], [0.02, yb + 0.06], [-0.02, yb + 0.06], [-0.026, yb + 0.052]];
  k.box([0.046, 0.014, 0.096], [0, yb + 0.007, z], 'acc', { c: 0.003 });                               // taban
  for (const [z0, z1] of [[z + 0.042, z + 0.03], [z - 0.032, z - 0.046]]) k.xsec(frame, z0, z1, 'acc', { holes: [win], c: 0.0015 });
  for (const sx of [-1, 1]) k.box([0.0035, 0.034, 0.064], [sx * 0.0235, yb + 0.032, z - 0.002], 'acc', { c: 0.001, d: 1, sh: 0.9 });   // ince yan duvarlar
  k.box([0.034, 0.004, 0.064], [0, yb + 0.058, z - 0.002], 'acc', { c: 0.001, d: 1 });                 // ince tavan
  k.box([0.036, 0.016, 0.03], [0, yb + 0.012, z - 0.064], 'acc', { c: 0.004 });                         // pil yuvası
  for (const x of [-0.01, 0.01]) k.box([0.008, 0.005, 0.006], [x, yb + 0.016, z + 0.05], 'acc', { d: 1, sh: 0.6 });   // düğmeler
  k.ring(0.0145, 0.0005, [0, cy, z - 0.031], 'glow', { ax: 'z', seg: 32, rs: 3, d: 1 });                // ışıyan halka: HUD #holo halkasıyla aynı ekran boyu (5,07vh)
  k.box([0.0018, 0.0018, 0.0006], [0, cy, z - 0.031], 'glow');                                           // merkez nokta
  k.glass.push({ rect: [0.038, 0.039], pos: [0, cy, z - 0.0315] });
  return { sight: [0, cy, z], dist: ADS_DIST.holo, near: ADS_NEAR.holo, overlay: 'holo' };
}
// ACOG 3× (TA31 tarzı): dövme gövde, objektif / göz çanı, üstte fiber kanalı, göz merceğinde ışıyan şevron (HUD dürbün örtüsüne geçmeden önce de görünür)
function acog(k, yb, z) {
  const cy = yb + 0.034, ze = z + 0.066;
  if (k.lod) { k.box([0.034, 0.024, 0.08], [0, yb + 0.012, z], 'acc'); k.cyl(0.024, 0.02, 0.17, [0, cy, z - 0.012], 'acc', { seg: 6 }); return { sight: [0, cy, ze], dist: ADS_DIST.acog, near: ADS_NEAR.acog, overlay: 'scope' }; }
  k.box([0.034, 0.012, 0.08], [0, yb + 0.006, z], 'acc', { c: 0.003 });
  k.box([0.016, 0.0035, 0.05], [0, yb + 0.0132, z], 'acc', { c: 0.001 });                             // yükseltici (tüp içine girmez: cam arkasından görünmesin)
  k.cyl(0.0195, 0.0195, 0.08, [0, cy, z - 0.004], 'acc', { seg: 16 });                                  // gövde
  k.cyl(0.0245, 0.0195, 0.026, [0, cy, z - 0.057], 'acc', { seg: 18 });                                 // objektif konisi
  k.cyl(0.0245, 0.0245, 0.016, [0, cy, z - 0.078], 'acc', { seg: 18, sh: 0.9 });                        // objektif çanı
  k.cyl(0.0175, 0.021, 0.03, [0, cy, z + 0.05], 'acc', { seg: 18 });                                    // göz çanı
  k.box([0.012, 0.01, 0.07], [0, cy + 0.024, z - 0.01], 'acc', { c: 0.002 });                           // fiber kanalı (iç tüp çeperinin dışında)
  k.box([0.014, 0.012, 0.016], [0, cy + 0.0255, z - 0.002], 'acc', { c: 0.002, d: 1 });                 // yükseklik kapağı
  k.box([0.012, 0.014, 0.016], [0.0255, cy, z - 0.002], 'acc', { c: 0.002, d: 1 });                     // yan kapak
  k.cyl(0.022, 0.022, 0.002, [0, cy, z - 0.0855], 'lens', { seg: 18 });                                 // ön mercek
  k.cyl(0.0198, 0.0198, 0.002, [0, cy, ze - 0.001], 'lens', { seg: 18 });                               // göz merceği
  for (const s of [-1, 1]) k.box([0.0042, 0.0007, 0.0006], [s * 0.0013, cy - 0.00182, ze + 0.0004], 'glow', { rot: [0, 0, -s * 0.9] });   // şevron: çizginin üst kenarının tepesi = nişan noktası (eksende)
  return { sight: [0, cy, ze], dist: ADS_DIST.acog, near: ADS_NEAR.acog, overlay: 'scope' };
}
// Seçilen nişangâhı kur (iron → null: silah kendi demir nişanını kurar)
function optic(k, o, yb, z, pistol = false) {
  if (o === 'reddot') return pistol ? rmr(k, yb, z) : redDot(k, yb, z);
  if (o === 'holo') return holo(k, yb, z);
  if (o === 'acog') return acog(k, yb, z);
  return null;
}
// Katlanır arka gez (MBUS): açıkken halka delikli plaka (gez deliği = nişan noktası), optik takılıyken yatık
function flipRear(k, x, yRail, z, line, up, R = 0.0068) {
  k.box([0.024, 0.01, 0.03], [x, yRail + 0.005, z], 'acc', { c: 0.002 });
  if (!up) { k.box([0.022, 0.006, 0.026], [x, yRail + 0.013, z + 0.004], 'acc', { c: 0.002, sh: 0.9 }); return null; }
  for (const sx of [-1, 1]) k.box([0.004, 0.026, 0.016], [x + sx * 0.0135, line - 0.002, z], 'acc', { c: 0.001 });   // koruyucu kulaklar
  k.xsec([[-0.0115, yRail + 0.008], [0.0115, yRail + 0.008], [0.0115, line + 0.0095], [0.007, line + 0.0145], [-0.007, line + 0.0145], [-0.0115, line + 0.0095]], z + 0.003, z - 0.003, 'acc',
    { holes: [circ(x, line, R, 16)], c: 0.0008 });
  return [x, line, z];
}

// Kurulum sonu: camlar ayrı saydam ağ (lod'da yok), nişan noktası / uzaklık / örtü
function done(k, mat, meta, sg) {
  const g = k.build(mat, meta);
  if (k.glass.length && !k.lod) {
    const geos = k.glass.map((c) => { const gg = c.disc ? new THREE.CircleGeometry(c.disc, 20) : new THREE.PlaneGeometry(c.rect[0], c.rect[1]); gg.translate(...c.pos); return gg; });
    const mesh = new THREE.Mesh(geos.length > 1 ? mergeAll(geos) : geos[0], GLASS_MAT); mesh.renderOrder = 2; g.add(mesh);
  }
  if (sg) { g.userData.sight = sg.sight; g.userData.pivot = sg.pivot; g.userData.dist = sg.dist; g.userData.near = sg.near; g.userData.overlay = sg.overlay; }
  return g;
}
function mergeAll(geos) { const pos = []; for (const g of geos) { const n = g.index ? g.toNonIndexed() : g; pos.push(...n.attributes.position.array); } const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); r.computeVertexNormals(); return r; }
const newKit = (lod) => { const k = new Kit(lod); k.glass = []; return k; };

// ───────────────────────── AK-47 ─────────────────────────
export function ak47(mat = skinMaterial('ak47'), lod = false, o = 'iron') {
  const k = newKit(lod);
  // gövde (preslenmiş sac) + toz kapağı (kubbeli kesit) + kapak kaburgaları
  k.box([0.05, 0.072, 0.31], [0, 0.018, -0.105], 'body', { c: 0.005, ax: 'z' });
  k.xsec([[-0.0235, 0.052], [0.0235, 0.052], [0.0235, 0.074], [0.017, 0.087], [0.006, 0.092], [-0.006, 0.092], [-0.017, 0.087], [-0.0235, 0.074]], 0.047, -0.252, 'body', { c: 0.003, sh: 1.08 });
  for (const z of [0.01, -0.06, -0.13]) k.xsec([[-0.025, 0.06], [0.025, 0.06], [0.025, 0.075], [0.018, 0.0885], [-0.018, 0.0885], [-0.025, 0.075]], z, z - 0.007, 'body', { d: 1, sh: 0.92 });
  k.box([0.012, 0.012, 0.014], [0, 0.07, 0.054], 'metal', { d: 1 });                                 // geri tepme yayı düğmesi
  k.box([0.054, 0.052, 0.022], [0, 0.022, -0.262], 'body', { c: 0.003, sh: 0.9 });                     // ön trunnion
  k.box([0.003, 0.024, 0.08], [0.0255, 0.04, -0.075], 'body', { sh: 0.32 });                          // fişek atım penceresi
  k.box([0.026, 0.012, 0.016], [0.034, 0.046, -0.122], 'metal', { c: 0.003 });                        // kurma kolu
  k.box([0.004, 0.014, 0.1], [0.0265, 0.028, -0.01], 'metal', { c: 0.0015, rot: [0.06, 0, 0] });       // emniyet kolu
  k.box([0.006, 0.022, 0.012], [0.029, 0.012, 0.042], 'metal', { c: 0.002 });
  for (const [y, z] of [[-0.004, -0.235], [0.044, -0.23], [-0.004, 0.03], [0.044, 0.035], [0.005, -0.095]]) for (const sx of [-1, 1]) k.cyl(0.0035, 0.0035, 0.003, [sx * 0.0255, y, z], 'metal', { ax: 'x', seg: 6, d: 1 });   // perçinler
  k.box([0.052, 0.012, 0.03], [0, 0.0, -0.105], 'body', { d: 1, sh: 0.85, c: 0.002 });                // şarjör yuvası çıkıntısı
  // arka gez bloğu + U çentikli yaprak (çentik dibi = arpacık tepesi = nişan çizgisi 0,105)
  k.box([0.032, 0.026, 0.056], [0, 0.066, -0.282], 'metal', { c: 0.004 });
  k.prof([[-0.262, 0.079], [-0.31, 0.079], [-0.31, 0.087], [-0.268, 0.091]], 0.024, 'metal', { c: 0.002 });
  k.xsec([[-0.0105, 0.089], [0.0105, 0.089], [0.0105, 0.1105], [0.003, 0.1105], [0.003, 0.105], [-0.003, 0.105], [-0.003, 0.1105], [-0.0105, 0.1105]], -0.268, -0.274, 'metal', { c: 0 });
  // gaz borusu + üst / alt tutamaç (ahşap)
  k.cyl(0.0105, 0.0105, 0.3, [0, 0.064, -0.41], 'metal', { seg: 10 });
  k.xsec([[-0.022, 0.046], [0.022, 0.046], [0.022, 0.068], [0.016, 0.08], [0.006, 0.085], [-0.006, 0.085], [-0.016, 0.08], [-0.022, 0.068]], -0.31, -0.462, 'furn', { c: 0.005 });
  k.prof([[-0.272, 0.043], [-0.472, 0.043], [-0.472, 0.004], [-0.46, -0.012], [-0.42, -0.016], [-0.39, -0.01], [-0.36, -0.016], [-0.31, -0.016], [-0.285, -0.01], [-0.272, 0.0]], 0.062, 'furn', { c: 0.007 });
  for (const y of [0.012, 0.026]) k.box([0.0635, 0.004, 0.16], [0, y, -0.38], 'furn', { d: 1, sh: 0.7 });   // tutamaç kanalları
  k.box([0.052, 0.058, 0.012], [0, 0.03, -0.478], 'metal', { c: 0.003 });                             // tutamaç kelepçesi
  // namlu, gaz bloğu, arpacık kulesi, temizleme çubuğu, namlu ağzı freni
  k.cyl(0.0095, 0.0095, 0.24, [0, 0.012, -0.59], 'metal', { seg: 10 });
  k.prof([[-0.545, 0.075], [-0.588, 0.075], [-0.592, 0.06], [-0.585, -0.002], [-0.548, -0.002], [-0.545, 0.03]], 0.03, 'metal', { c: 0.004 });
  k.box([0.016, 0.02, 0.026], [0, -0.012, -0.572], 'metal', { d: 1, c: 0.002 });                      // süngü tırnağı
  k.prof([[-0.632, -0.006], [-0.674, -0.006], [-0.674, 0.028], [-0.664, 0.034], [-0.66, 0.084], [-0.645, 0.084], [-0.642, 0.034], [-0.632, 0.028]], 0.024, 'metal', { c: 0.003 });
  for (const sx of [-1, 1]) k.box([0.004, 0.03, 0.014], [sx * 0.0095, 0.094, -0.653], 'metal', { c: 0.001 });   // kule kulakları
  k.box([0.004, 0.021, 0.004], [0, 0.0945, -0.653], 'metal', { sh: 0.8 });                            // arpacık (tepe 0,105)
  k.cyl(0.003, 0.003, 0.2, [0, -0.007, -0.565], 'metal', { seg: 6, d: 1 });
  k.cyl(0.0135, 0.0135, 0.042, [0, 0.012, -0.729], 'metal', { seg: 10, sh: 0.8 });
  k.box([0.02, 0.012, 0.028], [0, 0.024, -0.734], 'metal', { d: 1, sh: 0.45, rot: [-0.25, 0, 0] });   // eğik fren kesiği
  // tabanca kabzası, tetik korkuluğu, tetik, şarjör mandalı
  k.prof([[0.018, -0.016], [0.062, -0.016], [0.068, -0.03], [0.106, -0.138], [0.1, -0.15], [0.062, -0.152], [0.054, -0.142], [0.03, -0.05], [0.018, -0.032]], 0.035, 'furn', { c: 0.006, sh: 0.86, pat: lod ? 0 : 2 });
  guard(k, [[0.034, -0.016], [0.034, -0.024], [0.012, -0.064], [-0.04, -0.064], [-0.05, -0.056], [-0.05, -0.016]], [[0.022, -0.024], [0.005, -0.056], [-0.036, -0.056], [-0.042, -0.05], [-0.042, -0.024]], 0.012);
  k.prof([[-0.006, -0.018], [-0.014, -0.018], [-0.019, -0.04], [-0.013, -0.05], [-0.006, -0.04]], 0.006, 'metal', { d: 1 });
  k.box([0.016, 0.02, 0.01], [0, -0.03, -0.075], 'metal', { d: 1, c: 0.002 });
  // dipçik (ahşap) + dipçik plakası + üst bağlantı
  k.prof([[0.05, 0.05], [0.11, 0.044], [0.395, 0.008], [0.4, 0.008], [0.4, -0.118], [0.39, -0.124], [0.3, -0.094], [0.17, -0.044], [0.1, -0.018], [0.05, -0.017]], 0.042, 'furn', { c: 0.008 });
  k.prof([[0.398, 0.011], [0.412, 0.011], [0.412, -0.122], [0.398, -0.126]], 0.046, 'metal', { c: 0.003 });
  k.box([0.03, 0.006, 0.07], [0, 0.052, 0.085], 'metal', { d: 1 });
  k.ring(0.011, 0.0025, [0, -0.075, 0.33], 'metal', { d: 1 }); k.ring(0.011, 0.0025, [0, -0.012, -0.585], 'metal', { d: 1 });   // askı halkaları
  // optik: yan ray kelepçesi + toz kapağı üstüne köprü (gerçek AK yan monte)
  let sg = null;
  if (o && o !== 'iron') {
    k.box([0.008, 0.03, 0.09], [-0.029, 0.05, -0.1], 'acc', { c: 0.002 });                             // sol yan ray kelepçesi
    k.box([0.06, 0.006, 0.07], [0, 0.095, -0.1], 'acc', { c: 0.002 });                                // köprü
    sg = optic(k, o, 0.098, -0.1);
  } else sg = { sight: [0, 0.105, -0.271], pivot: [0, 0.105, -0.653], dist: ADS_DIST.iron, near: ADS_NEAR.iron, overlay: 'none' };
  // kavisli şarjör (grup): Bézier kenarlar + yan kaburgalar + taban plakası
  const R = bez([-0.083, -0.016], [-0.095, -0.17], [-0.19, -0.29], lod ? 3 : 7), F = bez([-0.168, -0.016], [-0.185, -0.15], [-0.27, -0.255], lod ? 3 : 7);
  k.prof([...R, ...[...F].reverse()], 0.036, 'body', { c: 0.004, g: 'mag', sh: 0.95 });
  k.prof(stripe(F, R, 0.0, 0.16), 0.0395, 'body', { g: 'mag', d: 1, sh: 0.88 });
  k.prof(stripe(F, R, 0.62, 0.74), 0.0385, 'body', { g: 'mag', d: 1, sh: 0.88 });
  plate(k, F[F.length - 1], R[R.length - 1], 0.042, 0.012, 'metal', { g: 'mag', c: 0.003 });
  return done(k, mat, { name: 'AK-47', hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.03, -0.35], muzzle: [0, 0.012, -0.75], length: 1.14 }, sg);
}

// ───────────────────────── M4A1 ─────────────────────────
export function m4a1(mat = skinMaterial('m4a1'), lod = false, o = 'iron') {
  const k = newKit(lod), iron = !o || o === 'iron';
  // alt gövde (şarjör yuvası pahlı), üst gövde + üst ray
  k.prof([[0.035, 0.036], [-0.165, 0.036], [-0.165, -0.01], [-0.158, -0.052], [-0.072, -0.052], [-0.07, -0.02], [0.012, -0.018], [0.035, 0.002]], 0.044, 'body', { c: 0.003 });
  k.prof([[-0.158, -0.04], [-0.164, -0.058], [-0.068, -0.058], [-0.07, -0.04]], 0.048, 'body', { c: 0.002, d: 1, sh: 0.92 });   // şarjör ağzı genişlemesi
  k.prof([[0.032, 0.036], [-0.27, 0.036], [-0.27, 0.088], [0.004, 0.088], [0.032, 0.07]], 0.046, 'body', { c: 0.003, sh: 1.05 });
  rail(k, 0.024, -0.268, 0.088, { w: 0.024 });
  k.box([0.016, 0.016, 0.032], [0.026, 0.062, -0.008], 'body', { c: 0.004 });                         // ileri itme düğmesi
  k.cyl(0.006, 0.006, 0.01, [0.032, 0.064, 0.012], 'metal', { d: 1, seg: 8 });
  k.box([0.003, 0.022, 0.06], [0.0235, 0.056, -0.1], 'body', { sh: 0.55 });                           // fişek atım kapağı
  k.box([0.008, 0.018, 0.016], [0.026, 0.066, -0.035], 'body', { d: 1, c: 0.002 });                   // kovan saptırıcı
  k.box([0.026, 0.008, 0.034], [0, 0.084, 0.04], 'metal', { c: 0.002 });                              // kurma kolu
  k.box([0.05, 0.009, 0.012], [0, 0.084, 0.056], 'metal', { c: 0.003 });
  k.box([0.004, 0.012, 0.022], [-0.023, 0.006, 0.0], 'metal', { d: 1, c: 0.001 });                   // ateş seçici
  k.box([0.004, 0.024, 0.01], [-0.023, 0.006, -0.06], 'metal', { d: 1 });                            // sürgü kilidi
  k.cyl(0.006, 0.006, 0.005, [0.023, -0.005, -0.06], 'metal', { ax: 'x', d: 1 });                    // şarjör düğmesi
  // kundak borusu + teleskopik dipçik + dipçik pedi
  k.cyl(0.017, 0.017, 0.24, [0, 0.058, 0.15], 'body', { seg: 10 });
  k.cyl(0.021, 0.021, 0.012, [0, 0.058, 0.035], 'metal', { seg: 8, d: 1 });                           // kale somunu
  k.prof([[0.14, 0.076], [0.31, 0.076], [0.33, 0.07], [0.334, -0.062], [0.322, -0.072], [0.3, -0.072], [0.234, 0.02], [0.14, 0.03]], 0.042, 'furn', { c: 0.006 });
  k.prof([[0.17, 0.03], [0.16, 0.012], [0.21, 0.012], [0.22, 0.03]], 0.02, 'furn', { d: 1, sh: 0.8 });   // kilit kolu
  k.prof([[0.33, 0.078], [0.346, 0.078], [0.346, -0.074], [0.33, -0.074]], 0.046, 'acc', { c: 0.004, pat: 1 });
  k.ring(0.01, 0.0025, [0, -0.06, 0.318], 'metal', { d: 1 });
  // kabza (benekli), tetik korkuluğu, tetik
  k.prof([[0.012, -0.012], [0.05, -0.012], [0.054, -0.024], [0.09, -0.126], [0.083, -0.138], [0.05, -0.138], [0.043, -0.126], [0.04, -0.104], [0.022, -0.06], [0.014, -0.034]], 0.032, 'furn', { c: 0.005, pat: 1 });
  guard(k, [[0.014, -0.016], [0.016, -0.028], [-0.002, -0.06], [-0.074, -0.06], [-0.074, -0.016]], [[0.004, -0.027], [-0.009, -0.051], [-0.066, -0.051], [-0.066, -0.026]], 0.01, 'body');
  k.prof([[-0.012, -0.018], [-0.02, -0.018], [-0.025, -0.04], [-0.019, -0.048], [-0.012, -0.038]], 0.006, 'metal', { d: 1 });
  // M-LOK tutamaç (sekizgen kesit) + yarıklar + tam boy üst ray
  k.xsec([[-0.022, 0.016], [0.022, 0.016], [0.029, 0.026], [0.029, 0.078], [0.022, 0.088], [-0.022, 0.088], [-0.029, 0.078], [-0.029, 0.026]], -0.27, -0.535, 'furn', { c: 0.004, sh: 1.1 });
  rail(k, -0.272, -0.533, 0.088, { w: 0.024 });
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) k.box([0.003, 0.012, 0.038], [sx * 0.029, 0.05, -0.305 - i * 0.06], 'furn', { sh: 0.22, d: i === 3 });
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) k.box([0.003, 0.009, 0.032], [sx * 0.026, 0.021, -0.33 - i * 0.07], 'furn', { sh: 0.22, rot: [0, 0, sx * 0.95], d: 1 });
  k.box([0.05, 0.06, 0.008], [0, 0.052, -0.539], 'furn', { d: 1, sh: 0.8, c: 0.003 });               // uç kapağı
  // namlu, A tipi arpacık kaidesi (optikte arpacık katlı), kuş kafesi alev gizleyici
  k.cyl(0.0095, 0.0095, 0.13, [0, 0.05, -0.6], 'metal', { seg: 10 });
  k.prof([[-0.545, 0.032], [-0.585, 0.032], [-0.585, 0.066], [-0.574, 0.072], [-0.571, iron ? 0.088 : 0.08], [-0.558, iron ? 0.088 : 0.08], [-0.555, 0.072], [-0.545, 0.066]], 0.018, 'metal', { c: 0.002 });
  if (iron) {
    for (const sx of [-1, 1]) k.box([0.004, 0.032, 0.012], [sx * 0.0105, 0.096, -0.565], 'metal', { c: 0.001 });   // kule kulakları (tepe 0,112: arpacığın altında kalır, arpacık seçilsin)
    k.box([0.004, 0.032, 0.004], [0, 0.102, -0.565], 'metal', { sh: 0.85 });                          // arpacık (tepe 0,118)
  }
  k.box([0.024, 0.012, 0.03], [0, 0.03, -0.565], 'metal', { d: 1, c: 0.002 });                       // süngü tırnağı
  k.cyl(0.0125, 0.0125, 0.05, [0, 0.05, -0.685], 'metal', { seg: 10, sh: 0.85 });
  if (!lod) for (let i = 0; i < 4; i++) k.box([0.0035, 0.026, 0.004], [Math.cos(i * 1.57) * 0.012, 0.05 + Math.sin(i * 1.57) * 0.012, -0.688], 'metal', { sh: 0.3, rot: [0, 0, i * 1.57] });
  // nişangâh: demirde katlanır arka gez açık, optikte yatık
  const rear = flipRear(k, 0, 0.096, 0.006, 0.118, iron);
  const sg = iron ? { sight: rear, pivot: [0, 0.118, -0.565], dist: ADS_DIST.iron, near: ADS_NEAR.iron, overlay: 'none' } : optic(k, o, 0.096, -0.14);
  // STANAG şarjör (grup): hafif kavis + uzun yan oluklar + taban
  const R = bez([-0.078, -0.04], [-0.08, -0.14], [-0.098, -0.236], lod ? 2 : 5), F = bez([-0.15, -0.04], [-0.156, -0.13], [-0.178, -0.222], lod ? 2 : 5);
  k.prof([...R, ...[...F].reverse()], 0.034, 'body', { c: 0.003, g: 'mag', sh: 0.9 });
  k.prof(stripe(F, R, 0.22, 0.4), 0.036, 'body', { g: 'mag', d: 1, sh: 0.8 });
  k.prof(stripe(F, R, 0.58, 0.76), 0.036, 'body', { g: 'mag', d: 1, sh: 0.8 });
  plate(k, F[F.length - 1], R[R.length - 1], 0.038, 0.012, 'acc', { g: 'mag', c: 0.003 });
  return done(k, mat, { name: 'M4A1', hold: 'rifle', gripR: [0, -0.03, 0.04], gripL: [0, -0.035, -0.4], muzzle: [0, 0.05, -0.71], length: 1.0 }, sg);
}

// ───────────────────────── Glock 17 ─────────────────────────
export function pistol(mat = skinMaterial('pistol'), lod = false, o = 'iron') {
  const k = newKit(lod);
  // sürgü (pahlı üst kesit), arka tırtıllar, atım penceresi + namlu kapağı, burun pahı
  k.xsec([[-0.016, 0.03], [0.016, 0.03], [0.016, 0.068], [0.011, 0.079], [-0.011, 0.079], [-0.016, 0.068]], 0.056, -0.172, 'body', { c: 0.003 });
  if (!lod) for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) k.box([0.002, 0.032, 0.0025], [sx * 0.0162, 0.052, 0.046 - i * 0.0055], 'body', { sh: 0.35, rot: [-0.08, 0, 0] });
  k.box([0.02, 0.003, 0.038], [0.002, 0.0788, -0.035], 'body', { sh: 0.3 });
  k.box([0.016, 0.006, 0.034], [0.002, 0.0765, -0.035], 'metal', { c: 0.0015 });
  k.cyl(0.0068, 0.0068, 0.004, [0, 0.051, -0.172], 'metal', { sh: 0.25, seg: 10 });
  // demir nişan: U çentikli gez + arpacık (tritium noktaları); çentik dibi = arpacık tepesi = 0,086
  k.xsec([[-0.01, 0.0785], [0.01, 0.0785], [0.01, 0.0918], [0.0028, 0.0918], [0.0028, 0.086], [-0.0028, 0.086], [-0.0028, 0.0918], [-0.01, 0.0918]], 0.05, 0.042, 'acc', { c: 0 });
  k.box([0.004, 0.0075, 0.007], [0, 0.08225, -0.158], 'acc', { c: 0.0006 });                        // arpacık
  if (!lod) { for (const sx of [-1, 1]) k.box([0.0016, 0.0016, 0.001], [sx * 0.0062, 0.0888, 0.0415], 'glow', { sh: 0.6 }); k.box([0.0016, 0.0016, 0.001], [0, 0.0835, -0.154], 'glow', { sh: 0.6 }); }
  // gövde (polimer): sürgü altı + aksesuar rayı, kabza (benekli + kuyruk), tetik korkuluğu, tetik, sürgü kilidi
  k.prof([[0.052, 0.031], [-0.168, 0.031], [-0.168, 0.012], [-0.03, 0.01], [-0.004, 0.004], [0.052, 0.004]], 0.03, 'furn', { c: 0.003 });
  for (let i = 0; i < 2; i++) k.box([0.031, 0.006, 0.008], [0, 0.016, -0.12 - i * 0.022], 'furn', { d: 1, sh: 0.3 });
  k.prof([[0.0, 0.006], [0.05, 0.008], [0.064, -0.002], [0.066, -0.01], [0.093, -0.106], [0.088, -0.118], [0.044, -0.122], [0.036, -0.112], [0.012, -0.03], [0.0, -0.006]], 0.03, 'furn', { c: 0.004, pat: lod ? 0 : 1 });
  for (let i = 0; i < 3; i++) k.box([0.031, 0.004, 0.012], [0, -0.03 - i * 0.026, 0.02 + i * 0.0068], 'furn', { d: 1, sh: 0.6, rot: [0.27, 0, 0] });   // parmak oyukları
  guard(k, [[0.002, 0.006], [0.002, -0.004], [-0.012, -0.034], [-0.056, -0.034], [-0.062, -0.026], [-0.062, 0.008]], [[-0.006, -0.004], [-0.016, -0.026], [-0.05, -0.026], [-0.054, -0.021], [-0.054, 0.006]], 0.022, 'furn');
  k.prof([[-0.012, 0.006], [-0.02, 0.006], [-0.024, -0.014], [-0.018, -0.02], [-0.013, -0.01]], 0.006, 'metal', { d: 1 });
  k.box([0.003, 0.006, 0.02], [-0.0162, 0.026, -0.03], 'metal', { d: 1 });                           // sürgü kilidi
  k.box([0.003, 0.006, 0.008], [0.0152, 0.024, -0.06], 'metal', { d: 1 });                           // söküm kolu
  const sg = o === 'reddot' ? optic(k, o, 0.0785, 0.012, true) : { sight: [0, 0.086, 0.046], pivot: [0, 0.086, -0.158], dist: ADS_DIST.iron, near: ADS_NEAR.pistol, overlay: 'none' };
  // şarjör (grup): kabza içinde gövde + dışta taban plakası
  k.prof([[0.012, 0.0], [0.048, 0.002], [0.084, -0.11], [0.046, -0.114]], 0.024, 'acc', { g: 'mag' });
  k.prof([[0.042, -0.117], [0.09, -0.112], [0.094, -0.13], [0.04, -0.134]], 0.031, 'furn', { c: 0.003, g: 'mag', sh: 0.85 });
  return done(k, mat, { name: 'Glock 17', hold: 'pistol', gripR: [0, -0.03, 0.02], gripL: null, muzzle: [0, 0.051, -0.18], length: 0.28 }, sg);
}

// ───────────────────────── M24 Keskin ─────────────────────────
export function sniper(mat = skinMaterial('sniper'), lod = false) {
  const k = newKit(lod);
  // kompozit dipçik (HS tarzı): yanak tümseği, entegre kabza, uzun ön kundak; kabza benekli panel; dipçik pedi
  k.prof([[0.43, 0.064], [0.43, -0.11], [0.405, -0.122], [0.26, -0.072], [0.15, -0.052], [0.122, -0.1], [0.1, -0.118], [0.062, -0.112], [0.042, -0.064], [0.034, -0.036], [-0.07, -0.036], [-0.12, -0.03], [-0.48, -0.012], [-0.505, -0.004], [-0.505, 0.03], [-0.48, 0.036], [-0.07, 0.04], [0.04, 0.044], [0.07, 0.034], [0.13, 0.052], [0.26, 0.074], [0.4, 0.07]], 0.052, 'furn', { c: 0.009 });
  k.prof([[0.142, -0.052], [0.118, -0.1], [0.098, -0.112], [0.066, -0.106], [0.05, -0.064], [0.046, -0.04], [0.1, -0.04]], 0.0535, 'furn', { pat: 1, d: 1, sh: 0.95 });
  k.prof([[0.43, 0.068], [0.448, 0.068], [0.448, -0.114], [0.43, -0.114]], 0.054, 'acc', { c: 0.004, pat: 1 });
  k.ring(0.011, 0.0025, [0, -0.105, 0.36], 'metal', { d: 1 }); k.ring(0.011, 0.0025, [0, -0.03, -0.44], 'metal', { d: 1 });
  // mekanizma (silindir) + ray + atım penceresi, tetik korkuluğu, tetik
  k.cyl(0.019, 0.019, 0.27, [0, 0.058, -0.045], 'body', { seg: 12 });
  k.box([0.004, 0.018, 0.07], [0.018, 0.062, -0.02], 'body', { sh: 0.3, d: 1 });
  rail(k, 0.07, -0.16, 0.074, { w: 0.022 });
  guard(k, [[0.03, -0.03], [0.03, -0.04], [0.01, -0.076], [-0.05, -0.076], [-0.07, -0.06], [-0.075, -0.03]], [[0.02, -0.04], [0.004, -0.068], [-0.045, -0.068], [-0.06, -0.055], [-0.064, -0.04]], 0.013);
  k.prof([[-0.01, -0.036], [-0.018, -0.036], [-0.022, -0.056], [-0.016, -0.064], [-0.01, -0.054]], 0.006, 'metal', { d: 1 });
  // ağır namlu + namlu ağzı
  k.cyl(0.0105, 0.0145, 0.72, [0, 0.058, -0.54], 'metal', { seg: 10 });
  k.cyl(0.0122, 0.0122, 0.03, [0, 0.058, -0.915], 'metal', { seg: 10, sh: 0.7 });
  // dürbün: halkalar + gövde borusu + göz / objektif çanları + kuleler + mercekler + göz merceğinde ışıyan merkez
  for (const z of [0.03, -0.13]) { k.box([0.026, 0.04, 0.02], [0, 0.098, z], 'acc', { c: 0.003 }); k.ring(0.0215, 0.005, [0, 0.142, z], 'acc', { ax: 'z', seg: 12, d: 1 }); }
  k.cyl(0.019, 0.019, 0.27, [0, 0.142, -0.05], 'acc', { seg: 14 });
  k.cyl(0.019, 0.025, 0.035, [0, 0.142, 0.1], 'acc', { seg: 14 });
  k.cyl(0.025, 0.025, 0.04, [0, 0.142, 0.137], 'acc', { seg: 14, sh: 0.85 });
  k.cyl(0.031, 0.019, 0.055, [0, 0.142, -0.212], 'acc', { seg: 14 });
  k.cyl(0.031, 0.031, 0.065, [0, 0.142, -0.27], 'acc', { seg: 14 });
  k.cyl(0.0145, 0.0145, 0.03, [0, 0.176, -0.05], 'acc', { ax: 'y', seg: 10 });                         // kuleler tüp içine girmez (cam arkasından görünmesin)
  k.cyl(0.0145, 0.0145, 0.03, [0.034, 0.142, -0.05], 'acc', { ax: 'x', seg: 10 });
  if (!lod) { k.cyl(0.0155, 0.0155, 0.007, [0, 0.194, -0.05], 'acc', { ax: 'y', seg: 10, pat: 2, sh: 0.8 }); k.cyl(0.0155, 0.0155, 0.007, [0.052, 0.142, -0.05], 'acc', { ax: 'x', seg: 10, pat: 2, sh: 0.8 }); }
  k.box([0.03, 0.03, 0.03], [-0.034, 0.142, -0.05], 'acc', { d: 1, c: 0.004 });                    // paralaks kulesi (sol)
  k.cyl(0.028, 0.028, 0.002, [0, 0.142, -0.303], 'lens', { seg: 14 });
  k.cyl(0.022, 0.022, 0.002, [0, 0.142, 0.158], 'lens', { seg: 14, d: 1 });
  for (const [w, hh] of [[0.012, 0.0006], [0.0006, 0.012]]) k.box([w, hh, 0.0005], [0, 0.142, 0.1594], 'glow', { d: 1 });   // göz merceğinde ince artı
  // sürgü (grup, pivot = mekanizma ekseni): sürgü başı + kol + topuz
  k.cyl(0.0125, 0.0125, 0.03, [0, 0.058, 0.1], 'metal', { g: 'bolt', seg: 10 });
  k.box([0.042, 0.007, 0.009], [0.024, 0.05, 0.075], 'metal', { g: 'bolt', rot: [0, 0, -0.55] });
  k.cyl(0.0095, 0.0095, 0.018, [0.044, 0.038, 0.075], 'metal', { g: 'bolt', ax: 'x', seg: 8 });
  // iç şarjör (grup): taban plakası
  k.box([0.03, 0.007, 0.075], [0, -0.038, -0.11], 'metal', { g: 'mag', c: 0.002 });
  k.box([0.026, 0.05, 0.07], [0, -0.01, -0.11], 'metal', { g: 'mag' });
  return done(k, mat, { name: 'M24 Keskin', hold: 'rifle', gripR: [0, -0.03, 0.054], gripL: [0, -0.03, -0.36], muzzle: [0, 0.058, -0.93], length: 1.3, boltPivot: 0.058 },
    { sight: [0, 0.142, 0.159], dist: ADS_DIST.scope, near: ADS_NEAR.scope, overlay: 'scope' });
}

// ───────────────────────── Pompalı (Remington 870 tarzı, yeni) ─────────────────────────
export function shotgun(mat = skinMaterial('shotgun'), lod = false, o = 'iron') {
  const k = newKit(lod);
  // gövde (frezelenmiş çelik): yan pahlı blok, sağda atım penceresi, altta yükleme ağzı, üstte kısa ray (optik)
  k.box([0.046, 0.074, 0.23], [0, 0.018, -0.085], 'body', { c: 0.005, ax: 'z' });
  k.box([0.003, 0.03, 0.075], [0.0235, 0.03, -0.09], 'body', { sh: 0.3 });                           // atım penceresi
  k.box([0.03, 0.004, 0.11], [0, -0.019, -0.1], 'body', { sh: 0.35 });                               // yükleme ağzı
  k.box([0.03, 0.006, 0.2], [0, 0.058, -0.08], 'body', { c: 0.002, sh: 0.95 });                      // üst sırt
  rail(k, 0.0, -0.16, 0.061, { w: 0.022 });
  k.cyl(0.005, 0.005, 0.004, [0.0235, 0.0, -0.02], 'metal', { ax: 'x', seg: 8, d: 1 });              // pim başları
  k.cyl(0.005, 0.005, 0.004, [0.0235, 0.0, -0.15], 'metal', { ax: 'x', seg: 8, d: 1 });
  k.box([0.004, 0.012, 0.03], [-0.0235, 0.0, -0.035], 'metal', { d: 1, c: 0.001 });                 // sürgü bırakma
  // namlu + havalandırmalı üst sırt (rib) + ağız; şarjör tüpü + uç kapağı + namlu kelepçesi
  k.cyl(0.0135, 0.0135, 0.46, [0, 0.04, -0.43], 'metal', { seg: 12 });
  k.box([0.007, 0.005, 0.44], [0, 0.0555, -0.42], 'metal', { sh: 0.9 });
  if (!lod) for (let i = 0; i < 10; i++) k.box([0.0075, 0.003, 0.012], [0, 0.0525, -0.23 - i * 0.042], 'metal', { sh: 0.35 });   // rib boşlukları
  k.cyl(0.0148, 0.0148, 0.012, [0, 0.04, -0.654], 'metal', { seg: 12, sh: 0.75 });
  k.cyl(0.0118, 0.0118, 0.4, [0, 0.008, -0.4], 'body', { seg: 10 });
  k.cyl(0.013, 0.013, 0.022, [0, 0.008, -0.607], 'metal', { seg: 10, sh: 0.85 });
  k.box([0.02, 0.05, 0.016], [0, 0.024, -0.585], 'metal', { c: 0.002 });
  k.ring(0.01, 0.0025, [0, -0.01, -0.6], 'metal', { d: 1 });
  // pompa (kaburgalı polimer, şarjör tüpünü sarar; sol el burada)
  k.xsec([[-0.022, -0.014], [0.022, -0.014], [0.027, -0.004], [0.027, 0.02], [0.02, 0.029], [-0.02, 0.029], [-0.027, 0.02], [-0.027, -0.004]], -0.215, -0.39, 'furn', { c: 0.004 });
  for (let i = 0; i < 6; i++) k.box([0.0555, 0.006, 0.008], [0, 0.0045, -0.25 - i * 0.022], 'furn', { sh: 0.55, d: i % 2 });   // kaburgalar
  // demir nişan: gövdede halka gez (ghost ring), namlu ucunda kulaklı arpacık — optikte halka yok, arpacık alçak boncuk
  const iron = !o || o === 'iron', line = 0.078;
  if (iron) {
    k.box([0.022, 0.008, 0.026], [0, 0.065, 0.0], 'acc', { c: 0.002 });
    for (const sx of [-1, 1]) k.box([0.004, 0.022, 0.014], [sx * 0.0125, 0.077, 0.0], 'acc', { c: 0.001 });
    k.xsec([[-0.0105, 0.068], [0.0105, 0.068], [0.0105, line + 0.009], [0.006, line + 0.0135], [-0.006, line + 0.0135], [-0.0105, line + 0.009]], 0.003, -0.003, 'acc', { holes: [circ(0, line, 0.0058, 16)], c: 0.0008 });
    k.box([0.016, 0.006, 0.022], [0, 0.061, -0.64], 'metal', { c: 0.001 });
    for (const sx of [-1, 1]) k.box([0.0035, 0.02, 0.012], [sx * 0.0072, 0.07, -0.64], 'metal', { c: 0.0008 });
    k.box([0.0045, 0.018, 0.0045], [0, 0.069, -0.64], 'metal', { sh: 0.9 });                          // arpacık (tepe 0,078)
    k.box([0.002, 0.002, 0.001], [0, 0.0765, -0.6373], 'glow', { d: 1, sh: 0.8 });                     // fiber uç
  } else k.box([0.006, 0.006, 0.006], [0, 0.061, -0.645], 'metal');
  const sg = iron ? { sight: [0, line, 0.0], pivot: [0, line, -0.64], dist: ADS_DIST.iron, near: ADS_NEAR.iron, overlay: 'none' } : optic(k, o, 0.069, -0.06);
  // tabanca kabzalı dipçik + benekli kabza + dipçik pedi, tetik korkuluğu + tetik, emniyet düğmesi
  k.prof([[0.024, 0.052], [0.11, 0.046], [0.39, 0.03], [0.395, 0.03], [0.395, -0.096], [0.385, -0.1], [0.3, -0.078], [0.17, -0.04], [0.11, -0.03], [0.024, -0.018]], 0.042, 'furn', { c: 0.007 });
  k.prof([[0.395, 0.032], [0.414, 0.032], [0.414, -0.1], [0.395, -0.1]], 0.046, 'acc', { c: 0.004, pat: 1 });
  k.prof([[0.02, -0.016], [0.066, -0.016], [0.072, -0.03], [0.108, -0.134], [0.102, -0.146], [0.064, -0.148], [0.056, -0.138], [0.032, -0.05], [0.02, -0.032]], 0.034, 'furn', { c: 0.006, sh: 0.9, pat: lod ? 0 : 1 });
  guard(k, [[0.03, -0.016], [0.03, -0.024], [0.008, -0.062], [-0.05, -0.062], [-0.058, -0.054], [-0.058, -0.016]], [[0.018, -0.024], [0.002, -0.054], [-0.044, -0.054], [-0.05, -0.048], [-0.05, -0.024]], 0.012, 'acc');
  k.prof([[-0.01, -0.018], [-0.018, -0.018], [-0.023, -0.04], [-0.017, -0.048], [-0.01, -0.038]], 0.006, 'metal', { d: 1 });
  k.cyl(0.004, 0.004, 0.05, [0, -0.012, 0.02], 'metal', { ax: 'x', seg: 8, d: 1 });                  // emniyet düğmesi
  k.ring(0.011, 0.0025, [0, -0.075, 0.33], 'metal', { d: 1 });
  // sol yanda 4 fişeklik yan taşıyıcı (fişek gövdeleri aksesuar, pirinç başlar metal)
  k.box([0.006, 0.03, 0.09], [-0.026, 0.014, -0.07], 'acc', { c: 0.0015, d: 1 });
  if (!lod) for (let i = 0; i < 4; i++) { k.cyl(0.0085, 0.0085, 0.05, [-0.034, 0.014, -0.04 - i * 0.02], 'furn', { ax: 'y', seg: 8, sh: 0.7 }); k.cyl(0.009, 0.009, 0.008, [-0.034, 0.042, -0.04 - i * 0.02], 'metal', { ax: 'y', seg: 8, sh: 1.3 }); }
  return done(k, mat, { name: 'Pompalı', hold: 'rifle', gripR: [0, -0.03, 0.05], gripL: [0, -0.03, -0.3], muzzle: [0, 0.04, -0.66], length: 1.05 }, sg);
}

export const S3W = { ak47, m4a1, pistol, sniper, shotgun };

// Eski (S3 olmayan) silahlara S3 nişangâhı: ayrı Kit → tek ağ (optik paleti) + cam. Döndürür { mesh grubu, nişan bilgisi }
export function s3Optic(o, yb, z, lod = false, pistol = false, mat = null) {
  const k = newKit(lod), sg = optic(k, o, yb, z, pistol);
  if (!sg) return null;
  const g = done(k, mat || skinMaterial('optic', 'std', lod), { name: 'optic', hold: 'rifle', gripR: [0, 0, 0], gripL: null, muzzle: [0, 0, 0], length: 0 }, sg);
  return { g, ...sg };
}
