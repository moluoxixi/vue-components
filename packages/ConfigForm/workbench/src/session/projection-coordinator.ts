import type {
  VueRuntimeCompileResult,
  VueRuntimeCompileSuccess,
} from '@moluoxixi/config-form-vue-backend'

export interface PageProjectionInput {
  readonly adapter: string
  readonly editVersion: number
  readonly pageId: string
  readonly projectId: string
  readonly repositoryRevision: number
}

export interface PageProjectionSnapshot extends PageProjectionInput {
  /** Stable identity for one mounted Preview Runtime instance. */
  readonly runtimeSessionKey: string
  readonly revisionKey: string
}

export interface PagePreviewProjection {
  readonly compileResult: VueRuntimeCompileResult
  readonly current: PageProjectionSnapshot
  readonly display?: {
    readonly result: VueRuntimeCompileSuccess
    readonly snapshot: PageProjectionSnapshot
    readonly stale: boolean
  }
  readonly signal: AbortSignal
  readonly status: 'blocked' | 'live' | 'stale'
}

function captureSnapshot(input: PageProjectionInput): PageProjectionSnapshot {
  return Object.freeze({
    ...input,
    runtimeSessionKey: `${input.projectId}:${input.adapter}:${input.pageId}`,
    revisionKey: `${input.projectId}:${input.repositoryRevision}:${input.pageId}:${input.editVersion}`,
  })
}

function samePage(left: PageProjectionSnapshot, right: PageProjectionSnapshot): boolean {
  return left.projectId === right.projectId && left.pageId === right.pageId
}

export interface PageProjectionCoordinator {
  capture: () => PageProjectionSnapshot | undefined
  invalidate: (reason?: unknown) => void
  isCurrent: (revisionKey: string) => boolean
  publish: (
    snapshot: PageProjectionInput,
    compile: (snapshot: PageProjectionSnapshot) => VueRuntimeCompileResult,
  ) => PagePreviewProjection
}

export function createPageProjectionCoordinator(): PageProjectionCoordinator {
  let current: PageProjectionSnapshot | undefined
  let currentController = new AbortController()
  let lastValid: { result: VueRuntimeCompileSuccess, snapshot: PageProjectionSnapshot } | undefined

  return {
    capture: () => current,
    invalidate(reason = 'projection-invalidated') {
      currentController.abort(reason)
      currentController = new AbortController()
      current = undefined
      lastValid = undefined
    },
    isCurrent(revisionKey) {
      return revisionKey !== '' && current?.revisionKey === revisionKey && !currentController.signal.aborted
    },
    publish(snapshot, compile) {
      const next = captureSnapshot(snapshot)
      if (current?.revisionKey !== next.revisionKey) {
        currentController.abort('revision-changed')
        currentController = new AbortController()
      }
      current = next

      const compileResult = compile(next)
      if (compileResult.success)
        lastValid = { result: compileResult, snapshot: next }

      const display = compileResult.success
        ? { result: compileResult, snapshot: next, stale: false }
        : lastValid && samePage(lastValid.snapshot, next)
          ? { ...lastValid, stale: true }
          : undefined

      return {
        compileResult,
        current: next,
        display,
        signal: currentController.signal,
        status: compileResult.success ? 'live' : display ? 'stale' : 'blocked',
      }
    },
  }
}
