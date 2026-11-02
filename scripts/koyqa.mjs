// Kum Köyü (12.224) harita denetimi — tarayıcısız:  node scripts/koyqa.mjs [bölüm …]   (bölüm: geo statik bot; varsayılan hepsi)
//  geo   : cgqa taraması (iç içe / z-fighting / görünmez çarpışma / görsel ama çarpışmasız / havada / sızıntı) MAP=uykukoy ile
//  statik: yol ızgarası — iki doğuş aynı bileşende mi, serbest ama erişilmeyen cepler, oynanış alanı dışına sızıntı, önemli noktalara (dam, Konak üst kat,
//          ev içleri, her bölge adı) iki doğuştan yol + yürüme süresi (5,6 m/sn), komşu bölge yolları / kuş uçuşu oranı (cglinks gibi), 45 m'den uzun açık görüş
//  ag    : (yalnız açıkça istenince; WS=ws://… çalışan sunucu) oda kur → harita / doğuş / sunucuda yürüme
//  bot   : başsız 5v5 Takım Çatışması (RUNS tur × SECS sn): ilk görüş / isabet / öldürme, botların gezdiği alan (2 m karo), hiç gidilmeyen bölge,
//          takılan bot (çatışmasız, hedefine > 3 m uzakken 6 sn'de < 1 m), dam / Konak üst kat ziyareti, adım süresi
// Çıktı JSON: OUT (varsayılan /tmp/wb-koy/koyqa.json). Çıkış kodu: hata varsa 1.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
const { buildUykuKoy, CALLOUTS } = await import('../src/maps/uykukoy.js');
const PLAN = await import('../src/maps/assets/uykukoy/plan.js');
const { World } = await import('../src/game/collision.js');
const { Game } = await import('../src/game/game.js');
const { WALK_SPEED } = await import('../src/sim/input.js');
const PARTS = process.argv.slice(2).length ? process.argv.slice(2) : ['geo', 'statik', 'bot'];
const OUT = process.env.OUT || '/tmp/wb-koy/koyqa.json';
const R = {}; let fail = 0;
const bad = (msg) => { fail++; console.log('HATA  ' + msg); };

if (PARTS.includes('geo')) {
  const out = execFileSync(process.execPath, ['scripts/cgqa.mjs', '.'], { env: { ...process.env, MAP: 'uykukoy' }, maxBuffer: 64 << 20 }).toString();
  const q = JSON.parse(out.slice(out.indexOf('{')));
  R.geo = q;
  console.log(`geo   iç içe ${q.icice.farkliNesne} · z-fight ${q.zfight.titreyenCift} çift (${q.zfight.alanM2} m²) · görünmez çarpışma ${q.gorunmezCarpisma.alanM2} m² · görsel-çarpışmasız ${q.gorselCarpismasiz.carpismasizM2} m² · havada ${q.havadaGomulu.havada} · gömülü ${q.havadaGomulu.gomulu} · kurulum ${q.agaclar.kurulumMs} ms, ${q.agaclar.ucgen} üçgen`);
  if (q.icice.farkliNesne) bad('iç içe çarpışma kutusu');
  if (q.gorunmezCarpisma.erisilebilirAlanM2 > 0.05) bad('görünmez çarpışma (erişilebilir bantta)');
  if (q.havadaGomulu.havada || q.havadaGomulu.gomulu) bad('havada / gömülü nesne');
}

const m = buildUykuKoy();
const nav = m.makeNav();
const P = PLAN.PLAY;

if (PARTS.includes('statik')) {
  const S = (R.statik = {});
  const cm = nav.compsA(0.7), N = nav.N, M = N + nav.uCell.length;
  const nodeAt = (x, z, y) => nav.pick(x, z, y);
  const bS = m.spawns.blue[0], rS = m.spawns.red[0], cb = cm[nodeAt(bS.x, bS.z, bS.y)], cr = cm[nodeAt(rS.x, rS.z, rS.y)];
  S.dogusBilesen = cb === cr ? 'aynı' : 'AYRI';
  if (cb !== cr) bad('iki doğuş aynı yol bileşeninde değil');
  for (const t of ['blue', 'red']) for (const p of m.spawns[t]) if (cm[nodeAt(p.x, p.z, p.y)] !== cb) bad(`erişilmez doğuş ${t} ${p.x},${p.z}`);
  // serbest ama erişilmeyen düğümler (cep) + sızıntı
  let reach = 0, free = 0, leak = 0; const pockets = new Map();
  for (let n = 0; n < M; n++) {
    const blocked = n < N ? nav.blocked[n] : nav.uBlk[n - N]; if (blocked) continue;
    const c = nav.cellOfNode(n), x = nav.cx(c), z = nav.cz(c);
    if (x < P.minX || x > P.maxX || z < P.minZ || z > P.maxZ) { if (cm[n] === cb) leak++; continue; }
    free++;
    if (cm[n] === cb) { reach++; continue; }
    const key = `${Math.round(x / 3) * 3},${Math.round(z / 3) * 3},${nav.fOf(n).toFixed(1)}`; pockets.set(key, (pockets.get(key) || 0) + 1);
  }
  S.serbestDugum = free; S.erisilen = reach; S.sizinti = leak;
  S.cepler = [...pockets].filter(([, v]) => v >= 4).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k} (${v} düğüm)`);
  console.log(`statik erişilen ${reach}/${free} düğüm (%${(100 * reach / free).toFixed(1)}) · sızıntı ${leak} · ≥4 düğümlük erişilmez cep ${S.cepler.length}${S.cepler.length ? ': ' + S.cepler.slice(0, 6).join(' | ') : ''}`);
  if (leak) bad('oynanış alanı dışına yürünebiliyor');
  // önemli noktalar: iki doğuştan yol
  const pathLen = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); return L; };
  const K = PLAN.KONAK, D = PLAN.DAM;
  const SPOTS = [
    ['Konak zemin', 25.8, -2.4, 0], ['Konak üst kat', 21, -1, 3.2], ['Konak üst kat (güney)', 22, 2.0, 3.2],
    ['Güney Damlı Ev içi', 28, 15.5, 0], ['Güney dam', 27, 16, 3.45], ['Kuzey Damlı Ev içi', 28, -15.5, 0], ['Kuzey dam', 27, -16, 3.45],
    ...CALLOUTS.map((c) => [c.name, c.x, c.z, undefined]),
  ];
  S.noktalar = [];
  const sb = m.spawns.blue[2], sr = m.spawns.red[2];
  for (const [name, x, z, y] of SPOTS) {
    const pb = nav.findPath(sb.x, sb.z, x, z, 0.7, sb.y, y), pr = nav.findPath(sr.x, sr.z, x, z, 0.7, sr.y, y);
    const lb = pb ? pathLen(pb) : null, lr = pr ? pathLen(pr) : null;
    const yEnd = pb ? pb[pb.length - 1].y : null;
    S.noktalar.push({ name, mavi: lb && +lb.toFixed(1), kirmizi: lr && +lr.toFixed(1), y: yEnd && +yEnd.toFixed(2) });
    if (!pb || !pr) bad(`yol yok: ${name} (mavi ${!!pb}, kırmızı ${!!pr})`);
    else if (y !== undefined && Math.abs(yEnd - y) > 0.4) bad(`${name}: yol yanlış kata gidiyor (y ${yEnd.toFixed(2)}, beklenen ${y})`);
  }
  const walk = (L) => (L / WALK_SPEED).toFixed(1);
  for (const q of S.noktalar.filter((q) => /^(Meydan|Fırın Avlusu|Konak|Kuzey Kemer|Güney Kemer|Kuzey Evler Sokağı|Güney Evler Sokağı|Sebil)$/.test(q.name))) console.log(`        ${q.name.padEnd(20)} mavi ${q.mavi} m (${walk(q.mavi)} sn) · kırmızı ${q.kirmizi} m (${walk(q.kirmizi)} sn)`);
  // komşu bölgeler: yol / kuş uçuşu
  const C = Object.fromEntries(CALLOUTS.map((c) => [c.name, c]));
  const PAIRS = [];
  for (const h of ['Güney ', 'Kuzey ']) PAIRS.push([h + 'Han', h + 'Han Sokağı'], [h + 'Han Sokağı', h + 'Batı Han Geçidi'], [h + 'Batı Han Geçidi', h + 'Han Arkası'], [h + 'Han Arkası', h + 'Han Önü'], [h + 'Doğu Han Sokağı', h + 'Doğu Han Geçidi'], [h + 'Doğu Han Geçidi', h + 'Han Arkası'], [h + 'Han Sokağı', h + 'Dar Sokak'], [h + 'Dar Sokak', h + 'Kıvrım'], [h + 'Kıvrım', h + 'Kemer'], [h + 'Kemer', 'Meydan'], [h + 'Kıvrım', 'Fırın Avlusu'],
    [h + 'Han Önü', 'Meydan'], [h + 'Han', h + 'Doğu Han Sokağı'], [h + 'Doğu Han Sokağı', h + 'Evler Sokağı'], [h + 'Evler Sokağı', h + 'Doğu Geçidi'], [h + 'Doğu Geçidi', 'Meydan'], [h + 'Evler Sokağı', h + 'Avlu'], [h + 'Avlu', h + 'Damlı Ev'], [h + 'Avlu', 'Arka Geçit'], [h + 'Evler Sokağı', 'Konak']);
  PAIRS.push(['Fırın Avlusu', 'Batı Geçidi'], ['Batı Geçidi', 'Meydan'], ['Meydan', 'Konak Önü'], ['Konak Önü', 'Konak'], ['Konak', 'Arka Geçit'], ['Sebil', 'Kamyon']);
  S.baglantilar = [];
  for (const [a, b2] of PAIRS) {
    const A = C[a], B = C[b2], p = nav.findPath(A.x, A.z, B.x, B.z, 0.7, 0.1, 0.1), e = Math.hypot(A.x - B.x, A.z - B.z), L = p ? pathLen(p) : Infinity, r = L / Math.max(e, 1);
    S.baglantilar.push(`${a} ↔ ${b2}: ${e.toFixed(0)} m · yol ${p ? L.toFixed(0) : 'YOK'} · oran ${r.toFixed(2)}`);
    if (!p || (r > 1.9 && L - e > 12)) bad(`şüpheli bağlantı ${a} ↔ ${b2} (${S.baglantilar[S.baglantilar.length - 1]})`);
  }
  console.log(`        ${PAIRS.length} komşu bölge çifti denetlendi`);
  // uzun açık görüş: 1,5 m ızgara zemin noktaları (göz 1,62 → göğüs 1,2), ≥ 40 m çiftler
  const world = new World(m.colliders, m.bounds, m.terrain);
  const pts = [];
  for (let x = P.minX + 0.75; x < P.maxX; x += 1.5) for (let z = P.minZ + 0.75; z < P.maxZ; z += 1.5) {
    const n = nav.pick(x, z, 0); if (n < 0 || cm[n] !== cb) continue;
    const c = nav.cellOfNode(n); if (Math.abs(nav.cx(c) - x) > 0.3 || Math.abs(nav.cz(c) - z) > 0.3) continue;
    pts.push([x, nav.fOf(n), z]);
  }
  const a = new THREE.Vector3(), b2 = new THREE.Vector3();
  let n40 = 0, n45 = 0, maxL = 0, maxPair = null; const longs = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const [x1, y1, z1] = pts[i], [x2, y2, z2] = pts[j], d = Math.hypot(x1 - x2, z1 - z2);
    if (d < 40) continue;
    a.set(x1, y1 + 1.62, z1); b2.set(x2, y2 + 1.2, z2);
    if (!world.clear(a, b2)) continue;
    n40++; if (d > 45) { n45++; if (longs.length < 400) longs.push([d, x1, z1, x2, z2]); }
    if (d > maxL) { maxL = d; maxPair = [x1, y1, z1, x2, y2, z2]; }
  }
  longs.sort((p, q) => q[0] - p[0]);
  S.gorus = { nokta: pts.length, acik40: n40, acik45: n45, enUzun: +maxL.toFixed(1), enUzunCift: maxPair && maxPair.map((v) => +v.toFixed(1)), ornek45: longs.slice(0, 8).map(([d, x1, z1, x2, z2]) => `${d.toFixed(1)} m (${x1},${z1}) → (${x2},${z2})`) };
  console.log(`        görüş: ${pts.length} nokta · ≥40 m açık ${n40} çift · >45 m açık ${n45} çift · en uzun ${maxL.toFixed(1)} m ${JSON.stringify(S.gorus.enUzunCift)}`);
  if (n45) console.log('        >45 m örnek: ' + S.gorus.ornek45.slice(0, 4).join(' | '));
}

if (PARTS.includes('bot')) {
  const RUNS = +(process.env.RUNS || 4), SECS = +(process.env.SECS || 75), TYPE = process.env.TYPE || 'tdm', PER = +(process.env.PER || 5);
  const B = (R.bot = { tur: [], tip: TYPE, per: PER, sn: SECS });
  const tile = (x, z) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
  const reachTiles = new Set(); { const cm = nav.compsA(0.7), s = m.spawns.blue[0], c0 = cm[nav.pick(s.x, s.z, s.y)]; for (let n = 0; n < nav.N; n++) if (cm[n] === c0) reachTiles.add(tile(nav.cx(n), nav.cz(n))); }
  const visited = new Set(), calloutHit = new Set(); let stuck = []; let upT = 0, roofT = 0, inT = 0, stepMs = 0, steps = 0;
  const e1 = new THREE.Vector3(), c1 = new THREE.Vector3();
  const K = PLAN.KONAK, D = PLAN.DAM;
  for (let r = 0; r < RUNS; r++) {
    const g = new Game(null, { headless: true, map: 'uykukoy', tod: 'day', weather: 'clear', diff: process.env.DIFF || 'normal', match: { perTeam: PER, type: TYPE, time: SECS + 60 } });
    let tSee = null, tHit = null, tKill = null, seeAt = null; const last = new Map();
    for (let i = 0; i < 30 * SECS; i++) {
      const t0 = performance.now(); g.step(1 / 30); stepMs += performance.now() - t0; steps++;
      const t = (i + 1) / 30;
      if (tSee === null && i % 3 === 0) {
        const Bs = g.soldiers.filter((s) => s.alive && s.team === 'blue'), Rs = g.soldiers.filter((s) => s.alive && s.team === 'red');
        outer: for (const a of Bs) for (const b of Rs) if (g.botSees(a.eye(e1), c1.set(b.pos.x, b.pos.y + 1.2, b.pos.z))) { tSee = t; seeAt = `mavi ${a.pos.x.toFixed(1)},${a.pos.y.toFixed(1)},${a.pos.z.toFixed(1)} ↔ kırmızı ${b.pos.x.toFixed(1)},${b.pos.y.toFixed(1)},${b.pos.z.toFixed(1)}`; break outer; }
      }
      if (tHit === null && g.soldiers.some((s) => s.hp < 100 || !s.alive)) tHit = t;
      if (tKill === null && g.soldiers.some((s) => (s.kills || 0) > 0)) tKill = t;
      if (i % 6) continue;
      for (const s of g.soldiers) {
        if (!s.alive) { last.delete(s); continue; }
        const p = s.pos; visited.add(tile(p.x, p.z));
        for (const c of CALLOUTS) if (Math.hypot(c.x - p.x, c.z - p.z) < 4) calloutHit.add(c.name);
        const inK = p.x > K.x0 && p.x < K.x1 && p.z > K.z0 && p.z < K.z1, inD = p.x > D.x0 && p.x < D.x1 && Math.abs(p.z) > D.z0 && Math.abs(p.z) < D.z1;
        if (inK && p.y > 2.5) upT += 0.2; if (inD && p.y > 3) roofT += 0.2; if ((inK || inD) && p.y < 1) inT += 0.2;
        const br = s.brain, L = last.get(s), gl = br?.goal;
        const holding = !gl || Math.hypot(gl.x - p.x, gl.z - p.z) < 3 || br.atSpot || br.perching;          // hedefe varmış / mevzi tutan bot takılmış sayılmaz
        if (!L || br?.target || holding) { last.set(s, { x: p.x, z: p.z, t }); continue; }
        if (Math.hypot(p.x - L.x, p.z - L.z) > 1) { last.set(s, { x: p.x, z: p.z, t }); continue; }
        if (t - L.t > 6 && t > 4) { stuck.push(`${s.team} ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} @${t.toFixed(0)}s`); last.set(s, { x: p.x, z: p.z, t }); }
      }
    }
    const kills = g.soldiers.reduce((a, s) => a + (s.kills || 0), 0);
    B.tur.push({ gorus: tSee, gorusYeri: seeAt, isabet: tHit, oldurme: tKill, toplamOldurme: kills, skor: { ...g.tickets } });
    console.log(`bot   tur ${r + 1}: ilk görüş ${tSee?.toFixed(1)} sn (${seeAt}) · ilk isabet ${tHit?.toFixed(1)} sn · ilk öldürme ${tKill?.toFixed(1)} sn · ${kills} öldürme · skor ${g.tickets.blue}-${g.tickets.red}`);
    g.dispose?.();
  }
  const avg = (k) => { const v = B.tur.map((t) => t[k]).filter((x) => x != null); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null; };
  B.ort = { gorus: avg('gorus'), isabet: avg('isabet'), oldurme: avg('oldurme') };
  let cov = 0; for (const k of visited) if (reachTiles.has(k)) cov++;
  B.kapsama = +(100 * cov / reachTiles.size).toFixed(1);
  B.gidilmeyenBolge = CALLOUTS.map((c) => c.name).filter((n) => !calloutHit.has(n));
  B.takilma = stuck.length; B.takilmaOrnek = stuck.slice(0, 10);
  B.konakUstSn = +upT.toFixed(0); B.damSn = +roofT.toFixed(0); B.evIciSn = +inT.toFixed(0);
  B.adimMs = +(stepMs / steps).toFixed(3);
  console.log(`bot   ort: ilk görüş ${B.ort.gorus} sn · ilk isabet ${B.ort.isabet} sn · ilk öldürme ${B.ort.oldurme} sn · gezilen alan %${B.kapsama} · gidilmeyen bölge: ${B.gidilmeyenBolge.join(', ') || '-'}`);
  console.log(`      takılma ${B.takilma}${B.takilma ? ' (' + B.takilmaOrnek.slice(0, 4).join(' | ') + ')' : ''} · Konak üst kat ${B.konakUstSn} bot·sn · dam ${B.damSn} bot·sn · ev içi ${B.evIciSn} bot·sn · adım ${B.adimMs} ms`);
  if (TYPE === 'tdm' && B.gidilmeyenBolge.length > 3) bad('botların hiç gitmediği bölge çok: ' + B.gidilmeyenBolge.join(', '));
  if (B.tur.some((t) => !t.toplamOldurme)) bad('öldürmesiz tur');
}
if (PARTS.includes('ag')) {                                                          // çalışan oyun sunucusu (WS=ws://127.0.0.1:8787): oda kur, harita / doğuş / yürüme
  const { default: WebSocket } = await import('ws');
  const ws = await new Promise((res, rej) => { const w = new WebSocket(process.env.WS || 'ws://127.0.0.1:8787'); w.msgs = []; w.on('message', (d) => w.msgs.push(JSON.parse(d))); w.on('open', () => res(w)); w.on('error', rej); });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  ws.send(JSON.stringify({ t: 'create', name: 'KoyQA', cfg: { map: 'uykukoy', type: 'tdm', perTeam: 5, bots: true } }));
  await wait(2500);
  const wel = ws.msgs.find((q) => q.t === 'welcome'), snaps = ws.msgs.filter((q) => q.t === 'snap');
  const A = (R.ag = { oda: wel?.room, harita: wel?.cfg?.map, snap: snaps.length });
  if (!wel || wel.cfg?.map !== 'uykukoy') bad('sunucu odası Kum Köyü ile kurulmadı (' + JSON.stringify(wel?.cfg?.map) + ')');
  const me0 = snaps.pop()?.me?.now;
  if (me0) { const inHan = Math.abs(me0.x) < 13 && Math.abs(me0.z) > 29; A.dogus = [+me0.x.toFixed(1), +me0.z.toFixed(1)]; if (!inHan) bad('sunucuda doğuş Han dışında: ' + A.dogus); }
  let q = 0, best = 0;
  for (let k = 0; k < 8 && me0; k++) {
    const b0 = ws.msgs.filter((m) => m.t === 'snap').pop().me.now;
    const iv = setInterval(() => ws.send(JSON.stringify({ t: 'in', q: ++q, f: 1, r: 0, l: 0, s: 0, j: 0, a: 0, yw: k * Math.PI / 4, pt: 0 })), 1000 / 60);
    await wait(500); clearInterval(iv);
    const b1 = ws.msgs.filter((m) => m.t === 'snap').pop().me.now; best = Math.max(best, Math.hypot(b1.x - b0.x, b1.z - b0.z));
  }
  A.yurume05sn = +best.toFixed(2);
  if (best < 1.5) bad('sunucuda yürüyemedi');
  console.log(`ag    oda ${A.oda} · harita ${A.harita} · ${A.snap} snapshot / 2,5 sn · doğuş ${A.dogus} · 0,5 sn'de ${A.yurume05sn} m`);
  ws.close();
}
fs.mkdirSync(OUT.replace(/\/[^/]*$/, ''), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
console.log(fail ? `sonuç: ${fail} HATA` : 'sonuç: OK', '·', OUT);
process.exit(fail ? 1 : 0);
