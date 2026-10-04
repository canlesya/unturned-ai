// Ateş modları testi (sunucu mantığı):  node scripts/firetest.mjs
import { Game } from '../src/game/game.js';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const g = new Game(null, { headless: true, map: 'kasaba', match: { perTeam: 2, type: 'tdm', tickets: 500 } });
const A = g.claimSlot('blue', 'Ali'); g.claimSlot('red', 'Veli'); g.brains.length = 0;
A.protT = 0; A.items[0] = { id: 'm4a1', mag: 30, reserve: 150 }; A.cur = 0; A.switchT = 0;
const DT = 1 / 60; let q = 0; const ha = g.humans.get(A.id);
const inp = (o) => ha.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: A.yaw, pt: A.pitch, c: 0, p: 0, u: 0, w: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, vt: null, ...o });
const shots = (ticks, o0, oRest) => { const m0 = A.item.mag; inp(o0); for (let i = 1; i < ticks; i++) inp(oRest || {}); for (let i = 0; i < ticks; i++) g.step(DT); return m0 - A.item.mag; };
const rest = () => { for (let i = 0; i < 60; i++) { inp({}); g.step(DT); } A.item.mag = 30; A.cd = 0; };
check(A.fireModeNow === 'auto', 'varsayılan: otomatik');
// otomatik: basılı tut → sürekli
let n = shots(60, { fh: 1, fp: 1 }, { fh: 1 }); check(n >= 8, `otomatik basılı tut: ${n} mermi (sürekli)`); rest();
// tek: basılı tutsa da 1 mermi
inp({ fm: 1 }); g.step(DT); check(A.fireModeNow === 'semi', 'X: otomatik → tek atış');
n = shots(60, { fh: 1, fp: 1 }, { fh: 1 }); check(n === 1, `tek atış, basılı tut: ${n} mermi`); rest();
n = shots(60, { fp: 1 }, {}); check(n === 1, `tek atış, tek tık: ${n} mermi`); rest();
// seri: tek tık → N mermi, basılı tut → yine N
inp({ fm: 1 }); g.step(DT); check(A.fireModeNow === 'burst', 'X: tek → seri');
const N = A.burstSize();
n = shots(90, { fp: 1 }, {}); check(n === N && N >= 3 && N <= 5, `seri, tek tık: ${n} mermi (beklenen ${N}, 3-5 arası)`); rest();
n = shots(90, { fh: 1, fp: 1 }, { fh: 1 }); check(n === N, `seri, basılı tut: ${n} mermi (yeniden çekmeden devam etmez)`); rest();
// seri sürerken silah değişince bitsin
inp({ fp: 1 }); g.step(DT); inp({ w: 1 }); for (let i = 0; i < 30; i++) { inp({ w: 1 }); g.step(DT); }
check(A.burstLeft === 0, 'silah değişince seri sıfırlanır'); inp({ w: 0 }); for (let i = 0; i < 20; i++) { inp({ w: 0 }); g.step(DT); } rest();
// bir daha: otomatik
inp({ fm: 1 }); for (let i = 0; i < 4; i++) { inp({}); g.step(DT); } check(A.fireModeNow === 'auto', 'X: seri → otomatik (döngü)');
// yarı otomatik silah (keskin nişancı): mod değişmez
A.items[0] = { id: 'sniper', mag: 5, reserve: 20 }; A.cur = 0; A.switchT = 0; g.step(DT);
check(A.fireModeNow === 'semi' && A.toggleFireMode() === null, 'bolt/yarı otomatik silahta mod seçimi yok (hep tek)');
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
