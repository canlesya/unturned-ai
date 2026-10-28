// 12.221 deneme: saldırı helikopteri yönlendirmesi + yeni çekim türleri (nose / door / watch / turret) kısa kare dizileri.
//   TOD=night PER=64 node scripts/cine2test.mjs
import { openCine, grab } from './cinelib.mjs';
import { installScenes } from './cinescenes.mjs';
const OUT = process.env.OUT || '/tmp/wb-cine2/test', TOD = process.env.TOD || 'night', PER = +(process.env.PER || 64), NF = +(process.env.NF || 120);
const { browser, page, errs } = await openCine({ per: PER, tod: TOD, seed: +(process.env.SEED || 5) });
await page.evaluate(() => { window.CS = { used: new Set(), booms: [] }; const g = window.__game; g.on('vehboom', (e) => window.CS.booms.push({ v: e.v, t: g.time })); });
await page.evaluate(installScenes);
if (process.env.EXPO) await page.evaluate((e) => { window.__game.renderer.toneMappingExposure = +e; }, process.env.EXPO);
await page.evaluate(() => window.__game.cine.skip(45));
const ev = (f, a) => page.evaluate(f, a);
const TESTS = (process.env.TESTS || 'nose,door1,door2,top,watch').split(',');
if (TESTS.some((t) => t !== 'turret')) {
  console.log('strike', JSON.stringify(await ev(() => window.CS.strike('blue'))));
  console.log('convoy', JSON.stringify(await ev(() => window.CS.convoy(4))));
  for (let i = 0; i < 40; i++) {
    const st = await ev(() => { const C = window.CS, g = window.__game; for (let k = 0; k < 60; k++) { C.keepStrike(); g.step(1 / 30); } const v = C.hv, vd = C.hb.vd; return { a: C.attacking(), st: vd.state, m: vd.mode, d: Math.round(Math.hypot(v.st.x - C.F.x, v.st.z - C.F.z)), agl: Math.round(v.st.y - g.world.heightAt(v.st.x, v.st.z)), hp: Math.round(v.hp), alive: v.alive }; });
    console.log(' ', i * 2, JSON.stringify(st));
    if (st.a || !st.alive) break;
  }
}
const hook = '(g) => window.CS.keepStrike && window.CS.keepStrike()';
for (const T of TESTS) {
  const ok = await ev((T) => {
    const g = window.__game, C = window.CS, v = C.hv, F = C.F;
    let o = null;
    if (T === 'nose') o = { v, type: 'nose' };
    if (T === 'door1') o = { v, type: 'door', seat: 1 };
    if (T === 'door2') o = { v, type: 'door', seat: 2 };
    if (T === 'top') o = { v, type: 'heliTop', d: 16, h: 9, x: 6, lead: 30, down: 26, fov: 60, lag: 3, turn: 1.4 };
    if (T === 'watch') { const p = C.openSpot(F.x, F.z, 25, 60) || { x: F.x + 30, z: F.z }; console.log('spot', JSON.stringify(p)); o = { v, type: 'watch', at: { x: p.x, z: p.z, h: 1.7 }, mix: 0.35, fov: 62, lagL: 5 }; }
    if (T === 'turret') { const t = g.vehicles.list.find((q) => q.alive && q.type === 'tank' && q.seats[0] && Math.hypot(q.st.vx, q.st.vz) > 2); o = t && { v: t, type: 'turret' }; }
    return !!(o && o.v && g.cine.cut({ dur: 99, ...o }));
  }, T);
  console.log(T, ok);
  if (ok) await grab(page, `${OUT}/${TOD}-${T}`, 0, NF, { onFrame: hook });
}
console.log('booms', await ev(() => window.CS.booms.length));
if (errs.length) console.log('HATA', [...new Set(errs)].slice(0, 5));
await browser.close();
