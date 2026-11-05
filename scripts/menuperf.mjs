// 12.234 Menü akıcılığı / bekleme testi (başsız, gerçek GPU, < 60 sn): menüde her ekrana ve seçime tıklar (mod, harita, gün saati, hava, boyut,
// çevrim içi oda listesi, oda kur, Cephanelik sınıf / yuva / silah, ayarlar, kontroller, editör, dil, hesap kartı), her tıklamadan sonraki 0,9 sn'de
// ana iş parçacığının en uzun görevini (longtask), tık → boya süresini (Event Timing) ve en uzun ana kare aralığını ölçer.
// Eşik: uzun görev ≤ 100 ms (RAIL "tepki" bütçesi: kullanıcı 100 ms'nin altını anında sayar; 12.232'de harita seçimi 200–570 ms, ilk tık 127 ms idi).
// Ayrıca: menü arka planı ekran hızında (başsız 60 Hz: ≥ 55 FPS), kare aralığı sapması < 2 ms, kamera adımı düzgün (CV < 0,02), harita kurulumu iş
// parçacığında; menü → maç (yükleme ekranı hemen) ve maç → menü süreleri raporlanır (en uzun görevler yazılır, maç kurulumu yükleme ekranı arkasında).
// Kare temposu 120 / 144 / 240 Hz için ayrıca tarayıcısız benzetim (scripts/lib/pacesim.mjs: FramePacer sanal saatte, oynak rAF damgasıyla).
//   node --import ./scripts/lib/pw-quiet.mjs scripts/menuperf.mjs        URL=http://127.0.0.1:5203 WS=ws://127.0.0.1:8986 · LT=100 (eşik ms) · V=1 (her adım)
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://127.0.0.1:5203', WS = process.env.WS || 'ws://127.0.0.1:8986';
const LT = +(process.env.LT || 100), V = process.env.V === '1';
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'HATA'} ${msg}`); if (!ok) fail++; };
// ── 0) kare temposu benzetimi (tarayıcısız): ekran hızının tam böleni mi, kaçan / düzensiz kare var mı (60 / 120 / 144 / 240 Hz) ──
{
  const { simulate, restorePerf } = await import('./lib/pacesim.mjs');
  const old = await simulate({ hz: 144, fps: 30, snap: false, jitterTs: true });
  console.log(`     12.232 menü (30 FPS, bölen yok) 144 Hz'de: aralıklar ${JSON.stringify(old.hist)} ekran karesi, sapma ${old.sdMs} ms, kamera adımı CV ${old.stepCV}`);
  const want = { 60: 60, 120: 60, 144: 72, 240: 60 }, out = [];
  let ok = true;
  for (const hz of [60, 120, 144, 240]) {
    const r = await simulate({ hz, fps: 60, snap: true, jitterTs: true, secs: 4 });
    ok &&= r.uneven === 0 && Math.abs(r.drawnFps - want[hz]) < 1 && r.stepCV < 0.01;
    out.push(`${hz} Hz → ${r.drawnFps} FPS (her ${r.mode}. kare, düzensiz ${r.uneven}, adım CV ${r.stepCV})`);
  }
  check(ok, `12.234 menü (≈60, ekran hızının tam böleni): ${out.join(' · ')}`);
  const odak = await simulate({ hz: 144, fps: 10, snap: true, jitterTs: true, secs: 6 });
  check(odak.uneven <= 1 && Math.abs(odak.drawnFps - 10.3) < 0.5, `odaksız pencere 144 Hz: ${odak.drawnFps} FPS (her ${odak.mode}. kare, düzensiz ${odak.uneven})`);
  restorePerf();
}
const browser = await chromium.launch({ headless: true });
const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((ws) => {
    try { if (!localStorage.getItem('warbyte.v2')) localStorage.setItem('warbyte.v2', JSON.stringify({ server: ws, map: 'kasaba', type: 'conquest', perTeam: 10 })); } catch (e) { /* yok */ }
    const M = (window.__mp = { lt: [], ev: 0, gap: 0, last: 0 });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) M.lt.push([+e.startTime.toFixed(0), +e.duration.toFixed(0)]); }).observe({ type: 'longtask', buffered: true });
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (/click|pointer|key/.test(e.name)) M.ev = Math.max(M.ev, e.duration); }).observe({ type: 'event', durationThreshold: 16 }); } catch (e) { /* yok */ }
    const f = (t) => { if (M.last) M.gap = Math.max(M.gap, t - M.last); M.last = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
    M.reset = () => { M.lt.length = 0; M.ev = 0; M.gap = 0; };
  }, WS);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|WebSocket|ERR_/.test(m.text())) errs.push(m.text()); });
  const t0 = Date.now();
  await page.goto(`${URL}/?nolock=1&nologin=1&debug=1`);
  await page.waitForSelector('#mnStage .home', { timeout: 30000 });
  await page.waitForFunction(() => window.__menuScene && window.__menuScene.shown, null, { timeout: 30000 });
  const boot = Date.now() - t0;
  await page.waitForTimeout(1500);                                                   // açılış: ses bağlamı / ilk harita boşta kurulur
  const st0 = await page.evaluate(() => window.__menuScene.stats());
  check(st0.kind === 'worker', `menü arka planı ayrı iş parçacığında (${st0.kind}), ilk harita ${st0.world} hazır ${boot} ms (kurulum ${st0.swaps?.[0]?.build} ms iş parçacığında)`);

  // ── arka plan kare temposu (2 sn) ──
  const pace = await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 1500));
    const s = await window.__menuScene.stats(), n = Math.min(s.t.length, 80), t = s.t.slice(-n), a = s.a.slice(-n);
    const d = [], st = []; for (let i = 1; i < n; i++) { d.push(t[i] - t[i - 1]); st.push(a[i] - a[i - 1]); }
    const av = (x) => x.reduce((p, q) => p + q, 0) / Math.max(1, x.length), sd = (x) => { const m = av(x); return Math.sqrt(av(x.map((v) => (v - m) ** 2))); };
    return { fps: 1000 / av(d), sd: sd(d), max: Math.max(...d), cv: sd(st) / av(st), P: s.pace.P, k: s.pace.k, pr: s.pr, calls: s.calls };
  });
  check(pace.fps >= 55 && pace.sd < 2 && pace.max < 40, `arka plan ${pace.fps.toFixed(1)} FPS (ekran karesi ${pace.P} ms, her ${pace.k}. kare), aralık sapması ${pace.sd.toFixed(2)} ms, en uzun ${pace.max.toFixed(1)} ms`);
  check(pace.cv < 0.02, `kamera adımı kareden kareye düzgün (CV ${pace.cv.toFixed(4)}), iç çözünürlük ×${pace.pr}, ${pace.calls} çizim çağrısı`);

  // ── tıklama adımları ──
  const rows = [];
  const step = async (name, sel, wait = 650) => {
    const L = page.locator(sel).first();
    if (!(await L.count())) { rows.push({ name, miss: true }); return; }
    await L.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.__mp.reset());
    await L.click({ timeout: 5000 });
    await page.waitForTimeout(wait);
    const r = await page.evaluate(() => { const M = window.__mp; return { lt: M.lt.length ? Math.max(...M.lt.map((x) => x[1])) : 0, n: M.lt.length, ev: M.ev, gap: M.gap }; });
    rows.push({ name, ...r });
    if (V) console.log('  ', name.padEnd(24), `uzun görev ${r.lt} ms (${r.n}) · tık→boya ${r.ev.toFixed(0)} ms · en uzun kare ${r.gap.toFixed(0)} ms`);
  };
  await step('ana → Özel Oyun', '[data-a=go][data-v=custom]');
  for (const m of ['tdm', 'inf', 'front', 'uyku', 'bomba', 'conquest']) await step('mod ' + m, `.mdc[data-a=type][data-v=${m}]`, 850);
  for (const m of ['vadi', 'us', 'colgecidi', 'kuzey', 'random', 'kasaba']) await step('harita ' + m, `.mapc[data-a=map][data-v=${m}]`, m === 'kuzey' ? 1900 : 850);
  for (const x of ['sunset', 'night', 'day']) await step('saat ' + x, `[data-a=tod][data-v=${x}]`);
  await step('hava yağmur', '[data-a=weather][data-v=rain]');
  await step('boyut', '[data-a=size]:not(.on)');
  await step('→ Çevrimiçi (oda listesi)', '[data-a=go][data-v=online]', 2200);
  await step('→ Oda kur', '[data-a=oview][data-v=ocreate]');
  for (const m of ['tdm', 'inf', 'conquest']) await step('oda mod ' + m, `.mdc[data-a=olset][data-k=type][data-v=${m}]`, 850);
  await step('oda harita vadi', '.mapc[data-a=olset][data-k=map][data-v=vadi]', 850);
  await step('→ Cephanelik', '[data-a=go][data-v=loadout]', 1500);
  await step('sınıf sıhhiye', '[data-a=cls][data-v=medic]', 1200);
  await step('yuva tabanca', '[data-a=slot][data-v=secondary]', 1200);
  await step('silah seç', '.wc[data-a=pick]:not(.on)', 1000);
  await step('Görünüm', '[data-a=slot][data-v=look]', 1000);
  await step('→ Ayarlar', '[data-a=go][data-v=settings]');
  await step('gölge aç / kapa', '[data-a=shadows]');
  await step('→ Kontroller', '[data-a=go][data-v=controls]');
  await step('→ Harita Editörü', '[data-a=go][data-v=editor]', 1100);
  await step('editör harita', '.mapc[data-a=edmap]:not(.on)', 1100);
  await step('dil EN', '#mnLangs [data-v=en]');
  await step('dil TR', '#mnLangs [data-v=tr]');
  await step('hesap kartı', '[data-a=acctopen]');
  await step('kartı kapat', '#mnAuth [data-u=close]');
  await step('→ Ana menü', '[data-a=go][data-v=home]', 1100);
  const miss = rows.filter((r) => r.miss).map((r) => r.name);
  check(!miss.length, `adımların hepsi bulundu (${rows.length - miss.length}/${rows.length})${miss.length ? ' eksik: ' + miss.join(', ') : ''}`);
  const done = rows.filter((r) => !r.miss), bad = done.filter((r) => r.lt > LT);
  const worst = [...done].sort((a, b) => b.lt - a.lt).slice(0, 4).map((r) => `${r.name} ${r.lt} ms`).join(', ');
  check(!bad.length, `tıklamalardan sonra uzun görev ≤ ${LT} ms (${done.length} adım; en uzunlar: ${worst})${bad.length ? ' AŞAN: ' + bad.map((r) => `${r.name} ${r.lt} ms`).join(', ') : ''}`);
  const evW = [...done].sort((a, b) => b.ev - a.ev)[0], gapW = [...done].sort((a, b) => b.gap - a.gap)[0];
  check(evW.ev <= 200, `tık → boya en çok ${evW.ev.toFixed(0)} ms (${evW.name}; INP "iyi" ≤ 200), en uzun ana kare ${gapW.gap.toFixed(0)} ms (${gapW.name})`);
  const sw = await page.evaluate(() => window.__menuScene.stats());
  const built = sw.swaps.filter((x) => !x.cached);
  console.log(`     harita geçişleri (iş parçacığında): ${sw.swaps.length}, kurulan ${built.length}: ${built.map((x) => `${x.id} ${x.build} ms`).join(', ')}`);

  // ── menü → maç → menü ──
  await page.evaluate(() => window.__mp.reset());
  const q0 = Date.now();
  await page.click('[data-a=quick]');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('loading')).display !== 'none', null, { timeout: 5000 });
  const tLoad = Date.now() - q0;
  await page.waitForFunction(() => window.__game?.running, null, { timeout: 60000 });
  const tGame = Date.now() - q0;
  const toGame = await page.evaluate(() => { const M = window.__mp; return { lt: [...M.lt].sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[1]) }; });
  check(tLoad < 300, `Hızlı Oyun → yükleme ekranı ${tLoad} ms, maç koşuyor ${tGame} ms (en uzun görevler ${toGame.lt.join(' / ')} ms, yükleme ekranı arkasında)`);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__mp.reset());
  const e0 = Date.now();
  await page.evaluate(() => window.__game.exit());
  await page.waitForFunction(() => window.__menuScene?.shown, null, { timeout: 30000 });
  const tBack = Date.now() - e0;
  await page.waitForTimeout(800);
  const back = await page.evaluate(() => { const M = window.__mp; return { lt: [...M.lt].sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[1]), gap: M.gap }; });
  const ctxN = await page.evaluate(() => document.querySelectorAll('canvas').length);
  check(tBack < 5000 && (back.lt[0] || 0) <= 2 * LT, `maç → menü: arka plan ${tBack} ms'de dönüyor, en uzun görevler ${back.lt.join(' / ') || '—'} ms, sayfada ${ctxN} tuval`);
  check(!errs.length, `sayfa hatası yok${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
} finally { await browser.close(); }
console.log(fail ? `menuperf: HATA ${fail}` : 'menuperf: OK');
process.exit(fail ? 1 : 0);
