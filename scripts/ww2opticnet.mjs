// 12.174 Cephe dönem nişangâhı çevrim içi: A (Cephanelik kaydı: Sürgülü Tüfek + 1,5× öncü dürbün) oda kurar, B katılır.
// Denetim: sunucu A'yı kayıtlı silah + nişangâhla doğurur; B'de A'nın 3. şahıs silah modeli aynı nişangâhla (ağ 'op'); A B tuşuyla değiştirince B'de değişir;
// sunucu izinsiz nişangâhı (modern red dot / ACOG, makineliye dürbün) reddeder.
//   PORT=8893 BF_DEBUG=1 node server/index.js   ·   node scripts/ww2opticnet.mjs [vite url] [ws url] [görsel klasörü]
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180', ws = process.argv[3] || 'ws://127.0.0.1:8893', OUT = process.argv[4] || '/tmp/wb-ww2optic/net';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const errs = [], fail = [], res = {};
const mk = async (name, prefs) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' });
  await ctx.addInitScript((p) => { try { const o = JSON.parse(localStorage.getItem('warbyte.v2') || '{}'); Object.assign(o, p); localStorage.setItem('warbyte.v2', JSON.stringify(o)); } catch (e) { /* */ } }, prefs);
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(name + ': ' + e.message)); return page;
};
const A = await mk('A', { cls: 'assault', team: 'blue', frontLoadouts: { assault: { primary: 'ww_bolt' } }, frontOptics: { ww_bolt: 'ww_scout' } });
await A.goto(`${base}/?online=new&name=Aa&map=cephe&type=front&per=4&team=blue&cls=assault&server=${encodeURIComponent(ws)}&debug=1&nolock=1`);
await A.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier?.alive', null, { timeout: 180000 });
const room = await A.evaluate(() => new URLSearchParams(location.search).get('online'));
const B = await mk('B', { cls: 'sniper', frontLoadouts: {}, frontOptics: {} });
await B.goto(`${base}/?online=${room}&name=Bb&team=red&cls=assault&server=${encodeURIComponent(ws)}&debug=1&nolock=1`);
await B.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier', null, { timeout: 180000 });
await B.waitForTimeout(2500);
const aId = await A.evaluate(() => window.__game.playerSoldier.id);
res.A = await A.evaluate(() => { const s = window.__game.playerSoldier; return { mode: window.__game.mode.type, item: s.item.id, optic: s.opticId }; });
const seen = () => B.evaluate((id) => { const s = window.__game.soldiers[id], w = s.model?.weapon; return { item: s.item.id, optic: s.opticFor(s.item.id), model: w?.userData?.optic, wid: w?.userData?.id }; }, aId);
const askA = () => A.evaluate(() => new Promise((r) => { const n = window.__game.online; const h = (m) => { if (m.t === 'dbg') { n.ws.removeEventListener('message', f); r(m.optic); } }; const f = (e) => { try { h(JSON.parse(e.data)); } catch (x) { /* */ } }; n.ws.addEventListener('message', f); n.send({ t: 'dbg', ask: 1 }); setTimeout(() => r(null), 3000); }));
res.server0 = await askA();
res.B0 = await seen();
if (res.A.item !== 'ww_bolt' || res.A.optic !== 'ww_scout' || res.server0 !== 'ww_scout') fail.push('A doğuş ' + JSON.stringify(res.A) + ' sunucu ' + res.server0);
if (res.B0.optic !== 'ww_scout' || res.B0.model !== 'ww_scout') fail.push('B A\'yı öncü dürbünle görmüyor ' + JSON.stringify(res.B0));
// A: B tuşu (kenar 'o' + yerel cycleOptic) → 2,5×
await A.bringToFront(); await A.keyboard.press('KeyB'); await A.waitForTimeout(1500);
res.A1 = await A.evaluate(() => window.__game.playerSoldier.opticId); res.server1 = await askA(); res.B1 = await seen();
if (res.A1 !== 'ww_sc25' || res.server1 !== 'ww_sc25' || res.B1.model !== 'ww_sc25') fail.push('B tuşu ' + JSON.stringify({ a: res.A1, s: res.server1, b: res.B1 }));
// izinsiz: modern red dot / ACOG ve fo ile modern → reddedilir
await A.evaluate(() => { const n = window.__game.online; n.send({ t: 'opt', optic: 'acog' }); n.send({ t: 'opt', fo: { ww_bolt: 'reddot', ww_mg: 'ww_sc4' } }); });
await A.waitForTimeout(1200);
res.server2 = await askA(); res.B2 = await seen();
if (res.server2 !== 'ww_sc25' || res.B2.model !== 'ww_sc25') fail.push('izinsiz nişangâh kabul edildi ' + JSON.stringify({ s: res.server2, b: res.B2 }));
// A'yı B'nin önüne koy, B'den görüntü (3. şahıs model)
await A.evaluate(() => { const n = window.__game.online; n.send({ t: 'opt', optic: 'ww_scout' }); window.__game.player.pickOptic('ww_scout'); });
await A.waitForTimeout(1200);
res.B3 = await seen();
const bId = await B.evaluate(() => window.__game.playerSoldier.id);
await A.evaluate(([a, b]) => { const n = window.__game.online; n.send({ t: 'dbg', tps: [b, -3, 100, 0, 100] }); n.send({ t: 'dbg', tps: [a, -2.2, 97.6, Math.PI * 0.7, 100] }); n.send({ t: 'dbg', bots: false }); }, [aId, bId]);
await B.waitForTimeout(2500);
await B.bringToFront();
await B.evaluate((id) => { const g = window.__game, s = g.playerSoldier, a = g.soldiers[id]; s.yaw = Math.atan2(-(a.pos.x - s.pos.x), -(a.pos.z - s.pos.z)); s.pitch = -0.08; g.hud.root.style.display = 'none'; }, aId);
await B.waitForTimeout(900);
await B.screenshot({ path: `${OUT}/B-A-ucuncu-sahis-oncu-durbun.png` });
if (res.B3.model !== 'ww_scout') fail.push('pickOptic B\'de görünmedi ' + JSON.stringify(res.B3));
console.log(JSON.stringify(res, null, 1));
console.log('sayfa hatası', errs.length, errs.slice(0, 3));
console.log(fail.length || errs.length ? 'sonuç: HATA ' + fail.join(' · ') : 'sonuç: OK');
await browser.close();
process.exit(fail.length || errs.length ? 1 : 0);
