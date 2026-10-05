// Gerçek çizilen arazi ağına ışın atıp oyun fiziği (world.heightAt) ile karşılaştırır.  node scripts/cgmesh.mjs x0 z0 x1 z1
import { chromium } from 'playwright';
const R = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto('http://127.0.0.1:5180/?autostart=3v3&map=colgecidi&type=tdm&debug=1&nolock=1');
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
const res = await page.evaluate(([x0, z0, x1, z1]) => {
  const g = window.__game; const THREE = g.camera.position.constructor; let mesh = null, big = 0;
  g.scene.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.color && o.geometry.attributes.position.count > 400000 && !mesh) mesh = o; });
  const pos = mesh.geometry.attributes.position, idx = pos.count / 3;
  // en büyük renkli mesh = arazi: üçgenlere bölüp (x,z) ızgarasında en yakın yüzü bul — basit: küçük bölgeyi tara
  const tris = []; for (let i = 0; i < idx; i++) { const a = [pos.getX(i * 3), pos.getY(i * 3), pos.getZ(i * 3)], b = [pos.getX(i * 3 + 1), pos.getY(i * 3 + 1), pos.getZ(i * 3 + 1)], c = [pos.getX(i * 3 + 2), pos.getY(i * 3 + 2), pos.getZ(i * 3 + 2)];
    const mnx = Math.min(a[0], b[0], c[0]), mxx = Math.max(a[0], b[0], c[0]), mnz = Math.min(a[2], b[2], c[2]), mxz = Math.max(a[2], b[2], c[2]); if (mxx < x0 || mnx > x1 || mxz < z0 || mnz > z1) continue; tris.push([a, b, c]); }
  const hAt = (x, z) => { for (const [a, b, c] of tris) { const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d, l3 = 1 - l1 - l2; if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return l1 * a[1] + l2 * b[1] + l3 * c[1]; } return null; };
  let worst = 0, wp = '', n = 0;
  for (let z = z0; z <= z1; z += 0.37) for (let x = x0; x <= x1; x += 0.37) { const m = hAt(x, z); if (m === null) continue; n++; const d = Math.abs(m - g.world.heightAt(x, z)); if (d > worst) { worst = d; wp = x.toFixed(1) + ',' + z.toFixed(1); } if (d > 0.05) big++; }
  return { mesh: !!mesh, tris: tris.length, n, worst, wp, big };
}, R);
console.log(JSON.stringify(res));
await browser.close();
