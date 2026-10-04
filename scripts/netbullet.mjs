// Çevrimiçi isabet testi: gerçek istemci, gecikmeli bağlantı, botlara nişan alıp ateş. İstemcinin gördüğü isabet (kan) ile sunucunun onayladığı isabet (hitmarker) karşılaştırılır.
// node scripts/netbullet.mjs [bots=1|0]   (BF_DEBUG=1 sunucu + netproxy 8790 + vite 5180 açık olmalı)   env: PER=10 TYPE=conquest DIFF=normal MAP=kasaba
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const q = new URLSearchParams({ online: 'new', type: process.env.TYPE || 'conquest', per: process.env.PER || '10', map: process.env.MAP || 'kasaba', diff: process.env.DIFF || 'normal', bots: process.argv[2] || '1', debug: '1', nolock: '1', server: process.env.WSURL || 'ws://127.0.0.1:8790', name: 'Nisanci', cls: 'assault' });
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?${q}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const g = window.__game, S = (window.__s = { pred: 0, conf: 0, shots: 0, targets: 0, frames: 0, fire: 0 });
  S.log = []; const hm = g.hud.hitmarker.bind(g.hud); g.hud.hitmarker = (...a) => { S.conf++; S.log.push(['C', performance.now()]); return hm(...a); };
  const bl = g.effects.blood.bind(g.effects); g.effects.blood = (...a) => { if (S.mine) { S.pred++; S.log.push(['P', performance.now()]); } return bl(...a); };      // yalnızca kendi atışımızın tahmini kanı
  const sr = g.shootRay.bind(g); g.shootRay = (sh, ...a) => { S.mine = sh === g.playerSoldier; if (S.mine) S.shots++; try { return sr(sh, ...a); } finally { S.mine = false; } };
  const me = g.playerSoldier, p = g.player, dir = new g.camera.position.constructor(), org = new g.camera.position.constructor();
  setInterval(() => {
    if (!me.alive) { S.armed = false; p.fireHeld = false; return; }
    me.hp = 100;
    let best = null, bd = 1e9;
    me.eye(org);
    for (const e of g.soldiers) {
      if (e === me || !e.alive || e.team === me.team || e.vacant) continue;
      const dx = e.pos.x - me.pos.x, dz = e.pos.z - me.pos.z, d = Math.hypot(dx, dz);
      if (d > 70 || d < 6) continue;
      const ty = e.pos.y + 1.15 * (e.height / 1.8);
      dir.set(dx, ty - org.y, dz).normalize();
      const w = g.world.raycast(org, dir, Math.hypot(dx, dz, ty - org.y) - 0.5, {});
      if (w) continue;                                                       // arada engel var
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) { S.armed = false; p.fireHeld = false; return; }
    const ty = best.pos.y + 1.15 * (best.height / 1.8), dx = best.pos.x - me.pos.x, dz = best.pos.z - me.pos.z;
    me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(ty - org.y, Math.hypot(dx, dz));
    S.armed = true; p.fireHeld = true; S.targets++; me.items[me.cur].mag = Math.max(me.items[me.cur].mag, 10);
  }, 16);
});
await page.evaluate(() => window.__game.online.send({ t: 'dbg', tp: [+(window.__TPX || 15), 0] }));
await page.evaluate(() => setInterval(() => window.__game.online.send({ t: 'dbg', hp: 99999 }), 400));
if (process.env.STATIC) { await page.waitForTimeout(3000); await page.evaluate(() => window.__game.online.send({ t: 'dbg', bots: false })); }
const secs = +(process.env.SECS || 40);
for (let i = 0; i < secs; i += 5) { await page.waitForTimeout(5000); }
console.log(JSON.stringify(await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; return { alive: me.alive, team: me.team, n: g.soldiers.length, en: g.soldiers.filter((e) => e.team !== me.team && e.alive).slice(0, 4).map((e) => [e.pos.x.toFixed(0), e.pos.z.toFixed(0), e.vacant, e.alive]), me: [me.pos.x.toFixed(0), me.pos.z.toFixed(0)] }; })));
const match = await page.evaluate(() => {
  const L = window.__s.log, P = L.filter((x) => x[0] === 'P').map((x) => x[1]), C = L.filter((x) => x[0] === 'C').map((x) => x[1]);
  const usedC = new Set(); let ok = 0;
  for (const t of P) { const j = C.findIndex((c, i) => !usedC.has(i) && c >= t - 20 && c <= t + 600); if (j >= 0) { usedC.add(j); ok++; } }
  const lat = []; for (const t of P) { const j = C.findIndex((c) => c >= t - 20 && c <= t + 600); if (j >= 0) lat.push(C[j] - t); }
  return { tahminIsabet: P.length, onaylanan: ok, onaysiz: P.length - ok, istemciYokSunucuVar: C.length - usedC.size, onayGecikmeMs: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null };
});
console.log('durum', JSON.stringify(await page.evaluate(() => { const m = window.__game.playerSoldier; return { alive: m.alive, cur: m.cur, it: m.items.map((i) => i.id + ':' + i.mag + '/' + i.reserve), reload: m.reloadT, sprint: m.sprinting, fireHeld: window.__game.player.fireHeld, cd: m.cd }; })));
console.log('eşleştirme:', JSON.stringify(match));
const r = await page.evaluate(() => { const S = window.__s; return { hedefKare: S.targets, atış: S.shots, istemciGordu: S.pred, sunucuOnayladi: S.conf }; });
console.log(JSON.stringify(r), 'isabet onay oranı', r.istemciGordu ? (r.sunucuOnayladi / r.istemciGordu * 100).toFixed(0) + '%' : '-', 'hata', errs.length);
await browser.close();
