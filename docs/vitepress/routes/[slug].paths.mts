import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/component-manifest.ts'
import { createComponentRoutePaths } from '../scripts/component-routes.mts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

export default {
  paths() {
    return createComponentRoutePaths({ root, components: documentedComponents }).paths
  },
}
