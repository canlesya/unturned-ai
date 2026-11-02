// Kum Köyü (12.224) tarayıcıda botlu maç: 5v5 Takım Çatışması, oyuncu da bot (autoplay). İlk görüş / isabet / öldürme (oyun saati), kare süresi,
// 8. / 12. / 20. saniyede yukarıdan çatışma görüntüsü + oyuncu gözü.  BASE=http://127.0.0.1:5180 OUT=/tmp/wb-koy [TOD=day] node scripts/koymatch.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT || '/tmp/wb-koy'; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:5180', TOD = process.env.TOD || 'day';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await page.goto(`${BASE}/?autostart=5v5&map=uykukoy&type=tdm&dev=1&debug=1&nolock=1&autoplay=1&time=300&tod=${TOD}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
await page.evaluate(() => {
  const g = window.__game, W = (window.__km = { ft: [], see: null, hit: null, kill: null, t0: g.time });
  let last = 0; const f = (t) => { if (last) W.ft.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
  const V = g.camera.position.constructor, e = new V(), c = new V();
  setInterval(() => {
    const t = g.time - W.t0;
    if (W.see === null) { const B = g.soldiers.filter((s) => s.alive && s.team === 'blue'), R = g.soldiers.filter((s) => s.alive && s.team === 'red'); for (const a of B) for (const b of R) if (W.see === null && g.botSees(a.eye(e), c.set(b.pos.x, b.pos.y + 1.2, b.pos.z))) W.see = t; }
    if (W.hit === null && g.soldiers.some((s) => s.hp < 100 || !s.alive)) W.hit = t;
    if (W.kill === null && g.soldiers.some((s) => (s.kills || 0) > 0)) W.kill = t;
  }, 50);
});
const top = async (name, pos, look) => {
  await page.evaluate(([pos, look]) => { const g = window.__game, P = Object.getPrototypeOf(g); if (!P._kmR) P._kmR = P.render; g._kmCam = { pos, look }; P.render = function () { const k = this._kmCam; if (k) { const c = this.camera; c.position.set(...k.pos); c.lookAt(...k.look); c.fov = 55; c.updateProjectionMatrix(); } P._kmR.call(this); }; }, [pos, look]);
  await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/${TOD}-maç-${name}.png` });
  await page.evaluate(() => { const g = window.__game; g._kmCam = null; g.camera.fov = 75; g.camera.updateProjectionMatrix(); });
};
for (const [sec, name] of [[8, '08sn'], [12, '12sn'], [20, '20sn']]) {
  await page.waitForFunction((s) => window.__game.time - window.__km.t0 >= s, sec, { timeout: 120000 });
  await top(name + '-yukarıdan', [-4, 46, 30], [2, 0, 0]);
  await page.screenshot({ path: `${OUT}/${TOD}-maç-${name}-göz.png` });
}
const R = await page.evaluate(() => { const W = window.__km, g = window.__game, ft = W.ft.slice(30).sort((a, b) => a - b), q = (p) => ft[Math.min(ft.length - 1, Math.floor(ft.length * p))];
  return { see: W.see, hit: W.hit, kill: W.kill, frames: ft.length, avg: +(ft.reduce((a, b) => a + b, 0) / ft.length).toFixed(2), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: +ft[ft.length - 1].toFixed(1), gt33: ft.filter((x) => x > 33).length,
    kills: g.soldiers.reduce((a, s) => a + (s.kills || 0), 0), alive: g.soldiers.filter((s) => s.alive).length, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }; });
console.log(`tarayıcı maçı (${TOD}): ilk görüş ${R.see?.toFixed(1)} sn · ilk isabet ${R.hit?.toFixed(1)} sn · ilk öldürme ${R.kill?.toFixed(1)} sn · 20 sn'de ${R.kills} öldürme · kare ort ${R.avg} ms p95 ${R.p95} p99 ${R.p99} en çok ${R.max} (>33 ms: ${R.gt33}/${R.frames}) · çizim ${R.calls}, üçgen ${R.tris}`);
console.log('hata', errs.length, errs.slice(0, 4));
fs.writeFileSync(`${OUT}/koymatch-${TOD}.json`, JSON.stringify({ ...R, errs }, null, 1));
await browser.close();
