// Firefox ↔ Chromium kare süresi / takılma ölçümü (gerçek GPU, pencereli): 60 sn oynanış senaryosu (yürü, dön, ateş, nişan, silah değiştir,
// ACOG PiP nişanı, el bombası + patlama, bıçak, botlarla çatışma) + harita değişimi. Her kare: rAF aralığı, rAF geri çağrısının JS süresi,
// o karede yeni derlenen gölgelendirici (renderer.info.programs), çözünürlük (pixelRatio) ve senaryo işaretleri.
//   node scripts/ffperf.mjs [firefox,chromium] [etiket]   BASE=http://127.0.0.1:5180  DPR=2  PR=1.5 (menü "Orta")  RUNS=1  SECS=60
//   → stdout özet tablo + /tmp/wb-ff/perf-<etiket>-<tarayıcı>-<n>.json
import { firefox, chromium } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:5180';
const which = (process.argv[2] || 'firefox,chromium').split(',');
const tag = process.argv[3] || 'now';
const PR = process.env.PR || '1.5', DPR = +(process.env.DPR || 2), RUNS = +(process.env.RUNS || 1), SECS = +(process.env.SECS || 60);
const MAP = process.env.MAP || 'colgecidi', MAP2 = process.env.MAP2 || 'kasaba';
fs.mkdirSync('/tmp/wb-ff', { recursive: true });

// macOS: bu ortamda ~/Library/Application Support/Firefox yazılamıyor → Firefox'a geçici "ev" dizini (CFFIXED_USER_HOME); gerçek tarayıcı profiline dokunulmaz
function launchOpt(name) {
  if (name !== 'firefox') return { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] };
  const home = process.env.FF_HOME || '/tmp/wb-ff/home';
  for (const d of ['Library/Caches', 'Library/Application Support']) fs.mkdirSync(`${home}/${d}`, { recursive: true });
  return { headless: false, env: { ...process.env, CFFIXED_USER_HOME: home } };
}

// Sayfa içi kayıt: rAF sarmalayıcı (her karenin zaman damgası + geri çağrı süresi) ve oyun nesnesine kanca (render süresi, yeni program sayısı, pixelRatio)
const INIT = () => {
  const R = (window.__rec = { t: [], cb: [], rd: [], prog: [], pr: [], marks: [], pnames: [], on: true });
  window.__mark = (s) => R.marks.push([performance.now(), s]);
  const raf = window.requestAnimationFrame.bind(window);
  let hooked = null;
  window.requestAnimationFrame = (fn) => raf((ts) => {
    const g = window.__game;
    if (g && g.renderer && hooked !== g) {                                   // her yeni oyunda render() süresini ölç
      hooked = g; const orig = g.render.bind(g);
      g.render = function () { const a = performance.now(); orig(); R._rd = (R._rd || 0) + performance.now() - a; };
    }
    const a = performance.now();
    fn(ts);
    const b = performance.now();
    if (g && g.renderer && fn === g.loop) {                                  // yalnız oyun döngüsü karesi kaydedilir
      R.t.push(a); R.cb.push(b - a); R.rd.push(R._rd || 0); R._rd = 0;
      const P = g.renderer.info.programs || [];
      if (P.length > (R._pl || 0)) for (let k = R._pl || 0; k < P.length; k++) R.pnames.push([a, P[k].name + ' ' + (P[k].cacheKey || '').split(',').slice(0, 3).join('|').slice(0, 90)]);
      R._pl = P.length;
      R.prog.push(P.length); R.pr.push(g.renderer.getPixelRatio());
    }
  });
};

function analyse(rec, from = 0, to = Infinity) {
  const fr = [];
  for (let i = 1; i < rec.t.length; i++) if (rec.t[i] >= from && rec.t[i] <= to) fr.push({ i, t: rec.t[i], dt: rec.t[i] - rec.t[i - 1], cb: rec.cb[i], rd: rec.rd[i], np: rec.prog[i] - rec.prog[i - 1], pr: rec.pr[i] });
  if (!fr.length) return null;
  const dts = fr.map((f) => f.dt).sort((a, b) => a - b), tot = dts.reduce((a, b) => a + b, 0);
  const p99 = dts[Math.floor(dts.length * 0.99)];
  // %1 düşük: en yavaş %1 karenin ortalama FPS'i
  const worst = dts.slice(Math.floor(dts.length * 0.99)); const low1 = 1000 / (worst.reduce((a, b) => a + b, 0) / worst.length);
  const markAt = (t) => { let m = ''; for (const [mt, s] of rec.marks) if (mt <= t + 5 && t - mt < 3000) m = `${s}+${Math.round(t - mt)}`; return m; };
  const long = fr.filter((f) => f.dt > 50).sort((a, b) => b.dt - a.dt);
  return {
    frames: fr.length, avgFps: +(1000 * fr.length / tot).toFixed(1), low1: +low1.toFixed(1), p99: +p99.toFixed(1),
    over50: fr.filter((f) => f.dt > 50).length, over100: fr.filter((f) => f.dt > 100).length, over250: fr.filter((f) => f.dt > 250).length,
    newPrograms: fr.reduce((a, f) => a + Math.max(0, f.np), 0), longWithCompile: long.filter((f) => f.np > 0).length,
    prMin: Math.min(...fr.map((f) => f.pr)), prEnd: fr[fr.length - 1].pr,
    top: long.slice(0, 14).map((f) => ({ t: +((f.t - from) / 1000).toFixed(2), dt: Math.round(f.dt), cb: Math.round(f.cb), rd: Math.round(f.rd), np: f.np, pr: +f.pr.toFixed(2), at: markAt(f.t) })),
  };
}

async function scenario(page, secs) {
  const mark = (s) => page.evaluate((s) => window.__mark(s), s);
  const T0 = Date.now(), at = async (s) => { const w = s * 1000 - (Date.now() - T0); if (w > 0) await page.waitForTimeout(w); };
  const turn = async (dx, n = 10) => { for (let i = 0; i < n; i++) { await page.mouse.move(800 + ((i % 2) ? dx : 0), 450); } };
  await page.mouse.move(800, 450);
  await mark('başla');
  await at(2); await mark('yürü'); await page.keyboard.down('KeyW'); await turn(40);
  await at(5); await page.keyboard.up('KeyW');
  await at(5.5); await mark('ateş'); await page.mouse.down(); await at(6.8); await page.mouse.up();
  await at(8); await mark('nişan'); await page.mouse.down({ button: 'right' }); await at(8.6); await page.mouse.down(); await at(9.6); await page.mouse.up(); await page.mouse.up({ button: 'right' });
  await at(10.5); await mark('tabanca'); await page.keyboard.press('Digit2'); await at(11.3); for (let i = 0; i < 3; i++) { await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(150); }
  await at(13); await mark('tüfek'); await page.keyboard.press('Digit1');
  await at(14); await mark('acog');                                                             // nişangâhı ACOG'a çevir, sonra nişan al (PiP mercek)
  for (let i = 0; i < 6; i++) { const o = await page.evaluate(() => window.__game.playerSoldier.opticId); if (o === 'acog') break; await page.keyboard.press('KeyB'); await page.waitForTimeout(120); }
  await page.mouse.down({ button: 'right' }); await at(16); await page.mouse.down(); await at(16.8); await page.mouse.up(); await turn(30); await at(17.5); await page.mouse.up({ button: 'right' });
  await at(18); await mark('elbombası'); await page.keyboard.press('Digit3'); await at(18.8); await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up();
  await at(21.5); await mark('patlama?');
  await at(23); await mark('elbombası2'); await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up();
  await at(27); await mark('bıçak'); await page.keyboard.press('Digit4'); await at(27.6); for (let i = 0; i < 3; i++) { await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(400); }
  await at(30); await mark('dolaş'); await page.keyboard.press('Digit1');
  // kalan süre: botlarla çatışma — yürü, dön, kısa seriler
  let k = 0;
  while (Date.now() - T0 < secs * 1000) {
    await page.keyboard.down(k % 3 === 2 ? 'KeyS' : 'KeyW'); await turn(k % 2 ? 60 : -45, 6);
    await page.mouse.down(); await page.waitForTimeout(400); await page.mouse.up();
    await page.waitForTimeout(900); await page.keyboard.up(k % 3 === 2 ? 'KeyS' : 'KeyW'); k++;
  }
  await mark('son');
}

const summary = [];
for (const name of which) for (let run = 0; run < RUNS; run++) {
  const browser = await (name === 'firefox' ? firefox : chromium).launch(launchOpt(name));
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: DPR });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  let warn = 0; page.on('console', (m) => { if (/WebGL warning/.test(m.text())) warn++; });
  const tLoad = Date.now();
  await page.goto(`${BASE}/?autostart=3v3&map=${MAP}&type=tdm&dev=1&debug=1&nolock=1&third=0&pr=${PR}${process.env.Q || ''}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 180000 });
  const loadMs = Date.now() - tLoad;
  const gStart = await page.evaluate(() => { const g = window.__game; g.devGod = true; window.__mark('oyun'); return performance.now(); });
  await scenario(page, SECS);
  const gEnd = await page.evaluate(() => performance.now());
  // harita değişimi: aynı sayfada yeni maç (Game yeniden kurulur), ilk 12 sn
  await page.evaluate((m) => { window.__mark('harita:' + m); window.__game.restart({ map: m }); }, MAP2);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 180000 });
  const m2 = await page.evaluate(() => { window.__game.devGod = true; window.__mark('oyun2'); return performance.now(); });
  await page.mouse.move(800, 450); await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up(); await page.keyboard.up('KeyW');
  await page.waitForTimeout(8000);
  const rec = await page.evaluate(() => window.__rec);
  const info = await page.evaluate(() => { const g = window.__game, r = g.renderer; return { pr: r.getPixelRatio(), post: !!g.post?.on, shadow: r.shadowMap.enabled ? g.sun.shadow.mapSize.x : 0, programs: r.info.programs.length, adaptive: g._perf }; });
  const A = analyse(rec, gStart, gEnd), B = analyse(rec, m2, Infinity);
  const out = { name, version: browser.version(), run, loadMs, match: A, map2: B, info, errs: errs.slice(0, 5), webglWarnings: warn };
  fs.writeFileSync(`/tmp/wb-ff/perf-${tag}-${name}-${run}.json`, JSON.stringify({ ...out, rec }, null, 0));
  console.log(`\n=== ${tag} · ${name} ${browser.version()} · koşu ${run} · yükleme ${loadMs} ms · WebGL uyarısı ${warn} ${errs.length ? '· HATA ' + errs.join(' | ') : ''}`);
  for (const [k, v] of [['maç', A], ['harita2', B]]) {
    if (!v) continue;
    console.log(`  ${k}: ${v.frames} kare · ort ${v.avgFps} FPS · %1 düşük ${v.low1} · p99 ${v.p99} ms · >50ms ${v.over50} · >100ms ${v.over100} · >250ms ${v.over250} · yeni program ${v.newPrograms} (uzun karede ${v.longWithCompile}) · pr min ${v.prMin.toFixed(2)} son ${v.prEnd.toFixed(2)}`);
    for (const f of v.top) console.log(`     t=${f.t}s ${f.dt}ms (js ${f.cb}, render ${f.rd}) prog+${f.np} pr ${f.pr} ${f.at}`);
  }
  if (process.env.PNAMES) { const m0 = rec.marks.find((m) => m[1] === 'oyun')[0]; const markAt = (t) => { let m = ''; for (const [mt, s] of rec.marks) if (mt <= t + 5) m = s; return m; }; for (const [t, n] of rec.pnames) if (t > m0 - 50) console.log(`   yeni program t=${((t - m0) / 1000).toFixed(2)} [${markAt(t)}] ${n}`); }
  summary.push({ name, run, A, B });
  await browser.close();
}
console.log('\nÖZET');
for (const s of summary) console.log(`${s.name}#${s.run}  maç: ${s.A?.avgFps} FPS, %1 ${s.A?.low1}, >50 ${s.A?.over50}, >100 ${s.A?.over100}, prog ${s.A?.newPrograms}, pr ${s.A?.prMin?.toFixed(2)}→${s.A?.prEnd?.toFixed(2)} | harita2: ${s.B?.avgFps} FPS, %1 ${s.B?.low1}, >50 ${s.B?.over50}, >100 ${s.B?.over100}, prog ${s.B?.newPrograms}`);
