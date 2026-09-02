import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vitest/config'
import { failOnDtsDiagnostics } from '../../scripts/fail-on-dts-diagnostics.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const autoLoadersEntryName = 'auto-loaders'

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
  resolve: {
    conditions: ['source'],
  },
  test: {
    environment: 'happy-dom',
  },
  build: {
    lib: {
      entry: {
        ConfigTable: resolve(__dirname, 'src/ConfigTable/index.ts'),
        CopyText: resolve(__dirname, 'src/CopyText/index.ts'),
        DateRangePicker: resolve(__dirname, 'src/DateRangePicker/index.ts'),
        EnterNextContainer: resolve(__dirname, 'src/EnterNextContainer/index.ts'),
        HeadlessCopyText: resolve(__dirname, 'src/HeadlessCopyText/index.ts'),
        HeadlessTable: resolve(__dirname, 'src/HeadlessTable/index.ts'),
        PopoverTableSelect: resolve(__dirname, 'src/PopoverTableSelect/index.ts'),
        RequestCascader: resolve(__dirname, 'src/RequestCascader/index.ts'),
        RequestSelectV2: resolve(__dirname, 'src/RequestSelectV2/index.ts'),
        RequestTreeSelect: resolve(__dirname, 'src/RequestTreeSelect/index.ts'),
        [autoLoadersEntryName]: resolve(__dirname, 'auto-loaders.ts'),
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
        '@moluoxixi/hooks',
        '@floating-ui/dom',
        /^@tiptap\//,
        'vue',
        'element-plus',
        /^element-plus\//,
        'dayjs',
        /^dayjs\//,
        '@lucide/vue',
        'sortablejs',
      ],
    },
  },
})
