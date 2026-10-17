// Depo haritası görüntüleri: kuşbakışı + bakış noktaları (masaüstü, Pixel 7 yatay touch=1, iPhone 14 yatay), düşman görünürlüğü (10–40 m),
// çizim çağrısı / üçgen / kare süresi, küçük resim (THUMB=1 → public/img/depo.jpg).
//   node scripts/deposhots.mjs   [URL=http://127.0.0.1:5195] [OUT=/tmp/wb-depo-shots] [ONLY=desktop,pixel7,iphone14] [VIEWS=ad1,ad2] [TOD=day]
import { chromium, devices } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5195', OUT = process.env.OUT || '/tmp/wb-depo-shots', TOD = process.env.TOD || 'day';
fs.mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY || 'desktop,pixel7,iphone14').split(',');
const PROFILES = {
  desktop: { viewport: { width: 1280, height: 720 }, q: '' },
  pixel7: { ...devices['Pixel 7 landscape'], q: '&touch=1' },
  iphone14: { ...devices['iPhone 14 landscape'], q: '&touch=1' },
};
// bakış: [ad, x, z, yaw, pitch, y?(ayak), düşmanlar [[x, z, y?], ...]]   (yaw 0 = −z / kuzey, π/2 = batı, −π/2 = doğu, π = güney)
const P2 = Math.PI / 2;
const VIEWS = [
  ['01-mavi-dogus', 0, 31.5, 0, 0.02, 0, []],
  ['02-a-saha', -16.5, 17.0, 0.42, -0.02, 0, [[-20.5, 0.5], [-24.5, -7.5], [-17, -14]]],
  ['03-bati-kapi-disi', -14.2, -1.0, P2, -0.03, 0, [[-21, 3], [-27, -5.5], [-24.8, 7.4]]],
  ['04-b-orta-serit', 0, 7.6, 0, -0.04, 0, [[0.6, -0.5], [-1, -7.2], [8.8, -3.4, 3]]],
  ['05-asma-kat', 10.9, 0.4, P2, -0.12, 3.0, [[0, 1], [-4.2, -3], [-10.8, 0.5]]],
  ['06-c-yukleme', 20.0, 18.5, 0, -0.02, 0, [[20.5, 0.5], [23.4, -8], [16.5, -14]]],
  ['07-guney-avlu', -9.0, 20.0, -1.1, -0.03, 0, [[7.6, 11.4], [15.6, 14.8], [-2.5, 13.2]]],
  ['08-bati-serit-uzun', -29.0, 20.5, 0, 0, 0, [[-29.2, -20], [-26, -12.5]]],
  ['09-dogu-kapi-ic', 11.0, -7.4, P2, -0.03, 0, [[3.8, -7.3], [-4.6, -7.0], [0.4, -3.2]]],
  ['10-kirmizi-dogus', 0, -31.5, Math.PI, 0.02, 0, []],
];
const want = process.env.VIEWS ? process.env.VIEWS.split(',') : null;
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });   // GPU=1: gerçek GPU (kare süresi ölçümü)
const report = {};
for (const pn of ONLY) {
  const P = PROFILES[pn];
  const ctx = await browser.newContext({ ...P, q: undefined });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await page.goto(`${URL0}/?autostart=5v5&map=${process.env.MAP || 'depo'}&type=tdm&debug=1&nolock=1&tod=${TOD}${P.q}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__game;
    for (const s of g.soldiers) if (s !== g.playerSoldier) { s.brain = null; }
    g.brains.length = 0;
    g.timeLeft = 600;
    const r = g.renderer, orig = r.render.bind(r);
    window.__rt = []; r.render = (sc, cam) => { const t0 = performance.now(); orig(sc, cam); if (sc === g.scene) { window.__rt.push(performance.now() - t0); if (window.__rt.length > 300) window.__rt.shift(); window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; } };
    window.__ft = []; let last = performance.now();
    const loop = (t) => { window.__ft.push(t - last); last = t; if (window.__ft.length > 600) window.__ft.shift(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  });
  const place = async (v) => page.evaluate(([x, z, yaw, pitch, y, foes]) => {
    const g = window.__game, me = g.playerSoldier;
    me.pos.set(x, y || 0, z); me.vel.set(0, 0, 0); me.yaw = yaw; me.pitch = pitch; me.protT = 1e9; me.hp = me.maxHp;
    const reds = g.soldiers.filter((s) => s.team !== me.team);
    reds.forEach((s, i) => {
      const f = foes[i];
      if (!s.alive) { s.alive = true; s.hp = s.maxHp; }
      if (f) { s.pos.set(f[0], f[2] || 0, f[1]); s.yaw = Math.atan2(-(x - f[0]), -(z - f[1])); } else s.pos.set(-28 + i, 0, -33);
      s.vel.set(0, 0, 0); s.protT = 0;
    });
    for (const s of g.soldiers) if (s.team === me.team && s !== me) { s.pos.set(28 - s.id * 0.8, 0, 33); s.vel.set(0, 0, 0); }
    return foes.map((f) => +Math.hypot(f[0] - x, f[1] - z).toFixed(1));
  }, [v[1], v[2], v[3], v[4], v[5], v[6]]);
  const rep = { views: {}, errs, gpu: await page.evaluate(() => { const c = window.__game.renderer.getContext(), e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; }), mapMeshes: await page.evaluate(() => { let n = 0, t = 0; window.__game.map.group.traverse((o) => { if (o.isMesh) { n++; t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } }); return n + ' ağ / ' + Math.round(t) + ' üçgen'; }) };
  for (const v of VIEWS) {
    if (want && !want.some((w) => v[0].startsWith(w))) continue;
    const d = await place(v);
    await page.waitForTimeout(900);
    const vis = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; return g.soldiers.filter((s) => s.team !== me.team && s.pos.z > -32.5).map((s) => g.botSees(me.eye(me.pos.clone()), s.center(s.pos.clone()))); });
    await page.screenshot({ path: `${OUT}/${pn}-${v[0]}.png` });
    rep.views[v[0]] = { dist: d, visible: vis, info: await page.evaluate(() => window.__info) };
  }
  // kuşbakışı (yalnız masaüstü) + küçük resim
  if (pn === 'desktop' && !want) {
    await page.evaluate(() => { const g = window.__game; g.hud.root.style.display = 'none'; g.player.vm.render = () => {}; const c = g.camera; g._ovr = true;
      const P = Object.getPrototypeOf(g), orig = P.render; P.render = function () { if (this._cam) { const [p, t, f] = this._cam; c.position.set(...p); c.lookAt(...t); c.fov = f; c.updateProjectionMatrix(); } orig.call(this); }; });
    for (const [n, pos, tgt, fov] of [['00-kusbakisi', [-46, 62, 58], [0, 0, 2], 46], ['00-tepeden', [0, 120, 0.01], [0, 0, 0], 33], ['00-kusbakisi-kd', [48, 58, -56], [0, 0, -2], 46]]) {
      await page.evaluate((cam) => { window.__game._cam = cam; }, [pos, tgt, fov]);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${pn}-${n}.png` });
    }
    if (process.env.THUMB) {
      await page.setViewportSize({ width: 960, height: 540 });
      await page.evaluate(() => { window.__game._cam = [[-40, 46, 50], [1, 0, 1], 44]; });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'public/img/depo.jpg', type: 'jpeg', quality: 86 });
      await page.setViewportSize(P.viewport);
    }
    await page.evaluate(() => { window.__game._cam = null; });
  }
  // kare süresi (bakış 04: depo içi; 02: avlu)
  for (const vn of ['02-a-saha', '04-b-orta-serit']) {
    const v = VIEWS.find((q) => q[0] === vn); await place(v); await page.waitForTimeout(800);
    await page.evaluate(() => { window.__ft.length = 0; window.__rt.length = 0; }); await page.waitForTimeout(3000);
    rep['ft-' + vn] = await page.evaluate(() => { const a = window.__ft.slice(5).sort((p, q) => p - q); if (!a.length) a.push(0); return { avg: +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(1), p95: +a[Math.floor(a.length * 0.95)].toFixed(1), n: a.length, px: window.__game.renderer.getPixelRatio(), info: window.__info, cpu: +(window.__rt.reduce((s, x) => s + x, 0) / Math.max(1, window.__rt.length)).toFixed(2) }; });
  }
  report[pn] = rep;
  await ctx.close();
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
for (const [pn, r] of Object.entries(report)) {
  console.log(`── ${pn}  hata ${r.errs.length} ${r.errs.slice(0, 2).join(' | ')} · GPU ${r.gpu} · harita ağı ${r.mapMeshes}`);
  for (const [n, v] of Object.entries(r.views)) console.log(`  ${n.padEnd(22)} düşman m ${JSON.stringify(v.dist)} görünür ${JSON.stringify(v.visible)} · çağrı ${v.info?.calls} üçgen ${v.info?.tris}`);
  for (const k of Object.keys(r)) if (k.startsWith('ft-')) console.log(`  kare ${k.slice(3)}: ort ${r[k].avg} ms, p95 ${r[k].p95} ms, piksel oranı ${r[k].px}, çağrı ${r[k].info?.calls}, sahne çizimi CPU ${r[k].cpu} ms`);
}
await browser.close();
