<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
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
} from '@lucide/vue'
import { createRichTextToolbarCommand } from '../../services'

type ActiveState = (name: string, attributes?: Record<string, unknown>) => boolean
type Alignment = 'left' | 'center' | 'right'

const props = defineProps<{
  blockType: string
  canRedo: (editor: Editor) => boolean
  canRun: (command: (editor: Editor) => boolean) => boolean
  canUndo: (editor: Editor) => boolean
  disabled: boolean
  editor: Editor
  isActive: ActiveState
  isTextAligned: (alignment: Alignment) => boolean
  openLinkPanel: () => void
  setBlockType: (event: Event) => void
}>()

function run(command: (editor: Editor) => boolean): void {
  if (!props.disabled)
    command(props.editor)
}

const commands = {
  undo: createRichTextToolbarCommand(() => props.editor.chain().focus().undo().run(), { canExecute: () => !props.disabled && props.canRun(props.canUndo), isActive: () => false }),
  redo: createRichTextToolbarCommand(() => props.editor.chain().focus().redo().run(), { canExecute: () => !props.disabled && props.canRun(props.canRedo), isActive: () => false }),
  bold: createRichTextToolbarCommand(() => run(editor => editor.chain().focus().toggleBold().run()), { canExecute: () => !props.disabled, isActive: () => props.isActive('bold') }),
  italic: createRichTextToolbarCommand(() => run(editor => editor.chain().focus().toggleItalic().run()), { canExecute: () => !props.disabled, isActive: () => props.isActive('italic') }),
  underline: createRichTextToolbarCommand(() => run(editor => editor.chain().focus().toggleUnderline().run()), { canExecute: () => !props.disabled, isActive: () => props.isActive('underline') }),
  strike: createRichTextToolbarCommand(() => run(editor => editor.chain().focus().toggleStrike().run()), { canExecute: () => !props.disabled, isActive: () => props.isActive('strike') }),
  code: createRichTextToolbarCommand(() => run(editor => editor.chain().focus().toggleCode().run()), { canExecute: () => !props.disabled, isActive: () => props.isActive('code') }),
  bulletList: createRichTextToolbarCommand(() => run(editor => editor.chain().focus().toggleBulletList().run()), { canExecute: () => !props.disabled, isActive: () => props.isActive('bulletList') }),
  orderedList: createRichTextToolbarCommand(() => run(editor => editor.chain().focus().toggleOrderedList().run()), { canExecute: () => !props.disabled, isActive: () => props.isActive('orderedList') }),
  blockquote: createRichTextToolbarCommand(() => run(editor => editor.chain().focus().toggleBlockquote().run()), { canExecute: () => !props.disabled, isActive: () => props.isActive('blockquote') }),
  horizontalRule: createRichTextToolbarCommand(() => run(editor => editor.chain().focus().setHorizontalRule().run()), { canExecute: () => !props.disabled, isActive: () => false }),
  leftAlign: createRichTextToolbarCommand(() => run(editor => editor.chain().focus().setTextAlign('left').run()), { canExecute: () => !props.disabled, isActive: () => props.isTextAligned('left') }),
  centerAlign: createRichTextToolbarCommand(() => run(editor => editor.chain().focus().setTextAlign('center').run()), { canExecute: () => !props.disabled, isActive: () => props.isTextAligned('center') }),
  rightAlign: createRichTextToolbarCommand(() => run(editor => editor.chain().focus().setTextAlign('right').run()), { canExecute: () => !props.disabled, isActive: () => props.isTextAligned('right') }),
  clearFormatting: createRichTextToolbarCommand(() => run(editor => editor.chain().focus().unsetAllMarks().clearNodes().run()), { canExecute: () => !props.disabled, isActive: () => false }),
}

function undo(): void { if (commands.undo.canExecute()) commands.undo.execute() }
function redo(): void { if (commands.redo.canExecute()) commands.redo.execute() }
function toggleBold(): void { commands.bold.execute() }
function toggleItalic(): void { commands.italic.execute() }
function toggleUnderline(): void { commands.underline.execute() }
function toggleStrike(): void { commands.strike.execute() }
function toggleCode(): void { commands.code.execute() }
function toggleBulletList(): void { commands.bulletList.execute() }
function toggleOrderedList(): void { commands.orderedList.execute() }
function toggleBlockquote(): void { commands.blockquote.execute() }
function setHorizontalRule(): void { commands.horizontalRule.execute() }
function setLeftAlign(): void { commands.leftAlign.execute() }
function setCenterAlign(): void { commands.centerAlign.execute() }
function setRightAlign(): void { commands.rightAlign.execute() }
function clearFormatting(): void { commands.clearFormatting.execute() }
</script>

<template>
  <select
    class="mx-rich-text-editor__block-select"
    :value="props.blockType"
    :disabled="props.disabled"
    aria-label="文本样式"
    @change="props.setBlockType"
  >
    <option value="paragraph">正文</option>
    <option value="heading-1">标题 1</option>
    <option value="heading-2">标题 2</option>
    <option value="heading-3">标题 3</option>
  </select>

  <span class="mx-rich-text-editor__group" role="group" aria-label="历史">
    <button class="mx-rich-text-editor__tool" type="button" title="撤销" aria-label="撤销" :disabled="props.disabled || !props.canRun(props.canUndo)" @click="undo"><Undo2 :size="17" aria-hidden="true" /></button>
    <button class="mx-rich-text-editor__tool" type="button" title="重做" aria-label="重做" :disabled="props.disabled || !props.canRun(props.canRedo)" @click="redo"><Redo2 :size="17" aria-hidden="true" /></button>
  </span>

  <span class="mx-rich-text-editor__group" role="group" aria-label="文字格式">
    <button class="mx-rich-text-editor__tool" :class="{ 'is-active': props.isActive('bold') }" type="button" title="粗体" aria-label="粗体" :aria-pressed="props.isActive('bold')" :disabled="props.disabled" @click="toggleBold"><Bold :size="17" aria-hidden="true" /></button>
    <button class="mx-rich-text-editor__tool" :class="{ 'is-active': props.isActive('italic') }" type="button" title="斜体" aria-label="斜体" :aria-pressed="props.isActive('italic')" :disabled="props.disabled" @click="toggleItalic"><Italic :size="17" aria-hidden="true" /></button>
    <button class="mx-rich-text-editor__tool" :class="{ 'is-active': props.isActive('underline') }" type="button" title="下划线" aria-label="下划线" :aria-pressed="props.isActive('underline')" :disabled="props.disabled" @click="toggleUnderline"><Underline :size="17" aria-hidden="true" /></button>
    <button class="mx-rich-text-editor__tool" :class="{ 'is-active': props.isActive('strike') }" type="button" title="删除线" aria-label="删除线" :aria-pressed="props.isActive('strike')" :disabled="props.disabled" @click="toggleStrike"><Strikethrough :size="17" aria-hidden="true" /></button>
    <button class="mx-rich-text-editor__tool" :class="{ 'is-active': props.isActive('code') }" type="button" title="行内代码" aria-label="行内代码" :aria-pressed="props.isActive('code')" :disabled="props.disabled" @click="toggleCode"><Code2 :size="17" aria-hidden="true" /></button>
  </span>

  <span class="mx-rich-text-editor__group" role="group" aria-label="段落">
    <button class="mx-rich-text-editor__tool" :class="{ 'is-active': props.isActive('bulletList') }" type="button" title="无序列表" aria-label="无序列表" :aria-pressed="props.isActive('bulletList')" :disabled="props.disabled" @click="toggleBulletList"><List :size="17" aria-hidden="true" /></button>
    <button class="mx-rich-text-editor__tool" :class="{ 'is-active': props.isActive('orderedList') }" type="button" title="有序列表" aria-label="有序列表" :aria-pressed="props.isActive('orderedList')" :disabled="props.disabled" @click="toggleOrderedList"><ListOrdered :size="17" aria-hidden="true" /></button>
    <button class="mx-rich-text-editor__tool" :class="{ 'is-active': props.isActive('blockquote') }" type="button" title="引用" aria-label="引用" :aria-pressed="props.isActive('blockquote')" :disabled="props.disabled" @click="toggleBlockquote"><Quote :size="17" aria-hidden="true" /></button>
    <button class="mx-rich-text-editor__tool" type="button" title="分隔线" aria-label="分隔线" :disabled="props.disabled" @click="setHorizontalRule"><Minus :size="17" aria-hidden="true" /></button>
  </span>

  <span class="mx-rich-text-editor__group" role="group" aria-label="对齐">
    <button class="mx-rich-text-editor__tool" :class="{ 'is-active': props.isTextAligned('left') }" type="button" title="左对齐" aria-label="左对齐" :aria-pressed="props.isTextAligned('left')" :disabled="props.disabled" @click="setLeftAlign"><AlignLeft :size="17" aria-hidden="true" /></button>
    <button class="mx-rich-text-editor__tool" :class="{ 'is-active': props.isTextAligned('center') }" type="button" title="居中对齐" aria-label="居中对齐" :aria-pressed="props.isTextAligned('center')" :disabled="props.disabled" @click="setCenterAlign"><AlignCenter :size="17" aria-hidden="true" /></button>
    <button class="mx-rich-text-editor__tool" :class="{ 'is-active': props.isTextAligned('right') }" type="button" title="右对齐" aria-label="右对齐" :aria-pressed="props.isTextAligned('right')" :disabled="props.disabled" @click="setRightAlign"><AlignRight :size="17" aria-hidden="true" /></button>
  </span>

  <span class="mx-rich-text-editor__group" role="group" aria-label="链接和清理">
    <button class="mx-rich-text-editor__tool" :class="{ 'is-active': props.isActive('link') }" type="button" title="链接" aria-label="链接" :aria-pressed="props.isActive('link')" :disabled="props.disabled" @click="props.openLinkPanel"><Link2 :size="17" aria-hidden="true" /></button>
    <button class="mx-rich-text-editor__tool" type="button" title="清除格式" aria-label="清除格式" :disabled="props.disabled" @click="clearFormatting"><RemoveFormatting :size="17" aria-hidden="true" /></button>
  </span>
</template>
