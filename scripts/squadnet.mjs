// 12.202 Çevrim içi manga: sunucunun manga ataması (roster.sq), işaret (ping) takıma gider / düşmana gitmez, mangadan doğuş (sunucu me.sp uygunluğu).
// Üç istemci: Ali + Veli (Mavi, aynı manga), Can (Kırmızı). Botlu Çöl Geçidi ele geçirme odası.
//   node scripts/squadnet.mjs [istemci url] [ws url]   (sunucu BF_DEBUG=1)   → /tmp/wb-squad/net-*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const [base = 'http://127.0.0.1:5284', ws = process.env.WS || 'ws://127.0.0.1:9066'] = process.argv.slice(2), OUT = '/tmp/wb-squad';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
let fails = 0; const check = (ok, m) => { console.log(`${ok ? 'OK  ' : 'HATA'}  ${m}`); if (!ok) fails++; };
const S = `&server=${encodeURIComponent(ws)}&debug=1&nolock=1`;
async function client(q) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/?${q}${S}`);
  await page.waitForFunction(() => window.__game?.running && window.__game.playerSoldier && window.__game.time > 1, null, { timeout: 120000 });
  await page.waitForTimeout(800);
  return { page, errs };
}
const A = await client('online=new&map=colgecidi&type=conquest&per=4&team=blue&name=Ali');
const code = await A.page.evaluate(() => new URLSearchParams(location.search).get('online'));
console.log('oda', code);
const B = await client(`online=${code}&team=blue&name=Veli`);
const C = await client(`online=${code}&team=red&name=Can`);
await A.page.waitForTimeout(1500);

// 1) manga ataması: sunucu Ali ile Veli'yi aynı mangaya koyar (mangalar 4 kişilik kalır)
const sq = async (p) => p.evaluate(() => { const g = window.__game, me = g.playerSoldier; const t = {}; for (const s of g.soldiers) if (!s.vacant) { const k = s.team + s.squad; t[k] = (t[k] || 0) + 1; } return { id: me.id, team: me.team, sq: me.squad, list: [...document.querySelectorAll('#sqp .r .nm')].map((e) => e.textContent), cnt: t }; });
const [a, b, c] = [await sq(A.page), await sq(B.page), await sq(C.page)];
console.log(JSON.stringify({ a, b, c }));
check(a.team === 'blue' && b.team === 'blue' && c.team === 'red', 'takımlar: Ali / Veli Mavi, Can Kırmızı');
check(a.sq === b.sq, `Ali ile Veli aynı mangada (${a.sq} / ${b.sq})`);
check(a.list.includes('Veli') && b.list.includes('Ali'), `HUD manga listesinde birbirlerini görüyorlar (Ali: ${a.list.join(', ')})`);
check(Object.values(a.cnt).every((n) => n <= 4), `mangalar en çok 4 (${JSON.stringify(a.cnt)})`);
const bSq = await B.page.evaluate((id) => window.__game.soldiers[id].squad, a.id);
check(bSq === a.sq, 'Veli\'nin istemcisinde de Ali aynı mangada (roster.sq)');

// 2) işaret: Ali haritaya işaret koyar → Veli görür (yeşil = manga), Can görmez
await A.page.keyboard.press('KeyM'); await A.page.waitForTimeout(400);
const pt = await A.page.evaluate(() => { const g = window.__game, me = g.playerSoldier; return { x: me.pos.x + 12, z: me.pos.z - 25 }; });
const [px, py] = await A.page.evaluate(([x, z]) => { const b = window.__game.bigMap, r = b.cv.getBoundingClientRect(); return [r.left + b.X(x) / b.dpr, r.top + b.Y(z) / b.dpr]; }, [pt.x, pt.z]);
await A.page.mouse.click(px, py);
await A.page.waitForTimeout(1200);
await A.page.screenshot({ path: `${OUT}/net-ali-harita.png` });
await A.page.keyboard.press('KeyM');
const seen = await B.page.evaluate((id) => { const p = window.__game.pings.items.get(id); return p ? { x: p.x, z: p.z, col: window.__game.pings.colorOf(p), obj: !!p.obj } : null; }, a.id);
check(seen && Math.hypot(seen.x - pt.x, seen.z - pt.z) < 1.5 && seen.obj, `Veli Ali'nin işaretini aldı (${seen && seen.x.toFixed(1)}, ${seen && seen.z.toFixed(1)}, 3B)`);
check(seen?.col === '#62f06a', `Veli'de işaret manga rengi (yeşil: ${seen?.col})`);
const cSeen = await C.page.evaluate((id) => !!window.__game.pings.items.get(id), a.id);
check(!cSeen, 'Can (düşman) işareti almadı');
await B.page.evaluate((p) => { const g = window.__game, me = g.playerSoldier; me.yaw = Math.atan2(-(p.x - me.pos.x), -(p.z - me.pos.z)); me.pitch = -0.05; }, pt);
await B.page.waitForTimeout(600);
await B.page.screenshot({ path: `${OUT}/net-veli-isaret.png` });

// 3) mangadan doğuş: botlar susar, Ali ölür → doğuş seçicide Veli uygun (sunucunun me.sp'si) → tıkla + Doğ → Veli'nin yanında
await A.page.evaluate(() => window.__game.online.send({ t: 'dbg', bots: false }));
await A.page.waitForTimeout(600);
await A.page.evaluate(() => window.__game.online.send({ t: 'dbg', kill: 1 }));
await A.page.waitForFunction(() => window.__game.bigMap.mode === 'deploy', null, { timeout: 8000 }).catch(() => {});
await A.page.waitForTimeout(1200);
let st = await A.page.evaluate((bid) => { const g = window.__game; const t = g.bigMap.targets().find((t) => t.id === 'sq:' + bid); return { mode: g.bigMap.mode, sp: g._sqNet ? [...g._sqNet] : null, t: t ? { ok: t.ok, st: t.st, x: t.x, z: t.z } : null }; }, b.id);
console.log('      doğuş durumu:', JSON.stringify(st));
check(st.mode === 'deploy', 'Ali öldü → doğuş seçici harita');
check(st.sp && st.sp.some(([id]) => id === b.id), 'sunucu ölüyken manga arkadaşı uygunluğunu gönderiyor (me.sp)');
// Can, Veli'yi vurur → Veli çatışmada → kapalı
await C.page.evaluate((bid) => window.__game.online.send({ t: 'dbg', dmg: [bid, 5] }), b.id);
await A.page.waitForTimeout(700);
const cmb = await A.page.evaluate((bid) => { const t = window.__game.bigMap.targets().find((t) => t.id === 'sq:' + bid); return t ? { ok: t.ok, st: t.st } : null; }, b.id);
check(cmb && !cmb.ok && cmb.st === 1, `Veli vurulunca mangadan doğuş kapalı (durum ${cmb?.st}: çatışmada)`);
await A.page.screenshot({ path: `${OUT}/net-ali-arkadas-catismada.png` });
// 5 sn sonra açılır
await A.page.waitForFunction((bid) => { const t = window.__game.bigMap.targets().find((t) => t.id === 'sq:' + bid); return t && t.ok; }, b.id, { timeout: 12000 }).catch(() => {});
st = await A.page.evaluate((bid) => { const t = window.__game.bigMap.targets().find((t) => t.id === 'sq:' + bid); return t ? { ok: t.ok, x: t.x, z: t.z } : null; }, b.id);
check(st?.ok, 'çatışmadan 5 sn sonra Veli yine uygun');
// deploy auto-spawn would happen after DEPLOY_AUTO; we click now
if (st?.ok) {
  const [mx, my] = await A.page.evaluate(([x, z]) => { const b = window.__game.bigMap, r = b.cv.getBoundingClientRect(); return [r.left + b.X(x) / b.dpr, r.top + b.Y(z) / b.dpr]; }, [st.x, st.z]);
  await A.page.mouse.click(mx, my); await A.page.waitForTimeout(300);
  check(await A.page.evaluate((bid) => window.__game.spawnChoice === 'sq:' + bid, b.id), 'Ali Veli\'yi seçti');
  await A.page.screenshot({ path: `${OUT}/net-ali-dogus-secimi.png` });
  await A.page.click('#respawn .dgo');
  await A.page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 15000 }).catch(() => {});
  await A.page.waitForTimeout(900);
  const r = await A.page.evaluate((bid) => { const g = window.__game, p = g.playerSoldier, m = g.soldiers[bid]; return { alive: p.alive, d: Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z), dy: p.pos.y - m.pos.y }; }, b.id);
  const rb = await B.page.evaluate((aid) => { const g = window.__game, p = g.playerSoldier, m = g.soldiers[aid]; return { alive: m.alive, d: Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z) }; }, a.id);
  check(r.alive && r.d < 4.5 && Math.abs(r.dy) < 1, `Ali Veli'nin yanında doğdu (Ali'de ${r.d.toFixed(2)} m, Veli'de ${rb.d.toFixed(2)} m)`);
  await A.page.screenshot({ path: `${OUT}/net-ali-mangadan-dogus.png` });
  await B.page.screenshot({ path: `${OUT}/net-veli-ali-yaninda.png` });
}
// 4) seçmeden Doğ'a basılmazsa: süre + 10 sn sonra kendiliğinden (AFK koruması)
await B.page.evaluate(() => window.__game.online.send({ t: 'dbg', kill: 1 }));
await B.page.waitForFunction(() => !window.__game.playerSoldier.alive, null, { timeout: 5000 }).catch(() => {});
const t0 = Date.now();
await B.page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 30000 }).catch(() => {});
const dt = (Date.now() - t0) / 1000;
check(dt > 8 && dt < 25, `Doğ'a basmayan Veli bekledi, sonra kendiliğinden doğdu (${dt.toFixed(1)} sn)`);
for (const [n, x] of [['Ali', A], ['Veli', B], ['Can', C]]) check(!x.errs.length, `${n}: sayfa hatası yok ${x.errs.slice(0, 2).join(' | ')}`);
await browser.close();
console.log(fails ? `sonuç: HATA (${fails})` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
