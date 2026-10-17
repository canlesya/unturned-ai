// Herkes-tek doğuş noktaları kuşbakışı: her haritada dm maçı açılır, tepeden kamera; yeşil = dm havuzu, mavi / kırmızı = takım doğuşları (eski dm bunları kullanıyordu),
// sarı halka = 90 sn'lik maçta gerçekleşen doğuşlar.   node scripts/ffashots.mjs [harita,…]   (URL=http://127.0.0.1:5206, OUT=/tmp/wb-ffa-shots)
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5206', OUT = process.env.OUT || '/tmp/wb-ffa-shots';
fs.mkdirSync(OUT, { recursive: true });
const maps = (process.argv[2] || 'depo,liman,kasaba,colgecidi').split(',');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const map of maps) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${URL0}/?autostart=5v5&map=${map}&type=dm&debug=1&nolock=1&dev=1`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  const stats = await page.evaluate(async () => {
    const g = window.__game, me = g.playerSoldier;
    me.protT = 1e9; g.brains.push(new (g.brains[0].constructor)(g, me, 'hard'));        // oyuncu da bot: doğuşlar gerçek maç gibi
    const rec = []; g.on('spawn', (s) => rec.push([s.pos.x, s.pos.z]));
    for (let i = 0; i < 30 * 90; i++) g.step(1 / 30);
    me.protT = 1e9;
    g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
    const b = g.map.bounds, w = b.maxX - b.minX, d = b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
    const fov = 30, h = (Math.max(w, d) / 2 + 2) / Math.tan((fov / 2) * Math.PI / 180);
    P.render = function () { c.position.set(cx, h, cz + 0.01); c.up.set(0, 0, -1); c.lookAt(cx, 0, cz); c.fov = fov; c.aspect = 1; c.updateProjectionMatrix(); orig.call(this); };
    g.running = false; g.render?.(); g.running = true;
    window.__plot = { pool: g.dmPool.map((p) => [p.x, p.z]), blue: g.map.spawns.blue.map((p) => [p.x, p.z]), red: g.map.spawns.red.map((p) => [p.x, p.z]), rec };
    return { pool: g.dmPool.length, n: rec.length };
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__game, c = g.camera, V = new g.camera.position.constructor(), cv = document.createElement('canvas');
    cv.width = innerWidth; cv.height = innerHeight; Object.assign(cv.style, { position: 'fixed', left: 0, top: 0, zIndex: 99999, pointerEvents: 'none' });
    document.body.appendChild(cv); const x = cv.getContext('2d');
    const pr = (p, y = 0.1) => { V.set(p[0], y, p[1]).project(c); return [(V.x + 1) / 2 * cv.width, (1 - V.y) / 2 * cv.height]; };
    const dot = (p, r, fill, stroke) => { const [a, b] = pr(p); x.beginPath(); x.arc(a, b, r, 0, 7); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = 2; x.stroke(); } };
    const P = window.__plot;
    for (const p of P.blue) dot(p, 4, '#2f7dffcc', '#001a40');
    for (const p of P.red) dot(p, 4, '#ff3b2fcc', '#400500');
    for (const p of P.rec) dot(p, 9, null, '#ffd400');
    for (const p of P.pool) dot(p, 6, '#22e04acc', '#003b10');
    x.fillStyle = '#000a'; x.fillRect(8, 8, 520, 30); x.fillStyle = '#fff'; x.font = '16px sans-serif';
    x.fillText(`yeşil: dm havuzu (${P.pool.length})  sarı: 90 sn doğuş (${P.rec.length})  mavi/kırmızı: takım doğuşu`, 16, 28);
  });
  await page.screenshot({ path: `${OUT}/${map}-ffa.png` });
  console.log(`${map}: havuz ${stats.pool}, 90 sn'de ${stats.n} doğuş → ${OUT}/${map}-ffa.png ${errs.length ? 'HATA ' + errs.slice(0, 2).join(' | ') : ''}`);
  await page.close();
}
await browser.close();
