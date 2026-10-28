// 12.199 sunucu yüzüstü bakış doğrulaması (tarayıcısız): node scripts/pronenet.mjs   (önce: npm run server; WS=ws://127.0.0.1:8787)
//   1) dürüst istemci: yaw sınırda, gövde 90°/sn → sunucu aynen kabul eder (yw / pb aynı)
//   2) hileli istemci: yatar yatmaz yw = gövde + 180°, pb her girdide +1 rad → sunucu gövdeyi ≤ 2×90°/sn döndürür, bakışı gövde ±50°'de tutar
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8787';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const D = (x) => (x * 180) / Math.PI, ad = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d)));
await new Promise((r) => ws.on('open', r));
ws.send(JSON.stringify({ t: 'create', name: 'Yatan', cfg: { map: 'kasaba', perTeam: 2, bots: false } }));
await wait(1500);
const wel = ws.msgs.find((m) => m.t === 'welcome'); check(!!wel, 'oda: ' + (wel && wel.room));
let q = 0;
const lastMe = () => { for (let i = ws.msgs.length - 1; i >= 0; i--) if (ws.msgs[i].t === 'snap' && ws.msgs[i].me) return ws.msgs[i].me; return null; };
await wait(500);
const y0 = lastMe().now.yw;
const send = (o) => ws.send(JSON.stringify({ t: 'in', q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, w: 0, pt: 0, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, ...o }));
// yat
send({ yw: y0, p: 1 }); await wait(20);
for (let i = 0; i < 20; i++) { send({ yw: y0, pb: y0 }); await wait(16); }
await wait(300);
let me = lastMe().now; check(!!(me.f & 2), 'sunucuda yüzüstü (F_PRONE)');
// 1) dürüst: gövde 60 adımda 90° (1,5°/adım), bakış gövde + 50°
let body = y0;
for (let i = 0; i < 60; i++) { body += Math.PI / 2 / 60; send({ yw: body + (50 * Math.PI) / 180, pb: body }); await wait(16); }
await wait(400); me = lastMe().now;
check(Math.abs(D(ad(me.pb, body))) < 0.5 && Math.abs(D(ad(me.yw, body + (50 * Math.PI) / 180))) < 0.5, `dürüst dönüş kabul: sunucu gövde ${D(ad(me.pb, y0)).toFixed(1)}° (beklenen 90), bakış farkı ${D(ad(me.yw, me.pb)).toFixed(1)}°`);
// 2) hile: bakış arkaya, pb her adımda +1 rad (60 adım = 1 sn)
const b1 = me.pb; let fake = b1;
for (let i = 0; i < 60; i++) { fake += 1; send({ yw: b1 + Math.PI, pb: fake }); await wait(16); }
await wait(400); me = lastMe().now;
const turned = D(ad(me.pb, b1)), off = D(ad(me.yw, me.pb));
check(Math.abs(off) <= 50.5, `hileli bakış sınırda: bakış − gövde = ${off.toFixed(1)}° (≤ 50)`);
check(Math.abs(turned) <= 200, `hileli gövde dönüşü sınırlı: 1 sn'de ${turned.toFixed(1)}° (≤ ~185, istek 3438°)`);
ws.close();
console.log(fail ? `${fail} HATA` : 'hepsi geçti');
process.exit(fail ? 1 : 0);
