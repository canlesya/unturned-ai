// 12.200 uzaktan "yerin altında" görünen araç: GERÇEK GPU görüntüsü (Kuzey Vadisi). Arazi ağının uzak kademesi (L2: 430–820 m, 8 m ızgara;
// L3: 20 m) yol yatağını / yarmayı kaba ara değerler → fiziğin (2 m) üstüne çıkar; orada duran araç ağın içinde kalır. Betik aracı oynanışta
// en kötü ölçülen yerlere (vehground.mjs → play.lod.worst) koyar, kamerayı uzağa (dar açı = dürbün gibi) alır, görüntü + ölçüm: kademe, çizilen ağ − fizik
// (ayak izi 9 nokta, en çok), modelin çizildiği kot − fizik kotu (lift; 12.200 vehicleView.lodLift).
//   URL=http://127.0.0.1:5287 OUT=/tmp/wb-veh/lod/sonra node scripts/vehlodshot.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5287', OUT = process.env.OUT || '/tmp/wb-veh/lod';
// [ad, araç türü, x, z, yaw, kamera uzaklığı (m), kamera yüksekliği (m), fov]
const SPOTS = JSON.parse(process.env.SPOTS || JSON.stringify([
  ['L2-kizil-us-yolu', 'jip', -211.8, -608.3, 2.254, 560, 70, 3.2],
  ['L2-kizil-us-yolu-tank', 'tank', -211.8, -608.3, 2.254, 560, 70, 3.6],
  ['L3-radar-yolu', 'jip', -532.1, 193.5, 1.598, 880, 110, 2.2],
]));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&dev=1&debug=1&nolock=1&nologin=1&tod=day&weather=clear`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
await page.evaluate(() => {
  const g = window.__game, me = g.playerSoldier;
  g.devGod = true; me.fly = true; g.brains.length = 0;
  for (const s of g.soldiers) if (s !== me) { s.alive = false; s.vacant = true; if (s.model?.root) s.model.root.visible = false; }
  if (me.model) me.model.root.visible = false;
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () {
    const k = this._cam;
    if (k) { this.playerSoldier.pos.set(k.p[0], k.p[1] - 1.6, k.p[2]); this.playerSoldier.vel.set(0, 0, 0); c.position.set(...k.p); c.lookAt(...k.t); c.fov = k.fov || 55; c.updateProjectionMatrix(); }
    orig.call(this);
  };
});
const res = [];
for (const [nm, type, x, z, yaw, D, up, fov] of SPOTS) {
  const info = await page.evaluate(async ([type, x, z, yaw]) => {
    const g = window.__game, V = g.vehicles, v = V.list.find((q) => q.type === type && q.alive);
    for (const o of V.list) if (o !== v && o.alive && Math.hypot(o.st.x - x, o.st.z - z) < 12) { o.st.x += 30; o.sleep = false; }
    v.st.x = x; v.st.z = z; v.st.yaw = yaw; v.st.y = g.world.heightAt(x, z) + 0.3; v.st.vx = v.st.vz = v.st.vy = 0; v.sleep = false; v.idleT = -1e9;
    return { id: v.id, y: v.st.y };
  }, [type, x, z, yaw]);
  await page.waitForTimeout(1500);                                      // otursun (yetkili güncelleme çevrimdışında her karede)
  const st = await page.evaluate((id) => { const v = window.__game.vehicles.list.find((q) => q.id === id); return { x: v.st.x, y: v.st.y, z: v.st.z }; }, info.id);
  const p = [st.x + D * 0.6, st.y + up, st.z + D * 0.8];
  await page.evaluate(([p, t, fov]) => { window.__game._cam = { p, t, fov }; }, [p, [st.x, st.y + 1, st.z], fov]);
  await page.waitForTimeout(1800);
  const meas = await page.evaluate((id) => {
    const g = window.__game, v = g.vehicles.list.find((q) => q.id === id), st = v.st, d = v.def, tm = g.map.fx.tm, T = tm.T, S = [1, 2, 4, 10], CH = 200;
    const rh = (x, z) => {
      const ci = Math.floor((x - T.minX) / CH), cj = Math.floor((z - T.minZ) / CH), ch = tm.chunks[cj * tm.nc + ci];
      if (!ch || ch.lod <= 0) return [T.heightAt(x, z), ch?.lod ?? -1];
      const s = S[ch.lod], i0 = ch.ci * tm.cpc, j0 = ch.cj * tm.cpc, u = ((x - T.minX) / T.cell - i0) / s, w = ((z - T.minZ) / T.cell - j0) / s;
      const i = Math.floor(u), j = Math.floor(w), fu = u - i, fv = w - j, H = (a, b) => T.h[(j0 + b * s) * T.nx + i0 + a * s];
      const a = H(i, j), b = H(i + 1, j), c = H(i, j + 1), dd = H(i + 1, j + 1);
      return [fu >= fv ? a + (b - a) * fu + (dd - b) * fv : a + (dd - c) * fu + (c - a) * fv, ch.lod];
    };
    let sink = 0, lod = -1; const sn = Math.sin(st.yaw), c = Math.cos(st.yaw);
    for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) { const x = st.x - sn * a * d.hl + c * b * d.hw, z = st.z - c * a * d.hl - sn * b * d.hw, q = rh(x, z); sink = Math.max(sink, q[0] - g.world.heightAt(x, z)); lod = q[1]; }
    const it = g.vehView.items[v.idx];
    return { lod, sink: +sink.toFixed(2), lift: +(it.model.position.y - st.y).toFixed(2), dist: Math.round(g.camera.position.distanceTo({ x: st.x, y: st.y, z: st.z, isVector3: true })) };
  }, info.id);
  const file = `${OUT}/${nm}.png`;
  await page.screenshot({ path: file });
  res.push({ nm, type, ...info, ...meas, file });
  console.log(nm, JSON.stringify(meas));
}
fs.writeFileSync(`${OUT}/olcum.json`, JSON.stringify(res, null, 1));
if (errs.length) console.log('sayfa hataları:', errs.slice(0, 5));
await browser.close();
