// 12.191 Ele geçirme geri bildirimi: durum ekran görüntüleri (önce / sonra aynı betik). Kuzey Vadisi 8v8 (A–G), oyuncu B (Köy) alanında; botlar donuk,
// durumlar elle kurulur: ele geçiriliyor · nötrleştiriliyor · çekişmeli · savunuluyor · ele geçirildi (geçiş anı) · bölgeden çıktın · dünyadaki bayrak.
//   node scripts/capshots.mjs [url=http://127.0.0.1:5199] [etiket=sonra]   → /tmp/wb-qa9/<etiket>/<cihaz>-<durum>.png   (DEV=desktop,pixel7 · MAP=kuzey · FLAG=B)
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.argv[2] || 'http://127.0.0.1:5199', TAG = process.argv[3] || 'sonra', OUT = `/tmp/wb-qa9/${TAG}`;
const MAP = process.env.MAP || 'kuzey', FLAG = process.env.FLAG || 'B';
fs.mkdirSync(OUT, { recursive: true });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = { desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }, pixel7: strip(devices['Pixel 7 landscape']) };
const want = (process.env.DEV || 'desktop,pixel7').split(',');
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const dev of want) {
  const ctx = await browser.newContext({ ...DEVS[dev], locale: 'tr-TR' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?autostart=8v8&map=${MAP}&type=conquest&debug=1&nolock=1&time=1800&tickets=900${dev === 'pixel7' ? '&touch=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 300000 });
  await wait(1500);
  // kurulum: botlar donuk ve üslerinde; yardımcılar sayfada
  await page.evaluate((FLAG) => {
    const g = window.__game;
    for (const b of g.brains) b.update = () => {};
    const park = (s) => { const sp = g.map.spawns[s.team][0]; s.pos.set(sp.x + (Math.random() - 0.5) * 6, 0, sp.z + (Math.random() - 0.5) * 6); g.world.settle(s); s.vel.set(0, 0, 0); };
    for (const s of g.soldiers) if (s !== g.playerSoldier) park(s);
    g.devGod = true;
    const O = g.mode.objectives, o = O.find((q) => (q.label || q.id) === FLAG) || O[0];
    const spot = (r0, r1, a0 = 0) => {                                          // alanın içinde yürünür, hedef kotunda nokta
      for (let k = 0; k < 400; k++) {
        const a = a0 + (k * 2.399) % 6.283, r = r0 + ((k * 0.618) % 1) * (r1 - r0), x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r;
        if (!g._free(x, z, g.playerSoldier)) continue;
        const y = g.world.groundAt(x, z); if (Math.abs(y - g.objY(o)) > 3) continue;
        return { x, y, z };
      }
      return { x: o.x, y: g.objY(o), z: o.z };
    };
    const put = (s, P) => { s.pos.set(P.x, P.y + 0.05, P.z); s.vel.set(0, 0, 0); g.world.settle(s); };
    const look = (s, x, y, z) => { const dx = x - s.pos.x, dz = z - s.pos.z; s.yaw = Math.atan2(-dx, -dz); s.pitch = Math.atan2(y - (s.pos.y + 1.6), Math.hypot(dx, dz)); };
    const me = g.playerSoldier, enemy = g.soldiers.find((s) => s.team !== me.team), friend = g.soldiers.find((s) => s.team === me.team && s !== me), friend2 = g.soldiers.filter((s) => s.team === me.team && s !== me)[1];
    window.__cap = { o, spot, put, look, me, enemy, friend, friend2, park,
      at(r0 = 5, r1 = 11) { const P = spot(r0, r1); put(me, P); look(me, o.x, g.objY(o) + 2.6, o.z); return P; },
      set(owner, p) { o.owner = owner; o.p = p; if ('pd' in o) o.pd = p; },
    };
    // diğer bayraklarda örnek ilerleme (üst çubuk / mini harita): A dostta kısmen, D düşman alıyor
    const A = O.find((q) => q.label === 'A'), D = O.find((q) => q.label === 'D'), F = O.find((q) => q.label === 'F');
    if (A) { A.owner = null; A.p = 0.45; } if (D) { D.owner = 'blue'; D.p = 0.4; } if (F) { F.owner = 'red'; F.p = -1; }
    if (A && friend2) { g.world.settle(friend2); const s = friend2; s.pos.set(A.x + 3, g.world.groundAt(A.x + 3, A.z), A.z); g.world.settle(s); }
    if (D) { const e2 = g.soldiers.filter((s) => s.team !== me.team)[1]; e2.pos.set(D.x + 2, g.world.groundAt(D.x + 2, D.z), D.z); g.world.settle(e2); }
  }, FLAG);
  const shot = async (name, ms = 1200) => { await wait(ms); await page.screenshot({ path: `${OUT}/${dev}-${name}.png` }); };
  const info = () => page.evaluate(() => { const c = window.__cap, w = document.getElementById('capw'); return { p: +c.o.p.toFixed(3), own: c.o.owner, st: w?.dataset.st || '', txt: w ? w.innerText.replace(/\s+/g, ' ') : document.getElementById('msg').textContent }; });
  // 1 ele geçiriliyor (nötr, tek başına)
  await page.evaluate(() => { const c = window.__cap; c.set(null, 0.15); c.at(); });
  await shot('1-ele-geciriliyor'); console.log(dev, '1', JSON.stringify(await info()));
  // 2 nötrleştiriliyor (düşmanın)
  await page.evaluate(() => { const c = window.__cap; c.set('red', -0.7); c.at(); });
  await shot('2-notrlestiriliyor'); console.log(dev, '2', JSON.stringify(await info()));
  // 3 çekişmeli (1 vs 1)
  await page.evaluate(() => { const c = window.__cap; c.set(null, 0.3); const P = c.at(); c.put(c.enemy, c.spot(3, 9, 2)); c.enemy.yaw = c.me.yaw; });
  await shot('3-cekismeli'); console.log(dev, '3', JSON.stringify(await info()));
  // 4 savunuluyor (2 vs 1, bayrak bizim)
  await page.evaluate(() => { const c = window.__cap; c.set(c.me.team, c.me.team === 'blue' ? 1 : -1); c.put(c.friend, c.spot(3, 9, 4)); c.at(); });
  await shot('4-savunuluyor'); console.log(dev, '4', JSON.stringify(await info()));
  // 5 ele geçirildi (geçiş anı): düşman / dost dışarıda, ilerleme %92
  await page.evaluate(() => { const c = window.__cap; c.park(c.enemy); c.park(c.friend); c.set(null, c.me.team === 'blue' ? 0.9 : -0.9); c.at(); });
  await shot('5-ele-gecirildi', 1700); console.log(dev, '5', JSON.stringify(await info()));
  // 6 bölgeden çıktın: kısmi ilerleme, dışarı
  await page.evaluate(() => { const c = window.__cap, cap = window.__game.hud.cap; if (cap) cap.flash = null; c.set(null, c.me.team === 'blue' ? 0.4 : -0.4); c.at(); });
  await wait(900);
  await page.evaluate(() => { const c = window.__cap, g = window.__game, o = c.o; for (let k = 0; k < 60; k++) { const a = k * 0.7, r = o.r + 6 + k * 0.3, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r; if (g._free(x, z, c.me)) { c.put(c.me, { x, y: g.world.groundAt(x, z), z }); break; } } c.look(c.me, o.x, g.objY(o) + 4, o.z); });
  await shot('6-bolgeden-cikti', 500); console.log(dev, '6', JSON.stringify(await info()));
  // 7 dünyadaki bayrak (düşman alıyor, yarıda): 30–45 m dışarıdan direğe bakış
  await page.evaluate(() => { const c = window.__cap, g = window.__game, o = c.o; c.set(null, c.me.team === 'blue' ? -0.55 : 0.55); c.put(c.enemy, c.spot(2, 6, 1)); for (let k = 0; k < 120; k++) { const a = 1.2 + k * 0.37, r = o.r + 8 + (k % 7) * 2, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r; if (!g._free(x, z, c.me)) continue; const y = g.world.groundAt(x, z); c.put(c.me, { x, y, z }); if (g.world.clear(new g.camera.position.constructor(x, y + 1.6, z), new g.camera.position.constructor(o.x, g.objY(o) + 4, o.z))) break; } c.look(c.me, o.x, g.objY(o) + 3, o.z); });
  await shot('7-dunya-bayrak', 1500); console.log(dev, '7', JSON.stringify(await info()));
  console.log(dev, 'sayfa hatası:', errs.length ? errs.slice(0, 3).join(' | ') : 'yok');
  await ctx.close();
}
await browser.close();
