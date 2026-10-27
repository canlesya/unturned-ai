// 12.198 Silah düellosu (başsız, iki bot, aynı zorluk): her silah bir referans silaha (varsayılan M4A1) karşı, mesafe kümelerinde (8 / 20 / 40 / 70 m)
// kazanma oranı. İki taraf da 100 can, Saldırı hızı (yalnız silah farkı ölçülür); CLASS=1 → sınıf varsayılan donanımı + sınıf canı / hızıyla sınıf düellosu.
// Noktalar nav + botSees ile rastgele (tohumlu, her silahta aynı noktalar); taraflar yer değiştirerek iki kez oynanır. Süre sınırı 10 sn (berabere).
//   node scripts/wduel.mjs [harita=colgecidi] [deneme=16] [ref=m4a1] [zorluk=normal] [silahlar=virgüllü]     JSON=dosya → ham sonuç
let seed = 99;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const THREE = await import('three');
const { Game } = await import('../src/game/game.js');
const { DIFFICULTY, WSTATS, CLASS_DEFS } = await import('../src/game/stats.js');
const [map = 'colgecidi', trials = '16', ref = 'm4a1', diff = 'normal', list] = process.argv.slice(2);
const CLASSMODE = process.env.CLASS === '1';
const WEAPONS = list ? list.split(',') : ['ak47', 'm4a1', 'scarh', 'aug', 'g36', 'ak74u', 'mp5', 'vector', 'p90', 'mac10', 'lmg', 'pkm', 'sniper', 'svd', 'barrett', 'shotgun', 'aa12', 'dbl', 'pistol', 'm1911', 'deagle', 'revolver'];
const DISTS = (process.env.DISTS || '8,20,40,70').split(',').map(Number);
const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff, devMode: true, match: { perTeam: 1, type: 'tdm', tickets: 9999 } });
const A = g.soldiers.find((s) => s.team === 'blue'), B = g.soldiers.find((s) => s.team === 'red');
const nav = g.nav, b = g.map.bounds, eye = new THREE.Vector3(), cen = new THREE.Vector3();
const place = (s, x, z, ry) => { s.spawn({ x, z, ry }, 0); g.world.settle(s); };
function findPairs(D, n) {
  const out = [];
  for (let k = 0; k < 60000 && out.length < n; k++) {
    const x = b.minX + 4 + Math.random() * (b.maxX - b.minX - 8), z = b.minZ + 4 + Math.random() * (b.maxZ - b.minZ - 8);
    if (!nav.isFree(x, z)) continue;
    const a = Math.random() * Math.PI * 2, d = D * (0.85 + Math.random() * 0.3), x2 = x + Math.cos(a) * d, z2 = z + Math.sin(a) * d;
    if (!nav.isFree(x2, z2)) continue;
    place(A, x, z, 0); place(B, x2, z2, 0);
    if (Math.abs(A.pos.y - B.pos.y) > 4) continue;
    if (!g.botSees(A.eye(eye), B.center(cen)) || !g.botSees(B.eye(eye), A.center(cen))) continue;
    out.push([x, z, x2, z2]);
  }
  return out;
}
const pairs = Object.fromEntries(DISTS.map((D) => [D, findPairs(D, +trials)]));
const clsOf = (w) => (['sniper', 'svd', 'barrett'].includes(w) ? 'sniper' : ['lmg', 'pkm'].includes(w) ? 'heavy' : ['mp5', 'vector', 'p90'].includes(w) ? 'medic' : ['shotgun', 'aa12', 'dbl'].includes(w) ? 'engineer' : 'assault');
function arm(s, w) {
  if (CLASSMODE) { s.choice = {}; s.setClass(w); return; }                            // w = sınıf kimliği: varsayılan donanım + sınıf canı / hızı
  s.choice = { primary: w, secondary: 'pistol', gadget: 'smoke', melee: 'knife' };
  s.setClass('assault');
}
function setup(s, w, x, z, ry) {
  arm(s, w); place(s, x, z, ry);
  if (!CLASSMODE) {
    const sec = WSTATS[w].slot === 'secondary';
    s.items[0] = { id: w, mag: WSTATS[w].mag, reserve: WSTATS[w].reserve };
    s.items[1] = sec ? { id: 'knife', mag: 1, reserve: 0 } : { id: 'pistol', mag: WSTATS.pistol.mag, reserve: WSTATS.pistol.reserve };
    s.items[2] = { id: 'smoke', mag: 0, reserve: 0 };                                  // ekipman yok: yalnız silah
    s.cur = 0; s._syncWeaponModel?.(true);
  } else if (s.items[2]) s.items[2].mag = 0;                                           // sınıf düellosunda da bomba / roket yok (silah + can + hız)
  s.brain.d = DIFFICULTY[diff]; s.brain.dk = diff; s.dmgMul = s.brain.d.dmgMul; s.brain.reset();
}
function duel(wa, wb, P) {
  const r = { a: 0, b: 0, draw: 0, ta: [], tb: [] };
  for (let t = 0; t < P.length; t++) for (const swap of [false, true]) {
    seed = 5000 + t * 31 + (swap ? 7 : 0);
    let [x, z, x2, z2] = P[t]; if (swap) [x, z, x2, z2] = [x2, z2, x, z];
    const want = Math.atan2(-(x2 - x), -(z2 - z));
    setup(A, wa, x, z, want + (Math.random() - 0.5) * 0.8); setup(B, wb, x2, z2, want + Math.PI + (Math.random() - 0.5) * 0.8);
    const t0 = g.time;
    while (g.time - t0 < 10 && A.alive && B.alive) g.step(1 / 30);
    if (!B.alive && A.alive) { r.a++; r.ta.push(g.time - t0); } else if (!A.alive && B.alive) { r.b++; r.tb.push(g.time - t0); } else r.draw++;
  }
  return r;
}
const med = (a) => { if (!a.length) return NaN; const q = [...a].sort((x, y) => x - y); return q[q.length >> 1]; };
const res = {};
const ids = CLASSMODE ? Object.keys(CLASS_DEFS) : WEAPONS;
const refId = CLASSMODE ? (ref === 'm4a1' ? 'assault' : ref) : ref;
console.log(`harita ${map} · zorluk ${diff} · referans ${refId} · nokta: ${DISTS.map((D) => `${D} m ${pairs[D].length}`).join(', ')} (×2 yer değişimi)`);
console.log(`| ${CLASSMODE ? 'sınıf' : 'silah'} | ` + DISTS.map((D) => `${D} m kazanma %`).join(' | ') + ' | ort. | öldürme sn (medyan, 20 m) |');
console.log('|---|' + DISTS.map(() => '---|').join('') + '---|---|');
for (const w of ids) {
  const row = {}; let sum = 0;
  for (const D of DISTS) { const r = duel(w, refId, pairs[D]); const n = r.a + r.b + r.draw; row[D] = { win: (r.a + r.draw * 0.5) / Math.max(1, n), a: r.a, b: r.b, draw: r.draw, tk: med(r.ta) }; sum += row[D].win; }
  res[w] = row;
  console.log(`| ${CLASSMODE ? CLASS_DEFS[w].label : WSTATS[w].name} \`${w}\` | ` + DISTS.map((D) => `${Math.round(row[D].win * 100)}${row[D].draw ? ` (b${row[D].draw})` : ''}`).join(' | ') + ` | ${Math.round((sum / DISTS.length) * 100)} | ${(row[20] || row[DISTS[0]]).tk.toFixed(2)} |`);
}
if (process.env.JSON) (await import('fs')).writeFileSync(process.env.JSON, JSON.stringify(res));
process.exit(0);
