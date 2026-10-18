// Vagon modu / Maden Ocağı görüntüleri: kuşbakışı, bakış noktaları (vagon arayüzü + işaretler), bot maçı anları; masaüstü + Pixel 7 yatay (touch=1).
//   GPU=1 node scripts/plshots.mjs   [URL=http://127.0.0.1:5220] [OUT=/tmp/wb-new-shots] [ONLY=desktop,pixel7] [VIEWS=a,b] [THUMB=1 → public/img/maden.jpg] [TOD=day]
import { chromium, devices } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5220', OUT = process.env.OUT || '/tmp/wb-new-shots', TOD = process.env.TOD || 'day';
fs.mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY || 'desktop,pixel7').split(',');
const PROFILES = { desktop: { viewport: { width: 1280, height: 720 }, q: '' }, pixel7: { ...devices['Pixel 7 landscape'], q: '&touch=1' } };
const P2 = Math.PI / 2;
// bakış: [ad, x, z, yaw, pitch, y, vagon yolu d (null = değiştirme), düşmanlar [[x, z]]]   (yaw 0 = −z kuzey, π/2 = batı, −π/2 = doğu, π = güney)
const VIEWS = [
  ['01-mavi-avlu', -44, 30, -2.2, 0.0, 0, null, []],
  ['02-vagon-baslangic', -38.6, 29.6, -2.05, -0.1, 0, 12, [[-24, 23], [-19, 25.5]]],
  ['03-kirma-tesisi', -33.5, 25, -P2, -0.04, 0, 20, [[-24.8, 27.6], [-20, 24]]],
  ['04-rampa-ustu', -36.2, 18.4, -1.2, -0.12, 1.4, 22, [[-20, 22], [-17, 14]]],
  ['05-a-makas', -18.8, 15.5, 0.1, -0.05, 0, 40, [[-17, 4], [-22, 1.5], [-12.4, 1]]],
  ['06-koy-caddesi', -15.5, 7.6, -P2 + 0.05, -0.04, 0, 52, [[-4, 3], [1, 8.4], [-1.5, -3]]],
  ['07-b-kantar', 8.6, 2.5, 0.05, -0.03, 0, 88, [[9.6, -12], [13, -16.8], [4.5, -9]]],
  ['08-lavvar-ici', 13.5, -16.4, -P2, -0.03, 0, 100, [[21, -14.5], [23.5, -18], [19, -12.8]]],
  ['09-maden-agzi', 30.6, -14.5, 0.0, 0.02, 0, 118, [[29, -28], [33, -26], [26.4, -26]]],
  ['10-tas-ocagi', 22.5, 10.5, -0.6, -0.03, 0, 100, [[33, 2.5], [37, -2.5], [29, 13]]],
];
const want = process.env.VIEWS ? process.env.VIEWS.split(',') : null;
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = {};
for (const pn of ONLY) {
  const P = PROFILES[pn];
  const ctx = await browser.newContext({ ...P, q: undefined, locale: 'tr-TR' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon|WebSocket|ERR_CONNECTION/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await page.goto(`${URL0}/?autostart=5v5&map=maden&type=payload&debug=1&nolock=1&tod=${TOD}${P.q}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__game;
    g._brains = g.brains.slice(); for (const s of g.soldiers) if (s !== g.playerSoldier) s._brain = s.brain;
    for (const s of g.soldiers) if (s !== g.playerSoldier) s.brain = null;
    g.brains.length = 0; g.timeLeft = 600;
    const r = g.renderer, orig = r.render.bind(r);
    window.__rt = []; r.render = (sc, cam) => { const t0 = performance.now(); orig(sc, cam); if (sc === g.scene) { window.__rt.push(performance.now() - t0); if (window.__rt.length > 300) window.__rt.shift(); window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; } };
    window.__ft = []; let last = performance.now();
    const loop = (t) => { window.__ft.push(t - last); last = t; if (window.__ft.length > 600) window.__ft.shift(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  });
  const place = async (v) => page.evaluate(([x, z, yaw, pitch, y, d, foes]) => {
    const g = window.__game, me = g.playerSoldier, pl = g.payload;
    if (d != null) { pl.d = pl.shown = pl.netD = d; pl.idleT = 0; }
    me.pos.set(x, y || 0, z); me.vel.set(0, 0, 0); me.yaw = yaw; me.pitch = pitch; me.protT = 1e9; me.hp = me.maxHp;
    const reds = g.soldiers.filter((s) => s.team !== me.team), blues = g.soldiers.filter((s) => s.team === me.team && s !== me);
    reds.forEach((s, i) => {
      const f = foes[i];
      if (!s.alive) { s.alive = true; s.hp = s.maxHp; }
      if (f) { s.pos.set(f[0], 0, f[1]); s.yaw = Math.atan2(-(x - f[0]), -(z - f[1])); } else s.pos.set(44 + i * 0.8, 0, 12);
      s.vel.set(0, 0, 0); s.protT = 0;
    });
    const q = pl.track.at(pl.d, {});
    blues.forEach((s, i) => { if (!s.alive) { s.alive = true; s.hp = s.maxHp; } if (i < 2) { s.pos.set(q.x - q.dz * (i ? 1.6 : -1.6), 0, q.z + q.dx * (i ? 1.6 : -1.6)); s.yaw = q.yaw; } else s.pos.set(-46 + i, 0, 34); s.vel.set(0, 0, 0); });
    return foes.map((f) => +Math.hypot(f[0] - x, f[1] - z).toFixed(1));
  }, [v[1], v[2], v[3], v[4], v[5], v[6], v[7]]);
  const rep = { views: {}, errs, gpu: await page.evaluate(() => { const c = window.__game.renderer.getContext(), e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; }), mapMeshes: await page.evaluate(() => { let n = 0, t = 0; window.__game.map.group.traverse((o) => { if (o.isMesh) { n++; t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } }); return n + ' ağ / ' + Math.round(t) + ' üçgen'; }) };
  for (const v of VIEWS) {
    if (want && !want.some((w) => v[0].startsWith(w))) continue;
    const d = await place(v);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${pn}-${v[0]}.png` });
    rep.views[v[0]] = { dist: d, info: await page.evaluate(() => window.__info) };
  }
  if (pn === 'desktop' && !want) {
    await page.evaluate(() => { const g = window.__game; g.hud.root.style.display = 'none'; g.player.vm.render = () => {}; const c = g.camera;
      const P = Object.getPrototypeOf(g), orig = P.render; P.render = function () { if (this._cam) { const [p, t, f] = this._cam; c.position.set(...p); c.lookAt(...t); c.fov = f; c.updateProjectionMatrix(); } orig.call(this); }; });
    await page.evaluate(() => { const pl = window.__game.payload; pl.d = pl.shown = 70; });
    for (const [n, pos, tgt, fov] of [['00-kusbakisi-gb', [-70, 66, 66], [-2, 0, 0], 50], ['00-tepeden', [0, 150, 0.01], [0, 0, 0], 38], ['00-kusbakisi-kd', [66, 60, -66], [0, 0, 0], 50], ['00-alcak-gb', [-52, 22, 40], [-10, 0, 4], 55]]) {
      await page.evaluate((cam) => { window.__game._cam = cam; }, [pos, tgt, fov]);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${pn}-${n}.png` });
    }
    if (process.env.THUMB) {
      await page.setViewportSize({ width: 960, height: 540 });
      await page.evaluate(() => { const pl = window.__game.payload; pl.d = pl.shown = 54; window.__game._cam = [[-58, 44, 52], [-4, 0, 2], 46]; });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'public/img/maden.jpg', type: 'jpeg', quality: 86 });
      await page.setViewportSize(P.viewport);
    }
    await page.evaluate(() => { const g = window.__game; g._cam = null; g.hud.root.style.display = ''; });
  }
  // kare süresi (köy caddesi + lavvar)
  for (const vn of ['06-koy-caddesi', '03-kirma-tesisi']) {
    const v = VIEWS.find((q) => q[0] === vn); await place(v); await page.waitForTimeout(800);
    await page.evaluate(() => { window.__ft.length = 0; window.__rt.length = 0; }); await page.waitForTimeout(3000);
    rep['ft-' + vn] = await page.evaluate(() => { const a = window.__ft.slice(5).sort((p, q) => p - q); if (!a.length) a.push(0); return { avg: +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(1), p95: +a[Math.floor(a.length * 0.95)].toFixed(1), px: window.__game.renderer.getPixelRatio(), info: window.__info }; });
  }
  // bot maçı: botlar geri, oyuncu da bot (autoplay benzeri) — 3 an
  if (!want || want.includes('bots')) {
    await page.evaluate(() => { const g = window.__game; for (const s of g.soldiers) if (s._brain) s.brain = s._brain; g.brains.push(...g._brains); const pl = g.payload; pl.d = pl.shown = 30; g.playerSoldier.protT = 0; });
    for (let k = 0; k < 3; k++) {
      await page.evaluate(() => { const g = window.__game, me = g.playerSoldier, pl = g.payload; const q = pl.track.at(pl.d, {}); if (!me.alive) { me.alive = true; me.hp = me.maxHp; } me.pos.set(q.x - q.dz * 5 + q.dx * -6, 0, q.z + q.dx * 5 - q.dz * 6); me.yaw = Math.atan2(-(q.x - me.pos.x), -(q.z - me.pos.z)); me.pitch = -0.05; me.protT = 1e9; });
      await page.waitForTimeout(6000);
      await page.screenshot({ path: `${OUT}/${pn}-20-botlar-${k}.png` });
    }
    rep.botState = await page.evaluate(() => { const pl = window.__game.payload; return { d: +pl.d.toFixed(1), state: pl.state, reached: pl.reached, kills: window.__game.soldiers.reduce((a, s) => a + s.kills, 0) }; });
  }
  report[pn] = rep;
  await ctx.close();
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
for (const [pn, r] of Object.entries(report)) {
  console.log(`── ${pn}  hata ${r.errs.length} ${r.errs.slice(0, 3).join(' | ')} · GPU ${r.gpu} · harita ağı ${r.mapMeshes}`);
  for (const [n, v] of Object.entries(r.views)) console.log(`  ${n.padEnd(22)} düşman m ${JSON.stringify(v.dist)} · çağrı ${v.info?.calls} üçgen ${v.info?.tris}`);
  for (const k of Object.keys(r)) if (k.startsWith('ft-')) console.log(`  kare ${k.slice(3)}: ort ${r[k].avg} ms, p95 ${r[k].p95} ms, piksel oranı ${r[k].px}, çağrı ${r[k].info?.calls}`);
  if (r.botState) console.log('  bot maçı:', JSON.stringify(r.botState));
}
await browser.close();
