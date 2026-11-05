// 12.231 Hızlı duman testi (hedef < 60 sn): "bir şey kırıldı mı?" — her değişiklikten sonra ilk koşulacak test.
//   node scripts/smoke.mjs                         (yalnız başsız kısım; tarayıcı / sunucu gerekmez)
//   URL=http://127.0.0.1:5180 WS=ws://127.0.0.1:8787 node scripts/smoke.mjs     (+ tarayıcı: çevrimdışı maç + çevrim içi bağlantı)
//   PARTS=node,web,online (varsayılan: URL varsa üçü, yoksa node) · SECS=20 (başsız benzetim süresi) · SOFT=1 yazılım GPU · HEADFUL=1 pencereli
// Başsız: her haritayı kendi moduyla kurar (+ Uyku / Bomba), SECS saniye bot maçı oynatır: istisna yok, asker var, ayakta asker var.
// Tarayıcı: tek tarayıcı, çevrimdışı Çöl Geçidi TDM + Kum Köyü Bomba (sayfa hatası yok, oyun koşuyor, ateş edince şarjör azalıyor),
// çevrim içi yerel sunucuda oda kur → bağlan → anlık görüntü gelsin. Ekran görüntüsü yalnız HATA olunca (OUT klasörüne).
import fs from 'node:fs';
const BASE = process.env.URL || process.env.BASE || '', WS = process.env.WS || '';
const PARTS = (process.env.PARTS || (BASE ? 'node,web' + (WS ? ',online' : '') : 'node')).split(',');
const SECS = +(process.env.SECS || 20), OUT = process.env.OUT || '/tmp/wb-smoke';
let fail = 0, pass = 0; const T0 = performance.now();
const check = (ok, msg, x = '') => { console.log((ok ? 'OK    ' : 'HATA  ') + msg + (x !== '' ? ' · ' + x : '')); if (ok) pass++; else fail++; };
const sec = (t) => ((performance.now() - t) / 1000).toFixed(1) + ' sn';

// ───── 1) başsız: her harita kendi moduyla ─────
if (PARTS.includes('node')) {
  const { Game } = await import('../src/game/game.js');
  const { MAPS } = await import('../src/maps/index.js');
  const cases = (process.env.CASES ? process.env.CASES.split(',').map((c) => c.split(':')) : [
    ...Object.values(MAPS).filter((m) => !m.dev).map((m) => [m.id, m.only?.[0] || 'tdm', m.id === 'kuzey' ? 16 : 5]),
    ['uykukoy', 'uyku', 5], ['colgecidi', 'bomba', 5], ['kasaba', 'conquest', 8], ['depo', 'dm', 6], ['us', 'gg', 5],
  ]).map(([m, t, n]) => [m, t, +n || 5]);
  for (const [map, type, per] of cases) {
    const t0 = performance.now(); let g, spawns = 0;
    try {
      g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type, time: 600 } });
      const tb = performance.now() - t0;
      for (let i = 0, n = SECS * 30; i < n; i++) g.step(1 / 30);
      for (const s of g.soldiers) spawns += s.alive ? 1 : 0;
      check(g.soldiers.length > 0 && spawns > 0, `başsız ${map} · ${type} ${per}v${per}`, `kurulum ${(tb / 1000).toFixed(1)} sn, toplam ${sec(t0)}, ayakta ${spawns}/${g.soldiers.length}, oyun zamanı ${(g.time ?? 0).toFixed(0)} sn`);
    } catch (e) { check(false, `başsız ${map} · ${type}`, (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
    try { g?.dispose?.(); } catch {}
  }
}

// ───── 2) tarayıcı: çevrimdışı maç + çevrim içi bağlantı ─────
if (BASE && (PARTS.includes('web') || PARTS.includes('online'))) {
  const { chromium } = await import('playwright');
  fs.mkdirSync(OUT, { recursive: true });
  // başsız + Metal = gerçek GPU (pencere açılmaz); HEADFUL=1 pencereli
  const browser = await chromium.launch(process.env.SOFT ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { headless: process.env.HEADFUL !== '1', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'tr-TR' });
  const run = async (name, q, extra) => {
    const t0 = performance.now(), page = await ctx.newPage(), errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon|:8787\//.test(m.text())) errs.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400 && !/\/audio\/music\/|favicon|:8787\//.test(r.url())) errs.push(`${r.status()} ${r.url()}`); });
    try {
      await page.goto(`${BASE}/${q}`);
      const ok = await page.waitForFunction(() => window.__game?.running && window.__game.playerSoldier, null, { timeout: 90000 }).then(() => true, () => false);
      check(ok, `${name}: oyun koşuyor`, sec(t0));
      if (ok) await extra?.(page);
    } catch (e) { check(false, `${name}: istisna`, e.message.split('\n')[0]); }
    check(!errs.length, `${name}: sayfa hatası yok`, errs.slice(0, 3).join(' | '));
    if (fail) await page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
    await page.close();
  };
  // oyuncu ateş eder → şarjör azalır (girdi → silah → sim zinciri canlı)
  const fire = async (page) => {
    const r = await page.evaluate(async () => {
      const g = window.__game, p = g.player, s = g.playerSoldier; s.protT = 1e9;
      const w = s.items?.[s.cur], m0 = w?.mag; p.fireHeld = true; await new Promise((r) => setTimeout(r, 700)); p.fireHeld = false;
      const t0 = g.time; await new Promise((r) => setTimeout(r, 300));
      return { m0, m1: w?.mag, adv: +(g.time - t0).toFixed(2), n: g.soldiers.length };
    });
    check(r.adv > 0.1 && r.n > 1, 'oyun zamanı ilerliyor, askerler var', JSON.stringify(r));
    check(r.m0 == null || r.m1 < r.m0, 'ateş edince şarjör azaldı', `${r.m0} → ${r.m1}`);
  };
  const tasks = [];
  if (PARTS.includes('web')) {
    tasks.push(run('çevrimdışı colgecidi tdm', '?autostart=4v4&map=colgecidi&type=tdm&debug=1&nolock=1', fire));
    tasks.push(run('çevrimdışı uykukoy bomba', '?autostart=5v5&map=uykukoy&type=bomba&debug=1&nolock=1', async (page) => {
      const ok = await page.evaluate(() => !!window.__game.bomba && window.__game.soldiers.length >= 10);
      check(ok, 'bomba modu kuruldu (10 asker)');
    }));
  }
  if (PARTS.includes('online') && WS) tasks.push(run('çevrim içi depo dm', `?online=new&type=dm&per=4&map=depo&debug=1&nolock=1&name=Smoke&server=${encodeURIComponent(WS)}`, async (page) => {
    const r = await page.waitForFunction(() => { const o = window.__game.online; return o && (o.snapN || o.lastSnap || o.snaps?.length || window.__game.soldiers.length > 1) ? { n: window.__game.soldiers.length } : null; }, null, { timeout: 20000 }).then((h) => h.jsonValue(), () => null);
    check(!!r, 'sunucudan anlık görüntü geldi', JSON.stringify(r));
  }));
  await Promise.all(tasks);           // sayfalar aynı tarayıcıda paralel (her biri ayrı sekme)
  await browser.close();
}
console.log(`süre ${sec(T0)} · ${pass} OK · ${fail} HATA`);
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
