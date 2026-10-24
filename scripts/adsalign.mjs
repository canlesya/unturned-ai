// Nişan hizası (gerçek GPU, headless:false): her silah × izinli nişangâh tam nişanda çizilir, ekran görüntüsünde retikül / gez-arpacık merkezinin EKRAN ORTASINDAN
// (= mermi noktası) piksel sapması ölçülür. Masaüstü 1600×900 + Pixel 7 yatay + iPhone 13 yatay (CSS piksel). Eşik ≤ 2 px (LIMIT).
//   node scripts/adsalign.mjs [taban url]    DEV=desk,mob,iph  ONLY=regex (silah:nişangâh)  OUT=klasör (görüntüler)  JSON=dosya  SWAY=1 (nefes / sallanma / tepme açık)
// Ölçümler (dünya gizli, yeşil zemin, son işleme kapalı, nefes / sallanma kapalı):
//   3D  — S3 retikülü (ışıyan yuva) eflatun çizilir: red dot / holo / dürbün / ACOG = eflatun piksellerin ağırlık merkezi (ACOG 12.155: PiP merceğinde gölgelendirici noktası; eski şevronda tepe noktası)
//   gez — demir nişan: arpacık tepesi (orta sütunda) + gez deliği / çentiği merkezi (yeşil boşluk dolgusu)
//   cam — nişangâh penceresi (yeşil boşluk) merkezi (eski / yeni karşılaştırma için; eski modellerde retikül yok)
//   HUD — HUD retikülü (#rdot / #holo / dürbün çizgileri / telefonda #idot), silah gizli: kırmızı / beyaz piksellerin merkezi
//   HUDy — telefonda ACOG yedeği (lensHud: PiP yok, tam ekran HUD dürbünü .adot noktası)
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { SKIN_WEAPONS } from '../src/game/stats.js';
const base = process.argv[2] || 'http://127.0.0.1:5281', LIMIT = +(process.env.LIMIT || 2), OUT = process.env.OUT || '';
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
if (OUT) mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const rows = [], errs = [];
const SKINNED = new Set(SKIN_WEAPONS);                                            // S3 modelli (3B retikül her nişangâhta)

// Görüntü çözümleme (tarayıcıda): PNG → piksel dizisi → ölçüm
const ANALYZE = async ({ b64, kind, mode }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const W = img.width, H = img.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx2 = cv.getContext('2d'); cx2.drawImage(img, 0, 0); const d = cx2.getImageData(0, 0, W, H).data;
  const at = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const cx = W / 2, cy = H / 2;
  const green = (x, y) => { const [r, g, b] = at(x, y); return g > 150 && r < 130 && b < 150; };       // zemin (+ hafif camlı)
  const magenta = (x, y) => { const [r, g, b] = at(x, y); return r > 170 && b > 170 && g < 110; };
  const red = (x, y) => { const [r, g, b] = at(x, y); return r > 170 && g < 120 && b < 120; };
  const white = (x, y) => { const [r, g, b] = at(x, y); return r > 225 && g > 225 && b > 225; };
  const R = Math.round(H * 0.3);
  const cloud = (fn) => { let n = 0, sx = 0, sy = 0, minY = 1e9; const pts = []; for (let y = Math.max(0, Math.round(cy - R)); y < Math.min(H, cy + R); y++) for (let x = Math.max(0, Math.round(cx - R)); x < Math.min(W, cx + R); x++) if (fn(x, y)) { n++; sx += x + 0.5; sy += y + 0.5; pts.push([x, y]); if (y < minY) minY = y; } return { n, x: sx / n, y: sy / n, minY, pts }; };
  const res = {};
  if (mode === 'probe' || mode === 'hud') {
    const c = cloud(mode === 'probe' ? magenta : kind === 'idot' ? white : red);
    if (!c.n) return { err: 'retikül bulunamadı' };
    res.dx = c.x - cx; res.dy = c.y - cy; res.n = c.n;
    return res;
  }
  // gez / cam: yeşil boşluk dolgusu (merkeze en yakın yeşil tohumdan)
  const fill = (sx, sy, lim) => {
    const seen = new Uint8Array(W * H), st = [[sx, sy]]; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, n = 0, open = false;
    while (st.length) { const [x, y] = st.pop(); if (x < 0 || y < 0 || x >= W || y >= H) continue; const k = y * W + x; if (seen[k]) continue; seen[k] = 1; if (!green(x, y)) continue;
      if (Math.abs(x - sx) > lim || Math.abs(y - sy) > lim) { open = true; continue; }
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
    return { open, n, x: (x0 + x1 + 1) / 2, y: (y0 + y1 + 1) / 2, x0, x1, y0, y1 };
  };
  const ix = Math.floor(cx), iy = Math.floor(cy);
  if (mode === 'iron') {
    // arpacık tepesi: orta sütunda merkezden yukarı (arpacık merkezi örtüyorsa) ya da aşağı
    let tip = null;
    if (!green(ix, iy)) { let y = iy; while (y > iy - R && !green(ix, y)) y--; tip = y + 1; } else { let y = iy; while (y < iy + R && green(ix, y)) y++; tip = y < iy + R ? y : null; }
    if (tip === null) return { err: 'arpacık yok' };
    const ry = Math.min(H - 1, tip + 3); let a = ix, b = ix; while (a > ix - 40 && !green(a - 1, ry)) a--; while (b < ix + 40 && !green(b + 1, ry)) b++;
    res.postDx = (a + b + 1) / 2 - cx; res.postDy = tip - cy; res.postW = b - a + 1;
    const f = fill(ix, Math.max(0, tip - 3), Math.round(H * 0.12));
    if (f.n && !f.open) { res.apDx = f.x - cx; res.apDy = f.y - cy; res.apR = (f.x1 - f.x0 + 1) / 2; }        // delik merkezi (dikey: arkadaki silah parçası deliğin altını örtebilir → bilgi amaçlı)
    else if (f.n) {                                                            // açık çentik (tabanca / AK): çentik iki yan duvarı arpacık tepesi satırının hemen üstünde
      const yy = Math.max(0, tip - 2); let l = ix, r = ix; while (l > ix - 200 && green(l - 1, yy)) l--; while (r < ix + 200 && green(r + 1, yy)) r++;
      res.notchDx = (l + r) / 2 - cx; res.notchW = r - l;
    }
    return res;
  }
  if (mode === 'glass') { let sx = ix, sy = iy; if (!green(sx, sy)) { let best = 1e9; for (let dy = -16; dy <= 16; dy++) for (let dx = -16; dx <= 16; dx++) if (green(ix + dx, iy + dy) && dx * dx + dy * dy < best) { best = dx * dx + dy * dy; sx = ix + dx; sy = iy + dy; } if (best === 1e9) return { err: 'merkez kapalı' }; } const f = fill(sx, sy, Math.round(H * 0.1)); if (f.open || !f.n) return { err: 'pencere açık / yok' }; return { dx: f.x - cx, dy: f.y - cy, r: (f.x1 - f.x0 + 1) / 2 }; }
  return { err: 'bilinmeyen' };
};

for (const dev of (process.env.DEV || 'desk,mob,iph').split(',')) {
  const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices[dev === 'iph' ? 'iPhone 13 landscape' : 'Pixel 7 landscape']));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(dev + ': ' + e.message));
  await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${dev !== 'desk' ? '&touch=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  const combos = await page.evaluate(async () => {
    const { WSTATS, OPTIC_ALLOWED } = await import('/src/game/stats.js'); const { zoomFov } = await import('/src/game/util.js');
    const g = window.__game, p = g.player, s = p.s;
    g.brains.forEach((b) => (b.update = () => {}));
    g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; });
    g.simulate = true; for (let i = 0; i < 20; i++) g.step(1 / 30);
    s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.yaw = 0.6; s.pitch = 0.05; s.protT = 1e9;
    if (g.post) g.post.on = false;
    g.scene.background = g.sun.color.clone().setRGB(0, 1, 0); g.scene.fog = null;                          // (Color örneği oyunun kendi three'sinden)
    for (const o of g.scene.children) o.visible = false;                                                    // dünya gizli (yeşil zemin)
    const hudEls = [...document.body.children].filter((e) => e !== g.canvas && !e.contains(g.canvas));
    window.__show = (mode) => {                                                                             // HUD: yalnız retikül öğeleri
      for (const e of hudEls) e.style.visibility = mode === 'hud' ? '' : 'hidden';
      const h = document.getElementById('hud');
      if (h) for (const c of h.querySelectorAll(':scope > *')) c.style.visibility = mode === 'hud' && /^(rdot|holo|scope|idot)$/.test(c.id) ? 'visible' : 'hidden';
    };
    window.__pose = (o) => {
      g.simulate = false;
      const SL = WSTATS[o.id].slot === 'secondary' ? 1 : 0;
      s.cur = SL; s.items[SL] = { id: o.id, mag: 30, reserve: 90 }; s.optic = o.optic; if (s.model) s.model.optic = o.optic;
      p.refreshWeapon();
      p.pipForce = !o.lensHud; s.lensHud = !!o.lensHud;                               // 12.128: ACOG PiP (telefonda düşük FPS yedeğine düşmesin); HUDy: yedek zorla
      const vm = p.vm; vm.noSway = true; vm.noFade = true; vm.forceShow = o.mode !== 'hud'; vm.probe?.(o.mode === 'probe');
      vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0; vm.breathT = 0; vm.sx = 0; vm.sy = 0;
      s.swing = null; s.reloadT = 0; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0; s.recoilP = 0; s.leanT = 0; s.ads = true;
      if (o.sway) { vm.noSway = false; vm.breathT = o.sway; }                            // SWAY=1: nefes / sallanma + tepme açıkken de retikül ortada mı
      for (let i = 0; i < 30; i++) { s.adsT = 1; if (o.sway) vm.kickR = 0.35; p.update(1 / 60); }
      g.camera.fov = zoomFov(p.baseFov(), p.camZoom()); g.camera.updateProjectionMatrix();      // 12.128: oyundaki gerçek dünya FOV'u (ACOG PiP'te mercek dışı ×1,15)
      vm.root.visible = o.mode !== 'hud';
      g.hud.update(1 / 60);
      window.__show(o.mode);
      return { optic: s.opticId, overlay: s.overlay, ret: s.opticDef?.reticle };
    };
    const list = [];
    for (const [id, st] of Object.entries(WSTATS)) if (st.kind === 'gun' && !st.ball) for (const o of OPTIC_ALLOWED[id] || []) list.push([id, o]);
    return list;
  });
  const dpr = await page.evaluate(() => devicePixelRatio);
  for (const [id, optic] of combos) {
    const key = `${id}:${optic}`;
    if (only && !only.test(key)) continue;
    const ret = {};
    const dot = optic === 'reddot', holo = optic === 'holo', scope = optic === 'acog' || optic === 'scope' || optic === 'scope6';
    const jobs = [];
    if (optic === 'iron') jobs.push(['gez', 'iron', 'iron']);
    else { jobs.push(['3D', 'probe', 'c']); if (!scope) jobs.push(['cam', 'glass', 'c']); }
    if (dot || holo || (optic !== 'acog' && (scope || dev !== 'desk'))) jobs.push(['HUD', 'hud', optic === 'iron' ? 'idot' : 'c']);      // ACOG ('lens', 12.127): HUD retikülü yok (masaüstü + telefon), mercekte PiP noktası
    if (optic === 'acog' && dev !== 'desk') jobs.push(['HUDy', 'hud', 'c']);                                 // 12.155: telefon yedeği (lensHud) HUD noktası
    for (const [name, mode, kind] of jobs) {
      const info = await page.evaluate((o) => window.__pose(o), { id, optic, mode, lensHud: name === 'HUDy', sway: process.env.SWAY ? 1.7 + rows.length * 0.37 : 0 });
      await page.waitForTimeout(90);
      const buf = await page.screenshot({ scale: 'device' });                  // cihaz pikseli (küçük retikül kaybolmasın) → CSS pikseline bölünür
      if (OUT) writeFileSync(`${OUT}/${dev}-${id}-${optic}-${name}.png`, buf);
      const k2 = kind;
      const r = await page.evaluate(ANALYZE, { b64: buf.toString('base64'), kind: k2, mode });
      for (const k of ['dx', 'dy', 'postDx', 'postDy', 'apDx', 'apDy', 'notchDx']) if (typeof r[k] === 'number') r[k] /= dpr;
      ret[name] = r;
    }
    // değerlendirme: en büyük |sapma|
    let worst = 0; const parts = [];
    for (const [n, r] of Object.entries(ret)) {
      const info = n === 'cam' || (n === 'HUD' && optic === 'iron' && dev === 'desk') || (n === '3D' && !SKINNED.has(id) && /^scope/.test(optic));   // bilgi: cam penceresi, masaüstü demirde HUD yok, eski dürbünlü modelde 3B retikül yok (tam nişanda model gizli)
      if (r.err) { if (!(n === 'HUD' && optic === 'iron' && dev === 'desk')) parts.push(`${n}: ${r.err}${info ? ' (bilgi)' : ''}`); if (!info) worst = Math.max(worst, 99); continue; }
      const v = n === 'gez' ? [r.postDx, r.postDy, process.env.SWAY ? 0 : r.apDx ?? r.notchDx ?? 0] : [r.dx, r.dy];   // demir: nişan noktası = arpacık tepesi (+ gez yatay ortası; SWAY'de gez tasarım gereği hafif oynar)
      const m = Math.max(...v.map((q) => Math.abs(q || 0)));
      if (!info) worst = Math.max(worst, m);
      parts.push(n === 'gez' ? `arpacık ${r.postDx.toFixed(1)},${r.postDy.toFixed(1)} (${r.postW}px) ${r.apDx !== undefined ? `delik ${r.apDx.toFixed(1)},${r.apDy.toFixed(1)} r${r.apR.toFixed(0)}` : r.notchDx !== undefined ? `çentik ${r.notchDx.toFixed(1)} (${r.notchW}px)` : 'delik ?'}` : `${n} ${r.dx.toFixed(1)},${r.dy.toFixed(1)}`);
    }
    const ok = worst <= LIMIT;
    rows.push({ dev, id, optic, ok, worst: +worst.toFixed(2), ret });
    console.log(`${ok ? 'OK  ' : 'HATA'} ${dev.padEnd(4)} ${key.padEnd(16)} en çok ${worst.toFixed(1)} px · ${parts.join(' · ')}`);
  }
  await ctx.close();
}
await browser.close();
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
const bad = rows.filter((r) => !r.ok);
console.log(`\n${rows.length} ölçüm, ${bad.length} hata (eşik ${LIMIT} px) · sayfa hatası: ${errs.length}`, errs.slice(0, 3));
process.exit(bad.length || errs.length ? 1 : 0);
