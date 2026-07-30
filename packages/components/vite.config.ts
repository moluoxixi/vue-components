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
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
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
        antd: resolve(__dirname, 'antd.ts'),
        element: resolve(__dirname, 'element.ts'),
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
        '@moluoxixi/config-form-core',
        '@moluoxixi/hooks',
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
