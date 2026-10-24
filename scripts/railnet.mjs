// 12.160: Ray tüfeği şarj ışıması 3. şahısta. A (Ali, Keskin Nişancı) Uzay odası kurar, B (Veli) aynı takımdan katılır, 3,5 m yan yana.
// A ateş eder → B'nin ekranında A'nın silahındaki raylar sönükten parlağa dolar (0 / 0,4 / 0,9 / 1,4 sn kare dizisi), dolunca kısa parıltı + yakında kısık "hazır" tıkı.
// Malzeme programı sayısı sabit kalmalı (paylaşılan malzemenin kopyası aynı programı kullanır); başka askerlerin paylaşılan malzemesi etkilenmez.
//   node scripts/railnet.mjs [url=http://127.0.0.1:5266] [ws=ws://127.0.0.1:8866]   → /tmp/wb-railnet/*.png   (sunucu BF_DEBUG=1)
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5266', ws = process.argv[3] || 'ws://127.0.0.1:8866', OUT = '/tmp/wb-railnet';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const errs = [];
const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|WebSocket/.test(m.text())) errs.push(m.text()); }); return p; };
const q = `server=${encodeURIComponent(ws)}&debug=1&nolock=1`;
const A = await mk();
await A.goto(`${base}/?online=new&type=space&per=2&map=yorunge&bots=0&team=blue&cls=sniper&name=Ali&${q}`);
await A.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 120000 });
const code = await A.evaluate(() => window.__game.opts.online.room);
const B = await mk();
await B.goto(`${base}/?online=${code}&team=blue&name=Veli&${q}`);
await B.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 120000 });
const tp = (p, xz) => p.evaluate((xz) => window.__game.online.send({ t: 'dbg', tp: xz, hp: 100 }), xz);
await tp(A, [-40, -18]); await tp(B, [-36.5, -18]);
await A.waitForTimeout(2500);
const unpause = (p) => p.evaluate(() => { window.__game.hud.setPaused?.(false); window.__game.hud.showResume?.(false); });
await unpause(A); await unpause(B);
// B A'ya bakar (A'nın gövdesine hafif aşağı); A B'ye dik bakar (silah B'nin ekranında yandan)
await B.evaluate(() => { const g = window.__game, me = g.playerSoldier, o = g.soldiers.find((x) => x.name === 'Ali'); me.yaw = Math.atan2(-(o.pos.x - me.pos.x), -(o.pos.z - me.pos.z)); me.pitch = -0.08; });
await A.evaluate(() => { const g = window.__game, me = g.playerSoldier, o = g.soldiers.find((x) => x.name === 'Veli'); me.yaw = Math.atan2(-(o.pos.x - me.pos.x), -(o.pos.z - me.pos.z)) + Math.PI / 2; me.pitch = 0; });
await B.waitForTimeout(1500);
const st0 = await B.evaluate(() => {
  const g = window.__game, a = g.soldiers.find((x) => x.name === 'Ali');
  window.__rdy = 0; const v0 = g.sfx._voice.bind(g.sfx); g.sfx._voice = (pos, gain, o) => { if (o && o.ref === 6) window.__rdy++; return v0(pos, gain, o); };     // railReady sayacı
  let shared = null; a.model.weapon.traverse((o) => { if (!shared && o.material?.userData?.U?.uEnK) shared = o.material; }); window.__shared = shared;
  return { item: a.item.id, w: a.model.weapon?.userData.id, railT: a.railT ?? null, programs: g.renderer.info.programs.length, sharedK: shared?.userData.U.uEnK.value, sharedFlag: !!shared?.userData.shared };
});
check(st0.item === 'railgun' && st0.w === 'railgun' && st0.railT === null && st0.sharedFlag && st0.sharedK === 1, `önce: B A'nın ray tüfeğini görüyor, paylaşılan malzeme tam parlak (${JSON.stringify(st0)})`);
// A'nın silahının B ekranındaki yeri (yakın plan kırpması)
const clip = await B.evaluate(() => {
  const g = window.__game, a = g.soldiers.find((x) => x.name === 'Ali'), w = a.model.weapon, cam = g.camera;
  const b = new (w.position.constructor)(); const box = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  w.updateMatrixWorld(true);
  for (const [x, y, z] of [[0, 0.1, 0.45], [0, 0.1, -0.96], [0, -0.12, 0], [0, 0.16, -0.3]]) { b.set(x, y, z).applyMatrix4(w.matrixWorld).project(cam); const sx = (b.x + 1) / 2 * innerWidth, sy = (1 - b.y) / 2 * innerHeight; box.x0 = Math.min(box.x0, sx); box.x1 = Math.max(box.x1, sx); box.y0 = Math.min(box.y0, sy); box.y1 = Math.max(box.y1, sy); }
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2, hw = Math.max(80, (box.x1 - box.x0) * 0.9), hh = Math.max(60, hw * 0.6);
  return { x: Math.max(0, cx - hw), y: Math.max(0, cy - hh), width: Math.min(2 * hw, innerWidth - Math.max(0, cx - hw)), height: Math.min(2 * hh, innerHeight - Math.max(0, cy - hh)) };
});
await B.bringToFront();
await B.screenshot({ path: `${OUT}/0-once-tam.png` }); await B.screenshot({ path: `${OUT}/z0-once-tam.png`, clip });
// A ateş eder
await A.mouse.down(); await A.waitForTimeout(60); await A.mouse.up();
const a1 = await A.evaluate(() => ({ vmCharge: +(window.__game.player.vm.charge ?? -1).toFixed(2), mag: window.__game.playerSoldier.item.mag }));
await B.waitForFunction(() => { const a = window.__game.soldiers.find((x) => x.name === 'Ali'); return a.railT !== undefined && a.railT < 0.3; }, null, { timeout: 5000 });
const rows = [];
for (const [i, T] of [[1, 0], [2, 0.4], [3, 0.9], [4, 1.4]]) {
  await B.waitForFunction((T) => window.__game.soldiers.find((x) => x.name === 'Ali').railT >= T, T, { timeout: 5000 });
  const pre = await B.evaluate(() => { const g = window.__game, a = g.soldiers.find((x) => x.name === 'Ali'); return { t: +a.railT.toFixed(2), k: +a._railMat.userData.U.uEnK.value.toFixed(2) }; });
  await B.screenshot({ path: `${OUT}/z${i}-${T}s.png`, clip });
  if (i === 4) await B.screenshot({ path: `${OUT}/${i}-${T}s-tam.png` });
  rows.push({ T, ...pre });
}
await B.waitForTimeout(600);
const st1 = await B.evaluate(() => {
  const g = window.__game, a = g.soldiers.find((x) => x.name === 'Ali');
  let own = 0, sh = 0; a.model.weapon.traverse((o) => { if (o.material?.userData?.U?.uEnK) { if (o.material === a._railMat) own++; else sh++; } });
  return { k: +a._railMat.userData.U.uEnK.value.toFixed(2), own, sh, programs: g.renderer.info.programs.length, sharedK: window.__shared.userData.U.uEnK.value, rdy: window.__rdy, ctx: !!g.sfx.ctx, myVm: +(g.player.vm.charge ?? 1).toFixed(2) };
});
console.log('kareler', JSON.stringify(rows));
check(a1.vmCharge >= 0 && a1.vmCharge < 0.5, `A birinci şahıs şarjı aynen sıfırlandı (vm.charge ${a1.vmCharge}, şarjör ${a1.mag})`);
check(rows[0].k < 0.8 && rows[1].k < 0.4 && rows[2].k > rows[1].k + 0.2 && rows[3].k > 1.05, `B'de şarj eğrisi atış parlaması → sönük → parlak + hazır parıltısı (${rows.map((r) => `${r.t}s:${r.k}`).join(' · ')})`);
check(st1.k === 1 && st1.own > 0 && st1.sh === 0, `dolduktan sonra uEnK 1, silah ağları askere özel kopyada (${st1.own} ağ, paylaşılan ${st1.sh})`);
check(st1.sharedK === 1, `paylaşılan LOD malzemesi etkilenmedi (uEnK ${st1.sharedK})`);
check(st1.programs === st0.programs, `malzeme programı sayısı sabit (${st0.programs} → ${st1.programs})`);
check(st1.rdy === 1 || !st1.ctx, `yakında (3,5 m) kısık "hazır" tıkı 1 kez (${st1.rdy}; ses bağlamı ${st1.ctx})`);
check(errs.length === 0, `sayfa hatası ${errs.length} ${errs.slice(0, 3).join(' | ')}`);
await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
