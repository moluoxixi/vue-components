import { resolve } from 'node:path'
import { build } from 'vite'

await build({
  configFile: resolve(import.meta.dirname, '../vite.ui.config.ts'),
})

console.log('I18N_TOOL_UI_BUILD_DONE')
