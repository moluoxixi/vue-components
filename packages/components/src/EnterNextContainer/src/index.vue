<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { EnterNextContainerEmits, EnterNextContainerProps } from './types'
import { nextTick, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'

defineOptions({
  name: 'EnterNextContainer',
})

const props = withDefaults(defineProps<EnterNextContainerProps>(), {
  virtualRef: null,
  allowSelectNextInEmpty: false,
  focusNum: undefined,
  autoNext: true,
})

const emit = defineEmits<EnterNextContainerEmits>()

const containerRef = useTemplateRef<HTMLElement>('container')
const inputElements = shallowRef<HTMLElement[]>([])
let mutationObserver: MutationObserver | undefined
let mounted = false

/**
 * 兼容 Vue 组件实例与原生 HTMLElement，统一解析成可监听的 DOM 节点。
 */
function resolveElement(target: EnterNextContainerProps['virtualRef'] | HTMLElement | undefined): HTMLElement {
  const instanceElement = (target as ComponentPublicInstance | undefined)?.$el
  const element = instanceElement === undefined ? target : instanceElement
  if (!element)
    throw new Error('[EnterNextContainer] A DOM element is required before collecting inputs.')

  return element as HTMLElement
}

function getObserveElement(): HTMLElement {
  return resolveElement(props.virtualRef || containerRef.value)
}

function getCandidateElements(): HTMLElement[] {
  return Array.from(getObserveElement().querySelectorAll<HTMLElement>('input, select, textarea'))
}

function getEnabledElements(): HTMLElement[] {
  return getCandidateElements().filter(element => !element.hasAttribute('disabled'))
}

/**
 * 下拉控件展开但没有活动选项时，默认不自动跳转，避免吞掉用户确认选择的回车。
 */
function shouldStopForEmptySelect(element: HTMLElement): boolean {
  const expanded = element.getAttribute('aria-expanded') === 'true'
  const activeDescendant = element.getAttribute('aria-activedescendant')
  return expanded && !activeDescendant && !props.allowSelectNextInEmpty
}

function focusInitialElement(): void {
  if (props.focusNum === undefined)
    return

  const candidates = props.autoNext ? inputElements.value : getCandidateElements()
  const target = candidates[props.focusNum - 1]
  target?.focus()

  if (target?.getAttribute('aria-expanded') === 'false')
    target.click()
}

/**
 * 重新收集输入控件并刷新事件监听，DOM 结构变化后会调用此函数。
 */
function collectInputElements(shouldFocus = false): void {
  inputElements.value.forEach((element) => {
    element.removeEventListener('keyup', handleInputKeyUp)
  })

  inputElements.value = getEnabledElements()
  inputElements.value.forEach((element) => {
    element.addEventListener('keyup', handleInputKeyUp)
  })

  if (shouldFocus)
    focusInitialElement()
}

function handleInputKeyUp(event: KeyboardEvent): void {
  if (event.key !== 'Enter')
    return

  event.preventDefault()

  const activeElement = event.target as HTMLElement
  if (shouldStopForEmptySelect(activeElement)) {
    emit('noSelectValue', activeElement)
    return
  }

  const currentIndex = inputElements.value.findIndex(element => element === activeElement)
  const nextElement = inputElements.value[currentIndex + 1]

  if (nextElement) {
    nextElement.focus()
    return
  }

  emit('noNextInput', activeElement)
}

/** 断开并释放当前 MutationObserver，避免旧回调继续持有组件闭包。 */
function disconnectObserver(): void {
  mutationObserver?.disconnect()
  mutationObserver = undefined
}

function resetObserver(): void {
  disconnectObserver()
  collectInputElements()

  mutationObserver = new MutationObserver(() => {
    collectInputElements()
  })
  mutationObserver.observe(getObserveElement(), {
    childList: true,
    subtree: true,
  })
}

watch(
  () => props.virtualRef,
  () => {
    if (mounted)
      resetObserver()
  },
)

onMounted(() => {
  mounted = true
  nextTick(() => {
    if (!mounted)
      return

    resetObserver()
    collectInputElements(true)
  })
})

onUnmounted(() => {
  mounted = false
  inputElements.value.forEach((element) => {
    element.removeEventListener('keyup', handleInputKeyUp)
  })
  inputElements.value = []
  disconnectObserver()
})
</script>

<template>
  <div v-if="!props.virtualRef" ref="container" class="mx-enter-next-container">
    <slot />
  </div>
</template>

<style scoped>
.mx-enter-next-container {
  width: 100%;
}
</style>
