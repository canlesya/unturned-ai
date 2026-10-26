import { UK } from '../common/us-surface.js';
import { PAL, TEAM, LAMP_WARM } from '../common/us-kit.js';
import { tWall, hesco, sandbags, mgNest, crate, barrels, fireBarrel, lampPost, floodLight, bollardLight, flagPole, camoNet, ammoBox } from '../common/us-props.js';
import { tent } from '../common/us-structures.js';
import { humvee, ambulance } from '../common/us-vehicles.js';
import { ITEMS } from '../common/us-furniture.js';

// Askeri Üs v3 — takım kampı (Mavi yerel çerçevesi: x −80 … −56, z ±24; Kırmızı = 180° döndürülmüş). 5,4 m beton duvar, 5 kapı (doğu 6,0 / ±15'te 3,2, kuzey-güney 3,2),
// kapı önünde T-duvar şikanı (kamp içi dışarıdan görünmez), batı duvarı boyunca çadır sırası, avluda siper / araç / ikmal.
export const CAMP = { x0: -80, x1: -55.6, z0: -24.4, z1: 24.4 };
export function camp(K, team) {
  const T = TEAM[team], WH = 5.4, t = 0.8, nm = team === 'blue' ? 'Mavi' : 'Kırmızı';
  const gate = (at, w) => ({ at, w, b: 0, top: 3.6, frame: { col: '#3d4248', kind: UK.STEEL, jw: 0.4, out: 0.15 } });
  const bands = [{ y0: 0, y1: 0.6, col: PAL.concD, kind: UK.CONC }, { y0: 4.0, y1: 4.45, col: T.c, kind: UK.PAINT }];
  K.wall('z', -23.6, 23.6, -56, 0, WH, t, PAL.conc, UK.CONC, [gate(0, 6.8), gate(-15, 4.0), gate(15, 4.0)], bands);
  for (const sz of [-1, 1]) K.wall('x', -80, -55.6, sz * 24, 0, WH, t, PAL.conc, UK.CONC, [gate(-67, 4.0)], bands);
  // başlık (duvar üstü, 8 cm taşar; köşede tek birleşim)
  for (const sz of [-1, 1]) K.sr(-80, -55.52, WH, WH + 0.15, sz * 24 - 0.48, sz * 24 + 0.48, PAL.concL, UK.CONC);
  K.sr(-56.48, -55.52, WH, WH + 0.15, -23.52, 23.52, PAL.concL, UK.CONC);
  // kapı lambaları (dikme yüzünde) + tabelalar
  for (const z of [0, -15, 15]) { const hw = z ? 2.0 : 3.4; for (const sd of [-1, 1]) { K.lit(-55.435, 3.0, z + sd * (hw - 0.2), 0.03, 0.22, 0.16); K.lit(-56.565, 3.0, z + sd * (hw - 0.2), 0.03, 0.22, 0.16); } K.lamp(-54.2, 2.6, z, 9, 1.0); K.lamp(-58, 2.6, z, 8, 0.9); }
  for (const sz of [-1, 1]) { K.lamp(-67, 2.6, sz * 25.8, 8, 0.9); K.lamp(-67, 2.6, sz * 22, 8, 0.9); }
  K.sign(team === 'blue' ? 'MAVİ ÜS' : 'KIZIL ÜS', 5.2, 0.9, -55.57, 4.9, 0, Math.PI / 2, '#ffffff', T.c);
  K.sign(team === 'blue' ? 'MAVİ ÜS' : 'KIZIL ÜS', 4.6, 0.8, -56.43, 4.9, 0, -Math.PI / 2, '#ffffff', T.c);
  for (const z of [-15, 15]) K.sign(z < 0 ? 'KAPI 2' : 'KAPI 3', 1.8, 0.45, -55.57, 4.9, z, Math.PI / 2, '#20242a', '#e2b52c');
  for (const sz of [-1, 1]) K.sign(sz < 0 ? 'KAPI 4' : 'KAPI 5', 1.8, 0.45, -67, 4.9, sz * 24.43, sz < 0 ? Math.PI : 0, '#20242a', '#e2b52c');
  // kapı önü şikanı (dışarıda): doğu x −52,8 (orta 14,4 m, yanlar 12 m; aralarda 1,9 m geçit), kuzey / güney z ±28,4
  tWall(K, -52.8, 0, 12, Math.PI / 2, 3.7, PAL.twall, T.c);
  for (const sz of [-1, 1]) { tWall(K, -52.8, sz * 15.5, 10, Math.PI / 2, 3.7, PAL.twall, T.c); tWall(K, -67, sz * 28.4, 11, 0, 3.7, PAL.twall, T.c); }
  // iç perde (ana kapı arkası, göğüs hizası)
  for (const sz of [-1, 1]) hesco(K, -59.5, sz * 6.6, 4, Math.PI / 2, 2.1);           // iç perde (ana kapı arkası, iki katlı hesco): şikan aralığından kapıya çapraz bakış avluya uzanmaz
  // çadır sırası (batı duvarından 1 m içeride, kapılar doğuya)
  const kinds = [[-19.5, 'medical'], [-13, 'barracks'], [-6.5, 'radio'], [0, 'ops'], [6.5, 'armory'], [13, 'barracks'], [19.5, 'generator']];
  for (const [z, kind] of kinds) tent(K, kind === 'ops' ? -76.6 : -76.7, z, Math.PI / 2, { w: kind === 'ops' ? 5.6 : 5.0, d: kind === 'ops' ? 5.0 : 4.6, col: kind === 'ops' ? T.cmd : T.tent, ridge: [-19.5, 0, 19.5].includes(z) ? T.c : null, kind, big: kind === 'ops' });
  K.d(-76.7, 0.65, -22.015, 0.8, 0.8, 0.03, '#f2f2ee', UK.PAINT);                          // revir işareti (çadırın kuzey yüzünde): beyaz levha + kızıl haç
  K.d(-76.7, 0.95, -22.045, 0.6, 0.2, 0.03, PAL.red, UK.PAINT); K.d(-76.7, 1.15, -22.045, 0.2, 0.2, 0.03, PAL.red, UK.PAINT); K.d(-76.7, 0.75, -22.045, 0.2, 0.2, 0.03, PAL.red, UK.PAINT);
  flagPole(K, -64.5, 9, T.c);
  // avlu siperleri / ikmal
  mgNest(K, -61.5, -10.5, 0); mgNest(K, -61.5, 10.5, 0);
  for (const sz of [-1, 1]) { sandbags(K, -66, sz * 17.5, 4, 0); hesco(K, -68, sz * 4.6, 3, 0); }
  crate(K, -71, -11, 1.1); crate(K, -71, -9.6, 1.0); ammoBox(K, -69.4, -11, 0);
  crate(K, -71, 11, 1.1); ammoBox(K, -69.6, 11.2, Math.PI / 2);
  barrels(K, -71.4, 21.0, undefined, [PAL.olive, PAL.olive, PAL.red]);
  humvee(K, -61.5, -20.6, 0, PAL.olive); camoNet(K, -61.5, -20.6, 7, 5, 3.2);
  ambulance(K, -63.5, 20.5, Math.PI); camoNet(K, -63.2, 20.5, 8, 5, 3.4);
  K.b.with(-68.5, 0, -15.8, 0, () => ITEMS.table.f(K)); K.b.with(-68.5, 0, -14.95, Math.PI, () => ITEMS.bench.f(K)); K.b.with(-68.5, 0, -16.65, 0, () => ITEMS.bench.f(K));
  // ışık
  for (const [x, z, ry] of [[-65, -13, Math.PI], [-65, 13, Math.PI], [-72.6, -8.9, 0], [-72.6, 8.9, 0]]) lampPost(K, x, z, ry);
  for (const z of [-3.25, 3.25, -16.25, 16.25]) fireBarrel(K, -70.6, z);
  for (const [x, z] of [[-64, -2], [-64, 2], [-70, -2], [-70, 2]]) bollardLight(K, x, z);
  for (const z of [-8.5, 8.5]) floodLight(K, -56.4, 3.4, z, Math.PI);
  for (const sz of [-1, 1]) { floodLight(K, -73, 3.4, sz * 23.6, sz < 0 ? -Math.PI / 2 : Math.PI / 2); floodLight(K, -57.6, 3.4, sz * 23.6, sz < 0 ? -Math.PI / 2 : Math.PI / 2); }
  K.co(nm + ' Kamp', -67, 0, true); K.co(nm + ' Ana Kapı', -53, 0); K.co(nm + ' Çadırlar', -76, 0);
  K.co(nm + ' Kuzey Kapı', -67, -27); K.co(nm + ' Güney Kapı', -67, 27);
}
export const CAMP_SPAWNS = [[-65.5, 0], [-72.5, -19], [-72.5, 19], [-63.5, -15.2], [-63.5, 15.2], [-70.5, 7.5], [-72.5, -6], [-63.5, -7], [-63.5, 7], [-68.5, -12.5], [-72.5, 1], [-67.5, 14.5],
  [-66.5, -19], [-60.5, -2], [-60.5, 3], [-72.5, 14], [-70.5, -6.5], [-65.5, 11], [-62.5, 17], [-68.5, 1.5], [-67.5, -8], [-64.5, -10.5], [-72.5, -14], [-61, -17]];
export { LAMP_WARM };
