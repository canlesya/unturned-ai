// 12.186 Doğma koruması: HER saldırı (mermi, bıçak savurması, roket / M79, el bombası, claymore) korumayı bitirir; cephane kutusu / ilk yardım bitirmez.
//   node scripts/protfire.mjs      (ağsız, doğrudan Game = sunucu yolu)
import { Game } from '../src/game/game.js';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const g = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', match: { perTeam: 2, type: 'tdm', tickets: 500 } });
const A = g.claimSlot('blue', 'Ali'); g.claimSlot('red', 'Veli'); g.brains.length = 0;
const DT = 1 / 60;
const CASES = [['m4a1', true], ['knife', true], ['rpg', true], ['m79', true], ['grenade', true], ['claymore', true], ['ammobox', false], ['medkit', false]];
for (const [id, drops] of CASES) {
  A.items[0] = { id, mag: 3, reserve: 3 }; A.cur = 0; A.switchT = 0; A.cd = 0; A.reloadT = 0; A.useT = 0; A.swing = null; A.cook = null; A.rlDoneT = 0;
  A.hp = id === 'medkit' ? 50 : A.maxHp;
  A.protT = 2;
  let fired;
  if (id === 'grenade') { A.triggerUpdate(true, 1); g.step(DT); fired = A.triggerUpdate(false, 0); }      // pim → bırak (atış)
  else fired = A.tryFire();
  check((A.protT === 0) === drops, `${id}: ${fired ? 'kullanıldı' : 'KULLANILAMADI'} → koruma ${A.protT === 0 ? 'bitti' : 'sürüyor'} (beklenen: ${drops ? 'biter' : 'sürer'})`);
  for (let i = 0; i < 90; i++) g.step(DT);
}
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK'); process.exit(fail ? 1 : 0);
