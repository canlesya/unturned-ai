// 12.167 Kıyafet kaplamaları uçtan uca: kodlama / sunucu temizliği (tarayıcısız) → menü Görünüm sekmesi (seçim kalıcı, tüm sınıflar) →
// çevrimdışı maç (kendi modelim seçtiğim kombinde, botlar çeşitli, pelerin salınımı, uzay modunda kıyafet geçmez) → çevrimiçi (B, A'nın kombinini görür; geçersiz kod atılır).
//   node scripts/weartest.mjs [taban url] [ws url]      (örn. http://127.0.0.1:5180 ws://127.0.0.1:8787)   OUT=klasör → görüntüler
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import WebSocket from 'ws';
import { wearEncode, wearDecode, cleanWear, cleanWearCode, botWear, CLASS_WEAR, wearCodeOf } from '../src/game/wearIds.js';
import { wearNet } from '../src/net/protocol.js';
const base = process.argv[2] || 'http://127.0.0.1:5180', WS = process.argv[3] || 'ws://127.0.0.1:8787', OUT = process.env.OUT || '/tmp/wb-weartest';
mkdirSync(OUT, { recursive: true });
let fail = 0; const errs = [];
const check = (ok, m) => { console.log((ok ? 'OK    ' : 'HATA  ') + m); if (!ok) fail++; };

// 0) tarayıcısız: kodlama, temizlik, ağ alanı
{
  const w = { head: 'neonhelm', top: 'kevlar', back: 'cape', legs: 'cargo', feet: 'sneakers', pal: { head: 'night', top: 'gold', back: 'wood', legs: 'urban', feet: 'std' } };
  const c = wearEncode(w), d = wearDecode(c, 'assault');
  check(c.length === 10 && ["head", "top", "back", "legs", "feet"].every((k) => d[k] === w[k] && d.pal[k] === w.pal[k]), `kod gidiş-dönüş (${c})`);
  check(cleanWearCode('9999999999') === '' && cleanWearCode('12') === '' && cleanWearCode(c) === c, 'geçersiz kod atılır');
  const cl = cleanWear({ c: { assault: c, zombie: c, medic: 'xx', sniper: wearEncode(CLASS_WEAR.sniper) }, all: 'abc', junk: 1 });
  check(JSON.stringify(cl) === JSON.stringify({ c: { assault: c } }), `sunucu temizliği: bilinmeyen sınıf / bozuk / varsayılana eşit kod yazılmaz ${JSON.stringify(cl)}`);
  check(cleanWear(null) === null && cleanWear('x') === null, 'boş tercih → null');
  check(wearCodeOf({ c: { assault: c }, all: '0000000000' }, 'assault') === '0000000000', '"tüm sınıflar" sınıf kodunu geçersiz kılar');
  const a = botWear('assault', 3), b = botWear('assault', 3), many = new Set(Array.from({ length: 24 }, (_, i) => wearEncode(botWear('assault', i))));
  check(JSON.stringify(a) === JSON.stringify(b) && many.size >= 4, `bot çeşitlemesi belirlenimli + çeşitli (24 botta ${many.size} farklı kombin)`);
  const s = { human: true, cls: 'medic', def: {}, wear: { c: { medic: c } } };
  check(wearNet(s) === c && wearNet({ ...s, human: false }) === '' && wearNet({ ...s, wear: null }) === wearEncode(CLASS_WEAR.medic), 'ağ alanı wr: insan → kod / varsayılan, bot → yok');
}

const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const newPage = async () => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(e.message)); return { ctx, page }; };

// 1) menü: Cephanelik → Görünüm → Bere + Çöl (kafa) → kalıcı; tüm sınıflar
{
  const { ctx, page } = await newPage();
  await page.goto(base + '/?touch=0'); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('warbyte.lang', 'tr'); localStorage.setItem('warbyte.acct', JSON.stringify({ kind: 'guest' })); });
  await page.goto(base + '/?touch=0'); await page.waitForSelector('.mn-nav', { timeout: 60000 }); await page.waitForTimeout(800);
  await page.click('.mn-nav[data-v=loadout]'); await page.waitForTimeout(600);
  await page.click('.slotb.look'); await page.waitForTimeout(600);
  check(await page.locator('[data-a=wit]').count() === 26, `menü: 26 parça çipi (${await page.locator('[data-a=wit]').count()})`);
  await page.click('[data-a=wit][data-s=head][data-v=beanie]'); await page.waitForTimeout(300);
  await page.click('[data-a=wpal][data-s=head][data-v=desert]'); await page.waitForTimeout(300);
  await page.click('[data-a=wit][data-s=back][data-v=cape]'); await page.waitForTimeout(300);
  let st = await page.evaluate(() => JSON.parse(localStorage.getItem('warbyte.v2') || '{}').wear);
  const want = wearEncode({ ...CLASS_WEAR.assault, head: 'beanie', back: 'cape', pal: { ...CLASS_WEAR.assault.pal, head: 'desert' } });
  check(st?.c?.assault === want, `menü: Saldırı kombini kaydedildi (${JSON.stringify(st)})`);
  await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/menu-look.png` });
  await page.reload(); await page.waitForSelector('.mn-nav', { timeout: 60000 }); await page.click('.mn-nav[data-v=loadout]'); await page.waitForTimeout(500); await page.click('.slotb.look'); await page.waitForTimeout(400);
  check(await page.locator('[data-a=wit][data-s=head][data-v=beanie].on').count() === 1, 'menü: yenileyince Bere seçili');
  await page.click('.tab[data-v=medic]'); await page.waitForTimeout(400);
  check(await page.locator('[data-a=wit][data-s=top][data-v=rig].on').count() === 1, 'menü: Sıhhiye kendi varsayılanında (Hafif Yelek)');
  await page.click('.tab[data-v=assault]'); await page.waitForTimeout(300); await page.click('[data-a=wall]'); await page.waitForTimeout(300);
  st = await page.evaluate(() => JSON.parse(localStorage.getItem('warbyte.v2') || '{}').wear);
  check(st?.all === want, `menü: "tüm sınıflarda kullan" → ortak kod (${JSON.stringify(st)})`);
  await page.click('.tab[data-v=medic]'); await page.waitForTimeout(400);
  check(await page.locator('[data-a=wit][data-s=head][data-v=beanie].on').count() === 1, 'menü: Sıhhiye sekmesi de ortak kombini gösterir');
  await page.click('[data-a=wall]'); await page.waitForTimeout(300);
  await page.click('.tab[data-v=assault]'); await page.waitForTimeout(300);
  // 2) çevrimdışı maç (Saldırı + 3. şahıs)
  await page.goto(base + '/?autostart=6v6&map=colgecidi&type=tdm&debug=1&nolock=1&third=1');
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; return { me: me.model.wear, bots: g.soldiers.filter((s) => s !== me && s.model?.wear).map((s) => [s.cls, s.model.wear.head, s.model.wear.feet, s.model.wear.back].join('/')), sway: g.soldiers.filter((s) => s.model?.root.userData.swayMat).map((s) => s.model.root.userData.swayMat.userData.sway.value.toArray().map((v) => +v.toFixed(3))) }; });
  check(r.me?.head === 'beanie' && r.me?.pal?.head === 'desert' && r.me?.back === 'cape', `oyun: kendi modelim seçtiğim kombinde ${JSON.stringify(r.me)}`);
  check(new Set(r.bots).size >= 4, `oyun: botlar çeşitli (${new Set(r.bots).size} farklı: ${[...new Set(r.bots)].slice(0, 6).join(' ')})`);
  check(r.sway.length >= 1 && r.sway.some((v) => Math.abs(v[0]) > 0.005 || v[3] > 0.05), `oyun: pelerin salınımı (uSway ${JSON.stringify(r.sway.slice(0, 4))})`);
  await page.screenshot({ path: `${OUT}/offline-third.png` });
  await page.goto(base + '/?autostart=4v4&map=yorunge&type=space&debug=1&nolock=1&third=1');
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  const sp = await page.evaluate(() => window.__game.soldiers.filter((s) => s.model?.wear).length);
  check(sp === 0, `uzay modu: kıyafet kaplaması geçmez (uzay kıyafeti) (${sp})`);
  await page.goto(base + '/?autostart=4v4&map=cephe&type=front&debug=1&nolock=1&third=1');
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  const fr = await page.evaluate(() => ({ n: window.__game.soldiers.filter((s) => s.model?.wear).length, cuff: !!window.__game.player.vm.look?.ww2 }));
  check(fr.n === 0 && fr.cuff, `cephe modu: 1940'lar üniforması, kıyafet kaplaması geçmez, birinci şahıs ceket kolu (${JSON.stringify(fr)})`);
  await ctx.close();
}
// 3) çevrimiçi: A (ışıklı set, tüm sınıflar) oda kurar, B katılır → B, A'nın kombinini görür; ham ws istemcisinin bozuk kodu atılır
{
  const code = '6646563636';
  const A = await newPage(), B = await newPage();
  await A.page.goto(base + '/?touch=0'); await A.page.evaluate((code) => { localStorage.clear(); localStorage.setItem('warbyte.acct', JSON.stringify({ kind: 'guest' })); localStorage.setItem('warbyte.v2', JSON.stringify({ wear: { all: code } })); }, code);
  await A.page.goto(`${base}/?online=new&server=${encodeURIComponent(WS)}&name=Moda&map=colgecidi&type=tdm&per=3&bots=1&debug=1&nolock=1&touch=0`);
  await A.page.waitForFunction('window.__game && window.__game.running && window.__game.online && window.__game.playerSoldier.alive', null, { timeout: 120000 });
  const room = await A.page.evaluate(() => new URLSearchParams(location.search).get('online'));
  const aid = await A.page.evaluate(() => window.__game.playerSoldier.id);
  const raw = await new Promise((res) => { const ws = new WebSocket(WS); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
  raw.send(JSON.stringify({ t: 'join', room, name: 'Bozuk', wear: { all: '99999zzzzz', c: { assault: [1, 2] } } }));
  await B.page.goto(base + '/?touch=0'); await B.page.evaluate(() => { localStorage.clear(); localStorage.setItem('warbyte.acct', JSON.stringify({ kind: 'guest' })); });
  await B.page.goto(`${base}/?online=${room}&server=${encodeURIComponent(WS)}&name=Izleyici&debug=1&nolock=1&touch=0`);
  await B.page.waitForFunction('window.__game && window.__game.running && window.__game.online && window.__game.playerSoldier.alive', null, { timeout: 120000 });
  const rid = raw.msgs.find((m) => m.t === 'welcome')?.id;
  const seen = async () => B.page.evaluate(([aid, rid]) => { const g = window.__game, a = g.soldiers[aid], r = g.soldiers[rid]; return { a: a?.model?.wear, ac: a?.wearCode, r: r?.model?.wear && [r.model.wear.head, r.model.wear.top].join('/'), rc: r?.wearCode }; }, [aid, rid]);
  let r = null; for (let i = 0; i < 40; i++) { r = await seen(); if (r.a?.head === 'neonhelm') break; await B.page.waitForTimeout(250); }
  check(r.a?.head === 'neonhelm' && r.a?.back === 'lightcape' && r.a?.pal?.top === 'night', `çevrimiçi: B, A'nın ışıklı kombinini görüyor (${r.ac})`);
  check(r.rc === wearEncode(CLASS_WEAR.assault) && r.r === 'helmet/carrier', `çevrimiçi: bozuk kod atıldı → sınıf varsayılanı (${r.rc} ${r.r})`);
  await B.page.evaluate((aid) => { const g = window.__game, a = g.soldiers[aid], me = g.playerSoldier; me.pos.set(a.pos.x + 2.2, a.pos.y, a.pos.z + 1.2); me.yaw = Math.atan2(-(a.pos.x - me.pos.x), -(a.pos.z - me.pos.z)); me.pitch = -0.12; }, aid);
  await B.page.waitForTimeout(700); await B.page.screenshot({ path: `${OUT}/third-online.png` });
  const fpA = await A.page.evaluate(() => window.__game.player.vm.look?.cuff || null);
  check(!!fpA, `çevrimiçi: A'nın birinci şahıs kolunda ışıklı üst manşeti (${fpA})`);
  raw.close(); await A.ctx.close(); await B.ctx.close();
}
check(!errs.length, `sayfa hatası yok ${errs.slice(0, 3).join(' | ')}`);
await browser.close();
console.log(fail ? `\n${fail} HATA` : '\nTÜMÜ TAMAM');
process.exit(fail ? 1 : 0);
