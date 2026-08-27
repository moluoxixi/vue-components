import { describe, expect, it } from 'vitest'
import { normalizeProjectPath } from '../path'
import { upgradeWorkspaceConfigModule, WORKSPACE_CONFIG_MODULE_PATH } from '../upgrade'
import { createProjectFixture } from './fixtures'

describe('workspace project upgrades', () => {
  it('moves legacy generated form projects to the editable Config module', () => {
    const legacyPath = normalizeProjectPath('src/form.ts')
    const configPath = normalizeProjectPath('src/form.config.ts')
    const appPath = normalizeProjectPath('src/App.vue')
    const project = createProjectFixture()
    project.manifest.generatedFormModule = legacyPath
    project.files[legacyPath] = { content: 'export const fields = []', kind: 'text', language: 'typescript' }
    project.files[configPath] = { content: 'legacy config', kind: 'text', language: 'typescript' }
    project.files[appPath] = {
      content: 'import { fields } from \'./form\'',
      kind: 'text',
      language: 'vue',
    }

    const upgraded = upgradeWorkspaceConfigModule(project)

    expect(upgraded.migrated).toBe(true)
    expect(upgraded.project.manifest.generatedFormModule).toBe(WORKSPACE_CONFIG_MODULE_PATH)
    expect(upgraded.project.files[legacyPath]).toBeUndefined()
    expect((upgraded.project.files[appPath] as { content: string }).content).toContain('from \'./form.config\'')
    expect(project.manifest.generatedFormModule).toBe(legacyPath)
  })

  it('returns current projects without cloning them', () => {
    const project = createProjectFixture()
    expect(upgradeWorkspaceConfigModule(project)).toEqual({ migrated: false, project })
  })
})
