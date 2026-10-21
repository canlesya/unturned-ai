// Mobil geçiş testi: telefon öykünmesinde (gerçek DPR + dokunma) tüm ekranların görüntüsü + denetimler.
//   node scripts/mobilepass.mjs [url=http://127.0.0.1:5180] [etiket=now]      → /tmp/wb-mob-shots/<etiket>/<cihaz>-<ekran>.png
//   DEV=iphone14,pixel7 ile cihaz süzülür (iphone14 · iphone13 · pixel7 · small · desktop). ONLY=menu,game,inf ile bölüm süzülür.
// Denetimler (mobilde): dokunma hedefi ≥ 40 px, görünen öğe ekrandan taşmıyor, dürbün örtüsü ekranı kaplıyor, oyun FOV'u (yatay) makul,
// çözünürlük DPR'ye uygun, nişan yardımı görünen bota döndürüyor / duvar arkasındakine döndürmüyor; masaüstünde nişan yardımı hiç yok.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180';
const tag = process.argv[3] || 'now';
const OUT = `/tmp/wb-mob-shots/${tag}`;
fs.mkdirSync(OUT, { recursive: true });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = {
  iphone14: strip(devices['iPhone 14 Pro Max landscape']),
  iphone13: strip(devices['iPhone 13 landscape']),
  pixel7: strip(devices['Pixel 7 landscape']),
  small: { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 8 landscape'].userAgent },
  desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 },
};
const want = (process.env.DEV || 'iphone14,iphone13,pixel7,small,desktop').split(',');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const part = (k) => !only || only.includes(k);
let fail = 0; const report = [];
const check = (ok, msg) => { const l = (ok ? 'OK    ' : 'HATA  ') + msg; console.log(l); report.push(l); if (!ok) fail++; };
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// Görünen etkileşimli öğeler: küçük hedef + ekran dışına taşma (yatay kaydırmalı kapsayıcının içindekiler hariç)
const AUDIT = (rootSel) => {
  const vw = innerWidth, vh = innerHeight, small = [], over = [];
  const root = document.querySelector(rootSel) || document.body;
  const vis = (e) => { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity === 0) return false; for (let x = e; x; x = x.parentElement) if (getComputedStyle(x).display === 'none') return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const scroller = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (/(auto|scroll)/.test(cs.overflowX + cs.overflowY) && (x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1)) return x; } return null; };
  const name = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '')) + ' "' + (e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"';
  for (const e of root.querySelectorAll('button,input,select,[data-a],.cc,#tc .b,.slot,a[href]')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect(), sc = scroller(e);
    if (sc) { const sr = sc.getBoundingClientRect(); if (r.bottom < sr.top || r.top > sr.bottom || r.right < sr.left || r.left > sr.right) continue; }   // kaydırılınca görünür
    if (Math.min(r.width, r.height) < 39.5 && e.type !== 'checkbox') small.push(`${name(e)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (!sc && (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 || r.top < -1)) over.push(`${name(e)} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
  }
  const de = document.documentElement;
  return { small, over, pageScroll: de.scrollWidth > vw + 1 || de.scrollHeight > vh + 1 ? `${de.scrollWidth}x${de.scrollHeight}` : '' };
};

for (const dk of want) {
  const D = DEVS[dk]; if (!D) continue;
  const mob = dk !== 'desktop';
  const ctx = await browser.newContext({ ...D });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(false, `${dk}: sayfa hatası ${e.message}`));
  page.on('console', (m) => { if (m.text().startsWith('[[')) console.log('  konsol', m.text().slice(0, 900)); });
  const shot = async (n, opts = {}) => { await page.screenshot({ path: `${OUT}/${dk}-${n}.png`, scale: opts.full ? 'device' : 'css' }); };
  const tap = async (sel) => {
    const L = page.locator(sel).first(); await L.scrollIntoViewIfNeeded().catch(() => {});
    const b = await L.boundingBox(); if (!b) throw new Error('yok: ' + sel);
    if (mob) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(350);
  };
  const audit = async (n, root) => {
    const a = await page.evaluate(AUDIT, root);
    if (mob) check(!a.small.length, `${dk} ${n}: dokunma hedefleri ≥ 40 px${a.small.length ? ' — küçük: ' + a.small.slice(0, 8).join(' | ') + (a.small.length > 8 ? ` (+${a.small.length - 8})` : '') : ''}`);
    check(!a.over.length && !a.pageScroll, `${dk} ${n}: ekrandan taşan öğe yok${a.over.length ? ' — ' + a.over.slice(0, 6).join(' | ') : ''}${a.pageScroll ? ' sayfa ' + a.pageScroll : ''}`);
  };
  const q = mob ? '&touch=1' : '&touch=0';

  // ── ana menü ve sekmeleri ──
  if (part('menu')) {
    await page.goto(base + '/?debug=1' + q);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('warbyte.acct', JSON.stringify({ kind: 'guest' })); });      // misafir oturumu: giriş kartı açılmasın
    await page.goto(base + '/?debug=1' + q);
    await page.waitForSelector('.mn-nav', { timeout: 60000 }); await page.waitForTimeout(1500);
    for (const [k, n] of [['home', 'menu-ana'], ['custom', 'menu-ozel'], ['online', 'menu-cevrimici'], ['loadout', 'menu-sinif'], ['settings', 'menu-ayarlar'], ['controls', 'menu-kontroller'], ['editor', 'menu-editor']]) {
      await tap(`.mn-nav[data-v=${k}]`); await page.waitForTimeout(k === 'loadout' ? 1500 : 500);
      await shot(n); await audit(n, '#menu');
      if (k === 'custom') {           // özel oyun: aşağı kaydır (ayarlar bölümü)
        await page.evaluate(() => { const s = document.querySelector('#menu .scroll'); if (s) s.scrollTop = s.scrollHeight; }); await page.waitForTimeout(300); await shot(n + '-alt');
      }
    }
    await tap('.mn-nav[data-v=home]');
  }

  // ── oyun (menüden Hızlı Oyun: gerçek tercihlerle) ──
  if (part('game')) {
    await page.goto(base + '/?debug=1' + q);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('warbyte.acct', JSON.stringify({ kind: 'guest' })); localStorage.setItem('warbyte.v2', JSON.stringify({ map: 'colgecidi', type: 'tdm', perTeam: 4, tod: 'day', weather: 'clear', third: true, optic: 'reddot' })); });
    await page.goto(base + '/?debug=1' + q);
    await page.waitForSelector('.mn-nav', { timeout: 60000 });
    await tap('[data-a=quick]');
    await page.waitForFunction(() => window.__game && document.getElementById('bResume') && document.getElementById('pause').style.display === 'flex', null, { timeout: 90000 });
    await page.waitForTimeout(800);
    await shot('hazir-misin'); await audit('hazir-misin', '#pause');
    if (!mob) await page.evaluate(() => { window.__game.noPointerLock = true; });      // test tarayıcısında fare kilidi yok
    await tap('#bResume'); await page.waitForTimeout(2500);
    const info = await page.evaluate(() => {
      const g = window.__game, c = g.camera, r = g.renderer;
      const hf = 2 * Math.atan(Math.tan(c.fov * Math.PI / 360) * c.aspect) * 180 / Math.PI;
      return { vfov: c.fov, hfov: hf, pr: g._perf?.max || r.getPixelRatio(), dpr: devicePixelRatio, shadows: r.shadowMap.enabled, touch: !!g.player.touch, aa: g.player.touch?.cfg?.aim };
    });
    console.log(`  ${dk}: dikey FOV ${info.vfov.toFixed(1)}° · yatay ${info.hfov.toFixed(1)}° · çözünürlük ${info.pr} / DPR ${info.dpr} · gölge ${info.shadows}`);
    if (mob) {
      check(info.touch, `${dk}: dokunmatik kontroller açık`);
      check(info.hfov <= 100, `${dk}: yatay FOV makul (${info.hfov.toFixed(0)}° ≤ 100°)`);
      check(info.pr >= Math.min(2, info.dpr) - 0.01, `${dk}: çözünürlük keskin (${info.pr}× ≥ ${Math.min(2, info.dpr)}×)`);
    } else {
      check(!info.touch, `${dk}: masaüstünde dokunmatik yok`);
      check(Math.abs(info.vfov - 75) < 0.5, `${dk}: masaüstü FOV değişmedi (${info.vfov.toFixed(1)}°)`);
    }
    // botları dondur, oyuncunun önüne açık görüşlü bir düşman koy
    const setup = await page.evaluate(() => {
      const g = window.__game, me = g.playerSoldier, T = window.THREE_V || null;
      g.brainsOff = g.brains.splice(0);
      for (const s of g.soldiers) if (s !== me) { s.vel.set(0, 0, 0); s.pos.set(9999, -50, 9999); }
      const foe = g.soldiers.find((s) => s.team !== me.team && s.alive);
      window.__foe = foe;
      const E = me.eye().clone ? me.eye() : null;
      // açık alan ara: oyuncu konumundan 30 m düz görüş
      const tryPlace = (d) => {
        for (let k = 0; k < 600; k++) {
          const a = Math.random() * Math.PI * 2, e = me.eye();
          const x = e.x - Math.sin(a) * d, z = e.z - Math.cos(a) * d;
          if (!g.nav.isFree(x, z)) continue;
          const y = g.world.heightAt(x, z);
          if (Math.abs(y - me.pos.y) > 1.2) continue;
          foe.pos.set(x, y, z); foe.vel.set(0, 0, 0);
          const c = foe.center(e.clone()), h = foe.eye(e.clone());
          if (!g.losClear(me.eye(), c) || !g.losClear(me.eye(), h)) continue;
          me.yaw = a; me.pitch = Math.atan2(c.y - me.eye().y, d); return true;
        }
        return false;
      };
      let ok = false;
      for (let t = 0; t < 40 && !ok; t++) {      // oyuncuyu da rastgele açık bir noktaya taşı
        const sp = g.map.spawns[me.team][t % g.map.spawns[me.team].length];
        if (t > 0) { const x = sp.x + (Math.random() - 0.5) * 20, z = sp.z + (Math.random() - 0.5) * 20; if (!g.nav.isFree(x, z)) continue; me.pos.set(x, g.world.heightAt(x, z), z); }
        ok = tryPlace(25);
      }
      return ok;
    });
    check(setup, `${dk}: düşman 25 m'ye yerleştirildi`);
    await page.waitForTimeout(700);
    await shot('hud'); await shot('hud-hd', { full: true }); await audit('hud', '#tc');
    // düşmanın ekrandaki boyu (px)
    const foeH = await page.evaluate(() => {
      const g = window.__game, f = window.__foe, c = g.camera, a = f.pos.clone(), b = f.pos.clone(); b.y += f.height || 1.8;
      a.project(c); b.project(c); return Math.abs(b.y - a.y) / 2 * innerHeight;
    });
    console.log(`  ${dk}: 25 m'deki düşman ekranda ${foeH.toFixed(0)} px boyunda (ekran ${D.viewport.height} px)`);
    // nişangâhlar: her nişangâhta ADS
    const OPT = [['m4a1', 'iron'], ['m4a1', 'reddot'], ['m4a1', 'holo'], ['m4a1', 'acog'], ['sniper', 'scope'], ['barrett', 'scope6']];
    for (const [w, o] of OPT) {
      await page.evaluate(([w, o]) => {
        const g = window.__game, s = g.playerSoldier, P = g.player;
        s.items[0] = { id: w, mag: 30, reserve: 90 }; s.cur = 0; s.reloadT = 0; s.switchT = 0;
        s.optic = o; s.model.optic = o; s._syncWeaponModel(true); P.refreshWeapon(); s.ads = true;
      }, [w, o]);
      await page.waitForTimeout(1100);
      await shot(`ads-${o}`);
      const ov = await page.evaluate(() => {
        const hud = document.getElementById('hud'), q = (id) => hud.querySelector('#' + id), r = (e) => e.getBoundingClientRect();
        const g = window.__game, s = g.playerSoldier;
        const out = { ov: s.overlay, adsT: s.adsT, vw: innerWidth, vh: innerHeight };
        const sc = q('scope'); if (getComputedStyle(sc).display !== 'none') { const a = r(sc), rg = r(sc.querySelector('.rg')); out.scope = { w: a.width, h: a.height, rg: rg.width, cx: rg.left + rg.width / 2, cy: rg.top + rg.height / 2 }; }
        for (const id of ['rdot', 'holo']) { const e = q(id); if (getComputedStyle(e).display !== 'none') { const a = r(e); out[id] = { w: a.width, cx: a.left + a.width / 2, cy: a.top + a.height / 2 }; } }
        return out;
      });
      if (o.startsWith('scope') || o === 'acog') {
        const s = ov.scope;
        check(s && s.w >= ov.vw - 1 && s.h >= ov.vh - 1 && Math.abs(s.cx - ov.vw / 2) < 2 && Math.abs(s.cy - ov.vh / 2) < 2, `${dk} ${o}: dürbün örtüsü ekranı kaplıyor ve ortalı${s ? ` (${Math.round(s.w)}x${Math.round(s.h)}, halka ${Math.round(s.rg)} px)` : ' — YOK'}`);
        if (s && mob) check(s.rg >= ov.vh * 0.8, `${dk} ${o}: dürbün halkası küçük ekranda yeterince büyük (${Math.round(s.rg)} ≥ ${Math.round(ov.vh * 0.8)} px)`);
      }
      for (const id of ['rdot', 'holo']) if (ov[id]) check(Math.abs(ov[id].cx - ov.vw / 2) < 1.5 && Math.abs(ov[id].cy - ov.vh / 2) < 1.5, `${dk} ${o}: #${id} ekran ortasında (${ov[id].cx.toFixed(1)}, ${ov[id].cy.toFixed(1)}) · ${ov[id].w.toFixed(0)} px`);
      await page.evaluate(() => { window.__game.playerSoldier.ads = false; });
    }
    await page.evaluate(() => { const g = window.__game, s = g.playerSoldier; s.items[0] = { id: 'm4a1', mag: 30, reserve: 90 }; s.optic = 'reddot'; s.model.optic = 'reddot'; s._syncWeaponModel(true); g.player.refreshWeapon(); });
    // ── nişan yardımı: görünür düşmana doğru döndürür, duvar arkasındakine döndürmez; masaüstünde hiç yok ──
    const aa = await page.evaluate(async () => {
      const g = window.__game, me = g.playerSoldier, f = window.__foe, P = g.player;
      const ang = () => { const e = me.eye(), c = f.center(e.clone()); const ty = Math.atan2(-(c.x - e.x), -(c.z - e.z)); let d = ty - me.yaw; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; return d; };
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const run = async (on = true) => {   // hedefin 3° yanına bak, nişan al (ADS: geri tepme / hareket yok) 0,6 sn
        const T = P.touch; if (T) T.cfg.aim = on;
        me.ads = false; await wait(300);
        const a0 = ang(); me.yaw += a0 + 0.052; const before = Math.abs(ang());
        me.ads = true; await wait(600); me.ads = false;
        if (T) T.cfg.aim = true;
        return { before, after: Math.abs(ang()) };
      };
      const off = P.touch ? await run(false) : null;
      const vis = await run();
      // aynı düşmanı duvar arkasına al: oyuncudan 6-25 m, görüş kapalı, açısı ekranda yakın
      let hidden = null;
      for (let k = 0; k < 4000 && !hidden; k++) {
        const a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 20, e = me.eye();
        const x = e.x - Math.sin(a) * d, z = e.z - Math.cos(a) * d;
        if (!g.nav.isFree(x, z)) continue;
        f.pos.set(x, g.world.heightAt(x, z), z);
        const c = f.center(e.clone()), h = f.eye(e.clone());
        if (g.world.clear(e, c) || g.world.clear(e, h) || g.world.clear(e, f.pos.clone().setY(f.pos.y + 0.3))) continue;
        me.yaw = a; me.pitch = Math.atan2(c.y - e.y, d); hidden = d;
      }
      const hid = hidden ? await run() : null;
      return { vis, hid, hidden, off };
    });
    const mv = aa.vis.before - aa.vis.after;
    console.log(`  ${dk}: nişan yardımı görünür: ${(aa.vis.before * 57.3).toFixed(2)}° → ${(aa.vis.after * 57.3).toFixed(2)}°${aa.hid ? ` · duvar arkası (${aa.hidden.toFixed(0)} m): ${(aa.hid.before * 57.3).toFixed(2)}° → ${(aa.hid.after * 57.3).toFixed(2)}°` : ''}`);
    if (mob) {
      check(mv > 0.25 * aa.vis.before && aa.vis.after > 0.0005, `${dk}: nişan yardımı görünür düşmana yumuşakça çekiyor (kilitlemeden)`);
      check(aa.off && Math.abs(aa.off.before - aa.off.after) < 0.002, `${dk}: nişan yardımı kapalıyken bakış hiç değişmiyor`);
      check(aa.hid && Math.abs(aa.hid.before - aa.hid.after) < 0.002, `${dk}: nişan yardımı duvar arkasındaki düşmana çekmiyor`);
    } else check(Math.abs(mv) < 0.002, `${dk}: masaüstünde nişan yardımı yok (fark ${(mv * 57.3).toFixed(3)}°)`);
    // FPS / kare süresi (yazılımsal GL: yalnız göreli karşılaştırma)
    await page.evaluate(() => { window.__game.brains.push(...window.__game.brainsOff); for (const s of window.__game.soldiers) if (s.pos.y < -10) s.respawnT = 0; });
    const perf = await page.evaluate(async () => { const t0 = performance.now(); let n = 0; await new Promise((r) => { const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); const g = window.__game; return { fps: n / 3, pr: g.renderer.getPixelRatio(), calls: g.renderer.info.render.calls }; });
    console.log(`  ${dk}: ~${perf.fps.toFixed(1)} FPS (swiftshader) · çözünürlük ${perf.pr.toFixed(2)}× · ${perf.calls} çizim çağrısı`);
    // bildirimler, öldürme akışı, isabet sayıları
    await page.evaluate(() => {
      const g = window.__game, me = g.playerSoldier, f = window.__foe;
      g.hud.toast('Bayrak üstünlüğün var: rakip bileti azalıyor', '#9fe6a8'); g.hud.toast('Dokunmatik ayarlar kaydedildi', '#9fe6a8');
      for (let i = 0; i < 4; i++) g.hud.killFeed(i % 2 ? f : me, i % 2 ? me : f, 'M4A1', i === 0);
    });
    await page.waitForTimeout(400); await shot('bildirim');
    // skor tablosu
    await page.evaluate(() => window.__game.hud.showScoreboard(true)); await page.waitForTimeout(300);
    await shot('skor'); await audit('skor', '#scoreboard');
    await page.evaluate(() => window.__game.hud.showScoreboard(false));
    // duraklat + oyun içi ayarlar + dokunmatik ayarlar
    if (mob) await tap('#tc [data-b=pause]'); else await page.evaluate(() => window.__game.togglePause());
    await page.waitForTimeout(400); await shot('duraklat'); await audit('duraklat', '#pause');
    await tap('#bSet'); await shot('oyun-ayarlar'); await audit('oyun-ayarlar', '#igs');
    await page.evaluate(() => { const s = document.querySelector('#igs .sc'); s.scrollTop = s.scrollHeight; }); await page.waitForTimeout(200); await shot('oyun-ayarlar-alt');
    await tap('#igs .tab[data-tab=controls]'); await shot('oyun-kontroller'); await audit('oyun-kontroller', '#igs');
    await tap('#igs .x');
    if (mob) {
      await tap('#bTouch'); await shot('dokunmatik-duzen'); await audit('dokunmatik-duzen', '#tcEd');
      await tap('#tcEd [data-tab=sens]'); await shot('dokunmatik-hassasiyet'); await audit('dokunmatik-hassasiyet', '#tcEd');
      const hasAim = await page.evaluate(() => !!document.querySelector('#tcEd [data-set=aim]'));
      check(hasAim, `${dk}: Hassasiyet sekmesinde nişan yardımı seçeneği var`);
      await tap('#tcEd [data-act=cancel]');
      check(await page.evaluate(() => !document.getElementById('tc').classList.contains('edit')), `${dk}: dokunmatik ayarlar İptal ile kapandı`);
    }
    await tap('#bResume'); await page.waitForTimeout(400);
    // ölüm ekranı
    await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; me.prot = 0; me.takeDamage(9999, window.__foe, 'body', window.__foe.pos, 'M4A1'); });
    await page.waitForTimeout(2600); check(await page.evaluate(() => getComputedStyle(document.getElementById('respawn')).display !== 'none'), `${dk}: ölüm ekranı görünüyor`); await shot('olum'); await audit('olum', '#respawn');
    // maç sonu
    await page.evaluate(() => { const g = window.__game; g.ended = true; g.running = false; g.showEndScreen('blue', 'Mavi takım 40 skora ulaştı'); });
    await page.waitForTimeout(600); await shot('mac-sonu'); await audit('mac-sonu', '#endscreen');
  }

  // ── çevrimiçi (yalnız ONLY=online ile; sunucu BF_DEBUG=1 + WS ortam değişkeni): sohbet konumu + nişan yardımı sunucu odasında ──
  if (only && only.includes('online') && mob) {
    const WS = process.env.WS || 'ws://127.0.0.1:8787';
    await page.goto(base + `/?online=new&type=tdm&per=3&map=colgecidi&debug=1${q}&server=${WS}&name=Tel&team=blue`);
    await page.waitForFunction(() => window.__game && window.__game.running && window.__game.online, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    if (await page.locator('#bResume').isVisible()) await tap('#bResume');
    await page.evaluate(() => window.__game.online.send({ t: 'dbg', bots: false }));
    await page.waitForTimeout(1200);
    // sunucu botları yürür (dbg bots:false onları durdurmuyor): görünen bir düşman bota 12-24 m'den bakılan noktaya ışınlan, 3° yana bak,
    // nişana gir; ölçüm, yardımın seçtiği hedefe olan açıyla (ilk kare → 0,7 sn sonra). Hedef yürüyüp kaçabildiği için en çok 4 deneme.
    let okOnline = false, tries = 0;
    for (; tries < 4 && !okOnline; tries++) {
      const spot = await page.evaluate(() => {
        const g = window.__game, me = g.playerSoldier;
        for (const f of g.soldiers.filter((s) => s.team !== me.team && s.alive)) {
          for (let k = 0; k < 800; k++) {
            const a = Math.random() * Math.PI * 2, d = 12 + Math.random() * 12, x = f.pos.x + Math.sin(a) * d, z = f.pos.z + Math.cos(a) * d;
            if (!g.nav.isFree(x, z)) continue;
            const y = g.world.heightAt(x, z), c = f.center(me.eye().clone());
            if (Math.abs(y - f.pos.y) > 1 || !g.botSees(me.eye().clone().set(x, y + 1.6, z), c)) continue;
            window.__foe = f; return [x, z];
          }
        }
        return null;
      });
      if (!spot) continue;
      await page.evaluate((sp) => window.__game.online.send({ t: 'dbg', tp: sp }), spot);
      await page.waitForTimeout(1500);
      const r = await page.evaluate(async () => {
        const g = window.__game, me = g.playerSoldier, f = window.__foe, T = g.player.touch;
        const angTo = (o) => { const e = me.eye(), c = o.center(e.clone()); let d = Math.atan2(-(c.x - e.x), -(c.z - e.z)) - me.yaw; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; return d; };
        const e = me.eye(), c = f.center(e.clone()); me.pitch = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z));
        me.yaw += angTo(f) + 0.052;
        let tgt = null, e0 = 0, run = true; T._aaT = null;
        const tick = () => { if (!tgt && T._aaT) { tgt = T._aaT.o; e0 = Math.abs(angTo(tgt)); } if (run) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
        me.ads = true; await new Promise((res) => setTimeout(res, 700)); me.ads = false; run = false;
        return tgt ? { before: e0, after: Math.abs(angTo(tgt)), same: tgt === f, d: Math.hypot(tgt.pos.x - me.pos.x, tgt.pos.z - me.pos.z) } : null;
      });
      console.log(`  ${dk} çevrimiçi deneme ${tries + 1}: ${r ? `${(r.before * 57.3).toFixed(2)}° → ${(r.after * 57.3).toFixed(2)}° (${r.same ? 'yerleştirilen bot' : 'başka bot'}, ${r.d.toFixed(1)} m)` : 'hedef seçilmedi'}`);
      okOnline = !!r && r.after < r.before * 0.75 && r.after > 0.0002;
    }
    check(okOnline, `${dk} çevrimiçi: nişan yardımı sunucu odasında da çalışıyor (${tries} deneme)`);
    await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 4; i++) g.chat.add({ name: i % 2 ? 'Rakip' : 'Tel', team: i % 2 ? 'red' : 'blue', m: 'gg, B sahasına geliyorum ' + i }); g.chat.add({ sys: 1, m: 'Rakip odaya katıldı' }); });
    await page.waitForTimeout(400); await shot('cevrimici-sohbet');
    const ov = await page.evaluate(() => {      // sohbet kutusu joystick / butonlarla çakışıyor mu
      const hit = []; for (const id of ['chlog', 'roombadge']) { const r = document.getElementById(id).getBoundingClientRect();
      for (const b of document.querySelectorAll('#tc .b:not(.hid),#tc .jb')) { const q = b.getBoundingClientRect(); if (q.width && r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top) hit.push(id + '/' + b.dataset.k); } }
      return hit;
    });
    check(!ov.length, `${dk} çevrimiçi: sohbet ve oda rozeti kontrollerle çakışmıyor${ov.length ? ' — ' + ov.join(', ') : ''}`);
  }

  // ── enfeksiyon modu HUD'u ──
  if (part('inf')) {
    await page.goto(base + `/?autostart=6v6&map=newyork&type=inf&debug=1${q}`);
    await page.waitForFunction(() => window.__game && document.getElementById('bResume'), null, { timeout: 90000 });
    await page.waitForTimeout(800);
    if (!mob) await page.evaluate(() => { window.__game.noPointerLock = true; });
    await tap('#bResume'); await page.waitForTimeout(6000);
    await shot('enfeksiyon'); await audit('enfeksiyon', '#tc');
    if (mob) {
      const hit = await page.evaluate(() => {        // durum mesajı (#msg) butonların üstüne binmesin
        const m = document.getElementById('msg'), r = m.getBoundingClientRect(), out = [];
        if (!m.textContent.trim()) return ['(mesaj yok)'];
        for (const b of document.querySelectorAll('#tc .b:not(.hid),#tc .jb')) { const q = b.getBoundingClientRect(); if (q.width && r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top) out.push(b.dataset.k); }
        return out;
      });
      check(!hit.length, `${dk} enfeksiyon: durum mesajı butonlarla çakışmıyor${hit.length ? ' — ' + hit.join(', ') : ''}`);
    }
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/rapor.txt`, report.join('\n') + '\n');
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
