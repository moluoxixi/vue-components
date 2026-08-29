import { describe, expect, it } from 'vitest'
import {
  createWorkbenchLocaleOptions,
  readWorkbenchLocalePreference,
  resolveWorkbenchLocale,
  WORKBENCH_EN_US_MESSAGES,
  WORKBENCH_LOCALE_STORAGE_KEY,
  WORKBENCH_ZH_CN_MESSAGES,
  writeWorkbenchLocalePreference,
} from '..'

describe('workbench locale', () => {
  it('keeps the built-in catalog keys in exact parity', () => {
    expect(Object.keys(WORKBENCH_ZH_CN_MESSAGES).sort()).toEqual(
      Object.keys(WORKBENCH_EN_US_MESSAGES).sort(),
    )
  })

  it('merges adapter materials before caller overrides', () => {
    const options = createWorkbenchLocaleOptions(
      'zh-CN',
      {
        locale: 'zh-CN',
        materials: { 'element.input': { title: '输入框' } },
        messages: { 'adapter.message': '适配器' },
      },
      {
        materials: { 'element.input': { title: '自定义输入' } },
        messages: { 'adapter.message': '调用方' },
      },
    )

    expect(options.locale).toBe('zh-CN')
    expect(options.materials?.['element.input']?.title).toBe('自定义输入')
    expect(options.messages?.['adapter.message']).toBe('调用方')
    expect(options.messages?.['preview.title']).toBe('预览')
  })

  it('normalizes locale values and tolerates blocked storage', () => {
    expect(resolveWorkbenchLocale('zh-Hans')).toBe('zh-CN')
    expect(resolveWorkbenchLocale('en-GB')).toBe('en-US')
    expect(readWorkbenchLocalePreference({
      getItem: () => 'zh-CN',
    })).toBe('zh-CN')
    expect(readWorkbenchLocalePreference({
      getItem: () => { throw new Error('blocked') },
    })).toBeUndefined()
    expect(() => writeWorkbenchLocalePreference('en-US', {
      setItem: (key, value) => {
        expect(key).toBe(WORKBENCH_LOCALE_STORAGE_KEY)
        expect(value).toBe('en-US')
        throw new Error('blocked')
      },
    })).not.toThrow()
  })
})
