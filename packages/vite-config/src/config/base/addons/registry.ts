import type { ViteFeature } from './runtime'
import { autoImportFeature } from './auto-import'
import { componentsFeature } from './components'
import { devtoolsFeature } from './devtools'
import { i18nFeature } from './i18n'
import { markdownFeature } from './markdown'
import { pwaFeature } from './pwa'
import { reactFeature } from './react'
import { tailwindcssFeature } from './tailwindcss'
import { unocssFeature } from './unocss'
import { viteSsgFeature } from './vite-ssg'
import { vitestFeature } from './vitest'
import { vueFeature } from './vue'
import { vueLayoutsFeature } from './vue-layouts'
import { vueRouterFeature } from './vue-router'

const features = [
  vueFeature,
  reactFeature,
  unocssFeature,
  tailwindcssFeature,
  vueRouterFeature,
  vueLayoutsFeature,
  autoImportFeature,
  componentsFeature,
  i18nFeature,
  devtoolsFeature,
  pwaFeature,
  markdownFeature,
  vitestFeature,
  viteSsgFeature,
]

export const viteFeatures = features.sort((a, b) => a.order - b.order) as ViteFeature<any, any>[]
