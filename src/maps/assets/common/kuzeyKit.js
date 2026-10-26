// Kuzey Vadisi ortak yardımcıları (12.172; paylaşılabilir, harita önekli). Varlık kuralları:
// - Çarpışan her parça eksen hizalı (dönüş yalnız 90°'nin katı): dönük kutunun AABB'si büyür → görünmez çarpışma olurdu.
// - Yuvarlak gövdeler (silo, tank, radar kubbesi) görselde silindir / küre; çarpışma içine çizilmiş 4 kutu (roundCollide) → görselden taşmaz.
// - Eğimli zemine konan yapı: taban kotu = ayak izindeki en yüksek arazi; altı taş / beton kaide ile en alçak noktanın 0,4 m altına iner (havada duran / gömülü yok).
export const Q = Math.PI / 2;

// ayak izindeki arazi kotu (min / max), 1 m aralıkla örneklenir
export function footY(T, x0, x1, z0, z1) {
  let mn = 1e9, mx = -1e9;
  const nx = Math.max(1, Math.ceil((x1 - x0) / 1.5)), nz = Math.max(1, Math.ceil((z1 - z0) / 1.5));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const y = T.heightAt(x0 + (x1 - x0) * i / nx, z0 + (z1 - z0) * j / nz); if (y < mn) mn = y; if (y > mx) mx = y; }
  return { min: mn, max: mx };
}

// yerel (dönmüş) dikdörtgenin dünya sınırları; ry 90°'nin katı
export function worldRect(x, z, w, d, ry = 0) {
  const q = Math.round(ry / Q) & 1, hw = (q ? d : w) / 2, hd = (q ? w : d) / 2;
  return [x - hw, x + hw, z - hd, z + hd];
}

// silindir / küre için içe çizilmiş çarpışma (4 kutu, a² + b² = r²): görselden taşmaz, en çok ~%5 r içeride kalır
export function roundCollide(b, x, y, z, r, h, tag) {
  for (const [a, c] of [[0.95, 0.31], [0.81, 0.59], [0.59, 0.81], [0.31, 0.95]]) b.collide(x, y, z, 2 * a * r, h, 2 * c * r, tag);
}

// renk koyulaştır / aç (#rrggbb)
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
}

// tohumlu seçim
export const pickOf = (rng, a) => a[Math.floor(rng() * a.length) % a.length];

// yerel (ry döndürülmüş) noktayı dünyaya: three.js y ekseni dönüşü (x' = x cos + z sin, z' = −x sin + z cos)
export const lw = (x, z, ry, lx, lz) => [x + Math.cos(ry) * lx + Math.sin(ry) * lz, z - Math.sin(ry) * lx + Math.cos(ry) * lz];
// kurulum bağlamı (ChunkSet.ctx; varlık sayfasında yok): loot noktaları, kapılar (nav), gece pencere ışıkları, bacalar, lamba havuzları
export function ctxAdd(b, key, item) { const c = b.ctx; if (c) (c[key] ||= []).push(item); }
// bir binanın iç loot noktaları (yerel → dünya); k: 'masa' | 'raf' | 'sandık' | 'zemin' | 'tezgâh'
export function addLoot(b, x, z, ry, y, list) { for (const [lx, lz, k, dy = 0] of list) { const [wx, wz] = lw(x, z, ry, lx, lz); ctxAdd(b, 'loot', { x: +wx.toFixed(2), y: +(y + dy).toFixed(2), z: +wz.toFixed(2), k }); } }
// kapı: dışarı / içeri birkaç nokta (nav ızgarasında bu hücreler açılır → botlar kapıdan girer)
export function addDoor(b, x, z, ry, y, lx, lz, nlx, nlz) {
  const pts = [-1.2, -0.4, 0, 0.6, 1.4].map((t) => lw(x, z, ry, lx + nlx * t, lz + nlz * t));
  ctxAdd(b, 'doors', { y, pts: pts.map(([a, c]) => [+a.toFixed(2), +c.toFixed(2)]) });
}
