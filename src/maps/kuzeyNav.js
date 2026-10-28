import * as THREE from 'three';
import { NavGrid } from '../game/nav.js';

// 12.213 Kuzey Vadisi yol ızgarası: 2 m'lik tek katlı NavGrid (arazi) + gözetleme kulelerinin İKİNCİ KATI (merdiven + platform) bağlantı olarak.
// 2 m hücre dik kule merdivenini (0,3 m basamak, 0,28 m adım) çözemez; her kulenin merdiveni sabit ara noktalardır (towers.js milTower: ayak →
// ilk basamak → orta → son basamak → platform). findPath(…, sy, gy): başlangıç kulenin üstündeyse / merdivendeyse önce aşağı (ara noktalar ters),
// hedef kule platformundaysa (gy platform kotuna yakın) arazi yolu kulenin ayağına, sonra merdivenden yukarı + hedef. Arazi yolu NavGrid'in
// (eski API aynı: blocked / isFree / los / nearestFree …) → kule dışındaki bot davranışı değişmez.
export class KuzeyNav extends NavGrid {
  constructor(colliders, bounds, terrain, cell, towers) {
    super(colliders, bounds, terrain, false, cell);
    this.T = terrain;
    this.towers = (towers || []).map((t) => ({ ...t, pts: t.pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)) }));
  }
  // (x, z, y) kule platformunda mı (y verilmezse yalnız ayak izi) → kule ya da null
  towerAt(x, z, y) {
    for (const t of this.towers) {
      const [x0, x1, z0, z1] = t.plat;
      if (x < x0 - 0.3 || x > x1 + 0.3 || z < z0 - 0.3 || z > z1 + 0.3) continue;
      if (Number.isFinite(y) && y < t.top - 2) continue;
      return t;
    }
    return null;
  }
  // asker kulenin merdiveninde / platformunda mı (arazinin 0,8 m+ üstünde, merdiven şeridinin ya da platformun içinde) → { t, i: en yakın ara nokta }
  onTower(x, z, y) {
    if (!Number.isFinite(y)) return null;
    for (const t of this.towers) {
      if (Math.hypot(x - t.x, z - t.z) > 14) continue;
      if (y - this.T.heightAt(x, z) < 0.8) continue;
      let bi = -1, bd = 1e9;
      t.pts.forEach((p, i) => { const d = Math.hypot(p.x - x, p.z - z) + Math.abs(p.y - y) * 0.5; if (d < bd) { bd = d; bi = i; } });
      if (bd < 4.5 || this.towerAt(x, z, y) === t) return { t, i: this.towerAt(x, z, y) === t ? t.pts.length - 1 : bi };
    }
    return null;
  }
  findPath(sx, sz, gx, gz, maxStep = 0.7, sy = null, gy) {
    const S = this.onTower(sx, sz, sy), G = Number.isFinite(gy) ? this.towerAt(gx, gz, gy) : null;
    if (!S && !G) return super.findPath(sx, sz, gx, gz, maxStep, sy);
    const goal = new THREE.Vector3(gx, Number.isFinite(gy) ? gy : 0, gz);
    if (S && G && S.t === G) {                                                     // aynı kulede: platformda doğrudan, merdivendeyse yukarı
      const up = S.t.pts.slice(S.i + 1).map((p) => p.clone());
      return [...up, goal];
    }
    const pre = S ? S.t.pts.slice(0, S.i + 1).reverse().map((p) => p.clone()) : [];
    const a = S ? S.t.foot : { x: sx, z: sz }, b = G ? G.foot : { x: gx, z: gz };
    const mid = super.findPath(a.x, a.z, b.x, b.z, maxStep, S ? null : sy);
    if (!mid) return null;
    const post = G ? [...G.pts.map((p) => p.clone()), goal] : [];
    return [...pre, ...mid, ...post];
  }
}
