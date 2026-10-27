// Yakın dövüş vuruş kontrolü (ağsız, doğrudan Game): 1,5 m'deki donmuş hedefe önden hızlı (sol tık) / ağır (sağ tık) vuruş hasarı, arkadan tek vuruş (TUNE.backstab),
// vuruş anı = animasyonun vuruş karesi (swingHitK: hızlı SWING_HIT_K, ağır HEAVY_HIT_K), kombo sırası (sağ→sol, sol→sağ), sağ tık girdisi (meleeInput + s.ads), CS2 sırttan konisi.
//   node scripts/meleehit.mjs      (birinci şahıs el modeli değişse de oyun zamanlaması aynı kalmalı)
import { Game } from '../src/game/game.js';
import { WSTATS } from '../src/game/stats.js';
import { swingHitK } from '../src/game/anim.js';

let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const g = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', match: { perTeam: 2, type: 'tdm', tickets: 500 } });
const A = g.claimSlot('blue', 'Ali'), B = g.claimSlot('red', 'Veli');
g.brains.length = 0;
const DT = 1 / 60, step = (n = 1) => { for (let i = 0; i < n; i++) g.step(DT); };
function place(d = 1.5) {
  for (let k = 0; k < 4000; k++) {
    const x = -50 + Math.random() * 100, z = -50 + Math.random() * 100;
    if (!g.nav.isFree(x, z) || !g.nav.isFree(x, z - d) || !g.nav.isFree(x, z - d - 1)) continue;
    A.pos.set(x, g.world.heightAt(x, z), z); B.pos.set(x, g.world.heightAt(x, z - d), z - d);
    if (Math.abs(A.pos.y - B.pos.y) > 0.05 || !g.world.clear(A.eye(), B.eye())) continue;
    A.vel.set(0, 0, 0); B.vel.set(0, 0, 0); A.yaw = 0; A.pitch = -0.12; return true;     // A −Z'ye (B'ye) bakar
  }
  return false;
}
const reset = () => { for (const s of [A, B]) { s.alive = true; s.hp = s.maxHp; s.protT = 0; s.swing = null; s.cd = 0; s.ads = false; } };
step(130);
for (const id of ['knife', 'machete', 'tomahawk']) {
  const st = WSTATS[id];
  for (const hv of [false, true]) for (const back of [false, true]) {
    reset();
    check(place(), `${id}: hedef 1,5 m önde`);
    B.yaw = back ? 0 : Math.PI;                                   // arkadan: B de −Z'ye bakar (sırtı A'ya dönük)
    A.items[3] = { id, mag: 1, reserve: 0 }; A.cur = 3; A.switchT = 0; A.comboT = 0;
    const hp0 = B.hp;
    if (hv) { A.ads = true; check(A.meleeInput(false, 0) && A.swing?.hv, `${id}: sağ tık (s.ads) → ağır vuruş '${A.swing?.kind}'`); A.ads = false; }
    else check(A.meleeInput(true, 0) && !A.swing.hv, `${id}: sol tık → hızlı '${A.swing?.kind}'`);
    const kind = A.swing.kind, dur = A.swing.dur, hk = swingHitK(A.swing);
    let hitT = -1;
    for (let i = 0; i < 90 && A.swing; i++) { A.yaw = 0; A.pos.y = B.pos.y; step(1); if (hitT < 0 && B.hp < hp0) hitT = (i + 1) * DT; }
    const dmg = hp0 - Math.max(0, B.hp), want = st.dmg * (hv ? st.heavyMul : 1);
    const tag = `${id} ${hv ? 'ağır' : 'hızlı'} '${kind}'`;
    if (back) check(!B.alive || B.hp <= 0, `${tag}: arkadan tek vuruş → öldü (hasar ≥ ${dmg.toFixed(0)})`);
    else check(Math.abs(dmg - want) < 0.5, `${tag}: önden hasar ${dmg.toFixed(1)} (beklenen ${want.toFixed(1)})`);
    check(hitT > 0 && Math.abs(hitT - dur * hk) < 2.5 * DT, `${tag}: vuruş anı ${hitT.toFixed(3)} sn ≈ ${(dur * hk).toFixed(3)} (k ${hk})`);
  }
  // kombo: sağ→sol, sol→sağ, sağ→sol (CS2 dönüşümlü); ağır vuruş komboyu sıfırlar
  reset(); place(8); A.items[3] = { id, mag: 1, reserve: 0 }; A.cur = 3; A.comboT = 0;
  const seq = [];
  for (let n = 0; n < 3; n++) { A.cd = 0; A.meleeInput(true, 0); seq.push(A.swing.kind); step(Math.ceil(A.swing.dur * 0.82 / DT)); }
  check(seq.join(',') === 'rl,lr,rl', `${id}: kombo sırası ${seq.join(' → ')}`);
  A.cd = 0; A.ads = true; A.meleeInput(false, 0); A.ads = false; step(Math.ceil(A.swing.dur / DT) + 1); A.cd = 0; A.meleeInput(true, 0);
  check(A.swing.kind === 'rl', `${id}: ağır vuruştan sonra kombo baştan ('${A.swing.kind}')`);
}
// sırttan konisi (CS2 cos⁻¹ 0,475 ≈ 61,6°): 55° yandan arkadan sayılır, 65° sayılmaz
{
  reset(); place(); B.yaw = 0;
  const yawAt = (deg) => { B.yaw = deg * Math.PI / 180; return A.isBehind(B); };
  check(yawAt(55) && yawAt(-55) && !yawAt(65) && !yawAt(-65), 'sırttan konisi ±61,6° (55° evet, 65° hayır)');
}
// pençe (zombi değil, ham eşya): sağ tık ağır vuruş yok, kombo 3. vuruş saplama
{
  reset(); place(); A.items[3] = { id: 'claws', mag: 1, reserve: 0 }; A.cur = 3; A.comboT = 0;
  A.ads = true; check(!A.meleeInput(false, 0), 'pençe: sağ tık ağır vuruş yok'); A.ads = false;
}
console.log(fail ? `${fail} HATA` : 'hepsi geçti');
process.exit(fail ? 1 : 0);
