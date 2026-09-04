import { describe, expect, it } from 'vitest'
import { documentedApiComponentEntries } from '../../.vitepress/catalog'

describe('api component entries', () => {
  it('extracts regular components, ConfigForm adapters, and the rich-text editor package', () => {
    expect(documentedApiComponentEntries).toEqual([
      'packages/components/index.ts',
      'packages/ConfigForm/antd/index.ts',
      'packages/ConfigForm/element/index.ts',
      'packages/rich-text-editor/index.ts',
    ])
  })
})
