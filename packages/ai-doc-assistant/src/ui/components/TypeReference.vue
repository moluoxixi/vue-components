<script setup lang="ts">
import { ElPopover } from 'element-plus'
import { ref, useTemplateRef } from 'vue'
import { restoreFocusIfLost } from '../focus'

defineProps<{ text: string, content: string }>()

const visible = ref(false)
const trigger = useTemplateRef<HTMLButtonElement>('trigger')

function close(): void {
  visible.value = false
  trigger.value?.focus()
}

function restoreFocusAfterOutsideClose(): void {
  restoreFocusIfLost(trigger.value)
}
</script>

<template>
  <ElPopover
    v-model:visible="visible"
    trigger="click"
    placement="top-start"
    :width="420"
    popper-class="ai-doc-type-popover"
    @hide="restoreFocusAfterOutsideClose"
  >
    <template #reference>
      <button
        ref="trigger"
        class="type-reference"
        type="button"
        :aria-label="`查看 ${text} 类型详情`"
        :aria-expanded="visible"
        data-testid="type-reference"
        :data-content="content"
        @keydown.esc.stop.prevent="close"
      >
        <code>{{ text }}</code>
      </button>
    </template>
    <pre data-testid="type-popover-content">{{ content }}</pre>
  </ElPopover>
</template>

<style scoped>
.type-reference {
  max-width: 100%;
  padding: 0;
  border: 0;
  border-bottom: 1px dashed currentColor;
  border-radius: 0;
  background: transparent;
  color: #0969da;
  cursor: help;
  text-align: left;
}
.type-reference:focus-visible { border-radius: 2px; outline: 2px solid #409eff; outline-offset: 3px; }
.type-reference code {
  padding: 1px 6px;
  border-radius: 4px;
  background: #ddf4ff;
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
}
</style>

<style>
.el-popper.ai-doc-type-popover { max-width: min(520px, calc(100vw - 24px)); }
.ai-doc-type-popover pre {
  max-height: min(420px, calc(100vh - 32px));
  margin: 0;
  overflow: auto;
  color: #30363d;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
