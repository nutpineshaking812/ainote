import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

/**
 * Vite dev server for SDK demo.html local preview.
 *
 * Usage:
 *   cd client && npm run build:sdk && npm run dev:sdk
 *
 * 将 dist/sdk 下的已构建产物作为静态文件提供，绕过 Vite 模块转换。
 * root 设为 client/ 以确保 Vite 能找到 node_modules。
 */
const distDir = path.resolve(__dirname, 'dist/sdk');

export default defineConfig({
  root: __dirname,
  server: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        ws: true,
        timeout: 600000,
        proxyTimeout: 600000,
      },
    },
  },
  plugins: [
    {
      name: 'sdk-static-serve',
      configureServer(server) {
        // 直接返回 dist/sdk 下的原始文件，不经过 Vite 的 transform/HMR 管线
        const mimeTypes = {
          '.html': 'text/html; charset=utf-8',
          '.js':   'application/javascript; charset=utf-8',
          '.css':  'text/css; charset=utf-8',
          '.wasm': 'application/wasm',
          '.json': 'application/json; charset=utf-8',
          '.png':  'image/png',
          '.svg':  'image/svg+xml',
          '.ico':  'image/x-icon',
          '.woff2': 'font/woff2',
        };

        server.middlewares.use((req, res, next) => {
          // 首页 → demo.html
          let urlPath = req.url?.split('?')[0] || '/';
          if (urlPath === '/') urlPath = '/demo.html';

          const filePath = path.join(distDir, urlPath);
          if (!fs.existsSync(filePath)) {
            // 文件在 dist/sdk 中不存在，交给 Vite 处理
            return next();
          }

          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) return next();

          // 读取文件并设置正确的 Content-Type
          const ext = path.extname(filePath).toLowerCase();
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'no-cache');

          const content = fs.readFileSync(filePath);
          res.end(content);
        });
      },
    },
  ],
});
