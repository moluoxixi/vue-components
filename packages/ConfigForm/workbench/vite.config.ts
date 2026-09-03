import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const elementPlusTheme = resolve(currentDirectory, 'src/styles/element-plus/theme.scss').replaceAll('\\', '/')

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
  plugins: [
    Vue(),
    Components({
      dirs: [],
      dts: resolve(currentDirectory, 'src/components.d.ts'),
      resolvers: [ElementPlusResolver({ importStyle: 'sass' })],
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "${elementPlusTheme}" as *;`,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(currentDirectory, 'src'),
    },
  },
})
