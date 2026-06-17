<script setup lang="ts">
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

defineProps<{
  /** 列表项 */
  items: ProbeItem[]
}>()
defineEmits<{
  /** 选中项 */
  (e: 'pick', item: ProbeItem): void
}>()
defineModel<boolean>('open', { default: false })
// @ts-expect-error defineAttrs 为实验宏，部分版本类型未导出
defineAttrs<MacroProbeAttrs>()

function focus(): void {}
function reset(): void {}
defineExpose({ focus, reset })
</script>

<template>
  <div />
</template>
