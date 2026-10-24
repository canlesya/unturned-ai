// Keskin nişancı isabet / denge testi (ağsız, 12.153): dürbünde ilk atış sapması, belde (no-scope) ve erken quickscope sapması, tek atış eşikleri, dürbün süresi.
//   node scripts/snipertest.mjs
import { Game } from '../src/game/game.js';
import { WSTATS } from '../src/game/stats.js';
import { TUNE } from '../src/game/balance.js';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const g = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', match: { perTeam: 1, type: 'tdm', tickets: 500 } });
const A = g.claimSlot('blue', 'Ali'); g.brains.length = 0;
const s = g.soldiers.find((o) => o.id === A.id);
const hitP = (spread, dist, r) => { let n = 0; for (let i = 0; i < 20000; i++) { const rr = Math.sqrt((i * 0.618034) % 1) * spread * dist; if (rr <= r) n++; } return n / 20000; };      // düzgün disk (Soldier._shoot ile aynı dağılım)
for (const id of ['sniper', 'barrett']) {
  const st = WSTATS[id]; s.items[0] = { id, mag: st.mag, reserve: st.reserve }; s.cur = 0;
  s.vel.set(0, 0, 0); s.onGround = true; s.crouching = false; s.sinceShot = 5; s.bloom = 0; s.firedSprinting = false;
  const sp = (a) => { s.adsT = a; return s.spreadNow(st); };
  const scope = sp(1), hip = sp(0), q50 = sp(0.5), q80 = sp(0.8);
  console.log(`${id}: sapma (rad) dürbün ${scope.toExponential(2)} · %80 ${q80.toFixed(4)} · %50 ${q50.toFixed(4)} · bel ${hip.toFixed(4)}`);
  for (const d of [100, 200]) check(scope * d <= 0.03, `${id} dürbün ${d} m: ilk atış merkezden en çok ${(scope * d * 100).toFixed(1)} cm (kafa yarıçapı ≈ 12 cm)`);
  check(hip >= st.hip * 0.99, `${id} bel: ilk atış indirimi yok (${hip.toFixed(4)} = hip ${st.hip})`);
  const p15 = hitP(hip, 15, 0.22);
  check(p15 < 0.45, `${id} no-scope 15 m gövde (r 22 cm) isabet olasılığı %${(p15 * 100).toFixed(0)} (< %45)`);
  check(q50 > hip * 0.8, `${id} %50 nişanda (erken quickscope) sapma hâlâ bele yakın (${q50.toFixed(4)})`);
  const dmgAt = (d, zone) => { const [r0, r1] = st.range; const f = d <= r0 ? 1 : Math.max(st.minMul, 1 - ((1 - st.minMul) * (d - r0)) / (r1 - r0)); return st.dmg * f * (zone === 'head' ? TUNE.headMul : zone === 'legs' ? TUNE.legMul : 1); };
  const far = (zone, hp) => { let d = 0; while (d < 600 && dmgAt(d, zone) >= hp) d += 1; return d >= 600 ? '∞' : d === 0 ? 'yok' : d - 1 + ' m'; };
  console.log(`  tek atış (can 100): kafa ${far('head', 100)} · gövde ${far('body', 100)} · bacak ${far('legs', 100)} · gövde (Ağır Destek 125) ${far('body', 125)}`);
  check(far('head', 125) === '∞', `${id} kafa her mesafede tek atış`);
}
for (const id of ['sniper', 'barrett']) {
  s.items[0] = { id, mag: 5, reserve: 5 }; s.cur = 0; s.adsT = 0; s.ads = true; s.reloadT = 0; s.switchT = 0; s.sprinting = false;
  let t = 0; while (s.adsT < 1 && t < 2) { s.update(1 / 120); t += 1 / 120; }
  check(Math.abs(t - WSTATS[id].adsTime) < 0.02, `${id} dürbüne geçiş ${t.toFixed(3)} sn (adsTime ${WSTATS[id].adsTime})`);
}
console.log(fail ? `\n${fail} HATA` : '\nHepsi geçti');
process.exit(fail ? 1 : 0);
