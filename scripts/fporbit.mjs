// Birinci şahıs silah + eller, çevresinden (yörünge kameralarıyla) çizilir: tutuş denetimi (el sapı gerçekten sarıyor mu, kol kırık mı).
//   node scripts/fporbit.mjs <çıktı.png> [taban url]     IDS=m4a1,pistol,knife   (ilk sütun = oyuncu gözü, sonra 4 yörünge açısı)
import { chromium } from 'playwright';
import fs from 'fs';
const out = process.argv[2] || '/tmp/wb-h2-shots/orbit.png', base = process.argv[3] || 'http://127.0.0.1:5180';
const ids = (process.env.IDS || 'm4a1,ak47,pistol,deagle,knife,grenade').split(',');
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
page.on('pageerror', (e) => console.log('hata', e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
await page.evaluate(([f, d]) => { window.__focus = f; window.__dist = d; }, [process.env.FOCUS || '', +(process.env.DIST || 0)]);
const url = await page.evaluate(async (ids) => {
  const g = window.__game, p = g.player, s = p.s, vm = p.vm, r = g.renderer;
  g.brains.forEach((b) => (b.update = () => {})); g.simulate = false;
  const slotOf = { pistol: 1, deagle: 1, pbpistol: 1, knife: 3, machete: 3, grenade: 2 };
  const W = 300, H = 300, V = vm.cam.position.constructor;
  const views = [null, [1, 0.2, 0], [-1, 0.3, 0.2], [0.2, -1, 0.3], [0.4, 0.5, -1]];
  const cv = document.createElement('canvas'); cv.width = W * views.length; cv.height = H * ids.length; const ctx = cv.getContext('2d');
  const oldPR = r.getPixelRatio(), ow = r.domElement.width, oh = r.domElement.height;
  r.setPixelRatio(1); r.setSize(W, H, false);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i], sl = slotOf[id] ?? 0;
    if (id === 'claws' && !s.def.zombie) { g.makeZombie(s, false, 'walker'); s.alive = true; }
    s.cur = sl; s.items[sl] = { id, mag: 30, reserve: 90 }; p.refreshWeapon();
    vm.raise = 0; vm.kick = 0; vm.kickR = 0; s.swing = null; s.reloadT = 0; s.adsT = 0; s.vel.set(0, 0, 0); s.sprinting = false;
    for (let k = 0; k < 30; k++) p.update(1 / 60);
    vm.cam.aspect = 1; vm.cam.updateProjectionMatrix(); vm.cam.updateMatrixWorld(true);
    const c = new V(); vm.model.updateMatrixWorld(true); const fo = window.__focus === 'L' && vm.handL?.visible ? vm.handL : window.__focus === 'R' && vm.handR ? vm.handR : vm.model; fo.getWorldPosition(c);
    for (let j = 0; j < views.length; j++) {
      let cam = vm.cam;
      if (views[j]) {
        cam = vm.cam.clone(false); cam.fov = 45; cam.aspect = 1;
        const v = new V(...views[j]).normalize().multiplyScalar(window.__dist || 0.75).add(c); cam.position.copy(v); cam.up.set(0, 1, 0); cam.lookAt(c); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
      }
      r.setClearColor('#7d8288', 1); r.clear();
      r.render(vm.scene, cam);
      ctx.drawImage(r.domElement, j * W, i * H);
    }
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.fillText(id, 6, i * H + 18);
  }
  r.setPixelRatio(oldPR); r.setSize(innerWidth, innerHeight, false);
  return cv.toDataURL('image/png');
}, ids);
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
console.log('yazıldı', out);
await browser.close();
