// Kare el (V3) denetimi (gerçek GPU): her silah / eşyada kutu eller var mı, ekranda beklenen yerde mi (bel duruşu: en az bir el kare içinde), el kutusu × silah parçası batma ≤ 3 mm,
// kol başına 1 ağ, sol el modu aynası, paintball kol rengi, zombi pençesi eski yol (kutu el yok), sayfa hatası yok. Masaüstü 1600×900 + Pixel 7 yatay (touch=1).
//   node scripts/fphands2.mjs [çıktı klasörü] [taban url]    GPU=0 → swiftshader · DEV=desk,mob · SHOTS=0 → görüntü alma
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-box/fphands2', base = process.argv[3] || 'http://127.0.0.1:5261', GPU = process.env.GPU !== '0', SHOTS = process.env.SHOTS !== '0';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const errs = []; let fail = 0;
const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const IDS = { 0: ['ak47', 'm4a1', 'shotgun', 'sniper', 'mp5', 'lmg', 'scarh', 'aug', 'g36', 'ak74u', 'vector', 'p90', 'aa12', 'dbl', 'svd', 'barrett', 'pkm'], 1: ['pistol', 'deagle', 'revolver', 'm1911', 'mac10'], 2: ['grenade', 'smoke', 'flash', 'claymore', 'ammobox', 'medkit', 'rpg', 'm79'], 3: ['knife', 'machete', 'tomahawk'] };
for (const dev of (process.env.DEV || 'desk,mob').split(',')) {
  const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(dev + ': ' + e.message));
  await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${dev === 'mob' ? '&touch=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  await page.evaluate(() => {
    const g = window.__game, p = g.player, s = p.s;
    g.brains.forEach((b) => (b.update = () => {}));
    g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; o.syncModel?.(0); });
    for (const e of document.body.children) if (e !== g.canvas && !e.contains(g.canvas)) e.style.visibility = 'hidden';
    s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.vel.set(0, 0, 0); s.yaw = 0.6; s.pitch = 0.05; s.protT = 0;
    window.__pose = (o) => {
      g.leftHand = !!o.left; g.mode.paintball = !!o.pb;
      if (o.zt && !s.def.zombie) { g.makeZombie(s, false, o.zt); s.alive = true; }
      s.cur = o.slot; s.items[o.slot] = { id: o.id, mag: 30, reserve: 90 };
      p.refreshWeapon();
      const vm = p.vm; vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0; vm.pinT = 1; vm.throwT = 0; vm.boltT = 0;
      s.swing = null; s.reloadT = 0; s.adsT = 0; s.ads = false; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0;
      for (let i = 0; i < 30; i++) { vm.pinT = 1; p.update(1 / 60); }
      // kutu ellerin ekran izdüşümü (NDC): el merkezi kare içinde mi
      vm.cam.updateMatrixWorld(true); const res = { arms: {}, armMeshes: 0, fpHand: 0 };
      vm.scene.traverse((m) => { if (m.isMesh && m.userData.boxArm) res.armMeshes++; if (m.isMesh && m.userData.fpHand) res.fpHand++; });
      for (const k of ['R', 'L']) { const a = vm.box?.[k]; if (!a) continue; const w = a.mesh.getWorldPosition(new a.mesh.position.constructor()).project(vm.cam); res.arms[k] = { vis: a.mesh.visible, x: +w.x.toFixed(2), y: +w.y.toFixed(2), sleeve: a.colors.sleeve, mir: vm.mirG.scale.x }; }
      res.overlap = vm.overlapReport ? vm.overlapReport() : null;
      return res;
    };
  });
  for (const [slot, ids] of Object.entries(IDS)) for (const id of ids) {
    const r = await page.evaluate((o) => window.__pose(o), { id, slot: +slot });
    const ins = Object.values(r.arms).filter((a) => a.vis && Math.abs(a.x) < 1.05 && a.y > -1.25 && a.y < 1);
    check(r.armMeshes >= 1 && r.armMeshes <= 2 && ins.length >= 1, `${dev} ${id}: ${r.armMeshes} kutu kol ağı, ${ins.length} el kare içinde ${JSON.stringify(Object.fromEntries(Object.entries(r.arms).map(([k, a]) => [k, [a.x, a.y]])))}`);
    if (r.overlap) for (const [k, ov] of Object.entries(r.overlap)) check(ov.mm <= 3, `${dev} ${id}: ${k} el batma ${ov.mm} mm (≤ 3)`);
    if (SHOTS && dev === 'desk') await page.screenshot({ path: `${out}/${dev}-${id}.png` });
  }
  const L = await page.evaluate(() => window.__pose({ id: 'ak47', slot: 0, left: 1 }));
  check(L.arms.R?.mir === -1, `${dev} sol el modu: kutu eller aynalı (mirG.x = ${L.arms.R?.mir})`);
  const pb = await page.evaluate(() => { const r = window.__pose({ id: 'pbrifle', slot: 0, pb: 1 }), g = window.__game; return { sleeve: r.arms.R?.sleeve, paint: g.player.vm.look?.shirt }; });
  check(pb.sleeve && pb.sleeve === pb.paint, `${dev} paintball: kol = boya rengi (${pb.sleeve} / ${pb.paint})`);
  if (SHOTS) await page.screenshot({ path: `${out}/${dev}-pbrifle.png` });
  const z = await page.evaluate(() => window.__pose({ zt: 'walker', id: 'claws', slot: 0 }));
  check(z.armMeshes === 0 && z.fpHand >= 2, `${dev} zombi pençesi: eski organik el (${z.fpHand} el ağı, ${z.armMeshes} kutu kol)`);
  if (SHOTS) await page.screenshot({ path: `${out}/${dev}-claws.png` });
  await ctx.close();
}
check(errs.length === 0, `sayfa hatası yok (${errs.length}) ${errs.slice(0, 3).join(' | ')}`);
console.log(fail ? `${fail} HATA` : 'hepsi geçti');
await browser.close();
process.exit(fail ? 1 : 0);
