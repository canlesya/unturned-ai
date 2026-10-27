// 12.188 tank topu Monte Carlo (başsız, gerçek Kuzey arazisi): MODE=feet|body|over N=200 ERR=2 node scripts/tankmc.mjs → öldürme / ıskalama sayıları
// Monte Carlo: gerçek arazide tank ↔ düşman çifti; mermi düşmanın ayağına (± hata) nişanlanır → öldürme / hasar oranı
import { Game } from '../src/game/game.js';
import { VT, gunPose } from '../src/sim/vehicle.js';
const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 8, type: 'conquest' } }), V = g.vehicles, D = VT.tank, W = g.world, c = D.cannon;
const s = g.claimSlot('blue', 'Tankçı', 'assault', {}), h = g.humans.get(s.id);
let q = 0;
const step = (n, o = {}) => { for (let i = 0; i < n; i++) { h.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: s.yaw, pt: s.pitch, w: s.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, ...(typeof o === 'function' ? o(i) : o) }); g.step(1 / 60); } };
const t = V.list.find((x) => x.id === 'B-T1');
s.pos.set(t.st.x + 2.4, t.st.y, t.st.z); s.protT = 0; step(1, { ve: 1 }); step(1);
const reds = g.soldiers.filter((o) => o.team === 'red');
const A = g.map.playArea;
let seed = +(process.env.SEED || 11); const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const MODE = process.env.MODE || 'feet';      // feet: yere (düşmanın ayağı + hata) · body: gövdeye (doğrudan) · over: başın 0,6 m üstünden
const res = { n: 0, kill1: 0, kill2: 0, dmg0: 0, noBoom: 0, far: 0 };
const sim = (pt, yaw) => { const st = { ...t.st, gp: pt - t.st.pitch, tyaw: yaw }; const o = {}, d = {}; gunPose(st, o, d); let x = o.x, y = o.y, z = o.z, vx = d.x * c.speed, vy = d.y * c.speed, vz = d.z * c.speed; const H = 1 / 600; for (let i = 0; i < 6000; i++) { vy -= c.grav * H; x += vx * H; y += vy * H; z += vz * H; if (y < W.heightAt(x, z)) return { x, y, z, i }; } return null; };
for (let trial = 0; trial < +(process.env.N || 150); trial++) {
  const x = A.minX + 80 + rnd() * (A.maxX - A.minX - 160), z = A.minZ + 80 + rnd() * (A.maxZ - A.minZ - 160);
  const R = 40 + rnd() * 110, ang = rnd() * Math.PI * 2, tx = x + Math.cos(ang) * R, tz = z + Math.sin(ang) * R;
  if (W.waterAt?.(x, z) > W.heightAt(x, z) - 1 || W.waterAt?.(tx, tz) > W.heightAt(tx, tz) - 1) continue;
  const yaw = Math.atan2(-(tx - x), -(tz - z));
  t.st.x = x; t.st.z = z; t.st.y = W.heightAt(x, z); t.st.yaw = yaw; t.st.tyaw = yaw; t.st.vx = t.st.vy = t.st.vz = 0; t.sleep = false; t.alive = true; t.hp = D.hp;
  step(3, { yw: yaw, pt: 0 });
  // iki düşman yan yana (2,4 m)
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const e1 = reds[0], e2 = reds[1];
  for (const [e, k] of [[e1, -1.2], [e2, 1.2]]) { e.vacant = false; e.spawn({ x: tx + rx * k, z: tz + rz * k, ry: 0 }, 0); W.settle(e); e.protT = 0; e.hp = e.maxHp = 100; }
  // görüş: namludan düşmanın gövdesine açık hat yoksa atla
  const o = {}, d = {}; gunPose(t.st, o, d); const cc = e1.center();
  if (!W.clear(o, cc) || !W.clear(o, e1.eye())) continue;
  // hedef nokta
  const err = (rnd() - 0.5) * 2 * (+(process.env.ERR || 2));
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const aimX = tx + fx * err, aimZ = tz + fz * err;
  let pt;
  if (MODE === 'feet') {
    let lo = -0.12, hi = 0.32; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, p = sim(m, yaw); const dd = p ? (p.x - x) * fx + (p.z - z) * fz : 1e9; if (dd < (aimX - x) * fx + (aimZ - z) * fz) lo = m; else hi = m; }
    pt = (lo + hi) / 2;
  } else {
    const hy = MODE === 'body' ? cc.y : e1.pos.y + e1.height + 0.6;
    const hd = Math.hypot(cc.x - o.x, cc.z - o.z);
    let lo = -0.12, hi = 0.32; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; const st = { ...t.st, gp: m - t.st.pitch, tyaw: yaw }; const oo = {}, dd = {}; gunPose(st, oo, dd); const vh = Math.hypot(dd.x, dd.z) * c.speed, tf = hd / vh, y = oo.y + dd.y * c.speed * tf - 0.5 * c.grav * tf * tf; if (y < hy) lo = m; else hi = m; }
    pt = (lo + hi) / 2;
  }
  step(90, { yw: yaw, pt });
  t.rl = 0; const nE = g.netEvents.length;
  step(1, { yw: yaw, pt, fh: 1, fp: 1 });
  let ft = 0; while (V.shells.length && ft < 4) { step(1, { yw: yaw, pt }); ft += 1 / 60; }
  const b = g.netEvents.slice(nE).filter((x) => x.e === 'tsb').slice(-1)[0];
  if (process.env.V && b) {
    const p = sim(pt, yaw), L = Math.hypot(b.p[0] - o.x, b.p[1] - o.y, b.p[2] - o.z);
    const r = W.raycast(o, { x: (b.p[0] - o.x) / L, y: (b.p[1] - o.y) / L, z: (b.p[2] - o.z) / L }, 999, {});
    console.log('   simLand', p && [p.x, p.y, p.z].map((v) => v.toFixed(1)).join(','), 'boom', b.p.join(','), 'target', tx.toFixed(1), tz.toFixed(1), 'gnd', W.heightAt(tx, tz).toFixed(2), r ? (r.collider ? 'box ' + JSON.stringify([r.collider.min, r.collider.max, r.collider.tag]) : 'terrain ' + r.t.toFixed(1) + '/' + L.toFixed(1)) : 'none');
  }
  res.n++;
  if (!b) { res.noBoom++; continue; }
  const bd = Math.hypot(b.p[0] - tx, b.p[2] - tz); if (bd > 6) res.far++;
  if (!e1.alive) res.kill1++; if (!e2.alive) res.kill2++; if (e1.alive && e1.hp >= 100 && bd < 4) res.dmg0++;
  if (process.env.V) console.log(trial, 'gp', t.st.gp.toFixed(3), 'pt', pt.toFixed(3), 'hullp', t.st.pitch.toFixed(3), 'drift', Math.hypot(t.st.x-x,t.st.z-z).toFixed(2), 'tyawΔ', (t.st.tyaw-yaw).toFixed(3), 'R', R.toFixed(0), 'err', err.toFixed(1), 'boomΔ', bd.toFixed(1), 'by', (b.p[1] - W.heightAt(b.p[0], b.p[2])).toFixed(2), e1.alive ? Math.round(e1.hp) : 'X', e2.alive ? Math.round(e2.hp) : 'X');
  for (const e of [e1, e2]) if (!e.alive) e.alive = true;
}
console.log(MODE, JSON.stringify(res));
process.exit(0);
