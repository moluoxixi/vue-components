import type { Extensions } from '@tiptap/core'
import { flattenExtensions } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import StarterKit from '@tiptap/starter-kit'
import { isAllowedHref } from '../utils'

export interface RichTextEditorExtensionOptions {
  extensions?: Extensions
  placeholder: () => string
}

export function createRichTextEditorExtensions(options: RichTextEditorExtensionOptions): Extensions {
  const extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
        defaultProtocol: 'https',
        openOnClick: false,
        isAllowedUri: isAllowedHref,
      },
      trailingNode: false,
    }),
    Placeholder.configure({ placeholder: options.placeholder }),
    TextAlign.configure({ alignments: ['left', 'center', 'right'], types: ['heading', 'paragraph'] }),
    ...(options.extensions ?? []),
  ]
  const names = new Set<string>()
  for (const extension of flattenExtensions(extensions)) {
    if (names.has(extension.name))
      throw new Error(`Duplicate rich text extension: ${extension.name}`)
    names.add(extension.name)
  }
  return extensions
}
