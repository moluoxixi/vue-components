<script setup lang="ts">
import type { ComponentInternalInstance, ComponentPublicInstance } from 'vue'

/** 透传到内部输入框的原生属性 */
interface MacroProbeAttrs {
  /** 原生 placeholder */
  placeholder?: string
  /** 原生 maxlength */
  maxlength?: number
}

interface ProbeItem {
  /** 唯一 id */
  id: number
  /** 名称 */
  label: string
}

type VirtualRef = ComponentPublicInstance | ComponentInternalInstance | HTMLElement | null
type PickPayload = ProbeItem | null
type ExposedStatus = 'idle' | 'busy'

defineProps<{
  /** 列表项 */
  items: ProbeItem[]
  /** 外部虚拟引用 */
  virtualRef?: VirtualRef
}>()
defineEmits<{
  /** 选中项 */
  (e: 'pick', item: PickPayload): void
}>()
defineModel<boolean>('open', { default: false })
// @ts-expect-error defineAttrs 为实验宏，部分版本类型未导出
defineAttrs<MacroProbeAttrs>()

function focus(): void {}
function reset(): void {}
const status: ExposedStatus = 'idle'
function getStatus(): ExposedStatus { return status }
defineExpose({ focus, reset, getStatus })
</script>

<template>
  <div />
</template>
