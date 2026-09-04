import type {
  ConfigFormFlow,
  ConfigFormFlowTrigger,
} from '@moluoxixi/config-form-core'
import type { ProjectCommand, ProjectCommandAction } from '@moluoxixi/config-form-model'
import type {
  FlowTriggerChoice,
  FlowTriggerGroup,
  FlowWorkspaceProps,
} from '../types'
import type { FlowEditAction } from '../types/edit-action'
import { analyzeConfigFormFlow } from '@moluoxixi/config-form-core'
import { createDesignerLocale, useDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { flowEventTargetKey } from '../../../../../flow'
import { cloneWorkbenchJson } from '../../../../../utils'
import { useFlowGraph } from './use-flow-graph'

export function useFlowWorkspace(options: {
  emit: (event: 'command', command: ProjectCommand) => void
  props: Readonly<FlowWorkspaceProps>
}) {
  const { emit, props } = options
  let commandSequence = 0
  const inheritedLocale = useDesignerLocale()
  const locale = computed(() => props.locale ? createDesignerLocale(props.locale) : inheritedLocale)
  const selectedId = ref<string>()
  const flowCreatorOpen = ref(false)
  const graphError = ref('')
  const addFlowButton = useTemplateRef<{ $el?: HTMLButtonElement }>('addFlowButton')
  const flowCreator = useTemplateRef<{ handleClose: () => void, handleOpen: () => void }>('flowCreator')

  watch(() => props.flows, (flows) => {
    if (!flows.some(flow => flow.id === selectedId.value))
      selectedId.value = flows[0]?.id
  }, { immediate: true, deep: true })

  const selectedFlow = computed(() => props.flows.find(flow => flow.id === selectedId.value))
  const selectedEventTarget = computed(() => {
    const trigger = selectedFlow.value?.trigger
    if (trigger?.kind !== 'component.event')
      return undefined
    return props.eventTargets?.find(target => target.nodeId === trigger.nodeId && target.event === trigger.event)
  })
  const selectedEventTargetValue = computed(() => selectedEventTarget.value
    ? flowEventTargetKey(selectedEventTarget.value)
    : '')
  const triggerChoices = computed<FlowTriggerChoice[]>(() => {
    const choices: FlowTriggerChoice[] = [
      createTriggerChoice(
        { kind: 'page.mount' },
        'lifecycle',
        locale.value.t('flow.trigger.mount', 'Page mount'),
        'page.mount',
      ),
      createTriggerChoice(
        { kind: 'form.submit' },
        'form',
        locale.value.t('flow.trigger.submit', 'Form submit'),
        'form.submit',
      ),
    ]
    for (const field of [...new Set(props.fieldNames ?? [])]) {
      choices.push(createTriggerChoice(
        { kind: 'field.change', field },
        'field',
        `${field} · ${locale.value.t('flow.trigger.change', 'Field change')}`,
        'field.change',
      ))
    }
    for (const target of props.eventTargets ?? []) {
      choices.push(createTriggerChoice(
        { kind: 'component.event', nodeId: target.nodeId, event: target.event },
        'component',
        `${target.nodeLabel} · ${target.eventLabel}`,
        target.event,
      ))
    }
    return choices
  })
  const triggerGroups = computed(() => (['lifecycle', 'form', 'field', 'component'] as const)
    .map(group => ({
      group,
      label: locale.value.t(`flow.triggerGroup.${group}`, group[0]!.toUpperCase() + group.slice(1)),
      choices: triggerChoices.value.filter(choice => choice.group === group),
    }))
    .filter(group => group.choices.length > 0))
  const initialTriggerKey = computed(() => props.initialTrigger ? triggerKey(props.initialTrigger) : '')

  watch(() => props.initialTrigger, (trigger) => {
    if (!trigger)
      return
    const matchingFlow = props.flows.find(flow => triggersEqual(flow.trigger, trigger))
    if (matchingFlow) {
      selectedId.value = matchingFlow.id
      closeFlowCreator()
      return
    }
    openFlowCreator()
  }, { immediate: true, deep: true })

  function emitCommand(label: string, action: ProjectCommandAction): void {
    emit('command', {
      id: `flow-${Date.now().toString(36)}-${++commandSequence}`,
      label,
      actions: [cloneWorkbenchJson(action)],
    })
  }

  function commitSelectedFlow(candidate: ConfigFormFlow, action: FlowEditAction): boolean {
    if (props.readonly)
      return false
    const analyzed = analyzeConfigFormFlow(candidate)
    if (!analyzed.success) {
      graphError.value = analyzed.diagnostics[0]?.message ?? locale.value.t('flow.invalid', 'Flow is invalid')
      return false
    }
    graphError.value = ''
    emitCommand('Update flow', action)
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

  function addFlow(trigger: ConfigFormFlowTrigger): void {
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
    emitCommand('Add flow', {
      type: 'operation.apply',
      operations: [{ type: 'flow.add', pageId: props.pageId, flow }],
    })
    selectedId.value = id
    closeFlowCreator()
  }

  function createTriggerChoice(
    trigger: ConfigFormFlowTrigger,
    group: FlowTriggerGroup,
    label: string,
    detail: string,
  ): FlowTriggerChoice {
    return { detail, group, key: triggerKey(trigger), label, trigger }
  }

  function triggerKey(trigger: ConfigFormFlowTrigger): string {
    if (trigger.kind === 'field.change')
      return JSON.stringify([trigger.kind, trigger.field ?? ''])
    if (trigger.kind === 'component.event')
      return JSON.stringify([trigger.kind, trigger.nodeId ?? '', trigger.event ?? ''])
    return JSON.stringify([trigger.kind])
  }

  function triggersEqual(left: ConfigFormFlowTrigger, right: ConfigFormFlowTrigger): boolean {
    return triggerKey(left) === triggerKey(right)
  }

  function flowTriggerLabel(trigger: ConfigFormFlowTrigger): string {
    const choice = triggerChoices.value.find(candidate => triggersEqual(candidate.trigger, trigger))
    if (choice)
      return choice.label
    if (trigger.kind === 'field.change')
      return `${trigger.field ?? locale.value.t('flow.eventUnavailable', 'Registered event unavailable')} · ${locale.value.t('flow.trigger.change', 'Field change')}`
    if (trigger.kind === 'component.event')
      return `${trigger.nodeId ?? '?'} · ${trigger.event ?? locale.value.t('flow.eventUnavailable', 'Registered event unavailable')}`
    return locale.value.t(`flow.trigger.${trigger.kind === 'page.mount' ? 'mount' : 'submit'}`, trigger.kind)
  }

  function openFlowCreator(): void {
    if (props.readonly)
      return
    flowCreatorOpen.value = true
    void nextTick(() => {
      addFlowButton.value?.$el?.focus()
      flowCreator.value?.handleOpen()
    })
  }

  function closeFlowCreator(): void {
    flowCreatorOpen.value = false
    flowCreator.value?.handleClose()
  }

  function removeFlow(id: string): void {
    if (!props.readonly) {
      emitCommand('Remove flow', {
        type: 'operation.apply',
        operations: [{ type: 'flow.remove', pageId: props.pageId, flowId: id }],
      })
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

  function updateTrigger(kind: ConfigFormFlow['trigger']['kind']): void {
    if (kind === 'field.change') {
      const field = selectedFlow.value?.trigger.field ?? props.fieldNames?.[0]
      if (!field) {
        graphError.value = locale.value.t('flow.fieldRequired', 'Select a registered field first')
        return
      }
      patchSelected({ trigger: { kind, field } })
      return
    }
    if (kind === 'component.event') {
      const target = selectedEventTarget.value ?? props.eventTargets?.[0]
      if (!target) {
        graphError.value = locale.value.t('flow.eventRequired', 'Select a registered component event first')
        return
      }
      patchSelected({ trigger: { kind, nodeId: target.nodeId, event: target.event } })
      return
    }
    patchSelected({ trigger: { kind } })
  }

  function updateTriggerField(field: string): void {
    if (selectedFlow.value?.trigger.kind === 'field.change' && field)
      patchSelected({ trigger: { kind: 'field.change', field } })
  }

  function updateTriggerEvent(value: string): void {
    if (selectedFlow.value?.trigger.kind !== 'component.event' || !value)
      return
    try {
      const parsed = JSON.parse(value) as unknown
      if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== 'string' || typeof parsed[1] !== 'string')
        throw new TypeError('Invalid component event target')
      const target = props.eventTargets?.find(candidate => candidate.nodeId === parsed[0] && candidate.event === parsed[1])
      if (!target) {
        graphError.value = locale.value.t('flow.eventRequired', 'Select a registered component event first')
        return
      }
      patchSelected({ trigger: { kind: 'component.event', nodeId: target.nodeId, event: target.event } })
    }
    catch {
      graphError.value = locale.value.t('flow.eventRequired', 'Select a registered component event first')
    }
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
    readonly: () => !!props.readonly,
    selectedFlow,
  })

  return {
    ...graph,
    addFlow,
    closeFlowCreator,
    flowCreatorOpen,
    flowTriggerLabel,
    graphError,
    initialTriggerKey,
    locale,
    openFlowCreator,
    patchSelected,
    removeFlow,
    selectedEventTarget,
    selectedEventTargetValue,
    selectedFlow,
    selectedId,
    triggerGroups,
    updateConcurrency,
    updateErrorPolicy,
    updateTimeout,
    updateTrigger,
    updateTriggerEvent,
    updateTriggerField,
  }
}
