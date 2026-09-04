<script setup lang="ts">
import type {
  RichTextEditorAutofocus,
  RichTextEditorEmits,
  RichTextEditorExpose,
  RichTextEditorProps,
  RichTextEditorSlots,
} from '../../types'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  Code2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
  X,
} from '@lucide/vue'
import type { Editor } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { computed, shallowRef, watch } from 'vue'
import { useRichTextEditorLink, useRichTextEditorToolbar } from '../../composables'
import { getOutputHTML, toCssDimension } from '../../utils'

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

const toolbarVersion = shallowRef(0)

const editorStyle = computed<Record<string, string | undefined>>(() => ({
  '--mx-rich-text-max-height': toCssDimension(props.maxHeight),
  '--mx-rich-text-min-height': toCssDimension(props.minHeight),
}))

const editable = computed(() => !props.disabled && !props.readonly)

const editor = useEditor({
  autofocus: props.autofocus,
  content: props.modelValue,
  editable: editable.value,
  extensions: [
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
    Placeholder.configure({
      placeholder: () => props.placeholder,
    }),
    TextAlign.configure({
      alignments: ['left', 'center', 'right'],
      types: ['heading', 'paragraph'],
    }),
  ],
  editorProps: {
    attributes: {
      'aria-disabled': String(props.disabled),
      'aria-label': props.ariaLabel,
      'aria-multiline': 'true',
      'aria-readonly': String(props.readonly),
      'class': 'mx-rich-text-editor__content',
      'role': 'textbox',
    },
  },
  onBlur: ({ editor: editorInstance, event }) => {
    emit('blur', event, editorInstance)
  },
  onFocus: ({ editor: editorInstance, event }) => {
    emit('focus', event, editorInstance)
  },
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
} = useRichTextEditorLink(editor)

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
  if (!value)
    closeLinkPanel()
})

watch(
  () => [props.ariaLabel, props.disabled, props.readonly, props.placeholder] as const,
  () => {
    const editorInstance = editor.value
    if (!editorInstance)
      return

    editorInstance.setOptions({
      editorProps: {
        attributes: {
          'aria-disabled': String(props.disabled),
          'aria-label': props.ariaLabel,
          'aria-multiline': 'true',
          'aria-readonly': String(props.readonly),
          'class': 'mx-rich-text-editor__content',
          'role': 'textbox',
        },
      },
    })
    editorInstance.view.dispatch(editorInstance.state.tr)
  },
  { immediate: true },
)

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
        <select
          class="mx-rich-text-editor__block-select"
          :value="blockType"
          :disabled="props.disabled"
          aria-label="文本样式"
          @change="setBlockType"
        >
          <option value="paragraph">正文</option>
          <option value="heading-1">标题 1</option>
          <option value="heading-2">标题 2</option>
          <option value="heading-3">标题 3</option>
        </select>

        <span class="mx-rich-text-editor__group" role="group" aria-label="历史">
          <button
            class="mx-rich-text-editor__tool"
            type="button"
            title="撤销"
            aria-label="撤销"
            :disabled="props.disabled || !canRun(canUndo)"
            @click="editor?.chain().focus().undo().run()"
          ><Undo2 :size="17" aria-hidden="true" /></button>
          <button
            class="mx-rich-text-editor__tool"
            type="button"
            title="重做"
            aria-label="重做"
            :disabled="props.disabled || !canRun(canRedo)"
            @click="editor?.chain().focus().redo().run()"
          ><Redo2 :size="17" aria-hidden="true" /></button>
        </span>

        <span class="mx-rich-text-editor__group" role="group" aria-label="文字格式">
          <button class="mx-rich-text-editor__tool" :class="{ 'is-active': isActive('bold') }" type="button" title="粗体" aria-label="粗体" :aria-pressed="isActive('bold')" :disabled="props.disabled" @click="editor?.chain().focus().toggleBold().run()"><Bold :size="17" aria-hidden="true" /></button>
          <button class="mx-rich-text-editor__tool" :class="{ 'is-active': isActive('italic') }" type="button" title="斜体" aria-label="斜体" :aria-pressed="isActive('italic')" :disabled="props.disabled" @click="editor?.chain().focus().toggleItalic().run()"><Italic :size="17" aria-hidden="true" /></button>
          <button class="mx-rich-text-editor__tool" :class="{ 'is-active': isActive('underline') }" type="button" title="下划线" aria-label="下划线" :aria-pressed="isActive('underline')" :disabled="props.disabled" @click="editor?.chain().focus().toggleUnderline().run()"><Underline :size="17" aria-hidden="true" /></button>
          <button class="mx-rich-text-editor__tool" :class="{ 'is-active': isActive('strike') }" type="button" title="删除线" aria-label="删除线" :aria-pressed="isActive('strike')" :disabled="props.disabled" @click="editor?.chain().focus().toggleStrike().run()"><Strikethrough :size="17" aria-hidden="true" /></button>
          <button class="mx-rich-text-editor__tool" :class="{ 'is-active': isActive('code') }" type="button" title="行内代码" aria-label="行内代码" :aria-pressed="isActive('code')" :disabled="props.disabled" @click="editor?.chain().focus().toggleCode().run()"><Code2 :size="17" aria-hidden="true" /></button>
        </span>

        <span class="mx-rich-text-editor__group" role="group" aria-label="段落">
          <button class="mx-rich-text-editor__tool" :class="{ 'is-active': isActive('bulletList') }" type="button" title="无序列表" aria-label="无序列表" :aria-pressed="isActive('bulletList')" :disabled="props.disabled" @click="editor?.chain().focus().toggleBulletList().run()"><List :size="17" aria-hidden="true" /></button>
          <button class="mx-rich-text-editor__tool" :class="{ 'is-active': isActive('orderedList') }" type="button" title="有序列表" aria-label="有序列表" :aria-pressed="isActive('orderedList')" :disabled="props.disabled" @click="editor?.chain().focus().toggleOrderedList().run()"><ListOrdered :size="17" aria-hidden="true" /></button>
          <button class="mx-rich-text-editor__tool" :class="{ 'is-active': isActive('blockquote') }" type="button" title="引用" aria-label="引用" :aria-pressed="isActive('blockquote')" :disabled="props.disabled" @click="editor?.chain().focus().toggleBlockquote().run()"><Quote :size="17" aria-hidden="true" /></button>
          <button class="mx-rich-text-editor__tool" type="button" title="分隔线" aria-label="分隔线" :disabled="props.disabled" @click="editor?.chain().focus().setHorizontalRule().run()"><Minus :size="17" aria-hidden="true" /></button>
        </span>

        <span class="mx-rich-text-editor__group" role="group" aria-label="对齐">
          <button class="mx-rich-text-editor__tool" :class="{ 'is-active': isTextAligned('left') }" type="button" title="左对齐" aria-label="左对齐" :aria-pressed="isTextAligned('left')" :disabled="props.disabled" @click="editor?.chain().focus().setTextAlign('left').run()"><AlignLeft :size="17" aria-hidden="true" /></button>
          <button class="mx-rich-text-editor__tool" :class="{ 'is-active': isTextAligned('center') }" type="button" title="居中对齐" aria-label="居中对齐" :aria-pressed="isTextAligned('center')" :disabled="props.disabled" @click="editor?.chain().focus().setTextAlign('center').run()"><AlignCenter :size="17" aria-hidden="true" /></button>
          <button class="mx-rich-text-editor__tool" :class="{ 'is-active': isTextAligned('right') }" type="button" title="右对齐" aria-label="右对齐" :aria-pressed="isTextAligned('right')" :disabled="props.disabled" @click="editor?.chain().focus().setTextAlign('right').run()"><AlignRight :size="17" aria-hidden="true" /></button>
        </span>

        <span class="mx-rich-text-editor__group" role="group" aria-label="链接和清理">
          <button class="mx-rich-text-editor__tool" :class="{ 'is-active': isActive('link') }" type="button" title="链接" aria-label="链接" :aria-pressed="isActive('link')" :disabled="props.disabled" @click="openLinkPanel"><Link2 :size="17" aria-hidden="true" /></button>
          <button class="mx-rich-text-editor__tool" type="button" title="清除格式" aria-label="清除格式" :disabled="props.disabled" @click="editor?.chain().focus().unsetAllMarks().clearNodes().run()"><RemoveFormatting :size="17" aria-hidden="true" /></button>
        </span>
      </slot>
    </div>

    <form v-if="linkPanelVisible" class="mx-rich-text-editor__link-panel" @submit.prevent="applyLink">
      <Link2 :size="16" aria-hidden="true" />
      <input
        ref="linkInputRef"
        v-model="linkHref"
        class="mx-rich-text-editor__link-input"
        type="text"
        inputmode="url"
        autocomplete="url"
        aria-label="链接地址"
        placeholder="https://example.com"
        @keydown.esc.prevent="closeLinkPanel"
      >
      <button class="mx-rich-text-editor__tool" type="submit" title="应用链接" aria-label="应用链接"><Check :size="17" aria-hidden="true" /></button>
      <button v-if="isActive('link')" class="mx-rich-text-editor__tool" type="button" title="移除链接" aria-label="移除链接" @click="removeLink"><Unlink :size="17" aria-hidden="true" /></button>
      <button class="mx-rich-text-editor__tool" type="button" title="关闭" aria-label="关闭链接编辑" @click="closeLinkPanel"><X :size="17" aria-hidden="true" /></button>
    </form>

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
