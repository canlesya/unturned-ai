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

// 12.182 daha sıkı yuvarlak çarpışma (n kutu; birleşimin en dar yarıçapı ≈ r·cos(45°/n)): büyük gövdelerde (değirmen, ot yığını) görsel ile boşluk < 0,1 m
export function roundCollideN(b, x, y, z, r, h, n = 8, tag) {
  for (let k = 0; k < n; k++) { const a = (k + 0.5) / n * Math.PI / 2; b.collide(x, y, z, 2 * Math.cos(a) * r, h, 2 * Math.sin(a) * r, tag); }
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

// 12.184 tel (sarkık doğru, kuzey.js makeFx ile aynı eğri) o ana kadar kurulmuş bir çarpışma kutusunun içinden geçiyor mu (ev / ahır / çatı).
// cs: ChunkSet (yalnız telin geçtiği yığınlara bakar); uçlardaki 0,6 m (direğin kendisi) sayılmaz.
export function wireClear(cs, a, b, sag) {
  const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(2, Math.ceil(L / 0.5)), seen = new Set();
  const cols = [];
  for (let i = 0; i <= 4; i++) { const t = i / 4, k = cs.key(a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t); if (seen.has(k)) continue; seen.add(k); const c = cs.map.get(k); if (c) cols.push(...c.b.colliders); }
  for (let i = 1; i < n; i++) {
    const t = i / n; if (t * L < 0.6 || (1 - t) * L < 0.6) continue;
    const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] + (b[1] - a[1]) * t - 4 * sag * L * t * (1 - t) * 0.5;
    for (const c of cols) if (x > c.min[0] - 0.1 && x < c.max[0] + 0.1 && z > c.min[2] - 0.1 && z < c.max[2] + 0.1 && y > c.min[1] - 0.1 && y < c.max[1] + 0.5) return false;
  }
  return true;
}

// 12.184 kapı önü taş basamakları (b.with(x, y0, z, ry) içinde, yerel koordinat): kapı yerel (at, face) noktasında +z'ye bakar, genişlik w.
// Basamak 0,36 m derin, en çok 0,4 m rıht; her basamağın altı kendi ayak izindeki en alçak arazinin 0,3 m altına iner (havada köşe yok); arazi basamak
// tepesinin 0,4 m altına yaklaşınca biter (son rıht ≤ 0,4 m). Döşeme arazinin ≤ 0,4 m üstündeyse basamak yok.
export function doorSteps(b, Tr, x, z, ry, y0, at, face, w, color, kind) {
  const run = 0.36, gAt = (lz) => { const [ax, az] = lw(x, z, ry, at - w / 2, lz - run / 2), [bx, bz] = lw(x, z, ry, at + w / 2, lz + run / 2); return footY(Tr, Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz)); };
  const gC = (lz) => Tr.heightAt(...lw(x, z, ry, at, lz)) - y0;              // kapı ekseninde arazi (yerel kot)
  const hd = -gC(face + run / 2);
  if (hd <= 0.4) return 0;
  const n = Math.ceil(hd / 0.4), rise = hd / n;
  let k = 1;
  for (; k < 12; k++) {
    const lz = face + (k - 0.5) * run, top = -k * rise, f = gAt(lz), g = gC(lz);
    if (g >= top - 0.02) break;                                              // arazi basamağa ulaştı
    b.box(at, f.min - 0.3 - y0, lz, w, top - (f.min - 0.3 - y0), run, color, { kind });
    if (top - Math.max(g, gC(lz + run)) <= 0.4) break;                       // buradan araziye ≤ 0,4 m
  }
  return k;
}
