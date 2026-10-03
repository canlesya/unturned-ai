// İstemci ağ katmanı: bağlantı, istemci tarafı tahmin (prediction) + sunucu uzlaştırması (reconciliation),
// uzaktaki oyuncular için snapshot interpolasyonu.
import { SIM_HZ, SIM_DT, applyFlags } from './protocol.js';
import { applyInput } from '../sim/input.js';
import { WSTATS } from '../game/stats.js';

const INTERP_DELAY_TICKS = 6;          // 100 ms geriden göster (20 Hz snapshot'ta iki örnek arası interpolasyon)
const POS_EPS = 0.05;                  // tahmin–sunucu farkı bunu aşarsa düzelt (m)
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * t;
const mkItem = (id) => ({ id, mag: WSTATS[id].mag ?? 0, reserve: WSTATS[id].reserve ?? 0 });

export class NetClient {
  constructor(ws) {
    this.ws = ws;
    this.game = null;
    this.snaps = [];                   // { k, t, s }  (interpolasyon tamponu)
    this.offset = null;                // sunucu zamanı (ms) − yerel zaman (ms) tahmini
    this.seq = 0;
    this.hist = [];                    // gönderilmiş, henüz onaylanmamış girdiler
    this.edges = {};
    this.rt = 0;                       // son gösterilen (interpolasyon) sunucu adımı: atışta vt olarak gider
    this.rs = null;
    this.stats = { corrections: 0, lastErr: 0, snaps: 0, rtt: 0 };
    this.pendingMe = null;
    this._ping = setInterval(() => this.send({ t: 'ping', c: performance.now() }), 2000);
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
    ws.onclose = () => { this.closed = true; clearInterval(this._ping); this.game?.onNetClosed?.(); };
  }

  // Sunucuya bağlan ve oda kur/katıl. Çözülen değer: { net, welcome }
  static connect(url, hello) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const net = new NetClient(ws);
      const timer = setTimeout(() => { reject(new Error('Sunucuya bağlanılamadı')); ws.close(); }, 8000);
      ws.onerror = () => { clearTimeout(timer); reject(new Error('Sunucuya bağlanılamadı: ' + url)); };
      ws.onopen = () => ws.send(JSON.stringify(hello));
      net.onWelcome = (w) => { clearTimeout(timer); resolve({ net, welcome: w }); };
      net.onError = (msg) => { clearTimeout(timer); reject(new Error(msg)); ws.close(); };
    });
  }

  attach(game) { this.game = game; for (const m of this.queued || []) this.onMessage(m); this.queued = null; }

  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }

  onMessage(m) {
    if (m.t === 'pong') { const r = performance.now() - m.c; this.stats.rtt = this.stats.rtt ? this.stats.rtt * 0.7 + r * 0.3 : r; return; }
    if (m.t === 'welcome') return this.onWelcome?.(m);
    if (m.t === 'err') return this.onError?.(m.msg);
    if (!this.game) { (this.queued ||= []).push(m); return; }
    if (m.t === 'snap') return this.onSnap(m);
    if (m.t === 'roster') return this.onRoster(m.roster);
    if (m.t === 'team') return this.game.onNetTeam?.(m);
    if (m.t === 'end') return this.game.onNetEnd?.(m);
    if (m.t === 'ev') return this.game.onNetEvents?.(m.l);
    if (m.t === 'restart') return this.game.onNetRestart?.();
  }

  // ── girdi ──
  edge(k) { this.edges[k] = 1; }

  // Player.update içinde applyInput'tan hemen sonra çağrılır (adım başına bir kez)
  pushInput(inp, s, fireHeld) {
    const e = this.edges; this.edges = {};
    const q = ++this.seq;
    this.send({
      t: 'in', q, f: inp.f, r: inp.r, l: inp.lean, s: inp.sprint ? 1 : 0, j: inp.jump ? 1 : 0, a: s.ads ? 1 : 0, w: s.cur,
      yw: +s.yaw.toFixed(4), pt: +s.pitch.toFixed(4), c: e.c | 0, p: e.p | 0, u: e.u | 0,
      fh: fireHeld ? 1 : 0, fp: e.fp | 0, rl: e.rl | 0, fm: e.fm | 0, o: e.o | 0, vt: +this.rt.toFixed(2),
    });
    const fire = !!(fireHeld || e.fp || e.rl);
    this.hist.push({ q, fire, inp: { f: inp.f, r: inp.r, lean: inp.lean, sprint: !!inp.sprint, jump: !!inp.jump }, yaw: s.yaw, pitch: s.pitch, e, st: { x: s.pos.x, y: s.pos.y, z: s.pos.z } });
    if (this.hist.length > 240) this.hist.shift();
  }

  // ── snapshot ──
  onSnap(m) {
    const now = performance.now();
    const cand = now - (m.k / SIM_HZ) * 1000;
    this.offset = this.offset === null ? cand : cand < this.offset ? cand : this.offset + (cand - this.offset) * 0.02;
    this.snaps.push({ k: m.k, s: m.s });
    if (this.snaps.length > 30) this.snaps.shift();
    this.stats.snaps++;
    const g = this.game;
    g.tickets.blue = m.tk[0]; g.tickets.red = m.tk[1];
    g.timeLeft = m.tl < 0 ? Infinity : m.tl;
    m.o.forEach((o, i) => { const ob = g.mode.objectives[i]; if (!ob) return; const prev = ob.owner; ob.owner = o[0] === 1 ? 'blue' : o[0] === 2 ? 'red' : null; ob.p = o[1]; if (ob.owner !== prev) g.onFlag?.(ob, prev); });
    this.reconcile(m.me);
  }

  onRoster(roster) {
    const g = this.game;
    this.roster = roster;
    for (const r of roster) {
      const s = g.soldiers[r.id]; if (!s) continue;
      s.name = r.name; s.vacant = !!r.vac;
      if (s.cls !== r.cls) s.setClass(r.cls);
    }
  }

  // Sunucu durumunu bir savaşçıya uygula (uzaktakiler ve doğma/ölüm geçişleri)
  applyState(s, p, local) {
    if (p.a && !s.alive) s.spawn({ x: p.x, z: p.z, ry: p.yw }, 0);
    else if (!p.a && s.alive) { s.alive = false; s.hp = 0; s.deadT = 0; s.deadDir = Math.random() > 0.5 ? 1 : -1; s.ads = false; s.reloadT = 0; s.vel.set(0, 0, 0); }
    s.hp = p.hp;
    s.kills = p.kl; s.deaths = p.de; s.score = p.sc; s.revivable = !!p.rv;
    if (s.items.length !== p.it.length || s.items.some((it, i) => it.id !== p.it[i])) {
      s.items = p.it.map(mkItem);
      s._modelWeapon = undefined;
      if (local) this.game.emit('switch', s);
      else { s.cur = p.c; s._syncWeaponModel(true); }
    }
    if (!local) {
      if (s.cur !== p.c) { s.cur = p.c; s._syncWeaponModel(); }
      applyFlags(s, p.f);
      s.leanDir = p.l;
    }
  }

  applyAmmo(s, me) {
    if (!me.am || me.am.length !== s.items.length) return;
    me.am.forEach(([mag, reserve], i) => { s.items[i].mag = mag; s.items[i].reserve = reserve; });
  }

  // ── tahmin uzlaştırma (yerel oyuncu) ──
  reconcile(me) {
    const g = this.game, s = g.playerSoldier;
    if (!s) return;
    if (me.rs !== this.rs) {
      // ilk snapshot veya yeniden doğma: sunucunun şu anki durumuna geç
      this.rs = me.rs; this.hist.length = 0;
      const p = me.now;
      this.applyState(s, p, true);
      s.pos.set(p.x, p.y, p.z); s.vel.set(p.vx, p.vy, p.vz);
      s.yaw = p.yw; s.pitch = p.pt; s.protT = 0; s.cur = p.c; s.respawnT = me.rt;
      applyFlags(s, p.f);
      this.applyAmmo(s, me);
      return;
    }
    const st = me.st;
    s.kills = me.now.kl; s.deaths = me.now.de; s.score = me.now.sc;
    // ölüm/yaşam durumu SUNUCUNUN ŞU ANKİ durumundan (me.now) alınır: ack anındaki durum (me.st) ölünce güncellenmez (girdi işlenmez)
    if (!me.now.a) { if (s.alive) this.applyState(s, me.now, true); this.hist.length = 0; s.respawnT = me.rt; return; }
    if (!s.alive) { this.applyState(s, me.now, true); }
    s.hp = st.hp;
    // sunucunun işlediği son girdi (ack) anındaki tahminimizle karşılaştır
    let rec = null;
    while (this.hist.length && this.hist[0].q <= me.ack) rec = this.hist.shift();
    if (!this.hist.some((h) => h.fire)) this.applyAmmo(s, me);     // uçuşta ateş/şarjör yoksa cephaneyi sunucuya eşitle
    if (!rec || rec.q !== me.ack) return;
    const err = Math.hypot(rec.st.x - st.x, rec.st.y - st.y, rec.st.z - st.z);
    this.stats.lastErr = err;
    if (err <= POS_EPS) return;
    this.stats.corrections++;
    // düzelt: sunucu durumuna dön, onaylanmamış girdileri yeniden oynat
    const keepYaw = s.yaw, keepPitch = s.pitch;
    s.pos.set(st.x, st.y, st.z); s.vel.set(st.vx, st.vy, st.vz);
    applyFlags(s, st.f);
    for (const h of this.hist) {
      g.world.move(s, SIM_DT);
      s.yaw = h.yaw; s.pitch = h.pitch;
      if (h.e.u) s.standUp();
      if (h.e.c) s.toggleCrouch();
      if (h.e.p) s.toggleProne();
      applyInput(s, h.inp, SIM_DT);
      h.st = { x: s.pos.x, y: s.pos.y, z: s.pos.z };
    }
    s.yaw = keepYaw; s.pitch = keepPitch;
  }

  // Uzaktaki oyuncuları interpolasyonla yerleştir (her sim adımında)
  interpolate(nowMs) {
    const g = this.game, S = this.snaps;
    if (!S.length || this.offset === null) return;
    const rt = ((nowMs - this.offset) / 1000) * SIM_HZ - INTERP_DELAY_TICKS;   // gösterilecek sunucu adımı
    this.rt = rt;
    let a = S[0], b = S[0];
    for (let i = 0; i < S.length; i++) { if (S[i].k <= rt) { a = S[i]; b = S[Math.min(i + 1, S.length - 1)]; } else break; }
    if (S[0].k > rt) a = b = S[0];
    const t = b.k > a.k ? Math.max(0, Math.min(1, (rt - a.k) / (b.k - a.k))) : 0;
    const me = g.playerSoldier;
    const bi = new Map(b.s.map((p) => [p.i, p]));
    for (const pa of a.s) {
      const s = g.soldiers[pa.i];
      if (!s || s === me) continue;
      const pb = bi.get(pa.i) || pa;
      this.applyState(s, pa, false);
      s.pos.set(lerp(pa.x, pb.x, t), lerp(pa.y, pb.y, t), lerp(pa.z, pb.z, t));
      s.vel.set(pa.vx, pa.vy, pa.vz);
      s.yaw = lerpAngle(pa.yw, pb.yw, t);
      s.pitch = lerp(pa.pt, pb.pt, t);
    }
  }
}
