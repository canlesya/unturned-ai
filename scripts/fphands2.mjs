// Birinci şahıs el denetimi (gerçek GPU, Metal): ilk kutu eller (73b388f) + bıçak yumruğu + bomba + zombi pençesi + paintball; masaüstü 1600×900 ve Pixel 7 yatay (touch=1).
//   node scripts/fphands2.mjs <çıktı klasörü> [taban url]    GPU=0 → swiftshader · ONLY=regex → yalnız eşleşen kareler · DEV=desk,mob
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-h2-shots/after', base = process.argv[3] || 'http://127.0.0.1:5180';
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null, GPU = process.env.GPU !== '0';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const errs = [];
for (const dev of (process.env.DEV || 'desk,mob').split(',')) {
  const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(dev + ': ' + e.message));
  await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0&melee=knife${dev === 'mob' ? '&touch=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  await page.evaluate(() => {
    const g = window.__game, p = g.player, s = p.s;
    g.brains.forEach((b) => (b.update = () => {}));
    g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; o.syncModel?.(0); });
    for (const e of document.body.children) if (e !== g.canvas && !e.contains(g.canvas)) e.style.visibility = 'hidden';   // arayüz gizli
    g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;
    s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.vel.set(0, 0, 0);
    s.yaw = 0.6; s.pitch = 0.05; s.protT = 0;
    const pb0 = !!g.mode.paintball;
    window.__pose = (o) => {
      g.leftHand = !!o.left; g.mode.paintball = o.pb ? true : pb0;
      if (o.zt && !s.def.zombie) { g.makeZombie(s, false, o.zt); s.alive = true; }
      s.cur = o.slot; s.items[o.slot] = { id: o.id, mag: o.reload !== undefined ? 0 : 30, reserve: 90 };
      p.refreshWeapon();
      const S = s.stat, vm = p.vm;
      vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0;
      s.swing = null; s.reloadT = 0; s.adsT = 0; s.ads = false; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0;
      if (o.ads) { s.ads = true; s.adsT = 1; }
      if (o.reload !== undefined) { const tot = S.reload || 2; s.reloadStyle = S.reloadStyle || 'mag'; s.reloadEmpty = true; s.reloadTotal = tot; s.reloadT = Math.max(0.001, tot * (1 - o.reload)); if (s.reloadStyle === 'shell') { s.reloadTotal = S.shell * 4; s.reloadT = s.reloadTotal * (1 - o.reload); } }
      if (o.swing) { const dur = o.swing.kind === 'stab' ? S.stabT : S.swingT; s.swing = { t: dur * o.swing.k, dur, kind: o.swing.kind, idx: 0, done: true }; }
      for (let i = 0; i < 40; i++) { if (o.insp) vm.inspectT = o.insp; if (o.walk) vm.bobT = o.walk; if (o.sprint) vm.sprintT = 1, s.sprinting = true; p.update(1 / 60); }
      return S.kind;
    };
  });
  // başarım: el ağları (çizim çağrısı / üçgen) — zombiye çevrilmeden önce ölçülür
  const info = await page.evaluate(() => {
    const g = window.__game, r = g.renderer, vm = g.player.vm, res = {};
    for (const [k, o] of [['knife', { id: 'knife', slot: 3 }], ['m4', { id: 'm4a1', slot: 0 }], ['pistol', { id: 'pistol', slot: 1 }]]) {
      window.__pose(o); r.info.autoReset = false; r.info.reset(); vm.render(r, innerWidth, innerHeight);
      let hc = 0, ht = 0; vm.scene.traverse((m) => { if (m.isMesh && m.visible && m.userData.fpHand) { hc++; const gg = m.geometry; ht += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } });
      res[k] = { vmCalls: r.info.render.calls, vmTris: r.info.render.triangles, handMeshes: hc, handTris: ht }; r.info.autoReset = true;
    }
    return res;
  });
  console.log(dev, JSON.stringify(info));
  const shots = [];
  for (const id of ['m4a1', 'ak47', 'mp5', 'sniper', 'shotgun', 'lmg']) shots.push([`${id}-hip`, { id, slot: 0 }]);
  shots.push(['m4a1-ads', { id: 'm4a1', slot: 0, ads: 1 }], ['m4a1-rel20', { id: 'm4a1', slot: 0, reload: 0.2 }], ['m4a1-walk', { id: 'm4a1', slot: 0, walk: 1.2 }]);
  for (const id of ['pistol', 'deagle']) shots.push([`${id}-hip`, { id, slot: 1 }], [`${id}-ads`, { id, slot: 1, ads: 1 }]);
  shots.push(['knife-idle', { id: 'knife', slot: 3 }], ['knife-walk', { id: 'knife', slot: 3, walk: 1.2 }], ['knife-rl-44', { id: 'knife', slot: 3, swing: { kind: 'rl', k: 0.44 } }], ['knife-lr-44', { id: 'knife', slot: 3, swing: { kind: 'lr', k: 0.44 } }], ['knife-stab-44', { id: 'knife', slot: 3, swing: { kind: 'stab', k: 0.44 } }], ['knife-insp58', { id: 'knife', slot: 3, insp: 0.58 }]);
  shots.push(['machete-idle', { id: 'machete', slot: 3 }], ['machete-diag-44', { id: 'machete', slot: 3, swing: { kind: 'diag', k: 0.44 } }], ['machete-rl-20', { id: 'machete', slot: 3, swing: { kind: 'rl', k: 0.2 } }], ['tomahawk-idle', { id: 'tomahawk', slot: 3 }], ['tomahawk-sprint', { id: 'tomahawk', slot: 3, sprint: 1 }], ['machete-sprint', { id: 'machete', slot: 3, sprint: 1 }], ['knife-sprint', { id: 'knife', slot: 3, sprint: 1 }], ['tomahawk-rl-44', { id: 'tomahawk', slot: 3, swing: { kind: 'rl', k: 0.44 } }], ['tomahawk-chop-70', { id: 'tomahawk', slot: 3, swing: { kind: 'chop', k: 0.7 } }], ['machete-lr-44', { id: 'machete', slot: 3, swing: { kind: 'lr', k: 0.44 } }], ['tomahawk-chop-20', { id: 'tomahawk', slot: 3, swing: { kind: 'chop', k: 0.2 } }], ['tomahawk-chop-44', { id: 'tomahawk', slot: 3, swing: { kind: 'chop', k: 0.44 } }], ['knife-rl-20', { id: 'knife', slot: 3, swing: { kind: 'rl', k: 0.2 } }], ['grenade-hip', { id: 'grenade', slot: 2 }], ['L-m4a1-hip', { id: 'm4a1', slot: 0, left: 1 }], ['L-knife-idle', { id: 'knife', slot: 3, left: 1 }]);
  shots.push(['pbrifle-hip', { id: 'pbrifle', slot: 0, pb: 1 }], ['pbpistol-hip', { id: 'pbpistol', slot: 1, pb: 1 }]);
  shots.push(['claws-idle', { zt: 'walker', id: 'claws', slot: 0 }], ['claws-rl-44', { zt: 'walker', id: 'claws', slot: 0, swing: { kind: 'rl', k: 0.44 } }], ['claws-stab-44', { zt: 'walker', id: 'claws', slot: 0, swing: { kind: 'stab', k: 0.44 } }]);
  for (const [name, o] of shots) {
    if (only && !only.test(name)) continue;
    await page.evaluate((o) => window.__pose(o), o);
    await page.waitForTimeout(80);
    await page.screenshot({ path: `${out}/${dev}-${name}.png` });
  }
  await ctx.close();
}
console.log('hata:', errs.length, errs.slice(0, 5));
await browser.close();
