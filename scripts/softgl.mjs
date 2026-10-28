// 12.222 Yazılım WebGL algısı: SwiftShader ile menüde uyarı + maçta düşük kalite (gölge / son işleme yok, çözünürlük ≤ 0,75); Metal (donanım) ile uyarı yok.
//   node scripts/softgl.mjs   URL=http://127.0.0.1:8990   (görüntü: /tmp/wb-perf/soft-menu.png)
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.env.URL || 'http://127.0.0.1:8990';
fs.mkdirSync('/tmp/wb-perf', { recursive: true });
let ok = true;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await (await b.newContext({ viewport: { width: 1400, height: 800 }, locale: 'tr-TR' })).newPage();
  await p.goto(base + '/?nolock=1&debug=1&nologin=1');
  await p.waitForSelector('#mnStage .home', { timeout: 60000 }); await p.waitForTimeout(2500);
  const w = await p.evaluate(() => ({ warn: !!document.querySelector('#mnGpuWarn'), text: document.querySelector('#mnGpuWarn')?.innerText }));
  console.log('SwiftShader menü uyarısı:', w.warn, '|', (w.text || '').replace(/\s+/g, ' ').slice(0, 160));
  await p.screenshot({ path: '/tmp/wb-perf/soft-menu.png' });
  ok &&= w.warn;
  await p.keyboard.press('Enter');
  await p.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  await p.waitForTimeout(2000);
  const g = await p.evaluate(() => { const g = window.__game, r = g.renderer; return { shadows: g.settings.shadows, post: g.settings.post, softGL: g.settings.softGL, pr: r.getPixelRatio(), shadowMap: r.shadowMap.enabled }; });
  console.log('SwiftShader maç ayarı:', JSON.stringify(g));
  ok &&= g.softGL && !g.shadows && !g.post && g.pr <= 0.75;
} finally { await b.close(); }
const b2 = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const p2 = await (await b2.newContext({ viewport: { width: 1400, height: 800 } })).newPage();
  await p2.goto(base + '/?nolock=1&debug=1&nologin=1'); await p2.waitForSelector('#mnStage .home', { timeout: 60000 }); await p2.waitForTimeout(1500);
  const r = await p2.evaluate(() => !!document.querySelector('#mnGpuWarn'));
  console.log('Metal (donanım) menü uyarısı:', r);
  ok &&= !r;
} finally { await b2.close(); }
console.log(ok ? 'GEÇTİ' : 'KALDI');
process.exit(ok ? 0 : 1);
