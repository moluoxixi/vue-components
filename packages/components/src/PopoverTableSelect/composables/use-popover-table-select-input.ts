import type { InputInstance } from 'element-plus'
import type { Ref } from 'vue'
import type {
  PopoverTableRow,
  PopoverTableSelectEmits,
  PopoverTableSelectRuntimeProps,
  PopoverTableVirtualRef,
} from '../types'
import { computed, shallowRef, watch } from 'vue'

interface PopoverTableSelectInputModels {
  inputValue: Ref<string>
  popoverVisible: Ref<boolean>
}

export function usePopoverTableSelectInput(
  props: Readonly<PopoverTableSelectRuntimeProps>,
  emit: PopoverTableSelectEmits,
  models: PopoverTableSelectInputModels,
  inputRef: Readonly<Ref<InputInstance | null>>,
) {
  const currentInputValue = shallowRef('')
  const cachedInputValue = shallowRef('')
  const isBaseMounted = shallowRef(false)

  const computedVirtualRef = computed<PopoverTableVirtualRef>(() => {
    return props.virtualRef || inputRef.value
  })

  const computedPlaceholder = computed<string>(() => {
    return cachedInputValue.value || props.placeholder || ''
  })

  function handleFocus(): void {
    const shouldSyncEmptyInput = !models.popoverVisible.value
    cachedInputValue.value = currentInputValue.value
    currentInputValue.value = ''
    models.popoverVisible.value = true
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
      models.popoverVisible.value = true

    models.inputValue.value = value
    emit('input', value)
    props.onInput?.(value)
  }

  function handleClear(): void {
    cachedInputValue.value = ''
    currentInputValue.value = ''
    models.popoverVisible.value = false
    models.inputValue.value = ''
    emit('clear')
  }

  function handleEnter(row: PopoverTableRow): void {
    emit('enter', row)
    if (props.successiveShowType === 'enter')
      models.popoverVisible.value = true
  }

  watch(
    () => models.inputValue.value,
    (value) => {
      currentInputValue.value = value
      cachedInputValue.value = value
    },
    { immediate: true },
  )

  watch(
    computedVirtualRef,
    (virtualRef) => {
      if (virtualRef)
        isBaseMounted.value = true
    },
    { immediate: true },
  )

  return {
    computedPlaceholder,
    computedVirtualRef,
    currentInputValue,
    handleBlur,
    handleClear,
    handleEnter,
    handleFocus,
    handleInput,
    isBaseMounted,
  }
}
