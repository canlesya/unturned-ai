// Uzay modu + Yörünge Üssü denetimi (12.157).
//   node scripts/spacetest.mjs                                   0 tarayıcısız: mod kuralları, yer çekimi / zıplama, düşme hasarı yok, el bombası, donanım, nav + sızıntı + doğuş görüşü, bot maçı (takılma)
//   node scripts/spacetest.mjs <vite url> <ws url>               + 1 tarayıcı çevrimdışı (mod / silah / kıyafet / sayfa hatası) + 2 çevrim içi (iki istemci: zıplama sunucu = istemci, tahmin düzeltmesi, uzaktan görülen zirve, düşme hasarı yok)
//   Sunucu: PORT=8895 ADMIN_PORT=8896 BF_DATA=/tmp/wb-x BF_DEBUG=1 node server/index.js      BOTSEC=180 (bot maçı süresi)
import * as THREE from 'three';
import { Game } from '../src/game/game.js';
import { applyInput } from '../src/sim/input.js';
import { SIM_DT } from '../src/net/protocol.js';
import { makeMatch } from '../src/game/match.js';
import { sanitizeCfg, MAPS_FOR } from '../server/room.js';
import { WSTATS, SPACE_WEAPONS } from '../src/game/stats.js';
import { TUNE } from '../src/game/balance.js';
import { simulateNade } from '../src/game/grenade.js';
import { World } from '../src/game/collision.js';
import { mapsFor } from '../src/maps/index.js';

let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
console.log('── 0 · tarayıcısız');
// mod kaydı
const m = makeMatch({ type: 'space', perTeam: 6 });
check(m.type === 'space' && m.space && m.scoreBased && !m.ffa && m.tickets === 60, `makeMatch space: ${JSON.stringify({ type: m.type, space: m.space, score: m.scoreBased, tickets: m.tickets, time: m.time })}`);
const c = sanitizeCfg({ type: 'space', map: 'kasaba', weather: 'rain', perTeam: 8 });
check(c.type === 'space' && c.map === 'yorunge' && c.weather === 'clear' && MAPS_FOR('space').join() === 'yorunge' && mapsFor('space').map((x) => x.id).join() === 'yorunge' && !mapsFor('tdm').some((x) => x.id === 'yorunge'), `sanitizeCfg / harita eşlemesi: ${c.map} / ${c.weather}, tdm listesinde yok`);
// zıplama
const jump = (type, run) => {
  const g = new Game(null, { headless: true, map: type === 'space' ? 'yorunge' : 'kasaba', match: { perTeam: 1, type } });
  const s = g.soldiers[0], sp = type === 'space' ? (run ? [9.5, 31] : [-40, -18]) : [g.map.spawns.blue[0].x, g.map.spawns.blue[0].z];
  s.pos.set(sp[0], type === 'space' ? 0.4 : 0, sp[1]); s.vel.set(0, 0, 0); s.onGround = false; s.alive = true; s.yaw = 0;
  for (let i = 0; i < 40; i++) g.world.move(s, SIM_DT);
  for (let i = 0; i < (run ? 30 : 0); i++) { applyInput(s, { f: 1, r: 0, lean: 0, sprint: true, jump: false }, SIM_DT); g.world.move(s, SIM_DT); }
  const y0 = s.pos.y, x0 = s.pos.x, z0 = s.pos.z, inp = { f: run ? 1 : 0, r: 0, lean: 0, sprint: !!run, jump: false }; let top = y0, t = 0, k = 0;
  applyInput(s, { ...inp, jump: true }, SIM_DT);
  do { g.world.move(s, SIM_DT); applyInput(s, inp, SIM_DT); top = Math.max(top, s.pos.y); t += SIM_DT; k++; } while (!s.onGround && k < 1000);
  return { g, grav: g.world.grav, h: top - y0, t, d: Math.hypot(s.pos.x - x0, s.pos.z - z0) };
};
const J0 = jump('tdm'), J1 = jump('space'), R1 = jump('space', true);
check(J0.grav === 1 && Math.abs(J0.h - 0.97) < 0.08, `normal zıplama: zirve ${J0.h.toFixed(2)} m · havada ${J0.t.toFixed(2)} sn`);
check(Math.abs(J1.grav - TUNE.spaceGrav) < 1e-9 && J1.h > 1.8 && J1.h < 2.15 && J1.t > 1.5 && J1.t < 1.9, `Uzay zıplaması (g × ${J1.grav}): zirve ${J1.h.toFixed(2)} m · havada ${J1.t.toFixed(2)} sn · koşarak (0,5 sn hızlanıp) ${R1.d.toFixed(1)} m (pistten iniş, 0,35 m alçak)`);
// düşme hasarı: 15 m'den bırak
const drop = (g) => { const s = g.soldiers[0]; s.pos.set(g.map.id === 'yorunge' ? -40 : 0, 15, g.map.id === 'yorunge' ? -18 : 0); s.vel.set(0, 0, 0); s.onGround = false; s.fallTop = 15; s.protT = 0; s.hp = s.maxHp; s.alive = true; let k = 0; do { g.world.move(s, SIM_DT); g.fallCheck(s); k++; } while (!s.onGround && k < 2000); return s.maxHp - s.hp; };
const d0 = drop(J0.g), d1 = drop(J1.g);
check(d0 > 50 && d1 === 0, `15 m düşüş hasarı: normal ${d0} · Uzay ${d1}`);
// el bombası: aynı atış, düşük yer çekiminde daha uzun yol / sürede yere değer
// 12.185: atış düz, engelsiz zeminde (aynı yer çekimi çarpanı) — harita yerleşimi değişince (Kasaba v3 doğuşu, Yörünge kayaları) bomba duvara çarpıp test yanlış HATA veriyordu
const flatWorld = (g) => { const w = new World([], { minX: -500, maxX: 500, minZ: -500, maxZ: 500 }, null); w.grav = g.world.grav; return w; };
const nade = (g) => { const p = V(0, 1.6, 0); return { ...simulateNade(flatWorld(g), p.clone(), V(0, 2.5 + 19 * 0.26, -19 * 0.97), 3.0), o: p }; };
const nd = (r) => (r.land ? Math.hypot(r.land.x - r.o.x, r.land.z - r.o.z) : 0);
const n0 = nade(J0.g), n1 = nade(J1.g);
check(nd(n1) > nd(n0) * 1.3, `el bombası ilk değme (15°): normal ${nd(n0).toFixed(1)} m · Uzay ${nd(n1).toFixed(1)} m`);
// donanım: Uzay'da yalnız enerji silahı (ana + yan), diğer modda hiç
const G = new Game(null, { headless: true, map: 'yorunge', match: { perTeam: 8, type: 'space' } });
const bad = G.soldiers.filter((s) => !SPACE_WEAPONS.includes(s.items[0].id) || s.items[1].id !== 'epistol');
const Gt = new Game(null, { headless: true, map: 'kasaba', match: { perTeam: 8, type: 'tdm' } });
check(!bad.length && !Gt.soldiers.some((s) => s.items.some((it) => WSTATS[it.id]?.space)), `donanım: Uzay ${G.soldiers.map((s) => s.cls[0] + ':' + s.items[0].id).join(' ')} · tdm'de enerji silahı yok`);
// nav: doğuştan ulaşılabilirlik, bölgelere yol, sızıntı (çatı / sınır dışı), doğuş ↔ doğuş görüşü
const nav = G.nav, B = G.map.bounds, sb = G.map.spawns.blue, sr = G.map.spawns.red;
const seen = nav.reachable(sb[0].x, sb[0].z);
let cells = 0, outside = 0, high = 0;
for (let i = 0; i < seen.length; i++) if (seen[i]) { cells++; const x = nav.cx(i), z = nav.cz(i); if (x < B.minX || x > B.maxX || z < B.minZ || z > B.maxZ) outside++; if (nav.floor && nav.floor[i] > 4.2) high++; }
const redIdx = nav.idx(sr[0].x, sr[0].z);
check(cells > 5000 && outside === 0 && high === 0 && seen[redIdx], `nav: Mavi doğuştan ${cells} hücre, sınır dışı ${outside}, çatı katı ${high}, Kırmızı doğuşa ulaşılıyor ${!!seen[redIdx]}`);
const major = G.map.callouts.filter((q) => q.major);
const paths = major.map((q) => { const p = nav.findPath(sb[0].x, sb[0].z, q.x, q.z); let L = 0, a = V(sb[0].x, 0, sb[0].z); for (const w of p || []) { L += a.distanceTo(w); a = w; } return [q.name, p ? Math.round(L) : null]; });
check(paths.every((p) => p[1] !== null), `yollar (Mavi doğuştan): ${paths.map(([n, l]) => `${n} ${l} m`).join(' · ')}`);
let vis = 0; for (const a of sb) for (const b of sr) if (G.world.clear(V(a.x, 1.6, a.z), V(b.x, 1.6, b.z))) vis++;
// doğuşa dışarıdan görüş: ulaşılabilir her 2 m'lik hücreden (rakip hangarı dışında) doğuş noktalarına göz hizasında açık hat sayısı
let exp = { blue: 0, red: 0 }, expAt = []; const zoneIn = (z, x, y) => x >= z.minX && x <= z.maxX && y >= z.minZ && y <= z.maxZ;
for (let i = 0; i < seen.length; i += 4) { if (!seen[i]) continue; const x = nav.cx(i), z = nav.cz(i); if (Math.floor(i / nav.w) % 4) continue;
  for (const [team, pts] of [['blue', sb], ['red', sr]]) { if (zoneIn(G.map.baseZones[team], x, z)) continue; for (let k = 0; k < pts.length; k += 3) if (G.world.clear(V(x, 1.6, z), V(pts[k].x, 1.4, pts[k].z))) { exp[team]++; if (expAt.length < 12 && team === 'blue') expAt.push(`${x.toFixed(0)},${z.toFixed(0)}→${pts[k].x},${pts[k].z}`); break; } } }
check(vis === 0 && exp.blue === 0 && exp.red === 0, `doğuşlar: Mavi ↔ Kırmızı görüş ${vis} çift · dışarıdan doğuş noktası gören hücre Mavi ${exp.blue} / Kırmızı ${exp.red} ${expAt.join(' ')}`);
// sıçrama sızıntısı: ulaşılabilir en yüksek zemin + zıplama zirvesi < en alçak ulaşılmaz çatı (modül 6,5 m, krater duvarı)
const apex = J1.h, roofs = G.world.colliders.filter((q) => q.max[1] > 5).map((q) => q.max[1]), lowRoof = Math.min(...roofs);
const tops = G.world.colliders.filter((q) => q.max[1] <= 4.3 && q.max[1] > 3).map((q) => q.max[1]), maxFloor = Math.max(...tops);
check(maxFloor + apex + 0.05 < lowRoof, `zıplama sızıntısı: en yüksek çıkılır yüzey ${maxFloor.toFixed(2)} m + zirve ${apex.toFixed(2)} = ${(maxFloor + apex).toFixed(2)} < en alçak çatı / duvar ${lowRoof.toFixed(2)} m`);
// bot maçı: takılma (yaşayan bot 6 sn'de < 0,6 m yer değiştirdiyse ve ateş etmiyorsa) / dk / bot, öldürme
{
  const secs = +(process.env.BOTSEC || 180), g = new Game(null, { headless: true, map: 'yorunge', diff: 'normal', match: { perTeam: 8, type: 'space', time: 0, tickets: 9999 } });
  const last = new Map(); let stuck = 0, err = 0, samples = 0, roles = {};
  try {
    for (let i = 0; i < secs * 30; i++) {
      g.step(1 / 30);
      if (i % 180 === 0) for (const s of g.soldiers) { const b = s.brain; if (!s.alive || !b) { last.delete(s); continue; } const p = last.get(s); if (p && s.alive && p.spawnN === s.spawnN && Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < 0.6 && !(b.target && b.target.alive) && !b.perching && !b.atSpot) stuck++; samples++; last.set(s, { x: s.pos.x, z: s.pos.z, spawnN: s.spawnN }); }
    }
  } catch (e) { err++; console.log(e.stack); }
  for (const b of g.brains) roles[b.role || 'yok'] = (roles[b.role || 'yok'] || 0) + 1;
  const kills = g.soldiers.reduce((a, s) => a + s.kills, 0), perMin = stuck / (secs / 60) / 16, under = g.soldiers.filter((s) => s.pos.y < -1 || !Number.isFinite(s.pos.x)).length;
  check(err === 0 && under === 0 && kills > secs / 6 && perMin < 0.6, `bot maçı 8v8 ${secs} sn: öldürme ${kills} (Mavi ${g.tickets.blue} / Kırmızı ${g.tickets.red}) · takılma ${perMin.toFixed(2)} / dk / bot · yeraltı ${under} · roller ${JSON.stringify(roles)}`);
}

const base = process.argv[2], ws = process.argv[3];
if (base) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const errs = [];
  const mk = async (vp = { width: 1280, height: 720 }) => { const ctx = await browser.newContext({ viewport: vp, locale: 'tr-TR' }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  console.log('── 1 · menü + tarayıcı çevrimdışı');
  {
    const M = await mk();
    await M.goto(`${base}/?debug=1&nolock=1&nologin=1`); await M.waitForTimeout(2500);
    await M.evaluate(() => { const b = [...document.querySelectorAll('[data-a]')].find((e) => /Özel Oyun/i.test(e.textContent)); b?.click(); });
    await M.waitForTimeout(800);
    const card = await M.$('[data-a="type"][data-v="space"]'); if (card) { await card.click(); await M.waitForTimeout(900); }
    const st = await M.evaluate(() => ({ card: document.querySelector('[data-v="space"] b')?.textContent, map: document.querySelector('.mapc.on b')?.textContent, maps: document.querySelectorAll('.mapc').length, lim: [...document.querySelectorAll('.sc h4')].map((e) => e.textContent).join('|'), wea: [...document.querySelectorAll('.sc')].map((e) => e.textContent).find((t) => /Uzayda hava yok/.test(t)) ? 1 : 0 }));
    await M.screenshot({ path: '/tmp/wb-uzay/spacetest-menu.png' });
    await M.evaluate(() => document.querySelector('[data-a="quick"]')?.click());
    await M.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
    const gm = await M.evaluate(() => ({ type: window.__game.mode.type, map: window.__game.map.id }));
    check(!!card && st.map === 'Yörünge Üssü' && st.maps === 1 && /Skor/.test(st.lim) && st.wea && gm.type === 'space' && gm.map === 'yorunge', `menü: kart "${st.card}", harita ${st.map} (${st.maps} kart), ${st.lim}, hava kartı uzay notu ${st.wea} → Oyna: ${gm.type} / ${gm.map}`);
    await M.context().close();
  }
  const P = await mk();
  await P.goto(`${base}/?autostart=4v4&map=yorunge&type=space&debug=1&nolock=1&team=blue`);
  await P.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  const o = await P.evaluate(() => { const g = window.__game, s = g.playerSoldier; return { type: g.mode.type, grav: g.world.grav, w: s.items.map((i) => i.id), look: !!g.player.vm.look?.cuff, tod: g.tod, weather: g.weather?.type || g.weather?.kind || '', helmet: !!g.sfx._helmet || !g.sfx.ctx, egrav: g.effects.gravMul, suit: g.soldiers.filter((x) => x !== s).every((x) => x.model && x.model.root) }; });
  check(o.type === 'space' && o.grav < 0.5 && o.w[0] && WSTATS[o.w[0]].space && o.w[1] === 'epistol' && o.look && o.tod === 'day' && Math.abs(o.egrav - Math.sqrt(o.grav)) < 1e-6 && o.helmet, `çevrimdışı: ${JSON.stringify(o)}`);
  if (ws) {
    console.log('── 2 · çevrim içi (yerel sunucu)');
    const A = await mk(), Bp = await mk();
    await A.goto(`${base}/?online=new&map=yorunge&per=4&type=space&server=${encodeURIComponent(ws)}&debug=1&nolock=1&name=Ali&team=blue&room=Uzay&bots=0`);
    await A.waitForFunction('window.__game && window.__game.running && window.__game.online && window.__game.player', null, { timeout: 120000 });
    const code = await A.evaluate(() => window.__game.opts.online.room);
    await Bp.goto(`${base}/?online=${code}&server=${encodeURIComponent(ws)}&debug=1&nolock=1&name=Veli&team=red`);
    await Bp.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
    const info = await Promise.all([A, Bp].map((p) => p.evaluate(() => ({ map: window.__game.map.id, type: window.__game.mode.type, grav: window.__game.world.grav, w: window.__game.playerSoldier.items[0].id }))));
    check(info.every((i) => i.map === 'yorunge' && i.type === 'space' && i.grav < 0.5 && WSTATS[i.w].space), `oda ${code}: ${JSON.stringify(info)}`);
    // A açık zemine ışınlanır, B A'ya bakar; A 4 kez zıplar (Space) — istemci tahmini düzeltmesi, A'nın kendi zirvesi, B'nin gördüğü zirve
    await A.evaluate(() => window.__game.online.send({ t: 'dbg', tp: [-40, -18], hp: 100 }));
    await Bp.evaluate(() => window.__game.online.send({ t: 'dbg', tp: [-28, -18], hp: 100 }));
    await A.waitForTimeout(1500);
    const c0 = await A.evaluate(() => { const st = window.__game.online.stats; window.__topA = 0; window.__y0 = window.__game.playerSoldier.pos.y; return { cor: st.corrections, err: st.errMax || 0 }; });
    await Bp.evaluate(() => { const g = window.__game, a = g.soldiers.find((s) => s.name === 'Ali'); window.__y0 = a.pos.y; window.__topB = 0; window.__ti = setInterval(() => { window.__topB = Math.max(window.__topB, a.pos.y - window.__y0); }, 8); });
    await A.evaluate(() => { const g = window.__game; window.__ti = setInterval(() => { window.__topA = Math.max(window.__topA, g.playerSoldier.pos.y - window.__y0); }, 8); });
    for (let i = 0; i < 4; i++) { await A.keyboard.down('Space'); await A.waitForTimeout(90); await A.keyboard.up('Space'); await A.waitForTimeout(1900); }
    const c1 = await A.evaluate(() => { clearInterval(window.__ti); const st = window.__game.online.stats; return { cor: st.corrections, err: +(st.errMax || 0).toFixed(3), top: +window.__topA.toFixed(2) }; });
    const topB = await Bp.evaluate(() => { clearInterval(window.__ti); return +window.__topB.toFixed(2); });
    check(c1.top > 1.8 && c1.top < 2.15 && c1.cor - c0.cor === 0, `çevrim içi zıplama: A kendi zirvesi ${c1.top} m · tahmin düzeltmesi ${c1.cor - c0.cor} (en büyük hata ${c1.err} m)`);
    check(topB > 1.75 && topB < 2.2, `B'nin gördüğü A zirvesi ${topB} m (sunucu anlık görüntüsü)`);
    // düşme hasarı yok: sunucuda 15 m'den bırak
    await A.evaluate(() => window.__game.online.send({ t: 'dbg', tpy: [-40, 15, -18], hp: 100 }));
    await A.waitForTimeout(4500);
    const hp = await A.evaluate(() => ({ hp: window.__game.playerSoldier.hp, alive: window.__game.playerSoldier.alive, y: +window.__game.playerSoldier.pos.y.toFixed(2) }));
    check(hp.alive && hp.hp === 100 && hp.y < 0.1, `çevrim içi 15 m düşüş: can ${hp.hp} · zeminde ${hp.y}`);
    // enerji silahı: B'ye ateş (A nişan alır), sunucu isabet onayı → B'nin canı düşer
    await Bp.evaluate(() => window.__game.online.send({ t: 'dbg', tp: [-32, -18], hp: 100 }));
    await A.evaluate(() => window.__game.online.send({ t: 'dbg', tp: [-40, -18] }));
    await A.waitForTimeout(1200);
    await A.evaluate(() => { const g = window.__game, s = g.playerSoldier, b = g.soldiers.find((x) => x.name === 'Veli'); s.yaw = Math.atan2(-(b.pos.x - s.pos.x), -(b.pos.z - s.pos.z)); s.pitch = -0.02; });
    await A.mouse.down(); await A.waitForTimeout(700); await A.mouse.up(); await A.waitForTimeout(800);
    const hb = await Bp.evaluate(() => window.__game.playerSoldier.hp);
    check(hb < 100, `çevrim içi lazer atışı: B canı ${hb}`);
    await A.screenshot({ path: '/tmp/wb-uzay/spacetest-online-A.png' }); await Bp.screenshot({ path: '/tmp/wb-uzay/spacetest-online-B.png' });
  }
  check(errs.length === 0, `sayfa hatası ${errs.length} ${errs.slice(0, 3).join(' | ')}`);
  await browser.close();
}
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
