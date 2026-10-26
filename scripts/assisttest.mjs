// Asist testi (12.165). Önce: vite (BASE, vars. :5180) + BF_DEBUG=1 sunucu (WS; API aynı port, http).
//   PORT=8871 ADMIN_PORT=8872 BF_DATA=/tmp/wb-assist-data BF_DEBUG=1 BF_RESTART_MS=4000 node server/index.js
//   BASE=http://127.0.0.1:5180 WS=ws://127.0.0.1:8871 node scripts/assisttest.mjs      · görüntüler: /tmp/wb-assist/   · ONLY=rules | offline | online
// 1) Kural (tarayıcısız, başsız Game): A vurur, B öldürür → A asist (+50); eşik altı yok; 10 sn süre aşımı; takım arkadaşı hasarı sayılmaz; öldüren asist almaz;
//    iki katkı veren; tam iyileşme / yeniden doğuş sıfırlar; düştü / intihar: son 5 sn'de vuran düşmana öldürme, diğerine asist; dm / gg / pb (1 isabet) / inf;
//    ağ: 'as' olayı yalnız insana (to), anlık görüntüde `as`, slowSig değişir.
// 2) Çevrimdışı tarayıcı (masaüstü + Pixel 7): +ASİST bildirimi (#pops), ses, skor tablosu K / A / D, maç sonu ekranı Asist, profil (yerel) assists, menü kartı.
// 3) Çevrim içi: iki istemci; A bota hasar verir, B öldürür → A'da bildirim, B'de yok; tablo sayıları sunucu = A = B; hesaplı A'nın profili assists artar.
import { chromium, devices } from 'playwright';
import fs from 'fs';
import { Game } from '../src/game/game.js';
import { packSoldier, slowSig } from '../src/net/protocol.js';
import { ASSIST } from '../src/game/assist.js';

const BASE = process.env.BASE || 'http://127.0.0.1:5180', WS = process.env.WS || 'ws://127.0.0.1:8787', API = WS.replace(/^ws/, 'http');
const OUT = process.env.OUT || '/tmp/wb-assist'; fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY || '';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };

// ── 1) kural (başsız)
if (!ONLY || ONLY === 'rules') {
  const mk = (type, map = 'colgecidi', per = 4) => { const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type, time: 900 } }); g.brains.length = 0; for (const s of g.soldiers) if (!s.alive) g.respawn(s); g.time = 100; return g; };
  const hit = (g, a, v, d) => { v.protT = 0; v.takeDamage(d, a, 'body', a.pos, 'test'); };
  const fresh = (g, ...l) => { for (const s of l) { g.respawn(s); s.protT = 0; s.hp = s.maxHp; } };
  {
    const g = mk('tdm');
    const blue = g.soldiers.filter((s) => s.team === 'blue'), red = g.soldiers.filter((s) => s.team === 'red');
    const [A, B, C, M] = blue, V = red[0], V2 = red[1];
    const snap = () => [A, B, C].map((s) => [s.kills, s.assists, s.score]);
    // temel
    hit(g, A, V, 30); g.time += 3; hit(g, B, V, 9999);
    check(!V.alive && B.kills === 1 && A.assists === 1 && A.score === ASSIST.pts && B.assists === 0 && A.kills === 0, `tdm: A 30 hasar, B öldürdü → A asist 1 (+${A.score}), B öldürme 1 / asist 0`);
    // eşik altı
    fresh(g, V); let s0 = snap(); hit(g, A, V, 20); hit(g, B, V, 9999);
    check(A.assists === s0[0][1], `tdm: eşik altı (20 < ${ASSIST.minDmg}) asist yok`);
    // tam eşik
    fresh(g, V); hit(g, A, V, 25); hit(g, B, V, 9999);
    check(A.assists === 2, `tdm: tam eşik (25) asist`);
    // birden çok küçük isabet toplanır
    fresh(g, V); hit(g, A, V, 12); g.time += 2; hit(g, A, V, 14); hit(g, B, V, 9999);
    check(A.assists === 3, 'tdm: 12 + 14 hasar toplandı → asist');
    // süre aşımı
    fresh(g, V); hit(g, A, V, 40); g.time += ASSIST.window + 0.5; hit(g, B, V, 9999);
    check(A.assists === 3, `tdm: ${ASSIST.window + 0.5} sn önceki hasar sayılmadı`);
    fresh(g, V); hit(g, A, V, 40); g.time += ASSIST.window - 0.5; hit(g, B, V, 9999);
    check(A.assists === 4, `tdm: ${ASSIST.window - 0.5} sn önceki hasar sayıldı`);
    // takım arkadaşı hasarı (V'nin takımından V2 V'yi vurur) sayılmaz
    fresh(g, V); hit(g, V2, V, 40); hit(g, B, V, 9999);
    check(V2.assists === 0, 'tdm: takım arkadaşına verilen hasar asist vermez');
    // öldüren asist almaz
    fresh(g, V); s0 = snap(); hit(g, B, V, 60); hit(g, B, V, 9999);
    check(B.assists === s0[1][1] && B.kills === s0[1][0] + 1, 'tdm: önce vurup sonra öldüren yalnız öldürme alır');
    // iki katkı veren
    fresh(g, V); hit(g, A, V, 30); hit(g, C, V, 30); hit(g, B, V, 9999);
    check(A.assists === 5 && C.assists === 1, 'tdm: iki katkı veren ikisi de asist');
    // tam iyileşme sıfırlar, kısmi sıfırlamaz
    fresh(g, V); hit(g, A, V, 30); V.heal(100); hit(g, B, V, 9999);
    check(A.assists === 5, 'tdm: tam iyileşme kaydı sıfırladı');
    fresh(g, V); hit(g, A, V, 30); V.heal(10); hit(g, B, V, 9999);
    check(A.assists === 6, 'tdm: kısmi iyileşme sıfırlamadı');
    // yeniden doğuş sıfırlar
    fresh(g, V); hit(g, A, V, 30); g.respawn(V); V.protT = 0; hit(g, B, V, 9999);
    check(A.assists === 6, 'tdm: yeniden doğuş kaydı sıfırladı');
    // öldürensiz ölüm: düştü → son 5 sn'de vuran düşmana öldürme, diğerine asist
    fresh(g, V); s0 = snap(); const tk0 = g.tickets.blue; hit(g, C, V, 30); g.time += 1; hit(g, A, V, 30); g.time += 2; V.die(V, 'Düştü', false);
    check(A.kills === s0[0][0] + 1 && C.assists === 2 && A.assists === s0[0][1] && g.tickets.blue === tk0 + 1, `tdm: düştü → öldürme son vuran A'ya (${A.kills}), C asist, takıma skor`);
    fresh(g, V); s0 = snap(); hit(g, A, V, 30); g.time += ASSIST.credit + 1; V.die(V, 'İntihar', false);
    check(A.kills === s0[0][0] && A.assists === s0[0][1] + 1 && V.kills === 0, `tdm: intihar, son hasar ${ASSIST.credit + 1} sn önce → öldürme yok, A asist`);
    fresh(g, V); s0 = snap(); hit(g, V2, V, 30); V.die(V, 'Düştü', false);
    check(V2.kills === 0 && V2.assists === 0, 'tdm: takım arkadaşı vurdu + düştü → kimseye öldürme / asist yok');
    // kendi bombası (saldıran = kendisi): kendi hasarı kayda girmez, vuran düşman öldürmeyi alır
    fresh(g, V); s0 = snap(); hit(g, A, V, 30); hit(g, V, V, 9999);
    check(A.kills === s0[0][0] + 1, 'tdm: kendi bombasıyla öldü → son 5 sn vuran A öldürme aldı');
    // ağ: 'as' olayı yalnız insan saldırana, to alanıyla; anlık görüntü
    fresh(g, V); A.human = true; g.netEvents.length = 0; const sig0 = slowSig(A); hit(g, A, V, 30); hit(g, B, V, 9999);
    const ev = g.netEvents.filter((e) => e.e === 'as');
    check(ev.length === 1 && ev[0].to === A.id && ev[0].v === V.id && ev[0].p === ASSIST.pts, `ağ: as olayı ${JSON.stringify(ev)}`);
    check(packSoldier(A).as === A.assists && packSoldier(B).as === undefined && slowSig(A) !== sig0, `ağ: anlık görüntü as=${packSoldier(A).as}, 0 olan yazılmaz, imza değişti`);
    A.human = false;
    // takım değiştiren (enfekte gibi): ölüm anında artık aynı takımdaysa sayılmaz
    fresh(g, V); hit(g, A, V, 30); A.team = 'red'; const a0 = A.assists; hit(g, B, V, 9999); A.team = 'blue';
    check(A.assists === a0, 'tdm: ölüm anında takım arkadaşı olmuş saldıran asist almaz');
  }
  for (const [type, map] of [['dm', 'colgecidi'], ['gg', 'colgecidi'], ['conquest', 'kasaba'], ['pb', 'boyakulesi'], ['inf', 'newyork']]) {
    const g = mk(type, map, type === 'pb' || type === 'dm' || type === 'gg' || type === 'inf' ? 8 : 4);
    if (type === 'inf') { const z = g.soldiers.find((s) => s.team === 'blue' && s.alive); g.timeLeft = Math.min(g.timeLeft, g.mode.time - 30); if (!g.soldiers.some((s) => s.team === 'red')) g.makeZombie(z, false, 'walker'); }
    const L = g.soldiers.filter((s) => !s.vacant);
    let A, B, V;
    if (g.ffa) [A, B, V] = L;
    else { V = L.find((s) => s.team === 'red'); [A, B] = L.filter((s) => s.team === 'blue'); }
    fresh(g, V); V.protT = 0;
    const d = type === 'pb' ? 18 : type === 'inf' ? 60 : 30;      // enfekte: hedef boss (zırh hasarın %30'unu yutar → 42 etkili)
    hit(g, A, V, d); hit(g, B, V, 9999);
    check(!V.alive && A.assists === 1 && B.kills >= 1, `${type}: A ${d} hasar (${type === 'pb' ? '1 isabet' : 'eşik'}), B öldürdü → A asist (${A.assists})`);
    if (type === 'pb') { fresh(g, V); hit(g, A, V, 0.5); hit(g, B, V, 9999); check(A.assists === 2, 'pb: tek isabet (hasar ne olursa) asist'); }
    if (g.ffa) { fresh(g, V); hit(g, V, V, 40); hit(g, B, V, 9999); check(V.assists === 0, `${type}: kendine verilen hasar sayılmaz`); }
  }
}

// ── tarayıcı ortak
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const needBrowser = !ONLY || ONLY === 'offline' || ONLY === 'online';
const browser = needBrowser ? await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }) : null;
const errs = [];
const watch = (page, tag) => { page.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|WebSocket|ERR_CONNECTION|Failed to load resource/i.test(m.text())) errs.push(`${tag}: ${m.text()}`); }); };
async function open(url, ctxOpts, tag, init = null) {
  const ctx = await browser.newContext({ locale: 'tr-TR', ...ctxOpts }); const page = await ctx.newPage(); watch(page, tag);
  await page.addInitScript((init) => { try { localStorage.setItem('warbyte.lang', 'tr'); if (init && !sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); for (const [k, v] of Object.entries(init)) localStorage.setItem(k, v); } } catch (e) { /* yok */ } }, init);
  await page.goto(url);
  console.log(`      ${tag}: ${url.replace(BASE, '')}`);
  await page.waitForFunction(() => window.__game?.playerSoldier && window.__game.running, null, { timeout: 240000 });
  await page.waitForTimeout(800);
  await page.mouse.click((ctxOpts.viewport?.width || 1280) / 2, (ctxOpts.viewport?.height || 720) / 2);
  await page.evaluate(async () => { const g = window.__game; window.__as = []; g.on('assist', (e) => window.__as.push({ by: e.by?.id, v: e.victim?.id, p: e.pts })); window.__asSfx = 0; const f = g.sfx.assist?.bind(g.sfx); g.sfx.assist = () => { window.__asSfx++; f?.(); }; await g.sfx.ctx?.resume?.(); });
  return { ctx, page };
}
const freeze = async (page, name) => { await page.waitForTimeout(250); await page.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = Math.min(380, a.effect.getTiming().duration * 0.3); })); await page.screenshot({ path: `${OUT}/${name}.png` }); await page.evaluate(() => document.getAnimations().forEach((a) => a.play())); };

// ── 2) çevrimdışı tarayıcı
async function offline(ctxOpts, tag, q = '') {
  const { ctx, page } = await open(`${BASE}/?autostart=5v5&map=colgecidi&type=tdm&debug=1&nolock=1&time=900${q}`, ctxOpts, tag);
  const r = await page.evaluate(() => {
    const g = window.__game, me = g.playerSoldier; g.brainsOff = g.brains.splice(0);
    const V = g.soldiers.find((s) => s.team !== me.team && s.alive), M = g.soldiers.find((s) => s.team === me.team && s !== me && s.alive);
    V.protT = 0; V.takeDamage(35, me, 'body', me.pos.clone(), 'test'); V.takeDamage(9999, M, 'body', M.pos.clone(), 'test');
    const pop = document.querySelector('#pops .pop.as');
    return { as: me.assists, sc: me.score, mk: M.kills, pop: pop?.textContent || '', ev: window.__as.length, kfx: document.querySelector('#kfx .nt')?.textContent || '', feed: document.querySelector('#killfeed')?.lastElementChild?.className || '' };
  });
  check(r.as === 1 && r.sc === 50 && r.mk === 1, `${tag}: oyuncu 35 hasar, takım arkadaşı öldürdü → asist ${r.as}, puan ${r.sc}`);
  check(/\+ASİST/.test(r.pop) && /50/.test(r.pop) && r.ev === 1, `${tag}: bildirim "${r.pop}"`);
  check(!r.kfx && !/\bmk\b/.test(r.feed), `${tag}: öldürme kartı / akış vurgusu yok (asist kill feed'e yazılmaz)`);
  check((await page.evaluate(() => window.__asSfx)) === 1, `${tag}: asist sesi çaldı`);
  await freeze(page, `${tag}-asist`);
  // asist + öldürme aynı anda: bildirim (#pops) ve öldürme kartı (#kfx .nt) üst üste binmez
  const ov = await page.evaluate(() => {
    const g = window.__game, me = g.playerSoldier; const en = g.soldiers.filter((s) => s.team !== me.team && s.alive);
    const M = g.soldiers.find((s) => s.team === me.team && s !== me);
    en[0].protT = 0; en[0].takeDamage(30, me, 'body', me.pos.clone(), 'test'); en[0].takeDamage(9999, M, 'body', M.pos.clone(), 'test');
    en[1].protT = 0; en[1].takeDamage(9999, me, 'head', me.pos.clone(), 'M4');
    const a = document.querySelector('#pops').getBoundingClientRect(), b = document.querySelector('#kfx .cd')?.getBoundingClientRect();
    return { a: [a.top, a.bottom], b: b ? [b.top, b.bottom] : null, ok: b ? a.bottom <= b.top + 1 : false };
  });
  check(ov.ok, `${tag}: asist bildirimi öldürme kartıyla çakışmıyor (pops ${ov.a.map(Math.round)}, kart ${ov.b?.map(Math.round)})`);
  await freeze(page, `${tag}-asist-oldurme`);
  // botlar da asist sayar
  const bots = await page.evaluate(() => {
    const g = window.__game, me = g.playerSoldier; const en = g.soldiers.filter((s) => s.team !== me.team && !s.vacant); const mt = g.soldiers.filter((s) => s.team === me.team && s !== me && !s.vacant);
    const V = en.find((s) => s.alive) || (g.respawn(en[0]), en[0]); V.protT = 0;
    V.takeDamage(40, mt[1], 'body', mt[1].pos.clone(), 'test'); V.takeDamage(9999, mt[2], 'body', mt[2].pos.clone(), 'test');
    return mt[1].assists;
  });
  check(bots === 1, `${tag}: bot da asist aldı (${bots})`);
  // skor tablosu K / A / D
  await page.evaluate(() => window.__game.hud.showScoreboard(true));
  const sb = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; const hd = [...document.querySelectorAll('#sbbody .team')[0].querySelectorAll('th')].map((e) => e.textContent); const row = document.querySelector('#sbbody tr.me'); return { hd, row: [...row.querySelectorAll('td')].map((e) => e.textContent), me: [me.kills, me.assists, me.deaths] }; });
  check(sb.hd.join('|') === 'Oyuncu|Öl|Asist|Ölüm|Puan' && +sb.row[1] === sb.me[0] && +sb.row[2] === sb.me[1] && +sb.row[3] === sb.me[2], `${tag}: tablo ${sb.hd.join('/')} · sen ${sb.row.slice(1).join(' / ')}`);
  await page.screenshot({ path: `${OUT}/${tag}-tablo.png` });
  await page.evaluate(() => window.__game.hud.showScoreboard(false));
  // maç sonu: Asist kutusu + yerel profil
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('warbyte.v2') || '{}').stats?.assists || 0);
  await page.evaluate(() => { const g = window.__game; g.timeLeft = 0; g.checkEnd(); });
  await page.waitForTimeout(900);
  const end = await page.evaluate(() => ({ st: [...document.querySelectorAll('#estats .st')].map((e) => e.textContent), as: window.__game.playerSoldier.assists, pr: JSON.parse(localStorage.getItem('warbyte.v2') || '{}').stats }));
  check(end.st.some((s) => s === `${end.as}Asist`), `${tag}: maç sonu ${end.st.join(' · ')}`);
  check(end.pr?.assists === before + end.as, `${tag}: yerel profil assists ${before} → ${end.pr?.assists}`);
  await freeze(page, `${tag}-macsonu`);
  // ana menü istatistik kartı
  if (tag === 'masaustu') {
    await page.goto(`${BASE}/`); await page.waitForSelector('#mnUser small', { timeout: 60000 }); await page.waitForTimeout(600);
    const card = await page.evaluate(() => document.querySelector('#mnUser .mn-ub > small')?.textContent || '');
    check(new RegExp(`${end.pr?.assists} ASİST`).test(card), `${tag}: menü kartı "${card}"`);
    await page.screenshot({ path: `${OUT}/${tag}-menu.png`, clip: { x: 0, y: 0, width: 900, height: 200 } });
  }
  await ctx.close();
}
if (!ONLY || ONLY === 'offline') {
  await offline({ viewport: { width: 1600, height: 900 } }, 'masaustu');
  await offline(strip(devices['Pixel 7 landscape']), 'pixel7', '&touch=1');
}

// ── 3) çevrim içi
if (!ONLY || ONLY === 'online') {
  const rid = Math.random().toString(16).slice(2, 7), NAME = 'As' + rid;
  const reg = await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '10.9.' + (rid.charCodeAt(0) % 200) + '.7' }, body: JSON.stringify({ name: NAME, pass: 'testpass1' }) }).then((r) => r.json());
  check(reg.ok && reg.tok, `hesap: yerel test hesabı ${NAME} kaydı`);
  const prof0 = await fetch(API + '/api/profile', { headers: { authorization: 'Bearer ' + reg.tok } }).then((r) => r.json());
  const V = { viewport: { width: 960, height: 540 } }, LITE = '&pr=0.5&shadows=0';
  const initA = { 'warbyte.acct': JSON.stringify({ kind: 'acct', name: reg.name, tok: reg.tok }), 'warbyte.v2': JSON.stringify({ server: WS, acctName: reg.name, name: reg.name }) };
  const A = await open(`${BASE}/?online=new&type=tdm&per=4&map=depo&debug=1&nolock=1&team=blue${LITE}&server=${encodeURIComponent(WS)}&name=${reg.name}`, V, 'A', initA);
  const room = await A.page.evaluate(() => new URLSearchParams(location.search).get('online'));
  await A.page.evaluate(() => window.__game.online.send({ t: 'dbg', bots: false }));          // botlar hemen donar (B yüklenirken birbirini öldürmesin)
  const B = await open(`${BASE}/?online=${room}&debug=1&nolock=1&team=blue${LITE}&server=${encodeURIComponent(WS)}&name=Veli`, V, 'B');
  const bId = await B.page.evaluate(() => window.__game.playerSoldier.id);
  const ids = await A.page.evaluate((bId) => { const g = window.__game, me = g.playerSoldier; g.online.send({ t: 'dbg', bots: false });
    return { me: me.id, en: g.soldiers.filter((s) => s.team !== me.team && !s.vacant && s.id !== bId).map((s) => s.id), name: me.name }; }, bId);
  console.log(`      oda ${room}: A #${ids.me} (${ids.name}), B #${bId}, düşman botlar ${ids.en.join(',')}`);
  const ask = (P) => P.page.evaluate(() => new Promise((res) => { const g = window.__game, ws = g.online.ws; const f = (e) => { try { const m = JSON.parse(e.data); if (m.t === 'dbg') { ws.removeEventListener('message', f); res(m); } } catch { /* yok */ } }; ws.addEventListener('message', f); g.online.send({ t: 'dbg', ask: 1 }); }));
  const pops = (P) => P.page.evaluate(() => ({ n: window.__game.assistShown || 0, ev: window.__as.length, txt: document.querySelector('#pops .pop.as')?.textContent || '' }));
  // A ve B aynı takımda (mavi): A kırmızı bota hasar verir, B öldürür → asist yalnız A'ya (kişisel olay), B öldürme bildirimini alır
  const aliveEn = () => A.page.evaluate((en) => en.filter((i) => window.__game.soldiers[i].alive), ids.en);
  const [X, Y] = await aliveEn();
  await A.page.evaluate((x) => window.__game.online.send({ t: 'dbg', dmg: [x, 40] }), X);
  await A.page.waitForTimeout(300);
  await B.page.evaluate((x) => window.__game.online.send({ t: 'dbg', dmg: [x, 9999] }), X);
  await A.page.waitForTimeout(900);
  const pa = await pops(A), pb = await pops(B);
  check(pa.n === 1 && pa.ev === 1 && /\+ASİST/.test(pa.txt), `çevrim içi: A'da bildirim "${pa.txt}"`);
  check(pb.n === 0 && pb.ev === 0, `çevrim içi: B'de asist bildirimi yok (${pb.n})`);
  await freeze(A.page, 'online-A-asist');
  // ikinci asist + tablo eşitliği (yavaş alanlar)
  await A.page.evaluate((y) => window.__game.online.send({ t: 'dbg', dmg: [y, 30] }), Y);
  await A.page.waitForTimeout(250);
  await B.page.evaluate((y) => window.__game.online.send({ t: 'dbg', dmg: [y, 9999] }), Y);
  await A.page.waitForTimeout(2600);              // yavaş alanlar (imza değişince) gelir
  const sv = await ask(A);
  const tab = (P) => P.page.evaluate(() => window.__game.soldiers.map((s) => [s.kills, s.assists || 0, s.deaths, s.score]));
  const ta = await tab(A), tb = await tab(B);
  check(sv.kad[ids.me][1] === 2 && ta[ids.me][1] === 2, `çevrim içi: sunucu A asist ${sv.kad[ids.me][1]}, A istemcisi ${ta[ids.me][1]}`);
  check(JSON.stringify(sv.kad) === JSON.stringify(ta) && JSON.stringify(sv.kad) === JSON.stringify(tb), `çevrim içi: K/A/Ö/puan tablosu sunucu = A = B (${sv.kad.filter((r) => r[0] || r[1]).length} dolu satır)`);
  await A.page.evaluate(() => window.__game.hud.showScoreboard(true));
  const sbA = await A.page.evaluate(() => [...document.querySelector('#sbbody tr.me').querySelectorAll('td')].map((e) => e.textContent));
  check(+sbA[2] === 2, `çevrim içi: A tablosu sen ${sbA.slice(1).join(' / ')}`);
  await A.page.screenshot({ path: `${OUT}/online-A-tablo.png` });
  await A.page.evaluate(() => window.__game.hud.showScoreboard(false));
  // maç sonu → hesap profili assists artar
  await A.page.evaluate(() => window.__game.online.send({ t: 'dbg', tk: [9999, 0] }));
  await A.page.waitForFunction(() => window.__game?.hud?.endShown, null, { timeout: 20000 });
  await A.page.waitForTimeout(1500);
  const endA = await A.page.evaluate(() => [...document.querySelectorAll('#estats .st')].map((e) => e.textContent));
  check(endA.includes('2Asist'), `çevrim içi: A maç sonu ${endA.join(' · ')}`);
  await freeze(A.page, 'online-A-macsonu');
  const prof1 = await fetch(API + '/api/profile', { headers: { authorization: 'Bearer ' + reg.tok } }).then((r) => r.json());
  check((prof0.stats?.assists || 0) === 0 && prof1.stats?.assists === 2, `hesap: profil assists ${prof0.stats?.assists ?? '(yok)'} → ${prof1.stats?.assists}`);
  await A.ctx.close(); await B.ctx.close();
}
if (browser) await browser.close();
check(!errs.length, `sayfa hatası yok${errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''}`);
console.log(fail ? `\n${fail} HATA` : '\nTÜMÜ OK');
process.exit(fail ? 1 : 0);
