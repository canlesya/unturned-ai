// Kasaba zemin katmanları (dünya koordinatı): yol / kaldırım / meydan / toprak / patika. 12.168
// Her katmanın kendi kotu var (çim 0 · toprak 0,02 · asfalt 0,04 · kaldırım / meydan 0,15) ve dikdörtgenler ÖNCELİK sırasıyla birbirinden
// çıkarılır → hiçbir iki zemin parçası üst üste binmez (eş düzlemli yüz yok). Yol çizgileri yalnız son asfalt parçalarının içine çizilir.
// Zemin parçaları çarpışmalıdır (görünen kot = basılan kot). top(x, z): o noktadaki zemin üstü (eşyalar bu kota oturur).
import * as THREE from 'three';
import { subtractRects } from '../common/kasaba-shapes.js';

export const GL = { grass: 0, dirt: 0.02, path: 0.02, asph: 0.04, curb: 0.15, plaza: 0.15 };
const PRI = { plaza: 0, curb: 1, asph: 2, path: 3, dirt: 4 };          // küçük sayı önce (yüksek öncelik)
const _v = new THREE.Vector3();

export class Ground {
  constructor() { this.req = []; this.marks = []; this.holes = []; this.final = null; this.roads = []; }
  // yerel dikdörtgeni o anki matrisle dünyaya çevir (90° katları)
  static W(b, x0, x1, z0, z1) {
    let a = 1e9, c = -1e9, e = 1e9, g = -1e9;
    for (const [x, z] of [[x0, z0], [x1, z1]]) { _v.set(x, 0, z).applyMatrix4(b.M); a = Math.min(a, _v.x); c = Math.max(c, _v.x); e = Math.min(e, _v.z); g = Math.max(g, _v.z); }
    return [+a.toFixed(4), +c.toFixed(4), +e.toFixed(4), +g.toFixed(4)];
  }
  add(b, layer, x0, x1, z0, z1, color, kind, o = {}) { this.req.push({ layer, r: Ground.W(b, x0, x1, z0, z1), color, kind, mini: !!o.mini, seq: this.req.length }); }
  // zeminde yer kaplayan yapı (bina, duvar): kaldırım / yol / toprak altına girmez
  hole(b, x0, x1, z0, z1) { this.holes.push(Ground.W(b, x0, x1, z0, z1)); }
  mark(b, x0, x1, z0, z1, color, kind) { this.marks.push({ r: Ground.W(b, x0, x1, z0, z1), color, kind }); }
  // önceliğe göre kırp → son parçalar
  resolve() {
    const order = this.req.slice().sort((p, q) => PRI[p.layer] - PRI[q.layer] || p.seq - q.seq);
    const done = [];
    for (const q of order) {
      const cut = [...done.map((d) => d.r), ...this.holes];
      for (const r of subtractRects(q.r, cut)) if (r[1] - r[0] > 0.02 && r[3] - r[2] > 0.02) done.push({ ...q, r });
    }
    this.final = done;
    return done;
  }
  top(x, z) {
    for (const q of this.final || []) { const [a, c, e, g] = q.r; if (x >= a - 1e-6 && x <= c + 1e-6 && z >= e - 1e-6 && z <= g + 1e-6) return GL[q.layer]; }
    return 0;
  }
  // dikdörtgenin altındaki zemin kotu tek mi? (eşya iki kotun sınırına oturmasın)
  topOf(x0, x1, z0, z1) {
    const hs = new Set();
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2], [x0, (z0 + z1) / 2], [x1, (z0 + z1) / 2], [(x0 + x1) / 2, z0], [(x0 + x1) / 2, z1]]) hs.add(this.top(x, z));
    return hs.size === 1 ? [...hs][0] : null;
  }
  // çiz (dünya çerçevesinde, dönüşsüz): kutular + çizgiler
  draw(b) {
    for (const q of this.final) {
      const [x0, x1, z0, z1] = q.r, h = GL[q.layer];
      b.obj('zemin:' + q.layer, () => b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, h, z1 - z0, q.color, { kind: q.kind }));
      if (q.layer === 'asph' && q.mini) this.roads.push({ x0, z0, x1, z1 });
    }
  }
  // yol çizgileri EN SON: son asfalt parçalarının içinde, üstüne eşya konan yerler (occ ayak izleri) çıkarılarak (çizgi aracın altına girmez)
  drawMarks(b, occ) {
    const asph = this.final.filter((q) => q.layer === 'asph');
    const blk = occ.filter((f) => f && Number.isFinite(f.x0) && !f.tree).map((f) => [f.x0 - 0.03, f.x1 + 0.03, f.z0 - 0.03, f.z1 + 0.03]);
    for (const m of this.marks) for (const q of asph) {
      const a = Math.max(m.r[0], q.r[0]), c = Math.min(m.r[1], q.r[1]), e = Math.max(m.r[2], q.r[2]), g = Math.min(m.r[3], q.r[3]);
      if (c - a <= 0.05 || g - e <= 0.05) continue;
      for (const [x0, x1, z0, z1] of subtractRects([a, c, e, g], blk.filter((r) => r[0] < c && r[1] > a && r[2] < g && r[3] > e)))
        if (x1 - x0 > 0.05 && z1 - z0 > 0.05) b.obj('zemin:çizgi', () => b.box((x0 + x1) / 2, GL.asph, (z0 + z1) / 2, x1 - x0, 0.02, z1 - z0, m.color, { kind: m.kind, collide: false }));
    }
  }
}
