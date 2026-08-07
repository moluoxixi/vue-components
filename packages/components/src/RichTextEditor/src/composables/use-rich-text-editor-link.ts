import type { Editor } from '@tiptap/core'
import type { Ref } from 'vue'
import { nextTick, shallowRef, useTemplateRef } from 'vue'
import { normalizeHref } from '../utils'

export function useRichTextEditorLink(editor: Ref<Editor | null | undefined>) {
  const linkPanelVisible = shallowRef(false)
  const linkHref = shallowRef('')
  const linkInputRef = useTemplateRef<HTMLInputElement>('linkInputRef')

  async function openLinkPanel(): Promise<void> {
    const editorInstance = editor.value
    if (!editorInstance)
      return

    linkHref.value = editorInstance.getAttributes('link').href ?? ''
    linkPanelVisible.value = true
    await nextTick()
    linkInputRef.value?.focus()
    linkInputRef.value?.select()
  }

  function closeLinkPanel(): void {
    linkPanelVisible.value = false
  }

  function applyLink(): void {
    const href = normalizeHref(linkHref.value)
    const chain = editor.value?.chain().focus().extendMarkRange('link')

    if (!chain)
      return
    if (href)
      chain.setLink({ href }).run()
    else
      chain.unsetLink().run()

    closeLinkPanel()
  }

  function removeLink(): void {
    editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
    linkHref.value = ''
    closeLinkPanel()
  }

  return {
    applyLink,
    closeLinkPanel,
    linkHref,
    linkPanelVisible,
    openLinkPanel,
    removeLink,
  }
}
