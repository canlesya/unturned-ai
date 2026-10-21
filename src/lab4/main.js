import * as THREE from 'three';
import { setupEnvironment, todEnv, todGrade } from '../maps/environment.js';
import { TEAMS } from '../core/palette.js';
import { createCharacter } from '../models/character.js';
import { mergeVC } from '../core/geo.js';
import { HandlessRig, POSE } from './rig.js';
import { CurrentHands } from './current.js';
import { ANIMS } from './anims.js';
import { createWeaponU, isNew, WEAPONS_U } from './weaponsUnturned.js';
import { WEAPONS } from '../models/weapons.js';

// handlab4: elsiz (Unturned tarzı) birinci şahıs taslakları + Unturned tarzı silah taslakları laboratuvarı.
//   ?draft=v1|v2|cur  (v1 tamamen elsiz · v2 blok kol kütükleri · cur oyunun mevcut elleri)   &set=new|cur (silah modeli: taslak / mevcut)
//   &w=ak47&anim=idle|reload|shell|bolt|pump|fire|slash|stab|throw|sprint2ads|inspect&t=0.3&ads=1&sprint=1&tod=day|night&view=game|third&hud=0&live=1
//   &hip=x,y,z,rx,ry,rz (bel duruşu denemesi) &scale=1.0 &team=blue
const Q = new URLSearchParams(location.search), P = {
  draft: Q.get('draft') || 'v1', set: Q.get('set') || 'new', w: Q.get('w') || 'ak47', anim: Q.get('anim') || 'idle', t: +(Q.get('t') || 0), ads: +(Q.get('ads') || 0), sprint: +(Q.get('sprint') || 0),
  view: Q.get('view') || 'game', tod: Q.get('tod') || 'day', hip: Q.get('hip') || '', scale: +(Q.get('scale') || 0), bob: +(Q.get('bob') || 0), team: Q.get('team') || 'blue', optic: Q.get('optic') || 'reddot', time: 0,
};
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMappingExposure = todGrade(P.tod).exposure;
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight); renderer.autoClear = false; renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ── arka plan: oyunun ortamı (kum zemin + birkaç duvar), lab3 ile aynı
const world = new THREE.Scene(), worldCam = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.05, 700);
setupEnvironment(world, renderer, { tod: P.tod });
const E = todEnv({}, [60, 90, 40], P.tod).E, ENV_I = P.tod === 'night' ? 0.3 : P.tod === 'sunset' ? 0.55 : 0.7;
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#c9b17c', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
  const wallM = new THREE.MeshStandardMaterial({ color: '#d9c9a3', roughness: 0.95 });
  for (const [x, z, w, h, d] of [[-6, -14, 10, 4, 1], [8, -18, 6, 5, 6], [-14, -6, 1, 3.5, 12], [3, -9, 1.2, 1.2, 1.2], [5, -8.5, 1.2, 1.2, 1.2]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallM); m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; world.add(m); }
  worldCam.position.set(0, 1.6, 0); worldCam.lookAt(0, 1.55, -10);
}
// ── silah kamerası sahnesi (oyunun _vmLights değerleri)
const vmScene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.01, 10);
vmScene.add(cam); vmScene.environment = world.environment; vmScene.environmentIntensity = ENV_I;
const hemi = new THREE.HemisphereLight(E.hemi[0], E.hemi[1], E.hemi[2] * 1.3), sun = new THREE.DirectionalLight(E.sun[0], E.sun[1] * 0.95); sun.position.set(2, 3, 2);
vmScene.add(hemi); vmScene.add(sun);
const applyGameLights = (scene) => { for (const o of scene.children) { if (o.isHemisphereLight) { o.color.set(E.hemi[0]); o.groundColor.set(E.hemi[1]); o.intensity = E.hemi[2] * 1.3; } else if (o.isDirectionalLight) { o.color.set(E.sun[0]); o.intensity = E.sun[1] * 0.95; } } scene.environmentIntensity = ENV_I; };

let rig = null, cur = null, mode = null;
function setDraft(d) {
  if (rig) { rig.dispose(); rig = null; }
  if (d === 'cur') { if (!cur) { cur = new CurrentHands(world.environment); applyGameLights(cur.vm.scene); } mode = 'cur'; }
  else { mode = d; rig = new HandlessRig(d, TEAMS[P.team] || TEAMS.blue, cam, P.set); }
}
function setWeapon(id) { P.w = id; if (mode === 'cur') cur.setWeapon(id, P.team, P.optic); else { rig.scaleOverride = P.scale || 0; rig.setWeapon(id, P.optic); } }
function state() { return { anim: P.anim, t: P.t, ads: P.ads, sprint: P.sprint, bobT: P.bob, time: P.time ?? 0 }; }

// ── üçüncü şahıs: asker modeli + silah (set=new → taslak silah LOD sürümüyle değiştirilir, el pozu aynı userData'dan çözülür)
let third = null;
const thirdCam = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 50);
function setThird(id) {
  if (third) { world.remove(third.root); third = null; }
  const api = createCharacter({ team: P.team, weapon: id, optic: P.optic });
  if (P.set === 'new' && isNew(id)) { const w = createWeaponU(id, P.optic, true); api.parts.mount.remove(api.weapon); api.weapon = w; api.parts.mount.add(w); api.refreshHold({}); }
  api.root.position.set(0, api.root.position.y, -2.3); api.root.rotation.y = 1.25;      // sağ ön çeyrek kameraya dönük: silah yan + üstten görünür
  api.root.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  world.add(api.root); third = api;
  thirdCam.position.set(1.3, 1.6, -4.3); thirdCam.lookAt(0.0, 1.15, -2.3);
}

function frame() {
  const st = state(), W = innerWidth, H = innerHeight;
  renderer.setViewport(0, 0, W, H);
  if (P.view === 'third') {
    if (!third || third._id !== P.w) { setThird(P.w); third._id = P.w; }
    const anim = ANIMS[P.anim] ? P.anim : 'idle';
    third.refreshHold(anim === 'reload' ? { reload: { style: WEAPONS[P.w] && P.w === 'sniper' ? 'bolt' : 'mag', k: P.t, empty: true } } : anim === 'slash' ? { melee: { kind: 'rl', k: P.t } } : anim === 'stab' ? { melee: { kind: 'stab', k: P.t } } : { sprint: P.sprint });
    thirdCam.aspect = W / H; thirdCam.updateProjectionMatrix();
    renderer.setClearColor('#000'); renderer.clear(); renderer.render(world, thirdCam);
    return;
  }
  if (rig) { if (P.hip) { const h = String(P.hip).split(',').map(Number); rig.hip = new THREE.Vector3(h[0], h[1], h[2]); rig.hipRot = [h[3] || 0, h[4] || 0, h[5] || 0]; } else { rig.hip = null; rig.hipRot = null; } rig.scaleOverride = P.scale || 0; }
  if (mode === 'cur') cur.update(st); else rig.update(st);
  worldCam.aspect = W / H; worldCam.updateProjectionMatrix();
  renderer.setClearColor('#000'); renderer.clear();
  renderer.render(world, worldCam);
  renderer.clearDepth();
  if (mode === 'cur') cur.vm.render(renderer, W, H);
  else { cam.fov = rig.fov + (68 - 54) * (P.ads && !rig.u.noAds ? P.ads : 0); cam.aspect = W / H; cam.updateProjectionMatrix(); renderer.render(vmScene, cam); }
}
// başarım: yalnız silah sahnesi (çizim çağrısı, üçgen, GPU süresi); kol kütükleri sayılmaz
async function perf(n = 40) {
  const gl = renderer.getContext(), px = new Uint8Array(4), sc = mode === 'cur' ? cur.vm.scene : vmScene, c = mode === 'cur' ? cur.vm.cam : cam;
  const one = () => { renderer.clearDepth(); renderer.render(sc, c); };
  renderer.info.autoReset = false; renderer.info.reset(); one(); const calls = renderer.info.render.calls, tris = renderer.info.render.triangles; renderer.info.autoReset = true;
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  for (let i = 0; i < 5; i++) one(); sync();
  const t0 = performance.now(); for (let i = 0; i < n; i++) { one(); sync(); } const ms = (performance.now() - t0) / n;
  let wTris = 0, wMeshes = 0; const wr = mode === 'cur' ? cur.vm.model : rig.weapon; wr?.traverse((m) => { if (m.isMesh && m.visible && !m.userData.fpHand) { wMeshes++; const g = m.geometry; wTris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  return { calls, tris, ms: +ms.toFixed(2), weaponTris: Math.round(wTris), weaponMeshes: wMeshes, parts: partCount(P.w) };
}
// ham parça sayısı (birleştirmeden önce): mevcut model / taslak
function partCount(id) { const n = (fn) => { if (!fn) return null; const g = fn(); let k = 0; g.traverse((o) => { if (o.isMesh) k++; }); g.traverse((o) => o.geometry?.dispose?.()); return k; }; return { cur: n(WEAPONS[id]), new: n(WEAPONS_U[id]) }; }

const hud = document.getElementById('hud');
function label() {
  hud.textContent = `${mode === 'cur' ? 'MEVCUT eller' : mode === 'v1' ? 'V1 tamamen elsiz' : 'V2 blok kol'} · silah: ${P.set === 'new' && isNew(P.w) ? 'TASLAK' : 'mevcut'} · ${P.tod} · ${P.w} · ${P.anim} t=${P.t}${P.ads ? ' · nişan' : ''}${P.sprint ? ' · koşu' : ''}${P.view === 'third' ? ' · 3. şahıs' : ''}`;
  hud.style.display = Q.get('hud') === '0' ? 'none' : 'block';
}
setDraft(P.draft); setWeapon(P.w); frame(); label();
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); frame(); });
window.__lab = {
  P, POSE, set(o) { let d = false, w = false; for (const k in o) { if ((k === 'draft' || k === 'set') && o[k] !== P[k]) d = true; if (k === 'w' && o[k] !== P.w) w = true; P[k] = o[k]; } if (d) { setDraft(P.draft); setWeapon(P.w); } else if (w) setWeapon(P.w); if (third && (d || w)) { world.remove(third.root); third = null; } frame(); label(); return true; },
  frame, perf, partCount, anims: Object.keys(ANIMS), rig: () => rig, report: () => (rig ? rig.report() : null),
};
if (Q.get('live') === '1') { const t0 = performance.now(); const loop = () => { const now = performance.now(); P.time = (now - t0) / 1000; P.t = ((now - t0) / 1000 / 2.2) % 1; P.bob = P.bob ? P.time * 8 : 0; frame(); label(); requestAnimationFrame(loop); }; loop(); }
