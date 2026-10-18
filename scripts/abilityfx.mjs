// Zombi gücü ekran geri bildirimi (src/game/abilityfx.js) denetimi: her tür + boss için yerel oyuncu o türe çevrilir, güç tetiklenir,
// etkinleşme / güç ortası / bitiş sonrası görüntü alınır; katmanlar güç durumuyla açılıp kapanmalı, konsol hatası olmamalı. Hazır parlaması da denetlenir.
//   GPU=1 node scripts/abilityfx.mjs   BASE=http://127.0.0.1:5232  DEV=desktop,pixel7  → /tmp/wb-zab-shots/<cihaz>-<güç>-<an>.png
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:5232', OUT = process.env.OUT || '/tmp/wb-zab-shots';
fs.mkdirSync(OUT, { recursive: true });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = { desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }, pixel7: strip(devices['Pixel 7 landscape']) };
const want = (process.env.DEV || 'desktop,pixel7').split(',');
const GPU = process.env.GPU !== '0';
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const TYPES = [['walker', 'rage'], ['runner', 'burst'], ['brute', 'shield'], ['ghost', 'cloak'], ['blinker', 'blink'], ['boss', 'shadow']];
const wait = (page, s) => page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), s * 1000);
const st = (page) => page.evaluate(() => { const f = window.__game.abfx, L = f.L, op = {}; for (const k in L) op[k] = +getComputedStyle(L[k]).opacity; return { ...f.state, op, fov: f.fovAdd, filter: window.__game.renderer.domElement.style.filter, abil: document.getElementById('abil').className, abn: document.getElementById('abn').textContent, act: window.__game.playerSoldier.abActive }; });

for (const dk of want) {
  const mob = dk !== 'desktop';
  const ctx = await browser.newContext({ ...DEVS[dk] });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(`${BASE}/?autostart=6v6&map=newyork&type=inf&debug=1&dev=1&nolock=1&third=0&time=600&touch=${mob ? 1 : 0}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  await page.evaluate(() => {
    const g = window.__game; g.brainsOff = g.brains.splice(0); g.timeLeft = g.mode.time - 60;      // botlar donuk, hazırlık süresi bitmiş
    const p = g.playerSoldier; p.fly = false;
    for (const s of g.soldiers) if (s !== p) s.pos.x += 400;
  });
  for (const [zt, id] of TYPES) {
    const pre = `${dk}-${id}`;
    await page.evaluate(([zt]) => {
      const g = window.__game, p = g.playerSoldier;
      g.makeZombie(p, zt === 'boss', zt === 'boss' ? undefined : zt);
      const b = g.map.spawns.blue[0]; p.spawn({ x: b.x, z: b.z, ry: b.ry || 0 }, 0); g.world.settle(p); p.protT = 0;
      p.abT = 0; p.abActive = 0; g.devGod = true; p.yaw = b.ry || 0;
    }, [zt]);
    await wait(page, 0.8);
    const s0 = await st(page);
    check(s0.on === '' && s0.op.vg === 0 && !s0.filter, `${pre}: güç öncesi katman kapalı`);
    // en açık yöne bak (ışınlanma tutsun)
    await page.evaluate(() => { const g = window.__game, p = g.playerSoldier, V = p.pos.constructor; let best = 0, by = p.yaw; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, o = new V(p.pos.x, p.pos.y + 0.9, p.pos.z), d = new V(-Math.sin(a), 0, -Math.cos(a)); const h = g.world.raycast(o, d, 20, {}); const t = h ? h.t : 20; if (t > best) { best = t; by = a; } } p.yaw = by; });
    await page.evaluate(() => window.__game.player.zAbility());
    await wait(page, 0.12);
    const s1 = await st(page);
    await page.screenshot({ path: `${OUT}/${pre}-1start.png` });
    check(s1.on === id, `${pre}: etkinleşti (state.on=${s1.on})`);
    check(/go/.test(s1.label) && s1.op.lbl > 0.05, `${pre}: ad etiketi canlanıyor (${s1.label} ${s1.op.lbl.toFixed(2)})`);
    const dur = { rage: 4, burst: 2.5, shield: 5, cloak: 6, blink: 0, shadow: 2 }[id];
    await wait(page, id === 'blink' ? 0.1 : dur / 2 - 0.2);
    if (id === 'shield') await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; g.devGod = false; p.takeDamage(40, g.soldiers.find((s) => s !== p), 'body', p.pos, 'x'); g.devGod = true; });
    if (id === 'shield') await wait(page, 0.04);
    const s2 = await st(page);
    if (dur > 0) { const ms = await page.evaluate(() => { const f = window.__game.abfx, t0 = performance.now(); for (let i = 0; i < 200; i++) f.update(0); return (performance.now() - t0) / 200; }); console.log(`   ${pre}: abfx.update ${ms.toFixed(3)} ms/kare · fps ${await page.evaluate(() => Math.round(window.__game._perf?.fps || 0))}`); }
    await page.screenshot({ path: `${OUT}/${pre}-2mid.png` });
    const sum = s2.op.vg + s2.op.ln + s2.op.cr + s2.op.sm + s2.op.sh + s2.op.fl;
    check(sum > 0.3 || id === 'blink', `${pre}: güç ortasında ekran katmanı açık (vg ${s2.op.vg.toFixed(2)} ln ${s2.op.ln.toFixed(2)} cr ${s2.op.cr.toFixed(2)} sm ${s2.op.sm.toFixed(2)} sh ${s2.op.sh.toFixed(2)} fl ${s2.op.fl.toFixed(2)} fov ${s2.fov.toFixed(1)} filtre "${s2.filter}")`);
    if (dur > 0) check(/on/.test(s2.abil) && /\d\.\d/.test(s2.abn), `${pre}: HUD geri sayımı "${s2.abn}"`);
    if (id === 'shield') check(s2.op.fl > 0.1, `${pre}: isabette sekme parlaması (${s2.op.fl.toFixed(2)})`);
    if (id === 'cloak') {                                                                     // hasar alınca görünmezlik bozulur → GÖRÜNDÜN
      await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; g.devGod = false; p.takeDamage(5, g.soldiers.find((s) => s !== p), 'body', p.pos, 'x'); g.devGod = true; });
      await wait(page, 0.1);
      const sr = await st(page);
      await page.screenshot({ path: `${OUT}/${pre}-2breveal.png` });
      check(/end/.test(sr.label) && sr.op.fl > 0.2, `${pre}: bozulunca "göründün" parlaması (fl ${sr.op.fl.toFixed(2)})`);
    }
    await wait(page, id === 'cloak' ? 1.2 : dur / 2 + 0.9);
    const s3 = await st(page);
    await page.screenshot({ path: `${OUT}/${pre}-3end.png` });
    check(s3.on === '' && s3.op.vg === 0 && s3.op.ln === 0 && s3.op.cr === 0 && s3.op.sm === 0 && s3.op.sh === 0 && !s3.filter && s3.fov === 0, `${pre}: bitince katmanlar kapandı (on="${s3.on}" filtre "${s3.filter}")`);
    // hazır parlaması: bekleme biterken
    await page.evaluate(() => { window.__game.playerSoldier.abT = 0.25; });
    await wait(page, 0.55);
    const s4 = await st(page);
    if (id === 'rage') await page.screenshot({ path: `${OUT}/${dk}-ready.png` });
    check(/rdyp/.test(s4.abil), `${pre}: hazır olunca gösterge parlıyor (${s4.abil})`);
  }
  // kalıcı katman sızıntısı yok: insana dönünce her şey kapalı
  await page.evaluate(() => { const g = window.__game; g.cure?.(g.playerSoldier); });
  await wait(page, 0.4);
  const sc = await st(page);
  check(sc.on === '' && !sc.filter, `${dk}: insana dönünce efekt yok`);
  check(!errs.length, `${dk}: konsol hatası yok${errs.length ? ' → ' + errs.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK'); process.exit(fail ? 1 : 0);
