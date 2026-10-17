// Herkes-tek doğuş testi (tarayıcısız):  node scripts/ffaspawn.mjs [harita,harita…]   (SEC=180 maç süresi sn, GG=60)
// Her haritada 10 botlu dm (ve kısaca gg) oynatır, her doğuşu kaydeder: farklı nokta sayısı, çeyrek kapsamı, doğuş anında en yakın canlı rakip,
// 30 m içinden bir rakibin görmesi (botSees), geometri içi / zemin dışı doğuş, üs cezası. JSON=1 → /tmp/wb-ffa-shots/<harita>.json (ffashots.mjs çizer)
import { Game } from '../src/game/game.js';
import * as THREE from 'three';
import fs from 'node:fs';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const maps = (process.argv[2] || 'depo,liman,kasaba,colgecidi').split(',');
const SEC = +(process.env.SEC || 180), GGSEC = +(process.env.GG || 60);
const eye = new THREE.Vector3(), tgt = new THREE.Vector3();

function run(map, type, secs) {
  const g = new Game(null, { headless: true, map, diff: 'hard', match: { perTeam: 10, type, time: 0, killLimit: 999 } });
  const rec = [], pend = [];
  let zone = 0;
  g.on('spawn', (s) => {
    const others = g.soldiers.filter((e) => e !== s && e.alive);
    let dmin = 1e9, seen = false;
    tgt.set(s.pos.x, 1.4, s.pos.z);
    for (const e of others) {
      const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
      dmin = Math.min(dmin, d);
      if (d < 30 && g.botSees(e.eye(eye), tgt)) seen = true;
    }
    const r = { x: s.pos.x, z: s.pos.z, t: g.time, dmin: others.length ? dmin : 99, seen, first: g.time < 0.5 };
    rec.push(r); pend.push([s, r]);
  });
  for (let i = 0; i < secs * 30 && !g.ended; i++) {
    g.step(1 / 30);
    while (pend.length) {                                                          // yerleşmiş konum: kutu içinde / zemin dışında mı?
      const [s, r] = pend.pop();
      const list = g.world.query(s.pos.x - 1, s.pos.z - 1, s.pos.x + 1, s.pos.z + 1, []);
      r.inside = !!g.world._hits(list, s.pos.x, s.pos.y + 0.05, s.pos.z, 1.6);
      r.y = s.pos.y - g.world.heightAt(s.pos.x, s.pos.z); r.navFree = g.nav.isFree(r.x, r.z);
    }
    for (const s of g.soldiers) if (s.alive && s.zoneT > 0) zone++;
  }
  return { g, rec, zone };
}

const summary = [];
for (const map of maps) {
  for (const [type, secs] of [['dm', SEC], ['gg', GGSEC]]) {
    const { g, rec, zone } = run(map, type, secs);
    const b = g.map.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const later = rec.filter((r) => !r.first);
    const distinct = new Set(rec.map((r) => Math.round(r.x * 2) + ',' + Math.round(r.z * 2))).size;
    const quads = new Set(rec.map((r) => (r.x > cx ? 'E' : 'W') + (r.z > cz ? 'S' : 'N'))).size;
    const far = later.filter((r) => r.dmin >= 12).length / Math.max(1, later.length);
    const seen = later.filter((r) => r.seen).length / Math.max(1, later.length);
    const bad = rec.filter((r) => r.inside || !r.navFree || !(r.y > -0.5 && r.y < 0.6)).length;
    const team = [...g.map.spawns.blue, ...g.map.spawns.red];
    const inYard = rec.filter((r) => team.some((p) => Math.hypot(p.x - r.x, p.z - r.z) < 0.3)).length / Math.max(1, rec.length);
    const med = later.map((r) => r.dmin).sort((a, b) => a - b)[later.length >> 1] || 0;
    console.log(`      ${map}/${type}: havuz ${g.dmPool.length} · ${rec.length} doğuş · ${distinct} farklı nokta · çeyrek ${quads}/4 · rakip ≥12 m %${Math.round(far * 100)} (ortanca ${med.toFixed(1)} m) · 30 m'den görülen %${Math.round(seen * 100)} · takım doğuş noktası %${Math.round(inYard * 100)} · geçersiz ${bad} · üs bölgesi ${zone}`);
    summary.push({ map, type, pool: g.dmPool.length, n: rec.length, distinct, quads, far, seen, bad, zone, inYard });
    const tag = `${map}/${type}`;
    check(distinct >= 12 && quads === 4, `${tag}: ${distinct} farklı nokta, ${quads}/4 çeyrek`);
    check(far >= 0.95, `${tag}: doğuşların %${Math.round(far * 100)}'i en yakın rakipten ≥ 12 m`);
    check(seen <= 0.1, `${tag}: 30 m içinden görülen doğuş %${Math.round(seen * 100)} (≤ %10)`);
    check(bad === 0, `${tag}: geometri içi / zemin dışı doğuş yok (${bad})`);
    check(zone === 0 && !g.map.baseZones, `${tag}: üs bölgesi cezası yok`);
    check(inYard <= 0.25, `${tag}: doğuşlar takım avlularına yığılmıyor (%${Math.round(inYard * 100)})`);
    if (process.env.JSON && type === 'dm') {
      fs.mkdirSync('/tmp/wb-ffa-shots', { recursive: true });
      fs.writeFileSync(`/tmp/wb-ffa-shots/${map}.json`, JSON.stringify({ map, bounds: b, pool: g.dmPool, spawns: rec, team }));
    }
  }
}
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
