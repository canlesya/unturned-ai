// Keskin nişancı belden (no-scope) isabet ölçümü (ağsız, 12.156): gerçek Soldier._shoot yolu (spreadNow + tohumlu / Math.random zar) → hedef askerin
// gerçek vuruş kutusu (game.hitSoldier), nişan noktası hedefin göğsü (center). Çevrimdışı (Math.random) ve çevrim içi (girdi sıra no ile tohumlu:
// sunucu + istemci aynı Soldier kodu, aynı tohum) ayrı ölçülür.
//   node scripts/sniperhip.mjs [N=20]      (N: mesafe başına atış; yanında 4000 atışla kararlı oran)   OUT=dosya.json → sonuçları yazar
import { Game } from '../src/game/game.js';
import { WSTATS } from '../src/game/stats.js';
import * as THREE from 'three';
const N = +(process.argv[2] || 20);
const g = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', match: { perTeam: 1, type: 'tdm', tickets: 500 } });
const A = g.claimSlot('blue', 'Ali'), B = g.claimSlot('red', 'Veli'); g.brains.length = 0;
const s = g.soldiers.find((o) => o.id === A.id), t = g.soldiers.find((o) => o.id === B.id);
let dirs = []; g.shootRay = (sh, o, d) => dirs.push([o.clone(), d.clone()]);
const out = {};
function run(id, dist, n, online, adsT = 0) {
  const st = WSTATS[id]; s.items[0] = { id, mag: 99, reserve: 99 }; s.cur = 0;
  s.pos.set(0, 0, 0); t.pos.set(0, 0, -dist); t.yaw = 0; t.alive = true; t.proneT = 0; t.crouching = false;
  const e = s.eye(new THREE.Vector3()), c = t.center(new THREE.Vector3());
  const z = { head: 0, body: 0, legs: 0, miss: 0 }, dev = [];
  for (let i = 0; i < n; i++) {
    s.vel.set(0, 0, 0); s.onGround = true; s.crouching = false; s.sinceShot = 5; s.bloom = 0; s.firedSprinting = false; s.recoilP = 0; s.adsT = adsT;
    s.yaw = Math.atan2(-(c.x - e.x), -(c.z - e.z)); s.pitch = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z));
    s.inSeq = online ? 1000 + i * 7 : undefined;
    dirs = []; s._shoot(st);
    const [o, d] = dirs[0], h = g.hitSoldier(t, o, d, 1000);
    z[h ? h.zone : 'miss']++;
    const base = new THREE.Vector3().subVectors(c, o).normalize(); dev.push(Math.acos(Math.min(1, base.dot(d))) * dist * 100);   // hedef mesafesinde merkezden sapma (cm)
  }
  dev.sort((a, b) => a - b);
  const pc = (k) => Math.round((z[k] / n) * 100);
  return { hit: pc('head') + pc('body') + pc('legs'), head: pc('head'), body: pc('body'), legs: pc('legs'), miss: pc('miss'), p50: Math.round(dev[Math.floor(n * 0.5)]), p90: Math.round(dev[Math.floor(n * 0.9)]), max: Math.round(dev[n - 1]) };
}
for (const id of ['sniper', 'barrett']) {
  for (const dist of [10, 20]) for (const online of [false, true]) {
    const a = run(id, dist, N, online), b = run(id, dist, 4000, online);
    const k = `${id} ${dist}m ${online ? 'çevrimiçi' : 'çevrimdışı'}`; out[k] = { n: a, n4000: b };
    console.log(`${k.padEnd(26)} ${N} atış: isabet %${a.hit} (kafa ${a.head} gövde ${a.body} bacak ${a.legs}) sapma p50 ${a.p50} p90 ${a.p90} cm · 4000 atış: isabet %${b.hit} (kafa ${b.head} gövde ${b.body} bacak ${b.legs}) p50 ${b.p50} p90 ${b.p90} max ${b.max} cm`);
  }
  const q = [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1].map((a) => { s.adsT = a; s.sinceShot = 5; s.vel.set(0, 0, 0); s.onGround = true; s.bloom = 0; return `${a}:${(s.spreadNow(WSTATS[id]) * 1000).toFixed(1)}`; });
  console.log(`  ${id} sapma (mrad) adsT → ${q.join(' · ')}`);
  out[id + ' adsT'] = q;
  for (const a of [0.7, 0.8, 0.9]) { const r = run(id, 20, 4000, true, a); out[`${id} 20m adsT ${a}`] = r; console.log(`  ${id} 20 m adsT ${a} (erken quickscope): isabet %${r.hit} p50 ${r.p50} cm`); }
}
// bot yolu (human / isPlayer değil): belden sapma ve dürbün eğrisi değişmemeli (12.153 değerleri)
for (const id of ['sniper', 'barrett']) {
  const h0 = s.human, p0 = s.isPlayer; s.human = false; s.isPlayer = false;
  const q = [0, 0.7, 0.9, 1].map((a) => { s.adsT = a; s.sinceShot = 5; s.vel.set(0, 0, 0); s.onGround = true; s.bloom = 0; s.botExtraSpread = 0; return `${a}:${(s.spreadNow(WSTATS[id]) * 1000).toFixed(1)}`; });
  s.human = h0; s.isPlayer = p0; out['bot ' + id] = q; console.log(`bot ${id} sapma (mrad) adsT → ${q.join(' · ')}`);
}
if (process.env.OUT) (await import('fs')).writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
process.exit(0);
