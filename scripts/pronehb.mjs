// 12.199 yüzüstü vuruş kutusu gövde yönünde (bakışta değil): node scripts/pronehb.mjs
import { Game } from '../src/game/game.js';
import * as THREE from 'three';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const g = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', match: { perTeam: 2, type: 'tdm' } });
const e = g.soldiers[1]; e.alive = true; e.pos.set(0, 0, 0); e.prone = true; e.proneT = 1; e.height = 0.6;
e.pBody = 0; e.yaw = 1.2;                                   // gövde -Z yönünde, bakış 69° sola
const down = new THREE.Vector3(0, -1, 0);
const at = (x, z) => g.hitSoldier(e, new THREE.Vector3(x, 3, z), down, 10)?.zone || 'yok';
check(at(0, -0.72) === 'head', `gövde yönünde 0,72 m önde baş: ${at(0, -0.72)}`);
check(at(-Math.sin(1.2) * 0.9, -Math.cos(1.2) * 0.9) === 'yok', `bakış yönünde (gövde dışında) isabet yok: ${at(-Math.sin(1.2) * 0.9, -Math.cos(1.2) * 0.9)}`);
check(at(0, 0.6) === 'body', `gövde ekseninde arkada (bacaklar) gövde: ${at(0, 0.6)}`);
check(at(0.6, 0) === 'yok', `yanda boş: ${at(0.6, 0)}`);
// sırttan bıçak: arkası gövde yönüne göre
const k = g.soldiers[0]; k.pos.set(0, 0, 1.2);
check(k.isBehind(e), 'gövdenin arkasındaki bıçakçı sırttan sayılır (bakış yana dönük olsa da)');
console.log(fail ? `${fail} HATA` : 'sonuç: OK'); process.exit(fail ? 1 : 0);
