// 12.174 Cephe dönem nişangâhları: her 1940'lar silahı × izinli nişangâh, Batı Cephesi'nde (Mavi siperi, 35 m önde duran hedef) bel / %70 / tam nişan kareleri.
//   node scripts/ww2optics.mjs <çıktı klasörü> [taban url]    DEV=desk|mob  ONLY=regex (silah-nişangâh)  T=0,0.7,1  POS='[x,y,z,yaw]'
// Kare adı: <dev>-<silah>-<nişangâh>-<yüzde>.png (montaj: scripts/ww2optics.py). Gerçek GPU (headless:false); HUD'da yalnız nişan öğeleri.
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-ww2optic/now', base = process.argv[3] || 'http://127.0.0.1:5180';
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null, dev = process.env.DEV || 'desk';
const TS = (process.env.T || '0,0.7,1').split(',').map(Number);
const POS = process.env.POS ? JSON.parse(process.env.POS) : [-3, -1.6, 112.6, 0];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
const page = await ctx.newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=4v4&map=cephe&type=front&debug=1&dev=1&nolock=1&third=0&team=blue&cls=sniper${dev === 'mob' ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player && window.__game.playerSoldier.alive', null, { timeout: 180000 });
await page.waitForTimeout(1200);
const combos = await page.evaluate(async (P) => {
  const { WSTATS, OPTIC_ALLOWED } = await import('/src/game/stats.js');
  const g = window.__game, p = g.player, s = p.s;
  g.brains.length = 0; g.timeLeft = 900; g.devGod = true;
  const tgt = g.soldiers.find((o) => o !== s && o.team !== s.team);
  for (const o of g.soldiers) if (o !== s && o !== tgt) { o.brain = null; o.alive = false; o.respawnT = 1e9; o.model.root.visible = false; }
  s.pos.set(P[0], P[1], P[2]); s.yaw = P[3]; s.pitch = 0.012; s.vel.set(0, 0, 0); s.protT = 1e9;
  if (tgt) { tgt.brain = null; const z = P[2] - 35; tgt.pos.set(P[0] + 0.4, g.world.heightAt(P[0] + 0.4, z), z); tgt.yaw = Math.PI; tgt.vel.set(0, 0, 0); tgt.alive = true; tgt.protT = 1e9; tgt.model.root.visible = true; tgt.syncModel?.(0); }
  const hudEls = [...document.body.children].filter((e) => e !== g.canvas && !e.contains(g.canvas));
  window.__pose = (o) => {
    for (const e of hudEls) e.style.visibility = 'hidden';
    const h = document.getElementById('hud'); if (h) { h.style.visibility = 'visible'; for (const c of h.querySelectorAll(':scope > *')) c.style.visibility = /^(rdot|holo|scope|idot|cross|scopeblk|advig|breath)$/.test(c.id) ? 'visible' : 'hidden'; }
    const SL = WSTATS[o.id].slot === 'secondary' ? 1 : 0;
    s.cur = SL; s.items[SL] = { id: o.id, mag: 30, reserve: 90 }; s.optic = o.optic; if (s.optics) s.optics[o.id] = o.optic;      // (12.174 öncesi sürümde silah başına seçim yok)
    p.refreshWeapon();
    s.pos.set(P[0], P[1], P[2]); s.yaw = P[3]; s.pitch = 0.012; s.vel.set(0, 0, 0);
    const vm = p.vm; vm.noSway = true; vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0; vm.breathT = 0; vm.sx = 0; vm.sy = 0;
    s.swing = null; s.reloadT = 0; s.cd = 0; s.sprinting = false; s.useT = 0; s.recoilP = 0; s.leanT = 0; s.ads = o.t > 0.5;
    for (let i = 0; i < 60; i++) { s.adsT = o.t; p.update(1 / 60); g.hud.update(1 / 60); }
    return { overlay: s.overlay, optic: s.opticId, zoom: p.zoomCur(), fov: g.camera.fov };
  };
  const list = [];
  for (const [id, st] of Object.entries(WSTATS)) if (st.era && st.kind === 'gun') for (const o of OPTIC_ALLOWED[id] || []) list.push([id, o]);
  return list;
}, POS);
const rows = [];
for (const [id, optic] of combos) for (const t of TS) {
  const name = `${dev}-${id}-${optic}-${Math.round(t * 100)}`;
  if (only && !only.test(`${id}-${optic}`)) continue;
  const info = await page.evaluate((q) => window.__pose(q), { id, optic, t });
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${out}/${name}.png` });
  rows.push({ name, id, optic, t, ...info });
  console.log(`${name.padEnd(34)} ${info.optic} · ${info.overlay} · büyütme ×${info.zoom.toFixed(2)} · FOV ${info.fov.toFixed(1)}`);
}
writeFileSync(`${out}/rows.json`, JSON.stringify(rows, null, 1));
console.log(`${rows.length} kare · hata:`, errs.length, errs.slice(0, 5));
await browser.close();
