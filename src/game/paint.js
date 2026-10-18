import * as THREE from 'three';
import { WSTATS } from './stats.js';
import { SIM_DT } from '../net/protocol.js';

// Paintball: görünür balistik boya topları + boya lekeleri (duvar / zemin / oyuncu üstü) + sıçrama damlaları.
// Top: gözden çıkar (duvar arkasından atılamaz), görüntüde ilk 0,1 sn namludan yola süzülür; her sim adımında bir doğru parçası (yerçekimi grav)
// dünya ışını + savaşçı vuruş kutusu (Game.hitSoldier) ile denenir. Kararı çevrimdışında yerel oyun, çevrimiçinde SUNUCU verir; sunucuda insanın
// topu, istemcinin ateş anında gördüğü ana (vt) + topun yaşı kadar geri sarılmış hedeflere çarpar (lag compensation: istemci ne gördüyse o).
// Ağ: 'pb' (top doğdu: o, v kuantize, sunucu da aynı kuantize değerle simüle eder → istemcinin duvar lekesi birebir aynı yerde), 'pbh' (oyuncuya isabet).
// Kendi topun tahminle hemen görünür; insan atışlarının saçılımı (id, girdi sırası q) tohumlu rastgele → istemci ve sunucu aynı yöne atar.
// Çizim: toplar 1 örneklenmiş ağ, duvar lekeleri 1 (son 400), oyuncu üstü lekeler 1, damlalar 1 → toplam 4 çizim çağrısı; atışta / karede ayırma yok (havuz).

export const PAINT_COLORS = ['#ff2b3a', '#2f7dff', '#ffe014', '#1fd65f', '#ff8a00', '#b44dff', '#14e3e0', '#ff3ec8', '#a6ff1a', '#f2f2f2', '#6f5cff', '#ff8f7a'];
export const PAINT_NAMES = ['Kırmızı', 'Mavi', 'Sarı', 'Yeşil', 'Turuncu', 'Mor', 'Turkuaz', 'Pembe', 'Fıstık', 'Beyaz', 'Çivit', 'Mercan'];
// Savaşçının kişisel boya rengi: s.paintIdx (mod verirse) yoksa savaşçı numarası (sunucu ve istemcide aynı) → 12'lik paletten
export function paintIndexOf(s) { const n = PAINT_COLORS.length, k = s ? (Number.isInteger(s.paintIdx) ? s.paintIdx : s.id | 0) : 0; return ((k % n) + n) % n; }
export function paintColorOf(s) { return PAINT_COLORS[paintIndexOf(s)]; }
// Bot nişanı: topun düşüşünü telafi eden ek yükseliş (rad)
export function ballLead(st, dist) { const t = dist / (st.speed || 70); return Math.atan2(0.5 * (st.grav || 0) * t * t, Math.max(1, dist)); }

const BALL_CAP = 1024, SPLAT_CAP = 400, MARK_CAP = 256, MARK_PER = 12, DROP_CAP = 480;
const SLIDE_T = 0.1;                                   // görüntüde namludan göz hattına geçiş süresi
const q2 = (v) => Math.round(v * 100) / 100;
const _E = new THREE.Vector3(), _V1 = new THREE.Vector3(), _V2 = new THREE.Vector3(), _HP = new THREE.Vector3(), _P = new THREE.Vector3(), _D = new THREE.Vector3(), _Q = new THREE.Vector3(), _N = new THREE.Vector3(), _U = new THREE.Vector3(), _W = new THREE.Vector3();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _bb = new THREE.Box3();
const Z = new THREE.Vector3(0, 0, 1), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const COLS = PAINT_COLORS.map((h) => new THREE.Color(h));

function makeBall() { return { nm: false, on: false, id: 0, q: -1, by: null, st: null, w: '', col: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, px: 0, py: 0, pz: 0, ox: 0, oy: 0, oz: 0, age: 0, vt: -1, own: false, remote: false, pend: 0, nx: 0, ny: 0, nz: 0, dx: 0, dy: 0, dz: 0 }; }

// Leke dokusu: 2×2 atlas (4 farklı sıçrama: merkez blob + taç + damlacık + akıntı), beyaz + alfa (renk örnek başına)
function splatAtlas() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d');
  let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 4; k++) {
    const cx = (k % 2) * 128 + 64, cy = Math.floor(k / 2) * 128 + 64;
    x.save(); x.beginPath(); x.rect(cx - 64, cy - 64, 128, 128); x.clip();
    const blob = (bx, by, R, shade) => { x.fillStyle = `rgb(${shade},${shade},${shade})`; x.beginPath(); const n = 14; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, rr = R * (0.78 + r() * 0.36); x.lineTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr); } x.fill(); };
    blob(cx, cy, 30 + k * 2, 205);                                                   // dış kenar biraz koyu (kalınlık hissi)
    blob(cx, cy, 25 + k * 2, 255);
    const arms = 6 + k * 2;
    for (let i = 0; i < arms; i++) {                                                 // taç kolları + uç damlaları
      const a = r() * Math.PI * 2, L = 30 + r() * 24, w = 3 + r() * 5;
      x.strokeStyle = '#fff'; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); x.stroke();
      blob(cx + Math.cos(a) * (L + 3), cy + Math.sin(a) * (L + 3), w * 0.9 + 1.5, 255);
    }
    for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, d = 40 + r() * 20; blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.5 + r() * 3, 255); }   // serpinti
    if (k >= 2) { x.fillStyle = '#fff'; for (let i = 0; i < 2; i++) { const dx = cx - 12 + r() * 24; x.fillRect(dx - 2.5, cy, 5, 26 + r() * 26); blob(dx, cy + 50, 4, 255); } }   // aşağı akıntı
    x.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function splatMaterial(tex) {
  const m = new THREE.MeshPhongMaterial({ map: tex, alphaTest: 0.5, shininess: 70, specular: '#4a4a4a', depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aVar;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vMapUv = vMapUv * 0.5 + vec2(mod(aVar, 2.0), floor(aVar * 0.5)) * 0.5;');
  };
  m.customProgramCacheKey = () => 'pbsplat';
  return m;
}

export class Paint {
  constructor(game) {
    this.g = game;
    this.headless = !!game.headless;
    this.pool = Array.from({ length: BALL_CAP }, makeBall);
    this.free = [...this.pool]; this.live = [];
    this.nid = 0;
    this.stats = { fired: 0, wall: 0, hits: 0, recycled: 0 };
    this.lastWall = new THREE.Vector3(); this.lastHit = new THREE.Vector3();
    this._wh = {}; this._gh = { pos: new THREE.Vector3(), leanOff: new THREE.Vector3(), yaw: 0, height: 1.8, proneT: 0, hbH: 1, hbW: 1 };
    this.predQ = new Int32Array(64).fill(-1); this.predK = 0;     // tahminle isabet gösterilmiş kendi toplarım (sunucunun 'pbh'si tekrar göstermesin)
    this._seed = 0; this._rnd = () => this._next();
    this.sndT = 0;
    game.on('spawn', (s) => this.clearMarks(s));
    if (this.headless) return;
    const tex = splatAtlas(), smat = splatMaterial(tex), quad = new THREE.PlaneGeometry(1, 1);
    const inst = (geo, mtl, n, vars) => {
      const m = new THREE.InstancedMesh(geo, mtl, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0;
      m.setColorAt(0, _c.set('#fff'));
      if (vars) { m.geometry = geo.clone(); m.geometry.setAttribute('aVar', new THREE.InstancedBufferAttribute(new Float32Array(n), 1)); }
      game.scene.add(m);
      return m;
    };
    this.balls = inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), BALL_CAP);
    this.splats = inst(quad, smat, SPLAT_CAP, true); this.splats.receiveShadow = true; this.splatN = 0;
    this.marks = inst(quad, smat, MARK_CAP, true);
    this.drops = inst(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), DROP_CAP);
    this.markSlots = Array.from({ length: MARK_CAP }, () => ({ s: null, grp: null, root: null, local: new THREE.Matrix4(), col: 0 }));
    this.markFree = [...Array(MARK_CAP).keys()].reverse();
    this.dp = new Float32Array(DROP_CAP * 8); this.dn = 0;          // damla: x y z vx vy vz ömür boyut
    this.dc = new Uint8Array(DROP_CAP);
  }

  // ── tohumlu saçılım (insan atışı: istemci + sunucu aynı) ──
  _next() { let t = (this._seed = (this._seed + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  rngFor(s) {
    const q = this.seqOf(s);
    if (q < 0) return Math.random;
    this._seed = (Math.imul(s.id + 1, 0x9e3779b1) ^ Math.imul(q, 0x85ebca77)) | 0;
    return this._rnd;
  }
  // atışın girdi sıra numarası: sunucuda humanTick'in işlediği girdi, çevrimiçi istemcide gönderilen son girdi; aksi halde -1 (bot / çevrimdışı)
  seqOf(s) { if (this.headless) return Number.isFinite(s.inSeq) ? s.inSeq : -1; return this.g.online && s.isPlayer ? this.g.online.seq : -1; }

  _alloc() {
    let b = this.free.pop();
    if (!b) {                                                         // dolu: en yaşlı topu geri kullan
      let k = 0; for (let i = 1; i < this.live.length; i++) if (this.live[i].age > this.live[k].age) k = i;
      b = this.live[k]; this.live[k] = this.live[this.live.length - 1]; this.live.pop(); this.stats.recycled++;
    }
    b.on = true; b.age = 0; b.pend = 0; b.own = false; b.remote = false; b.q = -1; b.vt = -1; b.ox = b.oy = b.oz = 0; b.nm = false;
    this.live.push(b);
    return b;
  }
  _kill(i) { const b = this.live[i]; b.on = false; b.by = null; b.st = null; this.live[i] = this.live[this.live.length - 1]; this.live.pop(); this.free.push(b); }

  // Soldier._shoot → her top. origin: göz, dir: saçılımlı yön, muzzle: görüntü başlangıcı, camO: 3. şahıs kamera başı (nişan noktası kamera ışınından)
  fire(s, origin, dir, st, muzzle, camO) {
    const g = this.g;
    if (g.online && !s.isPlayer) return;                             // çevrimiçi istemci: yalnız kendi topumu tahmin ederim, diğerleri 'pb' olayıyla gelir
    _D.copy(dir);
    if (camO) {
      const wc = g.world.raycast(camO, _D, 300, this._wh);
      _Q.copy(camO).addScaledVector(_D, wc ? wc.t : 300).sub(origin).normalize();
      if (_Q.dot(_D) > 0.9) _D.copy(_Q);
    }
    const b = this._alloc();
    b.id = ++this.nid; b.by = s; b.st = st; b.w = s.item.id; b.col = paintIndexOf(s);
    b.x = origin.x; b.y = origin.y; b.z = origin.z; b.vx = _D.x * st.speed; b.vy = _D.y * st.speed; b.vz = _D.z * st.speed;
    if (this.headless) { b.x = q2(b.x); b.y = q2(b.y); b.z = q2(b.z); b.vx = q2(b.vx); b.vy = q2(b.vy); b.vz = q2(b.vz); }   // istemciye giden değerle aynı simülasyon
    b.px = b.x; b.py = b.y; b.pz = b.z;
    b.q = this.seqOf(s);
    b.own = !!g.online;
    if (this.headless && Number.isFinite(s.rewindTick)) b.vt = s.rewindTick;
    if (muzzle && !this.headless) { b.ox = muzzle.x - b.x; b.oy = muzzle.y - b.y; b.oz = muzzle.z - b.z; }
    this.stats.fired++;
    if (this.headless) {
      const ev = { e: 'pb', id: b.id, by: s.id, w: b.w, o: [b.x, b.y, b.z], v: [b.vx, b.vy, b.vz] };
      if (b.q >= 0) ev.q = b.q;
      g.netEvent(ev);
    }
    return b;
  }

  // Geri sarılmış hedef: geçmiş tamponundan (Game.recordHist) t adımındaki duruş — Game.rewind ile aynı formül, nesne değiştirmeden
  _ghost(i, e, vt) {
    const g = this.g, N = g.soldiers.length, T = g.tick, HN = g.HN;
    const t = Math.max(T - (HN - 3), Math.min(T, vt));
    if (t < 1) return e;
    const i0 = Math.floor(t), f = t - i0, i1 = Math.min(T, i0 + 1), b = g.histBuf;
    const o0 = (i0 % HN) * N * 9 + i * 9, o1 = (i1 % HN) * N * 9 + i * 9, L = (k) => b[o0 + k] + (b[o1 + k] - b[o0 + k]) * f, h = this._gh;
    h.pos.set(L(0), L(1), L(2)); h.yaw = L(3); h.height = L(4); h.proneT = L(5); h.leanOff.set(L(6), L(7), L(8)); h.hbH = e.hbH || 1; h.hbW = e.hbW || 1;
    return h;
  }

  update(dt) {
    const g = this.g, online = !!g.online, auth = !online, live = this.live, hist = this.headless && g.histBuf;
    this.sndT = Math.max(0, this.sndT - dt);
    const me = !this.headless && g.playerSoldier && g.playerSoldier.alive ? g.playerSoldier : null, E = me ? me.eye(_E) : null;      // yakın geçen top (ekranda damlacık)
    for (let i = live.length - 1; i >= 0; i--) {
      const b = live[i];
      if (b.pend > 0) { if ((b.pend -= dt) <= 0) { this._splat(b.x, b.y, b.z, b.nx, b.ny, b.nz, b.dx, b.dy, b.dz, b.col); this._kill(i); } continue; }
      const gr = b.st.grav || 0;
      b.px = b.x; b.py = b.y; b.pz = b.z;
      const sx = b.vx * dt, sy = b.vy * dt - 0.5 * gr * dt * dt, sz = b.vz * dt;
      b.vy -= gr * dt;
      const L = Math.hypot(sx, sy, sz);
      if (L < 1e-6) { this._kill(i); continue; }
      _P.set(b.x, b.y, b.z); _D.set(sx / L, sy / L, sz / L);
      const wh = g.world.raycast(_P, _D, L, this._wh);
      let bestT = wh ? wh.t : L, best = null, zone = null;
      if (auth || b.own) {
        const mx = b.x + sx * 0.5, my = b.y + sy * 0.5, mz = b.z + sz * 0.5, R = L * 0.5 + (b.vt >= 0 ? 9 : 2.5);
        const ss = g.soldiers, me = b.by;
        for (let k = 0; k < ss.length; k++) {
          const e = ss[k];
          if (!e.alive || e === me || (me && e.team === me.team)) continue;
          const dx = e.pos.x - mx, dy = e.pos.y + 0.9 - my, dz = e.pos.z - mz;
          if (dx * dx + dy * dy + dz * dz > R * R) continue;
          const tg = hist && b.vt >= 0 ? this._ghost(k, e, b.vt) : e;
          const h = g.hitSoldier(tg, _P, _D, bestT);
          if (h && h.t < bestT) { bestT = h.t; best = e; zone = h.zone; }
        }
      }
      if (b.vt >= 0) b.vt += dt / SIM_DT;                            // sonraki adımda hedefler bir adım ileri (istemcinin gördüğü zaman çizgisi)
      if (E && !b.nm && b.by !== me && best !== me) {                // başkasının topu bu adımda başımın ~1 m yakınından geçti
        const L2 = sx * sx + sy * sy + sz * sz, t = Math.max(0, Math.min(bestT / L, ((E.x - b.x) * sx + (E.y - b.y) * sy + (E.z - b.z) * sz) / L2));
        const qx = b.x + sx * t - E.x, qy = b.y + sy * t - E.y, qz = b.z + sz * t - E.z;
        if (qx * qx + qy * qy + qz * qz < 1.0) { b.nm = true; this._nearMiss(me, qx, qy, qz, b); }
      }
      if (best) { _HP.copy(_P).addScaledVector(_D, bestT); this._hitSoldier(b, best, zone, _HP, _D); this._kill(i); continue; }
      if (wh) {
        _Q.copy(wh.point); _N.copy(wh.normal); if (_N.lengthSq() < 0.5) _N.copy(_D).negate();
        this.stats.wall++; this.lastWall.copy(_Q);
        if (b.remote) {                                              // başkasının topu: sunucunun 'pbh'si (oyuncuya isabet) birkaç adım geç gelebilir → leke biraz beklesin
          b.x = _Q.x; b.y = _Q.y; b.z = _Q.z; b.nx = _N.x; b.ny = _N.y; b.nz = _N.z; b.dx = _D.x; b.dy = _D.y; b.dz = _D.z; b.pend = 0.08; continue;
        }
        if (!this.headless) this._splat(_Q.x, _Q.y, _Q.z, _N.x, _N.y, _N.z, _D.x, _D.y, _D.z, b.col);
        this._kill(i); continue;
      }
      b.x += sx; b.y += sy; b.z += sz; b.age += dt;
      if (b.age > (b.st.life || 3) || b.y < -60) this._kill(i);
    }
    if (!this.headless) this._updateDrops(dt);
  }

  _nearMiss(me, qx, qy, qz, b) {
    const rx = Math.cos(me.yaw), rz = -Math.sin(me.yaw), side = qx * rx + qz * rz;
    this.g.hud.paintNear?.(side < 0 ? -1 : 1, qy > 0 ? -1 : 1, b.col);
    this.g.sfx.whiz?.(_Q.set(me.pos.x + qx, me.pos.y + qy, me.pos.z + qz));
  }

  _hitSoldier(b, e, zone, p, d) {
    const g = this.g, st = b.st, by = b.by;
    this.stats.hits++; this.lastHit.copy(p);
    if (!g.online && by) {
      const mul = zone === 'head' ? st.head ?? 1.5 : zone === 'legs' ? st.legs ?? 1 : 1;
      e.takeDamage(st.dmg * mul * (by.dmgMul || 1), by, zone, by.pos, st.name);
    }
    if (this.headless) {
      const ev = { e: 'pbh', id: b.id, by: by ? by.id : -1, v: e.id, z: zone === 'head' ? 2 : zone === 'legs' ? 1 : 0, p: [q2(p.x), q2(p.y), q2(p.z)], d: [q2(d.x), q2(d.y), q2(d.z)] };
      if (b.q >= 0) ev.q = b.q;
      g.netEvent(ev);
      return;
    }
    if (b.own && b.q >= 0) { this.predQ[this.predK] = b.q; this.predK = (this.predK + 1) & 63; }
    this._hitFx(e, zone, p, d, b.col, by);
  }

  _hitFx(e, zone, p, d, col, by) {
    if (e === this.g.playerSoldier) this.g.hud.paintHit?.(by, zone, col);     // gözlüğüme boya (ekranda leke, atıcı yönünde)
    this._snd(p, true);
    if (e !== this.g.playerSoldier || this.g.showSelf) this._burst(p.x, p.y, p.z, -d.x, -d.y, -d.z, col, 10, 2.6);      // birinci şahısta kendi kafamdaki 3B sıçrama yerine ekran boyası
    this.addMark(e, p, zone, d, col);
  }

  _snd(p, body) {
    const g = this.g, c = g.camera.position;
    if (this.sndT > 0 || (p.x - c.x) ** 2 + (p.y - c.y) ** 2 + (p.z - c.z) ** 2 > 900) return;
    this.sndT = 0.045; g.sfx.splat?.(p, body);
  }

  // ── duvar / zemin lekesi (halka tampon, en yeni 400) ──
  _splat(x, y, z, nx, ny, nz, dx, dy, dz, col) {
    if (this.headless) return;
    _N.set(nx, ny, nz); _D.set(dx, dy, dz);
    const cosI = -_D.dot(_N);
    _U.copy(_D).addScaledVector(_N, cosI);                             // gelişin yüzeydeki izdüşümü: leke o yöne uzar
    if (_U.lengthSq() < 1e-4) _U.set(_N.y > 0.9 || _N.y < -0.9 ? 1 : 0, 0, _N.y > 0.9 || _N.y < -0.9 ? 0 : 1).cross(_N);
    _U.normalize().applyAxisAngle(_N, (Math.random() - 0.5) * (cosI > 0.8 ? 6.28 : 0.5));
    _W.crossVectors(_N, _U);
    let sz = 0.2 + Math.random() * 0.16, st = 1 + Math.min(1.2, (1 - Math.max(0, cosI)) * 1.6);
    // kenarda havada kalmasın (direk, pencere kenarı, duvar ucu): lekenin 4 köşesinin arkasında aynı yüzey var mı; yoksa küçült (en çok 2 kez), yine yoksa koyma
    for (let tr = 0; ; tr++) {
      if (this._fits(x, y, z, sz * st * 0.36, sz * 0.36)) break;
      if (tr === 2) return this._burst(x, y, z, nx, ny, nz, col, 7, 1.8);
      sz *= 0.6; st = 1 + (st - 1) * 0.5;
    }
    _m.makeBasis(_U, _W, _N).scale(_s.set(sz * st, sz, 1)).setPosition(x + nx * 0.006, y + ny * 0.006, z + nz * 0.006);
    const k = this.splatN++ % SPLAT_CAP, m = this.splats;
    m.setMatrixAt(k, _m); m.setColorAt(k, COLS[col]);
    m.geometry.attributes.aVar.setX(k, Math.floor(Math.random() * 4));
    m.count = Math.min(this.splatN, SPLAT_CAP);
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; m.geometry.attributes.aVar.needsUpdate = true;
    this._burst(x, y, z, nx, ny, nz, col, 7, 1.8);
    this._snd(_Q.set(x, y, z), false);
  }

  // leke köşeleri (U/W yönünde hx/hy) yüzeye oturuyor mu: köşenin 4 cm önünden yüzeye doğru kısa ışın, yüzey 3 cm'den yakın olmalı
  _fits(x, y, z, hx, hy) {
    const w = this.g.world, d = _V2.copy(_N).negate();
    for (let k = 0; k < 4; k++) {
      const a = k & 1 ? hx : -hx, b = k & 2 ? hy : -hy;
      _V1.set(x, y, z).addScaledVector(_U, a).addScaledVector(_W, b).addScaledVector(_N, 0.04);
      const h = w.raycast(_V1, d, 0.07, this._fh || (this._fh = {}));
      if (!h || h.normal.dot(_N) < 0.9) return false;
    }
    return true;
  }

  // ── oyuncu üstü leke: vurulan uzva (kafa / gövde / kol / bacak grubu) bağlı, uzvun kutusunun en yakın yüzüne yapışır; doğunca silinir ──
  addMark(s, p, zone, d, col) {
    if (this.headless || !s.model?.parts) return;
    const pt = s.model.parts, cands = zone === 'head' ? [pt.head] : zone === 'legs' ? [pt.legs?.L?.hip, pt.legs?.L?.knee, pt.legs?.R?.hip, pt.legs?.R?.knee] : [pt.torso, pt.armR?.upper, pt.armR?.fore, pt.armL?.upper, pt.armL?.fore];
    let grp = null, bd = Infinity;
    for (const c of cands) {
      if (!c) continue;
      const bx = this._localBox(c); if (!bx) continue;
      c.updateWorldMatrix(true, false);
      bx.getCenter(_W).applyMatrix4(c.matrixWorld);
      const dd = _W.distanceToSquared(p); if (dd < bd) { bd = dd; grp = c; }
    }
    if (!grp) return;
    const bx = this._localBox(grp);
    _m2.copy(grp.matrixWorld).invert();
    _Q.copy(p).applyMatrix4(_m2).clamp(bx.min, bx.max);
    // en yakın yüz: o eksende kutu yüzeyine yapıştır
    let ax = 0, sg = 1, dm = Infinity;
    for (let a = 0; a < 3; a++) for (const sgn of [-1, 1]) {
      const face = sgn > 0 ? bx.max.getComponent(a) : bx.min.getComponent(a), dist = Math.abs(_Q.getComponent(a) - face);
      if (dist < dm) { dm = dist; ax = a; sg = sgn; }
    }
    _Q.setComponent(ax, (sg > 0 ? bx.max.getComponent(ax) : bx.min.getComponent(ax)) + sg * 0.004);
    _N.set(0, 0, 0).setComponent(ax, sg);
    _U.set(ax === 1 ? 1 : 0, ax === 1 ? 0 : 1, 0).applyAxisAngle(_N, Math.random() * 6.28); _W.crossVectors(_N, _U);
    const sz = 0.13 + Math.random() * 0.09;
    let slots = s._pbMarks || (s._pbMarks = []);
    if (slots.length >= MARK_PER) this._freeMark(slots.shift());
    const j = this.markFree.pop(); if (j === undefined) return;
    const ms = this.markSlots[j];
    ms.s = s; ms.grp = grp; ms.root = s.model.root; ms.col = col;
    ms.local.makeBasis(_U, _W, _N).scale(_s.set(sz, sz, 1)).setPosition(_Q);
    slots.push(j);
    this.marks.geometry.attributes.aVar.setX(j, Math.floor(Math.random() * 4)); this.marks.geometry.attributes.aVar.needsUpdate = true;
  }
  _localBox(grp) {
    if (grp.userData._pbBox !== undefined) return grp.userData._pbBox;
    const bx = new THREE.Box3(); let any = false;
    for (const ch of grp.children) {
      if (!ch.isMesh || !ch.geometry) continue;
      ch.geometry.boundingBox || ch.geometry.computeBoundingBox();
      ch.updateMatrix(); _bb.copy(ch.geometry.boundingBox).applyMatrix4(ch.matrix); bx.union(_bb); any = true;
    }
    return (grp.userData._pbBox = any ? bx : null);
  }
  _freeMark(j) { const ms = this.markSlots[j]; ms.s = ms.grp = ms.root = null; this.markFree.push(j); }
  clearMarks(s) { if (!s._pbMarks) return; for (const j of s._pbMarks) this._freeMark(j); s._pbMarks.length = 0; }

  // ── sıçrama damlaları (havuz; yerçekimi, yerde söner) ──
  _burst(x, y, z, nx, ny, nz, col, n, sp) {
    if (!this.drops) return;
    for (let i = 0; i < n; i++) {
      const k = this.dn < DROP_CAP ? this.dn++ : Math.floor(Math.random() * DROP_CAP), o = k * 8;
      const rx = Math.random() * 2 - 1, ry = Math.random() * 2 - 1, rz = Math.random() * 2 - 1, f = sp * (0.4 + Math.random() * 0.8);
      this.dp[o] = x + nx * 0.03; this.dp[o + 1] = y + ny * 0.03; this.dp[o + 2] = z + nz * 0.03;
      this.dp[o + 3] = (nx + rx * 0.9) * f; this.dp[o + 4] = (ny + ry * 0.9) * f + 0.8; this.dp[o + 5] = (nz + rz * 0.9) * f;
      this.dp[o + 6] = 0.25 + Math.random() * 0.35; this.dp[o + 7] = 0.008 + Math.random() * 0.016;
      this.dc[k] = col;
    }
  }
  _updateDrops(dt) {
    const p = this.dp;
    for (let k = this.dn - 1; k >= 0; k--) {
      const o = k * 8;
      if ((p[o + 6] -= dt) <= 0) {                                    // söndü: sondakini buraya taşı
        const l = (--this.dn) * 8; if (l !== o) { for (let j = 0; j < 8; j++) p[o + j] = p[l + j]; this.dc[k] = this.dc[this.dn]; }
        continue;
      }
      p[o + 4] -= 9.8 * dt;
      p[o] += p[o + 3] * dt; p[o + 1] += p[o + 4] * dt; p[o + 2] += p[o + 5] * dt;
    }
  }

  // ── çevrimiçi istemci: sunucu olayları ──
  onNet(ev) {
    const g = this.g, me = g.playerSoldier, by = g.soldiers[ev.by];
    if (ev.e === 'pb') {
      if (!by || (by === me && ev.q != null)) return;                // kendi topum zaten tahminle uçuyor
      const st = WSTATS[ev.w]; if (!st) return;
      const b = this._alloc();
      b.id = ev.id; b.by = by; b.st = st; b.w = ev.w; b.col = paintIndexOf(by); b.remote = true; b.q = ev.q ?? -1;
      [b.x, b.y, b.z] = ev.o; [b.vx, b.vy, b.vz] = ev.v; b.px = b.x; b.py = b.y; b.pz = b.z;
      const mz = by.muzzleWorld(_Q);
      if (mz.distanceToSquared(_P.set(b.x, b.y, b.z)) < 9) { b.ox = mz.x - b.x; b.oy = mz.y - b.y; b.oz = mz.z - b.z; }
      g.sfx.shot(st.sound, by.pos); by.flashT = 0.06;                     // flashT: modelin geri tepme duruşu (paintball'da alev yok)
      return;
    }
    if (ev.e === 'pbh') {
      const v = g.soldiers[ev.v]; if (!v) return;
      if (by === me && ev.q != null) {
        for (let k = 0; k < 64; k++) if (this.predQ[k] === ev.q) return;     // tahminle zaten gösterildi
        for (let i = 0; i < this.live.length; i++) if (this.live[i].own && this.live[i].q === ev.q) { this._kill(i); break; }
      } else for (let i = 0; i < this.live.length; i++) if (this.live[i].remote && this.live[i].id === ev.id) { this._kill(i); break; }
      _P.set(ev.p[0], ev.p[1], ev.p[2]); _D.set(ev.d[0], ev.d[1], ev.d[2]);
      this._hitFx(v, ev.z === 2 ? 'head' : ev.z === 1 ? 'legs' : 'body', _P, _D, paintIndexOf(by), by);
    }
  }

  // ── çizim (Game.render öncesi): top konumu sim adımları arasında ara değerlenir ──
  draw() {
    if (this.headless) return;
    const g = this.g, cam = g.camera.position, alpha = g.online ? Math.min(1, (g._acc || 0) / SIM_DT) : 1;
    const bm = this.balls; let n = 0;
    for (const b of this.live) {
      if (b.pend > 0) continue;
      const k = Math.max(0, 1 - b.age / SLIDE_T);
      const x = b.px + (b.x - b.px) * alpha + b.ox * k, y = b.py + (b.y - b.py) * alpha + b.oy * k, z = b.pz + (b.z - b.pz) * alpha + b.oz * k;
      const dc = Math.hypot(x - cam.x, y - cam.y, z - cam.z), r = Math.max(0.014, dc * 0.0024);
      _D.set(b.vx, b.vy, b.vz).normalize(); _q.setFromUnitVectors(Z, _D);
      _m.compose(_P.set(x, y, z), _q, _s.set(r, r, r * 2.2));                 // hafif uzatılmış: hareket bulanıklığı hissi
      bm.setMatrixAt(n, _m); bm.setColorAt(n, COLS[b.col]); n++;
    }
    bm.count = n; if (n) { bm.instanceMatrix.needsUpdate = true; bm.instanceColor.needsUpdate = true; }
    // oyuncu üstü lekeler: uzvun dünya matrisi × yerel
    const mk = this.marks; let mn = 0;
    for (let j = MARK_CAP - 1; j >= 0; j--) if (this.markSlots[j].s) { mn = j + 1; break; }
    for (let j = 0; j < mn; j++) {
      const ms = this.markSlots[j];
      if (!ms.s || ms.s.model?.root !== ms.root || !ms.root.visible) { mk.setMatrixAt(j, ZERO); continue; }       // boş yuva / model yenilendi / görünmez (1. şahısta kendi gövden)
      ms.grp.updateWorldMatrix(true, false);
      mk.setMatrixAt(j, _m.multiplyMatrices(ms.grp.matrixWorld, ms.local)); mk.setColorAt(j, COLS[ms.col]);
    }
    mk.count = mn; if (mn) { mk.instanceMatrix.needsUpdate = true; mk.instanceColor.needsUpdate = true; }
    const dm = this.drops, p = this.dp;
    for (let k = 0; k < this.dn; k++) {
      const o = k * 8, sc = p[o + 7] * Math.min(1, p[o + 6] * 4);
      _m.makeScale(sc, sc, sc).setPosition(p[o], p[o + 1], p[o + 2]); dm.setMatrixAt(k, _m); dm.setColorAt(k, COLS[this.dc[k]]);
    }
    dm.count = this.dn; if (this.dn) { dm.instanceMatrix.needsUpdate = true; dm.instanceColor.needsUpdate = true; }
  }
}
