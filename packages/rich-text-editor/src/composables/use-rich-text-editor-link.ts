import type { Editor } from '@tiptap/core'
import type { Ref } from 'vue'
import type { RichTextEditorCommands, RichTextEditorState } from '../types'
import { shallowRef, watch } from 'vue'

export function useRichTextEditorLink(
  editor: Ref<Editor | undefined>,
  commands: RichTextEditorCommands,
  state: Readonly<Ref<RichTextEditorState>>,
  visibleToolbar: Readonly<Ref<boolean>>,
) {
  const linkPanelVisible = shallowRef(false)
  const linkHref = shallowRef('')
  const linkError = shallowRef('')
  let trigger: HTMLElement | null = null

  function openLinkPanel(event?: Event): void {
    if (!state.value.link.enabled || !visibleToolbar.value)
      return
    trigger = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null
    linkHref.value = state.value.link.href
    linkError.value = ''
    linkPanelVisible.value = true
  }

  function closeLinkPanel(restoreFocus = true): void {
    linkPanelVisible.value = false
    linkError.value = ''
    if (restoreFocus) {
      if (trigger?.isConnected)
        trigger.focus()
      else if (editor.value && !editor.value.isDestroyed)
        editor.value.commands.focus()
    }
    trigger = null
  }

  function applyLink(): void {
    const success = linkHref.value.trim() ? commands.setLink(linkHref.value) : commands.removeLink()
    if (!success) {
      linkError.value = '链接无效或当前选区不支持链接'
      return
    }
    closeLinkPanel(false)
  }

  function removeLink(): void {
    if (commands.removeLink())
      closeLinkPanel(false)
  }

  watch([() => state.value.editable, visibleToolbar], ([editable, visible]) => {
    if (!editable || !visible)
      closeLinkPanel(false)
  })
  // External content replacement invalidates a pending link edit's target selection.
  watch(editor, (instance, _previous, onCleanup) => {
    if (!instance)
      return
    const closeOnDocumentChange = ({ transaction }: { transaction: { docChanged: boolean, selectionSet: boolean } }) => {
      if ((transaction.docChanged || transaction.selectionSet) && linkPanelVisible.value)
        closeLinkPanel(false)
    }
    instance.on('transaction', closeOnDocumentChange)
    onCleanup(() => instance.off('transaction', closeOnDocumentChange))
  }, { immediate: true })

  return { applyLink, closeLinkPanel, linkHref, linkError, linkPanelVisible, openLinkPanel, removeLink }
}
