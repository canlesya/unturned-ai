// 12.147 Esc → menü → Esc → oyun. node scripts/esctest.mjs (vite + sunucu açık; BASE / WSURL ortam değişkenleri)
// 1) Gerçek fare kilidi (Chromium headless:false; pencere odakta olmalı). Playwright'ın Esc'si tarayıcının kilit bırakma
//    işleyicisinden geçmez, kilit varken sayfaya gelir = tam ekran + Keyboard Lock durumunun aynısı.
//    Kullanıcının Esc'si (pencere modu) document.exitPointerLock ile taklit edilir (oyun bunu "kullanıcı bıraktı" sayar).
// 2) ?nolock=1 durum geçişleri, giriş ekranı, sohbet (çevrimiçi), maç sonu (headless).
// HEADED=0 → yalnız 2. bölüm.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:5180', WS = process.env.WSURL || 'ws://127.0.0.1:8787';
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK    ' : 'HATA  ') + m); if (!c) fail++; };
const W = (p, ms) => p.waitForTimeout(ms);
const st = (p) => p.evaluate(() => {
  const g = window.__game, h = g.hud;
  return { lock: document.pointerLockElement === g.canvas, pause: h.pausedShown, resume: h.resumeShown, igs: !!h.igs?.open, cap: !!h.igs?.cap, sim: g.simulate, by: g._unlockBy, fails: g.lockFails || 0, chat: !!g.chatOpen, foc: document.hasFocus(),
    toasts: [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent).join(' | ') };
});
const start = async (browser, q) => {
  const p = await browser.newPage({ viewport: { width: 1100, height: 620 } }); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(`${BASE}/?${q}`); await p.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 }); await W(p, 1200); return p;
};

if (process.env.HEADED !== '0') {
  console.log('── 1) gerçek fare kilidi (headless:false)');
  const browser = await chromium.launch({ headless: false, args: ARGS });
  const p = await start(browser, 'autostart=3v3&map=colgecidi&type=tdm&debug=1');
  await p.evaluate(() => { window.__game.settings.fullscreen = false; });                 // pencere modu (tam ekran isteği test penceresini büyütmesin)
  await p.evaluate(() => { window.__rej = []; const r = HTMLCanvasElement.prototype.requestPointerLock; HTMLCanvasElement.prototype.requestPointerLock = function (x) { const pr = r.call(this, x); pr?.catch?.((e) => window.__rej.push(e.name)); return pr; }; });
  const esc = async () => { await p.bringToFront(); await p.keyboard.press('Escape'); };          // kullanıcı başka pencereye geçerse kilit WrongDocumentError ile düşer
  let s;
  for (let i = 0; i < 4; i++) { await p.bringToFront(); await p.click('#bResume'); await W(p, 700); s = await st(p); if (s.lock) break; await W(p, 1500); }
  if (!s.lock) { console.log('ATLA  kilit alınamadı (pencere odakta değil?) — 1. bölüm geçildi'); }
  else {
    ok(!s.pause && s.sim, 'Başla → kilitli, oyun akıyor');
    await p.evaluate(() => { window.__game.time = Math.max(5, window.__game.time); });     // yavaş swiftshader: giriş kapağı değil, duraklatma menüsü görünsün
    await esc(); await W(p, 300); s = await st(p);
    ok(!s.lock && s.pause && !s.resume && !s.sim && s.by === 'game', `Esc (kilitliyken sayfaya geldi) → kilit bırakıldı, menü açık ${JSON.stringify(s)}`);
    await p.screenshot({ path: 'screenshots/esc-1-menu.png' });
    await esc(); await W(p, 300); s = await st(p);
    ok(s.lock && !s.pause && !s.resume && s.sim, `menüde Esc → hemen oyuna döndü (soğuma yok) ${JSON.stringify(s)}`);
    await p.screenshot({ path: 'screenshots/esc-2-oyun.png' });
    // Ayarlar alt sayfası: Esc önce alt sayfayı kapatır
    await esc(); await W(p, 300);
    await p.click('#bSet'); await W(p, 200);
    ok((await st(p)).igs, 'Ayarlar açıldı');
    await esc(); await W(p, 200); s = await st(p);
    ok(!s.igs && s.pause && !s.lock, 'Ayarlar\'da Esc → ana Esc menüsüne döndü (oyuna değil)');
    await esc(); await W(p, 300); s = await st(p);
    ok(s.lock && !s.pause, 'ana menüde Esc → oyun');
    // Kontroller + tuş atama dinleme modu
    await esc(); await W(p, 300);
    await p.click('#bCtl'); await W(p, 200);
    await p.click('#igs [data-bind=reload][data-slot="0"]'); await W(p, 100);
    ok((await st(p)).cap, 'tuş atama dinlemede');
    await esc(); await W(p, 200); s = await st(p);
    ok(!s.cap && s.igs && !s.lock, 'dinlemede Esc → yalnız atama iptal, Kontroller açık');
    ok(await p.evaluate(() => window.__game.binds.codes('reload')[0] === 'KeyR'), 'atama değişmedi (R)');
    await esc(); await W(p, 200); s = await st(p);
    ok(!s.igs && s.pause, 'Kontroller\'de Esc → ana menü');
    await esc(); await W(p, 300); s = await st(p);
    ok(s.lock && !s.pause, 'ana menüde Esc → oyun');
    // Pencere modu: kullanıcı Esc'si (tarayıcı kilidi kendisi bırakır) → menü; hemen Esc (soğuma ~1,35 sn) → katman + sessiz yeniden deneme
    await p.evaluate(() => document.exitPointerLock()); await W(p, 150); s = await st(p);
    ok(!s.lock && s.pause && s.by === 'user', 'kullanıcı kilidi bıraktı → menü');
    await p.evaluate(() => window.__game.requestLock()); await W(p, 300);                  // tekrar kilitle (tık yerine; oyunun bıraktığı değil, soğuma testine hazırlık)
    // kilit düşüşü + Esc aynı anda (sayfa değerlendirmesi yavaş; soğuma içinde kalsın diye tek evaluate'te)
    s = await p.evaluate(() => new Promise((res) => {
      document.addEventListener('pointerlockchange', () => setTimeout(() => {
        const g = window.__game; document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
        res({ dt: Math.round(performance.now() - g._unlockAt), lock: !!document.pointerLockElement, pause: g.hud.pausedShown, resume: g.hud.resumeShown, timer: !!g._lockT });
      }, 100), { once: true });
      document.exitPointerLock();
    }));
    ok(!s.lock && !s.pause && s.resume, `soğumada (${s.dt} ms) Esc → menü kapandı, "tıkla devam" katmanı ${JSON.stringify(s)}`);
    await W(p, 1600); s = await st(p);
    ok(s.lock && !s.resume && !s.pause && s.fails === 0 && !/kilitlenemedi/i.test(s.toasts), `soğuma bitince sessizce yeniden denendi → oyun ${JSON.stringify(s)}`);
    // Tarayıcı reddederse (Esc kullanıcı jesti sayılmaz): katman kalır, hata sayılmaz, tek tık devam ettirir
    await p.evaluate(() => document.exitPointerLock()); await W(p, 1500);
    await p.evaluate(() => {
      const o = HTMLCanvasElement.prototype.requestPointerLock; window.__rpl = o;
      HTMLCanvasElement.prototype.requestPointerLock = function () { setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')), 5); return Promise.reject(new DOMException('reddedildi', 'NotAllowedError')); };
    });
    await esc(); await W(p, 500); s = await st(p);
    ok(!s.lock && s.resume && !s.pause && s.fails === 0 && !/kilitlenemedi/i.test(s.toasts), `reddedildi → katman açık, hata / uyarı yok ${JSON.stringify(s)}`);
    await p.screenshot({ path: 'screenshots/esc-3-tikla-devam.png' });
    await esc(); await W(p, 200); s = await st(p);
    ok(s.pause && !s.resume, 'katmanda Esc → menüye geri');
    await esc(); await W(p, 300);
    await p.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = window.__rpl; });
    ok((await st(p)).resume, 'Esc → katman yine açık');
    for (let i = 0; i < 3; i++) { await p.bringToFront(); await p.mouse.click(300, 200); await W(p, 500); s = await st(p); if (s.lock) break; await W(p, 1400); }     // WrongDocumentError = pencere odakta değil
    ok(s.lock && !s.resume && !s.pause && s.sim, `katmana tek tık → kilit, oyun sürüyor, menü açılmadı ${JSON.stringify(s)}`);
    await p.screenshot({ path: 'screenshots/esc-4-tikla-sonra.png' });
    // Maç sonu: Esc bir şey tetiklemesin
    await esc(); await W(p, 300);
    await p.evaluate(() => { const g = window.__game; g.ended = true; g.hud.showEnd(true, 'TEST', 'maç sonu', ''); });
    await esc(); await W(p, 200); await esc(); await W(p, 300); s = await st(p);
    ok(!s.lock && !s.pause && !s.resume && await p.isVisible('#endscreen'), 'maç sonu ekranında Esc etkisiz');
    ok(p.errs.length === 0, 'sayfa hatası yok ' + p.errs.slice(0, 2));
    console.log('      kilit retleri:', JSON.stringify(await p.evaluate(() => window.__rej)));
  }
  await p.evaluate(() => document.exitPointerLock()).catch(() => {});
  await browser.close();
}

console.log('── 2) ?nolock=1, giriş ekranı, sohbet (headless)');
const browser = await chromium.launch({ args: ARGS });
{
  const p = await start(browser, 'autostart=3v3&map=colgecidi&type=tdm&debug=1&nolock=1');
  await p.evaluate(() => { window.__game.time = 5; });
  let s = await st(p); ok(!s.pause && s.sim, 'nolock: oyunda');
  await p.keyboard.press('Escape'); await W(p, 150); s = await st(p);
  ok(s.pause && !s.sim, 'nolock: Esc → menü, duraklatıldı');
  await p.keyboard.press('Escape'); await W(p, 150); s = await st(p);
  ok(!s.pause && !s.resume && s.sim, 'nolock: Esc → oyun');
  await p.keyboard.press('Escape'); await W(p, 150); await p.click('#bSet'); await W(p, 150);
  await p.keyboard.press('Escape'); await W(p, 150); s = await st(p);
  ok(!s.igs && s.pause, 'nolock: Ayarlar → Esc → menü');
  await p.keyboard.press('Escape'); await W(p, 150); s = await st(p);
  ok(!s.pause && s.sim, 'nolock: menü → Esc → oyun');
  await p.evaluate(() => { const g = window.__game; g.ended = true; g.hud.showEnd(true, 'TEST', '', ''); });
  await p.keyboard.press('Escape'); await W(p, 150); s = await st(p);
  ok(!s.pause && !s.resume, 'nolock: maç sonunda Esc etkisiz');
  ok(p.errs.length === 0, 'sayfa hatası yok ' + p.errs.slice(0, 2));
  await p.close();
}
{
  const p = await start(browser, 'autostart=3v3&map=colgecidi&type=tdm&debug=1');
  await p.keyboard.press('Escape'); await W(p, 150); const s = await st(p);
  ok(s.pause && !s.resume, 'giriş ekranında ("Hazır mısın?") Esc etkisiz');
  await p.close();
}
{
  const p = await start(browser, `online=new&type=tdm&per=3&map=kasaba&debug=1&nolock=1&server=${WS}&name=Ali&team=blue`);
  await p.evaluate(() => { window.__game.time = Math.max(5, window.__game.time); });
  await p.keyboard.press('Enter'); await W(p, 250);
  ok((await st(p)).chat, 'çevrimiçi: sohbet açıldı');
  await p.keyboard.press('Escape'); await W(p, 200); let s = await st(p);
  ok(!s.chat && !s.pause && !s.resume && s.sim, 'sohbette Esc → yalnız sohbet kapandı, menü açılmadı');
  await p.keyboard.press('Escape'); await W(p, 200); s = await st(p);
  ok(s.pause && !s.sim, 'çevrimiçi: Esc → menü');
  await p.keyboard.press('Escape'); await W(p, 200); s = await st(p);
  ok(!s.pause && s.sim, 'çevrimiçi: Esc → oyun');
  ok(p.errs.length === 0, 'sayfa hatası yok ' + p.errs.slice(0, 2));
  await p.close();
}
{
  // pencere modunda sohbetteki Esc kilidi de düşürür: menü değil "tıkla devam" (kilit taklidi: pointerLockElement)
  const p = await start(browser, `online=new&type=tdm&per=3&map=kasaba&debug=1&server=${WS}&name=Veli&team=blue`);
  await p.evaluate(() => { const g = window.__game; g.time = Math.max(5, g.time); window.__pl = g.canvas; Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => window.__pl }); document.dispatchEvent(new Event('pointerlockchange')); });
  await p.keyboard.press('Enter'); await W(p, 250);
  ok((await st(p)).chat, 'kilitliyken sohbet açıldı');
  await p.evaluate(() => { window.__pl = null; document.dispatchEvent(new Event('pointerlockchange')); });
  await W(p, 200); const s = await st(p);
  ok(!s.chat && !s.pause && s.resume, 'sohbetteyken kilit düştü → sohbet kapandı, menü yerine "tıkla devam"');
  await p.screenshot({ path: 'screenshots/esc-5-sohbet-sonrasi.png' });
  await p.close();
}
await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
