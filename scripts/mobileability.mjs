// Dokunmatik zombi gücü butonu testi: Pixel 7 + iPhone 14 yatay (touch=1), GERÇEK dokunuşla (touchscreen.tap).
//   node scripts/mobileability.mjs [url=http://127.0.0.1:5180] [etiket=now]      → $OUT (/tmp/wb-mo3-shots)/<etiket>/<cihaz>-*.png
//   DEV=pixel7,iphone14 · LANG=tr|en (buton etiketi) · WS=ws://127.0.0.1:8787 (sunucu BF_DEBUG=1) verilirse çevrimiçi adım da çalışır. GPU=1 gerçek GPU.
// Denetimler: insanken güç butonu yok (ekipman / şarjör var); zombiyken buton görünür, HAZIR, silah butonları gizli; dokununca s.abActive > 0
// (çevrimdışı yerelde, çevrimiçinde sunucu uygular: dbg ask), buton "act" (turuncu), süre bitince "cd" + saniye; insana dönünce buton gider.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180';
const tag = process.argv[3] || 'now';
const OUT = `${process.env.OUT || '/tmp/wb-mo3-shots'}/${tag}`;
fs.mkdirSync(OUT, { recursive: true });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = { pixel7: strip(devices['Pixel 7 landscape']), iphone14: strip(devices['iPhone 14 Pro Max landscape']) };
const want = (process.env.DEV || 'pixel7,iphone14').split(','), LANG = process.env.LANG_UI || 'tr';
let fail = 0;
const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const browser = await chromium.launch(process.env.GPU ? { headless: false, args: ['--ignore-gpu-blocklist'] } : { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// buton durumu: görünür mü, sınıf (rdy / act / cd), etiket, halka; diğer butonların görünürlüğü
const BTN = () => {
  const v = (k) => { const b = document.querySelector(`#tc [data-b=${k}]`); return !!b && b.getClientRects().length > 0 && getComputedStyle(b).display !== 'none'; };      // #tc.off da gizler
  const b = document.querySelector('#tc [data-b=abil]'), s = window.__game.playerSoldier;
  const st = b ? ['rdy', 'act', 'cd'].find((c) => b.classList.contains(c)) || '' : '';
  const r = b?.getBoundingClientRect();
  return { abil: v('abil'), st, txt: b?.querySelector('.ol')?.textContent || '', ring: b?.querySelector('.rg circle')?.style.strokeDashoffset, nade: v('nade'), reload: v('reload'), swap: v('swap'), ads: v('ads'),
    zombie: !!s.def.zombie, abT: +s.abT.toFixed(2), abActive: +s.abActive.toFixed(2), w: r ? Math.round(r.width) : 0, hudKey: getComputedStyle(document.getElementById('abk')).display, tc: document.getElementById('tc').className, pause: document.getElementById('pause').style.display, resp: document.getElementById('respawn')?.style.display, alive: s.alive, locked: window.__game.player.locked };
};

for (const dk of want) {
  const D = DEVS[dk]; if (!D) continue;
  const ctx = await browser.newContext({ ...D });
  const page = await ctx.newPage();
  if (process.env.VERBOSE) page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log('      gezinme', f.url()); });
  page.on('pageerror', (e) => check(false, `${dk}: sayfa hatası ${e.message}`));
  const shot = (n) => page.screenshot({ path: `${OUT}/${dk}-${n}.png` });
  const tap = async (sel) => { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('yok: ' + sel); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(250); };
  await page.goto(base + '/?debug=1&touch=1'); await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('warbyte.lang', l); }, LANG);
  const READY = LANG === 'en' ? 'READY' : 'HAZIR';
  const UI = (st) => page.waitForFunction((st) => document.querySelector('#tc [data-b=abil]')?.classList.contains(st) && getComputedStyle(document.querySelector('#tc [data-b=abil]')).display !== 'none', st, { timeout: 30000 }).catch(() => {});   // buton her karede (rAF) güncellenir; yazılımsal GL'de kare seyrek

  // ── çevrimdışı ──
  await page.goto(base + '/?autostart=4v4&map=kasaba&type=inf&shadows=0&debug=1&touch=1&time=600');
  await page.waitForFunction(() => window.__game && document.getElementById('bResume') && document.getElementById('pause').style.display === 'flex', null, { timeout: 90000 });
  await page.waitForTimeout(500);
  await tap('#bResume'); await page.waitForTimeout(800);
  await page.evaluate(() => {                                    // botlar donuk, oyuncu insan, hazırlık süresi bitti
    const g = window.__game, me = g.playerSoldier;
    g.brainsOff = g.brains.splice(0); g.timeLeft = g.mode.time - 30;
    if (me.def.zombie) { g.cure(me); g.player.refreshWeapon?.(); }
    me.hp = me.maxHp; me.protT = 99;
  });
  await page.waitForTimeout(400);
  let b = await page.evaluate(BTN);
  check(!b.zombie && !b.abil && b.nade && b.reload, `${dk}: insanken güç butonu yok, ekipman / şarjör var (${JSON.stringify({ abil: b.abil, nade: b.nade, reload: b.reload })})`);
  await shot('insan');
  await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; g.makeZombie(me, false, 'brute'); me.abT = 0; me.abActive = 0; me.cur = 0; g.player.refreshWeapon?.(); });
  await UI('rdy');
  b = await page.evaluate(BTN);
  check(b.zombie && b.abil && b.st === 'rdy' && b.txt === READY, `${dk}: zombiyken güç butonu görünür, ${READY} (${b.st} "${b.txt}", ${b.w} px)`);
  check(!b.nade && !b.reload && !b.swap && !b.ads, `${dk}: zombiyken nişan / şarjör / silah değiştir / ekipman gizli`);
  check(b.w >= 44, `${dk}: güç butonu dokunma hedefi ≥ 44 px (${b.w})`);
  check(b.hudKey === 'none', `${dk}: telefonda HUD güç göstergesinde tuş etiketi yok`);
  await shot('zombi-hazir');
  await tap('#tc [data-b=abil]'); await UI('act');
  b = await page.evaluate(BTN);
  check(b.abActive > 0 && b.abT > 10 && b.st === 'act', `${dk} çevrimdışı: dokununca güç etkin (abActive ${b.abActive}, abT ${b.abT}, ${b.st} "${b.txt}")`);
  await shot('zombi-etkin');
  await page.evaluate(() => { const s = window.__game.playerSoldier; s.abActive = Math.min(s.abActive, 0.4); });      // etkin süreyi kısalt (yazılımsal GL'de oyun zamanı çok yavaş akar)
  await page.waitForFunction(() => window.__game.playerSoldier.abActive === 0, null, { timeout: 60000 }).catch(() => {});      // oyun süresiyle (yazılımsal GL'de yavaş akar)
  await UI('cd');
  b = await page.evaluate(BTN);
  check(b.abActive === 0 && b.st === 'cd' && /^\d+$/.test(b.txt) && +b.txt === Math.ceil(b.abT), `${dk}: süre bitince bekleme gösteriliyor (${b.st} "${b.txt}", abT ${b.abT}, halka ${b.ring})`);
  await shot('zombi-bekleme');
  await tap('#tc [data-b=abil]');
  const b2 = await page.evaluate(BTN);
  check(b2.abActive === 0 && b2.st === 'cd', `${dk}: beklemedeyken dokunmak gücü açmıyor`);
  // düzenleyici: zombiyken güç butonu seçilip taşınabiliyor
  await page.evaluate(() => window.__game.togglePause()); await page.waitForTimeout(300);
  await tap('#bTouch'); await page.waitForTimeout(300);
  await tap('#tcEd [data-min]');                                  // paneli küçült (butonların üstünü açar)
  await tap('#tc [data-b=abil]');
  const sel = await page.evaluate(() => ({ sel: document.querySelector('#tc [data-b=abil]').classList.contains('sel'), hint: document.querySelector('#tcEd .ep .hint b')?.textContent }));
  check(sel.sel && !!sel.hint, `${dk}: düzenleyicide güç butonu seçildi ("${sel.hint}")`);
  await shot('duzenleyici-zombi');
  await tap('#tcEd [data-act=cancel]'); await page.waitForTimeout(300);
  // insana dönünce buton gider
  await page.evaluate(() => { const g = window.__game; g.cure(g.playerSoldier); g.player.refreshWeapon?.(); });
  if (await page.locator('#bResume').isVisible()) await tap('#bResume').catch(() => {});
  await page.waitForTimeout(500);
  b = await page.evaluate(BTN);
  check(!b.zombie && !b.abil && b.nade, `${dk}: insana dönünce güç butonu gizlendi, ekipman geri geldi`);

  // ── çevrimiçi: dokunuş → 'ab' kenarı → sunucu uygular ──
  if (process.env.WS) {
    await page.goto(base + `/?online=new&type=inf&per=4&map=kasaba&debug=1&touch=1&server=${process.env.WS}&name=Tel`);
    await page.waitForFunction(() => window.__game && window.__game.running && window.__game.online, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => document.getElementById('pause').style.display === 'flex', null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    if (await page.locator('#bResume').isVisible()) await tap('#bResume').catch(() => {});
    await page.waitForFunction(() => document.getElementById('tc').className !== 'off', null, { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => window.__game?.online?.ws?.readyState === 1 && window.__game.playerSoldier, null, { timeout: 30000 });      // oda kurulunca oyun yeniden kurulabilir (welcome)
    await page.evaluate(() => { const g = window.__game; g.online.send({ t: 'dbg', bots: false }); g.online.send({ t: 'dbg', hp: 9999 }); window.__dbg = []; g.online.ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.t === 'dbg') window.__dbg.push(m); }); });
    await page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 20000 });
    const ask = async () => { await page.evaluate(() => { window.__dbg.length = 0; window.__game.online.send({ t: 'dbg', ask: 1 }); }); await page.waitForFunction(() => window.__dbg.length, null, { timeout: 4000 }).catch(() => {}); return page.evaluate(() => window.__dbg.pop() || null); };
    await page.evaluate(() => window.__game.online.send({ t: 'dbg', zb: 'brute' }));
    await page.waitForFunction(() => window.__game.playerSoldier.def.zombie, null, { timeout: 8000 }).catch(() => {});
    await UI('rdy');
    b = await page.evaluate(BTN);
    const s0 = await ask();
    check(b.zombie && s0 && s0.zb && b.abil && b.st === 'rdy', `${dk} çevrimiçi: zombi oldum (sunucu ${s0 && s0.zb}), buton ${b.abil ? 'görünür' : 'YOK'} ${b.st} "${b.txt}"${b.st === 'rdy' ? '' : ' ' + JSON.stringify(b)}`);
    await shot('cevrimici-hazir');
    await tap('#tc [data-b=abil]');
    await page.waitForFunction(() => window.__game.playerSoldier.abActive > 0, null, { timeout: 8000 }).catch(() => {}); await UI('act');
    b = await page.evaluate(BTN); const sv = await ask();
    check(sv && sv.ab[1] > 0 && sv.ab[0] > 10, `${dk} çevrimiçi: sunucuda güç etkin (bekleme ${sv && sv.ab[0]}, etkin ${sv && sv.ab[1]})`);
    check(b.abActive > 0 && b.st === 'act', `${dk} çevrimiçi: istemcide s.abActive ${b.abActive} (sunucudan), buton ${b.st} "${b.txt}"`);
    await shot('cevrimici-etkin');
  }
  await ctx.close();
}
await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
