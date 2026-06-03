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
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      all: true,
      include: ['src/**/*.ts'],
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
  build: {
    lib: {
      entry: {
        adapter: resolve(__dirname, 'src/adapter.ts'),
        client: resolve(__dirname, 'src/client.ts'),
        index: resolve(__dirname, 'index.ts'),
      },
      /**
       * 固定 devtools 多入口构建产物名称。
       *
       * 入口名直接映射到文件名，方便虚拟模块按 adapter/client/index 精确引用。
       */
      fileName: (_, entryName) => `${entryName}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        '@babel/parser',
        '@vue/compiler-sfc',
        'magic-string',
        'node:buffer',
        'node:child_process',
        'node:crypto',
        'node:fs',
        'node:module',
        'node:path',
        'node:process',
        'node:url',
        'vite',
        'vue',
      ],
    },
  },
})
