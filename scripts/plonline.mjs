// Vagon modu tarayıcıdan çevrimiçi: A (masaüstü, Mavi) oda kurar, B (Pixel 7 yatay, dokunmatik, Kırmızı) katılır; istemci vagonu sunucuyla aynı yerde mi,
// kontrol noktası bildirimi, bitiş (kapı patlar) ekranları.  Sunucu BF_DEBUG=1.
//   GPU=1 node scripts/plonline.mjs [url=http://127.0.0.1:5220] [ws=ws://127.0.0.1:8830]   → /tmp/wb-new-shots/online-*.png
import { chromium, devices } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5220', ws = process.argv[3] || 'ws://127.0.0.1:8830', OUT = '/tmp/wb-new-shots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const errs = [];
const mk = async (prof) => { const ctx = await browser.newContext({ ...prof, locale: 'tr-TR' }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
const A = await mk({ viewport: { width: 1280, height: 720 } });
await A.goto(`${base}/?online=new&map=maden&per=4&type=payload&server=${encodeURIComponent(ws)}&debug=1&nolock=1&name=Ali&team=blue&room=Vagon&bots=0`);
await A.waitForFunction('window.__game && window.__game.running && window.__game.online && window.__game.payload', null, { timeout: 120000 });
const code = await A.evaluate(() => window.__game.opts.online.room);
const B = await mk({ ...devices['Pixel 7 landscape'] });
await B.goto(`${base}/?online=${code}&server=${encodeURIComponent(ws)}&debug=1&nolock=1&name=Veli&team=red&touch=1`);
await B.waitForFunction('window.__game && window.__game.running && window.__game.payload', null, { timeout: 120000 });
const info = await Promise.all([A, B].map((p) => p.evaluate(() => { const g = window.__game; return { map: g.map.id, type: g.mode.type, team: g.playerSoldier.team, pl: !!g.payload, cart: !!g.payload.cart }; })));
check(info.every((i) => i.map === 'maden' && i.type === 'payload' && i.cart) && info[0].team === 'blue' && info[1].team === 'red', `oda ${code}: ${JSON.stringify(info)}`);
// A vagonun yanına (sunucu tp) — bakış vagona
const toCart = (p, lat, back = 0, dbg = {}) => p.evaluate(([lat, back, dbg]) => {
  const g = window.__game, pl = g.payload, d = dbg.pld ?? pl.netD, q = pl.track.at(d, {});
  const x = q.x - q.dz * lat - q.dx * back, z = q.z + q.dx * lat - q.dz * back;
  g.online.send({ t: 'dbg', tp: [x, z], hp: 100, ...dbg });
  g.playerSoldier.yaw = Math.atan2(-(q.x - x), -(q.z - z)); g.playerSoldier.pitch = -0.12;
}, [lat, back, dbg]);
await toCart(A, 2.0, -2.4);
await A.waitForTimeout(4000);
const s1 = await A.evaluate(() => { const g = window.__game, pl = g.payload; return { net: +pl.netD.toFixed(2), shown: +pl.shown.toFixed(2), mesh: [+pl.cart.position.x.toFixed(2), +pl.cart.position.z.toFixed(2)], at: (({ x, z }) => [+x.toFixed(2), +z.toFixed(2)])(pl.track.at(pl.netD)), state: pl.state, box: pl.col.min.map((v) => +v.toFixed(2)) }; });
check(s1.net > 12.5 && Math.abs(s1.net - s1.shown) < 0.6 && Math.hypot(s1.mesh[0] - s1.at[0], s1.mesh[1] - s1.at[1]) < 0.7, `istemci A: vagon d ${s1.net} (gösterilen ${s1.shown}), ağ ${JSON.stringify(s1.mesh)} ≈ ray ${JSON.stringify(s1.at)} · ${s1.state}`);
await A.screenshot({ path: `${OUT}/online-A-itiyor.png` });
const sB = await B.evaluate(() => +window.__game.payload.netD.toFixed(2));
check(Math.abs(sB - s1.net) < 0.8, `istemci B aynı vagonu görüyor (B ${sB}, A ${s1.net})`);
// B (savunan) vagona → çekişme her iki istemcide
await toCart(B, -2.0, -1.5);
await B.waitForTimeout(2500);
const cs = await Promise.all([A, B].map((p) => p.evaluate(() => window.__game.payload.state)));
await B.screenshot({ path: `${OUT}/online-B-cekisme-pixel7.png` });
check(cs[0] === 'contest' && cs[1] === 'contest', `B yanında: iki istemcide de ÇEKİŞME (${cs.join(' / ')})`);
// kontrol noktası: istemci bildirimi + aşama
await B.evaluate(() => window.__game.online.send({ t: 'dbg', tp: [44, 10] }));
const cp1 = await A.evaluate(() => window.__game.payload.cps[0]);
await toCart(A, 2.0, -2.4, { pld: cp1 - 1.0 });
await A.waitForTimeout(2600);
const c1 = await A.evaluate(() => { const g = window.__game, pl = g.payload; return { reached: pl.reached, toast: [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).join(' | '), stat: document.querySelector('#plstat')?.textContent }; });
check(c1.reached === 1 && /Makas/.test(c1.toast), `A · Makas: istemci reached ${c1.reached} · "${c1.toast}"`);
await A.screenshot({ path: `${OUT}/online-A-kontrol.png` });
// bitiş
const end = await A.evaluate(() => window.__game.payload.end);
await toCart(A, 0.8, 2.6, { pld: end - 0.6 });
await A.waitForTimeout(900);
await A.screenshot({ path: `${OUT}/online-A-patlama.png` });
await A.waitForTimeout(2600);
const e1 = await A.evaluate(() => ({ ended: window.__game.ended, done: window.__game.payload.done, door: window.__game.map.payload.door?.visible, title: document.querySelector('#etitle')?.textContent, info: document.querySelector('#einfo')?.textContent }));
const e2 = await B.evaluate(() => ({ ended: window.__game.ended, title: document.querySelector('#etitle')?.textContent }));
check(e1.ended && e1.done && e1.door === false && /ZAFER/.test(e1.title) && /YENİLGİ/.test(e2.title || ''), `bitiş: A "${e1.title}" (${e1.info}) · B "${e2.title}" · kapı gizli ${e1.door === false}`);
await A.screenshot({ path: `${OUT}/online-A-son.png` });
await B.screenshot({ path: `${OUT}/online-B-son-pixel7.png` });
check(errs.length === 0, `sayfa hatası ${errs.length} ${errs.slice(0, 3).join(' | ')}`);
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
await browser.close();
process.exit(fail ? 1 : 0);
