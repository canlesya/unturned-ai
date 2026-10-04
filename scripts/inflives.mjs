// Can hakkı kuralları (headless): insan 1 ölümle zombi · zombi 1 ölümle insan · boss 3 ölümle insan · boss'un öldürdüğü NORMAL zombi.
import { Game } from '../src/game/game.js';
import { ZOMBIE, BOSS } from '../src/game/stats.js';
const g = new Game(null, { headless: true, map: 'kasaba', tod: 'day', weather: 'clear', match: { perTeam: 12, type: 'inf', time: 900 } });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
g.brains = [];                                           // botlar durur
const bosses = g.soldiers.filter((s) => s.boss), humans = g.soldiers.filter((s) => s.team === 'blue');
check(bosses.length === 2 && g.mode.total === 12, `12 kişide 2 boss (${bosses.length})`);
check(bosses.every((b) => b.maxHp === BOSS.hp + BOSS.hpPerPlayer * 12 && b.zLives === 3), `boss can ${bosses[0].maxHp}, hak ${bosses[0].zLives}`);
const small = new Game(null, { headless: true, map: 'kasaba', tod: 'day', weather: 'clear', match: { perTeam: 8, type: 'inf', time: 900 } });
check(small.soldiers.filter((s) => s.boss).length === 1, '8 kişide 1 boss');
const step = (n = 30 * 12) => { for (let i = 0; i < n; i++) g.step(1 / 30); };
const kill = (v, by) => { v.protT = 0; v.takeDamage(99999, by, 'body', v.pos, 'test'); };
// 1) boss bir insanı öldürür → normal zombi (boss değil), 2 hak
const b = bosses[0], h = humans[0];
step(30 * 4); b.protT = h.protT = 0;
kill(h, b); check(h.infectNext, 'insan 1 ölümle enfekte olacak'); step();
check(h.def.zombie && !h.boss && h.zLives === ZOMBIE.lives && h.team === 'red', `boss'un öldürdüğü normal zombi oldu (hak ${h.zLives})`);
// 2) normal zombi: tek ölümle insan
kill(h, humans[1]); check(h.zLives === 0 && h.willCure, 'normal zombi 1 ölümle: hak bitti, insana dönecek'); step();
check(!h.def.zombie && h.team === 'blue' && h.alive && h.cls === h.humanCls, `iyileşti: insan (${h.cls}) olarak doğdu`);
// 3) boss 3 ölüm
for (let i = 1; i <= 3; i++) { step(30 * 3); b.protT = 0; kill(b, humans[2]); check(b.zLives === 3 - i, `boss ölüm ${i}: kalan hak ${b.zLives}`); step(30 * 12); }
check(!b.def.zombie && !b.boss && b.team === 'blue' && b.alive, 'boss 3 ölümden sonra insan oldu');
// 4) tekrar enfekte olabilir
step(30 * 4); b.protT = 0; kill(b, bosses[1]); step(30 * 12);
check(b.def.zombie && !b.boss && b.zLives === ZOMBIE.lives, 'iyileşen biri yeniden enfekte olunca normal zombi');
// 5) tüm zombiler iyileşirse insanlar kazanır
for (const s of g.soldiers) if (s.def.zombie) { s.zLives = 0; }
for (const s of g.soldiers) if (s.def.zombie && s.alive) { s.protT = 0; kill(s, humans[3]); }
step(60);
check(g.ended && g.winner === 'blue', `tüm zombiler iyileşince insanlar kazandı: ${g.endReason}`);
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
