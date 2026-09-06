import type { Extension } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import StarterKit from '@tiptap/starter-kit'

export interface RichTextEditorExtensionOptions {
  extensions?: Extension[]
  placeholder: () => string
}

export function createRichTextEditorExtensions(
  options: RichTextEditorExtensionOptions,
): Extension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
        defaultProtocol: 'https',
        openOnClick: false,
      },
      trailingNode: false,
    }),
    Placeholder.configure({ placeholder: options.placeholder }),
    TextAlign.configure({
      alignments: ['left', 'center', 'right'],
      types: ['heading', 'paragraph'],
    }),
    ...(options.extensions ?? []),
  ]
}
