import { describe, expect, it } from 'vitest'
import { getDocsMessages } from '../catalog/docs-i18n'
import { docsRepository } from '../site/repository-config'
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
      `${docsRepository.url}/tree/main/packages/rich-text-editor`,
    )
    expect(metadata.editHref).toBe(
      `${docsRepository.url}/edit/main/packages/rich-text-editor/docs/index.en.md`,
    )
    expect(metadata.importStatement).toBe(
      'import { RichTextEditor } from \'@moluoxixi/rich-text-editor\';',
    )
  })
})
