// Vadi bot maçları (12.169; başsız): desteklenen modlarda kısa maçlar → hata, öldürme, takılma (5 sn'de 0,5 m'den az ilerleyen, hedefi olan,
// düşman görmeyen, YOLU OLAN bot — rol gereği bekleyen sayılmaz), yeraltı / derin su, bayrak değişimi; en çok takılan yerler. Eski / yeni harita karşılaştırması için aynı ölçüt.
//   node scripts/vadibots.mjs [maç başına sn=180] [tekrar=2]   (MODES=conquest,tdm,dm,gg)
import { MapBuilder } from '../src/maps/builder.js';
import { Game } from '../src/game/game.js';
import { DEEP_WATER } from '../src/maps/terrain.js';
MapBuilder.noVisual = true;
const SEC = +(process.argv[2] || 180), REP = +(process.argv[3] || 2);
const MODES = (process.env.MODES || 'conquest,tdm,dm,gg').split(',');
const SIZE = { conquest: 8, tdm: 8, dm: 12, gg: 10 };
const STK = new Map(), DEEP = new Map(), tot = { stuck: 0, samples: 0, under: 0, deep: 0, err: 0, kills: 0, flags: 0, matches: 0 };
const t0 = performance.now();
for (const type of MODES) for (let r = 0; r < REP; r++) {
  let g;
  try { g = new Game(null, { headless: true, map: 'vadi', diff: 'normal', match: { perTeam: SIZE[type], type } }); } catch (e) { tot.err++; console.log('KURULUM HATASI', type, e.stack); continue; }
  const T = g.map.terrain, last = new Map();
  let flags = 0; g.on('flag', () => flags++);
  let st = { stuck: 0, samples: 0, under: 0, deep: 0 }, steps = 0, err = 0;
  try {
    while (!g.ended && steps < SEC * 30) {
      g.step(1 / 30); steps++;
      if (steps % 150 !== 0) continue;                                  // 5 sn'de bir
      for (const b of g.brains) {
        const s = b.s; if (!s.alive) { last.delete(s); continue; }
        const gh = T.heightAt(s.pos.x, s.pos.z);
        if (s.pos.y < gh - 0.5) st.under++;
        if (gh < DEEP_WATER && !s.onCollider) { st.deep++; const k = `${Math.round(s.pos.x / 4) * 4},${Math.round(s.pos.z / 4) * 4}`; DEEP.set(k, (DEEP.get(k) || 0) + 1); }
        const L = last.get(s);
        if (L && b.goal && b.path && b.path.length && !b.target && Math.hypot(b.goal.x - s.pos.x, b.goal.z - s.pos.z) > 3) {        // yolu olan (yürümeye çalışan) bot; rol gereği bekleyen sayılmaz
          st.samples++;
          if (Math.hypot(L.x - s.pos.x, L.z - s.pos.z) < 0.5) {
            st.stuck++; const k = `${Math.round(s.pos.x / 4) * 4},${Math.round(s.pos.z / 4) * 4}`; STK.set(k, (STK.get(k) || 0) + 1);
            L.n = (L.n || 0) + 1;
            if (L.n === 3 && process.env.WHY) {                              // aynı yerde 15 sn: ayrıntı
              const near = g.map.colliders.filter((c) => s.pos.x + 1 > c.min[0] && s.pos.x - 1 < c.max[0] && s.pos.z + 1 > c.min[2] && s.pos.z - 1 < c.max[2] && s.pos.y + 2 > c.min[1] && s.pos.y - 0.5 < c.max[1]).map((c) => c.oid);
              console.log(`   TAKILDI ${type} ${s.name} @${s.pos.x.toFixed(1)},${s.pos.y.toFixed(1)},${s.pos.z.toFixed(1)} zemin ${gh.toFixed(2)} eğim ${T.slopeAt(s.pos.x, s.pos.z, 0.6).toFixed(2)} ızgara ${g.nav.isFree(s.pos.x, s.pos.z) ? 'açık' : 'KAPALI'} hedef ${b.goal.x.toFixed(0)},${b.goal.z.toFixed(0)} yol ${b.path ? b.path.length : '-'} yakın ${[...new Set(near)].slice(0, 5).join(' ')}`);
            }
            last.set(s, L); continue;
          }
        }
        last.set(s, { x: s.pos.x, z: s.pos.z });
      }
    }
  } catch (e) { err++; console.log('HATA', type, e.stack); }
  const kills = g.soldiers.reduce((a, s) => a + s.kills, 0);
  tot.stuck += st.stuck; tot.samples += st.samples; tot.under += st.under; tot.deep += st.deep; tot.err += err; tot.kills += kills; tot.flags += flags; tot.matches++;
  console.log(`${type} #${r + 1}: ${(steps / 30).toFixed(0)} sn · öldürme ${kills} · bayrak ${flags} · takılma %${(st.stuck / Math.max(1, st.samples) * 100).toFixed(2)} (${st.stuck}/${st.samples}) · yeraltı ${st.under} · derin su ${st.deep} · hata ${err}${g.ended ? ' · bitti ' + g.winner : ''}`);
}
console.log(`\nÖZET ${tot.matches} maç · öldürme ${tot.kills} · bayrak ${tot.flags} · takılma %${(tot.stuck / Math.max(1, tot.samples) * 100).toFixed(2)} · yeraltı ${tot.under} · derin su ${tot.deep} · hata ${tot.err} · ${((performance.now() - t0) / 1000).toFixed(0)} sn`);
console.log('derin su yerleri:', [...DEEP].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}×${v}`).join(' | ') || '-');
console.log('takılma yerleri:', [...STK].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}×${v}`).join(' | ') || '-');
