import type { WorkspaceProject, WorkspaceProjectDraft } from '../types'
import { normalizeProjectPath } from '../path'

export const FIXED_TIME = '2026-08-27T08:00:00.000Z'
export const NEXT_TIME = '2026-08-27T08:01:00.000Z'

export function createProjectFixture(overrides: Partial<WorkspaceProject> = {}): WorkspaceProject {
  const entry = normalizeProjectPath('src/main.ts')
  const designerArtifact = normalizeProjectPath('src/form.designer.json')
  const generatedFormModule = normalizeProjectPath('src/form.config.ts')
  return {
    createdAt: FIXED_TIME,
    files: {
      [designerArtifact]: { content: '{"version":1,"form":{},"nodes":[]}', kind: 'text', language: 'json' },
      [entry]: { content: 'export {}', kind: 'text', language: 'typescript' },
      [generatedFormModule]: { content: 'export const fields = []', kind: 'text', language: 'typescript' },
    },
    id: 'fixture-project',
    manifest: {
      adapter: 'element-plus',
      dependencies: { vue: '3.5.33' },
      designerArtifact,
      entry,
      framework: 'vue',
      generatedFormModule,
    },
    name: 'Fixture project',
    revision: 1,
    schemaVersion: 1,
    template: { id: 'fixture-template', version: 1 },
    updatedAt: FIXED_TIME,
    ...overrides,
  }
}

export function createDraftFixture(): WorkspaceProjectDraft {
  return {
    baseRevision: 1,
    files: {
      [normalizeProjectPath('src/main.ts')]: 'export const draft = true',
    },
    updatedAt: NEXT_TIME,
  }
}
