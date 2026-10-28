// 12.211 Uzak oda (ana iş parçacığı tarafı): Room ile aynı yüzü (index.js / admin.js / moderation.js'in kullandığı kadarı) verir, asıl oda
// server/roomWorker.js'te kendi iş parçacığında koşar. Ana iş parçacığında kalan: gerçek ws (ping / pong, sel sınırı), oda listesi / admin için
// 500 ms'de bir gelen özet, oyuncu ↔ asker no aynası (moderatör komutları: /kick /ban /oyuncular).
// Ana → iş parçacığı: enter · m (oda mesajı) · leave · bc · sys · official · bal · shutdown
// İş parçacığı → ana: ops [['s', cid, metin] gönder · ['c', cid, id|-1|null, ad] ws.ctx · ['x', cid, kod, sebep] kapat · ['d', cid] bırak · ['st', özet]] · bye
import { Worker } from 'node:worker_threads';
import { sanitizeCfg } from './room.js';

let nextCid = 1;
const WORKER_URL = new URL('./roomWorker.js', import.meta.url);
// Yedek iş parçacığı: haritaları önceden kurulmuş, bekler (yeni büyük oda soğuk başlangıç beklemez). Kullanılınca yenisi arka planda ısınır. BF_SPARE=0 kapalı.
let spare = null;
export function prewarm() {
  if (spare || process.env.BF_SPARE === '0') return;
  const w = new Worker(WORKER_URL, { workerData: { spare: true } });
  spare = { w, ready: false };
  w.on('message', (m) => { if (m.t === 'ready' && spare?.w === w) { spare.ready = true; console.log(`[iş parçacığı] yedek hazır (${m.ms} ms ısınma)`); } });
  w.on('error', (e) => { console.error('[iş parçacığı] yedek hata', e); if (spare?.w === w) spare = null; });
  w.on('exit', () => { if (spare?.w === w) spare = null; });
}
function takeWorker(data) {
  const sp = spare;
  if (sp && sp.ready) { spare = null; sp.w.postMessage({ t: 'init', ...data }); setTimeout(prewarm, 3000).unref?.(); return sp.w; }
  return new Worker(WORKER_URL, { workerData: data });
}

export class RemoteRoom {
  constructor(code, cfg, opts = {}) {
    this.remote = true;
    this.code = code;
    this.official = opts.official || null;
    this.owner = opts.owner || '';
    this.onDead = opts.onDead || (() => {});
    this.cfg = sanitizeCfg(cfg);
    this.cfg.name = this.official ? this.official.name : this.cfg.name || 'Oda ' + code;
    this.conns = new Map();                // cid → gerçek ws (iş parçacığında sahte karşılığı var)
    this.clients = new Map();              // asker no → { id, name, ws } (moderation / admin)
    this.pending = [];                     // maç sonu bekleme listesi { ws }
    this.emptySince = Date.now();
    this.st = null;                        // son özet
    this.alive = true;
    this.worker = takeWorker({ code, cfg, opts: { official: this.official, owner: this.owner } });
    this.worker.on('message', (m) => this.onMsg(m));
    this.worker.on('error', (e) => { console.error(`[${code}] oda iş parçacığı hatası`, e); this.die('Sunucu odası hata verdi, yeniden bağlan'); });
    this.worker.on('exit', (c) => { if (this.alive) { console.error(`[${code}] oda iş parçacığı kapandı (${c})`); this.die('Sunucu odası kapandı, yeniden bağlan'); } });
  }

  onMsg(m) {
    if (m.t === 'bye') { this.alive = false; this.worker.terminate(); return; }
    if (m.t !== 'ops') return;
    for (const o of m.l) {
      const k = o[0];
      if (k === 's') { const ws = this.conns.get(o[1]); if (ws && ws.readyState === 1) ws.send(o[2]); }
      else if (k === 'c') this.setCtx(o[1], o[2], o[3]);
      else if (k === 'x' || k === 'd') {
        const ws = this.conns.get(o[1]); if (!ws) continue;
        this.drop(ws);
        if (k === 'x') try { ws.close(o[2], o[3]); } catch { /* yok say */ }
      } else if (k === 'st') {
        this.st = o[1]; this.cfg = o[1].cfg; this.balVer = o[1].balVer;
        this.emptySince = this.conns.size ? 0 : o[1].emptySince || this.emptySince || Date.now();
      }
    }
  }

  unmirror(ws) {
    for (const [id, c] of this.clients) if (c.ws === ws) this.clients.delete(id);
    const i = this.pending.findIndex((p) => p.ws === ws); if (i >= 0) this.pending.splice(i, 1);
  }
  setCtx(cid, id, name) {
    const ws = this.conns.get(cid); if (!ws) return;
    this.unmirror(ws);
    if (id === null) { ws.ctx = null; return; }
    ws.ctx = { room: this, id };
    if (id === -1) this.pending.push({ ws }); else if (id >= 0) this.clients.set(id, { id, name, ws });
  }
  drop(ws) { this.conns.delete(ws._cid); this.unmirror(ws); if (ws.ctx?.room === this) ws.ctx = null; }

  post(m) { if (this.alive) try { this.worker.postMessage(m); } catch (e) { console.error(`[${this.code}] postMessage`, e.message); } }

  // ── Room yüzü ──
  activate() {}
  enter(ws, p) {
    const cid = nextCid++;
    ws._cid = cid; this.conns.set(cid, ws);
    ws.ctx = { room: this, id: -2 };       // iş parçacığı yanıtlayana dek: oda mesajları buraya gelir (asker no henüz yok)
    this.emptySince = 0;
    this.post({ t: 'enter', cid, p });
    return true;
  }
  message(ws, m) { if (ws._cid && this.conns.get(ws._cid) === ws) this.post({ t: 'm', cid: ws._cid, m }); }
  leave(id, ws, quiet = false) {
    if (!ws || this.conns.get(ws._cid) !== ws) return;
    this.post({ t: 'leave', cid: ws._cid, quiet });
    this.drop(ws);
  }
  broadcast(msg) { this.post({ t: 'bc', msg }); }
  sys(text) { this.post({ t: 'sys', text }); }
  balance() { this.post({ t: 'bal' }); }
  setOfficial(o) { this.official = o; this.post({ t: 'official', o }); }
  idleTick() { return false; }             // boş resmi oda dönüşü iş parçacığında
  shutdown(msg) { this.close(msg || ''); }
  dispose() { this.close(''); }
  close(msg) {
    if (!this.alive) return;
    this.post({ t: 'shutdown', msg });
    setTimeout(() => { if (this.alive) { this.alive = false; this.worker.terminate(); } }, 3000).unref?.();
  }
  // İş parçacığı öldü: bağlantılar ana menüye döner (yuva da gider), oda listeden çıkar (resmi oda syncOfficial ile yeniden kurulur)
  die(msg) {
    if (!this.alive) return;
    this.alive = false;
    for (const ws of this.conns.values()) { ws.ctx = null; try { ws.send(JSON.stringify({ t: 'err', msg })); ws.close(4001, 'closed'); } catch { /* yok say */ } }
    this.conns.clear(); this.clients.clear(); this.pending.length = 0;
    try { this.worker.terminate(); } catch { /* yok say */ }
    this.onDead(this);
  }

  info() {
    if (this.st) return { ...this.st.info, humans: this.clients.size };
    const c = this.cfg;
    return { code: this.code, name: c.name, official: !!this.official, desc: this.official ? this.official.desc : '', map: c.map, tod: c.tod, weather: c.weather, type: c.type, perTeam: c.perTeam, humans: this.clients.size, cap: this.cap, bots: c.bots, diff: c.diff, third: !!c.third, locked: !!c.pw, ended: false, tl: -1, tk: [0, 0], by: this.owner };
  }
  perfStats() { return this.st?.perf || null; }
  adminPlayers() { return this.st?.players || []; }
  get game() { const s = this.st; return { soldiers: { length: s ? s.soldiers : (this.cfg.perTeam || 0) * 2 }, ended: !!s?.ended, timeLeft: s && s.tl >= 0 ? s.tl : Infinity }; }
  get humanCount() { return this.clients.size; }
  get cap() { const t = this.cfg.type; return t === 'dm' || t === 'gg' || t === 'inf' || t === 'pb' ? this.cfg.perTeam : this.cfg.perTeam * 2; }
  canJoin(pw) {
    if (this.cfg.pw && pw !== this.cfg.pw) return 'Şifre yanlış';
    if (this.conns.size >= this.cap) return 'Oda dolu';
    return null;
  }
}
