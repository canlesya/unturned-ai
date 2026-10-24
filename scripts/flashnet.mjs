// 12.159: Fener çevrimiçi. A (Ali) gece Kasaba odası kurar, B (Veli) katılır, ikisi açık alanda karşı karşıya. A feneri açar → B'de A'nın feneri
// (gerçek ışık havuzu + hüzme + uç parıltısı) görünür; A B'ye bakınca göz kamaştırma; A kapatınca söner; A ölünce söner. Işık / malzeme programı
// sayısı fener açılınca artmamalı (sabit havuz). Sunucu BF_DEBUG=1.
//   GPU=1 node scripts/flashnet.mjs [url=http://127.0.0.1:5259] [ws=ws://127.0.0.1:8859]   → /tmp/wb-flash-shots/*.png
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5259', ws = process.argv[3] || 'ws://127.0.0.1:8859', OUT = '/tmp/wb-flash-shots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const errs = [];
const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|WebSocket/.test(m.text())) errs.push(m.text()); }); return p; };
const q = `server=${encodeURIComponent(ws)}&debug=1&nolock=1`;
const A = await mk();
await A.goto(`${base}/?online=new&type=tdm&per=2&map=kasaba&tod=night&bots=0&team=blue&name=Ali&${q}`);
await A.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 120000 });
const code = await A.evaluate(() => window.__game.opts.online.room);
const B = await mk();
await B.goto(`${base}/?online=${code}&team=blue&name=Veli&${q}`);
await B.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 120000 });
await A.waitForTimeout(1500);

// açık alan: A'nın yanında, arası açık ve 10 m uzakta bir nokta (B oraya)
const spot = await A.evaluate(() => {
  const g = window.__game, s = g.playerSoldier, e = s.eye();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, x = s.pos.x + Math.sin(a) * 11, z = s.pos.z + Math.cos(a) * 11, y = g.world.heightAt(x, z) + 1.6;
    const t = new e.constructor(x, y, z);
    if (Math.abs(y - e.y) < 1 && g.world.clear(e, t)) return { a: [s.pos.x, s.pos.z], b: [x, z] };
  }
  return null;
});
check(!!spot, `açık alan bulundu ${JSON.stringify(spot)}`);
const tp = (p, xz) => p.evaluate((xz) => window.__game.online.send({ t: 'dbg', tp: xz, hp: 100 }), xz);
await tp(A, spot.a); await tp(B, spot.b);
await A.waitForTimeout(800);
// B, A'ya bakar; A yana (B'nin görüş alanında hüzme yere / duvara uzansın) bakar
const face = (p, side) => p.evaluate((side) => {
  const g = window.__game, me = g.playerSoldier, o = g.soldiers.find((x) => x !== me && !x.vacant && x.alive && x.name);
  const yaw = Math.atan2(-(o.pos.x - me.pos.x), -(o.pos.z - me.pos.z)) + side;
  me.yaw = yaw; me.pitch = side ? -0.18 : -0.02; return o.id;
}, side);
const aId = await face(B, 0); await face(A, 1.2);
await B.waitForTimeout(1500);
const st = (p, id) => p.evaluate((id) => {
  const g = window.__game, rt = g.remoteTorch, s = g.soldiers[id], sl = rt.slots.find((x) => x.s === s);
  return { net: !!s.flashNet, slot: !!sl, beam: !!sl?.beam.visible, glare: sl ? +sl.glare.material.opacity.toFixed(2) : 0, lights: rt.lights.filter((l) => l.intensity > 0).length,
    nLights: rt.lights.length, programs: g.renderer.info.programs.length, ownTorch: !!g.torchOn };
}, id);
const shot = async (p, name) => { await p.bringToFront(); await p.evaluate(() => { window.__game.hud.setPaused(false); window.__game.hud.showResume?.(false); }); await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${name}.png` }); };
const fps = (p) => p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { if (++n < 90) requestAnimationFrame(f); else res(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); }; requestAnimationFrame(f); }));
const s0 = await st(B, aId); const f0 = await fps(B);
check(s0.nLights === 4 && !s0.net && !s0.beam && s0.lights === 0, `önce: B'de A'nın feneri kapalı (${JSON.stringify(s0)}, ${f0} FPS)`);
await shot(B, '1-B-once-kapali');
await A.keyboard.press('KeyF');
await B.waitForTimeout(1200);
const s1 = await st(B, aId); const f1 = await fps(B);
await shot(B, '2-B-A-feneri-acik');
check(s1.net && s1.beam && s1.lights === 1, `A açtı: B'de bayrak + hüzme + gerçek ışık (${JSON.stringify(s1)}, ${f1} FPS)`);
check(s1.programs === s0.programs, `malzeme programı sayısı sabit (${s0.programs} → ${s1.programs})`);
// A doğrudan B'ye bakar → göz kamaştırma
await face(A, 0);
await B.waitForTimeout(1000);
const s2 = await st(B, aId);
await shot(B, '3-B-goz-kamastirma');
check(s2.glare > 0.2, `A B'ye bakıyor: göz kamaştırma parıltısı (opaklık ${s2.glare})`);
await shot(A, '3-A-kendi-feneri');
await face(A, 1.2);
await A.keyboard.press('KeyF');
await B.waitForTimeout(1000);
const s3 = await st(B, aId);
await shot(B, '4-B-A-kapatti');
check(!s3.net && !s3.beam && s3.lights === 0, `A kapattı: B'de söndü (${JSON.stringify(s3)})`);
await A.keyboard.press('KeyF');
await B.waitForTimeout(1000);
const s4 = await st(B, aId);
await A.evaluate(() => window.__game.online.send({ t: 'dbg', kill: 1 }));
await B.waitForTimeout(1000);
const s5 = await st(B, aId);
check(s4.beam && !s5.net && !s5.beam && s5.lights === 0, `A yeniden açtı (${s4.beam}) → öldü: B'de söndü (${JSON.stringify(s5)})`);
check(s5.programs === s0.programs, `programlar hâlâ sabit (${s5.programs})`);
console.log(`   FPS (B, kabaca): kapalı ${f0} · açık ${f1}`);
check(!errs.length, `konsol hatası yok${errs.length ? ' → ' + errs.slice(0, 4).join(' | ') : ''}`);
await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK'); process.exit(fail ? 1 : 0);
