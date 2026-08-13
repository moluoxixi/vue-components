import { RichTextEditor as ExtractedRichTextEditor } from '@moluoxixi/rich-text-editor'
import { describe, expect, it } from 'vitest'
import { RichTextEditor as CompatibilityRichTextEditor } from '../RichTextEditor'

describe('richTextEditor compatibility entry', () => {
  it('re-exports the extracted component unchanged', () => {
    expect(CompatibilityRichTextEditor).toBe(ExtractedRichTextEditor)
  })
})
