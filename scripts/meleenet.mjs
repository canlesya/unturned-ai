// 12.194 Yakın dövüş çevrim içi: A (Ali) ölüm maçı odası kurar, B (Veli) katılır; B, A'nın 1,4 m önünde.
// A bıçağı çeker (3): sol tık → sunucuda hızlı kesik (45), sağ tık basılı → ağır saplama (65); B'nin ekranında A'nın savurması doğru tür + ağır bayrağıyla (3. şahıs eğrisi) görünür;
// B sırtını dönünce A'nın ağır vuruşu arkadan tek vuruş. Sunucu BF_DEBUG=1.
//   node scripts/meleenet.mjs [url=http://127.0.0.1:5180] [ws=ws://127.0.0.1:8787]
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5180', ws = process.argv[3] || 'ws://127.0.0.1:8787';
const browser = await chromium.launch(process.env.GPU !== '0' ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const errs = [];
const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'tr-TR' }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
const q = `server=${encodeURIComponent(ws)}&debug=1&nolock=1`;
const A = await mk();
await A.goto(`${base}/?online=new&type=dm&per=4&map=kasaba&bots=0&name=Ali&${q}`);
await A.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 120000 });
const code = await A.evaluate(() => window.__game.opts.online.room);
const B = await mk();
await B.goto(`${base}/?online=${code}&name=Veli&${q}`);
await B.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 120000 });
await A.waitForTimeout(1500);
const spot = await A.evaluate(() => {
  const g = window.__game, s = g.playerSoldier;
  for (let k = 0; k < 400; k++) {
    const x = -40 + Math.random() * 80, z = -40 + Math.random() * 80, d = 1.4;
    if (!g.nav.isFree(x, z) || !g.nav.isFree(x, z - d) || !g.nav.isFree(x, z - d - 1)) continue;
    const ya = g.world.heightAt(x, z), yb = g.world.heightAt(x, z - d);
    if (Math.abs(ya - yb) > 0.03) continue;
    const e = s.eye().set(x, ya + 1.5, z), t = e.clone().set(x, yb + 1.5, z - d);
    if (g.world.clear(e, t)) return { a: [x, z], b: [x, z - d] };
  }
  return null;
});
check(!!spot, `açık alan ${JSON.stringify(spot)}`);
const tp = (p, xz) => p.evaluate((xz) => window.__game.online.send({ t: 'dbg', tp: xz, hp: 100 }), xz);
// B'de A'nın savurmalarını kaydet (kare başına)
await B.evaluate(() => { const g = window.__game; window.__sw = []; setInterval(() => { const a = g.soldiers.find((x) => x.name === 'Ali'); if (a?.swing) { const w = a.swing; const l = window.__sw[window.__sw.length - 1]; if (!l || l.ref !== w) window.__sw.push({ ref: w, kind: w.kind, hv: !!w.hv, dur: w.dur, k: [] }); window.__sw[window.__sw.length - 1].k.push(+(w.t / w.dur).toFixed(2)); } }, 16); });
async function round(back, heavy) {
  await tp(A, spot.a); await tp(B, spot.b); await A.waitForTimeout(700);
  await A.evaluate(() => { const s = window.__game.playerSoldier; s.yaw = 0; s.pitch = -0.1; });
  await B.evaluate((back) => { const s = window.__game.playerSoldier; s.yaw = back ? 0 : Math.PI; s.pitch = 0; }, back);
  await A.keyboard.press('Digit3'); await A.waitForTimeout(700);
  const cur = await A.evaluate(() => window.__game.playerSoldier.stat.kind);
  const hp0 = await B.evaluate(() => window.__game.playerSoldier.hp);
  await B.evaluate(() => { window.__sw.length = 0; });
  await A.mouse.move(480, 270);
  const btn = heavy ? 'right' : 'left';
  await A.mouse.down({ button: btn }); await A.waitForTimeout(heavy ? 120 : 60); await A.mouse.up({ button: btn });
  await A.waitForTimeout(1300);
  const hp1 = await B.evaluate(() => { const s = window.__game.playerSoldier; return s.alive ? s.hp : 0; });
  const sw = await B.evaluate(() => window.__sw.map(({ ref, ...r }) => ({ ...r, k: [r.k[0], r.k[r.k.length - 1], r.k.length] })));
  return { cur, hp0, hp1, sw };
}
{ const r = await round(false, false); check(r.cur === 'melee', `A bıçakta (${r.cur})`); check(Math.abs(r.hp0 - r.hp1 - 45) < 0.6, `sol tık önden: B ${r.hp0} → ${r.hp1} (45)`); check(r.sw.length === 1 && r.sw[0].kind === 'rl' && !r.sw[0].hv, `B'de A'nın savurması: ${JSON.stringify(r.sw)}`); }
{ const r = await round(false, true); check(Math.abs(r.hp0 - r.hp1 - 65.25) < 0.6, `sağ tık önden ağır: B ${r.hp0} → ${r.hp1} (65,25)`); check(r.sw.length === 1 && r.sw[0].kind === 'stab' && r.sw[0].hv && Math.abs(r.sw[0].dur - 0.62) < 0.01, `B'de A'nın ağır savurması: ${JSON.stringify(r.sw)}`); }
{ const r = await round(true, true); check(r.hp1 <= 0, `sağ tık arkadan: B ${r.hp0} → ${r.hp1} (öldü)`); }
check(errs.length === 0, `sayfa hatası yok ${errs.slice(0, 3)}`);
await browser.close();
console.log(fail ? `${fail} HATA` : 'hepsi geçti');
process.exit(fail ? 1 : 0);
