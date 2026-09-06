<script setup lang="ts">
import type {
  RichTextEditorEmits,
  RichTextEditorExpose,
  RichTextEditorProps,
  RichTextEditorSlots,
} from '../../types'
import { EditorContent } from '@tiptap/vue-3'
import { computed, watch } from 'vue'
import {
  useRichTextEditorController,
  useRichTextEditorLink,
  useRichTextEditorToolbar,
} from '../../composables'
import RichTextEditorLinkPanel from '../RichTextEditorLinkPanel'
import RichTextEditorToolbar from '../RichTextEditorToolbar'
import { toCssDimension } from '../../utils'

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

const editorStyle = computed<Record<string, string | undefined>>(() => ({
  '--mx-rich-text-max-height': toCssDimension(props.maxHeight),
  '--mx-rich-text-min-height': toCssDimension(props.minHeight),
}))

const {
  canRedo,
  canUndo,
  clearContent,
  editable,
  editor,
  focus,
  toolbarVersion,
} = useRichTextEditorController(props, emit)

watch(editable, (value) => {
  if (!value)
    closeLinkPanel()
})

const {
  blockType,
  canRun,
  isActive,
  isTextAligned,
  setBlockType,
  toolbarScope,
} = useRichTextEditorToolbar(editor, props, toolbarVersion)

const {
  applyLink,
  closeLinkPanel,
  linkHref,
  linkPanelVisible,
  openLinkPanel,
  removeLink,
  setLinkInputRef,
} = useRichTextEditorLink(editor)

defineExpose<RichTextEditorExpose>({
  clearContent,
  focus,
  get editor() {
    return editor.value ?? null
  },
})
</script>

<template>
  <div
    class="mx-rich-text-editor"
    :class="{
      'is-disabled': props.disabled,
      'is-readonly': props.readonly,
    }"
    :style="editorStyle"
  >
    <div
      v-if="props.showToolbar && !props.readonly && toolbarScope"
      class="mx-rich-text-editor__toolbar"
      role="toolbar"
      aria-label="富文本格式"
    >
      <slot name="toolbar" v-bind="toolbarScope">
        <RichTextEditorToolbar
          :block-type="blockType"
          :can-redo="canRedo"
          :can-run="canRun"
          :can-undo="canUndo"
          :disabled="props.disabled"
          :editor="editor!"
          :is-active="isActive"
          :is-text-aligned="isTextAligned"
          :open-link-panel="openLinkPanel"
          :set-block-type="setBlockType"
        />
      </slot>
    </div>

    <RichTextEditorLinkPanel
      v-if="linkPanelVisible && editor"
      :apply="applyLink"
      :close="closeLinkPanel"
      :is-link-active="isActive('link')"
      :link-href="linkHref"
      :remove="removeLink"
      :set-input-ref="setLinkInputRef"
      @update:link-href="linkHref = $event"
    />

    <EditorContent v-if="editor" class="mx-rich-text-editor__surface" :editor="editor" />
  </div>
</template>

<style scoped>
.mx-rich-text-editor {
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--mx-rich-text-border-color, #cbd5e1);
  border-radius: 6px;
  background: var(--mx-rich-text-bg, #fff);
  color: var(--mx-rich-text-color, #172033);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.mx-rich-text-editor:focus-within {
  border-color: var(--mx-rich-text-focus-color, #0f766e);
  box-shadow: 0 0 0 2px var(--mx-rich-text-focus-ring, rgb(15 118 110 / 14%));
}

.mx-rich-text-editor.is-disabled {
  background: var(--mx-rich-text-disabled-bg, #f8fafc);
  opacity: 0.72;
}

.mx-rich-text-editor__toolbar,
.mx-rich-text-editor__link-panel {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-bottom: 1px solid var(--mx-rich-text-border-color, #cbd5e1);
  background: var(--mx-rich-text-toolbar-bg, #f8fafc);
}

.mx-rich-text-editor__toolbar {
  flex-wrap: wrap;
}

.mx-rich-text-editor__group {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  padding-right: 5px;
  margin-right: 2px;
  border-right: 1px solid var(--mx-rich-text-divider-color, #e2e8f0);
}

.mx-rich-text-editor__group:last-child {
  padding-right: 0;
  margin-right: 0;
  border-right: 0;
}

.mx-rich-text-editor__tool {
  display: inline-flex;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--mx-rich-text-tool-color, #475569);
  cursor: pointer;
}

.mx-rich-text-editor__tool:hover:not(:disabled) {
  background: var(--mx-rich-text-tool-hover-bg, #e2e8f0);
  color: var(--mx-rich-text-tool-hover-color, #0f172a);
}

.mx-rich-text-editor__tool.is-active {
  background: var(--mx-rich-text-tool-active-bg, #ccfbf1);
  color: var(--mx-rich-text-tool-active-color, #0f766e);
}

.mx-rich-text-editor__tool:focus-visible,
.mx-rich-text-editor__block-select:focus-visible,
.mx-rich-text-editor__link-input:focus-visible {
  outline: 2px solid var(--mx-rich-text-focus-color, #0f766e);
  outline-offset: 1px;
}

.mx-rich-text-editor__tool:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}

.mx-rich-text-editor__block-select {
  width: 92px;
  height: 30px;
  padding: 0 24px 0 8px;
  border: 1px solid var(--mx-rich-text-border-color, #cbd5e1);
  border-radius: 4px;
  background: #fff;
  color: inherit;
  font: inherit;
  font-size: 13px;
}

.mx-rich-text-editor__link-panel {
  flex-wrap: nowrap;
  color: var(--mx-rich-text-tool-color, #475569);
}

.mx-rich-text-editor__link-input {
  min-width: 0;
  height: 30px;
  flex: 1;
  padding: 0 9px;
  border: 1px solid var(--mx-rich-text-border-color, #cbd5e1);
  border-radius: 4px;
  background: #fff;
  color: inherit;
  font: inherit;
  font-size: 13px;
}

.mx-rich-text-editor__surface {
  max-height: var(--mx-rich-text-max-height, none);
  overflow-y: auto;
}

:deep(.mx-rich-text-editor__content) {
  min-height: var(--mx-rich-text-min-height, 180px);
  padding: 14px 16px;
  outline: 0;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

:deep(.mx-rich-text-editor__content > :first-child) {
  margin-top: 0;
}

:deep(.mx-rich-text-editor__content > :last-child) {
  margin-bottom: 0;
}

:deep(.mx-rich-text-editor__content p.is-editor-empty:first-child::before) {
  height: 0;
  float: left;
  color: var(--mx-rich-text-placeholder-color, #94a3b8);
  content: attr(data-placeholder);
  pointer-events: none;
}

:deep(.mx-rich-text-editor__content h1),
:deep(.mx-rich-text-editor__content h2),
:deep(.mx-rich-text-editor__content h3) {
  margin: 1em 0 0.45em;
  line-height: 1.3;
}

:deep(.mx-rich-text-editor__content h1) { font-size: 1.75em; }
:deep(.mx-rich-text-editor__content h2) { font-size: 1.4em; }
:deep(.mx-rich-text-editor__content h3) { font-size: 1.18em; }

:deep(.mx-rich-text-editor__content ul),
:deep(.mx-rich-text-editor__content ol) {
  padding-left: 1.5em;
}

:deep(.mx-rich-text-editor__content blockquote) {
  padding-left: 12px;
  margin-left: 0;
  border-left: 3px solid var(--mx-rich-text-blockquote-color, #94a3b8);
  color: var(--mx-rich-text-muted-color, #475569);
}

:deep(.mx-rich-text-editor__content code) {
  padding: 2px 4px;
  border-radius: 3px;
  background: var(--mx-rich-text-code-bg, #f1f5f9);
  color: var(--mx-rich-text-code-color, #be123c);
}

:deep(.mx-rich-text-editor__content pre) {
  padding: 12px 14px;
  overflow-x: auto;
  border-radius: 4px;
  background: #172033;
  color: #f8fafc;
}

:deep(.mx-rich-text-editor__content pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
}

:deep(.mx-rich-text-editor__content a) {
  color: var(--mx-rich-text-link-color, #0369a1);
  text-decoration: underline;
}

:deep(.mx-rich-text-editor__content hr) {
  margin: 20px 0;
  border: 0;
  border-top: 1px solid var(--mx-rich-text-divider-color, #e2e8f0);
}

@media (max-width: 640px) {
  .mx-rich-text-editor__toolbar {
    align-items: flex-start;
  }

  .mx-rich-text-editor__group {
    border-right: 0;
  }
}
</style>
