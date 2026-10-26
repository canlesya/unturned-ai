// Nişangâh taraması (12.139, gerçek GPU, headless:false): TÜM silah × izinli nişangâh, birinci şahıs dünya görünür kareler (bel / %50 / %70 / tam nişan)
// + yeşil zeminli ölçüm: merkez dairesinde (r = ekran yüksekliğinin %12'si) silah / nişangâh örtüsü, tüm ekranda silah oranı.
//   node scripts/opticaudit.mjs <çıktı klasörü> [taban url]    DEV=desk|mob  ONLY=regex (silah-nişangâh-yüzde)  T=0,0.5,0.7,1  SKIN=gold (kaplama)  JSON=dosya  RESUME=1
// Kare adı: <dev>-<silah>-<nişangâh>-<yüzde>.png   (montaj: scripts/opticsheet.py)
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-optics/now', base = process.argv[3] || 'http://127.0.0.1:5180';
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null, dev = process.env.DEV || 'desk';
const TS = (process.env.T || '0,0.5,0.7,1').split(',').map(Number), SKIN = process.env.SKIN || 'std';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
const page = await ctx.newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${dev === 'mob' ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
const combos = await page.evaluate(async (SKIN) => {
  const { WSTATS, OPTIC_ALLOWED } = await import('/src/game/stats.js');
  const g = window.__game, p = g.player, s = p.s;
  g.brains.forEach((b) => (b.update = () => {}));
  g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; o.syncModel?.(0); });
  g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;
  s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.vel.set(0, 0, 0); s.yaw = 0.6; s.pitch = 0.05; s.protT = 1e9;
  if (SKIN !== 'std') s.skinOf = () => SKIN;
  const hudEls = [...document.body.children].filter((e) => e !== g.canvas && !e.contains(g.canvas));
  const bg0 = g.scene.background, fog0 = g.scene.fog, vis0 = new Map();
  window.__green = (on) => {
    if (on) { for (const o of g.scene.children) { vis0.set(o, o.visible); o.visible = false; } g.scene.background = g.sun.color.clone().setRGB(0, 1, 0); g.scene.fog = null; if (g.post) { g._post0 = g.post.on; g.post.on = false; } }
    else { for (const [o, v] of vis0) o.visible = v; vis0.clear(); g.scene.background = bg0; g.scene.fog = fog0; if (g.post && g._post0 !== undefined) g.post.on = g._post0; }
  };
  window.__pose = (o) => {
    for (const e of hudEls) e.style.visibility = 'hidden';
    const h = document.getElementById('hud'); if (h) { h.style.visibility = o.green ? 'hidden' : 'visible'; for (const c of h.querySelectorAll(':scope > *')) c.style.visibility = /^(rdot|holo|scope|idot|cross|scopeblk|advig|pbret)$/.test(c.id) ? 'visible' : 'hidden'; }
    const SL = WSTATS[o.id].slot === 'secondary' ? 1 : 0;
    s.cur = SL; s.items[SL] = { id: o.id, mag: 30, reserve: 90 }; s.optic = o.optic; if (s.model) s.model.optic = o.optic;
    p.refreshWeapon();
    const vm = p.vm; vm.noSway = true; vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0; vm.breathT = 0; vm.sx = 0; vm.sy = 0;
    s.swing = null; s.reloadT = 0; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0; s.recoilP = 0; s.leanT = 0; s.ads = o.t > 0.5;
    for (let i = 0; i < 60; i++) { s.adsT = o.t; p.update(1 / 60); }
    g.hud.update(1 / 60);
    return { overlay: s.overlay, vmFov: vm.cam.fov };
  };
  const list = [];
  for (const [id, st] of Object.entries(WSTATS)) if (st.kind === 'gun') for (const o of OPTIC_ALLOWED[id] || []) list.push([id, o]);
  return list;
}, SKIN);
// yeşil kare: merkez dairesinde (r = 0,12 H) ve tüm ekranda yeşil olmayan oran
const ANALYZE = async ({ b64 }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const W = img.width, H = img.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c2 = cv.getContext('2d'); c2.drawImage(img, 0, 0); const d = c2.getImageData(0, 0, W, H).data;
  const green = (i) => d[i + 1] > 45 && d[i + 1] > d[i] * 1.6 && d[i + 1] > d[i + 2] * 1.6;
  const R = H * 0.12; let cN = 0, cC = 0, all = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, gr = green(i); if (!gr) all++;
    if (Math.hypot(x + 0.5 - W / 2, y + 0.5 - H / 2) < R) { cN++; if (!gr) cC++; }
  }
  return { center: cC / cN, all: all / (W * H) };
};
const rows = [];
for (const [id, optic] of combos) for (const t of TS) {
  const name = `${dev}-${id}-${optic}-${Math.round(t * 100)}`;
  if (only && !only.test(`${id}-${optic}-${Math.round(t * 100)}`)) continue;
  if (process.env.RESUME && existsSync(`${out}/${name}.png`)) continue;      // RESUME=1: var olan kareleri atla
  const info = await page.evaluate((q) => window.__pose(q), { id, optic, t });
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.evaluate(() => window.__green(true));
  await page.evaluate((q) => window.__pose({ ...q, green: 1 }), { id, optic, t });
  await page.waitForTimeout(80);
  const buf = await page.screenshot();
  await page.evaluate(() => window.__green(false));
  const m = await page.evaluate(ANALYZE, { b64: buf.toString('base64') });
  rows.push({ name, id, optic, t, ...m, ...info });
  console.log(`${name.padEnd(30)} merkez örtü %${(m.center * 100).toFixed(1)} · ekranda silah %${(m.all * 100).toFixed(1)} · ${info.overlay} · vmFov ${info.vmFov.toFixed(1)}`);
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
console.log(`${rows.length} kare · hata:`, errs.length, errs.slice(0, 5));
await browser.close();
