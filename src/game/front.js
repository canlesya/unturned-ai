import { TUNE } from './balance.js';
import { t } from '../i18n/index.js';
import '../i18n/front.js';
import { FrontHud } from './frontHud.js';
import { FrontFx } from './frontFx.js';

// ───── Cephe modu (front) — 12.161 "Cephe Hattı" (Battlefield 1 Frontlines benzeri, çekişmeli) ─────
// Harita boyunca sıralı nokta ZİNCİRİ (map.front.chain): Mavi KG — A — B — ORTA — D — E — Kırmızı KG. Aynı anda yalnız BİR nokta etkin (this.a):
// zincirde etkin noktanın Mavi tarafındakiler Mavi'nin, Kırmızı tarafındakiler Kırmızı'nın (kilitli). Başlangıçta ORTA etkin ve kimsenin değil.
// Etkin noktayı iki takım da alabilir (çubuk −1..1, game.updateMode'daki conquest döngüsü; capturable() / capMul() kancası):
//   Mavi alırsa (çubuk +1) nokta Mavi'nin olur, etkin nokta Kırmızı tarafındaki bir sonrakine kayar; Kırmızı alırsa tersi. Yeni etkin nokta eski sahibine
//   biraz yatık başlar (TUNE.frLean: savunanın küçük avantajı). İki takımın doğuşu da etkin noktaya göre kayar (map.front.stages[a]: kendi yarısında ~35–75 m geride).
// Kazanma: düşmanın karargâhını (zincirin ucu) alan; ya da düşmanın bileti biter; ya da süre bitince daha çok noktası olan (eşitse bilet).
// Bilet iki tarafa simetrik: her ölüm −1 (canlandırma +1), az noktası olan taraf fark kadar kanar (TUNE.bleed sn'de bir, × frBleed).
// Karar çevrimdışında oyunda, çevrimiçinde sunucuda; istemci snapshot 'fr' alanından etkin noktayı alır (applyNet), nokta sahipleri 'o' alanından gelir.
export const TEAMS2 = ['blue', 'red'];
const other = (tm) => (tm === 'blue' ? 'red' : 'blue');

export class Front {
  constructor(game) {
    const F = (this.def = game.map.front);
    this.g = game;
    this.chain = F.chain.map((id) => game.mode.objectives.find((o) => o.id === id)).filter(Boolean);
    this.n = this.chain.length;
    this.mid = Math.max(0, this.chain.findIndex((o) => o.mid));
    if (!this.chain[this.mid]?.mid) this.mid = this.n >> 1;
    this.a = this.mid; this.done = null; this.shifts = 0; this.bleedT = 0;
    this.lockT = (game.time || 0) + TUNE.frStartLock;                            // başta ORTA kilitli: iki ordu varıp çarpışsın (ilk varan kapmasın)
    this.chain.forEach((o, i) => { o.ci = i; });
    this.t0 = game.mode.tickets;
    game.tickets.blue = game.tickets.red = this.t0;
    this.setOwners(0);
    this.applyStage();
  }

  get active() { return this.chain[Math.max(0, Math.min(this.n - 1, this.a))]; }
  get name() { return this.active.name; }
  activeList() { return this.done ? [] : [this.active]; }
  capturable(o) { return !this.done && o === this.active && this.g.time >= this.lockT; }
  lockLeft() { return Math.max(0, this.lockT - this.g.time); }
  capMul(o) { return TUNE.frCapMul * (o.hq ? TUNE.frHqMul : 1); }
  // takımın etkin noktaya göre durumu: 'def' (nokta kendi bölgesinde / kendine yatık), 'atk' (düşmanınkine yatık), 'even' (tam ortada)
  stance(team) { const o = this.active, p = team === 'blue' ? o.p : -o.p; return p > 0.12 ? 'def' : p < -0.12 ? 'atk' : 'even'; }
  // takımın sahip olduğu nokta sayısı (etkin nokta çubuğun yattığı tarafa sayılır)
  owned(team) { return this.chain.filter((o) => o.owner === team || (o === this.active && (team === 'blue' ? o.p > 0 : o.p < 0) && !o.owner)).length; }
  // ilerleme yönü: takımın saldırdığı uç (+1 = Kırmızı ucuna doğru zincirde ileri)
  dir(team) { return team === 'blue' ? 1 : -1; }

  setOwners(lean) {
    this.chain.forEach((o, i) => {
      if (i < this.a) { o.owner = 'blue'; o.p = 1; } else if (i > this.a) { o.owner = 'red'; o.p = -1; }
      else { o.p = lean; o.owner = lean > 0 ? 'blue' : lean < 0 ? 'red' : null; }
    });
  }

  // doğuş + üs bölgesi: etkin noktanın sırasına göre (iki takım da)
  applyStage() {
    const S = this.def.stages[Math.max(0, Math.min(this.def.stages.length - 1, this.a))], m = this.g.map;
    m.spawns.blue = S.blue; m.spawns.red = S.red;
    m.baseZones = { blue: S.zones.blue, red: S.zones.red };
  }

  // yetkili güncelleme (Game.updateMode içinde, bayrak döngüsünden sonra, checkEnd'den önce)
  update() {
    const g = this.g;
    if (this.done) return;
    const o = this.active;
    if (o.p >= 1) this.shift(1, true);
    else if (o.p <= -1) this.shift(-1, true);
    if (this.done || g.time < this.bleedT) return;
    this.bleedT = g.time + TUNE.bleed;
    const nb = this.owned('blue'), nr = this.owned('red');
    if (nb !== nr) g.tickets[nb > nr ? 'red' : 'blue'] -= Math.abs(nb - nr) * TUNE.frBleed;
  }

  // etkin nokta alındı: dir +1 Mavi aldı (cephe Kırmızı ucuna ilerler), −1 Kırmızı aldı
  shift(dir, auth) {
    const g = this.g, i = this.a, o = this.chain[i], team = dir > 0 ? 'blue' : 'red';
    o.owner = team; o.p = dir;
    this.shifts++;
    const j = i + dir;
    if (j < 0 || j >= this.n) this.done = team;                                     // düşmanın karargâhı alındı
    else {
      this.a = j;
      const q = this.chain[j];
      q.p = -dir * TUNE.frLean; q.owner = q.p > 0 ? 'blue' : q.p < 0 ? 'red' : null;   // yeni etkin nokta (isteğe bağlı) eski sahibine yatık başlar
      this.lockT = g.time + TUNE.frShiftLock;                                     // kısa kilit: kayan doğuşlardan iki taraf da gelsin
      this.applyStage();
    }
    if (auth) {
      g.netEvent({ e: 'frs', a: this.a, d: dir });
      for (const s of g.soldiers) if (s.alive && s.team === team && Math.hypot(s.pos.x - o.x, s.pos.z - o.z) < o.r + 6) {
        s.score += 100; if (s.isPlayer && !g.headless) g.hud.popup(t('front.popCap'), true);
      }
    }
    if (g.headless || !g.hud || !g.playerSoldier) return;
    const me = g.playerSoldier.team, good = team === me, nx = this.done ? null : this.active;
    if (this.done) g.hud.toast(t(good ? 'front.hqTakenWin' : 'front.hqTakenLose', { name: o.name }), good ? '#7ec8ff' : '#ff8a7a');
    else g.hud.toast(t(good ? 'front.ptTakenGood' : 'front.ptTakenBad', { name: o.name, next: nx.name }), good ? '#7ec8ff' : '#ff8a7a');
    g.sfx.capture?.();
    this.ui?.flash(good);
  }

  // kazanan: [takım, gerekçe] ya da null
  result() {
    const g = this.g;
    if (this.done) return [this.done, t('front.winHq', { team: t(this.done === 'blue' ? 'front.blue' : 'front.red') })];
    if (g.tickets.blue <= 0 || g.tickets.red <= 0) { const w = g.tickets.blue <= 0 ? 'red' : 'blue'; return [w, t('front.winTk', { name: this.name })]; }
    if (g.timeLeft !== Infinity && g.timeLeft <= 0) {
      const nb = this.owned('blue'), nr = this.owned('red');
      const w = nb !== nr ? (nb > nr ? 'blue' : 'red') : g.tickets.blue >= g.tickets.red ? 'blue' : 'red';
      return [w, t('front.winTime', { b: nb, r: nr })];
    }
    return null;
  }

  respawnMul() { return TUNE.frRespawn; }

  // ── ağ: [etkin nokta sırası, cephe değişim sayısı, bitti (0 / 1 Mavi / 2 Kırmızı)] ──
  pack() { return [this.a, this.shifts, this.done === 'blue' ? 1 : this.done === 'red' ? 2 : 0, Math.ceil(this.lockLeft())]; }
  applyNet(a) {
    const A = a[0] | 0;
    if (!this._net) { this._net = true; if (A !== this.a) { this.a = A; this.setOwners(0); this.applyStage(); } this.shifts = a[1] | 0; this.lockT = this.g.time + (a[3] | 0); return; }   // ilk snapshot (maça sonradan katılan): bildirimsiz
    let guard = 0;
    while (this.a < A && guard++ < 12) this.shift(1, false);
    while (this.a > A && guard++ < 12) this.shift(-1, false);
    this.shifts = a[1] | 0;
    this.lockT = this.g.time + (a[3] | 0);
  }

  frame(dt) {
    const g = this.g;
    if (g.headless || !g.hud || !g.playerSoldier) return;
    (this.ui ||= new FrontHud(g, this)).update(dt);
    (this.fx ||= new FrontFx(g)).update(dt);                                      // savaş atmosferi: duman sütunları, yanan enkaz, toz, top parlamaları
  }
  dispose() { this.ui?.dispose(); this.fx?.dispose(); }
}
export { other };
