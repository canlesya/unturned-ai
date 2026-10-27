// Kuzey Vadisi oynanış taraması (12.184) — tarayıcısız Game (headless) üstünde:
//   node scripts/kuzeyqa2.mjs [saniye=240]
//  S  ileri doğuş: her bayrak için 300 doğuş → bayrak kotundan (o.y) sapma, ele geçirme alanı dışı, katı içinde, suda
//  K  ele geçirme: bayrak direğinin yanında (o.y kotunda) duran tek asker bayrağı alabiliyor mu
//  B  üs doğuşları: katı içinde / suda
//  M  bot takılması: N sn maç, 20 sn'de 1,5 m'den az yer değiştiren canlı bot (yüzmeyen, araçsız) → konum kümeleri
import { Game } from '../src/game/game.js';
const secs = +(process.argv[2] || 240);
const game = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 16, type: 'conquest' } });
const W = game.world, T = game.map.terrain, objs = game.mode.objectives;
const hitAt = (x, y, z) => W._hits(W.query(x - 1, z - 1, x + 1, z + 1, []), x, y + 0.2, z, 1.5);
const s0 = game.soldiers.find((s) => s.team === 'blue' && !s.isPlayer) || game.soldiers[0];
// S
let issues = 0;
for (const o of objs) {
  for (const q of objs) q.owner = null;
  o.owner = 'blue';
  for (const e of game.soldiers) { e.alive = false; }
  let n = 0, off = 0, out = 0, solid = 0, wet = 0, fwd = 0; const ex = [];
  for (let k = 0; k < 300; k++) {
    const p = game.pickSpawn('blue', s0);
    if (!p.forward) continue; fwd++;
    s0.spawn(p, 0); W.settle(s0); s0.alive = false;
    const y = s0.pos.y; n++;
    if (Math.abs(y - o.y) > 3) { off++; if (ex.length < 4) ex.push(`(${p.x.toFixed(0)},${y.toFixed(1)},${p.z.toFixed(0)})`); }
    if (Math.hypot(p.x - o.x, p.z - o.z) > o.r) out++;
    if (hitAt(s0.pos.x, s0.pos.y, s0.pos.z)) solid++;
    if (T.waterY(s0.pos.x, s0.pos.z) > s0.pos.y + 0.5) wet++;
  }
  const bad = off + out + solid + wet; issues += bad;
  console.log(`S ${o.id} ${o.name.padEnd(14)} y=${o.y.toFixed(1)} ileri ${fwd}/300 · kot sapması ${off} ${ex.join(' ')} · alan dışı ${out} · katı ${solid} · su ${wet}`);
}
// K
{
  const saved = game.soldiers.map((s) => [s, s.alive, s.pos.clone()]);
  for (const o of objs) {
    for (const e of game.soldiers) e.alive = false;
    for (const q of objs) { q.owner = null; q.p = 0; }
    s0.alive = true; s0.pos.set(o.x + 2, o.y, o.z + 1);
    game.capT = 0;
    for (let i = 0; i < 300; i++) { game.capT = 0; game.updateMode(0.1); }

    const ok = o.p > 0.05;
    if (!ok) issues++;
    console.log(`K ${o.id} direk yanında tek asker (y ${o.y.toFixed(1)}): ${ok ? 'alıyor' : 'ALAMIYOR'} (p ${o.p.toFixed(2)})`);
  }
  for (const [s, a, p] of saved) { s.alive = a; s.pos.copy(p); }
  for (const q of objs) { q.owner = null; q.p = 0; }
}
// B
for (const team of ['blue', 'red']) {
  let solid = 0;
  for (const p of game.map.spawns[team]) { const y = T.heightAt(p.x, p.z); if (hitAt(p.x, y, p.z)) solid++; }
  if (solid) issues += solid;
  console.log(`B ${team} üs doğuşu ${game.map.spawns[team].length} · katı içinde ${solid}`);
}
// M
{
  const g2 = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 16, type: 'conquest' } });
  const hist = new Map(), stuck = new Map(), inZ = {}, below = {}; let steps = 0;
  const inObj = (p, o) => (g2.inObjective ? g2.inObjective(p, o) : Math.hypot(p.x - o.x, p.z - o.z) < o.r);
  const dt = 1 / 30;
  for (; steps < secs * 30 && !g2.ended; steps++) {
    g2.step(dt);
    if (steps % 30) continue;
    const t = steps / 30;
    for (const s of g2.soldiers) {
      if (s.isPlayer) continue;
      if (s.alive) for (const o of g2.mode.objectives) if (Math.hypot(s.pos.x - o.x, s.pos.z - o.z) < o.r) { if (inObj(s.pos, o)) (inZ[o.id] ||= new Set()).add(s.id); else (below[o.id] ||= new Set()).add(s.id); }
      if (!s.alive || s.vehicle || s.swim) { hist.delete(s); continue; }
      let h = hist.get(s); if (!h) hist.set(s, (h = []));
      h.push([t, s.pos.x, s.pos.z]); if (h.length > 21) h.shift();
      if (h.length === 21) {
        const xs = h.map((q) => q[1]), zs = h.map((q) => q[2]);
        const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
        const inFlag = g2.mode.objectives.some((o) => Math.hypot(s.pos.x - o.x, s.pos.z - o.z) < o.r);
        if (span < 1.5 && !inFlag && !(s.brain?.target) && !s.brain?.perching && !s.brain?.spot && s.brain?.goal) {
          const k = `${Math.round(s.pos.x / 4) * 4},${Math.round(s.pos.z / 4) * 4}`;
          stuck.set(k, (stuck.get(k) || 0) + 1); h.length = 0;
        }
      }
    }
  }
  const list = [...stuck].sort((a, b) => b[1] - a[1]);
  console.log(`M ${secs} sn: takılan bot olayı ${list.reduce((a, b) => a + b[1], 0)} · yer ${list.length}: ${list.slice(0, 25).map(([k, n]) => k + '×' + n).join(' ')}`);
  console.log('  alana giren bot (kotunda / kot dışı): ' + g2.mode.objectives.map((o) => `${o.id} ${inZ[o.id]?.size || 0}/${below[o.id]?.size || 0}`).join(' · '));
  console.log('  hedefler: ' + g2.mode.objectives.map((o) => `${o.id}:${o.owner || '-'}`).join(' '));
}
console.log(`TOPLAM S/K/B sorunu ${issues}`);
process.exit(0);
