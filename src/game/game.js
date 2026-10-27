import { MapBuilder } from '../maps/builder.js';
import { SightMap } from './sight.js';
import { MapEditor, loadEdits } from './mapEditor.js';
import * as THREE from 'three';
import { warmup } from './warmup.js';
import { RemoteTorches } from './remoteTorch.js';
import { setupEnvironment } from '../maps/environment.js';
import { MAPS, DEFAULT_MAP } from '../maps/index.js';
import { World } from './collision.js';
import { Binds } from '../core/keybinds.js';
import { music } from './music.js';
import { KillFx } from './killfx.js';
import { Assists, assistPop } from './assist.js';
import { AbilityFx } from './abilityfx.js';
import { NavGrid } from './nav.js';
import { NavGridML } from './navml.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { Hud } from './hud.js';
import { Chat } from './chat.js';
import { Soldier } from './soldier.js';
import { Player } from './player.js';
import { isTouch } from './touch.js';
import { BotBrain } from './bot.js';
import { CLASS_DEFS, WSTATS, OPTICS, OPTIC_ALLOWED, BOT_NAMES, cleanEraOptics, makeLoadout, modeLoadout, BLEED_S, ZOMBIE, BOSS, ZTYPES, ZT_ORDER, randomZType, GG_LADDER } from './stats.js';
import { makeMatch, PRESETS, ffaRanking, ffaMetric } from './match.js';
import { TUNE } from './balance.js';
import { Weather } from './weather.js';
import { Post } from './post.js';
import { rand, pick, clamp } from './util.js';
import { TEAMS } from '../core/palette.js';
import { nullSink } from '../sim/nullSink.js';
import { applyInput } from '../sim/input.js';
import { fallDamage, fallApplies, FALL } from '../sim/fall.js';
import { breathTick, waterYAt } from '../sim/swim.js';
import { Underwater } from './underwater.js';
const WATER_STOP = 1.5;                  // 12.180: mermi su yüzeyinden sonra en çok bu kadar (m) ilerler
import { SIM_DT } from '../net/protocol.js';
import { mat } from '../core/geo.js';
import { t } from '../i18n/index.js';
import { Paint, paintColorOf } from './paint.js';
import { Pickups } from './pickups.js';
import { EndFlow } from './endFlow.js';
import { t as $t } from '../i18n/index.js';
import { placeName, banText } from '../i18n/game.js';                                                         // oyun içi sözlük (hud. / death. / end. …)
import { Payload } from './payload.js';
import { ObjFx } from './objFx.js';                                  // 12.191 bayrak direği + zemin halkası (yalnız istemci)
import { Front } from './front.js';                                  // Cephe modu (12.158)
import { Vehicles } from './vehicles.js';                            // 12.177 araçlar (Kuzey Vadisi: jip)
import { assignSquadsBig, perchBig, spawnFlagBig } from './bigBots.js';           // 12.189 büyük harita bot çatışma akışı
import { vnav } from './vehicleBots.js';                                         // 12.189 bot sürücüler (araç ızgarası)
import { VehicleView } from './vehicleView.js';
import { VehicleHud } from './vehicleHud.js';
import { VT, mgAt, seatGun, heFalloff } from '../sim/vehicle.js';
import { spaceSetup } from './space.js';
import { NADE, nadeTick, NadeView, fragBlast, bounceSfx, aimNade } from './grenade.js';
import { createWeapon } from '../models/weapons.js';
import { initGadgets, updateGadgets, spawnSmoke, flashBang, smokeBlocks, smokeDensity, placeDeployable, netDeploy, netUndeploy } from './gadgets.js';

const STAT_ID = new Map(Object.entries(WSTATS).map(([k, v]) => [v, k]));      // WSTATS nesnesi → id (ağ olayları için)
const r2 = (v) => Math.round(v * 100) / 100;
const v3 = (p) => [r2(p.x), r2(p.y), r2(p.z)];

const UP = new THREE.Vector3(0, 1, 0);
// 12.146: mermi ışınının en kısa erimi. Eskiden range[1] × 2,2 idi: tabanca 121 m, MAC-10 99 m, pompalı 70 m, MP5 154 m'den ötede ışın
// hiçbir şeye değmiyordu (hasar yok, duvarda toz yok, iz duvarın içinden 120 m'ye uzanıyordu). Hasar düşüşü (range / minMul) aynı kalır;
// yalnız ışın her silahta en az oynanan alanın köşegeni kadar gider (en büyüğü Vadi ≈ 216 m; ışın maliyeti boyla arttığı için 300).
const SHOT_REACH = 300;

function rayBox(o, d, min, max, maxT) {
  let t0 = 0, t1 = maxT;
  const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
  for (let a = 0; a < 3; a++) {
    const inv = 1 / (dd[a] || 1e-9);
    let ta = (min[a] - oo[a]) * inv, tb = (max[a] - oo[a]) * inv;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return -1;
  }
  return t0;
}
// 12.164: ışının kutudan çıktığı t (yoksa -1) · ince levha: en ince boyutu ≤ TUNE.penThick, araç / vagon değil (TUNE.penWalls açıkken)
function rayBoxExit(o, d, min, max) {
  let t0 = 0, t1 = Infinity;
  const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
  for (let a = 0; a < 3; a++) {
    const inv = 1 / (dd[a] || 1e-9);
    let ta = (min[a] - oo[a]) * inv, tb = (max[a] - oo[a]) * inv;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return -1;
  }
  return t1;
}
function thinCollider(c) {
  if (!c || c.tag === 'veh' || c.tag === 'cart') return false;
  return Math.min(c.max[0] - c.min[0], c.max[1] - c.min[1], c.max[2] - c.min[2]) <= TUNE.penThick;
}

// 12.174: istemciden gelen Cephe donanımı (yalnız dize alanlar; frontLoadout listede olmayanı varsayılana düşürür) ve nişangâh tercihleri
// (op: modern genel tercih, bilinen nişangâh; fo: silah → o silaha izinli nişangâh, cleanEraOptics; 12.190: modern silahlar da)
const cleanFront = (f) => { if (!f || typeof f !== 'object') return undefined; const str = (v) => (typeof v === 'string' ? v.slice(0, 24) : undefined); return { primary: str(f.primary), secondary: str(f.secondary), gadget: str(f.gadget), melee: str(f.melee) }; };
export function applyOpticPrefs(s, m) {
  if (!m || typeof m !== 'object') return;
  if (typeof m.op === 'string' && OPTICS[m.op] && !OPTICS[m.op].era) s.optic = m.op;
  if (m.fo && typeof m.fo === 'object') s.optics = { ...s.optics, ...cleanEraOptics(m.fo) };
}
export { cleanFront };

export class Game {
  constructor(container, opts) {
    this.opts = opts;
    this.container = container;
    // headless: sunucu/test modu — renderer, HUD, ses, hava, Player ve DOM olayları kurulmaz (bkz. src/sim/nullSink.js)
    const headless = (this.headless = !!opts.headless);
    this.binds = new Binds(opts.keys);                  // tuş atamaları (menüde Kontroller'den değiştirilir)
    this.leftHand = !!opts.leftHand;                    // silahı sol elle tut (yalnızca birinci şahıs görünümü)
    this.settings = opts.settings || { fov: 80, volume: 0, shadows: false, pixelRatio: 1, sens: 1 };
    this.listeners = new Map();
    this.time = 0; this.running = false; this.ended = false; this.simulate = true;
    this.soldiers = []; this.brains = []; this.projectiles = [];
    this.tick = 0; this.netEvents = []; this.pidN = 0;
    this.assists = new Assists(this);                    // 12.165: asist kaydı (yetkili tarafta sayar; çevrim içi istemcide kapalı)
    this.humans = new Map();      // sunucu: savaşçı id → { s, queue, last, stale, ack, tickAck }
    this.classDefs = CLASS_DEFS;
    this.pendingClass = null;
    this.pathBudget = 3;
    this.medicT = 0; this.resupplyT = 0; this.bleedT = TUNE.bleed; this.capT = 0;

    // ── renderer ──
    let r = null;
    this.scene = new THREE.Scene();
    if (!headless) {
      r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      r.setPixelRatio(this.fitRatio(Math.min(devicePixelRatio, this.settings.pixelRatio || 1.5)));
      r.setSize(innerWidth, innerHeight, false);   // CSS boyutunu biz belirleriz (yüksek DPI'da tuval taşmasın)
      r.autoClear = false;
      r.shadowMap.enabled = this.settings.shadows !== false;
      r.shadowMap.type = THREE.PCFShadowMap;                                          // r18x: PCF = Vogel diski; shadow.radius ile yumuşar (bkz. applyGfx)
      r.toneMapping = THREE.NeutralToneMapping;
      r.outputColorSpace = THREE.SRGBColorSpace;
      this.canvas = r.domElement;
      this.canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;display:block;cursor:none;user-select:none;-webkit-user-select:none;touch-action:none;';
      container.appendChild(this.canvas);
    }

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, headless ? 1 : innerWidth / innerHeight, 0.05, 700);
    this.scene.add(this.camera);
    // fener (F): gece / gün batımında
    this.torch = new THREE.SpotLight('#fff3d6', 0, 70, 0.52, 0.65, 1.1);
    this.torch.position.set(0.12, -0.08, 0);
    this.torch.target.position.set(0, 0, -6);
    this.camera.add(this.torch, this.torch.target);
    this.torchOn = false;


    // ── harita ──
    this.mapDef = MAPS[opts.map] || MAPS[DEFAULT_MAP];
    if (headless) {
      // başsız (sunucu/test): harita bir kez kurulur, odalar arasında paylaşılır (bellek). DM modu spawns/baseZones'u değiştirdiği için yüzeysel kopya alınır; görsel grup gerekmez.
      const cache = (Game._mapCache ||= new Map());
      let c = cache.get(opts.map);
      if (!c) { c = this.mapDef.build(); cache.set(opts.map, c); }
      this.map = { ...c, spawns: { ...c.spawns }, group: new THREE.Group() };
    } else {
      if (opts.editor && !opts.online) MapBuilder.pendingEdits = loadEdits(this.mapDef.id);          // yalnız Harita Editörü bölümünde: bu tarayıcıdaki yerel düzenlemeler (oyunda harita hep orijinal)
      try { this.map = this.mapDef.build(); } finally { MapBuilder.pendingEdits = null; }
    }
    // Taraf değişimi (asimetrik haritalar): sideSwap haritalarda her maç mavi/kırmızı doğuş tarafları rastgele yer değiştirir; sunucu seçer, istemciler cfg.swap ile aynısını uygular
    this.swapSides = !!this.map.sideSwap && !!(opts.swapSides ?? opts.online?.cfg?.swap ?? (!headless && !opts.online && Math.random() < 0.5));
    if (this.swapSides) {
      const sp = this.map.spawns, bz = this.map.baseZones;
      this.map.spawns = { ...sp, blue: sp.red, red: sp.blue };
      if (bz) this.map.baseZones = { blue: bz.red, red: bz.blue };
    }
    this.tod = this.map.forceTod || opts.tod || 'day';
    if (headless) {
      this.night = this.tod === 'night';
      this.sun = null;
      this.scene.add(this.map.group);
    } else {
      const env = setupEnvironment(this.scene, r, { shadowSize: 55, sunPos: this.map.env?.sunPos || [55, 85, 40], env: this.map.env, tod: this.tod });
      const sp = env.sunPos;
      this.sun = env.sun;
      this.night = env.night;
      this.env = env;
      r.toneMappingExposure = env.grade.exposure;                                   // günün saatine göre pozlama (her kalitede)
      this.applyGfx();                                                              // kalite kademesi: gölge haritası / yumuşaklık / kapsama + son işleme
      this.sunOff = new THREE.Vector3(...sp);
      this.scene.add(this.map.group);
      env.applyGlow(this.map.group);
    }
    if (this.map.view) { this.camera.far = this.map.view.far ?? this.camera.far; this.camera.near = this.map.view.near ?? this.camera.near; this.camera.updateProjectionMatrix(); }   // 12.172 büyük harita: uzak manzara (dağlar) + derinlik duyarlılığı
    this.terrain = this.map.terrain || null;
    this.world = new World(this.map.colliders, this.map.bounds, this.terrain);
    this.sightMap = this.map.sight && this.map.sight.length ? new SightMap(this.map.sight) : null;                // bot görüşü için yaprak / çalı ızgarası
    this.nav = this.map.makeNav ? this.map.makeNav() : this.map.navLayers ? new NavGridML(this.map.colliders, this.map.bounds, this.terrain) : new NavGrid(this.map.colliders, this.map.bounds, this.terrain, !!this.map.layered, this.map.navCell);   // navLayers: üst üste katlar (Boya Kulesi); navCell: büyük harita iri ızgara (12.172); makeNav: haritanın kendi ızgarası (12.171 Çöl Geçidi: köprü altı ikinci kat)

    this.map.navPost?.(this.nav);                                                   // 12.172: haritanın nav son işlemi (kapı hücreleri, oyun alanı dışı kapalı)
    // opts.match: özel maç ayarları; opts.mode: '3v3' | '10v10' hazır ayarı (test/uyumluluk)
    this.mode = makeMatch(opts.match || PRESETS[opts.mode] || {});
    if (this.mode.space) { this.world.grav = TUNE.spaceGrav; opts.weather = 'clear'; }      // 12.157 Uzay: düşük yer çekimi (sunucu, çevrimdışı oyun ve istemci tahmini aynı World.grav), hava yok
    if (this.mode.infection) { opts.diff = 'hard'; this.bossCount = this.mode.total < ZOMBIE.bossSplit ? ZOMBIE.bossCount[0] : ZOMBIE.bossCount[1]; }                                  // Enfekte yalnızca Zor botlarla (menü/sunucu da öyle sabitler)
    // 3. şahıs kamera (H): odada izinli mi? sunucu açıkça true ister; offline varsayılan açık
    this.thirdAllowed = opts.online ? !!opts.online.cfg?.third : headless ? opts.third === true : opts.third !== false;
    this.ffa = !!this.mode.ffa;                          // Ölüm Maçı: herkes tek, her savaşçının kendi takım kimliği
    if (this.ffa) {
      // Haritanın doğma noktaları iki üste ait; ölüm maçında bunun yerine TÜM haritadan ulaşılabilir, aralıklı noktalar kullanılır (ffaPool: küçük haritada aralık kendiliğinden daralır)
      const pool = this.ffaPool();
      const all = pool.length >= 12 ? pool : [...this.map.spawns.blue, ...this.map.spawns.red];     // güvenlik: nokta bulunamazsa üsler
      this.dmPool = all; this._ffaRecent = [];
      for (let i = 0; i < 32; i++) this.map.spawns['f' + i] = all;
      this.map.baseZones = null;                                    // üs cezası yok
    }
    this.mode.objectives = this.mode.type !== 'conquest' && !this.mode.front ? [] : this.map.objectives.filter((o) => this.mode.allFlags || o.core).map((o) => ({ ...o, owner: null, p: 0 }));
    this.tickets = this.mode.scoreBased ? { blue: 0, red: 0 } : { blue: this.mode.tickets, red: this.mode.tickets };   // skor modunda: takım skoru 0'dan başlar, mode.tickets = sınır
    this.timeLeft = this.mode.time || Infinity;
    this.payload = this.mode.payload && this.map.payload ? new Payload(this) : null;   // Vagon modu: ray + vagon + aşamalı doğuşlar (payload.js)
    this.front = this.mode.front && this.map.front ? new Front(this) : null;           // Cephe modu: sektörler + aşamalı doğuşlar (front.js)
    this.vehicles = Vehicles.wanted(this) ? new Vehicles(this) : null;              // 12.177: araç doğuşu olan haritada (Ele Geçirme) araçlar; diğer haritalarda null → davranış aynı
    if (this.vehicles && !opts.online && opts.bots !== false && !opts.editor) vnav(this);   // 12.189 bot sürücü araç ızgarası: kurulumda (harita başına bir kez, ~0,3 sn; maç ortasında sunucu takılmasın)
    this.spawnChoice = 'base';

    this.visMul = 1;
    initGadgets(this);
    if (headless) {
      this.effects = nullSink({ shake: 0 });
      this.sfx = nullSink();
      this.weather = nullSink();
      this.visMul = (opts.weather === 'fog' ? 0.5 : opts.weather === 'rain' ? 0.8 : 1) * (this.map.visMul || 1);   // Weather'ın (+ haritanın kendi pusunun, 12.161 Cephe) bot görüşüne etkisi
    } else {
      this.effects = new Effects(this.scene);
      this.effects.cam = this.camera;                              // 12.146: uzaktaki isabet efekti kameraya uzaklıkla büyür
      this.effects.groundAt = (x, z) => this.world.heightAt(x, z);   // 12.188: patlama parçacıkları arazide durur (eskiden y = 0'a dek düşüp araziden geçiyordu)
      this.sfx = new Sfx();
      this.sfx.setVolume(this.settings.volume);
      this.sfx.setMix({ sfx: this.settings.vSfx ?? 1, amb: this.settings.vAmb ?? 1, rain: this.settings.rainSound !== false });
      this.sfx.init();
      this.sfx.world = this.world;                                                  // iç mekân yankısı için tavan yoklaması
      music.setVolume((this.settings.volume ?? 0.6) * (this.settings.vMusic ?? 0.5));
      music.play('match');
      this.weather = new Weather(this, opts.weather || 'clear');
      spaceSetup(this);                                                            // 12.157: Uzay — parçacıklar düşük yer çekiminde, kask içi hafif boğuk ses
    }
    this.paint = new Paint(this);                         // paintball: boya topları + lekeler (başsızda yalnız simülasyon)
    this.paintColor = paintColorOf;                       // skor tablosunda oyuncunun boya rengi (hud.js)
    this.pickups = new Pickups(this);                     // paintball: boya topu / can kutuları (map.pickups; sunucu yetkili)

    // ── savaşçılar ──
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const nameOf = (n) => names.length ? names.pop() : `Bot-${n}`;
    const order = ['assault', 'medic', 'assault', 'heavy', 'sniper', 'engineer', 'assault', 'medic', 'engineer', 'assault', 'sniper', 'heavy'];
    let id = 0;
    this.online = opts.online ? opts.online.net : null;     // NetClient (çevrimiçi istemci) ya da null (offline / sunucu)
    if (opts.online) {
      for (const r of opts.online.roster) {
        const isPlayer = r.id === opts.online.id;
        const s = new Soldier(this, { id: r.id, name: r.name, team: r.team, cls: r.cls, isPlayer });
        s.vacant = !!r.vac;
        this.soldiers.push(s);
        if (isPlayer) this.playerSoldier = s;
      }
    } else if (this.ffa) {
      for (let i = 0; i < this.mode.perTeam; i++) {
        const isPlayer = !headless && i === 0, team = 'f' + i;
        const s = new Soldier(this, { id: id++, name: isPlayer ? (opts.playerName || 'Sen') : nameOf(id), team, cls: this.mode.fixed ? 'assault' : isPlayer ? opts.cls : order[i % order.length], isPlayer });
        this.soldiers.push(s);
        if (isPlayer) this.playerSoldier = s;
        else this.brains.push(new BotBrain(this, s, opts.diff));
      }
    } else for (const team of ['blue', 'red']) {
      for (let i = 0; i < this.mode.perTeam; i++) {
        const isPlayer = !headless && team === opts.team && i === 0;
        const s = new Soldier(this, {
          id: id++, name: isPlayer ? (opts.playerName || 'Sen') : nameOf(id), team,
          cls: isPlayer ? opts.cls : order[(i + (team === 'red' ? 2 : 0)) % order.length], isPlayer,
        });
        this.soldiers.push(s);
        if (isPlayer) this.playerSoldier = s;
        else this.brains.push(new BotBrain(this, s, opts.diff));
      }
    }
    if (opts.autoplay && !headless) this.brains.push(new BotBrain(this, this.playerSoldier, opts.diff));
    if (opts.editor) { for (const s of this.soldiers) if (s !== this.playerSoldier) { s.vacant = true; s.alive = false; s.brain = null; } this.brains.length = 0; }   // Harita Editörü: bot yok
    if (this.mode.infection) {
      this.map.baseZones = null;                                    // üs cezası yok: zombiler her yerden doğar
      if (!opts.online) this.seedInfection();
    }
    // mangallar: takım başına 4'lü gruplar
    for (const team of ['blue', 'red']) {
      let n = 0;
      for (const s of this.soldiers) if (s.team === team) s.squad = Math.floor(n++ / 4);
    }
    this.squadGoals = { blue: [], red: [] };
    this.perchCache = new Map();
    this.squadT = 0;
    if (!opts.online) this.assignSquads();
    if (headless) {
      this.hud = nullSink();
      this.killfx = nullSink();
      this.playerSoldier = null;
      this.HN = 60;                                            // lag compensation geçmişi (adım). 12.187: 40 → 60 (geri sarma en çok 57 adım = 0,95 sn; yüksek ping + titreşim tamponu + takılma sonrası kuyrukta isabet kırpılmasın)
      this.histBuf = new Float32Array(this.HN * this.soldiers.length * 9);
      this.running = true;
      if (opts.bots === false) {                               // botsuz oda: slotlar oyuncu gelene kadar boş
        for (const s of this.soldiers) { s.vacant = true; s.name = 'Boş'; s.brain = null; }
        this.brains.length = 0;
      }
      for (const s of this.soldiers) if (!s.vacant) this.respawn(s, true);
      return;     // sunucu: DOM, döngü ve girdi yok — step(dt) dışarıdan çağrılır
    }
    this.hud = new Hud(this);
    this.killfx = new KillFx(this);                                                // vuruş / öldürme hissi (kendi katmanı)
    this.objFx = this.mode.objectives.length && !opts.editor ? new ObjFx(this) : null;   // 12.191 bayrak direği (bez ilerlemeyle iner / çıkar) + alan sınırı halkası
    if (this.online) this.chat = new Chat(this);                                   // sohbet yalnızca çevrimiçi odalarda
    this.player = new Player(this, this.playerSoldier, this.settings);
    this.nadeView = new NadeView(this);                                            // 12.144: bomba yörünge önizlemesi + pişirme göstergesi
    this.player.locked = !!opts.nolock;
    this.abfx = new AbilityFx(this);                                                // zombi gücü: yerel oyuncunun ekran / ses geri bildirimi (abilityfx.js)
    this._vmLights();
    if (opts.devMode && !this.online) {                                             // geliştirici modu: uçuş + ölümsüzlük + rozet; maç bitmez
      this.playerSoldier.fly = true; this.devGod = true;
      const bd = document.createElement('div');
      bd.style.cssText = 'position:absolute;left:50%;top:104px;transform:translateX(-50%);padding:3px 14px;background:rgba(255,138,31,.9);color:#160a02;font:700 12px Bahnschrift,Arial Narrow,sans-serif;letter-spacing:3px;text-transform:uppercase;z-index:6';
      bd.textContent = (opts.editor ? `Harita editörü · ${this.mapDef.name} · L uçuş · I paneli gizle · Esc menü` : 'Geliştirici modu · L uçuş · N botlar · O ölümsüz · P konum') + ' · sürüm ' + (typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev');
      this.hud.root.appendChild(bd);
      if (opts.editor) { this.mapEditor = new MapEditor(this); this.mapEditor.toggle(true); }    // ayrı bölüm (ana menü → Harita Editörü): bot yok, panel açık
      if (!opts.editor) setTimeout(() => this.hud?.toast($t('hud.t.devFly'), '#ffd27a'), 800);
    }

    // olaylar
    this.on('pad', (s) => { if (s.pos.distanceTo(this.camera.position) < 40) this.sfx.boing?.(s.pos); });
    this.on('hitmark', (e) => {
      this.killfx.hit(e);                                                          // işaret + isabet sesi (öldürme sesi killfx.kill'de)
    });
    document.addEventListener('keydown', this._kd = (e) => {
      if (!this.binds.is('flashlight', e.code) || e.repeat || !this.running || this.ended || !this.playerSoldier.alive || this.playerSoldier.def.zombie) return;      // zombi: aynı tuş özel güç
      const pv = this.playerSoldier.veh;
      if (pv) {                                                                    // 12.177: araçta F = far (sürücü); yolcu feneri kapalı
        if (this.playerSoldier.seat !== 0) return;
        pv.lights = !pv.lights; pv.lightT = performance.now(); this.online?.edge('vl');      // 12.183 lightT: çevrim içinde sunucunun eski far durumu bu tahmini bir süre ezmesin
        this.hud.toast($t(pv.lights ? 'veh.t.lightsOn' : 'veh.t.lightsOff'), '#ffe6a8');
        return;
      }
      this.torchOn = !this.torchOn;
      this.torch.intensity = this.torchOn ? (this.night ? 140 : this.tod === 'sunset' ? 45 : 0) : 0;
      this.playerSoldier.flashOn = this.torchOn && this.torch.intensity > 0;
      this.hud.toast(this.torchOn ? (this.torch.intensity ? $t('hud.t.torchOn') : $t('hud.t.torchDay')) : $t('hud.t.torchOff'), '#ffe6a8');
    });
    document.addEventListener('pointerlockchange', this._plc = () => {
      const locked = document.pointerLockElement === this.canvas;
      const chatWas = !!this.chatOpen;
      if (locked) { this.lockFails = 0; this._quietUntil = 0; this.player.skipMove = 2; this.lockKeys(true); }                 // kilit anındaki ilk fare olayı genelde zıplar: atla
      else {
        this.chat?.close();
        this._unlockBy = this._selfUnlock ? 'game' : 'user'; this._selfUnlock = false;   // 12.147: oyunun bıraktığı kilit jestsiz geri alınabilir
        this.lockKeys(document.fullscreenElement && this.settings.fullscreen !== false ? 'esc' : false);   // tam ekran menüde Esc sayfada kalsın (yoksa tam ekrandan çıkar)
        this._unlockAt = performance.now();
        this.player.fireHeld = false; this.playerSoldier.ads = false;                // kilit kopunca takılı ateş/nişan kalmasın
      }
      this.player.locked = locked || !!this.opts.nolock;
      if (!this.ended) this.hud.setPaused(!this.player.locked);
      if (!this.ended && !this.player.locked && chatWas) this.hud.showResume(true);      // sohbetteki Esc kilidi de düşürdü: menü değil, "tıkla devam"
      this.simulate = this.player.locked || this.ended;
    });
    document.addEventListener('pointerlockerror', this._ple = () => this.onLockError());
    document.addEventListener('keydown', this._esc = (e) => { if (e.code === 'Escape' && !e.repeat) this.onEsc(e); });
    addEventListener('beforeunload', this._bu = (e) => { if (this.running && !this.ended && !this.opts.nolock) { e.preventDefault(); e.returnValue = ''; } });      // yanlışlıkla Ctrl+W / sekme kapatma: onay sorar
    addEventListener('resize', this._rs = () => {
      this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight, false);
    });

    if (this.online) {
      this._acc = 0;
      this.online.attach(this);        // ilk snapshot doğmayı belirler (respawn yok)
      this.onNetEvents(opts.online.deps || []);     // odada zaten kurulu mayın/cephane kutuları
      this.pickups.applyState(opts.online.pk);      // paintball: şu an yeniden belirmeyi bekleyen kutular
      const code = opts.online.room;
      const b = (this._badge = document.createElement('div')); b.id = 'roombadge';            // telefonda konumu touch.js CSS'inde
      b.style.cssText = 'position:fixed;left:12px;top:178px;z-index:6;padding:6px 10px;background:rgba(8,12,18,.72);border:1px solid rgba(255,255,255,.14);color:#e8edf5;font:600 13px Bahnschrift,Rajdhani,Arial Narrow,sans-serif;letter-spacing:1.5px;cursor:pointer;user-select:none';
      b.title = $t('hud.t.roomTip');
      b.onclick = () => {
        const link = `${location.origin}${location.pathname}?online=${code}`;
        (navigator.clipboard?.writeText(link) || Promise.reject()).then(() => this.hud.toast($t('hud.t.roomCopied', { c: code }), '#9be07f'), () => this.hud.toast($t('hud.t.roomCode', { c: code }), '#9be07f'));
      };
      document.body.appendChild(b);
      this._badgeT = 0; this._badgeCode = code;
      this.online.roster = opts.online.roster;
      document.addEventListener('keydown', this._km = (e) => {                    // M: takım seçimi
        if (this.binds.is('team', e.code) && !e.repeat && !this.ended) { e.preventDefault(); this.toggleTeamMenu(); }
        else if (e.code === 'Escape' && this._tm) this.toggleTeamMenu(false);
      });
    } else for (const s of this.soldiers) if (!s.vacant) this.respawn(s, true);
    this.remoteTorch = new RemoteTorches(this);      // 12.159: başkalarının feneri (sabit ışık havuzu; ön ısıtmadan önce kurulur → ışık sayısı hiç değişmez)
    if (this.vehicles) { this.vehView = new VehicleView(this); this.vehHud = new VehicleHud(this); }      // 12.177 araç modelleri / far havuzu / ses + HUD (ön ısıtmadan önce: far ışıkları sabit)
    this.map.fx?.attach?.(this);                       // 12.172: haritanın kurulum sonrası görsel kancası (hava / gün saati uygulanmış sise göre; ön ısıtmadan önce → program değişmez)
    this.warm = warmup(this);                          // 12.151: gölgelendirici ön ısıtma (yükleme ekranı açıkken; Firefox'ta ilk ACOG / nişan / silah çekme donmasını önler)
    this.running = true;
    this.simulate = !!opts.nolock || !!this.online;
    this.hud.setPaused(!opts.nolock);
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    if (opts.debug) window.__game = this;
  }

  // ───── Enfekte modu ─────
  // Maç başı: oyuncu sayısına göre 1 ya da 2 BOSS zombi seçilir (10 kişiden azsa 1); geri kalanı insan (mavi). Zombiler 'red' takımındadır.
  // Kurallar: boss'un öldürdüğü insan NORMAL zombi olur · insan 1 kez ölünce zombi · normal zombi 2 kez ölünce insan · boss 3 kez ölünce insan.
  seedInfection() {
    const all = this.soldiers.filter((s) => !s.vacant);
    const k = this.bossCount;
    const pool = [...all].sort(() => Math.random() - 0.5);
    for (const s of all) if (s.team !== 'blue') { s.team = 'blue'; s.setClass(s.cls === 'zombie' ? 'assault' : s.cls); }       // hepsi insan olarak başlar
    for (let i = 0; i < k; i++) this.makeZombie(pool[i], true);
    // zombi doğma havuzu: haritanın her yerinden ulaşılabilir, aralıklı noktalar (insanlara yakın ama ezici değil)
    const base = this.map.spawns.blue[0];
    this.infPool = this.nav.spreadPoints(this.nav.reachable(base.x, base.z), { spacing: 16, max: 120 }).filter((p) => !this.nav.floor || this.nav.floorAt(p.x, p.z) < 0.3).map((p) => ({ ...p, ry: 0 }));
    if (this.infPool.length < 12) this.infPool = [...this.map.spawns.blue, ...this.map.spawns.red];
  }

  makeZombie(s, boss = false, type) {
    if (!s.def.zombie) { s.humanCls = s.cls; s.humanChoice = s.choice; }                       // insana dönünce eski sınıfı/teçhizatı
    s.team = 'red'; s.boss = boss; s.infectNext = false;
    s.choice = {};
    s.ztype = type || randomZType();
    s.zLives = boss ? BOSS.lives : ZOMBIE.lives;
    s.setClass('zombie');
    s.maxHp = s.zombieMaxHp(); s.hp = s.maxHp;
    s.squad = 0;
  }

  // Ölen insan NORMAL zombi olarak yeniden doğar (respawn içinden çağrılır)
  infect(s) {
    const ctl = this.ctlOf(s);
    this.makeZombie(s, false, ctl && ctl.pendingZ);                  // seçtiği tür (yoksa rastgele)
    if (ctl) { ctl.pendingClass = null; ctl.pendingLoadout = null; ctl.pendingZ = null; }
    this.netEvent({ e: 'inf', v: s.id, bs: 0, zt: ZT_ORDER.indexOf(s.ztype) + 1, zl: s.zLives });
    this.emit('infect', s);
    if (s.isPlayer && !this.headless) { this.hud.toast($t('hud.t.infected'), '#b6ff6a'); this.sfx.zombie?.(s.pos); }
  }

  // Can hakkı biten zombi / boss yeniden insan olarak doğar (seçtiği ya da eski sınıfıyla)
  cure(s) {
    const ctl = this.ctlOf(s), cls = (ctl && ctl.pendingClass) || s.humanCls || 'assault';
    const wasBoss = s.boss;
    s.team = 'blue'; s.boss = false; s.zLives = 0; s.ztype = 'walker'; s.infectNext = false; s.cloakNet = false; s.abActive = 0; s.abT = 0;
    s.choice = ctl ? (ctl.pendingLoadout || s.humanChoice || {}) : { random: true };
    s.setClass(CLASS_DEFS[cls] && cls !== 'zombie' ? cls : 'assault');
    if (ctl) { ctl.pendingClass = null; ctl.pendingLoadout = null; ctl.pendingZ = null; }
    this.netEvent({ e: 'cure', v: s.id, cls: s.cls });
    this.emit('cure', s);
    if (s.isPlayer && !this.headless) this.hud.toast(wasBoss ? $t('hud.t.bossDown') : $t('hud.t.cured'), '#7ec8ff');
  }

  // Hazırlık süresi: Enfekte maçın ilk ZOMBIE.grace saniyesinde zombiler hareket/saldırı/güç kullanamaz ve hasar almaz (insanlar yüksek yere çıkar).
  // timeLeft sunucudan senkron geldiği için istemcide de aynı sonucu verir. Süresiz maçta hazırlık yok.
  get graceLeft() {
    if (!this.mode.infection || !Number.isFinite(this.timeLeft) || !this.mode.time) return 0;
    return Math.max(0, ZOMBIE.grace - (this.mode.time - this.timeLeft));
  }

  // İnsan ve zombi sayıları: ölü ama henüz enfekte olmamış insan zombi sayılır; can hakkı biten ölü zombi insan sayılır
  infCounts() {
    let h = 0, z = 0;
    for (const s of this.soldiers) {
      if (s.vacant) continue;
      if ((s.team === 'blue' && !s.infectNext) || s.willCure) h++; else z++;
    }
    return { h, z };
  }

  // 12.196 Sürü dayanıklılığı: insanlar zombilerden kalabalıksa normal zombi daha çok canla doğar (can × 1 + horde × (insan/zombi − 1), en çok hordeMax).
  // Az zombi çok insana tek tek koşup saniyede eriyordu; zombi çoğaldıkça çarpan 1'e iner. Boss kendi ölçeğini kullanır.
  hordeMul() {
    if (!this.mode.infection || !(ZOMBIE.horde > 0)) return 1;
    const c = this.infCounts();
    return Math.min(ZOMBIE.hordeMax || 1, 1 + ZOMBIE.horde * Math.max(0, c.h / Math.max(1, c.z) - 1));
  }

  // Zombi doğma noktası: canlı insanlara yakın ama en az 38 m uzakta (üstlerine doğmasın)
  pickZombieSpawn(s, first) {
    const humans = this.soldiers.filter((e) => e.alive && e.team === 'blue');
    const pts = first || !humans.length ? this.map.spawns.red : this.infPool;
    let best = null, bs = -1e9;
    const eyeP = new THREE.Vector3(), tgtP = new THREE.Vector3();
    for (let k = 0; k < 30; k++) {
      const p = pick(pts);
      if (this.soldiers.some((e) => e !== s && e.alive && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 1.3)) continue;
      let dmin = 1e9;
      for (const e of humans) dmin = Math.min(dmin, Math.hypot(e.pos.x - p.x, e.pos.z - p.z));
      let seen = false;                                                          // hiçbir insanın görüşünde doğmasın (doğar doğmaz vurulmasın)
      if (!first) for (const e of humans) { if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 75 && this.losClear(e.eye(eyeP), tgtP.set(p.x, (p.y || 0) + 1.2, p.z))) { seen = true; break; } }
      const sc = (dmin >= (ZOMBIE.spawnMin || 38) ? 200 - dmin + Math.random() * 25 : dmin - 400) - (seen ? 500 : 0);        // yeterince uzak + görünmeyen olanlardan en yakını
      if (sc > bs) { bs = sc; best = p; }
    }
    const p = best || pick(pts), tgt = humans.length ? pick(humans).pos : { x: p.x, z: p.z - 1 };
    return { x: p.x, z: p.z, ry: Math.atan2(-(tgt.x - p.x), -(tgt.z - p.z)) };
  }

  // ───── sunucu: insan oyuncular (botların yerine geçer) ─────
  // Takımdan bir bot slotunu alır: beyni sökülür, savaşçı insana verilir. Çıkınca bot geri gelir.
  claimSlot(team, name, cls = 'assault', choice = {}) {
    const s = this.soldiers.find((e) => (this.ffa || e.team === team) && (e.brain || e.vacant) && !this.humans.has(e.id));
    if (!s) return null;
    if (s.brain) this.brains.splice(this.brains.indexOf(s.brain), 1);
    s.brain = null; s.dmgMul = 1; s.vacant = false;
    s.human = true; s.name = name;
    s.choice = { primary: choice.primary, secondary: choice.secondary, gadget: choice.gadget, melee: choice.melee, front: cleanFront(choice.front) };
    applyOpticPrefs(s, choice);                                                  // 12.174: nişangâh tercihleri (modern genel + dönem silah başına)
    if (!CLASS_DEFS[cls] || cls === 'zombie' || this.mode.fixed) cls = s.cls === 'zombie' ? 'zombie' : 'assault';
    if (s.cls !== cls) s.setClass(cls); else s.items = s.loadout();
    if (this.mode.infection && this.opts.bots === false && s.team === 'blue') {      // botsuz odada hiç zombi yoksa ikinci oyuncu ilk zombi olur
      const live = this.soldiers.filter((e) => !e.vacant && e !== s);
      if (live.length && !live.some((e) => e.team === 'red')) { this.makeZombie(s, true); this.netEvent({ e: 'inf', v: s.id, bs: 1, zt: 1, zl: s.zLives }); }
    }
    this.humans.set(s.id, { s, queue: [], last: null, stale: 0, ack: 0, tickAck: false, fireBuf: 0, pendingClass: null, pendingLoadout: null, spawnChoice: 'base' });
    this.respawn(s, true);
    return s;
  }

  releaseSlot(id) {
    const h = this.humans.get(id);
    if (!h) return;
    this.humans.delete(id);
    const s = h.s;
    s.human = false; s.skins = null; s.wear = null;       // ayrılanın kaplamaları / kıyafeti bota geçmez
    if (this.opts.bots === false) {                      // botsuz oda: slot boşalır
      s.vacant = true; s.name = 'Boş'; s.alive = false; s.hp = 0; s.deadT = 99; s.vel.set(0, 0, 0);
      return;
    }
    s.choice = { random: true };
    s.name = this.freeBotName();
    new BotBrain(this, s, this.opts.diff);
    this.brains.push(s.brain);
  }

  freeBotName() {
    const used = new Set(this.soldiers.map((e) => e.name));
    return BOT_NAMES.find((n) => !used.has(n)) || `Bot-${Math.floor(Math.random() * 900 + 100)}`;
  }

  // İnsan oyuncunun simülasyonu GİRDİ GÜDÜMLÜDÜR: her girdi, istemcideki Player akışıyla birebir bir adımdır
  // (güncelle + hareket, sonra girdi). Girdi yoksa oyuncu o adımda ilerlemez; böylece ağ gecikmesi/dalgalanması
  // istemci tahminiyle sunucuyu birbirinden koparmaz ve hız hilesi mümkün olmaz.
  humanTick(h, inp, dt) {
    const s = h.s, V = this.vehicles;
    s.ads = !!inp.a;                                                  // 12.145: nişan isteği adsT güncellemesinden ÖNCE (istemcide fare olayı karenin s.update'inden önce gelir; eski sıra sunucu adsT'sini bir adım geride bırakıp nişandan koşuya dönüşte ~5 cm tahmin düzeltmesi yaptırıyordu)
    s.update(dt);
    if (s.veh) V.place(s);
    else if (s.alive) { this.world.move(s, dt); V?.pushSoldier(s); this.fallCheck(s); this.swimCheck(s, dt); }
    if (!s.alive) return;
    s.yaw = inp.yw; s.pitch = Math.max(-1.5, Math.min(1.5, inp.pt));
    if (V && inp.ve) V.toggle(s);                                     // 12.177: E (bin / in) · 1–4 koltuk
    else if (V && inp.vs && s.veh) V.seatTo(s, inp.vs - 1);
    if (inp.w !== s.cur) s.switchTo(inp.w);
    if (s.veh) { this.vehTick(h, inp, dt); return; }
    if (inp.u) s.standUp();
    if (inp.c) s.toggleCrouch();
    if (inp.p) s.toggleProne();
    if (inp.rl) s.startReload();
    if (inp.fm) s.toggleFireMode();
    if (inp.ab) s.useAbility();
    if (inp.o) s.cycleOptic();
    if (inp.nu) s.toggleNadeMode();                                   // 12.193: bomba atış şekli (sağ tık; üstten ↔ alttan)
    applyInput(s, { f: inp.f, r: inp.r, lean: inp.l, sprint: !!inp.s, jump: !!inp.j, dive: !!inp.dn }, dt);
    // ateş: Player.update ile aynı mantık
    if (inp.fp) h.fireBuf = 0.15;
    h.fireBuf = Math.max(0, h.fireBuf - dt);
    s.rewindTick = Number.isFinite(inp.vt) ? inp.vt : null;
    if (s.rewindTick != null) h.vtLag = this.tick - s.rewindTick;          // teşhis (dbg ask): girdinin gördüğü an ile işlendiği adım arası
    s.inSeq = inp.q;                                                  // paintball: tohumlu saçılım + istemci tahmininin top eşlemesi
    // 3. şahıs: kameranın gözden ofseti. Yalnızca odada izinliyse, ≤ 4,5 m ve göz→kamera arasında duvar yoksa kabul edilir; aksi halde atış gözden.
    if (inp.tl !== undefined) s.flashOn = !!inp.tl && !s.def.zombie;    // 12.159: fener durumu (diğer istemcilere F_TORCH; botlar da görür) · sessiz adımın sahte girdisinde tl yok → değişmez
    s.stanceLeft = this.thirdAllowed && !!inp.sd;                      // yalnızca görsel: diğer oyuncular sol omuz duruşunu görsün
    s.shotOff = null;
    if (this.thirdAllowed && Array.isArray(inp.co)) {
      const o = new THREE.Vector3(inp.co[0], inp.co[1], inp.co[2]);
      if (o.length() <= 4.5) { const e = s.eye(), to = e.clone().add(o); if (this.world.clear(e, to)) s.shotOff = o; }
    }
    const st = s.stat;
    if (st.kind === 'melee') { if (s.meleeInput(inp.fh, h.fireBuf)) h.fireBuf = 0; }
    else if (s.triggerUpdate(!!inp.fh, h.fireBuf)) h.fireBuf = 0;
    s.rewindTick = null; s.inSeq = null;
  }

  // 12.177: araçtaki insanın girdi adımı (sunucu). Sürücü: girdi = gaz / direksiyon / fren (j) / korna (fh) / far (vl) → aracın bir fizik adımı.
  // Yolcu: silah işleri aynı (ateş, şarjör, mod, nişangâh); atış KENDİ koltuğunun istemcinin gördüğü andaki yerinden çıkar (araç uzaktakiler
  // gibi interpolasyonla ~100 ms geride görünür; geri sarma yalnız hedeflere değil atıcının koltuğuna da uygulanır → hareketli araçtan isabet tutar).
  vehTick(h, inp, dt) {
    const s = h.s, V = this.vehicles, v = s.veh;
    if (inp.rl) s.startReload();
    if (inp.fm) s.toggleFireMode();
    if (inp.o) s.cycleOptic();
    s.flashOn = false; s.stanceLeft = false; s.shotOff = null;
    if (s.seat === 0) {
      if (inp.vl) v.lights = !v.lights;
      v.horn = !!v.def.horn && !!inp.fh;                               // jip: sol tık korna · tank: ana top · 12.188 helikopter: burun topu (korna yok)
      V.drive(v, { f: inp.f, r: inp.r, b: !!inp.j, u: !!inp.j, d: !!inp.dn, yw: inp.gy ?? inp.yw, pt: inp.gp ?? inp.pt }, dt);      // 12.188 gy / gp: artının noktasına balistik top hedefi · 12.178: bakış = kule / top hedefi · 12.179 helikopter: j yüksel, dn alçal, bakış burun
      if (v.def.cannon && (inp.fh || inp.fp)) V.fireCannon(v, s);
      if (seatGun(v.def, 0)) V.mgFire(s, !!inp.fh, dt);                // 12.188 helikopter pilotu: burun topu (sol tık)
      if (v.def.rockets && inp.a) V.fireRocket(v, s);                    // · roketler (sağ tık)
      for (const o of v.seats) if (o) V.place(o);
      h.fireBuf = 0;
      return;
    }
    V.place(s);
    if (inp.fp) h.fireBuf = 0.15;
    h.fireBuf = Math.max(0, h.fireBuf - dt);
    s.rewindTick = Number.isFinite(inp.vt) ? inp.vt : null;
    s.inSeq = inp.q;
    const back = s.rewindTick != null ? this.pastPos(s, s.rewindTick) : null, keep = back ? s.pos.clone() : null;
    if (back) s.pos.copy(back);
    const st = s.stat;
    if (mgAt(v.def, s.seat)) V.mgFire(s, !!inp.fh, dt);             // 12.178 tank nişancısı · 12.179 helikopter kapı nişancısı: makineli
    else if (st.kind === 'melee') { if (s.meleeInput(inp.fh, h.fireBuf)) h.fireBuf = 0; }
    else if (s.triggerUpdate(!!inp.fh, h.fireBuf)) h.fireBuf = 0;
    if (keep) s.pos.copy(keep);
    s.rewindTick = null; s.inSeq = null;
  }

  // Geçmiş adımdaki konum (lag compensation tamponu; kesirli adım ara değerlenir). Yoksa null
  pastPos(s, vt) {
    if (!this.histBuf) return null;
    const N = this.soldiers.length, T = this.tick, t = Math.max(T - (this.HN - 3), Math.min(T, vt)), i0 = Math.floor(t), f = t - i0, i1 = Math.min(T, i0 + 1);
    if (t < 1) return null;                                          // 12.187: maçın ilk adımları (tampon henüz dolmadı; negatif indeks NaN konum verirdi)
    const b = this.histBuf, k = s.id, o0 = (i0 % this.HN) * N * 9 + k * 9, o1 = (i1 % this.HN) * N * 9 + k * 9;
    return new THREE.Vector3(b[o0] + (b[o1] - b[o0]) * f, b[o0 + 1] + (b[o1 + 1] - b[o0 + 1]) * f, b[o0 + 2] + (b[o1 + 2] - b[o0 + 2]) * f);
  }

  updateHumans(dt) {
    for (const h of this.humans.values()) {
      const s = h.s;
      h.tickAck = false;
      if (!s.alive) { h.queue.length = 0; continue; }     // ölüler genel döngüde güncellenir; ölüyken gelen girdiler atılır
      // Girdi bütçesi = zaman kovası (hız hilesi koruması): her gerçek adımda 1 hak birikir, en çok 30 (0,5 sn).
      // Her işlenen girdi 1 hak harcar. Böylece ağ dalgalanmasında yığılan girdiler biriken zamanla eritilir (kalıcı gecikme
      // kalmaz), ama oyuncunun simüle edilen toplam süresi gerçek süreyi aşamaz: saniyede 60'tan fazla girdi yollamak hız kazandırmaz.
      h.budget = Math.min((h.budget ?? 1) + 1, 30);
      this.drainBacklog(h);
      let n = h.queue.length > 2 ? 2 : 1, did = false;
      while (n-- > 0 && h.queue.length && h.budget >= 1) {
        const inp = h.queue.shift();
        h.budget -= 1; h.stale = 0; h.ack = inp.q; h.tickAck = true; did = true;
        this.humanTick(h, inp, dt);
        if (!s.alive) break;
      }
      // Girdi yoksa oyuncu o adımda ilerlemez (zaman birikir). İstemci >0,5 sn sustuysa (sekme arka planda, bağlantı takıldı) durdur.
      if (!did && ++h.stale > 30) {
        h.budget = Math.max(0, h.budget - 1);
        this.humanTick(h, { yw: s.yaw, pt: s.pitch, a: 0, w: s.cur, f: 0, r: 0, l: 0, s: 0, j: 0, c: 0, p: 0, u: 0, rl: 0, fm: 0, o: 0, fh: 0, fp: 0 }, dt);
      }
    }
  }

  // 12.138: KALICI GİRDİ BİRİKMESİNİ ERİT. Bağlantı > 0,5 sn takılınca (yeniden iletim, dalgalı ping) o sürenin girdileri bir anda gelir; bütçe
  // en çok 30 hak (0,5 sn) biriktirdiği için fazlası kuyrukta kalır ve istemci tam 60/sn yolladığından HİÇ erimez (yalnız ölünce silinirdi).
  // Sonuç: oyuncunun her atışı ~0,5 sn geç işlenir, görüş farkı (vt) geri sarma penceresini (HN − 3 = 37 adım) aşar, hedef yanlış yere
  // sarılır → hareketli düşmana ölene kadar isabet yok. Çözüm: 0,5 sn'lik pencerede kuyruğun EN AZ uzunluğu (kalıcı fazlalık) 2'yi aşıyorsa
  // fazlası atlanır. Yalnız "sessiz" girdi atlanır (tuş kenarı / silah değişimi yok); duran oyuncunun girdisi her adım, hareket edeninki 3 adımda
  // bir (atlanan adımın yürüyüşü kaybolur → istemci küçük, yumuşatılan düzeltme alır). Atlamak simülasyonu kısaltır, uzatmaz: hız hilesine kapı açmaz.
  drainBacklog(h) {
    const q = h.queue;
    h.qMin = Math.min(h.qMin ?? 99, q.length);
    if ((h.qWin = (h.qWin || 0) + 1) >= 30) { h.backlog = Math.max(0, h.qMin - 2); h.qMin = 99; h.qWin = 0; }
    if (!(h.backlog > 0) || q.length <= 2) return;
    const inp = q[0];
    if (inp.c || inp.p || inp.u || inp.fp || inp.rl || inp.fm || inp.o || inp.ab || inp.ve || inp.vs || inp.vl || inp.nu || inp.w !== h.s.cur) return;
    const idle = !inp.f && !inp.r && !inp.j;
    if (!idle && this.tick % 3) return;
    q.shift(); h.backlog--; h.dropped = (h.dropped || 0) + 1;
    // 12.178 sürücü: atlanan girdi aracın bir fizik adımıydı (istemci onu tahmin etti) → atlamak yerine bu adımda fazladan işlenir
    // (birikme yine erir; araç istemciyle aynı yolu izler → gecikmeli bağlantıda düzeltme olmaz). Yalnız kuyruktaki gerçek girdi: hız kazandırmaz
    if (h.s.veh && h.s.seat === 0 && h.s.alive) { h.ack = inp.q; h.tickAck = true; this.humanTick(h, inp, SIM_DT); }
  }

  // ───── olaylar ─────
  on(n, fn) { (this.listeners.get(n) || this.listeners.set(n, []).get(n)).push(fn); }
  emit(n, p) { const a = this.listeners.get(n); if (a) for (const f of a) f(p); }

  // Tam ekranda klavye kilidi: Ctrl+W / Ctrl+T gibi tarayıcı kısayolları yakalanır, oyun sırasında sekme kapanmaz.
  // 12.147: Esc de kilitli → kısa Esc sayfaya gelir (oyun menüyü kendisi açar / kapar), basılı tutunca tarayıcı tam ekrandan çıkar.
  // on === 'esc': duraklatma menüsünde yalnız Esc (diğer kısayollar serbest).
  lockKeys(on) {
    const kb = navigator.keyboard;
    if (on === 'esc') { try { kb?.lock(['Escape'])?.catch?.(() => {}); } catch (e) { /* desteklenmiyor */ } return; }
    if (!on) { try { kb?.unlock(); } catch (e) { /* desteklenmiyor */ } return; }
    if (this.settings.fullscreen !== false && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    const keys = ['Escape', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyT', 'KeyN', 'KeyC', 'KeyF', 'KeyG', 'KeyV', 'KeyX', 'KeyZ', 'KeyB', 'KeyH', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'Space', 'Tab', 'F5'];
    try { kb?.lock(keys)?.catch?.(() => {}); } catch (e) { /* desteklenmiyor */ }
  }

  // quiet: Esc ile dönme denemesi (kullanıcı jesti yok, reddedilebilir): hata sayılmaz / uyarı yok, "tıkla devam" katmanı açık kalır
  requestLock(quiet = false) {
    this.sfx.init();
    if (this.opts.nolock) { this.player.locked = true; this.simulate = true; this.hud.setPaused(false); return; }
    if (this.noPointerLock) { this.player.locked = true; this.simulate = true; this.hud.setPaused(false); return; }
    // Chrome, kullanıcı Esc ile çıktıktan hemen sonra (~1,3 sn) yapılan kilit isteğini reddeder: bekleyip sonra iste (oyunun bıraktığı kilitte soğuma yok)
    const wait = this._unlockBy === 'game' ? 0 : 1350 - (performance.now() - (this._unlockAt || -1e9));
    clearTimeout(this._lockT);
    if (wait > 0) { this._lockT = setTimeout(() => this.requestLock(quiet), wait); return; }
    this._quietUntil = quiet ? performance.now() + 2000 : 0;
    const plain = () => { try { const p = this.canvas.requestPointerLock(); p?.catch?.((err) => this.onLockError(err)); } catch (e) { this.onLockError(e); } };
    try {
      // ham fare girdisi (işletim sistemi hızlandırması yok): daha tutarlı bakış; desteklenmezse normal istek
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      p?.catch?.((err) => { if (err && err.name === 'NotSupportedError') plain(); else this.onLockError(err); });
    } catch (e) { plain(); }
  }

  // Kilit alınamadı: tek seferlik hatada kalıcı "kilitsiz moda" GEÇME (imleç ekranda kalıp bakışı bozuyordu); ancak art arda başarısızsa
  onLockError() {
    if (performance.now() < (this._quietUntil || 0)) return;                 // Esc denemesi reddedildi: katman zaten "tıkla devam" diyor
    this.lockFails = (this.lockFails || 0) + 1;
    if (this.lockFails >= 4 || !this.canvas.requestPointerLock) { this.fallbackLock(); return; }
    this.hud.toast($t('hud.t.lockRetry'), '#ffd27a');
  }

  // Fare kilidi desteklenmiyorsa (gömülü sayfa vb.): ok tuşlarıyla bak, Esc ile duraklat
  fallbackLock() {
    if (this.noPointerLock) return;
    this.noPointerLock = true;
    this.player.locked = true; this.simulate = true;
    this.hud.setPaused(false);
    this.hud.toast($t('hud.t.lockFail'), '#ffd27a');
  }

  // 12.147 Esc: oyunda → duraklatma menüsü · menüde → oyuna dön · "tıkla devam" katmanında → menü.
  // Kilit varken Esc'nin sayfaya gelmesi yalnız tam ekran + Keyboard Lock'ta olur (pencerede tarayıcı kilidi kendisi bırakır, olay gelmez).
  // Alt sayfa (Ayarlar / Kontroller, tuş atama), sohbet, takım menüsü Esc'yi kendileri işler; dokunmatik / kilitsiz yedek mod player.js'te.
  onEsc(e) {
    const hud = this.hud;
    if (!this.running || this.ended || hud.endShown || this.noPointerLock || this._tm || this.chatOpen || hud.igs?.open) return;
    if (this.opts.nolock ? this.simulate : this.player.locked) {
      e.preventDefault();
      if (this.opts.nolock) { this.player.locked = false; this.simulate = false; hud.setPaused(true); return; }      // ?nolock=1 (test / editör): aynı durum geçişi
      this._selfUnlock = true; document.exitPointerLock?.();               // pointerlockchange menüyü açar
      return;
    }
    if (!this._unlockBy && hud.$('pause').classList.contains('intro')) return;     // ilk giriş ekranı ("Hazır mısın?"): ilk kilit tıkla alınır
    // 12.186: kilidi tarayıcı bıraktı ve AYNI Esc basışı sayfaya da geldi (yavaş karede olay sırası: önce pointerlockchange, sonra keydown) → menü açık kalsın.
    // Eskiden bu ikinci teslim menüyü hemen kapatıp "Devam etmek için tıkla" katmanını açıyordu (esctest swiftshader'da her seferinde). Aynı basışın olayı kilit düşüşünden önce ya da birkaç ms sonra damgalanır; yeni basış insan hızında (≥ 100 ms) gelir.
    if (this._unlockBy === 'user' && e.timeStamp - (this._unlockAt ?? -1e9) < 60) { e.preventDefault(); return; }
    if (hud.resumeShown) { e.preventDefault(); hud.setPaused(true); return; }                 // katman → menü
    if (hud.pausedShown) { e.preventDefault(); hud.showResume(true); this.requestLock(true); }   // menü → oyun (reddedilirse katman kalır)
  }

  togglePause() {
    if (this.ended) return;
    this.simulate = !this.simulate;
    this.hud.setPaused(!this.simulate);
  }

  // Menüdeki "kill": kendini öldür (sıkışınca/hızlı yeniden doğmak için)
  requestKill() {
    const me = this.playerSoldier;
    if (!me || !me.alive || this.ended) return;
    if (this.online) { this.online.send({ t: 'kill' }); return; }
    me.protT = 0; me.die(me, 'İntihar', false);
  }

  // 3. şahıs kamera yeterince çekilmişse gövdeni göster, silah modelini (1. şahıs) gizle
  get showSelf() { return !!this.player && this.player.bodyVisible; }

  respawnReady() { return !this.playerSoldier.alive && !this.ended; }
  requestClass(k) {
    this.pendingClass = k; this.hud.markClass(k); this.online?.send({ t: 'opt', cls: k });
    const lo = this.opts.loadouts?.[k], fl = this.opts.frontLoadouts?.[k];      // menüde o sınıf için kaydedilen silah/gadget seçimi (12.174: Cephe donanımı ayrı)
    this.requestLoadout({ ...(lo || {}), ...(fl ? { front: { ...fl } } : {}) });      // (kayıt yoksa sınıfın varsayılanı)
  }
  // 12.174 Cephe doğuş ekranı: sınıfın 1940'lar ana silahı / silahın dönem nişangâhı (menü → Cephanelik → Cephe ile aynı kayıt: frontLoadouts / frontOptics)
  frontPick(cls, w) {
    const fl = (this.opts.frontLoadouts ||= {});
    fl[cls] = { ...(fl[cls] || {}), primary: w };
    this.opts.onPref?.({ frontLoadouts: fl });
    if (cls === (this.pendingClass || this.playerSoldier.cls)) this.requestLoadout({ ...(this.opts.loadouts?.[cls] || {}), front: { ...fl[cls] } });
  }
  frontOptic(w, o) {
    const s = this.playerSoldier;
    if (!(OPTIC_ALLOWED[w] || []).includes(o) || !OPTICS[o]?.era && o !== 'iron') return;
    s.optics[w] = o;
    this.opts.frontOptics = { ...(this.opts.frontOptics || {}), [w]: o };
    this.opts.onPref?.({ frontOptics: this.opts.frontOptics });
    this.online?.send({ t: 'opt', fo: { [w]: o } });
    if (s.alive && s.item.id === w) { s.adsT = 0; s._syncWeaponModel(true); this.emit('switch', s); }
  }
  // Enfekte: bir sonraki doğuşta zombi türü
  requestZType(k) { this.pendingZ = k; this.hud.markZ?.(k); this.online?.send({ t: 'opt', zt: k }); }
  // Zombi gücü efekti + ses (sunucuda yalnızca olay yayımlanır)
  abilityFx(s, id, from) {
    this.netEvent({ e: 'ab', by: s.id, k: id, f: [+from.x.toFixed(1), +from.y.toFixed(1), +from.z.toFixed(1)], d: [+s.pos.x.toFixed(1), +s.pos.y.toFixed(1), +s.pos.z.toFixed(1)] });
    this.showAbilityFx(s, id, from, s.pos);
  }
  showAbilityFx(s, id, from, to = s.pos) {
    if (this.headless) return;
    const V = THREE.Vector3, cam = this.camera.position;
    if (s === this.playerSoldier && !this.player?.third) { this.sfx.zombie(s.pos, true); return; }      // kendi gücün 1. şahısta: kıvılcımlar yüzüne dolmasın, his abilityfx.js'te
    if (id === 'blink' || id === 'shadow') {
      const hi = (p, c) => { for (let i = 0; i < 3; i++) this.effects.spark(new V(p.x, p.y + 0.4 + i * 0.5, p.z), 10, new V(0, 1, 0), c, 5); };
      hi(from, '#c58cff'); hi(to, '#c58cff');
    } else if (id === 'cloak') this.effects.spark(new V(s.pos.x, s.pos.y + 1, s.pos.z), 14, new V(0, 1, 0), '#7ad7ff', 4);
    else if (id === 'shield') this.effects.spark(new V(s.pos.x, s.pos.y + 1, s.pos.z), 14, new V(0, 1, 0), '#ffb13c', 4);
    else this.effects.spark(new V(s.pos.x, s.pos.y + 1, s.pos.z), 14, new V(0, 1, 0), '#ff4b3a', 4);
    if (s.pos.distanceTo(cam) < 45) this.sfx.zombie(s.pos, true);
  }
  // Ölüm ekranında yükleme değiştir: { primary, secondary, gadget, melee } → bir sonraki doğuşta geçerli (sınıfa uymazsa varsayılan)
  requestLoadout(choice) { const me = this.playerSoldier; this.pendingLoadout = { ...choice }; this.online?.send({ t: 'opt', loadout: { ...choice, op: me?.optic, fo: me?.optics }, skins: me?.skins || null, wear: me?.wear || null }); }      // 12.174: op / fo = nişangâh tercihleri (sunucu doğrular)      // kaplamalar yükleme değişiminde yeniden gider (tek mesaj)

  // ───── doğma ─────
  // Oyuncu doğma noktası seçimi: 'base' ya da sahip olunan hedefin id'si
  spawnOptions(team = this.playerSoldier.team) {
    const out = [{ id: 'base', name: 'Üs', ok: true }];
    if (this.front) return out;                                                     // Cephe: ileri doğuş yok (doğuş hattı sektörle kayar)
    if (this.map.big) out.push({ id: 'front', name: 'Ön hat', ok: this.mode.objectives.some((o) => this.canForwardSpawn(o, team)), label: '▲' });   // 12.172 büyük harita: düşmana en yakın sahip olunan bayrak
    for (const o of this.mode.objectives) out.push({ id: o.id, name: o.name, ok: this.canForwardSpawn(o, team), label: o.label || o.name[0] });
    return out;
  }
  // klavyeyle doğma noktası seç: kullanılabilir seçenekler arasında ileri/geri
  cycleSpawn(step) {
    const ok = this.spawnOptions().filter((o) => o.ok);
    if (!ok.length) return;
    const i = Math.max(0, ok.findIndex((o) => o.id === this.spawnChoice));
    this.requestSpawn(ok[(i + step + ok.length) % ok.length].id);
    this.hud._spKey = null;
  }
  requestSpawn(id) { this.spawnChoice = id; this.hud.markSpawn?.(id); this.online?.send({ t: 'opt', spawn: id }); }

  // 12.172 ön hat: sahip olunan (doğulabilir) bayraklardan, sahibi olmadığı en yakın bayrağa en yakın olanı (ilk ikisinden rastgele)
  frontFlag(team, own = null) {
    own ||= this.mode.objectives.filter((o) => o.owner === team && this.canForwardSpawn(o, team));
    if (!own.length) return null;
    const other = this.mode.objectives.filter((o) => o.owner !== team);
    if (!other.length) return pick(own);
    const sc = own.map((o) => [o, Math.min(...other.map((q) => Math.hypot(q.x - o.x, q.z - o.z)))]).sort((a, b) => a[1] - b[1]);
    return sc[Math.random() < 0.7 || sc.length < 2 ? 0 : 1][0];
  }
  canForwardSpawn(o, team) {
    if (o.owner !== team) return false;
    for (const e of this.soldiers) if (e.alive && e.team !== team && Math.hypot(e.pos.x - o.x, e.pos.z - o.z) < o.r + 6) return false;
    return true;
  }

  // 12.184 hedefin kotu: harita veriyorsa o.y (Kuzey Vadisi Baraj bayrağı baraj tepesinde, 24 m), yoksa merkezdeki zemin. Ele geçirme alanı = yarıçap + bu kotun ±8 m'si
  // (eskiden hep arazi kotu: Baraj'da direğin yanındaki asker alamıyor, 23 m aşağıdaki kanyon tabanı alıyordu).
  objY(o) { return Number.isFinite(o.y) ? o.y : this.world.heightAt(o.x, o.z); }
  inObjective(p, o) { return Math.hypot(p.x - o.x, p.z - o.z) < o.r && Math.abs(p.y - this.objY(o)) < 8; }
  // 12.191 ele geçirme hızı (çubuk birimi / sn, + Mavi'ye): alandaki fark (en çok 3) × TUNE.captureRate (× Cephe çarpanı). updateMode ve HUD aynı işlevi kullanır.
  capRate(o, b = o.nb || 0, r = o.nr || 0) {
    if (this.front && !this.front.capturable(o)) return 0;
    return clamp(b - r, -3, 3) * TUNE.captureRate * (this.front ? this.front.capMul(o) : 1);
  }
  // Hedef alanında yürünür nokta (bot hedefi / ileri doğuş): alanın zemin kotu hedef kotundan ±3 m'den çok sapan yerleri varsa (Baraj: kanyon tabanı, göl)
  // yalnız hedef kotundaki hücreler; yoksa eskisi gibi dairede rastgele (null → çağıran kendisi seçer)
  objCells(o) {
    if (o._cells !== undefined) return o._cells;
    o._cells = null;
    if (!Number.isFinite(o.y) || !this.nav) return null;
    const nav = this.nav, c = nav.cell, out = []; let bad = 0;
    for (let z = o.z - o.r; z <= o.z + o.r; z += c) for (let x = o.x - o.r; x <= o.x + o.r; x += c) {
      if (Math.hypot(x - o.x, z - o.z) > o.r * 0.85 || !nav.isFree(x, z)) continue;
      if (Math.abs(this.world.groundAt(x, z) - o.y) <= 3) out.push([x, z]); else bad++;
    }
    if (bad && out.length) o._cells = out;
    return o._cells;
  }
  objPoint(o, k = 0.8) {
    const cl = this.objCells(o);
    if (cl) { const [x, z] = cl[Math.floor(Math.random() * cl.length)]; return { x: x + (Math.random() - 0.5) * this.nav.cell * 0.8, z: z + (Math.random() - 0.5) * this.nav.cell * 0.8 }; }
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * o.r * k;
    return { x: o.x + Math.cos(a) * r, z: o.z + Math.sin(a) * r };
  }

  _free(x, z, s) {
    if (!this.nav.isFree(x, z)) return false;
    if (this.nav.floor && this.nav.floorAt(x, z) > 0.3) return false;            // ileri doğuş platform / çatı hücresine düşmesin (doğuş y = 0: kutunun içinde kalırdı)
    if (this.world._hits(this.world.query(x - 1, z - 1, x + 1, z + 1, (this._fq ||= [])), x, this.world.groundAt(x, z) + 0.2, z, 1.6)) return false;   // 12.168: gövde duvara / eşyaya girmesin (boş hücrenin kenarı duvara 0,1 m yakın olabilir) · 12.184 tabliye üstünde tabliye kotunda
    return !this.soldiers.some((e) => e !== s && e.alive && Math.hypot(e.pos.x - x, e.pos.z - z) < 1.1);
  }

  // Herkes-tek (dm / gg / pb) doğuş havuzu: map.ffaSpawns varsa o, yoksa mavi doğuştan yürünerek ulaşılan alandan aralıklı noktalar. Hedef sayı yürünebilir alana göre (24–40);
  // 14 m aralık yetmezse (Depo / Liman gibi 60 m'lik harita: eskiden 20'nin altında kalıp İKİ TAKIM AVLUSUNA düşüyordu) aralık 6 m'ye kadar daralır. Her nokta: zemin kotunda, çarpışma kutusu dışında, çevresi açık, çıkmaz sokak değil.
  ffaPool() {
    const nav = this.nav, base = this.map.spawns.blue[0], seen = nav.reachable(base.x, base.z);
    const T = this.terrain, gnd = (i) => (T ? T.heightAt(nav.cx(i), nav.cz(i)) : 0);      // hücre zemini (nav'ın kullandığı arazi örneği)
    const freeAt = (x, z) => nav.isFree(x, z) && (!nav.floor || nav.floorAt(x, z) - gnd(nav.idx(x, z)) < 0.3);
    const tmp = [];
    const ok = (p) => {
      if (!freeAt(p.x, p.z)) return false;                                                  // katmanlı haritada platform / çatı hücresi değil (doğuş y = 0)
      if (this.world._hits(this.world.query(p.x - 1, p.z - 1, p.x + 1, p.z + 1, tmp), p.x, this.world.heightAt(p.x, p.z) + 0.05, p.z, 1.7)) return false;   // gövde hiçbir kutuya girmiyor
      let free = 0, n = 0;                                                                   // 2,5 m çevrenin en az %55'i açık
      for (let dz = -2.5; dz <= 2.5; dz += 0.5) for (let dx = -2.5; dx <= 2.5; dx += 0.5) if (dx * dx + dz * dz <= 6.25) { n++; if (freeAt(p.x + dx, p.z + dz)) free++; }
      if (free < n * 0.55) return false;
      let open = 0;                                                                          // 8 yönden en az 3'ünde 4 m açık (çıkmaz / dar cep değil)
      for (let a = 0; a < 8; a++) { let r = 0.5; while (r <= 4 && freeAt(p.x + Math.cos(a * 0.785) * r, p.z + Math.sin(a * 0.785) * r)) r += 0.5; if (r > 4) open++; }
      return open >= 3;
    };
    if (this.map.ffaSpawns?.length) return this.map.ffaSpawns.map((p) => ({ x: p.x, z: p.z, y: p.y, ry: p.ry }));     // harita kendi noktalarını verirse olduğu gibi (Boya Kulesi: kale güvertesi y'li; platform testine girmez)
    let cells = 0; for (let i = 0; i < seen.length; i++) if (seen[i] && (!nav.floor || nav.floor[i] - gnd(i) < 0.3)) cells++;
    const want = Math.max(24, Math.min(40, Math.round(cells * 0.25 / 80)));                // ≈ 80 m² yürünebilir alana bir nokta
    let best = [];
    for (const spacing of [14, 12, 10, 9, 8, 7, 6]) {
      const pool = nav.spreadPoints(seen, { spacing, max: 160 }).filter(ok);
      if (pool.length > best.length) best = pool;
      if (pool.length >= want) break;
    }
    return best.map((p) => ({ ...p, ry: 0 }));
  }

  // Doğuşta bakış: 16 yönden en uzun açık olanı (20 m'ye kadar), eşitlikte harita merkezine yakın olan; duvara bakarak doğulmaz
  openYaw(x, z) {
    const b = this.map.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, ca = Math.atan2(cz - z, cx - x);
    let best = ca, bs = -1;
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, dx = Math.cos(a), dz = Math.sin(a);
      let r = 0.5; while (r < 20 && this.nav.isFree(x + dx * r, z + dz * r)) r += 0.5;
      const sc = r + 3 * Math.cos(a - ca) + Math.random() * 2;
      if (sc > bs) { bs = sc; best = a; }
    }
    return Math.atan2(-Math.cos(best), -Math.sin(best));
  }

  pickSpawn(team, s) {
    if (this.ffa) {
      // Herkes-tek: havuzun her noktası puanlanır = canlı rakiplere en yakın uzaklık (30 m'de doyar) − son doğuşlara yakınlık cezası + biraz rastgelelik;
      // en iyi adaylar görüş testinden geçer (55 m içindeki bir rakip görüyorsa ağır ceza): uzak, görünmeyen, son kullanılmamış nokta seçilir
      const pts = this.map.spawns[team] || this.map.spawns.f0, others = this.soldiers.filter((e) => e !== s && e.alive), now = this.time || 0;
      const recent = (this._ffaRecent ||= []);
      const cands = [];
      for (const p of pts) {
        let dmin = 1e9;
        for (const e of others) dmin = Math.min(dmin, Math.hypot(e.pos.x - p.x, e.pos.z - p.z));
        if (dmin < 1.3) continue;
        let pen = 0;
        for (const r of recent) { const d = Math.hypot(r.x - p.x, r.z - p.z), age = now - r.t; if (age < 15 && d < 10) pen += (10 - d) * 2.5 * (1 - age / 15); }
        cands.push({ p, dmin, sc: Math.min(dmin, 30) - pen + Math.random() * 6 });
      }
      cands.sort((a, b) => b.sc - a.sc);
      const eye = (this._spE ||= new THREE.Vector3()), tgt = (this._spT ||= new THREE.Vector3());
      let best = null, bs = -1e9;
      for (const c of cands.slice(0, 12)) {
        tgt.set(c.p.x, 1.4, c.p.z);
        const seen = others.some((e) => Math.hypot(e.pos.x - c.p.x, e.pos.z - c.p.z) < 55 && this.botSees(e.eye(eye), tgt));
        const sc = c.sc - (seen ? 45 : 0);
        if (sc > bs) { bs = sc; best = c.p; }
        if (!seen && c.dmin >= 14) break;                                            // sıralı listede ilk uzak + görünmeyen yeterli
      }
      const p = best || pick(pts);
      recent.push({ x: p.x, z: p.z, t: now }); if (recent.length > 8) recent.shift();
      return { x: p.x, z: p.z, y: p.y, ry: p.ry ?? this.openYaw(p.x, p.z) };     // y: kat doğuşu (Boya Kulesi kale güverteleri)
    }
    // ileri doğma: seçilen / bot için ara sıra sahip olunan hedefin çevresi
    let target = null;
    const ctl = s ? this.ctlOf(s) : null;
    if (ctl && ctl.spawnChoice === 'front') target = this.front ? null : this.frontFlag(team);
    else if (ctl && ctl.spawnChoice !== 'base') target = this.front ? null : this.mode.objectives.find((o) => o.id === ctl.spawnChoice);
    else if (s && !ctl && !this.front && Math.random() < (this.map.big ? 0.9 : 0.35)) {                 // 12.172 büyük harita: botlar çoğunlukla ön hattan doğar
      const own = this.mode.objectives.filter((o) => o.owner === team && this.canForwardSpawn(o, team));
      if (own.length) target = this.map.big ? (spawnFlagBig(this, s, own) || (Math.random() < 0.5 ? this.frontFlag(team, own) : null)) : pick(own);      // 12.189: mangal hedefine en yakın bayrak (yoksa yarı yarıya ön hat / üs: araç)
    }
    if (target && this.canForwardSpawn(target, team)) {
      const cl = this.objCells(target);                                             // 12.184 alan kotu karışıksa (Baraj) yalnız hedef kotundaki hücreler
      for (let k = 0; k < 14; k++) {
        const a = Math.random() * Math.PI * 2, rr = target.r * (0.25 + Math.random() * 0.6);
        const { x, z } = cl ? this.objPoint(target) : { x: target.x + Math.cos(a) * rr, z: target.z + Math.sin(a) * rr };
        if (this._free(x, z, s)) return { x, z, ry: Math.atan2(-(target.x - x), -(target.z - z)) + (Math.random() - 0.5) * 3, forward: true };
      }
    }
    const pts = this.map.spawns[team];
    const free = pts.filter((p) => !this.soldiers.some((e) => e !== s && e.alive && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 1.3));
    if (free.length) return pick(free);
    // noktalar dolu (kalabalık maç): rastgele bir noktanın çevresinde boş yer bul
    const base = pick(pts);
    for (let k = 0; k < 20; k++) {
      const x = base.x + (Math.random() - 0.5) * 9, z = base.z + (Math.random() - 0.5) * 9;
      if (this._free(x, z, s)) return { x, z, ry: base.ry };
    }
    return base;
  }

  // oyuncu (offline) ya da insan (sunucu) için doğuş tercihleri; botlar için null
  ctlOf(s) { return s.isPlayer ? this : this.humans.get(s.id) || null; }

  respawn(s, first = false) {
    if (this.mode.infection) { if (s.infectNext) this.infect(s); else if (s.willCure) this.cure(s); }
    const ctl = this.ctlOf(s);
    if (ctl && ctl.queue) { ctl.queue.length = 0; ctl.budget = 1; ctl.backlog = 0; ctl.qMin = 99; }        // insan: doğmadan önceki eski girdiler (örn. eski silah seçimi) uygulanmasın
    if (ctl && ctl.pendingLoadout) { s.choice = ctl.pendingLoadout; ctl.pendingLoadout = null; if (!this.mode.fixed) s.items = s.loadout(); }
    if (ctl && ctl.pendingClass && ctl.pendingClass !== s.cls && !s.def.zombie && !this.mode.fixed) s.setClass(ctl.pendingClass);      // sabit teçhizatlı modda (silah yarışı / paintball) sınıf değişmez
    if (s.def.zombie) {                                                // yeniden doğan zombi: seçtiği tür; botlar her doğuşta rastgele
      const want = s.boss ? null : ctl ? ctl.pendingZ : randomZType();
      if (want && want !== s.ztype) { s.ztype = want; s.setClass('zombie'); }
      if (ctl) ctl.pendingZ = null;
    }
    const pt = s.def.zombie && this.infPool ? this.pickZombieSpawn(s, first) : this.pickSpawn(s.team, s);
    s.spawn(pt, first ? TUNE.firstProtect : TUNE.spawnProtect);
    this.world.settle(s);
    if (pt.y > s.pos.y + 0.3) s.pos.y = pt.y;                          // kat doğuşu (kale güvertesi): settle yalnız zemine / alçak engele oturtur
    s.zoneT = 0;
    if (s.brain) s.brain.reset();
    if (ctl) ctl.pendingClass = null;
    if (s.isPlayer) this.hud.onPlayerSpawn?.();
  }

  // ───── düşme hasarı (12.143; tablo: sim/fall.js) ─────
  // YETKİLİ taraf (çevrimdışı oyun / sunucu) uygular: World.move inişte s.landH'yi yazar. Koruma / ölümsüzlük takeDamage'daki gibi; saldıran yok
  // (botun onDamaged'ı tetiklenmez, isabet işareti yok). Ölürse "Düştü": kendi kendine, puan kimseye (İntihar / Kuyu ile aynı akış).
  fallCheck(s) {
    const h = s.landH;
    if (!(h > FALL.safe) || !s.alive || !fallApplies(s, this.mode)) return;
    if (s.protT > 0 || (s.isPlayer && this.devGod)) return;
    const dmg = fallDamage(h);
    if (dmg <= 0) return;
    s.hp -= dmg; s.lastDmgT = this.time; s.useT = 0;
    if (s.isPlayer) this.fallFx(dmg);
    else if (s.human) this.netEvent({ e: 'fall', v: s.id, d: dmg, h: +h.toFixed(1) });
    this.emit('fall', { s, h, dmg });
    if (s.hp <= 0) { s.lastHit = s; s.die(s, 'Düştü', false); }
  }

  // Çevrimiçi istemci: aynı tabloyla iniş anında tahmin (geri bildirim + can göstergesi); sunucu bu girdiyi onaylayınca (ack ≥ q) can sunucudan gelir
  // (NetClient.reconcile), çift düşülmez. Ölüm kararı yalnız sunucuda.
  fallPredict(me) {
    const h = me.landH;
    if (!(h > FALL.safe) || !fallApplies(me, this.mode) || me.protected || this.devGod) return;
    const dmg = fallDamage(h);
    if (dmg <= 0) return;
    this.online.fallPred = { q: this.online.seq + 1, dmg };              // iniş, bir sonraki gönderilecek girdinin sunucu adımında olur (önce hareket, sonra girdi)
    me.hp = Math.max(1, me.hp - dmg);
    this.fallFx(dmg);
  }

  // Uzlaştırmada yeniden oynatılan adımda iniş (NetClient.reconcile): tahmini o girdiye bağla; geri bildirim son 1 sn'de verilmediyse şimdi
  fallReplay(me, q) {
    const h = me.landH;
    const dmg = h > FALL.safe && fallApplies(me, this.mode) && !me.protected && !this.devGod ? fallDamage(h) : 0;
    if (dmg <= 0) { if (this.online.fallPred?.q === q) this.online.fallPred = null; return; }
    this.online.fallPred = { q, dmg };
    if (!(this.time - (this._fallFxAt ?? -9) < 1)) this.fallFx(dmg);
  }

  // ───── 12.180 nefes / boğulma (kural: sim/swim.js breathTick) ─────
  // YETKİLİ taraf (çevrimdışı oyun / sunucu) uygular: başı su altındaki savaşçının nefesi (18 sn) biterse her saniye 10 can. Saldıran yok (düşme gibi);
  // doğuş koruması / geliştirici ölümsüzlüğü korur. Ölürse "Boğuldu" (kendi kendine; son 5 sn'de vuran düşman varsa öldürme ona, 12.165).
  swimCheck(s, dt) {
    const d = breathTick(s, dt);
    if (d <= 0 || !s.alive || s.protT > 0 || (s.isPlayer && this.devGod)) return;
    s.hp -= d; s.lastDmgT = this.time;
    if (s.isPlayer) this.drownFx(d);
    else if (s.human) this.netEvent({ e: 'drown', v: s.id, d });
    this.emit('drown', { s, dmg: d });
    if (s.hp <= 0) { s.lastHit = s; s.die(s, 'Boğuldu', false); }
  }
  // Çevrimiçi istemci: nefes göstergesi + boğulma geri bildirimi aynı kuraldan tahmin edilir; can sunucudan gelir (tahminle düşülmez)
  swimPredict(me, dt) {
    const d = breathTick(me, dt);
    if (d > 0 && !me.protected && !this.devGod) this.drownFx(d);
  }
  drownFx(dmg) {
    if (this.headless) return;
    this._drownFxAt = this.time;
    this.effects.shake = Math.max(this.effects.shake, 0.25);
    this.hud.damageFrom(null, this.playerSoldier);
    this.sfx.drown?.();
  }

  // İniş darbesi: kısa kamera sarsıntısı + hasar sesi + genel (yönsüz) kırmızı kenar
  fallFx(dmg) {
    if (this.headless) return;
    this._fallFxAt = this.time;
    this.effects.shake = Math.max(this.effects.shake, clamp(0.25 + dmg / 80, 0.3, 1));
    this.hud.damageFrom(null, this.playerSoldier);
    this.sfx.hurt();
  }

  // Kuyu (map.voidY altına düşen) elenir: ölüm sayılır; son 5 sn içinde biri vurduysa öldürme ona yazılır ("düşürdü"), yoksa kendi düştü
  updateVoid() {
    for (const s of this.soldiers) {
      if (!s.alive || s.fly || s.pos.y > this.map.voidY) continue;
      const k = s.lastHit && s.lastHit !== s && s.lastHit.team !== s.team && this.time - s.lastDmgT < 5 ? s.lastHit : null;
      s.protT = 0;
      s.die(k || s, k ? 'Kuyuya düşürdü' : 'Kuyuya düştü', false);
      if (s.isPlayer && !this.headless) this.hud.toast(k ? $t('hud.t.pitBy', { k: k.name }) : $t('hud.t.pit'), '#ff8a6a');
    }
  }

  // Düşman üssüne giren: uyarı + hasar (spawn baskınını engeller)
  // 12.172 savaş alanı sınırı (büyük harita; sert sınırın yerine): map.playArea dışında geri sayım (playArea.t, varsayılan 10 sn), bitince ölüm.
  // Yetkili taraf (çevrimdışı / sunucu) öldürür; çevrim içi istemci yalnız kendi göstergesini hesaplar. Yükseklik sınırı yok (ileride hava araçları da aynı kural).
  updatePlayArea(dt) {
    const A = this.map.playArea;
    if (!A) return;
    const T = A.t ?? 10;
    for (const s of this.soldiers) {
      if (this.online && s !== this.playerSoldier) continue;
      const out = s.alive && (s.pos.x < A.minX || s.pos.x > A.maxX || s.pos.z < A.minZ || s.pos.z > A.maxZ);
      if (!out) { s.oobT = 0; continue; }
      s.oobT = (s.oobT || 0) + dt;
      if (s.isPlayer) this.hud.oobWarn?.(Math.max(0, T - s.oobT));
      if (!this.online && s.oobT >= T && !(s.isPlayer && this.devGod)) { s.lastHit = s; s.hp = 0; s.die(s, 'Savaş alanı', false); s.oobT = 0; }
    }
  }
  updateBaseZones(dt) {
    const Z = this.map.baseZones;
    if (!Z) return;
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const z = Z[s.team === 'blue' ? 'red' : 'blue'];
      const inside = z && s.pos.x > z.minX && s.pos.x < z.maxX && s.pos.z > z.minZ && s.pos.z < z.maxZ;
      if (!inside) { if (s.zoneT > 0) s.zoneT = Math.max(0, s.zoneT - dt * 2); continue; }
      s.zoneT = (s.zoneT || 0) + dt;
      if (s.isPlayer) this.hud.zoneWarn?.(Math.max(0, 6 - s.zoneT));
      if (s.zoneT > 6 && s.protT <= 0) { s.hp -= 30 * dt; if (s.hp <= 0) s.die(s, 'Düşman üssü', false); }
    }
  }

  // ───── canlandırma (ilk yardım çantasıyla yakındaki dost cesedi) ─────
  canRevive(v, medic) {
    return !v.alive && v.revivable && v.deadT < 14 && v.team === medic.team && !this.ended
      && Math.hypot(v.pos.x - medic.pos.x, v.pos.z - medic.pos.z) < 3.4;
  }
  findRevivable(medic) {
    let best = null, bd = 2.8;
    for (const v of this.soldiers) {
      if (v.alive || !v.revivable || v.deadT >= 14 || v.team !== medic.team) continue;
      const d = Math.hypot(v.pos.x - medic.pos.x, v.pos.z - medic.pos.z);
      if (d < bd && Math.abs(v.pos.y - medic.pos.y) < 2.2) { bd = d; best = v; }
    }
    return best;
  }
  nearestCorpse(medic, range) {
    let best = null, bd = range;
    for (const v of this.soldiers) {
      if (v.alive || !v.revivable || v.deadT >= 9 || v.team !== medic.team) continue;
      const d = Math.hypot(v.pos.x - medic.pos.x, v.pos.z - medic.pos.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  revive(v, medic) {
    const at = { x: v.pos.x, z: v.pos.z, ry: v.yaw };
    v.spawn(at, 2.5);
    this.world.settle(v);
    v.hp = v.maxHp * TUNE.reviveHp;
    v.revivable = false;
    this.tickets[v.team] += 1;                                                    // canlandırma bileti geri verir (Cephe dahil: 12.161'den beri iki tarafta bilet)
    if (v.brain) v.brain.reset();
    medic.score += 80;
    if (v.isPlayer) { this.pendingClass = null; this.hud.onPlayerSpawn?.(); this.hud.toast($t('hud.t.revivedBy', { n: medic.name }), '#9be07f'); }
    if (medic.isPlayer) { this.hud.popup('+80 CANLANDIRMA'); this.hud.toast($t('hud.t.revived', { n: v.name }), '#9be07f'); }
    this.effects.spark?.(v.pos.clone().setY(v.pos.y + 1), 6, new THREE.Vector3(0, 1, 0));
  }

  // ───── mangal görev dağıtımı: her mangal bir hedefe; takım dengesi + tehdit/ihtiyaç ─────
  squadGoal(s) { return this.squadGoals[s.team]?.[s.squad] || null; }

  assignSquads() {
    const objs = this.front ? this.front.activeList() : this.mode.objectives;  // Cephe: yalnız etkin nokta
    if (!objs.length) return;
    if (this.map.big && !this.front) { assignSquadsBig(this); return; }       // 12.189 büyük harita: cephe görevleri (bigBots.js)
    for (const team of ['blue', 'red']) {
      const nSq = Math.ceil(this.soldiers.filter((s) => s.team === team).length / 4);
      const load = new Map(objs.map((o) => [o.id, 0]));
      const home = this.map.spawns[team][0];
      const need = (o) => {
        const enemies = this.soldiers.filter((e) => e.alive && e.team !== team && Math.hypot(e.pos.x - o.x, e.pos.z - o.z) < o.r + 18).length;
        if (o.owner === team) return enemies ? 1.5 : 0.18;
        return o.owner ? 1.25 : 1.0;
      };
      const order = [...Array(nSq).keys()].sort(() => Math.random() - 0.5);
      const big = this.map.big;
      for (const sq of order) {
        let best = null, bs = -1;
        // 12.172 büyük harita: uzaklık mangalın bugünkü konumundan (üsten değil) ve daha geniş ölçekte; eski hedefe bağlılık (yolun yarısında hedef değişmesin)
        let from = home;
        if (big) { const m = this.soldiers.filter((e) => e.alive && e.team === team && e.squad === sq); if (m.length) from = { x: m.reduce((a, e) => a + e.pos.x, 0) / m.length, z: m.reduce((a, e) => a + e.pos.z, 0) / m.length }; }
        const prev = this.squadGoals[team][sq];
        for (const o of objs) {
          const d = Math.hypot(o.x - from.x, o.z - from.z);
          const sc = need(o) / (1 + load.get(o.id) * 1.7) / (1 + d / (big ? 420 : 260)) + Math.random() * 0.2 + (big && prev === o && o.owner !== team ? 0.35 : 0);
          if (sc > bs) { bs = sc; best = o; }
        }
        this.squadGoals[team][sq] = best;
        load.set(best.id, load.get(best.id) + 1);
      }
    }
  }

  // Keskin nişancı gözetleme noktası: hedefi gören, yüksek/uzak, kendi tarafa yakın nokta
  perch(o, team) {
    if (this.map.big) return perchBig(this, o, team);                        // 12.189: büyük haritada tepe noktası (60–160 m, bot görüşüyle)
    const key = o.id + team;
    if (this.perchCache.has(key)) return this.perchCache.get(key);
    const home = this.map.spawns[team][0];
    let best = null, bs = -1e9;
    const oy = this.objY(o), oc = new THREE.Vector3(o.x, oy + 1.3, o.z), pe = new THREE.Vector3();
    for (let k = 0; k < 90; k++) {
      const a = Math.random() * Math.PI * 2, d = 26 + Math.random() * 40;
      const x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d;
      if (!this.nav.isFree(x, z)) continue;
      const y = this.world.heightAt(x, z);
      pe.set(x, y + 1.0, z);
      if (!this.world.clear(pe, oc)) continue;
      const sc = (y - oy) * 0.6 + d * 0.05 - Math.hypot(x - home.x, z - home.z) * 0.03 + Math.random();
      if (sc > bs) { bs = sc; best = { x, z }; }
    }
    this.perchCache.set(key, best);
    return best;
  }

  // ───── ana döngü ─────
  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = this.frameDt(now);
    this.last = now; this._rdt = dt;
    this.perfTick(now, dt);
    if (this.online && !this.ended) {
      // çevrimiçi: sunucuyla aynı sabit adım (tahmin birebir tutsun)
      this._acc = Math.min(this._acc + dt, 0.1);
      while (this._acc >= SIM_DT) { this._acc -= SIM_DT; this.stepOnline(SIM_DT); }
      // Görüntü her karede yeniden hesaplanır (adım sayısı kareden kareye 0/1/2 oynasa da akıcı kalsın):
      // diğer oyuncular o anki zamana göre interpolasyonla, yerel kamera iki sim adımı arasında ara değerlenir.
      this.online.interpolate(performance.now());
      const alpha = this._acc / SIM_DT, me = this.playerSoldier, a = this._p0, b = this._p1, vo = this.online.viewOff;
      for (const s of this.soldiers) {
        if (s === me && a && me.alive && this.modelLerp !== false) {                               // yerel karakter modeli de kamerayla aynı ara değerleme + düzeltme yumuşatmasıyla çizilir
          const sx = me.pos.x, sy = me.pos.y, sz = me.pos.z;
          me.pos.set(a.x + (b.x - a.x) * alpha + vo.x, a.y + (b.y - a.y) * alpha + vo.y, a.z + (b.z - a.z) * alpha + vo.z);
          s.syncModel(dt);
          me.pos.set(sx, sy, sz);
        } else s.syncModel(dt);
      }
      this.lerpCamera(alpha);
    } else if (this.simulate && !this.ended) this.step(dt);
    else if (this.ended) { this.effects.update(dt); for (const s of this.soldiers) s.syncModel(dt); }
    this.render();
  }

  // Kamera, son iki sim adımı arasında ara değerlenir (alpha = adım içindeki ilerleme)
  lerpCamera(alpha) {
    const c = this.camera, a = this._c0, b = this._c1;
    if (!a || !this.playerSoldier.alive) return;
    c.position.lerpVectors(a.p, b.p, alpha);
    c.quaternion.slerpQuaternions(a.q, b.q, alpha);
  }

  // 12.151: kare adımı yumuşatma. Firefox'ta rAF zaman damgası ~1 ms (parmak izi direnci / LibreWolf / Mullvad'da 16,7 ms) kuantalı: 60 Hz'de
  // 16,7 / 33,3 / 0 ms dizisi kamerayı ve modelleri bir kare iki adım, bir kare hiç ilerletir (titreme = "donma" hissi). Adım, ortalama kare süresine
  // yakın tutulur; gerçek zamanla fark (borç) her karede %15 kapatılır (uzun vadede toplam süre aynı). Gerçek takılmada (> 100 ms) eski davranış.
  frameDt(now) {
    const raw = (now - this.last) / 1000;
    if (!(raw > 0) || raw > 0.1 || !this._ema) { if (raw > 0 && raw <= 0.1) this._ema = raw; this._debt = 0; return clamp(raw || 0.016, 0, 0.05); }
    this._ema += (raw - this._ema) * 0.1;
    this._debt = clamp(this._debt + raw, -0.05, 0.25);
    const d = clamp(this._ema + (this._debt - this._ema) * 0.15, 0, 0.05);
    this._debt -= d;
    return d;
  }

  // Tuval çizim tamponu sürücü sınırını aşmasın (Firefox parmak izi direnci MAX_VIEWPORT_DIMS'i 4096'ya indirir; aşınca görüntü kırpılır / bulanır)
  fitRatio(pr) {
    if (!this._maxDim) { const gl = this.renderer.getContext(), v = gl.getParameter(gl.MAX_VIEWPORT_DIMS); this._maxDim = Math.min(v[0], v[1], gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) * 2) || 4096; }
    return Math.max(0.5, Math.min(pr, this._maxDim / Math.max(1, innerWidth), this._maxDim / Math.max(1, innerHeight)));
  }

  // FPS ölçümü + uyarlanabilir çözünürlük: ortalama kare süresi uzun sürerse çözünürlük kademeli düşer, rahatlayınca geri yükselir (en çok seçilen kaliteye kadar)
  perfTick(now, dt) {
    const p = (this._perf ||= { n: 0, t: 0, fps: 0, ratio: null, max: 0, cool: 0 });
    if (dt > 0.2 || document.visibilityState !== 'visible') { p.n = 0; p.t = 0; return; }       // duraklatma/sekme değişimi sayılmaz
    p.n++; p.t += dt;
    if (p.t < 1.2) return;
    p.fps = p.n / p.t; const ms = (p.t / p.n) * 1000; p.n = 0; p.t = 0;
    const r = this.renderer;
    if (p.ratio === null) { p.max = this.fitRatio(Math.min(devicePixelRatio, this.settings.pixelRatio || 1.5)); p.ratio = p.max; }
    p.vs = !p.vs || ms < p.vs ? ms : p.vs + (ms - p.vs) * 0.02;                                          // ekran yenileme süresi tahmini (60 Hz'de ~16,7 ms)
    if (this.settings.adaptive === false) return;
    if (p.cool > 0) { p.cool--; return; }
    let want = p.ratio;
    const mob = !!this.player?.touch;
    if (mob) {
      // Telefon: ekran 60 Hz'e kilitli (kare ≥ 16,7 ms). Eski taban 0,75× (DPR 3'te 932x430 ekrana 699x322 çizim) 30-35 FPS'lik telefonda kalıcı
      // bulanık / pikselli görüntü demekti. Şimdi sabit adımlar (0,25×), taban DPR ≥ 2'de 1,25× (ekran pikselinin 1,25 katı; MSAA ile keskin);
      // 1×'e yalnız tabanda bile < 24 FPS sürerse (3 ölçüm ≈ 3,6 sn) iner. < 36 FPS düşür, ≥ 57 FPS yükselt; düşüşten sonra ~7 sn yükseltme yok.
      const floor = Math.min(p.max, devicePixelRatio >= 2 ? 1.25 : 1), low = Math.min(p.max, 1);
      p.slow = ms > 41.5 && p.ratio <= floor + 0.01 ? (p.slow || 0) + 1 : 0;
      if (ms > 28 && p.ratio > floor + 0.01) { want = Math.max(floor, p.ratio - 0.25); p.hold = 6; }
      else if (p.slow >= 3 && p.ratio > low + 0.01) { want = low; p.hold = 6; p.slow = 0; }
      else if (p.hold > 0) p.hold--;
      else if (ms < 17.5 && p.ratio < p.max) want = Math.min(p.max, p.ratio + 0.25);
    } else if (ms > 25 && p.ratio > 0.6) { want = Math.max(0.6, p.ratio * 0.85); p.hold = Math.min(40, 8 * (1 + (p.drops = (p.drops || 0) + 1))); }   // masaüstü: < 40 FPS düşür
    else if (p.hold > 0) p.hold--;
    else if ((ms < 13.5 || ms < p.vs * 1.12) && p.ratio < p.max) want = Math.min(p.max, p.ratio * 1.12);     // rahat: geri yükselt. 12.151: 60 Hz ekranda kare hiç 13,5 ms'nin altına inmez → eskiden çözünürlük bir kez düşünce hiç geri gelmezdi; artık yenileme hızına dayanmışsa (≈ tavan) yükselir, düşüşten sonra 10–48 sn bekler (salınım olmasın)
    if (Math.abs(want - p.ratio) > 0.01) {
      p.ratio = want; p.cool = 1;
      r.setPixelRatio(want); r.setSize(innerWidth, innerHeight, false);
    }
  }

  // Çevrimiçi istemci adımı: yalnızca yerel oyuncuyu tahmin eder; diğerleri sunucudan interpolasyonla gelir.
  // Sıra sunucuyla aynı: (güncelle + hareket) sonra girdi → vel.
  stepOnline(dt) {
    this.time += dt;
    this.online.interpolate(performance.now());
    if (this._badge && (this._badgeT -= dt) <= 0) { this._badgeT = 0.5; const rtt = Math.round(this.online.stats.rtt || 0); this._badge.innerHTML = `ODA <b style="color:#ffb347">${this._badgeCode}</b> · ${rtt ? rtt + ' ms' : '…'} · ${Math.round(this._perf?.fps || 0)} FPS`; }
    const me = this.playerSoldier;
    for (const s of this.soldiers) s.update(dt);
    if (me.alive) { if (me.veh) this.vehicles.place(me); else { this.world.move(me, dt); this.vehicles?.pushSoldier(me); this.fallPredict(me); this.swimPredict(me, dt); } } else if (me.respawnT > 0) me.respawnT -= dt;
    this.updatePlayArea(dt);
    this.player.update(dt);
    { const m = this.playerSoldier.pos; if (!this._p0) { this._p0 = m.clone(); this._p1 = m.clone(); } else { const t = this._p0; this._p0 = this._p1; this._p1 = t; t.copy(m); } }       // yerel karakter konumu: son iki adım
    {                                                                                             // kamera ara değerleme için son iki adım (nesne yeniden kullanılır)
      const c = this.camera;
      if (!this._c0) { this._c0 = { p: c.position.clone(), q: c.quaternion.clone() }; this._c1 = { p: c.position.clone(), q: c.quaternion.clone() }; }
      const t = this._c0; this._c0 = this._c1; this._c1 = t; t.p.copy(c.position); t.q.copy(c.quaternion);
    }
    this.updateProjectiles(dt);
    this.vehicles?.clientShells(dt);                // 12.178 tank mermisi uçuşu (görsel; isabet sunucudan)
    this.paint.update(dt);
    this.pickups.update(dt);
    updateGadgets(this, dt, this.time);
    this.payload?.netFrame(dt);
    this.effects.update(dt);
    this.hud.update(dt);
    this.payload?.frame(dt);
    this.front?.frame(dt);
  }

  step(dt) {
    this.time += dt;
    this.pathBudget = 1;
    const V = this.vehicles;
    for (const s of this.soldiers) {
      if (s.human && s.alive) continue;            // canlı insanlar girdi güdümlü (updateHumans)
      s.update(dt);
      if (s.veh) V.place(s);                       // 12.177: koltuktaki asker yürümez, aracın koltuğunda durur
      else if (s.alive) { this.world.move(s, dt); V?.pushSoldier(s); this.fallCheck(s); this.swimCheck(s, dt); }
    }
    if (this.player) this.player.update(dt); else this.updateHumans(dt);
    for (const b of this.brains) b.update(dt);
    V?.update(dt);                                 // 12.177: sürücüsüz araç fiziği, hasar / yanma / batma, yeniden doğuş, yayaya çarpma, koltuk yerleşimi
    this.updateProjectiles(dt);
    this.paint.update(dt);
    this.pickups.update(dt);
    updateGadgets(this, dt, this.time);
    this.squadT -= dt;
    if (this.squadT <= 0) { this.squadT = this.map.big ? 12 : 18; this.assignSquads(); }      // 12.189 büyük harita: 40 → 12 sn (görev değişmezse botların hedefi değişmez)
    this.weather.update(dt);
    this.updateMode(dt);
    this.updateBaseZones(dt);
    this.updatePlayArea(dt);
    if (this.map.voidY != null) this.updateVoid();
    for (const s of this.soldiers) {
      if (!s.alive && !this.ended && !s.vacant) {
        s.respawnT -= dt;
        if (s.respawnT <= 0) this.respawn(s);
      }
    }
    this.effects.update(dt);
    for (const s of this.soldiers) s.syncModel(dt);
    this.hud.update(dt);
    this.payload?.frame(dt);
    this.front?.frame(dt);
    if (this.headless) { this.tick++; this.recordHist(); }
  }

  netEvent(ev) { if (this.headless) this.netEvents.push(ev); }

  // 12.187: nokta birinci şahıstaki yerel oyuncunun gövdesinde mi (kendi kanı kameranın dibinde ekranı kaplayan kırmızı kutular olarak çiziliyordu;
  // isabeti hasar göstergesi / ekran kızarması anlatır). Sunucu atış anında hedefi geri sardığından yatayda 1,2 m pay. 3. şahısta kan görünür.
  ownBody(p) {
    const me = this.playerSoldier;
    if (!me || !me.alive || this.showSelf) return false;
    return Math.hypot(p.x - me.pos.x, p.z - me.pos.z) < 1.2 && p.y > me.pos.y - 0.3 && p.y < me.pos.y + 2.2;
  }

  // ───── çevrimiçi istemci: sunucu olayları ─────
  onNetEvents(list) {
    const me = this.playerSoldier, V = THREE.Vector3;
    for (const ev of list) {
      const by = this.soldiers[ev.by];
      switch (ev.e) {
        case 'sh': {                                  // başkasının atışı: iz, kıvılcım/kan, namlu alevi, ses
          if (!by || by === me) break;
          const st = (ev.vm ? VT.tank.mg : WSTATS[by.item.id]) || {}, p = new V(...ev.p);      // vm: 12.178 tank makinelisi
          // 12.187: iz / alev atıcının GÖRÜNEN namlusundan. Sunucunun namlusu (ev.o) atıcının şimdiki yeri; burada atıcı interpolasyonla ~100–250 ms
          // geride çizilir → yana yürüyerek ateş edenin izi silahının 0,6–1,4 m yanından çıkıyordu. Vuruş noktası (p) aynı kalır.
          let o = new V(...ev.o);
          if (!ev.vm && by.alive && by.model?.weapon && o.distanceToSquared(by.pos) < 25) o = by.muzzleWorld(new V());
          const dir = p.clone().sub(o).normalize();
          this.effects.tracer(o, p, st.tracer);
          if (ev.k === 'f' && !this.ownBody(p)) this.effects.blood(p, 7, dir.clone().negate());
          else if (ev.k === 'w' && ev.ws) this.effects.splash(p);                                                       // 12.180 suya isabet
          else if (ev.k === 'w') { const n = new V(...ev.n); if (ev.vh) this.effects.spark(p, 6, n, '#ffe7b0'); else { this.effects.spark(p, 4, n); this.effects.dust(p, n); this.effects.decal(p, n); } }      // vh: araç gövdesi (12.177)
          if (ev.b) for (let i = 0; i + 2 < ev.b.length; i += 3) { const bp = new V(ev.b[i], ev.b[i + 1], ev.b[i + 2]); if (!this.ownBody(bp)) this.effects.blood(bp, 7, dir.clone().negate()); }     // 12.164: delip geçilen askerler
          if (ev.tw) { const tp = new V(ev.tw[0], ev.tw[1], ev.tw[2]), tn = new V(ev.tw[3], ev.tw[4], ev.tw[5]); this.effects.spark(tp, 3, tn); this.effects.decal(tp, tn); }     // 12.164: ince levha geçişi
          if (ev.m) { this.effects.muzzle(o, dir); this.sfx.shot(st.sound, by.pos); by.flashT = 0.06; if (st.charge) by.railT = 0; }      // 12.160 railT: ray tüfeği şarjı 3. şahısta (yeni ağ alanı yok)
          break;
        }
        case 'hm': if (ev.by === me.id) this.emit('hitmark', { zone: ev.hd ? 'head' : 'body', dead: !!ev.dead, pn: ev.pn || 0 }); break;
        case 'vhm': if (ev.by === me.id) this.emit('vehhit', { v: this.vehicles?.get(ev.i), dmg: ev.d }); break;                 // 12.177: araca isabet (yalnız atıcıya)
        case 'vx': this.vehicles?.netBoom(ev); break;
        case 'ts': this.vehicles?.netShell(ev); break;                                                                          // 12.178 tank topu ateşledi
        case 'tsb': this.vehicles?.netShellBoom(ev); break;                                                                     // tank mermisi patladı                                                                          // 12.177: araç patladı / battı
        case 'dmg': if (ev.v === me.id) { this.hud.damageFrom(new V(ev.x, 0, ev.z), me); this.sfx.hurt(); } break;
        case 'fall': if (ev.v === me.id && !(this.time - (this._fallFxAt ?? -9) < 1)) this.fallFx(ev.d); break;
        case 'drown': if (ev.v === me.id && !(this.time - (this._drownFxAt ?? -9) < 0.8)) this.drownFx(ev.d); break;     // 12.180 boğulma: tahmin kaçtıysa sunucudan     // düşme hasarı: tahmin etmediysek (yanlış tahmin) sunucudan geri bildirim
        case 'kill': {
          const victim = this.soldiers[ev.v], killer = this.soldiers[ev.k] || victim;
          if (!victim) break;
          this.hud.killFeed(killer, victim, ev.w, !!ev.hs, ev.pn || 0);
          if (killer === me && victim !== me) this.killfx.kill(victim, ev.w, !!ev.hs, undefined, { pn: ev.pn || 0, pc: ev.pc || 0 });
          if (victim === me) this.killfx.died();
          if (victim === me) me.lastHit = killer;
          break;
        }
        case 'gr': if (by) this.netGrenade(ev, by); break;
        case 'rk': if (by) this.spawnRocket(by, new V(...ev.o), new V(...ev.d), WSTATS[ev.w], { id: ev.id }); break;
        case 'sl': if (by) this.spawnShell(by, new V(...ev.o), new V(...ev.d), WSTATS[ev.w], { id: ev.id }); break;
        case 'boom': {
          const i = this.projectiles.findIndex((p) => p.id === ev.id);
          if (i >= 0) { this.scene.remove(this.projectiles[i].mesh); this.projectiles.splice(i, 1); }
          const pos = new V(...ev.p);
          if (ev.k === 's') { if (by) spawnSmoke(this, pos, WSTATS[ev.w], by); }
          else if (ev.k === 'f') { if (by) flashBang(this, pos, by, WSTATS[ev.w]); }
          else if (by && WSTATS[ev.w]?.kind === 'throwable') this.fragBlast(pos, WSTATS[ev.w], by);      // 12.193: görsel + ses (hasar sunucuda)
          else if (by) this.explode(pos, ev.r, 0, by, '');
          break;
        }
        case 'dep': netDeploy(this, ev); break;
        case 'depx': netUndeploy(this, ev.id); break;
        case 'ammo': if (ev.v === me.id) { this.hud.toast($t('hud.t.ammo'), '#9be07a'); this.sfx.deploy(me.pos); } break;
        case 'rld': if (by && by !== me) { by.reloadStyle = ev.s; by.reloadTotal = by.reloadT = ev.t; by.reloadEmpty = !!ev.em; by.shellT = ev.sh; by.rlId = by.item?.id; } break;      // 12.195: süre Soldier.update'te yalnız görüntü için akar (silah değişince biter)
        case 'inf': {                                // bir insan zombi oldu: takım + sınıf (model) değişir
          const v = this.soldiers[ev.v]; if (!v) break;
          v.team = 'red'; v.boss = !!ev.bs; v.zLives = ev.zl ?? 2; v.ztype = ZT_ORDER[(ev.zt || 1) - 1] || 'walker'; v.setClass('zombie');
          if (v === me) { this.hud.toast($t('hud.t.infected'), '#b6ff6a'); this.sfx.zombie?.(v.pos); }
          break;
        }
        case 'cure': {                              // can hakkı bitti: yeniden insan
          const v = this.soldiers[ev.v]; if (!v) break;
          v.team = 'blue'; v.boss = false; v.zLives = 0; v.cloakNet = false; v.setClass(ev.cls || 'assault');
          if (v === me) this.hud.toast($t('hud.t.cured'), '#7ec8ff');
          break;
        }
        case 'ab': if (by) this.showAbilityFx(by, ev.k, { x: ev.f[0], y: ev.f[1], z: ev.f[2] }, { x: ev.d[0], y: ev.d[1], z: ev.d[2] }); break;
        case 'lvl': { const v = this.soldiers[ev.v]; if (v) { const up = ev.l > v.ggLevel; v.ggLevel = ev.l; if (v === me && up) this.showLevel(v, true); else if (v === me) this.hud.toast($t('hud.t.knifed', { n: ev.l + 1, m: GG_LADDER.length }), '#ff8a6a'); } break; }
        case 'pb': case 'pbh': this.paint.onNet(ev); break;          // paintball: top doğdu / oyuncuya isabet
        case 'pk': this.pickups.onNet(ev); break;                    // paintball: kutu alındı / yeniden belirdi
        case 'swg': if (by && by !== me) { by.swing = { t: 0, dur: ev.d, kind: ev.k, idx: 0, done: true, hv: !!ev.h }; by.comboT = ev.d + 0.38; } break;
        case 'as': if (ev.to === me.id) { assistPop(this, this.soldiers[ev.v], ev.p); this.emit('assist', { by: me, victim: this.soldiers[ev.v], pts: ev.p }); } break;     // 12.165: kişisel asist bildirimi (sunucu yalnız ilgiliye yollar)
      }
    }
  }

  // ───── çevrimiçi: M ile takım seçimi ─────
  toggleTeamMenu(show = !this._tm) {
    if (this.ffa) { if (show) this.hud.toast(this.mode.paintball ? $t('hud.t.noTeamPb') : $t('hud.t.noTeamDm'), '#cfd3d8'); return; }
    if (this.mode.infection) { if (show) this.hud.toast($t('hud.t.noTeamInf'), '#cfd3d8'); return; }
    if (!show) { this._tm?.remove(); this._tm = null; if (!this.ended) this.hud.setPaused(!this.player.locked); return; }
    if (this._tm) return;
    document.exitPointerLock?.();
    this.hud.setPaused(false);                       // "Hazır mısın?" paneli menünün üstüne binmesin
    const cap = this.opts.online.cfg?.perTeam || 1, roster = this.online.roster || [];
    const me = this.playerSoldier, cnt = (t) => roster.filter((r) => r.team === t && r.human).length;
    const bots = (t) => roster.filter((r) => r.team === t && !r.human && !r.vac).length;
    const el = (this._tm = document.createElement('div'));
    el.style.cssText = 'position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(4,6,10,.62);font-family:Bahnschrift,Rajdhani,Arial Narrow,sans-serif;color:#e8edf5';
    const card = (t, name, col) => {
      const full = cnt(t) >= cap, mine = me.team === t;
      return `<button data-t="${t}" ${full || mine ? 'disabled' : ''} style="all:unset;box-sizing:border-box;cursor:${full || mine ? 'default' : 'pointer'};width:240px;padding:22px 18px;margin:0 10px;text-align:center;background:${col}22;border:2px solid ${col};opacity:${full || mine ? .5 : 1}">
        <div style="font-size:30px;font-weight:800;letter-spacing:4px;color:${col}">${name}</div>
        <div style="font-size:18px;margin-top:8px">${$t('hud.tm.players', { n: `<b>${cnt(t)}</b>`, c: cap })}</div><div style="font-size:13px;opacity:.7;margin-top:2px">${$t('hud.tm.bots', { n: bots(t) })}</div>
        <div style="font-size:13px;margin-top:10px;letter-spacing:2px">${mine ? $t('hud.tm.mine') : full ? $t('hud.tm.full') : $t('hud.tm.join')}</div></button>`;
    };
    el.innerHTML = `<div style="text-align:center"><div style="font-size:15px;letter-spacing:5px;opacity:.7;margin-bottom:14px">${$t('hud.tm.title')}</div>
      <div style="display:flex;justify-content:center">${card('blue', $t('hud.blue'), '#4aa3ff')}${card('red', $t('hud.red'), '#ff5a43')}</div>
      <div id="tmMsg" style="margin-top:16px;font-size:14px;min-height:20px;color:#ffcf7a"></div>
      <div style="margin-top:6px;font-size:13px;opacity:.6">${$t('hud.tm.hint')}</div></div>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-t]');
      if (!b) { if (e.target === el) this.toggleTeamMenu(false); return; }
      if (b.disabled) return;
      el.querySelector('#tmMsg').textContent = $t('hud.tm.sending');
      this.online.send({ t: 'team', team: b.dataset.t });
    });
    document.body.appendChild(el);
  }

  onNetTeam(m) {
    const msg = this._tm?.querySelector('#tmMsg');
    if (!m.ok) { if (msg) msg.textContent = m.msg || $t('hud.t.teamFail'); else this.hud.toast(m.msg || $t('hud.t.teamFail'), '#ff8a7a'); return; }
    if (msg) msg.textContent = $t('hud.tm.switching');
    const u = new URL(location.href); u.searchParams.set('team', m.team);        // yeniden katılırken bu takım istenir
    this.ended = true;                                                              // bağlantı kopma ekranı çıkmasın
    this.online?.ws.close();
    location.href = u.toString();
  }

  onNetChat(m) { this.chat?.add(m); }

  onNetEnd(m) {
    if (this.ended) return;
    this.ended = true; this.running = false;
    this.showEndScreen(m.winner, m.why, m);
  }

  // Eski sunucu: oda sıfırlandı, sayfa yenilenip yeniden katılınır. Yeni sunucu (re:1) aynı bağlantıda 'welcome' yollar (main.js oyunu yeniden kurar)
  onNetRestart(m) { if (!m || !m.re) location.reload(); }

  // kicked: sunucunun { t:'kicked', k, ms, r } mesajı (moderatör attı / banladı) → genel "bağlantı koptu" yerine nedeni gösterilir
  onNetClosed(kicked) {
    if (this.ended && !kicked) return;
    this.ended = true; this.running = false;
    if (kicked) { this.chat?.close?.(); document.exitPointerLock?.(); this.hud.showEnd(false, $t(kicked.k === 'ban' ? 'ban.banTitle' : 'ban.kickTitle'), banText(kicked), ''); this.hud.$('bAgain').style.display = 'none'; return; }      // tekrar katılma düğmesi yok: yalnız ana menü
    this.hud.toast($t('hud.t.disconnected'), '#ff8a7a');
    this.hud.showEnd(false, $t('end.lost'), $t('end.lostInfo'), '');
  }

  // ───── lag compensation: son HN adımın konum geçmişi; atış anında hedefler istemcinin gördüğü ana geri sarılır ─────
  recordHist() {
    const N = this.soldiers.length, base = (this.tick % this.HN) * N * 9, b = this.histBuf;
    for (let i = 0; i < N; i++) {
      const s = this.soldiers[i], o = base + i * 9;
      b[o] = s.pos.x; b[o + 1] = s.pos.y; b[o + 2] = s.pos.z; b[o + 3] = s.yaw; b[o + 4] = s.height; b[o + 5] = s.proneT;
      b[o + 6] = s.leanOff.x; b[o + 7] = s.leanOff.y; b[o + 8] = s.leanOff.z;
    }
  }

  // vt: istemcinin gördüğü sunucu adımı (kesirli). Dönen fonksiyon eski durumu geri yükler.
  rewind(shooter, vt) {
    const N = this.soldiers.length, T = this.tick;                   // en son kaydedilen adım (etiket = adım sonrası tick)
    const t = Math.max(T - (this.HN - 3), Math.min(T, vt));
    if (t < 1) return () => {};                                      // 12.187: maçın ilk adımları (tampon dolmadı): geri sarma yok
    const i0 = Math.floor(t), f = t - i0, i1 = Math.min(T, i0 + 1);
    const b = this.histBuf, a0 = (i0 % this.HN) * N * 9, a1 = (i1 % this.HN) * N * 9;
    const saved = [];
    for (let i = 0; i < N; i++) {
      const s = this.soldiers[i];
      if (s === shooter || !s.alive) continue;
      const o0 = a0 + i * 9, o1 = a1 + i * 9;
      saved.push([s, s.pos.x, s.pos.y, s.pos.z, s.yaw, s.height, s.proneT, s.leanOff.x, s.leanOff.y, s.leanOff.z]);
      const L = (k) => b[o0 + k] + (b[o1 + k] - b[o0 + k]) * f;
      s.pos.set(L(0), L(1), L(2)); s.yaw = L(3); s.height = L(4); s.proneT = L(5); s.leanOff.set(L(6), L(7), L(8));
    }
    return () => { for (const [s, x, y, z, yaw, h, pr, lx, ly, lz] of saved) { s.pos.set(x, y, z); s.yaw = yaw; s.height = h; s.proneT = pr; s.leanOff.set(lx, ly, lz); } };
  }

  // Grafik kademesi (Ayarlar → Grafik: Düşük / Orta / Yüksek = çözünürlük çarpanı 1 / 1,5 / 2). Telefonda gölge haritası hep 1024 (gölge zaten varsayılan kapalı).
  //   Düşük: 1024 gölge, sert kenar, ±42 m · Orta: 2048, yumuşak (PCF yarıçapı 2), ±55 m · Yüksek: 4096, yumuşak, ±62 m + son işleme (parıltı, renk tonu, vinyet; "Son işleme" açıksa)
  //   Gölge kutusu bakış yönüne kaydırılır (önde daha çok kapsama: "tek basamaklı kademeli gölge" gibi)
  gfxLevel() { const v = this.settings.pixelRatio || 1; return v < 1.25 ? 0 : v < 1.75 ? 1 : 2; }
  applyGfx() {
    if (!this.sun) return;
    const lv = this.gfxLevel(), sh = this.sun.shadow, size = isTouch() ? 1024 : [1024, 2048, 4096][lv];
    this._shS = [42, 55, 62][lv]; this._shF = [6, 14, 18][lv];
    Object.assign(sh.camera, { left: -this._shS, right: this._shS, top: this._shS, bottom: -this._shS }); sh.camera.updateProjectionMatrix();
    sh.radius = lv ? 2.2 : 1;
    if (sh.mapSize.x !== size) { sh.mapSize.set(size, size); sh.map?.dispose(); sh.map = null; }
    const want = lv === 2 && (this.settings.post ?? !isTouch());
    if (want && !this.post) this.post = new Post(this.renderer);
    if (this.post) { this.post.on = want; this.post.setGrade(this.env?.grade); }
  }

  // Birinci şahıs silah ışığı: sabit gündüz ışığı yerine haritanın güneşi / gökyüzü (renk, şiddet, yön); gece ve gölgede silah da kararır
  _vmLights() {
    const vm = this.player?.vm, E = this.env?.E; if (!vm || !E) return;
    for (const o of vm.scene.children) { if (o.isHemisphereLight) this._vmHemi = o; else if (o.isDirectionalLight) this._vmSun = o; }
    if (!this._vmSun || !this._vmHemi) return;
    this._vmHemi.color.set(E.hemi[0]); this._vmHemi.groundColor.set(E.hemi[1]); this._vmHemiI = this._vmHemi.intensity = E.hemi[2] * 1.3;
    this._vmSun.color.set(E.sun[0]); this._vmSunI = E.sun[1] * 0.95; this._vmLit = 1; this._vmLitT = 0;
    vm.scene.environmentIntensity = (this.env.night ? 0.3 : this.env.sunset ? 0.55 : 0.7);
  }
  _vmLightUpdate(dt) {
    const L = this._vmSun; if (!L) return;
    if ((this._vmLitT -= dt) <= 0) {                                                       // göz güneşe açık mı (0,15 sn'de bir, yumuşak geçiş)
      this._vmLitT = 0.15;
      const e = this.camera.position, so = this.sunOff;
      this._vmLitTo = this.world.clear(e, _sv.copy(so).normalize().multiplyScalar(60).add(e)) ? 1 : 0.25;
    }
    this._vmLit += ((this._vmLitTo ?? 1) - this._vmLit) * Math.min(1, dt * 6);
    L.intensity = this._vmSunI * this._vmLit;
    this._vmHemi.intensity = this._vmHemiI + (this.torchOn ? 0.9 : 0);                       // fener açıkken silah da aydınlanır
    L.position.copy(this.sunOff).normalize().applyQuaternion(_sq.copy(this.camera.quaternion).invert()).multiplyScalar(5);   // kamera uzayında gerçek güneş yönü
  }

  render() {
    const r = this.renderer;
    // gölge kamerası oyuncuyu izler, bakış yönüne kaydırılır (kayma olmaması için texel ızgarasına yuvarla)
    const p = this.playerSoldier.pos, S = this._shS || 55, F = this._shF || 0;
    const q = (2 * S) / this.sun.shadow.mapSize.x;
    this.camera.getWorldDirection(_sv); const fl = Math.hypot(_sv.x, _sv.z) || 1;
    const tx = Math.round((p.x + (_sv.x / fl) * F) / q) * q, tz = Math.round((p.z + (_sv.z / fl) * F) / q) * q;
    const ty = p.y;
    this.sun.target.position.set(tx, ty, tz);
    this.sun.position.set(tx + this.sunOff.x, ty + this.sunOff.y, tz + this.sunOff.z);
    this.remoteTorch?.update(this._rdt ?? 0.016);
    if (this.vehView) { this.vehView.frame(this._rdt ?? 0.016); this.vehHud.update(); }
    if (this.map.fx) this.map.fx.update(performance.now() / 1000, this.camera, this);            // harita efektleri (New York: ateş ışığı titremesi, duman / kıvılcım zamanı)
    this.paint.draw();
    this.pickups.draw();
    this.nadeView?.draw();
    const now = performance.now(), dt = Math.min(0.1, (now - (this._rT || now)) / 1000); this._rT = now;
    this._vmLightUpdate(dt);
    this.objFx?.frame(dt);
    const post = this.post?.on && this.post.begin() ? this.post : null;      // begin() false: hedef sürücü sınırını aşıyor → doğrudan ekrana (12.151)
    const uw = this.world.terrain?.waterY ? (this.underwater ||= new Underwater(this)) : null;      // 12.180 su altı görünümü (sis + ton + boğuk ses; su vermeyen haritada yok)
    uw?.begin(dt);
    r.clear();
    r.render(this.scene, this.camera);
    uw?.overlay(r);
    if (this.playerSoldier.alive && !this.showSelf && !(this.playerSoldier.veh && (this.playerSoldier.seat === 0 || mgAt(this.playerSoldier.veh.def, this.playerSoldier.seat)))) this.player.vm.render(r, innerWidth, innerHeight);      // 12.177: sürücünün elinde silah yok
    uw?.end();
    if (post) post.end();
  }

  // ───── Savaş mantığı ─────
  hitSoldier(e, o, d, maxT) {
    const kH = e.hbH || 1, kW = e.hbW || 1;                       // iri zombiler (boss...) görünen modelleri kadar geniş/uzun vurulur
    const H = e.height * kH, px = e.pos.x, py = e.pos.y, pz = e.pos.z;
    // kaba küre testi
    const cx = px - o.x, cy = py + H * 0.5 - o.y, cz = pz - o.z;
    const proj = cx * d.x + cy * d.y + cz * d.z;
    if (proj < -1.2 || proj > maxT + 1.2) return null;
    const dist2 = cx * cx + cy * cy + cz * cz - proj * proj;
    const rad = (e.proneT > 0.5 ? 1.35 : 1.2) * Math.max(kH, kW);
    if (dist2 > rad * rad) return null;
    if (e.proneT > 0.5) {
      // yatan oyuncu: gövde yaw boyunca uzanır (eksen hizalı kutu), kafa önde
      const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), ax = Math.abs(fx), az = Math.abs(fz);
      const hx = ax * 0.82 + az * 0.27, hz = az * 0.82 + ax * 0.27;
      const hxp = px + fx * 0.72, hzp = pz + fz * 0.72;
      const th = rayBox(o, d, [hxp - 0.17, py + 0.1, hzp - 0.17], [hxp + 0.17, py + 0.5, hzp + 0.17], maxT);
      const tb = rayBox(o, d, [px - hx, py, pz - hz], [px + hx, py + 0.45, pz + hz], maxT);
      if (th >= 0 && (tb < 0 || th <= tb)) return { t: th, zone: 'head' };
      if (tb >= 0) return { t: tb, zone: 'body' };
      return null;
    }
    const lx = e.leanOff.x, lz = e.leanOff.z;       // eğilen oyuncunun kafası yana kayar
    const hh = H - 0.36 * kH, hw = 0.2 * kW, bw = 0.29 * kW;
    const th = rayBox(o, d, [px + lx - hw, py + hh + e.leanOff.y, pz + lz - hw], [px + lx + hw, py + H + e.leanOff.y, pz + lz + hw], maxT);
    const tb = rayBox(o, d, [px + lx * 0.45 - bw, py, pz + lz * 0.45 - bw], [px + lx * 0.45 + bw, py + hh, pz + lz * 0.45 + bw], maxT);
    if (th >= 0 && (tb < 0 || th <= tb)) return { t: th, zone: 'head' };
    if (tb >= 0) {
      const y = o.y + d.y * tb - py;
      return { t: tb, zone: y < H * 0.42 ? 'legs' : 'body' };
    }
    return null;
  }

  shootRay(shooter, origin, dir, st, muzzle, camO = null) {
    const maxT = Math.max(SHOT_REACH, st.range ? st.range[1] * 2.2 : 300);
    // sunucu: insanın atışı, istemcinin gördüğü ana geri sarılarak hesaplanır (lag compensation)
    const restore = shooter.rewindTick != null ? this.rewind(shooter, shooter.rewindTick) : null;
    if (camO) {
      // 3. şahıs iki aşamalı atış: (1) kamera ışını neye çarpıyor (duvar ya da düşman) → nişan noktası P; (2) mermi GÖZDEN P'ye gider
      // ve gerçek yolundaki ilk engelde durur. Kameranın köşeden gördüğü yere duvarın arkasından ateş edilemez.
      let tc = maxT;
      const wc = this.world.raycast(camO, dir, maxT, (this._wc ||= {}), 'wood');
      if (wc) tc = wc.t;
      for (const e of this.soldiers) {
        if (e === shooter || !e.alive || e.team === shooter.team) continue;
        const h = this.hitSoldier(e, camO, dir, tc);
        if (h && h.t < tc) tc = h.t;
      }
      const nd = camO.clone().addScaledVector(dir, tc).sub(origin).normalize();
      if (nd.dot(dir) > 0.9) dir = nd;                                    // ~25°'den fazla sapma (çok yakın hedef) → gözden düz (kamera hilesi için tavan)
    }
    // ahşap kapılar ('wood') mermiyi durdurmaz: arkasındaki ilk sert engel / asker aranır, kapıdan geçen mermi %35 zayıflar
    const pen = st.pen && st.pen.length > 1 ? st.pen : null;                // 12.164: delen silah (stats.js PEN) — askerin içinden geçer
    let wh = this.world.raycast(origin, dir, maxT, (this._wh ||= {}), 'wood');
    // 12.164 seçenek (TUNE.penWalls, varsayılan KAPALI): delen silah en çok 1 ince levhadan (en ince boyutu ≤ penThick) geçer, arkasında hasar × penWallMul
    let thinT = Infinity, thinP = null, thinN = null;
    if (pen && TUNE.penWalls && wh && thinCollider(wh.collider)) {
      const c = wh.collider, ex = rayBoxExit(origin, dir, c.min, c.max);
      if (ex > wh.t) {
        thinT = wh.t; thinP = wh.point.clone(); thinN = wh.normal.clone();
        const o2 = (this._po ||= new THREE.Vector3()).copy(origin).addScaledVector(dir, ex + 0.01);
        wh = this.world.raycast(o2, dir, maxT - ex - 0.01, (this._wh2 ||= {}), 'wood');
        if (wh) wh.t += ex + 0.01;
      }
    }
    // 12.177: araç gövdesi mermiyi durdurur (yönlü kutu; üstü açık jipte yolcunun gövdesi kutunun üstünde kalır → vurulur)
    const vhit = this.vehicles?.raycast(origin, dir, Math.min(maxT, wh ? wh.t : maxT), shooter.veh);      // kendi aracı (koltuktan ateş) ışını kesmez
    if (vhit) wh = { t: vhit.t, veh: vhit.v, collider: null, point: new THREE.Vector3(vhit.point.x, vhit.point.y, vhit.point.z), normal: new THREE.Vector3(vhit.normal.x, vhit.normal.y, vhit.normal.z) };
    const tw = wh ? wh.t : Infinity;
    const wE = this.waterEntry(origin, dir, Math.min(tw, maxT)), wStop = wE == null ? Infinity : wE + WATER_STOP;      // 12.180: su mermiyi 1,5 m'de durdurur (dalan korunur)
    const wd = this.world.raycast(origin, dir, Math.min(tw, thinT, maxT), (this._wd ||= {}));
    const woodT = wd && wd.collider && wd.collider.tag === 'wood' ? wd.t : Infinity;
    // vurulan askerler (ışın boyunca sıralı): delmeyen silahta yalnız ilki, delende en çok pen.length. Takım arkadaşı ışını kesmez (hasar almaz, hak harcamaz).
    const hits = [];
    let bestT = Infinity;
    for (const e of this.soldiers) {
      if (e === shooter || !e.alive || e.team === shooter.team) continue;
      const h = this.hitSoldier(e, origin, dir, Math.min(tw, pen ? Infinity : bestT, maxT));
      if (!h || h.t >= tw || h.t > wStop) continue;
      if (pen) hits.push({ e, t: h.t, zone: h.zone });
      else if (h.t < bestT) { bestT = h.t; hits[0] = { e, t: h.t, zone: h.zone }; }
    }
    let cap = 1;                                                          // bu mermi en çok kaç askere girer (admin bir hedefi 0 yaparsa orada durur)
    if (pen) {
      cap = pen.length; for (let k = 1; k < pen.length; k++) if (!(pen[k] > 0)) { cap = k; break; }
      hits.sort((x, y) => x.t - y.t);
      if (hits.length > cap) hits.length = cap;
    }
    restore?.();
    shooter.spottedT = this.time;
    const first = this._firstPellet; this._firstPellet = false;
    const q2 = (v) => Math.round(v * 100) / 100;
    const ev = this.headless ? { e: 'sh', by: shooter.id, m: first ? 1 : 0, o: [q2(muzzle.x), q2(muzzle.y), q2(muzzle.z)] } : null;
    if (ev && st.vmg) ev.vm = 1;
    if (thinP) { this.effects.spark(thinP, 3, thinN); this.effects.decal(thinP, thinN); if (ev) ev.tw = [q2(thinP.x), q2(thinP.y), q2(thinP.z), q2(thinN.x), q2(thinN.y), q2(thinN.z)]; }
    const woodFx = () => { const wp = wd.point.clone(); this.effects.spark(wp, 3, wd.normal); this.effects.decal(wp, wd.normal); };
    let woodShown = false;
    // mermi son askerde mi durdu (delmeyen silah ya da hak bitti), yoksa ışın boyunca sürüp duvara / boşluğa mı gitti
    const stopped = hits.length > 0 && hits.length >= cap;
    const pts = [];
    if (hits.length) {
      const r0 = st.range[0], r1 = st.range[1];
      const pr = pen && hits.length > 1 ? (this._pen = { by: shooter, idx: 0, kills: 0 }) : null;
      try { for (let k = 0; k < hits.length; k++) {
        const { e, t: ht, zone } = hits[k];
        const pt = origin.clone().addScaledVector(dir, ht); pts.push(pt);
        const f = ht <= r0 ? 1 : lerpClamp(1, st.minMul, (ht - r0) / (r1 - r0));
        const zm = zone === 'head' ? TUNE.headMul : zone === 'legs' ? TUNE.legMul : 1;
        if (!(e.isPlayer && !this.showSelf)) this.effects.blood(pt, 7, dir.clone().negate());      // 12.187: birinci şahısta kendi kanın kameraya çizilmez
        const wm = ht > woodT ? TUNE.woodMul : 1, tm = ht > thinT ? TUNE.penWallMul : 1;
        if (wm < 1 && !woodShown) { woodShown = true; woodFx(); }
        // çevrimiçi istemcide hasar yok: sunucu hesaplar, sonucu olay olarak yollar (aynı ışın, aynı geri sarılmış konumlar → aynı hedefler)
        if (pr) pr.idx = k;
        if (!this.online) e.takeDamage(st.dmg * f * zm * wm * tm * (pen ? pen[k] : 1) * (shooter.dmgMul || 1), shooter, zone, shooter.pos, st.name);
      } } finally { if (pr) this._pen = null; }
    }
    if (woodT < Infinity && !woodShown && woodT < (stopped ? hits[hits.length - 1].t : tw)) woodFx();
    if (stopped) {
      const pt = pts[pts.length - 1];
      if (Math.random() < 0.6 || (st.pellets || 1) === 1) this.effects.tracer(muzzle, pt, st.tracer);
      if (ev) { ev.k = 'f'; ev.p = [q2(pt.x), q2(pt.y), q2(pt.z)]; }
    } else if (wh && wE != null && wE > 0.05 && wh.t > wE) {                     // 12.180 su yüzeyine çarptı: sıçrama (dipte kıvılcım / iz yok)
      const pt = origin.clone().addScaledVector(dir, wE);
      if (Math.random() < 0.7 || hits.length) this.effects.tracer(muzzle, pt, st.tracer);
      this.effects.splash(pt);
      if (ev) { ev.k = 'w'; ev.ws = 1; ev.p = [q2(pt.x), q2(pt.y), q2(pt.z)]; ev.n = [0, 1, 0]; }
    } else if (wh) {
      const pt = wh.point.clone();
      if (Math.random() < 0.7 || hits.length) this.effects.tracer(muzzle, pt, st.tracer);
      this.effects.spark(pt, wh.veh ? 6 : 4, wh.normal, wh.veh ? '#ffe7b0' : undefined);
      if (!wh.veh && (wh.collider || wh.normal.y > 0.5)) this.effects.dust(pt, wh.normal);
      if (!wh.veh) this.effects.decal(pt, wh.normal);                           // araçta iz bırakmaz (gövde hareket eder)
      if (shooter.isPlayer || pt.distanceTo(this.camera.position) < 25) this.sfx.impact(pt);
      if (wh.veh && !this.online) { const f = wh.t <= st.range[0] ? 1 : lerpClamp(1, st.minMul, (wh.t - st.range[0]) / (st.range[1] - st.range[0])); this.vehicles.damage(wh.veh, st.dmg * f * (st.pellets ? 0.6 : 1) * (shooter.dmgMul || 1), shooter, st.vk || 'bullet', st.name); }
      if (ev) { ev.k = 'w'; ev.p = [q2(pt.x), q2(pt.y), q2(pt.z)]; ev.n = [q2(wh.normal.x), q2(wh.normal.y), q2(wh.normal.z)]; if (wh.veh) ev.vh = 1; }
    } else {
      const end = origin.clone().addScaledVector(dir, 120);
      this.effects.tracer(muzzle, end, st.tracer);
      if (ev) { ev.k = 'a'; ev.p = [q2(end.x), q2(end.y), q2(end.z)]; }
    }
    // 12.164: delip geçilen askerlerin kan noktaları (başkalarının ekranı için; son durak 'f' ise p zaten son asker)
    if (ev && pts.length > (stopped ? 1 : 0)) ev.b = pts.slice(0, stopped ? -1 : undefined).flatMap((v) => [q2(v.x), q2(v.y), q2(v.z)]);
    if (ev) this.netEvents.push(ev);
  }

  // 12.180 ışının suya girdiği t (m): başlangıç su altındaysa 0, su yoksa / yukarı bakıyorsa null. Aday su kotları: başlangıç ve uç noktanın suyu.
  waterEntry(o, d, maxT) {
    const T = this.world.terrain; if (!T?.waterY) return null;
    if (waterYAt(T, o.x, o.z) > o.y) return 0;
    if (!(d.y < -1e-4)) return null;
    const L = Math.min(maxT, 400), ex = o.x + d.x * L, ez = o.z + d.z * L;
    let best = null;
    for (const lv of [waterYAt(T, ex, ez), waterYAt(T, o.x, o.z)]) {
      if (!(lv > -1e9) || lv >= o.y) continue;
      const t = (lv - o.y) / d.y;
      if (t > 0 && t < L && Math.abs(waterYAt(T, o.x + d.x * t, o.z + d.z * t) - lv) < 0.01 && (best == null || t < best)) best = t;
    }
    return best;
  }

  // Yakın dövüş vuruşu: önündeki koni (±34°) içinde, duvar engeli olmayan en yakın düşman. Yoksa duvar vuruşu döner.
  meleeHit(attacker, o, d, reach) {
    let best = null, bs = 1e9;
    const c = new THREE.Vector3(), v = new THREE.Vector3();
    for (const e of this.soldiers) {
      if (e === attacker || !e.alive || e.team === attacker.team) continue;
      // vücut ve baş noktalarından biri yeterli
      for (const fy of [0.55, 0.9]) {
        c.set(e.pos.x, e.pos.y + e.height * (e.hbH || 1) * fy, e.pos.z);
        v.subVectors(c, o);
        const dist = v.length();
        if (dist > reach + 0.3 || dist < 1e-4) continue;
        const dot = v.dot(d) / dist;
        if (dot < 0.83) continue;
        if (!this.world.clear(o, c)) continue;
        const sc = dist * (2 - dot);
        if (sc < bs) { bs = sc; best = { victim: e, point: c.clone() }; }
      }
    }
    if (best) return best;
    const wh = this.world.raycast(o, d, reach, (this._mh ||= {}));
    return wh ? { wall: true, point: wh.point.clone(), normal: wh.normal.clone() } : null;
  }

  // Duman: iki nokta arası görüş çizgisi (dünya + duman). Botların algısı bunu kullanır.
  losClear(a, b) { return this.world.clear(a, b) && !smokeBlocks(this, a, b); }
  // botların görüşü: LOS + duman + yaprak / çalı (mermi geçer ama bot görmez)
  // 12.180: suyun 0,7 m'den derinindeki nokta su üstünden (ya da tersi) görünmez (dalan oyuncu botlardan saklanır)
  botSees(a, b) { return this.losClear(a, b) && !(this.sightMap && this.sightMap.blocked(a, b)) && !this.waterHides(a, b); }
  waterHides(a, b) {
    const T = this.world.terrain; if (!T?.waterY) return false;
    const da = waterYAt(T, a.x, a.z) - a.y, db = waterYAt(T, b.x, b.z) - b.y;
    return (da > 0.7 || db > 0.7) && !(da > 0 && db > 0 && Math.hypot(a.x - b.x, a.z - b.z) < 14);      // ikisi de sudaysa yakında (≤ 14 m) görür
  }
  smokeDensity(p) { return smokeDensity(this, p); }
  placeDeployable(s, st) { return placeDeployable(this, s, st); }

  alertNear(pos, team, radius) {
    if (this.map.big) radius *= 2.5;                                              // 12.189 büyük harita: açık arazide silah sesi uzağa gider (yakındaki botlar çatışmaya yönelir)
    for (const s of this.soldiers) {
      if (!s.alive || s.team === team || !s.brain) continue;
      if (Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z) < radius) s.brain.hear(pos, radius);
    }
  }

  // ───── Mermi benzeri nesneler ─────
  spawnRocket(owner, pos, dir, st, net) {
    if (this.online && !net) return;       // çevrimiçi istemci: sunucu olayı (rk) oluşturur
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), mat('#4d5b3a'));
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), mat('#36422a'));
    nose.rotation.x = -Math.PI / 2; nose.position.z = -0.35;
    g.add(body, nose);
    g.position.copy(pos);
    g.lookAt(pos.clone().add(dir));
    this.scene.add(g);
    const id = net ? net.id : ++this.pidN;
    this.projectiles.push({ id, type: 'rocket', mesh: g, pos: pos.clone(), vel: dir.clone().multiplyScalar(st.speed), owner, st, life: 6, trail: 0 });
    this.netEvent({ e: 'rk', id, by: owner.id, w: STAT_ID.get(st), o: v3(pos), d: v3(dir) });
  }

  // 12.193 el bombası patlaması (grenade.js fragBlast; test / hata ayıklama buradan yakalar)
  fragBlast(pos, st, owner, selfMul) { fragBlast(this, pos, st, owner, selfMul); }

  // 12.193 bot bomba nişanı (aynı fizik; araç gövdeleri dahil). under: önce alttan dene (kısa mesafe) · fuse: kalan fünye
  botAimNade(s, st, tp, under, fuse) {
    const tol = st.gtype === 'flash' ? 6 : 3.5, o = { fuse, vehicles: this.vehicles };
    return (under && aimNade(s, st, tp, this.world, tol, { ...o, under: true })) || aimNade(s, st, tp, this.world, tol, o)
      || aimNade(s, st, tp, this.world, 7, { ...o, under: true }) || aimNade(s, st, tp, this.world, 7, o);      // pişirirken yer değişti: daha gevşek (yine de ondan uzağa)
  }

  // Atılan bomba (el bombası / duman / flaş). o: { fuse (pişirilmişse kalan), inHand (elde patladı), pred (çevrimiçi: kendi atışımın tahmini, girdi sırası q) }
  // Fizik grenade.js'te (sabit adım): sunucu, istemci tahmini ve önizleme aynı yolu çizer.
  spawnGrenade(owner, pos, vel, st, net, o = {}) {
    if (this.online && !net && !o.pred) return;
    const id = net ? net.id : o.pred ? -(++this.pidN) : ++this.pidN;
    let m;
    if (this.headless) m = new THREE.Object3D();
    else {
      const wid = STAT_ID.get(st);
      try { m = createWeapon(wid, null, true); m.scale.setScalar(1.25); } catch (e) { m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat('#4d5b3a')); }
      m.traverse((c) => { if (c.isMesh) c.castShadow = true; });
      m.position.copy(pos);
      this.scene.add(m);
    }
    const fuse = Number.isFinite(o.fuse) ? Math.max(0, o.fuse) : st.fuse;
    // görüntü: bomba ilk 0,18 sn'de elden (göz hattının sağ-altı) gerçek yola süzülür (fizik gözden başlar: duvardan atılamaz)
    const vis = new THREE.Vector3();
    if (!this.headless && !o.inHand) { const r = owner.right(new THREE.Vector3()); vis.addScaledVector(r, 0.04).y -= 0.14; }      // 12.193: fizik zaten sağ omuzdan çıkar
    const p = { id, type: 'grenade', mesh: m, pos: pos.clone(), vel: vel.clone(), owner, st, fuse, fuse0: fuse, bounces: 0, acc: 0, age: 0, steps: 0, ground: false, rest: false, hit1: false, vis, inHand: !!o.inHand, pred: !!o.pred, q: o.pred ? o.q : -1, ph: {} };
    this.projectiles.push(p);
    if (!o.inHand && vel.lengthSq() > 4) owner.throwT = 0.45;                     // 12.193: 3. şahıs atış savruluşu (uzaktaki oyuncu da: 'gr' olayıyla)
    this.netEvent({ e: 'gr', id, by: owner.id, w: STAT_ID.get(st), o: v3(pos), v: v3(vel), f: +fuse.toFixed(3), q: Number.isFinite(owner.inSeq) ? owner.inSeq : -1, ih: o.inHand ? 1 : 0 });
    return p;
  }

  // Çevrimiçi: sunucunun 'gr' olayı. Kendi atışımsa tahminle zaten havada: kimliğini eşle, sunucunun başlangıcından aynı adım sayısı kadar yeniden koş (yakınsar).
  netGrenade(ev, by) {
    const st = WSTATS[ev.w], V = THREE.Vector3;
    if (!st) return;
    if (by === this.playerSoldier) {
      const mine = this.projectiles.filter((p) => p.pred && p.st === st);
      const p = mine.find((q) => q.q === ev.q) || mine.sort((a, b) => b.age - a.age)[0];
      if (p) {
        p.id = ev.id; p.pred = false;
        const s0 = { pos: new V(...ev.o), vel: new V(...ev.v), ground: false, rest: false, fuse: Number.isFinite(ev.f) ? ev.f : st.fuse, hit1: false, ph: p.ph };
        for (let k = 0; k < p.steps && s0.fuse > 1e-9; k++) nadeTick(s0, this.world, st, this.vehicles);     // 12.193: aynı adım (ilk değme fünyesi + araç sekmesi dahil)
        p.pos.copy(s0.pos); p.vel.copy(s0.vel); p.ground = s0.ground; p.rest = s0.rest; p.fuse = s0.fuse; p.hit1 = s0.hit1;
        return;
      }
    }
    this.spawnGrenade(by, new V(...ev.o), new V(...ev.v), st, { id: ev.id }, { fuse: ev.f, inHand: !!ev.ih });
  }

  // M79 tarzı bomba: yaylı yol, çarpınca patlar
  spawnShell(owner, pos, dir, st, net) {
    if (this.online && !net) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8), mat('#6a6f3a'));
    m.position.copy(pos);
    this.scene.add(m);
    const id = net ? net.id : ++this.pidN;
    this.projectiles.push({ id, type: 'grenade', mesh: m, pos: pos.clone(), vel: dir.clone().multiplyScalar(st.speed), owner, st, fuse: 4, bounces: 0, shell: true });
    this.netEvent({ e: 'sl', id, by: owner.id, w: STAT_ID.get(st), o: v3(pos), d: v3(dir) });
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      let boom = null;
      if (p.hold) { if ((p.hold -= dt) <= 0) { this.scene.remove(p.mesh); this.projectiles.splice(i, 1); } continue; }   // istemci: sunucu patlamasını bekliyor
      if (p.type === 'rocket') {
        p.life -= dt;
        const step = p.vel.clone().multiplyScalar(dt), L = step.length();
        const d = step.clone().normalize();
        const wh = this.world.raycast(p.pos, d, L + 0.1, (this._ph ||= {}));
        let hitT = wh ? wh.t : Infinity;
        const vr = this.vehicles?.raycast(p.pos, d, Math.min(L + 0.1, hitT));            // 12.177: roket araca çarpar
        if (vr && vr.v !== p.owner.veh) hitT = vr.t;
        for (const e of this.soldiers) {
          if (!e.alive || e === p.owner || e.team === p.owner.team) continue;
          const h = this.hitSoldier(e, p.pos, d, Math.min(L, hitT));
          if (h && h.t < hitT) hitT = h.t;
        }
        if (hitT <= L + 0.1) boom = p.pos.clone().addScaledVector(d, Math.max(0, hitT - 0.1));
        else if (p.life <= 0) boom = p.pos.clone();
        else {
          p.pos.add(step);
          p.mesh.position.copy(p.pos);
          p.trail -= dt;
          if (p.trail <= 0) { p.trail = 0.02; this.effects._part(p.pos, '#8a8a8a', 0.14, null, 0.6, 0.7, -0.5); this.effects._part(p.pos, '#ffb04a', 0.08, null, 0.3, 0.12, 0); }
        }
      } else if (!p.shell) {
        // atılan bomba: sabit adım (NADE.h) — kare hızından bağımsız, önizlemeyle birebir
        p.acc += dt; p.age += dt;
        while (p.acc >= NADE.h - 1e-9 && !boom) {
          p.acc -= NADE.h;
          if (p.fuse <= 1e-9) { boom = p.pos.clone(); break; }
          const hit = nadeTick(p, this.world, p.st, this.vehicles);                   // 12.193 ortak adım: fizik + araç gövdesinden sekme (12.178) + fünye (flaş: ilk değmeden 0,7 sn)
          p.steps++;
          if (hit > 1.2 && ++p.bounces < 8 && !this.headless) bounceSfx(this.sfx, p.pos, hit);
          if (p.fuse <= 1e-9) boom = p.pos.clone();
        }
        if (!this.headless) {
          const k = Math.max(0, 1 - p.age / 0.18);
          p.mesh.position.copy(p.pos).addScaledVector(p.vis, k);
          if (!p.rest) { const sp = Math.min(1, p.vel.length() / 6); p.mesh.rotation.x += dt * 9 * sp; p.mesh.rotation.z += dt * 5 * sp; }
        }
        if (p.pred && p.age > 1.6 + (this.online?.stats.rtt || 0) / 1000) { this.scene.remove(p.mesh); this.projectiles.splice(i, 1); continue; }   // sunucu onaylamadı (atış reddedildi)
      } else {
        p.fuse -= dt;
        p.vel.y -= 8 * dt;
        const step = p.vel.clone().multiplyScalar(dt), L = step.length();
        if (L > 1e-5) {
          const d = step.clone().normalize();
          const wh = this.world.raycast(p.pos, d, L + 0.05, (this._ph ||= {}));
          const vr = this.vehicles?.raycast(p.pos, d, wh ? wh.t : L + 0.05);            // 12.177: bomba araca çarpar
          if (vr && vr.v !== p.owner.veh) boom = new THREE.Vector3(vr.point.x, vr.point.y, vr.point.z).addScaledVector(d, -0.15);
          else if (wh) boom = wh.point.clone().addScaledVector(wh.normal, 0.15);
          else p.pos.add(step);
        }
        p.mesh.position.copy(p.pos);
        p.mesh.lookAt(p.pos.clone().add(p.vel));
        if (!boom) {
          // doğrudan düşmana isabet
          for (const e of this.soldiers) {
            if (!e.alive || e === p.owner || e.team === p.owner.team) continue;
            if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 0.7 && p.pos.y > e.pos.y && p.pos.y < e.pos.y + e.height) { boom = p.pos.clone(); break; }
          }
        }
        if (p.fuse <= 0 && !boom) boom = p.pos.clone();
      }
      if (boom && this.online) { p.hold = 3; continue; }        // sunucudaki 'boom' olayı etkiyi ve silmeyi yapar
      if (boom) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        const gt = p.st.gtype;
        this.netEvent({ e: 'boom', id: p.id, k: gt === 'smoke' ? 's' : gt === 'flash' ? 'f' : 'x', p: v3(boom), r: p.st.radius, w: STAT_ID.get(p.st), by: p.owner.id });
        if (gt === 'smoke') spawnSmoke(this, boom, p.st, p.owner);
        else if (gt === 'flash') flashBang(this, boom, p.owner, p.st);
        else if (p.type === 'grenade' && p.st.kind === 'throwable') this.fragBlast(boom, p.st, p.owner, p.inHand ? 9 : undefined);      // 12.193 PUBG tarzı parça tesiri (öldürücü iç yarıçap + düşüş, siper)
        else this.explode(boom, p.st.radius, p.st.dmg, p.owner, p.st.name, p.inHand ? 9 : undefined, p.type === 'rocket' ? 'at' : 'blast');      // 12.178: RPG tanksavar
      }
    }
  }

  // selfMul: atanın kendi hasar çarpanı (varsayılan TUNE.selfBlast; elde patlayan bomba öldürür). Duvar arkası: patlamadan gövde merkezi YA DA başa açık hat yoksa hasar yok.
  // 12.188 opt (tank topu HE): { he, inner, vehInner, n } — he: iri patlama efekti / sarsıntı + askere uzaklık gövde EKSENİNE (yere düşen mermi ayaktan
  // ölçülür), görüş çıkışı yüzey normali yönünde 0,3 m (+ yere düşende 0,7 m yukarıdan ikinci çıkış: arazinin kıl payı tümseği parçacığı kesmez),
  // hasar inner içinde tam → radius'ta 0 (heFalloff), daha güçlü itme. İz (kurum) çevrim içi istemcide de çizilir (eskiden yalnız yetkili tarafta).
  explode(pos, radius, dmg, owner, name, selfMul, kind = 'blast', opt = null) {
    const he = !!opt?.he;
    this.effects.explosion(pos, radius);
    if (he) this.effects.heBlast?.(pos, opt.n);
    this.sfx.explosion(pos, he);
    this.alertNear(pos, owner.team, he ? 140 : 90);
    const dc = pos.distanceTo(this.camera.position);
    this.effects.shake = Math.max(this.effects.shake, he ? clamp(1 - dc / 60, 0, 1) * 1.6 : clamp(1 - dc / 35, 0, 1) * 1.1);
    if (!this.headless) {
      const dn = new THREE.Vector3(0, -1, 0);
      const gh = this.world.raycast(new THREE.Vector3(pos.x, pos.y + 1, pos.z), dn, 6, {});
      if (gh) this.effects.decal(gh.point, gh.normal, true);
    }
    if (this.online) return;                // hasar sunucuda
    this.vehicles?.blast(pos, radius, dmg, owner, name, kind, opt);               // 12.177: araç hasarı (gövdeye en yakın noktadan) · 12.178 kind 'at' = tanksavar (RPG, tank topu)
    const o = pos.clone(); if (opt?.n) o.addScaledVector(opt.n, 0.3); o.y += 0.3;
    let o2 = null;
    if (he && !(opt.n && opt.n.y < 0.7)) { o2 = pos.clone(); o2.y += 0.7; if (!this.world.clear(o, o2)) o2 = null; }      // yalnız yere düşen mermide (duvarın / kum torbasının yüzüne çarpan merminin arkası korunur)
    const W = this.world, inner = opt?.inner;
    for (const e of this.soldiers) {
      if (!e.alive) continue;
      if (e.team === owner.team && e !== owner) continue;
      if (this.vehicles?.hiddenSeat(e)) continue;                                   // 12.178: tank içindeki sürücü zırh arkasında (araçla birlikte ölür)
      const c = e.center(new THREE.Vector3());
      const d = he ? Math.hypot(e.pos.x - pos.x, clamp(pos.y, e.pos.y + 0.15, e.pos.y + e.height - 0.1) - pos.y, e.pos.z - pos.z) : c.distanceTo(pos);
      if (d > radius) continue;
      const eye = e.eye(_xe);
      if (!W.clear(o, c) && !W.clear(o, eye)) {
        if (!he) continue;
        const kn = (this._xk ||= new THREE.Vector3()).set(e.pos.x, e.pos.y + 0.45, e.pos.z);
        if (!W.clear(o, kn) && !(o2 && (W.clear(o2, c) || W.clear(o2, eye)))) continue;
      }
      const f = inner != null ? heFalloff(d, radius, inner) : 1 - (d / radius) ** 2;
      let a = dmg * f;
      if (e === owner) a *= selfMul ?? TUNE.selfBlast;
      e.takeDamage(a, owner, 'body', pos, name);
      const kb = he ? 3 + 4 * f : 3;
      e.vel.x += (c.x - pos.x) / (d + 0.5) * kb; e.vel.z += (c.z - pos.z) / (d + 0.5) * kb;
    }
  }

  // ───── Mod: hedef ele geçirme + bilet ─────
  updateMode(dt) {
    if (this.timeLeft !== Infinity) this.timeLeft -= dt;
    if (this.payload) this.payload.update(dt);                                     // vagon: itme / çekişme / geri kayma, kontrol noktası, uzatma
    if (this.mode.infection) {
      const c = this.infCounts(); this.tickets.blue = c.h; this.tickets.red = c.z;
      if (!this.headless && (this.groanT = (this.groanT || 0) - dt) <= 0) {                 // yakındaki zombiler ara sıra inler
        this.groanT = 2.5 + Math.random() * 3;
        const near = this.soldiers.filter((s) => s.alive && s.def.zombie && s !== this.playerSoldier && s.pos.distanceTo(this.camera.position) < 45);
        if (near.length) this.sfx.zombie(near[Math.floor(Math.random() * near.length)].pos);
      }
    }
    this.capT -= dt;
    if (this.capT <= 0) {
      const step = 0.1;
      this.capT = Math.max(0, this.capT + step);                                   // 12.191 biriktirerek: eskiden "= step" → 60 Hz'de 7 adımda bir (0,117 sn), 30 Hz'de 4 adımda bir; gerçek hız kare hızına bağlıydı, HUD tahmini tutmazdı
      for (const o of this.mode.objectives) {
        let b = 0, r = 0;
        for (const s of this.soldiers) {
          if (!s.alive) continue;
          if (this.inObjective(s.pos, o)) (s.team === 'blue' ? b++ : r++);
        }
        o.nb = b; o.nr = r;                                                        // 12.191 alandaki sayılar (HUD + snapshot: istemci aynı sayıyı gösterir)
        const rate = this.capRate(o);                                              // Cephe: yalnız etkin nokta (zincirin geri kalanı kilitli → 0)
        if (rate !== 0) {
          const prev = o.owner;
          o.p = clamp(o.p + rate * step, -1, 1);
          if (o.p >= 1 && o.owner !== 'blue') o.owner = 'blue';
          else if (o.p <= -1 && o.owner !== 'red') o.owner = 'red';
          else if (o.owner === 'blue' && o.p <= 0) o.owner = null;
          else if (o.owner === 'red' && o.p >= 0) o.owner = null;
          if (o.owner !== prev) this.onFlag(o, prev);
        }
      }
    }
    this.front?.update();                                                          // Cephe: etkin nokta alındı → cephe kayar (+ nokta farkı kanaması)
    this.bleedT -= dt;
    if (this.bleedT <= 0 && !this.front) {
      this.bleedT = TUNE.bleed;
      const nb = this.mode.objectives.filter((o) => o.owner === 'blue').length;
      const nr = this.mode.objectives.filter((o) => o.owner === 'red').length;
      if (nb > nr) this.tickets.red -= nb - nr;
      else if (nr > nb) this.tickets.blue -= nr - nb;
    }
    // sıhhiye aurası + ikmal
    this.medicT -= dt;
    if (this.medicT <= 0) {
      this.medicT = 0.5;
      for (const m of this.soldiers) {
        if (!m.alive || m.cls !== 'medic') continue;
        for (const a of this.soldiers) {
          if (a === m || !a.alive || a.team !== m.team || a.hp >= a.maxHp) continue;
          if (Math.hypot(a.pos.x - m.pos.x, a.pos.z - m.pos.z) < TUNE.medicRadius) a.heal(TUNE.medicHeal);
        }
      }
    }
    this.resupplyT -= dt;
    if (this.resupplyT <= 0) {
      this.resupplyT = 2;
      for (const s of this.soldiers) {
        if (!s.alive) continue;
        const bz = this.map.baseZones && this.map.baseZones[s.team];
        const sp = this.map.spawns[s.team][0];
        const home = bz ? (s.pos.x > bz.minX - 3 && s.pos.x < bz.maxX + 3 && s.pos.z > bz.minZ - 3 && s.pos.z < bz.maxZ + 3) : Math.hypot(s.pos.x - sp.x, s.pos.z - sp.z) < 14;
        const own = this.mode.objectives.some((o) => o.owner === s.team && Math.hypot(s.pos.x - o.x, s.pos.z - o.z) < o.r);
        if (!home && !own) continue;
        for (const it of s.items) {
          const st = WSTATS[it.id];
          if ((st.kind === 'gun' || st.kind === 'launcher') && st.reserve) it.reserve = Math.min(st.reserve, it.reserve + Math.ceil(st.reserve * TUNE.resupply));
        }
      }
    }
    this.checkEnd();
  }

  onFlag(o, prev) {
    if (this.map.big) this.squadT = Math.min(this.squadT, 1);                     // 12.189: bayrak el değişti → cephe görevleri 1 sn içinde yeniden
    this.emit('flag', { o, prev });
    if (this.headless || this.front) return;                                      // Cephe: bildirim front.js'te (cephe kayması)
    this.hud.flagEvent?.(o, prev);                                               // 12.191: bildirim ("A — Radar Tepesi ele geçirildi") + öldürme akışı + kazanma / kaybetme sesi (captureHud.js)
  }

  // ───── Silah Yarışı ─────
  ggAdvance(s) {
    s.setLevel(s.ggLevel + 1);
    this.netEvent({ e: 'lvl', v: s.id, l: s.ggLevel });
    this.showLevel(s, true);
  }
  ggDemote(v) {
    v.ggLevel = Math.max(0, v.ggLevel - 1);                                    // ölü: yeni seviye doğuşta uygulanır (spawn → ggItems)
    this.netEvent({ e: 'lvl', v: v.id, l: v.ggLevel });
    if (v.isPlayer && !this.headless) this.hud.toast($t('hud.t.knifed', { n: v.ggLevel + 1, m: GG_LADDER.length }), '#ff8a6a');
  }
  showLevel(s, up) {
    if (!s.isPlayer || this.headless) return;
    const nm = WSTATS[GG_LADDER[Math.min(s.ggLevel, GG_LADDER.length - 1)]].name;
    this.hud.popup(`SEVİYE ${s.ggLevel + 1}/${GG_LADDER.length} · ${nm}`, true);
    if (up) this.sfx.capture?.();
  }

  onKill(killer, victim, weapon, hs) {
    if (this.mode.gungame && killer && killer !== victim) {
      const knife = killer.stat.kind === 'melee';
      if (killer.ggLevel >= GG_LADDER.length - 1) { if (knife) this.ggWinner = killer; }          // son seviye (bıçak): bıçakla öldüren kazanır
      else this.ggAdvance(killer);
      if (knife && victim.ggLevel > 0) this.ggDemote(victim);                                       // bıçakla öldürülen bir seviye geriler
    }
    if (this.mode.scoreBased) { if (killer && killer.team !== victim.team) this.tickets[killer.team] += 1; }      // TDM: öldürmek takıma 1 skor
    else if (!this.ffa) this.tickets[victim.team] -= 1;                                                  // Cephe dahil (12.161: iki tarafa simetrik bilet)
    const P = this._pen && this._pen.by === killer ? this._pen : null;                              // 12.164: tek mermiyle birden çok öldürme (delip geçme)
    const pn = P ? P.idx : 0, pc = P ? ++P.kills : 0;
    const kev = { e: 'kill', k: killer ? killer.id : -1, v: victim.id, w: weapon || '', hs: hs ? 1 : 0 };
    if (pn) kev.pn = pn; if (pc > 1) kev.pc = pc;
    this.netEvent(kev);
    if (!this.mode.infection) for (const b of this.brains) b.onMateDown?.(victim, killer);          // 12.152: yakındaki takım arkadaşları düştüğü yere bakar / araştırır
    this.hud.killFeed(killer, victim, weapon, hs, pn);
    if (killer && killer.isPlayer && killer !== victim) this.killfx.kill(victim, weapon, hs, undefined, { pn, pc });
    if (victim.isPlayer) this.killfx.died();
    if (this.mode.infection) {
      if (!victim.def.zombie) victim.infectNext = true;                                            // her insan ölümü enfekte eder
      else victim.zLives = Math.max(0, victim.zLives - 1);                                         // zombi / boss can hakkı eksilir; 0 olunca insan olarak doğar
      victim.revivable = false;
      victim.respawnT = !victim.def.zombie || victim.zLives <= 0 ? (victim.isPlayer || victim.human ? TUNE.respawn : rand(TUNE.botRespawnMin, Math.min(TUNE.botRespawnMax, 5))) : victim.boss ? BOSS.respawn : ZOMBIE.respawn;
    } else if (this.mode.gungame) victim.respawnT = victim.isPlayer || victim.human ? TUNE.respawnGG : rand(2.2, 3.6);
    else if (this.mode.paintball) victim.respawnT = victim.isPlayer || victim.human ? TUNE.respawnPB : rand(TUNE.respawnPB * 0.8, TUNE.respawnPB * 1.2);
    else victim.respawnT = victim.isPlayer || victim.human ? TUNE.respawn : rand(TUNE.botRespawnMin, TUNE.botRespawnMax);
    if (this.payload) victim.respawnT *= victim.team === 'blue' ? TUNE.plAtkRespawn : TUNE.plDefRespawn;
    if (this.front) victim.respawnT *= this.front.respawnMul(victim.team);                                  // Cephe: doğma süresi çarpanı (admin)     // Vagon: saldıran daha çabuk, savunan biraz geç doğar (dalga dengesi)
    if (victim.isPlayer && this.player) this.player.camPos.copy(victim.eye());
  }

  checkEnd() {
    if (this.ended || this.opts.devMode) return;                                  // geliştirici modunda maç bitmez
    let w = null, why = '';
    if (this.mode.gungame) {
      const best = ffaRanking(this.soldiers, true)[0];
      if (this.ggWinner) { w = this.ggWinner.team; why = $t('end.ggKnife', { n: this.ggWinner.name }); }
      else if (this.timeLeft <= 0 && best) { w = best.team; why = $t('end.ggTime', { n: best.name, l: best.ggLevel + 1 }); }
    } else if (this.ffa) {
      const [best, second] = ffaRanking(this.soldiers, false);
      if (best && best.kills >= this.mode.killLimit) { w = best.team; why = $t('end.dmReach', { n: best.name, k: best.kills }); }
      else if (this.timeLeft <= 0 && best) { w = best.team; why = $t('end.dmTime', { n: best.name, k: best.kills }) + (second && second.kills === best.kills ? $t('end.dmTie') : ''); }   // eşit öldürmede puan ayırır
    } else if (this.front) {
      const r = this.front.result();
      if (r) [w, why] = r;
    } else if (this.payload) {
      const r = this.payload.result();
      if (r) [w, why] = r;
    } else if (this.mode.infection) {
      const c = this.infCounts();
      if (c.h <= 0) { w = 'red'; why = $t('end.infAll'); }
      else if (c.z <= 0 && this.time > 2) { w = 'blue'; why = $t('end.infCured'); }
      else if (this.timeLeft <= 0) { w = 'blue'; why = $t('end.infSurv', { n: c.h }); }
    } else if (this.mode.scoreBased) {
      const lim = this.mode.tickets;
      if (this.tickets.blue >= lim) { w = 'blue'; why = $t('end.tdmBlue', { n: lim }); }
      else if (this.tickets.red >= lim) { w = 'red'; why = $t('end.tdmRed', { n: lim }); }
      else if (this.timeLeft <= 0) { w = this.tickets.blue >= this.tickets.red ? 'blue' : 'red'; why = $t('end.time'); }
    } else if (this.tickets.blue <= 0) { w = 'red'; why = $t('end.blueOut'); }
    else if (this.tickets.red <= 0) { w = 'blue'; why = $t('end.redOut'); }
    else if (this.timeLeft <= 0) { w = this.tickets.blue >= this.tickets.red ? 'blue' : 'red'; why = $t('end.time'); }
    if (!w) return;
    this.ended = true;
    this.running = false;
    if (this.headless) { this.winner = w; this.endReason = why; this.emit('end', { winner: w, why }); return; }
    this.showEndScreen(w, why);
  }

  // Sonuç ekranı + sonraki maç akışı (EndFlow: oylama / seçim kartları, geri sayım; ana menüye kendiliğinden dönülmez). net: çevrimiçi 'end' mesajı
  showEndScreen(w, why, net = null) {
    if (this.payload && w === 'blue' && !this.payload.done && this.payload.netD > this.payload.end - 4) this.payload.finish();   // çevrimiçi: 'end' mesajı son snapshot'tan önce gelir
    if (this.payload?.done && !this._plEndShown) { this._plEndShown = true; setTimeout(() => { if (this.renderer) this.showEndScreen(w, why, net); }, 2200); return; }   // Vagon: önce kapının patlaması görünsün
    document.exitPointerLock?.();
    const me = this.playerSoldier;
    const win = w === me.team;
    const list = this.soldiers.filter((s) => (this.ffa ? !s.vacant : s.team === me.team)).sort((a, b) => b.score - a.score);
    const xp = Math.round(me.score + (win ? 300 : 80));
    const inf = this.mode.infection;
    const wname = this.ffa ? (this.soldiers.find((s) => s.team === w)?.name || '') : inf ? (w === 'red' ? t('match.zombies') : t('match.humans')) : TEAMS[w].name;
    const gg = this.mode.gungame, best = list[0] ? t('match.teamBest', { name: list[0].name, score: list[0].score }) : '';
    const tb = Math.max(0, Math.round(this.tickets.blue)), tr = Math.max(0, Math.round(this.tickets.red));
    const sub = this.front ? t('front.endSub', { b: this.front.owned('blue'), r: this.front.owned('red'), n: this.front.n, sh: this.front.shifts, tb, tr, best: list[0].name, score: list[0].score }) : this.payload ? t('payload.endSub', { pct: Math.round(this.payload.progress * 100), cp: this.payload.reached, best: list[0].name, score: list[0].score }) : this.ffa ? `${t('match.rank')}: ${ffaRanking(this.soldiers, gg).slice(0, 3).map((s, i) => `${i + 1}. ${s.name} (${gg ? t('match.lvl') : ''}${ffaMetric(s, gg)})`).join(' · ')}` : `${t(inf ? 'match.humZom' : 'match.blueRed', { b: tb, r: tr })} · ${best}`;
    const rows = `<div class="mvp"><div class="st"><b>${me.kills}</b><small>${t('match.kills')}</small></div><div class="st"><b>${me.assists || 0}</b><small>${t('match.assists')}</small></div><div class="st"><b>${me.deaths}</b><small>${t('match.deaths')}</small></div><div class="st"><b>${me.score}</b><small>${t('match.score')}</small></div><div class="st"><b>+${xp}</b><small>${t('match.xp')}</small></div></div><small style="opacity:.75">${sub}</small>`;
    this.opts.onMatchEnd?.({ score: me.score, kills: me.kills, assists: me.assists || 0, deaths: me.deaths, win });
    this.hud.showEnd(win, win ? t('match.victory') : t('match.defeat'), this.ffa ? t('match.wonFfa', { why }) : t('match.won', { why, team: wname }), rows);
    if (!this.opts.editor) { this.endFlow?.dispose(); this.endFlow = new EndFlow(this, net); }
  }

  onNetVotes(m) { this.endFlow?.votes(m); }

  exit() { this.dispose(); this.opts.onExit?.(); }
  // next: çevrimdışı sonraki maç { map, tod, weather } (yoksa aynı ayarlar)
  restart(next) { this.dispose(); this.opts.onRestart?.(next); }

  // keepNet: çevrimiçi odada sonraki maça geçiş — bağlantı ve tam ekran korunur, yeni Game aynı NetClient ile kurulur
  dispose(keepNet = false) {
    this.running = false;
    if (this.headless) return;
    this.endFlow?.dispose(); this.endFlow = null;
    if (!keepNet) this.online?.ws.close();
    this.mapEditor?.dispose();
    this.payload?.dispose();
    this.front?.dispose();
    this.vehView?.dispose(); this.vehHud?.dispose();
    this._badge?.remove(); this._tm?.remove();
    if (this._km) document.removeEventListener('keydown', this._km);
    cancelAnimationFrame(this.raf);
    this.weather?.dispose();
    document.exitPointerLock?.();
    document.removeEventListener('pointerlockchange', this._plc);
    removeEventListener('beforeunload', this._bu); this.lockKeys(false); if (document.fullscreenElement && !keepNet) document.exitFullscreen?.().catch(() => {});
    document.removeEventListener('keydown', this._kd);
    document.removeEventListener('pointerlockerror', this._ple); document.removeEventListener('keydown', this._esc); clearTimeout(this._lockT);
    clearTimeout(this._lockT);
    removeEventListener('resize', this._rs);
    this.player.dispose();
    this.nadeView?.dispose();
    this.abfx?.dispose();
    this.chat?.dispose();
    this.killfx.dispose();
    this.hud.dispose(); this.objFx?.dispose();
    this.sfx.dispose?.();
    this.post?.dispose();
    this.renderer.dispose();
    this.canvas.remove();
    if (window.__game === this) delete window.__game;
  }
}

const _sv = new THREE.Vector3(), _sq = new THREE.Quaternion(), _xe = new THREE.Vector3();
function lerpClamp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }
