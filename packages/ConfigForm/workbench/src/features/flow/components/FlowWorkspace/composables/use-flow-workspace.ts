import type {
  ConfigFormFlow,
  ConfigFormFlowTrigger,
} from '@moluoxixi/config-form-core'
import type { ProjectCommand, ProjectCommandAction } from '@moluoxixi/config-form-model'
import type {
  FlowWorkspaceProps,
} from '../types'
import type { FlowEditAction } from '../types/edit-action'
import { analyzeConfigFormFlow, getConfigFormFlowTriggerKey } from '@moluoxixi/config-form-core'
import { createDesignerLocale, useDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, ref, shallowRef, watch } from 'vue'
import { cloneWorkbenchJson } from '../../../../../utils'
import { useFlowGraph } from './use-flow-graph'

export function useFlowWorkspace(options: {
  emit: (event: 'command', command: ProjectCommand) => void
  onClose: () => void
  props: Readonly<FlowWorkspaceProps>
}) {
  const { emit, onClose, props } = options
  let commandSequence = 0
  const inheritedLocale = useDesignerLocale()
  const locale = computed(() => props.locale ? createDesignerLocale(props.locale) : inheritedLocale)
  const selectedId = ref<string>()
  const draftFlow = shallowRef<ConfigFormFlow>()
  const draftCommitted = ref(false)
  const graphError = ref('')

  const lockedTrigger = computed(() => props.initialTrigger)
  const scopedFlows = computed(() => props.flows.filter(flow => triggersEqual(flow.trigger, props.initialTrigger)))
  const flows = computed(() => draftFlow.value ? [draftFlow.value] : scopedFlows.value)
  const triggerConflict = computed(() => scopedFlows.value.length > 1)
  const triggerConflictMessage = computed(() => triggerConflict.value
    ? locale.value.t('flow.triggerConflict', 'This event has multiple flows configured. Remove the duplicate flow before editing.')
    : '')

  watch([scopedFlows, draftFlow], ([nextFlows, draft]) => {
    if (draft && nextFlows.some(flow => flow.id === draft.id)) {
      draftFlow.value = undefined
      draftCommitted.value = false
      nextFlows = scopedFlows.value
    }
    if (!nextFlows.some(flow => flow.id === selectedId.value))
      selectedId.value = nextFlows[0]?.id
  }, { immediate: true, deep: true })

  const selectedFlow = computed(() => flows.value.find(flow => flow.id === selectedId.value) ?? flows.value[0])

  function emitCommand(label: string, action: ProjectCommandAction): void {
    emit('command', {
      id: `flow-${Date.now().toString(36)}-${++commandSequence}`,
      label,
      actions: [cloneWorkbenchJson(action)],
    })
  }

  function commitSelectedFlow(candidate: ConfigFormFlow, action: FlowEditAction): boolean {
    if (props.readonly || triggerConflict.value)
      return false
    if (!triggersEqual(candidate.trigger, lockedTrigger.value)) {
      graphError.value = locale.value.t('flow.triggerLocked', 'The event source is locked to the entry event.')
      return false
    }
    const analyzed = analyzeConfigFormFlow(candidate)
    if (!analyzed.success) {
      graphError.value = analyzed.diagnostics[0]?.message ?? locale.value.t('flow.invalid', 'Flow is invalid')
      return false
    }
    graphError.value = ''
    if (draftFlow.value?.id === candidate.id && !draftCommitted.value) {
      draftFlow.value = candidate
      draftCommitted.value = true
      emitCommand('Add flow', {
        type: 'operation.apply',
        operations: [{ type: 'flow.add', pageId: props.pageId, flow: candidate }],
      })
    }
    else {
      emitCommand('Update flow', action)
    }
    return true
  }

  function selectedFlowSettings(flow: ConfigFormFlow): Extract<ProjectCommandAction, { type: 'flow.settings' }>['settings'] {
    return {
      name: flow.name,
      trigger: cloneWorkbenchJson(flow.trigger),
      ...(flow.concurrency === undefined ? {} : { concurrency: flow.concurrency }),
      ...(flow.errorPolicy === undefined ? {} : { errorPolicy: cloneWorkbenchJson(flow.errorPolicy) }),
    }
  }

  function addFlow(): void {
    const trigger = lockedTrigger.value
    if (scopedFlows.value.length > 0 || draftFlow.value)
      return
    const ids = new Set(props.flows.map(flow => flow.id))
    let index = props.flows.length + 1
    while (ids.has(`flow-${index}`)) index += 1
    const id = `flow-${index}`
    const flow: ConfigFormFlow = {
      version: 1,
      id,
      name: locale.value.t('flow.defaultName', 'On {event}', { event: flowTriggerLabel(trigger) }),
      trigger: cloneWorkbenchJson(trigger),
      concurrency: 'latest',
      errorPolicy: { onError: 'end', timeoutMs: 10000 },
      nodes: [
        { id: `${id}-trigger`, type: 'trigger', position: { x: 60, y: 140 } },
        { id: `${id}-end`, type: 'end', position: { x: 420, y: 140 } },
      ],
      edges: [{ id: `${id}-next`, source: `${id}-trigger`, target: `${id}-end`, condition: 'next' }],
    }
    draftFlow.value = flow
    draftCommitted.value = false
    selectedId.value = id
  }

  function triggersEqual(left: ConfigFormFlowTrigger, right: ConfigFormFlowTrigger): boolean {
    return getConfigFormFlowTriggerKey(left) === getConfigFormFlowTriggerKey(right)
  }

  function flowTriggerLabel(trigger: ConfigFormFlowTrigger): string {
    if (trigger.kind === 'component.event') {
      const target = props.eventTargets?.find(candidate => candidate.nodeId === trigger.nodeId && candidate.event === trigger.event)
      return target
        ? `${target.nodeLabel} · ${target.eventLabel}`
        : `${trigger.nodeId ?? '?'} · ${trigger.event ?? locale.value.t('flow.eventUnavailable', 'Registered event unavailable')}`
    }
    return trigger.kind === 'page.mount'
      ? locale.value.t('flow.trigger.mount', 'Form load')
      : locale.value.t('flow.trigger.submit', 'Form submit')
  }

  function removeFlow(id: string): void {
    if (draftFlow.value?.id === id) {
      draftFlow.value = undefined
      draftCommitted.value = false
      selectedId.value = undefined
      return
    }
    if (!props.readonly) {
      emitCommand('Remove flow', {
        type: 'operation.apply',
        operations: [{ type: 'flow.remove', pageId: props.pageId, flowId: id }],
      })
      onClose()
    }
  }

  function patchSelected(patch: Partial<ConfigFormFlow>): void {
    const flow = selectedFlow.value
    if (!flow)
      return
    const candidate = { ...cloneWorkbenchJson(flow), ...patch }
    commitSelectedFlow(candidate, {
      type: 'flow.settings',
      pageId: props.pageId,
      flowId: candidate.id,
      settings: selectedFlowSettings(candidate),
    })
  }

  function updateConcurrency(value: string): void {
    if (value === 'latest' || value === 'queue' || value === 'ignore')
      patchSelected({ concurrency: value })
  }

  function updateErrorPolicy(onError: 'failure' | 'end'): void {
    patchSelected({
      errorPolicy: {
        onError,
        timeoutMs: selectedFlow.value?.errorPolicy?.timeoutMs ?? 10000,
      },
    })
  }

  function updateTimeout(value: number | undefined): void {
    const timeoutMs = Number(value)
    if (Number.isInteger(timeoutMs) && timeoutMs >= 0) {
      patchSelected({
        errorPolicy: {
          onError: selectedFlow.value?.errorPolicy?.onError ?? 'end',
          timeoutMs,
        },
      })
    }
  }

  const graph = useFlowGraph({
    commitSelectedFlow,
    flowTriggerLabel,
    graphError,
    locale,
    pageId: () => props.pageId,
    readonly: () => !!props.readonly || triggerConflict.value,
    selectedFlow,
  })

  return {
    ...graph,
    addFlow,
    flowTriggerLabel,
    graphError,
    lockedTrigger,
    triggerConflict,
    triggerConflictMessage,
    locale,
    patchSelected,
    removeFlow,
    selectedFlow,
    selectedId,
    updateConcurrency,
    updateErrorPolicy,
    updateTimeout,
  }
}
