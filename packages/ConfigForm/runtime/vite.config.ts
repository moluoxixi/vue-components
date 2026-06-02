import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vitest/config'
import { failOnDtsDiagnostics } from '../../../scripts/fail-on-dts-diagnostics.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    Vue(),
    dts({
      afterDiagnostic: failOnDtsDiagnostics,
      compilerOptions: {
        composite: false,
        incremental: false,
        tsBuildInfoFile: undefined,
      },
      processor: 'vue',
      tsconfigPath: resolve(__dirname, 'tsconfig.app.json'),
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      all: true,
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'src/styles/**',
        'src/types/**',
        'src/**/types/**',
        'src/**/types.ts',
        'src/runtime/types.ts',
        'src/**/index.ts',
      ],
      // 只包含类型声明的模块没有可执行路径，V8 覆盖率不应统计它们。
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'index.ts'),
        plugins: resolve(__dirname, 'src/plugins/index.ts'),
      },
      name: 'ConfigForm',
      /**
       * 固定库构建入口的文件名。
       *
       * 多入口产物直接使用入口名，避免生成带 package 名的额外层级。
       */
      fileName: (_, entryName) => `${entryName}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', 'zod'],
      output: {
        globals: {
          vue: 'Vue',
          zod: 'Zod',
        },
      },
    },
  },
})
