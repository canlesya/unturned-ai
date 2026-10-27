// El bombası tarayıcı testi (12.144 → 12.193 PUBG tarzı): gerçek oyun, gerçek çizim.
//  A) çevrimdışı masaüstü: üstten yay + iniş / öldürme halkası, R ile pişirme halkası, sağ tık (gerçek fare) → alttan yuvarlama, G hızlı atış
//     (gerçek klavye), önizlenen patlama = gerçek (g.fragBlast yakalanır), gelen bomba uyarısı, 3. şahıs atış pozu, aşırı pişirme → kendini
//     öldürme (öldürme akışı), flaş körlüğü, duman.
//  C) dokunmatik (Pixel 7 yatay): bomba düğmesi basılı → yay + iptal alanı, ŞEKİL (nişan düğmesi) → alttan, iptal alanında bırak → atılmaz,
//     PİŞİR (şarjör düğmesi) + bırak → atılır, önizlenen yere düşer.
//  B) çevrim içi (iki istemci, BF_DEBUG=1 yerel sunucu, isteğe bağlı gecikme vekili): atan kendi bombasını gecikmesiz görür, sunucu olayı gelince
//     görünür sıçrama yok (tahmin ↔ sunucu farkı), iki ekranda tek patlama, sunucu patlaması = atanın önizlemesi, gören ölür, öldürme akışı.
//   node scripts/grenadeweb.mjs <taban url> [ws url]  (OUT=/tmp/wb-qa10/shots · GPU=0 → swiftshader · ONLY=A|B|C · TAG=after)
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.argv[2] || 'http://127.0.0.1:5180', WS = process.argv[3] || 'ws://127.0.0.1:8787';
const OUT = process.env.OUT || '/tmp/wb-qa10/shots', TAG = process.env.TAG || 'after', GPU = process.env.GPU !== '0';
mkdirSync(OUT, { recursive: true });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
const wait = (p, ms) => p.waitForTimeout(ms);
const only = (k) => !process.env.ONLY || process.env.ONLY.includes(k);

// sayfaya yardımcılar: düz açık şerit bulma, olay sayaçları (patlama = g.fragBlast)
const HELPERS = async () => {
  const g = window.__game, V = g.camera.position.constructor;
  window.__W = (await import('/src/game/stats.js')).WSTATS;
  window.__lane = (len = 40, seed = 7) => {                                          // tohumlu: hep aynı yer
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 30000; k++) {
      const x = -100 + rnd() * 200, z = -100 + rnd() * 200, yaw = rnd() * Math.PI * 2;
      const dx = -Math.sin(yaw), dz = -Math.cos(yaw), h0 = g.world.heightAt(x, z);
      if (!g.nav.isFree(x, z)) continue;
      const bz = g.map.baseZones, inBase = (px, pz) => bz && Object.values(bz).some((b) => px > b.minX - 4 && px < b.maxX + 4 && pz > b.minZ - 4 && pz < b.maxZ + 4);
      if (inBase(x, z) || inBase(x + dx * len, z + dz * len)) continue;
      let ok = true;
      for (let d = 0; d <= len && ok; d += 0.5) if (Math.abs(g.world.heightAt(x + dx * d, z + dz * d) - h0) > 0.04) ok = false;
      for (const hy of [0.12, 0.6, 1.6, 4, 10]) if (ok && g.world.raycast(new V(x, h0 + hy, z), new V(dx, 0, dz), len, {})) ok = false;
      if (ok) return { x, z, yaw, h0, dx, dz };
    }
    return null;
  };
  const S = (window.__S = { boom: [], expl: 0, hm: 0, snap: [] });
  const fb = g.fragBlast.bind(g);
  g.fragBlast = (pos, ...r) => { S.boom.push([pos.x, pos.y, pos.z, performance.now()]); return fb(pos, ...r); };
  const fx = g.effects.explosion.bind(g.effects);
  g.effects.explosion = (...a) => { S.expl++; return fx(...a); };
  g.on('hitmark', () => S.hm++);
  const ng = g.netGrenade.bind(g);                                                    // çevrim içi: tahmin ↔ sunucu eşlemesindeki sıçrama
  g.netGrenade = (ev, by) => { const mine = by === g.playerSoldier ? g.projectiles.find((p) => p.pred) : null, p0 = mine && mine.pos.clone(), f0 = mine?.fuse; const r = ng(ev, by); if (mine && !mine.pred) S.snap.push({ d: mine.pos.distanceTo(p0), df: Math.abs(mine.fuse - f0), steps: mine.steps }); return r; };
};
const prep = async (page, { lane = 42, god = true } = {}) => page.evaluate(([lane, god]) => {
  const g = window.__game, p = g.player, s = p.s;
  g.brains.forEach((b) => (b.update = () => {}));
  g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; o.alive = false; o.respawnT = 1e9; });
  const L = window.__lane(lane);
  s.pos.set(L.x, L.h0, L.z); s.vel.set(0, 0, 0); s.yaw = L.yaw; s.pitch = 0.26; s.protT = 0; g.devGod = god;
  s.items[2] = { id: 'grenade', mag: 3, reserve: 0 };
  s.switchTo(2);
  return L;
}, [lane, god]);
// düşman (dondurulmuş bot) koy: şeridin d m ilerisine, yanına ofsetle
const dummy = (page, L, d, side = 0) => page.evaluate(([L, d, side]) => {
  const g = window.__game, me = g.player.s, e = g.soldiers.find((o) => o !== me && o.team !== me.team);
  e.alive = true; e.hp = e.maxHp = 100; e.protT = 0; e.respawnT = 1e9;
  e.pos.set(L.x + L.dx * d - L.dz * side, L.h0, L.z + L.dz * d + L.dx * side); e.vel.set(0, 0, 0); e.yaw = L.yaw + Math.PI;
  return e.id;
}, [L, d, side]);

// ── A) çevrimdışı ──
if (only('A')) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errs.push('A: ' + e.message));
  await page.goto(`${BASE}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0&tod=day&weather=clear`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  await page.evaluate(HELPERS);
  await page.mouse.move(640, 360);                                                   // fare ortada (sonraki tıklar bakışı çevirmesin)
  await wait(page, 200);
  const L = await prep(page);
  check(!!L, 'açık şerit bulundu');
  await dummy(page, L, 24, 1.2);
  await wait(page, 900);
  // 1) üstten yay (fare: sol tık basılı)
  await page.mouse.down();
  await wait(page, 600);
  const pv = await page.evaluate(() => { const v = window.__game.nadeView, h = document.getElementById('nadehud'); return { vis: v.grp.visible, n: v.last?.n, under: v.last?.under, lit: v.last?.lit, fuse: v.last?.fuse, hud: h?.style.display, txt: h?.textContent }; });
  check(pv.vis && pv.n > 20 && !pv.under && !pv.lit && Math.abs(pv.fuse - 5) < 1e-6, `üstten yay görünüyor (${pv.n} nokta, fünye ${pv.fuse} sn, pim çekilmedi) · HUD "${pv.txt}"`);
  await page.screenshot({ path: `${OUT}/${TAG}-1-yay.png` });
  // 2) R → pim çekilir, halka kalan fünyeyi sayar
  await page.keyboard.press('KeyR');
  await wait(page, 1600);
  const ck = await page.evaluate(() => { const v = window.__game.nadeView, h = document.getElementById('nadehud'); return { lit: v.last.lit, fuse: v.last.fuse, cls: h.className, txt: h.querySelector('text').textContent }; });
  check(ck.lit && ck.fuse > 3 && ck.fuse < 3.6 && /lit/.test(ck.cls), `R: pim çekildi, pişirme halkası ${ck.txt} sn`);
  await page.screenshot({ path: `${OUT}/${TAG}-2-pisirme.png` });
  await page.evaluate(() => { window.__game.player.third = true; });
  await wait(page, 400);
  await page.screenshot({ path: `${OUT}/${TAG}-2b-pisirme-3sahis.png` });
  await page.evaluate(() => { window.__game.player.third = false; });
  await wait(page, 200);
  // bırak → gerçek patlama = önizleme
  const end0 = await page.evaluate(() => window.__game.nadeView.last.end.toArray());
  await page.mouse.up();
  await wait(page, 350);
  await page.screenshot({ path: `${OUT}/${TAG}-3-ucus.png` });
  await page.waitForFunction(() => window.__S.boom.length > 0, null, { timeout: 6000 }).catch(() => {});
  await wait(page, 70);
  await page.screenshot({ path: `${OUT}/${TAG}-4-patlama.png` });
  const b = await page.evaluate(() => window.__S.boom[0]);
  const d = b ? Math.hypot(b[0] - end0[0], b[1] - end0[1], b[2] - end0[2]) : NaN;
  check(d < 0.5, `pişirilmiş atış: önizlenen patlama = gerçek (fark ${(d * 100).toFixed(1)} cm, ${b ? Math.hypot(b[0] - L.x, b[2] - L.z).toFixed(1) : '?'} m ileride)`);
  const dz = await page.evaluate((b) => { const g = window.__game, e = g.soldiers.find((o) => o !== g.player.s && o.team !== g.player.s.team), c = e.center(e.pos.clone()); return { alive: e.alive, hp: e.hp, d: Math.hypot(c.x - b[0], c.y - b[1], c.z - b[2]), clear: g.world.clear(new e.pos.constructor(b[0], b[1] + 0.4, b[2]), c) }; }, b);
  check(dz.d > 3.5 || !dz.alive, `öldürücü yarıçaptaki (≤ 3,5 m) düşman öldü (gövde merkezine ${dz.d.toFixed(2)} m, ${dz.alive ? 'canlı ' + Math.round(dz.hp) : 'öldü'}, açık hat ${dz.clear})`);
  // 3) sağ tık (gerçek fare) → alttan yuvarlama
  await page.evaluate(() => { const s = window.__game.player.s; s.switchTo(2); });
  await wait(page, 700);
  await page.mouse.click(640, 360, { button: 'right' });
  await wait(page, 100);
  const um = await page.evaluate(() => window.__game.player.s.nadeUnder);
  await page.evaluate(() => { window.__game.player.s.pitch = 0.05; });
  await page.mouse.down();
  await wait(page, 600);
  const ua = await page.evaluate(() => { const g = window.__game, v = g.nadeView, s = g.player.s; return { under: v.last.under, d: Math.hypot(v.last.end.x - s.pos.x, v.last.end.z - s.pos.z), txt: document.querySelector('#nadehud .m').textContent }; });
  check(um && ua.under && ua.d < 9, `sağ tık → alttan yuvarlama ("${ua.txt}", ${ua.d.toFixed(1)} m)`);
  await page.screenshot({ path: `${OUT}/${TAG}-5-alttan.png` });
  const ue = await page.evaluate(() => { window.__S.boom = []; return window.__game.nadeView.last.end.toArray(); });
  await page.mouse.up();
  await page.waitForFunction(() => window.__S.boom.length > 0, null, { timeout: 7000 }).catch(() => {});
  const ub = await page.evaluate(() => window.__S.boom[0]);
  const ud = ub ? Math.hypot(ub[0] - ue[0], ub[2] - ue[2]) : NaN;
  check(ud < 0.5, `alttan atış önizlemesi = gerçek (${(ud * 100).toFixed(1)} cm)`);
  // 4) gelen bomba uyarısı: düşman bombası oyuncunun 3 m sağına düşer
  await wait(page, 2500);
  const wn = await page.evaluate(() => {
    const g = window.__game, me = g.player.s, e = g.soldiers.find((o) => o !== me && o.team !== me.team), V = me.pos.constructor;
    e.alive = true; e.hp = 100;
    const r = me.right(new V()), f = me.aimDir(new V()); f.y = 0; f.normalize();
    const p = me.pos.clone().addScaledVector(r, 2.6).addScaledVector(f, 1.5); p.y += 1.2;
    window.__S.boom = [];
    g.spawnGrenade(e, p, new V(0, -1, 0), window.__W.grenade, null, { fuse: 2.2 });
    return true;
  }).catch((e) => String(e));
  await wait(page, 500);
  const wl = await page.evaluate(() => window.__game.nadeView.warn.last.map((w) => ({ d: +w.d.toFixed(1), hot: w.hot, a: +w.a.toFixed(2) })));
  check(wl.length === 1 && wl[0].hot && wl[0].a > 0.3 && wl[0].a < 2.2, `gelen bomba uyarısı: sağda, öldürücü yarıçapta kırmızı ${JSON.stringify(wl)}`);
  await page.screenshot({ path: `${OUT}/${TAG}-6-uyari.png` });
  await page.waitForFunction(() => window.__S.boom.length > 0, null, { timeout: 4000 }).catch(() => {});
  await wait(page, 60);
  await page.screenshot({ path: `${OUT}/${TAG}-6b-yakin-patlama.png` });
  // 5) G hızlı atış (gerçek klavye): basılı tut → çekilir + yay, bırak → atılır
  await page.evaluate(() => { const g = window.__game, s = g.player.s; s.switchTo(0); s.items[2] = { id: 'grenade', mag: 3, reserve: 0 }; window.__S.boom = []; g.projectiles.length = 0; });
  await wait(page, 500);
  await page.keyboard.down('KeyG');
  await wait(page, 700);
  const gq = await page.evaluate(() => { const g = window.__game, s = g.player.s; return { cur: s.item.id, prep: !!s.cook, vis: g.nadeView.grp.visible }; });
  check(gq.cur === 'grenade' && gq.prep && gq.vis, `G basılı: bomba çekildi, hazır, yay görünüyor (${JSON.stringify(gq)})`);
  await page.screenshot({ path: `${OUT}/${TAG}-7-hizli.png` });
  await page.keyboard.up('KeyG');
  await wait(page, 200);
  const gt = await page.evaluate(() => { const g = window.__game, s = g.player.s; return { flying: g.projectiles.filter((p) => p.type === 'grenade').length, mag: s.items[2].mag }; });
  check(gt.flying === 1 && gt.mag === 2, `G bırakıldı: bomba atıldı (havada ${gt.flying}, kalan ${gt.mag})`);
  await wait(page, 900);
  const gb = await page.evaluate(() => window.__game.player.s.item.id);
  check(gb !== 'grenade', `hızlı atıştan sonra önceki silaha döndü (${gb})`);
  await page.waitForFunction(() => window.__S.boom.length > 0, null, { timeout: 7000 }).catch(() => {});
  // 6) flaş: bakan oyuncu kör olur
  const fl = await page.evaluate(() => {
    const g = window.__game, s = g.player.s, V = s.pos.constructor; g.devGod = true;
    if (!s.alive) return null;
    const e = g.soldiers.find((o) => o !== s && o.team !== s.team); e.alive = true;
    const f = s.aimDir(new V()), p = s.eye(new V()).addScaledVector(f, 5);
    g.spawnGrenade(e, p, new V(0, 0, 0), window.__W.flash, null, { fuse: 0.05 });
    return true;
  });
  await wait(page, 250);
  const bl = await page.evaluate(() => window.__game.player.s.blindT);
  check(fl && bl > 3, `flaş: bakan oyuncu kör (${bl.toFixed(1)} sn)`);
  await page.screenshot({ path: `${OUT}/${TAG}-8-flas.png` });
  // 7) aşırı pişirme: elde patlar, oyuncu ölür, öldürme akışında kendi + bomba simgesi
  await wait(page, 3500);
  await page.evaluate(() => { const g = window.__game, s = g.player.s; s.blindT = 0; g.devGod = false; s.hp = 100; s.protT = 0; s.switchTo(2); });
  await wait(page, 600);
  await page.mouse.down();
  await wait(page, 150);
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => !window.__game.player.s.alive, null, { timeout: 8000 }).catch(() => {});
  await page.mouse.up();
  await wait(page, 500);
  const sk = await page.evaluate(() => ({ alive: window.__game.player.s.alive, kf: document.getElementById('killfeed')?.innerHTML || '' }));
  check(!sk.alive && /class="hsi nd"|El Bombası|Grenade/.test(sk.kf), 'aşırı pişirme: elde patladı, oyuncu öldü, öldürme akışında bomba');
  await page.screenshot({ path: `${OUT}/${TAG}-9-kendini.png` });
  await page.close();
}

// ── C) dokunmatik (Pixel 7 yatay) ──
if (only('C')) {
  const { defaultBrowserType, ...pix } = devices['Pixel 7 landscape'];
  const ctx = await browser.newContext(pix);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('C: ' + e.message));
  await page.goto(`${BASE}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0&touch=1&tod=day&weather=clear`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player && window.__game.player.touch', null, { timeout: 120000 });
  await page.evaluate(HELPERS);
  const L = await prep(page, { lane: 36 });
  await page.evaluate(() => { const s = window.__game.player.s; s.switchTo(0); s.pitch = 0.2; });
  await dummy(page, L, 20, 0.5);
  await wait(page, 700);
  const cdp = await ctx.newCDPSession(page);
  const pts = new Map();
  const touch = async (type, id, x, y) => { pts.set(id, { x, y, id }); await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...pts.values()] }); };
  const end = async (id) => { pts.delete(id); const rest = [...pts.values()]; await cdp.send('Input.dispatchTouchEvent', rest.length ? { type: 'touchMove', touchPoints: rest } : { type: 'touchEnd', touchPoints: [] }); };      // CDP: kalan parmaklarla touchMove = yalnız bu parmak kalkar
  const box = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, sel);
  const nb = await box('#tc [data-b=nade]');
  await touch('touchStart', 1, nb[0], nb[1]);
  await wait(page, 700);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', 1, nb[0] - i * 3, nb[1] - i * 1); await wait(page, 16); }
  await wait(page, 200);
  const m1 = await page.evaluate(() => { const g = window.__game, s = g.player.s, z = document.querySelector('#tc .ncz'); return { cur: s.item.id, prep: !!s.cook, vis: g.nadeView.grp.visible, ncz: z.classList.contains('on'), nm: document.getElementById('tc').classList.contains('nm'), lb: [...document.querySelectorAll('#tc .nl')].map((e) => e.textContent) }; });
  check(m1.cur === 'grenade' && m1.prep && m1.vis && m1.ncz && m1.nm, `dokunmatik: bomba düğmesi basılı → çekildi, yay + iptal alanı, düğme etiketleri ${JSON.stringify(m1.lb)}`);
  await page.screenshot({ path: `${OUT}/${TAG}-m1-dokunmatik.png` });
  // ŞEKİL (nişan düğmesi) ikinci parmakla → alttan
  const ab = await box('#tc [data-b=ads]');
  await touch('touchStart', 2, ab[0], ab[1]); await wait(page, 60); await end(2, ab[0], ab[1]);
  await wait(page, 200);
  const m2 = await page.evaluate(() => ({ under: window.__game.player.s.nadeUnder, pv: window.__game.nadeView.last.under }));
  check(m2.under && m2.pv, 'dokunmatik: ŞEKİL → alttan yuvarlama');
  await page.screenshot({ path: `${OUT}/${TAG}-m2-alttan.png` });
  // iptal alanına sürükle, orada bırak → atılmaz
  const zc = await page.evaluate(() => { const r = document.querySelector('#tc .ncz').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  for (let i = 1; i <= 10; i++) { await touch('touchMove', 1, nb[0] + (zc[0] - nb[0]) * i / 10, nb[1] + (zc[1] - nb[1]) * i / 10); await wait(page, 16); }
  await wait(page, 150);
  const hot = await page.evaluate(() => document.querySelector('#tc .ncz').classList.contains('hot'));
  await page.screenshot({ path: `${OUT}/${TAG}-m3-iptal.png` });
  await end(1, zc[0], zc[1]);
  await wait(page, 600);
  const m3 = await page.evaluate(() => { const g = window.__game, s = g.player.s; return { hot: 0, mag: s.items[2].mag, cur: s.item.id, fly: g.projectiles.filter((p) => p.type === 'grenade').length }; });
  check(hot && m3.mag === 3 && m3.fly === 0 && m3.cur !== 'grenade', `dokunmatik: iptal alanında bırakınca atılmadı, bomba cebe döndü (${JSON.stringify(m3)})`);
  // yeniden bas, PİŞİR, bırak → atılır ve önizlenen yere düşer
  await page.evaluate(() => { window.__S.boom = []; });
  await touch('touchStart', 1, nb[0], nb[1]);
  await wait(page, 700);
  const rb = await box('#tc [data-b=reload]');
  await touch('touchStart', 2, rb[0], rb[1]); await wait(page, 60); await end(2, rb[0], rb[1]);
  await wait(page, 800);
  const m4 = await page.evaluate(() => ({ lit: !!window.__game.player.s.cook?.lit, e: window.__game.nadeView.last.end.toArray(), fuse: window.__game.nadeView.last.fuse }));
  await page.screenshot({ path: `${OUT}/${TAG}-m4-pisir.png` });
  await end(1, nb[0], nb[1]);
  await page.waitForFunction(() => window.__S.boom.length > 0, null, { timeout: 7000 }).catch(() => {});
  const bb = await page.evaluate(() => window.__S.boom[0]);
  const dd = bb ? Math.hypot(bb[0] - m4.e[0], bb[2] - m4.e[2]) : NaN;
  check(m4.lit && dd < 0.5, `dokunmatik: PİŞİR (kalan ${m4.fuse.toFixed(1)} sn) + bırak → atıldı, önizlenen yere düştü (fark ${(dd * 100).toFixed(1)} cm)`);
  await wait(page, 80);
  await page.screenshot({ path: `${OUT}/${TAG}-m5-patlama.png` });
  await ctx.close();
}

// ── B) çevrim içi: A atar (pişirerek), B görür ──
if (only('B')) {
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
  for (const p of [A, B]) await p.waitForFunction(() => { const s = window.__game.playerSoldier; return s.alive && s.spawnN > window.__sp0; }, null, { timeout: 20000 });
  const teams = await Promise.all([A, B].map((p) => p.evaluate(() => window.__game.playerSoldier.team)));
  check(teams[0] !== teams[1], `A ve B karşı takımlarda (${teams.join(' / ')})`);
  const L = await A.evaluate(() => window.__lane(40));
  const ids = await Promise.all([A, B].map((p) => p.evaluate(() => window.__game.playerSoldier.id)));
  await A.evaluate(([L]) => { const n = window.__game.online; n.send({ t: 'dbg', tp: [L.x, L.z], hp: 100 }); n.send({ t: 'dbg', item: [2, 'grenade'] }); }, [L]);
  await B.evaluate(([L]) => { const n = window.__game.online; n.send({ t: 'dbg', tp: [L.x + L.dx * 25, L.z + L.dz * 25], hp: 100 }); }, [L]);
  await wait(A, 1500);
  await A.evaluate(([L]) => { const g = window.__game, s = g.playerSoldier; s.yaw = L.yaw; s.pitch = 0.2; s.switchTo(2); }, [L]);
  await wait(A, 900);
  const pre = await A.evaluate(() => { const s = window.__game.playerSoldier; return { item: s.item.id, mag: s.item.mag }; });
  check(pre.item === 'grenade' && pre.mag > 0, `A'nın elinde el bombası (${pre.item} ×${pre.mag})`);
  await A.evaluate(() => { const g = window.__game, p = g.player; p.fireHeld = true; p.fireBuf = 0.15; g.online.edge('fp'); });
  await A.waitForFunction(() => window.__game.nadeView.grp.visible && window.__game.nadeView.last, null, { timeout: 4000 }).catch(() => {});
  await wait(A, 300);
  await A.evaluate(() => { const g = window.__game; g.player.cookReq = true; g.online.edge('rl'); });     // R
  await wait(A, 1200);
  const end = await A.evaluate(() => window.__game.nadeView.last.end.toArray());
  await B.evaluate((e) => window.__game.online.send({ t: 'dbg', tp: [e[0] + 0.6, e[2]], hp: 100 }), end);
  await wait(A, 400);
  await A.screenshot({ path: `${OUT}/net-A-1-pisirme.png` });
  const end2 = await A.evaluate(() => window.__game.nadeView.last.end.toArray());
  const srvLit = await A.evaluate(() => ({ lit: window.__game.nadeView.last.lit, fuse: window.__game.nadeView.last.fuse }));
  check(srvLit.lit, `çevrim içi: R ile pim çekildi (kalan ${srvLit.fuse.toFixed(2)} sn)`);
  await B.evaluate(([aid]) => { const g = window.__game, s = g.playerSoldier, a = g.soldiers[aid]; s.yaw = Math.atan2(-(a.pos.x - s.pos.x), -(a.pos.z - s.pos.z)); s.pitch = 0.08; }, [ids[0]]);
  for (const p of [A, B]) await p.evaluate(() => { const S = window.__S; S.boom = []; S.expl = 0; S.hm = 0; S.snap = []; });
  const tRel = await A.evaluate(() => { window.__game.player.fireHeld = false; return Date.now(); });
  await A.waitForFunction(() => window.__game.projectiles.some((p) => p.type === 'grenade'), null, { timeout: 3000, polling: 4 }).catch(() => {});
  const tA = await A.evaluate(() => Date.now());
  await B.waitForFunction(() => window.__game.projectiles.some((p) => p.type === 'grenade'), null, { timeout: 3000, polling: 4 }).catch(() => {});
  const tB = await B.evaluate(() => Date.now());
  const bw = await B.waitForFunction(() => window.__game.nadeView.warn.last.length > 0, null, { timeout: 4000, polling: 10 }).then(() => 1).catch(() => 0);
  await wait(B, 120);
  await B.screenshot({ path: `${OUT}/net-B-2-ucus-uyari.png` });
  await B.waitForFunction(() => window.__S.expl > 0, null, { timeout: 6000, polling: 10 }).catch(() => {});
  await wait(B, 60);
  await B.screenshot({ path: `${OUT}/net-B-3-patlama.png` });
  await wait(A, 1200);
  const ra = await A.evaluate(() => ({ expl: window.__S.expl, boom: window.__S.boom, pred: window.__game.projectiles.filter((p) => p.type === 'grenade').length, hm: window.__S.hm, kf: document.getElementById('killfeed')?.innerHTML || '', rtt: window.__game.online.stats.rtt, snap: window.__S.snap }));
  const rb = await B.evaluate(() => ({ expl: window.__S.expl, boom: window.__S.boom, alive: window.__game.playerSoldier.alive, kf: document.getElementById('killfeed')?.innerHTML || '' }));
  console.log(`      RTT ${ra.rtt.toFixed(0)} ms · A kendi bombasını ${tA - tRel} ms'de, B ${tB - tRel} ms'de gördü · tahmin ↔ sunucu eşlemesi ${JSON.stringify(ra.snap.map((s) => ({ d: +s.d.toFixed(3), df: +s.df.toFixed(3), adım: s.steps })))}`);
  check(tA - tRel < 120, `atan kendi bombasını beklemeden görüyor (${tA - tRel} ms, tahmin)`);
  check(ra.snap.length === 1 && ra.snap[0].d < 0.15, `sunucu devralınca görünür sıçrama yok (${ra.snap[0] ? (ra.snap[0].d * 100).toFixed(1) + ' cm, fünye farkı ' + (ra.snap[0].df * 1000).toFixed(0) + ' ms' : 'eşleme yok'})`);
  check(tB - tRel < 600, `gören bombayı sunucu olayıyla görüyor (${tB - tRel} ms)`);
  check(bw >= 1, 'B (hedef) gelen bomba uyarısını görüyor');
  check(ra.expl === 1 && rb.expl === 1, `iki ekranda da tek patlama (A ${ra.expl}, B ${rb.expl})`);
  const sb = rb.boom[0] || ra.boom[0];
  const de = sb ? Math.hypot(sb[0] - end2[0], sb[2] - end2[2]) : NaN;
  check(de < 0.5, `sunucunun patlama yeri = atanın önizlemesi (fark ${(de * 100).toFixed(0)} cm)`);
  check(!rb.alive, 'B bombayla öldü');
  check(/class="hsi nd"/.test(ra.kf), 'öldürme akışında el bombası simgesi');
  check(ra.pred === 0, 'tahmin edilen bomba patlamadan sonra kalmadı');
  await A.close(); await B.close();
}

check(!errs.length, 'sayfa hatası yok' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
