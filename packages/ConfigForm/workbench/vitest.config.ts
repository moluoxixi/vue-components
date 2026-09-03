import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vitest/config'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const elementPlusTheme = resolve(currentDirectory, 'src/styles/element-plus/theme.scss').replaceAll('\\', '/')

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "${elementPlusTheme}" as *;`,
      },
    },
  },
  plugins: [
    Vue(),
    Components({
      dirs: [],
      dts: false,
      resolvers: [ElementPlusResolver({ importStyle: false })],
    }),
  ],
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    server: {
      deps: {
        inline: [/element-plus\/(?:es\/components\/.*\/style\/index|theme-chalk)/],
      },
    },
  },
})
