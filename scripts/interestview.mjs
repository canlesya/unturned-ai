// 12.203 İlgi alanı gösterim denetimi (gerçek GPU, pencereli): çevrim içi Kuzey Vadisi 128v128, istemci 6 sn boyunca her karede uzak askerlerin
// ekrandaki (interpolasyonlu) konumunu kaydeder. Seyrek gelen (10 / 5 Hz) asker sıçramamalı / donmamalı: kare başı yer değiştirme hızı (m/sn)
// askerin kendi hızının çok üstüne çıkmamalı, hareket eden asker 0,4 sn'den uzun donmamalı. Kademe = uzaklık (yakın ≤ 160, orta ≤ 420, uzak).
//   node scripts/interestview.mjs   BASE=http://127.0.0.1:5185  WS=ws://127.0.0.1:8968
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:5185', WS = process.env.WS || 'ws://127.0.0.1:8968';
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'HATA ') + m); if (!c) fails++; };
await page.goto(`${BASE}/?online=new&name=Bakis&server=${encodeURIComponent(WS)}&map=kuzey&type=conquest&per=128&time=1800&debug=1&nolock=1&nologin=1`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.soldiers.length > 200', null, { timeout: 240000 });
await page.waitForTimeout(+(process.env.WARM || 40) * 1000);
const r = await page.evaluate(async () => {
  const g = window.__game, me = g.playerSoldier, S = g.soldiers;
  const rec = S.map(() => []);
  await new Promise((res) => {
    const t0 = performance.now();
    const f = () => { const t = performance.now(); for (const s of S) if (s !== me) rec[s.id].push([t, s.pos.x, s.pos.z, s.alive ? 1 : 0, Math.hypot(s.vel.x, s.vel.z), s.veh ? 1 : 0]); if (t - t0 < 6000) requestAnimationFrame(f); else res(); };
    requestAnimationFrame(f);
  });
  const tiers = { yakin: { n: 0, jump: 0, freeze: 0, maxV: 0 }, orta: { n: 0, jump: 0, freeze: 0, maxV: 0 }, uzak: { n: 0, jump: 0, freeze: 0, maxV: 0 } };
  for (const s of S) {
    if (s === me) continue;
    const R = rec[s.id]; if (R.length < 10) continue;
    const d = Math.hypot(R[0][1] - me.pos.x, R[0][2] - me.pos.z), T = tiers[d <= 160 ? 'yakin' : d <= 420 ? 'orta' : 'uzak'];
    T.n++;
    let still = 0;
    for (let i = 1; i < R.length; i++) {
      const [t, x, z, a, v, veh] = R[i], p = R[i - 1], dt = (t - p[0]) / 1000;
      if (!a || !p[3] || veh || p[5]) { still = 0; continue; }
      const mv = Math.hypot(x - p[1], z - p[2]), sp = mv / Math.max(dt, 1e-3);
      if (mv > 0.05 && sp > Math.max(3 * v, 12) && mv > 0.6) T.jump++;
      T.maxV = Math.max(T.maxV, +sp.toFixed(1));
      if (v > 1.5 && mv < 1e-4) { still += dt; if (still > 0.4) { T.freeze++; still = -99; } } else if (mv > 1e-4) still = 0;
    }
  }
  return { tiers, frames: rec.find((x) => x.length)?.length, net: { ...g.online.stats } };
});
console.log(JSON.stringify(r));
for (const [k, T] of Object.entries(r.tiers)) ok(T.jump <= Math.max(2, T.n * 0.05) && T.freeze <= Math.max(1, T.n * 0.03), `${k}: ${T.n} asker · sıçrama ${T.jump} · donma ${T.freeze}`);
ok(!errs.length, 'sayfa hatası yok ' + errs.slice(0, 2).join(' | '));
console.log(fails ? `sonuç: ${fails} HATA` : 'sonuç: OK');
await browser.close(); process.exit(fails ? 1 : 0);
