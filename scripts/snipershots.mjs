// Keskin nişancı kullanım kareleri (12.153; gerçek GPU, headless:false): bel → dürbün geçişi, atış + sürgü, nefes tutma, çıkış.
//   node scripts/snipershots.mjs [taban url]    DEV=desk|mob  OUT=klasör (varsayılan /tmp/wb-sniper/<DEV>)  W=sniper|barrett  TAG=önek
// Çöl Geçidi'nde en uzun açık bakış yönü bulunur, ~100 m'ye bir düşman konur; oyun adımları test tarafından atılır (g.step 1/240), her kare gerçek çizim.
// Ayrıca sayısal döküm (JSON: OUT/<TAG>trace.json): geçişte siyah örtü / model / dürbün örtüsü, dürbünde sallanma (piksel), atıştan sonra bakışın geri dönüşü.
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180', DEV = process.env.DEV || 'desk', W = process.env.W || 'sniper', TAG = process.env.TAG || '';
const OUT = process.env.OUT || `/tmp/wb-sniper/${DEV}`;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = DEV === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
const page = await ctx.newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${DEV !== 'desk' ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
await page.waitForTimeout(1500);
const setup = await page.evaluate(async (W) => {
  const THREE = await import('/node_modules/three/build/three.module.js').catch(() => null);
  const g = window.__game, p = g.player, s = p.s;
  g.brains.forEach((b) => (b.update = () => {}));
  const foes = g.soldiers.filter((o) => o !== s && o.team !== s.team), others = g.soldiers.filter((o) => o !== s && !foes.slice(0, 1).includes(o));
  others.forEach((o) => { o.pos.y = -90; });
  s.protT = 1e9; g.devGod = true;
  g.simulate = false;
  s.cur = 0; s.items[0] = { id: W, mag: 5, reserve: 25 };
  p.refreshWeapon(); s.ads = false; s.adsT = 0; s.reloadT = 0; s.switchT = 0; s.sprinting = false; s.vel.set(0, 0, 0);
  // en uzun açık yön (göz hizası)
  const V = s.pos.constructor; let best = { len: 0, yaw: 0, x: s.pos.x, z: s.pos.z };
  const ground = (x, z, y0 = 40) => { const h = g.world.raycast(new V(x, y0, z), new V(0, -1, 0), 80, {}); return h ? y0 - h.t : null; };
  const cands = [{ x: s.pos.x, z: s.pos.z }, ...(g.map.callouts || []).map((c) => ({ x: c.x, z: c.z }))];
  for (const c of cands) {                                              // haritanın bölge noktalarından en uzun düz bakış (≥ 105 m yeter; çok uzunu değil)
    const gy = ground(c.x, c.z); if (gy == null) continue;
    const eye = new V(c.x, gy + 1.62, c.z);
    for (let a = 0; a < 360; a += 3) {
      const yaw = (a * Math.PI) / 180, d = new V(-Math.sin(yaw), 0, -Math.cos(yaw)), h = g.world.raycast(eye, d, 400, {});
      const len = Math.min(h ? h.t : 400, 125), gy2 = ground(c.x + d.x * (len - 6), c.z + d.z * (len - 6));
      if (gy2 == null || Math.abs(gy2 - gy) > 1.5) continue;
      if (len > best.len) best = { len, yaw, x: c.x, z: c.z, y: gy };
    }
  }
  if (best.y != null) { s.pos.set(best.x, best.y, best.z); s.vel.set(0, 0, 0); }
  const eye = s.eye(new V());
  s.yaw = best.yaw; s.pitch = 0; s.recoilP = 0;
  const dist = Math.min(100, best.len - 4), f = foes[0];
  const fx = s.pos.x - Math.sin(best.yaw) * dist, fz = s.pos.z - Math.cos(best.yaw) * dist;
  const down = g.world.raycast(new V(fx, s.pos.y + 6, fz), new V(0, -1, 0), 30, {});
  f.pos.set(fx, down ? s.pos.y + 6 - down.t : s.pos.y, fz); f.vel.set(0, 0, 0); f.yaw = best.yaw + Math.PI; f.protT = 1e9; f.hp = 1e6; f.maxHp = 1e6;
  // hedefin göğsüne bak
  const tgt = new V(f.pos.x, f.pos.y + 1.35, f.pos.z), dd = tgt.sub(eye);
  s.pitch = Math.atan2(dd.y, Math.hypot(dd.x, dd.z));
  for (let i = 0; i < 60; i++) g.step(1 / 60);
  const vm = p.vm; vm.raise = 0; vm.kick = 0; vm.kickR = 0;
  window.__S = { yaw0: s.yaw, pitch0: s.pitch };
  return { dist: +dist.toFixed(1), free: +best.len.toFixed(1), overlay: s.overlay, zoom: p.zoomEff() };
}, W);
console.log('kurulum', JSON.stringify(setup));
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const snap = async (name) => { await frame(); await page.screenshot({ path: `${OUT}/${TAG}${name}.png` }); };
// dt adımlarıyla t saniye ilerle (her adım gerçek g.step); cond verilirse koşul sağlanınca durur
const adv = (t, opt = {}) => page.evaluate(({ t, opt }) => {
  const g = window.__game, p = g.player, s = p.s, n = Math.round(t * 240);
  for (let i = 0; i < n; i++) { if (opt.adsT != null && s.adsT >= opt.adsT - 1e-6) break; g.step(1 / 240); }
  const blk = +(+document.getElementById('scopeblk').style.opacity || 0).toFixed(2), sc = document.getElementById('scope').style.display === 'block';
  return { adsT: +s.adsT.toFixed(3), blk, scope: sc, model: p.vm.root.visible, yaw: s.yaw, pitch: s.pitch + s.recoilP, fov: +g.camera.fov.toFixed(2) };
}, { t, opt });
const trace = { setup, enter: [], fire: [], sway: [], hold: [] };
await snap('00_bel');
await page.evaluate(() => { window.__game.player.s.ads = true; });
for (const a of [0.3, 0.6, 0.85, 1.0]) {
  const r = await adv(1, { adsT: a }); trace.enter.push(r);
  await snap(`01_giris_${String(Math.round(a * 100)).padStart(3, '0')}`);
}
// tam nişandan sonra kısa oturma (kararma açılır)
trace.enter.push(await adv(0.2)); await snap('02_durbun');
// sallanma: 3 sn boyunca bakış açısı (fare yok) → piksel
const pxPerRad = await page.evaluate(() => { const g = window.__game; return innerHeight / 2 / Math.tan((g.camera.fov * Math.PI) / 360); });
for (let i = 0; i < 60; i++) { const r = await adv(0.05); trace.sway.push({ t: i * 0.05, dx: (r.yaw - trace.enter.at(-1).yaw) * pxPerRad, dy: (r.pitch - trace.enter.at(-1).pitch) * pxPerRad }); }
const amp = (a) => Math.max(...a) - Math.min(...a);
const sw = { x: +amp(trace.sway.map((o) => o.dx)).toFixed(1), y: +amp(trace.sway.map((o) => o.dy)).toFixed(1) };
console.log(`dürbün sallanması (3 sn, fare yok): yatay ${sw.x} px · dikey ${sw.y} px (1 px = ${(1000 / pxPerRad).toFixed(3)} mrad)`);
await snap('03_sallanma');
// nefes tut (koşu tuşu): 1 sn sonra + 6 sn sonra (nefes bitti)
await page.evaluate(() => { window.__game.player.keys.add('ShiftLeft'); });
await adv(0.4); const h0 = await adv(0.01);
for (let i = 0; i < 30; i++) { const r = await adv(0.05); trace.hold.push({ t: i * 0.05, dx: (r.yaw - h0.yaw) * pxPerRad, dy: (r.pitch - h0.pitch) * pxPerRad }); }
const hs = { x: +amp(trace.hold.map((o) => o.dx)).toFixed(1), y: +amp(trace.hold.map((o) => o.dy)).toFixed(1) };
console.log(`nefes tutarken (1,5 sn): yatay ${hs.x} px · dikey ${hs.y} px`);
await snap('04_nefes_tut');
await adv(4); await snap('05_nefes_bitti');
await page.evaluate(() => { window.__game.player.keys.delete('ShiftLeft'); });
await adv(2.5);
// atış + sürgü
const before = await adv(0.01);
const shot = await page.evaluate(() => { const g = window.__game, s = g.player.s; s.cd = 0; s.item.mag = 5; return s.tryFire(); });
console.log('ateş', shot);
let tt = 0;
for (const t of [0.03, 0.12, 0.3, 0.5, 0.75, 1.0, 1.3]) {
  const r = await adv(t - tt); tt = t;
  trace.fire.push({ t, adsT: r.adsT, scope: r.scope, blk: r.blk, dyPx: +((r.pitch - before.pitch) * pxPerRad).toFixed(1), dxPx: +((r.yaw - before.yaw) * pxPerRad).toFixed(1) });
  await snap(`06_atis_${String(Math.round(t * 1000)).padStart(4, '0')}`);
}
console.log('atış izi', JSON.stringify(trace.fire));
// çıkış
await page.evaluate(() => { window.__game.player.s.ads = false; });
for (const a of [0.7, 0.3, 0]) {
  const r = await page.evaluate((a) => { const g = window.__game, s = g.player.s; for (let i = 0; i < 400 && s.adsT > a + 1e-6; i++) g.step(1 / 240); return { adsT: s.adsT }; }, a);
  await snap(`07_cikis_${String(Math.round(a * 100)).padStart(3, '0')}`);
}
console.log('giriş', JSON.stringify(trace.enter));
trace.swayPx = sw; trace.holdPx = hs; trace.pxPerRad = pxPerRad;
writeFileSync(`${OUT}/${TAG}trace.json`, JSON.stringify(trace, null, 1));
if (errs.length) console.log('sayfa hatası:', errs.slice(0, 3).join(' | '));
await browser.close();
