// Kuzey Vadisi (12.172) oyun temposu (başsız, botlar): node scripts/kuzeytempo.mjs [NvN=16] [saniye=600] [tekrar=1]
// Ölçüt: öldürme / dk (dakika dakika), bayrak değişimi (bayrak başına), her bayrağı hiç alan takım, ilk ele geçirme süresi, öldürmenin en yakın bayrağa
// uzaklığı, ileri doğuş payı, savaş alanı dışı ölüm, takılan bot (30 sn'de 3 m'den az yer değiştiren canlı bot, mevzi hariç), adım süresi.
import { Game } from '../src/game/game.js';
const per = +(process.argv[2] || 16), secs = +(process.argv[3] || 600), reps = +(process.argv[4] || 1);
const all = [];
for (let r = 0; r < reps; r++) {
  const t0 = performance.now();
  const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type: 'conquest', time: secs + 60 } });
  const tB = performance.now() - t0;
  const flags = {}, firstCap = {}, ever = {}, kills = [], kmin = new Array(Math.ceil(secs / 60)).fill(0);
  let fwd = 0, base = 0, oob = 0;
  for (const o of g.mode.objectives) { flags[o.id] = 0; ever[o.id] = new Set(); }
  g.on('flag', ({ o }) => { flags[o.id]++; if (o.owner) { ever[o.id].add(o.owner); firstCap[o.id] ??= Math.round(g.time); } });
  for (const s of g.soldiers) {
    const die = s.die.bind(s);
    s.die = (k, w, h) => { if (s.alive) { if (w === 'Savaş alanı') oob++; else if (k && k !== s) { kills.push({ t: g.time, x: s.pos.x, z: s.pos.z }); kmin[Math.min(kmin.length - 1, Math.floor(g.time / 60))]++; } } return die(k, w, h); };
  }
  const ps = g.pickSpawn.bind(g); g.pickSpawn = (team, s) => { const p = ps(team, s); if (p?.forward) fwd++; else base++; return p; };
  const last = new Map(); let stuck = 0, samples = 0;
  const dt = 1 / 30, s0 = performance.now(); let steps = 0;
  for (; steps < secs * 30 && !g.ended; steps++) {
    g.step(dt);
    if (steps % 900 === 0) for (const b of g.brains) { const s = b.s; if (!s.alive) { last.delete(s); continue; } const p = last.get(s); if (p && !b.perching && Math.hypot(p[0] - s.pos.x, p[1] - s.pos.z) < 3) stuck++; samples++; last.set(s, [s.pos.x, s.pos.z]); }
  }
  const ms = (performance.now() - s0) / steps;
  const near = kills.map((k) => Math.min(...g.mode.objectives.map((o) => Math.hypot(o.x - k.x, o.z - k.z)))).sort((a, b) => a - b);
  const res = {
    per, secs: Math.round(steps * dt), buildMs: Math.round(tB), stepMs: +ms.toFixed(2), kills: kills.length, killsPerMin: +(kills.length / (steps * dt / 60)).toFixed(1), kmin,
    flagChanges: Object.values(flags).reduce((a, b) => a + b, 0), flags, firstCap, ever: Object.fromEntries(Object.entries(ever).map(([k, v]) => [k, [...v].join('+') || '-'])),
    killNearFlagMed: Math.round(near[near.length >> 1] || 0), killWithin60: +(near.filter((d) => d < 60).length / Math.max(1, near.length)).toFixed(2),
    fwdShare: +(fwd / Math.max(1, fwd + base)).toFixed(2), oobDeaths: oob, stuckShare: +(stuck / Math.max(1, samples)).toFixed(3), tickets: [Math.round(g.tickets.blue), Math.round(g.tickets.red)], owners: g.mode.objectives.map((o) => o.id + ':' + (o.owner || '-')).join(' '),
  };
  all.push(res);
  console.log(JSON.stringify(res));
}
