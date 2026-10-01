// Ev / bina üreticisi (kit.house'un gerçek gövdesi).
// Yerel çerçevede çalışır: ön kapı +Z (güney) yüzündedir; kapı hangi yöndeyse bina o yönde döndürülür (90° katları).
// Her katta: iç bölme duvarları (1.5 m kapılar), oda tipine göre mobilya (siper olanlar çarpışmalı), kat döşemeleri (merdiven boşluklu),
// duvar boyunca çıkan merdiven kovası (kat başına tek kol; kollar değişimli sol/sağ), düz çatıda isteğe bağlı çatı erişimi.
//
// house(b, rng, o):  o = {
//   x, z, w, d, floors=1, wall, roof, door='s'|'n'|'e'|'w', doorAt=0, backDoor=false, floorH=3.1, flat=false,
//   floorColor, furnishing=true (false → boş kabuk), extraWindows=true,
//   YENİ opsiyoneller:
//   roofAccess=false  düz çatıda iç merdivenle çatıya çıkış + 1.05 m çarpışmalı korkuluk (yalnız flat:true),
//   theme: 'house' | 'shop' | 'office' | 'school' | 'garage' | 'barracks' (varsayılan: flat ? 'office' : 'house'),
//   glow=0.4  pencerelerin gece sarı parlama olasılığı, trim, porch=true }
// Dönüş: { targets:[{x,y,z,room}] (oda merkezleri/çatı, dünya koordinatı), entry:{x,z}, fl, plans, toWorld, W, D, ry }.
import { put, footprint, ITEMS, PAL, TALL } from './furn.js';

const T = 0.3;        // dış duvar kalınlığı
const PT = 0.14;      // iç bölme kalınlığı
const SW = 1.5;       // merdiven kovası iç genişliği
const DW = 1.5;       // iç kapı genişliği
const TRIM = '#e8e6df';
const INNER = ['#e8dfc8', '#dfe4d4', '#e4d6c2', '#d8dce4', '#eadcc8', '#d6e0dc'];
const FLOORC = ['#9c7a52', '#a58a62', '#8a6a48', '#b09068'];
const TILEC = ['#d8dcd8', '#c8d4d8', '#d8d4c4'];
const pick = (r, a) => a[Math.floor(r() * a.length)];
const clamp = (v, a, c) => Math.max(a, Math.min(c, v));
const NC = { collide: false };

const ROT = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
const DOORSIGN = { s: 1, n: -1, e: -1, w: 1 };
const OPPOSITE = { s: 'n', n: 's', e: 'w', w: 'e' };

const ov = (a, c, e = 0.005) => a.x0 < c.x1 - e && a.x1 > c.x0 + e && a.z0 < c.z1 - e && a.z1 > c.z0 + e;

export function house(b, rng, o) {
  const {
    x, z, w, d, floors = 1, wall = '#d9c79a', roof = '#a8432f', door = 's', doorAt = 0, backDoor = false,
    floorH = 3.1, flat = false, floorColor, furnishing = true, extraWindows = true, roofAccess = false,
    glow = 0.4, trim = TRIM, porch = true,
  } = o;
  const theme = o.theme || (flat ? 'office' : 'house');
  const swapped = door === 'e' || door === 'w';
  const W = swapped ? d : w, D = swapped ? w : d;
  const ry = ROT[door];
  const doorX = DOORSIGN[door] * doorAt;
  const info = { targets: [], roof: null, x, z, ry, W, D };
  const toWorld = (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
  info.toWorld = toWorld;

  b.with(x, 0, z, ry, () => body());
  return info;

  function body() {
    const x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2;
    const I = T / 2;
    const ix0 = x0 + I, ix1 = x1 - I, iz0 = z0 + I, iz1 = z1 - I;
    const id = iz1 - iz0;
    // çok sığ binada merdiven sığmaz: kat sayısı 1'e, çatı erişimi iptal
    const stairOk = id >= 5.8;
    const F = stairOk ? floors : 1, H = F * floorH;
    const hasRoofAccess = roofAccess && flat && stairOk;
    const Lv = F + (hasRoofAccess ? 1 : 0);
    const inner = pick(rng, INNER);
    const floorCol = floorColor || pick(rng, FLOORC);
    const wallInfo = {};

    // ───── merdiven kolları ─────
    const fl = [];
    if (Lv > 1) {
      const compact = id < 6.9;                         // sığ bina: daha dik (≤0.24 m basamak), kısa sahanlık/lobi
      const n = Math.ceil((floorH - 0.001) / (compact ? 0.24 : 0.21));
      const LD = compact ? 1.5 : 1.7, lobby = compact ? 1.0 : 1.4;
      const run = clamp((id - LD - lobby) / n, 0.25, 0.3);
      for (let k = 0; k < Lv - 1; k++) {
        const side = k % 2 === 0 ? 'w' : 'e';
        const zt = iz0 + LD, zb = zt + n * run;
        const xa = side === 'w' ? ix0 + 0.1 : ix1 - 0.1 - 1.3;
        fl.push({ k, side, n, run, rise: floorH / n, zt, zb, xa, xb: xa + 1.3, xc: xa + 0.65, LD });
      }
    }
    const shaftsAt = (k) => fl.filter((f) => f.k === k || f.k + 1 === k);
    const shaftX = (f) => (f.side === 'w' ? ix0 + SW + PT / 2 : ix1 - SW - PT / 2);

    // ───── dış duvar kabuğu + açıklık planı (kat başına) ─────
    // Oda planı: ground ve üst katlar aynı bölme hattını paylaşır (yapısal tutarlılık).
    const plans = [];
    for (let k = 0; k < F; k++) plans.push(planLevel(k));

    function planLevel(k) {
      const sh = shaftsAt(k);
      const shW = sh.find((f) => f.side === 'w'), shE = sh.find((f) => f.side === 'e');
      const rx0 = shW ? ix0 + SW + PT : ix0;
      const rx1 = shE ? ix1 - SW - PT : ix1;
      const P = { k, y0: k * floorH, sh, shW, shE, rx0, rx1, rooms: [], parts: [], keeps: [], solids: [], feats: [], doors: [] };
      if (!furnishing) {
        P.rooms.push({ id: 'all', type: 'empty', x0: ix0, x1: ix1, z0: iz0, z1: iz1, ports: [] });
        return P;
      }
      const wBack = rx1 - rx0;
      const bd = clamp(id * 0.42, 2.9, 3.8);
      const hall = theme === 'shop' && k === 0 || theme === 'garage' || theme === 'barracks';
      const backStrip = id >= 6.4 && wBack >= 3.2 && !(theme === 'barracks') && !(theme === 'garage' && wBack < 8);
      const zp = backStrip ? iz0 + (hall ? clamp(id * 0.3, 2.9, 3.4) : bd) : null;
      const split = backStrip && wBack >= 6.0 && !(k === 0 && backDoor) && !(theme === 'shop' && k === 0) && !(theme === 'garage');
      const xp = split ? rx0 + wBack * (0.46 + rng() * 0.08) : null;
      P.zp = zp; P.xp = xp;
      const mkDoor = (axis, at, c, rooms) => {
        const dd = { axis, at, c, w: DW };
        P.doors.push(dd);
        P.parts.push({ type: 'door', ...dd });
        // kapı önü boş şeridi (iki yan) + her odanın girişi için port
        const half = DW / 2 + 0.1;
        if (axis === 'x') P.keeps.push({ x0: at - half, x1: at + half, z0: c - 1.25, z1: c + 1.25 });
        else P.keeps.push({ x0: c - 1.25, x1: c + 1.25, z0: at - half, z1: at + half });
        return dd;
      };
      // oda dikdörtgenleri (iç yüzler)
      const front = { id: 'front', x0: ix0, x1: ix1, z0: zp !== null ? zp + PT / 2 : iz0, z1: iz1, ports: [] };
      P.rooms.push(front);
      if (zp !== null) {
        const backRooms = [];
        if (split) {
          backRooms.push({ id: 'bw', x0: rx0, x1: xp - PT / 2, z0: iz0, z1: zp - PT / 2, ports: [] });
          backRooms.push({ id: 'be', x0: xp + PT / 2, x1: rx1, z0: iz0, z1: zp - PT / 2, ports: [] });
        } else backRooms.push({ id: 'bw', x0: rx0, x1: rx1, z0: iz0, z1: zp - PT / 2, ports: [] });
        for (const R of backRooms) {
          P.rooms.push(R);
          const cx = clamp((R.x0 + R.x1) / 2, R.x0 + DW / 2 + 0.25, R.x1 - DW / 2 - 0.25);
          mkDoor('x', cx, zp);
          R.ports.push({ x: cx, z: R.z1 - 0.05 });
          front.ports.push({ x: cx, z: front.z0 + 0.05 });
        }
        if (split) P.parts.push({ type: 'wall', axis: 'z', c: xp, a0: iz0, a1: zp });
        P.parts.push({ type: 'wall', axis: 'x', c: zp, a0: rx0, a1: rx1, full: true });
      }
      // ön kapı / arka kapı portları
      if (k === 0) {
        front.ports.push({ x: doorX, z: iz1 - 0.05 });
        P.keeps.push({ x0: doorX - 1.0, x1: doorX + 1.0, z0: iz1 - 1.8, z1: iz1 });
        if (theme === 'garage') {
          // geniş sürgülü garaj kapısı (3.4 m açık): araç/oyuncu girişi, önü boş şerit
          const sd = doorX > 0 ? -1 : 1;
          P.rollAt = clamp(doorX + sd * (DW / 2 + 1.7 + 0.4), ix0 + 2.0, ix1 - 2.0);
          P.keeps.push({ x0: P.rollAt - 1.9, x1: P.rollAt + 1.9, z0: iz1 - 2.2, z1: iz1 });
          front.ports.push({ x: P.rollAt, z: iz1 - 0.05 });
        }
        if (backDoor) {
          const br = P.rooms.find((r) => r.id === 'bw') || front;
          const bx = zp !== null ? clamp((br.x0 + br.x1) / 2, br.x0 + 1.0, br.x1 - 1.0) : 0;
          P.backDoorX = bx;
          br.ports.push({ x: bx, z: iz0 + 0.05 });
          P.keeps.push({ x0: bx - 1.0, x1: bx + 1.0, z0: iz0, z1: iz0 + 1.8 });
        }
      }
      // merdiven kovaları: kısıtlar
      for (const f of sh) {
        const sx0 = f.side === 'w' ? ix0 : ix1 - SW - PT, sx1 = f.side === 'w' ? ix0 + SW + PT : ix1;
        if (f.k === k) {
          // alt basamak girişi: kovanın güneyi açık
          P.solids.push({ x0: sx0, x1: sx1, z0: Math.max(front.z0, iz0), z1: f.zb });
          P.keeps.push({ x0: f.side === 'w' ? sx0 : sx0 - 1.2, x1: f.side === 'w' ? sx1 + 1.2 : sx1, z0: f.zb, z1: f.zb + 1.4 });
          front.ports.push({ x: (sx0 + sx1) / 2, z: f.zb + 0.9 });
        }
        if (f.k + 1 === k) {
          P.solids.push({ x0: sx0, x1: sx1, z0: Math.max(front.z0, iz0), z1: f.zb });
          P.keeps.push({ x0: f.side === 'w' ? sx0 : sx0 - 1.0, x1: f.side === 'w' ? sx1 + 1.0 : sx1, z0: f.zb, z1: f.zb + 1.0 });
          // iniş sahanlığı kapısı → kuzeydeki oda
          const at = iz0 + f.LD / 2;
          P.parts.push({ type: 'door', axis: 'z', at, c: shaftX(f), w: DW, landing: f });
          const tgt = P.rooms.find((r) => (f.side === 'w' ? r.x0 === rx0 : r.x1 === rx1) && r.z0 === iz0) || front;
          const px = f.side === 'w' ? rx0 + 0.9 : rx1 - 0.9;
          tgt.ports.push({ x: px, z: at });
          P.keeps.push({ x0: f.side === 'w' ? rx0 : rx1 - 1.7, x1: f.side === 'w' ? rx0 + 1.7 : rx1, z0: at - DW / 2 - 0.2, z1: at + DW / 2 + 0.2 });
        }
      }
      // oda tipleri
      assignTypes(P, k);
      return P;
    }

    function assignTypes(P, k) {
      const front = P.rooms.find((r) => r.id === 'front'), bw = P.rooms.find((r) => r.id === 'bw'), be = P.rooms.find((r) => r.id === 'be');
      const swap = rng() < 0.5;
      if (theme === 'house') {
        if (k === 0) {
          front.type = 'living';
          if (bw && be) { bw.type = swap ? 'kitchen' : 'bedroom'; be.type = swap ? 'bedroom' : 'bath'; if (!swap && rng() < 0.5) { bw.type = 'bedroom'; be.type = 'kitchen'; } }
          else if (bw) bw.type = backDoor ? 'kitchen' : 'bedroom';
          if (!bw) front.type = 'studio';
        } else {
          front.type = rng() < 0.5 ? 'bedroom' : 'study';
          if (bw && be) { bw.type = 'bedroom'; be.type = swap ? 'bath' : 'bedroom'; if (be.type === 'bedroom' && rng() < 0.4) be.type = 'study'; }
          else if (bw) bw.type = 'bath';
        }
      } else if (theme === 'shop') {
        if (k === 0) { front.type = 'shopHall'; if (bw) bw.type = 'storage'; if (be) be.type = 'storage'; }
        else { front.type = rng() < 0.5 ? 'living' : 'bedroom'; if (bw) bw.type = 'bedroom'; if (be) be.type = rng() < 0.5 ? 'bath' : 'bedroom'; }
      } else if (theme === 'office') {
        front.type = k === 0 ? 'lobby' : 'office';
        if (bw) bw.type = 'office'; if (be) be.type = rng() < 0.5 ? 'office' : 'storage';
      } else if (theme === 'school') {
        front.type = 'classroom';
        if (bw) bw.type = 'classroom'; if (be) be.type = k === 0 ? 'office' : 'classroom';
      } else if (theme === 'garage') {
        front.type = 'garageHall'; if (bw) bw.type = 'storage'; if (be) be.type = 'storage';
      } else if (theme === 'barracks') {
        front.type = 'barracks'; if (bw) bw.type = 'office'; if (be) be.type = 'storage';
      } else { front.type = 'living'; if (bw) bw.type = 'bedroom'; if (be) be.type = 'bath'; }
    }

    // ───── pencere planı ─────
    const winSpec = (R, side, lo, hi, P) => {
      const len = hi - lo;
      if (len < 2.1) return [];
      const big = R.type === 'shopHall' || R.type === 'lobby' || R.type === 'garageHall';
      const small = R.type === 'bath';
      const ww = small ? 0.8 : big ? 2.2 : R.type === 'classroom' ? 1.6 : 1.2;
      const n = Math.max(1, Math.floor((len - 0.6) / (big ? 3.6 : 3.0)));
      const out = [];
      for (let i = 0; i < n; i++) {
        const at = lo + (i + 0.5) * len / n;
        if (side === 's' && P.k === 0 && Math.abs(at - doorX) < DW / 2 + ww / 2 + 0.5) continue;
        if (side === 'n' && P.k === 0 && backDoor && P.backDoorX !== undefined && Math.abs(at - P.backDoorX) < DW / 2 + ww / 2 + 0.5) continue;
        const b0 = small ? 1.5 : big && P.k === 0 ? 0.5 : 1.0;
        const top = small ? 2.2 : big && P.k === 0 ? 2.4 : 2.2;
        out.push({ at, w: ww, b: b0, top, glass: true, glow: rng() < glow });
      }
      return out;
    };
    const opsFor = (P) => {
      const ops = { n: [], s: [], e: [], w: [] };
      const windowsOn = P.k > 0 || extraWindows;
      for (const R of P.rooms) {
        if (!windowsOn) break;
        if (R.z0 <= iz0 + 0.01) ops.n.push(...winSpec(R, 'n', P.shW ? Math.max(R.x0, P.rx0) : R.x0, P.shE ? Math.min(R.x1, P.rx1) : R.x1, P));
        if (R.z1 >= iz1 - 0.01) ops.s.push(...winSpec(R, 's', R.x0, R.x1, P));
        const zlo = Math.max(R.z0, 0), zhi = R.z1;
        if (R.x0 <= ix0 + 0.01) {
          const lo = P.shW ? Math.max(R.z0, P.shW.zb + 0.4) : R.z0;
          ops.w.push(...winSpec(R, 'w', lo, zhi, P));
        }
        if (R.x1 >= ix1 - 0.01) {
          const lo = P.shE ? Math.max(R.z0, P.shE.zb + 0.4) : R.z0;
          ops.e.push(...winSpec(R, 'e', lo, zhi, P));
        }
      }
      if (P.rollAt !== undefined) { ops.s = ops.s.filter((q) => Math.abs(q.at - P.rollAt) > 1.7 + q.w / 2 + 0.3); ops.s.push({ at: P.rollAt, w: 3.4, b: 0, top: 2.7 }); }
      if (P.k === 0) ops.s.push({ at: doorX, w: DW, b: 0, top: 2.3 });
      if (P.k === 0 && backDoor) ops.n.push({ at: P.backDoorX ?? 0, w: DW, b: 0, top: 2.3 });
      return ops;
    };

    // ───── gövde ─────
    for (const [px, pz, pw, pd] of [[0, z0 - 0.15, W + 0.6, 0.3], [0, z1 + 0.15, W + 0.6, 0.3], [x0 - 0.15, 0, 0.3, D], [x1 + 0.15, 0, 0.3, D]]) b.box(px, 0, pz, pw, 0.35, pd, '#8b8a84', NC);
    b.box(0, 0, 0, W - 0.2, 0.06, D - 0.2, floorCol, NC);

    for (let k = 0; k < F; k++) {
      const P = plans[k];
      const y0 = P.y0;
      const ops = opsFor(P);
      wallInfo[k] = ops;
      b.shell(x0, x1, z0, z1, y0, floorH, T, wall, ops, { trim });
      // iç kaplama (iç yüz rengi): açıklıkları aynen izler
      const skin = (arr) => arr.map((q) => ({ ...q, glass: false }));
      const sh = floorH - 0.25, sT = 0.05;
      b.wall('x', ix0, ix1, iz0 + sT / 2, y0, sh, sT, inner, skin(ops.n), NC);
      b.wall('x', ix0, ix1, iz1 - sT / 2, y0, sh, sT, inner, skin(ops.s), NC);
      b.wall('z', iz0 + sT, iz1 - sT, ix0 + sT / 2, y0, sh, sT, inner, skin(ops.w), NC);
      b.wall('z', iz0 + sT, iz1 - sT, ix1 - sT / 2, y0, sh, sT, inner, skin(ops.e), NC);
      // kapı çerçevesi (dış)
      if (k === 0) {
        doorFrame(doorX, z1, 'x');
        if (backDoor) doorFrame(P.backDoorX ?? 0, z0, 'x');
      }
    }
    // pencere süsleri (yalnız dekor): panjur + çiçeklik (ev), tente (dükkân/ofis)
    if (theme === 'house' || theme === 'shop') {
      const shut = pick(rng, ['#4f6a3a', '#2f4a5f', '#7a2f2a', '#e8e6df', '#6e3b22']);
      const useShut = rng() < 0.6, useBox = rng() < 0.5;
      for (let k = 0; k < F; k++) {
        if (theme === 'shop' && k === 0) continue;
        const ops = wallInfo[k];
        for (const sd of ['n', 's', 'e', 'w']) for (const q of ops[sd]) {
          if (!q.glass || q.w > 1.5) continue;
          const y = k * floorH;
          const alongX = sd === 'n' || sd === 's';
          const off = (sd === 'n' || sd === 'w' ? -1 : 1) * (T / 2 + 0.03);
          const px = alongX ? q.at : (sd === 'w' ? x0 : x1) + off, pz = alongX ? (sd === 'n' ? z0 : z1) + off : q.at;
          for (const sg of [-1, 1]) {
            if (!useShut) break;
            if (alongX) b.box(px + sg * (q.w / 2 + 0.22), y + q.b, pz, 0.4, q.top - q.b, 0.06, shut, NC);
            else b.box(px, y + q.b, pz + sg * (q.w / 2 + 0.22), 0.06, q.top - q.b, 0.4, shut, NC);
          }
          if (useBox && k === 0 && q.b > 0.8) {
            if (alongX) { b.box(px, y + q.b - 0.32, pz + (sd === 'n' ? -0.12 : 0.12), q.w + 0.1, 0.22, 0.3, '#6e4a2a', NC); b.box(px, y + q.b - 0.1, pz + (sd === 'n' ? -0.12 : 0.12), q.w, 0.1, 0.26, '#4f8a3a', NC); }
            else { b.box(px + (sd === 'w' ? -0.12 : 0.12), y + q.b - 0.32, pz, 0.3, 0.22, q.w + 0.1, '#6e4a2a', NC); b.box(px + (sd === 'w' ? -0.12 : 0.12), y + q.b - 0.1, pz, 0.26, 0.1, q.w, '#4f8a3a', NC); }
          }
        }
      }
    }
    if (theme === 'shop' || theme === 'office' && rng() < 0.5) {
      // şeritli tente (ön cephe, zemin kat pencerelerinin üstü)
      const aw = [pick(rng, ['#c0392b', '#2c5aa0', '#2c7a4a', '#d9a921']), '#e8e8e4'];
      const n = Math.max(4, Math.round((W - 2.4) / 1.0));
      const aw0 = -W / 2 + 1.0, len = W - 2.0;
      for (let i = 0; i < n; i++) b.box(aw0 + (i + 0.5) * len / n, 2.55, z1 + 0.65, len / n, 0.1, 1.3, aw[i % 2], { collide: false, rx: -0.18 });
      b.box(0, 3.0, z1 + 0.18, len, 0.5, 0.06, pick(rng, ['#3a2a18', '#2a2d30']), NC);
      b.box(0, 3.55, z1 + 0.15, len * 0.4, 0.4, 0.05, '#ffd98a', { collide: false, o: { glow: true } });
    }
    // köşe sütunları, üst bant, kat kuşağı
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.box(px, 0, pz, 0.42, H, 0.42, trim, NC);
    ring(H - 0.35, 0.35, 0.2);
    for (let k = 1; k < F; k++) ring(k * floorH - 0.14, 0.18, 0.1);

    // ───── kat döşemeleri / tavan (merdiven boşluklu) ─────
    for (let k = 1; k <= F; k++) {
      const holes = fl.filter((f) => f.k + 1 === k).map((f) => ({ xa: f.side === 'w' ? ix0 : ix1 - SW, xb: f.side === 'w' ? ix0 + SW : ix1, za: f.zt, zb: f.zb }));
      slab(k * floorH - 0.25, 0.25, holes, k === F ? (hasRoofAccess ? '#8f8f88' : '#d8cfba') : '#c9b48a');
    }
    // ───── merdivenler, kova duvarları, kat içi bölmeler ─────
    for (let k = 0; k < Lv; k++) {
      const P = plans[k];
      const y0 = k * floorH;
      if (k < F) for (const f of shaftsAt(k)) {
        // kova duvarı
        const xw = shaftX(f);
        const ops = [];
        if (f.k + 1 === k) ops.push({ at: iz0 + f.LD / 2, w: DW, b: 0, top: 2.3 });
        b.wall('z', iz0, f.zb, xw, y0, floorH - 0.1, PT, inner, ops, {});
        for (const q of ops) jambs('z', xw, q.at, q.w, y0);
        if (f.k === k) {
          // merdiven başının arkasındaki (iniş sahanlığı altı) boşluğu doldur: kapalı oda kalmasın
          b.box(f.side === 'w' ? ix0 + SW / 2 : ix1 - SW / 2, y0, (iz0 + f.zt) / 2, SW, floorH - 0.3, f.zt - iz0, '#c9b48a');
        }
        if (f.k + 1 === k) {
          // boşluğun güney kenarına korkuluk
          rail(f.side === 'w' ? ix0 : ix1 - SW, f.side === 'w' ? ix0 + SW : ix1, f.zb + 0.05, y0);
        }
      }
      if (k < Lv - 1) {
        const f = fl[k];
        b.stairs(f.xc, f.zb, y0, '-z', 1.3, f.n, f.rise, f.run, '#b58a57');
        // basamak yan kirişi (görsel)
        b.box(f.side === 'w' ? f.xb + 0.04 : f.xa - 0.04, y0, (f.zt + f.zb) / 2, 0.06, 0.2, f.zb - f.zt, '#6e4a2a', NC);
      }
      if (k === F && hasRoofAccess) {
        const f = fl[k - 1];
        rail(f.side === 'w' ? ix0 : ix1 - SW, f.side === 'w' ? ix0 + SW : ix1, f.zb + 0.05, y0);
        rail(f.side === 'w' ? ix0 + SW : ix1 - SW, 0, 0, y0, 'z', f.zt, f.zb);
      }
      if (k >= F) continue;
      // iç bölmeler
      for (const pt of P.parts) {
        if (pt.type === 'wall') {
          const ops = [];
          if (pt.full) for (const dd of P.doors) if (dd.axis === 'x' && dd.c === pt.c) ops.push({ at: dd.at, w: dd.w, b: 0, top: 2.25 });
          if (pt.axis === 'x') b.wall('x', pt.a0, pt.a1, pt.c, y0, floorH - 0.1, PT, inner, ops, {});
          else b.wall('z', pt.a0, pt.a1, pt.c, y0, floorH - 0.1, PT, inner, ops, {});
          for (const q of ops) jambs(pt.axis, pt.c, q.at, q.w, y0);
        }
      }
    }

    // ───── çatı ─────
    if (flat) {
      const pw = 0.25, ph = 1.05;
      // parapet: kenarlar (çatı erişimi varsa çarpışmalı siper)
      const pc = hasRoofAccess ? {} : NC;
      b.box(0, H, z0, W + T + 0.2, ph, pw, roof, pc);
      b.box(0, H, z1, W + T + 0.2, ph, pw, roof, pc);
      b.box(x0, H, 0, pw, ph, D - 0.3, roof, pc);
      b.box(x1, H, 0, pw, ph, D - 0.3, roof, pc);
      b.box(0, H, 0, W - 0.2, 0.06, D - 0.2, '#5a5c60', NC);      // çatı membranı
      // çatı eşyaları
      const rx = W * 0.2, rz = -D * 0.2;
      b.box(rx, H + 0.06, rz, 1.4, 0.9, 1.0, '#a8aeb4', hasRoofAccess ? {} : NC);   // klima kutusu
      b.box(rx, H + 0.96, rz, 1.0, 0.06, 0.7, '#7a8088', NC);
      if (hasRoofAccess) {
        b.box(-rx, H + 0.06, rz + 0.4, 1.0, 1.2, 1.0, '#8a929a');
        b.box(0, H + 0.06, D * 0.28, 2.0, 0.4, 0.5, '#c9c2a8');            // alçak siper blokları
      }
      b.box(W * 0.38, H, -D * 0.12, 0.2, 3.2, 0.2, '#2a2d30', NC);          // anten
    } else {
      const ridgeAlongX = W >= D;
      const cross = (ridgeAlongX ? D : W) + 1.0;
      const len = (ridgeAlongX ? W : D) + 1.0;
      b.prism(0, H - 0.15, 0, cross, cross * 0.3, len, roof, { ry: ridgeAlongX ? Math.PI / 2 : 0 });
      if (rng() < 0.8) b.box(ridgeAlongX ? W * 0.25 : 0, H, ridgeAlongX ? 0 : D * 0.25, 0.7, 2.2, 0.7, '#8a5a48', NC);
    }

    // ───── sundurma (ön/arka kapı) ─────
    if (porch) {
      const drawPorch = (px, pz, rr) => b.with(px, 0, pz, rr, () => {
        b.box(0, 0, 0, 2.8, 0.14, 1.6, '#a9a9a3', NC);
        b.box(0, 2.55, 0, 3.2, 0.15, 1.8, roof, NC);
        b.box(-1.4, 0, 0.7, 0.14, 2.55, 0.14, trim, NC);
        b.box(1.4, 0, 0.7, 0.14, 2.55, 0.14, trim, NC);
        b.box(0, 2.35, 0.2, 0.2, 0.2, 0.2, '#ffd98a', { collide: false, o: { glow: true } });
      });
      drawPorch(doorX, z1 + 1.0, 0);
      if (backDoor) drawPorch(plans[0].backDoorX ?? 0, z0 - 1.0, Math.PI);
    }
    // açık kapı kanadı (dekor)
    openLeaf(doorX, z1, 1);
    if (backDoor) openLeaf(plans[0].backDoorX ?? 0, z0, -1);

    // ───── mobilya ─────
    for (let k = 0; k < F; k++) {
      const P = plans[k];
      const y0 = k * floorH;
      for (const R of P.rooms) {
        if (R.type !== 'empty') roomFloor(R, y0, k);
      }
      if (furnishing) furnishLevel(P, y0, k);
      const cx = [];
      for (const R of P.rooms) {
        const [wx, wz] = toWorld((R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2);
        info.targets.push({ x: wx, z: wz, y: y0, room: R.type });
      }
    }
    if (hasRoofAccess) {
      const f = fl[Lv - 2];
      const [wx, wz] = toWorld(0, D * 0.15);
      info.targets.push({ x: wx, z: wz, y: H, room: 'roof' });
      info.roof = true;
    }
    info.fl = fl;
    info.plans = plans;
    const [dx, dz] = toWorld(doorX, z1 + 2.0);
    info.entry = { x: dx, z: dz };

    // ═════════ yerel yardımcılar ═════════
    function ring(y, h, over) {
      b.box(0, y, z0, W + T + over, h, T + over, trim, NC);
      b.box(0, y, z1, W + T + over, h, T + over, trim, NC);
      b.box(x0, y, 0, T + over, h, D - T - over, trim, NC);
      b.box(x1, y, 0, T + over, h, D - T - over, trim, NC);
    }
    function doorFrame(at, c, axis) {
      for (const s of [-1, 1]) b.box(at + s * (DW / 2 + 0.04), 0, c, 0.1, 2.3, T + 0.1, trim, NC);
      b.box(at, 2.3, c, DW + 0.18, 0.1, T + 0.1, trim, NC);
    }
    function jambs(axis, c, at, wd, y0) {
      for (const s of [-1, 1]) {
        if (axis === 'x') b.box(at + s * (wd / 2 + 0.03), y0, c, 0.07, 2.25, PT + 0.06, trim, NC);
        else b.box(c, y0, at + s * (wd / 2 + 0.03), PT + 0.06, 2.25, 0.07, trim, NC);
      }
    }
    function openLeaf(at, c, s) {
      const hx = at - DW / 2 + 0.05;
      b.with(hx, 0, c - s * (T / 2 - 0.02), s > 0 ? 1.15 : -1.15, () => {
        b.box(0.6, 0, 0, 1.2, 2.15, 0.05, pick(rng, ['#6e3b22', '#2f4a5f', '#4f6a3a', '#7a2f2a']), NC);
      });
    }
    function slab(y, th, holes, color) {
      // dikdörtgen boşluklu döşeme (en çok bir delik)
      const ax0 = x0 + 0.0, ax1 = x1 - 0.0, az0 = z0, az1 = z1;
      if (!holes.length) { b.box(0, y, 0, W - 0.1, th, D - 0.1, color); return; }
      const h = holes[0];
      // delik dışında kalan alanlar: batı/doğu şeridi + kuzey/güney bölümü
      const X0 = -W / 2 + 0.05, X1 = W / 2 - 0.05, Z0 = -D / 2 + 0.05, Z1 = D / 2 - 0.05;
      const box = (a, c, e, g) => { if (c - a > 0.02 && g - e > 0.02) b.box((a + c) / 2, y, (e + g) / 2, c - a, th, g - e, color); };
      box(X0, X1, Z0, h.za);                 // kuzey (iniş sahanlığı dahil)
      box(X0, X1, h.zb, Z1);                 // güney
      box(X0, h.xa, h.za, h.zb);             // batı şerit (delik dışı)
      box(h.xb, X1, h.za, h.zb);             // doğu şerit
      for (let i = 1; i < holes.length; i++) { /* tek delik varsayımı */ }
    }
    function rail(xa, xb, zc, y0, axis = 'x', za = 0, zb2 = 0) {
      if (axis === 'x') {
        b.box((xa + xb) / 2, y0, zc, xb - xa, 1.0, 0.08, '#8b5a2b');
        b.box((xa + xb) / 2, y0 + 0.95, zc, xb - xa, 0.07, 0.12, '#5e3c1d', NC);
      } else {
        b.box(xa, y0, (za + zb2) / 2, 0.08, 1.0, zb2 - za, '#8b5a2b');
      }
    }
    function roomFloor(R, y0, k) {
      const tile = R.type === 'bath' || R.type === 'kitchen' || R.type === 'storage' || R.type === 'garageHall' || R.type === 'shopHall';
      const col = R.type === 'bath' ? pick(rng, TILEC) : tile ? (R.type === 'garageHall' ? '#6a6d73' : R.type === 'shopHall' ? '#b9b5aa' : pick(rng, TILEC)) : R.type === 'living' ? pick(rng, ['#8a6a48', '#a58a62']) : R.type === 'bedroom' || R.type === 'study' ? pick(rng, FLOORC) : R.type === 'classroom' || R.type === 'office' || R.type === 'lobby' ? pick(rng, ['#8a8d8a', '#9a9486', '#7a8590']) : pick(rng, FLOORC);
      const yy = y0 + (k === 0 ? 0.06 : 0.0);
      b.box((R.x0 + R.x1) / 2, yy, (R.z0 + R.z1) / 2, R.x1 - R.x0, 0.025, R.z1 - R.z0, col, NC);
    }

    // ═════════ mobilya yerleştirme ═════════
    function furnishLevel(P, y0, k) {
      const occ = [];
      for (const q of P.keeps) occ.push({ ...q, solid: false });
      for (const q of P.solids) occ.push({ ...q, solid: true, tall: true, shaft: true });
      const feats = [];   // duvar elemanları (pencere/kapı) çıplak dikdörtgenleri
      const ops = wallInfo[k];
      for (const q of ops.n) feats.push({ x0: q.at - q.w / 2 - 0.25, x1: q.at + q.w / 2 + 0.25, z0: iz0 - 0.1, z1: iz0 + 0.3 });
      for (const q of ops.s) feats.push({ x0: q.at - q.w / 2 - 0.25, x1: q.at + q.w / 2 + 0.25, z0: iz1 - 0.3, z1: iz1 + 0.1 });
      for (const q of ops.w) feats.push({ x0: ix0 - 0.1, x1: ix0 + 0.3, z0: q.at - q.w / 2 - 0.25, z1: q.at + q.w / 2 + 0.25 });
      for (const q of ops.e) feats.push({ x0: ix1 - 0.3, x1: ix1 + 0.1, z0: q.at - q.w / 2 - 0.25, z1: q.at + q.w / 2 + 0.25 });
      for (const dd of P.doors) {
        if (dd.axis === 'x') feats.push({ x0: dd.at - dd.w / 2 - 0.1, x1: dd.at + dd.w / 2 + 0.1, z0: dd.c - 0.3, z1: dd.c + 0.3 });
        else feats.push({ x0: dd.c - 0.3, x1: dd.c + 0.3, z0: dd.at - dd.w / 2 - 0.1, z1: dd.at + dd.w / 2 + 0.1 });
      }
      for (const pt of P.parts) if (pt.type === 'door' && pt.landing) feats.push({ x0: pt.c - 0.3, x1: pt.c + 0.3, z0: pt.at - pt.w / 2 - 0.1, z1: pt.at + pt.w / 2 + 0.1 });

      const INF = 0.6;     // bot (nav: 0.5 m hücre + 0.35 şişirme) ile uyum için geniş marj: <1.2 m geçit bırakma
      // Odadaki serbest hücreler (0.2 m ızgara, eşyalar inf kadar şişirilir) → bağlı bileşenler
      const gridFlood = (R, inf) => {
        const cs = 0.2;
        const nx = Math.ceil((R.x1 - R.x0) / cs), nz = Math.ceil((R.z1 - R.z0) / cs);
        const free = new Uint8Array(nx * nz);
        const solids = occ.filter((q) => q.solid && !q.flat && ov(q, R, 0));
        let nfree = 0;
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
          const px = R.x0 + (i + 0.5) * cs, pz = R.z0 + (j + 0.5) * cs;
          if (px < R.x0 + inf || px > R.x1 - inf || pz < R.z0 + inf || pz > R.z1 - inf) continue;
          let bl = false;
          for (const q of solids) {
            const r = q.pure || q;
            if (px > r.x0 - inf && px < r.x1 + inf && pz > r.z0 - inf && pz < r.z1 + inf) { bl = true; break; }
          }
          if (!bl) { free[j * nx + i] = 1; nfree++; }
        }
        return { cs, nx, nz, free, nfree };
      };
      const connected = (R) => {
        if (R.x1 - R.x0 < 0.8 || R.z1 - R.z0 < 0.8) return true;
        const G = gridFlood(R, INF);
        const { cs, nx, nz, free } = G;
        if (!G.nfree) return !R.ports.length;
        const seen = new Uint8Array(nx * nz);
        const cellOf = (pt, fr) => {
          const ci = clamp(Math.floor((pt.x - R.x0) / cs), 0, nx - 1), cj = clamp(Math.floor((pt.z - R.z0) / cs), 0, nz - 1);
          for (let rr = 0; rr < 8; rr++) for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) {
            const ii = ci + di, jj = cj + dj;
            if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && fr[jj * nx + ii]) return jj * nx + ii;
          }
          return -1;
        };
        const fillFrom = (starts, fr, mark) => {
          const stack = [...starts]; let cnt = 0;
          for (const s0 of starts) mark[s0] = 1;
          while (stack.length) {
            const c = stack.pop(); cnt++;
            const ci = c % nx, cj = (c / nx) | 0;
            for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const ii = ci + di, jj = cj + dj;
              if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
              const n2 = jj * nx + ii;
              if (fr[n2] && !mark[n2]) { mark[n2] = 1; stack.push(n2); }
            }
          }
          return cnt;
        };
        const ports = R.ports.map((p) => cellOf(p, free));
        if (ports.some((p) => p < 0)) return false;
        const start = ports.length ? ports[0] : free.indexOf(1);
        const cnt = fillFrom([start], free, seen);
        if (ports.some((p) => !seen[p])) return false;
        if (G.nfree - cnt > 10) return false;
        // bot nav'ı (0.35 şişirme) için de cep denetimi: portlardan ulaşılamayan ≥ 0.4 m² serbest küme olmasın
        const G2 = gridFlood(R, 0.5);
        if (G2.nfree) {
          const seen2 = new Uint8Array(nx * nz);
          const st2 = ports.length ? R.ports.map((p) => cellOf(p, G2.free)).filter((c) => c >= 0) : [G2.free.indexOf(1)];
          if (st2.length) fillFrom(st2, G2.free, seen2);
          let un = 0;
          for (let i = 0; i < nx * nz; i++) if (G2.free[i] && !seen2[i]) un++;
          if (un * cs * cs > 0.4) return false;
        }
        return true;
      };

      const tryAdd = (R, name, cx, cz, rr, opt = {}) => {
        const it = ITEMS[name];
        const fp = footprint(name, rr);
        const pure = { x0: cx - fp.w / 2, x1: cx + fp.w / 2, z0: cz - fp.d / 2, z1: cz + fp.d / 2 };
        if (pure.x0 < R.x0 - 0.01 || pure.x1 > R.x1 + 0.01 || pure.z0 < R.z0 - 0.01 || pure.z1 > R.z1 + 0.01) return false;
        const pad = opt.pad ?? it.pad ?? 0;
        const rect = { x0: pure.x0 - pad, x1: pure.x1 + pad, z0: pure.z0 - pad, z1: pure.z1 + pad };
        if (!it.flat) for (const q of occ) if (ov(rect, q) && !(q.flat)) return false;
        const rec = { ...rect, pure, solid: !it.flat, flat: !!it.flat, tall: TALL.has(name), name };
        if (!it.flat) {
          occ.push(rec);
          if (!connected(R)) { occ.pop(); return false; }
        } else occ.push(rec);
        put(b, rng, name, cx, y0 + (k === 0 ? 0.08 : 0.025), cz, rr);
        return rec;
      };
      // duvar boyunca yerleştirme: wl ∈ n/s/e/w, t ∈ [0,1] duvar boyunca konum
      const wallPose = (R, wl, name, t, gap = 0.015) => {
        const it = ITEMS[name];
        if (wl === 'n') return { x: R.x0 + it.w / 2 + t * Math.max(0, R.x1 - R.x0 - it.w), z: R.z0 + it.d / 2 + gap, ry: 0 };
        if (wl === 's') return { x: R.x0 + it.w / 2 + t * Math.max(0, R.x1 - R.x0 - it.w), z: R.z1 - it.d / 2 - gap, ry: Math.PI };
        if (wl === 'w') return { x: R.x0 + it.d / 2 + gap, z: R.z0 + it.w / 2 + t * Math.max(0, R.z1 - R.z0 - it.w), ry: Math.PI / 2 };
        return { x: R.x1 - it.d / 2 - gap, z: R.z0 + it.w / 2 + t * Math.max(0, R.z1 - R.z0 - it.w), ry: -Math.PI / 2 };
      };
      const FINE = Array.from({ length: 19 }, (_, i) => 0.05 + i * 0.05);
      const place = (R, name, walls, ts0 = [0.5, 0.2, 0.8, 0.0, 1.0, 0.35, 0.65], opt = {}) => {
        const ts = [...ts0, ...FINE.filter((t) => !ts0.includes(t))];        // tercih edilen konumlar önce, sonra ince tarama
        const ws = Array.isArray(walls) ? walls : [walls];
        for (const wl of ws) for (const t of ts) {
          const pp = wallPose(R, wl, name, t);
          const rec = tryAdd(R, name, pp.x, pp.z, pp.ry, opt);
          if (rec) return { ...pp, rec, wl };
        }
        return null;
      };
      const free = (R, name, opt = {}) => {
        const cands = [];
        const cx0 = (R.x0 + R.x1) / 2, cz0 = (R.z0 + R.z1) / 2;
        for (let i = 0; i < 28; i++) cands.push([cx0 + (rng() - 0.5) * (R.x1 - R.x0 - 1.2), cz0 + (rng() - 0.5) * (R.z1 - R.z0 - 1.2), rng() < 0.5 ? 0 : Math.PI / 2]);
        if (opt.center) cands.unshift([cx0, cz0, 0], [cx0, cz0, Math.PI / 2]);
        for (const [cx, cz, rr] of cands) { const rec = tryAdd(R, name, cx, cz, opt.ry ?? rr, opt); if (rec) return { x: cx, z: cz, ry: opt.ry ?? rr, rec }; }
        return null;
      };
      // yerleşik bir parçanın yerel (lx,lz) ofsetine aynı yönde ürün ekle
      const beside = (R, base, name, lx, lz, opt = {}) => {
        const c = Math.cos(base.ry), s = Math.sin(base.ry);
        return tryAdd(R, name, base.x + lx * c + lz * s, base.z - lx * s + lz * c, base.ry, opt);
      };
      const corner = (R, name, opt = {}) => {
        const it = ITEMS[name];
        for (const [cx, cz] of [[R.x1 - it.w / 2, R.z0 + it.d / 2], [R.x0 + it.w / 2, R.z0 + it.d / 2], [R.x1 - it.w / 2, R.z1 - it.d / 2], [R.x0 + it.w / 2, R.z1 - it.d / 2]]) {
          const rec = tryAdd(R, name, cx, cz, 0, { ...opt }); if (rec) return rec;
        }
        return null;
      };
      const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const sideWalls = (R) => shuffle(['e', 'w']);

      const fill = {
        living(R) {
          const sideA = shuffle(['e', 'w', 'n']);
          const tv = place(R, 'tv', [...sideA, 's'], [0.5, 0.3, 0.7]);
          let couch = null;
          const opp = tv ? { e: 'w', w: 'e', n: 's', s: 'n' }[tv.wl] : 'w';
          couch = place(R, 'couch', [opp, ...shuffle(['n', 'e', 'w'])], [0.5, 0.3, 0.7, 0.15, 0.85]);
          if (couch) {
            const fx = Math.sin(couch.ry), fz = Math.cos(couch.ry);
            const ct = tryAdd(R, 'coffeeTable', couch.x + fx * 1.3, couch.z + fz * 1.3, couch.ry);
            if (ct) tryAdd(R, 'rug', couch.x + fx * 1.3, couch.z + fz * 1.3, couch.ry);
            beside(R, couch, 'armchair', -1.9, 0.2) || beside(R, couch, 'armchair', 1.9, 0.2);
          } else free(R, 'rug');
          place(R, 'bookshelf', shuffle(['n', 'e', 'w']), [0.1, 0.9, 0.5]);
          place(R, 'sideboard', shuffle(['n', 's', 'e', 'w']), [0.9, 0.1, 0.5]);
          if (rng() < 0.7) place(R, 'piano', shuffle(['n', 'e', 'w']), [0.5, 0.15, 0.85]);
          if (R.x1 - R.x0 > 6.5 && R.z1 - R.z0 > 4) free(R, 'diningTable');
          corner(R, 'floorLamp'); corner(R, 'plant'); corner(R, 'plant');
          paintings(R, 3);
        },
        studio(R) {
          place(R, 'bed', ['n', 'e', 'w']);
          place(R, 'kitchenRun', ['e', 'w', 'n'], [0.0, 1.0, 0.5]) || place(R, 'counterShort', ['e', 'w', 'n']);
          place(R, 'couch', ['w', 'e', 'n'], [0.5, 0.2, 0.8]);
          free(R, 'diningTable'); free(R, 'rug'); place(R, 'wardrobe', ['n', 'e', 'w']);
          corner(R, 'plant'); paintings(R, 2);
        },
        bedroom(R) {
          const bw = place(R, 'bed', shuffle(['n', 'e', 'w', 's']), [0.5, 0.3, 0.7, 0.1, 0.9]);
          if (bw) {
            beside(R, bw, 'nightstand', -(0.85 + 0.3), -0.825); beside(R, bw, 'nightstand', 0.85 + 0.3, -0.825);
            const fx = Math.sin(bw.ry), fz = Math.cos(bw.ry);
            tryAdd(R, 'rug', bw.x + fx * 1.4, bw.z + fz * 1.4, bw.ry + Math.PI / 2);
            beside(R, bw, 'chest', 0, 1.35);
          } else (place(R, 'bedSingle', shuffle(['n', 'e', 'w', 's'])) || free(R, 'bedSingle'));
          place(R, 'wardrobe', shuffle(['n', 'e', 'w', 's']), [0.1, 0.9, 0.5]);
          place(R, 'dresser', shuffle(['n', 'e', 'w', 's']), [0.9, 0.1, 0.5]);
          if (rng() < 0.6) { const dk = place(R, 'desk', shuffle(['n', 'e', 'w']), [0.9, 0.1, 0.5]); if (dk) beside(R, dk, 'chair', 0, 0.75); }
          if (rng() < 0.5) place(R, 'bedSingle', shuffle(['n', 'e', 'w', 's']), [0.0, 1.0]);
          corner(R, 'plant'); corner(R, 'floorLamp');
          paintings(R, 2);
        },
        study(R) {
          const dk = place(R, 'desk', shuffle(['n', 'e', 'w']), [0.5, 0.2, 0.8]);
          if (dk) beside(R, dk, 'chair', 0, 0.75);
          place(R, 'bookshelf', shuffle(['n', 'e', 'w', 's']), [0.1, 0.9, 0.5]);
          place(R, 'bookshelf', shuffle(['n', 'e', 'w', 's']), [0.9, 0.1, 0.5]);
          place(R, 'armchair', shuffle(['e', 'w', 'n']), [0.2, 0.8]);
          free(R, 'rugRound'); corner(R, 'floorLamp'); corner(R, 'plant'); place(R, 'chest', ['s', 'n'], [0.5]);
          paintings(R, 2);
        },
        kitchen(R) {
          const kr = place(R, 'kitchenRun', shuffle(['n', 'e', 'w']), [0.0, 1.0, 0.5]) || place(R, 'counterShort', shuffle(['n', 'e', 'w']), [0.0, 1.0]);
          if (R.x1 - R.x0 > 4.0) place(R, 'fridge', ['s', 'e', 'w', 'n'], [0.9, 0.1, 0.5]);
          if (R.x1 - R.x0 > 4.4 && R.z1 - R.z0 > 3.2) free(R, 'island', { pad: 0.5 }) || free(R, 'diningTable');
          else free(R, 'diningTable');
          place(R, 'shelfLow', shuffle(['s', 'e', 'w']), [0.5, 0.15, 0.85]);
          corner(R, 'plant'); paintings(R, 1);
        },
        bath(R) {
          const tb = place(R, 'bathtub', shuffle(['n', 'e', 'w']), [0.0, 1.0]);
          place(R, 'toilet', shuffle(['n', 'e', 'w', 's']), [0.9, 0.1, 0.5]);
          place(R, 'basin', shuffle(['n', 'e', 'w', 's']), [0.5, 0.15, 0.85]);
          place(R, 'washer', shuffle(['n', 'e', 'w', 's']), [0.0, 1.0, 0.5]);
          free(R, 'rug', { ry: 0 });
        },
        storage(R) {
          for (let i = 0; i < 4; i++) place(R, rng() < 0.5 ? 'boxStack' : 'shelfLow', shuffle(['n', 'e', 'w', 's']), [0.0, 1.0, 0.5, 0.25, 0.75]);
          if (rng() < 0.6) place(R, 'chest', shuffle(['n', 'e', 'w']), [0.5]);
          free(R, 'pallet');
        },
        shopHall(R) {
          place(R, 'shopCounter', ['n', 'e', 'w'], [0.5, 0.15, 0.85]);
          for (const wl of shuffle(['e', 'w'])) place(R, 'cooler', [wl], [0.2, 0.8, 0.5]);
          for (let i = 0; i < 4; i++) place(R, 'shopShelf', shuffle(['n', 'e', 'w']), [0.0, 1.0, 0.3, 0.7, 0.5]);
          for (let i = 0; i < 5; i++) free(R, 'shopShelf', { pad: 0.7 });
          for (let i = 0; i < 3; i++) free(R, 'boxStack', { pad: 0.5 });
          corner(R, 'plant'); paintings(R, 2);
        },
        lobby(R) {
          place(R, 'shopCounter', ['n', 'e', 'w'], [0.5, 0.2, 0.8]);
          place(R, 'couch', shuffle(['e', 'w']), [0.5, 0.2, 0.8]); place(R, 'armchair', shuffle(['e', 'w', 'n']), [0.2, 0.8]);
          free(R, 'rug'); place(R, 'filing', shuffle(['n', 'e', 'w']), [0.1, 0.9]); place(R, 'bookshelf', shuffle(['n', 'e', 'w']), [0.9, 0.1, 0.5]);
          corner(R, 'plant'); corner(R, 'floorLamp'); paintings(R, 3, 'map');
        },
        office(R) {
          const dk = place(R, 'desk', shuffle(['n', 'e', 'w', 's']), [0.5, 0.2, 0.8]); if (dk) beside(R, dk, 'chair', 0, 0.75);
          const d2 = place(R, 'desk', shuffle(['n', 'e', 'w', 's']), [0.2, 0.8, 0.5]); if (d2) beside(R, d2, 'chair', 0, 0.75);
          place(R, 'filing', shuffle(['n', 'e', 'w', 's']), [0.0, 1.0, 0.5]); place(R, 'filing', shuffle(['n', 'e', 'w', 's']), [0.0, 1.0, 0.5]);
          place(R, 'bookshelf', shuffle(['n', 'e', 'w', 's']), [0.1, 0.9, 0.5]);
          if (R.x1 - R.x0 > 4.5 && R.z1 - R.z0 > 3.5) free(R, 'diningTable');
          corner(R, 'plant'); corner(R, 'floorLamp'); paintings(R, 2, 'map');
        },
        classroom(R) {
          place(R, 'blackboard', shuffle(['n', 'e', 'w', 's']), [0.5]);
          const dk = place(R, 'desk', shuffle(['e', 'w', 'n']), [0.1, 0.9]); if (dk) beside(R, dk, 'chair', 0, 0.75);
          for (let i = 0; i < 9; i++) free(R, 'classDesk', { pad: 0.5 });
          place(R, 'bookshelf', shuffle(['n', 'e', 'w', 's']), [0.1, 0.9, 0.5]);
          corner(R, 'plant'); paintings(R, 1, 'map');
        },
        garageHall(R) {
          place(R, 'workbench', ['n', 'e', 'w'], [0.2, 0.8, 0.5]);
          place(R, 'workbench', ['n', 'e', 'w'], [0.8, 0.2, 0.5]);
          place(R, 'toolChest', shuffle(['n', 'e', 'w']), [0.0, 1.0, 0.5]);
          place(R, 'tireStack', shuffle(['n', 'e', 'w', 's']), [0.0, 1.0, 0.5]); place(R, 'tireStack', shuffle(['n', 'e', 'w', 's']), [0.0, 1.0, 0.5]);
          place(R, 'rack', shuffle(['n', 'e', 'w']), [0.1, 0.9, 0.5]);
          free(R, 'forklift', { pad: 0.7 });
          for (let i = 0; i < 3; i++) free(R, 'boxStack', { pad: 0.5 });
          free(R, 'pallet', { pad: 0.5 });
        },
        barracks(R) {
          for (const wl of ['n', 's']) for (let i = 0; i < 4; i++) place(R, 'bunk', [wl], [0.04 + i * 0.3, 0.1 + i * 0.25, 0.5]);
          place(R, 'locker', ['e', 'w'], [0.1, 0.3, 0.5, 0.7, 0.9]); place(R, 'locker', ['e', 'w'], [0.2, 0.4, 0.6, 0.8]);
          free(R, 'diningTable', { pad: 0.5 }); paintings(R, 1, 'map');
        },
        empty() {},
      };

      const paintings = (R, count, kind = 'painting') => {
        let done = 0;
        const walls = shuffle(['n', 's', 'e', 'w']);
        for (const wl of walls) {
          if (done >= count) break;
          for (const t of [0.5, 0.25, 0.75, 0.12, 0.88]) {
            const it = ITEMS[kind];
            const pp = wallPose(R, wl, kind, t, 0.0);
            // duvar düzlemi şeridi: sadece yüksek eşyalar ve pencere/kapı engeller
            const strip = pp.ry === 0 || pp.ry === Math.PI
              ? { x0: pp.x - it.w / 2 - 0.1, x1: pp.x + it.w / 2 + 0.1, z0: pp.z - 0.4, z1: pp.z + 0.4 }
              : { x0: pp.x - 0.4, x1: pp.x + 0.4, z0: pp.z - it.w / 2 - 0.1, z1: pp.z + it.w / 2 + 0.1 };
            if (strip.x0 < R.x0 - 0.05 || strip.x1 > R.x1 + 0.05 || strip.z0 < R.z0 - 0.05 || strip.z1 > R.z1 + 0.05) {
              // duvar şeridinin odanın dışına taşmasını (karşı yön) kırp
            }
            let bad = false;
            for (const q of occ) if (q.solid && (q.tall || q.shaft) && ov(strip, q.pure || q, 0)) { bad = true; break; }
            if (!bad) for (const q of occ) if (!q.solid && !q.flat && ov(strip, q, 0)) { bad = false; }
            if (!bad) for (const f of feats) if (ov(strip, f, 0)) { bad = true; break; }
            if (!bad) for (const q of occ) if (q.solid && !q.shaft && q.name === 'tv' && ov(strip, q.pure, 0)) { bad = false; }
            // koltuk/yatak üzerinde serbest; kapı önü şeritleri boş kalması şart değil (duvarda asılı)
            if (bad) continue;
            put(b, rng, kind, pp.x, y0 + (k === 0 ? 0.06 : 0), pp.z, pp.ry);
            // aynı yerde ikinciyi koymamak için 'feats'e ekle
            feats.push(strip);
            done++;
            break;
          }
        }
      };

      P.occ = occ;
      for (const R of P.rooms) {
        if (R.type === 'empty') continue;
        // tavan lambası (parlar): oda merkezi
        put(b, rng, 'ceilLamp', (R.x0 + R.x1) / 2, y0, (R.z0 + R.z1) / 2, 0, floorH - 0.25);
        (fill[R.type] || fill.living)(R);
      }
    }
  }
}
