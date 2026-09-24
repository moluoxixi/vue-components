import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [Vue()],
  resolve: {
    conditions: ['source'],
  },
  test: {
    environment: 'node',
  },
})
