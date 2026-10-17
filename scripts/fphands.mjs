// Birinci şahıs el / silah tutuşu görüntüleri: yakın dövüş (bekleme, inceleme, her savurma türünün ara kareleri), 6 silah (bel / nişan / yükleme),
// sol el modu; masaüstü 1600×900 ve Pixel 7 yatay (touch=1). Sim durdurulur, durum elle kurulur (kareler tekrarlanabilir).
//   node scripts/fphands.mjs <çıktı klasörü> [taban url]      (ör. /tmp/wb-fp-shots/after http://127.0.0.1:5197)
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-fp-shots/after', base = process.argv[3] || 'http://127.0.0.1:5180';
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const MELEE = ['knife', 'machete', 'tomahawk', 'claws'], GUNS = ['m4a1', 'ak47', 'mp5', 'pistol', 'shotgun', 'sniper'];
const errs = [];
for (const dev of ['desk', 'mob']) {
  const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext({ ...devices['Pixel 7 landscape'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(dev + ': ' + e.message));
  await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&melee=knife${dev === 'mob' ? '&touch=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 90000 });
  await page.evaluate(() => {
    const g = window.__game, p = g.player, s = p.s;
    g.brains.forEach((b) => (b.update = () => {}));
    g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; o.syncModel?.(0); });
    document.querySelectorAll('#hud, .hud, #tc').forEach((e) => (e.style.visibility = 'hidden'));
    g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;       // yere otursun, sonra sim durur (kare yalnız çizilir)
    s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.vel.set(0, 0, 0);    // sabit nokta (önce / sonra aynı arka plan)
    s.yaw = 0.6; s.pitch = 0.22; s.protT = 0;
    // pose: { id, ads, reload k, swing {kind,k}, insp, left }
    window.__pose = (o) => {
      g.leftHand = !!o.left;
      if (o.zt && (s.ztype !== o.zt || !!s.boss !== (o.zt === 'boss') || !s.def.zombie)) { g.makeZombie(s, o.zt === 'boss', o.zt === 'boss' ? undefined : o.zt); s.alive = true; }
      const st = (window.__WS ||= null);
      const W = s.items, slot = o.slot;
      if (s.cur !== slot) s.cur = slot;
      s.items[slot] = { id: o.id, mag: o.reload !== undefined ? 0 : 30, reserve: 90 };
      p.refreshWeapon();
      const S = s.stat, vm = p.vm;
      vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0;
      s.swing = null; s.reloadT = 0; s.adsT = 0; s.ads = false; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0;
      if (o.walk) { vm.bobT = o.walk; }
      if (o.ads) { s.ads = true; s.adsT = 1; }
      if (o.reload !== undefined) {
        const tot = S.reload || 2; s.reloadStyle = S.reloadStyle || 'mag'; s.reloadEmpty = true; s.reloadTotal = tot; s.reloadT = Math.max(0.001, tot * (1 - o.reload));
        if (s.reloadStyle === 'shell') { s.reloadTotal = S.shell * 4; s.reloadT = s.reloadTotal * (1 - o.reload); }
      }
      if (o.swing) { const dur = o.swing.kind === 'stab' ? S.stabT : S.swingT; s.swing = { t: dur * o.swing.k, dur, kind: o.swing.kind, idx: 0, done: true }; }
      for (let i = 0; i < 40; i++) { if (o.insp) vm.inspectT = o.insp; if (o.walk) vm.bobT = o.walk; p.update(1 / 60); }
      return { swings: S.swings || null, kind: S.kind };
    };
  });
  const shots = [];
  for (const id of MELEE) {
    const sw = await page.evaluate((id) => window.__pose({ id, slot: 3 }).swings, id);
    shots.push([`${id}-idle`, { id, slot: 3 }], [`${id}-walk`, { id, slot: 3, walk: 1.2 }], [`${id}-insp30`, { id, slot: 3, insp: 0.3 }], [`${id}-insp58`, { id, slot: 3, insp: 0.58 }]);
    for (const kind of [...new Set([...sw, 'stab'])]) for (const k of [0.2, 0.44, 0.7]) shots.push([`${id}-${kind}-${Math.round(k * 100)}`, { id, slot: 3, swing: { kind, k } }]);
  }
  for (const id of GUNS) shots.push([`${id}-hip`, { id, slot: 0 }], [`${id}-ads`, { id, slot: 0, ads: 1 }], [`${id}-rel20`, { id, slot: 0, reload: 0.2 }], [`${id}-rel55`, { id, slot: 0, reload: 0.55 }]);
  shots.push(['grenade-hip', { id: 'grenade', slot: 2 }], ['medkit-hip', { id: 'medkit', slot: 2 }]);
  shots.push(['L-knife-idle', { id: 'knife', slot: 3, left: 1 }], ['L-knife-rl-44', { id: 'knife', slot: 3, left: 1, swing: { kind: 'rl', k: 0.44 } }], ['L-m4a1-hip', { id: 'm4a1', slot: 0, left: 1 }], ['L-m4a1-rel20', { id: 'm4a1', slot: 0, left: 1, reload: 0.2 }], ['L-m4a1-ads', { id: 'm4a1', slot: 0, left: 1, ads: 1 }]);
  // zombi elleri (pençe): türler + boss — oyuncu zombiye çevrilir (en sonda)
  for (const zt of ['walker', 'runner', 'ghost', 'blinker', 'boss']) {
    const z = { zt, id: 'claws', slot: 0 };
    shots.push([`zomb-${zt}-idle`, z], [`zomb-${zt}-walk`, { ...z, walk: 1.2 }]);
    if (zt === 'walker' || zt === 'boss') for (const kind of ['rl', 'lr', 'stab']) for (const k of [0.2, 0.44, 0.7]) shots.push([`zomb-${zt}-${kind}-${Math.round(k * 100)}`, { ...z, swing: { kind, k } }]);
  }
  shots.push(['zomb-L-walker-idle', { zt: 'walker', id: 'claws', slot: 0, left: 1 }]);
  for (const [name, o] of shots) {
    if (only && !only.test(name)) continue;
    await page.evaluate((o) => window.__pose(o), o);
    await page.waitForTimeout(60);
    await page.screenshot({ path: `${out}/${dev}-${name}.png` });
  }
  const info = await page.evaluate(() => { const g = window.__game, r = g.renderer, vm = g.player.vm; window.__pose({ id: 'knife', slot: 3 }); let n = 0; vm.scene.traverse((o) => { if (o.isMesh && o.visible) n++; }); r.info.autoReset = false; r.info.reset(); vm.render(r, innerWidth, innerHeight); const knife = r.info.render.calls; window.__pose({ id: 'm4a1', slot: 0 }); r.info.reset(); vm.render(r, innerWidth, innerHeight); const m4 = r.info.render.calls; r.info.autoReset = true; return { knifeMeshes: n, knifeCalls: knife, m4Calls: m4 }; });
  console.log(dev, shots.length, 'kare', JSON.stringify(info));
  await ctx.close();
}
console.log('hata:', errs.length, errs.slice(0, 5));
await browser.close();
