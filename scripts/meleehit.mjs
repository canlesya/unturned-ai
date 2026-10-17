// Yakın dövüş vuruş kontrolü (ağsız, doğrudan Game): 1,5 m'deki donmuş hedefe önden savurma / saplama hasarı, arkadan tek vuruş (999).
//   node scripts/meleehit.mjs      (birinci şahıs el modeli değişse de oyun zamanlaması aynı kalmalı)
import { Game } from '../src/game/game.js';
import { WSTATS } from '../src/game/stats.js';
import { SWING_HIT_K } from '../src/game/anim.js';
import * as THREE from 'three';

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
step(130);
for (const id of ['knife', 'machete', 'tomahawk']) {
  const st = WSTATS[id];
  for (const back of [false, true]) {
    for (const s of [A, B]) { s.alive = true; s.hp = s.maxHp; s.protT = 0; s.swing = null; s.cd = 0; }
    check(place(), `${id}: hedef 1,5 m önde`);
    B.yaw = back ? 0 : Math.PI;                                   // arkadan: B de −Z'ye bakar (sırtı A'ya dönük)
    A.items[3] = { id, mag: 1, reserve: 0 }; A.cur = 3; A.switchT = 0; A.comboT = 0;
    const hp0 = B.hp;
    A._melee(st);
    const kind = A.swing.kind, dur = A.swing.dur;
    let hitT = -1;
    for (let i = 0; i < 80 && A.swing; i++) { A.yaw = 0; A.pos.y = B.pos.y; step(1); if (hitT < 0 && B.hp < hp0) hitT = (i + 1) * DT; }
    const dmg = hp0 - Math.max(0, B.hp);
    if (back) check(!B.alive || B.hp <= 0, `${id}: arkadan tek vuruş (999) → öldü (hasar ≥ ${dmg.toFixed(0)})`);
    else check(Math.abs(dmg - st.dmg * (kind === 'stab' ? st.stabMul : 1)) < 0.5, `${id}: önden '${kind}' hasarı ${dmg.toFixed(1)} (beklenen ${st.dmg})`);
    check(hitT > 0 && Math.abs(hitT - dur * SWING_HIT_K) < 2.5 * DT, `${id}: vuruş anı ${hitT.toFixed(3)} sn ≈ ${(dur * SWING_HIT_K).toFixed(3)} (SWING_HIT_K)`);
  }
}
// saplama: kombonun 3. vuruşu (bıçak)
{
  for (const s of [A, B]) { s.alive = true; s.hp = s.maxHp; s.protT = 0; s.swing = null; }
  place(); B.yaw = Math.PI; A.items[3] = { id: 'knife', mag: 1, reserve: 0 }; A.cur = 3; A.comboN = 1; A.comboT = 1; const hp0 = B.hp;
  A._melee(WSTATS.knife); const kind = A.swing.kind;
  for (let i = 0; i < 80 && A.swing; i++) { A.yaw = 0; step(1); }
  check(kind === 'stab' && Math.abs(hp0 - B.hp - WSTATS.knife.dmg * WSTATS.knife.stabMul) < 0.5, `bıçak saplama ('${kind}') hasarı ${(hp0 - B.hp).toFixed(1)}`);
}
console.log(fail ? `${fail} HATA` : 'hepsi geçti');
process.exit(fail ? 1 : 0);
