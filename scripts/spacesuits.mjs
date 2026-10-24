// Uzay kıyafeti takım okunurluğu (12.157): Mavi + Kırmızı askerler 15 / 30 / 40 m'de, oyuncu gözünden (FOV 72), güneşli ve gölgeli zeminde.
// Her asker için ekrandaki kutusunda takım rengi piksel oranı (ton ±28°, doygunluk > 0,35, parlaklık > 0,18) ve kutu boyu ölçülür.
//   GPU=1 URL=… OUT=… node scripts/spacesuits.mjs     → OUT/suits-*.png + suits.json
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-uzay/suits';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=4v4&map=yorunge&type=space&debug=1&nolock=1&team=blue`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await page.waitForTimeout(1200);
// sahne: oyuncu ile 42 m ilerisi arasında (yanal ±3,2 m, 0,5 / 1,6 m yükseklikte) engel olmayan hat — haritada otomatik aranır
const scenes = await page.evaluate(() => {
  const g = window.__game, B = g.map.bounds, V = g.camera.position.constructor, out = [];
  for (let x = B.minX + 4; x <= B.maxX - 4 && out.length < 6; x += 1) for (let z = B.minZ + 4; z <= B.maxZ - 4 && out.length < 6; z += 1) for (let k = 0; k < 16; k++) {
    const yaw = (k / 16) * Math.PI * 2, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const ex = x + fx * 42, ez = z + fz * 42; if (ex < B.minX + 2 || ex > B.maxX - 2 || ez < B.minZ + 2 || ez > B.maxZ - 2) continue;
    let ok = true;
    for (const lat of [-1.3, 1.3]) for (const y of [1.2, 1.7]) if (ok && !g.world.clear(new V(x + rx * lat, y, z + rz * lat), new V(ex + rx * lat, y, ez + rz * lat))) ok = false;
    if (ok && !out.some((o) => Math.hypot(o[1][0] - x, o[1][2] - z) < 25)) out.push(['hat' + out.length, [x, 1.65, z], yaw]);
  }
  return out.slice(0, 2);
});
console.log('sahneler', JSON.stringify(scenes));
const res = {};
for (const [nm, cam, yaw] of scenes) {
  const boxes = await page.evaluate(([cam, yaw]) => {
    const g = window.__game, p = g.playerSoldier;
    g.brains.length = 0; for (const s of g.soldiers) s.brain = null;
    g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
    for (const e of document.body.children) if (e !== g.renderer.domElement && !e.contains(g.renderer.domElement)) e.style.visibility = 'hidden';
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const others = g.soldiers.filter((s) => s !== p);
    const blue = others.filter((s) => s.team === 'blue'), red = others.filter((s) => s.team === 'red');
    const put = [[blue[0], 15, -1.3], [red[0], 15, 1.3], [blue[1], 30, -1.3], [red[1], 30, 1.3], [blue[2], 40, -1.3], [red[2], 40, 1.3]];
    for (const s of others) { s.alive = false; if (s.model) s.model.root.visible = false; }
    const out = [];
    for (const [s, d, lat] of put) {
      if (!s) continue;
      s.alive = true; s.hp = 100; s.pos.set(cam[0] + fx * d + rx * lat, 0, cam[2] + fz * d + rz * lat); s.pos.y = 0; s.yaw = yaw + Math.PI + (lat < 0 ? 0.5 : -0.5); s.vel.set(0, 0, 0); s.cur = 0; s.syncModel(0.016); s.model.root.visible = true;
      out.push({ s, d, team: s.team });
    }
    g.playerSoldier.pos.set(cam[0], 0, cam[2]);
    const c = g.camera, P = Object.getPrototypeOf(g);
    if (!P._suitR) { const orig = P.render; P._suitR = true; P.render = function () { if (this._cam2) { c.position.set(...this._cam2[0]); c.lookAt(...this._cam2[1]); c.fov = 72; c.updateProjectionMatrix(); } orig.call(this); }; }
    g._cam2 = [cam, [cam[0] + fx * 10, 1.2, cam[2] + fz * 10]];
    window.__suitBoxes = () => out.map(({ s, d, team }) => {
      const T = window.__THREE || null; const v = s.pos.clone(); const W = innerWidth, H = innerHeight;
      const top = v.clone(); top.y += 1.85; v.project(c); top.project(c);
      const h = (top.y - v.y) * H / 2, cx = (v.x + 1) / 2 * W, cyB = (1 - v.y) / 2 * H;
      return { d, team, x0: Math.round(cx - h * 0.32), x1: Math.round(cx + h * 0.32), y0: Math.round(cyB - h), y1: Math.round(cyB), h: Math.round(h) };
    });
    return true;
  }, [cam, yaw]);
  void boxes;
  await page.waitForTimeout(900);
  const bx = await page.evaluate(() => window.__suitBoxes());
  const buf = await page.screenshot();
  fs.writeFileSync(`${OUT}/suits-${nm}.png`, buf);
  const an = await page.evaluate(async ([b64, bx]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
    const hue = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return [0, 0, mx]; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, d / mx, mx]; };
    return bx.map((q) => {
      const w = Math.max(1, q.x1 - q.x0), h = Math.max(1, q.y1 - q.y0), d = x.getImageData(Math.max(0, q.x0), Math.max(0, q.y0), w, h).data;
      let blue = 0, red = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const [hh, s, v] = hue(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255); n++; if (s > 0.35 && v > 0.18) { if (Math.abs(hh - 218) < 28) blue++; else if (hh < 18 || hh > 340) red++; } }
      return { ...q, own: +(100 * (q.team === 'blue' ? blue : red) / n).toFixed(1), other: +(100 * (q.team === 'blue' ? red : blue) / n).toFixed(1) };
    });
  }, [buf.toString('base64'), bx]);
  res[nm] = an;
  // yakın çekim şeridi: 30 + 40 m askerleri büyütülmüş (4×, en yakın komşu)
  await page.evaluate(([b64, bx]) => new Promise(async (ok) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const far = bx.filter((q) => q.d >= 30), cv = document.createElement('canvas'), Z = 5, pad = 8, cw = Math.max(...far.map((q) => q.x1 - q.x0 + 2 * pad)), ch = Math.max(...far.map((q) => q.y1 - q.y0 + 2 * pad));
    cv.width = far.length * cw * Z; cv.height = ch * Z + 30; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#111'; x.fillRect(0, 0, cv.width, cv.height);
    far.forEach((q, i) => { x.drawImage(img, q.x0 - pad, q.y0 - pad, cw, ch, i * cw * Z, 30, cw * Z, ch * Z); x.fillStyle = '#fff'; x.font = 'bold 18px Arial'; x.fillText(`${q.team === 'blue' ? 'Mavi' : 'Kırmızı'} ${q.d} m · ${q.h}px boy`, i * cw * Z + 6, 21); });
    window.__zoom = cv.toDataURL('image/png').split(',')[1]; ok();
  }), [buf.toString('base64'), bx]);
  fs.writeFileSync(`${OUT}/suits-${nm}-yakin.png`, Buffer.from(await page.evaluate(() => window.__zoom), 'base64'));
}
fs.writeFileSync(`${OUT}/suits.json`, JSON.stringify(res, null, 1));
for (const [k, v] of Object.entries(res)) for (const q of v) console.log(`${k.padEnd(6)} ${q.team.padEnd(4)} ${String(q.d).padStart(2)} m · ${q.h}px · takım rengi %${q.own} · karşı renk %${q.other}`);
console.log('hatalar:', errs);
await browser.close();
