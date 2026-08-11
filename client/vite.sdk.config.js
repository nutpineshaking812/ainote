import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/**
 * Vite 库模式构建配置 — 用于生成 AiNote Chat SDK（ES Module + 代码分割）
 *
 * 用法：cd client && npx vite build --config vite.sdk.config.js
 *
 * 产物：
 *   dist/sdk/ainote-chat-sdk.js      — SDK 业务代码（~200KB）
 *   dist/sdk/ainote-chat-vendors.js  — React + antd + echarts + icons（~2MB，长期缓存）
 *
 * 隔离设计：所有依赖打包在模块作用域内，不污染 window.React/window.antd 等全局变量，
 * 避免与接入方网站的 React/Antd 版本冲突。mermaid 保持 external，通过 importmap
 * 指向 no-op stub，需要图表渲染时替换为完整 CDN。
 */

/**
 * 内联 CSS 注入插件
 * 将构建产生的 .css 文件内容内嵌到 JS 中，运行时动态注入 <style> 标签。
 * 这样 SDK 只需要一个 JS 文件即可工作，无需额外引入 CSS。
 */
function cssInjectedPlugin() {
  return {
    name: 'css-injected-by-js',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      // 收集所有 CSS asset
      const cssAssets = [];
      for (const [name, asset] of Object.entries(bundle)) {
        if (asset.type === 'asset' && name.endsWith('.css')) {
          cssAssets.push({ name, content: asset.source });
        }
      }

      if (cssAssets.length === 0) return;

      // 将所有 CSS 注入到入口 chunk 开头
      const entryChunks = Object.entries(bundle).filter(
        ([, chunk]) => chunk.type === 'chunk' && chunk.isEntry,
      );

      for (const [, chunk] of entryChunks) {
        const cssStr = cssAssets
          .map((a) => a.content)
          .join('');
        // 转义特殊字符确保能安全放入模板字符串
        const escaped = JSON.stringify(cssStr);
        // 注意：process polyfill 已移至 output.intro，此处只负责 CSS 注入
        chunk.code =
          `(function(){var s=document.createElement('style');s.textContent=${escaped};document.head.appendChild(s);})();\n` +
          chunk.code;
      }

      // 移除独立 CSS 文件
      for (const { name } of cssAssets) {
        delete bundle[name];
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    cssInjectedPlugin(),
    // 构建时自动复制 demo.html 到 dist/sdk/
    {
      name: 'copy-demo-html',
      apply: 'build',
      writeBundle() {
        const src = path.resolve(__dirname, 'src/sdk/demo.html');
        const dest = path.resolve(__dirname, 'dist/sdk/demo.html');
        fs.copyFileSync(src, dest);
        console.log('[copy-demo-html] demo.html synced');
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '../1shared/src/'),
    },
  },
  define: {
    // SDK 构建不依赖服务端代理，API 请求使用相对路径 /api/v1/*
    // 第三方需自行配置反向代理，或将 SDK 部署在 API 同域下
    'import.meta.env.VITE_API_URL': JSON.stringify(''),
    // 替换 process.env 引用，避免浏览器报 "process is not defined"
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    // 产物输出到 dist/sdk/
    outDir: 'dist/sdk',
    emptyOutDir: false,
    // 库模式 — ES Module 格式支持代码分割
    lib: {
      entry: path.resolve(__dirname, 'src/sdk/index.jsx'),
      formats: ['es'],
      fileName: () => 'ainote-chat-sdk.js',
    },
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    sourcemap: false,
    rollupOptions: {
      // react / react-dom / antd / @ant-design/icons / echarts / mermaid 全部打包进 vendors chunk，
      // 模块作用域隔离，不与宿主页面全局变量冲突，开箱即用无需额外 CDN
      // dayjs 因 locale 插件链（dayjs/locale/zh-cn → duration → relativeTime）保留打包
      external: [],
      output: {
        // 代码分割：node_modules 单独拆分为 vendors chunk，利于浏览器长期缓存
        // chunkFileNames 固定文件名，避免每次构建 hash 变化
        chunkFileNames: 'ainote-chat-vendors.js',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'ainote-chat-vendors';
          }
        },
      },
    },
  },
});
