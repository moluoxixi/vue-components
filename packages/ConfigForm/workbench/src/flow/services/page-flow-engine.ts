import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { PageFlowEngine, PageFlowEngineOptions, WorkbenchPageFlowEngineOptions } from '../types'
import { createConfigFormEventRuntime } from '@moluoxixi/config-form-core'
import { computed, shallowRef } from 'vue'
import { createWorkbenchFlowActionRegistry } from './flow-actions'

export function createPageFlowEngine(options: PageFlowEngineOptions): PageFlowEngine {
  const currentProjection = shallowRef<ConfigFormReactionProjection<Record<string, unknown>>>({
    values: options.readValues(),
    props: {},
    states: {},
    validate: [],
  })
  const runtime = createConfigFormEventRuntime({
    ...options,
    onProjection: (projection) => { currentProjection.value = projection },
  })
  let pageKey = ''
  return {
    projection: computed(() => ({ ...currentProjection.value, values: options.readValues() })),
    sync(input) {
      runtime.sync(input.plans, { reset: input.pageKey !== pageKey })
      pageKey = input.pageKey
    },
    dispatch: input => runtime.dispatch(input),
    clear() {
      pageKey = ''
      runtime.clear()
    },
    dispose: runtime.dispose,
  }
}

export function createWorkbenchPageFlowEngine(options: WorkbenchPageFlowEngineOptions): PageFlowEngine {
  return createPageFlowEngine({
    ...options,
    actions: createWorkbenchFlowActionRegistry(options),
  })
}
