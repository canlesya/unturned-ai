// 12.232 Masaüstü (Electron) kare temposu / boşta CPU ölçümü (sonda, regresyon testi değil). Pencere odak çalmaz (--inactive), ayrı veri klasörü.
//   node scripts/pacedesk.mjs menu  [saniye=20]   menüde: uygulama içi rAF + menü sahnesi kare hızı, GPU / Renderer süreç CPU'su (ps cputime farkı)
//   node scripts/pacedesk.mjs match [saniye=12]   Çöl Geçidi 5v5 TDM botlu: çizilen kare aralığı ort / sd / p99 / en uzun / > 33 ms, yürüyüşte kamera hızı CV, CPU
//   FPS=vsync|60|144|240|uncapped (varsayılan: uygulamanın ayarı = vsync) · OCCL=1 (--occlusion: örtülü pencere gizli sayılır) · MIN=1 (ölçmeden önce simge durumuna küçült)
//   APP=… (varsayılan desktop/out/WarByte-darwin-arm64/…/WarByte) · OLD=1: APP eski sürüm paketi (--fps yok; FPS=vsync → --vsync, yoksa eski varsayılan sınırsız)
import { _electron } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const mode = process.argv[2] || 'menu', secs = +(process.argv[3] || (mode === 'menu' ? 20 : 12));
const APP = process.env.APP || path.resolve('desktop/out/WarByte-darwin-arm64/WarByte.app/Contents/MacOS/WarByte');
const OLD = process.env.OLD;
const DATA = process.env.DATA || '/tmp/wb-hitch/desk-data-' + (OLD ? 'old' : 'new');
fs.mkdirSync(DATA, { recursive: true });
const Q = mode === 'match' ? 'autostart=5v5&map=colgecidi&type=tdm&nolock=1&debug=1' : 'nolock=1';
const args = ['--local', '--inactive', `--data=${DATA}`, `--user-data-dir=${DATA}`, `--query=${Q}`, ...(process.env.FPS && !OLD ? [`--fps=${process.env.FPS}`] : []), ...(process.env.OCCL ? ['--occlusion'] : []), ...(OLD && process.env.FPS === 'vsync' ? ['--vsync'] : [])];
const exe = APP;
const app = await _electron.launch({ executablePath: exe, args });
const page = await app.firstWindow();
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 810));
page.on('pageerror', (e) => console.log('[sayfa hatası]', e.message));
const root = app.process().pid;
// uygulamanın bütün süreçleri (ana + yardımcılar): ps ağacı; cputime (sn) farkı / duvar saati = CPU %
const procs = () => {
  const rows = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,time=,command=']).toString().trim().split('\n').map((l) => { const m = l.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/); return m && { pid: +m[1], ppid: +m[2], t: m[3], cmd: m[4] }; }).filter(Boolean);
  const set = new Set([root]); let grow = true;
  while (grow) { grow = false; for (const r of rows) if (!set.has(r.pid) && set.has(r.ppid)) { set.add(r.pid); grow = true; } }
  const sec = (t) => { const p = t.split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
  const out = {};
  for (const r of rows) if (set.has(r.pid)) { const k = /--type=gpu-process/.test(r.cmd) ? 'gpu' : /--type=renderer/.test(r.cmd) ? 'renderer' : /--type=/.test(r.cmd) ? 'other' : 'main'; out[k] = (out[k] || 0) + sec(r.t); }
  return out;
};
if (mode === 'menu') await page.waitForFunction(() => document.querySelector('#menu')?.children.length && (window.__pace?.list().length || window.__pace === undefined), null, { timeout: 60000 });
else await page.waitForFunction(() => window.__game?.running && window.__game.playerSoldier?.alive, null, { timeout: 120000 });
await page.waitForTimeout(3000);
if (process.env.MIN) { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize()); await page.waitForTimeout(1500);
  console.log('küçültüldü:', JSON.stringify(await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return { min: w.isMinimized(), vis: w.isVisible() }; })), JSON.stringify(await page.evaluate(() => window.__pace.state))); }
const desk = await page.evaluate(() => (window.__desktop ? { fps: window.__desktop.fps, fpsCap: window.__desktop.fpsCap, uncapped: window.__desktop.uncapped, hz: window.__desktop.hz } : null));
// sayfa içi: ham rAF sayacı + (varsa) pacer çizim sayaçları + oyunda çizilen kare zaman damgaları
await page.evaluate(() => {
  const M = (window.__pm = { raf: 0, t: [], cam: [] });
  // ham rAF hızı yalnız ilk 2 sn (sayaç rAF zincirinin kendisi bileşikleyiciyi ekran hızında tutar → CPU ölçümünü bozmasın)
  const r0 = performance.now(); const f = () => { M.raf++; if (performance.now() - r0 < 2000) requestAnimationFrame(f); else M.rafPerS = M.raf / ((performance.now() - r0) / 1000); }; requestAnimationFrame(f);
  const g = window.__game;
  if (g) { const loop = g.loop; g.loop = function (now, draw) { loop.call(this, now, draw); if (draw !== false) { M.t.push(now); M.cam.push([now, g.camera.position.x, g.camera.position.z]); } }; }
  M.p0 = window.__pace?.list().map((p) => ({ ...p })) || [];
  M.t0 = performance.now();
});
const c0 = procs(), w0 = Date.now();
if (mode === 'match') {
  await page.waitForTimeout(Math.max(0, secs * 1000 - 2500));
  await page.evaluate(() => { window.__pm.cam.length = 0; window.__game.devGod = true; });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW');
} else await page.waitForTimeout(secs * 1000);
const c1 = procs(), wall = (Date.now() - w0) / 1000;
const r = await page.evaluate(() => {
  const M = window.__pm, el = (performance.now() - M.t0) / 1000, p1 = window.__pace?.list() || [];
  const pacer = p1.map((p) => { const a = M.p0.find((x) => x.name === p.name) || { drawn: 0, skipped: 0, hidden: 0 }; return { name: p.name, fps: +((p.drawn - a.drawn) / el).toFixed(1), hiddenPerS: +((p.hidden - a.hidden) / el).toFixed(1), target: p.fps, displayMs: p.P }; });
  const d = []; for (let i = 1; i < M.t.length; i++) d.push(M.t[i] - M.t[i - 1]);
  const s = [...d].sort((a, b) => a - b), n = s.length, avg = d.reduce((a, b) => a + b, 0) / Math.max(1, n), sd = Math.sqrt(d.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, n));
  const v = []; for (let i = 1; i < M.cam.length; i++) { const dt = (M.cam[i][0] - M.cam[i - 1][0]) / 1000; if (dt > 0) v.push(Math.hypot(M.cam[i][1] - M.cam[i - 1][1], M.cam[i][2] - M.cam[i - 1][2]) / dt); }
  const mid = v.slice(Math.floor(v.length * 0.3), Math.floor(v.length * 0.95)).filter((x) => x > 1), vm = mid.reduce((a, b) => a + b, 0) / Math.max(1, mid.length), vsd = Math.sqrt(mid.reduce((a, b) => a + (b - vm) ** 2, 0) / Math.max(1, mid.length));
  const st = []; for (let i = 1; i < M.cam.length; i++) st.push(Math.hypot(M.cam[i][1] - M.cam[i - 1][1], M.cam[i][2] - M.cam[i - 1][2]));
  const sm = st.slice(Math.floor(st.length * 0.3), Math.floor(st.length * 0.95)).filter((x) => x > 0.002), sa = sm.reduce((a, b) => a + b, 0) / Math.max(1, sm.length), ssd = Math.sqrt(sm.reduce((a, b) => a + (b - sa) ** 2, 0) / Math.max(1, sm.length));
  return { stepCV: sm.length ? +(ssd / sa).toFixed(3) : null, rafPerS: +(M.rafPerS || 0).toFixed(1), pacer, frames: n, avgMs: +avg.toFixed(2), sdMs: +sd.toFixed(2), p99Ms: +(s[Math.floor(n * 0.99)] || 0).toFixed(2), maxMs: +(s[n - 1] || 0).toFixed(1), gt33: d.filter((x) => x > 33).length, walkCV: mid.length ? +(vsd / vm).toFixed(3) : null, walkV: +vm.toFixed(2), hidden: document.hidden };
});
const cpu = {}; for (const k of Object.keys(c1)) cpu[k] = +((100 * ((c1[k] || 0) - (c0[k] || 0))) / wall).toFixed(1);
console.log(JSON.stringify({ mode, old: !!OLD, fps: process.env.FPS || 'ayar', desk, occl: !!process.env.OCCL, min: !!process.env.MIN, wall: +wall.toFixed(1), cpuPct: cpu, ...r }));
await page.evaluate(() => window.__game && removeEventListener('beforeunload', window.__game._bu)).catch(() => {});
await app.close();
