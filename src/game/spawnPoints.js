// ───── 12.203 Doğuş noktası verisi + seçim (bütün takım haritaları; havuz büyüklüğü oyuncu sayısına göre) ─────
// Veri: game.spawnSet.points(team, near) = map.spawnPoints(team, near) → [{ x, z, ry, kind }]
//   near: 'base' (üs) · bayrak id'si (bayrak çevresi + büyük haritada bayrağın arkası) · 'front' (büyük harita: ön hat bayrağının çevresi + arkası)
//         · { x, z } (o noktaya en yakın sahip olunan bayrağın havuzu; yoksa üs)
//   kind: 'base' | 'flag' | 'rear' (bayrağın kendi tarafı, 40–110 m geride: ateş altındaki bayraktan dağınık / görünmeden doğuş)
// Seçim: game.spawnSet.choose(team, s, near) → bir nokta (boş, son doğuşlardan uzak, düşmanın görmediği, düşmana uzak; 12.197 safeBase kuralı)
// Noktalar: yol ızgarasında açık, zemin kotunda (platform / çatı değil), gövde hiçbir çarpışma kutusuna girmiyor, ÜSTÜ AÇIK (bina / sundurma içi değil),
// suda değil, çevresi en az %55 açık, üsten yürünerek ulaşılır; birbirinden en az 3,2 m. Doğuş seçim arayüzü (manga / ölüm ekranı) bu API'yi kullanır.
import * as THREE from 'three';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class SpawnSet {
  constructor(game) {
    this.g = game;
    this.cache = new Map();                    // 'flag:A' / 'rear:A:blue' → nokta listesi
    this.recent = [];                          // son doğuşlar { x, z, t } (aynı anda doğanlar iç içe geçmesin)
    this.per = game.mode?.perTeam || 8;
    this._tmp = [];
    this._eye = new THREE.Vector3(); this._tgt = new THREE.Vector3();
  }

  // hücre / nokta uygun mu (doğuş: zemin, açık, üstü açık, suda değil)
  ok(x, z) {
    const g = this.g, nav = g.nav, W = g.world;
    if (!nav.isFree(x, z)) return false;
    if (nav.floor && nav.floorAt(x, z) > 0.3) return false;
    if (this.seen && !this.seen[nav.idx(x, z)]) return false;
    const y = W.groundAt(x, z);
    const T = W.terrain;
    if (T?.waterY) { const wy = T.waterY(x, z); if (wy > -1e9 && wy > y - 0.1) return false; }
    const L = W.query(x - 1.2, z - 1.2, x + 1.2, z + 1.2, this._tmp);
    if (W._hits(L, x, y + 0.05, z, 1.75)) return false;                                     // gövde kutuya girmiyor
    for (const c of L) if (x > c.min[0] - 0.4 && x < c.max[0] + 0.4 && z > c.min[2] - 0.4 && z < c.max[2] + 0.4 && c.min[1] > y + 1.6 && c.min[1] < y + 14 && c.tag !== 'veh') return false;   // üstü kapalı (çatı / kat / sundurma): bina içi
    let free = 0, n = 0;
    for (let dz = -2.5; dz <= 2.5; dz += 1.25) for (let dx = -2.5; dx <= 2.5; dx += 1.25) if (dx * dx + dz * dz <= 6.25) { n++; if (nav.isFree(x + dx, z + dz)) free++; }
    return free >= n * 0.55;
  }

  _reach() {
    if (this.seen !== undefined) return;
    this.seen = null;
    const b = this.g.map.spawns?.blue?.[0];
    if (b && this.g.nav.reachable) { const s = this.g.nav.reachable(b.x, b.z); let n = 0; for (let i = 0; i < s.length; i += 7) n += s[i]; if (n > 20) this.seen = s; }
  }

  // halka / yay üstünde aralıklı uygun noktalar (belirlenimli: aynı harita + aynı istek → aynı noktalar; sunucu = istemci)
  _ring(cx, cz, r0, r1, want, a0 = 0, span = Math.PI * 2, ry = null) {
    this._reach();
    const out = [], sp2 = 3.2 * 3.2;
    let seed = Math.round(cx * 7.3 + cz * 3.1 + r0 * 11) >>> 0 || 1;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let k = 0; k < want * 40 && out.length < want; k++) {
      const a = a0 + (rnd() - 0.5) * span, r = Math.sqrt(r0 * r0 + rnd() * (r1 * r1 - r0 * r0));
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (out.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < sp2)) continue;
      if (!this.ok(x, z)) continue;
      out.push({ x: +x.toFixed(2), z: +z.toFixed(2), ry: ry ?? Math.atan2(-(cx - x), -(cz - z)) });
    }
    return out;
  }

  // bayrak çevresi: alanın %30'undan yarıçap + 16 m'ye (alanın kenarı da: herkes direğin dibine doğmasın). Sayı oyuncu sayısına göre (16–48).
  flag(o) {
    const k = 'flag:' + o.id;
    if (this.cache.has(k)) return this.cache.get(k);
    const want = Math.max(16, Math.min(48, Math.round(this.per * 0.4)));
    const cl = this.g.objCells(o);                                              // alan kotu karışık (Baraj tepesi): yalnız hedef kotundaki hücreler
    let pts;
    if (cl) { pts = []; for (const [x, z] of cl) if (pts.length < want && !pts.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 10) && this.ok(x, z)) pts.push({ x, z, ry: Math.atan2(-(o.x - x), -(o.z - z)) }); }
    else pts = this._ring(o.x, o.z, o.r * 0.3, o.r + 16, want);
    pts.forEach((p) => { p.kind = 'flag'; p.of = o.id; });
    this.cache.set(k, pts);
    return pts;
  }

  // bayrağın arkası (takımın kendi üssüne doğru, 40–110 m, ±65°): ateş altındaki ön hat bayrağında görünmeden toplanma
  rear(o, team) {
    const k = 'rear:' + o.id + ':' + team;
    if (this.cache.has(k)) return this.cache.get(k);
    const home = this.g.map.spawns[team][0], a = Math.atan2(home.z - o.z, home.x - o.x);
    const pts = this._ring(o.x, o.z, o.r + 40, o.r + 110, Math.max(12, Math.min(32, Math.round(this.per * 0.25))), a, 2.3, Math.atan2(-(o.x - home.x), -(o.z - home.z)));
    pts.forEach((p) => { p.kind = 'rear'; p.of = o.id; });
    this.cache.set(k, pts);
    return pts;
  }

  // üs: haritanın kendi noktaları (Cephe / Vagon aşamaya göre değiştirir); büyük haritada bir kez doğuş kuralından geçirilir (ağaç / araç / çadır içi olmasın)
  base(team) {
    const P = this.g.map.spawns[team] || [];
    if (!this.g.map.big) { for (const p of P) p.kind ||= 'base'; return P; }
    let c = this.cache.get('base:' + team);
    if (!c || c.src !== P) { c = P.filter((p) => this.ok(p.x, p.z)); if (c.length < P.length * 0.5) c = P.slice(); c.src = P; c.forEach((p) => { p.kind ||= 'base'; }); this.cache.set('base:' + team, c); }
    return c;
  }

  points(team, near = 'base') {
    const g = this.g, objs = g.mode.objectives;
    if (near && typeof near === 'object') {
      const own = objs.filter((o) => o.owner === team);
      if (!own.length) return this.base(team);
      let best = own[0]; for (const o of own) if (dist(o, near) < dist(best, near)) best = o;
      near = best.id;
    }
    if (near === 'front') { const f = g.frontFlag?.(team); if (!f) return this.base(team); near = f.id; }
    const o = near && near !== 'base' ? objs.find((q) => q.id === near) : null;
    if (!o) return this.base(team);
    return g.map.big ? this.flag(o).concat(this.rear(o, team)) : this.flag(o);
  }

  // en iyi nokta: boş (1,3 m'de canlı asker yok), son 2,5 sn'de 2,2 m içinde doğan yok; adaylardan (en çok 10) düşmanın görmediği
  // (göz → göğüs; küçük haritada 60 m, büyükte 110 m) ve düşmana uzak (40 / 70 m'de doyar) olan; aynı noktaya yığılma cezası.
  choose(team, s, near = 'base', list = null) {
    const g = this.g, now = g.time || 0, P = list || this.points(team, near);
    const R = this.recent; while (R.length && now - R[0].t > 2.5) R.shift();
    const busy = (p) => R.some((r) => (r.x - p.x) ** 2 + (r.z - p.z) ** 2 < 4.8) || g.soldiers.some((e) => e !== s && e.alive && Math.abs(e.pos.x - p.x) < 1.3 && Math.abs(e.pos.z - p.z) < 1.3 && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 1.3);
    const big = !!g.map.big, see = big ? 110 : 60, cap = big ? 70 : 40;
    const foes = g.soldiers.filter((e) => e.alive && e.team !== team && !e.vacant);
    const free = [];
    for (const p of P) if (!busy(p)) free.push(p);
    if (!free.length) return null;
    const cand = free.length <= 10 ? free : Array.from({ length: 10 }, () => free[Math.floor(Math.random() * free.length)]);
    const eye = this._eye, tgt = this._tgt;
    let best = null, bs = -1e9;
    for (const p of cand) {
      let dmin = 999, seen = 0, near5 = 0;
      tgt.set(p.x, (p.y ?? g.world.groundAt(p.x, p.z)) + 1.3, p.z);
      for (const e of foes) {
        const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
        if (d < dmin) dmin = d;
        if (d < see && g.botSees(e.eye(eye), tgt)) seen++;
      }
      for (const r of R) if ((r.x - p.x) ** 2 + (r.z - p.z) ** 2 < 36) near5++;
      const sc = Math.min(dmin, cap) - seen * 30 - near5 * 4 + Math.random() * 3 + (p.kind === 'rear' && dmin < 60 ? 6 : 0);
      if (sc > bs) { bs = sc; best = p; }
    }
    return best;
  }

  mark(p) { this.recent.push({ x: p.x, z: p.z, t: this.g.time || 0 }); if (this.recent.length > 64) this.recent.shift(); }
}
