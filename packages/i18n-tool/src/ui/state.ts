import type {
  I18nDiagnostic,
  TranslationCandidate,
} from '../core'
import type {
  PreviewResponse,
  SanitizedConfigResponse,
  ScanResponse,
} from '../shared/protocol'

export type WorkbenchView = 'changes' | 'resources' | 'translate'
export type RequestStatus = 'cancelled' | 'error' | 'idle' | 'loading' | 'ready'

export interface CandidateState extends TranslationCandidate {
  accepted: boolean
  overwriteApproved: boolean
  valid: boolean
}

export interface WorkbenchState {
  activeView: WorkbenchView
  applyStatus: RequestStatus
  candidates: readonly CandidateState[]
  config?: SanitizedConfigResponse
  configStatus: RequestStatus
  diagnostics: readonly I18nDiagnostic[]
  error?: string
  preview?: PreviewResponse
  previewStatus: RequestStatus
  scan?: ScanResponse
  scanStatus: RequestStatus
  selectedUnitIds: readonly string[]
  targetLocale?: string
  translationProgress: { completed: number, total: number }
  translationStatus: RequestStatus
}

export type WorkbenchAction
  = | { type: 'apply/error', code?: string, message: string }
    | { type: 'apply/start' }
    | { type: 'apply/success', scan: ScanResponse }
    | { type: 'candidate/accept', accepted: boolean, sourceUnitId: string }
    | { type: 'candidate/edit', sourceUnitId: string, valid: boolean, value: string }
    | { type: 'candidate/overwrite', approved: boolean, sourceUnitId: string }
    | { type: 'config/error', message: string }
    | { type: 'config/start' }
    | { type: 'config/success', config: SanitizedConfigResponse }
    | { type: 'preview/error', message: string }
    | { type: 'preview/start' }
    | { type: 'preview/success', preview: PreviewResponse }
    | { type: 'scan/error', message: string }
    | { type: 'scan/start' }
    | { type: 'scan/success', scan: ScanResponse }
    | { type: 'selection/set', unitIds: readonly string[] }
    | { type: 'target/set', locale: string }
    | { type: 'translation/cancelled' }
    | { type: 'translation/candidate', candidate: TranslationCandidate, valid: boolean }
    | { type: 'translation/diagnostic', diagnostic: I18nDiagnostic }
    | { type: 'translation/error', message: string }
    | { type: 'translation/progress', completed: number, total: number }
    | { type: 'translation/start', total: number }
    | { type: 'translation/success' }
    | { type: 'view/set', view: WorkbenchView }

export function createInitialState(): WorkbenchState {
  return {
    activeView: 'resources',
    applyStatus: 'idle',
    candidates: [],
    configStatus: 'idle',
    diagnostics: [],
    previewStatus: 'idle',
    scanStatus: 'idle',
    selectedUnitIds: [],
    translationProgress: { completed: 0, total: 0 },
    translationStatus: 'idle',
  }
}

function updateCandidate(
  candidates: readonly CandidateState[],
  sourceUnitId: string,
  update: (candidate: CandidateState) => CandidateState,
): CandidateState[] {
  return candidates.map(candidate => candidate.sourceUnitId === sourceUnitId ? update(candidate) : candidate)
}

function invalidatePreview(state: WorkbenchState): WorkbenchState {
  return {
    ...state,
    activeView: state.activeView === 'changes' ? 'translate' : state.activeView,
    applyStatus: 'idle',
    preview: undefined,
    previewStatus: 'idle',
  }
}

export function reduceWorkbenchState(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case 'config/start':
      return { ...state, configStatus: 'loading', error: undefined }
    case 'config/success': {
      const targetLocale = state.targetLocale && action.config.resources.targetLocales.includes(state.targetLocale)
        ? state.targetLocale
        : action.config.resources.targetLocales[0]
      return { ...state, config: action.config, configStatus: 'ready', targetLocale }
    }
    case 'config/error':
      return { ...state, configStatus: 'error', error: action.message }
    case 'scan/start':
      return {
        ...invalidatePreview(state),
        candidates: [],
        diagnostics: [],
        error: undefined,
        scan: undefined,
        scanStatus: 'loading',
        selectedUnitIds: [],
        translationStatus: 'idle',
      }
    case 'scan/success': {
      const targetLocale = state.targetLocale ?? state.config?.resources.targetLocales[0]
      const selectedUnitIds = action.scan.unitGaps
        .filter(gap => gap.targetLocale === targetLocale && gap.status !== 'existing')
        .map(gap => gap.sourceUnitId)
      return {
        ...state,
        applyStatus: 'idle',
        candidates: [],
        diagnostics: action.scan.diagnostics,
        preview: undefined,
        previewStatus: 'idle',
        scan: action.scan,
        scanStatus: 'ready',
        selectedUnitIds,
        translationStatus: 'idle',
      }
    }
    case 'scan/error':
      return { ...state, scanStatus: 'error', error: action.message }
    case 'target/set': {
      const selectedUnitIds = state.scan?.unitGaps
        .filter(gap => gap.targetLocale === action.locale && gap.status !== 'existing')
        .map(gap => gap.sourceUnitId) ?? []
      return {
        ...invalidatePreview(state),
        candidates: [],
        selectedUnitIds,
        targetLocale: action.locale,
      }
    }
    case 'selection/set':
      return { ...invalidatePreview(state), selectedUnitIds: [...action.unitIds] }
    case 'translation/start':
      return {
        ...invalidatePreview(state),
        diagnostics: [],
        error: undefined,
        preview: undefined,
        previewStatus: 'idle',
        translationProgress: { completed: 0, total: action.total },
        translationStatus: 'loading',
      }
    case 'translation/candidate': {
      const existing = state.candidates.find(candidate => candidate.sourceUnitId === action.candidate.sourceUnitId)
      const next: CandidateState = {
        ...action.candidate,
        accepted: existing?.accepted ?? action.valid,
        overwriteApproved: existing?.overwriteApproved ?? false,
        valid: action.valid,
      }
      return {
        ...state,
        candidates: [...state.candidates.filter(candidate => candidate.sourceUnitId !== next.sourceUnitId), next],
      }
    }
    case 'translation/diagnostic':
      return { ...state, diagnostics: [...state.diagnostics, action.diagnostic] }
    case 'translation/progress':
      return { ...state, translationProgress: { completed: action.completed, total: action.total } }
    case 'translation/success':
      return { ...state, translationStatus: 'ready' }
    case 'translation/cancelled':
      return { ...state, translationStatus: 'cancelled' }
    case 'translation/error':
      return { ...state, error: action.message, translationStatus: 'error' }
    case 'candidate/edit':
      return {
        ...invalidatePreview(state),
        candidates: updateCandidate(state.candidates, action.sourceUnitId, candidate => ({
          ...candidate,
          accepted: action.valid && candidate.accepted,
          valid: action.valid,
          value: action.value,
        })),
      }
    case 'candidate/accept':
      return {
        ...invalidatePreview(state),
        candidates: updateCandidate(state.candidates, action.sourceUnitId, candidate => ({
          ...candidate,
          accepted: action.accepted && candidate.valid,
        })),
      }
    case 'candidate/overwrite':
      return {
        ...invalidatePreview(state),
        candidates: updateCandidate(state.candidates, action.sourceUnitId, candidate => ({
          ...candidate,
          overwriteApproved: action.approved,
        })),
      }
    case 'preview/start':
      return { ...invalidatePreview(state), error: undefined, previewStatus: 'loading' }
    case 'preview/success':
      return {
        ...state,
        activeView: 'changes',
        diagnostics: action.preview.diagnostics,
        preview: action.preview,
        previewStatus: action.preview.previewToken ? 'ready' : 'error',
      }
    case 'preview/error':
      return { ...state, error: action.message, preview: undefined, previewStatus: 'error' }
    case 'apply/start':
      return { ...state, applyStatus: 'loading', error: undefined }
    case 'apply/success':
      return {
        ...reduceWorkbenchState(state, { scan: action.scan, type: 'scan/success' }),
        applyStatus: 'ready',
      }
    case 'apply/error':
      return action.code === 'PREVIEW_STALE' || action.code === 'WRITE_CONFLICT'
        ? { ...invalidatePreview(state), applyStatus: 'error', error: action.message, previewStatus: 'error' }
        : { ...state, applyStatus: 'error', error: action.message }
    case 'view/set':
      return { ...state, activeView: action.view }
  }
}
