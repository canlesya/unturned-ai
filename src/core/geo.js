import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Unturned tarzı: düz renk, flat-shaded, düşük poligon. Tüm modeller bu yardımcılarla kurulur.
// Konvansiyon: ileri = -Z, yukarı = +Y, sağ = +X.

const cache = new Map();

export function mat(color, o = {}) {
  const key = color + '|' + JSON.stringify(o);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.82,
      metalness: 0.0,
      ...o,
    });
    cache.set(key, m);
  }
  return m;
}

function add(parent, geo, color, pos, rot, o) {
  pos = pos || [0, 0, 0];
  rot = rot || [0, 0, 0];
  const m = new THREE.Mesh(geo, mat(color, o));
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export const box = (p, size, color, pos, rot, o) =>
  add(p, new THREE.BoxGeometry(size[0], size[1], size[2]), color, pos, rot, o);

// Üst/alt yüzü ölçekli kutu (koni benzeri kol, bacak, dipçik için). top/bottom = [xÖlçek, zÖlçek]
export function taperBox(p, size, color, pos, rot, top = [1, 1], bottom = [1, 1], o) {
  const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const a = g.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const s = a.getY(i) > 0 ? top : bottom;
    a.setX(i, a.getX(i) * s[0]);
    a.setZ(i, a.getZ(i) * s[1]);
  }
  g.computeVertexNormals();
  return add(p, g, color, pos, rot, o);
}

// Z ekseninde silindir/koni. rFront = -Z (namlu) ucu, rRear = +Z ucu.
export function cyl(p, rFront, rRear, len, color, pos, seg = 8, o) {
  const g = new THREE.CylinderGeometry(rRear, rFront, len, seg);
  g.rotateX(Math.PI / 2);
  return add(p, g, color, pos, [0, 0, 0], o);
}

// Y ekseninde silindir/koni.
export function cylY(p, rTop, rBot, h, color, pos, seg = 8, rot, o) {
  return add(p, new THREE.CylinderGeometry(rTop, rBot, h, seg), color, pos, rot, o);
}

export function ico(p, r, color, pos, detail = 0, scale = [1, 1, 1], o) {
  const m = add(p, new THREE.IcosahedronGeometry(r, detail), color, pos, [0, 0, 0], o);
  m.scale.set(scale[0], scale[1], scale[2]);
  return m;
}

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Bir grubun doğrudan Mesh çocuklarını materyal başına tek mesh'te birleştirir (çizim çağrısı azaltır).
// Alt gruplar kendi dönüşümlerini korur ve ayrı ayrı birleştirilir (kemik/uzuv hiyerarşisi bozulmaz).
export function mergeStatic(group) {
  const buckets = new Map();
  const rm = [];
  for (const ch of group.children) {
    if (!ch.isMesh || Array.isArray(ch.material)) continue;
    ch.updateMatrix();
    const g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
    g.applyMatrix4(ch.matrix);
    g.deleteAttribute('uv');
    let b = buckets.get(ch.material);
    if (!b) buckets.set(ch.material, (b = { geos: [] }));
    b.geos.push(g);
    rm.push(ch);
  }
  for (const m of rm) { group.remove(m); m.geometry.dispose(); }
  for (const [material, b] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(b.geos, false), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const ch of [...group.children]) if (ch.isGroup) mergeStatic(ch);
  return group;
}
