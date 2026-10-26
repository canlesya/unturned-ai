import * as THREE from 'three';
import { MapBuilder } from '../../builder.js';

// Yığınlı (chunk) yapı kurucusu (12.172): büyük haritada tek birleşik ağ kamera dışında kırpılamaz (her yapı her karede çizilirdi).
// Dünya 200 m karelere bölünür; her karenin kendi MapBuilder'ı (ayrıntılı ağ) + "uzak" MapBuilder'ı (yalnız büyük parçalar, çarpışmasız) vardır.
// Varlık kodu bunu bilmez: cs.at(x, z) o konumun kurucusunu verir; kutu / silindir / küre ayrıntılıya gider, en büyük boyutu ≥ farMin olan
// parça ayrıca uzak kurucuya kopyalanır (aynı dönüşüm yığını paylaşılır). Kademe: ayrıntılı < near m, uzak < far m, ötesi gizli (sisin içinde).
export class ChunkSet {
  constructor({ size = 200, surface = null, farMin = 2.6 } = {}) {
    this.size = size; this.surface = surface; this.farMin = farMin;
    this.map = new Map(); this.list = [];
    this.ctx = {};                                 // varlıkların bıraktığı veri: loot, doors, lights, chimneys, lamps (kuzey.js okur)
  }
  key(x, z) { return Math.floor(x / this.size) + ',' + Math.floor(z / this.size); }
  at(x, z) {
    const k = this.key(x, z);
    let c = this.map.get(k);
    if (!c) {
      const b = new ChunkBuilder(this.farMin), [ci, cj] = k.split(',').map(Number);
      b.surface = this.surface; b.far.surface = this.surface; b.ctx = this.ctx;
      c = { k, ci, cj, b, x0: ci * this.size, z0: cj * this.size, group: null, near: null, farG: null, lod: -1 };
      this.map.set(k, c); this.list.push(c);
    }
    return c.b;
  }
  get colliders() { return this.list.flatMap((c) => c.b.colliders); }
  get sight() { return this.list.flatMap((c) => c.b.sight); }
  build(root) {
    for (const c of this.list) {
      c.near = c.b.build(); c.farG = MapBuilder.noVisual ? null : c.b.far.build();
      c.group = new THREE.Group(); c.group.name = 'yığın:' + c.k;
      c.group.add(c.near); if (c.farG) { c.farG.visible = false; for (const m of c.farG.children) m.castShadow = false; c.group.add(c.farG); }
      root.add(c.group);
    }
  }
  // kademe: near / far / gizli (kamera yüksekte ise mesafe yataydan biraz kısalır: helikopter bakışı)
  update(cam, D = [380, 1500]) {
    for (const c of this.list) {
      const dx = Math.max(c.x0 - cam.x, 0, cam.x - c.x0 - this.size), dz = Math.max(c.z0 - cam.z, 0, cam.z - c.z0 - this.size), d = Math.hypot(dx, dz);
      const l = d < D[0] ? 0 : d < D[1] ? 1 : 2;
      if (l === c.lod) continue;
      c.lod = l; c.near.visible = l === 0; if (c.farG) c.farG.visible = l === 1;
    }
  }
}

export class ChunkBuilder extends MapBuilder {
  constructor(farMin) {
    super();
    this.farMin = farMin;
    this.far = new MapBuilder();
    this.far.stack = this.stack; this.far.objStack = this.objStack; this.far.kindStack = this.kindStack;    // aynı dönüşüm / kimlik / sınıf yığını
  }
  // sunucu (noVisual): görsel geometri hiç üretilmez, yalnız çarpışma kutusu (kurulum süresi / bellek)
  box(x, y, z, w, h, d, color, opt = {}) {
    if (MapBuilder.noVisual) { if (opt.collide !== false) this._aabb(w, h, d, this._local(x, y + h / 2, z, opt.rx, opt.ry, opt.rz), opt.tag); return; }
    super.box(x, y, z, w, h, d, color, opt);
    if (Math.max(w, h, d) >= this.farMin && !opt.nofar) this.far.box(x, y, z, w, h, d, color, { ...opt, collide: false });
  }
  cyl(x, y, z, rT, rB, h, color, opt = {}) {
    if (MapBuilder.noVisual) { if (opt.collide !== false && !opt.rx && !opt.rz) { const r = Math.max(rT, rB); this._aabb(r * 2, h, r * 2, this._local(x, opt.center ? y : y + h / 2, z), opt.tag); } return; }
    super.cyl(x, y, z, rT, rB, h, color, opt);
    if (Math.max(h, 2 * Math.max(rT, rB)) >= this.farMin && !opt.nofar) this.far.cyl(x, y, z, rT, rB, h, color, { ...opt, collide: false, seg: Math.min(opt.seg || 12, 8) });
  }
  ico(x, y, z, r, color, opt = {}) {
    if (MapBuilder.noVisual) return;
    super.ico(x, y, z, r, color, opt);
    if (2 * r >= this.farMin && !opt.nofar) this.far.ico(x, y, z, r, color, { ...opt, collide: false });
  }
  prism(x, y, z, w, h, d, color, opt = {}) {
    super.prism(x, y, z, w, h, d, color, opt);
    if (Math.max(w, h, d) >= this.farMin && !opt.nofar) this.far.prism(x, y, z, w, h, d, color, { ...opt, collide: false });
  }
}
