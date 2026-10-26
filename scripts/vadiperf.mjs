// Vadi performansı (12.169): aynı bakışlarda YALNIZ harita grubunun çizim çağrısı / üçgeni (askerler, efektler, gök sahneden geçici çıkarılır;
// gölge geçişi dahil) + tüm sahnenin kare süresi. Masaüstü ve Pixel 7 (yatay, touch=1) profili. Eski / yeni sunucuyla aynı betik:
//   node scripts/vadiperf.mjs [URL=http://127.0.0.1:5231] [OUT=/tmp/wb-vadi/perf.json] [GPU=1]
import { chromium, devices } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5231', OUT = process.env.OUT || '/tmp/wb-vadi/perf.json';
const PROFILES = { desktop: { viewport: { width: 1280, height: 720 }, q: '' }, pixel7: { ...devices['Pixel 7 landscape'], q: '&touch=1' } };
const P2 = Math.PI / 2;
const VIEWS = [['mavi-canak', -66, 6, P2 + 0.35, -0.05], ['kopru-bati', -15, 2.2, -P2 + 0.06, -0.04], ['karakol-kule', -14.5, 2.5, -2.75, 0.02], ['ambar-avlu', -32.5, 17, -2.4, -0.05], ['tepe', -24, -36, -0.95, 0.0], ['sig-gecit', -12, -24, -P2 - 0.3, -0.08], ['asma-kopru', -12, -46.4, -P2, -0.05]];
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const rep = {};
for (const [pn, P] of Object.entries(PROFILES)) {
  const ctx = await browser.newContext({ ...P, q: undefined }), page = await ctx.newPage();
  await page.goto(`${URL0}/?autostart=5v5&map=vadi&type=tdm&debug=1&nolock=1&tod=day${P.q}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__game;
    for (const s of g.soldiers) if (s !== g.playerSoldier) s.brain = null;
    g.brains.length = 0; g.timeLeft = 900; g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
    for (const s of g.soldiers) if (s !== g.playerSoldier) { s.pos.set(150, -30, 150); s.vel.set(0, 0, 0); }
    window.__ft = []; let last = performance.now();
    const loop = (t) => { window.__ft.push(t - last); last = t; if (window.__ft.length > 400) window.__ft.shift(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  });
  const out = { mesh: await page.evaluate(() => { let n = 0, t = 0; window.__game.map.group.traverse((o) => { if (o.isMesh) { n++; t += ((o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1); } }); return { n, t: Math.round(t) }; }), views: {} };
  for (const v of VIEWS) {
    await page.evaluate(([x, z, yaw, pitch]) => { const g = window.__game, me = g.playerSoldier; me.pos.set(x, g.map.terrain.heightAt(x, z), z); me.vel.set(0, 0, 0); me.yaw = yaw; me.pitch = pitch; me.protT = 1e9; }, v.slice(1));
    await page.waitForTimeout(900);
    await page.evaluate(() => { window.__ft.length = 0; });
    await page.waitForTimeout(2000);
    out.views[v[0]] = await page.evaluate(() => {
      const g = window.__game, r = g.renderer, sc = g.scene, removed = [];
      const full = { calls: r.info.render.calls, tris: r.info.render.triangles };
      for (const c of [...sc.children]) if (c !== g.map.group && !c.isLight) { removed.push(c); sc.remove(c); }
      r.shadowMap.needsUpdate = true; r.render(sc, g.camera);
      const map = { calls: r.info.render.calls, tris: r.info.render.triangles };
      for (const c of removed) sc.add(c);
      const a = window.__ft.slice(5).sort((p, q) => p - q);
      return { full, map, ft: +(a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)).toFixed(1), p95: +(a[Math.floor(a.length * 0.95)] || 0).toFixed(1) };
    });
  }
  rep[pn] = out; await ctx.close();
}
fs.writeFileSync(OUT, JSON.stringify(rep, null, 1));
for (const [pn, r] of Object.entries(rep)) {
  console.log(`── ${pn} · harita ${r.mesh.n} ağ / ${r.mesh.t} üçgen`);
  for (const [n, v] of Object.entries(r.views)) console.log(`  ${n.padEnd(13)} harita çağrı ${String(v.map.calls).padStart(4)} üçgen ${String(v.map.tris).padStart(7)} · tüm sahne ${v.full.calls} / ${v.full.tris} · kare ${v.ft} ms (p95 ${v.p95})`);
}
await browser.close();
