import { defineConfig } from 'vitest/config'
import workbenchConfig from './vitest.config'

export default defineConfig({
  ...workbenchConfig,
  test: {
    ...workbenchConfig.test,
    hookTimeout: 300_000,
    include: ['src/project/__integration__/**/*.test.ts'],
    server: {
      deps: {
        inline: [/element-plus\/(?:es\/components\/.*\/style\/index|theme-chalk)/],
      },
    },
    testTimeout: 300_000,
  },
})
