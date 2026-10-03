// Ölüm Maçı testi (tarayıcısız, sunucu çekirdeği):  node scripts/dmtest.mjs
import { Game } from '../src/game/game.js';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };

const g = new Game(null, { headless: true, map: 'kasaba', diff: 'hard', match: { perTeam: 10, type: 'dm', time: 600 } });
const S = g.soldiers;
check(g.ffa && S.length === 10, `10 savaşçı, herkes tek (ffa=${g.ffa})`);
check(new Set(S.map((s) => s.team)).size === 10, 'her savaşçının benzersiz takım kimliği');
check(g.mode.objectives.length === 0 && g.mode.killLimit === 40, 'bayrak yok, öldürme sınırı 40');
const bigMax = new Game(null, { headless: true, map: 'vadi', match: { perTeam: 25, type: 'dm' } });
check(bigMax.soldiers.length === 10, `en çok 10 kişi (25 istendi → ${bigMax.soldiers.length})`);
// doğma yerleri rastgele ve dağınık mı?
const pts = S.map((s) => [Math.round(s.pos.x), Math.round(s.pos.z)]);
const near = pts.filter((p, i) => pts.some((q, j) => j !== i && Math.hypot(p[0] - q[0], p[1] - q[1]) < 3)).length;
const xs = pts.map((p) => p[0]), spread = Math.max(...xs) - Math.min(...xs);
check(spread > 40 && near <= 2, `doğma yerleri dağınık (x aralığı ${spread} m, birbirine <3 m: ${near})`);
// doğma yayılımı: her haritada, uzun bir maç boyunca tüm doğmalar harita geneline dağılıyor mu?
for (const mapId of ['kasaba', 'vadi', 'us']) {
  const gm = new Game(null, { headless: true, map: mapId, diff: 'hard', match: { perTeam: 10, type: 'dm', time: 0 } });
  const spawns = []; gm.on('spawn', (s) => spawns.push({ x: s.pos.x, z: s.pos.z }));
  for (let i = 0; i < 30 * 600 && spawns.length < 80; i++) gm.step(1 / 30);
  const cells = new Set(spawns.map((p) => Math.floor(p.x / 30) + ',' + Math.floor(p.z / 30)));
  const b0 = gm.map.spawns.blue[0], b1 = gm.map.spawns.red[0];
  const nearBase = spawns.filter((p) => Math.hypot(p.x - b0.x, p.z - b0.z) < 25 || Math.hypot(p.x - b1.x, p.z - b1.z) < 25).length / spawns.length;
  const pool = gm.dmPool || [];
  const unreachable = pool.filter((p) => !gm.nav.findPath(b0.x, b0.z, p.x, p.z)).length;
  const minPair = Math.min(...pool.slice(0, 60).flatMap((p, i) => pool.slice(i + 1, 60).map((q) => Math.hypot(p.x - q.x, p.z - q.z))));
  console.log(`      ${mapId}: ${spawns.length} doğma · ${cells.size} farklı 30 m bölge · üs yakınında %${Math.round(nearBase * 100)} · havuz ${pool.length} nokta, en yakın çift ${minPair.toFixed(1)} m, ulaşılamayan ${unreachable}`);
  check(spawns.length >= 40 && cells.size >= 10 && nearBase < 0.35, `${mapId}: doğmalar harita geneline dağılıyor (${cells.size} bölge, üs yakını %${Math.round(nearBase * 100)})`);
  check(pool.length >= 40 && unreachable === 0 && minPair >= 13, `${mapId}: ${pool.length} doğma noktası, hepsi ulaşılabilir ve aralıklı`);
}
let ev = 0; g.on('end', () => ev++);
const t0 = performance.now();
for (let i = 0; i < 30 * 60 * 10 && !g.ended; i++) g.step(1 / 30);
const sec = (performance.now() - t0) / 1000;
const top = [...S].sort((a, b) => b.kills - a.kills || b.score - a.score);     // eşitlikte puan
console.log(`      maç ${g.time.toFixed(0)} sn sürdü (gerçek ${sec.toFixed(1)} sn) · ilk 3: ${top.slice(0, 3).map((s) => s.name + ' ' + s.kills).join(', ')}`);
check(g.ended && ev === 1, `maç bitti: ${g.endReason}`);
check(top[0].kills >= 40 || g.timeLeft <= 0, `kazanan ${top[0].name}: ${top[0].kills} öldürme (sınır 40 ya da süre)`);
check(g.winner === top[0].team, 'kazanan en çok öldüren');
check(S.every((s) => Number.isFinite(s.pos.x) && s.pos.y > -5), 'geçersiz konum yok');
check(S.reduce((a, s) => a + s.kills, 0) > 40, 'botlar birbirini öldürdü (herkes herkese düşman)');
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
