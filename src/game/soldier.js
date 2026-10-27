import * as THREE from 'three';
import { createCharacter } from '../models/character.js';
import { WSTATS, CLASS_DEFS, OPTICS, OPTIC_ORDER, OPTIC_ALLOWED, resolveOptic, cleanEraOptics, makeLoadout, frontLoadout, TAC_RELOAD, BACKSTAB_DMG, ZOMBIE, ZTYPES, BOSS, ZBOSS, ggItems, cleanSkins, spaceLoadout } from './stats.js';
import { SWING_HIT_K } from './anim.js';
import { H_STAND, H_CROUCH, H_PRONE } from './collision.js';
import { dirFromAngles, clamp, rand, lerp } from './util.js';
import { TUNE } from './balance.js';
import { paintColorOf } from './paint.js';
import { tintPaint } from '../models/paintball.js';
import { pbItems } from './match.js';
import { cleanWear, wearCodeOf, botWear } from './wearIds.js';
import { releaseCapeSway } from '../models/wear.js';
import { throwState, pinSfx } from './grenade.js';
import { mgAt } from '../sim/vehicle.js';
import { spaceTp } from './space.js';
import { SWIM, swimCanFire, waterYAt } from '../sim/swim.js';

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const _o = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
// Koşarken / havadayken ateş serbest ama isabetsiz: ek saçılma (rad). 0,085 ≈ 4,9° → 20 m'de ~1,7 m, 50 m'de ~4,3 m (koşarak zıplayınca ikisi toplanır ≈ 9°).
const smooth01 = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export const SCOPE_ACC = 0.85;      // 12.156: insan keskin nişancının isabeti bu adsT'den sonra açılır (0,85 → 1 yumuşak); altı = belden
// 12.166 yana eğilme (Q / E): kafa LEAN_OFF m yana (eski 0,36), LEAN_DROP m aşağı (eski 0,07), kamera LEAN_ROLL rad yatık (eski 0,2 ≈ 11,5°).
// LEAN_PAD: kamera ile duvar arasında kalan en az pay (yakın düzlem 0,05 m + köşe payı). RL_GAP: reload bittikten sonra otomatik reload'ın bekleme süresi.
export const LEAN_OFF = 0.44, LEAN_DROP = 0.1, LEAN_ROLL = 0.25;
const LEAN_TORSO = 0.5, LEAN_SHIFT = 0.21;      // 3. şahıs gövde yatışı (rad, eski 0,32) + kalça kayması (m, eski 0,12): model kafası ≈ LEAN_OFF kadar kayar (eski 0,26 m ↔ vuruş kutusu 0,36)
const LEAN_PAD = 0.17, LEAN_RAYS = [[1, 0], [Math.cos(0.7), Math.sin(0.7)], [Math.cos(0.7), -Math.sin(0.7)]], RL_GAP = 0.3;
const SPRINT_SPREAD = 0.085, AIR_SPREAD = 0.075, sprintSpeed = () => TUNE.walkSpeed * 1.32;      // yürüme hızının 1,32 katı (eskiden 4,4 × 1,32 = 5,8): yürürken koşu cezası uygulanmaz

export const EYE_STAND = 1.62;
export const EYE_CROUCH = 1.16;
export const EYE_PRONE = 0.42;

export { makeLoadout };
// Eski ad: seçim yoksa sınıf varsayılanı
export function buildLoadout(cls, team, choice = {}) { return makeLoadout(cls, team, choice); }

const SHIELD_GEO = new THREE.SphereGeometry(0.85, 14, 10);

export class Soldier {
  constructor(game, { id, name, team, cls, isPlayer = false }) {
    this.game = game;
    this.id = id; this.name = name; this.team = team; this.cls = cls;
    this.isPlayer = isPlayer;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.height = H_STAND;
    this.onGround = true;
    this.crouching = false; this.crouchT = 0;
    this.prone = false; this.proneT = 0;
    this.leanDir = 0; this.leanT = 0; this.leanK = 0; this.leanOff = new THREE.Vector3(); this._leanRoom = LEAN_OFF;
    this.optic = isPlayer ? (game.opts?.optic || 'reddot') : OPTIC_ORDER[Math.floor(Math.random() * OPTIC_ORDER.length)];
    this.optics = isPlayer ? cleanEraOptics(game.opts?.frontOptics) : {};      // 12.174: silah başına nişangâh (1940'lar silahları; uzak askerlerde ağdan 'op')
    this.sprinting = false; this.ads = false; this.adsT = 0;
    this.eyeY = EYE_STAND;
    this.alive = false;
    this.kills = 0; this.deaths = 0; this.score = 0; this.assists = 0;         // assists: 12.165 (assist.js)
    this.respawnT = 0; this.protT = 0;
    this.recoilP = 0; this.bloom = 0; this.sinceShot = 9; this.rlDoneT = 0;
    this.cd = 0; this.reloadT = 0; this.switchT = 0; this.useT = 0;
    this.reloadTotal = 1; this.reloadStyle = 'mag'; this.reloadEmpty = true; this.shellT = 0;
    this.swing = null; this.comboN = -1; this.comboT = 0; this.autoSwitchT = 0;
    this.blindT = 0; this.blindMax = 1;
    this.cook = null; this.nadeUnder = false; this.botCook = null; this.throwT = 0; this.nadeVis = null; this.nadeNet = 0;     // 12.193 bomba: hazır / pim çekili, atış şekli, bot pişirmesi, 3. şahıs atış
    this.choice = isPlayer ? (game.opts?.loadout || {}) : { random: true };
    this.wear = isPlayer ? cleanWear(game.opts?.wear) : null;            // 12.167 kıyafet tercihi { c: { sınıf: kod }, all } (çevrimiçinde başkalarınınki yavaş alan wr → wearCode)
    this.wearCode = '';
    this.skins = isPlayer ? cleanSkins(game.opts?.skins) : null;          // silah kaplamaları { silah: kaplama } (12.122; botlar standart, çevrimiçinde sunucu / anlık görüntü)
    this.lastHit = null; this.lastDmgT = -99;
    this.walkPhase = 0; this.deadT = 0; this.deadDir = 1; this.flashT = 0;
    this.stepT = 0;
    this.botExtraSpread = 0;
    this.stanceLeft = false; this.stanceT = 1;        // 3. şahıs sol omuz duruşu (görsel): hedef ve yumuşatılmış değer (+1 sağ … −1 sol)
    this.shotOff = null;          // 3. şahıs kamerada: kameranın gözden ofseti (nişan noktasını kamera ışını belirler; mermi yine gözden çıkar)
    this.dmgMul = 1;
    this.ggLevel = 0;                           // Silah Yarışı seviyesi (0..14)
    this.boss = false; this.zLives = 0;       // Enfekte: boss mu, kalan ölüm hakkı (0 = bir sonraki doğuşta insana döner)
    this.ztype = 'walker'; this.abT = 0; this.abActive = 0; this.cloakNet = false;      // Enfekte: zombi türü, özel güç bekleme süresi / etkin süresi, ağdan gelen görünmezlik
    this.model = null;
    this.setClass(cls);
  }

  get item() { return this.items[this.cur]; }
  get stat() { return WSTATS[this.item.id]; }
  // ── Enfekte: zombi türü ve özel güç ──
  get zt() { return this.boss ? ZBOSS : ZTYPES[this.ztype] || ZTYPES.walker; }
  get ability() { return this.def.zombie ? this.zt.ability : null; }
  get abOn() { return this.abActive > 0; }
  get protected() { return this.alive && (this.protT > 0.001 || !!this.protNet); }        // doğma koruması (ağdan gelen bayrak dahil): vurulamaz, görünür kalkan

  get cloaked() { return this.cloakNet || (this.def.zombie && this.abActive > 0 && (this.zt.ability.id === 'cloak' || this.zt.ability.id === 'shadow')); }
  // ölüm ekranında: bir sonraki doğuşta insan mı olacak (can hakkı bitti)
  get willCure() { return !!this.def.zombie && this.zLives <= 0 && !this.alive; }
  // hız çarpanı (insanlarda sınıfın hızı; zombide türün hızı × etkin güç)
  get spd() {
    if (!this.def.zombie) return this.def.speed;
    const a = this.abActive > 0 ? this.zt.ability.id : '';
    return this.zt.speed * (this.boss ? BOSS.rageSpd : a === 'rage' ? 1.25 : a === 'burst' ? 1.7 : 1);
  }
  // zıplama çarpanı: zombiler insandan yüksek zıplar; vuruş kutusu ölçeği (model ölçeğiyle aynı)
  get jumpMul() { return this.def.zombie ? (this.boss ? BOSS.jump : this.zt.jump || 1) : 1; }
  zombieMaxHp() {
    if (!this.boss) return this.zt.hp;
    const n = this.game.mode.total || 12, k = this.game.bossCount || 1, eff = n - (k - 1) * BOSS.secondOffset;       // 2 boss'luysa eşdeğer oyuncu sayısı daha düşük
    return Math.round(BOSS.hp * BOSS.growth ** (eff - 10));                                                         // oyuncu sayısı arttıkça üstel artar (insanların ateş gücü de artar)
  }

  // Özel güç (F / sağ tık). Sunucu da istemci de (çevrimdışı) aynı kodu çalıştırır. Döner: kullanıldı mı
  useAbility() {
    if (!this.alive || this.swim || !this.def.zombie || this.abT > 0 || this.game.ended || this.game.graceLeft > 0) return false;
    const ab = this.zt.ability, from = this.pos.clone();
    if ((ab.id === 'blink' || ab.id === 'shadow') && !this._blink(ab.range)) { this.abT = 0.8; return false; }
    this.abT = ab.cd; this.abActive = ab.dur;
    this.game.abilityFx(this, ab.id, from);
    return true;
  }

  // Işınlanma: yatay bakış yönünde en çok `range` m; engel varsa önünde durur
  _blink(range) {
    const g = this.game, d = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const o = new THREE.Vector3(this.pos.x, this.pos.y + 0.9, this.pos.z);
    const hit = g.world.raycast(o, d, range, {});
    const dist = hit ? hit.t - 0.9 : range;
    if (dist < 1.5) return false;
    this.pos.x += d.x * dist; this.pos.z += d.z * dist;
    g.world.settle(this);
    this.vel.set(d.x * 2, 0, d.z * 2);
    return true;
  }

  // Silah Yarışı: seviye yükselince elindeki silah hemen yeni seviyeninkiyle değişir
  setLevel(n) {
    this.ggLevel = n;
    this.items = ggItems(n);
    this.cur = 0; this.cd = 0.25; this.reloadT = 0; this.useT = 0; this.swing = null; this.burstLeft = 0; this.switchT = 0.3; this.adsT = 0;      // 12.154: yeni silah belden başlar
    this._syncWeaponModel(true);
    this.game.emit('switch', this);
  }

  loadout() { return (this.game.mode?.front && !CLASS_DEFS[this.cls]?.zombie ? frontLoadout : this.game.mode?.space ? spaceLoadout : makeLoadout)(this.cls, this.team, this.choice); }      // 12.157: Uzay enerji silahları · 12.158: Cephe 1940'lar donanımı (FRONT_KIT)      // 12.157: Uzay modunda enerji silahları (stats.js SPACE_CLASS)
  get opticId() { return this.opticFor(this.item.id); }
  opticFor(id) { return resolveOptic(id, this.optics?.[id] || this.optic); }      // 12.174: silaha özgü seçim (dönem nişangâhları) yoksa genel tercih
  get scoped() { return !!this.stat.scope || this.opticDef?.overlay === 'scope'; }      // 12.174: dürbünlü silah ya da dürbün takılı tüfek (12.153 / 12.156 kuralları)
  get adsRate() { const o = this.opticDef, t = o?.adsTime || this.stat.adsTime; return t ? 1 / t : o?.overlay === 'scope' ? 6 : 9 * (o?.adsK || 1); }      // nişana geçiş hızı (1/sn; 12.153 adsTime, 12.174 dönem dürbünü / diyoptr)
  skinOf(id) { return (this.skins && this.skins[id]) || 'std'; }
  // 12.167 kıyafet: ağdan gelen kod > kendi tercihim (insan) > bot çeşitlemesi (kimliğe bağlı, istemcide aynı)
  wearSpec() {
    if (this.wearCode) return this.wearCode;
    if (this.isPlayer || this.human) return wearCodeOf(this.wear, this.cls);
    return botWear(this.cls, this.id);
  }
  get opticDef() { const o = this.opticId; return o ? OPTICS[o] : null; }
  get zoomNow() { const st = this.stat; if (!st.zoom) return 0; return this.opticDef && !st.ball ? this.opticDef.zoom : st.zoom; }      // paintball: nişangâhtan bağımsız hafif yakınlaştırma
  get overlay() { return this.stat.ball ? 'pbring' : this.opticDef ? this.opticDef.overlay : 'none'; }          // paintball: HUD'da halka nişangâh (#pbret)

  setClass(cls) {
    this.cls = cls;
    const def = CLASS_DEFS[cls];
    this.def = def;
    this.maxHp = def.hp;
    this.hp = def.hp;
    { const sc = def.zombie ? (this.boss ? BOSS.scale : [this.zt.scale, this.zt.scale, this.zt.scale]) : [1, 1, 1]; this.hbW = Math.max(sc[0], sc[2]); this.hbH = sc[1]; }      // model ölçeği = vuruş kutusu ölçeği
    this.items = this.loadout();
    this.cur = 0;
    if (this.game.headless) {                                    // sunucu/test: 3B model kurulmaz (bellek+CPU); yalnızca model alanlarını okuyan mantık için hafif taslak
      this.model = this.model || { root: { visible: true, rotation: { x: 0 } }, weapon: {}, optic: this.optic, setWeapon() {} };
      this._modelWeapon = this.items[0].id;
      return;
    }
    this._buildModel();
  }

  // 3B model (sınıf / kıyafet değişince yeniden kurulur)
  _buildModel() {
    const def = this.def, cls = this.cls;
    // görünüm: sınıf teçhizatı değişir → modeli yeniden kur
    if (this.model) { this.game.scene.remove(this.model.root); if (this.model.root) releaseCapeSway(this.model.root); }
    const pb = this.game.mode?.paintball && !def.zombie;            // paintball modu: herkes paintball oyuncusu kıyafetinde (kişisel boya rengi + forma no)
    this.model = createCharacter({ team: def.zombie ? 'zomb' : this.team, cls, ztype: this.boss ? 'boss' : this.ztype, skinIndex: this.id, weapon: this.items[0].id, optic: this.opticFor(this.items[0].id), outfit: pb ? 'paintball' : this.game.mode?.space && !def.zombie ? 'space' : this.game.mode?.front && !def.zombie ? 'ww2' : null, paint: pb ? paintColorOf(this) : undefined, num: ((this.id * 7 + 11) % 90) + 10, wear: def.zombie ? null : this.wearSpec() });      // 12.167 kıyafet · forma no: 10–99, savaşçıya göre sabit · 12.158 Cephe: 1940'lar üniforması
    this.model.root.visible = this.alive;
    this.game.scene.add(this.model.root);
    this._modelWeapon = this.items[0].id;
  }

  eye(out = new THREE.Vector3()) { return out.set(this.pos.x + this.leanOff.x, this.pos.y + this.eyeY + this.leanOff.y, this.pos.z + this.leanOff.z); }
  aimDir(out = new THREE.Vector3()) { return dirFromAngles(this.yaw, this.pitch + this.recoilP, out); }
  right(out = new THREE.Vector3()) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  center(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.height * 0.6, this.pos.z); }

  spawn(point, protect = 2) {
    if (this.veh) this.game.vehicles?.release(this);                              // 12.177: koltuk kaydı kalmasın
    this.pos.set(point.x, 0, point.z);
    this.vel.set(0, 0, 0);
    this.yaw = point.ry; this.pitch = 0; this.recoilP = 0;
    this.alive = true; this.deadT = 0; this.spawnN = (this.spawnN || 0) + 1;     // spawnN: ağ istemcisi yeniden doğmayı fark etsin
    if (this.def.zombie) { this.maxHp = this.zombieMaxHp(); this.abT = 2.5; this.abActive = 0; this.cloakNet = false; }    // türüne göre can; güç kısa bir bekleme ile başlar
    this.hp = this.maxHp;
    this.items = this.game.mode.gungame ? ggItems(this.ggLevel) : this.game.mode.paintball ? pbItems() : this.loadout();
    this.cur = 0;
    this.cd = 0; this.reloadT = 0; this.switchT = 0; this.useT = 0; this.swing = null; this.comboT = 0; this.autoSwitchT = 0; this.blindT = 0; this.burstLeft = 0;
    this.cook = null; this.backT = 0; this.backTo = -1; this.nadeUnder = false; this.botCook = null; this.throwT = 0; this.nadeVis = null;
    this.protT = protect; this.protNet = false;
    this.crouching = false; this.prone = false; this.proneT = 0; this.crouchT = 0; this.leanDir = 0; this.leanT = 0; this.leanK = 0; this.leanOff.set(0, 0, 0); this._leanRoom = LEAN_OFF;
    this.height = H_STAND; this.ads = false; this.adsT = 0;
    this.air = SWIM.breath; this.drownAcc = 0; this.swim = false; this.under = false; this.wDepth = 0;      // 12.180 nefes / yüzme
    this.model.root.visible = !this.isPlayer;
    this.model.root.rotation.x = 0;
    this._syncWeaponModel(true);
    if (this.dmgLog) this.dmgLog.length = 0;                                         // 12.165: yeniden doğuş / canlandırma asist kaydını sıfırlar
    this.game.emit('spawn', this);
  }

  // 3. şahıs: elde görünmesi gereken bomba (bot pişirme / atış savruluşu; çevrim içinde uzaktaki bot: F_NLIT bayrağı + 'gr' olayı)
  _nadeVisId() {
    if (this.nadeVis) return this.nadeVis;
    if (!this.game.online || this.isPlayer || this.stat.kind === 'throwable') return null;
    const g2 = this.items[2], k = g2 && WSTATS[g2.id]?.kind === 'throwable';
    return k && ((this.nadeNet & 2) || this.throwT > 0) ? g2.id : null;
  }

  _syncWeaponModel(force = false) {
    if (this.isPlayer && !this.game.showSelf) return;
    const id = this._nadeVisId() || (this.stat.kind === 'medkit' ? null : this.item.id);      // 12.193: bot pişirirken / atarken elinde bomba
    if (!force && id === this._modelWeapon) return;
    this._modelWeapon = id;
    const w = this.model.setWeapon(id, id ? this.opticFor(id) : this.optic, id ? this.skinOf(id) : 'std');
    if (w && WSTATS[id]?.ball) tintPaint(w, paintColorOf(this));                  // paintball: hazne / tüp savaşçının boya renginde
  }

  // Elde tutulabilir mi? Biten tek kullanımlık gadget (bomba, mayın, kutu, ilk yardım) elle tutulamaz; silahlar şarjörü boş olsa da tutulur.
  canEquip(i) {
    const it = this.items[i];
    if (!it) return false;
    const k = WSTATS[it.id].kind;
    if (k === 'throwable' || k === 'mine' || k === 'ammobox' || k === 'medkit') return it.mag > 0;
    if (k === 'launcher') return it.mag > 0 || it.reserve > 0;
    return true;
  }

  switchTo(i) {
    if (i === this.cur || !this.items[i] || !this.alive || !this.canEquip(i)) return;
    const eq = Math.min(0.35, WSTATS[this.items[i].id].equip ?? 0.3);
    if (this.cook?.lit) this._dropLit();                                           // 12.193: pimi çekilmiş bomba geri takılmaz → ayağının dibine düşer (PUBG)
    this.cook = null; this.backT = 0; this.nadeUnder = false;                      // hazırlanan (pimi çekilmemiş) bomba cebe döner; atış şekli her çekişte üstten
    this.backTo = WSTATS[this.items[i].id].kind === 'throwable' ? this.cur : -1;   // attıktan sonra dönülecek silah
    this.cur = i; this.switchT = eq; this.reloadT = 0; this.rlDoneT = 0; this.useT = 0; this.swing = null; this.autoSwitchT = 0; this.burstLeft = 0;
    this.adsT = 0;      // 12.154: nişan eski silahındı; yeni silah belden başlar (eski: adsT ≈ 1 kalıyor, yeni silahın büyütmesi / dürbün örtüsü o karede açılıyordu). Dünya kamerası eski büyütmeyi Player'da kendi eğrisiyle söndürür
    this._syncWeaponModel();
    this.game.emit('switch', this);
  }

  // R: hemen başlar (sprint iptal etmez). Şarjörde mermi varsa "taktik reload" daha hızlıdır.
  // 12.166: reload az önce bittiyse ve o zamandan beri atış yoksa (rlDoneT, RL_GAP sn) yeniden başlamaz: dolu şarjör ancak bayat bir düzeltmeyle
  // 0 görünebilir → çift reload / animasyon olmasın. Tek yer: otomatik (autoReload), boş tetik (tryFire) ve R aynı kuralı izler; sunucu = istemci = çevrimdışı
  startReload() {
    const it = this.item, st = this.stat;
    if (st.kind === 'throwable') return this.cookNade();                          // 12.193 PUBG: bomba eldeyken R = pimi çek (pişir)
    if (this.reloadT > 0 || this.rlDoneT > 0 || this.swing || this.useT > 0 || !(st.kind === 'gun' || st.kind === 'launcher') || it.mag >= st.mag || it.reserve <= 0) return false;
    const style = st.reloadStyle || 'mag';
    this.reloadStyle = style;
    this.reloadEmpty = it.mag <= 0;
    this.ads = false;
    if (style === 'shell') {
      const n = Math.min(st.mag - it.mag, it.reserve);
      this.shellT = st.shell * 0.8;                                       // ilk mermi biraz erken girer
      this.reloadT = this.reloadTotal = this.shellT + (n - 1) * st.shell;
    } else {
      this.reloadT = this.reloadTotal = st.reload * (it.mag > 0 ? TAC_RELOAD : 1);
    }
    this.game.sfx.reload(this.pos, style, this.reloadTotal, this.reloadEmpty);
    this.game.emit('reload', this);
    this.game.netEvent({ e: 'rld', by: this.id, s: style, t: +this.reloadTotal.toFixed(3), em: this.reloadEmpty ? 1 : 0, sh: +(this.shellT || 0).toFixed(3) });
    return true;
  }

  // pompalı/çift namlu doldururken ateşle iptal et
  cancelShellReload() {
    if (this.reloadT > 0 && this.reloadStyle === 'shell' && this.item.mag > 0) { this.reloadT = 0; return true; }
    return false;
  }

  // Ateş modu (yalnızca otomatik silahlarda): semi = tek tek (her tık 1 mermi) → burst = seri (tek tık ya da basılı tutma 3-5 mermi, sonra tetik bırakılıp yeniden çekilmeli) → auto = basılı tutunca sürekli
  toggleFireMode() {
    const it = this.item, st = this.stat;
    if (st.kind !== 'gun' || !st.auto) return null;
    it.mode = this.fireModeNow === 'semi' ? 'burst' : this.fireModeNow === 'burst' ? 'auto' : 'semi';
    this.burstLeft = 0;
    this.game.emit('firemode', this);
    return it.mode;
  }
  get fireModeNow() { const st = this.stat; return st.kind === 'gun' && st.auto ? (this.item.mode || 'auto') : 'semi'; }
  get fireAuto() { return this.fireModeNow === 'auto'; }
  // seri atış uzunluğu: yavaş silahlarda 3, hızlılarda 4-5 mermi
  burstSize(st = this.stat) { return st.burst || (st.rpm < 700 ? 3 : st.rpm < 900 ? 4 : 5); }

  // Tetik: held = basılı, buf = yeni tık tamponu (>0). Dönen true → tampon tüketildi. Player ve sunucu (humanTick) aynı mantığı kullanır.
  triggerUpdate(held, buf) {
    if (!this.alive) { this.burstLeft = 0; return false; }
    if (this.veh && this.seat === 0) { this.burstLeft = 0; return false; }          // 12.177: sürücü ateş etmez (sol tık korna)
    if (this.swim && !this.cook && !swimCanFire(this, this.stat)) { this.burstLeft = 0; return false; }     // 12.180 yüzerken: yüzeyde yalnız tabanca, su altında hiçbiri
    if (this.stat.kind === 'throwable') return this._nadeTrigger(held, buf);
    const mode = this.fireModeNow;
    if (mode === 'auto') { if (held) this.tryFire(); return false; }
    if (mode === 'burst') {
      if (this.burstLeft > 0) {                                   // seri sürüyor: tetik bırakılsa da bitene kadar atar
        if (this.item.mag <= 0 || this.reloadT > 0 || this.switchT > 0) this.burstLeft = 0;
        else if (this.tryFire()) this.burstLeft--;
        return false;
      }
      if (buf > 0 && this.tryFire()) { this.burstLeft = this.burstSize() - 1; return true; }
      return false;
    }
    return buf > 0 && this.tryFire();
  }

  spreadNow(st) {
    const hipv = st.hip ?? 0.01, adsv = st.ads ?? 0.002;
    const vs = Math.hypot(this.vel.x, this.vel.z), speed = this.veh ? 0 : vs;          // 12.177: araçtaki yolcu koşmuyor (koşu / hareket cezası yerine araç sarsıntısı)
    if (st.ball) return this._ballSpread(st, hipv, adsv, speed);
    // 12.153: dürbünlü keskin nişancı (st.scope): isabet yalnız dürbün oturunca (adsT 0,6 → 1 yumuşak); belde / geçişte ilk atış indirimi yok (no-scope / erken quickscope şansa kalır)
    // 12.156: insan (oyuncu / sunucudaki insan) için belden keskin nişancı anlamlı isabetsiz (st.noscope koni; eski hip 0,03 → 10 m'de gövdeye %100) ve dürbün
    // TAM oturmadan (adsT < SCOPE_ACC) atış belden sayılır. Botlar eski eğride (bot nişanı ayrı: tacAim + botExtraSpread)
    const sc = st.scope || (st === this.stat && this.opticDef?.overlay === 'scope');      // 12.174: sürgülü / yarı otomatik tüfeğe takılan dönem dürbünü de
    const hum = sc && (this.isPlayer || this.human), a0 = hum ? SCOPE_ACC : 0.6;
    const sk = sc ? smooth01((this.adsT - a0) / (1 - a0)) : this.adsT;
    let s = lerp(hum ? st.noscope ?? hipv : hipv, adsv, sk);
    s += Math.min(speed * 0.0007, 0.0045) * (1 - this.adsT * 0.65);   // hareket cezası
    if (!this.onGround) s += AIR_SPREAD * (1 - this.adsT * 0.5);            // havadayken (zıplarken) atış çok dağılır
    if (this.firedSprinting || speed > sprintSpeed()) s += SPRINT_SPREAD * (1 - this.adsT);   // koşarken (Shift) atış serbest ama isabetsiz
    if (this.blindT > 0.5) s += 0.04;
    if (this.crouching) s *= 0.7;
    if (this.swim) s += 0.03;                                          // 12.180 yüzerken (yüzeyde tabanca): dalgada sallanır
    if (this.veh) s += Math.min(vs * 0.0008, 0.012) * (1 - this.adsT * 0.5);      // 12.177 hareketli araçtan atış: hızla artan sarsıntı (55 km/s ≈ +0,012 rad)
    s += this.bloom;                                                   // seri atışta açılma
    // duran oyuncunun ilk atışı (kısa bir aradan sonra) isabetli olsun
    // 12.198: saçmalı silahta (pompalı / çift namlu / AA-12 / dağıtıcı) indirim yok — desen hep aynı (eski ×0,2 duran ilk atışı tek kurşun gibi toplayıp
    // pompalıyı 15 m'de tek atış yapıyordu; menzil yalnız hasar düşüşüne kalıyordu)
    if (this.sinceShot > 0.3 && speed < 1.5 && this.onGround && !st.pellets) s *= sc ? 1 - 0.8 * sk : 0.2;
    return s + this.botExtraSpread;
  }

  // Paintball topu: her topta doğal sapma (ilk top da tam isabetli değil) + seri atışta büyüyen açılma (bloom). Nişan / çömelme / durma ikisini de küçültür.
  // Tamamen durum + tohumlu rastgele (Paint.rngFor) → istemci tahmini ile sunucu aynı yöne atar.
  _ballSpread(st, hipv, adsv, speed) {
    const a = this.adsT, still = speed < 1.5 && this.onGround;
    let s = lerp(hipv, adsv, a) * (still ? 0.8 : 1) * (this.crouching || this.prone ? 0.75 : 1);
    s += Math.min(speed * 0.0011, 0.007) * (1 - a * 0.5);                                   // koşarken / yürürken top dağılır
    if (!this.onGround) s += AIR_SPREAD * (1 - a * 0.5);
    if (this.firedSprinting || speed > sprintSpeed()) s += SPRINT_SPREAD * (1 - a);
    if (this.blindT > 0.5) s += 0.04;
    s += this.bloom * (1 - a * 0.25) * (this.crouching || this.prone ? 0.7 : 1) * (still ? 0.9 : 1);
    return s + this.botExtraSpread;
  }

  tryFire() {
    if (!this.alive || this.cd > 0 || this.switchT > 0 || this.useT > 0) return false;
    if (this.botCook && !this._botNade) return false;                                 // 12.193: bot elinde pişen bombayı tutuyor (ateş etmez)
    if (this.veh && (this.seat === 0 || this.stat.kind === 'mine' || this.stat.kind === 'ammobox' || this.stat.kind === 'medkit')) return false;     // 12.177: sürücü ateş etmez; araçtan mayın / kutu kurulmaz
    if (this.swim && !swimCanFire(this, this.stat)) return false;
    if (this.def.zombie && this.game.graceLeft > 0) return false;                     // Enfekte hazırlık süresi
    if (this.reloadT > 0 && !this.cancelShellReload()) return false;
    const it = this.item, st = this.stat;
    if (st.kind === 'melee') return this._melee(st);
    if (st.kind === 'medkit') return this._medkit(it, st);
    if (it.mag <= 0) {
      if (!this.startReload()) { this.cd = 0.3; this.game.sfx.dry(this.pos); if (this.isPlayer) this.game.emit('dry', this); }
      return false;
    }
    this.cd = 60 / st.rpm;
    it.mag--; this.rlDoneT = 0;                                // 12.166: gerçek atış → reload bekleme payı kalkar (RPG gibi tek mermilide hemen yeniden doldurur)
    if (st.kind === 'throwable') { this.sprinting = false; return this._throw(st); }
    if (st.kind === 'mine' || st.kind === 'ammobox') { this.sprinting = false; return this._place(st, it); }
    this.firedSprinting = this.sprinting;                      // koşarken ateş: bu atış için dağılma cezası (spreadNow)
    this.sprinting = false;
    if (st.kind === 'launcher') return this._rocket(st);
    this._shoot(st);
    this.firedSprinting = false;
    return true;                                               // şarjör bittiyse otomatik değiştirme bir sonraki update'te (autoReload) başlar
  }

  // 12.140: şarjör / hazne boşsa ve yedek varsa şarjörü kendiliğinden değiştir. HER silah türü (gun + launcher: RPG, M79,
  // pompalı 'shell', sürgülü 'bolt', paintball…) ve her durumda (tetik basılı, nişan, koşu, zıplama, silah çekildikten sonra).
  // update() içinde çağrılır: istemci (yerel oyuncu) ve sunucu (humanTick → s.update) aynı adımda aynı kuralı uygular.
  // Eskiden: oyuncuda hiç yoktu (boş tetiğe basınca, cd bitmişse başlıyordu → RPG / sürgülü cd'si yüzünden tık yutuluyordu),
  // sunucuda insanlar için yalnız 'gun' türünde ateşten hemen sonra başlıyordu (istemci tahmin etmiyordu → uyuşmazlık).
  autoReload() {
    if (this.reloadT > 0 || this.switchT > 0 || this.swing || this.useT > 0) return;
    if (this.game.online && !this.isPlayer) return;                     // çevrimiçi istemci: uzaktakilerin cephanesi tahmin edilmez
    const it = this.item, k = this.stat?.kind;
    if (!it || it.mag > 0 || it.reserve <= 0 || !(k === 'gun' || k === 'launcher')) return;
    this.startReload();
  }

  muzzleWorld(out) {
    if ((this.isPlayer && !this.game.showSelf) || this.game.headless) {
      const d = this.aimDir(_d), r = this.right(_v);
      if (this.isPlayer && this.game.player?.scopeOn) return out.copy(this.eye(_o)).addScaledVector(UP, -0.12).addScaledVector(d, 5);      // 12.153: dürbündeyken iz mermisi 5 m önden, retikülün altından hedefe ince çizgi olarak gider (eski: sağ-alttan çapraz beyaz çizgi)
      return out.copy(this.eye(_o)).addScaledVector(r, this.game.leftHand ? -0.16 : 0.16).addScaledVector(UP, -0.1).addScaledVector(d, 0.8);
    }
    const w = this.model.weapon;
    if (w) { w.updateWorldMatrix(true, false); return out.copy(w.userData.muzzle).applyMatrix4(w.matrixWorld); }
    return this.eye(out);
  }

  _shoot(st) {
    const g = this.game;
    // Mermi HER ZAMAN oyuncunun gözünden çıkar (duvar/köşe arkasından ateş edilemez).
    // 3. şahıs: nişan noktasını KAMERA ışını belirler (artı neyi gösteriyorsa); mermi gözden o noktaya gider, arada engel varsa ona çarpar.
    const origin = this.eye(_o);
    const camO = this.shotOff ? origin.clone().add(this.shotOff) : null;
    const base = this.aimDir(new THREE.Vector3());
    const spread = this.spreadNow(st);
    const pellets = st.pellets || 1;
    const muzzle = this.muzzleWorld(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(base, UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, base).normalize();
    g._firstPellet = true;
    // insan atışında sapma tohumlu (girdi sıra no): istemci tahmini (iz / kan) ile sunucunun ışını aynı yöne gider. 12.146: eskiden yalnız paintball;
    // mermide Math.random iki tarafta ayrı zar atıyordu → uzakta (sapma ≥ gövde) istemcinin gösterdiği kan ile sunucunun isabeti ayrışıyordu
    const rnd = g.paint.rngFor(this);                                     // bot / çevrimdışı: Math.random

    for (let i = 0; i < pellets; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * spread;
      const d = base.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      if (st.ball) g.paint.fire(this, origin, d, st, muzzle, camO); else g.shootRay(this, origin, d, st, muzzle, camO);
    }
    this.protT = 0;                                                              // ateş eden artık dokunulmaz değil (korumayla düşmana ateş edilemez)
    if (!st.ball && !(this.isPlayer && (g.player?.scopeOn || (!g.showSelf && g.player && g.player.thirdT < 0.5)))) g.effects.muzzle(muzzle, base);      // paintball: alev yok (gazla atar) · 12.153: dürbünde kendi alevi görüşü kapatmaz · 12.141: birinci şahısta dünya alevi (göz önünde düz sarı kutu) yok, silah modelinin alevi yeter
    g.sfx.shot(st.sound, this.pos);
    this.flashT = 0.06;
    if (st.charge) this.railT = 0;                                               // 12.160: 3. şahıs ray tüfeği şarjı (space.js spaceTp)
    this.sinceShot = 0;
    this.bloom = st.ball ? Math.min(this.bloom + (st.bloom ?? 0.003), st.bloomMax ?? 0.03) : Math.min(this.bloom + (st.kickV || 0.01) * 0.07, 0.005);
    if (this.isPlayer || this.human) {
      const k = (st.kickV || 0.01) * (this.adsT > 0.5 ? 0.7 : 1), perm = this.scoped ? 0.1 : 0.55;      // 12.153: keskin nişancı tepmesi çoğunlukla geri döner (dürbün hedefe oturur; eski: %55 kalıcı → her atışta ~45 px yukarı)
      this.pitch = Math.min(1.45, this.pitch + k * perm);   // kalıcı tırmanma: oyuncu aşağı çekerek telafi eder
      this.recoilP += k * (1 - perm);
      this.yaw += rand(-1, 1) * (st.kickH || 0.004);
      this.game.emit('fire', this);
    } else if (this.model.weapon) this.game.noiseAlert?.(this);
    if (st.bolt) this.game.emit('bolt', this);
    if (st.ping && this.item.mag === 0) this.game.sfx.clipPing?.(this.isPlayer ? null : this.pos);      // 12.158: yarı otomatik tüfekte boş klips fırlar
    this.game.alertNear?.(this.pos, this.team, st.sound === 'pistol' ? 25 : 45);
  }

  _rocket(st) {
    let d = this.aimDir(new THREE.Vector3()), m;
    if (this.shotOff) {
      // 3. şahıs: hedef noktayı kamera ışını verir; roket gözden o noktaya çıkar (köşeden/duvar arkasından atılamaz)
      const eye = this.eye(new THREE.Vector3()), co = eye.clone().add(this.shotOff), wh = this.game.world.raycast(co, d, 300, {});
      const nd = co.addScaledVector(d, wh ? wh.t : 300).sub(eye).normalize();
      if (nd.dot(d) > 0.9) d = nd;                                       // aşırı sapma (çok yakın hedef) → gözden düz
      m = eye.addScaledVector(d, 0.8);
    } else m = this.muzzleWorld(new THREE.Vector3());
    if (st.impact) this.game.spawnShell(this, m, d, st); else this.game.spawnRocket(this, m, d, st);
    this.game.sfx.shot(st.sound, this.pos);
    this.game.alertNear?.(this.pos, this.team, 40);
    if (this.isPlayer || this.human) { this.recoilP += st.kickV; this.game.emit('fire', this); }
    this.flashT = 0.1;
    return true;
  }

  // Bomba tetiği (12.144 → 12.193 PUBG tarzı; oyuncu ve sunucudaki insan aynı mantık):
  // ateşe bas → bomba hazırlanır (kol kurulur, yörünge önizlemesi), basılı tutarken R → pim çekilir: fünye işlemeye başlar (pişirme; el bombası 5 sn,
  // flaş 2,5 sn), sağ tık → atış şekli (üstten uzak / alttan yuvarlama), bırak → atılır. Pim çekilmeden atılırsa fünye bırakınca başlar (tam süre).
  // Pişirilen bomba elde süresi dolarsa elde patlar (el bombası atanı öldürür). Botlar tryFire → _throw (bot pişirmesi: botCook).
  _nadeTrigger(held, buf) {
    const it = this.item, st = this.stat;
    if (!this.cook) {
      if (buf <= 0 || this.cd > 0 || this.switchT > 0 || this.useT > 0 || it.mag <= 0) return false;
      this.cook = { t: 0, h: 0, id: it.id, lit: false };
      this.game.emit('nadeprep', this);
      return true;
    }
    if (held) return false;
    const c = this.cook;
    this.cook = null;
    if (c.id !== it.id) return false;
    this.cd = 60 / st.rpm;
    it.mag--;
    this.sprinting = false;
    return this._throw(st, st.cook && c.lit ? st.fuse - c.t : st.fuse, !!this.nadeUnder);
  }

  // R (PUBG): bomba hazırken pimi çek → fünye işlemeye başlar. Dönen true: pişirme başladı
  cookNade() {
    const c = this.cook, st = this.stat;
    if (!c || c.lit || !st.cook || c.id !== this.item.id) return false;
    c.lit = true; c.t = 0;
    if (this.isPlayer) pinSfx(this.game.sfx);
    this.game.emit('pin', this);
    return true;
  }

  // Sağ tık (PUBG): üstten atış ↔ alttan yuvarlama (bomba eldeyken; hazırlanırken de)
  toggleNadeMode() {
    if (this.stat.kind !== 'throwable' || !this.alive) return false;
    this.nadeUnder = !this.nadeUnder;
    this.game.emit('nademode', this);
    return true;
  }

  // Her adım: hazırlama / pişirme süresi; pimi çekili bomba elde dolarsa patlar
  _cookTick(dt) {
    const c = this.cook, st = this.stat;
    if (c.id !== this.item.id || st.kind !== 'throwable') { this.cook = null; return; }
    c.h += dt;
    if (!c.lit) return;
    c.t += dt;
    if (st.cook && c.t >= st.fuse - 1e-9) { this.cook = null; this.cd = 60 / st.rpm; this.item.mag--; this._throw(st, 0, false, true); }
  }

  // Pimi çekili bombayı ayağının dibine bırak (silah değişimi / ölüm): kalan fünyeyle, hızsız düşer
  _dropLit() {
    const c = this.cook, st = c && WSTATS[c.id];
    this.cook = null;
    const it = this.items.find((x) => x.id === c?.id);
    if (!st?.cook || !it || it.mag <= 0) return;
    it.mag--;
    const o = { fuse: Math.max(0.05, st.fuse - c.t) };
    if (this.game.online && this.isPlayer) return;                                 // çevrimiçi istemci: sunucunun 'gr'si getirir
    this.game.spawnGrenade(this, new THREE.Vector3(this.pos.x, this.pos.y + 0.9, this.pos.z), new THREE.Vector3(this.vel.x * 0.3, 0.5, this.vel.z * 0.3), st, null, o);
  }

  // 12.193 Bot pişirmesi: bot bombayı (görselde elinde) cook sn tutar, sonra hedef noktaya kalan fünyeyle yeniden nişan alıp atar.
  // Bu sırada ölürse bomba kalan fünyeyle düşer (insanla aynı kural). b: { gid, cook, t, tp: hedef nokta, under, aim }
  _botCookTick(dt) {
    const b = this.botCook, st = WSTATS[b.gid], it = this.items[2];
    if (!st || !it || it.id !== b.gid || it.mag <= 0 || this.veh || this.swim) { this.botCook = null; this.nadeVis = null; return; }
    b.t += dt;
    this.nadeVis = b.gid;
    if (b.t < b.cook) return;
    this.botCook = null;
    const left = st.fuse - b.t;
    const aim = this.game.botAimNade?.(this, st, b.tp, b.under, left) || b.aim;
    this.yaw = aim.yaw; this.pitch = aim.pitch; this.recoilP = 0;
    this.cd = 0; this.reloadT = 0; this.switchT = 0; this.useT = 0; this.swing = null;      // bomba elindeydi: başka iş yapmıyordu
    this._botNade = { fuse: left, under: !!aim.under };
    const ok = this.useGadget(b.gid);
    this._botNade = null;
    if (!ok) { this.cook = { t: b.t, id: b.gid, lit: true }; this._dropLit(); this.nadeVis = null; }        // atamadı (araç / su): bomba düşer
  }

  // fuse: kalan fünye (pişirilmişse kısa) · under: alttan atış · inHand: elde patladı (göğüs hizasında, hızsız)
  _throw(st, fuse = st.fuse, under = false, inHand = false) {
    const g = this.game, p = new THREE.Vector3(), v = new THREE.Vector3();
    if (this._botNade) { fuse = this._botNade.fuse; under = this._botNade.under; }
    if (inHand) { this.eye(p); p.y -= 0.35; } else throwState(this, st, under, p, v, g.world);
    const o = { fuse, inHand };
    if (g.online && this.isPlayer) { o.pred = true; o.q = g.online.seq; }           // çevrimiçi: kendi bombam gecikmesiz (tahmin), sunucunun 'gr'si eşlenir
    g.spawnGrenade(this, p, v, st, null, o);
    if (!inHand) { g.sfx.shot('throw', this.pos); if (this.isPlayer) g.emit('throw', this); }
    this.throwUnder = under;
    if (this.brain) this.nadeVis = this.items[2]?.id || null;                      // bot: atış savruluşu boyunca elinde bomba görünsün
    if (this.isPlayer || this.human) this.backT = 0.42;                           // attıktan sonra önceki silaha dön (BattleBit gibi); bomba kalsa da
    if (this.item.mag <= 0) this.autoSwitchT = 0.35;     // bitti: birincil silaha dön
    return true;
  }

  // Claymore / cephane kutusu: ayağının önüne kurulur
  _place(st, it) {
    const ok = this.game.placeDeployable?.(this, st);
    if (!ok) { it.mag++; this.cd = 0.3; return false; }
    this.game.sfx.deploy(this.pos);
    if (this.isPlayer) this.game.emit('throw', this);
    if (it.mag <= 0) this.autoSwitchT = 0.4;
    return true;
  }

  // Yakın dövüş: savurma başlar; vuruş animasyonun orta anında (gecikmeli) uygulanır. Kombo: sağ→sol, sol→sağ, saplama
  _melee(st) {
    const idx = this.comboT > 0 ? (this.comboN + 1) % 3 : 0;
    this.comboN = idx;
    const kind = st.swings[idx];
    const dur = kind === 'stab' ? st.stabT : st.swingT;
    if (this.def.zombie && this.cloaked && this.abActive > 0) this.abActive = 0;      // saldırı görünmezliği bitirir
    this.swing = { t: 0, dur, kind, idx, done: false };
    this.comboT = dur + 0.38;
    this.cd = dur * 0.8;                                   // %80'de yeni savurma zincirlenebilir (hızlı çekme)
    this.sprinting = false;
    this.game.sfx.shot('knife', this.pos);
    this.game.emit('melee', this);
    this.game.netEvent({ e: 'swg', by: this.id, k: kind, d: +dur.toFixed(3) });
    this.flashT = 0;
    return true;
  }

  // Savurmanın vuruş anı
  _meleeStrike(sw) {
    const st = this.stat, g = this.game;
    if (st.kind !== 'melee') return;
    const o = this.eye(new THREE.Vector3()), d = this.aimDir(new THREE.Vector3());
    const hit = g.meleeHit(this, o, d, st.reach);
    g.effects.slash(o, d, sw.kind, st.reach, this.team);
    if (hit && hit.victim) {
      const v = hit.victim;
      const zb = this.def.zombie, back = !zb && this.isBehind(v);                       // zombi arkadan tek vuruş yapmaz
      const mul = (sw.kind === 'stab' ? st.stabMul : 1) * (zb ? this.zt.dmg / st.dmg * ((this.boss || (this.abActive > 0 && this.zt.ability.id === 'rage')) ? BOSS.rageDmg : 1) : 1);
      if (!(v.isPlayer && !g.showSelf)) g.effects.blood(hit.point, back ? 14 : 8, d.clone().negate());      // 12.187: birinci şahısta kendi kanın kameraya çizilmez
      g.sfx.knifeHit(hit.point, back);
      v.takeDamage((back ? TUNE.backstab : st.dmg * mul) * this.dmgMul, this, 'body', this.pos, back ? st.name + ' · arkadan' : st.name);
      if (this.isPlayer) { g.effects.shake = Math.max(g.effects.shake, back ? 0.9 : 0.55); g.emit('meleehit', { flesh: true, back }); }
    } else if (hit && hit.wall) {
      g.effects.spark(hit.point, 7, hit.normal, '#ffe9a0', 5);
      g.effects.decal(hit.point, hit.normal);
      g.sfx.knifeWall(hit.point);
      if (this.isPlayer) { g.effects.shake = Math.max(g.effects.shake, 0.3); g.emit('meleehit', { flesh: false }); }
    }
    if (!this.isPlayer) g.alertNear?.(this.pos, this.team, 14);
  }

  // saldıran, kurbanın arkasında mı? (kurbanın baktığı yön ile saldırana olan yön)
  isBehind(v) {
    const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
    let dx = v.pos.x - this.pos.x, dz = v.pos.z - this.pos.z;
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    return fx * dx + fz * dz > 0.55;
  }

  _medkit(it, st) {
    if (it.mag <= 0) return false;
    // yakında canlandırılabilir bir dost cesedi varsa: canlandırma (3 sn)
    const body = this.game.findRevivable(this);
    if (body) {
      this.useT = 2.8; this.useItem = null; this.reviveTarget = body; this.cd = 3.0;
      this.game.sfx.reload(this.pos);
      this.game.emit('reload', this);
      return true;
    }
    if (this.hp >= this.maxHp) return false;
    this.useT = st.useTime; this.useItem = it; this.cd = st.useTime + 0.2;
    this.game.sfx.reload(this.pos);
    this.game.emit('reload', this);
    return true;
  }

  // Botlar: seçili silahı değiştirmeden gadget kullan
  useGadget(id) {
    const it = this.items[2];
    if (!it || it.id !== id || it.mag <= 0 || this.cd > 0 || this.reloadT > 0 || this.useT > 0 || this.switchT > 0) return false;
    const prev = this.cur;
    this.cur = 2;
    const ok = this.tryFire();
    this.cur = prev;
    this.autoSwitchT = 0;
    if (ok && WSTATS[id].kind === 'launcher' && it.mag <= 0 && it.reserve > 0) { it.mag = 1; it.reserve--; this.cd = WSTATS[id].reload + 0.7; }
    return ok;
  }

  // ── duruş değiştirme (ayakta ↔ çömel ↔ yat); yer yoksa reddedilir ──
  toggleCrouch() {
    if (this.swim) return;                                             // 12.180 yüzerken çömel tuşu = dal (basılı); duruş değişmez
    const w = this.game.world;
    if (this.prone) { if (w.canStand(this, H_CROUCH)) { this.prone = false; this.crouching = true; } }
    else if (this.crouching) { if (w.canStand(this, H_STAND)) this.crouching = false; }
    else this.crouching = true;
  }
  toggleProne() {
    if (this.swim) return;
    const w = this.game.world;
    if (!this.prone) { this.prone = true; this.crouching = false; this.sprinting = false; }
    else if (w.canStand(this, H_STAND)) this.prone = false;
    else if (w.canStand(this, H_CROUCH)) { this.prone = false; this.crouching = true; }
  }
  standUp() {
    const w = this.game.world;
    if (this.prone) {
      if (w.canStand(this, H_STAND)) { this.prone = false; return true; }
      if (w.canStand(this, H_CROUCH)) { this.prone = false; this.crouching = true; return true; }
      return false;
    }
    if (this.crouching && w.canStand(this, H_STAND)) { this.crouching = false; return true; }
    return !this.crouching;
  }
  // Belirli bir nişangâhı seç (T tekerleği). Silaha uygun değilse reddedilir. Dönen: nişangâh tanımı ya da null
  setOptic(id) {
    const allowed = OPTIC_ALLOWED[this.item.id] || [];
    if (!allowed.includes(id) || !OPTICS[id]) return null;
    if (this.stat.era) this.optics[this.item.id] = id; else this.optic = id;      // 12.174: dönem silahında silaha özgü (modern genel tercih bozulmaz)
    this.model.optic = id;
    this._syncWeaponModel(true);
    this.game.emit('switch', this);
    return OPTICS[id];
  }

  // Nişangâh değiştir (B): silaha uygun olanlar arasında döner
  cycleOptic() {
    const allowed = OPTIC_ALLOWED[this.item.id] || [];
    const list = allowed.filter((o) => OPTICS[o]);      // izin listesi sırası (modern listeler OPTIC_ORDER sırasında; 12.174 dönem nişangâhları kendi sırasında)
    if (list.length < 2) return null;
    const nx = list[(list.indexOf(this.opticId) + 1) % list.length];
    if (this.stat.era) this.optics[this.item.id] = nx; else this.optic = nx;
    this.adsT = 0;      // 12.154: nişangâh değişince nişana yeniden girilir (eski: yeni nişangâhın büyütmesi tam nişanda o karede devreye giriyordu)
    this.model.optic = nx;
    this._syncWeaponModel(true);
    this.game.emit('switch', this);
    return OPTICS[nx];
  }

  takeDamage(amount, attacker, zone, fromPos, weaponName) {
    if (!this.alive || this.protT > 0) return;
    if (this.isPlayer && this.game.devGod) return;                                  // geliştirici modu: ölümsüzlük (O)
    if (this.def.zombie && this.game.graceLeft > 0) return;                            // hazırlık süresinde zombiler dokunulmaz
    if (this.def.zombie) {
      if (this.boss) amount *= BOSS.armor;                                                              // boss hasarın %30'unu yok sayar
      if (this.abActive > 0) { const a = this.zt.ability.id; if (a === 'shield') amount *= 0.3; else if (a === 'cloak' || a === 'shadow') this.abActive = 0; }
    }   // zırh: hasarın %70'i yok · hayalet vurulunca belirir
    this.game.assists?.hit(this, attacker, amount);                                // 12.165 asist kaydı: kim, kime, ne kadar (kalan canla sınırlı), ne zaman
    this.hp -= amount;
    this.lastHit = attacker;
    this.lastDmgT = this.game.time;
    this.useT = 0;
    if (this.isPlayer) {
      this.game.hud.damageFrom(fromPos, this);
      this.game.sfx.hurt();
    } else if (this.brain) this.brain.onDamaged(attacker, fromPos);
    else if (this.human && fromPos) this.game.netEvent({ e: 'dmg', v: this.id, x: +fromPos.x.toFixed(1), z: +fromPos.z.toFixed(1) });
    const pn = this.game._pen && this.game._pen.by === attacker ? this.game._pen.idx : 0;       // 12.164: delip geçen merminin kaçıncı hedefi (0 = ilk)
    if (attacker && attacker !== this && attacker.isPlayer) this.game.emit('hitmark', { victim: this, zone, dead: this.hp <= 0, dmg: amount, pn });
    else if (attacker && attacker !== this && attacker.human) { const hm = { e: 'hm', by: attacker.id, dead: this.hp <= 0 ? 1 : 0, hd: zone === 'head' ? 1 : 0 }; if (pn) hm.pn = pn; this.game.netEvent(hm); }
    if (this.hp <= 0) this.die(attacker, weaponName, zone === 'head');
  }

  // Flaşbang: kör/sağır
  blind(t) {
    if (!this.alive || t <= 0) return;
    this.blindT = Math.max(this.blindT, t); this.blindMax = Math.max(this.blindT, 0.5);
    if (this.brain) this.brain.onFlashed?.(t);
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); this.game.assists?.healed(this); }      // tam iyileşme asist kaydını sıfırlar (12.165)

  die(killer, weaponName, headshot) {
    if (!this.alive) return;
    if (this.cook?.lit) this._dropLit();                                            // pimi çekili bomba elden düşer (kalan fünyeyle); çekilmemişse düşmez
    this.cook = null;
    if (this.botCook) { this.cook = { t: this.botCook.t, id: this.botCook.gid, lit: true }; this.botCook = null; this._dropLit(); }      // 12.193: pişiren bot da
    this.nadeVis = null;
    if (this.veh) this.game.vehicles?.exit(this);                                  // 12.177: araçta ölen kapıdan düşer (koltuk boşalır, araç sürer)
    this.alive = false; this.hp = 0;
    this.deaths++;
    this.deadT = 0; this.deadDir = Math.random() > 0.5 ? 1 : -1;
    this.ads = false; this.reloadT = 0; this.useT = 0; this.swing = null; this.autoSwitchT = 0;
    this.vel.set(0, 0, 0);
    this.revivable = !/RPG|Bomba|Claymore|M79|üssü|Tank topu/i.test(weaponName || '');
    if (!killer || killer === this) killer = this.game.assists?.creditFor(this) || killer;      // 12.165: düştü / intihar / kendi bombası: son 5 sn'de vuran düşmana öldürme yazılır
    if (killer && killer !== this) { killer.kills++; killer.score += headshot ? 150 : 100; }
    this.game.onKill(killer, this, weaponName, headshot);
    this.game.assists?.onDeath(this, killer);                                       // öldüren dışında katkı verenler asist alır
  }

  // Her kare: zamanlayıcılar
  update(dt) {
    if (!this.alive) { this.deadT += dt; this.adsT = Math.max(0, this.adsT - dt * 9); return; }      // 12.154: ölünce nişan söner (eski: adsT donuyor, ölüm kamerası ×4 dürbün büyütmesinde kalıp doğuşta tek karede açılıyordu)
    this.cd = Math.max(0, this.cd - dt);
    this.abT = Math.max(0, this.abT - dt); this.abActive = Math.max(0, this.abActive - dt);
    this.switchT = Math.max(0, this.switchT - dt);
    this.protT = Math.max(0, this.protT - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.blindT = Math.max(0, this.blindT - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.autoSwitchT > 0 && (this.autoSwitchT -= dt) <= 0 && this.alive && this.cur !== 0 && this.item.mag <= 0 && this.items[0]) this.switchTo(0);
    if (this.cook) this._cookTick(dt);
    if (this.botCook) this._botCookTick(dt);
    if (this.throwT > 0 && (this.throwT -= dt) <= 0) { this.throwT = 0; if (this.brain && !this.botCook) this.nadeVis = null; }
    if (this.backT > 0 && (this.backT -= dt) <= 0 && !this.cook && this.stat.kind === 'throwable') {
      const b = this.backTo >= 0 && this.backTo !== this.cur && this.canEquip(this.backTo) ? this.backTo : this.cur !== 0 && this.canEquip(0) ? 0 : -1;
      if (b >= 0) this.switchTo(b);
    }
    if (this.swing) {
      const sw = this.swing;
      sw.t += dt;
      if (!sw.done && sw.t >= sw.dur * SWING_HIT_K) { sw.done = true; this._meleeStrike(sw); }
      if (sw.t >= sw.dur) this.swing = null;
    }
    this.sinceShot += dt;
    { const st = this.stat; this.bloom = Math.max(0, this.bloom - dt * (st.ball ? (this.sinceShot > 0.12 ? st.bloomRec ?? 0.06 : 0.006) : 0.05)); }      // paintball: seri sürerken açılma neredeyse sönmez, bırakınca toparlanır
    this.recoilP = Math.max(0, this.recoilP - dt * (0.06 + this.recoilP * 4.5));
    if (this.reloadT > 0) {
      const it = this.item, st = this.stat;
      if (this.reloadStyle === 'shell') {
        // mermi mermi: her mermi girdiğinde ses; dolunca biter
        this.shellT -= dt;
        while (this.shellT <= 0 && it.mag < st.mag && it.reserve > 0) {
          it.mag++; it.reserve--; this.shellT += st.shell;
          this.game.sfx.shell(this.pos);
        }
        const left = Math.min(st.mag - it.mag, it.reserve);
        if (left <= 0) { this.reloadT = 0; this.rlDoneT = RL_GAP; this.game.emit('reloaded', this); }
        else this.reloadT = Math.max(0.001, this.shellT + (left - 1) * st.shell);
      } else {
        this.reloadT -= dt;
        if (this.reloadT <= 0) {
          const need = st.mag - it.mag, take = Math.min(need, it.reserve);
          it.mag += take; it.reserve -= take; this.rlDoneT = RL_GAP;
          this.game.emit('reloaded', this);
        }
      }
    }
    this.rlDoneT = Math.max(0, this.rlDoneT - dt);
    this.autoReload();
    if (this.useT > 0) {
      this.useT -= dt;
      if (this.useT <= 0) {
        const it = this.useItem;
        if (this.reviveTarget) {
          const bt = this.reviveTarget; this.reviveTarget = null;
          const mk = this.items[2];
          if (this.game.online) { if (mk && mk.id === 'medkit' && mk.mag > 0) mk.mag--; }
          else if (this.game.canRevive(bt, this)) { if (mk && mk.id === 'medkit' && mk.mag > 0) mk.mag--; this.game.revive(bt, this); }
        } else if (it && it.mag > 0) { it.mag--; this.heal(WSTATS.medkit.heal); if (it.mag <= 0 && this.cur === 2) this.switchTo(0); }
      }
    }
    // hedef nişan geçişi
    const wantAds = this.ads && this.reloadT <= 0 && this.switchT <= 0 && this.zoomNow && !this.sprinting && !this.swim;      // 12.180 yüzerken nişan yok
    this.adsT = clamp(this.adsT + (wantAds ? 1 : -1) * dt * this.adsRate, 0, 1);      // 12.153: adsTime (sn) silaha özgü dürbün süresi (12.174: dönem dürbününün kendi süresi)
    if (this.swim) { this.crouching = false; this.prone = false; }
    if (this.prone) this.crouching = false;
    this.height = this.prone ? H_PRONE : this.crouching ? H_CROUCH : H_STAND;
    this.crouchT = clamp(this.crouchT + (this.crouching ? 1 : -1) * dt * 7, 0, 1);
    this.proneT = clamp(this.proneT + (this.prone ? 1 : -1) * dt * 4.5, 0, 1);
    this.eyeY = lerp(lerp(EYE_STAND, EYE_CROUCH, this.crouchT), EYE_PRONE, this.proneT) * (1 + ((this.hbH || 1) - 1) * 0.6);      // iri zombinin gözü biraz yüksekte
    // yana eğilme (Q/E): kafa yana kayar; duvara girmesin diye 3 ışınla (yan + 40° ön / arka çapraz) sınırlanır. leanK = gerçekleşen eğilme
    // (−1..1; duvar varsa kısalır) → kamera yatıklığı ve 3. şahıs gövde animasyonu da onu izler. Sunucu, çevrimdışı ve istemci aynı kod (vuruş kutusu leanOff'la kayar)
    const canLean = this.onGround && !this.sprinting && this.proneT < 0.3;
    this.leanT = lerp(this.leanT, canLean ? this.leanDir : 0, Math.min(1, dt * 10));
    if (Math.abs(this.leanT) > 0.01) {
      const sg = Math.sign(this.leanT), ay = Math.abs(this.leanT);
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw), fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);      // right() / ileri (yatay)
      const from = _o.set(this.pos.x, this.pos.y + this.eyeY - ay * LEAN_DROP, this.pos.z);
      let room = LEAN_OFF;
      for (const [c, sn] of LEAN_RAYS) {
        _v.set((rx * c + fx * sn) * sg, 0, (rz * c + fz * sn) * sg);
        const L = (LEAN_OFF + LEAN_PAD) / c, hit = this.game.world.raycast(from, _v, L, (this._lr ||= {}));
        if (hit) room = Math.min(room, hit.t * c - LEAN_PAD);
      }
      room = Math.max(0, room);
      this._leanRoom = room < this._leanRoom ? room : Math.min(room, this._leanRoom + dt * 2.5);      // duvara yaklaşınca anında kısalır, açılınca yumuşak uzar (köşe geçişinde sıçrama yok)
      const off = Math.min(ay * LEAN_OFF, this._leanRoom);
      this.leanK = sg * off / LEAN_OFF;
      this.leanOff.set(rx * sg * off, -ay * LEAN_DROP, rz * sg * off);
    } else { this.leanOff.set(0, 0, 0); this.leanK = 0; this._leanRoom = LEAN_OFF; }
  }

  // Doğma koruması kalkanı: mavi, nabız gibi atan yarı saydam balon (düşman da görür; "mermi geçiyor" yanılgısını önler)
  _shield(on) {
    let sh = this._shieldMesh;
    if (!on) { if (sh) sh.visible = false; return; }
    if (!sh) {
      sh = this._shieldMesh = new THREE.Mesh(SHIELD_GEO, new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
      sh.position.y = 0.9; sh.renderOrder = 5; sh.frustumCulled = false;
      this.model.root.add(sh);
    }
    sh.visible = !(this.isPlayer && !this.game.showSelf);                          // 1. şahıs: kendi balonun görüşü kapatmasın
    const k = 1 + Math.sin(this.game.time * 9) * 0.04;
    sh.scale.set(k, 1.12 * k, k);
    sh.material.opacity = 0.16 + 0.1 * (0.5 + 0.5 * Math.sin(this.game.time * 7));
  }

  // Zombi duruşu (yalnız görsel; vuruş kutusu / hareket aynı): öne kambur gövde + yukarı bakan av kafası, türe göre sendeleme / topallama /
  // ağır basış / süzülme, ara ara kafa seğirmesi. Asker animasyonunun üstüne eklenir.
  _zombiePose(m, p, root, T, ph, moveAmt, run) {
    const zs = m.zshape, zt = m.ztype, id = this.id;
    const hunch = zs.hunch * (1 + 0.3 * run);
    p.torso.rotation.x -= hunch;
    p.torso.position.y -= hunch * 0.1;
    p.torso.position.z = -hunch * 0.12;
    p.head.rotation.x += hunch * 0.8 + 0.06 * Math.sin(T * 1.1 + id);
    const lurch = zt === 'runner' ? 0.05 : zt === 'brute' ? 0.15 : zt === 'ghost' ? 0.035 : 0.11;
    p.torso.rotation.z += Math.sin(ph) * lurch * moveAmt + Math.sin(T * 0.7 + id) * 0.05 * (1 - moveAmt);       // yana sendeleme / dururken salınma
    p.torso.rotation.y += Math.sin(ph + 0.6) * lurch * 0.7 * moveAmt;
    const tw = (rate) => {                                                     // seğirme: rastgele aralıklarla kısa, sert kafa / omuz sarsıntısı
      const k = T * rate + id * 7.31, i = Math.floor(k), f = k - i, h = Math.sin(i * 91.7 + id * 13.1) * 43758.5;
      return (h - Math.floor(h)) > 0.72 && f < 0.16 ? Math.sin((f / 0.16) * Math.PI) * ((h * 7 - Math.floor(h * 7)) - 0.5) * 2 : 0;
    };
    const t1 = tw(zt === 'blinker' ? 2.6 : 1.3), t2 = tw(zt === 'blinker' ? 3.1 : 0.9);
    p.head.rotation.z += t1 * 0.5; p.head.rotation.y += t2 * 0.35; p.torso.rotation.z += t2 * 0.06;
    const L = p.legs.L, R = p.legs.R;
    if (zt === 'walker' || zt === 'boss') {                                    // topallama: sağ bacak sürünür (kısa adım, az diz bükümü)
      R.hip.rotation.x *= 0.6; R.knee.rotation.x *= 0.55; if (R.foot) R.foot.rotation.x *= 0.5;
      root.position.y -= 0.04 * moveAmt * Math.max(0, Math.sin(ph + Math.PI));
    } else if (zt === 'brute') root.position.y -= 0.06 * moveAmt * Math.sin(ph) ** 4;       // ağır basış
    else if (zt === 'ghost') { root.position.y += 0.05 + Math.sin(T * 1.4 + id) * 0.03; L.hip.rotation.x *= 0.5; R.hip.rotation.x *= 0.5; L.knee.rotation.x = L.knee.rotation.x * 0.5 - 0.35; R.knee.rotation.x = R.knee.rotation.x * 0.5 - 0.3; }   // süzülme: ayaklar sarkık
    else if (zt === 'runner') p.torso.rotation.x -= 0.15 * run;              // koşucu: çok alçak, öne atılmış
  }

  // Üçüncü şahıs model senkronu (oyuncu hariç): hıza bağlı adım döngüsü, gövde eğimi, kol sallanması
  // 12.177 araçta oturuş (yalnız görsel): kalça / bacaklar aracın yönünde (eğim + yatış dahil), gövde bakışa döner (±1,3 rad), kollar silahta ya da direksiyonda
  _seatPose(m, p, root, vh, mg = false) {
    const angDiff = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    // 12.192 _seatRel: gövdenin araca göre yaw'ı (vehicleView her karede kökü aracın ÇİZİLEN gövdesine bu açıyla oturtur). Kule nişancısı kapakta
    // bakışla döner; helikopter kapı nişancısı kapıya dönük oturur (bacaklar kapıda), gövdesi / kolları makineliyle yay içinde burulur
    const door = mg && this.veh.def.heli ? -this.veh.def.mg.arc[this.seat] * Math.PI / 2 : null;
    this._seatRel = door != null ? door : mg ? angDiff(this.yaw, vh.yaw) : 0;
    root.rotation.order = 'YXZ';
    root.rotation.set(vh.pitch, vh.yaw + this._seatRel, vh.roll);
    root.position.y = this.pos.y + (m.groundOffset ?? 0) - 0.28;
    this.bodyYaw = vh.yaw + this._seatRel;
    this._seatTwist = door != null ? clamp(angDiff(this.yaw, vh.yaw + door), -1.3, 1.3) : mg ? 0 : this.seat === 0 ? clamp(angDiff(this.yaw, vh.yaw), -0.5, 0.5) * 0.4 : clamp(angDiff(this.yaw, vh.yaw), -1.3, 1.3);
    for (const lg of [p.legs.L, p.legs.R]) {
      lg.hip.rotation.x = 1.42; lg.knee.rotation.x = -1.32; lg.hip.rotation.z = (lg === p.legs.R ? 1 : -1) * 0.06;
      if (lg.foot) lg.foot.rotation.x = -0.1;
      lg.hip.position.y = 0.88; lg.hip.position.x = (lg === p.legs.R ? 1 : -1) * 0.12;
    }
    p.torso.rotation.x = clamp(this.pitch + this.recoilP, -0.9, 0.9) * 0.5 - 0.05; p.torso.rotation.z = 0; p.torso.position.x = 0; p.torso.position.y = 1.17;
    p.head.rotation.x = -clamp(this.pitch, -0.9, 0.9) * 0.3; p.head.rotation.z = 0;
  }

  // 12.180 su görsel / ses: suya düşüş / atlayış sıçraması, yüzerken yüzey dalgacıkları (başkaları), yüzeye çıkış nefesi (oyuncu)
  _waterFx(dt) {
    const g = this.game, wy = waterYAt(g.world?.terrain, this.pos.x, this.pos.z);
    if (!(wy > -1e9) || !this.alive) { this._inW = false; return; }
    const d = wy - this.pos.y, inW = d > 0.35, hv = Math.hypot(this.vel.x, this.vel.z);
    if (inW && !this._inW && (this.vel.y < -2.5 || hv > 2.5)) { const p = _v.set(this.pos.x, wy + 0.02, this.pos.z); g.effects.splash(p, true); g.sfx.splash?.(p.clone(), true); }
    this._inW = inW;
    if (inW && d < SWIM.float + 0.6 && hv > 0.7 && !(this.isPlayer && !g.showSelf) && (this._ripT = (this._ripT || 0) - dt) <= 0) {
      this._ripT = 0.4; g.effects.splash(_v.set(this.pos.x - Math.sin(this.yaw) * 0.5, wy + 0.02, this.pos.z - Math.cos(this.yaw) * 0.5), false, true);
    }
    if (this.isPlayer) { if (this._uw && !this.under && (this.air ?? SWIM.breath) < SWIM.breath * 0.55) g.sfx.gasp?.(); this._uw = !!this.under; }
  }

  syncModel(dt) {
    if (this.game.headless) return;                                                     // görsel animasyon: sunucuda gerekmez
    this._waterFx(dt);
    const m = this.model, root = m.root, p = m.parts;
    if (this.isPlayer && !this.game.showSelf) { root.visible = false; return; }      // 1. şahıs: kendi gövdeni görmezsin
    if (this.isPlayer) this._syncWeaponModel();                                         // 3. şahıs: elindeki silah modeli güncel olsun
    root.visible = this.alive || this.deadT < 5;
    this._shield(this.protected);
    if (this.game.mode?.space) spaceTp(this, dt);                                      // 12.160: ray tüfeği şarj ışıması 3. şahısta
    if (this.cloaked && this.alive && !this.isPlayer && this.pos.distanceTo(this.game.camera.position) > 3) root.visible = false;   // görünmez zombi: yalnızca 3 m içinde seçilir
    root.position.set(this.pos.x, this.pos.y + (m.groundOffset ?? m.root.position.y), this.pos.z);
    // Bacaklar (root) bakış yönüne gecikmeli döner; gövde (silah) hep bakış yönünde kalır: yerinde dönerken ayaklar takip eder, koşarken hızla hizalanır
    const angDiff = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (this.bodyYaw === undefined || !this.alive || this.proneT > 0.2) this.bodyYaw = this.yaw;
    const spd0 = Math.hypot(this.vel.x, this.vel.z), maxTw = spd0 > 0.6 ? 0.35 : 0.85;
    let dY = angDiff(this.yaw, this.bodyYaw);
    if (Math.abs(dY) > maxTw) { this.bodyYaw += dY - Math.sign(dY) * maxTw; dY = Math.sign(dY) * maxTw; }
    this.bodyYaw += dY * Math.min(1, dt * (spd0 > 0.6 ? 8 : 2.2));
    const twistY = angDiff(this.yaw, this.bodyYaw);
    root.rotation.y = this.bodyYaw;
    if (!this.alive) {
      const k = Math.min(1, this.deadT * 3.2);
      root.rotation.x = this.deadDir * k * (Math.PI / 2) * 0.96;
      root.position.y += k * 0.14;
      return;
    }
    const pr = this.proneT;
    root.rotation.x = -(Math.PI / 2) * pr;
    if (pr > 0.001) {
      const fx0 = -Math.sin(this.yaw), fz0 = -Math.cos(this.yaw);
      root.position.x -= fx0 * 0.82 * pr; root.position.z -= fz0 * 0.82 * pr; root.position.y += 0.17 * pr;
    }
    // 12.180 yüzme pozu: konumdan (uzak oyuncu da: ek ağ alanı yok). Gövde göğüs çevresinde öne yatar (yüzerken ~70°, suda dururken ~17°), baş suyun üstünde,
    // bacaklar çırpar, silah aşağıda (koşu tutuşu). Su altında bakış yönüne göre başaşağı / yukarı eğilir.
    const wy = waterYAt(this.game.world?.terrain, this.pos.x, this.pos.z), swimNow = wy - this.pos.y > SWIM.enter - 0.05 && !this.fly;
    this.swimT = lerp(this.swimT || 0, swimNow ? 1 : 0, Math.min(1, dt * 6));
    const swK = this.swimT;
    if (swK > 0.01) {
      const hv = Math.hypot(this.vel.x, this.vel.z), mv = clamp(hv / 1.6, 0, 1), deep = clamp((wy - this.pos.y - SWIM.float - 0.3) / 0.8, 0, 1);
      const a = (lerp(0.3, 1.05, mv) + clamp(-this.pitch, -0.6, 0.9) * 0.55 * deep * mv) * swK, piv = 1.25;
      const fx0 = -Math.sin(this.bodyYaw), fz0 = -Math.cos(this.bodyYaw);
      root.rotation.x -= a;
      root.position.y += piv * (1 - Math.cos(a)) + (0.16 * mv + Math.sin(this.game.time * 2.1 + this.id) * 0.03) * swK * (1 - deep);      // yüzeyde baş / omuz suyun üstünde
      root.position.x -= fx0 * piv * Math.sin(a); root.position.z -= fz0 * piv * Math.sin(a);
    }
    const T = this.game.time;
    const vx = this.vel.x, vz = this.vel.z, spd = Math.hypot(vx, vz);
    const fwdV = vx * -Math.sin(this.bodyYaw) + vz * -Math.cos(this.bodyYaw);
    const sideV = vx * Math.cos(this.bodyYaw) + vz * -Math.sin(this.bodyYaw);
    const c = this.crouchT;
    // 12.192 geliştirici uçuşu (L): eskiden havadaki asker gibi donmuş "koşarak zıplama" pozu (bir diz karında) → süzülme: bacaklar hafif bükük sarkık,
    // adım döngüsü yok, ileri uçuşta gövde uçuş yönüne hafif yatar
    const fly = !!this.fly;
    this.airT = lerp(this.airT || 0, fly ? 0.3 : this.onGround ? 0 : 1, Math.min(1, dt * 10));
    this.sprintT = lerp(this.sprintT || 0, this.sprinting && fwdV > 2 ? 1 : 0, Math.min(1, dt * 8));
    const moveAmt = fly ? 0 : clamp(spd / 1.3, 0, 1) * (1 - this.airT);
    this.flyLean = lerp(this.flyLean || 0, fly ? clamp(fwdV / 13, -0.3, 1) * 0.35 : 0, Math.min(1, dt * 5));
    if (this.flyLean) root.rotation.x -= this.flyLean;
    const run = clamp((spd - 3.4) / 3.0, 0, 1);
    const sideBlend = spd > 0.3 ? Math.abs(sideV) / (Math.abs(fwdV) + Math.abs(sideV) + 1e-4) : 0;
    const dir = fwdV < -0.4 && Math.abs(fwdV) > Math.abs(sideV) ? -1 : 1;
    const stride = lerp(1.55, 2.3, run) * (1 - 0.15 * c);                 // bir tam adım döngüsü (m)
    this.walkPhase += dir * (spd / stride) * Math.PI * 2 * dt * (fly ? 0 : this.onGround ? 1 : 0.2);
    const ph = this.walkPhase;
    const amp = lerp(0.46, 0.86, run) * (1 - 0.5 * c) * (1 - 0.55 * sideBlend) * (dir < 0 ? 0.75 : 1);
    const flexMax = lerp(0.55, 1.4, run) * (1 - 0.4 * c);
    const sideSign = Math.sign(sideV) || 0;

    // hazır duruş ağırlığı: yerinde dururken (stanceK=1) bükük diz + açık ayak + alçak pelvis; hareket/çömelme/yatma/havada kalkar
    const stanceK = (1 - moveAmt) * (1 - pr) * (1 - c) * (1 - this.airT);
    this.stanceT += ((this.stanceLeft ? -1 : 1) - this.stanceT) * Math.min(1, dt * 9);
    const mt = (1 - this.stanceT) / 2;                  // 0: sol ayak önde (sağ omuz), 1: sağ ayak önde (sol omuz)
    const mixv = (a, b) => a + (b - a) * mt;
    const idleLow = 0.045 * stanceK;
    const legs = [[p.legs.L, ph, mixv(0.50, 0.05), mixv(-0.90, -0.75), 0.9, -1.6, 0.65, -1.0], [p.legs.R, ph + Math.PI, mixv(0.05, 0.50), mixv(-0.75, -0.90), 0.7, -1.5, -0.15, -0.5]];
    for (const [lg, phi, idleHip, idleKnee, crHip, crKnee, airHip, airKnee] of legs) {
      const sw = Math.sin(phi) * amp;
      const flex = Math.max(0, Math.cos(phi)) * flexMax;
      let hip = lerp(idleHip, 0.05 + sw, moveAmt);
      let knee = lerp(idleKnee, -(0.14 + flex), moveAmt);
      hip = lerp(hip, crHip + sw * 0.6 * moveAmt, c);
      knee = lerp(knee, crKnee - flex * 0.4 * moveAmt, c);
      hip = lerp(hip, airHip, this.airT);
      knee = lerp(knee, airKnee, this.airT);
      const crawlAmt = clamp(spd / 0.8, 0, 1);
      hip = lerp(hip, Math.sin(phi) * 0.2 * crawlAmt, pr);
      knee = lerp(knee, -Math.max(0, Math.cos(phi)) * 0.35 * crawlAmt, pr);
      lg.hip.rotation.x = hip;
      lg.knee.rotation.x = knee;
      if (lg.foot) lg.foot.rotation.x = -(hip + knee) * (1 - 0.4 * moveAmt) * (1 - pr);    // ayak yere paralel (duruşta tam, yürürken kısmen: topuk/burun kalkar)
      const sg = lg === p.legs.R ? 1 : -1;
      lg.hip.rotation.z = sideSign * 0.3 * Math.sin(phi) * sideBlend * moveAmt + sg * 0.05 * stanceK;   // yan adımda bacak açılması + duruşta hafif dışa açık
      lg.hip.position.y = 0.88 - 0.27 * c - idleLow;
      lg.hip.position.x = sg * (0.105 + 0.04 * stanceK);
      if (fly) { const L = lg === p.legs.L; lg.hip.rotation.x = L ? 0.22 : 0.06; lg.knee.rotation.x = L ? -0.42 : -0.26; lg.hip.rotation.z = sg * 0.05; lg.hip.position.y = 0.88; if (lg.foot) lg.foot.rotation.x = 0.35; }      // 12.192 süzülme: sarkık bacaklar
    }

    // gövde: öne eğim, hafif burulma, ağırlık aktarımı, nefes
    const breathe = Math.sin(T * 1.7 + this.id) * 0.004 * (1 - moveAmt);
    const lean = -(0.03 * moveAmt + 0.17 * run * moveAmt) - 0.09 * c - 0.07 * stanceK;
    const aimP = clamp(this.pitch + this.recoilP, -0.9, 0.9) * 0.7;
    p.torso.rotation.x = (aimP + lean) * (1 - pr);
    p.torso.rotation.z = Math.sin(ph) * 0.035 * moveAmt * (1 + run) * (1 - pr) - this.leanK * LEAN_TORSO + Math.sin(T * 0.9 + this.id) * 0.012 * stanceK;
    p.torso.position.x = this.leanK * LEAN_SHIFT;      // 12.166: gerçekleşen eğilme (leanK) → model kafası vuruş kutusu / göz kaymasıyla aynı yerde
    p.torso.position.y = 1.17 - 0.27 * c + breathe - idleLow;
    p.head.rotation.x = (-lean * 0.7 - aimP * 0.25) * (1 - pr);
    if (swK > 0.01) {                                                                  // yüzme: bacak çırpma + gövde düz, baş kalkık (yüzü öne)
      for (const [lg, ph0] of [[p.legs.L, 0], [p.legs.R, Math.PI]]) {
        const k = Math.sin(T * 8.5 + ph0 + this.id) ;
        lg.hip.rotation.x = lerp(lg.hip.rotation.x, 0.08 + k * 0.32, swK);
        lg.knee.rotation.x = lerp(lg.knee.rotation.x, -0.25 - Math.max(0, k) * 0.35, swK);
        if (lg.foot) lg.foot.rotation.x = lerp(lg.foot.rotation.x, 0.6, swK);
      }
      p.torso.rotation.x = lerp(p.torso.rotation.x, 0, swK);
      p.head.rotation.x = lerp(p.head.rotation.x, -0.55 * clamp(Math.hypot(this.vel.x, this.vel.z) / 1.6, 0, 1), swK);
    }
    p.head.rotation.z = this.leanK * 0.2;
    root.position.y -= (0.018 + 0.035 * run) * moveAmt * Math.sin(ph) ** 2;    // adım sırasında hafif çökme
    const twist = Math.sin(ph) * (0.05 + 0.08 * run) * moveAmt;
    const swing = Math.sin(ph + Math.PI) * moveAmt * (0.5 + 0.5 * run);
    let reload = null, melee = null;
    if (this.reloadT > 0 && this.stat.kind !== 'medkit') {
      const st = this.stat, shell = this.reloadStyle === 'shell';
      const el = this.reloadTotal - this.reloadT;
      reload = { style: this.reloadStyle, k: clamp(el / this.reloadTotal, 0, 1), empty: this.reloadEmpty, ph: shell ? ((el / st.shell) % 1 + 1) % 1 : 0 };
    }
    if (this.swing) melee = { kind: this.swing.kind, k: clamp(this.swing.t / this.swing.dur, 0, 1) };
    const vh = this.veh && this.veh.st;
    if (vh) { const mg = !!mgAt(this.veh.def, this.seat); this._seatPose(m, p, root, vh, mg); m.refreshHold({ twist: this._seatTwist, side: 1, aimP: clamp(this.pitch + this.recoilP, -0.8, 0.8), reload, melee, drive: this.seat === 0 || mg, wheelA: mg ? 0 : -vh.steer * 2.2 }); if (this.veh.def.hidden?.[this.seat]) root.visible = false; return; }      // 12.178: tank sürücüsü gövdede görünmez, nişancı makineliyi tutar
    if (root.rotation.order !== 'XYZ') root.rotation.order = 'XYZ';
    // 12.193 bomba pozu: hazırlarken kol geri-yukarı (üstten) ya da aşağı-geri (alttan) kurulur, atışta ileri savrulur
    if (!this.isPlayer) { const nv = this._nadeVisId() || null; if (nv !== this._nvPrev) { this._nvPrev = nv; this._syncWeaponModel(); } }
    const net = this.isPlayer ? 0 : this.nadeNet | 0;
    const litNow = !this.isPlayer && !!(net & 2 || this.botCook || this.cook?.lit);       // başkası pimi çekti: yakındaysan duyarsın (PUBG'de de pim sesi duyulur)
    if (litNow && !this._netLit && this.pos.distanceTo(this.game.camera.position) < 14) pinSfx(this.game.sfx, this.pos);
    this._netLit = litNow;
    const prepOn = !!(this.cook || this.botCook || net & 1 || net & 2) && !this.veh;
    this.nadePrepK = lerp(this.nadePrepK || 0, prepOn ? 1 : 0, Math.min(1, dt * 12));
    const nUnder = !!(this.nadeUnder || net & 4 || (this.throwT > 0 && this.throwUnder) || this.botCook?.under);
    const nade = this.nadePrepK > 0.01 || this.throwT > 0 ? { prep: this.nadePrepK, swing: this.throwT > 0 ? 1 - this.throwT / 0.45 : 0, under: nUnder } : null;
    m.refreshHold({ sprint: Math.max(this.sprintT, swK) * (1 - pr), kick: clamp(this.flashT / 0.06, 0, 1), twist: (twist + twistY) * (1 - pr), swing, side: this.stanceT, prone: pr, aimP: clamp(this.pitch + this.recoilP, -0.8, 0.8), reload, melee, nade });
    if (m.zshape && pr < 0.5) this._zombiePose(m, p, root, T, ph, moveAmt, run);
  }
}
