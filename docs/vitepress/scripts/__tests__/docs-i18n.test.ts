// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { documentedComponentNames } from '../../.vitepress/component-manifest'
import {
  formatDocsMessage,
  getDocsMessages,
  getLocalizedComponents,
  localePath,
  resolveDocsLocale,
} from '../../.vitepress/docs-i18n'

describe('documentation internationalization', () => {
  it('keeps component identities stable across locales', () => {
    expect(getLocalizedComponents('en-US').map(component => component.name))
      .toEqual(documentedComponentNames)
    expect(getLocalizedComponents('en-US').find(component => component.name === 'CopyText')?.description)
      .toBe('Copy actions with built-in status feedback')
  })

  it('resolves locale paths without changing default URLs', () => {
    expect(resolveDocsLocale('en-GB')).toBe('en-US')
    expect(resolveDocsLocale('zh-CN')).toBe('zh-CN')
    expect(resolveDocsLocale(undefined, 'en')).toBe('en-US')
    expect(localePath('zh-CN', '/components/')).toBe('/components/')
    expect(localePath('en-US', '/components/')).toBe('/en/components/')
  })

  it('formats generated UI messages for both locales', () => {
    expect(formatDocsMessage(getDocsMessages('zh-CN').contributors.contribution, { name: 'CopyText', count: 3 }))
      .toBe('为 CopyText 贡献 3 次提交')
    expect(formatDocsMessage(getDocsMessages('en-US').contributors.contribution, { name: 'CopyText', count: 3 }))
      .toBe('3 commits to CopyText')
  })
})
