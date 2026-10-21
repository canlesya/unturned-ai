// Kare el (V3) oyun içi görüntüleri (gerçek GPU): bel / nişan duruşları, animasyon şeritleri (8 kare), üçüncü şahıs, başarım. Oyun durumu sürülür (reloadT, swing, boltT, throwT …) → eski ve yeni ViewModel ile aynı betik.
//   node scripts/boxhands.mjs <bölümler=stills,anims,third,perf> <çıktı> [taban url]    DEV=desk,mob  TOD=day,night  ONLY=regex  GPU=0 (swiftshader)
import { chromium, devices } from 'playwright';
import fs from 'fs';
const parts = (process.argv[2] || 'stills,anims,third,perf').split(','), OUT = process.argv[3] || '/tmp/wb-box/after', BASE = process.argv[4] || 'http://127.0.0.1:5261';
const DEVS = (process.env.DEV || 'desk,mob').split(','), TODS = (process.env.TOD || 'day,night').split(','), only = process.env.ONLY ? new RegExp(process.env.ONLY) : null, GPU = process.env.GPU !== '0';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const errs = [];
const SLOT = { ak47: 0, m4a1: 0, shotgun: 0, sniper: 0, mp5: 0, lmg: 0, scarh: 0, aug: 0, vector: 0, p90: 0, svd: 0, barrett: 0, pkm: 0, aa12: 0, dbl: 0, g36: 0, ak74u: 0, pbrifle: 0, pistol: 1, deagle: 1, m1911: 1, revolver: 1, mac10: 1, pbpistol: 1, grenade: 2, smoke: 2, flash: 2, claymore: 2, ammobox: 2, medkit: 2, rpg: 2, m79: 2, knife: 3, machete: 3, tomahawk: 3 };
async function open(dev, tod, extra = '') {
  const ctx = dev === 'mob' ? await browser.newContext(strip(devices['Pixel 7 landscape'])) : await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(dev + ': ' + e.message));
  await page.goto(`${BASE}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0&tod=${tod}${dev === 'mob' ? '&touch=1' : ''}${extra}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  await page.evaluate(() => {
    const g = window.__game, p = g.player, s = p.s;
    g.brains.forEach((b) => (b.update = () => {}));
    g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; o.syncModel?.(0); });
    for (const e of document.body.children) if (e !== g.canvas && !e.contains(g.canvas)) e.style.visibility = 'hidden';   // arayüz gizli
    g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;
    s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.vel.set(0, 0, 0); s.yaw = 0.6; s.pitch = 0.05; s.protT = 0;
    const pb0 = !!g.mode.paintball;
    // o: { id, ads, reload (0..1), swing {kind,k}, bolt (0..1), pin (0..1), throw (0..1), insp, sprint, adsT, walk, pb, left }
    window.__pose = (o) => {
      g.leftHand = !!o.left; g.mode.paintball = o.pb ? true : pb0;
      s.cur = o.slot; s.items[o.slot] = { id: o.id, mag: o.reload !== undefined ? 0 : 30, reserve: 90 };
      if (o.optic) s.optic = o.optic;
      p.refreshWeapon();
      const S = s.stat, vm = p.vm;
      vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = o.sprint ?? 0; vm.boltT = 0; vm.throwT = 0; if ('pinT' in vm) vm.pinT = 1;
      s.swing = null; s.reloadT = 0; s.adsT = 0; s.ads = false; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = !!o.sprint && o.sprint > 0.5; s.useT = 0;
      if (o.ads) { s.ads = true; s.adsT = o.ads; }
      const tick = (n) => { for (let i = 0; i < n; i++) {
        if (o.reload !== undefined) { const tot = S.reload || 2; s.reloadStyle = S.reloadStyle || 'mag'; s.reloadEmpty = true; s.reloadTotal = s.reloadStyle === 'shell' ? S.shell * 4 : tot; s.reloadT = Math.max(0.001, s.reloadTotal * (1 - o.reload)); }
        if (o.swing) { const dur = o.swing.kind === 'stab' ? S.stabT : S.swingT; s.swing = { t: dur * o.swing.k, dur, kind: o.swing.kind, idx: 0, done: true }; }
        if (o.bolt !== undefined) vm.boltT = Math.max(0.0001, 1 - o.bolt);
        if (o.pin !== undefined && 'pinT' in vm) vm.pinT = o.pin;
        if (o.throw !== undefined) vm.throwT = Math.max(0.0001, 1 - o.throw);
        if (o.insp) vm.inspectT = o.insp;
        if (o.walk) vm.bobT = o.walk;
        if (o.sprint !== undefined) { s.sprinting = o.sprint > 0.5; vm.sprintT = o.sprint; }
        if (o.ads !== undefined) { s.adsT = o.ads; s.ads = o.ads > 0.5; }
        s.cd = 0; p.update(1 / 60);
      } };
      tick(40);
      return S.kind;
    };
  });
  return { ctx, page };
}
const shot = async (page, path, o) => { if (only && !only.test(path)) return; await page.evaluate((o) => window.__pose(o), { slot: SLOT[o.id], ...o }); await page.waitForTimeout(60); await page.screenshot({ path }); };

const STILL_W = ['ak47', 'm4a1', 'shotgun', 'pistol', 'sniper', 'mp5', 'lmg', 'deagle', 'pbrifle'];
if (parts.includes('stills')) for (const tod of TODS) for (const dev of DEVS) {
  const { ctx, page } = await open(dev, tod);
  const d = `${OUT}/${dev}-${tod}`; fs.mkdirSync(d, { recursive: true });
  for (const id of STILL_W) { await shot(page, `${d}/${id}-hip.png`, { id, pb: id === 'pbrifle' }); await shot(page, `${d}/${id}-ads.png`, { id, ads: 1, pb: id === 'pbrifle' }); }
  for (const id of ['knife', 'grenade', 'medkit', 'machete', 'tomahawk', 'claymore', 'ammobox', 'smoke']) await shot(page, `${d}/${id}-hip.png`, { id });
  await shot(page, `${d}/ak47-sprint.png`, { id: 'ak47', sprint: 1 });
  await shot(page, `${d}/L-ak47-hip.png`, { id: 'ak47', left: 1 });
  for (const op of ['iron', 'holo', 'acog']) for (const id of ['ak47', 'm4a1']) await shot(page, `${d}/${id}-ads-${op}.png`, { id, ads: 1, optic: op });
  await shot(page, `${d}/shotgun-ads-iron.png`, { id: 'shotgun', ads: 1, optic: 'iron' }); await shot(page, `${d}/pistol-ads-iron.png`, { id: 'pistol', ads: 1, optic: 'iron' }); await shot(page, `${d}/shotgun-ads-holo.png`, { id: 'shotgun', ads: 1, optic: 'holo' });
  await ctx.close();
}
const ANIMS = [['ak-reload', 'ak47', (k) => ({ reload: k })], ['shotgun-shell', 'shotgun', (k) => ({ reload: k })], ['sniper-bolt', 'sniper', (k) => ({ bolt: k })], ['pistol-reload', 'pistol', (k) => ({ reload: k })],
  ['knife-slash', 'knife', (k) => ({ swing: { kind: 'rl', k } })], ['knife-stab', 'knife', (k) => ({ swing: { kind: 'stab', k } })], ['grenade-throw', 'grenade', (k) => (k < 0.4 ? { pin: k / 0.4 } : { throw: (k - 0.4) / 0.6 })],
  ['ak-sprint2ads', 'ak47', (k) => ({ sprint: Math.max(0, 1 - k / 0.45), ads: Math.min(1, Math.max(0, (k - 0.5) / 0.45)) })], ['sniper-reload', 'sniper', (k) => ({ reload: k })], ['ak-inspect', 'ak47', (k) => ({ insp: 0.02 + k * 0.96 })]];
if (parts.includes('anims')) {
  const { ctx, page } = await open('desk', 'day');
  for (const [n, id, f] of ANIMS) for (let k = 0; k < 8; k++) await shot(page, `${OUT}/anim-${n}-${k}.png`, { id, ...f(+(k / 7).toFixed(3)) });
  await ctx.close();
}
if (parts.includes('third')) {
  const { ctx, page } = await open('desk', 'day');
  await page.evaluate(() => {
    const g = window.__game, p = g.player, s = p.s, o = g.soldiers.find((x) => x !== s && x.team === s.team) || g.soldiers.find((x) => x !== s);
    p.vm.render = () => {};                                                                    // birinci şahıs silahı çizilmesin
    window.__third = (id) => {
      o.alive = true; o.items[0] = { id, mag: 30, reserve: 90 }; o.cur = 0; o._syncWeaponModel(true);
      const a = s.yaw; o.pos.set(s.pos.x - Math.sin(a) * 1.45, s.pos.y, s.pos.z - Math.cos(a) * 1.45); o.vel.set(0, 0, 0); o.yaw = a + Math.PI + 1.25; o.pitch = 0;
      s.pitch = -0.32; for (let i = 0; i < 20; i++) { o.syncModel(1 / 60); p.update(1 / 60); }
    };
  });
  for (const id of ['ak47', 'm4a1', 'shotgun', 'pistol', 'sniper', 'knife']) { await page.evaluate((id) => window.__third(id), id); await page.waitForTimeout(60); await page.screenshot({ path: `${OUT}/third-${id}.png` }); }
  await ctx.close();
}
if (parts.includes('perf')) {
  const { ctx, page } = await open('desk', 'day');
  const res = {};
  for (const id of ['ak47', 'm4a1', 'shotgun', 'pistol', 'sniper', 'knife', 'grenade', 'mp5', 'lmg', 'medkit']) {
    await page.evaluate((o) => window.__pose(o), { id, slot: SLOT[id] });
    res[id] = await page.evaluate(() => {
      const g = window.__game, r = g.renderer, vm = g.player.vm; r.info.autoReset = false; r.info.reset(); vm.render(r, innerWidth, innerHeight);
      let hc = 0, ht = 0; vm.scene.traverse((m) => { if (m.isMesh && m.visible && (m.userData.fpHand || m.userData.boxArm || m.parent?.userData?.fpHand)) { hc++; const gg = m.geometry; ht += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } });
      const o = { vmCalls: r.info.render.calls, vmTris: r.info.render.triangles, armMeshes: hc, armTris: Math.round(ht), overlap: vm.overlapReport ? vm.overlapReport() : null }; r.info.autoReset = true; return o;
    });
  }
  fs.writeFileSync(`${OUT}/perf.json`, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res));
  await ctx.close();
}
console.log('hata:', errs.length, errs.slice(0, 5));
await browser.close();
