// 12.217 sinema yönetmeni hata ayıklama: maçı ileri sarıp bayrak / araç / keskin nişancı durumlarını döker.
import { openCine } from './cinelib.mjs';
const { browser, page } = await openCine({ per: +(process.env.PER || 128), tod: 'sunset', seed: 1217 });
for (let k = 0; k < 6; k++) {
  await page.evaluate(() => window.__game.cine.skip(20));
  console.log(await page.evaluate(() => {
    const g = window.__game, V = g.vehicles.list;
    const objs = g.mode.objectives.map((o) => `${o.name}:${o.owner || '-'} p${(+o.p).toFixed(2)} b${o.nb} r${o.nr} rate${g.capRate(o).toFixed(3)}`).join(' | ');
    const veh = V.filter((v) => v.alive && !v.def.fixed && v.seats[0]).map((v) => `${v.type}${v.st.air ? '^' : ''} hp${Math.round(v.hp / v.def.hp * 100)} hit${Math.round(g.time - v.lastHitT)}`).join(' ');
    const sn = g.soldiers.filter((s) => s.alive && s.cls === 'sniper').map((s) => `${s.id}:${(s.pos.y - g.world.heightAt(s.pos.x, s.pos.z)).toFixed(1)}${s.brain?.target ? '*' : ''}`).join(' ');
    return `t${Math.round(g.time)}\n  ${objs}\n  ${veh}\n  sn ${sn}\n  booms ${g.cine.booms.length}`;
  }));
}
await browser.close();
