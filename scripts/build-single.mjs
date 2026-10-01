// dist/ çıktısını tek bir kendi kendine yeten HTML dosyasına gömer (dist/single/index.html).
import fs from 'node:fs';
import path from 'node:path';

const dist = 'dist';
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const m = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/);
if (!m) throw new Error('script etiketi bulunamadı');
let js = fs.readFileSync(path.join(dist, m[1]), 'utf8');
const img = fs.readFileSync('public/img/kasaba.png').toString('base64');
js = js.replaceAll('/img/kasaba.png', 'data:image/png;base64,' + img).replaceAll('</script', '<\\/script');
html = html.replace(m[0], () => '<script type="module">\n' + js + '\n</script>');
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '').replace(/<link rel="stylesheet"[^>]*>/g, '');
fs.mkdirSync(path.join(dist, 'single'), { recursive: true });
fs.writeFileSync(path.join(dist, 'single', 'index.html'), html);
console.log('yazıldı: dist/single/index.html', (html.length / 1024 / 1024).toFixed(2) + ' MB');
