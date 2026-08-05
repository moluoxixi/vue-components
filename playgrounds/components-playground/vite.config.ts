import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { autoComponent } from '@moluoxixi/components/autoComponent'
import { autoImport } from '@moluoxixi/components/autoImport'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const playgroundSource = /[\\/]playgrounds[\\/]components-playground[\\/]src[\\/].*(?:\.[jt]sx?|\.vue(?:\?vue.*)?)$/

export default defineConfig({
  plugins: [
    Vue(),
    VueJsx(),
    AutoImport({
      dts: resolve(__dirname, 'src/auto-imports.d.ts'),
      include: [playgroundSource],
      imports: [autoImport],
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      dts: resolve(__dirname, 'src/components.d.ts'),
      resolvers: [autoComponent, ElementPlusResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
