// Kasaba asset kiti · BİTKİ / KAYA / TARLA (paylaşılabilir). 12.168
// Ağaç: gövde (sekizgen, artı biçimli iç çarpışma) + yaprak kümeleri (çarpışmasız; b.softCover ile bot görüşünü keser, mermi geçer).
// Kaya: dışbükey zarf, alt yarısı dik (taban dikdörtgeni = çarpışma), üstü içe çekik; çarpışma kutuları zarfın içinde.
// Yerleşim (çakışmasızlık) çağıranın işi: her fonksiyon tepe yarıçapını / ayak izini döndürür.
import * as THREE from 'three';
import { hull, post, leaf, boxR, NC } from './kasaba-shapes.js';
import { footW } from './kasaba-props.js';

export const OAKS = ['#4f7a33', '#5d8a3a', '#46702e', '#68923f'];
export const PINES = ['#2f5a2c', '#2a4f28', '#34632f', '#27472a'];

// meşe: yükseklik ≈ 5,2·s, tepe yarıçapı 2,2·s (dönüş), gövde 0,22·s
export function oak(b, S, rng, x, z, s = 1, { collide = true } = {}) {
  return b.obj('ağaç:meşe', () => {
    const tr = 0.22 * s, th = 2.5 * s;
    post(b, x, 0, z, tr, th, '#5e4026', S.k.board ?? S.k.wood, { collide: collide && s > 0.6, rTop: tr * 0.7 });
    const c = OAKS[Math.floor(rng() * OAKS.length)], c2 = OAKS[(OAKS.indexOf(c) + 1) % OAKS.length];
    const R0 = 1.75 * s;
    leaf(b, S.k.veg, x, th - 0.35 * s, z, R0, c, { sy: 0.85, detail: 1, ry: rng() * 3 });
    const a = rng() * 6.28;
    const p1 = [x + Math.cos(a) * 0.95 * s, z + Math.sin(a) * 0.95 * s], p2 = [x + Math.cos(a + 2.4) * 0.85 * s, z + Math.sin(a + 2.4) * 0.85 * s];
    leaf(b, S.k.veg, p1[0], th - 0.6 * s, p1[1], 1.05 * s, c2, { ry: rng() * 3 });
    leaf(b, S.k.veg, p2[0], th - 0.2 * s, p2[1], 1.1 * s, c, { ry: rng() * 3 });
    b.softCover?.(x, th + 1.3 * s, z, 1.6 * s); b.softCover?.(p1[0], th + 0.3 * s, p1[1], 0.95 * s); b.softCover?.(p2[0], th + 0.7 * s, p2[1], 1.0 * s);
    return { r: 2.2 * s, h: th + 2.9 * s, low: th - 0.6 * s };
  });
}

// çam: üç koni katmanı (kesik koni, birbirine oturur: alttakinin tepe kesiti üsttekinin tabanına girer — yaprak ↔ yaprak doğal)
export function pine(b, S, rng, x, z, s = 1, { collide = true } = {}) {
  return b.obj('ağaç:çam', () => {
    post(b, x, 0, z, 0.2 * s, 1.6 * s, '#5a3d24', S.k.board ?? S.k.wood, { collide: collide && s > 0.6, rTop: 0.15 * s });
    const c = PINES[Math.floor(rng() * PINES.length)];
    for (let i = 0; i < 3; i++) {
      const r = (1.6 - i * 0.42) * s, y = (1.3 + i * 1.25) * s;
      b.cyl(x, y, z, 0.12 * s, r, 1.9 * s, i % 2 ? c : PINES[(PINES.indexOf(c) + 1) % PINES.length], { seg: 7, collide: false, ry: rng() * 3, kind: S.k.veg });
      b.softCover?.(x, y + 0.7 * s, z, r * 0.65);
    }
    return { r: 1.6 * s, h: (1.3 + 2 * 1.25 + 1.9) * s, low: 1.3 * s };
  });
}

// kavak (ince uzun): gövde + iki dar küme
export function poplar(b, S, rng, x, z, s = 1) {
  return b.obj('ağaç:kavak', () => {
    post(b, x, 0, z, 0.16 * s, 2.0 * s, '#6a5a45', S.k.board ?? S.k.wood, { rTop: 0.12 * s });
    const c = OAKS[Math.floor(rng() * OAKS.length)];
    leaf(b, S.k.veg, x, 1.6 * s, z, 0.95 * s, c, { sy: 2.1, detail: 1, ry: rng() * 3 });
    b.softCover?.(x, 3.6 * s, z, 0.9 * s); b.softCover?.(x, 5.0 * s, z, 0.7 * s);
    return { r: 1.0 * s, h: 1.6 * s + 0.95 * s * 2.1 * 2, low: 1.6 * s };
  });
}

// çalı (yere oturan küme)
export function bush(b, S, rng, x, z, s = 1) {
  return b.obj('çalı', () => {
    const c = rng() > 0.5 ? '#4f7a33' : '#5d8a3a', r = 0.7 * s;
    leaf(b, S.k.veg, x, 0, z, r, c, { sx: 1.2, sy: 0.8, ry: rng() * 3 });
    b.softCover?.(x, 0.45 * s, z, 0.62 * s);
    return { r: r * 1.2, h: r * 1.6 * 0.8 };
  });
}

// kaya: w × d taban (çarpışma), h yükseklik
export function rock(b, S, rng, x, z, w, d, h, col = '#8a8a84') {
  return b.obj('kaya', () => {
    const hw = w / 2, hd = d / 2, pts = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pts.push([x + sx * hw, 0, z + sz * hd]); pts.push([x + sx * hw, h * 0.45, z + sz * hd]); }
    const ins = 0.16 + rng() * 0.1;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const f = 1 - ins * (0.6 + rng() * 0.4);
      pts.push([x + sx * hw * f + (sx ? 0 : (rng() - 0.5) * hw * 0.5), h * (0.7 + rng() * 0.12), z + sz * hd * f + (sz ? 0 : (rng() - 0.5) * hd * 0.5)]);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pts.push([x + sx * hw * (1 - ins) * (0.55 + rng() * 0.2), h * (0.94 + rng() * 0.06), z + sz * hd * (1 - ins) * (0.55 + rng() * 0.2)]);
    hull(b, pts, col, S.k.stone);
    b.collide(x, 0, z, w * 0.995, h * 0.45, d * 0.995);
    b.collide(x, h * 0.45, z, w * (1 - ins) * 0.97, h * 0.25, d * (1 - ins) * 0.97);
    b.collide(x, h * 0.7, z, w * (1 - ins) * 0.53, h * 0.22, d * (1 - ins) * 0.53);
    return footW(b, x - hw, x + hw, z - hd, z + hd, h);
  });
}

// ekin tarlası: sıralar (çarpışmasız alçak bitki, 'yaprak' kimliği; bot görüşünü kesmez — alçak), toprak şeritleri arada
export function crops(b, S, rng, x0, z0, x1, z1, { along = 'x', col = '#8a9a42', h = 0.55, row = 0.9 } = {}) {
  return b.obj('yaprak:ekin', () => {
    const n = Math.floor(((along === 'x' ? z1 - z0 : x1 - x0)) / row);
    for (let i = 0; i < n; i++) {
      const a = (along === 'x' ? z0 : x0) + i * row + 0.15, c = a + row - 0.3;
      const cc = new THREE.Color(col).multiplyScalar(0.88 + rng() * 0.2).getStyle();
      if (along === 'x') boxR(b, x0 + 0.2, x1 - 0.2, 0, h * (0.85 + rng() * 0.3), a, c, cc, S.k.veg, NC);
      else boxR(b, a, c, 0, h * (0.85 + rng() * 0.3), z0 + 0.2, z1 - 0.2, cc, S.k.veg, NC);
    }
    return footW(b, x0, x1, z0, z1, h);
  });
}
