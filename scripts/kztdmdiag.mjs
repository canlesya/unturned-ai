// 12.219 Kuzey TDM tanı: node scripts/kztdmdiag.mjs [NvN=16] [saniye=300] — 30 sn'de bir takım başına: canlı, araçta, mangal bölgesine uzaklık (medyan), bölgede, hedefli; öldürme
import { Game } from '../src/game/game.js';
const per = +(process.argv[2] || 16), secs = +(process.argv[3] || 300), type = process.env.TYPE || 'tdm';
const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type } });
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : NaN);
let kills = 0; const ok0 = g.onKill.bind(g), KP = [];
const SPN = new Map(), SPS = { n: 0, fwd: 0, sq: 0, base: 0, kill: 0, bad: 0 }, rs0 = g.respawn.bind(g);
g.respawn = (s, first) => { rs0(s, first); if (first) return; SPS.n++; const hb = g.map.spawns[s.team][0], d = Math.hypot(s.pos.x - hb.x, s.pos.z - hb.z); const k = s.veh ? 'veh' : d < 120 ? 'base' : 'fwd'; SPS[k] = (SPS[k] || 0) + 1; SPN.set(s, { t: g.time, x: s.pos.x, z: s.pos.z });
  const T = g.map.terrain, wy = T?.waterY ? T.waterY(s.pos.x, s.pos.z) : -1e9; if (!s.veh && (!g.nav.isFree(s.pos.x, s.pos.z) || (wy > -1e9 && wy > s.pos.y - 0.1))) SPS.bad++; };
g.onKill = (k, v, w, hs) => { if (k && k !== v) { kills++; KP.push([Math.round(v.pos.x), Math.round(v.pos.z), k.veh ? 1 : 0]); const r = SPN.get(v); if (r && g.time - r.t < 6 && Math.hypot(k.pos.x - r.x, k.pos.z - r.z) < 25) SPS.kill++; } return ok0(k, v, w, hs); };
for (let st = 0; st < secs * 30 && !g.ended; st++) {
  g.step(1 / 30);
  if (st % 900 === 899) {
    const row = [`t=${Math.round(g.time)}`, `öld ${kills}`, `bölge ${(g._tdmPlan?.act || []).map((o) => o.id).join('')}`];
    for (const tm of ['blue', 'red']) {
      const S = g.soldiers.filter((s) => s.team === tm && s.alive), D = [];
      let inV = 0, at = 0, tg = 0, drv = 0;
      for (const s of S) { if (s.veh) { inV++; if (s.seat === 0) drv++; } const o = g.squadGoal(s); if (o) { const d = Math.hypot(o.x - s.pos.x, o.z - s.pos.z); D.push(d); if (d < o.r + 60) at++; } if (s.brain?.target) tg++; }
      row.push(`${tm[0]}: ${S.length} araç ${inV}/${drv}sür bölgeye ${Math.round(med(D))}m bölgede ${at} hedefli ${tg}`);
    }
    console.log(row.join(' · '));
  }
}
if (process.env.KP) (await import('node:fs')).writeFileSync(process.env.KP, JSON.stringify(KP));
console.log('doğuş', JSON.stringify(SPS), `doğuş öldürmesi (≤ 6 sn, ≤ 25 m) %${(100 * SPS.kill / Math.max(1, kills)).toFixed(1)}`);
console.log('toplam öldürme', kills, 'skor', JSON.stringify(g.tickets), 'bigStats', JSON.stringify(g.bigStats || {}), 'vb', JSON.stringify(g.vbStats || {}));
