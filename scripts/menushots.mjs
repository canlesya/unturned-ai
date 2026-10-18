// Ana menü görüntü + denetim turu: her menü ekranı tr VE en dilinde, masaüstü 1600×900 + Pixel 7 yatay (touch=1) + iPhone 14 yatay.
//   node scripts/menushots.mjs [url=http://127.0.0.1:5210] [etiket=after]      → /tmp/wb-menu-shots/<etiket>/<dil>-<cihaz>-<ekran>.png
//   WS=ws://127.0.0.1:8820 (oda listesi / oda kurma için oyun sunucusu) · DEV=desktop,pixel7,iphone14 · LANG=tr,en · GPU=1 (gerçek GPU) · NOGAME=1 (maç başlatma yok)
// Denetimler: en dilinde görünen metinde (metin düğümü + placeholder + title) Türkçe harf yok (ğüşıöçİĞÜŞÖÇ; [data-raw] = kullanıcı verisi hariç),
// ekrandan taşan öğe / sayfa kaydırması yok, dokunmatikte dokunma hedefi ≥ 40 px, oda listesi sunucudan geliyor, menüden hızlı maç her iki dilde başlıyor,
// Ayarlar → Dil seçimi menüyü anında çeviriyor ve kalıcı (yalnız yeni kodda; eski kodda "yok" der).
import { chromium, devices } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5210';
const tag = process.argv[3] || 'after';
const WS = process.env.WS || 'ws://127.0.0.1:8820';
const OUT = `/tmp/wb-menu-shots/${tag}`;
fs.mkdirSync(OUT, { recursive: true });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = {
  desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 },
  pixel7: strip(devices['Pixel 7 landscape']),
  iphone14: strip(devices['iPhone 14 landscape']),
};
const GPU = !!process.env.GPU;
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const report = [];
const check = (ok, msg) => { const l = (ok ? 'OK    ' : 'HATA  ') + msg; console.log(l); report.push(l); if (!ok) fail++; };

// görünen öğeler: küçük dokunma hedefi, ekrandan taşma, Türkçe harfli metin
const AUDIT = () => {
  const vw = innerWidth, vh = innerHeight, small = [], over = [], tr = [];
  const root = document.querySelector('#menu');
  const hiddenUp = (e) => { for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return true; } return false; };
  const vis = (e) => { if (hiddenUp(e)) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const scroller = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (/(auto|scroll)/.test(cs.overflowX + cs.overflowY) && (x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1)) return x; } return null; };
  const name = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '')) + ' "' + (e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"';
  for (const e of root.querySelectorAll('button,input,select,[data-a],a[href]')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect(), sc = scroller(e);
    if (sc) { const sr = sc.getBoundingClientRect(); if (r.bottom < sr.top || r.top > sr.bottom || r.right < sr.left || r.left > sr.right) continue; }
    if (Math.min(r.width, r.height) < 39.5 && e.type !== 'checkbox') small.push(`${name(e)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (!sc && (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 || r.top < -1)) over.push(`${name(e)} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
  }
  const TRC = /[ğüşıöçİĞÜŞÖÇ]/;
  const raw = (e) => !!e.closest('[data-raw]');
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) { const s = n.nodeValue.trim(); if (!s || !TRC.test(s)) continue; const p = n.parentElement; if (!p || raw(p) || p.closest('style,script') || hiddenUp(p)) continue; tr.push(s.slice(0, 50)); }
  for (const e of root.querySelectorAll('[placeholder],[title],input')) { if (raw(e) || hiddenUp(e)) continue; for (const v of [e.getAttribute('placeholder'), e.getAttribute('title'), e.tagName === 'INPUT' && e.type !== 'range' ? e.value : '']) if (v && TRC.test(v)) tr.push('@' + v.slice(0, 50)); }
  const de = document.documentElement;
  return { small, over, tr: [...new Set(tr)], pageScroll: de.scrollWidth > vw + 1 || de.scrollHeight > vh + 1 ? `${de.scrollWidth}x${de.scrollHeight}` : '' };
};

const SCREENS = [['home', 'ana'], ['custom', 'ozel'], ['online', 'cevrimici'], ['ocreate', 'oda-kur'], ['loadout', 'sinif'], ['settings', 'ayarlar'], ['controls', 'kontroller'], ['editor', 'editor']];
for (const lg of (process.env.LANG_LIST || process.env.LANGS || 'tr,en').split(',')) {
  for (const dk of (process.env.DEV || 'desktop,pixel7,iphone14').split(',')) {
    const D = DEVS[dk]; if (!D) continue;
    const mob = dk !== 'desktop', id = `${lg}-${dk}`;
    const ctx = await browser.newContext({ ...D, locale: lg === 'tr' ? 'tr-TR' : 'en-US' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => check(false, `${id}: sayfa hatası ${e.message}`));
    const shot = (n) => page.screenshot({ path: `${OUT}/${id}-${n}.png` });
    const tap = async (sel) => {
      const L = page.locator(sel + ' >> visible=true').first();
      await L.evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {});
      await page.waitForTimeout(120);
      const b = await L.boundingBox(); if (!b) throw new Error('yok: ' + sel);
      if (mob) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(350);
    };
    const audit = async (n) => {
      const a = await page.evaluate(AUDIT);
      if (mob) check(!a.small.length, `${id} ${n}: dokunma hedefleri ≥ 40 px${a.small.length ? ' — küçük: ' + a.small.slice(0, 6).join(' | ') + (a.small.length > 6 ? ` (+${a.small.length - 6})` : '') : ''}`);
      check(!a.over.length && !a.pageScroll, `${id} ${n}: ekrandan taşan öğe yok${a.over.length ? ' — ' + a.over.slice(0, 5).join(' | ') : ''}${a.pageScroll ? ' sayfa ' + a.pageScroll : ''}`);
      if (lg === 'en') check(!a.tr.length, `${id} ${n}: çevrilmemiş Türkçe metin yok${a.tr.length ? ' — ' + a.tr.slice(0, 8).join(' | ') + (a.tr.length > 8 ? ` (+${a.tr.length - 8})` : '') : ''}`);
    };
    const q = mob ? '&touch=1' : '&touch=0';
    await page.goto(base + '/?debug=1&nolock=1' + q);
    await page.evaluate(([lg, ws]) => { localStorage.clear(); localStorage.setItem('warbyte.lang', lg); localStorage.setItem('warbyte.v2', JSON.stringify({ server: ws })); }, [lg, WS]);
    await page.goto(base + '/?debug=1&nolock=1' + q);
    await page.waitForSelector('.mn-nav', { timeout: 60000 }); await page.waitForTimeout(GPU ? 1500 : 2500);
    for (const [k, n] of SCREENS) {
      if (k === 'ocreate') { await tap('.mn-nav[data-v=online]'); await tap('[data-a=oview][data-v=ocreate]'); }
      else await tap(`.mn-nav[data-v=${k}]`);
      await page.waitForTimeout(k === 'loadout' ? 2500 : 700);
      if (k === 'online') {
        const ok = await page.waitForSelector('.rcard', { timeout: 8000 }).then(() => true).catch(() => false);
        check(ok, `${id} çevrimiçi: oda listesi sunucudan yüklendi`);
        await page.waitForTimeout(300);
      }
      await shot(n); await audit(n);
      if (k === 'custom' || k === 'ocreate' || k === 'controls' || k === 'settings') {        // uzun ekranlar: orta + alt
        for (const [f, s] of [[0.5, 'orta'], [1, 'alt']]) {
          await page.evaluate((f) => { const s = document.querySelector('#menu .scroll'); if (s) { s.style.scrollBehavior = 'auto'; s.scrollTop = (s.scrollHeight - s.clientHeight) * f; } }, f);
          await page.waitForTimeout(350); await shot(`${n}-${s}`); await audit(`${n}-${s}`);
        }
      }
    }
    // dil seçimi (yalnız masaüstü, tr turunda): Ayarlar → English → menü anında İngilizce + kalıcı → Türkçe'ye geri
    if (dk === 'desktop' && lg === 'tr') {
      await tap('.mn-nav[data-v=settings]');
      const has = await page.locator('[data-a=lang][data-v=en]').count();
      if (!has) console.log('  (dil seçimi yok — eski kod)');
      else {
        await tap('[data-a=lang][data-v=en]');
        const r = await page.evaluate(() => ({ nav: document.querySelector('.mn-nav[data-v=settings]').textContent, ls: localStorage.getItem('warbyte.lang'), html: document.documentElement.lang }));
        check(/settings/i.test(r.nav) && r.ls === 'en' && r.html === 'en', `dil seçimi canlı: "${r.nav.trim()}" · kayıt ${r.ls} · html lang ${r.html}`);
        await shot('dil-en'); const a = await page.evaluate(AUDIT); check(!a.tr.length, `dil değişince Ayarlar ekranında Türkçe kalmadı${a.tr.length ? ' — ' + a.tr.slice(0, 6).join(' | ') : ''}`);
        await page.reload(); await page.waitForSelector('.mn-nav');
        check(/play|quick/i.test(await page.locator('#mnStage').textContent()), 'yenileyince İngilizce kaldı');
        await tap('.mn-nav[data-v=settings]'); await tap('[data-a=lang][data-v=tr]');
        check(/ayarlar/i.test(await page.locator('.mn-nav[data-v=settings]').textContent()), 'Türkçe\'ye geri döndü');
      }
    }
    // menüden hızlı maç (masaüstü + Pixel 7)
    if (!process.env.NOGAME && dk !== 'iphone14') {
      await tap('.mn-nav[data-v=home]');
      await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('warbyte.v2') || '{}'); Object.assign(p, { map: 'depo', type: 'tdm', perTeam: 3, tod: 'day', weather: 'clear' }); localStorage.setItem('warbyte.v2', JSON.stringify(p)); });
      await page.reload(); await page.waitForSelector('#mnStage .home', { timeout: 30000 }); await page.waitForTimeout(800);
      await shot('ana-depo');
      await tap('[data-a=quick]');
      await page.waitForTimeout(150); await shot('yukleniyor');
      const ok = await page.waitForFunction(() => window.__game && window.__game.playerSoldier && document.getElementById('menu').style.display === 'none', null, { timeout: 90000 }).then(() => true).catch(() => false);
      check(ok, `${id}: menüden hızlı maç başladı`);
      await page.waitForTimeout(800); await shot('mac');
    }
    // çevrimiçi oda kur (masaüstü): menüden odayı oluştur → sunucu odasında oyun
    if (!process.env.NOGAME && dk === 'desktop') {
      await page.goto(base + '/?debug=1&nolock=1' + q); await page.waitForSelector('.mn-nav');
      await tap('.mn-nav[data-v=online]'); await tap('[data-a=oview][data-v=ocreate]');
      await tap('.mdc[data-a=olset][data-k=type][data-v=tdm]'); await tap('.mapc[data-a=olset][data-k=map][data-v=depo]');
      await tap('[data-a=olcreate]');
      const ok = await page.waitForFunction(() => window.__game && window.__game.online && window.__game.playerSoldier, null, { timeout: 60000 }).then(() => true).catch(() => false);
      check(ok, `${id}: menüden çevrimiçi oda kuruldu ve oyuna girildi`);
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(`${OUT}/rapor.txt`, report.join('\n') + '\n');
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
