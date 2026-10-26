// Nişan yakınlaştırması ölçümü + kare dizisi (12.162, gerçek GPU, headless:false): her optik için bel / %50 / tam nişanda
//   dünya FOV'u ve tam ekran büyütmesi, (eski ACOG PiP'te) mercek içi büyütme, mercek / pencere ekran boyu, halka (mercek çevresindeki koyu bant) kalınlığı, silahın ekran oranı.
//   node scripts/opticzoom.mjs <çıktı klasörü> [taban url]    DEV=desk|mob  Q=acog=B (ek sorgu)  ONLY=regex (silah:nişangâh)  T=0,0.5,1  SCENE=1 (uzay: duvara yakın + uzak hedef ACOG kareleri)  JSON=dosya
// Kare adları: <dev>-<silah>-<nişangâh>-<yüzde>.png (dünya görünür, HUD retikülü açık) · sahne: <dev>-scene-<ad>-<yüzde>.png
// Ölçüm karesi yeşil zeminli (dünya gizli): merkezden 4 yöne ilk yeşil olmayan piksel (iç yarıçap = mercek / pencere) → ardından yeniden yeşil (dış yarıçap); halka = dış − iç (yukarı ve yanlar).
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-adszoom2/now', base = process.argv[3] || 'http://127.0.0.1:5392';
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null, dev = process.env.DEV || 'desk';
const TS = (process.env.T || '0,0.5,1').split(',').map(Number);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
const COMBOS = [['m4a1', 'iron'], ['m4a1', 'reddot'], ['pistol', 'reddot'], ['m4a1', 'holo'], ['m4a1', 'acog'], ['ak47', 'acog'], ['mp5', 'acog'], ['lmg', 'acog'], ['svd', 'acog'],
  ['sniper', 'scope'], ['barrett', 'scope6'], ['pbrifle', 'reddot'], ['pbpistol', 'iron'], ['laser', 'acog'], ['laser', 'holo'], ['elmg', 'acog'], ['railgun', 'scope'], ['ww_bolt', 'iron'], ['ww_sniper', 'scope']]
  .filter(([i, o]) => !only || only.test(`${i}:${o}`));
const SETUP = (SPACE) => {
  return (async () => {
    const { WSTATS } = await import('/src/game/stats.js');
    const g = window.__game, p = g.player, s = p.s;
    g.brains.forEach((b) => (b.update = () => {}));
    window.__cands = g.soldiers.map((o) => o.pos.clone());
    window.__tgt = SPACE ? g.soldiers.find((o) => o !== s && o.team !== s.team) : null;      // uzak hedef (uzay sahnesi): yerinde kalır (dondurulmuş), sonra taşınır
    g.soldiers.filter((o) => o !== s && o !== window.__tgt).forEach((o) => { o.pos.y = -90; o.syncModel?.(0); });
    if (window.__tgt) window.__tgt.protT = 1e9;
    g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;
    if (!SPACE) { s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.yaw = 0.6; s.pitch = 0.05; }
    s.vel.set(0, 0, 0); s.protT = 1e9;
    const hudEls = [...document.body.children].filter((e) => e !== g.canvas && !e.contains(g.canvas));
    const bg0 = g.scene.background, fog0 = g.scene.fog, vis0 = new Map();
    window.__green = (on) => {
      if (on) { for (const o of g.scene.children) { vis0.set(o, o.visible); o.visible = false; } g.scene.background = g.sun.color.clone().setRGB(0, 1, 0); g.scene.fog = null; if (g.post) { g._post0 = g.post.on; g.post.on = false; } }
      else { for (const [o, v] of vis0) o.visible = v; vis0.clear(); g.scene.background = bg0; g.scene.fog = fog0; if (g.post && g._post0 !== undefined) g.post.on = g._post0; }
    };
    const T = (d) => Math.tan((d * Math.PI) / 360);
    window.__pose = (o) => {
      for (const e of hudEls) e.style.visibility = 'hidden';
      const h = document.getElementById('hud'); if (h) { h.style.visibility = o.green ? 'hidden' : 'visible'; for (const c of h.querySelectorAll(':scope > *')) c.style.visibility = !o.green && /^(rdot|holo|scope|idot|cross|scopeblk|advig|pbret)$/.test(c.id) ? 'visible' : 'hidden'; }
      const SL = WSTATS[o.id].slot === 'secondary' ? 1 : 0;
      s.cur = SL; s.items[SL] = { id: o.id, mag: 30, reserve: 90 }; s.optic = o.optic; if (s.model) s.model.optic = o.optic;
      p.refreshWeapon(); p.pipForce = true; s.lensHud = false;      // (eski kodda PiP / telefon yedeği; yeni kodda etkisiz)
      const vm = p.vm; vm.noSway = true; vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0; vm.breathT = 0; vm.sx = 0; vm.sy = 0;
      s.swing = null; s.reloadT = 0; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0; s.recoilP = 0; s.leanT = 0; s.ads = o.t > 0.5;
      for (let i = 0; i < 60; i++) { s.adsT = o.t; p.update(1 / 60); }
      for (let i = 0; i < 20; i++) g.hud.update(1 / 60);
      const bf = p.baseFov(), fov = g.camera.fov, mag = T(bf) / T(fov);
      let pip = null, lensD = null;
      if (vm.pipWant && vm.renderPip) { vm.renderPip(g.renderer, g.scene, g.camera); if (vm.pipCam) pip = (T(bf) * vm.pipR) / T(vm.pipCam.fov); }
      const d = vm.lensDisc;
      if (d) {      // mercek diskinin ekran çapı (ekran yüksekliğine oran)
        vm.root.updateMatrixWorld(true); vm.cam.updateMatrixWorld(true);
        const V = d.position.constructor, c = d.getWorldPosition(new V()), r = d.geometry.parameters.radius, f = d.localToWorld(new V(0, r, 0));
        const q1 = c.clone().project(vm.cam), q2 = f.clone().project(vm.cam); lensD = Math.abs(q2.y - q1.y);       // NDC yarıçap ×2 / 2 = çap / H
      }
      return { overlay: s.overlay, base: +bf.toFixed(2), fov: +fov.toFixed(2), mag: +mag.toFixed(3), pip: pip && +pip.toFixed(3), lensD: lensD && +lensD.toFixed(3), vmFov: +vm.cam.fov.toFixed(1), sens: +(1 / Math.pow(p.zoomCur(), 0.8)).toFixed(3) };
    };
    // uzay sahnesi: duvara yakın (≈ 1,6 m) ve uzak hedef (bot ≈ 30 m)
    window.__scene = (kind) => {
      const V = s.pos.constructor, o0 = window.__o0 ||= s.pos.clone();
      const eye = new V(), dir = new V();
      const cands = []; for (let x = -40; x <= 40; x += 8) for (let z = -40; z <= 40; z += 8) { const h = g.world.raycast(new V(x, 40, z), new V(0, -1, 0), 80, {}); if (h) cands.push(new V(x, 40 - h.t, z)); }
      if (kind === 'wall') {      // sabit yer (rastgele doğuştan bağımsız): merkeze en yakın, 3–6 m önünde duvar olan nokta → duvara 1,6 m
        let best = null;
        for (const c of cands) for (let a = 0; a < 32; a++) { const yaw = (a / 32) * Math.PI * 2; eye.set(c.x, c.y + 1.5, c.z); dir.set(-Math.sin(yaw), 0, -Math.cos(yaw)); const h = g.world.raycast(eye, dir, 12, {}); if (h && h.t > 3 && h.t < 6) { const sc = Math.hypot(c.x, c.z) + a * 1e-3; if (!best || sc < best.sc) best = { t: h.t, yaw, c, sc }; } }
        if (!best) return null;
        const k = best.t - 1.6; s.pos.set(best.c.x - Math.sin(best.yaw) * k, best.c.y, best.c.z - Math.cos(best.yaw) * k); s.yaw = best.yaw + 0.25; s.pitch = 0.02;
        return { t: best.t, sp: s.pos.toArray().map((v) => +v.toFixed(1)) };
      }
      let best = null;
      for (const c of cands) for (let a = 0; a < 32; a++) { const yaw = (a / 32) * Math.PI * 2; const y0 = c.y; eye.set(c.x, y0 + 1.5, c.z); dir.set(-Math.sin(yaw), 0, -Math.cos(yaw)); const h = g.world.raycast(eye, dir, 45, {}); const t = h ? h.t : 45, sc = t - 0.05 * Math.hypot(c.x, c.z); if (!best || sc > best.sc) best = { t, sc, yaw, c, y0 }; }
      s.pos.set(best.c.x, best.y0, best.c.z); s.yaw = best.yaw; s.pitch = 0.0;
      const e = window.__tgt, D = Math.min(30, best.t - 3);
      e.pos.set(best.c.x - Math.sin(best.yaw) * D, 0, best.c.z - Math.cos(best.yaw) * D); e.pos.y = best.y0; e.yaw = best.yaw; e.syncModel?.(0);
      return { t: best.t, D, tp: e.pos.toArray().map((v) => +v.toFixed(1)), sp: s.pos.toArray().map((v) => +v.toFixed(1)), yaw: +s.yaw.toFixed(2), alive: e.alive, vis: e.model.root.visible };
    };
    return true;
  })();
};
const ANALYZE = async ({ b64 }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const W = img.width, H = img.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c2 = cv.getContext('2d'); c2.drawImage(img, 0, 0); const d = c2.getImageData(0, 0, W, H).data;
  const green = (x, y) => { const i = (y * W + x) * 4; return d[i + 1] > 45 && d[i + 1] > d[i] * 1.6 && d[i + 1] > d[i + 2] * 1.6; };
  let all = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!green(x, y)) all++;
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2), ray = (dx, dy) => {
    let r = Math.round(H * 0.012), n = Math.max(W, H);
    while (r < n && !green(cx + dx * r, cy + dy * r)) r++;                  // merkezdeki nokta / arpacık atlanır
    let a = r; while (a < n && cx + dx * a >= 0 && cx + dx * a < W && cy + dy * a >= 0 && cy + dy * a < H && green(cx + dx * a, cy + dy * a)) a++;
    if (cx + dx * a < 0 || cx + dx * a >= W || cy + dy * a < 0 || cy + dy * a >= H) return { in: null, ring: null };
    let b = a; while (cx + dx * b >= 0 && cx + dx * b < W && cy + dy * b >= 0 && cy + dy * b < H && !green(cx + dx * b, cy + dy * b)) b++;
    const edge = cx + dx * b < 0 || cx + dx * b >= W || cy + dy * b < 0 || cy + dy * b >= H;
    return { in: a / H, ring: edge ? null : (b - a) / H };
  };
  const L = ray(-1, 0), R = ray(1, 0), U = ray(0, -1);
  return { all: all / (W * H), inL: L.in, inR: R.in, inU: U.in, ringL: L.ring, ringR: R.ring, ringU: U.ring };
};
const rows = [], errs = [];
const open = async (url) => {
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url); await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  return page;
};
const tch = (dev === 'mob' ? '&touch=1' : '') + (process.env.Q ? '&' + process.env.Q : ''), dpr0 = dev === 'mob' ? 2.625 : 1;
const shoot = async (page, name, o) => {
  const info = await page.evaluate((q) => window.__pose(q), o);
  await page.waitForTimeout(110);
  await page.screenshot({ path: `${out}/${name}.png` });
  let m = {};
  if (!o.noGreen) {
    await page.evaluate(() => window.__green(true));
    await page.evaluate((q) => window.__pose({ ...q, green: 1 }), o);
    await page.waitForTimeout(110);
    const buf = await page.screenshot({ scale: 'device' });
    await page.evaluate(() => window.__green(false));
    m = await page.evaluate(ANALYZE, { b64: buf.toString('base64') });
  }
  const row = { name, ...info, ...m }; rows.push(row);
  const pc = (v) => (v == null ? '  –  ' : (v * 100).toFixed(1).padStart(5));
  console.log(`${name.padEnd(34)} FOV ${String(info.fov).padStart(6)} (taban ${info.base}) ×${info.mag.toFixed(2)}${info.pip ? ` · mercek içi ×${info.pip.toFixed(2)}` : ''}${info.lensD ? ` · mercek çapı %${(info.lensD * 100).toFixed(1)}` : ''} · iç yarıçap %${pc(m.inU)} / %${pc(m.inL)} · halka üst %${pc(m.ringU)} yan %${pc(m.ringL)} · silah %${pc(m.all)} · vmFov ${info.vmFov} · hassasiyet ×${info.sens}`);
};
const page = await open(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${tch}`);
await page.evaluate(SETUP, false);
for (const [id, optic] of COMBOS) for (const t of TS) await shoot(page, `${dev}-${id}-${optic}-${Math.round(t * 100)}`, { id, optic, t });
await page.close();
if (process.env.SCENE) {      // kullanıcının durumu: Uzay, ACOG (lazer tüfeği), duvara yakın + uzak hedef
  const sp = await open(`${base}/?autostart=3v3&map=yorunge&type=space&debug=1&dev=1&nolock=1&third=0${tch}`);
  await sp.evaluate(SETUP, true);
  for (const kind of ['wall', 'far']) {
    const r = await sp.evaluate((k) => window.__scene(k), kind); console.log('sahne', kind, JSON.stringify(r));
    for (const t of [0, 0.5, 1]) await shoot(sp, `${dev}-scene-${kind}-laser-acog-${Math.round(t * 100)}`, { id: 'laser', optic: 'acog', t, noGreen: true });
    if (kind === 'far') for (const t of [0, 1]) await shoot(sp, `${dev}-scene-${kind}-laser-holo-${Math.round(t * 100)}`, { id: 'laser', optic: 'holo', t, noGreen: true });
  }
  await sp.close();
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
writeFileSync(`${out}/${dev}-olcum.json`, JSON.stringify(rows, null, 1));
console.log('sayfa hatası:', errs.length, errs.slice(0, 3));
await browser.close();
