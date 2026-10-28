// 12.209 önce / sonra görüntüsü (gerçek GPU, headless:false, --use-angle=metal): Kuzey'de Kırmızı üs yolu yarmasına (−200, −616; uzak kademede
// kaba ağ fiziğin 4–6 m üstünde) bir jip + bir motor konur, sim durdurulur, kamera 650 m'den (yüksekten, dar açı) ve 330 m'den bakar.
// Her karede modelin teker / gövde altı noktalarının çizilen zemine göre gömülmesi de yazılır.
//   URL=http://127.0.0.1:5196 OUT=/tmp/wb-vdrive/goruntu TAG=sonra node scripts/vehdriveshot.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5196', OUT = process.env.OUT || '/tmp/wb-vdrive/goruntu', TAG = process.env.TAG || 'sonra';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, locale: 'tr-TR' })).newPage();
await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&dev=1&debug=1&nolock=1&nologin=1&tod=day&weather=clear`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 300000 });
await page.waitForTimeout(2500);
const P = [[-178.4, -630.6, 'jip'], [-206.2, -612.5, 'moto']];      // yarmanın en derin yeri: L3 ağı fiziğin 4 / 3 m üstünde (eski lodLift 2,5 m'de kırpılıyordu)
await page.evaluate(async (P) => {
  const g = window.__game, VS = await import('/src/sim/vehicle.js'), W = g.world;
  g.devGod = true; g.playerSoldier.fly = true; g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  for (const [x, z, t] of P) {
    const v = g.vehicles.list.find((o) => o.type === t && o.alive && !o.seats.some(Boolean) && !o._shot);
    v._shot = true; const st = v.st; st.x = x; st.z = z; st.yaw = 2.2; st.y = W.heightAt(x, z);
    if (VS.settleVehicle) VS.settleVehicle(st, W); else { for (let i = 0; i < 40; i++) VS.stepVehicle(st, null, 1 / 60, W); st.vx = st.vz = st.vy = 0; }
    v.sleep = true; window.__sv = (window.__sv || []).concat(v.idx);
  }
  for (const s of g.soldiers) if (s !== g.playerSoldier && Math.hypot(s.pos.x + 196, s.pos.z + 618) < 40) s.pos.x += 80;
  g.simulate = false;
}, P);
const shot = async (nm, cam) => {
  const r = await page.evaluate((cam) => {
    const g = window.__game, c = g.camera, o = g._oR || (g._oR = g.render.bind(g));
    g.render = function () { c.position.set(cam[0], cam[1], cam[2]); c.lookAt(cam[3], cam[4], cam[5]); c.fov = cam[6]; c.updateProjectionMatrix(); g.playerSoldier.pos.set(cam[0], cam[1] - 1.6, cam[2]); o(); };
    return null;
  }, cam);
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => {
    const g = window.__game, tm = g.map.fx.tm, W = g.world, out = [];
    for (const i of window.__sv) {
      const it = g.vehView.items[i], v = it.v, d = v.def, m = it.model; m.updateMatrixWorld(true);
      let wh = -9, hu = -9; const p = new m.position.constructor();
      for (const f of [d.wb / 2, -d.wb / 2]) for (const r of d.moto ? [0] : [-d.tr / 2, d.tr / 2]) { p.set(r, 0, -f).applyMatrix4(m.matrixWorld); wh = Math.max(wh, tm.renderedHeightAt(p.x, p.z) - p.y); }
      for (let a = 0; a <= 8; a++) for (const r of d.moto ? [0] : [-d.hw, 0, d.hw]) { p.set(r, d.clear, d.hl - a * d.hl / 4).applyMatrix4(m.matrixWorld); hu = Math.max(hu, tm.renderedHeightAt(p.x, p.z) - p.y); }
      const ch = tm.chunks[Math.floor((v.st.z - tm.T.minZ) / 200) * tm.nc + Math.floor((v.st.x - tm.T.minX) / 200)];
      out.push(`${v.type} L${ch.lod} teker ${wh.toFixed(2)} m · gövde altı ${hu.toFixed(2)} m · kaldırma ${(m.position.y - v.st.y).toFixed(2)} m`);
    }
    return out;
  });
  await page.screenshot({ path: `${OUT}/${nm}-${TAG}.png` });
  console.log(nm, TAG, m.join(' | '));
};
// yol yarması boyunca (yol yönü ≈ (−0,78, 0,63)), yüksekten
await shot('uzak-900m-L3', [-200 - 0.78 * 900, 25 + 110, -616 + 0.63 * 900, -192, 26.5, -621, 2.2]);
await shot('uzak-650m-L2', [-200 - 0.78 * 650, 25 + 70, -616 + 0.63 * 650, -192, 26.5, -621, 3]);
await shot('orta-330m-L1', [-200 - 0.78 * 330, 25 + 30, -616 + 0.63 * 330, -192, 26.5, -621, 6]);
await browser.close();
