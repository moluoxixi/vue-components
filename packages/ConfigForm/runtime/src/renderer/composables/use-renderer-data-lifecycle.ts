import type {
  ConfigFormLifecycleHook,
  ConfigFormLifecycleKind,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { ConfigFormRendererEmits, ConfigFormRendererProps } from '../types'
import type { RendererControllerState } from '../types/internal'
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRendererData } from './use-renderer-data'

export function useRendererDataLifecycle<TValues extends ConfigFormValues>(options: {
  props: Readonly<ConfigFormRendererProps<TValues>>
  emit: ConfigFormRendererEmits<TValues>
  controller: () => RendererControllerState<TValues>
}) {
  const { props } = options
  let disposed = false
  let generation = 0
  let mounted = false
  const data = useRendererData({
    ...options,
    canPublish: () => mounted && !disposed && props.mode !== 'design',
  })

  const lifecycle: ConfigFormLifecycleHook<TValues> = (kind, context) => {
    if (props.mode === 'design' || disposed)
      return true
    if (kind === 'form.reset')
      data.reset(context.fields !== undefined)
    else if (kind === 'form.valuesChange')
      data.refresh()
    return true
  }

  function hasLifecycle(kind: ConfigFormLifecycleKind): boolean {
    return !disposed
      && props.mode !== 'design'
      && (kind === 'form.initialize' || kind === 'form.valuesChange' || kind === 'form.reset')
  }

  function activate(): void {
    const token = ++generation
    data.stop()
    data.prepare()
    if (!mounted || disposed || props.mode === 'design')
      return
    void options.controller().runLifecycle('form.initialize').then((initialized) => {
      if (initialized && mounted && !disposed && token === generation)
        data.start()
    })
  }

  watch(
    [() => props.mode, () => props.plan, () => props.dataSourceHost, () => props.fields],
    activate,
    { deep: true },
  )

  onMounted(() => {
    mounted = true
    activate()
  })

  onBeforeUnmount(() => {
    mounted = false
    disposed = true
    generation += 1
    data.stop()
    options.controller().dispose()
  })

  return {
    cancelScope: data.cancelScope,
    data,
    hasLifecycle,
    lifecycle,
  }
}
