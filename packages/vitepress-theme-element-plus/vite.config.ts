import type { OutputAsset, OutputChunk } from 'rollup'
import type { Plugin } from 'vite'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import dts from 'unplugin-dts/vite'
import { configDefaults, defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))
const themeStylesMarker = '__MOLUOXIXI_THEME_STYLES__'

function injectBuiltThemeStyles(): Plugin {
  return {
    name: 'moluoxixi-inject-built-theme-styles',
    enforce: 'post',
    generateBundle(_, bundle) {
      const cssAsset = Object.values(bundle).find((output): output is OutputAsset => (
        output.type === 'asset' && output.fileName.endsWith('vitepress-theme-element-plus.css')
      ))
      if (!cssAsset)
        this.error('Theme CSS asset was not emitted')

      let replacements = 0
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk')
          continue
        const chunk = output as OutputChunk
        const cssPath = relative(dirname(chunk.fileName), cssAsset.fileName).replaceAll('\\', '/')
        const cssImport = cssPath.startsWith('.') ? cssPath : `./${cssPath}`
        chunk.code = chunk.code.replace(
          new RegExp(`Promise\\.resolve\\((["'])${themeStylesMarker}\\1\\)`, 'g'),
          () => {
            replacements += 1
            return `import(${JSON.stringify(cssImport)})`
          },
        )
      }
      if (replacements !== 1) {
        this.error(`Expected one theme CSS marker, replaced ${replacements}`)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    Vue(),
    injectBuiltThemeStyles(),
    dts({
      exclude: ['**/*.test.ts', '**/fixtures/**'],
      compilerOptions: { composite: false, incremental: false, tsBuildInfoFile: undefined },
      processor: 'vue',
      tsconfigPath: resolve(__dirname, 'tsconfig.app.json'),
    }),
  ],
  resolve: {
    alias: [{ find: '~', replacement: resolve(__dirname, 'src/upstream/vitepress') }],
    conditions: ['source'],
  },
  test: {
    environment: 'happy-dom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    alias: {
      'virtual:moluoxixi-element-plus-docs-consumer-styles': resolve(__dirname, 'test/empty-styles.ts'),
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'index.ts'),
        markdown: resolve(__dirname, 'markdown.ts'),
      },
      name: 'MoluoxixiElementPlusDocs',
      fileName: (_, entryName) => `${entryName}.js`,
      cssFileName: 'vitepress-theme-element-plus',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'vue',
        'vitepress',
        /^vitepress\//,
        'element-plus',
        /^element-plus\//,
        '@vueuse/core',
        'nprogress',
        'normalize.css',
        'markdown-it-container',
        'typescript',
        'virtual:moluoxixi-element-plus-docs-consumer-styles',
        /^node:/,
      ],
      output: {
        inlineDynamicImports: false,
      },
    },
  },
})
