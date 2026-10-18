// Görsel kalite denetimi (gerçek GPU): silah cilası + sahne ışığı + kalite kademeleri.  GPU=1 önerilir (swiftshader çok yavaş / farklı görünür)
//   node scripts/gfxshots.mjs <etiket=now> [bölümler=weapons,mobile,scenes,perf]   BASE=http://127.0.0.1:5180
//   → /tmp/wb-gfx-shots/<etiket>/{w-<silah>-hip|ads.png, m-<silah>.png, s-<harita>-<saat>-<kalite>.png, perf.json}
import { chromium, devices } from 'playwright';
import fs from 'fs';
const tag = process.argv[2] || 'now', parts = (process.argv[3] || 'weapons,mobile,scenes,perf').split(',');
const BASE = process.env.BASE || 'http://127.0.0.1:5180', OUT = `/tmp/wb-gfx-shots/${tag}`;
fs.mkdirSync(OUT, { recursive: true });
const GPU = process.env.GPU !== '0';
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const LV = { low: 1, med: 1.5, high: 2 };
const perf = {};

// Oyunu aç, botları dondur, ölümsüz yap, sabit bakış noktasına koy
async function open(ctxOpt, q, view = true) {
  const ctx = await browser.newContext(ctxOpt);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [sayfa hatası]', e.message));
  await page.goto(`${BASE}/?autostart=3v3&type=tdm&dev=1&debug=1&nolock=1&third=0&${q}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.evaluate((view) => {
    const g = window.__game; g.brainsOff = g.brains.splice(0); g.devGod = true;
    for (const s of g.soldiers) if (s !== g.playerSoldier) { s.pos.x += 400; }               // botlar görüntüye girmesin
    if (!view) return;
    const b = g.map.bounds, V3 = g.camera.position.constructor;
    let best = null;                                                                          // sabit (tohumsuz ızgara) bakış noktası: önü en açık, merkeze yakın nokta
    for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) {
      const x = b.minX + (b.maxX - b.minX) * i / 12, z = b.minZ + (b.maxZ - b.minZ) * j / 12;
      if (!g.nav.isFree(x, z)) continue;
      const y = g.world.heightAt(x, z) + 1.6, e = new V3(x, y, z);
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4; let d = 0;
        for (d = 4; d <= 60; d += 4) if (!g.world.clear(e, new V3(x - Math.sin(a) * d, y, z - Math.cos(a) * d))) break;
        const sc = d - Math.hypot(x - (b.minX + b.maxX) / 2, z - (b.minZ + b.maxZ) / 2) * 0.15;
        if (!best || sc > best.sc) best = { x, z, a, sc };
      }
    }
    const s = g.playerSoldier; s.pos.set(best.x, g.world.heightAt(best.x, best.z), best.z); s.vel.set(0, 0, 0);
    s.yaw = best.a; s.pitch = -0.03;
    for (const e of document.body.children) if (e !== g.canvas && !e.contains(g.canvas)) e.style.visibility = 'hidden';   // arayüz gizli: yalnız 3B görüntü
  }, view);
  await page.waitForTimeout(800);
  return { ctx, page };
}

async function measure(page) {
  return page.evaluate(async () => {
    const g = window.__game, r = g.renderer, gl = r.getContext(), px = new Uint8Array(4);
    r.info.autoReset = false; r.info.reset(); g.render(); const calls = r.info.render.calls, tris = r.info.render.triangles; r.info.autoReset = true;
    const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (let i = 0; i < 5; i++) g.render(); sync();
    const t0 = performance.now(); for (let i = 0; i < 40; i++) { g.render(); sync(); } const ms = (performance.now() - t0) / 40;
    g._perf && (g._perf.n = 0, g._perf.t = 0);
    await new Promise((res) => setTimeout(res, 3000));
    return { calls, tris, ms: +ms.toFixed(2), fps: Math.round(g._perf?.fps || 0), pr: r.getPixelRatio(), post: !!g.post?.on, shadow: r.shadowMap.enabled ? g.sun.shadow.mapSize.x : 0 };
  });
}

const GUNS = ['ak47', 'm4a1', 'scarh', 'aug', 'g36', 'ak74u', 'mp5', 'vector', 'p90', 'mac10', 'shotgun', 'aa12', 'dbl', 'pistol', 'm1911', 'deagle', 'revolver', 'sniper', 'svd', 'barrett', 'lmg', 'pkm', 'rpg', 'm79'];
const OTHER = ['knife', 'machete', 'tomahawk', 'grenade', 'smoke', 'flash', 'claymore', 'ammobox', 'medkit'];
async function setWeapon(page, id, ads) {
  await page.evaluate(({ id, ads }) => {
    const g = window.__game, s = g.playerSoldier, p = g.player;
    const slot = ['primary', 'secondary', 'gadget', 'melee'];
    s.items[0] = { id, mag: 30, reserve: 90 }; s.cur = 0; s.reloadT = 0; s.cd = 0; s.swing = null;
    s.ads = ads; p.refreshWeapon(); p.vm.raise = 0; p.vm.inspectT = 0;
  }, { id, ads });
  await page.waitForTimeout(ads ? 900 : 350);
}

if (parts.includes('weapons')) {
  const { ctx, page } = await open({ viewport: { width: 1280, height: 720 } }, 'map=colgecidi&tod=day&pr=2');
  for (const id of [...GUNS, ...OTHER]) {
    await setWeapon(page, id, false); await page.screenshot({ path: `${OUT}/w-${id}-hip.png` });
    if (GUNS.includes(id)) { await setWeapon(page, id, true); await page.screenshot({ path: `${OUT}/w-${id}-ads.png` }); }
  }
  for (const tod of ['sunset', 'night']) {                       // gün saatine göre silah ışığı
    const o = await open({ viewport: { width: 1280, height: 720 } }, `map=kasaba&tod=${tod}&pr=2`);
    for (const id of ['ak47', 'm4a1']) { await setWeapon(o.page, id, false); await o.page.screenshot({ path: `${OUT}/w-${id}-${tod}.png` }); }
    await o.ctx.close();
  }
  await ctx.close(); console.log('silahlar tamam');
}

if (parts.includes('mobile')) {
  const { ctx, page } = await open(strip(devices['Pixel 7 landscape']), 'map=depo&tod=day');
  for (const id of ['ak47', 'm4a1', 'mp5', 'pistol', 'shotgun', 'sniper']) { await setWeapon(page, id, false); await page.screenshot({ path: `${OUT}/m-${id}.png` }); }
  perf['pixel7-default'] = await measure(page);
  await ctx.close();
  for (const [lv, pr] of Object.entries(LV)) {
    const o = await open(strip(devices['Pixel 7 landscape']), `map=depo&tod=day&pr=${pr}`);
    perf[`pixel7-depo-${lv}`] = await measure(o.page); await o.page.screenshot({ path: `${OUT}/m-scene-${lv}.png` });
    await o.ctx.close();
  }
  console.log('mobil tamam');
}

if (parts.includes('scenes') || parts.includes('perf')) {
  const maps = (process.env.MAPS || 'colgecidi,kasaba,depo,liman,newyork').split(',');
  const tods = parts.includes('scenes') ? ['day', 'sunset', 'night'] : ['day'];
  for (const map of maps) for (const tod of tods) for (const [lv, pr] of Object.entries(LV)) {
    const o = await open({ viewport: { width: 1280, height: 720 } }, `map=${map}&tod=${tod}&pr=${pr}`);
    await setWeapon(o.page, 'm4a1', false);
    await o.page.screenshot({ path: `${OUT}/s-${map}-${tod}-${lv}.png` });
    if (tod === 'day') perf[`desk-${map}-${lv}`] = await measure(o.page);
    await o.ctx.close();
  }
  console.log('sahneler tamam');
}
fs.writeFileSync(`${OUT}/perf.json`, JSON.stringify(perf, null, 1));
for (const [k, v] of Object.entries(perf)) console.log(k.padEnd(24), JSON.stringify(v));
await browser.close();
