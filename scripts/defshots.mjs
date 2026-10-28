// 12.208 savunma / taktik görüntüleri (GERÇEK GPU, headless:false, --use-angle=metal). Maç sayfada hızlı ileri sarılır (g.step), sonra kamera
// sahneye konur: nöbetçi (mevzisindeki nöbetçi bot), tank mevzisi (vd.post'ta duran bot tank), heli saldırı turu (vd.mode 'strike'), tepeden (askerler).
//   URL=http://127.0.0.1:5192 OUT=/tmp/wb-def/shots TAG=sonra N=64 SECS=150 SHOTS=guard,tank,heli,top node scripts/defshots.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5192', OUT = process.env.OUT || '/tmp/wb-def/shots', TAG = process.env.TAG || 'sonra';
const N = +(process.env.N || 64), SECS = +(process.env.SECS || 150), SHOTS = (process.env.SHOTS || 'guard,tank,heli,top').split(',');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=${N}v${N}&map=kuzey&type=conquest&dev=1&debug=1&nolock=1&nologin=1&tod=day&weather=clear`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 300000 });
await page.evaluate(() => {
  const g = window.__game, me = g.playerSoldier;
  g.devGod = true; me.fly = true; if (me.model) me.model.root.visible = false; g.player.vm.render = () => {};
  const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () { const K = window.__cam; if (K) { c.position.set(...K.p); c.lookAt(...K.l); c.fov = K.fov || 55; c.far = 5000; c.updateProjectionMatrix(); this.playerSoldier.pos.set(K.p[0], K.p[1] - 1.6, K.p[2]); } orig.call(this); };
});
const ff = async (s) => { for (let k = 0; k < s; k += 10) await page.evaluate((n) => { const g = window.__game; for (let i = 0; i < n * 30; i++) g.step(1 / 30); }, Math.min(10, s - k)); };
await ff(SECS);
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${TAG}-${name}.png` }); console.log('görüntü', `${OUT}/${TAG}-${name}.png`); };
for (const S of SHOTS) {
  let info = null;
  for (let tries = 0; tries < 30 && !info; tries++) {
    info = await page.evaluate((S) => {
      const g = window.__game, H = (x, z) => g.world.heightAt(x, z);
      if (S === 'top') { const o = g.mode.objectives.find((q) => q.name === 'Kavşak') || g.mode.objectives[0]; window.__cam = { p: [o.x + 1, H(o.x, o.z) + 230, o.z + 90], l: [o.x, H(o.x, o.z), o.z - 20], fov: 70 }; g.hud.root.style.display = 'none'; return { o: o.name, alive: g.soldiers.filter((s) => s.alive).length }; }
      g.hud.root.style.display = '';
      if (S === 'guard') {
        const b = g.brains.find((q) => q.guard && q.guardPost && q.s.alive && !q.s.veh && Math.hypot(q.s.pos.x - q.guardPost.x, q.s.pos.z - q.guardPost.z) < 2.5);
        if (!b) return null;
        const s = b.s, o = b.guard, dx = s.pos.x - o.x, dz = s.pos.z - o.z, L = Math.hypot(dx, dz) || 1;
        const n = g.brains.filter((q) => q.guard === o && q.s.alive).length;
        window.__cam = { p: [s.pos.x + dx / L * 7 + dz / L * 3, s.pos.y + 3.2, s.pos.z + dz / L * 7 - dx / L * 3], l: [s.pos.x - dx / L * 6, s.pos.y + 0.6, s.pos.z - dz / L * 6], fov: 60 };
        return { flag: o.name, guards: n, cls: s.cls, crouch: s.crouching };
      }
      if (S === 'tank') {
        const b = g.brains.find((q) => q.vd?.kind === 'tank' && q.vd.post && q.vd.postIn && q.s.veh?.alive);
        if (!b) return null;
        const st = b.s.veh.st, p = b.vd.post, a = p.look;
        window.__cam = { p: [st.x + Math.sin(a) * 14 + Math.cos(a) * 6, st.y + 7, st.z + Math.cos(a) * 14 - Math.sin(a) * 6], l: [st.x - Math.sin(a) * 25, st.y + 1, st.z - Math.cos(a) * 25], fov: 60 };
        return { flag: p.of.name, d: Math.round(Math.hypot(st.x - p.of.x, st.z - p.of.z)) };
      }
      if (S === 'helidbg') return JSON.stringify(g.brains.filter((q) => q.vd?.kind === 'heli').map((q) => [q.vd.state, q.vd.mode, q.s.veh?.st?.air, q.vd.strikeAt != null ? Math.round(q.vd.strikeAt - g.time) : null]));
      if (S === 'heli') {
        const b = g.brains.find((q) => q.vd?.kind === 'heli' && q.vd.mode === 'strike' && q.s.veh?.alive && q.s.veh.st.air && q.vd.strikeO && Math.hypot(q.s.veh.st.x - q.vd.strikeO.x, q.s.veh.st.z - q.vd.strikeO.z) < 200);
        if (!b) return null;
        const st = b.s.veh.st, o = b.vd.strikeO, dx = st.x - o.x, dz = st.z - o.z, L = Math.hypot(dx, dz) || 1;
        window.__cam = { p: [st.x + dx / L * 22, st.y + 6, st.z + dz / L * 22], l: [o.x, H(o.x, o.z), o.z], fov: 60 };
        return { target: o.name, owner: o.owner, atk: !!b.vd.atk, dives: b.vd.dives };
      }
      return null;
    }, S);
    if (!info) await ff(3);
  }
  console.log(S, JSON.stringify(info));
  if (info) await shot(S);
}
if (errs.length) console.log('sayfa hataları:', [...new Set(errs)].slice(0, 5));
await browser.close();
