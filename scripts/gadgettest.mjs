// Sunucu gadget testi (ağsız): her gadget tipinin doğru ağ olaylarını ürettiğini doğrular.  node scripts/gadgettest.mjs
import { Game } from '../src/game/game.js';
import { WSTATS } from '../src/game/stats.js';
import * as THREE from 'three';

let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const g = new Game(null, { headless: true, map: 'kasaba', match: { perTeam: 2, type: 'tdm', tickets: 500 } });
const A = g.claimSlot('blue', 'Ali'), B = g.claimSlot('red', 'Veli'); const ha = g.humans.get(A.id);
g.brains.length = 0;
const DT = 1 / 60; let q = 0;
const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(DT); };
const input = (extra) => ha.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: A.yaw, pt: A.pitch, c: 0, p: 0, u: 0, w: A.cur, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, vt: null, ...extra });

// iki oyuncuyu 6 m arayla açık yere koy (B, A'nın baktığı yönde)
let ok = false;
for (let k = 0; k < 4000 && !ok; k++) {
  const x = -40 + Math.random() * 80, z = -40 + Math.random() * 80;
  const bx = x + 0, bz = z - 6;                                    // yaw=0 → −Z'ye bakar
  if (!g.nav.isFree(x, z) || !g.nav.isFree(bx, bz) || !g.nav.isFree(x, z - 3)) continue;
  A.pos.set(x, g.world.heightAt(x, z), z); B.pos.set(bx, g.world.heightAt(bx, bz), bz); A.vel.set(0, 0, 0); B.vel.set(0, 0, 0);
  ok = g.world.clear(A.eye(), B.eye());
  // önde 14 m, geride/yanda 2 m açık alan: mayın kurulumu, atılan gadget'lar ve patlamalar duvara takılmasın
  const o = A.eye(new THREE.Vector3());
  for (const [dx, dz, len] of [[0, -1, 14], [0, 1, 2], [1, 0, 2], [-1, 0, 2]]) if (ok && g.world.raycast(o, new THREE.Vector3(dx, 0, dz), len, {})) ok = false;
}
check(ok, 'oyuncular yerleştirildi');
A.protT = B.protT = 0; step(130);
const find = (f) => Object.keys(WSTATS).find((id) => f(WSTATS[id]));
const ids = { frag: find((s) => s.kind === 'throwable' && (!s.gtype || s.gtype === 'frag')), smoke: find((s) => s.gtype === 'smoke'), flash: find((s) => s.gtype === 'flash'), mine: find((s) => s.kind === 'mine'), ammo: find((s) => s.kind === 'ammobox'), rocket: find((s) => s.kind === 'launcher' && !s.impact), shell: find((s) => s.kind === 'launcher' && s.impact) };
console.log('      gadget kimlikleri:', JSON.stringify(ids));

const collect = []; const run = (n) => { for (let i = 0; i < n; i++) { step(); collect.push(...g.netEvents); g.netEvents.length = 0; } };
function use(id, pitch = 0, waitTicks = 60 * 5) {
  A.items[2] = { id, mag: 3, reserve: 3 }; A.cur = 2; A.switchT = 0; A.cd = 0; A.reloadT = 0; A.useT = 0; A.pitch = pitch; A.yaw = 0;
  B.hp = B.maxHp; B.alive = true; B.protT = 0; collect.length = 0;
  input({ w: 2, yw: 0, pt: pitch, fp: 1, fh: 1 }); run(1); input({ w: 2, yw: 0, pt: pitch }); run(waitTicks);
  return collect.map((e) => e.e + (e.k ? ':' + e.k : ''));
}
const has = (list, x) => list.includes(x);
let r;
r = use(ids.frag, -0.5);   check(has(r, 'gr') && has(r, 'boom:x'), `frag: ${r.filter((x) => x !== 'sh').join(' ')}`);
r = use(ids.smoke, -0.5);  check(has(r, 'gr') && has(r, 'boom:s'), `duman: ${r.join(' ')}`);
check(g.smokes.length > 0, 'sunucuda duman küresi oluştu');
r = use(ids.flash, -0.5);  check(has(r, 'gr') && has(r, 'boom:f'), `flaşbang: ${r.join(' ')}`);
if (ids.rocket) { r = use(ids.rocket, 0.0, 120); check(has(r, 'rk') && has(r, 'boom:x'), `roket: ${r.join(' ')}`); }
if (ids.shell) { r = use(ids.shell, 0.0, 120); check(has(r, 'sl') && has(r, 'boom:x'), `M79: ${r.join(' ')}`); }
r = use(ids.mine, 0, 30);  check(has(r, 'dep'), `mayın kuruldu: ${r.join(' ')}`);
const mineDep = g.deployables.find((d) => d.type === 'claymore');
check(!!mineDep, 'sunucuda claymore nesnesi var');
// B mayının önüne yürüsün: A'nın 0.9 m önünde kurulu, B'yi mayının koni alanına koy
step(100);                                                  // mayın kurulumu (arm) bitsin
// hedefi mayının önünde, mayıdan görüş hattı AÇIK bir noktaya koy (rastgele yerleşimde duvar/engel çıkabilir)
let placed = false;
for (const dist of [1.5, 1.2, 1.8, 1.0, 2.2]) {
  const bx = mineDep.pos.x + mineDep.fx * dist, bz = mineDep.pos.z + mineDep.fz * dist;
  B.pos.set(bx, mineDep.pos.y, bz); g.world.settle(B);
  if (g.world.clear(mineDep.pos, B.center(new THREE.Vector3()))) { placed = true; break; }
}
B.protT = 0; collect.length = 0;
run(30);
r = collect.map((e) => e.e + (e.k ? ':' + e.k : ''));
check(has(r, 'boom:x') && has(r, 'depx'), `mayın patladı ve kalktı: ${r.join(' ')}`);
r = use(ids.ammo, 0, 30);  check(has(r, 'dep'), `cephane kutusu kuruldu: ${r.join(' ')}`);
check(g.deployables.some((d) => d.type === 'ammo'), 'sunucuda cephane kutusu nesnesi var');

console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
