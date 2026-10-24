// Botlar düşüp ölüyor mu (tarayıcısız, 12.143): node scripts/fallbots.mjs [saniye=180] [harita …]
// Her haritayı kendi moduyla başsız oynatır; düşme hasarı olaylarını (game 'fall') ve "Düştü" ölümlerini sayar. Beklenen: düşme ölümü 0.
import { Game } from '../src/game/game.js';
import { MAPS } from '../src/maps/index.js';

const secs = +(process.argv[2] || 180);
const list = process.argv.slice(3).length ? process.argv.slice(3) : ['colgecidi', 'kasaba', 'vadi', 'us', 'newyork', 'depo', 'liman', 'maden', 'boyakulesi', 'ormankale'];
let bad = 0;
for (const id of list) {
  const type = process.env.TYPE || MAPS[id]?.only?.[0] || 'conquest';
  const g = new Game(null, { headless: true, map: id, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: type === 'inf' || type === 'pb' ? 12 : 8, type } });
  const falls = [];
  let deaths = 0, kills = 0;
  g.on('fall', (e) => falls.push(`${e.s.name} ${e.h.toFixed(1)} m −${e.dmg} (${e.s.pos.x.toFixed(0)},${e.s.pos.y.toFixed(1)},${e.s.pos.z.toFixed(0)})`));
  let maxH = 0, n3 = 0;
  const fc = g.fallCheck.bind(g);
  g.fallCheck = (s) => { if (s.landH > maxH) maxH = s.landH; if (s.landH > 3) n3++; return fc(s); };
  const onKill = g.onKill.bind(g);
  g.onKill = (k, v, w, hs) => { kills++; if (w === 'Düştü') deaths++; return onKill(k, v, w, hs); };
  for (let i = 0; i < secs * 30 && !g.ended; i++) g.step(1 / 30);
  console.log(`${id} (${type}) · ${secs} sn · ölüm ${kills} · düşme hasarı ${falls.length} · düşerek ölüm ${deaths} · en yüksek iniş ${maxH.toFixed(1)} m · 3 m üstü iniş ${n3}`);
  for (const f of falls.slice(0, 6)) console.log('   ' + f);
  if (deaths) bad++;
  g.dispose?.();
}
console.log(bad ? 'sonuç: HATA (botlar düşüp ölüyor)' : 'sonuç: OK');
process.exit(bad ? 1 : 0);
