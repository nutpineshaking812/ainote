import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vite 库模式构建配置 — 用于生成 AiNote Chat SDK（IIFE 单体 JS）
 *
 * 用法：cd client && npx vite build --config vite.sdk.config.js
 *
 * 产物：dist/sdk/ainote-chat-sdk.js（~2.1 MB）
 *
 * 体积优化：react / react-dom / antd / @ant-design/icons / echarts / mermaid
 * 通过 CDN external 化，页面需预先引入对应的 UMD 脚本。
 * mermaid 内置 no-op shim，可选按需引入完整 CDN。详见 src/sdk/README.md。
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
  plugins: [react(), cssInjectedPlugin()],
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
    // 库模式
    lib: {
      entry: path.resolve(__dirname, 'src/sdk/index.jsx'),
      name: 'AiNoteChat',
      formats: ['iife'],
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
    sourcemap: true,
    rollupOptions: {
      // externalize 重型库，由接入方通过 CDN UMD 脚本提供，减小 SDK 体积
      // 注意：仅 externalize 主入口模块，子路径导入（如 antd/locale/*）由 rollup 正常打包
      // dayjs 因 locale 插件链（dayjs/locale/zh-cn → duration → relativeTime）保留打包
      //
      // mermaid: @ant-design/x 的 Mermaid 组件静态引入了 mermaid（~2.6MB minified），
      // 外部化后由 no-op shim 兜底，兜底逻辑确保不渲染也不报错。
      // 如需启用 Mermaid 图表渲染，页面自行引入 mermaid CDN 即可。
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'antd',
        '@ant-design/icons',
        'echarts',
        'mermaid',
      ],
      output: {
        globals: (id) => {
          if (id === 'react') return 'React';
          if (id === 'react-dom') return 'ReactDOM';
          if (id === 'react-dom/client') return 'ReactDOM';
          if (id === 'antd') return 'antd';
          if (id === '@ant-design/icons') return 'icons';
          if (id === 'echarts') return 'echarts';
          if (id === 'mermaid') return 'mermaid';
        },
        // mermaid no-op shim：防止 Mermaid 组件在没有加载 mermaid 时调用 API 报错
        intro:
          'var process = { env: { NODE_ENV: "production" } };\n' +
          'window.mermaid = window.mermaid || { parse:function(){return Promise.resolve(true)},render:function(){return Promise.resolve({svg:""})},initialize:function(){} };\n',
        inlineDynamicImports: true,
      },
    },
  },
});
