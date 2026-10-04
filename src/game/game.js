import * as THREE from 'three';
import { setupEnvironment } from '../maps/environment.js';
import { MAPS, DEFAULT_MAP } from '../maps/index.js';
import { World } from './collision.js';
import { Binds } from '../core/keybinds.js';
import { music } from './music.js';
import { NavGrid } from './nav.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { Hud } from './hud.js';
import { Soldier } from './soldier.js';
import { Player } from './player.js';
import { BotBrain } from './bot.js';
import { CLASS_DEFS, WSTATS, BOT_NAMES, makeLoadout, BLEED_S, ZOMBIE, BOSS, ZTYPES, ZT_ORDER, randomZType } from './stats.js';
import { makeMatch, PRESETS } from './match.js';
import { Weather } from './weather.js';
import { rand, pick, clamp } from './util.js';
import { TEAMS } from '../core/palette.js';
import { nullSink } from '../sim/nullSink.js';
import { applyInput } from '../sim/input.js';
import { SIM_DT } from '../net/protocol.js';
import { mat } from '../core/geo.js';
import { initGadgets, updateGadgets, spawnSmoke, flashBang, smokeBlocks, smokeDensity, placeDeployable, netDeploy, netUndeploy } from './gadgets.js';

const STAT_ID = new Map(Object.entries(WSTATS).map(([k, v]) => [v, k]));      // WSTATS nesnesi → id (ağ olayları için)
const r2 = (v) => Math.round(v * 100) / 100;
const v3 = (p) => [r2(p.x), r2(p.y), r2(p.z)];

const UP = new THREE.Vector3(0, 1, 0);

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
    this.humans = new Map();      // sunucu: savaşçı id → { s, queue, last, stale, ack, tickAck }
    this.classDefs = CLASS_DEFS;
    this.pendingClass = null;
    this.pathBudget = 3;
    this.medicT = 0; this.resupplyT = 0; this.bleedT = BLEED_S; this.capT = 0;

    // ── renderer ──
    let r = null;
    this.scene = new THREE.Scene();
    if (!headless) {
      r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(devicePixelRatio, this.settings.pixelRatio || 1.5));
      r.setSize(innerWidth, innerHeight, false);   // CSS boyutunu biz belirleriz (yüksek DPI'da tuval taşmasın)
      r.autoClear = false;
      r.shadowMap.enabled = this.settings.shadows !== false;
      r.shadowMap.type = THREE.PCFShadowMap;
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
    } else this.map = this.mapDef.build();
    this.tod = opts.tod || 'day';
    if (headless) {
      this.night = this.tod === 'night';
      this.sun = null;
      this.scene.add(this.map.group);
    } else {
      const env = setupEnvironment(this.scene, r, { shadowSize: 55, sunPos: this.map.env?.sunPos || [55, 85, 40], env: this.map.env, tod: this.tod });
      const sp = env.sunPos;
      this.sun = env.sun;
      this.night = env.night;
      this.sun.shadow.mapSize.set(2048, 2048);
      this.sunOff = new THREE.Vector3(...sp);
      this.scene.add(this.map.group);
      env.applyGlow(this.map.group);
    }
    this.terrain = this.map.terrain || null;
    this.world = new World(this.map.colliders, this.map.bounds, this.terrain);
    this.nav = new NavGrid(this.map.colliders, this.map.bounds, this.terrain);

    // opts.match: özel maç ayarları; opts.mode: '3v3' | '10v10' hazır ayarı (test/uyumluluk)
    this.mode = makeMatch(opts.match || PRESETS[opts.mode] || {});
    // 3. şahıs kamera (H): odada izinli mi? sunucu açıkça true ister; offline varsayılan açık
    this.thirdAllowed = opts.online ? !!opts.online.cfg?.third : headless ? opts.third === true : opts.third !== false;
    this.ffa = this.mode.type === 'dm';                          // Ölüm Maçı: herkes tek, her savaşçının kendi takım kimliği
    if (this.ffa) {
      // Haritanın doğma noktaları iki üste ait; ölüm maçında bunun yerine TÜM haritadan ulaşılabilir, aralıklı rastgele noktalar kullanılır
      const base = this.map.spawns.blue[0];
      const pool = this.nav.spreadPoints(this.nav.reachable(base.x, base.z), { spacing: 14, max: 160 }).map((p) => ({ ...p, ry: 0 }));
      const all = pool.length >= 20 ? pool : [...this.map.spawns.blue, ...this.map.spawns.red];     // güvenlik: nokta bulunamazsa üsler
      this.dmPool = all;
      for (let i = 0; i < 32; i++) this.map.spawns['f' + i] = all;
      this.map.baseZones = null;                                    // üs cezası yok
    }
    this.mode.objectives = this.mode.type !== 'conquest' ? [] : this.map.objectives.filter((o) => this.mode.allFlags || o.core).map((o) => ({ ...o, owner: null, p: 0 }));
    this.tickets = this.mode.scoreBased ? { blue: 0, red: 0 } : { blue: this.mode.tickets, red: this.mode.tickets };   // skor modunda: takım skoru 0'dan başlar, mode.tickets = sınır
    this.timeLeft = this.mode.time || Infinity;
    this.spawnChoice = 'base';

    this.visMul = 1;
    initGadgets(this);
    if (headless) {
      this.effects = nullSink({ shake: 0 });
      this.sfx = nullSink();
      this.weather = nullSink();
      this.visMul = opts.weather === 'fog' ? 0.5 : opts.weather === 'rain' ? 0.8 : 1;   // Weather'ın bot görüşüne etkisi
    } else {
      this.effects = new Effects(this.scene);
      this.sfx = new Sfx();
      this.sfx.setVolume(this.settings.volume);
      this.sfx.setMix({ sfx: this.settings.vSfx ?? 1, amb: this.settings.vAmb ?? 1, rain: this.settings.rainSound !== false });
      this.sfx.init();
      music.setVolume((this.settings.volume ?? 0.6) * (this.settings.vMusic ?? 0.5));
      music.play('match');
      this.weather = new Weather(this, opts.weather || 'clear');
    }

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
        const s = new Soldier(this, { id: id++, name: isPlayer ? (opts.playerName || 'Sen') : nameOf(id), team, cls: isPlayer ? opts.cls : order[i % order.length], isPlayer });
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
      this.playerSoldier = null;
      this.HN = 40;                                            // lag compensation geçmişi (adım)
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
    this.player = new Player(this, this.playerSoldier, this.settings);
    this.player.locked = !!opts.nolock;

    // olaylar
    this.on('hitmark', (e) => {
      this.hud.hitmarker(e.dead, e.zone === 'head');
      if (e.dead) this.sfx.kill(); else if (e.zone === 'head') this.sfx.headshot(); else this.sfx.hit();
    });
    document.addEventListener('keydown', this._kd = (e) => {
      if (!this.binds.is('flashlight', e.code) || e.repeat || !this.running || this.ended || !this.playerSoldier.alive || this.playerSoldier.def.zombie) return;      // zombi: aynı tuş özel güç
      this.torchOn = !this.torchOn;
      this.torch.intensity = this.torchOn ? (this.night ? 140 : this.tod === 'sunset' ? 45 : 0) : 0;
      this.playerSoldier.flashOn = this.torchOn && this.torch.intensity > 0;
      this.hud.toast(this.torchOn ? (this.torch.intensity ? 'Fener açık' : 'Fener (gündüz gerekmez)') : 'Fener kapalı', '#ffe6a8');
    });
    document.addEventListener('pointerlockchange', this._plc = () => {
      const locked = document.pointerLockElement === this.canvas;
      if (locked) { this.lockFails = 0; this.player.skipMove = 2; }                 // kilit anındaki ilk fare olayı genelde zıplar: atla
      else {
        this._unlockAt = performance.now();
        this.player.fireHeld = false; this.playerSoldier.ads = false;                // kilit kopunca takılı ateş/nişan kalmasın
      }
      this.player.locked = locked || !!this.opts.nolock;
      if (!this.ended) this.hud.setPaused(!this.player.locked);
      this.simulate = this.player.locked || this.ended;
    });
    document.addEventListener('pointerlockerror', this._ple = () => this.onLockError());
    addEventListener('resize', this._rs = () => {
      this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight, false);
    });

    if (this.online) {
      this._acc = 0;
      this.online.attach(this);        // ilk snapshot doğmayı belirler (respawn yok)
      this.onNetEvents(opts.online.deps || []);     // odada zaten kurulu mayın/cephane kutuları
      const code = opts.online.room;
      const b = (this._badge = document.createElement('div'));
      b.style.cssText = 'position:fixed;left:12px;top:178px;z-index:6;padding:6px 10px;background:rgba(8,12,18,.72);border:1px solid rgba(255,255,255,.14);color:#e8edf5;font:600 13px Bahnschrift,Rajdhani,Arial Narrow,sans-serif;letter-spacing:1.5px;cursor:pointer;user-select:none';
      b.title = 'Tıkla: oda bağlantısını kopyala';
      b.onclick = () => {
        const link = `${location.origin}${location.pathname}?online=${code}`;
        (navigator.clipboard?.writeText(link) || Promise.reject()).then(() => this.hud.toast('Oda bağlantısı kopyalandı: ' + code, '#9be07f'), () => this.hud.toast('Oda kodu: ' + code, '#9be07f'));
      };
      document.body.appendChild(b);
      this._badgeT = 0; this._badgeCode = code;
      this.online.roster = opts.online.roster;
      document.addEventListener('keydown', this._km = (e) => {                    // M: takım seçimi
        if (this.binds.is('team', e.code) && !e.repeat && !this.ended) { e.preventDefault(); this.toggleTeamMenu(); }
        else if (e.code === 'Escape' && this._tm) this.toggleTeamMenu(false);
      });
    } else for (const s of this.soldiers) this.respawn(s, true);
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
    const k = all.length < ZOMBIE.bossSplit ? ZOMBIE.bossCount[0] : ZOMBIE.bossCount[1];
    const pool = [...all].sort(() => Math.random() - 0.5);
    for (const s of all) if (s.team !== 'blue') { s.team = 'blue'; s.setClass(s.cls === 'zombie' ? 'assault' : s.cls); }       // hepsi insan olarak başlar
    for (let i = 0; i < k; i++) this.makeZombie(pool[i], true);
    // zombi doğma havuzu: haritanın her yerinden ulaşılabilir, aralıklı noktalar (insanlara yakın ama ezici değil)
    const base = this.map.spawns.blue[0];
    this.infPool = this.nav.spreadPoints(this.nav.reachable(base.x, base.z), { spacing: 16, max: 120 }).map((p) => ({ ...p, ry: 0 }));
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
    if (s.isPlayer && !this.headless) { this.hud.toast('ENFEKTE OLDUN — zombi olarak doğuyorsun', '#b6ff6a'); this.sfx.zombie?.(s.pos); }
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
    if (s.isPlayer && !this.headless) this.hud.toast(wasBoss ? 'BOSS DEVRİLDİ — insan oldun' : 'İYİLEŞTİN — yeniden insansın', '#7ec8ff');
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

  // Zombi doğma noktası: canlı insanlara yakın ama en az 38 m uzakta (üstlerine doğmasın)
  pickZombieSpawn(s, first) {
    const humans = this.soldiers.filter((e) => e.alive && e.team === 'blue');
    const pts = first || !humans.length ? this.map.spawns.red : this.infPool;
    let best = null, bs = -1e9;
    for (let k = 0; k < 18; k++) {
      const p = pick(pts);
      if (this.soldiers.some((e) => e !== s && e.alive && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 1.3)) continue;
      let dmin = 1e9;
      for (const e of humans) dmin = Math.min(dmin, Math.hypot(e.pos.x - p.x, e.pos.z - p.z));
      const sc = dmin >= 38 ? 200 - dmin + Math.random() * 25 : dmin - 400;        // yeterince uzak olanlardan en yakını; hiçbiri değilse en uzak
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
    s.choice = { primary: choice.primary, secondary: choice.secondary, gadget: choice.gadget, melee: choice.melee };
    if (!CLASS_DEFS[cls] || cls === 'zombie') cls = s.cls === 'zombie' ? 'zombie' : 'assault';
    if (s.cls !== cls) s.setClass(cls); else s.items = makeLoadout(cls, s.team, s.choice);
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
    s.human = false;
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
    const s = h.s;
    s.update(dt);
    if (s.alive) this.world.move(s, dt);
    if (!s.alive) return;
    s.yaw = inp.yw; s.pitch = Math.max(-1.5, Math.min(1.5, inp.pt));
    s.ads = !!inp.a;
    if (inp.w !== s.cur) s.switchTo(inp.w);
    if (inp.u) s.standUp();
    if (inp.c) s.toggleCrouch();
    if (inp.p) s.toggleProne();
    if (inp.rl) s.startReload();
    if (inp.fm) s.toggleFireMode();
    if (inp.ab) s.useAbility();
    if (inp.o) s.cycleOptic();
    applyInput(s, { f: inp.f, r: inp.r, lean: inp.l, sprint: !!inp.s, jump: !!inp.j }, dt);
    // ateş: Player.update ile aynı mantık
    if (inp.fp) h.fireBuf = 0.15;
    h.fireBuf = Math.max(0, h.fireBuf - dt);
    s.rewindTick = Number.isFinite(inp.vt) ? inp.vt : null;
    // 3. şahıs: kameranın gözden ofseti. Yalnızca odada izinliyse, ≤ 4,5 m ve göz→kamera arasında duvar yoksa kabul edilir; aksi halde atış gözden.
    s.stanceLeft = this.thirdAllowed && !!inp.sd;                      // yalnızca görsel: diğer oyuncular sol omuz duruşunu görsün
    s.shotOff = null;
    if (this.thirdAllowed && Array.isArray(inp.co)) {
      const o = new THREE.Vector3(inp.co[0], inp.co[1], inp.co[2]);
      if (o.length() <= 4.5) { const e = s.eye(), to = e.clone().add(o); if (this.world.clear(e, to)) s.shotOff = o; }
    }
    const st = s.stat;
    if (st.kind === 'melee') { if (inp.fh || h.fireBuf > 0) { if (s.tryFire()) h.fireBuf = 0; } }
    else if (s.triggerUpdate(!!inp.fh, h.fireBuf)) h.fireBuf = 0;
    s.rewindTick = null;
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

  // ───── olaylar ─────
  on(n, fn) { (this.listeners.get(n) || this.listeners.set(n, []).get(n)).push(fn); }
  emit(n, p) { const a = this.listeners.get(n); if (a) for (const f of a) f(p); }

  requestLock() {
    this.sfx.init();
    if (this.opts.nolock) { this.player.locked = true; this.simulate = true; this.hud.setPaused(false); return; }
    if (this.noPointerLock) { this.player.locked = true; this.simulate = true; this.hud.setPaused(false); return; }
    // Chrome, Esc ile çıkıştan hemen sonra (~1,3 sn) yapılan kilit isteğini reddeder: bekleyip sonra iste
    const wait = 1350 - (performance.now() - (this._unlockAt || -1e9));
    if (wait > 0) { clearTimeout(this._lockT); this._lockT = setTimeout(() => this.requestLock(), wait); return; }
    const plain = () => { try { const p = this.canvas.requestPointerLock(); p?.catch?.((err) => this.onLockError(err)); } catch (e) { this.onLockError(e); } };
    try {
      // ham fare girdisi (işletim sistemi hızlandırması yok): daha tutarlı bakış; desteklenmezse normal istek
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      p?.catch?.((err) => { if (err && err.name === 'NotSupportedError') plain(); else this.onLockError(err); });
    } catch (e) { plain(); }
  }

  // Kilit alınamadı: tek seferlik hatada kalıcı "kilitsiz moda" GEÇME (imleç ekranda kalıp bakışı bozuyordu); ancak art arda başarısızsa
  onLockError() {
    this.lockFails = (this.lockFails || 0) + 1;
    if (this.lockFails >= 4 || !this.canvas.requestPointerLock) { this.fallbackLock(); return; }
    this.hud.toast('Fare kilitlenemedi, bir saniye sonra tekrar tıkla', '#ffd27a');
  }

  // Fare kilidi desteklenmiyorsa (gömülü sayfa vb.): ok tuşlarıyla bak, Esc ile duraklat
  fallbackLock() {
    if (this.noPointerLock) return;
    this.noPointerLock = true;
    this.player.locked = true; this.simulate = true;
    this.hud.setPaused(false);
    this.hud.toast('Fare kilitlenemedi · bakmak için ok tuşları, duraklatmak için Esc', '#ffd27a');
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
    const lo = this.opts.loadouts?.[k];                                   // menüde o sınıf için kaydedilen silah/gadget seçimi
    this.requestLoadout(lo || {});                                        // (kayıt yoksa sınıfın varsayılanı)
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
    if (id === 'blink' || id === 'shadow') {
      const hi = (p, c) => { for (let i = 0; i < 3; i++) this.effects.spark(new V(p.x, p.y + 0.4 + i * 0.5, p.z), 10, new V(0, 1, 0), c, 5); };
      hi(from, '#c58cff'); hi(to, '#c58cff');
    } else if (id === 'cloak') this.effects.spark(new V(s.pos.x, s.pos.y + 1, s.pos.z), 14, new V(0, 1, 0), '#7ad7ff', 4);
    else if (id === 'shield') this.effects.spark(new V(s.pos.x, s.pos.y + 1, s.pos.z), 14, new V(0, 1, 0), '#ffb13c', 4);
    else this.effects.spark(new V(s.pos.x, s.pos.y + 1, s.pos.z), 14, new V(0, 1, 0), '#ff4b3a', 4);
    if (s.pos.distanceTo(cam) < 45) this.sfx.zombie(s.pos, true);
  }
  // Ölüm ekranında yükleme değiştir: { primary, secondary, gadget, melee } → bir sonraki doğuşta geçerli (sınıfa uymazsa varsayılan)
  requestLoadout(choice) { this.pendingLoadout = { ...choice }; this.online?.send({ t: 'opt', loadout: { ...choice } }); }

  // ───── doğma ─────
  // Oyuncu doğma noktası seçimi: 'base' ya da sahip olunan hedefin id'si
  spawnOptions(team = this.playerSoldier.team) {
    const out = [{ id: 'base', name: 'Üs', ok: true }];
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

  canForwardSpawn(o, team) {
    if (o.owner !== team) return false;
    for (const e of this.soldiers) if (e.alive && e.team !== team && Math.hypot(e.pos.x - o.x, e.pos.z - o.z) < o.r + 6) return false;
    return true;
  }

  _free(x, z, s) {
    if (!this.nav.isFree(x, z)) return false;
    return !this.soldiers.some((e) => e !== s && e.alive && Math.hypot(e.pos.x - x, e.pos.z - z) < 1.1);
  }

  pickSpawn(team, s) {
    if (this.ffa) {
      // Ölüm maçı: tüm noktalardan rastgele; canlı düşmanlara en uzak olan adaylardan biri seçilir
      const pts = this.map.spawns[team] || this.map.spawns.f0, cx = (this.map.bounds.minX + this.map.bounds.maxX) / 2, cz = (this.map.bounds.minZ + this.map.bounds.maxZ) / 2;
      let best = null, bs = -1;
      for (let k = 0; k < 16; k++) {
        const p = pick(pts);
        if (this.soldiers.some((e) => e !== s && e.alive && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 1.3)) continue;
        let dmin = 1e9;
        for (const e of this.soldiers) if (e !== s && e.alive) dmin = Math.min(dmin, Math.hypot(e.pos.x - p.x, e.pos.z - p.z));
        const sc = Math.min(dmin, 70) + Math.random() * 30;               // düşmandan uzaklık + rastgelelik
        if (sc > bs) { bs = sc; best = p; }
      }
      const p = best || pick(pts);
      return { x: p.x, z: p.z, ry: Math.atan2(-(cx - p.x), -(cz - p.z)) + (Math.random() - 0.5) * 2.2 };   // yaklaşık harita merkezine bakar
    }
    // ileri doğma: seçilen / bot için ara sıra sahip olunan hedefin çevresi
    let target = null;
    const ctl = s ? this.ctlOf(s) : null;
    if (ctl && ctl.spawnChoice !== 'base') target = this.mode.objectives.find((o) => o.id === ctl.spawnChoice);
    else if (s && !ctl && Math.random() < 0.35) {
      const own = this.mode.objectives.filter((o) => o.owner === team && this.canForwardSpawn(o, team));
      if (own.length) target = pick(own);
    }
    if (target && this.canForwardSpawn(target, team)) {
      for (let k = 0; k < 14; k++) {
        const a = Math.random() * Math.PI * 2, rr = target.r * (0.25 + Math.random() * 0.6);
        const x = target.x + Math.cos(a) * rr, z = target.z + Math.sin(a) * rr;
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
    if (ctl && ctl.queue) { ctl.queue.length = 0; ctl.budget = 1; }        // insan: doğmadan önceki eski girdiler (örn. eski silah seçimi) uygulanmasın
    if (ctl && ctl.pendingLoadout) { s.choice = ctl.pendingLoadout; ctl.pendingLoadout = null; s.items = makeLoadout(s.cls, s.team, s.choice); }
    if (ctl && ctl.pendingClass && ctl.pendingClass !== s.cls && !s.def.zombie) s.setClass(ctl.pendingClass);
    if (s.def.zombie) {                                                // yeniden doğan zombi: seçtiği tür; botlar her doğuşta rastgele
      const want = s.boss ? null : ctl ? ctl.pendingZ : randomZType();
      if (want && want !== s.ztype) { s.ztype = want; s.setClass('zombie'); }
      if (ctl) ctl.pendingZ = null;
    }
    s.spawn(s.def.zombie && this.infPool ? this.pickZombieSpawn(s, first) : this.pickSpawn(s.team, s), first ? 1 : 3);
    this.world.settle(s);
    s.zoneT = 0;
    if (s.brain) s.brain.reset();
    if (ctl) ctl.pendingClass = null;
    if (s.isPlayer) this.hud.onPlayerSpawn?.();
  }

  // Düşman üssüne giren: uyarı + hasar (spawn baskınını engeller)
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
    v.hp = v.maxHp * 0.55;
    v.revivable = false;
    this.tickets[v.team] += 1;
    if (v.brain) v.brain.reset();
    medic.score += 80;
    if (v.isPlayer) { this.pendingClass = null; this.hud.onPlayerSpawn?.(); this.hud.toast(`${medic.name} seni canlandırdı`, '#9be07f'); }
    if (medic.isPlayer) { this.hud.popup('+80 CANLANDIRMA'); this.hud.toast(`${v.name} canlandırıldı`, '#9be07f'); }
    this.effects.spark?.(v.pos.clone().setY(v.pos.y + 1), 6, new THREE.Vector3(0, 1, 0));
  }

  // ───── mangal görev dağıtımı: her mangal bir hedefe; takım dengesi + tehdit/ihtiyaç ─────
  squadGoal(s) { return this.squadGoals[s.team]?.[s.squad] || null; }

  assignSquads() {
    const objs = this.mode.objectives;
    if (!objs.length) return;
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
      for (const sq of order) {
        let best = null, bs = -1;
        for (const o of objs) {
          const d = Math.hypot(o.x - home.x, o.z - home.z);
          const sc = need(o) / (1 + load.get(o.id) * 1.7) / (1 + d / 260) + Math.random() * 0.2;
          if (sc > bs) { bs = sc; best = o; }
        }
        this.squadGoals[team][sq] = best;
        load.set(best.id, load.get(best.id) + 1);
      }
    }
  }

  // Keskin nişancı gözetleme noktası: hedefi gören, yüksek/uzak, kendi tarafa yakın nokta
  perch(o, team) {
    const key = o.id + team;
    if (this.perchCache.has(key)) return this.perchCache.get(key);
    const home = this.map.spawns[team][0];
    let best = null, bs = -1e9;
    const oc = new THREE.Vector3(o.x, this.world.heightAt(o.x, o.z) + 1.3, o.z), pe = new THREE.Vector3();
    for (let k = 0; k < 90; k++) {
      const a = Math.random() * Math.PI * 2, d = 26 + Math.random() * 40;
      const x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d;
      if (!this.nav.isFree(x, z)) continue;
      const y = this.world.heightAt(x, z);
      pe.set(x, y + 1.0, z);
      if (!this.world.clear(pe, oc)) continue;
      const sc = (y - this.world.heightAt(o.x, o.z)) * 0.6 + d * 0.05 - Math.hypot(x - home.x, z - home.z) * 0.03 + Math.random();
      if (sc > bs) { bs = sc; best = { x, z }; }
    }
    this.perchCache.set(key, best);
    return best;
  }

  // ───── ana döngü ─────
  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = clamp((now - this.last) / 1000 || 0.016, 0, 0.05);
    this.last = now;
    if (this.online && !this.ended) {
      // çevrimiçi: sunucuyla aynı sabit adım (tahmin birebir tutsun)
      this._acc = Math.min(this._acc + dt, 0.1);
      while (this._acc >= SIM_DT) { this._acc -= SIM_DT; this.stepOnline(SIM_DT); }
    } else if (this.simulate && !this.ended) this.step(dt);
    else if (this.ended) { this.effects.update(dt); for (const s of this.soldiers) s.syncModel(dt); }
    this.render();
  }

  // Çevrimiçi istemci adımı: yalnızca yerel oyuncuyu tahmin eder; diğerleri sunucudan interpolasyonla gelir.
  // Sıra sunucuyla aynı: (güncelle + hareket) sonra girdi → vel.
  stepOnline(dt) {
    this.time += dt;
    this.online.interpolate(performance.now());
    if (this._badge && (this._badgeT -= dt) <= 0) { this._badgeT = 0.5; const rtt = Math.round(this.online.stats.rtt || 0); this._badge.innerHTML = `ODA <b style="color:#ffb347">${this._badgeCode}</b> · ${rtt ? rtt + ' ms' : '…'}`; }
    const me = this.playerSoldier;
    for (const s of this.soldiers) s.update(dt);
    if (me.alive) this.world.move(me, dt); else if (me.respawnT > 0) me.respawnT -= dt;
    this.player.update(dt);
    this.updateProjectiles(dt);
    updateGadgets(this, dt, this.time);
    this.effects.update(dt);
    for (const s of this.soldiers) s.syncModel(dt);
    this.hud.update(dt);
  }

  step(dt) {
    this.time += dt;
    this.pathBudget = 1;
    for (const s of this.soldiers) {
      if (s.human && s.alive) continue;            // canlı insanlar girdi güdümlü (updateHumans)
      s.update(dt);
      if (s.alive) this.world.move(s, dt);
    }
    if (this.player) this.player.update(dt); else this.updateHumans(dt);
    for (const b of this.brains) b.update(dt);
    this.updateProjectiles(dt);
    updateGadgets(this, dt, this.time);
    this.squadT -= dt;
    if (this.squadT <= 0) { this.squadT = 18; this.assignSquads(); }
    this.weather.update(dt);
    this.updateMode(dt);
    this.updateBaseZones(dt);
    for (const s of this.soldiers) {
      if (!s.alive && !this.ended && !s.vacant) {
        s.respawnT -= dt;
        if (s.respawnT <= 0) this.respawn(s);
      }
    }
    this.effects.update(dt);
    for (const s of this.soldiers) s.syncModel(dt);
    this.hud.update(dt);
    if (this.headless) { this.tick++; this.recordHist(); }
  }

  netEvent(ev) { if (this.headless) this.netEvents.push(ev); }

  // ───── çevrimiçi istemci: sunucu olayları ─────
  onNetEvents(list) {
    const me = this.playerSoldier, V = THREE.Vector3;
    for (const ev of list) {
      const by = this.soldiers[ev.by];
      switch (ev.e) {
        case 'sh': {                                  // başkasının atışı: iz, kıvılcım/kan, namlu alevi, ses
          if (!by || by === me) break;
          const st = WSTATS[by.item.id] || {}, o = new V(...ev.o), p = new V(...ev.p);
          const dir = p.clone().sub(o).normalize();
          this.effects.tracer(o, p, st.tracer);
          if (ev.k === 'f') this.effects.blood(p, 7, dir.clone().negate());
          else if (ev.k === 'w') { const n = new V(...ev.n); this.effects.spark(p, 4, n); this.effects.dust(p, n); this.effects.decal(p, n); }
          if (ev.m) { this.effects.muzzle(o, dir); this.sfx.shot(st.sound, by.pos); by.flashT = 0.06; }
          break;
        }
        case 'hm': if (ev.by === me.id) this.emit('hitmark', { zone: ev.hd ? 'head' : 'body', dead: !!ev.dead }); break;
        case 'dmg': if (ev.v === me.id) { this.hud.damageFrom(new V(ev.x, 0, ev.z), me); this.sfx.hurt(); } break;
        case 'kill': {
          const victim = this.soldiers[ev.v], killer = this.soldiers[ev.k] || victim;
          if (!victim) break;
          this.hud.killFeed(killer, victim, ev.w, !!ev.hs);
          if (killer === me && victim !== me) this.hud.popup(ev.hs ? '+150 KAFA ATIŞI' : '+100 ÖLDÜRME', !!ev.hs);
          if (victim === me) me.lastHit = killer;
          break;
        }
        case 'gr': if (by) this.spawnGrenade(by, new V(...ev.o), new V(...ev.v), WSTATS[ev.w], { id: ev.id }); break;
        case 'rk': if (by) this.spawnRocket(by, new V(...ev.o), new V(...ev.d), WSTATS[ev.w], { id: ev.id }); break;
        case 'sl': if (by) this.spawnShell(by, new V(...ev.o), new V(...ev.d), WSTATS[ev.w], { id: ev.id }); break;
        case 'boom': {
          const i = this.projectiles.findIndex((p) => p.id === ev.id);
          if (i >= 0) { this.scene.remove(this.projectiles[i].mesh); this.projectiles.splice(i, 1); }
          const pos = new V(...ev.p);
          if (ev.k === 's') { if (by) spawnSmoke(this, pos, WSTATS[ev.w], by); }
          else if (ev.k === 'f') { if (by) flashBang(this, pos, by, WSTATS[ev.w]); }
          else if (by) this.explode(pos, ev.r, 0, by, '');
          break;
        }
        case 'dep': netDeploy(this, ev); break;
        case 'depx': netUndeploy(this, ev.id); break;
        case 'ammo': if (ev.v === me.id) { this.hud.toast('Mühimmat dolduruldu', '#9be07a'); this.sfx.deploy(me.pos); } break;
        case 'rld': if (by && by !== me) { by.reloadStyle = ev.s; by.reloadTotal = by.reloadT = ev.t; by.reloadEmpty = !!ev.em; by.shellT = ev.sh; } break;
        case 'inf': {                                // bir insan zombi oldu: takım + sınıf (model) değişir
          const v = this.soldiers[ev.v]; if (!v) break;
          v.team = 'red'; v.boss = !!ev.bs; v.zLives = ev.zl ?? 2; v.ztype = ZT_ORDER[(ev.zt || 1) - 1] || 'walker'; v.setClass('zombie');
          if (v === me) { this.hud.toast('ENFEKTE OLDUN — zombi olarak doğuyorsun', '#b6ff6a'); this.sfx.zombie?.(v.pos); }
          break;
        }
        case 'cure': {                              // can hakkı bitti: yeniden insan
          const v = this.soldiers[ev.v]; if (!v) break;
          v.team = 'blue'; v.boss = false; v.zLives = 0; v.cloakNet = false; v.setClass(ev.cls || 'assault');
          if (v === me) this.hud.toast('İYİLEŞTİN — yeniden insansın', '#7ec8ff');
          break;
        }
        case 'ab': if (by) this.showAbilityFx(by, ev.k, { x: ev.f[0], y: ev.f[1], z: ev.f[2] }, { x: ev.d[0], y: ev.d[1], z: ev.d[2] }); break;
        case 'swg': if (by && by !== me) { by.swing = { t: 0, dur: ev.d, kind: ev.k, idx: 0, done: true }; by.comboT = ev.d + 0.38; } break;
      }
    }
  }

  // ───── çevrimiçi: M ile takım seçimi ─────
  toggleTeamMenu(show = !this._tm) {
    if (this.ffa) { if (show) this.hud.toast('Ölüm maçında takım yok: herkes tek', '#cfd3d8'); return; }
    if (this.mode.infection) { if (show) this.hud.toast('Enfekte modunda takım seçilmez', '#cfd3d8'); return; }
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
        <div style="font-size:18px;margin-top:8px"><b>${cnt(t)}</b> / ${cap} oyuncu</div><div style="font-size:13px;opacity:.7;margin-top:2px">${bots(t)} bot</div>
        <div style="font-size:13px;margin-top:10px;letter-spacing:2px">${mine ? 'SENİN TAKIMIN' : full ? 'DOLU' : 'KATIL'}</div></button>`;
    };
    el.innerHTML = `<div style="text-align:center"><div style="font-size:15px;letter-spacing:5px;opacity:.7;margin-bottom:14px">TAKIM SEÇ</div>
      <div style="display:flex;justify-content:center">${card('blue', 'MAVİ', '#4aa3ff')}${card('red', 'KIRMIZI', '#ff5a43')}</div>
      <div id="tmMsg" style="margin-top:16px;font-size:14px;min-height:20px;color:#ffcf7a"></div>
      <div style="margin-top:6px;font-size:13px;opacity:.6">Takım değiştirmek odaya yeniden bağlanır · M veya Esc: kapat</div></div>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-t]');
      if (!b) { if (e.target === el) this.toggleTeamMenu(false); return; }
      if (b.disabled) return;
      el.querySelector('#tmMsg').textContent = 'İstek gönderiliyor…';
      this.online.send({ t: 'team', team: b.dataset.t });
    });
    document.body.appendChild(el);
  }

  onNetTeam(m) {
    const msg = this._tm?.querySelector('#tmMsg');
    if (!m.ok) { if (msg) msg.textContent = m.msg || 'Takım değiştirilemedi'; else this.hud.toast(m.msg || 'Takım değiştirilemedi', '#ff8a7a'); return; }
    if (msg) msg.textContent = 'Geçiliyor…';
    const u = new URL(location.href); u.searchParams.set('team', m.team);        // yeniden katılırken bu takım istenir
    this.ended = true;                                                              // bağlantı kopma ekranı çıkmasın
    this.online?.ws.close();
    location.href = u.toString();
  }

  onNetEnd(m) {
    if (this.ended) return;
    this.ended = true; this.running = false;
    this.showEndScreen(m.winner, m.why);
  }

  onNetRestart() { location.reload(); }          // sunucu odayı yeni maça hazırladı: yeniden katıl

  onNetClosed() {
    if (this.ended) return;
    this.hud.toast('Sunucu bağlantısı koptu', '#ff8a7a');
    this.ended = true; this.running = false;
    this.hud.showEnd(false, 'BAĞLANTI KOPTU', 'Sunucuyla bağlantı kesildi.', '');
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

  render() {
    const r = this.renderer;
    // gölge kamerası oyuncuyu izler (kayma olmaması için ızgaraya yuvarla)
    const p = this.playerSoldier.pos;
    const q = (2 * 55) / 2048;
    const tx = Math.round(p.x / q) * q, tz = Math.round(p.z / q) * q;
    const ty = p.y;
    this.sun.target.position.set(tx, ty, tz);
    this.sun.position.set(tx + this.sunOff.x, ty + this.sunOff.y, tz + this.sunOff.z);
    r.clear();
    r.render(this.scene, this.camera);
    if (this.playerSoldier.alive && !this.showSelf) this.player.vm.render(r, innerWidth, innerHeight);
  }

  // ───── Savaş mantığı ─────
  hitSoldier(e, o, d, maxT) {
    const H = e.height, px = e.pos.x, py = e.pos.y, pz = e.pos.z;
    // kaba küre testi
    const cx = px - o.x, cy = py + H * 0.5 - o.y, cz = pz - o.z;
    const proj = cx * d.x + cy * d.y + cz * d.z;
    if (proj < -1.2 || proj > maxT + 1.2) return null;
    const dist2 = cx * cx + cy * cy + cz * cz - proj * proj;
    const rad = e.proneT > 0.5 ? 1.35 : 1.2;
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
    const hh = H - 0.36;
    const th = rayBox(o, d, [px + lx - 0.2, py + hh + e.leanOff.y, pz + lz - 0.2], [px + lx + 0.2, py + H + e.leanOff.y, pz + lz + 0.2], maxT);
    const tb = rayBox(o, d, [px + lx * 0.45 - 0.29, py, pz + lz * 0.45 - 0.29], [px + lx * 0.45 + 0.29, py + hh, pz + lz * 0.45 + 0.29], maxT);
    if (th >= 0 && (tb < 0 || th <= tb)) return { t: th, zone: 'head' };
    if (tb >= 0) {
      const y = o.y + d.y * tb - py;
      return { t: tb, zone: y < H * 0.42 ? 'legs' : 'body' };
    }
    return null;
  }

  shootRay(shooter, origin, dir, st, muzzle, camO = null) {
    const maxT = st.range ? st.range[1] * 2.2 : 300;
    // sunucu: insanın atışı, istemcinin gördüğü ana geri sarılarak hesaplanır (lag compensation)
    const restore = shooter.rewindTick != null ? this.rewind(shooter, shooter.rewindTick) : null;
    if (camO) {
      // 3. şahıs iki aşamalı atış: (1) kamera ışını neye çarpıyor (duvar ya da düşman) → nişan noktası P; (2) mermi GÖZDEN P'ye gider
      // ve gerçek yolundaki ilk engelde durur. Kameranın köşeden gördüğü yere duvarın arkasından ateş edilemez.
      let tc = maxT;
      const wc = this.world.raycast(camO, dir, maxT, (this._wc ||= {}));
      if (wc) tc = wc.t;
      for (const e of this.soldiers) {
        if (e === shooter || !e.alive || e.team === shooter.team) continue;
        const h = this.hitSoldier(e, camO, dir, tc);
        if (h && h.t < tc) tc = h.t;
      }
      const nd = camO.clone().addScaledVector(dir, tc).sub(origin).normalize();
      if (nd.dot(dir) > 0.9) dir = nd;                                    // ~25°'den fazla sapma (çok yakın hedef) → gözden düz (kamera hilesi için tavan)
    }
    const wh = this.world.raycast(origin, dir, maxT, (this._wh ||= {}));
    const tw = wh ? wh.t : Infinity;
    let bestE = null, bestT = Infinity, bestZ = null;
    for (const e of this.soldiers) {
      if (e === shooter || !e.alive || e.team === shooter.team) continue;
      const h = this.hitSoldier(e, origin, dir, Math.min(tw, bestT, maxT));
      if (h && h.t < bestT && h.t < tw) { bestE = e; bestT = h.t; bestZ = h.zone; }
    }
    restore?.();
    shooter.spottedT = this.time;
    const first = this._firstPellet; this._firstPellet = false;
    const q2 = (v) => Math.round(v * 100) / 100;
    const ev = this.headless ? { e: 'sh', by: shooter.id, m: first ? 1 : 0, o: [q2(muzzle.x), q2(muzzle.y), q2(muzzle.z)] } : null;
    if (bestE) {
      const pt = origin.clone().addScaledVector(dir, bestT);
      const r0 = st.range[0], r1 = st.range[1];
      const f = bestT <= r0 ? 1 : lerpClamp(1, st.minMul, (bestT - r0) / (r1 - r0));
      const zm = bestZ === 'head' ? 2.1 : bestZ === 'legs' ? 0.8 : 1;
      this.effects.blood(pt, 7, dir.clone().negate());
      if (Math.random() < 0.6 || (st.pellets || 1) === 1) this.effects.tracer(muzzle, pt, st.tracer);
      // çevrimiçi istemcide hasar yok: sunucu hesaplar, sonucu olay olarak yollar
      if (!this.online) bestE.takeDamage(st.dmg * f * zm * (shooter.dmgMul || 1), shooter, bestZ, shooter.pos, st.name);
      if (ev) { ev.k = 'f'; ev.p = [q2(pt.x), q2(pt.y), q2(pt.z)]; }
    } else if (wh) {
      const pt = wh.point.clone();
      if (Math.random() < 0.7) this.effects.tracer(muzzle, pt, st.tracer);
      this.effects.spark(pt, 4, wh.normal);
      if (wh.collider || wh.normal.y > 0.5) this.effects.dust(pt, wh.normal);
      this.effects.decal(pt, wh.normal);
      if (shooter.isPlayer || pt.distanceTo(this.camera.position) < 25) this.sfx.impact(pt);
      if (ev) { ev.k = 'w'; ev.p = [q2(pt.x), q2(pt.y), q2(pt.z)]; ev.n = [q2(wh.normal.x), q2(wh.normal.y), q2(wh.normal.z)]; }
    } else {
      const end = origin.clone().addScaledVector(dir, 120);
      this.effects.tracer(muzzle, end, st.tracer);
      if (ev) { ev.k = 'a'; ev.p = [q2(end.x), q2(end.y), q2(end.z)]; }
    }
    if (ev) this.netEvents.push(ev);
  }

  // Yakın dövüş vuruşu: önündeki koni (±34°) içinde, duvar engeli olmayan en yakın düşman. Yoksa duvar vuruşu döner.
  meleeHit(attacker, o, d, reach) {
    let best = null, bs = 1e9;
    const c = new THREE.Vector3(), v = new THREE.Vector3();
    for (const e of this.soldiers) {
      if (e === attacker || !e.alive || e.team === attacker.team) continue;
      // vücut ve baş noktalarından biri yeterli
      for (const fy of [0.55, 0.9]) {
        c.set(e.pos.x, e.pos.y + e.height * fy, e.pos.z);
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
  smokeDensity(p) { return smokeDensity(this, p); }
  placeDeployable(s, st) { return placeDeployable(this, s, st); }

  alertNear(pos, team, radius) {
    for (const s of this.soldiers) {
      if (!s.alive || s.team === team || !s.brain) continue;
      if (Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z) < radius) s.brain.hear(pos);
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

  spawnGrenade(owner, pos, vel, st, net) {
    if (this.online && !net) return;
    const col = st.gtype === 'smoke' ? '#9aa0a6' : st.gtype === 'flash' ? '#33373d' : '#4d5b3a';
    const m = new THREE.Mesh(st.gtype === 'frag' || !st.gtype ? new THREE.IcosahedronGeometry(0.06, 0) : new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), mat(col));
    m.position.copy(pos);
    m.castShadow = true;
    this.scene.add(m);
    const id = net ? net.id : ++this.pidN;
    this.projectiles.push({ id, type: 'grenade', mesh: m, pos: pos.clone(), vel: vel.clone(), owner, st, fuse: st.fuse, bounces: 0 });
    this.netEvent({ e: 'gr', id, by: owner.id, w: STAT_ID.get(st), o: v3(pos), v: v3(vel) });
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
      } else {
        p.fuse -= dt;
        p.vel.y -= (p.shell ? 8 : 14) * dt;
        const step = p.vel.clone().multiplyScalar(dt), L = step.length();
        if (L > 1e-5) {
          const d = step.clone().normalize();
          const wh = this.world.raycast(p.pos, d, L + 0.05, (this._ph ||= {}));
          if (wh && p.shell) boom = wh.point.clone().addScaledVector(wh.normal, 0.15);
          else if (wh) {
            p.pos.copy(wh.point).addScaledVector(wh.normal, 0.06);
            const n = wh.normal, vn = p.vel.dot(n);
            p.vel.addScaledVector(n, -2 * vn).multiplyScalar(0.45);
            if (Math.abs(n.y) > 0.5) { p.vel.x *= 0.7; p.vel.z *= 0.7; if (Math.abs(p.vel.y) < 1.2) p.vel.y = 0; }
            if (++p.bounces < 6 && p.vel.length() > 1.5) this.sfx.impact(p.pos);
          } else p.pos.add(step);
        }
        p.mesh.position.copy(p.pos);
        if (p.shell) p.mesh.lookAt(p.pos.clone().add(p.vel)); else { p.mesh.rotation.x += dt * 8; p.mesh.rotation.z += dt * 6; }
        if (p.shell && !boom) {
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
        else this.explode(boom, p.st.radius, p.st.dmg, p.owner, p.st.name);
      }
    }
  }

  explode(pos, radius, dmg, owner, name) {
    this.effects.explosion(pos, radius);
    this.sfx.explosion(pos);
    this.alertNear(pos, owner.team, 90);
    const dc = pos.distanceTo(this.camera.position);
    this.effects.shake = Math.max(this.effects.shake, clamp(1 - dc / 35, 0, 1) * 1.1);
    if (this.online) return;                // hasar sunucuda
    const o = pos.clone(); o.y += 0.3;
    for (const e of this.soldiers) {
      if (!e.alive) continue;
      if (e.team === owner.team && e !== owner) continue;
      const c = e.center(new THREE.Vector3());
      const d = c.distanceTo(pos);
      if (d > radius) continue;
      if (!this.world.clear(o, c)) continue;
      let a = dmg * (1 - (d / radius) ** 2);
      if (e === owner) a *= 0.55;
      e.takeDamage(a, owner, 'body', pos, name);
      e.vel.x += (c.x - pos.x) / (d + 0.5) * 3; e.vel.z += (c.z - pos.z) / (d + 0.5) * 3;
    }
    const dn = new THREE.Vector3(0, -1, 0);
    const gh = this.world.raycast(new THREE.Vector3(pos.x, pos.y + 1, pos.z), dn, 6, {});
    if (gh) this.effects.decal(gh.point, gh.normal, true);
  }

  // ───── Mod: hedef ele geçirme + bilet ─────
  updateMode(dt) {
    if (this.timeLeft !== Infinity) this.timeLeft -= dt;
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
      this.capT = step;
      for (const o of this.mode.objectives) {
        let b = 0, r = 0;
        for (const s of this.soldiers) {
          if (!s.alive) continue;
          if (Math.hypot(s.pos.x - o.x, s.pos.z - o.z) < o.r && Math.abs(s.pos.y - this.world.heightAt(o.x, o.z)) < 8) (s.team === 'blue' ? b++ : r++);
        }
        const net = clamp(b - r, -3, 3);
        if (net !== 0) {
          const prev = o.owner;
          o.p = clamp(o.p + net * 0.085 * step, -1, 1);
          if (o.p >= 1 && o.owner !== 'blue') o.owner = 'blue';
          else if (o.p <= -1 && o.owner !== 'red') o.owner = 'red';
          else if (o.owner === 'blue' && o.p <= 0) o.owner = null;
          else if (o.owner === 'red' && o.p >= 0) o.owner = null;
          if (o.owner !== prev) this.onFlag(o, prev);
        }
      }
    }
    this.bleedT -= dt;
    if (this.bleedT <= 0) {
      this.bleedT = BLEED_S;
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
          if (Math.hypot(a.pos.x - m.pos.x, a.pos.z - m.pos.z) < 6) a.heal(2.5);
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
          if ((st.kind === 'gun' || st.kind === 'launcher') && st.reserve) it.reserve = Math.min(st.reserve, it.reserve + Math.ceil(st.reserve * 0.12));
        }
      }
    }
    this.checkEnd();
  }

  onFlag(o, prev) {
    const mine = this.playerSoldier?.team;
    this.emit('flag', { o, prev });
    if (this.headless) return;
    if (o.owner) {
      const good = o.owner === mine;
      this.hud.toast(`${o.name} ${good ? 'ele geçirildi' : 'düşman tarafından ele geçirildi'}`, good ? '#7ec8ff' : '#ff8a7a');
      this.sfx.capture();
    } else if (prev) this.hud.toast(`${o.name} tarafsız oldu`, '#cfd3d8');
  }

  onKill(killer, victim, weapon, hs) {
    if (this.mode.scoreBased) { if (killer && killer.team !== victim.team) this.tickets[killer.team] += 1; }      // TDM: öldürmek takıma 1 skor
    else if (!this.ffa) this.tickets[victim.team] -= 1;
    this.netEvent({ e: 'kill', k: killer ? killer.id : -1, v: victim.id, w: weapon || '', hs: hs ? 1 : 0 });
    this.hud.killFeed(killer, victim, weapon, hs);
    if (killer && killer.isPlayer && killer !== victim) this.hud.popup(hs ? '+150 KAFA ATIŞI' : '+100 ÖLDÜRME', hs);
    if (this.mode.infection) {
      if (!victim.def.zombie) victim.infectNext = true;                                            // her insan ölümü enfekte eder
      else victim.zLives = Math.max(0, victim.zLives - 1);                                         // zombi / boss can hakkı eksilir; 0 olunca insan olarak doğar
      victim.revivable = false;
      victim.respawnT = !victim.def.zombie || victim.zLives <= 0 ? (victim.isPlayer || victim.human ? 5 : rand(3.5, 5)) : victim.boss ? BOSS.respawn : ZOMBIE.respawn;
    } else victim.respawnT = victim.isPlayer || victim.human ? 5 : rand(3.5, 6);
    if (victim.isPlayer && this.player) this.player.camPos.copy(victim.eye());
  }

  checkEnd() {
    if (this.ended) return;
    let w = null, why = '';
    if (this.ffa) {
      const best = this.soldiers.filter((s) => !s.vacant).sort((a, b) => b.kills - a.kills || b.score - a.score)[0];
      if (best && best.kills >= this.mode.killLimit) { w = best.team; why = `${best.name} ${best.kills} öldürmeye ulaştı`; }
      else if (this.timeLeft <= 0) { w = best.team; why = 'Süre doldu'; }
    } else if (this.mode.infection) {
      const c = this.infCounts();
      if (c.h <= 0) { w = 'red'; why = 'Tüm insanlar enfekte oldu'; }
      else if (c.z <= 0 && this.time > 2) { w = 'blue'; why = 'Tüm zombiler iyileşti'; }
      else if (this.timeLeft <= 0) { w = 'blue'; why = `${c.h} insan hayatta kaldı`; }
    } else if (this.mode.scoreBased) {
      const lim = this.mode.tickets;
      if (this.tickets.blue >= lim) { w = 'blue'; why = `Mavi takım ${lim} skora ulaştı`; }
      else if (this.tickets.red >= lim) { w = 'red'; why = `Kırmızı takım ${lim} skora ulaştı`; }
      else if (this.timeLeft <= 0) { w = this.tickets.blue >= this.tickets.red ? 'blue' : 'red'; why = 'Süre doldu'; }
    } else if (this.tickets.blue <= 0) { w = 'red'; why = 'Mavi takımın biletleri tükendi'; }
    else if (this.tickets.red <= 0) { w = 'blue'; why = 'Kırmızı takımın biletleri tükendi'; }
    else if (this.timeLeft <= 0) { w = this.tickets.blue >= this.tickets.red ? 'blue' : 'red'; why = 'Süre doldu'; }
    if (!w) return;
    this.ended = true;
    this.running = false;
    if (this.headless) { this.winner = w; this.endReason = why; this.emit('end', { winner: w, why }); return; }
    this.showEndScreen(w, why);
  }

  showEndScreen(w, why) {
    document.exitPointerLock?.();
    const me = this.playerSoldier;
    const win = w === me.team;
    const list = this.soldiers.filter((s) => (this.ffa ? !s.vacant : s.team === me.team)).sort((a, b) => b.score - a.score);
    const xp = Math.round(me.score + (win ? 300 : 80));
    const inf = this.mode.infection;
    const wname = this.ffa ? (this.soldiers.find((s) => s.team === w)?.name || '') : inf ? (w === 'red' ? 'Zombiler' : 'İnsanlar') : TEAMS[w].name;
    const sub = this.ffa ? `Sıralama: ${[...list].sort((a, b) => b.kills - a.kills).slice(0, 3).map((s, i) => `${i + 1}. ${s.name} (${s.kills})`).join(' · ')}` : inf ? `İnsan ${this.tickets.blue} – ${this.tickets.red} Zombi · Takımın en iyisi: ${list[0].name} (${list[0].score})` : `Mavi ${Math.max(0, Math.round(this.tickets.blue))} – ${Math.max(0, Math.round(this.tickets.red))} Kırmızı · Takımın en iyisi: ${list[0].name} (${list[0].score})`;
    const rows = `<div class="mvp"><div class="st"><b>${me.kills}</b><small>Öldürme</small></div><div class="st"><b>${me.deaths}</b><small>Ölüm</small></div><div class="st"><b>${me.score}</b><small>Puan</small></div><div class="st"><b>+${xp}</b><small>XP</small></div></div><small style="opacity:.75">${sub}</small>`;
    this.opts.onMatchEnd?.({ score: me.score, kills: me.kills, deaths: me.deaths, win });
    this.hud.showEnd(win, win ? 'ZAFER!' : 'YENİLGİ', this.ffa ? `${why}.` : `${why}. ${wname} kazandı.`, rows);
  }

  exit() { this.dispose(); this.opts.onExit?.(); }
  restart() { this.dispose(); this.opts.onRestart?.(); }

  dispose() {
    this.running = false;
    if (this.headless) return;
    this.online?.ws.close();
    this._badge?.remove(); this._tm?.remove();
    if (this._km) document.removeEventListener('keydown', this._km);
    cancelAnimationFrame(this.raf);
    this.weather?.dispose();
    document.exitPointerLock?.();
    document.removeEventListener('pointerlockchange', this._plc);
    document.removeEventListener('keydown', this._kd);
    document.removeEventListener('pointerlockerror', this._ple);
    clearTimeout(this._lockT);
    removeEventListener('resize', this._rs);
    this.player.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.canvas.remove();
    if (window.__game === this) delete window.__game;
  }
}

function lerpClamp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }
