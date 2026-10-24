// Paintball topu görünürlüğü, ÇEVRİM İÇİ (12.142): iki gerçek istemci (Boya Kulesi pb odası, BF_DEBUG=1 sunucu, araya gecikme vekili).
// A, 14 m ötedeki B'nin 2 m yanına (yakın ıska) ve gövdesine birer top atar. Her iki ekranda atıştan sonra 0 / 50 / 100 / 200 / 400 ms kareler
// (çizimden hemen sonra tuvalden okunur, ortak saat Date.now) + topun ekrandaki yeri / çapı + B'ye 'pb' olayının varış gecikmesi.
//   node scripts/pbballnet.mjs [url] [ws (vekil)]   env: TAG=once|sonra  DEV=desktop|pixel7 (B'nin cihazı)  GPU=1  → /tmp/wb-pball/<TAG>-net-<dev>-*.png
//   gecikme vekili: node scripts/netproxy.mjs 8883 8881 25 50   (tek yön 25-75 ms, RTT 50-150 ms dalgalı)
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const BASE = process.argv[2] || 'http://127.0.0.1:5180', WS = process.argv[3] || 'ws://127.0.0.1:8790', OUT = '/tmp/wb-pball', TAG = process.env.TAG || 'sonra', DEV = process.env.DEV || 'desktop';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'HATA'}  ${msg}`); if (!ok) fails++; };
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const GPU = !!process.env.GPU;
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
const CTX = { desktop: { viewport: { width: 960, height: 540 } }, pixel7: strip(devices['Pixel 7 landscape']) };
async function open(q, dev) {
  const page = await browser.newPage(CTX[dev]);
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?${new URLSearchParams({ debug: '1', nolock: '1', server: WS, tod: 'day', touch: dev === 'desktop' ? '0' : '1', ...q })}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier', null, { timeout: 120000 });
  await page.evaluate(() => {
    const g = window.__game, V = g.camera.position.constructor, cap = (window.__cap = { t0: 0, k: 0, times: [], shots: [], arr: [] });
    const cv = g.renderer.domElement;
    const probe = () => {
      const bm = g.paint.balls, cam = g.camera, M = new cam.matrixWorld.constructor(), P = new V(), Q = new cam.quaternion.constructor(), S = new V(), out = [];
      const W = innerWidth, H = innerHeight, f = H / 2 / Math.tan((cam.fov * Math.PI) / 360);
      for (let i = 0; i < bm.count; i++) { bm.getMatrixAt(i, M); M.decompose(P, Q, S); const d = P.distanceTo(cam.position), c = P.clone().project(cam); out.push({ x: Math.round((c.x + 1) / 2 * W), y: Math.round((1 - c.y) / 2 * H), front: c.z < 1, dpx: +(2 * S.x / d * f).toFixed(1), d: +d.toFixed(2) }); }
      return out;
    };
    const R = g.render.bind(g);
    g.render = () => {
      R();
      if (!cap.t0) return;
      const el = Date.now() - cap.t0;
      if (cap.k < cap.times.length && el >= cap.times[cap.k]) { cap.shots.push({ T: cap.times[cap.k], el, img: cv.toDataURL('image/png'), balls: probe(), splats: g.paint.splatN, live: g.paint.live.length }); cap.k++; }
    };
    const on = g.paint.onNet.bind(g.paint);
    g.paint.onNet = (ev) => { if (ev.e === 'pb' && cap.t0) cap.arr.push(Date.now() - cap.t0); return on(ev); };
  });
  return page;
}
const A = await open({ online: 'new', type: 'pb', map: 'boyakulesi', name: 'Ali' }, 'desktop');
const code = await A.evaluate(() => window.__game.opts.online.room);
const B = await open({ online: code, name: 'Veli' }, DEV);
console.log('oda', code, 'B cihazı', DEV);
await A.evaluate(() => window.__game.online.send({ t: 'dbg', bots: false }));
await A.waitForTimeout(800);
const ids = await Promise.all([A, B].map((p) => p.evaluate(() => ({ id: window.__game.playerSoldier.id, item: window.__game.playerSoldier.item.id }))));
check(ids[0].item === 'pbrifle' && ids[1].item === 'pbrifle', `iki istemcide paintball tüfeği (${ids[0].item} / ${ids[1].item})`);
const spot = await A.evaluate(() => {
  const g = window.__game, V = g.camera.position.constructor;
  let seed = 12345; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);   // aynı yer (önce / sonra karşılaştırması)
  for (let k = 0; k < 6000; k++) {
    const x = -45 + rnd() * 90, z = -45 + rnd() * 90, bx = x + 14;
    if (!g.nav.isFree(x, z) || !g.nav.isFree(bx, z) || !g.nav.isFree(bx, z - 3)) continue;
    const y = g.world.heightAt(x, z); if (Math.abs(g.world.heightAt(bx, z) - y) > 0.3) continue;
    const a = new V(x, y + 1.6, z), b = new V(bx, y + 1.2, z), c = new V(bx, y + 1.4, z - 2);
    if (g.world.clear(a, b) && g.world.clear(a, c) && g.world.clear(b.clone().setY(y + 1.6), a)) return [x, z, bx];
  }
  return null;
});
check(!!spot, 'açık atış yeri');
await A.evaluate((s) => { const n = window.__game.online; n.send({ t: 'dbg', tp: [s[0], s[1]], hp: 99999 }); }, spot);
await B.evaluate((s) => { const n = window.__game.online; n.send({ t: 'dbg', tp: [s[2], s[1]], hp: 99999 }); }, spot);
await A.waitForTimeout(1500);
for (const p of [A, B]) await p.evaluate(() => setInterval(() => window.__game.online.send({ t: 'dbg', hp: 99999 }), 300));
// A: B'ye (ya da yanına) nişan; B: A'ya bak
const aim = (p, bid, side) => p.evaluate(([bid, side]) => {
  const g = window.__game, me = g.playerSoldier, o = g.camera.position.clone();
  clearInterval(window.__aim);
  window.__aim = setInterval(() => { const b = g.soldiers[bid]; me.eye(o); const dx = b.pos.x - o.x, dz = b.pos.z + side - o.z, dy = b.pos.y + 1.1 - o.y, h = Math.hypot(dx, dz), t = h / 78; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(dy, h) + Math.atan2(0.5 * 4 * t * t, h) - me.recoilP; }, 8);
}, [bid, side]);
const look = (p, aid) => p.evaluate((aid) => { const g = window.__game, me = g.playerSoldier, o = g.camera.position.clone(); clearInterval(window.__aim); window.__aim = setInterval(() => { const a = g.soldiers[aid]; me.eye(o); const dx = a.pos.x - o.x, dz = a.pos.z - 1.2 - o.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(a.pos.y + 1.2 - o.y, Math.hypot(dx, dz)); }, 8); }, aid);
const TIMES = [0, 50, 100, 150, 200, 250, 300, 400];
const res = {};
for (const [name, side] of [['iska', -2], ['isabet', 0]]) {
  await aim(A, ids[1].id, side); await look(B, ids[0].id);
  await A.waitForTimeout(700);
  const Tf = Date.now() + 600;
  await B.evaluate(([Tf, T]) => { const c = window.__cap; c.t0 = Tf; c.k = 0; c.times = T; c.shots = []; c.arr = []; }, [Tf, TIMES]);
  await A.evaluate(([Tf, T]) => {
    const g = window.__game, c = window.__cap, me = g.playerSoldier;
    c.t0 = 0; c.k = 0; c.times = T; c.shots = []; c.arr = []; c.fireAt = 0; c.Tf = Tf;
    if (!c.wrapped) { c.wrapped = true; const fire = g.paint.fire.bind(g.paint); g.paint.fire = (s, ...a) => { const b = fire(s, ...a); if (s === me && !c.t0) { c.t0 = Date.now(); c.fireAt = c.t0 - c.Tf; g.player.fireHeld = false; } return b; }; }
    const iv = setInterval(() => { if (Date.now() >= Tf) { clearInterval(iv); me.cd = 0; g.player.fireHeld = true; } }, 1);
  }, [Tf, TIMES]);
  await A.waitForTimeout(1600);
  const ra = await A.evaluate(() => { const c = window.__cap; return { fireAt: c.fireAt, shots: c.shots }; });
  const rb = await B.evaluate(() => { const c = window.__cap; return { arr: c.arr, shots: c.shots }; });
  for (const [who, r] of [['A', ra], ['B', rb]]) for (const s of r.shots) fs.writeFileSync(`${OUT}/${TAG}-net-${DEV}-${name}-${who}-${String(s.T).padStart(3, '0')}.png`, Buffer.from(s.img.split(',')[1], 'base64'));
  const fmt = (s) => `${String(s.T).padStart(3)} ms (gerçek ${s.el}): ${s.balls.length ? s.balls.map((b) => `(${b.x},${b.y}) ${b.dpx}px ${b.d}m`).join(' ') : 'top yok'} · leke ${s.splats}`;
  console.log(`  ${name}: A ateş ${ra.fireAt} ms sonra (hedef an), B 'pb' varışı ${rb.arr.map((x) => x + ' ms').join(',') || 'GELMEDİ'} (A'nın atışından ${rb.arr[0] != null ? rb.arr[0] - ra.fireAt : '-'} ms sonra)`);
  for (const s of ra.shots) console.log('    A ' + fmt(s));
  for (const s of rb.shots) console.log('    B ' + fmt(s));
  res[name] = { ra: { fireAt: ra.fireAt, shots: ra.shots.map(({ img, ...r }) => r) }, rb: { arr: rb.arr, shots: rb.shots.map(({ img, ...r }) => r) } };
}
const rtt = await B.evaluate(() => Math.round(window.__game.online.stats.rtt || 0));
console.log('B RTT', rtt, 'ms');
// ölçüt: A'nın kendi topu 50 / 100 ms'de ≥ 4 px; B'de top 'pb' varışından sonraki ilk karelerde görünür (≥ 4 px)
for (const name of ['iska', 'isabet']) {
  const r = res[name], a = (T) => r.ra.shots.find((s) => s.T === T)?.balls[0];
  check(!!a(50) && a(50).dpx >= 4 && !!a(100) && a(100).dpx >= 4, `${name}: A kendi topunu görüyor (50 / 100 ms: ${a(50)?.dpx} / ${a(100)?.dpx} px)`);
  const seen = r.rb.shots.filter((s) => s.balls.some((b) => b.front && b.dpx >= 4)).map((s) => s.T);
  check(r.rb.arr.length > 0 && seen.length >= 2, `${name}: B, A'nın topunu görüyor (okunaklı karelerde: ${seen.join(', ') || 'yok'} ms)`);
}
fs.writeFileSync(`${OUT}/${TAG}-net-${DEV}-olcum.json`, JSON.stringify(res, null, 1));
console.log('hata:', errs.length, errs.slice(0, 3));
check(errs.length === 0, 'sayfa hatası yok');
await browser.close();
console.log(fails ? `sonuç: ${fails} HATA` : 'sonuç: OK'); process.exit(fails ? 1 : 0);
