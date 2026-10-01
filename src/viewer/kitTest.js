// GEÇİCİ geliştirme görüntüleyicisi (yapı kiti testleri). Teslimden önce silinecek.
import * as THREE from 'three';
import { setupEnvironment } from '../maps/environment.js';
const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const mod = await import(/* @vite-ignore */ '../maps/' + (q.get('mod') || '_kitTest') + '.js');
const map = mod.buildTest(q.get('scene') || 'houses');
const envApi = setupEnvironment(scene, renderer, { shadowSize: +(q.get('sh') || 60), sunPos: map.sunPos || [60, 90, 40], tod: q.get('tod') || 'day' });
scene.add(map.group);
envApi.applyGlow(map.group);
const cam = (q.get('cam') || '0,10,20').split(',').map(Number), tg = (q.get('target') || '0,0,0').split(',').map(Number);
let camera;
if (q.get('shot') === 'top') {
  const hh = +(q.get('span') || 30), ha = innerWidth / innerHeight;
  camera = new THREE.OrthographicCamera(-hh * ha, hh * ha, hh, -hh, 1, 600);
  camera.position.set(tg[0], 300, tg[2]); camera.up.set(0, 0, -1); camera.lookAt(tg[0], 0, tg[2]);
  const cutY = +(q.get('cut') || 1e9);
  scene.traverse((o) => { if (o.isMesh && o.position.y > 60) o.visible = false; });
  scene.fog = null;
  if (q.get('cut')) { renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), cutY)]; }
} else {
  camera = new THREE.PerspectiveCamera(+(q.get('fov') || 60), innerWidth / innerHeight, 0.05, 900);
  camera.position.set(...cam); camera.lookAt(...tg);
}
if (q.get('cut') && q.get('shot') !== 'top') renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), +q.get('cut'))];
let f = 0;
(function frame() { renderer.render(scene, camera); if (++f >= 2) { window.__ready = true; return; } requestAnimationFrame(frame); })();
