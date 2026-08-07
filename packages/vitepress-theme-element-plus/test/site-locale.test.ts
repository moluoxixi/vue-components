import { describe, expect, it } from 'vitest'
import { localeHomePath, switchLocalePath } from '../src/upstream/vitepress/composables/site-locale'

const locales = {
  'zh-CN': { label: '简体中文', lang: 'zh-CN', pathPrefix: '', siteKey: 'root' },
  'en-US': { label: 'English', lang: 'en-US', pathPrefix: '/en', siteKey: 'en' },
}

describe('site locale routes', () => {
  it('uses the configured root locale home', () => {
    expect(localeHomePath('zh-CN', locales)).toBe('/')
    expect(localeHomePath('en-US', locales)).toBe('/en/')
  })

  it('switches locale prefixes without changing the page path', () => {
    expect(switchLocalePath('/components/button', 'zh-CN', 'en-US', locales)).toBe('/en/components/button')
    expect(switchLocalePath('/en/components/button', 'en-US', 'zh-CN', locales)).toBe('/components/button')
  })
})
