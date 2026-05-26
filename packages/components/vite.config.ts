import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vite'
import { failOnDtsDiagnostics } from '../../scripts/fail-on-dts-diagnostics.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    Vue(),
    dts({
      afterDiagnostic: failOnDtsDiagnostics,
      compilerOptions: {
        composite: false,
        incremental: false,
        tsBuildInfoFile: undefined,
      },
      processor: 'vue',
      tsconfigPath: resolve(__dirname, 'tsconfig.app.json'),
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'index.ts'),
      },
      name: 'MoluoxixiComponents',
      /**
       * 固定库产物名称，保证 exports 指向稳定文件。
       */
      fileName: (_, entryName) => `${entryName}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      external: ['@moluoxixi/config-form', 'vue', 'element-plus', /^element-plus\//, 'dayjs', /^dayjs\//],
    },
  },
})
