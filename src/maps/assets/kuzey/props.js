import { KK } from './surface.js';
import { Q, roundCollide, shade, lw, ctxAdd } from '../common/kuzeyKit.js';
import { car, truck } from '../../vehicles.js';

// Kuzey Vadisi küçük parçalar (12.172): ahşap çit, taş duvar, kütük yığını, sandık / palet, varil, saman balyası, sokak lambası, yol bariyeri, araç enkazı.
// Çarpışan çit / duvar yalnız eksen hizalı; her parça araziyi örnekler (eğimde kademeli oturur, havada ucu kalmaz).

// ahşap çit (eksen hizalı): 2,4 m'de bir direk, iki kuşak; çarpışma: parça başına ince kutu (görünen kuşak boyu)
export function fence(b, T, x0, z0, x1, z1, h = 1.15, color = '#7a5b3e') {
  const ax = Math.abs(x1 - x0) >= Math.abs(z1 - z0), len = ax ? Math.abs(x1 - x0) : Math.abs(z1 - z0), n = Math.max(1, Math.round(len / 2.4)), sg = ax ? Math.sign(x1 - x0) : Math.sign(z1 - z0);
  b.obj(`çit:${Math.round(x0)}:${Math.round(z0)}`, () => {
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ax ? x0 + (x1 - x0) * t : x0, z = ax ? z0 : z0 + (z1 - z0) * t, y = T.heightAt(x, z);
      b.box(x, y - 0.3, z, 0.14, h + 0.4, 0.14, shade(color, 0.85), { kind: KK.PLANK });
      if (i === n) break;
      const xm = ax ? x + sg * len / n / 2 : x, zm = ax ? z : z + sg * len / n / 2, ym = Math.min(y, T.heightAt(ax ? x + sg * len / n : x, ax ? z : z + sg * len / n));
      for (const hh of [0.4, 0.85]) b.box(xm, ym + hh, zm, ax ? len / n : 0.06, 0.12, ax ? 0.06 : len / n, color, { kind: KK.PLANK });
    }
  });
}

// harç taş duvar (eksen hizalı, 0,55 m kalın), arazi kotunu 3 m'lik kademelerle izler
export function stoneWall(b, T, x0, z0, x1, z1, h = 1.1, color = '#8a8274') {
  const ax = Math.abs(x1 - x0) >= Math.abs(z1 - z0), len = ax ? Math.abs(x1 - x0) : Math.abs(z1 - z0), n = Math.max(1, Math.round(len / 3));
  b.obj(`taşduvar:${Math.round(x0)}:${Math.round(z0)}`, () => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = ax ? x0 + (x1 - x0) * t : x0, z = ax ? z0 : z0 + (z1 - z0) * t, s = len / n;
      const ys = [-0.5, 0, 0.5].map((k) => T.heightAt(ax ? x + k * s : x, ax ? z : z + k * s)), lo = Math.min(...ys), hi = Math.max(...ys);
      b.box(x, lo - 0.3, z, ax ? s + 0.02 : 0.55, hi - lo + 0.3 + h, ax ? 0.55 : s + 0.02, i % 2 ? color : shade(color, 0.95), { kind: KK.STONE });
      b.box(x, hi + h, z, ax ? s + 0.04 : 0.62, 0.1, ax ? 0.62 : s + 0.04, shade(color, 1.12), { kind: KK.STONE });      // 12.182 kapak taşı da katı (görünen = çarpışma)
    }
  });
}

// kütük yığını (eksen x ya da z), uzunluk len, 3 sıra piramit; çarpışma dış zarf (kademeli 3 kutu)
export function logStack(b, T, x, z, axis = 'x', len = 6, rows = 3, r = 0.28) {
  const ax = axis === 'x', hw = rows * r * 1.05;
  let y0 = 1e9; for (const f of [-0.5, 0, 0.5]) for (const e of [-hw, 0, hw]) y0 = Math.min(y0, T.heightAt(x + (ax ? f * len : e), z + (ax ? e : f * len)));
  y0 -= 0.05;                                                                                     // 12.182 eğimde en alçak noktaya oturur
  b.obj(`kütük:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, ax ? 0 : Q, () => {
    for (let row = 0; row < rows; row++) {
      const n = rows - row, y = r + row * r * 1.72;
      for (let k = 0; k < n; k++) {
        const zz = (k - (n - 1) / 2) * r * 2.02;
        b.cyl(0, y, zz, r * (0.92 + ((k * 7 + row * 3) % 5) * 0.03), r, len + ((k + row) % 3) * 0.2 - 0.2, '#7d5d3f', { rz: Q, center: true, seg: 7, collide: false, kind: KK.BARK });
        b.cyl(len / 2 + 0.01, y, zz, r * 0.86, r * 0.86, 0.02, '#c9a777', { rz: Q, center: true, seg: 7, collide: false, kind: KK.LOG });
      }
      b.collide(0, y - r, 0, len, r * 1.72 + (row === rows - 1 ? r * 0.28 : 0), n * r * 2.02 - r * 0.4);
    }
  }));
}

export function crate(b, T, x, z, s = 1.1, ry = 0, color = '#8f6c45') {
  const y = Math.min(T.heightAt(x - s / 2, z - s / 2), T.heightAt(x + s / 2, z + s / 2), T.heightAt(x - s / 2, z + s / 2), T.heightAt(x + s / 2, z - s / 2)) - 0.04;   // 12.182 eğimde köşesi havada kalmaz
  b.obj(`sandık:${Math.round(x * 10)}:${Math.round(z * 10)}`, () => {
    b.box(x, y, z, s, s, s, color, { kind: KK.PLANK, ry: Math.round(ry / Q) * Q });
    b.box(x, y + s * 0.45, z, s + 0.06, s * 0.1, s + 0.06, shade(color, 0.75), { collide: false, kind: KK.PLANK });
  });
}
export function barrel(b, T, x, z, color = '#3f6a8a') {
  const y = Math.min(T.heightAt(x - 0.3, z), T.heightAt(x + 0.3, z), T.heightAt(x, z - 0.3), T.heightAt(x, z + 0.3)) - 0.03;
  b.obj(`varil:${Math.round(x * 10)}:${Math.round(z * 10)}`, () => {
    b.cyl(x, y, z, 0.32, 0.32, 0.92, color, { seg: 10, collide: false, kind: KK.METAL });
    roundCollide(b, x, y, z, 0.32, 0.92);
    for (const k of [0.2, 0.7]) b.cyl(x, y + k, z, 0.335, 0.335, 0.04, shade(color, 0.7), { seg: 10, collide: false, kind: KK.METAL });
  });
}
export function hayBale(b, T, x, z, ry = 0) {
  const y = Math.min(T.heightAt(x - 0.5, z), T.heightAt(x + 0.5, z), T.heightAt(x, z - 0.5), T.heightAt(x, z + 0.5)) - 0.05, ax = Math.round(ry / Q) & 1;
  b.obj(`saman:${Math.round(x * 10)}:${Math.round(z * 10)}`, () => {
    b.cyl(x, y + 0.65, z, 0.65, 0.65, 1.25, '#cdb066', { rx: ax ? 0 : Q, rz: ax ? Q : 0, center: true, seg: 10, collide: false, kind: KK.PLANK });
    b.collide(x, y, z, ax ? 1.2 : 1.12, 1.28, ax ? 1.12 : 1.2);
  });
}
export function streetLamp(b, T, x, z, ry = 0) {
  const y = T.heightAt(x, z) - 0.1;
  b.obj(`lamba:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y, z, ry, () => {
    b.cyl(0, 0, 0, 0.07, 0.1, 5.2, '#3b4045', { seg: 6, collide: false, kind: KK.METAL });
    b.collide(0, 0, 0, 0.18, 5.2, 0.18);
    b.box(0.5, 5.1, 0, 1.1, 0.08, 0.08, '#3b4045', { collide: false, kind: KK.METAL });
    b.box(1.0, 4.95, 0, 0.42, 0.16, 0.26, '#2c3035', { collide: false, kind: KK.METAL });
    b.box(1.0, 4.9, 0, 0.36, 0.05, 0.2, '#ffdca0', { collide: false, o: { glow: true, emissive: '#ffcf86', emissiveIntensity: 1 } });
  }));
  const [px, pz] = lw(x, z, ry, 1.0, 0); ctxAdd(b, 'lamps', [+px.toFixed(1), 0, +pz.toFixed(1), 6.5]);
}
// yol bariyeri (beton New Jersey tipi), eksen hizalı
export function jersey(b, T, x, z, ax = 'x', n = 3) {
  b.obj(`bariyer:${Math.round(x)}:${Math.round(z)}`, () => { for (let i = 0; i < n; i++) {
    const px = ax === 'x' ? x + (i - (n - 1) / 2) * 3.1 : x, pz = ax === 'x' ? z : z + (i - (n - 1) / 2) * 3.1;
    let y = 1e9; for (const f of [-1.5, 0, 1.5]) for (const e of [-0.3, 0.3]) y = Math.min(y, T.heightAt(px + (ax === 'x' ? f : e), pz + (ax === 'x' ? e : f)));
    y -= 0.05;                                                                                    // 12.182 eğimde uçları havada kalmaz
    b.box(px, y, pz, ax === 'x' ? 3 : 0.6, 0.85, ax === 'x' ? 0.6 : 3, '#a7a59d', { kind: KK.CONC });
    b.box(px, y + 0.85, pz, ax === 'x' ? 3 : 0.3, 0.1, ax === 'x' ? 0.3 : 3, '#b3b1a9', { kind: KK.CONC });
  } });
}
// araç enkazı / park etmiş araç (vehicles.js modelleri; arazi kotuna oturur). ry serbest değil: 90°'nin katı (çarpışma kutuları)
export function wreck(b, T, x, z, ry = 0, kind = 'car', color = '#6e5a4a') {
  const y = T.heightAt(x, z) - 0.05, r = Math.round(ry / Q) * Q;
  b.obj(`araç:${Math.round(x)}:${Math.round(z)}`, () => b.with(0, y, 0, 0, () => (kind === 'truck' ? truck(b, { x, z, ry: r, color }) : car(b, { x, z, ry: r, color, wreck: color === '#6e5a4a' }))));
}
