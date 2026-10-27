// Birinci şahıs yakın dövüş kare şeridi + ölçüm (12.135): bıçak / satır / tomahawk her savurması k = 0 … 0,85 şeridi, bekleme / yürüme / koşu / çekme / inceleme / sol el.
//   node scripts/meleefp.mjs <çıktı klasörü> [taban url]     DEV=desk,mob · ONLY=regex (kare adı) · GPU=0 → swiftshader · SHOTS=0 → yalnız ölçüm
// Ölçüm (kare başına, ekran NDC −1..1): uç / kabza / ağız ortası konumu, ağzın ekrandaki yönü ile ucun hareket yönü arasındaki açı (vuruşta < 60° = ağız önde),
// kolun kameraya en yakın noktası (m), model ekran dışı mı. Çıktı: <klasör>/olcum-<dev>.json
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-melee/now', base = process.argv[3] || 'http://127.0.0.1:5180';
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null, GPU = process.env.GPU !== '0', SHOTS = process.env.SHOTS !== '0';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const errs = [];
export const KS = [0, 0.12, 0.24, 0.35, 0.44, 0.55, 0.7, 0.85];
const SW = { knife: ['rl', 'lr', 'heavy'], machete: ['rl', 'lr', 'heavy'], tomahawk: ['rl', 'lr', 'heavy'] };      // 12.194: heavy = sağ tık ağır vuruş (st.heavy, heavyT)
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
    for (const e of document.body.children) if (e !== g.canvas && !e.contains(g.canvas)) e.style.visibility = 'hidden';
    g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;
    s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.vel.set(0, 0, 0);
    s.yaw = 0.6; s.pitch = 0.05; s.protT = 0;
    window.__pose = (o) => {
      g.leftHand = !!o.left;
      s.cur = 3; s.items[3] = { id: o.id, mag: 1, reserve: 0 };
      p.refreshWeapon();
      const S = s.stat, vm = p.vm;
      vm.raise = o.raise ?? 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0;
      s.swing = null; s.reloadT = 0; s.adsT = 0; s.ads = false; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0;
      const n = o.raise !== undefined ? 1 : 40;
      for (let i = 0; i < n; i++) {
        if (o.swing) { const hv = o.swing.kind === 'heavy', dur = hv ? S.heavyT : o.swing.kind === 'stab' ? S.stabT : S.swingT; s.swing = (s.swing && s.swing.hv === hv && s.swing.kind === (hv ? S.heavy : o.swing.kind)) ? s.swing : { t: 0, dur, kind: hv ? S.heavy : o.swing.kind, idx: 0, done: true, hv }; s.swing.t = dur * o.swing.k; }
        if (o.insp) vm.inspectT = o.insp; if (o.walk) vm.bobT = o.walk; if (o.sprint) vm.sprintT = 1, s.sprinting = true;
        if (o.raise !== undefined) vm.raise = o.raise + 1 / 60 * vm.raiseRate;
        p.update(1 / 60);
      }
      // ölçüm
      const m = vm.model, u = m.userData, cam = vm.cam; vm.root.updateMatrixWorld(true); cam.updateMatrixWorld(true);
      cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
      const V = (x, y, z) => u.gripR.clone().set(x, y, z);
      const tipL = u.muzzle.clone(); tipL.y = 0;                                        // uç (eksende)
      const toCam = (v) => cam.worldToLocal(m.localToWorld(v.clone()));
      const ndc = (v) => { const c = toCam(v); const q = c.clone().applyMatrix4(cam.projectionMatrix); return [+q.x.toFixed(3), +q.y.toFixed(3), +c.z.toFixed(3)]; };
      const tip = ndc(tipL), grip = ndc(V(0, 0, 0)), mid = ndc(tipL.clone().multiplyScalar(0.6));
      const edge = ndc(tipL.clone().multiplyScalar(0.6).add(V(0, -0.06, 0)));
      // kol: yumruk grubundaki son kutu (yen) köşeleri
      let armNear = 9;
      const hr = vm.handR; if (hr) { hr.updateMatrixWorld(true); const sl = hr.userData.sleeve || hr.children[hr.children.length - 1]; const bb = sl.geometry.boundingBox || (sl.geometry.computeBoundingBox(), sl.geometry.boundingBox);
        for (let i = 0; i < 8; i++) { const c = bb.min.clone(); if (i & 1) c.x = bb.max.x; if (i & 2) c.y = bb.max.y; if (i & 4) c.z = bb.max.z; const w = cam.worldToLocal(sl.localToWorld(c)); armNear = Math.min(armNear, Math.hypot(w.x, w.y, w.z)); } }
      return { kind: S.kind, tip, grip, mid, edge, armNear: +armNear.toFixed(3) };
    };
  });
  const shots = [];
  for (const id of ['knife', 'machete', 'tomahawk']) {
    shots.push([`${id}-idle`, { id }], [`${id}-walk`, { id, walk: 1.2 }], [`${id}-walk2`, { id, walk: 2.6 }], [`${id}-sprint`, { id, sprint: 1 }], [`L-${id}-idle`, { id, left: 1 }]);
    for (const r of [0.9, 0.7, 0.5, 0.3, 0.15, 0]) shots.push([`${id}-raise${String(Math.round(r * 100)).padStart(2, '0')}`, { id, raise: r }]);
    for (const t of [0.1, 0.25, 0.4, 0.55, 0.68, 0.8, 0.88, 0.95]) shots.push([`${id}-insp${String(Math.round(t * 100)).padStart(2, '0')}`, { id, insp: t }]);
    for (const kind of SW[id]) for (const k of KS) shots.push([`${id}-${kind}-${String(Math.round(k * 100)).padStart(2, '0')}`, { id, swing: { kind, k } }]);
    for (const kind of SW[id]) shots.push([`L-${id}-${kind}-44`, { id, left: 1, swing: { kind, k: 0.44 } }]);
  }
  const res = {};
  for (const [name, o] of shots) {
    if (only && !only.test(name)) continue;
    res[name] = await page.evaluate((o) => window.__pose(o), o);
    // vuruş yönü: k ve k+0,03 arası uç hareketi (ekran) · ağız yönü (ekran)
    if (o.swing) {
      const o2 = { ...o, swing: { ...o.swing, k: o.swing.k + 0.03 } }, r2 = await page.evaluate((o) => window.__pose(o), o2);
      const r = res[name], mv = [r2.mid[0] - r.mid[0], r2.mid[1] - r.mid[1]], ed = [r.edge[0] - r.mid[0], r.edge[1] - r.mid[1]];
      const lm = Math.hypot(...mv), le = Math.hypot(...ed);
      r.speed = +lm.toFixed(3); r.edgeVsMove = lm > 0.004 && le > 1e-4 ? Math.round((Math.acos(Math.max(-1, Math.min(1, (mv[0] * ed[0] + mv[1] * ed[1]) / lm / le))) * 180) / Math.PI) : null;
      await page.evaluate((o) => window.__pose(o), o);
    }
    if (SHOTS) { await page.waitForTimeout(60); await page.screenshot({ path: `${out}/${dev}-${name}.png` }); }
  }
  writeFileSync(`${out}/olcum-${dev}.json`, JSON.stringify(res, null, 1));
  console.log(dev, Object.keys(res).length, 'kare');
  await ctx.close();
}
console.log('hata:', errs.length, errs.slice(0, 5));
await browser.close();
