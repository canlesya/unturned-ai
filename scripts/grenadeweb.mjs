// El bombası tarayıcı testi (12.144): gerçek oyun, gerçek çizim.
//  A) çevrimdışı: önizleme yayı + iniş halkası + pişirme göstergesi ekran görüntüsü, önizlenen patlama yeri = gerçek patlama (Game.explode yakalanır),
//     alttan atış önizlemesi, uçuş + patlama kareleri.  OLD=1: eski sürüm (önizleme yok) için yalnız uçuş / patlama kareleri (önce görüntüleri).
//  B) çevrim içi (iki istemci, BF_DEBUG=1 yerel sunucu): atan kendi bombasını gecikmesiz görür (tahmin), gören sunucu olayıyla görür (gecikme ölçülür),
//     iki ekranda da tek patlama, sunucu patlama yeri = atanın önizlemesi, gören bomba ile ölür, öldürme akışında bomba simgesi.
//   node scripts/grenadeweb.mjs <taban url> [ws url]  (OUT=/tmp/wb-nade · GPU=0 → swiftshader · ONLY=A|B · TAG=after|before)
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.argv[2] || 'http://127.0.0.1:5180', WS = process.argv[3] || 'ws://127.0.0.1:8787';
const OUT = process.env.OUT || '/tmp/wb-nade', TAG = process.env.TAG || (process.env.OLD ? 'before' : 'after'), OLD = !!process.env.OLD, GPU = process.env.GPU !== '0';
mkdirSync(OUT, { recursive: true });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
const wait = (p, ms) => p.waitForTimeout(ms);

// sayfaya yardımcılar: düz açık şerit bulma, oyuncuyu yerleştirme, olay sayaçları
const HELPERS = () => {
  const g = window.__game, V = g.camera.position.constructor;
  window.__lane = (len = 40, seed = 7) => {                                          // tohumlu: önce / sonra aynı yer
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 30000; k++) {
      const x = -100 + rnd() * 200, z = -100 + rnd() * 200, yaw = rnd() * Math.PI * 2;
      const dx = -Math.sin(yaw), dz = -Math.cos(yaw), h0 = g.world.heightAt(x, z);
      if (!g.nav.isFree(x, z)) continue;
      const bz = g.map.baseZones, inBase = (px, pz) => bz && Object.values(bz).some((b) => px > b.minX - 4 && px < b.maxX + 4 && pz > b.minZ - 4 && pz < b.maxZ + 4);
      if (inBase(x, z) || inBase(x + dx * len, z + dz * len)) continue;                // üs bölgesi: can kaybı uyarısı görüntüyü kapatır
      let ok = true;
      for (let d = 0; d <= len && ok; d += 0.5) if (Math.abs(g.world.heightAt(x + dx * d, z + dz * d) - h0) > 0.04) ok = false;
      for (const hy of [0.12, 0.6, 1.6, 4, 10]) if (ok && g.world.raycast(new V(x, h0 + hy, z), new V(dx, 0, dz), len, {})) ok = false;
      if (ok) return { x, z, yaw, h0, dx, dz };
    }
    return null;
  };
  const S = (window.__S = { boom: [], expl: 0, grT: [], hm: 0 });
  const ex = g.explode.bind(g);
  g.explode = (pos, ...r) => { S.boom.push([pos.x, pos.y, pos.z, performance.now()]); return ex(pos, ...r); };
  const fx = g.effects.explosion.bind(g.effects);
  g.effects.explosion = (...a) => { S.expl++; return fx(...a); };
  g.on('hitmark', () => S.hm++);
  const sp = g.spawnGrenade.bind(g);
  g.spawnGrenade = (...a) => { const r = sp(...a); if (r || g.projectiles.some((p) => p.type === 'grenade')) S.grT.push(Date.now()); return r; };
};

// ── A) çevrimdışı ──
if (!process.env.ONLY || process.env.ONLY === 'A') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errs.push('A: ' + e.message));
  await page.goto(`${BASE}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0&tod=day&weather=clear`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  await page.evaluate(HELPERS);
  const L = await page.evaluate(() => {
    const g = window.__game, p = g.player, s = p.s;
    g.brains.forEach((b) => (b.update = () => {}));
    g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; o.alive = false; o.respawnT = 1e9; });
    const L = window.__lane(42);
    s.pos.set(L.x, L.h0, L.z); s.vel.set(0, 0, 0); s.yaw = L.yaw; s.pitch = 0.26; s.protT = 0; g.devGod = true;
    s.items[2] = { id: 'grenade', mag: 3, reserve: 0 };
    s.switchTo(2);
    return L;
  });
  check(!!L, 'açık şerit bulundu');
  await wait(page, 900);
  if (!OLD) {
    // önizleme: tetik basılı (pişirme başlar), 0,7 sn
    await page.evaluate(() => { const p = window.__game.player; p.fireHeld = true; p.fireBuf = 0.15; });
    await wait(page, 700);
    const pv = await page.evaluate(() => { const v = window.__game.nadeView; return { vis: v.grp.visible, end: v.last && v.last.end.toArray(), n: v.last?.n, cook: document.getElementById('nadecook')?.textContent }; });
    check(pv.vis && pv.n > 20, `önizleme görünüyor (${pv.n} nokta, pişirme göstergesi ${pv.cook})`);
    await page.screenshot({ path: `${OUT}/${TAG}-1-onizleme.png` });
    await page.evaluate(() => { window.__game.player.third = true; });
    await wait(page, 450);
    await page.screenshot({ path: `${OUT}/${TAG}-1b-onizleme-3sahis.png` });
    await page.evaluate(() => { window.__game.player.third = false; });
    await wait(page, 300);
    // bırak: gerçek patlama yerini yakala
    const end0 = await page.evaluate(() => { const v = window.__game.nadeView, e = v.last.end.toArray(); window.__game.player.fireHeld = false; return e; });
    await wait(page, 300);
    await page.screenshot({ path: `${OUT}/${TAG}-2-ucus.png` });
    await page.waitForFunction(() => window.__S.boom.length > 0, null, { timeout: 6000 }).catch(() => {});
    await wait(page, 70);
    await page.screenshot({ path: `${OUT}/${TAG}-3-patlama.png` });
    const b = await page.evaluate(() => window.__S.boom[0]);
    const d = b ? Math.hypot(b[0] - end0[0], b[1] - end0[1], b[2] - end0[2]) : NaN;
    const dist = b ? Math.hypot(b[0] - L.x, b[2] - L.z) : NaN;
    check(d < 0.2, `tarayıcıda önizlenen patlama yeri = gerçek patlama (fark ${(d * 100).toFixed(1)} cm, ${dist.toFixed(1)} m ileride; pişirilip yuvarlanırken patlarsa en çok bir kare ≈ 10 cm)`);
    const back = await page.evaluate(() => window.__game.player.s.cur);
    check(back === 0, 'attıktan sonra tüfeğe döndü');
    // alttan atış önizlemesi + pişirme göstergesi (2 sn tut)
    await page.evaluate(() => { const g = window.__game, s = g.player.s; s.switchTo(2); });
    await wait(page, 600);
    await page.evaluate(() => { const g = window.__game, p = g.player, s = p.s; s.cd = 0; s.pitch = 0.1; s.ads = true; p.fireHeld = true; p.fireBuf = 0.15; });
    await wait(page, 600);
    const ua = await page.evaluate(() => { const g = window.__game, v = g.nadeView, s = g.player.s; return { under: v.last.under, d: Math.hypot(v.last.end.x - s.pos.x, v.last.end.z - s.pos.z) }; });
    check(ua.under && ua.d < 9, `sağ tık basılıyken alttan atış önizlemesi (${ua.d.toFixed(1)} m)`);
    await page.screenshot({ path: `${OUT}/${TAG}-4-alttan.png` });
    await page.evaluate(() => { window.__game.player.s.ads = false; window.__game.player.s.pitch = 0.3; });
    await wait(page, 1500);
    const ck = await page.evaluate(() => document.getElementById('nadecook')?.textContent);
    await page.screenshot({ path: `${OUT}/${TAG}-5-pisirme.png` });
    check(+ck > 0 && +ck < 1.2, `pişirme göstergesi kalan fünyeyi sayıyor (${ck} sn)`);

    await page.evaluate(() => { window.__game.player.fireHeld = false; });
    await wait(page, 1500);
  } else {
    // eski sürüm: tek tıkla atış (önizleme yok)
    await page.evaluate(() => { const p = window.__game.player; p.fireBuf = 0.15; });
    await wait(page, 300);
    await page.screenshot({ path: `${OUT}/${TAG}-2-ucus.png` });
    await page.waitForFunction(() => window.__S.boom.length > 0, null, { timeout: 6000 }).catch(() => {});
    await wait(page, 70);
    await page.screenshot({ path: `${OUT}/${TAG}-3-patlama.png` });
    const b = await page.evaluate(() => window.__S.boom[0]);
    console.log('      eski: patlama', b ? Math.hypot(b[0] - L.x, b[2] - L.z).toFixed(1) + ' m ileride' : 'yok');
  }
  await page.close();
}

// ── C) dokunmatik (Pixel 7 yatay): HUD yuvasına dokun → bomba; ateş düğmesini basılı tut → önizleme + pişirme, sürükle → nişan, bırak → atış ──
if (!OLD && (!process.env.ONLY || process.env.ONLY === 'C')) {
  const { devices } = await import('playwright');
  const { defaultBrowserType, ...pix } = devices['Pixel 7 landscape'];
  const ctx = await browser.newContext(pix);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('C: ' + e.message));
  await page.goto(`${BASE}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0&touch=1`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player && window.__game.player.touch', null, { timeout: 120000 });
  await page.evaluate(HELPERS);
  await page.evaluate(() => {
    const g = window.__game, s = g.player.s;
    g.brains.forEach((b) => (b.update = () => {}));
    g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; o.alive = false; o.respawnT = 1e9; });
    const L = window.__lane(36); s.pos.set(L.x, L.h0, L.z); s.vel.set(0, 0, 0); s.yaw = L.yaw; s.pitch = 0.2; g.devGod = true;
    s.items[2] = { id: 'grenade', mag: 3, reserve: 0 };
  });
  await wait(page, 600);
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const box = async (sel) => page.evaluate((sel) => { const r = document.querySelectorAll(sel); const e = sel.includes('slot') ? r[2] : r[0]; if (!e) return null; const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, sel);
  const sb = await box('#slots .slot');
  if (sb) { await touch('touchStart', sb[0], sb[1]); await touch('touchEnd'); }
  await wait(page, 600);
  const cur = await page.evaluate(() => window.__game.player.s.item.id);
  check(cur === 'grenade', `dokunmatik: yuvaya dokununca bomba elde (${cur})`);
  const fb = await box('#tc [data-b=fire]');
  await touch('touchStart', fb[0], fb[1]);
  await wait(page, 400);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', fb[0] - i * 4, fb[1] - i * 3); await wait(page, 16); }   // basılıyken sürükle: nişan değişir, önizleme izler
  await wait(page, 300);
  const pv = await page.evaluate(() => { const v = window.__game.nadeView; return { vis: v.grp.visible, end: v.last?.end.toArray(), cook: document.getElementById('nadecook')?.textContent }; });
  check(pv.vis && pv.end, `dokunmatik: ateş düğmesi basılıyken önizleme + pişirme (${pv.cook} sn)`);
  await page.screenshot({ path: `${OUT}/${TAG}-7-dokunmatik.png` });
  const e0 = await page.evaluate(() => window.__game.nadeView.last.end.toArray());
  await touch('touchEnd');
  await page.waitForFunction(() => window.__S.boom.length > 0, null, { timeout: 6000 }).catch(() => {});
  const b = await page.evaluate(() => window.__S.boom[0]);
  const d = b ? Math.hypot(b[0] - e0[0], b[2] - e0[2]) : NaN;
  check(d < 0.25, `dokunmatik: bırakınca atıldı, önizlenen yere düştü (fark ${(d * 100).toFixed(0)} cm)`);
  await ctx.close();
}

// ── B) çevrim içi: A atar, B görür ──
if (!process.env.ONLY || process.env.ONLY === 'B') {
  async function open(q) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    page.on('pageerror', (e) => errs.push(q.name + ': ' + e.message));
    await page.goto(`${BASE}/?${new URLSearchParams({ debug: '1', nolock: '1', server: WS, cls: 'assault', third: '0', ...q })}`);
    await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier', null, { timeout: 90000 });
    await page.evaluate(HELPERS);
    return page;
  }
  const A = await open({ online: 'new', type: 'tdm', per: '3', map: 'colgecidi', diff: 'easy', bots: '1', name: 'Ali', tod: 'day' });
  const code = await A.evaluate(() => window.__game.opts.online.room);
  const B = await open({ online: code, name: 'Veli' });
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', bots: false }));
  for (const p of [A, B]) await p.evaluate(() => { const g = window.__game, n = g.online; window.__sp0 = g.playerSoldier.spawnN; n.send({ t: 'dbg', kill: 1 }); n.send({ t: 'dbg', kill: 1 }); });
  for (const p of [A, B]) await p.waitForFunction(() => { const s = window.__game.playerSoldier; return s.alive && s.spawnN > window.__sp0; }, null, { timeout: 20000 });      // gecikmede eski "canlı" durumu sayılmasın
  const teams = await Promise.all([A, B].map((p) => p.evaluate(() => window.__game.playerSoldier.team)));
  check(teams[0] !== teams[1], `A ve B karşı takımlarda (${teams.join(' / ')})`);
  const L = await A.evaluate(() => window.__lane(40));
  const ids = await Promise.all([A, B].map((p) => p.evaluate(() => window.__game.playerSoldier.id)));
  // A şeridin başında, B 25 m ileride; A'nın eline el bombası
  await A.evaluate(([L]) => { const n = window.__game.online; n.send({ t: 'dbg', tp: [L.x, L.z], hp: 100 }); n.send({ t: 'dbg', item: [2, 'grenade'] }); }, [L]);
  await B.evaluate(([L]) => { const n = window.__game.online; n.send({ t: 'dbg', tp: [L.x + L.dx * 25, L.z + L.dz * 25], hp: 100 }); }, [L]);
  await wait(A, 1500);
  await A.evaluate(([L]) => { const g = window.__game, s = g.playerSoldier; s.yaw = L.yaw; s.pitch = 0.2; s.switchTo(2); }, [L]);
  await B.evaluate(([L, aid]) => { const g = window.__game, s = g.playerSoldier, a = g.soldiers[aid]; s.yaw = Math.atan2(-(a.pos.x - s.pos.x), -(a.pos.z - s.pos.z)) + 0.35; s.pitch = -0.05; }, [L, ids[0]]);
  await wait(A, 900);
  const pre = await A.evaluate(() => { const s = window.__game.playerSoldier; return { item: s.item.id, mag: s.item.mag, cur: s.cur }; });
  check(pre.item === 'grenade' && pre.mag > 0, `A'nın elinde el bombası (${pre.item} ×${pre.mag})`);
  let tRel, end2;
  if (OLD) {                                                                          // eski sürüm: önizleme yok, tıkla anında atar (yalnız gecikme / patlama sayısı ölçülür)
    for (const p of [A, B]) await p.evaluate(() => { const S = window.__S; S.boom = []; S.expl = 0; S.grT = []; S.hm = 0; });
    tRel = await A.evaluate(() => { const g = window.__game, p = g.player; p.fireBuf = 0.15; g.online.edge('fp'); return Date.now(); });
  } else {
  // A'nın önizlemesine göre B'yi tam iniş noktasına koy (bomba onu öldürsün)
  await A.evaluate(() => { const g = window.__game, p = g.player; p.fireHeld = true; p.fireBuf = 0.15; g.online.edge('fp'); });      // fare basışı gibi (fp kenarı sunucuya)
  await A.waitForFunction(() => window.__game.nadeView.grp.visible && window.__game.nadeView.last, null, { timeout: 4000 }).catch(async () => console.log('      önizleme yok:', await A.evaluate(() => { const s = window.__game.playerSoldier; return JSON.stringify({ cur: s.cur, item: s.item.id, mag: s.item.mag, cd: s.cd, sw: s.switchT, cook: s.cook, fh: window.__game.player.fireHeld }); })));
  await wait(A, 450);
  const end = await A.evaluate(() => window.__game.nadeView.last.end.toArray());
  await B.evaluate((e) => window.__game.online.send({ t: 'dbg', tp: [e[0] + 0.6, e[2]], hp: 100 }), end);
  await wait(A, 400);
  await A.screenshot({ path: `${OUT}/net-A-1-onizleme.png` });
  end2 = await A.evaluate(() => window.__game.nadeView.last.end.toArray());
  await B.evaluate(([aid]) => { const g = window.__game, s = g.playerSoldier, a = g.soldiers[aid]; s.yaw = Math.atan2(-(a.pos.x - s.pos.x), -(a.pos.z - s.pos.z)); s.pitch = 0.08; }, [ids[0]]);
  for (const p of [A, B]) await p.evaluate(() => { const S = window.__S; S.boom = []; S.expl = 0; S.grT = []; S.hm = 0; window.__kf0 = document.getElementById('killfeed')?.innerHTML.length || 0; });
  // bırak
  tRel = await A.evaluate(() => { window.__game.player.fireHeld = false; return Date.now(); });
  }
  await A.waitForFunction(() => window.__game.projectiles.some((p) => p.type === 'grenade'), null, { timeout: 3000, polling: 4 }).catch(() => {});
  const tA = await A.evaluate(() => Date.now());
  await B.waitForFunction(() => window.__game.projectiles.some((p) => p.type === 'grenade'), null, { timeout: 3000, polling: 4 }).catch(() => {});
  const tB = await B.evaluate(() => Date.now());
  await wait(B, 350);
  await B.screenshot({ path: `${OUT}/net-B-2-ucus.png` });
  await B.waitForFunction(() => window.__S.expl > 0, null, { timeout: 6000, polling: 10 }).catch(() => {});
  await wait(B, 60);
  await B.screenshot({ path: `${OUT}/net-B-3-patlama.png` });
  await wait(A, 1200);
  await A.screenshot({ path: `${OUT}/net-A-4-sonra.png` });
  const ra = await A.evaluate(() => ({ expl: window.__S.expl, boom: window.__S.boom, pred: window.__game.projectiles.filter((p) => p.type === 'grenade').length, hm: window.__S.hm, kf: document.getElementById('killfeed')?.innerHTML || '', rtt: window.__game.online.stats.rtt }));
  const rb = await B.evaluate(() => ({ expl: window.__S.expl, boom: window.__S.boom, alive: window.__game.playerSoldier.alive, kf: document.getElementById('killfeed')?.innerHTML || '' }));
  console.log(`      RTT ${ra.rtt.toFixed(0)} ms · A kendi bombasını ${tA - tRel} ms'de, B ${tB - tRel} ms'de gördü`);
  if (OLD) { console.log(`      eski: patlama A ${ra.expl}, B ${rb.expl}`); await A.close(); await B.close(); await browser.close(); process.exit(0); }
  check(tA - tRel < 120, `atan kendi bombasını beklemeden görüyor (${tA - tRel} ms, tahmin)`);
  check(tB - tRel < 600, `gören bombayı sunucu olayıyla görüyor (${tB - tRel} ms)`);
  check(ra.expl === 1 && rb.expl === 1, `iki ekranda da tek patlama (A ${ra.expl}, B ${rb.expl})`);
  const sb = rb.boom[0] || ra.boom[0];
  const de = sb ? Math.hypot(sb[0] - end2[0], sb[2] - end2[2]) : NaN;
  check(de < 0.4, `sunucunun patlama yeri = atanın önizlemesi (fark ${(de * 100).toFixed(0)} cm)`);
  check(!rb.alive, 'B bombayla öldü');
  check(/Bomba|Grenade/i.test(ra.kf) && /class="hsi nd"/.test(ra.kf), 'öldürme akışında el bombası + simge');
  check(ra.hm > 0, `A'da isabet işareti (${ra.hm})`);
  check(ra.pred === 0, 'tahmin edilen bomba patlamadan sonra kalmadı');
  await A.close(); await B.close();
}

check(!errs.length, 'sayfa hatası yok' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
