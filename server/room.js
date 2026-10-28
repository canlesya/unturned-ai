// Bir oda = başsız bir Game + bağlı oyuncular. Sabit adımla (SIM_HZ) çalışır, her SNAP_EVERY adımda snapshot yollar.
import { Game, applyOpticPrefs, cleanFront } from '../src/game/game.js';
import { SIM_DT, SIM_HZ, SNAP_EVERY, packSoldier, slowSig, cleanName } from '../src/net/protocol.js';
import { CLASS_DEFS, WSTATS, ZTYPES, ZT_ORDER, ZOMBIE, cleanSkins } from '../src/game/stats.js';
import { cleanWear } from '../src/game/wearIds.js';
import { defaultTickets } from '../src/game/match.js';
import { LIMITS, useBalance } from '../src/game/balance.js';
import { currentBalance, balanceMeta } from './balanceStore.js';
import { MAPS } from '../src/maps/index.js';
import { nextOptions, tallyVotes } from '../src/game/nextMatch.js';
import { packVehState } from '../src/sim/vehicle.js';

const RESTART_ENV = +process.env.BF_RESTART_MS || 0, RESTART_MS = RESTART_ENV || 15000;      // maç sonu ekranı (resmi odada oylama) süresi; ortam değişkeni resmi sunucunun voteSec'ini de ezer (test)
const EMPTY_ENV = +process.env.BF_EMPTY_ROTATE_MS || 0;                                    // boş resmi oda harita değişimi (test); yoksa sunucunun idleMin alanı
export const SPACE_MAPS = ['yorunge'];                              // 12.157 Uzay modu haritaları (başka mod bunlarda oynanmaz)
export const MAPS_FOR = (type) => (type === 'space' ? SPACE_MAPS : type === 'inf' ? ['newyork'] : type === 'pb' ? PB_MAPS : type === 'payload' ? ['maden'] : type === 'front' ? FRONT_MAPS : type === 'conquest' || type === 'tdm' ? ['kasaba', 'vadi', 'us', 'colgecidi', 'depo', 'liman', 'kuzey'] : ['kasaba', 'vadi', 'us', 'colgecidi', 'depo', 'liman']);      // 12.172 Kuzey Vadisi yalnız Ele Geçirme / TDM

const num = (v, lo, hi, d = 0) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

export const PB_MAPS = ['boyakulesi', 'ormankale'];                 // Paintball haritaları (ilki varsayılan); başka mod bunlarda oynanmaz
export const FRONT_MAPS = ['cephe'];                                  // Cephe modu haritaları (12.158); başka mod bunlarda oynanmaz

export function sanitizeCfg(c = {}) {
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const type0 = pick(c.type, ['conquest', 'tdm', 'dm', 'gg', 'inf', 'pb', 'payload', 'space', 'front'], 'conquest');
  const pbMap = c.map === 'random' ? PB_MAPS[Math.floor(Math.random() * PB_MAPS.length)] : pick(c.map, PB_MAPS, PB_MAPS[0]);
  return {
    map: type0 === 'space' ? pick(c.map, SPACE_MAPS, SPACE_MAPS[0]) : type0 === 'inf' ? 'newyork' : type0 === 'pb' ? pbMap : type0 === 'payload' ? 'maden' : type0 === 'front' ? pick(c.map, FRONT_MAPS, FRONT_MAPS[0]) : pick(c.map, (type0 === 'conquest' || type0 === 'tdm') ? ['kasaba', 'vadi', 'us', 'colgecidi', 'depo', 'liman', 'kuzey'] : ['kasaba', 'vadi', 'us', 'colgecidi', 'depo', 'liman'], 'kasaba'),                  // Enfekte yalnızca New York'ta, Paintball yalnızca paintball haritalarında
    tod: pick(c.tod, ['day', 'sunset', 'night'], 'day'),
    weather: type0 === 'space' ? 'clear' : pick(c.weather, ['clear', 'rain', 'fog'], 'clear'),
    type: type0,
    diff: type0 === 'inf' ? 'hard' : pick(c.diff, ['easy', 'normal', 'hard'], 'normal'),                   // Enfekte yalnızca Zor botlarla
    perTeam: c.type === 'pb' ? Math.round(num(c.perTeam, LIMITS.pbMin, LIMITS.pbMax, 8)) : c.type === 'dm' || c.type === 'gg' ? Math.round(num(c.perTeam, 2, LIMITS.dmMax, LIMITS.dmMax)) : c.type === 'inf' ? Math.round(num(c.perTeam, LIMITS.infMin, LIMITS.infMax, 12)) : Math.round(num(c.perTeam, 1, LIMITS.maxPerTeam, 5)),     // ölüm maçında ve enfektede perTeam = toplam oyuncu
    tickets: Number.isFinite(c.tickets) && c.tickets > 0 ? Math.round(num(c.tickets, 20, 1000, 200)) : 0,   // 0 = boyuta göre otomatik
    time: Math.round(num(c.time, 0, 3600, LIMITS.time)),
    bots: c.bots !== false,
    name: cleanRoomName(c.name),
    pw: typeof c.pw === 'string' ? c.pw.slice(0, 16) : '',
    listed: c.listed !== false,
    third: c.third === true,                   // 3. şahıs kamera (H) bu odada serbest mi
  };
}

const cleanRoomName = (n) => String(n || '').replace(/[<>&"'`]/g, '').trim().slice(0, 24);

export class Room {
  // opts.official: officialStore kaydı { name, desc, type, perTeam, time, diff, tickets, bots, third, rotation:[{map,tod,weather}] } — harita dönen resmi oda
  constructor(code, cfg, opts = {}) {
    this.code = code;
    this.official = opts.official || null;
    this._rotIdx = null; this._cur = null;          // resmi odada düzendeki sıra + bu maçın { map, tod, weather } seçimi
    this.vote = null;                               // maç sonu oylaması { opts, votes: Map(ws → i), ends }
    this.pending = [];                              // maç sonu ekranında gelenler: yeni maç kurulunca otomatik katılır { ws, pref }
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

  // Bu odanın denge sürümünü etkin yap (tüm odalar aynı süreçte, WSTATS vb. ortak nesneler: oda adımından önce çağrılır)
  activate() { useBalance(this.bal); }

  newGame() {
    const c = this.cfg;
    this.bal = currentBalance(); this.balVer = balanceMeta().version;   // admin değişiklikleri yeni maçta geçerli olur
    this.activate();
    if (this.official) {
      const o = this.official;
      if (!this._cur) { this._rotIdx = o.shuffle ? Math.floor(Math.random() * o.rotation.length) : 0; this._cur = o.rotation[this._rotIdx]; }     // ilk maç / ayar değişti: düzenin başı (rastgele düzende herhangi biri)
      const r = this._cur;
      Object.assign(c, sanitizeCfg({ type: o.type, perTeam: o.perTeam, time: o.time, diff: o.diff, tickets: o.tickets, bots: o.bots, third: o.third, ...r }), { name: o.name, listed: true, pw: '' });
      if (o.type === 'inf') c.tod = r.tod;
    }
    this.swap = this._swapNext ?? Math.random() < 0.5;                  // asimetrik haritalarda bu maçın taraf dağılımı (sideSwap): ilki rastgele, sonraki maçlar sırayla yer değiştirir
    this._swapNext = !this.swap;
    this.game = new Game(null, {
      headless: true, swapSides: this.swap, map: c.map, tod: c.tod, weather: c.weather, diff: c.diff, bots: c.bots, third: c.third,
      match: { perTeam: c.perTeam, type: c.type, tickets: c.tickets || undefined, time: c.time },
    });
    this.tick = 0;
    this._sig = []; this._forceSlow = true;
    this.resetAt = 0; this.vote = null;
    this.gameAt = Date.now();                                          // boş oda harita değişimi bu andan sayılır
    this.game.on('end', (e) => this.onEnd(e));
    this.game.on('botcls', () => this.broadcast({ t: 'roster', roster: this.roster() }));      // 12.200 bot sınıf değiştirdi (tanksavar): istemciler modeli / sınıfı güncellesin
  }

  // Maç bitti: sonuç ekranı süresi başlar. Resmi odada 3 seçenekli oylama (harita + gün saati + hava), oyuncu odasında aynı ayarla devam
  onEnd(e) {
    const ms = this.endMs();
    this.resetAt = Date.now() + ms;
    const o = this.official;
    if (o && o.vote !== false) {
      const opts = nextOptions({ type: o.type, cur: this.cfg, rotation: o.rotation, first: this.nextRotIdx() });
      this.vote = { opts, votes: new Map(), ends: this.resetAt };
    }
    const nx = this.vote ? null : o ? o.rotation[this.nextRotIdx()] : this.cfg;
    this.broadcast({ t: 'end', winner: e.winner, why: e.why, ms, vote: this.vote ? { opts: this.vote.opts.map(({ map, tod, weather }) => ({ map, tod, weather })), c: this.voteCounts() } : null, next: nx ? { map: nx.map, tod: nx.tod, weather: nx.weather } : null });
  }

  endMs() { return RESTART_ENV || (this.official ? (this.official.voteSec || 15) * 1000 : RESTART_MS); }

  // Resmi düzende sıradaki indeks (rastgele düzende aynısı üst üste gelmez); maç başına bir kez seçilir, oylamanın ilk seçeneği bu olur
  nextRotIdx() {
    if (this._nextIdx != null && this._nextFor === this.game) return this._nextIdx;
    const n = this.official.rotation.length, cur = this._rotIdx ?? -1;
    this._nextFor = this.game;
    return (this._nextIdx = this.official.shuffle && n > 1 ? (cur < 0 || cur >= n ? Math.floor(Math.random() * n) : (cur + 1 + Math.floor(Math.random() * (n - 1))) % n) : (cur + 1) % n);
  }

  // Sonraki maçın seçimi: oylama kazananı ya da düzende sıradaki
  advance(pick) {
    const o = this.official;
    if (!o) return;
    if (pick) { this._cur = { map: pick.map, tod: pick.tod, weather: pick.weather }; if (pick.ri >= 0 && pick.ri < o.rotation.length) this._rotIdx = pick.ri; }
    else { this._rotIdx = this.nextRotIdx(); this._cur = o.rotation[this._rotIdx]; }
    this._nextIdx = null;
  }

  voteCounts() { const c = this.vote ? this.vote.opts.map(() => 0) : []; if (this.vote) for (const i of this.vote.votes.values()) c[i]++; return c; }

  // Oy: yalnız odadaki insan oyuncular (botların bağlantısı yok, oy veremez); fikir değiştirilebilir. Herkes oy verince geri sayım 3 sn'ye iner
  castVote(ws, i) {
    const v = this.vote;
    if (!v || !this.game.ended || !ws.ctx || this.clients.get(ws.ctx.id)?.ws !== ws) return;
    if (!Number.isInteger(i) || i < 0 || i >= v.opts.length) return;
    const now = Date.now();
    if (v.votes.get(ws) === i) return;                                   // 12.187: aynı oy yayın yaptırmaz
    v.votes.set(ws, i);
    if (v.votes.size >= this.clients.size && this.resetAt - now > 3000) this.resetAt = v.ends = now + 3000;
    // 12.187: yayın odada en çok 200 ms'de bir (oy seli herkese mesaj çoğaltıyordu); arada gelen oylar bir sonraki yayında
    const bc = () => { this._voteTm = null; if (this.vote !== v) return; this._voteAt = Date.now(); this.broadcast({ t: 'votes', c: this.voteCounts(), n: this.clients.size, ms: Math.max(0, this.resetAt - this._voteAt) }); };
    if (now - (this._voteAt || 0) >= 200) bc(); else if (!this._voteTm) this._voteTm = setTimeout(bc, 200 - (now - this._voteAt));
  }

  decide() {
    const v = this.vote;
    if (!v) return null;
    for (const ws of v.votes.keys()) if (!ws.ctx || this.clients.get(ws.ctx.id)?.ws !== ws) v.votes.delete(ws);     // çıkanların oyu sayılmaz
    const c = this.voteCounts(), i = tallyVotes(c), o = v.opts[i];
    console.log(`[${this.code}] oylama ${JSON.stringify(c)} → ${o.map} / ${o.tod} / ${o.weather}`);
    return o;
  }

  // Maç sonu süresi doldu: yeni maç kurulur; odadakiler (ve bu sırada gelenler) bağlantı kopmadan yeni maça alınır (istemci yeni 'welcome' ile oyunu yeniden kurar)
  reset() {
    const pick = this.decide();
    this.vote = null;
    if (this.official) this.advance(pick);
    const keep = [...this.clients.values()].map((c) => ({ ws: c.ws, pref: { ...c.pref, team: this.game.soldiers[c.id]?.team } })), wait = this.pending.splice(0);
    this.broadcast({ t: 'restart', re: 1 });                  // eski sürüm istemciler sayfayı yeniler; yeniler aynı bağlantıda 'welcome' bekler
    for (const c of this.clients.values()) c.ws.ctx = null;
    this.clients.clear();
    this.game.dispose();
    this.newGame();
    for (const k of [...keep, ...wait]) this.rejoin(k.ws, k.pref);
    this.emptySince = this.clients.size ? 0 : Date.now();
  }

  rejoin(ws, pref) {
    if (ws.readyState !== 1) { ws.ctx = null; return; }
    const c = this.join(ws, pref.name, pref.team, pref.cls, pref.loadout, true, pref.skins, pref.wear);
    if (!c) { ws.ctx = null; try { ws.send(JSON.stringify({ t: 'err', msg: 'Oda dolu' })); ws.close(4002, 'full'); } catch { /* yok say */ } return; }
    ws.ctx = { room: this, id: c.id };
  }

  // Maç bitmişken gelen oyuncu: yeni maç kurulunca otomatik katılır (istemci yükleme ekranında bekler)
  hold(ws, pref) {
    this.pending.push({ ws, pref });
    ws.ctx = { room: this, id: -1 };
    ws.send(JSON.stringify({ t: 'wait', ms: Math.max(0, this.resetAt - Date.now()) }));
  }

  // Boş resmi oda kendiliğinden döner (listede harita / gün saati değişsin): idleMin dakikada bir (0 = kapalı). Döndüyse true
  idleTick(now) {
    const o = this.official;
    if (!o || this.clients.size || this.pending.length) return false;
    const ms = EMPTY_ENV || (o.idleMin ?? 10) * 60000;
    if (!ms || now - this.gameAt < ms) return false;
    this.activate();
    this.advance(null);
    this.game.dispose();
    this.newGame();
    console.log(`[${this.code}] boş oda: yeni harita ${this.cfg.map} / ${this.cfg.tod} / ${this.cfg.weather}`);
    return true;
  }

  // Admin panelinden resmi sunucu ayarı değişti: boşsa hemen yeni maç, içinde oyuncu varsa sonraki maçta (değişmeyen sunucuya dokunulmaz: boş oda dönüşü sıfırlanmasın)
  setOfficial(o) {
    const same = JSON.stringify(o) === JSON.stringify(this.official);
    this.official = o;
    if (same) return;
    if (this._rotIdx != null && this._rotIdx >= o.rotation.length) this._rotIdx = null;
    this._nextIdx = null;
    if (!this.clients.size && !this.pending.length) { this._rotIdx = null; this._cur = null; this.game.dispose(); this.newGame(); }
  }

  // Odayı kapat (admin): oyunculara mesaj, bağlantılar kesilir (istemci ana menüye döner)
  shutdown(msg) {
    this.sys(msg);
    for (const c of this.clients.values()) { c.ws.ctx = null; try { c.ws.close(4001, 'closed'); } catch { /* yok say */ } }
    this.clients.clear();
    this.dispose();
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
  publicCfg() { const { pw, ...rest } = this.cfg; return { ...rest, locked: !!pw, official: !!this.official, swap: this.game?.swapSides ?? this.swap }; }      // 12.197 devre arasından sonra katılan şu anki tarafları alır

  humansOf(team) { let n = 0; for (const id of this.clients.keys()) if (this.game.soldiers[id].team === team) n++; return n; }

  get humanCount() { return this.clients.size; }

  // oda kapasitesi: takımlı modlarda 2 x perTeam, ölüm maçında perTeam
  get cap() { return this.cfg.type === 'dm' || this.cfg.type === 'gg' || this.cfg.type === 'inf' || this.cfg.type === 'pb' ? this.cfg.perTeam : this.cfg.perTeam * 2; }

  canJoin(pw) {
    if (this.cfg.pw && pw !== this.cfg.pw) return 'Şifre yanlış';
    if (this.clients.size + this.pending.length >= this.cap) return 'Oda dolu';      // maç bitmişse de girilir: bekleme listesine (hold)
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

  join(ws, name, team, cls, loadout, re = false, skins = null, wear = null) {
    if (!this.clients.size && this.bal !== currentBalance()) { this.game.dispose(); this.newGame(); }     // boş odaya ilk giren: maç sıfırdan, güncel denge ayarlarıyla
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
    s.skins = cleanSkins(skins);                                       // kaplamalar: yavaş anlık görüntü alanında (sk) diğer oyunculara bir kez gider
    s.wear = cleanWear(wear);                                          // 12.167 kıyafet: yavaş alanda (wr) şu anki sınıfın kodu
    const c = { ws, name: s.name, h: g.humans.get(s.id), id: s.id, pref: { name: cleanName(name), team: t, cls, loadout, skins: s.skins, wear: s.wear } };      // pref: sonraki maça otomatik geçişte aynı ad / sınıf / yükleme
    this.clients.set(s.id, c);
    this.emptySince = 0;
    this._forceSlow = true;
    const deps = g.deployables.map((d) => ({ e: 'dep', id: d.id, ty: d.type === 'claymore' ? 'c' : 'a', p: [d.pos.x, d.mesh.position.y - (d.type === 'claymore' ? 0.15 : 0), d.pos.z], ry: d.ry, tm: d.team, by: d.owner.id }));
    ws.send(JSON.stringify({ t: 'welcome', id: s.id, room: this.code, cfg: this.publicCfg(), roster: this.roster(), hz: SIM_HZ, deps, pk: g.pickups.netState(), bal: this.bal || {} }));
    this.broadcast({ t: 'roster', roster: this.roster() }, ws);
    if (!re) this.sys(`${s.name} odaya katıldı`);
    return c;
  }

  leave(id, ws, quiet = false) {                                       // quiet: atılan / banlanan (moderation.js kendi mesajını yazar)
    if (ws) { const i = this.pending.findIndex((p) => p.ws === ws); if (i >= 0) this.pending.splice(i, 1); this.vote?.votes.delete(ws); }
    if (!this.clients.has(id) || (ws && this.clients.get(id).ws !== ws)) return;
    const nm = this.clients.get(id).name;
    this.clients.delete(id);
    if (this.clients.size && !quiet) this.sys(`${nm} odadan ayrıldı`);
    this._forceSlow = true;
    this.game.releaseSlot(id);
    if (!this.clients.size) {
      this.emptySince = Date.now();
      // maç sonunda herkes çıktı: oylama hemen sonuçlanır, bekleyenler yeni maça alınır. Resmi oda boşalınca taze maça hazırlanır
      if (this.game.ended) { this.reset(); return; }
      if (this.official) { this.game.dispose(); this.newGame(); return; }
    }
    this.broadcast({ t: 'roster', roster: this.roster() });
  }

  input(id, m) {
    const c = this.clients.get(id);
    if (!c || !Number.isInteger(m.q)) return;
    const h = c.h;
    if (h.queue.length > 60) return;      // taşma koruması
    if (m.q <= h.ack) return;              // 12.178: geç gelen (sonrakisi işlenmiş) girdi atılır
    const Q = h.queue; let at = Q.length;  // sıra no'ya göre sıralı ekle (yol üstünde yer değiştiren mesaj tahmini bozmasın; aynı no iki kez gelmez)
    while (at > 0 && Q[at - 1].q > m.q) at--;
    if (at > 0 && Q[at - 1].q === m.q) return;
    h.queue.splice(at, 0, {
      q: m.q,
      f: Math.round(num(m.f, -1, 1) * 100) / 100, r: Math.round(num(m.r, -1, 1) * 100) / 100, l: Math.round(num(m.l, -1, 1)),     // f / r analog (dokunmatik joystick)
      s: m.s ? 1 : 0, j: m.j ? 1 : 0, a: m.a ? 1 : 0, dn: m.dn ? 1 : 0,        // dn: 12.180 dalma (çömel basılı)
      yw: num(m.yw, -1e4, 1e4), pt: num(m.pt, -1.5, 1.5),
      pb: Number.isFinite(m.pb) ? num(m.pb, -1e4, 1e4) : null,                       // 12.199 yüzüstü gövde yönü (humanTick → proneLook doğrular; eski istemci yollamaz)
      w: Math.round(num(m.w, 0, 3)),
      c: m.c ? 1 : 0, p: m.p ? 1 : 0, u: m.u ? 1 : 0,
      fh: m.fh ? 1 : 0, fp: m.fp ? 1 : 0, rl: m.rl ? 1 : 0, fm: m.fm ? 1 : 0, o: m.o ? 1 : 0, ab: m.ab ? 1 : 0, nu: m.nu ? 1 : 0,      // nu: 12.193 bomba atış şekli
      vt: Number.isFinite(m.vt) ? m.vt : null,
      sd: m.sd ? 1 : 0, tl: m.tl ? 1 : 0,                                            // 12.159: fener (eski istemci yollamaz → kapalı)
      ve: m.ve ? 1 : 0, vs: Math.round(num(m.vs, 0, 4)), vl: m.vl ? 1 : 0,         // 12.177 araç: bin / in, koltuk (1–4), far
      dn: m.dn ? 1 : 0,                                                              // 12.179 helikopter: alçal
      co: Array.isArray(m.co) && m.co.length === 3 && m.co.every(Number.isFinite) ? m.co.map((v) => Math.max(-4.5, Math.min(4.5, v))) : null,
      gy: Number.isFinite(m.gy) ? num(m.gy, -1e4, 1e4) : null, gp: Number.isFinite(m.gp) ? num(m.gp, -1.5, 1.5) : null,      // 12.188 tank topu hedef yönü (yoksa bakış)
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
    if (m.fo && typeof m.fo === 'object' && !m.loadout) applyOpticPrefs(h.s, { fo: m.fo });   // 12.174: doğuş ekranında dönem nişangâhı (yalnız o silaha izinli dönem nişangâhı)
    if (typeof m.cls === 'string' && CLASS_DEFS[m.cls] && m.cls !== 'zombie') h.pendingClass = c.pref.cls = m.cls;
    if (typeof m.zt === 'string' && ZTYPES[m.zt]) h.pendingZ = m.zt;                  // Enfekte: bir sonraki doğuşta zombi türü
    if (m.loadout && typeof m.loadout === 'object') {
      h.pendingLoadout = c.pref.loadout = { primary: str(m.loadout.primary), secondary: str(m.loadout.secondary), gadget: str(m.loadout.gadget), melee: str(m.loadout.melee), front: cleanFront(m.loadout.front) };
      applyOpticPrefs(h.s, m.loadout);                                               // 12.174: nişangâh tercihleri (op / fo; yalnız bilinen / o silaha izinli dönem nişangâhı)
      c.pref.loadout.op = h.s.optic; c.pref.loadout.fo = { ...h.s.optics };            // sonraki maça otomatik geçişte de
    }
    if (m.skins !== undefined) h.s.skins = c.pref.skins = cleanSkins(m.skins);           // menüde / oyunda kaplama değişti: yavaş alan imzası değişir → bir kez yayınlanır
    if (m.wear !== undefined) h.s.wear = c.pref.wear = cleanWear(m.wear);                // 12.167 kıyafet değişti (aynı yol)
    if (typeof m.spawn === 'string') h.spawnChoice = m.spawn === 'base' || (m.spawn === 'front' && g.map.big) || g.mode.objectives.some((o) => o.id === m.spawn) ? m.spawn : 'base';
  }

  // BF_DEBUG=1 ile açılan test komutları (12.177: { vtp } aracı ışınla, { vdmg } araca hasar; ask: kuyruk / bütçe / atıcı durumu da döner): { t:'dbg', tp:[x,z] } ışınla · { tpy:[x,y,z] } havada bırak · { hp } can · { bots:false } botları sustur · { pb:1 } herkese paintball silahları · { zb:'brute' } zombi ol · { dmg:[id,hasar,kafa] } başkasını vur · { tps:[id,x,z,yaw,can] } başkasını ışınla · { ask } durum
  debug(id, m) {
    const c = this.clients.get(id), g = this.game;
    if (!c) return;
    const s = c.h.s;
    if (Array.isArray(m.tp)) { s.pos.set(m.tp[0], g.world.heightAt(m.tp[0], m.tp[1]), m.tp[2 - 1]); s.vel.set(0, 0, 0); g.world.settle(s); s.protT = 0; }
    if (Array.isArray(m.tpy) && m.tpy.length === 3 && m.tpy.every(Number.isFinite)) { s.pos.set(m.tpy[0], m.tpy[1], m.tpy[2]); s.vel.set(0, 0, 0); s.onGround = false; s.fallTop = m.tpy[1]; s.protT = 0; }   // { tpy:[x,y,z] } havada bırak (düşme hasarı testi)
    if (Number.isFinite(m.hp)) s.hp = m.hp;
    if (Array.isArray(m.tps) && m.tps.length >= 3 && m.tps.every(Number.isFinite)) { const o = g.soldiers[m.tps[0] | 0]; if (o && o.alive) { o.pos.set(m.tps[1], g.world.heightAt(m.tps[1], m.tps[2]), m.tps[2]); o.vel.set(0, 0, 0); g.world.settle(o); o.protT = 0; if (m.tps.length > 3) o.yaw = m.tps[3]; if (m.tps.length > 4) o.hp = m.tps[4]; } }   // { tps:[asker, x, z, yaw?, can?] } başka bir askeri (bot) ışınla (12.164 delip geçme testi)
    if (Array.isArray(m.item) && WSTATS[m.item[1]]) s.items[m.item[0] | 0] = { id: m.item[1], mag: Number.isFinite(m.item[2]) ? m.item[2] : 3, reserve: Number.isFinite(m.item[3]) ? m.item[3] : 0 };   // { item:[yuva, id, şarjör?, yedek?] }
    if (Array.isArray(m.am)) { const it = s.items[m.am[0] | 0]; if (it) { it.mag = +m.am[1] || 0; it.reserve = +m.am[2] || 0; } }          // { am:[yuva, şarjör, yedek] } sunucu cephanesini değiştir (12.138 uzlaştırma testi)
    if (m.kill) s.takeDamage(9999, s, 'body', s.pos, 'test'), s.protT = 0;
    if (Array.isArray(m.dmg)) { const v = g.soldiers[m.dmg[0] | 0]; if (v && v.alive && v !== s) { v.protT = 0; v.takeDamage(+m.dmg[1] || 9999, s, m.dmg[2] ? 'head' : 'body', s.pos, s.item?.name || 'test'); } }   // { dmg:[kurban, hasar, kafa?] } bu oyuncu vurmuş gibi (seri sesi testi)
    if (Array.isArray(m.tk)) { g.tickets.blue = +m.tk[0]; g.tickets.red = +m.tk[1]; }
    if (Number.isFinite(m.tl) && g.timeLeft !== Infinity) g.timeLeft = Math.max(0, +m.tl);          // { tl: sn } kalan süre (12.197 berabere / devre arası testi)
    if (Array.isArray(m.kl)) for (const [i, n] of m.kl) { const t = g.soldiers[i | 0]; if (t && Number.isFinite(+n)) t.kills = +n; }   // { kl:[[id,öldürme]…] } skor kutusu testi
    if (m.pb) {                                                                                     // paintball silahları (mod gelmeden test): herkese tüfek + tabanca, doğunca da
      const arm = (e) => { e.items = [{ id: 'pbrifle', mag: 50, reserve: 150 }, { id: 'pbpistol', mag: 12, reserve: 48 }, { id: 'knife', mag: 1, reserve: 0 }]; e.cur = 0; e.cd = 0; e.reloadT = 0; };
      for (const e of g.soldiers) arm(e);
      if (!g._pbArm) { g._pbArm = true; g.on('spawn', arm); }
    }
    if (Number.isFinite(m.frs) && g.front) { const A = Math.max(0, Math.min(g.front.n - 1, m.frs | 0)); let k = 0; while (!g.front.done && g.front.a < A && k++ < 12) g.front.shift(1, true); while (!g.front.done && g.front.a > A && k++ < 12) g.front.shift(-1, true); }   // { frs: sıra } Cephe: etkin noktayı oraya kaydır (test)
    if (Array.isArray(m.obj) && !g.front) { const o = g.mode.objectives[m.obj[0] | 0]; if (o) { o.owner = m.obj[1] === 'red' ? 'red' : m.obj[1] === 'blue' ? 'blue' : null; o.p = Math.max(-1, Math.min(1, +m.obj[2] || 0)); } }   // 12.191 { obj:[sıra, sahip, ilerleme] } Ele Geçirme bayrağını kur (test)
    if (Array.isArray(m.frt) && g.front) { const o = g.mode.objectives.find((q) => q.id === m.frt[0]); if (o) { o.owner = m.frt[1] === 'red' ? 'red' : m.frt[1] === 'blue' ? 'blue' : null; o.p = o.owner === 'blue' ? 1 : o.owner === 'red' ? -1 : 0; } }   // { frt:[nokta, sahip] } (test)
    if (Number.isFinite(m.pld) && g.payload) { g.payload.d = Math.max(g.payload.floorD, Math.min(g.payload.end, m.pld)); g.payload.idleT = 0; }   // { pld } vagonu yol mesafesine taşı (Vagon testi)
    if (typeof m.zb === 'string' && ZTYPES[m.zb] && g.mode.infection && s.alive) {                  // { zb:tür } hemen zombi ol, güç hazır, hazırlık süresi biter (dokunmatik güç butonu testi)
      g.makeZombie(s, false, m.zb); s.abT = 0; s.abActive = 0; s.cur = 0;
      if (Number.isFinite(g.timeLeft)) g.timeLeft = Math.min(g.timeLeft, g.mode.time - ZOMBIE.grace - 1);
      g.netEvent({ e: 'inf', v: s.id, bs: 0, zt: ZT_ORDER.indexOf(s.ztype) + 1, zl: s.zLives });
    }
    if (g.vehicles && Array.isArray(m.vtp) && m.vtp.length >= 2 && m.vtp.every(Number.isFinite)) { const v = s.veh || g.vehicles.list[m.vtp[3] | 0]; if (v?.st) { v.st.x = m.vtp[0]; v.st.z = m.vtp[1]; v.st.y = g.world.heightAt(m.vtp[0], m.vtp[1]); if (m.vtp.length > 2) v.st.yaw = m.vtp[2]; v.st.vx = v.st.vy = v.st.vz = 0; v.sleep = false; } }   // 12.177 { vtp:[x,z,yaw?,araç?] } aracı ışınla
    if (g.vehicles && Array.isArray(m.vdmg)) { const v = g.vehicles.list[m.vdmg[0] | 0]; if (v?.alive) g.vehicles.damage(v, +m.vdmg[1] || 0, null, m.vdmg[2] || 'impact'); }   // { vdmg:[araç, hasar, tür?] }
    if (m.bots === false) { g.brainsOff = g.brains.splice(0); }
    if (m.bots === true && g.brainsOff) { g.brains.push(...g.brainsOff); g.brainsOff = null; }
    if (m.ask && c.ws.readyState === 1) c.ws.send(JSON.stringify({ t: 'dbg', optic: s.opticId, item: s.item.id, zb: !!s.def.zombie, ab: [+s.abT.toFixed(2), +s.abActive.toFixed(2)],
      q: c.h.queue.length, bu: c.h.budget, drop: c.h.dropped || 0, ack: c.h.ack, tick: g.tick, lagT: c.h.vtLag != null ? +c.h.vtLag.toFixed(1) : null, sv: { cur: s.cur, fm: s.fireModeNow, st: s.prone ? 'p' : s.crouching ? 'c' : 's', mag: s.item.mag, res: s.item.reserve, cd: +s.cd.toFixed(3), rl: +s.reloadT.toFixed(2), sw: +s.switchT.toFixed(2), use: +s.useT.toFixed(2), swing: !!s.swing, prot: +s.protT.toFixed(2), alive: s.alive, lo: [+s.leanOff.x.toFixed(3), +s.leanOff.y.toFixed(3), +s.leanOff.z.toFixed(3)], pos: [+s.pos.x.toFixed(3), +s.pos.z.toFixed(3)], yw: +s.yaw.toFixed(3) }, kad: g.soldiers.map((e) => [e.kills, e.assists || 0, e.deaths, e.score]) }));   // test: sunucudaki nişangâh / silah (istemci bilinmeyen t'yi yok sayar)
  }

  // Olaylar: herkese; `to` alanlı olay (12.165 asist bildirimi 'as') yalnız o savaşçının istemcisine (sıra korunur, tek mesaj)
  sendEvents(list) {
    if (!list.some((e) => e.to !== undefined)) { this.broadcast({ t: 'ev', l: list }); return; }
    const pub = list.filter((e) => e.to === undefined), str = pub.length ? JSON.stringify({ t: 'ev', l: pub }) : null;
    for (const c of this.clients.values()) {
      if (c.ws.readyState !== 1) continue;
      if (list.some((e) => e.to === c.id)) c.ws.send(JSON.stringify({ t: 'ev', l: list.filter((e) => e.to === undefined || e.to === c.id) }));
      else if (str) c.ws.send(str);
    }
  }

  broadcast(msg, except) {
    const str = JSON.stringify(msg);
    for (const c of this.clients.values()) if (c.ws !== except && c.ws.readyState === 1) c.ws.send(str);
  }

  loop() {
    const now = performance.now();
    if (!this.clients.size) { this._last = now; this._acc = 0; return; }       // izleyen yok: simülasyonu durdur (CPU)
    this.activate();
    this._acc = Math.min(this._acc + (now - this._last) / 1000, 0.25);
    this._last = now;
    while (this._acc >= SIM_DT) { this._acc -= SIM_DT; this.step(); }
    if (this.resetAt && Date.now() >= this.resetAt) this.reset();
  }

  step() {
    const g = this.game;
    g.step(SIM_DT);
    this.tick = g.tick;
    for (const c of this.clients.values()) if (c.h.tickAck) { c.h.ackState = packSoldier(c.h.s); c.h.ackAm = c.h.s.items.map((it) => [it.mag, it.reserve]); c.h.ackVeh = c.h.s.veh && c.h.s.seat === 0 && c.h.s.veh.st ? packVehState(c.h.s.veh.st) : null; }      // ack anındaki cephane: istemci aynı girdideki kendi tahminiyle karşılaştırır (12.138) · 12.177 sürücünün araç durumu (tahmin uzlaştırması)
    if (g.netEvents.length) { this.sendEvents(g.netEvents); g.netEvents.length = 0; }
    if (this.tick % SNAP_EVERY === 0 && this.clients.size) this.snapshot();
  }

  snapshot() {
    const g = this.game;
    // yavaş alanlar yalnızca değişen savaşçılarda (ya da 2 sn'de bir / yeni katılımda) gönderilir
    const force = this._forceSlow || this.tick % (SNAP_EVERY * 40) === 0;
    this._forceSlow = false;
    const sig = (this._sig ||= []);
    const all = JSON.stringify(g.soldiers.map((s) => { const sg = slowSig(s), ch = force || sig[s.id] !== sg; if (ch) sig[s.id] = sg; return packSoldier(s, ch); }));
    const o = JSON.stringify(g.mode.objectives.map((ob) => [ob.owner === 'blue' ? 1 : ob.owner === 'red' ? 2 : 0, Math.round(ob.p * 1000) / 1000, ob.nb || 0, ob.nr || 0]));      // 12.191 + alandaki Mavi / Kırmızı sayısı (istemci HUD'u sunucunun saydığını gösterir; ilerleme 0,001 adımlı: çubuk istemcide akıcı)
    const tl = g.timeLeft === Infinity ? -1 : Math.round(g.timeLeft * 10) / 10;
    const vh = g.vehicles ? g.vehicles.pack(force) : null;                    // 12.177: yalnız değişen araçlar (duran araç yollanmaz; katılımda / 2 sn'de bir hepsi)
    const pl = (g.payload ? `"pl":${JSON.stringify(g.payload.pack())},` : '') + (g.front ? `"fr":${JSON.stringify(g.front.pack())},` : '') + (vh && vh.length ? `"vh":${JSON.stringify(vh)},` : '');      // Cephe: [etkin nokta sırası, cephe değişimi, bitti]                                   // Vagon: [yol mesafesi, iten | durduran | durum | uzatma]
    const head = `{"t":"snap","k":${this.tick},"tk":[${Math.round(g.tickets.blue)},${Math.round(g.tickets.red)}],"tl":${tl},"o":${o},${pl}"s":${all},"me":`;
    for (const c of this.clients.values()) {
      if (c.ws.readyState !== 1) continue;
      const h = c.h, s = h.s;
      const me = { ack: h.ack, rs: s.spawnN, st: h.ackState || packSoldier(s), now: packSoldier(s), rt: +s.respawnT.toFixed(2), am: s.items.map((it) => [it.mag, it.reserve]), aa: h.ackAm, ab: [+s.abT.toFixed(1), +s.abActive.toFixed(1)] };
      if (h.ackVeh) me.vs = h.ackVeh;
      c.ws.send(head + JSON.stringify(me) + '}');
    }
  }

  dispose() {
    clearInterval(this._timer);
    this.game.dispose();
  }
}
