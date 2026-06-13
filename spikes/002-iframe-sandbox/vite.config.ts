import { defineConfig } from 'vite'

// 沙箱产物以 ?raw 内联进 srcdoc；vue3-sfc-loader 在 iframe 内编译。
// @vue/compiler-sfc 浏览器构建需指向 esm-browser（被 vue3-sfc-loader 间接使用）。
export default defineConfig({
  server: { port: 5200, strictPort: true },
  // 确保 ?raw 与 wasm/外部依赖不被错误预打包
  optimizeDeps: { exclude: ['vue3-sfc-loader'] },
})
