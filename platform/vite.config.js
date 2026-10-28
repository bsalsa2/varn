import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, extname, resolve } from 'node:path';

// CesiumJS loads its web workers, textures and star catalogue at runtime from CESIUM_BASE_URL.
// Serve them from node_modules in dev and copy them into dist/cesium for Cloudflare Pages.
const CESIUM = resolve('node_modules/cesium/Build/Cesium');
const DIRS = ['Workers', 'Assets', 'ThirdParty', 'Widgets'];
const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.xml': 'application/xml', '.glb': 'model/gltf-binary' };

function cesiumAssets() {
  return {
    name: 'varn-cesium-assets',
    configureServer(server) {
      server.middlewares.use('/cesium', (req, res, next) => {
        const file = join(CESIUM, decodeURIComponent(req.url.split('?')[0]));
        if (!file.startsWith(CESIUM) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
    writeBundle(opts) {
      for (const d of DIRS) cpSync(join(CESIUM, d), join(opts.dir || 'dist', 'cesium', d), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), cesiumAssets()],
  base: '/',
  build: { chunkSizeWarningLimit: 6000 },
});
