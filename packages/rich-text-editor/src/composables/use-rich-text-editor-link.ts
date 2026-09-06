import type { Editor } from '@tiptap/core'
import type { Ref } from 'vue'
import { nextTick, shallowRef } from 'vue'
import { normalizeHref } from '../utils'

export function useRichTextEditorLink(editor: Ref<Editor | null | undefined>) {
  const linkPanelVisible = shallowRef(false)
  const linkHref = shallowRef('')
  const linkInputRef = shallowRef<HTMLInputElement | null>(null)

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

  function setLinkInputRef(element: unknown): void {
    linkInputRef.value = element instanceof HTMLInputElement ? element : null
  }

  return {
    applyLink,
    closeLinkPanel,
    linkHref,
    linkInputRef,
    setLinkInputRef,
    linkPanelVisible,
    openLinkPanel,
    removeLink,
  }
}
