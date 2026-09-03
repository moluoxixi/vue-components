import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { autoComponent, autoImport } from '@moluoxixi/components/auto-loaders'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import { createStableChunksPlugin } from '../../scripts/vite-chunks'

const __dirname = dirname(fileURLToPath(import.meta.url))
const playgroundSource = /[\\/]playgrounds[\\/]components-playground[\\/]src[\\/].*(?:\.[jt]sx?|\.vue(?:\?vue.*)?)$/

export default defineConfig(({ command }) => ({
  base: process.env.COMPONENTS_PLAYGROUND_BASE ?? '/',
  plugins: [
    Vue(),
    VueJsx(),
    AutoImport({
      dts: command === 'serve' ? resolve(__dirname, 'src/auto-imports.d.ts') : false,
      include: [playgroundSource],
      imports: [autoImport],
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      dts: command === 'serve' ? resolve(__dirname, 'src/components.d.ts') : false,
      resolvers: [autoComponent, ElementPlusResolver()],
    }),
    createStableChunksPlugin({
      element: false,
      query: false,
      sfcRuntime: false,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
}))
