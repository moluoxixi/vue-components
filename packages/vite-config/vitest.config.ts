import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@moluoxixi/utils/node',
        replacement: fileURLToPath(new URL('../utils/src/node.ts', import.meta.url)),
      },
      {
        find: /^@moluoxixi\/vite-config\/config\/(.*)$/,
        replacement: `${fileURLToPath(new URL('./src/config', import.meta.url))}/$1`,
      },
      {
        find: '@moluoxixi/vite-config/addons',
        replacement: fileURLToPath(new URL('./src/addons/index.ts', import.meta.url)),
      },
      {
        find: '@moluoxixi/vite-config',
        replacement: fileURLToPath(new URL('./index.ts', import.meta.url)),
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
