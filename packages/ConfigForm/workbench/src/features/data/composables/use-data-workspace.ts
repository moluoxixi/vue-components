import type {
  ConfigFormDataSourceRuntime,
  ConfigFormDataSourceState,
  ConfigFormPageRuntimeConfiguration,
  ConfigFormValueContext,
  ConfigFormValueInput,
} from '@moluoxixi/config-form-core'
import type { ProjectCommand, ProjectOperation } from '@moluoxixi/config-form-model'
import type {
  DataCommandDiagnostic,
  DataEntityKind,
  DataWorkspaceProps,
} from '../types'
import { resolveConfigFormValueInput } from '@moluoxixi/config-form-core'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { ElMessageBox } from 'element-plus'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import {
  cloneRuntimeDraft,
  createDataSourceDraft,
  createVariableDraft,
  DATA_SOURCE_EDITOR_MAX_DURATION_MS,
  isMissingRequiredValue,
  runtimeDraftHash,
  toPersistedRuntime,
  validateDataSourceDraft,
  validateRuntimeDraft,
} from '../services'

const NO_OPTIONS: readonly never[] = []
const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(value => ({ title: value, value }))
const RESPONSE_TYPE_OPTIONS = [
  { title: 'JSON', value: 'json' },
  { title: 'Text', value: 'text' },
]
const TEST_PREVIEW_LIMIT = 12_000
let commandSequence = 0

type OptionalRequestKey = 'body' | 'headers' | 'query'
type DurationKey = 'cacheTtlMs' | 'timeoutMs'

export function useDataWorkspace(
  props: Readonly<DataWorkspaceProps>,
  onClose: () => void,
) {
  const locale = computed(() => createDesignerLocale(props.locale))
  const draft = shallowRef<ConfigFormPageRuntimeConfiguration>(cloneRuntimeDraft(props.runtime))
  const selectedKind = ref<DataEntityKind>('variables')
  const selectedId = ref<string>()
  const saving = ref(false)
  const saveDiagnostics = ref<DataCommandDiagnostic[]>([])
  const externalConflict = ref(false)
  const expandedSections = ref(['request', 'dependencies', 'behavior', 'mapping', 'test'])
  const testState = shallowRef<ConfigFormDataSourceState>(idleTestState())
  let baseHash = runtimeDraftHash(props.runtime)
  let baseRevision = props.runtimeRevision
  let sessionPageId = props.pageId
  let testGeneration = 0
  let activeTestAbort: AbortController | undefined
  let activeTestRuntime: ConfigFormDataSourceRuntime | undefined

  const variables = computed(() => draft.value.variables)
  const dataSources = computed(() => draft.value.dataSources)
  const selectedVariable = computed(() => selectedKind.value === 'variables'
    ? variables.value.find(item => item.id === selectedId.value)
    : undefined)
  const selectedDataSource = computed(() => selectedKind.value === 'dataSources'
    ? dataSources.value.find(item => item.id === selectedId.value)
    : undefined)
  const referenceFields = computed(() => props.referenceFields ?? [])
  const variableCatalog = computed(() => variables.value.map(item => ({ label: item.name, value: item.id })))
  const selectedVariableCatalog = computed(() => variableCatalog.value.filter(item => item.value !== selectedVariable.value?.id))
  const dataSourceCatalog = computed(() => dataSources.value.map(item => ({ label: item.name, value: item.id })))
  const runtimeDiagnostics = computed(() => validateRuntimeDraft(draft.value))
  const selectedSourceDiagnostics = computed(() => selectedDataSource.value
    ? validateDataSourceDraft(selectedDataSource.value)
    : [])
  const dirty = computed(() => runtimeDraftHash(draft.value) !== baseHash)
  const selectedNameInvalid = computed(() => {
    const name = selectedVariable.value?.name ?? selectedDataSource.value?.name
    return name !== undefined && (name.trim().length === 0 || name.trim().length > 160)
  })
  const selectedUrlInvalid = computed(() => selectedDataSource.value
    ? isMissingRequiredValue(selectedDataSource.value.request.url)
    : false)
  const visibleDiagnostics = computed<DataCommandDiagnostic[]>(() => {
    const combined = [
      ...(externalConflict.value
        ? [{
            code: 'DATA_RUNTIME_CONFLICT',
            message: locale.value.t(
              'data.conflict',
              'Page data changed outside this editor. Close and reopen before saving.',
            ),
          }]
        : []),
      ...runtimeDiagnostics.value,
      ...saveDiagnostics.value,
    ]
    const keys = new Set<string>()
    return combined.filter((diagnostic) => {
      const key = `${diagnostic.code}:${diagnostic.message}:${JSON.stringify(diagnostic.path)}`
      if (keys.has(key))
        return false
      keys.add(key)
      return true
    })
  })
  const canSave = computed(() => (
    props.active
    && !props.readonly
    && !saving.value
    && dirty.value
    && !externalConflict.value
    && runtimeDiagnostics.value.length === 0
  ))
  const canTest = computed(() => (
    props.active
    && !!props.onRequest
    && !!selectedDataSource.value
    && selectedSourceDiagnostics.value.length === 0
    && testState.value.status !== 'loading'
  ))
  const testPreview = computed(() => formatPreview(testState.value.data))
  const kindOptions = computed(() => [
    {
      label: locale.value.t('data.variables', 'Variables'),
      value: 'variables' as const,
    },
    {
      label: locale.value.t('data.sources', 'Data sources'),
      value: 'dataSources' as const,
    },
  ])
  const mappingEventArguments = computed(() => [
    { label: locale.value.t('data.mapping.body', 'Response body'), path: ['data'], value: 'response.data' },
    { label: locale.value.t('data.mapping.status', 'Response status'), path: ['status'], value: 'response.status' },
    { label: locale.value.t('data.mapping.ok', 'Response success'), path: ['ok'], value: 'response.ok' },
  ])

  function startSession(): void {
    cancelTest(false)
    draft.value = cloneRuntimeDraft(props.runtime)
    baseHash = runtimeDraftHash(props.runtime)
    baseRevision = props.runtimeRevision
    sessionPageId = props.pageId
    externalConflict.value = false
    saveDiagnostics.value = []
    ensureSelection()
  }

  function ensureSelection(): void {
    const entries = selectedKind.value === 'variables' ? variables.value : dataSources.value
    if (!entries.some(item => item.id === selectedId.value))
      selectedId.value = entries[0]?.id
    resetTestState()
  }

  function selectKind(kind: DataEntityKind): void {
    if (kind === selectedKind.value)
      return
    cancelTest(false)
    selectedKind.value = kind
    selectedId.value = (kind === 'variables' ? variables.value : dataSources.value)[0]?.id
    resetTestState()
  }

  function selectEntity(kind: DataEntityKind, id: string): void {
    if (selectedKind.value === kind && selectedId.value === id)
      return
    cancelTest(false)
    selectedKind.value = kind
    selectedId.value = id
    resetTestState()
  }

  function touchDraft(): void {
    draft.value = cloneRuntimeDraft(draft.value)
    saveDiagnostics.value = []
  }

  function addVariable(): void {
    if (props.readonly)
      return
    const variable = createVariableDraft(draft.value)
    draft.value.variables.push(variable)
    touchDraft()
    selectEntity('variables', variable.id)
  }

  function addDataSource(): void {
    if (props.readonly)
      return
    const source = createDataSourceDraft(draft.value)
    draft.value.dataSources.push(source)
    touchDraft()
    selectEntity('dataSources', source.id)
  }

  function removeSelected(): void {
    if (props.readonly || !selectedId.value)
      return
    cancelTest(false)
    const entries = selectedKind.value === 'variables' ? draft.value.variables : draft.value.dataSources
    const index = entries.findIndex(item => item.id === selectedId.value)
    if (index < 0)
      return
    entries.splice(index, 1)
    touchDraft()
    selectedId.value = entries[Math.min(index, entries.length - 1)]?.id
    resetTestState()
  }

  function setSelectedName(name: string): void {
    const selected = selectedVariable.value ?? selectedDataSource.value
    if (props.readonly || !selected)
      return
    selected.name = name
    touchDraft()
  }

  function setVariableInitialValue(value: ConfigFormValueInput): void {
    if (props.readonly || !selectedVariable.value)
      return
    selectedVariable.value.initialValue = value
    touchDraft()
  }

  function setRequestValue(
    key: 'method' | 'responseType' | 'url',
    value: ConfigFormValueInput,
  ): void {
    if (props.readonly || !selectedDataSource.value)
      return
    selectedDataSource.value.request[key] = value
    touchDraft()
    cancelTest()
  }

  function setOptionalRequestEnabled(key: OptionalRequestKey, enabled: boolean): void {
    const source = selectedDataSource.value
    if (props.readonly || !source)
      return
    if (!enabled) {
      delete source.request[key]
    }
    else if (source.request[key] === undefined) {
      source.request[key] = key === 'body' ? null : {}
    }
    touchDraft()
    cancelTest()
  }

  function setOptionalRequestValue(key: OptionalRequestKey, value: ConfigFormValueInput): void {
    const source = selectedDataSource.value
    if (props.readonly || !source)
      return
    source.request[key] = value
    touchDraft()
    cancelTest()
  }

  function setAuto(enabled: boolean): void {
    if (props.readonly || !selectedDataSource.value)
      return
    selectedDataSource.value.auto = enabled
    touchDraft()
  }

  function setDuration(key: DurationKey, value: number | undefined): void {
    if (props.readonly || !selectedDataSource.value)
      return
    selectedDataSource.value[key] = Math.min(DATA_SOURCE_EDITOR_MAX_DURATION_MS, Math.max(0, Math.trunc(value ?? 0)))
    touchDraft()
    cancelTest()
  }

  function setMappingEnabled(enabled: boolean): void {
    const source = selectedDataSource.value
    if (props.readonly || !source)
      return
    if (enabled) {
      source.mapping ??= { $ref: { kind: 'event', path: ['data'] } }
    }
    else {
      delete source.mapping
    }
    touchDraft()
    cancelTest()
  }

  function setMapping(value: ConfigFormValueInput): void {
    if (props.readonly || !selectedDataSource.value)
      return
    selectedDataSource.value.mapping = value
    touchDraft()
    cancelTest()
  }

  function addDependency(): void {
    const source = selectedDataSource.value
    if (props.readonly || !source)
      return
    const initial: ConfigFormValueInput = referenceFields.value[0]
      ? { $ref: { kind: 'field', nodeId: referenceFields.value[0].nodeId } }
      : variableCatalog.value[0]
        ? { $ref: { kind: 'variable', variableId: variableCatalog.value[0].value } }
        : null
    source.dependencies = [...(source.dependencies ?? []), initial]
    touchDraft()
    cancelTest()
  }

  function setDependency(index: number, value: ConfigFormValueInput): void {
    const source = selectedDataSource.value
    if (props.readonly || !source?.dependencies || index < 0 || index >= source.dependencies.length)
      return
    source.dependencies[index] = value
    touchDraft()
    cancelTest()
  }

  function removeDependency(index: number): void {
    const source = selectedDataSource.value
    if (props.readonly || !source?.dependencies || index < 0 || index >= source.dependencies.length)
      return
    source.dependencies.splice(index, 1)
    if (source.dependencies.length === 0)
      delete source.dependencies
    touchDraft()
    cancelTest()
  }

  function detectExternalConflict(): boolean {
    const revisionChanged = props.runtimeRevision !== baseRevision
    const contentChanged = runtimeDraftHash(props.runtime) !== baseHash
    if (!revisionChanged && !contentChanged)
      return false
    externalConflict.value = true
    return true
  }

  async function save(): Promise<boolean> {
    if (saving.value || props.readonly || !props.active || externalConflict.value || detectExternalConflict())
      return false
    saveDiagnostics.value = runtimeDiagnostics.value.map(diagnostic => ({ ...diagnostic }))
    if (saveDiagnostics.value.length > 0)
      return false
    if (!dirty.value) {
      cancelTest(false)
      onClose()
      return true
    }

    const runtime = toPersistedRuntime(draft.value)
    if (runtimeDraftHash(runtime) === baseHash) {
      cancelTest(false)
      onClose()
      return true
    }
    const operation: ProjectOperation = {
      pageId: props.pageId,
      type: 'page.runtime',
      ...(runtime ? { runtime } : {}),
    }
    const command: ProjectCommand = {
      actions: [{ operations: [operation], type: 'operation.apply' }],
      id: `data-runtime-save-${Date.now().toString(36)}-${++commandSequence}`,
      label: locale.value.t('data.command.update', 'Update page data'),
    }

    saving.value = true
    try {
      const result = await props.execute(command)
      if (!result.changed) {
        saveDiagnostics.value = result.diagnostics?.length
          ? result.diagnostics.map(diagnostic => ({ ...diagnostic }))
          : [{
              code: 'DATA_RUNTIME_SAVE_REJECTED',
              message: locale.value.t('data.saveRejected', 'Page data could not be saved.'),
            }]
        return false
      }
      cancelTest(false)
      onClose()
      return true
    }
    catch (cause) {
      saveDiagnostics.value = [{
        code: 'DATA_RUNTIME_SAVE_FAILED',
        message: cause instanceof Error
          ? cause.message
          : locale.value.t('data.saveFailed', 'Saving page data failed.'),
      }]
      return false
    }
    finally {
      saving.value = false
    }
  }

  function cancel(): void {
    if (saving.value)
      return
    cancelTest(false)
    onClose()
  }

  async function confirmClose(): Promise<boolean> {
    if (saving.value)
      return false
    if (!dirty.value) {
      cancelTest(false)
      return true
    }
    try {
      await ElMessageBox.confirm(
        locale.value.t('data.discard.message', 'Discard the unsaved page data changes?'),
        locale.value.t('data.discard.title', 'Discard changes'),
        {
          appendTo: document.getElementById('workbench-overlays') ?? document.body,
          cancelButtonText: locale.value.t('data.discard.keep', 'Keep editing'),
          confirmButtonText: locale.value.t('data.discard.confirm', 'Discard'),
          distinguishCancelAndClose: false,
          type: 'warning',
        },
      )
      cancelTest(false)
      return true
    }
    catch {
      return false
    }
  }

  async function testDataSource(): Promise<void> {
    const source = selectedDataSource.value
    const request = props.onRequest
    if (!source || !request || !canTest.value)
      return
    cancelTest(false)
    const token = ++testGeneration
    const sourceId = source.id
    const pageId = props.pageId
    const sourceSnapshot = cloneRuntimeDraft({ dataSources: [source], variables: [] }).dataSources[0]!
    const abort = new AbortController()
    activeTestAbort = abort
    testState.value = {
      sourceId,
      startedAt: Date.now(),
      status: 'loading',
    }

    try {
      const { createConfigFormDataSourceRuntime } = await import('@moluoxixi/config-form-core')
      if (!isCurrentTest(token, sourceId, pageId))
        return
      const runtime = createConfigFormDataSourceRuntime({
        host: { request },
        onState: (state) => {
          if (isCurrentTest(token, sourceId, pageId))
            testState.value = state
        },
        sources: [sourceSnapshot],
      })
      activeTestRuntime = runtime
      const state = await runtime.load(sourceId, {
        context: createTestContext(),
        force: true,
        signal: abort.signal,
      })
      if (isCurrentTest(token, sourceId, pageId))
        testState.value = state
    }
    catch (cause) {
      if (isCurrentTest(token, sourceId, pageId))
        testState.value = failedTestState(sourceId, cause)
    }
    finally {
      if (isCurrentTest(token, sourceId, pageId)) {
        activeTestRuntime?.dispose()
        activeTestRuntime = undefined
        activeTestAbort = undefined
      }
    }
  }

  function createTestContext(): ConfigFormValueContext {
    const supplied = props.testContext ?? {}
    const runtimeVariables: Record<string, unknown> = { ...(supplied.variables ?? {}) }
    const context: ConfigFormValueContext = { ...supplied, variables: runtimeVariables }
    const unresolved = draft.value.variables.filter(variable => !Object.hasOwn(runtimeVariables, variable.id))
    while (unresolved.length > 0) {
      let resolvedAny = false
      for (let index = unresolved.length - 1; index >= 0; index -= 1) {
        const variable = unresolved[index]!
        try {
          runtimeVariables[variable.id] = resolveConfigFormValueInput(variable.initialValue, context)
          unresolved.splice(index, 1)
          resolvedAny = true
        }
        catch {
          // A request that uses the unresolved variable will produce the precise Core diagnostic.
        }
      }
      if (!resolvedAny)
        break
    }
    return context
  }

  function isCurrentTest(token: number, sourceId: string, pageId: string): boolean {
    return token === testGeneration
      && props.active
      && props.pageId === pageId
      && selectedKind.value === 'dataSources'
      && selectedId.value === sourceId
  }

  function cancelTest(reset = true): void {
    testGeneration += 1
    activeTestAbort?.abort(new Error('Data-source test was cancelled.'))
    activeTestRuntime?.dispose()
    activeTestAbort = undefined
    activeTestRuntime = undefined
    if (reset)
      resetTestState()
  }

  function resetTestState(): void {
    testState.value = idleTestState(selectedDataSource.value?.id)
  }

  watch(
    [() => props.active, () => props.pageId],
    ([active, pageId], [wasActive, previousPageId] = [false, '']) => {
      if (!active) {
        cancelTest()
        return
      }
      if (!wasActive || pageId !== previousPageId || pageId !== sessionPageId)
        startSession()
    },
    { immediate: true },
  )

  watch(
    [() => runtimeDraftHash(props.runtime), () => props.runtimeRevision],
    () => {
      if (props.active)
        detectExternalConflict()
    },
  )

  onBeforeUnmount(() => cancelTest(false))

  return {
    DATA_SOURCE_EDITOR_MAX_DURATION_MS,
    NO_OPTIONS,
    METHOD_OPTIONS,
    RESPONSE_TYPE_OPTIONS,
    addDataSource,
    addDependency,
    addVariable,
    cancel,
    cancelTest,
    canSave,
    canTest,
    confirmClose,
    dataSourceCatalog,
    dataSources,
    dirty,
    draft,
    expandedSections,
    externalConflict,
    kindOptions,
    locale,
    mappingEventArguments,
    referenceFields,
    removeDependency,
    removeSelected,
    runtimeDiagnostics,
    save,
    saveDiagnostics,
    saving,
    selectEntity,
    selectKind,
    selectedDataSource,
    selectedId,
    selectedKind,
    selectedNameInvalid,
    selectedSourceDiagnostics,
    selectedUrlInvalid,
    selectedVariable,
    selectedVariableCatalog,
    setAuto,
    setDependency,
    setDuration,
    setMapping,
    setMappingEnabled,
    setOptionalRequestEnabled,
    setOptionalRequestValue,
    setRequestValue,
    setSelectedName,
    setVariableInitialValue,
    testDataSource,
    testPreview,
    testState,
    variableCatalog,
    variables,
    visibleDiagnostics,
  }
}

function idleTestState(sourceId = ''): ConfigFormDataSourceState {
  return { sourceId, status: 'idle' }
}

function failedTestState(sourceId: string, cause: unknown): ConfigFormDataSourceState {
  const candidate = cause as { code?: unknown, message?: unknown, path?: unknown }
  return {
    error: {
      code: typeof candidate?.code === 'string' ? candidate.code : 'DATA_SOURCE_TEST_FAILED',
      message: cause instanceof Error ? cause.message : 'Data-source test failed.',
      ...(typeof candidate?.path === 'string' ? { path: candidate.path } : {}),
    },
    finishedAt: Date.now(),
    sourceId,
    status: 'error',
  }
}

function formatPreview(value: unknown): string {
  if (value === undefined)
    return 'undefined'
  try {
    const serialized = JSON.stringify(value, null, 2) ?? 'undefined'
    return serialized.length > TEST_PREVIEW_LIMIT
      ? `${serialized.slice(0, TEST_PREVIEW_LIMIT)}\n...`
      : serialized
  }
  catch {
    return String(value).slice(0, TEST_PREVIEW_LIMIT)
  }
}
