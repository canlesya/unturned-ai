// Sunucu-istemci cephane / eşya uzlaştırması (12.138), gerçek istemciyle: node scripts/ammoheal.mjs [ws=ws://127.0.0.1:8787]
// (vite BASE=http://127.0.0.1:5180 + sunucu BF_DEBUG=1). Oyuncu tetiği HİÇ bırakmadan ateş ederken sunucudaki cephane değiştirilir
// (dbg am: şarjör 2 → 0, yedek 0). Eskiden istemci "uçuşta ateş var" diye eşitlemiyor, kendi yedeğinden doldurup boşa ateş etmeyi sürdürüyordu
// (hasar yok). Artık ack anındaki sunucu cephanesiyle fark kapanmalı. Ayrıca yaşarken sunucuda değişen eşya (dbg item) istemciye geçmeli.
import { chromium } from 'playwright';
const WS = process.argv[2] || 'ws://127.0.0.1:8787', BASE = process.env.BASE || 'http://127.0.0.1:5180';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${BASE}/?online=new&type=dm&map=${process.env.MAP || "depo"}&per=4&bots=0&debug=1&nolock=1&shadows=0&server=${encodeURIComponent(WS)}&name=Cephane`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.online && window.__game.playerSoldier.alive', null, { timeout: 90000 });
// Yüklü makinede başsız tarayıcı birkaç kare/sn çiziyor (adım da o kadar seyrek) → çizimi durdur, istemci adımını gerçek zamanlı 60 Hz sür (oyun döngüsüyle aynı birikim kuralı)
await page.evaluate(() => { const g = window.__game; cancelAnimationFrame(g.raf); g.loop = () => {}; let last = performance.now(), acc = 0; setInterval(() => { const n = performance.now(); acc = Math.min(acc + Math.min(0.05, (n - last) / 1000), 0.1); last = n; while (acc >= 1 / 60) { acc -= 1 / 60; g.stepOnline(1 / 60); } }, 4); });
await page.waitForTimeout(1500);
const dbg = (o) => page.evaluate((o) => window.__game.online.send({ t: 'dbg', ...o }), o);
const ask = async () => { await page.evaluate(() => { const o = window.__game.online; o._dbg = null; const om = o.onMessage.bind(o); if (!o._hook) { o._hook = 1; o.onMessage = (m) => { if (m.t === 'dbg') o._dbg = m; return om(m); }; } o.send({ t: 'dbg', ask: 1 }); }); await page.waitForFunction(() => window.__game.online._dbg, null, { timeout: 5000 }); return page.evaluate(() => window.__game.online._dbg); };
const cli = () => page.evaluate(() => { const s = window.__game.playerSoldier; return { cur: s.cur, items: s.items.map((it) => [it.id, it.mag, it.reserve]), fires: window.__fires || 0 }; });
await page.evaluate(() => { const g = window.__game; g.on('fire', (s) => { if (s === g.playerSoldier) window.__fires = (window.__fires || 0) + 1; }); g.player.fireHeld = true; });     // tetik sürekli basılı
// 1) olağan seri atış (şarjör boşalıp dolar): uzlaştırma gereksiz düzeltme yapmamalı, sayaç zıplamamalı
await page.evaluate(() => { const g = window.__game, s = g.playerSoldier; window.__seq = []; const iv = setInterval(() => { const m = s.items[0].mag; if (window.__seq[window.__seq.length - 1] !== m) window.__seq.push(m); }, 5); window.__seqIv = iv; });
await page.waitForTimeout(4500);
const n0 = await page.evaluate(() => { clearInterval(window.__seqIv); return { fix: window.__game.online.stats.ammoFix || 0, seq: window.__seq }; });
const ups = n0.seq.filter((m, i) => i && m > n0.seq[i - 1] && m < 30).length;          // şarjör dolması dışında (≠ 30) artış = sayaç zıplaması
console.log(`      olağan atış: şarjör dizisi ${n0.seq.join(',')} · düzeltme ${n0.fix}`);
check(ups === 0, 'olağan atışta cephane sayacı geri zıplamıyor');
// 2) sunucuda cephane değişir, tetik hâlâ basılı
await dbg({ am: [0, 2, 0] });                                                      // sunucu: 2 mermi kaldı, yedek yok
const keep = setInterval(() => dbg({ am: [0, 0, 0] }).catch(() => {}), 200);            // doğuş yakınındaki ikmal (resupply) yedeği doldurmasın: sunucu hep boş
for (let i = 0; i < 6 && process.env.TRACE; i++) { await page.waitForTimeout(250); console.log('      iz', JSON.stringify(await page.evaluate(() => { const g = window.__game, o = g.online; return { fps: Math.round(g._perf?.fps || 0), steps: g.tick, t: +g.time.toFixed(2), fh: g.player.fireHeld, it: g.playerSoldier.items[0], fires: window.__fires, hist: o.hist.length, hf: o.hist.filter((h) => h.fire).length }; }))); }
await page.waitForTimeout(1500);
const f0 = (await cli()).fires;
await page.waitForTimeout(1500);
const c1 = await cli(), d1 = await ask();
clearInterval(keep);
console.log(`      istemci tüfek ${JSON.stringify(c1.items[0])} · sunucu şarjör ${d1?.sv?.mag} yedek ${d1?.sv?.res} · son 1,5 sn'de istemcide atış ${c1.fires - f0} · düzeltme ${await page.evaluate(() => window.__game.online.stats.ammoFix || 0)}`);
check(c1.items[0][1] + c1.items[0][2] <= 1 && d1.sv.mag + d1.sv.res === 0, 'tetik basılıyken istemci cephanesi sunucuya (boş) eşitlendi');
check(c1.fires - f0 <= 1, 'sunucuda mermi yokken istemci boşa ateş etmiyor');
await page.evaluate(() => { window.__game.player.fireHeld = false; });
// yaşarken sunucuda eşya değişimi (Silah Yarışı seviye atlama gibi): istemci de geçmeli
await dbg({ item: [1, 'deagle'] });
await page.waitForTimeout(800);
const c2 = await cli();
check(c2.items[1][0] === 'deagle', `yaşarken değişen eşya istemciye geçti (${c2.items.map((x) => x[0]).join(', ')})`);
check(!errs.length, 'sayfa hatası yok ' + (errs[0] || ''));
await browser.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
