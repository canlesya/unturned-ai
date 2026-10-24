// Diğer oyuncuların akıcılığı (interpolasyon tamponu) titreşimli ağda: donma / sıçrama sayısı, gösterim gecikmesi.
//   node scripts/netsmooth.mjs [sunucu=ws://127.0.0.1:8790] [saniye=40] [query=type=dm&per=10&map=colgecidi]
// Önce: sunucu + titreşimli vekil, ör. node scripts/netproxy.mjs 8790 8787 15 20 0 1 180   (tek yön 15-35 ms, saniyede ~1 takılma ≤180 ms)
// Donma: hızı > 1,5 m/sn olan rakip bir karede hiç kımıldamadı · sıçrama: bir karede hızının 3 katından (en az 0,3 m) fazla yer değiştirdi.
import { chromium } from 'playwright';
const server = process.argv[2] || 'ws://127.0.0.1:8790', secs = +(process.argv[3] || 40), extra = process.argv[4] || 'type=dm&per=10&map=colgecidi';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?online=new&${extra}&listed=0&debug=1&nolock=1&server=${server}&name=Smooth`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.online && window.__game.online.snaps.length > 5', null, { timeout: 90000 });
// çizim kapalı (RENDER=1 ile açık): ölçülen şey ağ / interpolasyon; swiftshader'da çizim kareyi saniyelere uzatıyor
if (!process.env.RENDER) await page.evaluate(() => { const P = Object.getPrototypeOf(window.__game); P.render = function () {}; });
await page.waitForTimeout(3000);
const r = await page.evaluate(async (secs) => {
  const g = window.__game, o = g.online, prev = new Map(), acc = { frames: 0, moving: 0, freeze: 0, jump: 0, maxJump: 0, fps: [] };
  const s0 = { ...o.stats };
  let lastT = performance.now();
  await new Promise((done) => {
    const end = lastT + secs * 1000;
    const tick = (t) => {
      const dt = (t - lastT) / 1000; lastT = t;
      if (dt > 0.004 && dt < 0.2) {
        acc.frames++; acc.fps.push(dt);
        for (const s of g.soldiers) {
          if (s === g.playerSoldier || !s.alive) { prev.delete(s.id); continue; }
          const p = prev.get(s.id), v = Math.hypot(s.vel.x, s.vel.z);
          if (p) {
            const d = Math.hypot(s.pos.x - p.x, s.pos.z - p.z);
            if (p.v > 1.5 && v > 1.5) { acc.moving++; if (d < 0.002) acc.freeze++; }
            if (d > Math.max(0.3, 3 * Math.max(v, p.v) * dt) && d < 5) { acc.jump++; acc.maxJump = Math.max(acc.maxJump, d); }
          }
          prev.set(s.id, { x: s.pos.x, z: s.pos.z, v });
        }
      } else prev.clear();                                    // uzun kare (makine takıldı): o karenin yer değiştirmesi ağ sıçraması sayılmaz
      if (t < end) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  const st = o.stats, fr = st.frames - (s0.frames || 0);
  acc.fps.sort((a, b) => a - b);
  return { ...acc, fps: Math.round(acc.frames / secs), rtt: Math.round(st.rtt), jit: st.jit, delay: st.delay, extrap: fr ? (st.extrap - (s0.extrap || 0)) / fr : null, hold: fr ? (st.hold - (s0.hold || 0)) / fr : null, corr: st.corrections - s0.corrections, snaps: st.snaps - s0.snaps };
}, secs);
const pct = (x) => (x == null ? 'yok (eski istemci)' : (100 * x).toFixed(2) + '%');
console.log(`${secs} sn · ${r.fps} FPS · RTT ${r.rtt} ms · snapshot ${r.snaps} · gösterim gecikmesi ${r.delay != null ? r.delay.toFixed(0) + ' ms' : '100 ms (sabit)'} · geç kalma tepesi ${r.jit != null ? r.jit.toFixed(0) + ' ms' : '-'}`);
console.log(`rakip hareketli kare ${r.moving} · DONMA ${r.freeze} (%${(100 * r.freeze / Math.max(1, r.moving)).toFixed(2)}, ${(r.freeze / secs).toFixed(2)}/sn) · SIÇRAMA ${r.jump} (${(r.jump / secs).toFixed(2)}/sn, en büyük ${r.maxJump.toFixed(2)} m)`);
console.log(`tampon boşaldı: ileri tahmin ${pct(r.extrap)} · 100 ms'yi aşıp bekleme ${pct(r.hold)} · tahmin düzeltmesi ${r.corr}`);
console.log('hata:', errs.length, errs.slice(0, 2));
await browser.close();
