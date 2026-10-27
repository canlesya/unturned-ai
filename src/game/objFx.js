import * as THREE from 'three';

// 12.191 Ele geçirme bayraklarının dünyadaki görünümü (yalnız istemci; çarpışma / bot görüşü / mermi YOK, oynanışı etkilemez):
//  · bayrak direği + bez: bez gösterilen ilerlemeyle (o.pd) iner / çıkar — sahibinin rengi önce aşağı iner (nötrleştirme), nötrde dipte beyaz, ele geçiren
//    takımın rengiyle yukarı çıkar (Battlefield gibi). Direk boyu tavana göre kısalır; 4,5 m'den alçak tavan altında (tünel, tente, iç mekân) direk yok (yalnız halka + işaret).
//  · zemindeki kesikli halka: ele geçirme yarıçapında, zemini izler (arazi / tabliye / döşeme); alanın dikey sınırı (hedef kotu ±8 m, game.inObjective) dışında kalan
//    parçalar çizilmez → halka alanın gerçek sınırını gösterir. Renk sahibin rengi; alınırken / çekişmeliyken nabız atar.
const C = { blue: new THREE.Color('#3f8fe8'), red: new THREE.Color('#e0533f'), neu: new THREE.Color('#e9ebee'), amb: new THREE.Color('#ffcf5a') };
const POLE_H = 7.5, BIG_POLE_H = 10, CW = 1.9, CH = 1.15;

export class ObjFx {
  constructor(game) {
    this.g = game; this.items = []; this.t = 0;
    const w = game.world, big = !!game.map.big;
    this.group = new THREE.Group(); this.group.name = 'objFx';
    const poleMat = new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.45, metalness: 0.6 });
    const knobMat = new THREE.MeshStandardMaterial({ color: '#d9b45a', roughness: 0.35, metalness: 0.7 });
    const dn = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0), o3 = new THREE.Vector3(), hit = {};
    // zemin: hedef kotunun (ya da arazinin) 1,2 m üstünden aşağı ışın → arazi / tabliye / döşeme (çatıya çıkmaz)
    const ground = (x, z, oy) => { o3.set(x, Math.max(oy, w.heightAt(x, z)) + 1.2, z); const h = w.raycast(o3, dn, 14, hit); return h ? h.point.y : null; };
    for (const o of game.mode.objectives) {
      const oy = game.objY(o), it = { o };
      // direk yeri: merkez; bir katının içine düşüyorsa yakında boş sütun
      let px = o.x, pz = o.z, y0 = ground(o.x, o.z, oy) ?? oy, H = big ? BIG_POLE_H : POLE_H;
      const blocked = (x, z, y) => { const L = w.query(x - 0.2, z - 0.2, x + 0.2, z + 0.2, (this._q ||= [])); return L.some((c) => x + 0.12 > c.min[0] && x - 0.12 < c.max[0] && z + 0.12 > c.min[2] && z - 0.12 < c.max[2] && y + 2.2 > c.min[1] && y + 0.05 < c.max[1]); };
      if (blocked(px, pz, y0)) {
        let ok = false;
        for (let k = 1; k < 40 && !ok; k++) { const a = k * 2.399, r = 0.6 + k * 0.12, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r, y = ground(x, z, oy) ?? oy; if (Math.abs(y - oy) < 3 && !blocked(x, z, y)) { px = x; pz = z; y0 = y; ok = true; } }
        if (!ok) H = 0;
      }
      if (H) { o3.set(px, y0 + 0.3, pz); const h = w.raycast(o3, up, H, hit); if (h) H = Math.max(0, h.t + 0.3 - 0.35); }
      if (H < 4.5) H = 0;                                                             // çatı / tavan altında (tünel, tente, bina içi) direk yok: halka + işaret yeter
      it.top = H ? y0 + H : oy + 4;
      if (H) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, H, 8), poleMat); pole.position.set(px, y0 + H / 2, pz); pole.castShadow = true;
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), knobMat); knob.position.set(px, y0 + H + 0.05, pz);
        const cw = Math.min(CW, H * 0.3), ch = Math.min(CH, H * 0.18);
        const geo = new THREE.PlaneGeometry(cw, ch, 10, 4); geo.translate(cw / 2 + 0.05, 0, 0);
        const mat = new THREE.MeshStandardMaterial({ color: C.neu.clone(), roughness: 0.85, side: THREE.DoubleSide, emissive: C.neu.clone(), emissiveIntensity: 0.12 });
        const cloth = new THREE.Mesh(geo, mat);                                  // gölge yok: bez kameraya döner (gölgesi dönmesin)
        const piv = new THREE.Group(); piv.position.set(px, y0, pz); piv.add(cloth);
        this.group.add(pole, knob, piv);
        Object.assign(it, { cloth, piv, mat, base: geo.attributes.position.array.slice(), lo: 0.9 + ch / 2, hi: H - 0.12 - ch / 2, cw });
      }
      // halka: kesikli şerit (1,6 m dolu / 1 m boş), alt kenarı opak, üst kenarı saydam
      const N = Math.max(48, Math.round(o.r * 2 * Math.PI / 0.65)), pos = [], col = [], idx = [];
      const seg = 2.6, dash = 1.6, rr = o.r - 0.15;
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const a = i / N * Math.PI * 2, x = o.x + Math.cos(a) * rr, z = o.z + Math.sin(a) * rr, y = ground(x, z, oy), s = (a * rr) % seg;
        const okp = y !== null && Math.abs(y - oy) < 7.6 && s < dash;
        if (okp) {
          const vi = pos.length / 3;
          pos.push(x, y + 0.04, z, x, y + 0.38, z); col.push(1, 1, 1, 0.75, 1, 1, 1, 0);
          if (prev !== null) idx.push(prev, prev + 1, vi, prev + 1, vi + 1, vi);
          prev = vi;
        } else prev = null;
      }
      if (idx.length) {
        const g2 = new THREE.BufferGeometry();
        g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g2.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g2.setIndex(idx);
        const rm = new THREE.MeshBasicMaterial({ color: C.neu.clone(), vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.55 });
        const ringM = new THREE.Mesh(g2, rm); ringM.renderOrder = 2; this.group.add(ringM);
        it.ring = ringM; it.rmat = rm;
      }
      this.items.push(it);
    }
    game.scene.add(this.group);
  }

  top(o) { return this.items.find((it) => it.o === o)?.top; }

  frame(dt) {
    this.t += dt;
    const g = this.g, t = this.t;
    for (const it of this.items) {
      const o = it.o, pd = o.pd ?? o.p, a = Math.abs(pd);
      const c = a < 0.02 ? C.neu : pd > 0 ? C.blue : C.red;
      if (it.cloth) {
        const y = it.lo + (it.hi - it.lo) * a;
        it.cloth.position.y = y;
        const cp = g.camera.position; it.piv.rotation.y = Math.atan2(cp.x - it.piv.position.x, cp.z - it.piv.position.z) + 0.45;   // bez kameraya yarı dönük (yandan bakınca ince çizgi olmasın)
        it.mat.color.copy(c); it.mat.emissive.copy(c);
        const p = it.cloth.geometry.attributes.position, b = it.base;                 // dalgalanma: direkten uzaklaştıkça artan sinüs
        for (let i = 0; i < p.count; i++) { const x = b[i * 3], k = x / it.cw; p.array[i * 3 + 2] = Math.sin(x * 3.1 - t * 5.2 + b[i * 3 + 1] * 1.3) * 0.13 * k; p.array[i * 3 + 1] = b[i * 3 + 1] - k * k * 0.06; }
        p.needsUpdate = true;
      }
      if (it.ring) {
        const st = g.hud?.cap?.flagState(o), pulse = st && (st.cap || st.ctd);
        it.rmat.color.copy(st?.ctd ? C.amb : o.owner ? C[o.owner] : st?.cap ? (st.rate > 0 ? C.blue : C.red) : C.neu);
        it.rmat.opacity = pulse ? 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 7)) : 0.5;
      }
    }
  }

  dispose() {
    this.g.scene.remove(this.group);
    this.group.traverse((m) => { m.geometry?.dispose(); m.material?.dispose?.(); });
  }
}
