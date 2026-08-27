import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/ui'),
    },
  },
  root: resolve(__dirname, 'src/ui'),
  build: {
    emptyOutDir: true,
    outDir: resolve(__dirname, 'dist/ui'),
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-element': ['element-plus'],
          'vendor-vue': ['vue'],
        },
      },
    },
  },
})
