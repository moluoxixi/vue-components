import type { ElementPlusDocsOptions } from '../index'
import { describe, expect, it } from 'vitest'
import { defineElementPlusDocs } from '../index'

describe('defineElementPlusDocs', () => {
  it('creates an independent theme config from the minimal contract', () => {
    const config = defineElementPlusDocs({
      site: { title: 'Fixture' },
    })
    expect(config.title).toBe('Fixture')
    expect(config.themeConfig).toMatchObject({ siteTitle: 'Fixture' })
  })

  it('fails with field-specific diagnostics for missing site identity', () => {
    expect(() => defineElementPlusDocs({ site: {} } as ElementPlusDocsOptions)).toThrow(/site\.title/)
  })

  it('keeps locale language tags separate from VitePress route keys', () => {
    const config = defineElementPlusDocs({
      site: {
        title: 'Fixture',
        defaultLocale: 'zh-CN',
        locales: {
          'zh-CN': { siteKey: 'root', label: '简体中文', pathPrefix: '' },
          'en-US': { siteKey: 'en', label: 'English', pathPrefix: '/en' },
        },
      },
    })

    expect(Object.keys(config.locales ?? {})).toEqual(['root', 'en'])
    expect(config.locales?.root).toMatchObject({ lang: 'zh-CN' })
    expect(config.locales?.en).toMatchObject({ lang: 'en-US', link: '/en/' })
    expect(config.themeConfig).toMatchObject({
      defaultLocale: 'zh-CN',
      locales: {
        'zh-CN': { pathPrefix: '', siteKey: 'root' },
        'en-US': { pathPrefix: '/en', siteKey: 'en' },
      },
    })
  })

  it('indexes runtime locale metadata by VitePress language tag', () => {
    const config = defineElementPlusDocs({
      site: {
        title: 'Fixture',
        defaultLocale: 'zh',
        locales: {
          zh: { siteKey: 'root', label: '简体中文', lang: 'zh-CN', pathPrefix: '' },
          en: { siteKey: 'en', label: 'English', lang: 'en-US', pathPrefix: '/en' },
        },
      },
    })

    expect(config.themeConfig).toMatchObject({
      defaultLocale: 'zh-CN',
      langs: ['zh-CN', 'en-US'],
      locales: {
        'zh-CN': { pathPrefix: '', siteKey: 'root' },
        'en-US': { pathPrefix: '/en', siteKey: 'en' },
      },
    })
  })

  it('creates an isolated consumer styles module for each config', () => {
    const config = defineElementPlusDocs({
      site: { title: 'Fixture' },
      components: { styles: '@fixture/theme.css' },
    })
    const plugin = config.vite?.plugins?.[0] as {
      resolveId: (id: string) => string | undefined
      load: (id: string) => string | undefined
    }
    const resolved = plugin.resolveId('virtual:moluoxixi-element-plus-docs-consumer-styles')

    expect(resolved).toBe('\0virtual:moluoxixi-element-plus-docs-consumer-styles')
    expect(plugin.load(resolved!)).toContain('import "@fixture/theme.css"')
  })

  it('loads multiple consumer style modules in configuration order', () => {
    const config = defineElementPlusDocs({
      site: { title: 'Fixture' },
      components: { styles: ['@fixture/components.css', '@fixture/docs.css'] },
    })
    const plugin = config.vite?.plugins?.[0] as {
      resolveId: (id: string) => string | undefined
      load: (id: string) => string | undefined
    }
    const resolved = plugin.resolveId('virtual:moluoxixi-element-plus-docs-consumer-styles')

    expect(plugin.load(resolved!)).toBe('import "@fixture/components.css"\nimport "@fixture/docs.css"\n')
  })
})
