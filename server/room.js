// Bir oda = başsız bir Game + bağlı oyuncular. Sabit adımla (SIM_HZ) çalışır, her SNAP_EVERY adımda snapshot yollar.
import { Game } from '../src/game/game.js';
import { SIM_DT, SIM_HZ, SNAP_EVERY, packSoldier, cleanName } from '../src/net/protocol.js';

const MAX_PER_TEAM = 32;
const num = (v, lo, hi, d = 0) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

export function sanitizeCfg(c = {}) {
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  return {
    map: pick(c.map, ['kasaba', 'vadi', 'us'], 'kasaba'),
    tod: pick(c.tod, ['day', 'sunset', 'night'], 'day'),
    weather: pick(c.weather, ['clear', 'rain', 'fog'], 'clear'),
    type: pick(c.type, ['conquest', 'tdm'], 'conquest'),
    diff: pick(c.diff, ['easy', 'normal', 'hard'], 'normal'),
    perTeam: Math.round(num(c.perTeam, 1, MAX_PER_TEAM, 5)),
    tickets: Math.round(num(c.tickets, 20, 1000, 200)),
    time: Math.round(num(c.time, 0, 3600, 900)),
  };
}

export class Room {
  constructor(code, cfg, onClose) {
    this.code = code;
    this.cfg = sanitizeCfg(cfg);
    this.onClose = onClose;
    const c = this.cfg;
    this.game = new Game(null, {
      headless: true, map: c.map, tod: c.tod, weather: c.weather, diff: c.diff,
      match: { perTeam: c.perTeam, type: c.type, tickets: c.tickets, time: c.time },
    });
    this.clients = new Map();        // savaşçı id → { ws, name, h }
    this.tick = 0;
    this.emptySince = Date.now();
    this.game.on('end', (e) => this.broadcast({ t: 'end', winner: e.winner, why: e.why }));
    // sabit adım döngüsü (gecikmeyi telafi eder, aşırı birikmeyi keser)
    this._last = performance.now(); this._acc = 0;
    this._timer = setInterval(() => this.loop(), 4);
  }

  get humanCount() { return this.clients.size; }

  roster() {
    return this.game.soldiers.map((s) => ({ id: s.id, name: s.name, team: s.team, cls: s.cls, human: this.game.humans.has(s.id) }));
  }

  join(ws, name, team) {
    const g = this.game;
    const counts = { blue: 0, red: 0 };
    for (const id of this.clients.keys()) counts[g.soldiers[id].team]++;
    const t = team === 'blue' || team === 'red' ? team : counts.blue <= counts.red ? 'blue' : 'red';
    let s = g.claimSlot(t, cleanName(name));
    if (!s) s = g.claimSlot(t === 'blue' ? 'red' : 'blue', cleanName(name));
    if (!s) return null;
    const c = { ws, name: s.name, h: g.humans.get(s.id), id: s.id };
    this.clients.set(s.id, c);
    this.emptySince = 0;
    ws.send(JSON.stringify({ t: 'welcome', id: s.id, room: this.code, cfg: this.cfg, roster: this.roster(), hz: SIM_HZ }));
    this.broadcast({ t: 'roster', roster: this.roster() }, ws);
    return c;
  }

  leave(id) {
    if (!this.clients.has(id)) return;
    this.clients.delete(id);
    this.game.releaseSlot(id);
    if (!this.clients.size) this.emptySince = Date.now();
    this.broadcast({ t: 'roster', roster: this.roster() });
  }

  input(id, m) {
    const c = this.clients.get(id);
    if (!c || !Number.isInteger(m.q)) return;
    const h = c.h;
    if (h.queue.length > 30) return;      // taşma koruması
    h.queue.push({
      q: m.q,
      f: Math.round(num(m.f, -1, 1)), r: Math.round(num(m.r, -1, 1)), l: Math.round(num(m.l, -1, 1)),
      s: m.s ? 1 : 0, j: m.j ? 1 : 0, a: m.a ? 1 : 0,
      yw: num(m.yw, -1e4, 1e4), pt: num(m.pt, -1.5, 1.5),
      c: m.c ? 1 : 0, p: m.p ? 1 : 0, u: m.u ? 1 : 0,
    });
  }

  broadcast(msg, except) {
    const str = JSON.stringify(msg);
    for (const c of this.clients.values()) if (c.ws !== except && c.ws.readyState === 1) c.ws.send(str);
  }

  loop() {
    const now = performance.now();
    this._acc = Math.min(this._acc + (now - this._last) / 1000, 0.25);
    this._last = now;
    while (this._acc >= SIM_DT) { this._acc -= SIM_DT; this.step(); }
  }

  step() {
    const g = this.game;
    g.step(SIM_DT);
    this.tick++;
    for (const c of this.clients.values()) if (c.h.tickAck) c.h.ackState = packSoldier(c.h.s);
    if (this.tick % SNAP_EVERY === 0 && this.clients.size) this.snapshot();
  }

  snapshot() {
    const g = this.game;
    const all = JSON.stringify(g.soldiers.map(packSoldier));
    const o = JSON.stringify(g.mode.objectives.map((ob) => [ob.owner === 'blue' ? 1 : ob.owner === 'red' ? 2 : 0, Math.round(ob.p * 100) / 100]));
    const tl = g.timeLeft === Infinity ? -1 : Math.round(g.timeLeft * 10) / 10;
    const head = `{"t":"snap","k":${this.tick},"tk":[${Math.round(g.tickets.blue)},${Math.round(g.tickets.red)}],"tl":${tl},"o":${o},"s":${all},"me":`;
    for (const c of this.clients.values()) {
      if (c.ws.readyState !== 1) continue;
      const h = c.h, s = h.s;
      const me = { ack: h.ack, rs: s.spawnN, st: h.ackState || packSoldier(s), now: packSoldier(s) };
      c.ws.send(head + JSON.stringify(me) + '}');
    }
  }

  dispose() {
    clearInterval(this._timer);
    this.game.dispose();
  }
}
