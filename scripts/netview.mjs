// 12.187: "Diğer oyuncunun gördüğü" çevrim içi denetimi. A (gözcü) oda kurar, B (aktör) katılır; ikisi açık alanda karşı karşıya.
// B sırayla: çömel, yat, kalk, sola / sağa eğil, nişan, şarjör, tabanca, bıçak savurma, fener, koşu, seri atış (yana yürürken).
// A'nın ekranındaki B: duruş / eğilme / nişan / silah / şarjör / savurma / fener bayrağı B'nin kendi durumuyla aynı mı, ne kadar gecikmeyle;
// B'nin atış izinin başlangıcı A'da B'nin GÖRÜNEN namlusuna ne kadar uzak (yana yürürken), ad / takım rengi / kıyafet kodu.
//   GPU=1 node scripts/netview.mjs [url=http://127.0.0.1:5195] [ws=ws://127.0.0.1:8969] [çıktı=/tmp/wb-qa5/view]
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5195', ws = process.argv[3] || 'ws://127.0.0.1:8969', OUT = process.argv[4] || '/tmp/wb-qa5/view';
fs.mkdirSync(OUT, { recursive: true });
const bg = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const browser = await chromium.launch(process.env.GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', ...bg] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...bg] });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const errs = [];
const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|WebSocket/.test(m.text())) errs.push(m.text()); }); return p; };
const q = `server=${encodeURIComponent(ws)}&debug=1&nolock=1`;
const MAP = process.env.MAP || 'kasaba';
const A = await mk();
await A.goto(`${base}/?online=new&type=tdm&per=2&map=${MAP}&tod=${process.env.TOD || 'sunset'}&bots=0&time=3600&team=blue&name=Gozcu&cls=assault&${q}`);
await A.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 120000 });
const code = await A.evaluate(() => window.__game.opts.online.room);
const B = await mk();
await B.goto(`${base}/?online=${code}&team=red&name=Aktor&cls=assault&${q}`);
await B.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 120000 });
await A.waitForTimeout(1500);
const bId = await B.evaluate(() => window.__game.playerSoldier.id);

// açık alan: A'nın çevresinde arası açık, aynı yükseklikte 9 m uzak bir nokta
const spot = await A.evaluate(() => {
  const g = window.__game, s = g.playerSoldier, V = s.pos.constructor, bd = g.map.bounds || { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };
  const ok = (x, z) => { const y = g.world.heightAt(x, z); return Number.isFinite(y) ? y : null; };
  const cands = [];
  for (let x = (bd.minX ?? -60) + 8; x < (bd.maxX ?? 60) - 8; x += 5) for (let z = (bd.minZ ?? -60) + 8; z < (bd.maxZ ?? 60) - 8; z += 5) cands.push([x, z, Math.hypot(x - (bd.minX + bd.maxX) / 2, z - (bd.minZ + bd.maxZ) / 2)]);
  cands.sort((p, q) => p[2] - q[2]);
  for (const [x, z] of cands) for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2, x2 = x + Math.sin(a) * 9, z2 = z + Math.cos(a) * 9, y1 = ok(x, z), y2 = ok(x2, z2);
    if (y1 == null || y2 == null || Math.abs(y1 - y2) > 0.4) continue;
    const e = new V(x, y1 + 1.6, z), t = new V(x2, y2 + 1.6, z2), lo = new V(x2, y2 + 0.4, z2), side = new V(x2 + Math.cos(a) * 3, y2 + 1.2, z2 - Math.sin(a) * 3), side2 = new V(x2 - Math.cos(a) * 3, y2 + 1.2, z2 + Math.sin(a) * 3);
    if (g.world.clear(e, t) && g.world.clear(e, lo) && g.world.clear(t, side) && g.world.clear(t, side2) && g.world.clear(e, side) && g.world.clear(e, side2) && g.world.clear(new V(x, y1 + 0.3, z), e)) return { a: [x, z], b: [x2, z2] };
  }
  return null;
});
check(!!spot, `açık alan ${JSON.stringify(spot)}`);
const tp = (p, xz) => p.evaluate((xz) => window.__game.online.send({ t: 'dbg', tp: xz, hp: 100 }), xz);
await tp(A, spot.a); await tp(B, spot.b);
await A.waitForTimeout(900);
const face = (p) => p.evaluate(() => { const g = window.__game, me = g.playerSoldier, o = g.soldiers.find((x) => x !== me && !x.vacant && x.alive); me.yaw = Math.atan2(-(o.pos.x - me.pos.x), -(o.pos.z - me.pos.z)); me.pitch = -0.03; });
await face(A); await face(B);
await A.waitForTimeout(600);

// A'da B'yi her karede izle (A'nın gördüğü) + B'de kendi durumu
await A.evaluate((id) => {
  const g = window.__game, P = Object.getPrototypeOf(g), r0 = P.render, L = (window.__seen = []), T = (window.__tr = []);
  P.render = function (...a) { const s = this.soldiers[id]; L.push({ t: performance.now(), c: s.crouching, p: s.prone, a: s.ads, l: s.leanDir, cur: s.cur, it: s.item?.id, rl: s.reloadT > 0, sw: !!s.swing, fl: !!s.flashNet, sp: s.sprinting, al: s.alive }); return r0.apply(this, a); };
  const fx = g.effects, tr0 = fx.tracer.bind(fx);
  fx.tracer = (from, to, c) => { const s = g.soldiers[id], m = s.muzzleWorld(new from.constructor()); T.push({ t: performance.now(), fx: from.x, fy: from.y, fz: from.z, mx: m.x, my: m.y, mz: m.z, px: s.pos.x, pz: s.pos.z, vx: s.vel.x, vz: s.vel.z, d: from.distanceTo(m) }); return tr0(from, to, c); };
}, bId);
await B.evaluate(() => {
  const g = window.__game, P = Object.getPrototypeOf(g), r0 = P.render, L = (window.__own = []);
  P.render = function (...a) { const s = this.playerSoldier; L.push({ t: performance.now(), c: s.crouching, p: s.prone, a: s.ads, l: s.leanDir, cur: s.cur, it: s.item?.id, rl: s.reloadT > 0, sw: !!s.swing, fl: !!s.flashOn, sp: s.sprinting, al: s.alive }); return r0.apply(this, a); };
});
const key = (p, type, code) => p.evaluate(([type, code]) => document.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true })), [type, code]);      // belgeye: window dinleyicilerine de kabarır (fener document'ta dinler)
const press = async (p, code) => { await key(p, 'keydown', code); await p.waitForTimeout(60); await key(p, 'keyup', code); };
const mouse = (p, type, button) => p.evaluate(([type, button]) => window.__game.canvas.dispatchEvent(new MouseEvent(type, { button, bubbles: true })), [type, button]);
const mouseUp = (p, button) => p.evaluate((button) => window.dispatchEvent(new MouseEvent('mouseup', { button, bubbles: true })), button);
const shot = async (name) => { if (!process.env.GPU) return; await A.bringToFront(); await A.waitForTimeout(120); await A.screenshot({ path: `${OUT}/${name}.png` }); };
const now = (p) => p.evaluate(() => performance.now());
const sameNow = async (fields) => { await A.waitForTimeout(700); const a = await A.evaluate(() => window.__seen.at(-1)), b = await B.evaluate(() => window.__own.at(-1)); const bad = fields.filter((f) => a[f] !== b[f]); return { a, b, bad }; };
// iki sayfanın saatleri aynı tarayıcıda ortak (performance.now kaynakları ayrı olabilir → zaman damgasını sayfa başına göreli al)
const clockOff = await (async () => { const a1 = await A.evaluate(() => performance.timeOrigin), b1 = await B.evaluate(() => performance.timeOrigin); return b1 - a1; })();
const lagX = async (field, act) => {
  const tB = await now(B); await act(); await B.waitForTimeout(900);
  const own = await B.evaluate(([f, t0]) => { const L = window.__own, i = L.findIndex((x) => x.t >= t0), v0 = L[Math.max(0, i - 1)]?.[f], e = L.slice(i).find((x) => x[f] !== v0); return e ? { t: e.t, v: e[f] } : null; }, [field, tB]);
  if (!own) { console.log('   (B yerelde değişmedi:', field, JSON.stringify(await B.evaluate(([f, t0]) => { const L = window.__own; return { n: L.length, after: L.filter((x) => x.t >= t0).length, vals: [...new Set(L.filter((x) => x.t >= t0).map((x) => x[f]))], last: L.at(-1) }; }, [field, tB])), ')'); return { v: null, ms: null }; }
  const tA = own.t + clockOff;
  const seen = await A.evaluate(([f, v, t0]) => { const e = window.__seen.find((x) => x.t >= t0 - 50 && x[f] === v); return e ? e.t : null; }, [field, own.v, tA]);
  return { v: own.v, ms: seen == null ? null : Math.round(seen - tA) };
};
const R = [];
const stage = async (name, field, act, fields) => {
  const L = await lagX(field, act);
  const s = await sameNow(fields);
  R.push({ name, field, v: L.v, lagMs: L.ms, bad: s.bad.join(',') });
  check(L.v !== null && L.ms !== null && !s.bad.length, `${name}: B ${field}=${JSON.stringify(L.v)} → A'da ${L.ms} ms sonra${s.bad.length ? ' · UYUŞMAZ: ' + s.bad.map((f) => `${f} A=${s.a[f]} B=${s.b[f]}`).join(' ') : ''}`);
  await shot(name);
};
const F = ['c', 'p', 'a', 'l', 'cur', 'it', 'fl'];
await shot('00-bos');
await stage('01-comel', 'c', () => press(B, 'KeyC'), F);
await stage('02-yat', 'p', () => press(B, 'KeyZ'), F);
await stage('03-kalk', 'p', () => press(B, 'Space'), F);
await stage('04-sola-egil', 'l', () => key(B, 'keydown', 'KeyQ'), F);
await key(B, 'keyup', 'KeyQ'); await B.waitForTimeout(500);
await stage('05-saga-egil', 'l', () => key(B, 'keydown', 'KeyE'), F);
await key(B, 'keyup', 'KeyE'); await B.waitForTimeout(500);
await stage('06-nisan', 'a', () => mouse(B, 'mousedown', 2), F);
await mouseUp(B, 2); await B.waitForTimeout(500);
await B.evaluate(() => { const it = window.__game.playerSoldier.item; it.mag = Math.max(1, it.mag - 10); });     // yerelde azalt: şarjör değişsin (sunucuda da R kenarıyla)
await B.evaluate(() => window.__game.online.send({ t: 'dbg', am: [0, 5, 90] }));
await B.waitForTimeout(400);
await stage('07-sarjor', 'rl', () => press(B, 'KeyR'), ['c', 'p', 'cur', 'it']);
await B.waitForTimeout(2500);
await stage('08-tabanca', 'cur', () => press(B, 'Digit2'), F);
await stage('09-bicak', 'cur', () => press(B, 'Digit3'), F);
await stage('10-savurma', 'sw', async () => { await mouse(B, 'mousedown', 0); await B.waitForTimeout(80); await mouseUp(B, 0); }, ['c', 'p', 'cur', 'it']);
await press(B, 'Digit1'); await B.waitForTimeout(800);
await stage('11-fener', 'fl', () => press(B, 'KeyF'), F);
await press(B, 'KeyF'); await B.waitForTimeout(400);
await stage('12-kosu', 'sp', async () => { await key(B, 'keydown', 'ShiftLeft'); await key(B, 'keydown', 'KeyW'); }, ['c', 'p', 'cur', 'it']);
await key(B, 'keyup', 'KeyW'); await key(B, 'keyup', 'ShiftLeft'); await B.waitForTimeout(300);
await tp(B, spot.b); await B.waitForTimeout(700); await face(B);
// ad / takım / kıyafet
const look = await A.evaluate((id) => { const g = window.__game, s = g.soldiers[id]; return { name: s.name, team: s.team, wear: s.wearCode || '', vis: !!s.model?.root?.visible, it: s.items.map((i) => i.id) }; }, bId);
const own = await B.evaluate(() => { const s = window.__game.playerSoldier; return { name: s.name, team: s.team, it: s.items.map((i) => i.id) }; });
check(look.name === own.name && look.team === own.team && JSON.stringify(look.it) === JSON.stringify(own.it) && look.vis, `ad / takım / eşyalar aynı: A'da ${JSON.stringify(look)} · B ${JSON.stringify(own)}`);
// iz başlangıcı: B yana yürürken seri ateş (A'ya nişanlı); A'da iz başlangıcı ↔ B'nin görünen namlusu
await A.evaluate(() => { window.__tr.length = 0; });
await B.evaluate(() => window.__game.online.send({ t: 'dbg', am: [0, 30, 90] }));
await A.evaluate(() => window.__game.online.send({ t: 'dbg', hp: 100000 }));
await B.waitForTimeout(300);
const strafe = async (k, ms) => { await key(B, 'keydown', k); await mouse(B, 'mousedown', 0); const t0 = Date.now(); while (Date.now() - t0 < ms) { await face(B); await B.waitForTimeout(50); } await mouseUp(B, 0); await key(B, 'keyup', k); };
await strafe('KeyD', 1200); await B.evaluate(() => window.__game.online.send({ t: 'dbg', am: [0, 30, 90] })); await strafe('KeyA', 1200);
await shot('13-yana-atis');
const tr = await A.evaluate(() => window.__tr);
const mv = tr.filter((x) => Math.hypot(x.vx, x.vz) > 2), d = mv.map((x) => x.d).sort((a, b) => a - b);
const med = d.length ? d[Math.floor(d.length / 2)] : null, p90 = d.length ? d[Math.floor(d.length * 0.9)] : null;
console.log(`iz: ${tr.length} (yürürken ${mv.length}) · iz başlangıcı ↔ görünen namlu: medyan ${med?.toFixed(2)} m · %90 ${p90?.toFixed(2)} m`);
check(mv.length > 5 && med < 0.3, `yürüyen atıcının izi görünen namlusundan çıkıyor (medyan ${med?.toFixed(2)} m < 0,3)`);
const ns = await A.evaluate(() => window.__game.online.stats), nb = await B.evaluate(() => window.__game.online.stats);
console.log('sıkıştırma (tarayıcı):', await A.evaluate(() => window.__game.online.ws.extensions || 'yok'));
console.log('A ağ:', JSON.stringify({ delay: Math.round(ns.delay), jit: Math.round(ns.jit), rtt: Math.round(ns.rtt) }), 'B ağ:', JSON.stringify({ corr: nb.corrections, rtt: Math.round(nb.rtt) }));
fs.writeFileSync(`${OUT}/sonuc.json`, JSON.stringify({ R, tr: { n: tr.length, med, p90 }, look }, null, 1));
check(!errs.length, `sayfa hatası ${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
await browser.close();
process.exit(fail ? 1 : 0);
