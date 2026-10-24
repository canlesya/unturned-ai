// Seri sesi + bildirimi testi (12.148). Önce: vite (BASE, vars. :5180) + BF_DEBUG=1 sunucu (WS, vars. ws://127.0.0.1:8787).
//   node scripts/streaktest.mjs        · görüntüler: /tmp/wb-streak/shots/
// 1) Çevrimdışı (tdm, botlar donuk): art arda öldürme → seri sayacı, seri sesi çağrısı (2. öldürmeden itibaren), öldürme onayı sabit (n=1),
//    "SERİ ×2" küçük çağrı / ×3 "SERİ" / ×5 "DURDURULAMAZ" / çift öldürme / ×10 "EFSANE"; takım arkadaşı sayılmaz; ayar kapalıyken ses yok;
//    ölünce sıfırlanır; ses düğümleri sızmaz. Görüntüler masaüstü + Pixel 7.
// 2) Modlar (dm, tdm, conquest, gg, pb, inf): iki öldürme → seri 2 + bir seri sesi; ölüm → sıfır.
// 3) Çevrim içi: iki istemci (A mavi, B kırmızı). A sunucuda bot öldürür (dbg dmg) → A'da seri sayılır + ses; B'de ses yok; çift sayım yok;
//    takım arkadaşı sayılmaz; B, A'yı öldürür → A'nın serisi sıfırlanır, B'nin serisi 1.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:5180', WS = process.env.WS || 'ws://127.0.0.1:8787';
const OUT = process.env.OUT || '/tmp/wb-streak/shots'; fs.mkdirSync(OUT, { recursive: true });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const watch = (page, tag) => { page.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|WebSocket|ERR_CONNECTION/i.test(m.text())) errs.push(`${tag}: ${m.text()}`); }); };

// ses çağrılarını yakala: sfx.kill(hs, n) argümanları + seri sesi (killfx.streakSfxN / lastStreakSfx)
const hook = (page) => page.evaluate(async () => {
  const g = window.__game, s = g.sfx; s.setVolume(0.6); await s.ctx?.resume?.();
  window.__kills = []; const k = s.kill.bind(s); s.kill = (hs, n) => { window.__kills.push(n); return k(hs, n); };
  window.__kfx = 0; const kk = g.killfx.kill.bind(g.killfx); g.killfx.kill = (...a) => { window.__kfx++; return kk(...a); };
});
const state = (page) => page.evaluate(() => { const k = window.__game.killfx, sk = document.querySelector('#kfx .sk'); return { streak: k.streak, multi: k.multi, n: k.streakSfxN, last: k.lastStreakSfx, sk: sk?.textContent || '', cls: sk?.className || '', killN: window.__kills.at(-1), kfx: window.__kfx, live: window.__game.sfx.live }; });
// çevrimdışı öldürme: düşman (mate: takım arkadaşı) seçilir, ölü ise yeniden doğurulur
const killOne = (page, { hs = false, mate = false, multi = false } = {}) => page.evaluate(({ hs, mate, multi }) => {
  const g = window.__game, me = g.playerSoldier, k = g.killfx;
  if (!multi) k.lastKill = -99;                                    // çoklu öldürme penceresi dışı (yalnız seri)
  else k.lastKill = performance.now() / 1000;
  const pool = g.soldiers.filter((s) => s !== me && !s.vacant && (mate ? s.team === me.team : g.ffa || s.team !== me.team));
  let v = pool.find((s) => s.alive);
  if (!v && pool.length) { v = pool[0]; g.respawn(v); }
  if (!v) return null;
  v.protT = 0; v.takeDamage(9999, me, hs ? 'head' : 'body', me.pos.clone(), me.item?.name || 'test');
  return v.name;
}, { hs, mate, multi });
const die = (page) => page.evaluate(() => { const g = window.__game, me = g.playerSoldier; g.devGod = false; me.protT = 0; const e = g.soldiers.find((s) => s !== me && !s.vacant && (g.ffa || s.team !== me.team)) || me; me.takeDamage(9999, e, 'body', e.pos.clone(), 'test'); return me.alive; });
// bildirim ekran görüntüsü: canlandırmalar ortada dondurulur (yazılım GL'de görüntü yavaş)
const shot = async (page, name) => {
  await page.waitForTimeout(350);
  await page.evaluate(() => { const k = window.__game.killfx; clearTimeout(k._clr); document.getAnimations().forEach((a) => { a.pause(); a.currentTime = Math.min(420, a.effect.getTiming().duration * 0.5); }); });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.evaluate(() => { document.getAnimations().forEach((a) => a.finish()); window.__game.killfx.nt.innerHTML = ''; });
};
async function open(url, ctxOpts, tag) {
  const ctx = await browser.newContext({ locale: 'tr-TR', ...ctxOpts }); const page = await ctx.newPage(); watch(page, tag);
  await page.addInitScript(() => { try { localStorage.setItem('warbyte.lang', 'tr'); } catch (e) { /* yok */ } });
  await page.goto(url);
  console.log(`      ${tag}: ${url.replace(BASE, '')}`);
  await page.waitForFunction(() => window.__game?.playerSoldier && window.__game.running && window.__game.sfx?.ctx, null, { timeout: 240000 });
  await page.waitForTimeout(800);
  await page.mouse.click((ctxOpts.viewport?.width || 1280) / 2, (ctxOpts.viewport?.height || 720) / 2);
  await hook(page);
  return { ctx, page };
}

// ── 1) çevrimdışı ayrıntılı (masaüstü + Pixel 7)
async function offline(ctxOpts, tag, q = '') {
  const { ctx, page } = await open(`${BASE}/?autostart=5v5&map=colgecidi&type=tdm&dev=1&debug=1&nolock=1&time=900${q}`, ctxOpts, tag);
  await page.evaluate(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); });
  await killOne(page); let s = await state(page);
  check(s.streak === 1 && s.n === 0 && !s.sk && s.killN === 1, `${tag}: 1. öldürme → seri 1, seri sesi yok, çağrı yok (onay n=${s.killN})`);
  await page.waitForTimeout(400);
  await killOne(page); s = await state(page);
  check(s.streak === 2 && s.n === 1 && s.last?.n === 2 && s.killN === 1, `${tag}: 2. öldürme → seri sesi çaldı (seri ${s.last?.n}), öldürme onayı sabit n=${s.killN}`);
  check(/SERİ/.test(s.sk) && /×2/.test(s.sk) && /\bsm\b/.test(s.cls), `${tag}: küçük çağrı "${s.sk}" (${s.cls})`);
  await shot(page, `${tag}-seri2`);
  await killOne(page); s = await state(page);
  check(s.streak === 3 && s.n === 2 && /SERİ/.test(s.sk) && /×3/.test(s.sk) && !/\bsm\b/.test(s.cls), `${tag}: 3. → "${s.sk}" (dönüm noktası, büyük)`);
  await page.waitForTimeout(300);
  await killOne(page, { mate: true }); s = await state(page);
  check(s.streak === 3 && s.n === 2 && !s.sk, `${tag}: takım arkadaşı öldürme seriye sayılmadı (seri ${s.streak}, ses ${s.n})`);
  await killOne(page); await page.waitForTimeout(300);
  await killOne(page); s = await state(page);
  check(s.streak === 5 && s.n === 4 && /DURDURULAMAZ/.test(s.sk) && /×5/.test(s.sk) && /hot/.test(s.cls), `${tag}: 5. → "${s.sk}" sıcak çağrı, ses ${s.n}`);
  await shot(page, `${tag}-seri5`);
  await killOne(page, { multi: true }); s = await state(page);
  check(s.streak === 6 && s.multi === 2 && s.last?.multi === 2 && /ÇİFT/.test(s.sk), `${tag}: çoklu öldürme (4,5 sn içinde) → "${s.sk}", seri sesi multi=${s.last?.multi}`);
  await shot(page, `${tag}-cift`);
  // Ayarlar → Ses: "Seri sesleri" düğmesi (oyun içi panel) ayarı değiştirir ve tercihe yazar
  if (tag === 'masaustu') {
    const ui = await page.evaluate(async () => { const g = window.__game, saved = []; g.opts.onPref = (o) => saved.push(o); g.hud.$('bSet').click(); await new Promise((r) => setTimeout(r, 100));
      const btn = () => [...document.querySelectorAll('#igs .chip')].find((b) => b.dataset.k === 'streakSound'); const t0 = btn()?.textContent; btn()?.click(); const off = g.settings.streakSound; const t1 = btn()?.textContent; btn()?.click();
      return { t0, t1, off, on: g.settings.streakSound, saved }; });
    await page.evaluate(() => { const g = window.__game; g.hud.$('bSet').click(); [...document.querySelectorAll('#igs .chip')].find((b) => b.dataset.k === 'streakSound')?.scrollIntoView(); });
    await page.waitForTimeout(200); await page.screenshot({ path: `${OUT}/${tag}-ayarlar.png` });
    await page.evaluate(() => window.__game.hud.igs?.close());
    check(/Seri sesleri: Açık/i.test(ui.t0) && /Kapalı/i.test(ui.t1) && ui.off === false && ui.on === true && ui.saved.some((o) => o.streakSound === false), `${tag}: Ayarlar → "${ui.t0}" → "${ui.t1}", tercihe yazıldı`);
  }
  // ayar kapalı → seri sesi yok, öldürme onayı eski davranış (çoklu öldürmede yükselir)
  await page.evaluate(() => { window.__game.settings.streakSound = false; });
  await killOne(page, { multi: true }); s = await state(page);
  check(s.streak === 7 && s.n === 5 && s.killN === 3, `${tag}: Seri sesleri kapalı → ses yok (sayaç ${s.n}), onay n=${s.killN} (eski yükselen)`);
  await page.evaluate(() => { window.__game.settings.streakSound = true; });
  for (let i = 0; i < 2; i++) { await page.waitForTimeout(250); await killOne(page); }
  await page.waitForTimeout(250); await killOne(page, { hs: true }); s = await state(page);
  check(s.streak === 10 && s.last?.n === 10 && /EFSANE/.test(s.sk) && /×10/.test(s.sk), `${tag}: 10. → "${s.sk}" (özel ses kademesi)`);
  await shot(page, `${tag}-seri10`);
  // ölüm → sıfır; sonraki öldürme seri 1, ses yok
  const alive = await die(page); s = await state(page);
  check(!alive && s.streak === 0 && s.multi === 0, `${tag}: oyuncu öldü → seri sıfırlandı`);
  await page.evaluate(() => { const g = window.__game; g.respawn(g.playerSoldier); g.devGod = true; });
  const n0 = s.n; await page.waitForTimeout(300); await killOne(page); s = await state(page);
  check(s.streak === 1 && s.n === n0, `${tag}: doğduktan sonra ilk öldürme seri 1, seri sesi yok`);
  // sızıntı: 3 sn sonra çalan kaynak kalmadı
  await page.waitForTimeout(3000); s = await state(page);
  check(s.live <= 4, `${tag}: ses düğümleri temizlendi (çalan ${s.live})`);
  // aynı karede 3 öldürme (el bombası gibi): sesler sıraya girer, en çok 3 çağrı
  const burst = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier, k = g.killfx, n0 = k.streakSfxN; k.streak = 3; const vs = g.soldiers.filter((s) => s.team !== me.team && !s.vacant); for (const v of vs.slice(0, 3)) { if (!v.alive) g.respawn(v); v.protT = 0; v.takeDamage(9999, me, 'body', me.pos.clone(), 'Bomba'); } return k.streakSfxN - n0; });
  check(burst >= 1 && burst <= 3, `${tag}: aynı anda 3 öldürme → ${burst} seri sesi sıraya girdi (üst üste binmez)`);
  await ctx.close();
}
const ONLY = process.env.ONLY || '';                // ONLY=offline | modes | online: tek bölüm
if (!ONLY || ONLY === 'offline') {
  await offline({ viewport: { width: 1600, height: 900 } }, 'masaustu');
  await offline(strip(devices['Pixel 7 landscape']), 'pixel7', '&touch=1');
}

// ── 2) modlar
for (const type of !ONLY || ONLY === 'modes' ? ['dm', 'tdm', 'conquest', 'gg', 'pb', 'inf'] : []) {
  const map = type === 'pb' ? 'boyakulesi' : 'colgecidi';
  const { ctx, page } = await open(`${BASE}/?autostart=4v4&map=${map}&type=${type}&debug=1&nolock=1&time=600`, { viewport: { width: 1280, height: 720 } }, type);
  await page.evaluate(() => {
    const g = window.__game; g.brainsOff = g.brains.splice(0);
    if (g.mode.infection) {                                         // hazırlık süresini geç, bir botu zombi yap (oyuncu insan)
      g.timeLeft = Math.min(g.timeLeft, g.mode.time - 30);
      const me = g.playerSoldier; if (!g.soldiers.some((s) => s.team !== me.team && s.alive)) { const b = g.soldiers.find((s) => s !== me && !s.vacant && s.alive); g.makeZombie(b, false, 'walker'); }
    }
  });
  await killOne(page); await page.waitForTimeout(300); await killOne(page);
  let s = await state(page);
  check(s.streak === 2 && s.n === 1, `${type}: iki öldürme → seri 2, bir seri sesi (${s.n}) "${s.sk}"`);
  if (type !== 'dm' && type !== 'gg' && type !== 'pb') { await killOne(page, { mate: true }); const s2 = await state(page); check(s2.streak === 2, `${type}: takım arkadaşı sayılmadı`); }
  await die(page); s = await state(page);
  check(s.streak === 0, `${type}: ölünce seri sıfır`);
  await ctx.close();
}

// ── 3) çevrim içi: iki istemci
if (!ONLY || ONLY === 'online') {
  const V = { viewport: { width: 960, height: 540 } }, LITE = '&pr=0.5&shadows=0';           // iki 3B sayfa aynı anda: hafif çizim (yük altında ikinci sayfa yüklenebilsin)
  const A = await open(`${BASE}/?online=new&type=tdm&per=4&map=depo&debug=1&nolock=1&team=blue${LITE}&server=${encodeURIComponent(WS)}&name=Ali`, V, 'A');
  const room = await A.page.evaluate(() => new URLSearchParams(location.search).get('online'));
  const B = await open(`${BASE}/?online=${room}&debug=1&nolock=1&team=red${LITE}&server=${encodeURIComponent(WS)}&name=Veli`, V, 'B');
  const bInfo = await B.page.evaluate(() => ({ me: window.__game.playerSoldier.id, team: window.__game.playerSoldier.team }));
  const ids = await A.page.evaluate((bId) => { const g = window.__game, me = g.playerSoldier; g.online.send({ t: 'dbg', bots: false });
    const en = g.soldiers.filter((s) => s.team !== me.team && !s.vacant && s.id !== bId && s !== me).map((s) => s.id), mt = g.soldiers.filter((s) => s.team === me.team && s !== me && !s.vacant && s.id !== bId).map((s) => s.id);
    return { me: me.id, team: me.team, en, mt }; }, bInfo.me);
  console.log(`      oda ${room}: A #${ids.me} ${ids.team}, B #${bInfo.me} ${bInfo.team}, düşman botlar ${ids.en.join(',')}`);
  const dmg = async (pg, id, hs = 0) => { await pg.evaluate(([id, hs]) => window.__game.online.send({ t: 'dbg', dmg: [id, 9999, hs] }), [id, hs]); await pg.waitForTimeout(900); };
  await A.page.evaluate(() => { window.__game.killfx.lastKill = -99; });
  for (let i = 0; i < 3; i++) { await A.page.evaluate(() => { window.__game.killfx.lastKill = -99; }); await dmg(A.page, ids.en[i], i === 2 ? 1 : 0); }
  let a = await state(A.page), b = await state(B.page);
  check(a.streak === 3 && a.kfx === 3 && a.n === 2, `çevrim içi A: 3 sunucu öldürmesi → seri ${a.streak}, kill() ${a.kfx} kez (çift sayım yok), seri sesi ${a.n}`);
  check(b.streak === 0 && b.n === 0 && b.kfx === 0, `çevrim içi B: başkasının serisinde ses yok (B seri ${b.streak}, ses ${b.n})`);
  await shot(A.page, 'online-A-seri3');
  if (ids.mt.length) { await dmg(A.page, ids.mt[0]); a = await state(A.page); check(a.streak === 3 && a.n === 2, `çevrim içi: takım arkadaşı öldürme sayılmadı (seri ${a.streak})`); }
  await B.page.evaluate(() => { window.__game.killfx.lastKill = -99; });
  await dmg(B.page, ids.me);
  a = await state(A.page); b = await state(B.page);
  check(a.streak === 0, `çevrim içi: B, A'yı öldürdü → A'nın serisi sıfır (${a.streak})`);
  check(b.streak === 1 && b.n === 0 && b.kfx === 1, `çevrim içi: B'nin serisi 1, seri sesi yok (ilk öldürme)`);
  await A.ctx.close(); await B.ctx.close();
}

check(errs.length === 0, 'konsol hatası yok' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
