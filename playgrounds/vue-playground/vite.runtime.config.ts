import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    cssCodeSplit: false,
    emptyOutDir: true,
    lib: {
      cssFileName: 'moluoxixi-components',
      entry: resolve(__dirname, 'src/component-runtime.ts'),
      fileName: () => 'moluoxixi-components.js',
      formats: ['es'],
    },
    outDir: resolve(__dirname, 'dist/runtime'),
    rollupOptions: {
      external: [
        'vue',
        'element-plus',
        /^element-plus\//,
      ],
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
