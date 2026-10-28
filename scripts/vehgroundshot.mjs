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
await page.goto(`${URL0}/?autostart=16v16&map=kuzey&type=conquest&dev=1&debug=1&nolock=1&nologin=1&tod=day&weather=clear`);
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
    const meas = await page.evaluate((id) => {
      // çizilen arazi (yığının o anki kademesi; TerrainMesh ızgarası, köşegen a–d) − fizik yüksekliği, teker / palet noktalarında + ortada;
      // lift: modelin çizildiği kot − aracın fizik kotu (12.200 vehicleView.lodLift; eski kodda 0)
      const g = window.__game, V = g.vehicles, veh = V.list.find((q) => q.id === id), st = veh.st, d = veh.def, tm = g.map.fx?.tm, T = tm.T, S = [1, 2, 4, 10], CH = 200;
      const rh = (x, z) => {
        const ci = Math.floor((x - T.minX) / CH), cj = Math.floor((z - T.minZ) / CH), ch = tm.chunks[cj * tm.nc + ci];
        if (!ch || ch.lod <= 0) return [T.heightAt(x, z), ch?.lod ?? -1];
        const s = S[ch.lod], i0 = ch.ci * tm.cpc, j0 = ch.cj * tm.cpc, u = ((x - T.minX) / T.cell - i0) / s, v = ((z - T.minZ) / T.cell - j0) / s;
        const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, H = (a, b) => T.h[(j0 + b * s) * T.nx + i0 + a * s];
        const a = H(i, j), b = H(i + 1, j), c = H(i, j + 1), dd = H(i + 1, j + 1);
        return [fu >= fv ? a + (b - a) * fu + (dd - b) * fv : a + (dd - c) * fu + (c - a) * fv, ch.lod];
      };
      const out = []; let lod = -1;
      for (const [f, r] of [[d.wb / 2, -d.tr / 2], [d.wb / 2, d.tr / 2], [-d.wb / 2, -d.tr / 2], [-d.wb / 2, d.tr / 2], [0, 0]]) {
        const x = st.x - Math.sin(st.yaw) * f + Math.cos(st.yaw) * r, z = st.z - Math.cos(st.yaw) * f - Math.sin(st.yaw) * r, q = rh(x, z);
        out.push(+(q[0] - g.world.heightAt(x, z)).toFixed(2)); lod = q[1];
      }
      const it = g.vehView?.items?.find((q) => q.v === veh), my = it?.model?.position.y;
      return { lod, meshMinusPhys: out, lift: my != null ? +(my - st.y).toFixed(2) : null };
    }, v.id);
    const file = `${OUT}/${v.id}-${nm}.png`;
    await page.screenshot({ path: file });
    res.push({ id: v.id, type: v.type, view: nm, ...meas });
    console.log(v.id, nm, JSON.stringify(meas));
  }
}
fs.writeFileSync(`${OUT}/olcum.json`, JSON.stringify(res, null, 1));
if (errs.length) console.log('sayfa hataları:', errs.slice(0, 5));
await browser.close();
