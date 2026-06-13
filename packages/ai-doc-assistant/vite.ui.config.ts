import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * AI 文档助手「可视化面板」SPA 构建配置（独立于库构建 vite.config.ts）。
 *
 * 产物为静态 SPA，输出到 dist/ui，由 BFF 插件在 /__ai-doc/ 下提供。
 * base 设为 /__ai-doc/，使打包后的 assets 引用路径与 plugin 挂载前缀一致。
 * 入口为 src/ui/index.html（SPA），与库的多入口 lib 构建互不干扰。
 */
export default defineConfig({
  base: '/__ai-doc/',
  plugins: [vue()],
  root: resolve(__dirname, 'src/ui'),
  build: {
    outDir: resolve(__dirname, 'dist/ui'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/ui/index.html'),
    },
  },
})
