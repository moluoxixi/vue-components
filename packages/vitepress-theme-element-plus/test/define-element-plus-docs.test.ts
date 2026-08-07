import type { MarkdownRenderer } from 'vitepress'
import type { ElementPlusDocsOptions } from '../index'
import { describe, expect, it, vi } from 'vitest'
import { defineElementPlusDocs } from '../index'

describe('defineElementPlusDocs', () => {
  it('creates an independent theme config from the minimal contract', () => {
    const config = defineElementPlusDocs({
      site: { title: 'Fixture' },
    })
    expect(config.title).toBe('Fixture')
    expect(config.themeConfig).toMatchObject({ siteTitle: 'Fixture' })
  })

  it('installs the upstream heading extractor before consumer markdown plugins', () => {
    const consumerPlugin = vi.fn()
    const config = defineElementPlusDocs({
      site: { title: 'Fixture' },
      vitepress: {
        markdown: {
          config(md) {
            md.use(consumerPlugin)
          },
        },
      },
    })
    const use = vi.fn()
    const md = { use } as unknown as MarkdownRenderer

    config.markdown?.config?.(md)

    expect(use).toHaveBeenCalledTimes(2)
    expect(use.mock.calls[0][0]).not.toBe(consumerPlugin)
    expect(use.mock.calls[1][0]).toBe(consumerPlugin)
  })

  it('allows consumers to disable the upstream heading extractor', () => {
    const config = defineElementPlusDocs({
      site: { title: 'Fixture' },
      vitepress: { markdown: { headers: false } },
    })
    const use = vi.fn()
    const md = { use } as unknown as MarkdownRenderer

    config.markdown?.config?.(md)

    expect(use).not.toHaveBeenCalled()
    expect(config.markdown?.headers).toBe(false)
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
