import {
  defineAutoImportAddonOptions,
  defineComponentsAddonOptions,
  defineDevtoolsAddonOptions,
  defineI18nAddonOptions,
  defineMarkdownAddonOptions,
  definePwaAddonOptions,
  defineReactAddonOptions,
  defineTailwindCssAddonOptions,
  defineUnoCssAddonOptions,
  defineViteSsgAddonOptions,
  defineVitestAddonOptions,
  defineVueAddonOptions,
  defineVueLayoutsAddonOptions,
  defineVueRouterAddonOptions,
} from '@moluoxixi/vite-config'
import { describe, expect, it } from 'vitest'

describe('addon public entry', () => {
  it('exports every addon option helper from the root entry', () => {
    expect(defineAutoImportAddonOptions({ imports: ['vue'] })).toEqual({ imports: ['vue'] })
    expect(defineComponentsAddonOptions({ extensions: ['vue'] })).toEqual({ extensions: ['vue'] })
    expect(defineDevtoolsAddonOptions({ launchEditor: 'code' })).toEqual({ launchEditor: 'code' })
    expect(defineI18nAddonOptions({ include: ['src/locales/**'] })).toEqual({ include: ['src/locales/**'] })
    expect(defineMarkdownAddonOptions({ markdownItOptions: { html: true } })).toEqual({ markdownItOptions: { html: true } })
    expect(definePwaAddonOptions({ registerType: 'autoUpdate' })).toEqual({ registerType: 'autoUpdate' })
    expect(defineReactAddonOptions({ jsxRuntime: 'automatic' })).toEqual({ jsxRuntime: 'automatic' })
    expect(defineTailwindCssAddonOptions({ optimize: { minify: true } })).toEqual({ optimize: { minify: true } })
    expect(defineUnoCssAddonOptions('uno.config.ts')).toBe('uno.config.ts')
    expect(defineViteSsgAddonOptions({ ssgOptions: { formatting: 'minify' } })).toEqual({ ssgOptions: { formatting: 'minify' } })
    expect(defineVitestAddonOptions({ environment: 'jsdom' })).toEqual({ environment: 'jsdom' })
    expect(defineVueAddonOptions({ include: /\.vue$/ })).toEqual({ include: /\.vue$/ })
    expect(defineVueLayoutsAddonOptions({ layoutsDirs: 'src/layouts' })).toEqual({ layoutsDirs: 'src/layouts' })
    expect(defineVueRouterAddonOptions({ routesFolder: 'src/pages' })).toEqual({ routesFolder: 'src/pages' })
  })
})
