// 12.190 PUBG tarzı nişangâhlar: gerçek GPU kareleri + hiza ölçümü (gerçek atış).
//   node scripts/pubgoptics.mjs <çıktı klasörü> [taban url]   DEV=desk|mob  TAG=once|sonra  ONLY=regex (silah:nişangâh)  MODE=shots|align|perf
// shots: her silah × nişangâh bel (adsT 0) ve tam nişan (1) karesi; önde 20 / 50 / 100 m'de düşman (Çöl Geçidi, uzun bakış). Kare: <TAG>-<dev>-<silah>-<nişangâh>-<hip|ads>.png
// align: duvara 20 / 50 / 100 m tam nişanda tek atış (sapma 0, gerçek _shoot → shootRay → isabet noktası), isabetin ekran konumu ile ekran ortası (= retikül nişan noktası;
//        retikül ayrıca ekran görüntüsünden ölçülür: kırmızı / eflatun piksel) arasındaki fark (px ve cm).
// perf: nişanda 240 kare ortalama kare süresi (bel / nişan; ms).
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-qa8/shots', base = process.argv[3] || 'http://127.0.0.1:5198';
const dev = process.env.DEV || 'desk', tag = process.env.TAG || 'now', MODE = process.env.MODE || 'shots';
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
mkdirSync(out, { recursive: true });
const COMBOS = [
  ['m4a1', 'iron'], ['m4a1', 'reddot'], ['m4a1', 'holo'], ['m4a1', 'x2'], ['m4a1', 'x3'], ['m4a1', 'acog'], ['m4a1', 'x6'],
  ['ak47', 'acog'], ['mp5', 'x3'], ['pistol', 'reddot'],
  ['sniper', 'scope'], ['sniper', 'x6'], ['sniper', 'x8'], ['barrett', 'scope6'], ['barrett', 'x8'], ['svd', 'acog'], ['svd', 'x8'],
  ['ww_bolt', 'ww_peep'], ['ww_bolt', 'ww_scout'], ['ww_bolt', 'ww_sc25'], ['ww_bolt', 'ww_sc4'],
];
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
const page = await ctx.newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${dev === 'mob' ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
if (process.env.RC) await page.evaluate(async (k) => (await import('/src/models/skins.js')).setReticleColor(k), process.env.RC);      // RC=green|yellow|cyan: retikül rengi
const setup = await page.evaluate(async ({ COMBOS, MODE }) => {
  const { WSTATS, OPTIC_ALLOWED, OPTICS } = await import('/src/game/stats.js');
  const g = window.__game, p = g.player, s = p.s, V = s.pos.constructor;
  g.brains.forEach((b) => (b.update = () => {}));
  const foes = g.soldiers.filter((o) => o !== s && o.team !== s.team).slice(0, 3);
  g.soldiers.filter((o) => o !== s && !foes.includes(o)).forEach((o) => { o.pos.y = -90; o.syncModel?.(0); });
  g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;
  s.protT = 1e9; for (const f of foes) { f.protT = 0; f.takeDamage = () => {}; }
  const eye = new V(), d = new V();
  const place = (x, y, z, yaw) => { s.pos.set(x, y, z); s.yaw = yaw; s.pitch = 0; s.vel.set(0, 0, 0); s.recoilP = 0; };
  let best = null;
  if (MODE !== 'align') {
    // uzun bakış: ileri ≥ 105 m açık, zemin düz (20 / 50 / 100 m'de düşman ayakta görünsün)
    for (let x = -80; x <= 80; x += 4) for (let z = -80; z <= 80; z += 4) {
      const y = g.world.heightAt(x, z); if (!(y > -5)) continue;
      for (let a = 0; a < 32; a++) {
        const yaw = (a / 32) * Math.PI * 2; eye.set(x, y + 1.6, z); d.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        const h = g.world.raycast(eye, d, 120, {}); const free = h ? h.t : 120; if (free < 105) continue;
        let ok = true; for (const D of [20, 50, 100]) { const hy = g.world.heightAt(x + d.x * D, z + d.z * D); if (!(Math.abs(hy - y) < 2.5)) ok = false; }
        if (!ok) continue;
        const sc = free * 0.01 - Math.hypot(x, z) * 0.005; if (!best || sc > best.sc) best = { x, y, z, yaw, sc, free };
      }
    }
    if (!best) return { err: 'yer yok' };
    place(best.x, best.y, best.z, best.yaw);
    const fw = [-Math.sin(best.yaw), -Math.cos(best.yaw)], rt = [Math.cos(best.yaw), -Math.sin(best.yaw)];
    [[20, 0.9], [50, -1.6], [100, 1.2]].forEach(([D, side], i) => { const e = foes[i]; if (!e) return; e.pos.set(best.x + fw[0] * D + rt[0] * side, 0, best.z + fw[1] * D + rt[1] * side); e.pos.y = g.world.heightAt(e.pos.x, e.pos.z); e.yaw = best.yaw + Math.PI; e.vel?.set(0, 0, 0); e.syncModel?.(0); });
    // nişan noktası 50 m'deki düşmanın göğsü
    const e = foes[1]; if (e) { const dx = e.pos.x - best.x, dz = e.pos.z - best.z, dy = e.pos.y + 1.25 - (best.y + s.eyeY); s.yaw = Math.atan2(-dx, -dz); s.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }
  }
  if (MODE === 'align') for (const f of foes) { f.pos.y = -90; f.syncModel?.(0); }
  window.__foes = foes;
  const hudEls = [...document.body.children].filter((e) => e !== g.canvas && !e.contains(g.canvas));
  window.__hud = (show) => {
    for (const e of hudEls) e.style.visibility = 'hidden';
    const h = document.getElementById('hud');
    if (h) { h.style.visibility = 'visible'; for (const c of h.querySelectorAll(':scope > *')) c.style.visibility = show && /^(rdot|holo|scope|idot|cross|scopeblk|advig|lens|breath|pbret)$/.test(c.id) ? 'visible' : 'hidden'; }
  };
  window.__pose = (o) => {
    o = { ...o };
    const SL = WSTATS[o.id].slot === 'secondary' ? 1 : 0;
    s.cur = SL; s.items[SL] = { id: o.id, mag: 30, reserve: 90 }; s.optic = o.optic; s.optics = { ...(s.optics || {}), [o.id]: o.optic }; if (s.model) s.model.optic = o.optic;
    p.refreshWeapon();
    const vm = p.vm; vm.noSway = true; vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0; vm.breathT = 0; vm.sx = 0; vm.sy = 0;
    s.swing = null; s.reloadT = 0; s.cd = 0; s.switchT = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0; s.recoilP = 0; s.leanT = 0; s.ads = o.t > 0.5;
    p.breath?.reset?.();
    const side = o.t < 0; if (side) o = { ...o, t: 0 };
    for (let i = 0; i < 70; i++) { s.adsT = o.t; if (side) vm.inspectT = 0.24; p.update(1 / 60); for (const f of foes) f.syncModel?.(1 / 60); }
    for (let i = 0; i < 24; i++) g.hud.update(1 / 60);
    window.__hud(true);
    return { optic: s.opticId, overlay: s.overlay, ret: s.opticDef?.reticle, zoom: +(p.zoomCur?.() || 1).toFixed(3), fov: +g.camera.fov.toFixed(2) };
  };
  const list = COMBOS.filter(([id, o]) => WSTATS[id] && (OPTIC_ALLOWED[id] || []).includes(o) && OPTICS[o]);
  return { list, best };
}, { COMBOS, MODE });
if (setup.err) { console.log(setup.err); await browser.close(); process.exit(1); }
console.log('yer', JSON.stringify(setup.best));
const list = setup.list.filter(([id, o]) => !only || only.test(`${id}:${o}`));
const rows = [];
if (MODE === 'shots') {
  const FR = (process.env.T || 'hip,ads').split(',').map((x) => (x === 'hip' ? [0, 'hip'] : x === 'ads' ? [1, 'ads'] : x === 'side' ? [-1, 'side'] : [+x, 'a' + Math.round(+x * 100)]));
  for (const [id, o] of list) for (const [t, nm] of FR) {
    const r = await page.evaluate((q) => window.__pose(q), { id, optic: o, t });
    await page.waitForTimeout(160);
    await page.screenshot({ path: `${out}/${tag}-${dev}-${id}-${o}-${nm}.png` });
    rows.push({ id, o, nm, ...r });
    console.log(`${tag} ${dev} ${id}:${o} ${nm} · ${r.overlay} ×${r.zoom} fov ${r.fov}`);
  }
}
if (MODE === 'perf') {
  for (const [id, o] of list) {
    const r = await page.evaluate(async (q) => {
      const g = window.__game, res = {};
      for (const [t, nm] of [[0, 'hip'], [1, 'ads']]) {
        window.__pose({ ...q, t });
        const ts = []; let last = performance.now();
        await new Promise((ok) => { let n = 0; const f = () => { const now = performance.now(); ts.push(now - last); last = now; g.player.s.adsT = t; if (++n < 240) requestAnimationFrame(f); else ok(); }; requestAnimationFrame(f); });
        ts.sort((a, b) => a - b); res[nm] = +(ts.slice(20, 220).reduce((a, b) => a + b, 0) / 200).toFixed(2);
      }
      res.calls = g.renderer.info.render.calls; return res;
    }, { id, optic: o });
    rows.push({ id, o, ...r });
    console.log(`perf ${dev} ${id}:${o} · bel ${r.hip} ms · nişan ${r.ads} ms · çizim ${r.calls}`);
  }
}
if (MODE === 'align') {
  // duvar yerleri: ileri ışın D ± 3 m'de dik yüzeye çarpar
  const spots = await page.evaluate(() => {
    const g = window.__game, s = g.player.s, V = s.pos.constructor, eye = new V(), d = new V(), res = {};
    for (const D of [20, 50, 100]) {
      let best = null;
      for (let x = -90; x <= 90 && !best; x += 3) for (let z = -90; z <= 90 && !best; z += 3) {
        const y = g.world.heightAt(x, z); if (!(y > -5)) continue;
        for (let a = 0; a < 24; a++) {
          const yaw = (a / 24) * Math.PI * 2; eye.set(x, y + s.eyeY, z); d.set(-Math.sin(yaw), 0, -Math.cos(yaw));
          const h = g.world.raycast(eye, d, D + 4, {}), h2 = g.world.raycast(eye, d, D + 4, {}, 'wood'); if (!h || !h2 || Math.abs(h.t - D) > 3 || Math.abs(h2.t - h.t) > 0.05) continue;
          if (h.normal && Math.abs(h.normal.y) > 0.2) continue;
          best = { x, y, z, yaw, t: h.t }; break;
        }
      }
      res[D] = best;
    }
    return res;
  });
  console.log('duvarlar', JSON.stringify(spots));
  for (const [id, o] of list) for (const D of [20, 50, 100]) {
    const sp = spots[D]; if (!sp) continue;
    const r0 = await page.evaluate(({ id, o, sp }) => {
      const g = window.__game, s = g.player.s;
      s.pos.set(sp.x, sp.y, sp.z); s.yaw = sp.yaw; s.pitch = 0; s.vel.set(0, 0, 0);
      const r = window.__pose({ id, optic: o, t: 1 });
      window.__hud(true); document.getElementById('cross').style.visibility = 'hidden';
      return r;
    }, { id, o, sp });
    await page.waitForTimeout(150);
    const buf = await page.screenshot({ scale: 'device' });
    const ret = await page.evaluate(async ({ b64 }) => {          // retikül nişan noktası: kırmızı (ışıyan) piksellerin merkezi; şevron = en üst kırmızı satırın ortası; kırmızı yoksa koyu çizgilerin kesişimi
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const W = img.width, H = img.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const c2 = cv.getContext('2d'); c2.drawImage(img, 0, 0); const dd = c2.getImageData(0, 0, W, H).data;
      const R = Math.round(H * 0.02), cx = W / 2, cy = H / 2; let n = 0, sx = 0, sy = 0, top = 1e9, topX = [];
      for (let y = Math.round(cy - R); y < cy + R; y++) for (let x = Math.round(cx - R); x < cx + R; x++) {
        const i = (y * W + x) * 4, r = dd[i], gg = dd[i + 1], b = dd[i + 2];
        if (r > 170 && gg < 110 && b < 110) { n++; sx += x + 0.5; sy += y + 0.5; if (y < top) { top = y; topX = [x]; } else if (y === top) topX.push(x); }
      }
      if (!n) return { err: 'kırmızı yok' };
      return { dx: sx / n - cx, dy: sy / n - cy, n, topDx: topX.reduce((a, b) => a + b + 0.5, 0) / topX.length - cx, topDy: top - cy, W, H };
    }, { b64: buf.toString('base64') });
    const hit = await page.evaluate(() => {
      const g = window.__game, s = g.player.s, V = s.pos.constructor;
      let pt = null; const sr = g.shootRay; g.shootRay = function (sh, o, d, ...a) { const h = g.world.raycast(o, d, 400, {}, 'wood'); if (h && !pt) { pt = o.clone().addScaledVector(d, h.t); window.__ray = [o.toArray(), d.toArray(), s.yaw, s.pitch]; } return sr.call(this, sh, o, d, ...a); };
      const sp0 = s.spreadNow; s.spreadNow = () => 0; s.cd = 0; s.item.mag = 30;
      s._shoot(s.stat);
      s.spreadNow = sp0; g.shootRay = sr; s.pitch = 0; s.recoilP = 0;
      if (!pt) return { err: 'isabet yok' };
      const cam = g.camera; cam.updateMatrixWorld(true); const q = pt.clone().project(cam);
      const W = innerWidth, H = innerHeight, px = (q.x * 0.5) * W, py = (-q.y * 0.5) * H;
      const dist = pt.distanceTo(cam.position), cmPerPx = (2 * Math.tan((cam.fov * Math.PI) / 360) * dist / H) * 100;
      return { ray: window.__ray, cam: cam.position.toArray().map((v) => +v.toFixed(2)), px: +px.toFixed(2), py: +py.toFixed(2), dist: +dist.toFixed(1), cm: +(Math.hypot(px, py) * cmPerPx).toFixed(2), cmPerPx };
    });
    const dpr = await page.evaluate(() => devicePixelRatio);
    let rdx = null, rdy = null;
    if (!ret.err) { const chev = r0.ret === 'chev'; rdx = (chev ? ret.topDx : ret.dx) / dpr; rdy = (chev ? ret.topDy + 0.5 : ret.dy) / dpr; }      // şevron: nişan noktası = ucu (en üst kırmızı satırın ortası)
    const offPx = hit.err || rdx === null ? null : Math.hypot(hit.px - rdx, hit.py - rdy);
    rows.push({ id, o, D, hit, ret: ret.err ? ret : { dx: +rdx.toFixed(2), dy: +rdy.toFixed(2), topDy: +(ret.topDy / dpr).toFixed(2) }, offPx: offPx === null ? null : +offPx.toFixed(2), offCm: offPx === null || hit.err ? null : +(offPx * hit.cmPerPx).toFixed(2) });
    console.log(`hiza ${dev} ${id}:${o} ${D} m · isabet ${hit.err || `${hit.px},${hit.py} px (${hit.dist} m @${hit.cam}; merkezden ${hit.cm} cm)`} · retikül ${ret.err || `${rdx.toFixed(2)},${rdy.toFixed(2)} px`} · fark ${offPx === null ? '-' : offPx.toFixed(2) + ' px / ' + (offPx * hit.cmPerPx).toFixed(1) + ' cm'}`);
  }
}
writeFileSync(`${out}/${tag}-${dev}-${MODE}.json`, JSON.stringify(rows, null, 1));
console.log('sayfa hatası:', errs.length, errs.slice(0, 3));
await browser.close();
