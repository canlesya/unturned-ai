// 12.202 Manga + büyük harita (M) + işaret + çatışma yoğunluğu + ölüm doğuş seçici (çevrimdışı, gerçek tarayıcı).
//   node scripts/squadmap.mjs [istemci url]   → /tmp/wb-squad/*.png  (12.205 araç koltuğuna doğuş + harita yakınlaştırma → /tmp/wb-vspawn/*.png)
//   ONLY=veh,zoom,mob,base,ctl,off,mobbase ile yalnız seçilen bölümler
// Kuzey Vadisi fetih, Çöl Geçidi ele geçirme + TDM (masaüstü) ve Kuzey Vadisi Pixel 7 yatay (touch=1). Silah oyunu / Enfekte'de manga + seçici kapalı.
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5284', OUT = '/tmp/wb-squad';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null, part = (k) => !ONLY || ONLY.has(k);
let fails = 0; const check = (ok, m) => { console.log(`${ok ? 'OK  ' : 'HATA'}  ${m}`); if (!ok) fails++; };

async function open(q, mob = false) {
  const ctx = mob ? await browser.newContext(strip(devices['Pixel 7 landscape'])) : await browser.newContext({ viewport: { width: 1440, height: 810 } });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/?${q}&debug=1&nolock=1${mob ? '&touch=1' : ''}`);
  await page.waitForFunction(() => window.__game?.running && window.__game.time > 1.5, null, { timeout: 150000 });
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}
const kill = (page) => page.evaluate(() => { const g = window.__game, p = g.playerSoldier; p.protT = 0; g.devGod = false; p.takeDamage(999, g.soldiers.find((s) => s.team !== p.team), 'body', p.pos, 'AK-47'); });
// büyük harita / doğuş seçicideki bir dünya noktasının ekran (CSS px) konumu
const scr = (page, x, z) => page.evaluate(([x, z]) => { const b = window.__game.bigMap, r = b.cv.getBoundingClientRect(); return [r.left + b.X(x) / b.dpr, r.top + b.Y(z) / b.dpr]; }, [x, z]);
// manga arkadaşlarını üsse yakın, düşmansız, sakin bir yere koy (çatışma / düşman kuralı uygun olsun) + botları dondur
const calmMates = (page) => page.evaluate(() => {
  const g = window.__game, me = g.playerSoldier;
  g.brainsOff = g.brains.splice(0);
  const mates = g.soldiers.filter((s) => s !== me && s.team === me.team && s.squad === me.squad && !s.vacant);
  for (const m of mates) if (m.veh) { g.vehicles.exit(m); m.vel.set(0, 0, 0); }      // Kuzey Vadisi: botlar jipe biner (araçtaki arkadaşa doğuş yok)
  const sp = g.map.spawns[me.team][0];
  for (const s of g.soldiers) if (s.team !== me.team && s.alive) { const d = Math.hypot(s.pos.x - sp.x, s.pos.z - sp.z); if (d < 90) { const e = g.map.spawns[s.team][0]; s.pos.set(e.x, g.world.groundAt(e.x, e.z), e.z); } }
  return mates.map((m) => ({ id: m.id, alive: m.alive, x: m.pos.x, z: m.pos.z }));
});

async function desk(tag, q, conq) {
  const { ctx, page, errs } = await open(q);
  const info = await page.evaluate(() => {
    const g = window.__game, me = g.playerSoldier;
    const sq = {};
    for (const s of g.soldiers) if (!s.vacant) { const k = s.team + s.squad; sq[k] = (sq[k] || 0) + 1; }
    return { sq, me: me.squad, team: me.team, panel: document.querySelector('#sqp')?.offsetHeight || 0, rows: document.querySelectorAll('#sqp .r').length, keys: g.binds.codes('map'), ping: g.binds.codes('ping') };
  });
  console.log(tag, JSON.stringify(info));
  check(Object.values(info.sq).every((n) => n <= 4) && Object.values(info.sq).some((n) => n === 4), `${tag}: mangalar en çok 4 kişilik (${JSON.stringify(info.sq)})`);
  check(info.panel > 40 && info.rows === 4, `${tag}: HUD manga listesi (${info.rows} satır)`);
  // botlar biraz dolaşsın → yeşil işaretler / ısı
  await page.waitForTimeout(conq ? 14000 : 9000);
  await page.screenshot({ path: `${OUT}/${tag}-hud.png` });
  const marks = await page.evaluate(() => [...document.querySelectorAll('#sqmk .m')].filter((e) => e.style.display === 'flex').length);
  console.log(`      ekrandaki yeşil manga işareti: ${marks}`);
  // M → büyük harita
  await page.keyboard.press('KeyM'); await page.waitForTimeout(500);
  let st = await page.evaluate(() => { const g = window.__game; return { open: g.bigMap.open, mode: g.bigMap.mode, heat: g.heat.list(g.time).length, flags: g.mode.objectives.length }; });
  check(st.open && st.mode === 'map', `${tag}: M büyük haritayı açtı (ısı kaydı ${st.heat}, bayrak ${st.flags})`);
  if (!st.heat) await page.evaluate(() => { const g = window.__game, o = g.mode.objectives[0] || g.map.spawns.red[0]; for (let i = 0; i < 12; i++) g.heat.add(o.x + Math.random() * 20 - 10, o.z + Math.random() * 20 - 10, 2, g.time); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${tag}-harita.png` });
  // haritaya tıkla → işaret
  const tgt = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier, a = me.yaw; return { x: me.pos.x - Math.sin(a) * 30, z: me.pos.z - Math.cos(a) * 30 }; });
  const [cx, cy] = await scr(page, tgt.x, tgt.z);
  await page.mouse.click(cx, cy); await page.waitForTimeout(400);
  st = await page.evaluate(() => { const g = window.__game, p = g.pings.items.get(g.playerSoldier.id); return p ? { k: p.k, x: p.x, z: p.z, obj: !!p.obj } : null; });
  check(st && st.k === 'loc' && Math.hypot(st.x - tgt.x, st.z - tgt.z) < 2 && st.obj, `${tag}: haritaya tıklama işaret koydu (${st && st.x.toFixed(1)}, ${st && st.z.toFixed(1)}; 3B ışık)`);
  await page.screenshot({ path: `${OUT}/${tag}-harita-isaret.png` });
  await page.keyboard.press('KeyM'); await page.waitForTimeout(400);
  check(!(await page.evaluate(() => window.__game.bigMap.open)), `${tag}: M tekrar → harita kapandı`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${tag}-isaret-3b.png` });
  const onScr = await page.evaluate(() => { const p = window.__game.pings.items.get(window.__game.playerSoldier.id); return p?.el && !p.el.classList.contains('edge'); });
  check(onScr, `${tag}: işaret ekranda (elmas + uzaklık, 3B ışık)`);
  // orta tık → bakılan yere işaret
  await page.waitForTimeout(600);
  await page.evaluate(() => { const p = window.__game.playerSoldier; p.pitch = -0.25; });
  await page.waitForTimeout(100);
  await page.mouse.click(720, 405, { button: 'middle' }); await page.waitForTimeout(400);
  const mid = await page.evaluate(() => { const g = window.__game, p = g.pings.items.get(g.playerSoldier.id); return p ? Math.hypot(p.x - g.playerSoldier.pos.x, p.z - g.playerSoldier.pos.z) : -1; });
  check(mid > 1 && mid < 120, `${tag}: orta tık bakılan yere işaret koydu (${mid.toFixed(1)} m ileride)`);
  await page.screenshot({ path: `${OUT}/${tag}-orta-tik.png` });
  // ölüm → doğuş seçici
  const mates = await calmMates(page);
  await kill(page); await page.waitForTimeout(1200);
  st = await page.evaluate(() => { const g = window.__game; return { mode: g.bigMap.mode, dmap: g.hud.$('respawn').classList.contains('dmap'), tg: g.bigMap.targets().map((t) => `${t.kind}:${t.id}:${t.ok ? 1 : 0}`) }; });
  check(st.mode === 'deploy' && st.dmap, `${tag}: ölünce doğuş seçici harita açıldı`);
  console.log('      hedefler:', st.tg.join(' '));
  check(st.tg.some((t) => t.startsWith('base:')) && st.tg.filter((t) => t.startsWith('mate:')).length >= 1, `${tag}: üs + manga arkadaşı hedefleri var`);
  if (conq) check(st.tg.some((t) => t.startsWith('flag:')), `${tag}: bayrak hedefleri var`);
  await page.screenshot({ path: `${OUT}/${tag}-olum-dogus.png` });
  // manga arkadaşına tıkla → Doğ
  const mate = await page.evaluate(() => { const g = window.__game; const t = g.bigMap.targets().find((t) => t.kind === 'mate' && t.ok); return t ? { id: t.id, x: t.x, z: t.z, mid: t.mate.id } : null; });
  check(!!mate, `${tag}: uygun manga arkadaşı var (${mate?.id})`);
  if (mate) {
    const [mx, my] = await scr(page, mate.x, mate.z);
    await page.mouse.click(mx, my); await page.waitForTimeout(300);
    check(await page.evaluate((id) => window.__game.spawnChoice === id, mate.id), `${tag}: tıklama arkadaşı seçti`);
    await page.screenshot({ path: `${OUT}/${tag}-arkadas-secili.png` });
    // süre bitmeden Doğ'a bas → hazır bekler; süre bitince doğar
    await page.evaluate((mid) => { const g = window.__game; g._mateAt = null; g._mateWant = mid; if (!g._mateHook) { g._mateHook = true; g.on('spawn', (s) => { if (s === g.playerSoldier && g._mateWant != null) { const m = g.soldiers[g._mateWant]; g._mateAt = { x: m.pos.x, y: m.pos.y, z: m.pos.z }; g._mateWant = null; } }); } }, mate.mid);
    await page.click('#respawn .dgo');
    await page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(300);
    // 12.205: arkadaşın DOĞUŞ ANINDAKİ konumuna göre (bot arada yürüyordu: 4,5 m eşiği bazen 4,9 m çıkıyordu); doğuştan sonra da 6 m içinde
    const r = await page.evaluate((mid) => { const g = window.__game, p = g.playerSoldier, m = g.soldiers[mid], a = g._mateAt || m.pos; return { alive: p.alive, d: Math.hypot(p.pos.x - a.x, p.pos.z - a.z), now: Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z), dy: p.pos.y - a.y, open: g.bigMap.open }; }, mate.mid);
    check(r.alive && r.d < 4.5 && r.now < 6 && Math.abs(r.dy) < 1, `${tag}: manga arkadaşının yanında doğdu (doğuş anında ${r.d.toFixed(2)} m, şimdi ${r.now.toFixed(2)} m, kot farkı ${r.dy.toFixed(2)})`);
    check(!r.open, `${tag}: doğunca harita kapandı`);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${tag}-mangadan-dogus.png` });
  }
  // arkadaş çatışmada → kapalı
  await kill(page); await page.waitForTimeout(800);
  const cmb = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; const m = g.soldiers.find((s) => s !== me && s.team === me.team && s.squad === me.squad && s.alive); if (!m) return null; m.lastDmgT = g.time; m._sqSt = null; const t = g.bigMap.targets().find((t) => t.mate === m); return t ? { ok: t.ok, st: t.st } : null; });
  check(cmb && !cmb.ok && cmb.st === 1, `${tag}: vurulan arkadaşta doğuş kapalı (durum ${cmb?.st})`);
  const enm = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; const m = g.soldiers.find((s) => s !== me && s.team === me.team && s.squad === me.squad && s.alive && g.time - s.lastDmgT > 5); const e = g.soldiers.find((s) => s.team !== me.team && s.alive); if (!m || !e) return null; e.pos.set(m.pos.x + 8, m.pos.y, m.pos.z); m._sqSt = null; const t = g.bigMap.targets().find((t) => t.mate === m); return t ? { ok: t.ok, st: t.st } : null; });
  check(enm && !enm.ok && enm.st === 2, `${tag}: yakında düşman olan arkadaşta doğuş kapalı (durum ${enm?.st})`);
  await page.screenshot({ path: `${OUT}/${tag}-arkadas-kapali.png` });
  if (conq) {     // sahip olunan bayrağa tıkla → orada doğ (düşmanın görmediği nokta)
    const fl = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; for (const o of g.mode.objectives) if (!o.owner || o.owner === me.team) { o.owner = me.team; o.p = me.team === 'blue' ? 1 : -1; } g.hud._spKey = null; const t = g.bigMap.targets().find((t) => t.kind === 'flag' && t.ok); return t ? { id: t.id, x: t.x, z: t.z } : null; });
    check(!!fl, `${tag}: sahip olunan bayrak seçilebilir (${fl?.id})`);
    if (fl) {
      const [fx, fy] = await scr(page, fl.x, fl.z);
      await page.mouse.click(fx, fy); await page.waitForTimeout(200);
      await page.keyboard.press('Space');
      await page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 20000 }).catch(() => {});
      const r = await page.evaluate((id) => { const g = window.__game, p = g.playerSoldier, o = g.mode.objectives.find((q) => q.id === id); return { alive: p.alive, d: Math.hypot(p.pos.x - o.x, p.pos.z - o.z), r: o.r }; }, fl.id);
      check(r.alive && r.d < r.r + 2, `${tag}: Boşluk ile seçilen bayrakta doğdu (${r.d.toFixed(1)} m, alan ${r.r} m)`);
    }
  }
  // Esc → Kontroller: yeni satırlar
  check(!errs.length, `${tag}: sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}


// ───────────── 12.205 araçtaki manga arkadaşının boş koltuğuna doğuş (Kuzey Vadisi fetih) ─────────────
const VOUT = '/tmp/wb-vspawn';
mkdirSync(VOUT, { recursive: true });
// botları dondur, arkadaşları sakinleştir, sonra arkadaş m'yi verilen türdeki takım aracına koltuk 'seat'e oturt (diğer koltuklar boş)
const mateInVeh = (page, pred, seat = 0, slot = 0) => page.evaluate(([pred, seat, slot]) => {
  const g = window.__game, me = g.playerSoldier, V = g.vehicles;
  if (!g.brainsOff) g.brainsOff = g.brains.splice(0);
  const mates = g.soldiers.filter((s) => s !== me && s.team === me.team && s.squad === me.squad && !s.vacant && s.alive);
  for (const s of g.soldiers) if (s.veh && s !== me) V.exit(s);
  const L = V.list.filter((v) => v.alive && v.st && !v.st.sunk && new Function('v', 'return ' + pred)(v) && (v.team === me.team || !v.team || v.spawn.team === me.team));
  L.sort((a, b) => Math.hypot(a.st.x - me.pos.x, a.st.z - me.pos.z) - Math.hypot(b.st.x - me.pos.x, b.st.z - me.pos.z));
  const v = L[0], m = mates[slot];
  if (!v || !m) return null;
  v.burn = false; v.hp = v.def.hp; v.st.roll = v.st.pitch = 0; if (v.st.fall) v.st.fall = 0;
  V.enter(m, v, seat); m._sqSt = null; if (seat === 0 && m.brain && !m.brain.vd) m.brain.vd = { v, test: 1 };      // bot sürücü (brain.vd yoksa araç onu indirir)
  return { vi: v.idx, id: v.id, type: v.type, mid: m.id, seats: v.seats.length, mg: v.def.mg?.seats || [] };
}, [pred, seat, slot]);
const dtarget = (page, mid) => page.evaluate((mid) => { const g = window.__game; g.soldiers[mid]._sqSt = null; const t = g.bigMap.targets().find((t) => t.id === 'sq:' + mid); return t ? { ok: t.ok, st: t.st, free: t.free, veh: t.veh?.idx ?? null, x: t.x, z: t.z } : null; }, mid);
const seatOf = (page) => page.evaluate(() => { const g = window.__game, p = g.playerSoldier, P = g.player; return { alive: p.alive, veh: p.veh?.idx ?? null, type: p.veh?.type, seat: p.seat, ads: p.ads, adsT: p.adsT, vehK: +(P._vehK || 0).toFixed(2), zoom: +(P.baseFov() / g.camera.fov).toFixed(2), hud: !!document.querySelector('#vhPanel') && getComputedStyle(document.querySelector('#vhPanel')).display !== 'none', yawD: p.veh ? +Math.abs(((p.yaw - p.veh.st.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI).toFixed(2) : null }; });
async function deployOn(page, mid, shot) {
  await page.waitForFunction(() => window.__game.bigMap.mode === 'deploy', null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  const t = await dtarget(page, mid);
  const [mx, my] = await scr(page, t.x, t.z);
  await page.mouse.click(mx, my); await page.waitForTimeout(300);
  if (shot) await page.screenshot({ path: `${VOUT}/${shot}.png` });
  await page.click('#respawn .dgo');
  await page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(700);
  return t;
}
async function vehDeploy() {
  const { ctx, page, errs } = await open('autostart=8v8&map=kuzey&type=conquest');
  await calmMates(page);
  // 1) jip: arkadaş sürücü → silahlı boş koltuk (makineli, 1)
  let mv = await mateInVeh(page, "v.type === 'jip'", 0);
  check(!!mv, `veh: arkadaş jipte (${JSON.stringify(mv)})`);
  // öldürmeden önce nişan açık: koltukta sıfırlanmalı
  await page.evaluate(() => { const p = window.__game.playerSoldier; p.ads = true; p.adsT = 1; });
  await kill(page); await page.waitForTimeout(1200);
  let t = await dtarget(page, mv.mid);
  check(t && t.ok && t.st === 6 && t.veh === mv.vi && t.free === 3, `veh: doğuş haritasında jipteki arkadaş uygun (durum ${t?.st}, boş koltuk ${t?.free})`);
  const row = await page.evaluate((mid) => { const c = document.querySelector(`#spawnrow .cc[data-k="sq:${mid}"]`); return c ? { svg: !!c.querySelector('svg.vi'), txt: c.textContent.replace(/\s+/g, ' ').trim(), dis: c.classList.contains('dis') } : null; }, mv.mid);
  check(row && row.svg && /3/.test(row.txt) && !row.dis, `veh: doğuş listesinde araç simgesi + kalan koltuk (${row?.txt})`);
  await page.screenshot({ path: `${VOUT}/01-dogus-haritasi-jip.png` });
  // yakından: aracın etrafında ×3
  await page.evaluate(([x, z]) => { const b = window.__game.bigMap, v = b.vw; v.z = 3; v.cx = x; v.cz = z; b._vt = 0; }, [t.x, t.z]);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${VOUT}/02-dogus-haritasi-jip-yakin.png` });
  await deployOn(page, mv.mid, '03-jip-secili');
  let r = await seatOf(page);
  check(r.alive && r.veh === mv.vi && r.seat === 1, `veh: jipin makineli koltuğuna doğdu (${JSON.stringify(r)})`);
  check(!r.ads && r.adsT === 0 && r.vehK === 0 && Math.abs(r.zoom - 1) < 0.03, `veh: nişan / yakınlaştırma sıfır (ads ${r.ads}, adsT ${r.adsT}, ×${r.zoom})`);
  check(r.yawD !== null && r.yawD < 0.05, `veh: bakış aracın önüne (fark ${r.yawD} rad)`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${VOUT}/04-jip-makineli-1sahis.png` });
  // 2) dolu jip → kapalı ("Araç dolu"), yanan → "Araç yanıyor", devrik → "Araç devrilmiş", batmış → "Araç batmış"
  await kill(page); await page.waitForTimeout(900);
  const fill = await page.evaluate((vi) => { const g = window.__game, me = g.playerSoldier, v = g.vehicles.list[vi]; const free = g.soldiers.filter((s) => s.team === me.team && s !== me && s.alive && !s.veh && !s.vacant); for (let i = 0; i < v.seats.length; i++) if (!v.seats[i] && free.length) g.vehicles.enter(free.shift(), v, i); return v.seats.filter(Boolean).length; }, mv.vi);
  t = await dtarget(page, mv.mid);
  const lab = await page.evaluate(() => window.__game.bigMap.why({ mate: 1, st: 7 }));
  check(t && !t.ok && t.st === 7 && t.free === 0, `veh: dolu jipte doğuş kapalı (${fill}/4 dolu, durum ${t?.st} "${lab}")`);
  await page.evaluate(([x, z]) => { const b = window.__game.bigMap, v = b.vw; v.z = 3; v.cx = x; v.cz = z; b._vt = 0; }, [t.x, t.z]);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${VOUT}/05-dolu-jip-kapali.png` });
  const st3 = await page.evaluate(([vi, mid]) => {
    const g = window.__game, v = g.vehicles.list[vi], m = g.soldiers[mid], out = {};
    for (const s of [...v.seats]) if (s && s !== m) g.vehicles.exit(s);
    const q = () => { m._sqSt = null; return g.spawnOptions().find((o) => o.id === 'sq:' + mid).st; };
    out.open = q();
    v.burn = true; out.burn = q(); v.burn = false;
    const r0 = v.st.roll; v.st.roll = 1.45; out.flip = q(); v.st.roll = r0;
    v.st.sunk = true; out.sunk = q(); v.st.sunk = false;
    out.txt = [7, 8, 9, 10].map((k) => g.bigMap.why({ mate: 1, st: k }));
    return out;
  }, [mv.vi, mv.mid]);
  check(st3.open === 6 && st3.burn === 8 && st3.flip === 9 && st3.sunk === 10, `veh: yanan / devrik / batmış araçta kapalı (${JSON.stringify(st3)})`);
  // 3) yarış: Doğ'a basıldı (HAZIR), doğuştan önce koltuklar doldu → aracın yanına (yerde)
  await page.waitForTimeout(400);
  t = await dtarget(page, mv.mid);
  const [mx, my] = await scr(page, t.x, t.z);
  await page.mouse.click(mx, my); await page.waitForTimeout(200);
  const rt = await page.evaluate(() => window.__game.playerSoldier.respawnT);
  await page.click('#respawn .dgo');
  await page.evaluate((vi) => { const g = window.__game, me = g.playerSoldier, v = g.vehicles.list[vi]; const free = g.soldiers.filter((s) => s.team === me.team && s !== me && s.alive && !s.veh && !s.vacant); for (let i = 0; i < v.seats.length; i++) if (!v.seats[i] && free.length) g.vehicles.enter(free.shift(), v, i); }, mv.vi);
  await page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(300);
  r = await page.evaluate((vi) => { const g = window.__game, p = g.playerSoldier, v = g.vehicles.list[vi]; return { alive: p.alive, veh: !!p.veh, d: +Math.hypot(p.pos.x - v.st.x, p.pos.z - v.st.z).toFixed(2), dy: +(p.pos.y - v.st.y).toFixed(2) }; }, mv.vi);
  check(r.alive && !r.veh && r.d < 8 && Math.abs(r.dy) < 1.2, `veh: koltuk o arada doldu → aracın yanında yere doğdu (HAZIR ${rt.toFixed(1)} sn önce, ${r.d} m, kot ${r.dy})`);
  await page.screenshot({ path: `${VOUT}/06-koltuk-doldu-yanina.png` });
  // 4) helikopter: arkadaş pilot → kapı nişancısı koltuğu
  await kill(page); await page.waitForTimeout(600);
  mv = await mateInVeh(page, "!!v.def.heli", 0);
  check(!!mv, `veh: arkadaş helikopter pilotu (${mv?.id})`);
  await page.evaluate((vi) => { const g = window.__game, v = g.vehicles.list[vi]; v.st.y += 28; v.st.air = true; v.st.rpm = 1; }, mv.vi);
  await page.waitForTimeout(500);
  t = await dtarget(page, mv.mid);
  check(t && t.ok && t.free === 3, `veh: havadaki helikopterde doğuş açık (durum ${t?.st}, ${t?.free} boş koltuk)`);
  await page.screenshot({ path: `${VOUT}/07-dogus-haritasi-heli.png` });
  await deployOn(page, mv.mid);
  r = await seatOf(page);
  check(r.alive && r.veh === mv.vi && mv.mg.includes(r.seat), `veh: helikopterin kapı nişancısı koltuğuna doğdu (koltuk ${r.seat}, ${r.type})`);
  check(!r.ads && r.vehK === 0 && Math.abs(r.zoom - 1) < 0.03 && r.yawD > 1.4, `veh: kapı nişancısı kapıdan bakıyor, yakınlaştırma sıfır (fark ${r.yawD} rad, ×${r.zoom})`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${VOUT}/08-heli-kapi-nisancisi-1sahis.png` });
  // 5) arkadaş çatışmada (vurulmuş) + yakında düşman: araçta doğuş yine açık (Battlefield)
  await kill(page); await page.waitForTimeout(800);
  const cmb = await page.evaluate((mid) => { const g = window.__game, me = g.playerSoldier, m = g.soldiers[mid]; m.lastDmgT = g.time; const e = g.soldiers.find((s) => s.team !== me.team && s.alive); e.pos.set(m.pos.x + 8, m.pos.y, m.pos.z); m._sqSt = null; return g.spawnOptions().find((o) => o.id === 'sq:' + mid)?.st; }, mv.mid);
  check(cmb === 6, `veh: çatışmadaki / düşman yakınındaki araçta da açık (durum ${cmb})`);
  // 6) tank: arkadaş sürücü → tank makinelisi (1) · 7) motor: arkadaş sürücü → arka koltuk (1)
  for (const [pred, nm] of [["v.type === 'tank'", 'tank'], ["!!v.def.moto", 'motor']]) {
    mv = await mateInVeh(page, pred, 0);
    if (!mv) { check(false, `veh: ${nm} bulunamadı`); continue; }
    await page.waitForTimeout(300);
    t = await deployOn(page, mv.mid);
    r = await seatOf(page);
    check(t.ok && r.alive && r.veh === mv.vi && r.seat === 1, `veh: ${nm} arkadaşının ${nm === 'tank' ? 'makineli' : 'arka'} koltuğuna doğdu (koltuk ${r.seat}, boş ${t.free})`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${VOUT}/09-${nm}-koltuk.png` });
    await kill(page); await page.waitForTimeout(900);
  }
  // 8) motor devrik (yere yatmış) → kapalı
  const mf = await page.evaluate((vi) => { const g = window.__game, v = g.vehicles.list[vi], m = v.seats[0]; v.st.fall = 2; m._sqSt = null; const st = g.spawnOptions().find((o) => o.id === 'sq:' + m.id)?.st; v.st.fall = 0; return st; }, mv.vi);
  check(mf === 9, `veh: devrik motorda kapalı (durum ${mf})`);
  check(!errs.length, `veh: sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}

// ───────────── 12.205 büyük harita yakınlaştırma / kaydırma ─────────────
const vstate = (page) => page.evaluate(() => { const b = window.__game.bigMap, v = b.vw; return { z: +v.z.toFixed(2), cx: +v.cx.toFixed(1), cz: +v.cz.toFixed(1), s: b.s, dpr: b.dpr }; });
async function zoomTest() {
  const { ctx, page, errs } = await open('autostart=8v8&map=kuzey&type=conquest');
  await page.evaluate(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); });
  await page.keyboard.press('KeyM'); await page.waitForTimeout(500);
  let v = await vstate(page);
  const me = await page.evaluate(() => { const p = window.__game.playerSoldier; return { x: p.pos.x, z: p.pos.z }; });
  check(v.z === 2, `zoom: ilk açılış büyük haritada ×2 (×${v.z}), kendi konumuna yakın ortalı (${v.cx}, ${v.cz} / ben ${me.x.toFixed(0)}, ${me.z.toFixed(0)})`);
  await page.click('#bmap .bmzc .zf'); await page.waitForTimeout(400);
  v = await vstate(page);
  check(v.z === 1, `zoom: ⤢ tüm harita (×${v.z})`);
  await page.screenshot({ path: `${VOUT}/10-harita-x1.png` });
  // tekerlek: imlecin altındaki dünya noktası yerinde kalır (harita görünümü doldurduktan sonra; ×1 yakınında dar eksende harita ortalı kalır)
  const r = await page.evaluate(() => window.__game.bigMap.cv.getBoundingClientRect().toJSON());
  const cx = r.left + r.width * 0.58, cy = r.top + r.height * 0.45;
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -100); await page.waitForTimeout(200);
  const z1 = (await vstate(page)).z;
  check(z1 > 1.1, `zoom: tek tekerlek adımı ×1 → ×${z1}`);
  await page.evaluate(() => { const b = window.__game.bigMap, v = b.vw; v.z = 2; v.cx = 0; v.cz = 0; b.fit(b.cv.width, b.cv.height); });
  const w0 = await page.evaluate(([x, y]) => { const b = window.__game.bigMap, [px, py] = b.local(x, y); return [b.IX(px), b.IZ(py)]; }, [cx, cy]);
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(40); }
  await page.waitForTimeout(300);
  v = await vstate(page);
  const w1 = await page.evaluate(([x, y]) => { const b = window.__game.bigMap, [px, py] = b.local(x, y); return [b.IX(px), b.IZ(py)]; }, [cx, cy]);
  const drift = Math.hypot(w1[0] - w0[0], w1[1] - w0[1]);
  check(v.z > 2.5 && v.z <= 6 && drift < 1, `zoom: tekerlek ×2 → ×${v.z}, imlecin altındaki nokta ${drift.toFixed(2)} m kaydı`);
  // ×3 tam
  await page.evaluate(([x, y]) => { const b = window.__game.bigMap; b.zoomAt(x, y, 3 / b.vw.z); b._vt = 0; }, [cx, cy]);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${VOUT}/11-harita-x3.png` });
  // yazı / simge boyu ölçeklenmez: bayrak dairesi yarıçapı sabit (13 px · dpr); bölge adı yazısı ×1'e göre en çok +2 px
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(30); }
  await page.waitForTimeout(400);
  v = await vstate(page);
  check(v.z === 6, `zoom: en çok ×6 (×${v.z})`);
  await page.screenshot({ path: `${VOUT}/12-harita-x6.png` });
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 200);
  await page.waitForTimeout(300);
  v = await vstate(page);
  check(v.z === 1, `zoom: en az tüm harita (×${v.z})`);
  // sürükle: kaydırır, işaret koymaz
  await page.evaluate(([x, y]) => { const b = window.__game.bigMap; b.zoomAt(x, y, 3); const v = b.vw; v.cx = 0; v.cz = 0; b.fit(b.cv.width, b.cv.height); b._vt = 0; }, [cx, cy]);
  await page.evaluate(() => window.__game.pings.items.delete(window.__game.playerSoldier.id));
  await page.waitForTimeout(250);
  const v0 = await vstate(page);
  await page.mouse.move(cx, cy); await page.mouse.down(); for (let k = 1; k <= 8; k++) { await page.mouse.move(cx - k * 15, cy - k * 8); await page.waitForTimeout(16); } await page.mouse.up();
  await page.waitForTimeout(250);
  let v1 = await vstate(page);
  const pg = await page.evaluate(() => !!window.__game.pings.items.get(window.__game.playerSoldier.id));
  const want = 120 * v0.dpr / v0.s;
  check(Math.abs((v1.cx - v0.cx) - want) < 1.5 && !pg, `zoom: sol tık sürükleme kaydırdı (${(v1.cx - v0.cx).toFixed(1)} m, beklenen ${want.toFixed(1)}), işaret konmadı`);
  // sağ tık sürükleme de kaydırır
  await page.mouse.move(cx, cy); await page.mouse.down({ button: 'right' }); for (let k = 1; k <= 6; k++) { await page.mouse.move(cx + k * 12, cy); await page.waitForTimeout(16); } await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(200);
  const v2 = await vstate(page);
  check(v2.cx < v1.cx - 1, `zoom: sağ tık sürükleme kaydırdı (${(v2.cx - v1.cx).toFixed(1)} m)`);
  // eşiğin altında (3 px) titreyen tık işaret koyar
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 3, cy + 2); await page.mouse.up();
  await page.waitForTimeout(250);
  const pg2 = await page.evaluate(() => { const g = window.__game, p = g.pings.items.get(g.playerSoldier.id); return p ? [p.x, p.z] : null; });
  const wc = await page.evaluate(([x, y]) => { const b = window.__game.bigMap, [px, py] = b.local(x, y); return [b.IX(px), b.IZ(py)]; }, [cx, cy]);
  check(pg2 && Math.hypot(pg2[0] - wc[0], pg2[1] - wc[1]) < 2, `zoom: yakınken tık doğru yere işaret koydu (${pg2 && pg2.map((a) => a.toFixed(1))})`);
  // fare kilitli yolu (sanal imleç): basılı sürükle = kaydır, bırak = tık değil; kısa bas-bırak = işaret
  await page.evaluate(() => window.__game.pings.items.delete(window.__game.playerSoldier.id));
  await page.waitForTimeout(500);                                         // işaret sel sınırı (0,45 sn)
  const lk = await page.evaluate(([x, y]) => {
    const b = window.__game.bigMap, g = window.__game; b.cx = x; b.cy = y;
    const a = { ...b.vw }, w0 = (() => { const [px, py] = b.local(b.cx, b.cy); return [b.IX(px), b.IZ(py)]; })();
    b.lockedDown(0); for (let i = 0; i < 6; i++) b.moveCursor(10, 0); b.lockedUp(0);
    const c = { ...b.vw }, p1 = !!g.pings.items.get(g.playerSoldier.id);
    const w1 = (() => { const [px, py] = b.local(b.cx, b.cy); return [b.IX(px), b.IZ(py)]; })();      // tutulan nokta imleçle gitti
    b.lockedDown(0); b.moveCursor(2, 1); b.lockedUp(0);
    const p2 = !!g.pings.items.get(g.playerSoldier.id);
    return { dx: +(c.cx - a.cx).toFixed(1), grab: +Math.hypot(w1[0] - w0[0], w1[1] - w0[1]).toFixed(2), p1, p2 };
  }, [cx, cy]);
  check(lk.dx < -1 && lk.grab < 1 && !lk.p1 && lk.p2, `zoom: kilitli sanal imleçle sürükleme kaydırdı (${lk.dx} m, tutulan nokta imleçte ${lk.grab} m, işaret yok), kısa tık işaret koydu`);
  // kapat / aç: yakınlık hatırlanır, kendi konumuna ortalanır (kenarda alan sınırıyla)
  await page.keyboard.press('KeyM'); await page.waitForTimeout(300);
  const zb = (await vstate(page)).z;
  await page.keyboard.press('KeyM'); await page.waitForTimeout(400);
  v = await vstate(page);
  const exp = await page.evaluate(() => { const g = window.__game, b = g.bigMap, v = b.vw, k = { ...v }, me = g.playerSoldier; v.cx = me.pos.x; v.cz = me.pos.z; b.fit(b.cv.width, b.cv.height); const r = { cx: v.cx, cz: v.cz, me: [me.pos.x, me.pos.z] }; Object.assign(v, k); b.fit(b.cv.width, b.cv.height); return r; });
  check(v.z === zb && Math.hypot(v.cx - exp.cx, v.cz - exp.cz) < 1, `zoom: yeniden açılınca ×${v.z} hatırlandı, kendi konumuna ortalı (orta ${v.cx}, ${v.cz} · ben ${exp.me.map((a) => a.toFixed(0))}; kenarda sınırlı)`);
  await page.keyboard.press('KeyM');
  // ölüm doğuş haritası: tüm harita ile açılır, tekerlek orada da çalışır, yakınken arkadaşa tıklanır
  await calmMates(page);
  await kill(page); await page.waitForTimeout(1200);
  v = await vstate(page);
  check(v.z === 1, `zoom: doğuş haritası tüm haritayla açıldı (×${v.z})`);
  const dr = await page.evaluate(() => window.__game.bigMap.cv.getBoundingClientRect().toJSON());
  await page.mouse.move(dr.left + dr.width / 2, dr.top + dr.height / 2);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(40); }
  await page.waitForTimeout(300);
  v = await vstate(page);
  check(v.z > 2, `zoom: doğuş haritasında tekerlek (×${v.z})`);
  await page.screenshot({ path: `${VOUT}/13-dogus-haritasi-yakin.png` });
  check(!errs.length, `zoom: sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}

// ───────────── 12.205 mobil: iki parmak yakınlaştırma, tek parmak kaydırma, dokunma işaret / doğuş seçimi ─────────────
async function mobZoom() {
  const { ctx, page, errs } = await open('autostart=8v8&map=kuzey&type=conquest', true);
  await page.evaluate(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); });
  const bt = await page.evaluate(() => { const b = document.querySelector('[data-b=map]'); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.touchscreen.tap(bt[0], bt[1]); await page.waitForTimeout(600);
  await page.click('#bmap .bmzc .zf').catch(() => {}); await page.evaluate(() => window.__game.bigMap.zoomFit()); await page.waitForTimeout(300);
  const cdp = await ctx.newCDPSession(page);
  const r = await page.evaluate(() => window.__game.bigMap.cv.getBoundingClientRect().toJSON());
  const mx = r.left + r.width / 2, my = r.top + r.height / 2;
  const w0 = await page.evaluate(([x, y]) => { const b = window.__game.bigMap, [px, py] = b.local(x, y); return [b.IX(px), b.IZ(py)]; }, [mx, my]);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mx - 20, y: my, id: 1 }, { x: mx + 20, y: my, id: 2 }] });
  for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: mx - 20 - k * 6, y: my, id: 1 }, { x: mx + 20 + k * 6, y: my, id: 2 }] }); await page.waitForTimeout(30); }
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${VOUT}/14-mobil-iki-parmak.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  let v = await vstate(page);
  const w1 = await page.evaluate(([x, y]) => { const b = window.__game.bigMap, [px, py] = b.local(x, y); return [b.IX(px), b.IZ(py)]; }, [mx, my]);
  check(v.z > 3.5 && v.z < 4.5 && Math.hypot(w1[0] - w0[0], w1[1] - w0[1]) < 3, `mobil: iki parmakla yakınlaştı (×${v.z}, parmaklar 40 → 160 px = ×4; ortadaki nokta ${Math.hypot(w1[0] - w0[0], w1[1] - w0[1]).toFixed(1)} m)`);
  const pg0 = await page.evaluate(() => !!window.__game.pings.items.get(window.__game.playerSoldier.id));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${VOUT}/15-mobil-yakin.png` });
  // tek parmak sürükleme
  const v0 = v;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mx, y: my, id: 3 }] });
  for (let k = 1; k <= 8; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: mx + k * 10, y: my + k * 4, id: 3 }] }); await page.waitForTimeout(25); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  v = await vstate(page);
  const pg1 = await page.evaluate(() => !!window.__game.pings.items.get(window.__game.playerSoldier.id));
  check(v.cx < v0.cx - 1 && !pg0 && !pg1, `mobil: tek parmak kaydırdı (${(v.cx - v0.cx).toFixed(1)} m), sıkıştırma / sürükleme işaret koymadı`);
  // dokunma işaret koyar
  await page.touchscreen.tap(mx - 60, my + 20); await page.waitForTimeout(300);
  check(await page.evaluate(() => !!window.__game.pings.items.get(window.__game.playerSoldier.id)), 'mobil: yakınken dokunma işaret koydu');
  const x = await page.evaluate(() => { const r = document.querySelector('#bmap .x').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.touchscreen.tap(x[0], x[1]); await page.waitForTimeout(300);
  // doğuş: yakınlaştırıp arkadaşa dokun → seç → Doğ
  await calmMates(page);
  await kill(page); await page.waitForTimeout(1500);
  const mate = await page.evaluate(() => { const t = window.__game.bigMap.targets().find((t) => t.kind === 'mate' && t.ok); return t ? { id: t.id, x: t.x, z: t.z, mid: t.mate.id } : null; });
  if (mate) {
    let [tx, ty] = await scr(page, mate.x, mate.z);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx - 15, y: ty, id: 4 }, { x: tx + 15, y: ty, id: 5 }] });
    for (let k = 1; k <= 6; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx - 15 - k * 5, y: ty, id: 4 }, { x: tx + 15 + k * 5, y: ty, id: 5 }] }); await page.waitForTimeout(30); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    const zd = (await vstate(page)).z;
    [tx, ty] = await scr(page, mate.x, mate.z);
    await page.touchscreen.tap(tx, ty); await page.waitForTimeout(300);
    const ch = await page.evaluate(() => window.__game.spawnChoice);
    check(zd > 1.5 && ch === mate.id, `mobil: doğuş haritası iki parmakla yakınlaştı (×${zd.toFixed(1)}), dokunma arkadaşı seçti (${ch})`);
    await page.screenshot({ path: `${VOUT}/16-mobil-dogus-yakin.png` });
  } else check(false, 'mobil: uygun manga arkadaşı yok');
  check(!errs.length, `mobil zoom: sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}

// Kontroller: ana menü + oyun içi (Esc → Kontroller), Türkçe ve İngilizce
if (part('ctl')) for (const lang of ['tr', 'en']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  await ctx.addInitScript((l) => { localStorage.setItem('warbyte.lang', l); if (!localStorage.getItem('warbyte.acct')) localStorage.setItem('warbyte.acct', JSON.stringify({ kind: 'guest' })); }, lang);      // misafir: giriş ekranı açılmasın
  const page = await ctx.newPage(), errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/?debug=1`);
  await page.waitForSelector('.mn-nav[data-v=controls]', { timeout: 60000 }); await page.waitForTimeout(800);
  await page.click('.mn-nav[data-v=controls]'); await page.waitForTimeout(600);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.kbrow')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
  const want = lang === 'tr' ? [/Büyük harita.*M/, /İşaret koy.*I/, /Takım seçimi.*K/] : [/Big map.*M/, /Place marker.*I/, /Team select.*K/];
  for (const re of want) check(rows.some((r) => re.test(r)), `menü Kontroller (${lang}): ${re}`);
  await page.screenshot({ path: `${OUT}/kontroller-menu-${lang}.png` });
  await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&nolock=1`);
  await page.waitForFunction(() => window.__game?.running && window.__game.time > 1, null, { timeout: 120000 });
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await page.click('#bCtl').catch(() => {}); await page.waitForTimeout(600);
  const txt = await page.evaluate(() => [...document.querySelectorAll('.kb')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
  for (const re of want) check(txt.some((r) => re.test(r)), `Esc → Kontroller (${lang}): ${re}`);
  await page.screenshot({ path: `${OUT}/kontroller-oyun-${lang}.png` });
  check(!errs.length, `Kontroller (${lang}): sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}

if (part('veh')) await vehDeploy();
if (part('zoom')) await zoomTest();
if (part('mob')) await mobZoom();
if (part('base')) {
  await desk('kuzey','autostart=8v8&map=kuzey&type=conquest', true);
  await desk('cg', 'autostart=6v6&map=colgecidi&type=conquest', true);
  await desk('cg-tdm', 'autostart=6v6&map=colgecidi&type=tdm', false);
}

// kapalı modlar: silah oyunu, Enfekte
if (part('off')) for (const [tag, q] of [['gg', 'autostart=6v6&map=colgecidi&type=gg'], ['inf', 'autostart=6v6&map=colgecidi&type=inf']]) {
  const { ctx, page, errs } = await open(q);
  await kill(page); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { const g = window.__game; return { hud: !!g.squadHud, mode: g.bigMap?.mode, dmap: g.hud.$('respawn').classList.contains('dmap') }; });
  check(!r.hud && r.mode !== 'deploy' && !r.dmap, `${tag}: manga HUD'u / doğuş seçici kapalı (${JSON.stringify(r)})`);
  check(!errs.length, `${tag}: sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}

// mobil: Pixel 7 yatay, dokunmatik harita düğmesi
if (part('mobbase')) {
  const { ctx, page, errs } = await open('autostart=8v8&map=kuzey&type=conquest', true);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/mob-hud.png` });
  const bt = await page.evaluate(() => { const b = document.querySelector('[data-b=map]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; });
  check(bt && bt[2] > 10, `mobil: harita düğmesi var (${bt && bt[2].toFixed(0)} px)`);
  if (bt) { await page.touchscreen.tap(bt[0], bt[1]); await page.waitForTimeout(600); }
  check(await page.evaluate(() => window.__game.bigMap.open), 'mobil: harita düğmesi büyük haritayı açtı');
  const tgt = await page.evaluate(() => { const g = window.__game, o = g.mode.objectives[1] || g.mode.objectives[0]; return { x: o.x + 25, z: o.z }; });
  const [tx, ty] = await scr(page, tgt.x, tgt.z);
  await page.touchscreen.tap(tx, ty); await page.waitForTimeout(400);
  check(await page.evaluate(() => !!window.__game.pings.items.get(window.__game.playerSoldier.id)), 'mobil: haritaya dokunmak işaret koydu');
  await page.screenshot({ path: `${OUT}/mob-harita.png` });
  const x = await page.evaluate(() => { const r = document.querySelector('#bmap .x').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.touchscreen.tap(x[0], x[1]); await page.waitForTimeout(400);
  check(!(await page.evaluate(() => window.__game.bigMap.open)), 'mobil: ✕ haritayı kapattı');
  await calmMates(page);
  await kill(page); await page.waitForTimeout(1500);
  check(await page.evaluate(() => window.__game.bigMap.mode === 'deploy'), 'mobil: ölünce doğuş seçici');
  await page.screenshot({ path: `${OUT}/mob-olum-dogus.png` });
  const mate = await page.evaluate(() => { const t = window.__game.bigMap.targets().find((t) => t.kind === 'mate' && t.ok); return t ? { id: t.id, x: t.x, z: t.z, mid: t.mate.id } : null; });
  if (mate) {
    const [mx, my] = await scr(page, mate.x, mate.z);
    await page.touchscreen.tap(mx, my); await page.waitForTimeout(300);
    const go = await page.evaluate(() => { const r = document.querySelector('#respawn .dgo').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; });
    check(go[2] > 40, `mobil: Doğ düğmesi görünür (${go[2].toFixed(0)} px)`);
    await page.touchscreen.tap(go[0], go[1]);
    await page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 20000 }).catch(() => {});
    const r = await page.evaluate((mid) => { const g = window.__game, p = g.playerSoldier, m = g.soldiers[mid]; return { alive: p.alive, d: Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z), ch: g.spawnChoice }; }, mate.mid);
    check(r.alive && r.d < 4.5, `mobil: dokunarak manga arkadaşının yanında doğdu (${r.d.toFixed(2)} m, ${r.ch})`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/mob-mangadan-dogus.png` });
  } else check(false, 'mobil: uygun manga arkadaşı yok');
  check(!errs.length, `mobil: sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `sonuç: HATA (${fails})` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
