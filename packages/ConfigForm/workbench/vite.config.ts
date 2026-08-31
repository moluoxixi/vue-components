import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const currentDirectory = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: process.env.CONFIG_FORM_WORKBENCH_BASE ?? '/',
  build: {
    rollupOptions: {
      input: {
        'index': resolve(currentDirectory, 'index.html'),
        'runtime-host': resolve(currentDirectory, 'runtime-host.html'),
      },
    },
  },
  plugins: [Vue()],
  resolve: {
    alias: {
      '@': resolve(currentDirectory, 'src'),
    },
  },
})
