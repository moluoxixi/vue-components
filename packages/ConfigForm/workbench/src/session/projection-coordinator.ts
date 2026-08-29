import type {
  DesignerCompileResult,
  DesignerCompileSuccess,
} from '@moluoxixi/config-form-designer'
import type { WorkspaceApplication, WorkspacePage } from '../project'
import type { WorkspaceSessionSnapshot } from './workspace-session'
import { cloneWorkspaceApplication } from '../project'

export interface WorkspaceProjectionSnapshot {
  readonly application: WorkspaceApplication
  readonly applicationRevision: number
  readonly currentPage: WorkspacePage
  readonly currentPageId: string
  readonly modelRevision: number
  readonly revisionKey: string
}

export interface WorkspacePreviewProjection {
  readonly compileResult: DesignerCompileResult
  readonly current: WorkspaceProjectionSnapshot
  readonly display?: {
    readonly result: DesignerCompileSuccess
    readonly snapshot: WorkspaceProjectionSnapshot
    readonly stale: boolean
  }
  readonly signal: AbortSignal
  readonly status: 'blocked' | 'live' | 'stale'
}

function projectionRevisionKey(snapshot: Pick<
  WorkspaceSessionSnapshot,
  'application' | 'applicationRevision' | 'currentPageId' | 'modelRevision'
>): string {
  return [
    snapshot.application.id,
    snapshot.applicationRevision,
    snapshot.currentPageId,
    snapshot.modelRevision,
  ].join(':')
}

function captureSnapshot(snapshot: WorkspaceSessionSnapshot): WorkspaceProjectionSnapshot {
  const application = cloneWorkspaceApplication(snapshot.application)
  const currentPage = application.pages.find(page => page.id === snapshot.currentPageId)
  if (!currentPage)
    throw new Error(`Projection page "${snapshot.currentPageId}" does not exist.`)

  return {
    application,
    applicationRevision: snapshot.applicationRevision,
    currentPage,
    currentPageId: currentPage.id,
    modelRevision: snapshot.modelRevision,
    revisionKey: projectionRevisionKey(snapshot),
  }
}

function samePage(left: WorkspaceProjectionSnapshot, right: WorkspaceProjectionSnapshot): boolean {
  return left.application.id === right.application.id
    && left.currentPageId === right.currentPageId
}

export interface WorkspaceProjectionCoordinator {
  capture: () => WorkspaceProjectionSnapshot | undefined
  invalidate: (reason?: unknown) => void
  isCurrent: (revisionKey: string) => boolean
  publish: (
    snapshot: WorkspaceSessionSnapshot,
    compile: (snapshot: WorkspaceProjectionSnapshot) => DesignerCompileResult,
  ) => WorkspacePreviewProjection
}

export function createWorkspaceProjectionCoordinator(): WorkspaceProjectionCoordinator {
  let current: WorkspaceProjectionSnapshot | undefined
  let currentController = new AbortController()
  let lastValid: { result: DesignerCompileSuccess, snapshot: WorkspaceProjectionSnapshot } | undefined

  return {
    capture() {
      if (!current)
        return undefined
      const captured = current
      const application = cloneWorkspaceApplication(captured.application)
      return {
        ...captured,
        application,
        currentPage: application.pages.find(page => page.id === captured.currentPageId)!,
      }
    },
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
