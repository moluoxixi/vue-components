import type { RichTextEditorAutofocus, RichTextEditorEmits, RichTextEditorProps } from '../types'
import { useEditor } from '@tiptap/vue-3'
import { computed, watch } from 'vue'
import { createRichTextEditorExtensions, syncEditorContent } from '../services'
import { getOutputHTML } from '../utils'

export function useRichTextEditorController(props: Readonly<RichTextEditorProps>, emit: RichTextEditorEmits) {
  const editable = computed(() => !props.disabled && !props.readonly)
  const editor = useEditor({
    autofocus: props.autofocus,
    // Parse controlled input after the instance exists, including the initial error path.
    content: '',
    editable: editable.value,
    extensions: createRichTextEditorExtensions({
      extensions: props.extensions,
      placeholder: () => props.placeholder ?? '',
    }),
    editorProps: { attributes: createEditorAttributes(props) },
    onBlur: ({ editor: instance, event }) => emit('blur', event, instance),
    onFocus: ({ editor: instance, event }) => emit('focus', event, instance),
    onUpdate: ({ editor: instance }) => {
      const html = getOutputHTML(instance)
      emit('update:modelValue', html)
      if (props.jsonValue !== undefined)
        emit('update:jsonValue', instance.getJSON())
      emit('change', html, instance)
    },
  })

  watch([editor, () => props.jsonValue ?? props.modelValue ?? ''], ([instance, value]) => {
    if (!instance || instance.isDestroyed)
      return
    try {
      syncEditorContent(instance, value)
    }
    catch (error) {
      emit('contentError', error instanceof Error ? error : new Error(String(error)))
    }
  }, { immediate: true, deep: true })

  watch([editor, editable], ([instance, value]) => {
    if (instance && !instance.isDestroyed)
      instance.setEditable(value, false)
  }, { immediate: true })

  watch(
    [editor, () => props.ariaLabel, () => props.disabled, () => props.readonly, () => props.placeholder],
    ([instance]) => {
      if (!instance || instance.isDestroyed)
        return
      instance.setOptions({ editorProps: { attributes: createEditorAttributes(props) } })
      instance.view.dispatch(instance.state.tr)
    },
    { immediate: true },
  )

  function focus(position: RichTextEditorAutofocus = 'end'): void {
    if (editor.value && !editor.value.isDestroyed)
      editor.value.commands.focus(position)
  }

  return { editable, editor, focus }
}

function createEditorAttributes(props: Readonly<RichTextEditorProps>): Record<string, string> {
  return {
    'aria-disabled': String(props.disabled ?? false),
    'aria-label': props.ariaLabel ?? '富文本编辑器',
    'aria-multiline': 'true',
    'aria-readonly': String(props.readonly ?? false),
    'class': 'mx-rich-text-editor__content',
    'role': 'textbox',
  }
}
