// 12.190 çevrim içi silah başına nişangâh: A (kayıt m4a1 → 3×, eski genel tercih ACOG) oda kurar, B katılır. Sunucu A'yı 3× ile doğurur, B 3. şahıs modelde 3× görür;
// A 6× seçince sunucu + B değişir, kayıt (frontOptics) güncellenir; izinsiz (M4'e 8×) reddedilir.   PORT=8975 BF_DEBUG=1 node server/index.js · node scripts/pubgopticnet.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const ws = 'ws://127.0.0.1:8975';
const mk = async (prefs) => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); await ctx.addInitScript((p) => { const o = JSON.parse(localStorage.getItem('warbyte.v2') || '{}'); Object.assign(o, p); localStorage.setItem('warbyte.v2', JSON.stringify(o)); }, prefs); return ctx.newPage(); };
const A = await mk({ cls: 'assault', team: 'blue', optic: 'acog', loadouts: { assault: { primary: 'm4a1' } }, frontOptics: { m4a1: 'x3' } });
await A.goto(`http://127.0.0.1:5198/?online=new&name=Aa&map=colgecidi&type=tdm&per=3&team=blue&cls=assault&server=${encodeURIComponent(ws)}&debug=1&nolock=1`);
await A.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier?.alive', null, { timeout: 180000 });
const room = await A.evaluate(() => new URLSearchParams(location.search).get('online'));
const B = await mk({ cls: 'assault' });
await B.goto(`http://127.0.0.1:5198/?online=${room}&name=Bb&team=red&cls=assault&server=${encodeURIComponent(ws)}&debug=1&nolock=1`);
await B.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier', null, { timeout: 180000 });
await B.waitForTimeout(2500);
const aId = await A.evaluate(() => window.__game.playerSoldier.id);
const askA = () => A.evaluate(() => new Promise((r) => { const n = window.__game.online; const f = (e) => { try { const m = JSON.parse(e.data); if (m.t === 'dbg') { n.ws.removeEventListener('message', f); r(m.optic); } } catch (x) { /* */ } }; n.ws.addEventListener('message', f); n.send({ t: 'dbg', ask: 1 }); }));
const seen = () => B.evaluate((id) => { const s = window.__game.soldiers[id]; return { item: s.item.id, optic: s.opticFor(s.item.id), model: s.model?.weapon?.userData?.optic }; }, aId);
const out = {};
out.A0 = await A.evaluate(() => ({ item: window.__game.playerSoldier.item.id, optic: window.__game.playerSoldier.opticId }));
out.srv0 = await askA(); out.B0 = await seen();
await A.evaluate(() => window.__game.player.pickOptic('x6')); await A.waitForTimeout(1500);
out.srv1 = await askA(); out.B1 = await seen();
await A.evaluate(() => window.__game.online.send({ t: 'opt', optic: 'x8' })); await A.waitForTimeout(1000);      // izinsiz (M4'e 8×) → reddedilmeli
out.srv2 = await askA();
out.pref = await A.evaluate(() => JSON.parse(localStorage.getItem('warbyte.v2')).frontOptics);
console.log(JSON.stringify(out));
const ok = out.A0.optic === 'x3' && out.srv0 === 'x3' && out.B0.model === 'x3' && out.srv1 === 'x6' && out.B1.model === 'x6' && out.srv2 === 'x6' && out.pref.m4a1 === 'x6';
console.log(ok ? 'sonuç: OK' : 'sonuç: HATA');
await browser.close();
