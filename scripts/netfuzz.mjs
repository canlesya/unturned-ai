// 12.187: sunucu sağlamlık testi (tarayıcısız): bozuk / uç değerli mesaj yağmuru, sonra sunucu ayakta mı, oda adım atıyor mu, temiz gözcü
// snapshot alıyor mu, NaN konum var mı. Ardından doğuşta kullanılan alanlar (opt: sınıf / yükleme / kaplama / kıyafet / doğuş) bozukken intihar + doğuş.
//   WS=ws://127.0.0.1:8969 node scripts/netfuzz.mjs [tur=3]       (sunucu BF_DEBUG=1 olabilir; dbg alanları da denenir)
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8969', HTTP = URL.replace(/^ws/, 'http'), ROUNDS = +(process.argv[2] || 3);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const open = () => new Promise((res, rej) => { const w = new WebSocket(URL); w.msgs = []; w.on('message', (d) => { try { w.msgs.push(JSON.parse(d)); } catch { w.msgs.push({ raw: String(d).slice(0, 80) }); } if (w.msgs.length > 400) w.msgs.splice(0, 200); }); w.on('open', () => res(w)); w.on('error', rej); });
const send = (w, o) => { if (w.readyState === 1) w.send(typeof o === 'string' ? o : JSON.stringify(o)); };
const last = (w, t) => [...w.msgs].reverse().find((m) => m.t === t);
const until = async (f, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await wait(30); } return null; };
const health = async () => { try { return await (await fetch(HTTP + '/health')).json(); } catch { return null; } };

const A = await open(); send(A, { t: 'create', name: 'Fuzz', cfg: { type: 'tdm', perTeam: 4, map: 'kasaba', bots: true, listed: false } });
const wa = await until(() => last(A, 'welcome'), 15000);
check(!!wa, 'oda kuruldu ' + (wa && wa.room));
const room = wa.room;
const O = await open(); send(O, { t: 'join', room, name: 'Gozcu' });
check(!!(await until(() => last(O, 'welcome'), 8000)), 'gözcü katıldı');

const junk = () => {
  const r = Math.random, pick = (a) => a[Math.floor(r() * a.length)];
  const vals = [null, undefined, NaN, Infinity, -Infinity, 1e308, -1e308, 2 ** 53, -1, 0, 1, 3.7, '1', 'x'.repeat(200), '', [], [1, 2, 3], { a: 1 }, true, false, '__proto__', { __proto__: { x: 1 } }, [NaN, 1, 2], [1e9, 1e9, 1e9]];
  const types = [...(process.env.FUZZ_DBG ? ['dbg'] : []), 'in', 'kill', 'chat', 'opt', 'vote', 'team', 'join', 'create', 'ping', 'zzz', 123, null];
  const o = { t: pick(types) };
  const keys = ['q', 'f', 'r', 'l', 's', 'j', 'a', 'yw', 'pt', 'w', 'c', 'p', 'u', 'fh', 'fp', 'rl', 'fm', 'o', 'ab', 'vt', 'sd', 'tl', 've', 'vs', 'vl', 'dn', 'co', 'm', 'tm', 'cls', 'loadout', 'spawn', 'zt', 'skins', 'wear', 'optic', 'fo', 'i', 'team', 'room', 'name', 'cfg', 'pw', 'tok',
    'tp', 'tpy', 'hp', 'tps', 'item', 'am', 'dmg', 'tk', 'kl', 'pb', 'frs', 'frt', 'pld', 'zb', 'vtp', 'vdmg', 'bots', 'ask'];
  for (let i = 0; i < 1 + Math.floor(r() * 8); i++) o[pick(keys)] = pick(vals);
  if (o.t === 'opt' && r() < 0.5) o.loadout = { primary: pick(['ak47', 'zzz', '__proto__', 'constructor', 1, null]), secondary: pick(['pistol', 'rpg', 'knife', {}]), gadget: pick(['grenade', 'medkit', 'x']), melee: pick(['knife', 'ak47']), front: pick([null, {}, [], 'a']), op: pick(['acog', 'zzz', 1]), fo: pick([{ ak47: 'scope' }, { __proto__: 1 }, 'a']) };
  if (o.t === 'in') o.q = (A.q = (A.q || 0) + 1);
  return o;
};
const rawJunk = ['', '{', 'null', '[]', '"str"', '{"t":', '{"t":"in","q":1e400}', JSON.stringify({ t: 'in', q: 5, co: [1, 2] }), '\u0000\u0001', 'x'.repeat(5000)];
for (let r = 0; r < ROUNDS; r++) {
  const F = await open();
  send(F, { t: 'join', room, name: 'Bozuk' + r });
  await until(() => last(F, 'welcome'), 5000);
  for (let i = 0; i < 1200; i++) send(F, junk());
  for (const s of rawJunk) send(F, s);
  // doğuşta kullanılan bozuk alanlar + intihar → yeniden doğuş
  send(F, { t: 'opt', cls: 'zombie', loadout: { primary: 'rpg', secondary: 'barrett', gadget: 'zzz', melee: 'ak47', front: { x: 1 } }, skins: { ak47: 'gold', zzz: 'x' }, wear: { assault: 'zzzz' }, spawn: '__proto__' });
  send(F, { t: 'kill' });
  await wait(1200);
  const h = await health();
  check(!!h && h.ok, `tur ${r + 1}: sunucu ayakta (${JSON.stringify(h)})`);
  F.close();
}
await wait(6000);                                                               // yeniden doğuş süresi
O.msgs.length = 0; await wait(1500);
const snaps = O.msgs.filter((m) => m.t === 'snap');
check(snaps.length >= 20, `gözcü snapshot almaya devam ediyor (${snaps.length} / 1,5 sn)`);
const s = snaps.at(-1);
const bad = s ? s.s.filter((p) => ![p.x, p.y, p.z, p.yw, p.pt, p.hp].every(Number.isFinite)) : [{}];
check(s && !bad.length, `snapshot'ta sayı dışı (NaN / sonsuz) alan yok (${bad.length})`);
const ticks = snaps.map((m) => m.k), dk = ticks.slice(1).map((k, i) => k - ticks[i]);
check(dk.every((d) => d === 3), `snapshot adımı düzenli (her 3 adım): ${[...new Set(dk)].join(',')}`);
const errs = O.msgs.filter((m) => m.t === 'err');
check(!errs.length, 'gözcüye hata yok');
// çok büyük mesaj: bağlantı kapanmalı (maxPayload), sunucu ayakta
const Big = await open(); let closed = false; Big.on('close', () => { closed = true; });
send(Big, JSON.stringify({ t: 'chat', m: 'x'.repeat(10000) }));
await wait(500);
check(closed, 'büyük mesaj (> 4 KB) bağlantıyı kapattı');
check(!!(await health())?.ok, 'sunucu ayakta');
// mesaj seli (2 sn'de > 1500): bağlantı 4008 ile kapanmalı, oda etkilenmemeli
const Fl = await open(); let flCode = 0; Fl.on('close', (c) => { flCode = c; });
send(Fl, { t: 'join', room, name: 'Sel' }); await until(() => last(Fl, 'welcome'), 5000);
for (let i = 0; i < 3000; i++) send(Fl, { t: 'in', q: i + 1, f: 1 });
await wait(800);
check(flCode === 4008, `mesaj seli bağlantıyı kapattı (kod ${flCode})`);
// odasız bağlantıdan oda mesajları: yok sayılmalı
const N = await open(); for (const t of ['in', 'kill', 'chat', 'opt', 'vote', 'team', 'dbg']) send(N, { t, q: 1, m: 'x' }); await wait(300);
check(!!(await health())?.ok, 'odasız bağlantı mesajları sunucuyu düşürmedi');
A.close(); O.close(); N.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
