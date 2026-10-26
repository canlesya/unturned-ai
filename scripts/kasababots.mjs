// Kasaba bot maçları: mod başına kısa başsız maçlar, öldürme / bayrak / gerçek takılma ölçümü (önce / sonra).
//   node scripts/kasababots.mjs [sn=150] [tekrar=2]
//   OLD=1 → eski (v2) harita: edc5a75 sürümündeki src/maps/kasaba.js ve kasabaSurface.js, src/maps/_kasaba_old.js ve _kasabaSurface_old.js
//   adlarıyla geçici kopyalanır (eski dosyada yüzey içe aktarması ./_kasabaSurface_old.js); yalnız karşılaştırma içindir, depoya girmez.
// Takılma (gerçek): bot canlı, hedefi yok (çatışmada değil), yolu var (yürümek istiyor), mevzide / pusuda değil, 1,2 sn'de < 0,35 m ilerlemiş.
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { MAPS } from '../src/maps/index.js';
import { Game } from '../src/game/game.js';
const SECS = +(process.argv[2] || 150), REPS = +(process.argv[3] || 2);
if (process.env.OLD) { const { buildKasaba } = await import('../src/maps/_kasaba_old.js'); MAPS.kasaba = { ...MAPS.kasaba, build: () => buildKasaba() }; }
const res = [];
const cells = new Map();
for (const [type, per] of [['conquest', 10], ['tdm', 8], ['dm', 10], ['gg', 8]]) {
  let kills = 0, flags = 0, stuck = 0, win = 0, botSec = 0, kd = [];
  for (let r = 0; r < REPS; r++) {
    const g = new Game(null, { headless: true, map: 'kasaba', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type, time: SECS } });
    const oKill = g.onKill.bind(g);
    g.onKill = (k, v, w, hs) => { if (k && k !== v) kd.push(Math.hypot(k.pos.x - v.pos.x, k.pos.z - v.pos.z)); kills++; return oKill(k, v, w, hs); };
    const last = new Map(), own = new Map();
    for (let st = 0; st < SECS * 30 && !g.ended; st++) {
      g.step(1 / 30);
      for (const o of g.mode.objectives || []) { if (own.has(o.id) && own.get(o.id) !== o.owner) flags++; own.set(o.id, o.owner); }
      if (st % 36 === 0) for (const s of g.soldiers) {
        const B = s.brain; if (!B) continue;
        const p = last.get(s);
        if (s.alive) botSec += 1.2;
        if (p && s.alive && p.alive && p.deaths === s.deaths && !B.target && B.path && B.path.length > 1 && !B.atSpot && !B.perching && Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < 0.35) {
          stuck++; const k = `${Math.round(s.pos.x / 2) * 2},${Math.round(s.pos.z / 2) * 2}`; cells.set(k, (cells.get(k) || 0) + 1);
          if (process.env.DBG && stuck < +process.env.DBG) console.log(`  takılma ${type} ${s.name} (${s.pos.x.toFixed(2)},${s.pos.y.toFixed(2)},${s.pos.z.toFixed(2)}) yol→ ${B.path.slice(0, 3).map((q) => q.x.toFixed(1) + ',' + q.z.toFixed(1)).join(' ')} hedef ${B.goal ? B.goal.x.toFixed(1) + ',' + B.goal.z.toFixed(1) : '-'} rol ${B.role || '-'}`);
        }
        last.set(s, { x: s.pos.x, z: s.pos.z, alive: s.alive, deaths: s.deaths });
      }
    }
  }
  kd.sort((a, b) => a - b);
  res.push({ type, per, kills: kills / REPS, flags: flags / REPS, stuckPerBotMin: +(stuck / (botSec / 60)).toFixed(3), stuck, medKill: kd.length ? +kd[kd.length >> 1].toFixed(1) : 0 });
}
console.log(`${process.env.OLD ? 'ESKİ' : 'YENİ'} Kasaba · ${SECS} sn × ${REPS}`);
for (const r of res) console.log(`  ${r.type.padEnd(9)} ${r.per}v${r.per}  öldürme/maç ${r.kills.toFixed(1)} (medyan ${r.medKill} m) · bayrak değişimi/maç ${r.flags.toFixed(1)} · gerçek takılma ${r.stuck} (${r.stuckPerBotMin} / bot·dk)`);
console.log('  en çok takılan hücreler (2 m):', [...cells].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k}×${n}`).join('  '));
