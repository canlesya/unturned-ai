// Zombi özel güçleri birim testi (headless): ışınlanma, görünmezlik, zırh, öfke, atılış, bekleme süresi.
import { Game } from '../src/game/game.js';
import { ZTYPES } from '../src/game/stats.js';
const g = new Game(null, { headless: true, map: 'kasaba', tod: 'day', weather: 'clear', match: { perTeam: 4, type: 'inf', time: 600 } });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const z = g.soldiers.find((s) => s.def.zombie);
const pts = g.nav.spreadPoints(g.nav.reachable(g.map.spawns.blue[0].x, g.map.spawns.blue[0].z), { spacing: 6, max: 400 });
const setType = (t) => { z.ztype = t; z.boss = false; z.setClass('zombie'); z.brain = null; g.brains = []; z.spawn({ x: pts[5].x, z: pts[5].z, ry: 0 }, 0); g.world.settle(z); z.protT = 0; z.abT = 0; };
for (const t of Object.keys(ZTYPES)) { setType(t); check(z.maxHp === ZTYPES[t].hp && z.hp === z.maxHp, `${t}: can ${z.maxHp}`); }
// ışınlanma: en açık yönü bul
setType('blinker');
let best = 0;
for (let k = 0; k < 16; k++) { z.pos.set(pts[5].x, 0, pts[5].z); g.world.settle(z); z.yaw = (k / 16) * Math.PI * 2; z.abT = 0; const x0 = z.pos.x, z0 = z.pos.z; if (z.useAbility()) best = Math.max(best, Math.hypot(z.pos.x - x0, z.pos.z - z0)); }
check(best > 6 && best <= 14.5, `ışınlanma açık yönde ${best.toFixed(1)} m (en çok 14)`);
z.abT = 0; z.pos.set(pts[5].x, 0, pts[5].z); g.world.settle(z); const fine = z.useAbility(); check(!fine || z.abT > 7, 'ışınlanma sonrası bekleme süresi var');
check(!z.useAbility(), 'bekleme bitmeden yeniden kullanılamaz');
// görünmezlik
setType('ghost'); check(!z.cloaked, 'hayalet başta görünür'); z.useAbility(); check(z.cloaked && z.abActive > 5, 'görünmezlik açıldı');
z.takeDamage(10, g.soldiers[0], 'body', z.pos, 'x'); check(!z.cloaked, 'hasar alınca görünmezlik biter');
setType('ghost'); z.useAbility(); z._melee(z.stat); check(!z.cloaked, 'saldırınca görünmezlik biter');
// zırh
setType('brute'); const hp0 = z.hp; z.takeDamage(100, g.soldiers[0], 'body', z.pos, 'x'); const plain = hp0 - z.hp;
setType('brute'); z.useAbility(); const hp1 = z.hp; z.takeDamage(100, g.soldiers[0], 'body', z.pos, 'x'); const shielded = hp1 - z.hp;
check(plain === 100 && Math.abs(shielded - 30) < 0.01, `zırh: ${plain} → ${shielded.toFixed(0)} hasar`);
// hız
setType('walker'); const v0 = z.spd; z.useAbility(); check(z.spd > v0 * 1.2, `öfke hızı ${v0.toFixed(2)} → ${z.spd.toFixed(2)}`);
setType('runner'); const r0 = z.spd; z.useAbility(); check(z.spd > r0 * 1.6, `atılış hızı ${r0.toFixed(2)} → ${z.spd.toFixed(2)}`);
// süre dolunca biter
for (let i = 0; i < 30 * 3; i++) z.update(1 / 30); check(z.abActive === 0 && z.spd === r0, 'güç süresi dolunca normale döner');
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
