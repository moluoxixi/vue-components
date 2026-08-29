import type { ProjectPath, WorkspaceFile } from '../types'
import { assertUniqueProjectPaths, normalizeProjectPath } from '../path'

export interface ExportSnapshot {
  readonly applicationId: string
  readonly applicationName: string
  readonly applicationRevision: number
  readonly entry: ProjectPath
  readonly files: Readonly<Record<ProjectPath, Readonly<WorkspaceFile>>>
  readonly modelRevision: number
  readonly revisionKey: string
}

export interface CreateExportSnapshotInput {
  applicationId: string
  applicationName: string
  applicationRevision: number
  entry: ProjectPath
  files: Readonly<Record<ProjectPath, WorkspaceFile>>
  modelRevision: number
  revisionKey: string
}

function cloneSnapshotFile(file: WorkspaceFile): Readonly<WorkspaceFile> {
  return Object.freeze(file.kind === 'text'
    ? { ...file }
    : { ...file, content: Uint8Array.from(file.content) })
}

export function createExportSnapshot(input: CreateExportSnapshotInput): ExportSnapshot {
  const sourcePaths = Object.keys(input.files)
  const paths = assertUniqueProjectPaths(sourcePaths)
  const files = Object.freeze(Object.fromEntries(paths.map((path, index) => [
    path,
    cloneSnapshotFile(input.files[sourcePaths[index]! as ProjectPath]!),
  ])) as Record<ProjectPath, Readonly<WorkspaceFile>>)
  const entry = normalizeProjectPath(input.entry)
  if (!Object.hasOwn(files, entry))
    throw new Error(`[config-form-workbench] export entry "${entry}" does not exist`)

  return Object.freeze({
    applicationId: input.applicationId,
    applicationName: input.applicationName,
    applicationRevision: input.applicationRevision,
    entry,
    files,
    modelRevision: input.modelRevision,
    revisionKey: input.revisionKey,
  })
}

export function isExportSnapshotStale(
  snapshot: ExportSnapshot | undefined,
  applicationId: string | undefined,
  revisionKey: string,
): boolean {
  return !!snapshot && (
    snapshot.applicationId !== applicationId
    || snapshot.revisionKey !== revisionKey
  )
}

export function resolveExportSnapshotPath(
  snapshot: ExportSnapshot,
  preferred?: ProjectPath,
): ProjectPath | undefined {
  if (preferred && Object.hasOwn(snapshot.files, preferred))
    return preferred
  if (Object.hasOwn(snapshot.files, snapshot.entry))
    return snapshot.entry

  const paths = Object.keys(snapshot.files).sort((left, right) => left.localeCompare(right, 'en')) as ProjectPath[]
  return paths.find(path => snapshot.files[path]?.kind === 'text') ?? paths[0]
}
