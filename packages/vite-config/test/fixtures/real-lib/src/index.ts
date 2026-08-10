import { computed, ref } from 'vue'

export { useToggle } from '@vueuse/core'

export interface CounterState {
  count: ReturnType<typeof ref<number>>
  doubled: ReturnType<typeof computed<number>>
}

/**
 * 创建真实库 fixture 的响应式状态，验证库构建不会打包外部依赖。
 */
export function createFixtureCounter(initial = 0): CounterState {
  const count = ref(initial)
  const doubled = computed(() => count.value * 2)

  return {
    count,
    doubled,
  }
}
