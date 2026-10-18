// Mobil nişangâh / görüntü testi: telefon öykünmesinde (gerçek DPR + dokunma) nişangâh değiştirme, nişangâh boyutu, çözünürlük, düşman boyu.
//   node scripts/mobileoptics.mjs [url=http://127.0.0.1:5180] [etiket=now]      → /tmp/wb-mo2-shots/<etiket>/<cihaz>-*.png + rapor.txt
//   DEV=iphone14,pixel7,desktop ile cihaz süzülür. WS=ws://127.0.0.1:8787 (sunucu BF_DEBUG=1) verilirse çevrimiçi adım da çalışır.
// Denetimler: (1) nişangâh butonu yalnız birden çok nişangâhlı silahta görünür; GERÇEK dokunuşla (touchscreen.tap) buton → kart → s.opticId
// değişir (çok nişangâhlı her silahta her nişangâh); dışarı dokununca seçici kapanır; çevrimiçinde sunucudaki nişangâh da değişir (dbg ask).
// (2) çözünürlük: ağır yükte (swiftshader) otomatik çözünürlüğün tabanı, MSAA, düşmanın 25 / 50 m'de ekrandaki boyu (CSS ve fiziksel px).
// (3) nişangâh ölçüsü (px): red dot, holo halkası / çizgi kalınlığı, demir nişan noktası, dürbün çizgileri. Masaüstünde değişmemeli.
import { chromium, devices } from 'playwright';
import WebSocket from 'ws';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180';
const tag = process.argv[3] || 'now';
const OUT = `${process.env.OUT || "/tmp/wb-mo2-shots"}/${tag}`;
fs.mkdirSync(OUT, { recursive: true });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = {
  iphone14: strip(devices['iPhone 14 Pro Max landscape']),
  iphone13: strip(devices['iPhone 13 landscape']),
  pixel7: strip(devices['Pixel 7 landscape']),
  desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 },
};
const want = (process.env.DEV || 'iphone14,pixel7,desktop').split(',');
let fail = 0; const report = [];
const log = (l) => { console.log(l); report.push(l); };
const check = (ok, msg) => { log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// oyuncunun önüne d m'de açık görüşlü düşman koy (botlar donuk)
const PLACE = (d) => {
  const g = window.__game, me = g.playerSoldier, foe = window.__foe;
  const tryPlace = () => {
    for (let k = 0; k < 800; k++) {
      const a = Math.random() * Math.PI * 2, e = me.eye();
      const x = e.x - Math.sin(a) * d, z = e.z - Math.cos(a) * d;
      if (!g.nav.isFree(x, z)) continue;
      const y = g.world.heightAt(x, z);
      if (Math.abs(y - me.pos.y) > 1.2) continue;
      foe.pos.set(x, y, z); foe.vel.set(0, 0, 0); foe.yaw = a;
      const c = foe.center(e.clone()), h = foe.eye(e.clone());
      if (!g.losClear(me.eye(), c) || !g.losClear(me.eye(), h) || !g.losClear(me.eye(), foe.pos.clone().setY(y + 0.2))) continue;
      me.yaw = a; me.pitch = Math.atan2(c.y - me.eye().y, d); return true;
    }
    return false;
  };
  for (let t = 0; t < 60; t++) {
    const sp = g.map.spawns[me.team][t % g.map.spawns[me.team].length];
    if (t > 0) { const x = sp.x + (Math.random() - 0.5) * 30, z = sp.z + (Math.random() - 0.5) * 30; if (!g.nav.isFree(x, z)) continue; me.pos.set(x, g.world.heightAt(x, z), z); me.vel.set(0, 0, 0); }
    if (tryPlace()) return true;
  }
  return false;
};
const FOEPX = () => {
  const g = window.__game, f = window.__foe, c = g.camera, a = f.pos.clone(), b = f.pos.clone(); b.y += f.height || 1.8;
  a.project(c); b.project(c); const css = Math.abs(b.y - a.y) / 2 * innerHeight;
  return { css, phys: css * g.renderer.getPixelRatio(), sx: (a.x + 1) / 2 * innerWidth, sy: (1 - (a.y + b.y) / 2) / 2 * innerHeight };
};
// nişangâh öğelerinin ölçüsü (görünenler)
const RET = () => {
  const out = {}, vis = (e) => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
  const r = (e) => e.getBoundingClientRect();
  const rd = document.getElementById('rdot'); if (vis(rd)) out.rdot = +r(rd).width.toFixed(1);
  const ho = document.getElementById('holo'); if (vis(ho)) { out.holo = +r(ho).width.toFixed(1); out.holoLine = +(parseFloat(getComputedStyle(ho).borderTopWidth) * (r(ho).width / ho.offsetWidth)).toFixed(2); }
  const id = document.getElementById('idot'); if (vis(id)) out.idot = +r(id).width.toFixed(1);
  const sc = document.getElementById('scope');
  if (vis(sc)) { const sv = [...sc.querySelectorAll('svg')].find(vis); if (sv) { const u = r(sv).width / 200, p = sv.querySelector('path'); out.scope = sc.className; out.scopeThin = +(parseFloat(getComputedStyle(p).strokeWidth) * u).toFixed(2); out.scopeSvg = Math.round(r(sv).width); } }
  return out;
};

for (const dk of want) {
  const D = DEVS[dk]; if (!D) continue;
  const mob = dk !== 'desktop';
  const ctx = await browser.newContext({ ...D });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(false, `${dk}: sayfa hatası ${e.message}`));
  const shot = (n, clip) => page.screenshot({ path: `${OUT}/${dk}-${n}.png`, scale: clip ? 'device' : 'css', ...(clip ? { clip } : {}) });
  const tapXY = async (x, y) => { if (mob) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await page.waitForTimeout(300); };
  const tap = async (sel) => { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('yok: ' + sel + ' ' + JSON.stringify(await page.evaluate(() => { const g = window.__game; return { tc: document.getElementById('tc')?.className, alive: g.playerSoldier.alive, hp: g.playerSoldier.hp, locked: g.player.locked, sim: g.simulate, ended: g.ended }; }))); await tapXY(b.x + b.width / 2, b.y + b.height / 2); };
  const q = mob ? '&touch=1' : '&touch=0';
  await page.goto(base + '/?debug=1' + q); await page.evaluate(() => localStorage.clear());
  await page.goto(base + `/?autostart=4v4&map=colgecidi&type=tdm&shadows=0&debug=1${q}`);
  await page.waitForFunction(() => window.__game && document.getElementById('bResume') && document.getElementById('pause').style.display === 'flex', null, { timeout: 90000 });
  await page.waitForTimeout(600);
  if (!mob) await page.evaluate(() => { window.__game.noPointerLock = true; });
  await tap('#bResume'); await page.waitForTimeout(800);

  // ── (2a) otomatik çözünürlük: ağır yükte (yazılımsal GL, ~5-15 FPS) en çok nereye kadar düşüyor ──
  const gl = await page.evaluate(() => { const r = window.__game.renderer, c = r.getContext(), a = c.getContextAttributes(); return { aa: a.antialias, samples: c.getParameter(c.SAMPLES), dpr: devicePixelRatio, pr0: r.getPixelRatio(), fov: window.__game.camera.fov }; });
  const prs = [];
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(1000); prs.push(await page.evaluate(() => +window.__game.renderer.getPixelRatio().toFixed(3))); }
  const fps = await page.evaluate(() => window.__game._perf?.fps || 0);
  log(`  ${dk}: DPR ${gl.dpr} · başlangıç çözünürlüğü ${gl.pr0}× · MSAA ${gl.aa} (${gl.samples} örnek) · dikey FOV ${gl.fov.toFixed(1)}° · gerçek yük (swiftshader ~${fps.toFixed(1)} FPS) 6 sn: ${prs.join(' → ')}`);
  check(gl.aa && gl.samples >= 2, `${dk}: kenar yumuşatma (MSAA) açık`);
  // otomatik çözünürlük benzetimi (Game.perfTick'e yapay kare süresi): sabit 34 FPS 40 sn → 20 FPS 30 sn → 60 FPS 40 sn
  const sim = await page.evaluate(() => {
    const g = window.__game, real = Object.getPrototypeOf(g).perfTick, out = [];
    g.perfTick = () => {}; g._perf = null; g.renderer.setPixelRatio(Math.min(devicePixelRatio, g.settings.pixelRatio || 1.5));
    for (const [fps, sec] of [[34, 40], [20, 30], [60, 40]]) {
      const tr = [];
      for (let i = 0; i < fps * sec; i++) { real.call(g, 0, 1 / fps); const r = +g.renderer.getPixelRatio().toFixed(3); if (tr[tr.length - 1] !== r) tr.push(r); }
      out.push({ fps, sec, tr });
    }
    delete g.perfTick;
    return out;
  });
  for (const x of sim) log(`  ${dk}: benzetim ${x.fps} FPS ${x.sec} sn: ${x.tr.join(' → ')}`);
  const floor = sim[0].tr[sim[0].tr.length - 1];
  if (mob) {
    check(floor >= Math.min(gl.pr0, gl.dpr >= 2 ? 1.25 : 1) - 0.01, `${dk}: 34 FPS'te çözünürlük tabanı ${floor}× (DPR≥2'de ≥ 1,25×)`);
    check(sim[1].tr[sim[1].tr.length - 1] >= 0.99, `${dk}: 20 FPS'te bile ≥ 1× (${sim[1].tr[sim[1].tr.length - 1]}×)`);
    check(sim[2].tr[sim[2].tr.length - 1] >= gl.pr0 - 0.01, `${dk}: 60 FPS'te en yükseğe geri döndü (${sim[2].tr[sim[2].tr.length - 1]}×)`);
  }
  log(`  ${dk}: 34 FPS tabanı ${floor}× → ${Math.round(D.viewport.width * floor)}x${Math.round(D.viewport.height * floor)} çizim (ekran ${D.viewport.width * (D.deviceScaleFactor || 1)}x${D.viewport.height * (D.deviceScaleFactor || 1)})`);

  // ── (2b) düşman boyu 25 / 50 m (botlar donuk) + yakın çekim (tam çözünürlükte ve taban çözünürlükte) ──
  await page.evaluate(() => {
    const g = window.__game, me = g.playerSoldier;
    g.brainsOff = g.brains.splice(0);
    for (const s of g.soldiers) if (s !== me) { s.vel.set(0, 0, 0); s.pos.set(9999, -50, 9999); }
    window.__foe = g.soldiers.find((s) => s.team !== me.team && s.alive);
    g.settings.adaptive = false;
  });
  for (const d of [25, 50]) {
    const ok = await page.evaluate(PLACE, d);
    check(ok, `${dk}: düşman ${d} m'ye yerleştirildi`);
    if (!ok) continue;
    for (const [nm, pr] of [['tam', gl.pr0], ['taban', floor]]) {
      await page.evaluate((pr) => { const r = window.__game.renderer; r.setPixelRatio(pr); r.setSize(innerWidth, innerHeight, false); }, pr);
      await page.waitForTimeout(600);
      const fp = await page.evaluate(FOEPX);
      if (nm === 'tam') { log(`  ${dk}: ${d} m'deki düşman ${fp.css.toFixed(1)} CSS px (${fp.phys.toFixed(0)} çizim px @${pr}×)`); await shot(`dusman${d}`); }
      else log(`  ${dk}: ${d} m taban çözünürlükte ${fp.phys.toFixed(0)} çizim px @${pr}×`);
      const S = Math.max(40, fp.css * 2.2);
      await page.evaluate(() => { document.getElementById('cross').style.visibility = 'hidden'; });
      await shot(`dusman${d}-${nm}-yakin`, { x: Math.max(0, fp.sx - S / 2), y: Math.max(0, fp.sy - S / 2), width: S, height: S });
    }
  }
  await page.evaluate((pr) => { const r = window.__game.renderer; r.setPixelRatio(pr); r.setSize(innerWidth, innerHeight, false); document.getElementById('cross').style.visibility = ''; }, gl.pr0);
  await page.evaluate(PLACE, 25);

  // ── (1) nişangâh seçimi: dokunuşla (buton → kart) ──
  const setW = (w, o) => page.evaluate(([w, o]) => {
    const g = window.__game, s = g.playerSoldier, P = g.player;
    s.items[0] = { id: w, mag: 30, reserve: 90 }; s.cur = 0; s.reloadT = 0; s.switchT = 0; s.ads = false; s.hp = s.maxHp;
    if (o) { s.optic = o; s.model.optic = o; } s._syncWeaponModel(true); P.refreshWeapon();
  }, [w, o]);
  const hasBtn = mob && await page.evaluate(() => !!document.querySelector('#tc [data-b=optic]'));
  if (mob && hasBtn) {
    const { ALLOWED, ORDER } = await page.evaluate(async () => { const m = await import('/src/game/stats.js'); return { ALLOWED: m.OPTIC_ALLOWED, ORDER: m.OPTIC_ORDER }; });
    const multi = Object.keys(ALLOWED).filter((w) => ALLOWED[w].length > 1), single = Object.keys(ALLOWED).filter((w) => ALLOWED[w].length < 2);
    const list = dk === 'iphone14' ? multi : ['m4a1', 'pistol', 'ak74u'];
    let nOk = 0, nAll = 0; const bad = [];
    for (const w of list) {
      await setW(w, null); await page.waitForTimeout(150);
      const vis = await page.evaluate(() => { const b = document.querySelector('#tc [data-b=optic]'); return !b.classList.contains('hid') && getComputedStyle(b).display !== 'none'; });
      if (!vis) { bad.push(w + ':buton yok'); continue; }
      for (const o of ALLOWED[w]) {
        if (process.env.VERBOSE) console.log("   ", w, o);
        nAll++;
        await tap('#tc [data-b=optic]');
        const open = await page.evaluate(() => !!document.querySelector('#tcOp.on'));
        if (!open) { bad.push(w + ':seçici açılmadı'); continue; }
        await tap(`#tcOp [data-o=${o}]`);
        const r = await page.evaluate(() => ({ id: window.__game.playerSoldier.opticId, open: !!document.querySelector('#tcOp.on') }));
        if (r.id === o && !r.open) nOk++; else bad.push(`${w}:${o}→${r.id}${r.open ? ' (açık kaldı)' : ''}`);
      }
    }
    check(!bad.length && nOk === nAll, `${dk}: dokunuşla nişangâh değişti ${nOk}/${nAll} (${list.length} silah)${bad.length ? ' — ' + bad.slice(0, 6).join(' | ') : ''}`);
    const hid = [];
    for (const w of single) { await setW(w, null); await page.waitForTimeout(120); if (!(await page.evaluate(() => document.querySelector('#tc [data-b=optic]').classList.contains('hid')))) hid.push(w); }
    check(!hid.length, `${dk}: tek nişangâhlı silahlarda (${single.join(', ')}) buton gizli${hid.length ? ' — görünen: ' + hid.join(', ') : ''}`);
    // dışarı dokununca kapanır, nişangâh değişmez; seçici ekranı
    await setW('m4a1', 'reddot'); await page.waitForTimeout(150);
    await tap('#tc [data-b=optic]'); await page.waitForTimeout(200); await shot('secici');
    const cards = await page.evaluate(() => [...document.querySelectorAll('#tcOp [data-o]')].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    check(cards.length === 4 && cards.every(([w, h]) => w >= 60 && h >= 60), `${dk}: seçici kartları büyük (${cards.map((c) => c.join('x')).join(', ')})`);
    await tapXY(D.viewport.width * 0.5, D.viewport.height * 0.93);
    const after = await page.evaluate(() => ({ id: window.__game.playerSoldier.opticId, open: !!document.querySelector('#tcOp.on') }));
    check(!after.open && after.id === 'reddot', `${dk}: dışarı dokunmak seçiciyi kapattı, nişangâh aynı (${after.id})`);
  } else if (mob) log(`  ${dk}: nişangâh butonu YOK (eski sürüm)`);

  // ── (3) nişangâh ADS görüntüleri ve ölçüleri ──
  for (const [w, o] of [['m4a1', 'iron'], ['m4a1', 'reddot'], ['m4a1', 'holo'], ['m4a1', 'acog'], ['sniper', 'scope']]) {
    await setW(w, o);
    await page.evaluate(() => { window.__game.playerSoldier.ads = true; });
    await page.waitForTimeout(1400);
    const m = await page.evaluate(RET), z = await page.evaluate(() => ({ fov: window.__game.camera.fov, fp: 0 }));
    const fp = await page.evaluate(FOEPX);
    log(`  ${dk} ${o}: ${JSON.stringify(m)} · nişanda FOV ${z.fov.toFixed(1)}° · 25 m düşman ${fp.css.toFixed(0)} px`);
    await shot(`ads-${o}`);
    const S = Math.round(D.viewport.height * 0.5);
    await shot(`ads-${o}-yakin`, { x: D.viewport.width / 2 - S / 2, y: D.viewport.height / 2 - S / 2, width: S, height: S });
    await page.evaluate(() => { window.__game.playerSoldier.ads = false; });
    await page.waitForTimeout(300);
  }
  await setW('m4a1', 'reddot');

  // ── çevrimiçi: dokunuşla seçilen nişangâh sunucuda da geçerli ──
  if (process.env.WS && mob && hasBtn) {
    await page.goto(base + `/?online=new&type=tdm&per=2&map=colgecidi&debug=1${q}&server=${process.env.WS}&name=Tel&team=blue`);
    await page.waitForFunction(() => window.__game && window.__game.running && window.__game.online, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    if (await page.locator('#bResume').isVisible()) await tap('#bResume');
    await page.evaluate(() => { const g = window.__game; g.online.send({ t: 'dbg', bots: false }); window.__dbg = []; g.online.ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.t === 'dbg') window.__dbg.push(m); }); });
    await page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 20000 });
    await page.waitForTimeout(500);
    const ask = async () => { await page.evaluate(() => { window.__dbg.length = 0; window.__game.online.send({ t: 'dbg', ask: 1 }); }); await page.waitForFunction(() => window.__dbg.length, null, { timeout: 4000 }).catch(() => {}); return page.evaluate(() => window.__dbg.pop() || null); };
    const s0 = await ask();
    const w0 = await page.evaluate(() => window.__game.playerSoldier.item.id);
    const ALLOWED = await page.evaluate(async () => (await import('/src/game/stats.js')).OPTIC_ALLOWED);
    const pick = (ALLOWED[w0] || []).filter((o) => o !== (s0 && s0.optic));
    const res = [];
    for (const o of pick.slice(0, 3)) {
      await tap('#tc [data-b=optic]'); await tap(`#tcOp [data-o=${o}]`);
      const cl = await page.evaluate(() => window.__game.playerSoldier.opticId), sv = await ask();
      res.push(`${o}: istemci ${cl} / sunucu ${sv && sv.optic}`);
      check(cl === o && sv && sv.optic === o, `${dk} çevrimiçi (${w0}): dokunuşla ${o} → istemci ${cl}, sunucu ${sv && sv.optic}`);
    }
    if (!pick.length) check(false, `${dk} çevrimiçi: silah ${w0} için seçilecek nişangâh yok`);
    // ikinci istemci (ws): odada bu oyuncu görünüyor mu (yalnız protokol sağlığı)
    const room = await page.evaluate(() => window.__game.online.room || window.__game._badgeCode);
    if (room) {
      const ws = new WebSocket(process.env.WS); const msgs = [];
      await new Promise((r) => ws.on('open', r)); ws.on('message', (d) => msgs.push(JSON.parse(d)));
      ws.send(JSON.stringify({ t: 'join', room, name: 'Gozcu' })); await new Promise((r) => setTimeout(r, 1200));
      check(msgs.some((m) => m.t === 'snap'), `${dk} çevrimiçi: ikinci istemci odaya girip görüntü aldı (${room})`);
      ws.close();
    }
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/rapor.txt`, report.join('\n') + '\n');
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
