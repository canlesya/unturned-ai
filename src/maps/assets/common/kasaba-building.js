// Kasaba asset kiti · MODÜLER BİNA (paylaşılabilir). 12.168
// Bina, kat / duvar / pencere / kapı / çatı modüllerinden kurulur; bütün ölçüler 0,25 m ızgarasında, ana gövde 0,5 m ızgarasında.
//   · Duvar iki katmanlı: dış katman (TO = 0,22 m, cephe rengi) + iç katman (0,08 m, iç boya). Köşede K/G duvarı dış katmanı tam boy,
//     D/B duvarı aralarında; iç katmanlar odaya bakan yüzlerde birleşir → köşede tek parça, üst üste binme yok.
//   · Cephe dikdörtgeni açıklıklar (kapı / pencere / vitrin) çıkarılarak üst üste binmeyen dikdörtgenlere bölünür (subtractRects).
//   · Süsler (köşe pilastrı, kaide şeridi, kat silmesi, pencere pervazı / denizliği / panjur, kapı söveli, saçak / tente, tabela) cephenin
//     DIŞINA yapışır; şeritler pilastr / söve / tente gibi çıkıntılarda kesilir (aynı hacmi iki parça paylaşmaz, eş düzlemli yüz yok).
//   · Katlar: zemin döşemesi kaldırım kotunda (0,15 m), kat yüksekliği 3,0 m; döşeme = kaplama (0,03) + taşıyıcı (0,17, alt yüzü tavan).
//   · Çatı: düz (döşeme + korkuluk duvarı + harpuşta, isteğe bağlı çatı çıkışı kulübesi) ya da beşik (iki eğik levha + mahya başlığı +
//     alın üçgeni; çatı arası kapalı, çarpışması eğik yüzün altında basamaklı).
//   · Görünen her katı parçanın çarpışması kendisi (MapBuilder.box), pencere camı yok (açık pencere: görsel = çarpışma).
import { boxR, hull, extrude, gableCollide, subtractRects, splitRange, shade, NC } from './kasaba-shapes.js';

export const FH = 3.0, BASE = 0.15, T = 0.3, TO = 0.22, PT = 0.14, PD = 0.07;
export const level = (k) => BASE + k * FH;                       // k. katın döşeme üstü

// Açıklık türleri (kat düzeyine göre y)
const OPEN = {
  door: { y0: 0, y1: 2.2, w: 1.5 },
  win: { y0: 0.9, y1: 2.2, w: 1.0 },
  tall: { y0: 0.45, y1: 2.2, w: 1.0 },        // fransız pencere
  shop: { y0: 0.55, y1: 2.3, w: 2.5 },
  gate: { y0: 0, y1: 2.9, w: 3.0 },           // garaj / ambar kapısı
  arch: { y0: 0, y1: 2.6, w: 1.5 },
};

export class Bld {
  // o: { id, x0, z0, w, d, floors, style, roof:{type:'flat'|'gable', axis, pitch, parapet, access}, plinth, pilasters, bands, noInner }
  constructor(b, o) {
    this.b = b; this.o = o;
    this.id = o.id; this.x0 = o.x0; this.z0 = o.z0; this.w = o.w; this.d = o.d; this.x1 = o.x0 + o.w; this.z1 = o.z0 + o.d;
    this.F = o.floors || 1;
    this.S = o.style;
    this.K = o.style.k;
    this.ops = { n: [], s: [], e: [], w: [] };
    this.out = { n: [], s: [], e: [], w: [] };            // cepheye yapışık çıkıntılar (şerit kesimi için): {u0,u1,y0,y1}
    this.parts = [];
    this.stairsL = [];
    this.holes = [];                                     // döşeme boşlukları: { k (döşeme katı), x0,x1,z0,z1 }
    this.rails = [];
    this.balc = [];
    this.rooms = [];
    this.info = { entry: null, targets: [], doors: [] };
    this.H = level(this.F);                              // çatı döşemesi üstü / saçak kotu
    const rf = o.roof || { type: 'flat' };
    this.roof = { type: 'flat', parapet: 1.0, pitch: 0.6, overE: 0.4, overG: 0.3, axis: 'x', ...rf };
    this.Htop = this.roof.type === 'flat' ? this.H + this.roof.parapet : this.H;
  }
  faceLen(f) { return f === 'n' || f === 's' ? this.w : this.d; }
  // (face, u, depth) → dünya (x, z); depth: 0 dış yüz, + içeri, − dışarı
  fxz(f, u, dep) {
    if (f === 'n') return [this.x0 + u, this.z0 + dep];
    if (f === 's') return [this.x0 + u, this.z1 - dep];
    if (f === 'w') return [this.x0 + dep, this.z0 + u];
    return [this.x1 - dep, this.z0 + u];
  }
  boxF(f, u0, u1, y0, y1, d0, d1, color, kind, opt) {
    const [ax, az] = this.fxz(f, u0, d0), [bx, bz] = this.fxz(f, u1, d1);
    boxR(this.b, Math.min(ax, bx), Math.max(ax, bx), y0, y1, Math.min(az, bz), Math.max(az, bz), color, kind, opt);
  }
  // ── açıklık ekle: face, u (sol kenar, yüz başından), tür, kat(lar), w ──
  open(f, u, type = 'win', floors = [0], o = {}) {
    const T0 = OPEN[type];
    for (const k of floors === 'all' ? [...Array(this.F).keys()] : [].concat(floors)) {
      const L = level(k), w = o.w || T0.w;
      const op = { ...o, u0: u, u1: u + w, y0: (type === 'door' || type === 'gate' || type === 'arch') && k === 0 ? 0 : L + T0.y0, y1: L + (o.y1 ?? T0.y1), type, k, L };
      this.ops[f].push(op);
      if (type === 'door' || type === 'gate' || type === 'arch') {
        const [ex, ez] = this.fxz(f, u + w / 2, -1.2);
        if (k === 0) { this.info.doors.push({ f, x: ex, z: ez }); if (!this.info.entry || o.main) this.info.entry = { x: ex, z: ez }; }
      }
    }
    return this;
  }
  door(f, u, o = {}) { return this.open(f, u, 'door', o.floors ?? [0], o); }
  wins(f, us, floors = 'all', o = {}) { for (const u of us) this.open(f, u, o.type || 'win', floors, o); return this; }
  // iç bölme: axis 'x' (x boyunca uzar, z = at), 'z'; from/to: uç koordinatları; doors: [{at (orta), w}]
  part(axis, at, from, to, floors = [0], doors = []) { this.parts.push({ axis, at, from, to, floors: [].concat(floors), doors }); return this; }
  // merdiven: k katından k+1'e. x,z: ilk basamağın başlangıç kenarının ortası; dir '+x' | '-x' | '+z' | '-z'; wall: 'l' | 'r' | 'both' | null (o yanda duvar var)
  stair(k, x, z, dir, o = {}) { this.stairsL.push({ k, x, z, dir, w: o.w || 1.2, n: o.n || 12, run: o.run || 0.3, wall: o.wall ?? null, toRoof: k === this.F - 1, ...o }); return this; }
  balcony(f, u0, u1, k, dep = 1.2) { this.balc.push({ f, u0, u1, k, dep }); return this; }
  room(x0, x1, z0, z1, k, type) { this.rooms.push({ x0, x1, z0, z1, k, type }); return this; }
  // korkuluk (k katının döşemesi üstünde, 1,0 m): [x0,x1] × [z0,z1] ince kutu
  rail(x0, x1, z0, z1, k) { this.rails.push([x0, x1, z0, z1, k]); return this; }
  decor(f) { return !(this.o.noDecor || []).includes(f); }

  // ═══════════ kurulum ═══════════
  build() {
    this.prepStairs();
    this.b.obj('bina:' + this.id, () => {
      this.walls();
      this.floorsAndCeilings();
      this.partitions();
      this.stairsNow();
      this.buildBalconies();
      this.facades();
      for (const [x0, x1, z0, z1, k] of this.rails) boxR(this.b, x0, x1, level(k), level(k) + 1.0, z0, z1, this.S.rail || '#4a3c30', this.K.wood);
      if (this.roof.type === 'gable') this.gableRoof(); else if (this.roof.type === 'pyramid') this.pyramidRoof(); else this.flatRoof();
    });
    for (let k = 0; k < this.F; k++) this.info.targets.push({ name: 'kat' + k, x: (this.x0 + this.x1) / 2, y: level(k), z: (this.z0 + this.z1) / 2 });
    if (this.roof.type === 'flat' && this.roof.access) this.info.targets.push({ name: 'cati', x: (this.x0 + this.x1) / 2, y: this.H, z: (this.z0 + this.z1) / 2 });
    this.info.box = { x0: this.x0, x1: this.x1, z0: this.z0, z1: this.z1, H: this.Htop, ridge: this.ridgeY || this.Htop };
    return this.info;
  }

  // ── dış duvarlar (iki katman) ──
  walls() {
    const S = this.S, K = this.K, top = this.Htop, innerTop = this.roof.type === 'flat' ? this.H - 0.2 : this.H - 0.2;
    for (const f of ['n', 's', 'e', 'w']) {
      const L = this.faceLen(f), ns = f === 'n' || f === 's';
      const holes = this.ops[f].map((o) => [o.u0, o.u1, o.y0, o.y1]);
      // katman 1 (dış): renk kotlara göre (ör. zemin kat taş, üst katlar sıva)
      const ou = ns ? [0, L] : [TO, L - TO];
      const bands = S.wallBands || [[0, 99, S.wall, K.wall]];
      for (const [ya, yb, col, kind] of bands) {
        const y0 = Math.max(0, ya), y1 = Math.min(top, yb); if (y1 - y0 < 1e-4) continue;
        for (const [u0, u1, v0, v1] of subtractRects([ou[0], ou[1], y0, y1], holes)) this.boxF(f, u0, u1, v0, v1, 0, TO, col, kind);
      }
      // katman 2 (iç): tavan / çatı döşemesinin altına kadar
      if (this.o.noInner) continue;
      const iu = ns ? [T, L - T] : [TO, L - TO];
      for (const [u0, u1, v0, v1] of subtractRects([iu[0], iu[1], 0, innerTop], holes)) this.boxF(f, u0, u1, v0, v1, TO, T, S.inner, K.inner);
      // açıklık ayrıntısı
      for (const op of this.ops[f]) this.openingDetail(f, op);
    }
  }

  // açıklığın içi: kapı eşiği, pencere kasası (kayıt: kasa dış katmanın içinde, derinlik 0,06–0,16)
  openingDetail(f, op) {
    const S = this.S, K = this.K;
    const { u0, u1, y0, y1, type, k } = op;
    if (type === 'door' || type === 'gate' || type === 'arch') {
      if (k === 0) this.boxF(f, u0, u1, 0, BASE, 0, T, S.stone || S.trim, K.stone ?? K.trim);           // eşik (zemin döşemesi kotunda)
      if (type === 'door' && op.leaf !== false) {                                                             // açık kapı kanatları (içeride, duvara yaslı)
        const lw = (u1 - u0) / 2, L = level(k);
        if (u0 - lw > T + 0.02) this.boxF(f, u0 - lw, u0, L, L + 2.12, T, T + 0.05, S.door || '#6a4a30', K.wood);
        if (u1 + lw < this.faceLen(f) - T - 0.02) this.boxF(f, u1, u1 + lw, L, L + 2.12, T, T + 0.05, S.door || '#6a4a30', K.wood);
      }
      if (type === 'gate' && op.roll !== false) this.boxF(f, u0, u1, y1 - 0.5, y1, 0.02, 0.16, S.metal || '#5a5e64', K.corr ?? K.metal);    // sarılı kepenk (kapı üstünde, açıklık içinde)
      return;
    }
    // pencere / vitrin kasası: çevre çıtaları + orta kayıt (cam yok)
    const fr = S.frame || '#e8e4da', fk = K.trim, a = 0.06, d0 = 0.06, d1 = 0.16;
    this.boxF(f, u0, u1, y0, y0 + a, d0, d1, fr, fk);
    this.boxF(f, u0, u1, y1 - a, y1, d0, d1, fr, fk);
    this.boxF(f, u0, u0 + a, y0 + a, y1 - a, d0, d1, fr, fk);
    this.boxF(f, u1 - a, u1, y0 + a, y1 - a, d0, d1, fr, fk);
    const n = Math.max(1, Math.round((u1 - u0) / 1.0));
    for (let i = 1; i < n; i++) { const um = u0 + (u1 - u0) * i / n; this.boxF(f, um - 0.03, um + 0.03, y0 + a, y1 - a, d0, d1, fr, fk); }
    if (type === 'shop') { const ym = y0 + (y1 - y0) * 0.78; for (let i = 0; i < n; i++) { const ua = u0 + (u1 - u0) * i / n + (i ? 0.03 : a), ub = u0 + (u1 - u0) * (i + 1) / n - (i < n - 1 ? 0.03 : a); this.boxF(f, ua, ub, ym - 0.03, ym + 0.03, d0, d1, fr, fk); } }
  }

  // ── döşemeler / tavanlar (merdiven boşluklu) ──
  floorsAndCeilings() {
    const S = this.S, K = this.K, ix0 = this.x0 + T, ix1 = this.x1 - T, iz0 = this.z0 + T, iz1 = this.z1 - T;
    const fc = S.floor || '#a08060', cc = S.ceil || S.inner;
    // zemin kat: [0, BASE] tek parça (iç zemin), kaplama rengi
    boxR(this.b, ix0, ix1, 0, BASE, iz0, iz1, fc, K.floor);
    for (let k = 1; k <= this.F; k++) {
      const L = level(k), roofSlab = k === this.F;
      if (!roofSlab && (this.o.skipSlab || []).includes(k)) continue;
      // çatı döşemesi iç katmanın üstüne de oturur (korkuluk duvarı yalnız dış katman); asma kat: yalnız slabRect
      const R = roofSlab ? [this.x0 + TO, this.x1 - TO, this.z0 + TO, this.z1 - TO] : this.o.slabRect && this.o.slabRect[k] ? this.o.slabRect[k] : [ix0, ix1, iz0, iz1];
      const holes = this.holes.filter((h) => h.k === k).map((h) => [h.x0, h.x1, h.z0, h.z1]);
      for (const [a0, a1, c0, c1] of subtractRects(R, holes)) {
        if (roofSlab) {
          boxR(this.b, a0, a1, L - 0.2, L - 0.03, c0, c1, cc, K.inner);
          boxR(this.b, a0, a1, L - 0.03, L, c0, c1, this.roof.type === 'flat' ? S.roofTop || '#77787a' : cc, this.roof.type === 'flat' ? K.asph : K.inner);
        } else {
          boxR(this.b, a0, a1, L - 0.2, L - 0.03, c0, c1, cc, K.inner);
          boxR(this.b, a0, a1, L - 0.03, L, c0, c1, fc, K.floor);
        }
      }
    }
  }

  // ── iç bölmeler ──
  partitions() {
    const S = this.S, K = this.K;
    for (const p of this.parts) for (const k of p.floors) {
      const L = level(k), Lt = level(k + 1) - 0.2;
      const holes = p.doors.map((d) => [d.at - (d.w || 1.5) / 2, d.at + (d.w || 1.5) / 2, L, L + 2.2]);
      for (const [a0, a1, y0, y1] of subtractRects([p.from, p.to, L, Lt], holes)) {
        if (p.axis === 'x') boxR(this.b, a0, a1, y0, y1, p.at - PT / 2, p.at + PT / 2, S.inner2 || S.inner, K.inner);
        else boxR(this.b, p.at - PT / 2, p.at + PT / 2, y0, y1, a0, a1, S.inner2 || S.inner, K.inner);
      }
    }
  }

  // ── merdivenler: basamak blokları, açık yanda basamaklı korkuluk, üst döşemede boşluk + korkuluk ──
  stairGeom(s) {
    const hz = s.dir === '+x' || s.dir === '-x', sg = s.dir[0] === '+' ? 1 : -1, len = s.n * s.run;
    const a0 = hz ? s.x : s.z, a1 = a0 + sg * len, lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    const c = hz ? s.z : s.x, w0 = c - s.w / 2, w1 = c + s.w / 2;
    return { hz, sg, len, a0, a1, lo, hi, w0, w1 };
  }
  prepStairs() {
    for (const s of this.stairsL) {
      const g = this.stairGeom(s);
      const R = g.hz ? { x0: g.lo, x1: g.hi, z0: g.w0, z1: g.w1 } : { x0: g.w0, x1: g.w1, z0: g.lo, z1: g.hi };
      this.holes.push({ k: s.k + 1, ...R });
    }
  }
  stairsNow() {
    const S = this.S, K = this.K, b = this.b, sc = S.stair || '#8a6a48';
    for (const s of this.stairsL) {
      const g = this.stairGeom(s), L = level(s.k), rise = FH / s.n;
      const B = (a0, a1, y0, y1, c0, c1, col, kind) => (g.hz ? boxR(b, Math.min(a0, a1), Math.max(a0, a1), y0, y1, c0, c1, col, kind) : boxR(b, c0, c1, y0, y1, Math.min(a0, a1), Math.max(a0, a1), col, kind));
      for (let i = 0; i < s.n; i++) {
        const sa = g.a0 + g.sg * i * s.run, sb = g.a0 + g.sg * (i + 1) * s.run, top = L + (i + 1) * rise;
        B(sa, sb, L, top - 0.04, g.w0, g.w1, sc, K.wood);
        B(sa, sb, top - 0.04, top, g.w0, g.w1, S.tread || shade(sc, 1.15), K.wood);
        // açık yan(lar): basamak üstünde 0,06 m basamaklı korkuluk
        const open = s.wall === 'both' ? [] : s.wall === 'l' ? ['r'] : s.wall === 'r' ? ['l'] : ['l', 'r'];
        for (const sd of open) {
          const c0 = sd === 'l' ? g.w0 : g.w1 - 0.06, c1 = c0 + 0.06;
          B(sa, sb, top, top + 0.9, c0, c1, S.rail || '#4a4038', K.wood);
        }
      }
      // üst katta boşluk korkuluğu (varış ucu açık); çatıya çıkan merdivende kulübe duvarı korur
      if (!s.toRoof || this.roof.type !== 'flat') {
        const L2 = level(s.k + 1), rc = S.rail || '#4a4038';
        // s.rails: ['l', 'r', 'end'] (verilmezse: duvarsız yanlar + başlangıç ucu)
        const auto = []; if (s.wall !== 'l' && s.wall !== 'both') auto.push('l'); if (s.wall !== 'r' && s.wall !== 'both') auto.push('r'); auto.push('end');
        const R = s.rails || auto, sides = R.filter((q) => q === 'l' || q === 'r');
        for (const sd of sides) { const c0 = sd === 'l' ? g.w0 - 0.06 : g.w1, c1 = c0 + 0.06; B(g.lo, g.hi, L2, L2 + 1.0, c0, c1, rc, K.wood); }
        if (R.includes('end')) {                                                 // başlangıç ucu (alt basamak üstü) kapalı
          const e0 = g.sg > 0 ? g.lo - 0.06 : g.hi, e1 = e0 + 0.06;
          B(e0, e1, L2, L2 + 1.0, g.w0 - (sides.includes('l') ? 0.06 : 0), g.w1 + (sides.includes('r') ? 0.06 : 0), rc, K.wood);
        }
      }
    }
  }

  // ── balkon: döşeme çıkıntısı + korkuluk ──
  buildBalconies() {
    const S = this.S, K = this.K;
    for (const bl of this.balc) {
      const L = level(bl.k);
      this.boxF(bl.f, bl.u0, bl.u1, L - 0.2, L, -bl.dep, 0, S.trim, K.conc ?? K.trim);
      this.out[bl.f].push({ u0: bl.u0, u1: bl.u1, y0: L - 0.2, y1: L + 1.0 });
      const rc = S.rail || '#3a3d42';
      this.boxF(bl.f, bl.u0, bl.u1, L, L + 0.06, -bl.dep, -bl.dep + 0.06, rc, K.metal ?? K.plain);
      this.boxF(bl.f, bl.u0, bl.u1, L + 0.94, L + 1.0, -bl.dep, -bl.dep + 0.06, rc, K.metal ?? K.plain);
      for (let u = bl.u0; u <= bl.u1 - 0.05 + 1e-6; u += 0.25) this.boxF(bl.f, u, u + 0.04, L + 0.06, L + 0.94, -bl.dep, -bl.dep + 0.04, rc, K.metal ?? K.plain);
      for (const ue of [bl.u0, bl.u1 - 0.06]) this.boxF(bl.f, ue, ue + 0.06, L, L + 1.0, -bl.dep + 0.06, 0, rc, K.metal ?? K.plain);
    }
  }

  // ── cephe süsleri ──
  facades() {
    const S = this.S, K = this.K, gable = this.roof.type === 'gable', ax = this.roof.axis;
    const eave = (f) => this.roof.type === 'pyramid' || gable && (ax === 'x' ? f === 'n' || f === 's' : f === 'e' || f === 'w');
    for (const f of ['n', 's', 'e', 'w']) {
      if (!this.decor(f)) continue;
      const L = this.faceLen(f), ns = f === 'n' || f === 's', ops = this.ops[f], O = this.out[f];
      // komşu yüz süssüzse (sırt sırta ortak duvar) o köşede taşma yok: K/G yüzünde köşe karesi uzantısı ve şerit taşması kesilir
      const nd = this.o.noDecor || [], cutA = ns ? nd.includes('w') : nd.includes('n'), cutB = ns ? nd.includes('e') : nd.includes('s');
      const eA = ns && !cutA ? -PD : 0, eB = ns && !cutB ? L + PD : L;
      const capTop = gable || this.roof.type === 'pyramid' ? this.H - PD * this.roof.pitch - 0.02 : this.Htop;      // saçak / alın taşmasının eğik levhasına değmesin
      // köşe pilastrları (K/G yüzü köşe karesini de kapsar)
      if (this.o.pilasters !== false) {
        const pc = S.pil || S.trim, pk = K.pilaster ?? K.trim, pw = 0.4;
        const pTop = capTop;
        this.boxF(f, eA, pw, 0, pTop, -PD, 0, pc, pk, NC); this.boxF(f, L - pw, eB, 0, pTop, -PD, 0, pc, pk, NC);
        O.push({ u0: eA, u1: pw, y0: 0, y1: pTop }, { u0: L - pw, u1: eB, y0: 0, y1: pTop });
      }
      // açıklık süsleri
      for (const op of ops) {
        const { u0, u1, y0, y1, type } = op;
        if (type === 'door' || type === 'arch' || type === 'gate') {
          const c = S.casing || S.trim, ck = K.trim, e = 0.12;
          if (op.casing !== false) {
            this.boxF(f, u0 - e, u0, y0, y1, -0.05, 0, c, ck, NC); this.boxF(f, u1, u1 + e, y0, y1, -0.05, 0, c, ck, NC);
            this.boxF(f, u0 - e, u1 + e, y1, y1 + 0.14, -0.05, 0, c, ck, NC);
            O.push({ u0: u0 - e, u1: u1 + e, y0, y1: y1 + 0.14 });
          } else O.push({ u0, u1, y0, y1 });
          if (op.canopy) {                                                         // kapı saçağı: söve üstünde, 1 m çıkıntı + iki konsol
            const cy = y1 + 0.2, cc = op.canopy === true ? S.canopy || S.roof : op.canopy;
            this.boxF(f, u0 - 0.45, u1 + 0.45, cy, cy + 0.12, -1.0, 0, cc, K.roof);
            for (const ue of [u0 - 0.4, u1 + 0.3]) this.boxF(f, ue, ue + 0.1, cy - 0.35, cy, -0.3, 0, S.trim, K.trim, NC);
            O.push({ u0: u0 - 0.45, u1: u1 + 0.45, y0: cy - 0.35, y1: cy + 0.12 });
          }
          continue;
        }
        const tc = S.trim, tk = K.trim;
        // pervaz (yan + üst), denizlik, isteğe bağlı panjur
        this.boxF(f, u0 - 0.1, u0, y0, y1, -0.04, 0, tc, tk, NC); this.boxF(f, u1, u1 + 0.1, y0, y1, -0.04, 0, tc, tk, NC);
        this.boxF(f, u0 - 0.1, u1 + 0.1, y1, y1 + 0.12, -0.04, 0, tc, tk, NC);
        this.boxF(f, u0 - 0.08, u1 + 0.08, y0 - 0.07, y0, -0.08, 0, S.sill || tc, tk, NC);
        O.push({ u0: u0 - 0.1, u1: u1 + 0.1, y0: y0 - 0.07, y1: y1 + 0.12 });
        const sw = (u1 - u0) / 2 + 0.05, hitO = (a, c, ya, yc) => O.some((q) => a < q.u1 - 1e-4 && c > q.u0 + 1e-4 && ya < q.y1 - 1e-4 && yc > q.y0 + 1e-4);
        if ((op.shutter ?? S.shutters) && !hitO(u0 - 0.12 - sw, u0 - 0.12, y0, y1) && !hitO(u1 + 0.12, u1 + 0.12 + sw, y0, y1) && u0 - 0.12 - sw > 0.4 && u1 + 0.12 + sw < L - 0.4) {
          const sc = op.shutterColor || S.shutter || '#4a6a5a';
          this.boxF(f, u0 - 0.12 - sw, u0 - 0.12, y0 + 0.02, y1 - 0.02, -0.035, 0, sc, K.wood, NC);
          this.boxF(f, u1 + 0.12, u1 + 0.12 + sw, y0 + 0.02, y1 - 0.02, -0.035, 0, sc, K.wood, NC);
          O.push({ u0: u0 - 0.12 - sw, u1: u0 - 0.12, y0: y0 + 0.02, y1: y1 - 0.02 }, { u0: u1 + 0.12, u1: u1 + 0.12 + sw, y0: y0 + 0.02, y1: y1 - 0.02 });
        }
        if (type === 'shop' && op.awning !== false && (op.awning || S.awning)) {   // vitrin tentesi (eğik değil: kademeli iki levha)
          const ac = op.awning && op.awning !== true ? op.awning : S.awning, ay = y1 + 0.2;
          this.boxF(f, u0 - 0.2, u1 + 0.2, ay, ay + 0.08, -1.1, 0, ac, K.board ?? K.plain);
          this.boxF(f, u0 - 0.2, u1 + 0.2, ay - 0.3, ay, -1.1, -1.04, ac, K.board ?? K.plain, NC);
          O.push({ u0: u0 - 0.2, u1: u1 + 0.2, y0: ay - 0.3, y1: ay + 0.08 });
        }
      }
      // tabelalar (cephe çıkıntısı olarak)
      for (const sg of this.o.signs || []) if (sg.f === f) {
        this.boxF(f, sg.u0, sg.u1, sg.y0, sg.y1, -0.08, 0, sg.color, K.paint ?? K.plain, NC);
        if (sg.text) this.boxF(f, sg.u0 + 0.12, sg.u1 - 0.12, sg.y0 + 0.12, sg.y1 - 0.12, -0.1, -0.08, sg.text, K.plain, NC);
        O.push({ u0: sg.u0, u1: sg.u1, y0: sg.y0, y1: sg.y1 });
      }
      // yatay şeritler: kaide, kat silmeleri, saçak altı (düz çatı) — çıkıntılarda kesilir
      const band = (y0, y1, dep, col, kind) => {
        const gaps = O.filter((q) => q.y0 < y1 - 1e-4 && q.y1 > y0 + 1e-4).map((q) => [q.u0, q.u1]);
        for (const [a, c] of splitRange(-1, L + 1, gaps)) { const u0 = Math.max(a, eA), u1 = Math.min(c, eB); if (u1 - u0 > 0.05) this.boxF(f, u0, u1, y0, y1, -dep, 0, col, kind, NC); }
      };
      if (this.o.plinth !== false) band(0, 0.55, 0.05, S.plinth || S.stone || '#8a867c', K.stone);
      if (this.o.bands !== false) for (let k = 1; k < this.F; k++) band(level(k) - 0.2, level(k), 0.05, S.band || S.trim, K.trim);
      if (this.roof.type === 'flat' && this.o.cornice !== false) band(this.H - 0.25, this.H + 0.05, 0.06, S.band || S.trim, K.trim);
    }
  }

  // ── düz çatı: korkuluk duvarı (dış katman zaten Htop'a çıkar) + harpuşta + çatı çıkışı ──
  flatRoof() {
    const S = this.S, K = this.K, y = this.Htop, cc = S.coping || shade(S.trim, 0.85);
    const e = PD + 0.03;
    boxR(this.b, this.x0 - e, this.x1 + e, y, y + 0.08, this.z0 - e, this.z0 + TO + 0.04, cc, K.stone ?? K.trim);
    boxR(this.b, this.x0 - e, this.x1 + e, y, y + 0.08, this.z1 - TO - 0.04, this.z1 + e, cc, K.stone ?? K.trim);
    boxR(this.b, this.x0 - e, this.x0 + TO + 0.04, y, y + 0.08, this.z0 + TO + 0.04, this.z1 - TO - 0.04, cc, K.stone ?? K.trim);
    boxR(this.b, this.x1 - TO - 0.04, this.x1 + e, y, y + 0.08, this.z0 + TO + 0.04, this.z1 - TO - 0.04, cc, K.stone ?? K.trim);
    // çatıya çıkış kulübesi: son kattan çıkan merdiven boşluğunu + varış sahanlığını örter
    const s = this.stairsL.find((q) => q.toRoof && this.roof.access);
    if (s) {
      const g = this.stairGeom(s), H = this.H, t = 0.2, hh = 2.5, land = 1.3;
      // iç alan: merdiven izi + varış ucunda sahanlık; kapı varış ucunun yan duvarında
      const lo = g.sg > 0 ? g.lo : g.lo - land, hi = g.sg > 0 ? g.hi + land : g.hi;
      const R = g.hz ? [lo, hi, g.w0, g.w1] : [g.w0, g.w1, lo, hi];         // [x0,x1,z0,z1] iç
      // kulübe duvarı cephenin üst bandıyla aynı malzeme (tuğla bina → tuğla kulübe; 12.176: düz sıva kulübe tuğla çatıda yama gibiydi)
      const topBand = (S.wallBands || []).find(([ya, yb]) => this.H >= ya && this.H < yb);
      const [ix0, ix1, iz0, iz1] = R, pc = topBand ? topBand[2] : S.wall, pk = topBand ? topBand[3] : K.wall;
      const dside = this.roof.accessDoor || (g.hz ? (iz0 - this.z0 > this.z1 - iz1 ? 'n' : 's') : (ix0 - this.x0 > this.x1 - ix1 ? 'w' : 'e'));
      // kapı: varış ucuna yakın 1,0 m (hz: x boyunca duvarda)
      const dAt = g.sg > 0 ? hi - land / 2 : lo + land / 2, dw = 1.0;
      const wallX = (z0, z1, x0, x1, door) => { for (const [a, c] of door ? splitRange(x0, x1, [[dAt - dw / 2, dAt + dw / 2]]) : [[x0, x1]]) boxR(this.b, a, c, H, H + hh, z0, z1, pc, pk); if (door) boxR(this.b, dAt - dw / 2, dAt + dw / 2, H + 2.1, H + hh, z0, z1, pc, pk); };
      const wallZ = (x0, x1, z0, z1, door) => { for (const [a, c] of door ? splitRange(z0, z1, [[dAt - dw / 2, dAt + dw / 2]]) : [[z0, z1]]) boxR(this.b, x0, x1, H, H + hh, a, c, pc, pk); if (door) boxR(this.b, x0, x1, H + 2.1, H + hh, dAt - dw / 2, dAt + dw / 2, pc, pk); };
      if (g.hz) {
        wallX(iz0 - t, iz0, ix0 - t, ix1 + t, dside === 'n'); wallX(iz1, iz1 + t, ix0 - t, ix1 + t, dside === 's');
        wallZ(ix0 - t, ix0, iz0, iz1, false); wallZ(ix1, ix1 + t, iz0, iz1, false);
      } else {
        wallZ(ix0 - t, ix0, iz0 - t, iz1 + t, dside === 'w'); wallZ(ix1, ix1 + t, iz0 - t, iz1 + t, dside === 'e');
        wallX(iz0 - t, iz0, ix0, ix1, false); wallX(iz1, iz1 + t, ix0, ix1, false);
      }
      boxR(this.b, ix0 - t - 0.06, ix1 + t + 0.06, H + hh, H + hh + 0.12, iz0 - t - 0.06, iz1 + t + 0.06, cc, K.stone ?? K.trim);
      this.penthouse = [ix0 - t - 0.06, ix1 + t + 0.06, iz0 - t - 0.06, iz1 + t + 0.06];
    }
    if (this.o.roofUnits !== false) this.roofUnits();
  }

  // çatı üstü klima / havalandırma kutuları (çatıda siper): korkuluktan 0,8 m, çıkış kulübesinden 0,9 m uzakta, birbirine değmez
  roofUnits() {
    const S = this.S, K = this.K, H = this.H, b = this.b;
    let seed = 0; for (const ch of String(this.id)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const ax0 = this.x0 + TO + 0.8, ax1 = this.x1 - TO - 0.8, az0 = this.z0 + TO + 0.8, az1 = this.z1 - TO - 0.8;
    const busy = []; if (this.penthouse) { const [a, c, e, g] = this.penthouse; busy.push([a - 0.9, c + 0.9, e - 0.9, g + 0.9]); }
    for (const h of this.holes) if (h.k === this.F) busy.push([h.x0 - 0.9, h.x1 + 0.9, h.z0 - 0.9, h.z1 + 0.9]);
    const n = Math.max(1, Math.min(3, Math.floor((ax1 - ax0) * (az1 - az0) / 22)));
    for (let i = 0, tries = 0; i < n && tries < 40; tries++) {
      const w = 1.2, d = 0.9, x = ax0 + w / 2 + rnd() * Math.max(0, ax1 - ax0 - w), z = az0 + d / 2 + rnd() * Math.max(0, az1 - az0 - d);
      const r = [Math.round((x - w / 2) * 4) / 4, 0, Math.round((z - d / 2) * 4) / 4, 0]; r[1] = r[0] + w; r[3] = r[2] + d;
      if (r[0] < ax0 || r[1] > ax1 || r[2] < az0 || r[3] > az1 || busy.some((q) => r[0] < q[1] && r[1] > q[0] && r[2] < q[3] && r[3] > q[2])) continue;
      boxR(b, r[0], r[1], H, H + 0.85, r[2], r[3], '#b8bcc0', K.metal ?? K.plain);
      boxR(b, r[0] + 0.15, r[1] - 0.15, H + 0.85, H + 0.9, r[2] + 0.12, r[3] - 0.12, '#3a3d42', K.metal ?? K.plain, NC);
      boxR(b, r[0] - 0.03, r[0], H + 0.15, H + 0.7, r[2] + 0.15, r[3] - 0.15, '#8a8e92', K.metal ?? K.plain, NC);
      busy.push([r[0] - 0.8, r[1] + 0.8, r[2] - 0.8, r[3] + 0.8]); i++;
    }
  }

  // ── beşik çatı ──
  gableRoof() {
    const S = this.S, K = this.K, b = this.b, r = this.roof, k = r.pitch, H = this.H, th = 0.14, tv = th * Math.sqrt(1 + k * k);
    const alongX = r.axis === 'x';                                      // mahya x boyunca → eğimler ±z, alınlar D/B yüzünde
    const oG = [].concat(r.overG), a0 = (alongX ? this.x0 : this.z0) - oG[0], a1 = (alongX ? this.x1 : this.z1) + (oG[1] ?? oG[0]);
    const c0 = alongX ? this.z0 : this.x0, c1 = alongX ? this.z1 : this.x1, cm = (c0 + c1) / 2, rh = (cm - c0) * k;
    const P = (a, c, y) => (alongX ? [a, y, c] : [c, y, a]);
    const rc = S.roof, rk = K.roof;
    for (const sg of [-1, 1]) {
      const ce = sg < 0 ? c0 - r.overE : c1 + r.overE, ye = H - r.overE * k;            // saçak ucu alt kotu
      const pts = [];
      for (const a of [a0, a1]) pts.push(P(a, ce, ye), P(a, ce, ye + tv), P(a, cm, H + rh), P(a, cm, H + rh + tv));
      hull(b, pts, rc, rk);
      // mahya başlığı (eğik levhanın üstüne oturan dörtgen kesit)
      const cw = 0.18, yt = H + rh + tv;
      const cap = [];
      for (const a of [oG[0] > 0 ? a0 - 0.02 : a0, (oG[1] ?? oG[0]) > 0 ? a1 + 0.02 : a1]) cap.push(P(a, cm + sg * cw, yt - cw * k), P(a, cm, yt), P(a, cm, yt + 0.1), P(a, cm + sg * cw, yt - cw * k + 0.07));
      hull(b, cap, S.ridge || shade(rc, 0.8), rk);
    }
    // çatı arası: duvar dış yüzleri arasında tek dolu üçgen prizma (iki ucu alın üçgeni; eğik yüzleri levhaların altında, tabanı duvar + tavan üstünde)
    extrude(b, alongX ? 'x' : 'z', alongX ? this.x0 : this.z0, alongX ? this.x1 : this.z1, [[c0, H], [c1, H], [cm, H + rh]], S.gable || S.wall, K.gable ?? K.wall);
    // çatı arası çarpışması: duvarların dış yüzleri arasında, eğik yüzün altında basamaklı
    gableCollide(b, alongX ? 'x' : 'z', alongX ? this.x0 : this.z0, alongX ? this.x1 : this.z1, c0, c1, H, rh, 6);
    this.ridgeY = H + rh + tv;
  }

  // ── kırma (piramit) çatı: footprint üstünde dolu piramit + dört saçak levhası (köşelerde köşegen birleşim) ──
  pyramidRoof() {
    const S = this.S, K = this.K, b = this.b, r = this.roof, H = this.H, o = r.overE, th = 0.14;
    const { x0, x1, z0, z1 } = this, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, half = Math.min(x1 - x0, z1 - z0) / 2, k = r.pitch, ah = half * k;
    const tv = th * Math.sqrt(1 + k * k), ye = H - o * k;
    const apex = (x1 - x0) === (z1 - z0) ? [[cx, H + ah, cz]] : (x1 - x0) > (z1 - z0) ? [[x0 + half, H + ah, cz], [x1 - half, H + ah, cz]] : [[cx, H + ah, z0 + half], [cx, H + ah, z1 - half]];
    const apexT = apex.map(([x, y, z]) => [x, y + tv, z]);
    hull(b, [[x0, H, z0], [x1, H, z0], [x1, H, z1], [x0, H, z1], [x0, H + tv, z0], [x1, H + tv, z0], [x1, H + tv, z1], [x0, H + tv, z1], ...apexT], S.roof, K.roof);
    // saçak levhaları: alt yüzü duvar dış yüzünde H'den geçer (o·k aşağı iner), kalınlık üstte → üst yüz piramidin eğik yüzünü sürdürür
    const sk = (ax, az, bx, bz, dx, dz) => {
      const P = [[ax, H, az], [bx, H, bz], [bx + dx[1], ye, bz + dz[1]], [ax + dx[0], ye, az + dz[0]]];
      hull(b, [...P, ...P.map(([x, y, z]) => [x, y + tv, z])], S.roof, K.roof);
    };
    sk(x0, z0, x1, z0, [-o, o], [-o, -o]); sk(x1, z1, x0, z1, [o, -o], [o, o]);
    sk(x0, z1, x0, z0, [-o, -o], [o, -o]); sk(x1, z0, x1, z1, [o, o], [-o, o]);
    // iç çarpışma: iç içe daralan kutular (her kutunun dış kenarı eğik yüzün altında)
    const n = 5, st = half / n;
    for (let j = 0; j < n - 1; j++) b.collide(cx, H + j * st * k, cz, (x1 - x0) - 2 * (j + 1) * st, st * k + (j === 0 ? tv : 0), (z1 - z0) - 2 * (j + 1) * st);
    this.ridgeY = H + ah + tv;
  }
}
