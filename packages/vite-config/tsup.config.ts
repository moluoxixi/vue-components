import { readdirSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { defineConfig } from 'tsup'

const addonEntries = Object.fromEntries(
  readdirSync(new URL('./src/addons/services/', import.meta.url), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name !== 'index.ts' && extname(entry.name) === '.ts')
    .map(entry => [`addons/${basename(entry.name, '.ts')}`, `src/addons/services/${entry.name}`]),
)

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    'index': 'index.ts',
    'addons/index': 'src/addons/index.ts',
    ...addonEntries,
  },
  format: ['esm'],
})
