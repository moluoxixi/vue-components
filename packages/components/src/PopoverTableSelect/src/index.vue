<script setup lang="ts">
import type { InputInstance } from 'element-plus'
import type {
  PopoverTableRow,
  PopoverTableSelectEmits,
  PopoverTableSelectProps,
  PopoverTableVirtualRef,
  ThrottleOrDebounceOptions,
} from './types'
import { ElInput } from 'element-plus'
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
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
  popType: 'default',
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
  cachedInputValue.value = currentInputValue.value
  currentInputValue.value = ''
  emit('focus')

  if (!popoverModel.value)
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

const scheduledSelect = computed(() => {
  if (props.debounce)
    return debounce(handleSelect, props.debounce, computedOptions.value)

  if (props.throttle)
    return throttle(handleSelect, props.throttle, computedOptions.value)

  return handleSelect
})

const scheduledInput = computed(() => {
  if (props.debounce)
    return debounce(handleInput, props.debounce, computedOptions.value)

  if (props.throttle)
    return throttle(handleInput, props.throttle, computedOptions.value)

  return handleInput
})

watch(
  () => inputValue.value,
  (value) => {
    currentInputValue.value = value
    cachedInputValue.value = value
  },
  { immediate: true },
)
</script>

<template>
  <div class="mx-popover-table-select">
    <PopoverTableSelectBase
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
