// İstemci ağ katmanı: bağlantı, istemci tarafı tahmin (prediction) + sunucu uzlaştırması (reconciliation),
// uzaktaki oyuncular için snapshot interpolasyonu.
import { SIM_HZ, SIM_DT, SNAP_EVERY, applyFlags, F_LEFT, F_PROT, F_GROUND, defaultServerUrl, directServerUrl, skinsFrom } from './protocol.js';
import { applyInput } from '../sim/input.js';
import { WSTATS, ZT_ORDER } from '../game/stats.js';
import { sanitizeBalance, useBalance, TUNE } from '../game/balance.js';
import { banText } from '../i18n/game.js';
import { fallHeight } from '../sim/fall.js';

// Diğer oyuncuların gösterim gecikmesi (interpolasyon tamponu) ağın titremesine göre uyarlanır (12.137):
// en az 6 adım = 100 ms (20 Hz snapshot'ta iki örnek arası), titreşimli bağlantıda en çok 15 adım = 250 ms (lag compensation HN=40 içinde).
// Canlı ölçüm: doğrudan bağlantıda (RTT p50 30 ms) snapshot'ların %8'i en hızlı gelişe göre > 50 ms geç → sabit 100 ms tamponda saniyede ~1 donma.
const INTERP_MIN = 6, INTERP_MAX = 15;
const EXTRAP_MAX = 6;                  // tampon yine de boşalırsa en çok 100 ms hızla ileri tahmin (sonra son konumda bekler)
const JIT_HALF = 4;                    // geç kalma tepesinin yarı ömrü (sn): ani gecikme hemen tamponu büyütür, sakinleşince yavaşça küçülür
const TICK_MS = 1000 / SIM_HZ;
const POS_EPS = 0.05;                  // tahmin–sunucu farkı bunu aşarsa düzelt (m)
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * t;
const mkItem = (id) => ({ id, mag: WSTATS[id].mag ?? 0, reserve: WSTATS[id].reserve ?? 0 });

export class NetClient {
  constructor(ws) {
    this.ws = ws;
    this.game = null;
    this.snaps = [];                   // { k, t, s }  (interpolasyon tamponu)
    this.offset = null;                // sunucu zamanı (ms) − yerel zaman (ms) tahmini
    this.seq = 0;
    this.hist = [];                    // gönderilmiş, henüz onaylanmamış girdiler
    this.edges = {};
    this.rt = 0;                       // son gösterilen (interpolasyon) sunucu adımı: atışta vt olarak gider
    this.rs = null;
    this.stats = { corrections: 0, lastErr: 0, snaps: 0, rtt: 0, jit: 0, delay: INTERP_MIN * TICK_MS, frames: 0, extrap: 0, hold: 0 };   // jit: geç kalma tepesi (ms) · delay: gösterim gecikmesi (ms) · extrap/hold: tampon boşaldı (ileri tahmin / bekleme) kare sayısı
    this.jit = 0; this.idelay = INTERP_MIN; this._snapAt = null; this._iAt = null;
    this.pendingMe = null;
    this.viewOff = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };            // kamera yumuşatma ofseti (Player uygular, sönümler)
    this._ping = setInterval(() => this.send({ t: 'ping', c: performance.now() }), 2000);
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
    ws.onclose = () => { this.closed = true; clearInterval(this._ping); this.game?.onNetClosed?.(this.kicked); };       // kicked: moderatör / yönetici attı ya da banladı (12.136)
  }

  // Sunucuya bağlan ve oda kur/katıl. Çözülen değer: { net, welcome }
  // Varsayılan adreste önce Cloudflare'siz doğrudan bağlantı (directServerUrl, 3 sn); açılamazsa normal adres. Sunucu hatası (oda dolu vb.) tekrar denenmez.
  // o.onWait(ms): oda maç sonu ekranında, yeni maç kurulunca otomatik katılınacak (bekleme süresi kadar zaman aşımı uzar)
  static connect(url, hello, o = {}) {
    const direct = url === defaultServerUrl() ? directServerUrl() : null;
    if (!direct) return NetClient.connectOne(url, hello, 8000, o);
    return NetClient.connectOne(direct, hello, 3000, o).catch((e) => (e.netFail ? NetClient.connectOne(url, hello, 8000, o) : Promise.reject(e)));
  }

  static connectOne(url, hello, ms, o = {}) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const net = new NetClient(ws);
      let opened = false;
      const fail = (msg, netFail, ban) => { clearTimeout(timer); clearInterval(net._ping); ws.onclose = null; try { ws.close(); } catch (e) { /* yok say */ } reject(Object.assign(new Error(msg), { netFail, ban })); };
      let timer = setTimeout(() => fail('Sunucuya bağlanılamadı', !opened), ms);
      net.onWait = (m) => { clearTimeout(timer); timer = setTimeout(() => fail('Sunucuya bağlanılamadı', false), (+m.ms || 0) + 20000); o.onWait?.(m.ms); };
      ws.onerror = () => fail('Sunucuya bağlanılamadı: ' + url, !opened);
      ws.onopen = () => { opened = true; ws.send(JSON.stringify(hello)); };
      net.onWelcome = (w) => { clearTimeout(timer); resolve({ net, welcome: w }); };
      net.onError = (msg, ban) => fail(msg, false, ban);
    });
  }

  // Oda yeni maça geçti (aynı bağlantıda yeni 'welcome'): tahmin / interpolasyon durumu sıfırlanır, yeni Game attach olana dek mesajlar biriktirilir
  resetMatch() {
    this.game = null; this.queued = null;
    this.snaps = []; this.offset = null; this.seq = 0; this.hist = []; this.edges = {}; this.rt = 0; this.rs = null; this.pendingMe = null; this.roster = null; this.stats.snaps = 0; this.fallPred = null;
    this.jit = 0; this.idelay = INTERP_MIN; this._snapAt = null; this._iAt = null;
  }

  attach(game) { this.game = game; for (const m of this.queued || []) this.onMessage(m); this.queued = null; }

  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }

  onMessage(m) {
    if (m.t === 'pong') { const r = performance.now() - m.c; this.stats.rtt = this.stats.rtt ? this.stats.rtt * 0.7 + r * 0.3 : r; return; }
    if (m.t === 'welcome') { useBalance(sanitizeBalance(m.bal)); return this.onWelcome?.(m); }       // odanın denge sürümü (admin paneli)
    if (m.t === 'err') return this.onError?.(m.ban ? banText(m.ban, true) : m.msg, m.ban);                  // ban / atma engeli: oyuncunun dilinde
    if (m.t === 'kicked') { this.kicked = m; return; }                                                 // ardından bağlantı kapanır → onNetClosed
    if (m.t === 'wait') return this.onWait?.(m);                                                      // maç sonu ekranındaki odaya girildi: yeni maçı bekle
    if (!this.game) { if (m.t !== 'restart') (this.queued ||= []).push(m); return; }
    if (m.t === 'snap') return this.onSnap(m);
    if (m.t === 'roster') return this.onRoster(m.roster);
    if (m.t === 'chat') return this.game.onNetChat?.(m);
    if (m.t === 'team') return this.game.onNetTeam?.(m);
    if (m.t === 'end') return this.game.onNetEnd?.(m);
    if (m.t === 'ev') return this.game.onNetEvents?.(m.l);
    if (m.t === 'votes') return this.game.onNetVotes?.(m);
    if (m.t === 'restart') return this.game.onNetRestart?.(m);
  }

  // ── girdi ──
  edge(k) { this.edges[k] = 1; }

  // Player.update içinde applyInput'tan hemen sonra çağrılır (adım başına bir kez)
  pushInput(inp, s, fireHeld) {
    const e = this.edges; this.edges = {};
    const q = ++this.seq;
    this.send({
      t: 'in', q, f: inp.f, r: inp.r, l: inp.lean, s: inp.sprint ? 1 : 0, j: inp.jump ? 1 : 0, a: s.ads ? 1 : 0, w: s.cur,
      yw: +s.yaw.toFixed(4), pt: +s.pitch.toFixed(4), c: e.c | 0, p: e.p | 0, u: e.u | 0,
      fh: fireHeld ? 1 : 0, fp: e.fp | 0, rl: e.rl | 0, fm: e.fm | 0, o: e.o | 0, ab: e.ab | 0, vt: +this.rt.toFixed(2),
      sd: s.stanceLeft ? 1 : 0, tl: s.flashOn ? 1 : undefined,                      // 12.159: fener açık (yalnız açıkken yollanır; yoksa sunucu kapalı sayar)
      co: s.shotOff ? [+s.shotOff.x.toFixed(2), +s.shotOff.y.toFixed(2), +s.shotOff.z.toFixed(2)] : undefined,
    });
    const fire = !!(fireHeld || e.fp || e.rl);
    this.hist.push({ q, fire, inp: { f: inp.f, r: inp.r, lean: inp.lean, sprint: !!inp.sprint, jump: !!inp.jump }, ads: !!s.ads, adsT: s.adsT, yaw: s.yaw, pitch: s.pitch, e, st: { x: s.pos.x, y: s.pos.y, z: s.pos.z } });
    if (this.hist.length > 240) this.hist.shift();
  }

  // Son gönderilen girdinin adım sonundaki cephanesi (ateş / şarjör sonrası). Sunucu aynı girdiyi işleyince ack anındaki cephaneyi (me.aa) yollar.
  markAmmo(s) { const h = this.hist[this.hist.length - 1]; if (h) h.am = s.items.map((it) => [it.mag, it.reserve]); }

  // 12.138: kendini toparlayan cephane uzlaştırması. Eskiden cephane yalnız "uçuşta ateş yokken" sunucuya eşitleniyordu; sürekli ateşte
  // (ya da gecikme / kuyruk yüzünden onaylanmamış girdi hep varken) istemci ile sunucu ayrışırsa (kaçan / fazladan atış, sunucuda erken
  // şarjör, cephane kutusu) istemci boş şarjörle "ateş ediyor" görünebiliyordu. Artık her onaylanan girdide sunucunun o andaki cephanesi
  // istemcinin AYNI girdideki kaydıyla karşılaştırılır; fark varsa şimdiki değere fark eklenir (sonraki tahminler korunur), kayıtlı tahminler de kaydırılır.
  fixAmmo(s, rec, aa) {
    const items = s.items, ra = rec.am;
    if (!aa || !ra || aa.length !== items.length || ra.length !== items.length) return;
    let off = false;
    for (let i = 0; i < aa.length; i++) if (aa[i][0] !== ra[i][0] || aa[i][1] !== ra[i][1]) { off = true; break; }
    if (!off) return;
    for (let i = 0; i < aa.length; i++) {
      const dm = aa[i][0] - ra[i][0], dr = aa[i][1] - ra[i][1];
      if (!dm && !dr) continue;
      const it = items[i], cap = WSTATS[it.id]?.mag;
      it.mag = Math.max(0, it.mag + dm); if (Number.isFinite(cap) && it.mag > cap) it.mag = cap;
      it.reserve = Math.max(0, it.reserve + dr);
      for (const h of this.hist) if (h.am && h.am[i]) { h.am[i][0] += dm; h.am[i][1] += dr; }
    }
    this.stats.ammoFix = (this.stats.ammoFix || 0) + 1;
  }

  // 12.138: eşya listesi sunucudakinden farklıysa (yaşarken değişti: Silah Yarışı seviye atlama vb.) sunucununkine geç. Eskiden yerel oyuncunun
  // eşyaları yalnız doğuşta eşitleniyordu → istemci ölene kadar başka silahı tutuyor / sayıyordu.
  fixItems(s, me) {
    const ids = me.now.it;
    if (!ids || (ids.length === s.items.length && ids.every((id, i) => id === s.items[i].id))) return;
    s.items = ids.map(mkItem); this.applyAmmo(s, me);
    s.cur = Math.max(0, Math.min(ids.length - 1, me.now.c | 0)); s.reloadT = 0; s.useT = 0; s.swing = null; s.burstLeft = 0;
    s._modelWeapon = undefined;
    for (const h of this.hist) h.am = null;
    this.game.emit('switch', s);
  }

  // ── snapshot ──
  onSnap(m) {
    const now = performance.now();
    const cand = now - (m.k / SIM_HZ) * 1000;
    // offset = en hızlı gelişin saati: daha erken gelen anında alınır, yoksa yavaşça yükselir (rota / saat kayması). Yükselme örneği en çok 100 ms
    // sayılır: tek bir çok geç snapshot (sekme / GC takılması) offset'i 30+ ms itip ardından geri düşürmesin (rakiplerde ileri-geri sıçrama)
    this.offset = this.offset === null ? cand : cand < this.offset ? cand : this.offset + Math.min(cand - this.offset, 100) * 0.02;
    // geç kalma = bu snapshot'ın en hızlı gelişe (offset) göre gecikmesi; tepe değeri hızlı yükselir, JIT_HALF yarı ömürle söner
    const dS = this._snapAt === null ? 0 : (now - this._snapAt) / 1000; this._snapAt = now;
    this.jit = Math.max(Math.min(cand - this.offset, INTERP_MAX * TICK_MS), this.jit * Math.pow(0.5, dS / JIT_HALF));     // tek örnek en çok 250 ms sayılır (sekme / GC takılması tamponu uzun süre şişirmesin)
    this.stats.jit = this.jit;
    this.snaps.push({ k: m.k, s: m.s });
    if (this.snaps.length > 30) this.snaps.shift();
    this.stats.snaps++;
    const g = this.game;
    // skor alanları hemen: interpolate düşük FPS'te yavaş alanlı snapshot'ı atlayabiliyor → rakip öldürme/seviye 0'da kalıyor, LİDER kutusu yanlış
    for (const p of m.s) { if (p.kl === undefined) continue; const s = g.soldiers[p.i]; if (!s || s === g.playerSoldier) continue; s.kills = p.kl; s.deaths = p.de; s.score = p.sc; s.assists = p.as || 0; if (p.gl !== undefined) s.ggLevel = p.gl; }
    g.tickets.blue = m.tk[0]; g.tickets.red = m.tk[1];
    g.timeLeft = m.tl < 0 ? Infinity : m.tl;
    if (m.pl && g.payload) g.payload.applyNet(m.pl);                           // Vagon: konum + durum (gösterim netFrame'de yumuşar)
    if (m.fr && g.front) g.front.applyNet(m.fr);                               // Cephe: etkin sektör (doğuş aşaması + şerit)
    m.o.forEach((o, i) => { const ob = g.mode.objectives[i]; if (!ob) return; const prev = ob.owner; ob.owner = o[0] === 1 ? 'blue' : o[0] === 2 ? 'red' : null; ob.p = o[1]; if (ob.owner !== prev) g.onFlag?.(ob, prev); });
    this.reconcile(m.me);
  }

  onRoster(roster) {
    const g = this.game;
    this.roster = roster;
    for (const r of roster) {
      const s = g.soldiers[r.id]; if (!s) continue;
      s.name = r.name; s.vacant = !!r.vac;
      if (s.team !== r.team) s.team = r.team;
      if (s.cls !== r.cls) s.setClass(r.cls);
    }
  }

  // Sunucu durumunu bir savaşçıya uygula (uzaktakiler ve doğma/ölüm geçişleri)
  applyState(s, p, local) {
    if (p.a && !s.alive) s.spawn({ x: p.x, z: p.z, ry: p.yw }, 0);
    else if (!p.a && s.alive) { s.alive = false; s.hp = 0; s.deadT = 0; s.deadDir = Math.random() > 0.5 ? 1 : -1; s.ads = false; s.reloadT = 0; s.vel.set(0, 0, 0); }
    s.hp = p.hp;
    if (p.it) {                                                                                    // yavaş alanlar (yalnızca değişince / periyodik gelir)
      if (p.mh) s.maxHp = p.mh; if (p.gl !== undefined) s.ggLevel = p.gl;
      if (p.zt || p.bs) {                                                                          // zombi türü / boss durumu değişti: model yenilenir
        const t = ZT_ORDER[p.zt - 1] || s.ztype, bs = !!p.bs;
        if ((t !== s.ztype || bs !== s.boss) && s.def.zombie) { s.ztype = t; s.boss = bs; s.setClass('zombie'); }
        else { s.ztype = t; s.boss = bs; }
      }
      s.zLives = p.zl ?? 0;
      s.kills = p.kl; s.deaths = p.de; s.score = p.sc; s.assists = p.as || 0; s.revivable = !!p.rv;      // as: 12.165 (yoksa 0)
      const sk = skinsFrom(p.sk, p.it), skChanged = JSON.stringify(sk) !== JSON.stringify(s.skins || null);      // kaplama değişti mi (silah aynı kalsa da model yenilenir)
      if (!local || !s.skins) s.skins = sk;
      if (s.items.length !== p.it.length || s.items.some((it, i) => it.id !== p.it[i])) {
        s.items = p.it.map(mkItem);
        s._modelWeapon = undefined;
        if (local) this.game.emit('switch', s);
        else { s.cur = p.c; s._syncWeaponModel(true); }
      } else if (skChanged && !local && s.alive) s._syncWeaponModel(true);
      const wr = typeof p.wr === 'string' ? p.wr : '';                                              // 12.167 kıyafet kodu (insan); yoksa bot çeşitlemesi / kendi tercihim
      if (!local && wr !== s.wearCode && !s.def.zombie && !this.game.headless) { s.wearCode = wr; s._buildModel(); s._modelWeapon = undefined; s._syncWeaponModel(true); }
      else s.wearCode = local ? '' : wr;
    }
    if (!local) {
      if (s.cur !== p.c) { s.cur = p.c; s._syncWeaponModel(); }
      applyFlags(s, p.f);
      s.stanceLeft = !!(p.f & F_LEFT);
      s.leanDir = p.l;
    }
  }

  applyAmmo(s, me) {
    if (!me.am || me.am.length !== s.items.length) return;
    me.am.forEach(([mag, reserve], i) => { s.items[i].mag = mag; s.items[i].reserve = reserve; });
  }

  // ── tahmin uzlaştırma (yerel oyuncu) ──
  reconcile(me) {
    const g = this.game, s = g.playerSoldier;
    if (!s) return;
    if (me.ab) { s.abT = me.ab[0]; s.abActive = me.ab[1]; }          // zombi gücü: bekleme / etkin süre sunucudan (hız tahmini tutarlı kalsın)
    if (me.rs !== this.rs) {
      // ilk snapshot veya yeniden doğma: sunucunun şu anki durumuna geç
      this.rs = me.rs; this.hist.length = 0; this.fallPred = null;
      const p = me.now;
      this.applyState(s, p, true);
      s.pos.set(p.x, p.y, p.z); s.vel.set(p.vx, p.vy, p.vz);
      s.yaw = p.yw; s.pitch = p.pt; s.protT = 0; s.cur = p.c; s.respawnT = me.rt;
      applyFlags(s, p.f);
      this.applyAmmo(s, me);
      return;
    }
    const st = me.st;
    s.kills = me.now.kl; s.deaths = me.now.de; s.score = me.now.sc; s.assists = me.now.as || 0;
    // ölüm/yaşam durumu SUNUCUNUN ŞU ANKİ durumundan (me.now) alınır: ack anındaki durum (me.st) ölünce güncellenmez (girdi işlenmez)
    if (!me.now.a) { if (s.alive) this.applyState(s, me.now, true); this.hist.length = 0; s.respawnT = me.rt; return; }
    if (!s.alive) { this.applyState(s, me.now, true); }
    this.fixItems(s, me);
    const fp = this.fallPred;                                        // tahmin edilen düşme hasarı (game.fallPredict): sunucu o girdiyi işleyene dek sunucu canından düşülür, sonra sunucunun canı geçerli (çift düşülmez)
    if (fp && me.ack >= fp.q) this.fallPred = null;
    s.hp = this.fallPred ? Math.max(1, st.hp - fp.dmg) : st.hp;
    s.protNet = !!(me.now.f & F_PROT);                              // doğma koruması: sunucunun şu anki durumundan (kalkan görseli)
    // sunucunun işlediği son girdi (ack) anındaki tahminimizle karşılaştır
    let rec = null;
    while (this.hist.length && this.hist[0].q <= me.ack) rec = this.hist.shift();
    const idle = !this.hist.some((h) => h.fire);
    if (idle) { this.applyAmmo(s, me); for (const h of this.hist) h.am = null; }     // uçuşta ateş/şarjör yoksa cephaneyi sunucuya eşitle (uçuştaki kayıtlar artık temel değil)
    if (!rec || rec.q !== me.ack) return;
    if (!idle) this.fixAmmo(s, rec, me.aa);
    const err = Math.hypot(rec.st.x - st.x, rec.st.y - st.y, rec.st.z - st.z);
    this.stats.lastErr = err;
    if (err > POS_EPS) { this.stats.errSum = (this.stats.errSum || 0) + err; this.stats.errMax = Math.max(this.stats.errMax || 0, err); }
    if (err <= POS_EPS) return;
    this.stats.corrections++;
    // düzelt: sunucu durumuna dön, onaylanmamış girdileri yeniden oynat
    const keepYaw = s.yaw, keepPitch = s.pitch, keepAds = s.ads, keepAdsT = s.adsT, bx = s.pos.x, by = s.pos.y, bz = s.pos.z;
    s.pos.set(st.x, st.y, st.z); s.vel.set(st.vx, st.vy, st.vz);
    applyFlags(s, st.f);
    s.fallTop = s.onGround ? st.y : st.y + fallHeight(Math.abs(st.vy), TUNE.gravity * g.world.grav);     // havadaysa zirve sunucu durumundan (balistik uçuş: y + v² / 2g); düşme tahmini sunucuyla aynı yükseklikten
    for (const h of this.hist) {
      g.world.move(s, SIM_DT);
      if (s.landH > 0) g.fallReplay?.(s, h.q);                    // yeniden oynatmada iniş: bu girdinin sunucu adımında düşme hasarı (tahmin)
      s.yaw = h.yaw; s.pitch = h.pitch;
      if (h.e.u) s.standUp();
      if (h.e.c) s.toggleCrouch();
      if (h.e.p) s.toggleProne();
      s.ads = h.ads; s.adsT = h.adsT;                                // 12.145: nişan koşuyu / hızı belirler → o girdideki nişan (eski: sunucunun ack anındaki bayrağı tüm yeniden oynatmaya yayılıyor, basılı nişan düzeltmede düşüyordu)
      applyInput(s, h.inp, SIM_DT);
      h.st = { x: s.pos.x, y: s.pos.y, z: s.pos.z };
    }
    s.yaw = keepYaw; s.pitch = keepPitch; s.ads = keepAds; s.adsT = keepAdsT;
    if (this.fallPred) s.hp = Math.max(1, st.hp - this.fallPred.dmg);
    // Küçük düzeltmeler (≤ 0.8 m) kamerada yumuşatılır: oyuncu gerçek konumda ama görüntü eski yerden hızla (~0.1 sn) yeni yere kayar → "takılma/sıçrama" hissi yok.
    // Büyük farklar (ışınlanma, sunucu itmesi) anında uygulanır.
    const ox = bx - s.pos.x, oy = by - s.pos.y, oz = bz - s.pos.z;
    if (ox * ox + oy * oy + oz * oz < 0.64) { this.viewOff.x += ox; this.viewOff.y += oy; this.viewOff.z += oz; } else this.viewOff.set(0, 0, 0);
  }

  // Uzaktaki oyuncuları interpolasyonla yerleştir (her sim adımında)
  interpolate(nowMs) {
    const g = this.game, S = this.snaps;
    if (!S.length || this.offset === null) return;
    // gösterim gecikmesi hedefe kayar: büyürken oynatma en çok %10 yavaşlar, küçülürken en çok %3 hızlanır (sıçrama yok)
    const want = Math.max(INTERP_MIN, Math.min(INTERP_MAX, SNAP_EVERY + (this.jit + 5) / TICK_MS));
    const dt = this._iAt === null ? 0 : Math.max(0, Math.min(0.1, (nowMs - this._iAt) / 1000)); this._iAt = nowMs;
    this.idelay += Math.max(-0.03 * SIM_HZ * dt, Math.min(0.1 * SIM_HZ * dt, want - this.idelay));
    this.stats.delay = this.idelay * TICK_MS;
    const rt = ((nowMs - this.offset) / 1000) * SIM_HZ - this.idelay;   // gösterilecek sunucu adımı
    this.rt = rt;
    let a = S[0], b = S[0];
    for (let i = 0; i < S.length; i++) { if (S[i].k <= rt) { a = S[i]; b = S[Math.min(i + 1, S.length - 1)]; } else break; }
    if (S[0].k > rt) a = b = S[0];
    const t = b.k > a.k ? Math.max(0, Math.min(1, (rt - a.k) / (b.k - a.k))) : 0;
    // tampon boşaldı (snapshot geç kaldı): son hızla en çok EXTRAP_MAX adım ileri tahmin; yerdeyken dikey tahmin yok
    const last = S[S.length - 1], over = a === last ? rt - last.k : 0, ex = over > 0 ? Math.min(over, EXTRAP_MAX) / SIM_HZ : 0;
    this.stats.frames++;
    if (over > 0) { this.stats.extrap++; if (over > EXTRAP_MAX) this.stats.hold++; }
    const me = g.playerSoldier;
    const bi = new Map(b.s.map((p) => [p.i, p]));
    for (const pa of a.s) {
      const s = g.soldiers[pa.i];
      if (!s || s === me) continue;
      const pb = bi.get(pa.i) || pa;
      this.applyState(s, pa, false);
      if (ex && pa.a) s.pos.set(pa.x + pa.vx * ex, pa.y + (pa.f & F_GROUND ? 0 : pa.vy * ex), pa.z + pa.vz * ex);
      else s.pos.set(lerp(pa.x, pb.x, t), lerp(pa.y, pb.y, t), lerp(pa.z, pb.z, t));
      s.vel.set(pa.vx, pa.vy, pa.vz);
      s.yaw = lerpAngle(pa.yw, pb.yw, t);
      s.pitch = lerp(pa.pt, pb.pt, t);
    }
  }
}
