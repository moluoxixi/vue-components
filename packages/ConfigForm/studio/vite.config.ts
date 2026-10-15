import { resolve } from 'node:path'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vitest/config'
import { failOnDtsDiagnostics } from '../../../scripts/fail-on-dts-diagnostics.mjs'

export default defineConfig({
  plugins: [dts({ tsconfigPath: resolve(import.meta.dirname, 'tsconfig.json'), exclude: ['**/__tests__/**'], afterDiagnostic: failOnDtsDiagnostics })],
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  build: {
    lib: { entry: { index: resolve(import.meta.dirname, 'index.ts'), client: resolve(import.meta.dirname, 'src/client/index.ts') }, formats: ['es'] },
    rollupOptions: { external: [/^@moluoxixi\//] },
  },
})
