// Enfekte modu ekran görüntüleri: insan HUD'u, zombi görünümü (3. şahıs + pençeler), enfekte ölüm ekranı, bitiş. Çıktı: <önek>-*.png
import { chromium } from 'playwright';
const pre = process.argv[2] || 'screenshots/inf';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?autostart=6v6&type=inf&debug=1&nolock=1&third=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
const adv = (n = 6) => page.evaluate((n) => { const g = window.__game; for (let i = 0; i < n; i++) g.step(1 / 30); return null; }, n);
await page.evaluate(() => { const g = window.__game; g.brains.forEach((b) => (b.update = () => {})); g.playerSoldier.protT = 0; });
await adv(20);
await page.screenshot({ path: `${pre}-1-insan.png` });
console.log('insan:', await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; return JSON.stringify({ team: p.team, cls: p.cls, c: g.infCounts(), tk: g.tickets, hud: [document.getElementById('tnB').textContent, document.getElementById('tkB').textContent, document.getElementById('tnR').textContent, document.getElementById('tkR').textContent] }); }));
// bir zombiyi oyuncunun önüne koy, 3. şahıs/yakından bak
await page.evaluate(() => {
  const g = window.__game, p = g.playerSoldier, z = g.soldiers.find((s) => s.def.zombie);
  const T = p.eye().constructor, e = p.eye();
  for (let k = 0; k < 16; k++) { p.yaw = (k / 16) * Math.PI * 2; const a = new T(e.x - Math.sin(p.yaw) * 9, e.y, e.z - Math.cos(p.yaw) * 9); if (g.losClear(e, a)) break; }
  z.pos.set(p.pos.x - Math.sin(p.yaw) * 3.2, p.pos.y, p.pos.z - Math.cos(p.yaw) * 3.2); z.yaw = p.yaw + Math.PI; z.vel.set(0, 0, 0); z.protT = 0;
  g.world.settle(z); g.zshot = z;
});
await adv(6);
await page.screenshot({ path: `${pre}-2-zombi-karsida.png` });
// bütün zombi türleri yan yana
await page.evaluate(() => {
  const g = window.__game, p = g.playerSoldier, types = ['walker', 'runner', 'brute', 'ghost', 'blinker'];
  const zs = g.soldiers.filter((s) => s.def.zombie && s !== p), r = { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) };
  const others = g.soldiers.filter((s) => s !== p && !s.def.zombie && s.alive);
  for (let i = 0; i < 5; i++) {
    const z = zs[i] || others[i]; if (!z) continue;
    if (!z.def.zombie) g.makeZombie(z, false, types[i]); else { z.ztype = types[i]; z.setClass('zombie'); }
    z.spawn({ x: p.pos.x - Math.sin(p.yaw) * 5.5 + r.x * (i - 2) * 1.9, z: p.pos.z - Math.cos(p.yaw) * 5.5 + r.z * (i - 2) * 1.9, ry: p.yaw + Math.PI }, 0); z.protT = 0; z.vel.set(0, 0, 0); g.world.settle(z);
    if (i === 3) { z.abT = 0; z.useAbility(); z.pos.x += 0; }
  }
});
await adv(6);
await page.screenshot({ path: `${pre}-7-turler.png` });
// oyuncuyu enfekte et: öldür → ölüm ekranı → zombi doğuş
await page.evaluate(() => { const g = window.__game, p = g.playerSoldier, z = g.zshot; z.pos.y = -50; p.takeDamage(999, z, 'body', z.pos, 'Pençe'); });
await adv(10);
await page.screenshot({ path: `${pre}-3-olum-ekrani.png` });
await page.evaluate(() => { const g = window.__game; g.playerSoldier.respawnT = 0; });
await adv(10);
console.log('enfekte:', await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; return JSON.stringify({ team: p.team, cls: p.cls, hp: p.hp, maxHp: p.maxHp, items: p.items.map((i) => i.id), alive: p.alive, c: g.infCounts() }); }));
await adv(30);
await page.screenshot({ path: `${pre}-4-zombi-birinci-sahis.png` });
await page.evaluate(() => { const g = window.__game; window.__game.player.third = true; g.thirdView = true; });
await page.keyboard.press('KeyH'); await adv(30);
await page.screenshot({ path: `${pre}-5-zombi-ucuncu-sahis.png` });
// tüm insanları öldür → bitiş
await page.evaluate(() => { const g = window.__game; g.soldiers.filter((s) => s.team === 'blue' && s.alive).forEach((s) => s.takeDamage(999, g.soldiers.find((e) => e.def.zombie && e !== s), 'body', s.pos, 'Pençe')); });
await adv(40);
await page.screenshot({ path: `${pre}-6-bitis.png` });
console.log('bitti:', await page.evaluate(() => { const g = window.__game; return JSON.stringify({ ended: g.ended, w: g.winner, why: g.endReason }); }));
console.log('abil:', await page.evaluate(() => { const a = document.getElementById('abil'); return JSON.stringify([a.style.display, a.className, document.getElementById('abn').textContent]); }));
console.log('hata:', errs.length, errs.slice(0, 4));
await browser.close();
