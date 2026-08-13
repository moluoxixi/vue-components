import { describe, expect, it, vi } from 'vitest'

const loadRichTextEditor = vi.hoisted(() => vi.fn())

vi.mock('@moluoxixi/rich-text-editor', () => {
  loadRichTextEditor()
  throw new Error('The components root entry loaded RichTextEditor eagerly')
})

describe('components root entry', () => {
  it('exposes the compatibility component without loading its Tiptap package', async () => {
    const components = await import('../index')

    expect(components.RichTextEditor).toBeDefined()
    expect(components.ConfigTable).toBeDefined()
    expect(loadRichTextEditor).not.toHaveBeenCalled()
  }, 15000)
})
