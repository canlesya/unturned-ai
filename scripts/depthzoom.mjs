// Nişan büyütmesi DERİNLİĞE göre (12.163): saf FOV daralması her derinlikte aynı büyütmeyi verir; kamera ileri kayarsa (dolly) yakın nesne orantısız büyür.
//   node scripts/depthzoom.mjs [taban url]   DEV=desk|mob  THIRD=1 (omuz üstü kamera)  FOV=70,90,110  ONLY=regex (silah:nişangâh)  Q=acog=A (ek sorgu)  PX=0 (piksel ölçümü kapalı)  V=1  JSON=dosya
// Sahneye dünya kamerasının önüne 1,5 / 5 / 15 / 40 m'de aynı AÇISAL boy kare işaretler konur (kenar = 0,06 × derinlik; aynı boy kutuyla oran aynı, piksel ölçümü hassas).
// 1) Analitik (gerçek oyun döngüsü g.step(1/60), nişan basılı 40 kare): her karede dünya kamerasının konumu (belden farkı, kamera eksenlerinde mm), dönüşü, FOV'u,
//    her işaretin ekran boyu (köşeler g.camera ile izdüşürülür) → derinlik başına büyütme = boy / bel boyu; beklenen = tan(taban/2) / tan(fov/2).
// 2) Piksel (yalnız işaretler çizilir, son işleme kapalı — POST=1 ile açık (parıltı kenarı ölçümü bozar, ölçek yok), silah modeli gizli): adsT 0 / 0,5 / 1'de ekran görüntüsünde her rengin alanı → büyütme = √(alan / bel alanı).
// Eşik: derinlikler arası büyütme farkı ≤ %2 (analitik ve piksel), kamera konumu belden ≤ 1 mm.
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180', DEV = process.env.DEV || 'desk', only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const FOVS = (process.env.FOV || '70,90,110').split(',').map(Number), PX = process.env.PX !== '0';
const COMBOS = [['m4a1', 'acog'], ['svd', 'acog'], ['m4a1', 'reddot'], ['ak47', 'iron'], ['sniper', 'scope']].filter(([i, o]) => !only || only.test(`${i}:${o}`));
const DEPTHS = [1.5, 5, 15, 40], POST = !!process.env.POST, VIEWS = process.env.THIRD ? 'third' : 'first';
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = DEV === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
const page = await ctx.newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${DEV !== 'desk' ? '&touch=1' : ''}${process.env.Q ? '&' + process.env.Q : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
await page.evaluate(async (DEPTHS) => {
  const g = window.__game, p = g.player, s = p.s, cam = g.camera, V = cam.position.constructor;
  g.brains.forEach((b) => (b.update = () => {}));
  g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; o.syncModel?.(0); });
  s.protT = 1e9; s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.yaw = 0.6; s.pitch = 0.05; s.vel.set(0, 0, 0);
  const T = (d) => Math.tan((d * Math.PI) / 360);
  // işaretler: kare düzlem, kameraya dönük, derinlik testi yok (dünya örtmesin), ton eşlemesiz saf renk
  const COLS = [0xff0000, 0x00ff00, 0x0000ff, 0xff00ff];
  const mk = [];
  window.__dz = {};
  window.__dz.place = async () => {
    const TH = window.__THREE || (window.__THREE = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/\.vite\/deps\/three\.js/.test(n)) || '/node_modules/.vite/deps/three.js'));      // oyunla aynı örnek
    if (!mk.length) for (let i = 0; i < DEPTHS.length; i++) {
      const m = new TH.Mesh(new TH.PlaneGeometry(1, 1), new TH.MeshBasicMaterial({ color: COLS[i], depthTest: false, depthWrite: false, fog: false, toneMapped: false, side: TH.DoubleSide }));
      m.renderOrder = 1e6; m.frustumCulled = false; mk.push(m); g.scene.add(m);
    }
    cam.updateMatrixWorld(true);
    const a = Math.tan((4 * Math.PI) / 180), Q = [[-a, a], [a, a], [-a, -a], [a, -a]];
    const fw = cam.getWorldDirection(new TH.Vector3()), ed = Math.max(0, s.eye(new TH.Vector3()).sub(cam.position).dot(fw));      // 3. şahıs: derinlik oyuncunun gözünden (kamera ~2,5 m geride)
    DEPTHS.forEach((d0, i) => {
      const d = d0 + ed, m = mk[i], loc = new TH.Vector3(Q[i][0] * d, Q[i][1] * d, -d);
      m.position.copy(cam.localToWorld(loc)); m.quaternion.copy(cam.quaternion); m.scale.setScalar(0.06 * d); m.visible = true; m.updateMatrixWorld(true);
    });
    window.__dz.cam0 = { p: cam.position.clone(), q: cam.quaternion.clone(), m: cam.matrixWorld.clone() };
    return true;
  };
  window.__dz.hide = () => { for (const m of mk) m.visible = false; };
  // işaretin ekran boyu (px, kare kenarı: iki köşegenin ortalaması / √2)
  const sizePx = (m) => {
    const H = innerHeight, W = innerWidth, c = [[-0.5, -0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, 0.5]].map(([x, y]) => m.localToWorld(new V(x, y, 0)).project(cam));
    const d1 = Math.hypot((c[0].x - c[1].x) * W / 2, (c[0].y - c[1].y) * H / 2), d2 = Math.hypot((c[2].x - c[3].x) * W / 2, (c[2].y - c[3].y) * H / 2);
    return (d1 + d2) / 2 / Math.SQRT2;
  };
  window.__dz.equip = async ({ id, optic, fov, third }) => {
    g.simulate = false; p.set.fov = fov; p.third = !!third; p.thirdT = third ? 1 : 0; p._cs = null;
    s.cur = 0; s.items[0] = { id, mag: 30, reserve: 90 }; s.optic = optic; if (s.model) s.model.optic = optic;
    p.refreshWeapon(); s.ads = false; s.adsT = 0; s.reloadT = 0; s.switchT = 0; s.sprinting = false; s.vel.set(0, 0, 0); s.recoilP = 0; s.leanT = 0;
    const vm = p.vm; vm.noSway = true;
    for (let i = 0; i < 60; i++) g.step(1 / 60);
    vm.raise = 0; vm.kick = 0; vm.kickR = 0; s.vel.set(0, 0, 0);
    g.step(1 / 60);
    await window.__dz.place();
    return { zE: p.zoomEff(), base: p.baseFov() };
  };
  // gerçek geçiş: nişan basılı, 40 kare
  window.__dz.trace = () => {
    const c0 = window.__dz.cam0, inv = c0.m.clone().invert(), sz0 = mk.map(sizePx), out = [], b = p.baseFov();
    s.ads = true;
    for (let i = 0; i <= 40; i++) {
      if (i) g.step(1 / 60); cam.updateMatrixWorld(true);
      const lp = cam.position.clone().applyMatrix4(inv);                         // belden kayma, bel kamerasının eksenlerinde (x sağ, y yukarı, z geri)
      const dq = c0.q.clone().invert().multiply(cam.quaternion), ang = 2 * Math.acos(Math.min(1, Math.abs(dq.w))) * 180 / Math.PI;
      const mags = mk.map((m, k) => sizePx(m) / sz0[k]), exp = T(b) / T(cam.fov);
      out.push({ i, adsT: +s.adsT.toFixed(3), fov: +cam.fov.toFixed(3), exp: +exp.toFixed(4), mags: mags.map((v) => +v.toFixed(4)),
        dx: +(lp.x * 1000).toFixed(2), dy: +(lp.y * 1000).toFixed(2), dz: +(-lp.z * 1000).toFixed(2), rot: +ang.toFixed(3), vmFov: +p.vm.cam.fov.toFixed(2) });
    }
    s.ads = false; for (let i = 0; i < 50; i++) g.step(1 / 60);      // belden dön (piksel ölçümü işaretleri bel kamerasına göre yeniden koyar)
    return out;
  };
  // piksel ölçümü için poz: yalnız işaretler (dünya gizli, siyah zemin), silah modeli / HUD gizli
  const vis0 = new Map(); let bg0, fog0, vr0;
  window.__dz.pixMode = (on) => {
    const hud = [...document.body.children].filter((e) => e !== g.canvas && !e.contains(g.canvas));
    if (on) { window.__post0 = g.post?.on; if (g.post && !window.__POST) g.post.on = false; for (const o of g.scene.children) if (!mk.includes(o)) { vis0.set(o, o.visible); o.visible = false; } bg0 = g.scene.background; fog0 = g.scene.fog; g.scene.background = null; g.renderer.setClearColor(0x000000, 1); g.scene.fog = null; vr0 = p.vm.render; p.vm.render = () => {}; for (const e of hud) e.style.visibility = 'hidden'; }
    else { if (g.post && window.__post0 !== undefined) g.post.on = window.__post0; for (const [o, v] of vis0) o.visible = v; vis0.clear(); g.scene.background = bg0; g.scene.fog = fog0; p.vm.render = vr0; for (const e of hud) e.style.visibility = ''; }
  };
  window.__dz.pose = (t) => { s.ads = t > 0.5; for (let i = 0; i < 30; i++) { s.adsT = t; p.update(1 / 60); } cam.updateMatrixWorld(true); const inside = mk.every((m) => [[-0.5, -0.5], [0.5, 0.5]].every(([x, y]) => { const q = m.localToWorld(new V(x, y, 0)).project(cam); return Math.abs(q.x) < 0.98 && Math.abs(q.y) < 0.98; })); return { fov: cam.fov, exp: T(p.baseFov()) / T(cam.fov), an: mk.map(sizePx), inside }; };
}, DEPTHS);

const AREA = async ({ b64 }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const W = img.width, H = img.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c2 = cv.getContext('2d'); c2.drawImage(img, 0, 0); const d = c2.getImageData(0, 0, W, H).data;
  // her renk için kapsama: piksel yoğunluğu / tepe yoğunluğu (sRGB kenarı doğrusal değil; ±%1)
  const cls = (r, g, b) => (r > 20 && g < r * 0.35 && b < r * 0.35 ? 0 : g > 20 && r < g * 0.35 && b < g * 0.35 ? 1 : b > 20 && r < b * 0.35 && g < b * 0.35 ? 2 : r > 20 && b > 20 && g < Math.min(r, b) * 0.35 ? 3 : -1);
  const peak = [0, 0, 0, 0], val = (k, r, g, b) => (k === 0 ? r : k === 1 ? g : k === 2 ? b : (r + b) / 2);
  for (let i = 0; i < d.length; i += 4) { const k = cls(d[i], d[i + 1], d[i + 2]); if (k >= 0) peak[k] = Math.max(peak[k], val(k, d[i], d[i + 1], d[i + 2])); }
  const n = [0, 0, 0, 0];
  for (let i = 0; i < d.length; i += 4) { const k = cls(d[i], d[i + 1], d[i + 2]); if (k >= 0) n[k] += Math.min(1, val(k, d[i], d[i + 1], d[i + 2]) / peak[k]); }      // kapsama toplamı (kenar yumuşatması alt-piksel)
  return { W, H, n };
};

const rows = []; let bad = 0;
const pct = (v) => (v * 100).toFixed(2) + '%';
for (const fov of FOVS) for (const [id, optic] of COMBOS) {
  await page.evaluate((v) => (window.__POST = v), POST);
  const eq = await page.evaluate((o) => window.__dz.equip(o), { id, optic, fov, third: VIEWS === 'third' });
  const F = await page.evaluate(() => window.__dz.trace());
  // analitik: her karede derinlikler arası büyütme farkı
  let spreadMax = 0, posMax = 0, rotMax = 0, devMax = 0;
  for (const f of F) {
    const mn = Math.min(...f.mags), mx = Math.max(...f.mags);
    spreadMax = Math.max(spreadMax, (mx - mn) / mn);
    devMax = Math.max(devMax, ...f.mags.map((m) => Math.abs(m / f.exp - 1)));
    posMax = Math.max(posMax, Math.hypot(f.dx, f.dy, f.dz)); rotMax = Math.max(rotMax, f.rot);
  }
  const last = F[F.length - 1];
  let px = null;
  if (PX) {
    await page.evaluate(() => window.__dz.pose(0));
    await page.evaluate(() => window.__dz.place());
    await page.evaluate(() => window.__dz.pixMode(true));
    const A = [];
    for (const t of [0, 0.5, 1]) {
      const an = await page.evaluate((q) => window.__dz.pose(q), t);
      await page.waitForTimeout(120);
      const buf = await page.screenshot({ scale: 'device' });
      const a = await page.evaluate(AREA, { b64: buf.toString('base64') });
      A.push({ t, exp: an.exp, n: a.n, inside: an.inside });
    }
    await page.evaluate(() => window.__dz.pixMode(false));
    await page.evaluate(() => window.__dz.pose(0));
    px = A.map((r) => ({ t: r.t, inside: r.inside, exp: +r.exp.toFixed(4), mags: r.n.map((n, k) => +Math.sqrt(n / A[0].n[k]).toFixed(4)) }));
  }
  const pxIn = px && px.every((r) => r.inside), pxSpread = px && pxIn ? Math.max(...px.map((r) => (Math.max(...r.mags) - Math.min(...r.mags)) / Math.min(...r.mags))) : 0;
  const ok = spreadMax <= 0.02 && pxSpread <= 0.02 && posMax <= 1;
  if (!ok) bad++;
  const row = { dev: DEV, view: VIEWS, fov, id, optic, base: +eq.base.toFixed(2), zE: eq.zE, full: last.mags, exp: last.exp, spreadMax, devMax, posMax, rotMax, dzFull: last.dz, px, pxSpread, ok, frames: process.env.V ? F : undefined };
  rows.push(row);
  console.log(`${ok ? '✓' : '✗'} ${DEV}${VIEWS === 'third' ? ' 3.şahıs' : ''} FOV ${fov} ${(id + ':' + optic).padEnd(14)} tam nişan beklenen ×${last.exp.toFixed(3)} | 1,5 / 5 / 15 / 40 m: ${last.mags.map((m) => '×' + m.toFixed(3)).join(' ')} | derinlik farkı en çok ${pct(spreadMax)} | kamera kayması ≤ ${posMax.toFixed(1)} mm (ileri ${last.dz} mm), dönüş ≤ ${rotMax.toFixed(2)}°` +
    (px ? (pxIn ? ` | piksel (tam): ${px[2].mags.map((m) => '×' + m.toFixed(3)).join(' ')} (fark ${pct(pxSpread)})` : ' | piksel: işaret ekran dışında (dar FOV), atlandı') : ''));
  if (process.env.V) for (const f of F) console.log('   ', JSON.stringify(f));
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
console.log(`\n${DEV}: ${rows.length - bad}/${rows.length} uygun${errs.length ? ' · sayfa hatası: ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
process.exit(bad || errs.length ? 1 : 0);
