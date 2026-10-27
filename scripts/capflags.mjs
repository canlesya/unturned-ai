// 12.191 Tüm ele geçirme haritalarında her bayrak alınabiliyor mu (başsız, tarayıcı yok): alanın içinde yürünür noktalara tek asker konur → inObjective (HUD'un da
// kullandığı kural) doğru mu, 2 sn'de ilerleme capRate'in söylediği kadar artıyor mu (HUD "alıyor" deyip ilerleme 0 kalmasın), 1 vs 1 durur, 2 vs 1 ×1 hızda.
//   node scripts/capflags.mjs [harita,…]   (varsayılan: kasaba,vadi,us,colgecidi,depo,liman,kuzey + cephe etkin noktası)
import { Game } from '../src/game/game.js';
const maps = (process.argv[2] || 'kasaba,vadi,us,colgecidi,depo,liman,kuzey,cephe').split(',');
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
for (const map of maps) {
  const front = map === 'cephe';
  const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 8, type: front ? 'front' : 'conquest' } });
  g.brains.length = 0;
  const S = g.soldiers, b0 = S.find((s) => s.team === 'blue'), b1 = S.filter((s) => s.team === 'blue')[1], r0 = S.find((s) => s.team === 'red');
  const objs = front ? [g.front.active] : g.mode.objectives;
  if (front) g.front.lockT = 0;
  for (const o of objs) {
    for (const s of S) { s.alive = false; s.respawnT = 1e9; }
    const pts = [];
    for (let k = 0; k < 400 && pts.length < 12; k++) {
      const a = (k * 2.399) % 6.283, r = ((k * 0.618) % 1) * o.r * 0.9, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r;
      if (!g.nav.isFree(x, z)) continue;
      const y = g.world.groundAt(x, z); if (Math.abs(y - g.objY(o)) > 3) continue;
      pts.push({ x, y, z });
    }
    const put = (s, P) => { s.alive = true; s.hp = 100; s.pos.set(P.x, P.y + 0.05, P.z); s.vel.set(0, 0, 0); g.world.settle(s); };
    let inside = 0; for (const P of pts) { put(b0, P); if (g.inObjective(b0.pos, o)) inside++; }
    const L = `${map} ${o.label || o.id} (${o.name})`;
    check(pts.length >= 4 && inside === pts.length, `${L}: alandaki yürünür noktalar alan sayılıyor ${inside}/${pts.length}`);
    if (!pts.length) continue;
    const run = (sec) => { for (let i = 0; i < sec * 30; i++) g.step(1 / 30); };
    put(b0, pts[0]); o.owner = null; o.p = 0; run(0.2);
    const rate = g.capRate(o), p0 = o.p; run(2); const dp = o.p - p0;
    check(rate > 0 && Math.abs(dp - rate * 2) < rate * 0.2, `${L}: tek asker ilerletir (hız ${rate.toFixed(3)}/sn, 2 sn'de ${dp.toFixed(3)}; HUD ~${Math.ceil((1 - o.p) / rate)} sn der)`);
    put(r0, pts[1 % pts.length]); run(0.2); const p1 = o.p; run(1.5);
    check(o.nb === 1 && o.nr === 1 && o.p === p1 && g.capRate(o) === 0, `${L}: 1 vs 1 çekişmeli, ilerleme durdu (${p1.toFixed(3)} → ${o.p.toFixed(3)})`);
    put(b1, pts[2 % pts.length]); run(0.2); const p2 = o.p; run(1);
    check(o.nb === 2 && o.nr === 1 && o.p > p2 && Math.abs(g.capRate(o) - rate) < 1e-9, `${L}: 2 vs 1 ×1 hızla ilerler`);
  }
}
console.log(fail ? `sonuç: ${fail} HATA` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
