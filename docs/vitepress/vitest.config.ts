import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@docs-components': fileURLToPath(new URL('../../packages/components/index.ts', import.meta.url)),
    },
  },
  test: {
    include: [
      '.vitepress/**/*.test.ts',
      'scripts/__tests__/**/*.test.ts',
    ],
  },
})
