import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vitest/config'
import { failOnDtsDiagnostics } from '../../scripts/fail-on-dts-diagnostics.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
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
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/ui/**'],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
      },
    },
  },
  build: {
    lib: {
      entry: {
        cli: resolve(__dirname, 'cli.ts'),
        config: resolve(__dirname, 'config.ts'),
        core: resolve(__dirname, 'core.ts'),
        index: resolve(__dirname, 'index.ts'),
        protocol: resolve(__dirname, 'protocol.ts'),
        server: resolve(__dirname, 'server.ts'),
      },
      formats: ['es'],
      fileName: (_, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        /^@moluoxixi\/ai-provider(?:\/|$)/,
        'ai',
        'jiti',
        'vite',
        'zod',
        /^node:/,
      ],
    },
  },
})
