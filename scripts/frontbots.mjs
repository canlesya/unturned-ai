// Cephe Hattı bot maçları (12.161; başsız, tam maç):  node scripts/frontbots.mjs [maç=10] [NvN=12] [zorluk=normal] [süre sn=1500]
// Çıktı: kazanan dağılımı (Mavi / Kırmızı), kazanma biçimi (karargâh / bilet / süre), cephe değişim sayısı (etkin nokta kaç kez kaydı), etkin noktanın
// zincirde gezdiği aralık, maç süresi, bilet, öldürme, mevzide / ayakta oranı, noktaya yakınlık, takılma (5 sn'de 0,5 m'den az ilerleyen hedefli bot),
// botların siper duvarına girmesi (gövde yarıçapı içinde dizden yüksek arazi; hedef 0). TUNE_x= / LIM_x= ortam değişkeniyle deneme (ör. TUNE_frCapMul=0.5).
import { MapBuilder } from '../src/maps/builder.js';
import { Game } from '../src/game/game.js';
import { TUNE, LIMITS } from '../src/game/balance.js';
import { R } from '../src/game/collision.js';
import { WSTATS } from '../src/game/stats.js';
MapBuilder.noVisual = true;
for (const [k, v] of Object.entries(process.env)) { if (k.startsWith('TUNE_')) TUNE[k.slice(5)] = +v; if (k.startsWith('LIM_')) LIMITS[k.slice(4)] = +v; if (k.startsWith('W_')) { const [id, f] = k.slice(2).split('__'); WSTATS[id][f] = +v; } }   // W_ww_smgr__dmg=24
const N = +(process.argv[2] || 10), PT = +(process.argv[3] || 12), DIFF = process.argv[4] || 'normal', TL = +(process.argv[5] || 1500);
const res = [], STK = new Map();
const t0 = performance.now();
for (let m = 0; m < N; m++) {
  const g = new Game(null, { headless: true, map: 'cephe', diff: DIFF, match: { perTeam: PT, type: 'front', time: TL } });
  const F = g.front, T = g.map.terrain;
  const st = { post: 0, postUp: 0, alive: 0, near: 0, stuck: 0, botT: 0, kills: { blue: 0, red: 0 }, wall: 0, wallN: 0, aMin: F.a, aMax: F.a, path: [F.a], at: new Array(F.n).fill(0) };
  const last = new Map();
  const origKill = g.onKill.bind(g);
  g.onKill = (k, v, w, hs) => { if (k && k !== v) st.kills[k.team]++; return origKill(k, v, w, hs); };
  let steps = 0, a0 = F.a;
  while (!g.ended && steps < (TL + 30) * 60) {
    g.step(1 / 60); steps++;
    if (F.a !== a0) { a0 = F.a; st.path.push(F.a); st.aMin = Math.min(st.aMin, F.a); st.aMax = Math.max(st.aMax, F.a); }
    if (steps % 60 === 0) {
      st.at[F.a]++;
      const o = F.active;
      for (const b of g.brains) {
        const s = b.s; if (!s.alive) continue;
        st.alive++;
        if (b.frAt && Math.hypot(b.frAt.x - s.pos.x, b.frAt.z - s.pos.z) < 1.5) { st.post++; if (!s.crouching) st.postUp++; }
        if (Math.hypot(o.x - s.pos.x, o.z - s.pos.z) < o.r + 6) st.near++;
        // siper duvarına girme: gövde yarıçapında (8 yön) dizden (ayak + 0,6) yüksek arazi
        st.wallN++;
        for (let q = 0; q < 8; q++) { const x = s.pos.x + Math.cos(q * 0.785) * (R - 0.03), z = s.pos.z + Math.sin(q * 0.785) * (R - 0.03); if (T.heightAt(x, z) > s.pos.y + 0.62) { st.wall++; break; } }
        if (steps % 300 === 0 && b.goal) {
          const L = last.get(s);
          if (L && Math.hypot(L.x - s.pos.x, L.z - s.pos.z) < 0.5 && Math.hypot(b.goal.x - s.pos.x, b.goal.z - s.pos.z) > 3 && !b.frAt && !b.target) { st.stuck++; const k = `${Math.round(s.pos.x / 4) * 4},${Math.round(s.pos.z / 4) * 4} ${s.team[0]} ${b.frRole}`; STK.set(k, (STK.get(k) || 0) + 1); }
          st.botT++;
          last.set(s, { x: s.pos.x, z: s.pos.z });
        }
      }
    }
  }
  const why = F.done ? 'karargâh' : g.tickets.blue <= 0 || g.tickets.red <= 0 ? 'bilet' : 'süre';
  res.push({ w: g.winner || '-', why, sh: F.shifts, t: Math.round(g.time), tk: [Math.round(g.tickets.blue), Math.round(g.tickets.red)], k: st.kills, path: st.path, at: st.at,
    post: st.post / Math.max(1, st.alive), up: st.postUp / Math.max(1, st.post), near: st.near / Math.max(1, st.alive), stuck: st.stuck / Math.max(1, st.botT), wall: st.wall, wallN: st.wallN, own: [F.owned('blue'), F.owned('red')] });
  const r = res[res.length - 1];
  console.log(`maç ${m + 1}: ${r.w === 'blue' ? 'MAVİ' : r.w === 'red' ? 'KIRMIZI' : r.w} (${r.why}) · ${(r.t / 60).toFixed(1)} dk · cephe ${r.sh} kez kaydı, yol ${r.path.join('→')} · nokta ${r.own.join('-')} · bilet ${r.tk.join(' / ')} · öldürme M ${r.k.blue} K ${r.k.red} · mevzide %${(r.post * 100).toFixed(0)} (ayakta %${(r.up * 100).toFixed(0)}) · noktada %${(r.near * 100).toFixed(0)} · takılma %${(r.stuck * 100).toFixed(1)} · duvara giren ${r.wall}/${r.wallN} · etkin nokta süresi (sn) ${r.at.join(' ')}`);
}
const bw = res.filter((r) => r.w === 'blue').length;
const avg = (f) => res.reduce((a, r) => a + f(r), 0) / N;
const whys = ['karargâh', 'bilet', 'süre'].map((k) => `${k} ${res.filter((r) => r.why === k).length}`).join(' · ');
console.log(`\nÖZET ${N} maç ${PT}v${PT} ${DIFF}: Mavi ${bw} / Kırmızı ${N - bw} (%${(bw / N * 100).toFixed(0)} Mavi) · ${whys} · cephe değişimi ort. ${avg((r) => r.sh).toFixed(1)} (en az ${Math.min(...res.map((r) => r.sh))}, en çok ${Math.max(...res.map((r) => r.sh))}) · maç ort. ${(avg((r) => r.t) / 60).toFixed(1)} dk (${(Math.min(...res.map((r) => r.t)) / 60).toFixed(1)}–${(Math.max(...res.map((r) => r.t)) / 60).toFixed(1)}) · takılma %${(avg((r) => r.stuck) * 100).toFixed(2)} · duvara giren ${res.reduce((a, r) => a + r.wall, 0)} / ${res.reduce((a, r) => a + r.wallN, 0)} · gerçek ${(performance.now() - t0) / 1000 | 0} sn`);
console.log('takılma yerleri:', [...STK].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}×${v}`).join(' | '));
