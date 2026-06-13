// 共享测试 fixture：一个真实的 AI 风格 Vue SFC 源码字符串。
// 刻意覆盖最硬的几点：
//  - <script setup lang="ts">  → 需要剥离 TS 类型
//  - 基于类型的 defineProps + withDefaults → 编译宏 + 类型擦除
//  - ref + computed 响应式 → 验证挂载后内部响应式有效
//  - 模板插值 + Props 渲染 → 验证外部改 Props 视图实时更新
//  - <style scoped> → 验证样式编译不报错

export interface DemoProps {
  label: string
  count: number
}

export const SAMPLE_SFC = `
<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  label: string
  count: number
}

const props = withDefaults(defineProps<Props>(), {
  label: 'default-label',
  count: 0,
})

const internal = ref(10)
const total = computed<number>(() => props.count + internal.value)

function bump(): void {
  internal.value++
}
</script>

<template>
  <div class="demo-card">
    <h3 data-testid="label">{{ props.label }}</h3>
    <p data-testid="count">count={{ props.count }}</p>
    <p data-testid="total">total={{ total }}</p>
    <button data-testid="bump" @click="bump">bump</button>
  </div>
</template>

<style scoped>
.demo-card { padding: 12px; border: 1px solid #ccc; border-radius: 6px; }
.demo-card h3 { color: #2563eb; }
</style>
`.trim()

// 故意有语法错误的 SFC，验证两条路线的错误处理（spike 要测边界，不只 happy path）。
export const BROKEN_SFC = `
<script setup lang="ts">
const x: number =   // 不完整赋值
</script>
<template><div>{{ x }}</div></template>
`.trim()
