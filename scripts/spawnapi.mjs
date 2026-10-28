// 12.203 Doğuş noktası API denetimi (başsız): map.spawnPoints(team, near) her takım haritasında, her bayrak + üs + ön hat için.
// Her nokta: yol ızgarasında açık, zemin kotunda (platform / çatı değil; Baraj gibi kotlu bayrakta bayrak kotu), üstü açık (bina / sundurma içi değil),
// gövde hiçbir kutuya girmiyor, suda değil, noktalar arası ≥ 3 m. Nokta sayısı oyuncu sayısıyla artar (Kuzey 32 / 64 / 128).
//   node scripts/spawnapi.mjs [haritalar=kuzey,colgecidi,kasaba,us,vadi,depo,liman]
import { Game } from '../src/game/game.js';
import { LIMITS } from '../src/game/balance.js';
LIMITS.maxPerTeam = Math.max(LIMITS.maxPerTeam, 32);
const maps = (process.argv[2] || 'kuzey,colgecidi,kasaba,us,vadi,depo,liman').split(',');
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'HATA ') + m); if (!c) fails++; };
for (const map of maps) {
  const sizes = map === 'kuzey' ? [32, 64, 128] : [16];
  for (const per of sizes) {
    const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type: 'conquest', time: 900 } });
    const W = g.world, objs = g.mode.objectives, bad = [];
    const check = (p, what, oy) => {
      if (!g.nav.isFree(p.x, p.z)) bad.push([what, 'nav', p.x, p.z]);
      const gy = W.groundAt(p.x, p.z), hy = W.heightAt(p.x, p.z);
      if (oy == null && gy - hy > 2.5 && p.y == null) bad.push([what, 'kot', p.x, p.z, +gy.toFixed(1), +hy.toFixed(1)]);
      const L = W.query(p.x - 0.8, p.z - 0.8, p.x + 0.8, p.z + 0.8, []), y = p.y ?? gy;
      if (W._hits(L, p.x, y + 0.05, p.z, 1.7)) bad.push([what, 'kutu', p.x, p.z]);
      if (L.some((c) => c.tag !== 'veh' && p.x > c.min[0] - 0.3 && p.x < c.max[0] + 0.3 && p.z > c.min[2] - 0.3 && p.z < c.max[2] + 0.3 && c.min[1] > y + 1.6 && c.min[1] < y + 14)) bad.push([what, 'çatı', p.x, p.z]);
      const wy = W.terrain?.waterY?.(p.x, p.z); if (wy > -1e9 && wy > y - 0.1) bad.push([what, 'su', p.x, p.z]);
    };
    const count = {};
    for (const team of ['blue', 'red']) {
      const base = g.map.spawnPoints(team, 'base');
      count[team + ':üs'] = base.length;
      if (map === 'kuzey') for (const p of base) check(p, team + ':üs');
      for (const o of objs) {
        o.owner = team;
        const P = g.map.spawnPoints(team, o.id);
        count[team + ':' + o.id] = P.length;
        for (const p of P) check(p, team + ':' + o.id, Number.isFinite(o.y) ? o.y : null);
        let close = 0; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (Math.hypot(P[i].x - P[j].x, P[i].z - P[j].z) < 3) close++;
        if (close) bad.push([team + ':' + o.id, 'yakın', close]);
        if (!P.every((p) => ['flag', 'rear'].includes(p.kind) && Number.isFinite(p.ry))) bad.push([team + ':' + o.id, 'biçim']);
      }
      const near = g.map.spawnPoints(team, { x: objs[0]?.x ?? 0, z: objs[0]?.z ?? 0 });
      if (objs.length && near[0]?.of !== objs[0].id) bad.push([team, 'yakın-nokta', near[0]?.of]);
      if (g.map.big) { const f = g.map.spawnPoints(team, 'front'); if (!f.length) bad.push([team, 'ön hat boş']); }
      for (const o of objs) o.owner = null;
    }
    const flagN = objs.map((o) => count['blue:' + o.id]);
    ok(!bad.length, `${map} ${per}v${per}: üs ${count['blue:üs']}/${count['red:üs']}, bayrak başına ${Math.min(...flagN)}–${Math.max(...flagN)} nokta${bad.length ? ' · sorun ' + bad.length + ': ' + JSON.stringify(bad.slice(0, 6)) : ''}`);
    if (map === 'kuzey') ok(Math.min(...flagN) >= Math.min(16 + 12, Math.round(per * 0.4) + 12) * 0.6, `${map} ${per}v${per}: bayrak havuzu oyuncu sayısıyla büyüyor (en az ${Math.min(...flagN)})`);
  }
}
console.log(fails ? `sonuç: ${fails} HATA` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
