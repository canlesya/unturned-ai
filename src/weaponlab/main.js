import * as THREE from 'three';
import { setupEnvironment, todEnv, todGrade } from '../maps/environment.js';
import { TEAMS } from '../core/palette.js';
import { createCharacter } from '../models/character.js';
import { createWeapon } from '../models/weapons.js';
import { ViewModel } from '../game/player.js';
import { WSTATS } from '../game/stats.js';
import { S1, S2 } from './s12.js';
import { S3 } from './s3.js';
import { skinMaterial, setSkin, SKINS, SKIN_IDS } from './skins.js';

// Silah laboratuvarı (yalnız taslak, oyun kodu değişmez): S1 Sade / S2 Orta / S3 BattleBit × AK-47, M4A1, Glock 17, M24; kaplamalar uniform değişimiyle.
//   ?view=fp|row|third|perf  &style=s1|s2|s3|cur  &w=ak47|m4a1|pistol|sniper  &skin=std|desert|wood|urban|gold  &ads=1  &tod=day
//   row:   &ws=s3:ak47,s3:m4a1 (satırlar) &skins=std,desert,wood,urban,gold (sütunlar)   third: &ws=s3:ak47,s2:ak47,cur:ak47 (askerler yan yana)
//   perf:  &style=s3|cur (20 asker LOD silahla)   hud=0 etiketleri gizler
const Q = new URLSearchParams(location.search);
const P = { view: Q.get('view') || 'fp', style: Q.get('style') || 's3', w: Q.get('w') || 'ak47', skin: Q.get('skin') || 'std', ads: +(Q.get('ads') || 0), tod: Q.get('tod') || 'day',
  ws: (Q.get('ws') || 's3:ak47,s3:m4a1,s3:pistol,s3:sniper').split(','), skins: (Q.get('skins') || SKIN_IDS.join(',')).split(','), yaw: +(Q.get('yaw') ?? 0.42), hud: Q.get('hud') !== '0', n: +(Q.get('n') || 20) };
const STYLES = { s1: S1, s2: S2, s3: S3 };
const NAMES = { s1: 'S1 Sade', s2: 'S2 Orta', s3: 'S3 BattleBit', cur: 'Mevcut oyun' };
const ENV = { sky: ['#5f9fdc', '#c3dcef', '#f6e9cf'], fog: ['#e6d9b8', 140, 360], sun: ['#ffe3b0', 2.7], hemi: ['#d6e6ff', '#9b8458', 1.15], cloud: '#fff6e8', clouds: 14 };   // Çöl Geçidi

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMappingExposure = todGrade(P.tod).exposure;
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight); renderer.autoClear = false; renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ── dünya: Çöl Geçidi ışığı + kum zemin + birkaç sıva duvar / sandık
const world = new THREE.Scene(), worldCam = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.05, 700);
setupEnvironment(world, renderer, { tod: P.tod, env: ENV, sunPos: [50, 80, 25] });
const E = todEnv(ENV, [50, 80, 25], P.tod).E;
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#c9b17c', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
  const wallM = new THREE.MeshStandardMaterial({ color: '#d9c9a3', roughness: 0.95 }), crate = new THREE.MeshStandardMaterial({ color: '#8a6a40', roughness: 0.9 });
  for (const [x, z, w, h, d, m] of [[-6, -14, 10, 4, 1, wallM], [8, -18, 6, 5, 6, wallM], [-14, -6, 1, 3.5, 12, wallM], [3, -9, 1.2, 1.2, 1.2, crate], [5, -8.5, 1.2, 1.2, 1.2, crate], [4.2, -8.8, 1, 1, 1, crate]]) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, h / 2 + (m === crate && w === 1 ? 1.2 : 0), z); o.castShadow = o.receiveShadow = true; world.add(o); }
  worldCam.position.set(0, 1.6, 0); worldCam.lookAt(0, 1.55, -10);
}

// Taslak silahı kur (style, w, skin, lod) → { g, mat }
function draft(style, w, skin = 'std', lod = false) {
  if (style === 'cur') { const g = createWeapon(w, w === 'm4a1' ? 'holo' : w === 'pistol' ? 'iron' : 'reddot', lod); return { g, mat: null }; }
  const mat = skinMaterial(w, skin), fn = STYLES[style][w];
  const g = style === 's3' ? fn(mat, lod) : fn(mat);
  return { g, mat };
}
const stat = (g) => { let tris = 0, calls = 0; g.traverse((o) => { if (o.isMesh && o.visible) { calls++; const gg = o.geometry; tris += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } }); return { tris: Math.round(tris), calls }; };

// ── birinci şahıs: oyunun gerçek ViewModel'i (ilk kutu eller); taslakta silah modeli değiştirilir, eller yeni kabza noktalarına taşınır
let vm = null, fpW = null;
const fakeGame = { scene: { environment: world.environment }, leftHand: false, time: 0 };
function setFP() {
  vm = vm || new ViewModel(fakeGame);
  vm.scene.environment = world.environment; vm.scene.environmentIntensity = 0.7;
  for (const o of vm.scene.children) { if (o.isHemisphereLight) { o.color.set(E.hemi[0]); o.groundColor.set(E.hemi[1]); o.intensity = E.hemi[2] * 1.3; } else if (o.isDirectionalLight) { o.color.set(E.sun[0]); o.intensity = E.sun[1] * 0.95; } }
  const st = WSTATS[P.w];
  vm.setItem(P.w, 'blue', st.kind, P.w === 'm4a1' ? 'holo' : P.w === 'pistol' ? 'iron' : 'reddot', '#86a273');
  fpW = vm.model.children[0];
  if (P.style !== 'cur') {
    const g = vm.model, old = g.children[0]; g.remove(old); old.traverse((o) => o.geometry?.dispose());
    const d = draft(P.style, P.w, P.skin); fpW = d.g; fpW.userData.mat = d.mat; g.add(fpW);
    const u = fpW.userData;
    Object.assign(g.userData, { ...u, noAds: false });
    vm.handR.position.copy(u.gripR).add(new THREE.Vector3(0, -0.02, 0));
    vm.hLfg = u.gripL ? u.gripL.clone().add(new THREE.Vector3(0, -0.03, 0)) : null;
    if (vm.handL) { vm.handL.visible = !!vm.hLfg; if (vm.hLfg) vm.handL.position.copy(vm.hLfg); }
    vm.flash = null;
  }
  vm.raise = 0; vm.kick = 0; vm.kickR = 0;
}
function updFP() {
  const s = { stat: WSTATS[P.w], vel: { x: 0, z: 0 }, onGround: true, sprinting: false, adsT: P.ads, ads: P.ads > 0.5, reloadT: 0, reloadTotal: 0, reloadStyle: 'mag', reloadEmpty: true, swing: null, useT: 0, cd: 0, overlay: 'none', leanT: 0 };
  vm.breathT = 0; for (let i = 0; i < 4; i++) vm.update(1 / 120, { s, lookDX: 0, lookDY: 0, touch: false });
}

// ── vitrin (loadout): koyu zemin + ızgara, ana / dolgu / kontur ışığı, silahlar satır × sütun
const show = new THREE.Scene(), showCam = new THREE.PerspectiveCamera(22, innerWidth / innerHeight, 0.1, 100);
show.environment = world.environment; show.environmentIntensity = 0.55; show.background = new THREE.Color('#14161b');
{ const gr = new THREE.GridHelper(40, 160, '#262a31', '#1d2026'); gr.rotation.x = Math.PI / 2; gr.position.z = -1.5; show.add(gr); }   // BattleBit vitrin ızgarası
show.add(new THREE.HemisphereLight('#c8d4e8', '#303238', 1.3));
{ const key = new THREE.DirectionalLight('#ffffff', 3.0); key.position.set(3, 4, 5); show.add(key); const rim = new THREE.DirectionalLight('#9fb8ff', 1.4); rim.position.set(-4, 2, -3); show.add(rim); const fill = new THREE.DirectionalLight('#ffe8cc', 0.6); fill.position.set(2, -1, 3); show.add(fill); }
const labels = document.getElementById('labels');
function addLabel(txt, x, y, cls = '') { const d = document.createElement('div'); d.className = 'lbl ' + cls; d.textContent = txt; d.style.left = x + 'px'; d.style.top = y + 'px'; labels.appendChild(d); }
let rowItems = [];
function setRow() {
  for (const it of rowItems) { show.remove(it.g); it.g.traverse((o) => o.geometry?.dispose()); } rowItems = []; labels.innerHTML = '';
  const rows = P.ws, cols = P.skins, cw = 1.25, rh = 0.62;
  rows.forEach((spec, r) => {
    const [style, w] = spec.split(':');
    cols.forEach((sk, c) => {
      const { g } = draft(style, w, sk); const box = new THREE.Box3().setFromObject(g), ctr = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      const k = w === 'pistol' ? 2.3 : Math.min(1, 1.05 / size.z);                       // tabanca büyütülür (vitrin), uzun tüfek sığdırılır
      const piv = new THREE.Group(); piv.add(g); g.position.copy(ctr).multiplyScalar(-1); piv.scale.setScalar(k);
      piv.rotation.set(0.05, -Math.PI / 2 + P.yaw, 0);                                     // sağ yandan, hafif 3/4
      piv.position.set((c - (cols.length - 1) / 2) * cw, -(r - (rows.length - 1) / 2) * rh, 0);
      show.add(piv); rowItems.push({ g: piv, style, w, sk, r, c });
    });
  });
  const W = cols.length * cw, H = rows.length * rh + (rows.length === 1 ? 0.05 : 0.25);
  showCam.aspect = innerWidth / innerHeight;
  const dist = Math.max(H / 2 / Math.tan((showCam.fov * Math.PI) / 360), W / 2 / Math.tan((showCam.fov * Math.PI) / 360) / showCam.aspect) * 1.02;
  showCam.position.set(0, 0.03, dist); showCam.lookAt(0, 0.03, 0); showCam.updateProjectionMatrix(); showCam.updateMatrixWorld();
  if (P.hud) {
    const pr = (x, y) => { const v = new THREE.Vector3(x, y, 0).project(showCam); return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; };
    cols.forEach((sk, c) => { const [x, y] = pr((c - (cols.length - 1) / 2) * cw, (rows.length - 1) / 2 * rh + rh * 0.5); addLabel(SKINS[sk].name, x, y, 'top'); });
    rows.forEach((spec, r) => { const [style, w] = spec.split(':'), it = rowItems.find((i) => i.r === r && i.c === 0); const st = stat(it.g); const [x, y] = pr(-(cols.length - 1) / 2 * cw - cw * 0.47, -(r - (rows.length - 1) / 2) * rh - rh * 0.36); addLabel(`${NAMES[style]} · ${WSTATS[w].name} · ${st.tris} üçgen · ${st.calls} çağrı`, x, y, 'left'); });
  }
}

// ── üçüncü şahıs: askerler yan yana (her biri bir taslağın LOD sürümünü tutar)
let soldiers = [];
const thirdCam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 80);
function soldier(style, w, skin, team = 'blue') {
  const api = createCharacter({ team, weapon: w, optic: w === 'm4a1' ? 'holo' : 'reddot' });
  if (style !== 'cur') { const { g } = draft(style, w, skin, style === 's3'); api.parts.mount.remove(api.weapon); api.weapon.traverse((o) => o.geometry?.dispose()); api.weapon = g; api.parts.mount.add(g); api.refreshHold({}); }
  api.root.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return api;
}
function setThird() {
  for (const s of soldiers) world.remove(s.root); soldiers = []; labels.innerHTML = '';
  const n = P.ws.length, gap = 1.1;
  P.ws.forEach((spec, i) => { const [style, w] = spec.split(':'); const api = soldier(style, w, P.skin); api.root.position.set((i - (n - 1) / 2) * gap, api.root.position.y, -4); api.root.rotation.y = -1.95; world.add(api.root); soldiers.push(api); api.spec = spec; });
  thirdCam.aspect = innerWidth / innerHeight; const span = n * gap;
  thirdCam.position.set(0.4, 1.45, -4 + Math.max(2.6, span * 1.05)); thirdCam.lookAt(0, 1.1, -4); thirdCam.updateProjectionMatrix(); thirdCam.updateMatrixWorld();
  if (P.hud) for (const s of soldiers) { const [style, w] = s.spec.split(':'), v = new THREE.Vector3(s.root.position.x, 0.15, -4).project(thirdCam); const st = stat(s.weapon); addLabel(`${NAMES[style]} ${WSTATS[w].name} · ${st.tris} üç`, (v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight, 'top dark'); }
}
// ── başarım sahnesi: N asker (4 sıra), LOD silahlı; GPU süresi = çizim + readPixels eşitlemesi ortalaması
function setPerf() {
  for (const s of soldiers) world.remove(s.root); soldiers = [];
  const ids = ['ak47', 'm4a1', 'sniper', 'pistol'];
  for (let i = 0; i < P.n; i++) { const w = ids[i % 4], api = soldier(P.style, w, SKIN_IDS[i % 5], i % 2 ? 'red' : 'blue'); api.root.position.set(((i % 5) - 2) * 1.6, api.root.position.y, -4 - Math.floor(i / 5) * 2.2); api.root.rotation.y = 0.3 + (i % 3) * 0.8; world.add(api.root); soldiers.push(api); }
  worldCam.position.set(0, 1.7, 1.5); worldCam.lookAt(0, 1.1, -8);
}
async function perf(n = 80) {
  const gl = renderer.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const one = () => frame();
  renderer.info.autoReset = false; renderer.info.reset(); one(); const calls = renderer.info.render.calls, tris = renderer.info.render.triangles; renderer.info.autoReset = true;
  for (let i = 0; i < 8; i++) one(); sync();
  const t0 = performance.now(); for (let i = 0; i < n; i++) { one(); sync(); } const ms = (performance.now() - t0) / n;
  let wt = 0, wc = 0; for (const s of soldiers) { const st = stat(s.weapon); wt += st.tris; wc += st.calls; }
  return { calls, tris, ms: +ms.toFixed(3), weaponTris: wt, weaponCalls: wc, soldiers: soldiers.length, px: [renderer.domElement.width, renderer.domElement.height] };
}
// yalnız silah sahnesi (birinci şahıs) GPU süresi
async function perfFP(n = 120) {
  const gl = renderer.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const one = () => { renderer.clear(); vm.render(renderer, innerWidth, innerHeight); };
  renderer.info.autoReset = false; renderer.info.reset(); one(); const calls = renderer.info.render.calls, tris = renderer.info.render.triangles; renderer.info.autoReset = true;
  for (let i = 0; i < 8; i++) one(); sync();
  const t0 = performance.now(); for (let i = 0; i < n; i++) { one(); sync(); } const ms = (performance.now() - t0) / n;
  return { calls, tris, ms: +ms.toFixed(3), weapon: stat(fpW), parts: fpW.userData.stats?.parts ?? null };
}

function frame() {
  const W = innerWidth, H = innerHeight;
  renderer.setViewport(0, 0, W, H); renderer.setClearColor('#000'); renderer.clear();
  if (P.view === 'row') { renderer.render(show, showCam); return; }
  if (P.view === 'third') { thirdCam.aspect = W / H; thirdCam.updateProjectionMatrix(); renderer.render(world, thirdCam); return; }
  worldCam.aspect = W / H; worldCam.updateProjectionMatrix(); renderer.render(world, worldCam);
  if (P.view === 'fp') { updFP(); vm.render(renderer, W, H); }
}
function setup() { if (P.view === 'fp') setFP(); else if (P.view === 'row') setRow(); else if (P.view === 'third') setThird(); else if (P.view === 'perf') setPerf(); }
const hud = document.getElementById('hud');
function label() { hud.style.display = P.hud && P.view === 'fp' ? 'block' : 'none'; if (P.view === 'fp' && fpW) { const st = stat(fpW); hud.textContent = `${NAMES[P.style]} · ${WSTATS[P.w].name} · ${SKINS[P.skin]?.name || ''} · ${st.tris} üçgen · ${st.calls} çizim çağrısı${fpW.userData.stats ? ' · ' + fpW.userData.stats.parts + ' parça' : ''}${P.ads ? ' · nişan' : ''}`; } }
setup(); frame(); label();
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); setup(); frame(); label(); });
window.__wlab = {
  P, perf, perfFP, stat, SKIN_IDS,
  set(o) { const re = ['view', 'style', 'w', 'ws', 'skins', 'yaw', 'n', 'hud'].some((k) => k in o && o[k] !== P[k]); const skinOnly = 'skin' in o && o.skin !== P.skin; Object.assign(P, o); if (re) setup(); else if (skinOnly && P.view === 'fp') { if (fpW?.userData.mat) setSkin(fpW.userData.mat, P.skin); } frame(); label(); return true; },
  // kaplama değişimi maliyeti: aynı malzemede yalnız uniform (program sayısı değişmemeli)
  skinSwap() { if (!fpW?.userData.mat) return null; const before = renderer.info.programs.length, t0 = performance.now(); for (const s of SKIN_IDS) { setSkin(fpW.userData.mat, s); frame(); } return { programsBefore: before, programsAfter: renderer.info.programs.length, ms: +(performance.now() - t0).toFixed(2) }; },
  // tüm taslakların sayıları (FP + LOD)
  counts() { const r = {}; for (const st of ['s1', 's2', 's3']) for (const w of ['ak47', 'm4a1', 'pistol', 'sniper']) { const a = draft(st, w); const b = st === 's3' ? draft(st, w, 'std', true) : null; r[st + ':' + w] = { parts: a.g.userData.stats.parts, fpTris: stat(a.g).tris, calls: stat(a.g).calls, lodTris: b ? stat(b.g).tris : null, lodCalls: b ? stat(b.g).calls : null, lodParts: b ? b.g.userData.stats.parts : null }; }
    for (const w of ['ak47', 'm4a1', 'pistol', 'sniper']) { const a = createWeapon(w, w === 'm4a1' ? 'holo' : 'reddot'), b = createWeapon(w, 'reddot', true); let parts = 0; r['cur:' + w] = { fpTris: stat(a).tris, calls: stat(a).calls, lodTris: stat(b).tris, lodCalls: stat(b).calls }; }
    return r; },
};
