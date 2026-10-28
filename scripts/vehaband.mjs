// 12.212 terk edilen araç ölçümü (başsız): node scripts/vehaband.mjs [harita=kuzey] [NvN=10] [saniye=480] [tohum]
// Terk = canlı araçtan son kişi iner (araç boş kalır). Sonucu: bot biner / insan biner / boşta yenilenir (idle) / batar / patlar / maç biter (boş).
// Basılan: terk sayısı (doğuşa > 25 m), boşta ortalama süre, terk edilmiş araca binen bot, araç kullanım oranı (canlı araç-sn içinde sürücülü %).
import { Game } from '../src/game/game.js';
const map = process.argv[2] || 'kuzey', per = +(process.argv[3] || 10), secs = +(process.argv[4] || 480);
if (process.argv[5]) { let s = +process.argv[5] >>> 0; Math.random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const game = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type: 'conquest' } });
const V = game.vehicles;
const kindOf = (v) => (v.def.heli ? 'heli' : v.def.cannon ? 'tank' : v.def.moto ? 'moto' : 'jip');
const open = new Map(), done = [];
const close = (v, how) => { const a = open.get(v); if (!a) return; open.delete(v); a.how = how; a.dur = game.time - a.t; done.push(a); };
game.on('vehexit', ({ v }) => { if (v.alive && !V.occupants(v).length) { const far = Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z); open.set(v, { k: kindOf(v), t: game.time, far, x: Math.round(v.st.x), z: Math.round(v.st.z), water: !!v.st.sunk }); } });
game.on('vehenter', ({ s, v }) => { if (open.has(v)) close(v, s.brain ? 'bot' : 'insan'); });
game.on('vehboom', ({ v, quiet }) => close(v, quiet ? (v.st?.sunk ? 'batma' : 'yenilendi') : 'patladı'));
let alive = 0, driven = 0;
const dt = 1 / 30;
for (let i = 0; i < secs * 30 && !game.ended; i++) {
  game.step(dt);
  if (i % 30 === 0) for (const v of V.list) if (v.alive) { alive++; if (v.seats[0]) driven++; }
}
for (const v of [...open.keys()]) close(v, 'boş(son)');
const far = done.filter((a) => a.far > 25), avg = (a) => (a.length ? a.reduce((s, x) => s + x.dur, 0) / a.length : 0);
const by = {}; for (const a of far) by[a.how] = (by[a.how] || 0) + 1;
const byK = {}; for (const a of far) byK[a.k] = (byK[a.k] || 0) + 1;
console.log(`${map} ${per}v${per} ${(game.time).toFixed(0)} sn · terk (doğuşa >25 m) ${far.length} (yakında ${done.length - far.length}) · tür ${JSON.stringify(byK)}`);
console.log(`sonuç ${JSON.stringify(by)} · boşta ort ${avg(far).toFixed(1)} sn (en çok ${Math.max(0, ...far.map((a) => a.dur)).toFixed(0)}) · terk edilene binen bot ${by.bot || 0} · kullanım %${(100 * driven / Math.max(1, alive)).toFixed(1)} (sürücülü ${driven} / canlı ${alive} araç-sn)`);
if (process.env.V) for (const a of far) console.log(`  ${a.k} ${a.x},${a.z} uzak ${a.far.toFixed(0)} m · ${a.dur.toFixed(0)} sn → ${a.how}`);
process.exit(0);
