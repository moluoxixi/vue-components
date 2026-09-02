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
  readonly revisionKey: string
  readonly runtimeSessionKey: string
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

export interface PageProjectionCoordinator {
  capture: () => PageProjectionSnapshot | undefined
  invalidate: (reason?: unknown) => void
  isCurrent: (revisionKey: string) => boolean
  publish: (
    snapshot: PageProjectionInput,
    compile: (snapshot: PageProjectionSnapshot) => VueRuntimeCompileResult,
  ) => PagePreviewProjection
}
