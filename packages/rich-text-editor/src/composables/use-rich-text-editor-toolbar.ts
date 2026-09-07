import type { Editor } from '@tiptap/core'
import type { Ref } from 'vue'
import { shallowRef, watch } from 'vue'
import { createRichTextEditorCommands } from '../services'

export function useRichTextEditorToolbar(editor: Ref<Editor | undefined>, editable: Readonly<Ref<boolean>>) {
  const destroyed = new WeakSet<Editor>()
  const { commands, snapshot } = createRichTextEditorCommands(
    () => editor.value && !destroyed.has(editor.value) ? editor.value : undefined,
    () => editable.value,
  )
  const state = shallowRef(snapshot())
  function refresh(): void {
    const next = snapshot()
    // Compare the small UI snapshot, never the whole document on every selection change.
    if (JSON.stringify(next) !== JSON.stringify(state.value))
      state.value = next
  }
  watch(editor, (instance, _previous, onCleanup) => {
    refresh()
    if (!instance || instance.isDestroyed)
      return
    const onDestroy = () => {
      destroyed.add(instance)
      refresh()
    }
    instance.on('transaction', refresh)
    instance.on('update', refresh)
    instance.on('destroy', onDestroy)
    onCleanup(() => {
      instance.off('transaction', refresh)
      instance.off('update', refresh)
      instance.off('destroy', onDestroy)
    })
  }, { immediate: true, flush: 'sync' })
  watch(editable, refresh, { flush: 'post' })
  return { commands, state }
}
