import { UK } from './us-surface.js';
import { PAL } from './us-kit.js';

// Askeri Üs v3 — araçlar ve hava araçları (yerel +X ileri; b.with ile 90°'nin katı döndür). Gövde kademeleri tekerlek / palet hizasında daralır:
// tekerlek kutusu (çarpışma) ile gövde yüz yüze değer, iç içe girmez. Tekerlek görseli silindir (çarpışma = silindirin AABB'si), cam bandı gövde kutusunun bölünmüşü.
const tag = { tag: 'veh' };
const S = (K, x0, x1, y0, y1, z0, z1, col, kind = UK.STEEL) => K.sr(x0, x1, y0, y1, z0, z1, col, kind, tag);
const sym = (K, x0, x1, y0, y1, za, zb, col, kind) => { S(K, x0, x1, y0, y1, -zb, -za, col, kind); S(K, x0, x1, y0, y1, za, zb, col, kind); };
function wheel(K, x, z, r, w, col = PAL.rubber) {
  K.b.cyl(x, r, z, r, r, w, col, { rx: Math.PI / 2, center: true, seg: 12, kind: UK.RUBBER });
  K.b.cyl(x, r, z + (z > 0 ? w / 2 + 0.01 : -w / 2 - 0.01), r * 0.55, r * 0.55, 0.02, '#4a4e50', { rx: Math.PI / 2, center: true, seg: 10, collide: false, kind: UK.STEEL });
  K.b.collide(x, 0, z, r * 2, r * 2, w, 'veh');
}
// ölçüler: { L, W } ayak izi (fill için)
export const VEH = { humvee: [4.7, 2.3], truck: [8.0, 2.5], apc: [6.4, 2.9], tank: [7.0, 3.5], tanker: [8.6, 2.5], heli: [10, 3], forklift: [3.0, 1.4], sedan: [4.4, 1.85], ambulance: [5.6, 2.3] };

export function humvee(K, x, z, ry = 0, col = PAL.olive, wreck = false) {
  K.b.with(x, 0, z, ry, () => {
    const c = wreck ? '#4a4038' : col, r = 0.44, wz = 0.82, ww = 0.3;
    for (const wx of [1.45, -1.45]) for (const sz of [-1, 1]) wheel(K, wx, sz * (wz + ww / 2), r, ww);
    S(K, -1.0, 0.9, 0.3, 1.15, -1.12, 1.12, c);                                     // orta gövde (tekerlek arası)
    for (const [a, b] of [[0.9, 2.35], [-2.35, -1.0]]) { S(K, a, b, 0.32, 0.9, -wz, wz, c); S(K, a, b, 0.9, a > 0 ? 1.22 : 1.3, -1.12, 1.12, c); }   // tekerlek bölgesi: dar alt + çamurluk
    S(K, -1.0, 0.9, 1.15, 1.42, -1.05, 1.05, c); S(K, -0.95, 0.85, 1.42, 1.76, -1.02, 1.02, '#2a3238', UK.GLASS); S(K, -1.0, 0.9, 1.76, 1.9, -1.05, 1.05, c);
    K.d(2.37, 0.55, 0, 0.04, 0.3, 1.5, '#2a2d30', UK.STEEL);                         // ızgara
    for (const sz of [-0.75, 0.75]) K.lit(2.37, 0.95, sz, 0.03, 0.14, 0.24, '#fff3c4');
    if (!wreck) K.d(-2.37, 0.5, 0, 0.04, 0.5, 0.6, '#3a4030', UK.STEEL);
  });
}
export function truck(K, x, z, ry = 0, col = PAL.olive, cover = PAL.canvas) {
  K.b.with(x, 0, z, ry, () => {
    const r = 0.55, ww = 0.42, wz = 0.82;
    for (const wx of [3.0, -1.4, -2.8]) for (const sz of [-1, 1]) wheel(K, wx, sz * (wz + ww / 2), r, ww);
    S(K, -4.0, 2.2, 0.55, 1.1, -wz, wz, '#2f3236');                                  // şasi (tekerlek arası, dar)
    S(K, -4.0, 1.9, 1.1, 1.3, -1.25, 1.25, col);                                     // kasa tabanı
    S(K, -4.0, 1.9, 1.3, 3.05, -1.24, 1.24, cover, UK.CANVAS);                       // branda
    S(K, 2.2, 3.95, 0.6, 1.1, -wz, wz, col);                                         // kabin altı (tekerlek arası)
    S(K, 1.9, 3.95, 1.1, 1.75, -1.18, 1.18, col); S(K, 1.95, 3.75, 1.75, 2.35, -1.12, 1.12, '#2a3238', UK.GLASS); S(K, 1.9, 3.95, 2.35, 2.6, -1.18, 1.18, col);
    S(K, 3.95, 4.1, 0.6, 1.5, -1.0, 1.0, '#33383a');                                 // ön tampon / ızgara
    for (const sz of [-0.8, 0.8]) K.lit(4.12, 1.15, sz, 0.03, 0.18, 0.26, '#fff3c4');
  });
}
export function ambulance(K, x, z, ry = 0) {
  K.b.with(x, 0, z, ry, () => {
    const r = 0.46, ww = 0.34, wz = 0.82;
    for (const wx of [1.9, -1.7]) for (const sz of [-1, 1]) wheel(K, wx, sz * (wz + ww / 2), r, ww);
    S(K, -2.8, 2.8, 0.35, 0.95, -wz, wz, '#2f3236');
    S(K, -2.8, 1.1, 0.95, 2.7, -1.15, 1.15, '#e6e6e0'); S(K, 1.1, 2.8, 0.95, 1.6, -1.1, 1.1, '#e6e6e0');
    S(K, 1.15, 2.4, 1.6, 2.15, -1.05, 1.05, '#2a3238', UK.GLASS); S(K, 1.1, 2.45, 2.15, 2.3, -1.1, 1.1, '#e6e6e0');
    S(K, -2.8, 1.1, 2.7, 2.78, -0.4, 0.4, PAL.red, UK.PAINT);
    for (const sz of [-1, 1]) { K.d(-0.9, 1.6, sz * 1.165, 0.9, 0.3, 0.03, PAL.red, UK.PAINT); K.d(-0.9, 1.3, sz * 1.165, 0.3, 0.3, 0.03, PAL.red, UK.PAINT); K.d(-0.9, 1.9, sz * 1.165, 0.3, 0.3, 0.03, PAL.red, UK.PAINT); }
    K.lit(1.6, 2.3, 0, 0.3, 0.12, 0.8, '#ff4a3a');
  });
}
export function apc(K, x, z, ry = 0, col = '#5b6648', wreck = false) {
  K.b.with(x, 0, z, ry, () => {
    const c = wreck ? '#4a4038' : col, r = 0.55, ww = 0.42, wz = 1.0;
    for (const wx of [2.2, 0.75, -0.75, -2.2]) for (const sz of [-1, 1]) wheel(K, wx, sz * (wz + ww / 2), r, ww);
    S(K, -3.0, 2.95, 0.45, 1.1, -wz, wz, c);
    S(K, -3.0, 2.5, 1.1, 2.05, -1.45, 1.45, c); S(K, 2.5, 3.2, 1.1, 1.65, -1.3, 1.3, c);
    S(K, -0.7, 0.8, 2.05, 2.55, -0.7, 0.7, wreck ? '#3a332d' : '#4d573c');
    K.d(1.7, 2.22, 0, 1.8, 0.1, 0.1, '#2a2d30', UK.STEEL);                            // top namlusu
    K.d(-3.03, 1.3, 0, 0.06, 0.6, 1.4, '#3a4030', UK.STEEL);
  });
}
export function tankWreck(K, x, z, ry = 0) {
  K.b.with(x, 0, z, ry, () => {
    const c = '#4f4a3e', cd = '#3a362f';
    sym(K, -3.3, 3.3, 0.0, 1.0, 1.12, 1.72, '#2d2b28', UK.RUBBER);                    // paletler
    S(K, -3.2, 3.2, 0.35, 1.0, -1.12, 1.12, cd);                                       // alt gövde (paletler arası)
    S(K, -3.4, 3.4, 1.0, 1.45, -1.78, 1.78, c);                                        // üst gövde + çamurluk
    S(K, -1.5, 1.0, 1.45, 2.3, -1.15, 1.15, cd);                                       // taret
    K.d(2.6, 1.82, 0, 3.2, 0.18, 0.18, '#2a2826', UK.STEEL);                          // namlu (1,72 m üstü)
    K.d(-0.5, 2.3, 0.4, 0.6, 0.12, 0.6, '#2a2826', UK.STEEL);
    for (let i = 0; i < 6; i++) K.d(-2.75 + i * 1.1, 0.25, 1.735, 0.5, 0.5, 0.03, '#454240', UK.STEEL);
  });
}
// yakıt tankeri: kabin + yuvarlak tank (silindir görseli; çarpışma = tankın içinde kalan 3 yatay kuşak, üst üste binmez)
export function tanker(K, x, z, ry = 0, col = '#d8d6cc', cab = PAL.olive) {
  K.b.with(x, 0, z, ry, () => {
    const r = 0.52, ww = 0.42, wz = 0.82;
    for (const wx of [3.2, -1.6, -2.9]) for (const sz of [-1, 1]) wheel(K, wx, sz * (wz + ww / 2), r, ww);
    S(K, -4.2, 2.4, 0.52, 1.05, -wz, wz, '#2f3236');
    S(K, -4.2, 2.1, 1.05, 1.2, -1.2, 1.2, '#3a3e42');
    const R = 1.15, cy = 1.2 + R;
    K.b.cyl(-1.05, cy, 0, R, R, 6.2, col, { rz: Math.PI / 2, center: true, seg: 14, kind: UK.STEEL });
    for (let i = 0; i < 7; i++) { const a = -1 + i * 2 / 7, b = a + 2 / 7, m = (a + b) / 2, hw = R * Math.sqrt(1 - m * m); K.b.collide(-1.05, cy + a * R, 0, 6.2, (b - a) * R, hw * 2, 'veh'); }      // yatay kuşaklar (kiriş ortası)
    K.d(-1.05, cy + R, 0, 5.6, 0.08, 0.5, '#6a6f74', UK.GRATE);
    S(K, 2.4, 4.15, 0.6, 1.05, -wz, wz, cab); S(K, 2.1, 4.15, 1.05, 1.8, -1.18, 1.18, cab); S(K, 2.15, 3.95, 1.8, 2.35, -1.12, 1.12, '#2a3238', UK.GLASS); S(K, 2.1, 4.15, 2.35, 2.6, -1.18, 1.18, cab);
    for (const sz of [-0.8, 0.8]) K.lit(4.17, 1.15, sz, 0.03, 0.18, 0.26, '#fff3c4');
    K.d(-1.05, 2.1, 1.17, 2.2, 0.36, 0.03, PAL.red, UK.PAINT); K.d(-1.05, 2.1, -1.17, 2.2, 0.36, 0.03, PAL.red, UK.PAINT);
  });
}
export function sedanWreck(K, x, z, ry = 0, col = '#6e4a36') {
  K.b.with(x, 0, z, ry, () => {
    const r = 0.32, ww = 0.22, wz = 0.68;
    for (const wx of [1.35, -1.35]) for (const sz of [-1, 1]) wheel(K, wx, sz * (wz + ww / 2), r, ww, '#2b2b2b');
    S(K, -2.2, 2.2, 0.2, 0.64, -wz, wz, '#2f2a26');
    S(K, -2.2, 2.2, 0.64, 1.0, -0.92, 0.92, col); S(K, -1.2, 0.8, 1.0, 1.4, -0.82, 0.82, '#3f5262', UK.GLASS); S(K, -1.2, 0.8, 1.4, 1.5, -0.84, 0.84, col);
  });
}
export function forklift(K, x, z, ry = 0) {
  K.b.with(x, 0, z, ry, () => {
    for (const [wx, r] of [[0.55, 0.3], [-0.6, 0.26]]) for (const sz of [-1, 1]) wheel(K, wx, sz * 0.6, r, 0.2);
    S(K, -0.95, 0.85, 0.25, 1.15, -0.5, 0.5, PAL.yellow, UK.PAINT); S(K, -0.95, -0.55, 1.15, 1.45, -0.5, 0.5, '#3a3e42');
    S(K, 0.85, 1.0, 0.0, 2.4, -0.45, 0.45, '#3a3e42');
    for (const sz of [-0.3, 0.3]) S(K, 1.0, 2.1, 0.06, 0.12, sz - 0.06, sz + 0.06, '#2a2d30');
    for (const [px, pz] of [[0.75, 0.45], [0.75, -0.45]]) K.d(px, 1.15, pz, 0.05, 1.0, 0.05, '#2a2d30', UK.STEEL); for (const pz of [0.45, -0.45]) K.d(-0.9, 1.45, pz, 0.05, 0.7, 0.05, '#2a2d30', UK.STEEL);
    K.d(-0.08, 2.15, 0, 1.75, 0.05, 0.95, '#2a2d30', UK.STEEL);
  });
}
// helikopter (yerde, kızaklı): gövde altı 0,5 m (kızak dikmeleri süs, ince), kuyruk, rotor (süs, 2,6 m üstü)
export function helicopter(K, x, z, ry = 0, col = '#4a5a3a', rotor = 11) {
  K.b.with(x, 0, z, ry, () => {
    for (const sz of [-1.05, 1.05]) { S(K, -1.6, 2.1, 0, 0.08, sz - 0.05, sz + 0.05, '#2a2d30'); for (const px of [-0.9, 1.3]) K.d(px, 0.08, Math.sign(sz) * 0.95, 0.06, 0.42, 0.1, '#2a2d30', UK.STEEL); }
    S(K, -1.8, 2.2, 0.5, 2.25, -0.92, 0.92, col);
    S(K, 2.2, 3.1, 0.7, 1.85, -0.72, 0.72, '#26313a', UK.GLASS);
    S(K, -6.4, -1.8, 1.5, 2.0, -0.26, 0.26, col); S(K, -6.6, -6.0, 2.0, 3.3, -0.08, 0.08, col); S(K, -5.95, -5.35, 2.0, 2.1, -1.2, 1.2, col);
    S(K, -1.0, 1.2, 2.25, 2.55, -0.6, 0.6, '#3a4334');
    K.d(0.1, 2.55, 0, 0.2, 0.25, 0.2, '#2a2d30', UK.STEEL);
    K.d(0.1, 2.8, 0, rotor, 0.05, 0.3, '#2a2d30', UK.STEEL); K.d(0.1, 2.85, 0, 0.3, 0.05, rotor, '#2a2d30', UK.STEEL);
    K.d(-6.3, 2.6, 0.12, 0.08, 1.6, 0.06, '#2a2d30', UK.STEEL);
    for (const sz of [-1, 1]) K.d(0.4, 1.1, sz * 0.935, 1.2, 0.7, 0.03, '#26313a', UK.GLASS);
  });
}
// çift motorlu nakliye uçağı (hangar içi): gövde, burun camı, kanat (2,0–2,2 m: altından geçilir), motor gondolları, kuyruk; iniş takımı tekerlekleri katı
export function transportPlane(K, x, z, ry = 0, col = '#7a838c') {
  K.b.with(x, 0, z, ry, () => {
    S(K, -5.0, 4.6, 1.0, 2.6, -0.8, 0.8, col);
    S(K, 4.6, 5.9, 1.15, 2.35, -0.62, 0.62, col); S(K, 5.9, 6.4, 1.35, 2.05, -0.42, 0.42, '#5b636b');
    K.d(5.15, 2.35, 0, 1.1, 0.18, 1.0, '#26313a', UK.GLASS);
    S(K, -0.8, 1.3, 2.0, 2.2, -6.6, -0.8, col); S(K, -0.8, 1.3, 2.0, 2.2, 0.8, 6.6, col);
    for (const sz of [-1, 1]) { S(K, 0.2, 2.7, 1.45, 2.0, sz > 0 ? 2.55 : -3.35, sz > 0 ? 3.35 : -2.55, '#5b636b'); K.d(2.73, 0.85, sz * 2.95, 0.03, 1.8, 0.18, '#2a2d30', UK.STEEL); K.d(2.76, 1.66, sz * 2.95, 0.03, 0.18, 1.8, '#2a2d30', UK.STEEL); }
    S(K, -6.4, -5.0, 1.6, 2.4, -0.42, 0.42, col); S(K, -6.6, -5.6, 2.4, 2.55, -2.3, 2.3, col); S(K, -6.5, -5.8, 2.55, 4.1, -0.07, 0.07, col);
    for (const [px, pz] of [[4.4, 0], [0.1, -1.6], [0.1, 1.6]]) { S(K, px - 0.28, px + 0.28, 0, 0.56, pz - 0.14, pz + 0.14, PAL.rubber, UK.RUBBER); K.d(px, 0.56, pz, 0.08, (pz ? 1.44 : 0.44), 0.08, '#3a3e42', UK.STEEL); }
    for (const sz of [-1, 1]) K.d(-0.2, 1.75, sz * 0.815, 9.0, 0.16, 0.03, PAL.blue, UK.PAINT);
    K.lit(-6.0, 4.1, 0, 0.12, 0.08, 0.1, '#ff3b2b');
  });
}
