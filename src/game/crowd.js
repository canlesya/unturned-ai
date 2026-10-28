// 12.203 Asker ızgarası (kalabalık maç): her sim adımında bir kez, hareketten sonra / bot beyinlerinden önce kurulur (O(N)).
// Bot ayrışması (iki asker 1,05 m'den yakınsa birbirini iter) eskiden her bot için BÜTÜN askerleri tarıyordu: 128v128'de adım başına
// 256 × 256 = 65 bin uzaklık, başsız adımın ~%25'i. Izgarada yalnız 3 × 3 komşu hücre (4 m) taranır; sonuç aynı küme.
export const CELL = 4;
const key = (cx, cz) => (cx + 8192) * 16384 + (cz + 8192);

export class SoldierGrid {
  constructor() { this.cells = new Map(); this.used = []; this.pool = []; }

  rebuild(soldiers) {
    for (const a of this.used) a.length = 0;
    this.used.length = 0;
    const C = this.cells;
    for (const s of soldiers) {
      if (!s.alive) continue;
      const k = key(Math.floor(s.pos.x / CELL), Math.floor(s.pos.z / CELL));
      let a = C.get(k);
      if (!a) { a = this.pool.pop() || []; C.set(k, a); }
      if (!a.length) this.used.push(a);
      a.push(s);
    }
    if (C.size > 4096) { for (const [k, a] of C) if (!a.length) { C.delete(k); this.pool.push(a); } }      // uzun maçta boş hücreler birikmesin
  }

  // hücre (cx, cz) = (⌊x / 4⌋, ⌊z / 4⌋) içindeki canlı askerler (yoksa undefined); yarıçap ≤ 4 m sorguları 3 × 3 hücreyi tarar
  bucket(cx, cz) { return this.cells.get(key(cx, cz)); }
}
