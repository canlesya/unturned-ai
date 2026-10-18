// New York (Enfekte, gece) 2. geçiş görünüm testi: 10 harita bakışı + 2 oyuncu boyu bakış, her zombi türü + boss 3. şahıs (yakın / orta, gece ışığı),
// zombi sürüsü sahnesi; çarpışma / nav / doğuş / perch / görüş özeti (önce-sonra aynı olmalı), çizim çağrısı + kare süresi.
// Kullanım: OUT=/tmp/wb-ny2-shots/after BASE=http://127.0.0.1:5216 GPU=1 node scripts/ny2shots.mjs   · ONLY=map|zombi|perf (virgülle) yalnız o bölüm
import { chromium } from 'playwright';
import fs from 'fs';
import crypto from 'crypto';
const OUT = process.env.OUT || '/tmp/wb-ny2-shots/after'; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:5216';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (k) => !ONLY || ONLY.includes(k);
const args = process.env.GPU ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: +process.env.W || 1280, height: +process.env.H || 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await page.goto(`${BASE}/?autostart=6v6&map=newyork&type=inf&debug=1&dev=1&nolock=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await page.waitForTimeout(1500);
const H = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const data = await page.evaluate(() => {
  const g = window.__game, cs = g.world.colliders || g.map.colliders;
  const boxes = cs.map((c) => [...c.min, ...c.max].map((v) => v.toFixed(3)).join(',') + '|' + (c.tag || '')).join(';');
  const nav = g.nav, fold = (a) => a ? Array.from(a).reduce((h, v, i) => (h * 31 + Math.round(v * 100) * (i % 97 + 1)) % 1000000007, 7) : null;
  return { colliders: cs.length, boxes, navSig: JSON.stringify([nav.w, nav.h, fold(nav.blocked), fold(nav.floor)]), spawns: JSON.stringify(g.map.spawns.blue.concat(g.map.spawns.red)), perches: JSON.stringify(g.map.perches), sight: JSON.stringify(g.map.sight || []), bounds: JSON.stringify(g.map.bounds), roads: JSON.stringify(g.map.roads) };
});
const sig = { colliders: data.colliders, colliderHash: H(data.boxes), navHash: H(data.navSig), spawnHash: H(data.spawns), perchHash: H(data.perches), sightHash: H(data.sight), roadHash: H(data.roads), bounds: data.bounds };
// sahne denetimi: simülasyon durur, çizim sürer; kamera elle
await page.evaluate(() => {
  const g = window.__game; g.simulate = false; g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  for (const s of g.soldiers) s.model.root.visible = false;
  window.__cam = (f, t) => { const c = g.camera; c.position.set(...f); c.lookAt(...t); c.updateMatrixWorld(); };
});
const shot = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: `${OUT}/${name}.png` }); };
const VIEWS = [
  ['v01-broadway-dogu', [-74, 3.5, 0], [0, 2, 0]],
  ['v02-meydan-ust', [-22, 15, 16], [0, 0, 0]],
  ['v03-5cadde-kuzey', [0, 3.2, 30], [0, 3, -40]],
  ['v04-yanan-araclar', [-60, 5.5, 11], [-52, 1.2, 2.6]],
  ['v05-cephe-yakin', [6, 7, 3], [16, 12, -13]],
  ['v06-krater', [24, 3.5, 9], [32, 0, 1.5]],
  ['v07-kus-bakisi', [0, 62, 58], [0, 0, 0]],
  ['v08-park', [-4, 3.5, 34], [-4, 1, 52]],
  ['v09-otopark', [-56, 9, -30], [-66, 3, -47]],
  ['v10-dukkan-cephesi', [-37, 1.8, 10.6], [-58, 3.2, 13]],
  ['p1-dogus-dogu', [-20, 1.7, 0], [10, 1.5, 0]],
  ['p2-yanan-taksi', [-55, 1.7, -7.5], [-52, 1.2, 2.6]],
  ['p3-kaldirim-asfalt', [30, 1.7, -10], [50, 0, -2]],
  ['c1-vitrin-yakin', [-58, 1.7, 9.2], [-58, 2.0, 13]],
  ['c2-pencere-yakin', [-57, 8.6, 9.8], [-58, 8.2, 13]],
  ['c3-yanik-taksi', [-10, 1.9, 7.8], [-13, 0.7, 4.2]],
  ['c4-yangin-merdiveni', [12, 8.5, 7.5], [12, 9.5, 13]],
];
if (want('map')) {
  for (const [n, f, t] of VIEWS) { await page.evaluate(([f, t]) => window.__cam(f, t), [f, t]); await shot(n); }
  const mh = await page.evaluate(() => window.__game.map.decor?.manholes?.find(([x, z]) => Math.abs(z) < 9 || Math.abs(x) < 7) || [21.733, -8.278]);   // eski sürümde decor yok: aynı nokta
  if (mh) { await page.evaluate((m) => window.__cam([m[0] + 1.2, 1.7, m[1] + 1.2], [m[0], 0, m[1]]), mh); await shot('c6-rogar'); }
  const hl = await page.evaluate(() => (window.__game.map.decor?.holes || []).filter((h) => Math.abs(Math.abs(h[2]) - 13) < 0.1 && Math.abs(h[0]) < 70).sort((a, b) => b[3] - a[3] || a[1] - b[1])[0] || [-58.744, 9.239, -13, 1]);   // Broadway'e bakan, alçak, yanan delik (eski sürümde aynı nokta)
  if (hl) { await page.evaluate((h) => { const s = Math.sign(h[2]); window.__cam([h[0] + 2, h[1] + 0.5, h[2] - s * 7], [h[0], h[1], h[2]]); }, hl); await shot('c5-delik-cephe'); }
}

// ── zombiler: her tür yakın + orta, gece (fener kapalı; ateş / lamba ışığında) ──
let zstats = null;
if (want('zombi')) {
  await page.evaluate(() => {
    const g = window.__game, p = g.playerSoldier;
    window.__pool = g.soldiers.filter((s) => s !== p);
    window.__pose = (z, x, zz, ry, spd, n = 24) => {                                   // yerleştir + yürüyüş animasyonunu ilerlet
      z.pos.set(x, 0, zz); z.yaw = ry; z.bodyYaw = ry; z.pitch = 0; z.alive = true; z.protT = 0; z.onGround = true; z.abActive = 0; z.cloakNet = false;
      z.vel.set(-Math.sin(ry) * spd, 0, -Math.cos(ry) * spd); z.sprinting = false;
      z.model.root.visible = true;
      for (let i = 0; i < n; i++) { g.time += 1 / 30; z.syncModel(1 / 30); }
      z.model.root.visible = true;
    };
  });
  const types = ['walker', 'runner', 'brute', 'ghost', 'blinker', 'boss'];
  for (const [i, t] of types.entries()) {
    // yanan taksi (-52, 2.6) ışığında, kameraya doğru yürür; yakın 2.6 m, orta 8 m
    await page.evaluate(([i, t]) => {
      const g = window.__game, pool = window.__pool;
      for (const s of g.soldiers) s.model.root.visible = false;
      const z = pool[i]; g.makeZombie(z, t === 'boss', t === 'boss' ? 'walker' : t); z.alive = true; z.hp = z.maxHp;
      window.__z = z;
    }, [i, t]);
    const cx = -49, cz = -2.6, zx = cx - 2.4, zz = cz - 0.4, boss = t === 'boss';
    const top = boss ? 1.75 : t === 'brute' ? 1.35 : 1.2, ch = boss ? 2.0 : 1.5;
    await page.evaluate(([zx, zz]) => { const z = window.__z; window.__pose(z, zx, zz, -Math.PI / 2 + 0.25, 1.4); }, [zx, zz]);
    await page.evaluate(([zx, zz, top, ch, b]) => window.__cam([zx + (b ? 2.6 : 1.8), ch, zz + (b ? 0.8 : 0.55)], [zx, top, zz]), [zx, zz, top, ch, boss]);
    await shot(`z-${t}-yakin`);
    await page.evaluate(([cx, cz]) => { const z = window.__z; window.__pose(z, cx - 6.5, cz + 0.5, -Math.PI / 2 + 0.1, 1.4, 10); }, [cx, cz]);
    await page.evaluate(([cx, cz]) => window.__cam([cx + 1.5, 1.7, cz + 0.6], [cx - 6.5, 1.0, cz + 0.5]), [cx, cz]);
    await shot(`z-${t}-orta`);
    await page.evaluate(([zx, zz]) => { const z = window.__z; window.__pose(z, zx, zz, -Math.PI / 2 + 1.35, 0.0, 30); }, [zx, zz]);     // yandan siluet (dururken)
    await page.evaluate(([zx, zz, top, ch, b]) => window.__cam([zx + (b ? 3.4 : 2.4), ch - 0.1, zz + 0.3], [zx, top - 0.1, zz]), [zx, zz, top, ch, boss]);
    await shot(`z-${t}-yan`);
  }
  zstats = await page.evaluate(() => {                                                 // tür başına görünür ağ (≈ çizim çağrısı) + üçgen
    const g = window.__game, out = {};
    for (const t of ['walker', 'runner', 'brute', 'ghost', 'blinker', 'boss']) {
      const z = window.__pool[0]; g.makeZombie(z, t === 'boss', t === 'boss' ? 'walker' : t);
      let n = 0, tri = 0; const vis = (o) => { for (let q = o; q; q = q.parent) { if (q === z.model.root) return true; if (!q.visible) return false; } return true; };
      z.model.root.traverse((o) => { if (o.isMesh && vis(o)) { n++; tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
      out[t] = { meshes: n, tris: Math.round(tri) };
    }
    return out;
  });
  // sürü: Broadway'de 11 zombi kameraya doğru (doğu → batı bakış, yangın ışığı arkada)
  await page.evaluate(() => {
    const g = window.__game, pool = window.__pool, T = ['walker', 'runner', 'brute', 'walker', 'ghost', 'blinker', 'runner', 'walker', 'brute', 'walker', 'runner'];
    pool.forEach((z, i) => {
      g.makeZombie(z, i === 0, i === 0 ? 'walker' : T[i]); z.alive = true;
      const x = -43 - (i % 4) * 2.4 - Math.floor(i / 4) * 3.2 - (i * 0.9) % 1.4, zz = -3.8 + ((i * 2.7) % 7);
      window.__pose(z, x, zz, -Math.PI / 2 + ((i * 0.37) % 0.5) - 0.25, i % 3 === 1 ? 4.6 : 1.4, 12 + i * 3);
    });
    window.__cam([-39.6, 1.75, 0.6], [-52, 1.2, -0.4]);
  });
  await shot('z-suru');
  await page.evaluate(() => window.__cam([-39.6, 3.6, 4.5], [-50, 0.6, -0.8]));
  await shot('z-suru-ust');
}

// ── çizim yükü + kare süresi (v1 bakışı, zombiler gizli) ──
let perf = null;
if (want('perf')) perf = await page.evaluate((frames) => {
  const g = window.__game, rd = g.renderer; for (const s of g.soldiers) s.model.root.visible = false;
  window.__cam([-74, 3.5, 0], [0, 2, 0]);
  rd.info.autoReset = false; rd.info.reset(); rd.clear(); rd.render(g.scene, g.camera);
  const r = { calls: rd.info.render.calls, tris: rd.info.render.triangles };
  const gl = rd.getContext(), px = new Uint8Array(4);
  for (let i = 0; i < 5; i++) { rd.clear(); rd.render(g.scene, g.camera); } gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const ms = [];                                                                       // 3 bakışta ortalama (GPU saat dalgalanması için her biri 2 tur, en iyisi)
  for (const [f, t] of [[[-74, 3.5, 0], [0, 2, 0]], [[6, 7, 3], [16, 12, -13]], [[-20, 1.7, 0], [10, 1.5, 0]]]) {
    window.__cam(f, t); let best = 1e9;
    for (let k = 0; k < 2; k++) { const t0 = performance.now(); for (let i = 0; i < frames; i++) { g.map.fx?.update(i / 60); rd.clear(); rd.render(g.scene, g.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } best = Math.min(best, (performance.now() - t0) / frames); }
    ms.push(+best.toFixed(2));
  }
  const frameMs = +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2);
  // zombi başına çizim çağrısı (tek model)
  const z = window.__pool?.[1] || g.soldiers[1]; let zc = 0, zt = 0; z.model.root.traverse((o) => { if (o.isMesh) { zc++; zt += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  rd.info.autoReset = true;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return { ...r, frameMs, viewMs: ms, zombieMeshes: zc, zombieTris: Math.round(zt), gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?' };
}, +process.env.FRAMES || 120);
const res = { sig, perf, zstats, errors: errs.length, errs: errs.slice(0, 4) };
fs.writeFileSync(`${OUT}/data.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
await browser.close();
