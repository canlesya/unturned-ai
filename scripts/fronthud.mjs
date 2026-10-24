// Cephe Hattı arayüzü + atmosfer (masaüstü, botlu 12v12):  URL=http://127.0.0.1:5180 OUT=/tmp/wb-cephe2/sonra node scripts/fronthud.mjs
// Kareler: doğuş (görev yazısı + cephe hattı göstergesi), etkin noktaya bakış (dünya işareti), noktayı alırken (çubuk), cephe kayınca (bildirim), arkası dönükken (kenar oku).
// Ayrıca kare süresi / çizim çağrısı (atmosfer açık / kapalı: FrontFx'siz karşılaştırma) ve sayfa hataları.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-cephe2/sonra';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${URL0}/?autostart=12v12&map=cephe&type=front&debug=1&nolock=1&team=${process.env.TEAM || 'blue'}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 180000 });
await page.evaluate(() => {
  const g = window.__game, r = g.renderer, ro = r.render.bind(r);
  window.__ft = []; let last = performance.now();
  r.render = (sc, cam) => { ro(sc, cam); if (sc === g.scene) { window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; const t = performance.now(); window.__ft.push(t - last); last = t; } };
  g.devGod = true; g.playerSoldier.protT = 1e9;
});
const meas = async () => page.evaluate(() => { const f = window.__ft.slice(5).sort((a, b) => a - b); return { ...window.__info, msMed: +(f[f.length >> 1] || 0).toFixed(1), ms95: +(f[Math.floor(f.length * 0.95)] || 0).toFixed(1) }; });
const rep = {};
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/hud-dogus.png` });
// etkin noktaya bak (12 m geriden)
const look = (back, yawOff = 0) => page.evaluate(([back, yawOff]) => {
  const g = window.__game, s = g.playerSoldier, o = g.front.active, sp = g.map.spawns[s.team][0];
  const dx = o.x - sp.x, dz = o.z - sp.z, L = Math.hypot(dx, dz) || 1, x = o.x - dx / L * back, z = o.z - dz / L * back;
  s.pos.set(x, g.world.heightAt(x, z), z); s.vel.set(0, 0, 0); g.world.settle(s);
  s.yaw = Math.atan2(-(o.x - x), -(o.z - z)) + yawOff; s.pitch = 0;
}, [back, yawOff]);
await look(30); await page.evaluate(() => { window.__ft.length = 0; }); await page.waitForTimeout(2500);
rep.bakis = await meas();
await page.screenshot({ path: `${OUT}/hud-nokta-bakis.png` });
await look(3); await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/hud-nokta-alinirken.png` });
rep.p = await page.evaluate(() => window.__game.front.active.p);
await look(30, Math.PI); await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/hud-arkasi-donuk.png` });
await page.evaluate(() => { const g = window.__game, F = g.front; F.active.p = 1; F.shift(1, true); const s = g.playerSoldier, sp = g.map.spawns[s.team][3] || g.map.spawns[s.team][0], o = F.active; s.pos.set(sp.x, g.world.heightAt(sp.x, sp.z), sp.z); g.world.settle(s); s.yaw = Math.atan2(-(o.x - sp.x), -(o.z - sp.z)); s.pitch = 0.05; });
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/hud-cephe-kaydi.png` });
// atmosfer kapalı karşılaştırması (aynı bakış): FrontFx sahneden çıkar
await page.evaluate(() => { window.__ft.length = 0; }); await page.waitForTimeout(2500); rep.fxAcik = await meas();
await page.evaluate(() => { const fx = window.__game.front.fx; for (const o of [fx.smoke.mesh, fx.fire.mesh, fx.ash, ...fx.flashes.map((f) => f.sp)]) o.visible = false; window.__ft.length = 0; });
await page.waitForTimeout(2500); rep.fxKapali = await meas();
rep.errs = errs;
fs.writeFileSync(`${OUT}/hud-report.json`, JSON.stringify(rep, null, 1));
console.log(JSON.stringify(rep));
await browser.close();
