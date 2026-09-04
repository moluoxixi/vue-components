import * as rootEntry from '@moluoxixi/vite-config'
import * as addonsEntry from '@moluoxixi/vite-config/addons'
import * as autoImportEntry from '@moluoxixi/vite-config/addons/auto-import'
import * as componentsEntry from '@moluoxixi/vite-config/addons/components'
import * as devtoolsEntry from '@moluoxixi/vite-config/addons/devtools'
import * as i18nEntry from '@moluoxixi/vite-config/addons/i18n'
import * as layoutsEntry from '@moluoxixi/vite-config/addons/layouts'
import * as markdownEntry from '@moluoxixi/vite-config/addons/markdown'
import * as pagesEntry from '@moluoxixi/vite-config/addons/pages'
import * as pwaEntry from '@moluoxixi/vite-config/addons/pwa'
import * as reactEntry from '@moluoxixi/vite-config/addons/react'
import * as tailwindcssEntry from '@moluoxixi/vite-config/addons/tailwindcss'
import * as unocssEntry from '@moluoxixi/vite-config/addons/unocss'
import * as viteSsgEntry from '@moluoxixi/vite-config/addons/vite-ssg'
import * as vitestEntry from '@moluoxixi/vite-config/addons/vitest'
import * as vueEntry from '@moluoxixi/vite-config/addons/vue'
import * as vueRouterEntry from '@moluoxixi/vite-config/addons/vue-router'
import { describe, expect, it } from 'vitest'

const addonEntries = [
  ['defineAutoImportAddonOptions', autoImportEntry],
  ['defineComponentsAddonOptions', componentsEntry],
  ['defineDevtoolsAddonOptions', devtoolsEntry],
  ['defineI18nAddonOptions', i18nEntry],
  ['defineVueLayoutsAddonOptions', layoutsEntry],
  ['defineMarkdownAddonOptions', markdownEntry],
  ['definePagesAddonOptions', pagesEntry],
  ['definePwaAddonOptions', pwaEntry],
  ['defineReactAddonOptions', reactEntry],
  ['defineTailwindCssAddonOptions', tailwindcssEntry],
  ['defineUnoCssAddonOptions', unocssEntry],
  ['defineViteSsgAddonOptions', viteSsgEntry],
  ['defineVitestAddonOptions', vitestEntry],
  ['defineVueAddonOptions', vueEntry],
  ['defineVueRouterAddonOptions', vueRouterEntry],
] as const

describe('addon public subpaths', () => {
  it.each(addonEntries)('keeps %s identical across root, aggregate and leaf entries', (helper, leafEntry) => {
    const root = rootEntry as Record<string, unknown>
    const addons = addonsEntry as Record<string, unknown>
    const leaf = leafEntry as Record<string, unknown>

    expect(Object.keys(leaf)).toEqual([helper])
    expect(addons[helper]).toBe(leaf[helper])
    expect(root[helper]).toBe(leaf[helper])
  })

  it('exports only the stable helper set from the aggregate addon entry', () => {
    expect(Object.keys(addonsEntry).sort()).toEqual(addonEntries.map(([helper]) => helper).sort())
  })
})
