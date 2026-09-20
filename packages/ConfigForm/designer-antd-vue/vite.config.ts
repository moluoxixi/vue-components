import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vitest/config'
import { configFormInternalAliases } from '../../../scripts/config-form-internal-aliases.mjs'
import { failOnDtsDiagnostics } from '../../../scripts/fail-on-dts-diagnostics.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRequire = createRequire(import.meta.url)
const antDesignVueEntry = packageRequire.resolve('ant-design-vue')
const antDesignVueRequire = createRequire(antDesignVueEntry)
const antDesignVueEsm = resolve(dirname(antDesignVueEntry), '../es/index.js')
const scrollIntoViewEntry = antDesignVueRequire.resolve('scroll-into-view-if-needed')
const scrollIntoViewRequire = createRequire(scrollIntoViewEntry)
const scrollIntoViewEsm = resolve(dirname(scrollIntoViewEntry), 'es/index.js')
const computeScrollIntoViewEsm = resolve(
  dirname(scrollIntoViewRequire.resolve('compute-scroll-into-view')),
  'index.mjs',
)

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
    // The package advertises an unpublished source entry; use its shipped ESM file in source-mode tests.
    alias: [
      { find: /^ant-design-vue$/, replacement: antDesignVueEsm },
      { find: 'scroll-into-view-if-needed', replacement: scrollIntoViewEsm },
      { find: 'compute-scroll-into-view', replacement: computeScrollIntoViewEsm },
      ...configFormInternalAliases,
    ],
    conditions: ['source'],
  },
  test: {
    environment: 'happy-dom',
    server: {
      deps: {
        inline: [/ant-design-vue/, /scroll-into-view-if-needed/],
      },
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'index.ts'),
      name: 'ConfigFormDesignerAntdVue',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        '@lucide/vue',
        '@moluoxixi/config-form-designer',
        'ant-design-vue',
        /^ant-design-vue\//,
        'vue',
      ],
    },
  },
})
