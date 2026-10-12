// Admin paneli ayrı derlenir (dist-admin/): oyun sitesinde (dist/) yer almaz, yalnızca admin.warbyte.site'tan servis edilir.
import { defineConfig } from 'vite';
export default defineConfig({
  root: 'admin',
  base: '/',
  build: { outDir: '../dist-admin', emptyOutDir: true, chunkSizeWarningLimit: 2500 },
  server: { port: 5181, strictPort: true, host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:8788' } },
});
