<script setup lang="ts">
import type { WorkbenchAction, WorkbenchView } from './state'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { protectedTokensEqual } from '../core/tokens'
import {
  ApiError,
  applyPreview,
  createPreview,
  getConfig,
  scanWorkspace,
  streamTranslation,
} from './api'
import {
  createInitialState,
  reduceWorkbenchState,
} from './state'
import ChangesView from './views/ChangesView.vue'
import ResourcesView from './views/ResourcesView.vue'
import TranslateView from './views/TranslateView.vue'
import WorkspaceTopbar from './components/WorkspaceTopbar.vue'
import WorkspaceTabs from './components/WorkspaceTabs.vue'

const state = ref(createInitialState())
let translationController: AbortController | undefined
let applyEpoch = 0
let previewEpoch = 0
let scanEpoch = 0
let translationEpoch = 0

function dispatch(action: WorkbenchAction): void {
  state.value = reduceWorkbenchState(state.value, action)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed unexpectedly.'
}

function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined
}

async function refreshScan(): Promise<boolean> {
  const epoch = ++scanEpoch
  translationEpoch += 1
  previewEpoch += 1
  applyEpoch += 1
  translationController?.abort()
  dispatch({ type: 'scan/start' })
  try {
    const scan = await scanWorkspace()
    if (epoch !== scanEpoch)
      return false
    dispatch({ scan, type: 'scan/success' })
    return true
  }
  catch (error) {
    if (epoch === scanEpoch)
      dispatch({ message: errorMessage(error), type: 'scan/error' })
    return false
  }
}

async function bootstrap(): Promise<void> {
  dispatch({ type: 'config/start' })
  try {
    dispatch({ config: await getConfig(), type: 'config/success' })
    await refreshScan()
  }
  catch (error) {
    dispatch({ message: errorMessage(error), type: 'config/error' })
  }
}

const sourceUnits = computed(() => {
  const sourceLocale = state.value.config?.resources.sourceLocale
  return state.value.scan?.units.filter(unit => unit.locale === sourceLocale) ?? []
})

function expectedTranslationIds(requestedIds: readonly string[]): Set<string> {
  const requested = new Set(requestedIds)
  const familyScopes = new Set(sourceUnits.value.flatMap(unit => (
    requested.has(unit.id) && unit.semantics.family
      ? [`${unit.origin.resourceId}\0${unit.semantics.family}`]
      : []
  )))
  return new Set(sourceUnits.value
    .filter(unit => requested.has(unit.id) || (
      unit.semantics.family !== undefined
      && familyScopes.has(`${unit.origin.resourceId}\0${unit.semantics.family}`)
    ))
    .map(unit => unit.id))
}

function candidateIsValid(sourceUnitId: string, value: string): boolean {
  const source = sourceUnits.value.find(unit => unit.id === sourceUnitId)
  return source ? protectedTokensEqual(source.value, value) : false
}

async function runTranslation(unitIds = state.value.selectedUnitIds): Promise<void> {
  if (!state.value.scan || !state.value.targetLocale || unitIds.length === 0)
    return
  if (unitIds !== state.value.selectedUnitIds)
    dispatch({ type: 'selection/set', unitIds })
  translationController?.abort()
  previewEpoch += 1
  const epoch = ++translationEpoch
  const controller = new AbortController()
  translationController = controller
  const scanId = state.value.scan.scanId
  const targetLocale = state.value.targetLocale
  const expectedIds = expectedTranslationIds(unitIds)
  dispatch({ total: expectedIds.size, type: 'translation/start' })
  let lastProgress = 0
  let failed = false
  try {
    await streamTranslation({
      scanId,
      targetLocale,
      unitIds: [...unitIds],
    }, (event) => {
      if (epoch !== translationEpoch || translationController !== controller)
        return
      switch (event.type) {
        case 'candidate': {
          if (!expectedIds.has(event.candidate.sourceUnitId) || event.candidate.targetLocale !== targetLocale)
            throw new Error('Translation stream returned a candidate outside the current request.')
          dispatch({
            candidate: event.candidate,
            type: 'translation/candidate',
            valid: candidateIsValid(event.candidate.sourceUnitId, event.candidate.value),
          })
          break
        }
        case 'diagnostic':
          dispatch({ diagnostic: event.diagnostic, type: 'translation/diagnostic' })
          break
        case 'progress':
          if (
            event.total !== expectedIds.size
            || event.completed < lastProgress
            || event.completed > event.total
          ) {
            throw new Error('Translation stream returned invalid progress.')
          }
          lastProgress = event.completed
          dispatch({ completed: event.completed, total: event.total, type: 'translation/progress' })
          break
        case 'error':
          failed = true
          dispatch({ message: event.message, type: 'translation/error' })
          break
        case 'done':
          break
      }
    }, controller.signal)
    if (epoch === translationEpoch && translationController === controller && !failed)
      dispatch({ type: 'translation/success' })
  }
  catch (error) {
    if (epoch === translationEpoch && translationController === controller) {
      if (controller.signal.aborted)
        dispatch({ type: 'translation/cancelled' })
      else
        dispatch({ message: errorMessage(error), type: 'translation/error' })
    }
  }
  finally {
    if (translationController === controller)
      translationController = undefined
  }
}

function stopTranslation(): void {
  translationController?.abort()
}

function retryFailed(): void {
  const expected = new Set(sourceUnits.value.map(unit => unit.id))
  const failedIds = new Set([
    ...state.value.candidates.filter(candidate => !candidate.valid).map(candidate => candidate.sourceUnitId),
    ...state.value.diagnostics.flatMap(diagnostic => diagnostic.unitIds ?? []).filter(id => expected.has(id)),
  ])
  void runTranslation(failedIds.size ? [...failedIds] : state.value.selectedUnitIds)
}

function editCandidate(sourceUnitId: string, value: string): void {
  previewEpoch += 1
  dispatch({ sourceUnitId, type: 'candidate/edit', valid: candidateIsValid(sourceUnitId, value), value })
}

function acceptCandidate(sourceUnitId: string, accepted: boolean): void {
  previewEpoch += 1
  dispatch({ accepted, sourceUnitId, type: 'candidate/accept' })
}

function approveOverwrite(sourceUnitId: string, approved: boolean): void {
  previewEpoch += 1
  dispatch({ approved, sourceUnitId, type: 'candidate/overwrite' })
}

function setSelection(unitIds: readonly string[]): void {
  previewEpoch += 1
  dispatch({ type: 'selection/set', unitIds })
}

async function buildPreview(): Promise<void> {
  if (!state.value.scan || !state.value.targetLocale)
    return
  const candidates = state.value.candidates.filter(candidate => candidate.accepted && candidate.valid)
  if (candidates.length === 0)
    return
  const epoch = ++previewEpoch
  const scanId = state.value.scan.scanId
  const targetLocale = state.value.targetLocale
  dispatch({ type: 'preview/start' })
  try {
    const preview = await createPreview({
      allowOverwriteUnitIds: candidates
        .filter(candidate => candidate.overwriteApproved)
        .map(candidate => candidate.sourceUnitId),
      candidates: candidates.map(candidate => ({
        sourceUnitId: candidate.sourceUnitId,
        targetLocale: candidate.targetLocale,
        value: candidate.value,
      })),
      scanId,
      targetLocale,
    })
    if (epoch === previewEpoch)
      dispatch({ preview, type: 'preview/success' })
  }
  catch (error) {
    if (epoch === previewEpoch)
      dispatch({ message: errorMessage(error), type: 'preview/error' })
  }
}

async function applyChanges(): Promise<void> {
  const previewToken = state.value.preview?.previewToken
  if (!previewToken)
    return
  const epoch = ++applyEpoch
  dispatch({ type: 'apply/start' })
  try {
    const result = await applyPreview(previewToken)
    if (epoch !== applyEpoch)
      return
    dispatch({ scan: result.scan, type: 'apply/success' })
    dispatch({ type: 'view/set', view: 'resources' })
  }
  catch (error) {
    if (epoch === applyEpoch) {
      dispatch({
        code: errorCode(error),
        message: errorMessage(error),
        type: 'apply/error',
      })
    }
  }
}

function setView(view: WorkbenchView): void {
  dispatch({ type: 'view/set', view })
}

function setTarget(locale: string): void {
  previewEpoch += 1
  dispatch({ locale, type: 'target/set' })
}

async function rebuildPreview(): Promise<void> {
  if (await refreshScan()) {
    await nextTick()
    dispatch({ type: 'view/set', view: 'translate' })
  }
}

onMounted(() => void bootstrap())
onBeforeUnmount(() => translationController?.abort())
</script>

<template>
  <div class="app-shell">
    <WorkspaceTopbar
      :config="state.config"
      :refresh-status="state.scanStatus"
      @refresh="refreshScan"
    />

    <WorkspaceTabs
      :changes-enabled="Boolean(state.preview)"
      :model-value="state.activeView"
      @update:model-value="setView"
    />

    <div class="global-status" aria-live="polite" aria-atomic="true">
      <span v-if="state.configStatus === 'loading'">Loading project configuration</span>
      <span v-else-if="state.scanStatus === 'loading'">Scanning locale resources</span>
      <span v-else-if="state.translationStatus === 'loading'">AI translation is running</span>
      <span v-else-if="state.applyStatus === 'ready'">Locale files updated</span>
    </div>

    <div v-if="state.error" class="global-error" role="alert">
      {{ state.error }}
    </div>

    <main class="workspace-main">
      <ResourcesView
        v-show="state.activeView === 'resources'"
        :config="state.config"
        :scan="state.scan"
        :status="state.scanStatus"
      />
      <TranslateView
        v-show="state.activeView === 'translate'"
        :candidates="state.candidates"
        :config="state.config"
        :diagnostics="state.diagnostics"
        :progress="state.translationProgress"
        :scan="state.scan"
        :selected-unit-ids="state.selectedUnitIds"
        :status="state.translationStatus"
        :target-locale="state.targetLocale"
        @accept-candidate="acceptCandidate"
        @edit-candidate="editCandidate"
        @overwrite-candidate="approveOverwrite"
        @preview="buildPreview"
        @retry="retryFailed"
        @selection-change="setSelection"
        @stop="stopTranslation"
        @target-change="setTarget"
        @translate="runTranslation()"
      />
      <ChangesView
        v-show="state.activeView === 'changes'"
        :apply-status="state.applyStatus"
        :preview="state.preview"
        :preview-status="state.previewStatus"
        @apply="applyChanges"
        @refresh="rebuildPreview"
      />
    </main>
  </div>
</template>
