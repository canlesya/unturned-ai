// Atış saçılması: duran / yürüyen / koşan / havadaki oyuncu için spreadNow ve gerçek mermi sapması.  node scripts/spreadtest.mjs
import * as THREE from 'three';
import { Game } from '../src/game/game.js';
import { WSTATS } from '../src/game/stats.js';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const g = new Game(null, { headless: true, map: 'kasaba', match: { perTeam: 2, type: 'tdm', tickets: 500 } });
const A = g.claimSlot('blue', 'Ali'); g.claimSlot('red', 'Veli'); g.brains.length = 0;
const st = WSTATS[A.item.id];
const setState = (o) => { A.vel.set(o.vx || 0, 0, 0); A.onGround = o.air ? false : true; A.sprinting = !!o.sprint; A.firedSprinting = !!o.sprint; A.sinceShot = o.fresh ? 9 : 0; A.bloom = 0; A.crouching = false; A.adsT = o.ads || 0; };
const sp = {};
for (const [name, o] of Object.entries({ dur: { fresh: true }, yuru: { vx: 4.4 }, kos: { vx: 6.6, sprint: true }, hava: { air: true, fresh: true }, adsKos: { vx: 6.6, sprint: true, ads: 1 }, kosHava: { vx: 6.6, sprint: true, air: true } })) { setState(o); sp[name] = A.spreadNow(st); }
console.log('      saçılma (rad):', Object.entries(sp).map(([k, v]) => `${k} ${v.toFixed(4)}`).join(' · '));
check(sp.kos > sp.yuru * 5 && sp.kos > 0.08, 'koşarken saçılma yürümeden çok büyük (≥0,08 rad)');
check(sp.hava > sp.dur * 20 && sp.hava > 0.07, 'havadayken saçılma belirgin büyük (≥0,07 rad)');
check(sp.kosHava > 0.14, 'koşarak zıplarken saçılma ikisinin toplamı (≥0,14 rad)');
check(sp.dur < 0.004, 'duran oyuncunun ilk atışı hâlâ isabetli');
// atış koşarken serbest mi: tryFire true döner
setState({ vx: 6.6, sprint: true }); A.cd = 0; A.switchT = 0; A.reloadT = 0; A.item.mag = 10;
check(A.tryFire() === true, 'koşarken ateş edilebiliyor (kapatılmadı)');
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
