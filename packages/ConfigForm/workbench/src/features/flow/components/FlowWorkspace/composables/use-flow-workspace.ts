import type {
  ConfigFormFlow,
  ConfigFormFlowActionDescriptor,
  ConfigFormFlowMetadata,
  ConfigFormFlowReactionStep,
  ConfigFormFlowStep,
  ConfigFormFlowStepOutput,
  ConfigFormFlowStepPolicy,
  ConfigFormFlowTrigger,
  ConfigFormJsonObject,
  ConfigFormValueInput,
} from '@moluoxixi/config-form-core'
import type { ProjectCommand, ProjectOperation } from '@moluoxixi/config-form-model'
import type {
  FlowFieldOption,
  FlowOutputOption,
  FlowStepTarget,
  FlowWorkspaceDiagnostic,
  FlowWorkspaceProps,
} from '../types'
import {
  cloneConfigFormFlowSteps,
  CONFIG_FORM_FLOW_VERSION,
  createConfigFormFlowFromSteps,
  getConfigFormFlowSemanticHash,
  getConfigFormFlowStepOutputs,
  getConfigFormFlowTriggerKey,
  listConfigFormBuiltinFlowActionDescriptors,
  readConfigFormFlowSteps,
} from '@moluoxixi/config-form-core'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { ElMessageBox } from 'element-plus'
import { computed, ref, shallowRef, watch } from 'vue'
import { cloneWorkbenchJson as structuredClone } from '../../../../../utils'
import {
  canMoveFlowStep,
  collectFlowStepIds,
  findFlowStep,
  flattenFlowSteps,
  insertFlowStepDraft,
  moveFlowStepDraft,
  removeFlowStepDraft,
  replaceFlowStepDraft,
} from '../services'

interface FlowWorkspaceOptions {
  onClose: () => void
  props: Readonly<FlowWorkspaceProps>
}

export function useFlowWorkspace(options: FlowWorkspaceOptions) {
  const { onClose, props } = options
  const locale = computed(() => createDesignerLocale(props.locale))
  const draftMetadata = shallowRef<ConfigFormFlowMetadata>()
  const steps = shallowRef<ConfigFormFlowStep[]>([])
  const selectedStepId = ref<string>()
  const hasDraft = ref(false)
  const removed = ref(false)
  const representable = ref(true)
  const importDiagnostics = ref<FlowWorkspaceDiagnostic[]>([])
  const saveDiagnostics = ref<FlowWorkspaceDiagnostic[]>([])
  const flowSnapshotConflict = ref(false)
  const saving = ref(false)

  let sessionTriggerKey = ''
  let originalFlow: ConfigFormFlow | undefined
  let originalFlowId: string | undefined
  let baseHash: string | undefined
  let baseFingerprint = ''
  let commandSequence = 0
  let stepSequence = 0

  const lockedTrigger = computed(() => props.initialTrigger)
  const scopedFlows = computed(() => props.flows.filter(flow => triggersEqual(flow.trigger, props.initialTrigger)))
  const triggerConflict = computed(() => scopedFlows.value.length > 1)
  const actionDescriptors = computed<readonly ConfigFormFlowActionDescriptor[]>(() => {
    const supplied = props.actionDescriptors
    return supplied === undefined ? listConfigFormBuiltinFlowActionDescriptors() : supplied
  })
  const descriptorByRef = computed(() => new Map(actionDescriptors.value.map(descriptor => [descriptor.ref, descriptor])))
  const selectedStep = computed(() => findFlowStep(steps.value, selectedStepId.value))
  const treeEntries = computed(() => flattenFlowSteps(steps.value))
  const selectedDescriptor = computed(() => selectedStep.value?.type === 'action'
    ? descriptorByRef.value.get(selectedStep.value.ref)
    : undefined)
  const fields = computed<FlowFieldOption[]>(() => {
    const entries: FlowFieldOption[] = []
    props.referenceFields?.forEach((field) => {
      entries.push({ nodeId: field.nodeId, field: field.field, label: field.label })
    })
    props.eventTargets?.forEach((target) => {
      if (target.field)
        entries.push({ nodeId: target.nodeId, field: target.field, label: target.nodeLabel })
    })
    const seen = new Set<string>()
    return entries.filter((entry) => {
      if (!entry.nodeId || !entry.field || seen.has(entry.nodeId))
        return false
      seen.add(entry.nodeId)
      return true
    })
  })
  const eventArguments = computed(() => props.sourceCatalog?.eventArguments?.length
    ? [...props.sourceCatalog.eventArguments]
    : [
        { value: 'args.0', path: ['args', '0'], label: locale.value.t('flow.source.eventValue', 'Event value') },
        { value: 'field', path: ['field'], label: locale.value.t('flow.source.eventField', 'Event field') },
      ])
  const outputOptions = computed<FlowOutputOption[]>(() => {
    const step = selectedStep.value
    if (!step)
      return []
    const available = getConfigFormFlowStepOutputs(steps.value, step.id) as ConfigFormFlowStepOutput[]
    const options: FlowOutputOption[] = []
    for (const output of available) {
      const action = findFlowStep(steps.value, output.stepId)
      if (action?.type !== 'action')
        continue
      const descriptor = descriptorByRef.value.get(action.ref)
      const actionLabel = action.title?.trim()
        || (descriptor ? descriptorTitle(descriptor) : locale.value.t('flow.step.action', 'Action'))
      options.push({
        key: `${output.stepId}:*`,
        label: locale.value.t('flow.source.actionResult', '{action} result', { action: actionLabel }),
        value: { $ref: { kind: 'output', stepId: output.stepId } },
      })
      for (const item of descriptor?.outputs ?? []) {
        const path = descriptorOutputPath(item)
        options.push({
          key: `${output.stepId}:${JSON.stringify(path)}`,
          label: `${actionLabel} · ${locale.value.t(`flow.actionOutput.${action.ref}.${item.name}`, item.title)}`,
          value: { $ref: { kind: 'output', stepId: output.stepId, path } },
        })
      }
    }
    return options
  })
  const dirty = computed(() => {
    if (!originalFlow)
      return hasDraft.value
    if (removed.value)
      return true
    if (!hasDraft.value || !representable.value)
      return false
    return draftFingerprint() !== baseFingerprint
  })
  const blocked = computed(() => !!props.readonly || triggerConflict.value || flowSnapshotConflict.value)
  const canEdit = computed(() => hasDraft.value && !removed.value && representable.value && !blocked.value)
  const diagnostics = computed<FlowWorkspaceDiagnostic[]>(() => {
    const result = [...importDiagnostics.value, ...saveDiagnostics.value]
    if (triggerConflict.value) {
      result.unshift({
        code: 'FLOW_TRIGGER_DUPLICATE',
        message: locale.value.t('flow.triggerConflict', 'This event has multiple flows. Remove the duplicate before editing.'),
      })
    }
    if (flowSnapshotConflict.value) {
      result.unshift({
        code: 'FLOW_DRAFT_CONFLICT',
        message: locale.value.t('flow.externalConflict', 'This flow changed outside the editor. Close and reopen it before saving.'),
      })
    }
    return result
  })
  const invalidParameters = computed(() => {
    const stepId = selectedStepId.value
    if (!stepId)
      return []
    const names = diagnostics.value
      .map(diagnostic => diagnosticTarget(diagnostic))
      .filter(target => target.stepId === stepId && target.parameter)
      .map(target => target.parameter!)
    return [...new Set(names)]
  })

  watch(
    () => getConfigFormFlowTriggerKey(props.initialTrigger),
    key => initializeSession(key),
    { immediate: true },
  )
  watch(
    () => props.flows,
    () => detectExternalConflict(),
    { deep: true },
  )
  watch(selectedStep, (step) => {
    if (!step && selectedStepId.value)
      selectedStepId.value = undefined
  })

  function initializeSession(triggerKey: string): void {
    sessionTriggerKey = triggerKey
    originalFlow = scopedFlows.value[0] ? structuredClone(scopedFlows.value[0]) : undefined
    originalFlowId = originalFlow?.id
    baseHash = originalFlow ? getConfigFormFlowSemanticHash(originalFlow) : undefined
    stepSequence = 0
    selectedStepId.value = undefined
    removed.value = false
    representable.value = true
    importDiagnostics.value = []
    saveDiagnostics.value = []
    flowSnapshotConflict.value = false

    if (!originalFlow) {
      hasDraft.value = false
      draftMetadata.value = undefined
      steps.value = []
      baseFingerprint = ''
      return
    }

    hasDraft.value = true
    draftMetadata.value = metadataFromFlow(originalFlow)
    const result = readConfigFormFlowSteps(originalFlow)
    representable.value = result.success
    steps.value = result.success ? structuredClone(result.steps) : []
    importDiagnostics.value = result.success
      ? []
      : result.diagnostics.map(diagnostic => ({ ...diagnostic }))
    baseFingerprint = draftFingerprint()
  }

  function detectExternalConflict(): boolean {
    if (getConfigFormFlowTriggerKey(props.initialTrigger) !== sessionTriggerKey)
      return false
    const liveMatches = scopedFlows.value
    if (originalFlowId) {
      const live = props.flows.find(flow => flow.id === originalFlowId)
      flowSnapshotConflict.value = !live || getConfigFormFlowSemanticHash(live) !== baseHash
    }
    else {
      flowSnapshotConflict.value = liveMatches.length > 0
    }
    return flowSnapshotConflict.value
  }

  function addFlow(): void {
    if (props.readonly || scopedFlows.value.length > 0 || hasDraft.value)
      return
    const id = createFlowId()
    draftMetadata.value = {
      version: CONFIG_FORM_FLOW_VERSION,
      id,
      name: locale.value.t('flow.defaultName', 'On {event}', { event: flowTriggerLabel(props.initialTrigger) }),
      trigger: structuredClone(props.initialTrigger),
      concurrency: 'latest',
      errorPolicy: { onError: 'failure', timeoutMs: 10000 },
    }
    steps.value = []
    hasDraft.value = true
    removed.value = false
    representable.value = true
    saveDiagnostics.value = []
  }

  function stageRemoveFlow(): void {
    if (blocked.value || !hasDraft.value)
      return
    if (!originalFlow) {
      hasDraft.value = false
      draftMetadata.value = undefined
      steps.value = []
      selectedStepId.value = undefined
      saveDiagnostics.value = []
      return
    }
    removed.value = true
    selectedStepId.value = undefined
    saveDiagnostics.value = []
  }

  function restoreRemovedFlow(): void {
    if (!props.readonly)
      removed.value = false
  }

  function patchMetadata(patch: Partial<ConfigFormFlowMetadata>): void {
    if (!canEdit.value || !draftMetadata.value)
      return
    draftMetadata.value = { ...structuredClone(draftMetadata.value), ...structuredClone(patch) }
    saveDiagnostics.value = []
  }

  function updateConcurrency(value: unknown): void {
    if (value === 'latest' || value === 'queue' || value === 'ignore')
      patchMetadata({ concurrency: value })
  }

  function updateFlowErrorPolicy(value: unknown): void {
    if (value !== 'failure' && value !== 'end')
      return
    patchMetadata({
      errorPolicy: {
        onError: value,
        timeoutMs: draftMetadata.value?.errorPolicy?.timeoutMs ?? 10000,
      },
    })
  }

  function updateFlowTimeout(value: number | undefined): void {
    const timeoutMs = Number(value)
    if (!Number.isInteger(timeoutMs) || timeoutMs < 0)
      return
    patchMetadata({
      errorPolicy: {
        onError: draftMetadata.value?.errorPolicy?.onError ?? 'failure',
        timeoutMs,
      },
    })
  }

  function addStep(type: ConfigFormFlowStep['type'], target: FlowStepTarget = {}): void {
    if (!canEdit.value)
      return
    const step = createStep(type)
    const next = insertFlowStepDraft(steps.value, step, target)
    if (!next)
      return
    steps.value = next
    selectedStepId.value = step.id
    saveDiagnostics.value = []
  }

  function replaceSelectedStep(step: ConfigFormFlowStep): void {
    if (!canEdit.value || step.id !== selectedStepId.value)
      return
    const next = replaceFlowStepDraft(steps.value, step.id, step)
    if (!next)
      return
    steps.value = next
    saveDiagnostics.value = []
  }

  function patchSelectedStep(patch: Partial<ConfigFormFlowStep>): void {
    const step = selectedStep.value
    if (!step)
      return
    replaceSelectedStep({ ...structuredClone(step), ...structuredClone(patch) } as ConfigFormFlowStep)
  }

  function removeStep(stepId: string): void {
    if (!canEdit.value)
      return
    const next = removeFlowStepDraft(steps.value, stepId)
    if (!next)
      return
    steps.value = next
    if (selectedStepId.value === stepId)
      selectedStepId.value = undefined
    saveDiagnostics.value = []
  }

  function moveStep(stepId: string, direction: -1 | 1): void {
    if (!canEdit.value)
      return
    const next = moveFlowStepDraft(steps.value, stepId, direction)
    if (next) {
      steps.value = next
      saveDiagnostics.value = []
    }
  }

  function duplicateStep(stepId: string): void {
    if (!canEdit.value)
      return
    const source = findFlowStep(steps.value, stepId)
    const entry = treeEntries.value.find(item => item.entryType === 'step' && item.step.id === stepId)
    if (!source || !entry || entry.entryType !== 'step')
      return
    const cloned = cloneConfigFormFlowSteps([source], (_sourceId, context) => nextStepId(context.step.type))
    if (!cloned.success || !cloned.steps[0]) {
      saveDiagnostics.value = cloned.diagnostics.map(diagnostic => ({ ...diagnostic }))
      return
    }
    const next = insertFlowStepDraft(steps.value, cloned.steps[0], {
      ...entry.target,
      index: entry.index + 1,
    })
    if (!next)
      return
    steps.value = next
    selectedStepId.value = cloned.steps[0].id
    saveDiagnostics.value = []
  }

  function changeActionDescriptor(ref: unknown): void {
    const step = selectedStep.value
    if (step?.type !== 'action' || typeof ref !== 'string')
      return
    const descriptor = descriptorByRef.value.get(ref)
    replaceSelectedStep({
      ...structuredClone(step),
      ref,
      input: descriptor ? createDescriptorInput(descriptor) : {},
    })
  }

  function updateStepPolicy(policy: ConfigFormFlowStepPolicy | undefined): void {
    const step = selectedStep.value
    if (step?.type !== 'action' && step?.type !== 'reaction')
      return
    const next = structuredClone(step)
    if (policy && Object.keys(policy).length > 0)
      next.policy = structuredClone(policy)
    else
      delete next.policy
    replaceSelectedStep(next)
  }

  function setStepInput(value: ConfigFormValueInput): void {
    const step = selectedStep.value
    if (step?.type === 'action')
      replaceSelectedStep({ ...structuredClone(step), input: structuredClone(value) })
  }

  function setStepReactions(value: ConfigFormFlowReactionStep['reactions']): void {
    const step = selectedStep.value
    if (step?.type === 'reaction')
      replaceSelectedStep({ ...structuredClone(step), reactions: structuredClone(value) })
  }

  function canMove(stepId: string, direction: -1 | 1): boolean {
    return canMoveFlowStep(steps.value, stepId, direction)
  }

  async function save(): Promise<boolean> {
    if (saving.value || props.readonly || !hasDraft.value || triggerConflict.value || detectExternalConflict())
      return false
    saveDiagnostics.value = []

    let operation: ProjectOperation
    if (removed.value) {
      if (!originalFlowId)
        return false
      operation = { type: 'flow.remove', pageId: props.pageId, flowId: originalFlowId }
    }
    else {
      if (!representable.value || !draftMetadata.value)
        return false
      const parameterDiagnostics = validateActionParameters()
      if (parameterDiagnostics.length > 0) {
        saveDiagnostics.value = parameterDiagnostics
        selectDiagnosticStep(parameterDiagnostics)
        return false
      }
      const created = createConfigFormFlowFromSteps(
        structuredClone(draftMetadata.value),
        structuredClone(steps.value),
      )
      if (!created.success) {
        saveDiagnostics.value = created.diagnostics.map(diagnostic => ({ ...diagnostic }))
        selectDiagnosticStep(saveDiagnostics.value)
        return false
      }
      if (originalFlowId && getConfigFormFlowSemanticHash(created.flow) === baseHash) {
        onClose()
        return true
      }
      operation = originalFlowId
        ? { type: 'flow.update', pageId: props.pageId, flowId: originalFlowId, flow: created.flow }
        : { type: 'flow.add', pageId: props.pageId, flow: created.flow }
    }

    const command: ProjectCommand = {
      id: `flow-save-${Date.now().toString(36)}-${++commandSequence}`,
      label: locale.value.t(
        operation.type === 'flow.add'
          ? 'flow.command.add'
          : operation.type === 'flow.remove'
            ? 'flow.command.remove'
            : 'flow.command.update',
        operation.type === 'flow.add'
          ? 'Add event flow'
          : operation.type === 'flow.remove'
            ? 'Remove event flow'
            : 'Update event flow',
      ),
      actions: [{ type: 'operation.apply', operations: [operation] }],
    }

    saving.value = true
    try {
      const result = await props.execute(command)
      if (!result.changed) {
        saveDiagnostics.value = result.diagnostics?.length
          ? result.diagnostics.map(diagnostic => ({ ...diagnostic }))
          : [{ code: 'FLOW_SAVE_REJECTED', message: locale.value.t('flow.saveRejected', 'The flow could not be saved.') }]
        return false
      }
      onClose()
      return true
    }
    catch (cause) {
      saveDiagnostics.value = [{
        code: 'FLOW_SAVE_FAILED',
        message: cause instanceof Error ? cause.message : locale.value.t('flow.saveFailed', 'Saving the flow failed.'),
      }]
      return false
    }
    finally {
      saving.value = false
    }
  }

  function cancel(): void {
    if (!saving.value)
      onClose()
  }

  async function confirmClose(): Promise<boolean> {
    if (saving.value)
      return false
    if (!dirty.value)
      return true
    try {
      await ElMessageBox.confirm(
        locale.value.t('flow.discard.message', 'Discard the unsaved event flow changes?'),
        locale.value.t('flow.discard.title', 'Discard changes'),
        {
          appendTo: document.getElementById('workbench-overlays') ?? document.body,
          cancelButtonText: locale.value.t('flow.discard.keep', 'Keep editing'),
          confirmButtonText: locale.value.t('flow.discard.confirm', 'Discard'),
          distinguishCancelAndClose: false,
          type: 'warning',
        },
      )
      return true
    }
    catch {
      return false
    }
  }

  async function requestClose(): Promise<void> {
    if (await confirmClose())
      onClose()
  }

  function flowTriggerLabel(trigger: ConfigFormFlowTrigger): string {
    if (trigger.kind === 'component.event') {
      const target = props.eventTargets?.find(candidate => candidate.nodeId === trigger.nodeId && candidate.event === trigger.event)
      return target
        ? `${target.nodeLabel} · ${target.eventLabel}`
        : locale.value.t('flow.eventUnavailable', 'Registered component event')
    }
    const fallbacks: Record<string, string> = {
      'form.initialize': 'Form initialization',
      'page.mount': 'Page mounted',
      'page.unmount': 'Page unmounted',
      'form.valuesChange': 'Form values changed',
      'form.beforeSubmit': 'Before submit',
      'form.validationSuccess': 'Validation succeeded',
      'form.validationFailure': 'Validation failed',
      'form.reset': 'Form reset',
      'form.submit': 'Form submit',
    }
    return locale.value.t(`flow.trigger.${trigger.kind}`, fallbacks[trigger.kind] ?? trigger.kind)
  }

  function descriptorTitle(descriptor: ConfigFormFlowActionDescriptor): string {
    return locale.value.t(`flow.action.${descriptor.ref}`, descriptor.title)
  }

  function stepTitle(step: ConfigFormFlowStep): string {
    if (step.title?.trim())
      return step.title
    if (step.type === 'action') {
      const descriptor = descriptorByRef.value.get(step.ref)
      return descriptor ? descriptorTitle(descriptor) : locale.value.t('flow.actionUnavailable', 'Unavailable action')
    }
    if (step.type === 'condition')
      return locale.value.t('flow.step.condition', 'Condition')
    if (step.type === 'reaction')
      return locale.value.t('flow.step.reaction', 'Update form')
    return locale.value.t(`flow.outcome.${step.outcome}`, step.outcome)
  }

  function metadataFromFlow(flow: ConfigFormFlow): ConfigFormFlowMetadata {
    return {
      version: flow.version,
      id: flow.id,
      name: flow.name,
      trigger: structuredClone(flow.trigger),
      ...(flow.concurrency === undefined ? {} : { concurrency: flow.concurrency }),
      ...(flow.errorPolicy === undefined ? {} : { errorPolicy: structuredClone(flow.errorPolicy) }),
    }
  }

  function draftFingerprint(): string {
    return JSON.stringify({ metadata: draftMetadata.value, steps: steps.value })
  }

  function createFlowId(): string {
    const ids = new Set(props.flows.map(flow => flow.id))
    let index = props.flows.length + 1
    while (ids.has(`flow-${index}`))
      index += 1
    return `flow-${index}`
  }

  function nextStepId(type: ConfigFormFlowStep['type']): string {
    const ids = collectFlowStepIds(steps.value)
    const flowId = draftMetadata.value?.id ?? 'flow'
    let id = ''
    do {
      stepSequence += 1
      id = `${flowId}-${type}-${stepSequence}`
    } while (ids.has(id))
    return id
  }

  function createStep(type: ConfigFormFlowStep['type']): ConfigFormFlowStep {
    const id = nextStepId(type)
    if (type === 'condition') {
      return {
        id,
        type,
        when: fields.value[0]
          ? {
              kind: 'compare',
              operator: 'eq',
              left: { kind: 'field', field: fields.value[0].field },
              right: { kind: 'literal', value: '' },
            }
          : { kind: 'literal', value: true },
        then: [],
        else: [],
      }
    }
    if (type === 'reaction')
      return { id, type, reactions: [] }
    if (type === 'terminate')
      return { id, type, outcome: 'end' }
    const descriptor = actionDescriptors.value[0]
    return {
      id,
      type,
      ref: descriptor?.ref ?? '',
      input: descriptor ? createDescriptorInput(descriptor) : {},
    }
  }

  function createDescriptorInput(descriptor: ConfigFormFlowActionDescriptor): ConfigFormJsonObject {
    const input: ConfigFormJsonObject = {}
    descriptor.parameters.forEach((parameter) => {
      if (parameter.defaultValue !== undefined)
        input[parameter.name] = structuredClone(parameter.defaultValue)
    })
    return input
  }

  function validateActionParameters(): FlowWorkspaceDiagnostic[] {
    const result: FlowWorkspaceDiagnostic[] = []
    const stack = [...steps.value]
    while (stack.length > 0) {
      const step = stack.shift()!
      if (step.type === 'condition') {
        stack.unshift(...step.then, ...step.else)
        continue
      }
      if (step.type !== 'action')
        continue
      const descriptor = descriptorByRef.value.get(step.ref)
      if (!descriptor) {
        result.push({
          code: 'FLOW_ACTION_DESCRIPTOR_MISSING',
          message: locale.value.t('flow.validation.actionUnavailable', 'Choose an available action.'),
          path: ['steps', step.id, 'ref'],
          stepId: step.id,
        })
        continue
      }
      const input = isRecord(step.input) ? step.input : {}
      descriptor.parameters.forEach((parameter) => {
        if (!parameter.required)
          return
        const value = input[parameter.name]
        if (isMissingRequiredValue(value)) {
          result.push({
            code: 'FLOW_ACTION_PARAMETER_REQUIRED',
            message: locale.value.t('flow.validation.parameterRequired', '{parameter} is required.', {
              parameter: locale.value.t(`flow.actionParameter.${descriptor.ref}.${parameter.name}`, parameter.title),
            }),
            path: ['steps', step.id, 'input', parameter.name],
            stepId: step.id,
          })
        }
      })
    }
    return result
  }

  function selectDiagnosticStep(items: readonly FlowWorkspaceDiagnostic[]): void {
    const diagnostic = items.find(item => diagnosticTarget(item).stepId)
    if (diagnostic)
      locateDiagnostic(diagnostic)
  }

  function locateDiagnostic(diagnostic: FlowWorkspaceDiagnostic): { stepId?: string, parameter?: string } {
    const target = diagnosticTarget(diagnostic)
    if (target.stepId)
      selectedStepId.value = target.stepId
    return target
  }

  function diagnosticTarget(diagnostic: FlowWorkspaceDiagnostic): { stepId?: string, parameter?: string } {
    const segments = diagnosticPathSegments(diagnostic.path)
    const knownStepIds = collectFlowStepIds(steps.value)
    const stepId = diagnostic.stepId && knownStepIds.has(diagnostic.stepId)
      ? diagnostic.stepId
      : segments.find(segment => knownStepIds.has(segment))
    const inputIndex = segments.lastIndexOf('input')
    const parameter = inputIndex >= 0 ? segments[inputIndex + 1] : undefined
    return {
      ...(stepId ? { stepId } : {}),
      ...(parameter ? { parameter } : {}),
    }
  }

  function diagnosticPathSegments(path: FlowWorkspaceDiagnostic['path']): string[] {
    if (Array.isArray(path))
      return path.map(String)
    if (typeof path !== 'string')
      return []
    return (path.match(/[^.[\]]+/g) ?? []).map((segment) => {
      if (segment.startsWith('"') && segment.endsWith('"')) {
        try {
          return JSON.parse(segment) as string
        }
        catch {
          return segment.slice(1, -1)
        }
      }
      if (segment.startsWith('\'') && segment.endsWith('\''))
        return segment.slice(1, -1)
      return segment
    })
  }

  function isMissingRequiredValue(value: ConfigFormValueInput | undefined): boolean {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))
      return true
    if (!isRecord(value) || Object.keys(value).length !== 1 || !isRecord(value.$ref) || value.$ref.kind !== 'literal')
      return false
    return isMissingRequiredValue(value.$ref.value as ConfigFormValueInput | undefined)
  }

  function descriptorOutputPath(output: ConfigFormFlowActionDescriptor['outputs'][number]): string[] {
    const path = (output as ConfigFormFlowActionDescriptor['outputs'][number] & { path?: readonly string[] }).path
    return path ? [...path] : [output.name]
  }

  function triggersEqual(left: ConfigFormFlowTrigger, right: ConfigFormFlowTrigger): boolean {
    return getConfigFormFlowTriggerKey(left) === getConfigFormFlowTriggerKey(right)
  }

  function isRecord(value: unknown): value is Record<string, ConfigFormValueInput> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  return {
    actionDescriptors,
    blocked,
    canEdit,
    canMove,
    cancel,
    changeActionDescriptor,
    confirmClose,
    descriptorByRef,
    descriptorTitle,
    diagnostics,
    dirty,
    draftMetadata,
    duplicateStep,
    eventArguments,
    fields,
    invalidParameters,
    flowTriggerLabel,
    hasDraft,
    lockedTrigger,
    locale,
    locateDiagnostic,
    moveStep,
    outputOptions,
    patchMetadata,
    patchSelectedStep,
    removed,
    removeStep,
    replaceSelectedStep,
    representable,
    requestClose,
    restoreRemovedFlow,
    save,
    saving,
    selectedDescriptor,
    selectedStep,
    selectedStepId,
    setStepInput,
    setStepReactions,
    stageRemoveFlow,
    stepTitle,
    steps,
    treeEntries,
    triggerConflict,
    updateConcurrency,
    updateFlowErrorPolicy,
    updateFlowTimeout,
    updateStepPolicy,
    addFlow,
    addStep,
  }
}
