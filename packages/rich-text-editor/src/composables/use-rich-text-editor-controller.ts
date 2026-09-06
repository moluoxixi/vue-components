import type { Editor } from '@tiptap/core'
import type {
  RichTextEditorAutofocus,
  RichTextEditorEmits,
  RichTextEditorProps,
} from '../types'
import { useEditor } from '@tiptap/vue-3'
import { computed, shallowRef, watch } from 'vue'
import { createRichTextEditorExtensions } from '../services'
import { getOutputHTML } from '../utils'

export function useRichTextEditorController(
  props: Readonly<RichTextEditorProps>,
  emit: RichTextEditorEmits,
) {
  const toolbarVersion = shallowRef(0)
  const editable = computed(() => !props.disabled && !props.readonly)

  const editor = useEditor({
    autofocus: props.autofocus,
    content: props.modelValue,
    editable: editable.value,
    extensions: createRichTextEditorExtensions({
      extensions: props.extensions,
      placeholder: () => props.placeholder ?? '',
    }),
    editorProps: {
      attributes: createEditorAttributes(props),
    },
    onBlur: ({ editor: editorInstance, event }) => emit('blur', event, editorInstance),
    onFocus: ({ editor: editorInstance, event }) => emit('focus', event, editorInstance),
    onSelectionUpdate: () => {
      toolbarVersion.value += 1
    },
    onTransaction: () => {
      toolbarVersion.value += 1
    },
    onUpdate: ({ editor: editorInstance }) => {
      const value = getOutputHTML(editorInstance)
      emit('update:modelValue', value)
      emit('change', value, editorInstance)
    },
  })

  watch(
    () => props.modelValue,
    (value) => {
      const editorInstance = editor.value
      if (!editorInstance || value === getOutputHTML(editorInstance))
        return
      editorInstance.commands.setContent(value || '', { emitUpdate: false })
    },
  )

  watch(editable, (value) => {
    editor.value?.setEditable(value)
  })

  watch(
    () => [props.ariaLabel, props.disabled, props.readonly, props.placeholder] as const,
    () => {
      const editorInstance = editor.value
      if (!editorInstance)
        return
      editorInstance.setOptions({ editorProps: { attributes: createEditorAttributes(props) } })
      editorInstance.view.dispatch(editorInstance.state.tr)
    },
    { immediate: true },
  )

  function focus(position: RichTextEditorAutofocus = 'end'): void {
    editor.value?.commands.focus(position)
  }

  function clearContent(): void {
    editor.value?.commands.clearContent()
  }

  function canUndo(instance: Editor): boolean {
    return instance.can().chain().focus().undo().run()
  }

  function canRedo(instance: Editor): boolean {
    return instance.can().chain().focus().redo().run()
  }

  return {
    canRedo,
    canUndo,
    clearContent,
    editable,
    editor,
    focus,
    toolbarVersion,
  }
}

function createEditorAttributes(props: Readonly<RichTextEditorProps>): Record<string, string> {
  return {
    'aria-disabled': String(props.disabled),
    'aria-label': props.ariaLabel ?? '',
    'aria-multiline': 'true',
    'aria-readonly': String(props.readonly),
    'class': 'mx-rich-text-editor__content',
    'role': 'textbox',
  }
}
