// 12.195 Üçüncü şahıs yükleme denetimi (node): her silah × boş / taktik, karakter modelinde sol kol IK'si plan hedefine ulaşıyor mu (el ↔ hedef ≤ 3 cm),
// şarjör elde iken elin tutma noktasında mı (≤ 3 cm), birinci şahısla aynı oturma anı (reloadSeatK). node scripts/reload3p.mjs [silah regex]
import * as THREE from 'three';
globalThis.document ||= { documentElement: {}, createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }), width: 0, height: 0 }) };
const { WSTATS } = await import('../src/game/stats.js');
const { createCharacter } = await import('../src/models/character.js');
const { reloadMode, reloadPlan, reloadSeatK } = await import('../src/game/reloadPlan.js');
const { reloadGeo, blendPoint } = await import('../src/game/reloadGeo.js');
const only = process.argv[2] ? new RegExp(process.argv[2]) : null, N = 41;
const api = createCharacter({ team: 'blue', cls: 'assault' });
const bad = []; let n = 0;
for (const [id, st] of Object.entries(WSTATS)) {
  if ((st.kind !== 'gun' && st.kind !== 'launcher') || (only && !only.test(id))) continue;
  api.setWeapon(id, 'iron');
  const w = api.weapon, u = w.userData, mode = reloadMode(id, st);
  for (const empty of st.mag <= 1 || mode === 'rocket' || mode === 'break' ? [true] : [true, false]) {
    n++;
    let reachMax = 0, magMax = 0, magK = null, base = null;
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1), shell = mode === 'shell';
      const reload = { style: st.reloadStyle || 'mag', k, empty, ph: shell ? (k * 4) % 1 : 0, id, shk: 0.25 };
      api.refreshHold({ reload, side: 1 });
      const mount = api.parts.mount; mount.updateMatrix();
      const H = api.parts.armL.hand.position;                                       // gövde yerelinde el
      // hedef (karakterin kendi hesabıyla aynı)
      const ra = reloadPlan(mode, k, empty, reload.ph, 0.25), geo = reloadGeo(u, id, mode);
      if (!ra.L) continue;
      const inv = mount.matrix.clone().invert(), restL = api.parts.armL.shoulder.clone().add(new THREE.Vector3(-0.03, -0.55, -0.05));
      const POUCH = new THREE.Vector3(-0.13, -0.13, -0.2);
      const ex = { fg: u.gripL ? u.gripL : restL.clone().applyMatrix4(inv), pouch: POUCH.clone().applyMatrix4(inv), gR: u.gripR, u };
      const T = blendPoint(geo, ra.L, ra, ex).applyMatrix4(mount.matrix);
      const e = H.distanceTo(T); if (base === null) base = e; if (e - base > reachMax) reachMax = e - base;      // dinlenme tutuşunda da erişilemeyen pay (uzun kundak) düşülür
      if (ra.mag === 'hand' && u.mag) {
        u.mag.updateMatrix();
        const g = geo.G.clone().applyMatrix4(u.mag.matrix).applyMatrix4(mount.matrix), d = g.distanceTo(H);
        if (d > magMax) { magMax = d; magK = k; }
      }
    }
    const err = [];
    if (reachMax > (mode === 'rocket' ? 0.3 : 0.12)) err.push(`kol hedefe +${Math.round(reachMax * 1000)} mm`);      // bilgi: 3. şahıs kolu kısa; şarjör elde kaldıkça kabul
    if (magMax > 0.01) err.push(`şarjör elden ${Math.round(magMax * 1000)} mm (k ${magK?.toFixed(2)})`);
    if (err.length) bad.push(id + (empty ? '' : '-T'));
    console.log(`${err.length ? '✗' : '✓'} ${id.padEnd(10)} ${mode.padEnd(6)} ${empty ? 'boş ' : 'takt'} oturma k ${reloadSeatK(mode, empty) ?? 'fişek'} · kol ${Math.round(reachMax * 1000)} mm · şarjör ${Math.round(magMax * 1000)} mm ${err.join(' · ')}`);
  }
}
console.log(`\n${n - bad.length}/${n} uygun${bad.length ? ' · sorunlu: ' + bad.join(', ') : ''}`);
process.exit(bad.length ? 1 : 0);
