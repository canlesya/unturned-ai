// 12.210 Silah değiştirme takılması ölçümü (gerçek GPU, Metal): rAF kare aralıkları + değişim anındaki iş dökümü (Performance API).
//   node scripts/swapperf.mjs <çıktı.json> [taban url]
//   MAP=colgecidi|kuzey  SIZE=3v3|64v64  DEV=desk|mob  (mob = Pixel 7 yatay + touch=1)  PASSES=2 (1. tur soğuk, 2. tur sıcak)
// Yollar: J/K (geliştirici: yuvadaki silahı sıradakiyle değiştir; her yuva), 1/2/3/4 yuva tuşları, fare tekerleği.
// Her olay için: olaydan sonraki 450 ms içindeki en uzun kare, olay karesinin iş dökümü (refreshWeapon / vm.setItem / 3. şahıs setWeapon /
// ana sahne + silah sahnesi çizimi), o karede derlenen yeni WebGL program sayısı.
import { chromium, firefox, devices } from 'playwright';
import fs from 'fs';
const OUT = process.argv[2] || '/tmp/wb-swap/swap.json', base = process.argv[3] || 'http://127.0.0.1:5297';
const MAP = process.env.MAP || 'colgecidi', SIZE = process.env.SIZE || '3v3', DEV = process.env.DEV || 'desk', PASSES = +(process.env.PASSES || 2);
const JK = +(process.env.JK || 6);      // yuva başına J/K adımı (her adım yeni silah)
const FF = process.env.BROWSER === 'firefox';      // Firefox: KHR_parallel_shader_compile yok, programlar eşzamanlı derlenir (12.151)
const browser = FF ? await firefox.launch({ headless: false }) : await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const { defaultBrowserType, ...px } = devices['Pixel 7 landscape'];
const ctx = await browser.newContext(DEV === 'mob' ? { ...px, ...(FF ? { isMobile: undefined } : {}), locale: 'tr-TR' } : { viewport: { width: 1600, height: 900 }, locale: 'tr-TR' });
const page = await ctx.newPage();
if (+process.env.CPU > 1 && !FF) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.CPU }); }      // CPU=4: zayıf işlemci benzetimi
const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.error('[sayfa hatası]', e.message); });
const type = MAP === 'kuzey' ? 'conquest' : 'tdm';
await page.goto(`${base}/?autostart=${SIZE}&map=${MAP}&type=${type}&debug=1&dev=1&nolock=1${DEV === 'mob' ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 300000 });
await page.waitForTimeout(2500);
const warm = await page.evaluate(() => window.__game.warm);
await page.evaluate(() => {
  const g = window.__game, p = g.player, s = g.playerSoldier, r = g.renderer;
  g.devGod = true; s.protT = 1e9; s.fly = false; s.vel.set(0, 0, 0);      // geliştirici modunda uçuş açık başlar: tekerlek uçuş hızını ayarlıyordu
  // iş dökümü: sarılan işlevlerin bu karedeki toplam süresi
  const acc = (window.__acc = {});
  const wrap = (o, k, name) => { const f = o[k]; if (!f || f.__w) return; const w = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { acc[name] = (acc[name] || 0) + performance.now() - t; } }; w.__w = 1; o[k] = w; };
  wrap(p, 'refreshWeapon', 'refreshWeapon');
  wrap(p.vm, 'setItem', 'vm.setItem');
  wrap(s, '_syncWeaponModel', 'syncWeaponModel3p');
  if (s.model?.setWeapon) wrap(s.model, 'setWeapon', 'model.setWeapon');
  wrap(g, 'step', 'step');
  wrap(g.hud, 'update', 'hud.update');
  wrap(g.hud, 'toast', 'hud.toast');
  wrap(p.vm, 'render', 'vm.render');
  const gl = r.getContext(), lp = gl.linkProgram.bind(gl);      // gerçek derleme / bağlama sayısı (program sayısı aynı kalsa da silinip yeniden derlenen program görünsün)
  window.__links = 0; gl.linkProgram = (pr) => { window.__links++; return lp(pr); };
  const ro = r.render.bind(r);
  r.render = (sc, cam) => { const t = performance.now(); ro(sc, cam); const k = sc === g.scene ? 'render.main' : 'render.other'; acc[k] = (acc[k] || 0) + performance.now() - t; };
  window.__frames = []; window.__loaf = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__loaf.push({ t: e.startTime, d: e.duration, block: e.blockingDuration, render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0, style: e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0, scripts: (e.scripts || []).map((x) => ({ d: +x.duration.toFixed(1), inv: x.invoker, src: (x.sourceFunctionName || '') + '@' + (x.sourceURL || '').split('/').pop() + ':' + x.sourceCharPosition })) }); }).observe({ type: 'long-animation-frame', buffered: false }); } catch (e) {}      // Chromium: uzun kare dökümü (betik / stil-yerleşim / çizim)
  let last = performance.now();
  const tick = (t) => {
    const pr = r.info.programs.length;
    window.__frames.push({ t, dt: t - last, acc: { ...acc }, prog: pr });
    for (const k in acc) delete acc[k];
    last = t; requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
// her olay: işaretle → eylem → 450 ms bekle → pencere içi en uzun kare + o karenin dökümü
const rows = [];
const ev = async (label, fn) => {
  const before = await page.evaluate(() => ({ t: performance.now(), id: window.__game.playerSoldier.item.id, prog: window.__game.renderer.info.programs.length, links: window.__links }));
  await fn();
  await page.waitForTimeout(450);
  const r = await page.evaluate((t0) => {
    const F = window.__frames.filter((f) => f.t > t0), g = window.__game;
    let m = F[0] || { dt: 0, acc: {} };
    for (const f of F) if (f.dt > m.dt) m = f;
    const sum = {}; for (const f of F.slice(0, 4)) for (const k in f.acc) sum[k] = +((sum[k] || 0) + f.acc[k]).toFixed(1);
    const loaf = window.__loaf.filter((e) => e.t > t0 - 5).map((e) => ({ d: +e.d.toFixed(1), render: +e.render.toFixed(1), style: +e.style.toFixed(1), scripts: e.scripts.filter((x) => x.d >= 1) }));
    return { loaf, max: +m.dt.toFixed(1), acc: Object.fromEntries(Object.entries(m.acc).map(([k, v]) => [k, +v.toFixed(1)])), sum4: sum, id: g.playerSoldier.item.id, prog: g.renderer.info.programs.length, links: window.__links, dts: F.slice(0, 12).map((f) => +f.dt.toFixed(1)) };
  }, before.t);
  r.label = label; r.from = before.id; r.newProg = r.prog - before.prog; r.link = r.links - before.links;
  rows.push(r);
  if (process.env.LOAF) for (const l of r.loaf) console.log('   LoAF', JSON.stringify(l));
  console.log(`${label.padEnd(22)} ${before.id.padEnd(12)}→ ${r.id.padEnd(12)} max ${String(r.max).padStart(6)} ms  prog+${r.newProg} link ${r.link}  ${JSON.stringify(r.acc)}`);
};
await page.mouse.move(800, 450);
// baz çizgi: değişim yok
await ev('idle', async () => {});
for (let pass = 0; pass < PASSES; pass++) {
  const tag = pass === 0 ? 'soğuk' : 'sıcak';
  // yuva tuşları: 1 → 2 → 3 → 4 → 1, 3 → 1
  for (const k of ['Digit2', 'Digit3', 'Digit4', 'Digit1', 'Digit3', 'Digit1']) await ev(`${tag} slot ${k}`, () => page.keyboard.press(k));
  // fare tekerleği (nolock: locked = true varsayılır mı? değilse kilidi taklit et)
  await page.evaluate(() => { window.__game.player.locked = true; });
  for (let i = 0; i < 4; i++) await ev(`${tag} wheel`, () => page.evaluate(() => { window.__game.player.locked = true; window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 })); }));
  // J/K: her yuvada ileri K adımları, sonra aynı sayıda geri J (sıcak turda aynı silahlar)
  for (const k of ['Digit1', 'Digit2', 'Digit3', 'Digit4']) {
    await page.keyboard.press(k); await page.waitForTimeout(300);
    for (let i = 0; i < JK; i++) await ev(`${tag} K ${k}`, () => page.keyboard.press('KeyK'));
    for (let i = 0; i < JK; i++) await ev(`${tag} J ${k}`, () => page.keyboard.press('KeyJ'));
  }
  await page.keyboard.press('Digit1'); await page.waitForTimeout(300);
}
// 3. şahıs: diğer askerlerin elindeki silah modelinin yeniden kurulması (bot silah değiştirir / bomba çeker) — 6 sn'de çağrı sayısı ve süresi
const tp = await page.evaluate(async () => {
  const g = window.__game, st = { n: 0, ms: 0, max: 0 };
  for (const o of g.soldiers) { const m = o.model; if (!m?.setWeapon || m.__w3) continue; const f = m.setWeapon; m.__w3 = 1; m.setWeapon = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { const d = performance.now() - t; st.n++; st.ms += d; st.max = Math.max(st.max, d); } }; }
  await new Promise((r) => setTimeout(r, 6000));
  return { n: st.n, ms: +st.ms.toFixed(1), max: +st.max.toFixed(2), soldiers: g.soldiers.length };
});
console.log('3. şahıs setWeapon (6 sn):', JSON.stringify(tp));
const idle = await page.evaluate(() => { const f = window.__frames.slice(-120).map((x) => x.dt).sort((a, b) => a - b); return { med: +f[f.length >> 1].toFixed(1) }; });
await page.screenshot({ path: OUT.replace(/\.json$/, '.png') });
const sum = {};
for (const r of rows) { const [t, w] = r.label.split(' '); const key = t === 'idle' ? 'idle' : t + ' ' + (w === 'K' || w === 'J' ? 'J/K' : w === 'slot' ? '1-4' : w); (sum[key] ||= []).push(r.max); }
const table = Object.fromEntries(Object.entries(sum).map(([k, v]) => { const s = v.slice().sort((a, b) => a - b); return [k, { n: v.length, max: s[s.length - 1], med: s[s.length >> 1] }]; }));
const rep = { thirdPerson: tp, BROWSER: FF ? 'firefox' : 'chromium', MAP, SIZE, DEV, CPU: +process.env.CPU || 1, warm, idle, table, rows, errs };
fs.mkdirSync(OUT.replace(/\/[^/]*$/, ''), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(rep, null, 1));
console.log(JSON.stringify({ MAP, SIZE, DEV, warm, idle, table, errs }, null, 1));
await browser.close();
