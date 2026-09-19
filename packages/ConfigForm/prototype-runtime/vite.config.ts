import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vitest/config'
import { failOnDtsDiagnostics } from '../../../scripts/fail-on-dts-diagnostics.mjs'

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
  resolve: {
    conditions: ['source'],
  },
  ssr: {
    resolve: { conditions: ['source'] },
  },
  test: {
    environment: 'happy-dom',
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'index.ts'),
        session: resolve(__dirname, 'src/session/index.ts'),
        vue: resolve(__dirname, 'src/vue/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        '@moluoxixi/config-form-compiler',
        '@moluoxixi/config-form-core',
        'vue',
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
})
