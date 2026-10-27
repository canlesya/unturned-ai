// 12.198 Çevrim içi hasar = çevrimdışı hasar (tarayıcısız): iki ham ws istemcisi (A atıcı, B hedef), sunucu BF_DEBUG=1.
// Her silah × mesafe: A, B'nin göğsüne tam nişan alıp duran ilk atışla (tek tetik) ateş eder; sunucudaki can kaybı, aynı noktalarda başsız Game'in
// (aynı stats.js) beklediği hasarla karşılaştırılır (gövde; kafa / bacak isabeti ayrı sayılır). Pompalı: saçma toplamı.
//   node scripts/netdmg.mjs   env: WS=ws://127.0.0.1:8787 MAP=kasaba W=mp5,m4a1,ak47,shotgun,pistol,m1911,revolver,svd D=8,30
import WebSocket from 'ws';
import * as THREE from 'three';
import { Game } from '../src/game/game.js';
import { WSTATS } from '../src/game/stats.js';
import { TUNE } from '../src/game/balance.js';
const WS = process.env.WS || 'ws://127.0.0.1:8787', MAP = process.env.MAP || 'kasaba';
const WEAP = (process.env.W || 'mp5,m4a1,ak47,scarh,shotgun,pistol,m1911,revolver,svd').split(','), DISTS = (process.env.D || '8,30').split(',').map(Number);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
// çevrimdışı: açık şerit bul + beklenen hasar
const g = new Game(null, { headless: true, map: MAP, match: { perTeam: 1, type: 'tdm', tickets: 500 } });
const S = g.soldiers[0], eye = new THREE.Vector3(), cen = new THREE.Vector3();
function lane(D) {
  const b = g.map.bounds;
  for (let x = b.minX + 6; x < b.maxX - 6; x += 2.5) for (let z = b.minZ + 6; z < b.maxZ - 6; z += 2.5) {
    if (!g.nav.isFree(x, z) || !g.nav.isFree(x + D, z)) continue;
    const y0 = g.world.heightAt(x, z), y1 = g.world.heightAt(x + D, z);
    if (Math.abs(y0 - y1) > 0.05) continue;
    if (!g.botSees(eye.set(x, y0 + 1.62, z), cen.set(x + D, y1 + 1.07, z)) || !g.botSees(eye.set(x, y0 + 1.62, z), cen.set(x + D, y1 + 1.7, z))) continue;
    return [x, z, x + D, z];
  }
  return null;
}
const fall = (st, d) => (d <= st.range[0] ? 1 : st.minMul + (1 - st.minMul) * Math.max(0, 1 - (d - st.range[0]) / (st.range[1] - st.range[0])));
const open = () => new Promise((res) => { const ws = new WebSocket(WS); ws.msgs = []; ws.last = null; ws.q = 0; ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'snap') ws.last = m.me.now; else ws.msgs.push(m); }); ws.on('open', () => res(ws)); });
const a = await open(), b = await open();
a.send(JSON.stringify({ t: 'create', name: 'Atici', cfg: { map: MAP, perTeam: 2, type: 'tdm', bots: false, time: 3600 } }));
await wait(1500);
const wa = a.msgs.find((m) => m.t === 'welcome');
b.send(JSON.stringify({ t: 'join', room: wa.room, name: 'Hedef' }));
await wait(800);
const wb = b.msgs.find((m) => m.t === 'welcome');
check(!!wa && !!wb, `oda ${wa?.room}: A ${wa?.id} · B ${wb?.id}`);
const dbg = (ws, o) => ws.send(JSON.stringify({ t: 'dbg', ...o }));
dbg(a, { bots: false });
const inA = { yw: 0, pt: 0, shot: false };                              // shot: tam olarak TEK girdide tetik (fp + fh) → tek atış
const ta = setInterval(() => { const f = inA.shot ? 1 : 0; inA.shot = false; a.send(JSON.stringify({ t: 'in', q: ++a.q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: inA.yw, pt: inA.pt, w: 0, fh: f, fp: f })); }, 1000 / 60);
const tb = setInterval(() => b.send(JSON.stringify({ t: 'in', q: ++b.q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 0, w: 0 })), 1000 / 60);
await wait(1500);
const rows = [];
for (const D of DISTS) {
  const L = lane(D); check(!!L, `${D} m açık şerit`); if (!L) continue;
  for (const w of WEAP) {
    const st = WSTATS[w]; let got = [], exp = null;
    for (let k = 0; k < 6; k++) {
      dbg(a, { tp: [L[0], L[1]], item: [0, w, st.mag, 0], hp: 99999 }); dbg(b, { tp: [L[2], L[3]], hp: 1000 });
      await wait(700);
      const A = a.last, B = b.last; if (!A || !B) continue;
      const ex = A.x, ey = A.y + 1.62, ez = A.z, cx = B.x, cy = B.y + 1.07, cz = B.z;
      inA.yw = Math.atan2(-(cx - ex), -(cz - ez)); inA.pt = Math.atan2(cy - ey, Math.hypot(cx - ex, cz - ez));
      await wait(500);                                                    // nişan otursun, ilk atış indirimi (0,3 sn ateşsiz)
      const hp0 = b.last.hp; inA.shot = true;
      await wait(500);
      got.push(hp0 - b.last.hp);
      const d = Math.hypot(cx - ex, cz - ez);
      exp = st.dmg * fall(st, d) * (st.pellets || 1);
    }
    got.sort((x, y) => x - y);
    const med = got[got.length >> 1];
    const body = Math.round(exp), head = Math.round(exp * TUNE.headMul), legs = Math.round(exp * TUNE.legMul);
    const ok = got.filter((v) => Math.abs(v - body) <= 1 || Math.abs(v - head) <= 1 || Math.abs(v - legs) <= 1).length;
    rows.push(`| ${st.name} | ${D} | ${body} | ${got.join(', ')} |`);
    check(st.pellets ? med > 0 && med <= body + 1 : ok >= got.length - 1, `${st.name} ${D} m: sunucu can kaybı [${got.join(', ')}] · beklenen gövde ${body} (kafa ${head}, bacak ${legs})`);
  }
}
clearInterval(ta); clearInterval(tb); a.close(); b.close();
console.log('\n| silah | m | beklenen gövde (çevrimdışı) | sunucu can kaybı (6 atış) |\n|---|---|---|---|\n' + rows.join('\n'));
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
