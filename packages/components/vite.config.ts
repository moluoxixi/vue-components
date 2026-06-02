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
      compilerOptions: {
        composite: false,
        incremental: false,
        tsBuildInfoFile: undefined,
      },
      processor: 'vue',
      tsconfigPath: resolve(__dirname, 'tsconfig.app.json'),
    }),
  ],
  test: {
    environment: 'happy-dom',
  },
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
      external: [
        '@moluoxixi/config-form-antd-vue',
        '@moluoxixi/config-form-core',
        '@moluoxixi/config-form-element',
        '@moluoxixi/config-form-shadcn-vue',
        'vue',
        'element-plus',
        /^element-plus\//,
        'ant-design-vue',
        /^ant-design-vue\//,
        'dayjs',
        /^dayjs\//,
      ],
    },
  },
})
