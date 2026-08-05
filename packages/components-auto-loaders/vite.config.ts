import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vitest/config'
import { failOnDtsDiagnostics } from '../../scripts/fail-on-dts-diagnostics.mjs'

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
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      all: true,
      include: ['src/**/*.ts'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'index.ts'),
      name: 'MoluoxixiComponentsAutoLoaders',
      fileName: 'index',
      formats: ['es'],
    },
  },
})
