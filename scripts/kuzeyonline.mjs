// Kuzey Vadisi (12.172) çevrim içi tarayıcı denetimi: A oda kurar (kuzey, botlu), B katılır; ikisi de haritayı kurar, fx (ot / hayvan / ses) çalışır,
// A savaş alanı dışına çıkınca istemcide uyarı görünür, sunucu 10 sn sonra öldürür.   node scripts/kuzeyonline.mjs   (vite :5391 + sunucu :8931)
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5391', SRV = process.env.SRV || 'ws://127.0.0.1:8931', OUT = process.argv[2] || '/tmp/wb-buyuk/son';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x ? ' · ' + x : '')); if (!c) fails++; };
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const mk = async () => { const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return p; };
const A = await mk(), B = await mk();
await A.goto(`${URL0}/?online=new&name=Ali&server=${encodeURIComponent(SRV)}&map=kuzey&type=conquest&per=8&debug=1&nolock=1&nologin=1`);
await A.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
const code = await A.evaluate(() => window.__game.online?.room || window.__game._badgeCode);
await B.goto(`${URL0}/?online=${code}&name=Veli&server=${encodeURIComponent(SRV)}&debug=1&nolock=1&nologin=1`);
await B.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
await A.waitForTimeout(2500);
const st = await Promise.all([A, B].map((p) => p.evaluate(() => ({ map: window.__game.mapDef.id, fx: !!window.__game.map.fx?.grass, hour: window.__game.map.fx?.hour, n: window.__game.soldiers.length }))));
ok(st.every((s) => s.map === 'kuzey' && s.fx), 'iki istemci de Kuzey Vadisi\'nde, görsel katmanlar kurulu', JSON.stringify(st));
// A sınır dışına yürür: istemci uyarısı + sunucu ölümü (girdiyle yürütmek yerine debug ışınlama: konumu sunucu da kabul etmeli → yürüyerek)
const dead = await A.evaluate(async () => {
  const g = window.__game, me = g.playerSoldier;
  g.online.send({ t: 'dbg', tp: [785, 0] });
  await new Promise((r) => setTimeout(r, 1500));
  const warn = document.getElementById('zonew').style.display === 'block' ? document.getElementById('zonett').textContent : '';
  await new Promise((r) => setTimeout(r, 11000));
  return { warn, alive: me.alive, x: me.pos.x };
});
await A.screenshot({ path: `${OUT}/cevrimici-A.png` }); await B.screenshot({ path: `${OUT}/cevrimici-B.png` });
ok(/SAVAŞ ALANINA/.test(dead.warn) && !dead.alive, 'istemcide uyarı, sunucu 10 sn sonra öldürür (BF_DEBUG=1 sunucu, ışınlama)', JSON.stringify(dead));
ok(!A.errs.length && !B.errs.length, 'sayfa hatası yok', [...A.errs, ...B.errs].slice(0, 3).join(' | '));
console.log(fails ? `sonuç: ${fails} HATA` : 'sonuç: OK');
await browser.close(); process.exit(fails ? 1 : 0);
