// Paintball: ekrana (gözlüğe) boya. Yalnız yerel oyuncu, yalnız istemci. Tek tam ekran 2B tuval (düşük çözünürlük, HUD'un altında):
//  · gövde / bacak isabeti → atıcının boya renginde leke, ekranın atıcıya bakan kenarında; aşağı akar, ~2,6 sn'de söner (en çok 6 üst üste)
//  · kafa isabeti → ortaya yakın büyük leke (yarı saydam: arkası biraz görünür)
//  · elenme → ekranın çoğu kısa süre boyanır + "BOYANDIN!" yazısı, sonra ölüm ekranı
//  · yakından (≤ ~1 m) geçen top → kenarda küçük damlacıklar
// Boş iken tuval gizli (çizim / birleştirme yükü yok). Leke dokuları renk başına bir kez üretilir (önbellek).
import { PAINT_COLORS } from './paint.js';
import { t as tr } from '../i18n/index.js';
import '../i18n/pb.js';

const MAX = 6, DROP_MAX = 10, RES = () => Math.min(1, Math.max(0.6, (globalThis.devicePixelRatio || 1) * 0.5));      // tuval çözünürlüğü (CSS pikseli başına): telefonda (DPR 2–3) keskin, masaüstünde ucuz
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// beyaz maske: k = 0 yuvarlak taçlı leke, 1 uzamış sıçrama, 2 damlacık kümesi
function mask(k) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d'); x.fillStyle = '#fff';
  const blob = (bx, by, R, n = 16, j = 0.32) => { x.beginPath(); for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, rr = R * (1 - j / 2 + Math.random() * j); x.lineTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr); } x.fill(); };
  const c = S / 2;
  if (k === 2) { for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, d = Math.random() * 90; blob(c + Math.cos(a) * d, c + Math.sin(a) * d, 4 + Math.random() * 11, 10, 0.4); } return cv; }
  if (k === 1) { x.save(); x.translate(c, c); x.scale(1.35, 0.8); blob(0, 0, 58, 20, 0.36); x.restore(); }
  else blob(c, c, 62, 22, 0.34);
  const arms = k ? 7 : 11;
  for (let i = 0; i < arms; i++) {
    const a = Math.random() * Math.PI * 2, L = 62 + Math.random() * 46, w = 6 + Math.random() * 10;
    x.strokeStyle = '#fff'; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(c, c); x.lineTo(c + Math.cos(a) * L * (k ? 1.25 : 1), c + Math.sin(a) * L); x.stroke();
    blob(c + Math.cos(a) * (L + 6) * (k ? 1.25 : 1), c + Math.sin(a) * (L + 6), w * 0.8 + 3, 10);
  }
  for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, d = 84 + Math.random() * 36; blob(c + Math.cos(a) * d, c + Math.sin(a) * d, 2 + Math.random() * 6, 9); }
  return cv;
}

export class ScreenPaint {
  constructor(game, parent) {
    this.g = game;
    const cv = (this.cv = document.createElement('canvas'));
    cv.id = 'spaint';
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none';
    parent.prepend(cv);                                          // HUD öğelerinin ALTINDA (can / cephane / öldürme akışı lekenin üstünde okunur)
    this.x = cv.getContext('2d');
    this.list = []; this.drops = []; this.cover = []; this.tint = new Map(); this.masks = [0, 1, 2].map(mask);
    this.deathT = 0; this.shown = false; this.lastHitT = -9;
    const t = (this.txt = document.createElement('div')); t.id = 'pbdead'; t.textContent = tr('pb.painted');
    parent.appendChild(t);
    this.resize();
  }

  resize() {
    const w = Math.max(320, Math.round(innerWidth * RES())), h = Math.max(180, Math.round(innerHeight * RES()));
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
  }

  sprite(col, k) {
    const key = col * 3 + k; let s = this.tint.get(key);
    if (s) return s;
    const m = this.masks[k], S = m.width; s = document.createElement('canvas'); s.width = s.height = S;
    const x = s.getContext('2d');
    x.drawImage(m, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = PAINT_COLORS[col]; x.fillRect(0, 0, S, S);
    x.globalCompositeOperation = 'source-atop';                  // kalınlık: kenar koyu, orta açık + ıslak parlama
    const gr = x.createRadialGradient(S * 0.45, S * 0.42, 4, S / 2, S / 2, S * 0.5);
    gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.02)'); gr.addColorStop(1, 'rgba(0,0,0,0.38)');
    x.fillStyle = gr; x.fillRect(0, 0, S, S);
    x.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 5; i++) { x.beginPath(); x.ellipse(S * (0.36 + rnd() * 0.22), S * (0.34 + rnd() * 0.2), 3 + rnd() * 9, 2 + rnd() * 4, -0.6, 0, 6.28); x.fill(); }
    this.tint.set(key, s);
    return s;
  }

  _add(arr, cap, o) {
    o.age = 0; o.rot = o.rot ?? rnd() * 6.28; o.k = o.k ?? (rnd() < 0.6 ? 0 : 1);
    const n = o.drip ?? 3; o.dr = [];
    for (let i = 0; i < n; i++) o.dr.push({ dx: (rnd() - 0.5) * 0.9, len: 0.5 + rnd() * 1.1, w: 0.05 + rnd() * 0.05, sp: 0.35 + rnd() * 0.5 });
    arr.push(o); while (arr.length > cap) arr.shift();
    this.show();
  }
  show() { if (!this.shown) { this.shown = true; this.cv.style.display = 'block'; this.resize(); } }

  // Atıcının ekrandaki yönü (Hud.damageFrom ile aynı açı): a = 0 önde, + sağda
  _side(from) {
    const me = this.g.playerSoldier;
    if (!from) return 0;
    const dx = from.x - me.pos.x, dz = from.z - me.pos.z;
    return -(Math.atan2(-dx, -dz) - me.yaw);
  }

  // Yerel oyuncu boya topuyla vuruldu (offline: Paint._hitFx, çevrimiçi: 'pbh' olayı)
  hit(by, zone, col) {
    this.lastHitT = this.g.time; this.lastCol = col;
    const a = this._side(by && by.pos), sa = Math.sin(a), ca = Math.cos(a);
    if (zone === 'head') {
      this._add(this.list, MAX, { x: 0.5 + sa * 0.14 + (rnd() - 0.5) * 0.06, y: 0.44 + (rnd() - 0.5) * 0.08, r: 0.34 + rnd() * 0.06, col, life: 3.0, a: 0.8, k: 0, drip: 4 });
    } else {
      const side = Math.abs(sa), x = 0.5 + sa * 0.44 + (rnd() - 0.5) * 0.08;
      const y = 0.5 + (1 - side) * (ca >= 0 ? 0.3 : 0.36) + (rnd() - 0.5) * 0.16 * side;
      this._add(this.list, MAX, { x, y, r: (ca < -0.3 && side < 0.6 ? 0.13 : 0.19) + rnd() * 0.05, col, life: 2.6, a: 0.94 });
    }
    this.g.sfx.facesplat?.();
  }

  // Elendi: ekranın çoğu boyanır, "BOYANDIN!"
  death(col) {
    this.cover.length = 0;
    for (const [x, y, r] of [[0.32, 0.38, 0.5], [0.7, 0.34, 0.46], [0.5, 0.72, 0.55], [0.18, 0.78, 0.36], [0.86, 0.74, 0.38], [0.52, 0.42, 0.38]]) this._add(this.cover, 8, { x: x + (rnd() - 0.5) * 0.06, y: y + (rnd() - 0.5) * 0.06, r, col, life: 2.4, a: 0.95, drip: 4 });
    this.deathT = 1.25;
    const t = this.txt; t.style.color = '#fff'; t.style.textShadow = `0 5px 0 ${PAINT_COLORS[col]}, 0 8px 14px rgba(0,0,0,.55)`; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');      // beyaz yazı: boyanın üstünde okunur, gölgesi atıcı renginde
  }

  // Yakından geçen top: kenarda damlacık (sx -1 sol / +1 sağ, sy -1 üst / +1 alt)
  nearMiss(sx, sy, col) {
    const x = 0.5 + sx * (0.42 + rnd() * 0.06), y = 0.5 + sy * 0.18 + (rnd() - 0.5) * 0.4;
    this._add(this.drops, DROP_MAX, { x, y, r: 0.07 + rnd() * 0.04, col, life: 1.8, a: 0.9, k: 2, drip: 1 });
  }

  update(dt) {
    if (this.deathT > 0) this.deathT -= dt;
    if (!this.shown) return;
    const c = this.x, W = this.cv.width, H = this.cv.height;
    c.clearRect(0, 0, W, H);
    let any = false;
    for (const arr of [this.drops, this.list, this.cover]) {
      for (let i = arr.length - 1; i >= 0; i--) { const o = arr[i]; o.age += dt; if (o.age >= o.life) arr.splice(i, 1); }
      for (const o of arr) {
        any = true;
        const fade = Math.min(1, (o.life - o.age) / 0.9), pop = Math.min(1, 0.55 + o.age / 0.08 * 0.45), R = o.r * H * pop, cx = o.x * W, cy = o.y * H;
        c.globalAlpha = o.a * fade;
        // akıntılar: lekenin altından aşağı uzar (önce hızlı, sonra yavaşlar)
        c.fillStyle = PAINT_COLORS[o.col];
        for (const d of o.dr) {
          const p = 1 - Math.pow(1 - Math.min(1, o.age * d.sp), 2), L = d.len * R * p, w = Math.max(1.5, d.w * R), x0 = cx + d.dx * R, y0 = cy + R * 0.2;
          if (L < 1) continue;
          c.fillRect(x0 - w / 2, y0, w, L);
          c.beginPath(); c.arc(x0, y0 + L, w * 0.75, 0, 6.28); c.fill();
        }
        c.save(); c.translate(cx, cy); c.rotate(o.rot);
        c.drawImage(this.sprite(o.col, o.k), -R, -R, R * 2, R * 2);
        c.restore();
      }
    }
    c.globalAlpha = 1;
    if (!any) { this.shown = false; this.cv.style.display = 'none'; }
  }

  clear() { this.list.length = this.drops.length = this.cover.length = 0; this.deathT = 0; this.txt.classList.remove('on'); }
}
