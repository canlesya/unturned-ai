// Nişan geçişi zaman denetimi (gerçek oyun döngüsü g.step(1/60), 12.127): her kare silah modeli ilerlemesi ile dünya büyütmesi ilerlemesi, HUD retikülü / dürbün örtüsü / model görünürlüğü.
//   node scripts/adszoom.mjs [taban url]    DEV=desk|mob  ONLY=regex (silah:nişangâh)  JSON=dosya  V=1 (kare kare döküm)
// Ölçüler: model = kök konumu (bel → nişan, z), dünya = (gerçek büyütme − 1) / (hedef − 1), büyütme = tan(taban/2) / tan(fov/2).
// Eşikler: |model − dünya| ≤ 0,05 her karede · HUD retikülü (#rdot / #holo) yalnız dünya ≥ 0,95'te · dürbün çıkışında dünya ≥ ×2 iken 3B model görünmez (örtü ya da kararma ≥ 0,9 açık).
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180', DEV = process.env.DEV || 'desk', only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const COMBOS = [['ak47', 'iron'], ['ak47', 'reddot'], ['m4a1', 'holo'], ['m4a1', 'acog'], ['mp5', 'reddot'], ['lmg', 'holo'], ['pistol', 'iron'], ['sniper', 'scope'], ['barrett', 'scope6']].filter(([i, o]) => !only || only.test(`${i}:${o}`));
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = DEV === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
const page = await ctx.newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${DEV !== 'desk' ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
await page.evaluate(() => {
  const g = window.__game, p = g.player, s = p.s;
  g.brains.forEach((b) => (b.update = () => {}));
  g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; });
  s.protT = 1e9;
  window.__run = ({ id, optic }) => {
    g.simulate = false;                                                         // canlı döngü yalnız çizer; adımları test atar (her biri gerçek g.step)
    s.cur = 0; s.items[0] = { id, mag: 30, reserve: 90 }; s.optic = optic; if (s.model) s.model.optic = optic;
    p.refreshWeapon(); s.ads = false; s.adsT = 0; s.reloadT = 0; s.switchT = 0; s.sprinting = false; s.vel.set(0, 0, 0);
    const vm = p.vm; vm.noSway = true;
    for (let i = 0; i < 60; i++) g.step(1 / 60);
    vm.raise = 0; vm.kick = 0; vm.kickR = 0;
    const u = vm.model.userData, hip = vm.pos.z, tgt = vm.adsTarget(u).z + (s.stat.adsLow ? s.stat.adsLow[2] : 0), zE = p.zoomEff();
    const frames = [], hudEl = { dot: document.getElementById('rdot'), holo: document.getElementById('holo') }[s.overlay];
    const sc = document.getElementById('scope'), blk = document.getElementById('scopeblk');
    const rec = (ph) => {
      const base = p.baseFov(), fov = g.camera.fov, mag = Math.tan((base * Math.PI) / 360) / Math.tan((fov * Math.PI) / 360);
      frames.push({ ph, adsT: +s.adsT.toFixed(3), model: +((vm.root.position.z - hip) / (tgt - hip)).toFixed(3), world: +(zE > 1 ? (mag - 1) / (zE - 1) : 0).toFixed(3), mag: +mag.toFixed(3),
        hud: hudEl ? hudEl.style.display === 'block' : null, scope: sc.style.display === 'block', blk: +(+blk.style.opacity || 0).toFixed(2), model3d: vm.root.visible });
    };
    s.ads = true; for (let i = 0; i < 40; i++) { g.step(1 / 60); rec('in'); }
    s.ads = false; for (let i = 0; i < 40; i++) { g.step(1 / 60); rec('out'); }
    g.simulate = true;
    return { overlay: s.overlay, zE, frames };
  };
});
const rows = []; let bad = 0;
for (const [id, optic] of COMBOS) {
  const r = await page.evaluate((o) => window.__run(o), { id, optic });
  const F = r.frames, err = [];
  const dmax = Math.max(...F.map((f) => Math.abs(f.model - f.world)));
  if (r.zE > 1 && dmax > 0.05) err.push(`model − dünya en çok ${dmax.toFixed(3)}`);
  const hudEarly = F.filter((f) => f.hud && f.world < 0.95);
  if (hudEarly.length) err.push(`HUD retikülü dünya ${hudEarly[0].world} iken`);
  const hudMiss = r.overlay === 'dot' || r.overlay === 'holo' ? F.filter((f) => f.ph === 'in' && f.adsT >= 1 && !f.hud).length : 0;
  if (hudMiss) err.push(`tam nişanda HUD yok (${hudMiss} kare)`);
  const body = F.filter((f) => f.ph === 'out' && r.overlay === 'scope' && f.model3d && f.mag >= 2 && f.blk < 0.9);
  if (body.length) err.push(`dürbün çıkışı: ×${body[0].mag} dünyada 3B gövde (${body.length} kare)`);
  const reachM = F.findIndex((f) => f.model >= 0.95), reachW = F.findIndex((f) => f.world >= 0.95), hudAt = F.findIndex((f) => f.hud), scAt = F.findIndex((f) => f.scope);
  const outW = F.filter((f) => f.ph === 'out'), exitMag = outW.find((f) => f.model3d)?.mag ?? null;
  const row = { id, optic, overlay: r.overlay, zoom: r.zE, dmax: +dmax.toFixed(3), reachModel: reachM + 1, reachWorld: reachW + 1, hudFrame: hudAt >= 0 ? hudAt + 1 : null, scopeFrame: scAt >= 0 ? scAt + 1 : null, exitModelAtMag: exitMag, err };
  rows.push(row); if (err.length) bad++;
  console.log(`${err.length ? '✗' : '✓'} ${(id + ':' + optic).padEnd(16)} ×${+r.zE.toFixed(2)} model 0,95 @${row.reachModel}. kare, dünya @${row.reachWorld}. kare, fark ≤ ${row.dmax}${row.hudFrame ? `, HUD @${row.hudFrame}` : ''}${row.scopeFrame ? `, örtü @${row.scopeFrame}` : ''}${exitMag ? `, çıkışta model ×${exitMag}` : ''}${err.length ? '  → ' + err.join(', ') : ''}`);
  if (process.env.V) for (const f of F) console.log('   ', JSON.stringify(f));
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
console.log(`\n${DEV}: ${rows.length - bad}/${rows.length} uygun${errs.length ? ' · sayfa hatası: ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
process.exit(bad || errs.length ? 1 : 0);
