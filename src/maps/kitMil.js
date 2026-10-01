import { COL } from './kit.js';
import { wallRun, placeItem, fillRoom, ITEMS, IC, poolMat, poolDisc } from './kitMilInterior.js';
import { milBuilding, guardTower, garageRow, tunnel, tent, camoNet, radarDish } from './kitMilBuild.js';

// Askeri üs parçaları: hangar, bunker, yakıt tankı, radar, helikopter, helipad, kuleler, tünel, çadır, siper, araçlar, aydınlatma.
// İç mekân fonksiyonları (`interior*`): kitMilInterior.js'deki parçalarla bir dikdörtgeni (oda) doldurur.

const CONC = '#8d9389', CONC_D = '#6f756d', STEEL = '#59606a', OLIVE = '#59623f';

export { milBuilding, guardTower, garageRow, tunnel, tent, camoNet, radarDish, fillRoom, wallRun, placeItem, ITEMS, IC };

// Oda dolduran dış API: interiorBarracks(b, rng, {x0,x1,z0,z1}, y, keeps)
const mk = (kind) => (b, rng, R, y = 0, keeps = []) => fillRoom(b, rng, kind, R, y, keeps);
export const interiorBarracks = mk('barracks');
export const interiorOps = mk('ops');
export const interiorRadio = mk('radio');
export const interiorComputers = mk('computers');
export const interiorArmory = mk('armory');
export const interiorMedical = mk('medical');
export const interiorMess = mk('mess');
export const interiorOffice = mk('office');
export const interiorGenerator = mk('generator');
export const interiorWorkshop = mk('workshop');
export const interiorStore = mk('store');
export const interiorLounge = mk('lounge');

const GL = { glow: true };
const WIN = { glow: true, emissive: '#ffdf9a', roughness: 0.25 };

// ───────── Aydınlatma ─────────
// Işık havuzu: gece parlayan, gündüz zeminle kaynaşan yarı saydam disk (lamba/ateş altında)
export function lightPool(b, x, z, r = 3.2, color = '#ffc66b', y = 0.09, opacity = 0.5) {
  poolDisc(b, x, y, z, r, color, opacity);
}
export function lampPost(b, x, z, { ry = 0, h = 6.2, color = '#ffe2a0', double = false, pool = 3.6 } = {}) {
  b.with(x, 0, z, ry, () => {
    b.cyl(0, 0, 0, 0.09, 0.14, h, '#3f4348', { seg: 6 });
    b.box(0.55, h - 0.2, 0, 1.2, 0.1, 0.14, '#3f4348', { collide: false });
    b.box(1.1, h - 0.3, 0, 0.95, 0.16, 0.5, color, { collide: false, o: GL });
    if (pool) lightPool(b, 1.1, 0, pool);
    if (double) {
      b.box(-0.55, h - 0.2, 0, 1.2, 0.1, 0.14, '#3f4348', { collide: false });
      b.box(-1.1, h - 0.3, 0, 0.95, 0.16, 0.5, color, { collide: false, o: GL });
      if (pool) lightPool(b, -1.1, 0, pool);
    }
  });
}
export function floodLight(b, x, y, z, ry = 0, color = '#fff6d6') {
  b.with(x, y, z, ry, () => {
    b.box(0, 0, 0, 0.1, 0.5, 0.1, '#3f4348', { collide: false });
    b.box(0.2, 0.5, 0, 0.5, 0.35, 0.7, '#2a2d30', { collide: false });
    b.box(0.46, 0.55, 0, 0.05, 0.25, 0.6, color, { collide: false, o: GL });
    if (y > 1) lightPool(b, 3.4, 0, 3.2, '#ffe2a0', 0.09 - y, 0.4);
  });
}
export function bollardLight(b, x, z, color = '#ffd98a') {
  b.cyl(x, 0, z, 0.1, 0.12, 0.9, '#4a4d52', { seg: 6, collide: false });
  b.box(x, 0.9, z, 0.2, 0.14, 0.2, color, { collide: false, o: GL });
}
export function fireBarrel(b, x, z) {
  b.cyl(x, 0, z, 0.32, 0.32, 0.9, '#6a4a3a', { seg: 8 });
  b.box(x, 0.9, z, 0.46, 0.18, 0.46, '#ff8a3d', { collide: false, o: GL });
  b.box(x, 1.08, z, 0.22, 0.2, 0.22, '#ffd27a', { collide: false, o: GL });
}

// ───────── Siperler ─────────
// T-duvar (beton blast duvarı): görüş keser. len x, yatay; ry ile döndür
export function blastWall(b, x, z, len = 6, ry = 0, h = 3.2, t = 0.7) {
  b.with(x, 0, z, ry, () => {
    b.box(0, 0, 0, len, h, t, '#8a9087');
    b.box(0, 0, 0, len + 0.1, 0.5, t + 0.5, '#757b72');
    b.box(0, h, 0, len + 0.1, 0.1, t + 0.12, '#a2a79e', { collide: false });
    for (let i = 0; i < Math.floor(len / 1.5); i++) b.box(-len / 2 + 0.75 + i * 1.5, 0.5, t / 2 + 0.01, 0.04, h - 0.7, 0.02, '#6f756d', { collide: false });
  });
}
// Hesco / kum dolu sepet
export function hesco(b, x, z, len = 4, ry = 0, h = 1.4) {
  b.with(x, 0, z, ry, () => {
    const n = Math.max(1, Math.round(len / 1.1));
    const s = len / n;
    for (let i = 0; i < n; i++) {
      b.box(-len / 2 + s / 2 + i * s, 0, 0, s - 0.04, h, 0.9, i % 2 ? '#b6a47a' : '#aa986f', { collide: false });
      b.box(-len / 2 + s / 2 + i * s, h, 0, s - 0.04, 0.05, 0.9, '#5a5d44', { collide: false });
    }
    b.collide(0, 0, 0, len, h, 0.9);
  });
}
// Kum torbası mevzisi + makineli tüfek (U şekli, açık yüz +Z)
export function mgNest(b, x, z, ry = 0, color = '#a89468') {
  b.with(x, 0, z, ry, () => {
    const bag = (px, pz, w, d) => {
      for (let r = 0; r < 3; r++) b.box(px, r * 0.32, pz, w - (r % 2) * 0.1, 0.32, d, r % 2 ? '#a89468' : '#b3a073', { collide: false });
      b.collide(px, 0, pz, w, 0.96, d);
    };
    bag(0, -0.9, 2.8, 0.6); bag(-1.15, 0, 0.6, 1.4); bag(1.15, 0, 0.6, 1.4);
    b.box(0, 0.96, -0.5, 0.12, 0.45, 0.12, '#2a2d30', { collide: false });
    b.box(0, 1.3, -0.5, 0.2, 0.2, 1.1, '#2a2d30', { collide: false });
    b.box(0, 1.32, 0.3, 0.1, 0.1, 0.5, '#3a3a34', { collide: false });
    b.box(-0.45, 0, -0.2, 0.7, 0.5, 0.4, OLIVE, { collide: false });
  });
}
// Hendek siperi: iki kum torbası hattı + traverse (içinden yürünebilir koridor)
export function trench(b, x0, z0, x1, z1, gap = 2.0) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  b.with(cx, 0, cz, alongX ? 0 : Math.PI / 2, () => {
    b.box(0, 0, 0, len, 0.04, gap, '#4a3f2e', { collide: false });
    for (let k = 0; k < Math.floor(len / 1.3); k++) b.box(-len / 2 + 0.65 + k * 1.3, 0.045, 0, 0.9, 0.02, gap - 0.4, '#6a5436', { collide: false });
    for (const sz of [-1, 1]) {
      const zz = sz * (gap / 2 + 0.3);
      for (let r = 0; r < 3; r++) b.box(0, r * 0.32, zz, len - (r % 2) * 0.4, 0.32, 0.6, r % 2 ? '#a89468' : '#b3a073', { collide: false });
      // 1.4 m'lik kesintilerle parça parça çarpışma (içeri geçit)
      const segs = Math.floor(len / 5);
      for (let i = 0; i < segs; i++) b.collide(-len / 2 + (i + 0.5) * (len / segs) , 0, zz, len / segs - 0.01, 0.96, 0.6);
    }
  });
}
export function pool(b, x, z, w, d, color = '#3f6f8f') {
  b.box(x, 0, z, w + 1.0, 0.3, d + 1.0, '#8a9087', { collide: false });
  b.box(x, 0.3, z, w, 0.02, d, color, { collide: false, o: { transparent: true, opacity: 0.8, roughness: 0.1 } });
  b.box(x, 0.28, z, w, 0.02, d, '#2f4f66', { collide: false });
  // alçak kenar çarpışması (nav görmezden gelir, oyuncu üstünden geçer)
}
// Zincir çit (görüş açık, geçiş kapalı; kapı boşlukları `gaps` ile). a: eksen boyunca ofset aralıkları
export function fenceRow(b, x0, z0, x1, z1, { h = 2.2, gaps = [], color = '#6a6f74' } = {}) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const c = alongX ? z0 : x0;
  const pts = [a0, ...gaps.flatMap((g) => [g[0], g[1]]), a1];
  for (let i = 0; i < pts.length; i += 2) {
    const s = pts[i], e = pts[i + 1];
    if (e - s < 0.2) continue;
    const mid = (s + e) / 2, len = e - s;
    const n = Math.max(1, Math.round(len / 2.5));
    for (let k = 0; k <= n; k++) {
      const p = s + (len / n) * k;
      if (alongX) b.box(p, 0, c, 0.1, h, 0.1, '#4a4d52', { collide: false }); else b.box(c, 0, p, 0.1, h, 0.1, '#4a4d52', { collide: false });
    }
    if (alongX) {
      b.box(mid, 0.1, c, len, h - 0.2, 0.03, color, { collide: false, o: { transparent: true, opacity: 0.35 } });
      b.box(mid, h - 0.05, c, len, 0.06, 0.08, '#4a4d52', { collide: false });
      b.collide(mid, 0, c, len, h, 0.15);
    } else {
      b.box(c, 0.1, mid, 0.03, h - 0.2, len, color, { collide: false, o: { transparent: true, opacity: 0.35 } });
      b.box(c, h - 0.05, mid, 0.08, 0.06, len, '#4a4d52', { collide: false });
      b.collide(c, 0, mid, 0.15, h, len);
    }
  }
}
export function flagPole(b, x, z, color = '#2b6fd6') {
  b.cyl(x, 0, z, 0.06, 0.1, 7.5, '#9aa0a8', { seg: 6 });
  b.box(x + 0.85, 5.6, z, 1.6, 1.0, 0.04, color, { collide: false });
  b.box(x + 0.85, 5.6, z, 0.5, 0.5, 0.05, '#e8e8e4', { collide: false });
}
export function signBoard(b, x, z, ry, w, h, color, textColor = '#ffffff', y = 1.2) {
  b.with(x, 0, z, ry, () => {
    b.box(0, 0, 0, 0.1, y + 0.2, 0.1, '#4a4d52', { collide: false });
    b.box(0, y, 0, w, h, 0.08, color, { collide: false });
    b.box(0, y + h * 0.35, 0.05, w * 0.7, h * 0.18, 0.02, textColor, { collide: false });
  });
}
// Toprak yığını / siper tepeciği (görsel)
export function berm(b, x, z, w = 8, h = 1.4, d = 3, ry = 0, color = '#5c6a3e') {
  b.ico(x, 0, z, 1, color, { scale: [w / 2, h, d / 2], detail: 1, ry });
}

// ───────── Hangar (+Z yüzü açık; yerel çerçeve → ry ile döner) ─────────
// Çatı katlı değil; iç: asma kat (merdivenli), vinç rayı, sütunlar, tezgâhlar, tavan lambaları.
export function hangar(b, rng, { x, z, ry = 0, w = 30, d = 18, openW = 14, color = '#7d857f', H = 8, mezz = true, backDoors = true, label = null, mezzLen = null }) {
  const T = 0.5;
  b.with(x, 0, z, ry, () => {
    const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
    b.box(0, 0, 0, w - 0.5, 0.05, d - 0.5, '#5f6468', { collide: false });
    for (let i = -2; i <= 2; i++) b.box(i * 5, 0.06, 0, 0.18, 0.01, d - 2, '#d9a921', { collide: false });
    const sideDoor = [{ at: 0, w: 2.4, b: 0, top: 2.6 }, { at: d / 4 + 1, w: 2.4, b: 0, top: 2.6 }];
    const hiWin = (len, c) => { const out = []; for (let i = -3; i <= 3; i++) { const at = c + i * (len / 7.5); out.push({ at, w: 1.8, b: 5.6, top: 6.7 }); } return out; };
    // ön (+z): büyük kapı + yan kapılar
    b.wall('x', x0, x1, z1 - T / 2, 0, H, T, color, [{ at: 0, w: openW, b: 0, top: 6.4 }, { at: -(openW / 2 + 3.5), w: 2.2, b: 0, top: 2.5 }, { at: openW / 2 + 3.5, w: 2.2, b: 0, top: 2.5 }]);
    // arka (-z)
    b.wall('x', x0, x1, z0 + T / 2, 0, H, T, color, [...(backDoors ? [{ at: -9, w: 2.4, b: 0, top: 2.6 }, { at: 9, w: 2.4, b: 0, top: 2.6 }] : []), ...hiWin(w, 0).filter((o) => !backDoors || (Math.abs(o.at + 9) > 2 && Math.abs(o.at - 9) > 2))]);
    // yan duvarlar
    b.wall('z', z0 + T, z1 - T, x0 + T / 2, 0, H, T, color, [...sideDoor, ...hiWin(d, 0).filter((o) => Math.abs(o.at) > 2.5 && Math.abs(o.at - (d / 4 + 1)) > 2.5)]);
    b.wall('z', z0 + T, z1 - T, x1 - T / 2, 0, H, T, color, [...sideDoor, ...hiWin(d, 0).filter((o) => Math.abs(o.at) > 2.5 && Math.abs(o.at - (d / 4 + 1)) > 2.5)]);
    // yüksek pencereler: ışıklı
    for (let i = -3; i <= 3; i++) {
      const at = i * (w / 7.5);
      b.box(at, 5.6, z0 + T / 2, 1.8, 1.1, 0.07, '#2c3d49', { collide: false, o: WIN });
      const az = i * (d / 7.5);
      for (const sx of [x0 + T / 2, x1 - T / 2]) if (Math.abs(az) > 2.5 && Math.abs(az - (d / 4 + 1)) > 2.5) b.box(sx, 5.6, az, 0.07, 1.1, 1.8, '#2c3d49', { collide: false, o: WIN });
    }
    // çatı: düz plaka + hafif kemer
    b.box(0, H - 0.3, 0, w, 0.3, d, CONC_D);
    b.prism(0, H, 0, d + 1, 1.8, w + 1, '#6c737b', { ry: Math.PI / 2 });
    b.box(0, 6.4, z1 + 0.28, openW + 1, 0.5, 0.08, '#d9a921', { collide: false });
    b.box(-openW / 2 - 0.5, 0, z1 + 0.4, 1.0, H, 0.5, STEEL, { collide: false });
    b.box(openW / 2 + 0.5, 0, z1 + 0.4, 1.0, H, 0.5, STEEL, { collide: false });
    if (label) b.box(0, 7.0, z1 + 0.3, 3.5, 0.8, 0.06, label, { collide: false });
    // iç sütunlar + vinç rayı
    for (const [px, pz] of [[-w / 2 + 3, -d / 2 + 4], [w / 2 - 3, -d / 2 + 4], [-w / 2 + 3, d / 2 - 3.5], [w / 2 - 3, d / 2 - 3.5], [-6.5, -1.5], [6.5, -1.5]]) b.box(px, 0, pz, 0.6, H - 0.3, 0.6, STEEL);
    for (const pz of [-d / 2 + 4, d / 2 - 3.5]) b.box(0, 6.6, pz, w - 0.6, 0.35, 0.35, '#c58a1f', { collide: false });
    b.box(-3, 6.2, 0, 0.5, 0.5, d - 0.6, STEEL, { collide: false });
    b.box(-3, 5.2, -1.5, 0.5, 1.0, 0.5, '#d9a921', { collide: false });
    b.box(-3, 4.8, -1.5, 0.08, 0.4, 0.08, '#2a2d30', { collide: false });
    // tavan lambaları
    for (const lx of [-10, -3.5, 3.5, 10]) for (const lz of [-3.5, 3.5]) b.box(lx, H - 0.8, lz, 1.4, 0.12, 0.5, '#fff3c4', { collide: false, o: GL });
    for (const lx of [-10, -3.5, 3.5, 10]) for (const lz of [-3.5, 3.5]) lightPool(b, lx, lz, 3.4, '#ffe9b0', 0.09, 0.4);
    // asma kat (mezzanine): arka duvar boyunca, doğu uçtan merdivenli
    if (mezz) {
      const mx0 = -w / 2 + 2, mx1 = mx0 + (mezzLen ?? (w - 11.6)), mz0 = z0 + T, mz1 = z0 + T + 3.0, my = 3.0;
      b.box((mx0 + mx1) / 2, my - 0.3, (mz0 + mz1) / 2, mx1 - mx0, 0.3, mz1 - mz0, '#6f756d');
      for (const px of [mx0 + 0.3, (mx0 + mx1) / 2, mx1 - 0.3]) b.box(px, 0, mz1 - 0.2, 0.3, my - 0.3, 0.3, STEEL, { collide: false });
      b.box((mx0 + mx1) / 2, my, mz1 - 0.1, mx1 - mx0, 1.0, 0.12, '#7d867c');      // ön korkuluk (siper)
      b.box(mx0 + 0.1, my, (mz0 + mz1) / 2, 0.12, 1.0, mz1 - mz0, '#7d867c');
      b.box((mx0 + mx1) / 2, my + 1.0, mz1 - 0.1, mx1 - mx0, 0.07, 0.2, '#d9a921', { collide: false });
      b.stairs(mx1 + 4.5, mz0 + 0.9, 0, '-x', 1.4, 15, my / 15, 0.3, '#8b8f88');
      b.box(mx1 + 2.25, my - 0.02 - 1.0, mz0 + 1.65, 4.5, 0.05, 0.1, '#d9a921', { collide: false });
      // asma kat üstü: masa + dolap
      b.box(mx0 + 5, my, mz0 + 0.5, 1.6, 0.8, 0.8, IC.wood); b.box(mx0 + 9, my, mz0 + 0.45, 1.2, 1.9, 0.5, IC.woodD); b.box(mx0 + 2.5, my, mz0 + 0.6, 1.0, 0.9, 1.0, IC.olive);
      b.box(mx1 - 2.5, my, mz0 + 0.5, 1.4, 0.9, 1.0, IC.wood);
      // asma kat altı: tezgâhlar
      const ctx = { y: 0, rects: [{ x0: mx1 - 0.5, x1: mx1 + 5.5, z0: mz0, z1: mz0 + 2.2 }], bounds: { x0: mx0, x1: mx1, z0: mz0, z1: z0 + 6 } };
      wallRun(b, ctx, { x0: mx0, x1: mx1, z0: mz0, z1: z0 + 6 }, 'n', ['workbench', 'shelf', 'workbench', 'tires', 'workbench'], rng, { start: 0.3 });
    }
  });
}

// ───────── Helikopter ─────────
export function helicopter(b, { x, z, ry = 0, color = '#4a5a3a' }) {
  b.with(x, 0, z, ry, () => {
    b.box(0, 0.5, 0, 4.4, 1.9, 1.9, color);                                   // gövde
    b.box(0.2, 1.1, 0, 3.0, 1.0, 1.7, '#9fc3d6', { collide: false, o: { transparent: true, opacity: 0.55 } });
    b.box(-3.6, 1.0, 0, 3.4, 0.45, 0.4, color, { collide: false });          // kuyruk
    b.box(-5.2, 1.0, 0, 0.3, 1.5, 0.15, color, { collide: false });
    b.box(0, 2.4, 0, 0.5, 0.4, 0.5, STEEL, { collide: false });              // rotor göbeği
    b.box(0, 2.78, 0, 9.2, 0.07, 0.35, '#2a2d30', { collide: false });
    b.box(0, 2.78, 0, 0.35, 0.07, 9.2, '#2a2d30', { collide: false });
    for (const sz of [-0.85, 0.85]) b.box(0, 0, sz, 3.4, 0.1, 0.12, STEEL, { collide: false });
    b.box(2.2, 0.9, 0, 0.1, 0.18, 0.5, '#fff6d6', { collide: false, o: GL });
    b.box(-5.2, 2.3, 0, 0.12, 0.14, 0.12, '#ff3b2b', { collide: false, o: GL });
  });
}

// Nakliye uçağı (dekor + gövde çarpışması): ön +X
export function plane(b, { x, z, ry = 0, color = '#6b7480' }) {
  b.with(x, 0, z, ry, () => {
    b.box(0, 0.7, 0, 9.0, 1.9, 2.2, color);
    b.box(4.3, 1.2, 0, 1.6, 1.2, 1.7, '#9fc3d6', { collide: false, o: { transparent: true, opacity: 0.55 } });
    b.box(-5.5, 1.2, 0, 3.0, 0.9, 1.4, color, { collide: false });
    b.box(-6.6, 1.9, 0, 0.12, 2.0, 0.12 + 0.2, color, { collide: false });
    b.box(-6.3, 1.8, 0, 1.2, 0.1, 5.0, color, { collide: false });
    b.box(0.5, 1.5, 0, 2.2, 0.18, 12.5, color, { collide: false });                // kanat
    b.collide(0.5, 0, 0, 2.2, 1.6, 2.4);
    for (const sz of [-3.6, 3.6]) { b.box(1.5, 0.8, sz, 1.4, 0.7, 0.7, '#4a5058', { collide: false }); b.box(2.3, 0.8, sz, 0.1, 0.5, 0.5, '#2a2d30', { collide: false }); }
    for (const [wx, wz] of [[3, 0], [-1, -1.2], [-1, 1.2]]) b.cyl(wx, 0.35, wz, 0.35, 0.35, 0.3, '#1c1c1e', { rx: Math.PI / 2, center: true, seg: 8, collide: false });
    b.box(0, 1.2, 0, 8.6, 0.08, 2.24, '#d9a921', { collide: false });
    b.box(-6.6, 3.0, 0, 0.12, 0.14, 0.12, '#ff3b2b', { collide: false, o: GL });
  });
}

// ───────── Helipad ─────────
export function helipad(b, { x, z, r = 7, lights = true }) {
  b.cyl(x, 0, z, r, r, 0.07, '#4e5358', { seg: 24, collide: false });
  b.cyl(x, 0.07, z, r - 0.7, r - 0.7, 0.02, '#d9a921', { seg: 24, collide: false });
  b.cyl(x, 0.09, z, r - 1.1, r - 1.1, 0.02, '#4e5358', { seg: 24, collide: false });
  b.box(x - 1.4, 0.1, z, 0.5, 0.02, 3.6, '#e8e8e4', { collide: false });
  b.box(x + 1.4, 0.1, z, 0.5, 0.02, 3.6, '#e8e8e4', { collide: false });
  b.box(x, 0.1, z, 2.9, 0.02, 0.5, '#e8e8e4', { collide: false });
  if (lights) for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.box(x + Math.cos(a) * (r + 0.3), 0, z + Math.sin(a) * (r + 0.3), 0.4, 0.22, 0.4, i % 3 === 0 ? '#ff5a43' : '#7dd0ff', { collide: false, o: GL });
  }
}

// ───────── Bunker (ön yüz −Z, kapı arkada) ─────────
export function bunker(b, { x, z, ry = 0, w = 6, d = 4 }) {
  b.with(x, 0, z, ry, () => {
    const H = 2.5, T = 0.6;
    b.wall('x', -w / 2, w / 2, -d / 2, 0, H, T, CONC, [{ at: 0, w: 3.0, b: 1.2, top: 1.7 }]);
    b.wall('x', -w / 2, w / 2, d / 2, 0, H, T, CONC, [{ at: 1.2, w: 1.8, b: 0, top: 2.2 }, { at: -1.6, w: 1.8, b: 0, top: 2.2 }]);
    b.box(-w / 2 + T / 2, 0, 0, T, H, d + T, CONC_D);
    b.box(w / 2 - T / 2, 0, 0, T, H, d + T, CONC_D);
    b.box(0, H, 0, w + 0.6, 0.45, d + 0.6, CONC);                              // çatı
    b.ico(0, H + 0.45, 0, 3.4, '#5c6a3e', { scale: [1.0, 0.22, 0.75], detail: 1 });  // toprak örtü
    b.box(0, 0, 0, w - 2 * T, 0.05, d - 2 * T, '#55595c', { collide: false });
    b.box(0, 1.5, -d / 2 + 0.34, 2.4, 0.04, 0.02, '#ff5a43', { collide: false, o: GL });
    b.box(-1.8, 0, -0.6, 1.0, 0.5, 0.6, OLIVE); b.box(1.8, 0, -0.6, 1.0, 0.5, 0.6, '#7b8660');
  });
}

// ───────── Yakıt tankı ─────────
export function fuelTank(b, { x, z, r = 3, h = 5, color = '#cfd2cc' }) {
  b.cyl(x, 0, z, r, r, h, color, { seg: 14 });
  b.cyl(x, h, z, r * 0.72, r, 0.6, color, { seg: 14, collide: false });
  b.cyl(x, h + 0.6, z, 0.35, 0.35, 0.4, STEEL, { seg: 8, collide: false });
  b.cyl(x, h * 0.55, z, r + 0.05, r + 0.05, 0.35, '#c0392b', { seg: 14, collide: false });
  b.box(x + r + 0.05, 0, z, 0.1, h, 0.5, STEEL, { collide: false });          // merdiven
  b.box(x, 0, z, r * 2 + 1.2, 0.08, r * 2 + 1.2, '#55595c', { collide: false });
}
// Akaryakıt tankeri (+X ileri)
export function tanker(b, { x, z, ry = 0, color = '#a8aaa4', cab = '#2f4f7a' }) {
  b.with(x, 0, z, ry, () => {
    b.box(3.4, 0.55, 0, 2.0, 2.0, 2.4, cab, { collide: false });
    b.box(3.9, 1.5, 0, 1.1, 0.8, 2.42, '#22333f', { collide: false });
    b.cyl(-0.7, 1.55, 0, 1.25, 1.25, 7.4, color, { rz: Math.PI / 2, center: true, seg: 12, collide: false });
    b.cyl(-0.7, 1.55, 0, 1.3, 1.3, 0.35, '#c0392b', { rz: Math.PI / 2, center: true, seg: 12, collide: false });
    b.box(-0.7, 2.7, 0, 0.9, 0.25, 0.9, STEEL, { collide: false });
    for (const wx of [-3.5, -2.2, 3.2]) for (const wz of [-1.1, 1.1]) b.cyl(wx, 0.5, wz, 0.5, 0.5, 0.4, '#1c1c1e', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
    b.collide(0.1, 0, 0, 8.6, 2.9, 2.5);
  });
}
// Zırhlı personel taşıyıcı (+X ileri); wreck → yanık/hurda renk
export function apc(b, { x, z, ry = 0, color = '#566246', wreck = false }) {
  b.with(x, 0, z, ry, () => {
    const c = wreck ? '#4d4338' : color;
    b.box(0, 0.35, 0, 5.2, 1.5, 2.6, c);
    b.box(2.5, 0.9, 0, 0.9, 0.8, 2.4, c, { collide: false });
    b.box(-0.2, 1.85, 0, 2.2, 0.55, 1.7, wreck ? '#3d352c' : '#4a5640');
    b.box(1.5, 2.0, 0, 2.2, 0.14, 0.14, '#2a2d30', { collide: false });
    for (const sz of [-1.35, 1.35]) { b.box(0, 0.1, sz, 4.8, 0.55, 0.3, '#26282b', { collide: false }); for (let i = 0; i < 4; i++) b.cyl(-1.8 + i * 1.2, 0.35, sz * 1.0, 0.4, 0.4, 0.3, '#1c1c1e', { rx: Math.PI / 2, center: true, seg: 8, collide: false }); }
    if (wreck) b.box(-1.2, 1.85, 0.3, 1.2, 0.12, 1.0, '#2a2420', { collide: false });
  });
}
// Tank (hurda/dekor siperi): +X namlu
export function tank(b, { x, z, ry = 0, color = '#566246', wreck = true }) {
  b.with(x, 0, z, ry, () => {
    const c = wreck ? '#51493c' : color;
    b.box(0, 0.5, 0, 6.2, 1.3, 3.2, c);
    b.box(0, 0.1, -1.55, 6.4, 0.9, 0.5, '#26282b', { collide: false }); b.box(0, 0.1, 1.55, 6.4, 0.9, 0.5, '#26282b', { collide: false });
    b.box(-0.3, 1.8, 0, 2.8, 0.9, 2.4, wreck ? '#463e33' : '#4a5640');
    b.box(2.4, 2.1, 0.0, 3.8, 0.28, 0.28, '#2a2d30', { collide: false });
    if (wreck) { b.box(-0.8, 2.7, 0.4, 1.0, 0.25, 0.9, '#2a2420', { collide: false }); b.box(0.8, 0.0, 1.9, 1.0, 0.7, 0.6, '#3d352c', { collide: false }); }
  });
}
export function ambulance(b, { x, z, ry = 0 }) {
  b.with(x, 0, z, ry, () => {
    b.box(2.0, 0.5, 0, 1.8, 1.7, 2.3, '#f2f2ee', { collide: false });
    b.box(2.5, 1.45, 0, 0.9, 0.7, 2.32, '#22333f', { collide: false });
    b.box(-0.6, 0.55, 0, 3.8, 2.4, 2.4, '#f2f2ee', { collide: false });
    b.box(-0.6, 1.5, 1.21, 0.9, 0.9, 0.04, '#c0392b', { collide: false }); b.box(-0.6, 1.5, 1.23, 0.3, 0.9, 0.04, '#fff', { collide: false });
    b.box(-0.6, 1.5, -1.21, 0.9, 0.9, 0.04, '#c0392b', { collide: false });
    b.box(2.0, 2.2, 0, 0.3, 0.18, 1.0, '#ff3b2b', { collide: false, o: GL });
    b.box(2.0, 2.2, 0.5, 0.3, 0.18, 0.3, '#3b8bff', { collide: false, o: GL });
    for (const wx of [-1.4, 2.2]) for (const wz of [-1.1, 1.1]) b.cyl(wx, 0.4, wz, 0.4, 0.4, 0.3, '#1c1c1e', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
    b.collide(0.4, 0, 0, 6.0, 2.9, 2.5);
  });
}
export function jeep(b, { x, z, ry = 0, color = '#5e6b4a' }) {
  b.with(x, 0, z, ry, () => {
    b.box(0, 0.35, 0, 3.6, 0.7, 1.8, color, { collide: false });
    b.box(-0.2, 1.05, 0, 1.6, 0.55, 1.6, color, { collide: false });
    b.box(-0.2, 1.1, 0, 1.64, 0.4, 1.66, '#22333f', { collide: false, o: { roughness: 0.2 } });
    b.box(1.5, 0.55, 0, 0.8, 0.3, 1.7, color, { collide: false });
    for (const wx of [-1.2, 1.2]) for (const wz of [-0.95, 0.95]) b.cyl(wx, 0.38, wz, 0.38, 0.38, 0.3, '#1c1c1e', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
    b.box(1.85, 0.6, 0.6, 0.06, 0.18, 0.3, '#fff2b0', { collide: false, o: GL }); b.box(1.85, 0.6, -0.6, 0.06, 0.18, 0.3, '#fff2b0', { collide: false, o: GL });
    b.collide(0, 0, 0, 3.8, 1.5, 1.85);
  });
}

// Yükseltilmiş boru hattı (altından geçilebilir): x0,z0 → x1,z1 (eksene paralel), direkler çarpışmalı
export function pipeRack(b, x0, z0, x1, z1, { y = 2.6, color = '#c0392b', n = 2, spacing = 6 } = {}) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  b.with(cx, 0, cz, alongX ? 0 : Math.PI / 2, () => {
    for (let i = 0; i < n; i++) b.cyl(0, y + i * 0.5, (i - (n - 1) / 2) * 0.5, 0.18, 0.18, len, i % 2 ? '#9aa0a8' : color, { rz: Math.PI / 2, center: true, seg: 8, collide: false });
    for (let k = 0; k * spacing <= len; k++) {
      const px = -len / 2 + k * spacing;
      b.box(px, 0, 0, 0.3, y - 0.2, 0.3, '#4a4d52');
      b.box(px, y - 0.25, 0, 0.3, 0.12, 1.4, '#4a4d52', { collide: false });
    }
  });
}
// Yer boru hattı (alçak, geçit boşlukları gaps: [[a0,a1],...])
export function pipeLow(b, x0, z0, x1, z1, { color = '#c0392b', gaps = [] } = {}) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const c = alongX ? z0 : x0;
  const pts = [a0, ...gaps.flatMap((g) => [g[0], g[1]]), a1];
  for (let i = 0; i < pts.length; i += 2) {
    const s = pts[i], e = pts[i + 1];
    if (e - s < 0.3) continue;
    const mid = (s + e) / 2, len = e - s;
    if (alongX) { b.cyl(mid, 0.3, c, 0.22, 0.22, len, color, { rz: Math.PI / 2, center: true, seg: 8, collide: false }); b.collide(mid, 0, c, len, 0.55, 0.5); }
    else { b.cyl(c, 0.3, mid, 0.22, 0.22, len, color, { rx: Math.PI / 2, center: true, seg: 8, collide: false }); b.collide(c, 0, mid, 0.5, 0.55, len); }
  }
}

// ───────── Radar kulesi (iç mekânlı, merdivenli; çatıda tabak) ─────────
// 10×10, 3 kat; kapılar güney ve doğu. Giriş katında telsiz/radar odası, üstte operasyon, en üstte çatı.
export function radarTower(b, rng, { x, z, w = 10, d = 10, fh = 3.2, wall = '#98a097', roof = '#585d62' }) {
  const hw = w / 2 - 0.35, hd = d / 2 - 0.35;
  const sw = 1.3;
  const R = milBuilding(b, rng, {
    x, z, w, d, floors: 3, fh, wall, roof, floorColor: '#6d726c', dw: 2.0,
    doors: { s: [-2.6, 2.4], e: [-2.0], w: [2.6] },
    stairs: [
      { x: -hw + sw / 2 + 0.1, z: -hd + 1.2, dir: '+z', w: sw },
      { x: -hw + sw / 2 + 2.35, z: hd - 1.2, dir: '-z', w: sw },
      { x: -hw + sw / 2 + 0.1, z: -hd + 1.2, dir: '+z', w: sw },
    ],
    parts: [
      { axis: 'z', c: -hw + 4.1, a0: -d / 2 + 0.35, a1: d / 2 - 0.35, doors: [{ at: -3.4, w: 1.8 }, { at: 2.4, w: 1.8 }] },
    ],
    rooms: [
      { f: 0, kind: 'radio', x0: -hw + 4.1, x1: w / 2 - 0.35, z0: -d / 2 + 0.35, z1: d / 2 - 0.35 },
      { f: 1, kind: 'ops', x0: -hw + 4.1, x1: w / 2 - 0.35, z0: -d / 2 + 0.35, z1: d / 2 - 0.35 },
      { f: 2, kind: 'computers', x0: -hw + 4.1, x1: w / 2 - 0.35, z0: -d / 2 + 0.35, z1: d / 2 - 0.35 },
    ],
    winStyle: { 2: 'wide' },
  });
  // çatı: tabak kaidesi, tabak, işaret ışığı, siper kasaları
  const H = R.H;
  b.box(x + 1.5, H, z - 0.5, 2.4, 1.6, 2.4, STEEL);
  b.box(x + 1.5, H + 1.6, z - 0.5, 2.6, 0.15, 2.6, '#454a50', { collide: false });
  b.cyl(x + 1.5, H + 1.75, z - 0.5, 0.35, 0.45, 1.3, '#9aa0a8', { seg: 8, collide: false });
  b.with(x + 1.5, H + 3.0, z - 0.5, 0.5, () => {
    b.cyl(0.5, 0, 0, 3.2, 0.4, 0.6, '#e0e3de', { seg: 14, rz: Math.PI / 2 - 0.55, center: true, collide: false });
    b.box(1.8, 0.5, 0, 0.12, 1.5, 0.12, '#9aa0a8', { collide: false });
    b.box(1.8, 2.1, 0, 0.25, 0.25, 0.25, '#ff2b2b', { collide: false, o: GL });
  });
  b.box(x - 3.4, H, z + 3.2, 0.2, 3.2, 0.2, '#2a2d30', { collide: false });
  b.box(x - 3.4, H + 3.2, z + 3.2, 0.2, 0.2, 0.2, '#ff2b2b', { collide: false, o: GL });
  b.box(x - 2.0, H, z + 2.8, 1.2, 1.0, 1.0, '#7b8660');
  return R;
}

// ───────── Kontrol kulesi (3 kat + camlı kabin) ─────────
export function controlTower(b, rng, { x, z, w = 7, d = 7, fh = 3.3, wall = '#a2a79e', roof = '#585d62', door = 's' }) {
  const hw = w / 2 - 0.35, hd = d / 2 - 0.35, sw = 1.3;
  const doors = { n: [], s: [], e: [], w: [] }; doors[door] = [0];
  const R = milBuilding(b, rng, {
    x, z, w, d, floors: 3, fh, wall, roof, floorColor: '#70746e', dw: 2.0, doors,
    stairs: [
      { x: -hw + sw / 2 + 0.05, z: -hd + 1.0, dir: '+z', w: sw, rise: 0.22, run: 0.27 },
      { x: hw - sw / 2 - 0.05, z: hd - 1.0, dir: '-z', w: sw, rise: 0.22, run: 0.27 },
      { x: -hw + sw / 2 + 0.05, z: -hd + 1.0, dir: '+z', w: sw, rise: 0.22, run: 0.27 },
    ],
    rooms: [
      { f: 0, kind: 'radio', x0: -w / 2 + 0.35, x1: w / 2 - 0.35, z0: -d / 2 + 0.35, z1: d / 2 - 0.35 },
      { f: 1, kind: 'ops', x0: -w / 2 + 0.35, x1: w / 2 - 0.35, z0: -d / 2 + 0.35, z1: d / 2 - 0.35 },
      { f: 2, kind: 'computers', x0: -w / 2 + 0.35, x1: w / 2 - 0.35, z0: -d / 2 + 0.35, z1: d / 2 - 0.35 },
    ],
    winStyle: { 2: 'wide' },
  });
  const H = R.H;
  b.box(x, H + 0.02, z, 0.6, 2.6, 0.6, STEEL, { collide: false });
  b.box(x, H + 2.6, z, 0.12, 2.0, 0.12, '#2a2d30', { collide: false });
  b.box(x, H + 4.6, z, 0.2, 0.2, 0.2, '#ff2b2b', { collide: false, o: GL });
  b.box(x + 1.4, H, z + 1.2, 1.0, 0.9, 1.0, '#7b8660');
  return R;
}

export { CONC, CONC_D, STEEL, OLIVE };
