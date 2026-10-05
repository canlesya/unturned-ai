import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
let sha = 'dev';
try { sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* git yok: dev */ }
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 2500 }, define: { __BUILD__: JSON.stringify(sha) } });
