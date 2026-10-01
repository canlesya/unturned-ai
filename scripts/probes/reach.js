(() => {
  // her hedefe en yakın botu yol bulma ile gönder: ulaşılabilirlik testi
  const g = window.__game, res = {};
  for (const o of g.mode.objectives) {
    const from = g.map.spawns.blue[0];
    const pb = g.nav.findPath(from.x, from.z, o.x, o.z);
    const pr = g.nav.findPath(g.map.spawns.red[0].x, g.map.spawns.red[0].z, o.x, o.z);
    const len = (p, sx, sz) => { if (!p) return null; let d = 0, x = sx, z = sz; for (const w of p) { d += Math.hypot(w.x - x, w.z - z); x = w.x; z = w.z; } return Math.round(d); };
    res[o.name] = { mavi: len(pb, from.x, from.z), kirmizi: len(pr, g.map.spawns.red[0].x, g.map.spawns.red[0].z) };
  }
  return res;
})()
