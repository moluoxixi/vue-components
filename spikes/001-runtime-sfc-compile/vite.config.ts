import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Spike 配置：纯前端，无框架插件（我们要的就是"运行时"编译，不是构建时）。
// @vue/compiler-sfc 默认入口带 Node 依赖，浏览器里必须指向 esm-browser 构建，
// 这是 Vue SFC Playground 的同款做法。
export default defineConfig({
  resolve: {
    alias: {
      '@vue/compiler-sfc': '@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js',
    },
  },
  optimizeDeps: {
    include: ['vue', '@vue/compiler-sfc', 'vue3-sfc-loader', 'sucrase'],
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 5199,
  },
})
