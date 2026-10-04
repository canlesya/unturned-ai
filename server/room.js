// Bir oda = başsız bir Game + bağlı oyuncular. Sabit adımla (SIM_HZ) çalışır, her SNAP_EVERY adımda snapshot yollar.
import { Game } from '../src/game/game.js';
import { SIM_DT, SIM_HZ, SNAP_EVERY, packSoldier, slowSig, cleanName } from '../src/net/protocol.js';
import { CLASS_DEFS, WSTATS, ZTYPES } from '../src/game/stats.js';
import { defaultTickets } from '../src/game/match.js';
import { MAPS } from '../src/maps/index.js';

const RESTART_MS = +process.env.BF_RESTART_MS || 15000;      // maç bitince sonuç ekranı süresi, sonra oda sıfırlanır

const MAX_PER_TEAM = 32;
const num = (v, lo, hi, d = 0) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

export function sanitizeCfg(c = {}) {
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const type0 = pick(c.type, ['conquest', 'tdm', 'dm', 'gg', 'inf'], 'conquest');
  return {
    map: type0 === 'inf' ? 'newyork' : pick(c.map, ['kasaba', 'vadi', 'us', 'colgecidi'], 'kasaba'),                  // Enfekte yalnızca New York'ta
    tod: pick(c.tod, ['day', 'sunset', 'night'], 'day'),
    weather: pick(c.weather, ['clear', 'rain', 'fog'], 'clear'),
    type: type0,
    diff: type0 === 'inf' ? 'hard' : pick(c.diff, ['easy', 'normal', 'hard'], 'normal'),                   // Enfekte yalnızca Zor botlarla
    perTeam: c.type === 'dm' || c.type === 'gg' ? Math.round(num(c.perTeam, 2, 10, 10)) : c.type === 'inf' ? Math.round(num(c.perTeam, 4, 24, 12)) : Math.round(num(c.perTeam, 1, MAX_PER_TEAM, 5)),     // ölüm maçında ve enfektede perTeam = toplam oyuncu
    tickets: Number.isFinite(c.tickets) && c.tickets > 0 ? Math.round(num(c.tickets, 20, 1000, 200)) : 0,   // 0 = boyuta göre otomatik
    time: Math.round(num(c.time, 0, 3600, 900)),
    bots: c.bots !== false,
    name: cleanRoomName(c.name),
    pw: typeof c.pw === 'string' ? c.pw.slice(0, 16) : '',
    listed: c.listed !== false,
    third: c.third === true,                   // 3. şahıs kamera (H) bu odada serbest mi
  };
}

const cleanRoomName = (n) => String(n || '').replace(/[<>&"'`]/g, '').trim().slice(0, 24);

export class Room {
  // opts.official: { name, desc, rotation:[{map,tod,weather}] } — kalıcı, harita dönen resmi oda
  constructor(code, cfg, opts = {}) {
    this.code = code;
    this.official = opts.official || null;
    this.rot = 0;                                   // resmi odada harita sırası
    this.cfg = sanitizeCfg(cfg);
    this.cfg.name = this.official ? this.official.name : this.cfg.name || 'Oda ' + code;
    if (this.official) { this.cfg.listed = true; this.cfg.pw = ''; }
    this.owner = opts.owner || '';
    this.clients = new Map();        // savaşçı id → { ws, name, h }
    this.emptySince = Date.now();
    this.resetAt = 0;
    this.newGame();
    // sabit adım döngüsü (gecikmeyi telafi eder, aşırı birikmeyi keser)
    this._last = performance.now(); this._acc = 0;
    this._timer = setInterval(() => this.loop(), 4);
  }

  newGame() {
    const c = this.cfg;
    if (this.official) Object.assign(c, this.official.rotation[this.rot % this.official.rotation.length]);   // sıradaki harita
    this.swap = this._swapNext ?? Math.random() < 0.5;                  // asimetrik haritalarda bu maçın taraf dağılımı (sideSwap): ilki rastgele, sonraki maçlar sırayla yer değiştirir
    this._swapNext = !this.swap;
    this.game = new Game(null, {
      headless: true, swapSides: this.swap, map: c.map, tod: c.tod, weather: c.weather, diff: c.diff, bots: c.bots, third: c.third,
      match: { perTeam: c.perTeam, type: c.type, tickets: c.tickets || undefined, time: c.time },
    });
    this.tick = 0;
    this._sig = []; this._forceSlow = true;
    this.resetAt = 0;
    this.game.on('end', (e) => { this.broadcast({ t: 'end', winner: e.winner, why: e.why }); this.resetAt = Date.now() + RESTART_MS; });
  }

  // Maç bitti, oda yeni maça hazırlanıyor: oyuncular yeniden katılır (istemci sayfayı yeniler)
  reset() {
    this.broadcast({ t: 'restart' });
    for (const c of this.clients.values()) c.ws.ctx = null;
    this.clients.clear();
    this.emptySince = Date.now();
    if (this.official && this.game.ended) this.rot++;       // resmi odada sıradaki haritaya geç
    this.game.dispose();
    this.newGame();
  }

  // Listede gösterilen özet (şifre asla yok)
  info() {
    const c = this.cfg, g = this.game;
    return {
      code: this.code, name: c.name, official: !!this.official, desc: this.official ? this.official.desc : '',
      map: c.map, tod: c.tod, weather: c.weather, type: c.type, perTeam: c.perTeam, humans: this.clients.size, cap: this.cap,
      bots: c.bots, diff: c.diff, third: !!c.third, locked: !!c.pw, ended: g.ended, tl: g.timeLeft === Infinity ? -1 : Math.round(g.timeLeft),
      tk: [Math.round(g.tickets.blue), Math.round(g.tickets.red)], by: this.owner,
    };
  }

  // Şifresiz, sunucuya gönderilecek ayarlar
  publicCfg() { const { pw, ...rest } = this.cfg; return { ...rest, locked: !!pw, official: !!this.official, swap: this.swap }; }

  humansOf(team) { let n = 0; for (const id of this.clients.keys()) if (this.game.soldiers[id].team === team) n++; return n; }

  get humanCount() { return this.clients.size; }

  // oda kapasitesi: takımlı modlarda 2 x perTeam, ölüm maçında perTeam
  get cap() { return this.cfg.type === 'dm' || this.cfg.type === 'gg' || this.cfg.type === 'inf' ? this.cfg.perTeam : this.cfg.perTeam * 2; }

  canJoin(pw) {
    if (this.cfg.pw && pw !== this.cfg.pw) return 'Şifre yanlış';
    if (this.game.ended) return 'Maç bitti, yeni maç birazdan başlıyor';
    if (this.clients.size >= this.cap) return 'Oda dolu';
    return null;
  }

  // Takım değiştirme isteği (M menüsü): hedef takımda boş yer var mı?
  teamCheck(id, team) {
    const c = this.clients.get(id);
    if (!c || (team !== 'blue' && team !== 'red')) return { ok: false, msg: 'Geçersiz takım' };
    if (this.game.ffa) return { ok: false, msg: 'Ölüm maçında takım yok' };
    if (this.game.mode.infection) return { ok: false, msg: 'Enfekte modunda takım seçilmez' };
    if (this.game.soldiers[id].team === team) return { ok: false, msg: 'Zaten bu takımdasın' };
    if (this.humansOf(team) >= this.cfg.perTeam) return { ok: false, msg: 'Bu takım dolu' };
    return { ok: true, team };
  }

  roster() {
    return this.game.soldiers.map((s) => ({ id: s.id, name: s.name, team: s.team, cls: s.cls, human: this.game.humans.has(s.id), vac: !!s.vacant }));
  }

  join(ws, name, team, cls, loadout) {
    const g = this.game;
    const counts = { blue: this.humansOf('blue'), red: this.humansOf('red') }, cap = this.cfg.perTeam;
    let t = team === 'blue' || team === 'red' ? team : counts.blue <= counts.red ? 'blue' : 'red';
    if (g.mode.infection) t = 'blue';                                  // Enfekte: gelen insan olarak başlar (blue yoksa claimSlot diğer yarıya geçer)
    else if (!g.ffa) {
      if (counts[t] >= cap) t = t === 'blue' ? 'red' : 'blue';         // seçilen takım doluysa diğeri
      if (counts[t] >= cap) return null;
    }                                                                  // ölüm maçında takım yok: claimSlot boş herhangi bir slotu verir
    // aynı isim varsa sonuna sayı ekle (Sen, Sen 2, ...)
    const taken = new Set(g.soldiers.map((e) => e.name.toLowerCase()));
    let nm = cleanName(name), n = 2;
    while (taken.has(nm.toLowerCase())) nm = `${cleanName(name).slice(0, 13)} ${n++}`;
    let s = g.claimSlot(t, nm, cls, loadout);
    if (!s) s = g.claimSlot(t === 'blue' ? 'red' : 'blue', nm, cls, loadout);
    if (!s) return null;
    const c = { ws, name: s.name, h: g.humans.get(s.id), id: s.id };
    this.clients.set(s.id, c);
    this.emptySince = 0;
    this._forceSlow = true;
    const deps = g.deployables.map((d) => ({ e: 'dep', id: d.id, ty: d.type === 'claymore' ? 'c' : 'a', p: [d.pos.x, d.mesh.position.y - (d.type === 'claymore' ? 0.15 : 0), d.pos.z], ry: d.ry, tm: d.team, by: d.owner.id }));
    ws.send(JSON.stringify({ t: 'welcome', id: s.id, room: this.code, cfg: this.publicCfg(), roster: this.roster(), hz: SIM_HZ, deps }));
    this.broadcast({ t: 'roster', roster: this.roster() }, ws);
    this.sys(`${s.name} odaya katıldı`);
    return c;
  }

  leave(id) {
    if (!this.clients.has(id)) return;
    const nm = this.clients.get(id).name;
    this.clients.delete(id);
    if (this.clients.size) this.sys(`${nm} odadan ayrıldı`);
    this._forceSlow = true;
    this.game.releaseSlot(id);
    if (!this.clients.size) {
      this.emptySince = Date.now();
      // resmi oda boşalınca taze maça hazırlanır (bir sonraki ilk oyuncu temiz başlangıç görür; maç bitmişse sıradaki harita)
      if (this.official) { if (this.game.ended) this.rot++; this.game.dispose(); this.newGame(); return; }
    }
    this.broadcast({ t: 'roster', roster: this.roster() });
  }

  input(id, m) {
    const c = this.clients.get(id);
    if (!c || !Number.isInteger(m.q)) return;
    const h = c.h;
    if (h.queue.length > 60) return;      // taşma koruması
    h.queue.push({
      q: m.q,
      f: Math.round(num(m.f, -1, 1)), r: Math.round(num(m.r, -1, 1)), l: Math.round(num(m.l, -1, 1)),
      s: m.s ? 1 : 0, j: m.j ? 1 : 0, a: m.a ? 1 : 0,
      yw: num(m.yw, -1e4, 1e4), pt: num(m.pt, -1.5, 1.5),
      w: Math.round(num(m.w, 0, 3)),
      c: m.c ? 1 : 0, p: m.p ? 1 : 0, u: m.u ? 1 : 0,
      fh: m.fh ? 1 : 0, fp: m.fp ? 1 : 0, rl: m.rl ? 1 : 0, fm: m.fm ? 1 : 0, o: m.o ? 1 : 0, ab: m.ab ? 1 : 0,
      vt: Number.isFinite(m.vt) ? m.vt : null,
      sd: m.sd ? 1 : 0,
      co: Array.isArray(m.co) && m.co.length === 3 && m.co.every(Number.isFinite) ? m.co.map((v) => Math.max(-4.5, Math.min(4.5, v))) : null,
    });
  }

  // Sohbet: herkese ya da takıma. Sunucu temizler (kontrol karakteri, uzunluk), hız sınırı uygular; gönderen de kendi mesajını sunucudan alır
  chat(id, m) {
    const c = this.clients.get(id);
    if (!c || typeof m.m !== 'string') return;
    const txt = m.m.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);      // kontrol + biçim karakterleri (sıfır genişlik, yön değiştirme) atılır
    if (!txt) return;
    const now = Date.now(), t = (c.chatT ||= []);
    while (t.length && now - t[0] > 6000) t.shift();
    if (t.length >= 4) { if (c.ws.readyState === 1) c.ws.send(JSON.stringify({ t: 'chat', sys: 1, m: 'Çok hızlı yazıyorsun, biraz bekle' })); return; }
    t.push(now);
    const g = this.game, team = c.h.s.team, tc = !!m.tm && !g.ffa;                          // ölüm maçı / silah yarışında takım yok: hep herkese
    const str = JSON.stringify({ t: 'chat', id, name: c.name, team, tc, m: txt });
    for (const o of this.clients.values()) if (o.ws.readyState === 1 && (!tc || o.h.s.team === team)) o.ws.send(str);
  }

  sys(text) { this.broadcast({ t: 'chat', sys: 1, m: text }); }

  // Menüdeki "kill" komutu: oyuncu kendini öldürür (sıkıştı, hızlı yeniden doğmak istiyor). Ölüm sayılır, öldüren olarak kimseye puan yazılmaz.
  suicide(id) {
    const c = this.clients.get(id);
    if (!c || this.game.ended) return;
    const s = c.h.s;
    if (!s.alive) return;
    if (s.suicideT && this.game.time - s.suicideT < 3) return;      // art arda basmayı sınırla
    s.suicideT = this.game.time;
    s.die(s, 'İntihar', false);
  }

  // sonraki doğuş için sınıf / yükleme / doğma noktası
  opt(id, m) {
    const c = this.clients.get(id);
    if (!c) return;
    const h = c.h, g = this.game, str = (v) => (typeof v === 'string' ? v.slice(0, 24) : undefined);
    if (typeof m.optic === 'string' && h.s.alive) h.s.setOptic(m.optic);             // T tekerleği: nişangâh seçimi hemen geçerli
    if (typeof m.cls === 'string' && CLASS_DEFS[m.cls] && m.cls !== 'zombie') h.pendingClass = m.cls;
    if (typeof m.zt === 'string' && ZTYPES[m.zt]) h.pendingZ = m.zt;                  // Enfekte: bir sonraki doğuşta zombi türü
    if (m.loadout && typeof m.loadout === 'object') h.pendingLoadout = { primary: str(m.loadout.primary), secondary: str(m.loadout.secondary), gadget: str(m.loadout.gadget), melee: str(m.loadout.melee) };
    if (typeof m.spawn === 'string') h.spawnChoice = m.spawn === 'base' || g.mode.objectives.some((o) => o.id === m.spawn) ? m.spawn : 'base';
  }

  // BF_DEBUG=1 ile açılan test komutları: { t:'dbg', tp:[x,z] } ışınla · { hp } can · { bots:false } botları sustur
  debug(id, m) {
    const c = this.clients.get(id), g = this.game;
    if (!c) return;
    const s = c.h.s;
    if (Array.isArray(m.tp)) { s.pos.set(m.tp[0], g.world.heightAt(m.tp[0], m.tp[1]), m.tp[2 - 1]); s.vel.set(0, 0, 0); g.world.settle(s); s.protT = 0; }
    if (Number.isFinite(m.hp)) s.hp = m.hp;
    if (Array.isArray(m.item) && WSTATS[m.item[1]]) s.items[m.item[0] | 0] = { id: m.item[1], mag: 3, reserve: 0 };
    if (m.kill) s.takeDamage(9999, s, 'body', s.pos, 'test'), s.protT = 0;
    if (Array.isArray(m.tk)) { g.tickets.blue = +m.tk[0]; g.tickets.red = +m.tk[1]; }
    if (m.bots === false) { g.brainsOff = g.brains.splice(0); }
    if (m.bots === true && g.brainsOff) { g.brains.push(...g.brainsOff); g.brainsOff = null; }
  }

  broadcast(msg, except) {
    const str = JSON.stringify(msg);
    for (const c of this.clients.values()) if (c.ws !== except && c.ws.readyState === 1) c.ws.send(str);
  }

  loop() {
    const now = performance.now();
    if (!this.clients.size) { this._last = now; this._acc = 0; return; }       // izleyen yok: simülasyonu durdur (CPU)
    this._acc = Math.min(this._acc + (now - this._last) / 1000, 0.25);
    this._last = now;
    while (this._acc >= SIM_DT) { this._acc -= SIM_DT; this.step(); }
    if (this.resetAt && Date.now() >= this.resetAt) this.reset();
  }

  step() {
    const g = this.game;
    g.step(SIM_DT);
    this.tick = g.tick;
    for (const c of this.clients.values()) if (c.h.tickAck) c.h.ackState = packSoldier(c.h.s);
    if (g.netEvents.length) { this.broadcast({ t: 'ev', l: g.netEvents }); g.netEvents.length = 0; }
    if (this.tick % SNAP_EVERY === 0 && this.clients.size) this.snapshot();
  }

  snapshot() {
    const g = this.game;
    // yavaş alanlar yalnızca değişen savaşçılarda (ya da 2 sn'de bir / yeni katılımda) gönderilir
    const force = this._forceSlow || this.tick % (SNAP_EVERY * 40) === 0;
    this._forceSlow = false;
    const sig = (this._sig ||= []);
    const all = JSON.stringify(g.soldiers.map((s) => { const sg = slowSig(s), ch = force || sig[s.id] !== sg; if (ch) sig[s.id] = sg; return packSoldier(s, ch); }));
    const o = JSON.stringify(g.mode.objectives.map((ob) => [ob.owner === 'blue' ? 1 : ob.owner === 'red' ? 2 : 0, Math.round(ob.p * 100) / 100]));
    const tl = g.timeLeft === Infinity ? -1 : Math.round(g.timeLeft * 10) / 10;
    const head = `{"t":"snap","k":${this.tick},"tk":[${Math.round(g.tickets.blue)},${Math.round(g.tickets.red)}],"tl":${tl},"o":${o},"s":${all},"me":`;
    for (const c of this.clients.values()) {
      if (c.ws.readyState !== 1) continue;
      const h = c.h, s = h.s;
      const me = { ack: h.ack, rs: s.spawnN, st: h.ackState || packSoldier(s), now: packSoldier(s), rt: +s.respawnT.toFixed(2), am: s.items.map((it) => [it.mag, it.reserve]), ab: [+s.abT.toFixed(1), +s.abActive.toFixed(1)] };
      c.ws.send(head + JSON.stringify(me) + '}');
    }
  }

  dispose() {
    clearInterval(this._timer);
    this.game.dispose();
  }
}
