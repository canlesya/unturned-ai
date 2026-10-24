// Cephe botları mevzide (kuşbakışı + rol etiketi) ve çatışma anı (birinci şahıs, HUD açık):  GPU=1 URL=… OUT=… node scripts/frontbotshot.mjs
// Etiket: savunan mevzi türü (T ateş basamağı · M makineli · K keskin nişancı · P pusu · S siper) / G koruma; saldıran H hücum · Y kanat · N nişancı. Kırmızı / mavi renk.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-cephe/bots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=12v12&map=cephe&type=front&debug=1&nolock=1&team=blue&cls=assault&autoplay=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
await page.evaluate(() => { const g = window.__game; g.devGod = true; g.timeLeft = 1800; });
const SETTLE = +(process.env.SETTLE || 26) * 1000;
await page.waitForTimeout(SETTLE);
// 1) kuşbakışı: birinci hat çevresi, sissiz; rol etiketleri
await page.evaluate(() => {
  const g = window.__game, c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  const f = g.scene.fog; if (f) { f.near = 4000; f.far = 5000; }
  P.render = function () { if (this._cam) { const [p, t, fov] = this._cam; c.position.set(...p); c.lookAt(...t); c.fov = fov; c.far = 900; c.updateProjectionMatrix(); } orig.call(this); };
  g._cam = [[0, 95, 92], [0, 0, 52], 50];
  const box = document.createElement('div'); box.id = 'botlbl'; box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99'; document.body.appendChild(box);
  const KIND = { fire: 'T', mg: 'M', sniper: 'K', ambush: 'P', cover: 'S' }, ROLE = { assault: 'H', flank: 'Y', over: 'N', guard: 'G' };
  const v = new (c.position.constructor)();
  window.__lbl = () => {
    box.innerHTML = '';
    for (const b of g.brains) {
      const s = b.s; if (!s.alive) continue;
      v.set(s.pos.x, s.pos.y + 2.3, s.pos.z).project(c);
      if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      const t = b.frAt ? KIND[b.frAt.kind] : ROLE[b.frRole] || '?', col = s.team === 'blue' ? '#5ab0ff' : '#ff6a55';
      const e = document.createElement('div');
      e.textContent = t + (b.frAt && !s.crouching ? '↑' : '');
      e.style.cssText = `position:absolute;left:${((v.x + 1) / 2 * innerWidth).toFixed(0)}px;top:${((1 - v.y) / 2 * innerHeight).toFixed(0)}px;transform:translate(-50%,-50%);font:800 15px Arial;color:#fff;background:${col};border:1px solid #000;border-radius:3px;padding:0 4px`;
      box.appendChild(e);
    }
  };
});
await page.waitForTimeout(400);
await page.evaluate(() => window.__lbl());
await page.screenshot({ path: `${OUT}/botlar-mevzide-kusbakisi.png` });
await page.evaluate(() => { const g = window.__game; g._cam = [[-34, 30, 64], [-20, 0, 42], 48]; });
await page.waitForTimeout(300); await page.evaluate(() => window.__lbl());
await page.screenshot({ path: `${OUT}/botlar-mevzide-yakin.png` });
const st = await page.evaluate(() => { const g = window.__game, r = {}; for (const b of g.brains) { const k = b.s.team + ':' + (b.frAt ? 'post-' + b.frAt.kind : b.frRole); r[k] = (r[k] || 0) + 1; } return r; });
// 2) çatışma anı: oyuncu (otomatik oynayan bot beyni) birinci şahısta, HUD açık
await page.evaluate(() => {
  const g = window.__game, P = Object.getPrototypeOf(g); g._cam = null; document.getElementById('botlbl').remove();
  g.hud.root.style.display = ''; delete g.player.vm.render; const f = g.scene.fog; if (f) { f.near = g.map.env.fog[1]; f.far = g.map.env.fog[2]; }
});
let shot = 0;
for (let i = 0; i < 40 && shot < 3; i++) {
  await page.waitForTimeout(700);
  const fighting = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier, b = g.brains.find((q) => q.s === me); return me.alive && !!b?.target && b.target.alive; });
  if (fighting) { await page.screenshot({ path: `${OUT}/catisma-${++shot}.png` }); await page.waitForTimeout(1500); }
}
console.log(JSON.stringify({ roles: st, combatShots: shot, errs }));
await browser.close();
