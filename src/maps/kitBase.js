// Yapı kiti ortak sabitleri / yardımcıları (kit.js bunları yeniden dışa aktarır).

export const COL = {
  grass: '#7f9448',
  asphalt: '#3f4248',
  asphaltLot: '#56595f',
  curb: '#a3a39b',
  dirt: '#a98d63',
  concrete: '#a9a9a3',
  trim: '#e8e6df',
  plinth: '#8b8a84',
  wood: '#8b5a2b',
  woodDark: '#5e3c1d',
  woodLight: '#b58a57',
  floor: '#9c7a52',
  yellow: '#d9a921',
  white: '#e8e8e4',
};

// ───────── yardımcı ─────────
export function windows(len, center, door, step = 3.2, w = 1.2, b = 1.0, top = 2.1) {
  const n = Math.max(1, Math.floor((len - 1.6) / step));
  const out = [];
  for (let i = 0; i < n; i++) {
    const at = center + (i - (n - 1) / 2) * step;
    if (door && Math.abs(at - door.at) < door.w / 2 + w / 2 + 0.7) continue;
    out.push({ at, w, b, top, glass: true });
  }
  return out;
}

export const DOOR = (at, w = 1.3, top = 2.3) => ({ at, w, b: 0, top });


export function hayBale(b, x, z, y = 0) {
  b.cyl(x, y + 0.6, z, 0.6, 0.6, 1.2, '#d6b85a', { rx: Math.PI / 2, center: true, seg: 8, collide: false });
  b.collide(x, y, z, 1.2, 1.2, 1.2);
}
