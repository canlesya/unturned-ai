// ACOG / paintball (/ RD=1 red dot) nişan görüntüleri + ACOG mercek ölçümü (gerçek GPU, headless:false, 12.129).
//   node scripts/acogshots.mjs <çıktı klasörü> [taban url]    DEV=desk|mob  ONLY=regex (ad)  JSON=dosya
// ACOG: her ACOG'lu silahta adsT 1 ve 0,7 — dünya görünür kare (<dev>-<silah>-acog-<yüzde>.png) + yeşil zeminli ölçüm karesi:
//   merkez = mercek diskinin ekran merkezi − ekran ortası (px), çap = ekran yüksekliğine oran, örtü = mercek dairesinde yeşil olmayan (silah / gövde) oranı,
//   dış = mercek dışında silahın kapladığı ekran oranı. Paintball: pbrifle / pbpistol bel / %50 / tam nişan (HUD halka açık), silahın ekranda kalan oranı.
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-acog2/after', base = process.argv[3] || 'http://127.0.0.1:5371';
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null, dev = process.env.DEV || 'desk';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
const page = await ctx.newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${dev === 'mob' ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
await page.evaluate(async () => {
  const { WSTATS } = await import('/src/game/stats.js');
  const g = window.__game, p = g.player, s = p.s;
  g.brains.forEach((b) => (b.update = () => {}));
  g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; o.syncModel?.(0); });
  g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;
  s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.vel.set(0, 0, 0); s.yaw = 0.6; s.pitch = 0.05; s.protT = 1e9;
  const hudEls = [...document.body.children].filter((e) => e !== g.canvas && !e.contains(g.canvas));
  const bg0 = g.scene.background, fog0 = g.scene.fog, vis0 = new Map();
  window.__green = (on) => {                                                                 // ölçüm: dünya gizli, yeşil zemin (PiP de yeşil çizer)
    if (on) { for (const o of g.scene.children) { vis0.set(o, o.visible); o.visible = false; } g.scene.background = g.sun.color.clone().setRGB(0, 1, 0); g.scene.fog = null; if (g.post) { g._post0 = g.post.on; g.post.on = false; } }
    else { for (const [o, v] of vis0) o.visible = v; vis0.clear(); g.scene.background = bg0; g.scene.fog = fog0; if (g.post && g._post0 !== undefined) g.post.on = g._post0; }
  };
  window.__pose = (o) => {
    for (const e of hudEls) e.style.visibility = 'hidden';
    const h = document.getElementById('hud'); if (h) { h.style.visibility = o.green ? 'hidden' : 'visible'; for (const c of h.querySelectorAll(':scope > *')) c.style.visibility = /^(rdot|holo|scope|idot|cross|scopeblk|advig|pbret)$/.test(c.id) ? 'visible' : 'hidden'; }
    const SL = WSTATS[o.id].slot === 'secondary' ? 1 : 0;
    s.cur = SL; s.items[SL] = { id: o.id, mag: 30, reserve: 90 }; s.optic = o.optic; if (s.model) s.model.optic = o.optic;
    p.refreshWeapon(); p.pipForce = true;
    const vm = p.vm; vm.noSway = true; vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0; vm.breathT = 0; vm.sx = 0; vm.sy = 0;
    s.swing = null; s.reloadT = 0; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0; s.recoilP = 0; s.leanT = 0; s.ads = o.t > 0.5;
    for (let i = 0; i < 60; i++) { s.adsT = o.t; p.update(1 / 60); }
    g.hud.update(1 / 60);
    // mercek diski ekran ölçüsü (silah kamerası; NDC → CSS px)
    const d = vm.lensDisc; let lens = null;
    if (d) {
      vm.root.updateMatrixWorld(true); vm.cam.updateMatrixWorld(true);
      const c = d.getWorldPosition(new (d.position.constructor)()), r = d.geometry.parameters.radius;
      const e = d.localToWorld(new (d.position.constructor)(r, 0, 0)), f = d.localToWorld(new (d.position.constructor)(0, r, 0));
      const pr = (v) => { const q = v.clone().project(vm.cam); return [(q.x + 1) / 2 * innerWidth, (1 - q.y) / 2 * innerHeight]; };
      const C = pr(c), E = pr(e), F = pr(f);
      lens = { cx: C[0], cy: C[1], rx: Math.hypot(E[0] - C[0], E[1] - C[1]), ry: Math.hypot(F[0] - C[0], F[1] - C[1]) };
    }
    return { lens, W: innerWidth, H: innerHeight, vmFov: vm.cam.fov, pos: vm.root.children[0]?.position?.toArray?.() };
  };
});
// yeşil kare çözümlemesi (tarayıcıda)
const ANALYZE = async ({ b64, lens, dpr }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const W = img.width, H = img.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c2 = cv.getContext('2d'); c2.drawImage(img, 0, 0); const d = c2.getImageData(0, 0, W, H).data;
  const green = (i) => d[i + 1] > 45 && d[i + 1] > d[i] * 1.6 && d[i + 1] > d[i + 2] * 1.6;
  let inN = 0, inCov = 0, outN = 0, outCov = 0, all = 0;
  const L = lens && { cx: lens.cx * dpr, cy: lens.cy * dpr, r: Math.min(lens.rx, lens.ry) * dpr * 0.94 };     // kenarın %6'sı (halka kenarı / yumuşatma) sayılmaz
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, gr = green(i); if (!gr) all++;
    if (L && Math.hypot(x + 0.5 - L.cx, y + 0.5 - L.cy) < L.r) { inN++; if (!gr) inCov++; } else { outN++; if (!gr) outCov++; }
  }
  return { inCov: inN ? inCov / inN : 0, outCov: outCov / outN, all: all / (W * H) };
};
const ACOG = ['m4a1', 'ak47', 'scarh', 'aug', 'g36', 'mp5', 'lmg', 'svd'];
const JOBS = [];
for (const id of ACOG) for (const t of [1, 0.7]) JOBS.push({ id, optic: 'acog', t });
if (process.env.RD) for (const id of ['m4a1', 'ak47', 'mp5', 'pistol']) JOBS.push({ id, optic: 'reddot', t: 1 });      // RD=1: red dot tam nişan (12.130 nokta boyu)
for (const id of ['pbrifle', 'pbpistol']) for (const t of [0, 0.5, 1]) JOBS.push({ id, optic: id === 'pbrifle' ? 'reddot' : 'iron', t });
const dpr = await page.evaluate(() => devicePixelRatio), rows = [];
for (const o of JOBS) {
  const name = `${dev}-${o.id}-${o.optic}-${Math.round(o.t * 100)}`;
  if (only && !only.test(name)) continue;
  const info = await page.evaluate((q) => window.__pose(q), o);
  await page.waitForTimeout(90);
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.evaluate(() => window.__green(true));
  await page.evaluate((q) => window.__pose({ ...q, green: 1 }), o);
  await page.waitForTimeout(90);
  const buf = await page.screenshot({ scale: 'device' });
  await page.evaluate(() => window.__green(false));
  const m = await page.evaluate(ANALYZE, { b64: buf.toString('base64'), lens: info.lens, dpr });
  const L = info.lens, row = { name, ...m, vmFov: info.vmFov };
  if (L) Object.assign(row, { dx: L.cx - info.W / 2, dy: L.cy - info.H / 2, diaH: (2 * L.ry) / info.H });
  rows.push(row);
  console.log(`${name.padEnd(28)} ${L ? `merkez ${row.dx.toFixed(1)},${row.dy.toFixed(1)} px · çap %${(row.diaH * 100).toFixed(1)} · mercek örtüsü %${(m.inCov * 100).toFixed(1)} · ` : ''}dış silah %${(m.outCov * 100).toFixed(1)} · toplam silah %${(m.all * 100).toFixed(1)} · vmFov ${info.vmFov.toFixed(1)}`);
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
console.log('hata:', errs.length, errs.slice(0, 5));
await browser.close();
