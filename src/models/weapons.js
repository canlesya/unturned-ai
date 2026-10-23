import * as THREE from 'three';
import { box, taperBox, cyl, cylY, ico, V, mergeStatic, mergeVC } from '../core/geo.js';
import { C } from '../core/palette.js';
import { mat } from '../core/geo.js';
import { resolveOptic, WSTATS, SKIN_IDS } from '../game/stats.js';
import { M, finish, railTicks, magGroup, frontSight, magRibs, studs, gripTexture, sling, vents } from './weapon_util.js';
import { MORE, MOUNT_MORE } from './weapons_more.js';
import { S3R } from './s3rifles.js';   // s3rifles
import { finishWeapon } from './weaponFinish.js';
import { PAINTBALL, MOUNT_PB } from './paintball.js';
import { S3W, s3Optic, ADS_DIST, ADS_NEAR } from './s3weapons.js';
import { skinMaterial } from './skins.js';
import { S3SMG } from './s3smg.js';                                    // s3smg

// Her silah: origin = tabanca kabzası (sağ el), namlu -Z yönünde.
// userData: name, hold (rifle|pistol|launcher|melee|grenade), gripR, gripL, muzzle, length, mag (şarjör grubu), bolt
// ─────────────── Nişangâhlar ───────────────
// Red dot / holo / ACOG: S3 nişangâhları (s3weapons.js, tek ağ + cam, eksende ışıyan retikül) — S3 olmayan silahlara birleştirmeden SONRA eklenir.
// Demir nişan (S3 olmayanlarda): kutu gez + arpacık; gez deliği nişan çizgisine (h) SİMETRİK (eskiden 2 mm aşağıdaydı → nişanda ≈ 4 px kayma).
const BLK = C.black;

function ring(g, R, r, color, pos, seg = 14) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 5, seg), mat(color));
  m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
}

// Demir nişan: arka peep (delikli) gez, delik h ± 12 mm (×s). h = ön arpacık tepe yüksekliği = nişan çizgisi
function ironRear(g, x, yb, z, h, s = 1) {
  const bot = h - 0.012 * s;
  if (bot > yb) box(g, [0.02 * s, bot - yb, 0.01 * s], C.steel, [x, (yb + bot) / 2, z]);
  for (const sx of [-1, 1]) box(g, [0.005 * s, 0.024 * s, 0.01 * s], C.steel, [x + sx * 0.0095 * s, h, z]);
  box(g, [0.024 * s, 0.004 * s, 0.01 * s], C.steel, [x, h + 0.014 * s, z]);
}
function ironFront(g, x, z, base, h) {
  box(g, [0.005, h - base, 0.005], C.steel, [x, (base + h) / 2, z]);
  for (const sx of [-1, 1]) box(g, [0.004, 0.02, 0.01], C.steel, [x + sx * 0.011, h - 0.006, z]);   // koruyucu kulaklar
}

// Silaha göre montaj noktaları (z: nişangâh merkezi, y: üst yüzey, front: ön arpacık yüksekliği). AK / M4 / Glock / M24 / Pompalı: S3 (kendi nişanları)
const MOUNT = {
  ...MOUNT_MORE, ...MOUNT_PB,
  mp5: { z: -0.08, y: 0.0575, front: 0.0925, rearZ: -0.01, ownFront: true },
  lmg: { z: -0.1, y: 0.111, front: 0.126, rearZ: -0.12, frontZ: -0.62, frontBase: 0.055, lift: 0.01 },
};

// Optik tabanı gövde üstüne oturmalı: nişangâh ayağının altında kalan en yüksek parçanın tepesini bul (en çok 3 cm yükseltir)
function mountY(g, m, z) {
  const bb = new THREE.Box3();
  let top = m.y;
  for (const n of g.children) {
    if (!n.isMesh) continue;
    bb.setFromObject(n);
    if (bb.max.z < z - 0.05 || bb.min.z > z + 0.05 || bb.min.x > 0.03 || bb.max.x < -0.03) continue;
    if (bb.max.y > top + 0.001 && bb.max.y < m.y + 0.03) top = bb.max.y;
  }
  return top;
}

// Optik (red dot / holo) takılıyken göz hattının önünde kalan KÜÇÜK ön parçaları (arpacık, kule artığı, boncuk) gizle.
// Işınlar gözden nişan noktasından geçip ~%2 eğimle açılır (≈ 6 mm yarıçaplı koridor).
function clearSightLine(g, sight, dist) {
  const [, sy, sz] = sight, ze = sz + dist, bb = new THREE.Box3(), sz3 = new THREE.Vector3(), rm = [];
  for (const n of g.children) {
    if (!n.isMesh) continue;
    bb.setFromObject(n);
    if (bb.min.z > sz - 0.03) continue;                                // yalnızca nişangâhın önündekiler
    const w = 0.022 * (ze - bb.max.z);                                 // en yakın yüzde koridor yarı genişliği
    if (bb.min.x > w || bb.max.x < -w || bb.min.y > sy + w || bb.max.y < sy - w) continue;
    bb.getSize(sz3);
    if (sz3.x <= 0.035 && sz3.z <= 0.06 && sz3.y <= 0.09) rm.push(n);   // küçük parça: ön nişan kalıntısı
  }
  for (const n of rm) g.remove(n);                                      // birleştirme görünürlüğe bakmaz: parçayı tamamen çıkar
}

// S3 olmayan silaha nişangâh: demir → gez (+ arpacık) hemen eklenir; optik → S3 nişangâhı kurulur (grup döner, birleştirmeden sonra eklenir)
function attachSight(g, id, optic, lod) {
  const m0 = MOUNT[id];
  if (!m0) return null;
  if (optic === 'iron') {
    const sc = m0.scale || 1;
    ironRear(g, 0, m0.y, m0.rearZ, m0.front, sc);
    if (!m0.ownFront) ironFront(g, 0, m0.frontZ, m0.frontBase, m0.front);
    return { sight: [0, m0.front, m0.rearZ], dist: ADS_DIST.iron, near: g.userData.hold === 'pistol' ? ADS_NEAR.pistol : ADS_NEAR.iron, overlay: 'none' };
  }
  const y = mountY(g, m0, m0.z) + (m0.lift || 0);                                          // lift: üst kapak/besleme tepsisi için ek yükseltme
  const o = s3Optic(optic, y, m0.z, lod, g.userData.hold === 'pistol');
  if (!o) return null;
  clearSightLine(g, o.sight, o.dist / 0.92);
  if (lod) { const m = o.g.children[0]; m.geometry.deleteAttribute('wf'); m.material = mat(BLK); g.add(m); return { ...o, g: null }; }   // 3. şahıs: tek renk, köşe renkli birleştirmeye katılır (ek çizim çağrısı yok)
  return o;
}

// ───────────────────────── MP5 (hafif makineli) ─────────────────────────
function mp5() {
  const g = new THREE.Group();
  box(g, [0.05, 0.075, 0.26], C.gun, [0, 0.02, -0.1], null, M);
  box(g, [0.062, 0.06, 0.17], C.black, [0, 0.005, -0.32]);                     // tutamaç
  cyl(g, 0.016, 0.016, 0.07, C.steel, [0, 0.025, -0.44], 8, M);                // namlu manşonu
  cyl(g, 0.01, 0.01, 0.05, C.steel, [0, 0.025, -0.49], 8, M);
  frontSight(g, [0.012, 0.06, 0.016], C.steel, [0, 0.0625, -0.45]);           // arpacık
  box(g, [0.04, 0.04, 0.05], C.black, [0, 0.0, -0.01]);
  box(g, [0.012, 0.012, 0.1], C.steel, [0, -0.045, -0.04]);
  box(g, [0.04, 0.105, 0.05], C.black, [0, -0.07, 0.045], [0.3, 0, 0]);
  // kavisli şarjör
  const mg = magGroup(g);
  box(mg, [0.034, 0.1, 0.05], C.steel, [0, -0.06, -0.12], [0.1, 0, 0], M);
  box(mg, [0.034, 0.1, 0.05], C.steel, [0, -0.155, -0.14], [0.3, 0, 0], M);
  box(mg, [0.034, 0.08, 0.05], C.steel, [0, -0.23, -0.175], [0.55, 0, 0], M);
  // tel dipçik
  box(g, [0.014, 0.014, 0.28], C.steel, [0, 0.03, 0.24], null, M);
  box(g, [0.014, 0.014, 0.28], C.steel, [0, -0.04, 0.24], [0.15, 0, 0], M);
  box(g, [0.012, 0.09, 0.012], C.steel, [0, -0.005, 0.38], null, M);
  box(g, [0.048, 0.1, 0.02], C.black, [0, -0.01, 0.395]);
  // ayrıntılar
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) box(g, [0.004, 0.035, 0.008], '#0a0a0c', [sx * 0.0315, 0.005, -0.27 - i * 0.025]);   // tutamak yarıkları
  box(g, [0.064, 0.012, 0.02], C.steel, [0, 0.03, -0.405]);                                // tutamak ucu halkası
  box(g, [0.01, 0.014, 0.06], C.steel, [0.03, 0.01, -0.02]);                                // seçici kolu
  box(g, [0.006, 0.02, 0.05], '#0a0a0c', [0.0265, 0.034, -0.11]);                          // atım penceresi
  box(g, [0.04, 0.05, 0.09], C.black, [0, 0.015, 0.07]);                                    // dipçik bağlantı bloğu (tel dipçik gövdeye otursun)
  for (const dz of [-0.09, 0.0]) box(g, [0.012, 0.03, 0.012], C.steel, [0, -0.034, dz]);   // tetik koruması direkleri
  studs(g, [[0.02, -0.2], [0.04, -0.1]], C.steel, 0.007, 0.0255);
  box(mg, [0.038, 0.012, 0.055], C.black, [0, -0.275, -0.19], [0.55, 0, 0]);
  sling(g, [0, 0.0, 0.4]);
  gripTexture(g, -0.04, 0.045, 0.04, 0.08, 4, 0.3);
  return finish(g, {
    name: 'MP5', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.02, -0.32], muzzle: [0, 0.025, -0.53], length: 0.92,
  });
}

// ───────────────────────── Hafif Makineli (M249) ─────────────────────────
function lmg() {
  const g = new THREE.Group();
  box(g, [0.07, 0.095, 0.4], C.gun, [0, 0.02, -0.15], null, M);                         // gövde
  box(g, [0.06, 0.03, 0.2], C.black, [0, 0.085, -0.1]);                                 // besleme kapağı
  box(g, [0.035, 0.012, 0.3], C.black, [0, 0.105, -0.17]);                              // ray
  // fişek kutusu + kemer
  const mg = magGroup(g);
  box(mg, [0.1, 0.12, 0.16], C.olive, [0, -0.115, -0.13]);
  box(mg, [0.104, 0.02, 0.164], C.oliveDark, [0, -0.06, -0.13]);
  for (let i = 0; i < 6; i++) box(mg, [0.06, 0.016, 0.012], C.brass, [0.0, -0.03, -0.2 + i * 0.022], [0, 0, 0], M);
  box(mg, [0.05, 0.05, 0.02], C.brass, [0, -0.01, -0.11], null, M);
  // namlu & ısı kalkanı
  box(g, [0.07, 0.06, 0.2], C.black, [0, 0.025, -0.45]);
  cyl(g, 0.016, 0.016, 0.28, C.steel, [0, 0.028, -0.65], 8, M);
  cyl(g, 0.022, 0.022, 0.07, C.black, [0, 0.028, -0.8], 8, M);
  // taşıma sapı
  box(g, [0.012, 0.07, 0.012], C.steel, [0, 0.085, -0.58]);
  box(g, [0.012, 0.012, 0.1], C.steel, [0, 0.12, -0.58]);
  // bipod
  box(g, [0.08, 0.02, 0.03], C.steel, [0, 0.005, -0.62]);
  box(g, [0.012, 0.14, 0.012], C.steel, [-0.045, -0.075, -0.65], [0.0, 0, -0.25]);
  box(g, [0.012, 0.14, 0.012], C.steel, [0.045, -0.075, -0.65], [0.0, 0, 0.25]);
  box(g, [0.045, 0.11, 0.055], C.black, [0, -0.07, 0.06], [0.3, 0, 0]);
  box(g, [0.012, 0.012, 0.1], C.steel, [0, -0.052, -0.02]);
  box(g, [0.05, 0.08, 0.1], C.black, [0, 0.0, 0.1]);                                       // dipçik bağlantısı
  box(g, [0.06, 0.13, 0.3], C.black, [0, -0.0, 0.27], [0.08, 0, 0]);
  box(g, [0.064, 0.14, 0.016], C.steel, [0, -0.02, 0.43], [0.08, 0, 0]);
  // ayrıntılar
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) box(g, [0.004, 0.02, 0.008], '#0a0a0c', [sx * 0.037, 0.03, -0.38 - i * 0.025]);   // ısı kalkanı delikleri
  for (let i = 0; i < 3; i++) box(g, [0.074, 0.01, 0.012], C.steel, [0, 0.025, -0.53 - i * 0.04]);
  box(g, [0.02, 0.012, 0.04], C.steel, [0.045, 0.04, -0.02]);                                   // doldurma kolu
  box(g, [0.012, 0.03, 0.012], C.steel, [0.052, 0.03, -0.02]);
  box(g, [0.012, 0.012, 0.12], C.steel, [-0.045, 0.06, -0.25]);
  for (let i = 0; i < 5; i++) box(mg, [0.012, 0.014, 0.01], C.brass, [-0.05, -0.03 + 0.0, -0.215 + i * 0.015]);   // kemer halkaları
  box(mg, [0.106, 0.012, 0.166], C.black, [0, -0.17, -0.13]);                                  // kutu tabanı
  for (let i = 0; i < 3; i++) box(mg, [0.002, 0.08, 0.004], C.oliveDark, [0.0505, -0.115, -0.18 + i * 0.05]);
  cyl(g, 0.022, 0.022, 0.03, C.black, [0, 0.028, -0.82], 8, M);                                 // alev gizleyici halkası
  for (let i = 0; i < 3; i++) box(g, [0.05, 0.006, 0.006], '#0a0a0c', [0, 0.028, -0.8 + i * 0.012]);
  box(g, [0.066, 0.1, 0.014], C.steel, [0, -0.01, 0.32], [0.08, 0, 0]);
  sling(g, [0, 0.0, 0.42]); sling(g, [0, 0.01, -0.5]);
  gripTexture(g, -0.04, 0.06, 0.046, 0.08, 4, 0.3);
  return finish(g, {
    name: 'M249 LMG', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.06], gripL: [0, -0.01, -0.45], muzzle: [0, 0.028, -0.84], length: 1.28,
  });
}

// ───────────────────────── RPG-7 ─────────────────────────
function rpg() {
  const g = new THREE.Group();
  cyl(g, 0.03, 0.03, 0.95, C.olive, [0, 0.05, 0.05], 10, M);                      // tüp
  cyl(g, 0.036, 0.036, 0.3, C.wood, [0, 0.05, -0.12], 10);                         // ahşap koruma
  cyl(g, 0.03, 0.06, 0.14, C.oliveDark, [0, 0.05, 0.57], 10, M);                  // arka huni
  // mühimmat başlığı
  const mg = magGroup(g);                                                          // roket başlığı (doldururken çıkar/girer)
  cyl(mg, 0.012, 0.05, 0.14, C.olive, [0, 0.05, -0.6], 10, M);                    // koni burun
  cyl(mg, 0.05, 0.05, 0.1, C.oliveDark, [0, 0.05, -0.48], 10, M);                 // gövde
  cyl(mg, 0.034, 0.034, 0.06, C.oliveDark, [0, 0.05, -0.41], 10, M);
  box(g, [0.04, 0.115, 0.05], C.black, [0, -0.04, 0.04], [0.3, 0, 0]);             // kabza
  box(g, [0.012, 0.012, 0.09], C.steel, [0, -0.012, -0.01]);                       // tetik koruması
  box(g, [0.04, 0.09, 0.04], C.black, [0, -0.025, -0.2], [-0.1, 0, 0]);            // ön kabza
  // nişangâh (tüpün solunda): arkada halka (göze yakın), önde turuncu uçlu arpacık. Halkanın ortasından arpacığın turuncu ucu görününce nişan hizalıdır.
  box(g, [0.04, 0.012, 0.022], C.steel, [-0.027, 0.082, -0.05]);                    // arka kelepçe
  box(g, [0.01, 0.045, 0.014], C.steel, [-0.045, 0.1, -0.05]);                      // arka halka sapı
  ring(g, 0.017, 0.0032, C.black, [-0.045, 0.14, -0.05], 12);                       // arka halka (nişan penceresi)
  box(g, [0.04, 0.012, 0.022], C.steel, [-0.027, 0.082, -0.4]);                     // ön kelepçe
  box(g, [0.007, 0.062, 0.009], C.steel, [-0.045, 0.114, -0.4]);                    // arpacık
  box(g, [0.009, 0.014, 0.011], '#ff9a2e', [-0.045, 0.143, -0.4]);                  // turuncu uç (nişan noktası)
  // ayrıntılar
  for (let i = 0; i < 4; i++) cyl(g, 0.038, 0.038, 0.012, C.black, [0, 0.05, -0.2 + i * 0.1], 10);       // tüp bantları
  for (let i = 0; i < 5; i++) box(g, [0.004, 0.012, 0.3 / 5], '#2a2d30', [0.0, 0.086, -0.12 - 0.15 + i * 0.06]);   // ahşap damarı
  for (let k = 0; k < 4; k++) box(mg, [0.01, 0.07, 0.035], C.oliveDark, [Math.cos(k * Math.PI / 2) * 0.052, 0.05 + Math.sin(k * Math.PI / 2) * 0.052, -0.42], [0, 0, k * Math.PI / 2 + Math.PI / 2]);  // stabilizör kanatları
  cyl(mg, 0.014, 0.014, 0.03, C.brass, [0, 0.05, -0.68], 8, M);                                  // fünye ucu
  cyl(g, 0.065, 0.062, 0.02, C.black, [0, 0.05, 0.64], 10, M);                                    // arka huni halkası
  box(g, [0.06, 0.02, 0.1], C.black, [0, 0.0, -0.04]);                                            // kabza gövdesi
  sling(g, [0, 0.0, 0.3]); sling(g, [0, 0.0, -0.3]);
  return finish(g, {
    name: 'RPG-7', mag: mg, magAxis: [0, 0, -1], hold: 'launcher', gripR: [0, -0.03, 0.04], gripL: [0, -0.03, -0.2], muzzle: [0, 0.05, -0.68], length: 1.3,
  });
}

// ───────────────────────── Bıçak (taktik savaş bıçağı) ─────────────────────────
// Kısa, mat siyah sivri uç bıçak + zeytin yeşili oluklu sap + kırmızı kordon. Sap z=0 merkezli (el burada tutar).
function knife() {
  const g = new THREE.Group(), DARK = '#2e3238';
  box(g, [0.028, 0.036, 0.12], C.oliveDark, [0, 0, 0]);                              // sap
  for (let i = 0; i < 4; i++) box(g, [0.03, 0.038, 0.009], BLK_K, [0, 0, -0.04 + i * 0.027]);   // parmak olukları
  box(g, [0.03, 0.042, 0.016], C.steel, [0, 0, 0.066], null, M);                     // kafa
  box(g, [0.008, 0.01, 0.06], C.red, [0, -0.026, 0.1], [0.3, 0, 0]);                 // kordon
  box(g, [0.011, 0.062, 0.016], C.steel, [0, 0.0, -0.066], null, M);                 // siper (haç)
  box(g, [0.009, 0.034, 0.15], DARK, [0, 0.004, -0.14], null, M);                    // bıçak gövdesi
  box(g, [0.0095, 0.008, 0.15], C.chrome, [0, -0.016, -0.14], null, { metalness: 0.4, roughness: 0.3 });   // parlak ağız
  box(g, [0.009, 0.026, 0.05], DARK, [0, 0.0, -0.238], [-0.42, 0, 0], M);            // sivri uç (sırttan ağıza doğru iner)
  box(g, [0.0095, 0.007, 0.05], C.chrome, [0, -0.016, -0.236], [-0.42, 0, 0], { metalness: 0.4, roughness: 0.3 });
  for (let i = 0; i < 6; i++) box(g, [0.01, 0.007, 0.007], BLK_K, [0, 0.024, -0.1 - i * 0.017]);   // sırt tırtılı
  return finish(g, {
    name: 'Bıçak', hold: 'melee', gripR: [0, 0, 0.0], gripL: null, muzzle: [0, 0, -0.26], length: 0.34,
  });
}
const BLK_K = '#15161a';

// ───────────────────────── El Bombası ─────────────────────────
function grenade() {
  const g = new THREE.Group();
  ico(g, 0.04, C.olive, [0, 0, 0], 1, [1, 1.25, 1]);
  cylY(g, 0.018, 0.018, 0.025, C.steel, [0, 0.062, 0], 8, null, M);
  box(g, [0.014, 0.012, 0.075], C.steel, [0, 0.07, 0.03], null, M);                  // kol
  box(g, [0.014, 0.075, 0.012], C.steel, [0, 0.03, 0.045], [0.0, 0, 0], M);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 4, 8), new THREE.MeshStandardMaterial({ color: C.chrome, flatShading: true, metalness: 0.5 }));
  ring.position.set(0.02, 0.075, 0.0);
  ring.rotation.y = Math.PI / 2;
  g.add(ring);
  return finish(g, {
    name: 'El Bombası', hold: 'grenade', gripR: [0, 0, 0], gripL: null, muzzle: [0, 0, 0], length: 0.1,
  });
}

export const WEAPONS = {
  ...S3W, mp5, lmg, rpg, knife, grenade, ...MORE, ...PAINTBALL,
};
// s3smg: MP5 / Vector / P90 / MAC-10 / M249 / PKM / M1911 / Desert Eagle / Revolver / RPG-7 S3 kitine geçti (src/models/s3smg.js) → createWeapon S3 yolunu kullanır
for (const id of Object.keys(S3SMG)) S3W[id] = WEAPONS[id] = S3SMG[id];

// s3items: S3 yakın dövüş + atılan / kurulan eşyalar (s3items.js) — createWeapon S3 yolundan kurulur (kaplama = uniform)
import { S3I } from './s3items.js';
Object.assign(S3W, S3I); Object.assign(WEAPONS, S3I);
// /s3items
Object.assign(S3W, S3R); Object.assign(WEAPONS, S3R);   // s3rifles: S3 tüfek / DMR / pompalı / M79 (eski modellerin yerine)

// Görüntüleyici alt yazısı: WSTATS açıklamasından
export const WEAPON_INFO = new Proxy({}, { get: (_, id) => WSTATS[id]?.desc || '' });

// lod: true → uzaktan görünen savaşçı modeli için sadeleştirilmiş silah (köşe renkli / S3 LOD ≤ 600 üçgen, 2-3 çizim çağrısı). skin: S3 silah kaplaması (diğerlerinde yok sayılır)
export function createWeapon(id, optic = 'reddot', lod = false, skin = 'std') {
  const fn = WEAPONS[id];
  if (!fn) throw new Error('Bilinmeyen silah: ' + id);
  const o = resolveOptic(id, optic);
  if (S3W[id]) {                                                         // S3: silah + nişangâh tek Kit'te, kaplama = uniform paleti (3. şahısta (silah, kaplama) başına paylaşılan malzeme)
    const sk = SKIN_IDS.includes(skin) ? skin : 'std';
    const g = S3W[id](skinMaterial(id, sk, lod), lod, o);
    Object.assign(g.userData, { id, optic: o, skin: sk, s3: true });
    return g;
  }
  const g = fn();
  g.userData.id = id;
  g.userData.optic = o;
  const sg = o && o !== 'scope' ? attachSight(g, id, o, lod) : null;
  if (sg) { g.userData.sight = sg.sight; g.userData.dist = sg.dist; g.userData.near = sg.near; g.userData.overlay = sg.overlay; }
  if (sg && o === 'iron') {                                              // demir: nişan sallanması / tepmesi arpacık tepesi çevresinde (arpacık ortada kalır, gez oynar)
    let fz = MOUNT[id].frontZ; g.updateMatrixWorld(true);
    g.traverse((n) => { if (n.userData.frontSight) { const b = new THREE.Box3().setFromObject(n); if (!b.isEmpty()) fz = Math.min(fz ?? 0, b.min.z); } });
    g.userData.pivot = [0, sg.sight[1], fz ?? g.userData.muzzle.z + 0.03];      // arpacık grubu yoksa namlu ucu yakını
  }
  // optik takılıyken ön arpacık nişan çizgisini kapatmasın (demir nişanda ve dürbünsüz silahlarda görünür)
  const showFront = !sg || o === 'iron';
  g.traverse((n) => { if (n.userData.frontSight) n.visible = showFront; });
  if (lod) mergeVC(g, true);
  else { finishWeapon(g); mergeStatic(g); }                              // önce cila (kenar aşınması öznitelikleri + tür malzemesi), sonra malzeme başına birleştirme
  if (sg?.g) g.add(sg.g);                                                // S3 nişangâhı (kendi malzemesi + cam) birleştirmeden sonra
  if (g.userData.mag) {                         // şarjör merkezi (animasyonda sol elin hedefi)
    g.updateMatrixWorld(true);
    g.userData.magPos = new THREE.Box3().setFromObject(g.userData.mag).getCenter(new THREE.Vector3());
  }
  return g;
}
