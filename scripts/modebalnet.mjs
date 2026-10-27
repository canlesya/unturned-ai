// 12.197 mod dengesi kuralları çevrim içi (iki istemci, sunucu BF_DEBUG=1): node scripts/modebalnet.mjs [url=http://127.0.0.1:5204] [ws=ws://127.0.0.1:8987]
//  1) Çöl Geçidi TDM: skor sınırının yarısında DEVRE ARASI → iki istemcide taraf değişir (swapSides), iki oyuncu da karşı avluda yeniden doğar, bildirim
//  2) aynı oda: süre biter, skor eşit → iki istemcide BERABERE
//  3) Kasaba Ele Geçirme: bayrağı alan oyuncu +100 puan (sunucu anlık görüntüsüyle istemcide)
// GPU=1 gerçek GPU ile; kareler /tmp/wb-bal2/net-*.png
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5204', ws = process.argv[3] || 'ws://127.0.0.1:8987', OUT = '/tmp/wb-bal2';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const errs = [];
const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
const room = async (q, names) => {
  const A = await mk();
  await A.goto(`${base}/?online=new&${q}&server=${encodeURIComponent(ws)}&debug=1&nolock=1&name=${names[0]}&team=blue`, { timeout: 180000 });
  await A.waitForFunction('window.__game && window.__game.running && window.__game.online && window.__game.playerSoldier?.alive', null, { timeout: 400000, polling: 500 });
  const code = await A.evaluate(() => window.__game.opts.online.room);
  const B = await mk();
  await B.goto(`${base}/?online=${code}&server=${encodeURIComponent(ws)}&debug=1&nolock=1&name=${names[1]}&team=red`, { timeout: 180000 });
  for (let i = 0; i < 120; i++) {                                                     // (waitForFunction ikinci sayfada takılıyordu: düz yoklama)
    const st = await B.evaluate(() => ({ ok: !!(window.__game && window.__game.running && window.__game.playerSoldier?.alive), txt: document.body.innerText.slice(0, 120) })).catch((e) => ({ ok: false, txt: String(e) }));
    if (st.ok) break;
    if (i % 12 === 11) console.log('B bekleniyor:', st.txt.replace(/\n/g, ' '));
    await B.waitForTimeout(2500);
  }
  await A.waitForTimeout(1500);
  return [A, B, code];
};
const near = (g, t) => { const s = g.playerSoldier, sp = g.map.spawns[t]; return Math.min(...sp.map((p) => Math.hypot(p.x - s.pos.x, p.z - s.pos.z))); };
const state = (p) => p.evaluate(() => { const g = window.__game, s = g.playerSoldier, d = (t) => Math.min(...g.map.spawns[t].map((p) => Math.hypot(p.x - s.pos.x, p.z - s.pos.z)));
  return { team: s.team, swap: g.swapSides, pos: [+s.pos.x.toFixed(1), +s.pos.z.toFixed(1)], dOwn: +d(s.team).toFixed(1), dFoe: +d(s.team === 'blue' ? 'red' : 'blue').toFixed(1), tk: [g.tickets.blue, g.tickets.red], toast: [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).join(' | '), score: s.score, title: document.querySelector('#etitle')?.textContent, info: document.querySelector('#einfo')?.textContent, ended: g.ended }; });

// ── 1 + 2: Çöl Geçidi TDM ──
{
  const [A, B, code] = await room('map=colgecidi&per=3&type=tdm&tickets=20&time=600&bots=0&room=Devre', ['Ali', 'Veli']);
  const a0 = await state(A), b0 = await state(B);
  check(a0.team === 'blue' && b0.team === 'red' && a0.dOwn < 6 && b0.dOwn < 6, `oda ${code}: başlangıç A ${a0.team} kendi avlusuna ${a0.dOwn} m · B ${b0.team} ${b0.dOwn} m · swap ${a0.swap}/${b0.swap}`);
  // B, A'nın avlusunun yakınına gider (devre arasında A oraya değil karşıya doğmalı)
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', tk: [10, 3] }));
  await A.waitForTimeout(2500);
  const a1 = await state(A), b1 = await state(B);
  await A.screenshot({ path: `${OUT}/net-devre-arasi-A.png` });
  await B.screenshot({ path: `${OUT}/net-devre-arasi-B.png` });
  check(a1.swap !== a0.swap && b1.swap !== b0.swap, `devre arası: iki istemcide taraf değişti (A ${a0.swap}→${a1.swap}, B ${b0.swap}→${b1.swap})`);
  check(a1.dOwn < 8 && b1.dOwn < 8 && Math.hypot(a1.pos[0] - a0.pos[0], a1.pos[1] - a0.pos[1]) > 60, `yeni avluda doğdular: A ${JSON.stringify(a0.pos)}→${JSON.stringify(a1.pos)} (yeni doğuşa ${a1.dOwn} m) · B ${JSON.stringify(b0.pos)}→${JSON.stringify(b1.pos)} (${b1.dOwn} m)`);
  check(/Devre arası/.test(a1.toast) && /Devre arası/.test(b1.toast), `bildirim: A "${a1.toast}" · B "${b1.toast}"`);
  // geç katılan C şu anki tarafları alır
  const C = await mk();
  await C.goto(`${base}/?online=${code}&server=${encodeURIComponent(ws)}&debug=1&nolock=1&name=Can&team=blue`, { timeout: 180000 });
  await C.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier?.alive', null, { timeout: 400000, polling: 500 });
  const c1 = await state(C);
  check(c1.swap === a1.swap && c1.dOwn < 8, `geç katılan C: swap ${c1.swap} (A ${a1.swap}), kendi avlusuna ${c1.dOwn} m`);
  await C.context().close();
  // berabere: skor eşit, süre biter
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', tk: [12, 12], tl: 0.5 }));
  await A.waitForTimeout(3000);
  const a2 = await state(A), b2 = await state(B);
  await A.screenshot({ path: `${OUT}/net-berabere-A.png` });
  check(a2.ended && b2.ended && /BERABERE/.test(a2.title || '') && /BERABERE/.test(b2.title || ''), `süre bitti 12–12: A "${a2.title}" (${a2.info}) · B "${b2.title}"`);
  await A.context().close(); await B.context().close();
}

// ── 3: Kasaba Ele Geçirme bayrak puanı ──
{
  const [A, B] = await room('map=kasaba&per=3&type=conquest&bots=0&room=Bayrak', ['Ali', 'Veli']);
  const f = await A.evaluate(() => { const g = window.__game, o = g.mode.objectives.find((q) => q.id === 'kavsak') || g.mode.objectives[0]; return { id: o.id, x: o.x, z: o.z, name: o.name }; });
  const s0 = await state(A);
  await A.evaluate(([x, z]) => window.__game.online.send({ t: 'dbg', tp: [x + 1, z + 1] }), [f.x, f.z]);
  await A.waitForFunction((id) => window.__game.mode.objectives.find((q) => q.id === id)?.owner === 'blue', f.id, { timeout: 40000, polling: 500 }).catch(() => {});
  await A.waitForTimeout(800);
  const s1 = await state(A), own = await A.evaluate((id) => window.__game.mode.objectives.find((q) => q.id === id)?.owner, f.id);
  await A.screenshot({ path: `${OUT}/net-bayrak-puan-A.png` });
  check(own === 'blue' && s1.score - s0.score >= 100, `${f.name}: sahibi ${own}, A puanı ${s0.score} → ${s1.score} · "${s1.toast}"`);
  await A.context().close(); await B.context().close();
}
check(errs.length === 0, `sayfa hatası ${errs.length} ${errs.slice(0, 3).join(' | ')}`);
await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
