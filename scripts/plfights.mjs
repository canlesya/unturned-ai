// Vagon modu: çatışmalar vagonun etrafında mı?  node scripts/plfights.mjs [maç=10] [kişi=5]   (MADEN=…/eski-maden.js ile eski harita)
// Başsız bot maçlarında her öldürmenin yeri kaydedilir: vagona uzaklık, rayın aktif bölümüne (vagon → sıradaki kontrol) uzaklık, aşama.
// Not: bot kararları (bot.js / payload.botGoal) haritadan bağımsızdır; bu ölçüm harita değişikliğinin etkisini aynı bot koduyla karşılaştırır.
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { Game } from '../src/game/game.js';
import { MAPS } from '../src/maps/index.js';

if (process.env.MADEN) { const { buildMaden } = await import(process.env.MADEN); MAPS.maden.build = buildMaden; }
const N = +(process.argv[2] || 10), per = +(process.argv[3] || 5);
const all = [], res = [];
let stuckMax = 0, stuckAt = '';
const stuckList = [];
for (let r = 0; r < N; r++) {
  const g = new Game(null, { headless: true, map: 'maden', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type: 'payload' } });
  const pl = g.payload, orig = g.onKill.bind(g);
  g.onKill = (killer, victim, w, hs) => {
    const p = victim.pos, c = pl.p, nextD = pl.reached < pl.cps.length ? pl.cps[pl.reached] : pl.end;
    let seg = 1e9; const q = {};
    for (let d = pl.d; d <= nextD + 0.01; d += 0.5) { pl.track.at(d, q); seg = Math.min(seg, Math.hypot(p.x - q.x, p.z - q.z)); }
    all.push({ cart: Math.hypot(p.x - c.x, p.z - c.z), seg, stage: pl.reached, x: p.x, z: p.z });
    return orig(killer, victim, w, hs);
  };
  const last = new Map(), still = new Map();
  for (let i = 0; i < 30 * 1500 && !g.ended; i++) {
    g.step(1 / 30);
    if (i % 30 === 0) for (const s of g.soldiers) {
      if (!s.alive) { still.delete(s); continue; }
      const p = last.get(s);
      if (p && Math.hypot(p.x - s.pos.x, p.z - s.pos.z) < 0.15 && !s.brain?.target && !s.brain?.perching && pl.distTo(s) > 4) { still.set(s, (still.get(s) || 0) + 1); if (still.get(s) === 20) stuckList.push(`${s.team} (${s.pos.x.toFixed(1)}, ${s.pos.z.toFixed(1)}) a${pl.reached + 1}`);
        if (still.get(s) > stuckMax) { stuckMax = still.get(s); stuckAt = `${s.team} (${s.pos.x.toFixed(1)}, ${s.pos.y.toFixed(1)}, ${s.pos.z.toFixed(1)}) aşama ${pl.reached + 1}`; } } else still.set(s, 0);
      last.set(s, s.pos.clone());
    }
  }
  res.push({ w: g.winner, prog: Math.round(pl.progress * 100), cp: pl.reached, t: Math.round(g.time) });
}
const pct = (f) => Math.round(all.filter(f).length / Math.max(1, all.length) * 100);
const med = (k) => { const a = all.map((o) => o[k]).sort((p, q) => p - q); return a[a.length >> 1]?.toFixed(1); };
console.log(`${N} maç ${per}v${per}: ${res.map((o) => `${o.w}/${o.prog}%/${o.cp}cp/${o.t}s`).join(' · ')}`);
console.log(`öldürme ${all.length} · vagona ortanca ${med('cart')} m · vagona ≤ 10 m %${pct((o) => o.cart <= 10)} · ≤ 20 m %${pct((o) => o.cart <= 20)} · > 30 m %${pct((o) => o.cart > 30)}`);
console.log(`aktif ray bölümüne ortanca ${med('seg')} m · ≤ 8 m %${pct((o) => o.seg <= 8)} · > 20 m %${pct((o) => o.seg > 20)}`);
for (let st = 0; st < 3; st++) { const a = all.filter((o) => o.stage === st); if (a.length) console.log(`  aşama ${st + 1}: ${a.length} öldürme, vagona ortanca ${a.map((o) => o.cart).sort((p, q) => p - q)[a.length >> 1].toFixed(1)} m, > 30 m %${Math.round(a.filter((o) => o.cart > 30).length / a.length * 100)}`); }
console.log(`mavi kazanma ${res.filter((o) => o.w === 'blue').length}/${N} · ortalama ilerleme %${Math.round(res.reduce((a, o) => a + o.prog, 0) / N)} · vagondan uzakta en uzun takılma ${stuckMax} sn ${stuckAt}`);
if (stuckList.length) console.log(`20 sn+ hareketsiz (hedefsiz, vagondan > 4 m): ${stuckList.length} kez · ${stuckList.slice(0, 12).join(' · ')}`);
if (process.env.JSON) (await import('fs')).writeFileSync(process.env.JSON, JSON.stringify(all));
