import { describe, expect, it } from 'vitest'
import { migrateStoredWorkspaceProject } from '../storage-migration'
import { createDraftFixture, createProjectFixture } from './fixtures'

describe('workspace storage migrations', () => {
  it('accepts the current envelope and validates nested records', () => {
    const project = createProjectFixture()
    const draft = createDraftFixture()
    expect(migrateStoredWorkspaceProject({
      draft,
      project,
      storageSchemaVersion: 1,
    })).toEqual({ draft, project, storageSchemaVersion: 1 })
  })

  it('migrates the original unversioned envelope to schema 1', () => {
    const project = createProjectFixture()
    expect(migrateStoredWorkspaceProject({ project })).toEqual({
      project,
      storageSchemaVersion: 1,
    })
  })

  it('rejects future storage versions without corrupting them', () => {
    expect(() => migrateStoredWorkspaceProject({
      project: createProjectFixture(),
      storageSchemaVersion: 2,
    })).toThrow('newer than this workbench')
  })
})
