// Kasaba / şehir parçaları: taş duvar (kapılı/yıkık), çit-bahçe duvarı, su kulesi (tırmanılır), çeşme, büfe, pazar tezgâhı,
// otobüs durağı, reklam panosu, çardak, ekin sıraları, tahta barikat. Hepsi MapBuilder (b) üzerine; yerel çerçeve + ry (90° katları).
import { COL } from './kitBase.js';

const NC = { collide: false };
const toWorld = (x, z, ry) => (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];

// Taş/briket duvar. (x0,z0)→(x1,z1) eksen hizalı. gaps: [{at,w}] kapı açıklıkları (at: duvar boyunca koordinat).
// h yüksekliği göz hizasından (1.6) yüksekse ateşi ve görüşü keser. ruin: rastgele alçalan/çöken parçalar (siper).
export function wallStone(b, rng, x0, z0, x1, z1, { h = 2.4, t = 0.5, color = '#a8a49a', cap = '#8a867c', gaps = [], ruin = false, pillars = true } = {}) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const c = alongX ? z0 : x0;
  const segs = [];
  let cur = a0;
  for (const g of [...gaps].sort((p, q) => p.at - q.at)) { segs.push([cur, g.at - g.w / 2]); cur = g.at + g.w / 2; }
  segs.push([cur, a1]);
  const put = (s, e, hh, col) => {
    if (e - s < 0.05) return;
    if (alongX) { b.box((s + e) / 2, 0, c, e - s, hh, t, col); b.box((s + e) / 2, hh, c, e - s, 0.18, t + 0.14, cap, NC); }
    else { b.box(c, 0, (s + e) / 2, t, hh, e - s, col); b.box(c, hh, (s + e) / 2, t + 0.14, 0.18, e - s, cap, NC); }
  };
  for (const [s, e] of segs) {
    if (!ruin) { put(s, e, h, color); continue; }
    // yıkık: 2–4 m'lik parçalar, rastgele yükseklik (0.6 … h), arada kırık açıklıklar bırakma (geçit ≥ 1.4 m)
    let p = s;
    while (p < e - 0.05) {
      const len = Math.min(e - p, 1.6 + rng() * 2.4);
      const hh = rng() < 0.3 ? 0.7 + rng() * 0.6 : h * (0.55 + rng() * 0.45);
      if (rng() < 0.14 && e - p > 4) { p += 1.5; continue; }          // boşluk
      put(p, p + len, hh, color);
      p += len;
    }
  }
  // sütunlar (kapı kenarları + her 6 m)
  if (pillars) {
    const pts = new Set([a0, a1]);
    for (const g of gaps) { pts.add(g.at - g.w / 2); pts.add(g.at + g.w / 2); }
    for (let p = a0 + 6; p < a1 - 1; p += 6) pts.add(p);
    for (const p of pts) {
      if (ruin && rng() < 0.4) continue;
      const px = alongX ? p : c, pz = alongX ? c : p;
      b.box(px, 0, pz, t + 0.3, h + 0.35, t + 0.3, cap);
    }
  }
}

// Çalı/çit duvarı (siper): 1.3 m yüksek, çarpışmalı
export function hedge(b, x0, z0, x1, z1, { h = 1.3, t = 0.9, color = '#3f6a33' } = {}) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  if (alongX) { b.box(cx, 0, cz, len, h, t, color); b.box(cx, h, cz, len - 0.2, 0.25, t - 0.2, '#4a7a3a', NC); }
  else { b.box(cx, 0, cz, t, h, len, color); b.box(cx, h, cz, t - 0.2, 0.25, len - 0.2, '#4a7a3a', NC); }
}

// ───────── Su kulesi (tırmanılır) ─────────
// Platform üst yüzeyi y=8 (6.4×6.4), tank ortada. Merdiven kulenin dışında iki kollu: batı yüzü boyunca 0→4 m sahanlık (KB köşe),
// sonra kuzey yüzü boyunca 4→8 m platforma. Platformda 1.1 m korkuluk (kuzeyde merdivenin geldiği yerde açıklık).
export function waterTower(b, { x, z, ry = 0, color = '#8a6a45', tank = '#9db4c4' }) {
  const info = { targets: [], entry: null };
  const tw = toWorld(x, z, ry);
  b.with(x, 0, z, ry, () => {
    const S = 3.2, Y = 8.0, dark = '#4a4d52';
    // ayaklar + çapraz bağlantılar
    for (const sx of [-2.8, 2.8]) for (const sz of [-2.8, 2.8]) b.box(sx, 0, sz, 0.45, Y, 0.45, dark);
    for (const lv of [2.0, 4.8]) {
      for (const s of [-2.8, 2.8]) { b.box(0, lv, s, 5.2, 0.16, 0.14, color, NC); b.box(s, lv, 0, 0.14, 0.16, 5.2, color, NC); }
    }
    const len = Math.hypot(5.2, 2.8), ang = Math.atan2(2.8, 5.2);
    for (const s of [-2.8, 2.8]) { b.box(0, 2.0 + 1.4 - 0.07, s, len, 0.14, 0.1, color, { collide: false, rz: ang }); b.box(s, 2.0 + 1.4 - 0.07, 0, 0.1, 0.14, len, color, { collide: false, rx: -ang }); }
    // platform
    b.box(0, Y - 0.3, 0, 2 * S, 0.3, 2 * S, '#5a5d62');
    // korkuluk (kuzeyde açıklık x∈[-0.4,1.4])
    const rl = (cx, cz, w2, d2) => { b.box(cx, Y, cz, w2, 1.1, d2, '#7a5a38'); b.box(cx, Y + 1.1, cz, w2 + 0.04, 0.08, d2 + 0.04, dark, NC); };
    rl(0, S - 0.07, 2 * S, 0.14); rl(S - 0.07, 0, 0.14, 2 * S - 0.3); rl(-S + 0.07, 0, 0.14, 2 * S - 0.3);
    rl((-S + (-0.4)) / 2, -S + 0.07, (-0.4) - (-S), 0.14); rl((1.4 + S) / 2, -S + 0.07, S - 1.4, 0.14);
    // tank
    b.cyl(0, Y, 0, 2.0, 2.0, 3.6, tank, { seg: 10 });
    for (const yy of [0.6, 1.8, 3.0]) b.cyl(0, Y + yy, 0, 2.06, 2.06, 0.16, '#6a7a88', { seg: 10, collide: false });
    b.cyl(0, Y + 3.6, 0, 0.1, 2.15, 1.3, '#6a7a88', { seg: 10, collide: false });
    b.box(0, Y + 4.9, 0, 0.12, 1.2, 0.12, dark, NC);
    b.box(0, Y + 5.5, 0, 0.3, 0.3, 0.3, '#c0392b', { collide: false, o: { glow: true } });   // uyarı ışığı
    // merdiven: A kolu (batı yüzü, güneyden kuzeye), sahanlık, B kolu (kuzey yüzü, batıdan doğuya)
    const n = 16, rise = 0.25, run = 0.27;
    const ax = -S - 1.4 + 0.6;          // A merkez x (-4.0)
    const zbA = -S + n * run;           // güney uç
    b.stairs(ax, zbA, 0, '-z', 1.2, n, rise, run, color);
    b.box(ax, 4.0 - 0.3, -S - 0.6, 1.2, 0.3, 1.2 + 0.0, '#6a5a45');                // sahanlık (z∈[-4.4,-3.2])
    b.stairs(-S - 0.2, -S - 0.6, 4.0, '+x', 1.2, n, rise, run, color, { posts: { to: 0 } });       // B kolu: x başlangıç = sahanlığın doğu kenarı (-3.4)
    // korkuluk ve el tutamağı (görsel)
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      b.box(ax - 0.65, rise * Math.round(t * n), zbA - t * (n * run), 0.07, 1.0, 0.07, '#7a5a38', NC);
    }
    b.box(ax - 0.65, 0.5, (zbA - n * run / 2), 0.07, 0.07, n * run, dark, { collide: false, rx: -Math.atan2(4, n * run) });
    b.box(ax, 0, zbA + 0.5, 0.2, 0.2, 0.2, '#ffd98a', { collide: false, o: { glow: true } });
    b.box(ax - 0.65, 0, zbA + 0.5, 0.08, 1.9, 0.08, dark, NC);
  });
  const [ex, ez] = tw(-4.0, 3.2 - 3.2 + 16 * 0.27 - 3.2 + 1.2);
  info.entry = { x: ex, z: ez };
  const [px, pz] = tw(0, 2.6);
  info.targets.push({ name: 'su-kulesi-platform', x: px, y: 8.0, z: pz });
  const [lx, lz] = tw(-4.0, -3.8);
  info.targets.push({ name: 'su-kulesi-sahanlik', x: lx, y: 4.0, z: lz });
  return info;
}

// ───────── Çeşme (meydan) ─────────
export function fountain(b, { x, z, r = 3.2 }) {
  b.with(x, 0, z, 0, () => {
    b.cyl(0, 0, 0, r, r, 0.6, '#a9a9a3', { seg: 14 });
    b.cyl(0, 0.55, 0, r - 0.35, r - 0.35, 0.08, '#6aa8cc', { seg: 14, collide: false, o: { transparent: true, opacity: 0.8 } });
    b.cyl(0, 0.6, 0, 0.6, 0.8, 1.2, '#b9b9b3', { seg: 8 });
    b.cyl(0, 1.8, 0, 1.3, 0.5, 0.25, '#b9b9b3', { seg: 10, collide: false });
    b.cyl(0, 2.05, 0, 0.14, 0.14, 0.8, '#b9b9b3', { seg: 6, collide: false });
    b.cyl(0, 2.8, 0, 0.55, 0.14, 0.18, '#8ac0e0', { seg: 8, collide: false, o: { transparent: true, opacity: 0.75 } });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; b.box(Math.cos(a) * (r + 0.05), 0.6, Math.sin(a) * (r + 0.05), 0.3, 0.14, 0.3, '#8a867c', NC); }
  });
}

// ───────── Büfe / kiosk (içi küçük, penceresi sokağa) ─────────
export function kiosk(b, rng, { x, z, ry = 0, color = '#3b7a9a', roof = '#c0392b', w = 3.6, d = 3.0 }) {
  b.with(x, 0, z, ry, () => {
    const T = 0.2, H = 2.7, x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
    b.box(0, 0, 0, w + 0.2, 0.15, d + 0.2, '#8a867c', NC);
    // ön yüz (+z): geniş tezgâh penceresi; arka yüz: kapı (geçit 1.4)
    b.shell(x0, x1, z0, z1, 0, H, T, color, {
      s: [{ at: 0, w: 2.2, b: 1.0, top: 2.1, glass: true, glow: rng() < 0.5 }],
      n: [{ at: x1 - 1.0, w: 1.4, b: 0, top: 2.2 }],
      w: [{ at: 0, w: 1.0, b: 1.1, top: 2.0, glass: true }], e: [],
    });
    b.box(0, 1.0, z1 + 0.35, 2.8, 0.08, 0.5, '#d8d4c8', NC);        // tezgâh
    b.box(0, H, 0, w + 0.9, 0.2, d + 0.9, roof);
    b.box(0, H + 0.2, z1 + 0.2, w + 0.9, 0.35, 0.1, '#e8e8e4', NC);
    b.box(0, 1.9, z1 + 0.6, 2.8, 0.4, 0.04, '#c0392b', NC);        // tente şeridi
    b.box(0, 0.15, -0.2, 1.8, 0.9, 0.7, '#8a5a38');                // içeride tezgâh/dolap
    b.box(-1.0, 2.3, 0, 0.4, 0.2, 0.4, '#ffd98a', { collide: false, o: { glow: true } });
  });
}

// ───────── Pazar tezgâhı (tentel) ─────────
export function stall(b, rng, { x, z, ry = 0, color = '#c0392b', w = 3.0, d = 1.6 }) {
  b.with(x, 0, z, ry, () => {
    b.box(0, 0, 0, w, 1.0, 0.8, '#8a5a38');
    b.box(0, 1.0, 0, w + 0.1, 0.08, 0.9, '#d8d4c8', NC);
    for (const sx of [-1, 1]) { b.box(sx * (w / 2 - 0.1), 0, -0.5, 0.1, 2.5, 0.1, '#5e3c1d', NC); b.box(sx * (w / 2 - 0.1), 0, 0.5, 0.1, 2.2, 0.1, '#5e3c1d', NC); }
    // şeritli tente (eğimli)
    const n = 6;
    for (let i = 0; i < n; i++) b.box(-w / 2 + (i + 0.5) * (w / n), 2.45, 0, w / n, 0.06, 1.5, i % 2 ? '#e8e8e4' : color, { collide: false, rx: 0.12 });
    for (let i = 0; i < 5; i++) b.box(-w / 2 + 0.4 + i * 0.55, 1.08, 0.1, 0.35, 0.22, 0.35, ['#d9a921', '#c0392b', '#4a7a4f', '#e8e8e4', '#a05a2a'][i % 5], NC);
    b.box(0, 2.3, 0.2, 0.3, 0.2, 0.3, '#ffd98a', { collide: false, o: { glow: true } });
  });
}

// ───────── Otobüs durağı ─────────
export function busStop(b, { x, z, ry = 0 }) {
  b.with(x, 0, z, ry, () => {
    b.box(0, 0, -0.6, 3.2, 2.4, 0.08, '#b8d4e0', { collide: false, o: { transparent: true, opacity: 0.4 } });
    b.collide(0, 0, -0.6, 3.2, 2.4, 0.12);
    for (const sx of [-1.6, 1.6]) b.box(sx, 0, -0.6, 0.1, 2.5, 0.1, '#4a4d52', NC);
    b.box(0, 2.45, -0.2, 3.6, 0.12, 1.4, '#3b6a9a', NC);
    b.box(0, 0.45, -0.3, 2.2, 0.08, 0.45, '#8b5a2b', NC);
    b.collide(0, 0, -0.3, 2.2, 0.55, 0.5);
    b.box(1.6, 0.0, 0.5, 0.08, 2.6, 0.08, '#4a4d52', NC); b.box(1.6, 2.1, 0.5, 0.05, 0.5, 0.5, '#e8e8e4', NC);
    b.box(0, 2.3, -0.2, 0.6, 0.1, 0.3, '#ffd98a', { collide: false, o: { glow: true } });
  });
}

// ───────── Reklam panosu (alt direkler çarpışır, üst panel açık) ─────────
export function billboard(b, { x, z, ry = 0, color = '#3b6a9a', text = '#e8e8e4' }) {
  b.with(x, 0, z, ry, () => {
    for (const sx of [-2.2, 2.2]) b.box(sx, 0, 0, 0.3, 5.2, 0.3, '#4a4d52');
    b.box(0, 3.6, 0, 6.4, 3.0, 0.3, '#3a3d42', NC);
    b.box(0, 3.9, 0.17, 6.0, 2.4, 0.06, color, NC);
    b.box(0, 4.6, 0.22, 3.4, 0.5, 0.04, text, NC); b.box(-0.8, 3.9, 0.22, 2.0, 0.3, 0.04, '#e8c26a', NC);
    for (const sx of [-2.4, 0, 2.4]) { b.box(sx, 5.8, 0.4, 0.3, 0.12, 0.5, '#ffe9a8', { collide: false, o: { glow: true } }); }
  });
}

// ───────── Çardak / gazebo ─────────
export function gazebo(b, { x, z, color = '#e8e4d8', roof = '#6a4a3a' }) {
  b.with(x, 0, z, 0, () => {
    b.cyl(0, 0, 0, 2.8, 2.8, 0.25, '#a9a9a3', { seg: 8, collide: false });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.26; b.box(Math.cos(a) * 2.4, 0.25, Math.sin(a) * 2.4, 0.2, 2.6, 0.2, color); }
    b.cyl(0, 2.85, 0, 0.1, 3.1, 0.9, roof, { seg: 6, collide: false });
    b.cyl(0, 2.7, 0, 3.0, 3.0, 0.15, color, { seg: 6, collide: false });
    b.box(0, 0.25, 0, 1.4, 0.5, 1.4, '#8b5a2b');
    b.box(0, 2.45, 0, 0.3, 0.3, 0.3, '#ffd98a', { collide: false, o: { glow: true } });
  });
}

// ───────── Ekin sıraları (tarla; çarpışmasız, yürünür) ─────────
export function crops(b, rng, x0, z0, x1, z1, { color = '#6a9a3a', rowGap = 1.2, along = 'x' } = {}) {
  const cols = [color, '#7aa840', '#5f8f35', '#a8b040'];
  b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 0.03, z1 - z0, '#8a6a40', NC);
  if (along === 'x') for (let zz = z0 + 0.6; zz < z1 - 0.3; zz += rowGap) b.box((x0 + x1) / 2, 0.03, zz, x1 - x0 - 0.4, 0.4 + rng() * 0.25, 0.45, cols[Math.floor(rng() * 4)], NC);
  else for (let xx = x0 + 0.6; xx < x1 - 0.3; xx += rowGap) b.box(xx, 0.03, (z0 + z1) / 2, 0.45, 0.4 + rng() * 0.25, z1 - z0 - 0.4, cols[Math.floor(rng() * 4)], NC);
}

// ───────── Tahta barikat / kapı (siper) ─────────
export function palletWall(b, rng, x, z, ry = 0, len = 3.0) {
  b.with(x, 0, z, ry, () => {
    const n = Math.max(1, Math.round(len / 1.2));
    for (let i = 0; i < n; i++) {
      const px = -len / 2 + (i + 0.5) * (len / n);
      b.box(px, 0, 0, len / n - 0.05, 1.0, 0.3, '#a8804f', NC);
      b.box(px, 1.0, 0, len / n - 0.05, 0.9, 0.3, '#98703f', NC);
      b.box(px, 0.25, 0.17, len / n - 0.2, 0.08, 0.04, '#6a4a2a', NC);
    }
    b.collide(0, 0, 0, len, 1.9, 0.35);
  });
}

// ───────── Sokak mobilyası: çöp kutusu, posta kutusu, saksı ─────────
export function trashCan(b, x, z, color = '#3f5f4a') { b.cyl(x, 0, z, 0.3, 0.26, 0.8, color, { seg: 7 }); }
export function planter(b, x, z, w = 1.6, d = 0.8) {
  b.box(x, 0, z, w, 0.6, d, '#9a9a94');
  b.ico(x, 0.75, z, 0.5, '#4f8a3a', { detail: 0, scale: [w * 0.5, 0.8, d * 0.9] });
}
export function mailbox(b, x, z, ry = 0) { b.with(x, 0, z, ry, () => { b.box(0, 0, 0, 0.1, 1.0, 0.1, '#4a4d52', NC); b.box(0, 1.0, 0, 0.4, 0.3, 0.3, '#2c5aa0', NC); }); }
export function streetSign(b, x, z, ry = 0, color = '#2c7a4a') { b.with(x, 0, z, ry, () => { b.box(0, 0, 0, 0.08, 2.6, 0.08, '#4a4d52', NC); b.box(0, 2.1, 0, 1.1, 0.35, 0.05, color, NC); b.box(0, 2.1, 0.03, 0.9, 0.06, 0.02, '#e8e8e4', NC); }); }
