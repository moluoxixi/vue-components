import { describe, expect, it } from 'vitest'
import { resolveLang } from '../src/upstream/vitepress/composables/lang'

const locales = {
  'zh-CN': { label: '简体中文', lang: 'zh-CN', pathPrefix: '', siteKey: 'root' },
  'en-US': { label: 'English', lang: 'en-US', pathPrefix: '/en', siteKey: 'en' },
}

describe('language resolution', () => {
  it('uses the locale index when VitePress has not populated lang yet', () => {
    expect(resolveLang(undefined, 'en', locales, 'zh-CN')).toBe('en-US')
  })

  it('normalizes a site key returned as lang', () => {
    expect(resolveLang('en', undefined, locales, 'zh-CN')).toBe('en-US')
  })
})
