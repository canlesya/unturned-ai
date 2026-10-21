// El laboratuvarı: fpHand pozlarını oyundan bağımsız, yakından, birkaç açıdan çizer (geometri / gölgeleme denetimi).
//   node scripts/handlab.mjs <çıktı.png> [taban url]     POSES=fist,trigger,...  (GPU, Metal)
import { chromium } from 'playwright';
const out = process.argv[2] || '/tmp/wb-h2-shots/lab.png', base = process.argv[3] || 'http://127.0.0.1:5180';
const poses = (process.env.POSES || 'fist,trigger,cup,relax,ball,open,claw').split(',');
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 400, height: 300 } })).newPage();
page.on('pageerror', (e) => console.log('hata', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('konsol', m.text()));
await page.goto(base + '/?nolock=1&nologin=1');
const url = await page.evaluate(async (poses) => {
  const src = await (await fetch('/src/models/fpHands.js')).text();
  const tp = src.match(/from\s+["']([^"']*three[^"']*)["']/)[1];
  const THREE = await import(tp), H = await import('/src/models/fpHands.js');
  const W = 300, Hh = 300, views = [[0, 0.25, 1], [1, 0.3, 0.2], [-0.6, 0.5, -0.8], [0.3, -0.9, 0.4]];
  const cv = document.createElement('canvas'); cv.width = W * views.length; cv.height = Hh * poses.length;
  const ctx = cv.getContext('2d');
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W, Hh); r.setClearColor('#8c8f94');
  r.outputColorSpace = THREE.SRGBColorSpace;
  const gc = H.gloveColors({ gloves: '#2b2f33', shirt: '#3d6fa8' }), zc = H.zombieColors('#86a273');
  for (let i = 0; i < poses.length; i++) {
    const z = poses[i].startsWith('claw');
    const m = H.fpHand({ colors: z ? zc : gc, pose: poses[i], arm: new THREE.Vector3(0, -1, 0.15), armLen: 0.3 });
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#cfe3ff', '#8a7a58', 1.5)); const sun = new THREE.DirectionalLight('#fff0d2', 2.2); sun.position.set(2, 3, 2); sc.add(sun); sc.add(m);
    for (let j = 0; j < views.length; j++) {
      const cam = new THREE.PerspectiveCamera(40, 1, 0.01, 10), v = views[j];
      cam.position.set(v[0], v[1], v[2]).normalize().multiplyScalar(0.36).add(new THREE.Vector3(0.0, -0.02, 0)); cam.lookAt(0, -0.02, 0);
      r.render(sc, cam); ctx.drawImage(r.domElement, j * W, i * Hh);
    }
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.fillText(poses[i], 6, i * Hh + 18);
  }
  return cv.toDataURL('image/png');
}, poses);
const fs = await import('fs');
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
console.log('yazıldı', out);
await browser.close();
