// WarByte çok oyunculu sunucu: node server/index.js   (PORT ortam değişkeniyle değişir, varsayılan 8787)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import os from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { Room, sanitizeCfg, ROOM_MSGS } from './room.js';
import { RemoteRoom, prewarm } from './roomHost.js';
import { officialList, reloadOfficial } from './officialStore.js';
import { DEFAULT_PORT, makeRoomCode, cleanName } from '../src/net/protocol.js';
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
import { Game } from '../src/game/game.js';
import { useBalance } from '../src/game/balance.js';
import { cleanSkins } from '../src/game/stats.js';
import { cleanWear } from '../src/game/wearIds.js';
import { loadBalance, currentBalance, onBalance } from './balanceStore.js';
import { startAdmin } from './admin.js';
import { handleApi, byToken, guestName, ipOf, nameKey } from './accounts.js';
import { runCommand, checkBan, refuse } from './moderation.js';
MapBuilder.noVisual = true;          // sunucuda görsel geometri kurulmaz

const PORT = +process.env.PORT || DEFAULT_PORT;
const MAX_ROOMS = +process.env.MAX_ROOMS || 20;
// 12.203 süreç başına asker bütçesi (bütün odaların botları + insanları tek iş parçacığında adımlanır). Ölçüm (scripts/scalesim.mjs, M serisi Mac, sakin):
// 128v128 Kuzey Vadisi odası adım başına ~5,5–6 ms (asker başına ~23 µs); 60 Hz bütçesi 16,7 ms → 600 asker ≈ %80. Yeni oyuncu odası bütçeyi aşacaksa
// takım başına sayı kalan bütçeye kırpılır (en az 4v4), sığmıyorsa "Sunucu dolu". Boş resmi oda (adımlanmaz) sayılmaz. VPS daha yavaşsa BF_MAX_SOLDIERS ile düşür.
const MAX_SOLDIERS = +process.env.BF_MAX_SOLDIERS || 600;
const rooms = new Map();
loadBalance();

// 12.211 oda iş parçacıkları: kalabalık oda (> BF_WORKER_MIN asker, varsayılan 64 → 33v33 ve üstü) kendi worker_threads iş parçacığında koşar
// (server/roomWorker.js). Canlıda 128v128 Kuzey odasının adımı bütçeyi aşınca aynı süreçteki bütün odalar ve ping / pong bekliyor, oyuncular
// "yanıt yok" diye düşüyordu. Ana iş parçacığında yalnız bağlantılar + küçük odalar kalır. En çok BF_WORKERS iş parçacığı (varsayılan çekirdek − 1);
// dolunca oda eskisi gibi ana iş parçacığında (asker bütçesiyle). BF_WORKER_MIN=0: her oyuncu odası iş parçacığında (test) · BF_WORKERS=0: kapalı.
const WORKER_MIN = process.env.BF_WORKER_MIN != null ? +process.env.BF_WORKER_MIN : 64;
const MAX_WORKERS = process.env.BF_WORKERS != null ? +process.env.BF_WORKERS : Math.max(1, (os.availableParallelism?.() || os.cpus().length) - 1);
const wantsWorker = (n) => MAX_WORKERS > 0 && n > WORKER_MIN && [...rooms.values()].filter((r) => r.remote).length < MAX_WORKERS;
const soldiersOf = (cfg) => { const c0 = sanitizeCfg(cfg), team = !['dm', 'gg', 'inf', 'pb'].includes(c0.type); return team ? c0.perTeam * 2 : c0.perTeam; };
function makeRoom(code, cfg, opts = {}) {
  const n = soldiersOf(cfg);
  if (wantsWorker(n)) {
    console.log(`[${code}] oda iş parçacığında (${n} asker)`);
    return new RemoteRoom(code, cfg, { ...opts, onDead: (r) => { if (rooms.get(code) === r) rooms.delete(code); if (r.official) setTimeout(syncOfficial, 2000); } });
  }
  return new Room(code, cfg, opts);
}
onBalance(() => { for (const r of rooms.values()) if (r.remote) r.balance(); });      // admin denge değişikliği: iş parçacıkları da dosyadan yeniden okur

// Derlenmiş istemci (npm run build → dist/) aynı porttan servis edilir; dist yoksa yalnızca WebSocket sunucusu olarak çalışır
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
function serveStatic(req, res) {
  if (!fs.existsSync(DIST)) { res.writeHead(404); res.end('WarByte sunucusu (istemci derlenmemiş: npm run build)'); return; }
  let rel = decodeURIComponent((req.url || '/').split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(DIST, path.normalize(rel));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }            // dizin dışına çıkma
  fs.readFile(file, (e, data) => {
    if (e) { res.writeHead(404); res.end('Bulunamadı'); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (await handleApi(req, res)) return;                               // hesap uçları: /api/register · login · logout · me · profile (server/accounts.js)
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    // 12.211 workers: iş parçacığındaki odalar (kod, asker, oyuncu) · soldiers: süreçteki toplam asker
    const all = [...rooms.values()];
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: all.reduce((a, r) => a + r.humanCount, 0), soldiers: all.reduce((a, r) => a + (r.game?.soldiers.length || 0), 0),
      workers: all.filter((r) => r.remote).map((r) => ({ code: r.code, soldiers: r.game.soldiers.length, players: r.humanCount, ready: !!r.st })) }));
    return;
  }
  if (req.url === '/balance') {          // istemci: çevrimdışı maçlar için güncel denge ayarları
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    res.end(JSON.stringify(currentBalance()));
    return;
  }
  if (req.url === '/rooms') {
    // oda listesi: resmi odalar önce, sonra herkese açık oyuncu odaları (şifre yok, yalnızca "kilitli mi" bilgisi)
    // resmi odalar panelde belirlenen sırada, sonra oyuncu odaları (kalabalık önce)
    const ord = new Map(officialList().map((o, i) => [o.code, i]));
    const all = [...rooms.values()].filter((r) => r.official || r.cfg.listed).map((r) => r.info());
    all.sort((x, y) => (y.official - x.official) || (x.official ? (ord.get(x.code) ?? 99) - (ord.get(y.code) ?? 99) : y.humans - x.humans));
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    res.end(JSON.stringify(all));
    return;
  }
  serveStatic(req, res);
});
// 12.187: permessage-deflate (tarayıcı kendiliğinden anlaşır; eski istemci / vekil desteklemezse sıkıştırmasız sürer → protokol aynı).
// Snapshot JSON'u bağlam sürdürmeyle ~8–9× küçülür (Kuzey 16v16 4,6 KB → ~0,5 KB, Çöl Geçidi 10 kişi 1,45 KB → ~0,18 KB): 3–4 TCP
// segmenti yerine tek segment → kayıplı Wi-Fi'de yeniden gönderim takılması ihtimali düşer, mobilde bant ~%88 azalır. Seviye 1 (~0,05 ms / mesaj).
// maxPayload açılmış boyuta da uygulanır (sıkıştırma bombası yok). Kapatmak: BF_DEFLATE=0
const DEFLATE = process.env.BF_DEFLATE !== '0' && { zlibDeflateOptions: { level: 1, memLevel: 8 }, threshold: 200, concurrencyLimit: 16 };
const wss = new WebSocketServer({ server, maxPayload: 4096, perMessageDeflate: DEFLATE });

const MSG_CAP = +process.env.BF_MSG_CAP || 1500;
function err(ws, msg) { ws.send(JSON.stringify({ t: 'err', msg })); }

wss.on('connection', (ws, req) => {
  ws.ctx = null;                 // { room, id }
  ws.pwFails = 0;
  ws.ip = ipOf(req);             // ban / atma engeli (moderation.js)
  ws.msgN = 0; ws.msgT = Date.now(); ws.missed = 0;
  ws.on('pong', () => { ws.missed = 0; });
  ws.on('message', (data) => {
    ws.missed = 0;
    if (ws.dead) return;         // atıldı / banlandı: kapanana dek hiçbir şey işlenmez
    // 12.187: bağlantı başına mesaj seli sınırı. Gerçek istemci ~65 mesaj/sn (60 girdi + ping / olay); 5 sn'lik takılmadan sonraki yığın da
    // 2 sn'lik pencerede ~450. 2 sn'de 1500'ü aşan bağlantı kapanır (her mesaj JSON ayrıştırma + kuyruk işi: tek istemci odanın adımını yavaşlatmasın)
    const nowM = Date.now();
    if (nowM - ws.msgT > 2000) { ws.msgT = nowM; ws.msgN = 0; }
    if (++ws.msgN > MSG_CAP) { ws.dead = true; console.log(`[sel] ${ws.ip} çok fazla mesaj, bağlantı kapatıldı`); try { ws.close(4008, 'flood'); } catch { /* yok say */ } return; }
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'ping') { ws.send(JSON.stringify({ t: 'pong', c: m.c })); return; }
    if (ROOM_MSGS.has(m.t)) {                            // oda mesajı: girdi, intihar, sohbet, seçenek, işaret, test, oy, takım (room.js roomMessage; uzak odada iş parçacığına)
      if (!ws.ctx) return;
      if (m.t === 'chat' && typeof m.m === 'string' && m.m.trimStart().startsWith('/')) return command(ws, m.m);      // moderatör komutu: sohbete yayınlanmaz
      ws.ctx.room.message(ws, m);
      return;
    }
    if (ws.ctx) return err(ws, 'Zaten bir odadasın');
    if (m.t === 'create' || m.t === 'join') {                                        // banlı / yeni atılmış: odaya girmeden reddedilir
      ws.who = identify(ws, m);
      const b = checkBan(ws.who);
      if (b) { console.log(`[mod] giriş reddedildi (${b.k}): ${ws.who.name} ${ws.ip}`); return refuse(ws, b); }
    }
    if (m.t === 'create') {
      if ([...rooms.values()].filter((r) => !r.official).length >= MAX_ROOMS) return err(ws, 'Sunucu dolu, sonra tekrar dene');
      if (!createOk(ws.ip)) return err(ws, 'Çok hızlı oda kuruyorsun, biraz bekle');
      let code; do code = makeRoomCode(); while (rooms.has(code) || /^OFC\d/.test(code));            // OFC* resmi sunuculara ayrılmış
      const owner = playerName(m);
      useBalance(currentBalance());                     // yeni oda: güncel sınırlarla doğrulanır
      const cfg = { ...(m.cfg || {}) };
      if (!cfg.name || !String(cfg.name).trim()) cfg.name = `${owner}'in odası`;
      { const used = [...rooms.values()].reduce((n, r) => n + (!r.remote && (!r.official || r.clients.size) ? r.game?.soldiers.length || 0 : 0), 0),      // boş resmi oda adımlanmaz (CPU yok): sayılmaz · 12.211 iş parçacığındaki oda ana iş parçacığının bütçesinden yemez
         c0 = sanitizeCfg(cfg), team = !['dm', 'gg', 'inf', 'pb'].includes(c0.type), need = team ? c0.perTeam * 2 : c0.perTeam;
        if (!wantsWorker(need) && used + need > MAX_SOLDIERS) { const fit = Math.floor((MAX_SOLDIERS - used) / (team ? 2 : 1)); if (fit < 4) return err(ws, 'Sunucu dolu, sonra tekrar dene'); cfg.perTeam = Math.min(c0.perTeam, fit); console.log(`[bütçe] oda ${c0.perTeam} → ${cfg.perTeam} (kullanılan ${used}/${MAX_SOLDIERS} asker)`); } }
      const room = makeRoom(code, cfg, { owner });
      rooms.set(code, room);
      enter(ws, room, m);
    } else if (m.t === 'join') {
      const room = rooms.get(String(m.room || '').toUpperCase());
      if (!room) return err(ws, 'Oda bulunamadı');
      const why = room.canJoin(typeof m.pw === 'string' ? m.pw : '');
      if (why) {
        if (why === 'Şifre yanlış' && ++ws.pwFails > 5) { err(ws, 'Çok fazla yanlış şifre'); ws.close(); return; }       // kaba kuvvet frenleme
        return err(ws, why);
      }
      enter(ws, room, m);
    }
  });
  ws.on('close', () => { if (ws.ctx) { ws.ctx.room.activate(); ws.ctx.room.leave(ws.ctx.id, ws); } });
  ws.on('error', () => {});
});

// 12.187: IP başına oda kurma sınırı (dakikada BF_CREATE_RATE, varsayılan 8). Yeni oda kurmak olay döngüsünü ~40-60 ms tutuyor (12.137):
// tek kişi açıp kapattığı bağlantılarla saniyede oda kurarsa dolu odalardaki herkes takılırdı. Yerel (vekilsiz loopback) test bağlantıları muaf.
const CREATE_RATE = +process.env.BF_CREATE_RATE || 8, creates = new Map();
function createOk(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  const now = Date.now(), t = (creates.get(ip) || []).filter((x) => now - x < 60000);
  if (t.length >= CREATE_RATE) { creates.set(ip, t); return false; }
  t.push(now); creates.set(ip, t);
  if (creates.size > 5000) for (const [k, v] of creates) if (!v.length || now - v[v.length - 1] > 60000) creates.delete(k);      // bellek: eski kayıtlar
  return true;
}

// Kim: hesap (geçerli jeton) ya da misafir; ad anahtarı + IP (ban / moderatör yetkisi bununla)
function identify(ws, m) {
  const a = byToken(m.tok);
  const name = a ? a.name : guestName(cleanName(m.name));
  return { name, key: nameKey(name), acct: !!a, ip: ws.ip };
}

// Sohbetten '/' komutu (server/moderation.js): yanıt yalnız gönderene; hız sınırı 10 sn'de 8 (test: BF_CMD_RATE)
const CMD_RATE = +process.env.BF_CMD_RATE || 8;
function command(ws, text) {
  const room = ws.ctx.room, c = room.clients.get(ws.ctx.id);
  if (!c || c.ws !== ws) return;
  const now = Date.now(), t = (ws.cmdT ||= []);
  while (t.length && now - t[0] > 10000) t.shift();
  const reply = (s) => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'chat', sys: 1, m: s })); };
  if (t.length >= CMD_RATE) return reply('Çok hızlı komut yazıyorsun, biraz bekle');
  t.push(now);
  let lines;
  try { lines = runCommand(text.replace(/[\p{Cc}\p{Cf}]/gu, ' ').trim().slice(0, 160), { rooms, room, client: c, now }); } catch (e) { console.error('[mod]', e); lines = ['Komut çalıştırılamadı']; }
  for (const s of lines) reply(s);
}

// Odadaki ad: geçerli jetonla hesabın adı (istemci değiştiremez); jetonsuz / sahte jetonla misafir, kayıtlı bir adı aldıysa sonuna sayı (Ali → Ali2)
function playerName(m) {
  const a = byToken(m.tok);
  return a ? a.name : guestName(cleanName(m.name));
}

function enter(ws, room, m) {
  const name = playerName(m);
  const skins = cleanSkins(m.skins);                                                     // silah kaplamaları (bilinen silah / kaplama dışı atılır)
  const wear = cleanWear(m.wear);                                                        // 12.167 kıyafet tercihi (sınıf başına kod / tüm sınıflar); eski istemci yollamaz → varsayılan
  const t = (v) => (typeof v === 'string' ? v.slice(0, 24) : undefined);
  const loadout = m.loadout && typeof m.loadout === 'object' && !Array.isArray(m.loadout) ? JSON.parse(JSON.stringify(m.loadout)) : undefined;      // iş parçacığına yapılandırılmış kopya (yalnız JSON değerleri)
  room.enter(ws, { name, team: t(m.team), cls: t(m.cls), loadout, skins, wear });     // room.js enterRoom: maç bitmişse bekleme listesi, doluysa 'Oda dolu'
}

// 12.187: her haritayı açılışta bir kez kur (dinlemeye başlamadan). Bir haritanın süreçteki İLK kurulumu önbellek / JIT yüzünden pahalı
// (ölçüm, scripts/newgamecost.mjs: Batı Cephesi 2,7 sn, Kuzey 0,7 sn, Kasaba 0,56 sn; sonrakiler 1–70 ms): oyun sırasında ilk kez o haritaya
// dönen oda (boş resmi oda dönüşü, yeni oyuncu odası) tüm süreci kilitleyip DOLU odalardaki herkese yarım–üç saniyelik donma yaşatıyordu.
// Kapatmak: BF_WARM=0
function warmMaps() {
  if (process.env.BF_WARM === '0') return;
  const t0 = performance.now(), only = { newyork: 'inf', boyakulesi: 'pb', ormankale: 'pb', maden: 'payload', cephe: 'front', yorunge: 'space' };
  for (const [id, m] of Object.entries(MAPS)) {
    if (m.dev) continue;
    try { const g = new Game(null, { headless: true, map: id, tod: 'day', weather: 'clear', diff: 'normal', bots: true, match: { perTeam: 4, type: only[id] || 'conquest', time: 600 } }); g.step(1 / 60); g.dispose(); } catch (e) { console.error('[ısınma]', id, e.message); }
  }
  console.log(`[ısınma] haritalar hazır (${Math.round(performance.now() - t0)} ms)`);
}

// Resmi odalar (admin panelinden yönetilir): açık olanlar kurulur, kapatılan / silinen kapanır, değişen sonraki maçta (boşsa hemen) uygulanır
function syncOfficial() {
  useBalance(currentBalance());
  const want = new Map(officialList().filter((o) => o.enabled).map((o) => [o.code, o]));
  for (const [code, r] of rooms) {
    if (r.official && !want.has(code)) { r.shutdown('Bu sunucu yönetici tarafından kapatıldı'); rooms.delete(code); console.log(`[${code}] resmi sunucu kapatıldı`); }
  }
  for (const o of want.values()) {
    let r = rooms.get(o.code);
    const ocfg = { perTeam: o.perTeam, type: o.type, time: o.time, diff: o.diff, bots: o.bots };
    // 12.211 asker sayısı değişip oda yanlış yerde kaldıysa (ör. 32v32 → 128v128 ana iş parçacığında) ve boşsa doğru yerde yeniden kurulur
    if (r && r.official && !r.humanCount && !r.pending?.length) {
      const n = soldiersOf(ocfg), big = MAX_WORKERS > 0 && n > WORKER_MIN;
      if (r.remote ? !big : big && wantsWorker(n)) { r.dispose(); rooms.delete(o.code); r = null; console.log(`[${o.code}] ${n} asker: ${big ? 'iş parçacığına' : 'ana iş parçacığına'} taşınıyor`); }
    }
    if (!r) { rooms.set(o.code, makeRoom(o.code, ocfg, { official: o })); console.log(`[${o.code}] ${o.name} hazır`); }
    else if (r.official) { r.activate(); r.setOfficial(o); }
  }
}

// 12.211 ana iş parçacığının olay döngüsü gecikmesi (bağlantılar + küçük odalar burada): 30 sn'de bir, odada insan varken [başarım] satırı.
// Büyük oda iş parçacığındayken bu değer o odanın adımından bağımsız kalmalı (canlıdaki "yanıt yok" düşmeleri buradaki gecikmeydi).
{
  const h = monitorEventLoopDelay({ resolution: 10 }); h.enable();
  setInterval(() => {
    const humans = [...rooms.values()].reduce((a, r) => a + r.humanCount, 0);
    if (humans) {
      const W = [...rooms.values()].filter((r) => r.remote), ms = (v) => Math.max(0, v / 1e6 - 10).toFixed(1);      // ölçüm 10 ms'lik zamanlayıcıyla: gecikme = ölçülen − 10
      console.log(`[başarım] ana iş parçacığı · döngü gecikmesi ort ${ms(h.mean)} ms (p99 ${ms(h.percentile(99))}, en çok ${ms(h.max)}) · ${rooms.size} oda (${W.length} iş parçacığında: ${W.map((r) => `${r.code} ${r.game.soldiers.length} asker`).join(', ') || '-'}) · ${wss.clients.size} bağlantı, ${humans} oyuncu`);
    }
    h.reset();
  }, 30000).unref?.();
}
warmMaps();
syncOfficial();
if (MAX_WORKERS > 0) prewarm();                 // 12.211 yedek oda iş parçacığı (haritalar kurulu bekler)
// systemctl kill -s HUP warbyte: data/official.json'ı yeniden oku → değişen oda boşsa hemen, oyuncu varsa sonraki maçta (kimse düşmez)
process.on('SIGHUP', () => { try { reloadOfficial(); syncOfficial(); console.log('[resmi] official.json yeniden yüklendi (SIGHUP)'); } catch (e) { console.error('[resmi] yeniden yükleme hatası', e); } });

// boş resmi odalar idleMin dakikada bir yeni harita / gün saatine geçer (listede dönen haritalar).
// Saniyede EN ÇOK BİR oda (12.137): yeni maç kurmak olay döngüsünü oda başına ~40-60 ms tutuyor; 8 boş oda aynı saniyede dönünce
// dolu odadaki oyuncular 10 dakikada bir 170-230 ms snapshot boşluğu yaşıyordu (canlı ölçüm). Sırayla dönünce zamanları da kendiliğinden ayrışır.
setInterval(() => { const now = Date.now(); for (const r of rooms.values()) if (r.official && r.idleTick(now)) break; }, 1000);

// 12.187: kopuk bağlantı bekçisi. Telefon ağ değiştirince / Wi-Fi düşünce eski TCP bağlantısı FIN göndermeden kalır; sunucu yazdıkça
// çekirdek yeniden gönderim süresi (Linux'ta ~15 dk) dolana dek "odada" görünür: asker ortada hareketsiz durur, yuva dolu, aynı ad yeniden
// girince "Ali 2" olur. WebSocket ping çerçevesine tarayıcı arka plandaki sekmede de kendiliğinden yanıt verir (JS zamanlayıcısı gerekmez).
// 10 sn'de bir ping; 3 ping (≈ 30 sn) boyunca ne yanıt ne mesaj gelirse bağlantı kesilir → yuva bota döner.
const PING_MS = +process.env.BF_PING_MS || 10000;
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.missed >= 3) { console.log(`[bağlantı] yanıt yok, kesildi: ${ws.ctx ? ws.ctx.room.clients.get(ws.ctx.id)?.name || '?' : ws.ip}`); ws.terminate(); continue; }
    ws.missed++;
    try { ws.ping(); } catch { /* yok say */ }
  }
}, PING_MS);

// boş oyuncu odalarını temizle (resmi odalar hariç)
setInterval(() => {
  for (const [code, r] of rooms) {
    if (!r.official && !r.humanCount && r.emptySince && Date.now() - r.emptySince > 60000) { r.dispose(); rooms.delete(code); console.log(`[${code}] kapatıldı (boş)`); }
  }
}, 10000);

server.listen(PORT, () => console.log(`WarByte sunucusu :${PORT} üzerinde dinliyor`));
startAdmin({ rooms, syncOfficial });
