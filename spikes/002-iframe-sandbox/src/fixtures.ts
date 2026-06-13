// 宿主侧 fixture：一个会 emit('ping') 的 SFC，带 scoped 样式（验证样式隔离）。
export const SANDBOX_SFC = `
<script setup lang="ts">
import { ref } from 'vue'
interface Props { label?: string; count?: number }
const props = withDefaults(defineProps<Props>(), { label: 'sandbox', count: 0 })
const emit = defineEmits<{ ping: [n: number] }>()
const local = ref(0)
function bump() { local.value++; emit('ping', local.value) }
</script>

<template>
  <div class="sbx">
    <h3 data-testid="sbx-label">{{ props.label }}</h3>
    <p data-testid="sbx-count">count={{ props.count }}</p>
    <button data-testid="sbx-bump" @click="bump">bump {{ local }}</button>
  </div>
</template>

<style scoped>
.sbx { color: rgb(0, 128, 0); }
</style>
`
