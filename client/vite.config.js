import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import compression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const cdnBase = process.env.VITE_CDN_BASE_URL || '';
  return {
    base: isProduction ? cdnBase || '/' : '/',
    plugins: [
      react(),
      compression({
        verbose: true,
        disable: false,
        threshold: 10240, // Only compress files larger than 10KB
        algorithm: 'gzip',
        ext: '.gz',
      }),
      // Custom plugin to ensure manifest.json paths are not prefixed with CDN URL
      {
        name: 'restore-manifest-path',
        transformIndexHtml(html) {
          return html.replace(/href="[^"]*manifest\.json"/, 'href="/manifest.json"');
        }
      }
    ],
    resolve: {
      // 强制让所有包都指向项目根目录下的 react 和 react-dom 以及 dayjs
      dedupe: [
        'react',
        'react-dom',
        'dayjs',
        'prosemirror-state',
        'prosemirror-view',
        'prosemirror-model',
        'prosemirror-transform',
        'prosemirror-commands',
        'prosemirror-tables',
        '@blocknote/core',
        '@blocknote/react',
      ],
      alias: {
        // 添加共享代码路径别名
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, '../1shared/src/'),
      },
    },
    // Include WASM files as assets
    assetsInclude: ['**/*.wasm'],
    optimizeDeps: {
      // Exclude SQLite WASM from pre-bundling
      exclude: ['@sqlite.org/sqlite-wasm'],
      include: [
        'prosemirror-model',
        'prosemirror-state',
        'prosemirror-view',
        'prosemirror-transform',
        'prosemirror-commands',
      ],
    },
    server: {
      allowedHosts: ['localhost', '127.0.0.1'],
      hmr: {
        overlay: true, // 显示HMR错误覆盖层，方便查看问题
      },
      // Configure MIME types for WASM
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
      proxy: {
        // 代理所有 /api 请求到后端服务器（端口 5001）
        '/api': {
          target: 'http://localhost:5001',
          changeOrigin: true,
          ws: true, // 支持 WebSocket
          timeout: 600000, // 10 minutes
          proxyTimeout: 600000, // 10 minutes
          // 不重写路径，保持 /api 前缀供后端路由匹配
        },
      },
    },
    build: {
      // 目标浏览器
      target: 'es2015',
      // 启用压缩和混淆
      minify: 'terser',
      terserOptions: {
        compress: {
          // 生产环境移除 console 和 debugger
          drop_console: true,
          drop_debugger: true,
          // 移除未使用的代码
          pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        },
        mangle: {
          // 混淆变量名
          safari10: true,
        },
      },
      // 关闭生产环境 sourcemap（减小体积）
      sourcemap: false,
      // chunk 大小警告限制（KB）
      chunkSizeWarningLimit: 1000,
      // Rollup 配置
      rollupOptions: {
        output: {
          // 静态资源文件名（带 hash 用于缓存）
          entryFileNames: 'assets/js/[name].[hash].js',
          chunkFileNames: 'assets/js/[name].[hash].js',
          assetFileNames: 'assets/[ext]/[name].[hash].[ext]',
          // 手动代码分割
          manualChunks: {
            // React 核心库
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            // Ant Design UI 库
            'vendor-antd': ['antd', '@ant-design/icons', '@ant-design/x'],
            // 编辑器相关（合并 BlockNote 和 Tiptap 避免循环依赖）
            'vendor-editor': [
              '@blocknote/core',
              '@blocknote/react',
              '@blocknote/mantine',
              '@blocknote/xl-ai',
              '@tiptap/core',
              '@tiptap/react',
              '@tiptap/extensions',
            ],
            // 图表库
            'vendor-echarts': ['echarts'],
            // 工具库
            'vendor-utils': ['axios', 'dayjs', 'date-fns', 'uuid', 'mitt'],
            // 拖拽相关
            'vendor-dnd': ['react-dnd', 'react-dnd-html5-backend', 'react-grid-layout'],
            // 国际化
            'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          },
        },
      },
    },
  };
});
