// "Boşluğun üstünü kapatan" yüzey kaplamaları (halı/kat zemini/membran): zemine oturan ince, yatay, çarpışmasız kutular.
// Kutunun ayak izi 0,4 m ızgarayla örneklenir; altında (y-0,12…y+0,02) taşıyıcı çarpışma yüzeyi olmayan örnekler "boşluk üstü" sayılır.
// Kısmen taşıyıcılı (≥%15 destekli) ama %8'den fazlası boşlukta olan kutular merdiven/çatı çıkışı gibi delikleri örtüyor demektir.
//   node scripts/mapfloat.mjs [harita...]
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
import { World } from '../src/game/collision.js';
const site = () => (new Error().stack.split('\n').slice(3, 14).map((l) => l.trim()).filter((l) => /src[\/]maps[\/]/.test(l) && !/builder\.js/.test(l)).slice(0, 2).map((l) => l.replace(/^.*src[\/]maps[\/]/, '').replace(/\)$/, '')).join(' < '));
const decals = [];
const _box = MapBuilder.prototype.box;
MapBuilder.prototype.box = function (x, y, z, w, h, d, color, opt = {}) {
  if (opt.collide === false && h <= 0.12 && w * d >= 0.5 && !opt.rx && !opt.rz && !(opt.o && (opt.o.transparent || opt.o.glow))) {
    const m = this.M.clone().multiply(this._local(x, y, z, 0, opt.ry || 0, 0));
    const e = m.elements;                                   // yatay kutu: ekseni dünya eksenlerinden birine (90° katı) hizalı olmalı
    const a = Math.abs(e[0]), c = Math.abs(e[8]);
    if ((a > 0.999 || c > 0.999) && Math.abs(e[5]) > 0.999) {
      const sw = a > 0.999 ? w : d, sd = a > 0.999 ? d : w;
      decals.push({ cx: e[12], cy: e[13], cz: e[14], sw, sd, h, site: site() });
    }
  }
  return _box.call(this, x, y, z, w, h, d, color, opt);
};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MAPS);
let total = 0;
for (const id of ids) {
  decals.length = 0;
  const m = MAPS[id].build();
  const world = new World(m.colliders, m.bounds, m.terrain || null);
  const tmp = [], bySite = new Map();
  for (const dc of decals) {
    let n = 0, bad = 0;
    for (let ox = -dc.sw / 2 + 0.2; ox <= dc.sw / 2 - 0.2 + 1e-6; ox += 0.4) for (let oz = -dc.sd / 2 + 0.2; oz <= dc.sd / 2 - 0.2 + 1e-6; oz += 0.4) {
      const px = dc.cx + ox, pz = dc.cz + oz; n++;
      const g = m.terrain ? m.terrain.heightAt(px, pz) : 0;
      let sup = Math.abs(dc.cy - g) < 0.2;
      if (!sup) for (const c of world.query(px - 0.01, pz - 0.01, px + 0.01, pz + 0.01, tmp)) if (px >= c.min[0] && px <= c.max[0] && pz >= c.min[2] && pz <= c.max[2] && c.max[1] <= dc.cy + 0.02 && c.max[1] >= dc.cy - 0.12) { sup = true; break; }
      if (!sup) bad++;
    }
    if (n >= 4 && bad / n > 0.08 && bad / n < 0.85) { const e = bySite.get(dc.site) || { k: 0, at: `${dc.cx.toFixed(1)},${dc.cy.toFixed(1)},${dc.cz.toFixed(1)}`, frac: 0 }; e.k++; e.frac = Math.max(e.frac, bad / n); bySite.set(dc.site, e); total++; }
  }
  console.log(`\n=== ${id}: ince yatay kaplama ${decals.length}, boşluk üstüne taşan ${[...bySite.values()].reduce((s, e) => s + e.k, 0)}`);
  for (const [k, e] of [...bySite].sort((a, b) => b[1].k - a[1].k).slice(0, 25)) console.log(`  ${e.k}×  ${k}   örn. (${e.at}) boşluk oranı ≤%${Math.round(e.frac * 100)}`);
}
process.exit(total ? 1 : 0);
