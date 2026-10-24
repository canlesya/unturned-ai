import * as THREE from 'three';

// Cephe modu uzak ortam (yalnız istemci, harita dışında): yükselen duman sütunları + ufukta top ateşi parıltısı + boğuk uzak gümbürtü.
// Performans: 7 duman + 3 parıltı sprite'ı (tek doku, sis açık; telefonda yarısı), sahneye 10 çizim çağrısından az ekler; çarpışma / bot görüşü yok.
let TEX = null;
function smokeTex() {
  if (TEX) return TEX;
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  for (let i = 0; i < 14; i++) {                                                   // yumuşak, düzensiz bulut topakları
    const x = S * (0.3 + Math.random() * 0.4), y = S * (0.25 + Math.random() * 0.5), r = S * (0.18 + Math.random() * 0.16);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.34)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
  }
  TEX = new THREE.CanvasTexture(cv); TEX.colorSpace = THREE.SRGBColorSpace;
  return TEX;
}

export class FrontFx {
  constructor(game) {
    this.g = game; this.t = 0; this.items = []; this.flashes = []; this.nextBoom = 4;
    const B = game.map.bounds, mob = !!game.touch || innerWidth < 900, tex = smokeTex();
    const spots = [[-150, -230], [-60, -260], [70, -250], [160, -190], [-170, 40], [180, 80], [-120, 240], [110, 260]].slice(0, mob ? 4 : 7);
    for (const [x, z] of spots) {
      const col = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const m = new THREE.SpriteMaterial({ map: tex, color: k ? '#6f6c66' : '#4d4a46', transparent: true, depthWrite: false, opacity: 0.5 - k * 0.07, fog: true });
        const sp = new THREE.Sprite(m); sp.scale.setScalar(14 + k * 9); sp.position.set(k * 3, 6 + k * 11, -k * 1.5);
        sp.userData.k = k; col.add(sp);
      }
      col.position.set(x, 0, z); col.userData.ph = Math.random() * 6;
      game.scene.add(col); this.items.push(col);
    }
    const fm = new THREE.SpriteMaterial({ map: tex, color: '#ffb35a', transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending, fog: false });
    for (const [x, z] of [[-110, -280], [40, -300], [150, -270]]) { const sp = new THREE.Sprite(fm.clone()); sp.scale.set(60, 26, 1); sp.position.set(x, 8, z); game.scene.add(sp); this.flashes.push({ sp, t: 0 }); }
    void B;
  }

  update(dt) {
    this.t += dt;
    for (const c of this.items) for (const sp of c.children) {                   // yavaş yükselip genişleyen, rüzgârla kayan duman
      const k = sp.userData.k, ph = c.userData.ph;
      sp.position.y = 6 + k * 11 + Math.sin(this.t * 0.07 + ph + k) * 1.5;
      sp.position.x = k * (3 + Math.sin(this.t * 0.05 + ph) * 1.2);
      sp.material.rotation = this.t * 0.02 * (k % 2 ? 1 : -1) + ph;
    }
    for (const f of this.flashes) { f.t = Math.max(0, f.t - dt * 1.8); f.sp.material.opacity = f.t * f.t * 0.85; }
    if ((this.nextBoom -= dt) <= 0) {                                               // ufukta top ateşi: parıltı + 0,4–0,9 sn sonra uzak gümbürtü
      this.nextBoom = 3 + Math.random() * 7;
      const f = this.flashes[Math.floor(Math.random() * this.flashes.length)];
      f.t = 0.7 + Math.random() * 0.3;
      const sfx = this.g.sfx;
      if (sfx?.ctx && sfx.distantBoom) setTimeout(() => sfx.distantBoom(), 400 + Math.random() * 500);
    }
  }

  dispose() { for (const c of this.items) this.g.scene.remove(c); for (const f of this.flashes) this.g.scene.remove(f.sp); }
}
