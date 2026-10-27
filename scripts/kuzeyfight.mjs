// 12.189 Büyük harita çatışma akışı ölçümü (başsız): node scripts/kuzeyfight.mjs [harita=kuzey] [NvN=10] [saniye=240] [tekrar=1] [zorluk=normal]
// Ölçer: öldürme / dk (toplam + bot başına), bayrak değişimi, ilk temas (bir botun ilk hedef bulduğu an) + ilk öldürme, en yakın düşmana
// uzaklık (2 sn'de bir, canlı askerlerin medyanı), 100 m içinde düşmanı olan asker oranı, bilet durumu, araç kullanımı (bot sürücü süresi /
// yolu, araçtan öldürme, araç patlaması). JSON çıktı: OUT=dosya.json
import { Game } from '../src/game/game.js';
import { MAPS } from '../src/maps/index.js';
import fs from 'node:fs';

const map = process.argv[2] || 'kuzey';
const per = +(process.argv[3] || 10);
const secs = +(process.argv[4] || 240);
const reps = +(process.argv[5] || 1);
const diff = process.argv[6] || 'normal';
const type = process.env.TYPE || MAPS[map]?.only?.[0] || 'conquest';
const med = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

const runs = [];
for (let r = 0; r < reps; r++) {
  const game = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff, match: { perTeam: per, type } });
  let flags = 0, kills = 0, firstKill = -1, firstContact = -1, vehKills = 0, vehBooms = 0, errors = 0;
  game.on('flag', () => flags++);
  game.on('vehboom', (e) => { if (!e.quiet) vehBooms++; });
  const S = game.soldiers;
  const kills0 = () => S.reduce((a, s) => a + s.kills, 0);
  const near = [], in100 = [], drive = new Map(), drv = { t: 0, d: 0, tank: 0, jeep: 0, heli: 0, heliAir: 0, pass: 0, cannon: 0 };
  const lastPos = new Map();
  const dt = 1 / 30;
  let steps = 0, prevK = 0;
  const vkBy = new Set();
  const ok0 = game.onKill.bind(game), kd = [];
  game.onKill = (killer, victim, w, hs) => { if (killer && killer !== victim) { if (killer.veh) vehKills++; kd.push(Math.hypot(killer.pos.x - victim.pos.x, killer.pos.z - victim.pos.z)); } return ok0(killer, victim, w, hs); };
  let stepMs = 0;
  try {
    for (; steps < secs * 30 && !game.ended; steps++) {
      const ts = performance.now();
      game.step(dt);
      stepMs += performance.now() - ts;
      const t = steps * dt;
      if (firstContact < 0 && game.brains.some((b) => b.target)) firstContact = t;
      const k = kills0();
      if (k > prevK && firstKill < 0) firstKill = t;
      prevK = k;
      if (steps % 15 === 0 && game.vehicles) {
        for (const v of game.vehicles.list) {
          const d = v.seats[0];
          if (!v.alive || !d || !d.brain) continue;
          drv.t += 0.5; if (v.def.heli) { drv.heli += 0.5; if (v.st.air) drv.heliAir += 0.5; } else if (v.def.cannon) drv.tank += 0.5; else drv.jeep += 0.5;
          const lp = lastPos.get(v); if (lp) drv.d += Math.hypot(v.st.x - lp[0], v.st.z - lp[1]);
          lastPos.set(v, [v.st.x, v.st.z]);
          drv.pass += v.seats.filter((o, i) => i > 0 && o).length * 0.5;
        }
      }
      if (steps % 60 === 0) {
        const alive = S.filter((s) => s.alive);
        const ds = [];
        let n100 = 0;
        for (const s of alive) {
          let m = 1e9;
          for (const e of alive) if (e.team !== s.team) m = Math.min(m, Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z));
          if (m < 1e8) ds.push(m);
          if (m < 100) n100++;
        }
        near.push(med(ds)); in100.push(alive.length ? n100 / alive.length : 0);
      }
    }
  } catch (e) { errors++; console.log('HATA:', e.stack); }
  kills = kills0();
  const T = steps * dt;
  const bad = S.filter((s) => !Number.isFinite(s.pos.x + s.pos.y + s.pos.z) || s.pos.y < -5).length;
  const res = {
    map: game.map.name, per, secs: +T.toFixed(0), ended: game.ended ? `${game.winner} (${game.endReason})` : '-',
    kills, kpm: +(kills / (T / 60)).toFixed(1), kpmBot: +(kills / (T / 60) / (2 * per)).toFixed(3), flags,
    firstContact: +firstContact.toFixed(1), firstKill: +firstKill.toFixed(1),
    nearMed: Math.round(med(near)), killDist: Math.round(med(kd)), in100: +(in100.reduce((a, b) => a + b, 0) / Math.max(1, in100.length)).toFixed(2),
    tickets: { blue: Math.round(game.tickets.blue), red: Math.round(game.tickets.red) },
    owners: game.mode.objectives.map((o) => `${o.id}:${o.owner ? o.owner[0] : '-'}`).join(' '),
    veh: { botDriveS: drv.t, jeepS: drv.jeep, tankS: drv.tank, heliS: drv.heli, heliAirS: drv.heliAir, km: +(drv.d / 1000).toFixed(2), passengerS: drv.pass, vehKills, vehBooms },
    vb: game.vbStats ? { ...game.vbStats, planMs: +(game.vbStats.planMs / Math.max(1, game.vbStats.plans)).toFixed(1), planMax: +game.vbStats.planMax.toFixed(1) } : null, vnavMs: game._vnav ? +game._vnav.ms.toFixed(0) : 0,
    bad, errors, stepMs: +(stepMs / Math.max(1, steps)).toFixed(3),
  };
  runs.push(res);
  console.log(JSON.stringify(res));
  game.dispose?.();
}
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(runs, null, 1));
const avg = (f) => +(runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(2);
console.log(`ORTALAMA ${map} ${per}v${per} ${secs}s ×${reps}: öldürme/dk ${avg((r) => r.kpm)} · bot başı ${avg((r) => r.kpmBot)} · bayrak ${avg((r) => r.flags)} · ilk temas ${avg((r) => r.firstContact)} s · ilk öldürme ${avg((r) => r.firstKill)} s · en yakın düşman medyan ${avg((r) => r.nearMed)} m · 100 m içinde ${avg((r) => r.in100)} · bot sürüş ${avg((r) => r.veh.botDriveS)} s · araçtan öldürme ${avg((r) => r.veh.vehKills)}`);
process.exit(runs.some((r) => r.errors || r.bad) ? 1 : 0);
