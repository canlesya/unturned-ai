// Zombi vuruş kutusu ve zıplama testi (headless): boss/zombi görünen boyutuyla aynı yükseklik-genişlikte vurulur mu, kim ne kadar yüksek zıplıyor.
import { Game } from '../src/game/game.js';
import * as THREE from 'three';
import { JUMP_SPEED, applyInput } from '../src/sim/input.js';
import { ZTYPES, BOSS } from '../src/game/stats.js';
const g = new Game(null, { headless: true, map: 'dev', tod: 'day', weather: 'clear', match: { perTeam: 20, type: 'inf', time: 900 } });
g.brains = [];
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const boss = g.soldiers.find((s) => s.boss), hum = g.soldiers.find((s) => s.team === 'blue'), tmp = g.soldiers.filter((s) => s.team === 'blue')[1];
const place = (s, x, z) => { s.spawn({ x, z, ry: 0 }, 0); s.pos.set(x, 0, z); g.world.settle(s); s.protT = 0; };
place(boss, 0, 0);
const o = new THREE.Vector3(), d = new THREE.Vector3(0, 0, -1);
const hit = (e, y, dx = 0) => { o.set(e.pos.x + dx, e.pos.y + y, e.pos.z + 6); return g.hitSoldier(e, o, d, 30); };
const H = 1.78;
console.log(`boss ölçeği ${BOSS.scale} → vuruş kutusu yüksekliği ${(H * boss.hbH).toFixed(2)} m, yarı genişlik ${(0.29 * boss.hbW).toFixed(2)} m`);
check(boss.hbH === BOSS.scale[1] && boss.hbW === BOSS.scale[0], 'boss hbH/hbW model ölçeğiyle aynı');
check(!!hit(boss, 0.6) && hit(boss, 0.6).zone !== 'head', 'boss gövde (0.6 m) vurulur');
const topY = H * boss.hbH - 0.1;
check(!!hit(boss, topY) && hit(boss, topY).zone === 'head', `boss kafası ${topY.toFixed(2)} m yükseklikte vurulur (eski kutu ${H} m'de biterdi)`);
check(!hit(boss, H * boss.hbH + 0.15), 'kutunun üstü ıska');
const wide = 0.29 * boss.hbW - 0.05;
check(!!hit(boss, 1.0, wide), `kenar (x ${wide.toFixed(2)} m) vurulur (insan kutusu 0.29 m'de biterdi)`);
check(!hit(boss, 1.0, 0.29 * boss.hbW + 0.2), 'genişliğin dışı ıska');
// insan kutusu değişmedi
place(hum, 10, 0); o.set(10, 1.7, 6); check(g.hitSoldier(hum, o, d, 30)?.zone === 'head', 'insan kafası hâlâ 1.7 m'); o.set(10, 1.95, 6); check(!g.hitSoldier(hum, o, d, 30), 'insan 1.95 m ıska');
// zıplama
const jump = (s) => { s.vel.set(0, 0, 0); s.onGround = true; s.vel.y = JUMP_SPEED * (s.jumpMul || 1); s.onGround = false; let peak = 0; for (let i = 0; i < 240; i++) { g.world.move(s, 1 / 60); peak = Math.max(peak, s.pos.y - 0); if (s.onGround && i > 5) break; } return peak; };
place(hum, 20, 0); const hj = jump(hum);
console.log(`insan zıplama tepe noktası ${hj.toFixed(2)} m`);
for (const t of Object.keys(ZTYPES)) { g.makeZombie(tmp, false, t); const z = tmp; place(z, 30, 0); const j = jump(z); check(j > hj * 1.2 && j < hj * 2.6, `${t}: ${j.toFixed(2)} m (insanın ${(j / hj).toFixed(1)} katı)`); }
place(boss, 40, 0); const bj = jump(boss); check(bj > hj * 1.5 && bj < hj * 2.6, `boss: ${bj.toFixed(2)} m (${(bj / hj).toFixed(1)} katı)`);
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
