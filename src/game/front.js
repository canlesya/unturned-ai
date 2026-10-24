import { TUNE } from './balance.js';
import { t } from '../i18n/index.js';
import '../i18n/front.js';
import { FrontHud } from './frontHud.js';

// ───── Cephe modu (front, 12.158) ─────
// Cephe ilerletme (Battlefield "Breakthrough" benzeri): harita sıralı SEKTÖRLERE bölünür (map.front.sectors), her sektörde 1–3 ele geçirme noktası.
// Saldıran (Mavi) yalnız ETKİN sektörün noktalarını alabilir; o sektörün noktalarının HEPSİ aynı anda Mavi'deyse sektör düşer: noktalar kilitlenir,
// savunanın (Kırmızı) doğuşu bir sonraki hatta geri, saldıranınki öne kayar (map.front.stages), saldırana bilet ödülü (başlangıcın TUNE.frBonus oranı).
// Savunan etkin sektördeki noktaları geri alabilir. Bilet yalnız saldıranda: her ölümü −1 (canlandırma +1). Kazanma: son sektör düşerse Mavi;
// saldıranın bileti biterse ya da süre dolarsa Kırmızı. Bayrak mantığı game.updateMode'daki conquest döngüsü (capturable() kancası); bayrak kanaması yok.
// Karar çevrimdışında oyunda, çevrimiçinde sunucuda; istemci snapshot 'fr' alanından sektörü alır (applyNet).
export const ATK = 'blue', DEF = 'red';

export class Front {
  constructor(game) {
    const F = (this.def = game.map.front);
    this.g = game;
    this.n = F.sectors.length;
    this.sector = 0; this.done = false;
    this.t0 = game.mode.tickets;
    for (const o of game.mode.objectives) {
      o.sector = F.sectors.findIndex((s) => s.objs.includes(o.id));
      o.owner = DEF; o.p = -1;                                              // başlangıçta her nokta savunanda
    }
    game.tickets.red = this.n;                                               // savunan "bileti" = kalan sektör (HUD / oda listesi)
    this.applyStage(0);
  }

  get name() { return this.secName(Math.min(this.sector, this.n - 1)); }
  secName(i) { return t('front.secName' + (i + 1)); }
  capturable(o) { return !this.done && o.sector === this.sector; }
  active() { return this.g.mode.objectives.filter((o) => o.sector === this.sector); }

  // doğuş + üs bölgesi (savunanın doğuşu geri, saldıranınki öne)
  applyStage(i) {
    const S = this.def.stages[Math.min(i, this.def.stages.length - 1)], m = this.g.map;
    m.spawns.blue = S.blue; m.spawns.red = S.red;
    m.baseZones = { blue: S.zones.blue, red: S.zones.red };
  }

  // yetkili güncelleme (Game.updateMode içinde, bayrak döngüsünden sonra, checkEnd'den önce)
  update() {
    const g = this.g;
    if (this.done) return;
    const act = this.active();
    if (act.length && act.every((o) => o.owner === ATK && o.p >= 1)) this.advance(true);
    g.tickets.red = this.n - this.sector;
  }

  advance(auth) {
    const g = this.g, i = this.sector;
    for (const o of g.mode.objectives) if (o.sector === i) { o.owner = ATK; o.p = 1; }
    this.sector = i + 1;
    if (this.sector >= this.n) this.done = true;
    if (auth) {
      const bonus = Math.round(this.t0 * TUNE.frBonus);
      if (!this.done) g.tickets.blue += bonus;
      g.netEvent({ e: 'frs', i: this.sector });
      for (const s of g.soldiers) if (s.alive && s.team === ATK && this.def.sectors[i].objs.some((id) => { const o = g.mode.objectives.find((q) => q.id === id); return o && Math.hypot(s.pos.x - o.x, s.pos.z - o.z) < o.r + 6; })) {
        s.score += 100; if (s.isPlayer && !g.headless) g.hud.popup(t('front.popCap'), true);
      }
    }
    if (!this.done) this.applyStage(this.sector);
    g.tickets.red = this.n - this.sector;
    for (const b of g.brains) b.frontReset?.();
    if (g.headless || !g.hud) return;
    const me = g.playerSoldier, atk = me && me.team === ATK;
    g.hud.toast(atk ? t('front.secTakenAtk', { name: this.secName(i), b: Math.round(this.t0 * TUNE.frBonus) }) : t('front.secTakenDef', { name: this.secName(i) }), atk ? '#7ec8ff' : '#ff8a7a');
    g.sfx.capture?.();
    this.ui?.flash();
  }

  // kazanan: [takım, gerekçe] ya da null
  result() {
    const g = this.g;
    if (this.done) return [ATK, t('front.winAtk')];
    if (g.tickets.blue <= 0) return [DEF, t('front.winDefTk', { name: this.name })];
    if (g.timeLeft !== Infinity && g.timeLeft <= 0) return [DEF, t('front.winDefTime', { name: this.name })];
    return null;
  }

  respawnMul(team) { return team === ATK ? TUNE.frAtkRespawn : TUNE.frDefRespawn; }

  // ── ağ: [sektör] ──
  pack() { return [this.sector]; }
  applyNet(a) {
    const i = a[0] | 0;
    while (this.sector < i && this.sector < this.n) this.advance(false);
  }

  frame(dt) {
    const g = this.g;
    if (g.headless || !g.hud || !g.playerSoldier) return;
    (this.ui ||= new FrontHud(g, this)).update(dt);
  }
  dispose() { this.ui?.dispose(); }
}
