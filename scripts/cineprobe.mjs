// 12.217 sinema kamerası denemesi: maçı ileri sarar, birkaç çekim türünden tek kare + kısa kare dizisi alır, kare süresini ölçer.
//   TOD=sunset PER=24 SECS=70 OUT=/tmp/wb-cine/probe node scripts/cineprobe.mjs
import { openCine, grab } from './cinelib.mjs';
import fs from 'fs';
const OUT = process.env.OUT || '/tmp/wb-cine/probe', TOD = process.env.TOD || 'sunset', PER = +(process.env.PER || 24), SECS = +(process.env.SECS || 70);
const TYPES = (process.env.TYPES || 'heli:chase,heli:heliTop,tank:low,tank:side,moto:chase,sniper:sniper,sniper:scope,heat:wide').split(',');
fs.mkdirSync(OUT, { recursive: true });
const { browser, page, errs } = await openCine({ per: PER, tod: TOD, weather: process.env.WEATHER || 'clear' });
if (process.env.HOUR) await page.evaluate((h) => { const g = window.__game; g.map.fx.setHour(h, g); }, +process.env.HOUR);
await page.evaluate((s) => window.__game.cine.skip(s), SECS);
let fn = 0;
for (const T of TYPES) {
  const [what, type] = T.split(':');
  const info = await page.evaluate(({ what, type }) => {
    const g = window.__game, C = g.cine, V = g.vehicles.list;
    let o = null;
    const drv = (v) => v.alive && v.st && v.seats[0] && !v.def.fixed;
    if (what === 'heli') { const v = V.find((v) => drv(v) && v.def.heli && v.st.air); if (v) o = { v }; }
    if (what === 'tank') { const v = V.filter((v) => drv(v) && v.type === 'tank').sort((a, b) => Math.hypot(b.st.vx, b.st.vz) - Math.hypot(a.st.vx, a.st.vz))[0]; if (v) o = { v }; }
    if (what === 'moto') { const v = V.filter((v) => drv(v) && (v.def.moto || v.type === 'jip')).sort((a, b) => Math.hypot(b.st.vx, b.st.vz) - Math.hypot(a.st.vx, a.st.vz))[0]; if (v) o = { v }; }
    if (what === 'sniper') { const s = g.soldiers.filter((s) => s.alive && !s.veh && s.cls === 'sniper').sort((a, b) => (b.pos.y - g.world.heightAt(b.pos.x, b.pos.z)) - (a.pos.y - g.world.heightAt(a.pos.x, a.pos.z)))[0]; if (s) o = { s }; }
    if (what === 'heat') { const L = g.heat.list(g.time).sort((a, b) => b[2] - a[2]); if (L.length) o = { p: { x: L[0][0], z: L[0][1] } }; }
    if (!o) return null;
    const sh = C.cut({ ...o, type, dur: 30 });
    return sh ? { type, v: o.v ? [o.v.type, Math.round(Math.hypot(o.v.st.vx, o.v.st.vz))] : null, s: o.s ? [o.s.cls, +(o.s.pos.y - g.world.heightAt(o.s.pos.x, o.s.pos.z)).toFixed(1)] : null } : null;
  }, { what, type });
  console.log(T, JSON.stringify(info));
  if (!info) continue;
  const t0 = Date.now();
  fn = await grab(page, `${OUT}/${what}-${type}`, 0, +(process.env.NF || 90));
  console.log('  90 kare', ((Date.now() - t0) / 90).toFixed(0), 'ms/kare');
}
console.log('log', JSON.stringify(await page.evaluate(() => window.__game.cine.log)));
if (errs.length) console.log('HATALAR', [...new Set(errs)].slice(0, 8));
await browser.close();
