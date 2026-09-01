import Vue from '@vitejs/plugin-vue'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
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
        inline: [/element-plus\/(?:es\/components\/.*\/style\/css|theme-chalk)/],
      },
    },
  },
})
