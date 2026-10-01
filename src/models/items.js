import * as THREE from 'three';
import { box, taperBox, cylY, ico } from '../core/geo.js';
import { C } from '../core/palette.js';

// Yerden toplanabilir eşyalar (origin = taban merkezi)

function medkit() {
  const g = new THREE.Group();
  box(g, [0.3, 0.18, 0.12], C.white, [0, 0.09, 0]);
  box(g, [0.31, 0.03, 0.125], '#cfcfca', [0, 0.18, 0]);
  box(g, [0.1, 0.03, 0.03], C.black, [0, 0.215, 0]);                  // sap
  box(g, [0.09, 0.025, 0.006], C.red, [0, 0.09, 0.063]);
  box(g, [0.025, 0.09, 0.006], C.red, [0, 0.09, 0.063]);
  box(g, [0.09, 0.025, 0.006], C.red, [0, 0.09, -0.063]);
  box(g, [0.025, 0.09, 0.006], C.red, [0, 0.09, -0.063]);
  box(g, [0.02, 0.19, 0.125], '#8a8a86', [0.1, 0.09, 0]);
  box(g, [0.02, 0.19, 0.125], '#8a8a86', [-0.1, 0.09, 0]);
  return g;
}

function ammoBox() {
  const g = new THREE.Group();
  box(g, [0.32, 0.18, 0.16], C.olive, [0, 0.09, 0]);
  box(g, [0.34, 0.03, 0.18], C.oliveDark, [0, 0.19, 0]);
  box(g, [0.12, 0.03, 0.03], C.black, [0, 0.225, 0]);
  box(g, [0.1, 0.06, 0.005], C.yellow, [0, 0.1, 0.082]);
  box(g, [0.1, 0.06, 0.005], C.yellow, [0, 0.1, -0.082]);
  for (let i = 0; i < 3; i++) box(g, [0.008, 0.18, 0.165], C.oliveDark, [-0.1 + i * 0.1, 0.09, 0]);
  return g;
}

function armorPlate() {
  const g = new THREE.Group();
  taperBox(g, [0.26, 0.32, 0.04], C.gun, [0, 0.17, 0], [-0.25, 0, 0], [0.82, 1], [1, 1], { metalness: 0.35, roughness: 0.5 });
  taperBox(g, [0.22, 0.27, 0.01], C.gunLight, [0, 0.17, -0.025], [-0.25, 0, 0], [0.82, 1], [1, 1], { metalness: 0.35 });
  box(g, [0.14, 0.03, 0.012], C.yellow, [0, 0.21, -0.034], [-0.25, 0, 0]);
  return g;
}

function bandage() {
  const g = new THREE.Group();
  const roll = cylY(g, 0.07, 0.07, 0.1, C.white, [0, 0.05, 0], 10);
  cylY(g, 0.072, 0.072, 0.02, '#c9c9c2', [0, 0.09, 0], 10);
  cylY(g, 0.03, 0.03, 0.102, C.red, [0, 0.05, 0], 8);
  roll.rotation.z = 0;
  box(g, [0.12, 0.012, 0.05], C.white, [0.0, 0.007, 0.1], [0, 0.2, 0]);
  return g;
}

function energyDrink() {
  const g = new THREE.Group();
  cylY(g, 0.04, 0.04, 0.16, '#2cc16b', [0, 0.08, 0], 8);
  cylY(g, 0.04, 0.041, 0.04, C.black, [0, 0.115, 0], 8);
  cylY(g, 0.034, 0.04, 0.015, C.chrome, [0, 0.168, 0], 8, null, { metalness: 0.6 });
  cylY(g, 0.042, 0.042, 0.04, C.yellow, [0, 0.07, 0], 8);
  return g;
}

function repairKit() {
  const g = new THREE.Group();
  box(g, [0.34, 0.14, 0.14], '#b3331f', [0, 0.07, 0]);
  box(g, [0.35, 0.02, 0.15], '#8d2716', [0, 0.14, 0]);
  box(g, [0.14, 0.03, 0.03], C.black, [0, 0.17, 0]);
  box(g, [0.05, 0.025, 0.005], C.yellow, [0.1, 0.09, 0.073]);
  box(g, [0.04, 0.02, 0.2], C.chrome, [0.05, 0.16, 0.0], [0, 0.3, 0], { metalness: 0.6 }); // anahtar
  box(g, [0.07, 0.04, 0.04], C.chrome, [0.15, 0.16, 0.08], [0, 0.3, 0], { metalness: 0.6 });
  return g;
}

export const ITEMS = { medkit, ammoBox, armorPlate, bandage, energyDrink, repairKit };
export const ITEM_LABELS = {
  medkit: 'İlk Yardım Çantası',
  ammoBox: 'Mühimmat Kutusu',
  armorPlate: 'Zırh Plakası',
  bandage: 'Sargı',
  energyDrink: 'Enerji İçeceği',
  repairKit: 'Tamir Kiti',
};
export const createItem = (id) => ITEMS[id]();
