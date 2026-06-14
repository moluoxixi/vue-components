import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
// monorepo 根：用于解析 workspace 组件库实体与放开 dev server 文件访问范围。
const REPO_ROOT = resolve(__dirname, '..', '..')

/**
 * AI 文档助手「可视化面板」SPA 构建配置（独立于库构建 vite.config.ts）。
 *
 * 产物为静态 SPA，输出到 dist/ui，由 BFF 插件在 /__ai-doc/ 下提供。
 * base 设为 /__ai-doc/，使打包后的 assets 引用路径与 plugin 挂载前缀一致。
 * 入口为 src/ui/index.html（SPA），与库的多入口 lib 构建互不干扰。
 *
 * demo 预览块在浏览器运行时编译 SFC 并挂载真实组件（vue3-sfc-loader），需要：
 *  - @vue/compiler-sfc 的 esm-browser 构建（loader 在浏览器侧解析模板，见 spike pitfall 1）
 *  - 将 @moluoxixi/components 解析到本地 workspace 构建产物（bare specifier 注入 moduleCache）
 */
export default defineConfig({
  base: '/__ai-doc/',
  plugins: [vue()],
  root: resolve(__dirname, 'src/ui'),
  resolve: {
    alias: {
      '@vue/compiler-sfc': '@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js',
      '@moluoxixi/components/styles': resolve(REPO_ROOT, 'packages/components/dist/components.css'),
      '@moluoxixi/components': resolve(REPO_ROOT, 'packages/components/dist/index.js'),
    },
    // 允许从 monorepo 解析 workspace 组件库（关闭符号链接保留以命中 .pnpm 实体）
    preserveSymlinks: false,
  },
  server: {
    fs: { allow: [REPO_ROOT] },
  },
  optimizeDeps: {
    // 预构建组件库与 loader，避免运行时 bare-specifier 解析抖动
    include: ['@moluoxixi/components', 'vue', 'vue3-sfc-loader'],
  },
  build: {
    outDir: resolve(__dirname, 'dist/ui'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/ui/index.html'),
    },
  },
})
