// Giriş kartı arayüz testi (Playwright): ilk açılışta kart, misafir akışı, kayıt → menü, yenileyince oturum kalır, çıkış → kart, ikinci "cihazda" giriş aynı profil.
//   vite :5241 + PORT=8851 ADMIN_PORT=8852 BF_DATA=/tmp/wb-acc-data BF_ACC_RATE=100 node server/index.js (aynı IP'den çok kayıt / giriş)  →  node scripts/accountui.mjs [url=http://127.0.0.1:5241]
//   WS=ws://127.0.0.1:8851 · DEV=desktop,pixel7,iphone14 · LANGS=tr,en  → ekran görüntüleri /tmp/wb-acc-shots/<dil>-<cihaz>-<adım>.png
// Dokunmatikte tıklama yok, dokunma (touchscreen.tap). Denetim: dokunma hedefi ≥ 40 px, taşma yok, İngilizcede Türkçe harf yok, klavye açıkken (kısa ekran) kart kayar.
import { chromium, devices } from 'playwright';
import fs from 'fs';
import crypto from 'crypto';
const base = process.argv[2] || 'http://127.0.0.1:5241';
const WS = process.env.WS || 'ws://127.0.0.1:8851';
const API = WS.replace(/^ws/, 'http');
const OUT = '/tmp/wb-acc-shots';
fs.mkdirSync(OUT, { recursive: true });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = { desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }, pixel7: strip(devices['Pixel 7 landscape']), iphone14: strip(devices['iPhone 14 landscape']) };
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const rid = () => crypto.randomBytes(2).toString('hex');

const AUDIT = () => {
  const vw = innerWidth, vh = innerHeight, small = [], over = [], tr = [];
  const root = document.querySelector('#mnAuth:not([hidden])') || document.querySelector('#menu');
  const hiddenUp = (e) => { for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || x.hidden) return true; } return false; };
  const vis = (e) => { if (hiddenUp(e)) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const scroller = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (/(auto|scroll)/.test(cs.overflowX + cs.overflowY) && (x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1)) return x; } return null; };
  const name = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '')) + ' "' + (e.textContent || e.value || '').trim().slice(0, 20) + '"';
  for (const e of root.querySelectorAll('button,input,[data-a],[data-u]')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect(), sc = scroller(e);
    if (Math.min(r.width, r.height) < 39.5) small.push(`${name(e)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (!sc && (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 || r.top < -1)) over.push(name(e));
  }
  const TRC = /[ğüşıöçİĞÜŞÖÇ]/;
  const w = document.createTreeWalker(document.querySelector('#menu'), NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) { const s = n.nodeValue.trim(); const p = n.parentElement; if (!s || !TRC.test(s) || !p || p.closest('[data-raw],style,script') || hiddenUp(p)) continue; tr.push(s.slice(0, 40)); }
  for (const e of document.querySelectorAll('#menu [placeholder],#menu [title],#menu [aria-label]')) { if (e.closest('[data-raw]') || hiddenUp(e)) continue; for (const v of [e.getAttribute('placeholder'), e.getAttribute('title'), e.getAttribute('aria-label')]) if (v && TRC.test(v)) tr.push('@' + v.slice(0, 40)); }
  const de = document.documentElement;
  return { small, over, tr: [...new Set(tr)], pageScroll: de.scrollWidth > vw + 1 || de.scrollHeight > vh + 1 };
};

async function device(dk, lg, label) {
  const D = DEVS[dk], mob = dk !== 'desktop';
  const ctx = await browser.newContext({ ...D, locale: lg === 'tr' ? 'tr-TR' : 'en-US' });
  const page = await ctx.newPage();
  const id = `${lg}-${dk}${label ? '-' + label : ''}`;
  page.on('pageerror', (e) => check(false, `${id}: sayfa hatası ${e.message}`));
  const url = base + '/?debug=1&nolock=1' + (mob ? '&touch=1' : '&touch=0');
  await page.goto(url);
  await page.evaluate(([l, ws]) => { localStorage.clear(); localStorage.setItem('warbyte.lang', l); localStorage.setItem('warbyte.v2', JSON.stringify({ server: ws })); }, [lg, WS]);
  await page.goto(url); await page.waitForSelector('.mn-nav');
  await page.waitForTimeout(400);
  const tap = async (sel) => {
    const L = page.locator(sel + ' >> visible=true').first();
    await L.evaluate((e) => e.scrollIntoView({ block: 'nearest' })).catch(() => {});
    const b = await L.boundingBox(); if (!b) throw new Error(`${id}: yok ${sel}`);
    if (mob) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(250);
  };
  const type = async (sel, txt) => { await tap(sel); await page.locator(sel).fill(''); await page.keyboard.type(txt, { delay: 5 }); };
  const shot = (n) => page.screenshot({ path: `${OUT}/${id}-${n}.png` });
  const audit = async (n) => {
    const a = await page.evaluate(AUDIT);
    if (mob) check(!a.small.length, `${id} ${n}: dokunma hedefleri ≥ 40 px${a.small.length ? ' — ' + a.small.slice(0, 5).join(' | ') : ''}`);
    check(!a.over.length && !a.pageScroll, `${id} ${n}: taşma yok${a.over.length ? ' — ' + a.over.slice(0, 4).join(' | ') : ''}${a.pageScroll ? ' (sayfa kayıyor)' : ''}`);
    if (lg === 'en') check(!a.tr.length, `${id} ${n}: Türkçe harf yok${a.tr.length ? ' — ' + a.tr.slice(0, 6).join(' | ') : ''}`);
  };
  const cardOpen = () => page.evaluate(() => !document.querySelector('#mnAuth').hidden);
  const sess = () => page.evaluate(() => JSON.parse(localStorage.getItem('warbyte.acct') || 'null'));
  const prefs = () => page.evaluate(() => JSON.parse(localStorage.getItem('warbyte.v2') || '{}'));
  const shownName = () => page.evaluate(() => { const e = [...document.querySelectorAll('#mnAcctName,#mnName,.mn-acct .pa .tx > span')].find((x) => x.offsetParent); return e ? (e.value ?? e.textContent).trim() : ''; });
  return { ctx, page, id, mob, tap, type, shot, audit, cardOpen, sess, prefs, shownName, url };
}

for (const lg of (process.env.LANGS || 'tr,en').split(',')) {
  for (const dk of (process.env.DEV || 'desktop,pixel7,iphone14').split(',')) {
    const A = await device(dk, lg);
    const { page, id } = A;
    // 1) ilk açılış: kart
    check(await A.cardOpen(), `${id}: ilk açılışta giriş kartı görünüyor`);
    await A.shot('1-kart-misafir'); await A.audit('kart misafir');
    await A.tap('[data-u=tab][data-v=acct]');
    check(await page.locator('#auPass').isVisible(), `${id}: Hesap sekmesinde şifre alanı`);
    await A.shot('2-kart-hesap'); await A.audit('kart hesap');
    // boş şifreyle kayıt → hata metni (seçili dilde)
    await A.type('#auName', 'ab'); await A.tap('[data-u=register]');
    const errTx = await page.locator('.au-msg.err').textContent().catch(() => '');
    check(!!errTx && (lg === 'en' ? /characters/.test(errTx) : /karakter/.test(errTx)), `${id}: geçersiz ad hatası seçili dilde: "${errTx}"`);
    await A.shot('2b-kart-hata');
    // 2) misafir akışı
    await A.tap('[data-u=tab][data-v=guest]');
    const gName = (lg === 'tr' ? 'Çağrı' : 'Guest') + rid();
    await A.type('#auName', gName);
    await A.tap('[data-u=guest]');
    check(!(await A.cardOpen()), `${id}: misafir olarak oyna → kart kapandı`);
    check((await A.sess())?.kind === 'guest' && (await A.shownName()) === gName, `${id}: menüde misafir adı (${await A.shownName()})`);
    await A.shot('3-menu-misafir'); await A.audit('menü misafir');
    // 3) misafirken hesap aç (ad korunur değilse yenisini yaz): kayıt → menü
    await A.tap(A.mob ? '.mn-acct .pa' : '.mn-user .ua');
    check(await A.cardOpen() && (await page.locator('#auName').inputValue()) === gName && await page.locator('#auPass').isVisible(), `${id}: Hesap düğmesi kartı hesap sekmesinde, adla açar`);
    const aName = (lg === 'tr' ? 'Şimşek' : 'Hero') + rid() + dk.slice(0, 2);
    await A.type('#auName', aName); await A.type('#auPass', 'pass1234');
    await A.shot('4-kayit-dolu');
    await A.tap('[data-u=register]');
    await page.waitForFunction(() => document.querySelector('#mnAuth').hidden, null, { timeout: 5000 }).catch(() => {});
    const s1 = await A.sess();
    check(!(await A.cardOpen()) && s1?.kind === 'acct' && s1.name === aName && /^[a-f0-9]{64}$/.test(s1.tok), `${id}: kayıt → menü, oturum hesaplı (${s1?.name})`);
    check((await A.shownName()) === aName, `${id}: menüde hesap adı (${await A.shownName()})`);
    await A.shot('5-menu-hesap'); await A.audit('menü hesap');
    // maç bitti gibi: profil sunucuya (yerel + PUT); ikinci cihaz aynısını görmeli
    await fetch(API + '/api/profile', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s1.tok }, body: JSON.stringify({ xp: 5000, stats: { matches: 7, wins: 3, kills: 40, deaths: 20 } }) });
    // 4) yenile → oturum kalır, kart yok, profil sunucudan
    await page.reload(); await page.waitForSelector('.mn-nav'); await page.waitForTimeout(900);
    const pr = await A.prefs();
    check(!(await A.cardOpen()) && (await A.shownName()) === aName, `${id}: yenileyince hâlâ girişli, kart yok`);
    check(pr.xp === 5000 && pr.stats.matches === 7, `${id}: açılışta profil sunucudan eşitlendi (xp ${pr.xp}, maç ${pr.stats?.matches})`);
    await A.shot('6-yenile');
    // 5) ikinci cihaz: yanlış şifre → hata, doğru şifre → aynı profil
    const B = await device(dk, lg, 'cihaz2');
    check(await B.cardOpen(), `${B.id}: yeni cihazda kart`);
    await B.tap('[data-u=tab][data-v=acct]');
    await B.type('#auName', aName.toLowerCase()); await B.type('#auPass', 'yanlis99');
    await B.tap('[data-u=login]');
    await B.page.waitForSelector('.au-msg.err', { timeout: 5000 }).catch(() => {});
    const e2 = await B.page.locator('.au-msg.err').textContent().catch(() => '');
    check(lg === 'en' ? /Wrong name or password/.test(e2) : /yanlış/.test(e2), `${B.id}: yanlış şifre hatası çevrildi: "${e2}"`);
    await B.shot('7-yanlis-sifre'); await B.audit('yanlış şifre');
    await B.type('#auPass', 'pass1234');
    await B.page.keyboard.press('Enter');                                       // Enter = Giriş yap
    await B.page.waitForFunction(() => document.querySelector('#mnAuth').hidden, null, { timeout: 5000 }).catch(() => {});
    await B.page.waitForTimeout(500);
    const pb = await B.prefs(), sb = await B.sess();
    check(sb?.kind === 'acct' && sb.name === aName && sb.tok !== s1.tok, `${B.id}: küçük harfle giriş → asıl ad ${sb?.name}, ayrı jeton`);
    check(pb.xp === 5000 && pb.stats.matches === 7 && pb.stats.kills === 40, `${B.id}: ikinci cihaz aynı profili aldı (xp ${pb.xp}, maç ${pb.stats?.matches})`);
    const lvTxt = await B.page.evaluate(() => document.querySelector('.mn-lv')?.textContent || '');
    if (!B.mob) check(/7$/.test(lvTxt.trim()), `${B.id}: seviye 7 görünüyor (${lvTxt.trim()})`);
    await B.shot('8-cihaz2-menu');
    // 6) çıkış → kart; eski jeton geçersiz; ilk cihaz açık kalır
    await B.tap(B.mob ? '.mn-acct .pa' : '.mn-user .ua');
    await B.page.waitForTimeout(300);
    check(await B.cardOpen() && !(await B.sess()), `${B.id}: Çıkış → kart geri geldi, oturum silindi`);
    const pAfter = await B.prefs();
    check(!pAfter.xp && !pAfter.acctName, `${B.id}: çıkışta hesabın profili cihazda kalmadı (xp ${pAfter.xp || 0})`);
    await B.shot('9-cikis-kart');
    const meOld = await fetch(API + '/api/me', { headers: { authorization: 'Bearer ' + sb.tok } });
    const meA = await fetch(API + '/api/me', { headers: { authorization: 'Bearer ' + s1.tok } });
    check(meOld.status === 401 && meA.status === 200, `${id}: çıkan cihazın jetonu geçersiz (${meOld.status}), diğer cihaz açık (${meA.status})`);
    // 7) klavye açık (kısa görünür alan): kart kayar, alan görünür kalır, sayfa kaymaz
    if (B.mob) {
      const vp = B.page.viewportSize();
      await B.tap('[data-u=tab][data-v=acct]');
      await B.page.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.45) });
      await B.page.waitForTimeout(300);
      await B.tap('#auPass');
      const k = await B.page.evaluate(() => { const i = document.querySelector('#auPass').getBoundingClientRect(), a = document.querySelector('#mnAuth'); return { top: i.top, bottom: i.bottom, vh: innerHeight, scrollable: a.scrollHeight > a.clientHeight, page: document.documentElement.scrollHeight > innerHeight + 1 }; });
      check(k.top >= 0 && k.bottom <= k.vh + 1 && !k.page, `${B.id}: klavye açıkken (${k.vh} px) şifre alanı görünür, sayfa kaymıyor (kart kayar: ${k.scrollable})`);
      await B.shot('10-klavye');
      await B.page.setViewportSize(vp);
    }
    await B.ctx.close();
    // 8) çıkış (ilk cihaz) → kart; misafir adı geri gelir
    await A.tap(A.mob ? '.mn-acct .pa' : '.mn-user .ua');
    check(await A.cardOpen() && (await page.locator('#auName').inputValue()) === gName, `${id}: çıkışta misafir adı geri geldi (${await page.locator('#auName').inputValue()})`);
    await A.ctx.close();
  }
}
// ?autostart= kartı atlar (oyun doğrudan başlar)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(base + '/?autostart=1v1&map=depo&type=tdm&debug=1&nolock=1');
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 }).catch(() => {});
  const r = await page.evaluate(() => ({ g: !!window.__game, card: !!document.querySelector('#mnAuth:not([hidden])') }));
  check(r.g && !r.card, `?autostart= giriş kartını atlar (oyun: ${r.g}, kart: ${r.card})`);
  await ctx.close();
}
await browser.close();
console.log(fail ? `\n${fail} HATA` : '\nHepsi geçti');
process.exit(fail ? 1 : 0);
