import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@moluoxixi/utils',
        replacement: fileURLToPath(new URL('../utils/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    coverage: {
      all: true,
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    include: ['test/**/*.test.ts'],
  },
})
