<script setup lang="ts">
import type { Component } from 'vue'
import type { RichTextEditorBlockType, RichTextEditorCommandId, RichTextEditorCommands, RichTextEditorState } from '../../../types'
import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, Code2, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, RemoveFormatting, Strikethrough, Underline, Undo2 } from '@lucide/vue'
import { computed } from 'vue'
import { richTextCommandIds } from '../../../services'
import RichTextEditorControlHint from './RichTextEditorToolbar/components/RichTextEditorControlHint.vue'

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
// Resolve typed record keys in script before declaration generation checks template loop variables.
const toolbarItems = computed(() => [...new Set(props.items ?? richTextCommandIds)]
  .filter(id => Object.hasOwn(appearance, id))
  .map(id => ({ id, ...appearance[id], ...props.state.commands[id] })))
const blocks: { type: RichTextEditorBlockType, label: string }[] = [
  { type: 'paragraph', label: '正文' },
  { type: 'heading-1', label: '标题 1' },
  { type: 'heading-2', label: '标题 2' },
  { type: 'heading-3', label: '标题 3' },
]
const blockOptions = computed(() => blocks.map(block => ({ ...block, enabled: props.state.blocks[block.type] })))
const editingHint = '当前不可编辑；解除禁用或只读状态后可用。'

function disabledHint(id: RichTextEditorCommandId | 'link'): string {
  if (!props.state.editable)
    return editingHint
  if (id === 'undo')
    return '暂无可撤销的操作；编辑内容后可用。'
  if (id === 'redo')
    return '暂无可重做的操作；撤销内容后可用。'
  return '当前内容或选区不支持此操作；更换内容或选区后重试。'
}
function setBlockType(event: Event): void {
  const target = event.target as HTMLSelectElement
  if (!props.commands.setBlockType(target.value as RichTextEditorBlockType))
    target.value = props.state.blockType
}
</script>

<template>
  <RichTextEditorControlHint :disabled="!props.state.editable" :message="editingHint">
    <span class="mx-rich-text-editor__block-control">
      <select class="mx-rich-text-editor__block-select" :value="props.state.blockType" :disabled="!props.state.editable" aria-label="文本样式" @change="setBlockType">
        <option v-for="block in blockOptions" :key="block.type" :value="block.type" :disabled="!block.enabled">{{ block.label }}</option>
      </select>
      <ChevronDown class="mx-rich-text-editor__block-chevron" :size="14" aria-hidden="true" />
    </span>
  </RichTextEditorControlHint>
  <RichTextEditorControlHint
    v-for="item in toolbarItems"
    :key="item.id"
    :disabled="!item.enabled"
    :message="disabledHint(item.id)"
  >
    <button
      class="mx-rich-text-editor__tool"
      :class="{ 'is-active': item.active }"
      type="button"
      :title="item.enabled ? item.label : undefined"
      :aria-label="item.label"
      :aria-pressed="item.active"
      :disabled="!item.enabled"
      @click="props.commands.execute(item.id)"
    >
      <component :is="item.icon" :size="17" aria-hidden="true" />
    </button>
  </RichTextEditorControlHint>
  <RichTextEditorControlHint :disabled="!props.state.link.enabled" :message="disabledHint('link')">
    <button class="mx-rich-text-editor__tool" :class="{ 'is-active': props.state.link.active }" type="button" :title="props.state.link.enabled ? '链接' : undefined" aria-label="链接" :aria-pressed="props.state.link.active" :disabled="!props.state.link.enabled" @click="emit('link', $event)">
      <Link2 :size="17" aria-hidden="true" />
    </button>
  </RichTextEditorControlHint>
</template>
