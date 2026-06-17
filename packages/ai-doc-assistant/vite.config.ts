import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * AI 文档与调试助手包构建配置。
 * 多入口库：index（聚合）/ plugin（BFF Vite 插件）/ cli（构建命令）/ protocol（前后端共享类型）。
 * 所有运行时依赖与 node 内置均 external，保持产物精简、由消费方装 peer/依赖。
 */
export default defineConfig({
  plugins: [
    // vue 插件供 vitest 编译 .vue 单测（lib 入口均为 .ts，不受影响）
    vue(),
    dts({
      exclude: ['**/*.test.ts', '**/*.spec.ts', 'tests/**'],
      compilerOptions: {
        composite: false,
        incremental: false,
        tsBuildInfoFile: undefined,
      },
      tsconfigPath: resolve(__dirname, 'tsconfig.app.json'),
    }),
  ],
  test: {
    environment: 'happy-dom',
    // 单测仅扫 __tests__；__e2e__ 由 Playwright 跑（真实浏览器），两套 runner 不混
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
      // 仅统计 src 业务逻辑；薄入口胶水（plugin/cli 入口、纯类型声明）排除：
      // 这些是框架接线/类型，无独立分支逻辑，靠 server 单测间接覆盖更有意义
      include: ['src/**/*.ts'],
      exclude: [
        '**/__tests__/**',
        '**/*.config.ts',
        'dist/**',
        'index.ts',
        'cli.ts',
        'src/core/types.ts',
        'src/server/plugin.ts',
      ],
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'index.ts'),
        plugin: resolve(__dirname, 'src/server/plugin.ts'),
        cli: resolve(__dirname, 'cli.ts'),
        protocol: resolve(__dirname, 'src/shared/protocol.ts'),
      },
      formats: ['es'],
      fileName: (_, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        '@orama/orama',
        '@orama/plugin-data-persistence',
        'vue-component-meta',
        'vue3-sfc-loader',
        'typescript',
        'zod',
        'vite',
        'vue',
        /^node:/,
      ],
    },
  },
})
