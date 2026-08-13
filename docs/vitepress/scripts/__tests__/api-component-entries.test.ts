import { describe, expect, it } from 'vitest'
import { docsSite } from '../../.vitepress/docs-site'

describe('api component entries', () => {
  it('extracts regular components and the standalone rich-text editor package', () => {
    expect(docsSite.apiComponentEntries).toEqual([
      docsSite.componentEntry,
      'packages/rich-text-editor/index.ts',
    ])
  })
})
