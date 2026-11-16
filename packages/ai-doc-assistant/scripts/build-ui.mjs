import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// 一次性 UI 构建脚本：调用 Vite build API 后退出（避免 watch/server 误判）。
import { build } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

await build({
  configFile: resolve(__dirname, '..', 'vite.ui.config.ts'),
})
console.log('UI_BUILD_DONE')
process.exit(0)
