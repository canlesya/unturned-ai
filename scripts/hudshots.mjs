// Oyun içi ekran görüntüleri + denetim: HUD (conquest / tdm / dm / gg / inf / pb), duraklat, ayarlar, kontroller, skor tablosu, ölüm ekranı; tr ve en; masaüstü 1600×900 + Pixel 7 yatay (touch=1).
//   node scripts/hudshots.mjs [url=http://127.0.0.1:5211] [etiket=after]   → /tmp/wb-hud-shots/<etiket>/<cihaz>-<dil>-<ekran>.png
//   DEV=desktop,pixel7 · LANG=tr,en · MODES=conquest,tdm,dm,gg,inf,pb ile süzülür; GPU=1 gerçek GPU (headless değil).
// Denetimler: en modunda HUD / duraklat / ölüm / skor metninde Türkçe harf yok (asker, bayrak, bölge adları hariç); görünen öğe ekrandan taşmıyor; metin kutusundan taşmıyor; sayfa hatası yok.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.argv[2] || 'http://127.0.0.1:5211', TAG = process.argv[3] || 'after', OUT = `/tmp/wb-hud-shots/${TAG}`;
fs.mkdirSync(OUT, { recursive: true });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = { desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }, pixel7: strip(devices['Pixel 7 landscape']) };
const want = (process.env.DEV || 'desktop,pixel7').split(','), langs = (process.env.LANG_LIST || process.env.LANGS || 'tr,en').split(',');
const MODES = (process.env.MODES || 'conquest,tdm,dm,gg,inf,pb').split(',');
const MAP = { conquest: 'kasaba', tdm: 'colgecidi', dm: 'depo', gg: 'liman', inf: 'newyork', pb: 'boyakulesi' };
const SIZE = { conquest: '4v4', tdm: '4v4', dm: '5v5', gg: '5v5', inf: '4v4', pb: '5v5' };
let fail = 0;
const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const GPU = !!process.env.GPU;
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// görünen metin (Türkçe harf denetimi için özel adlar çıkarılır) + taşma denetimi
const AUDIT = (sel) => {
  const g = window.__game, vw = innerWidth, vh = innerHeight, root = document.querySelector(sel);
  if (!root) return { text: '', over: [], clip: [] };
  const vis = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const inScroll = (e) => { for (let x = e.parentElement; x && x !== root.parentElement; x = x.parentElement) { const cs = getComputedStyle(x); if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) return true; } return false; };
  const over = [], clip = [];
  let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) { const e = n.parentElement; if (e && vis(e) && !e.closest('#killfeed,#chat,#pops,#estats,#bTouch,[data-k=lang]')) text += ' ' + n.textContent; }
  for (const e of root.querySelectorAll('*')) {
    if (!vis(e) || e.tagName === 'CANVAS' || e.closest('#scope,#arrows,#cross,#hitm,#vig,#advig,#tc')) continue;
    const r = e.getBoundingClientRect();
    if (!inScroll(e) && (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 || r.top < -1) && r.width < vw * 1.2) over.push(`${e.id || e.className || e.tagName} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
    const cs = getComputedStyle(e);
    if (e.children.length === 0 && e.textContent.trim() && cs.overflow === 'hidden' && cs.textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 2) clip.push(`${e.id || e.className} "${e.textContent.trim().slice(0, 30)}"`);
  }
  const names = [...(g?.soldiers || []).map((s) => s.name)].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const nm of names) text = text.split(nm).join(' ');
  return { text: text.replace(/\s+/g, ' ').trim(), over, clip };
};
const TR = /[çğıöşüÇĞİÖŞÜ]/;

for (const dk of want) for (const lang of langs) {
  const D = DEVS[dk]; if (!D) continue;
  const mob = dk !== 'desktop';
  const ctx = await browser.newContext({ ...D });
  await ctx.addInitScript((l) => { try { localStorage.setItem('warbyte.lang', l); } catch { /* yok */ } }, lang);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const pre = `${dk}-${lang}`;
  const shot = (n) => page.screenshot({ path: `${OUT}/${pre}-${n}.png` });
  const audit = async (n, sel) => {
    const a = await page.evaluate(AUDIT, sel);
    check(!a.over.length, `${pre} ${n}: ekrandan taşan öğe yok${a.over.length ? ' → ' + a.over.slice(0, 5).join(' · ') : ''}`);
    check(!a.clip.length, `${pre} ${n}: kesilen metin yok${a.clip.length ? ' → ' + a.clip.slice(0, 5).join(' · ') : ''}`);
    if (lang === 'en') { const m = a.text.match(new RegExp('\\S*' + TR.source + '\\S*', 'g')); check(!m, `${pre} ${n}: İngilizcede Türkçe harf yok${m ? ' → ' + [...new Set(m)].slice(0, 8).join(' ') : ''}`); }
  };
  for (const mode of MODES) {
    const url = `${BASE}/?autostart=${SIZE[mode]}&map=${MAP[mode]}&type=${mode}&debug=1&touch=${mob ? 1 : 0}&time=600`;
    await page.goto(url);
    await page.waitForFunction(() => window.__game && window.__game.running && window.__game.playerSoldier && document.getElementById('pause')?.style.display === 'flex', null, { timeout: 120000 });
    await page.waitForTimeout(500);
    if (mode === 'tdm') { await shot('intro'); await audit('intro', '#pause'); }
    await page.evaluate(() => { const g = window.__game; g.noPointerLock = true; g.requestLock(); });
    await page.waitForTimeout(3500);
    // olay: birkaç öldürme bildirimi + toast; enfekte / gg özel ekranları için durum
    await page.evaluate(async (mode) => {
      const { t } = await import('/src/i18n/index.js');
      const g = window.__game, me = g.playerSoldier, foe = g.soldiers.find((s) => s !== me && (g.ffa || s.team !== me.team)) || g.soldiers[1];
      me.protT = 99;
      g.hud.killFeed(me, foe, me.stat.name, true); g.hud.killFeed(foe, me, 'M4A1', false); g.hud.killFeed(foe, foe, 'İntihar', false);
      g.hud.toast(mode === 'conquest' ? t('hud.bleedWin') : t('hud.t.optic', { o: 'Red Dot' }), '#9fe6a8');
    }, mode);
    await page.waitForTimeout(400);
    await shot(`hud-${mode}`); await audit(`hud-${mode}`, '#hud');
    // skor tablosu
    await page.evaluate(() => window.__game.hud.showScoreboard(true)); await page.waitForTimeout(300);
    await shot(`skor-${mode}`); await audit(`skor-${mode}`, '#scoreboard');
    await page.evaluate(() => window.__game.hud.showScoreboard(false));
    if (mode === 'tdm') {
      await page.evaluate(() => { window.__game.hud.zoneWarn(4.2); }); await page.waitForTimeout(80); await shot('zone'); await audit('zone', '#zonew');
      await page.evaluate(() => window.__game.togglePause()); await page.waitForTimeout(400); await shot('duraklat'); await audit('duraklat', '#pause');
      await page.click('#bSet'); await page.waitForTimeout(300); await shot('ayarlar'); await audit('ayarlar', '#igs');
      await page.click('#igs .tab[data-tab=controls]'); await page.waitForTimeout(300); await shot('kontroller'); await audit('kontroller', '#igs');
      await page.click('#igs .x'); await page.evaluate(() => { const g = window.__game; g.requestLock(); }); await page.waitForTimeout(300);
    }
    // ölüm: bot kafadan vurur (gg / pb / dm / tdm / inf)
    await page.evaluate(() => {
      const g = window.__game, me = g.playerSoldier, foe = g.soldiers.find((s) => s !== me && s.alive && (g.ffa || s.team !== me.team));
      if (g.mode.infection) g.timeLeft = Math.min(g.timeLeft, g.mode.time - 60);   // hazırlık bitsin (oyuncu zombi / boss olabilir)
      me.protT = 0; foe.pos.set(me.pos.x + 18, me.pos.y, me.pos.z + 9);
      me.takeDamage(9999, foe, 'head', foe.pos, foe.stat.name);
    });
    await page.waitForTimeout(1500);
    const shown = await page.evaluate(() => getComputedStyle(document.getElementById('respawn')).display !== 'none');
    check(shown, `${pre} ${mode}: ölüm ekranı görünüyor`);
    await shot(`olum-${mode}`); await audit(`olum-${mode}`, '#respawn');
    if (mode === 'tdm' && lang === 'tr') {                              // canlı dil değişimi: ölüm ekranı + HUD yeniden yazılır
      const ok = await page.evaluate(async () => { const m = await import('/src/i18n/index.js'); m.setLang('en'); await new Promise((r) => setTimeout(r, 400)); const txt = document.getElementById('respawn').innerText + ' ' + document.getElementById('topbar').innerText; m.setLang('tr'); return txt; });
      check(!/Öldürüldün|Sınıf seç|MAVİ/.test(ok), `${pre}: canlı dil değişiminde ölüm ekranı / üst çubuk İngilizceye döndü`);
    }
  }
  check(!errs.length, `${pre}: sayfa hatası yok${errs.length ? ' → ' + errs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
console.log(fail ? `\n${fail} HATA` : '\nTÜMÜ GEÇTİ', '→', OUT);
process.exit(fail ? 1 : 0);
