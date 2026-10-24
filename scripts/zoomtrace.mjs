// Nişan yakınlaştırması ZAMAN İÇİNDE (12.154): her silah × izinli nişangâh ve olay senaryoları (ateş / şarjör / koşu / zıplama / silah değiştirme /
// nişangâh değiştirme / ölüm / yeniden doğuş / hızlı tekrar basma) kare kare kaydedilir (gerçek oyun döngüsü g.step(1/60)).
//   node scripts/zoomtrace.mjs [taban url]   DEV=desk|mob  FOV=70,90,110  ONLY=regex (senaryo:silah:nişangâh)  PLOT=1 (hatalı izler → /tmp/wb-zoom/*.png)
//                                            PLOTALL=regex (bu izlerin grafiği hatasız da çizilir)  STRIP=regex (kare şeridi, /tmp/wb-zoom/strip-*.png)  V=1  JSON=dosya
// Her karede: dünya kamerası FOV'u, silah kamerası FOV'u, PiP (ACOG merceği) FOV'u, adsT, dünya büyütmesi (tan(taban/2) / tan(fov/2)), mercek içi büyütme,
// nişangâhın ekrandaki boyu (silah modelinde nişan noktasındaki 2 cm'lik parçanın piksel boyu), dürbün örtüsü / HUD retikülü.
// Denetimler: sıçrama (bir karede |Δbüyütme| > 0,34·(z−1) + 0,02: adsT'nin bir karedeki en büyük adımının eğrideki karşılığı), yön (giriş / çıkış
// fazında büyütme geri dönmez), dünya ↔ silah kamerası senkronu (ilerleme farkı ≤ 0,05), takılı kalma (beklenen dinlenmede büyütme 1, silah FOV'u 54),
// yanlış örtü (dünya ×2 altında dürbün örtüsü, dünya %95'e varmadan HUD retikülü).
import { chromium, devices } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180', DEV = process.env.DEV || 'desk';
const FOVS = (process.env.FOV || (DEV === 'desk' ? '70,90,100' : '70,90,110')).split(',').map(Number);
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null, plotAll = process.env.PLOTALL ? new RegExp(process.env.PLOTALL) : null, stripRe = process.env.STRIP ? new RegExp(process.env.STRIP) : null;
const OUT = '/tmp/wb-zoom'; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = DEV === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
const page = await ctx.newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${DEV !== 'desk' ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
await page.evaluate(async () => { const st = await import('/src/game/stats.js'); window.__ST = { OA: st.OPTIC_ALLOWED, W: st.WSTATS, O: st.OPTICS }; window.__LO = (await import('/src/game/player.js')).LENS_OUT; });
await page.evaluate(() => {
  const g = window.__game, p = g.player, s = p.s, T = (d) => Math.tan((d * Math.PI) / 360);
  g.brains.forEach((b) => (b.update = () => {}));
  g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; });
  const key = (n) => g.binds.codes(n)?.[0];
  const ACT = {
    ads: (v) => { s.ads = v; },
    fire: (v) => { p.fireHeld = v; },
    reload: () => { s.item.mag = 1; s.startReload(); },
    sprint: (v) => { for (const c of [key('sprint'), key('forward')]) v ? p.keys.add(c) : p.keys.delete(c); },
    jump: () => { p.keys.add(key('jump')); },
    unjump: () => { p.keys.delete(key('jump')); p.spaceLatch = false; },
    sw: (i) => { s.switchTo(i); },
    optic: () => { s.cycleOptic(); },
    die: () => { s.die(null, 'test'); },
    respawn: () => { g.respawn(s); s.protT = 1e9; },
    lenshud: (v) => { p.pipForce = !v; },
  };
  const z = { };
  window.__zt = z;
  // spec: { fov, items: [[id, optic], [id, optic]?], cur, steps: [{ act: [[ad, arg]...], n, dir: '+' | '-' | '' | 'rest', tag }] }
  z.start = (spec) => {
    p.set.fov = spec.fov; p.pipForce = spec.lensHud ? false : true;
    if (!s.alive) g.respawn(s);
    s.protT = 1e9; s.lastHit = null;
    s.items[0] = { id: spec.items[0][0], mag: 30, reserve: 90 };
    if (spec.items[1]) s.items[1] = { id: spec.items[1][0], mag: 12, reserve: 48 };
    s.cur = spec.cur || 0; s.optic = spec.items[s.cur][1]; if (s.model) s.model.optic = s.optic;
    p.refreshWeapon(); s.ads = false; s.adsT = 0; s.reloadT = 0; s.switchT = 0; s.sprinting = false; s.vel.set(0, 0, 0); p.fireHeld = false; p.keys.clear();
    g.simulate = false; p.vm.noSway = true;
    for (let i = 0; i < 40; i++) g.step(1 / 60);
    p.vm.raise = 0; p.vm.kick = 0; p.vm.kickR = 0;
    z.spec = spec; z.si = 0; z.fi = 0; z.t = 0; z.frames = []; z.mag0 = null;
    return true;
  };
  const sightPx = () => {
    const vm = p.vm, u = vm.model?.userData; if (!u || !u.sight) return null;
    const H = innerHeight; vm.root.updateMatrixWorld(true); vm.cam.updateMatrixWorld(true);
    const a = new vm.root.position.constructor(...u.sight), b = a.clone(); b.x += 0.02;
    vm.root.localToWorld(a); vm.root.localToWorld(b); a.project(vm.cam); b.project(vm.cam);
    return +(Math.hypot((a.x - b.x) * vm.cam.aspect, a.y - b.y) * H / 2).toFixed(2);
  };
  z.rec = (st) => {
    const vm = p.vm, base = p.baseFov(), fov = g.camera.fov, mag = T(base) / T(fov);
    let lens = null, pipFov = null;
    if (vm.pipWant && s.alive) { vm.renderPip(g.renderer, g.scene, g.camera); pipFov = vm.pipCam.fov; lens = (T(base) * vm.pipR) / T(pipFov); }
    const hudOn = ['rdot', 'holo'].some((i) => document.getElementById(i).style.display === 'block');
    return {
      i: z.fi, t: +(z.fi / 60).toFixed(4), tag: st.tag || '', dir: st.dir || '', ev: z.ev || '', id: s.item.id, optic: s.opticId, ov: s.overlay, alive: s.alive,
      adsT: +s.adsT.toFixed(4), zE: +p.zoomEff().toFixed(3), base: +base.toFixed(2), fov: +fov.toFixed(3), mag: +mag.toFixed(4), wfov: +vm.cam.fov.toFixed(3),
      pipFov: pipFov && +pipFov.toFixed(3), lens: lens && +lens.toFixed(4), scope: !!p.scopeOn, hud: hudOn, model: vm.root.visible, sightPx: sightPx(), switchT: +s.switchT.toFixed(3), tz: p._zTail ? p._zTail.z : null,
    };
  };
  // bir kare: sıradaki adımın eylemleri (adımın ilk karesinde) + g.step + kayıt
  z.frame = () => {
    const sp = z.spec, st = sp.steps[z.si]; if (!st) return null;
    z.ev = '';
    if (z.fi0 === undefined || z.fi0 !== z.si) { z.fi0 = z.si; z.k = 0; for (const [a, v] of st.act || []) { ACT[a](v); z.ev += (z.ev ? ' ' : '') + a + (v === undefined ? '' : '(' + v + ')'); } }
    g.step(1 / 60); const r = z.rec(st); z.frames.push(r); z.fi++;
    if (++z.k >= st.n) { z.si++; }
    return r;
  };
  z.run = (spec) => { z.start(spec); z.fi0 = undefined; while (z.frame()); const F = z.frames; g.simulate = true; p.keys.clear(); p.fireHeld = false; s.ads = false; return F; };
  z.begin = (spec) => { z.start(spec); z.fi0 = undefined; return true; };
  z.end = () => { g.simulate = true; p.keys.clear(); p.fireHeld = false; s.ads = false; };
});

const info = await page.evaluate(() => ({ OA: window.__ST.OA, ball: Object.keys(window.__ST.W).filter((k) => window.__ST.W[k].ball && window.__ST.W[k].zoom), LO: window.__LO, mob: !!window.__game.player.touch, zoom: Object.fromEntries(Object.entries(window.__ST.W).filter(([, v]) => v.zoom).map(([k, v]) => [k, v.zoom])) }));

// ── senaryolar ──
const S = [];
const ADS_IN = (n = 36) => ({ act: [['ads', true]], n, dir: '+', tag: 'giriş' });
const ADS_OUT = (n = 36) => ({ act: [['ads', false]], n, dir: '-', tag: 'çıkış' });
for (const [id, opts] of Object.entries(info.OA)) for (const o of opts) {
  S.push({ name: `inout:${id}:${o}`, items: [[id, o]], steps: [ADS_IN(), ADS_OUT(), { n: 4, dir: 'rest' }] });
  S.push({ name: `repress:${id}:${o}`, items: [[id, o]], steps: [ADS_IN(5), ADS_OUT(3), ADS_IN(4), ADS_OUT(2), ADS_IN(30), ADS_OUT(30), { n: 4, dir: 'rest' }] });
}
const SPECIAL = [['sniper', 'scope'], ['m4a1', 'acog'], ['ak47', 'holo'], ['ak47', 'iron'], ['barrett', 'scope6'], ['svd', 'acog']].filter(([i]) => info.OA[i]);
for (const [id, o] of SPECIAL) {
  const it = [[id, o], ['pistol', 'iron']];
  S.push({ name: `fire:${id}:${o}`, items: it, steps: [ADS_IN(30), { act: [['fire', true]], n: 40, dir: '', tag: 'ateş' }, { act: [['fire', false]], n: 30, dir: '' }, ADS_OUT(30), { n: 4, dir: 'rest' }] });
  S.push({ name: `reload:${id}:${o}`, items: it, steps: [ADS_IN(30), { act: [['reload']], n: 30, dir: '-', tag: 'şarjör' }, { n: 4, dir: 'rest' }] });
  S.push({ name: `sprint:${id}:${o}`, items: it, steps: [ADS_IN(30), { act: [['sprint', true]], n: 30, dir: '', tag: 'koşu+nişan' }, { act: [['ads', false]], n: 30, dir: '-', tag: 'nişan bırak (koşu)' }, { act: [['sprint', false]], n: 4, dir: 'rest' }] });
  S.push({ name: `jump:${id}:${o}`, items: it, steps: [ADS_IN(30), { act: [['jump']], n: 2, dir: '' }, { act: [['unjump']], n: 50, dir: '', tag: 'zıplama' }, ADS_OUT(30), { n: 4, dir: 'rest' }] });
  S.push({ name: `swout:${id}:${o}`, items: it, steps: [ADS_IN(30), { act: [['sw', 1]], n: 50, dir: '', tag: 'tabancaya geç (nişan basılı)' }, ADS_OUT(30), { n: 4, dir: 'rest' }] });
  S.push({ name: `swin:${id}:${o}`, items: it, cur: 1, steps: [ADS_IN(30), { act: [['sw', 0]], n: 50, dir: '', tag: 'ana silaha geç (nişan basılı)' }, ADS_OUT(40), { n: 4, dir: 'rest' }] });
  S.push({ name: `swinrel:${id}:${o}`, items: it, cur: 1, steps: [ADS_IN(30), { act: [['ads', false], ['sw', 0]], n: 40, dir: '-', tag: 'nişanı bırak + ana silaha geç' }, { n: 4, dir: 'rest' }] });
  if ((info.OA[id] || []).length > 1) S.push({ name: `optic:${id}:${o}`, items: it, steps: [ADS_IN(30), { act: [['optic']], n: 40, dir: '', tag: 'nişangâh değiştir (nişanda)' }, { act: [['optic']], n: 40, dir: '', tag: 'yine değiştir' }, ADS_OUT(40), { n: 4, dir: 'rest' }] });
  S.push({ name: `death:${id}:${o}`, items: it, steps: [ADS_IN(30), { act: [['die']], n: 60, dir: '-', tag: 'ölüm (nişanda)' }, { n: 4, dir: 'rest' }, { act: [['respawn']], n: 20, dir: 'rest', tag: 'yeniden doğuş' }] });
  if (info.mob && o === 'acog') S.push({ name: `lenshud:${id}:${o}`, items: it, steps: [ADS_IN(30), { act: [['lenshud', true]], n: 20, dir: '', tag: 'yedek açılır (nişanda: değişmemeli)' }, ADS_OUT(30), ADS_IN(30), ADS_OUT(30), { n: 4, dir: 'rest' }] });
}
for (const id of info.ball) {
  const it = [[id, null], ['ak47', 'reddot']];
  S.push({ name: `inout:${id}:pb`, items: [[id, null]], steps: [ADS_IN(), ADS_OUT(), { n: 4, dir: 'rest' }] });
  S.push({ name: `swout:${id}:pb`, items: it, steps: [ADS_IN(30), { act: [['sw', 1]], n: 50, dir: '', tag: 'normal silaha geç' }, ADS_OUT(30), { n: 4, dir: 'rest' }] });
}
const LIST = S.filter((x) => !only || only.test(x.name));

// ── denetim ──
const LO = info.LO;
function check(F) {
  const err = [];
  const zt = (f) => (f.ov === 'lens' ? LO : Math.max(1, f.zE));               // dünya kamerasının hedef büyütmesi
  for (let i = 1; i < F.length; i++) {
    const a = F[i - 1], b = F[i], zr = Math.max(zt(a), zt(b), a.tz || 1, b.tz || 1, 1.0001);      // tz: eski silahın sönen büyütmesi (12.154)
    const lim = 0.34 * (zr - 1) + 0.02, d = b.mag - a.mag;
    if (Math.abs(d) > lim) err.push({ k: 'sıçrama', i: b.i, msg: `dünya ×${a.mag}→×${b.mag} tek karede (${a.id}:${a.optic}→${b.id}:${b.optic}, adsT ${a.adsT}→${b.adsT}${b.ev ? ', ' + b.ev : ''})` });
    if (a.lens && b.lens && Math.abs(b.lens - a.lens) > 0.34 * (Math.max(a.zE, b.zE) - 1) + 0.02) err.push({ k: 'sıçrama', i: b.i, msg: `mercek içi ×${a.lens}→×${b.lens}` });
    if (b.dir === a.dir && b.tag === a.tag) {
      if (b.dir === '+' && d < -1e-4) err.push({ k: 'yön', i: b.i, msg: `girişte büyütme geri döndü ×${a.mag}→×${b.mag}` });
      if (b.dir === '-' && d > 1e-4) err.push({ k: 'yön', i: b.i, msg: `çıkışta büyütme arttı ×${a.mag}→×${b.mag}` });
      if (b.dir === '+' && a.lens && b.lens && b.lens < a.lens - 1e-3) err.push({ k: 'yön', i: b.i, msg: `girişte mercek büyütmesi geri döndü ×${a.lens}→×${b.lens}` });
    }
    const dw = b.wfov - a.wfov;
    if (Math.abs(dw) > 6.5 && a.id === b.id && a.optic === b.optic) err.push({ k: 'sıçrama', i: b.i, msg: `silah kamerası ${a.wfov}°→${b.wfov}° tek karede${b.ev ? ' (' + b.ev + ')' : ''}` });
  }
  for (const f of F) {
    if (f.dir === 'rest' && f.alive && (Math.abs(f.mag - 1) > 0.002 || Math.abs(f.wfov - 54) > 0.05)) err.push({ k: 'takılı', i: f.i, msg: `dinlenmede dünya ×${f.mag}, silah ${f.wfov}°` });
    if (!f.alive && f.dir === 'rest' && Math.abs(f.mag - 1) > 0.002) err.push({ k: 'takılı', i: f.i, msg: `ölüyken dünya ×${f.mag} (adsT ${f.adsT})` });
    if (f.alive && f.zE > 1 && f.ov !== 'lens' && f.ov !== 'pbring') {
      const wp = (54 - f.wfov) / (54 - 40), zp = (f.mag - 1) / (f.zE - 1);
      if (Math.abs(wp - zp) > 0.05 && f.mag > 1.0005 && !f.tz) err.push({ k: 'senkron', i: f.i, msg: `silah kamerası ilerlemesi ${wp.toFixed(2)} ↔ dünya ${zp.toFixed(2)}` });
    }
    if (f.scope && f.mag < 1.9) err.push({ k: 'örtü', i: f.i, msg: `dürbün örtüsü dünya ×${f.mag} iken` });
    if (f.hud && f.zE > 1 && (f.mag - 1) / (f.zE - 1) < 0.94) err.push({ k: 'örtü', i: f.i, msg: `HUD retikülü dünya ilerlemesi ${((f.mag - 1) / (f.zE - 1)).toFixed(2)} iken` });
  }
  return err;
}

// ── grafik (SVG → PNG) ──
const C = { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a', yellow: '#eda100', violet: '#6250d6', red: '#e34948', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', surf: '#fcfcfb' };
function svgChart(title, F, errs) {
  const W = 1100, PH = 230, ML = 60, MR = 150, MT = 46, GAP = 46, n = F.length, X = (i) => ML + (i / Math.max(1, n - 1)) * (W - ML - MR);
  const maxMag = Math.max(1.2, ...F.map((f) => Math.max(f.mag, f.lens || 0))), panel = (top, ymax, ylab, series, ticks) => {
    const Y = (v) => top + PH - (v / ymax) * PH * (ymax === 1 ? 1 : 1) + (ymax === 1 ? 0 : 0);
    const Ym = ymax === 1 ? (v) => top + PH - v * PH : (v) => top + PH - ((v - 1) / (ymax - 1)) * PH;
    let o = `<text x="${ML}" y="${top - 10}" font-size="13" fill="${C.ink2}">${ylab}</text>`;
    for (const t of ticks) o += `<line x1="${ML}" x2="${W - MR}" y1="${Ym(t)}" y2="${Ym(t)}" stroke="${C.grid}"/><text x="${ML - 8}" y="${Ym(t) + 4}" font-size="11" text-anchor="end" fill="${C.ink2}">${t}</text>`;
    let li = 0;
    for (const [lab, col, get, dash] of series) {
      let d = '', pen = false;
      F.forEach((f, i) => { const v = get(f); if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Ym(Math.min(ymax, v)).toFixed(1)}`; pen = true; });
      o += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2" ${dash ? 'stroke-dasharray="5 4"' : ''}/>`;
      o += `<line x1="${W - MR + 14}" x2="${W - MR + 34}" y1="${top + 12 + li * 18}" y2="${top + 12 + li * 18}" stroke="${col}" stroke-width="2" ${dash ? 'stroke-dasharray="5 4"' : ''}/><text x="${W - MR + 40}" y="${top + 16 + li * 18}" font-size="12" fill="${C.ink}">${lab}</text>`;
      li++;
    }
    void Y; return o;
  };
  const top2 = MT + PH + GAP;
  const magTicks = []; for (let v = 1; v <= maxMag + 1e-9; v += maxMag > 3 ? 1 : 0.25) magTicks.push(+v.toFixed(2));
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${top2 + PH + 60}" style="background:${C.surf};font-family:Helvetica,Arial,sans-serif">`;
  o += `<text x="${ML}" y="24" font-size="16" font-weight="600" fill="${C.ink}">${title}</text>`;
  o += panel(MT, maxMag, 'Büyütme (×) — tan(taban/2) / tan(fov/2)', [['dünya kamerası', C.blue, (f) => f.mag], ['mercek içi (PiP)', C.orange, (f) => f.lens]], magTicks);
  o += panel(top2, 1, 'İlerleme (0 = bel, 1 = tam nişan)', [['adsT (doğrusal)', C.ink2, (f) => f.adsT, true], ['silah kam. (54−fov)/14', C.aqua, (f) => (54 - f.wfov) / 14], ['dünya (büyütme−1)/(z−1)', C.blue, (f) => (f.zE > 1 && f.ov !== 'lens' ? (f.mag - 1) / (f.zE - 1) : null)]], [0, 0.25, 0.5, 0.75, 1]);
  // olaylar ve hatalar
  const yb = top2 + PH;
  F.forEach((f, i) => { if (f.ev && i > 0) o += `<line x1="${X(i)}" x2="${X(i)}" y1="${MT - 4}" y2="${yb}" stroke="${C.ink2}" stroke-dasharray="2 3"/><text x="${X(i) + 3}" y="${MT + 10 + (i % 3) * 12}" font-size="11" fill="${C.ink2}">${f.ev}</text>`; });
  for (const e of errs.slice(0, 40)) o += `<circle cx="${X(F.findIndex((f) => f.i === e.i))}" cy="${MT + PH + 10}" r="4" fill="${C.red}"/>`;
  for (let s = 0; s <= n / 60; s += 0.25) o += `<text x="${X(s * 60)}" y="${yb + 18}" font-size="11" text-anchor="middle" fill="${C.ink2}">${Math.round(s * 1000)}</text>`;
  o += `<text x="${(W - MR + ML) / 2}" y="${yb + 36}" font-size="12" text-anchor="middle" fill="${C.ink2}">zaman (ms, 60 kare/sn)${errs.length ? ' · kırmızı nokta = hatalı kare' : ''}</text>`;
  return o + '</svg>';
}
const plotPage = await ctx.newPage();
async function plot(file, title, F, errs) {
  const svg = svgChart(title, F, errs);
  await plotPage.setViewportSize({ width: 1100, height: 700 });
  await plotPage.setContent(`<html><body style="margin:0;background:#fcfcfb">${svg}</body></html>`);
  await plotPage.locator('svg').screenshot({ path: file });
}

// ── çalıştır ──
const out = []; let bad = 0;
for (const fov of FOVS) for (const sc of LIST) {
  const spec = { ...sc, fov, lensHud: false };
  const F = await page.evaluate((sp) => window.__zt.run(sp), spec);
  const err = check(F), kinds = [...new Set(err.map((e) => e.k))];
  out.push({ name: sc.name, fov, err, frames: process.env.JSON ? F : undefined });
  if (err.length) bad++;
  if (err.length || process.env.V) console.log(`${err.length ? '✗' : '✓'} FOV ${fov} ${sc.name.padEnd(26)} ${err.length ? kinds.join('/') + ': ' + err.slice(0, 3).map((e) => `[${e.i}] ${e.msg}`).join(' · ') + (err.length > 3 ? ` (+${err.length - 3})` : '') : ''}`);
  if (process.env.V) for (const f of F) console.log('   ', JSON.stringify(f));
  const fname = `${DEV}-fov${fov}-${sc.name.replace(/:/g, '_')}`;
  if ((process.env.PLOT && err.length) || (plotAll && plotAll.test(sc.name))) await plot(`${OUT}/${fname}.png`, `${DEV} · FOV ${fov} · ${sc.name}${err.length ? ` — ${err.length} hata (${kinds.join(', ')})` : ' — hatasız'}`, F, err);
  if (stripRe && stripRe.test(sc.name) && fov === FOVS[0]) {
    // kare şeridi: aynı senaryo kare kare, olaydan sonraki kareler (canlı çizim döngüsü bir rAF sonra çizer)
    await page.evaluate((sp) => window.__zt.begin(sp), spec);
    const shots = [], evAt = [];
    for (let k = 0; ; k++) {
      const r = await page.evaluate(() => window.__zt.frame());
      if (!r) break;
      if (r.ev) evAt.push(k);
      const near = evAt.length > 1 ? k - evAt[1] : -99;                                     // ilk olay = nişana giriş, ikincisi = senaryonun olayı
      if (near >= -2 && near <= 12 && near % 1 === 0) {
        await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
        const b = await page.screenshot({ type: 'jpeg', quality: 70 });
        shots.push({ b: b.toString('base64'), cap: `kare ${r.i} · ${r.id}:${r.optic} · adsT ${r.adsT} · ×${r.mag}${r.lens ? ' · mercek ×' + r.lens : ''}${r.scope ? ' · dürbün' : ''}${r.ev ? ' · ' + r.ev : ''}` });
      }
    }
    await page.evaluate(() => window.__zt.end());
    const html = `<html><body style="margin:0;background:#111;color:#eee;font:12px Helvetica;display:grid;grid-template-columns:repeat(5,320px);gap:4px;padding:4px">${shots.map((s) => `<div><img src="data:image/jpeg;base64,${s.b}" style="width:320px;display:block"><div style="padding:2px">${s.cap}</div></div>`).join('')}</body></html>`;
    await plotPage.setViewportSize({ width: 1640, height: 400 });
    await plotPage.setContent(html); await plotPage.waitForTimeout(300);
    await plotPage.screenshot({ path: `${OUT}/strip-${fname}.png`, fullPage: true });
    console.log(`  kare şeridi → ${OUT}/strip-${fname}.png`);
  }
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(out, null, 1));
const byKind = {}; for (const r of out) for (const e of r.err) byKind[e.k] = (byKind[e.k] || 0) + 1;
console.log(`\n${DEV}: ${out.length - bad}/${out.length} iz uygun (${LIST.length} senaryo × FOV ${FOVS.join('/')})${Object.keys(byKind).length ? ' · hatalı kare: ' + JSON.stringify(byKind) : ''}${errs.length ? ' · sayfa hatası: ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
process.exit(bad || errs.length ? 1 : 0);
