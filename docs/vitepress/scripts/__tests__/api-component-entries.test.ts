import { describe, expect, it } from 'vitest'
import { documentedApiComponentEntries } from '../../.vitepress/catalog/component-manifest'

describe('api component entries', () => {
  it('extracts regular components and the standalone rich-text editor package', () => {
    expect(documentedApiComponentEntries).toEqual([
      'packages/components/index.ts',
      'packages/rich-text-editor/index.ts',
    ])
  })
})
