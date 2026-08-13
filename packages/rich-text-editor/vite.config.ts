import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vitest/config'
import { failOnDtsDiagnostics } from '../../scripts/fail-on-dts-diagnostics.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    Vue(),
    dts({
      afterDiagnostic: failOnDtsDiagnostics,
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**'],
      compilerOptions: { composite: false, incremental: false, tsBuildInfoFile: undefined },
      processor: 'vue',
      tsconfigPath: resolve(__dirname, 'tsconfig.app.json'),
    }),
  ],
  test: { environment: 'happy-dom' },
  build: {
    cssCodeSplit: false,
    lib: {
      entry: { index: resolve(__dirname, 'index.ts') },
      fileName: (_, entryName) => `${entryName}.js`,
      formats: ['es'],
      name: 'MoluoxixiRichTextEditor',
    },
    rollupOptions: {
      external: ['vue', '@lucide/vue', /^@tiptap\//],
      output: { assetFileNames: asset => asset.name?.endsWith('.css') ? 'rich-text-editor.css' : '[name][extname]' },
    },
  },
})
