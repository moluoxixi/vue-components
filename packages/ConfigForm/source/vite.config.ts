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
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'index.ts'),
        generator: resolve(__dirname, 'src/generator/index.ts'),
        viewer: resolve(__dirname, 'src/viewer/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        '@moluoxixi/config-form-compiler',
        '@moluoxixi/config-form-core',
        '@moluoxixi/config-form-model',
        '@moluoxixi/zod3-to-rule',
        'monaco-editor',
        /^monaco-editor\//,
        'vue',
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
})
