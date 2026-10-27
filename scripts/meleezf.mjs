// Yakın dövüş birinci şahıs modelinde derinlik çakışması (z-fighting) denetimi (12.194): bıçak / satır / tomahawk + kutu yumruk üçgenleri model uzayında toplanır,
// aynı düzlemde (normal farkı < 0,1°, düzlem uzaklığı < 0,05 mm) ve 2B'de gerçekten örtüşen (kenara değmek sayılmaz) üçgen çiftleri sayılır.
//   aynı yön  = iki dış yüz üst üste → ekranda titreyen pikseller (0 olmalı)
//   ters yön  = iç içe iki parçanın bitişik duvarları (dışarıdan görünmez; bilgi)
//   node scripts/meleezf.mjs [taban url]        (vite + sunucu açıkken; swiftshader yeterli)
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5180';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0&melee=knife`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
const res = await page.evaluate(() => {
  const g = window.__game, p = g.player, s = p.s, out = {};
  for (const id of ['knife', 'machete', 'tomahawk']) {
    s.cur = 3; s.items[3] = { id, mag: 1, reserve: 0 }; p.refreshWeapon();
    const m = p.vm.model; m.updateMatrixWorld(true);
    const inv = m.matrixWorld.clone().invert(), T = [];
    let part = 0;
    m.traverse((o) => {
      if (!o.isMesh || !o.visible || o.userData.sleeve || o === p.vm.handR?.userData.sleeve) return;
      if (o.parent === p.vm.handR) return;                                   // kol kutusu (yumruğun doğrudan çocuğu)
      const mw = inv.clone().multiply(o.matrixWorld), pa = o.geometry.attributes.position, ix = o.geometry.index, n = ix ? ix.count : pa.count;
      const wf = o.geometry.attributes.wf, V = (i) => { const k = ix ? ix.getX(i) : i; return [pa.getX(k), pa.getY(k), pa.getZ(k)]; };
      const mp = (v) => { const e = mw.elements; return [e[0] * v[0] + e[4] * v[1] + e[8] * v[2] + e[12], e[1] * v[0] + e[5] * v[1] + e[9] * v[2] + e[13], e[2] * v[0] + e[6] * v[1] + e[10] * v[2] + e[14]]; };
      part++;
      for (let i = 0; i < n; i += 3) T.push({ a: mp(V(i)), b: mp(V(i + 1)), c: mp(V(i + 2)), part: wf ? part * 1000 + Math.round(wf.getX(ix ? ix.getX(i) : i)) : part, mesh: o.name || o.uuid.slice(0, 4) });
    });
    const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], dt = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    for (const t of T) { const nn = cr(sub(t.b, t.a), sub(t.c, t.a)), L = Math.hypot(...nn); t.area = L / 2; t.n = L ? nn.map((x) => x / L) : [0, 0, 0]; t.d = dt(t.n, t.a); }
    const ov2 = (A, B) => {                                                  // 2B üçgen örtüşmesi (SAT, 1e-7 m pay: yalnız kenara değme örtüşme sayılmaz)
      for (const [P, Q] of [[A, B], [B, A]]) for (let i = 0; i < 3; i++) {
        const p0 = P[i], p1 = P[(i + 1) % 3], ax = [-(p1[1] - p0[1]), p1[0] - p0[0]];
        const pr = (X) => X.map((q) => q[0] * ax[0] + q[1] * ax[1]), a = pr(P), b = pr(Q), l = Math.hypot(...ax) || 1;
        if (Math.min(...a) >= Math.max(...b) - 1e-7 * l || Math.min(...b) >= Math.max(...a) - 1e-7 * l) return false;
      }
      return true;
    };
    let same = 0, opp = 0; const ex = [];
    const Tn = T.filter((t) => t.area > 1e-10);
    for (let i = 0; i < Tn.length; i++) for (let j = i + 1; j < Tn.length; j++) {
      const A = Tn[i], B = Tn[j], c = dt(A.n, B.n);
      if (Math.abs(c) < 0.999998) continue;
      if (Math.abs(A.d - Math.sign(c) * B.d) > 5e-5) continue;
      if (A.part === B.part && c > 0) continue;                              // aynı parçanın komşu üçgenleri
      const n = A.n, ax = Math.abs(n[0]) > Math.abs(n[1]) ? (Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2) : Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2;
      const P2 = (t) => [t.a, t.b, t.c].map((v) => v.filter((_, k) => k !== ax));
      if (!ov2(P2(A), P2(B))) continue;
      if (c > 0) { same++; if (ex.length < 4) ex.push([A.part, B.part, A.a.map((x) => +x.toFixed(4))]); } else opp++;
    }
    out[id] = { tris: T.length, same, opp, ex };
  }
  return out;
});
let fail = 0;
for (const [id, r] of Object.entries(res)) { const ok = r.same === 0; if (!ok) fail++; console.log(`${ok ? 'OK  ' : 'HATA'} ${id}: ${r.tris} üçgen · aynı yönde üst üste ${r.same} · ters yön (iç duvar) ${r.opp}`, r.ex.length ? JSON.stringify(r.ex) : ''); }
await browser.close();
process.exit(fail ? 1 : 0);
