// 12.221 deneme: RPG / C4 yönlendirmesi — botun hedefi, atış sayısı, tankın canı (çizimsiz).  C4=1 node scripts/cine2at.mjs
import { openCine } from './cinelib.mjs';
import { installScenes } from './cinescenes.mjs';
const { browser, page } = await openCine({ per: 64, tod: 'day', seed: 9 });
await page.evaluate(() => { window.CS = { used: new Set(), booms: [] }; });
await page.evaluate(installScenes);
await page.evaluate(() => { const g = window.__game, e0 = g.explode.bind(g); window.EX = []; g.explode = (pos, ...r) => { const v = window.CS.atV; if (v?.st) window.EX.push(`(${Math.round(pos.x - v.st.x)},${Math.round(pos.y - v.st.y)},${Math.round(pos.z - v.st.z)})`); return e0(pos, ...r); }; });
await page.evaluate(() => window.__game.cine.skip(40));
for (let k = 0; k < 3; k++) {
  console.log('setup', JSON.stringify(await page.evaluate(([c4, at]) => at ? window.CS.atgmSetup() : window.CS.rpgSetup(c4), [!!process.env.C4, !!process.env.AT])));
  for (let i = 0; i < 8; i++) {
    console.log(' ', await page.evaluate(() => {
      const g = window.__game, C = window.CS, s = C.atS, v = C.atV;
      for (let j = 0; j < 60; j++) { C.holdAt?.(); g.step(1 / 30); }
      const tg = s.brain?.target;
      return `t${Math.round(g.time)} s:${s.alive ? 'canlı' : 'ölü'} d${Math.round(Math.hypot(s.pos.x - v.st.x, s.pos.z - v.st.z))} hedef:${tg ? (tg.veh ? tg.veh.type + '#' + tg.veh.idx + ' koltuk' + tg.seat : tg.cls) : '-'} it:${JSON.stringify(s.items[2])} cur${s.cur} tank hp${Math.round(v.hp)} ${v.alive ? '' : 'PATLADI'} mürettebat ${v.seats.map((q) => (q ? q.cls[0] : '-')).join('')} at:${JSON.stringify(g.atStats || {})} ex:${window.EX.splice(0).join(' ')}`;
    }));
  }
}
await browser.close();
