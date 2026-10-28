// 12.201 araç nişanı — çevrim içi (iki istemci, gerçek sunucu): A helikoptere pilot olarak biner, kalkar, burnu fareyle aşağı eğer (S basılı = yerinde
// asılı), burun topuyla aşağıya, Q / orta tıkla roket atar. Sunucunun yolladığı 'sh' / 'ts' olaylarından merminin çıkış pitch'i ölçülür (A ve B'de),
// A'nın tahmin ettiği burun eğimi ↔ B'nin gördüğü (sunucu) eğim, sağ tık = aracın yakınlaştırması (piyade optiği yok), inince nişan sıfır.
//   node scripts/vehaimnet.mjs [url=http://127.0.0.1:5183] [ws=ws://127.0.0.1:8964] [çıktı=/tmp/wb-vaim/net]
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5183', ws = process.argv[3] || process.env.WS || 'ws://127.0.0.1:8964', OUT = process.argv[4] || '/tmp/wb-vaim/net';
fs.mkdirSync(OUT, { recursive: true });
const bg = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', ...bg] });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const errs = [];
const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
const q = `server=${encodeURIComponent(ws)}&debug=1&nolock=1&nologin=1`;
const ready = (p) => p.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
const A = await mk();
await A.goto(`${base}/?online=new&type=conquest&per=4&map=kuzey&tod=day&bots=0&time=3600&team=blue&name=Pilot&${q}`);
await ready(A);
const code = await A.evaluate(() => window.__game.opts.online.room);
const B = await mk();
await B.goto(`${base}/?online=${code}&team=blue&name=Izleyen&${q}`);
await ready(B);
await A.waitForTimeout(1500);
const key = (p, type, code) => p.evaluate(([type, code]) => document.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true })), [type, code]);
const press = async (p, code) => { await key(p, 'keydown', code); await p.waitForTimeout(80); await key(p, 'keyup', code); };
const heli = await A.evaluate(() => { const g = window.__game, me = g.playerSoldier; const L = g.vehicles.list.filter((v) => v.def.heli && v.alive && v.st && v.team !== 'red'); L.sort((a, b) => Math.hypot(a.st.x - me.pos.x, a.st.z - me.pos.z) - Math.hypot(b.st.x - me.pos.x, b.st.z - me.pos.z)); const v = L[0]; return v ? { i: v.idx, id: v.id, x: v.st.x, z: v.st.z, yaw: v.st.yaw } : null; });
check(!!heli, `helikopter bulundu ${JSON.stringify(heli)}`);
const side = (v, d) => [v.x + Math.cos(v.yaw) * d, v.z - Math.sin(v.yaw) * d];
await A.evaluate((xz) => window.__game.online.send({ t: 'dbg', tp: xz }), side(heli, 3));
await B.evaluate((xz) => window.__game.online.send({ t: 'dbg', tp: xz }), side(heli, -40));
await A.waitForTimeout(1200);
// A: şikâyetteki durum — piyade silahında 4× ACOG, aç-kapa nişan
await A.evaluate(() => { const g = window.__game; g.playerSoldier.setOptic?.('acog'); g.opts.adsToggle = true; });
await press(A, 'KeyE');
await A.waitForTimeout(1200);
const inA = await A.evaluate(() => { const s = window.__game.playerSoldier; return { veh: s.veh?.idx ?? null, seat: s.seat }; });
check(inA.veh === heli.i && inA.seat === 0, `A helikoptere pilot olarak bindi (${JSON.stringify(inA)})`);
const aId = await A.evaluate(() => window.__game.playerSoldier.id);
// sunucu olayları: A'nın burun topu izleri ('sh' vm) ve roketleri ('ts' w: 1) — her iki istemcide
for (const P of [A, B]) await P.evaluate((aid) => { const g = window.__game; g._sh = []; g._ts = []; g.online.ws.addEventListener('message', (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.t !== 'ev') return; for (const x of m.l) { if (x.e === 'sh' && x.vm && x.by === aid && x.p) g._sh.push({ o: x.o, p: x.p }); if (x.e === 'ts' && x.w === 1 && x.by === aid) g._ts.push({ o: x.o, d: x.d }); } }); }, aId);
// B helikopteri izler (her kare bakış helikopterin önünde, burun topu izlerinin ortasına)
await B.evaluate((vi) => {
  const g = window.__game, P = Object.getPrototypeOf(g), r0 = P.render;
  P.render = function (...a) { const v = g.vehicles.list[vi], me = g.playerSoldier; if (v.st && v.st.y - g.world.heightAt(v.st.x, v.st.z) > 10) { const fx = -Math.sin(v.st.yaw), fz = -Math.cos(v.st.yaw), tx = v.st.x + fx * 22, tz = v.st.z + fz * 22, ty = v.st.y - 20, e = me.eye(); me.yaw = Math.atan2(-(tx - e.x), -(tz - e.z)); me.pitch = Math.atan2(ty - e.y, Math.hypot(tx - e.x, tz - e.z)); } return r0.apply(this, a); };
}, heli.i);
// kalkış: Boşluk 6 sn
await key(A, 'keydown', 'Space'); await A.waitForTimeout(6500); await key(A, 'keyup', 'Space');
await A.evaluate(([vi]) => { const g = window.__game, me = g.playerSoldier; me.yaw = g.vehicles.list[vi].st.yaw; me.pitch = -0.05; }, [heli.i]);
await A.waitForTimeout(1200);
const alt = await A.evaluate((vi) => { const g = window.__game, v = g.vehicles.list[vi]; return +(v.st.y - g.world.heightAt(v.st.x, v.st.z)).toFixed(1); }, heli.i);
check(alt > 25, `kalkış: zeminden ${alt} m`);
// sağ tık (aç-kapa): aracın yakınlaştırması, piyade optiği yok
await A.evaluate(() => { window.__game.playerSoldier.ads = true; });
await A.waitForTimeout(700);
const z1 = await A.evaluate(() => { const g = window.__game, P = g.player, me = g.playerSoldier; return { adsT: +me.adsT.toFixed(2), zoom: +(P.baseFov() / g.camera.fov).toFixed(2), lens: getComputedStyle(document.getElementById('lens') || document.body).display !== 'none' && !!document.getElementById('lens') && +getComputedStyle(document.getElementById('lens')).opacity > 0.05 }; });
await A.screenshot({ path: `${OUT}/01-A-pilot-sagtik.png` });
check(z1.adsT === 0 && !z1.lens && z1.zoom > 1.3 && z1.zoom < 1.8, `çevrim içi pilot sağ tık: aracın yakınlaştırması ×${z1.zoom}, piyade optiği yok (adsT ${z1.adsT})`);
await A.evaluate(() => { window.__game.playerSoldier.ads = false; });
// burun aşağı (bakış −0,6) + S (yerinde asılı)
await A.evaluate(() => { window.__game.playerSoldier.pitch = -0.6; });
await key(A, 'keydown', 'KeyS');
await A.waitForTimeout(3500);
const nose = await Promise.all([A, B].map((P) => P.evaluate((vi) => { const v = window.__game.vehicles.list[vi]; return { p: +v.st.pitch.toFixed(3), sp: +Math.hypot(v.st.vx || 0, v.st.vz || 0).toFixed(2) }; }, heli.i)));
console.log('   burun A (tahmin)', JSON.stringify(nose[0]), '· B (sunucu)', JSON.stringify(nose[1]));
check(nose[0].p < -0.35 && Math.abs(nose[0].p - nose[1].p) < 0.05, `burun eğimi A'da ${nose[0].p}, B'de (sunucu) ${nose[1].p} rad`);
check(nose[1].sp < 2, `burun aşağı + S: yerinde asılı (B'de yatay hız ${nose[1].sp} m/sn)`);
for (const P of [A, B]) await P.evaluate(() => { window.__game._sh.length = 0; window.__game._ts.length = 0; });
await A.evaluate(() => { window.__game.player.fireHeld = true; });
await A.waitForTimeout(500);
await B.bringToFront();
await Promise.all([A.screenshot({ path: `${OUT}/02-A-burun-asagi-ates.png` }), B.screenshot({ path: `${OUT}/03-B-burun-asagi-ates.png` })]);
await A.waitForTimeout(700);
await A.evaluate(() => { window.__game.player.fireHeld = false; });
await A.waitForTimeout(400);
const pit = (o, p) => Math.atan2(p[1] - o[1], Math.hypot(p[0] - o[0], p[2] - o[2]));
const sh = await Promise.all([A, B].map((P) => P.evaluate(() => { const g = window.__game; return g._sh.map((s) => ({ ...s, gy: g.world.heightAt(s.p[0], s.p[2]) })); })));
const sp = sh[1].map((s) => pit(s.o, s.p)), mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), grd = sh[1].filter((s) => Math.abs(s.p[1] - s.gy) < 2.5).length;
console.log(`   sunucu 'sh': A ${sh[0].length}, B ${sh[1].length} · çıkış pitch ort. ${mean(sp).toFixed(3)} rad (${(mean(sp) * 57.3).toFixed(1)}°) · ${grd} yere`);
check(sh[1].length >= 6 && mean(sp) < -0.45 && grd >= sh[1].length * 0.7, `çevrim içi burun topu aşağı: sunucu izleri ${sh[1].length}, çıkış ${mean(sp).toFixed(3)} rad, ${grd}/${sh[1].length} yere (eski: hep −0,05)`);
// roket: orta tık 0,8 sn
await A.evaluate(() => { window.__game.player.mmb = true; });
await A.waitForTimeout(800);
await A.evaluate(() => { window.__game.player.mmb = false; });
await A.waitForTimeout(500);
await B.screenshot({ path: `${OUT}/04-B-roket.png` });
const ts = await B.evaluate(() => window.__game._ts);
const rp = ts.map((r) => Math.atan2(r.d[1], Math.hypot(r.d[0], r.d[2])));
check(ts.length >= 2 && mean(rp) < -0.35, `çevrim içi roket (orta tık): ${ts.length} roket, pitch ${mean(rp).toFixed(3)} rad (burun ${nose[1].p})`);
await key(A, 'keyup', 'KeyS');
// sağ tık açıkken in → nişan / yakınlaştırma sıfır (aç-kapa nişan da)
await A.evaluate(() => { window.__game.playerSoldier.ads = true; window.__game.playerSoldier.pitch = 0; });
await key(A, 'keydown', 'KeyC'); await A.waitForTimeout(4500); await key(A, 'keyup', 'KeyC');
await press(A, 'KeyE');
await A.waitForTimeout(2500);
const ex = await A.evaluate(() => { const g = window.__game, P = g.player, me = g.playerSoldier; return { veh: !!me.veh, ads: me.ads, adsT: +me.adsT.toFixed(2), zoom: +(P.baseFov() / g.camera.fov).toFixed(2) }; });
check(!ex.veh && !ex.ads && ex.adsT === 0 && Math.abs(ex.zoom - 1) < 0.03, `inince nişan temiz (${JSON.stringify(ex)})`);
await A.screenshot({ path: `${OUT}/05-A-inince.png` });
const corr = await A.evaluate(() => window.__game.online.stats?.corr ?? null);
console.log('   sayfa hatası', errs.length, errs.slice(0, 3).join(' | '), corr != null ? `· tahmin düzeltmesi ${corr}` : '');
if (errs.length) fail++;
await browser.close();
console.log(fail ? `HATA ${fail}` : 'OK');
process.exit(fail ? 1 : 0);
