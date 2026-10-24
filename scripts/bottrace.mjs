// Rol izi (hata ayıklama): node scripts/bottrace.mjs [harita=colgecidi] [mod=conquest] [zorluk=normal] [rol=sniper] [sn=120]
// Seçilen roldeki botların 5 sn'de bir durumu (mevzi, mevzide mi, hedef) + ölüm / öldürme olayları.
let seed = 5;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const { Game } = await import('../src/game/game.js');
const [map = 'colgecidi', type = 'conquest', diff = 'normal', role = 'sniper', secs = '120'] = process.argv.slice(2);
const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff, match: { perTeam: 8, type } });
const f = (v) => v.toFixed(0);
const onKill = g.onKill.bind(g);
g.onKill = (k, v, w, hs) => {
  const d = k ? Math.hypot(k.pos.x - v.pos.x, k.pos.z - v.pos.z) : 0;
  if (v.brain?.role === role) console.log(`${g.time.toFixed(1)} ÖLDÜ ${v.name} (${f(v.pos.x)},${f(v.pos.z)}) atSpot=${v.brain.atSpot} hedef=${v.brain.target ? v.brain.target.name : '-'} katil=${k?.name} ${f(d)}m katilinHedefi=${k?.brain?.target === v} katilRol=${k?.brain?.role}`);
  if (k?.brain?.role === role && k !== v) console.log(`${g.time.toFixed(1)} ÖLDÜRDÜ ${k.name} → ${v.name} ${f(d)}m atSpot=${k.brain.atSpot} silah=${w}`);
  return onKill(k, v, w, hs);
};
for (let i = 0; i < +secs * 30; i++) {
  g.step(1 / 30);
  if (i % 150 === 0) for (const b of g.brains) if (b.role === role && b.s.alive) {
    const s = b.s, sp = b.spot;
    console.log(`${g.time.toFixed(1)} ${s.name} ${s.team} (${f(s.pos.x)},${f(s.pos.y)},${f(s.pos.z)}) mevzi=${sp ? `(${f(sp.x)},${f(sp.z)}) ${f(Math.hypot(sp.x - s.pos.x, sp.z - s.pos.z))}m` : '-'} atSpot=${b.atSpot} hedef=${b.target ? b.target.name + ' ' + f(Math.hypot(b.target.pos.x - s.pos.x, b.target.pos.z - s.pos.z)) + 'm' : '-'} goal=${b.goal ? `(${f(b.goal.x)},${f(b.goal.z)}) T${f(b.goalT)}` : '-'} silah=${s.item.id} çömel=${s.crouching}`);
  }
}
