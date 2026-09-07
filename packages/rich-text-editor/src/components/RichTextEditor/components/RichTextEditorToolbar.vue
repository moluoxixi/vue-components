<script setup lang="ts">
import type { Component } from 'vue'
import type { RichTextEditorBlockType, RichTextEditorCommandId, RichTextEditorCommands, RichTextEditorState } from '../../../types'
import { AlignCenter, AlignLeft, AlignRight, Bold, Code2, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, RemoveFormatting, Strikethrough, Underline, Undo2 } from '@lucide/vue'
import { computed } from 'vue'
import { richTextCommandIds } from '../../../services'

const props = defineProps<{
  commands: RichTextEditorCommands
  state: RichTextEditorState
  items?: readonly RichTextEditorCommandId[]
}>()
const emit = defineEmits<{ link: [event: Event] }>()
const appearance: Record<RichTextEditorCommandId, { label: string, icon: Component }> = {
  undo: { label: '撤销', icon: Undo2 },
  redo: { label: '重做', icon: Redo2 },
  bold: { label: '粗体', icon: Bold },
  italic: { label: '斜体', icon: Italic },
  underline: { label: '下划线', icon: Underline },
  strike: { label: '删除线', icon: Strikethrough },
  code: { label: '行内代码', icon: Code2 },
  bulletList: { label: '无序列表', icon: List },
  orderedList: { label: '有序列表', icon: ListOrdered },
  blockquote: { label: '引用', icon: Quote },
  horizontalRule: { label: '分隔线', icon: Minus },
  alignLeft: { label: '左对齐', icon: AlignLeft },
  alignCenter: { label: '居中对齐', icon: AlignCenter },
  alignRight: { label: '右对齐', icon: AlignRight },
  clearFormatting: { label: '清除格式', icon: RemoveFormatting },
}
const items = computed(() => [...new Set(props.items ?? richTextCommandIds)].filter(id => Object.hasOwn(appearance, id)))
const blocks: { type: RichTextEditorBlockType, label: string }[] = [
  { type: 'paragraph', label: '正文' },
  { type: 'heading-1', label: '标题 1' },
  { type: 'heading-2', label: '标题 2' },
  { type: 'heading-3', label: '标题 3' },
]
function setBlockType(event: Event): void {
  const target = event.target as HTMLSelectElement
  if (!props.commands.setBlockType(target.value as RichTextEditorBlockType))
    target.value = props.state.blockType
}
</script>

<template>
  <select class="mx-rich-text-editor__block-select" :value="state.blockType" :disabled="!state.editable" aria-label="文本样式" @change="setBlockType">
    <option v-for="block in blocks" :key="block.type" :value="block.type" :disabled="!state.blocks[block.type]">{{ block.label }}</option>
  </select>
  <button
    v-for="id in items"
    :key="id"
    class="mx-rich-text-editor__tool"
    :class="{ 'is-active': state.commands[id].active }"
    type="button"
    :title="appearance[id].label"
    :aria-label="appearance[id].label"
    :aria-pressed="state.commands[id].active"
    :disabled="!state.commands[id].enabled"
    @click="commands.execute(id)"
  ><component :is="appearance[id].icon" :size="17" aria-hidden="true" /></button>
  <button class="mx-rich-text-editor__tool" :class="{ 'is-active': state.link.active }" type="button" title="链接" aria-label="链接" :aria-pressed="state.link.active" :disabled="!state.link.enabled" @click="emit('link', $event)"><Link2 :size="17" aria-hidden="true" /></button>
</template>
