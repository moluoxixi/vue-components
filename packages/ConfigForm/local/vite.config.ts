import { resolve } from 'node:path'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vitest/config'
import { failOnDtsDiagnostics } from '../../../scripts/fail-on-dts-diagnostics.mjs'

export default defineConfig({
  plugins: [dts({ tsconfigPath: resolve(import.meta.dirname, 'tsconfig.json'), exclude: ['**/__tests__/**'], afterDiagnostic: failOnDtsDiagnostics })],

  build: {
    target: 'node22',
    lib: { entry: { index: resolve(import.meta.dirname, 'index.ts'), cli: resolve(import.meta.dirname, 'src/cli/index.ts'), mcp: resolve(import.meta.dirname, 'src/mcp/index.ts') }, formats: ['es'] },
    rollupOptions: { external: [/^node:/, /^@moluoxixi\//, /^@modelcontextprotocol\//, /^@ai-sdk\//, 'ai', 'zod', 'fflate'] },
  },
  test: { alias: [
    { find: /^@moluoxixi\/config-form-studio\/client$/, replacement: resolve(import.meta.dirname, '../studio/src/client/index.ts') },
  ], include: ['__tests__/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 30_000 },
})
