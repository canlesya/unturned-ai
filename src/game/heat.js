// 12.202 Çatışma yoğunluğu (büyük haritada kırmızı bölgeler): son 30 sn'lik atış / ölüm / patlama noktaları, CELL m'lik hücrelerde toplanır.
// Yalnız istemci (çevrimdışı oyun: game.shootRay / onKill / explode; çevrimiçi: sunucunun 'sh' / 'kill' / 'boom' olayları). Sunucuya yük yok.
export const HEAT_SEC = 30;
export class Heat {
  constructor(cell = 8) { this.cell = cell; this.ev = []; this.map = new Map(); this._pr = 0; }
  // w: atış 0,25 · patlama 1,5 · ölüm 3
  add(x, z, w, t) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const cx = Math.round(x / this.cell), cz = Math.round(z / this.cell), k = cx * 100003 + cz;
    let e = this.map.get(k);
    if (e && t - e.last < 2) { e.w = Math.min(e.w + w, 12); e.last = t; return; }      // aynı hücrede 2 sn içinde: aynı kayıt güçlenir
    e = { x: cx * this.cell, z: cz * this.cell, w, t0: t, last: t, k };
    this.ev.push(e); this.map.set(k, e);
    if (this.ev.length > 900) this.prune(t, true);
  }
  prune(t, force = false) {
    if (!force && t - this._pr < 1) return;
    this._pr = t;
    this.ev = this.ev.filter((e) => t - e.last < HEAT_SEC);
    if (this.ev.length > 700) this.ev.splice(0, this.ev.length - 700);
    this.map.clear(); for (const e of this.ev) this.map.set(e.k, e);      // birleştirme yalnız en yeni kayda
  }
  // görüntü için: [x, z, yoğunluk 0..1]
  list(t) {
    this.prune(t);
    const out = [];
    for (const e of this.ev) { const f = 1 - (t - e.last) / HEAT_SEC; if (f > 0) out.push([e.x, e.z, Math.min(1, e.w / 4) * f]); }
    return out;
  }
}
