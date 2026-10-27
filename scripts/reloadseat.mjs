// 12.195 Mermi sayacı şarjörün OTURDUĞU anda dolar (reloadPlan seat), sunucu Game'inde (= istemci / çevrimdışı aynı kod):
//   her silah × boş / taktik: oturmadan önce şarjör eski, oturma adımında dolu (±1 adım), reload süresi değişmedi, oturmadan sonra silah değişirse dolu kalır,
//   oturmadan önce değişirse eski kalır. node scripts/reloadseat.mjs
import { Game } from '../src/game/game.js';
import { WSTATS } from '../src/game/stats.js';
import { reloadMode, reloadSeatK } from '../src/game/reloadPlan.js';
const g = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', match: { perTeam: 2, type: 'tdm', tickets: 500 } });
const A = g.claimSlot('blue', 'Ali'), h = g.humans.get(A.id);
g.brains.length = 0;
const DT = 1 / 60; let q = 0;
const tick = (extra = {}) => { h.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 1.2, c: 0, p: 0, u: 0, w: A.cur, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, vt: null, ...extra }); g.step(DT); A.hp = A.maxHp; };
for (let i = 0; i < 140; i++) tick();
const bad = []; let n = 0;
for (const [id, st] of Object.entries(WSTATS)) {
  if (st.kind !== 'gun' && st.kind !== 'launcher') continue;
  const mode = reloadMode(id, st); if (mode === 'shell') continue;
  const idx = st.kind === 'launcher' ? 2 : 0;
  for (const empty of st.mag <= 1 ? [true] : [true, false]) {
    for (const sw of ['yok', 'önce', 'sonra']) {
      n++;
      A.alive = true; A.protT = 0; A.items[idx] = { id, mag: empty ? 0 : 1, reserve: 0 }; A.cur = idx; A.reloadT = 0; A.rlDoneT = 0; A.cd = 0; A.switchT = 0; A.swing = null; A.useT = 0;      // hazırlıkta yedek 0: otomatik reload sayaçtan önce başlamasın
      for (let i = 0; i < 3; i++) tick({ w: idx });
      A.items[idx].reserve = 200; A.rlDoneT = 0; A.startReload();
      const tot = A.reloadTotal, kS = reloadSeatK(mode, empty), m0 = A.item.mag;
      let seatT = -1, t = 0, endT = -1;
      const other = idx === 0 ? 1 : 0;
      for (; t < 600; t++) {
        const el = tot - A.reloadT;
        if (sw === 'önce' && el >= tot * kS - 0.1) { tick({ w: other }); break; }
        if (sw === 'sonra' && seatT >= 0 && el >= tot * kS + 0.05) { tick({ w: other }); break; }
        tick({ w: idx });
        if (seatT < 0 && A.items[idx].mag > m0) seatT = (t + 1) * DT;
        if (A.reloadT <= 0) { endT = (t + 1) * DT; break; }
      }
      const it = A.items[idx], err = [];
      if (sw === 'yok') {
        if (Math.abs(seatT - tot * kS) > 1.5 * DT + 1e-6) err.push(`dolma ${seatT.toFixed(3)} sn, beklenen ${(tot * kS).toFixed(3)}`);
        if (Math.abs(endT - tot) > 1.5 * DT + 1e-6) err.push(`bitiş ${endT.toFixed(3)} ≠ ${tot.toFixed(3)}`);
        if (it.mag !== st.mag) err.push(`şarjör ${it.mag}`);
      }
      if (sw === 'önce' && it.mag !== m0) err.push(`oturmadan önce değişince ${it.mag} (eski ${m0})`);
      if (sw === 'sonra' && it.mag !== st.mag) err.push(`oturduktan sonra değişince ${it.mag}`);
      if (err.length) bad.push(`${id}${empty ? '' : '-T'}/${sw}: ${err.join(', ')}`);
      if (sw === 'yok') console.log(`${err.length ? '✗' : '✓'} ${id.padEnd(10)} ${mode.padEnd(6)} ${empty ? 'boş ' : 'takt'} süre ${tot.toFixed(2)} · dolma ${seatT.toFixed(2)} sn (k ${kS})`);
      for (let i = 0; i < 20; i++) tick({ w: idx });
    }
  }
}
console.log(`\n${n - bad.length}/${n} uygun${bad.length ? '\n' + bad.join('\n') : ''}`);
process.exit(bad.length ? 1 : 0);
