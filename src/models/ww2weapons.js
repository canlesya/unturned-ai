import * as THREE from 'three';
import { bez } from './s3kit.js';
import { skinMaterial, STD } from './skins.js';
import { S3PARTS, ADS_DIST } from './s3weapons.js';

// 1940'lar silahları (Cephe modu, 12.158): S3 kitiyle aynı düşük poligon dil (yan profil çekme + pah, tek ağ + cam). Ahşap kundak (furn) + mavi çelik (body / metal),
// pirinç fişek / klips (acc). Gerçek marka / logo / damga yok; genel adlar (Sürgülü Tüfek, Yarı Otomatik Tüfek, …). Konvansiyon: köken = kabza (sağ el), namlu −Z, yukarı +Y.
// Nişan: demir gez–arpacık (gez çentiği / delik ortası = nişan noktası = arpacık tepesi, adsalign ölçer) — modern optik yok; keskin nişancıda eski tip uzun dürbün.
// 12.174 dönem nişangâhları (stats.js OPTIC_ALLOWED): ww_peep diyoptr / hayalet halka gez, ww_scout öne monteli 1,5× öncü dürbün (saydam mercek + siyah direk retikül),
// ww_sc25 / ww_sc4 kelepçeli halkalarda uzun dürbün (dürbün örtüsü). Takılınca açık gez (çentik / yaprak) çizilmez; arpacık öncü dürbünde tüpün gölgesinde kalır.
const { done, newKit, circ, guard } = S3PARTS;

const WOOD = '#4f3220', WOOD_D = '#432a1a', BLUE = '#2b2d30', BLUE_M = '#36383b', BRASS = '#a0803f';
Object.assign(STD, {
  ww_bolt: { body: [BLUE, 0.42, 0.55], furn: [WOOD, 0.55, 0], metal: [BLUE_M, 0.4, 0.6], acc: [BRASS, 0.35, 0.75] },
  ww_semi: { body: ['#2f3032', 0.45, 0.5], furn: ['#563823', 0.55, 0], metal: ['#3a3b3d', 0.4, 0.6], acc: [BRASS, 0.35, 0.75] },
  ww_smgb: { body: ['#2e2f31', 0.42, 0.55], furn: ['#58391f', 0.52, 0], metal: ['#3a3b3e', 0.4, 0.6], acc: [BRASS, 0.35, 0.75] },
  ww_smgr: { body: ['#28292b', 0.48, 0.5], furn: ['#3b2d25', 0.42, 0.05], metal: ['#37383b', 0.42, 0.6], acc: ['#1f2022', 0.6, 0.2] },
  ww_lmg: { body: ['#2c2d2f', 0.45, 0.55], furn: [WOOD_D, 0.55, 0], metal: ['#38393c', 0.4, 0.6], acc: [BRASS, 0.35, 0.75] },
  ww_sniper: { body: [BLUE, 0.42, 0.55], furn: ['#4a3020', 0.55, 0], metal: [BLUE_M, 0.4, 0.6], acc: ['#1d1e20', 0.45, 0.4] },
  ww_mg: { body: ['#2a2b2d', 0.5, 0.45], furn: ['#2c2622', 0.5, 0.05], metal: ['#3a3b3d', 0.42, 0.55], acc: [BRASS, 0.35, 0.75] },
  ww_pistol: { body: ['#2c2e31', 0.4, 0.6], furn: ['#4a2c1c', 0.5, 0], metal: ['#3a3b3e', 0.38, 0.65], acc: [BRASS, 0.35, 0.75] },
  ww_nade: { body: ['#4a4d42', 0.6, 0.3], furn: ['#8a6a44', 0.65, 0], metal: ['#3a3b3c', 0.45, 0.5], acc: ['#c9b26a', 0.6, 0] },
});

// ── ortak parçalar ──
// U çentikli gez yaprağı: çentik dibi = line
function rearNotch(k, z, yb, line, w = 0.011, n = 0.0028, slot = 'metal') {
  k.xsec([[-w, yb], [w, yb], [w, line + 0.006], [n, line + 0.006], [n, line], [-n, line], [-n, line + 0.006], [-w, line + 0.006]], z + 0.0025, z - 0.0025, slot, { c: 0 });
}
// Delikli (dioptri) gez: halka ortası = line
function rearPeep(k, z, yb, line, R = 0.0055, slot = 'metal') {
  k.xsec([[-0.011, yb], [0.011, yb], [0.011, line + 0.009], [0.006, line + 0.013], [-0.006, line + 0.013], [-0.011, line + 0.009]], z + 0.003, z - 0.003, slot, { holes: [circ(0, line, R, 16)], c: 0.0006 });
}
// 12.174 Diyoptr "hayalet halka": büyük delikli ince halka (R iç yarıçap, t kenar) + alt dikme (yb → halka dibi) + isteğe bağlı iki koruma kulağı; halka ortası = line
function rearGhost(k, z, yb, line, R = 0.0062, t = 0.0013, ears = true, slot = 'metal') {
  k.xsec(circ(0, line, R + t, 20), z + 0.002, z - 0.002, slot, { holes: [circ(0, line, R, 20)], c: 0.0004 });
  k.box([0.006, line - R - yb + 0.0004, 0.004], [0, (yb + line - R + 0.0004) / 2, z], slot, { c: 0.0008 });       // dikme: halkanın içine girmez (tepesi halkanın dış kenarında)
  k.box([0.02, 0.004, 0.012], [0, yb + 0.002, z], slot, { c: 0.001 });                                              // alçak taban
  if (ears) for (const sx of [-1, 1]) k.xsec([[sx * (R + t + 0.0025), yb], [sx * (R + t + 0.006), yb], [sx * (R + t + 0.006), line + 0.002], [sx * (R + t + 0.0035), line + R * 0.7]], z + 0.003, z - 0.003, slot, { c: 0.0005 });   // koruma kulakları (halkanın dışında)
}
// 12.174 Öncü dürbün (1,5×, uzun göz mesafeli; namlu üstünde önde): tek parça taban + iki ince kelepçe, ince tüp, göz / objektif çanı, ince göz halkası, siyah dikey direk + ince yatay çizgi
// (ışıyan yuvada çok koyu: ışıklandırılmaz, adsalign eflatun ölçer). cy = tüp ekseni, ze = göz merceği yüzü, zb0..zb1 taban, yb = taban altı. Saydam mercek: lens (12.162 derinlik maskesi)
export const SCOUT = { r: 0.0165, rim: 0.0016, dist: 0.36 };      // göz merceği iç yarıçapı / halka kenarı · uzun göz mesafesi 36 cm (göz gövdenin arkasında: mekanizma ekranı kaplamaz) → mercek ekranın ≈ %12,6'sı (ACOG %18), çevresinde dünya
function scoutScope(k, cy, ze, yb, zb0, zb1, slot = 'body') {
  const R = SCOUT.r, Ro = R + SCOUT.rim, rt = 0.0105, zo = ze - 0.19;            // zo: objektif ön yüzü (tüp 19 cm)
  k.box([0.022, cy - rt - yb + 0.0006, zb0 - zb1], [0, (yb + cy - rt + 0.0006) / 2, (zb0 + zb1) / 2], slot, { c: 0.002 });      // tek parça taban (namlu / el siperi üstünde)
  for (const z of [zb0 - 0.012, zb1 + 0.012]) k.ring(rt + 0.0016, 0.0016, [0, cy, z], slot, { ax: 'z', seg: 14, rs: 4, d: 1 });     // kelepçe halkaları (tüpü sarar)
  k.cyl(rt, rt, ze - 0.036 - (zo + 0.03), [0, cy, (ze - 0.036 + zo + 0.03) / 2], slot, { seg: 14 });                    // tüp
  k.cyl(rt, Ro, 0.02, [0, cy, ze - 0.026], slot, { seg: 16 });                                                        // göz çanı (konik)
  k.cyl(Ro, Ro, 0.01, [0, cy, ze - 0.011], slot, { seg: 16, sh: 0.9, d: 1 });                                               // (göz halkasının arkasında biter: yüzeyler üst üste binmez)
  k.cyl(0.0128, rt, 0.018, [0, cy, zo + 0.021], slot, { seg: 14 });                                                  // objektif konisi + çanı
  k.cyl(0.0128, 0.0128, 0.012, [0, cy, zo + 0.006], slot, { seg: 14, sh: 0.9, d: 1 });
  k.cyl(0.0118, 0.0118, 0.002, [0, cy, zo - 0.0005], 'lens', { seg: 14, d: 1 });                                     // ön mercek
  k.cyl(R, R, 0.002, [0, cy, ze - 0.0012], 'lens', { seg: 16, d: 1 });                                                // göz merceği
  k.xsec(circ(0, cy, Ro, 28), ze + 0.0002, ze - 0.006, slot, { holes: [circ(0, cy, R + 0.0001, 28)], c: 0.0004, cap: 1, sh: 0.8, d: 1 });      // ince göz halkası (ön yüzü mercek düzleminde, 12.129)
  if (!k.lod) {
    const zr = ze + 0.0006, w = 0.0006, tip = 0.0017, lh = 0.00028;      // 36 cm'de direk ≈ 4 px, çizgi ≈ 2 px (900 px ekran)
    k.xsec([[-w, cy - R - 0.0004], [w, cy - R - 0.0004], [w, cy - tip], [0, cy], [-w, cy - tip]], zr + 0.0003, zr, 'glow', { sh: 0.012 });   // dikey direk (sivri ucu = mermi noktası)
    k.xsec([[-R - 0.0004, cy - lh], [R + 0.0004, cy - lh], [R + 0.0004, cy + lh], [-R - 0.0004, cy + lh]], zr + 0.0003, zr, 'glow', { sh: 0.012 });   // ince yatay çizgi
  }
  return { sight: [0, cy, ze], dist: SCOUT.dist, overlay: 'lens', lens: [R, 0, cy, ze + 0.0003] };
}
// 12.174 Dönem keskin nişancı dürbünü (2,5× kısa / 4× uzun tüp): iki kelepçeli halka + bloklar (yb'den), göz / objektif çanı, kuleler, göz merceğinde üç direkli koyu retikül
// (dürbün örtüsü tam nişanda devralır; geçişte görünen 3B retikül HUD'daki .ww ile aynı oranda). zr: halka z'leri
function wwScope(k, mag, cy, ze, yb, zr, slot = 'acc') {
  const L = mag >= 4 ? 0.25 : 0.17, Rb = mag >= 4 ? 0.02 : 0.0165, zt = ze - 0.08;      // tüp boyu, objektif çanı yarıçapı, tüp arka ucu
  for (const z of zr) { k.box([0.022, cy - 0.016 - yb, 0.018], [0, (yb + cy - 0.016) / 2, z], slot === 'acc' ? 'body' : slot, { c: 0.002 }); k.ring(0.0158, 0.0035, [0, cy, z], slot === 'acc' ? 'body' : slot, { ax: 'z', seg: 12, d: 1 }); }
  k.cyl(0.0125, 0.0125, L, [0, cy, zt - L / 2], slot, { seg: 14 });
  k.cyl(0.0125, 0.017, 0.03, [0, cy, zt + 0.015], slot, { seg: 14 });
  k.cyl(0.017, 0.017, 0.05, [0, cy, ze - 0.025], slot, { seg: 14, sh: 0.9 });
  k.cyl(Rb, 0.0125, 0.06, [0, cy, zt - L - 0.03], slot, { seg: 14 });
  k.cyl(Rb, Rb, 0.04, [0, cy, zt - L - 0.08], slot, { seg: 14, sh: 0.9 });
  const zk = zt - L * 0.55;                                                                                              // kuleler (tüp ortası)
  k.cyl(0.0095, 0.0095, 0.018, [0, cy + 0.021, zk], slot, { ax: 'y', seg: 10 });
  k.cyl(0.0095, 0.0095, 0.018, [0.021, cy, zk], slot, { ax: 'x', seg: 10, d: 1 });
  k.cyl(Rb - 0.002, Rb - 0.002, 0.002, [0, cy, zt - L - 0.1], 'lens', { seg: 14 });
  k.cyl(0.0155, 0.0155, 0.002, [0, cy, ze - 0.001], 'lens', { seg: 14, d: 1 });
  if (!k.lod) {                                                                                                          // üç direk (yan direkler + sivri alt direk, uç = nişan noktası; HUD #scope .ww ile aynı oran: 1 birim = r/100)
    const r = 0.0155, u = r / 100, z0 = ze + 0.0004, z1 = ze + 0.0001;
    for (const sx of [-1, 1]) k.xsec([[sx * 100 * u, cy - 1.6 * u], [sx * 13 * u, cy - 1.6 * u], [sx * 9.5 * u, cy - 0.45 * u], [sx * 9.5 * u, cy + 0.45 * u], [sx * 13 * u, cy + 1.6 * u], [sx * 100 * u, cy + 1.6 * u]].map(([x, y]) => [x, y]), z0, z1, 'glow', { sh: 0.012 });
    k.xsec([[-1.9 * u, cy - 100 * u], [1.9 * u, cy - 100 * u], [1.9 * u, cy - 6.5 * u], [0, cy], [-1.9 * u, cy - 6.5 * u]], z0, z1, 'glow', { sh: 0.012 });
  }
  return { sight: [0, cy, ze], dist: ADS_DIST.scope, overlay: 'scope' };
}
const MAG = { ww_sc25: 2.5, ww_sc4: 4 };

// Arpacık (tepe = line) + kaide; hood: kalkan halkası, ears: iki kulak
function frontPost(k, z, yb, line, o = {}) {
  k.box([0.016, 0.008, 0.022], [0, yb + 0.004, z], 'metal', { c: 0.0015 });
  k.box([0.0032, line - yb - 0.008, 0.004], [0, (yb + 0.008 + line) / 2, z], 'metal', { sh: 0.85 });
  if (o.hood) k.ring(0.0105, 0.0016, [0, line - 0.001, z], 'metal', { ax: 'z', seg: 10, rs: 3 });
  if (o.ears) for (const sx of [-1, 1]) k.box([0.0028, line - yb - 0.006, 0.01], [sx * 0.009, (yb + 0.006 + line) / 2 + 0.002, z], 'metal', { c: 0.0008 });
}
// a → b (z, y) arası eğik çubuk
const bar = (k, a, b, w, h, slot, o = {}) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); k.box([w, h, L], [o.x || 0, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2], slot, { ...o, rot: [Math.atan2(-(b[1] - a[1]), b[0] - a[0]), 0, 0] }); };
// tetik korkuluğu + tetik (dz kaydırma)
function trig(k, dz = 0, y = -0.03, slot = 'metal') {
  guard(k, [[0.02 + dz, y], [0.018 + dz, y - 0.012], [-0.002 + dz, y - 0.036], [-0.05 + dz, y - 0.036], [-0.058 + dz, y - 0.026], [-0.058 + dz, y]], [[0.012 + dz, y - 0.009], [-0.004 + dz, y - 0.029], [-0.047 + dz, y - 0.029], [-0.051 + dz, y - 0.022], [-0.051 + dz, y - 0.004]], 0.009, slot);
  k.prof([[-0.012, y], [-0.02, y], [-0.024, y - 0.02], [-0.018, y - 0.027], [-0.012, y - 0.018]].map(([z, yy]) => [z + dz, yy]), 0.005, 'metal', { d: 1 });
}
// fişek (pirinç gövde + çelik çekirdek): üstten görünen klips mermileri
function round(k, x, y, z, g, len = 0.06) { k.cyl(0.0048, 0.0048, len, [x, y, z], 'acc', { seg: 6, g }); k.cyl(0.0035, 0.0012, 0.018, [x, y, z - len / 2 - 0.009], 'metal', { seg: 6, g, d: 1 }); }

// ───────────────────────── Sürgülü Tüfek (Kar98k / Mosin tarzı) ─────────────────────────
// Klips doldurma: sürgü açılır, beşli şerit klips gövdenin üstünden bastırılır (mag grubu = şerit klips, yalnız doldururken görünür), sürgü kapanır
function boltRifle(k, mode = 'iron') {      // 12.174 mode: iron | peep (gövde arkasında diyoptr) | scout (öne monteli 1,5×) | scope (halkalı dürbün)
  const lod = k.lod, line = 0.071, bx = 0.036;                                                     // nişan çizgisi, mekanizma ekseni yüksekliği
  // kundak: dipçik + yarı tabanca kabzası + uzun ön kundak (tek profil)
  k.prof([[0.405, 0.03], [0.3, 0.022], [0.17, 0.008], [0.088, -0.004], [0.04, 0.006], [-0.01, 0.016], [-0.27, 0.016], [-0.6, 0.016], [-0.614, 0.008], [-0.614, -0.01], [-0.42, -0.02], [-0.2, -0.026], [-0.07, -0.028],
    [-0.035, -0.036], [0.018, -0.07], [0.058, -0.084], [0.094, -0.072], [0.25, -0.1], [0.405, -0.128]], 0.042, 'furn', { c: 0.006 });
  if (!lod) k.prof([[0.27, 0.0], [0.2, -0.005], [0.18, -0.035], [0.27, -0.04]], 0.0425, 'furn', { sh: 0.85, d: 1 });              // dipçik deliği / pul (koyu oval)
  k.prof([[0.405, 0.032], [0.414, 0.032], [0.414, -0.131], [0.405, -0.131]], 0.044, 'metal', { c: 0.002 });                      // dipçik plakası
  // üst el siperi + namlu bileziği + burun kapağı
  k.prof([[-0.29, 0.016], [-0.53, 0.016], [-0.53, 0.044], [-0.52, 0.052], [-0.3, 0.052], [-0.29, 0.044]], 0.03, 'furn', { c: 0.005, sh: 0.95 });
  for (const z of [-0.4, -0.55]) k.box([0.047, 0.07, 0.012], [0, 0.012, z], 'metal', { c: 0.002 });
  k.box([0.046, 0.04, 0.03], [0, 0.026, -0.608], 'metal', { c: 0.003 });
  // mekanizma (silindir), şarjör yuvası, tetik
  k.cyl(0.0165, 0.0165, 0.27, [0, bx, -0.12], 'body', { seg: 12 });
  k.box([0.036, 0.02, 0.2], [0, 0.022, -0.12], 'body', { c: 0.003 });
  k.box([0.004, 0.016, 0.07], [0.016, bx + 0.006, -0.06], 'body', { sh: 0.3, d: 1 });                                          // fişek penceresi
  k.box([0.032, 0.006, 0.09], [0, -0.032, -0.13], 'metal', { c: 0.0015 });                                                      // şarjör taban plakası
  trig(k, 0.0, -0.028);
  // namlu (kademeli), gez (kademeli kaide + yaprak), arpacık (kalkanlı)
  k.cyl(0.012, 0.012, 0.12, [0, bx + 0.002, -0.31], 'metal', { seg: 10 });
  k.cyl(0.0085, 0.0085, 0.39, [0, bx + 0.002, -0.565], 'metal', { seg: 10 });
  k.cyl(0.0095, 0.0095, 0.012, [0, bx + 0.002, -0.755], 'metal', { seg: 10, sh: 0.8 });
  if (mode === 'iron' || mode === 'peep') k.box([0.026, 0.012, 0.06], [0, bx + 0.016, -0.285], 'metal', { c: 0.002 });         // gez kaidesi (diyoptrde yaprak yatık / yok)
  if (mode === 'iron') rearNotch(k, -0.277, bx + 0.022, line);
  if (mode === 'peep') rearGhost(k, -0.004, 0.049, line, 0.0058, 0.0012, false);                                             // gövde arka köprüsünde diyoptr (sürgü yolunun önünde)
  if (mode !== 'scope') frontPost(k, -0.728, bx + 0.0105, line, { hood: true });
  else k.box([0.016, 0.008, 0.022], [0, bx + 0.014, -0.728], 'metal', { c: 0.0015 });                                           // dürbünlüde ön kaide (arpacık yok)
  k.ring(0.011, 0.0025, [0, -0.11, 0.3], 'metal', { d: 1 }); k.ring(0.011, 0.0025, [0, -0.012, -0.55], 'metal', { d: 1 });       // askı halkaları
  // sürgü (grup, pivot = mekanizma ekseni): gövde + topuz kuyruğu + aşağı bükük kol + top
  k.cyl(0.0125, 0.0125, 0.05, [0, bx, 0.045], 'metal', { g: 'bolt', seg: 10 });
  k.box([0.016, 0.014, 0.022], [0, bx + 0.004, 0.075], 'metal', { g: 'bolt', c: 0.002 });
  k.box([0.04, 0.008, 0.009], [0.026, bx - 0.012, 0.05], 'metal', { g: 'bolt', rot: [0, 0, -0.65] });
  k.cyl(0.0105, 0.0105, 0.016, [0.044, bx - 0.026, 0.052], 'metal', { g: 'bolt', ax: 'x', seg: 8 });
  // şerit klips (mag grubu): beş fişek dik + klips şeridi; yalnız doldururken görünür (magHidden), yukarıdan iner (magAxis +Y)
  if (!lod) for (let i = 0; i < 5; i++) round(k, 0, bx + 0.03 + i * 0.0095, -0.075, 'mag', 0.058);
  k.box([0.012, 0.052, 0.004], [0, bx + 0.049, -0.044], 'metal', { g: 'mag' });
  return { line, bx };
}
const BOLT_META = (name) => ({ name, hold: 'rifle', gripR: [0, -0.035, 0.052], gripL: [0, -0.026, -0.4], muzzle: [0, 0.038, -0.762], length: 1.17, boltPivot: 0.036, magAxis: [0, 1, 0], magHidden: true, chargePos: [0.045, 0.02, 0.05] });
export function ww_bolt(mat = skinMaterial('ww_bolt'), lod = false, o = 'iron') {
  const k = newKit(lod);
  if (MAG[o]) { boltRifle(k, 'scope'); return done(k, mat, BOLT_META('Sürgülü Tüfek'), wwScope(k, MAG[o], 0.104, 0.115, 0.048, MAG[o] >= 4 ? [-0.02, -0.17] : [-0.02, -0.12], 'body')); }      // 12.174: dürbünlü tüfeğin halkalı dürbünü (mavi çelik)
  if (o === 'ww_scout') { boltRifle(k, 'scout'); return done(k, mat, BOLT_META('Sürgülü Tüfek'), scoutScope(k, 0.075, -0.205, 0.05, -0.245, -0.345)); }     // 12.174: gez kaidesinin yerinde, namlu / el siperi üstünde
  const { line } = boltRifle(k, o === 'ww_peep' ? 'peep' : 'iron');
  if (o === 'ww_peep') return done(k, mat, BOLT_META('Sürgülü Tüfek'), { sight: [0, line, -0.004], pivot: [0, line, -0.728], dist: ADS_DIST.iron, overlay: 'none' });
  return done(k, mat, BOLT_META('Sürgülü Tüfek'), { sight: [0, line, -0.277], pivot: [0, line, -0.728], dist: 0.56, overlay: 'none' });      // göz dipçik sırtında: sürgü topuzu ekranın altında küçük kalır
}

// ───────────────────────── Dürbünlü Tüfek (eski tip uzun dürbün, 4×) ─────────────────────────
// halkalı kaide (iki blok + halka), uzun ince tüp, göz / objektif çanı, kuleler, mercekler, göz merceğinde üç direkli koyu retikül (HUD dürbünü devralır). 12.174: 2,5× kısa tüp seçeneği
export function ww_sniper(mat = skinMaterial('ww_sniper'), lod = false, o = 'ww_sc4') {
  const k = newKit(lod), m = MAG[o] || 4;
  boltRifle(k, 'scope');
  return done(k, mat, BOLT_META('Dürbünlü Tüfek'), wwScope(k, m, 0.104, 0.115, 0.048, m >= 4 ? [-0.02, -0.17] : [-0.02, -0.12], 'acc'));
}

// ───────────────────────── Yarı Otomatik Tüfek (M1 Garand tarzı) ─────────────────────────
// Sekiz fişeklik klips (mag grubu, gövdenin içinde, üstü görünür). Son mermide klips "ping" diye yukarı fırlar; doldururken kurma kolu geride, klips bastırılır, kol kapanır.
export function ww_semi(mat = skinMaterial('ww_semi'), lod = false, o = 'iron') {
  const k = newKit(lod), line = 0.082, bx = 0.036, open = o === 'iron' || o === 'ww_peep';      // 12.174: dürbünde arka gez (kulaklar + delik) yok
  k.prof([[0.41, 0.028], [0.3, 0.02], [0.16, 0.004], [0.09, -0.006], [0.045, 0.008], [0.0, 0.016], [-0.18, 0.016], [-0.57, 0.016], [-0.585, 0.006], [-0.585, -0.012], [-0.4, -0.02], [-0.18, -0.026], [-0.09, -0.03],
    [-0.04, -0.038], [0.012, -0.078], [0.052, -0.092], [0.09, -0.078], [0.25, -0.104], [0.41, -0.132]], 0.044, 'furn', { c: 0.006 });
  k.prof([[0.41, 0.03], [0.42, 0.03], [0.42, -0.135], [0.41, -0.135]], 0.046, 'metal', { c: 0.002 });
  for (const [z0, z1] of [[-0.17, -0.33], [-0.4, -0.55]]) k.prof([[z0, 0.016], [z1, 0.016], [z1, 0.046], [z1 + 0.01, 0.055], [z0 - 0.01, 0.055], [z0, 0.046]], 0.03, 'furn', { c: 0.005, sh: 0.95 });
  k.box([0.046, 0.068, 0.014], [0, 0.017, -0.365], 'metal', { c: 0.002 });                                                   // ara bilezik
  // gövde (kutu, üstü açık klips yuvası), arka gez kulakları + dioptri
  k.xsec([[-0.019, 0.0], [0.019, 0.0], [0.019, 0.05], [0.014, 0.058], [-0.014, 0.058], [-0.019, 0.05]], 0.07, -0.17, 'body', { c: 0.003 });
  k.box([0.0045, 0.03, 0.09], [0.0175, 0.044, -0.08], 'body', { sh: 0.4, d: 1 });                                         // klips yuvası kenarları (koyu)
  k.box([0.0045, 0.03, 0.09], [-0.0175, 0.044, -0.08], 'body', { sh: 0.4, d: 1 });
  if (open) for (const sx of [-1, 1]) k.box([0.004, 0.026, 0.02], [sx * 0.014, 0.068, 0.062], 'metal', { c: 0.001 });
  if (o === 'iron') rearPeep(k, 0.062, 0.056, line, 0.0052);
  else if (o === 'ww_peep') rearGhost(k, 0.062, 0.058, line, 0.0064, 0.0012, false);                                          // 12.174: hayalet halka (aynı kulakların arasında, büyük delik)
  else k.box([0.016, 0.006, 0.02], [0, 0.061, 0.062], 'metal', { c: 0.001 });                                                    // dürbünde: alçak gez kaidesi
  trig(k, 0.0, -0.03);
  // gaz silindiri + namlu + arpacık (kulaklı), süngü tırnağı
  k.cyl(0.0095, 0.0095, 0.42, [0, bx, -0.38], 'metal', { seg: 10 });
  k.cyl(0.0085, 0.0085, 0.21, [0, bx, -0.69], 'metal', { seg: 10 });
  k.cyl(0.0085, 0.0085, 0.24, [0, bx - 0.02, -0.46], 'metal', { seg: 8 });                                                  // kurma kolu borusu (altta)
  k.box([0.026, 0.04, 0.05], [0, bx - 0.008, -0.69], 'metal', { c: 0.003 });                                               // gaz silindiri bloğu
  frontPost(k, -0.705, bx + 0.012, line, { ears: true });
  k.box([0.012, 0.012, 0.022], [0, bx - 0.032, -0.705], 'metal', { d: 1 });
  k.ring(0.011, 0.0025, [0, -0.115, 0.3], 'metal', { d: 1 });
  // kurma kolu (bolt grubu: geri kayar, dönmez): sağda
  k.box([0.012, 0.012, 0.13], [0.024, bx - 0.014, -0.11], 'metal', { g: 'bolt', c: 0.002 });
  k.box([0.016, 0.014, 0.018], [0.034, bx - 0.006, -0.05], 'metal', { g: 'bolt', c: 0.002 });
  // klips (mag grubu): sekiz fişek şaşırtmalı iki sıra + klips kenarları; yukarıdan bastırılır (magAxis +Y)
  if (!lod) for (let i = 0; i < 8; i++) round(k, (i % 2 ? 0.0045 : -0.0045), 0.034 + Math.floor(i / 2) * 0.0035 + 0.012, -0.072 - (i % 2) * 0.002, 'mag', 0.062);
  for (const sx of [-1, 1]) k.box([0.0015, 0.03, 0.066], [sx * 0.0115, 0.042, -0.075], 'metal', { g: 'mag' });
  const meta = { name: 'Yarı Otomatik Tüfek', hold: 'rifle', gripR: [0, -0.036, 0.05], gripL: [0, -0.026, -0.44], muzzle: [0, bx, -0.8], length: 1.1, boltPivot: bx, boltSlide: true, magAxis: [0, 1, 0], chargePos: [0.035, 0.03, -0.05], pingEmpty: true };
  if (MAG[o]) return done(k, mat, meta, wwScope(k, MAG[o], 0.106, 0.128, 0.058, [0.025, -0.1], 'body'));                         // 12.174: gövde üstünde yüksek halkalar (klips yukarıdan yine girer)
  if (o === 'ww_scout') return done(k, mat, meta, scoutScope(k, 0.0745, -0.172, 0.0535, -0.2, -0.3));                          // 12.174: arka el siperi üstünde, gövdenin önünde
  return done(k, mat, meta, { sight: [0, line, 0.062], pivot: [0, line, -0.705], dist: ADS_DIST.iron, overlay: 'none' });
}

// ───────────────────────── Kundaklı HMK (Thompson tarzı; Mavi) ─────────────────────────
export function ww_smgb(mat = skinMaterial('ww_smgb'), lod = false, o = 'iron') {
  const k = newKit(lod), line = 0.084, bx = 0.036;
  // gövde (kutu, yuvarlak sırt), kurma topuzu yarığı, atım penceresi
  k.xsec([[-0.02, -0.002], [0.02, -0.002], [0.02, 0.05], [0.015, 0.06], [-0.015, 0.06], [-0.02, 0.05]], 0.07, -0.205, 'body', { c: 0.003 });
  k.box([0.004, 0.006, 0.12], [0, 0.061, -0.09], 'body', { sh: 0.3, d: 1 });
  k.box([0.004, 0.018, 0.05], [0.02, 0.036, -0.06], 'body', { sh: 0.35, d: 1 });
  k.box([0.012, 0.012, 0.016], [0, 0.066, -0.06], 'metal', { c: 0.002 });                                                    // kurma topuzu
  // dipçik (ahşap) + dipçik plakası, tabanca kabzası (ahşap, oluklu), yatay el siperi
  k.prof([[0.07, 0.048], [0.14, 0.04], [0.38, 0.012], [0.38, -0.104], [0.3, -0.086], [0.13, -0.034], [0.07, -0.026]], 0.04, 'furn', { c: 0.006 });
  k.prof([[0.38, 0.014], [0.39, 0.014], [0.39, -0.107], [0.38, -0.107]], 0.042, 'metal', { c: 0.002 });
  k.prof([[0.012, -0.002], [0.052, -0.002], [0.058, -0.016], [0.092, -0.112], [0.086, -0.124], [0.052, -0.124], [0.046, -0.112], [0.024, -0.04], [0.012, -0.024]], 0.034, 'furn', { c: 0.005, pat: lod ? 0 : 1 });
  k.prof([[-0.205, 0.022], [-0.37, 0.022], [-0.37, -0.012], [-0.36, -0.024], [-0.215, -0.024], [-0.205, -0.012]], 0.036, 'furn', { c: 0.006 });
  trig(k, 0.0, -0.002);
  // kanatlı namlu + kompansatör + arpacık; arka L gez (dioptri)
  k.cyl(0.0125, 0.0125, 0.16, [0, bx, -0.29], 'metal', { seg: 10 });
  if (!lod) for (let i = 0; i < 10; i++) k.cyl(0.0155, 0.0155, 0.005, [0, bx, -0.22 - i * 0.015], 'metal', { seg: 10, sh: 0.85 });
  k.cyl(0.0095, 0.0095, 0.09, [0, bx, -0.415], 'metal', { seg: 10 });
  k.box([0.024, 0.026, 0.045], [0, bx + 0.002, -0.48], 'metal', { c: 0.003 });
  if (!lod) for (const sx of [-1, 1]) k.box([0.003, 0.004, 0.03], [sx * 0.004, bx + 0.016, -0.48], 'metal', { sh: 0.3 });     // kompansatör yarıkları
  frontPost(k, -0.49, bx + 0.015, line);
  k.box([0.022, 0.01, 0.03], [0, 0.064, 0.045], 'metal', { c: 0.002 });
  if (o === 'ww_peep') rearGhost(k, 0.042, 0.069, line, 0.006, 0.0012, true); else rearPeep(k, 0.042, 0.068, line, 0.0048);      // 12.174: hayalet halka
  // şarjör (grup): düz 30'luk, tetiğin önünde
  k.prof([[-0.075, 0.0], [-0.108, 0.0], [-0.108, -0.2], [-0.075, -0.2]], 0.024, 'body', { c: 0.002, g: 'mag', sh: 0.95 });
  k.box([0.026, 0.008, 0.036], [0, -0.203, -0.0915], 'metal', { g: 'mag', c: 0.0015 });
  return done(k, mat, { name: 'Kundaklı HMK', hold: 'rifle', gripR: [0, -0.034, 0.04], gripL: [0, -0.018, -0.3], muzzle: [0, bx, -0.505], length: 0.9 },
    { sight: [0, line, 0.042], pivot: [0, line, -0.49], dist: ADS_DIST.iron, overlay: 'none' });
}

// ───────────────────────── Katlanır HMK (MP40 tarzı; Kırmızı) ─────────────────────────
export function ww_smgr(mat = skinMaterial('ww_smgr'), lod = false, o = 'iron') {
  const k = newKit(lod), line = 0.083, bx = 0.042;
  // gövde borusu + alt gövde (bakalit kabuk), kurma kolu (sol), atım penceresi
  k.cyl(0.0175, 0.0175, 0.27, [0, bx, -0.085], 'body', { seg: 12 });
  if (!lod) for (let i = 0; i < 6; i++) k.cyl(0.0182, 0.0182, 0.008, [0, bx, -0.03 - i * 0.022], 'body', { seg: 12, sh: 0.8 });   // gövde yivleri
  k.prof([[0.05, 0.028], [-0.2, 0.028], [-0.2, 0.01], [-0.12, 0.002], [-0.085, -0.004], [0.02, -0.004], [0.05, 0.004]], 0.03, 'furn', { c: 0.003 });
  k.box([0.018, 0.01, 0.012], [-0.026, bx + 0.006, -0.05], 'metal', { c: 0.002 });
  k.box([0.004, 0.012, 0.05], [0.018, bx, -0.07], 'body', { sh: 0.3, d: 1 });
  // kabza (bakalit), tetik; şarjör yuvası
  k.prof([[0.012, -0.004], [0.05, -0.004], [0.056, -0.018], [0.086, -0.114], [0.08, -0.126], [0.048, -0.126], [0.042, -0.114], [0.022, -0.04], [0.012, -0.024]], 0.032, 'furn', { c: 0.005, pat: lod ? 0 : 1 });
  trig(k, 0.0, -0.004, 'body');
  k.prof([[-0.085, -0.004], [-0.14, -0.004], [-0.14, -0.08], [-0.085, -0.08]], 0.032, 'body', { c: 0.002 });
  // namlu + destek tırnağı (altta) + kalkanlı arpacık
  k.cyl(0.0095, 0.0095, 0.2, [0, bx, -0.32], 'metal', { seg: 10 });
  k.box([0.014, 0.022, 0.024], [0, bx - 0.022, -0.39], 'metal', { c: 0.002 });
  frontPost(k, -0.405, bx + 0.0095, line, { hood: true });
  // arka gez (yatık / dik yaprak) + katlanır metal dipçik (açık): iki çubuk + omuz plakası
  k.box([0.022, 0.008, 0.026], [0, bx + 0.02, 0.005], 'metal', { c: 0.002 });
  if (o === 'ww_peep') rearGhost(k, 0.006, bx + 0.024, line, 0.0058, 0.0012, true); else rearNotch(k, 0.006, bx + 0.024, line, 0.01, 0.0026);      // 12.174: çentik yerine diyoptr
  for (const sx of [-1, 1]) bar(k, [0.05, 0.03], [0.31, -0.03], 0.007, 0.009, 'metal', { x: sx * 0.013 });
  bar(k, [0.05, -0.006], [0.31, -0.07], 0.007, 0.009, 'metal');
  k.box([0.03, 0.1, 0.012], [0, -0.035, 0.315], 'metal', { c: 0.003 });
  // şarjör (grup): uzun düz 32'lik
  k.prof([[-0.093, -0.02], [-0.132, -0.02], [-0.132, -0.25], [-0.093, -0.25]], 0.024, 'body', { c: 0.002, g: 'mag', sh: 0.9 });
  if (!lod) for (let i = 0; i < 4; i++) k.box([0.025, 0.004, 0.03], [0, -0.06 - i * 0.045, -0.1125], 'body', { g: 'mag', sh: 0.7 });
  k.box([0.026, 0.008, 0.042], [0, -0.252, -0.1125], 'metal', { g: 'mag', c: 0.0015 });
  return done(k, mat, { name: 'Katlanır HMK', hold: 'rifle', gripR: [0, -0.034, 0.04], gripL: [0, -0.012, -0.17], muzzle: [0, bx, -0.42], length: 0.84 },
    { sight: [0, line, 0.006], pivot: [0, line, -0.405], dist: 0.32, overlay: 'none' });
}

// ───────────────────────── Hafif Makineli Tüfek (BAR tarzı; ağır destek) ─────────────────────────
export function ww_lmg(mat = skinMaterial('ww_lmg'), lod = false, o = 'iron') {
  const k = newKit(lod), line = 0.098, bx = 0.038;
  // uzun gövde, kurma kolu (sol), atım penceresi
  k.xsec([[-0.019, 0.0], [0.019, 0.0], [0.019, 0.048], [0.014, 0.056], [-0.014, 0.056], [-0.019, 0.048]], 0.07, -0.29, 'body', { c: 0.003 });
  k.prof([[0.07, 0.0], [-0.06, 0.0], [-0.07, -0.012], [-0.07, -0.03], [0.02, -0.03], [0.07, -0.012]], 0.034, 'body', { c: 0.002 });   // tetik gövdesi (alt)
  if (!lod) for (let i = 0; i < 3; i++) k.box([0.039, 0.012, 0.03], [0, 0.022, -0.2 - i * 0.03], 'body', { sh: 0.55 });               // gövde hafifletme oyukları
  k.box([0.016, 0.012, 0.022], [-0.028, 0.03, -0.12], 'metal', { c: 0.002 });
  k.box([0.004, 0.02, 0.07], [0.021, 0.04, -0.08], 'body', { sh: 0.3, d: 1 });
  // dipçik (ahşap) + kabza bölümü + dipçik plakası
  k.prof([[0.07, 0.05], [0.36, 0.024], [0.36, -0.108], [0.22, -0.088], [0.1, -0.048], [0.07, -0.006]], 0.044, 'furn', { c: 0.006 });
  k.prof([[0.012, -0.006], [0.056, -0.006], [0.062, -0.02], [0.094, -0.116], [0.088, -0.128], [0.054, -0.128], [0.048, -0.116], [0.024, -0.04], [0.012, -0.024]], 0.034, 'furn', { c: 0.005 });
  k.prof([[0.36, 0.026], [0.372, 0.026], [0.372, -0.112], [0.36, -0.112]], 0.046, 'metal', { c: 0.002 });
  trig(k, 0.0, -0.006);
  // ön kundak (oluklu ahşap), gaz borusu, namlu, alev gizleyici, arpacık; katlı çatal ayak (kundak altında, geriye yatık)
  k.prof([[-0.29, 0.034], [-0.54, 0.034], [-0.54, -0.006], [-0.53, -0.022], [-0.3, -0.022], [-0.29, -0.006]], 0.046, 'furn', { c: 0.006 });
  if (!lod) for (let i = 0; i < 4; i++) k.box([0.047, 0.004, 0.2], [0, -0.014 + i * 0.012, -0.415], 'furn', { sh: 0.7, d: 1 });
  k.cyl(0.0085, 0.0085, 0.26, [0, bx - 0.026, -0.66], 'metal', { seg: 8 });
  k.cyl(0.0115, 0.0115, 0.6, [0, bx, -0.6], 'metal', { seg: 10 });
  k.cyl(0.016, 0.012, 0.06, [0, bx, -0.93], 'metal', { seg: 10, sh: 0.85 });
  frontPost(k, -0.9, bx + 0.012, line, { ears: true });
  k.box([0.03, 0.014, 0.02], [0, bx - 0.016, -0.83], 'metal', { c: 0.002 });
  for (const sx of [-1, 1]) { bar(k, [-0.83, bx - 0.02], [-0.56, -0.03], 0.007, 0.008, 'metal', { x: sx * 0.022 }); k.box([0.014, 0.006, 0.026], [sx * 0.022, -0.034, -0.55], 'metal', { d: 1 }); }
  // arka dioptri (yüksek yaprak) + taşıma kolu
  k.box([0.026, 0.022, 0.04], [0, 0.066, 0.045], 'metal', { c: 0.002 });
  if (o === 'ww_peep') rearGhost(k, 0.05, 0.077, line, 0.0064, 0.0012, true); else rearPeep(k, 0.05, 0.077, line, 0.0052);      // 12.174: hayalet halka
  // şarjör (grup): düz 20'lik
  k.prof([[-0.08, -0.006], [-0.17, -0.006], [-0.17, -0.12], [-0.08, -0.12]], 0.034, 'body', { c: 0.002, g: 'mag', sh: 0.95 });
  k.box([0.036, 0.008, 0.094], [0, -0.123, -0.125], 'metal', { g: 'mag', c: 0.0015 });
  return done(k, mat, { name: 'Hafif Makineli Tüfek', hold: 'rifle', gripR: [0, -0.034, 0.05], gripL: [0, -0.026, -0.42], muzzle: [0, bx, -0.96], length: 1.32 },
    { sight: [0, line, 0.05], pivot: [0, line, -0.9], dist: ADS_DIST.iron, overlay: 'none' });
}

// ───────────────────────── Ağır Makineli (MG42 tarzı; Kırmızı ağır destek) ─────────────────────────
// Delikli namlu kılıfı (yan yarıklar), sac gövde, besleme kapağı + solda 50'lik şerit tamburu (mag grubu), çatal ayak (ön, katlı), koyu kundak
export function ww_mg(mat = skinMaterial('ww_mg'), lod = false, o = 'iron') {
  const k = newKit(lod), line = 0.094, bx = 0.042;
  k.xsec([[-0.02, -0.004], [0.02, -0.004], [0.02, 0.06], [0.015, 0.066], [-0.015, 0.066], [-0.02, 0.06]], 0.07, -0.2, 'body', { c: 0.003 });
  k.xsec([[-0.024, 0.04], [0.024, 0.04], [0.024, 0.07], [0.018, 0.078], [-0.018, 0.078], [-0.024, 0.07]], -0.02, -0.17, 'body', { c: 0.003, sh: 1.06 });   // besleme kapağı
  k.box([0.004, 0.018, 0.06], [0.02, 0.03, -0.06], 'body', { sh: 0.3, d: 1 });
  k.box([0.03, 0.02, 0.05], [-0.034, 0.05, -0.1], 'body', { c: 0.002 });                                                          // besleme ağzı (sol)
  // namlu kılıfı (kare kesit, delikler) + namlu ucu (koni alev gizleyici) + ön arpacık
  k.xsec([[-0.021, 0.012], [0.021, 0.012], [0.021, 0.068], [-0.021, 0.068]], -0.2, -0.58, 'body', { c: 0.004 });
  if (!lod) for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) k.box([0.0025, 0.022, 0.04], [sx * 0.021, 0.04, -0.24 - i * 0.055], 'body', { sh: 0.25 });
  if (!lod) for (let i = 0; i < 6; i++) k.box([0.026, 0.0025, 0.04], [0, 0.0685, -0.24 - i * 0.055], 'body', { sh: 0.3 });
  k.cyl(0.009, 0.009, 0.07, [0, bx, -0.61], 'metal', { seg: 10 });
  k.cyl(0.02, 0.012, 0.05, [0, bx, -0.665], 'metal', { seg: 10, sh: 0.85 });
  frontPost(k, -0.56, 0.068, line, { ears: true });
  // arka gez (tanjant yaprak, besleme kapağının önünde) + kundak (koyu) + kabza + tetik
  k.box([0.024, 0.01, 0.05], [0, 0.083, -0.19], 'metal', { c: 0.002 });
  if (o === 'ww_peep') rearGhost(k, -0.008, 0.066, line, 0.006, 0.0012, true); else rearNotch(k, -0.18, 0.088, line, 0.01, 0.0026);      // 12.174: diyoptr gövde arkasında (yaprak gez yatık)
  k.prof([[0.07, 0.05], [0.12, 0.046], [0.36, 0.022], [0.36, -0.09], [0.3, -0.08], [0.15, -0.034], [0.07, -0.02]], 0.04, 'furn', { c: 0.006 });
  k.prof([[0.36, 0.024], [0.372, 0.024], [0.372, -0.094], [0.36, -0.094]], 0.042, 'metal', { c: 0.002 });
  k.prof([[0.012, -0.004], [0.05, -0.004], [0.056, -0.018], [0.086, -0.114], [0.08, -0.126], [0.048, -0.126], [0.042, -0.114], [0.022, -0.04], [0.012, -0.024]], 0.032, 'furn', { c: 0.005, pat: lod ? 0 : 1 });
  trig(k, 0.0, -0.004, 'body');
  // çatal ayak (katlı, kılıf altında)
  k.box([0.03, 0.012, 0.02], [0, 0.006, -0.55], 'metal', { c: 0.002 });
  for (const sx of [-1, 1]) bar(k, [-0.55, 0.0], [-0.33, -0.012], 0.007, 0.008, 'metal', { x: sx * 0.017 });
  // şerit tamburu (mag grubu): solda tambur + şerit
  k.cyl(0.045, 0.045, 0.05, [-0.05, 0.0, -0.1], 'body', { ax: 'x', seg: lod ? 8 : 14, g: 'mag' });
  if (!lod) for (let i = 0; i < 4; i++) k.box([0.008, 0.012, 0.006], [-0.034, 0.05, -0.085 - i * 0.012], 'acc', { g: 'mag' });
  return done(k, mat, { name: 'Ağır Makineli', hold: 'rifle', gripR: [0, -0.034, 0.04], gripL: [0, 0.004, -0.31], muzzle: [0, bx, -0.69], length: 1.12, magAxis: [-1, -0.3, 0] },
    o === 'ww_peep' ? { sight: [0, line, -0.008], pivot: [0, line, -0.56], dist: 0.248, overlay: 'none' } : { sight: [0, line, -0.18], pivot: [0, line, -0.56], dist: 0.42, overlay: 'none' });      // diyoptrde göz aynı yerde (z 0,24)
}

// ───────────────────────── Tabanca (subay tabancası; açık horoz, ahşap kabza) ─────────────────────────
export function ww_pistol(mat = skinMaterial('ww_pistol'), lod = false) {
  const k = newKit(lod), line = 0.084;
  k.grp = 'slide';
  k.xsec([[-0.0145, 0.03], [0.0145, 0.03], [0.0145, 0.066], [0.01, 0.074], [-0.01, 0.074], [-0.0145, 0.066]], 0.052, -0.158, 'body', { c: 0.0025 });
  if (!lod) for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) k.box([0.0016, 0.026, 0.0024], [sx * 0.0147, 0.05, 0.046 - i * 0.005], 'body', { sh: 0.35 });
  k.box([0.003, 0.012, 0.03], [0.0145, 0.06, -0.035], 'body', { sh: 0.3 });
  rearNotch(k, 0.042, 0.072, line, 0.009, 0.0024);
  k.box([0.003, line - 0.072, 0.008], [0, (line + 0.072) / 2, -0.15], 'metal', { sh: 0.85 });
  k.grp = null;
  k.cyl(0.0068, 0.0068, 0.012, [0, 0.05, -0.162], 'metal', { seg: 10, sh: 0.7 });
  // gövde, kabza (ahşap panelli, tırtıllı), horoz, tetik korkuluğu, emniyet
  k.prof([[0.05, 0.031], [-0.15, 0.031], [-0.15, 0.016], [-0.03, 0.012], [-0.004, 0.006], [0.05, 0.006]], 0.028, 'body', { c: 0.002 });
  k.prof([[0.0, 0.008], [0.048, 0.01], [0.06, 0.0], [0.084, -0.106], [0.078, -0.118], [0.04, -0.122], [0.034, -0.112], [0.012, -0.028], [0.0, -0.006]], 0.028, 'body', { c: 0.003 });
  k.prof([[0.006, -0.008], [0.05, -0.006], [0.074, -0.1], [0.04, -0.108], [0.016, -0.03]], 0.0315, 'furn', { c: 0.002, pat: lod ? 0 : 1 });
  k.box([0.012, 0.016, 0.01], [0, 0.052, 0.058], 'metal', { c: 0.002, rot: [-0.4, 0, 0] });
  guard(k, [[0.002, 0.008], [0.002, -0.004], [-0.012, -0.03], [-0.054, -0.03], [-0.058, -0.022], [-0.058, 0.008]], [[-0.006, -0.004], [-0.016, -0.023], [-0.049, -0.023], [-0.051, -0.018], [-0.051, 0.006]], 0.012, 'body');
  k.prof([[-0.014, 0.006], [-0.021, 0.006], [-0.024, -0.012], [-0.019, -0.018], [-0.014, -0.008]], 0.005, 'metal', { d: 1 });
  k.box([0.003, 0.008, 0.016], [-0.0145, 0.022, 0.036], 'metal', { d: 1 });
  // şarjör (grup): kabza içinde + taban
  k.prof([[0.012, 0.0], [0.046, 0.002], [0.076, -0.11], [0.044, -0.114]], 0.022, 'metal', { g: 'mag' });
  k.prof([[0.042, -0.116], [0.082, -0.112], [0.084, -0.126], [0.04, -0.13]], 0.026, 'metal', { c: 0.002, g: 'mag', sh: 0.85 });
  return done(k, mat, { name: 'Tabanca', hold: 'pistol', gripR: [0, -0.03, 0.02], gripL: null, muzzle: [0, 0.05, -0.17], length: 0.24, slideTravel: 0.024 },
    { sight: [0, line, 0.042], pivot: [0, line, -0.15], dist: ADS_DIST.iron, overlay: 'none' });
}

// ───────────────────────── Saplı El Bombası ─────────────────────────
// Ahşap sap (alt kapak + ip ucu) + üstte metal başlık; sap Y ekseninde, el sapın ortasından tutar
export function ww_nade(mat = skinMaterial('ww_nade'), lod = false) {
  const k = newKit(lod);
  k.cyl(0.0125, 0.0125, 0.26, [0, -0.04, 0], 'furn', { ax: 'y', seg: lod ? 6 : 10 });
  k.cyl(0.0145, 0.0145, 0.016, [0, -0.17, 0], 'metal', { ax: 'y', seg: 10 });                                               // alt kapak
  if (!lod) k.ring(0.008, 0.0018, [0, -0.184, 0], 'acc', { seg: 8 });                                                       // ip halkası
  k.cyl(0.034, 0.034, 0.1, [0, 0.135, 0], 'body', { ax: 'y', seg: lod ? 8 : 14 });
  k.cyl(0.028, 0.034, 0.014, [0, 0.192, 0], 'body', { ax: 'y', seg: 14, sh: 0.9 });
  k.cyl(0.02, 0.028, 0.012, [0, 0.082, 0], 'metal', { ax: 'y', seg: 12 });                                                   // başlık bileziği
  if (!lod) k.cyl(0.0345, 0.0345, 0.014, [0, 0.15, 0], 'acc', { ax: 'y', seg: 14, sh: 0.9 });                                // boya bandı
  return done(k, mat, { name: 'Saplı El Bombası', hold: 'grenade', gripR: [0, 0, 0], gripL: null, muzzle: [0, 0, 0], length: 0.36 }, null);
}

export const WW2W = { ww_bolt, ww_sniper, ww_semi, ww_smgb, ww_smgr, ww_lmg, ww_mg, ww_pistol, ww_nade };
export const WW2_IDS = Object.keys(WW2W);
void THREE; void bez;
