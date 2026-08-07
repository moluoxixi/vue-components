import type { Editor } from '@tiptap/core'
import type { Ref } from 'vue'
import type { RichTextEditorProps, RichTextEditorToolbarScope } from '../types'
import { computed } from 'vue'

export function useRichTextEditorToolbar(
  editor: Ref<Editor | null | undefined>,
  props: Readonly<RichTextEditorProps>,
  toolbarVersion: Ref<number>,
) {
  const toolbarScope = computed<RichTextEditorToolbarScope | null>(() => {
    void toolbarVersion.value

    return editor.value
      ? {
          disabled: props.disabled ?? false,
          editor: editor.value,
          readonly: props.readonly ?? false,
        }
      : null
  })

  const blockType = computed(() => {
    void toolbarVersion.value
    const editorInstance = editor.value

    if (!editorInstance)
      return 'paragraph'
    if (editorInstance.isActive('heading', { level: 1 }))
      return 'heading-1'
    if (editorInstance.isActive('heading', { level: 2 }))
      return 'heading-2'
    if (editorInstance.isActive('heading', { level: 3 }))
      return 'heading-3'
    return 'paragraph'
  })

  function isActive(name: string, attributes?: Record<string, unknown>): boolean {
    void toolbarVersion.value
    return editor.value?.isActive(name, attributes) ?? false
  }

  function isTextAligned(alignment: 'left' | 'center' | 'right'): boolean {
    void toolbarVersion.value
    return editor.value?.isActive({ textAlign: alignment }) ?? false
  }

  function canRun(command: (editorInstance: Editor) => boolean): boolean {
    void toolbarVersion.value
    return editor.value ? command(editor.value) : false
  }

  function setBlockType(event: Event): void {
    const value = (event.target as HTMLSelectElement).value
    const chain = editor.value?.chain().focus()

    if (!chain)
      return
    if (value === 'paragraph') {
      chain.setParagraph().run()
      return
    }

    const level = Number(value.split('-')[1]) as 1 | 2 | 3
    chain.toggleHeading({ level }).run()
  }

  return {
    blockType,
    canRun,
    isActive,
    isTextAligned,
    setBlockType,
    toolbarScope,
  }
}
