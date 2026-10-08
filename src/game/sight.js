// Botların görüşü: yaprak / çalı gibi "kurşun geçiren ama görüşü kesen" yumuşak örtüler (küreler). Çarpışma ve görünüm DEĞİŞMEZ; mermi bunlardan geçer.
// Bir bot, hedefe giden görüş hattının bu örtülerin içinden geçen toplam uzunluğu eşiği aşarsa hedefi GÖRMEZ (kenardan sıyıran hat görünür).
// Veri: MapBuilder.softCover(x, y, z, r) ile haritada kaydedilir (kit.js: çam / meşe / çalı); map.sight = [[x, y, z, r], ...].
const CELL = 8;
export class SightMap {
  constructor(list = []) {
    this.list = list; this.grid = new Map(); this.stamp = 0; this.seen = new Int32Array(list.length);
    list.forEach(([x, , z, r], i) => {
      for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const k = cx + ',' + cz; let a = this.grid.get(k); if (!a) this.grid.set(k, (a = [])); a.push(i);
      }
    });
  }
  // a→b hattının yumuşak örtü içinden geçen toplam uzunluğu (m); a'yı içeren küre sayılmaz (bot kendi çalısındaysa dışarıyı görür)
  thickness(a, b, stop = 1e9) {
    if (!this.list.length) return 0;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
    if (L < 1e-4) return 0;
    const ux = dx / L, uy = dy / L, uz = dz / L, n = Math.ceil(L / 2);
    this.stamp++;
    let sum = 0;
    for (let i = 0; i <= n; i++) {
      const t = Math.min(L, i * 2), a2 = this.grid.get(Math.floor((a.x + ux * t) / CELL) + ',' + Math.floor((a.z + uz * t) / CELL));
      if (!a2) continue;
      for (const id of a2) {
        if (this.seen[id] === this.stamp) continue; this.seen[id] = this.stamp;
        const [sx, sy, sz, r] = this.list[id];
        const ox = a.x - sx, oy = a.y - sy, oz = a.z - sz;
        if (ox * ox + oy * oy + oz * oz < r * r) continue;                 // başlangıç kürenin içinde
        const bq = ox * ux + oy * uy + oz * uz, cq = ox * ox + oy * oy + oz * oz - r * r, disc = bq * bq - cq;
        if (disc <= 0) continue;
        const sq = Math.sqrt(disc), t0 = Math.max(0, -bq - sq), t1 = Math.min(L, -bq + sq);
        if (t1 > t0) { sum += t1 - t0; if (sum > stop) return sum; }
      }
    }
    return sum;
  }
  blocked(a, b, limit = 1.1) { return this.thickness(a, b, limit) > limit; }
}
