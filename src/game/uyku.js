// 12.223 Uyku Modu: raunt tabanlı takım modu (5v5, botlar boş yeri doldurur), raunt içinde yeniden doğuş yok.
// · Canı biten asker ÖLMEZ, "uyur": yerde yatar (yüzüstü duruş), ateş edemez / yürüyemez, 20 sn kanama sayacı. Süre biterse raunt sonuna dek elenir (izler).
// · Düşman uyuyanı vurursa bitirir (raunt boyunca elenir). Takım arkadaşı yanına gelip SAĞ TIK basılı tutarak 3 sn'de kaldırır (%30 canla);
//   uzaklaşma / hasar alma / ateş etme iptal eder. Kişi başı raunt başına en çok 2 kaldırma, her asker raunt başına en çok 2 kez kaldırılır.
// · Raunt: hazırlık (5 sn, donuk, sınıf seçimi 1–5) → 2:30 → bitiş (4 sn afiş). Bir takımın hepsi uyuduysa / elendiyse diğeri kazanır; süre biterse
//   ayakta kalan çok olan, eşitse ayaktakilerin toplam canı çok olan, o da eşitse berabere. Kısa maç 5 raunt (ilk 3), uzun 10 raunt (ilk 6, 5. rauntan sonra taraf değişir).
// YETKİLİ taraf (çevrimdışı oyun / sunucu) kuralları uygular; çevrim içi istemci durumu anlık görüntüden alır (snapshot 'uy' + asker 'dn' / 'uq') ve olaylarla (uyd / uyv / uyo / uyr / uyg / uye) afiş / akış yazar.
import { LIMITS } from './balance.js';
import { removeDeployable } from './gadgets.js';
import { t } from '../i18n/index.js';
import '../i18n/uyku.js';
import { UykuHud } from './uykuHud.js';

export const UY_REACH = 2.2;                       // kaldırma menzili (yatay m)
const PHASES = ['prep', 'live', 'post', 'over'];
const WIN_CODE = { blue: 1, red: 2, draw: 3 }, WIN_OF = [null, 'blue', 'red', 'draw'];
const WHY = ['elim', 'both', 'count', 'hp', 'tie'];

export class Uyku {
  constructor(g) {
    this.g = g;
    this.net = !!g.online;                         // çevrim içi istemci: kural işletmez, anlık görüntüyü uygular
    this.rounds = g.mode.rounds === 10 ? 10 : 5;
    this.need = this.rounds === 10 ? 6 : 3;          // kazanmak için gereken raunt
    this.half = this.rounds === 10 ? 5 : 0;          // uzun maç: 5. rauntan sonra taraf değişimi
    this.round = 1; this.phase = 'prep'; this.t = LIMITS.uyPrep;
    this.swapped = false; this.last = null; this.why = ''; this.final = false; this.over = null;
    this.contact = false;                            // bu rauntta ilk temas oldu mu (botlar rotayı bırakır)
    this.endT = 0;                                   // raunt bitince donan raunt süresi (gösterim)
    this.hist = [];                                  // raunt sonuçları ['blue' | 'red' | 'draw']
    this.stats = { downs: 0, revives: 0, outs: 0, fins: 0, bleeds: 0 };
    this.ui = null; this.pend = [];                  // arayüz (ilk HUD karesinde kurulur) + o ana dek biriken olaylar
    this.specId = -1;                                // elenmişken izlenen takım arkadaşı
    g.tickets.blue = 0; g.tickets.red = 0;           // takım skoru = kazanılan raunt (HUD skor kutuları + anlık görüntü 'tk')
    g.timeLeft = this.t;
  }

  get live() { return this.phase === 'live'; }
  get prep() { return this.phase === 'prep'; }
  get dmgOk() { return this.phase === 'live'; }      // hazırlıkta / raunt sonu afişinde hasar yok

  // takım sayımı: üye (boş yuva hariç), ayakta, uyuyan, elenen, ayaktakilerin toplam canı
  count(team) {
    let n = 0, up = 0, dn = 0, out = 0, hp = 0;
    for (const s of this.g.soldiers) {
      if (s.vacant || s.team !== team) continue;
      n++;
      if (s.alive && !s.downed) { up++; hp += Math.max(0, s.hp); } else if (s.alive) dn++; else out++;
    }
    return { n, up, dn, out, hp };
  }
  // şu an önde olan takım (ayakta kalan, eşitse can); eşitse null
  leader() {
    const B = this.count('blue'), R = this.count('red');
    if (B.up !== R.up) return B.up > R.up ? 'blue' : 'red';
    if (Math.round(B.hp) !== Math.round(R.hp)) return B.hp > R.hp ? 'blue' : 'red';
    return null;
  }

  // donuk mu (hazırlık ya da uyuyor): girdi sıfırlanır, ateş yok
  frozen(s) { return !!s.downed || (this.phase === 'prep' && s.alive); }

  // ───── yetkili adım (Game.updateMode) ─────
  update(dt) {
    const g = this.g;
    if (this.net || this.phase === 'over') return;
    this.t -= dt;
    if (this.phase === 'prep') { if (this.t <= 0) this.goLive(); }
    else if (this.phase === 'live') {
      this.tickRevive(dt);
      this.tickBleed(dt);
      const r = this.roundResult();
      if (r) this.endRound(r[0], r[1]);
    } else if (this.phase === 'post' && this.t <= 0) { if (this.final) this.finish(); else this.startRound(); }
    g.timeLeft = this.phase === 'post' || this.phase === 'over' ? this.endT : Math.max(0, this.t);
  }

  // çevrim içi istemci: anlık görüntüler arası yerel süre akışı (gösterim)
  frame(dt) {
    if (!this.net) return;
    if (this.phase !== 'post' && this.phase !== 'over') this.t = Math.max(0, this.t - dt);
    for (const s of this.g.soldiers) if (s.downed && !(s.rvP > 0)) s.bleedT = Math.max(0, (s.bleedT || 0) - dt);
  }

  roundResult() {
    const B = this.count('blue'), R = this.count('red');
    // rakipsiz raunt (bir takımda hiç asker yok: botsuz odada ilk oyuncu, karşı takıma kimse gelmedi): raunt sayılmaz, bitmez;
    // süre dolarsa yeniden başlar. Karşı takıma biri katılınca raunt baştan (Game.claimSlot → uyku.joined)
    if (!B.n || !R.n) { if (this.t <= 0) this.t = LIMITS.uyRound; return null; }
    if (!B.up && !R.up) return ['draw', 'both'];
    if (!B.up) return ['red', 'elim'];
    if (!R.up) return ['blue', 'elim'];
    if (this.t > 0) return null;
    if (B.up !== R.up) return [B.up > R.up ? 'blue' : 'red', 'count'];
    if (Math.round(B.hp) !== Math.round(R.hp)) return [B.hp > R.hp ? 'blue' : 'red', 'hp'];
    return ['draw', 'tie'];
  }

  goLive() {
    this.phase = 'live'; this.t = LIMITS.uyRound;
    this.g.netEvent({ e: 'uyg', n: this.round });
    this.fx({ e: 'uyg', n: this.round });
  }

  endRound(w, why) {
    const g = this.g, B = this.count('blue'), R = this.count('red');
    this.endT = Math.max(0, this.t);
    this.phase = 'post'; this.t = LIMITS.uyPost;
    this.last = w; this.why = why; this.hist.push(w);
    if (w !== 'draw') g.tickets[w] += 1;
    for (const s of g.soldiers) if (!s.vacant && s.team === w && s.alive && !s.downed) s.score += 50;      // raunt galibiyeti: ayakta kalan kazananlar +50
    this.final = g.tickets.blue >= this.need || g.tickets.red >= this.need || this.round >= this.rounds;
    const ev = { e: 'uye', n: this.round, w: WIN_CODE[w], y: WHY.indexOf(why), u: [B.up, R.up], h: [Math.round(B.hp), Math.round(R.hp)], f: this.final ? 1 : 0, sc: [g.tickets.blue, g.tickets.red] };
    g.netEvent(ev); this.fx(ev);
    g.emit('uyround', { n: this.round, w, why, t: LIMITS.uyRound - this.endT, b: B, r: R });
  }

  finish() {
    const g = this.g, b = g.tickets.blue, r = g.tickets.red;
    this.phase = 'over';
    const w = b > r ? 'blue' : r > b ? 'red' : 'draw';
    this.over = [w, w === 'draw' ? t('uy.endDraw', { b, r }) : t('uy.endWin', { b: Math.max(b, r), r: Math.min(b, r) })];
  }

  // again: aynı raunt baştan (rakipsiz rauntta karşı takıma oyuncu geldi / test); skor ve raunt sayısı değişmez
  startRound(again = false) {
    const g = this.g;
    if (!again) this.round++;
    if (!again && this.half && this.round === this.half + 1) this.swap();
    this.phase = 'prep'; this.t = LIMITS.uyPrep; this.last = null; this.contact = false;
    for (const d of [...g.deployables]) removeDeployable(g, d);                      // mayın / cephane kutusu raunt arasında kalmaz
    for (const p of g.projectiles) if (p.mesh) g.scene.remove(p.mesh);
    g.projectiles.length = 0;
    for (const s of g.soldiers) {
      s.rvN = 0; s.rvdN = 0; s.uyOut = false; s.rvWant = false;
      if (s.vacant) continue;
      s.downed = false;
      g.respawn(s, true);                                                            // takım doğuşları (spawn: tam can, temiz durum)
    }
    const ev = { e: 'uyr', n: this.round, sw: this.swapped ? 1 : 0 };
    g.netEvent(ev); this.fx(ev);
  }

  // Game.claimSlot: raunt sürerken insan katıldı. Takımı o ana dek boştaysa (rakipsiz raunt) raunt baştan başlar: herkes doğar, katılan da oynar.
  // true: raunt yeniden başladı (katılan doğdu). Takımında başkası varsa raunt sonuna dek izler (çağıran elenmiş yapar)
  joined(s) {
    if (this.net || this.phase === 'over') return false;
    let mates = 0;
    for (const o of this.g.soldiers) if (o !== s && !o.vacant && o.team === s.team) mates++;
    if (mates) return false;
    this.startRound(true);
    return true;
  }

  // uzun maç devre arası: doğuş tarafları yer değiştirir (yeniden doğuşu startRound yapar). net: istemci aynı değişimi uygular
  swap() {
    const g = this.g, sp = g.map.spawns, bz = g.map.baseZones;
    g.map.spawns = { ...sp, blue: sp.red, red: sp.blue };
    if (bz) g.map.baseZones = { blue: bz.red, red: bz.blue };
    g.swapSides = !g.swapSides; this.swapped = !this.swapped;
    g._tac = undefined; g._tacKey = null;
  }

  // ───── uyuma / bitirme / kaldırma ─────
  // Soldier.takeDamage: can 0'a indi → ölmek yerine uyur. false: bu mod uygulamadı (normal ölüm)
  down(s, by, w, hs) {
    if (this.net || this.phase !== 'live' || s.downed || s.vacant) return false;
    const g = this.g;
    if (s.cook?.lit) s._dropLit();
    s.cook = null;
    if (s.botCook) { s.cook = { t: s.botCook.t, id: s.botCook.gid, lit: true }; s.botCook = null; s._dropLit(); s.cook = null; }
    s.nadeVis = null;
    if (s.veh) g.vehicles?.exit(s);
    s.downed = true; s.hp = 0; s.bleedT = LIMITS.uyBleed; s.rvP = 0; s.rvBy = null; s.rvWant = false;
    s.prone = true; s.crouching = false; s.sprinting = false; s.ads = false; s.reloadT = 0; s.useT = 0; s.swing = null; s.leanDir = 0; s.burstLeft = 0; s.reviveTarget = null;
    s.vel.x = 0; s.vel.z = 0; s.pBody = s.yaw;
    s.spawnN = (s.spawnN || 0) + 1;                                                  // çevrim içi: yerel tahmin sunucu durumuna eşitlenir (yüzüstü, donuk)
    s.deaths++;
    let k = by && by !== s ? by : g.assists?.creditFor(s) || null;
    if (k && (k === s || k.team === s.team)) k = null;
    if (k) { k.kills++; k.score += hs ? 150 : 100; s.lastHit = k; }
    g.assists?.onDeath(s, k);
    s.uyBy = k; s.uyDownT = g.time; this.contact = true;                            // contact: botlar rota noktasını bırakıp düşmana yönelir (uykuBots.js)
    this.stats.downs++;
    for (const b of g.brains) b.onMateDown?.(s, k);
    const ev = { e: 'uyd', k: k ? k.id : -1, v: s.id, w: w || '', hs: hs ? 1 : 0 };
    g.netEvent(ev); this.fx(ev);
    g.emit('uydown', { s, k });
    return true;
  }

  // uyuyan asker raunt sonuna dek elenir. why: 'fin' (düşman bitirdi) · 'bleed' (kanama bitti)
  out(s, by, why) {
    const g = this.g;
    s.downed = false; s.alive = false; s.hp = 0; s.deadT = 0; s.deadDir = Math.random() > 0.5 ? 1 : -1;
    s.vel.set(0, 0, 0); s.ads = false; s.revivable = false; s.respawnT = 1e9; s.uyOut = true; s.rvP = 0; s.rvBy = null; s.rvWant = false;
    if (by && by !== s && by.team !== s.team) by.score += 50;
    this.stats.outs++; if (why === 'fin') this.stats.fins++; else this.stats.bleeds++;
    const ev = { e: 'uyo', v: s.id, k: by && by.team !== s.team ? by.id : -1, r: why === 'bleed' ? 1 : 0 };
    g.netEvent(ev); this.fx(ev);
  }

  // takeDamage: uyuyan askere hasar. Düşman (ya da düşmanın patlayıcısı) bitirir; dost / kendi hasarı / dünya yok sayılır
  hitDowned(s, by, zone) {
    if (this.net || !this.dmgOk || !by || by === s || by.team === s.team) return;
    if (by.isPlayer) this.g.emit('hitmark', { victim: s, zone, dead: true, dmg: 1, pn: 0 });
    else if (by.human) this.g.netEvent({ e: 'hm', by: by.id, dead: 1, hd: zone === 'head' ? 1 : 0 });
    this.out(s, by, 'fin');
  }

  // Soldier.die (intihar / düşme / boğulma): bu modda doğrudan elenir
  onDeath(s) { s.downed = false; s.revivable = false; s.respawnT = 1e9; s.uyOut = true; s.rvWant = false; }

  // r, v'yi şu an kaldırabilir mi (menzil + haklar)
  canRev(r, v) {
    return r !== v && r.alive && !r.downed && v.downed && r.team === v.team && (r.rvN | 0) < LIMITS.uyRevMax && (v.rvdN | 0) < LIMITS.uyRevMax
      && Math.hypot(r.pos.x - v.pos.x, r.pos.z - v.pos.z) < UY_REACH && Math.abs(r.pos.y - v.pos.y) < 1.6;
  }
  // haklar açısından (menzil yok): botun görev seçimi / HUD
  revOk(r, v) { return r !== v && v.downed && r.team === v.team && (r.rvN | 0) < LIMITS.uyRevMax && (v.rvdN | 0) < LIMITS.uyRevMax; }
  // menzildeki en yakın uyuyan takım arkadaşı (haklardan bağımsız; istem / HUD için)
  candidate(s) {
    if (!s.alive || s.downed) return null;
    let best = null, bd = UY_REACH;
    for (const v of this.g.soldiers) {
      if (v === s || !v.downed || v.team !== s.team) continue;
      const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
      if (d < bd && Math.abs(v.pos.y - s.pos.y) < 1.6) { bd = d; best = v; }
    }
    return best;
  }
  // sağ tık kapısı (oyuncu: Player.update, sunucu: humanTick): kaldırılabilir arkadaş yanındaysa sağ tık nişan değil kaldırmadır
  gate(s, held) {
    const c = s.alive && !s.downed ? this.candidate(s) : null;
    if (!c || !this.canRev(s, c)) { s.rvWant = false; return false; }
    if (held) s.ads = false;
    s.rvWant = !!held;
    return s.rvWant;
  }

  tickRevive(dt) {
    const g = this.g, REV = LIMITS.uyRevive;
    for (const v of g.soldiers) {
      if (!v.downed) continue;
      let r = v.rvBy && v.rvBy.rvWant && this.canRev(v.rvBy, v) ? v.rvBy : null;
      if (!r) {
        let bd = 1e9;
        for (const o of g.soldiers) {
          if (!o.rvWant || !this.canRev(o, v)) continue;
          const d = Math.hypot(o.pos.x - v.pos.x, o.pos.z - v.pos.z);
          if (d < bd) { bd = d; r = o; }
        }
      }
      if (!r) { v.rvP = 0; v.rvBy = null; continue; }
      if (r !== v.rvBy) { v.rvBy = r; v.rvP = 0; r.uyRvT0 = g.time; }
      if (r.sinceShot < 0.3 || r.lastDmgT > r.uyRvT0) { v.rvP = 0; r.uyRvT0 = g.time; continue; }      // ateş etti / hasar aldı: baştan
      v.rvP += dt;
      if (v.rvP >= REV) this.revive(v, r);
    }
  }

  tickBleed(dt) {
    for (const s of this.g.soldiers) {
      if (!s.downed || s.rvP > 0) continue;                                          // kaldırılırken kanama durur
      s.bleedT -= dt;
      if (s.bleedT <= 0) this.out(s, null, 'bleed');
    }
  }

  revive(v, r) {
    const g = this.g;
    v.downed = false; v.bleedT = 0; v.rvP = 0; v.rvBy = null;
    v.hp = Math.max(1, Math.round(v.maxHp * LIMITS.uyReviveHp));
    v.rvdN = (v.rvdN | 0) + 1; r.rvN = (r.rvN | 0) + 1; r.rvWant = false;
    v.standUp();
    v.lastHit = null; v.uyBy = null;
    if (v.dmgLog) v.dmgLog.length = 0;
    v.spawnN = (v.spawnN || 0) + 1;                                                  // çevrim içi: yerel tahmin ayağa kalkmış duruma eşitlenir
    if (v.brain) v.brain.reset();
    r.score += 80;
    this.stats.revives++;
    const ev = { e: 'uyv', v: v.id, by: r.id };
    g.netEvent(ev); this.fx(ev);
  }

  // Hazırlıkta sınıf / yükleme seçimi hemen geçerli (raunt başındaki para yok; oyuncunun kendi silahları). ctl: oyuncu (Game) ya da sunucudaki insan kaydı
  prepApply(s, ctl) {
    if (this.net || this.phase !== 'prep' || !s || !s.alive || s.downed || !ctl) return;
    let ch = false;
    if (ctl.pendingClass && ctl.pendingClass !== s.cls && !s.def.zombie) { s.setClass(ctl.pendingClass); ch = true; }
    ctl.pendingClass = null;
    if (ctl.pendingLoadout) { s.choice = ctl.pendingLoadout; ctl.pendingLoadout = null; s.items = s.loadout(); ch = true; }
    if (!ch) return;
    s.cur = 0; s.hp = s.maxHp; s.reloadT = 0; s.switchT = 0; s.useT = 0; s.cook = null;
    s._syncWeaponModel?.(true);
    this.g.emit('switch', s);
    if (s.human) this.g.emit('botcls', s);                                           // sunucu: sınıf değişti → kadro (istemciler modeli yeniler)
  }

  // ───── çevrim içi ─────
  pack() { return [this.round, PHASES.indexOf(this.phase), Math.round(this.t * 10), this.swapped ? 1 : 0, WIN_CODE[this.last] || 0, this.rounds]; }
  applyNet(a) {
    if (!Array.isArray(a)) return;
    this.round = a[0] | 0; this.phase = PHASES[a[1]] || 'live'; this.t = (a[2] || 0) / 10;
    if (!!a[3] !== this.swapped) this.swap();
    this.last = WIN_OF[a[4] | 0] || null;
    if (a[5]) { this.rounds = a[5] === 10 ? 10 : 5; this.need = this.rounds === 10 ? 6 : 3; this.half = this.rounds === 10 ? 5 : 0; }
  }
  // asker başına alanlar (protocol.js packSoldier): dn [kanama ×10, kaldırma ilerlemesi ×10, kaldıran] yalnız uyurken · uq kaldırma hakları (kaldırdığı + 4 × kaldırıldığı)
  netSoldier(s, p) {
    const d = p.dn;
    s.downed = !!d && !!p.a;
    if (s.downed) { s.bleedT = d[0] / 10; s.rvP = d[1] / 10; s.rvBy = d[2] >= 0 ? this.g.soldiers[d[2]] || null : null; } else { s.rvP = 0; s.rvBy = null; }
    const q = p.uq | 0; s.rvN = q & 3; s.rvdN = q >> 2;
    s.uyOut = !p.a;
  }
  onNet(ev) {
    const g = this.g;
    if (ev.e === 'uyr') { this.round = ev.n; this.phase = 'prep'; this.t = LIMITS.uyPrep; if (!!ev.sw !== this.swapped) this.swap(); }
    else if (ev.e === 'uyg') { this.phase = 'live'; this.t = LIMITS.uyRound; }
    else if (ev.e === 'uyv') this.stats.revives++;
    else if (ev.e === 'uyd') this.stats.downs++;
    else if (ev.e === 'uye') { this.hist.push(WIN_OF[ev.w] || 'draw'); this.phase = 'post'; this.last = WIN_OF[ev.w]; this.why = WHY[ev.y] || ''; this.endT = g.timeLeft === Infinity ? 0 : g.timeLeft; }
    this.fx(ev);
  }

  // ───── arayüz olayları (çevrimdışı oyun + istemci; başsızda yok) ─────
  fx(ev) {
    if (this.g.headless) return;
    if (this.ui) this.ui.onEvent(ev); else this.pend.push(ev);
  }
  // Player: hazırlıkta 1–5 = sınıf seçimi (silah yuvası değil). true: tuş kullanıldı
  prepKey(s, code) {
    if (this.phase !== 'prep' || !s.alive || s.downed || !/^Digit[1-5]$/.test(code)) return false;
    const keys = Object.keys(this.g.classDefs).filter((k) => !this.g.classDefs[k].zombie), k = keys[+code[5] - 1];
    if (!k) return false;
    this.g.requestClass(k);
    if (!this.g.online) this.prepApply(s, this.g);
    return true;
  }
  // elenmişken / baygınken izlenen takım arkadaşı: ayaktakiler arasında döner (ayakta kimse yoksa baygın arkadaşlar; o da yoksa izleme yok → kendi görüşün)
  specList() {
    const me = this.g.playerSoldier, L = this.g.soldiers.filter((s) => s !== me && s.alive && !s.vacant && s.team === me.team), up = L.filter((s) => !s.downed);
    return up.length ? up : L;
  }
  specTarget() {
    const L = this.specList();
    if (!L.length) return null;
    let s = L.find((e) => e.id === this.specId);
    if (!s) {                                                                       // ilk seçim: en yakın ayaktaki arkadaş (bayılınca yanındaki)
      const me = this.g.playerSoldier, d = (e) => (e.downed ? 1e6 : 0) + Math.hypot(e.pos.x - me.pos.x, e.pos.z - me.pos.z);
      s = L.reduce((a, e) => (d(e) < d(a) ? e : a), L[0]); this.specId = s.id;
    }
    return s;
  }
  specCycle(d) {
    const L = this.specList();
    if (!L.length) return;
    const i = L.findIndex((e) => e.id === this.specId);
    this.specId = L[((i < 0 ? 0 : i + d) % L.length + L.length) % L.length].id;
  }
  // izleme kamerası (Player.update ölü dalı): takım arkadaşının arkasından, duvara girmeden. false: izlenecek kimse yok
  specCamera(cam, dt) {
    const me = this.g.playerSoldier, W = this.g.world;
    this.g._specHide = null;
    if ((me.alive && !me.downed) || this.g.ended) return false;                     // 12.227: baygınken de (bayılınca hemen arkadaşı izler)
    const tg = this.specTarget();
    if (!tg) return false;
    // aday ofsetler (arkadan, arkadan-yukarı, sol / sağ omuz, tepeden): duvara en az giren seçilir; arkası duvarsa kafanın içine girmesin
    const eye = tg.eye(), yaw = tg.yaw, pitch = Math.max(-0.6, Math.min(0.5, tg.pitch)), H = (this._sh ||= {});
    const C = (this._sc ||= [[0, 0.22, 2.8, 0], [0, 0.75, 2.4, 0.18], [0.55, 0.3, 2.4, 0], [-0.55, 0.3, 2.4, 0], [0, 2.2, 1.6, 0.55]]);
    let best = null, bs = -1;
    for (const [dy, up, L0, look] of C) {
      const a = yaw + dy, d = (this._sd ||= eye.clone()).set(Math.sin(a), up, Math.cos(a)).normalize();
      const hit = W.raycast(eye, d, L0 + 0.3, H), L = hit ? Math.max(0, hit.t - 0.3) : L0;
      const sc = L / L0 + (dy === 0 && up < 0.5 ? 0.15 : 0);
      if (sc > bs) { bs = sc; best = { x: eye.x + d.x * L, y: eye.y + d.y * L, z: eye.z + d.z * L, look }; }
      if (!hit && dy === 0 && up < 0.5) break;                                          // tam arka açık: yeter
    }
    const fp = bs < 0.35;                                                           // her yön kapalı (dar köşe): arkadaşın gözünden (modeli gizli)
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

  uiFrame(dt) { if (!this.g.headless) (this.ui ||= new UykuHud(this.g, this)).update(dt); }      // Hud.update sonunda
  dispose() { this.ui?.dispose(); this.ui = null; }
}
