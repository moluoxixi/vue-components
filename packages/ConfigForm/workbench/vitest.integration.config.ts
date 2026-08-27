import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    hookTimeout: 300_000,
    include: ['src/project/__integration__/**/*.test.ts'],
    testTimeout: 300_000,
  },
})
