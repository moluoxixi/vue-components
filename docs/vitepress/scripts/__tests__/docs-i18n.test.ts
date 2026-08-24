// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { documentedComponentNames } from '../../.vitepress/catalog/component-manifest'
import {
  formatDocsMessage,
  getDocsMessages,
  getLocalizedComponents,
  getLocalizedUtilities,
  localePath,
  resolveDocsLocale,
} from '../../.vitepress/catalog/docs-i18n'
import { documentedUtilityPackageNames } from '../../.vitepress/catalog/utility-manifest'

describe('documentation internationalization', () => {
  it('keeps component identities stable across locales', () => {
    expect(getLocalizedComponents('en-US').map(component => component.name))
      .toEqual(documentedComponentNames)
    expect(getLocalizedComponents('en-US').find(component => component.name === 'CopyText')?.description)
      .toBe('Copy actions with built-in status feedback')
  })

  it('keeps utility identities stable across locales', () => {
    expect(getLocalizedUtilities('en-US').map(utility => utility.packageName))
      .toEqual(documentedUtilityPackageNames)
    expect(getLocalizedUtilities('en-US').find(utility => utility.packageName === '@moluoxixi/utils')?.description)
      .toBe('Cross-runtime functions and Node.js project manifest utilities')
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

  it('formats generated UI messages for both locales', () => {
    expect(formatDocsMessage(getDocsMessages('zh-CN').contributors.contribution, { name: 'CopyText', count: 3 }))
      .toBe('为 CopyText 贡献 3 次提交')
    expect(formatDocsMessage(getDocsMessages('en-US').contributors.contribution, { name: 'CopyText', count: 3 }))
      .toBe('3 commits to CopyText')
  })
})
