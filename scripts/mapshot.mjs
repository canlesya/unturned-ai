// Her haritada sabit bakışlardan gerçek GPU ekran görüntüsü (12.185 QA):
//   MAP=cephe TYPE=front VIEWS='[["ad",x,y,z,yaw,pitch]]' OUT=klasör [TOD=day|night] [WEATHER=fog|rain] [TOUCH=1] [SW=1 yazılım çizici] node scripts/mapshot.mjs
//   y = "g+1.7" biçiminde verilirse zemin (arazi) + 1,7. Botlar dondurulur, HUD gizlenir, oyuncu uçar (çarpışmasız).
import { chromium } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT || '/tmp/wb-shots'; fs.mkdirSync(OUT, { recursive: true });
const touch = !!process.env.TOUCH;
const browser = await chromium.launch(process.env.SW ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(touch ? { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true } : { viewport: { width: +process.env.W || 1280, height: +process.env.H || 720 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
const MAP = process.env.MAP || 'colgecidi', TYPE = process.env.TYPE || 'tdm';
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5193'}/?autostart=2v2&map=${MAP}&type=${TYPE}&dev=1&debug=1&nolock=1&third=0&tod=${process.env.TOD || 'day'}&weather=${process.env.WEATHER || 'clear'}${touch ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 }); await page.waitForTimeout(2500);
await page.evaluate((HUDON) => { const g = window.__game; g.brainsOff = g.brains.splice(0); if (g.hud?.root && !HUDON) g.hud.root.style.display = "none"; for (const s of g.soldiers) if (s !== g.player.s) s.pos.y -= 200; }, !!process.env.HUD);
const VIEWS = JSON.parse(process.env.VIEWS || fs.readFileSync(process.env.VIEWFILE, 'utf8'));
for (const [n, x, y, z, yaw, pitch] of VIEWS) {
  await page.evaluate(([x, y, z, yaw, pitch]) => { const g = window.__game, s = g.player.s; let py = y; if (typeof y === 'string') py = g.world.terrain ? g.world.terrain.heightAt(x, z) + +y.slice(2) - 1.6 : +y.slice(2) - 1.6; s.alive = true; s.fly = true; s.hp = s.maxHp; s.protT = 999; s.pos.set(x, py, z); s.vel.set(0, 0, 0); s.yaw = yaw; s.pitch = pitch; const w = g.world; return w._hits(w.query(x - 1, z - 1, x + 1, z + 1, []), x, py, z, 1.7) ? 'katı içinde' : ''; }, [x, y, z, yaw, pitch]).then((r) => r && console.log('UYARI', n, r));
  await page.waitForTimeout(+process.env.WAIT || 900); await page.screenshot({ path: `${OUT}/${n}.png` });
}
// PICK='[[px,py],...]' (son bakışın ekran pikselleri): kameradan ışın, ilk görsel isabetin dünya konumu (yamalı / havada nesneyi bulmak için)
if (process.env.PICK) console.log(await page.evaluate(async (pts) => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /deps\/three\.js/.test(n));
  const THREE = await import(url); const g = window.__game, rc = new THREE.Raycaster(), out = [];
  for (const [px, py] of pts) { rc.setFromCamera(new THREE.Vector2((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1), g.camera); const h = rc.intersectObjects(g.scene.children, true).find((q) => q.distance > 0.6 && q.object.visible && !q.object.isSprite && !g.camera.children.includes(q.object));
    out.push(`${px},${py} → ${h ? h.point.toArray().map((v) => v.toFixed(2)).join(',') + ' ' + (h.object.name || h.object.type) + ' d=' + h.distance.toFixed(1) : '-'}`); }
  return out.join('\n');
}, JSON.parse(process.env.PICK)));
if (process.env.INFO)console.log(await page.evaluate(process.env.INFO));
console.log('hata', errs.length, errs.slice(0, 4).join(' || ')); await browser.close();
