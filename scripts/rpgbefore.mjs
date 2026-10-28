// 12.216 önce görüntüleri (çevrim dışı Kuzey): ikmal kutusundaki RPG, düşman başında / patlamış tanksavar, M haritası. OUT=/tmp/wb-rpg/once node scripts/rpgbefore.mjs
import { chromium } from 'playwright';
const URL0 = 'http://127.0.0.1:5203', OUT = process.env.OUT || '/tmp/wb-rpg/once';
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&dev=1&debug=1&nolock=1&nologin=1&tod=day&weather=clear&cls=${process.env.CLS || 'assault'}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
await page.evaluate(() => { const g = window.__game; g.devGod = true; g.brainsOff = g.brains.splice(0); g.playerSoldier.fly = false; });
const R = {};
const prompt = () => page.evaluate(() => { const e = document.getElementById('vhPrompt'); return e && e.style.display !== 'none' ? e.textContent : ''; });
const items = () => page.evaluate(() => window.__game.playerSoldier.items.map((i) => `${i.id}:${i.mag}+${i.reserve}`).join(' '));
// 1 Kavşak kutusu
const c = await page.evaluate(() => { const c = window.__game.supply.find((q) => q.of?.name === 'Kavşak'); return { x: c.x, y: c.y, z: c.z }; });
await page.evaluate((c) => { const g = window.__game, me = g.playerSoldier; me.pos.set(c.x + 4, c.y + 0.3, c.z); me.vel.set(0, 0, 0); me.yaw = Math.PI / 2; me.pitch = -0.35; }, c);
await page.waitForTimeout(600);
await page.keyboard.down('KeyW'); await page.waitForTimeout(450); await page.keyboard.up('KeyW');
await page.evaluate((c) => { const me = window.__game.playerSoldier; me.yaw = Math.atan2(-(c.x - me.pos.x), -(c.z - me.pos.z)); me.pitch = -0.5; }, c);
await page.waitForTimeout(700);
R.crateDist = await page.evaluate((c) => { const me = window.__game.playerSoldier; return +Math.hypot(me.pos.x - c.x, me.pos.z - c.z).toFixed(2); }, c);
R.cratePrompt = await prompt(); R.itemsBefore = await items();
await page.screenshot({ path: `${OUT}/1-ikmal-kutusu-yaklasinca.png` });
await page.keyboard.press('KeyE'); await page.waitForTimeout(2000);
R.itemsAfterE = await items();
await page.screenshot({ path: `${OUT}/2-ikmal-E-basinca.png` });
// 2 tanksavar: düşman bot başında
const at = await page.evaluate(() => { const g = window.__game, v = g.vehicles.list.find((q) => q.id === 'Y-C-atgm-12'), r = g.soldiers.find((s) => s.team === 'red' && s.alive && s.brain); g.vehicles.enter(r, v, 0); return { x: v.st.x, y: v.st.y, z: v.st.z, b: v.st.base ?? v.st.yaw }; });
await page.evaluate((h) => { const g = window.__game, me = g.playerSoldier; me.pos.set(h.x + Math.sin(h.b) * 1.8, h.y + 0.2, h.z + Math.cos(h.b) * 1.8); me.vel.set(0, 0, 0); me.yaw = h.b; me.pitch = -0.3; }, at);
await page.waitForTimeout(900);
R.atEnemyPrompt = await prompt();
await page.screenshot({ path: `${OUT}/3-tanksavar-dusman-basinda.png` });
// 3 yok edilmiş tanksavar
await page.evaluate(() => { const g = window.__game, v = g.vehicles.list.find((q) => q.id === 'Y-C-atgm-12'); g.vehicles.destroy(v, null); });
await page.waitForTimeout(1500);
R.atDeadPrompt = await prompt();
await page.screenshot({ path: `${OUT}/4-tanksavar-yok-edilmis.png` });
// 4 M haritası
await page.evaluate(() => window.__game.bigMap.toggle(true)); await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/5-m-haritasi.png` });
console.log(JSON.stringify(R, null, 1));
await browser.close();
