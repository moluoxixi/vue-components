import type { ScheduledHandler } from '../../../utils'
import type { PopoverTableSelectRuntimeProps, ThrottleOrDebounceOptions } from '../types'
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { debounce, throttle } from '../../../utils'

function noopScheduledAction(): void {
  return undefined
}

function createImmediateHandler<T extends (...args: any[]) => void>(handler: T): ScheduledHandler<T> {
  const scheduled = ((...args: Parameters<T>): void => {
    handler(...args)
  }) as ScheduledHandler<T>

  scheduled.cancel = noopScheduledAction
  scheduled.flush = noopScheduledAction

  return scheduled
}

export function usePopoverTableSelectScheduling<
  TSelect extends (...args: any[]) => void,
  TInput extends (...args: any[]) => void,
>(
  props: Readonly<PopoverTableSelectRuntimeProps>,
  handleSelect: TSelect,
  handleInput: TInput,
) {
  const computedOptions = computed<ThrottleOrDebounceOptions>(() => {
    const options = props.options ?? {}
    return options.promise
      ? { trailing: true, ...options, leading: true }
      : { trailing: true, leading: false, ...options }
  })

  const scheduledSelect = shallowRef<ScheduledHandler<TSelect>>(createImmediateHandler(handleSelect))
  const scheduledInput = shallowRef<ScheduledHandler<TInput>>(createImmediateHandler(handleInput))

  function createScheduledHandler<T extends (...args: any[]) => void>(handler: T): ScheduledHandler<T> {
    if (props.debounce)
      return debounce(handler, props.debounce, computedOptions.value)

    if (props.throttle)
      return throttle(handler, props.throttle, computedOptions.value)

    return createImmediateHandler(handler)
  }

  function resetScheduledHandlers(): void {
    scheduledSelect.value.cancel()
    scheduledInput.value.cancel()
    scheduledSelect.value = createScheduledHandler(handleSelect)
    scheduledInput.value = createScheduledHandler(handleInput)
  }

  watch(
    [() => props.debounce, () => props.throttle, computedOptions],
    resetScheduledHandlers,
    { immediate: true },
  )

  onUnmounted(() => {
    scheduledSelect.value.cancel()
    scheduledInput.value.cancel()
  })

  return {
    scheduledInput,
    scheduledSelect,
  }
}
