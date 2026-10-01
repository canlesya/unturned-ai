// GEÇİCİ: yapı kiti test sahneleri (teslimden önce silinecek).
import { MapBuilder, makeRng } from './builder.js';
import * as K from './kit.js';

export function buildTest(name = 'houses') {
  const b = new MapBuilder();
  const rng = makeRng(7);
  b.box(0, -1.0, 0, 400, 1.0, 400, '#7f9448', { collide: false });
  const info = {};
  if (name === 'houses') {
    const cfg = [
      { x: -30, z: -10, w: 10, d: 9, floors: 2, door: 's' },
      { x: -14, z: -10, w: 9, d: 8, floors: 1, door: 's' },
      { x: 2, z: -10, w: 8, d: 7, floors: 1, door: 'n' },
      { x: 18, z: -10, w: 10, d: 9, floors: 2, door: 'e', backDoor: true },
      { x: -30, z: 14, w: 12, d: 9, floors: 3, door: 'w', flat: true, roofAccess: true },
      { x: -10, z: 14, w: 14, d: 10, floors: 2, door: 's', theme: 'shop', flat: true, roofAccess: true },
      { x: 12, z: 14, w: 9, d: 8, floors: 1, door: 's', furnishing: false },
      { x: 30, z: 14, w: 6.5, d: 5.5, floors: 1, door: 'n' },
    ];
    info.houses = cfg.map((c, i) => ({ c, r: K.house(b, rng, { wall: ['#d9c79a', '#c9d6c0', '#d8b8a0', '#b9cbd9'][i % 4], roof: '#a8432f', ...c }) }));
  }
  if (name === 'bld') {
    K.barn(b, rng, { x: -30, z: -20, w: 12, d: 18 });
    K.barn(b, rng, { x: -8, z: -20, w: 10, d: 14, ry: Math.PI / 2, doors: 'front', color: '#4f6b4a' });
    K.warehouse(b, rng, { x: 28, z: -20 });
    K.church(b, rng, { x: -28, z: 20 });
    K.gasStation(b, rng, { x: 12, z: 14, store: 'n' });
    K.silo(b, -42, -10); K.watchtower(b, { x: 0, z: 0, ry: 0 });
    K.watchtower(b, { x: 6, z: 0, ry: Math.PI / 2, color: '#6e5232' });
  }
  const group = b.build();
  return { group, colliders: b.colliders, bounds: { minX: -80, maxX: 80, minZ: -80, maxZ: 80 }, info };
}
