<script setup lang="ts">
import type { InputInstance } from 'element-plus'
import type { ScheduledHandler } from '../../utils'
import type {
  PopoverTableRow,
  PopoverTableSelectEmits,
  PopoverTableSelectProps,
  PopoverTableVirtualRef,
  ThrottleOrDebounceOptions,
} from './types'
import { ElInput } from 'element-plus'
import { computed, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { debounce, throttle } from '../../utils'
import PopoverTableSelectBase from './base/index.vue'

defineOptions({
  name: 'PopoverTableSelect',
  inheritAttrs: false,
})

type RuntimeProps = Omit<PopoverTableSelectProps, 'inputValue'>

const props = withDefaults(defineProps<RuntimeProps>(), {
  debounce: 0,
  throttle: 300,
  options: () => ({}),
  popType: 'input',
  placeholder: '点击或按下方向键试试',
  popoverProps: () => ({}),
  inputProps: () => ({}),
  virtualRef: null,
  successiveShowType: 'enter',
  onInput: undefined,
  enableLoadMore: false,
  hasMore: false,
  loading: false,
})

const emit = defineEmits<PopoverTableSelectEmits>()
const slots = defineSlots<Record<string, (params: any) => any>>()

const popoverModel = defineModel<boolean>({ default: false })
const inputValue = defineModel<string>('inputValue', { default: '' })

const inputRef = useTemplateRef<InputInstance>('inputRef')
const currentInputValue = shallowRef('')
const cachedInputValue = shallowRef('')
const isBaseMounted = shallowRef(false)
const scheduledSelect = shallowRef<ScheduledHandler<typeof handleSelect>>(createImmediateHandler(handleSelect))
const scheduledInput = shallowRef<ScheduledHandler<typeof handleInput>>(createImmediateHandler(handleInput))

const slotNames = computed<string[]>(() => Object.keys(slots))

const computedVirtualRef = computed<PopoverTableVirtualRef>(() => {
  return props.virtualRef || inputRef.value
})

const computedPlaceholder = computed<string>(() => {
  return cachedInputValue.value || props.placeholder
})

const computedOptions = computed<ThrottleOrDebounceOptions>(() => {
  const options = props.options
  return options.promise ? { trailing: true, ...options, leading: true } : { trailing: true, leading: false, ...options }
})

function handleFocus(): void {
  const shouldSyncEmptyInput = !popoverModel.value
  cachedInputValue.value = currentInputValue.value
  currentInputValue.value = ''
  popoverModel.value = true
  emit('focus')

  if (shouldSyncEmptyInput)
    handleInput(currentInputValue.value)
}

function handleBlur(): void {
  emit('blur')
  currentInputValue.value = cachedInputValue.value
  cachedInputValue.value = ''
}

function handleInput(value: string): void {
  if (props.successiveShowType === 'input')
    popoverModel.value = true

  inputValue.value = value
  emit('input', value)
  props.onInput?.(value)
}

function handleClear(): void {
  cachedInputValue.value = ''
  currentInputValue.value = ''
  popoverModel.value = false
  inputValue.value = ''
  emit('clear')
}

function handleSelect(row: PopoverTableRow): void {
  emit('select', row)
}

function handleEnter(row: PopoverTableRow): void {
  emit('enter', row)
  if (props.successiveShowType === 'enter')
    popoverModel.value = true
}

function handleScrollBoundary(payload: { direction: 'bottom' }): void {
  if (props.enableLoadMore && props.hasMore && payload.direction === 'bottom')
    emit('loadMore')
}

function noopScheduledAction(): void {
  return undefined
}

/**
 * 无调度配置时仍返回完整 ScheduledHandler，便于组件统一清理旧实例。
 */
function createImmediateHandler<T extends (...args: any[]) => void>(handler: T): ScheduledHandler<T> {
  const scheduled = ((...args: Parameters<T>): void => {
    handler(...args)
  }) as ScheduledHandler<T>

  scheduled.cancel = noopScheduledAction
  scheduled.flush = noopScheduledAction

  return scheduled
}

function createScheduledSelectHandler(): ScheduledHandler<typeof handleSelect> {
  if (props.debounce)
    return debounce(handleSelect, props.debounce, computedOptions.value)

  if (props.throttle)
    return throttle(handleSelect, props.throttle, computedOptions.value)

  return createImmediateHandler(handleSelect)
}

function createScheduledInputHandler(): ScheduledHandler<typeof handleInput> {
  if (props.debounce)
    return debounce(handleInput, props.debounce, computedOptions.value)

  if (props.throttle)
    return throttle(handleInput, props.throttle, computedOptions.value)

  return createImmediateHandler(handleInput)
}

function resetScheduledHandlers(): void {
  scheduledSelect.value.cancel()
  scheduledInput.value.cancel()
  scheduledSelect.value = createScheduledSelectHandler()
  scheduledInput.value = createScheduledInputHandler()
}

watch(
  [() => props.debounce, () => props.throttle, computedOptions],
  resetScheduledHandlers,
  { immediate: true },
)

watch(
  () => inputValue.value,
  (value) => {
    currentInputValue.value = value
    cachedInputValue.value = value
  },
  { immediate: true },
)

watch(
  computedVirtualRef,
  (virtualRef) => {
    /**
     * input 模式依赖内部 ElInput 作为虚拟触发源；等 ref 就绪后再挂载基座，
     * 避免弹层基座在空 virtualRef 上注册 DOM 事件。
     */
    if (virtualRef)
      isBaseMounted.value = true
  },
  { immediate: true },
)

onUnmounted(() => {
  scheduledSelect.value.cancel()
  scheduledInput.value.cancel()
})
</script>

<template>
  <div class="mx-popover-table-select">
    <PopoverTableSelectBase
      v-if="isBaseMounted"
      v-model="popoverModel"
      :virtual-ref="computedVirtualRef"
      :loading="props.loading"
      :popover-props="props.popoverProps"
      v-bind="$attrs"
      @scroll-boundary="handleScrollBoundary"
      @select="scheduledSelect"
      @enter="handleEnter"
    >
      <template v-for="name in slotNames" #[name]="slotParams" :key="name">
        <slot :name="name" v-bind="slotParams" />
      </template>
    </PopoverTableSelectBase>
    <ElInput
      v-if="props.popType === 'input'"
      ref="inputRef"
      v-bind="props.inputProps"
      v-model="currentInputValue"
      clearable
      :placeholder="computedPlaceholder"
      @focus="handleFocus"
      @blur="handleBlur"
      @input="scheduledInput"
      @clear="handleClear"
    />
  </div>
</template>

<style scoped>
.mx-popover-table-select {
  width: 100%;
}
</style>
