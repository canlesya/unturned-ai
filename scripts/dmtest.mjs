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
check(spread > 60 && near <= 2, `doğma yerleri dağınık (x aralığı ${spread} m, birbirine <3 m: ${near})`);
let ev = 0; g.on('end', () => ev++);
const t0 = performance.now();
for (let i = 0; i < 30 * 60 * 10 && !g.ended; i++) g.step(1 / 30);
const sec = (performance.now() - t0) / 1000;
const top = [...S].sort((a, b) => b.kills - a.kills);
console.log(`      maç ${g.time.toFixed(0)} sn sürdü (gerçek ${sec.toFixed(1)} sn) · ilk 3: ${top.slice(0, 3).map((s) => s.name + ' ' + s.kills).join(', ')}`);
check(g.ended && ev === 1, `maç bitti: ${g.endReason}`);
check(top[0].kills >= 40 || g.timeLeft <= 0, `kazanan ${top[0].name}: ${top[0].kills} öldürme (sınır 40 ya da süre)`);
check(g.winner === top[0].team, 'kazanan en çok öldüren');
check(S.every((s) => Number.isFinite(s.pos.x) && s.pos.y > -5), 'geçersiz konum yok');
check(S.reduce((a, s) => a + s.kills, 0) > 40, 'botlar birbirini öldürdü (herkes herkese düşman)');
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
