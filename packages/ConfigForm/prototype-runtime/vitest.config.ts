import { resolve } from 'node:path'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [Vue()],
  resolve: {
    alias: {
      '@moluoxixi/config-form-core': resolve(import.meta.dirname, '../core/index.ts'),
    },
  },
  test: {
    environment: 'happy-dom',
  },
})
