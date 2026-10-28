// 12.200 araç doğuşları GERÇEK GPU görüntüsü (Kuzey Vadisi, çevrimdışı Ele Geçirme; botlar donuk, HUD gizli): her araç doğuşu yakından (yan, 12 m)
// ve uzaktan (arazinin ayrıntı kademesi değişince: 260 m / 480 m). Ayrıca ölçüm: aracın çizilen arazi ağı (gerçek ızgara, kameranın gördüğü kademe)
// ile teker noktaları arasındaki fark.   URL=http://127.0.0.1:5186 OUT=/tmp/wb-veh/once ONLY=B-T1,F-J node scripts/vehgroundshot.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5186', OUT = process.env.OUT || '/tmp/wb-veh/shots', ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const FAR = (process.env.FAR || '').split(',').filter(Boolean).map(Number);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=16v16&map=kuzey&type=conquest&dev=1&debug=1&nolock=1&tod=day&weather=clear`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
await page.evaluate(() => {
  const g = window.__game, me = g.playerSoldier;
  g.devGod = true; me.fly = true; g.brains.length = 0;
  for (const o of g.mode.objectives) if (!o.owner) o.owner = 'blue';
  for (const v of g.vehicles.list) if (!v.alive) g.vehicles.trySpawn(v, true);
  if (me.model) me.model.root.visible = false;
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () {
    const k = this._cam;
    if (k) { this.playerSoldier.pos.set(k.p[0], k.p[1] - 1.6, k.p[2]); this.playerSoldier.vel.set(0, 0, 0); c.position.set(...k.p); c.lookAt(...k.t); c.fov = k.fov || 55; c.updateProjectionMatrix(); }
    orig.call(this);
  };
});
const list = await page.evaluate(() => window.__game.vehicles.list.filter((v) => v.alive).map((v) => ({ id: v.id, type: v.type, x: v.st.x, y: v.st.y, z: v.st.z, yaw: v.st.yaw })));
const res = [];
for (const v of list) {
  if (ONLY.length && !ONLY.includes(v.id)) continue;
  const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw), rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
  const views = [['yakin', 11, 2.2, 55]];
  for (const d of FAR.length ? FAR : [260]) views.push([`uzak${d}`, d, d * 0.22, 6]);
  for (const [nm, D, up, fov] of views) {
    const p = [v.x + rx * D * 0.8 - fx * D * 0.6, v.y + up, v.z + rz * D * 0.8 - fz * D * 0.6];
    const m = await page.evaluate(([p, t, fov]) => { const g = window.__game; g._cam = { p, t, fov }; return true; }, [p, [v.x, v.y + 0.8, v.z], fov]);
    await page.waitForTimeout(nm === 'yakin' ? 900 : 1400);
    // çizilen arazi ağı yüksekliği: kamera konumundan aşağı ışın (yalnız arazi ağı) — teker noktalarında
    const meas = await page.evaluate(async (id) => {
      const THREE = window.__T3 ||= await import('/node_modules/.vite/deps/three.js');
      const g = window.__game, V = g.vehicles, veh = V.list.find((q) => q.id === id), st = veh.st, d = veh.def;
      const grp = g.map.fx?.terrainMesh?.group || g.scene.getObjectByName('kuzey-arazi');
      if (!grp || !THREE) return null;
      const rc = new THREE.Raycaster(), out = [];
      for (const [f, r] of [[d.wb / 2, -d.tr / 2], [d.wb / 2, d.tr / 2], [-d.wb / 2, -d.tr / 2], [-d.wb / 2, d.tr / 2], [0, 0]]) {
        const x = st.x - Math.sin(st.yaw) * f + Math.cos(st.yaw) * r, z = st.z - Math.cos(st.yaw) * f - Math.sin(st.yaw) * r;
        rc.set(new THREE.Vector3(x, st.y + 30, z), new THREE.Vector3(0, -1, 0));
        const h = rc.intersectObject(grp, true).filter((q) => q.object.visible)[0];
        out.push(h ? +(h.point.y - g.world.heightAt(x, z)).toFixed(2) : null);
      }
      return out;
    }, v.id);
    const file = `${OUT}/${v.id}-${nm}.png`;
    await page.screenshot({ path: file });
    res.push({ id: v.id, type: v.type, view: nm, meshMinusPhys: meas });
    console.log(v.id, nm, JSON.stringify(meas));
  }
}
fs.writeFileSync(`${OUT}/olcum.json`, JSON.stringify(res, null, 1));
if (errs.length) console.log('sayfa hataları:', errs.slice(0, 5));
await browser.close();
