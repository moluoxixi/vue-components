import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getLocalizedComponents } from '../../.vitepress/docs-i18n.ts'
import { createComponentRouteLocaleOptions, createComponentRoutePaths } from '../../scripts/component-routes.mts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

export default {
  paths() {
    return createComponentRoutePaths({
      root,
      components: getLocalizedComponents('en-US'),
      locale: createComponentRouteLocaleOptions('en-US'),
    }).paths
  },
}
