<script setup lang="ts">
import type { RichTextEditorEmits, RichTextEditorExpose, RichTextEditorProps, RichTextEditorSlots, RichTextEditorToolbarScope } from '../../types'
import { EditorContent } from '@tiptap/vue-3'
import { computed } from 'vue'
import { useRichTextEditorController, useRichTextEditorLink, useRichTextEditorToolbar } from '../../composables'
import { getOutputHTML, toCssDimension } from '../../utils'
import { RichTextEditorLinkPanel, RichTextEditorToolbar } from './components'

defineOptions({ name: 'RichTextEditor' })
const props = withDefaults(defineProps<RichTextEditorProps>(), {
  ariaLabel: '富文本编辑器',
  autofocus: false,
  disabled: false,
  maxHeight: undefined,
  minHeight: 180,
  modelValue: '',
  placeholder: '请输入内容',
  readonly: false,
  showToolbar: true,
})
const emit = defineEmits<RichTextEditorEmits>()
defineSlots<RichTextEditorSlots>()
const editorStyle = computed(() => ({
  '--mx-rich-text-max-height': toCssDimension(props.maxHeight),
  '--mx-rich-text-min-height': toCssDimension(props.minHeight),
}))
const { editable, editor, focus } = useRichTextEditorController(props, emit)
const { commands, state } = useRichTextEditorToolbar(editor, editable)
const visibleToolbar = computed(() => props.showToolbar && !props.readonly)
const { applyLink, closeLinkPanel, linkHref, linkError, linkPanelVisible, openLinkPanel, removeLink } = useRichTextEditorLink(editor, commands, state, visibleToolbar)
const toolbarScope = computed<RichTextEditorToolbarScope | null>(() => editor.value && state.value.ready
  ? { editor: editor.value, commands, state: state.value, disabled: props.disabled, readonly: props.readonly, openLinkPanel }
  : null)

defineExpose<RichTextEditorExpose>({
  commands,
  focus,
  clearContent: () => { commands.clearContent() },
  getHTML: () => editor.value && !editor.value.isDestroyed ? getOutputHTML(editor.value) : '',
  getJSON: () => editor.value && !editor.value.isDestroyed ? editor.value.getJSON() : null,
  get editor() { return editor.value ?? null },
  get state() { return state.value },
})
</script>

<template>
  <div class="mx-rich-text-editor" :class="{ 'is-disabled': props.disabled, 'is-readonly': props.readonly }" :style="editorStyle">
    <div v-if="visibleToolbar && toolbarScope" class="mx-rich-text-editor__toolbar" role="toolbar" aria-label="富文本格式">
      <slot name="toolbar-before" v-bind="toolbarScope" />
      <slot name="toolbar" v-bind="toolbarScope">
        <RichTextEditorToolbar :commands="commands" :state="state" :items="props.toolbarItems" @link="openLinkPanel" />
      </slot>
      <slot name="toolbar-after" v-bind="toolbarScope" />
    </div>
    <RichTextEditorLinkPanel
      v-if="linkPanelVisible"
      v-model:link-href="linkHref"
      :error="linkError"
      :is-link-active="state.link.active"
      @apply="applyLink"
      @close="closeLinkPanel"
      @remove="removeLink"
    />
    <EditorContent v-if="editor && state.ready" class="mx-rich-text-editor__surface" :editor="editor" />
  </div>
</template>

<style src="../../styles/editor.css"></style>
