// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  documentedComponentNames,
  documentedUtilityPackageNames,
  formatDocsMessage,
  getDocsMessages,
  getLocalizedComponents,
  getLocalizedUtilities,
  localePath,
  resolveDocsLocale,
} from '../../.vitepress/catalog'
import { docsLocales } from '../../.vitepress/site/config'

describe('documentation internationalization', () => {
  it('keeps component identities stable across locales', () => {
    expect(getLocalizedComponents('en-US').map(component => component.name))
      .toEqual(documentedComponentNames)
    expect(getLocalizedComponents('en-US').find(component => component.name === 'CopyText')?.description)
      .toBe('Copy actions with built-in status feedback')
  })

  it('publishes utility detail routes only for locales with explicit sources', () => {
    expect(getLocalizedUtilities('en-US').map(utility => utility.packageName))
      .toEqual([])
    expect(getLocalizedUtilities('zh-CN').map(utility => utility.packageName))
      .toEqual(documentedUtilityPackageNames)
    expect(getLocalizedUtilities('zh-CN').every(utility => utility.sourcePath.endsWith('/README.md')))
      .toBe(true)
  })

  it('resolves locale paths without changing default URLs', () => {
    expect(resolveDocsLocale('en-GB')).toBe('en-US')
    expect(resolveDocsLocale('zh-CN')).toBe('zh-CN')
    expect(resolveDocsLocale(undefined, 'en')).toBe('en-US')
    expect(localePath('zh-CN', '/components/')).toBe('/components/')
    expect(localePath('en-US', '/components/')).toBe('/en/components/')
    expect(localePath('zh-CN', '/utils/')).toBe('/utils/')
    expect(localePath('en-US', '/utils/')).toBe('/en/utils/')
  })

  it('keeps authoring directories separate from public locale paths', () => {
    expect(docsLocales['zh-CN']).toMatchObject({
      pathPrefix: '',
      sourceDirectory: 'zh',
    })
    expect(docsLocales['en-US']).toMatchObject({
      pathPrefix: '/en',
      sourceDirectory: 'en',
    })
  })

  it('formats generated UI messages for both locales', () => {
    expect(formatDocsMessage(getDocsMessages('zh-CN').contributors.contribution, { name: 'CopyText', count: 3 }))
      .toBe('为 CopyText 贡献 3 次提交')
    expect(formatDocsMessage(getDocsMessages('en-US').contributors.contribution, { name: 'CopyText', count: 3 }))
      .toBe('3 commits to CopyText')
  })
})
