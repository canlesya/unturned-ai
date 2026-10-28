// 12.222 Çevrimiçi görüntü akıcılığı: her çizilen karede kamera + yakındaki uzak askerlerin konumu kaydedilir; kare başı yer değiştirmenin
// düzgünlüğü ölçülür (hareket ederken duran kare = "takılma", ortalamanın > 2,2 katı adım = "sıçrama", geri gidiş), ayrıca ağ istatistikleri
// (ileri tahmin / bekleme kareleri, düzeltme sayısı) ve snapshot işleme süresi (onSnap / interpolate / onMessage, ms).
//   node scripts/netvisual.mjs [saniye=30]   URL=http://127.0.0.1:8990  ROOM=OFC2 | new (MAP / TYPE / PER)  WALK=1 (W basılı, kamera döner)  HEADFUL=1
import { chromium } from 'playwright';
const secs = +(process.argv[2] || 30), base = process.env.URL || 'http://127.0.0.1:8990';
const room = process.env.ROOM || 'OFC2', map = process.env.MAP || 'kuzey', type = process.env.TYPE || 'conquest', per = process.env.PER || 16;
const browser = await chromium.launch({ headless: !process.env.HEADFUL, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
let code = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'tr-TR' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const url = room === 'offline' ? `${base}/?autostart=${per}v${per}&map=${map}&type=${type}&dev=1&debug=1&nolock=1`
    : `${base}/?online=${room}&name=Perf&map=${map}&type=${type}&per=${per}&dev=1&debug=1&nolock=1`;
  await page.goto(url);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const g = window.__game, r = g.renderer, ro = r.render.bind(r), n = g.online;
    const W = (window.__ns = { cam: [], sold: new Map(), ft: [], snapMs: [], interpMs: [], msgMs: [], last: 0 });
    const wrap = (o, k, arr) => { if (!o || !o[k]) return; const f = o[k]; o[k] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { arr.push(performance.now() - t); } }; };
    if (n) { wrap(n, 'onSnap', W.snapMs); wrap(n, 'interpolate', W.interpMs); wrap(n, 'onMessage', W.msgMs); }
    r.render = (sc, cam) => {
      ro(sc, cam);
      if (sc !== g.scene) return;
      const t = performance.now(); if (W.last) W.ft.push(t - W.last); W.last = t;
      const c = g.camera.getWorldPosition(new g.camera.position.constructor());
      W.cam.push([t, c.x, c.y, c.z]);
      const me = g.playerSoldier;
      for (const s of g.soldiers) {
        if (s === me || !s.alive || s.veh) continue;
        const d = Math.hypot(s.pos.x - me.pos.x, s.pos.z - me.pos.z); if (d > 120) continue;
        const p = s.model?.root?.position || s.root?.position || s.pos;          // çizilen model konumu (yoksa sim konumu)
        let a = W.sold.get(s.id ?? s); if (!a) W.sold.set(s.id ?? s, (a = []));
        a.push([t, p.x, p.y, p.z, s.pos.x, s.pos.z]);
      }
    };
    if (n) n.stats.extrap = n.stats.hold = n.stats.frames = n.stats.corrections = 0;
  });
  if (process.env.WALK) { await page.keyboard.down('KeyW'); }
  const t0 = Date.now();
  while (Date.now() - t0 < secs * 1000) {
    if (process.env.WALK) for (let i = 0; i < 20; i++) { await page.mouse.move(800 + Math.sin(i / 3) * 40, 450, { steps: 2 }); await page.waitForTimeout(50); }
    else await page.waitForTimeout(1000);
  }
  if (process.env.WALK) await page.keyboard.up('KeyW');
  const R = await page.evaluate(() => {
    const W = window.__ns, g = window.__game, n = g.online;
    // dizi: kare başı yatay adım; hareketli dizilerde (ortalama hız > 1 m/s) durma / sıçrama / geri adım
    const judge = (A, xi, zi) => {
      let frames = 0, stall = 0, jump = 0, back = 0, jerk = 0;
      for (let i = 2; i < A.length; i++) {
        const dt = A[i][0] - A[i - 1][0]; if (dt <= 0 || dt > 50) continue;
        const dx = A[i][xi] - A[i - 1][xi], dz = A[i][zi] - A[i - 1][zi], d = Math.hypot(dx, dz) / dt;
        const px = A[i - 1][xi] - A[i - 2][xi], pz = A[i - 1][zi] - A[i - 2][zi], pdt = A[i - 1][0] - A[i - 2][0], pd = Math.hypot(px, pz) / Math.max(1e-3, pdt);
        const v = (d + pd) / 2; if (v * 1000 < 1) continue;                 // yaklaşık duran: sayılmaz
        frames++;
        if (d < pd * 0.25) stall++;
        else if (d > pd * 2.2 && pd * 1000 > 1) jump++;
        if (dx * px + dz * pz < 0) back++;
        jerk += Math.abs(d - pd) / v;
      }
      return { frames, stall, jump, back, jerk };
    };
    const cam = judge(W.cam, 1, 3);
    const tot = { frames: 0, stall: 0, jump: 0, back: 0, jerk: 0 }, simTot = { frames: 0, stall: 0, jump: 0, back: 0, jerk: 0 };
    for (const A of W.sold.values()) { const j = judge(A, 1, 3), k = judge(A, 4, 5); for (const q in tot) { tot[q] += j[q]; simTot[q] += k[q]; } }
    const st = (a) => { const s = [...a].sort((x, y) => x - y), m = a.reduce((x, y) => x + y, 0) / Math.max(1, a.length); return { n: a.length, avg: +m.toFixed(3), p99: +(s[Math.floor(s.length * 0.99)] || 0).toFixed(2), max: +(s[s.length - 1] || 0).toFixed(2) }; };
    const ft = [...W.ft].sort((a, b) => a - b);
    return { cam, model: tot, sim: simTot, ft: { n: ft.length, avg: +(W.ft.reduce((a, b) => a + b, 0) / ft.length).toFixed(2), p99: +ft[Math.floor(ft.length * 0.99)].toFixed(1), max: +ft[ft.length - 1].toFixed(1), gt25: W.ft.filter((x) => x > 25).length },
      snap: st(W.snapMs), interp: st(W.interpMs), msg: st(W.msgMs), net: n ? { ...n.stats } : null };
  });
  const pr = (k, o) => `${k}: kare ${o.frames} · durma ${o.stall} (${(100 * o.stall / Math.max(1, o.frames)).toFixed(1)}%) · sıçrama ${o.jump} (${(100 * o.jump / Math.max(1, o.frames)).toFixed(1)}%) · geri ${o.back} · sarsıntı ${(o.jerk / Math.max(1, o.frames)).toFixed(3)}`;
  console.log(`oda ${room}: kare ${R.ft.n} ort ${R.ft.avg} ms p99 ${R.ft.p99} max ${R.ft.max} >25 ms ${R.ft.gt25}`);
  console.log('  ' + pr('kamera', R.cam)); console.log('  ' + pr('uzak model', R.model)); console.log('  ' + pr('uzak sim konum', R.sim));
  console.log(`  onMessage ${JSON.stringify(R.msg)} · onSnap ${JSON.stringify(R.snap)} · interpolate ${JSON.stringify(R.interp)}`);
  if (R.net) console.log(`  ağ: ${JSON.stringify(R.net)}`);
  if (errs.length) console.log('  hata:', errs.slice(0, 3).join(' / '));
} catch (e) { console.error('HATA', e.message); code = 1; }
finally { await browser.close(); }
process.exit(code);
