// 12.187: aracı BAŞKA istemciden görmek (üst düzey). A (sürücü) Kuzey Vadisi'nde jipe biner ve sürer; B 25 m'den izler: araç görünür mü,
// sürücü koltukta mı (B'de A.veh = araç, koltuk 0), konum akıcı mı (kare başı sıçrama), B'nin gösterdiği ↔ A'nın konumu (B gecikmesi kadar
// kaydırılınca). Sonra C geç katılır: aracı aynı yerde, sürücüsüyle görür mü; yok edilmiş araç C'de enkaz / ölü mü.
//   GPU=1 node scripts/netveh.mjs [url=http://127.0.0.1:5195] [ws=ws://127.0.0.1:8969] [çıktı=/tmp/wb-qa5/veh]
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5195', ws = process.argv[3] || 'ws://127.0.0.1:8969', OUT = process.argv[4] || '/tmp/wb-qa5/veh';
fs.mkdirSync(OUT, { recursive: true });
const bg = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const browser = await chromium.launch(process.env.GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', ...bg] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...bg] });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const errs = [];
const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
const q = `server=${encodeURIComponent(ws)}&debug=1&nolock=1&nologin=1`;
const ready = (p) => p.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
const A = await mk();
await A.goto(`${base}/?online=new&type=conquest&per=4&map=kuzey&tod=day&bots=0&time=3600&team=blue&name=Surucu&${q}`);
await ready(A);
const code = await A.evaluate(() => window.__game.opts.online.room);
const B = await mk();
await B.goto(`${base}/?online=${code}&team=blue&name=Izleyen&${q}`);
await ready(B);
await A.waitForTimeout(1500);
const key = (p, type, code) => p.evaluate(([type, code]) => document.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true })), [type, code]);
const press = async (p, code) => { await key(p, 'keydown', code); await p.waitForTimeout(80); await key(p, 'keyup', code); };
// mavi üsteki ilk sağlam jip + yanına ışınlan (sunucu konumu)
const jeep = await A.evaluate(() => { const g = window.__game, me = g.playerSoldier; const L = g.vehicles.list.filter((v) => v.type === 'jip' && v.alive && v.st); L.sort((a, b) => Math.hypot(a.st.x - me.pos.x, a.st.z - me.pos.z) - Math.hypot(b.st.x - me.pos.x, b.st.z - me.pos.z)); const v = L[0]; return v ? { i: v.idx, x: v.st.x, z: v.st.z, yaw: v.st.yaw, n: L.length } : null; });
check(!!jeep, `jip bulundu ${JSON.stringify(jeep)}`);
const side = (v, d) => [v.x + Math.cos(v.yaw) * d, v.z - Math.sin(v.yaw) * d];
await A.evaluate((xz) => window.__game.online.send({ t: 'dbg', tp: xz }), side(jeep, 2.4));
await B.evaluate((xz) => window.__game.online.send({ t: 'dbg', tp: xz }), side(jeep, -22));
await A.waitForTimeout(1200);
await press(A, 'KeyE');
await A.waitForTimeout(1200);
const inA = await A.evaluate(() => { const s = window.__game.playerSoldier; return { veh: s.veh?.idx ?? null, seat: s.seat }; });
check(inA.veh === jeep.i && inA.seat === 0, `A jipe sürücü olarak bindi (${JSON.stringify(inA)})`);
// B, aracı izler (her kare): aracın konumu, sürücü koltuğunda A mı, model görünür mü
const aId = await A.evaluate(() => window.__game.playerSoldier.id);
await B.evaluate(([vi, aid]) => {
  const g = window.__game, P = Object.getPrototypeOf(g), r0 = P.render, L = (window.__v = []);
  P.render = function (...a) { const v = g.vehicles.list[vi], s = g.soldiers[aid], me = g.playerSoldier; if (v.st) { const yaw = Math.atan2(-(v.st.x - me.pos.x), -(v.st.z - me.pos.z)); me.yaw = yaw; me.pitch = -0.08; } L.push({ t: performance.now() + performance.timeOrigin, x: v.st?.x, z: v.st?.z, drv: s.veh === v && s.seat === 0, vis: !!(v.view?.root?.visible ?? v.mesh?.visible ?? true), alive: v.alive }); return r0.apply(this, a); };
}, [jeep.i, aId]);
await A.evaluate((vi) => { const g = window.__game, P = Object.getPrototypeOf(g), r0 = P.render, L = (window.__v = []); P.render = function (...a) { const v = g.vehicles.list[vi]; L.push({ t: performance.now() + performance.timeOrigin, x: v.st?.x, z: v.st?.z }); return r0.apply(this, a); }; }, jeep.i);
// sür: 4 sn ileri, 1,5 sn sağa kırarak, 2 sn ileri
await key(A, 'keydown', 'KeyW'); await A.waitForTimeout(4000);
await key(A, 'keydown', 'KeyD'); await A.waitForTimeout(1500); await key(A, 'keyup', 'KeyD');
await B.bringToFront(); await B.waitForTimeout(300);
if (process.env.GPU) await B.screenshot({ path: `${OUT}/01-B-surulen-jip.png` });
await A.waitForTimeout(1700); await key(A, 'keyup', 'KeyW');
await A.waitForTimeout(2500);
const vb = await B.evaluate(() => window.__v), va = await A.evaluate(() => window.__v);
const mv = vb.filter((x) => x.x != null);
const jumps = mv.slice(1).map((x, i) => ({ d: Math.hypot(x.x - mv[i].x, x.z - mv[i].z), dt: (x.t - mv[i].t) / 1000 }));
const bad = jumps.filter((j) => j.d > 30 * Math.max(j.dt, 1 / 60) + 0.3);        // 30 m/sn'den hızlı görünen kare atlaması
const dist = Math.hypot(mv.at(-1).x - mv[0].x, mv.at(-1).z - mv[0].z);
check(dist > 15, `B'de jip yer değiştirdi (${dist.toFixed(1)} m)`);
check(!bad.length, `B'de jip akıcı: ${jumps.length} kare, > 30 m/sn sıçrama ${bad.length} (en büyük ${Math.max(...jumps.map((j) => j.d)).toFixed(2)} m)`);
const drvShare = mv.filter((x) => x.drv).length / mv.length;
check(drvShare > 0.95, `B'de sürücü koltuğunda A (${(drvShare * 100).toFixed(0)}% kare)`);
// B'nin gösterdiği konum ↔ A'nın konumu (B'nin gösterim gecikmesi kadar geride)
const dly = await B.evaluate(() => window.__game.online.stats.delay);
const errs2 = [];
for (const x of mv.filter((_, i) => i % 5 === 0)) {
  const tA = x.t - dly - 15, a = va.find((y) => y.t >= tA); if (!a || a.x == null) continue;
  errs2.push(Math.hypot(a.x - x.x, a.z - x.z));
}
errs2.sort((a, b) => a - b);
console.log(`B gecikmesi ${dly.toFixed(0)} ms · B ↔ A (gecikme kaydırılmış) medyan ${errs2[errs2.length >> 1]?.toFixed(2)} m · %95 ${errs2[Math.floor(errs2.length * 0.95)]?.toFixed(2)} m`);
check(errs2.length > 20 && errs2[errs2.length >> 1] < 1.5, 'B\'nin gördüğü jip A\'nınkiyle tutarlı (medyan < 1,5 m)');
// başka bir aracı yok et → geç katılan C enkazı görmeli
const other = await A.evaluate((vi) => { const L = window.__game.vehicles.list.filter((v) => v.alive && v.idx !== vi); return L[0]?.idx; }, jeep.i);
await A.evaluate((o) => window.__game.online.send({ t: 'dbg', vdmg: [o, 99999, 'at'] }), other);
await A.waitForTimeout(1500);
const C = await mk();
await C.goto(`${base}/?online=${code}&team=red&name=GecGelen&${q}`);
await ready(C);
await C.waitForTimeout(2000);
const now = async (p) => p.evaluate(([vi, o, aid]) => { const g = window.__game, v = g.vehicles.list[vi], w = g.vehicles.list[o], s = g.soldiers[aid]; return { x: v.st?.x, z: v.st?.z, drv: s.veh === v && s.seat === 0, otherAlive: w.alive, otherWreck: !!w.wreck, tod: g.opts.tod ?? g.tod, n: g.vehicles.list.filter((q) => q.alive).length }; }, [jeep.i, other, aId]);
const sb = await now(B), sc = await now(C);
console.log('B:', JSON.stringify(sb), '· C:', JSON.stringify(sc));
check(sc.x != null && Math.hypot(sc.x - sb.x, sc.z - sb.z) < 1, `geç katılan C jipi B ile aynı yerde görüyor (${sc.x != null ? Math.hypot(sc.x - sb.x, sc.z - sb.z).toFixed(2) : '?'} m)`);
check(sc.drv, 'C\'de sürücü koltuğunda A');
check(!sc.otherAlive && sb.otherAlive === sc.otherAlive && sb.otherWreck === sc.otherWreck, `yok edilen araç C'de de yok / enkaz (canlı ${sc.otherAlive}, enkaz ${sc.otherWreck}; B ${sb.otherAlive}/${sb.otherWreck})`);
check(sc.n === sb.n, `sağlam araç sayısı aynı (B ${sb.n} · C ${sc.n})`);
if (process.env.GPU) {
  await C.evaluate(([vi]) => { const g = window.__game, v = g.vehicles.list[vi], me = g.playerSoldier; g.online.send({ t: 'dbg', tp: [v.st.x - 12, v.st.z] }); }, [jeep.i]);
  await C.waitForTimeout(1200);
  await C.evaluate(([vi]) => { const g = window.__game, v = g.vehicles.list[vi], me = g.playerSoldier; me.yaw = Math.atan2(-(v.st.x - me.pos.x), -(v.st.z - me.pos.z)); me.pitch = -0.1; }, [jeep.i]);
  await C.bringToFront(); await C.waitForTimeout(500); await C.screenshot({ path: `${OUT}/02-C-gec-katilan.png` });
}
check(!errs.length, `sayfa hatası ${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
await browser.close();
process.exit(fail ? 1 : 0);
