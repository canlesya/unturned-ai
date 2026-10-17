// New York (Enfekte, gece) görünüm karşılaştırması: 9 sabit uçuş bakışı + 2 oyuncu boyu bakış (fener açık), çizim yükü, kare süresi,
// çarpışma kutusu / nav / doğuş özeti (önce-sonra karşılaştırması için). Kullanım: OUT=/tmp/wb-ny-shots/after BASE=http://127.0.0.1:5191 node scripts/nyshots.mjs
// GPU=1: donanım GPU'su (varsayılan swiftshader) · ONLY=v1-…,v2-… yalnız bu bakışlar · PERF=1 (ONLY ile) yalnız ölçüm · FRAMES=120 ölçüm karesi
// HIDE=nyGlow,nySmoke,lights,moon,torch: efekt katmanını gizle (hata ayıklama) · MOBILE=1: dokunmatik öykünme (az nokta ışığı) · W / H görüntü boyu
import { chromium } from 'playwright';
import fs from 'fs';
import crypto from 'crypto';
const OUT = process.env.OUT || '/tmp/wb-ny-shots/after'; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:5180';
const args = process.env.GPU ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: +process.env.W || 1200, height: +process.env.H || 675 }, ...(process.env.MOBILE ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}) });          // MOBILE=1: dokunmatik öykünme (az ışık)
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await page.goto(`${BASE}/?autostart=6v6&map=newyork&type=inf&debug=1&dev=1&nolock=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await page.waitForTimeout(1500);

// ── veri: çarpışma kutuları, nav, doğuş, görüş küreleri (değişmemeli) ──
const data = await page.evaluate(() => {
  const g = window.__game, cs = g.world.colliders || g.map.colliders;
  const boxes = cs.map((c) => [...c.min, ...c.max].map((v) => v.toFixed(3)).join(',') + '|' + (c.tag || '')).join(';');
  const nav = g.nav, fold = (a) => a ? Array.from(a).reduce((h, v, i) => (h * 31 + Math.round(v * 100) * (i % 97 + 1)) % 1000000007, 7) : null, navSig = JSON.stringify([nav.w, nav.h, fold(nav.blocked), fold(nav.floor)]);
  return { colliders: cs.length, boxes, navSig, spawns: JSON.stringify(g.map.spawns.blue.concat(g.map.spawns.red)), perches: JSON.stringify(g.map.perches), sight: JSON.stringify(g.map.sight || []), bounds: JSON.stringify(g.map.bounds) };
});
let VIEWS_ONLY = null;
const H = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const sig = { colliders: data.colliders, colliderHash: H(data.boxes), navHash: H(data.navSig), spawnHash: H(data.spawns), perchHash: H(data.perches), sightHash: H(data.sight), bounds: data.bounds };

// ── kamera: hedefe bak ──
const look = (f, t) => { const dx = t[0] - f[0], dy = t[1] - f[1], dz = t[2] - f[2]; return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
if (process.env.HIDE) await page.evaluate((h) => { const names = h.split(','); window.__game.scene.traverse((o) => { if (names.includes(o.name) || (names.includes('lights') && o.isPointLight)) o.visible = false; }); if (names.includes('moon')) window.__game.sun.intensity = 0; if (names.includes('torch')) window.__game.torch.visible = false; }, process.env.HIDE);
if (process.env.ONLY) VIEWS_ONLY = process.env.ONLY.split(',');
await page.evaluate(() => { const g = window.__game; g.simOff = true; g.hud.root.style.display = 'none'; g.playerSoldier.protT = 999; g.brainsOff = g.brains.splice(0); g._vmR = g.player.vm.render; g.player.vm.render = () => {}; for (const s of g.soldiers) if (s !== g.playerSoldier) s.model.root.visible = false; });
const fly = async (name, from, to) => {
  const [yaw, pitch] = look(from, to);
  await page.evaluate(([f, yaw, pitch]) => { const g = window.__game, s = g.playerSoldier; s.fly = true; s.pos.set(f[0], f[1] - 1.6, f[2]); s.vel.set(0, 0, 0); s.yaw = yaw; s.pitch = pitch; for (let i = 0; i < 4; i++) g.step(1 / 30); }, [from, yaw, pitch]);
  await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}.png` });
};
const VIEWS = [
  ['v1-broadway-dogu', [-74, 3.5, 0], [0, 2, 0]],
  ['v2-meydan-ust', [-22, 15, 16], [0, 0, 0]],
  ['v3-5cadde-kuzey', [0, 3.2, 30], [0, 3, -40]],
  ['v4-yanan-araclar', [-60, 5.5, 14], [-52, 1.2, 2.6]],
  ['v5-cephe-yakin', [6, 7, 3], [16, 12, -13]],
  ['v6-krater', [24, 3.5, 9], [32, 0, 1.5]],
  ['v7-kus-bakisi', [0, 62, 58], [0, 0, 0]],
  ['v8-park', [-4, 3.5, 34], [-4, 1, 52]],
  ['v9-otopark', [-56, 9, -30], [-66, 3, -47]],
];
for (const [n, f, t] of VIEWS) if (!VIEWS_ONLY || VIEWS_ONLY.includes(n)) await fly(n, f, t);
if (VIEWS_ONLY && !process.env.PERF) { await browser.close(); process.exit(0); }

// ── çizim yükü + kare süresi (v1 bakışında) ──
const [y1, p1] = look([-74, 3.5, 0], [0, 2, 0]);
const perf = await page.evaluate(([yaw, pitch, frames]) => {
  const g = window.__game, s = g.playerSoldier, rd = g.renderer; s.fly = true; s.pos.set(-74, 1.9, 0); s.yaw = yaw; s.pitch = pitch; g.step(1 / 30);
  rd.info.autoReset = false; rd.info.reset(); rd.clear(); rd.render(g.scene, g.camera);
  const r = { calls: rd.info.render.calls, tris: rd.info.render.triangles };
  let lights = 0, pointLights = 0, shadowLights = 0; g.scene.traverse((o) => { if (o.isLight) { lights++; if (o.isPointLight) pointLights++; if (o.castShadow) shadowLights++; } });
  const gl = rd.getContext(), px = new Uint8Array(4);
  for (let i = 0; i < 5; i++) { rd.clear(); rd.render(g.scene, g.camera); } gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const N = frames, t0 = performance.now();
  for (let i = 0; i < N; i++) { g.step(1 / 60); rd.clear(); rd.render(g.scene, g.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  rd.info.autoReset = true;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return { ...r, lights, pointLights, shadowLights, frameMs: +((performance.now() - t0) / N).toFixed(1), gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?' };
}, [y1, p1, +process.env.FRAMES || 30]);

if (VIEWS_ONLY) { console.log(JSON.stringify(perf)); await browser.close(); process.exit(0); }
// ── oyuncu boyu (maç, fener açık) ──
const ground = async (name, x, z, to) => {
  const [yaw, pitch] = look([x, 1.7, z], to);
  await page.evaluate(([x, z, yaw, pitch]) => { const g = window.__game, s = g.playerSoldier; s.fly = false; s.pos.set(x, 0, z); g.world.settle?.(s); s.vel.set(0, 0, 0); s.yaw = yaw; s.pitch = pitch; g.torchOn = true; g.torch.intensity = g.night ? 140 : 0; g.hud.root.style.display = ''; if (g._vmR) g.player.vm.render = g._vmR; for (let i = 0; i < 6; i++) g.step(1 / 30); }, [x, z, yaw, pitch]);
  await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}.png` });
};
await ground('p1-dogus-dogu', -20, 0, [10, 1.5, 0]);
await ground('p2-yanan-taksi', -55, -7.5, [-52, 1.2, 2.6]);

const res = { sig, perf, errors: errs.length, errs: errs.slice(0, 4) };
fs.writeFileSync(`${OUT}/data.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
await browser.close();
