(() => {
  const g = window.__game, n = g.nav, b = g.map.bounds;
  const sp = g.map.spawns.blue[0];
  const start = n.nearestFree(sp.x, sp.z);
  const W = n.w, Hh = n.h;
  const seen = new Uint8Array(W * Hh);
  const q = [start]; seen[start] = 1;
  while (q.length) {
    const c = q.pop(); const cx = c % W, cz = (c / W) | 0;
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= W || z >= Hh) continue;
      const i = z * W + x; if (seen[i] || n.blocked[i]) continue; seen[i] = 1; q.push(i);
    }
  }
  const rows = [];
  for (let z = b.minZ; z <= b.maxZ; z += 2) {
    let r = '';
    for (let x = b.minX; x <= b.maxX; x += 2) {
      let reach = 0, free = 0, blk = 0;
      for (let dz = 0; dz < 2; dz += 0.5) for (let dx = 0; dx < 2; dx += 0.5) { const i = n.idx(x + dx, z + dz); if (n.blocked[i]) blk++; else { free++; if (seen[i]) reach++; } }
      r += blk > 8 ? '#' : reach >= free * 0.5 && free ? '.' : 'o';
    }
    rows.push(r);
  }
  const objs = g.mode.objectives.map(o => o.name + ':' + (seen[n.nearestFree(o.x, o.z)] ? 'ulaşılır' : 'ADA'));
  return objs.join(' | ') + '\n' + rows.join('\n');
})()
