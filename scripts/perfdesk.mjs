// 12.230 Performans paneli + masaüstü (Electron) ölçümü. Çevrimdışı botlu hızlı maç açar, F3 panelinin window.__perf sayılarını ~10 sn örnekler.
//   tarayıcı (Playwright Chromium, pencereli):   URL=http://127.0.0.1:5195 WS=ws://127.0.0.1:8970 node scripts/perfdesk.mjs browser
//   tarayıcı, Chromium sınırsız bayraklarıyla:   … node scripts/perfdesk.mjs browser-uncapped
//   masaüstü (paketlenmiş uygulama, gömülü dist): node scripts/perfdesk.mjs desk        (APP=… ikili yolu; varsayılan desktop/out/WarByte-darwin-arm64)
//   masaüstü VSync açık:                          node scripts/perfdesk.mjs desk-vsync
// SHOTS=/tmp/wb-desktop ekran görüntüleri · Q= hızlı maç sorgusu (varsayılan Çöl Geçidi 5v5 TDM) · SECS=10 örnekleme süresi
import { chromium, _electron } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const mode = process.argv[2] || 'browser';
const URL = process.env.URL || 'http://127.0.0.1:5195';
const WS = process.env.WS || 'ws://127.0.0.1:8970';
const SHOTS = process.env.SHOTS || '/tmp/wb-desktop';
const SECS = +process.env.SECS || 10;
const Q = process.env.Q || 'autostart=5v5&map=colgecidi&type=tdm&nolock=1&perf=1&debug=1';
const APP = process.env.APP || path.resolve('desktop/out/WarByte-darwin-arm64/WarByte.app/Contents/MacOS/WarByte');
fs.mkdirSync(SHOTS, { recursive: true });

let browser, app, page;
if (mode.startsWith('browser')) {
  const args = mode === 'browser-uncapped' ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [];
  browser = await chromium.launch({ headless: false, args });
  page = await browser.newPage({ viewport: { width: 1440, height: 810 } });      // masaüstü penceresiyle aynı içerik boyutu
  await page.goto(`${URL}/?${Q}&server=${encodeURIComponent(WS)}`);
} else {
  const args = mode === 'desk-live' ? ['--uncapped', '--inactive'] : [`--query=${mode === 'desk-lock' ? Q.replace('&nolock=1', '') : Q}`, '--local', '--inactive', ...(mode === 'desk-vsync' ? ['--vsync'] : ['--uncapped'])];
  app = await _electron.launch({ executablePath: APP, args });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 810));
}
page.on('pageerror', (e) => console.log('[sayfa hatası]', e.message));
if (mode === 'desk-live' || mode === 'desk-lock') {
  // desk-live: canlı site (varsayılan mod) menüde açılıyor mu, __desktop var mı, rAF ekran hızını aşıyor mu (tek istemci, birkaç saniye)
  // desk-lock: gömülü modda kilitli maç (nolock yok): tuvale tıkla → işaretçi kilidi alındı mı
  if (mode === 'desk-live') {
    await page.waitForFunction(() => document.querySelector('#menu')?.children.length, null, { timeout: 60000 });
    const r = await page.evaluate(async () => { let n = 0; const t0 = performance.now(); await new Promise((ok) => { const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else ok(); }; requestAnimationFrame(f); }); return { url: location.href, rafPerSec: Math.round(n / ((performance.now() - t0) / 1000)), desktop: JSON.parse(JSON.stringify(window.__desktop || null)) }; });
    r.title = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle());
    console.log(JSON.stringify(r));
    await page.screenshot({ path: path.join(SHOTS, 'desk-live-menu.png') });
  } else {
    await page.waitForFunction(() => window.__game?.running, null, { timeout: 120000 });
    // not: macOS işaretçi kilidini yalnız öndeki (etkin) uygulamaya verir; betik ortamında (pencere odaksız) WrongDocumentError → elle denenmeli
    await page.waitForTimeout(1500);
    await page.mouse.click(700, 400);                                              // "tıkla, devam" katmanı → game.requestLock() (unadjustedMovement: true)
    await page.waitForTimeout(1500);
    const st = () => page.evaluate(() => ({ locked: document.pointerLockElement === window.__game.canvas, lockFails: window.__game.lockFails || 0, noPointerLock: !!window.__game.noPointerLock }));
    console.log('tıkla:', JSON.stringify(await st()));
    // aynı istek doğrudan (kullanıcı jesti sayılır): ham fare girdisi destekleniyor mu
    console.log('unadjustedMovement:', await page.evaluate(() => { document.exitPointerLock(); return new Promise((ok) => setTimeout(() => window.__game.canvas.requestPointerLock({ unadjustedMovement: true }).then(() => 'kilit alındı', (e) => e.name + ': ' + e.message).then(ok), 1500)); }));
    console.log('son:', JSON.stringify(await st()));
    await page.evaluate(() => removeEventListener('beforeunload', window.__game._bu));      // kapanışta "Maçtan çıkılsın mı?" sorusu çıkmasın
  }
  await app.close();
  process.exit(0);
}
await page.waitForFunction(() => window.__perf && window.__game?.running && window.__perf.stats.frames > 30, null, { timeout: 120000 });
const desk = await page.evaluate(() => window.__desktop ? JSON.parse(JSON.stringify(window.__desktop)) : null);
await page.waitForTimeout(6000);                                                   // ısınma: maç açılış takılması 5 sn'lik pencereden çıksın
const samples = [];
for (let i = 0; i < SECS; i++) {
  await page.waitForTimeout(1000); samples.push(await page.evaluate(() => ({ ...window.__perf.stats })));
  if (process.env.VERBOSE) { const s = samples.at(-1); console.log(`  ${i + 1}s  fps ${s.fps.toFixed(0)}  1%düşük ${s.low1Fps?.toFixed(0)}  en uzun(5sn) ${s.maxMs.toFixed(1)} ms  cpu ${s.cpuMs.toFixed(2)}  gpu ${s.gpuMs?.toFixed(2)}`); }
}
const med = (k) => { const v = samples.map((s) => s[k]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? +v[v.length >> 1].toFixed(2) : null; };
const last = samples.at(-1);
const out = {
  mode, desktop: desk && { mode: desk.mode, uncapped: desk.uncapped, electron: desk.electron, chrome: desk.chrome },
  fps: med('fps'), avgMs: med('avgMs'), low1Fps: med('low1Fps'), maxMs: Math.max(...samples.map((s) => s.maxMs)), cpuMs: med('cpuMs'), gpuMs: med('gpuMs'), gpuTimer: last.gpuTimer,
  calls: last.calls, triangles: last.triangles, textures: last.textures, programs: last.programs, heapMB: last.heapMB && +last.heapMB.toFixed(0),
  pixelRatio: last.pixelRatio, buffer: last.buffer, gpu: last.gpu, vsync: last.vsync,
};
console.log(JSON.stringify(out, null, 1));
const shot = path.join(SHOTS, `perf-${mode}.png`);
await page.screenshot({ path: shot });
console.log('görüntü:', shot);
const rep = await page.evaluate(() => window.__perf.report());
console.log('rapor alanları:', Object.keys(rep).length, rep.where, rep.fps);
await (browser || app).close();
