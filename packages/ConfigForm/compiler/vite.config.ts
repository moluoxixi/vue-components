import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vitest/config'
import { failOnDtsDiagnostics } from '../../../scripts/fail-on-dts-diagnostics.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    dts({
      afterDiagnostic: failOnDtsDiagnostics,
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      compilerOptions: {
        composite: false,
        incremental: false,
        tsBuildInfoFile: undefined,
      },
      tsconfigPath: resolve(__dirname, 'tsconfig.app.json'),
    }),
  ],
  resolve: {
    conditions: ['source'],
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'index.ts'),
      name: 'ConfigFormCompiler',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        '@moluoxixi/config-form-core',
        '@moluoxixi/config-form-model',
      ],
    },
  },
})
