// Kasaba stili: yüzey sınıfları (kasabaSurface.js KK) + uyumlu palet. 12.168
import { KK } from '../../kasabaSurface.js';

export const KS = {
  plain: KK.PLAIN, veg: KK.VEG, dirt: KK.DIRT, asph: KK.ASPH, paver: KK.PAVER, wall: KK.PLASTER, brick: KK.BRICK, stone: KK.STONE, roof: KK.ROOF,
  wood: KK.WOOD, board: KK.BOARD, conc: KK.CONC, floor: KK.FLOOR, inner: KK.INWALL, paint: KK.PAINT, corr: KK.CORR, metal: KK.PLAIN, trim: KK.CONC, pilaster: KK.CONC, gable: KK.PLASTER,
};

// sıva tonları (sıcak Akdeniz / Balkan kasabası), pervaz, çatı, panjur
export const PAL = {
  cream: '#e6dcc2', ochre: '#d8b47a', rose: '#d4a48a', sage: '#c4cdb0', sky: '#bccad0', white: '#ece7da', sand: '#d9c79a', grey: '#b9b8b0',
  trim: '#efe9dc', stoneTrim: '#cfc6b0', plinth: '#8f8778', stone: '#a39a82', brick: '#b8805a',
  tile: ['#a8432f', '#9a3d2c', '#b5543a', '#8f3a2a'], slate: '#55606c', zinc: '#7d848c',
  shutter: ['#4e6e58', '#4a6a8a', '#6a4a32', '#8a3a2a', '#5a7a7a'],
  inner: ['#ece4d0', '#e2e6d8', '#e8dccb', '#dde2e8', '#efe2cf'], floorWood: ['#9c7a52', '#a58a62', '#8a6a48'], floorTile: ['#d8dcd8', '#c8d0d4', '#d8d2c2'],
};

// bina stili üret: wall (dış sıva), roof (kiremit / arduvaz), shutter, iç boya, döşeme
export function bstyle(rng, { wall = PAL.cream, roof = PAL.tile[0], shutter = null, trim = PAL.trim, inner = null, floor = null, stoneBase = false, brick = false, awning = null, door = '#5a3d28' } = {}) {
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const S = {
    k: KS, wall, trim, pil: trim, band: trim, casing: trim, sill: PAL.stoneTrim, frame: '#ebe6da',
    plinth: PAL.plinth, stone: PAL.stoneTrim, roof, ridge: null, gable: wall, inner: inner || pick(PAL.inner), floor: floor || pick(PAL.floorWood),
    ceil: '#f0ebe0', stair: '#8a6a48', tread: '#a07d56', rail: '#4a3c30', shutters: !!shutter, shutter, door, awning, roofTop: '#6f7072', coping: '#bdb5a2', metal: '#5a5e64', canopy: '#6b4a3a',
  };
  if (stoneBase) S.wallBands = [[0, 3.0, PAL.stone, KS.stone], [3.0, 99, wall, KS.wall]];
  if (brick) { S.wallBands = [[0, 99, wall, KS.brick]]; }
  return S;
}
