import { describe, expect, it } from 'vitest'
import { getDocsMessages } from '../docs-i18n'
import { docsSite } from '../docs-site'
import { resolveDocsComponentMeta } from './content'

describe('docs component metadata', () => {
  it('uses the authoring package for RichTextEditor repository actions', () => {
    const metadata = resolveDocsComponentMeta({
      hasSourceDoc: true,
      link: path => path,
      locale: 'en-US',
      messages: getDocsMessages('en-US'),
      name: 'RichTextEditor',
      slug: 'rich-text-editor',
    })

    expect(metadata.sourceHref).toBe(
      `${docsSite.repositories.github.url}/tree/main/packages/rich-text-editor`,
    )
    expect(metadata.editHref).toBe(
      `${docsSite.repositories.github.url}/edit/main/packages/rich-text-editor/docs/index.en.md`,
    )
  })
})
