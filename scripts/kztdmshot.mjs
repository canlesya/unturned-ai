// 12.219 Kuzey Vadisi TDM (bütün harita, araçlı) gerçek GPU denetimi:  node scripts/kztdmshot.mjs
//   1) menü: Özel Oyun → Takım Çatışması → Kuzey Vadisi kartı + "bütün harita, araçlı" notu
//   2) çevrimdışı 16v16: araç sayısı (tür / tarafsız bayrak aracı), üs araç parkı, oyuncu tarafsız jipe biner + sürer, botların araç kullanması
//      ve çatışması (görüntü), öldürme / araçtan öldürme
//   3) çevrim içi (SRV): A oda kurar (kuzey tdm), B katılır → iki istemcide araç listesi aynı (sıra + tarafsız bayrak araçları sunucudan doğmuş),
//      A tarafsız jipe biner + sürer, B gördüğü jip A'nınkiyle aynı yerde; botlar araç kullanıyor, skor işliyor
// Ortam: URL (http://127.0.0.1:5217) · SRV (ws://127.0.0.1:9004, BF_DEBUG=1) · OUT (/tmp/wb-kzmodes) · ONLY=menu|offline|online
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5217', SRV = process.env.SRV || process.env.WS || 'ws://127.0.0.1:9004', OUT = process.env.OUT || '/tmp/wb-kzmodes', ONLY = process.env.ONLY || '';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x !== '' ? ' · ' + x : '')); if (!c) fails++; };
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const mk = async (w = 1400, h = 820) => { const p = await (await browser.newContext({ viewport: { width: w, height: h }, locale: 'tr-TR' })).newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return p; };

// sayfada: oyuncuyu (x, z)'ye koy, (tx, ty, tz)'ye baktır
const LOOK = `window.__look = (x, z, tx, ty, tz, up = 0) => { const g = window.__game, me = g.playerSoldier; me.pos.set(x, g.world.heightAt(x, z) + up, z); me.vel.set(0, 0, 0); g.world.settle?.(me); const e = me.eye(); me.yaw = Math.atan2(-(tx - e.x), -(tz - e.z)); me.pitch = Math.atan2(ty - e.y, Math.hypot(tx - e.x, tz - e.z)); };`;

if (!ONLY || ONLY === 'menu') {
  const P = await mk();
  await P.goto(URL0 + '/?debug=1&nolock=1&nologin=1');
  await P.waitForTimeout(2500);
  await P.evaluate(() => [...document.querySelectorAll('[data-a]')].find((e) => /Özel Oyun/i.test(e.textContent))?.click());
  await P.waitForTimeout(700);
  await P.evaluate(() => [...document.querySelectorAll('button.mdc')].find((e) => /Takım Çatışması/.test(e.textContent))?.click());
  await P.waitForTimeout(500);
  await P.evaluate(() => { const k = [...document.querySelectorAll('.mapc')].find((c) => /Kuzey Vadisi/.test(c.textContent)); k?.click(); });
  await P.waitForTimeout(2000);
  const st = await P.evaluate(() => { const d = document.querySelector('.mapdesc'); d?.scrollIntoView({ block: 'center', behavior: 'instant' }); return { on: document.querySelector('.mapc.on b')?.textContent, mode: document.querySelector('.mdc.on b')?.textContent, note: document.querySelector('.mapdesc .tdmn')?.textContent || '' }; });
  await P.waitForTimeout(1200);
  await P.evaluate(() => document.querySelector('.mapdesc')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await P.waitForTimeout(300);
  await P.screenshot({ path: `${OUT}/00-menu-kuzey-tdm.png` });
  ok(st.on === 'Kuzey Vadisi' && /bütün harita, araçlı/.test(st.note), 'menü: Takım Çatışması → Kuzey Vadisi, "bütün harita, araçlı" notu', JSON.stringify(st));
  ok(!P.errs.length, 'menü: sayfa hatası yok', P.errs.slice(0, 2).join(' | '));
  await P.context().close();
}

if (!ONLY || ONLY === 'offline') {
  const P = await mk();
  await P.goto(`${URL0}/?autostart=16v16&map=kuzey&type=tdm&tod=day&debug=1&nolock=1&nologin=1`);
  await P.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  await P.evaluate(LOOK);
  await P.waitForTimeout(1500);
  const cnt = await P.evaluate(() => {
    const g = window.__game, L = g.vehicles?.list || [], by = {};
    for (const v of L) by[v.type] = (by[v.type] || 0) + 1;
    return { type: g.mode.type, flags: g.mode.objectives.length, n: L.length, alive: L.filter((v) => v.alive).length, by, neutralFlag: L.filter((v) => String(v.spawn.team).startsWith('flag:') && v.alive && !v.team).length, neutral: L.filter((v) => v.alive && !v.team && !v.def.fixed).length, fixed: L.filter((v) => v.def.fixed).length, opts: g.spawnOptions().map((o) => o.id + (o.ok ? '' : '✗')).join(' ') };
  });
  ok(cnt.type === 'tdm' && cnt.flags === 0 && cnt.n >= 70 && cnt.alive === cnt.n && cnt.neutralFlag >= 20, 'çevrimdışı Kuzey TDM 16v16: araçlar kurulu, hepsi hazır, bayrak araçları tarafsız', JSON.stringify(cnt));
  ok(/front/.test(cnt.opts) && !/front✗/.test(cnt.opts), 'doğuş seçenekleri: Üs + Ön hat (+ manga)', cnt.opts);
  await P.evaluate(() => { const g = window.__game; g.devGod = true; g.playerSoldier.protT = 0; window.__look(128, 700, 120, 36, 664); });
  await P.waitForTimeout(700); await P.screenshot({ path: `${OUT}/01-cevrimdisi-mavi-us-araclar.png` });
  // tarafsız Kavşak jipi: yanına git, bin, sür
  await P.evaluate(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'C-Ja'); window.__look(v.st.x + 6, v.st.z + 5, v.st.x, v.st.y + 0.8, v.st.z); });
  await P.waitForTimeout(700); await P.screenshot({ path: `${OUT}/02-cevrimdisi-kavsak-tarafsiz-jip.png` });
  await P.evaluate(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'C-Ja'); window.__look(v.st.x + 2.3, v.st.z + 0.5, v.st.x, v.st.y + 0.8, v.st.z); });
  await P.waitForTimeout(400);
  await P.keyboard.press('KeyE'); await P.waitForTimeout(400);
  const inV = await P.evaluate(() => { const g = window.__game, me = g.playerSoldier; if (me.veh) { g.player.vehCam = 'third'; me.yaw = me.veh.st.yaw + Math.PI; me.pitch = -0.2; } return me.veh?.id || null; });
  await P.keyboard.down('KeyW'); await P.waitForTimeout(2600);
  await P.evaluate(() => { const me = window.__game.playerSoldier; if (me.veh) { me.yaw = me.veh.st.yaw + 2.6; me.pitch = -0.25; } });
  await P.waitForTimeout(400); await P.screenshot({ path: `${OUT}/03-cevrimdisi-oyuncu-jip-suruyor.png` }); await P.keyboard.up('KeyW');
  const drove = await P.evaluate(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'C-Ja'); return { d: +Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z).toFixed(1), kmh: +(Math.hypot(v.st.vx, v.st.vz) * 3.6).toFixed(0) }; });
  ok(inV === 'C-Ja' && drove.d > 12, 'oyuncu Kavşak\'taki tarafsız jipe E ile biner, W ile sürer', JSON.stringify({ inV, ...drove }));
  await P.keyboard.press('KeyE'); await P.waitForTimeout(400);
  // botlar: ~75 sn oynasın
  await P.waitForTimeout(75000);
  const bv = await P.evaluate(() => {
    const g = window.__game, L = g.vehicles.list.filter((v) => !v.def.fixed && v.alive);
    const drv = L.filter((v) => v.seats[0] && v.seats[0].brain);
    const mv = drv.filter((v) => Math.hypot(v.st.vx, v.st.vz) > 3).sort((a, b) => (a.def.heli ? 1 : 0) - (b.def.heli ? 1 : 0));
    return { driven: drv.length, moving: mv.length, kinds: [...new Set(drv.map((v) => v.type))].join(','), pick: mv[0]?.idx ?? drv[0]?.idx ?? -1, kills: g.soldiers.reduce((a, s) => a + s.kills, 0), score: { ...g.tickets }, enter: g.vbStats?.enter || 0 };
  });
  ok(bv.driven >= 3 && bv.enter >= 5, 'botlar araç kullanıyor (75 sn)', JSON.stringify(bv));
  if (bv.pick >= 0) {
    await P.evaluate((i) => { const v = window.__game.vehicles.list[i], st = v.st, sp = Math.hypot(st.vx, st.vz) || 1, ux = st.vx / sp, uz = st.vz / sp; window.__look(st.x - ux * 14 + uz * 9, st.z - uz * 14 - ux * 9, st.x + ux * 4, st.y + 1, st.z + uz * 4, v.def.heli ? 0 : 0); }, bv.pick);
    await P.waitForTimeout(250); await P.screenshot({ path: `${OUT}/04-cevrimdisi-bot-arac-suruyor.png` });
  }
  // çatışma: hedefi olan bot (önce araçta / tankta), arkasından bak
  let fight = null;
  for (let k = 0; k < 20 && !fight; k++) {
    fight = await P.evaluate(() => {
      const g = window.__game, me = g.playerSoldier;
      const C = g.brains.filter((b) => b.s.alive && b.s !== me && b.target && b.target.alive && b.target !== me && Math.hypot(b.target.pos.x - b.s.pos.x, b.target.pos.z - b.s.pos.z) < 90);
      C.sort((a, b) => (b.s.veh ? 1 : 0) - (a.s.veh ? 1 : 0));
      const b = C[0]; if (!b) return null;
      const s = b.s, t = b.target, dx = t.pos.x - s.pos.x, dz = t.pos.z - s.pos.z, L = Math.hypot(dx, dz) || 1;
      window.__look(s.pos.x - dx / L * 9 + dz / L * 3, s.pos.z - dz / L * 9 - dx / L * 3, (s.pos.x + t.pos.x) / 2, (s.pos.y + t.pos.y) / 2 + 1.2, (s.pos.z + t.pos.z) / 2);
      return { bot: s.name, veh: s.veh?.type || null, d: Math.round(L), x: Math.round(s.pos.x), z: Math.round(s.pos.z) };
    });
    if (!fight) await P.waitForTimeout(1500);
  }
  if (fight) { await P.waitForTimeout(350); await P.screenshot({ path: `${OUT}/05-cevrimdisi-bot-catisma.png` }); }
  ok(!!fight, 'botlar çatışıyor (hedefli bot, görüntü)', JSON.stringify(fight));
  await P.waitForTimeout(30000);
  const end = await P.evaluate(() => { const g = window.__game; return { t: Math.round(g.time), kills: g.soldiers.reduce((a, s) => a + s.kills, 0), score: { ...g.tickets }, lim: g.mode.tickets, inVeh: g.soldiers.filter((s) => s.alive && s.veh && !s.veh.def.fixed).length, phase: g.bigStats?.tdmPhase, zones: (g._tdmPlan?.act || []).map((o) => o.name).join(', '), front: g.bigStats?.tdmFront || 0, mate: g.bigStats?.tdmMateSpawn || 0 }; });
  ok(end.kills >= 8, 'çevrimdışı ~2 dk: öldürmeler + skor işliyor', JSON.stringify(end));
  await P.evaluate(() => { const g = window.__game; g.bigMap?.toggle(true, 'map'); });
  await P.waitForTimeout(900); await P.screenshot({ path: `${OUT}/06-cevrimdisi-buyuk-harita.png` });
  ok(!P.errs.length, 'çevrimdışı: sayfa hatası yok', P.errs.slice(0, 2).join(' | '));
  await P.context().close();
}

if (!ONLY || ONLY === 'online') {
  const A = await mk(1280, 720), B = await mk(1280, 720);
  await A.goto(`${URL0}/?online=new&name=Ali&server=${encodeURIComponent(SRV)}&map=kuzey&type=tdm&per=16&team=blue&debug=1&nolock=1&nologin=1`);
  await A.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  const code = await A.evaluate(() => window.__game._badgeCode || window.__game.online?.room);
  await B.goto(`${URL0}/?online=${code}&name=Veli&team=red&server=${encodeURIComponent(SRV)}&debug=1&nolock=1&nologin=1`);
  await B.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  for (const P of [A, B]) await P.evaluate(LOOK);
  await A.waitForTimeout(2500);
  const L = await Promise.all([A, B].map((P) => P.evaluate(() => { const g = window.__game, V = g.vehicles; return V ? { type: g.mode.type, ids: V.list.map((v) => v.id).join(','), n: V.list.length, alive: V.list.filter((v) => v.alive).length, nf: V.list.filter((v) => String(v.spawn.team).startsWith('flag:') && v.alive).length, near: V.list.filter((v) => v.alive && Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z) < 40).length } : null; })));
  ok(L[0] && L[1] && L[0].ids === L[1].ids && L[0].type === 'tdm' && L[0].alive >= 65 && L[1].alive >= 65 && L[0].nf >= 20 && L[1].nf >= 20, 'çevrim içi: iki istemcide araç listesi aynı (sıra), sunucu tarafsız bayrak araçlarını doğurmuş', JSON.stringify(L.map((x) => x && { n: x.n, alive: x.alive, nf: x.nf, near: x.near })));
  // boş tarafsız jip (bayrak / yol aracı; botlar almadıysa): yanına ışınlan, E
  let aIn = null, jp = null, why = null;
  for (let k = 0; k < 4 && !aIn; k++) {
    jp = await A.evaluate(() => { const PREF = ['C-Ja', 'F-Jb', 'N-J1', 'N-J2', 'C-Jb', 'N-J3'];      // önü açık (düz yol) tarafsız jipler
      const L = window.__game.vehicles.list.filter((v) => v.type === 'jip' && v.alive && !v.team && !v.seats.some(Boolean) && Math.hypot(v.st.vx, v.st.vz) < 0.3 && Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z) < 2).sort((a, b) => ((PREF.indexOf(a.id) + 99) % 99) - ((PREF.indexOf(b.id) + 99) % 99)); const v = L[0]; if (!v) return null; const sx = Math.cos(v.st.yaw), sz = -Math.sin(v.st.yaw); return [v.st.x + sx * 2.3, v.st.z + sz * 2.3, v.idx, v.id]; });
    if (!jp) break;
    await A.evaluate((p) => window.__game.online.send({ t: 'dbg', tp: [p[0], p[1]] }), jp);
    await A.waitForTimeout(1800);
    why = await A.evaluate((i) => { const g = window.__game, me = g.playerSoldier, v = g.vehicles.list[i]; return { near: g.vehicles.near(me)?.v?.id || null, d: +Math.hypot(me.pos.x - v.st.x, me.pos.z - v.st.z).toFixed(1), occ: v.seats.filter(Boolean).length }; }, jp[2]);
    await A.keyboard.press('KeyE'); await A.waitForTimeout(900);
    aIn = await A.evaluate(() => { const g = window.__game, me = g.playerSoldier; if (me.veh) { g.player.vehCam = 'third'; me.yaw = me.veh.st.yaw + Math.PI; me.pitch = -0.2; } return me.veh?.id || null; });
  }
  console.log('     jip denemesi', JSON.stringify({ jp, why, aIn }));
  await A.keyboard.down('KeyW'); await A.waitForTimeout(3000); await A.keyboard.up('KeyW');
  await A.waitForTimeout(700);
  const posA = await A.evaluate((i) => { const v = window.__game.vehicles.list[i]; return [v.st.x, v.st.z, Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z)]; }, jp[2]);
  // B: jipin yanına ışınlan, A'nın jipine baksın
  await B.evaluate((p) => window.__game.online.send({ t: 'dbg', tp: [p[0] + 14, p[1] + 10] }), posA);
  await B.waitForTimeout(1800);
  const posB = await B.evaluate((i) => { const v = window.__game.vehicles.list[i], me = window.__game.playerSoldier, e = me.eye(); me.yaw = Math.atan2(-(v.st.x - e.x), -(v.st.z - e.z)); me.pitch = -0.1; return [v.st.x, v.st.z, v.seats[0]?.name || null]; }, jp[2]);
  const posA2 = await A.evaluate((i) => { const v = window.__game.vehicles.list[i]; return [v.st.x, v.st.z]; }, jp[2]);
  await A.screenshot({ path: `${OUT}/10-cevrimici-A-jip.png` }); await B.screenshot({ path: `${OUT}/11-cevrimici-B-A-nin-jipi.png` });
  const err = Math.hypot(posA2[0] - posB[0], posA2[1] - posB[1]);
  ok(aIn && aIn === jp?.[3] && posA[2] > 10 && err < 3 && posB[2] === 'Ali', 'çevrim içi: A tarafsız jipe biner + sürer, B jipi aynı yerde, sürücüsü Ali görür', JSON.stringify({ aIn, moved: +posA[2].toFixed(1), err: +err.toFixed(2), drv: posB[2] }));
  await A.keyboard.press('KeyE');
  await A.waitForTimeout(45000);
  for (let k = 0; k < 15 && !(await B.evaluate(() => window.__game.tickets.blue + window.__game.tickets.red)); k++) await A.waitForTimeout(5000);      // ilk temas bölgeye göre 60–120 sn
  const bs = await B.evaluate(() => { const g = window.__game, V = g.vehicles; const drv = V.list.filter((v) => v.alive && !v.def.fixed && v.seats[0] && !v.seats[0].netHuman && v.seats[0].name !== 'Ali' && v.seats[0].name !== 'Veli'); return { botDriven: drv.length, kinds: [...new Set(drv.map((v) => v.type))].join(','), score: { ...g.tickets }, pick: drv.find((v) => Math.hypot(v.st.vx, v.st.vz) > 3)?.idx ?? drv[0]?.idx ?? -1 }; });
  ok(bs.botDriven >= 3 && bs.score.blue + bs.score.red >= 1, 'çevrim içi (ilk temasa dek, ≤ 2 dk): botlar araç sürüyor, skor işliyor (B\'nin gördüğü)', JSON.stringify(bs));
  if (bs.pick >= 0) {
    const vp = await B.evaluate((i) => { const v = window.__game.vehicles.list[i]; return [v.st.x, v.st.z]; }, bs.pick);
    await B.evaluate((p) => window.__game.online.send({ t: 'dbg', tp: [p[0] + 18, p[1] + 12] }), vp);
    await B.waitForTimeout(1500);
    await B.evaluate((i) => { const v = window.__game.vehicles.list[i], me = window.__game.playerSoldier, e = me.eye(); me.yaw = Math.atan2(-(v.st.x - e.x), -(v.st.z - e.z)); me.pitch = Math.atan2(v.st.y + 1 - e.y, Math.hypot(v.st.x - e.x, v.st.z - e.z)); }, bs.pick);
    await B.waitForTimeout(300); await B.screenshot({ path: `${OUT}/12-cevrimici-B-bot-arac.png` });
  }
  ok(!A.errs.length && !B.errs.length, 'çevrim içi: sayfa hatası yok', [...A.errs, ...B.errs].slice(0, 3).join(' | '));
}
console.log(fails ? `sonuç: ${fails} HATA` : 'sonuç: OK');
await browser.close(); process.exit(fails ? 1 : 0);
