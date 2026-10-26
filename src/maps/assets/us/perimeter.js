import { UK } from '../common/us-surface.js';
import { PAL } from '../common/us-kit.js';
import { floodLight, lampPost, chainFence } from '../common/us-props.js';
import { guardTower } from '../common/us-structures.js';

// Askeri Üs v3 — çevre duvarı (iç yüz x = ±80, z = ±60; 4,5 m, 1,0 m kalın, 8 m'de bir iç dikme, başlık, üstte jiletli tel) + köşe kuleleri + dış çevre (yol, çit, orman, dağ)
export const WALL_H = 4.5;
const T = 1.0;
// dikme atlanacak yerler (duvara yaslı yapılar): [eksen, a0, a1, duvar] — duvar: 'n' | 's' | 'w' | 'e'
export function perimeter(K, skip = []) {
  const H = WALL_H, cap = 0.2, ov = 0.15;
  K.sr(-81, 81, 0, H, -61, -60, PAL.conc, UK.CONC); K.sr(-81, 81, 0, H, 60, 61, PAL.conc, UK.CONC);
  K.sr(-81, -80, 0, H, -60, 60, PAL.conc, UK.CONC); K.sr(80, 81, 0, H, -60, 60, PAL.conc, UK.CONC);
  // başlık: yalnız dışa taşar (iç yüz düz: duvara yaslı kamp duvarı / hangar başlığı delmez)
  K.sr(-81 - ov, 81 + ov, H, H + cap, -61 - ov, -60, PAL.concD, UK.CONC); K.sr(-81 - ov, 81 + ov, H, H + cap, 60, 61 + ov, PAL.concD, UK.CONC);
  K.sr(-81 - ov, -80, H, H + cap, -60, 60, PAL.concD, UK.CONC); K.sr(80, 81 + ov, H, H + cap, -60, 60, PAL.concD, UK.CONC);
  const sk = (wall, a) => skip.some(([w, a0, a1]) => w === wall && a > a0 - 0.6 && a < a1 + 0.6);
  // iç dikmeler (başlık çıkıntısının altında biter) + bazılarında projektör
  for (let x = -76; x <= 76; x += 8) for (const [wall, z0, z1, ry] of [['n', -60, -59.7, -Math.PI / 2], ['s', 59.7, 60, Math.PI / 2]]) {
    if (sk(wall, x)) continue;
    K.sr(x - 0.3, x + 0.3, 0, H, z0, z1, PAL.concD, UK.CONC);
    if ((x + 76) % 16 === 8) floodLight(K, x, H - 0.2, wall === 'n' ? -59.7 : 59.7, ry);
  }
  for (let z = -52; z <= 52; z += 8) for (const [wall, x0, x1, ry] of [['w', -80, -79.7, 0], ['e', 79.7, 80, Math.PI]]) {
    if (sk(wall, z)) continue;
    K.sr(x0, x1, 0, H, z - 0.3, z + 0.3, PAL.concD, UK.CONC);
    if ((z + 52) % 16 === 8) floodLight(K, wall === 'w' ? -79.7 : 79.7, H - 0.2, z, ry);
  }
  // jiletli tel (başlık üstünde, çizgi): iki tel + çapraz halkalar
  for (const [x0, z0, x1, z1] of [[-81, -60.5, 81, -60.5], [-81, 60.5, 81, 60.5], [-80.5, -60, -80.5, 60], [80.5, -60, 80.5, 60]]) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 0.5), y = H + cap;
    K.wire([[x0, y + 0.25, z0], [x1, y + 0.25, z1], [x0, y + 0.55, z0], [x1, y + 0.55, z1]]);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, o = i % 2 ? 0.18 : -0.18, ax = x1 !== x0;
      K.wire([[ax ? x : x + o, y + 0.05, ax ? z + o : z], [ax ? x : x - o, y + 0.6, ax ? z - o : z]]); }
  }
  // köşe kuleleri (2 katlı, duvardan 2,5 m içeride; pencereler eğilerek bile geçilmez → çevre duvarına sızılmaz)
  for (const [x, z, ry] of [[-75, -55, 0], [75, -55, 0], [-75, 55, Math.PI], [75, 55, Math.PI]]) guardTower(K, x, z, ry, { s: 5, door: (x < 0) === (ry === 0) ? 'e' : 'w' });
}

// sınır dışı (çarpışmasız; kurulumdan sonra çarpışmaları atılır): dış yol, güvenlik çiti, lambalar, nöbet kulübeleri, orman (örnekli), dağ silüeti
export function outside(K, rng) {
  for (const z of [-64.5, 64.5]) chainFence(K, -86, z, 86, z, { h: 2.4, razor: true });
  for (const x of [-86, 86]) chainFence(K, x, -64.45, x, 64.45, { h: 2.4, razor: true });
  for (let x = -60; x <= 60; x += 40) { lampPost(K, x, -68.2, Math.PI / 2); lampPost(K, x, 68.2, -Math.PI / 2); }
  for (const z of [-40, 0, 40]) { lampPost(K, -89.2, z, 0); lampPost(K, 89.2, z, Math.PI); }
  for (const s of [-1, 1]) {                                                               // dış kapı nöbet kulübesi
    K.s(s * 92, 0, -9, 3, 2.6, 3, '#7d8a7a', UK.BLOCK); K.s(s * 92, 2.6, -9, 3.4, 0.2, 3.4, PAL.roof, UK.ROOF);
    K.d(s * 92 + (s < 0 ? 1.52 : -1.52), 1.2, -9, 0.04, 0.8, 2.0, '#2c3d49', UK.GLASS);
  }
  const peak = ['#53624f', '#485544', '#5d6a57', '#4d5c4c'];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + rng() * 0.2, R = 175 + rng() * 75, sc = 34 + rng() * 28;
    K.b.withKind(UK.GRASS, () => K.b.ico(Math.cos(a) * R * 1.3, -8, Math.sin(a) * R * 0.95, sc, peak[i % 4], { scale: [1.5, 0.7 + rng() * 0.45, 1.1], detail: 1, ry: rng() * 3 }));
  }
  for (let x = -100; x <= 100; x += 7) for (const z of [-80, 80]) K.tree(x + (rng() - 0.5) * 3, z + (rng() - 0.5) * 3, 1.0 + rng() * 0.7);
  for (let z = -74; z <= 74; z += 7) for (const x of [-103, 103]) K.tree(x + (rng() - 0.5) * 3, z + (rng() - 0.5) * 3, 1.0 + rng() * 0.7);
  for (let i = 0; i < 300; i++) {
    const a = rng() * Math.PI * 2, R = 95 + rng() * 85, x = Math.cos(a) * R * 1.12, z = Math.sin(a) * R * 0.9;
    if (Math.abs(x) < 100 && Math.abs(z) < 78) continue;
    K.tree(x, z, 0.9 + rng() * 1.0);
  }
}
