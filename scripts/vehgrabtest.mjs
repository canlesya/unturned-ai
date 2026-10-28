// 12.200 araç kapma kuralı (başsız): yeni doğan araca botlar grace sn binmez; takımda insan varken her doğuş grubunun bir kısmı hold sn insana
// ayrılır; insanın 30 m yakınındaki taze araca bot binmez; tarafsız (yol kenarı) araca bot biner; tanksavar donanımı (zırhlı araçlı haritada).
//   node scripts/vehgrabtest.mjs
import { Game } from '../src/game/game.js';
import { VBOT, botMayTake } from '../src/game/vehicleBots.js';

let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x !== '' ? ' · ' + x : '')); if (!c) fails++; };
const G = VBOT.grab;
const mk = () => new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 10, type: 'conquest' } });

// 1) insansız takım: grace içinde bot binmez, sonra biner
{
  const g = mk(), V = g.vehicles, first = new Map();
  g.on('vehenter', ({ s, v, seat }) => { if (s.brain && seat === 0 && !first.has(v.id)) first.set(v.id, g.time - v.spawnT); });
  for (let i = 0; i < 30 * 90; i++) g.step(1 / 30);
  const ts = [...first.values()];
  ok(ts.length > 0 && Math.min(...ts) >= G.grace, `insansız maç: ilk bot binişi doğuştan en erken ${G.grace} sn sonra`, `en erken ${Math.min(...ts).toFixed(1)} sn · ${ts.length} araç sürüldü / ${V.list.length}`);
  const neutral = V.list.filter((v) => !v.spawn.team);
  ok(neutral.length >= 3, 'yol kenarında tarafsız araç var', neutral.map((v) => v.id).join(', '));
  // tanksavar: düşman tankı varken her takımda RPG'li bot sayısı ≥ 2
  for (const t of ['blue', 'red']) {
    const n = g.soldiers.filter((s) => s.team === t && s.items[2]?.id === 'rpg').length;
    ok(n >= 2, `${t}: düşmanın tankı varken RPG taşıyan bot ≥ 2`, `${n} / ${g.soldiers.filter((s) => s.team === t).length}`);
  }
  g.dispose?.();
}

// 2) mavi takımda bir insan (uzakta, araçların 30 m dışında): her grubun ilk aracı hold sn insana ayrılır; kırmızıda (insansız) ayrım yok
{
  const g = mk(), V = g.vehicles, H = g.soldiers.find((s) => s.team === 'blue');
  g.brains = g.brains.filter((b) => b.s !== H); H.brain = null; H.human = true;
  const park = () => { H.pos.set(-700, g.world.heightAt(-700, 700) + 0.1, 700); H.vel.set(0, 0, 0); H.alive = true; H.hp = H.maxHp; };
  park();
  const taken = new Map();
  g.on('vehenter', ({ s, v, seat }) => { if (s.brain && seat === 0 && !taken.has(v.id)) taken.set(v.id, g.time); });
  for (let i = 0; i < 30 * (G.hold - 2); i++) { g.step(1 / 30); park(); }
  const groups = new Map();
  for (const v of V.list) { const k = v.spawn.team + '|' + v.type; (groups.get(k) || groups.set(k, []).get(k)).push(v); }
  let resv = 0, bad = [];
  for (const [k, L] of groups) {
    if (!k.startsWith('blue|')) continue;
    const first = L.sort((a, b) => a.idx - b.idx)[0];
    resv++;
    if (taken.has(first.id)) bad.push(first.id);
  }
  ok(bad.length === 0, `insanlı takım: üsteki her grubun ilk aracı ${G.hold} sn bota verilmez`, `${resv} grup · bota giden ${bad.join(', ') || '-'} · bot sürdüğü mavi araç ${[...taken.keys()].filter((id) => id.startsWith('B-')).join(', ')}`);
  ok([...taken.keys()].some((id) => /^B-J[0-9]$/.test(id) && id !== 'B-J1'), 'insanlı takımda ayrılmayan jipleri botlar alır', [...taken.keys()].join(', '));
  // süre dolunca ayrılan araç da bota açılır
  const v1 = V.list.find((v) => v.id === 'B-J1');
  for (let i = 0; i < 30 * 4; i++) { g.step(1 / 30); park(); }
  ok(!v1.alive || v1.lastDriver || botMayTake(g, v1, 'blue'), `${G.hold} sn sonra ayrılan araç botlara açılır`);
  // insan aracın yanında: taze araca bot binmez
  const v2 = V.list.find((v) => v.id === 'R-J5');
  ok(botMayTake(g, v2, 'red') || g.time - v2.spawnT >= G.hold, 'insansız takımın aracı (grace sonrası) bota açık');
  g.dispose?.();
}
console.log(fails ? `${fails} HATA` : 'hepsi OK');
process.exit(fails ? 1 : 0);
