import type { StoredWorkspaceProject } from './types'
import { WorkspaceProjectError } from './errors'
import { parseWorkspaceProject, parseWorkspaceProjectDraft } from './schema'
import { WORKSPACE_STORAGE_SCHEMA_VERSION } from './types'

type WorkspaceStorageMigration = (input: Record<string, unknown>) => Record<string, unknown>

const WORKSPACE_STORAGE_MIGRATIONS: Readonly<Record<number, WorkspaceStorageMigration>> = Object.freeze({
  0: input => ({ ...input, storageSchemaVersion: 1 }),
})

function storedProjectError(message: string): never {
  throw new WorkspaceProjectError('PROJECT_INVALID', `[config-form-workbench] ${message}`)
}

export function migrateStoredWorkspaceProject(input: unknown): StoredWorkspaceProject {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    storedProjectError('stored project envelope is invalid')

  let current = input as Record<string, unknown>
  let version = current.storageSchemaVersion === undefined ? 0 : Number(current.storageSchemaVersion)
  if (!Number.isInteger(version) || version < 0)
    storedProjectError('stored project schema version is invalid')
  if (version > WORKSPACE_STORAGE_SCHEMA_VERSION)
    storedProjectError('stored project schema is newer than this workbench')

  while (version < WORKSPACE_STORAGE_SCHEMA_VERSION) {
    const migrate = WORKSPACE_STORAGE_MIGRATIONS[version]
    if (!migrate)
      storedProjectError(`no migration exists for storage schema ${String(version)}`)
    current = migrate(current)
    const nextVersion = current.storageSchemaVersion
    if (typeof nextVersion !== 'number' || !Number.isInteger(nextVersion) || nextVersion <= version)
      storedProjectError('stored project schema migration did not advance')
    version = nextVersion
  }

  if (current.storageSchemaVersion !== WORKSPACE_STORAGE_SCHEMA_VERSION)
    storedProjectError('stored project schema migration did not converge')

  return {
    ...(current.draft === undefined ? {} : { draft: parseWorkspaceProjectDraft(current.draft) }),
    project: parseWorkspaceProject(current.project),
    storageSchemaVersion: WORKSPACE_STORAGE_SCHEMA_VERSION,
  }
}
