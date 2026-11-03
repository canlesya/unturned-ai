// 12.226 Bomba modu (CS tarzı kur / imha et): raunt tabanlı takım modu, 5v5 (botlar boş yeri doldurur), raunt içinde yeniden doğuş yok (ölen izler).
// · Taraflar: SALDIRAN (doğuşu bomba bölgelerine uzak olan takım) · SAVUNAN. Devre arasında doğuşlar yer değiştirir → saldıran / savunan da değişir.
// · Raunt: hazırlık (5 sn, donuk, sınıf 1–5) → 1:55 → afiş (5 sn). Bomba raunt başında rastgele bir saldırana verilir; taşıyan ölürse yere düşer,
//   herhangi bir saldıran üstünden geçerek alır. Kurma: yalnız A / B bölgesinde, kullanma tuşu (E) basılı 3 sn, kıpırdamadan; hareket / hasar / ateş iptal eder.
// · Kurulunca raunt sayacı yerine 40 sn bomba sayacı. İmha: savunan bombanın yanında aynı tuşu 10 sn (kitle 5 sn) basılı tutar; hareket / hasar / ateş iptal.
//   Kit: Mühendis sınıfı + her raunt rastgele 2 savunan.
// · Kazanma: saldıran → bomba patlar ya da savunanların hepsi ölür. Savunan → süre biter (kurulmadan), bomba imha edilir ya da saldıranların hepsi kurmadan ölür
//   (kurulduktan sonra saldıranlar ölse de savunan imha etmek zorunda).
// · Maç: kısa ilk 7 (en çok 12 raunt, 6. rauntan sonra taraf değişir), uzun ilk 13 (en çok 24, 12. rauntan sonra). Son raunt eşitse berabere.
// YETKİLİ taraf (çevrimdışı oyun / sunucu) kuralları uygular; çevrim içi istemci durumu anlık görüntüden alır (snapshot 'bm') ve olaylarla
// (bmr / bmg / bme / bmk / bmd / bmp / bmx / bmb) afiş / akış / patlama çizer. Uyku Modu (uyku.js) raunt akışının ayrı kopyası: iki mod birbirine dokunmaz.
import * as THREE from 'three';
import { LIMITS } from './balance.js';
import { removeDeployable } from './gadgets.js';
import { t } from '../i18n/index.js';
import '../i18n/bomba.js';
import { BombaHud } from './bombaHud.js';

export const BM_REACH = 1.7;                      // imha menzili (yatay m)
export const BM_PICK = 1.4;                       // yerdeki bombayı alma menzili
const PHASES = ['prep', 'live', 'post', 'over'];
const WIN_CODE = { blue: 1, red: 2, draw: 3 }, WIN_OF = [null, 'blue', 'red', 'draw'];
export const BM_WHY = ['elim', 'time', 'boom', 'defuse', 'tie'];
export const BST = ['none', 'carried', 'dropped', 'planted', 'defused', 'exploded'];
const other = (tm) => (tm === 'blue' ? 'red' : 'blue');

export class Bomba {
  constructor(g) {
    this.g = g;
    this.net = !!g.online;                         // çevrim içi istemci: kural işletmez, anlık görüntüyü uygular
    this.rounds = g.mode.rounds === 24 ? 24 : 12;
    this.need = this.rounds / 2 + 1;                 // kazanmak için gereken raunt (7 / 13)
    this.half = this.rounds / 2;                     // bu rauntan sonra taraf değişir
    this.round = 1; this.phase = 'prep'; this.t = LIMITS.bmPrep;
    this.swapped = false; this.last = null; this.why = ''; this.final = false; this.over = null; this.endT = 0;
    this.hist = [];
    this.stats = { plants: 0, defuses: 0, booms: 0, drops: 0, pickups: 0, siteN: [0, 0] };
    this.ui = null; this.pend = []; this.specId = -1;
    // bölgeler: daire { name, x, z, r } ya da kutu { name, box:[x0, z0, x1, z1] } (kutunun merkezi / yarıçapı işaret ve botlar için)
    this.sites = (g.map.bombSites || []).map((s, i) => (s.box ? { ...s, i, x: s.x ?? (s.box[0] + s.box[2]) / 2, z: s.z ?? (s.box[1] + s.box[3]) / 2, r: s.r ?? Math.hypot(s.box[2] - s.box[0], s.box[3] - s.box[1]) / 2 } : { ...s, i }));
    this._rk = 1;                                  // raunt kurulum sayacı (aynı raunt baştan alınınca da artar: bot planı yenilenir)
    this.bomb = { st: 'none', carrier: null, x: 0, y: 0, z: 0, site: -1, prog: 0, who: null, planter: null, plantT: 0 };
    this.att = this.calcAtt();
    g.tickets.blue = 0; g.tickets.red = 0;
    g.timeLeft = this.t;
    this._init = false;                            // ilk raunt: kit + bomba ilk yetkili adımda (askerler kurucudan sonra doğar)
  }

  get live() { return this.phase === 'live'; }
  get prep() { return this.phase === 'prep'; }
  get dmgOk() { return this.phase === 'live'; }
  get def() { return other(this.att); }
  get planted() { return this.bomb.st === 'planted'; }

  // saldıran: ilk doğuş noktası bomba bölgelerine (en yakınına) daha uzak olan takım
  calcAtt() {
    const sp = this.g.map.spawns, S = this.sites;
    if (!S.length || !sp.blue?.[0] || !sp.red?.[0]) return 'blue';
    const d = (p) => Math.min(...S.map((s) => Math.hypot(s.x - p.x, s.z - p.z)));
    return d(sp.blue[0]) >= d(sp.red[0]) ? 'blue' : 'red';
  }

  // nokta hangi bölgede: -1 yok. Bölge = daire { x, z, r } ya da kutu { box:[x0, z0, x1, z1] }; y0 / y1 varsa kot aralığı
  siteAt(p) {
    for (const s of this.sites) {
      if (s.y0 !== undefined && (p.y < s.y0 || p.y > s.y1)) continue;
      if (s.box ? p.x >= s.box[0] && p.x <= s.box[2] && p.z >= s.box[1] && p.z <= s.box[3] : Math.hypot(p.x - s.x, p.z - s.z) <= s.r) return s.i;
    }
    return -1;
  }
  siteName(i) { return this.sites[i]?.name || '?'; }

  count(team) {
    let n = 0, up = 0;
    for (const s of this.g.soldiers) { if (s.vacant || s.team !== team) continue; n++; if (s.alive) up++; }
    return { n, up };
  }

  // donuk mu: hazırlıkta (girdi sıfırlanır, ateş yok)
  frozen(s) { return this.phase === 'prep' && s.alive; }

  // kurma / imha tuşu şu an işe yarar mı (oyuncu / sunucu / dokunmatik / HUD istemi): 'plant' · 'defuse' · null
  useKind(s) {
    if (!this.live || !s || !s.alive || s.veh) return null;
    const b = this.bomb;
    if (b.st === 'carried' && b.carrier === s && this.siteAt(s.pos) >= 0) return 'plant';
    if (b.st === 'planted' && s.team === this.def && Math.hypot(s.pos.x - b.x, s.pos.z - b.z) < BM_REACH && Math.abs(s.pos.y - b.y) < 1.6) return 'defuse';
    return null;
  }
  gate(s, held) { return !!held && !!this.useKind(s); }
  still(s) { return Math.hypot(s.vel.x, s.vel.z) < 0.7; }
  defuseTime(s) { return s && s.bmKit ? LIMITS.bmDefuseKit : LIMITS.bmDefuse; }

  // ───── yetkili adım (Game.updateMode) ─────
  update(dt) {
    const g = this.g;
    if (this.net || this.phase === 'over') return;
    if (!this._init) { this._init = true; this._r0 = g.time; this.att = this.calcAtt(); this.giveKits(); this.assign(); }
    this.t -= dt;
    if (this.phase === 'prep') { if (this.t <= 0) this.goLive(); }
    else if (this.phase === 'live') {
      const A = this.count(this.att), D = this.count(this.def);
      if (!A.n || !D.n) {                                                          // rakipsiz raunt (botsuz odada karşı takımda kimse yok): sayılmaz; süre dolunca baştan
        this.tickBomb(dt, true);
        if (this.t <= 0) this.startRound(true);
      } else {
        this.tickBomb(dt, false);
        const r = this.roundResult();
        if (r) this.endRound(r[0], r[1]);
      }
    } else if (this.phase === 'post' && this.t <= 0) { if (this.final) this.finish(); else this.startRound(); }
    g.timeLeft = this.phase === 'post' || this.phase === 'over' ? this.endT : Math.max(0, this.t);
  }

  // çevrim içi istemci: anlık görüntüler arası yerel süre akışı (gösterim)
  frame(dt) {
    if (!this.net) return;
    if (this.phase !== 'post' && this.phase !== 'over') this.t = Math.max(0, this.t - dt);
  }

  roundResult() {
    const A = this.count(this.att), D = this.count(this.def), b = this.bomb;
    if (b.st === 'exploded') return [this.att, 'boom'];
    if (b.st === 'defused') return [this.def, 'defuse'];
    if (b.st === 'planted') return D.up ? null : [this.att, 'elim'];
    if (!A.up) return [this.def, 'elim'];
    if (!D.up) return [this.att, 'elim'];
    if (this.t <= 0) return [this.def, 'time'];
    return null;
  }

  tickBomb(dt, solo) {
    const g = this.g, b = this.bomb;
    if (b.st === 'carried') {
      const c = b.carrier;
      if (!c || !c.alive || c.vacant || c.team !== this.att) { this.drop(c); return; }
      b.x = c.pos.x; b.y = c.pos.y; b.z = c.pos.z;
      const site = c.bmUse && this.still(c) && c.onGround !== false ? this.siteAt(c.pos) : -1;
      if (site < 0) { b.prog = 0; b.who = null; return; }
      if (b.who !== c) { b.who = c; b.prog = 0; c.bmT0 = g.time; }
      if (c.sinceShot < 0.3 || c.lastDmgT > c.bmT0) { b.prog = 0; c.bmT0 = g.time; return; }      // ateş etti / hasar aldı: baştan
      b.prog += dt;
      if (b.prog >= LIMITS.bmPlant) this.plant(c, site);
    } else if (b.st === 'dropped') {
      let best = null, bd = BM_PICK;
      for (const s of g.soldiers) {
        if (!s.alive || s.vacant || s.team !== this.att || s.veh) continue;
        const d = Math.hypot(s.pos.x - b.x, s.pos.z - b.z);
        if (d < bd && Math.abs(s.pos.y - b.y) < 1.8) { bd = d; best = s; }
      }
      if (best) this.pickup(best);
    } else if (b.st === 'planted') {
      let d = b.who && b.who.bmUse && this.useKind(b.who) === 'defuse' && this.still(b.who) ? b.who : null;
      if (!d) {
        let bd = 1e9;
        for (const s of g.soldiers) {
          if (!s.bmUse || this.useKind(s) !== 'defuse' || !this.still(s)) continue;
          const dd = Math.hypot(s.pos.x - b.x, s.pos.z - b.z);
          if (dd < bd) { bd = dd; d = s; }
        }
      }
      if (!d) { b.prog = 0; b.who = null; }
      else {
        if (d !== b.who) { b.who = d; b.prog = 0; d.bmT0 = g.time; }
        if (d.sinceShot < 0.3 || d.lastDmgT > d.bmT0) { b.prog = 0; d.bmT0 = g.time; }
        else { b.prog += dt; if (b.prog >= this.defuseTime(d)) { this.defuse(d); return; } }
      }
      if (this.t <= 0 && !solo) this.explode();
    }
  }

  // raunt başında bomba rastgele bir saldırana (bot ya da insan)
  assign() {
    const L = this.g.soldiers.filter((s) => !s.vacant && s.alive && s.team === this.att);
    const b = this.bomb;
    b.st = 'none'; b.carrier = null; b.prog = 0; b.who = null; b.site = -1; b.planter = null;
    if (!L.length) return;
    const c = L[Math.floor(Math.random() * L.length)];
    b.st = 'carried'; b.carrier = c; b.x = c.pos.x; b.y = c.pos.y; b.z = c.pos.z;
    this.ev({ e: 'bmk', v: c.id, k: 0 });
  }
  // her raunt kit: Mühendis sınıfı + rastgele LIMITS.bmKits savunan (saldıranda kit yok)
  giveKits() {
    const D = this.g.soldiers.filter((s) => !s.vacant && s.team === this.def);
    for (const s of this.g.soldiers) { s.bmKit = false; s.bmKitR = false; }
    const pool = D.filter((s) => s.cls !== 'engineer');
    for (let i = 0; i < LIMITS.bmKits && pool.length; i++) pool.splice(Math.floor(Math.random() * pool.length), 1)[0].bmKitR = true;
    for (const s of D) s.bmKit = s.bmKitR || s.cls === 'engineer';
  }
  drop(c) {
    const b = this.bomb;
    b.st = 'dropped'; b.carrier = null; b.prog = 0; b.who = null;
    if (c) { b.x = c.pos.x; b.y = c.pos.y; b.z = c.pos.z; }
    const W = this.g.world;
    if (W?.heightAt && !this.g.map.layered) b.y = Math.min(b.y, W.heightAt(b.x, b.z) + 0.05);
    this.stats.drops++;
    this.ev({ e: 'bmd', v: c ? c.id : -1, p: [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2)] });
  }
  pickup(s) {
    const b = this.bomb;
    b.st = 'carried'; b.carrier = s; b.prog = 0; b.who = null;
    this.stats.pickups++;
    this.ev({ e: 'bmk', v: s.id, k: 1 });
  }
  plant(c, site) {
    const g = this.g, b = this.bomb;
    b.st = 'planted'; b.carrier = null; b.site = site; b.prog = 0; b.who = null; b.planter = c; b.plantT = g.time;
    b.x = c.pos.x; b.y = c.pos.y; b.z = c.pos.z;
    this.t = LIMITS.bmTimer;
    c.score += 100;
    this.stats.plants++; this.stats.siteN[site] = (this.stats.siteN[site] || 0) + 1;
    for (const br of g.brains) br.goalT = Math.min(br.goalT, 0.2);                 // botlar hemen yeni hedef seçer (savunan: geri al / imha, saldıran: bombayı koru)
    this.ev({ e: 'bmp', v: c.id, s: site, p: [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2)] });
    g.emit('bmplant', { s: c, site });
  }
  defuse(d) {
    const b = this.bomb;
    b.st = 'defused'; b.prog = 0; b.who = null;
    d.score += 100;
    this.stats.defuses++;
    this.ev({ e: 'bmx', v: d.id });
    this.g.emit('bmdefuse', { s: d });
  }
  // patlama: LIMITS.bmKill içinde ölümcül, bmBlast'a dek doğrusal sönen hasar (duvar arkası da: bomba binayı sarsar). Düşmana kurana yazılır, saldıranlara dünya hasarı
  explode() {
    const g = this.g, b = this.bomb, K = LIMITS.bmKill, R = Math.max(K + 0.5, LIMITS.bmBlast), P = new THREE.Vector3(b.x, b.y + 0.4, b.z);
    b.st = 'exploded'; b.prog = 0; b.who = null;
    this.stats.booms++;
    this.ev({ e: 'bmb', p: [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2)] });
    g.alertNear?.(P, this.att, 120);
    const pl = b.planter && !b.planter.vacant ? b.planter : null;
    for (const s of [...g.soldiers]) {
      if (!s.alive || s.vacant) continue;
      const d = Math.hypot(s.pos.x - P.x, (s.pos.y + 0.9 - P.y) * 1.3, s.pos.z - P.z);
      if (d > R) continue;
      const dmg = d <= K ? 999 : 100 * (1 - (d - K) / (R - K));
      s.protT = 0;
      s.takeDamage(dmg, s.team === this.att ? null : pl, 'body', P, 'C4');
    }
    g.emit('bmboom', { b });
  }

  goLive() {
    this.phase = 'live'; this.t = LIMITS.bmRound;
    this.ev({ e: 'bmg', n: this.round });
  }

  endRound(w, why) {
    const g = this.g;
    this.endT = Math.max(0, this.t);
    this.phase = 'post'; this.t = LIMITS.bmPost;
    this.last = w; this.why = why; this.hist.push(w);
    if (w !== 'draw') g.tickets[w] += 1;
    for (const s of g.soldiers) if (!s.vacant && s.team === w && s.alive) s.score += 50;
    this.final = g.tickets.blue >= this.need || g.tickets.red >= this.need || this.round >= this.rounds;
    const b = this.bomb;
    const ev = { e: 'bme', n: this.round, w: WIN_CODE[w], y: BM_WHY.indexOf(why), a: WIN_CODE[this.att], f: this.final ? 1 : 0, sc: [g.tickets.blue, g.tickets.red] };
    this.ev(ev);
    g.emit('bmround', { n: this.round, w, why, att: this.att, side: w === 'draw' ? 'draw' : w === this.att ? 'att' : 'def', planted: b.plantT > 0, site: b.site, dur: g.time - (this._r0 ?? 0) - LIMITS.bmPrep });
  }

  finish() {
    const g = this.g, b = g.tickets.blue, r = g.tickets.red;
    this.phase = 'over';
    const w = b > r ? 'blue' : r > b ? 'red' : 'draw';
    this.over = [w, w === 'draw' ? t('bm.endDraw', { b, r }) : t('bm.endWin', { b: Math.max(b, r), r: Math.min(b, r) })];
  }

  // again: aynı raunt baştan (rakipsiz rauntta karşı takıma oyuncu geldi / test); skor ve raunt sayısı değişmez
  startRound(again = false) {
    const g = this.g;
    if (!again) this.round++;
    if (!again && this.half && this.round === this.half + 1) this.swap();
    this.phase = 'prep'; this.t = LIMITS.bmPrep; this.last = null; this._rk++;
    for (const d of [...g.deployables]) removeDeployable(g, d);
    for (const p of g.projectiles) if (p.mesh) g.scene.remove(p.mesh);
    g.projectiles.length = 0;
    const b = this.bomb; b.st = 'none'; b.carrier = null; b.planter = null; b.plantT = 0; b.site = -1; b.prog = 0; b.who = null;
    this.att = this.calcAtt();
    for (const s of g.soldiers) {
      s.bmUse = false;
      if (s.vacant) continue;
      g.respawn(s, true);
    }
    this._r0 = g.time;
    this.giveKits();
    this.ev({ e: 'bmr', n: this.round, sw: this.swapped ? 1 : 0, a: WIN_CODE[this.att] });
    this.assign();
  }

  // Game.claimSlot: raunt sürerken insan katıldı. Takımı boştaysa (rakipsiz raunt) raunt baştan başlar. true: yeniden başladı
  joined(s) {
    if (this.net || this.phase === 'over') return false;
    let mates = 0;
    for (const o of this.g.soldiers) if (o !== s && !o.vacant && o.team === s.team) mates++;
    if (mates) return false;
    this.startRound(true);
    return true;
  }

  swap() {
    const g = this.g, sp = g.map.spawns;
    g.map.spawns = { ...sp, blue: sp.red, red: sp.blue };
    g.swapSides = !g.swapSides; this.swapped = !this.swapped;
    g._tac = undefined; g._tacKey = null;
  }

  // Soldier.die → Game.onKill: raunt sonuna dek ölü (izler); bombayı taşıyorsa yere düşer
  onDeath(s) {
    s.revivable = false; s.respawnT = 1e9; s.bmUse = false;
    if (!this.net && this.bomb.st === 'carried' && this.bomb.carrier === s) this.drop(s);
  }

  prepApply(s, ctl) {
    if (this.net || this.phase !== 'prep' || !s || !s.alive || !ctl) return;
    let ch = false;
    if (ctl.pendingClass && ctl.pendingClass !== s.cls && !s.def.zombie) { s.setClass(ctl.pendingClass); ch = true; }
    ctl.pendingClass = null;
    if (ctl.pendingLoadout) { s.choice = ctl.pendingLoadout; ctl.pendingLoadout = null; s.items = s.loadout(); ch = true; }
    if (!ch) return;
    s.cur = 0; s.hp = s.maxHp; s.reloadT = 0; s.switchT = 0; s.useT = 0; s.cook = null;
    if (s.team === this.def) s.bmKit = !!s.bmKitR || s.cls === 'engineer';
    s._syncWeaponModel?.(true);
    this.g.emit('switch', s);
    if (s.human) this.g.emit('botcls', s);
  }
  prepKey(s, code) {
    if (this.phase !== 'prep' || !s.alive || !/^Digit[1-5]$/.test(code)) return false;
    const keys = Object.keys(this.g.classDefs).filter((k) => !this.g.classDefs[k].zombie), k = keys[+code[5] - 1];
    if (!k) return false;
    this.g.requestClass(k);
    if (!this.g.online) this.prepApply(s, this.g);
    return true;
  }

  // ───── çevrim içi ─────
  // [raunt, evre, süre ×10, taraf değişti, son raunt, raunt sayısı, saldıran (1 mavi · 2 kırmızı), bomba durumu (BST), taşıyan (savunana -1), x ×10, y ×10, z ×10,
  //  bölge, ilerleme ×10, kuran / imha eden, kitli askerler]. mine: istemci saldıran takımda mı (taşıyan yalnız saldırana)
  pack(mine) {
    const b = this.bomb, kits = [];
    for (const s of this.g.soldiers) if (s.bmKit && !s.vacant) kits.push(s.id);
    const car = b.st === 'carried' && b.carrier ? (mine ? b.carrier.id : -1) : -1;
    const hidePos = b.st === 'carried' && !mine;
    return [this.round, PHASES.indexOf(this.phase), Math.round(this.t * 10), this.swapped ? 1 : 0, WIN_CODE[this.last] || 0, this.rounds, WIN_CODE[this.att], BST.indexOf(b.st), car,
      hidePos ? 0 : Math.round(b.x * 10), hidePos ? 0 : Math.round(b.y * 10), hidePos ? 0 : Math.round(b.z * 10), b.site, Math.round(b.prog * 10), b.who ? b.who.id : -1, kits];
  }
  applyNet(a) {
    if (!Array.isArray(a)) return;
    const S = this.g.soldiers, b = this.bomb;
    this.round = a[0] | 0; this.phase = PHASES[a[1]] || 'live'; this.t = (a[2] || 0) / 10;
    this.swapped = !!a[3];
    this.last = WIN_OF[a[4] | 0] || null;
    if (a[5]) { this.rounds = a[5] === 24 ? 24 : 12; this.need = this.rounds / 2 + 1; this.half = this.rounds / 2; }
    this.att = WIN_OF[a[6]] === 'red' ? 'red' : 'blue';
    b.st = BST[a[7]] || 'none';
    b.carrier = a[8] >= 0 ? S[a[8]] || null : null;
    if (!(b.st === 'carried' && !b.carrier)) { b.x = a[9] / 10; b.y = a[10] / 10; b.z = a[11] / 10; }
    b.site = a[12] ?? -1; b.prog = (a[13] || 0) / 10; b.who = a[14] >= 0 ? S[a[14]] || null : null;
    const K = new Set(Array.isArray(a[15]) ? a[15] : []);
    for (const s of S) s.bmKit = K.has(s.id);
  }
  onNet(ev) {
    const g = this.g, b = this.bomb;
    if (ev.e === 'bmr') { this.round = ev.n; this.phase = 'prep'; this.t = LIMITS.bmPrep; this.swapped = !!ev.sw; if (ev.a) this.att = WIN_OF[ev.a]; b.st = 'none'; b.carrier = null; b.prog = 0; b.who = null; }
    else if (ev.e === 'bmg') { this.phase = 'live'; this.t = LIMITS.bmRound; }
    else if (ev.e === 'bmp') { this.stats.plants++; b.st = 'planted'; b.site = ev.s; [b.x, b.y, b.z] = ev.p; this.t = LIMITS.bmTimer; b.planter = g.soldiers[ev.v] || null; }
    else if (ev.e === 'bmx') { this.stats.defuses++; b.st = 'defused'; }
    else if (ev.e === 'bmb') { this.stats.booms++; b.st = 'exploded'; [b.x, b.y, b.z] = ev.p; }
    else if (ev.e === 'bmd') { b.st = 'dropped'; b.carrier = null; [b.x, b.y, b.z] = ev.p; }
    else if (ev.e === 'bme') { this.hist.push(WIN_OF[ev.w] || 'draw'); this.phase = 'post'; this.last = WIN_OF[ev.w]; this.why = BM_WHY[ev.y] || ''; this.endT = g.timeLeft === Infinity ? 0 : g.timeLeft; }
    this.fx(ev);
  }

  // olay: ağa + arayüze
  ev(e) { this.g.netEvent(e); this.fx(e); }
  fx(ev) {
    if (this.g.headless) return;
    if (this.ui) this.ui.onEvent(ev); else this.pend.push(ev);
  }

  // ───── izleme (ölünce takım arkadaşı; Uyku Modu ile aynı kamera kuralı) ─────
  specList() { const me = this.g.playerSoldier; return this.g.soldiers.filter((s) => s !== me && s.alive && !s.vacant && s.team === me.team); }
  specTarget() {
    const L = this.specList();
    if (!L.length) return null;
    let s = L.find((e) => e.id === this.specId);
    if (!s) { s = L[0]; this.specId = s.id; }
    return s;
  }
  specCycle(d) {
    const L = this.specList();
    if (!L.length) return;
    const i = L.findIndex((e) => e.id === this.specId);
    this.specId = L[((i < 0 ? 0 : i + d) % L.length + L.length) % L.length].id;
  }
  specCamera(cam, dt) {
    const me = this.g.playerSoldier, W = this.g.world;
    this.g._specHide = null;
    if (me.alive || this.g.ended) return false;
    if (me.deadT < 1.6) return false;                                               // önce kısa ölüm kamerası (nereden vuruldum), sonra izleme
    const tg = this.specTarget();
    if (!tg) return false;
    const eye = tg.eye(), yaw = tg.yaw, pitch = Math.max(-0.6, Math.min(0.5, tg.pitch)), H = (this._sh ||= {});
    const C = (this._sc ||= [[0, 0.22, 2.8, 0], [0, 0.75, 2.4, 0.18], [0.55, 0.3, 2.4, 0], [-0.55, 0.3, 2.4, 0], [0, 2.2, 1.6, 0.55]]);
    let best = null, bs = -1;
    for (const [dy, up, L0, look] of C) {
      const a = yaw + dy, d = (this._sd ||= eye.clone()).set(Math.sin(a), up, Math.cos(a)).normalize();
      const hit = W.raycast(eye, d, L0 + 0.3, H), L = hit ? Math.max(0, hit.t - 0.3) : L0;
      const sc = L / L0 + (dy === 0 && up < 0.5 ? 0.15 : 0);
      if (sc > bs) { bs = sc; best = { x: eye.x + d.x * L, y: eye.y + d.y * L, z: eye.z + d.z * L, look }; }
      if (!hit && dy === 0 && up < 0.5) break;
    }
    const fp = bs < 0.35;
    this.g._specHide = fp ? tg : null;
    if (fp) { cam.position.copy(eye); cam.rotation.order = 'YXZ'; cam.rotation.set(tg.pitch, yaw, 0); this._sp = null; return true; }
    const want = (this._sw ||= eye.clone()).set(best.x, best.y, best.z);
    if (this._specFor !== tg.id || !this._sp) { this._sp = want.clone(); this._specFor = tg.id; this._lk = best.look; }
    else { this._sp.lerp(want, Math.min(1, dt * 10)); this._lk += (best.look - this._lk) * Math.min(1, dt * 6); }
    cam.position.copy(this._sp);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(pitch * 0.85 - 0.08 - this._lk, yaw, 0);
    return true;
  }

  uiFrame(dt) { if (!this.g.headless) (this.ui ||= new BombaHud(this.g, this)).update(dt); }
  dispose() { this.ui?.dispose(); this.ui = null; }
}
